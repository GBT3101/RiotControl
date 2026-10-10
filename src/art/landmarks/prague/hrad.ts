/**
 * Prague — Prague Castle with St Vitus Cathedral (Pražský hrad). Footprint 14 (u) × 6 (v).
 * The long pale south front of the palace stands on its terrace wall above the gardens (+v,
 * the city side), the New Castle Steps climbing to a gate in the middle; behind it St Vitus rises
 * dark and Gothic: the twin west spires at the low-u end, the Great South Tower with its green
 * copper Renaissance helmet in the middle, the flying-buttressed chancel to the east (high u).
 */
import { Scene, type Material } from '../engine/scene';
import { R, hash, lv, mod, mod_, plain, type Ramp5 } from '../engine/materials';
import {
  banner,
  breakAbove,
  decalAt,
  gothicWall,
  paintWindow,
  rubble,
  scatterDecals,
  scorchZones,
  soot,
  stairs,
  stepMat,
  windowStatus,
  type DamageState,
} from '../engine/kit';
import type { Build, Overlay } from '../types';
import { lamp } from '../props';

export const HRAD_W = 14;
export const HRAD_D = 6;

/** The palace's pale grey-white render. */
export const PALE: Ramp5 = ['stone1', 'gray5', 'gray6', 'gray7', 'white'];
/** St Vitus: weathered, blackened sandstone. */
export const SOOT_STONE: Ramp5 = ['ink', 'gray1', 'gray2', 'gray3', 'gray4'];
const SOOT_LIT: Ramp5 = ['gray1', 'gray2', 'gray3', 'gray4', 'gray5'];
/** Prague terracotta roof tiles. */
export const TILE: Ramp5 = ['earth1', 'rust1', 'rust2', 'rust3', 'rust4'];
/** Green copper of the Great South Tower's helmet. */
const COPPER: Ramp5 = ['green0', 'green1', 'teal1', 'teal2', 'teal2'];
/** Dark slate of the cathedral roof. */
const SLATE: Ramp5 = ['ink', 'gray1', 'zinc0', 'zinc1', 'zinc2'];
/** Terrace wall and garden stair stone. */
const TERRACE: Ramp5 = ['stone0', 'stone1', 'gray4', 'stone2', 'stone3'];

const P = PALE;
const WIN = mod_(
  `
  .PPPP.
  .FFFF.
  .FgGF.
  .FggF.
  .FmmF.
  .FgGF.
  .FggF.
  .ssss.
  `,
  {
    P: { r: P, d: -1 },
    F: { r: P, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: P, d: -1 },
    s: { r: P, d: 1 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

export function buildHrad(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 6600;

  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'terrace', 8, 90, 2, 10],
      ['left', 'terrace', 130, 216, 2, 10],
      ['right', 'terrace', 52, 92, 2, 10],
      ['left', 'palace', 20, 100, 14, 24],
      ['left', 'palace', 124, 210, 14, 24],
      ['right', 'palace', 48, 72, 14, 24],
      ['left', 'stairs', 98, 126, 1, 12],
    ],
    1.3,
  );
  const scorch = scorchZones(
    state === 3
      ? [[10.2, 3.6, 0.8]]
      : state >= 4
        ? [
            [10.0, 3.6, 1.2],
            [3.6, 3.7, 1.0],
            [9.2, 1.4, 1.1],
          ]
        : [],
  );
  if (state >= 3) ov.push({ sprite: 'lm.fx.smoke', u: 10.2, v: 3.6, z: 74 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 10.0, v: 3.7, z: 62 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 3.6, v: 3.8, z: 64 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 9.2, v: 1.5, z: 100 });
    ov.push({ sprite: 'lm.fx.smoke', u: 9.2, v: 1.4, z: 112 });
  }
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.75
      : undefined;

  // --- Ground: the south gardens below the terrace -----------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    if (c.v > 5.1 && (c.u < 6.0 || c.u > 8.0)) {
      if (state >= 2 && hash(Math.floor(c.u * 6), Math.floor(c.v * 6)) < 0.22 * (state - 1))
        return lv(R.gravel, c.level - 1);
      return lv(R.grass, c.level - (mod(c.px + c.py, 7) === 0 ? 1 : 0) - (c.v > 5.85 ? 1 : 0));
    }
    const ju = mod(c.u * 4, 1) < 0.07;
    const jv = mod(c.v * 4, 1) < 0.14;
    return lv(R.paving, c.level - (ju || jv ? 1 : 0));
  };
  s.box(0, HRAD_W, 0, HRAD_D, 0, 1, ground, { cast: false, tag: 'ground' });

  // Terrace (retaining) wall of the castle rock.
  const terrace: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'top') return lv(R.paving, c.level - (mod(c.u * 4, 1) < 0.07 ? 1 : 0));
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return TERRACE[0];
    const row = Math.floor(c.fz / 3);
    if (c.fz >= 11) return lv(TERRACE, c.level + 1);
    if (mod(c.fz, 3) === 0) return lv(TERRACE, c.level - 1);
    if (mod(c.fx + row * 4, 8) === 0) return lv(TERRACE, c.level - 1);
    return lv(TERRACE, c.level);
  };
  s.box(0.1, 13.9, 0.1, 5.0, 1, 12, terrace, { tag: 'terrace' });

  // --- St Vitus: nave + chancel with flying buttresses ------------------------------------
  const vitusWall = gothicWall({
    ramp: SOOT_STONE,
    pitch: 10,
    off: 3,
    rows: [{ zTop: 82, h: 28, w: 5 }],
    top: 88,
    state: Math.min(state, 2) as DamageState,
    seed: seed + 1,
    decals: [],
  });
  s.box(3.0, 11.2, 0.6, 2.3, 12, 88, vitusWall, { tag: 'vitus' });
  const slate: Material = (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return SLATE[0];
    const sc = scorch(c.u, c.v);
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    // Diamond tile pattern of the cathedral roof.
    const dia = mod(c.sx + c.fz * 2, 12) === 0 || mod(c.sx - c.fz * 2, 12) === 0;
    return lv(SLATE, c.level - (mod(c.fz, 3) === 0 ? 1 : 0) + (dia ? 1 : 0));
  };
  s.gable(3.0, 11.2, 0.6, 2.3, 88, 118, 'u', slate, { cut: roofCut });
  // Apse (polygonal chancel end).
  s.prismN(11.2, 1.45, 0.85, 0.85, 12, 88, 8, vitusWall, { rot: Math.PI / 8, tag: 'vitus' });
  s.prismN(11.2, 1.45, 0.85, 0.0, 88, 110, 8, slate, { rot: Math.PI / 8 });
  // Flying buttresses + pinnacles on the south (visible) side.
  const sootPin: Material = (c) => (c.night ? null : c.edge ? 'ink' : lv(SOOT_LIT, c.level));
  for (let u = 3.4; u <= 12.0; u += 0.62) {
    if (u > 7.0 && u < 8.4) continue;
    const onApse = u > 11.0;
    const vb = onApse ? 2.35 : 2.3;
    s.box(u - 0.05, u + 0.05, vb, vb + 0.55, 54, 82, sootPin);
    s.prismN(u, vb + 0.5, 0.08, 0.08, 40, 92, 4, sootPin);
    s.prismN(u, vb + 0.5, 0.08, 0, 92, 104, 4, sootPin);
    s.prismN(u, vb, 0.05, 0, 88, 98, 4, sootPin);
  }
  // Ridge cresting and the slender flèche over the crossing.
  s.prismN(8.6, 1.45, 0.14, 0.14, 112, 124, 8, sootPin, { rot: Math.PI / 8 });
  s.prismN(8.6, 1.45, 0.14, 0, 124, 150, 8, plain(SLATE), { rot: Math.PI / 8 });
  s.line(
    [
      [8.6, 1.45, 150],
      [8.6, 1.45, 155],
    ],
    'ochre3',
  );

  // Twin west spires (neo-Gothic) at the low-u end.
  const towerWall = gothicWall({
    ramp: SOOT_STONE,
    pitch: 7,
    off: 0,
    rows: [
      { zTop: 136, h: 22, w: 3 },
      { zTop: 104, h: 18, w: 3 },
    ],
    top: 142,
    state: Math.min(state, 2) as DamageState,
    seed: seed + 2,
    decals: [],
  });
  const spire: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'ink';
    // Openwork crockets along the arrises, tiny lucarnes.
    const k = mod(c.fz, 7);
    if (k === 0) return lv(SOOT_LIT, c.level);
    if (mod(c.fx, 4) === 1 && k > 2 && k < 5) return lv(R.dark, c.level - 1);
    return lv(SOOT_STONE, c.level + (c.rim ? 1 : 0));
  };
  const westSpire = state >= 4 ? breakAbove(172, 7) : undefined;
  for (const [v0, v1] of [
    [0.45, 1.3],
    [1.6, 2.45],
  ] as const) {
    s.box(2.05, 2.95, v0, v1, 12, 142, towerWall, { tag: 'vitus' });
    const tv = (v0 + v1) / 2;
    s.prismN(2.5, tv, 0.38, 0.02, 142, 204, 8, spire, {
      rot: Math.PI / 8,
      cut: v0 > 1 ? westSpire : undefined,
    });
    for (const [du, dv] of [
      [0, 0],
      [0.9, 0],
      [0, 0.85],
      [0.9, 0.85],
    ] as const) {
      s.prismN(2.05 + du, v0 + dv, 0.07, 0.07, 134, 148, 4, sootPin);
      s.prismN(2.05 + du, v0 + dv, 0.07, 0, 148, 158, 4, sootPin);
    }
    if (state < 4 || v0 < 1)
      s.line(
        [
          [2.5, tv, 204],
          [2.5, tv, 209],
        ],
        'ochre2',
      );
  }
  // West front between the towers.
  s.box(2.1, 3.0, 1.3, 1.6, 12, 116, towerWall, { tag: 'vitus' });
  s.gable(2.1, 3.0, 1.2, 1.7, 116, 126, 'v', sootPin);

  // --- The Great South Tower with its green copper Renaissance helmet ---------------------
  const GT = { u0: 7.05, u1: 8.35, v0: 2.2, v1: 3.3 };
  const gtWall: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(SOOT_STONE, c.level);
    const local = c.side === 'left' ? c.fx - GT.u0 * 16 : c.fx - GT.v0 * 16;
    const span = c.side === 'left' ? (GT.u1 - GT.u0) * 16 : (GT.v1 - GT.v0) * 16;
    const mid = span / 2;
    // Gilded clock dials on both visible faces.
    const dz = c.z - 118;
    const r = Math.hypot(local - mid, dz);
    if (r < 5.5) {
      if (c.night) return r < 4 ? 'ochre4' : null;
      if (r >= 4.3) return lv(R.gold, c.level);
      if (state >= 4 && hash(c.fx, c.fz) < 0.4) return 'ink';
      const hand =
        (Math.abs(local - mid) < 0.6 && dz > 0 && dz < 3.5) ||
        (Math.abs(dz) < 0.6 && local - mid > 0 && local - mid < 2.6);
      if (hand) return 'ochre3';
      return mod(Math.round(Math.atan2(dz, local - mid) * 2), 3) === 0 ? 'navy2' : 'navy1';
    }
    // Tall belfry lancets.
    const lancet =
      Math.abs(local - mid) < 2 && c.fz > 82 && c.fz < 106 - (Math.abs(local - mid) > 1 ? 1 : 0);
    if (c.night) return lancet ? 'ochre1' : null;
    if (c.edge) return 'ink';
    if (lancet) return mod(c.fz, 6) === 0 ? lv(SOOT_LIT, c.level) : lv(R.dark, c.level - 1);
    if (local < 1.5 || local > span - 1.5) return lv(SOOT_LIT, c.level);
    if (mod(c.fz, 14) === 0) return lv(SOOT_STONE, c.level - 1);
    return lv(SOOT_STONE, c.level);
  };
  s.box(GT.u0, GT.u1, GT.v0, GT.v1, 12, 128, gtWall, { tag: 'gt' });
  // Renaissance gallery (balustrade) and the stacked copper helmet.
  const GU = (GT.u0 + GT.u1) / 2;
  const GV = (GT.v0 + GT.v1) / 2;
  const gal: Material = (c) => (c.night ? null : c.edge ? 'gray3' : lv(P, c.level));
  s.box(GT.u0 - 0.08, GT.u1 + 0.08, GT.v0 - 0.08, GT.v1 + 0.08, 128, 131, gal);
  const copper: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return COPPER[0];
    if (mod(c.fz, 7) === 0) return lv(R.gold, c.level - 1);
    return lv(COPPER, c.level + (c.rim ? 1 : 0));
  };
  const helmCut = state >= 4 ? breakAbove(150, 3) : undefined;
  s.prismN(GU, GV, 0.55, 0.55, 131, 138, 8, copper, { rot: Math.PI / 8, cut: helmCut });
  s.ell(GU, GV, 138, 0.62, 0.55, 12, copper, { zMin: 138, cut: helmCut });
  s.prismN(
    GU,
    GV,
    0.26,
    0.26,
    148,
    158,
    8,
    (c) => {
      if (c.night) return mod(c.fx, 3) === 1 ? 'ochre2' : null;
      if (c.edge) return COPPER[0];
      return mod(c.fx, 3) === 1 ? lv(R.dark, c.level) : lv(COPPER, c.level);
    },
    { rot: Math.PI / 8, cut: helmCut },
  );
  s.ell(GU, GV, 158, 0.34, 0.32, 8, copper, { zMin: 158, cut: helmCut });
  s.prismN(GU, GV, 0.13, 0.13, 164, 170, 8, copper, { rot: Math.PI / 8, cut: helmCut });
  s.ell(GU, GV, 170, 0.18, 0.18, 6, copper, { zMin: 170, cut: helmCut });
  s.prismN(GU, GV, 0.1, 0, 175, 186, 8, plain(R.gold), { cut: helmCut });
  if (state < 4) {
    s.line(
      [
        [GU, GV, 186],
        [GU, GV, 192],
      ],
      'ochre3',
    );
    // The gilded corner pinnacles of the gallery.
    for (const [u, v] of [
      [GT.u0, GT.v1],
      [GT.u1, GT.v1],
      [GT.u1, GT.v0],
    ] as const)
      s.prismN(u, v, 0.05, 0, 131, 138, 4, plain(R.gold));
  } else {
    ov.push({ sprite: 'lm.fx.fire.m', u: GU, v: GV, z: 148 });
    ov.push({ sprite: 'lm.fx.smoke', u: GU, v: GV, z: 156 });
  }

  // --- The palace: long south front on the terrace ----------------------------------------
  const top = 60;
  const burnt: Array<{ fx: number; zTop: number; side: 'left' | 'right' }> = [];
  const rows = [52, 42, 32, 22];
  const winAt = (side: 'left' | 'right', fx: number): boolean =>
    side === 'left' ? fx >= 4 && fx <= 214 && !(fx > 100 && fx < 124) : fx >= 46 && fx <= 74;
  if (state >= 3) {
    for (let b = 0; b < 28; b++) {
      const fx = 4 + b * 8;
      if (!winAt('left', fx)) continue;
      for (const [ri, zt] of rows.entries()) {
        const st = windowStatus(state, b * 5 + ri, seed);
        if (st === 'burning' || st === 'gutted') burnt.push({ side: 'left', fx: fx + 3, zTop: zt });
        if (st === 'burning' && ri === 0 && b % 2 === 0)
          ov.push({ sprite: 'lm.fx.fire.s', u: (fx + 3) / 16, v: 4.62, z: zt - 7 });
      }
    }
  }
  const holes: Array<{ fx: number; z: number; r: number }> =
    state >= 4
      ? [
          { fx: 58, z: 30, r: 8 },
          { fx: 172, z: 34, r: 7 },
        ]
      : [];
  const inHole = (fx: number, z: number, grow = 0): boolean =>
    holes.some((h) => {
      const dx = fx - h.fx;
      const dz = (z - h.z) * 1.2;
      const a = Math.atan2(dz, dx);
      const rr = h.r + Math.sin(a * 5 + h.fx) * 1.5 + Math.cos(a * 3) * 1.1 + grow;
      return dx * dx + dz * dz < rr * rr;
    });
  const palace: Material = (c) => {
    if (c.side === 'back') {
      if (c.night) return c.z < 24 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
      return c.z < 22 ? (hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1') : 'ink';
    }
    if (c.side === 'top') {
      if (scorch(c.u, c.v) === 2)
        return c.night ? 'rust3' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust2';
      return c.night ? null : lv(P, c.level);
    }
    const side = c.side === 'right' ? 'right' : 'left';
    if (side === 'left' && holes.length && inHole(c.fx, c.fz, 2)) {
      if (c.night) return null;
      return lv(R.brick, c.level - (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
    }
    // Gate in the middle of the front (top of the castle steps).
    if (side === 'left') {
      const dx = Math.abs(c.fx + 0.5 - 7.0 * 16);
      if (dx < 4 && c.z < 22 + Math.sqrt(Math.max(0, 16 - dx * dx))) {
        if (c.night) return 'ochre1';
        return state >= 3 ? 'ink' : c.z < 14 ? 'earth1' : lv(R.dark, c.level);
      }
      if (dx < 6 && c.z < 30) return c.night ? null : lv(TERRACE, c.level + 1);
    }
    if (winAt(side, c.fx)) {
      const bay = mod(c.fx - 4, 8);
      for (const [ri, zt] of rows.entries()) {
        const b = Math.floor((c.fx - 4) / 8);
        const st = windowStatus(state, side === 'left' ? b * 5 + ri : 500 + b * 5 + ri, seed);
        const p = paintWindow(WIN, c, c.fx - bay, zt, st);
        if (p !== undefined) return p;
      }
    }
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    for (const bw of burnt) {
      if (bw.side !== side) continue;
      const sd = soot(c, bw.fx, bw.zTop, 2, 10);
      if (sd) return sd;
    }
    if (c.edge) return P[0];
    const z = c.fz;
    if (z >= top - 2) return lv(P, c.level + 1);
    if (z === top - 3) return lv(P, c.level - 1);
    if (z === 34 || z === 44) return lv(P, c.level - 1);
    // Pilaster strips at the risalits.
    if (side === 'left' && [40, 56, 160, 176].includes(c.fx)) return lv(P, c.level + 1);
    return lv(P, c.level);
  };
  const palCut = holes.length
    ? (u: number, _v: number, z: number, f: number): boolean =>
        f === 3 && inHole(Math.floor(u * 16), Math.floor(z))
    : undefined;
  s.box(0.3, 13.7, 2.9, 4.6, 12, top, palace, { tag: 'palace', cut: palCut });
  const tile: Material = (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return TILE[0];
    const sc = scorch(c.u, c.v);
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    return lv(TILE, c.level - (mod(c.fz, 3) === 0 ? 1 : 0) - 1);
  };
  s.hip(0.35, 13.65, 2.95, 4.55, top, top + 16, 0.8, tile, { cut: roofCut });
  // Dormers + chimneys.
  for (let u = 1.2; u < 13.4; u += 1.5) {
    if (u > 6.0 && u < 8.0) continue;
    s.box(u - 0.15, u + 0.15, 4.0, 4.25, top, top + 7, (c) => {
      if (c.night) return c.side === 'left' && c.fz > top + 1 && c.fz < top + 5 ? 'ochre1' : null;
      if (c.edge) return P[0];
      if (c.side === 'left' && c.fz > top + 1 && c.fz < top + 5 && Math.abs(c.u - u) < 0.08)
        return state >= 2 ? 'ink' : lv(R.dark, c.level);
      return lv(P, c.level);
    });
    s.gable(u - 0.18, u + 0.18, 3.95, 4.3, top + 7, top + 10, 'v', tile);
  }
  // Central risalit with pediment over the gate.
  s.box(6.2, 7.8, 4.6, 4.75, 12, top + 2, palace, { tag: 'palace', cut: palCut });
  s.gable(6.15, 7.85, 4.0, 4.78, top + 2, top + 12, 'v', (c) =>
    c.side === 'left'
      ? c.night
        ? null
        : c.edge
          ? P[0]
          : lv(P, c.level - (c.rim ? 0 : 1))
      : tile(c),
  );

  // West wing closing the third courtyard (low-u end) and St George's Basilica (high-u end):
  // the red baroque front with the two pale Romanesque towers.
  s.box(0.3, 1.9, 0.4, 2.9, 12, top, palace, { tag: 'palace' });
  s.hip(0.35, 1.85, 0.45, 2.95, top, top + 14, 0.7, tile, { cut: roofCut });
  const george: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(TILE, c.level);
    const win = mod(c.fx, 10) > 3 && mod(c.fx, 10) < 7 && c.fz > 30 && c.fz < 38;
    if (c.night) return win ? 'ochre1' : null;
    if (c.edge) return 'rust0';
    if (win) return lv(R.dark, c.level);
    if (c.fz >= 42) return lv(P, c.level);
    if (mod(c.fx, 10) === 0) return lv(P, c.level - 1);
    return lv(['rust0', 'rust1', 'rust2', 'rust3', 'rust4'], c.level);
  };
  s.box(12.2, 13.8, 0.5, 2.3, 12, 44, george, { tag: 'george' });
  s.gable(12.2, 13.8, 0.55, 2.25, 44, 56, 'u', tile);
  const romanesque: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(P, c.level);
    const op = mod(c.fx, 6) > 1 && mod(c.fx, 6) < 4 && c.fz > 58 && c.fz < 66;
    if (c.night) return op ? 'ochre1' : null;
    if (c.edge) return P[0];
    if (op) return lv(R.dark, c.level);
    if (mod(c.fz, 12) === 0) return lv(P, c.level - 1);
    return lv(P, c.level);
  };
  for (const v0 of [0.5, 1.75]) {
    s.box(12.3, 12.85, v0, v0 + 0.5, 12, 70, romanesque, { tag: 'george' });
    s.hip(12.28, 12.87, v0 - 0.02, v0 + 0.52, 70, 82, 0.3, plain(SLATE));
  }

  // Czech flag on the palace roof.
  const poleTop = state >= 4 ? 94 : 108;
  s.line(
    [
      [4.2, 3.75, top + 12],
      [4.2, 3.75, poleTop],
    ],
    'gray2',
  );
  s.line(
    [
      [4.2, 3.75, poleTop],
      [4.2, 3.75, poleTop + 1],
    ],
    'ochre2',
  );
  ov.push({
    sprite: state >= 2 ? 'lm.flag.cz.torn' : 'lm.flag.cz',
    u: 4.2,
    v: 3.75,
    z: poleTop,
    flag: true,
  });

  // --- New Castle Steps up the terrace wall ------------------------------------------------
  stairs(s, 6.25, 7.75, 6.0, 5.0, 1, 12, 6, stepMat(TERRACE, decals));
  const cheek: Material = (c) =>
    c.night ? null : c.edge ? TERRACE[0] : lv(TERRACE, c.level + (c.side === 'top' ? 0 : 0));
  s.box(6.05, 6.25, 5.0, 6.0, 1, 13, cheek, { tag: 'terrace' });
  s.box(7.75, 7.95, 5.0, 6.0, 1, 13, cheek, { tag: 'terrace' });
  // Garden balustrade on the terrace edge.
  for (let u = 0.2; u < 13.85; u += 0.125) {
    if (u > 6.0 && u < 8.0) continue;
    s.line(
      [
        [u, 4.98, 12],
        [u, 4.98, 15],
      ],
      mod(Math.round(u * 8), 2) ? 'gray6' : 'gray7',
    );
  }
  s.line(
    [
      [0.2, 4.98, 15],
      [6.0, 4.98, 15],
    ],
    'white',
  );
  s.line(
    [
      [8.0, 4.98, 15],
      [13.85, 4.98, 15],
    ],
    'white',
  );
  // Garden trees and lamps.
  const tree: Material = (c) =>
    c.night
      ? null
      : c.edge
        ? 'green0'
        : lv(R.grass, c.level - (hash(c.px, c.py) < 0.25 ? 1 : 0) - 1);
  for (const u of [1.0, 3.2, 10.8, 13.0]) {
    if (state >= 4 && u === 3.2) {
      s.ell(u, 5.55, 6, 0.28, 0.2, 5, plain(R.char));
      continue;
    }
    s.cyl(u, 5.55, 0.04, 1, 6, plain(R.bronze));
    s.ell(u, 5.55, 12, 0.32, 0.24, 9, tree);
  }
  const lp = lamp(state >= 2);
  for (const u of [5.7, 8.3])
    s.sprite(lp.img, 2, 14, u, 5.85, 1, { emit: state >= 2 ? undefined : lp.night });

  banner(s, state, 1.6, 4.4, 5.02, 11, 8, 'DOST!');
  banner(s, state, 9.6, 12.4, 5.02, 11, 8, 'NE!');
  rubble(s, state, 0.3, 13.7, 5.1, 5.9, 1, 14, seed);
  rubble(s, state, 0.4, 13.6, 4.65, 4.95, 12, 8, seed + 1);
  if (state >= 4) {
    const rub = plain(P);
    s.hip(3.3, 4.2, 4.65, 4.95, 12, 18, 0.3, rub);
    s.hip(10.4, 11.0, 5.2, 5.7, 1, 6, 0.25, plain(SOOT_STONE));
  }
  return { scene: s, overlays: ov };
}
