/**
 * End-screen newspapers: city mastheads ("El Orden", "The Daily Order", "L'Ordre du Jour" — the
 * words live in each city's copy, src/ui/text/city/<city>.ts) and a composable front page
 * (newsprint frame + masthead + headline + fake column text).
 */
import { CITIES, type CityId } from '../../maps/contract';
import { citiesOf } from '../../maps/cityTable';
import { CITY_COPY, OWN_COPY, type CityCopy } from '../../ui/text/cities';
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, hline, px, rect, stamp, vline } from '../fx/draw';
import { waxSeal } from '../fx/misc';
import { rubberStamp } from './banners';
import { textMask } from './logo';
import { panel } from './panels';
import { FONTS, drawText, measureText } from './text';

export type City = CityId;

/** Newspaper mastheads per city (copy: src/ui/text/city/<city>.ts → CityCopy.masthead). */
export const MASTHEADS: Readonly<Record<City, { title: string; dateline: string; motto: string }>> =
  Object.fromEntries(CITIES.map((c) => [c, CITY_COPY[c].masthead])) as Record<
    City,
    CityCopy['masthead']
  >;

/** Integer upscale (nearest). */
export function scaleBuffer(src: PixelBuffer, n: number): PixelBuffer {
  const out = buf(src.w * n, src.h * n);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const i = (((y / n) | 0) * src.w + ((x / n) | 0)) * 4;
      out.data.set(src.data.subarray(i, i + 4), (y * out.w + x) * 4);
    }
  }
  return out;
}

/** Add 1-px slab serifs where vertical strokes meet the cap line or the baseline. */
export function slabSerifs(k: { w: number; h: number; m: Uint8Array }, capH: number): void {
  const set: number[] = [];
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= k.w || y >= k.h ? 0 : k.m[y * k.w + x]!;
  for (const y of [0, 1, capH - 2, capH - 1]) {
    const edgeRow = y === 0 || y === capH - 1;
    for (let x = 0; x < k.w; x++) {
      if (!at(x, y)) continue;
      // Vertical stroke: the pixel continues 3 rows inward.
      const dir = y < capH / 2 ? 1 : -1;
      if (!at(x, y + dir * 2) || !at(x, y + dir * 3)) continue;
      if (!edgeRow) continue;
      for (const dx of [-1, 1]) {
        if (x + dx < 0 || x + dx >= k.w) continue;
        if (!at(x + dx, y) && !at(x + dx, y + dir)) {
          set.push(y * k.w + x + dx);
          // Second serif row for weight.
          if (at(x, y + dir)) set.push((y + dir) * k.w + x + dx);
        }
      }
    }
  }
  for (const i of set) if (i >= 0 && i < k.m.length) k.m[i] = 1;
}

/** Masthead strip (newsprint background): crest seals, ×2 title, rules, dateline + motto. */
export function masthead(city: City, minW = 0, maxW = Infinity): PixelBuffer {
  const m = MASTHEADS[city];
  const f = FONTS.large;
  let scale = 2;
  let t = textMask(f, m.title, 2, 1);
  if (t.m.w + 64 > maxW) {
    scale = 1;
    t = textMask(f, m.title, 1, 1);
  }
  slabSerifs(t.m, f.capHeight * scale);
  const W = Math.min(
    maxW,
    Math.max(
      minW,
      t.m.w + 64,
      measureText(FONTS.small, m.dateline).w + measureText(FONTS.small, m.motto).w + 24,
    ),
  );
  const H = 9 + scale * f.capHeight + 3 + 17;
  const b = buf(W, H);
  rect(b, 0, 0, W, H, 'stone4');
  // Double rules top and bottom (thick + thin).
  hline(b, 2, 2, W - 4, 'ink');
  hline(b, 2, 3, W - 4, 'ink');
  hline(b, 2, 5, W - 4, 'ink');
  const ty = 9;
  const tx = Math.floor((W - t.m.w) / 2);
  for (let y = 0; y < t.m.h; y++) {
    for (let x = 0; x < t.m.w; x++) {
      if (!t.m.m[y * t.m.w + x]) continue;
      px(b, tx + x, ty + y, 'ink');
    }
  }
  // Crest seals either side: full size, else smaller and closer, else none (never clipped by the
  // page edge on narrow phone pages with long titles).
  for (const [r, gap] of [
    [6, 8],
    [4, 4],
  ] as const) {
    const seal = waxSeal(r);
    if (tx - seal.w - gap < 3) continue;
    const sy =
      ty + (r === 6 ? (scale === 2 ? 4 : -1) : Math.floor((scale * f.capHeight - seal.h) / 2));
    stamp(b, seal, tx - seal.w - gap, sy);
    stamp(b, seal, tx + t.m.w + gap, sy);
    break;
  }
  const ry = ty + scale * f.capHeight + 3;
  hline(b, 2, ry, W - 4, 'ink');
  const dl = measureText(FONTS.small, m.dateline);
  drawText(b, FONTS.small, m.dateline, 4, ry + 3, 'ink');
  const mo = measureText(FONTS.small, m.motto);
  if (dl.w + mo.w + 16 < W) drawText(b, FONTS.small, m.motto, W - 4 - mo.w, ry + 3, 'stone1');
  hline(b, 2, H - 4, W - 4, 'ink');
  hline(b, 2, H - 2, W - 4, 'ink');
  hline(b, 2, H - 3, W - 4, 'ink');
  return b;
}

/** Rows of "typeset" column text: dashes of ink/gray words with paragraph breaks. */
function columnText(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
): void {
  let s = seed;
  const rnd = (): number => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let yy = y; yy < y + h - 1; yy += 3) {
    let xx = x + ((yy - y) % 27 === 0 ? 3 : 0);
    const end = (yy - y) % 27 === 24 ? x + w * (0.4 + rnd() * 0.4) : x + w;
    while (xx < end - 2) {
      const ww = 2 + Math.floor(rnd() * 5);
      hline(b, xx, yy, Math.min(ww, end - xx), rnd() < 0.15 ? 'gray3' : 'gray4');
      xx += ww + 1;
    }
  }
}

interface PageBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometry of a front page (page px): every text block, the picture box and the stamp. */
export interface FrontPageLayout {
  masthead: PageBox;
  /** Headline lines (×2 display text), wrapped at the page width. */
  headline: Array<PageBox & { text: string }>;
  deck: PageBox;
  /** Picture box (outer frame; the photo goes 1 px inside). */
  photo: PageBox;
  /** Typeset column blocks. */
  columns: PageBox[];
  /** Column rule (x, y, h). */
  rule: { x: number; y: number; h: number };
  /** Rubber-stamp spot (bottom-right corner) — nothing else is set there. */
  stamp: PageBox | null;
}

/**
 * Front-page layout. The stamp (when its size is given) owns the bottom-right corner: the
 * picture box and the column text that would run under it stop above it, so the stamp only
 * ever lands on blank newsprint. Pure.
 */
export function frontPageLayout(
  city: City,
  headline: string,
  deck: string,
  w = 300,
  h = 220,
  stampSize?: { w: number; h: number },
): FrontPageLayout {
  const mh = masthead(city, w - 12, w - 12);
  let y = 6 + mh.h + 4;
  // Headline ×2 (wrap at the page width).
  const lines: string[] = [];
  let cur = '';
  for (const word of headline.split(' ')) {
    const t = cur ? `${cur} ${word}` : word;
    if (cur && measureText(FONTS.large, t).w * 2 > w - 20) {
      lines.push(cur);
      cur = word;
    } else cur = t;
  }
  lines.push(cur);
  const head = lines.map((text) => {
    const tw = textMask(FONTS.large, text, 2, 0).m.w;
    const box = { text, x: Math.floor((w - tw) / 2), y, w: tw, h: FONTS.large.capHeight * 2 };
    y += FONTS.large.capHeight * 2 + 5;
    return box;
  });
  const dm = measureText(FONTS.small, deck, w - 24);
  const deckBox = {
    x: Math.floor(w / 2) - Math.floor(dm.w / 2),
    y: y - FONTS.small.ascent,
    w: dm.w,
    h: dm.h + FONTS.small.ascent + FONTS.small.descent,
  };
  y += dm.h + 6;
  y += 4;
  // Picture box (left two columns) + columns.
  const colW = Math.floor((w - 16 - 8) / 3);
  const pbH = Math.max(20, h - y - 14);
  const st = stampSize
    ? { x: w - stampSize.w - 10, y: h - stampSize.h - 12, w: stampSize.w, h: stampSize.h }
    : null;
  // Bottom of a block spanning [x0, x1): above the stamp when the stamp is under it.
  const floor = (x0: number, x1: number): number =>
    st && x1 > st.x - 2 && x0 < st.x + st.w + 2 ? Math.min(y + pbH, st.y - 3) : y + pbH;
  const photoW = colW * 2 + 4;
  const photoH = Math.max(0, Math.min(Math.floor(pbH * 0.7), floor(8, 8 + photoW) - y));
  const columns: PageBox[] = [];
  const below = y + photoH + 4;
  for (const [x, cw] of [
    [8, colW],
    [8 + colW + 4, colW],
  ] as const) {
    // A column the stamp only clips at its right edge is narrowed instead of cut short.
    const narrow = st ? st.x - 4 - x : cw;
    const w2 = narrow < cw && narrow >= cw / 2 ? narrow : cw;
    const ch = floor(x, x + w2) - below;
    if (ch >= 4) columns.push({ x, y: below, w: w2, h: ch });
  }
  const rx = 8 + colW * 2 + 6;
  const c3x = 8 + colW * 2 + 9;
  const c3h = floor(c3x, c3x + colW - 1) - y;
  if (c3h >= 4) columns.push({ x: c3x, y, w: colW - 1, h: c3h });
  return {
    masthead: { x: 6, y: 6, w: mh.w, h: mh.h },
    headline: head,
    deck: deckBox,
    photo: { x: 8, y, w: photoW, h: photoH },
    columns,
    rule: { x: rx, y, h: floor(rx, rx + 1) - y },
    stamp: st,
  };
}

/**
 * Front page: newsprint sheet, masthead, ×2 headline (wrapped), sub-deck, 3 columns of text,
 * a picture box (left for the screen to fill) and an optional rubber stamp in the bottom-right
 * corner (`stampKey`), or just room kept for one stamped later (`reserve`).
 */
export function frontPage(
  city: City,
  headline: string,
  deck: string,
  w = 300,
  h = 220,
  stampKey?: [string, string],
  reserve?: { w: number; h: number },
): PixelBuffer {
  const b = panel('newsprint', w, h);
  const st = stampKey ? rubberStamp(stampKey[0], stampKey[1], { tilt: -0.1 }) : null;
  const lay = frontPageLayout(city, headline, deck, w, h, st ?? reserve);
  stamp(b, masthead(city, w - 12, w - 12), lay.masthead.x, lay.masthead.y);
  for (const l of lay.headline) {
    const tm = textMask(FONTS.large, l.text, 2, 0);
    slabSerifs(tm.m, FONTS.large.capHeight * 2);
    for (let yy = 0; yy < tm.m.h; yy++)
      for (let xx = 0; xx < tm.m.w; xx++)
        if (tm.m.m[yy * tm.m.w + xx]) px(b, l.x + xx, l.y + yy, 'ink');
  }
  drawText(b, FONTS.small, deck, Math.floor(w / 2), lay.deck.y + FONTS.small.ascent, 'gray1', {
    align: 'center',
    maxWidth: w - 24,
  });
  hline(b, 8, lay.photo.y - 4, w - 16, 'gray3');
  const p = lay.photo;
  if (p.h > 2) {
    rect(b, p.x, p.y, p.w, p.h, 'gray5');
    rect(b, p.x + 1, p.y + 1, p.w - 2, p.h - 2, 'stone3');
  }
  lay.columns.forEach((c, k) => columnText(b, c.x, c.y, c.w, c.h, 3 + k * 4));
  if (lay.rule.h > 0) vline(b, lay.rule.x, lay.rule.y, lay.rule.h, 'gray4');
  if (st && lay.stamp) stamp(b, st, lay.stamp.x, lay.stamp.y);
  return b;
}

export function registerNewspaper(reg: SpriteRegistry): void {
  for (const c of citiesOf(OWN_COPY)) {
    reg.add(`ui.masthead.${c}`, { group: 'ui', frames: masthead(c), anchor: { x: 0, y: 0 } });
  }
}
