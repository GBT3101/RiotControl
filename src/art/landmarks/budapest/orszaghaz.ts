/**
 * Budapest — the Hungarian Parliament (Országház). Footprint 16 (u) × 6 (v). The long white
 * neo-Gothic range runs along u with the ribbed central dome and its spire in the middle, the
 * two higher chamber blocks with their slender corner towers, end pavilions, and the Kossuth tér
 * main entrance (pointed gable, two slender spire-towers, the lion stair) on the +v face. The
 * Danube front is the far (−v) side. Red-brown roofs, white limestone, pinnacles everywhere.
 */
import { Scene, type Material, type ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, plain, type Ramp5 } from '../engine/materials';
import {
  banner,
  breakAbove,
  decalAt,
  gothicWall,
  lancet,
  paintWindow,
  rubble,
  scatterDecals,
  scorchZones,
  stairs,
  stepMat,
  windowStatus,
  type DamageState,
} from '../engine/kit';
import { grid } from '../../lib/grid';
import { LION, lamp } from '../props';
import type { Build, Overlay } from '../types';

export const ORSZAGHAZ_W = 16;
export const ORSZAGHAZ_D = 6;

/** White Hungarian limestone (Süttő stone): lit wall stone5, shaded stone2. */
export const WHITE: Ramp5 = ['stone1', 'stone2', 'stone3', 'stone5', 'white'];
/** Trim, pinnacles and ribs: one notch lighter. */
export const WHITE_LIT: Ramp5 = ['stone2', 'stone3', 'stone4', 'white', 'white'];
/** Red-brown tiled roofs. */
export const ROOF_RED: Ramp5 = ['earth0', 'rust0', 'earth2', 'rust1', 'rust2'];

/** Seated stone lions of the Kossuth tér stair (the Parliament's lion gate). */
function stoneLion(toppled: boolean): ReturnType<typeof grid> {
  const keys = { o: 'stone0', k: 'stone0', d: 'stone2', m: 'stone3', l: 'stone4', h: 'stone5' };
  if (!toppled) return grid(LION, keys, {}, 'bpLion');
  const rows = LION.trim()
    .split('\n')
    .map((r) => r.trim())
    .reverse();
  return grid(rows.join('\n'), keys, {}, 'bpLionToppled');
}

/** A slender needle pinnacle: shaft r from z0 to zMid, then a point to z1. */
function needle(
  s: Scene,
  u: number,
  v: number,
  r: number,
  z0: number,
  zMid: number,
  z1: number,
  mat: Material,
  tip?: Material,
): void {
  s.prismN(u, v, r, r, z0, zMid, 4, mat);
  s.prismN(u, v, r, 0, zMid, z1, 4, tip ?? mat);
}

export function buildOrszaghaz(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 4400;
  const W = WHITE;

  // --- Damage bookkeeping -----------------------------------------------------------------
  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'wing', 36, 104, 2, 14],
      ['left', 'wing', 152, 216, 2, 14],
      ['left', 'pav', 8, 30, 2, 14],
      ['left', 'pav', 226, 248, 2, 14],
      ['right', 'pav', 14, 70, 2, 14],
      ['left', 'porch', 112, 142, 2, 12],
      ['left', 'stairs', 116, 140, 1, 8],
      ['left', 'ped', 100, 112, 2, 8],
      ['left', 'ped', 146, 156, 2, 8],
    ],
    1.3,
  );
  const scorch = scorchZones(
    state === 3
      ? [[4.6, 3.0, 1.0]]
      : state >= 4
        ? [
            [4.5, 2.9, 1.4],
            [11.4, 3.0, 1.2],
            [13.4, 2.2, 0.8],
            [2.2, 2.6, 0.7],
          ]
        : [],
  );
  const roof = roofRed(scorch);
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.75
      : undefined;
  if (state >= 3) ov.push({ sprite: 'lm.fx.smoke', u: 4.6, v: 2.9, z: 74 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 4.5, v: 3.0, z: 66 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 11.4, v: 3.0, z: 66 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 13.4, v: 2.4, z: 60 });
    ov.push({ sprite: 'lm.fx.smoke', u: 11.4, v: 2.9, z: 76 });
  }

  // Burning windows on the front range (upper row): soot plumes + fire overlays.
  const burnt: Array<{ side: 'left' | 'right'; fx: number; zTop: number }> = [];
  if (state >= 3) {
    for (let b = 0; b < 30; b++) {
      const fx = 18 + b * 8 + 4;
      if (fx > 238) break;
      if (fx > 106 && fx < 150) continue;
      const st = windowStatus(state, b * 11 + 3, seed);
      if (st === 'burning' || st === 'gutted') {
        burnt.push({ side: 'left', fx, zTop: 32 });
        if (st === 'burning' && b % 2 === 1)
          ov.push({ sprite: 'lm.fx.fire.s', u: fx / 16, v: 4.05, z: 22 });
      }
    }
  }

  // --- Ground: Kossuth tér paving, lawns, the river quay behind --------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    const lawn =
      c.v > 4.75 && c.v < 5.75 && ((c.u > 1.0 && c.u < 6.1) || (c.u > 9.9 && c.u < 15.0));
    if (lawn) {
      if (state >= 2 && hash(Math.floor(c.u * 6), Math.floor(c.v * 6)) < 0.25 * (state - 1))
        return lv(R.gravel, c.level - 1);
      const path = Math.abs(c.u - 3.55) < 0.12 || Math.abs(c.u - 12.45) < 0.12;
      if (path) return lv(R.gravel, c.level);
      return lv(R.grass, c.level - (mod(c.px + c.py, 7) === 0 ? 1 : 0));
    }
    const ju = mod(c.u * 4, 1) < 0.07;
    const jv = mod(c.v * 4, 1) < 0.14;
    return lv(R.paving, c.level - (ju || jv ? 1 : 0));
  };
  s.box(0, ORSZAGHAZ_W, 0, ORSZAGHAZ_D, 0, 1, ground, { cast: false, tag: 'ground' });

  /** Wall tops under burnt-through roofs glow with embers. */
  const burntTop =
    (m: Material): Material =>
    (c) =>
      c.side === 'top' && scorch(c.u, c.v) === 2
        ? c.night
          ? 'rust3'
          : hash(c.px, c.py) < 0.5
            ? 'ochre3'
            : 'rust2'
        : m(c);
  const pin: Material = (c) => (c.night ? null : c.edge ? W[0] : lv(WHITE_LIT, c.level));
  const pinTip: Material = (c) =>
    c.night ? null : c.edge ? W[0] : lv(WHITE_LIT, c.level + (c.rim ? 1 : 0));

  // --- The long front range -----------------------------------------------------------------
  const wallTop = 44;
  const wing = gothicWall({
    ramp: W,
    pitch: 8,
    off: 2,
    rows: [
      { zTop: 13, h: 9 },
      { zTop: 31, h: 14, w: 5 },
      { zTop: 40, h: 5 },
    ],
    top: wallTop,
    state,
    seed,
    decals,
    burnt,
  });
  const holes: Array<{ fx: number; z: number; r: number }> =
    state >= 4
      ? [
          { fx: 72, z: 22, r: 9 },
          { fx: 196, z: 26, r: 8 },
        ]
      : [];
  const wingCut = holes.length
    ? (u: number, _v: number, z: number, f: number): boolean => {
        if (f !== 3) return false;
        return holes.some((h) => {
          const dx = u * 16 - h.fx;
          const dz = (z - h.z) * 1.25;
          const a = Math.atan2(dz, dx);
          const rr = h.r + Math.sin(a * 5 + h.fx) * 1.5 + Math.cos(a * 3) * 1.1;
          return dx * dx + dz * dz < rr * rr;
        });
      }
    : undefined;
  const wingMat: Material = (c) => {
    if (c.side === 'top' && scorch(c.u, c.v) === 2)
      return c.night ? 'rust3' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust2';
    if (c.side === 'back') {
      if (c.night) return c.z < 12 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
      return c.z < 10 ? (hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1') : 'ink';
    }
    // Broken brick edges around the holes.
    if (holes.length && c.side === 'left' && !c.night) {
      for (const h of holes) {
        const dx = c.fx - h.fx;
        const dz = (c.fz - h.z) * 1.25;
        if (dx * dx + dz * dz < (h.r + 3) * (h.r + 3))
          return lv(R.brick, c.level - (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
      }
    }
    return wing(c);
  };
  s.box(1.0, 15.0, 0.8, 4.0, 1, wallTop, wingMat, { tag: 'wing', cut: wingCut });
  s.gable(1.0, 15.0, 0.9, 3.9, wallTop, 64, 'u', roof, { cut: roofCut });
  // Gilded ridge cresting.
  for (let u = 1.2; u < 14.9; u += 0.25) {
    if (u > 6.6 && u < 9.4) continue;
    if (state >= 4 && scorch(u, 2.4) > 0) continue;
    s.line(
      [
        [u, 2.4, 64],
        [u, 2.4, 66],
      ],
      mod(Math.round(u * 4), 2) ? 'ochre1' : 'earth0',
    );
  }
  // Small pointed dormers on the front slope.
  const dormer: Material = (c) => {
    if (c.night) return c.side === 'left' && mod(c.fx, 32) === 8 && c.fz < 52 ? 'ochre2' : null;
    if (c.edge) return W[0];
    if (c.side === 'left') {
      const dx = Math.abs(c.fx + 0.5 - (Math.floor(c.fx / 32) * 32 + 8.5));
      if (dx < 1.5 && c.fz < 52 && c.fz > 47) return state >= 2 ? 'ink' : lv(R.dark, c.level);
      return lv(WHITE_LIT, c.level);
    }
    return roof(c);
  };
  for (let k = 0; k < 7; k++) {
    const u = 1.53 + k * 2;
    if ((u > 6.4 && u < 9.6) || u < 3 || u > 13) continue;
    s.box(u - 0.22, u + 0.22, 3.2, 3.55, 44, 52, dormer);
    s.gable(u - 0.26, u + 0.26, 3.15, 3.6, 52, 58, 'v', dormer);
    s.prismN(u, 3.55, 0.04, 0, 58, 63, 4, pinTip);
  }
  // Pinnacles on every buttress of the front parapet.
  for (let fx = 2; fx <= 238; fx += 8) {
    const u = (fx + 0.5) / 16;
    if (u < 1.05 || u > 14.95) continue;
    if (u > 6.8 && u < 9.2) continue;
    if ([3, 6, 10, 13].some((b) => Math.abs(u - b) < 0.7)) continue;
    if (state >= 4 && hash(fx, 7) < 0.35) continue;
    const big = mod(fx - 2, 16) === 0;
    needle(
      s,
      u,
      4.0,
      0.07,
      wallTop - 4,
      wallTop + (big ? 4 : 2),
      wallTop + (big ? 13 : 8),
      pin,
      pinTip,
    );
  }

  // Projecting gabled bays (risalits) along the front range.
  const bayWall = gothicWall({
    ramp: W,
    pitch: 9,
    off: 0,
    rows: [
      { zTop: 13, h: 9 },
      { zTop: 33, h: 16, w: 5 },
      { zTop: 46, h: 7 },
    ],
    top: 52,
    state,
    seed: seed + 11,
    decals,
    burnt,
  });
  const bayGable: Material = (c) => {
    if (c.side === 'left') {
      if (c.night) return null;
      if (c.edge) return W[0];
      const g = Math.floor(c.u * 16);
      const mid = Math.round(c.u) * 16;
      const apex = 52 + 10 * (1 - Math.abs(c.u * 16 - mid + 0.5) / 9.6);
      if (apex - c.z < 2) return lv(WHITE_LIT, c.level + 1);
      if (Math.abs(g - mid) < 2 && c.z > 54 && c.z < 59) return lv(W, c.level - 2);
      return lv(W, c.level);
    }
    return roof(c);
  };
  for (const bu of [3.0, 6.0, 10.0, 13.0]) {
    s.box(bu - 0.6, bu + 0.6, 3.6, 4.25, 1, 52, bayWall, { tag: 'wing' });
    s.gable(bu - 0.6, bu + 0.6, 3.6, 4.3, 52, 62, 'v', bayGable);
    for (const du of [-0.6, 0.6]) needle(s, bu + du, 4.25, 0.08, 40, 56, 70, pin, pinTip);
    needle(s, bu, 4.3, 0.05, 58, 63, 70, pin, pinTip);
  }

  // --- End pavilions (steep hipped roofs, corner turrets) ----------------------------------
  const pavWall = gothicWall({
    ramp: W,
    pitch: 7,
    off: 1,
    rows: [
      { zTop: 13, h: 9 },
      { zTop: 33, h: 15, w: 5 },
      { zTop: 44, h: 6 },
    ],
    top: 50,
    state,
    seed: seed + 3,
    decals,
  });
  for (const [u0, u1] of [
    [0.4, 2.1],
    [13.9, 15.6],
  ] as const) {
    s.box(u0, u1, 0.6, 4.5, 1, 50, burntTop(pavWall), { tag: 'pav' });
    s.hip(u0 + 0.05, u1 - 0.05, 0.65, 4.45, 50, 76, [0.85, 0.85], roof, { cut: roofCut });
    for (const [tu, tv] of [
      [u0, 4.5],
      [u1, 4.5],
      [u1, 0.6],
      [u0, 0.6],
    ] as const) {
      s.prismN(tu, tv, 0.14, 0.14, 1, 58, 8, pin, { rot: Math.PI / 8, tag: 'pav' });
      s.prismN(tu, tv, 0.15, 0, 58, 74, 8, roof, { rot: Math.PI / 8 });
      if (state < 4 || hash(tu, tv) < 0.5) s.prismN(tu, tv, 0.03, 0, 74, 78, 4, plain(R.gold));
    }
    // Ridge finial.
    s.prismN((u0 + u1) / 2, 2.55, 0.05, 0, 76, 84, 4, plain(R.gold));
  }

  // --- Chamber blocks: higher halls, steep roofs, four slender towers each ------------------
  const hallWall = gothicWall({
    ramp: W,
    pitch: 6,
    off: 1,
    rows: [{ zTop: 58, h: 9, w: 3 }],
    top: 62,
    state,
    seed: seed + 5,
    decals: [],
  });
  for (const [u0, u1] of [
    [3.4, 5.8],
    [10.2, 12.6],
  ] as const) {
    s.box(u0, u1, 1.3, 3.4, 30, 62, burntTop(hallWall), { tag: 'hall' });
    s.hip(u0 - 0.04, u1 + 0.04, 1.26, 3.44, 62, 84, [0.8, 0.9], roof, { cut: roofCut });
    for (const [tu, tv] of [
      [u0, 3.4],
      [u1, 3.4],
      [u1, 1.3],
      [u0, 1.3],
    ] as const) {
      const broken = state >= 4 && tu > 8 && tv > 2;
      s.prismN(tu, tv, 0.12, 0.12, 30, broken ? 80 : 92, 8, towerMat(state), {
        rot: Math.PI / 8,
        cut: broken ? breakAbove(78, tu * 3) : undefined,
      });
      if (broken) continue;
      s.prismN(tu, tv, 0.13, 0, 92, 110, 8, roof, { rot: Math.PI / 8 });
      s.line(
        [
          [tu, tv, 110],
          [tu, tv, 114],
        ],
        'ochre2',
      );
    }
    s.prismN((u0 + u1) / 2, 2.35, 0.05, 0, 82, 92, 4, plain(R.gold));
  }

  // --- The dome: square base, 16-sided drum, ribbed ogival cupola, lantern, spire ----------
  const DU = 8.0;
  const DV = 2.4;
  const baseWall = gothicWall({
    ramp: W,
    pitch: 7,
    off: 4,
    rows: [{ zTop: 62, h: 13, w: 5 }],
    top: 70,
    state,
    seed: seed + 7,
    decals: [],
  });
  s.box(6.7, 9.3, 1.0, 3.8, 30, 70, baseWall, { tag: 'base' });
  s.hip(6.65, 9.35, 0.95, 3.85, 70, 80, 0.9, roof);
  for (const [tu, tv] of [
    [6.7, 3.8],
    [9.3, 3.8],
    [9.3, 1.0],
    [6.7, 1.0],
  ] as const) {
    needle(s, tu, tv, 0.11, 30, 76, 94, pin, pinTip);
  }
  const domeHit = state >= 4;
  const drum: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(W, c.level);
    if (c.side === 'back') return c.night ? 'rust2' : 'ink';
    const a = Math.atan2(c.v - DV, c.u - DU);
    const k = mod((a * 8) / Math.PI, 1); // 16 bays
    const bay = Math.floor(mod((a * 8) / Math.PI, 16));
    const win = k > 0.28 && k < 0.72 && c.fz > 75 && c.fz < 99 - (Math.abs(k - 0.5) > 0.12 ? 1 : 0);
    const st = windowStatus(state, 600 + bay, seed);
    if (c.night) return win && c.fz < 98 ? (c.fz < 86 ? 'ochre2' : 'ochre3') : null;
    if (c.edge) return W[0];
    if (win) {
      if (c.fz === 87) return lv(W, c.level - 1);
      if (st === 'smashed' && hash(c.px, c.py) < 0.5) return 'zinc2';
      if (st === 'burning') return c.fz < 82 ? 'ochre3' : 'rust2';
      if (st === 'gutted') return 'ink';
      return c.lambert > 0.5 && k < 0.42 ? lv(R.glass, c.level - 1) : lv(R.dark, c.level);
    }
    if (c.fz >= 102) return lv(WHITE_LIT, c.level);
    if (c.fz === 101 || c.fz === 72) return lv(W, c.level - 1);
    if (k < 0.12 || k > 0.88) return lv(WHITE_LIT, c.level + (c.lambert > 0.45 ? 1 : 0));
    return lv(W, c.level);
  };
  s.prismN(DU, DV, 1.0, 1.0, 70, 104, 16, drum, { rot: Math.PI / 16 });
  // Pinnacle crown around the drum top.
  for (let k = 0; k < 16; k++) {
    const th = (k * Math.PI) / 8;
    const u = DU + Math.cos(th) * 1.02;
    const v = DV + Math.sin(th) * 1.02;
    if (state >= 4 && hash(k, 5) < 0.4) continue;
    needle(s, u, v, 0.06, 97, 107, 118, pin, pinTip);
  }
  const domeScorch = state >= 3;
  const dome: Material = (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    const a = Math.atan2(c.v - DV, c.u - DU);
    const r = mod((a * 8) / Math.PI + 0.5, 1);
    const rib = Math.abs(r - 0.5) < 0.1;
    // Ring of little lucarnes on the lower dome.
    const luc = !rib && Math.abs(r - 0.5) > 0.3 && c.fz > 113 && c.fz < 118;
    // Floodlit at night: the ribs glow gold over the dark cupola.
    if (c.night) return luc ? 'ochre2' : rib && c.lambert > 0 ? 'ochre1' : null;
    if (c.edge) return rib ? W[0] : ROOF_RED[0];
    if (domeScorch && c.u - DU + (c.v - DV) > 0.2 && c.fz < 130 && hash(c.px >> 1, c.py >> 1) < 0.5)
      return rib ? lv(R.char, c.level + 1) : lv(R.char, c.level);
    if (rib) return lv(WHITE_LIT, c.level + (c.lambert > 0.5 ? 1 : 0));
    if (luc) return state >= 2 ? 'ink' : lv(R.dark, c.level);
    const course = mod(c.fz, 4) === 0;
    return lv(ROOF_RED, c.level + (c.rim ? 1 : 0) - (course ? 1 : 0));
  };
  const domeCut = domeHit
    ? (u: number, v: number, z: number): boolean =>
        Math.hypot((u - DU - 0.7) * 1.4, (v - DV - 0.4) * 1.4, (z - 120) / 14) < 0.8
    : undefined;
  s.ell(DU, DV, 104, 1.0, 1.0, 46, dome, { zMin: 104, cut: domeCut });
  if (domeHit) ov.push({ sprite: 'lm.fx.fire.m', u: DU + 0.55, v: DV + 0.55, z: 112 });
  // Lantern + the spire.
  const lantern: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(WHITE_LIT, c.level);
    const opening = mod(c.fx, 4) === 1 && c.fz > 147 && c.fz < 156;
    if (c.night) return opening ? 'ochre3' : null;
    if (c.edge) return W[0];
    if (opening) return lv(R.dark, c.level);
    return lv(WHITE_LIT, c.level);
  };
  const spireCut = state >= 4 ? breakAbove(166, 2) : undefined;
  s.prismN(DU, DV, 0.3, 0.3, 144, 159, 8, lantern, { rot: Math.PI / 8 });
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4 + Math.PI / 8;
    needle(s, DU + Math.cos(th) * 0.32, DV + Math.sin(th) * 0.32, 0.04, 154, 160, 168, pin, pinTip);
  }
  const spire: Material = (c) => {
    const a = Math.atan2(c.v - DV, c.u - DU) / (Math.PI / 4);
    const rib = Math.abs(a - Math.round(a)) < 0.14;
    if (c.night) return rib && c.lambert > 0.2 ? 'ochre1' : null;
    if (c.edge) return ROOF_RED[0];
    if (rib) return lv(WHITE_LIT, c.level);
    if (mod(c.fz, 9) === 0) return lv(WHITE_LIT, c.level - 1);
    return lv(ROOF_RED, c.level + (c.rim ? 1 : 0));
  };
  s.prismN(DU, DV, 0.29, 0.03, 159, 206, 8, spire, { rot: Math.PI / 8, cut: spireCut });
  if (state < 4) {
    s.line(
      [
        [DU, DV, 206],
        [DU, DV, 214],
      ],
      'ochre3',
    );
    s.line(
      [
        [DU - 0.05, DV + 0.05, 210],
        [DU + 0.05, DV - 0.05, 210],
      ],
      'ochre2',
    );
  } else {
    ov.push({ sprite: 'lm.fx.fire.m', u: DU, v: DV, z: 168 });
    ov.push({ sprite: 'lm.fx.smoke', u: DU, v: DV, z: 176 });
  }

  // --- Kossuth tér main entrance: pointed gable, portal, two slender towers -----------------
  const porch: Material = (c) => {
    if (c.side === 'back') return c.night ? null : 'ink';
    if (c.side === 'top') return c.night ? null : lv(W, c.level);
    if (c.side === 'left') {
      const cx = 8.0 * 16;
      const dx = c.fx + 0.5 - cx;
      const adx = Math.abs(dx);
      // Great pointed portal with a deep shaded reveal.
      const archTop = 30 - (adx * adx) / 4;
      if (adx < 7 && c.z < archTop + 2 && c.z > 8) {
        if (adx >= 5.5 || c.z >= archTop) return c.night ? null : lv(WHITE_LIT, c.level);
        if (c.night) return 'ochre2';
        if (state >= 3) return c.z < 12 ? 'rust1' : 'ink';
        if (c.z < 12) return 'earth1';
        // Bronze doors with a gilded transom.
        if (c.z > archTop - 5) return mod(c.fx, 2) ? 'ochre1' : lv(R.dark, c.level);
        return adx < 0.6 ? 'earth0' : mod(c.fz, 4) === 0 ? 'earth1' : 'earth2';
      }
      // Rose window high in the gable wall.
      const dz = c.z - 46;
      const r = Math.hypot(dx, dz * 1.1);
      if (r < 6.5) {
        const spoke = Math.abs(mod((Math.atan2(dz, dx) * 4) / Math.PI + 0.5, 1) - 0.5) < 0.2;
        const ring = r > 2.4 && r < 3.3;
        if (c.night) return spoke || ring ? null : 'ochre2';
        if (r > 5.5) return lv(WHITE_LIT, c.level);
        if (spoke || ring) return lv(W, c.level);
        const st = windowStatus(state, 700, seed);
        if (st === 'smashed' && hash(c.fx, c.fz) < 0.5) return 'zinc2';
        if (st === 'burning' || st === 'gutted') return 'ink';
        return r < 2.4 ? 'crim1' : lv(R.dark, c.level);
      }
      // Two-light lancets flanking the portal.
      for (const lx of [cx - 13, cx + 10]) {
        const p = paintWindow(lancet(3, 12, W), c, lx, 36, windowStatus(state, 710 + lx, seed));
        if (p !== undefined) return p;
      }
    } else if (c.side === 'right') {
      const p = paintWindow(lancet(3, 14, W), c, 64, 32, windowStatus(state, 720, seed));
      if (p !== undefined) return p;
    }
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return W[0];
    if (c.fz <= 2 || c.fz === 34) return lv(W, c.level - 1);
    if (c.fz >= 54) return lv(WHITE_LIT, c.level);
    return lv(W, c.level);
  };
  s.box(7.05, 8.95, 3.9, 5.0, 1, 56, porch, { tag: 'porch' });
  const gableMat: Material = (c) => {
    if (c.side === 'left') {
      if (c.night) return null;
      if (c.edge) return W[0];
      const apex = 56 + 24 * (1 - Math.abs(c.u - 8.0) / 0.95);
      if (apex - c.z < 2.2) return lv(WHITE_LIT, c.level + 1);
      // Blind tracery: three stepped lancets in the gable.
      const dx = c.fx + 0.5 - 128;
      for (const [lx, h] of [
        [-5, 10],
        [0, 15],
        [5, 10],
      ] as const) {
        const ax = Math.abs(dx - lx);
        if (ax < 1.6 && c.z > 58 && c.z < 58 + h - ax * 2) return lv(W, c.level - 2);
      }
      return lv(W, c.level);
    }
    return roof(c);
  };
  s.gable(7.0, 9.0, 3.9, 5.05, 56, 80, 'v', gableMat, { tag: 'porch' });
  needle(s, 8.0, 5.0, 0.07, 76, 84, 96, pin, pinTip);
  // The two slender spire-towers flanking the portal.
  for (const tu of [6.86, 9.14]) {
    const broken = state >= 4 && tu > 8;
    s.prismN(tu, 4.9, 0.21, 0.21, 1, broken ? 70 : 92, 8, towerMat(state), {
      rot: Math.PI / 8,
      tag: 'porch',
      cut: broken ? breakAbove(66, 3) : undefined,
    });
    if (broken) {
      ov.push({ sprite: 'lm.fx.fire.s', u: tu, v: 4.9, z: 70 });
      continue;
    }
    s.prismN(tu, 4.9, 0.25, 0.25, 92, 95, 8, pin, { rot: Math.PI / 8 });
    s.prismN(tu, 4.9, 0.22, 0.02, 95, 124, 8, spireMat(), { rot: Math.PI / 8 });
    s.line(
      [
        [tu, 4.9, 124],
        [tu, 4.9, 129],
      ],
      'ochre3',
    );
    for (let k = 0; k < 4; k++) {
      const th = (k * Math.PI) / 2 + Math.PI / 4;
      needle(
        s,
        tu + Math.cos(th) * 0.24,
        4.9 + Math.sin(th) * 0.24,
        0.035,
        92,
        96,
        104,
        pin,
        pinTip,
      );
    }
  }

  // Lion stair.
  stairs(s, 7.25, 8.75, 6.0, 5.0, 1, 9, 4, stepMat(R.granite, decals));
  const ped: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return R.granite[0];
    if (c.fz >= 9 && c.side !== 'top') return lv(R.granite, c.level + 1);
    return lv(R.granite, c.level);
  };
  for (const [i, u0] of [6.35, 9.05].entries()) {
    s.box(u0, u0 + 0.6, 5.2, 5.85, 1, 10, ped, { tag: 'ped' });
    const toppled = state >= 4 || (state === 3 && i === 1);
    if (toppled && i === 1) s.sprite(stoneLion(true), 12, 14, u0 + 0.9, 5.98, 1);
    else s.sprite(stoneLion(toppled), 12, 14, u0 + 0.3, 5.52, 10);
  }

  // Kossuth tér flagpole (the national flag flies in front of the Parliament).
  const poleTop = state >= 4 ? 84 : 116;
  s.line(
    [
      [4.3, 5.3, 1],
      [4.3, 5.3, poleTop],
    ],
    'gray2',
  );
  s.line(
    [
      [4.3, 5.3, poleTop],
      [4.3, 5.3, poleTop + 1],
    ],
    'ochre2',
  );
  s.box(4.15, 4.45, 5.15, 5.45, 1, 4, plain(R.granite, { rim: true }));
  ov.push({
    sprite: state >= 2 ? 'lm.flag.hu.torn' : 'lm.flag.hu',
    u: 4.3,
    v: 5.3,
    z: poleTop,
    flag: true,
  });

  // Lamps along the square.
  const lp = lamp(state >= 2);
  for (const u of [6.6, 9.4, 1.4, 14.6])
    s.sprite(lp.img, 2, 14, u, 5.95, 1, { emit: state >= 2 ? undefined : lp.night });

  banner(s, state, 3.7, 5.3, 4.04, 30, 9, 'ELEG!');
  banner(s, state, 10.7, 12.3, 4.04, 30, 9, 'NEM!');
  rubble(s, state, 1.0, 15.0, 4.1, 4.7, 1, 14, seed);
  rubble(s, state, 6.5, 9.5, 5.0, 5.9, 1, 8, seed + 1);
  if (state >= 4) {
    const rub = plain(WHITE);
    s.hip(4.2, 5.2, 4.2, 4.75, 1, 8, 0.35, rub);
    s.hip(11.8, 12.6, 4.15, 4.7, 1, 6, 0.3, plain(R.brick));
    s.prismN(10.2, 4.5, 0.12, 0.12, 1, 4, 8, rub, { rot: 0.3 });
  }
  return { scene: s, overlays: ov };
}

/** Red-brown tile roof with courses and scorch. */
function roofRed(scorch: (u: number, v: number) => 0 | 1 | 2): Material {
  return (c: ShadeCtx) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return ROOF_RED[0];
    const sc = scorch(c.u, c.v);
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    const course = mod(c.fz, 3) === 0;
    // Hip / ridge arrises catch the light in white stone trim.
    return lv(ROOF_RED, c.level - (course ? 1 : 0));
  };
}

/** Slender octagonal tower shaft: white with lancet slits and string courses. */
function towerMat(state: DamageState): Material {
  return (c) => {
    if (c.side === 'top') return c.night ? null : lv(WHITE, c.level);
    if (c.side === 'back') return c.night ? 'rust2' : 'ink';
    const slit = mod(c.fz, 16) > 5 && mod(c.fz, 16) < 12 && mod(c.fx, 4) === 1 && c.fz > 20;
    if (c.night) return slit && c.fz > 60 ? 'ochre1' : null;
    if (c.edge) return WHITE[0];
    if (slit) return state >= 3 && hash(c.fx, c.fz) < 0.3 ? 'ink' : lv(R.dark, c.level);
    if (mod(c.fz, 16) === 0) return lv(WHITE, c.level - 1);
    return lv(WHITE_LIT, c.level - (c.lambert < 0.2 ? 1 : 0));
  };
}

/** Red-brown spire with white ribs at the arrises and tiny lucarnes. */
function spireMat(): Material {
  return (c) => {
    if (c.night) return null;
    if (c.edge) return ROOF_RED[0];
    if (mod(c.fz, 8) === 0) return lv(WHITE_LIT, c.level - 1);
    return lv(ROOF_RED, c.level + (c.rim ? 1 : 0));
  };
}
