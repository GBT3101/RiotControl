/**
 * Secondary landmarks of Vienna — the Rathaus (with the Rathausmann on its tower), the Hofburg
 * (the curved Neue Burg on Heldenplatz, a green copper dome behind) and the Stephansdom (the
 * zigzag glazed-tile roof with the double-headed eagle, the south tower). Contract footprints:
 * LANDMARKS in src/maps/contract.ts. All face +v (the lit SW side).
 */
import { Scene, type Material, type Plane } from '../engine/scene';
import { R, lv, mod, plain, type Ramp5 } from '../engine/materials';
import { column, gothicWall, roofMat } from '../engine/kit';
import { grid, keyGrid } from '../../lib/grid';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { gravel, paving, plate, type SecondaryArt } from '../shared';
import { ATTIC, RATHAUSMANN } from './sprites.grid';

/** Rathaus / Stephansdom stone: grey sandstone with warm lights. */
const GREY_STONE: Ramp5 = ['stone0', 'gray3', 'gray4', 'gray5', 'stone3'];
const GREY_LIT: Ramp5 = ['gray3', 'gray4', 'gray5', 'stone3', 'stone4'];
const SLATE: Ramp5 = ['ink', 'gray1', 'zinc0', 'zinc1', 'zinc2'];
const COPPER: Ramp5 = ['green0', 'green1', 'teal1', 'teal2', 'teal2'];

const slate = roofMat(SLATE, undefined, 3);
const pinMat: Material = (c) => (c.night ? null : c.edge ? GREY_STONE[0] : lv(GREY_LIT, c.level));

function needle(
  s: Scene,
  u: number,
  v: number,
  r: number,
  z0: number,
  z1: number,
  z2: number,
): void {
  s.prismN(u, v, r, r, z0, z1, 4, pinMat);
  s.prismN(u, v, r, 0, z1, z2, 4, pinMat);
}

// ---------------------------------------------------------------------------------------------
// Rathaus (10 × 6)
// ---------------------------------------------------------------------------------------------

function rathaus(): Build {
  const s = new Scene();
  plate(s, 10, 6, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    if (c.v > 5.0 && (c.u < 3.6 || c.u > 6.4))
      return lv(R.grass, c.level - (mod(c.px + c.py, 7) === 0 ? 1 : 0));
    return paving(c);
  });
  const G = GREY_STONE;
  const wall = gothicWall({
    ramp: G,
    pitch: 9,
    off: 2,
    rows: [
      { zTop: 46, h: 14, w: 5 },
      { zTop: 28, h: 10, w: 3 },
    ],
    top: 54,
    state: 0,
    seed: 41,
    decals: [],
    extra: (c) => {
      // Arcaded loggia on the ground floor of the front.
      if (c.side !== 'left' || c.fz > 15) return undefined;
      const rel = mod(c.fx - 2, 9) - 4;
      const arch = Math.abs(rel) < 3.2 && c.fz < 14 - Math.abs(rel) * 0.9 && c.fz > 1;
      if (!arch) return undefined;
      return c.night ? 'ochre1' : lv(R.dark, Math.min(c.level, 2));
    },
  });
  s.box(0.5, 9.5, 0.8, 4.4, 1, 54, wall);
  s.gable(0.5, 9.5, 0.9, 4.3, 54, 78, 'u', slate);
  // End pavilions with steep pyramid roofs and corner turrets.
  for (const [u0, u1] of [
    [0.3, 1.9],
    [8.1, 9.7],
  ] as const) {
    s.box(u0, u1, 0.6, 4.7, 1, 60, wall);
    s.hip(u0 + 0.05, u1 - 0.05, 0.65, 4.65, 60, 94, 0.75, slate);
    for (const [tu, tv] of [
      [u0, 4.7],
      [u1, 4.7],
      [u1, 0.6],
    ] as const) {
      s.prismN(tu, tv, 0.13, 0.13, 30, 66, 8, pinMat, { rot: Math.PI / 8 });
      s.prismN(tu, tv, 0.15, 0, 66, 82, 8, slate, { rot: Math.PI / 8 });
    }
    s.line(
      [
        [(u0 + u1) / 2, 2.65, 94],
        [(u0 + u1) / 2, 2.65, 100],
      ],
      'ochre2',
    );
  }
  // Wimperg gables along the front parapet.
  for (let u = 2.4; u < 7.8; u += 0.8) {
    if (u > 3.9 && u < 6.1) continue;
    s.gable(u - 0.22, u + 0.22, 4.3, 4.42, 50, 62, 'v', pinMat);
  }
  // Four smaller towers flanking the centre.
  for (const [tu, tv] of [
    [3.7, 4.45],
    [6.3, 4.45],
    [3.7, 1.25],
    [6.3, 1.25],
  ] as const) {
    s.box(tu - 0.26, tu + 0.26, tv - 0.26, tv + 0.26, 1, 98, wall);
    s.prismN(tu, tv, 0.28, 0.02, 98, 124, 8, slate, { rot: Math.PI / 8 });
    for (const [du, dv] of [
      [-0.26, 0.26],
      [0.26, 0.26],
      [0.26, -0.26],
    ] as const)
      needle(s, tu + du, tv + dv, 0.04, 92, 98, 106);
  }
  // Central tower: square shaft with balcony, octagonal upper stage, spire, Rathausmann.
  const TU = 5.0;
  const TV = 4.35;
  const shaft: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(G, c.level);
    const local = c.side === 'left' ? c.fx - Math.floor(4.3 * 16) : c.fx - Math.floor(3.65 * 16);
    const win =
      Math.abs(local - 11) < 2 &&
      ((c.fz > 60 && c.fz < 80) || (c.fz > 88 && c.fz < 108) || (c.fz > 30 && c.fz < 48));
    // Clock.
    const r = Math.hypot(local - 11, c.z - 114);
    if (r < 4.5) {
      if (c.night) return 'ochre3';
      return r > 3.5 ? lv(R.gold, c.level) : c.level >= 3 ? 'white' : 'stone4';
    }
    const portal =
      c.side === 'left' && Math.abs(local - 11) < 4 && c.z < 18 - Math.abs(local - 11) * 0.6;
    if (c.night) return win || portal ? 'ochre1' : null;
    if (c.edge) return G[0];
    if (portal) return lv(R.dark, c.level - 1);
    if (win)
      return mod(c.fz, 7) === 0 || Math.abs(local - 11) < 0.5
        ? lv(G, c.level)
        : lv(R.dark, c.level);
    if (local < 1.5 || local > 20.5) return lv(GREY_LIT, c.level);
    if (mod(c.fz, 14) === 0) return lv(G, c.level - 1);
    return lv(G, c.level);
  };
  s.box(4.3, 5.7, 3.65, 5.05, 1, 120, shaft);
  // Balcony on the tower front.
  s.box(4.5, 5.5, 5.05, 5.25, 48, 51, plain(GREY_LIT, { rim: true }));
  // Corner pinnacles at the top of the shaft.
  for (const [u, v] of [
    [4.3, 5.05],
    [5.7, 5.05],
    [5.7, 3.65],
    [4.3, 3.65],
  ] as const)
    needle(s, u, v, 0.08, 114, 124, 136);
  const octa: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(G, c.level);
    const op = mod(c.fx, 4) > 0 && mod(c.fx, 4) < 3 && c.fz > 126 && c.fz < 140;
    if (c.night) return op ? 'ochre1' : null;
    if (c.edge) return G[0];
    if (op) return lv(R.dark, c.level - 1);
    return lv(GREY_LIT, c.level);
  };
  s.prismN(TU, TV, 0.5, 0.42, 120, 146, 8, octa, { rot: Math.PI / 8 });
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4 + Math.PI / 8;
    needle(s, TU + Math.cos(th) * 0.46, TV + Math.sin(th) * 0.46, 0.04, 142, 148, 156);
  }
  const spire: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'ink';
    if (mod(c.fz, 8) === 0) return lv(GREY_LIT, c.level);
    return lv(SLATE, c.level + (c.rim ? 1 : 0));
  };
  s.prismN(TU, TV, 0.4, 0.05, 146, 178, 8, spire, { rot: Math.PI / 8 });
  s.sprite(
    grid(RATHAUSMANN, { o: 'gray1', h: 'ochre3', y: 'ochre1' }, {}, 'rathausmann'),
    2,
    7,
    TU,
    TV,
    178,
  );
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Hofburg — the Neue Burg's concave wing (12 × 5)
// ---------------------------------------------------------------------------------------------

function hofburg(): Build {
  const s = new Scene();
  plate(s, 12, 5, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.gravel, c.level - 1);
    if (c.v > 4.3 && c.u > 3.0 && c.u < 9.0)
      return lv(R.grass, c.level - (mod(c.px + c.py, 7) === 0 ? 1 : 0));
    return gravel(c);
  });
  const C = R.creamWarm;
  const CX = 6.0;
  const CY = 13.6;
  const RAD = 10.6;
  const arc = (th: number): [number, number] => [CX + RAD * Math.sin(th), CY - RAD * Math.cos(th)];
  const facade: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(C, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const z = c.fz;
    // Rusticated ground floor with round-arched windows.
    if (z < 20) {
      const rel = mod(c.fx, 8) - 4;
      const win = Math.abs(rel) < 1.8 && z > 5 && z < 14 + (Math.abs(rel) < 1 ? 1 : 0);
      if (c.night) return win ? 'ochre1' : null;
      if (c.edge) return C[0];
      if (win) return lv(R.dark, c.level);
      if (z === 19) return lv(C, c.level + 1);
      if (mod(z, 3) === 0) return lv(C, c.level - 1);
      return lv(C, c.level);
    }
    // Recessed loggia behind the colonnade (in shade) with tall windows.
    if (z < 48) {
      const rel = mod(c.fx, 8) - 4;
      const win = Math.abs(rel) < 1.6 && z > 24 && z < 42;
      if (c.night) return win ? 'ochre2' : null;
      if (c.edge) return C[0];
      if (win) return z === 33 ? lv(C, c.level - 1) : lv(R.dark, c.level - 1);
      return lv(C, Math.min(c.level, 2) - 1);
    }
    if (c.night) return null;
    if (c.edge) return C[0];
    if (z >= 56) return lv(C, c.level + 1);
    if (z === 49 || z === 55) return lv(C, c.level - 1);
    return lv(C, c.level);
  };
  // Concave wing in 14 chord segments.
  const N = 14;
  const ta = Math.asin((0.6 - CX) / RAD);
  const tb = Math.asin((11.4 - CX) / RAD);
  for (let k = 0; k < N; k++) {
    const a = ta + ((tb - ta) * k) / N;
    const b = ta + ((tb - ta) * (k + 1)) / N;
    const m = (a + b) / 2;
    const A = arc(a);
    const B = arc(b);
    const nu = -Math.sin(m);
    const nv = Math.cos(m);
    const planes: Plane[] = [
      { nu, nv, nz: 0, c: nu * A[0] + nv * A[1] },
      { nu: -Math.cos(a), nv: -Math.sin(a), nz: 0, c: -(Math.cos(a) * CX + Math.sin(a) * CY) },
      { nu: Math.cos(b), nv: Math.sin(b), nz: 0, c: Math.cos(b) * CX + Math.sin(b) * CY },
      { nu: 0, nv: -1, nz: 0, c: -0.6 },
      { nu: 0, nv: 0, nz: -1, c: -1 },
      { nu: 0, nv: 0, nz: 1, c: 58 },
    ];
    const u0 = Math.min(A[0], CX + (CY - 0.6) * Math.tan(a)) - 0.1;
    const u1 = Math.max(B[0], CX + (CY - 0.6) * Math.tan(b)) + 0.1;
    s.poly(planes, [u0, u1, 0.6, Math.max(A[1], B[1]) + 0.05, 1, 58], facade);
    // Paired columns of the colonnade along the arc.
    for (const t of [0.3, 0.7]) {
      const th = a + (b - a) * t;
      const [pu, pv] = arc(th);
      for (const d of [-0.07, 0.07]) {
        column(s, {
          u: pu + Math.cos(th) * d - Math.sin(th) * 0.12,
          v: pv + Math.sin(th) * d + Math.cos(th) * 0.12,
          z0: 20,
          z1: 48,
          r: 0.055,
          ramp: R.limePale,
        });
      }
    }
  }
  // Roof behind the attic, end pavilions, attic statues.
  const roof = roofMat(R.slateLit, undefined, 3);
  s.gable(1.25, 10.75, 0.6, 2.8, 58, 70, 'u', roof);
  const pav = (u0: number, u1: number, v1: number): void => {
    s.box(u0, u1, 0.5, v1, 1, 62, facade);
    s.hip(u0 + 0.05, u1 - 0.05, 0.55, v1 - 0.05, 62, 74, 0.5, roof);
  };
  pav(0.2, 1.3, 4.85);
  pav(10.7, 11.8, 4.85);
  const attic = grid(ATTIC, { o: 'gray3', h: 'white', l: 'gray7', m: 'gray6' }, {}, 'hofAttic');
  for (let k = 1; k < 13; k++) {
    const th = ta + ((tb - ta) * k) / 13;
    const [pu, pv] = arc(th);
    s.sprite(attic, 1, 6, pu - Math.sin(th) * 0.05, pv + Math.cos(th) * 0.05, 58);
  }
  // The green copper dome behind (the Hofburg's Michaelerkuppel-style dome) + lantern.
  const DU = 4.2;
  const DV = 1.5;
  const drum: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(C, c.level);
    const a = Math.atan2(c.v - DV, c.u - DU);
    const k = mod((a * 12) / (2 * Math.PI), 1);
    const win = k > 0.3 && k < 0.7 && c.fz > 70 && c.fz < 82;
    if (c.night) return win ? 'ochre2' : null;
    if (c.edge) return C[0];
    if (win) return lv(R.dark, c.level);
    if (c.fz >= 84) return lv(C, c.level + 1);
    return lv(C, c.level - (k < 0.15 || k > 0.85 ? 0 : 1));
  };
  s.cyl(DU, DV, 0.95, 58, 86, drum);
  const dome: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return COPPER[0];
    const a = Math.atan2(c.v - DV, c.u - DU);
    const k = mod((a * 12) / (2 * Math.PI) + 0.5, 1);
    if (Math.abs(k - 0.5) < 0.08) return lv(R.gold, c.level - 1);
    return lv(COPPER, c.level + (c.rim ? 1 : 0));
  };
  s.ell(DU, DV, 86, 0.95, 0.95, 26, dome, { zMin: 86 });
  s.cyl(DU, DV, 0.2, 110, 120, plain(COPPER, { rim: true }));
  s.ell(DU, DV, 120, 0.22, 0.22, 5, dome, { zMin: 120 });
  s.line(
    [
      [DU, DV, 124],
      [DU, DV, 131],
    ],
    'ochre3',
  );
  s.line(
    [
      [0.75, 2.7, 74],
      [0.75, 2.7, 94],
    ],
    'gray2',
  );
  return {
    scene: s,
    overlays: [{ sprite: 'lm.flag.at.small', u: 0.75, v: 2.7, z: 94, flag: true }],
  };
}

// ---------------------------------------------------------------------------------------------
// Stephansdom (7 × 4)
// ---------------------------------------------------------------------------------------------

/** The double-headed eagle mosaic on the south roof over the choir (k black, r red, w white). */
const EAGLE = keyGrid(`
  k..k.......k..k
  kk.kk.....kk.kk
  .kkkkk...kkkkk.
  ..kkkkkkkkkkk..
  k.kkkkkrrkkkk.k
  kkkk.kkwwkk.kkk
  .kk..kkrrkk..kk
  .....kkkkkk....
  ....kk.kk.kk...
  ....k..k...k...
`);

const ZIG: Ramp5[] = [
  ['earth3', 'ochre1', 'ochre2', 'ochre3', 'ochre4'],
  ['green0', 'green1', 'green2', 'green3', 'green4'],
  ['gray4', 'gray5', 'stone4', 'stone5', 'white'],
  ['ink', 'ink', 'gray1', 'zinc0', 'zinc1'],
];

function stephansdom(): Build {
  const s = new Scene();
  plate(s, 7, 4, paving);
  const G = GREY_STONE;
  const wall = gothicWall({
    ramp: G,
    pitch: 10,
    off: 4,
    rows: [{ zTop: 38, h: 26, w: 5 }],
    top: 42,
    state: 0,
    seed: 77,
    decals: [],
  });
  s.box(0.7, 6.2, 0.7, 3.2, 1, 42, wall);
  // Choir apse at the east (high-u) end.
  s.prismN(6.0, 1.95, 1.15, 1.15, 1, 42, 8, wall, { rot: Math.PI / 8 });
  // The great glazed-tile roof: zigzag bands, the eagle over the choir on the south slope.
  const tiles: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'ink';
    if (c.side === 'slopeL' || c.side === 'left') {
      const ex = (c.fx - 72) >> 1;
      const ey = (88 - c.fz) >> 1;
      if (c.fx >= 72 && c.fz <= 88 && ex < EAGLE.w && ey < EAGLE.h) {
        const k = EAGLE.rows[ey]![ex]!;
        if (k === 'k') return lv(ZIG[3]!, c.level);
        if (k === 'r') return 'crim2';
        if (k === 'w') return 'white';
        return lv(ZIG[0]!, c.level);
      }
      if (c.fx >= 69 && c.fz <= 91 && ex < EAGLE.w + 1 && ey < EAGLE.h + 1)
        return lv(ZIG[0]!, c.level);
    }
    const tri = Math.abs(mod(c.fx, 10) - 5);
    const band = mod(Math.floor((c.fz + tri) / 4), 6);
    const ramp = ZIG[[0, 1, 0, 2, 1, 3][band]!]!;
    return lv(ramp, c.level);
  };
  s.gable(0.65, 6.0, 0.65, 3.25, 42, 104, 'u', tiles);
  s.hip(5.0, 7.0, 0.65, 3.25, 42, 98, [1.0, 1.3], tiles);
  // Tracery gables (Wimperge) along the south front.
  for (let u = 1.2; u < 6.0; u += 0.62) {
    if (u > 3.2 && u < 4.7) continue;
    s.gable(u - 0.24, u + 0.24, 3.15, 3.28, 38, 56, 'v', pinMat);
    needle(s, u + 0.27, 3.25, 0.05, 30, 48, 60);
  }
  // Heidentürme (west towers) and the unfinished north tower with its Renaissance cap.
  for (const tv of [0.95, 2.95]) {
    s.prismN(0.95, tv, 0.3, 0.3, 1, 92, 8, wall, { rot: Math.PI / 8 });
    s.prismN(0.95, tv, 0.31, 0.02, 92, 116, 8, plain(G), { rot: Math.PI / 8 });
  }
  s.box(3.6, 4.6, 0.25, 1.05, 1, 92, wall);
  s.ell(4.1, 0.65, 92, 0.5, 0.42, 7, plain(['green0', 'green0', 'green1', 'teal1', 'teal1']), {
    zMin: 92,
  });
  s.cyl(4.1, 0.65, 0.1, 98, 104, plain(GREY_LIT));
  s.ell(4.1, 0.65, 104, 0.14, 0.14, 4, plain(COPPER), { zMin: 104 });
  // The south tower ("Steffl"): square shaft, octagonal belfry with gables, the great spire.
  const TU = 3.95;
  const TV = 3.45;
  const steffl: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(G, c.level);
    const local = mod(c.fx, 6);
    const lan = local > 1 && local < 4 && mod(c.fz, 22) > 6 && mod(c.fz, 22) < 18;
    if (c.night) return lan && c.fz > 90 ? 'ochre1' : null;
    if (c.edge) return G[0];
    if (lan) return lv(R.dark, c.level);
    if (mod(c.fz, 22) === 0) return lv(GREY_LIT, c.level);
    return lv(G, c.level - (local === 0 ? 1 : 0));
  };
  s.box(TU - 0.55, TU + 0.55, TV - 0.5, TV + 0.5, 1, 74, steffl);
  for (const [du, dv] of [
    [-0.55, 0.5],
    [0.55, 0.5],
    [0.55, -0.5],
  ] as const)
    needle(s, TU + du, TV + dv, 0.07, 60, 78, 92);
  s.prismN(TU, TV, 0.5, 0.42, 74, 128, 8, steffl, { rot: Math.PI / 8 });
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4 + Math.PI / 8;
    const u = TU + Math.cos(th) * 0.44;
    const v = TV + Math.sin(th) * 0.44;
    s.prismN(u, v, 0.08, 0, 116, 136, 4, pinMat);
  }
  const spire: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return G[0];
    // Crockets on the arrises + tracery bands.
    const a = Math.atan2(c.v - TV, c.u - TU) / (Math.PI / 4) - 0.5;
    const arr = Math.abs(a - Math.round(a)) < 0.12;
    if (arr && mod(c.fz, 3) === 0) return lv(GREY_LIT, c.level + 1);
    if (mod(c.fz, 12) === 0) return lv(GREY_LIT, c.level);
    if (mod(c.fz, 12) > 4 && mod(c.fz, 12) < 9 && mod(c.fx, 3) === 1) return lv(R.dark, c.level);
    return lv(G, c.level + (c.rim ? 1 : 0));
  };
  s.prismN(TU, TV, 0.42, 0.03, 128, 206, 8, spire, { rot: Math.PI / 8 });
  s.line(
    [
      [TU, TV, 206],
      [TU, TV, 212],
    ],
    'ochre3',
  );
  s.line(
    [
      [TU - 0.05, TV + 0.05, 209],
      [TU + 0.05, TV - 0.05, 209],
    ],
    'ochre2',
  );
  // Giant's Door porch hint and a few cars' worth of Stephansplatz paving dressing.
  s.box(TU - 0.25, TU + 0.25, TV + 0.5, TV + 0.54, 1, 14, (c) =>
    c.night ? 'ochre1' : c.edge ? 'earth0' : mod(c.fx, 3) === 0 ? 'earth1' : 'earth2',
  );
  return { scene: s, overlays: [] };
}

export const LANDMARKS_VIENNA: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  rathaus: { top: 118, frames: 1, fps: 0, build: rathaus },
  hofburg: { top: 92, frames: 1, fps: 0, build: hofburg },
  stephansdom: { top: 156, frames: 1, fps: 0, build: stephansdom },
};
