/**
 * M12 balance regression — short deterministic headless scenarios on the real city maps.
 * The full 35–50 min seeds × bots × cities sweep lives in `npm run playtest` (docs/M12.md);
 * these keep the important shape of the curve from silently regressing:
 *
 * - doing nothing loses fast; a passive player loses between waves 6 and 15;
 * - a competent (balanced) player holds the Capitol through the first 15 minutes and
 *   climbs the early levels on schedule;
 * - bots are deterministic (same seed → same state hash);
 * - late waves put thousands on a real map (desktop) and the mobile cap holds.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { loadMap } from '../src/maps';
import { runHeadless } from '../src/sim/headless';
import { World } from '../src/sim/world';

const LONG = 60_000;

describe('balance scenarios (real maps, headless bots)', () => {
  it('no defence: the regime falls within the first few waves', () => {
    const r = runHeadless({ map: loadMap('madrid'), bot: 'none', seed: 1, seconds: 600 });
    expect(r.phase).toBe('defeat');
    expect(r.wave).toBeLessThanOrEqual(6);
  });

  it.each(['madrid', 'london'] as const)(
    'passive player (%s): a lone riot cop now and then is not enough — loses in waves 6–15',
    (city) => {
      const r = runHeadless({ map: loadMap(city), bot: 'passive', seed: 2, seconds: 25 * 60 });
      expect(r.phase).toBe('defeat');
      expect(r.wave).toBeGreaterThanOrEqual(6);
      expect(r.wave).toBeLessThanOrEqual(15);
    },
    LONG,
  );

  it(
    'balanced player: holds the Capitol for 15 min and climbs the early levels on schedule',
    () => {
      const r = runHeadless({ map: loadMap('paris'), bot: 'balanced', seed: 1, seconds: 15 * 60 });
      expect(r.phase).toBe('playing');
      expect(r.trace.minIntegrity).toBeGreaterThan(0.4);
      const lt = r.trace.levelTimes;
      expect(lt[1]! / 60).toBeLessThan(5); // first sniper well before the 5-minute mark
      expect(r.level).toBeGreaterThanOrEqual(4);
      expect(r.level).toBeLessThanOrEqual(8); // …but not racing to the end
      // Waves grow from dozens toward hundreds.
      expect(r.trace.waves[0]!.size).toBe(30);
      expect(r.trace.waves.at(-1)!.size).toBeGreaterThan(100);
      // Economy: not starved, not swimming in Hate.
      const hs = r.trace.hateSamples;
      const avg = hs.reduce((a, b) => a + b, 0) / hs.length;
      expect(avg).toBeGreaterThan(40);
      expect(avg).toBeLessThan(2500);
    },
    LONG,
  );

  it(
    'bots are deterministic',
    () => {
      const opts = { map: loadMap('london'), bot: 'balanced' as const, seed: 4, seconds: 5 * 60 };
      const a = runHeadless(opts);
      const b = runHeadless(opts);
      expect(b.hash).toBe(a.hash);
      expect(b.trace).toEqual(a.trace);
    },
    LONG,
  );

  it(
    'late-game wave on a real map: thousands spawn, the mobile tier caps the crowd',
    () => {
      const peak = (quality: 'mobile' | 'desktop'): { peak: number; size: number } => {
        const w = new World(loadMap('madrid'), { seed: 5, quality });
        w.economy.level = 10;
        w.time = 36 * 60; // late game: the time term of the wave curve
        w.startWaves();
        for (let k = 0; k < 29; k++) {
          w.director.toSpawn = 0;
          (w.director as unknown as { beginWave(w: World): void }).beginWave(w);
        }
        w.capitol.hp = 1e12; // undefended: keep the regime standing to measure the crowd
        let p = 0;
        let stacked = false;
        for (let k = 0; k < 30 * 80; k++) {
          if (!stacked && w.director.pending === 0) {
            // The next wave lands while the last one is still marching (as in late runs).
            stacked = true;
            (w.director as unknown as { beginWave(w: World): void }).beginWave(w);
          }
          w.step();
          w.events.drain();
          p = Math.max(p, w.crowd.count);
        }
        return { peak: p, size: w.director.waveSize };
      };
      const mobile = peak('mobile');
      expect(mobile.size).toBeGreaterThanOrEqual(1500);
      // Cap + one Breta entourage (≤ 11) may overshoot by a few.
      expect(mobile.peak).toBeLessThanOrEqual(BALANCE.concurrency.mobile + 11);
      expect(mobile.peak).toBeGreaterThan(BALANCE.concurrency.mobile * 0.8);
      const desktop = peak('desktop');
      // The horde is the spectacle: desktop is not held to the mobile cap. (Defended late runs
      // in `npm run playtest` peak at ~2000–2300 as waves stack up against the lines.)
      expect(desktop.peak).toBeGreaterThan(BALANCE.concurrency.mobile + 100);
      expect(desktop.peak).toBeLessThanOrEqual(BALANCE.concurrency.desktop + 11);
    },
    LONG,
  );
});
