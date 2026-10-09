/**
 * A tiny z-buffered iso rasterizer for building kits. Primitives are planar convex polygons in
 * tile/height space (u, v in tiles, z in px); each pixel centre is intersected with the plane and
 * handed to a texture callback with exact world coordinates, so painted modules land on faces
 * with the true 2:1 stair-step and every part (walls, roof slopes, dormers, chimneys, tanks)
 * occludes correctly. Projection matches core/iso: x = (u−v)·16, y = (u+v)·8 − z.
 *
 * Depth (larger = nearer the camera) = (u+v)·8 + z.
 */
import type { RGBA } from '../palette';
import { createBuffer, type PixelBuffer } from '../lib/pixels';

export interface V3 {
  u: number;
  v: number;
  z: number;
}

/** Texture callback: return a colour, or null for a hole (no write, no depth). */
export type Tex = (u: number, v: number, z: number, px: number, py: number) => RGBA | null;
/** Optional night-light callback (same coords); null/0 = not lit. */
export type LightTex = (u: number, v: number, z: number, px: number, py: number) => RGBA | null;

export class IsoCanvas {
  readonly img: PixelBuffer;
  readonly light: PixelBuffer;
  private readonly depth: Float32Array;
  /** Pixel position of world origin (footprint top vertex at ground, z = 0). */
  readonly ox: number;
  readonly oy: number;

  constructor(w: number, h: number, ox: number, oy: number) {
    this.img = createBuffer(w, h);
    this.light = createBuffer(w, h);
    this.depth = new Float32Array(w * h).fill(-1e9);
    this.ox = ox;
    this.oy = oy;
  }

  sx(p: V3): number {
    return this.ox + (p.u - p.v) * 16;
  }

  sy(p: V3): number {
    return this.oy + (p.u + p.v) * 8 - p.z;
  }

  /**
   * Fill a planar convex polygon (vertices in order, either winding). `bias` is added to the
   * depth so decorations drawn flush on a face win against it.
   */
  poly(pts: readonly V3[], tex: Tex, light?: LightTex, bias = 0): void {
    if (pts.length < 3) return;
    // Plane normal from the first non-degenerate triple.
    const p0 = pts[0]!;
    let nu = 0;
    let nv = 0;
    let nz = 0;
    for (let k = 1; k + 1 < pts.length && nu === 0 && nv === 0 && nz === 0; k++) {
      const a = pts[k]!;
      const b = pts[k + 1]!;
      const au = a.u - p0.u;
      const av = a.v - p0.v;
      const az = a.z - p0.z;
      const bu = b.u - p0.u;
      const bv = b.v - p0.v;
      const bz = b.z - p0.z;
      nu = av * bz - az * bv;
      nv = az * bu - au * bz;
      nz = au * bv - av * bu;
    }
    const cst = nu * p0.u + nv * p0.v + nz * p0.z;
    const den = (nu + nv) / 16 + nz;
    if (Math.abs(den) < 1e-9) return; // edge-on
    // Screen polygon + bbox.
    const xs = pts.map((p) => this.sx(p));
    const ys = pts.map((p) => this.sy(p));
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(this.img.w - 1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(this.img.h - 1, Math.ceil(Math.max(...ys)));
    const n = pts.length;
    // Orientation of the screen polygon.
    let area = 0;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      area += xs[k]! * ys[k2]! - xs[k2]! * ys[k]!;
    }
    const sgn = area >= 0 ? 1 : -1;
    const eps = 1e-7;
    const W = this.img.w;
    const data = this.img.data;
    const ldata = this.light.data;
    for (let py = minY; py <= maxY; py++) {
      const cy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5;
        let inside = true;
        for (let k = 0; k < n; k++) {
          const k2 = k === n - 1 ? 0 : k + 1;
          const ex = xs[k2]! - xs[k]!;
          const ey = ys[k2]! - ys[k]!;
          if (sgn * (ex * (cy - ys[k]!) - ey * (cx - xs[k]!)) < -eps) {
            inside = false;
            break;
          }
        }
        if (!inside) continue;
        // Ray/plane: a = (u−v), b = (u+v); x' = 16a, y' = 8b − z.
        const a = (cx - this.ox) / 16;
        const sy = cy - this.oy;
        const z = (cst - ((nu + nv) * sy) / 16 - ((nu - nv) * a) / 2) / den;
        const b = (sy + z) / 8;
        const u = (b + a) / 2;
        const v = (b - a) / 2;
        const d = (u + v) * 8 + z + bias;
        const idx = py * W + px;
        if (d < this.depth[idx]! - 1e-4) continue;
        const c = tex(u, v, z, px, py);
        if (c === null) continue;
        this.depth[idx] = d;
        const i4 = idx * 4;
        data[i4] = (c >>> 24) & 255;
        data[i4 + 1] = (c >>> 16) & 255;
        data[i4 + 2] = (c >>> 8) & 255;
        data[i4 + 3] = 255;
        const l = light ? light(u, v, z, px, py) : null;
        if (l) {
          ldata[i4] = (l >>> 24) & 255;
          ldata[i4 + 1] = (l >>> 16) & 255;
          ldata[i4 + 2] = (l >>> 8) & 255;
          ldata[i4 + 3] = 255;
        } else ldata[i4 + 3] = 0;
      }
    }
  }

  /** Axis-aligned box: draws the three camera-facing faces (top, +v "left", +u "right"). */
  box(
    u0: number,
    v0: number,
    z0: number,
    u1: number,
    v1: number,
    z1: number,
    tex: { top: Tex | null; left: Tex | null; right: Tex | null },
    bias = 0,
  ): void {
    if (tex.left) {
      this.poly(
        [
          { u: u0, v: v1, z: z1 },
          { u: u1, v: v1, z: z1 },
          { u: u1, v: v1, z: z0 },
          { u: u0, v: v1, z: z0 },
        ],
        tex.left,
        undefined,
        bias,
      );
    }
    if (tex.right) {
      this.poly(
        [
          { u: u1, v: v1, z: z1 },
          { u: u1, v: v0, z: z1 },
          { u: u1, v: v0, z: z0 },
          { u: u1, v: v1, z: z0 },
        ],
        tex.right,
        undefined,
        bias,
      );
    }
    if (tex.top) {
      this.poly(
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
  }

  /** Plot a single pixel at a world point (used for thin details: antennas, pots). */
  dot(p: V3, c: RGBA, bias = 0.5): void {
    const px = Math.floor(this.sx(p));
    const py = Math.floor(this.sy(p));
    if (px < 0 || py < 0 || px >= this.img.w || py >= this.img.h) return;
    const idx = py * this.img.w + px;
    const d = (p.u + p.v) * 8 + p.z + bias;
    if (d < this.depth[idx]!) return;
    this.depth[idx] = d;
    const i4 = idx * 4;
    this.img.data[i4] = (c >>> 24) & 255;
    this.img.data[i4 + 1] = (c >>> 16) & 255;
    this.img.data[i4 + 2] = (c >>> 8) & 255;
    this.img.data[i4 + 3] = 255;
    this.light.data[i4 + 3] = 0;
  }

  /** Vertical screen line from a world point upward `h` px (poles, antennas). */
  pole(p: V3, h: number, c: RGBA, bias = 0.5): void {
    for (let k = 0; k < h; k++) this.dot({ u: p.u, v: p.v, z: p.z + k }, c, bias);
  }
}
