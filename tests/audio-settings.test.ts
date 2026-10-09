import { describe, expect, it } from 'vitest';
import { createAudio } from '../src/audio/engine';
import { crossfadeLoop } from '../src/audio/baker';
import { crowdLevel, grainRate } from '../src/audio/crowd';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  SETTINGS_KEY,
  sliderToGain,
  type SettingsStorage,
} from '../src/audio/settings';
import { CULL_GAIN, makeListener, spatialize } from '../src/audio/spatial';

class MemStorage implements SettingsStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}
const throwing: SettingsStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('audio settings persistence', () => {
  it('defaults without storage', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings({ ...DEFAULT_SETTINGS }, null)).toBe(false);
  });

  it('round-trips through storage', () => {
    const s = new MemStorage();
    const v = { ...DEFAULT_SETTINGS, music: 0.25, muted: true };
    expect(saveSettings(v, s)).toBe(true);
    expect(s.data.has(SETTINGS_KEY)).toBe(true);
    expect(loadSettings(s)).toEqual(v);
  });

  it('survives corrupt data and throwing storage', () => {
    const s = new MemStorage();
    s.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings({ ...DEFAULT_SETTINGS }, throwing)).toBe(false);
  });

  it('sanitises values', () => {
    const v = sanitizeSettings({ master: 3, music: -1, sfx: 'loud', ui: Number.NaN, muted: 'yes', extra: 1 });
    expect(v).toEqual({ ...DEFAULT_SETTINGS, master: 1, music: 0 });
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1)).toBe(1);
    expect(sliderToGain(0.5)).toBeCloseTo(0.25);
  });

  it('the engine persists volume and mute changes (works without AudioContext in Node)', async () => {
    const s = new MemStorage();
    const a = createAudio({ storage: s });
    expect(a.unlocked).toBe(false);
    expect(await a.unlock()).toBe(false); // no WebAudio in Node
    a.play('baton', { x: 1, y: 2 }); // no-op before unlock, must not throw
    a.loop('k', 'mgLoop');
    a.setMusicState({ phase: 'wave', level: 3, crowd: 100 });
    a.setVolume('music', 0.3);
    a.mute(true);
    const b = createAudio({ storage: s });
    expect(b.getSettings().music).toBeCloseTo(0.3);
    expect(b.muted).toBe(true);
    b.mute();
    expect(createAudio({ storage: s }).muted).toBe(false);
    a.dispose();
    b.dispose();
  });
});

describe('spatialisation', () => {
  const L = makeListener({ x: 1000, y: 500 }, 2, 1408); // 704 world px visible

  it('centre is full, edges fall off, far is culled', () => {
    const c = spatialize(1000, 500, L);
    expect(c.gain).toBeCloseTo(1);
    expect(c.pan).toBeCloseTo(0);
    expect(c.lowpass).toBe(0);
    const edge = spatialize(1000 + 352, 500, L);
    expect(edge.gain).toBeLessThan(0.7);
    expect(edge.gain).toBeGreaterThan(0.3);
    expect(edge.pan).toBeGreaterThan(0.5);
    const far = spatialize(1000 + 352 * 6, 500, L);
    expect(far.gain).toBeLessThan(CULL_GAIN);
    expect(far.lowpass).toBeGreaterThan(0);
    expect(spatialize(1000 - 200, 500, L).pan).toBeLessThan(0);
  });

  it('zooming in is louder than zooming out', () => {
    const near = makeListener({ x: 0, y: 0 }, 4, 1408);
    const wide = makeListener({ x: 0, y: 0 }, 1, 1408);
    expect(near.zoomGain).toBeGreaterThan(wide.zoomGain);
  });
});

describe('dsp helpers', () => {
  it('crossfadeLoop makes the seam continuous', () => {
    const L = 100;
    const F = 20;
    const data = new Float32Array(L + F);
    for (let i = 0; i < data.length; i++) data[i] = i / 10; // a ramp: big jump at the naive seam
    const loop = crossfadeLoop(data, L, F);
    expect(loop.length).toBe(L);
    // Wrapping from the last sample to the first is now a small step.
    expect(Math.abs(loop[L - 1]! - loop[0]!)).toBeLessThan(0.2);
  });

  it('crowd grain rate and level scale with size', () => {
    expect(grainRate(0, 1)).toBe(0);
    expect(grainRate(3000, 1)).toBeGreaterThan(grainRate(100, 1));
    expect(grainRate(300, 1)).toBeGreaterThan(grainRate(300, 0));
    expect(crowdLevel(0)).toBe(0);
    expect(crowdLevel(3000)).toBeCloseTo(1, 1);
    expect(crowdLevel(300)).toBeGreaterThan(crowdLevel(30));
  });
});
