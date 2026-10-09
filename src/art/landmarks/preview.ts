/**
 * Composed previews of the landmarks (docs/progress/m3b-*.png): a Capitol on a patch of
 * placeholder plaza/street diamonds (M3a draws the real terrain) with secondary landmarks,
 * overlays (flags, fire, smoke, clock hands) and a few units for scale. DOM-free; the output is
 * a plain RGBA screenshot (shadows alpha-blended), not an atlas sprite.
 *
 * It doubles as a reference for M8: landmark sprite at its anchor, then its overlays at
 * anchor + (x, y), shadow sprites in the ground/decal layer, step tiles under the stair row.
 */
import { resolveColor } from '../palette';
import { inTileDiamond } from '../../core/iso';
import { createBuffer, type PixelBuffer } from '../lib/pixels';
import type { SpriteDef, SpriteRegistry } from '../lib/registry';
import { LANDMARKS, type CityId, type LandmarkId } from '../../maps/contract';
import { CAPITOL_ART, landmarkOverlays } from './index';

type Ground = 'plaza' | 'asphalt' | 'sidewalk' | 'grass' | 'dash';

export interface PreviewActor {
  sprite: string;
  i: number;
  j: number;
  frame?: number;
}

export interface PreviewSpec {
  city: CityId;
  state: number;
  /** Secondary landmarks placed at tile (i, j) relative to the Capitol's footprint origin. */
  landmarks: Array<{ id: LandmarkId; i: number; j: number }>;
  actors: PreviewActor[];
  /** Animation time in seconds (overlay frames). */
  t?: number;
  /** Tile extent (relative to the capitol origin). */
  area?: { i0: number; i1: number; j0: number; j1: number };
  /** Ground picker; default plaza / road layout. */
  ground?: (i: number, j: number) => Ground;
}

const GROUND_COL: Record<Ground, [string, string]> = {
  plaza: ['stone3', 'stone2'],
  asphalt: ['gray3', 'gray3'],
  dash: ['gray3', 'stone4'],
  sidewalk: ['gray5', 'gray4'],
  grass: ['green3', 'green2'],
};

function rgba(ref: string): [number, number, number] {
  const c = resolveColor(ref);
  return [(c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255];
}

function frameAt(def: SpriteDef, t: number): PixelBuffer {
  if (def.fps <= 0 || def.frames.length === 1) return def.frames[0]!;
  return def.frames[Math.floor(t * def.fps) % def.frames.length]!;
}

/** Compose a preview; returns an opaque RGBA buffer (alpha-blended shadows). */
export function composePreview(reg: SpriteRegistry, spec: PreviewSpec): PixelBuffer {
  const art = CAPITOL_ART[spec.city];
  const area = spec.area ?? { i0: -2, i1: art.w + 5, j0: -2, j1: art.d + 6 };
  const t = spec.t ?? 0;
  // World bounds.
  const wx0 = (area.i0 - area.j1) * 16 - 4;
  const wx1 = (area.i1 - area.j0) * 16 + 4;
  const wy0 = (area.i0 + area.j0) * 8 - art.top - 40;
  const wy1 = (area.i1 + area.j1) * 8 + 8;
  const W = wx1 - wx0;
  const H = wy1 - wy0;
  const out = createBuffer(W, H);
  const bg = rgba('gray1');
  for (let k = 0; k < W * H; k++) {
    out.data[k * 4] = bg[0];
    out.data[k * 4 + 1] = bg[1];
    out.data[k * 4 + 2] = bg[2];
    out.data[k * 4 + 3] = 255;
  }
  const blend = (img: PixelBuffer, x: number, y: number): void => {
    for (let yy = 0; yy < img.h; yy++) {
      const ty = y + yy - wy0;
      if (ty < 0 || ty >= H) continue;
      for (let xx = 0; xx < img.w; xx++) {
        const tx = x + xx - wx0;
        if (tx < 0 || tx >= W) continue;
        const si = (yy * img.w + xx) * 4;
        const a = img.data[si + 3]! / 255;
        if (a === 0) continue;
        const di = (ty * W + tx) * 4;
        for (let c = 0; c < 3; c++)
          out.data[di + c] = out.data[di + c]! * (1 - a) + img.data[si + c]! * a;
      }
    }
  };
  const draw = (name: string, wx: number, wy: number): void => {
    if (!reg.has(name)) return;
    const def = reg.get(name);
    blend(frameAt(def, t), wx - def.anchor.x, wy - def.anchor.y);
  };
  const tileXY = (i: number, j: number): [number, number] => [(i - j) * 16, (i + j) * 8];

  // Footprints occupied by landmarks (their sprites paint their own ground).
  const occupied = (i: number, j: number): boolean => {
    if (i >= 0 && j >= 0 && i < art.w && j < art.d) return true;
    return spec.landmarks.some((l) => {
      const d = LANDMARKS[l.id];
      return i >= l.i && j >= l.j && i < l.i + d.w && j < l.j + d.d;
    });
  };
  const ground =
    spec.ground ??
    ((i: number, j: number): Ground => {
      if (j >= art.d + 4 && j <= art.d + 5)
        return j === art.d + 4 && i % 2 === 0 ? 'dash' : 'asphalt';
      if (i >= art.w + 3 && i <= art.w + 4) return 'asphalt';
      if (j > art.d + 5 || i > art.w + 4) return 'sidewalk';
      return 'plaza';
    });
  // 1. Ground diamonds.
  for (let j = area.j0; j < area.j1; j++) {
    for (let i = area.i0; i < area.i1; i++) {
      if (occupied(i, j)) continue;
      const [x, y] = tileXY(i, j);
      if (j === art.d && i >= 0 && i < art.w) {
        draw(`lm.capitol.${spec.city}.steptile`, x, y);
        continue;
      }
      const g = ground(i, j);
      const [a, b] = GROUND_COL[g];
      const ca = rgba(a);
      const cb = rgba(b);
      const tile = createBuffer(32, 16);
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 32; px++) {
          if (!inTileDiamond(px, py)) continue;
          const edge = !inTileDiamond(px - 2, py) || !inTileDiamond(px, py - 1);
          const dash = g === 'dash' && Math.abs(py - 8) < 1 && Math.abs(px - 16) < 6;
          const c = dash ? cb : edge && (g === 'plaza' || g === 'sidewalk') ? cb : ca;
          const k = (py * 32 + px) * 4;
          tile.data[k] = c[0];
          tile.data[k + 1] = c[1];
          tile.data[k + 2] = c[2];
          tile.data[k + 3] = 255;
        }
      }
      blend(tile, x - 16, y);
    }
  }
  // 2. Ground shadows.
  draw(`lm.capitol.${spec.city}.shadow`, 0, 0);
  for (const l of spec.landmarks) draw(`lm.${l.id}.shadow`, ...tileXY(l.i, l.j));
  // 3. Landmarks back-to-front (by footprint centre), each followed by its overlays.
  const items = [
    { name: `lm.capitol.${spec.city}.${spec.state}`, i: 0, j: 0, w: art.w, d: art.d },
    ...spec.landmarks.map((l) => ({
      name: `lm.${l.id}`,
      i: l.i,
      j: l.j,
      w: LANDMARKS[l.id].w,
      d: LANDMARKS[l.id].d,
    })),
  ].sort((a, b) => a.i + a.w / 2 + a.j + a.d / 2 - (b.i + b.w / 2 + b.j + b.d / 2));
  for (const it of items) {
    const [x, y] = tileXY(it.i, it.j);
    draw(it.name, x, y);
    for (const o of landmarkOverlays(it.name)) draw(o.sprite, x + o.x, y + o.y);
  }
  // 4. Actors (all in front of the buildings in these previews), back to front.
  const actors = [...spec.actors].sort((a, b) => a.i + a.j - (b.i + b.j));
  for (const a of actors) {
    const [x, y] = tileXY(a.i, a.j);
    if (!reg.has(a.sprite)) {
      if (a.sprite.startsWith('prot.')) console.warn(`preview: missing ${a.sprite}`);
      continue;
    }
    const def = reg.get(a.sprite);
    const f = def.frames[(a.frame ?? 0) % def.frames.length]!;
    blend(f, Math.round(x) - def.anchor.x, Math.round(y + 8) - def.anchor.y);
  }
  return out;
}

/** Side-by-side strip of the five damage states with overlays at time t. */
export function composeDamageStrip(reg: SpriteRegistry, city: CityId, t = 0): PixelBuffer {
  const art = CAPITOL_ART[city];
  const fw = 16 * (art.w + art.d) + 24;
  const fh = art.top + 8 * (art.w + art.d) + 8;
  const out = createBuffer(fw * 5, fh);
  const bg = rgba('gray2');
  for (let k = 0; k < out.w * out.h; k++) {
    out.data[k * 4] = bg[0];
    out.data[k * 4 + 1] = bg[1];
    out.data[k * 4 + 2] = bg[2];
    out.data[k * 4 + 3] = 255;
  }
  for (let s = 0; s < 5; s++) {
    const sub = composePreview(reg, {
      city,
      state: s,
      landmarks: [],
      actors: [],
      t,
      area: { i0: 0, i1: art.w, j0: 0, j1: art.d + 1 },
    });
    // Centre-crop the sub preview into the strip slot (anchor aligned).
    const offX = Math.floor((sub.w - fw) / 2);
    const offY = sub.h - fh;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const sx = x + offX;
        const sy = y + offY;
        if (sx < 0 || sy < 0 || sx >= sub.w || sy >= sub.h) continue;
        const si = (sy * sub.w + sx) * 4;
        const di = (y * out.w + s * fw + x) * 4;
        for (let c = 0; c < 4; c++) out.data[di + c] = sub.data[si + c]!;
      }
    }
  }
  return out;
}
