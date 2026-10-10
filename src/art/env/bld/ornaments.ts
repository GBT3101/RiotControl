/**
 * Skyline ornaments for `RoofStyle.ornament` (E3): gables standing on a street face, domes and
 * corner cupolas, prisms (turrets, lanterns), cones and pyramid spires, and billboard pixel
 * sprites (attic statues, finials, crosses). Everything is drawn into the building's iso canvas
 * with depth, so ornaments occlude like the roof parts. Pure helpers — a city's ornament painter
 * (src/art/env/cities/<city>.ts) decides what goes where.
 *
 * Face convention (as bld/building.ts): the LEFT face is the +v wall (v = d, lit), measured in
 * px `s` from its u = 0 end; the RIGHT face is the +u wall (u = w, shaded), measured from its
 * v = d end. Heights `z` are px above the ground.
 */
import type { RGBA } from '../../palette';
import type { IsoCanvas, V3 } from '../raster';
import { parseGrid } from './face';

export type FaceSide = 'left' | 'right';

/** World point on a face plane (`out` pushes it off the wall, in tiles). */
export function facePoint(side: FaceSide, w: number, d: number, s: number, z: number, out = 0): V3 {
  return side === 'left' ? { u: s / 16, v: d + out, z } : { u: w + out, v: d - s / 16, z };
}

/** Gable pixel: x = px across from its left end, y = px above its base, edge = px below the top. */
export type GableTex = (x: number, y: number, edge: number, top: number) => RGBA | null;

export interface GableSpec {
  side: FaceSide;
  w: number;
  d: number;
  /** Span along the face (px). */
  s0: number;
  s1: number;
  /** Base height (px) and full height (px above the base). */
  z0: number;
  h: number;
  /** Outline: 0..1 of `h` at t = 0..1 across the span (symmetric profiles read best). */
  profile: (t: number) => number;
  tex: GableTex;
  /** Pushed off the wall (tiles), so it stands proud of the eaves. */
  out?: number;
  bias?: number;
}

/** A gable (or pediment, attic panel …) standing on a face, cut to `profile`. */
export function gable(cv: IsoCanvas, g: GableSpec): void {
  const out = g.out ?? 0.02;
  const span = g.s1 - g.s0;
  const pts = [
    facePoint(g.side, g.w, g.d, g.s0, g.z0, out),
    facePoint(g.side, g.w, g.d, g.s1, g.z0, out),
    facePoint(g.side, g.w, g.d, g.s1, g.z0 + g.h + 1, out),
    facePoint(g.side, g.w, g.d, g.s0, g.z0 + g.h + 1, out),
  ];
  cv.poly(
    pts,
    (u, v, z) => {
      const s = g.side === 'left' ? u * 16 : (g.d - v) * 16;
      const x = Math.floor(s - g.s0);
      if (x < 0 || x >= span) return null;
      const y = Math.floor(z - g.z0);
      const top = Math.round(g.h * g.profile((x + 0.5) / span));
      if (y > top || y < 0) return null;
      return g.tex(x, y, top - y, top);
    },
    undefined,
    g.bias ?? 2,
  );
}

/** Classic profiles for `gable`. */
export const PROFILES = {
  /** Triangular pediment. */
  pediment: (t: number): number => 1 - Math.abs(t * 2 - 1),
  /** Baroque volute gable: a shoulder, an S-curve and a round top. */
  baroque: (t: number): number => {
    const x = Math.abs(t * 2 - 1); // 0 centre … 1 ends
    if (x > 0.86) return 0.32;
    if (x > 0.5) return 0.32 + 0.4 * (0.5 + 0.5 * Math.cos(((x - 0.5) / 0.36) * Math.PI));
    return 0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - (x / 0.5) ** 2));
  },
  /** Segmental (shallow arc) top. */
  segment: (t: number): number => 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - (t * 2 - 1) ** 2)),
  /** Stepped gable (n steps a side). */
  stepped:
    (n: number) =>
    (t: number): number => {
      const x = 1 - Math.abs(t * 2 - 1);
      return Math.min(1, (Math.floor(x * (n + 0.5)) + 1) / (n + 1));
    },
  /** Flat attic panel. */
  flat: (): number => 1,
};

/** Light from the upper left: shade value 0..1 for a surface normal (top lightest, +u darkest). */
export function sunShade(nu: number, nv: number, nz: number): number {
  return Math.max(0, Math.min(0.999, 0.42 + 0.52 * nz + 0.2 * nv - 0.38 * nu));
}

/** Pick a ramp colour (dark → light) for a shade value. */
const rampAt = (ramp: readonly RGBA[], s: number): RGBA =>
  ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(s * ramp.length)))]!;

export interface DomeSpec {
  /** Centre of the base (tiles) and base height (px). */
  cu: number;
  cv: number;
  z0: number;
  /** Base radius (tiles) and height (px). */
  r: number;
  h: number;
  /** Ramp dark → light. */
  ramp: readonly RGBA[];
  /** Number of ribs (0 = none), coloured `rib`. */
  ribs?: number;
  rib?: RGBA;
  /** Onion / pointed bulge (0 = hemisphere-ish, 0.3 = onion). */
  onion?: number;
  bias?: number;
}

/** Dome (surface of revolution), flat-shaded per facet with optional ribs. */
export function dome(cv: IsoCanvas, s: DomeSpec): void {
  const N = 16;
  const M = 6;
  const onion = s.onion ?? 0;
  const prof = (t: number): [number, number] => {
    // t: 0 base … 1 apex → [radius factor, height factor].
    const a = (t * Math.PI) / 2;
    let rf = Math.cos(a);
    if (onion > 0) rf *= 1 + onion * Math.sin(t * Math.PI * 1.2) * (1 - t);
    return [rf, Math.sin(a) ** (onion > 0 ? 1.4 : 1)];
  };
  for (let m = 0; m < M; m++) {
    const [r0, h0] = prof(m / M);
    const [r1, h1] = prof((m + 1) / M);
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const pt = (a: number, rf: number, hf: number): V3 => ({
        u: s.cu + Math.cos(a) * s.r * rf,
        v: s.cv + Math.sin(a) * s.r * rf,
        z: s.z0 + hf * s.h,
      });
      // Facet normal (approx.): outward + up by the slope of the profile.
      const slope = Math.atan2((h1 - h0) * s.h, (r0 - r1) * s.r * 32 + 1e-6);
      const nz = Math.cos(slope);
      const nh = Math.sin(slope);
      const shade = sunShade(Math.cos(am) * nh, Math.sin(am) * nh, nz);
      const ribK = s.ribs ? N / s.ribs : 0;
      const quad =
        m === M - 1
          ? [pt(a0, r0, h0), pt(a1, r0, h0), pt(am, r1, h1)]
          : [pt(a0, r0, h0), pt(a1, r0, h0), pt(a1, r1, h1), pt(a0, r1, h1)];
      cv.poly(
        quad,
        (u, v) => {
          if (ribK && s.rib !== undefined) {
            const ang = Math.atan2(v - s.cv, u - s.cu);
            const f = (((ang / (Math.PI * 2)) * N) % ribK) + ribK;
            const off = Math.min(f % ribK, ribK - (f % ribK));
            if (off < 0.18) return s.rib;
          }
          return rampAt(s.ramp, shade);
        },
        undefined,
        s.bias ?? 0,
      );
    }
  }
}

export interface PrismSpec {
  cu: number;
  cv: number;
  z0: number;
  z1: number;
  r: number;
  /** Sides (4 = square, rotated by `rot`). */
  n: number;
  rot?: number;
  /** Side texture: shade 0..1, x px along the side from its left end, y px from the top. */
  tex: (shade: number, x: number, y: number, side: number) => RGBA | null;
  bias?: number;
}

/** Vertical prism (turret drum, lantern, chimney): each side flat-shaded by the sun. */
export function prism(cv: IsoCanvas, s: PrismSpec): void {
  const rot = s.rot ?? Math.PI / s.n;
  for (let k = 0; k < s.n; k++) {
    const a0 = rot + (k / s.n) * Math.PI * 2;
    const a1 = rot + ((k + 1) / s.n) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const shade = sunShade(Math.cos(am), Math.sin(am), 0);
    const p = (a: number, z: number): V3 => ({
      u: s.cu + Math.cos(a) * s.r,
      v: s.cv + Math.sin(a) * s.r,
      z,
    });
    const A = p(a0, s.z0);
    cv.poly(
      [p(a0, s.z1), p(a1, s.z1), p(a1, s.z0), p(a0, s.z0)],
      (u, v, z) => {
        // px along the side from its first corner.
        const x = Math.floor(Math.hypot(u - A.u, v - A.v) * 16);
        return s.tex(shade, x, Math.floor(s.z1 - z), k);
      },
      undefined,
      s.bias ?? 0,
    );
  }
  // Lid (only seen from above when the drum stands alone).
  const lid: V3[] = [];
  for (let k = 0; k < s.n; k++) {
    const a = rot + (k / s.n) * Math.PI * 2;
    lid.push({ u: s.cu + Math.cos(a) * s.r, v: s.cv + Math.sin(a) * s.r, z: s.z1 });
  }
  cv.poly(lid, () => s.tex(0.99, 0, -1, -1), undefined, s.bias ?? 0);
}

export interface ConeSpec {
  cu: number;
  cv: number;
  z0: number;
  r: number;
  h: number;
  n: number;
  rot?: number;
  ramp: readonly RGBA[];
  /** Optional per-pixel override (courses, crockets): shade, height fraction 0..1, side. */
  tex?: (shade: number, f: number, side: number, z: number) => RGBA | null;
  bias?: number;
}

/** Cone / pyramid spire (n sides), flat-shaded per side. */
export function cone(cv: IsoCanvas, s: ConeSpec): void {
  const rot = s.rot ?? Math.PI / s.n;
  const apex: V3 = { u: s.cu, v: s.cv, z: s.z0 + s.h };
  const slope = Math.atan2(s.h, s.r * 32 * Math.cos(Math.PI / s.n));
  for (let k = 0; k < s.n; k++) {
    const a0 = rot + (k / s.n) * Math.PI * 2;
    const a1 = rot + ((k + 1) / s.n) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const nh = Math.sin(slope);
    const shade = sunShade(Math.cos(am) * nh, Math.sin(am) * nh, Math.cos(slope));
    const p = (a: number): V3 => ({
      u: s.cu + Math.cos(a) * s.r,
      v: s.cv + Math.sin(a) * s.r,
      z: s.z0,
    });
    cv.poly(
      [p(a0), p(a1), apex],
      (_u, _v, z) => {
        const f = (z - s.z0) / s.h;
        return s.tex ? s.tex(shade, f, k, z) : rampAt(s.ramp, shade);
      },
      undefined,
      s.bias ?? 0,
    );
  }
}

/**
 * Billboard pixel sprite at a world point (bottom-centre anchored, screen-aligned, every pixel at
 * the base's depth + bias): statues on an attic, finials, crosses, flags on a turret.
 */
export function billboard(
  cv: IsoCanvas,
  base: V3,
  src: string,
  keys: Readonly<Record<string, RGBA>>,
  bias = 0.6,
): void {
  const g = parseGrid(src);
  const cx = Math.floor(g.w / 2);
  for (let y = 0; y < g.h; y++) {
    const row = g.rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const k = row[x]!;
      if (k === '.') continue;
      const c = keys[k];
      if (c === undefined) continue;
      const dx = x - cx;
      cv.dot({ u: base.u + dx / 32, v: base.v - dx / 32, z: base.z + (g.h - 1 - y) }, c, bias);
    }
  }
}

/** A box-shaped dormer on the +v (left) or +u (right) roof slope, with a pitched cap. */
export function slopeDormer(
  cv: IsoCanvas,
  o: {
    side: FaceSide;
    w: number;
    d: number;
    /** Centre along the face (px) and how far in from the wall (tiles). */
    s: number;
    inset: number;
    z0: number;
    /** Front width (px) and wall height (px). */
    wpx: number;
    hpx: number;
    wall: RGBA;
    trim: RGBA;
    glass: RGBA;
    cap: readonly RGBA[];
  },
): void {
  const half = o.wpx / 2 / 16;
  const depth = 0.32;
  const a0 = o.s / 16 - half;
  const a1 = o.s / 16 + half;
  const front = (o.side === 'left' ? o.d : o.w) - o.inset;
  const z1 = o.z0 + o.hpx;
  const glassTex = (x: number, y: number): RGBA => {
    if (x <= 0 || x >= o.wpx - 1 || y <= 0) return o.trim;
    if (y >= o.hpx - 1) return o.trim;
    return x === 1 && y > o.hpx - 3 ? o.trim : o.glass;
  };
  const capH = Math.max(3, Math.round(o.wpx / 2));
  if (o.side === 'left') {
    cv.box(a0, front - depth, o.z0, a1, front, z1, {
      top: null,
      left: (u, _v, z) => glassTex(Math.floor((u - a0) * 16), Math.floor(z - o.z0)),
      right: () => o.wall,
    });
    // Pitched cap: two slopes meeting at a ridge running back into the roof.
    cv.poly(
      [
        { u: a0 - 0.02, v: front + 0.02, z: z1 },
        { u: (a0 + a1) / 2, v: front + 0.02, z: z1 + capH },
        { u: (a0 + a1) / 2, v: front - depth, z: z1 + capH },
        { u: a0 - 0.02, v: front - depth, z: z1 },
      ],
      () => o.cap[2]!,
    );
    cv.poly(
      [
        { u: (a0 + a1) / 2, v: front + 0.02, z: z1 + capH },
        { u: a1 + 0.02, v: front + 0.02, z: z1 },
        { u: a1 + 0.02, v: front - depth, z: z1 },
        { u: (a0 + a1) / 2, v: front - depth, z: z1 + capH },
      ],
      () => o.cap[0]!,
    );
    // Gable triangle of the dormer front.
    cv.poly(
      [
        { u: a0, v: front, z: z1 },
        { u: a1, v: front, z: z1 },
        { u: (a0 + a1) / 2, v: front, z: z1 + capH - 1 },
      ],
      () => o.trim,
    );
  } else {
    const b0 = o.d - a1;
    const b1 = o.d - a0;
    cv.box(front - depth, b0, o.z0, front, b1, z1, {
      top: null,
      left: () => o.wall,
      right: (_u, v, z) => glassTex(Math.floor((b1 - v) * 16), Math.floor(z - o.z0)),
    });
    cv.poly(
      [
        { u: front + 0.02, v: b1 + 0.02, z: z1 },
        { u: front + 0.02, v: (b0 + b1) / 2, z: z1 + capH },
        { u: front - depth, v: (b0 + b1) / 2, z: z1 + capH },
        { u: front - depth, v: b1 + 0.02, z: z1 },
      ],
      () => o.cap[1]!,
    );
    cv.poly(
      [
        { u: front + 0.02, v: (b0 + b1) / 2, z: z1 + capH },
        { u: front + 0.02, v: b0 - 0.02, z: z1 },
        { u: front - depth, v: b0 - 0.02, z: z1 },
        { u: front - depth, v: (b0 + b1) / 2, z: z1 + capH },
      ],
      () => o.cap[0]!,
    );
    cv.poly(
      [
        { u: front, v: b1, z: z1 },
        { u: front, v: b0, z: z1 },
        { u: front, v: (b0 + b1) / 2, z: z1 + capH - 1 },
      ],
      () => o.trim,
    );
  }
}
