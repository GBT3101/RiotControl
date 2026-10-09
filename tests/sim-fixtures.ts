/**
 * Synthetic MapData fixtures for the simulation tests (independent of the M2 blueprints).
 *
 * ASCII legend (row = j, column = i):
 *   .  asphalt        ,  sidewalk       :  cobble        _  plaza       "  grass
 *   S  capitol steps  C  capitol lot    ~  water          X  lot (no building)
 *   A–Z / a–z  building footprints (same letter = same building, rooftop: true)
 */
import {
  groundId,
  type BuildingData,
  type MapData,
  type SpawnDistrict,
  type TilePos,
} from '../src/maps/contract';
import type { SimEvent } from '../src/sim/events';
import { World, type WorldOptions } from '../src/sim/world';

export interface FixtureOpts {
  /** Spawn districts: building letters + unlock wave. */
  spawns?: { letters: string; unlockWave: number }[];
  storeys?: number;
}

const G: Record<string, number> = {
  '.': groundId('asphalt'),
  ',': groundId('sidewalk'),
  ':': groundId('cobble'),
  _: groundId('plaza'),
  '"': groundId('grass'),
  S: groundId('steps'),
  C: groundId('lot'),
  '~': groundId('water'),
  X: groundId('lot'),
};

export function mapFromAscii(rows: string[], opts: FixtureOpts = {}): MapData {
  const h = rows.length;
  const w = rows[0]!.length;
  const n = w * h;
  const ground = new Uint8Array(n);
  const building = new Int16Array(n).fill(-1);
  const letters = new Map<string, TilePos[]>();
  const steps: TilePos[] = [];
  let ci0 = Infinity;
  let cj0 = Infinity;
  let ci1 = -1;
  let cj1 = -1;
  for (let j = 0; j < h; j++) {
    const row = rows[j]!;
    if (row.length !== w) throw new Error(`row ${j} has length ${row.length}, expected ${w}`);
    for (let i = 0; i < w; i++) {
      const ch = row[i]!;
      if (/[A-Za-z]/.test(ch) && ch !== 'S' && ch !== 'C' && ch !== 'X') {
        ground[j * w + i] = groundId('lot');
        const list = letters.get(ch) ?? [];
        list.push({ i, j });
        letters.set(ch, list);
        continue;
      }
      const g = G[ch];
      if (g === undefined) throw new Error(`unknown tile '${ch}'`);
      ground[j * w + i] = g;
      if (ch === 'S') steps.push({ i, j });
      if (ch === 'C') {
        ci0 = Math.min(ci0, i);
        cj0 = Math.min(cj0, j);
        ci1 = Math.max(ci1, i);
        cj1 = Math.max(cj1, j);
      }
    }
  }
  const buildings: BuildingData[] = [];
  const letterId = new Map<string, number>();
  for (const [ch, tiles] of [...letters.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const i0 = Math.min(...tiles.map((t) => t.i));
    const j0 = Math.min(...tiles.map((t) => t.j));
    const i1 = Math.max(...tiles.map((t) => t.i));
    const j1 = Math.max(...tiles.map((t) => t.j));
    const id = buildings.length;
    letterId.set(ch, id);
    for (const t of tiles) building[t.j * w + t.i] = id;
    const doors: TilePos[] = [];
    const walk = (i: number, j: number): boolean =>
      i >= 0 &&
      j >= 0 &&
      i < w &&
      j < h &&
      ![groundId('lot'), groundId('water')].includes(ground[j * w + i]!);
    for (let i = i0; i <= i1; i++) {
      if (walk(i, j1 + 1)) doors.push({ i, j: j1 + 1 });
      if (walk(i, j0 - 1)) doors.push({ i, j: j0 - 1 });
    }
    for (let j = j0; j <= j1; j++) {
      if (walk(i1 + 1, j)) doors.push({ i: i1 + 1, j });
      if (walk(i0 - 1, j)) doors.push({ i: i0 - 1, j });
    }
    buildings.push({
      id,
      i: i0,
      j: j0,
      w: i1 - i0 + 1,
      d: j1 - j0 + 1,
      storeys: opts.storeys ?? 3,
      style: 'madrid',
      kind: 'residential',
      roof: 'flat',
      rooftop: true,
      doors,
      seed: id * 7919,
    });
  }
  const spawns: SpawnDistrict[] = (opts.spawns ?? []).map((s, k) => ({
    id: `d${k}`,
    name: `District ${k}`,
    unlockWave: s.unlockWave,
    buildingIds: [...s.letters].map((ch) => letterId.get(ch)!).filter((x) => x !== undefined),
    rally: { i: 0, j: 0 },
  }));
  return {
    city: 'madrid',
    name: 'fixture',
    w,
    h,
    ground,
    marking: new Uint8Array(n),
    building,
    buildings,
    capitol: {
      i: ci1 >= 0 ? ci0 : 0,
      j: ci1 >= 0 ? cj0 : 0,
      w: ci1 >= 0 ? ci1 - ci0 + 1 : 1,
      d: ci1 >= 0 ? cj1 - cj0 + 1 : 1,
      steps,
    },
    landmarks: [],
    spawns,
    streets: [],
    decor: [],
    chokepoints: [],
    cameraStart: { i: 0, j: 0 },
  };
}

/**
 * A straight avenue (5 wide, along j) from a residential block at the top to the Capitol at
 * the bottom, with a rooftop building (R) beside the avenue and a side street.
 */
export const AVENUE = [
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  ',,,,,.....,,,,,,',
  'XXXX,.....,XXXXX',
  'XXXX,.....,XXXXX',
  'XXXX,.....,RRRXX',
  'XXXX,.....,RRRXX',
  'XXXX,.....,RRRXX',
  'XXXX,.....,XXXXX',
  'XXXX,.....,XXXXX',
  'XXXX,.....,XXXXX',
  'XXXX,.....,XXXXX',
  'XXXX,.....,XXXXX',
  'XXXX,.....,XXXXX',
  'XXXX,_____,XXXXX',
  'XXXX,SSSSS,XXXXX',
  'XXXXXCCCCCXXXXXX',
  'XXXXXCCCCCXXXXXX',
];

export function avenueWorld(opts: WorldOptions = {}, fx: FixtureOpts = {}): World {
  return new World(mapFromAscii(AVENUE, { spawns: [{ letters: 'A', unlockWave: 1 }], ...fx }), {
    seed: 1,
    ...opts,
  });
}

/** Drain and return events of one type. */
export function eventsOf<T extends string>(
  events: readonly { type: string }[],
  type: T,
): Extract<SimEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as never;
}
