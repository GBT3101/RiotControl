/**
 * Navigation grid: static walkability/costs from MapData, dynamic blockers (blockades,
 * stationary units), the Capitol **flow field** (multi-source Dijkstra from the steps, using
 * GROUND_COST + blocker costs) and road-only A* for commandable units.
 *
 * Flow-field recompute is throttled: blocker changes mark the field dirty and it is rebuilt at
 * most every `BALANCE.flowRecomputeInterval` seconds (72×72 Dijkstra ≈ 0.3–0.6 ms).
 */
import { BALANCE } from '../data/balance';
import { GROUNDS, GROUND_COST, PLACEABLE_ROAD, WALKABLE, type MapData } from '../maps/contract';

const SQRT2 = Math.SQRT2;
/** 8-neighbourhood: dx, dy, step length. */
const NDX = [1, -1, 0, 0, 1, 1, -1, -1];
const NDY = [0, 0, 1, -1, 1, -1, 1, -1];
const NLEN = [1, 1, 1, 1, SQRT2, SQRT2, SQRT2, SQRT2];

/** Binary min-heap of (key, value) on typed arrays; lazy deletion by the caller. */
class MinHeap {
  keys: Float64Array;
  vals: Int32Array;
  size = 0;
  constructor(cap: number) {
    this.keys = new Float64Array(cap);
    this.vals = new Int32Array(cap);
  }
  clear(): void {
    this.size = 0;
  }
  push(key: number, val: number): void {
    if (this.size >= this.keys.length) {
      const k = new Float64Array(this.keys.length * 2);
      k.set(this.keys);
      const v = new Int32Array(this.vals.length * 2);
      v.set(this.vals);
      this.keys = k;
      this.vals = v;
    }
    const keys = this.keys;
    const vals = this.vals;
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      const pk = keys[p]!;
      // Tie-break on value → fully deterministic order.
      if (pk < key || (pk === key && vals[p]! <= val)) break;
      keys[i] = pk;
      vals[i] = vals[p]!;
      i = p;
    }
    keys[i] = key;
    vals[i] = val;
  }
  /** Pops the min; returns its value (key in `lastKey`). */
  lastKey = 0;
  pop(): number {
    const keys = this.keys;
    const vals = this.vals;
    const topV = vals[0]!;
    this.lastKey = keys[0]!;
    const n = --this.size;
    if (n > 0) {
      const k = keys[n]!;
      const v = vals[n]!;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        let c = l;
        if (r < n && (keys[r]! < keys[l]! || (keys[r] === keys[l] && vals[r]! < vals[l]!))) c = r;
        if (keys[c]! > k || (keys[c] === k && vals[c]! >= v)) break;
        keys[i] = keys[c]!;
        vals[i] = vals[c]!;
        i = c;
      }
      keys[i] = k;
      vals[i] = v;
    }
    return topV;
  }
}

export class Nav {
  readonly w: number;
  readonly h: number;
  readonly size: number;
  /** Static: walkable ground. */
  readonly walk: Uint8Array;
  /** Static: PLACEABLE_ROAD ground. */
  readonly road: Uint8Array;
  /** Static: Capitol steps tiles. */
  readonly steps: Uint8Array;
  readonly baseCost: Float32Array;
  /** Dynamic: blockade unit slot on the tile, -1. */
  readonly blockade: Int16Array;
  /** Dynamic: extra cost from stationary units. */
  readonly unitCost: Float32Array;
  /** Movement-solid (not walkable or blockade). */
  readonly solid: Uint8Array;
  /** Flow distance to the steps (tiles × cost), Infinity if unreachable. */
  readonly dist: Float32Array;
  readonly flowX: Float32Array;
  readonly flowY: Float32Array;
  readonly goals: number[];
  dirty = true;
  /** Seconds until a recompute is allowed. */
  private cooldown = 0;
  recomputes = 0;
  private readonly heap: MinHeap;
  /** Scratch: per-tile enter cost for the current recompute. */
  private readonly cost: Float32Array;
  private readonly capRect: { i0: number; j0: number; i1: number; j1: number };
  // A* scratch
  private readonly g: Float32Array;
  private readonly parent: Int32Array;
  private readonly stamp: Uint32Array;
  private stampId = 0;
  /** Sample output. */
  sx = 0;
  sy = 0;

  constructor(map: MapData) {
    const w = (this.w = map.w);
    const h = (this.h = map.h);
    const n = (this.size = w * h);
    this.walk = new Uint8Array(n);
    this.road = new Uint8Array(n);
    this.steps = new Uint8Array(n);
    this.baseCost = new Float32Array(n);
    this.blockade = new Int16Array(n).fill(-1);
    this.unitCost = new Float32Array(n);
    this.solid = new Uint8Array(n);
    this.dist = new Float32Array(n);
    this.flowX = new Float32Array(n);
    this.flowY = new Float32Array(n);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.heap = new MinHeap(n * 4);
    this.cost = new Float32Array(n);
    for (let t = 0; t < n; t++) {
      const gname = GROUNDS[map.ground[t]!];
      const walkable = gname !== undefined && WALKABLE.has(gname);
      this.walk[t] = walkable ? 1 : 0;
      this.road[t] = gname !== undefined && PLACEABLE_ROAD.has(gname) ? 1 : 0;
      this.baseCost[t] = walkable ? (GROUND_COST[gname] ?? 1) : Infinity;
      this.solid[t] = walkable ? 0 : 1;
    }
    const cap = map.capitol;
    this.capRect = { i0: cap.i, j0: cap.j, i1: cap.i + cap.w, j1: cap.j + cap.d };
    this.goals = [];
    for (const s of cap.steps) {
      if (!this.inBounds(s.i, s.j)) continue;
      const t = s.j * w + s.i;
      if (this.walk[t]) {
        this.goals.push(t);
        this.steps[t] = 1;
      }
    }
    if (this.goals.length === 0) {
      // Fallback: any walkable tile touching the Capitol footprint.
      for (let j = cap.j - 1; j <= cap.j + cap.d; j++) {
        for (let i = cap.i - 1; i <= cap.i + cap.w; i++) {
          if (!this.inBounds(i, j)) continue;
          const inside = i >= cap.i && i < cap.i + cap.w && j >= cap.j && j < cap.j + cap.d;
          const t = j * w + i;
          if (!inside && this.walk[t]) {
            this.goals.push(t);
            this.steps[t] = 1;
          }
        }
      }
    }
    this.recompute();
  }

  inBounds(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.w && j < this.h;
  }

  tileAt(x: number, y: number): number {
    const i = Math.floor(x);
    const j = Math.floor(y);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }

  isSolidAt(x: number, y: number): boolean {
    const i = Math.floor(x);
    const j = Math.floor(y);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return true;
    return this.solid[j * this.w + i] === 1;
  }

  setBlockade(t: number, slot: number): void {
    this.blockade[t] = slot;
    this.solid[t] = slot >= 0 || !this.walk[t] ? 1 : 0;
    this.dirty = true;
  }

  addUnitCost(t: number, cost: number): void {
    this.unitCost[t] = Math.max(0, this.unitCost[t]! + cost);
    this.dirty = true;
  }

  /** Throttled recompute; call once per tick. */
  update(dt: number): boolean {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!this.dirty || this.cooldown > 0) return false;
    this.recompute();
    this.cooldown = BALANCE.flowRecomputeInterval;
    return true;
  }

  /** Cost of entering tile t (Infinity = impassable for the field). */
  private enterCost(t: number): number {
    let c = this.baseCost[t]! + this.unitCost[t]!;
    if (this.blockade[t]! >= 0) c += BALANCE.blockadeTileCost;
    return c;
  }

  /** Full multi-source Dijkstra from the Capitol steps + flow vectors. */
  recompute(): void {
    const { w, h, size, dist, walk, heap, cost } = this;
    this.dirty = false;
    this.recomputes++;
    for (let t = 0; t < size; t++) cost[t] = walk[t] ? this.enterCost(t) : Infinity;
    dist.fill(Infinity);
    heap.clear();
    for (const t of this.goals) {
      dist[t] = 0;
      heap.push(0, t);
    }
    while (heap.size > 0) {
      const t = heap.pop();
      const d = heap.lastKey;
      if (d > dist[t]!) continue;
      const ti = t % w;
      const tj = (t - ti) / w;
      const ct = cost[t]!;
      const left = ti > 0;
      const right = ti < w - 1;
      const up = tj > 0;
      const down = tj < h - 1;
      for (let k = 0; k < 8; k++) {
        const dx = NDX[k]!;
        const dy = NDY[k]!;
        if ((dx < 0 && !left) || (dx > 0 && !right) || (dy < 0 && !up) || (dy > 0 && !down))
          continue;
        const n = t + dy * w + dx;
        const cn = cost[n]!;
        if (cn === Infinity) continue;
        if (k >= 4 && (!walk[t + dx] || !walk[t + dy * w])) continue; // no corner cutting
        const nd = d + NLEN[k]! * 0.5 * (ct + cn);
        if (nd < dist[n]!) {
          dist[n] = nd;
          // Push the float32-rounded value so the pop-time staleness check is exact.
          heap.push(dist[n]!, n);
        }
      }
    }
    // Flow vectors: toward the cheapest neighbour.
    const fx = this.flowX;
    const fy = this.flowY;
    const r = this.capRect;
    for (let t = 0; t < size; t++) {
      fx[t] = 0;
      fy[t] = 0;
      if (!walk[t] || dist[t] === Infinity) continue;
      const ti = t % w;
      const tj = (t - ti) / w;
      if (dist[t] === 0) {
        // Goal: press toward the Capitol.
        const cx = Math.min(Math.max(ti + 0.5, r.i0), r.i1) - (ti + 0.5);
        const cy = Math.min(Math.max(tj + 0.5, r.j0), r.j1) - (tj + 0.5);
        const l = Math.sqrt(cx * cx + cy * cy);
        if (l > 0) {
          fx[t] = cx / l;
          fy[t] = cy / l;
        }
        continue;
      }
      let best = dist[t]!;
      let bk = -1;
      for (let k = 0; k < 8; k++) {
        const ni = ti + NDX[k]!;
        const nj = tj + NDY[k]!;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const n = nj * w + ni;
        if (!walk[n]) continue;
        if (k >= 4 && (!walk[tj * w + ni] || !walk[nj * w + ti])) continue;
        const dn = dist[n]!;
        if (dn < best) {
          best = dn;
          bk = k;
        }
      }
      if (bk >= 0) {
        const l = NLEN[bk]!;
        fx[t] = NDX[bk]! / l;
        fy[t] = NDY[bk]! / l;
      }
    }
  }

  /**
   * Bilinear flow sample at (x, y) from the 4 surrounding tile centres (unwalkable tiles
   * excluded). Result in `sx, sy` (not normalised; may be 0).
   */
  sample(x: number, y: number): void {
    const w = this.w;
    const h = this.h;
    const fxp = x - 0.5;
    const fyp = y - 0.5;
    const i0 = Math.floor(fxp);
    const j0 = Math.floor(fyp);
    const tx = fxp - i0;
    const ty = fyp - j0;
    let sx = 0;
    let sy = 0;
    let wsum = 0;
    for (let q = 0; q < 4; q++) {
      const i = i0 + (q & 1);
      const j = j0 + (q >> 1);
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const t = j * w + i;
      if (!this.walk[t]) continue;
      const wt = ((q & 1) === 1 ? tx : 1 - tx) * (q >> 1 === 1 ? ty : 1 - ty);
      sx += this.flowX[t]! * wt;
      sy += this.flowY[t]! * wt;
      wsum += wt;
    }
    if (wsum > 0) {
      sx /= wsum;
      sy /= wsum;
    }
    this.sx = sx;
    this.sy = sy;
  }

  distAt(x: number, y: number): number {
    const t = this.tileAt(x, y);
    return t < 0 ? Infinity : this.dist[t]!;
  }

  /** Tiles a commandable ground unit may drive on. */
  driveable(t: number): boolean {
    return (this.road[t] === 1 || this.steps[t] === 1) && this.blockade[t]! < 0;
  }

  /**
   * Road-only A* (8-dir, no corner cutting) between tiles. Returns tile indices from the
   * first step to the goal (excluding the start), [] if already there, null if unreachable.
   */
  findPath(fromI: number, fromJ: number, toI: number, toJ: number): number[] | null {
    const { w, h, g, parent, stamp, heap } = this;
    if (!this.inBounds(fromI, fromJ) || !this.inBounds(toI, toJ)) return null;
    const start = fromJ * w + fromI;
    const goal = toJ * w + toI;
    if (!this.driveable(goal)) return null;
    if (start === goal) return [];
    const id = ++this.stampId;
    heap.clear();
    const hfn = (t: number): number => {
      const dx = Math.abs((t % w) - toI);
      const dy = Math.abs(Math.floor(t / w) - toJ);
      return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
    };
    stamp[start] = id;
    g[start] = 0;
    parent[start] = -1;
    heap.push(hfn(start), start);
    let found = false;
    let guard = 0;
    while (heap.size > 0 && guard++ < this.size * 8) {
      const t = heap.pop();
      if (t === goal) {
        found = true;
        break;
      }
      const ti = t % w;
      const tj = (t - ti) / w;
      const gt = g[t]!;
      for (let k = 0; k < 8; k++) {
        const ni = ti + NDX[k]!;
        const nj = tj + NDY[k]!;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const n = nj * w + ni;
        if (!this.driveable(n)) continue;
        if (k >= 4 && (!this.driveable(tj * w + ni) || !this.driveable(nj * w + ti))) continue;
        const ng = gt + NLEN[k]! * this.baseCost[n]!;
        if (stamp[n] !== id || ng < g[n]!) {
          stamp[n] = id;
          g[n] = ng;
          parent[n] = t;
          heap.push(ng + hfn(n), n);
        }
      }
    }
    if (!found) return null;
    const path: number[] = [];
    for (let t = goal; t !== start && t >= 0; t = parent[t]!) path.push(t);
    path.reverse();
    return path;
  }
}
