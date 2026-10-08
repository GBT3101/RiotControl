/**
 * M1 placeholder test map: a 72×72 grid of avenues, sidewalks, a central plaza and city
 * blocks filled with stub buildings. Pure data (no Pixi) — replaced by real maps in M2.
 */
import { Rng } from '../core/rng';

export const Ground = { Grass: 0, Asphalt: 1, Sidewalk: 2, Plaza: 3 } as const;
export type Ground = (typeof Ground)[keyof typeof Ground];

export interface StubBuilding {
  i: number;
  j: number;
  n: number;
  storeys: number;
  style: 'ochre' | 'brick' | 'stone';
}

export interface TestMap {
  readonly size: number;
  readonly ground: Uint8Array;
  /** Road paint: '' or the diamond edge carrying a dash ('nw' | 'ne' | 'se' | 'sw'). */
  readonly dash: string[];
  readonly buildings: StubBuilding[];
  /** Per-tile seeded variant roll in [0, 1). */
  readonly roll: Float32Array;
  readonly occupied: Uint8Array;
  at(i: number, j: number): Ground | -1;
  walkable(i: number, j: number): boolean;
}

/** Avenue centre lines (tile index of the centre line) along both axes. */
const AVENUES = [12, 36, 60];
const ROAD_HALF = 2; // 4-tile carriageway
const PLAZA = { lo: 31, hi: 41 }; // central plaza, inclusive-exclusive

export function generateTestMap(seed = 1, size = 72): TestMap {
  const rng = new Rng(seed).fork('testmap');
  const ground = new Uint8Array(size * size);
  const dash: string[] = new Array<string>(size * size).fill('');
  const roll = new Float32Array(size * size);
  const occupied = new Uint8Array(size * size);
  const idx = (i: number, j: number): number => j * size + i;
  for (let k = 0; k < roll.length; k++) roll[k] = rng.next();

  const inRoad = (x: number): number => {
    for (const c of AVENUES) {
      if (x >= c - ROAD_HALF && x < c + ROAD_HALF) return c;
    }
    return -1;
  };
  const inWalk = (x: number): boolean =>
    AVENUES.some((c) => x === c - ROAD_HALF - 1 || x === c + ROAD_HALF);

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const ru = inRoad(j); // avenue running along u (constant j band)
      const rv = inRoad(i); // avenue running along v (constant i band)
      let g: Ground = Ground.Grass;
      if (ru >= 0 || rv >= 0) g = Ground.Asphalt;
      else if (inWalk(i) || inWalk(j)) g = Ground.Sidewalk;
      if (i >= PLAZA.lo && i < PLAZA.hi && j >= PLAZA.lo && j < PLAZA.hi) g = Ground.Plaza;
      ground[idx(i, j)] = g;
      if (g !== Ground.Asphalt || (ru >= 0 && rv >= 0)) continue;
      // Centre-line dashes on every other tile.
      if (ru >= 0 && i % 2 === 0) {
        if (j === ru - 1) dash[idx(i, j)] = 'sw';
        else if (j === ru) dash[idx(i, j)] = 'ne';
      }
      if (rv >= 0 && j % 2 === 0) {
        if (i === rv - 1) dash[idx(i, j)] = 'se';
        else if (i === rv) dash[idx(i, j)] = 'nw';
      }
    }
  }

  // Buildings: square boxes placed along block edges (fronting the sidewalks).
  const buildings: StubBuilding[] = [];
  const styles: StubBuilding['style'][] = ['ochre', 'brick', 'stone'];
  const sizes: Array<[number, number[]]> = [
    [2, [2, 3]],
    [3, [3, 4]],
    [4, [4, 5]],
  ];
  const free = (i: number, j: number, n: number): boolean => {
    if (i < 1 || j < 1 || i + n > size - 1 || j + n > size - 1) return false;
    for (let y = j - 1; y <= j + n; y++) {
      for (let x = i - 1; x <= i + n; x++) {
        const inside = x >= i && x < i + n && y >= j && y < j + n;
        const k = idx(x, y);
        if (inside && (ground[k] !== Ground.Grass || occupied[k])) return false;
        // Keep a 1-tile gap between buildings (alleys), but they may touch sidewalks.
        if (!inside && occupied[k]) return false;
      }
    }
    return true;
  };
  const place = (b: StubBuilding): void => {
    buildings.push(b);
    for (let y = b.j; y < b.j + b.n; y++)
      for (let x = b.i; x < b.i + b.n; x++) occupied[idx(x, y)] = 1;
  };
  const isStreetFront = (i: number, j: number, n: number): boolean => {
    for (let k = -1; k <= n; k++) {
      for (const [x, y] of [
        [i - 1, j + k],
        [i + n, j + k],
        [i + k, j - 1],
        [i + k, j + n],
      ] as const) {
        if (x >= 0 && y >= 0 && x < size && y < size && ground[idx(x, y)] === Ground.Sidewalk) {
          return true;
        }
      }
    }
    return false;
  };
  for (let attempt = 0; attempt < 4000; attempt++) {
    const [n, storeyChoices] = rng.weighted(sizes, [3, 4, 2]);
    const i = rng.int(1, size - n - 1);
    const j = rng.int(1, size - n - 1);
    if (!free(i, j, n) || !isStreetFront(i, j, n)) continue;
    place({ i, j, n, storeys: rng.pick(storeyChoices), style: rng.pick(styles) });
  }
  buildings.sort((a, b) => a.i + a.j - (b.i + b.j));

  const at = (i: number, j: number): Ground | -1 =>
    i < 0 || j < 0 || i >= size || j >= size ? -1 : (ground[idx(i, j)] as Ground);
  return {
    size,
    ground,
    dash,
    buildings,
    roll,
    occupied,
    at,
    walkable: (i, j) => {
      const g = at(i, j);
      return g === Ground.Asphalt || g === Ground.Sidewalk || g === Ground.Plaza;
    },
  };
}

/** Atlas sprite name for a tile of the test map. */
export function testMapTileName(map: TestMap, i: number, j: number): string {
  const k = j * map.size + i;
  const r = map.roll[k] ?? 0;
  switch (map.at(i, j)) {
    case Ground.Asphalt: {
      const d = map.dash[k];
      if (d) return `tile.asphalt.dash.${d}`;
      if (r < 0.05) return 'tile.asphalt.b';
      if (r < 0.07) return 'tile.asphalt.c';
      return r < 0.3 ? 'tile.asphalt.d' : 'tile.asphalt';
    }
    case Ground.Sidewalk:
      return 'tile.sidewalk';
    case Ground.Plaza:
      return (i + j) % 2 === 0 ? 'tile.plaza' : 'tile.plaza.b';
    default:
      if (r < 0.2) return 'tile.grass.b';
      if (r < 0.25) return 'tile.grass.c';
      return r < 0.4 ? 'tile.grass.d' : 'tile.grass';
  }
}
