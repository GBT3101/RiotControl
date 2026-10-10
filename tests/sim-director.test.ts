import { afterEach, describe, expect, it } from 'vitest';
import { BALANCE, spawnSeconds, waveSize } from '../src/data/balance';
import { PT } from '../src/data/protesters';
import type { SimEvent } from '../src/sim/events';
import { buildTestCity } from '../src/sim/testCity';
import { World } from '../src/sim/world';
import { eventsOf, mapFromAscii } from './sim-fixtures';

function run(w: World, seconds: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let k = 0; k < Math.round(seconds * 30); k++) {
    w.step();
    all.push(...w.events.drain());
  }
  return all;
}

/** Two districts: A (wave 1) and B (wave 3). */
const TWO = [
  'AAAA......BBBB',
  'AAAA......BBBB',
  '..............',
  '..............',
  'XXX________XXX',
  'XXXX__SSS__XXX',
  'XXXXXXCCCXXXXX',
];

const breta = BALANCE.waves.breta as { chance: number };
const caps = BALANCE.concurrency as Record<string, number>;
afterEach(() => {
  breta.chance = 0.01;
  caps.low = 800;
});

describe('wave director', () => {
  it('prep phase is untimed until startWaves()', () => {
    const w = new World(buildTestCity(), { seed: 2 });
    run(w, 60);
    expect(w.director.phase).toBe('prep');
    expect(w.crowd.count).toBe(0);
    expect(w.startWaves()).toBe(true);
    expect(w.startWaves()).toBe(false);
    expect(w.director.phase).toBe('wave');
    expect(w.director.wave).toBe(1);
    expect(w.director.waveSize).toBe(waveSize(1, 0, w.time));
  });

  it('spawns from building doors of unlocked districts, then a breather, then the next wave', () => {
    const map = mapFromAscii(TWO, {
      spawns: [
        { letters: 'A', unlockWave: 1 },
        { letters: 'B', unlockWave: 3 },
      ],
    });
    const w = new World(map, { seed: 3 });
    w.startWaves();
    // Wave 1 streams in over its spawn window (M12), not as a burst.
    expect(spawnSeconds(30)).toBeGreaterThan(8);
    const ev = run(w, spawnSeconds(30) + 8);
    const spawned = eventsOf(ev, 'spawned');
    expect(spawned).toHaveLength(30);
    const t = spawned.map((e) => e.tick / 30);
    expect(Math.max(...t) - Math.min(...t)).toBeGreaterThan(spawnSeconds(30) * 0.4);
    for (const s of spawned) {
      expect(s.building).toBe(0); // only district A in wave 1
      expect(map.buildings[0]!.doors).toContainEqual({ i: s.doorI, j: s.doorJ });
    }
    expect(eventsOf(ev, 'waveStart')[0]).toMatchObject({ wave: 1, size: 30 });
    expect(new Set(spawned.map((s) => s.ptype))).toEqual(new Set(['student', 'woke']));
    // Wave ends once the crowd is (nearly) gone → breather.
    for (let k = 0; k < w.crowd.hi; k++) if (w.crowd.alive[k]) w.crowd.hp[k] = 0.01;
    for (let k = 0; k < w.crowd.hi; k++) w.crowd.gasT[k] = 1;
    const ev2 = run(w, 1);
    expect(eventsOf(ev2, 'waveEnd')).toHaveLength(1);
    expect(w.director.phase).toBe('breather');
    expect(w.director.breather).toBeGreaterThanOrEqual(BALANCE.waves.breather[0]);
    expect(w.director.breather).toBeLessThanOrEqual(BALANCE.waves.breather[1]);
    // Call early: bonus = remaining / 2.
    const remaining = w.director.breather;
    const hate = w.hate;
    const bonus = w.callNextWaveEarly();
    expect(bonus).toBe(Math.floor(remaining * BALANCE.waves.callEarlyFactor));
    expect(w.hate).toBe(hate + bonus);
    expect(w.director.wave).toBe(2);
    expect(w.callNextWaveEarly()).toBe(0); // not in a breather
    // Wave 3 unlocks district B.
    expect(w.director.activeDistricts(2)).toEqual([0]);
    expect(w.director.activeDistricts(3)).toEqual([0, 1]);
  });

  it('respects the concurrency cap of the quality tier', () => {
    caps.low = 40;
    const w = new World(buildTestCity(), { seed: 4, quality: 'low' });
    w.economy.level = 10;
    w.startWaves();
    // Jump to a big wave.
    for (let k = 0; k < 30; k++) {
      w.director.toSpawn = 0;
      (w.director as unknown as { beginWave(w: World): void }).beginWave(w);
    }
    expect(w.director.waveSize).toBeGreaterThan(200);
    let peak = 0;
    for (let k = 0; k < 30 * 20; k++) {
      w.step();
      w.events.drain();
      peak = Math.max(peak, w.crowd.count);
    }
    expect(peak).toBeLessThanOrEqual(40);
    expect(peak).toBeGreaterThan(30);
  });

  it('composition is weighted toward the newest unlocked types', () => {
    const w = new World(buildTestCity(), { seed: 5 });
    w.economy.level = 6; // crazy mob unlocked at 6
    w.startWaves();
    const counts = new Map<number, number>();
    for (let k = 0; k < 4000; k++) {
      const t = w.director.rollType(w);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    expect(counts.get(PT.prophet)).toBeUndefined();
    expect(counts.get(PT.cultist)).toBeUndefined();
    // Crazy Mob (weight 3) is boosted ×newestBoost against the Violent Woke (weight 7).
    const ratio = counts.get(PT.crazy)! / counts.get(PT.woke)!;
    expect(ratio).toBeGreaterThan(3 / 7 + 0.1);
    expect(ratio).toBeCloseTo((3 * BALANCE.waves.newestBoost) / 7, 1);
    expect(counts.get(PT.student)).toBeGreaterThan(0);
  });

  it('Breta rolls per spawn group (max one alive) with 6–10 paparazzi', () => {
    breta.chance = 1;
    const w = new World(buildTestCity(), { seed: 6 });
    w.startWaves();
    const ev = run(w, spawnSeconds(30) + 10);
    const b = eventsOf(ev, 'bretaSpawned');
    expect(b).toHaveLength(1);
    expect(b[0]!.paparazzi).toBeGreaterThanOrEqual(6);
    expect(b[0]!.paparazzi).toBeLessThanOrEqual(10);
    const spawned = eventsOf(ev, 'spawned');
    expect(spawned.filter((s) => s.ptype === 'breta')).toHaveLength(1);
    expect(spawned.filter((s) => s.ptype === 'paparazzi')).toHaveLength(b[0]!.paparazzi);
    // Breta & entourage do not count toward the wave size.
    expect(spawned.filter((s) => s.ptype !== 'breta' && s.ptype !== 'paparazzi')).toHaveLength(30);
  });
});
