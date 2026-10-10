import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { waveSize } from '../src/data/balance';
import { PT } from '../src/data/protesters';
import { loadMap, CITIES } from '../src/maps';
import {
  Forecaster,
  districtRoute,
  districtSpot,
  forecastWaveIndex,
  leadType,
  routeFrom,
  threatTier,
  typesJoining,
  waveForecast,
} from '../src/sim/forecast';
import { World } from '../src/sim/world';
import { FORECAST_WAVE_SECONDS, ForecastView } from '../src/view/forecastView';
import { createViewLayers } from '../src/view/layers';
import { boxAt, edgePoint, formatCount, onScreen, overlaps } from '../src/ui/hud/forecastEdge';
import { mapFromAscii } from './sim-fixtures';

/** Two districts: A (wave 1) and B (wave 3); the Capitol steps at the bottom. */
const TWO = [
  'AAAA......BBBB',
  'AAAA......BBBB',
  '..............',
  '..............',
  'XXX________XXX',
  'XXXX__SSS__XXX',
  'XXXXXXCCCXXXXX',
];

function twoDistricts(seed = 3): World {
  const map = mapFromAscii(TWO, {
    spawns: [
      { letters: 'A', unlockWave: 1 },
      { letters: 'B', unlockWave: 3 },
    ],
  });
  return new World(map, { seed });
}

/** Put the director in the breather after `wave`. */
function breatherAfter(w: World, wave: number, seconds = 20): void {
  const d = w.director;
  d.wave = wave;
  d.phase = 'breather';
  d.breather = d.breatherTotal = seconds;
}

describe('wave forecast', () => {
  it('prep: forecasts wave 1 from the first districts, nothing is "new" yet', () => {
    const w = twoDistricts();
    expect(forecastWaveIndex(w)).toBe(1);
    const f = waveForecast(w);
    expect(f.wave).toBe(1);
    expect(f.phase).toBe('prep');
    expect(f.eta).toBe(-1);
    expect(f.size).toBe(waveSize(1, 0, 0));
    expect(f.districts.map((d) => d.district)).toEqual([0]);
    expect(f.districts[0]).toMatchObject({
      isNew: false,
      expected: f.size,
      threat: threatTier(f.size),
    });
    expect(f.newTypes).toEqual([]);
    expect(f.lead).toBeNull();
    expect(f.types).toEqual(['student', 'woke']);
  });

  it('breather: forecasts the next wave, flags districts unlocking in it as new', () => {
    const w = twoDistricts();
    breatherAfter(w, 1, 18);
    let f = waveForecast(w);
    expect(f.wave).toBe(2);
    expect(f.eta).toBe(18);
    // The wave starts when the breather ends: its size uses that clock.
    expect(f.size).toBe(waveSize(2, 0, w.time + 18));
    expect(f.districts.map((d) => [d.district, d.isNew])).toEqual([[0, false]]);
    breatherAfter(w, 2);
    f = waveForecast(w);
    expect(f.wave).toBe(3);
    expect(f.districts.map((d) => [d.district, d.isNew])).toEqual([
      [0, false],
      [1, true],
    ]);
    // Door groups pick districts uniformly: each expects an equal share.
    const share = Math.round(f.size / 2);
    for (const d of f.districts) expect(d.expected).toBe(share);
    breatherAfter(w, 3);
    expect(waveForecast(w).districts.every((d) => !d.isNew)).toBe(true);
  });

  it('during a wave: describes the current wave', () => {
    const w = twoDistricts();
    w.startWaves();
    const f = waveForecast(w);
    expect(f.wave).toBe(1);
    expect(f.phase).toBe('wave');
    expect(f.eta).toBe(0);
    expect(f.size).toBe(w.director.waveSize);
  });

  it('is read-only: forecasting never changes the simulation', () => {
    const a = twoDistricts(9);
    const b = twoDistricts(9);
    a.startWaves();
    b.startWaves();
    const fc = new Forecaster();
    for (let k = 0; k < 30 * 20; k++) {
      a.step();
      b.step();
      a.events.drain();
      b.events.drain();
      if (k % 7 === 0) {
        fc.forecast(a);
        fc.route(a, 0);
        districtRoute(a, 1);
      }
    }
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('threat tiers grow with the expected crowd', () => {
    expect(threatTier(5)).toBe(1);
    expect(threatTier(39)).toBe(1);
    expect(threatTier(40)).toBe(2);
    expect(threatTier(149)).toBe(2);
    expect(threatTier(400)).toBe(3);
  });

  it('lead type follows the director’s newest-type boost', () => {
    expect(leadType(0)).toBeNull();
    expect(leadType(1)).toBeNull();
    expect(leadType(2)).toBe('mob');
    expect(leadType(3)).toBe('mob');
    expect(leadType(4)).toBe('veryViolent');
    expect(leadType(9)).toBe('cultist');
    expect(leadType(10)).toBe('prophet');
  });

  it('types joining: unlocked since the previous wave began (basics never count)', () => {
    expect(typesJoining(-1, 0)).toEqual([]);
    expect(typesJoining(1, 2)).toEqual(['mob']);
    expect(typesJoining(2, 2)).toEqual([]);
    expect(typesJoining(3, 6)).toEqual(['veryViolent', 'crazy']);
  });

  it('Forecaster remembers the level at each wave start → new types of the next wave', () => {
    const w = twoDistricts();
    const fc = new Forecaster();
    w.startWaves();
    fc.observe(w); // wave 1 began at level 0
    breatherAfter(w, 1);
    w.economy.level = 2; // levelled up during wave 1
    let f = fc.forecast(w);
    expect(f.wave).toBe(2);
    expect(f.newTypes).toEqual(['mob']);
    expect(f.lead).toBe('mob');
    // Wave 2 starts at level 2; the breather after it has nothing new.
    w.director.phase = 'wave';
    w.director.wave = 2;
    fc.observe(w);
    breatherAfter(w, 2);
    f = fc.forecast(w);
    expect(f.newTypes).toEqual([]);
  });

  it('Breta is pinned to her district once she is out', () => {
    const w = twoDistricts();
    w.startWaves();
    const s = w.spawnProtester(PT.breta, 1.5, 2.5, { district: 0 });
    expect(s).toBeGreaterThanOrEqual(0);
    w.bretaSlot = s;
    expect(waveForecast(w).districts.find((d) => d.district === 0)?.breta).toBe(true);
  });

  it('routes descend the Capitol flow field to the steps', () => {
    const w = twoDistricts();
    for (const d of [0, 1]) {
      const r = districtRoute(w, d);
      expect(r.length).toBeGreaterThan(2);
      const spot = districtSpot(w, d)!;
      expect(r[0]).toBe(spot.j * w.map.w + spot.i);
      for (let k = 1; k < r.length; k++) {
        expect(w.nav.dist[r[k]!]!).toBeLessThan(w.nav.dist[r[k - 1]!]!);
        const a = r[k - 1]!;
        const b = r[k]!;
        // 8-connected steps.
        expect(Math.abs((a % w.map.w) - (b % w.map.w))).toBeLessThanOrEqual(1);
        expect(Math.abs(Math.floor(a / w.map.w) - Math.floor(b / w.map.w))).toBeLessThanOrEqual(1);
      }
      expect(w.nav.dist[r[r.length - 1]!]).toBe(0);
    }
    expect(routeFrom(w, 0, 0)).toEqual([]); // inside a building
    expect(routeFrom(w, -1, 3)).toEqual([]);
  });

  it('real cities: every district has a marker spot and a route to the Capitol', () => {
    for (const city of CITIES) {
      const w = new World(loadMap(city), { seed: 1 });
      const fc = new Forecaster();
      for (let d = 0; d < w.map.spawns.length; d++) {
        const r = fc.route(w, d);
        expect(r.length, `${city} ${w.map.spawns[d]!.id}`).toBeGreaterThan(5);
        expect(w.nav.dist[r[r.length - 1]!]).toBe(0);
      }
      const f = fc.forecast(w);
      expect(f.districts.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('forecast HUD placement (pure)', () => {
  const area = { x: 0, y: 30, w: 400, h: 240 };
  const ext = { left: 18, right: 18, top: 26, bottom: 26 };

  it('on-screen test uses the free area and a margin', () => {
    expect(onScreen(200, 150, area)).toBe(true);
    expect(onScreen(200, 20, area)).toBe(false);
    expect(onScreen(398, 150, area, 4)).toBe(false);
  });

  it('edge pointers sit where the ray toward the target leaves the area', () => {
    const c = { x: 200, y: 150 };
    const right = edgePoint(5000, c.y, area, ext);
    expect(right).toEqual({ x: 400 - 18, y: 150 });
    const up = edgePoint(c.x, -5000, area, ext);
    expect(up).toEqual({ x: 200, y: 30 + 26 });
    const corner = edgePoint(-5000, 5000, area, ext);
    // 45° down-left: the wide area's bottom edge comes first.
    expect(corner.y).toBe(270 - 26);
    expect(corner.x).toBeLessThan(200);
    expect(corner.x).toBeGreaterThanOrEqual(18);
  });

  it('slides along its edge to keep clear of HUD rects', () => {
    const button = { x: 150, y: 220, w: 100, h: 50 };
    const p = edgePoint(200, 5000, area, ext, [button]);
    expect(overlaps(boxAt(p.x, p.y, ext), button)).toBe(false);
    expect(p.y).toBe(270 - 26); // still on the bottom edge
    // Two pointers toward the same spot don't stack.
    const a = edgePoint(5000, 150, area, ext);
    const b = edgePoint(5000, 150, area, ext, [boxAt(a.x, a.y, ext)]);
    expect(overlaps(boxAt(a.x, a.y, ext), boxAt(b.x, b.y, ext))).toBe(false);
    expect(b.x).toBe(a.x);
  });

  it('formats head counts compactly', () => {
    expect(formatCount(3)).toBe('5');
    expect(formatCount(15)).toBe('15');
    expect(formatCount(47)).toBe('45');
    expect(formatCount(143)).toBe('140');
    expect(formatCount(1530)).toBe('1.5k');
    expect(formatCount(2000)).toBe('2k');
  });
});

describe('forecast view window', () => {
  it('marks prep, breathers and the first seconds of a wave, then fades out', () => {
    const w = twoDistricts();
    const v = new ForecastView(w, createViewLayers(new Container()));
    const tick = (n: number): void => {
      for (let k = 0; k < n; k++) v.update(w.time, 1 / 30);
    };
    tick(1);
    expect(v.alpha).toBe(0); // HUD hasn't enabled it (title backdrop)
    v.enabled = true;
    tick(10);
    expect(v.wanted).toBe(true);
    expect(v.alpha).toBe(1);
    expect(v.current?.wave).toBe(1);
    w.startWaves();
    tick(1);
    expect(v.wanted).toBe(true);
    w.time += FORECAST_WAVE_SECONDS + 0.1;
    expect(v.wanted).toBe(false);
    tick(30);
    expect(v.alpha).toBe(0);
    expect(v.current).toBeNull();
    breatherAfter(w, 1);
    tick(10);
    expect(v.alpha).toBe(1);
    expect(v.current?.wave).toBe(2);
  });
});
