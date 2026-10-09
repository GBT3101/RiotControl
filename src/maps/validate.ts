/**
 * Map validators (M2). `validateMap` checks the tile-level invariants every consumer relies on;
 * passing the blueprint as well enables the design checks (approach redundancy, rooftops along
 * every approach, chokepoints actually on the flow).
 */
import type { Blueprint, P } from './blueprint';
import {
  GROUNDS,
  LANDMARKS,
  PLACEABLE_ROAD,
  WALKABLE,
  type MapData,
  type TilePos,
} from './contract';
import { descend, distanceField } from './flow';

export interface Issue {
  level: 'error' | 'warn';
  code: string;
  msg: string;
}

const G = Object.fromEntries(GROUNDS.map((g, k) => [g, k])) as Record<
  (typeof GROUNDS)[number],
  number
>;
const WALK = GROUNDS.map((g) => WALKABLE.has(g));
const ROAD = GROUNDS.map((g) => PLACEABLE_ROAD.has(g));

/** Tiles within `r` (Euclidean, tile centres) of a polyline. */
export function tilesNearPath(
  map: MapData,
  path: readonly P[] | readonly TilePos[],
  r: number,
): number[] {
  const pts: P[] = path.map((p) => ('i' in p ? ([p.i, p.j] as const) : p));
  const out = new Set<number>();
  for (let s = 0; s < Math.max(1, pts.length - 1); s++) {
    const a = pts[s]!;
    const b = pts[Math.min(s + 1, pts.length - 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const i0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r - 1));
    const i1 = Math.min(map.w - 1, Math.ceil(Math.max(a[0], b[0]) + r + 1));
    const j0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r - 1));
    const j1 = Math.min(map.h - 1, Math.ceil(Math.max(a[1], b[1]) + r + 1));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = i + 0.5;
        const cy = j + 0.5;
        const t =
          len2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - a[0]) * dx + (cy - a[1]) * dy) / len2));
        const px = a[0] + t * dx - cx;
        const py = a[1] + t * dy - cy;
        if (px * px + py * py <= r * r) out.add(j * map.w + i);
      }
    }
  }
  return [...out];
}

/** All spawn door tiles of a map (deduplicated). */
export function spawnDoors(map: MapData): TilePos[] {
  const seen = new Set<number>();
  const out: TilePos[] = [];
  for (const s of map.spawns) {
    for (const id of s.buildingIds) {
      for (const d of map.buildings[id]?.doors ?? []) {
        const k = d.j * map.w + d.i;
        if (!seen.has(k)) {
          seen.add(k);
          out.push(d);
        }
      }
    }
  }
  return out;
}

export function validateMap(map: MapData, bp?: Blueprint): Issue[] {
  const issues: Issue[] = [];
  const err = (code: string, msg: string): void => void issues.push({ level: 'error', code, msg });
  const warn = (code: string, msg: string): void => void issues.push({ level: 'warn', code, msg });
  const { w, h, ground, building } = map;
  const n = w * h;
  const inb = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < w && j < h;
  const walk = (i: number, j: number): boolean => inb(i, j) && WALK[ground[j * w + i]!] === true;

  if (ground.length !== n || map.marking.length !== n || building.length !== n) {
    err('size', 'tile arrays do not match w×h');
    return issues;
  }

  // --- Fixed footprints (capitol + landmarks): lot, no building.
  const fixed = new Uint8Array(n);
  const markFixed = (label: string, i0: number, j0: number, fw: number, fd: number): void => {
    for (let j = j0; j < j0 + fd; j++) {
      for (let i = i0; i < i0 + fw; i++) {
        if (!inb(i, j)) {
          err('fixed.bounds', `${label} footprint leaves the map at ${i},${j}`);
          continue;
        }
        const k = j * w + i;
        if (fixed[k]) err('fixed.overlap', `${label} overlaps another landmark at ${i},${j}`);
        fixed[k] = 1;
        if (ground[k] !== G.lot)
          err('fixed.ground', `${label} tile ${i},${j} is ${GROUNDS[ground[k]!]}, not lot`);
        if (building[k] !== -1)
          err('fixed.building', `${label} tile ${i},${j} carries building ${building[k]}`);
      }
    }
  };
  const c = map.capitol;
  markFixed('Capitol', c.i, c.j, c.w, c.d);
  for (const l of map.landmarks) {
    const def = LANDMARKS[l.id];
    if (def.city !== map.city) err('landmark.city', `${l.id} belongs to ${def.city}`);
    markFixed(def.label, l.i, l.j, def.w, def.d);
  }

  // --- Buildings.
  const seenTiles = new Uint8Array(n);
  for (const b of map.buildings) {
    if (b.storeys < 2 || b.storeys > 6)
      err('bld.storeys', `building ${b.id} has ${b.storeys} storeys`);
    if (b.w < 2 || b.d < 2 || b.w > 6 || b.d > 6 || Math.min(b.w, b.d) > 4)
      err('bld.size', `building ${b.id} footprint ${b.w}×${b.d} outside 2×2..6×4`);
    for (let j = b.j; j < b.j + b.d; j++) {
      for (let i = b.i; i < b.i + b.w; i++) {
        if (!inb(i, j)) {
          err('bld.bounds', `building ${b.id} leaves the map`);
          continue;
        }
        const k = j * w + i;
        if (ground[k] !== G.lot)
          err('bld.ground', `building ${b.id} sits on ${GROUNDS[ground[k]!]} at ${i},${j}`);
        if (fixed[k]) err('bld.fixed', `building ${b.id} overlaps a landmark/Capitol at ${i},${j}`);
        if (building[k] !== b.id) err('bld.index', `building index mismatch at ${i},${j}`);
        seenTiles[k] = 1;
      }
    }
    for (const d of b.doors) {
      const adj =
        (d.i >= b.i && d.i < b.i + b.w && (d.j === b.j - 1 || d.j === b.j + b.d)) ||
        (d.j >= b.j && d.j < b.j + b.d && (d.i === b.i - 1 || d.i === b.i + b.w));
      if (!adj) err('bld.door', `building ${b.id} door ${d.i},${d.j} not adjacent`);
      if (!walk(d.i, d.j)) err('bld.door', `building ${b.id} door ${d.i},${d.j} not walkable`);
    }
  }
  for (let k = 0; k < n; k++) {
    if (building[k]! >= 0 && !seenTiles[k]) err('bld.index', `stray building index at tile ${k}`);
  }

  // --- Steps.
  if (c.steps.length === 0) err('steps.none', 'Capitol has no steps');
  for (const s of c.steps) {
    if (!inb(s.i, s.j) || ground[s.j * w + s.i] !== G.steps)
      err('steps.ground', `steps tile ${s.i},${s.j} is not 'steps'`);
    if (s.j < c.j + c.d || s.i < c.i || s.i >= c.i + c.w)
      err('steps.side', `steps tile ${s.i},${s.j} not on the +j front`);
  }

  // --- Connectivity from the steps.
  const field = distanceField(map, c.steps, { costs: false });
  let unreachableWalk = 0;
  let unreachableRoad = 0;
  for (let k = 0; k < n; k++) {
    if (!Number.isFinite(field[k]!)) {
      if (WALK[ground[k]!]) unreachableWalk++;
      if (ROAD[ground[k]!]) unreachableRoad++;
    }
  }
  if (unreachableRoad > 0)
    err('reach.road', `${unreachableRoad} road tiles cannot reach the Capitol`);
  else if (unreachableWalk > 0)
    warn('reach.walk', `${unreachableWalk} walkable tiles cannot reach the Capitol`);

  // --- Spawns.
  if (map.spawns.length < 5 || map.spawns.length > 7)
    warn('spawn.count', `${map.spawns.length} spawn districts (want 5–7)`);
  if (map.spawns.filter((s) => s.unlockWave === 1).length < 1)
    err('spawn.wave1', 'no district unlocks on wave 1');
  if (Math.max(...map.spawns.map((s) => s.unlockWave)) > 8)
    warn('spawn.late', 'a district unlocks after wave 8');
  for (const s of map.spawns) {
    if (s.buildingIds.length < 5)
      err('spawn.buildings', `${s.name} has only ${s.buildingIds.length} spawn buildings`);
    let doors = 0;
    for (const id of s.buildingIds) {
      const b = map.buildings[id];
      if (!b) {
        err('spawn.id', `${s.name} references missing building ${id}`);
        continue;
      }
      if (b.kind !== 'residential')
        err('spawn.kind', `${s.name} building ${id} is not residential`);
      for (const d of b.doors) {
        doors++;
        if (!Number.isFinite(field[d.j * w + d.i]!))
          err('spawn.reach', `${s.name} door ${d.i},${d.j} cannot reach the steps`);
      }
    }
    if (doors === 0) err('spawn.doors', `${s.name} has no doors`);
    if (!walk(s.rally.i, s.rally.j) || !Number.isFinite(field[s.rally.j * w + s.rally.i]!))
      err('spawn.rally', `${s.name} rally ${s.rally.i},${s.rally.j} is not reachable`);
  }

  // --- Chokepoints.
  if (map.chokepoints.length < 2) err('choke.count', `only ${map.chokepoints.length} chokepoints`);
  for (const ch of map.chokepoints) {
    if (!walk(ch.i, ch.j)) err('choke.walk', `chokepoint ${ch.name} is not on a walkable tile`);
  }

  // --- Rooftops.
  const roofs = map.buildings.filter((b) => b.rooftop);
  if (roofs.length < 12) err('roof.count', `only ${roofs.length} rooftop buildings`);

  // --- Decor.
  for (const d of map.decor) {
    if (!inb(d.i, d.j)) err('decor.bounds', `decor ${d.kind} out of bounds`);
    else if (building[d.j * w + d.i] !== -1 || fixed[d.j * w + d.i])
      err('decor.blocked', `decor ${d.kind} on a building at ${d.i},${d.j}`);
  }

  if (bp) designChecks(map, bp, field, issues);
  return issues;
}

function designChecks(map: MapData, bp: Blueprint, field: Float32Array, issues: Issue[]): void {
  const err = (code: string, msg: string): void => void issues.push({ level: 'error', code, msg });
  const { w } = map;
  const finals = bp.approaches.filter((a) => a.final);
  if (finals.length < 3)
    err('approach.finals', `only ${finals.length} final approaches (need ≥ 3 directions)`);
  if (bp.approaches.length < 4) err('approach.count', `only ${bp.approaches.length} approaches`);

  // Rooftop buildings line every approach.
  const roofTiles = new Map<number, number>();
  for (const b of map.buildings) {
    if (!b.rooftop) continue;
    for (let j = b.j; j < b.j + b.d; j++)
      for (let i = b.i; i < b.i + b.w; i++) roofTiles.set(j * w + i, b.id);
  }
  for (const a of bp.approaches) {
    const near = new Set<number>();
    for (const k of tilesNearPath(map, a.path, 6)) {
      const id = roofTiles.get(k);
      if (id !== undefined) near.add(id);
    }
    if (near.size < 2)
      err('approach.roofs', `${a.name}: only ${near.size} rooftop buildings along it`);
    for (const k of tilesNearPath(map, a.path, 0.5)) {
      if (!WALK[map.ground[k]!] && map.building[k] === -1 && map.ground[k] !== G.lot) {
        // Water/quay on an approach line means the path is mis-authored.
        err(
          'approach.path',
          `${a.name} crosses ${GROUNDS[map.ground[k]!]} at ${k % w},${Math.floor(k / w)}`,
        );
        break;
      }
    }
  }

  // Redundancy: blocking any single final approach must leave the steps reachable from every
  // district (the steps are reachable from ≥ 3 independent directions).
  const rallies = map.spawns.map((s) => s.rally);
  for (const a of finals) {
    const blocked = new Uint8Array(map.w * map.h);
    for (const k of tilesNearPath(map, a.path, 2.5)) blocked[k] = 1;
    const f = distanceField(map, map.capitol.steps, { costs: false, blocked });
    for (const r of rallies) {
      if (!Number.isFinite(f[r.j * w + r.i]!))
        err('approach.redundant', `blocking ${a.name} cuts off a district at ${r.i},${r.j}`);
    }
    // And the final approach must actually lead to the steps.
    const mid = a.path[a.path.length - 1]!;
    const mk = Math.floor(mid[1]) * w + Math.floor(mid[0]);
    if (!Number.isFinite(field[mk]!))
      err('approach.reach', `${a.name} end is not connected to the steps`);
  }

  // Chokepoints lie on at least one district's shortest route (costed flow).
  const costField = distanceField(map, map.capitol.steps, { costs: true });
  const routes = rallies.map((r) => descend(map, costField, r));
  for (const ch of map.chokepoints) {
    const hit = routes.some((route) =>
      route.some((p) => Math.hypot(p.i - ch.i, p.j - ch.j) <= ch.radius + 1.5),
    );
    if (!hit) err('choke.flow', `chokepoint ${ch.name} is not on any district's shortest route`);
  }
}
