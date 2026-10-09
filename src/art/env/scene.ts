/**
 * Tiny offline scene compositor for gallery previews and tests: lays ground tiles, building
 * sprites, props and decals for a small tile map into one buffer with painter's ordering.
 * (The game's real world view is M8; this mirrors its conventions so previews are honest.)
 */
import {
  GROUNDS,
  MARKINGS,
  type BuildingData,
  type CityId,
  type Ground,
  type Marking,
} from '../../maps/contract';
import { createBuffer, getPixel, setPixel, type PixelBuffer, type Point } from '../lib/pixels';
import { darker, lighter } from './color';
import {
  GROUND_ANCHOR,
  groundTile,
  NEIGHBOUR_DIRS,
  NEIGHBOUR_OFFSETS,
  type GroundCtx,
} from './ground';
import { stamp, hash } from './util';

export const GROUND_CHARS: Readonly<Record<string, Ground>> = {
  L: 'lot',
  A: 'asphalt',
  S: 'sidewalk',
  C: 'cobble',
  P: 'plaza',
  T: 'steps',
  B: 'bridge',
  G: 'grass',
  R: 'parkPath',
  W: 'water',
  Q: 'quay',
};
export const MARK_CHARS: Readonly<Record<string, Marking>> = {
  '.': 'none',
  '-': 'dashI',
  '/': 'dashJ',
  z: 'zebraI',
  Z: 'zebraJ',
  s: 'stopI',
  S: 'stopJ',
};

export interface SceneSprite {
  img: PixelBuffer;
  anchor: Point;
  /** World position (pixels) of the anchor. */
  x: number;
  y: number;
  /** Painter's key: larger = in front. */
  depth: number;
  /** Night-light layer (same size/anchor as img), drawn undimmed at night. */
  light?: PixelBuffer;
}

export interface Scene {
  city: CityId;
  w: number;
  h: number;
  ground: Uint8Array;
  marking: Uint8Array;
  sprites: SceneSprite[];
  /** Ground-layer overlays (decals, cast shadows) drawn after terrain, before sprites. */
  decals: SceneSprite[];
  /** Ground light pools (world x, y, radius px) around lamps, for the night render. */
  pools: Array<[number, number, number]>;
}

export function sceneFromRows(
  city: CityId,
  rows: readonly string[],
  marks?: readonly string[],
): Scene {
  const h = rows.length;
  const w = rows[0]!.length;
  const ground = new Uint8Array(w * h);
  const marking = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const g = GROUND_CHARS[rows[j]![i]!] ?? 'lot';
      ground[j * w + i] = GROUNDS.indexOf(g);
      const mk = MARK_CHARS[marks?.[j]?.[i] ?? '.'] ?? 'none';
      marking[j * w + i] = MARKINGS.indexOf(mk);
    }
  }
  return { city, w, h, ground, marking, sprites: [], decals: [], pools: [] };
}

export function groundAt(s: Scene, i: number, j: number): Ground {
  const ii = Math.max(0, Math.min(s.w - 1, i));
  const jj = Math.max(0, Math.min(s.h - 1, j));
  return GROUNDS[s.ground[jj * s.w + ii]!]!;
}

export function sceneCtx(s: Scene, i: number, j: number, frame = 0): GroundCtx {
  const g = groundAt(s, i, j);
  const ctx = {
    city: s.city,
    ground: g,
    marking: MARKINGS[s.marking[j * s.w + i]!]!,
    seed: hash(i, j, 0x5eed),
    frame,
  } as GroundCtx;
  for (const d of NEIGHBOUR_DIRS) {
    const [di, dj] = NEIGHBOUR_OFFSETS[d];
    const ii = i + di;
    const jj = j + dj;
    ctx[d] = ii < 0 || jj < 0 || ii >= s.w || jj >= s.h ? g : groundAt(s, ii, jj);
  }
  return ctx;
}

/** World → buffer offset for a scene (tile (0,0) top vertex at world (0,0)). */
export function sceneOrigin(s: Scene, top = 96): Point {
  return { x: s.h * 16, y: top };
}

export function addSprite(
  s: Scene,
  img: PixelBuffer,
  anchor: Point,
  wx: number,
  wy: number,
  depth?: number,
): void {
  s.sprites.push({ img, anchor, x: wx, y: wy, depth: depth ?? wy * 4096 + wx });
}

export function addDecal(s: Scene, img: PixelBuffer, anchor: Point, wx: number, wy: number): void {
  s.decals.push({ img, anchor, x: wx, y: wy, depth: 0 });
}

/** World pixel of tile-space point (u, v). */
export function tileWorld(u: number, v: number): Point {
  return { x: Math.round((u - v) * 16), y: Math.round((u + v) * 8) };
}

/**
 * Render terrain, decals and depth-sorted sprites. `night` dims everything two palette steps
 * (hue-shifted toward violet) and draws light layers + lamp light pools undimmed — a palette-safe
 * stand-in for the game's GPU colour grade.
 */
export function renderScene(s: Scene, top = 96, bottom = 8, night = false): PixelBuffer {
  const o = sceneOrigin(s, top);
  const out = createBuffer((s.w + s.h) * 16, (s.w + s.h) * 8 + top + bottom);
  // Terrain back to front (i + j ascending).
  for (let k = 0; k < s.w + s.h - 1; k++) {
    for (let i = 0; i < s.w; i++) {
      const j = k - i;
      if (j < 0 || j >= s.h) continue;
      const img = groundTile(sceneCtx(s, i, j));
      stamp(out, img, o.x + (i - j) * 16 - GROUND_ANCHOR.x, o.y + (i + j) * 8 - GROUND_ANCHOR.y);
    }
  }
  for (const d of s.decals) blitShadowAware(out, d, o);
  if (night) {
    dimAll(out);
    for (const [x, y, r] of s.pools) pool(out, o.x + x, o.y + y, r);
  }
  const sorted = [...s.sprites].sort((a, b) => a.depth - b.depth);
  for (const sp of sorted) {
    if (night) {
      const dim = { ...sp, img: dimmed(sp.img) };
      blitShadowAware(out, dim, o);
      if (sp.light) blitShadowAware(out, { ...sp, img: sp.light }, o);
    } else blitShadowAware(out, sp, o);
  }
  return out;
}

function dimAll(b: PixelBuffer): void {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = getPixel(b, x, y);
      if ((c & 255) === 255) setPixel(b, x, y, darker(c, 2));
    }
  }
}

const dimCache = new WeakMap<PixelBuffer, PixelBuffer>();
function dimmed(src: PixelBuffer): PixelBuffer {
  let d = dimCache.get(src);
  if (!d) {
    d = createBuffer(src.w, src.h);
    d.data.set(src.data);
    dimAll(d);
    dimCache.set(src, d);
  }
  return d;
}

/** Warm light pool on the ground: two lighter rings, iso-squashed. */
function pool(b: PixelBuffer, cx: number, cy: number, r: number): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -2 * r; x <= 2 * r; x++) {
      const d = (x * x) / (4 * r * r) + (y * y) / (r * r);
      if (d > 1) continue;
      const c = getPixel(b, cx + x, cy + y);
      if ((c & 255) !== 255) continue;
      setPixel(b, cx + x, cy + y, lighter(c, d < 0.35 ? 2 : 1));
    }
  }
}

/** Blit; shadow pixels darken what is below by one palette step (the game blends on the GPU). */
function blitShadowAware(out: PixelBuffer, sp: SceneSprite, o: Point): void {
  const dx = o.x + sp.x - sp.anchor.x;
  const dy = o.y + sp.y - sp.anchor.y;
  const src = sp.img;
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= out.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= out.w) continue;
      const si = (y * src.w + x) * 4;
      const a = src.data[si + 3]!;
      if (a === 0) continue;
      const di = (ty * out.w + tx) * 4;
      if (a === 255) {
        out.data[di] = src.data[si]!;
        out.data[di + 1] = src.data[si + 1]!;
        out.data[di + 2] = src.data[si + 2]!;
        out.data[di + 3] = 255;
      } else if (out.data[di + 3] === 255) {
        // Shadow: one palette step darker (keeps the preview palette-pure).
        setPixel(out, tx, ty, darker(getPixel(out, tx, ty)));
      }
    }
  }
}

export type { BuildingData };
