/**
 * STICKYVERSE — core game types.
 * The level format is data-driven: ASCII map + optional object definitions.
 * Levels are never hardcoded into gameplay logic.
 */

export type JellyType =
  | 'normal'
  | 'sticky'
  | 'bouncy'
  | 'heavy'
  | 'elastic'
  | 'slippery'
  | 'magnetic';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Vec2 {
  x: number;
  y: number;
}

/** Static object definitions that need parameters (door ids, laser axes, ...). */
export interface LevelObjectDef {
  type: 'door' | 'plate' | 'toggle' | 'laser' | 'crusher' | 'magnet';
  x: number;
  y: number;
  /** Linkage id shared by a door and its plate(s)/toggle(s)/magnet(s). */
  id?: string;
  /** laser / crusher direction. */
  axis?: 'h' | 'v';
  /** laser beam length in cells (default 1) or crusher travel range. */
  cells?: number;
  /** cycle length in seconds (default 3.2). */
  period?: number;
  /** starting phase 0..1 (default 0). */
  phase?: number;
  /** crusher oscillation 'pingpong' (default) or 'loop'. */
  mode?: 'pingpong' | 'loop';
}

export interface LevelData {
  id: string;
  world: number;
  /** 1-based index inside the world. */
  index: number;
  name: string;
  /** ASCII map. Character legend (see README). */
  map: string[];
  objects?: LevelObjectDef[];
  /** Short tutorial / mechanic tip shown at level start. */
  tip?: string;
  /** 3-star move threshold. */
  par: number;
  mechanics: string[];
}

export interface LevelIndex {
  id: string;
  world: number;
  index: number;
  name: string;
  par: number;
  mechanics: string[];
}

/** World metadata — worlds are derived from level data, so adding levels is trivial. */
export interface WorldMeta {
  id: number;
  name: string;
  tagline: string;
  accent: string;
  icon: string;
  intro: string;
}

/** Jelly property sheet — central place for each jelly's behaviour. */
export interface JellyProperties {
  type: JellyType;
  label: string;
  color: string;
  /** 0..1 stickiness — sticky = 1. */
  stickiness: number;
  /** 0..1 rigidity — heavy = 1. */
  rigidity: number;
  elasticity: number;
  mass: number;
  friction: number;
  /** how far it follows the player when pulled (sticky/elastic). */
  follow: boolean;
  /** slides until it hits something. */
  slides: boolean;
  /** hops two cells when pushed. */
  hops: boolean;
  /** snaps back when stretched too far (elastic). */
  snapsBack: boolean;
  /** immune to fire (heavy). */
  fireproof: boolean;
  /** locked while on an active magnet. */
  magnetic: boolean;
  /** triggers pressure plates? (only heavy). */
  heavy: boolean;
}

export const JELLY_TYPES: Record<JellyType, JellyProperties> = {
  normal: {
    type: 'normal',
    label: 'Jelly',
    color: '#7fd4ff',
    stickiness: 0,
    rigidity: 0.4,
    elasticity: 0.5,
    mass: 1,
    friction: 1,
    follow: false,
    slides: false,
    hops: false,
    snapsBack: false,
    fireproof: false,
    magnetic: false,
    heavy: false,
  },
  sticky: {
    type: 'sticky',
    label: 'Sticky Jelly',
    color: '#ff7b9c',
    stickiness: 1,
    rigidity: 0.3,
    elasticity: 0.6,
    mass: 1,
    friction: 1,
    follow: true,
    slides: false,
    hops: false,
    snapsBack: false,
    fireproof: false,
    magnetic: false,
    heavy: false,
  },
  bouncy: {
    type: 'bouncy',
    label: 'Bouncy Jelly',
    color: '#ffd166',
    stickiness: 0,
    rigidity: 0.1,
    elasticity: 1,
    mass: 0.8,
    friction: 0.6,
    follow: false,
    slides: false,
    hops: true,
    snapsBack: false,
    fireproof: false,
    magnetic: false,
    heavy: false,
  },
  heavy: {
    type: 'heavy',
    label: 'Heavy Jelly',
    color: '#b9a7ff',
    stickiness: 0,
    rigidity: 1,
    elasticity: 0.1,
    mass: 4,
    friction: 1,
    follow: false,
    slides: false,
    hops: false,
    snapsBack: false,
    fireproof: true,
    magnetic: false,
    heavy: true,
  },
  elastic: {
    type: 'elastic',
    label: 'Elastic Jelly',
    color: '#7dffb2',
    stickiness: 0,
    rigidity: 0.1,
    elasticity: 1,
    mass: 0.7,
    friction: 0.9,
    follow: true,
    slides: false,
    hops: false,
    snapsBack: true,
    fireproof: false,
    magnetic: false,
    heavy: false,
  },
  slippery: {
    type: 'slippery',
    label: 'Slippery Jelly',
    color: '#b0e7ff',
    stickiness: 0,
    rigidity: 0.2,
    elasticity: 0.8,
    mass: 0.8,
    friction: 0.05,
    follow: false,
    slides: true,
    hops: false,
    snapsBack: false,
    fireproof: false,
    magnetic: false,
    heavy: false,
  },
  magnetic: {
    type: 'magnetic',
    label: 'Magnetic Jelly',
    color: '#ff9de2',
    stickiness: 0,
    rigidity: 0.3,
    elasticity: 0.6,
    mass: 1.2,
    friction: 0.8,
    follow: false,
    slides: false,
    hops: false,
    snapsBack: false,
    fireproof: false,
    magnetic: true,
    heavy: false,
  },
};

export const JELLY_CHARS: Record<string, JellyType> = {
  J: 'normal',
  K: 'sticky',
  B: 'bouncy',
  H: 'heavy',
  E: 'elastic',
  L: 'slippery',
  M: 'magnetic',
};

export interface Jelly {
  id: number;
  type: JellyType;
  x: number;
  y: number;
}

export interface DoorEntity {
  x: number;
  y: number;
  id: string;
  open: boolean;
  /** true when opened by a toggle (latched). */
  latched: boolean;
}

export interface PlateEntity {
  x: number;
  y: number;
  id: string;
}

export interface ToggleEntity {
  x: number;
  y: number;
  id: string;
  on: boolean;
}

export interface MagnetEntity {
  x: number;
  y: number;
  id: string;
  /** field reach in cells along the same row/column. */
  cells: number;
  on: boolean;
}

export interface LaserEntity {
  x: number;
  y: number;
  axis: 'h' | 'v';
  cells: number;
  period: number;
  phase: number;
  on: boolean;
}

export interface CrusherEntity {
  x: number;
  y: number;
  axis: 'h' | 'v';
  range: number;
  period: number;
  phase: number;
  mode: 'pingpong' | 'loop';
  t: number;
  /** current offset 0..range */
  offset: number;
}

/** The full dynamic world state used by the pure simulator. */
export interface WorldState {
  w: number;
  h: number;
  walls: Uint8Array;
  fire: Uint8Array;
  spikes: Uint8Array;
  water: Uint8Array;
  exit: Uint8Array;
  jellyGoals: Uint8Array;
  jellies: Jelly[];
  doors: DoorEntity[];
  plates: PlateEntity[];
  toggles: ToggleEntity[];
  magnets: MagnetEntity[];
  lasers: LaserEntity[];
  crushers: CrusherEntity[];
  player: Vec2;
  /** accumulated in-game seconds (undo restores it → deterministic hazards). */
  time: number;
  moveCount: number;
  over: null | 'complete' | 'dead';
  destroyedJellies: number;
  lastEvents: string[];
}

export type DeathReason = 'fire' | 'spikes' | 'laser' | 'crusher';

export interface MoveOutcome {
  moved: boolean;
  counted: boolean;
  playerMovedTo: Vec2;
  jumps: number;
  dead?: DeathReason;
  destroyed: number;
  completed: boolean;
  events: string[];
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  showMoveCounter: boolean;
  confirmRestart: boolean;
  screenShake: boolean;
  reducedMotion: boolean;
  showTutorials: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  showMoveCounter: true,
  confirmRestart: false,
  screenShake: true,
  reducedMotion: false,
  showTutorials: true,
};

export interface LevelProgress {
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  bestMoves: number | null;
  bestTime: number | null;
}

export interface WorldProgress {
  completed: boolean;
}

export interface SaveData {
  version: number;
  progress: Record<string, LevelProgress>;
  worlds: Record<number, WorldProgress>;
  settings: GameSettings;
  statistics: {
    levelsCompleted: number;
    totalMoves: number;
    starsEarned: number;
    totalPlaySeconds: number;
    gamesStarted: number;
    jellyDestroyed: number;
  };
  customLevels: Record<string, LevelData>;
  lastLevelId: string | null;
  unlockedWorlds: number[];
}
