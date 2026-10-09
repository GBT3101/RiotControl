/**
 * End-screen newspapers: city mastheads ("El Orden", "The Daily Order", "L'Ordre du Jour")
 * and a composable front page (newsprint frame + masthead + headline + fake column text).
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, hline, px, rect, stamp, vline } from '../fx/draw';
import { waxSeal } from '../fx/misc';
import { rubberStamp } from './banners';
import { textMask } from './logo';
import { panel } from './panels';
import { FONTS, drawText, measureText } from './text';

export type City = 'madrid' | 'london' | 'paris';

export const MASTHEADS: Record<City, { title: string; dateline: string; motto: string }> = {
  madrid: {
    title: 'El Orden',
    dateline: 'MADRID · EDICIÓN ESPECIAL · 2 €',
    motto: '«Todo en orden, nada en duda»',
  },
  london: {
    title: 'The Daily Order',
    dateline: 'LONDON · LATE EXTRA · 50p',
    motto: '"Keep calm and obey"',
  },
  paris: {
    title: "L'Ordre du Jour",
    dateline: 'PARIS · ÉDITION SPÉCIALE · 2 €',
    motto: '« Liberté, Égalité, Formulaire »',
  },
};

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
  // Crest seals either side.
  const seal = waxSeal(6);
  stamp(b, seal, tx - seal.w - 8, ty + (scale === 2 ? 4 : -1));
  stamp(b, seal, tx + t.m.w + 8, ty + (scale === 2 ? 4 : -1));
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

/**
 * Front page: newsprint sheet, masthead, ×2 headline (wrapped), sub-deck, 3 columns of text,
 * a picture box (left for the screen to fill) and an optional rubber stamp over the corner.
 */
export function frontPage(
  city: City,
  headline: string,
  deck: string,
  w = 300,
  h = 220,
  stampKey?: [string, string],
): PixelBuffer {
  const b = panel('newsprint', w, h);
  const mh = masthead(city, w - 12, w - 12);
  stamp(b, mh, 6, 6);
  let y = 6 + mh.h + 4;
  // Headline ×2 (wrap at the page width).
  const lines = [];
  let cur = '';
  for (const word of headline.split(' ')) {
    const t = cur ? `${cur} ${word}` : word;
    if (cur && measureText(FONTS.large, t).w * 2 > w - 20) {
      lines.push(cur);
      cur = word;
    } else cur = t;
  }
  lines.push(cur);
  for (const l of lines) {
    const tm = textMask(FONTS.large, l, 2, 0);
    slabSerifs(tm.m, FONTS.large.capHeight * 2);
    const x0 = Math.floor((w - tm.m.w) / 2);
    for (let yy = 0; yy < tm.m.h; yy++)
      for (let xx = 0; xx < tm.m.w; xx++)
        if (tm.m.m[yy * tm.m.w + xx]) px(b, x0 + xx, y + yy, 'ink');
    y += FONTS.large.capHeight * 2 + 5;
  }
  const dm = measureText(FONTS.small, deck, w - 24);
  drawText(b, FONTS.small, deck, Math.floor(w / 2), y, 'gray1', {
    align: 'center',
    maxWidth: w - 24,
  });
  y += dm.h + 6;
  hline(b, 8, y, w - 16, 'gray3');
  y += 4;
  // Picture box (left two columns) + columns.
  const colW = Math.floor((w - 16 - 8) / 3);
  const pbH = Math.max(20, h - y - 14);
  rect(b, 8, y, colW * 2 + 4, Math.floor(pbH * 0.7), 'gray5');
  rect(b, 9, y + 1, colW * 2 + 2, Math.floor(pbH * 0.7) - 2, 'stone3');
  columnText(b, 8, y + Math.floor(pbH * 0.7) + 4, colW, pbH - Math.floor(pbH * 0.7) - 4, 3);
  columnText(
    b,
    8 + colW + 4,
    y + Math.floor(pbH * 0.7) + 4,
    colW,
    pbH - Math.floor(pbH * 0.7) - 4,
    7,
  );
  vline(b, 8 + colW * 2 + 6, y, pbH, 'gray4');
  columnText(b, 8 + colW * 2 + 9, y, colW - 1, pbH, 11);
  if (stampKey) {
    const st = rubberStamp(stampKey[0], stampKey[1], { tilt: -0.1 });
    stamp(b, st, w - st.w - 10, h - st.h - 12);
  }
  return b;
}

export function registerNewspaper(reg: SpriteRegistry): void {
  for (const c of Object.keys(MASTHEADS) as City[]) {
    reg.add(`ui.masthead.${c}`, { group: 'ui', frames: masthead(c), anchor: { x: 0, y: 0 } });
  }
}
