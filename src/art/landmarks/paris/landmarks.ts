/**
 * Secondary landmarks of Paris — Obélisque, Fontaine de la Concorde, Tour Eiffel,
 * Invalides, Musée d'Orsay (E0: moved verbatim from
 * secondary.ts). Contract footprints: LANDMARKS in src/maps/contract.ts.
 */
import { Scene, type Material, type ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, plain } from '../engine/materials';
import { column, roofMat, stairs, stepMat } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { figure, marbleStatue } from '../props';
import { basin, classicalWall, jet, paving, plate, type SecondaryArt } from '../shared';

function obelisk(): Build {
  const s = new Scene();
  plate(s, 2, 2, paving);
  const g = R.granite;
  s.box(0.35, 1.65, 0.35, 1.65, 1, 6, plain(g));
  s.box(0.5, 1.5, 0.5, 1.5, 6, 22, (c) => {
    if (c.night) return null;
    if (c.edge) return g[0];
    if (c.side !== 'top' && c.fz > 9 && c.fz < 19 && mod(c.fx, 16) > 4 && mod(c.fx, 16) < 12)
      return mod(c.fx + c.fz, 2) === 0 ? lv(R.gold, c.level - 1) : lv(g, c.level - 1);
    return lv(g, c.level);
  });
  s.box(0.45, 1.55, 0.45, 1.55, 22, 25, plain(g, { rim: true }));
  const hier: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return R.pinkGranite[0];
    const col = mod(c.fx, 4);
    const glyph =
      col !== 0 && hash(Math.floor(c.fx / 4), Math.floor(c.fz / 3), 3) < 0.55 && mod(c.fz, 3) !== 0;
    return lv(R.pinkGranite, c.level - (glyph ? 1 : 0));
  };
  s.prismN(1.0, 1.0, 0.25, 0.17, 25, 112, 4, hier);
  s.prismN(1.0, 1.0, 0.17, 0, 112, 120, 4, plain(R.gold, { rim: true }));
  return { scene: s, overlays: [] };
}

function concordeFountain(frame: number): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  basin(s, 1.5, 1.5, 1.4, 1.25, 5, frame, 4, R.granite);
  const vg: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'green0';
    if (c.fz % 5 === 0) return lv(R.gold, c.level - 1);
    return lv(R.verdigris, c.level);
  };
  s.cyl(1.5, 1.5, 0.3, 2, 14, vg);
  s.ell(1.5, 1.5, 16, 0.7, 0.7, 3, vg, { zMax: 17 });
  s.cyl(1.5, 1.5, 0.12, 17, 28, vg);
  s.ell(1.5, 1.5, 29, 0.42, 0.42, 2.5, vg, { zMax: 30 });
  s.cyl(1.5, 1.5, 0.06, 30, 35, vg);
  // Tritons & nereids holding fish around the base.
  const triton = figure(
    `
    .oo..
    ohlo.
    .oo..
    ohlmo
    ohlmo
    .olo.
    ohllo
    `,
    'verdigris',
    'triton',
  );
  for (const [u, v] of [
    [0.85, 2.05],
    [2.1, 2.1],
    [2.15, 0.9],
  ] as const) {
    s.sprite(triton, 2, 6, u, v, 3);
    jet(s, [u, v, 8], [1.5 + (u - 1.5) * 0.4, 1.5 + (v - 1.5) * 0.4, 15], 5, frame);
  }
  jet(s, [1.5, 1.5, 35], [1.1, 1.9, 29], 4, frame);
  jet(s, [1.5, 1.5, 35], [1.9, 1.1, 29], 4, frame + 1);
  jet(s, [1.5, 1.5, 35], [1.9, 1.9, 29], 4, frame + 2);
  return { scene: s, overlays: [] };
}

/** Lattice cut: X-bracing pattern in face space. */
function lattice(scale: number): (u: number, v: number, z: number, f: number) => boolean {
  return (u, v, z, f) => {
    if (f < 0) return false;
    const a = (u + v) * 16;
    const b = z;
    const cell = Math.max(4, scale);
    const x = mod(a, cell);
    const y = mod(b, cell);
    const diag = Math.abs(x - y) < 1.3 || Math.abs(x + y - cell) < 1.3;
    const frame = x < 1.5 || y < 1.2;
    return !(diag || frame);
  };
}

function eiffel(): Build {
  const s = new Scene();
  plate(s, 6, 6, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.gravel, c.level - 1);
    const lawn =
      Math.abs(c.u - 3) > 1.6 && Math.abs(c.v - 3) > 1.6
        ? false
        : Math.abs(c.u - 3) < 1.2 && Math.abs(c.v - 3) < 1.2;
    if (lawn) return lv(R.grass, c.level - 1);
    return lv(R.gravel, c.level - (hash(c.px >> 1, c.py) < 0.1 ? 1 : 0));
  });
  const iron: Material = (c) => {
    if (c.night) return hash(c.px, c.py) < 0.05 ? 'ochre4' : null;
    if (c.side === 'back') return lv(R.eiffel, Math.max(1, c.level - 1));
    if (c.edge) return R.eiffel[0];
    return lv(R.eiffel, c.level);
  };
  // Four legs: inclined frusta from the footprint corners to the first platform.
  const legs: Array<[number, number]> = [
    [0.9, 0.9],
    [5.1, 0.9],
    [0.9, 5.1],
    [5.1, 5.1],
  ];
  const zP1 = 64;
  for (const [bu, bv] of legs) {
    const tu = 3 + (bu - 3) * 0.48;
    const tv = 3 + (bv - 3) * 0.48;
    const h0 = 0.62;
    const h1 = 0.32;
    // Planes for a slanted frustum: |u − cu(z)| ≤ hw(z), |v − cv(z)| ≤ hw(z).
    const ku = (tu - bu) / zP1;
    const kv = (tv - bv) / zP1;
    const kh = (h1 - h0) / zP1;
    const pl = [
      { nu: 0, nv: 0, nz: -1, c: 0 },
      { nu: 0, nv: 0, nz: 1, c: zP1 },
      { nu: 1, nv: 0, nz: -(ku + kh), c: bu + h0 },
      { nu: -1, nv: 0, nz: ku - kh, c: -(bu - h0) },
      { nu: 0, nv: 1, nz: -(kv + kh), c: bv + h0 },
      { nu: 0, nv: -1, nz: kv - kh, c: -(bv - h0) },
    ];
    s.poly(
      pl,
      [
        Math.min(bu, tu) - h0,
        Math.max(bu, tu) + h0,
        Math.min(bv, tv) - h0,
        Math.max(bv, tv) + h0,
        0,
        zP1,
      ],
      iron,
      {
        cut: lattice(11),
      },
    );
    // Masonry pier.
    s.box(bu - 0.7, bu + 0.7, bv - 0.7, bv + 0.7, 1, 4, plain(R.lime));
  }
  // Arches between the legs on the two visible sides (+v and +u).
  for (const side of ['v', 'u'] as const) {
    const pts: Array<[number, number, number]> = [];
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      const a = 1.6 + t * 2.8;
      const z = 30 + Math.sin(t * Math.PI) * 22;
      pts.push(side === 'v' ? [a, 4.15 + Math.sin(t * Math.PI) * 0.0, z] : [4.15, a, z]);
    }
    s.line(pts, 'earth3');
    s.line(
      pts.map(([a, b, z]) => [a, b, z + 2] as [number, number, number]),
      'earth1',
    );
  }
  // First platform.
  const deck: Material = (c) => {
    if (c.night) return c.side !== 'top' && mod(c.fx, 3) === 0 ? 'ochre3' : null;
    if (c.edge) return R.eiffel[0];
    if (c.side !== 'top')
      return mod(c.fx, 3) === 0 ? lv(R.eiffel, c.level + 1) : lv(R.eiffel, c.level - 1);
    return lv(R.eiffel, c.level);
  };
  s.box(1.6, 4.4, 1.6, 4.4, zP1, zP1 + 8, deck);
  // Second section.
  s.prismN(3, 3, 1.15, 0.62, zP1 + 8, 140, 4, iron, { cut: lattice(9) });
  s.box(2.25, 3.75, 2.25, 3.75, 140, 146, deck);
  // Third section — the long taper.
  s.prismN(3, 3, 0.6, 0.18, 146, 260, 4, iron, { cut: lattice(7) });
  s.prismN(3, 3, 0.18, 0.12, 260, 300, 4, iron);
  s.box(2.82, 3.18, 2.82, 3.18, 300, 308, deck);
  s.prismN(3, 3, 0.12, 0.04, 308, 318, 4, iron);
  s.line(
    [
      [3, 3, 318],
      [3, 3, 336],
    ],
    'gray3',
    { emit: 'ochre4' },
  );
  return { scene: s, overlays: [] };
}

function invalides(): Build {
  const s = new Scene();
  plate(s, 8, 8, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.gravel, c.level - 1);
    const lawn = (c.u > 0.6 && c.u < 2.0) || (c.v > 6.0 && c.v < 7.4 && (c.u < 3.2 || c.u > 4.8));
    if (lawn && c.u < 7.4 && c.v > 0.6) return lv(R.grass, c.level - 1);
    return lv(R.gravel, c.level - (hash(c.px >> 1, c.py) < 0.1 ? 1 : 0));
  });
  const L = R.lime;
  const wall = classicalWall({ ramp: L, pitch: 10, off: 4, rows: [40, 22], top: 50, base: 10 });
  s.box(2.0, 6.0, 2.0, 6.0, 1, 50, wall);
  s.hip(2.1, 5.9, 2.1, 5.9, 50, 56, 0.6, roofMat(R.slateLit));
  // Two-tier portico on the +v face.
  s.box(3.0, 5.0, 6.0, 6.35, 1, 6, plain(L));
  stairs(s, 3.0, 5.0, 6.8, 6.35, 1, 6, 2, stepMat(L));
  for (let k = 0; k < 6; k++)
    column(s, {
      u: 3.2 + k * 0.32,
      v: 6.2,
      z0: 6,
      z1: 28,
      r: 0.09,
      ramp: R.limePale,
      order: 'doric',
    });
  s.box(3.0, 5.0, 6.0, 6.32, 28, 32, plain(L, { rim: true }));
  for (let k = 0; k < 4; k++)
    column(s, { u: 3.45 + k * 0.37, v: 6.15, z0: 32, z1: 50, r: 0.08, ramp: R.limePale });
  s.box(3.2, 4.8, 6.0, 6.28, 50, 54, plain(L, { rim: true }));
  s.gable(3.15, 4.85, 6.0, 6.3, 54, 62, 'v', (c) =>
    c.side === 'left'
      ? c.night
        ? null
        : c.edge
          ? L[0]
          : lv(L, c.level - (c.rim ? 0 : 1))
      : roofMat(R.slateLit)(c),
  );
  // Drum with paired columns and windows.
  const drum: Material = (c) => {
    const a = Math.atan2(c.v - 4, c.u - 4);
    const k = mod((a * 20) / Math.PI, 2);
    const colp = k < 0.5;
    const win = k > 0.9 && k < 1.6 && c.fz > 64 && c.fz < 80;
    if (c.night) return win ? 'ochre2' : null;
    if (c.edge) return L[0];
    if (win) return lv(R.dark, c.level);
    if (c.fz > 84) return lv(L, c.level + 1);
    if (colp && !c.shadow && c.lambert > 0.45) return L[4];
    return lv(L, c.level - (colp ? 0 : 1) + 1);
  };
  s.cyl(4, 4, 1.25, 50, 88, drum);
  s.cyl(4, 4, 1.15, 88, 94, plain(L, { rim: true }));
  // The golden dome: gilded ribs and trophies on dark lead.
  const dome: Material = (c) => {
    if (c.night) {
      const a = Math.atan2(c.v - 4, c.u - 4);
      const rr = mod((a * 8) / Math.PI + 0.5, 1);
      return Math.abs(rr - 0.5) < 0.12 ? 'ochre3' : c.lambert > 0.2 ? 'ochre1' : 'earth3';
    }
    if (c.edge) return 'earth1';
    const a = Math.atan2(c.v - 4, c.u - 4);
    const r = mod((a * 8) / Math.PI + 0.5, 1);
    const rib = Math.abs(r - 0.5) < 0.12;
    if (rib) return lv(R.gold, c.level + 1);
    const trophy = Math.abs(r - 0.5) > 0.32 && mod(c.fz, 10) > 3 && mod(c.fz, 10) < 8;
    if (trophy) return lv(R.gold, c.level);
    return lv(R.gold, c.level - 1);
  };
  s.ell(4, 4, 94, 1.12, 1.12, 50, dome, { zMin: 94 });
  s.cyl(4, 4, 0.25, 140, 152, plain(R.gold, { rim: true }));
  s.cone(4, 4, 0.22, 0.0, 152, 174, plain(R.gold, { rim: true }));
  s.line(
    [
      [4, 4, 174],
      [4, 4, 180],
    ],
    'ochre3',
  );
  // Corner chapels.
  for (const [u, v] of [
    [2.3, 5.7],
    [5.7, 5.7],
    [5.7, 2.3],
  ] as const) {
    s.cyl(u, v, 0.45, 50, 58, plain(L));
    s.ell(u, v, 58, 0.42, 0.42, 10, roofMat(R.slateLit), { zMin: 58 });
  }
  return { scene: s, overlays: [] };
}

function orsay(): Build {
  const s = new Scene();
  plate(s, 10, 5, paving);
  const L = R.lime;
  const arched = (c: ShadeCtx): string | null | undefined => {
    if (c.side !== 'left' && c.side !== 'right') return undefined;
    const pitch = 16;
    const rel = mod(c.fx - 4, pitch);
    const dx = rel - 7.5;
    if (Math.abs(dx) < 5 && c.z > 10 && c.z < 40 - (dx * dx) / 6) {
      const mull = mod(Math.round(dx), 3) === 0 || mod(c.fz, 7) === 0;
      if (c.night) return mull ? null : 'ochre2';
      return mull ? lv(R.metal, c.level) : lv(R.glass, c.level - 1);
    }
    return undefined;
  };
  const wall: Material = (c) => {
    const a = arched(c);
    if (a !== undefined) return a;
    if (c.night) return null;
    if (c.side === 'top') return lv(L, c.level);
    if (c.edge) return L[0];
    if (c.fz >= 46) return lv(L, c.level + 1);
    if (c.fz === 45 || c.fz === 42) return lv(L, c.level - 1);
    if (c.fz < 8) return mod(c.fz, 3) === 0 ? lv(L, c.level - 1) : lv(L, c.level);
    return lv(L, c.level);
  };
  s.box(1.3, 8.7, 0.6, 4.3, 1, 48, wall);
  // Glass barrel vault with iron ribs.
  const vault: Material = (c) => {
    if (c.night) return mod(c.fx, 6) === 0 ? null : 'ochre3';
    if (c.edge) return 'zinc0';
    if (mod(Math.floor(c.u * 16), 6) === 0) return lv(R.metal, c.level);
    if (mod(c.fz, 5) === 0) return lv(R.metal, c.level - 1);
    return lv(R.glassSky, c.level);
  };
  s.vaultU(1.4, 8.6, 2.45, 1.6, 47, 22, vault);
  s.box(1.3, 8.7, 0.6, 1.0, 47, 50, plain(L));
  // End pavilions with the great clocks on the river (+v) face.
  const clockAt =
    (cx: number): Material =>
    (c) => {
      if (c.side === 'left') {
        const dx = c.fx + 0.5 - cx * 16;
        const dz = c.z - 52;
        const r = Math.hypot(dx, dz);
        if (r < 7) {
          const ang = Math.atan2(dz, dx);
          const hand =
            (Math.abs(ang - Math.PI / 2) < 0.12 && r < 6) || (Math.abs(ang - 0.3) < 0.15 && r < 4);
          if (c.night) return hand ? 'ink' : 'ochre4';
          if (hand) return 'ink';
          if (r > 5.6) return lv(R.gold, c.level);
          return c.level >= 3 ? 'white' : 'stone4';
        }
        if (r < 8.5) return c.night ? null : lv(R.gold, c.level - 1);
      }
      return wall(c);
    };
  for (const u0 of [0.3, 8.6]) {
    s.box(u0, u0 + 1.1, 0.5, 4.5, 1, 64, clockAt(u0 + 0.55));
    s.hip(u0 + 0.05, u0 + 1.05, 0.55, 4.45, 64, 78, 0.45, roofMat(R.zinc, undefined, 4));
    s.line(
      [
        [u0 + 0.55, 2.5, 78],
        [u0 + 0.55, 2.5, 84],
      ],
      'ochre2',
    );
  }
  // Statues on the parapet.
  const st = marbleStatue('standing', false, true);
  for (const u of [3.0, 5.0, 7.0]) s.sprite(st, 4, 19, u, 4.2, 48);
  return { scene: s, overlays: [] };
}

export const LANDMARKS_PARIS: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  obelisk: { top: 126, frames: 1, fps: 0, build: obelisk },
  concordeFountain: { top: 40, frames: 4, fps: 6, build: concordeFountain },
  eiffel: { top: 342, frames: 1, fps: 0, build: eiffel },
  invalides: { top: 186, frames: 1, fps: 0, build: invalides },
  orsay: { top: 92, frames: 1, fps: 0, build: orsay },
};
