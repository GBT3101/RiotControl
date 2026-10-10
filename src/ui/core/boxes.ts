/**
 * Box geometry for overlap-free layouts (pure, unit-tested): text ink boxes measured with the
 * bitmap fonts, stamp / badge boxes, and the overlap checks the layout tests assert with. Every
 * composition that places a stamp, ribbon or title near text exposes its boxes through a small
 * layout function so a test can prove nothing covers any text for every real string.
 */
import type { PixelBuffer } from '../../art/lib/pixels';
import { measureText, type BitmapFont } from '../../art/uikit/text';
import type { Rect } from './node';

export type Box = Rect;

/** Ink box of a text block plus the y its first cap line is drawn at. */
export interface TextBox extends Box {
  capY: number;
}

/**
 * Ink box of text drawn with `drawText(…, x, y, …, { maxWidth })` (y = cap top of line 1):
 * includes the accents above the first line's caps and the descenders under the last line.
 */
export function textBox(
  font: BitmapFont,
  str: string,
  x: number,
  y: number,
  maxWidth?: number,
  lineGap = 0,
): TextBox {
  const m = measureText(font, str, maxWidth);
  if (!str) return { x, y, w: 0, h: 0, capY: y };
  const h = (m.lines.length - 1) * (font.lineHeight + lineGap) + font.capHeight;
  const up = inkRows(font, m.lines[0] ?? '').above;
  const down = inkRows(font, m.lines[m.lines.length - 1] ?? '').below;
  return { x, y: y - up, w: m.w, h: h + up + down, capY: y };
}

/**
 * `textBox` at cap line `capY`, moved down just enough that its ink starts at or below `after`
 * (the first free row under the previous block): flowing blocks keep their designed spacing
 * and only move when an accent or a descender would touch the block above.
 */
export function textBelow(
  font: BitmapFont,
  str: string,
  x: number,
  capY: number,
  after: number,
  maxWidth?: number,
  lineGap = 0,
): TextBox {
  const b = textBox(font, str, x, capY, maxWidth, lineGap);
  const d = after - b.y;
  return d > 0 ? textBox(font, str, x, capY + d, maxWidth, lineGap) : b;
}

/** Cap-to-last-baseline height of wrapped text (the layout's nominal block height). */
export function capBlockH(font: BitmapFont, str: string, maxWidth?: number, lineGap = 0): number {
  const n = measureText(font, str, maxWidth).lines.length;
  return (n - 1) * (font.lineHeight + lineGap) + font.capHeight;
}

/** Rows a line's glyphs reach above the cap line (accents) and below the baseline. */
export function inkRows(font: BitmapFont, line: string): { above: number; below: number } {
  let above = 0;
  let below = 0;
  for (const ch of line) {
    if (ch === ' ') continue;
    const c = font.upperOnly ? ch.toUpperCase() : ch;
    const g = font.glyphs.get(c) ?? font.glyphs.get(c.toUpperCase()) ?? font.glyphs.get('?');
    if (!g) continue;
    above = Math.max(above, -g.y0);
    below = Math.max(below, g.y0 + g.h - font.capHeight);
  }
  return { above, below };
}

/** Box of a pixel buffer stamped at (x, y). */
export function bufBox(b: PixelBuffer, x: number, y: number): Box {
  return { x, y, w: b.w, h: b.h };
}

/** Do two boxes intersect (or come closer than `gap` px)? Empty boxes never overlap. */
export function overlaps(a: Box, b: Box, gap = 0): boolean {
  if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;
  return (
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  );
}

/** Is `inner` fully inside `outer` (with an optional margin)? */
export function inside(inner: Box, outer: Box, margin = 0): boolean {
  return (
    inner.x >= outer.x + margin &&
    inner.y >= outer.y + margin &&
    inner.x + inner.w <= outer.x + outer.w - margin &&
    inner.y + inner.h <= outer.y + outer.h - margin
  );
}

/** First pair of overlapping boxes among named boxes (null = none), for test messages. */
export function firstOverlap(boxes: Record<string, Box>, gap = 0): string | null {
  const keys = Object.keys(boxes);
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++)
      if (overlaps(boxes[keys[i]!]!, boxes[keys[j]!]!, gap)) return `${keys[i]} × ${keys[j]}`;
  return null;
}

/**
 * A w×h box centred as near (cx, cy) as possible that overlaps none of `avoid` and stays in
 * `area`: tries the spot, then steps outward vertically, then horizontally (falls back to the
 * centred spot clamped into the area).
 */
export function clearSpot(
  w: number,
  h: number,
  cx: number,
  cy: number,
  avoid: readonly Box[],
  area: Box,
  step = 6,
): Box {
  const clamp = (x: number, y: number): Box => ({
    x: Math.max(area.x, Math.min(area.x + area.w - w, Math.round(x - w / 2))),
    y: Math.max(area.y, Math.min(area.y + area.h - h, Math.round(y - h / 2))),
    w,
    h,
  });
  const free = (b: Box): boolean => !avoid.some((r) => overlaps(b, r, 1));
  for (let k = 0; k * step <= Math.max(area.w, area.h); k++)
    for (const [dx, dy] of [
      [0, -k],
      [0, k],
      [-k, 0],
      [k, 0],
    ] as const) {
      const b = clamp(cx + dx * step, cy + dy * step);
      if (free(b)) return b;
    }
  return clamp(cx, cy);
}
