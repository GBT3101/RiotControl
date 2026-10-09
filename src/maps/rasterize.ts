/**
 * Blueprint → MapData rasteriser (M2).
 *
 * Paint order: base areas (parks, lakes) → rivers + quays → roads (core + sidewalks) →
 * top areas (plazas, roundabouts) → bridges → civic buildings, landmarks, Capitol, steps →
 * automatic lanes through over-sized blocks → generated buildings along block frontages →
 * markings → decor. Everything random is drawn from one seeded `Rng`, so a (blueprint, seed)
 * pair always produces the same map.
 */
import { Rng } from '../core/rng';
import {
  CAPITOL_FOOTPRINT,
  GROUNDS,
  LANDMARKS,
  MARKINGS,
  WALKABLE,
  type BuildingData,
  type BuildingKind,
  type Chokepoint,
  type DecorPlacement,
  type Ground,
  type LandmarkPlacement,
  type MapData,
  type Marking,
  type RoofType,
  type SpawnDistrict,
  type StreetLabel,
  type TilePos,
} from './contract';
import {
  inShape,
  shapeBounds,
  type AreaDef,
  type Blueprint,
  type P,
  type RoadClass,
  type RoadDef,
  type Shape,
  type ZoneDef,
} from './blueprint';

const G = Object.fromEntries(GROUNDS.map((g, k) => [g, k])) as Record<Ground, number>;
const M = Object.fromEntries(MARKINGS.map((m, k) => [m, k])) as Record<Marking, number>;
const WALK = new Uint8Array(GROUNDS.length);
GROUNDS.forEach((g, k) => (WALK[k] = WALKABLE.has(g) ? 1 : 0));

const CLS_RANK: Record<RoadClass, number> = { avenue: 3, street: 2, lane: 1 };
const AXIS_NONE = 0;
const AXIS_I = 1;
const AXIS_J = 2;

/** A road after defaults are applied. */
interface Road {
  id: number;
  def: RoadDef;
  name: string | undefined;
  width: number;
  sidewalk: number;
  surface: number;
  cls: RoadClass;
  trees: string | null;
  rooftops: boolean;
  cafes: boolean;
  storeyBonus: number;
  markings: boolean;
  bridge: boolean;
}

/** Mutable working state shared by the passes. */
interface Work {
  bp: Blueprint;
  rng: Rng;
  w: number;
  h: number;
  ground: Uint8Array;
  marking: Uint8Array;
  building: Int16Array;
  /** 1 = never put generated buildings here (landmark, capitol, reserved garden, gap). */
  reserved: Uint8Array;
  /** Winning road per tile (core or sidewalk), -1 if none. */
  roadId: Int16Array;
  roadCore: Uint8Array;
  roadRank: Int16Array;
  /** Along-road distance of the winning claim (decor spacing). */
  roadT: Float32Array;
  /** Signed lateral offset of the winning claim (centre-line detection). */
  roadPerp: Float32Array;
  roadAxis: Uint8Array;
  /** Number of distinct road cores covering the tile. */
  coreCount: Uint8Array;
  coreLast: Int16Array;
  /** 1 = asphalt painted by a 'top' area (roundabout ring) → treated as a junction. */
  areaAsphalt: Uint8Array;
  roads: Road[];
  buildings: BuildingData[];
  decor: DecorPlacement[];
  decorAt: Uint8Array;
}

const idx = (wk: Work, i: number, j: number): number => j * wk.w + i;
const inb = (wk: Work, i: number, j: number): boolean => i >= 0 && j >= 0 && i < wk.w && j < wk.h;

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

interface SegHit {
  along: number;
  perp: number;
  len: number;
}

/**
 * Visit every tile whose centre lies within `hw` (perpendicular) of segment a→b. `capA`/`capB`
 * extend the segment beyond its ends (square caps).
 */
function forSegment(
  wk: Work,
  a: P,
  b: P,
  hw: number,
  capA: number,
  capB: number,
  fn: (i: number, j: number, hit: SegHit) => void,
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;
  const pad = hw + Math.max(capA, capB) + 1;
  const i0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - pad));
  const i1 = Math.min(wk.w - 1, Math.ceil(Math.max(a[0], b[0]) + pad));
  const j0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - pad));
  const j1 = Math.min(wk.h - 1, Math.ceil(Math.max(a[1], b[1]) + pad));
  const hit: SegHit = { along: 0, perp: 0, len };
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cx = i + 0.5 - a[0];
      const cy = j + 0.5 - a[1];
      const along = cx * ux + cy * uy;
      if (along < -capA - 1e-6 || along > len + capB + 1e-6) continue;
      const perp = cx * -uy + cy * ux;
      if (Math.abs(perp) >= hw - 1e-6) continue;
      // Round joins: a cap of exactly `hw` is a half-disc around the vertex.
      if (along < 0 && capA === hw && along * along + perp * perp >= hw * hw) continue;
      if (along > len && capB === hw && (along - len) ** 2 + perp * perp >= hw * hw) continue;
      hit.along = along;
      hit.perp = perp;
      fn(i, j, hit);
    }
  }
}

function segAxis(a: P, b: P): number {
  const dx = Math.abs(b[0] - a[0]);
  const dy = Math.abs(b[1] - a[1]);
  if (dy * 4 <= dx) return AXIS_I;
  if (dx * 4 <= dy) return AXIS_J;
  return AXIS_NONE;
}

function forShape(wk: Work, s: Shape, fn: (i: number, j: number) => void): void {
  const [i0, j0, i1, j1] = shapeBounds(s);
  for (let j = Math.max(0, j0); j <= Math.min(wk.h - 1, j1); j++) {
    for (let i = Math.max(0, i0); i <= Math.min(wk.w - 1, i1); i++) {
      if (inShape(s, i, j)) fn(i, j);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------------------------

function paintAreas(wk: Work, layer: 'base' | 'top'): void {
  for (const a of wk.bp.areas) {
    if ((a.layer ?? defaultLayer(a)) !== layer) continue;
    const g = G[a.ground];
    forShape(wk, a.shape, (i, j) => {
      const k = idx(wk, i, j);
      wk.ground[k] = g;
      if (layer === 'top') {
        // A top area replaces whatever road claimed the tile.
        wk.roadId[k] = -1;
        wk.roadCore[k] = 0;
        wk.roadRank[k] = -1;
        wk.areaAsphalt[k] = a.ground === 'asphalt' ? 1 : 0;
      }
      if (a.reserve) wk.reserved[k] = 1;
    });
  }
}

function defaultLayer(a: AreaDef): 'base' | 'top' {
  return a.ground === 'grass' || a.ground === 'water' || a.ground === 'parkPath' ? 'base' : 'top';
}

function paintRivers(wk: Work): void {
  for (const r of wk.bp.rivers) {
    const hw = r.width / 2;
    const quay = r.quay ?? 1;
    for (let s = 0; s + 1 < r.path.length; s++) {
      forSegment(wk, r.path[s]!, r.path[s + 1]!, hw, hw, hw, (i, j) => {
        wk.ground[idx(wk, i, j)] = G.water;
      });
    }
    if (quay <= 0) continue;
    for (let s = 0; s + 1 < r.path.length; s++) {
      forSegment(wk, r.path[s]!, r.path[s + 1]!, hw + quay, hw, hw, (i, j) => {
        const k = idx(wk, i, j);
        if (wk.ground[k] !== G.water) wk.ground[k] = G.quay;
      });
    }
  }
}

function makeRoad(id: number, def: RoadDef, bridge: boolean): Road {
  const width = def.width;
  const cls: RoadClass = def.cls ?? (width >= 4 ? 'avenue' : width >= 2 ? 'street' : 'lane');
  const sidewalk = def.sidewalk ?? (width >= 3 ? 1 : 0);
  const surface = G[def.surface ?? 'asphalt'];
  return {
    id,
    def,
    name: def.name,
    width,
    sidewalk,
    surface,
    cls,
    trees: def.trees === undefined ? null : def.trees,
    rooftops: def.rooftops ?? cls === 'avenue',
    cafes: def.cafes ?? false,
    storeyBonus: def.storeyBonus ?? (cls === 'avenue' ? 1 : 0),
    markings:
      def.markings ?? (surface === G.asphalt && width - 2 * sidewalk >= 2 && cls !== 'lane'),
    bridge,
  };
}

/** Paint one road (core + sidewalks) with claim priorities. */
function paintRoad(wk: Work, road: Road): void {
  const hw = road.width / 2;
  const coreHw = hw - road.sidewalk;
  const path = road.def.path;
  let along0 = 0;
  for (let s = 0; s + 1 < path.length; s++) {
    const a = path[s]!;
    const b = path[s + 1]!;
    const axis = segAxis(a, b);
    // Path ends: flat caps. Interior joints: square between axis-aligned segments (crisp
    // L-turns), round otherwise (no asphalt blobs on diagonal bends).
    const prev = path[s - 1];
    const next = path[s + 2];
    const sq = (p: P | undefined, q: P | undefined): boolean =>
      p !== undefined && q !== undefined && segAxis(p, q) !== AXIS_NONE && axis !== AXIS_NONE;
    const capA = s === 0 ? 0.5 : sq(prev, a) ? hw + 1e-3 : hw;
    const capB = s + 2 === path.length ? 0.5 : sq(b, next) ? hw + 1e-3 : hw;
    forSegment(wk, a, b, hw, capA, capB, (i, j, hit) => {
      const k = idx(wk, i, j);
      const g = wk.ground[k]!;
      if (g === G.water || g === G.quay) return;
      const core = Math.abs(hit.perp) < coreHw - 1e-6;
      const rank = core ? 100 + CLS_RANK[road.cls] * 10 + (road.surface === G.asphalt ? 1 : 0) : CLS_RANK[road.cls];
      if (core && wk.coreLast[k] !== road.id) {
        wk.coreLast[k] = road.id;
        wk.coreCount[k] = wk.coreCount[k]! + 1;
      }
      if (rank < wk.roadRank[k]!) return;
      wk.roadRank[k] = rank;
      wk.roadId[k] = road.id;
      wk.roadCore[k] = core ? 1 : 0;
      wk.roadT[k] = along0 + hit.along;
      wk.roadPerp[k] = hit.perp;
      wk.roadAxis[k] = axis;
      wk.ground[k] = core ? road.surface : G.sidewalk;
    });
    along0 += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
}

function paintBridges(wk: Work): void {
  for (const b of wk.bp.bridges) {
    const road = makeRoad(wk.roads.length, { name: b.name, path: b.path, width: b.width, sidewalk: b.sidewalk ?? 1, trees: null }, true);
    wk.roads.push(road);
    paintRoad(wk, road); // land approaches
    const hw = b.width / 2;
    const coreHw = hw - road.sidewalk;
    const axis = segAxis(b.path[0], b.path[1]);
    forSegment(wk, b.path[0], b.path[1], hw, 0.5, 0.5, (i, j, hit) => {
      const k = idx(wk, i, j);
      const g = wk.ground[k]!;
      if (g !== G.water && g !== G.quay && g !== G.bridge) return;
      wk.ground[k] = G.bridge;
      wk.roadId[k] = road.id;
      wk.roadCore[k] = Math.abs(hit.perp) < coreHw ? 1 : 0;
      wk.roadRank[k] = 200;
      wk.roadT[k] = hit.along;
      wk.roadPerp[k] = hit.perp;
      wk.roadAxis[k] = axis;
    });
  }
}

/** Mark a footprint as blocked lot with no generated buildings. */
function reserveFootprint(wk: Work, i0: number, j0: number, w: number, d: number): void {
  for (let j = j0; j < j0 + d; j++) {
    for (let i = i0; i < i0 + w; i++) {
      if (!inb(wk, i, j)) continue;
      const k = idx(wk, i, j);
      wk.ground[k] = G.lot;
      wk.reserved[k] = 1;
      wk.roadId[k] = -1;
      wk.roadCore[k] = 0;
      wk.marking[k] = 0;
    }
  }
}

function placeFixed(wk: Work): { landmarks: LandmarkPlacement[]; steps: TilePos[] } {
  const { bp } = wk;
  // Civic buildings (hand-placed): forced onto lot.
  for (const c of bp.civic) {
    reserveFootprint(wk, c.i, c.j, c.w, c.d);
    addBuilding(wk, {
      i: c.i,
      j: c.j,
      w: c.w,
      d: c.d,
      storeys: c.storeys,
      kind: c.kind ?? 'civic',
      roof: c.roof ?? pickRoof(wk, bp.style.roofs),
      rooftop: c.rooftop ?? false,
    });
  }
  const landmarks: LandmarkPlacement[] = [];
  for (const l of bp.landmarks) {
    const def = LANDMARKS[l.id];
    reserveFootprint(wk, l.i, l.j, def.w, def.d);
    landmarks.push({ id: l.id, i: l.i, j: l.j });
  }
  const fp = CAPITOL_FOOTPRINT[bp.city];
  const c = bp.capitol;
  reserveFootprint(wk, c.i, c.j, fp.w, fp.d);
  const rows = c.stepRows ?? 2;
  const inset = c.stepInset ?? 1;
  const steps: TilePos[] = [];
  for (let r = 0; r < rows; r++) {
    for (let i = c.i + inset; i < c.i + fp.w - inset; i++) {
      const j = c.j + fp.d + r;
      if (!inb(wk, i, j)) continue;
      const k = idx(wk, i, j);
      wk.ground[k] = G.steps;
      wk.reserved[k] = 1;
      wk.roadId[k] = -1;
      wk.marking[k] = 0;
      steps.push({ i, j });
    }
  }
  return { landmarks, steps };
}

const isFree = (wk: Work, k: number): boolean =>
  wk.ground[k] === G.lot && wk.reserved[k] === 0 && wk.building[k] === -1;

/** Split over-sized blocks with narrow lanes so every block has street frontage. */
function cutLanes(wk: Work): void {
  const { w, h } = wk;
  const max = wk.bp.style.maxBlock;
  const comp = new Int32Array(w * h);
  const noCut = new Uint8Array(w * h);
  const stack: number[] = [];
  const blocked = (i: number, j: number): boolean =>
    wk.bp.noLanes.some((s) => inShape(s, i, j));
  for (let iter = 0; iter < 60; iter++) {
    comp.fill(-1);
    let changed = false;
    let n = 0;
    for (let start = 0; start < w * h && !changed; start++) {
      if (comp[start] !== -1 || !isFree(wk, start)) continue;
      // Flood the component, tracking its bbox.
      const tiles: number[] = [];
      let i0 = w;
      let j0 = h;
      let i1 = -1;
      let j1 = -1;
      stack.push(start);
      comp[start] = n;
      while (stack.length) {
        const k = stack.pop()!;
        tiles.push(k);
        const i = k % w;
        const j = (k - i) / w;
        i0 = Math.min(i0, i);
        i1 = Math.max(i1, i);
        j0 = Math.min(j0, j);
        j1 = Math.max(j1, j);
        for (const [di, dj] of DIRS4) {
          const ni = i + di;
          const nj = j + dj;
          if (!inb(wk, ni, nj)) continue;
          const nk = nj * w + ni;
          if (comp[nk] === -1 && isFree(wk, nk)) {
            comp[nk] = n;
            stack.push(nk);
          }
        }
      }
      const bw = i1 - i0 + 1;
      const bh = j1 - j0 + 1;
      if ((bw > max || bh > max) && !noCut[start]) {
        changed = cutComponent(wk, comp, n, i0, j0, i1, j1, bw >= bh, blocked, noCut);
      }
      n++;
    }
    if (!changed) break;
  }
}

function cutComponent(
  wk: Work,
  comp: Int32Array,
  id: number,
  i0: number,
  j0: number,
  i1: number,
  j1: number,
  vertical: boolean,
  blocked: (i: number, j: number) => boolean,
  noCut: Uint8Array,
): boolean {
  const lo = vertical ? i0 : j0;
  const hi = vertical ? i1 : j1;
  const mid = Math.floor((lo + hi) / 2);
  // Try offsets around the middle until a cut produces a lane that touches the street grid.
  const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];
  const lane: RoadDef = { path: [], width: 2, surface: wk.bp.style.laneSurface, cls: 'lane', markings: false };
  for (const off of offsets) {
    const c = mid + off;
    if (c - lo < 3 || hi - (c + 1) < 3) continue;
    const runs: number[][] = [];
    const lenAcross = vertical ? j1 - j0 + 1 : i1 - i0 + 1;
    let run: number[] = [];
    for (let t = 0; t <= lenAcross; t++) {
      let ok = t < lenAcross;
      const cells: number[] = [];
      if (ok) {
        for (let q = 0; q < 2; q++) {
          const i = vertical ? c + q : i0 + t;
          const j = vertical ? j0 + t : c + q;
          const k = j * wk.w + i;
          if (!inb(wk, i, j) || comp[k] !== id || blocked(i, j)) ok = false;
          else cells.push(k);
        }
      }
      if (ok) run.push(...cells);
      else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    // Keep runs that reach a walkable tile on at least one end (no sealed islands).
    let painted = false;
    for (const r of runs) {
      if (r.length < 4) continue;
      if (!r.some((k) => touchesWalkable(wk, k))) continue;
      const road = makeRoad(wk.roads.length, lane, false);
      wk.roads.push(road);
      for (const k of r) {
        wk.ground[k] = road.surface;
        wk.roadId[k] = road.id;
        wk.roadCore[k] = 1;
        wk.roadRank[k] = 100 + 10;
        wk.roadAxis[k] = vertical ? AXIS_J : AXIS_I;
        wk.roadT[k] = vertical ? Math.floor(k / wk.w) : k % wk.w;
      }
      painted = true;
    }
    if (painted) return true;
  }
  // Could not cut: remember the component so the loop terminates.
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const k = j * wk.w + i;
      if (comp[k] === id) noCut[k] = 1;
    }
  }
  return true;
}

function touchesWalkable(wk: Work, k: number): boolean {
  const i = k % wk.w;
  const j = (k - i) / wk.w;
  for (const [di, dj] of DIRS4) {
    const ni = i + di;
    const nj = j + dj;
    if (inb(wk, ni, nj) && WALK[wk.ground[nj * wk.w + ni]!] === 1) return true;
  }
  return false;
}

const DIRS4: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

// ---------------------------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------------------------

function pickRoof(wk: Work, roofs: Partial<Record<RoofType, number>>): RoofType {
  const keys = Object.keys(roofs) as RoofType[];
  return wk.rng.weighted(keys, (r) => roofs[r] ?? 0);
}

interface NewBuilding {
  i: number;
  j: number;
  w: number;
  d: number;
  storeys: number;
  kind: BuildingKind;
  roof: RoofType;
  rooftop: boolean;
  front?: readonly [number, number];
}

function addBuilding(wk: Work, nb: NewBuilding): BuildingData {
  const id = wk.buildings.length;
  const b: BuildingData = {
    id,
    i: nb.i,
    j: nb.j,
    w: nb.w,
    d: nb.d,
    storeys: Math.max(2, Math.min(6, nb.storeys)),
    style: wk.bp.city,
    kind: nb.kind,
    roof: nb.roof,
    rooftop: nb.rooftop,
    doors: [],
    seed: wk.rng.nextU32(),
  };
  for (let j = nb.j; j < nb.j + nb.d; j++) {
    for (let i = nb.i; i < nb.i + nb.w; i++) wk.building[idx(wk, i, j)] = id;
  }
  wk.buildings.push(b);
  return b;
}

/** Street-frontage rank of a walkable neighbour tile (higher = more important street). */
function frontRank(wk: Work, k: number): number {
  const g = wk.ground[k]!;
  if (!WALK[g]) return -1;
  const r = wk.roadId[k]!;
  if (r >= 0) return CLS_RANK[wk.roads[r]!.cls] + 1;
  if (g === G.plaza || g === G.bridge) return 3.5;
  if (g === G.cobble || g === G.sidewalk || g === G.asphalt) return 2.5;
  return 1;
}

function zoneFor(wk: Work, i: number, j: number): ZoneDef | undefined {
  let found: ZoneDef | undefined;
  for (const z of wk.bp.zones) if (inShape(z.shape, i, j)) found = z;
  return found;
}

function inDistrict(wk: Work, i: number, j: number): boolean {
  return wk.bp.districts.some((d) => i >= d.area[0] && i <= d.area[2] && j >= d.area[1] && j <= d.area[3]);
}

function fillBuildings(wk: Work): void {
  const { w, h, rng } = wk;
  const style = wk.bp.style;
  interface Front {
    k: number;
    rank: number;
    n: readonly [number, number];
    road: number;
  }
  const collect = (): Front[] => {
    const out: Front[] = [];
    for (let k = 0; k < w * h; k++) {
      if (!isFree(wk, k)) continue;
      const i = k % w;
      const j = (k - i) / w;
      let best: Front | null = null;
      for (const n of DIRS4) {
        const ni = i + n[0];
        const nj = j + n[1];
        if (!inb(wk, ni, nj)) continue;
        const nk = nj * w + ni;
        const r = frontRank(wk, nk);
        if (r < 0) continue;
        // Prefer fronts the camera sees (+j, +i) on ties.
        const rr = r + (n[1] > 0 ? 0.02 : n[0] > 0 ? 0.01 : 0);
        if (!best || rr > best.rank) best = { k, rank: rr, n, road: wk.roadId[nk]! };
      }
      if (best) out.push(best);
    }
    out.sort((a, b) => b.rank - a.rank || a.k - b.k);
    return out;
  };

  const fits = (i: number, j: number, bw: number, bd: number): boolean => {
    if (i < 0 || j < 0 || i + bw > w || j + bd > h) return false;
    for (let y = j; y < j + bd; y++) {
      for (let x = i; x < i + bw; x++) if (!isFree(wk, y * w + x)) return false;
    }
    return true;
  };

  const build = (f: Front, pass: number): boolean => {
    const i = f.k % w;
    const j = (f.k - i) / w;
    const zone = zoneFor(wk, i, j);
    const road = f.road >= 0 ? wk.roads[f.road] : undefined;
    const alongI = f.n[0] === 0; // street lies at ±j → building runs along i
    const maxLen = zone?.maxLen ?? 6;
    const maxDepth = zone?.maxDepth ?? 4;
    const wantLen = Math.min(maxLen, rng.weighted([2, 3, 4, 5, 6], [1, 4, 5, 3, 2]));
    const wantDepth = Math.min(maxDepth, rng.weighted([2, 3, 4], [3, 5, 3]));
    for (let L = wantLen; L >= 2; L--) {
      for (let D = wantDepth; D >= 2; D--) {
        for (const shift of pass === 0 ? [0] : [0, -1, 1 - L]) {
          // Rect along the street from the anchor, depth away from the street.
          const bw = alongI ? L : D;
          const bd = alongI ? D : L;
          let bi = alongI ? i + shift : f.n[0] > 0 ? i - D + 1 : i;
          let bj = alongI ? (f.n[1] > 0 ? j - D + 1 : j) : j + shift;
          if (!fits(bi, bj, bw, bd)) continue;
          // Occasional 1-tile gap between neighbours for character.
          if (pass === 0 && rng.chance(0.035)) {
            wk.reserved[f.k] = 1;
            return false;
          }
          const sRange = zone?.storeys ?? style.storeys;
          let storeys = rng.int(sRange[0], sRange[1]) + (road?.storeyBonus ?? 0);
          if (f.rank >= 3.4 && !road) storeys += 1; // plaza frontage
          const resP = Math.max(zone?.residential ?? style.residential, inDistrict(wk, i, j) ? 0.92 : 0);
          const avenueFront = road?.cls === 'avenue';
          const kind: BuildingKind =
            zone?.kind ?? (rng.chance(avenueFront ? resP - 0.25 : resP) ? 'residential' : 'commercial');
          const roofs = zone?.roofs ?? style.roofs;
          const roofTopP = road?.rooftops ? 0.88 : f.rank >= 3.4 ? 0.7 : 0.06;
          bi = Math.max(0, bi);
          bj = Math.max(0, bj);
          addBuilding(wk, {
            i: bi,
            j: bj,
            w: bw,
            d: bd,
            storeys,
            kind,
            roof: pickRoof(wk, roofs),
            rooftop: rng.chance(roofTopP),
            front: f.n,
          });
          return true;
        }
      }
    }
    return false;
  };

  for (let pass = 0; pass < 3; pass++) {
    for (const f of collect()) {
      if (!isFree(wk, f.k)) continue;
      build(f, pass);
    }
  }

  // Interior pass: big leftover block interiors get back-buildings (no street front, no doors);
  // narrow leftovers stay as 'lot' courtyards.
  for (let k = 0; k < w * h; k++) {
    if (!isFree(wk, k)) continue;
    const i = k % w;
    const j = (k - i) / w;
    if (rng.chance(0.2)) continue;
    const want = rng.weighted([2, 3, 4], [2, 4, 3]);
    let placed = false;
    for (let bw = want; bw >= 2 && !placed; bw--) {
      for (let bd = want; bd >= 2 && !placed; bd--) {
        if (!fits(i, j, bw, bd)) continue;
        const zone = zoneFor(wk, i, j);
        const sRange = zone?.storeys ?? style.storeys;
        addBuilding(wk, {
          i,
          j,
          w: bw,
          d: bd,
          storeys: rng.int(sRange[0], sRange[1]) - 1,
          kind:
            zone?.kind ??
            (rng.chance(Math.max(zone?.residential ?? style.residential, inDistrict(wk, i, j) ? 0.92 : 0))
              ? 'residential'
              : 'commercial'),
          roof: pickRoof(wk, zone?.roofs ?? style.roofs),
          rooftop: false,
        });
        placed = true;
      }
    }
  }
}

/**
 * Frontage slivers too thin for a building (1-tile strips between a street and a civic block,
 * notches along diagonal roads) become pavement instead of black holes. Deliberate gaps
 * (reserved) and everything inside `noLanes` shapes stay blocked.
 */
function paveSlivers(wk: Work): void {
  const PAVE = [G.sidewalk, G.plaza, G.cobble, G.parkPath, G.grass];
  const conv: [number, number][] = [];
  for (let k = 0; k < wk.w * wk.h; k++) {
    if (!isFree(wk, k)) continue;
    const i = k % wk.w;
    const j = (k - i) / wk.w;
    if (wk.bp.noLanes.some((sh) => inShape(sh, i, j))) continue;
    let best = -1;
    for (const [di, dj] of DIRS4) {
      const ni = i + di;
      const nj = j + dj;
      if (!inb(wk, ni, nj)) continue;
      const r = PAVE.indexOf(wk.ground[idx(wk, ni, nj)]!);
      if (r >= 0 && (best < 0 || r < best)) best = r;
    }
    if (best >= 0) conv.push([k, PAVE[best]!]);
  }
  for (const [k, g] of conv) wk.ground[k] = g;
}

function assignDoors(wk: Work): void {
  for (const b of wk.buildings) {
    const cands: { t: TilePos; score: number }[] = [];
    const consider = (i: number, j: number, face: number, mid: number): void => {
      if (!inb(wk, i, j)) return;
      const g = wk.ground[idx(wk, i, j)]!;
      if (!WALK[g] || g === G.steps) return;
      const surf = g === G.sidewalk || g === G.plaza || g === G.cobble ? 2 : g === G.asphalt ? 0 : 1;
      cands.push({ t: { i, j }, score: surf * 10 + face * 3 - mid });
    };
    // +j face (visible, lit) and +i face (visible, shaded) are preferred.
    for (let i = b.i; i < b.i + b.w; i++) {
      const mid = Math.abs(i - (b.i + (b.w - 1) / 2));
      consider(i, b.j + b.d, 2, mid);
      consider(i, b.j - 1, 0, mid);
    }
    for (let j = b.j; j < b.j + b.d; j++) {
      const mid = Math.abs(j - (b.j + (b.d - 1) / 2));
      consider(b.i + b.w, j, 1.8, mid);
      consider(b.i - 1, j, 0, mid);
    }
    cands.sort((a, c) => c.score - a.score || a.t.j - c.t.j || a.t.i - c.t.i);
    const n = Math.max(b.w, b.d) >= 5 ? 2 : 1;
    for (const c of cands) {
      if (b.doors.length >= n) break;
      if (b.doors.some((d) => Math.abs(d.i - c.t.i) + Math.abs(d.j - c.t.j) < 3)) continue;
      b.doors.push(c.t);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Markings
// ---------------------------------------------------------------------------------------------

function paintMarkings(wk: Work): void {
  const { w, h } = wk;
  const junction = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const g = wk.ground[k];
    if ((g === G.asphalt || g === G.cobble) && (wk.coreCount[k]! >= 2 || wk.areaAsphalt[k] === 1)) junction[k] = 1;
  }
  const roadAt = (i: number, j: number): Road | undefined => {
    if (!inb(wk, i, j)) return undefined;
    const r = wk.roadId[idx(wk, i, j)]!;
    return r >= 0 ? wk.roads[r] : undefined;
  };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = idx(wk, i, j);
      if (junction[k] || !wk.roadCore[k]) continue;
      const road = roadAt(i, j);
      if (!road) continue;
      const g = wk.ground[k]!;
      if (g === G.bridge) {
        if (Math.abs(wk.roadPerp[k]!) < 0.5 + 1e-6 && wk.roadPerp[k]! > -0.5 + 1e-6)
          wk.marking[k] = wk.roadAxis[k] === AXIS_I ? M.dashI : wk.roadAxis[k] === AXIS_J ? M.dashJ : 0;
        continue;
      }
      if (!road.markings || g !== G.asphalt) continue;
      const axis = wk.roadAxis[k]!;
      if (axis === AXIS_NONE) continue;
      const [di, dj] = axis === AXIS_I ? [1, 0] : [0, 1];
      const isJ = (a: number, b: number): boolean => inb(wk, a, b) && junction[idx(wk, a, b)] === 1;
      const nearJ1 = isJ(i + di, j + dj) || isJ(i - di, j - dj);
      const nearJ2 = isJ(i + 2 * di, j + 2 * dj) || isJ(i - 2 * di, j - 2 * dj);
      if (nearJ1) wk.marking[k] = axis === AXIS_I ? M.zebraI : M.zebraJ;
      else if (nearJ2) wk.marking[k] = axis === AXIS_I ? M.stopI : M.stopJ;
      else {
        const p = wk.roadPerp[k]!;
        const core = road.width - 2 * road.sidewalk;
        if (core >= 3 && p > -0.5 + 1e-6 && p <= 0.5 + 1e-6) wk.marking[k] = axis === AXIS_I ? M.dashI : M.dashJ;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------------------------

function canDecor(wk: Work, i: number, j: number, spacing = 1): boolean {
  if (!inb(wk, i, j)) return false;
  const k = idx(wk, i, j);
  const g = wk.ground[k]!;
  if (!WALK[g] || g === G.asphalt || g === G.steps || g === G.bridge && wk.roadCore[k] === 1) return false;
  for (let y = j - spacing; y <= j + spacing; y++) {
    for (let x = i - spacing; x <= i + spacing; x++) {
      if (inb(wk, x, y) && wk.decorAt[idx(wk, x, y)]) return false;
    }
  }
  return true;
}

function putDecor(wk: Work, kind: string, i: number, j: number, axis?: 'i' | 'j'): void {
  const d: DecorPlacement = { kind, i, j, seed: wk.rng.nextU32() & 0xffff };
  if (axis) d.axis = axis;
  wk.decor.push(d);
  wk.decorAt[idx(wk, i, j)] = 1;
}

function placeDecor(wk: Work, doorTiles: Set<number>): void {
  const { w, h, rng, bp } = wk;
  const style = bp.style;
  // 1. Explicit decor from the blueprint (statues, kiosks, metro entrances…).
  // Snapped to the nearest free pavement tile when the authored tile is taken.
  for (const d of bp.decor) {
    const ci = Math.floor(d.at[0]);
    const cj = Math.floor(d.at[1]);
    let done = false;
    for (let r = 0; r <= 2 && !done; r++) {
      for (let dj = -r; dj <= r && !done; dj++) {
        for (let di = -r; di <= r && !done; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (!canDecor(wk, ci + di, cj + dj, 0)) continue;
          putDecor(wk, d.kind, ci + di, cj + dj, d.axis);
          done = true;
        }
      }
    }
  }
  const nearJunction = (i: number, j: number): boolean => {
    for (let y = j - 1; y <= j + 1; y++) {
      for (let x = i - 1; x <= i + 1; x++) {
        if (!inb(wk, x, y)) continue;
        const k = idx(wk, x, y);
        if (wk.marking[k] === M.zebraI || wk.marking[k] === M.zebraJ || (wk.coreCount[k]! >= 2 && wk.ground[k] === G.asphalt)) return true;
      }
    }
    return false;
  };
  const sideOf = (k: number): number => (wk.roadPerp[k]! < 0 ? 0 : 1);
  // 2. Trees + lamps along roads (inner sidewalk row).
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = idx(wk, i, j);
      if (wk.ground[k] !== G.sidewalk || wk.roadCore[k]) continue;
      const r = wk.roadId[k]!;
      if (r < 0) continue;
      const road = wk.roads[r]!;
      if (road.cls === 'lane' || doorTiles.has(k) || nearJunction(i, j)) continue;
      const axis = wk.roadAxis[k] === AXIS_I ? 'i' : wk.roadAxis[k] === AXIS_J ? 'j' : undefined;
      const t = Math.round(wk.roadT[k]!);
      const kerbside = Math.abs(wk.roadPerp[k]!) < road.width / 2 - road.sidewalk + 1;
      if (road.trees && kerbside && t % 3 === 0 && canDecor(wk, i, j, 0)) {
        putDecor(wk, road.trees, i, j);
        continue;
      }
      const lampEvery = road.cls === 'avenue' ? 6 : 8;
      const lampPhase = road.trees ? 4 : sideOf(k) * (lampEvery / 2);
      if (road.name && kerbside && (t + lampPhase) % lampEvery === 0 && canDecor(wk, i, j, 0)) {
        putDecor(wk, 'lamp', i, j, axis);
        continue;
      }
      if (road.cafes && !kerbside && rng.chance(0.3) && canDecor(wk, i, j, 1)) {
        putDecor(wk, 'cafe', i, j, axis);
        continue;
      }
      if (road.cafes && rng.chance(0.18) && canDecor(wk, i, j, 1)) {
        putDecor(wk, 'cafe', i, j, axis);
        continue;
      }
      for (const p of style.sidewalkProps) {
        if (p.kind === 'busstop' && road.cls !== 'avenue') continue;
        if (rng.chance(p.p) && canDecor(wk, i, j, 2)) {
          putDecor(wk, p.kind, i, j, axis);
          break;
        }
      }
    }
  }
  // 3. Bridge lamps.
  for (let k = 0; k < w * h; k++) {
    if (wk.ground[k] !== G.bridge || wk.roadCore[k]) continue;
    const i = k % w;
    const j = (k - i) / w;
    if (Math.round(wk.roadT[k]!) % 4 === 1 && canDecor(wk, i, j, 0)) {
      wk.decor.push({ kind: 'lamp', i, j, seed: 0 });
      wk.decorAt[k] = 1;
    }
  }
  // 4. Plazas: lamps on a loose lattice near edges, benches, bins, city props.
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = idx(wk, i, j);
      if (wk.ground[k] !== G.plaza || doorTiles.has(k)) continue;
      const edge = DIRS4.some(([di, dj]) => {
        const ni = i + di;
        const nj = j + dj;
        return inb(wk, ni, nj) && wk.ground[idx(wk, ni, nj)] !== G.plaza;
      });
      if (edge && (i * 7 + j * 3) % 5 === 0 && canDecor(wk, i, j, 2)) {
        putDecor(wk, 'lamp', i, j);
        continue;
      }
      for (const p of style.plazaProps) {
        if (rng.chance(p.p) && canDecor(wk, i, j, 2)) {
          putDecor(wk, p.kind, i, j);
          break;
        }
      }
    }
  }
  // 5. Parks: scattered trees on grass, benches + lamps along paths.
  for (const a of bp.areas) {
    if (!a.trees) continue;
    const { kinds, density } = a.trees;
    forShape(wk, a.shape, (i, j) => {
      const k = idx(wk, i, j);
      if (wk.ground[k] !== G.grass) return;
      if (rng.chance(density) && canDecor(wk, i, j, 1)) putDecor(wk, rng.pick(kinds), i, j);
    });
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = idx(wk, i, j);
      if (wk.ground[k] !== G.parkPath) continue;
      if (rng.chance(0.06) && canDecor(wk, i, j, 2)) putDecor(wk, rng.chance(0.5) ? 'bench' : 'lamp', i, j);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

function snapWalkable(wk: Work, p: P): TilePos {
  const ci = Math.floor(p[0]);
  const cj = Math.floor(p[1]);
  for (let r = 0; r < 20; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di;
        const j = cj + dj;
        if (inb(wk, i, j) && WALK[wk.ground[idx(wk, i, j)]!] && wk.ground[idx(wk, i, j)] !== G.steps)
          return { i, j };
      }
    }
  }
  return { i: ci, j: cj };
}

/** Rasterise a blueprint into a MapData. `seed` varies buildings/decor, not the layout. */
export function rasterize(bp: Blueprint, seed = 0): MapData {
  const n = bp.w * bp.h;
  const wk: Work = {
    bp,
    rng: new Rng((bp.seed ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0),
    w: bp.w,
    h: bp.h,
    ground: new Uint8Array(n).fill(G.lot),
    marking: new Uint8Array(n),
    building: new Int16Array(n).fill(-1),
    reserved: new Uint8Array(n),
    roadId: new Int16Array(n).fill(-1),
    roadCore: new Uint8Array(n),
    roadRank: new Int16Array(n).fill(-1),
    roadT: new Float32Array(n),
    roadPerp: new Float32Array(n),
    roadAxis: new Uint8Array(n),
    coreCount: new Uint8Array(n),
    coreLast: new Int16Array(n).fill(-1),
    areaAsphalt: new Uint8Array(n),
    roads: [],
    buildings: [],
    decor: [],
    decorAt: new Uint8Array(n),
  };

  paintAreas(wk, 'base');
  paintRivers(wk);
  for (const def of bp.roads) {
    const road = makeRoad(wk.roads.length, def, false);
    wk.roads.push(road);
    paintRoad(wk, road);
  }
  paintAreas(wk, 'top');
  paintBridges(wk);
  const { landmarks, steps } = placeFixed(wk);
  cutLanes(wk);
  fillBuildings(wk);
  paveSlivers(wk);
  assignDoors(wk);
  paintMarkings(wk);
  const doorTiles = new Set<number>();
  for (const b of wk.buildings) for (const d of b.doors) doorTiles.add(idx(wk, d.i, d.j));
  placeDecor(wk, doorTiles);

  const fp = CAPITOL_FOOTPRINT[bp.city];
  const spawns: SpawnDistrict[] = bp.districts.map((d) => {
    const [i0, j0, i1, j1] = d.area;
    const ids = wk.buildings
      .filter((b) => {
        const ci = b.i + b.w / 2;
        const cj = b.j + b.d / 2;
        return b.kind === 'residential' && b.doors.length > 0 && ci >= i0 && ci <= i1 + 1 && cj >= j0 && cj <= j1 + 1;
      })
      .map((b) => b.id);
    return { id: d.id, name: d.name, unlockWave: d.unlockWave, buildingIds: ids, rally: snapWalkable(wk, d.rally) };
  });

  const toPos = (p: P): TilePos => ({ i: p[0], j: p[1] });
  const streets: StreetLabel[] = [];
  for (const r of wk.roads) {
    if (!r.name) continue;
    streets.push({ name: r.name, path: (r.def.labelPath ?? r.def.path).map(toPos), width: r.width });
  }
  const chokepoints: Chokepoint[] = bp.chokepoints.map((c) => ({
    name: c.name,
    i: Math.floor(c.at[0]),
    j: Math.floor(c.at[1]),
    radius: c.radius,
  }));

  const stepsMid = steps[Math.floor(steps.length / 2)] ?? { i: bp.capitol.i, j: bp.capitol.j + fp.d };
  return {
    city: bp.city,
    name: bp.name,
    w: bp.w,
    h: bp.h,
    ground: wk.ground,
    marking: wk.marking,
    building: wk.building,
    buildings: wk.buildings,
    capitol: { i: bp.capitol.i, j: bp.capitol.j, w: fp.w, d: fp.d, steps },
    landmarks,
    spawns,
    streets,
    decor: wk.decor,
    chokepoints,
    cameraStart: bp.cameraStart ?? { i: stepsMid.i, j: stepsMid.j + 5 },
  };
}
