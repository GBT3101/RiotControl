/**
 * Campaign map dossier cards (E1). A built city gets the city-select postcard (photo of its
 * Capitol, records, DEPLOY); a city still being built gets a construction file instead: a
 * blueprint "photo" under hazard tape, the city's note, its level ribbon and an UNDER
 * CONSTRUCTION stamp where DEPLOY would be. Pure (buffers + boxes), tested for overlaps.
 */
import { buf, hline, line, px, rect, stamp, vline } from '../../art/fx/draw';
import type { PixelBuffer } from '../../art/lib/pixels';
import { rubberStamp } from '../../art/uikit/banners';
import { FONTS, drawText, measureText } from '../../art/uikit/text';
import { overlaps, textBox, type Box } from '../core/boxes';
import type { CampaignCity } from '../campaign';
import { levelRibbon } from '../campaign';
import { dossier } from './common';

/** The construction stamp (same art everywhere: card and tests). */
export function constructionStamp(): PixelBuffer {
  return rubberStamp('UNDER CONSTRUCTION', 'rust1', {
    font: FONTS.smallBold,
    tilt: -0.05,
    seed: 9,
  });
}

/** A small red ribbon with white caps (LEVEL 1 · TUTORIAL). */
export function ribbonBadge(text: string): PixelBuffer {
  const m = measureText(FONTS.smallBold, text);
  const w = m.w + 10;
  const h = FONTS.smallBold.capHeight + 6;
  const b = buf(w, h);
  rect(b, 0, 0, w, h, 'rust0');
  rect(b, 1, 1, w - 2, h - 2, 'crim2');
  hline(b, 1, 1, w - 2, 'rust4');
  hline(b, 1, h - 2, w - 2, 'crim1');
  // Swallow-tail notches.
  for (const x of [0, w - 1]) {
    px(b, x, Math.floor(h / 2), 'rust0');
    px(b, x === 0 ? 1 : w - 2, Math.floor(h / 2), 'rust0');
  }
  b.data.fill(0, ((h >> 1) * w + 0) * 4, ((h >> 1) * w + 1) * 4);
  b.data.fill(0, ((h >> 1) * w + w - 1) * 4, ((h >> 1) * w + w) * 4);
  drawText(b, FONTS.smallBold, text, 5, 3, 'white');
  return b;
}

/** Blueprint "photo": cyanotype grid, a sketched skyline and hazard tape across a corner. */
export function blueprintPhoto(w: number, h: number, seed: number): PixelBuffer {
  const b = buf(w, h);
  rect(b, 0, 0, w, h, 'navy2');
  for (let x = 2; x < w; x += 6) vline(b, x, 0, h, 'navy1');
  for (let y = 3; y < h; y += 6) hline(b, 0, y, w, 'navy1');
  // A pencilled skyline: blocks, a dome and a spire (varied per city).
  const base = h - 6;
  let x = 3;
  let k = seed;
  while (x < w - 6) {
    k = (k * 1103515245 + 12345) >>> 0;
    const bw = 6 + (k % 9);
    const bh = 8 + ((k >> 8) % Math.max(4, Math.floor(h * 0.45)));
    const x1 = Math.min(w - 4, x + bw);
    const top = base - bh;
    hline(b, x, top, x1 - x, 'sky');
    vline(b, x, top, bh, 'sky');
    vline(b, x1, top, bh, 'sky');
    // Windows.
    for (let wy = top + 3; wy < base - 2; wy += 4)
      for (let wx = x + 2; wx < x1 - 1; wx += 3) px(b, wx, wy, 'blue2');
    if ((k >> 16) % 3 === 0) {
      // Dome.
      const cx = Math.floor((x + x1) / 2);
      for (let a = 0; a <= Math.PI; a += 0.15)
        px(b, cx + Math.round(Math.cos(a) * 3), top - Math.round(Math.sin(a) * 3), 'sky');
      vline(b, cx, top - 6, 2, 'sky');
    } else if ((k >> 16) % 3 === 1) {
      line(b, x, top, Math.floor((x + x1) / 2), top - 6, 'sky');
      line(b, x1, top, Math.floor((x + x1) / 2), top - 6, 'sky');
    }
    x = x1 + 3;
  }
  hline(b, 0, base, w, 'sky');
  // Hazard tape across the lower-right corner.
  for (let t = -h; t < w; t++) {
    for (let s = 0; s < 5; s++) {
      const xx = t + s;
      const yy = h - 1 - (t - (w - h * 0.9)) - s;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const edge = s === 0 || s === 4;
      px(b, xx, Math.round(yy), edge ? 'ink' : Math.floor((t + 40) / 3) % 2 ? 'hivis2' : 'ink');
    }
  }
  // Photo border.
  const out = buf(w + 6, h + 6);
  rect(out, 0, 0, w + 6, h + 6, 'ink');
  rect(out, 1, 1, w + 4, h + 4, 'white');
  hline(out, 1, h + 4, w + 4, 'stone4');
  stamp(out, b, 3, 3);
  return out;
}

/**
 * Construction file for an unbuilt city: same shape as the postcard (`horizontal` = wide and
 * short, for portrait phones). Returns the buffer and every text / stamp box (buffer px).
 */
export function constructionCard(
  c: CampaignCity,
  w: number,
  h: number,
  horizontal: boolean,
): { buf: PixelBuffer; boxes: Record<string, Box> } {
  const b = dossier(w, h, `FILE: ${c.name.toUpperCase()}`, !horizontal);
  const boxes: Record<string, Box> = {};
  const oy = 10;
  const bottom = oy + h - 4;
  const st = constructionStamp();
  const ribbon = levelRibbon(c);
  const rb = ribbon ? ribbonBadge(ribbon) : null;
  const put = (
    key: string,
    font: typeof FONTS.small,
    str: string,
    x: number,
    y: number,
    maxW: number,
    colour: string,
    centre: boolean,
    avoid: Box[] = [],
  ): number => {
    const t = textBox(font, str, x, y, maxW);
    const box = centre ? { ...t, x: x + Math.floor((maxW - t.w) / 2) } : t;
    if (box.y + box.h > bottom || avoid.some((a) => overlaps(box, a, 1))) return y;
    drawText(b, font, str, centre ? x + Math.floor(maxW / 2) : x, y, colour, {
      maxWidth: maxW,
      ...(centre ? { align: 'center' as const } : {}),
      ...(font === FONTS.large ? { shadow: 'stone3' } : {}),
    });
    boxes[key] = box;
    return box.y + box.h + 3 + font.ascent;
  };
  if (horizontal) {
    const pw = Math.min(104, Math.floor(w * 0.42));
    const ph = h - 22;
    stamp(b, blueprintPhoto(pw, ph, c.id.length * 7 + c.lat), 6, oy + 6);
    boxes.photo = { x: 6, y: oy + 6, w: pw + 6, h: ph + 6 };
    const x = pw + 16;
    const tw = w - x - 8;
    // The stamp sits at the bottom right; text flows above / beside it.
    const sb = { x: w - 6 - st.w, y: bottom - st.h, w: st.w, h: st.h };
    let y = oy + 7;
    if (rb) {
      stamp(b, rb, x - 2, y - 2);
      boxes.ribbon = { x: x - 2, y: y - 2, w: rb.w, h: rb.h };
      y += rb.h + 2;
    }
    y = put('name', FONTS.large, c.name.toUpperCase(), x, y, tw, 'ink', false);
    y = put('country', FONTS.small, c.country.toUpperCase(), x, y - 2, tw, 'stone1', false);
    put('note', FONTS.small, c.note, x, y, tw, 'rust1', false, [sb]);
    if (sb.y > (boxes.note ?? boxes.country ?? boxes.name)!.y) {
      stamp(b, st, sb.x, sb.y);
      boxes.stamp = sb;
    }
    return { buf: b, boxes };
  }
  const pw = w - 16;
  const ph = Math.max(36, Math.min(70, Math.floor(h * 0.36)));
  stamp(b, blueprintPhoto(pw - 6, ph, c.id.length * 7 + c.lat), 8, oy + 7);
  boxes.photo = { x: 8, y: oy + 7, w: pw, h: ph + 6 };
  if (rb) {
    // The ribbon is pinned across the photo's top edge (over the picture, not text).
    const rx = Math.floor((w - rb.w) / 2);
    stamp(b, rb, rx, oy + 3);
    boxes.ribbon = { x: rx, y: oy + 3, w: rb.w, h: rb.h };
  }
  let y = oy + 7 + ph + 10;
  y = put('name', FONTS.large, c.name.toUpperCase(), 6, y, w - 12, 'ink', true);
  y = put('country', FONTS.small, c.country.toUpperCase(), 6, y - 3, w - 12, 'stone1', true);
  for (let x = 8; x < w - 8; x += 2) px(b, x, y - 3, 'stone2');
  const sb = { x: Math.floor((w - st.w) / 2), y: bottom - st.h - 1, w: st.w, h: st.h };
  put('note', FONTS.small, c.note, 8, y + 1, w - 16, 'rust1', true, [sb]);
  stamp(b, st, sb.x, sb.y);
  boxes.stamp = sb;
  return { buf: b, boxes };
}
