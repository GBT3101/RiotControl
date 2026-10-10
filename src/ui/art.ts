/**
 * UI-side pixel art compositions built from the M5 kit primitives and the worker-built atlas:
 * unit portraits, deploy-card figures and protester figures read back from the atlas, the
 * compact deploy card for phones (30×38), small panels and dividers. Palette-pure (RIOT-64
 * refs only).
 */
import { buf, col, hline, px, rect, stamp, vline } from '../art/fx/draw';
import { crop, opaqueBounds, type PixelBuffer } from '../art/lib/pixels';
import { costStrip, lockLabel, type CardState } from '../art/uikit/cards';
import {
  CARD_FIGURES,
  composeFigure,
  drawFigureWindow,
  type CardFigure,
  type FigureSize,
} from '../art/uikit/cardFigures';
import { ICONS } from '../art/uikit/icons';
import { FONTS, drawText, measureText } from '../art/uikit/text';
import type { ProtesterId } from '../data/protesters';
import type { UnitId } from '../data/units';
import { art } from '../art/lib/atlas';
import { atlasBuffer } from './core/tex';

const PORTRAIT_NAME: Record<UnitId, string> = {
  riot: 'unit.riot.portrait',
  sniper: 'unit.sniper.portrait',
  blockade: 'unit.blockade.portrait',
  gas: 'unit.gas.portrait',
  mounted: 'unit.horse.portrait',
  armed: 'unit.cop.portrait',
  soldier: 'unit.soldier.portrait',
  humvee: 'veh.humvee.icon',
  brigade: 'unit.brigade.portrait',
  tank: 'veh.tank.icon',
  heli: 'veh.heli.icon',
};

/** 32×32 portrait of a unit (null until its art is loaded; vehicles arrive deferred). */
export function unitPortrait(unit: UnitId): PixelBuffer | null {
  return atlasBuffer(PORTRAIT_NAME[unit]);
}

const figures = new Map<string, CardFigure>();

/**
 * Whole-unit deploy-card figure (idle SE frame(s) from the atlas, composed once and cached;
 * null until the unit's art is loaded — vehicles arrive with the deferred art). The figure owns
 * its pixels, so it outlives atlas page swaps (unit art is city-independent).
 */
export function unitCardFigure(unit: UnitId, size: FigureSize): CardFigure | null {
  const key = `${unit}:${size}`;
  const hit = figures.get(key);
  if (hit) return hit;
  const f = composeFigure(CARD_FIGURES[unit][size], (name, frame) => {
    const b = atlasBuffer(name, frame);
    return b ? { buf: b, anchor: art.anim(name).anchor } : null;
  });
  if (f) figures.set(key, f);
  return f;
}

/** Art type of a sim protester id. */
export function protesterArtType(p: ProtesterId): string {
  return p === 'veryViolent' ? 'violent' : p;
}

/**
 * Full-body idle figure (facing SE) of a protester type, trimmed (null if not loaded). Picks
 * the shortest of the first few looks (no raised sign) unless `variant` is given.
 */
export function protesterFigure(p: ProtesterId, variant?: number): PixelBuffer | null {
  const t = protesterArtType(p);
  const tries = variant !== undefined ? [variant, 0] : [0, 1, 2, 3, 4, 5];
  let best: PixelBuffer | null = null;
  for (const v of tries) {
    const b = atlasBuffer(`prot.${t}.v${v}.idle.se`);
    if (!b) continue;
    const f = opaqueOnly(b);
    if (!best || f.h < best.h) best = f;
    if (variant !== undefined) break;
  }
  return best;
}

/** Drop semi-transparent (cast shadow) pixels and trim. */
export function opaqueOnly(src: PixelBuffer): PixelBuffer {
  const out = buf(src.w, src.h);
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] !== 255) continue;
    out.data[i] = src.data[i]!;
    out.data[i + 1] = src.data[i + 1]!;
    out.data[i + 2] = src.data[i + 2]!;
    out.data[i + 3] = 255;
  }
  const b = opaqueBounds(out);
  return b ? crop(out, b.x, b.y, b.w, b.h) : out;
}

/** Integer nearest-neighbour upscale. */
export function scaleUp(src: PixelBuffer, n: number): PixelBuffer {
  if (n <= 1) return src;
  const out = buf(src.w * n, src.h * n);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const s = ((Math.floor(y / n) * src.w + Math.floor(x / n)) * 4) | 0;
      const d = (y * out.w + x) * 4;
      out.data[d] = src.data[s]!;
      out.data[d + 1] = src.data[s + 1]!;
      out.data[d + 2] = src.data[s + 2]!;
      out.data[d + 3] = src.data[s + 3]!;
    }
  }
  return out;
}

/** Greyscale remap (unaffordable): luminance → gray ramp. */
export function greyed(src: PixelBuffer): PixelBuffer {
  const ramp = ['ink', 'gray1', 'gray2', 'gray3', 'gray4', 'gray5', 'gray6'].map((r) => col(r));
  const out = buf(src.w, src.h);
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] !== 255) continue;
    const l = 0.3 * src.data[i]! + 0.59 * src.data[i + 1]! + 0.11 * src.data[i + 2]!;
    const c = ramp[Math.min(6, Math.floor((l / 256) * 7.5))]!;
    out.data[i] = c >>> 24;
    out.data[i + 1] = (c >>> 16) & 255;
    out.data[i + 2] = (c >>> 8) & 255;
    out.data[i + 3] = 255;
  }
  return out;
}

/** Flat silhouette with a faint top rim (locked cards, unknown threats). */
export function silhouette(src: PixelBuffer, fill = 'ink', rim = 'gray2'): PixelBuffer {
  const out = buf(src.w, src.h);
  const c = col(fill);
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] !== 255) continue;
    out.data[i] = c >>> 24;
    out.data[i + 1] = (c >>> 16) & 255;
    out.data[i + 2] = (c >>> 8) & 255;
    out.data[i + 3] = 255;
  }
  for (let y = 1; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4 + 3;
      if (out.data[i] && !out.data[((y - 1) * src.w + x) * 4 + 3]) px(out, x, y, rim);
    }
  }
  return out;
}

/** Blit `src` into `dst` clipped to a rect (opaque pixels only). */
export function blitClipped(
  dst: PixelBuffer,
  src: PixelBuffer,
  dx: number,
  dy: number,
  clip: { x: number; y: number; w: number; h: number },
): void {
  for (let y = 0; y < src.h; y++) {
    const ty = dy + y;
    if (ty < clip.y || ty >= clip.y + clip.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x;
      if (tx < clip.x || tx >= clip.x + clip.w) continue;
      const i = (y * src.w + x) * 4;
      if (src.data[i + 3] !== 255) continue;
      dst.data.set(src.data.subarray(i, i + 4), (ty * dst.w + tx) * 4);
    }
  }
}

export const COMPACT_W = 30;
export const COMPACT_H = 38;

/**
 * Compact deploy card for phones (30×38, card body 26×34 at (2,2)): picture window showing the
 * whole unit (`figure`, see art/uikit/cardFigures.ts) or, legacy, a portrait's head and
 * shoulders; cost strip with the tiny Hate face; same four states as the kit card.
 */
export function compactCard(spec: {
  portrait?: PixelBuffer | null;
  /** Whole-unit figure; `null` = empty backdrop while the art loads. */
  figure?: CardFigure | null;
  cost: number;
  state: CardState;
  level?: number;
}): PixelBuffer {
  const b = buf(COMPACT_W, COMPACT_H);
  const st = spec.state;
  const lift = st === 'selected' ? -2 : 0;
  const x0 = 2;
  const y0 = 2 + lift;
  const W = 26;
  const H = 34;
  const locked = st === 'locked';
  const dim = locked || st === 'unaffordable';
  const face = locked ? 'stone2' : dim ? 'stone3' : 'stone4';
  const hi = locked ? 'stone3' : dim ? 'stone4' : 'stone5';
  const lo = locked ? 'stone1' : dim ? 'stone2' : 'stone3';
  if (st === 'selected') {
    rect(b, 0, y0 - 1, COMPACT_W, H + 3, 'hivis1');
    rect(b, 1, y0 - 1, COMPACT_W - 2, H + 2, 'hivis2');
  }
  rect(b, x0, y0 + 1, W, H, 'ochre1');
  rect(b, x0, y0, W - 1, H - 1, face);
  hline(b, x0, y0, W - 1, hi);
  vline(b, x0, y0, H - 1, hi);
  hline(b, x0 + 1, y0 + H - 2, W - 2, lo);
  vline(b, x0 + W - 2, y0 + 1, H - 2, lo);
  hline(b, x0, y0 - 1, W, 'ink');
  hline(b, x0, y0 + H, W, 'ink');
  vline(b, x0 - 1, y0, H, 'ink');
  vline(b, x0 + W, y0, H, 'ink');
  // Picture window: the whole unit (figure, 22×22 interior) or the legacy head crop.
  let slot = { x: x0 + 2, y: y0 + 2, w: 21, h: 21 };
  if (spec.figure !== undefined) {
    // No lit lower lip here: the row goes to the figure (infantry is 22 px tall).
    slot = { x: x0 + 1, y: y0 + 1, w: 23, h: 23 };
    hline(b, slot.x, slot.y, slot.w, 'ink');
    vline(b, slot.x, slot.y, slot.h, 'ink');
    const win = { x: slot.x + 1, y: slot.y + 1, w: slot.w - 1, h: slot.h - 1 };
    drawFigureWindow(b, win, spec.figure, st, 'compact');
  } else {
    rect(b, slot.x, slot.y, slot.w, slot.h, locked ? 'gray1' : 'navy0');
    hline(b, slot.x, slot.y, slot.w, 'ink');
    vline(b, slot.x, slot.y, slot.h, 'ink');
    hline(b, slot.x, slot.y + slot.h, slot.w, hi);
    for (let x = slot.x + 4; x < slot.x + slot.w; x += 6)
      vline(b, x, slot.y + 1, slot.h - 1, locked ? 'gray2' : 'navy1');
  }
  if (spec.figure === undefined && spec.portrait) {
    let p = spec.portrait;
    if (st === 'unaffordable') p = greyed(p);
    if (locked) p = silhouette(p, 'ink', 'gray2');
    const ob = opaqueBounds(p) ?? { x: 0, y: 0, w: p.w, h: p.h };
    // Head at the top of the window, centred on the opaque bounds.
    const px0 = slot.x + Math.floor((slot.w - ob.w) / 2) - ob.x;
    const py0 = slot.y + 1 - ob.y + (ob.h < slot.h ? slot.h - 1 - ob.h : 0);
    blitClipped(b, p, px0, py0, { x: slot.x, y: slot.y + 1, w: slot.w, h: slot.h - 1 });
  }
  const cy = y0 + 24;
  if (locked) {
    const pl = ICONS.padlock();
    stamp(b, pl, slot.x + Math.floor((slot.w - pl.w) / 2), slot.y + 5);
    const t = lockLabel(spec.level, W - 6);
    const m = measureText(FONTS.smallBold, t);
    const bx = x0 + Math.floor((W - m.w) / 2) - 2;
    rect(b, bx, cy, m.w + 4, 10, 'crim1');
    rect(b, bx + 1, cy + 1, m.w + 2, 8, face);
    drawText(b, FONTS.smallBold, t, bx + 2, cy + 2, 'crim1');
  } else {
    // Wide costs (100+) drop the Hate face and centre the number (≥ 1 px between them).
    const cs = costStrip(spec.cost, x0, W, 2, 3);
    if (cs.faceX !== null) stamp(b, ICONS.hateTiny(), cs.faceX, cy + 1);
    drawText(
      b,
      FONTS.smallBold,
      cs.text,
      cs.textX,
      cy + 2,
      st === 'unaffordable' ? 'crim2' : 'ink',
    );
  }
  return b;
}

/** Dashed typewriter rule (dossier dividers). */
export function dashedRule(w: number, colour = 'stone2'): PixelBuffer {
  const b = buf(w, 1);
  for (let x = 0; x < w; x += 3) {
    px(b, x, 0, colour);
    if (x + 1 < w) px(b, x + 1, 0, colour);
  }
  return b;
}

/** Solid 1-colour rectangle buffer. */
export function solid(w: number, h: number, colour: string): PixelBuffer {
  const b = buf(w, h);
  rect(b, 0, 0, w, h, colour);
  return b;
}

/** Small "pill" counter background (leather chip with an ink outline). */
export function chip(w: number, h: number, face = 'earth1', rim = 'earth2'): PixelBuffer {
  const b = buf(w, h);
  rect(b, 1, 0, w - 2, h, 'ink');
  rect(b, 0, 1, w, h - 2, 'ink');
  rect(b, 1, 1, w - 2, h - 2, face);
  hline(b, 2, 1, w - 4, rim);
  return b;
}
