/**
 * Game settings (non-audio) persisted in localStorage (`riot.settings.v1`). Audio volumes and
 * mute live in the M11 engine's own store (`riot.audio.v1`) — the settings screen edits both.
 *
 *   const s = loadGameSettings();        // always valid (defaults on any problem)
 *   saveGameSettings({ ...s, shake: false });
 *   resolveQuality(s.quality)            // 'auto' → detectQuality()
 */
import type { QualityTier } from '../data/balance';
import type { CityId } from '../maps/contract';
import { browserStorage, readJson, writeJson, type KeyValueStorage } from './storage';

export const GAME_SETTINGS_KEY = 'riot.settings.v1';

export type QualitySetting = 'auto' | 'high' | 'low';

export interface GameSettings {
  /** Game speed at the start of a run (1×/2×/3×). */
  speed: 1 | 2 | 3;
  /** Render quality tier (applies to the next run). */
  quality: QualitySetting;
  /** Screen shake on (off = reduced motion). */
  shake: boolean;
  /** Show the tutorial again on the next run (M10 reads and clears it). */
  replayTutorial: boolean;
  /** Cities whose first-run tutorial was completed (M10). */
  tutorialDone: Partial<Record<CityId, boolean>>;
  /** Minimap visible (phones toggle it from the HUD). */
  minimap: boolean;
  /** Portrait phones: minimap shown (off by default — the screen is narrow). */
  minimapPortrait: boolean;
  /** City of the last run (title backdrop). */
  lastCity?: CityId;
  /** UI language (EN only for now). */
  language: 'en';
}

export const DEFAULT_GAME_SETTINGS: Readonly<GameSettings> = Object.freeze({
  speed: 1,
  quality: 'auto',
  shake: true,
  replayTutorial: false,
  tutorialDone: {},
  minimap: true,
  minimapPortrait: false,
  language: 'en',
});

/** Coerce anything into valid settings (unknown keys dropped). */
export function sanitizeGameSettings(raw: unknown): GameSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_GAME_SETTINGS;
  const speed = o.speed === 1 || o.speed === 2 || o.speed === 3 ? o.speed : d.speed;
  const quality =
    o.quality === 'auto' || o.quality === 'high' || o.quality === 'low' ? o.quality : d.quality;
  const done: Partial<Record<CityId, boolean>> = {};
  if (o.tutorialDone && typeof o.tutorialDone === 'object') {
    for (const c of ['madrid', 'london', 'paris'] as const) {
      if ((o.tutorialDone as Record<string, unknown>)[c] === true) done[c] = true;
    }
  }
  return {
    speed,
    quality,
    shake: typeof o.shake === 'boolean' ? o.shake : d.shake,
    replayTutorial: typeof o.replayTutorial === 'boolean' ? o.replayTutorial : d.replayTutorial,
    tutorialDone: done,
    minimap: typeof o.minimap === 'boolean' ? o.minimap : d.minimap,
    minimapPortrait: typeof o.minimapPortrait === 'boolean' ? o.minimapPortrait : false,
    lastCity:
      o.lastCity === 'madrid' || o.lastCity === 'london' || o.lastCity === 'paris'
        ? o.lastCity
        : undefined,
    language: 'en',
  };
}

export function loadGameSettings(storage: KeyValueStorage | null = browserStorage()): GameSettings {
  return sanitizeGameSettings(readJson(storage, GAME_SETTINGS_KEY));
}

export function saveGameSettings(
  s: GameSettings,
  storage: KeyValueStorage | null = browserStorage(),
): boolean {
  return writeJson(storage, GAME_SETTINGS_KEY, sanitizeGameSettings(s));
}

/** Quality setting → sim/view tier ('auto' asks `detect`). */
export function resolveQuality(q: QualitySetting, detect: () => QualityTier): QualityTier {
  return q === 'high' ? 'desktop' : q === 'low' ? 'low' : detect();
}
