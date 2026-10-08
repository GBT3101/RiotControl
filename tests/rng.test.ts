import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/core/rng';

describe('Rng', () => {
  it('is deterministic per seed (numbers and strings)', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.nextU32()).toBe(b.nextU32());
    expect(new Rng('madrid').next()).toBe(new Rng('madrid').next());
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('next() is in [0,1) and roughly uniform', () => {
    const r = new Rng(7);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]!++;
    }
    for (const b of buckets) expect(b).toBeGreaterThan(1800);
  });

  it('int() is inclusive and covers the range', () => {
    const r = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-2, 2);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([-1, -2, 0, 1, 2].sort());
  });

  it('range, chance, pick, shuffle behave', () => {
    const r = new Rng(9);
    for (let i = 0; i < 100; i++) {
      const v = r.range(5, 6);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(6);
    }
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
    expect(() => r.pick([])).toThrow();
    const arr = [1, 2, 3, 4, 5, 6];
    expect(r.shuffle([...arr]).sort()).toEqual(arr);
  });

  it('weighted() respects weights', () => {
    const r = new Rng(11);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10000; i++) counts[r.weighted(['a', 'b', 'c'] as const, [1, 3, 0])]++;
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(2.5);
    expect(counts.b / counts.a).toBeLessThan(3.5);
    const fn = r.weighted([1, 2, 3], (x) => (x === 2 ? 1 : 0));
    expect(fn).toBe(2);
  });

  it('fork() gives stable, independent streams', () => {
    const a = new Rng(5).fork('crowd');
    const b = new Rng(5).fork('crowd');
    const c = new Rng(5).fork('fx');
    expect(a.nextU32()).toBe(b.nextU32());
    expect(new Rng(5).fork('crowd').nextU32()).not.toBe(c.nextU32());
  });

  it('state can be saved and restored', () => {
    const r = new Rng(99);
    r.next();
    const s = r.getState();
    const x = r.next();
    r.setState(s);
    expect(r.next()).toBe(x);
  });

  it('hashString is stable', () => {
    expect(hashString('riot')).toBe(hashString('riot'));
    expect(hashString('riot')).not.toBe(hashString('Riot'));
  });
});
