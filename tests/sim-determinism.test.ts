import { describe, expect, it } from 'vitest';
import { Bot, runHeadless } from '../src/sim/headless';
import { buildTestCity } from '../src/sim/testCity';
import { World } from '../src/sim/world';

function simulate(
  seed: number,
  seconds: number,
): { hash: number; spawned: number; events: number } {
  const w = new World(buildTestCity(), { seed });
  const bot = new Bot(w, 'escalate');
  w.economy.hate = 3000;
  w.economy.level = 9;
  w.startWaves();
  let events = 0;
  for (let k = 0; k < seconds * 30; k++) {
    bot.update();
    w.step();
    events += w.events.drain().length;
  }
  return { hash: w.stateHash(), spawned: w.stats.protestersSpawned, events };
}

describe('determinism', () => {
  it('same seed → identical state hash after 60 s (bot, combat, waves)', () => {
    const a = simulate(11, 60);
    const b = simulate(11, 60);
    expect(a.spawned).toBeGreaterThan(30);
    expect(a.events).toBeGreaterThan(200);
    expect(b).toEqual(a);
  });

  it('different seeds diverge', () => {
    expect(simulate(12, 20).hash).not.toBe(simulate(13, 20).hash);
  });

  it('headless runner: runs a session and reports stats', () => {
    const r = runHeadless({ seconds: 120, seed: 3, bot: 'riot' });
    expect(r.ticks).toBeGreaterThan(0);
    expect(r.wave).toBeGreaterThanOrEqual(1);
    expect(r.stats.protestersSpawned).toBeGreaterThan(0);
    expect(r.events.spawned).toBe(r.stats.protestersSpawned);
    expect(r.stats.unitsDeployed.riot).toBeGreaterThan(0);
    expect(r.avgTickMs).toBeGreaterThan(0);
    const again = runHeadless({ seconds: 120, seed: 3, bot: 'riot' });
    expect(again.hash).toBe(r.hash);
  });
});
