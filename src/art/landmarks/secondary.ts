/**
 * Secondary landmarks (LANDMARKS in src/maps/contract.ts) at their contract footprints.
 * Each builder returns a Scene for one animation frame (fountains / the London Eye animate;
 * the rest are static). Registration: `lm.<id>` (+ `.night`, `.shadow`).
 */
import { SHADOW, SHADOW_ALPHA } from '../palette';
import type { SpriteRegistry } from '../lib/registry';
import { LANDMARKS, type LandmarkId } from '../../maps/contract';
import { Scene, type Material, type ShadeCtx } from './engine/scene';
import { R, hash, lv, mod, plain, type Ramp5 } from './engine/materials';
import { balustradeCut, column, gothicWall, lancet, paintWindow, project, roofMat, stairs, stepMat, textGrid } from './engine/kit';
import { mod_ } from './engine/materials';
import type { Build, Overlay } from './types';
import {
  CERVANTES,
  CHURCHILL,
  CIBELES,
  LION,
  NELSON,
  NEPTUNE,
  VICTORY,
  figure,
  guard,
  lamp,
  marbleStatue,
} from './props';
import { grid } from '../lib/grid';

export interface SecondaryArt {
  /** Pixels above the anchor. */
  top: number;
  frames: number;
  fps: number;
  /** Extra canvas px on the left/right (wide wheels). */
  side?: number;
  build: (frame: number) => Build;
}

// ---------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------

function plate(s: Scene, w: number, d: number, mat: Material): void {
  s.box(0, w, 0, d, 0, 1, mat, { cast: false, tag: 'ground' });
}

const paving: Material = (c) => {
  if (c.night) return null;
  if (c.side !== 'top') return lv(R.granite, c.level - 1);
  const ju = mod(c.u * 4, 1) < 0.07;
  const jv = mod(c.v * 4, 1) < 0.14;
  return lv(R.paving, c.level - (ju || jv ? 1 : 0));
};

const gravel: Material = (c) => {
  if (c.night) return null;
  if (c.side !== 'top') return lv(R.gravel, c.level - 1);
  return lv(R.gravel, c.level - (hash(c.px >> 1, c.py) < 0.12 ? 1 : 0));
};

/** Animated water surface with concentric ripples around (cu, cv). */
function water(cu: number, cv: number, frame: number, n: number): Material {
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
function basin(
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
function jet(
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
    s.line([pts[k]!, pts[k + 1]!], mod(k + frame, 4) === 0 ? 'white' : 'sky', { emit: 'sky', bias: 0.05 });
  }
}

/** Classical wall material with a simple window rhythm (used for palaces / blocks). */
function classicalWall(o: {
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

// ---------------------------------------------------------------------------------------------
// Madrid
// ---------------------------------------------------------------------------------------------

function cibeles(frame: number): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  basin(s, 1.5, 1.5, 1.38, 1.22, 5, frame, 4, R.granite);
  // Rock base and the marble group.
  s.hip(1.0, 2.0, 1.1, 1.9, 2, 9, 0.3, plain(R.marble));
  s.sprite(figure(CIBELES, 'marble', 'cibeles'), 17, 21, 1.55, 1.55, 9);
  // Sceptre.
  s.line([[1.62, 1.35, 20], [1.62, 1.35, 33]], 'gray5', { bias: 0.3 });
  // Jets from the lions' mouths and the basin edge.
  jet(s, [1.05, 1.95, 12], [0.55, 2.35, 3], 6, frame);
  jet(s, [1.3, 2.05, 12], [1.05, 2.55, 3], 5, frame + 2);
  return { scene: s, overlays: [] };
}

function neptuno(frame: number): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  basin(s, 1.5, 1.5, 1.38, 1.22, 5, frame, 4, R.granite);
  s.hip(1.05, 1.95, 1.05, 1.95, 2, 8, 0.25, plain(R.marble));
  s.sprite(figure(NEPTUNE, 'marble', 'neptune'), 12, 19, 1.55, 1.55, 8);
  // Trident.
  s.line([[1.7, 1.2, 24], [1.7, 1.2, 40]], 'gray4', { bias: 0.4 });
  s.line([[1.64, 1.26, 40], [1.76, 1.14, 40]], 'gray4', { bias: 0.4 });
  s.line([[1.64, 1.26, 40], [1.64, 1.26, 42]], 'gray4', { bias: 0.4 });
  s.line([[1.76, 1.14, 40], [1.76, 1.14, 42]], 'gray4', { bias: 0.4 });
  jet(s, [1.0, 1.9, 9], [0.5, 2.4, 3], 7, frame);
  jet(s, [2.0, 1.0, 9], [2.5, 0.6, 3], 7, frame + 1);
  jet(s, [1.9, 1.9, 9], [2.4, 2.4, 3], 6, frame + 2);
  return { scene: s, overlays: [] };
}

function metropolis(): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  const white = R.portland;
  const wall = classicalWall({ ramp: white, pitch: 7, off: 2, rows: [70, 58, 46, 34, 22], top: 78, base: 12 });
  s.box(0.15, 2.3, 0.15, 1.5, 1, 78, wall);
  s.box(0.15, 1.5, 0.15, 2.3, 1, 78, wall);
  // Rotunda with paired columns.
  const rot: Material = (c) => {
    const a = Math.atan2(c.v - 1.95, c.u - 1.95);
    const col = mod(Math.floor(a * 7), 3) === 0;
    const win = !col && mod(c.fz, 12) > 3 && mod(c.fz, 12) < 10 && c.fz > 14 && c.fz < 76;
    if (c.night) return win ? 'ochre2' : null;
    if (c.edge) return white[0];
    if (win) return lv(R.dark, c.level);
    if (col && c.lambert > 0.5 && !c.shadow) return white[4];
    if (c.fz >= 76) return lv(white, c.level + 1);
    return lv(white, c.level + (col ? 0 : -1) + (c.fz > 12 ? 0 : -1) + 1);
  };
  s.cyl(1.95, 1.95, 0.85, 1, 80, rot);
  s.cyl(1.95, 1.95, 0.72, 80, 88, plain(white, { rim: true }));
  // Slate dome with gilded ribs and garlands.
  const dome: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'ink';
    const a = Math.atan2(c.v - 1.95, c.u - 1.95);
    const rib = Math.abs(mod(a * 4 / Math.PI + 0.5, 1) - 0.5) < 0.09;
    if (rib || mod(c.fz, 9) === 0) return lv(R.gold, c.level);
    return lv(R.slate, c.level + 1);
  };
  s.ell(1.95, 1.95, 88, 0.7, 0.7, 26, dome, { zMin: 88 });
  s.cyl(1.95, 1.95, 0.16, 110, 118, plain(R.gold));
  s.sprite(figure(VICTORY, 'gold', 'victory'), 4, 11, 1.95, 1.95, 118);
  return { scene: s, overlays: [] };
}

function puertaAlcala(): Build {
  const s = new Scene();
  plate(s, 4, 2, paving);
  const g = R.granite;
  // Openings: three arches + two square side openings through the gate (along v).
  const opening = (u: number, z: number): boolean => {
    for (const cu of [1.4, 2.0, 2.6]) {
      if (Math.abs(u - cu) < 0.2 && z < 18 + Math.sqrt(Math.max(0, 0.04 - (u - cu) ** 2)) * 40 && z > 1) return true;
    }
    for (const cu of [0.65, 3.35]) if (Math.abs(u - cu) < 0.16 && z < 16 && z > 1) return true;
    return false;
  };
  const gate: Material = (c) => {
    if (c.night) return c.side === 'left' && c.fz > 20 && c.fz < 40 ? null : null;
    if (c.side === 'back') return lv(g, 1);
    if (c.edge) return g[0];
    if (c.side === 'top') return lv(g, c.level);
    const z = c.fz;
    if (z >= 44) return lv(g, c.level + 1);
    if (z === 43 || z === 40) return lv(g, c.level - 1);
    if (z > 40) return mod(c.fx, 2) ? lv(g, c.level - 1) : lv(g, c.level);
    // Attached columns between the openings.
    if (c.side === 'left') {
      const u = c.u;
      for (const cu of [1.1, 1.7, 2.3, 2.9]) {
        const d = Math.abs(u - cu);
        if (d < 0.07) return lv(R.marble, c.level + (u < cu ? 1 : -1));
      }
      if (z < 4) return lv(g, c.level - 1);
      // Keystones / arch rings.
      for (const cu of [1.4, 2.0, 2.6]) {
        const d = Math.hypot((u - cu) * 40, z - 18);
        if (d > 7 && d < 9 && z > 17) return lv(R.marble, c.level);
      }
    }
    return mod(z, 5) === 0 ? lv(g, c.level - 1) : lv(g, c.level);
  };
  s.box(0.2, 3.8, 0.6, 1.4, 1, 46, gate, {
    cut: (u, v, z, f) => (f === 2 || f === 3 ? opening(u, z) : false) || (f < 0 && false && v > 0),
  });
  // Attic with pediment and trophies.
  s.box(1.2, 2.8, 0.7, 1.3, 46, 58, plain(R.marble, { rim: true }));
  s.gable(1.15, 2.85, 0.65, 1.35, 58, 66, 'v', plain(R.marble, { rim: true }));
  for (const u of [0.5, 3.5]) {
    s.box(u - 0.2, u + 0.2, 0.8, 1.2, 46, 50, plain(g));
    s.sprite(marbleStatue('standing', false, true), 4, 19, u, 1.0, 50);
  }
  return { scene: s, overlays: [] };
}

function palacioComunicaciones(): Build {
  const s = new Scene();
  plate(s, 8, 6, paving);
  const w = R.marble;
  const wall = classicalWall({ ramp: w, pitch: 9, off: 3, rows: [56, 42, 28], top: 64, base: 14 });
  const roof = roofMat(R.slateLit, undefined, 3);
  s.box(0.5, 7.5, 0.5, 4.9, 1, 64, wall);
  s.hip(0.6, 7.4, 0.6, 4.8, 64, 74, 1.2, roof);
  // Corner turrets with pinnacle roofs.
  const tw = classicalWall({ ramp: w, pitch: 7, off: 1, rows: [80, 62, 44, 26], top: 86, base: 14 });
  for (const [u, v] of [
    [0.9, 4.6],
    [7.1, 4.6],
    [7.1, 0.9],
    [0.9, 0.9],
  ] as const) {
    s.box(u - 0.55, u + 0.55, v - 0.55, v + 0.55, 1, 86, tw);
    s.hip(u - 0.6, u + 0.6, v - 0.6, v + 0.6, 86, 104, 0.6, roof);
    s.line([[u, v, 104], [u, v, 110]], 'gray2');
  }
  // Central tower on the front.
  s.box(3.3, 4.7, 4.0, 5.4, 1, 104, tw);
  s.hip(3.25, 4.75, 3.95, 5.45, 104, 116, 0.25, roof);
  s.box(3.6, 4.4, 4.3, 5.1, 116, 128, tw);
  s.hip(3.55, 4.45, 4.25, 5.15, 128, 150, 0.45, roof);
  for (const [u, v] of [
    [3.3, 5.4],
    [4.7, 5.4],
    [4.7, 4.0],
  ] as const) {
    s.prismN(u, v, 0.1, 0.1, 100, 112, 4, plain(w));
    s.prismN(u, v, 0.1, 0, 112, 122, 4, plain(R.slateLit));
  }
  // Grand entrance arcade: three arches on the tower base.
  const arcade: Material = (c) => {
    if (c.night) return c.fz < 20 ? 'ochre2' : null;
    if (c.edge) return w[0];
    const a = mod(c.fx - 54, 7);
    if (a > 1 && c.fz < 18 + (a === 2 || a === 6 ? 0 : 1)) return lv(R.dark, c.level);
    return lv(w, c.level + 1);
  };
  s.box(3.3, 4.7, 5.4, 5.75, 1, 22, arcade);
  stairs(s, 3.3, 4.7, 6.0, 5.75, 1, 3, 1, stepMat(R.granite));
  s.line([[4.0, 4.7, 150], [4.0, 4.7, 172]], 'gray2');
  return { scene: s, overlays: [{ sprite: 'lm.flag.es.small', u: 4.0, v: 4.7, z: 172, flag: true }] };
}

function cervantes(): Build {
  const s = new Scene();
  plate(s, 1, 1, paving);
  const g = R.granite;
  s.box(0.1, 0.9, 0.1, 0.9, 1, 4, plain(g));
  s.box(0.22, 0.78, 0.22, 0.78, 4, 18, plain(g, { rim: true }));
  s.box(0.18, 0.82, 0.18, 0.82, 18, 21, plain(g, { rim: true }));
  s.sprite(figure(CERVANTES, 'bronze', 'cervantes'), 3, 12, 0.5, 0.5, 21);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// London
// ---------------------------------------------------------------------------------------------

function abbey(): Build {
  const s = new Scene();
  plate(s, 7, 4, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.grass, c.level - 2);
    return lv(R.grass, c.level - (mod(c.px * 3 + c.py * 5, 11) === 0 ? 1 : 0) - 1);
  });
  const st = R.honey;
  const g = gothicWall({ ramp: st, pitch: 10, off: 3, rows: [{ zTop: 38, h: 20, w: 5 }], top: 46, state: 0, seed: 1, decals: [] });
  const aisle = gothicWall({ ramp: st, pitch: 10, off: 3, rows: [{ zTop: 20, h: 11 }], top: 26, state: 0, seed: 2, decals: [] });
  const roof = roofMat(R.slateLit, undefined, 3);
  // Nave + aisles.
  s.box(0.6, 5.8, 1.3, 2.7, 1, 46, g);
  s.gable(0.6, 5.8, 1.25, 2.75, 46, 62, 'u', roof);
  s.box(0.6, 5.8, 0.5, 1.3, 1, 26, aisle);
  s.box(0.6, 5.8, 2.7, 3.5, 1, 26, aisle);
  s.poly(
    [
      { nu: -1, nv: 0, nz: 0, c: -0.6 },
      { nu: 1, nv: 0, nz: 0, c: 5.8 },
      { nu: 0, nv: -1, nz: 0, c: -2.7 },
      { nu: 0, nv: 1, nz: 0, c: 3.5 },
      { nu: 0, nv: 0, nz: -1, c: -26 },
      { nu: 0, nv: 12, nz: 1, c: 34 + 12 * 2.7 },
    ],
    [0.6, 5.8, 2.7, 3.5, 26, 34],
    roof,
  );
  // Flying buttresses (thin slabs) on the front aisle.
  for (let u = 1.0; u < 5.7; u += 0.625) {
    s.box(u, u + 0.1, 2.7, 3.55, 26, 40, plain(st));
    s.prismN(u + 0.05, 3.5, 0.06, 0, 26, 36, 4, plain(R.honeyLit));
  }
  // North transept with the great rose window on its +v face.
  const transept: Material = (c) => {
    if (c.side === 'left') {
      const dx = c.fx + 0.5 - 3.3 * 16;
      const dz = c.z - 34;
      const r = Math.hypot(dx, dz);
      if (r < 9) {
        const spoke = Math.abs(mod(Math.atan2(dz, dx) * 8 / Math.PI + 0.5, 1) - 0.5) < 0.18;
        const ring = r > 4.5 && r < 5.5;
        if (c.night) return spoke || ring ? null : r < 4 ? 'pink2' : 'ochre2';
        if (spoke || ring || r > 8) return lv(R.honeyLit, c.level);
        return r < 4 ? 'plum1' : lv(R.dark, c.level);
      }
      if (Math.abs(dx) < 4 && c.z < 14 - (dx * dx) / 4) return c.night ? 'ochre1' : lv(R.dark, c.level);
    }
    return g(c);
  };
  s.box(2.5, 4.1, 2.7, 3.9, 1, 46, transept);
  s.gable(2.45, 4.15, 2.7, 3.95, 46, 62, 'v', roof);
  for (const u of [2.5, 4.1]) {
    s.prismN(u, 3.9, 0.12, 0.12, 1, 54, 8, plain(R.honeyLit), { rot: Math.PI / 8 });
    s.prismN(u, 3.9, 0.12, 0, 54, 64, 8, plain(st), { rot: Math.PI / 8 });
  }
  // West towers (high-u end) with the great west window between them on the +u face.
  const tower = gothicWall({
    ramp: st,
    pitch: 9,
    off: 2,
    rows: [
      { zTop: 92, h: 16, w: 5 },
      { zTop: 64, h: 12 },
    ],
    top: 100,
    state: 0,
    seed: 3,
    decals: [],
  });
  for (const v0 of [0.4, 2.6]) {
    s.box(5.8, 6.8, v0, v0 + 1.0, 1, 100, tower);
    for (const [du, dv] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      s.prismN(5.8 + du, v0 + dv, 0.1, 0.1, 96, 106, 4, plain(R.honeyLit));
      s.prismN(5.8 + du, v0 + dv, 0.1, 0, 106, 116, 4, plain(st));
    }
  }
  const westFront: Material = (c) => {
    if (c.side === 'right') {
      const dx = c.fx + 0.5 - 2.0 * 16;
      const top = 58 - (dx * dx) / 3.5;
      if (Math.abs(dx) < 6 && c.z > 26 && c.z < top) {
        const mull = mod(Math.round(dx), 2) === 0 || mod(c.fz, 6) === 0;
        if (c.night) return mull ? null : 'ochre2';
        return mull ? lv(st, c.level) : lv(R.dark, c.level);
      }
      if (Math.abs(dx) < 3.5 && c.z < 18 - (dx * dx) / 3) return c.night ? 'ochre1' : lv(R.dark, c.level);
    }
    return g(c);
  };
  s.box(5.8, 6.7, 1.4, 2.6, 1, 64, westFront);
  s.gable(5.8, 6.72, 1.35, 2.65, 64, 76, 'u', roof);
  return { scene: s, overlays: [] };
}

function nelson(): Build {
  const s = new Scene();
  plate(s, 2, 2, paving);
  const g = R.granite;
  s.box(0.15, 1.85, 0.15, 1.85, 1, 4, plain(g));
  s.box(0.35, 1.65, 0.35, 1.65, 4, 22, (c) => {
    if (c.night) return null;
    if (c.edge) return g[0];
    // Bronze relief panels.
    if (c.side !== 'top' && c.fz > 7 && c.fz < 18 && mod(c.fx, 26) > 6 && mod(c.fx, 26) < 20) {
      return mod(c.fx + c.fz, 3) === 0 ? lv(R.bronze, c.level + 1) : lv(R.bronze, c.level);
    }
    return lv(g, c.level);
  });
  s.box(0.3, 1.7, 0.3, 1.7, 22, 25, plain(g, { rim: true }));
  // Landseer's lions at the corners (bronze, couchant → reuse the standing lion low).
  const lion = grid(LION, { o: 'ink', k: 'ink', d: 'gray1', m: 'earth0', l: 'earth1', h: 'earth2' }, {}, 'landseer');
  s.sprite(lion, 12, 14, 0.4, 1.75, 4);
  s.sprite(lion, 12, 14, 1.75, 1.75, 4);
  // The column.
  const shaft: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return g[0];
    const flute = mod(c.sx, 2) === 0 && c.lambert < 0.55;
    if (!c.shadow && c.lambert > 0.6) return R.portland[4];
    return lv(R.portland, c.level - (flute ? 1 : 0));
  };
  s.cyl(1.0, 1.0, 0.28, 25, 32, plain(R.portland, { rim: true }));
  s.cyl(1.0, 1.0, 0.2, 32, 128, shaft);
  s.cone(1.0, 1.0, 0.2, 0.3, 128, 136, plain(R.bronze));
  s.box(0.72, 1.28, 0.72, 1.28, 136, 139, plain(R.bronze));
  s.cyl(1.0, 1.0, 0.18, 139, 143, plain(R.portland));
  s.sprite(figure(NELSON, 'stone', 'nelson'), 2, 8, 1.0, 1.0, 143);
  return { scene: s, overlays: [] };
}

/** The London Eye, face-on; `frame` rotates the wheel (32 capsules, 8 frames per capsule step). */
function londonEye(frame: number): Build {
  const s = new Scene();
  plate(s, 4, 4, paving);
  const n = 8;
  const C: [number, number] = [2.0, 2.0];
  const zc = 104;
  const Rr = 88;
  const pt = (a: number, r: number): [number, number, number] => [
    C[0] + (r * Math.cos(a)) / 32,
    C[1] - (r * Math.cos(a)) / 32,
    zc + r * Math.sin(a),
  ];
  // A-frame legs behind the wheel (lower u + v = farther).
  for (const off of [-0.03, 0, 0.03]) {
    s.line([[0.4 + off, 2.2 - off, 1], [C[0] - 0.3, C[1] - 0.3, zc]], off === 0 ? 'white' : 'gray6', { bias: 0.8 });
    s.line([[2.2 + off, 0.4 - off, 1], [C[0] - 0.3, C[1] - 0.3, zc]], off === 0 ? 'gray6' : 'gray5', { bias: 0.8 });
  }
  // Rim (double ring), spokes, capsules.
  const rot = (frame / n) * ((2 * Math.PI) / 32);
  const ring = (r: number, col: string): void => {
    const pts: Array<[number, number, number]> = [];
    for (let k = 0; k <= 160; k++) pts.push(pt((k / 160) * Math.PI * 2, r));
    s.line(pts, col, { emit: col === 'white' ? 'sky' : undefined });
  };
  ring(Rr, 'white');
  ring(Rr - 3, 'gray6');
  for (let k = 0; k < 16; k++) {
    const a = rot * 0 + (k / 16) * Math.PI * 2 + rot;
    s.line([pt(a, 4), pt(a, Rr - 3)], 'gray4', { bias: -0.05 });
  }
  const capsule = grid(
    `
    .oo.
    oGgo
    ogGo
    oggo
    .oo.
    `,
    { o: 'gray4', g: 'glass.2', G: 'white' },
    {},
    'capsule',
  );
  for (let k = 0; k < 32; k++) {
    const a = rot + (k / 32) * Math.PI * 2;
    const p = pt(a, Rr + 3);
    s.sprite(capsule, 2, 2, p[0], p[1], p[2], { bias: 0.1 });
  }
  // Hub.
  s.cyl(C[0], C[1], 0.18, zc - 4, zc + 4, plain(R.whiteSteel));
  // Boarding platform.
  s.box(1.0, 3.0, 2.6, 3.4, 1, 4, plain(R.granite, { rim: true }));
  return { scene: s, overlays: [] };
}

function buckingham(): Build {
  const s = new Scene();
  plate(s, 10, 5, gravel);
  const p = R.portland;
  const wall = classicalWall({ ramp: p, pitch: 8, off: 3, rows: [36, 24, 12], top: 44, base: 14 });
  s.box(0.3, 9.7, 0.4, 3.6, 1, 44, wall);
  s.hip(0.5, 9.5, 0.6, 3.4, 44, 50, 0.8, roofMat(R.slateLit, undefined, 3));
  const bal: Material = (c) => (c.night ? null : c.edge ? p[0] : lv(p, c.level));
  s.box(0.3, 9.7, 3.45, 3.6, 44, 48, bal, { cut: balustradeCut(44, 48) });
  s.box(9.55, 9.7, 0.4, 3.6, 44, 48, bal, { cut: balustradeCut(44, 48) });
  // Corner pavilions.
  for (const u0 of [0.3, 8.5]) s.box(u0, u0 + 1.2, 0.4, 3.85, 1, 47, wall);
  // Central portico with six attached columns and pediment.
  s.box(3.8, 6.2, 3.6, 3.9, 1, 14, plain(p));
  for (let k = 0; k < 6; k++) {
    column(s, { u: 4.0 + k * 0.4, v: 3.85, z0: 14, z1: 40, r: 0.1, ramp: p });
  }
  s.box(3.75, 6.25, 3.6, 4.0, 40, 45, plain(p, { rim: true }));
  s.gable(3.75, 6.25, 3.6, 4.0, 45, 54, 'v', (c) => (c.side === 'left' ? (c.night ? null : c.edge ? p[0] : lv(p, c.level)) : roofMat(R.slateLit)(c)));
  // The balcony.
  s.box(4.3, 5.7, 3.9, 4.1, 14, 15, plain(p, { rim: true }));
  s.line([[4.3, 4.1, 17], [5.7, 4.1, 17]], 'ink');
  // Railings + gilded gates along the front, guards in sentry boxes.
  for (let u = 0.2; u < 9.9; u += 0.125) {
    const gate = Math.abs(u - 5.0) < 0.6 || Math.abs(u - 2.0) < 0.3 || Math.abs(u - 8.0) < 0.3;
    s.line([[u, 4.85, 1], [u, 4.85, gate ? 9 : 6]], gate ? 'ochre2' : 'ink');
  }
  s.line([[0.2, 4.85, 6], [9.9, 4.85, 6]], 'ink');
  for (const u of [3.4, 6.6]) {
    s.box(u - 0.2, u + 0.2, 4.2, 4.6, 1, 14, plain(R.portland));
    s.gable(u - 0.24, u + 0.24, 4.16, 4.64, 14, 18, 'v', plain(R.slate));
    s.sprite(guard(), 1, 9, u, 4.68, 1);
  }
  s.line([[5.0, 2.0, 50], [5.0, 2.0, 82]], 'gray2');
  return { scene: s, overlays: [{ sprite: 'lm.flag.uk', u: 5.0, v: 2.0, z: 82, flag: true }] };
}

function churchill(): Build {
  const s = new Scene();
  plate(s, 1, 1, (c) => (c.night ? null : lv(R.grass, c.level - 1)));
  const g = R.granite;
  s.box(0.15, 0.85, 0.15, 0.85, 1, 18, plain(g, { rim: true }));
  s.sprite(figure(CHURCHILL, 'bronze', 'churchill'), 4, 12, 0.5, 0.5, 18);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Paris
// ---------------------------------------------------------------------------------------------

function obelisk(): Build {
  const s = new Scene();
  plate(s, 2, 2, paving);
  const g = R.granite;
  s.box(0.35, 1.65, 0.35, 1.65, 1, 6, plain(g));
  s.box(0.5, 1.5, 0.5, 1.5, 6, 22, (c) => {
    if (c.night) return null;
    if (c.edge) return g[0];
    if (c.side !== 'top' && c.fz > 9 && c.fz < 19 && mod(c.fx, 16) > 4 && mod(c.fx, 16) < 12)
      return mod(c.fx + c.fz, 2) === 0 ? lv(R.gold, c.level - 1) : lv(g, c.level - 1);
    return lv(g, c.level);
  });
  s.box(0.45, 1.55, 0.45, 1.55, 22, 25, plain(g, { rim: true }));
  const hier: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return R.pinkGranite[0];
    const col = mod(c.fx, 4);
    const glyph = col !== 0 && hash(Math.floor(c.fx / 4), Math.floor(c.fz / 3), 3) < 0.55 && mod(c.fz, 3) !== 0;
    return lv(R.pinkGranite, c.level - (glyph ? 1 : 0));
  };
  s.prismN(1.0, 1.0, 0.25, 0.17, 25, 112, 4, hier);
  s.prismN(1.0, 1.0, 0.17, 0, 112, 120, 4, plain(R.gold, { rim: true }));
  return { scene: s, overlays: [] };
}

function concordeFountain(frame: number): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  basin(s, 1.5, 1.5, 1.4, 1.25, 5, frame, 4, R.granite);
  const vg: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'green0';
    if (c.fz % 5 === 0) return lv(R.gold, c.level - 1);
    return lv(R.verdigris, c.level);
  };
  s.cyl(1.5, 1.5, 0.3, 2, 14, vg);
  s.ell(1.5, 1.5, 16, 0.7, 0.7, 3, vg, { zMax: 17 });
  s.cyl(1.5, 1.5, 0.12, 17, 28, vg);
  s.ell(1.5, 1.5, 29, 0.42, 0.42, 2.5, vg, { zMax: 30 });
  s.cyl(1.5, 1.5, 0.06, 30, 35, vg);
  // Tritons & nereids holding fish around the base.
  const triton = figure(
    `
    .oo..
    ohlo.
    .oo..
    ohlmo
    ohlmo
    .olo.
    ohllo
    `,
    'verdigris',
    'triton',
  );
  for (const [u, v] of [
    [0.85, 2.05],
    [2.1, 2.1],
    [2.15, 0.9],
  ] as const) {
    s.sprite(triton, 2, 6, u, v, 3);
    jet(s, [u, v, 8], [1.5 + (u - 1.5) * 0.4, 1.5 + (v - 1.5) * 0.4, 15], 5, frame);
  }
  jet(s, [1.5, 1.5, 35], [1.1, 1.9, 29], 4, frame);
  jet(s, [1.5, 1.5, 35], [1.9, 1.1, 29], 4, frame + 1);
  jet(s, [1.5, 1.5, 35], [1.9, 1.9, 29], 4, frame + 2);
  return { scene: s, overlays: [] };
}

/** Lattice cut: X-bracing pattern in face space. */
function lattice(scale: number): (u: number, v: number, z: number, f: number) => boolean {
  return (u, v, z, f) => {
    if (f < 0) return false;
    const a = (u + v) * 16;
    const b = z;
    const cell = Math.max(4, scale);
    const x = mod(a, cell);
    const y = mod(b, cell);
    const diag = Math.abs(x - y) < 1.3 || Math.abs(x + y - cell) < 1.3;
    const frame = x < 1.5 || y < 1.2;
    return !(diag || frame);
  };
}

function eiffel(): Build {
  const s = new Scene();
  plate(s, 6, 6, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.gravel, c.level - 1);
    const lawn = Math.abs(c.u - 3) > 1.6 && Math.abs(c.v - 3) > 1.6 ? false : Math.abs(c.u - 3) < 1.2 && Math.abs(c.v - 3) < 1.2;
    if (lawn) return lv(R.grass, c.level - 1);
    return lv(R.gravel, c.level - (hash(c.px >> 1, c.py) < 0.1 ? 1 : 0));
  });
  const iron: Material = (c) => {
    if (c.night) return hash(c.px, c.py) < 0.05 ? 'ochre4' : null;
    if (c.side === 'back') return lv(R.eiffel, Math.max(1, c.level - 1));
    if (c.edge) return R.eiffel[0];
    return lv(R.eiffel, c.level);
  };
  // Four legs: inclined frusta from the footprint corners to the first platform.
  const legs: Array<[number, number]> = [
    [0.9, 0.9],
    [5.1, 0.9],
    [0.9, 5.1],
    [5.1, 5.1],
  ];
  const zP1 = 64;
  for (const [bu, bv] of legs) {
    const tu = 3 + (bu - 3) * 0.48;
    const tv = 3 + (bv - 3) * 0.48;
    const h0 = 0.62;
    const h1 = 0.32;
    // Planes for a slanted frustum: |u − cu(z)| ≤ hw(z), |v − cv(z)| ≤ hw(z).
    const ku = (tu - bu) / zP1;
    const kv = (tv - bv) / zP1;
    const kh = (h1 - h0) / zP1;
    const pl = [
      { nu: 0, nv: 0, nz: -1, c: 0 },
      { nu: 0, nv: 0, nz: 1, c: zP1 },
      { nu: 1, nv: 0, nz: -(ku + kh), c: bu + h0 },
      { nu: -1, nv: 0, nz: ku - kh, c: -(bu - h0) },
      { nu: 0, nv: 1, nz: -(kv + kh), c: bv + h0 },
      { nu: 0, nv: -1, nz: kv - kh, c: -(bv - h0) },
    ];
    s.poly(pl, [Math.min(bu, tu) - h0, Math.max(bu, tu) + h0, Math.min(bv, tv) - h0, Math.max(bv, tv) + h0, 0, zP1], iron, {
      cut: lattice(11),
    });
    // Masonry pier.
    s.box(bu - 0.7, bu + 0.7, bv - 0.7, bv + 0.7, 1, 4, plain(R.lime));
  }
  // Arches between the legs on the two visible sides (+v and +u).
  for (const side of ['v', 'u'] as const) {
    const pts: Array<[number, number, number]> = [];
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      const a = 1.6 + t * 2.8;
      const z = 30 + Math.sin(t * Math.PI) * 22;
      pts.push(side === 'v' ? [a, 4.15 + Math.sin(t * Math.PI) * 0.0, z] : [4.15, a, z]);
    }
    s.line(pts, 'earth3');
    s.line(
      pts.map(([a, b, z]) => [a, b, z + 2] as [number, number, number]),
      'earth1',
    );
  }
  // First platform.
  const deck: Material = (c) => {
    if (c.night) return c.side !== 'top' && mod(c.fx, 3) === 0 ? 'ochre3' : null;
    if (c.edge) return R.eiffel[0];
    if (c.side !== 'top') return mod(c.fx, 3) === 0 ? lv(R.eiffel, c.level + 1) : lv(R.eiffel, c.level - 1);
    return lv(R.eiffel, c.level);
  };
  s.box(1.6, 4.4, 1.6, 4.4, zP1, zP1 + 8, deck);
  // Second section.
  s.prismN(3, 3, 1.15, 0.62, zP1 + 8, 140, 4, iron, { cut: lattice(9) });
  s.box(2.25, 3.75, 2.25, 3.75, 140, 146, deck);
  // Third section — the long taper.
  s.prismN(3, 3, 0.6, 0.18, 146, 260, 4, iron, { cut: lattice(7) });
  s.prismN(3, 3, 0.18, 0.12, 260, 300, 4, iron);
  s.box(2.82, 3.18, 2.82, 3.18, 300, 308, deck);
  s.prismN(3, 3, 0.12, 0.04, 308, 318, 4, iron);
  s.line([[3, 3, 318], [3, 3, 336]], 'gray3', { emit: 'ochre4' });
  return { scene: s, overlays: [] };
}

function invalides(): Build {
  const s = new Scene();
  plate(s, 8, 8, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.gravel, c.level - 1);
    const lawn = (c.u > 0.6 && c.u < 2.0) || (c.v > 6.0 && c.v < 7.4 && (c.u < 3.2 || c.u > 4.8));
    if (lawn && c.u < 7.4 && c.v > 0.6) return lv(R.grass, c.level - 1);
    return lv(R.gravel, c.level - (hash(c.px >> 1, c.py) < 0.1 ? 1 : 0));
  });
  const L = R.lime;
  const wall = classicalWall({ ramp: L, pitch: 10, off: 4, rows: [40, 22], top: 50, base: 10 });
  s.box(2.0, 6.0, 2.0, 6.0, 1, 50, wall);
  s.hip(2.1, 5.9, 2.1, 5.9, 50, 56, 0.6, roofMat(R.slateLit));
  // Two-tier portico on the +v face.
  s.box(3.0, 5.0, 6.0, 6.35, 1, 6, plain(L));
  stairs(s, 3.0, 5.0, 6.8, 6.35, 1, 6, 2, stepMat(L));
  for (let k = 0; k < 6; k++) column(s, { u: 3.2 + k * 0.32, v: 6.2, z0: 6, z1: 28, r: 0.09, ramp: R.limePale, order: 'doric' });
  s.box(3.0, 5.0, 6.0, 6.32, 28, 32, plain(L, { rim: true }));
  for (let k = 0; k < 4; k++) column(s, { u: 3.45 + k * 0.37, v: 6.15, z0: 32, z1: 50, r: 0.08, ramp: R.limePale });
  s.box(3.2, 4.8, 6.0, 6.28, 50, 54, plain(L, { rim: true }));
  s.gable(3.15, 4.85, 6.0, 6.3, 54, 62, 'v', (c) => (c.side === 'left' ? (c.night ? null : c.edge ? L[0] : lv(L, c.level - (c.rim ? 0 : 1))) : roofMat(R.slateLit)(c)));
  // Drum with paired columns and windows.
  const drum: Material = (c) => {
    const a = Math.atan2(c.v - 4, c.u - 4);
    const k = mod(a * 20 / Math.PI, 2);
    const colp = k < 0.5;
    const win = k > 0.9 && k < 1.6 && c.fz > 64 && c.fz < 80;
    if (c.night) return win ? 'ochre2' : null;
    if (c.edge) return L[0];
    if (win) return lv(R.dark, c.level);
    if (c.fz > 84) return lv(L, c.level + 1);
    if (colp && !c.shadow && c.lambert > 0.45) return L[4];
    return lv(L, c.level - (colp ? 0 : 1) + 1);
  };
  s.cyl(4, 4, 1.25, 50, 88, drum);
  s.cyl(4, 4, 1.15, 88, 94, plain(L, { rim: true }));
  // The golden dome: gilded ribs and trophies on dark lead.
  const dome: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'earth1';
    const a = Math.atan2(c.v - 4, c.u - 4);
    const r = mod(a * 8 / Math.PI + 0.5, 1);
    const rib = Math.abs(r - 0.5) < 0.12;
    if (rib) return lv(R.gold, c.level + 1);
    const trophy = Math.abs(r - 0.5) > 0.32 && mod(c.fz, 10) > 3 && mod(c.fz, 10) < 8;
    if (trophy) return lv(R.gold, c.level);
    return lv(R.gold, c.level - 1);
  };
  s.ell(4, 4, 94, 1.12, 1.12, 50, dome, { zMin: 94 });
  s.cyl(4, 4, 0.25, 140, 152, plain(R.gold, { rim: true }));
  s.cone(4, 4, 0.22, 0.0, 152, 174, plain(R.gold, { rim: true }));
  s.line([[4, 4, 174], [4, 4, 180]], 'ochre3');
  // Corner chapels.
  for (const [u, v] of [
    [2.3, 5.7],
    [5.7, 5.7],
    [5.7, 2.3],
  ] as const) {
    s.cyl(u, v, 0.45, 50, 58, plain(L));
    s.ell(u, v, 58, 0.42, 0.42, 10, roofMat(R.slateLit), { zMin: 58 });
  }
  return { scene: s, overlays: [] };
}

function orsay(): Build {
  const s = new Scene();
  plate(s, 10, 5, paving);
  const L = R.lime;
  const arched = (c: ShadeCtx): string | null | undefined => {
    if (c.side !== 'left' && c.side !== 'right') return undefined;
    const pitch = 16;
    const rel = mod(c.fx - 4, pitch);
    const dx = rel - 7.5;
    if (Math.abs(dx) < 5 && c.z > 10 && c.z < 40 - (dx * dx) / 6) {
      const mull = mod(Math.round(dx), 3) === 0 || mod(c.fz, 7) === 0;
      if (c.night) return mull ? null : 'ochre2';
      return mull ? lv(R.metal, c.level) : lv(R.glass, c.level - 1);
    }
    return undefined;
  };
  const wall: Material = (c) => {
    const a = arched(c);
    if (a !== undefined) return a;
    if (c.night) return null;
    if (c.side === 'top') return lv(L, c.level);
    if (c.edge) return L[0];
    if (c.fz >= 46) return lv(L, c.level + 1);
    if (c.fz === 45 || c.fz === 42) return lv(L, c.level - 1);
    if (c.fz < 8) return mod(c.fz, 3) === 0 ? lv(L, c.level - 1) : lv(L, c.level);
    return lv(L, c.level);
  };
  s.box(1.3, 8.7, 0.6, 4.3, 1, 48, wall);
  // Glass barrel vault with iron ribs.
  const vault: Material = (c) => {
    if (c.night) return mod(c.fx, 6) === 0 ? null : 'ochre3';
    if (c.edge) return 'zinc0';
    if (mod(Math.floor(c.u * 16), 6) === 0) return lv(R.metal, c.level);
    if (mod(c.fz, 5) === 0) return lv(R.metal, c.level - 1);
    return lv(R.glassSky, c.level);
  };
  s.vaultU(1.4, 8.6, 2.45, 1.6, 47, 22, vault);
  s.box(1.3, 8.7, 0.6, 1.0, 47, 50, plain(L));
  // End pavilions with the great clocks on the river (+v) face.
  const clockAt = (cx: number): Material => (c) => {
    if (c.side === 'left') {
      const dx = c.fx + 0.5 - cx * 16;
      const dz = c.z - 52;
      const r = Math.hypot(dx, dz);
      if (r < 7) {
        const ang = Math.atan2(dz, dx);
        const hand = (Math.abs(ang - Math.PI / 2) < 0.12 && r < 6) || (Math.abs(ang - 0.3) < 0.15 && r < 4);
        if (c.night) return hand ? 'ink' : 'ochre4';
        if (hand) return 'ink';
        if (r > 5.6) return lv(R.gold, c.level);
        return c.level >= 3 ? 'white' : 'stone4';
      }
      if (r < 8.5) return c.night ? null : lv(R.gold, c.level - 1);
    }
    return wall(c);
  };
  for (const u0 of [0.3, 8.6]) {
    s.box(u0, u0 + 1.1, 0.5, 4.5, 1, 64, clockAt(u0 + 0.55));
    s.hip(u0 + 0.05, u0 + 1.05, 0.55, 4.45, 64, 78, 0.45, roofMat(R.zinc, undefined, 4));
    s.line([[u0 + 0.55, 2.5, 78], [u0 + 0.55, 2.5, 84]], 'ochre2');
  }
  // Statues on the parapet.
  const st = marbleStatue('standing', false, true);
  for (const u of [3.0, 5.0, 7.0]) s.sprite(st, 4, 19, u, 4.2, 48);
  // Inscription.
  const t = textGrid('MUSEE D ORSAY');
  void t;
  return { scene: s, overlays: [] };
}

export const SECONDARY: Readonly<Record<LandmarkId, SecondaryArt>> = {
  cibeles: { top: 40, frames: 4, fps: 6, build: cibeles },
  neptuno: { top: 48, frames: 4, fps: 6, build: neptuno },
  metropolis: { top: 132, frames: 1, fps: 0, build: metropolis },
  puertaAlcala: { top: 72, frames: 1, fps: 0, build: puertaAlcala },
  palacioComunicaciones: { top: 180, frames: 1, fps: 0, build: palacioComunicaciones },
  cervantes: { top: 36, frames: 1, fps: 0, build: cervantes },
  abbey: { top: 120, frames: 1, fps: 0, build: abbey },
  nelson: { top: 156, frames: 1, fps: 0, build: nelson },
  londonEye: { top: 200, frames: 8, fps: 2, side: 30, build: londonEye },
  buckingham: { top: 100, frames: 1, fps: 0, build: buckingham },
  churchill: { top: 34, frames: 1, fps: 0, build: churchill },
  obelisk: { top: 126, frames: 1, fps: 0, build: obelisk },
  concordeFountain: { top: 40, frames: 4, fps: 6, build: concordeFountain },
  eiffel: { top: 342, frames: 1, fps: 0, build: eiffel },
  invalides: { top: 186, frames: 1, fps: 0, build: invalides },
  orsay: { top: 92, frames: 1, fps: 0, build: orsay },
};

export function registerSecondary(
  reg: SpriteRegistry,
  overlays: Map<string, Array<{ sprite: string; x: number; y: number }>>,
): void {
  for (const id of Object.keys(SECONDARY) as LandmarkId[]) {
    const art = SECONDARY[id];
    const def = LANDMARKS[id];
    const cv = { w: def.w, d: def.d, top: art.top, left: 2 + (art.side ?? 0), right: 2 + (art.side ?? 0) };
    const frames = [];
    let first: Build | null = null;
    let night = null;
    for (let f = 0; f < art.frames; f++) {
      const b = art.build(f);
      const out = b.scene.render(cv, { cacheKey: art.frames > 1 && id !== 'londonEye' ? `lm.${id}` : undefined });
      frames.push(out.img);
      if (f === 0) {
        first = b;
        night = out;
      }
    }
    const name = `lm.${id}`;
    reg.add(name, { group: 'landmarks', frames, fps: art.fps, anchor: night!.anchor, tags: ['landmark', def.city] });
    reg.add(`${name}.night`, { group: 'landmarks', frames: night!.night, anchor: night!.anchor, tags: ['night'] });
    const sh = first!.scene.groundShadow(cv, SHADOW_ALPHA, SHADOW, () => true);
    reg.add(`${name}.shadow`, { group: 'landmarks', frames: sh.img, anchor: sh.anchor, hasShadow: true, tags: ['shadow'] });
    overlays.set(
      name,
      first!.overlays.map((o: Overlay) => {
        const p = project(o.u, o.v, o.z);
        return { sprite: o.sprite, x: p.x, y: p.y };
      }),
    );
  }
}

// Silence unused-import lint for helpers kept for future landmark tweaks.
void lancet;
