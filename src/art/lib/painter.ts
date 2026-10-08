/**
 * Procedural painters for large repetitive iso surfaces (art bible §3.8.3): they place
 * hand-authored patches/modules on the iso lattice and add finishing passes. Never raw noise.
 *
 * - `latticeTile(patch)`: a 16×16 seamless patch → 32×16 tile that tessellates seamlessly
 *   (every tile samples the same lattice-periodic texture, so there are no seams).
 * - `isoBox(...)`: a shaded iso box (top / left / right faces) with modules on the faces.
 * - `boxShadow(...)`: the matching pre-drawn cast shadow (to the lower right).
 */
import { HALF_TH, HALF_TW, TILE_H, TILE_W, inTileDiamond } from '../../core/iso';
import {
  SHADOW,
  SHADOW_ALPHA,
  rampSwatch,
  resolveColor,
  type RampName,
  type RGBA,
} from '../palette';
import { createBuffer, getPixel, setPixel, type PixelBuffer } from './pixels';

/** Sample a 16×16 torus patch on the iso lattice: T(x, y) = A[x mod 16][(y − 8·⌊x/16⌋) mod 16]. */
export function latticeSample(patch: PixelBuffer, x: number, y: number): RGBA {
  const px = ((x % 16) + 16) % 16;
  const py = (((y - 8 * Math.floor(x / 16)) % 16) + 16) % 16;
  return getPixel(patch, px, py);
}

/** Build a seamless 32×16 tile from a 16×16 lattice patch (masked to the tile diamond). */
export function latticeTile(patch: PixelBuffer): PixelBuffer {
  if (patch.w !== 16 || patch.h !== 16) throw new Error('latticeTile: patch must be 16×16');
  const out = createBuffer(TILE_W, TILE_H);
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      if (inTileDiamond(x, y)) setPixel(out, x, y, latticeSample(patch, x, y));
    }
  }
  return out;
}

/** Fill a 32×16 tile from a function of tile-local pixel coords (masked to the diamond). */
export function diamondTile(fn: (x: number, y: number) => RGBA | null): PixelBuffer {
  const out = createBuffer(TILE_W, TILE_H);
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      if (!inTileDiamond(x, y)) continue;
      const c = fn(x, y);
      if (c !== null) setPixel(out, x, y, c);
    }
  }
  return out;
}

/** Edges of the tile diamond, named by compass side: nw (top-left), ne, se, sw. */
export type DiamondEdge = 'nw' | 'ne' | 'se' | 'sw';

/** Is (x, y) inside the diamond and within `thickness` px (horizontally) of the given edge? */
export function onDiamondEdge(x: number, y: number, edge: DiamondEdge, thickness = 2): boolean {
  if (!inTileDiamond(x, y)) return false;
  const top = y < HALF_TH;
  const left = x < HALF_TW;
  switch (edge) {
    case 'nw':
      return top && left && !inTileDiamond(x - thickness, y);
    case 'sw':
      return !top && left && !inTileDiamond(x - thickness, y);
    case 'ne':
      return top && !left && !inTileDiamond(x + thickness, y);
    case 'se':
      return !top && !left && !inTileDiamond(x + thickness, y);
  }
}

/** Copy opaque pixels of `stamp` onto `dst` at (dx, dy), but only inside the tile diamond. */
export function stampInDiamond(dst: PixelBuffer, stamp: PixelBuffer, dx: number, dy: number): void {
  for (let y = 0; y < stamp.h; y++) {
    for (let x = 0; x < stamp.w; x++) {
      const c = getPixel(stamp, x, y);
      if ((c & 255) === 0) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (inTileDiamond(tx, ty)) setPixel(dst, tx, ty, c);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Iso boxes (stub buildings, crates, kiosks …)
// ---------------------------------------------------------------------------------------------

export type BoxFace = 'top' | 'left' | 'right';

export interface BoxModule {
  /** Pixels of the module (drawn sheared along the face's 2:1 slope). */
  img: PixelBuffer;
  face: 'left' | 'right';
  /** Column along the face from the face's outer vertex (left face: from the left vertex). */
  col: number;
  /** Rows below the face's top edge. */
  row: number;
}

/** Roof fill: a flat ramp, a 16×16 lattice patch, or a painter function of sprite pixels. */
export type RoofFill = RampName | PixelBuffer | ((x: number, y: number) => RGBA);

export interface IsoBoxSpec {
  /** Square footprint size in tiles. */
  n: number;
  /** Wall height in world pixels (storeys × STOREY_H + parapet). */
  height: number;
  /** Wall material ramp (≥ 5 steps): left face mid tones, right face dark tones. */
  wall: RampName;
  roof: RoofFill;
  /** Ramp for the roof parapet rim (default: wall ramp). */
  rim?: RampName;
  /** Draw a string-course band every `storeyH` px below the cornice (0 = none). */
  storeyH?: number;
  /** Rows of cornice before the first storey (default 3). */
  cornice?: number;
  modules?: readonly BoxModule[];
}

export interface IsoBoxResult {
  img: PixelBuffer;
  /** Pixel-index anchor: the footprint's top (north) vertex on the ground. */
  anchor: { x: number; y: number };
}

/** Which face (if any) a pixel of an n-tile, h-high box sprite belongs to. */
export function boxFaceAt(n: number, h: number, px: number, py: number): BoxFace | null {
  const fx = px + 0.5;
  const fy = py + 0.5;
  const hw = HALF_TW * n;
  const hh = HALF_TH * n;
  // Top face: diamond centred at (hw, hh).
  if (Math.abs(fx - hw) / hw + Math.abs(fy - hh) / hh < 1) return 'top';
  if (fx < hw) {
    const edge = hh + fx / 2; // lower-left edge of the top diamond
    if (fy > edge && fy < edge + h && fx > 0) return 'left';
  } else {
    const edge = 2 * hh - (fx - hw) / 2; // lower-right edge of the top diamond
    if (fy > edge && fy < edge + h && fx < 2 * hw) return 'right';
  }
  return null;
}

/** Row of pixel (px, py) below the top edge of its wall face (0 = first wall row). */
function faceRow(n: number, px: number, py: number): number {
  const fx = px + 0.5;
  const hw = HALF_TW * n;
  const hh = HALF_TH * n;
  const edge = fx < hw ? hh + fx / 2 : 2 * hh - (fx - hw) / 2;
  return Math.floor(py + 0.5 - edge);
}

/** Paint a shaded iso box. Light from the upper-left: top lightest, left mid, right darkest. */
export function isoBox(spec: IsoBoxSpec): IsoBoxResult {
  const { n, height: h, wall } = spec;
  const w = TILE_W * n;
  const H = TILE_H * n + h;
  const img = createBuffer(w, H);
  const c = (ramp: RampName, step: number): RGBA => resolveColor(rampSwatch(ramp, step));
  const hw = HALF_TW * n;
  const hh = HALF_TH * n;
  const cornice = spec.cornice ?? 3;
  const storeyH = spec.storeyH ?? 0;
  const face = (px: number, py: number): BoxFace | null => boxFaceAt(n, h, px, py);

  // Walls: left = steps 2/3 (lit), right = steps 1/2 (shade); cornice, string courses, AO.
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < w; px++) {
      const f = face(px, py);
      if (f !== 'left' && f !== 'right') continue;
      const row = faceRow(n, px, py);
      const L = f === 'left';
      let col = L ? c(wall, 3) : c(wall, 1);
      if (row === 0)
        col = L ? c(wall, 4) : c(wall, 3); // cornice top catches the sun
      else if (row < cornice - 1) col = L ? c(wall, 3) : c(wall, 2);
      else if (row === cornice - 1)
        col = L ? c(wall, 1) : c(wall, 0); // cornice shadow line
      else if (storeyH > 0 && (row - cornice) % storeyH === storeyH - 1 && row < h - 3) {
        col = L ? c(wall, 2) : c(wall, 0); // string course between storeys
      }
      if (row >= h - 2) col = L ? c(wall, 1) : c(wall, 0); // ground contact AO
      if (L && px === hw - 1 && row > 0 && row < h - 2) col = c(wall, 4); // lit front corner
      setPixel(img, px, py, col);
    }
  }

  // Roof: fill, then a 1-step parapet ring and its inner shadow on the far edges.
  const rim = spec.rim ?? wall;
  const isTop = (px: number, py: number): boolean => face(px, py) === 'top';
  const fill = (px: number, py: number): RGBA => {
    const r = spec.roof;
    if (typeof r === 'string') return c(r, 2);
    if (typeof r === 'function') return r(px, py);
    return latticeSample(r, px, py);
  };
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < w; px++) {
      if (!isTop(px, py)) continue;
      const far = py + 0.5 < hh; // upper (far) half of the roof diamond
      const onRim =
        !isTop(px - 2, py) || !isTop(px + 2, py) || !isTop(px, py - 1) || !isTop(px, py + 1);
      const nearRim =
        !isTop(px - 4, py) || !isTop(px + 4, py) || !isTop(px, py - 2) || !isTop(px, py + 2);
      let col: RGBA;
      if (onRim) col = far ? c(rim, 4) : c(rim, 3);
      else if (nearRim && far)
        col = c(rim, 1); // parapet casts a thin shadow inward
      else col = fill(px, py);
      setPixel(img, px, py, col);
    }
  }

  // Face modules (windows, doors …), sheared along the 2:1 face slope.
  for (const m of spec.modules ?? []) {
    for (let my = 0; my < m.img.h; my++) {
      for (let mx = 0; mx < m.img.w; mx++) {
        const col = getPixel(m.img, mx, my);
        if ((col & 255) === 0) continue;
        const px = m.face === 'left' ? m.col + mx : hw + m.col + mx;
        const fx = px + 0.5;
        const edge = m.face === 'left' ? hh + fx / 2 : 2 * hh - (fx - hw) / 2;
        const py = Math.floor(edge) + m.row + my;
        if (face(px, py) === m.face) setPixel(img, px, py, col);
      }
    }
  }

  return { img, anchor: { x: hw, y: h } };
}

/**
 * Cast shadow of an n-tile, h-high box on flat ground (sun upper-left → shadow lower-right).
 * Same anchor convention as `isoBox` (footprint top vertex). Uses the shadow swatch at
 * SHADOW_ALPHA — the only semi-transparent pixels allowed by the palette rules.
 */
export function boxShadow(n: number, h: number): IsoBoxResult {
  const len = Math.round(h * 0.75); // horizontal reach of the shadow, px
  const w = TILE_W * n + len;
  const H = TILE_H * n + Math.ceil(len / 2);
  const img = createBuffer(w, H);
  const sc = resolveColor(SHADOW, SHADOW_ALPHA);
  const hw = HALF_TW * n;
  const hh = HALF_TH * n;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < w; px++) {
      const fx = px + 0.5;
      const fy = py + 0.5;
      // Swept footprint diamond along direction (2, 1), t ∈ [0, len/2].
      // Inside if some t satisfies |fx − 2t − hw|/hw + |fy − t − hh|/hh < 1 — sample t.
      let inside = false;
      for (let t = 0; t <= len / 2 && !inside; t += 0.5) {
        inside = Math.abs(fx - 2 * t - hw) / hw + Math.abs(fy - t - hh) / hh < 1;
      }
      if (inside) setPixel(img, px, py, sc);
    }
  }
  return { img, anchor: { x: hw, y: 0 } };
}
