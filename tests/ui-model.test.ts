import { describe, expect, it } from 'vitest';
import { LEVELS, WIN_LEGITIMACY } from '../src/data/levels';
import {
  HateCounter,
  callEarlyBonus,
  cardState,
  compactNumber,
  levelProgress,
  waveStatus,
} from '../src/ui/model';
import { formatDuration, formatNumber } from '../src/ui/records';
import { hotkeyOf } from '../src/game/input';

describe('card state derivation', () => {
  const base = { unlocked: true, affordable: true, level: 0, cost: 5 };
  it('locked beats everything, then selected, then unaffordable', () => {
    expect(cardState({ ...base, unlocked: false }, true)).toBe('locked');
    expect(cardState({ ...base, affordable: false }, true)).toBe('selected');
    expect(cardState({ ...base, affordable: false }, false)).toBe('unaffordable');
    expect(cardState(base, false)).toBe('ready');
  });
});

describe('Hate counter', () => {
  it('only counts up when fists arrive, spends immediately', () => {
    const c = new HateCounter(100);
    c.update(0.016, 112); // sim already has the Hate, fists still flying
    expect(c.display).toBe(100);
    c.arrive(12);
    for (let k = 0; k < 30; k++) c.update(0.016, 112);
    expect(c.display).toBe(112);
    c.spend(10);
    c.update(0.016, 102);
    expect(c.display).toBe(102);
  });

  it('never shows more than the sim and catches up after a lost fist', () => {
    const c = new HateCounter(50);
    c.arrive(30);
    c.update(0.016, 60);
    expect(c.target).toBe(60);
    for (let k = 0; k < 200; k++) c.update(0.016, 90);
    expect(c.display).toBe(90);
  });

  it('rolls up gradually and flags a bump', () => {
    const c = new HateCounter(0);
    c.arrive(500);
    expect(c.bump).toBeGreaterThan(0);
    c.update(0.016, 500);
    expect(c.display).toBeGreaterThan(0);
    expect(c.display).toBeLessThan(500);
  });
});

describe('HUD text helpers', () => {
  it('level progress spans thresholds', () => {
    expect(levelProgress(0, 0)).toBe(0);
    expect(levelProgress(LEVELS[1]!.legit, 1)).toBe(0);
    const mid = (LEVELS[4]!.legit + LEVELS[5]!.legit) / 2;
    expect(levelProgress(mid, 4)).toBeCloseTo(0.5);
    expect(levelProgress(WIN_LEGITIMACY, LEVELS.length - 1)).toBe(1);
  });

  it('wave status / call-early bonus / numbers', () => {
    expect(waveStatus('prep', 0, 0)).toBe('PREP');
    expect(waveStatus('wave', 7, 0)).toBe('WAVE 7');
    expect(waveStatus('breather', 7, 11.2)).toBe('NEXT 12s');
    expect(callEarlyBonus(15.9, 0.5)).toBe(7);
    expect(callEarlyBonus(-1, 0.5)).toBe(0);
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(12345)).toBe('12.3k');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('hotkeys: 1–0 then - for the helicopter', () => {
    expect(hotkeyOf('Digit1')).toBe('riot');
    expect(hotkeyOf('Digit0')).toBe('tank');
    expect(hotkeyOf('Minus')).toBe('heli');
    expect(hotkeyOf('KeyH')).toBe('heli');
    expect(hotkeyOf('Numpad3')).toBe('blockade');
    expect(hotkeyOf('KeyQ')).toBeNull();
  });
});
