import { describe, expect, it } from 'vitest';
import { DMG } from '../src/data/damage';
import { PT } from '../src/data/protesters';
import { hurtUnit, killProtester } from '../src/sim/combat';
import { gainLegit } from '../src/sim/economy';
import { avenueWorld, eventsOf } from './sim-fixtures';

describe('economy & progression', () => {
  it('starts at 100 Hate, 0 Legitimacy, level 0', () => {
    const w = avenueWorld();
    expect([w.hate, w.legit, w.level]).toEqual([100, 0, 0]);
    expect(w.capitol.integrity).toBe(1);
  });

  it('protester deaths pay 1 Hate per 3 (Breta +100 on the spot, paparazzi count as 1)', () => {
    const w = avenueWorld();
    const a = w.spawnProtester(PT.student, 7.5, 6.5);
    const b = w.spawnProtester(PT.breta, 7.5, 7.5);
    const p = w.spawnProtester(PT.paparazzi, 6.5, 7.5);
    const q = w.spawnProtester(PT.woke, 6.5, 6.5);
    expect(w.bretaSlot).toBe(b);
    killProtester(w, a, DMG.melee, false, -1);
    expect(w.hate).toBe(100);
    killProtester(w, b, DMG.bullet, true, -1);
    expect(w.hate).toBe(200);
    expect(w.bretaSlot).toBe(-1);
    killProtester(w, p, DMG.bullet, true, -1);
    expect(w.hate).toBe(200);
    killProtester(w, q, DMG.bullet, true, -1);
    expect(w.hate).toBe(201);
    const ev = w.events.drain();
    const died = eventsOf(ev, 'died');
    expect(died.map((d) => [d.ptype, d.lethal])).toEqual([
      ['student', false],
      ['breta', true],
      ['paparazzi', true],
      ['woke', true],
    ]);
    expect(eventsOf(ev, 'hateGained').map((e) => e.amount)).toEqual([100, 1]);
    expect(w.stats.bretaDowned).toBe(1);
    expect(w.stats.protestersKO).toBe(1);
    expect(w.stats.protestersKilled).toBe(3);
    expect(w.bodies.count).toBe(4);
  });

  it('own unit deaths pay +1 Hate and the unit Legitimacy (blockades count)', () => {
    const w = avenueWorld();
    const riot = w.deploy('riot', 6, 8)!;
    expect(w.hate).toBe(97);
    hurtUnit(w, riot, 1e6, DMG.melee, true, 'protester', -1);
    expect(riot.alive).toBe(false);
    expect(w.hate).toBe(98);
    expect(w.legit).toBe(5);
    w.economy.level = 2;
    w.economy.hate = 100;
    const bl = w.deploy('blockade', 7, 9)!;
    expect(bl).not.toBeNull();
    hurtUnit(w, bl, 1e6, DMG.melee, true, 'protester', -1);
    expect(w.legit).toBe(15);
    expect(w.hate).toBe(100 - 4 + 1);
    const ev = w.events.drain();
    expect(eventsOf(ev, 'unitDied').map((e) => e.unit)).toEqual(['riot', 'blockade']);
    expect(eventsOf(ev, 'legitGained').map((e) => e.amount)).toEqual([5, 10]);
    expect(w.stats.officersLost.riot).toBe(1);
    expect(w.stats.hateSpent).toBe(3 + 4);
  });

  it('Sniper Brigade: +1 Hate per member, Legitimacy when the squad is gone', () => {
    const w = avenueWorld();
    w.economy.level = 8;
    w.economy.hate = 600;
    const u = w.deploy('brigade', 11, 5)!;
    expect(u.members).toBe(3);
    const hate0 = w.hate;
    hurtUnit(w, u, 1000, DMG.explosion, true, 'protester', -1);
    expect(u.alive).toBe(true);
    expect(u.members).toBe(2);
    expect(w.hate).toBe(hate0 + 1);
    expect(w.legit).toBe(0);
    hurtUnit(w, u, 1000, DMG.explosion, true, 'protester', -1);
    hurtUnit(w, u, 1000, DMG.explosion, true, 'protester', -1);
    expect(u.alive).toBe(false);
    expect(w.legit).toBe(80);
    expect(w.stats.officersLost.brigade).toBe(3);
  });

  it('level-ups at the thresholds unlock units and protester types', () => {
    const w = avenueWorld();
    gainLegit(w, 9, 0, 0, 'riot');
    expect(w.level).toBe(0);
    gainLegit(w, 1, 0, 0, 'riot');
    expect(w.level).toBe(1);
    gainLegit(w, 95, 0, 0, 'riot'); // 105 → level 4 (skips 2, 3)
    expect(w.level).toBe(4);
    const ups = eventsOf(w.events.drain(), 'levelUp');
    expect(ups.map((e) => e.level)).toEqual([1, 2, 3, 4]);
    expect(ups[1]).toMatchObject({ units: ['blockade'], protesters: ['mob'] });
    expect(ups[3]).toMatchObject({ units: ['mounted'], protesters: ['veryViolent'] });
    expect(w.canDeploy('mounted', 6, 8).reason).not.toBe('locked');
    expect(w.canDeploy('armed', 6, 8).reason).toBe('locked');
  });

  it('5000 Legitimacy → victory with a stats ledger; the sim stops', () => {
    const w = avenueWorld();
    w.spawnProtester(PT.student, 7.5, 5.5);
    w.stats.protestersFallen.student = 12;
    gainLegit(w, 5000, 0, 0, 'tank');
    expect(w.phase).toBe('victory');
    const v = eventsOf(w.events.drain(), 'victory');
    expect(v).toHaveLength(1);
    expect(v[0]!.stats.protestersFallen.student).toBe(12);
    expect(v[0]!.stats.level).toBe(10);
    const tick = w.tick;
    w.step();
    expect(w.tick).toBe(tick);
    expect(w.deploy('riot', 6, 8)).toBeNull();
  });
});
