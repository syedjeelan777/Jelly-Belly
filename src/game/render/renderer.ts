/**
 * Canvas renderer — draws the board, entities, jelly deformation and particles.
 * Keeps 60fps: static tiles are baked once per level into an offscreen canvas;
 * only dynamic elements redraw each frame. No React re-renders here.
 */
import type { Vec2, WorldState } from '../engine/types';
import { JELLY_TYPES } from '../engine/types';
import { cellAt, crusherCell, laserBeamCells, magnetHoldsJelly } from '../engine/logic';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'dot' | 'ring' | 'spark' | 'splash' | 'goo';
}

export interface EntityAnim {
  id: number;
  from: Vec2;
  to: Vec2;
  progress: number;
}

export interface FrameView {
  state: WorldState;
  /** accent color of the current world. */
  accent: string;
  player: EntityAnim;
  jellies: EntityAnim[];
  particles: Particle[];
  shake: number;
  /** 0..1 effects intensity (0 = reduced motion). */
  fx: number;
  stickyLinks: Array<{ player: Vec2; jelly: Vec2; type: 'sticky' | 'elastic' | 'magnetic' }>;
  goalPulse: number;
  debug: boolean;
}

const EASE = (t: number) => t * t * (3 - 2 * t);

function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D | null;
  private staticLayer: HTMLCanvasElement | null = null;
  private w = 0;
  private h = 0;
  private cell = 40;
  private acc = { wx: 0, wy: 0, scale: 1 };
  private t = 0;
  private doorOpen: Record<string, number> = {};
  private platePulse: Record<number, number> = {};
  private squash = new Map<number, { sx: number; sy: number; t: number }|null>();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    if (this.ctx && !('roundRect' in this.ctx)) {
      // older-browser fallback
      const c = this.ctx as unknown as { roundRect?: unknown };
      c.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        const rr = Math.min(r, w / 2, h / 2);
        this.moveTo(x + rr, y);
        this.arcTo(x + w, y, x + w, y + h, rr);
        this.arcTo(x + w, y + h, x, y + h, rr);
        this.arcTo(x, y + h, x, y, rr);
        this.arcTo(x, y, x + w, y, rr);
        this.closePath();
      };
    }
  }

  get cellSize(): number {
    return this.cell;
  }

  private get c(): CanvasRenderingContext2D {
    return this.ctx as CanvasRenderingContext2D;
  }

  /** Rebuild static layer when a new level loads. */
  setLevel(state: WorldState, accent: string): void {
    this.w = state.w;
    this.h = state.h;
    this.doorOpen = {};
    this.squash.clear();
    this.platePulse = {};
    this.buildStaticLayer(state, accent);
  }

  private tile(x: number, y: number, color: string, radius: number) {
    const c = this.c;
    c.beginPath();
    c.roundRect(x + 2, y + 2, this.cell - 4, this.cell - 4, radius);
    c.fillStyle = color;
    c.fill();
  }

  private buildStaticLayer(s: WorldState, accent: string): void {
    const ghost = document.createElement('canvas');
    const scale = Math.min(this.canvas.width / s.w, this.canvas.height / s.h);
    this.acc.scale = scale;
    this.acc.wx = (this.canvas.width - s.w * scale) / 2;
    this.acc.wy = (this.canvas.height - s.h * scale) / 2;
    this.cell = Math.max(8, Math.floor(scale));

    ghost.width = this.canvas.width;
    ghost.height = this.canvas.height;
    const g = ghost.getContext('2d');
    if (!g) return;
    g.setTransform(this.acc.scale, 0, 0, this.acc.scale, this.acc.wx, this.acc.wy);

    // Outer background
    g.fillStyle = '#221a38';
    g.fillRect(-this.acc.wx / this.acc.scale, -this.acc.wy / this.acc.scale, this.canvas.width / this.acc.scale, this.canvas.height / this.acc.scale);

    const cell = this.cell;
    const bg = (x: number, y: number, c: string) => {
      g.beginPath();
      g.roundRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3, cell * 0.24);
      g.fillStyle = c;
      g.fill();
    };

    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const i = cellAt(s, x, y);
        if (s.walls[i]) {
          // wall tile with soft 3D edge
          const px = x * cell;
          const py = y * cell;
          const grad = g.createLinearGradient(px, py, px + cell, py + cell);
          grad.addColorStop(0, '#6f6593');
          grad.addColorStop(1, '#4d4370');
          g.beginPath();
          g.roundRect(px + 1, py + 1, cell - 2, cell - 2, cell * 0.32);
          g.fillStyle = grad;
          g.fill();
          g.beginPath();
          g.roundRect(px + 1, py + 1, cell - 2, cell - 2, cell * 0.32);
          g.strokeStyle = 'rgba(255,255,255,0.14)';
          g.lineWidth = 1.5;
          g.stroke();
          // top highlight
          g.beginPath();
          g.roundRect(px + 4, py + 4, cell - 8, cell * 0.3, cell * 0.2);
          g.fillStyle = 'rgba(255,255,255,0.10)';
          g.fill();
        } else {
          const isExit = !!s.exit[i];
          const isPad = !!s.jellyGoals[i];
          if (isExit || isPad) bg(x, y, 'rgba(125,255,178,0.14)');
          else bg(x, y, 'rgba(255,255,255,0.045)');
          const water = !!s.water[i];
          const fire = !!s.fire[i];
          const spike = !!s.spikes[i];
          if (water) bg(x, y, 'rgba(79,195,247,0.25)');
          if (fire) bg(x, y, 'rgba(255,107,87,0.20)');
          if (spike) bg(x, y, 'rgba(255,255,255,0.05)');
          void accent;
        }
      }
    }
    this.staticLayer = ghost;
  }

  /** Project board cell → canvas pixel position. */
  private px(x: number, y: number): Vec2 {
    return {
      x: this.acc.wx + (x + 0.5) * this.cell,
      y: this.acc.wy + (y + 0.5) * this.cell,
    };
  }

  /** Public world→canvas projection for particle spawning outside the renderer. */
  worldPos(x: number, y: number): Vec2 {
    return this.px(x, y);
  }

  render(view: FrameView, dt: number): void {
    const ctx = this.c;
    if (!ctx) return;
    const cell = this.cell;
    this.t += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // screen shake
    if (view.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    }

    if (this.staticLayer) ctx.drawImage(this.staticLayer, 0, 0);

    const s = view.state;
    ctx.setTransform(this.acc.scale, 0, 0, this.acc.scale, this.acc.wx + 0, this.acc.wy + 0);
    ctx.save();

    this.drawWater(s, view.fx);
    this.drawGoals(s, view.fx);
    this.drawPlates(s, view.fx);
    this.drawToggles(s);
    this.drawMagnets(s, view.fx);
    this.drawSpikes(s);
    this.drawFire(s, view.fx);
    this.drawDoors(s, dt);
    this.drawLasers(s, view.fx);
    this.drawCrushers(s);
    this.drawMagnetFields(s);
    this.drawLinks(view);
    this.drawJellies(view, dt);
    this.drawPlayer(view, dt);
    this.drawParticles(view.particles);

    if (view.debug) this.drawDebug(view);
    ctx.restore();
    // death/complete flash vignette
    if (view.state.over === 'dead') {
      const a = 0.25 + 0.1 * Math.sin(this.t * 6);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,60,60,${a * 0.4})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /* ------------------------------ dynamic tiles ---------------------------- */

  private drawWater(s: WorldState, fx = 1): void {
    const ctx = this.c;
    const cell = this.cell;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if (!s.water[cellAt(s, x, y)]) continue;
        const px = x * cell;
        const py = y * cell;
        const grad = ctx.createLinearGradient(px, py, px, py + cell);
        grad.addColorStop(0, 'rgba(64,190,255,0.75)');
        grad.addColorStop(1, 'rgba(20,90,160,0.65)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(px + 1.5, py + 1.5, cell - 3, cell - 3, cell * 0.22);
        ctx.fill();
        if (fx > 0) {
          const ph = this.t * 2 + (x + y) * 0.7;
          ctx.strokeStyle = `rgba(255,255,255,${0.35 * fx})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px + cell * 0.2, py + cell * (0.35 + 0.08 * Math.sin(ph)));
          ctx.quadraticCurveTo(px + cell * 0.5, py + cell * (0.2 + 0.08 * Math.sin(ph + 1)), px + cell * 0.8, py + cell * (0.35 + 0.08 * Math.sin(ph + 2)));
          ctx.stroke();
        }
      }
    }
  }

  private drawGoals(s: WorldState, fx: number): void {
    const ctx = this.c;
    for (let i = 0; i < s.exit.length; i++) {
      if (!s.exit[i] && !s.jellyGoals[i]) continue;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      const p = this.px(x, y);
      const r = this.cell * (0.28 + 0.05 * Math.sin(this.t * 2.4 + x + y));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(125,255,178,0.10)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (1.25 + 0.1 * Math.sin(this.t * 3)), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(125,255,178,${0.55 + 0.2 * Math.sin(this.t * 3)})`;
      ctx.lineWidth = this.cell * 0.07;
      ctx.stroke();
      if (fx > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(125,255,178,0.18)';
        ctx.stroke();
      }
    }
  }

  private drawPlates(s: WorldState, fx: number): void {
    const ctx = this.c;
    for (const pl of s.plates) {
      const p = this.px(pl.x, pl.y);
      const active = s.player.x === pl.x && s.player.y === pl.y
        ? true
        : s.jellies.some((j) => j.x === pl.x && j.y === pl.y);
      const r = this.cell * 0.32;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#ffd166' : 'rgba(255,209,102,0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (active && fx > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + this.cell * 0.16 * (1 + 0.3 * Math.sin(this.t * 5)), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,209,102,0.35)';
        ctx.stroke();
      }
      // small arrow pulse
      if (!active && fx > 0) {
        ctx.fillStyle = `rgba(255,209,102,${0.22 + 0.18 * Math.sin(this.t * 3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y - this.cell * 0.02, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawToggles(s: WorldState): void {
    const ctx = this.c;
    const cell = this.cell;
    for (const t of s.toggles) {
      const p = this.px(t.x, t.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = t.on ? '#ff9de2' : 'rgba(255,157,226,0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // lever
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (t.on ? cell * 0.2 : -cell * 0.2), p.y - cell * 0.22);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = cell * 0.08;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x + (t.on ? cell * 0.2 : -cell * 0.2), p.y - cell * 0.22, cell * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  private drawMagnets(s: WorldState, fx: number): void {
    const ctx = this.c;
    const cell = this.cell;
    for (const m of s.magnets) {
      const p = this.px(m.x, m.y);
      const r = cell * 0.34;
      ctx.save();
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.roundRect(p.x - r * 0.7, p.y - r * 0.7, r * 1.4, r * 1.4, r * 0.35);
      ctx.fillStyle = m.on ? '#ff9de2' : 'rgba(255,157,226,0.3)';
      ctx.fill();
      ctx.restore();
      // poles
      ctx.fillStyle = '#fff';
      ctx.fillRect(p.x - r * 0.55, p.y - r * 0.55, r * 0.5, r * 1.1);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(p.x + r * 0.05, p.y - r * 0.55, r * 0.5, r * 1.1);
      if (fx > 0 && m.on) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.5 + Math.sin(this.t * 4) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,157,226,0.28)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  private drawMagnetFields(s: WorldState): void {
    const ctx = this.c;
    for (const m of s.magnets) {
      if (!m.on) continue;
      const p = this.px(m.x, m.y);
      const cells = Math.max(1, m.cells);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,157,226,0.20)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -this.t * 30;
      // horizontal field
      if (m.x - cells >= 0 || m.x + cells < s.w) {
        ctx.beginPath();
        ctx.moveTo(p.x - cells * this.cell, p.y);
        ctx.lineTo(p.x + cells * this.cell, p.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - cells * this.cell);
      ctx.lineTo(p.x, p.y + cells * this.cell);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawSpikes(s: WorldState): void {
    const ctx = this.c;
    const cell = this.cell;
    for (let i = 0; i < s.spikes.length; i++) {
      if (!s.spikes[i]) continue;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      const px = x * cell;
      const py = y * cell;
      ctx.fillStyle = '#cfd8e3';
      ctx.beginPath();
      ctx.moveTo(px + cell * 0.1, py + cell * 0.85);
      ctx.lineTo(px + cell * 0.3, py + cell * 0.25);
      ctx.lineTo(px + cell * 0.5, py + cell * 0.85);
      ctx.lineTo(px + cell * 0.7, py + cell * 0.25);
      ctx.lineTo(px + cell * 0.9, py + cell * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(px + cell * 0.1, py + cell * 0.8, cell * 0.8, cell * 0.08);
    }
  }

  private drawFire(s: WorldState, fx: number): void {
    const ctx = this.c;
    const cell = this.cell;
    for (let i = 0; i < s.fire.length; i++) {
      if (!s.fire[i]) continue;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      const cx = this.px(x, y).x;
      const cy = this.px(x, y).y;
      const base = cell * 0.36;
      for (let k = 0; k < 3; k++) {
        const ph = this.t * (3.2 + k * 1.3) + k * 2;
        const h = base * (0.8 + 0.35 * Math.sin(ph));
        ctx.beginPath();
        ctx.moveTo(cx - base * 0.45, cy + base * 0.55);
        ctx.quadraticCurveTo(cx - base * 0.2 * Math.sin(ph + 1), cy - h * 0.7, cx + Math.sin(ph) * base * 0.15, cy - h);
        ctx.quadraticCurveTo(cx + base * 0.2, cy - h * 0.4, cx + base * 0.45, cy + base * 0.55);
        ctx.closePath();
        ctx.fillStyle = k === 0 ? '#ff6b57' : k === 1 ? '#ff9f43' : '#ffd166';
        ctx.globalAlpha = 0.75;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (fx > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, base * 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,107,87,0.12)';
        ctx.fill();
      }
    }
  }

  private drawDoors(s: WorldState, dt: number): void {
    const ctx = this.c;
    for (const d of s.doors) {
      const target = d.open ? 1 : 0;
      const cur = this.doorOpen[d.id] ?? 0;
      this.doorOpen[d.id] = cur + (target - cur) * Math.min(1, dt * 7);
      const prog = EASE(this.doorOpen[d.id] ?? 0);
      const p = this.px(d.x, d.y);
      const cell = this.cell;
      const h = cell * (1 - prog * 0.9);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(p.x - cell * 0.42, p.y - cell * 0.42, cell * 0.84, cell * 0.84, cell * 0.2);
      ctx.fillStyle = 'rgba(185,167,255,0.15)';
      ctx.fill();
      if (h > 1) {
        const grad = ctx.createLinearGradient(p.x, p.y - h / 2, p.x, p.y + h / 2);
        grad.addColorStop(0, '#b9a7ff');
        grad.addColorStop(1, '#8d78e0');
        ctx.beginPath();
        ctx.roundRect(p.x - cell * 0.42, p.y - h / 2, cell * 0.84, h, cell * 0.18);
        ctx.fillStyle = grad;
        ctx.fill();
        // rivets
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(p.x - cell * 0.24, p.y, cell * 0.05, 0, Math.PI * 2);
        ctx.arc(p.x + cell * 0.24, p.y, cell * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawLasers(s: WorldState, fx: number): void {
    const ctx = this.c;
    const cell = this.cell;
    for (const l of s.lasers) {
      const p = this.px(l.x, l.y);
      // emitter
      ctx.beginPath();
      ctx.roundRect(p.x - cell * 0.3, p.y - cell * 0.3, cell * 0.6, cell * 0.6, cell * 0.14);
      ctx.fillStyle = l.on ? '#ff5252' : '#50465f';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = l.on ? '#fff' : 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
      if (l.on) {
        ctx.strokeStyle = `rgba(255,82,82,${0.75 + 0.2 * Math.sin(this.t * 30)})`;
        ctx.lineWidth = cell * 0.16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const c of laserBeamCells(s, l)) {
          const q = this.px(c.x, c.y);
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x, q.y);
        }
        const b = laserBeamCells(s, l);
        if (b.length > 0) {
          const from = this.px(l.x, l.y);
          const to = this.px(b[b.length - 1].x, b[b.length - 1].y);
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
          // glow
          ctx.strokeStyle = 'rgba(255,82,82,0.25)';
          ctx.lineWidth = cell * 0.4;
          ctx.stroke();
        }
        if (fx > 0) {
          ctx.fillStyle = `rgba(255,120,120,${0.5 + 0.3 * Math.sin(this.t * 20)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, cell * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawCrushers(s: WorldState): void {
    const ctx = this.c;
    const cell = this.cell;
    for (const c of s.crushers) {
      const pos = crusherCell(c);
      const p = this.px(pos.x, pos.y);
      const grad = ctx.createLinearGradient(p.x - cell * 0.4, p.y - cell * 0.4, p.x + cell * 0.4, p.y + cell * 0.4);
      grad.addColorStop(0, '#8b81ad');
      grad.addColorStop(1, '#57506e');
      ctx.beginPath();
      ctx.roundRect(p.x - cell * 0.42, p.y - cell * 0.42, cell * 0.84, cell * 0.84, cell * 0.16);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // warning stripes
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(p.x - cell * 0.42, p.y - cell * 0.42, cell * 0.84, cell * 0.84, cell * 0.16);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,209,102,0.5)';
      ctx.lineWidth = cell * 0.12;
      for (let k = -3; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(p.x - cell * 0.5 + k * cell * 0.28, p.y + cell * 0.5);
        ctx.lineTo(p.x + cell * 0.5 + k * cell * 0.28, p.y - cell * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ------------------------------- entities ------------------------------- */

  private drawLinks(view: FrameView): void {
    const ctx = this.c;
    for (const link of view.stickyLinks) {
      const a = this.px(link.player.x, link.player.y);
      const b = this.px(link.jelly.x, link.jelly.y);
      const color = link.type === 'elastic' ? '#7dffb2' : link.type === 'magnetic' ? '#ff9de2' : '#ff7b9c';
      ctx.strokeStyle = hexA(color, 0.5);
      ctx.lineWidth = this.cell * 0.09;
      ctx.lineCap = 'round';
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + (link.type === 'elastic' ? 6 : 0) };
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
      ctx.stroke();
      // goo beads
      for (let k = 1; k < 4; k++) {
        const tt = k / 4;
        const gx = a.x * (1 - tt) + b.x * tt;
        const gy = a.y * (1 - tt) + b.y * tt + Math.sin(this.t * 6 + k) * 2;
        ctx.beginPath();
        ctx.arc(gx, gy, this.cell * 0.07, 0, Math.PI * 2);
        ctx.fillStyle = hexA(color, 0.6);
        ctx.fill();
      }
    }
  }

  private drawBlob(
    cx: number, cy: number, r: number,
    color: string, outline: string,
    sx: number, sy: number,
    type: string, wobble: number,
  ): void {
    const ctx = this.c;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.rotate(Math.sin(wobble * 0.5) * 0.04);
    // shadow
    ctx.beginPath();
    ctx.ellipse(0, r * 0.72, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    // body
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r * 1.4);
    grad.addColorStop(0, 'rgba(255,255,255,0.45)');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, hexA(color, 0.85));
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 1.02, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.strokeStyle = outline;
    ctx.stroke();
    // face
    const ey = -r * 0.18;
    ctx.fillStyle = '#2b2140';
    this.face(ctx, type, r, ey);
    ctx.restore();
  }

  private face(ctx: CanvasRenderingContext2D, type: string, r: number, ey: number): void {
    const eye = r * 0.12;
    const spacing = r * 0.38;
    // eyes
    ctx.beginPath();
    ctx.arc(-spacing, ey, eye, 0, Math.PI * 2);
    ctx.arc(spacing, ey, eye, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(-spacing + eye * 0.3, ey - eye * 0.3, eye * 0.3, 0, Math.PI * 2);
    ctx.arc(spacing + eye * 0.3, ey - eye * 0.3, eye * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // mouth
    ctx.strokeStyle = '#2b2140';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (type === 'bouncy') {
      ctx.arc(0, ey + r * 0.18, r * 0.22, 0.1, Math.PI - 0.1);
    } else if (type === 'slippery') {
      ctx.moveTo(-r * 0.18, ey + r * 0.2);
      ctx.quadraticCurveTo(0, ey + r * 0.34, r * 0.18, ey + r * 0.2);
    } else {
      ctx.arc(0, ey + r * 0.1, r * 0.16, 0.15, Math.PI - 0.15);
    }
    ctx.stroke();
    // cheeks
    ctx.fillStyle = 'rgba(255,120,140,0.35)';
    ctx.beginPath();
    ctx.arc(-spacing * 1.35, ey + r * 0.16, eye * 0.55, 0, Math.PI * 2);
    ctx.arc(spacing * 1.35, ey + r * 0.16, eye * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // type accents
    if (type === 'heavy') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0.3, Math.PI * 0.7);
      ctx.stroke();
    }
  }

  private drawJellies(view: FrameView, dt: number): void {
    const s = view.state;
    const ordered = [...view.jellies].sort((a, b) => a.from.y - b.from.y || a.from.x - b.from.x);
    for (const anim of ordered) {
      const j = s.jellies.find((x) => x.id === anim.id);
      if (!j) continue;
      const p = this.lerpPoint(anim);
      const props = JELLY_TYPES[j.type];
      const r = this.cell * 0.34 * (props.mass >= 4 ? 1.18 : props.mass < 1 ? 0.92 : 1);
      const moving =
        anim.from.x !== anim.to.x || anim.from.y !== anim.to.y;
      const t = anim.progress;
      // squash & stretch along travel axis
      let sx = 1;
      let sy = 1;
      if (moving) {
        const amp = Math.sin(t * Math.PI);
        if (anim.from.x !== anim.to.x) {
          sx = 1 + amp * 0.24 * props.elasticity;
          sy = 1 - amp * 0.2 * props.elasticity;
        } else {
          sx = 1 - amp * 0.2 * props.elasticity;
          sy = 1 + amp * 0.24 * props.elasticity;
        }
      }
      const wob = this.t * (2 + props.elasticity * 2) + j.id * 1.7;
      const idleSx = 1 + Math.sin(wob) * 0.025;
      const idleSy = 1 - Math.sin(wob) * 0.025;
      this.drawBlob(p.x, p.y, r, props.color, hexA(props.color, 0.9), sx * idleSx, sy * idleSy, j.type, wob);
      // held-by-magnet indicator
      if (magnetHoldsJelly(s, j)) {
        this.sparkle(p.x, p.y - r * 1.2, '#ff9de2', 2);
      }
      void dt; void view;
    }
  }

  private lerpPoint(anim: EntityAnim): Vec2 {
    const t = EASE(Math.min(1, anim.progress));
    return {
      x: this.px(anim.from.x, anim.from.y).x * (1 - t) + this.px(anim.to.x, anim.to.y).x * t,
      y: this.px(anim.from.x, anim.from.y).y * (1 - t) + this.px(anim.to.x, anim.to.y).y * t,
    };
  }

  private drawPlayer(view: FrameView, dt: number): void {
    const s = view.state;
    const p = this.lerpPoint(view.player);
    const r = this.cell * 0.36;
    const t = view.player.progress;
    const moving = view.player.from.x !== view.player.to.x || view.player.from.y !== view.player.to.y;
    let sx = 1;
    let sy = 1;
    if (moving) {
      const amp = Math.sin(t * Math.PI);
      if (view.player.from.x !== view.player.to.x) {
        sx = 1 + amp * 0.22;
        sy = 1 - amp * 0.18;
      } else {
        sx = 1 - amp * 0.18;
        sy = 1 + amp * 0.22;
      }
    }
    const wob = this.t * 2.6;
    sx *= 1 + Math.sin(wob) * 0.02;
    sy *= 1 - Math.sin(wob) * 0.02;
    const color = '#ffd166';
    this.drawBlob(p.x, p.y, r, color, '#c98d2e', sx, sy, 'hero', wob);
    // hero crown sprout
    ctxDrawCrown(this.c, p.x, p.y - r * 1.0 * sy, r * 0.5, this.t);
    void dt; void s;
  }

  private drawParticles(particles: Particle[]): void {
    const ctx = this.c;
    for (const pt of particles) {
      const a = Math.max(0, pt.life / pt.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      if (pt.kind === 'ring') {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1 + (1 - a) * 2), 0, Math.PI * 2);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (pt.kind === 'spark') {
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size * 0.4);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Dev overlay: grid, collision boxes, object ids. */
  private drawDebug(view: FrameView): void {
    const ctx = this.c;
    const s = view.state;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,80,255,0.35)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= s.w; x++) {
      ctx.beginPath();
      ctx.moveTo(x * this.cell, 0);
      ctx.lineTo(x * this.cell, s.h * this.cell);
      ctx.stroke();
    }
    for (let y = 0; y <= s.h; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * this.cell);
      ctx.lineTo(s.w * this.cell, y * this.cell);
      ctx.stroke();
    }
    // solid cells
    ctx.fillStyle = 'rgba(255,80,255,0.12)';
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const i = y * s.w + x;
        if (s.walls[i] || s.fire[i] || s.spikes[i] || s.water[i]) {
          ctx.fillRect(x * this.cell, y * this.cell, this.cell, this.cell);
        }
      }
    }
    // ids
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(8, this.cell * 0.3)}px monospace`;
    ctx.textAlign = 'center';
    const p = this.px(s.player.x, s.player.y);
    ctx.fillText('P', p.x, p.y - this.cell * 0.4);
    for (const j of s.jellies) {
      const q = this.px(j.x, j.y);
      ctx.fillText(`#${j.id}`, q.x, q.y - this.cell * 0.4);
    }
    for (const d of s.doors) {
      const q = this.px(d.x, d.y);
      ctx.fillText(d.open ? 'D✓' : 'D✗', q.x, q.y - this.cell * 0.4);
    }
    for (const m of s.magnets) {
      const q = this.px(m.x, m.y);
      ctx.fillText('M', q.x, q.y - this.cell * 0.4);
    }
    ctx.restore();
    void view;
  }

  private sparkle(x: number, y: number, color: string, n: number): void {
    const ctx = this.c;
    for (let i = 0; i < n; i++) {
      const a = this.t * 6 + i * 2.1;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(a);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 6, y + Math.sin(a * 1.3) * 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

/** Small leaf sprout on the hero — original mascot touch. */
function ctxDrawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  ctx.fillStyle = '#7dffb2';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.5, r * 0.28, -0.5 + Math.sin(t * 2) * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4caf6d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.5);
  ctx.lineTo(x, y - r * 0.1);
  ctx.stroke();
}
