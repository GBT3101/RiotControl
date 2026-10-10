/**
 * Playtest feedback round (docs/M12.md): Hate from kills paid 1 per 3, base protesters survive
 * one rubber ball, outnumbered units are rammed over (grouping is the counterplay), and
 * climbers go for isolated, busy snipers.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { DMG } from '../src/data/damage';
import { PROTESTERS, PT } from '../src/data/protesters';
import { UNITS } from '../src/data/units';
import { hurtUnit, killProtester } from '../src/sim/combat';
import type { SimEvent } from '../src/sim/events';
import { mobMultiplier } from '../src/sim/mob';
import type { World } from '../src/sim/world';
import { avenueWorld, eventsOf } from './sim-fixtures';

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

/** `n` protesters in a ring of radius `r` around (x, y), stunned in place. */
function ring(w: World, type: number, n: number, x: number, y: number, r: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const s = w.spawnProtester(type, x + Math.cos(a) * r, y + Math.sin(a) * r);
    w.crowd.stun[s] = 1000;
    w.crowd.hp[s] = w.crowd.maxHp[s] = 1e6;
    out.push(s);
  }
  return out;
}

describe('Hate economy (playtest round)', () => {
  it('ordinary kills pay 1 Hate per 3 (one pickup every third kill); Breta pays in full', () => {
    const w = avenueWorld();
    expect(BALANCE.protestersPerHate).toBe(3);
    const kill = (type: number) => {
      const s = w.spawnProtester(type, 7.5, 7.5);
      killProtester(w, s, DMG.melee, false, -1);
    };
    const hate0 = w.hate;
    const gained: number[] = [];
    for (let k = 1; k <= 7; k++) {
      kill(k % 2 ? PT.student : PT.woke);
      gained.push(w.hate - hate0);
    }
    expect(gained).toEqual([0, 0, 1, 1, 1, 2, 2]);
    expect(w.economy.killTally).toBe(1);
    expect(w.economy.killTallyFraction).toBeCloseTo(1 / 3);
    // Breta is a special event: +100 on the spot, the tally is untouched.
    kill(PT.breta);
    expect(w.hate - hate0).toBe(102);
    expect(w.economy.killTally).toBe(1);
    kill(PT.paparazzi);
    kill(PT.paparazzi);
    expect(w.hate - hate0).toBe(103);
    const pickups = eventsOf(w.events.drain(), 'hateGained');
    expect(pickups.map((e) => e.amount)).toEqual([1, 1, 100, 1]);
    expect(w.stats.hateEarned).toBe(103);
  });

  it('only Breta is a bounty; every other type feeds the tally', () => {
    for (const p of PROTESTERS) expect(p.bounty === true, p.id).toBe(p.id === 'breta');
  });

  it('an own unit death pays +1 Hate', () => {
    expect(BALANCE.hatePerUnitDeath).toBe(1);
    const w = avenueWorld();
    const riot = w.deploy('riot', 7, 9)!;
    const hate = w.hate;
    hurtUnit(w, riot, 1e6, DMG.melee, true, 'protester', -1);
    expect(w.hate).toBe(hate + 1);
  });
});

describe('rubber balls (playtest round)', () => {
  it('Student and Violent Woke survive exactly one rubber ball, from full health, every time', () => {
    const ball = UNITS.sniper.attack!;
    expect(ball.dmgType).toBe('rubber');
    expect(ball.spread ?? 0).toBe(0);
    expect(ball.splash).toBeUndefined();
    expect(ball.pierce ?? 1).toBe(1);
    for (const id of ['student', 'woke'] as const) {
      const p = PROTESTERS[PT[id]]!;
      const hit = ball.damage * (1 - (p.resist?.rubber ?? 0));
      expect(p.hp, id).toBeGreaterThan(hit);
      expect(p.hp, id).toBeLessThanOrEqual(2 * hit);
    }
  });

  it('in the sim: the first ball leaves them standing, the second drops them (KO)', () => {
    for (const type of [PT.student, PT.woke]) {
      const w = avenueWorld();
      w.economy.level = 1;
      const sniper = w.deploy('sniper', 11, 5)!;
      const s = w.spawnProtester(type, 7.5, 6.5);
      w.crowd.stun[s] = 1000;
      const h = w.crowd.handle(s);
      const shots = (ev: SimEvent[]) =>
        eventsOf(ev, 'fired').filter((f) => f.shooterId === sniper.id).length;
      let ev = run(w, 5, (e) => shots(e) >= 1);
      expect(shots(ev)).toBe(1);
      expect(w.crowd.resolve(h)).toBe(s);
      expect(w.crowd.hp[s]).toBeCloseTo(PROTESTERS[type]!.hp - UNITS.sniper.attack!.damage);
      ev = run(w, 5, (e) => shots(e) >= 1);
      expect(w.crowd.resolve(h)).toBe(-1);
      const died = eventsOf(ev, 'died').find((d) => d.handle === h)!;
      expect(died).toMatchObject({ cause: 'rubber', lethal: false, by: sniper.id });
    }
  });
});

describe('outnumbering (playtest round)', () => {
  it('multiplier: softer below the hold, harder beyond it, clamped', () => {
    const m = BALANCE.mob;
    expect(mobMultiplier(0, 3)).toBe(m.minMult);
    expect(mobMultiplier(3, 3)).toBe(1);
    expect(mobMultiplier(5, 3)).toBeCloseTo(1 + m.slope * 2);
    expect(mobMultiplier(100, 3)).toBe(m.maxMult);
  });

  it('a lone officer in a mob takes far harder blows than one in a tight group', () => {
    const blow = (group: boolean): number => {
      const w = avenueWorld();
      const u = w.deploy('riot', 7, 9)!;
      if (group) {
        w.deploy('riot', 6, 9);
        w.deploy('riot', 8, 9);
      }
      ring(w, PT.student, 6, 7.5, 9.5, 0.9);
      run(w, 0.2); // one outnumbering pass
      const hp = u.hp;
      hurtUnit(w, u, 10, DMG.melee, true, 'protester', -1);
      return hp - u.hp;
    };
    const lone = blow(false);
    const grouped = blow(true);
    const base = 10 * (1 - UNITS.riot.armour.melee!);
    expect(lone).toBeGreaterThan(base * 1.5);
    expect(grouped).toBeLessThan(base);
    expect(lone / grouped).toBeGreaterThan(2.5);
  });

  it('protester ranged hits are not scaled; only melee is', () => {
    const w = avenueWorld();
    const u = w.deploy('riot', 7, 9)!;
    ring(w, PT.student, 8, 7.5, 9.5, 0.9);
    run(w, 0.2);
    expect(u.mob).toBeGreaterThan(1);
    const hp = u.hp;
    hurtUnit(w, u, 10, DMG.bullet, true, 'protester', -1);
    expect(hp - u.hp).toBeCloseTo(10 * (1 - UNITS.riot.armour.bullet!));
  });

  it('a lone officer swamped by a mob is rammed over (crush hits, knocked down); a group is not', () => {
    const rams = (group: boolean) => {
      const w = avenueWorld();
      const u = w.deploy('riot', 7, 9)!;
      u.hp = u.maxHp = 1e6;
      if (group) {
        for (const i of [6, 8]) {
          for (const j of [8, 9, 10]) {
            const o = w.deploy('riot', i, j);
            if (o) o.hp = o.maxHp = 1e6;
          }
        }
      }
      ring(w, PT.student, 10, 7.5, 9.5, 1.0);
      const ev = run(w, 20);
      const crush = eventsOf(ev, 'attacked').filter(
        (a) => a.targetId === u.id && a.dmgType === 'crush',
      );
      return { crush, rammedAt: u.rammedAt, stats: w.stats.officersRammed };
    };
    const lone = rams(false);
    expect(lone.crush.length).toBeGreaterThan(0);
    expect(lone.crush[0]).toMatchObject({ attackerKind: 'protester', targetKind: 'unit' });
    expect(lone.crush[0]!.damage).toBeCloseTo(UNITS.riot.hp * BALANCE.mob.ramDamage);
    expect(lone.rammedAt).toBeGreaterThan(0);
    expect(lone.stats).toBe(lone.crush.length);
    const grouped = rams(true);
    expect(grouped.crush).toHaveLength(0);
  });
});

describe('rooftop climbers (playtest round)', () => {
  it('a busy, isolated sniper draws climbers from further away as it keeps shooting', () => {
    const w = avenueWorld();
    w.economy.level = 1;
    const sniper = w.deploy('sniper', 11, 5)!;
    // A Violent Woke across the avenue, beyond the base reach, standing still.
    const s = w.spawnProtester(PT.woke, 5.5, 6.5);
    w.crowd.stun[s] = 1000;
    w.crowd.hp[s] = w.crowd.maxHp[s] = 1e6;
    run(w, 1);
    expect(w.roofClimbers[sniper.building]).toBe(0);
    const ev = run(w, 25, () => w.roofClimbers[sniper.building]! > 0);
    expect(sniper.rage).toBeGreaterThan(1);
    expect(w.roofClimbers[sniper.building]).toBe(1);
    expect(eventsOf(ev, 'fired').some((f) => f.shooterId === sniper.id)).toBe(true);
  });

  it('isolated roofs take up to 4 climbers; a roof with ground cover nearby only 1', () => {
    const peak = (covered: boolean) => {
      const w = avenueWorld();
      w.economy.level = 1;
      if (covered) {
        // 3–6 tiles from the footprint: cover, not a guard.
        const r = w.deploy('riot', 6, 11)!;
        r.hp = r.maxHp = 1e6;
      }
      const sniper = w.deploy('sniper', 11, 5)!;
      sniper.rage = 100;
      for (let k = 0; k < 8; k++) {
        const s = w.spawnProtester(PT.woke, 9.3, 4.5 + k * 0.4);
        w.crowd.hp[s] = w.crowd.maxHp[s] = 1e6;
      }
      let max = 0;
      for (let k = 0; k < 30 * 8; k++) {
        w.step();
        w.events.drain();
        max = Math.max(max, w.roofClimbers[sniper.building]!);
      }
      return { max, covered: w.roofCovered[sniper.building] };
    };
    const lone = peak(false);
    expect(lone.covered).toBe(0);
    expect(lone.max).toBeGreaterThan(1);
    expect(lone.max).toBeLessThanOrEqual(BALANCE.maxClimbersIsolated);
    const cov = peak(true);
    expect(cov.covered).toBe(1);
    expect(cov.max).toBeLessThanOrEqual(BALANCE.maxClimbersPerRoof);
  });

  it('a sniper cannot shoot down its own facade', () => {
    const w = avenueWorld();
    w.economy.level = 1;
    const sniper = w.deploy('sniper', 11, 5)!;
    const s = w.spawnProtester(PT.woke, 10.7, 6.5);
    w.crowd.hp[s] = w.crowd.maxHp[s] = 1e6;
    const ev = run(w, 10, (e) => eventsOf(e, 'climbStart').length > 0);
    expect(eventsOf(ev, 'climbStart')).toHaveLength(1);
    const hp = w.crowd.hp[s]!;
    run(w, 1.5);
    expect(w.crowd.hp[s]).toBe(hp);
    expect(sniper.alive).toBe(true);
  });
});
