/**
 * M5 drawing kit: palette-safe raster primitives for FX and UI art (DOM-free).
 *
 * Everything writes RIOT-64 colour references into a PixelBuffer (no blending, no
 * anti-aliasing). Shapes are rasterised by pixel-centre tests so circles/ellipses come out
 * as clean, symmetric pixel clusters. Higher-level painters:
 *
 * - `paintLobes`  — cartoon cumulus "lobe" clusters (gas, smoke, dust, fireballs) with banded,
 *                    upper-left-lit shading and a coloured exterior outline.
 * - `paintFlames` — flame tongues (fire patches, molotov, burning overlay).
 */
import { resolveColor, type RGBA } from '../palette';
import { createBuffer, getPixel, setPixel, type PixelBuffer } from '../lib/pixels';

/** Colour reference ('ink', 'fire.2', …) → packed RGBA, cached. */
const colourCache = new Map<string, RGBA>();
export function col(ref: string): RGBA {
  let c = colourCache.get(ref);
  if (c === undefined) {
    c = resolveColor(ref);
    colourCache.set(ref, c);
  }
  return c;
}

export function buf(w: number, h: number): PixelBuffer {
  return createBuffer(w, h);
}

export function px(b: PixelBuffer, x: number, y: number, ref: string): void {
  setPixel(b, Math.round(x), Math.round(y), col(ref));
}

export function has(b: PixelBuffer, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return false;
  return b.data[(y * b.w + x) * 4 + 3]! > 0;
}

export function clearPx(b: PixelBuffer, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  b.data.fill(0, (y * b.w + x) * 4, (y * b.w + x) * 4 + 4);
}

export function rect(
  b: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  ref: string,
): void {
  const c = col(ref);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPixel(b, i, j, c);
}

export function hline(b: PixelBuffer, x: number, y: number, w: number, ref: string): void {
  rect(b, x, y, w, 1, ref);
}

export function vline(b: PixelBuffer, x: number, y: number, h: number, ref: string): void {
  rect(b, x, y, 1, h, ref);
}

/** Bresenham line (inclusive). */
export function line(
  b: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ref: string | ((t: number) => string | null),
): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  const n = Math.max(dx, -dy) || 1;
  let err = dx + dy;
  let i = 0;
  for (;;) {
    const r = typeof ref === 'string' ? ref : ref(i / n);
    if (r) setPixel(b, x0, y0, col(r));
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    i++;
  }
}

/* ------------------------------------------------------------------ masks */

/** 1-byte-per-pixel mask (0 = empty). */
export interface Mask {
  readonly w: number;
  readonly h: number;
  readonly m: Uint8Array;
}

export function mask(w: number, h: number): Mask {
  return { w, h, m: new Uint8Array(w * h) };
}

export function mget(k: Mask, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= k.w || y >= k.h) return 0;
  return k.m[y * k.w + x]!;
}

export function mset(k: Mask, x: number, y: number, v = 1): void {
  if (x < 0 || y < 0 || x >= k.w || y >= k.h) return;
  k.m[y * k.w + x] = v;
}

/** Is pixel (x, y) (centre x+.5, y+.5) inside the ellipse at (cx, cy) with radii rx, ry? */
export function inEllipse(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): boolean {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

export function ellipseMask(k: Mask, cx: number, cy: number, rx: number, ry: number, v = 1): void {
  const x0 = Math.max(0, Math.floor(cx - rx - 1));
  const x1 = Math.min(k.w - 1, Math.ceil(cx + rx + 1));
  const y0 = Math.max(0, Math.floor(cy - ry - 1));
  const y1 = Math.min(k.h - 1, Math.ceil(cy + ry + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) if (inEllipse(x, y, cx, cy, rx, ry)) k.m[y * k.w + x] = v;
  }
}

/** Fill an ellipse with a colour (pixel-centre test). */
export function ellipse(
  b: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ref: string,
): void {
  const c = col(ref);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (inEllipse(x, y, cx, cy, rx, ry)) setPixel(b, x, y, c);
    }
  }
}

export function disc(b: PixelBuffer, cx: number, cy: number, r: number, ref: string): void {
  ellipse(b, cx, cy, r, r, ref);
}

/**
 * 1-px ring of an ellipse: pixels inside (rx, ry) whose 4-neighbour lies outside. Clean,
 * gap-free, symmetric. `pred(x, y, angle)` can skip pixels (dashes); angle in radians,
 * 0 = east, increasing clockwise (screen y down).
 */
export function ellipseRing(
  b: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ref: string | ((x: number, y: number, angle: number) => string | null),
  thickness = 1,
): void {
  const x0 = Math.floor(cx - rx - 1);
  const x1 = Math.ceil(cx + rx + 1);
  const y0 = Math.floor(cy - ry - 1);
  const y1 = Math.ceil(cy + ry + 1);
  const irx = rx - thickness;
  const iry = ry - thickness * (ry / rx);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inEllipse(x, y, cx, cy, rx, ry)) continue;
      let edge: boolean;
      if (thickness === 1) {
        edge =
          !inEllipse(x + 1, y, cx, cy, rx, ry) ||
          !inEllipse(x - 1, y, cx, cy, rx, ry) ||
          !inEllipse(x, y + 1, cx, cy, rx, ry) ||
          !inEllipse(x, y - 1, cx, cy, rx, ry);
      } else {
        edge = irx <= 0 || iry <= 0 || !inEllipse(x, y, cx, cy, irx, iry);
      }
      if (!edge) continue;
      const r =
        typeof ref === 'string'
          ? ref
          : ref(x, y, Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx));
      if (r) setPixel(b, x, y, col(r));
    }
  }
}

/** Paint every set pixel of a mask with a colour. */
export function fillMask(b: PixelBuffer, k: Mask, ref: string, ox = 0, oy = 0): void {
  const c = col(ref);
  for (let y = 0; y < k.h; y++) {
    for (let x = 0; x < k.w; x++) if (k.m[y * k.w + x]) setPixel(b, x + ox, y + oy, c);
  }
}

/**
 * Exterior 1-px outline around every opaque pixel, coloured by `ref` (or a function of the
 * side: 'tl' for pixels up/left of the shape, 'br' for down/right). In place.
 */
export function outlineBuf(
  b: PixelBuffer,
  ref: string | ((side: 'tl' | 'br') => string),
  corners = false,
): PixelBuffer {
  const marks: Array<[number, number, string]> = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (has(b, x, y)) continue;
      const r = has(b, x + 1, y) || has(b, x, y + 1);
      const l = has(b, x - 1, y) || has(b, x, y - 1);
      const c =
        corners &&
        (has(b, x + 1, y + 1) ||
          has(b, x - 1, y - 1) ||
          has(b, x + 1, y - 1) ||
          has(b, x - 1, y + 1));
      if (!r && !l && !c) continue;
      const side = r ? 'tl' : 'br';
      marks.push([x, y, typeof ref === 'string' ? ref : ref(side)]);
    }
  }
  for (const [x, y, r] of marks) setPixel(b, x, y, col(r));
  return b;
}

/** Copy buffer. */
export function copy(src: PixelBuffer): PixelBuffer {
  return { w: src.w, h: src.h, data: new Uint8ClampedArray(src.data) };
}

/** Blit only opaque pixels of src (palette-safe; shadow pixels only onto empty). */
export function stamp(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = getPixel(src, x, y);
      const a = c & 255;
      if (a === 0) continue;
      if (a < 255 && has(dst, x + dx, y + dy)) continue;
      setPixel(dst, x + dx, y + dy, c);
    }
  }
}

/** Replace colours (by ref) in place. */
export function swap(b: PixelBuffer, map: Record<string, string>): PixelBuffer {
  const m = new Map<number, RGBA>();
  for (const [f, t] of Object.entries(map)) m.set(col(f) >>> 8, col(t));
  const d = b.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] !== 255) continue;
    const to = m.get((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    if (to === undefined) continue;
    d[i] = to >>> 24;
    d[i + 1] = (to >>> 16) & 255;
    d[i + 2] = (to >>> 8) & 255;
  }
  return b;
}

/** Deterministic tiny PRNG (mulberry32) for authored-but-varied placements. */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ lobes */

export interface Lobe {
  x: number;
  y: number;
  r: number;
  /** Optional vertical squash (ry = r * sy). */
  sy?: number;
}

export interface LobeStyle {
  /**
   * Colour refs, darkest → lightest: [outline, shadow, body, light, spec?].
   * In 'hot' mode the order is [outline, edge, mid, core, whiteHot?].
   */
  ramp: readonly string[];
  mode?: 'lit' | 'hot';
  /** Draw the exterior outline (default true). */
  outline?: boolean;
  /** Outline colour on the upper-left side (default ramp[0]). */
  outlineLit?: string;
  /** Circles (in the same coords) carved out of the union before shading (wisps / holes). */
  holes?: readonly Lobe[];
  /** Extra width of the shadow crescent (0..1 of r, default 0.38). */
  shade?: number;
  /** Per-lobe creases between overlapping lobes (default true). false = softer, merged look. */
  creases?: boolean;
  /** Spec highlight on every big lobe ('all', default) or only the biggest upper one ('one'). */
  spec?: 'all' | 'one';
}

/**
 * Paint a cluster of overlapping round lobes as one cartoon puff. Lobes are painted in the
 * given order (put back/upper lobes first). 'lit': light from the upper-left — each lobe gets a
 * shadow crescent (lower-right), a light crescent (upper-left) and a spec spot. 'hot': radial
 * bands (core lightest) for fireballs.
 */
export function paintLobes(b: PixelBuffer, lobes: readonly Lobe[], style: LobeStyle): void {
  const ramp = style.ramp;
  const k = mask(b.w, b.h);
  for (const l of lobes) ellipseMask(k, l.x, l.y, l.r, l.r * (l.sy ?? 1));
  for (const h of style.holes ?? []) ellipseMask(k, h.x, h.y, h.r, h.r * (h.sy ?? 1), 0);
  const mode = style.mode ?? 'lit';
  const shade = style.shade ?? 0.38;
  const maxR = Math.max(...lobes.map((l) => l.r));
  const dist = mode === 'hot' ? chamfer(k) : new Float32Array(0);
  // Paint lobes.
  const paint = new Int16Array(b.w * b.h).fill(-1);
  let specLobe: Lobe | null = null;
  for (const l of lobes)
    if (!specLobe || l.r - l.y * 0.3 > specLobe.r - specLobe.y * 0.3) specLobe = l;
  for (const l of lobes) {
    const ry = l.r * (l.sy ?? 1);
    for (let y = Math.floor(l.y - ry - 1); y <= Math.ceil(l.y + ry + 1); y++) {
      for (let x = Math.floor(l.x - l.r - 1); x <= Math.ceil(l.x + l.r + 1); x++) {
        if (!mget(k, x, y) || !inEllipse(x, y, l.x, l.y, l.r, ry)) continue;
        let step: number;
        if (mode === 'hot') {
          // Banded by depth from the cluster edge (chamfer distance), core biased up-left.
          const d = dist[y * b.w + x]! + (has2(k, x + 2, y + 2) ? 0 : -1);
          step =
            d <= Math.max(1, maxR * 0.16)
              ? 1
              : d <= maxR * 0.38
                ? 2
                : d <= maxR * 0.62 || ramp.length < 5
                  ? 3
                  : 4;
        } else {
          // Shadow: the cluster's own lower-right rim (union-based) + a thin per-lobe crease.
          const sd = Math.max(1, Math.round(maxR * shade * 0.75));
          const rim = !mget(k, x + sd, y + sd) || !mget(k, x + Math.ceil(sd / 2), y + sd + 1);
          const s = Math.max(0.8, l.r * shade * 0.45);
          const crease = !inEllipse(x, y, l.x - s * 0.7, l.y - s * 0.75 * (l.sy ?? 1), l.r, ry);
          const inShadow = rim || (style.creases !== false && crease);
          const lr = Math.max(1, l.r * 0.42);
          const inLight =
            l.r >= 2 && !inEllipse(x, y, l.x + lr * 0.6, l.y + lr * 0.8 * (l.sy ?? 1), l.r, ry);
          const spec =
            ramp.length > 4 &&
            (style.spec !== 'one' || l === specLobe) &&
            l.r >= Math.max(4, maxR * 0.85) &&
            inEllipse(x, y, l.x - l.r * 0.38, l.y - ry * 0.42, l.r * 0.3, ry * 0.26);
          step = inShadow ? 1 : spec ? 4 : inLight ? 3 : 2;
        }
        paint[y * b.w + x] = step;
      }
    }
  }
  for (let i = 0; i < paint.length; i++) {
    const s = paint[i]!;
    if (s < 0) continue;
    setPixel(b, i % b.w, (i / b.w) | 0, col(ramp[Math.min(s, ramp.length - 1)]!));
  }
  if (style.outline ?? true) {
    const lit = style.outlineLit ?? ramp[0]!;
    outlineMaskInto(b, k, (side) => (side === 'tl' ? lit : ramp[0]!));
  }
}

function has2(k: Mask, x: number, y: number): boolean {
  return mget(k, x, y) > 0;
}

/** Chamfer (3-4) distance from each set pixel to the nearest empty pixel, in px. */
export function chamfer(k: Mask): Float32Array {
  const { w, h } = k;
  const d = new Float32Array(w * h);
  const INF = 1e6;
  for (let i = 0; i < w * h; i++) d[i] = k.m[i] ? INF : 0;
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i]!,
        at(x - 1, y) + 1,
        at(x, y - 1) + 1,
        at(x - 1, y - 1) + 1.4,
        at(x + 1, y - 1) + 1.4,
      );
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i]!,
        at(x + 1, y) + 1,
        at(x, y + 1) + 1,
        at(x + 1, y + 1) + 1.4,
        at(x - 1, y + 1) + 1.4,
      );
    }
  }
  return d;
}

/** Outline the exterior of a mask into b. */
export function outlineMaskInto(b: PixelBuffer, k: Mask, ref: (side: 'tl' | 'br') => string): void {
  for (let y = 0; y < k.h; y++) {
    for (let x = 0; x < k.w; x++) {
      if (mget(k, x, y)) continue;
      const r = mget(k, x + 1, y) || mget(k, x, y + 1);
      const l = mget(k, x - 1, y) || mget(k, x, y - 1);
      if (!r && !l) continue;
      setPixel(b, x, y, col(ref(r ? 'tl' : 'br')));
    }
  }
}

/* ------------------------------------------------------------------ flames */

export interface Tongue {
  /** Base centre x, base y (bottom row). */
  x: number;
  y: number;
  /** Base width and height (px). */
  w: number;
  h: number;
  /** Horizontal tip offset (px), e.g. wind. */
  lean?: number;
  /** Sinuous wobble amplitude (px) and phase (radians). */
  wob?: number;
  ph?: number;
}

/** Fire colour bands, outermost → innermost. */
export const FIRE_BANDS = ['rust1', 'rust3', 'ochre2', 'ochre3', 'ochre4'] as const;

function tongueMask(k: Mask, t: Tongue, scaleW: number, scaleH: number, dy: number): void {
  const h = Math.max(1, t.h * scaleH);
  const w = Math.max(1, t.w * scaleW);
  for (let i = 0; i < h; i++) {
    const f = i / h; // 0 base → 1 tip
    const prof = f < 0.3 ? 1 - (0.3 - f) * 0.5 : Math.pow(1 - (f - 0.3) / 0.7, 0.9);
    const half = (w / 2) * prof;
    const off =
      (t.lean ?? 0) * f * f + (t.wob ?? 0) * Math.sin(f * Math.PI * 1.6 + (t.ph ?? 0)) * f;
    const cy = t.y - i - dy;
    const cx = t.x + off;
    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      if (x + 0.5 >= cx - half && x + 0.5 <= cx + half) mset(k, x, Math.round(cy));
    }
  }
}

/**
 * Paint flame tongues as one merged fire body: colour bands follow the depth from the flame's
 * edge (chamfer distance) and get hotter towards each column's base. `bands` = 2..5 colours.
 */
export function paintFlames(b: PixelBuffer, tongues: readonly Tongue[], bands = 5): void {
  const k = mask(b.w, b.h);
  for (const t of tongues) tongueMask(k, t, 1, 1, 0);
  const d = chamfer(k);
  // Column extents (bottom row and height) for the base heat bias.
  const bottom = new Int32Array(b.w).fill(-1);
  const top = new Int32Array(b.w).fill(b.h);
  for (let x = 0; x < b.w; x++) {
    for (let y = 0; y < b.h; y++) {
      if (!k.m[y * b.w + x]) continue;
      if (y < top[x]!) top[x] = y;
      if (y > bottom[x]!) bottom[x] = y;
    }
  }
  const n = Math.max(2, Math.min(5, bands));
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const i = y * b.w + x;
      if (!k.m[i]) continue;
      const span = Math.max(1, bottom[x]! - top[x]!);
      const v = (bottom[x]! - y) / span; // 0 base → 1 tip
      const level = d[i]! * 0.75 + (1 - v) * 2.4 - v * 1.6;
      const band = level < 1.0 ? 0 : level < 2.2 ? 1 : level < 3.3 ? 2 : level < 4.6 ? 3 : 4;
      setPixel(b, x, y, col(FIRE_BANDS[Math.min(band, n - 1)]!));
    }
  }
}

/** Sample helper: pixel colour at (x,y) as packed RGBA (0 if empty). */
export const pget = getPixel;
