/**
 * Secondary landmarks of Stockholm — Kungliga slottet, Stadshuset, Riddarholmskyrkan.
 * Contract footprints: LANDMARKS in src/maps/contract.ts.
 */
import { Scene, type Material } from '../engine/scene';
import { R, hash, lv, mod, mod_, plain, type Ramp5 } from '../engine/materials';
import { balustradeCut, paintWindow, roofMat } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { figure } from '../props';
import { paving, plate, type SecondaryArt } from '../shared';
import { RN, brickAt, flat, seamRoof } from '../berlin/northkit';
import { THREE_CROWNS } from './sprites.grid';

const winMod = (r: Ramp5, tall: boolean) =>
  mod_(
    tall
      ? `
  .FFFF.
  .FgGF.
  .FggF.
  .FmmF.
  .FggF.
  .FggF.
  .FggF.
  .ssss.
  `
      : `
  .FFFF.
  .FgGF.
  .FggF.
  .ssss.
  `,
    { F: { r, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: { r, d: -1 }, s: { r, d: 1 } },
    { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
  );

// ---------------------------------------------------------------------------------------------
// Kungliga slottet (9 × 8): the massive pale ochre quadrangle around its courtyard.
// ---------------------------------------------------------------------------------------------
const OCHRE: Ramp5 = ['earth1', 'earth3', 'earth4', 'stone3', 'stone4'];

function royalPalace(): Build {
  const s = new Scene();
  plate(s, 9, 8, paving);
  const O = OCHRE;
  const tall = winMod(O, true);
  const small = winMod(O, false);
  const wall: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(O, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const z = c.fz;
    const bay = mod(c.fx - 2, 9);
    const c0 = c.fx - bay + 1;
    const central = c.prim.tag === 'risalit';
    if (!(central && c.side === 'left' && c.fx > 61 && c.fx < 82 && z < 20)) {
      for (const [zTop, m] of [
        [14, tall],
        [30, tall],
        [42, tall],
        [50, small],
      ] as const) {
        const p = paintWindow(m, c, c0, zTop, 'ok');
        if (p !== undefined) return p;
      }
    }
    if (c.night)
      return central && c.side === 'left' && z < 18 && Math.abs(c.fx - 71.5) < 5 ? 'ochre2' : null;
    if (c.edge) return O[0];
    // Grand arched gateway in the risalit.
    if (central && c.side === 'left') {
      const dx = Math.abs(c.fx + 0.5 - 72);
      if (dx < 6 && z < 12 + Math.sqrt(Math.max(0, 36 - dx * dx)) * 0.8) {
        if (dx < 5 && z < 11 + Math.sqrt(Math.max(0, 25 - dx * dx)) * 0.8)
          return lv(R.dark, c.level);
        return lv(O, c.level + 1);
      }
      // Paired giant pilasters.
      if (z > 18 && z < 52 && [60, 63, 81, 84].includes(c.fx)) return lv(O, c.level + 1);
      if (z > 18 && z < 52 && [61, 64, 82, 85].includes(c.fx)) return lv(O, c.level - 1);
    }
    if (z >= 54) return lv(O, c.level + 1);
    if (z === 53) return lv(O, c.level - 1);
    if (z === 52) return mod(c.fx, 2) ? lv(O, c.level - 1) : lv(O, c.level);
    if (z < 18) {
      // Rusticated grey-granite ground floor.
      if (z === 17) return lv(R.granite, c.level + 1);
      if (mod(z, 4) === 2) return lv(R.granite, c.level - 1);
      return lv(R.granite, c.level);
    }
    if (z === 18) return lv(O, c.level - 1);
    if (bay === 0) return lv(O, c.level + 1);
    return lv(O, c.level);
  };
  // Four wings around the inner courtyard.
  for (const [u0, u1, v0, v1] of [
    [0.4, 8.6, 0.4, 2.2],
    [0.4, 8.6, 5.6, 7.4],
    [0.4, 2.2, 2.2, 5.6],
    [6.8, 8.6, 2.2, 5.6],
  ] as const) {
    s.box(u0, u1, v0, v1, 1, 56, wall, { tag: 'wing' });
    s.hip(u0 + 0.12, u1 - 0.12, v0 + 0.12, v1 - 0.12, 56, 62, 0.45, roofMat(RN.lead, undefined, 3));
  }
  // Front risalit (Slottsbacken) with its attic and the royal crest.
  s.box(3.6, 5.4, 7.4, 7.65, 1, 60, wall, { tag: 'risalit' });
  const attic: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return O[0];
    if (c.side === 'left' && Math.abs(c.fx + 0.5 - 72) < 4 && c.fz > 61 && c.fz < 67) {
      return Math.abs(c.fx + 0.5 - 72) < 2 && c.fz > 62
        ? lv(R.gold, c.level)
        : lv(RN.royalBlue, c.level);
    }
    return lv(O, c.level + (c.rim ? 1 : 0));
  };
  s.box(3.7, 5.3, 7.3, 7.6, 60, 68, attic);
  // Balustrades along the cornice.
  const bal: Material = (c) => (c.night ? null : c.edge ? O[0] : lv(O, c.level));
  s.box(0.4, 8.6, 7.25, 7.4, 56, 60, bal, { cut: balustradeCut(56, 60) });
  s.box(8.45, 8.6, 0.4, 7.4, 56, 60, bal, { cut: balustradeCut(56, 60) });
  // Copper lanterns on the corner pavilions.
  for (const [u, v] of [
    [8.1, 6.9],
    [0.9, 6.9],
    [8.1, 0.9],
  ] as const) {
    s.box(u - 0.3, u + 0.3, v - 0.3, v + 0.3, 56, 64, wall, { tag: 'wing' });
    s.hip(u - 0.34, u + 0.34, v - 0.34, v + 0.34, 64, 70, 0.34, seamRoof(RN.copper));
  }
  s.line(
    [
      [4.5, 6.5, 62],
      [4.5, 6.5, 92],
    ],
    'gray2',
  );
  return { scene: s, overlays: [{ sprite: 'lm.flag.se', u: 4.5, v: 6.5, z: 92, flag: true }] };
}

// ---------------------------------------------------------------------------------------------
// Stadshuset (8 × 5): dark red brick, water-side arcade, copper roofs, the 106 m tower with its
// green-copper lantern and the gilded Three Crowns.
// ---------------------------------------------------------------------------------------------
const TOWER = { u0: 6.1, u1: 7.6, v0: 3.2, v1: 4.7, top: 176 };

function cityHall(): Build {
  const s = new Scene();
  plate(s, 8, 5, paving);
  const B = RN.darkBrick;
  const CU = RN.copper;
  const brick: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(B, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const z = c.fz;
    // Irregular rows of small deep windows; tall hall windows on the upper storey.
    const k = Math.floor(c.fx / 7);
    const x = mod(c.fx, 7);
    const win =
      (x >= 2 && x <= 4 && z > 8 && z < 14) ||
      (x >= 2 && x <= 4 && z > 20 && z < 26) ||
      (x >= 2 && x <= 4 && z > 32 && z < 44 && hash(k, 5) < 0.7);
    if (c.prim.tag === 'body' && c.side === 'left' && z < 18) {
      // Water-side arcade: round arches on granite piers.
      const ax = mod(c.fx, 10);
      const dx = Math.abs(ax - 5);
      if (dx < 3.5 && z < 11 + Math.sqrt(Math.max(0, 12 - dx * dx))) {
        if (c.night) return 'ochre1';
        return z < 2 ? 'gray1' : lv(R.dark, c.level - 1);
      }
      if (c.night) return null;
      return lv(R.granite, c.level - (dx < 4.6 ? 0 : 1));
    }
    if (win) return c.night ? (hash(k, z >> 3) < 0.6 ? 'ochre2' : null) : lv(R.dark, c.level);
    if (c.night) return null;
    if (c.edge) return B[0];
    if (z >= 54) return lv(B, c.level + 1);
    return brickAt(c, B);
  };
  s.box(0.3, 7.7, 0.4, 4.6, 1, 56, brick, { tag: 'body' });
  s.gable(0.25, 7.75, 0.35, 4.65, 56, 76, 'u', seamRoof(CU));
  // Gilded ridge ornaments on the copper roof.
  for (let u = 0.6; u < 6.0; u += 0.9) {
    s.line(
      [
        [u, 2.5, 76],
        [u, 2.5, 80],
      ],
      'ochre2',
    );
  }
  // The tower: brick shaft with vertical slit windows, corbelled gallery, open lantern.
  const T = TOWER;
  const tower: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(B, c.level);
    const a0 = c.side === 'left' ? T.u0 : T.v0;
    const local = c.fx - Math.floor(a0 * 16);
    const slit =
      (local === 11 || local === 12) && mod(c.fz, 24) > 6 && mod(c.fz, 24) < 20 && c.fz > 60;
    if (c.night) return slit ? 'ochre1' : null;
    if (slit) return lv(R.dark, c.level);
    if (c.edge) return B[0];
    if (local <= 1 || local >= 22) return lv(B, c.level + (local <= 1 ? 1 : -1));
    return brickAt(c, B);
  };
  s.box(T.u0, T.u1, T.v0, T.v1, 1, T.top, tower, { tag: 'tower' });
  // Corbel + balcony.
  s.box(T.u0 - 0.12, T.u1 + 0.12, T.v0 - 0.12, T.v1 + 0.12, T.top, T.top + 4, flat(B, true));
  const gallery: Material = (c) =>
    c.night ? null : c.side === 'back' ? 'ink' : c.edge ? B[0] : lv(B, c.level);
  s.box(T.u0 - 0.12, T.u1 + 0.12, T.v0 - 0.12, T.v1 + 0.12, T.top + 4, T.top + 8, gallery, {
    cut: balustradeCut(T.top + 4, T.top + 8, 2),
  });
  // Open lantern stage: tall arches.
  const lantern: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(B, c.level);
    const a0 = c.side === 'left' ? T.u0 + 0.2 : T.v0 + 0.2;
    const local = c.fx - Math.floor(a0 * 16);
    const open = mod(local - 2, 6) < 3 && c.fz > T.top + 6 && c.fz < T.top + 22;
    if (c.night) return open ? 'ochre2' : null;
    if (open) return lv(R.dark, c.level - 1);
    if (c.edge) return B[0];
    return brickAt(c, B);
  };
  s.box(T.u0 + 0.2, T.u1 - 0.2, T.v0 + 0.2, T.v1 - 0.2, T.top + 4, T.top + 26, lantern);
  // Copper corner pinnacles and the central copper spire.
  for (const [u, v] of [
    [T.u0 + 0.05, T.v1 - 0.05],
    [T.u1 - 0.05, T.v1 - 0.05],
    [T.u1 - 0.05, T.v0 + 0.05],
    [T.u0 + 0.05, T.v0 + 0.05],
  ] as const) {
    s.prismN(u, v, 0.11, 0.11, T.top + 8, T.top + 16, 4, flat(B, true));
    s.prismN(u, v, 0.12, 0.0, T.top + 16, T.top + 34, 8, seamRoof(CU), { rot: Math.PI / 8 });
    s.ell(u, v, T.top + 35, 0.04, 0.04, 1.5, plain(R.gold, { rim: true }));
  }
  const tc = { u: (T.u0 + T.u1) / 2, v: (T.v0 + T.v1) / 2 };
  s.prismN(tc.u, tc.v, 0.56, 0.38, T.top + 26, T.top + 34, 8, seamRoof(CU), { rot: Math.PI / 8 });
  s.cyl(tc.u, tc.v, 0.3, T.top + 34, T.top + 44, (c) => {
    const open = mod(Math.floor(c.sx), 4) < 2;
    if (c.night) return open ? 'ochre2' : null;
    if (c.edge) return CU[0];
    return open ? lv(R.dark, c.level) : lv(CU, c.level);
  });
  s.ell(tc.u, tc.v, T.top + 44, 0.32, 0.32, 9, seamRoof(CU), { zMin: T.top + 44 });
  s.prismN(tc.u, tc.v, 0.08, 0.02, T.top + 52, T.top + 66, 8, flat(CU, true));
  s.sprite(figure(THREE_CROWNS, 'gold', 'treKronor'), 5, 10, tc.u, tc.v, T.top + 66);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Riddarholmskyrkan (5 × 3): brick Gothic nave, copper-domed burial chapels, the cast-iron
// open-work spire.
// ---------------------------------------------------------------------------------------------
function ironLattice(cell: number): (u: number, v: number, z: number, f: number) => boolean {
  return (u, v, z, f) => {
    if (f < 2) return false;
    const a = (u + v) * 16;
    const x = mod(a, cell);
    const y = mod(z, cell);
    const diag = Math.abs(x - y) < 0.7 || Math.abs(x + y - cell) < 0.7;
    const frame = y < 1.0 || z < 100;
    return !(diag || frame);
  };
}

function riddarholmen(): Build {
  const s = new Scene();
  plate(s, 5, 3, paving);
  const B = RN.darkBrick;
  const gothic: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(B, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const bay = mod(c.fx - 3, 12);
    const dx = Math.abs(bay - 6);
    const lancet = dx < 2.5 && c.fz > 10 && c.fz < 30 - dx * dx * 0.6;
    if (c.night) return lancet ? 'ochre1' : null;
    if (lancet) return mod(c.fz, 6) === 0 || dx < 0.6 ? lv(B, c.level) : lv(R.dark, c.level);
    if (c.edge) return B[0];
    if (bay === 0 || bay === 1) return lv(B, c.level + (bay === 0 ? 1 : -1));
    if (c.fz > 36 && mod(c.fx, 4) < 2 && c.fz < 39) return lv(B, c.level + 1); // corbel frieze
    return brickAt(c, B);
  };
  s.box(0.3, 3.7, 0.7, 2.3, 1, 40, gothic);
  s.gable(0.25, 3.75, 0.65, 2.35, 40, 64, 'u', seamRoof(RN.copperDark));
  // Stepped east gable at the low-u end.
  s.gable(0.3, 0.55, 0.7, 2.3, 40, 64, 'u', gothic);
  // Burial chapels with copper domes on the +v side.
  for (const u of [1.2, 2.8]) {
    s.box(u - 0.45, u + 0.45, 2.3, 2.85, 1, 24, gothic);
    s.cyl(u, 2.55, 0.28, 24, 30, flat(B, true));
    s.ell(u, 2.55, 30, 0.3, 0.3, 9, seamRoof(RN.copper), { zMin: 30 });
    s.line(
      [
        [u, 2.55, 39],
        [u, 2.55, 43],
      ],
      'ochre2',
    );
  }
  // West tower with the iron spire.
  const tw: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(B, c.level);
    const a0 = c.side === 'left' ? 3.7 : 1.0;
    const local = c.fx - Math.floor(a0 * 16);
    const open =
      ((local >= 6 && local <= 9) || (local >= 12 && local <= 15)) && c.fz > 70 && c.fz < 84;
    if (c.night) return open ? 'ochre1' : null;
    if (open) return lv(R.dark, c.level - 1);
    if (c.edge) return B[0];
    if (c.fz >= 86) return lv(B, c.level + 1);
    return brickAt(c, B);
  };
  s.box(3.7, 4.95, 0.95, 2.2, 1, 88, tw);
  for (const [u, v] of [
    [3.75, 2.15],
    [4.9, 2.15],
    [4.9, 1.0],
    [3.75, 1.0],
  ] as const) {
    s.prismN(u, v, 0.08, 0.0, 88, 100, 4, flat(RN.darkBrick, true));
  }
  const iron: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'back') return mod(c.fz, 2) ? 'ink' : 'gray1';
    if (c.edge) return 'ink';
    if (!c.shadow && c.lambert > 0.6) return 'zinc3';
    return c.lambert > 0.3 ? 'zinc2' : 'zinc1';
  };
  s.prismN(4.33, 1.58, 0.52, 0.03, 88, 206, 8, iron, { rot: Math.PI / 8, cut: ironLattice(12) });
  s.line(
    [
      [4.33, 1.58, 206],
      [4.33, 1.58, 214],
    ],
    'gray3',
  );
  s.ell(4.33, 1.58, 209, 0.05, 0.05, 1.5, plain(R.gold, { rim: true }));
  return { scene: s, overlays: [] };
}

export const LANDMARKS_STOCKHOLM: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  royalPalace: { top: 96, frames: 1, fps: 0, build: royalPalace },
  cityHall: { top: 256, frames: 1, fps: 0, build: cityHall },
  riddarholmen: { top: 214, frames: 1, fps: 0, build: riddarholmen },
};
