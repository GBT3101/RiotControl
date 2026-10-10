import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_KEY,
  loadGameSettings,
  resolveQuality,
  sanitizeGameSettings,
  saveGameSettings,
} from '../src/ui/settings';
import {
  RECORDS_KEY,
  applyRun,
  loadRecords,
  saveRecords,
  sanitizeRecords,
} from '../src/ui/records';
import { memoryStorage } from '../src/ui/storage';

describe('game settings persistence', () => {
  it('round-trips through storage', () => {
    const st = memoryStorage();
    const s = { ...loadGameSettings(st), speed: 3 as const, shake: false, quality: 'low' as const };
    s.tutorialDone = { paris: true };
    expect(saveGameSettings(s, st)).toBe(true);
    const back = loadGameSettings(st);
    expect(back.speed).toBe(3);
    expect(back.shake).toBe(false);
    expect(back.quality).toBe('low');
    expect(back.tutorialDone).toEqual({ paris: true });
  });

  it('survives garbage, missing or throwing storage', () => {
    const st = memoryStorage();
    st.data.set(GAME_SETTINGS_KEY, '{not json');
    expect(loadGameSettings(st)).toEqual({ ...DEFAULT_GAME_SETTINGS, lastCity: undefined });
    expect(loadGameSettings(null).speed).toBe(1);
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(loadGameSettings(broken).quality).toBe('auto');
    expect(saveGameSettings(DEFAULT_GAME_SETTINGS, broken)).toBe(false);
    const s = sanitizeGameSettings({ speed: 9, quality: 'ultra', shake: 'yes', lastCity: 'atlantis' });
    expect(s.speed).toBe(1);
    expect(s.quality).toBe('auto');
    expect(s.shake).toBe(true);
    expect(s.lastCity).toBeUndefined();
  });

  it('resolves quality', () => {
    expect(resolveQuality('high', () => 'low')).toBe('desktop');
    expect(resolveQuality('low', () => 'desktop')).toBe('low');
    expect(resolveQuality('auto', () => 'mobile')).toBe('mobile');
  });
});

describe('best results', () => {
  it('folds runs into records', () => {
    let rec = sanitizeRecords(null);
    let r = applyRun(rec, {
      city: 'madrid',
      victory: false,
      legit: 320,
      wave: 9,
      time: 900,
      fallen: 400,
    });
    expect(r.newBest).toBe(true);
    rec = r.records;
    r = applyRun(rec, {
      city: 'madrid',
      victory: true,
      legit: 5000,
      wave: 30,
      time: 2400,
      fallen: 9000,
    });
    rec = r.records;
    expect(rec.madrid).toEqual({
      runs: 2,
      wins: 1,
      bestLegit: 5000,
      bestWave: 30,
      fastestWin: 2400,
      mostFallen: 9000,
    });
    r = applyRun(rec, {
      city: 'madrid',
      victory: true,
      legit: 5000,
      wave: 28,
      time: 3000,
      fallen: 10,
    });
    expect(r.newBest).toBe(false);
    expect(r.records.madrid.fastestWin).toBe(2400);
    expect(r.records.london.runs).toBe(0);
  });

  it('persists and sanitises', () => {
    const st = memoryStorage();
    const rec = applyRun(sanitizeRecords({}), {
      city: 'paris',
      victory: true,
      legit: 5000,
      wave: 25,
      time: 2000,
      fallen: 5000,
    }).records;
    expect(saveRecords(rec, st)).toBe(true);
    expect(loadRecords(st).paris.wins).toBe(1);
    st.data.set(RECORDS_KEY, JSON.stringify({ paris: { runs: -3, wins: 'x' } }));
    expect(loadRecords(st).paris).toMatchObject({ runs: 0, wins: 0 });
  });
});
