/**
 * Milan — Palazzo Marino (the city hall) on Piazza della Scala. Footprint 9 (u) × 6 (v). Its
 * Mannerist grey-stone front faces +v: a rusticated ground floor of arched windows with heavy
 * keystones, a piano nobile of pedimented windows between coupled half-columns, a garlanded
 * upper floor, the deep cornice and the statue-capped balustrade over a terracotta roof; the
 * central portal carries a balcony. In front, on the piazza, Leonardo stands on his pedestal
 * with his four pupils in a little garden; the Tricolore flies above.
 */
import { Scene, type Material } from '../engine/scene';
import { R, hash, lv, mod, plain, type Ramp5 } from '../engine/materials';
import {
  balustradeCut,
  banner,
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
import { figure, lamp, marbleStatue } from '../props';
import {
  S,
  coppi,
  holeCut,
  holeRim,
  interior,
  slabs,
  winArch,
  winPediment,
  winSquare,
  windows,
  type Hole,
  type WinSlot,
} from '../rome/common';
import { LEONARDO, PUPIL } from './figures.grid';

export const MARINO_W = 9;
export const MARINO_D = 6;

const G = S.milanStone;
/** Warmer dressed stone for columns, cornices and frames. */
const D: Ramp5 = ['stone0', 'gray4', 'stone2', 'stone3', 'stone4'];

const BAYS = [11, 24, 37, 50, 61, 72, 83, 94, 107, 120, 133];
const CENTRE = new Set([61, 72, 83]);
const SIDE_BAYS = [14, 27, 40, 53];
const LEO = { u: 7.2, v: 5.05 };

export function buildMarino(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 6600;

  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'body', 4, 52, 3, 18],
      ['left', 'body', 92, 140, 3, 18],
      ['right', 'body', 6, 62, 3, 18],
      ['left', 'centre', 54, 90, 3, 18],
      ['left', 'stairs', 58, 86, 1, 5],
      ['left', 'ped', 112, 124, 4, 22],
    ],
    1.4,
  );
  const holes: Hole[] =
    state >= 4
      ? [
          { side: 'left', fx: 28, z: 30, r: 7 },
          { side: 'right', fx: 44, z: 24, r: 8 },
        ]
      : [];
  const scorch = scorchZones(
    state === 3
      ? [[2.4, 2.0, 0.8]]
      : state >= 4
        ? [
            [2.4, 2.0, 1.4],
            [6.6, 2.7, 1.1],
            [4.6, 1.2, 0.7],
          ]
        : [],
  );
  if (state >= 3) ov.push({ sprite: 'lm.fx.smoke', u: 2.4, v: 2.0, z: 70 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 2.4, v: 2.2, z: 62 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 6.6, v: 2.7, z: 64 });
  }

  // --- Windows --------------------------------------------------------------------------------
  const frontV = (fx: number): number => (fx >= 55 && fx <= 89 ? 4.15 : 4.0);
  const slots: WinSlot[] = [];
  BAYS.forEach((b, k) => {
    const plane = frontV(b);
    if (b !== 72) slots.push({ side: 'left', fx: b - 3, zTop: 16, m: winArch(D, 6, true), plane });
    slots.push({
      side: 'left',
      fx: b - 4,
      zTop: 40,
      m: winPediment(k % 2 ? 'seg' : 'tri', D, 10),
      plane,
    });
    slots.push({ side: 'left', fx: b - 4, zTop: 53, m: winPediment('flat', D, 6), plane });
  });
  SIDE_BAYS.forEach((b, k) => {
    slots.push({ side: 'right', fx: b - 3, zTop: 16, m: winArch(D, 6, true), plane: 8.7 });
    slots.push({ side: 'right', fx: b - 4, zTop: 40, m: winPediment(k % 2 ? 'seg' : 'tri', D, 10), plane: 8.7 });
    slots.push({ side: 'right', fx: b - 4, zTop: 53, m: winPediment('flat', D, 6), plane: 8.7 });
  });
  const mezz = winSquare(D, 5, 3);
  for (const b of BAYS) if (!CENTRE.has(b)) slots.push({ side: 'left', fx: b - 2, zTop: 22, m: mezz, plane: frontV(b) });
  const win = windows(slots, state, seed, ov, 3);
  const inside = interior(state);

  const wall: Material = (c) => {
    if (c.side === 'back') return inside(c);
    if (c.side === 'top') return c.night ? null : lv(D, c.level);
    const side = c.side === 'right' ? 'right' : 'left';
    const he = holeRim(holes, c, side, S.redBrick);
    if (he !== undefined) return he;
    const w = win.paint(c, side);
    if (w !== undefined) return w;
    if (side === 'right' && c.u < 8.6) return c.night ? null : c.edge ? D[0] : lv(D, c.level + 1);
    // Portal: round-arched carriage door.
    if (side === 'left' && Math.abs(c.v - 4.15) < 0.05) {
      const dx = c.fx + 0.5 - 72;
      if (Math.abs(dx) < 5 && c.z > 2 && (c.z < 12 || Math.hypot(dx, c.z - 12) < 5)) {
        if (c.night) return c.z < 10 && Math.abs(dx) < 1 ? 'ochre2' : null;
        if (state >= 3) return hash(c.fx, c.fz) < 0.25 ? 'rust1' : 'ink';
        return Math.abs(dx) < 0.6 ? 'earth0' : mod(c.fz, 4) === 0 ? 'earth1' : 'earth2';
      }
      if (Math.abs(dx) < 6.5 && c.z > 2 && (c.z < 12 || Math.hypot(dx, c.z - 12) < 6.5))
        return c.night ? null : lv(D, c.level + (Math.abs(dx) < 1 ? 1 : 0));
    }
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    const sd = win.soot(c, side);
    if (sd) return sd;
    if (c.edge) return lv(G, c.level - 2);
    const z = c.fz;
    // Deep cornice with modillions, frieze, architrave.
    if (z >= 61) return lv(D, c.level + 1);
    if (z === 60) return lv(D, c.level - 2);
    if (z === 59) return mod(c.fx, 3) === 0 ? lv(D, c.level) : lv(D, c.level - 2);
    if (z >= 57) return lv(D, c.level);
    if (z === 56) return lv(D, c.level - 1);
    if (z <= 2) return lv(G, c.level - 1);
    // Rusticated ground floor + mezzanine (bugnato): deep joints, staggered blocks.
    if (z < 25) {
      if (z === 24) return lv(D, c.level + 1);
      if (mod(z, 4) === 3) return lv(G, c.level - 2);
      const row = Math.floor(z / 4);
      if (mod(c.fx + row * 5, 10) === 0) return lv(G, c.level - 2);
      return lv(G, c.level + (mod(z, 4) === 2 ? 1 : 0));
    }
    if (z === 25) return lv(D, c.level - 1);
    if (z === 42 || z === 43) return lv(D, c.level - (z === 42 ? 1 : 0));
    // Coupled pilasters between the bays.
    const loc = side === 'left' ? c.fx : c.fx + 2;
    const bays = side === 'left' ? BAYS : SIDE_BAYS;
    const dist = Math.min(...bays.map((b) => Math.min(Math.abs(loc - (b - 6.5)), Math.abs(loc - (b + 6.5)))));
    if (dist >= 1 && dist <= 2.5) return lv(D, c.level + (dist > 2 && loc < 72 ? 1 : 0));
    // Garland panels under the upper windows.
    if (z >= 44 && z <= 45 && bays.some((b) => Math.abs(c.fx - b) <= 3))
      return mod(c.fx + z, 2) ? lv(D, c.level) : lv(G, c.level - 1);
    return lv(G, c.level);
  };

  // --- Ground: Piazza della Scala slabs, Leonardo's garden ----------------------------------
  const pave = slabs(R.paving, 3);
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side === 'top' && Math.abs(c.u - LEO.u) < 1.1 && Math.abs(c.v - LEO.v) < 0.75) {
      const hedge = Math.abs(c.u - LEO.u) > 0.98 || Math.abs(c.v - LEO.v) > 0.64;
      if (hedge) return lv(R.grass, c.level - 2);
      if (state >= 2 && hash(Math.floor(c.u * 6), Math.floor(c.v * 6)) < 0.22 * (state - 1))
        return lv(R.gravel, c.level - 1);
      return lv(R.grass, c.level - 1 - (mod(c.px * 3 + c.py * 5, 11) === 0 ? 1 : 0));
    }
    return pave(c);
  };
  s.box(0, MARINO_W, 0, MARINO_D, 0, 1, ground, { cast: false, tag: 'ground' });

  // --- Palace ----------------------------------------------------------------------------------
  const cut = holeCut(holes);
  s.box(0.3, 8.7, 0.4, 4.0, 1, 62, wall, { tag: 'body', cut });
  s.box(3.45, 5.55, 3.8, 4.15, 1, 62, wall, { tag: 'centre' });
  const roof = coppi(S.tileOld, scorch);
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.75
      : undefined;
  s.hip(0.5, 8.5, 0.6, 3.8, 62, 74, 1.3, roof, { cut: roofCut });
  const chimney: Material = (c) =>
    c.night ? null : c.edge ? G[0] : c.fz >= 77 ? lv(S.terracotta, c.level) : lv(G, c.level);
  for (const [u, v] of [
    [1.4, 1.1],
    [7.6, 1.0],
    [7.7, 3.0],
    [3.0, 0.9],
    [5.8, 0.9],
  ] as const) {
    s.box(u - 0.13, u + 0.13, v - 0.1, v + 0.1, 66, 79, chimney);
  }

  // Balustrade + corner statues on the cornice.
  const bal: Material = (c) => (c.night ? null : c.edge ? D[0] : lv(D, c.level));
  s.box(0.3, 8.7, 3.88, 4.0, 62, 67, bal, { cut: balustradeCut(62, 67) });
  s.box(3.45, 5.55, 4.03, 4.15, 62, 67, bal, { cut: balustradeCut(62, 67) });
  s.box(8.58, 8.7, 0.4, 4.0, 62, 67, bal, { cut: balustradeCut(62, 67) });
  for (const [u, v] of [
    [0.42, 3.92],
    [8.6, 3.92],
    [3.55, 4.08],
    [5.45, 4.08],
    [2.1, 3.92],
    [6.9, 3.92],
  ] as const) {
    s.box(u - 0.1, u + 0.1, v - 0.1, v + 0.1, 62, 69, bal);
    if (state >= 4 && u > 8) continue;
    s.prismN(u, v, 0.07, 0.0, 69, 76, 4, plain(D, { rim: true }));
    s.ell(u, v, 77, 0.04, 0.04, 1.5, plain(R.gold));
  }

  // Coupled half-columns on the centre's piano nobile, the portal balcony.
  const broken = state >= 4 ? new Map([[2, 32]]) : new Map<number, number>();
  [54.5, 57.5, 86.5, 89.5].forEach((fx, k) =>
    column(s, { u: fx / 16, v: 4.2, z0: 26, z1: 42, r: 0.075, ramp: D, brokenAt: broken.get(k), tag: 'col' }),
  );
  const slab: Material = (c) =>
    c.night ? null : c.edge ? D[0] : lv(D, c.level - (c.side !== 'top' ? 1 : 0));
  for (const fx of [62, 82])
    column(s, { u: fx / 16, v: 4.38, z0: 1, z1: 22, r: 0.09, ramp: D, order: 'doric', tag: 'col' });
  s.box(3.7, 5.3, 4.15, 4.55, 22, 25, slab);
  s.box(3.7, 5.3, 4.47, 4.55, 25, 29, bal, { cut: balustradeCut(25, 29) });
  if (state >= 4) s.cyl(4.0, 5.0, 0.075, 5, 9, plain(D));
  stairs(s, 3.6, 5.4, 4.95, 4.4, 1, 4, 2, stepMat(G, decals));

  // --- Flag: the Tricolore over the centre ------------------------------------------------------
  const poleTop = state >= 4 ? 102 : 114;
  s.line(
    [
      [4.5, 3.3, 70],
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

  // --- Leonardo and his pupils -----------------------------------------------------------------
  const ped: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return D[0];
    if (c.side !== 'top' && c.fz > 8 && c.fz < 20 && mod(c.fx, 16) > 4 && mod(c.fx, 16) < 12)
      return mod(c.fx + c.fz, 3) === 0 ? lv(R.bronze, c.level + 1) : lv(D, c.level - 1);
    return lv(D, c.level);
  };
  s.box(LEO.u - 0.42, LEO.u + 0.42, LEO.v - 0.42, LEO.v + 0.42, 1, 4, plain(G));
  s.box(LEO.u - 0.26, LEO.u + 0.26, LEO.v - 0.26, LEO.v + 0.26, 4, 24, ped, { tag: 'ped' });
  s.box(LEO.u - 0.3, LEO.u + 0.3, LEO.v - 0.3, LEO.v + 0.3, 24, 27, plain(D, { rim: true }));
  const pupil = figure(PUPIL, 'marble', 'pupil');
  for (const [du, dv] of [
    [-0.33, 0.33],
    [0.33, 0.33],
    [0.33, -0.33],
  ] as const) {
    s.sprite(pupil, 1, 6, LEO.u + du, LEO.v + dv, 4);
  }
  if (state >= 3) s.sprite(marbleStatue('standing', true), 10, 8, LEO.u - 0.6, LEO.v + 0.65, 1);
  else s.sprite(figure(LEONARDO, 'marble', 'leonardo'), 4, 16, LEO.u, LEO.v, 27);

  const lp = lamp(state >= 2);
  s.sprite(lp.img, 2, 14, 1.2, 4.7, 1, { emit: state >= 2 ? undefined : lp.night });
  s.sprite(lp.img, 2, 14, 2.8, 4.7, 1, { emit: lp.night });

  banner(s, state, 3.4, 5.6, 4.58, 28, 8, 'SCIOPERO');
  rubble(s, state, 3.4, 5.6, 4.4, 5.3, 1, 8, seed);
  rubble(s, state, 0.4, 3.0, 4.1, 5.9, 1, 5, seed + 1);
  rubble(s, state, 5.8, 8.6, 4.1, 5.9, 1, 4, seed + 2);
  return { scene: s, overlays: ov };
}
