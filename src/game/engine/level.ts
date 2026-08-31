/**
 * Level parsing — turns compact ASCII maps + object defs into a WorldState.
 * Character legend:
 *   .  empty           #  wall             P  player start
 *   G  exit goal       g  jelly goal       W  water
 *   F  fire            ^  spikes           Z  laser emitter (beam points down)
 *   D  door            O  pressure plate   T  toggle switch
 *   X  magnet block    J  jelly            K  sticky jelly
 *   B  bouncy jelly    H  heavy jelly      E  elastic jelly
 *   L  slippery jelly  M  magnetic jelly
 * Auto-pairing: the nth D pairs with the nth O or T in map order. Use `objects`
 * with explicit ids for complex machines (lasers, crushers, magnets).
 */
import type {
  DoorEntity,
  Jelly,
  JellyType,
  LaserEntity,
  LevelData,
  MagnetEntity,
  PlateEntity,
  ToggleEntity,
  WorldState,
  CrusherEntity,
} from './types';
import { JELLY_CHARS } from './types';

export const LEVEL_CHARS = ['.', '#', 'P', 'G', 'g', 'W', 'F', '^', 'Z', 'D', 'O', 'T', 'X', 'J', 'K', 'B', 'H', 'E', 'L', 'M'];

export function idx(w: number, x: number, y: number): number {
  return y * w + x;
}

export function inBounds(s: { w: number; h: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.w && y < s.h;
}

/** Validate a level map; throws descriptive errors (graceful handling upstream). */
export function validateLevel(level: LevelData): void {
  if (!level.map || level.map.length < 2) throw new Error(`Level ${level.id}: map is empty`);
  const w = level.map[0].length;
  if (w < 3) throw new Error(`Level ${level.id}: map too narrow`);
  let playerCount = 0;
  let exitCount = 0;
  for (let y = 0; y < level.map.length; y++) {
    const row = level.map[y];
    if (row.length !== w) {
      throw new Error(`Level ${level.id}: row ${y} has width ${row.length}, expected ${w}`);
    }
    for (const ch of row) {
      if (!LEVEL_CHARS.includes(ch)) throw new Error(`Level ${level.id}: unknown character '${ch}'`);
      if (ch === 'P') playerCount++;
      if (ch === 'G') exitCount++;
    }
  }
  if (playerCount !== 1) throw new Error(`Level ${level.id}: expected exactly 1 player, found ${playerCount}`);
  const hasJellyGoals = level.map.join('').includes('g');
  if (exitCount === 0 && !hasJellyGoals) {
    throw new Error(`Level ${level.id}: no goal (G or g) found`);
  }
}

export function buildState(level: LevelData): WorldState {
  validateLevel(level);
  const h = level.map.length;
  const w = level.map[0].length;
  const n = w * h;
  const walls = new Uint8Array(n);
  const fire = new Uint8Array(n);
  const spikes = new Uint8Array(n);
  const water = new Uint8Array(n);
  const exit = new Uint8Array(n);
  const jellyGoals = new Uint8Array(n);
  const jellies: Jelly[] = [];
  const doors: DoorEntity[] = [];
  const plates: PlateEntity[] = [];
  const toggles: ToggleEntity[] = [];
  const magnets: MagnetEntity[] = [];
  const lasers: LaserEntity[] = [];
  let player = { x: 1, y: 1 };
  let nextJellyId = 1;

  const addJelly = (x: number, y: number, type: JellyType) => {
    jellies.push({ id: nextJellyId++, type, x, y });
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = level.map[y][x];
      const i = idx(w, x, y);
      switch (ch) {
        case '#': walls[i] = 1; break;
        case 'P': player = { x, y }; break;
        case 'G': exit[i] = 1; break;
        case 'g': jellyGoals[i] = 1; break;
        case 'W': water[i] = 1; break;
        case 'F': fire[i] = 1; break;
        case '^': spikes[i] = 1; break;
        case 'D': doors.push({ x, y, id: `auto${doors.length}`, open: false, latched: false }); break;
        case 'O': plates.push({ x, y, id: `auto${plates.length}`, }); break;
        case 'T': toggles.push({ x, y, id: `auto${toggles.length}`, on: false }); break;
        case 'X': magnets.push({ x, y, id: `auto${magnets.length}`, cells: 3, on: true }); break;
        case 'Z': lasers.push({ x, y, axis: 'v', cells: 1, period: 3.2, phase: 0, on: false }); break;
        case 'J': addJelly(x, y, 'normal'); break;
        case 'K': addJelly(x, y, 'sticky'); break;
        case 'B': addJelly(x, y, 'bouncy'); break;
        case 'H': addJelly(x, y, 'heavy'); break;
        case 'E': addJelly(x, y, 'elastic'); break;
        case 'L': addJelly(x, y, 'slippery'); break;
        case 'M': addJelly(x, y, 'magnetic'); break;
        default: break;
      }
    }
  }

  // Explicit object definitions (lasers, crushers, magnets, doors with ids).
  const crushers: CrusherEntity[] = [];
  for (const def of level.objects ?? []) {
    const { x, y, type } = def;
    if (!inBounds({ w, h }, x, y)) {
      throw new Error(`Level ${level.id}: object ${type} at (${x},${y}) is out of bounds`);
    }
    switch (type) {
      case 'door':
        doors.push({ x, y, id: def.id ?? 'auto', open: false, latched: false });
        break;
      case 'plate':
        plates.push({ x, y, id: def.id ?? 'auto' });
        break;
      case 'toggle':
        toggles.push({ x, y, id: def.id ?? 'auto', on: false });
        break;
      case 'laser': {
        const axis = def.axis ?? 'v';
        lasers.push({
          x, y, axis,
          cells: Math.max(1, def.cells ?? 3),
          period: Math.max(0.8, def.period ?? 3.2),
          phase: ((def.phase ?? 0) % 1 + 1) % 1,
          on: false,
        });
        break;
      }
      case 'magnet':
        magnets.push({ x, y, id: def.id ?? `auto${magnets.length}`, cells: Math.max(1, def.cells ?? 3), on: true });
        break;
      case 'crusher': {
        const axis = def.axis ?? 'v';
        const range = Math.max(1, def.cells ?? 2);
        const period = Math.max(1.6, def.period ?? 4.8);
        for (let k = 0; k <= range; k++) {
          const cx = axis === 'h' ? x + k : x;
          const cy = axis === 'v' ? y + k : y;
          if (!inBounds({ w, h }, cx, cy) || walls[idx(w, cx, cy)]) {
            throw new Error(`Level ${level.id}: crusher travel hits a wall at (${cx},${cy})`);
          }
        }
        crushers.push({
          x, y, axis, range, period,
          phase: Math.max(0, Math.min(1, def.phase ?? 0)),
          mode: def.mode ?? 'pingpong',
          t: 0,
          offset: Math.max(0, Math.min(range, Math.round((def.phase ?? 0) * range))),
        });
        break;
      }
    }
  }

  // Auto-pair the nth plain door with the nth plate/toggle in map order.
  const autoDoors = doors.filter((d) => d.id.startsWith('auto'));
  const autoPlates = plates.filter((p) => p.id.startsWith('auto'));
  const autoToggles = toggles.filter((t) => t.id.startsWith('auto'));
  let plateIdx = 0;
  let toggleIdx = 0;
  for (const door of autoDoors) {
    if (plateIdx < autoPlates.length) {
      door.id = `pair${plateIdx}`;
      autoPlates[plateIdx].id = `pair${plateIdx}`;
      plateIdx++;
    } else if (toggleIdx < autoToggles.length) {
      door.id = `pairT${toggleIdx}`;
      autoToggles[toggleIdx].id = `pairT${toggleIdx}`;
      toggleIdx++;
    }
  }
  // Unpaired plates/toggles still work: those without doors simply do nothing visually.
  for (const p of autoPlates) if (p.id.startsWith('auto')) p.id = `pair${plateIdx++}`;
  for (const t of autoToggles) if (t.id.startsWith('auto')) t.id = `pairT${toggleIdx++}`;

  return {
    w, h, walls, fire, spikes, water, exit, jellyGoals,
    jellies, doors, plates, toggles, magnets, lasers, crushers,
    player: { ...player },
    time: 0,
    moveCount: 0,
    over: null,
    destroyedJellies: 0,
    lastEvents: [],
  };
}
