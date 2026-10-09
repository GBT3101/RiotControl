import { describe, expect, it } from 'vitest';
import { DMG } from '../src/data/damage';
import { PT } from '../src/data/protesters';
import { UNITS } from '../src/data/units';
import { auraFactor } from '../src/sim/behaviours/protester';
import { hurtUnit } from '../src/sim/combat';
import { PS } from '../src/sim/crowd';
import type { SimEvent } from '../src/sim/events';
import type { World } from '../src/sim/world';
import { avenueWorld, eventsOf } from './sim-fixtures';

/** Step `seconds`, collecting every event. */
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

/** Spawn a protester frozen in place (long stun). */
function frozen(w: World, type: number, x: number, y: number): number {
  const s = w.spawnProtester(type, x, y);
  w.crowd.stun[s] = 1000;
  return s;
}

describe('combat', () => {
  it('Riot Control holds at most 3 protesters and KOs them (non-lethal)', () => {
    const w = avenueWorld();
    const u = w.deploy('riot', 7, 9)!;
    for (let k = 0; k < 6; k++) w.spawnProtester(PT.student, 6 + k * 0.6, 7.5);
    let maxHeld = 0;
    const ev: SimEvent[] = [];
    for (let k = 0; k < 30 * 25; k++) {
      w.step();
      ev.push(...w.events.drain());
      maxHeld = Math.max(maxHeld, u.nHolders);
      expect(u.nHolders).toBeLessThanOrEqual(3);
    }
    expect(maxHeld).toBe(3);
    const died = eventsOf(ev, 'died').filter((d) => d.by === u.id);
    expect(died.length).toBeGreaterThan(0);
    for (const d of died) expect(d.lethal).toBe(false);
    const hits = eventsOf(ev, 'attacked').filter((a) => a.attackerId === u.id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatchObject({ damage: 10, dmgType: 'melee', targetKind: 'protester' });
  });

  it('armour: the riot shield removes 30% of melee damage', () => {
    const w = avenueWorld();
    const u = w.deploy('riot', 7, 9)!;
    hurtUnit(w, u, 10, DMG.melee, true, 'protester', -1);
    expect(u.hp).toBeCloseTo(93);
    hurtUnit(w, u, 10, DMG.bullet, true, 'protester', -1);
    expect(u.hp).toBeCloseTo(83);
  });

  it('Armed Cops pierce up to 4 protesters in a line (lethal)', () => {
    const w = avenueWorld();
    w.economy.level = 5;
    w.economy.hate = 100;
    const u = w.deploy('armed', 7, 13)!;
    const line = [11.5, 10.5, 9.5, 8.5, 7.5].map((y) => frozen(w, PT.student, 7.5, y));
    const ev = run(w, 0.5);
    const shots = eventsOf(ev, 'fired').filter((f) => f.shooterId === u.id);
    expect(shots).toHaveLength(1);
    expect(shots[0]!.hits).toBe(4);
    const died = eventsOf(ev, 'died');
    expect(died).toHaveLength(4);
    for (const d of died) expect(d).toMatchObject({ lethal: true, cause: 'bullet', by: u.id });
    expect(w.crowd.alive[line[4]!]).toBe(1);
  });

  it('Soldiers fire 3-round bursts', () => {
    const w = avenueWorld();
    w.economy.level = 6;
    w.economy.hate = 200;
    const u = w.deploy('soldier', 7, 13)!;
    const s = frozen(w, PT.cultist, 7.5, 9.5);
    const ev = run(w, 0.6);
    const shots = eventsOf(ev, 'fired').filter((f) => f.shooterId === u.id);
    expect(shots).toHaveLength(3);
    expect(w.crowd.hp[s]).toBeCloseTo(90 - 75);
  });

  it('Tank shells are ballistic AOE and hurt own units (friendly fire)', () => {
    const w = avenueWorld();
    w.economy.level = 9;
    w.economy.hate = 1000;
    const tank = w.deploy('tank', 7, 13)!;
    const riot = w.deploy('riot', 7, 5)!;
    for (let k = 0; k < 4; k++) frozen(w, PT.mob, 6.6 + k * 0.6, 4.4);
    const ev = run(w, 3);
    const fired = eventsOf(ev, 'fired').filter((f) => f.shooterId === tank.id);
    expect(fired.length).toBeGreaterThan(0);
    expect(fired[0]!.projectileId).toBeGreaterThan(0);
    const boom = eventsOf(ev, 'exploded').filter((e) => e.kind === 'shell');
    expect(boom.length).toBeGreaterThan(0);
    // 200 explosion damage ≥ riot HP → the officer falls to his own side's shell.
    expect(riot.alive).toBe(false);
    const ud = eventsOf(ev, 'unitDied').find((e) => e.unitId === riot.id)!;
    expect(ud).toMatchObject({ cause: 'explosion', lethal: true });
    expect(eventsOf(ev, 'died').every((d) => d.lethal)).toBe(true);
    expect(tank.hp).toBe(UNITS.tank.hp); // never shells itself (min range)
  });

  it('Tank crushes protesters it drives over', () => {
    const w = avenueWorld();
    w.economy.level = 9;
    w.economy.hate = 1000;
    const tank = w.deploy('tank', 7, 4)!;
    tank.cd = 100;
    for (let y = 6.5; y < 12; y += 1) frozen(w, PT.student, 7.5, y);
    expect(w.command(tank.id, 7, 13)).toBe(true);
    const ev = run(w, 8);
    const crushed = eventsOf(ev, 'died').filter((d) => d.cause === 'crush');
    expect(crushed.length).toBeGreaterThanOrEqual(4);
    expect(crushed[0]).toMatchObject({ lethal: true, by: tank.id });
  });

  it('Prophets explode on contact; a tank loses 50% of its max HP', () => {
    const w = avenueWorld();
    w.economy.level = 10;
    w.economy.hate = 1000;
    const tank = w.deploy('tank', 7, 10)!;
    tank.cd = 100;
    w.spawnProtester(PT.prophet, 7.5, 7.5);
    const ev = run(w, 4, (e) => e.some((x) => x.type === 'exploded'));
    const boom = eventsOf(ev, 'exploded');
    expect(boom[0]!.kind).toBe('prophet');
    expect(tank.hp).toBeCloseTo(UNITS.tank.hp * 0.5);
    expect(eventsOf(ev, 'died')[0]).toMatchObject({ ptype: 'prophet', cause: 'explosion' });
  });

  it('Tear gas: cone stuns, grenade charges in 10 s and gasses the densest crowd', () => {
    const w = avenueWorld();
    w.economy.level = 3;
    w.economy.hate = 100;
    const u = w.deploy('gas', 7, 13)!;
    let ev = run(w, 9.9);
    expect(eventsOf(ev, 'abilityReady')).toHaveLength(0);
    expect(w.useAbility(u.id)).toBe(false);
    ev = run(w, 0.2);
    expect(eventsOf(ev, 'abilityReady')).toHaveLength(1);
    expect(w.useAbility(u.id)).toBe(false); // nobody in range: charge kept
    expect(u.abilityReady).toBe(true);
    const crowd: number[] = [];
    for (let k = 0; k < 8; k++)
      crowd.push(frozen(w, PT.student, 6.6 + (k % 4) * 0.6, 7.3 + (k >> 2) * 0.6));
    frozen(w, PT.student, 9.5, 3.5); // a lone one elsewhere
    w.step();
    expect(w.useAllAbilities()).toBe(1);
    expect(u.abilityReady).toBe(false);
    ev = run(w, 2);
    const area = eventsOf(ev, 'areaCreated')[0]!;
    expect(area).toMatchObject({ kind: 'gas', radius: 2.5, ttl: 6 });
    expect(Math.hypot(area.x - 7.5, area.y - 7.5)).toBeLessThan(1.5);
    const gassed = crowd.filter((s) => w.crowd.alive[s] && w.crowd.gasT[s]! > 0);
    expect(gassed.length).toBeGreaterThan(4);
    for (const s of gassed) expect(w.crowd.hp[s]).toBeLessThan(30);
    // Cone: a student walking into range 3 gets stunned.
    const s = w.spawnProtester(PT.student, 7.5, 11.2);
    run(w, 0.5);
    expect(w.crowd.stun[s]).toBeGreaterThan(0);
  });

  it('climbers divert to unguarded sniper roofs and throw the sniper off', () => {
    const w = avenueWorld();
    w.economy.level = 1;
    const sniper = w.deploy('sniper', 12, 6)!;
    const climbers: number[] = [];
    for (let k = 0; k < 4; k++) {
      const s = w.spawnProtester(PT.woke, 8.5 + k * 0.3, 3.5);
      w.crowd.hp[s] = 5000; // survive the sniper's rubber rounds
      w.crowd.maxHp[s] = 5000;
      climbers.push(s);
    }
    const ev = run(w, 40, (e) => e.some((x) => x.type === 'thrownOffRoof'));
    expect(eventsOf(ev, 'climbStart').length).toBeGreaterThan(0);
    expect(eventsOf(ev, 'reachedRoof').length).toBeGreaterThan(0);
    const thrown = eventsOf(ev, 'thrownOffRoof');
    expect(thrown).toHaveLength(1);
    expect(thrown[0]).toMatchObject({ unitId: sniper.id, unit: 'sniper', height: 3 });
    expect(w.nav.isSolidAt(thrown[0]!.toX, thrown[0]!.toY)).toBe(false);
    const died = eventsOf(ev, 'unitDied')[0]!;
    expect(died).toMatchObject({ unit: 'sniper', thrownOff: true, lethal: true });
    expect(sniper.alive).toBe(false);
    expect(w.roofUnit[sniper.building]).toBe(-1);
    // Climbers come back down and march on.
    run(w, 5);
    for (const s of climbers) {
      expect([PS.MARCH, PS.CAPITOL, PS.ENGAGED]).toContain(w.crowd.state[s]);
    }
    expect(w.roofClimbers[sniper.building]).toBe(0);
  });

  it('a nearby Riot Control guards the roof: nobody climbs', () => {
    const w = avenueWorld();
    w.economy.level = 1;
    w.economy.hate = 100;
    w.deploy('sniper', 12, 6);
    w.deploy('riot', 10, 9); // within 2.5 tiles of the footprint
    for (let k = 0; k < 4; k++) {
      const s = w.spawnProtester(PT.woke, 8.5 + k * 0.3, 3.5);
      w.crowd.hp[s] = 5000;
    }
    const ev = run(w, 12);
    expect(eventsOf(ev, 'climbStart')).toHaveLength(0);
  });

  it('bazookas hit rooftop units; molotovs leave fire that burns units', () => {
    const w = avenueWorld();
    w.economy.level = 8;
    w.economy.hate = 1000;
    const sniper = w.deploy('sniper', 12, 6)!;
    const riot = w.deploy('riot', 6, 11)!;
    const b = frozen(w, PT.cultist, 9.5, 9.5);
    w.crowd.loadout[b] = 2; // bazooka
    w.crowd.stun[b] = 0;
    w.crowd.cd2[b] = 0;
    w.crowd.hp[b] = 1e6;
    const m = frozen(w, PT.veryViolent, 5.5, 8.5);
    w.crowd.stun[m] = 0;
    w.crowd.cd2[m] = 0;
    w.crowd.hp[m] = 1e6;
    const ev = run(w, 3);
    const shots = eventsOf(ev, 'fired');
    expect(shots.some((f) => f.weapon === 'bazooka' && f.projectileId > 0)).toBe(true);
    expect(shots.some((f) => f.weapon === 'molotov')).toBe(true);
    expect(sniper.hp).toBeLessThan(UNITS.sniper.hp);
    expect(eventsOf(ev, 'areaCreated').some((a) => a.kind === 'fire')).toBe(true);
    expect(riot.hp).toBeLessThan(UNITS.riot.hp);
  });

  it('paparazzi flash blinds units; Breta speeds up nearby protesters', () => {
    const w = avenueWorld();
    const riot = w.deploy('riot', 7, 9)!;
    const breta = w.spawnProtester(PT.breta, 7.5, 3.5);
    const p = w.spawnProtester(PT.paparazzi, 7.5, 7.8);
    w.crowd.cd2[p] = 0;
    const ev = run(w, 1);
    expect(eventsOf(ev, 'flash')[0]).toMatchObject({ unitId: riot.id });
    expect(riot.blind > 0 || riot.stun > 0).toBe(true);
    expect(w.bretaSlot).toBe(breta);
    expect(w.crowd.state[p]).toBe(PS.FOLLOW); // paparazzi flock around Breta
    const bx = w.crowd.x[breta]!;
    const by = w.crowd.y[breta]!;
    expect(auraFactor(w, bx + 1, by)).toBeCloseTo(1.25);
    expect(auraFactor(w, bx + 5, by)).toBe(1);
  });

  it('commandable units path on roads only; the helicopter flies anywhere and cannot be hurt', () => {
    const w = avenueWorld();
    w.economy.level = 10;
    w.economy.hate = 5000;
    const horse = w.deploy('mounted', 7, 3)!;
    expect(w.command(horse.id, 1, 8)).toBe(false); // lot
    expect(w.command(horse.id, 8, 12)).toBe(true);
    run(w, 6);
    expect([Math.floor(horse.x), Math.floor(horse.y)]).toEqual([8, 12]);
    expect(horse.moving).toBe(false);
    expect(w.unitTile[12 * w.map.w + 8]).toBe(horse.slot);
    const heli = w.deploy('heli', 7, 7)!;
    expect(w.command(heli.id, 1, 16)).toBe(true);
    run(w, 4);
    expect(Math.hypot(heli.x - 1.5, heli.y - 16.5)).toBeLessThan(0.01);
    hurtUnit(w, heli, 1e9, DMG.explosion, true, 'protester', -1);
    expect(heli.alive).toBe(true);
    const riot = w.deploy('riot', 6, 6)!;
    expect(w.command(riot.id, 6, 7)).toBe(false); // not commandable
  });
});
