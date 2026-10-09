import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { PT } from '../src/data/protesters';
import { Capitol } from '../src/sim/capitol';
import { PS } from '../src/sim/crowd';
import type { SimEvent } from '../src/sim/events';
import { avenueWorld, eventsOf } from './sim-fixtures';

describe('capitol', () => {
  it('protesters reaching the steps attack it and stay there', () => {
    const w = avenueWorld();
    const s = w.spawnProtester(PT.woke, 7.5, 12.5);
    const ev: SimEvent[] = [];
    for (let k = 0; k < 30 * 8; k++) {
      w.step();
      ev.push(...w.events.drain());
    }
    expect(w.crowd.state[s]).toBe(PS.CAPITOL);
    expect(w.crowd.y[s]).toBeGreaterThan(13.5);
    expect(w.capitol.attackers).toBe(1);
    // Woke: 2 integrity HP per second.
    expect(w.capitol.hp).toBeLessThan(BALANCE.capitolHp);
    expect(w.capitol.hp).toBeGreaterThan(BALANCE.capitolHp - 20);
    const dmg = eventsOf(ev, 'capitolDamaged');
    expect(dmg.length).toBeGreaterThan(0);
    expect(dmg.reduce((a, e) => a + e.amount, 0)).toBeCloseTo(BALANCE.capitolHp - w.capitol.hp);
  });

  it('five damage states by integrity thresholds', () => {
    expect(Capitol.stateFor(1)).toBe(0);
    expect(Capitol.stateFor(0.89)).toBe(1);
    expect(Capitol.stateFor(0.69)).toBe(2);
    expect(Capitol.stateFor(0.49)).toBe(3);
    expect(Capitol.stateFor(0.29)).toBe(4);
    expect(Capitol.stateFor(0.05)).toBe(5);
    expect(BALANCE.capitolDamageThresholds).toHaveLength(5);
  });

  it('integrity 0 → defeat event with stats; the sim stops', () => {
    const w = avenueWorld();
    w.capitol.hp = 30;
    for (let k = 0; k < 10; k++) w.spawnProtester(PT.mob, 5.5 + (k % 5), 13 + (k >> 2) * 0.4);
    const ev: SimEvent[] = [];
    for (let k = 0; k < 30 * 10 && w.phase === 'playing'; k++) {
      w.step();
      ev.push(...w.events.drain());
    }
    expect(w.phase).toBe('defeat');
    expect(w.capitol.integrity).toBe(0);
    expect(w.capitol.state).toBe(5);
    const states = eventsOf(ev, 'capitolState').map((e) => e.state);
    expect(states[states.length - 1]).toBe(5);
    const def = eventsOf(ev, 'defeat');
    expect(def).toHaveLength(1);
    expect(def[0]!.stats.capitolIntegrity).toBe(0);
    expect(def[0]!.stats.capitolDamage).toBeGreaterThan(0);
    const t = w.tick;
    w.step();
    expect(w.tick).toBe(t);
  });
});
