/**
 * Madrid — Congreso de los Diputados (Palacio de las Cortes). Footprint 9 (u) × 7 (v); the
 * hexastyle Corinthian portico, grand stair and the bronze lions (Daoíz & Velarde) face +v
 * (SW, the lit face).
 */
import { Scene, type Material, type ShadeCtx } from './engine/scene';
import { R, hash, lv, mod, mod_, plain, sampleModule, moduleColour } from './engine/materials';
import {
  balustradeCut,
  column,
  decalAt,
  paintWindow,
  scatterDecals,
  soot,
  stairs,
  stepMat,
  windowStatus,
  type DamageState,
  type Decal,
} from './engine/kit';
import type { Build, Overlay } from './types';
import { bronzeLion, lamp } from './props';

export const CONGRESO_W = 9;
export const CONGRESO_D = 7;

// Face-space modules (drawn upright; the renderer shears them onto the walls).
const WIN_NOBLE = mod_(
  `
  ...PP...
  ..PPPP..
  .PPPPPP.
  pppppppp
  .FFFFFF.
  .FgGggF.
  .FgggGF.
  .FgggmF.
  .FmmmmF.
  .FgGggF.
  .FgggmF.
  .FgggmF.
  .FgggmF.
  .FgggmF.
  .ssssss.
  bbbbbbbb
  bkbkkbkb
  `,
  {
    P: { r: R.cream, d: 1 },
    p: { r: R.cream, d: -2 },
    F: { r: R.cream, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: R.cream, d: -1 },
    s: { r: R.cream, d: 1 },
    b: 'gray1',
    k: 'ink',
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

const WIN_BASE = mod_(
  `
  .KKKK.
  KggggK
  KgGggK
  KggmgK
  KgggmK
  KgggmK
  `,
  { K: { r: R.granite, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: { r: R.granite, d: -2 } },
  { g: 'ochre1', G: 'ochre2' },
);

/** Portico window (no balcony, simple cornice). */
const WIN_PORTICO = mod_(
  `
  pppppp
  .FFFF.
  .FgGF.
  .FggF.
  .FmmF.
  .FgGF.
  .FggF.
  .FggF.
  .FggF.
  .ssss.
  `,
  {
    p: { r: R.cream, d: -1 },
    F: { r: R.cream, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: R.cream, d: -1 },
    s: { r: R.cream, d: 1 },
  },
  { g: 'ochre2', G: 'ochre3' },
);

/** Puerta de los Leones: bronze double door with gilded studs, in a moulded frame. */
const DOOR = mod_(
  `
  ..PPPPPPPPPP..
  .PppppppppppP.
  PppppppppppppP
  FFFFFFFFFFFFFF
  FbbbbbbobbbbbF
  FbyBbyBobyBbyF
  FbBBBBBoBBBBbF
  FbbbbbbobbbbbF
  FbyBbyBobyBbyF
  FbBBBBBoBBBBbF
  FbbbbbbobbbbbF
  FbyBbyBobyBbyF
  FbBBBBBoBBBBbF
  FbbbbbbobbbbbF
  FbyBbyBobyBbyF
  FbBBBBBoBBBBbF
  FbbbbbbobbbbbF
  FbbbbbbobbbbbF
  `,
  {
    P: { r: R.cream, d: 1 },
    p: { r: R.cream, d: -1 },
    F: { r: R.cream, d: 0 },
    b: 'earth1',
    B: 'earth2',
    o: 'earth0',
    y: 'ochre2',
  },
  { y: 'ochre3' },
);

/** Tympanum relief: Spain embracing the Constitution, flanked by allegories (L lit, S shade). */
const RELIEF = mod_(
  `
  ...........................LL...........................
  ..........................LLLS..........................
  ..........................LLLS..........................
  ........................LLLLLLLS........................
  .................LL....LLL.LL.LLS....LL.................
  ................LLLS..LLLLLLLLLLLS..LLLS................
  ..........LL....LLS..LLLL.LLLL.LLLS..LLS....LL..........
  .........LLLS..LLLLS.LLLLLLLLLLLLLS.LLLLS..LLLS.........
  ...LL....LLS..LLLLLLSLLLLLLLLLLLLLLSLLLLLS..LLS....LL...
  ..LLLLS.LLLLSLLLLLLLLLLLLLLLLLLLLLLLLLLLLLSLLLLS.LLLLS..
  LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
  `,
  { L: { r: R.cream, d: 1 }, S: { r: R.cream, d: 0 } },
);

export function buildCongreso(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 1100;

  // --- Damage bookkeeping -----------------------------------------------------------------
  const decals: Decal[] = scatterDecals(state, seed, [
    ['left', 'body', 6, 34, 2, 15],
    ['left', 'body', 110, 138, 2, 15],
    ['right', 'body', 10, 74, 2, 15],
    ['left', 'podium', 36, 108, 2, 15],
    ['left', 'ped', 25, 36, 2, 10],
    ['left', 'ped', 110, 120, 2, 10],
    ['left', 'body', 40, 104, 18, 32],
    ['left', 'stairs', 40, 104, 2, 16],
  ], 1.4);
  const holes: Array<{ side: 'left' | 'right'; fx: number; z: number; r: number }> =
    state >= 4
      ? [
          { side: 'left', fx: 20, z: 30, r: 7 },
          { side: 'right', fx: 52, z: 22, r: 8 },
        ]
      : [];
  const inHole = (side: 'left' | 'right', fx: number, z: number, grow = 0): boolean =>
    holes.some((h) => {
      if (h.side !== side) return false;
      const dx = fx - h.fx;
      const dz = (z - h.z) * 1.2;
      const a = Math.atan2(dz, dx);
      const rr = h.r + Math.sin(a * 5 + h.fx) * 1.6 + Math.cos(a * 3) * 1.2 + grow;
      return dx * dx + dz * dz < rr * rr;
    });

  // Window registry for fires / soot.
  const burning: Array<{ side: 'left' | 'right'; fx: number; zTop: number; w: number }> = [];
  const frontBays = [9, 22, 115, 128];
  const rightBays = [15, 30, 45, 60];
  const statusOf = (side: 'left' | 'right', bay: number, row: number): ReturnType<typeof windowStatus> =>
    windowStatus(state, bay * 3 + row + (side === 'left' ? 0 : 500), seed);
  for (const [side, bays] of [
    ['left', frontBays],
    ['right', rightBays],
  ] as const) {
    for (const b of bays) {
      for (const [row, zTop, w] of [
        [0, 44, 8],
        [1, 13, 6],
      ] as const) {
        const st = statusOf(side, b, row);
        if (st === 'burning' || st === 'gutted') burning.push({ side, fx: b + w / 2, zTop, w });
        if (st === 'burning') {
          const zc = zTop - 8;
          const fx = b + w / 2;
          const u = side === 'left' ? fx / 16 : 8.75;
          const v = side === 'left' ? 4.75 : fx / 16;
          ov.push({ sprite: row === 0 ? 'lm.fx.fire.m' : 'lm.fx.fire.s', u, v, z: zc - 2 });
        }
      }
    }
  }

  // Scorched roof zones around the roof fires (coherent burns, not noise).
  const burns: Array<[number, number, number]> =
    state === 3 ? [[7.2, 2.6, 0.7]] : state >= 4 ? [[6.9, 2.2, 1.5], [2.0, 3.4, 1.1], [4.5, 1.6, 0.8]] : [];
  function scorch(u: number, v: number): 0 | 1 | 2 {
    for (const [bu, bv, br] of burns) {
      const a = Math.atan2(v - bv, u - bu);
      const r = br * (1 + Math.sin(a * 4 + bu) * 0.18);
      const d = Math.hypot((u - bu) * 1.2, v - bv);
      if (d < r * 0.75) return 2;
      if (d < r) return 1;
    }
    return 0;
  }

  // --- Materials --------------------------------------------------------------------------
  const cream = R.cream;
  const gran = R.granite;
  const holeEdge = (c: ShadeCtx, side: 'left' | 'right'): string | null | undefined => {
    if (!holes.length || !inHole(side, c.fx, c.fz, 2)) return undefined;
    if (c.night) return null;
    return lv(R.brick, c.level - (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
  };
  const interior: Material = (c) => {
    if (c.night) return c.z < 12 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
    if (state >= 3 && c.z < 10) return hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1';
    return c.z < 18 ? 'gray1' : 'ink';
  };

  const bodyWall: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.side === 'top') {
      if (scorch(c.u, c.v) === 2) return c.night ? 'rust3' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust2';
      return c.night ? null : lv(cream, c.level);
    }
    const side = c.side === 'right' ? 'right' : 'left';
    const he = holeEdge(c, side);
    if (he !== undefined) return he;
    const z = c.fz;
    // Windows.
    const bays = side === 'left' ? frontBays : rightBays;
    for (const b of bays) {
      const st1 = statusOf(side, b, 0);
      const w1 = paintWindow(WIN_NOBLE, c, b, 44, st1);
      if (w1 !== undefined) return w1;
      const st2 = statusOf(side, b, 1);
      const w2 = paintWindow(WIN_BASE, c, b + 1, 13, st2);
      if (w2 !== undefined) return w2;
    }
    // Portico back wall: door + windows.
    if (side === 'left' && c.fx > 36 && c.fx < 108) {
      const dk = sampleModule(DOOR, c, 65, 37);
      if (dk !== null) return state >= 3 && dk !== 'F' && dk !== 'P' && dk !== 'p' && !c.night ? (hash(c.fx, c.fz) < 0.3 ? 'rust1' : 'ink') : moduleColour(DOOR, dk, c);
      for (const b of [44, 54, 86, 96]) {
        const r = paintWindow(WIN_PORTICO, c, b, 40, statusOf('left', b, 2));
        if (r !== undefined) return r;
      }
    }
    if (c.night) {
      // Floodlit facade wash on the lower front.
      return null;
    }
    const d = decalAt(decals, c);
    if (d) return d;
    for (const bw of burning) {
      if (bw.side !== side) continue;
      const sd = soot(c, bw.fx, bw.zTop, bw.w / 2, 16);
      if (sd) return sd;
    }
    if (c.edge) return cream[0];
    // The portico recess sits in deep shade under its roof.
    if (side === 'left' && c.fx > 34 && c.fx < 110 && z < 50 && z >= 17) {
      return lv(cream, Math.min(c.level, 2) - (z > 44 ? 1 : 0));
    }
    // Corner quoins.
    const quoin =
      side === 'left' ? c.fx <= 6 || c.fx >= 137 : c.fx >= 73;
    if (z >= 52) return lv(cream, c.level + 1);
    if (z === 51) return lv(cream, c.level - 1);
    if (z >= 49) return mod(c.fx, 2) === 0 ? lv(cream, c.level) : lv(cream, c.level - 2);
    if (z === 48) return lv(cream, c.level + 1);
    if (z === 47) return lv(cream, c.level - 1);
    if (z < 17) {
      if (z === 16) return lv(gran, c.level + 1);
      if (z <= 2) return lv(gran, c.level - 1);
      if (mod(z, 4) === 2) return lv(gran, c.level - 1);
      const row = Math.floor(z / 4);
      if (mod(c.fx + row * 6, 12) === 0) return lv(gran, c.level - 1);
      return lv(gran, c.level);
    }
    if (z === 17) return lv(cream, c.level - 1);
    if (quoin) {
      if (mod(z, 6) === 0) return lv(cream, c.level - 1);
      return lv(cream, c.level + (c.level >= 3 ? 1 : 0));
    }
    return lv(cream, c.level);
  };

  const slateRoof: Material = (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return lv(R.slate, 1);
    const sc = scorch(c.u, c.v);
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    const course = mod(c.fz, 3) === 0;
    return lv(R.slateLit, c.level - (course ? 1 : 0));
  };
  const roofCut =
    state >= 4
      ? (u: number, v: number, z: number, f: number): boolean => {
          void z;
          void f;
          const d1 = Math.hypot((u - 6.9) * 1.3, v - 2.2);
          const d2 = Math.hypot((u - 2.0) * 1.3, v - 3.4);
          return d1 < 0.8 + Math.sin(u * 9) * 0.12 || d2 < 0.55 + Math.cos(v * 11) * 0.1;
        }
      : undefined;
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 6.9, v: 2.2, z: 60 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 2.0, v: 3.4, z: 58 });
    ov.push({ sprite: 'lm.fx.smoke', u: 6.9, v: 2.0, z: 72 });
  }
  if (state === 3) {
    ov.push({ sprite: 'lm.fx.smoke', u: 7.6, v: 4.75, z: 56 });
  }

  // --- Geometry ---------------------------------------------------------------------------
  // Forecourt paving (granite setts, a little lighter in front of the stair).
  const paving: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side !== 'top') return lv(gran, c.level - 1);
    if (c.edge) return lv(R.paving, 0);
    const ju = mod(c.u * 4, 1) < 0.07;
    const jv = mod(c.v * 4, 1) < 0.14;
    return lv(R.paving, c.level - (ju || jv ? 1 : 0));
  };
  s.box(0, CONGRESO_W, 0, CONGRESO_D, 0, 1, paving, { cast: false, tag: 'ground' });

  // Main body.
  const bodyCut = holes.length
    ? (u: number, v: number, z: number, f: number): boolean => {
        if (f === 3) return inHole('left', Math.floor(u * 16), Math.floor(z));
        if (f === 1) return inHole('right', Math.floor(v * 16), Math.floor(z));
        return false;
      }
    : undefined;
  s.box(0.25, 8.75, 0.5, 4.75, 1, 54, bodyWall, { tag: 'body', cut: bodyCut });

  // Roof terrace + hemicycle hall with its glazed lantern.
  s.hip(0.55, 8.45, 0.8, 4.45, 54, 61, 1.5, slateRoof, { cut: roofCut });
  // Oeil-de-boeuf dormers on the front and side slopes, and chimney stacks.
  const dormer: Material = (c) => {
    if (c.night) return c.side === 'left' || c.side === 'right' ? (mod(c.fx, 16) === 7 && c.fz >= 57 && c.fz <= 58 ? 'ochre2' : null) : null;
    if (c.edge) return cream[0];
    if (c.side === 'left' || c.side === 'right') {
      const dx = Math.abs(mod(c.fx, 16) - 7.5);
      if (dx < 1.5 && c.fz >= 56 && c.fz <= 59) return state >= 2 ? 'ink' : lv(R.dark, c.level);
      return lv(cream, c.level);
    }
    return slateRoof(c);
  };
  for (const u of [1.2, 7.8]) {
    s.box(u - 0.3, u + 0.3, 3.85, 4.3, 54, 61, dormer);
    s.gable(u - 0.36, u + 0.36, 3.75, 4.36, 61, 64, 'v', dormer);
  }
  for (const v of [1.6, 3.1]) {
    s.box(7.95, 8.35, v - 0.3, v + 0.3, 54, 61, dormer);
    s.gable(7.9, 8.41, v - 0.36, v + 0.36, 61, 64, 'u', dormer);
  }
  const chimney: Material = (c) => (c.night ? null : c.edge ? R.brick[0] : c.fz >= 67 ? lv(cream, c.level) : lv(R.brick, c.level));
  for (const [u, v] of [
    [1.0, 1.4],
    [8.0, 0.95],
    [2.0, 1.0],
  ] as const) {
    s.box(u - 0.15, u + 0.15, v - 0.12, v + 0.12, 56, 68, chimney);
  }
  const hallWall: Material = (c) => {
    if (c.night) {
      const lun = lunette(c);
      return lun === 'g' ? 'ochre2' : null;
    }
    if (c.edge) return cream[0];
    const lun = lunette(c);
    if (lun === 'g') return state >= 2 ? 'ink' : lv(R.dark, c.level);
    if (lun === 'f') return lv(cream, c.level + 1);
    if (c.fz >= 64) return lv(cream, c.level + 1);
    if (c.fz === 63) return lv(cream, c.level - 1);
    return lv(cream, c.level);
  };
  s.box(2.7, 6.3, 1.3, 3.7, 54, 66, hallWall, { tag: 'hall' });
  s.hip(2.6, 6.4, 1.2, 3.8, 66, 72, 1.0, slateRoof);
  const glass: Material = (c) => {
    if (c.night) return c.side === 'top' ? null : 'ochre3';
    if (c.edge) return 'ink';
    if (state >= 2 && mod(c.fx, 8) < 3 && c.side !== 'top') return 'ink';
    if (mod(c.fx, 4) === 0 || c.side === 'top') return lv(R.metal, c.level);
    return lv(R.glassSky, c.level);
  };
  s.box(4.0, 5.0, 2.0, 3.0, 72, 76, glass);
  s.hip(3.95, 5.05, 1.95, 3.05, 76, 79, 0.55, glass);

  // Balustrade with pedestals and urns.
  const bal: Material = (c) => (c.night ? null : c.edge ? cream[0] : lv(cream, c.level));
  s.box(0.25, 8.75, 4.55, 4.75, 54, 59, bal, { cut: balustradeCut(54, 59) });
  s.box(8.55, 8.75, 0.5, 4.75, 54, 59, bal, { cut: balustradeCut(54, 59) });
  for (const [u, v] of [
    [0.35, 4.65],
    [8.65, 4.65],
    [8.65, 0.6],
    [8.65, 2.6],
    [2.2, 4.65],
    [6.8, 4.65],
  ] as const) {
    s.box(u - 0.12, u + 0.12, v - 0.12, v + 0.12, 54, 61, bal);
    s.ell(u, v, 63, 0.1, 0.1, 3, plain(R.cream, { rim: true }), { zMin: 61 });
  }

  // Portico podium, stair and cheeks.
  const granMat: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return gran[0];
    if (c.side === 'top') return lv(gran, c.level);
    if (mod(c.fz, 4) === 2) return lv(gran, c.level - 1);
    return lv(gran, c.level);
  };
  s.box(2.2, 6.8, 4.75, 6.0, 1, 16, granMat, { tag: 'podium' });
  stairs(s, 2.2, 6.8, 7.0, 6.0, 1, 16, 5, stepMat(gran, decals));

  // Lion pedestals + the lions.
  for (const [i, u0] of [1.4, 6.9].entries()) {
    s.box(u0, u0 + 0.7, 6.15, 6.85, 1, 4, granMat, { tag: 'ped' });
    s.box(u0 + 0.06, u0 + 0.64, 6.21, 6.79, 4, 12, granMat, { tag: 'ped' });
    s.box(u0 - 0.03, u0 + 0.73, 6.12, 6.88, 12, 14, plain(R.granite, { rim: true }), { tag: 'ped' });
    const toppled = (state === 3 && i === 1) || state >= 4;
    if (toppled && i === 1) {
      s.sprite(bronzeLion(true), 12, 14, u0 + 0.9, 7.0, 1);
    } else {
      s.sprite(bronzeLion(false, toppled), 12, 14, u0 + 0.35, 6.5, 14);
    }
  }

  // Columns (two shattered in state 4) with the entablature and pediment above.
  const broken = state >= 4 ? new Map([[1, 31], [4, 24]]) : new Map<number, number>();
  for (let k = 0; k < 6; k++) {
    column(s, {
      u: 2.75 + k * 0.7,
      v: 5.7,
      z0: 16,
      z1: 50,
      r: 0.15,
      ramp: R.creamWarm,
      brokenAt: broken.get(k),
      tag: 'col',
    });
  }
  // Fallen drums on the stair.
  if (state >= 4) {
    const rub = plain(R.creamWarm);
    s.cyl(3.0, 6.55, 0.15, 7, 12, rub);
    s.box(4.6, 5.0, 6.55, 6.85, 4, 8, rub);
    s.cyl(5.25, 6.75, 0.13, 4, 8, rub);
    s.hip(6.0, 6.6, 6.4, 6.9, 1, 7, 0.28, rub);
    s.hip(0.6, 1.4, 4.8, 5.4, 1, 6, 0.38, plain(R.brick));
    s.hip(7.4, 8.3, 4.9, 5.6, 1, 7, 0.4, plain(R.cream));
  }
  const gap = state >= 4;
  const entCut = gap
    ? (u: number, _v: number, z: number): boolean => {
        const c1 = 3.45;
        const half = 0.45 + Math.sin(z * 0.9) * 0.08;
        return Math.abs(u - c1) < half - (z - 50) * 0.01;
      }
    : undefined;
  const entab: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    if (c.edge) return cream[0];
    if (c.side === 'top') return lv(cream, c.level);
    const z = c.fz;
    if (z >= 56) return lv(cream, c.level + 1);
    if (z === 55) return mod(c.fx, 2) ? lv(cream, c.level - 2) : lv(cream, c.level);
    if (z === 52) return lv(cream, c.level - 1);
    if (z === 50) return lv(cream, c.level - 1);
    return lv(cream, c.level);
  };
  s.box(2.35, 6.65, 4.75, 6.0, 50, 58, entab, { cut: entCut, tag: 'entab' });
  const pedCut = gap
    ? (u: number, v: number, z: number): boolean => {
        void v;
        return u < 3.9 + Math.sin(z * 0.8) * 0.1 && u > 2.9 - z * 0.004 && z < 70 - (u - 2.9) * 3;
      }
    : undefined;
  const pediment: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    if (c.edge) return cream[0];
    if (c.side !== 'left') return slateRoof(c);
    // Tympanum: raking cornice band, recessed field, relief.
    const apexZ = 74 - (Math.abs(c.u - 4.5) / 2.2) * 16;
    const fromTop = apexZ - c.z;
    if (fromTop < 2) return lv(cream, c.level + 1);
    if (fromTop < 3) return lv(cream, c.level - 2);
    if (c.fz <= 59) return c.fz === 59 ? lv(cream, c.level - 2) : lv(cream, c.level + 1);
    const rk = sampleModule(RELIEF, c, 44, 71);
    if (rk) {
      const col = moduleColour(RELIEF, rk, c)!;
      return state >= 3 && hash(c.fx, c.fz) < 0.3 ? lv(R.char, c.level) : col;
    }
    return lv(cream, c.level - 2);
  };
  s.gable(2.3, 6.7, 4.75, 6.05, 58, 74, 'v', pediment, { cut: pedCut, tag: 'pediment' });

  // Flagpole behind the pediment (flag overlay at its top).
  const poleTop = state >= 4 ? 100 : 112;
  s.line(
    [
      [4.5, 4.4, 70],
      [4.5, 4.4, poleTop],
    ],
    'gray2',
  );
  s.line(
    [
      [4.5, 4.4, poleTop],
      [4.5, 4.4, poleTop + 1],
    ],
    'ochre2',
  );
  ov.push({
    sprite: state >= 2 ? 'lm.flag.es.torn' : 'lm.flag.es',
    u: 4.5,
    v: 4.4,
    z: poleTop,
    flag: true,
  });

  // Railings and fernandina lamps in front.
  for (const [ua, ub] of [
    [0.3, 1.45],
    [7.55, 8.7],
  ] as const) {
    s.line(
      [
        [ua, 6.95, 6],
        [ub, 6.95, 6],
      ],
      'ink',
    );
    for (let u = ua; u <= ub + 1e-6; u += 0.125) {
      s.line(
        [
          [u, 6.95, 1],
          [u, 6.95, 6],
        ],
        'gray1',
      );
      s.line(
        [
          [u, 6.95, 7],
          [u, 6.95, 7],
        ],
        'ochre2',
      );
    }
  }
  const lp = lamp(state >= 2);
  s.sprite(lp.img, 2, 14, 0.9, 6.55, 1, { emit: state >= 2 ? undefined : lp.night });
  s.sprite(lp.img, 2, 14, 8.1, 6.55, 1, { emit: lp.night });

  return { scene: s, overlays: ov };

  function lunette(c: ShadeCtx): 'g' | 'f' | null {
    const pitch = 16;
    const rel = mod(c.fx - 4, pitch);
    const cx = 6;
    const dx = rel - cx;
    const dz = c.z - 61;
    const r = Math.hypot(dx / 1.0, dz * 1.1);
    if (dz < 0) return null;
    if (r < 4) return 'g';
    if (r < 5.2) return 'f';
    return null;
  }
}
