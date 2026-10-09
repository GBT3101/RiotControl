/**
 * Public map API (M2): `loadMap(city, seed?)` → cached `MapData`, plus tile helpers.
 *
 *   import { loadMap, isWalkable, buildingAt } from './maps';
 *   const map = loadMap('madrid');
 */
import { london } from './cities/london';
import { madrid } from './cities/madrid';
import { paris } from './cities/paris';
import type { Blueprint } from './blueprint';
import {
  GROUNDS,
  PLACEABLE_ROAD,
  WALKABLE,
  type BuildingData,
  type CityId,
  type Ground,
  type MapData,
  type TilePos,
} from './contract';
import { rasterize } from './rasterize';

export * from './contract';
export { distanceField, descend } from './flow';
export { rasterize } from './rasterize';
export type { Blueprint } from './blueprint';

export const BLUEPRINTS: Readonly<Record<CityId, Blueprint>> = { madrid, london, paris };

const cache = new Map<string, MapData>();

/** Rasterised map for a city (cached per city+seed). Seed 0 is the canonical layout. */
export function loadMap(city: CityId, seed = 0): MapData {
  const key = `${city}:${seed}`;
  let map = cache.get(key);
  if (!map) {
    map = rasterize(BLUEPRINTS[city], seed);
    cache.set(key, map);
  }
  return map;
}

/** Drop cached maps (tests / hot reload). */
export function clearMapCache(): void {
  cache.clear();
}

const WALK_LUT = GROUNDS.map((g) => WALKABLE.has(g));
const ROAD_LUT = GROUNDS.map((g) => PLACEABLE_ROAD.has(g));

export const inBounds = (map: MapData, i: number, j: number): boolean =>
  i >= 0 && j >= 0 && i < map.w && j < map.h;

/** Row-major flat index (no bounds check). */
export const tileIndex = (map: MapData, i: number, j: number): number => j * map.w + i;

export function groundAt(map: MapData, i: number, j: number): Ground | undefined {
  return inBounds(map, i, j) ? GROUNDS[map.ground[j * map.w + i]!] : undefined;
}

/** Protesters / ground units can stand on this tile. */
export function isWalkable(map: MapData, i: number, j: number): boolean {
  return inBounds(map, i, j) && WALK_LUT[map.ground[j * map.w + i]!] === true;
}

/** Road-placed player units and blockades can be deployed on this tile. */
export function isPlaceableRoad(map: MapData, i: number, j: number): boolean {
  return inBounds(map, i, j) && ROAD_LUT[map.ground[j * map.w + i]!] === true;
}

/** Building occupying the tile (generated or civic), or undefined. */
export function buildingAt(map: MapData, i: number, j: number): BuildingData | undefined {
  if (!inBounds(map, i, j)) return undefined;
  const b = map.building[j * map.w + i]!;
  return b >= 0 ? map.buildings[b] : undefined;
}

/** Nearest walkable tile (Chebyshev rings, row-major within a ring), or null within maxR. */
export function nearestWalkable(map: MapData, i: number, j: number, maxR = 24): TilePos | null {
  const ci = Math.floor(i);
  const cj = Math.floor(j);
  for (let r = 0; r <= maxR; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (isWalkable(map, ci + di, cj + dj)) return { i: ci + di, j: cj + dj };
      }
    }
  }
  return null;
}

/** True when the tile is part of the Capitol footprint. */
export function isCapitol(map: MapData, i: number, j: number): boolean {
  const c = map.capitol;
  return i >= c.i && j >= c.j && i < c.i + c.w && j < c.j + c.d;
}
