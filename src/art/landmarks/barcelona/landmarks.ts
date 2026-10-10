/**
 * Secondary landmarks of Barcelona — Arc de Triomf, the Cascada, the Monument a Colom and the
 * Sagrada Família (edge; still under construction, cranes and all). Contract footprints:
 * LANDMARKS in src/maps/contract.ts. Fronts face +v (the lit SW face).
 */
import { Scene, type Material } from '../engine/scene';
import { R, hash, lv, mod, plain, type Ramp5 } from '../engine/materials';
import { balustradeCut, column, stairs, stepMat } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { bronzeLion, figure, marbleStatue } from '../props';
import { jet, plate, type SecondaryArt } from '../shared';
import { S, ovalBasin, saulo } from '../rome/common';
import { QUADRIGA } from '../rome/figures.grid';
import { COLUMBUS, GRIFFIN } from './figures.grid';

const BR = S.redBrick;
const SAND = S.sandstone;

/** Barcelona "panot" pavement: grey squares with the four-tablet relief. */
const panot: Material = (c) => {
  if (c.night) return null;
  if (c.side !== 'top') return lv(R.granite, c.level - 1);
  const a = mod(c.u * 4, 1);
  const b = mod(c.v * 4, 1);
  if (a < 0.07 || b < 0.12) return lv(['stone0', 'gray3', 'gray4', 'gray5', 'gray6'], c.level - 1);
  const tab =
    (a > 0.2 && a < 0.45) !== (b > 0.25 && b < 0.5) && a > 0.2 && a < 0.8 && b > 0.25 && b < 0.85;
  return lv(['stone0', 'gray4', 'gray5', 'gray6', 'gray7'], c.level - (tab ? 1 : 0));
};

// ---------------------------------------------------------------------------------------------
// Arc de Triomf (3 × 2): red-brick Mudéjar gate, stone frieze, corner turrets with crowns.
// ---------------------------------------------------------------------------------------------

function arcTriomf(): Build {
  const s = new Scene();
  plate(s, 3, 2, panot);
  const opening = (u: number, z: number): boolean => {
    const dx = (u - 1.5) * 16;
    return Math.abs(dx) < 8.5 && z > 1 && (z < 36 || Math.hypot(dx, z - 36) < 8.5);
  };
  const brick: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'back') return lv(BR, 1 + (c.z > 30 ? 0 : -1));
    if (c.edge) return BR[0];
    if (c.side === 'top') return lv(BR, c.level);
    const z = c.fz;
    // Stone frieze over the arch (the "Barcelona welcomes the nations" relief).
    if (z >= 48 && z <= 57 && c.side === 'left') {
      if (z === 48 || z === 57) return lv(SAND, c.level + 1);
      const h = hash(c.fx >> 1, z >> 1, 3);
      return lv(SAND, c.level - (h < 0.3 ? 2 : h < 0.55 ? 1 : 0) + 1);
    }
    if (c.side === 'left') {
      const dx = c.fx + 0.5 - 24;
      const r = Math.hypot(dx, z - 36);
      // Archivolt in moulded brick + stone impost.
      if (z >= 36 && r >= 8.5 && r < 11) return lv(BR, c.level + (r < 9.6 ? 1 : -1));
      if (z === 35 && Math.abs(dx) < 11) return lv(SAND, c.level + 1);
    }
    // Geometric brick patterns: rhombus lattice in the spandrels + courses.
    if (z >= 60) {
      // Attic band: blind arcading.
      const loc = mod(c.fx, 6);
      if (z < 70 && loc > 1 && loc < 5 && z > 61 && z < 67 - (loc === 2 || loc === 4 ? 1 : 0))
        return lv(BR, c.level - 2);
      if (z === 70 || z === 71) return lv(SAND, c.level + (z === 71 ? 1 : 0));
    }
    if (z > 38 && z < 48) {
      const d = mod(c.fx + z, 6) === 0 || mod(c.fx - z, 6) === 0;
      if (d) return lv(BR, c.level - 1);
    }
    if (mod(z, 3) === 0) return lv(BR, c.level - 1);
    return lv(BR, c.level + (mod(c.fx + (Math.floor(z / 3) % 2) * 2, 4) === 0 ? -1 : 0));
  };
  s.box(0.4, 2.6, 0.6, 1.4, 1, 72, brick, {
    cut: (u, _v, z, f) => (f === 2 || f === 3 ? opening(u, z) : false),
  });
  // Corner turrets (pilaster towers) with brick crowns and stone balls.
  const turret: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return BR[0];
    if (c.side === 'top') return lv(SAND, c.level);
    if (c.fz >= 72 && c.fz <= 74) return lv(SAND, c.level + 1);
    if (mod(c.fz, 3) === 0) return lv(BR, c.level - 1);
    if (mod(c.fx, 4) === 1) return lv(BR, c.level + 1);
    return lv(BR, c.level);
  };
  for (const [u, v] of [
    [0.4, 1.4],
    [2.6, 1.4],
    [2.6, 0.6],
    [0.4, 0.6],
  ] as const) {
    s.box(u - 0.2, u + 0.2, v - 0.2, v + 0.2, 1, 76, turret);
    s.hip(u - 0.22, u + 0.22, v - 0.22, v + 0.22, 76, 82, 0.12, plain(SAND, { rim: true }));
    s.ell(u, v, 85, 0.1, 0.1, 3.5, plain(R.gold, { rim: true }), { zMin: 82 });
  }
  // Crested parapet with the crowned shields.
  s.box(0.6, 2.4, 0.75, 1.25, 72, 77, turret, {
    cut: (u, _v, z) => z > 75 && mod(Math.floor(u * 16), 3) === 0,
  });
  s.box(1.3, 1.7, 0.9, 1.1, 77, 83, plain(SAND, { rim: true }));
  s.ell(1.5, 1.0, 85, 0.13, 0.1, 3, plain(R.gold, { rim: true }), { zMin: 83 });
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Cascada (5 × 3): arch with the Birth of Venus over the falls, side stairs, the pond with the
// griffins, the gilded quadriga of Aurora on top.
// ---------------------------------------------------------------------------------------------

function cascada(frame: number): Build {
  const s = new Scene();
  plate(s, 5, 3, saulo);
  const st: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return SAND[0];
    if (c.side === 'top') return lv(SAND, c.level);
    if (c.fz >= c.prim.aabb[5] - 2) return lv(SAND, c.level + 1);
    if (mod(c.fz, 5) === 0) return lv(SAND, c.level - 1);
    return lv(SAND, c.level);
  };
  // Side wings: terraces reached by the curving stairs.
  for (const [u0, u1] of [
    [0.25, 1.75],
    [3.25, 4.75],
  ] as const) {
    s.box(u0, u1, 0.25, 0.95, 1, 30, st);
    s.box(u0, u1, 0.85, 0.95, 30, 34, plain(SAND), { cut: balustradeCut(30, 34) });
    const outer = u0 < 2 ? u0 : u1 - 0.55;
    s.box(outer, outer + 0.55, 0.95, 1.25, 1, 18, st);
    stairs(s, outer, outer + 0.55, 1.75, 1.25, 1, 18, 6, stepMat(SAND));
    s.ell(u0 < 2 ? u0 + 0.12 : u1 - 0.12, 0.9, 36, 0.09, 0.09, 3, plain(R.gold, { rim: true }), {
      zMin: 33,
    });
  }
  // Central triumphal arch with paired columns and the Venus grotto.
  const arch: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return SAND[0];
    if (c.side === 'top') return lv(SAND, c.level);
    if (c.side === 'left') {
      const dx = c.fx + 0.5 - 40;
      if (Math.abs(dx) < 6 && c.z > 16 && (c.z < 34 || Math.hypot(dx, c.z - 34) < 6))
        return Math.abs(dx) > 4 ? 'stone1' : 'stone0';
      if (Math.abs(dx) < 7.5 && c.z > 16 && (c.z < 34 || Math.hypot(dx, c.z - 34) < 7.5))
        return lv(SAND, c.level + 1);
    }
    if (c.fz >= 46) return lv(SAND, c.level + (c.fz >= 50 ? 1 : 0));
    if (c.fz === 45) return lv(SAND, c.level - 2);
    return lv(SAND, c.level);
  };
  s.box(1.75, 3.25, 0.2, 1.0, 1, 54, arch);
  for (const u of [1.85, 2.1, 2.9, 3.15])
    column(s, { u, v: 1.05, z0: 16, z1: 46, r: 0.07, ramp: SAND });
  s.box(1.7, 3.3, 0.9, 1.15, 46, 50, plain(SAND, { rim: true }));
  // Aedicule + the gilded quadriga of Aurora.
  s.box(2.15, 2.85, 0.4, 0.95, 54, 62, st);
  s.gable(2.1, 2.9, 0.38, 0.97, 62, 67, 'u', plain(SAND, { rim: true }));
  s.sprite(figure(QUADRIGA, 'gold', 'aurora'), 13, 20, 2.5, 0.7, 67, { bias: 0.4 });
  // The Birth of Venus in the grotto, rocks below it, the stepped falls.
  s.sprite(marbleStatue('standing'), 4, 19, 2.5, 1.06, 18, { bias: 0.2 });
  const rock: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return SAND[0];
    const h = hash(Math.floor(c.u * 10), Math.floor(c.v * 10), Math.floor(c.z / 3));
    if (c.side === 'top' && h < 0.2) return lv(R.grass, c.level - 2);
    return lv(SAND, c.level - (h < 0.4 ? 1 : 0));
  };
  for (const [u0, u1, v0, v1, z] of [
    [1.6, 2.2, 1.0, 1.6, 15],
    [2.8, 3.4, 1.0, 1.6, 15],
    [1.4, 1.9, 1.4, 1.9, 8],
    [3.1, 3.6, 1.4, 1.9, 8],
  ] as const) {
    s.hip(u0, u1, v0, v1, 1, z, 0.2, rock);
  }
  // Water steps: three falls into the pond, animated sheets.
  const sheet =
    (z0: number): Material =>
    (c) => {
      const on = mod(c.fz - z0 + frame * 2 + (c.side === 'left' ? 0 : 1), 4);
      if (c.night) return on === 0 ? 'teal1' : null;
      if (c.side === 'top') return lv(R.water, 3);
      return on === 0 ? 'white' : on === 1 ? 'sky' : lv(R.water, 3);
    };
  for (const [k, z] of [
    [0, 16],
    [1, 11],
    [2, 6],
  ] as const) {
    const v0 = 1.0 + k * 0.25;
    s.box(2.15 - k * 0.05, 2.85 + k * 0.05, v0, v0 + 0.25, 1, z, sheet(z), { cast: false });
  }
  ovalBasin(s, 2.5, 2.15, 2.35, 0.82, 4, frame, 4, SAND, 0.1);
  // Griffins on the rim spouting into the pond.
  const gr = figure(GRIFFIN, 'gold', 'griffin');
  s.sprite(gr, 4, 7, 0.9, 2.3, 3);
  s.sprite(gr, 4, 7, 4.1, 2.3, 3);
  jet(s, [0.95, 2.25, 8], [1.6, 2.1, 3], 5, frame);
  jet(s, [4.05, 2.25, 8], [3.4, 2.1, 3], 5, frame + 2);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Monument a Colom (3 × 3): stepped round base with lions, octagonal pedestal, iron column,
// Columbus pointing to sea.
// ---------------------------------------------------------------------------------------------

function columbus(): Build {
  const s = new Scene();
  plate(s, 3, 3, panot);
  const C = 1.5;
  s.cyl(C, C, 1.42, 1, 3, plain(SAND));
  s.cyl(C, C, 1.2, 3, 5, plain(SAND, { rim: true }));
  const ped: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return SAND[0];
    if (c.side === 'top') return lv(SAND, c.level);
    const z = c.fz;
    // Bronze reliefs on the faces (Columbus's voyage).
    if (z > 12 && z < 26 && mod(c.fx, 10) > 1 && mod(c.fx, 10) < 9)
      return lv(R.bronze, c.level + (hash(c.fx, z) < 0.35 ? 1 : 0));
    if (z >= 30) return lv(SAND, c.level + 1);
    return lv(SAND, c.level);
  };
  s.prismN(C, C, 0.85, 0.85, 5, 10, 8, plain(SAND), { rot: Math.PI / 8 });
  s.prismN(C, C, 0.62, 0.62, 10, 32, 8, ped, { rot: Math.PI / 8 });
  s.prismN(C, C, 0.68, 0.68, 32, 35, 8, plain(SAND, { rim: true }), { rot: Math.PI / 8 });
  // Drum with the allegories, the column base.
  s.cyl(C, C, 0.45, 35, 48, (c) => {
    if (c.night) return null;
    if (c.edge) return SAND[0];
    const a = Math.atan2(c.v - C, c.u - C);
    const fig = mod((a * 4) / Math.PI, 1) < 0.35 && c.fz > 37 && c.fz < 46;
    return fig ? lv(R.bronze, c.level + 1) : lv(SAND, c.level);
  });
  s.cyl(C, C, 0.32, 48, 54, plain(S.ironGreen, { rim: true }));
  // The cast-iron Corinthian column with gilded bands.
  const shaft: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'ink';
    if (mod(c.fz, 30) === 0) return lv(R.gold, c.level);
    const flute = mod(c.sx, 2) === 0 && c.lambert < 0.55;
    if (!c.shadow && c.lambert > 0.6) return S.ironGreen[4];
    return lv(S.ironGreen, c.level - (flute ? 1 : 0));
  };
  s.cyl(C, C, 0.2, 54, 146, shaft);
  s.cone(C, C, 0.2, 0.3, 146, 153, plain(R.bronze));
  // The crown with the figures of Fame, the globe and Columbus.
  s.cyl(C, C, 0.24, 153, 156, plain(R.gold, { rim: true }));
  s.ell(C, C, 159, 0.2, 0.2, 4, plain(R.bronze, { rim: true }));
  s.sprite(figure(COLUMBUS, 'bronze', 'columbus'), 6, 14, C, C, 162);
  // Bronze lions guarding the steps.
  s.sprite(bronzeLion(false), 12, 14, 0.45, 2.3, 3);
  s.sprite(bronzeLion(false), 12, 14, 2.35, 2.35, 3);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Sagrada Família (7 × 5, edge): Nativity façade with its four towers and the green Tree of
// Life on +v, the Passion towers behind, Jesus / Mary / Evangelist towers, fruit pinnacles on
// the nave, the unfinished Glory end on +u with two tower cranes.
// ---------------------------------------------------------------------------------------------

/** Paraboloid bell tower: tapering shaft with spiral slits, mosaic mitre finial. */
function bellTower(s: Scene, u: number, v: number, h: number, stone: Ramp5, seed: number): void {
  const zTop = h - 14;
  const tower: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return stone[0];
    const a = Math.atan2(c.v - v, c.u - u);
    const k = mod((a * 3) / Math.PI + c.z * 0.06, 1);
    if (c.fz > 30 && c.fz < zTop - 8 && k < 0.22 && mod(c.fz, 4) !== 0) return lv(stone, 0);
    if (c.side === 'curve' && !c.shadow && c.lambert > 0.6) return stone[4];
    return lv(stone, c.level - (mod(c.fz, 9) === 0 ? 1 : 0));
  };
  s.cone(u, v, 0.27, 0.17, 1, zTop - 12, tower);
  s.cone(u, v, 0.17, 0.05, zTop - 12, zTop, tower);
  // Mosaic mitre: red / gold / white chequers on a short spire, a cross-ball on top.
  const mitre: Material = (c) => {
    if (c.night) return hash(c.px, c.py) < 0.3 ? 'ochre3' : null;
    if (c.edge) return 'rust0';
    const ch = mod(Math.floor(c.fz / 2) + Math.floor(Math.atan2(c.v - v, c.u - u) * 3), 3);
    const col: Ramp5 =
      ch === 0 ? ['rust0', 'rust1', 'crim1', 'crim2', 'rust4'] : ch === 1 ? R.gold : R.marble;
    return lv(col, c.level + (c.rim ? 1 : 0));
  };
  s.prismN(u, v, 0.1, 0.1, zTop, zTop + 6, 6, mitre, { rot: seed });
  s.prismN(u, v, 0.1, 0.0, zTop + 6, zTop + 11, 6, mitre, { rot: seed });
  s.ell(u, v, zTop + 13, 0.06, 0.06, 2, plain(R.marble, { rim: true }));
}

function sagradaFamilia(): Build {
  const s = new Scene();
  plate(s, 7, 5, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.gravel, c.level - 1);
    if (c.u > 6.2)
      return lv(
        ['gray2', 'gray3', 'gray4', 'gray5', 'gray6'],
        c.level - (hash(c.px >> 1, c.py) < 0.2 ? 1 : 0),
      );
    return panot(c);
  });
  const NEW = SAND;
  const OLD = S.sandOld;
  // Nave + aisles with tall windows.
  const nave: Material = (c) => {
    if (c.night)
      return c.side === 'left' && mod(c.fx, 10) > 3 && mod(c.fx, 10) < 7 && c.fz > 12 && c.fz < 36
        ? hash(c.fx, c.fz) < 0.5
          ? 'pink2'
          : 'ochre2'
        : null;
    if (c.edge) return NEW[0];
    if (c.side === 'top') return lv(NEW, c.level);
    const loc = mod(c.fx, 10);
    if (loc > 3 && loc < 7 && c.fz > 10 && c.fz < c.prim.aabb[5] - 8) {
      const arch = c.fz > c.prim.aabb[5] - 12 && (loc === 4 || loc === 6);
      if (!arch) return lv(R.dark, c.level);
    }
    if (loc === 0 || loc === 1) return lv(NEW, c.level + 1);
    return lv(NEW, c.level);
  };
  s.box(0.9, 6.2, 1.5, 3.5, 1, 46, nave);
  s.box(0.9, 6.2, 0.9, 1.5, 1, 30, nave);
  s.box(0.9, 6.2, 3.5, 4.1, 1, 30, nave);
  const roof: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return NEW[0];
    return lv(NEW, c.level - (mod(c.fz, 4) === 0 ? 1 : 0));
  };
  s.gable(0.9, 6.2, 1.45, 3.55, 46, 62, 'u', roof);
  // Apse (-u end).
  s.cyl(0.95, 2.5, 0.85, 1, 44, nave);
  s.ell(0.95, 2.5, 44, 0.8, 0.8, 10, roof, { zMin: 44 });
  // Transept with the Nativity façade on +v.
  s.box(3.0, 4.4, 0.7, 4.3, 1, 50, nave);
  s.gable(2.95, 4.45, 0.7, 4.3, 50, 66, 'v', roof);
  const nativity: Material = (c) => {
    if (c.night) {
      if (c.side === 'left' && c.fz < 18 && Math.abs(mod(c.fx - 8, 10) - 5) < 2) return 'ochre1';
      return null;
    }
    if (c.edge) return OLD[0];
    if (c.side === 'top') return lv(OLD, c.level);
    if (c.side === 'left') {
      // Three portals with dripping, organic carving.
      const loc = mod(c.fx - 8, 10);
      const dx = loc - 5;
      if (Math.abs(dx) < 2.5 && c.z > 2 && (c.z < 14 || Math.hypot(dx, c.z - 14) < 2.5))
        return 'ink';
      const drip = hash(c.fx, Math.floor(c.fz / 3), 7);
      if (c.fz > 18) return lv(OLD, c.level - (drip < 0.3 ? 1 : 0) + (drip > 0.85 ? 1 : 0));
    }
    return lv(OLD, c.level - (hash(c.fx >> 1, c.fz >> 1, 3) < 0.25 ? 1 : 0));
  };
  s.box(2.7, 4.7, 4.3, 4.7, 1, 48, nativity);
  s.gable(2.7, 4.7, 4.3, 4.7, 48, 58, 'v', nativity);
  // Tree of Life: the green ceramic cypress with white doves atop the façade.
  const cypress: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'green0';
    if (hash(c.px, c.py, 2) < 0.08) return 'white';
    return lv(R.grass, c.level - 1 - (mod(c.fz + (c.px & 1), 3) === 0 ? 1 : 0));
  };
  s.cone(3.7, 4.5, 0.2, 0.02, 56, 76, cypress);
  // The four Nativity towers (+v) and four Passion towers (−v).
  bellTower(s, 2.85, 4.5, 104, OLD, 0.2);
  bellTower(s, 3.3, 4.5, 112, OLD, 0.5);
  bellTower(s, 4.1, 4.5, 112, OLD, 0.8);
  bellTower(s, 4.55, 4.5, 104, OLD, 1.1);
  bellTower(s, 2.85, 0.6, 104, NEW, 0.3);
  bellTower(s, 3.3, 0.6, 112, NEW, 0.6);
  bellTower(s, 4.1, 0.6, 112, NEW, 0.9);
  bellTower(s, 4.55, 0.6, 104, NEW, 1.2);
  // Central towers: Jesus (cross), the four Evangelists, Mary (star).
  const central =
    (h: number): Material =>
    (c) => {
      if (c.night) return mod(c.fx, 4) === 1 && c.fz > h - 40 && c.fz < h - 10 ? 'ochre2' : null;
      if (c.edge) return NEW[0];
      if (c.side === 'top') return lv(NEW, c.level);
      if (mod(c.fx, 4) === 1 && c.fz > 60 && c.fz < h - 6 && mod(c.fz, 10) > 2)
        return lv(R.dark, c.level);
      return lv(NEW, c.level + (mod(c.fx, 4) === 3 ? 1 : 0));
    };
  s.prismN(3.7, 2.5, 0.5, 0.2, 46, 166, 8, central(166), { rot: Math.PI / 8 });
  const glass: Material = (c) =>
    c.night ? 'sky' : c.edge ? 'zinc1' : lv(R.whiteSteel, c.level + 1);
  s.box(3.66, 3.74, 2.46, 2.54, 166, 182, glass);
  s.box(3.6, 3.8, 2.47, 2.53, 175, 178, glass);
  s.box(3.67, 3.73, 2.4, 2.6, 175, 178, glass);
  for (const [u, v, mat] of [
    [3.0, 1.75, 'crim2'],
    [4.4, 1.75, 'ochre3'],
    [3.0, 3.25, 'green3'],
    [4.4, 3.25, 'white'],
  ] as const) {
    s.prismN(u, v, 0.3, 0.12, 46, 132, 8, central(132), { rot: Math.PI / 8 });
    s.ell(u, v, 136, 0.13, 0.13, 5, (c) => (c.night ? 'ochre3' : c.edge ? 'ink' : mat));
  }
  s.prismN(1.6, 2.5, 0.38, 0.14, 44, 138, 8, central(138), { rot: Math.PI / 8 });
  // Mary's star: a glowing twelve-point star.
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 6;
    s.line(
      [
        [1.6 - Math.cos(a) * 0.12, 2.5 + Math.cos(a) * 0.12, 146 - Math.sin(a) * 6],
        [1.6 + Math.cos(a) * 0.12, 2.5 - Math.cos(a) * 0.12, 146 + Math.sin(a) * 6],
      ],
      'white',
      { emit: 'ochre4' },
    );
  }
  // Fruit pinnacles along the nave eaves.
  const FRUIT = ['crim2', 'ochre3', 'rust3', 'green4', 'pink2', 'lime'] as const;
  for (let k = 0; k < 9; k++) {
    const u = 1.15 + k * 0.6;
    if (u > 2.7 && u < 4.7) continue;
    for (const v of [3.55, 1.45]) {
      s.prismN(u, v, 0.07, 0.0, 46, 60, 4, plain(NEW, { rim: true }));
      const col = FRUIT[(k + (v > 2 ? 0 : 3)) % FRUIT.length]!;
      s.ell(u, v, 62, 0.07, 0.07, 3, (c) =>
        c.night ? null : c.edge ? 'ink' : c.level >= 3 ? col : lv(R.gold, 1),
      );
    }
  }
  // The unfinished Glory end: bare concrete, scaffolding, two tower cranes.
  const raw: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'gray1';
    if (mod(c.fx, 6) === 0 || mod(c.fz, 8) === 0)
      return lv(['ink', 'gray1', 'gray2', 'gray3', 'gray4'], c.level);
    return lv(['gray1', 'gray3', 'gray4', 'gray5', 'gray6'], c.level);
  };
  s.box(6.2, 6.6, 1.0, 4.0, 1, 40, raw);
  for (let z = 6; z <= 40; z += 8) {
    s.line(
      [
        [6.68, 1.0, z],
        [6.68, 4.0, z],
      ],
      'ochre1',
    );
  }
  for (let v = 1.0; v <= 4.01; v += 0.5) {
    s.line(
      [
        [6.68, v, 1],
        [6.68, v, 42],
      ],
      'gray3',
    );
  }
  crane(s, 6.75, 0.6, 150, -1);
  crane(s, 1.2, 0.35, 128, 1);
  return { scene: s, overlays: [] };
}

/** Lattice tower crane: mast, jib, counter-jib with weight, hook line. */
function crane(s: Scene, u: number, v: number, h: number, dir: 1 | -1): void {
  const Y = 'hivis2';
  const y = 'olive2';
  const w = 0.07;
  for (const [du, dv] of [
    [-w, -w],
    [w, -w],
    [w, w],
    [-w, w],
  ] as const) {
    s.line(
      [
        [u + du, v + dv, 1],
        [u + du, v + dv, h],
      ],
      du > 0 || dv > 0 ? Y : y,
    );
  }
  for (let z = 1; z < h; z += 6) {
    s.line(
      [
        [u - w, v + w, z],
        [u + w, v + w, z + 6],
      ],
      y,
    );
    s.line(
      [
        [u + w, v - w, z],
        [u + w, v + w, z + 6],
      ],
      y,
    );
  }
  // Jib along u (dir), counter-jib opposite, cab, apex + ties.
  const L = 2.6;
  s.line(
    [
      [u, v, h],
      [u + dir * L, v - dir * L * 0.25, h],
    ],
    Y,
  );
  s.line(
    [
      [u, v, h + 3],
      [u + dir * L, v - dir * L * 0.25, h],
    ],
    y,
  );
  s.line(
    [
      [u, v, h],
      [u - dir * 0.9, v + dir * 0.22, h],
    ],
    Y,
  );
  s.line(
    [
      [u, v, h + 10],
      [u, v, h],
    ],
    Y,
  );
  s.line(
    [
      [u, v, h + 10],
      [u + dir * L * 0.7, v - dir * L * 0.17, h],
    ],
    'gray4',
  );
  s.line(
    [
      [u, v, h + 10],
      [u - dir * 0.9, v + dir * 0.22, h],
    ],
    'gray4',
  );
  s.box(
    u - dir * 0.95 - 0.08,
    u - dir * 0.95 + 0.08,
    v + dir * 0.23 - 0.08,
    v + dir * 0.23 + 0.08,
    h - 6,
    h,
    plain(['ink', 'gray2', 'gray3', 'gray4', 'gray5']),
  );
  s.box(
    u - 0.08,
    u + 0.08,
    v - 0.08,
    v + 0.08,
    h - 5,
    h,
    plain(['rust0', 'rust1', 'crim1', 'crim2', 'rust4']),
  );
  const hu = u + dir * L * 0.6;
  const hv = v - dir * L * 0.15;
  s.line(
    [
      [hu, hv, h],
      [hu, hv, h - 30],
    ],
    'gray2',
  );
  s.line(
    [
      [hu - 0.03, hv, h - 30],
      [hu + 0.03, hv, h - 32],
    ],
    'crim2',
  );
}

export const LANDMARKS_BARCELONA: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  arcTriomf: { top: 92, frames: 1, fps: 0, build: arcTriomf },
  cascada: { top: 92, frames: 4, fps: 6, build: cascada },
  columbus: { top: 182, frames: 1, fps: 0, build: columbus },
  sagradaFamilia: { top: 194, frames: 1, fps: 0, build: sagradaFamilia },
};
