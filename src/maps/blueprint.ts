/**
 * Compact, hand-authored city blueprint format (M2). A blueprint describes a city in
 * vector-ish terms — named road polylines with widths, plazas, parks, rivers, bridges,
 * landmark / Capitol placements, spawn districts, chokepoints and decor rules — and
 * `rasterize()` turns it into the tile-level `MapData` of `contract.ts`.
 *
 * Coordinates are tile coordinates (i, j) of the contract: a point (x, y) lies inside tile
 * (floor(x), floor(y)); tile (i, j) has its centre at (i + .5, j + .5). Polyline centres for
 * roads with an **odd** width should sit on tile centres (x.5), roads with an **even** width on
 * tile edges (integers) — the rasteriser covers every tile whose centre lies within width/2 of
 * the centre line (square end caps).
 *
 * Map orientation convention: the Capitol front (steps) faces +j; the city's natural barrier
 * (river / park) lies at low j "behind" it. In the debug viewer (top-down, i → right,
 * j → down) the barrier is at the top and the approaches come up from the bottom and sides.
 */
import type {
  BuildingKind,
  CityId,
  Ground,
  LandmarkId,
  RoofType,
  TilePos,
} from './contract';

/** A point [i, j] in tile coordinates (fractional allowed). */
export type P = readonly [number, number];

export type RoadClass = 'avenue' | 'street' | 'lane';

export interface RoadDef {
  /** Real street name (labels + `MapData.streets`). Unnamed roads are not labelled. */
  name?: string;
  /** Centre polyline. */
  path: readonly P[];
  /** Total width in tiles including sidewalks (avenues 4–6, streets 2–3). */
  width: number;
  /** Sidewalk tiles per side. Default: 1 when width ≥ 3, else 0. */
  sidewalk?: number;
  /** Carriageway material. Default 'asphalt'. */
  surface?: 'asphalt' | 'cobble' | 'plaza' | 'parkPath' | 'sidewalk';
  /** Default: width ≥ 4 → avenue, width ≥ 2 → street, else lane. */
  cls?: RoadClass;
  /** Tree kind planted along the sidewalks (null = none). Default: city tree on avenues. */
  trees?: string | null;
  /** Buildings fronting this road are rooftop-capable. Default: true for avenues. */
  rooftops?: boolean;
  /** Café terraces along this road's sidewalks. */
  cafes?: boolean;
  /** Storey bonus for buildings fronting it (default +1 on avenues). */
  storeyBonus?: number;
  /** Paint lane markings (dashes / zebras / stop lines). Default: asphalt with core ≥ 2. */
  markings?: boolean;
  /** Overrides the label path (e.g. a shorter, nicer segment for the street sign). */
  labelPath?: readonly P[];
}

export type Shape =
  | { rect: readonly [number, number, number, number] } // i0, j0, i1, j1 (inclusive tiles)
  | { circle: readonly [number, number, number] } // centre i, centre j (tile coords), radius
  | { poly: readonly P[] };

export type AreaGround = Extract<
  Ground,
  'plaza' | 'grass' | 'cobble' | 'parkPath' | 'water' | 'lot' | 'sidewalk' | 'asphalt'
>;

export interface AreaDef {
  ground: AreaGround;
  shape: Shape;
  /** 'base' = before roads (parks, lakes), 'top' = after roads (plazas, roundabouts). */
  layer?: 'base' | 'top';
  name?: string;
  /** Trees scattered over grass tiles of this area. */
  trees?: { kinds: readonly string[]; density: number };
  /** Reserve the lot tiles of this area (no generated buildings) — e.g. a private garden. */
  reserve?: boolean;
}

export interface RiverDef {
  name: string;
  path: readonly P[];
  /** Water width in tiles. */
  width: number;
  /** Blocked embankment tiles on each side (default 1). */
  quay?: number;
}

export interface BridgeDef {
  name: string;
  path: readonly [P, P];
  width: number;
  sidewalk?: number;
}

export interface LandmarkDef {
  id: LandmarkId;
  i: number;
  j: number;
}

export interface CapitolDef {
  i: number;
  j: number;
  /** Rows of steps in front (+j) of the footprint (default 2). */
  stepRows?: number;
  /** Footprint columns left out of the steps at each end (default 1). */
  stepInset?: number;
}

/** Hand-placed large building (ministries, museums, stations…). */
export interface CivicDef {
  name: string;
  i: number;
  j: number;
  w: number;
  d: number;
  storeys: number;
  roof?: RoofType;
  kind?: BuildingKind;
  rooftop?: boolean;
}

/** Overrides generated buildings inside a shape. */
export interface ZoneDef {
  shape: Shape;
  storeys?: readonly [number, number];
  kind?: BuildingKind;
  /** Probability that a generated building is residential (default from style). */
  residential?: number;
  roofs?: Partial<Record<RoofType, number>>;
  /** Max footprint along the street / into the block. */
  maxLen?: number;
  maxDepth?: number;
}

export interface DistrictDef {
  id: string;
  name: string;
  unlockWave: number;
  /** Residential buildings whose footprint centre falls inside become spawn buildings. */
  area: readonly [number, number, number, number];
  rally: P;
}

export interface ChokepointDef {
  name: string;
  at: P;
  radius: number;
}

/** An approach route toward the Capitol (validation + viewer). */
export interface ApproachDef {
  name: string;
  path: readonly P[];
  /** One of the final 2–3 approaches into the Capitol forecourt. */
  final?: boolean;
}

export interface DecorDef {
  kind: string;
  at: P;
  axis?: 'i' | 'j';
}

export interface CityStyle {
  roofs: Partial<Record<RoofType, number>>;
  storeys: readonly [number, number];
  /** Probability that a generated building is residential. */
  residential: number;
  /** Boulevard tree kind. */
  tree: string;
  /** Street-furniture kinds sprinkled on sidewalks, with per-tile probabilities. */
  sidewalkProps: readonly { kind: string; p: number }[];
  /** Props sprinkled on plazas. */
  plazaProps: readonly { kind: string; p: number }[];
  /** Lane (auto-generated alley) surface. */
  laneSurface: 'asphalt' | 'cobble';
  /** Maximum block extent before an automatic lane splits it. */
  maxBlock: number;
}

export interface Blueprint {
  city: CityId;
  name: string;
  w: number;
  h: number;
  seed: number;
  style: CityStyle;
  areas: readonly AreaDef[];
  rivers: readonly RiverDef[];
  roads: readonly RoadDef[];
  bridges: readonly BridgeDef[];
  landmarks: readonly LandmarkDef[];
  capitol: CapitolDef;
  civic: readonly CivicDef[];
  zones: readonly ZoneDef[];
  districts: readonly DistrictDef[];
  chokepoints: readonly ChokepointDef[];
  approaches: readonly ApproachDef[];
  decor: readonly DecorDef[];
  /** Shapes where no automatic lanes may be cut (keeps designed chokepoints genuine). */
  noLanes: readonly Shape[];
  /** Water / area labels for the viewer (rivers are labelled automatically). */
  labels?: readonly { text: string; at: P }[];
  cameraStart?: TilePos;
}

/** Tile-centre test for a shape. */
export function inShape(s: Shape, i: number, j: number): boolean {
  const x = i + 0.5;
  const y = j + 0.5;
  if ('rect' in s) {
    const [i0, j0, i1, j1] = s.rect;
    return i >= i0 && i <= i1 && j >= j0 && j <= j1;
  }
  if ('circle' in s) {
    const [ci, cj, r] = s.circle;
    const dx = x - ci;
    const dy = y - cj;
    return dx * dx + dy * dy <= r * r;
  }
  // Even–odd polygon test on the tile centre.
  const pts = s.poly;
  let inside = false;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
    const pa = pts[a]!;
    const pb = pts[b]!;
    if (pa[1] > y !== pb[1] > y) {
      const xc = ((pb[0] - pa[0]) * (y - pa[1])) / (pb[1] - pa[1]) + pa[0];
      if (x < xc) inside = !inside;
    }
  }
  return inside;
}

/** Integer bounding box [i0, j0, i1, j1] (inclusive) of a shape, unclamped. */
export function shapeBounds(s: Shape): [number, number, number, number] {
  if ('rect' in s) return [s.rect[0], s.rect[1], s.rect[2], s.rect[3]];
  if ('circle' in s) {
    const [ci, cj, r] = s.circle;
    return [Math.floor(ci - r), Math.floor(cj - r), Math.ceil(ci + r), Math.ceil(cj + r)];
  }
  let i0 = Infinity;
  let j0 = Infinity;
  let i1 = -Infinity;
  let j1 = -Infinity;
  for (const [x, y] of s.poly) {
    i0 = Math.min(i0, Math.floor(x));
    j0 = Math.min(j0, Math.floor(y));
    i1 = Math.max(i1, Math.ceil(x));
    j1 = Math.max(j1, Math.ceil(y));
  }
  return [i0, j0, i1, j1];
}

/** Shorthands used by the city files. */
export const rect = (i0: number, j0: number, i1: number, j1: number): Shape => ({
  rect: [i0, j0, i1, j1],
});
export const circle = (ci: number, cj: number, r: number): Shape => ({ circle: [ci, cj, r] });
export const poly = (...pts: P[]): Shape => ({ poly: pts });
