import { describe, expect, it } from 'vitest';
import { PT } from '../src/data/protesters';
import { UNITS, abilityOf, type UnitId } from '../src/data/units';
import type { SimEvent } from '../src/sim/events';
import { fragTime, missileTime, strikeImpacts, strikePath } from '../src/sim/skills';
import type { Unit } from '../src/sim/units';
import type { World } from '../src/sim/world';
import { avenueWorld, eventsOf } from './sim-fixtures';

/** Step `seconds`, collecting every event. */
function run(w: World, seconds: number): SimEvent[] {
  const all: SimEvent[] = [];
  const n = Math.round(seconds * 30);
  for (let k = 0; k < n; k++) {
    w.step();
    all.push(...w.events.drain());
  }
  return all;
}

/** Spawn a protester frozen in place (long stun). */
function frozen(w: World, type: number, x: number, y: number): number {
  const s = w.spawnProtester(type, x, y);
  w.crowd.stun[s] = 1000;
  return s;
}

function world(): World {
  const w = avenueWorld();
  w.economy.level = 10;
  w.economy.hate = 100000;
  return w;
}

/** Deploy a unit and charge its skill fully. */
function ready(w: World, unit: UnitId, i: number, j: number): Unit {
  const u = w.deploy(unit, i, j)!;
  expect(u, unit).toBeTruthy();
  u.charge = u.def.ability!.charge - 0.01;
  w.step();
  w.events.drain();
  expect(u.abilityReady, unit).toBe(true);
  return u;
}

const alive = (w: World, s: number): boolean => w.crowd.alive[s] === 1;

describe('special skills: data', () => {
  it('charge times grow with the unit level (18/22/28/45/60 s) and aim modes', () => {
    expect(abilityOf(UNITS.mounted, 'ram')?.charge).toBe(18);
    expect(abilityOf(UNITS.armed, 'rapidFire')?.charge).toBe(22);
    expect(abilityOf(UNITS.soldier, 'fragGrenade')?.charge).toBe(28);
    expect(abilityOf(UNITS.tank, 'missile')?.charge).toBe(45);
    expect(abilityOf(UNITS.heli, 'airStrike')?.charge).toBe(60);
    expect(abilityOf(UNITS.tank, 'ram')).toBeUndefined();
    const order: UnitId[] = ['gas', 'mounted', 'armed', 'soldier', 'tank', 'heli'];
    const charges = order.map((u) => UNITS[u].ability!.charge);
    expect([...charges].sort((a, b) => a - b)).toEqual(charges);
    expect(UNITS.tank.ability!.aim).toBe('point');
    expect(UNITS.heli.ability!.aim).toBe('line');
    for (const u of ['gas', 'mounted', 'armed', 'soldier'] as const)
      expect(UNITS[u].ability!.aim).toBe('auto');
  });
});

describe('special skills: charging', () => {
  it('charges in the data time and pauses while stunned / knocked down', () => {
    const w = world();
    const u = w.deploy('mounted', 7, 12)!;
    let ev = run(w, 17.9);
    expect(eventsOf(ev, 'abilityReady')).toHaveLength(0);
    // Knocked down for 3 s: no charge meanwhile.
    u.stun = 3;
    const before = u.charge;
    run(w, 2.9);
    expect(u.charge).toBeCloseTo(before, 5);
    ev = run(w, 0.4);
    expect(eventsOf(ev, 'abilityReady')).toEqual([
      expect.objectContaining({ unitId: u.id, skill: 'ram' }),
    ]);
    expect(u.abilityReady).toBe(true);
  });
});

describe('special skills: effects', () => {
  it('ram: gallops the lane and bowls over everyone in it (KO, never lethal)', () => {
    const w = world();
    const u = ready(w, 'mounted', 7, 12);
    const lane = [11, 10, 9.2, 8.4].map((y) => frozen(w, PT.student, 7.5, y));
    const tough = frozen(w, PT.cultist, 7.6, 9.6);
    const off = frozen(w, PT.student, 5.3, 10);
    const cop = w.deploy('riot', 9, 9)!;
    const hp = cop.hp;
    w.step();
    expect(w.useAbility(u.id)).toBe(true);
    expect(u.abilityReady).toBe(false);
    const ev = run(w, 2);
    const hits = eventsOf(ev, 'skillHit').filter((h) => h.skill === 'ram');
    expect(hits.length).toBeGreaterThanOrEqual(5);
    for (const s of lane) expect(alive(w, s)).toBe(false);
    const ko = eventsOf(ev, 'died').filter((d) => d.by === u.id);
    expect(ko.length).toBeGreaterThanOrEqual(4);
    for (const d of ko) expect(d.lethal).toBe(false);
    // Survivors are stunned; off-lane protesters untouched; the horse ends down the lane.
    if (alive(w, tough)) expect(w.crowd.stun[tough]).toBeGreaterThan(0);
    expect(alive(w, off)).toBe(true);
    expect(w.crowd.hp[off]).toBe(35);
    expect(u.y).toBeLessThan(7.5);
    expect(u.skillLock).toBe(false);
    expect(eventsOf(ev, 'skillEnded')).toHaveLength(1);
    expect(cop.hp).toBe(hp);
    // It can be commanded again.
    expect(w.command(u.id, 7, 12)).toBe(true);
  });

  it('ram: the command reports the lane (skillUsed) and needs someone in it', () => {
    const w = world();
    const u = ready(w, 'mounted', 7, 12);
    expect(w.useAbility(u.id)).toBe(false); // empty street: charge kept
    expect(u.abilityReady).toBe(true);
    frozen(w, PT.student, 7.5, 10);
    w.step();
    w.events.drain();
    expect(w.useAbility(u.id)).toBe(true);
    const used = eventsOf(w.events.drain(), 'skillUsed')[0]!;
    expect(used).toMatchObject({ skill: 'ram', unit: 'mounted', impactAt: 0.5 });
    expect(Math.hypot(used.x1 - used.x0, used.y1 - used.y0)).toBeGreaterThan(3);
  });

  it('rapid fire: five piercing shots 0.12 s apart at the nearest targets', () => {
    const w = world();
    const u = ready(w, 'armed', 7, 12);
    const crowd: number[] = [];
    for (let k = 0; k < 10; k++)
      crowd.push(frozen(w, PT.cultist, 6.2 + (k % 5) * 0.6, 8 - (k >> 1) * 0.3));
    w.step();
    w.events.drain();
    expect(w.useAbility(u.id)).toBe(true);
    const ev = run(w, 1);
    const shots = eventsOf(ev, 'skillShot');
    expect(shots).toHaveLength(5);
    expect(shots.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
    for (let k = 1; k < 5; k++) {
      const dt = (shots[k]!.tick - shots[k - 1]!.tick) / 30;
      expect(dt).toBeGreaterThan(0.09);
      expect(dt).toBeLessThan(0.15);
    }
    expect(shots.some((s) => s.hits > 1)).toBe(true);
    const dead = eventsOf(ev, 'died').filter((d) => d.by === u.id);
    expect(dead.length).toBeGreaterThanOrEqual(5);
    for (const d of dead) expect(d.lethal).toBe(true);
    expect(u.skillLock).toBe(false);
  });

  it('frag grenade: kills everyone within 2.2 tiles, nobody beyond, no friendly fire', () => {
    const w = world();
    const u = ready(w, 'soldier', 7, 13);
    const cx = 7.5;
    const cy = 8.5;
    const inside: number[] = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const r = k % 2 ? 0.4 : 1.1;
      inside.push(
        frozen(w, k % 3 ? PT.student : PT.cultist, cx + Math.cos(a) * r, cy + Math.sin(a) * r),
      );
    }
    const outside = [frozen(w, PT.student, cx, cy - 4), frozen(w, PT.student, cx - 2.4, cy + 3)];
    // A blockade in the blast (not rammable, the frozen crowd doesn't hit it).
    const cop = w.deploy('blockade', 7, 9)!;
    const hp = cop.hp;
    w.step();
    w.events.drain();
    expect(w.useAbility(u.id)).toBe(true);
    const used = eventsOf(w.events.drain(), 'skillUsed')[0]!;
    expect(used.skill).toBe('fragGrenade');
    expect(Math.hypot(used.x1 - cx, used.y1 - cy)).toBeLessThan(1.1);
    expect(used.impactAt).toBeCloseTo(
      fragTime(
        Math.hypot(used.x1 - used.x0, used.y1 - used.y0),
        abilityOf(UNITS.soldier, 'fragGrenade')!,
      ),
    );
    // Nothing before the fuse, everything at once after.
    run(w, used.impactAt - 0.1);
    expect(inside.every((s) => alive(w, s))).toBe(true);
    const ev = run(w, 0.3);
    const hit = eventsOf(ev, 'skillHit')[0]!;
    expect(hit).toMatchObject({ skill: 'fragGrenade', radius: 2.2 });
    const d2 = (s: number): number => Math.hypot(w.crowd.x[s]! - hit.x, w.crowd.y[s]! - hit.y);
    for (const s of inside) expect(alive(w, s)).toBe(false);
    for (const s of outside) if (alive(w, s)) expect(d2(s)).toBeGreaterThan(2.2);
    expect(outside.some((s) => alive(w, s))).toBe(true);
    expect(hit.kills).toBe(inside.length);
    expect(cop.hp).toBe(hp);
    expect(cop.alive).toBe(true);
  });

  it('missile: player-aimed within 16 tiles, 4.5-tile blast, far more damage than the gun', () => {
    const w = world();
    const t = ready(w, 'tank', 7, 13);
    const ab = abilityOf(UNITS.tank, 'missile')!;
    expect(ab.damage).toBeGreaterThan(UNITS.tank.attack!.damage * 2);
    // Out of range (and off the map): refused, charge kept.
    expect(w.useAbility(t.id, { x: t.x, y: t.y - 17 })).toBe(false);
    expect(t.abilityReady).toBe(true);
    const tx = 7.5;
    const ty = 6.5;
    const inside = [0, 1.5, 3, 4.2].map((r, k) =>
      frozen(w, PT.cultist, tx + (k % 2 ? r : -r) * 0.6, ty + r * 0.8),
    );
    const outside = frozen(w, PT.student, tx, ty - 5);
    const cop = w.deploy('blockade', 8, 7)!;
    const hp = cop.hp;
    t.cd = 999; // keep the main gun (which has friendly fire) out of it
    w.step();
    w.events.drain();
    expect(w.useAbility(t.id, { x: tx, y: ty })).toBe(true);
    const used = eventsOf(w.events.drain(), 'skillUsed')[0]!;
    expect(used).toMatchObject({ skill: 'missile', x1: tx, y1: ty, radius: 4.5 });
    expect(used.impactAt).toBeCloseTo(missileTime(Math.hypot(tx - t.x, ty - t.y)));
    const ev = run(w, used.impactAt + 0.1);
    // (The tank's own gun may have dropped one meanwhile.)
    expect(eventsOf(ev, 'skillHit')[0]!.kills).toBeGreaterThanOrEqual(3);
    for (const s of inside) expect(alive(w, s)).toBe(false);
    expect(alive(w, outside)).toBe(true);
    expect(cop.hp).toBe(hp);
    expect(t.hp).toBe(t.maxHp);
  });

  it('air strike: impacts walk the painted line and kill everything within 1.2 tiles', () => {
    const w = world();
    const h = ready(w, 'heli', 12, 3);
    const ab = abilityOf(UNITS.heli, 'airStrike')!;
    // A line down the avenue (x = 6.5, y 3 → 13).
    const near = [4, 6, 8, 10, 12].map((y, k) =>
      frozen(w, PT.cultist, 6.5 + (k % 2 ? 1.1 : -1.1), y),
    );
    const far = [frozen(w, PT.student, 8.4, 7), frozen(w, PT.student, 6.5, 14.6)];
    const cop = w.deploy('blockade', 6, 8)!;
    const hp = cop.hp;
    w.step();
    w.events.drain();
    expect(w.useAbility(h.id, { path: [6.5, 3, 6.5, 13] })).toBe(true);
    const used = eventsOf(w.events.drain(), 'skillUsed')[0]!;
    expect(used.skill).toBe('airStrike');
    expect(used.path).toEqual([6.5, 3, 6.5, 13]);
    const n = strikeImpacts(10, ab);
    const ev = run(w, used.dur + 0.2);
    const hits = eventsOf(ev, 'skillHit');
    expect(hits).toHaveLength(n);
    // On the recipe's timings: lead + k × cadence (±1 tick).
    const t0 = hits[0]!.tick;
    for (const [k, e] of hits.entries()) {
      expect(e.index).toBe(k);
      expect(Math.abs((e.tick - t0) / 30 - k * ab.cadence)).toBeLessThanOrEqual(1 / 30 + 1e-9);
    }
    for (const s of near) expect(alive(w, s)).toBe(false);
    for (const s of far) expect(alive(w, s)).toBe(true);
    expect(cop.hp).toBe(hp);
    // The helicopter flew the run and is free again.
    expect(h.skillLock).toBe(false);
    expect(h.y).toBeGreaterThan(13);
    expect(eventsOf(ev, 'skillEnded')).toHaveLength(1);
  });

  it('air strike: lines are cut at 14 tiles; too short is refused', () => {
    const w = world();
    const ab = abilityOf(UNITS.heli, 'airStrike')!;
    const long = strikePath(w, [1, 3, 1, 16, 14, 16], ab)!;
    expect(long.total).toBeCloseTo(14);
    expect(long.pts.slice(-2)[0]).toBeCloseTo(2);
    expect(strikePath(w, [5, 5, 5.5, 5.5], ab)).toBeNull();
    const h = ready(w, 'heli', 12, 3);
    expect(w.useAbility(h.id, { path: [5, 5, 5.5, 5.5] })).toBe(false);
    expect(w.useAbility(h.id)).toBe(false); // no line: needs aiming
    expect(h.abilityReady).toBe(true);
  });

  it('G fires only the auto skills; the bots also aim the missile and the air strike', () => {
    const w = world();
    const t = ready(w, 'tank', 7, 13);
    const h = ready(w, 'heli', 12, 3);
    for (let k = 0; k < 30; k++)
      frozen(w, PT.student, 6 + (k % 6) * 0.5, 6 + Math.floor(k / 6) * 0.5);
    w.step();
    w.events.drain();
    expect(w.useAllAbilities()).toBe(0);
    expect(w.useAllAbilities(true)).toBe(2);
    expect(t.abilityReady || h.abilityReady).toBe(false);
  });
});

describe('special skills: determinism', () => {
  it('the same command sequence gives the same state hash', () => {
    const play = (): number => {
      const w = world();
      w.startWaves();
      const units = [
        ready(w, 'mounted', 7, 12),
        ready(w, 'armed', 6, 12),
        ready(w, 'soldier', 8, 13),
        ready(w, 'tank', 7, 13),
        ready(w, 'heli', 12, 3),
      ];
      for (let k = 0; k < 24; k++) frozen(w, PT.student, 5.5 + (k % 5), 4 + Math.floor(k / 5));
      run(w, 0.5);
      for (const u of units.slice(0, 3)) w.useAbility(u.id);
      w.useAbility(units[3]!.id, { x: 7.5, y: 6 });
      w.useAbility(units[4]!.id, { path: [5.5, 3, 9.5, 9, 9.5, 12] });
      run(w, 6);
      return w.stateHash();
    };
    expect(play()).toBe(play());
  });
});
