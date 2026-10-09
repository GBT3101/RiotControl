/**
 * Reusable hand-built vehicle parts (wheels, sandbags, jerry cans, antennae, crew figures).
 * Units: world pixels (see render3d.ts). Model axes: x forward, y right, z up.
 */
import { Model, type V3 } from './render3d';

export interface WheelOpts {
  /** Tread phase 0..1 (one tread pitch) — animate per drive frame. */
  phase?: number;
  tread?: number;
  hub?: string;
  hubR?: number;
  tyre?: string;
  /** Burnt rim only (no rubber). */
  rimOnly?: boolean;
}

/** Tyre (cylinder along y) with rotating tread blocks and a hub with bolts. */
export function wheel(m: Model, c: V3, r: number, width: number, o: WheelOpts = {}): void {
  const blocks = o.tread ?? 10;
  const phase = (o.phase ?? 0) * ((2 * Math.PI) / blocks);
  const hubR = o.hubR ?? r * 0.52;
  const hub = o.hub ?? 'oliveDk';
  if (o.rimOnly) {
    m.cyl('char', c, hubR + 0.4, width * 0.8, 'y');
    return;
  }
  m.cyl(o.tyre ?? 'tyre', c, r, width, 'y').paint((p, n) => {
    // Side wall: hub disc + bolts.
    if (Math.abs(n[1]) > 0.5) {
      const d = Math.hypot(p[0], p[2]);
      if (d < hubR * 0.38) return 'steel';
      if (d < hubR) {
        const a = Math.atan2(p[2], p[0]) + phase * 0.6;
        const bolt = Math.abs(Math.sin(a * 3)) > 0.86 && d > hubR * 0.55;
        return bolt ? 'steel' : hub;
      }
      return undefined;
    }
    // Tread: alternating lug blocks around the circumference.
    const a = Math.atan2(p[2], p[0]) + phase;
    const k = Math.floor((a / (2 * Math.PI)) * blocks * 2 + 1000);
    return k % 2 === 0 ? 'rubber' : undefined;
  });
}

/** Sandbag: squashed ellipsoid lying along x (or y when `across`). */
export function sandbag(m: Model, c: V3, across = false, dark = false): void {
  const r: V3 = across ? [1.2, 1.9, 0.85] : [1.9, 1.2, 0.85];
  m.ell(dark ? 'sandbagDk' : 'sandbag', c, r).paint((p) => {
    // Tied end seam.
    const along = across ? p[1] : p[0];
    return Math.abs(along) > (across ? 1.45 : 1.45) ? 'sandbagDk' : undefined;
  });
}

/** Red jerry can standing upright, facing ±x. */
export function jerryCan(m: Model, c: V3, mat = 'jerry'): void {
  m.boxc(mat, c, [1.1, 1.8, 2.4])
    .bevel(0.3, { top: true, vert: true })
    .paint((p, n) => (Math.abs(n[0]) > 0.5 && Math.abs(p[1]) < 0.2 && Math.abs(p[2]) < 0.8 ? 'jerryDk' : undefined));
  m.boxc('steel', [c[0], c[1] - 0.5, c[2] + 1.35], [0.6, 0.5, 0.4]);
}

/** Whip antenna: a 1-px line from `base` up `len`, leaning back by `lean`°. */
export function antenna(m: Model, base: V3, len: number, lean = 8): void {
  m.boxc('dark', [base[0], base[1], base[2] + 0.5], [0.9, 0.9, 1]);
  const r = (lean * Math.PI) / 180;
  m.boxc('wire', [base[0] - Math.sin(r) * len * 0.5, base[1], base[2] + (Math.cos(r) * len) / 2], [0.8, 0.8, len]).rot('y', -lean);
  m.ell('wire', [base[0] - Math.sin(r) * len, base[1], base[2] + Math.cos(r) * len], [0.45, 0.45, 0.45]);
}

export interface CrewOpts {
  helmet?: string;
  body?: string;
  skin?: string;
  goggles?: boolean;
  /** Arms reach forward to x (grips). */
  gripX?: number;
  gripZ?: number;
  headset?: boolean;
  beret?: boolean;
  /** 20% bigger (gunners that must read at 1×). */
  big?: boolean;
  /** No arms (commander leaning on the hatch rim). */
  noArms?: boolean;
}

/**
 * Crew figure from the waist up, facing +x, standing at (x, y) with waist at z.
 * Chunky KR proportions: big helmet, small torso.
 */
export function crew(m: Model, at: V3, o: CrewOpts = {}): void {
  const [x, y, z] = at;
  const k = o.big ? 1.2 : 1;
  const body = o.body ?? 'oliveDk';
  const skin = o.skin ?? 'skin';
  // Torso (vest) with shoulders.
  m.box(body, [x - 1.1 * k, y - 1.7 * k, z], [x + 1.0 * k, y + 1.7 * k, z + 3.4 * k]).bevel(0.5, { top: true });
  // Arms to the grips.
  if (!o.noArms) {
    const gx = o.gripX ?? x + 2.2;
    const gz = o.gripZ ?? z + 2.6;
    for (const s of [-1, 1]) {
      m.box(body, [x - 0.4, y + s * 1.7 * k - 0.6, gz - 0.6], [gx, y + s * 1.7 * k + 0.6, gz + 0.5]);
      m.boxc(skin, [gx + 0.2, y + s * 1.2 * k, gz], [0.9, 1.0, 0.9]);
    }
  }
  // Head.
  const hz = z + 3.4 * k + 1.2 * k;
  m.ell(skin, [x + 0.15, y, hz], [1.35 * k, 1.35 * k, 1.35 * k]).paint((p) =>
    o.goggles && p[0] > 0.55 * k && p[2] > -0.15 * k && p[2] < 0.55 * k ? 'visor' : undefined,
  );
  if (o.beret) {
    m.ell(o.helmet ?? 'navyCloth', [x - 0.1, y + 0.2, hz + 1.0 * k], [1.5 * k, 1.6 * k, 0.7 * k]);
    if (o.headset) m.boxc('dark', [x, y - 1.45 * k, hz + 0.1], [0.9, 0.6, 1.2]);
    return;
  }
  // Helmet: dome with brim, a hi-vis band on navy helmets.
  const hm = o.helmet ?? 'helmetNavy';
  m.ell(hm, [x - 0.05, y, hz + 0.55 * k], [1.95 * k, 1.85 * k, 1.6 * k])
    .cut([0, 0, -1], [0, 0, hz + 0.15 * k])
    .paint((p) => (hm === 'helmetNavy' && p[2] > -0.3 * k && p[2] < 0.15 * k ? 'hivis' : undefined));
  if (o.headset) m.boxc('dark', [x, y - 1.9 * k, hz + 0.2], [0.8, 0.5, 1]);
}
