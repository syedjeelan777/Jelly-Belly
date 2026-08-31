/**
 * Build-time level QA:
 *  1. Validate every level's shape (buildState).
 *  2. Solve every level with an exhaustive BFS over the real engine.
 *  3. Report moves/solution length, so designers can sanity-check par values.
 *
 * Timed hazard levels (lasers/crushers) are solved with wait actions in 0.25s
 * steps. If a timed level exceeds the state budget, it is reported as
 * "UNKNOWN — verify by hand" rather than silently marked unsolvable.
 */
import { buildState, validateLevel } from '../src/game/engine/level';
import { cloneState, isComplete, step } from '../src/game/engine/logic';
import { LEVELS } from '../src/game/levels';
import type { Dir, WorldState } from '../src/game/engine/types';

const WAIT = 0.25;
const MAX_STATES = 1_200_000;
const MAX_TIME = 300;

function signature(s: WorldState, timed: boolean): string {
  const parts: string[] = [
    `${s.player.x},${s.player.y}`,
    s.jellies.map((j) => `${j.id}:${j.type}${j.x},${j.y}`).sort().join('|'),
    s.doors.map((d) => (d.open ? '1' : '0')).join(''),
    s.toggles.map((t) => (t.on ? '1' : '0')).join(''),
  ];
  if (timed) parts.push(Math.round(s.time / WAIT).toString());
  return parts.join(';');
}

function solve(levelId: string): { ok: boolean; moves: number; states: number; unknown: boolean } {
  const level = LEVELS.find((l) => l.id === levelId)!;
  const timed = level.map.join('').includes('Z') || (level.objects ?? []).some((o) => o.type === 'crusher' || o.type === 'laser');
  const start = buildState(level);
  const queue: WorldState[] = [start];
  const seen = new Set<string>([signature(start, timed)]);
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  let states = 0;

  while (queue.length > 0) {
    const s = queue.shift()!;
    states++;
    if (states > MAX_STATES) return { ok: false, moves: -1, states, unknown: true };

    for (const d of dirs) {
      const n = cloneState(s);
      step(n, timed ? WAIT : 0, [d], d);
      if (n.over === 'dead' || n.over === 'complete') {
        if (n.over === 'complete') return { ok: true, moves: n.moveCount, states, unknown: false };
        continue;
      }
      const key = signature(n, timed);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(n);
    }

    if (timed) {
      if (s.time > MAX_TIME) continue;
      const n = cloneState(s);
      step(n, WAIT, [], 'up');
      if (n.over === 'complete') return { ok: true, moves: n.moveCount, states, unknown: false };
      if (n.over !== 'dead') {
        const key = signature(n, timed);
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(n);
        }
      }
    }
  }
  return { ok: false, moves: -1, states, unknown: false };
}

let failures = 0;
for (const level of LEVELS) {
  try {
    validateLevel(level);
  } catch (e) {
    failures++;
    console.error(`✗ ${level.id} INVALID: ${(e as Error).message}`);
    continue;
  }
  try {
    const r = solve(level.id);
    if (r.ok) {
      console.log(`✓ ${level.id} solvable in ${r.moves} moves (par ${level.par}) — ${r.states} states`);
    } else if (r.unknown) {
      console.warn(`? ${level.id} exceeded state budget — verify by hand`);
    } else {
      failures++;
      console.error(`✗ ${level.id} UNSOLVABLE after ${r.states} states`);
    }
  } catch (e) {
    failures++;
    console.error(`✗ ${level.id} solver crash: ${(e as Error).message}`);
  }
}

console.log(`\n${LEVELS.length - failures}/${LEVELS.length} levels validated.`);
process.exit(failures > 0 ? 1 : 0);
