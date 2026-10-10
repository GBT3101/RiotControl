/**
 * Barcelona — Parlament de Catalunya (the former arsenal of the Ciutadella). Footprint 9 (u) ×
 * 6 (v). A classical palace front facing +v (the park): pale ochre stucco with white stone
 * trims, rusticated ground floor with arched windows, balconied piano nobile under alternating
 * pediments, statue-topped balustrade, end pavilions, and the central pavilion — arched loggia,
 * giant Corinthian order and the pediment with the Catalan arms. The Senyera flies beside the
 * Spanish flag. In front: the oval pond with Llimona's marble "Desconsol".
 */
import { Scene, type Material, type ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, mod_, moduleColour, plain, sampleModule } from '../engine/materials';
import {
  balustradeCut,
  banner,
  column,
  decalAt,
  roofMat,
  rubble,
  scatterDecals,
  scorchZones,
  stairs,
  stepMat,
  type DamageState,
} from '../engine/kit';
import type { Build, Overlay } from '../types';
import { figure, lamp, marbleStatue } from '../props';
import {
  S,
  holeCut,
  holeRim,
  interior,
  ovalBasin,
  saulo,
  windows,
  type Hole,
  type WinSlot,
} from '../rome/common';
import { DESCONSOL } from './figures.grid';

export const PARLAMENT_W = 9;
export const PARLAMENT_D = 6;

const Y = S.stucco;
const T = R.limePale;

const WIN_ARCH = mod_(
  `
  ..FFF..
  .FgggF.
  FggGggF
  FgGgggF
  FgggmgF
  FmmmmmF
  FgggmgF
  FgggmgF
  FgggmgF
  sssssss
  `,
  {
    F: { r: T, d: 0 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: T, d: -1 },
    s: { r: T, d: 1 },
  },
  { g: 'ochre1', G: 'ochre2', m: 'ochre1' },
);

const WIN_TRI = mod_(
  `
  ....P....
  ..PPpPP..
  PPpppppPP
  .FFFFFFF.
  .FgGgmgF.
  .FggGmgF.
  .FgggmgF.
  .FmmmmmF.
  .FgGgmgF.
  .FgggmgF.
  .FgggmgF.
  .FgggmgF.
  .FgggmgF.
  `,
  {
    P: { r: T, d: 1 },
    p: { r: T, d: -1 },
    F: { r: T, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: T, d: -1 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

const WIN_SEG = mod_(
  `
  ..PPPPP..
  .PpppppP.
  PPPPPPPPP
  .FFFFFFF.
  .FgGgmgF.
  .FggGmgF.
  .FgggmgF.
  .FmmmmmF.
  .FgGgmgF.
  .FgggmgF.
  .FgggmgF.
  .FgggmgF.
  .FgggmgF.
  `,
  WIN_TRI.keys,
  WIN_TRI.night,
);

const WIN_ATTIC = mod_(
  `
  FFFFF
  FgGgF
  FgggF
  FFFFF
  `,
  { F: { r: T, d: 0 }, g: R.dark, G: { r: R.glass, d: 0 } },
  { g: 'ochre1', G: 'ochre2' },
);

/** Catalan arms in the tympanum: a lozenge shield of gold and red pales under a crown. */
const ARMS = mod_(
  `
  ....yoy....
  ...yyyyy...
  ...ooooo...
  ..ryryryr..
  ..ryryryr..
  ..ryryryr..
  ...ryryr...
  ....ryr....
  .....r.....
  `,
  { y: 'ochre3', o: 'ochre1', r: 'crim1' },
  { y: 'ochre4', o: 'ochre2' },
);

const BAYS = [11, 23, 35, 47, 97, 109, 121, 133];
const SIDE_BAYS = [14, 28, 42, 56];

export function buildParlament(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 5500;

  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'body', 4, 50, 3, 18],
      ['left', 'body', 94, 140, 3, 18],
      ['right', 'body', 8, 66, 3, 18],
      ['left', 'pav', 54, 90, 3, 18],
      ['left', 'stairs', 54, 90, 1, 6],
      ['left', 'rim', 40, 104, 0, 3],
    ],
    1.4,
  );
  const holes: Hole[] =
    state >= 4
      ? [
          { side: 'left', fx: 120, z: 30, r: 7 },
          { side: 'right', fx: 30, z: 20, r: 8 },
        ]
      : [];
  const scorch = scorchZones(
    state === 3
      ? [[2.3, 2.2, 0.8]]
      : state >= 4
        ? [
            [2.2, 2.2, 1.3],
            [6.9, 2.6, 1.2],
            [4.5, 1.2, 0.7],
          ]
        : [],
  );
  if (state >= 3) ov.push({ sprite: 'lm.fx.smoke', u: 2.3, v: 2.2, z: 62 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 2.2, v: 2.4, z: 54 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 6.9, v: 2.6, z: 56 });
  }

  // --- Windows ----------------------------------------------------------------------------
  const frontV = (fx: number): number => (fx < 26 || fx > 118 ? 4.1 : 3.9);
  const slots: WinSlot[] = [];
  BAYS.forEach((b, k) => {
    const plane = frontV(b);
    slots.push({ side: 'left', fx: b - 3, zTop: 17, m: WIN_ARCH, plane });
    slots.push({ side: 'left', fx: b - 4, zTop: 39, m: k % 2 ? WIN_SEG : WIN_TRI, plane });
    slots.push({ side: 'left', fx: b - 2, zTop: 47, m: WIN_ATTIC, plane });
  });
  // Central pavilion: three tall windows between the giant columns.
  for (const b of [62, 72, 82]) {
    slots.push({ side: 'left', fx: b - 4, zTop: 43, m: b === 72 ? WIN_TRI : WIN_SEG, plane: 4.25 });
  }
  SIDE_BAYS.forEach((b, k) => {
    slots.push({ side: 'right', fx: b - 3, zTop: 17, m: WIN_ARCH, plane: 8.6 });
    slots.push({ side: 'right', fx: b - 4, zTop: 39, m: k % 2 ? WIN_SEG : WIN_TRI, plane: 8.6 });
    slots.push({ side: 'right', fx: b - 2, zTop: 47, m: WIN_ATTIC, plane: 8.6 });
  });
  const win = windows(slots, state, seed, ov, 3);
  const inside = interior(state);

  const wall =
    (tag: 'body' | 'pav' | 'end', top: number): Material =>
    (c: ShadeCtx) => {
      if (c.side === 'back') return inside(c);
      if (c.side === 'top') return c.night ? null : lv(T, c.level);
      const side = c.side === 'right' ? 'right' : 'left';
      const he = holeRim(holes, c, side, S.redBrick);
      if (he !== undefined) return he;
      const w = win.paint(c, side);
      if (w !== undefined) return w;
      if (tag === 'pav' && side === 'left') {
        // Arched loggia: three round-headed openings.
        for (const cx of [60, 72, 84]) {
          const dx = c.fx + 0.5 - cx;
          if (Math.abs(dx) < 4 && c.z > 3 && (c.z < 10 || Math.hypot(dx, c.z - 10) < 4)) {
            if (c.night) return c.z < 12 ? 'ochre1' : null;
            if (state >= 3) return hash(c.fx, c.fz) < 0.2 ? 'rust1' : 'ink';
            return c.z < 5 ? 'gray1' : lv(R.dark, c.level + 1);
          }
          if (Math.abs(dx) < 5.5 && c.z > 3 && (c.z < 10 || Math.hypot(dx, c.z - 10) < 5.5))
            return c.night ? null : lv(T, c.level + (Math.abs(dx) < 1 && c.z > 18 ? 1 : 0));
        }
      }
      if (c.night) return null;
      const d = decalAt(decals, c);
      if (d) return d;
      const sd = win.soot(c, side);
      if (sd) return sd;
      if (c.edge) return lv(Y, c.level - 2);
      const z = c.fz;
      // Cornice + frieze.
      if (z >= top - 2) return lv(T, c.level + 1);
      if (z === top - 3) return lv(T, c.level - 1);
      if (z === top - 4) return mod(c.fx, 2) ? lv(T, c.level - 2) : lv(T, c.level);
      if (z >= top - 6) return lv(T, c.level);
      if (z <= 2) return lv(T, c.level - 1);
      // Ground floor: banded rustication in pale stone.
      if (z < 20) {
        if (z === 19) return lv(T, c.level + 1);
        if (mod(z, 3) === 0) return lv(T, c.level - 1);
        return lv(T, c.level - (mod(c.fx + Math.floor(z / 3) * 4, 8) === 0 ? 1 : 0));
      }
      if (z === 20) return lv(T, c.level - 1);
      // Quoins at the corners of each block.
      const quoin =
        side === 'left'
          ? tag === 'end'
            ? mod(c.fx, 16) <= 2 || mod(c.fx, 16) >= 15 || c.fx <= 9 || c.fx >= 135
            : c.fx <= 26 || c.fx >= 118
              ? false
              : c.fx <= 54 || c.fx >= 90
          : c.fx >= 62 || c.fx <= 9;
      if (quoin && tag !== 'pav' && (c.fx <= 9 || c.fx >= 135 || tag === 'end' || side === 'right'))
        return lv(T, c.level + (mod(z, 6) < 3 ? 0 : -1));
      return lv(Y, c.level);
    };

  // --- Ground: park sauló, lawns, the pond -------------------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side === 'top') {
      const lawnBed = c.v > 4.6 && (c.u < 1.8 || c.u > 7.2);
      if (lawnBed) {
        if (state >= 2 && hash(Math.floor(c.u * 6), Math.floor(c.v * 6)) < 0.22 * (state - 1))
          return lv(R.gravel, c.level - 1);
        return lv(R.grass, c.level - 1 - (mod(c.px * 3 + c.py * 5, 11) === 0 ? 1 : 0));
      }
    }
    return saulo(c);
  };
  s.box(0, PARLAMENT_W, 0, PARLAMENT_D, 0, 1, ground, { cast: false, tag: 'ground' });

  // --- Blocks ----------------------------------------------------------------------------------
  const cut = holeCut(holes);
  s.box(1.6, 7.4, 0.5, 3.9, 1, 48, wall('body', 48), { tag: 'body', cut });
  for (const u0 of [0.4, 7.4])
    s.box(u0, u0 + 1.2, 0.4, 4.1, 1, 52, wall('end', 52), { tag: 'end', cut });
  s.box(3.35, 5.65, 3.6, 4.25, 1, 50, wall('pav', 50), { tag: 'pav' });

  // Roofs: slate, hipped behind the balustrade; end pavilions a little higher.
  const roof = roofMat(R.slateLit, scorch, 3);
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.75
      : undefined;
  s.hip(1.7, 7.3, 0.6, 3.8, 48, 58, 1.1, roof, { cut: roofCut });
  for (const u0 of [0.4, 7.4])
    s.hip(u0 + 0.08, u0 + 1.12, 0.48, 4.02, 52, 62, 0.5, roof, { cut: roofCut });

  // Balustrade with statues / urns along the main block.
  const bal: Material = (c) => (c.night ? null : c.edge ? T[0] : lv(T, c.level));
  s.box(1.6, 3.35, 3.78, 3.9, 48, 53, bal, { cut: balustradeCut(48, 53) });
  s.box(5.65, 7.4, 3.78, 3.9, 48, 53, bal, { cut: balustradeCut(48, 53) });
  for (const u of [1.7, 2.5, 3.25, 5.75, 6.5, 7.3]) {
    s.box(u - 0.09, u + 0.09, 3.76, 3.92, 48, 54, bal);
    if (state >= 4 && u === 6.5) continue;
    s.ell(u, 3.84, 56, 0.08, 0.08, 3, plain(T, { rim: true }), { zMin: 54 });
  }
  for (const u of [0.55, 1.45, 7.55, 8.45])
    s.ell(u, 4.0, 55, 0.1, 0.1, 3, plain(T, { rim: true }), { zMin: 52 });

  // --- Central pavilion: balcony, giant columns, pediment with the arms ------------------------
  const slab: Material = (c) =>
    c.night ? null : c.edge ? T[0] : lv(T, c.level - (c.side !== 'top' ? 1 : 0));
  s.box(3.35, 5.65, 4.25, 4.55, 20, 22, slab);
  s.box(3.35, 5.65, 4.47, 4.55, 22, 26, bal, { cut: balustradeCut(22, 26) });
  const broken = state >= 4 ? new Map([[1, 34]]) : new Map<number, number>();
  [3.5, 4.15, 4.85, 5.5].forEach((u, k) =>
    column(s, { u, v: 4.38, z0: 22, z1: 50, r: 0.1, ramp: T, brokenAt: broken.get(k), tag: 'col' }),
  );
  if (state >= 4) s.cyl(4.0, 5.05, 0.1, 6, 10, plain(T));
  const entab: Material = (c) => {
    if (c.side === 'back') return inside(c);
    if (c.night) return null;
    if (c.edge) return T[0];
    if (c.side === 'top') return lv(T, c.level);
    if (c.fz >= 55) return lv(T, c.level + 1);
    if (c.fz === 54) return mod(c.fx, 2) ? lv(T, c.level - 2) : lv(T, c.level);
    if (c.fz === 50) return lv(T, c.level - 1);
    return lv(T, c.level);
  };
  s.box(3.3, 5.7, 3.6, 4.55, 50, 57, entab);
  const pediment: Material = (c) => {
    if (c.side === 'back') return inside(c);
    if (c.night) {
      if (c.side === 'left') {
        const k = sampleModule(ARMS, c, 67, 67);
        if (k) return moduleColour(ARMS, k, c);
      }
      return null;
    }
    if (c.edge) return T[0];
    if (c.side !== 'left') return roof(c);
    const apexZ = 69 - (Math.abs(c.u - 4.5) / 1.2) * 12;
    const fromTop = apexZ - c.z;
    if (fromTop < 2) return lv(T, c.level + 1);
    if (fromTop < 3) return lv(T, c.level - 2);
    if (c.fz <= 58) return c.fz === 58 ? lv(T, c.level - 2) : lv(T, c.level + 1);
    const k = sampleModule(ARMS, c, 67, 67);
    if (k) {
      if (state >= 3 && hash(c.fx, c.fz) < 0.35) return lv(R.char, c.level);
      return moduleColour(ARMS, k, c);
    }
    return lv(T, c.level - 2);
  };
  s.gable(3.3, 5.7, 3.6, 4.55, 57, 69, 'v', pediment);
  for (const [u, z] of [
    [4.5, 69],
    [3.38, 57],
    [5.62, 57],
  ] as const) {
    s.box(u - 0.08, u + 0.08, 4.0, 4.16, z, z + 3, bal);
    s.ell(u, 4.08, z + 5, 0.07, 0.07, 3, plain(R.gold, { rim: true }), { zMin: z + 3 });
  }

  // Stair up to the loggia.
  stairs(s, 3.45, 5.55, 4.95, 4.25, 1, 4, 3, stepMat(T, decals));

  // --- Flags: the Senyera and the Spanish flag on the roof behind the pediment -----------------
  const poleTop = state >= 4 ? 96 : 108;
  for (const [u, code] of [
    [3.55, 'cat'],
    [5.45, 'es'],
  ] as const) {
    s.line(
      [
        [u, 3.4, 56],
        [u, 3.4, poleTop],
      ],
      'gray2',
    );
    s.line(
      [
        [u, 3.4, poleTop],
        [u, 3.4, poleTop + 1],
      ],
      'ochre2',
    );
    ov.push({
      sprite: state >= 2 ? `lm.flag.${code}.torn` : `lm.flag.${code}`,
      u,
      v: 3.4,
      z: poleTop,
      flag: true,
    });
  }

  // --- The pond with "Desconsol" --------------------------------------------------------------
  ovalBasin(s, 4.5, 5.42, 1.55, 0.45, 4, 0, 4, T, 0.1);
  const rock: Material = (c) => (c.night ? null : c.edge ? R.granite[0] : lv(R.granite, c.level));
  s.hip(4.3, 4.75, 5.25, 5.6, 1, 5, 0.18, rock);
  if (state >= 3) s.sprite(marbleStatue('seated', true), 9, 12, 4.95, 5.6, 1);
  else s.sprite(figure(DESCONSOL, 'marble', 'desconsol'), 5, 8, 4.52, 5.42, 5);

  // Lamps at the corners of the forecourt.
  const lp = lamp(state >= 2);
  s.sprite(lp.img, 2, 14, 2.0, 4.75, 1, { emit: state >= 2 ? undefined : lp.night });
  s.sprite(lp.img, 2, 14, 7.0, 4.75, 1, { emit: lp.night });

  banner(s, state, 3.6, 5.4, 4.6, 26, 8, 'PROU!');
  rubble(s, state, 3.4, 5.6, 4.3, 4.95, 1, 7, seed);
  rubble(s, state, 0.4, 2.8, 4.3, 5.9, 1, 5, seed + 1);
  rubble(s, state, 6.4, 8.6, 4.3, 5.9, 1, 5, seed + 2);
  return { scene: s, overlays: ov };
}
