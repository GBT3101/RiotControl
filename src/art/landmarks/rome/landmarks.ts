/**
 * Secondary landmarks of Rome — Pantheon, Fontana di Trevi, Vittoriano, Colosseo (edge).
 * Contract footprints: LANDMARKS in src/maps/contract.ts. Fronts face +v (the lit SW face).
 */
import { Scene, type Material, type ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, plain, type Ramp5 } from '../engine/materials';
import { balustradeCut, column, stairs, stepMat, textGrid } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { figure, marbleStatue } from '../props';
import { classicalWall, plate, type SecondaryArt } from '../shared';
import { S, coppi, ellCyl, ellR, ovalBasin, sampietrini, slabs } from './common';
import { EQUESTRIAN, NICHE_FIGURE, OCEANUS, QUADRIGA } from './figures.grid';

const T = S.travertine;
/** Pantheon brick rotunda (weathered Roman brick, once stucco-clad). */
const BRICK: Ramp5 = ['earth0', 'earth1', 'earth2', 'earth3', 'stone2'];
/** Lead-sheathed dome. */
const LEAD: Ramp5 = ['ink', 'gray2', 'gray3', 'gray4', 'gray5'];
/** Botticino marble (Vittoriano): very white. */
const BOTTICINO: Ramp5 = ['gray3', 'gray5', 'gray6', 'gray7', 'white'];

// ---------------------------------------------------------------------------------------------
// Pantheon (5 × 4): portico of grey granite columns, "M AGRIPPA" frieze, brick rotunda, dome.
// ---------------------------------------------------------------------------------------------

const AGRIPPA = textGrid('M AGRIPPA');
const PATRIAE = textGrid('PATRIAE UNITATI');

function pantheon(): Build {
  const s = new Scene();
  plate(s, 5, 4, sampietrini);
  const C = { u: 2.5, v: 1.62 };
  // Rotunda: brick with three cornice rings and blind relieving arches.
  const rot: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return BRICK[0];
    const z = c.fz;
    if (z === 15 || z === 30 || z >= 41) return lv(T, c.level - (z === 15 ? 1 : 0));
    if (z === 14 || z === 29) return lv(BRICK, c.level - 1);
    const a = Math.atan2(c.v - C.v, c.u - C.u);
    const k = mod((a * 6) / Math.PI, 1);
    // Relieving arches in the brickwork of the middle band.
    if (z > 18 && z < 27) {
      const dx = (k - 0.5) * 18;
      if (Math.abs(Math.hypot(dx, z - 20) - 6) < 0.6 && z > 20) return lv(BRICK, c.level - 1);
    }
    return lv(BRICK, c.level - (mod(z, 3) === 0 && hash(c.px >> 2, z) < 0.5 ? 1 : 0));
  };
  s.cyl(C.u, C.v, 1.55, 1, 42, rot);
  // Stepped rings at the dome's foot.
  const ring = plain(T, { rim: true });
  s.cyl(C.u, C.v, 1.48, 42, 45, ring);
  s.cyl(
    C.u,
    C.v,
    1.4,
    45,
    48,
    plain(['stone0', 'gray3', 'gray4', 'gray5', 'gray6'], { rim: true }),
  );
  s.cyl(
    C.u,
    C.v,
    1.32,
    48,
    51,
    plain(['stone0', 'gray3', 'gray4', 'gray5', 'gray6'], { rim: true }),
  );
  // The dome with its oculus.
  const dome: Material = (c) => {
    const r = Math.hypot(c.u - C.u, c.v - C.v);
    if (c.night) return r < 0.2 ? 'ochre1' : null;
    if (r < 0.17) return 'ink';
    if (r < 0.24) return lv(T, c.level);
    if (c.edge) return LEAD[0];
    const a = Math.atan2(c.v - C.v, c.u - C.u);
    const seam = Math.abs(mod((a * 16) / Math.PI, 1) - 0.5) < 0.1;
    return lv(LEAD, c.level + (c.rim ? 1 : 0) - (seam ? 1 : 0));
  };
  s.ell(C.u, C.v, 50, 1.3, 1.3, 20, dome, { zMin: 50 });

  // Intermediate block with its upper pediment.
  const block: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return BRICK[0];
    if (c.side === 'top') return lv(LEAD, c.level);
    if (c.fz >= 44) return lv(T, c.level + (c.fz >= 46 ? 1 : 0));
    if (c.side === 'left') {
      // Bronze doors in the deep portico shade.
      const dx = Math.abs(c.fx + 0.5 - 40);
      if (dx < 5 && c.fz < 26) {
        if (dx >= 4 || c.fz >= 25) return lv(T, 2);
        return mod(c.fx, 3) === 0 || mod(c.fz, 6) === 0 ? 'earth0' : lv(R.bronze, 2);
      }
      return lv(T, Math.min(c.level, 2) - 1);
    }
    return lv(BRICK, c.level);
  };
  s.box(1.15, 3.85, 2.75, 3.25, 1, 48, block, { tag: 'block' });
  s.gable(1.15, 3.85, 2.75, 3.25, 48, 60, 'v', (c) =>
    c.side === 'left'
      ? c.night
        ? null
        : c.edge
          ? T[0]
          : lv(T, c.level - (c.rim ? 0 : 1))
      : lv(LEAD, c.level),
  );

  // Portico: podium, steps, eight granite columns, frieze with the inscription, pediment.
  s.box(1.15, 3.85, 3.25, 3.75, 1, 4, plain(T));
  stairs(s, 1.3, 3.7, 3.95, 3.75, 1, 4, 2, stepMat(T));
  const granite: Ramp5 = ['ink', 'gray2', 'gray3', 'gray4', 'gray6'];
  for (let k = 0; k < 8; k++) {
    column(s, { u: 1.36 + k * 0.326, v: 3.6, z0: 4, z1: 34, r: 0.1, ramp: granite, tag: 'col' });
  }
  for (const u of [1.36, 3.64]) {
    column(s, {
      u,
      v: 3.32,
      z0: 4,
      z1: 34,
      r: 0.1,
      ramp: ['ink', 'gray1', 'gray2', 'gray3', 'gray4'],
    });
  }
  const frieze: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return T[0];
    if (c.side === 'top') return lv(T, c.level);
    const z = c.fz;
    if (z >= 39) return lv(T, c.level + 1);
    if (z === 38) return lv(T, c.level - 1);
    if (c.side === 'left') {
      const tx = c.fx - Math.round(2.5 * 16 - AGRIPPA.w / 2);
      const ty = 37 - z;
      if (tx >= 0 && ty >= 0 && tx < AGRIPPA.w && ty < AGRIPPA.h && AGRIPPA.rows[ty]![tx] === 't')
        return lv(R.bronze, 2);
    }
    if (z <= 33) return lv(T, c.level - 1);
    return lv(T, c.level);
  };
  s.box(1.15, 3.85, 3.25, 3.78, 34, 41, frieze);
  const ped: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return T[0];
    if (c.side !== 'left') return lv(LEAD, c.level);
    const apexZ = 52 - (Math.abs(c.u - 2.5) / 1.35) * 11;
    const fromTop = apexZ - c.z;
    if (fromTop < 1.5) return lv(T, c.level + 1);
    if (fromTop < 2.5) return lv(T, c.level - 2);
    if (c.fz <= 42) return lv(T, c.level + (c.fz === 42 ? -2 : 1));
    return lv(T, c.level - 1 - (hash(c.fx >> 1, c.fz >> 1) < 0.3 ? 1 : 0));
  };
  s.gable(1.15, 3.85, 3.25, 3.8, 41, 52, 'v', ped);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Fontana di Trevi (4 × 3): Palazzo Poli, triumphal-arch centre with Oceanus, rocks, basin.
// ---------------------------------------------------------------------------------------------

const ROCKS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  // u0, u1, v0, v1, top z
  [0.35, 1.25, 0.85, 1.55, 10],
  [0.9, 1.7, 0.95, 1.75, 14],
  [1.55, 2.45, 1.0, 1.7, 18],
  [2.3, 3.1, 0.95, 1.75, 13],
  [2.85, 3.65, 0.85, 1.55, 9],
  [1.2, 2.0, 1.45, 2.0, 7],
  [2.1, 2.9, 1.45, 2.05, 6],
  [0.6, 1.2, 1.4, 1.95, 4],
  [3.0, 3.5, 1.45, 1.9, 4],
];

function rockMat(c: ShadeCtx): string | null {
  if (c.night) return null;
  if (c.edge) return T[0];
  const h = hash(Math.floor(c.u * 10), Math.floor(c.v * 10), Math.floor(c.z / 3));
  if (c.side === 'top' && h < 0.18) return lv(R.grass, c.level - 2);
  return lv(T, c.level - (h < 0.4 ? 1 : 0) + (c.rim && c.level >= 3 ? 1 : 0));
}

function trevi(frame: number): Build {
  const s = new Scene();
  plate(s, 4, 3, sampietrini);
  // Palazzo Poli: travertine palace face with three window storeys either side.
  const palace = classicalWall({
    ramp: T,
    pitch: 9,
    off: 3,
    rows: [44, 32, 21],
    top: 50,
    base: 12,
  });
  s.box(0.05, 3.95, 0.05, 0.85, 1, 50, palace);
  s.box(0.05, 3.95, 0.79, 0.85, 50, 54, plain(T), { cut: balustradeCut(50, 54) });
  s.hip(0.1, 3.9, 0.08, 0.8, 50, 56, 0.35, coppi());
  // Central triumphal arch: the great niche (exedra) for Oceanus between paired columns.
  const NX = 32;
  const arch: Material = (c) => {
    if (c.night)
      return c.side === 'left' && Math.abs(c.fx + 0.5 - NX) < 6 && c.fz < 36 && c.fz > 13
        ? 'ochre1'
        : null;
    if (c.edge) return T[0];
    if (c.side === 'top') return lv(T, c.level);
    const z = c.fz;
    if (z >= 58) return lv(T, c.level + 1);
    if (z >= 48) {
      // Attic with the dedication.
      if (c.side === 'left' && z >= 51 && z <= 54 && Math.abs(c.fx - NX) < 10)
        return mod(c.fx, 2) && z !== 51 && z !== 54 ? lv(T, c.level - 2) : lv(T, c.level - 1);
      return lv(T, c.level);
    }
    if (c.side === 'left') {
      const dx = c.fx + 0.5 - NX;
      // Great niche: coffered half-dome, deep shade around Oceanus.
      if (Math.abs(dx) < 6 && z > 13 && (z < 34 || Math.hypot(dx, z - 34) < 6)) {
        if (z >= 34) return mod(Math.round(Math.atan2(z - 34, dx) * 4), 2) ? 'stone1' : 'stone0';
        return Math.abs(dx) > 4 ? 'stone1' : 'stone0';
      }
      if (Math.abs(dx) < 7.5 && z > 13 && (z < 34 || Math.hypot(dx, z - 34) < 7.5))
        return lv(T, c.level + 1);
      // Side niches with the allegories, reliefs above.
      for (const nx of [21, 43]) {
        const ddx = c.fx + 0.5 - nx;
        if (Math.abs(ddx) < 2.5 && z > 16 && (z < 26 || Math.hypot(ddx, z - 26) < 2.5))
          return 'stone1';
        if (Math.abs(ddx) < 3.5 && z > 32 && z < 40)
          return lv(T, c.level - (hash(c.fx, z) < 0.4 ? 1 : 0));
      }
    }
    return lv(T, c.level);
  };
  s.box(1.25, 2.75, 0.85, 1.05, 1, 58, arch);
  for (const u of [1.32, 1.6, 2.4, 2.68]) {
    column(s, { u, v: 1.1, z0: 14, z1: 45, r: 0.075, ramp: T, tag: 'col' });
  }
  s.box(1.2, 2.8, 0.85, 1.17, 45, 48, plain(T, { rim: true }));
  // Attic statues and the papal arms crowning the centre.
  const nf = figure(NICHE_FIGURE, 'marble', 'trevi.niche');
  for (const u of [1.32, 1.6, 2.4, 2.68]) s.sprite(nf, 1, 8, u, 1.0, 58);
  s.box(1.82, 2.18, 0.88, 1.0, 58, 64, plain(T, { rim: true }));
  s.ell(2.0, 0.95, 66, 0.12, 0.09, 3, plain(R.gold, { rim: true }));
  // Allegories in the side niches.
  s.sprite(nf, 1, 8, 21 / 16, 1.07, 17);
  s.sprite(nf, 1, 8, 43 / 16, 1.07, 17);

  // The scogli (rocks), Oceanus and his sea-horses on top.
  for (const [u0, u1, v0, v1, z] of ROCKS) {
    s.hip(
      u0,
      u1,
      v0,
      v1,
      1,
      z,
      [Math.min(0.3, (u1 - u0) / 2.2), Math.min(0.25, (v1 - v0) / 2.2)],
      rockMat,
      {
        tag: 'rock',
      },
    );
  }
  s.sprite(figure(OCEANUS, 'marble', 'oceanus'), 12, 17, 2.0, 1.3, 15, { bias: 0.4 });

  // Basin: a broad oval with rippling water, the falls pouring off the rocks.
  ovalBasin(s, 2.0, 1.95, 1.9, 0.98, 4, frame, 4, T, 0.1);
  const fall = (u: number, v: number, z0: number, z1: number, phase: number): void => {
    for (let z = z1; z > z0; z -= 1) {
      const on = mod(z + frame * 2 + phase, 5);
      if (on === 4) continue;
      s.line(
        [
          [u, v, z],
          [u + 0.04, v + 0.02, z - 1],
        ],
        on === 0 ? 'white' : on === 2 ? 'blue2' : 'sky',
        { emit: 'sky', bias: 0.3 },
      );
    }
  };
  for (let k = 0; k < 7; k++) fall(1.75 + k * 0.08, 1.75, 2, 10, k * 2);
  fall(1.0, 1.58, 2, 11, 1);
  fall(1.06, 1.6, 2, 11, 3);
  fall(3.0, 1.62, 2, 10, 2);
  fall(2.94, 1.6, 2, 10, 4);
  fall(1.45, 2.0, 2, 6, 0);
  fall(2.55, 2.06, 2, 6, 3);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Vittoriano (10 × 6): white terraces, grand stair, equestrian king, concave colonnade between
// two propylaea crowned with bronze quadrigas.
// ---------------------------------------------------------------------------------------------

function vittoriano(): Build {
  const s = new Scene();
  const marblePave = slabs(['gray4', 'gray5', 'gray6', 'gray7', 'white'], 2);
  plate(s, 10, 6, (c) => (c.v > 5.0 ? sampietrini(c) : marblePave(c)));
  const B = BOTTICINO;
  const terrace: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return B[0];
    if (c.side === 'top') return lv(B, c.level - (mod(c.u * 2, 1) < 0.05 ? 1 : 0));
    const z = c.fz;
    if (z === 1) return lv(B, c.level - 1);
    if (mod(z, 4) === 0) return lv(B, c.level - 1);
    return lv(B, c.level);
  };
  const reliefBand: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'left' && c.fz >= 18 && c.fz <= 24 && (c.u < 3.0 || c.u > 7.0)) {
      // Long sculpted frieze along the second terrace.
      // Regular relief panels: framed, with figures in low relief.
      const loc = mod(c.fx, 12);
      if (loc === 0 || c.fz === 18 || c.fz === 24) return lv(B, c.level - 1);
      return lv(B, c.level - (mod(c.fx + (c.fz >> 1), 4) === 0 && c.fz > 19 && c.fz < 23 ? 1 : 0));
    }
    return terrace(c);
  };
  // Lower terrace and the first flight.
  s.box(0.3, 9.7, 0.3, 4.9, 1, 10, terrace);
  stairs(s, 3.4, 6.6, 5.9, 4.9, 1, 10, 5, stepMat(B));
  // Upper terrace (sculpted frieze), second flight.
  s.box(0.8, 9.2, 0.3, 3.7, 10, 30, reliefBand);
  stairs(s, 3.9, 6.1, 4.9, 3.7, 10, 30, 8, stepMat(B));
  // Side fountains (Adriatic / Tyrrhenian) at the foot.
  ovalBasin(s, 1.4, 5.4, 0.85, 0.45, 4, 0, 4, B, 0.1);
  ovalBasin(s, 8.6, 5.4, 0.85, 0.45, 4, 0, 4, B, 0.1);
  // Victor Emmanuel II on his pedestal.
  s.box(4.45, 5.55, 2.85, 3.55, 30, 36, plain(B));
  s.box(4.6, 5.4, 2.95, 3.45, 36, 48, (c) => {
    if (c.night) return null;
    if (c.edge) return B[0];
    if (c.side !== 'top' && c.fz > 40 && c.fz < 45 && mod(c.fx, 8) > 1)
      return lv(R.bronze, c.level + (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
    return lv(B, c.level);
  });
  s.box(4.55, 5.45, 2.9, 3.5, 48, 50, plain(B, { rim: true }));
  s.sprite(figure(EQUESTRIAN, 'bronze', 'vittorio'), 9, 14, 5.0, 3.2, 50, { bias: 0.2 });
  // Statues on the terrace edges.
  const st = marbleStatue('standing');
  for (const u of [3.75, 6.25]) {
    s.box(u - 0.15, u + 0.15, 4.75, 5.05, 10, 16, plain(B));
    s.sprite(st, 4, 19, u, 4.9, 16);
  }

  // Concave colonnade: back wall, sixteen columns on a curve, segmented entablature, attic.
  const back: Material = (c) => {
    if (c.night)
      return c.side === 'left' && c.fz > 36 && c.fz < 66 && mod(c.fx, 8) < 4 ? 'ochre1' : null;
    if (c.edge) return B[0];
    if (c.side === 'top') return lv(B, c.level);
    if (c.side === 'left') return lv(B, 1 - (mod(c.fx, 8) < 4 && c.fz > 36 && c.fz < 66 ? 1 : 0));
    return lv(B, c.level);
  };
  s.box(2.0, 8.0, 0.4, 1.1, 30, 70, back);
  const curve = (u: number): number => 1.32 + 0.4 * ((u - 5) / 3.0) ** 2;
  const n = 16;
  for (let k = 0; k < n; k++) {
    const u = 2.2 + (k * 5.6) / (n - 1);
    column(s, { u, v: curve(u), z0: 30, z1: 68, r: 0.11, ramp: B, tag: 'col' });
  }
  const ent: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return B[0];
    if (c.side === 'top') return lv(B, c.level);
    if (c.side === 'left' && c.u > 2 && c.u < 8) {
      const tx = c.fx - Math.round(5 * 16 - PATRIAE.w / 2);
      const ty = 76 - c.fz;
      if (tx >= 0 && ty >= 0 && tx < PATRIAE.w && ty < PATRIAE.h && PATRIAE.rows[ty]![tx] === 't')
        return lv(R.gold, c.level - 1);
    }
    if (c.fz >= 78) return lv(B, c.level + 1);
    if (c.fz === 77) return lv(B, c.level - 2);
    if (c.fz <= 69) return lv(B, c.level - 1);
    return lv(B, c.level);
  };
  for (let k = 0; k < 8; k++) {
    const u0 = 2.0 + k * 0.75;
    const vf = curve(u0 + 0.375) + 0.14;
    s.box(u0, u0 + 0.75, 0.4, vf, 68, 80, ent);
    s.box(u0, u0 + 0.75, vf - 0.1, vf, 80, 84, plain(B), { cut: balustradeCut(80, 84) });
  }
  // The two propylaea with pediments and quadrigas.
  const prop: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return B[0];
    if (c.side === 'top') return lv(B, c.level);
    if (c.fz >= 84) return lv(B, c.level + (c.fz >= 86 ? 0 : 1));
    if (c.fz === 83) return lv(B, c.level - 2);
    if (c.side === 'left') {
      const loc = mod(c.fx - 4, 18);
      if (c.fz > 34 && c.fz < 76 && loc > 6 && loc < 12) return lv(B, Math.min(c.level, 2) - 1);
    }
    return lv(B, c.level);
  };
  for (const u0 of [0.8, 8.0]) {
    s.box(u0, u0 + 1.2, 0.3, 2.2, 30, 88, prop);
    for (let k = 0; k < 4; k++)
      column(s, { u: u0 + 0.15 + k * 0.3, v: 2.35, z0: 30, z1: 80, r: 0.1, ramp: B });
    s.box(u0 - 0.05, u0 + 1.25, 2.2, 2.5, 80, 88, ent);
    s.gable(u0 - 0.05, u0 + 1.25, 0.3, 2.5, 88, 96, 'u', (c) =>
      c.side === 'right' || c.side === 'left'
        ? c.night
          ? null
          : lv(B, c.level - 1)
        : c.night
          ? null
          : lv(B, c.level),
    );
    s.box(u0 + 0.35, u0 + 0.85, 1.15, 1.6, 96, 100, plain(B, { rim: true }));
    s.sprite(figure(QUADRIGA, 'bronze', 'quadriga'), 13, 20, u0 + 0.6, 1.4, 100, { bias: 0.3 });
  }
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Colosseo (10 × 8, edge): the four-tier arcaded ellipse, its broken outer ring on the +u side
// revealing the inner ring, the cavea and the hypogeum.
// ---------------------------------------------------------------------------------------------

const CO = { u: 5.0, v: 4.0, ru: 4.75, rv: 3.85 };
const TIERS = [1, 24, 46, 68, 88];
/** Arc-length (face px) along the ellipse at angle th. */
const PERIM =
  Math.PI * (3 * (CO.ru + CO.rv) - Math.sqrt((3 * CO.ru + CO.rv) * (CO.ru + 3 * CO.rv))) * 16;
const ARCHES = 48;
const PITCH = PERIM / ARCHES;

function theta(u: number, v: number): number {
  return Math.atan2((v - CO.v) / CO.rv, (u - CO.u) / CO.ru);
}
/** Broken sector of the outer ring (+u side): wall height left there (88 = intact). */
function outerTop(th: number): number {
  const a0 = -1.05;
  const a1 = 0.75;
  if (th <= a0 || th >= a1) return 88;
  const d = Math.min(th - a0, a1 - th);
  if (d > 0.34) return 0;
  // Stepped, ragged descent toward the gap.
  const step = Math.floor((d / 0.34) * 4);
  return Math.max(0, TIERS[4 - step]! - 4 + Math.round(Math.sin(th * 53) * 2));
}

/** Arcade painter for an elliptic wall: arches per tier, half-columns, attic windows. */
function arcade(c: ShadeCtx, ramp: Ramp5, tiers: number, inner = false): string | null {
  const th = theta(c.u, c.v);
  const s = (th / (Math.PI * 2)) * PERIM;
  const loc = mod(s, PITCH);
  const z = c.fz;
  let t = 0;
  while (t < 3 && z >= TIERS[t + 1]!) t++;
  const zb = TIERS[t]!;
  const zt = TIERS[t + 1]!;
  const weather = hash(Math.floor(s / 6), Math.floor(z / 7), 2) < 0.25 ? -1 : 0;
  if (t >= tiers) return null;
  if (t < 3 || inner) {
    // Arch opening.
    const dx = loc - PITCH / 2;
    const top = zb + 12;
    if (z > zb + 2 && Math.abs(dx) < 2.6 && (z < top || Math.hypot(dx, z - top) < 2.6)) {
      if (c.night) return null;
      return z < zb + 5 ? lv(ramp, 1) : 'stone0';
    }
    if (z > zb + 2 && Math.abs(dx) < 3.6 && (z < top || Math.hypot(dx, z - top) < 3.6))
      return c.night ? null : lv(ramp, c.level + (z >= top ? 1 : 0) + weather);
  } else {
    // Attic: small square windows every other bay, Corinthian pilasters, corbels.
    const dx = loc - PITCH / 2;
    const odd = mod(Math.floor(s / PITCH), 2) === 0;
    if (odd && Math.abs(dx) < 1.6 && z > zb + 6 && z < zb + 10) return c.night ? null : 'stone0';
    if (z === zt - 5 && mod(Math.floor(loc), 3) === 0)
      return c.night ? null : lv(ramp, c.level - 2);
  }
  if (c.night) return null;
  if (c.edge) return ramp[0];
  // Entablature bands.
  if (z >= zt - 3) return lv(ramp, c.level + (z === zt - 3 ? -1 : 0) + weather);
  // Half-columns between the arches.
  if (loc < 1.2 || loc > PITCH - 1.2) return lv(ramp, c.level + (loc < 1.2 ? 1 : -1));
  return lv(ramp, c.level + weather);
}

function colosseum(): Build {
  const s = new Scene();
  plate(s, 10, 8, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.gravel, c.level - 1);
    const r = ellR(c.u, c.v, CO.u, CO.v, CO.ru, CO.rv);
    if (r > 1.08 && hash(Math.floor(c.u * 3), Math.floor(c.v * 3), 4) < 0.35)
      return lv(R.grass, c.level - 1 - (mod(c.px + c.py, 5) === 0 ? 1 : 0));
    return slabs(['stone0', 'stone1', 'stone2', 'stone3', 'stone4'], 2)(c);
  });
  const TV = T;
  const TUFA: Ramp5 = ['earth0', 'earth1', 'earth2', 'earth3', 'earth4'];
  const kIn = 0.92;
  // Outer ring.
  const outer: Material = (c) => {
    if (c.side === 'back') {
      if (c.night) return null;
      // Inside face of the outer wall: dark galleries.
      const a = arcade(c, ['stone0', 'stone0', 'stone1', 'stone2', 'stone2'], 4, true);
      return a ?? lv(TUFA, 1);
    }
    if (c.side === 'top')
      return c.night ? null : lv(TV, c.level - (hash(c.px, c.py) < 0.3 ? 1 : 0));
    // Broken ends: rough brick buttress faces.
    const th = theta(c.u, c.v);
    if (outerTop(th) < 88 && c.fz > outerTop(th) - 6)
      return c.night ? null : lv(S.redBrick, c.level - 1);
    return arcade(c, TV, 4) ?? lv(TV, c.level);
  };
  ellCyl(s, CO.u, CO.v, CO.ru, CO.rv, 1, 88, outer, {
    cut: (u, v, z, f) => {
      const r = ellR(u, v, CO.u, CO.v, CO.ru, CO.rv);
      if ((f === 0 || f === 1) && r < kIn) return true;
      return z > outerTop(theta(u, v));
    },
  });
  // Inner ring (second ambulatory wall), ragged top, seen where the outer ring is gone.
  const k2 = 0.86;
  const innerTop = (u: number, v: number): number =>
    54 + Math.round(Math.sin(theta(u, v) * 40) * 2 + Math.cos(theta(u, v) * 17) * 3);
  const inner: Material = (c) => {
    if (c.side === 'back') return c.night ? null : lv(TUFA, 1);
    if (c.side === 'top') return c.night ? null : lv(TV, c.level - 1);
    if (c.fz > innerTop(c.u, c.v) - 3) return c.night ? null : lv(S.redBrick, c.level);
    return (
      arcade(c, ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'], 3, true) ?? lv(TV, c.level - 1)
    );
  };
  ellCyl(s, CO.u, CO.v, CO.ru * k2, CO.rv * k2, 1, 58, inner, {
    cut: (u, v, z, f) => {
      const r = ellR(u, v, CO.u, CO.v, CO.ru * k2, CO.rv * k2);
      if ((f === 0 || f === 1) && r < 0.9) return true;
      return z > innerTop(u, v);
    },
  });
  // Cavea: stepped brick / tufa rings descending to the arena.
  const rings: ReadonlyArray<readonly [number, number]> = [
    [0.77, 46],
    [0.7, 38],
    [0.63, 29],
    [0.57, 20],
  ];
  rings.forEach(([k, z], i) => {
    const next = rings[i + 1]?.[0] ?? 0.52;
    const mat: Material = (c) => {
      if (c.night) return null;
      if (c.side === 'top') {
        // Ruined seating: brick stubs of radial walls between grassy patches.
        const th = theta(c.u, c.v);
        const radial = mod((th * 30) / Math.PI, 1) < 0.18;
        if (radial) return lv(S.redBrick, c.level - 1);
        return hash(Math.floor(th * 40), i, 5) < 0.3 ? lv(R.grass, c.level - 2) : lv(TUFA, c.level);
      }
      if (c.edge) return TUFA[0];
      // Riser: vault openings.
      const th = theta(c.u, c.v);
      const loc = mod((th * 30) / Math.PI, 1);
      if (loc > 0.35 && loc < 0.65 && mod(c.fz, 9) > 2) return 'earth0';
      return lv(S.redBrick, c.level - 1);
    };
    ellCyl(s, CO.u, CO.v, CO.ru * k, CO.rv * k, 1, z, mat, {
      cut: (u, v, _z, f) =>
        (f === 0 || f === 1) && ellR(u, v, CO.u, CO.v, CO.ru * k, CO.rv * k) < next / k,
      tag: 'cavea',
    });
  });
  // Arena: half reconstructed wooden floor, half the open hypogeum maze.
  const arena: Material = (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(S.redBrick, c.level - 1);
    if (c.u < CO.u - 0.6) return lv(R.eiffel, c.level - (mod(c.v * 16, 3) < 1 ? 1 : 0));
    const a = mod(c.u * 5, 1);
    const b = mod(c.v * 4 + (mod(Math.floor(c.u * 5), 2) ? 0.5 : 0), 1);
    if (a < 0.28 || b < 0.18) return lv(S.redBrick, c.level - (a < 0.28 ? 0 : 1));
    return 'earth0';
  };
  ellCyl(s, CO.u, CO.v, CO.ru * 0.52, CO.rv * 0.52, 1, 7, arena, { tag: 'arena' });
  return { scene: s, overlays: [] };
}

export const LANDMARKS_ROME: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  pantheon: { top: 80, frames: 1, fps: 0, build: pantheon },
  trevi: { top: 74, frames: 4, fps: 6, build: trevi },
  vittoriano: { top: 128, frames: 1, fps: 0, build: vittoriano },
  colosseum: { top: 96, frames: 1, fps: 0, build: colosseum },
};
