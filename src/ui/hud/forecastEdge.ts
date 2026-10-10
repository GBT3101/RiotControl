/**
 * Pure placement math for the incoming-wave markers (UI px): is a district's rally point on
 * screen, and where along the screen edge does its pointer go when it is not (on the ray from
 * the free area's centre toward the district, clear of the minimap, the wave button and the
 * other pointers). Unit-tested in tests/forecast.test.ts.
 */
import type { Rect } from '../core/node';

/** Box of a pointer around its centre (disc, NEW tag above, count plate below). */
export interface Extent {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function boxAt(x: number, y: number, e: Extent): Rect {
  return { x: x - e.left, y: y - e.top, w: e.left + e.right, h: e.top + e.bottom };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Is a point inside the free world area (shrunk by `margin`)? */
export function onScreen(x: number, y: number, area: Rect, margin = 0): boolean {
  return (
    x >= area.x + margin &&
    y >= area.y + margin &&
    x <= area.x + area.w - margin &&
    y <= area.y + area.h - margin
  );
}

/**
 * Edge position for a pointer toward target (tx, ty): where the ray from the area's centre to
 * the target leaves the area shrunk by the pointer's extent; then nudged off every `avoid` rect
 * (nearest free candidate). Always inside the shrunk area.
 */
export function edgePoint(
  tx: number,
  ty: number,
  area: Rect,
  ext: Extent,
  avoid: readonly Rect[] = [],
): { x: number; y: number } {
  const x0 = area.x + ext.left;
  const x1 = area.x + area.w - ext.right;
  const y0 = area.y + ext.top;
  const y1 = area.y + area.h - ext.bottom;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const clampX = (x: number): number => Math.max(x0, Math.min(x1, x));
  const clampY = (y: number): number => Math.max(y0, Math.min(y1, y));
  const dx = tx - cx;
  const dy = ty - cy;
  let t = 1;
  if (dx > 0) t = Math.min(t, (x1 - cx) / dx);
  if (dx < 0) t = Math.min(t, (x0 - cx) / dx);
  if (dy > 0) t = Math.min(t, (y1 - cy) / dy);
  if (dy < 0) t = Math.min(t, (y0 - cy) / dy);
  let x = clampX(cx + dx * t);
  let y = clampY(cy + dy * t);
  const blocked = (px: number, py: number): Rect | undefined =>
    avoid.find((r) => overlaps(boxAt(px, py, ext), r));
  // Slide along the edge the pointer sits on first (it must stay at the edge), then inward.
  const horizontalEdge = Math.abs(y - y0) < 0.5 || Math.abs(y - y1) < 0.5;
  const dist = (c: { x: number; y: number }): number => Math.hypot(c.x - x, c.y - y);
  for (let iter = 0; iter < 8; iter++) {
    const r = blocked(x, y);
    if (!r) break;
    const vertical = [
      { x, y: clampY(r.y + r.h + ext.top) },
      { x, y: clampY(r.y - ext.bottom) },
    ];
    const horizontal = [
      { x: clampX(r.x + r.w + ext.left), y },
      { x: clampX(r.x - ext.right), y },
    ];
    const along = (horizontalEdge ? horizontal : vertical).sort((a, b) => dist(a) - dist(b));
    const inward = (horizontalEdge ? vertical : horizontal).sort((a, b) => dist(a) - dist(b));
    const cands = [...along, ...inward].filter((c) => c.x !== x || c.y !== y);
    const next = cands.find((c) => !blocked(c.x, c.y)) ?? cands[0];
    if (!next) break;
    x = next.x;
    y = next.y;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

/** Compact head count for the plates: 5-steps below 100, 10-steps below 1000, then "1.2k". */
export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n >= 100) return `${Math.round(n / 10) * 10}`;
  return `${Math.max(5, Math.round(n / 5) * 5)}`;
}
