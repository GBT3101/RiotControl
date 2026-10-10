/**
 * Secondary landmarks of Milan — the Duomo, the Galleria Vittorio Emanuele II, the Teatro alla
 * Scala and the Castello Sforzesco (edge). Contract footprints: LANDMARKS in
 * src/maps/contract.ts. Orientation (for blueprints): the Duomo's west front is its +u (SE)
 * face, the flank with the forest of spires faces +v; the Galleria's triumphal arch is on +u
 * (toward the Duomo), its cross arm opens on +v; La Scala and the Castello face +v.
 */
import { Scene, type Material, type PrimOpts } from '../engine/scene';
import {
  R,
  hash,
  lv,
  mod,
  moduleColour,
  plain,
  sampleModule,
  type Ramp5,
} from '../engine/materials';
import { balustradeCut, column, gothicWall, stairs, stepMat } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { figure, lamp } from '../props';
import { plate, type SecondaryArt } from '../shared';
import { S, coppi, ellCyl, slabs, winArch, winPediment, winSquare } from '../rome/common';
import { MADONNINA } from './figures.grid';

const M = S.candoglia;
const pave = slabs(R.paving, 3);

/** Barrel vault along v (half cylinder above zc) — the Galleria's cross arm. */
function vaultV(
  s: Scene,
  v0: number,
  v1: number,
  uc: number,
  ru: number,
  zc: number,
  rz: number,
  mat: Material,
  o: PrimOpts = {},
): void {
  s.add(
    [
      { nu: 0, nv: -1, nz: 0, c: -v0 },
      { nu: 0, nv: 1, nz: 0, c: v1 },
      { nu: 0, nv: 0, nz: -1, c: -zc },
    ],
    [uc - ru, uc + ru, v0, v1, zc, zc + rz],
    mat,
    o,
    { kind: 'hcylV', uc, zc, ru, rz },
  );
}

/** A marble pinnacle (guglia): square shaft, crocketed spire, a statue dot on top. */
function guglia(s: Scene, u: number, v: number, z0: number, h: number, r = 0.07): void {
  const shaft: Material = (c) =>
    c.night ? null : c.edge ? M[0] : lv(M, c.level + (c.rim ? 1 : 0));
  const spire: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return M[0];
    return lv(M, c.level + (mod(c.fz, 3) === 0 ? -1 : 0) + (c.rim ? 1 : 0));
  };
  s.prismN(u, v, r, r, z0, z0 + h * 0.45, 4, shaft);
  s.prismN(u, v, r, 0.0, z0 + h * 0.45, z0 + h, 4, spire);
  s.line(
    [
      [u, v, z0 + h],
      [u, v, z0 + h + 2],
    ],
    'white',
  );
}

// ---------------------------------------------------------------------------------------------
// Duomo (10 × 6): five-aisled Gothic cathedral in Candoglia marble, a forest of guglie, the
// tiburio and main spire with the gilded Madonnina, the stepped west front on +u.
// ---------------------------------------------------------------------------------------------

function duomo(): Build {
  const s = new Scene();
  plate(s, 10, 6, pave);
  const wall = (
    rows: Array<{ zTop: number; h: number; w?: number }>,
    top: number,
    seed: number,
  ): Material => gothicWall({ ramp: M, pitch: 10, off: 4, rows, top, state: 0, seed, decals: [] });
  // Outer aisles, inner aisles, nave (stepped section), low marble roofs.
  s.box(1.3, 9.6, 0.6, 5.4, 1, 34, wall([{ zTop: 28, h: 18, w: 5 }], 34, 1), { tag: 'aisle' });
  s.box(1.3, 9.6, 1.4, 4.6, 34, 46, wall([{ zTop: 44, h: 7 }], 46, 2));
  s.box(1.3, 9.6, 2.2, 3.8, 46, 60, wall([{ zTop: 57, h: 9, w: 5 }], 60, 3));
  const roof: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return M[0];
    return lv(M, c.level - (mod(c.fz, 2) === 0 ? 1 : 0));
  };
  s.gable(1.3, 9.6, 2.2, 3.8, 60, 66, 'u', roof);
  // Transept arms.
  s.box(3.4, 4.6, 0.3, 5.7, 1, 46, wall([{ zTop: 40, h: 26, w: 5 }], 46, 4));
  s.gable(3.4, 4.6, 0.3, 5.7, 46, 54, 'v', roof);
  // Polygonal apse (−u end) with its three great windows.
  s.prismN(1.5, 3.0, 1.15, 1.15, 1, 46, 8, wall([{ zTop: 40, h: 30, w: 5 }], 46, 5), {
    rot: Math.PI / 8,
  });
  s.prismN(1.5, 3.0, 1.15, 0.6, 46, 54, 8, roof, { rot: Math.PI / 8 });

  // West front (+u): stepped "hut" profile, buttress piers, five portals, pointed windows.
  const front: Material = (c) => {
    if (c.side !== 'right') return c.night ? null : c.edge ? M[0] : lv(M, c.level);
    const fx = c.fx; // along v, 9.6..96 px
    const z = c.fz;
    const pier = [10, 22, 38, 58, 74, 86].some((p) => Math.abs(fx - p) <= 1);
    // Portals (baroque frames, bronze doors).
    for (const p of [16, 30, 48, 66, 80]) {
      const dx = fx + 0.5 - p;
      const big = p === 48;
      const hw = big ? 4.5 : 3;
      const ht = big ? 22 : 16;
      if (Math.abs(dx) < hw && z > 1 && z < ht)
        return c.night ? 'ochre1' : z > ht - 4 ? lv(M, c.level + 1) : lv(R.bronze, 2);
      if (Math.abs(dx) < hw + 1.5 && z > 1 && z < ht + 3)
        return c.night ? null : lv(M, c.level + 1);
    }
    // Windows: baroque rectangles low, Gothic lancets high, the great central window.
    for (const p of [16, 30, 66, 80]) {
      const dx = Math.abs(fx + 0.5 - p);
      if (dx < 2 && z > 22 && z < 30) return c.night ? 'ochre2' : lv(R.dark, c.level);
    }
    {
      const dx = fx + 0.5 - 48;
      if (Math.abs(dx) < 4 && z > 30 && z < 50 - (dx * dx) / 4) {
        const mull = mod(Math.round(dx), 2) === 0 || mod(z, 6) === 0;
        if (c.night) return mull ? null : 'ochre2';
        return mull ? lv(M, c.level) : lv(R.dark, c.level);
      }
    }
    if (c.night) return null;
    if (c.edge) return M[0];
    if (pier) return lv(M, c.level + 1);
    if (z % 12 === 0) return lv(M, c.level - 1);
    return lv(M, c.level);
  };
  s.box(9.6, 9.9, 0.6, 5.4, 1, 34, front);
  s.box(9.6, 9.9, 1.4, 4.6, 34, 48, front);
  s.box(9.6, 9.9, 2.2, 3.8, 48, 60, front);
  s.gable(9.6, 9.9, 2.2, 3.8, 60, 72, 'u', front);
  // Façade pier spires.
  for (const fx of [10, 22, 38, 58, 74, 86]) {
    const v = fx / 16;
    const zb = v < 1.4 || v > 4.6 ? 34 : v < 2.2 || v > 3.8 ? 48 : 60;
    guglia(s, 9.85, v, zb, 26, 0.09);
  }

  // The forest of guglie: outer aisle buttresses, inner aisle, nave — both flanks.
  for (let u = 1.6; u < 9.5; u += 0.62) {
    if (u > 3.3 && u < 4.7) continue;
    for (const [v, z0, h] of [
      [5.45, 34, 20],
      [4.6, 46, 20],
      [3.8, 60, 18],
      [2.2, 60, 18],
      [1.4, 46, 20],
      [0.55, 34, 20],
    ] as const) {
      guglia(s, u, v, z0, h);
    }
    // Flying buttress ribs (+v side) from the outer to the inner spires.
    s.line(
      [
        [u, 5.4, 40],
        [u, 4.9, 47],
        [u, 4.6, 50],
      ],
      'gray6',
    );
  }
  for (const [u, v] of [
    [3.4, 5.7],
    [4.6, 5.7],
    [3.4, 0.3],
    [4.6, 0.3],
  ] as const) {
    guglia(s, u, v, 46, 22, 0.09);
  }

  // Tiburio (octagonal lantern over the crossing) and the main spire.
  const tib: Material = (c) => {
    if (c.night) return mod(c.fx, 5) === 2 && c.fz > 70 && c.fz < 84 ? 'ochre2' : null;
    if (c.edge) return M[0];
    if (mod(c.fx, 5) === 2 && c.fz > 70 && c.fz < 84) return lv(R.dark, c.level);
    if (c.fz >= 90) return lv(M, c.level + 1);
    return lv(M, c.level);
  };
  s.prismN(4.0, 3.0, 0.8, 0.8, 60, 92, 8, tib, { rot: Math.PI / 8 });
  s.prismN(4.0, 3.0, 0.8, 0.45, 92, 102, 8, roof, { rot: Math.PI / 8 });
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4 + Math.PI / 8;
    const u = 4.0 + Math.cos(th) * 0.86;
    const v = 3.0 + Math.sin(th) * 0.86;
    guglia(s, u, v, 86, 24, 0.07);
  }
  const lacy: Material = (c) => {
    if (c.night) return c.fz > 140 ? 'ochre2' : null;
    if (c.edge) return M[0];
    if (mod(c.fz, 6) < 2 && mod(c.fx, 3) === 1) return lv(M, c.level - 2);
    return lv(M, c.level + (c.rim ? 1 : 0));
  };
  s.prismN(4.0, 3.0, 0.3, 0.2, 102, 128, 8, lacy, { rot: Math.PI / 8 });
  s.prismN(4.0, 3.0, 0.2, 0.0, 128, 152, 8, lacy, { rot: Math.PI / 8 });
  const mad = figure(MADONNINA, 'gold', 'madonnina');
  const madNight = figure(MADONNINA, 'gold', 'madonnina.night');
  s.sprite(mad, 3, 10, 4.0, 3.0, 152, { emit: madNight, bias: 0.4 });
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Galleria Vittorio Emanuele II (8 × 5): four palace blocks, the glass-and-iron barrel vaults
// of the two arms, the octagon dome, the triumphal-arch entrance on +u.
// ---------------------------------------------------------------------------------------------

const GAL: Ramp5 = ['earth2', 'earth3', 'stone2', 'stone3', 'stone4'];

function galleria(): Build {
  const s = new Scene();
  plate(s, 8, 5, pave);
  const winP = winPediment('tri', GAL, 8);
  const winS = winSquare(GAL, 5, 4);
  const winA = winArch(GAL, 5);
  const block: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(GAL, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const fx = c.fx;
    const z = c.fz;
    const bay = mod(fx - 3, 10);
    const c0 = fx - bay + 1;
    // Shop arcade at street level, three storeys of windows, cornice.
    if (z < 14) {
      const dx = bay - 4.5;
      if (Math.abs(dx) < 3.5 && z > 1 && (z < 9 || Math.hypot(dx, z - 9) < 3.5)) {
        if (c.night) return 'ochre2';
        return z < 6 ? lv(R.glass, c.level - 1) : lv(R.dark, c.level);
      }
    }
    for (const [m, zTop, x0] of [
      [winA, 27, c0 + 1],
      [winP, 42, c0],
      [winS, 50, c0 + 2],
    ] as const) {
      const k = sampleModule(m, c, x0, zTop);
      if (k !== null) return moduleColour(m, k, c);
    }
    if (c.night) return null;
    if (c.edge) return GAL[0];
    if (z >= 54) return lv(GAL, c.level + 1);
    if (z === 53) return lv(GAL, c.level - 2);
    if (z === 14 || z === 15) return lv(GAL, c.level + (z === 15 ? 1 : -1));
    if (bay === 0) return lv(GAL, c.level + 1);
    return lv(GAL, c.level);
  };
  const roofs = coppi(S.tileOld);
  for (const [u0, u1, v0, v1] of [
    [0.2, 3.55, 0.2, 2.05],
    [4.45, 7.6, 0.2, 2.05],
    [0.2, 3.55, 2.95, 4.8],
    [4.45, 7.6, 2.95, 4.8],
  ] as const) {
    s.box(u0, u1, v0, v1, 1, 56, block);
    s.hip(u0 + 0.05, u1 - 0.05, v0 + 0.05, v1 - 0.05, 56, 62, 0.5, roofs);
  }
  // Glass vaults with iron ribs; dark passages below the vault ends.
  const vault: Material = (c) => {
    const rib = mod(Math.floor((c.side === 'curve' ? c.u + c.v : c.u) * 16), 5) === 0;
    if (c.night) return rib ? null : 'ochre3';
    if (c.edge) return 'zinc0';
    if (rib || mod(c.fz, 5) === 0) return lv(R.metal, c.level);
    return lv(R.glassSky, c.level);
  };
  s.box(0.2, 7.6, 2.05, 2.95, 1, 56, (c) =>
    c.night ? (c.z < 30 ? 'ochre2' : null) : c.z < 6 ? lv(R.paving, 1) : 'ink',
  );
  s.box(3.55, 4.45, 0.2, 4.8, 1, 56, (c) =>
    c.night ? (c.z < 30 ? 'ochre2' : null) : c.z < 6 ? lv(R.paving, 1) : 'ink',
  );
  s.vaultU(0.2, 7.6, 2.5, 0.45, 56, 13, vault);
  vaultV(s, 0.2, 4.8, 4.0, 0.45, 56, 13, vault);
  // The octagon: drum and glass dome with the iron crown.
  s.prismN(
    4.0,
    2.5,
    0.75,
    0.75,
    56,
    66,
    8,
    (c) => {
      if (c.night) return mod(c.fx, 4) === 0 ? null : 'ochre2';
      if (c.edge) return GAL[0];
      if (c.fz >= 64) return lv(GAL, c.level + 1);
      return mod(c.fx, 4) === 0 ? lv(GAL, c.level) : lv(R.glassSky, c.level - 1);
    },
    { rot: Math.PI / 8 },
  );
  const dome: Material = (c) => {
    const a = Math.atan2(c.v - 2.5, c.u - 4.0);
    const rib = Math.abs(mod((a * 8) / Math.PI + 0.5, 1) - 0.5) < 0.12;
    if (c.night) return rib ? null : 'ochre3';
    if (c.edge) return 'zinc0';
    if (rib || mod(c.fz, 5) === 0) return lv(R.metal, c.level);
    return lv(R.glassSky, c.level + (c.rim ? 1 : 0));
  };
  s.ell(4.0, 2.5, 66, 0.72, 0.72, 22, dome, { zMin: 66 });
  s.cyl(4.0, 2.5, 0.08, 87, 92, plain(R.metal));
  // Triumphal arch on +u (toward Piazza del Duomo).
  const arch: Material = (c) => {
    if (c.side !== 'right') return c.night ? null : c.edge ? GAL[0] : lv(GAL, c.level);
    const dx = c.fx + 0.5 - 40;
    const z = c.fz;
    if (Math.abs(dx) < 7 && z > 1 && (z < 40 || Math.hypot(dx, z - 40) < 7)) {
      if (z > 40 || z > 32) {
        // Glazed lunette.
        const spoke =
          mod(Math.round(Math.atan2(z - 40, dx) * 4), 2) === 0 ||
          mod(Math.round(Math.hypot(dx, z - 40)), 3) === 0;
        if (c.night) return spoke ? null : 'ochre3';
        return spoke ? lv(R.metal, c.level + 1) : lv(R.glassSky, c.level);
      }
      return c.night ? 'ochre2' : z < 6 ? lv(R.paving, 1) : lv(R.dark, c.level + 1);
    }
    if (c.night) return null;
    if (c.edge) return GAL[0];
    if (Math.abs(dx) < 8.5 && z > 1 && (z < 40 || Math.hypot(dx, z - 40) < 8.5))
      return lv(GAL, c.level + 1);
    if (z >= 70) return lv(GAL, c.level + 1);
    if (z >= 58 && z <= 66) return mod(c.fx, 2) ? lv(GAL, c.level - 1) : lv(GAL, c.level);
    if (z === 57) return lv(GAL, c.level - 2);
    return lv(GAL, c.level);
  };
  s.box(7.6, 7.95, 1.25, 3.75, 1, 72, arch);
  for (const v of [1.55, 1.85, 3.15, 3.45])
    column(s, { u: 8.0, v, z0: 1, z1: 56, r: 0.08, ramp: GAL });
  // The cross-arm entrance on +v.
  s.box(3.45, 4.55, 4.8, 4.9, 1, 64, (c) => {
    if (c.side !== 'left') return c.night ? null : lv(GAL, c.level);
    const dx = c.fx + 0.5 - 64;
    if (Math.abs(dx) < 6 && c.fz > 1 && (c.fz < 36 || Math.hypot(dx, c.fz - 36) < 6))
      return c.night ? 'ochre2' : c.fz > 36 ? lv(R.glassSky, c.level) : lv(R.dark, c.level + 1);
    if (c.night) return null;
    if (c.fz >= 60) return lv(GAL, c.level + 1);
    return lv(GAL, c.level + (Math.abs(dx) < 7.5 ? 1 : 0));
  });
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Teatro alla Scala (6 × 5): Piermarini's neoclassical front with the carriage porch and
// pediment; Botta's fly tower and elliptical drum rising behind.
// ---------------------------------------------------------------------------------------------

function laScala(): Build {
  const s = new Scene();
  plate(s, 6, 5, pave);
  const SC: Ramp5 = ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'];
  const BODY: Ramp5 = ['earth2', 'stone2', 'stone3', 'stone4', 'stone5'];
  const wP = winPediment('seg', SC, 9);
  const wQ = winSquare(SC, 5, 4);
  const body: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(SC, c.level);
    const fx = c.fx;
    const z = c.fz;
    const bay = mod(fx - 2, 11);
    for (const [m, zTop, x0] of [
      [wP, 40, fx - bay + 1],
      [wQ, 48, fx - bay + 3],
    ] as const) {
      const k = sampleModule(m, c, x0, zTop);
      if (k !== null) return moduleColour(m, k, c);
    }
    if (z < 20 && z > 2) {
      const dx = bay - 5;
      if (Math.abs(dx) < 2.5 && (z < 13 || Math.hypot(dx, z - 13) < 2.5))
        return c.night ? 'ochre1' : lv(R.dark, c.level);
    }
    if (c.night) return null;
    if (c.edge) return SC[0];
    if (z >= 52) return lv(SC, c.level + 1);
    if (z === 51) return lv(SC, c.level - 1);
    if (z < 21) return mod(z, 4) === 0 ? lv(SC, c.level - 1) : lv(SC, c.level);
    if (z === 21) return lv(SC, c.level + 1);
    if (bay === 0 || bay === 10) return lv(SC, c.level + (bay === 0 ? 1 : 0));
    return lv(BODY, c.level);
  };
  s.box(0.3, 5.7, 0.4, 3.9, 1, 54, body);
  s.hip(0.4, 5.6, 0.5, 3.8, 54, 60, 0.8, coppi(S.tileOld));
  // Botta's fly tower and elliptical service drum.
  const botta: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'gray3';
    const BT: Ramp5 = ['gray2', 'gray4', 'gray5', 'gray6', 'gray7'];
    if (mod(c.fz, 6) === 0) return lv(BT, c.level - 1);
    return lv(BT, c.level);
  };
  s.box(1.4, 4.6, 0.6, 2.3, 54, 82, botta);
  ellCyl(s, 5.0, 1.0, 0.5, 0.36, 54, 76, botta);
  // Carriage porch: three arches, balcony terrace above with paired columns behind.
  const porch: Material = (c) => {
    if (c.side === 'left') {
      const dx = mod(c.fx - 30, 10) - 5;
      if (
        c.fx > 30 &&
        c.fx < 66 &&
        Math.abs(dx) < 3.2 &&
        c.fz > 1 &&
        (c.fz < 12 || Math.hypot(dx, c.fz - 12) < 3.2)
      )
        return c.night ? 'ochre2' : c.fz < 4 ? lv(R.paving, 1) : lv(R.dark, c.level + 1);
    }
    if (c.side === 'right') {
      const dx = c.fx + 0.5 - 68;
      if (Math.abs(dx) < 3 && c.fz > 1 && (c.fz < 12 || Math.hypot(dx, c.fz - 12) < 3))
        return c.night ? 'ochre2' : lv(R.dark, c.level);
    }
    if (c.night) return null;
    if (c.edge) return SC[0];
    if (c.side === 'top') return lv(SC, c.level);
    if (c.fz >= 18) return lv(SC, c.level + 1);
    return mod(c.fz, 4) === 0 ? lv(SC, c.level - 1) : lv(SC, c.level);
  };
  s.box(1.85, 4.15, 3.9, 4.6, 1, 20, porch);
  s.box(1.85, 4.15, 4.5, 4.6, 20, 24, plain(SC), { cut: balustradeCut(20, 24) });
  for (const u of [2.0, 2.25, 3.75, 4.0])
    column(s, { u, v: 4.0, z0: 21, z1: 44, r: 0.08, ramp: SC });
  s.box(1.85, 4.15, 3.75, 4.12, 44, 50, plain(SC, { rim: true }));
  s.gable(1.85, 4.15, 3.75, 4.12, 50, 58, 'v', (c) => {
    if (c.night) return null;
    if (c.side !== 'left') return lv(R.slateLit, c.level);
    if (c.edge) return SC[0];
    // Relief of Apollo's chariot.
    return lv(SC, c.level - 1 + (hash(c.fx >> 1, c.fz >> 1, 3) < 0.35 ? 1 : 0));
  });
  // Lamps on the piazza.
  const lp = lamp(false);
  s.sprite(lp.img, 2, 14, 1.4, 4.7, 1, { emit: lp.night });
  s.sprite(lp.img, 2, 14, 4.6, 4.7, 1, { emit: lp.night });
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Castello Sforzesco (10 × 8, edge): brick curtain walls with swallowtail merlons, the two
// round corner torrioni in diamond-point stone, the Filarete tower over the gate (+v), the
// Rocchetta and the Torre di Bona di Savoia inside.
// ---------------------------------------------------------------------------------------------

const BRK = S.redBrick;
const STONE: Ramp5 = ['stone0', 'gray4', 'stone2', 'stone3', 'stone4'];

/** Ghibelline swallowtail merlons on top of a wall ending at zTop (cut on the faces). */
function merlons(
  zTop: number,
  axis: 'u' | 'v',
): (u: number, v: number, z: number, f: number) => boolean {
  return (u, v, z, f) => {
    if (z <= zTop - 7 || f < 0 || f > 5 || f === 4) return false;
    const x = (f === 0 || f === 1 ? v : f === 5 ? (axis === 'u' ? u : v) : u) * 16;
    const loc = mod(x, 9);
    if (loc >= 6) return true; // gap between merlons
    if (z > zTop - 2.5 && Math.abs(loc - 3) < 1.1) return true; // the V notch
    return false;
  };
}

function brickMat(top: number, stoneBase = 0): Material {
  return (c) => {
    if (c.night) return null;
    if (c.side === 'back') return lv(BRK, 1);
    if (c.edge) return BRK[0];
    if (c.side === 'top') return lv(BRK, c.level - 1);
    const z = c.fz;
    if (z < stoneBase) return mod(z, 4) === 0 ? lv(STONE, c.level - 1) : lv(STONE, c.level);
    // Machicolation band: corbels in shade under the merlons.
    if (z >= top - 11 && z < top - 7) return mod(c.fx, 3) === 0 ? lv(BRK, c.level + 1) : lv(BRK, 0);
    if (mod(z, 3) === 0) return lv(BRK, c.level - 1);
    return lv(BRK, c.level + (hash(c.fx >> 1, z) < 0.08 ? -1 : 0));
  };
}

function castello(): Build {
  const s = new Scene();
  plate(s, 10, 8, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.gravel, c.level - 1);
    // The dry moat lawn around the walls, gravel courtyard inside.
    const inside = c.u > 0.9 && c.u < 9.1 && c.v > 0.9 && c.v < 7.1;
    if (!inside) return lv(R.grass, c.level - 1 - (mod(c.px * 3 + c.py * 5, 11) === 0 ? 1 : 0));
    return lv(R.gravel, c.level - (hash(c.px >> 1, c.py) < 0.1 ? 1 : 0));
  });
  const wallTop = 40;
  const curtain = brickMat(wallTop, 6);
  const cutU = merlons(wallTop, 'u');
  const cutV = merlons(wallTop, 'v');
  // Curtain walls: front (+v), sides, back.
  s.box(1.0, 9.0, 6.8, 7.3, 1, wallTop, curtain, { cut: cutU });
  s.box(0.7, 1.2, 1.0, 7.0, 1, wallTop, curtain, { cut: cutV });
  s.box(8.8, 9.3, 1.0, 7.0, 1, wallTop, curtain, { cut: cutV });
  s.box(1.0, 9.0, 0.7, 1.2, 1, wallTop, curtain, { cut: cutU });
  // Machicolation overhang strips.
  s.box(1.0, 9.0, 7.3, 7.38, wallTop - 11, wallTop - 7, brickMat(wallTop));
  s.box(9.3, 9.38, 1.0, 7.0, wallTop - 11, wallTop - 7, brickMat(wallTop));

  // Inner Corte Ducale and Rocchetta blocks at the back, the Torre di Bona di Savoia.
  const inner = brickMat(46, 4);
  s.box(1.2, 8.8, 1.2, 3.0, 1, 46, inner, { cut: merlons(46, 'u') });
  const tower = brickMat(62, 6);
  s.box(1.4, 2.6, 1.3, 2.5, 1, 62, tower, { cut: merlons(62, 'u') });
  s.box(4.6, 5.4, 2.4, 3.2, 1, 56, brickMat(56, 4), { cut: merlons(56, 'u') });
  for (const [u0, u1, v0, v1, z] of [
    [1.6, 2.4, 1.5, 2.3, 62],
    [4.7, 5.3, 2.5, 3.1, 56],
  ] as const)
    s.hip(u0, u1, v0, v1, z - 4, z + 6, 0.38, coppi(S.terracotta));

  // Round torrioni at the front corners: diamond-point rusticated stone, brick crown.
  const torrione: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return STONE[0];
    if (c.side === 'top')
      return lv(
        ['ink', 'gray2', 'gray3', 'gray4', 'gray4'],
        c.level - (hash(c.px >> 1, c.py) < 0.2 ? 1 : 0),
      );
    const z = c.fz;
    if (z >= 40) {
      if (z >= 43 && z < 47) return mod(c.sx, 3) === 0 ? lv(BRK, c.level + 1) : lv(BRK, 0);
      return lv(BRK, c.level - (mod(z, 3) === 0 ? 1 : 0));
    }
    // Bugnato a punta di diamante: each block a pyramid lit on its upper-left facets.
    const bx = mod(c.sx, 4);
    const bz = mod(z, 4);
    const lit = bx + bz < 4 ? (bx < bz ? 1 : 0) : -1;
    return lv(STONE, c.level + lit);
  };
  for (const u of [1.3, 8.7]) {
    s.cyl(u, 6.9, 1.0, 1, 50, torrione, {
      cut: (uu, vv, z, f) => {
        if (z <= 44 || f !== -1) return false;
        const a = Math.atan2(vv - 6.9, uu - u);
        return mod((a * 30) / Math.PI, 1) > 0.65 && z > 47;
      },
    });
    s.cyl(u, 6.9, 1.06, 36, 43, (c) =>
      c.night ? null : c.edge ? BRK[0] : mod(c.sx, 3) === 0 ? lv(BRK, c.level + 1) : lv(BRK, 0),
    );
  }

  // The Filarete tower over the main gate.
  const fil: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(BRK, c.level - 1);
    const z = c.fz;
    if (c.side === 'left') {
      const dx = c.fx + 0.5 - 80;
      // Gate.
      if (Math.abs(dx) < 4 && z > 1 && (z < 14 || Math.hypot(dx, z - 14) < 4))
        return c.night ? 'ochre1' : 'ink';
      if (Math.abs(dx) < 5.5 && z > 1 && (z < 14 || Math.hypot(dx, z - 14) < 5.5))
        return c.night ? null : lv(STONE, c.level + 1);
      // Niche with Saint Ambrose and the clock.
      if (Math.abs(dx) < 2 && z > 30 && z < 40)
        return c.night ? null : z > 37 ? lv(STONE, 1) : lv(R.marble, c.level);
      if (Math.hypot(dx, z - 60) < 4.5) {
        const r = Math.hypot(dx, z - 60);
        if (c.night) return r < 3.5 ? 'ochre4' : null;
        if (r > 3.5) return lv(R.gold, c.level);
        const ang = Math.atan2(z - 60, dx);
        if ((Math.abs(ang - 1.57) < 0.25 && r < 3) || (Math.abs(ang - 0.4) < 0.3 && r < 2.2))
          return 'ink';
        return 'white';
      }
      // Paired windows in stone frames.
      for (const wz of [48, 74])
        if (Math.abs(Math.abs(dx) - 4) < 1.2 && z > wz - 6 && z < wz)
          return c.night ? 'ochre1' : lv(R.dark, c.level);
    }
    if (c.night) return null;
    if (c.edge) return BRK[0];
    if (z >= 64 && z < 68) return mod(c.fx, 3) === 0 ? lv(STONE, c.level + 1) : lv(BRK, 0);
    if (z < 6) return lv(STONE, c.level);
    if (mod(z, 3) === 0) return lv(BRK, c.level - 1);
    return lv(BRK, c.level);
  };
  s.box(4.4, 5.6, 6.2, 7.5, 1, 70, fil);
  // Upper stages: square loggia, then the two-tier tempietto and cupola.
  const stage: Material = (c) => {
    if (c.night) return mod(c.fx, 5) === 2 && c.fz % 14 > 3 && c.fz % 14 < 10 ? 'ochre2' : null;
    if (c.edge) return STONE[0];
    if (c.side === 'top') return lv(STONE, c.level);
    if (mod(c.fx, 5) === 2 && c.fz % 14 > 3 && c.fz % 14 < 10) return lv(R.dark, c.level);
    return lv(STONE, c.level + (mod(c.fz, 14) === 0 ? 1 : 0));
  };
  s.box(4.55, 5.45, 6.35, 7.35, 70, 84, stage);
  s.prismN(5.0, 6.85, 0.36, 0.36, 84, 96, 8, stage, { rot: Math.PI / 8 });
  s.prismN(5.0, 6.85, 0.26, 0.26, 96, 104, 8, stage, { rot: Math.PI / 8 });
  s.ell(
    5.0,
    6.85,
    104,
    0.28,
    0.28,
    9,
    plain(['ink', 'gray2', 'zinc0', 'zinc1', 'zinc2'], { rim: true }),
    { zMin: 104 },
  );
  s.line(
    [
      [5.0, 6.85, 113],
      [5.0, 6.85, 120],
    ],
    'ochre2',
  );
  // Bridge over the moat to the gate.
  stairs(s, 4.6, 5.4, 8.0, 7.5, 0, 2, 1, stepMat(STONE));
  return { scene: s, overlays: [] };
}

export const LANDMARKS_MILAN: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  duomo: { top: 172, frames: 1, fps: 0, build: duomo },
  galleria: { top: 100, frames: 1, fps: 0, build: galleria },
  laScala: { top: 98, frames: 1, fps: 0, build: laScala },
  castello: { top: 128, frames: 1, fps: 0, build: castello },
};
