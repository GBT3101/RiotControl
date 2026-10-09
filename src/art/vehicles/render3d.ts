/**
 * Vehicle model renderer (M4c).
 *
 * Vehicles must exist in 8 (tank turret: 16) consistent directions with independent turrets,
 * pitch/bank variants and wreck/overturned states. Drawing all of that by hand would never stay
 * consistent, so vehicles are authored as **hand-placed primitive assemblies** (boxes with
 * chamfer/clip planes, cylinders, ellipsoids — think kit-bashed miniatures, every panel, lamp,
 * sandbag and antenna placed by hand) and rasterised with a tiny orthographic ray caster that
 * produces *pixel art*, not a 3D render:
 *
 * - exactly one sample per pixel at pixel centres (no anti-aliasing, no blending);
 * - shading is **quantised to ramp steps** by face orientation (top lightest, left face mid,
 *   right face darkest — sun from the upper left), with hue-shifted RIOT-64 ramps per material;
 * - clean-up passes a pixel artist would do by hand: lit-edge highlights on convex top edges,
 *   sel-out contour lines where one part passes in front of another, orphan-pixel removal,
 *   coloured exterior outline, and a two-tone-free blob cast shadow to the lower right;
 * - hand-drawn 2D details (stencil text, flames, muzzle flashes, smoke) are stamped onto faces
 *   or depth-tested billboards from `*.grid.ts` sheets.
 *
 * Coordinates
 * - **world**: (a, b, z) where +a = tile +i (screen SE), +b = tile +j (screen SW), z up.
 *   One unit = one world pixel along the screen projection: sx = a − b, sy = (a + b)/2 − z.
 *   A tile edge is 16 units long; one storey (10 px) is 10 units tall.
 * - **model**: x forward, y to the vehicle's right, z up; origin = ground centre of the vehicle.
 *   A yaw of θ maps forward to (cos θ, sin θ) in (a, b): 0° = SE, 45° = S, 90° = SW, 135° = W,
 *   180° = NW, 225° = N, 270° = NE, 315° = E.
 */
import { SHADOW, SHADOW_ALPHA, SWATCHES, hexToRgba, type RGBA, type SwatchName } from '../palette';
import { createBuffer, opaqueBounds, crop, type PixelBuffer, type Point } from '../lib/pixels';

export type V3 = readonly [number, number, number];
type M3 = readonly number[]; // 3×3 row-major

// ---------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------

export interface Material {
  /** Darkest → lightest swatches. */
  ramp: readonly SwatchName[];
  /** Ramp step used by a "left face" (lit vertical face). Top = base+1, right face = base−1. */
  base: number;
  /** Exterior outline / contour colour next to this material (default: ramp[0] or ink). */
  ol?: SwatchName;
  /** Unshaded (lamps, flames, emissive paint). */
  flat?: boolean;
  /** Allow the +2 specular step on strongly lit curved surfaces. */
  spec?: boolean;
  /** No lit-edge highlight pass. */
  noEdge?: boolean;
  /** No sel-out contour drawn on this material. */
  noContour?: boolean;
  /** Thin parts (antennae, rails): no exterior outline around them. */
  noOutline?: boolean;
}

export type MatTable = Readonly<Record<string, Material>>;

/**
 * Paint callback: material key for a hit at local point `p` with local normal `n`
 * (`m` = the same point in model space), or undefined to keep the primitive's material.
 */
export type Paint = (p: V3, n: V3, m: V3) => string | undefined;

// ---------------------------------------------------------------------------------------------
// Maths
// ---------------------------------------------------------------------------------------------

const D2R = Math.PI / 180;
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function rotX(deg: number): M3 {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  // Roll: positive = right side (+y) goes down.
  return [1, 0, 0, 0, c, s, 0, -s, c];
}
export function rotY(deg: number): M3 {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  // Pitch: positive = nose (+x) goes down.
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
export function rotZ(deg: number): M3 {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  // Yaw: forward (1,0) → (cos, sin).
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
export function mul(a: M3, b: M3): M3 {
  const o = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[r * 3 + k]! * b[k * 3 + c]!;
      o[r * 3 + c] = s;
    }
  return o;
}
export function apply(m: M3, v: V3): [number, number, number] {
  return [
    m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2],
    m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2],
    m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2],
  ];
}
function applyT(m: M3, v: V3): [number, number, number] {
  return [
    m[0]! * v[0] + m[3]! * v[1] + m[6]! * v[2],
    m[1]! * v[0] + m[4]! * v[1] + m[7]! * v[2],
    m[2]! * v[0] + m[5]! * v[1] + m[8]! * v[2],
  ];
}
function norm(v: V3): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Shading light (towards the light, world a/b/z): upper-left sun. */
const LIGHT = norm([-0.25, 0.45, 0.85]);
/** Ground-shadow ray (towards the light): shadows fall right & slightly down on screen. */
const SHADOW_DIR: V3 = [-0.5, -0.05, 1];

function shadeOffset(k: number, spec: boolean): number {
  if (spec && k > 0.95) return 2;
  if (k > 0.62) return 1;
  if (k > 0.1) return 0;
  if (k > -0.38) return -1;
  return -2;
}

// ---------------------------------------------------------------------------------------------
// Model authoring
// ---------------------------------------------------------------------------------------------

interface Plane {
  n: V3;
  d: number;
}

type Shape =
  | { kind: 'box'; h: V3 }
  | { kind: 'cyl'; r: number; hl: number; axis: 0 | 1 | 2 }
  | { kind: 'ell'; r: V3 };

export interface Prim {
  shape: Shape;
  mat: string;
  /** local → model rotation. */
  R: M3;
  /** Prim centre in model space. */
  T: V3;
  /** Clip planes in local space (inside: n·p ≤ d). */
  clips: Plane[];
  paint?: Paint;
  tag?: string;
}

/** Chainable handle on the last created primitive. */
export class PrimHandle {
  constructor(readonly prim: Prim) {}
  /** Rotate around the primitive centre (apply before `cut`). Axis in model space. */
  rot(axis: 'x' | 'y' | 'z', deg: number): this {
    const r = axis === 'x' ? rotX(deg) : axis === 'y' ? rotY(deg) : rotZ(deg);
    this.prim.R = mul(r, this.prim.R);
    return this;
  }
  /** Keep the half-space n·p ≤ n·at (model space; n points *out of* the kept solid). */
  cut(n: V3, at: V3): this {
    const nn = norm(n);
    const nl = applyT(this.prim.R, nn);
    const rel = applyT(this.prim.R, [at[0] - this.prim.T[0], at[1] - this.prim.T[1], at[2] - this.prim.T[2]]);
    const d = nl[0] * rel[0] + nl[1] * rel[1] + nl[2] * rel[2];
    this.prim.clips.push({ n: nl, d });
    return this;
  }
  /**
   * Chamfer edges of a box: `top` cuts the 4 top edges, `vert` the 4 vertical edges,
   * `bottom` the 4 bottom edges, by `c` units (45°).
   */
  bevel(c: number, which: { top?: boolean; vert?: boolean; bottom?: boolean; front?: boolean } = { top: true }): this {
    const s = this.prim.shape;
    if (s.kind !== 'box') return this;
    const [hx, hy, hz] = s.h;
    const add = (n: V3, d: number): void => {
      const l = Math.hypot(n[0], n[1], n[2]);
      this.prim.clips.push({ n: [n[0] / l, n[1] / l, n[2] / l], d: d / l });
    };
    if (which.top) {
      add([1, 0, 1], hx + hz - c);
      add([-1, 0, 1], hx + hz - c);
      add([0, 1, 1], hy + hz - c);
      add([0, -1, 1], hy + hz - c);
    }
    if (which.front) {
      add([1, 0, 1], hx + hz - c);
      add([1, 1, 0], hx + hy - c);
      add([1, -1, 0], hx + hy - c);
    }
    if (which.bottom) {
      add([1, 0, -1], hx + hz - c);
      add([-1, 0, -1], hx + hz - c);
      add([0, 1, -1], hy + hz - c);
      add([0, -1, -1], hy + hz - c);
    }
    if (which.vert) {
      add([1, 1, 0], hx + hy - c);
      add([1, -1, 0], hx + hy - c);
      add([-1, 1, 0], hx + hy - c);
      add([-1, -1, 0], hx + hy - c);
    }
    return this;
  }
  paint(fn: Paint): this {
    this.prim.paint = fn;
    return this;
  }
  tag(t: string): this {
    this.prim.tag = t;
    return this;
  }
}

/** A 2D stamp drawn flat onto a model face (stencils, text, stripes). */
export interface Decal {
  /** Top-left texel position on the face (model space). */
  at: V3;
  /** Outward face normal (model space). */
  n: V3;
  /** Reading direction along the face (model space, horizontal; default: derived from n). */
  u?: V3;
  img: PixelBuffer;
  /** Only draw on pixels whose primitive has this tag. */
  onTag?: string;
}

/** A depth-tested camera-facing 2D overlay (flames, muzzle flashes, smoke). */
export interface Overlay {
  at: V3;
  img: PixelBuffer;
  /** Pixel of `img` placed on the projected point. */
  origin: Point;
  /** Extra screen offset in px (wind drift, rising smoke). */
  dx?: number;
  dy?: number;
  /** Skip the depth test (always on top). */
  front?: boolean;
  /** Drawn before the outline pass (gets outlined with the vehicle). */
  outlined?: boolean;
}

/** Default reading direction on a vertical face with outward normal n. */
function decalU(n: V3): V3 {
  return [n[1], -n[0], 0];
}

export class Model {
  readonly prims: Prim[] = [];
  readonly decals: Decal[] = [];
  readonly overlays: Overlay[] = [];

  /** Axis-aligned box from min corner to max corner (model space). */
  box(mat: string, min: V3, max: V3): PrimHandle {
    const T: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const h: V3 = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
    return this.push({ shape: { kind: 'box', h }, mat, R: I3, T, clips: [] });
  }
  /** Box by centre + size. */
  boxc(mat: string, c: V3, size: V3): PrimHandle {
    return this.box(mat, [c[0] - size[0] / 2, c[1] - size[1] / 2, c[2] - size[2] / 2], [c[0] + size[0] / 2, c[1] + size[1] / 2, c[2] + size[2] / 2]);
  }
  /** Cylinder: centre, radius, length along `axis` (model axis before any rot). */
  cyl(mat: string, c: V3, r: number, len: number, axis: 'x' | 'y' | 'z'): PrimHandle {
    const ax = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    return this.push({ shape: { kind: 'cyl', r, hl: len / 2, axis: ax }, mat, R: I3, T: c, clips: [] });
  }
  ell(mat: string, c: V3, r: V3): PrimHandle {
    return this.push({ shape: { kind: 'ell', r }, mat, R: I3, T: c, clips: [] });
  }
  decal(d: Decal): this {
    this.decals.push(d);
    return this;
  }
  overlay(o: Overlay): this {
    this.overlays.push(o);
    return this;
  }
  /** Append all parts of another model, transformed (rotation about origin, then offset). */
  add(other: Model, offset: V3 = [0, 0, 0], R: M3 = I3): this {
    for (const p of other.prims) {
      const T = apply(R, p.T);
      this.prims.push({ ...p, R: mul(R, p.R), T: [T[0] + offset[0], T[1] + offset[1], T[2] + offset[2]], clips: p.clips });
    }
    for (const d of other.decals) {
      const at = apply(R, d.at);
      const u = d.u ?? decalU(d.n);
      this.decals.push({ ...d, at: [at[0] + offset[0], at[1] + offset[1], at[2] + offset[2]], n: apply(R, d.n), u: apply(R, u) });
    }
    for (const o of other.overlays) {
      const at = apply(R, o.at);
      this.overlays.push({ ...o, at: [at[0] + offset[0], at[1] + offset[1], at[2] + offset[2]] });
    }
    return this;
  }
  private push(p: Prim): PrimHandle {
    this.prims.push(p);
    return new PrimHandle(p);
  }
}

// ---------------------------------------------------------------------------------------------
// View & projection
// ---------------------------------------------------------------------------------------------

export interface View {
  /** Degrees; see header (0 = SE, 45 = S, …). */
  yaw: number;
  /** Nose-down pitch (degrees). */
  pitch?: number;
  /** Right-side-down roll (degrees). */
  roll?: number;
  /** World offset of the model origin (z = altitude). */
  offset?: V3;
  /** Pixels per unit (default 1). */
  scale?: number;
}

function viewMatrix(v: View): M3 {
  return mul(rotZ(v.yaw), mul(rotY(v.pitch ?? 0), rotX(v.roll ?? 0)));
}

/** Model point → world. */
export function toWorld(p: V3, v: View): [number, number, number] {
  const w = apply(viewMatrix(v), p);
  const o = v.offset ?? [0, 0, 0];
  return [w[0] + o[0], w[1] + o[1], w[2] + o[2]];
}

/** World point → screen offset (px, float) from the anchor (world origin). */
export function worldToScreen(w: V3, scale = 1): { x: number; y: number } {
  return { x: (w[0] - w[1]) * scale, y: ((w[0] + w[1]) / 2 - w[2]) * scale };
}

/** Model point → screen offset (float px) relative to the model origin's pixel. */
export function project(p: V3, v: View): { x: number; y: number } {
  return worldToScreen(toWorld(p, v), v.scale ?? 1);
}

/** Integer pixel offset of a model point (round half away consistently). */
export function projectPx(p: V3, v: View): Point {
  const s = project(p, v);
  return { x: Math.round(s.x), y: Math.round(s.y) };
}

// ---------------------------------------------------------------------------------------------
// Ray casting
// ---------------------------------------------------------------------------------------------

interface Compiled {
  prim: Prim;
  /** local → world rotation and world translation of the local origin. */
  M: M3;
  W: V3;
  /** Ray direction in local space (constant per render). */
  dl: V3;
  /** Shadow ray direction in local space. */
  sl: V3;
  /** Screen bbox (pixels, relative to anchor). */
  bx0: number;
  bx1: number;
  by0: number;
  by1: number;
  rad: number;
}

const EPS = 1e-9;

/** Returns exit t and writes local normal into `nOut`, or NaN on miss. */
function intersect(c: Compiled, o: V3, d: V3, nOut: number[]): number {
  const s = c.prim.shape;
  let tin = -Infinity;
  let tout = Infinity;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  if (s.kind === 'box') {
    for (let i = 0; i < 3; i++) {
      const di = d[i]!;
      const oi = o[i]!;
      const hi = s.h[i]!;
      if (Math.abs(di) < EPS) {
        if (oi < -hi || oi > hi) return NaN;
        continue;
      }
      const t1 = (-hi - oi) / di;
      const t2 = (hi - oi) / di;
      const tEnter = di > 0 ? t1 : t2;
      const tExit = di > 0 ? t2 : t1;
      if (tEnter > tin) tin = tEnter;
      if (tExit < tout) {
        tout = tExit;
        nx = i === 0 ? (di > 0 ? 1 : -1) : 0;
        ny = i === 1 ? (di > 0 ? 1 : -1) : 0;
        nz = i === 2 ? (di > 0 ? 1 : -1) : 0;
      }
    }
  } else if (s.kind === 'cyl') {
    const ax = s.axis;
    const u = ax === 0 ? 1 : 0;
    const v = ax === 2 ? 1 : 2;
    const A = d[u]! * d[u]! + d[v]! * d[v]!;
    const B = 2 * (o[u]! * d[u]! + o[v]! * d[v]!);
    const C = o[u]! * o[u]! + o[v]! * o[v]! - s.r * s.r;
    if (A < EPS) {
      if (C > 0) return NaN;
    } else {
      const disc = B * B - 4 * A * C;
      if (disc < 0) return NaN;
      const sq = Math.sqrt(disc);
      tin = (-B - sq) / (2 * A);
      tout = (-B + sq) / (2 * A);
      const pu = o[u]! + tout * d[u]!;
      const pv = o[v]! + tout * d[v]!;
      const n3 = [0, 0, 0];
      n3[u] = pu / s.r;
      n3[v] = pv / s.r;
      nx = n3[0]!;
      ny = n3[1]!;
      nz = n3[2]!;
    }
    const da = d[ax]!;
    const oa = o[ax]!;
    if (Math.abs(da) < EPS) {
      if (oa < -s.hl || oa > s.hl) return NaN;
    } else {
      const t1 = (-s.hl - oa) / da;
      const t2 = (s.hl - oa) / da;
      const tEnter = da > 0 ? t1 : t2;
      const tExit = da > 0 ? t2 : t1;
      if (tEnter > tin) tin = tEnter;
      if (tExit < tout) {
        tout = tExit;
        nx = ax === 0 ? (da > 0 ? 1 : -1) : 0;
        ny = ax === 1 ? (da > 0 ? 1 : -1) : 0;
        nz = ax === 2 ? (da > 0 ? 1 : -1) : 0;
      }
    }
  } else {
    const [rx, ry, rz] = s.r;
    const ox = o[0] / rx;
    const oy = o[1] / ry;
    const oz = o[2] / rz;
    const dx = d[0] / rx;
    const dy = d[1] / ry;
    const dz = d[2] / rz;
    const A = dx * dx + dy * dy + dz * dz;
    const B = 2 * (ox * dx + oy * dy + oz * dz);
    const C = ox * ox + oy * oy + oz * oz - 1;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return NaN;
    const sq = Math.sqrt(disc);
    tin = (-B - sq) / (2 * A);
    tout = (-B + sq) / (2 * A);
    const px = o[0] + tout * d[0];
    const py = o[1] + tout * d[1];
    const pz = o[2] + tout * d[2];
    nx = px / (rx * rx);
    ny = py / (ry * ry);
    nz = pz / (rz * rz);
  }
  for (const pl of c.prim.clips) {
    const nd = pl.n[0] * d[0] + pl.n[1] * d[1] + pl.n[2] * d[2];
    const no = pl.n[0] * o[0] + pl.n[1] * o[1] + pl.n[2] * o[2];
    if (Math.abs(nd) < EPS) {
      if (no > pl.d) return NaN;
      continue;
    }
    const t = (pl.d - no) / nd;
    if (nd > 0) {
      if (t < tout) {
        tout = t;
        nx = pl.n[0];
        ny = pl.n[1];
        nz = pl.n[2];
      }
    } else if (t > tin) tin = t;
  }
  if (tin > tout) return NaN;
  nOut[0] = nx;
  nOut[1] = ny;
  nOut[2] = nz;
  return tout;
}

function boundRadius(s: Shape): number {
  if (s.kind === 'box') return Math.hypot(s.h[0], s.h[1], s.h[2]);
  if (s.kind === 'cyl') return Math.hypot(s.r, s.hl);
  return Math.max(s.r[0], s.r[1], s.r[2]);
}

function compile(model: Model, view: View): Compiled[] {
  const V = viewMatrix(view);
  const off = view.offset ?? [0, 0, 0];
  const sc = view.scale ?? 1;
  return model.prims.map((prim) => {
    const M = mul(V, prim.R);
    const t = apply(V, prim.T);
    const W: V3 = [t[0] + off[0], t[1] + off[1], t[2] + off[2]];
    const rad = boundRadius(prim.shape);
    const c = worldToScreen(W, sc);
    let rx = rad * 1.42 * sc + 1.5;
    let ry = rad * 1.23 * sc + 1.5;
    if (prim.shape.kind === 'box') {
      // Exact projected corner extents.
      const h = prim.shape.h;
      let mx = 0;
      let my = 0;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) {
            const w = apply(M, [sx * h[0], sy * h[1], sz * h[2]]);
            const p = worldToScreen(w, sc);
            mx = Math.max(mx, Math.abs(p.x));
            my = Math.max(my, Math.abs(p.y));
          }
      rx = mx + 1.5;
      ry = my + 1.5;
    }
    return {
      prim,
      M,
      W,
      dl: applyT(M, [1, 1, 1]),
      sl: applyT(M, SHADOW_DIR),
      bx0: Math.floor(c.x - rx),
      bx1: Math.ceil(c.x + rx),
      by0: Math.floor(c.y - ry),
      by1: Math.ceil(c.y + ry),
      rad,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------------------------

export interface RenderOptions {
  /** Canvas size (big enough; `renderAnim` crops). */
  w?: number;
  h?: number;
  /** Anchor pixel = model/world origin. */
  ax?: number;
  ay?: number;
  /** Cast a ground blob shadow (default true). */
  shadow?: boolean;
  /** Draw exterior outline (default true). */
  outline?: boolean;
  /** Lit-edge highlight pass (default true). */
  edges?: boolean;
  /** Sel-out contour depth threshold (units; default 2.2; 0 = off). */
  contour?: number;
  /** Silhouette only, flattened to the ground (used for flying-vehicle shadows). */
  shadowOnly?: boolean;
}

interface Hit {
  t: Float32Array;
  prim: Int32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
  lx: Float32Array;
  ly: Float32Array;
  lz: Float32Array;
  lnx: Float32Array;
  lny: Float32Array;
  lnz: Float32Array;
}

const shadowRgba = hexToRgba(SWATCHES[SHADOW], SHADOW_ALPHA);
const swatchRgba = new Map<string, RGBA>();
export function sw(name: SwatchName): RGBA {
  let c = swatchRgba.get(name);
  if (c === undefined) {
    c = hexToRgba(SWATCHES[name]);
    swatchRgba.set(name, c);
  }
  return c;
}

function put(buf: PixelBuffer, i: number, c: RGBA): void {
  const d = buf.data;
  d[i * 4] = (c >>> 24) & 255;
  d[i * 4 + 1] = (c >>> 16) & 255;
  d[i * 4 + 2] = (c >>> 8) & 255;
  d[i * 4 + 3] = c & 255;
}

export interface Rendered {
  buf: PixelBuffer;
  anchor: Point;
  /** Per-pixel hit data (for compositing extra depth-tested overlays later). */
  hit?: Hit;
}

/**
 * Render one model in one view into a w×h canvas with the model origin at (ax, ay).
 */
export function renderModel(model: Model, mats: MatTable, view: View, opts: RenderOptions = {}): Rendered {
  const W = opts.w ?? 128;
  const H = opts.h ?? 128;
  const ax = opts.ax ?? (W >> 1);
  const ay = opts.ay ?? Math.floor(H * 0.7);
  const sc = view.scale ?? 1;
  const N = W * H;
  const hit: Hit = {
    t: new Float32Array(N).fill(-Infinity),
    prim: new Int32Array(N).fill(-1),
    nx: new Float32Array(N),
    ny: new Float32Array(N),
    nz: new Float32Array(N),
    lx: new Float32Array(N),
    ly: new Float32Array(N),
    lz: new Float32Array(N),
    lnx: new Float32Array(N),
    lny: new Float32Array(N),
    lnz: new Float32Array(N),
  };
  const comp = compile(model, view);
  const nOut = [0, 0, 0];
  const buf = createBuffer(W, H);

  if (opts.shadowOnly) {
    // Vertical footprint (flattened to the ground): ray straight up from each ground pixel.
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const sx = (px - ax) / sc;
        const sy = (py - ay) / sc;
        const a = sy + sx / 2;
        const b = sy - sx / 2;
        for (const c of comp) {
          const ra = a - c.W[0];
          const rb = b - c.W[1];
          if (ra * ra + rb * rb > c.rad * c.rad + 1) continue;
          const o = applyT(c.M, [ra, rb, -200 - c.W[2]]);
          const d = applyT(c.M, [0, 0, 1]);
          if (!Number.isNaN(intersect(c, o, d, nOut))) {
            put(buf, py * W + px, shadowRgba);
            break;
          }
        }
      }
    }
    return { buf, anchor: { x: ax, y: ay } };
  }

  // 1. Primary rays. The local ray origin is linear in the pixel coords: o = O0 + px·Ox + py·Oy.
  const o3 = [0, 0, 0] as unknown as [number, number, number];
  for (let ci = 0; ci < comp.length; ci++) {
    const c = comp[ci]!;
    const x0 = Math.max(0, ax + c.bx0);
    const x1 = Math.min(W - 1, ax + c.bx1);
    const y0 = Math.max(0, ay + c.by0);
    const y1 = Math.min(H - 1, ay + c.by1);
    const M = c.M;
    // world offset (a, b, z) for pixel: a = sy + sx/2, b = sy − sx/2 with sx = (px−ax)/sc …
    const base = applyT(M, [-ay / sc - ax / (2 * sc) - c.W[0], -ay / sc + ax / (2 * sc) - c.W[1], -c.W[2]]);
    const ox = applyT(M, [1 / (2 * sc), -1 / (2 * sc), 0]);
    const oy = applyT(M, [1 / sc, 1 / sc, 0]);
    const dl = c.dl;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        o3[0] = base[0] + px * ox[0] + py * oy[0];
        o3[1] = base[1] + px * ox[1] + py * oy[1];
        o3[2] = base[2] + px * ox[2] + py * oy[2];
        const t = intersect(c, o3, dl, nOut);
        if (t !== t) continue;
        const i = py * W + px;
        // Depth along the pixel ray = world z of the hit (rays share the z = 0 origin plane).
        if (t <= hit.t[i]!) continue;
        hit.t[i] = t;
        hit.prim[i] = ci;
        const n0 = nOut[0]!;
        const n1 = nOut[1]!;
        const n2 = nOut[2]!;
        hit.nx[i] = M[0]! * n0 + M[1]! * n1 + M[2]! * n2;
        hit.ny[i] = M[3]! * n0 + M[4]! * n1 + M[5]! * n2;
        hit.nz[i] = M[6]! * n0 + M[7]! * n1 + M[8]! * n2;
        hit.lx[i] = o3[0] + t * dl[0];
        hit.ly[i] = o3[1] + t * dl[1];
        hit.lz[i] = o3[2] + t * dl[2];
        hit.lnx[i] = n0;
        hit.lny[i] = n1;
        hit.lnz[i] = n2;
      }
    }
  }

  // 2. Materials (paint) and shading steps.
  const matKey: (string | null)[] = new Array<string | null>(N).fill(null);
  const step = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    const pi = hit.prim[i]!;
    if (pi < 0) continue;
    const prim = comp[pi]!.prim;
    let key = prim.mat;
    if (prim.paint) {
      const lp: V3 = [hit.lx[i]!, hit.ly[i]!, hit.lz[i]!];
      const mp = apply(prim.R, lp);
      const k = prim.paint(lp, [hit.lnx[i]!, hit.lny[i]!, hit.lnz[i]!], [mp[0] + prim.T[0], mp[1] + prim.T[1], mp[2] + prim.T[2]]);
      if (k) key = k;
    }
    const m = mats[key];
    if (!m) throw new Error(`render3d: unknown material "${key}"`);
    matKey[i] = key;
    const k = hit.nx[i]! * LIGHT[0] + hit.ny[i]! * LIGHT[1] + hit.nz[i]! * LIGHT[2];
    step[i] = m.flat ? m.base : m.base + shadeOffset(k, !!m.spec);
  }

  // 3. Orphan clean-up: a lone step inside a same-material, same-step 4-neighbourhood.
  const step2 = Int8Array.from(step);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const k = matKey[i];
      if (!k || mats[k]!.flat) continue;
      const pi = hit.prim[i];
      if (matKey[i - 1] !== k || matKey[i + 1] !== k || matKey[i - W] !== k || matKey[i + W] !== k) continue;
      if (hit.prim[i - 1] !== pi || hit.prim[i + 1] !== pi || hit.prim[i - W] !== pi || hit.prim[i + W] !== pi) continue;
      const s0 = step[i - 1]!;
      if (s0 !== step[i] && step[i + 1] === s0 && step[i - W] === s0 && step[i + W] === s0) step2[i] = s0;
    }
  }
  step.set(step2);

  // 4. Lit-edge highlights (convex top edges, camera-facing vertical corners).
  if (opts.edges ?? true) {
    const add = new Int8Array(N);
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const i = y * W + x;
        const k = matKey[i];
        if (!k) continue;
        const m = mats[k]!;
        if (m.flat || m.noEdge) continue;
        const below = i + W;
        // Top face pixel above a side face of the same primitive → front top edge.
        if (hit.nz[i]! > 0.7 && hit.prim[below] === hit.prim[i] && hit.nz[below]! < 0.45 && matKey[below]) {
          add[i] = 1;
          continue;
        }
        // Lit vertical face meeting a darker face to the right → corner catches light.
        const right = i + 1;
        if (
          Math.abs(hit.nz[i]!) < 0.45 &&
          hit.prim[right] === hit.prim[i] &&
          Math.abs(hit.nz[right]!) < 0.45 &&
          hit.nx[i]! * LIGHT[0] + hit.ny[i]! * LIGHT[1] >
            hit.nx[right]! * LIGHT[0] + hit.ny[right]! * LIGHT[1] + 0.25
        ) {
          add[i] = 1;
        }
      }
    }
    for (let i = 0; i < N; i++) if (add[i]) step[i] = step[i]! + 1;
  }

  // 5. Colour.
  const colour = (i: number): RGBA => {
    const m = mats[matKey[i]!]!;
    const s = Math.max(0, Math.min(m.ramp.length - 1, step[i]!));
    return sw(m.ramp[s]!);
  };
  for (let i = 0; i < N; i++) if (matKey[i]) put(buf, i, colour(i));

  // 6. Decals (face-bound stamps).
  for (const d of model.decals) drawDecal(buf, hit, comp, d, view, ax, ay);

  // 7. Sel-out contours: pixel behind a nearer, different part gets a dark line.
  const thr = opts.contour ?? 2.2;
  if (thr > 0) {
    const marks: number[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const k = matKey[i];
        if (!k || mats[k]!.noContour || mats[k]!.flat) continue;
        const t = hit.t[i]!;
        const pi = hit.prim[i]!;
        const near = (j: number): boolean => {
          const pj = hit.prim[j]!;
          if (pj < 0 || pj === pi) return false;
          if (mats[matKey[j]!]!.flat) return false;
          return hit.t[j]! - t > thr;
        };
        if ((x > 0 && near(i - 1)) || (x < W - 1 && near(i + 1)) || (y > 0 && near(i - W)) || (y < H - 1 && near(i + W)))
          marks.push(i);
      }
    }
    for (const i of marks) {
      const m = mats[matKey[i]!]!;
      put(buf, i, sw(m.ol ?? m.ramp[0]!));
    }
  }

  // 8. Outlined overlays, then exterior outline.
  for (const o of model.overlays) if (o.outlined) drawOverlay(buf, hit, o, view, ax, ay);
  if (opts.outline ?? true) {
    const d = buf.data;
    const markI: number[] = [];
    const markC: RGBA[] = [];
    const olOf = (j: number): RGBA | -1 => {
      if (d[j * 4 + 3] !== 255) return -1;
      const k = matKey[j];
      const m = k ? mats[k] : undefined;
      if (m?.noOutline) return -1;
      return sw(m?.ol ?? 'ink');
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (d[i * 4 + 3] === 255) continue;
        let c: RGBA | -1 = -1;
        if (x > 0) c = olOf(i - 1);
        if (c === -1 && x < W - 1) c = olOf(i + 1);
        if (c === -1 && y > 0) c = olOf(i - W);
        if (c === -1 && y < H - 1) c = olOf(i + W);
        if (c !== -1) {
          markI.push(i);
          markC.push(c);
        }
      }
    }
    for (let k = 0; k < markI.length; k++) put(buf, markI[k]!, markC[k]!);
  }

  // 9. Ground shadow (only on empty pixels): sun-cast footprint, dilated by 1 px.
  if (opts.shadow ?? true) {
    const mask = new Uint8Array(N);
    const casters = comp.filter((c) => !mats[c.prim.mat]?.noOutline);
    for (const c of casters) {
      const reach = c.rad + Math.max(0, c.W[2] + c.rad) * 0.55 + 1;
      // Ground footprint box of this caster's shadow (screen px relative to the anchor).
      const ga = c.W[0] + Math.max(0, c.W[2]) * 0.25;
      const gb = c.W[1];
      const cx = (ga - gb) * sc;
      const cy = ((ga + gb) / 2) * sc;
      const x0 = Math.max(0, Math.floor(ax + cx - reach * 1.42 * sc) - 1);
      const x1 = Math.min(W - 1, Math.ceil(ax + cx + reach * 1.42 * sc) + 1);
      const y0 = Math.max(0, Math.floor(ay + cy - reach * 0.72 * sc) - 1);
      const y1 = Math.min(H - 1, Math.ceil(ay + cy + reach * 0.72 * sc) + 1);
      const M = c.M;
      const wz = -c.W[2];
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const i = py * W + px;
          if (mask[i]) continue;
          const sx = (px - ax) / sc;
          const sy = (py - ay) / sc;
          const ra = sy + sx / 2 - c.W[0];
          const rb = sy - sx / 2 - c.W[1];
          if (ra * ra + rb * rb > reach * reach) continue;
          o3[0] = M[0]! * ra + M[3]! * rb + M[6]! * wz;
          o3[1] = M[1]! * ra + M[4]! * rb + M[7]! * wz;
          o3[2] = M[2]! * ra + M[5]! * rb + M[8]! * wz;
          const t = intersect(c, o3, c.sl, nOut);
          if (t === t) mask[i] = 1;
        }
      }
    }
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        if (buf.data[i * 4 + 3] !== 0) continue;
        const on =
          mask[i] ||
          (px > 0 && mask[i - 1]) ||
          (px < W - 1 && mask[i + 1]) ||
          (py > 0 && mask[i - W]) ||
          (py < H - 1 && mask[i + W]);
        if (on) put(buf, i, shadowRgba);
      }
    }
  }

  // 10. Free overlays (flames, flashes, smoke) — depth-tested against the vehicle.
  for (const o of model.overlays) if (!o.outlined) drawOverlay(buf, hit, o, view, ax, ay);

  return { buf, anchor: { x: ax, y: ay }, hit };
}

function drawDecal(buf: PixelBuffer, hit: Hit, comp: Compiled[], d: Decal, view: View, ax: number, ay: number): void {
  const V = viewMatrix(view);
  const nw = apply(V, d.n);
  // Face must look towards the camera.
  if (nw[0] + nw[1] + nw[2] < 0.15) return;
  const p0 = project(d.at, view);
  const du = d.u ?? decalU(d.n);
  const uEnd = project([d.at[0] + du[0], d.at[1] + du[1], d.at[2] + du[2]], view);
  const tx = uEnd.x - p0.x;
  const ty = uEnd.y - p0.y;
  if (Math.abs(tx) < 0.3) return; // seen edge-on along the reading direction
  const dir = tx > 0 ? 1 : -1;
  const slope = ty / Math.abs(tx);
  const x0 = Math.round(p0.x) + ax;
  const y0 = Math.round(p0.y) + ay;
  for (let v = 0; v < d.img.h; v++) {
    for (let u = 0; u < d.img.w; u++) {
      const si = (v * d.img.w + u) * 4;
      if (d.img.data[si + 3] !== 255) continue;
      const x = x0 + dir * u;
      const y = y0 + v + Math.round(slope * u);
      if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) continue;
      const i = y * buf.w + x;
      const pi = hit.prim[i]!;
      if (pi < 0) continue;
      if (d.onTag && comp[pi]!.prim.tag !== d.onTag) continue;
      buf.data.set(d.img.data.subarray(si, si + 4), i * 4);
    }
  }
}

function drawOverlay(buf: PixelBuffer, hit: Hit, o: Overlay, view: View, ax: number, ay: number): void {
  const w = toWorld(o.at, view);
  const sc = view.scale ?? 1;
  const s = worldToScreen(w, sc);
  const x0 = Math.round(s.x) + ax - o.origin.x + (o.dx ?? 0);
  const y0 = Math.round(s.y) + ay - o.origin.y + (o.dy ?? 0);
  for (let v = 0; v < o.img.h; v++) {
    for (let u = 0; u < o.img.w; u++) {
      const si = (v * o.img.w + u) * 4;
      const a = o.img.data[si + 3]!;
      if (a === 0) continue;
      const x = x0 + u;
      const y = y0 + v;
      if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) continue;
      const i = y * buf.w + x;
      if (!o.front && hit.prim[i]! >= 0) {
        // Billboard depth along this pixel's ray (camera-facing plane through `at`).
        const sx = (x - ax) / sc;
        const sy = (y - ay) / sc;
        const a0 = sy + sx / 2;
        const b0 = sy - sx / 2;
        const tb = (w[0] - a0 + (w[1] - b0) + w[2]) / 3;
        if (hit.t[i]! > tb + 0.5) continue;
      }
      if (a < 255 && buf.data[i * 4 + 3] !== 0) continue;
      buf.data.set(o.img.data.subarray(si, si + 4), i * 4);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Animation helper: render N frames into a big canvas, crop to the union of opaque bounds.
// ---------------------------------------------------------------------------------------------

export interface Anim {
  frames: PixelBuffer[];
  anchor: Point;
}

export function cropAnim(bufs: PixelBuffer[], anchor: Point, margin = 0): Anim {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of bufs) {
    const r = opaqueBounds(b);
    if (!r) continue;
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w - 1);
    y1 = Math.max(y1, r.y + r.h - 1);
  }
  if (!Number.isFinite(x0)) {
    x0 = anchor.x;
    y0 = anchor.y;
    x1 = anchor.x;
    y1 = anchor.y;
  }
  // Always keep the anchor inside the frame.
  x0 = Math.min(x0, anchor.x) - margin;
  y0 = Math.min(y0, anchor.y) - margin;
  x1 = Math.max(x1, anchor.x) + margin;
  y1 = Math.max(y1, anchor.y) + margin;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  return { frames: bufs.map((b) => crop(b, x0, y0, w, h)), anchor: { x: anchor.x - x0, y: anchor.y - y0 } };
}

/** Conservative screen bounds (relative to the origin pixel) of a model in a view. */
function modelBounds(model: Model, view: View, shadow: boolean): [number, number, number, number] {
  let x0 = 0;
  let y0 = 0;
  let x1 = 0;
  let y1 = 0;
  const sc = view.scale ?? 1;
  for (const c of compile(model, view)) {
    x0 = Math.min(x0, c.bx0);
    y0 = Math.min(y0, c.by0);
    let rx = c.bx1;
    let ry = c.by1;
    if (shadow) {
      const top = Math.max(0, c.W[2] + c.rad);
      rx += Math.ceil(top * 0.5 * sc) + 2;
      ry += Math.ceil((top + c.rad) * 1.3 * sc) + 2;
    }
    x1 = Math.max(x1, rx);
    y1 = Math.max(y1, ry);
  }
  for (const o of model.overlays) {
    const p = project(o.at, view);
    const ox = Math.round(p.x) - o.origin.x + (o.dx ?? 0);
    const oy = Math.round(p.y) - o.origin.y + (o.dy ?? 0);
    x0 = Math.min(x0, ox);
    y0 = Math.min(y0, oy);
    x1 = Math.max(x1, ox + o.img.w);
    y1 = Math.max(y1, oy + o.img.h);
  }
  return [x0, y0, x1, y1];
}

export function renderAnim(
  models: readonly Model[],
  mats: MatTable,
  view: View | readonly View[],
  opts: RenderOptions = {},
): Anim {
  const viewOf = (i: number): View => (Array.isArray(view) ? (view as View[])[i]! : (view as View));
  let bx0 = 0;
  let by0 = 0;
  let bx1 = 0;
  let by1 = 0;
  models.forEach((m, i) => {
    const [a, b, c, d] = modelBounds(m, viewOf(i), (opts.shadow ?? true) && !opts.shadowOnly);
    bx0 = Math.min(bx0, a);
    by0 = Math.min(by0, b);
    bx1 = Math.max(bx1, c);
    by1 = Math.max(by1, d);
  });
  const pad = 3;
  const W = opts.w ?? bx1 - bx0 + 2 * pad + 1;
  const H = opts.h ?? by1 - by0 + 2 * pad + 1;
  const ax = opts.ax ?? pad - bx0;
  const ay = opts.ay ?? pad - by0;
  const bufs = models.map((m, i) => renderModel(m, mats, viewOf(i), { ...opts, w: W, h: H, ax, ay }).buf);
  return cropAnim(bufs, { x: ax, y: ay });
}

/**
 * Static geometry + animated overlays (wrecks, burning shells): the model is rasterised once and
 * each frame only composites its own depth-tested overlays (flames, smoke).
 */
export function renderFx(
  base: Model,
  frameOverlays: readonly (readonly Overlay[])[],
  mats: MatTable,
  view: View,
  opts: RenderOptions = {},
): Anim {
  const probe = new Model();
  probe.prims.push(...base.prims);
  probe.overlays.push(...base.overlays, ...frameOverlays.flat());
  const [bx0, by0, bx1, by1] = modelBounds(probe, view, (opts.shadow ?? true) && !opts.shadowOnly);
  const pad = 3;
  const W = bx1 - bx0 + 2 * pad + 1;
  const H = by1 - by0 + 2 * pad + 1;
  const ax = pad - bx0;
  const ay = pad - by0;
  const r = renderModel(base, mats, view, { ...opts, w: W, h: H, ax, ay });
  const bufs = frameOverlays.map((ovs) => {
    const b = { w: r.buf.w, h: r.buf.h, data: new Uint8ClampedArray(r.buf.data) };
    for (const o of ovs) drawOverlay(b, r.hit!, o, view, ax, ay);
    return b;
  });
  return cropAnim(bufs, { x: ax, y: ay });
}
