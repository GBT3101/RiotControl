/**
 * Deployment validation & execution (PLAN §1.3 placement rules, §1.7 deploy flow).
 *
 * - road: PLACEABLE_ROAD ground, no blockade, no ground unit on the tile.
 * - blockade: road rule; snaps across the road width (up to `maxTiles` tiles centred on the
 *   picked tile, along the axis where the road is narrower).
 * - rooftop: a building with `rooftop: true` and no rooftop unit yet (one per building; the
 *   Sniper Brigade is a squad of 3 on one roof).
 * - air: anywhere on the map.
 */
import { BALANCE } from '../data/balance';
import { UNITS, type UnitId } from '../data/units';
import type { TilePos } from '../maps/contract';
import { PS } from './crowd';
import { spendHate } from './economy';
import { facing4, US, type Unit } from './units';
import type { World } from './world';

export type DeployFail =
  'phase' | 'locked' | 'hate' | 'bounds' | 'notRoad' | 'occupied' | 'notRooftop' | 'roofTaken';

export interface DeployCheck {
  ok: boolean;
  reason: DeployFail | null;
  unit: UnitId;
  cost: number;
  /** Tiles the unit would occupy (ghost preview; blockades span up to 3). */
  tiles: TilePos[];
  /** Rooftop target building index, -1. */
  building: number;
  /** Where the unit would stand (continuous tiles). */
  x: number;
  y: number;
}

/** Helicopter flight height in storeys (view). */
export const HELI_ALTITUDE = 4;

function fail(
  unit: UnitId,
  reason: DeployFail,
  i: number,
  j: number,
  tiles: TilePos[] = [],
): DeployCheck {
  return {
    ok: false,
    reason,
    unit,
    cost: UNITS[unit].cost,
    tiles,
    building: -1,
    x: i + 0.5,
    y: j + 0.5,
  };
}

/** Is a ground unit standing on tile t (stationary or moving)? */
export function groundUnitOnTile(w: World, t: number): boolean {
  if (w.unitTile[t]! >= 0) return true;
  const mw = w.map.w;
  for (const u of w.units.active) {
    if (!u.alive || u.building >= 0 || u.def.placement !== 'road' || u.type === 'blockade')
      continue;
    if (Math.floor(u.y) * mw + Math.floor(u.x) === t) return true;
  }
  return false;
}

function freeRoad(w: World, i: number, j: number): boolean {
  if (!w.nav.inBounds(i, j)) return false;
  const t = j * w.map.w + i;
  return w.nav.road[t] === 1 && w.nav.blockade[t]! < 0 && !groundUnitOnTile(w, t);
}

/** Blockade tiles for a pick at (i, j): across the narrower road axis, up to `max` tiles. */
export function blockadeTiles(w: World, i: number, j: number, max: number): TilePos[] {
  const nav = w.nav;
  const road = (a: number, b: number): boolean =>
    nav.inBounds(a, b) && nav.road[b * w.map.w + a] === 1;
  const run = (di: number, dj: number): number => {
    let n = 0;
    while (n < 12 && road(i + di * (n + 1), j + dj * (n + 1))) n++;
    return n;
  };
  const runI = run(1, 0) + run(-1, 0) + 1; // extent along i
  const runJ = run(0, 1) + run(0, -1) + 1; // extent along j
  // The road runs along the longer axis; the blockade spans the shorter one.
  const [di, dj] = runI <= runJ ? [1, 0] : [0, 1];
  const tiles: TilePos[] = [{ i, j }];
  let lo = 0;
  let hi = 0;
  let openLo = true;
  let openHi = true;
  while (tiles.length < max && (openLo || openHi)) {
    if (openHi) {
      const o = hi + 1;
      if (freeRoad(w, i + di * o, j + dj * o)) {
        hi = o;
        tiles.push({ i: i + di * o, j: j + dj * o });
      } else openHi = false;
    }
    if (tiles.length >= max) break;
    if (openLo) {
      const o = lo - 1;
      if (freeRoad(w, i + di * o, j + dj * o)) {
        lo = o;
        tiles.unshift({ i: i + di * o, j: j + dj * o });
      } else openLo = false;
    }
  }
  return tiles;
}

export function checkDeploy(w: World, unit: UnitId, i: number, j: number): DeployCheck {
  const def = UNITS[unit];
  if (w.phase !== 'playing') return fail(unit, 'phase', i, j);
  if (def.level > w.economy.level) return fail(unit, 'locked', i, j);
  if (!w.nav.inBounds(i, j)) return fail(unit, 'bounds', i, j);
  const t = j * w.map.w + i;
  let tiles: TilePos[] = [{ i, j }];
  let building = -1;
  let x = i + 0.5;
  let y = j + 0.5;
  if (def.placement === 'road') {
    if (w.nav.road[t] !== 1) return fail(unit, 'notRoad', i, j);
    if (!freeRoad(w, i, j)) return fail(unit, 'occupied', i, j);
    if (unit === 'blockade') {
      tiles = blockadeTiles(w, i, j, def.maxTiles);
      x = 0;
      y = 0;
      for (const p of tiles) {
        x += p.i + 0.5;
        y += p.j + 0.5;
      }
      x /= tiles.length;
      y /= tiles.length;
    }
  } else if (def.placement === 'rooftop') {
    building = w.map.building[t]!;
    const b = building >= 0 ? w.map.buildings[building] : undefined;
    if (!b || !b.rooftop) return fail(unit, 'notRooftop', i, j);
    if (w.roofUnit[building]! >= 0) return { ...fail(unit, 'roofTaken', i, j), building };
    x = b.i + b.w * 0.5;
    y = b.j + b.d * 0.5;
    tiles = [];
    for (let bj = b.j; bj < b.j + b.d; bj++)
      for (let bi = b.i; bi < b.i + b.w; bi++) tiles.push({ i: bi, j: bj });
  }
  if (w.economy.hate < def.cost) {
    return { ok: false, reason: 'hate', unit, cost: def.cost, tiles, building, x, y };
  }
  return { ok: true, reason: null, unit, cost: def.cost, tiles, building, x, y };
}

/** Deploy if valid; returns the unit or null (see `checkDeploy` for the reason). */
export function deployUnit(w: World, unit: UnitId, i: number, j: number): Unit | null {
  const chk = checkDeploy(w, unit, i, j);
  if (!chk.ok) return null;
  if (!spendHate(w, chk.cost, unit)) return null;
  const def = UNITS[unit];
  const u = w.units.alloc(unit);
  u.x = u.px = chk.x;
  u.y = u.py = chk.y;
  const mw = w.map.w;
  const t = j * mw + i;
  // Face up-stream (where the crowds come from).
  w.nav.sample(chk.x, chk.y);
  if (w.nav.sx !== 0 || w.nav.sy !== 0) u.facing = facing4(-w.nav.sx, -w.nav.sy);
  if (unit === 'blockade') {
    u.tiles = chk.tiles.map((p) => p.j * mw + p.i);
    if (u.holders.length !== def.meleeSlots * u.tiles.length) {
      u.holders = new Int32Array(def.meleeSlots * u.tiles.length).fill(-1);
    }
    for (const bt of u.tiles) {
      w.nav.setBlockade(bt, u.slot);
      evictFromTile(w, bt);
    }
  } else if (def.placement === 'road') {
    u.tile = t;
    w.unitTile[t] = u.slot;
    w.nav.addUnitCost(t, BALANCE.unitTileCost);
  } else if (def.placement === 'rooftop') {
    const b = w.map.buildings[chk.building]!;
    u.building = chk.building;
    u.z = b.storeys;
    w.roofUnit[chk.building] = u.slot;
    w.refreshRoofList();
  } else {
    u.z = HELI_ALTITUDE;
  }
  u.state = US.IDLE;
  w.stats.unitsDeployed[unit]++;
  w.events.push('unitDeployed', { unitId: u.id, unit, x: u.x, y: u.y, building: u.building });
  return u;
}

const evictBuf = new Int32Array(256);

/** Push protesters standing on a freshly blocked tile to its up-stream free neighbour. */
function evictFromTile(w: World, t: number): void {
  const mw = w.map.w;
  const ti = t % mw;
  const tj = (t - ti) / mw;
  const nav = w.nav;
  let bestT = -1;
  let bestD = -1;
  for (let k = 0; k < 4; k++) {
    const ni = ti + (k === 0 ? 1 : k === 1 ? -1 : 0);
    const nj = tj + (k === 2 ? 1 : k === 3 ? -1 : 0);
    if (!nav.inBounds(ni, nj)) continue;
    const n = nj * mw + ni;
    if (nav.solid[n]) continue;
    const d = nav.dist[n]!;
    const score = d === Infinity ? 1e9 : d;
    if (score > bestD) {
      bestD = score;
      bestT = n;
    }
  }
  if (bestT < 0) return;
  const c = w.crowd;
  const n = w.hash.query(c, ti + 0.5, tj + 0.5, 0.75, evictBuf);
  const bi = bestT % mw;
  const bj = (bestT - bi) / mw;
  for (let k = 0; k < n; k++) {
    const s = evictBuf[k]!;
    if (Math.floor(c.x[s]!) !== ti || Math.floor(c.y[s]!) !== tj) continue;
    const st = c.state[s]!;
    if (st === PS.CLIMBING || st === PS.ON_ROOF || st === PS.CLIMB_DOWN) continue;
    c.x[s] = c.px[s] = bi + 0.2 + w.rng.next() * 0.6;
    c.y[s] = c.py[s] = bj + 0.2 + w.rng.next() * 0.6;
  }
}
