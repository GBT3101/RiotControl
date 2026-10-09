/**
 * London — Palace of Westminster. Footprint 14 (u) × 6 (v). Elizabeth Tower (Big Ben) at the
 * low-u front corner, Westminster Hall's great gable, St Stephen's porch with the steps on the
 * +v (Parliament Square) face, the octagonal Central Tower and Victoria Tower at the far end.
 */
import { Scene, type Material, type ShadeCtx } from './engine/scene';
import { R, hash, lv, mod, plain, type Ramp5 } from './engine/materials';
import {
  banner,
  breakAbove,
  rubble,
  decalAt,
  gothicWall,
  roofMat,
  scatterDecals,
  scorchZones,
  stairs,
  stepMat,
  windowStatus,
  type DamageState,
} from './engine/kit';
import type { Build, Overlay } from './types';

export const WESTMINSTER_W = 14;
export const WESTMINSTER_D = 6;

/** Elizabeth Tower geometry (shared with the clock-hand overlays). */
export const BIG_BEN = {
  u0: 0.3,
  u1: 1.7,
  v0: 4.3,
  v1: 5.7,
  clockZ: 129,
  clockR: 8,
};

export function buildWestminster(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 2200;
  const honey: Ramp5 = R.honey;
  const H = honey;

  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'facade', 40, 115, 2, 14],
      ['left', 'facade', 140, 220, 2, 14],
      ['right', 'facade', 10, 70, 2, 14],
      ['left', 'hall', 34, 66, 2, 14],
      ['left', 'tower', 6, 26, 2, 16],
      ['right', 'tower', 70, 90, 2, 16],
      ['left', 'stairs', 118, 140, 1, 7],
    ],
    1.3,
  );
  const scorch = scorchZones(
    state === 3
      ? [[10.5, 2.4, 0.8]]
      : state >= 4
        ? [
            [10.2, 2.4, 1.4],
            [4.8, 2.0, 1.0],
            [12.8, 3.6, 0.7],
          ]
        : [],
  );
  const roof = roofMat(R.iron, scorch);
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.7
      : undefined;
  if (state >= 3) ov.push({ sprite: 'lm.fx.smoke', u: 10.5, v: 2.4, z: 60 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 10.2, v: 2.6, z: 52 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 4.8, v: 2.0, z: 62 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 12.8, v: 3.6, z: 50 });
  }

  // Burning windows → soot + fire overlays (front façade, upper row).
  const burnt: Array<{ side: 'left' | 'right'; fx: number; zTop: number }> = [];
  if (state >= 3) {
    for (let b = 0; b < 30; b++) {
      const fx = 70 + b * 8 + 4;
      if (fx > 220) break;
      if (fx > 112 && fx < 146) continue;
      const st = windowStatus(state, b * 13 + 5, seed);
      if (st === 'burning' || st === 'gutted') {
        burnt.push({ side: 'left', fx, zTop: 34 });
        if (st === 'burning' && b % 2 === 0)
          ov.push({ sprite: 'lm.fx.fire.s', u: fx / 16, v: 4.4, z: 26 });
      }
    }
  }

  // --- Ground: Old Palace Yard paving with lawns ------------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    const lawn = c.v > 4.9 && c.v < 5.8 && ((c.u > 2.2 && c.u < 6.6) || (c.u > 9.6 && c.u < 13.6));
    if (lawn) {
      if (state >= 2 && hash(Math.floor(c.u * 6), Math.floor(c.v * 6)) < 0.25 * (state - 1))
        return lv(R.gravel, c.level - 1);
      return lv(R.grass, c.level - (mod(c.px + c.py, 7) === 0 ? 1 : 0));
    }
    const ju = mod(c.u * 4, 1) < 0.07;
    const jv = mod(c.v * 4, 1) < 0.14;
    return lv(R.paving, c.level - (ju || jv ? 1 : 0));
  };
  s.box(0, WESTMINSTER_W, 0, WESTMINSTER_D, 0, 1, ground, { cast: false });

  // --- Main river-front range ---------------------------------------------------------------
  const wallTop = 46;
  const facade = gothicWall({
    ramp: H,
    pitch: 8,
    off: 2,
    rows: [
      { zTop: 13, h: 9 },
      { zTop: 30, h: 13, w: 3 },
      { zTop: 41, h: 6 },
    ],
    top: wallTop,
    state,
    seed,
    decals,
    burnt,
  });
  const bodyCut =
    state >= 4
      ? (u: number, _v: number, z: number, f: number): boolean => {
          if (f !== 3) return false;
          const d = Math.hypot((u - 10.6) * 16, (z - 22) * 1.3);
          return d < 9 + Math.sin(Math.atan2(z - 22, u - 10.6) * 5) * 1.5;
        }
      : undefined;
  s.box(4.4, 13.8, 0.5, 4.4, 1, wallTop, facade, { tag: 'facade', cut: bodyCut });
  s.gable(4.4, 13.8, 0.6, 4.3, wallTop, 64, 'u', roof, { cut: roofCut });
  // Ridge cresting (gilded iron).
  for (let u = 4.6; u < 13.7; u += 0.25) {
    s.line(
      [
        [u, 2.45, 64],
        [u, 2.45, 66],
      ],
      mod(Math.round(u * 4), 2) ? 'ochre1' : 'zinc0',
    );
  }
  // Pinnacles along the parapet (every second buttress).
  const pin: Material = (c) => (c.night ? null : c.edge ? H[0] : lv(R.honeyLit, c.level));
  for (let fx = 2; fx <= 220; fx += 16) {
    const u = (fx + 0.5) / 16;
    if (u < 4.45 || u > 13.75) continue;
    if (state >= 4 && hash(fx, 3) < 0.4) continue;
    s.prismN(u, 4.42, 0.09, 0.09, wallTop - 4, wallTop + 3, 4, pin);
    s.prismN(u, 4.42, 0.09, 0.0, wallTop + 3, wallTop + 11, 4, pin);
  }
  for (let fx = 10; fx <= 70; fx += 16) {
    const v = (fx + 0.5) / 16;
    s.prismN(13.82, v, 0.09, 0.09, wallTop - 4, wallTop + 3, 4, pin);
    s.prismN(13.82, v, 0.09, 0.0, wallTop + 3, wallTop + 11, 4, pin);
  }

  // --- St Stephen's porch (central entrance) with steps --------------------------------------
  const porchFace = gothicWall({
    ramp: R.honeyLit,
    pitch: 6,
    off: 0,
    rows: [{ zTop: 46, h: 14, w: 5 }],
    top: 56,
    state,
    seed: seed + 1,
    decals,
    blank: (side, _fx, z) => side === 'left' && z < 32,
    extra: (c) => {
      // Great pointed entrance arch on the front.
      if (c.side !== 'left') return undefined;
      const cx = 8.1 * 16;
      const dx = Math.abs(c.fx + 0.5 - cx);
      const archTop = 26 - (dx * dx) / 6;
      if (dx < 6 && c.z < archTop + 2 && c.z > 6) {
        if (c.night) return dx < 4.5 && c.z < archTop ? 'ochre2' : null;
        if (dx >= 4.5 || c.z >= archTop) return lv(R.honeyLit, c.level + 1);
        return state >= 3 ? 'ink' : c.z < 8 ? 'earth1' : lv(R.dark, c.level);
      }
      return undefined;
    },
  });
  s.box(7.3, 8.9, 4.4, 5.0, 1, 56, porchFace, { tag: 'porch' });
  s.gable(7.25, 8.95, 4.35, 5.05, 56, 70, 'v', roof);
  for (const u of [7.3, 8.9]) {
    s.prismN(u, 5.0, 0.13, 0.13, 1, 62, 8, pin, { rot: Math.PI / 8 });
    s.prismN(u, 5.0, 0.13, 0.0, 62, 76, 8, pin, { rot: Math.PI / 8 });
  }
  stairs(s, 7.4, 8.8, 6.0, 5.0, 1, 7, 3, stepMat(R.granite, decals));

  // --- Westminster Hall: great gable end facing the square ------------------------------------
  const hallWall: Material = (c) => {
    if (c.side === 'left') {
      // Gable end: the great perpendicular window.
      const cx = 3.2 * 16;
      const dx = c.fx + 0.5 - cx;
      const archTop = 50 - (dx * dx) / 9;
      if (Math.abs(dx) < 11 && c.z > 18 && c.z < archTop) {
        const mull = mod(Math.round(dx), 3) === 0 || mod(c.fz, 7) === 0;
        if (c.night) return mull ? null : 'ochre2';
        if (mull) return lv(H, c.level - 1);
        const st = windowStatus(state, 77 + Math.floor(dx / 3), seed);
        if (st === 'smashed' && hash(c.fx, c.fz) < 0.5) return 'zinc2';
        if (st === 'burning' || st === 'gutted') return 'ink';
        return lv(R.dark, c.level);
      }
      if (Math.abs(dx) < 12.5 && c.z > 17 && c.z < archTop + 2)
        return c.night ? null : lv(H, c.level + 1);
      if (!c.night) {
        const d = decalAt(decals, c);
        if (d) return d;
        // Doorway at the foot.
        if (Math.abs(dx) < 4 && c.z < 13 - (dx * dx) / 5) return lv(R.dark, c.level);
      }
    }
    return facade(c);
  };
  s.box(1.9, 4.4, 0.6, 4.9, 1, 40, hallWall, { tag: 'hall' });
  s.gable(1.85, 4.45, 0.55, 4.95, 40, 78, 'v', roof, { cut: roofCut });
  // Lantern on the hall roof.
  s.prismN(3.15, 2.6, 0.18, 0.18, 70, 80, 8, pin, { rot: Math.PI / 8 });
  s.prismN(3.15, 2.6, 0.2, 0.0, 80, 88, 8, roof, { rot: Math.PI / 8 });
  // Hall corner turrets.
  for (const u of [1.95, 4.35]) {
    s.prismN(u, 4.85, 0.16, 0.16, 1, 58, 8, pin, { rot: Math.PI / 8, tag: 'hall' });
    s.prismN(u, 4.85, 0.17, 0.0, 58, 72, 8, roof, { rot: Math.PI / 8 });
  }

  // --- Central Tower (octagonal lantern + spire) ---------------------------------------------
  const ctWall: Material = (c) => {
    if (c.night) return mod(c.fx, 4) === 1 && c.fz > 76 && c.fz < 86 ? 'ochre2' : null;
    if (c.edge) return H[0];
    if (mod(c.fx, 4) === 1 && c.fz > 76 && c.fz < 86) return lv(R.dark, c.level);
    if (c.fz >= 88) return lv(R.honeyLit, c.level);
    return lv(H, c.level);
  };
  const ctBroken = state >= 4 ? breakAbove(100, 1) : undefined;
  s.prismN(8.1, 2.4, 0.55, 0.55, 50, 90, 8, ctWall, { rot: Math.PI / 8 });
  const ctSpire: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return H[0];
    // Crocketed ribs at the octagon arrises, lucarne slits, lead-grey between.
    const a = Math.atan2(c.v - 2.4, c.u - 8.1) / (Math.PI / 4);
    const rib = Math.abs(a - Math.round(a)) < 0.12;
    if (rib) return lv(R.honeyLit, c.level + 1);
    if (c.fz > 98 && c.fz < 104 && mod(c.fx, 4) === 1) return lv(R.dark, c.level);
    return lv(R.honey, c.level);
  };
  s.prismN(8.1, 2.4, 0.5, 0.16, 90, 112, 8, ctSpire, { rot: Math.PI / 8, cut: ctBroken });
  s.prismN(8.1, 2.4, 0.16, 0.0, 112, 134, 8, ctSpire, { rot: Math.PI / 8, cut: ctBroken });
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4;
    const u = 8.1 + Math.cos(th) * 0.55;
    const v = 2.4 + Math.sin(th) * 0.55;
    if (u + v < 8.1 + 2.4 - 0.2) continue;
    s.prismN(u, v, 0.06, 0.0, 88, 98, 4, pin);
  }
  if (state < 4)
    s.line(
      [
        [8.1, 2.4, 134],
        [8.1, 2.4, 139],
      ],
      'ochre2',
    );

  // --- Victoria Tower (far end) --------------------------------------------------------------
  const vtWall = gothicWall({
    ramp: H,
    pitch: 7,
    off: 0,
    rows: [
      { zTop: 70, h: 18, w: 5 },
      { zTop: 110, h: 22, w: 5 },
    ],
    top: 142,
    state,
    seed: seed + 9,
    decals: [],
  });
  s.box(11.9, 13.7, 0.5, 2.3, 1, 142, vtWall, { tag: 'vt' });
  s.hip(12.0, 13.6, 0.6, 2.2, 142, 147, 0.5, roof);
  for (const [u, v] of [
    [11.9, 2.3],
    [13.7, 2.3],
    [13.7, 0.5],
    [11.9, 0.5],
  ] as const) {
    s.prismN(u, v, 0.16, 0.16, 120, 150, 8, pin, { rot: Math.PI / 8 });
    s.prismN(u, v, 0.16, 0.0, 150, 160, 8, plain(R.gold), { rot: Math.PI / 8 });
  }
  const vtPole = state >= 4 ? 158 : 172;
  s.line(
    [
      [12.8, 1.4, 142],
      [12.8, 1.4, vtPole],
    ],
    'gray2',
  );
  ov.push({
    sprite: state >= 2 ? 'lm.flag.uk.torn' : 'lm.flag.uk',
    u: 12.8,
    v: 1.4,
    z: vtPole,
    flag: true,
  });

  // --- Elizabeth Tower -----------------------------------------------------------------------
  const B = BIG_BEN;
  const towerShaft: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(H, c.level);
    if (c.night)
      return mod(c.fx, 4) === 2 && mod(c.fz, 14) > 4 && mod(c.fz, 14) < 10 && c.fz > 20
        ? 'ochre1'
        : null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return H[0];
    const z = c.fz;
    // Corner shafts catch the light; vertical panelling; small lancets.
    const local = c.side === 'left' ? c.fx - Math.floor(B.u0 * 16) : c.fx - Math.floor(B.v0 * 16);
    const span = 22;
    if (local <= 1 || local >= span - 1) return lv(R.honeyLit, c.level + (local <= 1 ? 1 : 0));
    if (mod(z, 14) === 0) return lv(H, c.level - 1);
    if (mod(z, 14) === 1) return lv(R.honeyLit, c.level);
    if (mod(local, 4) === 2 && mod(z, 14) > 4 && mod(z, 14) < 10 && z > 20)
      return lv(R.dark, c.level);
    if (mod(local, 4) === 0) return lv(H, c.level - 1);
    return lv(H, c.level);
  };
  s.box(B.u0, B.u1, B.v0, B.v1, 1, 116, towerShaft, { tag: 'tower' });
  // Clock stage (slightly proud) with the four dials.
  const clockMat: Material = (c) => clockFace(c, state);
  s.box(B.u0 - 0.1, B.u1 + 0.1, B.v0 - 0.1, B.v1 + 0.1, 116, 142, clockMat);
  // Belfry with pointed openings.
  const belfry: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(H, c.level);
    const local = c.side === 'left' ? c.fx - Math.floor(B.u0 * 16) : c.fx - Math.floor(B.v0 * 16);
    const opening =
      mod(local - 2, 6) < 3 && c.fz > 145 && c.fz < 153 - (mod(local - 2, 6) === 1 ? 0 : 1);
    if (c.night) return opening ? 'ochre1' : null;
    if (c.edge) return H[0];
    if (opening) return lv(R.dark, c.level - 1);
    if (c.fz >= 154) return lv(R.honeyLit, c.level + 1);
    return lv(R.honeyLit, c.level);
  };
  s.box(B.u0 + 0.05, B.u1 - 0.05, B.v0 + 0.05, B.v1 - 0.05, 142, 156, belfry);
  // Corner pinnacles around the spire.
  for (const [u, v] of [
    [B.u0 + 0.05, B.v1 - 0.05],
    [B.u1 - 0.05, B.v1 - 0.05],
    [B.u1 - 0.05, B.v0 + 0.05],
    [B.u0 + 0.05, B.v0 + 0.05],
  ] as const) {
    s.prismN(u, v, 0.1, 0.1, 152, 160, 4, pin);
    s.prismN(u, v, 0.1, 0.0, 160, 170, 4, plain(R.gold));
  }
  // Cast-iron spire with gilded bands.
  const spire: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'ink';
    const z = c.fz;
    if (z > 186) return lv(R.gold, c.level);
    if (mod(z, 8) === 0 || mod(z, 8) === 1) return lv(R.gold, c.level - 1);
    if (mod(c.fx, 3) === 0 && mod(z, 8) > 3) return lv(R.gold, c.level - 2);
    return lv(R.iron, c.level);
  };
  const ebCut = state >= 4 ? breakAbove(176, 4) : undefined;
  s.hip(B.u0 + 0.12, B.u1 - 0.12, B.v0 + 0.12, B.v1 - 0.12, 156, 198, 0.58, spire, { cut: ebCut });
  if (state < 4) {
    s.line(
      [
        [(B.u0 + B.u1) / 2, (B.v0 + B.v1) / 2, 198],
        [(B.u0 + B.u1) / 2, (B.v0 + B.v1) / 2, 206],
      ],
      'ochre3',
    );
    s.line(
      [
        [(B.u0 + B.u1) / 2 - 0.06, (B.v0 + B.v1) / 2 + 0.06, 202],
        [(B.u0 + B.u1) / 2 + 0.06, (B.v0 + B.v1) / 2 - 0.06, 202],
      ],
      'ochre2',
    );
  } else {
    ov.push({ sprite: 'lm.fx.fire.m', u: (B.u0 + B.u1) / 2, v: (B.v0 + B.v1) / 2, z: 172 });
    ov.push({ sprite: 'lm.fx.smoke', u: (B.u0 + B.u1) / 2, v: (B.v0 + B.v1) / 2, z: 182 });
  }
  // Connecting block behind the tower.
  s.box(0.4, 1.9, 0.7, 4.3, 1, 42, facade, { tag: 'facade' });
  s.gable(0.35, 1.95, 0.65, 4.3, 42, 56, 'v', roof);

  // Clock hands overlays (dial centres).
  const cz = B.clockZ;
  ov.push({
    sprite: state >= 4 ? '' : 'lm.capitol.london.hands.l',
    u: (B.u0 + B.u1) / 2,
    v: B.v1 + 0.1,
    z: cz,
  });
  ov.push({
    sprite: state >= 4 ? '' : 'lm.capitol.london.hands.r',
    u: B.u1 + 0.1,
    v: (B.v0 + B.v1) / 2,
    z: cz,
  });

  // Railings along the square.
  for (let u = 0.2; u < 13.9; u += 0.125) {
    if (u > 7.3 && u < 8.95) continue;
    s.line(
      [
        [u, 5.95, 1],
        [u, 5.95, 5],
      ],
      mod(Math.round(u * 8), 4) === 0 ? 'ochre1' : 'ink',
    );
  }
  s.line(
    [
      [0.2, 5.95, 5],
      [7.3, 5.95, 5],
    ],
    'ink',
  );
  s.line(
    [
      [8.95, 5.95, 5],
      [13.9, 5.95, 5],
    ],
    'ink',
  );
  banner(s, state, 9.4, 13.4, 5.99, 10, 8, 'DOWN WITH THINGS');
  banner(s, state, 2.2, 4.6, 5.99, 10, 8, 'OI NO');
  rubble(s, state, 2.0, 13.5, 4.5, 5.85, 1, 14, seed);
  return { scene: s, overlays: ov.filter((o) => o.sprite) };
}

/** Elizabeth Tower clock dial painter (both visible faces). */
function clockFace(c: ShadeCtx, state: DamageState): string | null {
  const B = BIG_BEN;
  if (c.side === 'top') return c.night ? null : lv(R.honeyLit, c.level);
  const cx = c.side === 'left' ? ((B.u0 + B.u1) / 2) * 16 : ((B.v0 + B.v1) / 2) * 16;
  const dx = c.fx + 0.5 - cx;
  const dz = c.z - B.clockZ;
  const r = Math.hypot(dx, dz * 1.0);
  const R0 = B.clockR;
  if (r < R0 - 1.5) {
    // Opal glass dial with hour marks.
    if (state >= 4 && hash(c.fx, c.fz) < 0.5 && r > 2) return c.night ? null : 'ink';
    if (state >= 3 && dx > 0 && dz < 0) return c.night ? null : lv(R.char, c.level + 1);
    const ang = Math.atan2(dz, dx);
    const hour = Math.abs(((ang / (Math.PI / 6)) % 1) + 1) % 1;
    const mark = r > R0 - 3.5 && (hour < 0.18 || hour > 0.82);
    if (c.night) return mark ? 'ochre2' : 'ochre4';
    if (mark) return 'ink';
    return c.level >= 3 ? 'white' : 'stone4';
  }
  if (c.night) return null;
  if (r < R0 - 0.5) return lv(R.gold, c.level);
  if (r < R0 + 0.5) return 'ink';
  // Gilded square surround with tracery.
  const local = Math.abs(dx);
  if (Math.abs(dz) > R0 + 2 || local > R0 + 2) {
    if (c.edge) return R.honey[0];
    if (Math.abs(dz) > R0 + 3 && mod(c.fx, 2) === 0) return lv(R.honeyLit, c.level - 1);
    return lv(R.honeyLit, c.level);
  }
  return mod(c.fx + c.fz, 2) === 0 ? lv(R.gold, c.level - 1) : lv(R.gold, c.level - 2);
}
