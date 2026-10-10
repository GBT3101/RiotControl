/**
 * Wave forecast (read-only): which spawn districts release protesters in the upcoming wave (or
 * the current one, for its first seconds), how many protesters to expect from each, which
 * protester types lead the mix and the route each district's crowd will take to the Capitol.
 * The HUD's incoming-wave markers, edge arrows and minimap flags are drawn from it.
 *
 * It only reads World / Director state (never the sim RNG), so asking for a forecast any number
 * of times keeps runs deterministic. Where the director keeps its state private, the forecast
 * recomputes it from the same data the director uses:
 *
 * - districts: `Director.activeDistricts(wave)` (public) — "new" = not active the wave before.
 * - size: `waveSize(wave, level, time)`; a breather's wave starts `breather` seconds from now.
 *   Door groups pick a district uniformly at random, so each district expects size / n.
 * - types: `unlockedProtesters(level)` at the wave's start; the director boosts the newest
 *   (`newestBoost` within `newestWindow` levels). Types joining the mix for the first time are
 *   those unlocked since the previous wave began — the director's `joined` map is private, so
 *   `Forecaster` remembers the level at each wave start it observes.
 * - Breta is a 1% roll per door group (not known ahead); once she is out, her district is known.
 */
import { BALANCE, waveSize } from '../data/balance';
import { protesterUnlockLevel, unlockedProtesters } from '../data/levels';
import type { ProtesterId } from '../data/protesters';
import type { TilePos } from '../maps/contract';
import type { DirectorPhase } from './director';
import type { World } from './world';

/** Per-district crowd tiers by expected protesters (1 = a handful … 3 = a horde). */
export const THREAT_TIERS: readonly number[] = [40, 150];

export interface DistrictForecast {
  /** Index into `map.spawns`. */
  district: number;
  id: string;
  name: string;
  /** Where the crowd gathers (the marker spot): the rally tile, else the first door. */
  rally: TilePos;
  /** First wave in which this district releases protesters. */
  isNew: boolean;
  /** Expected regular protesters from this district (wave size / active districts). */
  expected: number;
  /** 1 (a handful) … 3 (a horde), see THREAT_TIERS. */
  threat: 1 | 2 | 3;
  /** Breta is out and came from this district (only known once she spawned). */
  breta: boolean;
}

export interface WaveForecast {
  /** The wave these districts release (upcoming in prep / breather, current during a wave). */
  wave: number;
  phase: DirectorPhase;
  /** Seconds until the wave starts (breather countdown; 0 during the wave; -1 in prep). */
  eta: number;
  /** Expected regular protesters in the whole wave. */
  size: number;
  districts: DistrictForecast[];
  /** Protester types in the mix, oldest first. */
  types: ProtesterId[];
  /** Types joining the mix for the first time in this wave (none of the level-0 basics). */
  newTypes: ProtesterId[];
  /** The type the director weights the mix toward: newest boosted type, else null. */
  lead: ProtesterId | null;
}

/** The wave a forecast is about: the next one before it starts, the current one during it. */
export function forecastWaveIndex(w: World): number {
  const d = w.director;
  return d.phase === 'wave' ? Math.max(1, d.wave) : d.wave + 1;
}

/** Districts active in `wave` (director rule) and whether each one is new in that wave. */
export function forecastDistricts(w: World, wave: number): { district: number; isNew: boolean }[] {
  const d = w.director;
  const now = d.activeDistricts(wave);
  const before = wave > 1 ? new Set(d.activeDistricts(wave - 1)) : null;
  return now.map((k) => ({ district: k, isNew: before !== null && !before.has(k) }));
}

/** Threat tier of an expected per-district crowd. */
export function threatTier(expected: number): 1 | 2 | 3 {
  return expected < THREAT_TIERS[0]! ? 1 : expected < THREAT_TIERS[1]! ? 2 : 3;
}

/**
 * Newest boosted type of the mix at `level` (the director's `newestBoost` rule), or null when
 * only the level-0 basics are in it.
 */
export function leadType(level: number): ProtesterId | null {
  const win = BALANCE.waves.newestWindow;
  let best: ProtesterId | null = null;
  let bestLevel = 0;
  for (const id of unlockedProtesters(level)) {
    const ul = protesterUnlockLevel(id);
    if (ul > 0 && ul >= level - win && ul > bestLevel) {
      best = id;
      bestLevel = ul;
    }
  }
  return best;
}

/** Types unlocked after `prevLevel` up to `level` (level-0 basics never count as new). */
export function typesJoining(prevLevel: number, level: number): ProtesterId[] {
  return unlockedProtesters(level).filter((id) => {
    const ul = protesterUnlockLevel(id);
    return ul > 0 && ul > prevLevel;
  });
}

/** Marker tile of a district: its rally point if walkable, else its first walkable door. */
export function districtSpot(w: World, district: number): TilePos | null {
  const s = w.map.spawns[district];
  if (!s) return null;
  const nav = w.nav;
  const ok = (i: number, j: number): boolean =>
    nav.inBounds(i, j) && nav.walk[j * w.map.w + i] === 1;
  if (ok(s.rally.i, s.rally.j)) return { i: s.rally.i, j: s.rally.j };
  for (const bid of s.buildingIds) {
    for (const door of w.map.buildings[bid]?.doors ?? []) {
      if (ok(door.i, door.j)) return { i: door.i, j: door.j };
    }
  }
  return null;
}

/**
 * Route (tile indices) from a tile down the Capitol flow field to the steps, following the same
 * neighbour choice as `Nav.recompute` (so it bends around blockades exactly like the crowd's
 * field does). Empty when the start is unreachable. At most `maxTiles` long.
 */
export function routeFrom(w: World, i: number, j: number, maxTiles = 400): number[] {
  const nav = w.nav;
  if (!nav.inBounds(i, j)) return [];
  const W = w.map.w;
  let t = j * W + i;
  if (!nav.walk[t] || nav.dist[t] === Infinity) return [];
  const out = [t];
  while (out.length < maxTiles && nav.dist[t]! > 0) {
    const fx = nav.flowX[t]!;
    const fy = nav.flowY[t]!;
    const dx = fx > 0.1 ? 1 : fx < -0.1 ? -1 : 0;
    const dy = fy > 0.1 ? 1 : fy < -0.1 ? -1 : 0;
    if (dx === 0 && dy === 0) break;
    const n = t + dy * W + dx;
    if (nav.dist[n]! >= nav.dist[t]!) break;
    t = n;
    out.push(t);
  }
  return out;
}

/** District route from its marker spot to the Capitol steps (tile indices). */
export function districtRoute(w: World, district: number, maxTiles = 400): number[] {
  const s = districtSpot(w, district);
  return s ? routeFrom(w, s.i, s.j, maxTiles) : [];
}

/**
 * Stateless forecast. `prevWaveLevel` = the player level when the wave before the forecast
 * wave began (-1 unknown → no "new types"); `Forecaster` tracks it.
 */
export function waveForecast(w: World, prevWaveLevel = -1): WaveForecast {
  const d = w.director;
  const wave = forecastWaveIndex(w);
  const inWave = d.phase === 'wave';
  const eta = d.phase === 'breather' ? Math.max(0, d.breather) : d.phase === 'prep' ? -1 : 0;
  const level = w.level;
  const size = inWave ? d.waveSize : waveSize(wave, level, w.time + Math.max(0, eta));
  const list = forecastDistricts(w, wave);
  const each = list.length > 0 ? size / list.length : 0;
  const breta = w.bretaSlot >= 0 ? w.crowd.district[w.bretaSlot]! : -1;
  const districts: DistrictForecast[] = [];
  for (const { district, isNew } of list) {
    const s = w.map.spawns[district]!;
    const spot = districtSpot(w, district);
    if (!spot) continue;
    districts.push({
      district,
      id: s.id,
      name: s.name,
      rally: spot,
      isNew,
      expected: Math.round(each),
      threat: threatTier(each),
      breta: breta === district,
    });
  }
  return {
    wave,
    phase: d.phase,
    eta,
    size,
    districts,
    types: unlockedProtesters(level),
    newTypes: prevWaveLevel >= 0 ? typesJoining(prevWaveLevel, level) : [],
    lead: leadType(level),
  };
}

/**
 * Stateful wrapper: remembers the player level at each wave start it observes (call `update`
 * at least a few times per second) so forecasts can name the types joining the mix, and caches
 * district routes (recomputed when the flow field changes).
 */
export class Forecaster {
  /** Level at the start of each observed wave (index = wave). */
  private readonly waveLevel: number[] = [];
  private lastWave = 0;
  private routes: number[][] = [];
  private routeStamp = -1;

  /** Observe the director (wave starts). Cheap; call every frame or tick. */
  observe(w: World): void {
    const d = w.director;
    if (d.phase === 'wave' && d.wave !== this.lastWave) {
      this.lastWave = d.wave;
      this.waveLevel[d.wave] = w.level;
    }
  }

  /** Current forecast (see `waveForecast`). */
  forecast(w: World): WaveForecast {
    this.observe(w);
    const wave = forecastWaveIndex(w);
    // Prep: everything is new and nothing has joined yet (wave 1's mix is the starting cast).
    const prev = wave <= 1 ? -1 : (this.waveLevel[wave - 1] ?? -1);
    return waveForecast(w, prev);
  }

  /** Route of district `d` to the Capitol (tile indices), cached per flow-field recompute. */
  route(w: World, d: number): readonly number[] {
    if (this.routeStamp !== w.nav.recomputes) {
      this.routeStamp = w.nav.recomputes;
      this.routes = [];
    }
    return (this.routes[d] ??= districtRoute(w, d));
  }
}
