/**
 * Global game store (zustand) — screens, settings, progress, statistics.
 * Persistence is delegated to src/data/save.ts and applied on every mutation.
 */
import { create } from 'zustand';
import { loadSave, persistSave, defaultSave, saveAvailable as storageAvailable } from '../data/save';
import { getNextLevel, getLevelById, totalLevelCount, LEVELS } from '../game/levels';
import type { GameSettings, LevelData, LevelProgress, SaveData } from '../game/engine/types';

export type Screen =
  | 'menu'
  | 'worlds'
  | 'levels'
  | 'game'
  | 'settings'
  | 'howto'
  | 'credits'
  | 'stats'
  | 'mylevels'
  | 'editor';

interface GameStore extends SaveData {
  screen: Screen;
  /** world shown on level select. */
  selectedWorld: number;
  /** level shown in level select / editor / gameplay. */
  activeLevelId: string;
  /** modal overlays: 'pause' | 'complete' | 'dead' | 'confirm' | null */
  modal: 'pause' | 'complete' | 'dead' | 'confirm' | null;
  completion: { moves: number; timeMs: number; stars: number; improved: boolean } | null;
  storageOk: boolean;
  settingsOpenFrom: Screen | null;

  setScreen: (s: Screen) => void;
  navigate: (s: Screen) => void;
  back: () => void;
  setModal: (m: GameStore['modal']) => void;
  selectWorld: (w: number) => void;
  selectLevel: (id: string) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  resetProgress: () => void;
  recordCompletion: (levelId: string, moves: number, timeMs: number, destroyed: number) => void;
  addCustomLevel: (level: LevelData) => void;
  removeCustomLevel: (id: string) => void;
  clearAllCustomLevels: () => void;
  getContinueLevel: () => LevelData | undefined;
}

const persisted = loadSave();

function persist(s: Pick<GameStore, 'settings' | 'statistics' | 'progress' | 'worlds' | 'customLevels' | 'lastLevelId' | 'unlockedWorlds'>) {
  persistSave({
    version: 1,
    progress: s.progress,
    worlds: s.worlds,
    settings: s.settings,
    statistics: s.statistics,
    customLevels: s.customLevels,
    lastLevelId: s.lastLevelId,
    unlockedWorlds: s.unlockedWorlds,
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...persisted,
  screen: 'menu',
  selectedWorld: 1,
  activeLevelId: persisted.lastLevelId ?? 'w1-01',
  modal: null,
  completion: null,
  storageOk: storageAvailable(),
  settingsOpenFrom: null,

  setScreen: (screen) => set({ screen }),
  navigate: (screen) => {
    set({ screen, modal: null });
    if (screen !== 'game') set({ modal: null });
  },
  back: () => set({ screen: 'menu', modal: null }),
  setModal: (modal) => set({ modal }),

  selectWorld: (w) => set({ selectedWorld: w, screen: 'levels' }),
  selectLevel: (id) => set({ activeLevelId: id, screen: 'game', modal: null }),

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    persist(get());
  },

  resetProgress: () => {
    const fresh = defaultSave();
    set({
      progress: fresh.progress,
      worlds: fresh.worlds,
      statistics: fresh.statistics,
      lastLevelId: null,
      unlockedWorlds: [1],
    });
    persist(get());
  },

  recordCompletion: (levelId, moves, timeMs, destroyed) => {
    const s = get();
    const level = getLevelById(levelId);
    if (!level) return;
    const prev = s.progress[levelId];
    const stars: 1 | 2 | 3 = moves <= level.par ? 3 : moves <= level.par * 2 ? 2 : 1;
    const improvedStars = !prev || stars > prev.stars;
    const improvedMoves = !prev?.bestMoves || moves < prev.bestMoves;
    const improvedTime = !prev?.bestTime || timeMs < prev.bestTime;
    const newProgress: Record<string, LevelProgress> = {
      ...s.progress,
      [levelId]: {
        completed: true,
        stars: (prev ? Math.max(prev.stars, stars) : stars) as 1 | 2 | 3,
        bestMoves: prev?.bestMoves ? Math.min(prev.bestMoves, moves) : moves,
        bestTime: prev?.bestTime ? Math.min(prev.bestTime, timeMs) : timeMs,
      },
    };

    const worldComplete = (w: number) =>
      LEVELS.filter((l) => l.world === w).every((l) => newProgress[l.id]?.completed);

    const worlds = { ...s.worlds };
    const unlocked = new Set(s.unlockedWorlds);
    if (level.world + 1 <= 6 && worldComplete(level.world)) {
      worlds[level.world] = { completed: true };
      unlocked.add(level.world + 1);
    }

    const next = getNextLevel(level);
    const nextUnlocked = next
      ? newProgress[next.id] === undefined || !newProgress[next.id].completed
      : false;
    const lastLevelId = next && nextUnlocked ? next.id : s.lastLevelId ?? levelId;

    set({
      progress: newProgress,
      worlds,
      unlockedWorlds: [...unlocked].sort((a, b) => a - b),
      lastLevelId,
      completion: {
        moves,
        timeMs,
        stars,
        improved: improvedStars || improvedMoves || improvedTime,
      },
      statistics: {
        ...s.statistics,
        levelsCompleted: Object.values(newProgress).filter((p) => p.completed).length,
        totalMoves: s.statistics.totalMoves + moves,
        starsEarned: Object.values(newProgress).reduce((a, p) => a + p.stars, 0),
        totalPlaySeconds: Math.round(s.statistics.totalPlaySeconds + timeMs / 1000),
        jellyDestroyed: s.statistics.jellyDestroyed + destroyed,
        gamesStarted: s.statistics.gamesStarted + 1,
      },
    });
    persist(get());
  },

  addCustomLevel: (level) => {
    const customLevels = { ...get().customLevels, [level.id]: level };
    set({ customLevels });
    persist(get());
  },
  removeCustomLevel: (id) => {
    const customLevels = { ...get().customLevels };
    delete customLevels[id];
    set({ customLevels });
    persist(get());
  },
  clearAllCustomLevels: () => {
    set({ customLevels: {} });
    persist(get());
  },

  getContinueLevel: () => {
    const s = get();
    const last = s.lastLevelId ? getLevelById(s.lastLevelId) : undefined;
    if (last && (!s.progress[last.id]?.completed || s.progress[last.id].completed === false)) return last;
    // first incomplete level anywhere
    return LEVELS.find((l) => !s.progress[l.id]?.completed) ?? LEVELS[0];
  },
}));

export function firstUnlockedLevel(world: number): LevelData | undefined {
  const s = useGameStore.getState();
  const list = LEVELS.filter((l) => l.world === world);
  return list.find((l) => !s.progress[l.id]?.completed) ?? list[0];
}

export function worldProgressCount(world: number): { done: number; total: number; completed: boolean } {
  const s = useGameStore.getState();
  const list = LEVELS.filter((l) => l.world === world);
  const done = list.filter((l) => s.progress[l.id]?.completed).length;
  return { done, total: list.length, completed: done === list.length };
}

export function totalStats(): { completed: number; total: number; stars: number; maxStars: number } {
  const s = useGameStore.getState();
  const total = totalLevelCount();
  const completed = Object.values(s.progress).filter((p) => p.completed).length;
  const stars = Object.values(s.progress).reduce((a, p) => a + p.stars, 0);
  return { completed, total, stars, maxStars: total * 3 };
}
