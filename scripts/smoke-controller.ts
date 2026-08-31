/**
 * Headless smoke test of the GameController game shell:
 * solution replay, undo, restart, death, save recordComplection.
 * Uses happy-dom for canvas/document stubs and a fake RAF loop.
 */
import { Window } from 'happy-dom';
import { performance as nodePerf } from 'node:perf_hooks';

const win = new Window();
(globalThis as Record<string, unknown>).window = win;
(globalThis as Record<string, unknown>).document = win.document;
try { Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true }); } catch { /* ignore */ }
if (!(globalThis as Record<string, unknown>).performance) {
  (globalThis as Record<string, unknown>).performance = nodePerf;
}
let now = nodePerf.now() + 1000;
globalThis.performance = { now: () => now } as unknown as Performance;
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => { now += 16; cb(now); }, 16) as unknown as number;
globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

const { GameController } = await import('../src/game/controller');
const { getLevelById } = await import('../src/game/levels');
const { cloneState, isComplete, step } = await import('../src/game/engine/logic');
const { buildState } = await import('../src/game/engine/level');
import type { Dir, WorldState } from '../src/game/engine/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name} ${extra}`); }
}

/** BFS that returns the move sequence (for small levels). */
function solveMoves(levelId: string): Dir[] | null {
  const level = getLevelById(levelId)!;
  const start = buildState(level);
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  const q: Array<{ s: WorldState; path: Dir[] }> = [{ s: start, path: [] }];
  const seen = new Set<string>();
  const sig = (s: WorldState) => `${s.player.x},${s.player.y}|${s.jellies.map((j) => `${j.id}:${j.x},${j.y}`).join()}|${s.doors.map((d) => (d.open ? 1 : 0)).join()}|${s.toggles.map((t) => (t.on ? 1 : 0)).join()}`;
  seen.add(sig(start));
  let i = 0;
  while (q.length > 0 && i < 2000000) {
    const cur = q[i++];
    for (const d of dirs) {
      const n = cloneState(cur.s);
      step(n, 0, [d], d);
      if (n.over === 'dead') continue;
      const path = [...cur.path, d];
      if (isComplete(n)) return path;
      const k = sig(n);
      if (!seen.has(k)) {
        seen.add(k);
        q.push({ s: n, path });
      }
    }
  }
  return null;
}

function makeCanvas(): HTMLCanvasElement {
  const c = win.document.createElement('canvas') as unknown as HTMLCanvasElement;
  c.width = 800;
  c.height = 600;
  return c;
}

console.log('SMOKE: controller shell');
const level = getLevelById('w1-01')!;
const path = solveMoves(level.id);
check('w1-01 solution found', !!path, JSON.stringify(path));
if (!path) process.exit(1);
console.log('  solution length', path.length);

// -- replay through the controller --
let completed: { moves: number; timeMs: number } | null = null;
let dead = false;
const ctrl = new GameController(makeCanvas(), level, {
  onComplete: (moves, timeMs) => { completed = { moves, timeMs }; },
  onDead: () => { dead = true; },
  onState: () => { /* no-op */ },
});
const stop = ctrl.initLoop();
await sleep(60);
for (const d of path) {
  ctrl.press(d);
  await sleep(140);
}
await sleep(300);
check('completion fired', !!completed);
check('completion moves match', (completed as { moves: number } | null)?.moves === path.length, `got ${(completed as { moves: number } | null)?.moves} expected ${path.length}`);
stop();

// -- save/recordCompletion through the real store --
const { useGameStore } = await import('../src/store/gameStore');
const storeApi = useGameStore.getState();
storeApi.recordCompletion('w1-01', path.length, 5000, 0);
const saved = useGameStore.getState();
check('progress saved', saved.progress['w1-01']?.completed === true);
check('stars computed (3 stars at par 9)', saved.progress['w1-01']?.stars === 3);
check('best moves saved', saved.progress['w1-01']?.bestMoves === path.length);
check('next level unlocked in save', saved.lastLevelId === 'w1-02');
check('completion modal payload set', saved.completion?.moves === path.length);

// -- undo --
const ctrl2 = new GameController(makeCanvas(), level, { onComplete: () => undefined, onDead: () => undefined, onState: () => undefined });
const stop2 = ctrl2.initLoop();
ctrl2.press('right');
await sleep(140);
ctrl2.press('right');
await sleep(140);
check('moves after 2', ctrl2.state.moveCount === 2);
ctrl2.undo();
check('moves after undo', ctrl2.state.moveCount === 1);
check('history depth', ctrl2.history.length === 1);
ctrl2.undo();
check('moves after 2 undos', ctrl2.state.moveCount === 0);
stop2();

// -- restart --
ctrl2.press('down');
await sleep(160);
ctrl2.restart();
check('restart resets moves', ctrl2.state.moveCount === 0);
check('restart resets history', ctrl2.history.length === 0);

// -- death --
const fireLevel = getLevelById('w5-01')!;
const ctrl3 = new GameController(makeCanvas(), fireLevel, { onComplete: () => undefined, onDead: () => { dead = true; }, onState: () => undefined });
const stop3 = ctrl3.initLoop();
dead = false;
for (let i = 0; i < 4; i++) {
  ctrl3.press('right');
  await sleep(140);
}
await sleep(200);
check('death fired on fire', dead && ctrl3.state.over === 'dead');
stop3();

// -- door/plate + sticky solved via solver (w2-07) --
const w2path = solveMoves('w2-07');
check('w2-07 solution found', !!w2path);
if (w2path) {
  let done = false;
  const ctrl4 = new GameController(makeCanvas(), getLevelById('w2-07')!, { onComplete: () => { done = true; }, onDead: () => undefined, onState: () => undefined });
  const s4 = ctrl4.initLoop();
  for (const d of w2path) { ctrl4.press(d); await sleep(132); }
  await sleep(250);
  check('w2-07 completion', done);
  s4();
}

console.log(failures === 0 ? '\nALL CONTROLLER CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
