/**
 * Headless player bots (M12 balance tooling). Each bot plays a real map through the public
 * command API only (`deploy`, `command`, `useAllAbilities`, `callNextWaveEarly`), deciding
 * once per `thinkEvery` simulated seconds, so runs stay deterministic and fast.
 *
 * Strategies (PLAN §1.5 / M12 brief):
 * - `none`        — never deploys (starts the waves only).
 * - `passive`     — a lone Riot Control by the Capitol every ~40 s; nothing else.
 * - `riot`        — the old M6 smoke bot: riot lines + a few snipers / blockades / gas.
 * - `cheap`       — spends everything on the cheapest unlocked units (≤ 10 Hate), no saving.
 * - `balanced`    — a sensible mix: riot lines on the hot approaches, snipers on guarded roofs,
 *                   blockades across narrow approaches, gas behind the lines (grenades used),
 *                   lethal units once unlocked, saves for one big toy at a time, commands
 *                   vehicles/horses/helicopters to the densest crowd near the Capitol.
 * - `escalate`    — always saves for and buys the newest / most expensive unlocked unit.
 * - `sacrificial` — feeds officers to the crowd far up the approaches to farm Legitimacy
 *                   (a Riot Control death: 3 Hate spent, 1 refunded, 5 Legitimacy), with a
 *                   thin defence at the Capitol.
 *
 * Map knowledge is derived from the flow field: every spawn door is traced down the Capitol
 * distance field and the visited road tiles (smeared across the carriageway) accumulate
 * "traffic". Bots place units on high-traffic tiles at strategy-specific distance bands.
 */
import { UNITS, UNIT_ORDER, type UnitId } from '../data/units';
import { findDensest, densest } from './behaviours/unit/specials';
import { PS } from './crowd';
import type { Unit } from './units';
import type { World } from './world';

export const BOT_KINDS = [
  'none',
  'passive',
  'riot',
  'cheap',
  'balanced',
  'escalate',
  'sacrificial',
] as const;
export type BotKind = (typeof BOT_KINDS)[number];

/** Bot tuning knobs (tooling only; `--set bot.deployRate=0.5`). */
export const BOT_TUNING = {
  /** Sustained deploys per second (a human-ish pace) … */
  deployRate: 1,
  /** … with bursts of up to this many. */
  deployBurst: 3,
  /**
   * × every ground placement's spacing (playtest round): 1 = the strategies' own tight lines;
   * `--set bot.spread=3` spreads officers out of each other's support (outnumbering A/B test).
   */
  spread: 1,
  /** While saving for an expensive unit, keep cheap types filled to this fraction of the plan. */
  cheapFill: 0.6,
};

const N8X = [1, -1, 0, 0, 1, 1, -1, -1];
const N8Y = [0, 0, 1, -1, 1, -1, 1, -1];

/** Static map analysis shared by all strategies. */
export class MapIntel {
  /** Per tile: crowd traffic estimate (0 = never walked). */
  readonly traffic: Float32Array;
  /** Road tiles with traffic, by traffic (desc), then index. */
  readonly hot: number[];
  /** Initial flow distance per tile. */
  readonly dist: Float32Array;
  /** Rooftop buildings by distance of their centre to the nearest hot tile ≤ 20 flow (asc). */
  readonly roofs: { b: number; cx: number; cy: number; cover: number }[];
  /** Carriageway width across the narrower axis (blockade fits when ≤ 3). */
  readonly width: Uint8Array;

  constructor(w: World) {
    const nav = w.nav;
    const mw = w.map.w;
    const n = nav.size;
    this.dist = Float32Array.from(nav.dist);
    const traffic = (this.traffic = new Float32Array(n));
    for (let d = 0; d < w.map.spawns.length; d++) {
      const sp = w.map.spawns[d]!;
      const starts: number[] = [];
      for (const bid of sp.buildingIds) {
        const b = w.map.buildings[bid];
        if (!b) continue;
        for (const door of b.doors) {
          if (nav.inBounds(door.i, door.j)) starts.push(door.j * mw + door.i);
        }
      }
      if (nav.inBounds(sp.rally.i, sp.rally.j)) starts.push(sp.rally.j * mw + sp.rally.i);
      // Earlier districts matter for longer.
      const weight = 1 / (1 + 0.15 * Math.max(0, sp.unlockWave - 1)) / Math.max(1, starts.length);
      for (const s0 of starts) {
        let t = s0;
        for (let step = 0; step < 400 && Number.isFinite(this.dist[t]!); step++) {
          const ti = t % mw;
          const tj = (t - ti) / mw;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              if (!nav.inBounds(ti + di, tj + dj)) continue;
              const k = t + dj * mw + di;
              if (nav.walk[k])
                traffic[k] = traffic[k]! + (di === 0 && dj === 0 ? weight : weight * 0.5);
            }
          }
          if (this.dist[t] === 0) break;
          let best = t;
          let bd = this.dist[t]!;
          for (let k = 0; k < 8; k++) {
            const ni = ti + N8X[k]!;
            const nj = tj + N8Y[k]!;
            if (!nav.inBounds(ni, nj)) continue;
            const m = nj * mw + ni;
            if (this.dist[m]! < bd) {
              bd = this.dist[m]!;
              best = m;
            }
          }
          if (best === t) break;
          t = best;
        }
      }
    }
    const hot: number[] = [];
    for (let t = 0; t < n; t++) {
      if ((nav.road[t] || nav.steps[t]) && traffic[t]! > 0) hot.push(t);
    }
    hot.sort((a, b) => traffic[b]! - traffic[a]! || a - b);
    this.hot = hot;
    // Road width across the narrower axis.
    this.width = new Uint8Array(n);
    for (let t = 0; t < n; t++) {
      if (!nav.road[t]) continue;
      const ti = t % mw;
      const tj = (t - ti) / mw;
      const run = (di: number, dj: number): number => {
        let k = 0;
        while (k < 12 && nav.inBounds(ti + di * (k + 1), tj + dj * (k + 1))) {
          if (!nav.walk[(tj + dj * (k + 1)) * mw + ti + di * (k + 1)]) break;
          k++;
        }
        return k;
      };
      this.width[t] = Math.min(run(1, 0) + run(-1, 0) + 1, run(0, 1) + run(0, -1) + 1);
    }
    // Roofs ranked by how much near-Capitol traffic they overlook.
    const near = hot.filter((t) => this.dist[t]! <= 20);
    this.roofs = [];
    for (const B of w.map.buildings) {
      if (!B.rooftop) continue;
      const cx = B.i + B.w / 2;
      const cy = B.j + B.d / 2;
      let cover = 0;
      for (const t of near) {
        const ti = t % mw;
        const tj = (t - ti) / mw;
        const dx = ti + 0.5 - cx;
        const dy = tj + 0.5 - cy;
        if (dx * dx + dy * dy <= 8 * 8) cover += traffic[t]!;
      }
      if (cover > 0) this.roofs.push({ b: B.id, cx, cy, cover });
    }
    this.roofs.sort((a, b) => b.cover - a.cover || a.b - b.b);
  }
}

interface PlaceOpts {
  minD: number;
  maxD: number;
  /** Minimum Chebyshev distance to other ground units. */
  spacing: number;
  /** Prefer tiles within this distance of a unit of these types. */
  near?: { types: UnitId[]; r: number };
  /** Only tiles where a blockade spans the full carriageway. */
  narrow?: boolean;
  /** Skip the top `skip` candidates (spreads lines across approaches). */
  rotate?: number;
}

/** Scripted player. `update()` once per tick (it throttles itself). */
export class Bot {
  readonly intel: MapIntel;
  private nextAct = 0;
  private nextCommand = 0;
  private lastPassive = -999;
  private rot = 0;
  /** Seconds between decisions. */
  thinkEvery = 1;
  /** Deploy budget (token bucket): a human-ish ~1 deploy/s sustained, bursts of 3. */
  deployRate = BOT_TUNING.deployRate;
  deployBurst = BOT_TUNING.deployBurst;
  private tokens = BOT_TUNING.deployBurst;
  /** Legitimacy at the last progress mark, and when it was set. */
  private lastLegit = 0;
  private lastLegitT = 0;
  /** placeRoad scratch grids (generation-stamped). */
  private blockGrid = new Int32Array(0);
  private nearGrid = new Int32Array(0);
  private gridGen = 0;

  constructor(
    private readonly w: World,
    readonly kind: BotKind,
  ) {
    this.intel = new MapIntel(w);
  }

  update(): void {
    const w = this.w;
    if (this.kind === 'none' || w.phase !== 'playing' || w.time < this.nextAct) return;
    this.nextAct = w.time + this.thinkEvery;
    this.tokens = Math.min(this.deployBurst, this.tokens + this.deployRate * this.thinkEvery);
    // Progress mark: Legitimacy grew by a meaningful step (≥ 10, or ≥ 10 % of what we have).
    if (w.legit - this.lastLegit >= Math.max(10, w.legit * 0.1)) {
      this.lastLegit = w.legit;
      this.lastLegitT = w.time;
    }
    switch (this.kind) {
      case 'passive':
        return this.passive();
      case 'riot':
        return this.riot();
      case 'cheap':
        return this.cheap();
      case 'balanced':
        return this.balanced();
      case 'escalate':
        return this.escalate();
      case 'sacrificial':
        return this.sacrificial();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────────

  private count(type: UnitId): number {
    let n = 0;
    for (const u of this.w.units.active) if (u.alive && u.type === type) n++;
    return n;
  }

  /** Alive ground units of `type` whose initial flow distance lies in [minD, maxD]. */
  private countIn(type: UnitId, minD: number, maxD: number): number {
    const w = this.w;
    let n = 0;
    for (const u of w.units.active) {
      if (!u.alive || u.type !== type || u.building >= 0) continue;
      const t = w.nav.tileAt(u.x, u.y);
      const d = t >= 0 ? this.intel.dist[t]! : Infinity;
      if (d >= minD && d <= maxD) n++;
    }
    return n;
  }

  /** Rate-limited deploy. */
  private deploy(type: UnitId, i: number, j: number): Unit | null {
    if (this.tokens < 1) return null;
    const u = this.w.deploy(type, i, j);
    if (u) this.tokens--;
    return u;
  }

  private unlocked(type: UnitId): boolean {
    return UNITS[type].level <= this.w.level;
  }

  private canBuy(type: UnitId, reserve = 0): boolean {
    return this.tokens >= 1 && this.unlocked(type) && this.w.hate >= UNITS[type].cost + reserve;
  }

  /** Protesters within `d` flow-tiles of the steps (threat gauge). */
  private threat(d: number): number {
    const w = this.w;
    const c = w.crowd;
    let n = 0;
    for (let s = 0; s < c.hi; s++) {
      if (!c.alive[s]) continue;
      if (w.nav.distAt(c.x[s]!, c.y[s]!) <= d) n++;
    }
    return n;
  }

  /**
   * Mark tiles whose centre lies within Chebyshev distance `< sp` (or `<= r` when `inclusive`)
   * of (x, y) with `gen` in `grid`. Same comparisons as a per-tile scan (exact), but O(area).
   */
  private stamp(
    grid: Int32Array,
    gen: number,
    x: number,
    y: number,
    r: number,
    inclusive: boolean,
  ): void {
    const mw = this.w.map.w;
    const mh = this.w.map.h;
    const i0 = Math.max(0, Math.floor(x - 0.5 - r) - 1);
    const i1 = Math.min(mw - 1, Math.ceil(x - 0.5 + r) + 1);
    const j0 = Math.max(0, Math.floor(y - 0.5 - r) - 1);
    const j1 = Math.min(mh - 1, Math.ceil(y - 0.5 + r) + 1);
    for (let j = j0; j <= j1; j++) {
      const dy = Math.abs(y - (j + 0.5));
      if (inclusive ? dy > r : dy >= r) continue;
      for (let i = i0; i <= i1; i++) {
        const dx = Math.abs(x - (i + 0.5));
        if (inclusive ? dx > r : dx >= r) continue;
        grid[j * mw + i] = gen;
      }
    }
  }

  /** Deploy a road unit on the best hot tile in the band. */
  private placeRoad(type: UnitId, o: PlaceOpts): Unit | null {
    const w = this.w;
    const intel = this.intel;
    const mw = w.map.w;
    // Spacing / proximity grids (M13b: replaces a hot-tiles × ground-units scan — the bot's
    // decision spikes in big late-game defences). Generation-stamped, never cleared.
    const n = w.map.w * w.map.h;
    if (this.blockGrid.length !== n) {
      this.blockGrid = new Int32Array(n);
      this.nearGrid = new Int32Array(n);
    }
    const gen = ++this.gridGen;
    const spacing = o.spacing * BOT_TUNING.spread;
    for (const u of w.units.active) {
      if (!u.alive || u.building >= 0 || UNITS[u.type].placement !== 'road') continue;
      const sp = u.type === 'blockade' ? Math.max(spacing, 2) : spacing;
      this.stamp(this.blockGrid, gen, u.x, u.y, sp, false);
      if (o.near && o.near.types.includes(u.type))
        this.stamp(this.nearGrid, gen, u.x, u.y, o.near.r, true);
    }
    let skip = o.rotate ?? 0;
    let fallback = -1;
    for (const t of intel.hot) {
      const d = intel.dist[t]!;
      if (d < o.minD || d > o.maxD) continue;
      if (o.narrow && intel.width[t]! > 3) continue;
      if (this.blockGrid[t] === gen) continue;
      const i = t % mw;
      const j = (t - i) / mw;
      const nearOk = !o.near || this.nearGrid[t] === gen;
      if (!w.canDeploy(type, i, j).ok) continue;
      if (!nearOk) {
        if (fallback < 0) fallback = t;
        continue;
      }
      if (skip > 0) {
        skip--;
        if (fallback < 0) fallback = t;
        continue;
      }
      return this.deploy(type, i, j);
    }
    if (fallback >= 0) return this.deploy(type, fallback % mw, Math.floor(fallback / mw));
    return null;
  }

  /**
   * Last line: a riot officer on the Capitol step tile with the most attackers around it
   * (falls back to the hottest free tile within 4.5 of the steps).
   */
  private placeHome(): Unit | null {
    const w = this.w;
    const c = w.crowd;
    const mw = w.map.w;
    const ax: number[] = [];
    const ay: number[] = [];
    for (let s = 0; s < c.hi; s++) {
      if (c.alive[s] && c.state[s] === PS.CAPITOL) {
        ax.push(c.x[s]!);
        ay.push(c.y[s]!);
      }
    }
    let best = -1;
    let bestN = 0;
    if (ax.length > 0) {
      for (const t of w.nav.goals) {
        const i = t % mw;
        const j = (t - i) / mw;
        let n = 0;
        for (let k = 0; k < ax.length; k++) {
          const dx = ax[k]! - (i + 0.5);
          const dy = ay[k]! - (j + 0.5);
          if (dx * dx + dy * dy <= 4) n++;
        }
        if (n > bestN && w.canDeploy('riot', i, j).ok) {
          bestN = n;
          best = t;
        }
      }
    }
    if (best >= 0) return this.deploy('riot', best % mw, Math.floor(best / mw));
    return this.placeRoad('riot', { minD: 0, maxD: 4.5, spacing: 1, rotate: this.rot++ % 3 });
  }

  /** Is a ground melee guard within guard range of building b? */
  private guarded(b: number): boolean {
    const w = this.w;
    const B = w.map.buildings[b]!;
    for (const u of w.units.active) {
      if (!u.alive || !u.def.guardsRooftops || u.building >= 0) continue;
      const dx = Math.max(B.i - u.x, 0, u.x - (B.i + B.w));
      const dy = Math.max(B.j - u.y, 0, u.y - (B.j + B.d));
      if (dx * dx + dy * dy <= 2.3 * 2.3) return true;
    }
    return false;
  }

  /** Put a riot next to building b (rooftop guard). */
  private guardRoof(b: number): boolean {
    const w = this.w;
    const B = w.map.buildings[b]!;
    for (let r = 1; r <= 2; r++) {
      for (let j = B.j - r; j < B.j + B.d + r; j++) {
        for (let i = B.i - r; i < B.i + B.w + r; i++) {
          if (i >= B.i && i < B.i + B.w && j >= B.j && j < B.j + B.d) continue;
          if (w.canDeploy('riot', i, j).ok) return this.deploy('riot', i, j) !== null;
        }
      }
    }
    return false;
  }

  /** Deploy a rooftop unit on the best free roof (optionally only guarded ones). */
  private placeRoof(type: UnitId, guardedOnly: boolean, maxRank = 40): Unit | null {
    const w = this.w;
    let k = 0;
    for (const r of this.intel.roofs) {
      if (k++ >= maxRank) break;
      if (w.roofUnit[r.b]! >= 0) continue;
      if (guardedOnly && !this.guarded(r.b)) continue;
      const B = w.map.buildings[r.b]!;
      const u = this.deploy(type, B.i, B.j);
      if (u) return u;
    }
    return null;
  }

  /** Send commandables to the densest crowd near the Capitol. */
  private commandMobiles(range: number): void {
    const w = this.w;
    if (w.time < this.nextCommand) return;
    this.nextCommand = w.time + 4;
    const cap = w.map.capitol;
    const cx = cap.i + cap.w / 2;
    const cy = cap.j + cap.d + 1;
    if (!findDensest(w, cx, cy, range) || densest.count < 6) return;
    const ti = Math.floor(densest.x);
    const tj = Math.floor(densest.y);
    let k = 0;
    for (const u of w.units.active) {
      if (!u.alive || !u.def.commandable || u.moving) continue;
      const dx = u.x - densest.x;
      const dy = u.y - densest.y;
      if (dx * dx + dy * dy < 9) continue;
      if (u.type === 'heli') {
        w.command(u.id, ti, tj);
        continue;
      }
      // Ground: nearest road tile to the hot spot, spread a little per unit.
      const off = (k++ % 3) - 1;
      for (let r = 0; r <= 3; r++) {
        let done = false;
        for (let dj = -r; dj <= r && !done; dj++) {
          for (let di = -r; di <= r && !done; di++) {
            const i = ti + di + off;
            const j = tj + dj;
            if (!w.nav.inBounds(i, j) || !w.nav.road[j * w.map.w + i]) continue;
            done = w.command(u.id, i, j);
          }
        }
        if (done) break;
      }
    }
  }

  /**
   * Legitimacy stalled (no real progress for `after` s) → push a riot officer up an approach to
   * meet the crowd (what a player does once they learn how Legitimacy works).
   */
  private feedIfStalled(after: number, minHate: number): void {
    const w = this.w;
    if (w.time - this.lastLegitT < after || w.hate < minHate) return;
    if (w.director.phase !== 'wave' || !this.canBuy('riot')) return;
    this.placeRoad('riot', { minD: 12, maxD: 30, spacing: 1, rotate: this.rot++ % 8 });
  }

  private gasAndCall(callEarlyAt: number, minIntegrity = 0.6): void {
    const w = this.w;
    w.useAllAbilities();
    if (
      callEarlyAt >= 0 &&
      w.director.phase === 'breather' &&
      w.hate >= callEarlyAt &&
      w.capitol.integrity >= minIntegrity &&
      w.crowd.count < 20
    ) {
      w.callNextWaveEarly();
    }
  }

  // ── Strategies ─────────────────────────────────────────────────────────────────────

  private passive(): void {
    const w = this.w;
    if (w.time - this.lastPassive < 40) return;
    if (this.placeHome()) this.lastPassive = w.time;
  }

  private riot(): void {
    const w = this.w;
    this.gasAndCall(400, 0);
    const r = (w.tick >> 5) % 5;
    const pick: UnitId =
      r === 0 && this.canBuy('sniper')
        ? 'sniper'
        : r === 1 && this.canBuy('blockade')
          ? 'blockade'
          : r === 2 && this.canBuy('gas')
            ? 'gas'
            : 'riot';
    for (let k = 0; k < 3 && this.canBuy(pick); k++) {
      const ok =
        UNITS[pick].placement === 'rooftop'
          ? this.placeRoof(pick, false)
          : this.placeRoad(pick, { minD: 2, maxD: 14, spacing: 2 });
      if (!ok) break;
    }
  }

  private cheap(): void {
    this.gasAndCall(60);
    // A few officers on the steps (playtest round: crowds walk 1.5× faster and slip past lines).
    const home = 2 + (this.w.level >> 1);
    if (this.countIn('riot', 0, 4.5) < home && this.canBuy('riot')) this.placeHome();
    const cheapest = UNIT_ORDER.filter((id) => UNITS[id].cost <= 10 && this.unlocked(id));
    for (let k = 0; k < 4; k++) {
      const type = cheapest[this.rot++ % cheapest.length]!;
      if (!this.canBuy(type)) return;
      if (!this.buyGeneric(type, 0)) return;
    }
    this.commandMobiles(18);
  }

  /** Place any unit type with sensible defaults. */
  private buyGeneric(type: UnitId, rotate: number): Unit | null {
    switch (type) {
      case 'riot':
        return this.placeRoad('riot', { minD: 4, maxD: 13, spacing: 2, rotate });
      case 'sniper':
      case 'brigade':
        return this.placeRoof(type, false);
      case 'blockade':
        return this.placeRoad('blockade', { minD: 9, maxD: 20, spacing: 3, narrow: true, rotate });
      case 'gas':
        return this.placeRoad('gas', {
          minD: 3,
          maxD: 11,
          spacing: 1,
          near: { types: ['riot', 'mounted'], r: 2 },
          rotate,
        });
      case 'soldier': {
        // Road or rooftop (owner request): about one Soldier in three goes on a roof that
        // overlooks the approaches (balanced: only guarded ones, like its snipers).
        const total = this.count('soldier');
        const onRoofs = this.w.units.active.filter(
          (u) => u.alive && u.type === 'soldier' && u.building >= 0,
        ).length;
        if (onRoofs < Math.ceil(total / 3)) {
          const u = this.placeRoof('soldier', this.kind === 'balanced', 20);
          if (u) return u;
        }
        return this.placeRoad('soldier', { minD: 2, maxD: 9, spacing: 2, rotate });
      }
      case 'heli': {
        const cap = this.w.map.capitol;
        return this.deploy('heli', cap.i + (cap.w >> 1), cap.j + cap.d + 2);
      }
      default:
        return this.placeRoad(type, { minD: 2, maxD: 9, spacing: 2, rotate });
    }
  }

  /** Target counts per unit type for the balanced player at the current level. */
  /** Target counts per unit type for a balanced defence at the current level (× scale). */
  private plan(scale = 1): Partial<Record<UnitId, number>> {
    const L = this.w.level;
    const wave = this.w.director.wave;
    const p: Partial<Record<UnitId, number>> = {
      riot: Math.min(30, 6 + L + (wave >> 2)),
      sniper: L >= 1 ? Math.min(16, 3 + 2 * L) : 0,
      blockade: L >= 2 ? Math.min(6, 2 + (L >> 1)) : 0,
      gas: L >= 3 ? Math.min(12, 2 + L) : 0,
      mounted: L >= 4 ? Math.min(4, 1 + (L >> 2)) : 0,
      armed: L >= 5 ? Math.min(8, L - 2) : 0,
      soldier: L >= 6 ? Math.min(8, L - 4) : 0,
      humvee: L >= 7 ? Math.min(3, L - 6) : 0,
      brigade: L >= 8 ? Math.min(2, L - 7) : 0,
      tank: L >= 9 ? Math.min(2, L - 8) : 0,
      heli: L >= 10 ? 2 : 0,
    };
    if (scale !== 1) for (const k of UNIT_ORDER) p[k] = Math.ceil((p[k] ?? 0) * scale);
    return p;
  }

  private balanced(): void {
    this.gasAndCall(250, 0.75);
    this.feedIfStalled(90, 30);
    this.commandMobiles(16);
    this.defend(1);
  }

  /**
   * Balanced defence: last line on the steps, guarded rooftops, then the unit type with the
   * biggest relative deficit vs `plan(scale)` (saving up for expensive units).
   */
  private defend(scale: number): void {
    const w = this.w;
    // Last line at the steps (and more of it when the crowd gets there).
    const home = Math.min(10, 3 + w.level) + (this.threat(5) > 8 ? 4 : 0);
    for (let k = 0; k < 2 && this.countIn('riot', 0, 4.5) < home && this.canBuy('riot'); k++) {
      if (!this.placeHome()) break;
    }
    // Guard rooftop units.
    for (const b of w.roofBuildings) {
      if (!this.guarded(b) && this.canBuy('riot')) this.guardRoof(b);
    }
    const plan = this.plan(scale);
    // Types with no free spot this decision (try the next deficit instead of stalling).
    const blocked = new Set<UnitId>();
    for (let k = 0; k < 4; k++) {
      // Biggest relative deficit first; expensive units are saved for.
      let best: UnitId | null = null;
      let bestScore = 0;
      for (const id of UNIT_ORDER) {
        const want = plan[id] ?? 0;
        if (want <= 0 || !this.unlocked(id) || blocked.has(id)) continue;
        const have = this.count(id);
        if (have >= want) continue;
        const score = (want - have) / want + (UNITS[id].cost >= 50 ? 0.3 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (!best) {
        // Plan satisfied: thicken the front with riot control.
        if (w.hate > 150 && this.canBuy('riot')) this.buyGeneric('riot', this.rot++ % 4);
        return;
      }
      if (!this.canBuy(best)) {
        // Saving for something big: keep the cheap plan filled meanwhile (playtest round: with
        // Hate scarce, hoarding while the line thins out loses the Capitol).
        const cheapNeed = UNIT_ORDER.find(
          (id) =>
            UNITS[id].cost <= 10 &&
            this.count(id) < (plan[id] ?? 0) * BOT_TUNING.cheapFill &&
            this.canBuy(id),
        );
        if (cheapNeed) this.buyPlanned(cheapNeed);
        return;
      }
      const u = this.buyPlanned(best);
      if (!u) {
        if (best === 'sniper') {
          // No guarded roof free: guard the best free one first.
          const r = this.intel.roofs.find((x) => w.roofUnit[x.b]! < 0);
          if (r) this.guardRoof(r.b);
          return;
        }
        if (this.tokens < 1) return;
        blocked.add(best);
      }
    }
  }

  /** Place a planned unit (snipers only on guarded roofs; Soldiers road or rooftop). */
  private buyPlanned(type: UnitId): Unit | null {
    return UNITS[type].placement === 'rooftop'
      ? this.placeRoof(type, type === 'sniper')
      : this.buyGeneric(type, 0);
  }

  private escalate(): void {
    const w = this.w;
    this.gasAndCall(400, 0.7);
    this.feedIfStalled(150, 100);
    this.commandMobiles(18);
    if (this.threat(4) > 15 && this.canBuy('riot')) this.placeHome();
    const unlocked = UNIT_ORDER.filter((id) => this.unlocked(id));
    const top = unlocked[unlocked.length - 1]!;
    // Heli is invulnerable: cap the count, then fall back to the next best.
    const target = top === 'heli' && this.count('heli') >= 3 ? unlocked[unlocked.length - 2]! : top;
    for (let k = 0; k < 3; k++) {
      if (this.canBuy(target)) {
        if (!this.buyGeneric(target, this.rot++ % 3)) break;
        continue;
      }
      // Keep a minimal riot screen while saving.
      if (this.count('riot') < 8 + w.level && this.canBuy('riot')) this.buyGeneric('riot', 0);
      break;
    }
  }

  private sacrificial(): void {
    const w = this.w;
    this.gasAndCall(120, 0.6);
    this.commandMobiles(14);
    // Feed the crowd while the Capitol is safe: riot control and blockades far up the
    // approaches (each riot death: 3 Hate spent, 1 refunded, 5 Legitimacy).
    // Half of the deploy budget goes to feeding (every other decision).
    const safe = w.capitol.integrity > 0.5 && this.threat(6) < 10;
    if (safe && w.director.phase === 'wave' && (w.tick / 30) % 2 < 1) {
      for (let k = 0; k < 1; k++) {
        const type: UnitId = this.unlocked('blockade') && this.rot % 3 === 2 ? 'blockade' : 'riot';
        if (!this.canBuy(type)) break;
        const ok = this.placeRoad(type, {
          minD: 14,
          maxD: 40,
          spacing: type === 'blockade' ? 3 : 1,
          rotate: this.rot++ % 6,
        });
        if (!ok) break;
      }
    }
    // A lighter balanced defence with what is left.
    this.defend(0.5);
  }
}
