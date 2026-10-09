/**
 * Pure helpers for the tutorial overlay (unit-tested): when to run it, dim rectangles around
 * highlight holes, and where the advisor may sit without covering a highlighted thing.
 */
import type { CityId } from '../../maps/contract';
import type { Rect } from '../core/node';
import type { GameSettings } from '../settings';

/** `?tutorial=0` → false (never), `?tutorial=1` → true (force), else null (normal rules). */
export function tutorialParam(search: string): boolean | null {
  const v = new URLSearchParams(search).get('tutorial');
  if (v === '0' || v === 'false') return false;
  if (v === '1' || v === 'true') return true;
  return null;
}

export interface TutorialGate {
  /** `?tutorial=` override. */
  param: boolean | null;
  /** Title-screen backdrop game. */
  attract: boolean;
  /** Debug-jump run (autoplay, ?t, ?level, ?wave, ?scene, ?stress, ?moment, ?freeze). */
  debugRun: boolean;
  /** Settings → TUTORIAL REPLAY. */
  replay: boolean;
  /** This city's briefing was completed (or skipped) before. */
  done: boolean;
}

export function shouldRunTutorial(g: TutorialGate): boolean {
  if (g.attract || g.param === false) return false;
  if (g.param === true) return true;
  if (g.debugRun) return false;
  return g.replay || !g.done;
}

/** The briefing for `city` is over (finished or skipped): never auto-run it again there. */
export function completeTutorial(s: GameSettings, city: CityId): GameSettings {
  s.tutorialDone[city] = true;
  s.replayTutorial = false;
  return s;
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function inflate(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}

/**
 * Rectangles covering the W×H screen except the `holes` (clipped to the screen). Horizontal
 * bands between hole edges; within a band, the gaps between the holes crossing it.
 */
export function dimRects(W: number, H: number, holes: readonly Rect[]): Rect[] {
  const hs = holes
    .map((h) => {
      const x0 = Math.max(0, Math.floor(h.x));
      const y0 = Math.max(0, Math.floor(h.y));
      const x1 = Math.min(W, Math.ceil(h.x + h.w));
      const y1 = Math.min(H, Math.ceil(h.y + h.h));
      return { x0, y0, x1, y1 };
    })
    .filter((h) => h.x1 > h.x0 && h.y1 > h.y0);
  const ys = [...new Set([0, H, ...hs.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let k = 0; k < ys.length - 1; k++) {
    const y0 = ys[k]!;
    const y1 = ys[k + 1]!;
    if (y1 <= y0) continue;
    const cross = hs
      .filter((h) => h.y0 <= y0 && h.y1 >= y1)
      .map((h) => [h.x0, h.x1] as const)
      .sort((a, b) => a[0] - b[0]);
    let x = 0;
    for (const [a, b] of cross) {
      if (a > x) out.push({ x, y: y0, w: a - x, h: y1 - y0 });
      x = Math.max(x, b);
    }
    if (x < W) out.push({ x, y: y0, w: W - x, h: y1 - y0 });
  }
  return out;
}

export interface AdvisorSpot {
  x: number;
  bottom: number;
  maxW: number;
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Pick the advisor's bottom edge so its box (`w`×`h` from the bottom-left corner) avoids every
 * `zone` (highlighted rects + pointer arrows). Candidates, in order: the default spot, just
 * above each zone (highest first), then at the top under the top bar (`topY`). The first
 * collision-free one wins; on cramped screens the one covering the least zone area.
 */
export function placeAdvisor(
  def: AdvisorSpot,
  size: { w: number; h: number },
  zones: readonly Rect[],
  topY: number,
): AdvisorSpot {
  const box = (bottom: number): Rect => ({
    x: def.x,
    y: bottom - size.h,
    w: Math.min(def.maxW, size.w),
    h: size.h,
  });
  const cost = (bottom: number): number => zones.reduce((n, z) => n + overlap(box(bottom), z), 0);
  const cands = [
    def.bottom,
    ...zones
      .map((z) => z.y - 2)
      .filter((b) => b < def.bottom && b - size.h >= topY)
      .sort((a, b) => b - a),
    topY + size.h,
  ];
  let best = def.bottom;
  let bestCost = Infinity;
  for (const b of cands) {
    const c = cost(b);
    if (c === 0) return b === def.bottom ? def : { ...def, bottom: b };
    if (c < bestCost) {
      bestCost = c;
      best = b;
    }
  }
  return best === def.bottom ? def : { ...def, bottom: best };
}
