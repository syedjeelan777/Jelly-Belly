/**
 * GameController — owns a WorldState, movement queue, undo history,
 * animation state, particles and event→audio mapping. Renders via Renderer.
 * Deterministic puzzle logic lives in game/engine; this file is the shell.
 */
import { buildState } from './engine/level';
import {
  advanceTime, attemptMove, checkCompleteNow, cloneState, takeEvents,
} from './engine/logic';
import type { Dir, LevelData, WorldState } from './engine/types';
import { JELLY_TYPES } from './engine/types';
import { Renderer, type EntityAnim, type FrameView, type Particle } from './render/renderer';
import { audio } from './audio/audio';

const MOVE_MS = 118;
const REPEAT_MS = 148;

export interface ControllerHooks {
  onComplete: (moves: number, timeMs: number, destroyed: number) => void;
  onDead: () => void;
  onState: () => void;
}

export class GameController {
  state: WorldState;
  history: WorldState[] = [];
  historyLimit = 300;
  paused = false;
  reducedMotion = false;
  screenShake = true;

  private level: LevelData;
  private renderer: Renderer;
  private hooks: ControllerHooks;
  private pending: Dir[] = [];
  private holdDir: Dir | null = null;
  private lastRepeatAt = 0;
  private moveStart = 0;
  private playerAnim: EntityAnim;
  private jellyAnims: EntityAnim[] = [];
  private particles: Particle[] = [];
  private shake = 0;
  private startTime = performance.now();
  private completeAt = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, level: LevelData, hooks: ControllerHooks) {
    this._canvas = canvas;
    this.level = level;
    this.state = buildState(level);
    this.renderer = new Renderer(canvas);
    this.renderer.setLevel(this.state, '#7fd4ff');
    this.hooks = hooks;
    this.playerAnim = { id: -1, from: { ...this.state.player }, to: { ...this.state.player }, progress: 1 };
    this.jellyAnims = this.state.jellies.map((j) => ({
      id: j.id, from: { x: j.x, y: j.y }, to: { x: j.x, y: j.y }, progress: 1,
    }));
  }

  resize(w: number, h: number): void {
    const c = this._canvas;
    c.width = w;
    c.height = h;
    this.renderer.setLevel(this.state, '#7fd4ff');
  }

  private _canvas: HTMLCanvasElement;

  /* ------------------------------- input ---------------------------------- */

  press(dir: Dir): void {
    if (this.state.over || this.paused) return;
    if (this.pending.length < 3) this.pending.push(dir);
    this.holdDir = dir;
    this.lastRepeatAt = performance.now();
  }

  hold(dir: Dir | null): void {
    this.holdDir = dir;
    if (dir) this.lastRepeatAt = performance.now() - REPEAT_MS + 40;
  }

  undo(): void {
    if (this.state.over === 'complete' || this.paused) return;
    const prev = this.history.pop();
    if (!prev) {
      audio.sfx('bump');
      return;
    }
    this.state = cloneState(prev);
    this.pending.length = 0;
    this.holdDir = null;
    this.syncAnimIdle();
    this.hooks.onState();
    audio.sfx('undo');
  }

  restart(): void {
    this.state = buildState(this.level);
    this.history.length = 0;
    this.pending.length = 0;
    this.holdDir = null;
    this.startTime = performance.now();
    this.syncAnimIdle();
    this.hooks.onState();
    audio.sfx('restart');
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.lastRepeatAt = performance.now();
  }

  /* -------------------------------- loop ---------------------------------- */

  initLoop(): () => void {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt, now);
      this.render(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      this.disposed = true;
      cancelAnimationFrame(raf);
    };
  }

  private update(dt: number, now: number): void {
    // physics clock always advances (hazards) unless paused/over
    if (!this.paused && !this.state.over) {
      advanceTime(this.state, dt);
      if (this.state.over === 'dead') {
        this.onDead();
      }
      // completion can happen from hazard time too (rare)
      checkCompleteNow(this.state);
      if (this.state.over === 'complete') this.onComplete(now);
    }

    if (this.paused || this.state.over) {
      this.pending.length = 0;
      if (this.state.over !== 'complete') this.shake = Math.max(0, this.shake - dt * 30);
      this.updateParticles(dt);
      return;
    }

    // hold-repeat
    if (this.holdDir && now - this.lastRepeatAt >= REPEAT_MS) {
      this.lastRepeatAt = now;
      if (this.pending.length < 3) this.pending.push(this.holdDir);
    }

    // start a queued move whenever the previous animation has finished
    if (this.pending.length > 0) {
      if (!this.isAnimating() || now - this.moveStart >= MOVE_MS) {
        this.finishAnim();
        this.doMove(this.pending.shift()!, now);
      }
    } else if (this.isAnimating() && now - this.moveStart >= MOVE_MS) {
      this.finishAnim();
    }
    this.shake = Math.max(0, this.shake - dt * 40);
    this.updateParticles(dt);
  }

  private isAnimating(): boolean {
    return this.playerAnim.progress < 1;
  }

  private doMove(dir: Dir, now: number): void {
    const snapshot = cloneState(this.state);

    // capture previous visual positions
    const prevPlayer = { ...this.state.player };
    const prevJelly = new Map(this.state.jellies.map((j) => [j.id, { x: j.x, y: j.y }]));
    const result = attemptMove(this.state, dir);
    if (result.moved) {
      this.history.push(snapshot);
      if (this.history.length > this.historyLimit) this.history.shift();
    }
    this.moveStart = now;
    this.playerAnim = {
      id: -1, from: prevPlayer, to: { ...this.state.player }, progress: 0,
    };
    this.jellyAnims = this.state.jellies.map((j) => {
      const from = prevJelly.get(j.id) ?? { x: j.x, y: j.y };
      return { id: j.id, from, to: { x: j.x, y: j.y }, progress: 0 };
    });
    if (!result.moved) this.finishAnim();
    this.handleEvents(takeEvents(this.state), dir, result);
    this.hooks.onState();

    if (this.state.over === 'complete') this.onComplete(performance.now());
    if (this.state.over === 'dead') this.onDead();
  }

  private finishAnim(): void {
    this.playerAnim.progress = 1;
    for (const a of this.jellyAnims) a.progress = 1;
  }

  private syncAnimIdle(): void {
    this.playerAnim = { id: -1, from: { ...this.state.player }, to: { ...this.state.player }, progress: 1 };
    this.jellyAnims = this.state.jellies.map((j) => ({
      id: j.id, from: { x: j.x, y: j.y }, to: { x: j.x, y: j.y }, progress: 1,
    }));
  }

  /* ------------------------------ particles ------------------------------- */

  private spawnBurst(gridX: number, gridY: number, color: string, n: number, kind: Particle['kind'] = 'dot', speed = 90): void {
    if (this.reducedMotion) return;
    const c = this.renderer.worldPos(gridX, gridY);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x: c.x, y: c.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        life: 0.4 + Math.random() * 0.35,
        max: 0.75,
        size: 3 + Math.random() * 4,
        color,
        kind,
      });
    }
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dot' || p.kind === 'splash') p.vy += 300 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  /* -------------------------------- events -------------------------------- */

  private handleEvents(events: string[], dir: Dir, result: { moved: boolean; blocked: boolean; movedJellies: number[] }): void {
    const s = this.state;
    const pp = this.state.player;
    for (const e of events) {
      switch (e) {
        case 'move': audio.sfx('move'); break;
        case 'push': audio.sfx('push'); this.spawnBurst(pp.x, pp.y, '#ffffff', 3, 'dot', 60); break;
        case 'bump':
          audio.sfx('bump');
          this.shake = Math.max(this.shake, 3.2);
          if (dir === 'up') this.spawnBurst(pp.x, pp.y + 14, '#ffffff', 2, 'dot', 40);
          break;
        case 'stick': audio.sfx('stick'); this.spawnBurst(pp.x, pp.y, '#ff7b9c', 4, 'goo', 70); break;
        case 'hop': audio.sfx('hop'); this.spawnBurst(pp.x, pp.y, '#ffd166', 5, 'dot', 100); break;
        case 'slide': audio.sfx('drift'); this.spawnBurst(pp.x, pp.y, '#b0e7ff', 3, 'splash', 60); break;
        case 'switch-on': audio.sfx('switch-on'); break;
        case 'switch-off': audio.sfx('switch-off'); break;
        case 'door-open': audio.sfx('door-open'); this.spawnBurst(pp.x, pp.y, '#b9a7ff', 5, 'dot', 80); break;
        case 'door-close': audio.sfx('door-close'); break;
        case 'jelly-burn':
          audio.sfx('jelly-burn');
          this.addJellyBurst();
          break;
        case 'jelly-crush': audio.sfx('jelly-crush'); this.addJellyBurst(); break;
        case 'player-dead': audio.sfx('death'); this.shake = 10; this.spawnBurst(pp.x, pp.y, '#ffd166', 14, 'splash', 160); break;
        case 'complete': break; // handled in onComplete
        default: break;
      }
    }
    void result;
  }

  private addJellyBurst(): void {
    const p = this.state.player;
    this.spawnBurst(p.x, p.y, '#ff7b9c', 8, 'splash', 140);
  }

  private onDead(): void {
    this.pending.length = 0;
    this.holdDir = null;
    this.hooks.onDead();
  }

  private onComplete(now: number): void {
    if (this.completeAt === 0) {
      this.completeAt = now;
      this.pending.length = 0;
      this.holdDir = null;
      const timeMs = now - this.startTime;
      // celebrate
      if (!this.reducedMotion) {
        const p = this.state.player;
        this.spawnBurst(p.x, p.y, '#7dffb2', 20, 'dot', 160);
      }
      this.hooks.onComplete(this.state.moveCount, timeMs, this.state.destroyedJellies);
      audio.sfx('complete');
    }
  }

  /* -------------------------------- render -------------------------------- */

  private render(now: number): void {
    const s = this.state;
    const prog = Math.min(1, Math.max(0, (now - this.moveStart) / MOVE_MS));
    this.playerAnim.progress = this.playerAnim.from.x === this.playerAnim.to.x && this.playerAnim.from.y === this.playerAnim.to.y
      ? 1 : prog;
    for (const a of this.jellyAnims) {
      const idle = a.from.x === a.to.x && a.from.y === a.to.y;
      a.progress = idle ? 1 : prog;
    }
    const links = this.buildLinks();
    const view: FrameView = {
      state: s,
      accent: '#7fd4ff',
      player: this.playerAnim,
      jellies: this.jellyAnims.filter((a) => s.jellies.some((j) => j.id === a.id)),
      particles: this.particles,
      shake: this.screenShake ? this.shake : 0,
      fx: this.reducedMotion ? 0 : 1,
      stickyLinks: links,
      goalPulse: Math.sin(now / 300) * 0.5 + 0.5,
    };
    this.renderer.render(view, 0.016);
  }

  private buildLinks() {
    const s = this.state;
    const links: FrameView['stickyLinks'] = [];
    for (const j of s.jellies) {
      const props = JELLY_TYPES[j.type];
      const dist = Math.abs(j.x - s.player.x) + Math.abs(j.y - s.player.y);
      if (props.follow && dist === 1) {
        links.push({ player: { ...this.state.player }, jelly: { x: j.x, y: j.y }, type: j.type === 'elastic' ? 'elastic' : 'sticky' });
      }
    }
    return links;
  }
}
