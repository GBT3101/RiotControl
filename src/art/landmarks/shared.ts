/**
 * Shared pieces of the secondary landmarks (plates, paving, fountain basins and jets, classical
 * palace walls). City landmark builders live in src/art/landmarks/<city>/landmarks.ts.
 */
import type { Scene, Material } from './engine/scene';
import { R, hash, lv, mod, mod_, type Ramp5 } from './engine/materials';
import { paintWindow } from './engine/kit';
import type { Build } from './types';

export interface SecondaryArt {
  /** Pixels above the anchor. */
  top: number;
  frames: number;
  fps: number;
  /** Extra canvas px on the left/right (wide wheels). */
  side?: number;
  build: (frame: number) => Build;
}

export function plate(s: Scene, w: number, d: number, mat: Material): void {
  s.box(0, w, 0, d, 0, 1, mat, { cast: false, tag: 'ground' });
}

export const paving: Material = (c) => {
  if (c.night) return null;
  if (c.side !== 'top') return lv(R.granite, c.level - 1);
  const ju = mod(c.u * 4, 1) < 0.07;
  const jv = mod(c.v * 4, 1) < 0.14;
  return lv(R.paving, c.level - (ju || jv ? 1 : 0));
};

export const gravel: Material = (c) => {
  if (c.night) return null;
  if (c.side !== 'top') return lv(R.gravel, c.level - 1);
  return lv(R.gravel, c.level - (hash(c.px >> 1, c.py) < 0.12 ? 1 : 0));
};

/** Animated water surface with concentric ripples around (cu, cv). */
export function water(cu: number, cv: number, frame: number, n: number): Material {
  return (c) => {
    const d = Math.hypot((c.u - cu) * 1.0, c.v - cv);
    const ring = mod(Math.floor(d * 9 - (frame / n) * 3), 3);
    const spark = hash(c.px, c.py, Math.floor(frame / 2)) < 0.025;
    if (c.night) return spark || ring === 0 ? 'teal1' : null;
    if (c.side !== 'top') return lv(R.water, c.level - 1);
    if (spark) return 'white';
    if (ring === 0) return lv(R.water, 3);
    return lv(R.water, 2);
  };
}

/** Round basin: stone rim ring with water inside. */
export function basin(
  s: Scene,
  cu: number,
  cv: number,
  rOut: number,
  rIn: number,
  zRim: number,
  frame: number,
  n: number,
  ramp: Ramp5 = R.granite,
): void {
  const rim: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'back') return lv(ramp, c.level - 1);
    if (c.edge) return ramp[0];
    if (c.side === 'top') return lv(ramp, 4);
    return c.fz >= zRim - 1 ? lv(ramp, c.level + 1) : lv(ramp, c.level);
  };
  s.cyl(cu, cv, rOut, 0, zRim, rim, {
    cut: (u, v, _z, f) => f === 1 && Math.hypot(u - cu, v - cv) < rIn,
  });
  s.cyl(cu, cv, rIn + 0.02, 0, zRim - 2, water(cu, cv, frame, n), { cast: false });
}

/** A parabolic water jet from p0 to p1 (peak `lift` px above), dashed by frame. */
export function jet(
  s: Scene,
  p0: [number, number, number],
  p1: [number, number, number],
  lift: number,
  frame: number,
): void {
  const N = 14;
  const pts: Array<[number, number, number]> = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    pts.push([
      p0[0] + (p1[0] - p0[0]) * t,
      p0[1] + (p1[1] - p0[1]) * t,
      p0[2] + (p1[2] - p0[2]) * t + lift * 4 * t * (1 - t),
    ]);
  }
  for (let k = 0; k < N; k++) {
    const on = mod(k + frame, 4) !== 3;
    if (!on) continue;
    s.line([pts[k]!, pts[k + 1]!], mod(k + frame, 4) === 0 ? 'white' : 'sky', {
      emit: 'sky',
      bias: 0.05,
    });
  }
}

/** Classical wall material with a simple window rhythm (used for palaces / blocks). */
export function classicalWall(o: {
  ramp: Ramp5;
  pitch: number;
  off: number;
  rows: number[];
  top: number;
  base?: number;
  winRamp?: Ramp5;
}): Material {
  const r = o.ramp;
  const WIN = mod_(
    `
    .PPP.
    PpppP
    FgGgF
    FgggF
    FmmmF
    FgGgF
    FgggF
    FgggF
    sssss
    `,
    {
      P: { r, d: 1 },
      p: { r, d: -2 },
      F: { r, d: 1 },
      g: R.dark,
      G: { r: R.glass, d: 0 },
      m: { r, d: -1 },
      s: { r, d: 1 },
    },
    { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
  );
  return (c) => {
    if (c.side === 'top') return c.night ? null : lv(r, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const bay = mod(c.fx - o.off, o.pitch);
    for (const zt of o.rows) {
      const p = paintWindow(WIN, c, c.fx - bay, zt, 'ok');
      if (p !== undefined) return p;
    }
    if (c.night) return null;
    if (c.edge) return r[0];
    const z = c.fz;
    if (z >= o.top - 2) return lv(r, c.level + 1);
    if (z === o.top - 3) return lv(r, c.level - 1);
    if (o.base && z < o.base) return mod(z, 3) === 0 ? lv(r, c.level - 1) : lv(r, c.level);
    if (o.base && z === o.base) return lv(r, c.level + 1);
    return lv(r, c.level);
  };
}
