/**
 * Secondary landmarks of Amsterdam — Nationaal Monument, Nieuwe Kerk, Centraal Station,
 * Westerkerk. Contract footprints: LANDMARKS in src/maps/contract.ts.
 */
import { Scene, type Material, type Plane, type ShadeCtx } from '../engine/scene';
import { R, lv, mod, plain, type Ramp5 } from '../engine/materials';
import { roofMat } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { mirrorX } from '../../lib/pixels';
import { figure } from '../props';
import { paving, plate, type SecondaryArt } from '../shared';
import { RN, brickAt, flat, seamRoof } from '../berlin/northkit';
import { MONUMENT_LION } from './sprites.grid';

const TRAV: Ramp5 = ['stone1', 'stone3', 'stone4', 'stone5', 'white'];
const STONE = RN.sandPale;

/** Brick with cream stone bands every `band` px and stone quoins (Dutch Renaissance / Cuypers). */
function bandedBrick(B: Ramp5, band: number, c: ShadeCtx): string {
  if (mod(c.fz, band) === 0) return lv(STONE, c.level);
  return brickAt(c, B);
}

/** A pointed (lancet) window test in face space; returns 'g' glass, 'f' frame or null. */
function pointed(c: ShadeCtx, cx: number, w: number, z0: number, z1: number): 'g' | 'f' | null {
  const dx = Math.abs(c.fx + 0.5 - cx);
  const half = w / 2;
  const archH = half * 1.6;
  const springZ = z1 - archH;
  let top = z1;
  if (c.z > springZ) {
    // Pointed arch: two arcs meeting at the apex.
    const t = (c.z - springZ) / archH;
    const halfAt = half * Math.sqrt(Math.max(0, 1 - t * t));
    if (dx > halfAt) return dx < halfAt + 1.2 && t < 1.05 ? 'f' : null;
    top = z1;
  }
  if (dx > half + 1 || c.z < z0 - 1 || c.z > top) return null;
  if (dx > half - 0.2 || c.z < z0) return 'f';
  return 'g';
}

// ---------------------------------------------------------------------------------------------
// Nationaal Monument (3 × 3): stepped round platform, the white pylon with its reliefs, lions.
// ---------------------------------------------------------------------------------------------
function nationalMonument(): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  const T = TRAV;
  const step: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return T[0];
    if (c.side === 'top') return lv(T, c.level - 1);
    return lv(T, c.level - 1);
  };
  s.cyl(1.5, 1.5, 1.45, 1, 3, step);
  s.cyl(1.5, 1.5, 1.28, 3, 5, step);
  s.cyl(1.5, 1.5, 1.1, 5, 7, step);
  // The curved back wall (urns of earth from the provinces), behind the pylon.
  const back: Plane[] = [
    { nu: 1, nv: 1, nz: 0, c: 2.55 },
    { nu: 0, nv: 0, nz: -1, c: -7 },
    { nu: 0, nv: 0, nz: 1, c: 18 },
  ];
  s.add(
    back,
    [0.4, 2.6, 0.4, 2.6, 7, 18],
    (c) => {
      if (c.night) return null;
      if (c.side === 'back') return lv(T, 1);
      if (c.edge) return T[0];
      if (c.side === 'curve' && mod(c.sx, 8) < 2 && c.fz > 9 && c.fz < 15)
        return lv(T, c.level - 2);
      return lv(T, c.level);
    },
    { cut: (u, v, _z, f) => f === 2 && Math.hypot(u - 1.5, v - 1.5) < 0.92 },
    { kind: 'cyl', uc: 1.5, vc: 1.5, r: 1.05 },
  );
  // The pylon: travertine, tapering, rounded crown; reliefs on its front faces.
  const pylon: Material = (c) => {
    if (c.night)
      return c.side === 'left' || c.side === 'right' ? (c.fz < 40 ? 'stone4' : null) : null;
    if (c.edge) return T[0];
    if (c.side === 'top') return lv(T, c.level);
    const z = c.fz;
    const local = mod(c.fx, 16);
    // Lower relief: chained figures (vertical bodies, lighter heads); upper: woman with child.
    const lower = z > 10 && z < 34 && local > 3 && local < 13;
    const upper = z > 56 && z < 70 && local > 4 && local < 12;
    if (lower) {
      const body = mod(c.fx, 3) !== 0;
      const head = mod(z - 30, 9) < 2 && body;
      return lv(T, c.level + (head ? 1 : body ? 0 : -2));
    }
    if (upper) {
      const fig = Math.abs(local - 8) < 2.5 - (z > 66 ? 1 : 0);
      return lv(T, c.level + (fig ? 0 : -2));
    }
    if (mod(z, 12) === 0) return lv(T, c.level - 1);
    return lv(T, c.level);
  };
  s.prismN(1.5, 1.5, 0.36, 0.28, 7, 76, 4, pylon);
  s.ell(1.5, 1.5, 76, 0.28 * 1.25, 0.28 * 1.25, 8, plain(T, { rim: true }), { zMin: 76 });
  // Doves on the crown, the lions on their pedestals.
  s.ell(1.5, 1.5, 85, 0.06, 0.06, 1.5, plain(TRAV, { rim: true }));
  const lion = figure(MONUMENT_LION, 'stone', 'nmLion');
  for (const [u, v, img] of [
    [0.75, 2.35, lion],
    [2.35, 0.75, mirrorX(lion)],
  ] as const) {
    s.box(u - 0.32, u + 0.32, v - 0.22, v + 0.22, 1, 9, flat(T, true));
    s.sprite(img, img === lion ? 6 : 7, 7, u, v, 9);
  }
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Nieuwe Kerk (6 × 3): Gothic brick nave with stone dressing, the great transept window on the
// Dam, a slender crossing turret.
// ---------------------------------------------------------------------------------------------
function nieuweKerk(): Build {
  const s = new Scene();
  plate(s, 6, 3, paving);
  const B = RN.redBrick;
  const nave: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(B, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const bay = mod(c.fx - 2, 14);
    const p = pointed(c, c.fx - bay + 7.5, 6, 10, 32);
    if (p === 'g') {
      if (c.night) return 'ochre1';
      return mod(c.fz, 5) === 0 || Math.abs(c.fx - (c.fx - bay + 7)) === 0
        ? lv(STONE, c.level - 1)
        : lv(R.dark, c.level);
    }
    if (c.night) return null;
    if (p === 'f') return lv(STONE, c.level);
    if (c.edge) return B[0];
    if (bay === 0 || bay === 1) return lv(STONE, c.level - (bay ? 1 : 0)); // buttress strips
    if (c.fz >= 34) return lv(STONE, c.level + (c.fz >= 36 ? 0 : -1));
    return bandedBrick(B, 9, c);
  };
  s.box(0.3, 5.7, 0.6, 2.4, 1, 37, nave);
  s.gable(0.25, 5.75, 0.55, 2.45, 37, 70, 'u', roofMat(R.slateLit, undefined, 3));
  // Transept facing the Dam (+v) with the great pointed window.
  const tr: Material = (c) => {
    if (c.side === 'left') {
      const p = pointed(c, 3.0 * 16, 13, 12, 62);
      if (p === 'g') {
        if (c.night) return mod(c.fz, 6) === 0 ? null : 'ochre2';
        const mull = mod(Math.round(c.fx + 0.5 - 48), 3) === 0 || mod(c.fz, 6) === 0;
        return mull ? lv(STONE, c.level - 1) : lv(R.dark, c.level);
      }
      if (c.night) return null;
      if (p === 'f') return lv(STONE, c.level + 1);
      // Portal below the window.
      const dx = Math.abs(c.fx + 0.5 - 48);
      if (dx < 3 && c.z < 9 - dx * 0.4) return lv(R.dark, c.level);
      if (c.edge) return B[0];
      return bandedBrick(B, 9, c);
    }
    return nave(c);
  };
  s.box(2.25, 3.75, 0.3, 2.75, 1, 64, tr);
  s.gable(2.25, 3.75, 0.25, 2.8, 64, 90, 'v', (c) =>
    c.side === 'left'
      ? c.night
        ? null
        : c.edge
          ? B[0]
          : bandedBrick(B, 9, c)
      : roofMat(R.slateLit, undefined, 3)(c),
  );
  for (const u of [2.28, 3.72]) {
    s.prismN(u, 2.75, 0.12, 0.12, 1, 70, 8, flat(STONE, true), { rot: Math.PI / 8 });
    s.prismN(u, 2.75, 0.12, 0.0, 70, 84, 8, seamRoof(RN.lead), { rot: Math.PI / 8 });
  }
  // The slender crossing turret (no great spire: the tower was never built).
  const tur: Material = (c) => {
    const open = mod(Math.floor(c.sx), 3) === 0 && c.fz > 94 && c.fz < 102;
    if (c.night) return open ? 'ochre2' : null;
    if (c.edge) return 'ink';
    return open ? lv(R.dark, c.level) : lv(RN.lead, c.level);
  };
  s.prismN(3.0, 1.5, 0.22, 0.22, 86, 104, 8, tur, { rot: Math.PI / 8 });
  s.prismN(3.0, 1.5, 0.24, 0.0, 104, 124, 8, seamRoof(RN.lead), { rot: Math.PI / 8 });
  s.ell(3.0, 1.5, 125, 0.05, 0.05, 1.5, plain(R.gold, { rim: true }));
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Centraal Station (13 × 4): Cuypers' red-brick front with stone bands, the central gable,
// twin towers (clock and wind dial, gilded), end pavilions, the iron-and-glass train shed.
// ---------------------------------------------------------------------------------------------
function centraalStation(): Build {
  const s = new Scene();
  plate(s, 13, 4, paving);
  const B = RN.redBrick;
  const front: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(B, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const z = c.fz;
    const bay = mod(c.fx - 3, 10);
    // Two rows of arched windows with stone heads.
    for (const [z0, z1] of [
      [6, 16],
      [22, 34],
    ] as const) {
      const dx = Math.abs(bay - 5);
      const top = z1 + Math.sqrt(Math.max(0, 4 - dx * dx));
      if (dx < 2.2 && z >= z0 && z < top) {
        if (c.night) return 'ochre2';
        return mod(z, 4) === 0 && z < z1 ? lv(STONE, c.level - 1) : lv(R.dark, c.level);
      }
      if (dx < 3.2 && z >= z1 && z < top + 1.5) return c.night ? null : lv(STONE, c.level);
    }
    if (c.night) return null;
    if (c.edge) return B[0];
    if (z >= 40) return lv(STONE, c.level + 1);
    if (z === 18 || z === 19) return lv(STONE, c.level);
    if (bay === 0) return lv(B, c.level - 1);
    return bandedBrick(B, 6, c);
  };
  const slate = roofMat(R.slateLit, undefined, 3);
  // Train shed behind.
  const shed: Material = (c) => {
    if (c.night) return mod(c.fx, 6) === 0 ? null : 'ochre1';
    if (c.edge) return 'zinc0';
    if (mod(c.fx, 6) === 0) return lv(R.metal, c.level);
    if (c.side === 'right')
      return mod(c.fz, 5) === 0 ? lv(R.metal, c.level) : lv(R.glassSky, c.level + 1);
    if (mod(c.fz, 5) === 0) return lv(R.metal, c.level - 1);
    return lv(R.glassSky, c.level);
  };
  s.vaultU(0.6, 12.4, 0.95, 0.85, 26, 26, shed);
  s.box(0.6, 12.4, 0.1, 1.8, 1, 26, flat(R.metal));
  // Main range.
  s.box(0.3, 12.7, 1.8, 3.5, 1, 42, front, { tag: 'front' });
  s.gable(0.3, 12.7, 1.75, 3.55, 42, 60, 'u', slate);
  // Dormers.
  for (let u = 1.9; u < 11.5; u += 1.15) {
    if (u > 4.6 && u < 8.4) continue;
    s.box(u - 0.2, u + 0.2, 3.0, 3.4, 42, 50, front);
    s.gable(u - 0.25, u + 0.25, 2.95, 3.45, 50, 55, 'v', slate);
  }
  // End pavilions.
  for (const u0 of [0.2, 11.6]) {
    s.box(u0, u0 + 1.2, 1.65, 3.65, 1, 48, front, { tag: 'front' });
    s.hip(u0, u0 + 1.2, 1.65, 3.65, 48, 68, [0.6, 0.6], slate);
    s.line(
      [
        [u0 + 0.6, 2.65, 68],
        [u0 + 0.6, 2.65, 74],
      ],
      'ochre2',
    );
  }
  // Central section: three entrance arches, great window, stepped gable with gilded crest.
  const centre: Material = (c) => {
    if (c.side === 'left') {
      const z = c.fz;
      for (const cx of [91, 104, 117]) {
        const dx = Math.abs(c.fx + 0.5 - cx);
        if (dx < 4 && z < 12 + Math.sqrt(Math.max(0, 16 - dx * dx))) {
          if (c.night) return 'ochre2';
          return z < 2 ? 'gray1' : lv(R.dark, c.level);
        }
      }
      const dx = Math.abs(c.fx + 0.5 - 104);
      if (dx < 9 && z > 24 && z < 50 + Math.sqrt(Math.max(0, 81 - dx * dx)) * 0.6) {
        const mull = mod(Math.round(dx), 3) === 0 || mod(z, 6) === 0;
        if (c.night) return mull ? null : 'ochre2';
        if (dx > 7.8) return lv(STONE, c.level);
        return mull ? lv(STONE, c.level - 1) : lv(R.glass, c.level - 1);
      }
      if (c.night) return null;
      if (c.edge) return B[0];
      return bandedBrick(B, 6, c);
    }
    return front(c);
  };
  s.box(5.6, 7.4, 3.5, 3.85, 1, 58, centre);
  s.gable(5.55, 7.45, 3.45, 3.9, 58, 84, 'v', (c) => (c.side === 'left' ? centre(c) : slate(c)));
  s.ell(6.5, 3.85, 85, 0.12, 0.12, 4, plain(R.gold, { rim: true }));
  // Twin towers.
  for (const [i, u0] of [4.8, 7.45].entries()) {
    const u1 = u0 + 0.8;
    const cu = (u0 + u1) / 2;
    const tw: Material = (c) => {
      if (c.side === 'top') return c.night ? null : lv(B, c.level);
      const z = c.fz;
      // Clock (west tower) / wind dial (east tower) on both visible faces.
      if (z > 60 && z < 76) {
        const cx = c.side === 'left' ? cu * 16 : 3.15 * 16;
        const dx = c.fx + 0.5 - cx;
        const dz = c.z - 68;
        const r = Math.hypot(dx, dz);
        if (r < 6) {
          if (c.night) return r < 4.5 ? 'ochre4' : null;
          if (r > 4.8) return lv(R.gold, c.level);
          const hand =
            i === 0
              ? (Math.abs(dx) < 0.6 && dz > 0 && dz < 4.5) ||
                (Math.abs(dz) < 0.6 && dx > 0 && dx < 3.5)
              : Math.abs(dx - dz) < 0.7 && Math.abs(dx) < 4;
          if (hand) return 'ink';
          return i === 0 ? (c.level >= 3 ? 'white' : 'stone4') : c.level >= 3 ? 'sky' : 'blue2';
        }
        if (r < 7) return c.night ? null : lv(STONE, c.level + 1);
      }
      if (c.night) return null;
      if (c.edge) return B[0];
      if (z >= 78) return lv(STONE, c.level + 1);
      return bandedBrick(B, 6, c);
    };
    s.box(u0, u1, 2.75, 3.55, 1, 80, tw);
    s.hip(u0 - 0.05, u1 + 0.05, 2.7, 3.6, 80, 104, [0.45, 0.45], slate);
    s.cyl(cu, 3.15, 0.1, 96, 104, flat(R.gold, true));
    s.prismN(cu, 3.15, 0.08, 0.0, 104, 112, 8, flat(R.gold, true), { rot: Math.PI / 8 });
    for (const [du, dv] of [
      [0, 0.8],
      [0.8, 0.8],
      [0.8, 0],
    ] as const)
      s.prismN(u0 + du, 2.75 + dv, 0.07, 0.0, 80, 90, 4, flat(R.gold, true));
  }
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Westerkerk (5 × 3): brick-and-stone Renaissance church; the 85 m tower with stone stages and
// the blue-and-gold imperial crown.
// ---------------------------------------------------------------------------------------------
function westerkerk(): Build {
  const s = new Scene();
  plate(s, 5, 3, paving);
  const B = RN.redBrick;
  const body: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(B, c.level);
    if (c.side === 'back') return c.night ? null : 'ink';
    const bay = mod(c.fx - 4, 13);
    const dx = Math.abs(bay - 6.5);
    const win = dx < 3 && c.fz > 8 && c.fz < 30 + Math.sqrt(Math.max(0, 9 - dx * dx));
    if (win) {
      if (c.night) return 'ochre1';
      return mod(c.fz, 5) === 0 || dx < 0.6 ? lv(STONE, c.level - 1) : lv(R.dark, c.level);
    }
    if (c.night) return null;
    if (c.edge) return B[0];
    if (dx < 4 && c.fz > 7 && c.fz < 35) return lv(STONE, c.level);
    if (c.fz >= 37) return lv(STONE, c.level + 1);
    return bandedBrick(B, 7, c);
  };
  const slate = roofMat(R.slateLit, undefined, 3);
  s.box(0.3, 3.9, 0.5, 2.5, 1, 39, body);
  s.gable(0.25, 3.95, 0.45, 2.55, 39, 62, 'u', slate);
  // Two transept gables on the +v side.
  for (const u of [1.1, 2.9]) {
    s.box(u - 0.6, u + 0.6, 2.4, 2.75, 1, 39, body);
    s.gable(u - 0.62, u + 0.62, 2.35, 2.8, 39, 60, 'v', (c) =>
      c.side === 'left' ? body(c) : slate(c),
    );
  }
  // Tower: brick square, then stone stages, then the crown.
  const T = { u: 4.4, v: 1.5 };
  s.box(3.9, 4.9, 1.0, 2.0, 1, 64, body);
  s.box(3.85, 4.95, 0.95, 2.05, 64, 67, flat(STONE, true));
  const stage: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(STONE, c.level);
    const local = mod(c.fx, 16);
    const clock = c.fz > 70 && c.fz < 82 && Math.hypot(local - 8, c.fz - 76) < 5;
    if (clock) {
      const r = Math.hypot(local - 8, c.fz - 76);
      if (c.night) return r < 4 ? 'ochre4' : null;
      if (r > 3.8) return lv(R.gold, c.level);
      if ((local === 8 && c.fz >= 76 && c.fz < 80) || (c.fz === 76 && local >= 8 && local < 11))
        return 'ink';
      return lv(RN.royalBlue, c.level);
    }
    const open = mod(local, 8) > 2 && mod(local, 8) < 6 && c.fz > 86 && c.fz < 96;
    if (c.night) return open ? 'ochre1' : null;
    if (open) return lv(R.dark, c.level);
    if (c.edge) return STONE[0];
    if (mod(local, 8) === 0) return lv(STONE, c.level + 1);
    return lv(STONE, c.level);
  };
  s.box(4.0, 4.8, 1.1, 1.9, 67, 98, stage);
  s.prismN(
    T.u,
    T.v,
    0.36,
    0.36,
    98,
    118,
    8,
    (c) => {
      const open = mod(Math.floor(c.sx), 4) < 2 && c.fz > 102 && c.fz < 114;
      if (c.night) return open ? 'ochre1' : null;
      if (c.edge) return STONE[0];
      return open ? lv(R.dark, c.level) : lv(STONE, c.level + (c.fz > 115 ? 1 : 0));
    },
    { rot: Math.PI / 8 },
  );
  s.prismN(
    T.u,
    T.v,
    0.26,
    0.26,
    118,
    130,
    8,
    (c) => {
      if (c.night) return null;
      if (c.edge) return 'ink';
      return mod(Math.floor(c.sx), 3) === 0 ? lv(R.dark, c.level) : lv(RN.lead, c.level + 1);
    },
    { rot: Math.PI / 8 },
  );
  // The imperial crown of Maximilian: gold band, blue bonnet with gold arches, orb and cross.
  s.cyl(T.u, T.v, 0.3, 130, 134, (c) => {
    if (c.night) return 'ochre2';
    if (c.edge) return 'earth1';
    const jewel = mod(Math.floor(c.sx), 4) === 1;
    return jewel ? (mod(Math.floor(c.sx), 8) === 1 ? 'crim2' : 'sky') : lv(R.gold, c.level);
  });
  s.ell(
    T.u,
    T.v,
    134,
    0.3,
    0.3,
    11,
    (c) => {
      const a = Math.atan2(c.v - T.v, c.u - T.u);
      const arch = Math.abs(mod((a * 4) / Math.PI + 0.5, 1) - 0.5) < 0.14;
      if (c.night) return arch ? 'ochre3' : null;
      if (c.edge) return 'navy0';
      if (arch) return lv(R.gold, c.level + 1);
      return lv(RN.royalBlue, c.level);
    },
    { zMin: 134 },
  );
  s.ell(T.u, T.v, 147, 0.08, 0.08, 2.5, plain(R.gold, { rim: true }));
  s.line(
    [
      [T.u, T.v, 149],
      [T.u, T.v, 166],
    ],
    'ochre2',
  );
  s.line(
    [
      [T.u - 0.06, T.v + 0.06, 153],
      [T.u + 0.06, T.v - 0.06, 153],
    ],
    'ochre2',
  );
  s.ell(T.u, T.v, 160, 0.05, 0.05, 1.5, plain(R.gold, { rim: true }));
  return { scene: s, overlays: [] };
}

export const LANDMARKS_AMSTERDAM: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  nationalMonument: { top: 98, frames: 1, fps: 0, build: nationalMonument },
  nieuweKerk: { top: 134, frames: 1, fps: 0, build: nieuweKerk },
  centraalStation: { top: 112, frames: 1, fps: 0, build: centraalStation },
  westerkerk: { top: 176, frames: 1, fps: 0, build: westerkerk },
};
