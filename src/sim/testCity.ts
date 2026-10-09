/**
 * Synthetic 72×72 city (MapData) for headless runs, tests and benchmarks — independent of the
 * real M2 blueprints. A grid of 4-wide avenues with sidewalks, 2-wide cobbled side streets,
 * city blocks filled with 2–6 storey buildings (doors on the street side, most have usable
 * rooftops), a park, a central plaza with the Capitol (9×7, steps on its +j front) and five
 * residential spawn districts along the map edges.
 */
import { Rng } from '../core/rng';
import {
  groundId,
  type BuildingData,
  type MapData,
  type SpawnDistrict,
  type TilePos,
} from '../maps/contract';

export interface TestCityOptions {
  seed?: number;
}

const SIZE = 72;
/** Avenue bands [p, p+4) along both axes. */
const AVENUES = [6, 22, 46, 62];
/** Narrow cobbled streets [p, p+2) along both axes. */
const STREETS = [15, 55];

export function buildTestCity(opts: TestCityOptions = {}): MapData {
  const rng = new Rng(opts.seed ?? 7).fork('testcity');
  const w = SIZE;
  const h = SIZE;
  const n = w * h;
  const ground = new Uint8Array(n);
  const marking = new Uint8Array(n);
  const building = new Int16Array(n).fill(-1);
  const LOT = groundId('lot');
  const ASPHALT = groundId('asphalt');
  const SIDEWALK = groundId('sidewalk');
  const COBBLE = groundId('cobble');
  const PLAZA = groundId('plaza');
  const STEPS = groundId('steps');
  const GRASS = groundId('grass');
  const PATH = groundId('parkPath');

  const onAvenue = (x: number): boolean => AVENUES.some((p) => x >= p && x < p + 4);
  const onSidewalk = (x: number): boolean => AVENUES.some((p) => x === p - 1 || x === p + 4);
  const onStreet = (x: number): boolean => STREETS.some((p) => x >= p && x < p + 2);
  const idx = (i: number, j: number): number => j * w + i;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let g = LOT;
      if (onAvenue(i) || onAvenue(j)) g = ASPHALT;
      else if (onSidewalk(i) || onSidewalk(j)) g = SIDEWALK;
      else if (onStreet(i) || onStreet(j)) g = COBBLE;
      ground[idx(i, j)] = g;
    }
  }

  // Central plaza (block 27..44) with the Capitol.
  const cap = { i: 31, j: 29, w: 9, d: 7 };
  for (let j = 27; j < 45; j++) for (let i = 27; i < 45; i++) ground[idx(i, j)] = PLAZA;
  for (let j = cap.j; j < cap.j + cap.d; j++) {
    for (let i = cap.i; i < cap.i + cap.w; i++) ground[idx(i, j)] = LOT;
  }
  const steps: TilePos[] = [];
  for (let i = cap.i; i < cap.i + cap.w; i++) {
    ground[idx(i, cap.j + cap.d)] = STEPS;
    steps.push({ i, j: cap.j + cap.d });
  }

  // Park block (51..60 × 27..44): grass with a gravel path.
  for (let j = 27; j < 45; j++) {
    for (let i = 51; i < 61; i++) {
      if (onStreet(i) || onStreet(j)) continue;
      ground[idx(i, j)] = i === 53 || j === 35 ? PATH : GRASS;
    }
  }

  // Buildings: tile remaining lot cells (outside the plaza/capitol) into 3–5 tile footprints.
  const buildings: BuildingData[] = [];
  const isFreeLot = (i: number, j: number): boolean =>
    i >= 0 &&
    j >= 0 &&
    i < w &&
    j < h &&
    ground[idx(i, j)] === LOT &&
    building[idx(i, j)] === -1 &&
    !(i >= 27 && i < 45 && j >= 27 && j < 45);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!isFreeLot(i, j)) continue;
      let bw = rng.int(3, 5);
      let bd = rng.int(3, 5);
      // Shrink to the free lot run.
      let maxW = 0;
      while (maxW < bw && isFreeLot(i + maxW, j)) maxW++;
      bw = maxW;
      let maxD = 0;
      while (maxD < bd) {
        let ok = true;
        for (let a = 0; a < bw; a++) if (!isFreeLot(i + a, j + maxD)) ok = false;
        if (!ok) break;
        maxD++;
      }
      bd = maxD;
      // Avoid 1-tile slivers: extend into a neighbour-free remainder if it would be < 2.
      const id = buildings.length;
      for (let b = 0; b < bd; b++) for (let a = 0; a < bw; a++) building[idx(i + a, j + b)] = id;
      const doors: TilePos[] = [];
      const cand: TilePos[] = [];
      for (let a = 0; a < bw; a++) {
        cand.push({ i: i + a, j: j + bd });
        cand.push({ i: i + a, j: j - 1 });
      }
      for (let b = 0; b < bd; b++) {
        cand.push({ i: i + bw, j: j + b });
        cand.push({ i: i - 1, j: j + b });
      }
      for (const p of cand) {
        if (p.i < 0 || p.j < 0 || p.i >= w || p.j >= h) continue;
        const g = ground[idx(p.i, p.j)]!;
        if (g !== LOT && g !== STEPS) doors.push(p);
      }
      rng.shuffle(doors);
      const storeys = rng.int(2, 6);
      buildings.push({
        id,
        i,
        j,
        w: bw,
        d: bd,
        storeys,
        style: 'madrid',
        kind: 'residential',
        roof: rng.pick(['flat', 'pitched', 'mansard', 'terrace'] as const),
        rooftop: doors.length > 0 && bw * bd >= 4 && storeys >= 3,
        doors: doors.slice(0, 2),
        seed: rng.nextU32(),
      });
    }
  }

  // Spawn districts along the edges (blocks touching the outer bands).
  const district = (
    name: string,
    unlockWave: number,
    pred: (b: BuildingData) => boolean,
    rally: TilePos,
  ): SpawnDistrict => ({
    id: name.toLowerCase(),
    name,
    unlockWave,
    buildingIds: buildings.filter((b) => b.doors.length > 0 && pred(b)).map((b) => b.id),
    rally,
  });
  const spawns: SpawnDistrict[] = [
    district('North', 1, (b) => b.j < 5 && b.i >= 11 && b.i < 45, { i: 24, j: 8 }),
    district('West', 1, (b) => b.i < 5 && b.j >= 11 && b.j < 61, { i: 8, j: 36 }),
    district('South', 2, (b) => b.j >= 67 && b.i >= 11, { i: 36, j: 64 }),
    district('East', 3, (b) => b.i >= 67 && b.j >= 11, { i: 64, j: 36 }),
    district('Corner', 4, (b) => b.i < 5 && b.j < 5, { i: 8, j: 8 }),
  ];

  return {
    city: 'madrid',
    name: 'Test City',
    w,
    h,
    ground,
    marking,
    building,
    buildings,
    capitol: { ...cap, steps },
    landmarks: [],
    spawns,
    streets: [],
    decor: [],
    chokepoints: [],
    cameraStart: { i: 35, j: 40 },
  };
}
