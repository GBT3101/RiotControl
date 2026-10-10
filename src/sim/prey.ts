/**
 * Aggro targets (owner: "when there are soldiers or cops in range, the protesters should
 * prioritise them over the Capitol and try to kill them first").
 *
 * `PreyGrid` buckets the huntable units (alive ground units, not blockades, not on a roof, not
 * in the air, not invulnerable) into coarse `CELL`-tile cells once per step (counting sort,
 * like the unit grid), so a protester's aggro check on its staggered think tick only looks at
 * the units in its 3×3 cell neighbourhood. `findPrey` picks the best one for a protester:
 * near, with a free melee slot, not already swamped, and reachable by a straight walk.
 */
import { BALANCE } from '../data/balance';
import type { Unit } from './units';
import type { World } from './world';

/** Cell size (tiles): ≥ the aggro radius, so the 3×3 neighbourhood always covers it. */
export const PREY_CELL = 5;

/** Is this unit something the crowd goes after on foot? */
export function isPrey(u: Unit): boolean {
  return (
    u.alive &&
    u.building < 0 &&
    u.type !== 'blockade' &&
    u.def.placement !== 'air' &&
    !u.def.invulnerable
  );
}

export class PreyGrid {
  readonly cols: number;
  readonly rows: number;
  readonly start: Int32Array;
  items: Int32Array = new Int32Array(64);
  private readonly cursor: Int32Array;
  /** Any prey at all this step (cheap early-out for the whole crowd). */
  count = 0;

  constructor(w: number, h: number) {
    this.cols = Math.ceil(w / PREY_CELL);
    this.rows = Math.ceil(h / PREY_CELL);
    this.start = new Int32Array(this.cols * this.rows + 1);
    this.cursor = new Int32Array(this.cols * this.rows + 1);
  }

  private cellOf(u: Unit): number {
    const ci = Math.min(this.cols - 1, Math.max(0, Math.floor(u.x / PREY_CELL)));
    const cj = Math.min(this.rows - 1, Math.max(0, Math.floor(u.y / PREY_CELL)));
    return cj * this.cols + ci;
  }

  rebuild(units: readonly Unit[]): void {
    const start = this.start;
    start.fill(0);
    let n = 0;
    for (let k = 0; k < units.length; k++) {
      const u = units[k]!;
      if (!isPrey(u)) continue;
      start[this.cellOf(u) + 1]!++;
      n++;
    }
    this.count = n;
    if (n === 0) return;
    for (let c = 0; c < start.length - 1; c++) start[c + 1]! += start[c]!;
    if (this.items.length < n) this.items = new Int32Array(n * 2);
    this.cursor.set(start);
    for (let k = 0; k < units.length; k++) {
      const u = units[k]!;
      if (isPrey(u)) this.items[this.cursor[this.cellOf(u)]!++] = u.slot;
    }
  }
}

/** No solid tile on the straight walk from (x0, y0) to (x1, y1) (samples every ¼ tile). */
export function clearWalk(w: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.ceil(Math.sqrt(dx * dx + dy * dy) * 4);
  for (let k = 1; k < n; k++) {
    if (w.nav.isSolidAt(x0 + (dx * k) / n, y0 + (dy * k) / n)) return false;
  }
  return true;
}

/** Aggro score of unit u for a protester at (x, y) (lower = better; Infinity = out of reach). */
export function preyScore(u: Unit, x: number, y: number, r: number): number {
  const dx = u.x - x;
  const dy = u.y - y;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return Infinity;
  const A = BALANCE.aggro;
  const full = u.holders.length === 0 || u.nHolders >= u.holders.length;
  return (d2 + 0.25) * (full ? A.fullPenalty : 1) * (1 + A.crowdPenalty * u.odds);
}

const MAX_CAND = 4;
const candSlot = new Int32Array(MAX_CAND);
const candScore = new Float64Array(MAX_CAND);

/**
 * Best unit for the protester at (x, y) to go after within `BALANCE.aggro.radius`, or null.
 * Candidates are tried best-first (up to four) until one has a clear straight walk.
 */
export function findPrey(w: World, x: number, y: number): Unit | null {
  const g = w.prey;
  if (g.count === 0) return null;
  const r = BALANCE.aggro.radius;
  if (r <= 0) return null;
  const ci = Math.floor(x / PREY_CELL);
  const cj = Math.floor(y / PREY_CELL);
  const items = g.items;
  const units = w.units.items;
  let n = 0;
  for (let j = cj - 1; j <= cj + 1; j++) {
    if (j < 0 || j >= g.rows) continue;
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (i < 0 || i >= g.cols) continue;
      const c = j * g.cols + i;
      for (let p = g.start[c]!; p < g.start[c + 1]!; p++) {
        const u = units[items[p]!]!;
        if (!u.alive) continue;
        const sc = preyScore(u, x, y, r);
        if (sc === Infinity) continue;
        // Insertion into the small sorted candidate list (ties: lower slot first).
        let k: number;
        if (n < MAX_CAND) k = n++;
        else if (sc < candScore[MAX_CAND - 1]!) k = MAX_CAND - 1;
        else continue;
        while (k > 0 && sc < candScore[k - 1]!) {
          candScore[k] = candScore[k - 1]!;
          candSlot[k] = candSlot[k - 1]!;
          k--;
        }
        candScore[k] = sc;
        candSlot[k] = u.slot;
      }
    }
  }
  for (let k = 0; k < n; k++) {
    const u = units[candSlot[k]!]!;
    if (clearWalk(w, x, y, u.x, u.y)) return u;
  }
  return null;
}
