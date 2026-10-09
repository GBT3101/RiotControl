/**
 * Performance budget (PLAN §4.2): 3000 active protesters on a 72×72 city — one sim tick must
 * average < 4 ms in Node. Measured with a realistic mix: crowds marching and jamming, units
 * fighting (melee, piercing shots, rooftop snipers), deaths, bodies and flow recomputes.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { buildTestCity } from '../src/sim/testCity';
import { World } from '../src/sim/world';

describe('performance', () => {
  it('3000 protesters: average tick < 4 ms', () => {
    const map = buildTestCity();
    const w = new World(map, { seed: 5 });
    w.economy.hate = 1e6;
    w.economy.level = 10;
    const rng = new Rng(9);
    const tiles: number[] = [];
    for (let t = 0; t < w.nav.size; t++) if (w.nav.walk[t] && w.nav.dist[t]! > 6) tiles.push(t);
    const spawn = (n: number): void => {
      for (let k = 0; k < n; k++) {
        const t = rng.pick(tiles);
        w.spawnProtester(
          rng.int(0, 5),
          (t % map.w) + rng.next(),
          Math.floor(t / map.w) + rng.next(),
        );
      }
    };
    spawn(3000);
    const kinds = [
      'riot',
      'riot',
      'armed',
      'soldier',
      'gas',
      'riot',
      'blockade',
      'humvee',
    ] as const;
    let placed = 0;
    for (let t = 0; t < w.nav.size && placed < 48; t += 37) {
      if (
        w.nav.road[t] &&
        w.nav.dist[t]! < 25 &&
        w.deploy(kinds[placed % kinds.length]!, t % map.w, Math.floor(t / map.w))
      )
        placed++;
    }
    for (const b of map.buildings)
      if (b.rooftop && placed < 60 && w.deploy('sniper', b.i, b.j)) placed++;
    expect(placed).toBeGreaterThan(40);
    // Sturdy officers so the fighting lasts through the whole measurement.
    for (const u of w.units.active) u.hp = u.maxHp = 1e5;
    // Warm up the JIT.
    for (let k = 0; k < 60; k++) {
      w.step();
      w.events.drain();
    }
    const N = 240;
    let total = 0;
    let crowd = 0;
    for (let k = 0; k < N; k++) {
      // Keep the crowd at ~3000 (top up casualties, like a director at its cap).
      if (k % 15 === 0 && w.crowd.count < 3000) spawn(3000 - w.crowd.count);
      const t0 = performance.now();
      w.step();
      total += performance.now() - t0;
      crowd += w.crowd.count;
      w.events.drain();
    }
    const avg = total / N;
    console.info(
      `[sim-perf] ${(crowd / N).toFixed(0)} protesters avg, ${w.units.count} units left: ${avg.toFixed(3)} ms/tick`,
    );
    expect(crowd / N).toBeGreaterThan(2900);
    expect(w.units.count).toBe(placed);
    expect(avg).toBeLessThan(4);
  });
});
