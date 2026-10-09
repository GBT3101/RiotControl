/**
 * Audio settings (bus volumes + mute) persisted in localStorage. Every access is wrapped in
 * try/catch: private windows, blocked storage or quota errors never break the game.
 */
import type { AudioSettings, VolumeChannel } from './types';

export const SETTINGS_KEY = 'riot.audio.v1';

export const DEFAULT_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  master: 0.8,
  music: 0.6,
  sfx: 0.85,
  ui: 0.75,
  ambience: 0.7,
  muted: false,
});

export const VOLUME_CHANNELS: readonly VolumeChannel[] = ['master', 'music', 'sfx', 'ui', 'ambience'];

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's localStorage, or null when unavailable (Node, blocked, sandboxed). */
export function defaultStorage(): SettingsStorage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Coerce anything into valid settings (unknown keys dropped, numbers clamped to 0…1). */
export function sanitizeSettings(raw: unknown): AudioSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    master: clamp01(o.master, DEFAULT_SETTINGS.master),
    music: clamp01(o.music, DEFAULT_SETTINGS.music),
    sfx: clamp01(o.sfx, DEFAULT_SETTINGS.sfx),
    ui: clamp01(o.ui, DEFAULT_SETTINGS.ui),
    ambience: clamp01(o.ambience, DEFAULT_SETTINGS.ambience),
    muted: typeof o.muted === 'boolean' ? o.muted : DEFAULT_SETTINGS.muted,
  };
}

export function loadSettings(
  storage: SettingsStorage | null = defaultStorage(),
  key = SETTINGS_KEY,
): AudioSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const txt = storage.getItem(key);
    if (!txt) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(txt));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Returns false when the write failed (no storage, quota, security error). */
export function saveSettings(
  settings: AudioSettings,
  storage: SettingsStorage | null = defaultStorage(),
  key = SETTINGS_KEY,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(sanitizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

/** Perceptual volume curve: slider 0…1 → linear gain (≈ −40 dB at 0.1, 0 dB at 1). */
export function sliderToGain(v: number): number {
  const x = Math.min(1, Math.max(0, v));
  return x <= 0 ? 0 : x * x;
}
