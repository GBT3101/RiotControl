/**
 * Rome — Palazzo Montecitorio (Camera dei Deputati). Footprint 9 (u) × 6 (v). Bernini's front
 * faces +v (the lit SW face): a gently convex façade (five stepped segments, the centre
 * projecting most) of sienna render framed in travertine, giant pilasters, balconied piano
 * nobile, the rough-rock rustication at the ground-floor sills, the column-borne central
 * balcony over the portal and, on the roofline, the clock attic with its bell gable. The red
 * granite obelisk of Psammetichus II (the sundial gnomon, with its bronze meridian in the
 * paving) stands on the sampietrini piazza in front.
 */
import { Scene, type Material, type ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, mod_, moduleColour, plain, sampleModule } from '../engine/materials';
import {
  balustradeCut,
  banner,
  breakAbove,
  column,
  decalAt,
  rubble,
  scatterDecals,
  scorchZones,
  stairs,
  stepMat,
  type DamageState,
} from '../engine/kit';
import type { Build, Overlay } from '../types';
import { lamp } from '../props';
import {
  S,
  coppi,
  faceDist,
  holeCut,
  holeRim,
  interior,
  sampietrini,
  windows,
  type Hole,
  type WinSlot,
} from './common';

export const MONTECITORIO_W = 9;
export const MONTECITORIO_D = 6;

const T = S.travertine;
const W = S.sienna;

/** Piano nobile: eared travertine frame under a segmental pediment. */
const WIN_NOBLE = mod_(
  `
  ..PPPPP..
  .PpppppP.
  PPPPPPPPP
  .FFFFFFF.
  FFgGgmgFF
  .FggGmgF.
  .FgggmgF.
  .FmmmmmF.
  .FgGgmgF.
  .FgggmgF.
  .FgggmgF.
  .FgggmgF.
  .FgggmgF.
  .sssssss.
  `,
  {
    P: { r: T, d: 1 },
    p: { r: T, d: -2 },
    F: { r: T, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: T, d: -1 },
    s: { r: T, d: 0 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

/** Ground floor: barred window in a plain travertine frame. */
const WIN_GROUND = mod_(
  `
  FFFFFFF
  FgkgkgF
  FGkgkgF
  FkkkkkF
  FgkgkgF
  FgkgkgF
  FgkgkgF
  sssssss
  `,
  {
    F: { r: T, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    k: 'ink',
    s: { r: T, d: 0 },
  },
  { g: 'ochre1', G: 'ochre2' },
);

/** Second floor: smaller window under a flat cornice. */
const WIN_SECOND = mod_(
  `
  PPPPPPP
  .ppppp.
  .FFFFF.
  .FgGgF.
  .FgggF.
  .FmmmF.
  .FgGgF.
  .FgggF.
  .FgggF.
  .sssss.
  `,
  {
    P: { r: T, d: 1 },
    p: { r: T, d: -2 },
    F: { r: T, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: T, d: -1 },
    s: { r: T, d: 0 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

/** Mezzanine / attic square window. */
const WIN_ATTIC = mod_(
  `
  FFFFF
  FgGgF
  FgggF
  FFFFF
  `,
  { F: { r: T, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 } },
  { g: 'ochre1', G: 'ochre2' },
);

/** Main portal: arched door of studded walnut in a travertine surround. */
const DOOR = mod_(
  `
  ....PPPPP....
  ..PPpppppPP..
  .PppbbbbbppP.
  .PpbbbbbbbpP.
  PpbbBBoBBbbpP
  PpbBBBoBBBbpP
  PpbyBBoBByb.P
  PpbBBBoBBBbpP
  PpbbBBoBBbbpP
  PpbyBBoBBybpP
  PpbBBBoBBBbpP
  PpbbBBoBBbbpP
  PpbBBBoBBBbpP
  PpbbbbobbbbpP
  `,
  {
    P: { r: T, d: 1 },
    p: { r: T, d: -1 },
    b: 'earth1',
    B: 'earth2',
    o: 'earth0',
    y: 'ochre2',
  },
  { y: 'ochre3' },
);

// Stepped convex front: [u0, u1, vFront] — ends flush, centre proud.
const SEGS: ReadonlyArray<readonly [number, number, number]> = [
  [0.3, 1.9, 4.3],
  [1.9, 3.3, 4.42],
  [3.3, 5.7, 4.55],
  [5.7, 7.1, 4.42],
  [7.1, 8.7, 4.3],
];
const frontV = (u: number): number => {
  for (const [a, b, v] of SEGS) if (u >= a && u < b) return v;
  return 4.3;
};
/** Bay centres on the front (face px); 72 = the central portal / balcony bay. */
const BAYS = [12, 23, 36, 47, 60, 72, 84, 97, 108, 121, 132];
/** Bay centres on the +u side (face px along v). */
const SIDE_BAYS = [14, 26, 38, 50, 61];
/** Giant pilasters (face px ranges) on the front. */
const PILASTERS: ReadonlyArray<readonly [number, number]> = [
  [5, 7],
  [29, 31],
  [52, 54],
  [65, 66],
  [78, 79],
  [90, 92],
  [113, 115],
  [137, 139],
];

const OB = { u: 1.35, v: 5.25 };

export function buildMontecitorio(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 4400;

  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'body', 6, 50, 4, 18],
      ['left', 'body', 94, 138, 4, 18],
      ['right', 'body', 8, 66, 4, 18],
      ['left', 'terrace', 34, 110, 1, 4],
      ['left', 'ped', 18, 26, 4, 18],
      ['right', 'ped', 80, 90, 4, 18],
      ['left', 'stairs', 54, 90, 1, 4],
    ],
    1.4,
  );
  const holes: Hole[] =
    state >= 4
      ? [
          { side: 'left', fx: 33, z: 31, r: 7 },
          { side: 'right', fx: 40, z: 22, r: 8 },
        ]
      : [];
  const scorch = scorchZones(
    state === 3
      ? [[6.6, 2.0, 0.8]]
      : state >= 4
        ? [
            [6.7, 2.0, 1.4],
            [2.0, 2.8, 1.1],
            [4.6, 1.2, 0.7],
          ]
        : [],
  );
  if (state >= 3) ov.push({ sprite: 'lm.fx.smoke', u: 6.6, v: 2.0, z: 74 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 6.7, v: 2.2, z: 66 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 2.0, v: 2.8, z: 66 });
  }

  // --- Windows ----------------------------------------------------------------------------
  const slots: WinSlot[] = [];
  for (const b of BAYS) {
    const plane = frontV(b / 16);
    if (b !== 72) {
      slots.push({ side: 'left', fx: b - 4, zTop: 37, m: WIN_NOBLE, plane });
      slots.push({ side: 'left', fx: b - 3, zTop: 17, m: WIN_GROUND, plane });
    } else {
      slots.push({ side: 'left', fx: b - 4, zTop: 39, m: WIN_NOBLE, plane });
    }
    slots.push({ side: 'left', fx: b - 3, zTop: 50, m: WIN_SECOND, plane });
    slots.push({ side: 'left', fx: b - 2, zTop: 56, m: WIN_ATTIC, plane });
  }
  for (const b of SIDE_BAYS) {
    slots.push({ side: 'right', fx: b - 4, zTop: 37, m: WIN_NOBLE, plane: 8.7 });
    slots.push({ side: 'right', fx: b - 3, zTop: 17, m: WIN_GROUND, plane: 8.7 });
    slots.push({ side: 'right', fx: b - 3, zTop: 50, m: WIN_SECOND, plane: 8.7 });
    slots.push({ side: 'right', fx: b - 2, zTop: 56, m: WIN_ATTIC, plane: 8.7 });
  }
  const win = windows(slots, state, seed, ov, 3);

  // --- Materials --------------------------------------------------------------------------
  const inside = interior(state);
  const pilaster = (side: 'left' | 'right', fx: number): boolean =>
    side === 'left' ? PILASTERS.some(([a, b]) => fx >= a && fx <= b) : fx <= 9 || fx >= 66;

  const wall: Material = (c) => {
    if (c.side === 'back') return inside(c);
    if (c.side === 'top') return c.night ? null : lv(T, c.level);
    const side = c.side === 'right' ? 'right' : 'left';
    const he = holeRim(holes, c, side);
    if (he !== undefined) return he;
    const w = win.paint(c, side);
    if (w !== undefined) return w;
    // The little +u returns of the stepped segments are travertine.
    if (side === 'right' && c.u < 8.6) return c.night ? null : c.edge ? T[0] : lv(T, c.level + 1);
    if (side === 'left' && Math.abs(c.v - 4.55) < 0.05) {
      const dk = sampleModule(DOOR, c, 66, 17);
      if (dk !== null) {
        if (state >= 3 && !c.night && (dk === 'b' || dk === 'B' || dk === 'o'))
          return hash(c.fx, c.fz) < 0.3 ? 'rust1' : 'ink';
        return moduleColour(DOOR, dk, c);
      }
    }
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    const sd = win.soot(c, side);
    if (sd) return sd;
    if (c.edge) return lv(W, c.level - 2);
    const z = c.fz;
    // Cornice: dentils, corona, cymatium.
    if (z >= 61) return lv(T, c.level + 1);
    if (z === 60) return lv(T, c.level - 1);
    if (z >= 58) return lv(T, c.level + (z === 59 ? 1 : 0));
    if (z === 57) return mod(c.fx, 2) ? lv(T, c.level - 2) : lv(T, c.level);
    const pil = pilaster(side, c.fx);
    // Plinth.
    if (z <= 3) return lv(T, c.level - 1);
    // Ground floor: rusticated travertine at the pilasters (Bernini's rough rocks low down),
    // banded sienna between.
    if (z < 20) {
      if (pil) {
        if (z < 10 && hash(c.fx >> 1, z >> 1, 7) < 0.45) return lv(T, c.level - 1);
        if (mod(z, 4) === 0) return lv(T, c.level - 2);
        return lv(T, c.level + (mod(c.fx + Math.floor(z / 4) * 2, 4) === 0 ? -1 : 0));
      }
      // Rough "scogli" under the ground windows of the end segments.
      if (z >= 4 && z <= 8 && side === 'left' && (c.fx < 30 || c.fx > 113)) {
        const b = BAYS.find((x) => Math.abs(c.fx - x) <= 3);
        if (b !== undefined) {
          const r = hash(c.fx, z, 3);
          return r < 0.3 ? lv(T, c.level - 2) : r < 0.7 ? lv(T, c.level - 1) : lv(T, c.level);
        }
      }
      if (mod(z, 4) === 0) return lv(W, c.level - 1);
      return lv(W, c.level);
    }
    if (z === 20) return lv(T, c.level - 1);
    if (z === 21) return lv(T, c.level + 1);
    if (pil) {
      // Giant-order pilaster: lit fillet on the left, capital band under the cornice.
      if (z >= 54) return lv(T, c.level + (mod(c.fx, 2) ? 0 : 1));
      if (side === 'left' && PILASTERS.some(([a]) => c.fx === a)) return lv(T, c.level + 1);
      return lv(T, c.level);
    }
    if (z === 38) return lv(T, c.level - 1);
    if (z === 39) return lv(T, c.level);
    if (z === 52) return lv(T, c.level);
    return lv(W, c.level);
  };

  // --- Ground: piazza in sampietrini, bronze meridian -------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side === 'top') {
      // Meridian line running away from the obelisk along the piazza, with tick marks.
      if (Math.abs(c.v - 5.72) < 0.035 && c.u > 1.9 && c.u < 8.7)
        return mod(c.u * 4, 1) < 0.12 ? 'ochre3' : lv(R.gold, c.level - 1);
    }
    return sampietrini(c);
  };
  s.box(0, MONTECITORIO_W, 0, MONTECITORIO_D, 0, 1, ground, { cast: false, tag: 'ground' });

  // --- Palace body: five stepped segments ----------------------------------------------------
  const cut = holeCut(holes);
  for (const [u0, u1, vf] of SEGS) s.box(u0, u1, 0.4, vf, 1, 62, wall, { tag: 'body', cut });

  // Terracotta roof with the Aula's glass lantern.
  const roof = coppi(S.tileOld, scorch);
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.75
      : undefined;
  s.hip(0.45, 8.55, 0.55, 4.18, 62, 76, 1.2, roof, { cut: roofCut });
  const glass: Material = (c) => {
    if (c.night) return mod(c.fx, 4) === 0 || mod(c.fz, 3) === 0 ? null : 'ochre2';
    if (c.edge) return 'ink';
    if (state >= 2 && mod(c.fx, 7) < 2 && c.side !== 'top') return 'ink';
    if (mod(c.fx, 4) === 0 || mod(c.fz, 3) === 0) return lv(R.metal, c.level);
    return lv(R.glassSky, c.level);
  };
  s.hip(3.0, 6.0, 1.3, 2.9, 76, 83, 0.7, glass);
  const chimney: Material = (c) =>
    c.night ? null : c.edge ? W[0] : c.fz >= 79 ? lv(S.terracotta, c.level) : lv(W, c.level);
  for (const [u, v] of [
    [1.3, 1.2],
    [7.8, 1.0],
    [7.9, 3.2],
    [2.4, 0.9],
  ] as const) {
    s.box(u - 0.14, u + 0.14, v - 0.1, v + 0.1, 66, 81, chimney);
  }

  // Balconies with wrought-iron railings under the piano-nobile windows.
  const slab: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return T[0];
    return c.side === 'top' ? lv(T, c.level) : lv(T, c.level - (c.fz <= 21 ? 1 : 0));
  };
  for (const b of BAYS) {
    if (b === 72) continue;
    const u0 = (b - 4) / 16;
    const u1 = (b + 5) / 16;
    const vf = frontV(b / 16);
    s.box(u0, u1, vf, vf + 0.13, 21, 23, slab, { tag: 'balcony' });
    const vr = vf + 0.12;
    s.line(
      [
        [u0, vr, 27],
        [u1, vr, 27],
      ],
      'gray1',
    );
    for (let u = u0; u <= u1 + 1e-6; u += 1 / 8) {
      s.line(
        [
          [u, vr, 23],
          [u, vr, 26],
        ],
        'gray2',
      );
    }
  }

  // Raised terrace before the centre, steps, the portal columns and the central balcony.
  const terraceMat: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return T[0];
    if (c.side === 'top') return lv(T, c.level - (mod(c.u * 4, 1) < 0.08 ? 1 : 0));
    return lv(T, c.level - (c.fz === 1 ? 1 : 0));
  };
  s.box(1.9, 7.1, 4.3, 4.95, 1, 4, terraceMat, { tag: 'terrace' });
  stairs(s, 3.1, 5.9, 5.6, 4.95, 1, 4, 3, stepMat(T, decals));
  const broken = state >= 4 ? new Map([[2, 13]]) : new Map<number, number>();
  [3.86, 4.12, 4.88, 5.14].forEach((u, k) =>
    column(s, {
      u,
      v: 4.76,
      z0: 4,
      z1: 21,
      r: 0.085,
      ramp: T,
      order: 'doric',
      brokenAt: broken.get(k),
      tag: 'col',
    }),
  );
  if (state >= 4) {
    s.cyl(4.95, 5.35, 0.085, 4, 7, plain(T));
    s.box(5.2, 5.45, 5.25, 5.45, 1, 4, plain(T));
  }
  s.box(3.62, 5.38, 4.55, 4.96, 21, 24, slab, { tag: 'balcony' });
  const bal: Material = (c) => (c.night ? null : c.edge ? T[0] : lv(T, c.level));
  s.box(3.62, 5.38, 4.88, 4.96, 24, 29, bal, { cut: balustradeCut(24, 29) });
  s.box(3.62, 3.7, 4.55, 4.96, 24, 29, bal, { cut: balustradeCut(24, 29) });
  s.box(5.3, 5.38, 4.55, 4.96, 24, 29, bal, { cut: balustradeCut(24, 29) });

  // --- Clock attic + bell gable on the roofline ---------------------------------------------------
  const clockMat = (c: ShadeCtx): string | null => {
    if (c.side === 'back') return inside(c);
    if (c.side === 'top') return c.night ? null : lv(T, c.level);
    if (c.side === 'left') {
      const r = faceDist(c, 72, 73);
      if (r < 6.2) {
        if (state >= 4 && r > 1.5 && hash(c.fx, c.fz) < 0.55) return c.night ? null : 'ink';
        const ang = Math.atan2(c.z - 73, c.fx + 0.5 - 72);
        const hands =
          state < 4 &&
          ((Math.abs(ang - 1.9) < 0.22 && r < 5) || (Math.abs(ang + 0.6) < 0.25 && r < 3.6));
        if (c.night) return hands ? 'ink' : 'ochre4';
        if (hands) return 'ink';
        if (state >= 3 && c.fx > 72 && c.z > 73) return lv(R.char, c.level + 1);
        const hour = mod((ang / (Math.PI / 6)) + 0.5, 1);
        if (r > 4.4 && Math.abs(hour - 0.5) < 0.18) return 'ink';
        return c.level >= 3 ? 'white' : 'stone4';
      }
      if (c.night) return null;
      if (r < 7.4) return lv(R.gold, c.level - (r > 6.8 ? 1 : 0));
      const d = decalAt(decals, c);
      if (d) return d;
    }
    if (c.night) return null;
    if (c.edge) return T[0];
    if (c.fz >= 82) return lv(T, c.level + 1);
    if (c.fz === 81) return lv(T, c.level - 1);
    if (c.fz <= 64) return lv(T, c.level - 1);
    const local = c.side === 'left' ? c.fx - 61 : c.fx - 64;
    if (local <= 1 || (c.side === 'left' && c.fx >= 81)) return lv(T, c.level + 1);
    return lv(T, c.level);
  };
  s.box(3.8, 5.2, 4.0, 4.52, 62, 84, clockMat, { tag: 'clock' });
  const scroll = plain(T, { rim: true });
  s.ell(3.8, 4.26, 62, 0.34, 0.22, 11, scroll, { zMin: 62 });
  s.ell(5.2, 4.26, 62, 0.34, 0.22, 11, scroll, { zMin: 62 });
  s.box(3.72, 5.28, 3.94, 4.58, 84, 87, plain(T, { rim: true }));
  const gableCut = state >= 4 ? breakAbove(93, 2) : undefined;
  const bellOpen = (u: number, z: number): boolean => {
    const dx = (u - 4.5) * 16;
    return Math.abs(dx) < 2.6 && z > 88 && (z < 95 || Math.hypot(dx, z - 95) < 2.6);
  };
  const belfry: Material = (c) => {
    if (c.side === 'back') return c.night ? null : lv(T, 1);
    if (c.night) return null;
    if (c.edge) return T[0];
    if (c.fz >= 99) return lv(T, c.level + 1);
    return lv(T, c.level);
  };
  s.box(4.15, 4.85, 4.12, 4.36, 87, 100, belfry, {
    cut: (u, v, z, f) => (gableCut?.(u, v, z) ?? false) || ((f === 2 || f === 3) && bellOpen(u, z)),
  });
  if (state < 4) {
    s.gable(4.1, 4.9, 4.08, 4.4, 100, 105, 'v', plain(T, { rim: true }));
    s.ell(4.5, 4.24, 94, 0.07, 0.07, 3.5, plain(R.bronze), { zMin: 91 });
    s.line(
      [
        [4.5, 4.24, 105],
        [4.5, 4.24, 110],
      ],
      'gray1',
    );
    s.line(
      [
        [4.5, 4.24, 110],
        [4.5, 4.24, 111],
      ],
      'ochre2',
    );
  } else {
    ov.push({ sprite: 'lm.fx.fire.s', u: 4.5, v: 4.3, z: 90 });
  }

  // Flagpole behind the clock attic.
  const poleTop = state >= 4 ? 104 : 116;
  s.line(
    [
      [4.5, 3.3, 72],
      [4.5, 3.3, poleTop],
    ],
    'gray2',
  );
  s.line(
    [
      [4.5, 3.3, poleTop],
      [4.5, 3.3, poleTop + 1],
    ],
    'ochre2',
  );
  ov.push({
    sprite: state >= 2 ? 'lm.flag.it.torn' : 'lm.flag.it',
    u: 4.5,
    v: 3.3,
    z: poleTop,
    flag: true,
  });

  // --- The obelisk (gnomon) ----------------------------------------------------------------------
  const ped: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return T[0];
    if (c.side !== 'top' && c.fz >= 8 && c.fz <= 16) {
      // Inscription panel.
      const loc = mod(c.fx, 16);
      if (loc > 3 && loc < 12) {
        if (c.fz === 8 || c.fz === 16) return lv(T, c.level - 1);
        return mod(c.fx, 2) && mod(c.fz, 2) && c.fz < 15 ? lv(T, c.level - 2) : lv(T, c.level + 1);
      }
    }
    return lv(T, c.level);
  };
  s.box(OB.u - 0.42, OB.u + 0.42, OB.v - 0.42, OB.v + 0.42, 1, 3, plain(T));
  s.box(OB.u - 0.3, OB.u + 0.3, OB.v - 0.3, OB.v + 0.3, 3, 19, ped, { tag: 'ped' });
  s.box(OB.u - 0.34, OB.u + 0.34, OB.v - 0.34, OB.v + 0.34, 19, 22, plain(T, { rim: true }));
  const hier: Material = (c) => {
    if (c.night) return c.lambert > 0.4 && c.z < 70 ? (c.lambert > 0.55 ? 'earth5' : 'earth4') : null;
    if (c.edge) return R.pinkGranite[0];
    const col = mod(c.fx, 4);
    const glyph =
      col !== 0 && hash(Math.floor(c.fx / 4), Math.floor(c.fz / 3), 5) < 0.5 && mod(c.fz, 3) !== 0;
    const top = c.fz > 82 ? 0 : c.fz < 40 ? -1 : 0;
    return lv(R.pinkGranite, c.level - (glyph ? 1 : 0) + top);
  };
  const obCut = state >= 4 ? breakAbove(56, 3) : undefined;
  s.prismN(OB.u, OB.v, 0.15, 0.1, 22, 92, 4, hier, { cut: obCut });
  if (state < 4) {
    s.prismN(OB.u, OB.v, 0.1, 0, 92, 98, 4, plain(R.pinkGranite, { rim: true }));
    if (state < 3) {
      s.ell(OB.u, OB.v, 101, 0.085, 0.085, 3.5, plain(R.gold, { rim: true }));
      s.line(
        [
          [OB.u, OB.v, 104],
          [OB.u, OB.v, 109],
        ],
        'ochre2',
      );
    }
  }
  if (state >= 3) {
    // The bronze globe has come down and rolled onto the piazza.
    s.ell(2.05, 5.75, 2.5, 0.085, 0.085, 3.5, plain(R.gold, { rim: true }));
  }
  if (state >= 4) {
    // The top of the shaft lies across the piazza.
    s.box(1.9, 3.3, 5.58, 5.82, 1, 5, hier);
    s.hip(3.3, 3.55, 5.58, 5.82, 1, 5, [0.25, 0], plain(R.pinkGranite));
  }

  // Lamps at the corners of the terrace.
  const lp = lamp(state >= 2);
  s.sprite(lp.img, 2, 14, 2.3, 5.2, 1, { emit: state >= 2 ? undefined : lp.night });
  s.sprite(lp.img, 2, 14, 6.7, 5.2, 1, { emit: lp.night });

  banner(s, state, 3.55, 5.45, 4.99, 29, 9, 'BASTA!');
  rubble(s, state, 3.0, 6.0, 4.9, 5.7, 1, 8, seed);
  rubble(s, state, 0.4, 2.2, 4.4, 5.9, 1, 4, seed + 1);
  rubble(s, state, 7.0, 8.7, 4.4, 5.9, 1, 5, seed + 2);
  return { scene: s, overlays: ov };
}
