/**
 * M7 remainder (M8): district rally points, rooftop units fighting climbers on their roof,
 * commandable units that never stack.
 */
import { describe, expect, it } from 'vitest';
import { PT } from '../src/data/protesters';
import { PS } from '../src/sim/crowd';
import { mapFromAscii, AVENUE, eventsOf } from './sim-fixtures';
import { World } from '../src/sim/world';
import type { SimEvent } from '../src/sim/events';

function run(w: World, seconds: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let k = 0; k < Math.round(seconds * 30); k++) {
    w.step();
    all.push(...w.events.drain());
  }
  return all;
}

describe('rally points', () => {
  it('fresh protesters walk to their district rally point, gather, then march', () => {
    const map = mapFromAscii(AVENUE, { spawns: [{ letters: 'A', unlockWave: 1 }] });
    map.spawns[0]!.rally = { i: 7, j: 6 };
    const w = new World(map, { seed: 4 });
    const s = w.spawnProtester(PT.student, 2.5, 2.5, { mill: true, district: 0 });
    const seen = new Set<number>();
    let gatherAt: { x: number; y: number } | null = null;
    for (let k = 0; k < 30 * 30; k++) {
      w.step();
      if (!w.crowd.alive[s]) break;
      const st = w.crowd.state[s]!;
      seen.add(st);
      if (st === PS.GATHER && !gatherAt) gatherAt = { x: w.crowd.x[s]!, y: w.crowd.y[s]! };
    }
    expect(seen.has(PS.RALLY)).toBe(true);
    expect(seen.has(PS.GATHER)).toBe(true);
    expect(seen.has(PS.MARCH) || seen.has(PS.CAPITOL)).toBe(true);
    expect(Math.hypot(gatherAt!.x - 7.5, gatherAt!.y - 6.5)).toBeLessThan(3);
  });

  it('skips rally points that are a long detour', () => {
    const map = mapFromAscii(AVENUE, { spawns: [{ letters: 'A', unlockWave: 1 }] });
    map.spawns[0]!.rally = { i: 7, j: 15 }; // right at the steps, way past the detour budget
    const w = new World(map, { seed: 4 });
    const s = w.spawnProtester(PT.student, 2.5, 2.5, { mill: true, district: 0 });
    for (let k = 0; k < 60; k++) {
      w.step();
      expect(w.crowd.state[s]).not.toBe(PS.RALLY);
    }
  });
});

describe('rooftop units fight back', () => {
  it('a sniper hits climbers on its own roof', () => {
    const map = mapFromAscii(AVENUE, { spawns: [{ letters: 'A', unlockWave: 1 }] });
    const w = new World(map, { seed: 1 });
    w.economy.level = 1;
    const sniper = w.deploy('sniper', 12, 6)!;
    // A climber already on the roof.
    const s = w.spawnProtester(PT.woke, 11.2, 6.5);
    w.crowd.state[s] = PS.ON_ROOF;
    w.crowd.bld[s] = sniper.building;
    w.crowd.climb[s] = 1;
    w.roofClimbers[sniper.building] = 1;
    sniper.roofAttackers = 1;
    w.crowd.hp[s] = 1000;
    w.crowd.maxHp[s] = 1000;
    const ev = run(w, 4);
    const hits = eventsOf(ev, 'attacked').filter(
      (a) => a.attackerId === sniper.id && a.targetKind === 'protester',
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(w.crowd.hp[s]).toBeLessThan(1000);
  });
});

describe('commandable units', () => {
  it('two horses sent to the same tile end up on different tiles', () => {
    const map = mapFromAscii(AVENUE, { spawns: [{ letters: 'A', unlockWave: 1 }] });
    const w = new World(map, { seed: 1 });
    w.economy.level = 4;
    w.economy.hate = 100;
    const a = w.deploy('mounted', 6, 12)!;
    const b = w.deploy('mounted', 8, 12)!;
    expect(w.command(a.id, 7, 5)).toBe(true);
    expect(w.command(b.id, 7, 5)).toBe(true);
    run(w, 12);
    expect(a.moving).toBe(false);
    expect(b.moving).toBe(false);
    const ta = w.nav.tileAt(a.x, a.y);
    const tb = w.nav.tileAt(b.x, b.y);
    expect(ta).not.toBe(tb);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.6);
  });
});
