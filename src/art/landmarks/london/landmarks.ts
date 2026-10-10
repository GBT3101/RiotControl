/**
 * Secondary landmarks of London — Westminster Abbey, Nelson's Column, London Eye,
 * Buckingham Palace, Churchill (E0: moved verbatim from
 * secondary.ts). Contract footprints: LANDMARKS in src/maps/contract.ts.
 */
import { Scene, type Material } from '../engine/scene';
import { R, lv, mod, plain } from '../engine/materials';
import { balustradeCut, column, gothicWall, roofMat } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { CHURCHILL, LION, NELSON, figure, guard } from '../props';
import { grid } from '../../lib/grid';
import { classicalWall, gravel, paving, plate, type SecondaryArt } from '../shared';

function abbey(): Build {
  const s = new Scene();
  plate(s, 7, 4, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.grass, c.level - 2);
    return lv(R.grass, c.level - (mod(c.px * 3 + c.py * 5, 11) === 0 ? 1 : 0) - 1);
  });
  const st = R.honey;
  const g = gothicWall({
    ramp: st,
    pitch: 10,
    off: 3,
    rows: [{ zTop: 38, h: 20, w: 5 }],
    top: 46,
    state: 0,
    seed: 1,
    decals: [],
  });
  const aisle = gothicWall({
    ramp: st,
    pitch: 10,
    off: 3,
    rows: [{ zTop: 20, h: 11 }],
    top: 26,
    state: 0,
    seed: 2,
    decals: [],
  });
  const roof = roofMat(R.slateLit, undefined, 3);
  // Nave + aisles.
  s.box(0.6, 5.8, 1.3, 2.7, 1, 46, g);
  s.gable(0.6, 5.8, 1.25, 2.75, 46, 62, 'u', roof);
  s.box(0.6, 5.8, 0.5, 1.3, 1, 26, aisle);
  s.box(0.6, 5.8, 2.7, 3.5, 1, 26, aisle);
  s.poly(
    [
      { nu: -1, nv: 0, nz: 0, c: -0.6 },
      { nu: 1, nv: 0, nz: 0, c: 5.8 },
      { nu: 0, nv: -1, nz: 0, c: -2.7 },
      { nu: 0, nv: 1, nz: 0, c: 3.5 },
      { nu: 0, nv: 0, nz: -1, c: -26 },
      { nu: 0, nv: 12, nz: 1, c: 34 + 12 * 2.7 },
    ],
    [0.6, 5.8, 2.7, 3.5, 26, 34],
    roof,
  );
  // Flying buttresses (thin slabs) on the front aisle.
  for (let u = 1.0; u < 5.7; u += 0.625) {
    s.box(u, u + 0.1, 2.7, 3.55, 26, 40, plain(st));
    s.prismN(u + 0.05, 3.5, 0.06, 0, 26, 36, 4, plain(R.honeyLit));
  }
  // North transept with the great rose window on its +v face.
  const transept: Material = (c) => {
    if (c.side === 'left') {
      const dx = c.fx + 0.5 - 3.3 * 16;
      const dz = c.z - 34;
      const r = Math.hypot(dx, dz);
      if (r < 9) {
        const spoke = Math.abs(mod((Math.atan2(dz, dx) * 8) / Math.PI + 0.5, 1) - 0.5) < 0.18;
        const ring = r > 4.5 && r < 5.5;
        if (c.night) return spoke || ring ? null : r < 4 ? 'pink2' : 'ochre2';
        if (spoke || ring || r > 8) return lv(R.honeyLit, c.level);
        return r < 4 ? 'plum1' : lv(R.dark, c.level);
      }
      if (Math.abs(dx) < 4 && c.z < 14 - (dx * dx) / 4)
        return c.night ? 'ochre1' : lv(R.dark, c.level);
    }
    return g(c);
  };
  s.box(2.5, 4.1, 2.7, 3.9, 1, 46, transept);
  s.gable(2.45, 4.15, 2.7, 3.95, 46, 62, 'v', roof);
  for (const u of [2.5, 4.1]) {
    s.prismN(u, 3.9, 0.12, 0.12, 1, 54, 8, plain(R.honeyLit), { rot: Math.PI / 8 });
    s.prismN(u, 3.9, 0.12, 0, 54, 64, 8, plain(st), { rot: Math.PI / 8 });
  }
  // West towers (high-u end) with the great west window between them on the +u face.
  const tower = gothicWall({
    ramp: st,
    pitch: 9,
    off: 2,
    rows: [
      { zTop: 92, h: 16, w: 5 },
      { zTop: 64, h: 12 },
    ],
    top: 100,
    state: 0,
    seed: 3,
    decals: [],
  });
  for (const v0 of [0.4, 2.6]) {
    s.box(5.8, 6.8, v0, v0 + 1.0, 1, 100, tower);
    for (const [du, dv] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      s.prismN(5.8 + du, v0 + dv, 0.1, 0.1, 96, 106, 4, plain(R.honeyLit));
      s.prismN(5.8 + du, v0 + dv, 0.1, 0, 106, 116, 4, plain(st));
    }
  }
  const westFront: Material = (c) => {
    if (c.side === 'right') {
      const dx = c.fx + 0.5 - 2.0 * 16;
      const top = 58 - (dx * dx) / 3.5;
      if (Math.abs(dx) < 6 && c.z > 26 && c.z < top) {
        const mull = mod(Math.round(dx), 2) === 0 || mod(c.fz, 6) === 0;
        if (c.night) return mull ? null : 'ochre2';
        return mull ? lv(st, c.level) : lv(R.dark, c.level);
      }
      if (Math.abs(dx) < 3.5 && c.z < 18 - (dx * dx) / 3)
        return c.night ? 'ochre1' : lv(R.dark, c.level);
    }
    return g(c);
  };
  s.box(5.8, 6.7, 1.4, 2.6, 1, 64, westFront);
  s.gable(5.8, 6.72, 1.35, 2.65, 64, 76, 'u', roof);
  return { scene: s, overlays: [] };
}

function nelson(): Build {
  const s = new Scene();
  plate(s, 2, 2, paving);
  const g = R.granite;
  s.box(0.15, 1.85, 0.15, 1.85, 1, 4, plain(g));
  s.box(0.35, 1.65, 0.35, 1.65, 4, 22, (c) => {
    if (c.night) return null;
    if (c.edge) return g[0];
    // Bronze relief panels.
    if (c.side !== 'top' && c.fz > 7 && c.fz < 18 && mod(c.fx, 26) > 6 && mod(c.fx, 26) < 20) {
      return mod(c.fx + c.fz, 3) === 0 ? lv(R.bronze, c.level + 1) : lv(R.bronze, c.level);
    }
    return lv(g, c.level);
  });
  s.box(0.3, 1.7, 0.3, 1.7, 22, 25, plain(g, { rim: true }));
  // Landseer's lions at the corners (bronze, couchant → reuse the standing lion low).
  const lion = grid(
    LION,
    { o: 'ink', k: 'ink', d: 'gray1', m: 'earth0', l: 'earth1', h: 'earth2' },
    {},
    'landseer',
  );
  s.sprite(lion, 12, 14, 0.4, 1.75, 4);
  s.sprite(lion, 12, 14, 1.75, 1.75, 4);
  // The column.
  const shaft: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return g[0];
    const flute = mod(c.sx, 2) === 0 && c.lambert < 0.55;
    if (!c.shadow && c.lambert > 0.6) return R.portland[4];
    return lv(R.portland, c.level - (flute ? 1 : 0));
  };
  s.cyl(1.0, 1.0, 0.28, 25, 32, plain(R.portland, { rim: true }));
  s.cyl(1.0, 1.0, 0.2, 32, 128, shaft);
  s.cone(1.0, 1.0, 0.2, 0.3, 128, 136, plain(R.bronze));
  s.box(0.72, 1.28, 0.72, 1.28, 136, 139, plain(R.bronze));
  s.cyl(1.0, 1.0, 0.18, 139, 143, plain(R.portland));
  s.sprite(figure(NELSON, 'stone', 'nelson'), 2, 8, 1.0, 1.0, 143);
  return { scene: s, overlays: [] };
}

/** The London Eye, face-on; `frame` rotates the wheel (32 capsules, 8 frames per capsule step). */
function londonEye(frame: number): Build {
  const s = new Scene();
  plate(s, 4, 4, paving);
  const n = 8;
  const C: [number, number] = [2.0, 2.0];
  const zc = 104;
  const Rr = 88;
  const pt = (a: number, r: number): [number, number, number] => [
    C[0] + (r * Math.cos(a)) / 32,
    C[1] - (r * Math.cos(a)) / 32,
    zc + r * Math.sin(a),
  ];
  // A-frame legs behind the wheel (lower u + v = farther).
  for (const off of [-0.03, 0, 0.03]) {
    s.line(
      [
        [0.4 + off, 2.2 - off, 1],
        [C[0] - 0.3, C[1] - 0.3, zc],
      ],
      off === 0 ? 'white' : 'gray6',
      { bias: 0.8 },
    );
    s.line(
      [
        [2.2 + off, 0.4 - off, 1],
        [C[0] - 0.3, C[1] - 0.3, zc],
      ],
      off === 0 ? 'gray6' : 'gray5',
      { bias: 0.8 },
    );
  }
  // Rim (double ring), spokes, capsules.
  const rot = (frame / n) * ((2 * Math.PI) / 32);
  const ring = (r: number, col: string): void => {
    const pts: Array<[number, number, number]> = [];
    for (let k = 0; k <= 160; k++) pts.push(pt((k / 160) * Math.PI * 2, r));
    s.line(pts, col, { emit: col === 'white' ? 'blue2' : 'pink2' });
  };
  ring(Rr, 'white');
  ring(Rr - 3, 'gray6');
  for (let k = 0; k < 16; k++) {
    const a = rot * 0 + (k / 16) * Math.PI * 2 + rot;
    s.line([pt(a, 4), pt(a, Rr - 3)], 'gray4', { bias: -0.05 });
  }
  const capsule = grid(
    `
    .oo.
    oGgo
    ogGo
    oggo
    .oo.
    `,
    { o: 'gray4', g: 'glass.2', G: 'white' },
    {},
    'capsule',
  );
  const capsuleNight = grid(
    `
    ....
    .ss.
    .ss.
    .ss.
    ....
    `,
    { s: 'sky' },
    {},
    'capsuleNight',
  );
  for (let k = 0; k < 32; k++) {
    const a = rot + (k / 32) * Math.PI * 2;
    const p = pt(a, Rr + 3);
    s.sprite(capsule, 2, 2, p[0], p[1], p[2], { bias: 0.1, emit: capsuleNight });
  }
  // Hub.
  s.cyl(C[0], C[1], 0.18, zc - 4, zc + 4, plain(R.whiteSteel));
  // Boarding platform.
  s.box(1.0, 3.0, 2.6, 3.4, 1, 4, plain(R.granite, { rim: true }));
  return { scene: s, overlays: [] };
}

function buckingham(): Build {
  const s = new Scene();
  plate(s, 10, 5, gravel);
  const p = R.portland;
  const wall = classicalWall({ ramp: p, pitch: 8, off: 3, rows: [36, 24, 12], top: 44, base: 14 });
  s.box(0.3, 9.7, 0.4, 3.6, 1, 44, wall);
  s.hip(0.5, 9.5, 0.6, 3.4, 44, 49, 0.8, roofMat(R.slate, undefined, 3));
  const bal: Material = (c) => (c.night ? null : c.edge ? p[0] : lv(p, c.level));
  s.box(0.3, 9.7, 3.45, 3.6, 44, 48, bal, { cut: balustradeCut(44, 48) });
  s.box(9.55, 9.7, 0.4, 3.6, 44, 48, bal, { cut: balustradeCut(44, 48) });
  // Corner pavilions.
  for (const u0 of [0.3, 8.5]) s.box(u0, u0 + 1.2, 0.4, 3.85, 1, 47, wall);
  // Central portico with six attached columns and pediment.
  s.box(3.8, 6.2, 3.6, 3.9, 1, 14, plain(p));
  for (let k = 0; k < 6; k++) {
    column(s, { u: 4.0 + k * 0.4, v: 3.85, z0: 14, z1: 40, r: 0.1, ramp: p });
  }
  s.box(3.75, 6.25, 3.6, 4.0, 40, 45, plain(p, { rim: true }));
  s.gable(3.75, 6.25, 3.6, 4.0, 45, 54, 'v', (c) =>
    c.side === 'left' ? (c.night ? null : c.edge ? p[0] : lv(p, c.level)) : roofMat(R.slateLit)(c),
  );
  // The balcony.
  s.box(4.3, 5.7, 3.9, 4.1, 14, 15, plain(p, { rim: true }));
  s.line(
    [
      [4.3, 4.1, 17],
      [5.7, 4.1, 17],
    ],
    'ink',
  );
  // Railings + gilded gates along the front, guards in sentry boxes.
  for (let u = 0.2; u < 9.9; u += 0.125) {
    const gate = Math.abs(u - 5.0) < 0.6 || Math.abs(u - 2.0) < 0.3 || Math.abs(u - 8.0) < 0.3;
    s.line(
      [
        [u, 4.85, 1],
        [u, 4.85, gate ? 9 : 6],
      ],
      gate ? 'ochre2' : 'ink',
    );
  }
  s.line(
    [
      [0.2, 4.85, 6],
      [9.9, 4.85, 6],
    ],
    'ink',
  );
  for (const u of [3.4, 6.6]) {
    s.box(u - 0.2, u + 0.2, 4.2, 4.6, 1, 14, plain(R.portland));
    s.gable(u - 0.24, u + 0.24, 4.16, 4.64, 14, 18, 'v', plain(R.slate));
    s.sprite(guard(), 1, 9, u, 4.68, 1);
  }
  s.line(
    [
      [5.0, 2.0, 50],
      [5.0, 2.0, 82],
    ],
    'gray2',
  );
  return { scene: s, overlays: [{ sprite: 'lm.flag.uk', u: 5.0, v: 2.0, z: 82, flag: true }] };
}

function churchill(): Build {
  const s = new Scene();
  plate(s, 1, 1, (c) => (c.night ? null : lv(R.grass, c.level - 1)));
  const g = R.granite;
  s.box(0.15, 0.85, 0.15, 0.85, 1, 18, plain(g, { rim: true }));
  s.sprite(figure(CHURCHILL, 'bronze', 'churchill'), 4, 12, 0.5, 0.5, 18);
  return { scene: s, overlays: [] };
}

export const LANDMARKS_LONDON: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  abbey: { top: 120, frames: 1, fps: 0, build: abbey },
  nelson: { top: 156, frames: 1, fps: 0, build: nelson },
  londonEye: { top: 200, frames: 8, fps: 2, side: 30, build: londonEye },
  buckingham: { top: 100, frames: 1, fps: 0, build: buckingham },
  churchill: { top: 34, frames: 1, fps: 0, build: churchill },
};
