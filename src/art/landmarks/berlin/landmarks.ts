/**
 * Secondary landmarks of Berlin — Brandenburger Tor, Siegessäule, Fernsehturm.
 * Contract footprints: LANDMARKS in src/maps/contract.ts.
 */
import { Scene, type Material } from '../engine/scene';
import { R, hash, lv, mod } from '../engine/materials';
import { column } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { paving, plate, type SecondaryArt } from '../shared';
import { RN, flat } from './northkit';
import { goldelse, quadriga } from './sculpture';

// ---------------------------------------------------------------------------------------------
// Brandenburger Tor (6 × 2): twelve Doric columns, five passages, the Quadriga.
// ---------------------------------------------------------------------------------------------
function brandenburgGate(): Build {
  const s = new Scene();
  plate(s, 6, 2, paving);
  const P = RN.sandPale;
  /**
   * Floodlit at night: the night mask repeats the day painting one light step down on the
   * faces toward the viewer (detail kept), the far faces two steps down.
   */
  const floodlit =
    (m: Material): Material =>
    (c) => {
      if (!c.night) return m(c);
      if (c.side !== 'left' && c.side !== 'right' && c.side !== 'curve') return null;
      const level = c.level;
      c.night = false;
      c.level = Math.max(1, level - (c.side === 'right' ? 2 : 1));
      const col = m(c);
      c.night = true;
      c.level = level;
      return col;
    };
  const stone: Material = floodlit((c) => {
    if (c.night) return null;
    if (c.side === 'back') return lv(P, 1);
    if (c.edge) return P[0];
    if (c.side === 'top') return lv(P, c.level);
    if (mod(c.fz, 5) === 0) return lv(P, c.level - 1);
    return lv(P, c.level);
  });
  // Plinth under the colonnade.
  s.box(0.95, 5.05, 0.35, 1.65, 1, 3, stone);
  // Passage walls (front column to back column) and the twelve columns.
  const us = [1.25, 1.95, 2.65, 3.35, 4.05, 4.75];
  for (const u of us) {
    s.box(u - 0.11, u + 0.11, 0.55, 1.45, 3, 38, stone, { tag: 'wall' });
    for (const v of [0.55, 1.45]) {
      column(s, { u, v, z0: 3, z1: 38, r: 0.12, ramp: P, order: 'doric', tag: 'col' });
    }
  }
  // Entablature with the Doric triglyph frieze.
  const entab: Material = floodlit((c) => {
    if (c.night) return null;
    if (c.side === 'back') return lv(P, 1);
    if (c.edge) return P[0];
    if (c.side === 'top') return lv(P, c.level);
    const z = c.fz;
    if (z >= 45) return lv(P, c.level + 1);
    if (z === 44) return mod(c.fx, 2) ? lv(P, c.level - 2) : lv(P, c.level);
    if (z >= 40 && z <= 43) {
      const k = mod(c.fx, 6);
      if (k === 0 || k === 2) return lv(P, c.level - 1);
      if (k === 1) return lv(P, c.level + 1);
      return lv(P, c.level);
    }
    if (z === 39) return lv(P, c.level - 1);
    return lv(P, c.level);
  });
  s.box(0.95, 5.05, 0.35, 1.65, 38, 46, entab);
  // Attic with the relief panel and the stepped Quadriga pedestal.
  const attic: Material = floodlit((c) => {
    if (c.night) return null;
    if (c.side === 'back') return lv(P, 1);
    if (c.edge) return P[0];
    if (c.side === 'top') return lv(P, c.level);
    const z = c.fz;
    if (z >= 54) return lv(P, c.level + 1);
    if (z === 53) return lv(P, c.level - 1);
    if (c.side === 'left' && z > 47 && z < 52 && c.fx > 30 && c.fx < 66) {
      // Relief frieze: a procession, light figures on a shaded ground.
      const fig = mod(c.fx, 4) < 2 && hash(c.fx >> 2, 3) < 0.8;
      return lv(P, c.level + (fig ? 0 : -2));
    }
    return lv(P, c.level);
  });
  s.box(1.15, 4.85, 0.45, 1.55, 46, 56, attic);
  s.box(2.3, 3.7, 0.6, 1.4, 56, 59, attic);
  s.box(2.55, 3.45, 0.75, 1.25, 59, 61, flat(P, true));
  s.sprite(quadriga(), 13, 22, 3.0, 1.0, 61);
  // Side pavilions (the old guardhouses) with their small Doric porticoes.
  for (const u0 of [0.1, 5.05]) {
    s.box(u0, u0 + 0.85, 0.5, 1.2, 1, 24, stone);
    for (const du of [0.18, 0.67]) {
      column(s, { u: u0 + du, v: 1.42, z0: 1, z1: 22, r: 0.08, ramp: P, order: 'doric' });
    }
    s.box(u0 - 0.03, u0 + 0.88, 0.47, 1.55, 22, 26, flat(P, true));
    s.gable(u0, u0 + 0.85, 0.47, 1.55, 26, 31, 'v', (c) =>
      c.side === 'left' ? flat(P, true)(c) : flat(R.slateLit)(c),
    );
  }
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Siegessäule (3 × 3): red granite base, colonnaded hall, column with gilded cannon drums,
// Goldelse on top.
// ---------------------------------------------------------------------------------------------
function victoryColumn(): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  const G = RN.redGranite;
  const S = RN.sandstone;
  s.box(0.35, 2.65, 0.35, 2.65, 1, 3, flat(R.granite));
  s.box(0.5, 2.5, 0.5, 2.5, 3, 5, flat(R.granite));
  // Square red-granite pedestal with bronze relief bands.
  s.box(0.65, 2.35, 0.65, 2.35, 5, 22, (c) => {
    if (c.night) return null;
    if (c.edge) return G[0];
    if (c.side === 'top') return lv(G, c.level);
    if (c.fz > 9 && c.fz < 18 && mod(c.fx, 27) > 3 && mod(c.fx, 27) < 24) {
      return hash(c.fx >> 1, c.fz >> 1, 4) < 0.35
        ? lv(R.bronze, c.level + 1)
        : lv(R.bronze, c.level);
    }
    if (c.fz === 21 || c.fz === 6) return lv(G, c.level + 1);
    return lv(G, c.level);
  });
  // Circular hall: columns ringing a dark mosaic gallery.
  const hall: Material = (c) => {
    const a = Math.atan2(c.v - 1.5, c.u - 1.5);
    const k = mod((a * 16) / (2 * Math.PI), 1);
    const col = k < 0.45;
    if (c.night) return !col && c.fz < 38 ? 'ochre1' : null;
    if (c.edge) return S[0];
    if (c.side === 'top') return lv(S, c.level);
    if (c.fz >= 37) return lv(S, c.level + (c.fz === 37 ? -1 : 1));
    if (!col) return c.fz > 33 ? 'earth1' : hash(c.px, c.fz >> 1) < 0.3 ? 'ochre1' : 'earth0';
    return !c.shadow && c.lambert > 0.55 ? S[4] : lv(S, c.level);
  };
  s.cyl(1.5, 1.5, 0.66, 22, 40, hall);
  s.cyl(1.5, 1.5, 0.6, 40, 44, flat(S, true));
  // The shaft with three gilded drums of captured cannon barrels.
  const shaft: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return S[0];
    const flute = mod(c.sx, 2) === 0 && c.lambert < 0.55;
    if (!c.shadow && c.lambert > 0.62) return S[4];
    return lv(S, c.level - (flute ? 1 : 0));
  };
  s.cyl(1.5, 1.5, 0.32, 44, 50, flat(S, true));
  s.cyl(1.5, 1.5, 0.26, 50, 150, shaft);
  const drum: Material = (c) => {
    if (c.night) return c.lambert > 0.3 ? 'ochre2' : null;
    if (c.edge) return 'earth1';
    if (c.side === 'top') return lv(R.gold, c.level);
    // Vertical cannon barrels with muzzle rings.
    const barrel = mod(c.sx, 3) === 0;
    const ring = mod(c.fz, 7) === 0;
    if (!c.shadow && c.lambert > 0.62 && !barrel) return 'ochre4';
    return lv(R.gold, c.level - (barrel ? 1 : 0) + (ring ? 1 : 0));
  };
  for (const z of [72, 98, 124]) {
    s.cyl(1.5, 1.5, 0.31, z, z + 14, drum);
    s.cyl(1.5, 1.5, 0.33, z - 1, z, flat(R.gold));
  }
  // Capital, viewing platform, statue drum, Goldelse.
  s.cone(1.5, 1.5, 0.26, 0.36, 150, 156, flat(R.bronze));
  s.box(1.13, 1.87, 1.13, 1.87, 156, 159, flat(R.bronze));
  s.cyl(1.5, 1.5, 0.16, 159, 164, flat(R.gold, true));
  s.sprite(goldelse(), 5, 14, 1.5, 1.5, 164);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Fernsehturm (4 × 4): folded-roof pavilion, tapering concrete shaft, steel sphere with the
// "cross" glint and the restaurant band, red-and-white antenna.
// ---------------------------------------------------------------------------------------------
const TV = { u: 2.0, v: 2.0, sz: 246, sr: 1.05 };

function tvTower(): Build {
  const s = new Scene();
  plate(s, 4, 4, paving);
  const C = RN.concrete;
  // Pavilion: glazed ground floor under the zig-zag folded roof.
  const pav: Material = (c) => {
    if (c.night) return c.side !== 'top' && c.fz > 3 && c.fz < 9 && mod(c.fx, 4) ? 'ochre2' : null;
    if (c.edge) return C[0];
    if (c.side === 'top') {
      // Folded plates: alternating lit / shaded triangular facets.
      const a = mod((c.u + c.v) * 1.25, 1);
      return lv(R.whiteSteel, c.level - (a < 0.5 ? 1 : 0) - (a < 0.08 || a > 0.92 ? 1 : 0));
    }
    const z = c.fz;
    if (z >= 10) {
      const k = mod(c.fx, 8);
      const tri = z - 10 > Math.abs(k - 4) - 1;
      return tri ? lv(R.whiteSteel, c.level) : lv(R.whiteSteel, c.level - 2);
    }
    if (z > 2 && z < 9) return mod(c.fx, 4) === 0 ? lv(R.metal, c.level) : lv(R.glass, c.level);
    return lv(C, c.level - 1);
  };
  for (const [u0, u1, v0, v1] of [
    [0.3, 3.7, 0.3, 1.5],
    [0.3, 3.7, 2.5, 3.7],
    [0.3, 1.5, 1.5, 2.5],
    [2.5, 3.7, 1.5, 2.5],
  ] as const) {
    s.box(u0, u1, v0, v1, 1, 14, pav, { tag: 'pav' });
  }
  // The shaft (slightly flared foot), a hairline for the lift shafts.
  const shaft: Material = (c) => {
    if (c.night) return mod(Math.floor(c.fz), 40) === 0 && c.lambert > 0.2 ? 'crim2' : null;
    if (c.edge) return C[0];
    if (!c.shadow && c.lambert > 0.6) return C[4];
    if (c.lambert < 0.1) return C[1];
    return lv(C, c.level);
  };
  s.cone(TV.u, TV.v, 0.62, 0.4, 1, 30, shaft);
  s.cone(TV.u, TV.v, 0.4, 0.27, 30, TV.sz - 16, shaft);
  // Sphere: stainless-steel panels, the observation / restaurant window band, the cross glint.
  const sphere: Material = (c) => {
    const dz = c.z - TV.sz;
    const a = Math.atan2(c.v - TV.v, c.u - TV.u);
    const band = dz > -7 && dz < 1;
    const win = band && mod((a * 48) / (2 * Math.PI), 1) < 0.55;
    if (c.night) return win ? (dz > -3 ? 'ochre3' : 'ochre2') : null;
    if (c.edge) return 'zinc0';
    if (band) return win ? lv(R.dark, c.level) : lv(R.metal, c.level);
    const meridian = mod((a * 24) / (2 * Math.PI), 1) < 0.12;
    const parallel = mod(dz, 5) < 1;
    // The famous cross: the sun's reflection picks out one meridian and one parallel.
    if (c.lambert > 0.86 && !c.shadow) return meridian || parallel ? 'white' : 'zinc4';
    if (c.lambert > 0.8 && (meridian || parallel)) return 'white';
    if (meridian || parallel) return lv(RN.steel, c.level - 1);
    return lv(RN.steel, c.level);
  };
  s.ell(TV.u, TV.v, TV.sz, TV.sr, TV.sr, TV.sr * 19.6, sphere);
  // Neck below and above the sphere.
  s.cyl(TV.u, TV.v, 0.3, TV.sz - 18, TV.sz - 14, flat(C, true));
  const top = TV.sz + Math.round(TV.sr * 19.6);
  s.cyl(TV.u, TV.v, 0.2, top - 2, top + 28, shaft);
  // Antenna: red and white bands, then the mast.
  const antenna: Material = (c) => {
    const red = mod(Math.floor(c.fz / 6), 2) === 0;
    if (c.night) return red && mod(c.fz, 6) === 0 ? 'crim2' : null;
    if (c.edge) return red ? 'rust0' : 'gray3';
    return red
      ? lv(['rust0', 'rust1', 'crim1', 'crim2', 'rust3'], c.level)
      : lv(R.whiteSteel, c.level);
  };
  s.cyl(TV.u, TV.v, 0.12, top + 28, top + 92, antenna);
  s.cyl(TV.u, TV.v, 0.07, top + 92, top + 122, antenna);
  s.line(
    [
      [TV.u, TV.v, top + 122],
      [TV.u, TV.v, top + 136],
    ],
    'gray5',
    { emit: 'crim2' },
  );
  return { scene: s, overlays: [] };
}

export const LANDMARKS_BERLIN: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  brandenburgGate: { top: 72, frames: 1, fps: 0, build: brandenburgGate },
  victoryColumn: { top: 168, frames: 1, fps: 0, build: victoryColumn },
  tvTower: { top: 426, frames: 1, fps: 0, build: tvTower },
};
