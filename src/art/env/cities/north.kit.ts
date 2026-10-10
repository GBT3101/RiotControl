/**
 * NORTH kit (E3 North): painters shared by the Berlin, Stockholm and Amsterdam styles — street
 * gables with the roof running back from the street (canal houses, Gamla stan), corner turrets,
 * canopy trees (elm, linden), boats moored on the water (houseboats, Spree boats, ferries),
 * bicycles in heaps, and the sprite finishing (coloured outline, blob shadow, crop) for props
 * built outside the shared PropKit. Pure and deterministic; everything is RIOT-64.
 */
import {
  createBuffer,
  getPixel,
  mirrorX,
  setPixel,
  type PixelBuffer,
  type Point,
} from '../../lib/pixels';
import { SHADOW, SHADOW_ALPHA, resolveColor, type RGBA } from '../../palette';
import { GLOW, GLOW_HI } from '../bld/kit';
import type { WallMat } from '../bld/looks';
import { cone, dome, prism } from '../bld/ornaments';
import { C, darker, lighter } from '../color';
import type { PropSprite } from '../props';
import { IsoCanvas, type LightTex, type Tex, type V3 } from '../raster';
import type { OrnamentCtx, SlopeTex } from '../style';
import { Dice, hash, outlineDarker } from '../util';

// ------------------------------------------------------------------------------ sprite kit ---

export interface FinishOpts {
  /** Blob shadow radius (px), 0 = none; centre pushed right by `dx` (sun upper left). */
  shadow?: number;
  dx?: number;
  outline?: boolean;
}

/** Pad, coloured outline, blob shadow under the anchor, crop to the union of all frames. */
export function finishSprite(
  frames: PixelBuffer[],
  anchor: Point,
  o: FinishOpts = {},
  light?: PixelBuffer,
): PropSprite {
  const rx = o.shadow ?? 0;
  const ry = Math.max(1, Math.round(rx / 2));
  const pad = 2 + rx;
  const sc = resolveColor(SHADOW, SHADOW_ALPHA);
  const padded = (f: PixelBuffer): PixelBuffer => {
    const b = createBuffer(f.w + pad * 2, f.h + pad * 2);
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const c = getPixel(f, x, y);
        if (c & 255) setPixel(b, x + pad, y + pad, c);
      }
    return b;
  };
  const out = frames.map((f) => {
    const b = padded(f);
    if (o.outline !== false) outlineDarker(b, 3);
    if (rx > 0) {
      const cx = anchor.x + pad + (o.dx ?? 1);
      const cy = anchor.y + pad;
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
          if ((getPixel(b, cx + x, cy + y) & 255) === 0) setPixel(b, cx + x, cy + y, sc);
        }
    }
    return b;
  });
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (const b of out)
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        if ((getPixel(b, x, y) & 255) === 0) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const ax = anchor.x + pad;
  const ay = anchor.y + pad;
  x0 = Math.min(x0, ax);
  y0 = Math.min(y0, ay);
  x1 = Math.max(x1, ax);
  y1 = Math.max(y1, ay);
  const crop = (b: PixelBuffer): PixelBuffer => {
    const c = createBuffer(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        const p = getPixel(b, x + x0, y + y0);
        if (p & 255) setPixel(c, x, y, p);
      }
    return c;
  };
  return {
    frames: out.map(crop),
    anchor: { x: ax - x0, y: ay - y0 },
    light: light ? crop(padded(light)) : undefined,
  };
}

/** The `.j` twin of an axis prop (mirrored, anchor column kept). */
export function mirrorSprite(p: PropSprite): PropSprite {
  return {
    frames: p.frames.map(mirrorX),
    anchor: { x: p.frames[0]!.w - 1 - p.anchor.x, y: p.anchor.y },
    fps: p.fps,
    light: p.light ? mirrorX(p.light) : undefined,
  };
}

/**
 * Iso-built prop on a canvas of `tiles` × `tiles` around the placement tile (the anchor is the
 * projection of the tile centre at z = 0; `below` px of room for things under the ground,
 * like hulls in the −7 px water).
 */
export function isoSprite(
  height: number,
  draw: (cv: IsoCanvas) => void,
  o: FinishOpts & { below?: number; span?: number } = {},
): PropSprite {
  const span = o.span ?? 1;
  const W = Math.ceil((span * 2 + 1) * 32) + 2;
  const top = height + 2;
  const ox = Math.floor(W / 2);
  // World origin (u = v = 0) such that the tile centre (0.5, 0.5) lands on (ox, top + 8).
  const cv = new IsoCanvas(W, top + 8 + span * 16 + 8 + (o.below ?? 0), ox, top);
  draw(cv);
  return finishSprite([cv.img], { x: ox, y: top + 8 }, o, hasAny(cv.light) ? cv.light : undefined);
}

function hasAny(b: PixelBuffer): boolean {
  for (let i = 3; i < b.data.length; i += 4) if (b.data[i]) return true;
  return false;
}

/** `cv.box` with a single colour per face, lit from the upper left. */
export function solid(
  cv: IsoCanvas,
  a: [number, number, number],
  b: [number, number, number],
  c: RGBA,
  top?: RGBA,
  bias = 0,
): void {
  cv.box(
    a[0],
    a[1],
    a[2],
    b[0],
    b[1],
    b[2],
    { top: () => top ?? lighter(c), left: () => c, right: () => darker(c) },
    bias,
  );
}

/** `cv.box` whose side faces also write the night-light layer. */
export function litBox(
  cv: IsoCanvas,
  a: [number, number, number],
  b: [number, number, number],
  tex: { top: Tex | null; left: Tex | null; right: Tex | null },
  light: { left?: LightTex; right?: LightTex },
  bias = 0,
): void {
  const [u0, v0, z0] = a;
  const [u1, v1, z1] = b;
  if (tex.left)
    cv.poly(
      [
        { u: u0, v: v1, z: z1 },
        { u: u1, v: v1, z: z1 },
        { u: u1, v: v1, z: z0 },
        { u: u0, v: v1, z: z0 },
      ],
      tex.left,
      light.left,
      bias,
    );
  if (tex.right)
    cv.poly(
      [
        { u: u1, v: v1, z: z1 },
        { u: u1, v: v0, z: z1 },
        { u: u1, v: v0, z: z0 },
        { u: u1, v: v1, z: z0 },
      ],
      tex.right,
      light.right,
      bias,
    );
  if (tex.top)
    cv.poly(
      [
        { u: u0, v: v0, z: z1 },
        { u: u1, v: v0, z: z1 },
        { u: u1, v: v1, z: z1 },
        { u: u0, v: v1, z: z1 },
      ],
      tex.top,
      undefined,
      bias,
    );
}

// ---------------------------------------------------------------------------- wall texture ---

/** The facade painter's wall texture (bld/facade.ts), continued above the cornice. */
export function wallPx(mat: WallMat, base: RGBA, x: number, y: number, s: number): RGBA {
  switch (mat) {
    case 'brick': {
      const course = y >> 1;
      const off = (course & 1) * 2;
      const bx = (x + off) >> 2;
      if ((y & 1) === 1 && ((x + off) & 3) === 0) return darker(base);
      return hash(bx, course, s) % 41 === 0 ? darker(base) : base;
    }
    case 'ashlar': {
      const course = Math.floor(y / 4);
      if (((y % 4) + 4) % 4 === 3) return darker(base);
      if ((((x + (course & 1) * 6) % 12) + 12) % 12 === 0) return darker(base);
      return base;
    }
    case 'smooth':
      return hash(x, y, s) % 50 === 0 ? darker(base) : base;
    case 'stucco':
    default: {
      const h = hash(x >> 1, y, s) % 41;
      if (h === 0) return darker(base);
      if (h === 1 && (x & 1) === 0) return lighter(base);
      return base;
    }
  }
}

// ------------------------------------------------------------------------------- gables -----

export type GableKind = 'step' | 'neck' | 'bell' | 'spout' | 'point' | 'volute';

export interface GableRoof {
  kind: GableKind;
  /** Ridge height of the roof behind, px above the wall top. */
  ridge: number;
  /** Roof slope texture and ridge colour. */
  roof: SlopeTex;
  ridgeCol: RGBA;
  /** Copings, sandstone dressings, bargeboards. */
  trim: RGBA;
  /** Hoist beam with its hook over a loading door (Amsterdam). */
  hoist: boolean;
  /** Loading-door / shutter colour and window frames. */
  door: RGBA;
  frame: RGBA;
  /** Attic opening: loading door (canal house) or round window (oculus). */
  opening: 'door' | 'oculus' | 'pair';
  /** Night: the attic window is lit. */
  lit: boolean;
  /** Chimney stack colour (on the back of the ridge), or null. */
  chimney: RGBA | null;
}

/** Height (px rows above the wall top) of a gable's outline, per face column. */
export function gableHeights(kind: GableKind, L: number, R: number): number[] {
  const hw = L / 2;
  const out: number[] = [];
  for (let x = 0; x < L; x++) {
    const t = Math.abs(x + 0.5 - hw);
    const s = t / hw;
    let p: number;
    switch (kind) {
      case 'step': {
        const tb = L >= 40 ? 4.5 : L >= 24 ? 3.5 : 2.5;
        const sw = L >= 40 ? 5 : L >= 24 ? 4 : 3;
        const top = R + 3;
        const n = Math.max(1, Math.ceil((hw - tb) / sw));
        const sh = (top - 3) / n;
        p = t <= tb ? top : top - Math.ceil((t - tb) / sw) * sh;
        if (t < 1) p += 1; // finial
        break;
      }
      case 'neck': {
        const nh = Math.max(3, Math.round(L * 0.2));
        const top = R + 4;
        if (t <= nh) p = top - (2.5 * t) / nh;
        else {
          const v = (t - nh) / (hw - nh);
          p = 2 + (R * 0.58 - 2) * Math.sqrt(Math.max(0, 1 - v * v));
        }
        break;
      }
      case 'bell': {
        const top = R + 3;
        const f =
          s < 0.18
            ? 1
            : s < 0.72
              ? 1 - 0.5 * ((s - 0.18) / 0.54) ** 1.6
              : 0.5 * (1 - (s - 0.72) / 0.28) ** 1.7;
        p = Math.max(2, top * f) + (s < 0.1 ? 1 : 0);
        break;
      }
      case 'spout': {
        const top = R + 2;
        const sp = L >= 40 ? 4 : 3;
        p = t <= sp ? top + (t < 1 ? 1 : 0) : top - 3 - ((t - sp) * (top - 5)) / (hw - sp);
        break;
      }
      case 'point':
        p = (R + 2) * (1 - t / hw) + 1;
        break;
      case 'volute':
      default: {
        const nh = Math.max(3, Math.round(L * 0.21));
        const top = R + 4;
        if (t <= nh) p = top - 2 * (t / nh) ** 2;
        else {
          const v = (t - nh) / (hw - nh);
          p = 2 + (R * 0.66 - 2) * (0.5 + 0.5 * Math.cos(v * Math.PI));
        }
        break;
      }
    }
    out.push(Math.max(1, Math.round(p)));
  }
  return out;
}

/** Tallest point of a gable (px above the wall top) — for the sprite headroom. */
export function gableTop(kind: GableKind, L: number, R: number): number {
  return Math.max(...gableHeights(kind, L, R)) + 2;
}

/**
 * Street gable on a pitched roof: the ridge runs back from the street face, which rises into the
 * gable (drawn over the hipped roof the building painter laid first; the gable roof is steeper,
 * so it covers it). Openings, dressings, hoist beam and a chimney on the back of the ridge.
 */
export function paintGable(o: OrnamentCtx, g: GableRoof): void {
  const side = o.street === 'right' ? 'right' : 'left';
  const left = side === 'left';
  const { cv, w, d, H, look } = o;
  const L = left ? w : d;
  const D = left ? d : w;
  const Lpx = L * 16;
  const R = g.ridge;
  const P3 = (a: number, b: number, z: number): V3 =>
    left ? { u: a, v: d - b, z } : { u: w - b, v: d - a, z };
  const aOf = (u: number, v: number): number => (left ? u : d - v);
  const shade = (c: RGBA): RGBA => (left ? c : darker(c));
  const ov = 0.06;
  const Z = H + R;
  const mid = L / 2;
  // Roof slopes (eave → ridge), back past the rear wall.
  const lightA = -1;
  const lightB = left ? 0 : 1;
  cv.poly(
    [P3(L + ov, 0, H), P3(L + ov, D + ov, H), P3(mid, D + ov, Z), P3(mid, 0, Z)],
    (u, v, z) => {
      const b = left ? d - v : w - u;
      return g.roof(b * 16, z - H, lightA);
    },
  );
  cv.poly(
    [P3(-ov, 0, H), P3(-ov, D + ov, H), P3(mid, D + ov, Z), P3(mid, 0, Z)],
    (u, v, z) => {
      const b = left ? d - v : w - u;
      return g.roof(b * 16, z - H, lightB);
    },
  );
  // Ridge cap.
  for (let k = 0; k <= Math.ceil((D + ov) * 32); k++) {
    const p = P3(mid, k / 32, Z);
    cv.dot(p, lighter(g.ridgeCol), 0.6);
    cv.dot({ ...p, z: Z - 1 }, g.ridgeCol, 0.6);
  }
  // Chimney stack on the back of the ridge.
  if (g.chimney !== null) {
    const a0 = mid + (o.dice.chance(0.5) ? 0.12 : -0.3);
    const b0 = D - 0.5;
    const p0 = P3(a0, b0, 0);
    const p1 = P3(a0 + 0.18, b0 + 0.18, 0);
    const ch = g.chimney;
    cv.box(
      Math.min(p0.u, p1.u),
      Math.min(p0.v, p1.v),
      Z - 8,
      Math.max(p0.u, p1.u),
      Math.max(p0.v, p1.v),
      Z + 4,
      {
        top: () => C('ink'),
        left: (_u, _v, z) => (z > Z + 2.5 ? lighter(ch) : ch),
        right: (_u, _v, z) => (z > Z + 2.5 ? ch : darker(ch)),
      },
    );
  }

  // The gable wall (overpaints the eaves band of the facade's top three rows).
  const P = gableHeights(g.kind, Lpx, R);
  const top = Math.max(...P);
  const c = Lpx / 2;
  const isTrim = (x: number, h: number): boolean => {
    const p = P[x]!;
    if (h < 0) return false;
    const t = Math.abs(x + 0.5 - c);
    switch (g.kind) {
      case 'step': {
        if (h === p - 1) return true; // coping on every step
        const nb = Math.min(P[x - 1] ?? 0, P[x + 1] ?? 0);
        return h >= nb && t > 1; // the step's exposed end
      }
      case 'neck':
      case 'volute':
      case 'bell': {
        const nb = Math.min(P[x - 1] ?? 0, P[x + 1] ?? 0);
        if (h >= p - 1 || h >= nb - 1) return true; // dressed outline
        const nh = Math.max(3, Math.round(Lpx * (g.kind === 'volute' ? 0.21 : 0.2)));
        // Cornice across the neck where the shoulders end.
        if (g.kind !== 'bell' && t <= nh + 0.5 && h === Math.round(R * 0.58)) return true;
        return false;
      }
      case 'spout':
      case 'point':
      default: {
        const nb = Math.min(P[x - 1] ?? 0, P[x + 1] ?? 0);
        return h >= p - 1 || h >= nb - 1;
      }
    }
  };
  // Openings (face px x across, h rows above the wall top).
  const open = gableOpenings(g, Lpx, P, R);
  const wallAt = (x: number, h: number): RGBA =>
    wallPx(look.mat, look.wall, x, -1 - h, o.seed);
  cv.poly(
    [P3(0, 0, H - 3), P3(L, 0, H - 3), P3(L, 0, H + top + 1), P3(0, 0, H + top + 1)],
    (u, v, z) => {
      const x = Math.floor(aOf(u, v) * 16);
      if (x < 0 || x >= Lpx) return null;
      const h = Math.floor(z - H);
      if (h >= P[x]!) return null;
      if (h < 0) return shade(wallPx(look.mat, look.wall, x, -1 - h, o.seed));
      const op = open(x, h);
      if (op) return shade(op);
      if (isTrim(x, h)) {
        // Light catches the left-hand dressings; the coping's underside casts a line.
        const t = x + 0.5 - c;
        return shade(t < 0 || h === P[x]! - 1 ? g.trim : darker(g.trim));
      }
      if (h === P[x]! - 2 && g.kind === 'step') return shade(darker(wallAt(x, h)));
      return shade(wallAt(x, h));
    },
    (u, v, z) => {
      if (!g.lit) return null;
      const x = Math.floor(aOf(u, v) * 16);
      const h = Math.floor(z - H);
      const op = open(x, h);
      return op && op === C('navy1') ? GLOW : op && op === C('zinc2') ? GLOW_HI : null;
    },
    1.5,
  );
  // Hoist beam with its hook, sticking out over the loading door.
  if (g.hoist) {
    const hz = H + Math.min(top - 4, Math.round(R * 0.82));
    const a0 = c / 16 - 1 / 16;
    const a1 = c / 16 + 1 / 16;
    const p0 = P3(a0, -0.2, hz);
    const p1 = P3(a1, 0, hz + 2);
    const beam = C('earth1');
    cv.box(
      Math.min(p0.u, p1.u),
      Math.min(p0.v, p1.v),
      hz,
      Math.max(p0.u, p1.u),
      Math.max(p0.v, p1.v),
      hz + 2,
      { top: () => C('earth2'), left: () => beam, right: () => darker(beam) },
      2,
    );
    const tip = P3(c / 16, -0.19, hz);
    cv.dot({ ...tip, z: hz - 1 }, C('gray2'), 3);
    cv.dot({ ...tip, z: hz - 2 }, C('gray3'), 3);
  }
}

/** Openings of a gable: colour of pixel (x, h) or null (wall). */
function gableOpenings(
  g: GableRoof,
  L: number,
  P: number[],
  R: number,
): (x: number, h: number) => RGBA | null {
  const c = L / 2;
  const glass = C('navy1');
  const glassHi = C('zinc2');
  const frame = g.frame;
  const holes: Array<(x: number, h: number) => RGBA | null> = [];
  const rect = (x0: number, h0: number, wd: number, ht: number, door: boolean): void => {
    holes.push((x, h) => {
      const dx = x - x0;
      const dh = h - h0;
      if (dx < 0 || dx >= wd || dh < 0 || dh >= ht) return null;
      if (dx === 0 || dx === wd - 1 || dh === 0 || dh === ht - 1) return frame;
      if (door) return dx === Math.floor(wd / 2) ? darker(g.door) : g.door;
      return dx === 1 && dh === ht - 2 ? glassHi : glass;
    });
  };
  const mx = Math.round(c);
  if (g.opening === 'door') {
    const wd = L >= 40 ? 6 : 4;
    const ht = L >= 40 ? 7 : 6;
    const h0 = Math.max(2, Math.min(Math.round(R * 0.82) - ht - 1, Math.round(R * 0.4)));
    rect(mx - wd / 2, h0, wd, ht, true);
    // Small window above the door on tall gables.
    if (P[mx]! - (h0 + ht) > 9) rect(mx - 2, h0 + ht + 4, 4, 4, false);
    if (L >= 40) {
      rect(mx - 15, 2, 4, 5, false);
      rect(mx + 11, 2, 4, 5, false);
    } else if (L >= 32) {
      rect(mx - 10, 2, 3, 4, false);
      rect(mx + 7, 2, 3, 4, false);
    }
  } else if (g.opening === 'oculus') {
    const h0 = Math.round(R * 0.45);
    holes.push((x, h) => {
      const dx = x + 0.5 - c;
      const dh = h + 0.5 - (h0 + 2);
      const r2 = dx * dx + dh * dh;
      if (r2 <= 2.2) return dx < 0 && dh > 0 ? glassHi : glass;
      if (r2 <= 5.3) return frame;
      return null;
    });
  } else {
    const h0 = Math.round(R * 0.35);
    rect(mx - 5, h0, 4, 6, false);
    rect(mx + 1, h0, 4, 6, false);
  }
  return (x, h) => {
    if (h >= P[x]! - 2) return null;
    for (const f of holes) {
      const r = f(x, h);
      if (r) return r;
    }
    return null;
  };
}

// ------------------------------------------------------------------------- corner turret ----

export interface TurretSpec {
  /** Drum colour, its trim, and the dome ramp (dark → light). */
  wall: RGBA;
  trim: RGBA;
  dome: readonly RGBA[];
  /** Spire / finial colour. */
  finial: RGBA;
  /** Drum height above the wall top (px) and dome height. */
  drum: number;
  domeH: number;
  /** Onion bulge (0 = round). */
  onion: number;
  /** Tall spire on top (Stockholm) instead of a knob. */
  spire: boolean;
  lit: boolean;
}

/**
 * Corner turret on the near corner (u = w, v = d): an octagonal drum with windows rising from
 * the top storey above the roof line, crowned by a dome and a finial.
 */
export function cornerTurret(o: OrnamentCtx, t: TurretSpec): void {
  const { cv, w, d, H } = o;
  const r = 0.36;
  const cu = w - r + 0.04;
  const cvv = d - r + 0.04;
  const z0 = H - 13;
  const z1 = H + t.drum;
  prism(cv, {
    cu,
    cv: cvv,
    z0,
    z1,
    r,
    n: 8,
    bias: 1.2,
    tex: (s, x, y) => {
      const base = s > 0.62 ? lighter(t.wall) : s > 0.4 ? t.wall : darker(t.wall);
      const tr = s > 0.5 ? t.trim : darker(t.trim);
      if (y < 0) return tr;
      if (y <= 1) return y === 0 ? lighter(tr) : tr; // cornice
      if (y === z1 - H + 1 || y === z1 - H + 2) return tr; // band at the main cornice
      const row = (y - 3) % 10;
      if (row >= 1 && row <= 6 && x >= 1 && x <= 3 && y < z1 - z0 - 2) {
        if (x === 1 && row === 1) return C('zinc2');
        return t.lit && (y + x) % 7 === 0 ? C('ochre3') : C('navy1');
      }
      return base;
    },
  });
  dome(cv, {
    cu,
    cv: cvv,
    z0: z1,
    r: r + 0.03,
    h: t.domeH,
    ramp: t.dome,
    ribs: 8,
    rib: t.dome[t.dome.length - 1],
    onion: t.onion,
    bias: 1.2,
  });
  const apex = z1 + t.domeH;
  if (t.spire) {
    cone(cv, { cu, cv: cvv, z0: apex - 1, r: 0.07, h: 9, n: 4, ramp: t.dome, bias: 1.3 });
    cv.dot({ u: cu, v: cvv, z: apex + 9 }, t.finial, 1.5);
  } else {
    cv.pole({ u: cu, v: cvv, z: apex }, 3, t.finial, 1.5);
    cv.dot({ u: cu, v: cvv, z: apex + 3 }, lighter(t.finial), 1.5);
  }
}

// -------------------------------------------------------------------------------- trees -----

interface Clump {
  x: number;
  y: number;
  rx: number;
  ry: number;
  tone: number;
}

function canopy(b: PixelBuffer, clumps: Clump[], ramp: RGBA[], seed: number, gap = 0): void {
  const order = [...clumps].sort((a, c) => a.y - c.y || c.x - a.x);
  for (const [ci, cl] of order.entries()) {
    const ph = (hash(seed, ci) % 628) / 100;
    for (let y = Math.floor(cl.y - cl.ry - 2); y <= cl.y + cl.ry + 2; y++)
      for (let x = Math.floor(cl.x - cl.rx - 2); x <= cl.x + cl.rx + 2; x++) {
        const dx = (x + 0.5 - cl.x) / cl.rx;
        const dy = (y + 0.5 - cl.y) / cl.ry;
        const r2 = dx * dx + dy * dy;
        const ang = Math.atan2(dy, dx);
        const edge = 1 + 0.14 * Math.sin(ang * 5 + ph) + 0.08 * Math.sin(ang * 11 + ph * 2);
        if (r2 > edge * edge) continue;
        // Airy canopies: a few see-through holes near the rim.
        if (gap > 0 && r2 > 0.45 && hash(x, y, seed + ci) % 100 < gap) continue;
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
        let L = -0.55 * dx - 0.7 * dy + 0.6 * nz + cl.tone * 0.22;
        const row = Math.floor(y / 3);
        const lx = (x + (row & 1) * 2 + (seed & 3)) & 3;
        const ly = y - row * 3;
        if (ly === 0 && (lx === 1 || lx === 2)) L += 0.18;
        else if (ly === 2 && (lx === 2 || lx === 3)) L -= 0.22;
        const idx = L > 0.75 ? 5 : L > 0.42 ? 4 : L > 0.12 ? 3 : L > -0.22 ? 2 : 1;
        setPixel(b, x, y, ramp[idx]!);
      }
  }
}

function line(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++)
    setPixel(b, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
}

/**
 * Elm (Amsterdam canals): a tall grey trunk forking into a vase of limbs, a broad airy crown
 * that is wider at the top. Linden (Berlin, Unter den Linden): a dense, pointed oval crown.
 */
export function treeSprite(kind: 'elm' | 'linden', seed: number): PropSprite {
  const d = new Dice(hash(seed, kind.length * 31));
  const b = createBuffer(48, 64);
  const cx = 24;
  const base = 62;
  const j = (n: number): number => (d.next() - 0.5) * n;
  if (kind === 'elm') {
    const bark = [C('gray1'), C('gray2'), C('gray3'), C('stone1')];
    for (let y = base - 20; y <= base; y++) {
      const wd = y > base - 2 ? 4 : 3;
      for (let k = 0; k < wd; k++)
        setPixel(b, cx - 1 + k - (y > base - 2 ? 1 : 0), y, k === 0 ? bark[2]! : k === wd - 1 ? bark[0]! : bark[1]!);
      if (hash(y, 3, seed) % 4 === 0) setPixel(b, cx, y, bark[3]!);
    }
    // Limbs fanning out (the elm's vase).
    for (const [dx, dy] of [
      [-9, -14],
      [-4, -18],
      [4, -17],
      [10, -13],
    ] as const) {
      line(b, cx, base - 19, cx + dx + Math.round(j(2)), base - 19 + dy, bark[1]!);
      line(b, cx + 1, base - 19, cx + dx + 1 + Math.round(j(2)), base - 19 + dy, bark[0]!);
    }
    const ramp = ['ink', 'green0', 'green1', 'green2', 'green3', 'green4'].map((n) => C(n));
    const top = base - 52;
    canopy(
      b,
      [
        { x: cx - 10 + j(2), y: top + 10, rx: 9, ry: 6, tone: 0.4 },
        { x: cx + j(2), y: top + 7, rx: 9, ry: 6, tone: 0.6 },
        { x: cx + 11 + j(2), y: top + 10, rx: 8, ry: 6, tone: -0.2 },
        { x: cx - 15 + j(2), y: top + 17, rx: 6, ry: 5, tone: 0.1 },
        { x: cx + 15 + j(2), y: top + 17, rx: 6, ry: 5, tone: -0.5 },
        { x: cx - 5 + j(2), y: top + 16, rx: 8, ry: 5, tone: -0.1 },
        { x: cx + 6 + j(2), y: top + 17, rx: 7, ry: 5, tone: -0.4 },
        { x: cx + j(3), y: top + 23, rx: 7, ry: 4, tone: -0.5 },
      ],
      ramp,
      seed,
      9,
    );
  } else {
    const bark = [C('earth0'), C('earth1'), C('earth2'), C('stone1')];
    for (let y = base - 16; y <= base; y++) {
      const wd = y > base - 2 ? 4 : 3;
      for (let k = 0; k < wd; k++)
        setPixel(b, cx - 1 + k - (y > base - 2 ? 1 : 0), y, k === 0 ? bark[2]! : k === wd - 1 ? bark[0]! : bark[1]!);
    }
    const ramp = ['green0', 'green1', 'green2', 'green3', 'green4', 'lime'].map((n) => C(n));
    const top = base - 50;
    canopy(
      b,
      [
        { x: cx + j(2), y: top + 6, rx: 6, ry: 6, tone: 0.6 },
        { x: cx - 6 + j(2), y: top + 14, rx: 8, ry: 7, tone: 0.4 },
        { x: cx + 6 + j(2), y: top + 14, rx: 8, ry: 7, tone: -0.2 },
        { x: cx + j(2), y: top + 22, rx: 11, ry: 8, tone: 0 },
        { x: cx - 9 + j(2), y: top + 26, rx: 6, ry: 5, tone: -0.1 },
        { x: cx + 9 + j(2), y: top + 26, rx: 6, ry: 5, tone: -0.6 },
        { x: cx + j(2), y: top + 30, rx: 9, ry: 4, tone: -0.6 },
      ],
      ramp,
      seed,
    );
  }
  return finishSprite([b], { x: cx, y: base }, { shadow: 8, dx: 3 });
}

// -------------------------------------------------------------------------------- boats -----

export interface BoatSpec {
  /** Hull length / beam (tiles), hull colour, waterline colour, deck height (px above water). */
  len: number;
  beam: number;
  hull: RGBA;
  /** Cabin / superstructure blocks: [from, to] along the hull (0..1), height px, colour, windows. */
  cabins: ReadonlyArray<{
    a: number;
    b: number;
    h: number;
    col: RGBA;
    roof: RGBA;
    win: 'band' | 'square' | 'none';
    inset?: number;
  }>;
  /** Extra details drawn in boat-local coords: (cv, P) with P(a, s, z) → world point. */
  extras?: (cv: IsoCanvas, P: (a: number, s: number, z: number) => V3) => void;
  lit: number;
  seed: number;
}

/** Water surface in prop space (px): water tiles sit 7 px below the pavement. */
export const WATER_Z = -7;

/** A boat lying along i, centred on the tile; the `.j` twin is its mirror. */
export function boatSprite(s: BoatSpec): PropSprite {
  return isoSprite(
    34,
    (cv) => {
      const hl = s.len / 2;
      const hb = s.beam / 2;
      // Boat-local: a along the hull (−0.5 stern … 0.5 bow), s across (−0.5 … 0.5).
      const P = (a: number, t: number, z: number): V3 => ({
        u: 0.5 + a * s.len,
        v: 0.5 + t * s.beam,
        z,
      });
      const z0 = WATER_Z - 1;
      const deck = WATER_Z + 3;
      // Hull: a box with a pointed bow (two slanted side planes) and a dark waterline.
      const hullTex = (lit: boolean) => (_u: number, _v: number, z: number) => {
        if (z < WATER_Z + 0.6) return C('ink');
        if (z < WATER_Z + 1.4) return darker(s.hull);
        if (z > deck - 1) return lighter(s.hull);
        return lit ? s.hull : darker(s.hull);
      };
      cv.box(0.5 - hl, 0.5 - hb, z0, 0.5 + hl - 0.12, 0.5 + hb, deck, {
        top: (_u, v) => {
          const e = Math.min(v - (0.5 - hb), 0.5 + hb - v);
          return e < 0.04 ? lighter(s.hull) : C('earth4');
        },
        left: hullTex(true),
        right: hullTex(false),
      });
      // Bow wedge.
      const bowX = 0.5 + hl;
      cv.poly(
        [
          { u: bowX - 0.12, v: 0.5 + hb, z: deck },
          { u: bowX, v: 0.5, z: deck },
          { u: bowX, v: 0.5, z: z0 },
          { u: bowX - 0.12, v: 0.5 + hb, z: z0 },
        ],
        hullTex(true),
      );
      cv.poly(
        [
          { u: bowX - 0.12, v: 0.5 - hb, z: deck },
          { u: bowX, v: 0.5, z: deck },
          { u: bowX, v: 0.5, z: z0 },
          { u: bowX - 0.12, v: 0.5 - hb, z: z0 },
        ],
        hullTex(false),
      );
      cv.poly(
        [
          { u: bowX - 0.12, v: 0.5 + hb, z: deck },
          { u: bowX, v: 0.5, z: deck },
          { u: bowX - 0.12, v: 0.5 - hb, z: deck },
        ],
        () => C('earth4'),
      );
      // Cabins.
      const d = new Dice(s.seed);
      for (const cb of s.cabins) {
        const ins = cb.inset ?? 0.12;
        const u0 = 0.5 + (cb.a - 0.5) * s.len;
        const u1 = 0.5 + (cb.b - 0.5) * s.len;
        const v0 = 0.5 - hb + ins * s.beam;
        const v1 = 0.5 + hb - ins * s.beam;
        const zt = deck + cb.h;
        const winAt = (x: number, y: number): boolean => {
          if (cb.win === 'none') return false;
          if (cb.win === 'band') return y >= 2 && y <= cb.h - 3 && x % 5 !== 0;
          return y >= 2 && y <= Math.min(cb.h - 2, 5) && x % 6 >= 2 && x % 6 <= 4;
        };
        const litWin = new Set<number>();
        for (let k = 0; k < 12; k++) if (d.chance(s.lit)) litWin.add(k);
        const face = (shadeIt: boolean) => (x: number, y: number) => {
          if (y >= cb.h - 1) return shadeIt ? cb.roof : lighter(cb.roof);
          if (winAt(x, y)) return x % 6 === 2 && y === 2 ? C('zinc2') : C('navy1');
          const c = cb.col;
          return shadeIt ? darker(c) : c;
        };
        const L = face(false);
        const Rr = face(true);
        const lit = (x: number, y: number): RGBA | null =>
          winAt(x, y) && litWin.has(Math.floor(x / 6) % 12) ? (y === 2 ? GLOW_HI : GLOW) : null;
        litBox(
          cv,
          [u0, v0, deck],
          [u1, v1, zt],
          {
            top: (u, v) => {
              const e = Math.min(u - u0, u1 - u, v - v0, v1 - v);
              return e < 0.03 ? lighter(cb.roof) : cb.roof;
            },
            left: (u, _v, z) => L(Math.floor((u - u0) * 16), Math.floor(zt - z)),
            right: (_u, v, z) => Rr(Math.floor((v1 - v) * 16), Math.floor(zt - z)),
          },
          {
            left: (u, _v, z) => lit(Math.floor((u - u0) * 16), Math.floor(zt - z)),
            right: (_u, v, z) => lit(Math.floor((v1 - v) * 16), Math.floor(zt - z)),
          },
        );
      }
      s.extras?.(cv, P);
    },
    { shadow: 0, below: 10, span: Math.ceil(s.len / 2) },
  );
}

// -------------------------------------------------------------------------------- bikes -----

/** Bicycle pixel painter (frame along i: rear wheel upper-left, front wheel lower-right). */
export function drawBike(
  b: PixelBuffer,
  ox: number,
  oy: number,
  frame: RGBA,
  o: { basket?: boolean; rack?: boolean; upright?: boolean; crate?: RGBA } = {},
): void {
  const tyre = C('ink');
  const ring = (cx: number, cy: number): void => {
    for (const [x, y] of [
      [-1, -2],
      [0, -2],
      [1, -2],
      [-2, -1],
      [2, -1],
      [-2, 0],
      [2, 0],
      [-2, 1],
      [2, 1],
      [-1, 2],
      [0, 2],
      [1, 2],
    ] as const)
      setPixel(b, ox + cx + x, oy + cy + y, tyre);
    setPixel(b, ox + cx, oy + cy, C('gray4'));
  };
  const ln = (x0: number, y0: number, x1: number, y1: number, c: RGBA): void =>
    line(b, ox + x0, oy + y0, ox + x1, oy + y1, c);
  ring(3, 5);
  ring(11, 8);
  ln(3, 5, 6, 7, frame);
  ln(6, 7, 11, 8, frame);
  ln(5, 3, 6, 7, frame);
  if (o.upright) ln(5, 4, 10, 4, frame);
  else ln(5, 3, 10, 4, frame);
  ln(10, 4, 11, 8, darker(frame));
  setPixel(b, ox + 4, oy + 2, C('ink'));
  setPixel(b, ox + 5, oy + 2, C('earth1'));
  // Handlebars (Dutch: swept back and high).
  if (o.upright) {
    setPixel(b, ox + 10, oy + 2, C('gray3'));
    setPixel(b, ox + 9, oy + 1, C('ink'));
    setPixel(b, ox + 11, oy + 2, C('ink'));
  } else {
    setPixel(b, ox + 10, oy + 3, C('ink'));
    setPixel(b, ox + 11, oy + 3, C('ink'));
  }
  if (o.rack) {
    ln(1, 3, 4, 3, C('gray2'));
    setPixel(b, ox + 2, oy + 4, C('gray2'));
  }
  if (o.basket) {
    setPixel(b, ox + 12, oy + 4, C('earth3'));
    setPixel(b, ox + 13, oy + 4, C('earth4'));
    setPixel(b, ox + 12, oy + 5, C('earth2'));
    setPixel(b, ox + 13, oy + 5, C('earth3'));
  }
  if (o.crate) {
    for (let y = 2; y <= 4; y++)
      for (let x = 11; x <= 13; x++) setPixel(b, ox + x, oy + y, y === 2 ? lighter(o.crate) : o.crate);
  }
}
