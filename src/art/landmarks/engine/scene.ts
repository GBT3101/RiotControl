/**
 * Landmark scene renderer (M3b).
 *
 * Large landmarks are modelled as a handful of analytic solids (boxes, gables, pyramids,
 * cylinders, cones, domes) placed in footprint space, ray-cast exactly on the 2:1 iso pixel
 * lattice, then *painted* by hand-written material functions (face-space modules: windows,
 * columns, reliefs drawn as grids) and finished with pixel-art passes (cast shadows, contact
 * lines, coloured exterior outline). Hand-drawn sprites (lions, statues, flags) are placed as
 * depth-tested billboards. This is the art bible's "procedural painter placing hand-authored
 * modules" approach — never noise, every colour a RIOT-64 swatch.
 *
 * Coordinates: u along tile i (screen down-right), v along tile j (screen down-left), both in
 * tiles relative to the footprint's top vertex; z = height in world pixels. A point projects to
 * screen (sx, sy) = ((u − v)·16, (u + v)·8 − z) relative to the sprite anchor.
 *
 * View rays: pixel centre (sx, sy) → p(t) = (a/2 + t/2, −a/2 + t/2, −sy + 8t), a = sx/16;
 * larger t = nearer the viewer, t = u + v on the hit.
 */
import { resolveColor, type RGBA } from '../../palette';
import { createBuffer, type PixelBuffer } from '../../lib/pixels';
import { inkOf } from './materials';

/** World px of height per tile of horizontal distance (true 2:1 dimetric, 30° elevation). */
export const KZ = 19.6;

export interface Plane {
  nu: number;
  nv: number;
  nz: number;
  c: number;
}

export type Quadric =
  | { kind: 'cyl'; uc: number; vc: number; r: number }
  | { kind: 'cone'; uc: number; vc: number; z0: number; r0: number; k: number }
  | { kind: 'ell'; uc: number; vc: number; zc: number; ru: number; rv: number; rz: number }
  /** Horizontal cylinder along u (barrel vaults): (v−vc)²/rv² + (z−zc)²/rz² ≤ 1. */
  | { kind: 'hcylU'; vc: number; zc: number; rv: number; rz: number }
  | { kind: 'hcylV'; uc: number; zc: number; ru: number; rz: number };

/** Everything a material needs to paint one pixel. */
export interface ShadeCtx {
  /** Hit point (tiles, tiles, px). */
  u: number;
  v: number;
  z: number;
  /** Metric unit normal. */
  nu: number;
  nv: number;
  nz: number;
  /** Plane index of the hit face, −1 for the quadric surface. */
  face: number;
  /** 'top' | 'left' (+v, lit) | 'right' (+u, shaded) | 'curve' | 'back'. */
  side: 'top' | 'left' | 'right' | 'curve' | 'slopeL' | 'slopeR' | 'back';
  /** Light level 0..4 after cast shadow (4 = sunlit top, 3 = lit wall, 1 = shaded wall). */
  level: number;
  /** Unshadowed light level. */
  base: number;
  shadow: boolean;
  lambert: number;
  /** Pixel position in the sprite, and screen position relative to the anchor. */
  px: number;
  py: number;
  sx: number;
  sy: number;
  /** Face-space column (1 px = 1/16 tile along the face) and row (floor z). */
  fx: number;
  fz: number;
  /** A nearer surface touches this pixel (contact / occlusion line). */
  edge: boolean;
  /** Pixel above is sky or a much farther surface (rim light candidate). */
  rim: boolean;
  prim: Prim;
  /** True when rendering the night-lights mask. */
  night: boolean;
}

/** Returns a colour reference ('stone4', 'navy.2') or null for "no paint" (mask passes). */
export type Material = (c: ShadeCtx) => string | null;

export interface Prim {
  planes: Plane[];
  quad?: Quadric;
  mat: Material;
  /** Night-lights mask colour (or null = dark). */
  emit?: Material;
  /** Return true to punch a hole at this surface point (lattice, damage). */
  cut?: (u: number, v: number, z: number, face: number) => boolean;
  /** Casts shadows (default true). */
  cast: boolean;
  /** Receives cast shadows (default true). */
  recv: boolean;
  /** Draws/receives contact lines (default true). */
  edges: boolean;
  aabb: [number, number, number, number, number, number];
  tag: string;
}

export interface PrimOpts {
  emit?: Material;
  cut?: Prim['cut'];
  cast?: boolean;
  recv?: boolean;
  edges?: boolean;
  tag?: string;
}

interface GeomCache {
  N: number;
  prims: number;
  depth: Float32Array;
  primIx: Int32Array;
  faceIx: Int16Array;
  hitT: Float32Array;
  backHit: Uint8Array;
  shadow: Int8Array;
}
const GEOM_CACHE = new Map<string, GeomCache>();
/** Drop cached geometry passes (call after registration to free memory). */
export function clearRenderCache(): void {
  GEOM_CACHE.clear();
}

interface ShadowGrid {
  a0: number;
  b0: number;
  cell: number;
  nw: number;
  nh: number;
  cells: number[][];
  su: number;
  sv: number;
}

interface Billboard {
  img: PixelBuffer;
  emit?: PixelBuffer;
  /** Pixel of img placed on the projected point. */
  ax: number;
  ay: number;
  u: number;
  v: number;
  z: number;
  bias: number;
  /** Shade with the scene's cast shadows? (darkens via the shade map) */
}

interface Stroke {
  pts: Array<[number, number, number]>;
  colour: string;
  emit?: string;
  bias: number;
}

const LIGHT = (() => {
  const l = [-0.5, 0.7, 1.0];
  const n = Math.hypot(l[0]!, l[1]!, l[2]!);
  return [l[0]! / n, l[1]! / n, l[2]! / n] as const;
})();
/** Sun direction for shadows falling on vertical faces (sun a little in front-left). */
const SUN_V = [-0.045, 0.055, 1] as const;
/** Sun direction for shadows on horizontal surfaces (matches M1 box shadows: (2,1) on screen). */
const SUN_H = [-0.75 / 16, 0, 1] as const;

export function lightLevel(lambert: number): number {
  if (lambert >= 0.7) return 4;
  if (lambert >= 0.4) return 3;
  if (lambert >= 0.13) return 2;
  return 1;
}

interface Hit {
  t0: number;
  t1: number;
  f0: number;
  f1: number;
}

const COLOUR_CACHE = new Map<string, RGBA>();
/** Cached colour-reference resolution (materials return strings per pixel). */
export function colourOf(ref: string): RGBA {
  let c = COLOUR_CACHE.get(ref);
  if (c === undefined) {
    c = resolveColor(ref);
    COLOUR_CACHE.set(ref, c);
  }
  return c;
}

const HIT: Hit = { t0: 0, t1: 0, f0: 0, f1: 0 };

/** Intersect ray o + t·d with a prim. Returns the inside interval (shared scratch object) or null. */
function intersect(
  p: Prim,
  ou: number,
  ov: number,
  oz: number,
  du: number,
  dv: number,
  dz: number,
): Hit | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  let f0 = -2;
  let f1 = -2;
  const q = p.quad;
  if (q) {
    let A: number;
    let B: number;
    let C: number;
    if (q.kind === 'cyl') {
      const eu = ou - q.uc;
      const ev = ov - q.vc;
      A = du * du + dv * dv;
      B = 2 * (eu * du + ev * dv);
      C = eu * eu + ev * ev - q.r * q.r;
    } else if (q.kind === 'cone') {
      const eu = ou - q.uc;
      const ev = ov - q.vc;
      const R0 = q.r0 + q.k * (oz - q.z0);
      const Rk = q.k * dz;
      A = du * du + dv * dv - Rk * Rk;
      B = 2 * (eu * du + ev * dv - R0 * Rk);
      C = eu * eu + ev * ev - R0 * R0;
    } else if (q.kind === 'ell') {
      const eu = (ou - q.uc) / q.ru;
      const ev = (ov - q.vc) / q.rv;
      const ez = (oz - q.zc) / q.rz;
      const au = du / q.ru;
      const av = dv / q.rv;
      const az = dz / q.rz;
      A = au * au + av * av + az * az;
      B = 2 * (eu * au + ev * av + ez * az);
      C = eu * eu + ev * ev + ez * ez - 1;
    } else if (q.kind === 'hcylU') {
      const ev = (ov - q.vc) / q.rv;
      const ez = (oz - q.zc) / q.rz;
      const av = dv / q.rv;
      const az = dz / q.rz;
      A = av * av + az * az;
      B = 2 * (ev * av + ez * az);
      C = ev * ev + ez * ez - 1;
    } else {
      const eu = (ou - q.uc) / q.ru;
      const ez = (oz - q.zc) / q.rz;
      const au = du / q.ru;
      const az = dz / q.rz;
      A = au * au + az * az;
      B = 2 * (eu * au + ez * az);
      C = eu * eu + ez * ez - 1;
    }
    if (Math.abs(A) < 1e-12) {
      if (Math.abs(B) < 1e-12) {
        if (C > 0) return null;
      } else {
        const tr = -C / B;
        if (B > 0) {
          t1 = tr;
          f1 = -1;
        } else {
          t0 = tr;
          f0 = -1;
        }
      }
    } else {
      const disc = B * B - 4 * A * C;
      if (disc < 0) {
        if (A > 0) return null;
        // A < 0 and no roots: everywhere inside (degenerate cone) — keep full line.
      } else {
        const sq = Math.sqrt(disc);
        let ta = (-B - sq) / (2 * A);
        let tb = (-B + sq) / (2 * A);
        if (ta > tb) [ta, tb] = [tb, ta];
        if (A > 0) {
          t0 = ta;
          t1 = tb;
          f0 = -1;
          f1 = -1;
        } else {
          // Two half-lines; the slab planes pick one. Decide by the cone radius sign.
          const kq = q as { kind: 'cone'; z0: number; r0: number; k: number };
          const rAt = (t: number): number => kq.r0 + kq.k * (oz + t * dz - kq.z0);
          if (rAt(tb + 1) >= 0) {
            t0 = tb;
            f0 = -1;
          } else {
            t1 = ta;
            f1 = -1;
          }
        }
      }
    }
  }
  const pl = p.planes;
  for (let i = 0; i < pl.length; i++) {
    const P = pl[i]!;
    const nd = P.nu * du + P.nv * dv + P.nz * dz;
    const no = P.nu * ou + P.nv * ov + P.nz * oz;
    if (Math.abs(nd) < 1e-12) {
      if (no > P.c + 1e-9) return null;
      continue;
    }
    const t = (P.c - no) / nd;
    if (nd > 0) {
      if (t < t1) {
        t1 = t;
        f1 = i;
      }
    } else if (t > t0) {
      t0 = t;
      f0 = i;
    }
    if (t0 > t1) return null;
  }
  if (t0 > t1) return null;
  HIT.t0 = t0;
  HIT.t1 = t1;
  HIT.f0 = f0;
  HIT.f1 = f1;
  return HIT;
}

const NRM: [number, number, number] = [0, 0, 0];

function normalAt(p: Prim, face: number, u: number, v: number, z: number): [number, number, number] {
  let nu: number;
  let nv: number;
  let nz: number;
  if (face >= 0) {
    const P = p.planes[face]!;
    nu = P.nu;
    nv = P.nv;
    nz = P.nz * KZ;
  } else {
    const q = p.quad!;
    if (q.kind === 'cyl') {
      nu = u - q.uc;
      nv = v - q.vc;
      nz = 0;
    } else if (q.kind === 'cone') {
      const r = q.r0 + q.k * (z - q.z0);
      nu = u - q.uc;
      nv = v - q.vc;
      nz = -r * q.k * KZ;
    } else if (q.kind === 'ell') {
      nu = (u - q.uc) / (q.ru * q.ru);
      nv = (v - q.vc) / (q.rv * q.rv);
      nz = ((z - q.zc) / (q.rz * q.rz)) * KZ;
    } else if (q.kind === 'hcylU') {
      nu = 0;
      nv = (v - q.vc) / (q.rv * q.rv);
      nz = ((z - q.zc) / (q.rz * q.rz)) * KZ;
    } else {
      nu = (u - q.uc) / (q.ru * q.ru);
      nv = 0;
      nz = ((z - q.zc) / (q.rz * q.rz)) * KZ;
    }
  }
  const n = Math.sqrt(nu * nu + nv * nv + nz * nz) || 1;
  NRM[0] = nu / n;
  NRM[1] = nv / n;
  NRM[2] = nz / n;
  return NRM;
}

// ---------------------------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------------------------

export interface Canvas {
  /** Footprint size (tiles). */
  w: number;
  d: number;
  /** Extra px above the footprint top vertex (tallest point + margin). */
  top: number;
  /** Extra px on each side / below beyond the footprint diamond (default 2). */
  margin?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

export interface RenderOut {
  img: PixelBuffer;
  night: PixelBuffer;
  anchor: { x: number; y: number };
}

export class Scene {
  readonly prims: Prim[] = [];
  private readonly boards: Billboard[] = [];
  private readonly strokes: Stroke[] = [];

  add(planes: Plane[], aabb: Prim['aabb'], mat: Material, o: PrimOpts = {}, quad?: Quadric): Prim {
    const p: Prim = {
      planes,
      quad,
      mat,
      emit: o.emit,
      cut: o.cut,
      cast: o.cast ?? true,
      recv: o.recv ?? true,
      edges: o.edges ?? true,
      aabb,
      tag: o.tag ?? '',
    };
    this.prims.push(p);
    return p;
  }

  /** Axis-aligned box. */
  box(
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    z0: number,
    z1: number,
    mat: Material,
    o?: PrimOpts,
  ): Prim {
    return this.add(slab(u0, u1, v0, v1, z0, z1), [u0, u1, v0, v1, z0, z1], mat, o);
  }

  /** Gable / pediment prism. ridge 'u': ridge runs along u (slopes face ±v); 'v': along v. */
  gable(
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    z0: number,
    z1: number,
    ridge: 'u' | 'v',
    mat: Material,
    o?: PrimOpts,
  ): Prim {
    const pl = slab(u0, u1, v0, v1, z0, z1);
    if (ridge === 'v') {
      const k = (z1 - z0) / ((u1 - u0) / 2);
      pl.push({ nu: -k, nv: 0, nz: 1, c: z0 - k * u0 }); // z ≤ z0 + k(u − u0)
      pl.push({ nu: k, nv: 0, nz: 1, c: z0 + k * u1 }); // z ≤ z0 + k(u1 − u)
    } else {
      const k = (z1 - z0) / ((v1 - v0) / 2);
      pl.push({ nu: 0, nv: -k, nz: 1, c: z0 - k * v0 });
      pl.push({ nu: 0, nv: k, nz: 1, c: z0 + k * v1 });
    }
    return this.add(pl, [u0, u1, v0, v1, z0, z1], mat, o);
  }

  /**
   * Hipped roof / truncated pyramid: base rectangle at z0 shrinking by `inset` tiles on every
   * side at z1 (inset ≥ half the short side gives a ridge or apex).
   */
  hip(
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    z0: number,
    z1: number,
    inset: number | [number, number],
    mat: Material,
    o?: PrimOpts,
  ): Prim {
    const [iu, iv] = typeof inset === 'number' ? [inset, inset] : inset;
    const pl = slab(u0, u1, v0, v1, z0, z1);
    const h = z1 - z0;
    if (iu > 0) {
      const k = h / iu;
      pl.push({ nu: -k, nv: 0, nz: 1, c: z0 - k * u0 });
      pl.push({ nu: k, nv: 0, nz: 1, c: z0 + k * u1 });
    }
    if (iv > 0) {
      const k = h / iv;
      pl.push({ nu: 0, nv: -k, nz: 1, c: z0 - k * v0 });
      pl.push({ nu: 0, nv: k, nz: 1, c: z0 + k * v1 });
    }
    return this.add(pl, [u0, u1, v0, v1, z0, z1], mat, o);
  }

  /** Vertical cylinder. */
  cyl(uc: number, vc: number, r: number, z0: number, z1: number, mat: Material, o?: PrimOpts): Prim {
    return this.add(
      [
        { nu: 0, nv: 0, nz: -1, c: -z0 },
        { nu: 0, nv: 0, nz: 1, c: z1 },
      ],
      [uc - r, uc + r, vc - r, vc + r, z0, z1],
      mat,
      o,
      { kind: 'cyl', uc, vc, r },
    );
  }

  /** Vertical (truncated) cone: radius r0 at z0 → r1 at z1. */
  cone(
    uc: number,
    vc: number,
    r0: number,
    r1: number,
    z0: number,
    z1: number,
    mat: Material,
    o?: PrimOpts,
  ): Prim {
    const r = Math.max(r0, r1);
    return this.add(
      [
        { nu: 0, nv: 0, nz: -1, c: -z0 },
        { nu: 0, nv: 0, nz: 1, c: z1 },
      ],
      [uc - r, uc + r, vc - r, vc + r, z0, z1],
      mat,
      o,
      { kind: 'cone', uc, vc, z0, r0, k: (r1 - r0) / (z1 - z0) },
    );
  }

  /** Ellipsoid, optionally clipped to z ≥ zMin (domes). */
  ell(
    uc: number,
    vc: number,
    zc: number,
    ru: number,
    rv: number,
    rz: number,
    mat: Material,
    o?: PrimOpts & { zMin?: number; zMax?: number },
  ): Prim {
    const pl: Plane[] = [];
    const zMin = o?.zMin ?? zc - rz;
    const zMax = o?.zMax ?? zc + rz;
    pl.push({ nu: 0, nv: 0, nz: -1, c: -zMin });
    pl.push({ nu: 0, nv: 0, nz: 1, c: zMax });
    return this.add(pl, [uc - ru, uc + ru, vc - rv, vc + rv, zMin, zMax], mat, o, {
      kind: 'ell',
      uc,
      vc,
      zc,
      ru,
      rv,
      rz,
    });
  }

  /** Barrel vault along u (half cylinder above zc). */
  vaultU(
    u0: number,
    u1: number,
    vc: number,
    rv: number,
    zc: number,
    rz: number,
    mat: Material,
    o?: PrimOpts,
  ): Prim {
    return this.add(
      [
        { nu: -1, nv: 0, nz: 0, c: -u0 },
        { nu: 1, nv: 0, nz: 0, c: u1 },
        { nu: 0, nv: 0, nz: -1, c: -zc },
      ],
      [u0, u1, vc - rv, vc + rv, zc, zc + rz],
      mat,
      o,
      { kind: 'hcylU', vc, zc, rv, rz },
    );
  }

  /**
   * Regular n-sided prism / tapered spire around (uc, vc): apothem r0 at z0 → r1 at z1.
   * Faces at angles rot + k·360/n (rot 0 → faces axis-aligned for n = 4, 8).
   */
  prismN(
    uc: number,
    vc: number,
    r0: number,
    r1: number,
    z0: number,
    z1: number,
    n: number,
    mat: Material,
    o?: PrimOpts & { rot?: number },
  ): Prim {
    const k = (r1 - r0) / (z1 - z0);
    const pl: Plane[] = [
      { nu: 0, nv: 0, nz: -1, c: -z0 },
      { nu: 0, nv: 0, nz: 1, c: z1 },
    ];
    const rot = o?.rot ?? 0;
    for (let i = 0; i < n; i++) {
      const th = rot + (i * 2 * Math.PI) / n;
      const cu = Math.cos(th);
      const cv = Math.sin(th);
      pl.push({ nu: cu, nv: cv, nz: -k, c: r0 + cu * uc + cv * vc - k * z0 });
    }
    const R = Math.max(r0, r1) / Math.cos(Math.PI / n);
    return this.add(pl, [uc - R, uc + R, vc - R, vc + R, z0, z1], mat, o);
  }

  /** Arbitrary convex polytope. */
  poly(planes: Plane[], aabb: Prim['aabb'], mat: Material, o?: PrimOpts): Prim {
    return this.add(planes, aabb, mat, o);
  }

  /** Depth-tested hand-drawn sprite; pixel (ax, ay) of img lands on point (u, v, z). */
  sprite(
    img: PixelBuffer,
    ax: number,
    ay: number,
    u: number,
    v: number,
    z: number,
    o: { emit?: PixelBuffer; bias?: number } = {},
  ): void {
    this.boards.push({ img, ax, ay, u, v, z, emit: o.emit, bias: o.bias ?? 0 });
  }

  /** Depth-tested 1-px polyline in 3D (poles, cables, spokes). */
  line(
    pts: Array<[number, number, number]>,
    colour: string,
    o: { emit?: string; bias?: number } = {},
  ): void {
    this.strokes.push({ pts, colour, emit: o.emit, bias: o.bias ?? 0 });
  }

  /** Render the scene into a sprite with the anchor on the footprint's top vertex. */
  /**
   * Render the scene. `cacheKey`: scenes rendered with the same key must have identical prim
   * geometry (same prims in the same order, same cuts); the prim pass and the per-pixel cast
   * shadows are then reused (damage states 0–3 of a Capitol share geometry).
   */
  render(cv: Canvas, opts: { outline?: boolean; cacheKey?: string } = {}): RenderOut {
    const m = cv.margin ?? 2;
    const left = 16 * cv.d + (cv.left ?? m);
    const right = 16 * cv.w + (cv.right ?? m);
    const W = left + right;
    const ax = left;
    const ay = cv.top;
    const H = cv.top + 8 * (cv.w + cv.d) + (cv.bottom ?? m);
    const N = W * H;
    const cached = opts.cacheKey ? GEOM_CACHE.get(opts.cacheKey) : undefined;
    const fresh = !cached || cached.N !== N || cached.prims !== this.prims.length;
    const g: GeomCache = fresh
      ? {
          N,
          prims: this.prims.length,
          depth: new Float32Array(N).fill(-Infinity),
          primIx: new Int32Array(N).fill(-1),
          faceIx: new Int16Array(N),
          hitT: new Float32Array(N),
          backHit: new Uint8Array(N),
          shadow: new Int8Array(N).fill(-1),
        }
      : cached;
    if (fresh && opts.cacheKey) GEOM_CACHE.set(opts.cacheKey, g);
    const depth = new Float32Array(g.depth);
    const primIx = new Int32Array(g.primIx);
    const faceIx = g.faceIx;
    const hitT = g.hitT;
    const backHit = g.backHit;
    const shadowCache = g.shadow;
    const preCol = new Uint32Array(N); // pre-coloured pixels (billboards / strokes)
    const preEmit = new Uint32Array(N);

    // --- geometry pass ---------------------------------------------------------------------
    const prims = this.prims;
    for (let pi = 0; pi < (fresh ? prims.length : 0); pi++) {
      const p = prims[pi]!;
      const [u0, u1, v0, v1, z0, z1] = p.aabb;
      const xs = [(u0 - v0) * 16, (u0 - v1) * 16, (u1 - v0) * 16, (u1 - v1) * 16];
      const ys0 = [(u0 + v0) * 8, (u1 + v1) * 8];
      const x0 = Math.max(0, Math.floor(Math.min(...xs) + ax) - 1);
      const x1 = Math.min(W - 1, Math.ceil(Math.max(...xs) + ax) + 1);
      const y0 = Math.max(0, Math.floor(ys0[0]! - z1 + ay) - 1);
      const y1 = Math.min(H - 1, Math.ceil(ys0[1]! - z0 + ay) + 1);
      for (let py = y0; py <= y1; py++) {
        const sy = py + 0.5 - ay;
        for (let px = x0; px <= x1; px++) {
          const sx = px + 0.5 - ax;
          const a = sx / 16;
          const h = intersect(p, a / 2, -a / 2, -sy, 0.5, 0.5, 8);
          if (!h) continue;
          let t = h.t1;
          let f = h.f1;
          let back = 0;
          if (p.cut) {
            const u = (t + a) / 2;
            const v = (t - a) / 2;
            const z = 8 * t - sy;
            if (p.cut(u, v, z, f)) {
              // Look through to the inner side of the far face.
              t = h.t0;
              f = h.f0;
              back = 1;
              if (!isFinite(t)) continue;
              const ub = (t + a) / 2;
              const vb = (t - a) / 2;
              const zb = 8 * t - sy;
              if (p.cut(ub, vb, zb, f)) continue;
            }
          }
          const i = py * W + px;
          if (t > depth[i]!) {
            depth[i] = t;
            primIx[i] = pi;
            faceIx[i] = f;
            hitT[i] = t;
            backHit[i] = back;
            preCol[i] = 0;
          }
        }
      }
    }
    if (fresh) {
      g.depth.set(depth);
      g.primIx.set(primIx);
    }
    // Billboards.
    for (const b of this.boards) {
      const sx0 = Math.round((b.u - b.v) * 16 + ax) - b.ax;
      const sy0 = Math.round((b.u + b.v) * 8 - b.z + ay) - b.ay;
      const t = b.u + b.v + b.bias;
      for (let y = 0; y < b.img.h; y++) {
        for (let x = 0; x < b.img.w; x++) {
          const si = (y * b.img.w + x) * 4;
          if (b.img.data[si + 3]! !== 255) continue;
          const px = sx0 + x;
          const py = sy0 + y;
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const i = py * W + px;
          if (t <= depth[i]!) continue;
          depth[i] = t;
          primIx[i] = -2;
          preCol[i] = packAt(b.img, si);
          preEmit[i] = b.emit && b.emit.data[si + 3]! === 255 ? packAt(b.emit, si) : 0;
        }
      }
    }
    // Strokes.
    for (const s of this.strokes) {
      const col = resolveColor(s.colour);
      const em = s.emit ? resolveColor(s.emit) : 0;
      for (let k = 0; k + 1 < s.pts.length; k++) {
        const [ua, va, za] = s.pts[k]!;
        const [ub, vb, zb] = s.pts[k + 1]!;
        const xa = Math.floor((ua - va) * 16 + ax);
        const ya = Math.floor((ua + va) * 8 - za + ay);
        const xb = Math.floor((ub - vb) * 16 + ax);
        const yb = Math.floor((ub + vb) * 8 - zb + ay);
        const n = Math.max(Math.abs(xb - xa), Math.abs(yb - ya), 1);
        for (let st = 0; st <= n; st++) {
          const f = st / n;
          const px = Math.round(xa + (xb - xa) * f);
          const py = Math.round(ya + (yb - ya) * f);
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const t = ua + va + (ub + vb - ua - va) * f + s.bias;
          const i = py * W + px;
          if (t <= depth[i]!) continue;
          depth[i] = t;
          primIx[i] = -2;
          preCol[i] = col;
          preEmit[i] = em;
        }
      }
    }

    // --- shading pass ----------------------------------------------------------------------
    const img = createBuffer(W, H);
    const night = createBuffer(W, H);
    const isEdge = (i: number, j: number): boolean =>
      primIx[j] !== -1 &&
      primIx[j] !== primIx[i] &&
      depth[j]! > depth[i]! + 0.22 &&
      (primIx[j]! < 0 || prims[primIx[j]!]!.edges);
    const ctx = {} as ShadeCtx;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        const pi = primIx[i]!;
        if (pi === -1) continue;
        if (pi === -2) {
          put(img, i, preCol[i]!);
          if (preEmit[i]) put(night, i, preEmit[i]!);
          continue;
        }
        const p = prims[pi]!;
        const t = hitT[i]!;
        const sx = px + 0.5 - ax;
        const sy = py + 0.5 - ay;
        const a = sx / 16;
        const u = (t + a) / 2;
        const v = (t - a) / 2;
        const z = 8 * t - sy;
        const f = faceIx[i]!;
        let [nu, nv, nz] = normalAt(p, f, u, v, z);
        if (backHit[i]) {
          nu = -nu;
          nv = -nv;
          nz = -nz;
        }
        const lam = nu * LIGHT[0] + nv * LIGHT[1] + nz * LIGHT[2];
        const base = lightLevel(lam);
        let shadow = false;
        if (p.recv && lam > 0) {
          const sc = shadowCache[i]!;
          if (sc >= 0) shadow = sc === 1;
          else {
            const S = nz > 0.55 ? SUN_H : SUN_V;
            shadow = this.occluded(pi, u + nu * 0.02, v + nv * 0.02, z + nz * 0.3, S);
            shadowCache[i] = shadow ? 1 : 0;
          }
        }
        let level = base;
        if (shadow) level = nz > 0.55 ? Math.min(level, 2) : Math.max(1, level - 1);
        let side: ShadeCtx['side'];
        if (backHit[i]) side = 'back';
        else if (f < 0) side = 'curve';
        else if (nz > 0.92) side = 'top';
        else if (nz > 0.2) side = Math.abs(nv) >= Math.abs(nu) ? 'slopeL' : 'slopeR';
        else side = Math.abs(nv) >= Math.abs(nu) ? 'left' : 'right';
        const leftish = Math.abs(nv) >= Math.abs(nu);
        let edge = false;
        if (p.edges) {
          if (px > 0 && isEdge(i, i - 1)) edge = true;
          else if (px < W - 1 && isEdge(i, i + 1)) edge = true;
          else if (py > 0 && isEdge(i, i - W)) edge = true;
          else if (py < H - 1 && isEdge(i, i + W)) edge = true;
        }
        const up = py > 0 ? i - W : -1;
        const rim = up < 0 || primIx[up] === -1 || depth[up]! < depth[i]! - 0.6;
        ctx.u = u;
        ctx.v = v;
        ctx.z = z;
        ctx.nu = nu;
        ctx.nv = nv;
        ctx.nz = nz;
        ctx.face = f;
        ctx.side = side;
        ctx.level = level;
        ctx.base = base;
        ctx.shadow = shadow;
        ctx.lambert = lam;
        ctx.px = px;
        ctx.py = py;
        ctx.sx = px - ax;
        ctx.sy = py - ay;
        ctx.fx = Math.floor((leftish ? u : v) * 16 + 1e-6);
        ctx.fz = Math.floor(z);
        ctx.edge = edge;
        ctx.rim = rim;
        ctx.prim = p;
        ctx.night = false;
        const ref = p.mat(ctx);
        if (ref) put(img, i, colourOf(ref));
        if (p.emit) {
          ctx.night = true;
          const e = p.emit(ctx);
          if (e) put(night, i, colourOf(e));
        }
      }
    }
    if (opts.outline !== false) {
      // Coloured exterior outline: the darkest tone of the touching material.
      const markI: number[] = [];
      const markC: number[] = [];
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const i = py * W + px;
          if (img.data[i * 4 + 3]! !== 0) continue;
          for (let q = 0; q < 4; q++) {
            const j =
              q === 0
                ? px > 0
                  ? i - 1
                  : -1
                : q === 1
                  ? px < W - 1
                    ? i + 1
                    : -1
                  : q === 2
                    ? py > 0
                      ? i - W
                      : -1
                    : py < H - 1
                      ? i + W
                      : -1;
            if (j < 0 || img.data[j * 4 + 3]! !== 255) continue;
            markI.push(i);
            markC.push(inkOf(packAt(img, j * 4)));
            break;
          }
        }
      }
      for (let k = 0; k < markI.length; k++) put(img, markI[k]!, markC[k]!);
    }
    return { img, night, anchor: { x: ax, y: ay } };
  }

  private grids = new Map<readonly number[], ShadowGrid>();

  /** 2D grid over sun-projected AABBs: (u − su·z, v − sv·z) is constant along a sun ray. */
  private shadowGrid(S: readonly number[]): ShadowGrid {
    let g = this.grids.get(S);
    if (g) return g;
    const [su, sv] = S as [number, number];
    const boxes: Array<[number, number, number, number]> = [];
    let a0 = Infinity;
    let a1 = -Infinity;
    let b0 = Infinity;
    let b1 = -Infinity;
    for (const p of this.prims) {
      const [u0, u1, v0, v1, z0, z1] = p.aabb;
      const as = [u0 - su * z0, u0 - su * z1, u1 - su * z0, u1 - su * z1];
      const bs = [v0 - sv * z0, v0 - sv * z1, v1 - sv * z0, v1 - sv * z1];
      const bx: [number, number, number, number] = [
        Math.min(...as),
        Math.max(...as),
        Math.min(...bs),
        Math.max(...bs),
      ];
      boxes.push(bx);
      if (!p.cast) continue;
      a0 = Math.min(a0, bx[0]);
      a1 = Math.max(a1, bx[1]);
      b0 = Math.min(b0, bx[2]);
      b1 = Math.max(b1, bx[3]);
    }
    const cell = 0.25;
    if (!isFinite(a0)) {
      a0 = 0;
      a1 = 1;
      b0 = 0;
      b1 = 1;
    }
    const nw = Math.max(1, Math.ceil((a1 - a0) / cell) + 1);
    const nh = Math.max(1, Math.ceil((b1 - b0) / cell) + 1);
    const cells: number[][] = Array.from({ length: nw * nh }, () => []);
    this.prims.forEach((p, k) => {
      if (!p.cast) return;
      const bx = boxes[k]!;
      const ia0 = Math.floor((bx[0] - a0) / cell);
      const ia1 = Math.floor((bx[1] - a0) / cell);
      const ib0 = Math.floor((bx[2] - b0) / cell);
      const ib1 = Math.floor((bx[3] - b0) / cell);
      for (let ib = ib0; ib <= ib1; ib++) for (let ia = ia0; ia <= ia1; ia++) cells[ib * nw + ia]!.push(k);
    });
    g = { a0, b0, cell, nw, nh, cells, su, sv };
    this.grids.set(S, g);
    return g;
  }

  /** Is the point (u,v,z) shadowed along sun direction S by any other prim? */
  private occluded(self: number, u: number, v: number, z: number, S: readonly number[]): boolean {
    const [du, dv, dz] = S as [number, number, number];
    const g = this.shadowGrid(S);
    const ia = Math.floor((u - g.su * z - g.a0) / g.cell);
    const ib = Math.floor((v - g.sv * z - g.b0) / g.cell);
    if (ia < 0 || ib < 0 || ia >= g.nw || ib >= g.nh) return false;
    const list = g.cells[ib * g.nw + ia]!;
    const prims = this.prims;
    for (let n = 0; n < list.length; n++) {
      const k = list[n]!;
      if (k === self) continue;
      const p = prims[k]!;
      if (p.aabb[5] <= z) continue; // entirely below
      const h = intersect(p, u, v, z, du, dv, dz);
      if (!h || h.t1 <= 1e-3) continue;
      if (p.cut) {
        // Sample the entry point; lattice holes let light through.
        const tt = Math.max(h.t0, 1e-3);
        if (p.cut(u + du * tt, v + dv * tt, z + dz * tt, h.f0)) continue;
      }
      return true;
    }
    return false;
  }

  /**
   * Cast shadow of the scene on the ground plane (z = 0), outside `skip` (tiles of ground the
   * sprite itself paints). Same canvas/anchor convention as `render`, but grown to the right
   * and downward to fit long shadows. Shadow-swatch pixels at `alpha`.
   */
  groundShadow(
    cv: Canvas,
    alpha: number,
    shadowRgb: string,
    skip?: (u: number, v: number) => boolean,
  ): { img: PixelBuffer; anchor: { x: number; y: number } } {
    let maxZ = 0;
    for (const p of this.prims) if (p.cast) maxZ = Math.max(maxZ, p.aabb[5]);
    const reach = Math.ceil(maxZ * -SUN_H[0] * 16) + 2;
    const left = 16 * cv.d + 2;
    const W = left + 16 * cv.w + reach + 2;
    const H = 8 * (cv.w + cv.d) + Math.ceil(reach / 2) + 4;
    const img = createBuffer(W, H);
    const col = resolveColor(shadowRgb, alpha);
    for (let py = 0; py < H; py++) {
      const sy = py + 0.5;
      for (let px = 0; px < W; px++) {
        const sx = px + 0.5 - left;
        const u = (sy / 8 + sx / 16) / 2;
        const v = (sy / 8 - sx / 16) / 2;
        if (u > 0 && v > 0 && u < cv.w && v < cv.d && skip?.(u, v)) continue;
        if (this.occluded(-1, u, v, 0.05, SUN_H)) put(img, py * W + px, col);
      }
    }
    return { img, anchor: { x: left, y: 0 } };
  }
}

/** Planes of an axis-aligned box. */
export function slab(
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  z0: number,
  z1: number,
): Plane[] {
  return [
    { nu: -1, nv: 0, nz: 0, c: -u0 },
    { nu: 1, nv: 0, nz: 0, c: u1 },
    { nu: 0, nv: -1, nz: 0, c: -v0 },
    { nu: 0, nv: 1, nz: 0, c: v1 },
    { nu: 0, nv: 0, nz: -1, c: -z0 },
    { nu: 0, nv: 0, nz: 1, c: z1 },
  ];
}

function packAt(buf: PixelBuffer, si: number): RGBA {
  const d = buf.data;
  return ((d[si]! << 24) | (d[si + 1]! << 16) | (d[si + 2]! << 8) | d[si + 3]!) >>> 0;
}

function put(buf: PixelBuffer, i: number, c: RGBA): void {
  const d = buf.data;
  const o = i * 4;
  d[o] = (c >>> 24) & 255;
  d[o + 1] = (c >>> 16) & 255;
  d[o + 2] = (c >>> 8) & 255;
  d[o + 3] = c & 255;
}
