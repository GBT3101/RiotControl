/**
 * Secondary landmarks of Budapest — St Stephen's Basilica, Buda Castle (Royal Palace on its
 * hill wall), Fisherman's Bastion and the Kossuth memorial. Contract footprints: LANDMARKS in
 * src/maps/contract.ts. All face +v (the lit SW side).
 */
import { Scene, type Material } from '../engine/scene';
import { R, hash, lv, mod, plain, type Ramp5 } from '../engine/materials';
import { balustradeCut, column, roofMat, stairs, stepMat } from '../engine/kit';
import { grid } from '../../lib/grid';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { figure } from '../props';
import { classicalWall, gravel, paving, plate, type SecondaryArt } from '../shared';
import { KOSSUTH, KOSSUTH_AIDE, TURUL } from './sprites.grid';

/** Basilica sandstone (warm grey-beige). */
const SAND: Ramp5 = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'];
/** Dark weathered copper of the Basilica's dome and roofs. */
const COPPER_DARK: Ramp5 = ['ink', 'green0', 'green1', 'green2', 'teal1'];
/** Buda Castle's bright verdigris dome. */
const COPPER: Ramp5 = ['green0', 'green1', 'teal1', 'teal2', 'teal2'];

function copperMat(r: Ramp5, ribs = 8, cu = 0, cv = 0): Material {
  return (c) => {
    if (c.night) return null;
    if (c.edge) return r[0];
    const a = Math.atan2(c.v - cv, c.u - cu);
    const k = mod((a * ribs) / (2 * Math.PI) + 0.5, 1);
    if (Math.abs(k - 0.5) < 0.08) return lv(r, c.level + 1);
    return lv(r, c.level + (c.rim ? 1 : 0));
  };
}

// ---------------------------------------------------------------------------------------------
// St Stephen's Basilica (5 × 7): Greek cross, great dome, twin bell towers on the +v front
// ---------------------------------------------------------------------------------------------

function stStephens(): Build {
  const s = new Scene();
  plate(s, 5, 7, paving);
  const S = SAND;
  const wall = classicalWall({ ramp: S, pitch: 12, off: 4, rows: [40, 22], top: 50, base: 12 });
  // Nave (along v) and transept arms.
  s.box(1.0, 4.0, 0.6, 5.6, 1, 50, wall);
  s.box(0.35, 4.65, 2.4, 4.2, 1, 50, wall);
  const roof = roofMat(COPPER_DARK, undefined, 3);
  s.gable(1.05, 3.95, 0.6, 5.6, 50, 64, 'v', roof);
  s.gable(0.35, 4.65, 2.45, 4.15, 50, 64, 'u', roof);
  // Pediments on the transept ends (+v face of the transept arms is hidden; +u end visible).
  const ped: Material = (c) =>
    c.side === 'right' || c.side === 'left'
      ? c.night
        ? null
        : c.edge
          ? S[0]
          : lv(S, c.level - (c.rim ? 0 : 1))
      : roof(c);
  s.gable(4.55, 4.72, 2.4, 4.2, 50, 62, 'u', ped);
  // Drum with paired pilasters and round-headed windows.
  const CU = 2.5;
  const CV = 3.3;
  const drum: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(S, c.level);
    const a = Math.atan2(c.v - CV, c.u - CU);
    const k = mod((a * 16) / (2 * Math.PI), 1);
    const win = k > 0.3 && k < 0.7 && c.fz > 62 && c.fz < 78 - (Math.abs(k - 0.5) > 0.12 ? 1 : 0);
    if (c.night) return win ? 'ochre2' : null;
    if (c.edge) return S[0];
    if (win) return lv(R.dark, c.level);
    if (c.fz >= 84) return lv(S, c.level + 1);
    if (c.fz === 83 || c.fz === 58) return lv(S, c.level - 1);
    if (k < 0.12 || k > 0.88) return c.lambert > 0.45 && !c.shadow ? S[4] : lv(S, c.level);
    return lv(S, c.level - 1);
  };
  s.cyl(CU, CV, 1.25, 50, 86, drum);
  s.cyl(CU, CV, 1.18, 86, 90, plain(S, { rim: true }));
  // The dome: dark copper with ribs and a ring of lucarnes.
  const dome: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return COPPER_DARK[0];
    const a = Math.atan2(c.v - CV, c.u - CU);
    const k = mod((a * 16) / (2 * Math.PI) + 0.5, 1);
    if (Math.abs(k - 0.5) < 0.09) return lv(COPPER_DARK, c.level + 1);
    if (c.fz > 96 && c.fz < 101 && Math.abs(k - 0.5) > 0.3) return lv(S, c.level);
    return lv(COPPER_DARK, c.level + (c.rim ? 1 : 0));
  };
  s.ell(CU, CV, 90, 1.18, 1.18, 34, dome, { zMin: 90 });
  // Lantern: little columned drum, cupola, ball and cross.
  const lantern: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(S, c.level);
    const op = mod(c.fx, 4) === 1 && c.fz > 121 && c.fz < 130;
    if (c.night) return op ? 'ochre3' : null;
    if (c.edge) return S[0];
    return op ? lv(R.dark, c.level) : lv(S, c.level + (c.rim ? 1 : 0));
  };
  s.cyl(CU, CV, 0.32, 118, 132, lantern);
  s.ell(CU, CV, 132, 0.32, 0.32, 8, copperMat(COPPER_DARK, 8, CU, CV), { zMin: 132 });
  s.cyl(CU, CV, 0.05, 139, 142, plain(R.gold));
  s.line(
    [
      [CU, CV, 142],
      [CU, CV, 150],
    ],
    'ochre3',
  );
  s.line(
    [
      [CU - 0.06, CV + 0.06, 147],
      [CU + 0.06, CV - 0.06, 147],
    ],
    'ochre3',
  );
  // Twin bell towers flanking the front.
  const tower: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(S, c.level);
    const local = mod(c.fx, 14);
    const clock = c.fz > 62 && c.fz < 72 && Math.hypot(local - 7, c.fz - 67) < 4.2;
    const win =
      !clock && local > 4 && local < 10 && ((c.fz > 26 && c.fz < 38) || (c.fz > 44 && c.fz < 54));
    if (c.night) return clock ? 'ochre3' : win ? 'ochre2' : null;
    if (c.edge) return S[0];
    if (clock) {
      const r = Math.hypot(local - 7, c.fz - 67);
      if (r > 3.3) return lv(R.gold, c.level);
      if (local === 7 && c.fz >= 67) return 'ink';
      if (c.fz === 67 && local >= 7 && local < 10) return 'ink';
      return c.level >= 3 ? 'white' : 'stone4';
    }
    if (win) return c.fz === 37 || c.fz === 53 ? lv(S, c.level + 1) : lv(R.dark, c.level);
    if (local <= 1 || local >= 13) return lv(S, c.level + 1);
    if (c.fz === 58 || c.fz === 20 || c.fz === 76) return lv(S, c.level - 1);
    if (c.fz < 14 && mod(c.fz, 3) === 0) return lv(S, c.level - 1);
    return lv(S, c.level);
  };
  const belfry: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(S, c.level);
    const a = Math.atan2(c.v - c.prim.aabb[2] - 0.45, c.u - c.prim.aabb[0] - 0.45);
    const k = mod((a * 8) / (2 * Math.PI), 1);
    const op = k > 0.25 && k < 0.75 && c.fz > 82 && c.fz < 92;
    if (c.night) return op ? 'ochre1' : null;
    if (c.edge) return S[0];
    if (op) return lv(R.dark, c.level - 1);
    if (c.fz >= 93) return lv(S, c.level + 1);
    return lv(S, c.level);
  };
  for (const u0 of [0.55, 3.55]) {
    const v0 = 5.4;
    s.box(u0, u0 + 0.9, v0, v0 + 0.9, 1, 78, tower);
    s.box(u0 - 0.04, u0 + 0.94, v0 - 0.04, v0 + 0.94, 76, 80, plain(S, { rim: true }));
    const tu = u0 + 0.45;
    const tv = v0 + 0.45;
    s.cyl(tu, tv, 0.36, 80, 95, belfry);
    s.ell(tu, tv, 95, 0.38, 0.38, 12, copperMat(COPPER_DARK, 8, tu, tv), { zMin: 95 });
    s.cyl(tu, tv, 0.1, 106, 112, plain(S, { rim: true }));
    s.ell(tu, tv, 112, 0.12, 0.12, 5, plain(COPPER_DARK), { zMin: 112 });
    s.line(
      [
        [tu, tv, 117],
        [tu, tv, 122],
      ],
      'ochre3',
    );
    for (const [du, dv] of [
      [0, 0.9],
      [0.9, 0.9],
      [0.9, 0],
    ] as const) {
      s.prismN(u0 + du, v0 + dv, 0.06, 0.06, 80, 84, 4, plain(S));
      s.ell(u0 + du, v0 + dv, 85, 0.06, 0.06, 2, plain(R.gold), { zMin: 84 });
    }
  }
  // Portico: six Corinthian columns, pediment, stair to the square.
  s.box(1.45, 3.55, 5.6, 6.6, 1, 8, plain(S));
  stairs(s, 1.45, 3.55, 6.95, 6.6, 1, 8, 3, stepMat(R.granite));
  for (let k = 0; k < 6; k++) {
    column(s, { u: 1.62 + k * 0.35, v: 6.4, z0: 8, z1: 40, r: 0.09, ramp: R.limePale });
  }
  const entab: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return S[0];
    if (c.fz >= 45) return lv(S, c.level + 1);
    if (c.fz === 43) return lv(S, c.level - 1);
    return lv(S, c.level);
  };
  s.box(1.45, 3.55, 5.6, 6.55, 40, 47, entab);
  s.gable(1.45, 3.55, 5.6, 6.55, 47, 58, 'v', (c) => {
    if (c.side !== 'left') return roof(c);
    if (c.night) return null;
    if (c.edge) return S[0];
    const apex = 58 - (Math.abs(c.u - 2.5) / 1.05) * 11;
    if (apex - c.z < 2) return lv(S, c.level + 1);
    // Relief group in the tympanum.
    if (c.fz > 48 && c.fz < apex - 2 && mod(c.fx + (c.fz >> 1), 3) === 0) return lv(S, c.level);
    return lv(S, c.level - 2);
  });
  // Portal doors behind the columns.
  s.box(2.2, 2.8, 5.58, 5.62, 8, 26, (c) =>
    c.night ? 'ochre1' : c.edge ? 'earth0' : mod(c.fx, 3) === 0 ? 'earth1' : 'earth2',
  );
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Buda Castle (12 × 5): the long Royal Palace on the castle-hill wall, green dome in the middle
// ---------------------------------------------------------------------------------------------

function budaCastle(): Build {
  const s = new Scene();
  plate(s, 12, 5, gravel);
  // Castle hill: rusticated retaining wall with buttresses, a gate and the terrace on top.
  const HILL: Ramp5 = ['stone0', 'stone1', 'gray4', 'stone2', 'stone3'];
  const hill: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'top') {
      const ju = mod(c.u * 3, 1) < 0.06;
      return lv(R.paving, c.level - (ju ? 1 : 0));
    }
    if (c.edge) return HILL[0];
    // Gate (Habsburg steps' archway) in the front wall.
    if (c.side === 'left') {
      const dx = Math.abs(c.fx + 0.5 - 4.0 * 16);
      if (dx < 4 && c.z < 10 + Math.sqrt(Math.max(0, 16 - dx * dx)) * 0.9) return 'ink';
      if (dx < 6 && c.z < 16) return lv(HILL, c.level + 1);
    }
    const row = Math.floor(c.fz / 4);
    if (mod(c.fz, 4) === 0) return lv(HILL, c.level - 1);
    if (mod(c.fx + row * 5, 10) === 0) return lv(HILL, c.level - 1);
    if (c.fz >= 22) return lv(HILL, c.level + 1);
    return lv(HILL, c.level - (hash(c.fx >> 1, row) < 0.12 ? 1 : 0));
  };
  s.box(0.1, 11.9, 0.1, 4.5, 1, 24, hill);
  // Buttresses.
  for (const u of [1.2, 2.8, 5.4, 6.6, 9.2, 10.8])
    s.box(u - 0.15, u + 0.15, 4.5, 4.75, 1, 22, hill);
  // Terrace balustrade.
  const C = R.creamWarm;
  const bal: Material = (c) => (c.night ? null : c.edge ? C[0] : lv(C, c.level));
  s.box(0.1, 11.9, 4.38, 4.5, 24, 28, bal, { cut: balustradeCut(24, 28) });
  s.box(11.78, 11.9, 0.1, 4.5, 24, 28, bal, { cut: balustradeCut(24, 28) });
  // The palace range.
  const wall = classicalWall({ ramp: C, pitch: 8, off: 3, rows: [56, 44, 34], top: 64, base: 30 });
  s.box(0.5, 11.5, 0.5, 3.4, 24, 64, wall);
  const roof = roofMat(R.slateLit, undefined, 3);
  s.hip(0.6, 11.4, 0.6, 3.3, 64, 74, 0.9, roof);
  // End and central pavilions.
  for (const [u0, u1] of [
    [0.4, 1.8],
    [10.2, 11.6],
  ] as const) {
    s.box(u0, u1, 0.4, 3.65, 24, 68, wall);
    s.hip(u0 + 0.05, u1 - 0.05, 0.45, 3.6, 68, 80, 0.6, roof);
  }
  // Central risalit with a columned portico facing the river.
  s.box(5.0, 7.0, 3.4, 3.8, 24, 66, wall);
  for (let k = 0; k < 6; k++)
    column(s, { u: 5.15 + k * 0.34, v: 3.95, z0: 40, z1: 62, r: 0.07, ramp: R.limePale });
  s.box(4.95, 7.05, 3.4, 4.08, 24, 40, plain(C, { rim: true }));
  s.box(4.95, 7.05, 3.4, 4.08, 62, 67, plain(C, { rim: true }));
  s.gable(4.95, 7.05, 3.4, 4.08, 67, 75, 'v', (c) =>
    c.side === 'left' ? (c.night ? null : c.edge ? C[0] : lv(C, c.level - 1)) : roof(c),
  );
  // Drum + the green dome + lantern.
  const CU = 6.0;
  const CV = 1.95;
  const drum: Material = (c) => {
    const a = Math.atan2(c.v - CV, c.u - CU);
    const k = mod((a * 12) / (2 * Math.PI), 1);
    const col = k < 0.2 || k > 0.8;
    const win = !col && c.fz > 82 && c.fz < 94;
    if (c.night) return win ? 'ochre2' : null;
    if (c.side === 'top') return lv(C, c.level);
    if (c.edge) return C[0];
    if (win) return lv(R.dark, c.level);
    if (c.fz >= 96) return lv(C, c.level + 1);
    if (col && c.lambert > 0.45 && !c.shadow) return C[4];
    return lv(C, c.level - (col ? 0 : 1));
  };
  s.cyl(CU, CV, 1.2, 64, 98, drum);
  s.cyl(CU, CV, 1.12, 98, 101, plain(C, { rim: true }));
  s.ell(CU, CV, 101, 1.1, 1.1, 26, copperMat(COPPER, 12, CU, CV), { zMin: 101 });
  s.cyl(CU, CV, 0.24, 124, 134, (c) =>
    c.night
      ? null
      : c.edge
        ? COPPER[0]
        : mod(c.fx, 3) === 0
          ? lv(COPPER, c.level - 1)
          : lv(COPPER, c.level),
  );
  s.ell(CU, CV, 134, 0.26, 0.26, 6, plain(COPPER, { rim: true }), { zMin: 134 });
  s.line(
    [
      [CU, CV, 139],
      [CU, CV, 146],
    ],
    'ochre3',
  );
  // The Turul on its pillar at the palace gate.
  s.box(1.0, 1.3, 3.75, 4.05, 24, 40, plain(HILL, { rim: true }));
  s.sprite(figure(TURUL, 'bronze', 'turul'), 6, 9, 1.15, 3.9, 40);
  // A few trees on the slope at the ends.
  const tree: Material = (c) =>
    c.night
      ? null
      : c.edge
        ? 'green0'
        : lv(R.grass, c.level - (hash(c.px, c.py) < 0.25 ? 1 : 0) - 1);
  for (const [u, v] of [
    [0.6, 4.75],
    [11.4, 4.75],
    [3.0, 4.8],
  ] as const) {
    s.ell(u, v, 10, 0.3, 0.2, 9, tree);
  }
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Fisherman's Bastion (8 × 3): white arcaded terrace, seven conical-roofed turrets
// ---------------------------------------------------------------------------------------------

function fishermansBastion(): Build {
  const s = new Scene();
  plate(s, 8, 3, paving);
  const Wt: Ramp5 = ['stone1', 'stone2', 'stone4', 'stone5', 'white'];
  const arcade: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(R.paving, c.level);
    if (c.side === 'back') return c.night ? null : 'gray2';
    if (c.night) return null;
    if (c.edge) return Wt[0];
    // Round arches with twin colonnettes.
    const p = 12;
    const rel = mod(c.fx, p) - 6;
    const lower =
      c.fz < 26 - Math.sqrt(Math.max(0, 16 - rel * rel)) && Math.abs(rel) < 4 && c.fz > 3;
    if (lower) return lv(R.dark, Math.min(c.level, 2));
    if (c.fz >= 29) return mod(c.fx, 3) === 0 ? lv(Wt, c.level - 1) : lv(Wt, c.level + 1);
    if (c.fz === 28) return lv(Wt, c.level - 1);
    if (c.fz <= 2) return lv(Wt, c.level - 1);
    return lv(Wt, c.level);
  };
  s.box(0.3, 7.7, 0.4, 1.9, 1, 32, arcade, {
    cut: (u, v, z, f) => {
      if (f !== 3 && f !== 1) return false;
      const fx = f === 3 ? u * 16 : v * 16;
      const rel = mod(fx, 12) - 6;
      return Math.abs(rel) < 3.6 && z > 4 && z < 25 - Math.sqrt(Math.max(0, 13 - rel * rel));
    },
  });
  // Lower terrace + stair down to the front.
  const terrace: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'top') return lv(R.paving, c.level - (mod(c.u * 4, 1) < 0.07 ? 1 : 0));
    if (c.edge) return Wt[0];
    if (c.fz >= 9) return lv(Wt, c.level + 1);
    return lv(Wt, c.level - (mod(c.fz, 3) === 0 ? 1 : 0));
  };
  s.box(0.3, 7.7, 1.9, 2.5, 1, 10, terrace);
  stairs(s, 3.4, 4.6, 3.0, 2.5, 1, 10, 4, stepMat(Wt));
  // Turrets with conical stone roofs.
  const turretWall =
    (tu: number): Material =>
    (c) => {
      if (c.side === 'top') return c.night ? null : lv(Wt, c.level);
      const a = Math.atan2(c.v - 1.15, c.u - tu);
      const k = mod((a * 6) / (2 * Math.PI), 1);
      const z0 = c.prim.aabb[5] - 12;
      const op =
        k > 0.25 && k < 0.75 && c.fz > z0 && c.fz < z0 + 8 - (Math.abs(k - 0.5) > 0.15 ? 1 : 0);
      if (c.night) return op ? 'ochre1' : null;
      if (c.edge) return Wt[0];
      if (op) return lv(R.dark, c.level - 1);
      if (c.fz >= z0 + 9) return lv(Wt, c.level + 1);
      if (c.fz === z0 - 1) return lv(Wt, c.level - 1);
      return lv(Wt, c.level);
    };
  const cone: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'gray3';
    const scale = mod(c.fz + (mod(c.sx, 4) < 2 ? 1 : 0), 3) === 0;
    return lv(['gray3', 'gray4', 'gray6', 'stone4', 'stone5'], c.level - (scale ? 1 : 0));
  };
  const towers: Array<[number, number, number]> = [
    [0.7, 0.32, 46],
    [1.75, 0.3, 42],
    [2.85, 0.32, 46],
    [4.0, 0.46, 60],
    [5.15, 0.32, 46],
    [6.25, 0.3, 42],
    [7.3, 0.32, 46],
  ];
  for (const [tu, r, h] of towers) {
    s.cyl(tu, 1.15, r, 1, h, turretWall(tu));
    s.cyl(tu, 1.15, r + 0.05, h, h + 2, plain(Wt, { rim: true }));
    s.cone(tu, 1.15, r + 0.06, 0, h + 2, h + 2 + r * 60, cone);
    s.line(
      [
        [tu, 1.15, h + 2 + r * 60],
        [tu, 1.15, h + 6 + r * 60],
      ],
      'ochre2',
    );
  }
  // Main turret's loggia ring of small cones.
  for (let k = 0; k < 4; k++) {
    const th = (k * Math.PI) / 2 + Math.PI / 4;
    const u = 4.0 + Math.cos(th) * 0.48;
    const v = 1.15 + Math.sin(th) * 0.48;
    s.cone(u, v, 0.08, 0, 60, 68, cone);
  }
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Kossuth memorial (2 × 2): Kossuth on a tall plinth, his ministers grouped below
// ---------------------------------------------------------------------------------------------

function kossuth(): Build {
  const s = new Scene();
  plate(s, 2, 2, paving);
  const g = R.granite;
  s.box(0.1, 1.9, 0.1, 1.9, 1, 4, plain(g, { rim: true }));
  s.box(0.3, 1.7, 0.3, 1.7, 4, 8, plain(g, { rim: true }));
  s.box(0.6, 1.4, 0.6, 1.4, 8, 28, (c) => {
    if (c.night) return null;
    if (c.edge) return g[0];
    if (c.side !== 'top' && c.fz > 14 && c.fz < 22 && mod(c.fx, 13) > 3 && mod(c.fx, 13) < 10)
      return mod(c.fx + c.fz, 3) === 0 ? lv(R.bronze, c.level + 1) : lv(R.bronze, c.level);
    return lv(R.marble, c.level);
  });
  s.box(0.55, 1.45, 0.55, 1.45, 28, 31, plain(R.marble, { rim: true }));
  s.sprite(figure(KOSSUTH, 'bronze', 'kossuth'), 6, 20, 1.0, 1.0, 31);
  const aide = grid(
    KOSSUTH_AIDE,
    { o: 'ink', d: 'earth0', m: 'earth1', l: 'earth2', h: 'earth3' },
    {},
    'kossuthAide',
  );
  for (const [u, v] of [
    [0.45, 1.6],
    [1.0, 1.65],
    [1.6, 1.6],
    [1.65, 1.0],
  ] as const) {
    s.sprite(aide, 2, 10, u, v, 8);
  }
  return { scene: s, overlays: [] };
}

export const LANDMARKS_BUDAPEST: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  stStephens: { top: 108, frames: 1, fps: 0, build: stStephens },
  budaCastle: { top: 92, frames: 1, fps: 0, build: budaCastle },
  fishermansBastion: { top: 60, frames: 1, fps: 0, build: fishermansBastion },
  kossuth: { top: 44, frames: 1, fps: 0, build: kossuth },
};
