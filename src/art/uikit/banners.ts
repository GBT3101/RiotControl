/**
 * Banners & rubber stamps: level-up ribbon, wave-incoming hazard banner, ink stamps
 * (APPROVED, DENIED, CLASSIFIED, ORDER RESTORED, REGIME FALLEN, …) with worn-ink texture and an
 * optional tilt (column shear ≈ −5°).
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, col, hline, inEllipse, prng, px, rect, stamp, vline } from '../fx/draw';
import { ICONS } from './icons';
import { FONTS, drawText, measureText, type BitmapFont } from './text';

/* Rubber stamps -------------------------------------------------------------- */

export interface StampOptions {
  font?: BitmapFont;
  /** Shear slope (px per column, negative rises to the right). Default −0.09. 0 = straight. */
  tilt?: number;
  /** Wear amount 0..1 (default 0.5). */
  wear?: number;
  seed?: number;
  /** Second line in the small bold font (e.g. a date or file number). */
  sub?: string;
}

/** A rubber-stamp imprint in one ink colour: double border, display text, worn patches. */
export function rubberStamp(text: string, ink: string, opts: StampOptions = {}): PixelBuffer {
  const font = opts.font ?? FONTS.large;
  const m = measureText(font, text);
  const subM = opts.sub ? measureText(FONTS.smallBold, opts.sub) : null;
  const pad = 5;
  const innerW = Math.max(m.w, subM?.w ?? 0) + pad * 2;
  const innerH = font.capHeight + pad * 2 - 1 + (subM ? FONTS.smallBold.capHeight + 4 : 0);
  const W = innerW + 8;
  const H = innerH + 8;
  const flat = buf(W, H);
  // Outer 2-px border, 1-px gap, inner 1-px border.
  for (const [o, t] of [
    [0, 2],
    [3, 1],
  ] as const) {
    for (let i = 0; i < t; i++) {
      hline(flat, o + i, o + i, W - (o + i) * 2, ink);
      hline(flat, o + i, H - 1 - o - i, W - (o + i) * 2, ink);
      vline(flat, o + i, o + i, H - (o + i) * 2, ink);
      vline(flat, W - 1 - o - i, o + i, H - (o + i) * 2, ink);
    }
  }
  drawText(flat, font, text, Math.floor((W - m.w) / 2), 3 + pad, ink);
  if (opts.sub && subM)
    drawText(
      flat,
      FONTS.smallBold,
      opts.sub,
      Math.floor((W - subM.w) / 2),
      4 + pad + font.capHeight + 4,
      ink,
    );
  // Worn ink: carve a few small cluster-shaped holes (never single-pixel noise).
  const rnd = prng(opts.seed ?? text.length * 31 + 7);
  const wear = opts.wear ?? 0.5;
  const holes = Math.round(((W * H) / 140) * wear);
  for (let i = 0; i < holes; i++) {
    const cx = rnd() * W;
    const cy = rnd() * H;
    const r = 0.7 + rnd() * 1.1;
    const ry = r * (0.5 + rnd() * 0.5);
    for (let y = Math.floor(cy - 2); y <= cy + 2; y++) {
      for (let x = Math.floor(cx - 2); x <= cx + 2; x++) {
        if (x >= 0 && y >= 0 && x < W && y < H && inEllipse(x, y, cx, cy, r, ry))
          flat.data.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 4);
      }
    }
  }
  // Uneven pressure: one edge prints fainter (every other pixel of the right border column).
  for (let y = 1; y < H - 1; y += 3)
    flat.data.fill(0, (y * W + W - 1) * 4, (y * W + W - 1) * 4 + 4);
  const tilt = opts.tilt ?? -0.09;
  if (!tilt) return flat;
  const lift = Math.ceil(Math.abs(tilt) * W);
  const out = buf(W, H + lift);
  for (let x = 0; x < W; x++) {
    const dy = tilt < 0 ? Math.round(lift + tilt * x) : Math.round(tilt * x);
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (flat.data[i + 3]) out.data.set(flat.data.subarray(i, i + 4), ((y + dy) * W + x) * 4);
    }
  }
  return out;
}

export const STAMPS: Record<string, [string, string]> = {
  approved: ['APPROVED', 'green2'],
  denied: ['DENIED', 'crim1'],
  classified: ['CLASSIFIED', 'crim1'],
  restored: ['ORDER RESTORED', 'navy2'],
  fallen: ['REGIME FALLEN', 'ink'],
  topsecret: ['TOP SECRET', 'crim1'],
};

/* Ribbon (level-up) ------------------------------------------------------------- */

/** Ministry-red ribbon with brass piping and swallow-tail ends behind it. */
export function ribbon(text: string, font: BitmapFont = FONTS.large): PixelBuffer {
  const m = measureText(font, text);
  const bandH = font.capHeight + 12;
  const tail = 18;
  const drop = 5;
  const bandW = m.w + 24;
  const W = bandW + tail * 2;
  const H = bandH + drop + 2;
  const b = buf(W, H);
  // Tails (behind, lower), swallow-tail notches.
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : W - tail - 6;
    const tw = tail + 6;
    for (let y = 0; y < bandH - 2; y++) {
      for (let x = 0; x < tw; x++) {
        const outerX = side === 0 ? x : tw - 1 - x;
        const notch = Math.abs(y - (bandH - 2) / 2 + 0.5) < (bandH - 2) / 2 - outerX * 1.1;
        if (notch && outerX < 7) continue;
        const c = y === 0 ? 'crim1' : y >= bandH - 4 ? 'rust0' : 'rust1';
        px(b, x0 + x, drop + y, c);
      }
    }
    // Fold shadow (dark triangle where the tail tucks under the band).
    const fx = side === 0 ? tail : W - tail - 1;
    for (let i = 0; i < drop; i++)
      for (let k = 0; k <= i; k++)
        px(b, side === 0 ? fx + 5 - k : fx - 5 + k, bandH - 2 + i - 2, 'rust0');
  }
  // Band.
  const bx = tail;
  rect(b, bx, 0, bandW, bandH, 'crim1');
  hline(b, bx, 1, bandW, 'crim2');
  hline(b, bx, 2, bandW, 'crim2');
  hline(b, bx, 3, bandW, 'ochre3');
  hline(b, bx, bandH - 4, bandW, 'ochre1');
  hline(b, bx, bandH - 3, bandW, 'rust1');
  hline(b, bx, bandH - 2, bandW, 'rust1');
  hline(b, bx, bandH - 1, bandW, 'rust0');
  // Outline everything.
  const marks: Array<[number, number]> = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (b.data[(y * W + x) * 4 + 3]) continue;
      const n = (xx: number, yy: number): boolean =>
        xx >= 0 && yy >= 0 && xx < W && yy < H && b.data[(yy * W + xx) * 4 + 3]! > 0;
      if (n(x + 1, y) || n(x - 1, y) || n(x, y + 1) || n(x, y - 1)) marks.push([x, y]);
    }
  }
  for (const [x, y] of marks) px(b, x, y, 'ink');
  // Band edges over the tails.
  vline(b, bx, 0, bandH, 'ink');
  vline(b, bx + bandW - 1, 0, bandH, 'ink');
  hline(b, bx, 0, bandW, 'ink');
  drawText(b, font, text, bx + 12, 6, 'stone5', {
    outline: 'rust0',
    outlineThin: true,
    shadow: 'ink',
    ramp: ['white', 'stone5', 'stone5', 'stone4'],
  });
  return b;
}

/* Wave banner ----------------------------------------------------------------- */

/** Hazard-tape banner: manila strip with megaphone + "WAVE n INCOMING", hi-vis/ink stripes. */
export function waveBanner(wave: number | string, label = 'INCOMING'): PixelBuffer {
  const f = FONTS.large;
  const text = `WAVE ${wave} ${label}`;
  const m = measureText(f, text);
  const icon = ICONS.wave();
  const W = m.w + icon.w + 34;
  const stripe = 5;
  const midH = f.capHeight + 10;
  const H = midH + stripe * 2 + 2;
  const b = buf(W, H);
  for (const y0 of [0, H - stripe - 1]) {
    for (let y = 0; y < stripe; y++) {
      for (let x = 0; x < W; x++)
        px(b, x, y0 + y + 1, Math.floor((x + y + (y0 ? 3 : 0)) / 4) % 2 === 0 ? 'hivis2' : 'ink');
    }
  }
  rect(b, 0, stripe + 1, W, midH, 'stone4');
  hline(b, 0, stripe + 1, W, 'stone5');
  hline(b, 0, stripe + midH, W, 'stone3');
  hline(b, 0, 0, W, 'ink');
  hline(b, 0, H - 1, W, 'ink');
  hline(b, 0, stripe + 1 + midH, W, 'ink');
  hline(b, 0, stripe, W, 'ink');
  vline(b, 0, 0, H, 'ink');
  vline(b, W - 1, 0, H, 'ink');
  stamp(b, icon, 10, stripe + 1 + Math.floor((midH - icon.h) / 2));
  drawText(b, f, text, 14 + icon.w + 6, stripe + 1 + 5, 'ink', { shadow: 'stone3' });
  return b;
}

export function registerBanners(reg: SpriteRegistry): void {
  for (const [key, [text, ink]] of Object.entries(STAMPS)) {
    const s = rubberStamp(text, ink);
    reg.add(`ui.stamp.${key}`, {
      group: 'ui',
      frames: s,
      anchor: { x: Math.floor(s.w / 2), y: Math.floor(s.h / 2) },
    });
  }
  const lv = ribbon('NEW TOOL OF ORDER APPROVED');
  reg.add('ui.banner.levelup', {
    group: 'ui',
    frames: lv,
    anchor: { x: Math.floor(lv.w / 2), y: 0 },
  });
  const wv = waveBanner(3);
  reg.add('ui.banner.wave', { group: 'ui', frames: wv, anchor: { x: Math.floor(wv.w / 2), y: 0 } });
  void col;
}
