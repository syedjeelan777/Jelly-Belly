/**
 * Pure, deterministic puzzle simulator.
 * No rendering, no DOM, no randomness — every move is reproducible.
 * The React layer drives this engine; the canvas layer reads state for visuals.
 */
import { inBounds, idx } from './level';
import type { DeathReason, Dir, Jelly, JellyType, Vec2, WorldState } from './types';
import { JELLY_TYPES } from './types';

const DIRS: Record<Dir, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function add(a: Vec2, d: Vec2): Vec2 {
  return { x: a.x + d.x, y: a.y + d.y };
}

export function eq(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cloneState(s: WorldState): WorldState {
  return {
    ...s,
    walls: s.walls.slice(),
    fire: s.fire.slice(),
    spikes: s.spikes.slice(),
    water: s.water.slice(),
    exit: s.exit.slice(),
    jellyGoals: s.jellyGoals.slice(),
    jellies: s.jellies.map((j) => ({ ...j })),
    doors: s.doors.map((d) => ({ ...d })),
    plates: s.plates.map((p) => ({ ...p })),
    toggles: s.toggles.map((t) => ({ ...t })),
    magnets: s.magnets.map((m) => ({ ...m })),
    lasers: s.lasers.map((l) => ({ ...l })),
    crushers: s.crushers.map((c) => ({ ...c })),
    player: { ...s.player },
    lastEvents: [...s.lastEvents],
  };
}

export function cellAt(s: WorldState, x: number, y: number): number {
  return idx(s.w, x, y);
}

/* ---------------------------------- solids ---------------------------------- */

export function doorAt(s: WorldState, x: number, y: number) {
  return s.doors.find((d) => d.x === x && d.y === y);
}

export function crusherAt(s: WorldState, x: number, y: number) {
  return s.crushers.find((c) => {
    const pos = crusherCell(c);
    return pos.x === x && pos.y === y;
  });
}

export function crusherCell(c: WorldState['crushers'][number]): Vec2 {
  return c.axis === 'h' ? { x: c.x + c.offset, y: c.y } : { x: c.x, y: c.y + c.offset };
}

export function jellyAt(s: WorldState, x: number, y: number, ignoreId?: number): Jelly | undefined {
  return s.jellies.find((j) => j.x === x && j.y === y && j.id !== ignoreId);
}

/** Is a cell fully solid for any entity? (wall / closed door / crusher / out of bounds) */
export function isSolidAt(s: WorldState, x: number, y: number): boolean {
  if (!inBounds(s, x, y)) return true;
  if (s.walls[cellAt(s, x, y)]) return true;
  const d = doorAt(s, x, y);
  if (d && !d.open) return true;
  if (crusherAt(s, x, y)) return true;
  return false;
}

/** Solid for a jelly (walls/doors/crushers/other jellies). */
export function isSolidForJelly(s: WorldState, x: number, y: number, ignoreId?: number): boolean {
  if (isSolidAt(s, x, y)) return true;
  return !!jellyAt(s, x, y, ignoreId);
}

export function isSolidForPlayer(s: WorldState, x: number, y: number): boolean {
  return isSolidAt(s, x, y);
}

/* -------------------------------- doors ----------------------------------- */

export function isPlateActive(s: WorldState, p: WorldState['plates'][number]): boolean {
  const onPlate = (x: number, y: number) => p.x === x && p.y === y;
  if (onPlate(s.player.x, s.player.y)) return true;
  return s.jellies.some((j) => onPlate(j.x, j.y));
}

/** Recompute door open states from plates/toggles. Deterministic. */
export function refreshDoors(s: WorldState): void {
  const fires: string[] = [];
  for (const d of s.doors) {
    if (d.latched) continue;
    const plates = s.plates.filter((p) => p.id === d.id);
    const toggles = s.toggles.filter((t) => t.id === d.id);
    const open = (plates.length > 0 && plates.some((p) => isPlateActive(s, p))) || (toggles.length > 0 && toggles.some((t) => t.on));
    if (open) d.latched = toggles.length > 0 && toggles.some((t) => t.on);
    const wasOpen = d.open;
    d.open = open || d.latched;
    if (d.open !== wasOpen) fires.push(d.open ? 'door-open' : 'door-close');
  }
  s.lastEvents.push(...fires);
}

export function toggleFlip(s: WorldState, x: number, y: number): void {
  const t = s.toggles.find((t) => t.x === x && t.y === y);
  if (!t) return;
  t.on = !t.on;
  s.lastEvents.push(t.on ? 'switch-on' : 'switch-off');
  refreshDoors(s);
}

/* ------------------------------- magnets ---------------------------------- */

export function magnetHoldsJelly(s: WorldState, j: Jelly): boolean {
  if (JELLY_TYPES[j.type].magnetic !== true) return false;
  for (const m of s.magnets) {
    if (!m.on) continue;
    const cells = Math.max(1, m.cells ?? 3);
    if (j.x === m.x && Math.abs(j.y - m.y) <= cells) return true;
    if (j.y === m.y && Math.abs(j.x - m.x) <= cells) return true;
  }
  return false;
}

/* -------------------------------- lasers ---------------------------------- */

export function updateLasers(s: WorldState): void {
  for (const l of s.lasers) {
    const t = ((s.time / l.period + l.phase) % 1 + 1) % 1;
    l.on = t < 0.5;
  }
}

/** Cells covered by a laser when active — the emitter cell plus the beam ray. */
export function laserBeamCells(s: WorldState, l: WorldState['lasers'][number]): Vec2[] {
  const out: Vec2[] = [{ x: l.x, y: l.y }];
  const d = l.axis === 'h' ? DIRS.right : DIRS.down;
  let x = l.x + d.x;
  let y = l.y + d.y;
  for (let k = 0; k < l.cells; k++) {
    if (!inBounds(s, x, y) || s.walls[cellAt(s, x, y)]) break;
    const door = doorAt(s, x, y);
    if (door && !door.open) break;
    out.push({ x, y });
    x += d.x;
    y += d.y;
  }
  return out;
}

/* ------------------------------ crushers ---------------------------------- */

export function updateCrushers(s: WorldState): void {
  for (const c of s.crushers) {
    const t = s.time / c.period + c.phase;
    let frac = t % 1;
    if (frac < 0) frac += 1;
    let scaled: number;
    if (c.mode === 'loop') {
      scaled = frac * (c.range + 1);
      c.offset = Math.min(c.range, Math.floor(scaled));
    } else {
      // ping-pong triangle wave 0..1..0
      const tri = 1 - Math.abs(2 * frac - 1);
      c.offset = Math.round(tri * c.range);
    }
  }
}

/* ------------------------------- hazards ----------------------------------- */

function destroyJelly(s: WorldState, j: Jelly, reason: string) {
  s.jellies = s.jellies.filter((x) => x.id !== j.id);
  s.destroyedJellies++;
  s.lastEvents.push(reason);
}

export function checkHazards(s: WorldState): DeathReason | null {
  const p = s.player;
  let playerDead: DeathReason | null = null;

  // Jellies first
  for (const j of [...s.jellies]) {
    const props = JELLY_TYPES[j.type];
    const i = cellAt(s, j.x, j.y);
    if (s.fire[i] && !props.fireproof) {
      destroyJelly(s, j, 'jelly-burn');
      continue;
    }
    if (s.spikes[i] && j.type !== 'heavy') {
      destroyJelly(s, j, 'jelly-burn');
      continue;
    }
    if (s.lasers.some((l) => l.on && laserBeamCells(s, l).some((c) => c.x === j.x && c.y === j.y))) {
      destroyJelly(s, j, 'jelly-burn');
    }
    if (crusherAt(s, j.x, j.y)) {
      destroyJelly(s, j, 'jelly-crush');
    }
  }

  // Player
  const pi = cellAt(s, p.x, p.y);
  if (s.fire[pi]) playerDead = 'fire';
  else if (s.spikes[pi]) playerDead = 'spikes';
  else if (s.lasers.some((l) => l.on && laserBeamCells(s, l).some((c) => c.x === p.x && c.y === p.y))) playerDead = 'laser';
  else if (crusherAt(s, p.x, p.y)) playerDead = 'crusher';

  if (playerDead) {
    s.over = 'dead';
    s.lastEvents.push('player-dead');
  }
  return playerDead;
}

/* ------------------------------ completion --------------------------------- */

export function objectiveInfo(s: WorldState): { label: string; done: number; total: number } {
  const goalsTotal = s.jellyGoals.reduce((a, b) => a + b, 0);
  if (goalsTotal > 0) {
    let done = 0;
    for (let i = 0; i < s.jellyGoals.length; i++) {
      if (!s.jellyGoals[i]) continue;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      if (s.jellies.some((j) => j.x === x && j.y === y)) done++;
    }
    const exitCount = s.exit.reduce((a, b) => a + b, 0);
    if (exitCount > 0) {
      const atExit = s.jellies.some((j) => eq(j, s.player)) || !!s.exit[cellAt(s, s.player.x, s.player.y)];
      return { label: 'fill pads + reach exit', done: done + (atExit ? 1 : 0), total: goalsTotal + 1 };
    }
    return { label: 'fill pads', done, total: goalsTotal };
  }
  const exitCount = s.exit.reduce((a, b) => a + b, 0);
  if (exitCount > 0) {
    const atExit = !!s.exit[cellAt(s, s.player.x, s.player.y)];
    return { label: 'reach exit', done: atExit ? 1 : 0, total: 1 };
  }
  return { label: 'clear the level', done: 0, total: 1 };
}

export function isComplete(s: WorldState): boolean {
  const goalsTotal = s.jellyGoals.reduce((a, b) => a + b, 0);
  if (goalsTotal > 0) {
    let done = 0;
    for (let i = 0; i < s.jellyGoals.length; i++) {
      if (!s.jellyGoals[i]) continue;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      if (s.jellies.some((j) => j.x === x && j.y === y)) done++;
    }
    if (done < goalsTotal) return false;
    if (s.exit.reduce((a, b) => a + b, 0) > 0) {
      return !!s.exit[cellAt(s, s.player.x, s.player.y)];
    }
    return true;
  }
  if (s.exit.reduce((a, b) => a + b, 0) === 0) return false;
  return !!s.exit[cellAt(s, s.player.x, s.player.y)];
}

function checkComplete(s: WorldState): void {
  if (s.over === 'complete') return;
  if (isComplete(s)) {
    s.over = 'complete';
    s.lastEvents.push('complete');
  }
}

/* -------------------------------- movement ---------------------------------- */

export interface MoveResult {
  moved: boolean;
  blocked: boolean;
  movedJellies: number[];
  dead?: DeathReason;
}

/** All planned changes for one move — resolved first, then committed atomically. */
interface MovePlan {
  player: Vec2;
  jellyMoves: Map<number, Vec2>;
  blocked: boolean;
  events: string[];
}

function resolveMove(s: WorldState, dir: Dir): MovePlan {
  const plan: MovePlan = { player: { ...s.player }, jellyMoves: new Map(), blocked: false, events: [] };
  const d = DIRS[dir];
  const from = { ...s.player };
  const to = add(from, d);

  if (isSolidForPlayer(s, to.x, to.y)) {
    plan.blocked = true;
    plan.events.push('bump');
    return plan;
  }

  const pushedJ = jellyAt(s, to.x, to.y);
  if (pushedJ) {
    const props = JELLY_TYPES[pushedJ.type];
    // Magnetic jellies pinned by a magnet field are rigid; heavy jellies are
    // pushable one cell at a time (steady, like crates).
    if (magnetHoldsJelly(s, pushedJ)) {
      plan.blocked = true;
      plan.events.push('bump');
      return plan;
    }
    if (props.hops) {
      const landing = add(to, d);
      if (isSolidForJelly(s, landing.x, landing.y, pushedJ.id)) {
        plan.blocked = true;
        plan.events.push('bump');
        return plan;
      }
      plan.jellyMoves.set(pushedJ.id, landing);
      plan.events.push('hop');
    } else {
      const wet = !!s.water[cellAt(s, to.x, to.y)];
      const moveDist = props.slides || wet ? (wet ? 6 : 5) : 1;
      let px = to.x;
      let py = to.y;
      let steps = 0;
      for (let k = 0; k < moveDist; k++) {
        const nx = px + d.x;
        const ny = py + d.y;
        if (isSolidForJelly(s, nx, ny, pushedJ.id)) break;
        px = nx;
        py = ny;
        steps++;
      }
      if (steps === 0) {
        plan.blocked = true;
        plan.events.push('bump');
        return plan;
      }
      if (px !== to.x || py !== to.y) {
        plan.jellyMoves.set(pushedJ.id, { x: px, y: py });
        plan.events.push(props.slides || wet ? 'slide' : 'push');
      }
    }
  }

  // Sticky/elastic followers behind the player (pulled, not pushed).
  for (const j of s.jellies) {
    if (plan.jellyMoves.has(j.id)) continue;
    if (!JELLY_TYPES[j.type].follow) continue;
    const behind = add(from, { x: -d.x, y: -d.y });
    if (j.x !== behind.x || j.y !== behind.y) continue;
    const target = { ...from }; // vacated player cell
    const props = JELLY_TYPES[j.type];
    if (isSolidForJelly(s, target.x, target.y, j.id)) {
      if (props.rigidity < 0.2 || j.type === 'elastic') {
        plan.blocked = true;
        plan.events.push('bump');
        return plan;
      }
      continue; // sticky stretches, stays put
    }
    plan.jellyMoves.set(j.id, target);
    plan.events.push('stick');
  }

  plan.player = to;
  return plan;
}

/**
 * Attempt one deterministic move.
 * Chain rules: jellies block unless pushable; sticky/elastic follow when pulled;
 * bouncy hops 2 cells; slippery slides; heavy/magnetic block; elastic tether blocks player.
 */
export function attemptMove(s: WorldState, dir: Dir): MoveResult {
  const res: MoveResult = { moved: false, blocked: false, movedJellies: [] };
  if (s.over) return res;
  const plan = resolveMove(s, dir);
  s.lastEvents.push(...plan.events);
  if (plan.blocked) {
    res.blocked = true;
    return res;
  }

  // Commit atomically
  s.player = plan.player;
  s.moveCount++;
  res.moved = true;
  for (const [id, pos] of plan.jellyMoves) {
    const j = s.jellies.find((x) => x.id === id);
    if (j) {
      j.x = pos.x;
      j.y = pos.y;
      res.movedJellies.push(id);
    }
  }

  // Step-on interactions
  toggleFlip(s, s.player.x, s.player.y);
  for (const jid of res.movedJellies) {
    const j = s.jellies.find((x) => x.id === jid);
    if (j) toggleFlip(s, j.x, j.y);
  }
  refreshDoors(s);

  // Hazards + goal
  s.lastEvents.push('move');
  updateCrushers(s);
  refreshDoors(s);
  const dead = checkHazards(s);
  if (dead) res.dead = dead;
  checkComplete(s);
  return res;
}

/** Advance hazard clocks / door states / deaths for dt seconds. */
export function advanceTime(s: WorldState, dt: number): void {
  if (s.over) return;
  s.time += dt;
  updateLasers(s);
  updateCrushers(s);
  refreshDoors(s);
  checkHazards(s);
}

export function step(s: WorldState, dt: number, pending: Dir[], dir: Dir): void {
  if (s.over) {
    pending.length = 0;
    return;
  }
  advanceTime(s, dt);
  if (s.over) {
    pending.length = 0;
    return;
  }
  if (pending.length > 0) {
    const d = pending.shift()!;
    attemptMove(s, d);
  }
  if (s.over) pending.length = 0;
}

export function checkCompleteNow(s: WorldState): void {
  checkComplete(s);
}

export function takeEvents(s: WorldState): string[] {
  const e = s.lastEvents;
  s.lastEvents = [];
  return e;
}

export function countJellies(s: WorldState): number {
  return s.jellies.length;
}

export function sortedJellies(s: WorldState): Jelly[] {
  return [...s.jellies].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function jellyTypeAt(s: WorldState, x: number, y: number): JellyType | null {
  return jellyAt(s, x, y)?.type ?? null;
}
