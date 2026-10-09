import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Crowd } from '../src/sim/crowd';
import { Nav } from '../src/sim/nav';
import { SpatialHash } from '../src/sim/spatialHash';
import { buildTestCity } from '../src/sim/testCity';
import { AVENUE, mapFromAscii } from './sim-fixtures';

describe('flow field', () => {
  it('distances: 0 on the steps, grow away from them, Infinity when unreachable', () => {
    const map = mapFromAscii(['.....~~..', '.....~~..', '.........', '_SSS_____', 'XCCCXXXXX']);
    const nav = new Nav(map);
    const d = (i: number, j: number) => nav.dist[j * map.w + i]!;
    expect(d(1, 3)).toBe(0);
    expect(d(3, 3)).toBe(0);
    expect(d(1, 2)).toBeCloseTo((1 + 1.3) / 2, 5); // mean of asphalt and steps cost
    expect(d(1, 0)).toBeGreaterThan(d(1, 1));
    expect(d(5, 0)).toBe(Infinity); // water
    expect(d(1, 4)).toBe(Infinity); // capitol lot
    // Far side of the water reachable around it.
    expect(d(8, 0)).toBeLessThan(Infinity);
  });

  it('flow vectors point to a strictly closer neighbour everywhere reachable', () => {
    const map = buildTestCity();
    const nav = new Nav(map);
    let checked = 0;
    for (let t = 0; t < nav.size; t++) {
      if (!nav.walk[t] || nav.dist[t] === 0 || nav.dist[t] === Infinity) continue;
      const i = t % map.w;
      const j = Math.floor(t / map.w);
      const fx = nav.flowX[t]!;
      const fy = nav.flowY[t]!;
      expect(Math.hypot(fx, fy)).toBeCloseTo(1, 4);
      const ni = i + Math.round(fx * Math.SQRT2 * 0.75);
      const nj = j + Math.round(fy * Math.SQRT2 * 0.75);
      expect(nav.dist[nj * map.w + ni]!).toBeLessThan(nav.dist[t]!);
      checked++;
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it('every spawn door of the test city reaches the Capitol', () => {
    const map = buildTestCity();
    const nav = new Nav(map);
    let doors = 0;
    for (const d of map.spawns) {
      expect(d.buildingIds.length).toBeGreaterThan(0);
      for (const b of d.buildingIds) {
        for (const door of map.buildings[b]!.doors) {
          doors++;
          expect(nav.dist[door.j * map.w + door.i]).toBeLessThan(Infinity);
        }
      }
    }
    expect(doors).toBeGreaterThan(20);
  });

  it('blockade tiles raise path cost (crowds reroute) and are movement-solid', () => {
    const map = mapFromAscii([
      '.........',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.........',
      'XXX_S_XXX',
      'XXXXCXXXX',
    ]);
    const nav = new Nav(map);
    const start = 4; // tile (4, 0) top centre: two symmetric routes
    const before = nav.dist[start]!;
    // Block the left column road.
    nav.setBlockade(2 * map.w + 0, 7);
    nav.setBlockade(1 * map.w + 0, 7);
    nav.recompute();
    expect(nav.solid[2 * map.w]).toBe(1);
    expect(nav.dist[start]).toBeCloseTo(before, 5); // right route unchanged
    expect(nav.dist[0]!).toBeGreaterThan(before); // (0,0) now detours or pays the blockade
    // Throttled recompute: dirty → recompute once, then wait.
    nav.setBlockade(1 * map.w + 0, -1);
    expect(nav.update(1 / 30)).toBe(true);
    nav.setBlockade(2 * map.w + 0, -1);
    expect(nav.update(1 / 30)).toBe(false);
  });

  it('bilinear sample blends neighbouring flow vectors', () => {
    const map = mapFromAscii(AVENUE);
    const nav = new Nav(map);
    nav.sample(7.5, 6.5);
    expect(nav.sy).toBeGreaterThan(0.9); // straight down the avenue toward the steps (+j)
    expect(Math.abs(nav.sx)).toBeLessThan(0.2);
  });

  it('road-only A*: avoids non-road tiles and corners, null when unreachable', () => {
    const map = mapFromAscii([
      '.....""..',
      '.XXX.""..',
      '.X...XXX.',
      '.X.X.....',
      '.....XXXX',
      'XXXSSXCCX',
    ]);
    const nav = new Nav(map);
    const path = nav.findPath(0, 0, 8, 3)!;
    expect(path).not.toBeNull();
    const last = path[path.length - 1]!;
    expect(last).toBe(3 * map.w + 8);
    for (const t of path) expect(nav.driveable(t)).toBe(true);
    // Grass is walkable but not a road: no path to (5, 0).
    expect(nav.findPath(0, 0, 5, 0)).toBeNull();
    // Path steps are 8-connected.
    let prev = 0;
    for (const t of path) {
      const dx = Math.abs((t % map.w) - (prev % map.w));
      const dy = Math.abs(Math.floor(t / map.w) - Math.floor(prev / map.w));
      expect(Math.max(dx, dy)).toBe(1);
      prev = t;
    }
    expect(nav.findPath(0, 0, 0, 0)).toEqual([]);
  });
});

describe('spatial hash', () => {
  it('query and best() match brute force', () => {
    const c = new Crowd(2000);
    const rng = new Rng(4);
    for (let k = 0; k < 1500; k++) {
      const s = c.alloc();
      c.x[s] = rng.range(0, 40);
      c.y[s] = rng.range(0, 30);
    }
    // Free some slots so dead entries exist below `hi`.
    for (let s = 0; s < 1500; s += 7) c.release(s);
    const hash = new SpatialHash(40, 30, 2000);
    hash.rebuild(c);
    const out = new Int32Array(2000);
    for (let q = 0; q < 50; q++) {
      const x = rng.range(-2, 42);
      const y = rng.range(-2, 32);
      const r = rng.range(0.2, 6);
      const n = hash.query(c, x, y, r, out);
      const got = [...out.subarray(0, n)].sort((a, b) => a - b);
      const want: number[] = [];
      for (let s = 0; s < c.hi; s++) {
        if (c.alive[s] && (c.x[s]! - x) ** 2 + (c.y[s]! - y) ** 2 <= r * r) want.push(s);
      }
      expect(got).toEqual(want);
      const weight = (s: number) => (s % 3 === 0 ? 0.5 : s % 5 === 0 ? 0 : 1);
      const best = hash.best(c, x, y, r, weight, 0.5);
      let bs = -1;
      let bsc = Infinity;
      for (const s of want) {
        const wt = weight(s);
        if (wt <= 0) continue;
        const sc = ((c.x[s]! - x) ** 2 + (c.y[s]! - y) ** 2) * wt;
        if (sc < bsc) {
          bsc = sc;
          bs = s;
        }
      }
      if (bs < 0) expect(best).toBe(-1);
      else {
        const sc = ((c.x[best]! - x) ** 2 + (c.y[best]! - y) ** 2) * weight(best);
        expect(sc).toBeCloseTo(bsc, 9);
      }
    }
  });

  it('crowd handles: generations invalidate stale references', () => {
    const c = new Crowd(8);
    const s = c.alloc();
    const h = c.handle(s);
    expect(c.resolve(h)).toBe(s);
    c.release(s);
    expect(c.resolve(h)).toBe(-1);
    const s2 = c.alloc();
    expect(s2).toBe(s);
    expect(c.resolve(h)).toBe(-1);
    expect(c.resolve(c.handle(s2))).toBe(s2);
    for (let k = 0; k < 7; k++) c.alloc();
    expect(c.full).toBe(true);
    expect(c.alloc()).toBe(-1);
  });
});
