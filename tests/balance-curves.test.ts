/**
 * M12 balance regression — pure data checks (fast). The long seeds × bots × cities sweep is a
 * script (`npm run playtest`), not a test; see docs/M12.md (incl. the playtest feedback round).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE, breatherSeconds, spawnSeconds, waveSize } from '../src/data/balance';
import { LEVELS, WIN_LEGITIMACY } from '../src/data/levels';
import { PROTESTERS, protesterDef } from '../src/data/protesters';
import { UNITS, UNIT_IDS } from '../src/data/units';

describe('owner-fixed numbers (PLAN §1.2, §1.3, §1.6) are untouched by tuning', () => {
  it('costs and Legitimacy-on-death', () => {
    // Legitimacy is owner-fixed. Costs were re-priced ×0.6 in the playtest feedback round
    // (kills now pay a third of a Hate; docs/M12.md) — PLAN §1.3 had 5/7/7/10/10/50/100/…
    const fixed: Record<string, [number, number]> = {
      riot: [3, 5],
      sniper: [4, 10],
      blockade: [4, 10],
      gas: [6, 15],
      mounted: [6, 15],
      armed: [30, 20],
      soldier: [60, 40],
      humvee: [180, 60],
      brigade: [300, 80],
      tank: [360, 100],
      heli: [600, 0],
    };
    for (const id of UNIT_IDS) {
      expect([UNITS[id].cost, UNITS[id].legit], id).toEqual(fixed[id]);
    }
  });

  it('economy, thresholds and unlocks', () => {
    expect(BALANCE.startHate).toBe(100);
    expect(BALANCE.startLegit).toBe(0);
    // Playtest round (owner): +1 Hate per own unit death, 1 Hate per 3 ordinary protesters.
    expect(BALANCE.hatePerUnitDeath).toBe(1);
    expect(BALANCE.protestersPerHate).toBe(3);
    expect(WIN_LEGITIMACY).toBe(5000);
    expect(LEVELS.map((l) => l.legit)).toEqual([
      0, 10, 30, 50, 100, 200, 300, 500, 800, 1200, 2000,
    ]);
    for (const p of PROTESTERS) expect(p.hate, p.id).toBe(p.id === 'breta' ? 100 : 1);
    expect(protesterDef('breta').bounty).toBe(true);
    // Playtest round (owner): protesters walk 1.5× the M12 speed.
    expect(BALANCE.walkSpeed).toBeCloseTo(1.15 * 1.5);
    expect(LEVELS.map((l) => l.protesters.join('+'))).toEqual([
      'student+woke',
      '',
      'mob',
      '',
      'veryViolent',
      '',
      'crazy',
      '',
      'cultist',
      '',
      'prophet',
    ]);
    expect(BALANCE.waves.breta.chance).toBe(0.01);
  });
});

describe('wave curve (PLAN §1.5)', () => {
  it('starts at dozens and grows monotonically to thousands', () => {
    expect(waveSize(1, 0, 0)).toBe(30);
    for (let k = 1; k < 40; k++) {
      expect(waveSize(k + 1, 4, k * 80)).toBeGreaterThanOrEqual(waveSize(k, 4, (k - 1) * 80));
    }
    // Typical competent run (playtest round): wave ~10 at ~11 min, ~20 at ~23 min, ~30 at
    // ~36 min, ~40 (the last waves of a 45-min win) at ~48 min.
    const w10 = waveSize(10, 3, 11 * 60);
    const w20 = waveSize(20, 7, 23 * 60);
    const w30 = waveSize(30, 10, 36 * 60);
    const w40 = waveSize(40, 10, 48 * 60);
    expect(w10).toBeGreaterThan(50);
    expect(w10).toBeLessThan(150);
    expect(w20).toBeGreaterThan(150);
    expect(w20).toBeLessThan(400);
    expect(w30).toBeGreaterThan(400);
    expect(w30).toBeLessThan(1000);
    expect(w40).toBeGreaterThanOrEqual(1500);
    expect(waveSize(80, 10, 3600)).toBe(BALANCE.waves.maxSize);
    expect(BALANCE.waves.maxSize).toBeLessThanOrEqual(BALANCE.concurrency.desktop + 500);
  });

  it('waves stream in over a size-dependent window; breathers 16–24 s', () => {
    expect(spawnSeconds(30)).toBeGreaterThan(10);
    expect(spawnSeconds(30)).toBeLessThan(25);
    expect(spawnSeconds(3000)).toBeLessThanOrEqual(BALANCE.waves.spawnWindow.max);
    expect(spawnSeconds(3000)).toBeGreaterThan(spawnSeconds(300));
    // Big waves must be emittable within their window by the door emitters.
    const rate = (BALANCE.waves.maxEmitters / BALANCE.waves.emitInterval) * 0.8;
    expect(BALANCE.waves.maxSize / spawnSeconds(BALANCE.waves.maxSize)).toBeLessThan(rate);
    for (let k = 1; k < 60; k++) {
      expect(breatherSeconds(k)).toBeGreaterThanOrEqual(16);
      expect(breatherSeconds(k)).toBeLessThanOrEqual(24);
    }
  });

  it('newly unlocked protester types ramp in rather than flood', () => {
    const wv = BALANCE.waves;
    expect(wv.introStart).toBeGreaterThan(0);
    expect(wv.introStart).toBeLessThan(0.6);
    expect(wv.introStep).toBeGreaterThan(0);
    // Full weight within a handful of waves.
    expect(Math.ceil((1 - wv.introStart) / wv.introStep)).toBeLessThanOrEqual(6);
    expect(protesterDef('prophet').weight).toBeLessThan(protesterDef('student').weight);
  });
});
