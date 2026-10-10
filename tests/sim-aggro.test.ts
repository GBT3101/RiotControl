/**
 * Aggro (owner: "when there are soldiers or cops in range, the protesters should prioritise
 * them over the Capitol and try to kill them first"): marchers, rally crowds and the Capitol
 * mob go after ground units within `BALANCE.aggro.radius`, spread over the units nearby, and
 * gunmen shoot from stand-off range. Rooftop units and blockades are not hunted.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { PT } from '../src/data/protesters';
import { PS } from '../src/sim/crowd';
import type { SimEvent } from '../src/sim/events';
import { findPrey } from '../src/sim/prey';
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

/** Make a protester unkillable (so the officer's baton does not end the test early). */
function tough(w: World, s: number): number {
  w.crowd.hp[s] = w.crowd.maxHp[s] = 1e6;
  return s;
}

describe('aggro: protesters go after units in range', () => {
  it('a marcher passing a riot officer within range diverts and attacks it', () => {
    const w = avenueWorld();
    const riot = w.deploy('riot', 6, 9)!;
    // Far lane of the avenue, ~3.9 tiles from the officer: well outside his blocking reach.
    const s = tough(w, w.spawnProtester(PT.woke, 9.5, 7));
    const ev = run(w, 8, (e) =>
      eventsOf(e, 'attacked').some((a) => a.attackerKind === 'protester' && a.targetId === riot.id),
    );
    const hits = eventsOf(ev, 'attacked').filter(
      (a) => a.attackerKind === 'protester' && a.targetId === riot.id,
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(w.crowd.state[s]).toBe(PS.ENGAGED);
    expect(w.stats.huntsStarted).toBe(1);
    expect(riot.hp).toBeLessThan(riot.maxHp);
  });

  it('with no unit nearby it keeps marching on the Capitol', () => {
    const w = avenueWorld();
    // An officer up the avenue, behind the marcher and out of reach.
    w.deploy('riot', 6, 2);
    const s = tough(w, w.spawnProtester(PT.woke, 9.5, 7.5));
    let hunted = false;
    for (let k = 0; k < 30 * 10 && w.crowd.state[s] !== PS.CAPITOL; k++) {
      w.step();
      w.events.drain();
      if (w.crowd.state[s] === PS.HUNT || w.crowd.state[s] === PS.ENGAGED) hunted = true;
    }
    expect(hunted).toBe(false);
    expect(w.crowd.state[s]).toBe(PS.CAPITOL);
    expect(w.stats.huntsStarted).toBe(0);
  });

  it('the Capitol mob breaks off the steps for an officer in range', () => {
    const w = avenueWorld();
    const s = tough(w, w.spawnProtester(PT.mob, 7.5, 15.4));
    run(w, 1);
    expect(w.crowd.state[s]).toBe(PS.CAPITOL);
    const riot = w.deploy('riot', 5, 13)!;
    riot.hp = riot.maxHp = 1e6;
    const ev = run(w, 6, (e) =>
      eventsOf(e, 'attacked').some((a) => a.attackerKind === 'protester' && a.targetId === riot.id),
    );
    expect(eventsOf(ev, 'attacked').some((a) => a.targetId === riot.id)).toBe(true);
  });

  it('overflow spreads: with one officer busy, the next hunter picks the other', () => {
    const w = avenueWorld();
    w.economy.level = 5;
    w.economy.hate = 1000;
    // Two Armed Cops (one melee slot each), symmetric about the avenue's centre line.
    const a = w.deploy('armed', 5, 10)!;
    const b = w.deploy('armed', 9, 10)!;
    for (const u of [a, b]) u.hp = u.maxHp = 1e6;
    const first = tough(w, w.spawnProtester(PT.woke, 5.6, 9.7));
    run(w, 1);
    expect(w.crowd.engUnit[first]).toBe(a.slot);
    // Slightly nearer to the busy cop, but the free one wins.
    const second = tough(w, w.spawnProtester(PT.woke, 7.3, 6.5));
    run(w, 6);
    expect(w.crowd.engUnit[second]).toBe(b.slot);
    expect([a.nHolders, b.nHolders]).toEqual([1, 1]);
  });

  it('gunmen hold at stand-off range and shoot instead of walking into the officer', () => {
    const w = avenueWorld();
    const riot = w.deploy('riot', 6, 11)!;
    riot.hp = riot.maxHp = 1e6;
    const s = tough(w, w.spawnProtester(PT.crazy, 9.5, 7.5));
    const ev = run(w, 8);
    const shots = eventsOf(ev, 'attacked').filter(
      (e) => e.attackerKind === 'protester' && e.targetId === riot.id && e.dmgType === 'bullet',
    );
    expect(shots.length).toBeGreaterThan(0);
    expect(w.crowd.state[s]).toBe(PS.HUNT);
    const d = Math.hypot(w.crowd.x[s]! - riot.x, w.crowd.y[s]! - riot.y);
    expect(d).toBeGreaterThan(2);
  });

  it('rooftop units and blockades are not hunted on foot; disabling aggro turns it off', () => {
    const w = avenueWorld();
    w.economy.level = 6;
    w.economy.hate = 1000;
    w.deploy('sniper', 12, 6);
    w.deploy('blockade', 7, 9);
    w.step();
    expect(findPrey(w, 9.5, 6.5)).toBeNull();
    const riot = w.deploy('riot', 9, 6)!;
    w.step();
    expect(findPrey(w, 9.5, 8.5)).toBe(riot);
    const r = BALANCE.aggro.radius;
    (BALANCE.aggro as { radius: number }).radius = 0;
    try {
      expect(findPrey(w, 9.5, 8.5)).toBeNull();
    } finally {
      (BALANCE.aggro as { radius: number }).radius = r;
    }
  });
});
