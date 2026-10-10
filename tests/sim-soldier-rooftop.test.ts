/**
 * Soldiers deploy on a road tile or a deployable roof (owner: "Soldiers can also be put on
 * rooftops like the snipers or on the ground"). On a roof they behave like other rooftop units:
 * out of melee reach, stormed and thrown off by climbers, in reach of bazookas, same weapon.
 */
import { describe, expect, it } from 'vitest';
import { PT } from '../src/data/protesters';
import { UNITS, deploysOnRoads, deploysOnRoofs } from '../src/data/units';
import { nearestUnit } from '../src/sim/behaviours/protester';
import { PS } from '../src/sim/crowd';
import type { SimEvent } from '../src/sim/events';
import { isPrey } from '../src/sim/prey';
import { World } from '../src/sim/world';
import { AVENUE, avenueWorld, eventsOf, mapFromAscii } from './sim-fixtures';

function run(w: World, seconds: number, until?: (ev: SimEvent[]) => boolean): SimEvent[] {
  const all: SimEvent[] = [];
  const n = Math.round(seconds * 30);
  for (let k = 0; k < n; k++) {
    w.step();
    all.push(...w.events.drain());
    if (until?.(all)) break;
  }
  return all;
}

function soldierWorld(): World {
  const w = avenueWorld();
  w.economy.level = 6;
  w.economy.hate = 5000;
  return w;
}

describe('Soldiers: road or rooftop', () => {
  it('data: Soldiers take either; snipers stay rooftop-only, riot road-only', () => {
    expect(deploysOnRoads(UNITS.soldier) && deploysOnRoofs(UNITS.soldier)).toBe(true);
    expect([deploysOnRoads(UNITS.sniper), deploysOnRoofs(UNITS.sniper)]).toEqual([false, true]);
    expect([deploysOnRoads(UNITS.riot), deploysOnRoofs(UNITS.riot)]).toEqual([true, false]);
  });

  it('validation: road tile, deployable roof, non-deployable roof, lot; sniper unchanged', () => {
    const map = mapFromAscii(AVENUE, { spawns: [{ letters: 'A', unlockWave: 1 }] });
    // Residential block A is not a deployable rooftop in this world.
    (map.buildings[0] as { rooftop: boolean }).rooftop = false;
    const w = new World(map, { seed: 1 });
    w.economy.level = 6;
    w.economy.hate = 5000;
    const road = w.canDeploy('soldier', 6, 8);
    expect(road).toMatchObject({ ok: true, building: -1, x: 6.5, y: 8.5 });
    const roof = w.canDeploy('soldier', 12, 6);
    expect(roof.ok).toBe(true);
    expect(roof.building).toBe(w.map.building[6 * w.map.w + 12]);
    expect(w.canDeploy('soldier', 3, 0).reason).toBe('notRooftop'); // block A: no roof access
    expect(w.canDeploy('soldier', 1, 8).reason).toBe('notRoad'); // empty lot
    expect(w.canDeploy('sniper', 6, 8).reason).toBe('notRooftop');
    expect(w.canDeploy('sniper', 12, 6).ok).toBe(true);
    // One unit per roof, whoever is up there.
    const s = w.deploy('soldier', 12, 6)!;
    expect(s.building).toBe(roof.building);
    expect(s.z).toBe(3);
    expect(s.tile).toBe(-1);
    expect(w.roofUnit[s.building]).toBe(s.slot);
    expect(w.canDeploy('sniper', 13, 7).reason).toBe('roofTaken');
    expect(w.canDeploy('soldier', 11, 5).reason).toBe('roofTaken');
    // The road soldier is a normal ground unit.
    const g = w.deploy('soldier', 6, 8)!;
    expect(g.building).toBe(-1);
    expect(w.unitTile[8 * w.map.w + 6]).toBe(g.slot);
    expect(w.canDeploy('riot', 6, 8).reason).toBe('occupied');
  });

  it('on a roof it fires its bursts into the crowd from the roof', () => {
    const w = soldierWorld();
    const u = w.deploy('soldier', 12, 6)!;
    for (let k = 0; k < 6; k++) w.spawnProtester(PT.student, 6.5 + (k % 3), 3 + k * 0.3);
    const ev = run(w, 4);
    const shots = eventsOf(ev, 'fired').filter((f) => f.shooterId === u.id);
    expect(shots.length).toBeGreaterThanOrEqual(3);
    expect(shots.every((f) => f.weapon === 'rifle' && f.z0 === 3)).toBe(true);
    expect(w.stats.protestersFallen.student).toBeGreaterThan(0);
  });

  it('cannot be meleed from the street, nor hunted on foot (only climbers reach it)', () => {
    const w = soldierWorld();
    const u = w.deploy('soldier', 12, 6)!;
    u.hp = u.maxHp = 1e6;
    expect(isPrey(u)).toBe(false);
    // Tough non-climbers (students) pressing along the sidewalk right under the facade.
    for (let k = 0; k < 8; k++) {
      const s = w.spawnProtester(PT.student, 10.6, 4 + k * 0.5);
      w.crowd.hp[s] = w.crowd.maxHp[s] = 1e6;
    }
    const ev = run(w, 6);
    expect(eventsOf(ev, 'attacked').filter((a) => a.targetId === u.id)).toHaveLength(0);
    expect(u.nHolders).toBe(0);
    expect(u.hp).toBe(u.maxHp);
  });

  it('isolated on a roof it is stormed by climbers and thrown off (body in the street)', () => {
    const w = soldierWorld();
    const u = w.deploy('soldier', 12, 6)!;
    u.rage = 100; // it has been shooting for a while
    u.hp = 5; // and is nearly done
    const b = u.building;
    for (let k = 0; k < 6; k++) {
      const s = w.spawnProtester(PT.woke, 9.4, 4.5 + k * 0.4);
      w.crowd.hp[s] = w.crowd.maxHp[s] = 1e6;
    }
    const ev = run(w, 40, (e) => eventsOf(e, 'unitDied').some((d) => d.unitId === u.id));
    expect(eventsOf(ev, 'climbStart').some((c) => c.building === b)).toBe(true);
    const thrown = eventsOf(ev, 'thrownOffRoof').find((t) => t.unitId === u.id);
    expect(thrown).toMatchObject({ unit: 'soldier', building: b, height: 3 });
    const died = eventsOf(ev, 'unitDied').find((d) => d.unitId === u.id)!;
    expect(died.thrownOff).toBe(true);
    expect(w.map.building[Math.floor(died.y) * w.map.w + Math.floor(died.x)]).toBe(-1);
    expect(w.roofUnit[b]).toBe(-1);
    // The climbers leave the roof again.
    run(w, 6);
    for (let s = 0; s < w.crowd.hi; s++) {
      if (w.crowd.alive[s]) expect(w.crowd.state[s]).not.toBe(PS.ON_ROOF);
    }
  });

  it('bazookas go for a rooftop Soldier; plain gunmen cannot reach it', () => {
    const w = soldierWorld();
    const u = w.deploy('soldier', 12, 6)!;
    expect(nearestUnit(w, 7.5, 6.5, 7, true)).toBe(u);
    expect(nearestUnit(w, 7.5, 6.5, 7, false)).toBeNull();
  });
});
