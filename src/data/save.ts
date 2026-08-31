/**
 * Versioned localStorage persistence with graceful corruption handling.
 * The data layer is isolated here so a server backend can replace it later.
 */
import type { GameSettings, LevelData, SaveData } from '../game/engine/types';
import { DEFAULT_SETTINGS } from '../game/engine/types';

const SAVE_KEY = 'stickyverse.save.v1';
export const SAVE_VERSION = 1;

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    progress: {},
    worlds: {},
    settings: { ...DEFAULT_SETTINGS },
    statistics: {
      levelsCompleted: 0,
      totalMoves: 0,
      starsEarned: 0,
      totalPlaySeconds: 0,
      gamesStarted: 0,
      jellyDestroyed: 0,
    },
    customLevels: {},
    lastLevelId: null,
    unlockedWorlds: [1],
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Merge raw parsed data over defaults; never throws. */
export function sanitizeSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isRecord(raw)) return base;
  const out = base;
  if (typeof raw.version === 'number') out.version = raw.version;
  if (isRecord(raw.progress)) {
    for (const [k, v] of Object.entries(raw.progress)) {
      if (isRecord(v)) {
        out.progress[k] = {
          completed: v.completed === true,
          stars: (['0', '1', '2', '3'].includes(String(v.stars)) ? Number(v.stars) : 0) as 0 | 1 | 2 | 3,
          bestMoves: typeof v.bestMoves === 'number' ? v.bestMoves : null,
          bestTime: typeof v.bestTime === 'number' ? v.bestTime : null,
        };
      }
    }
  }
  if (isRecord(raw.worlds)) {
    for (const [k, v] of Object.entries(raw.worlds)) {
      if (isRecord(v)) out.worlds[Number(k)] = { completed: v.completed === true };
    }
  }
  if (isRecord(raw.settings)) {
    const s = raw.settings;
    if (typeof s.masterVolume === 'number') out.settings.masterVolume = clamp01(s.masterVolume);
    if (typeof s.musicVolume === 'number') out.settings.musicVolume = clamp01(s.musicVolume);
    if (typeof s.sfxVolume === 'number') out.settings.sfxVolume = clamp01(s.sfxVolume);
    if (typeof s.showMoveCounter === 'boolean') out.settings.showMoveCounter = s.showMoveCounter;
    if (typeof s.confirmRestart === 'boolean') out.settings.confirmRestart = s.confirmRestart;
    if (typeof s.screenShake === 'boolean') out.settings.screenShake = s.screenShake;
    if (typeof s.reducedMotion === 'boolean') out.settings.reducedMotion = s.reducedMotion;
    if (typeof s.showTutorials === 'boolean') out.settings.showTutorials = s.showTutorials;
  }
  if (isRecord(raw.statistics)) {
    const st = raw.statistics;
    for (const k of ['levelsCompleted', 'totalMoves', 'starsEarned', 'totalPlaySeconds', 'gamesStarted', 'jellyDestroyed'] as const) {
      if (typeof st[k] === 'number' && Number.isFinite(st[k])) out.statistics[k] = Math.max(0, Math.floor(st[k] as number));
    }
  }
  if (isRecord(raw.customLevels)) {
    for (const [k, v] of Object.entries(raw.customLevels)) {
      if (isRecord(v) && typeof v.id === 'string' && Array.isArray(v.map)) {
        out.customLevels[k] = v as unknown as LevelData;
      }
    }
  }
  if (typeof raw.lastLevelId === 'string') out.lastLevelId = raw.lastLevelId;
  if (Array.isArray(raw.unlockedWorlds)) {
    out.unlockedWorlds = raw.unlockedWorlds.filter((n): n is number => typeof n === 'number');
    if (out.unlockedWorlds.length === 0) out.unlockedWorlds = [1];
  }
  return out;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return sanitizeSave(JSON.parse(raw));
  } catch {
    // localStorage unavailable (private mode) or corrupted JSON → defaults.
    return defaultSave();
  }
}

export function persistSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): SaveData {
  const fresh = defaultSave();
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
  return fresh;
}

export function saveAvailable(): boolean {
  try {
    const k = '__stickyverse_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export type { GameSettings };
