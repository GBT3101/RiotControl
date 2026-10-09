/**
 * Paris — Palais Bourbon (Assemblée nationale). Footprint 11 (u) × 7 (v). The dodecastyle
 * Corinthian portico, the broad stair with its marble statues and the tricolour face +v
 * (the Seine / Pont de la Concorde side).
 */
import { Scene, type Material } from './engine/scene';
import { R, hash, lv, mod, mod_, moduleColour, plain, sampleModule } from './engine/materials';
import {
  balustradeCut,
  banner,
  rubble,
  column,
  decalAt,
  paintWindow,
  roofMat,
  scatterDecals,
  scorchZones,
  soot,
  stairs,
  stepMat,
  textGrid,
  windowStatus,
  type DamageState,
} from './engine/kit';
import type { Build, Overlay } from './types';
import { lamp, marbleStatue } from './props';

export const BOURBON_W = 11;
export const BOURBON_D = 7;

const L = R.lime;

const WIN = mod_(
  `
  ..PPP..
  PpppppP
  .FFFFF.
  .FgGgF.
  .FgggF.
  .FmmmF.
  .FgGgF.
  .FgggF.
  .FgggF.
  .FgggF.
  .sssss.
  `,
  {
    P: { r: L, d: 1 },
    p: { r: L, d: -2 },
    F: { r: L, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: L, d: -1 },
    s: { r: L, d: 1 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

const WIN_ARCH = mod_(
  `
  ..FFF..
  .FgggF.
  FggGggF
  FgggggF
  FgggmgF
  FgggmgF
  FgggmgF
  `,
  { F: { r: L, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: { r: L, d: -1 } },
  { g: 'ochre1', G: 'ochre2' },
);

const TEXT = textGrid('ASSEMBLEE NATIONALE');

const RELIEF = mod_(
  `
  ..............................LL..............................
  .............................LLLS.............................
  ............................LLLLLS............................
  .......................LL..LLLLLLLS..LL.......................
  ......................LLLS.LLL.LLLS.LLLS......................
  ..............LL.....LLLLLLLLLLLLLLSLLLLS.....LL..............
  .............LLLS...LLLL.LLLLLLLLLLL.LLLLS...LLLS.............
  .....LL.....LLLLLS.LLLLLLLLLLLLLLLLLLLLLLS.LLLLLS.....LL......
  ....LLLLS..LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLS..LLLLS.....
  LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
  `,
  { L: { r: L, d: 1 }, S: { r: L, d: 0 } },
);

export function buildBourbon(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 3300;

  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'wing', 4, 16, 2, 16],
      ['left', 'wing', 160, 172, 2, 16],
      ['right', 'wing', 10, 78, 2, 16],
      ['right', 'body', 10, 72, 2, 16],
      ['left', 'stairs', 24, 150, 1, 18],
      ['left', 'ped', 4, 20, 2, 10],
      ['left', 'ped', 154, 172, 2, 10],
      ['left', 'body', 30, 150, 20, 34],
    ],
    1.3,
  );
  const scorch = scorchZones(
    state === 3 ? [[8.6, 2.6, 0.8]] : state >= 4 ? [[8.4, 2.4, 1.4], [2.6, 3.0, 1.1], [5.5, 1.4, 0.7]] : [],
  );
  const roof = roofMat(R.zinc, scorch, 4);
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean => scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.75
      : undefined;
  if (state >= 3) ov.push({ sprite: 'lm.fx.smoke', u: 8.6, v: 2.6, z: 56 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 8.4, v: 2.6, z: 48 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 2.6, v: 3.0, z: 48 });
  }

  // Windows on the right (east) faces: wing + main block.
  const burnt: Array<{ side: 'left' | 'right'; fx: number; zTop: number }> = [];
  const rightBays = [14, 30, 46, 62];
  for (const b of rightBays) {
    for (const [row, zTop] of [
      [0, 40],
      [1, 14],
    ] as const) {
      const st = windowStatus(state, b * 2 + row, seed);
      if (st === 'burning' || st === 'gutted') burnt.push({ side: 'right', fx: b + 3, zTop });
      if (st === 'burning') ov.push({ sprite: 'lm.fx.fire.s', u: 10.8, v: (b + 3) / 16, z: zTop - 9 });
    }
  }

  const interior: Material = (c) => {
    if (c.night) return c.z < 12 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
    return c.z < 10 && state >= 3 ? (hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1') : 'ink';
  };

  const wall =
    (tag: 'body' | 'wing'): Material =>
    (c) => {
      if (c.side === 'back') return interior(c);
      if (c.side === 'top') return c.night ? null : lv(L, c.level);
      const side = c.side === 'right' ? 'right' : 'left';
      const z = c.fz;
      if (side === 'right') {
        for (const b of rightBays) {
          const w1 = paintWindow(WIN, c, b, 40, windowStatus(state, b * 2, seed));
          if (w1 !== undefined) return w1;
          const w2 = paintWindow(WIN_ARCH, c, b, 14, windowStatus(state, b * 2 + 1, seed));
          if (w2 !== undefined) return w2;
        }
      } else if (tag === 'wing') {
        for (const b of [5, 165]) {
          const w1 = paintWindow(WIN, c, b, 30, windowStatus(state, b, seed));
          if (w1 !== undefined) return w1;
        }
      } else {
        // Portico back wall: tall French windows between the columns.
        for (let k = 0; k < 11; k++) {
          const fx = Math.round((1.6 + (k + 0.5) * 0.709) * 16) - 3;
          const w1 = paintWindow(WIN, c, fx, 44, windowStatus(state, 300 + k, seed));
          if (w1 !== undefined) return w1;
          const w2 = paintWindow(WIN_ARCH, c, fx, 30, windowStatus(state, 320 + k, seed));
          if (w2 !== undefined) return w2;
        }
      }
      if (c.night) return null;
      const d = decalAt(decals, c);
      if (d) return d;
      for (const bw of burnt) {
        if (bw.side !== side) continue;
        const sd = soot(c, bw.fx, bw.zTop, 3, 14);
        if (sd) return sd;
      }
      if (c.edge) return L[0];
      const top = tag === 'wing' ? 36 : 46;
      if (z >= top - 2) return lv(L, c.level + 1);
      if (z === top - 3) return lv(L, c.level - 1);
      if (z === top - 5) return mod(c.fx, 2) ? lv(L, c.level - 1) : lv(L, c.level);
      // Portico recess in shade.
      if (side === 'left' && tag === 'body' && z < 54) return lv(L, Math.min(c.level, 2) - (z > 40 ? 1 : 0));
      if (z < 20) {
        if (z === 19) return lv(L, c.level + 1);
        if (mod(z, 4) === 0) return lv(L, c.level - 1);
        return lv(L, c.level);
      }
      return lv(L, c.level);
    };

  // --- Ground ---------------------------------------------------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    const ju = mod(c.u * 4, 1) < 0.07;
    const jv = mod(c.v * 4, 1) < 0.14;
    return lv(R.paving, c.level - (ju || jv ? 1 : 0));
  };
  s.box(0, BOURBON_W, 0, BOURBON_D, 0, 1, ground, { cast: false });

  // --- Main block, wings, roofs ----------------------------------------------------------------
  const bodyCut =
    state >= 4
      ? (_u: number, v: number, z: number, f: number): boolean => {
          if (f !== 1) return false;
          const d = Math.hypot((v - 2.9) * 16, (z - 26) * 1.3);
          return d < 9 + Math.sin(Math.atan2(z - 26, v - 2.9) * 5) * 1.6;
        }
      : undefined;
  s.box(1.0, 10.0, 0.5, 4.6, 1, 46, wall('body'), { tag: 'body', cut: bodyCut });
  s.hip(1.2, 9.8, 0.7, 4.4, 46, 54, 1.2, roof, { cut: roofCut });
  const glass: Material = (c) => {
    if (c.night) return 'ochre3';
    if (c.edge) return 'ink';
    if (state >= 2 && mod(c.fx, 7) < 2) return 'ink';
    if (mod(c.fx, 4) === 0 || mod(c.fz, 4) === 0) return lv(R.metal, c.level);
    return lv(R.glassSky, c.level);
  };
  s.hip(4.0, 7.0, 1.4, 3.6, 52, 60, [1.3, 0.9], glass);
  for (const u0 of [0.2, 10.0]) {
    s.box(u0, u0 + 0.8, 0.6, 5.0, 1, 36, wall('wing'), { tag: 'wing' });
    const bal: Material = (c) => (c.night ? null : c.edge ? L[0] : lv(L, c.level));
    s.box(u0, u0 + 0.8, 4.85, 5.0, 36, 40, bal, { cut: balustradeCut(36, 40) });
    s.box(u0 + 0.65, u0 + 0.8, 0.6, 5.0, 36, 40, bal, { cut: balustradeCut(36, 40) });
    s.hip(u0 + 0.05, u0 + 0.75, 0.65, 4.8, 36, 41, 0.3, roof);
  }
  // Chimney stacks on the main roof.
  const chimney: Material = (c) => (c.night ? null : c.edge ? L[0] : c.fz >= 58 ? lv(L, c.level + 1) : lv(L, c.level));
  for (const [u, v] of [
    [2.0, 1.2],
    [9.1, 1.2],
    [9.1, 3.6],
  ] as const) {
    s.box(u - 0.18, u + 0.18, v - 0.12, v + 0.12, 48, 60, chimney);
  }

  // --- Portico ------------------------------------------------------------------------------------
  const gran: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return L[0];
    if (c.side !== 'top' && mod(c.fz, 4) === 2) return lv(L, c.level - 1);
    return lv(L, c.level);
  };
  s.box(1.3, 9.7, 4.6, 5.8, 1, 18, gran, { tag: 'podium' });
  stairs(s, 1.3, 9.7, 7.0, 5.8, 1, 18, 6, stepMat(R.limePale, decals));
  const broken = state >= 4 ? new Map([[2, 30], [3, 40], [8, 26]]) : new Map<number, number>();
  for (let k = 0; k < 12; k++) {
    column(s, { u: 1.6 + k * 0.709, v: 5.5, z0: 18, z1: 54, r: 0.14, ramp: R.limePale, brokenAt: broken.get(k), tag: 'col' });
  }
  if (state >= 4) {
    const rub = plain(R.limePale);
    s.cyl(3.4, 6.5, 0.14, 9, 13, rub);
    s.box(7.3, 7.7, 6.6, 6.95, 1, 6, rub);
    s.hip(3.9, 4.6, 6.3, 6.9, 4, 10, 0.3, rub);
    s.cyl(7.9, 6.2, 0.13, 10, 14, rub);
  }
  const gapCut =
    state >= 4
      ? (u: number, _v: number, z: number): boolean => Math.abs(u - 3.3) < 0.7 - (z - 54) * 0.012 + Math.sin(z) * 0.05
      : undefined;
  const entab: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    if (c.edge) return L[0];
    if (c.side === 'top') return lv(L, c.level);
    const z = c.fz;
    if (z >= 61) return lv(L, c.level + 1);
    if (z === 60) return mod(c.fx, 2) ? lv(L, c.level - 2) : lv(L, c.level);
    if (c.side === 'left') {
      const tx = c.fx - Math.round(5.5 * 16 - TEXT.w / 2);
      const ty = 59 - z;
      if (tx >= 0 && ty >= 0 && tx < TEXT.w && ty < TEXT.h && TEXT.rows[ty]![tx] === 't') {
        return state >= 3 && tx > TEXT.w / 3 && tx < TEXT.w / 2 ? lv(L, c.level) : 'ochre1';
      }
    }
    if (z === 54 || z === 55) return lv(L, c.level - 1);
    return lv(L, c.level);
  };
  s.box(1.35, 9.65, 4.6, 5.75, 54, 62, entab, { cut: gapCut });
  const pediment: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    if (c.edge) return L[0];
    if (c.side !== 'left') return roof(c);
    const apexZ = 78 - (Math.abs(c.u - 5.5) / 4.2) * 16;
    const fromTop = apexZ - c.z;
    if (fromTop < 2) return lv(L, c.level + 1);
    if (fromTop < 3) return lv(L, c.level - 2);
    if (c.fz <= 63) return c.fz === 63 ? lv(L, c.level - 2) : lv(L, c.level + 1);
    const rk = sampleModule(RELIEF, c, 57, 74);
    if (rk) {
      const col = moduleColour(RELIEF, rk, c)!;
      return state >= 3 && hash(c.fx, c.fz) < 0.3 ? lv(R.char, c.level) : col;
    }
    return lv(L, c.level - 2);
  };
  const pedCut =
    state >= 4 ? (u: number, _v: number, z: number): boolean => u > 2.4 && u < 3.9 && z < 72 - (u - 2.4) * 2 + Math.sin(u * 20) : undefined;
  s.gable(1.3, 9.7, 4.6, 5.8, 62, 78, 'v', pediment, { cut: pedCut });

  // --- Statues: two seated allegories at the stair foot, two statesmen on high pedestals --------
  const ped: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return L[0];
    if (c.fz >= 9 && c.side !== 'top') return lv(L, c.level + 1);
    return lv(L, c.level);
  };
  for (const [i, u0] of [0.45, 9.85].entries()) {
    s.box(u0, u0 + 0.7, 6.05, 6.85, 1, 11, ped, { tag: 'ped' });
    const toppled = state >= 4 || (state === 3 && i === 1);
    if (toppled) s.sprite(marbleStatue('seated', true), 9, 12, u0 + 0.5, 7.0, 1);
    else s.sprite(marbleStatue('seated'), 6, 17, u0 + 0.35, 6.45, 11);
  }
  for (const [i, u0] of [0.25, 10.05].entries()) {
    s.box(u0, u0 + 0.5, 5.15, 5.65, 1, 16, ped, { tag: 'ped' });
    if (state >= 4 && i === 0) s.sprite(marbleStatue('standing', true), 10, 8, u0 + 0.3, 6.0, 1);
    else s.sprite(marbleStatue('standing'), 4, 19, u0 + 0.25, 5.4, 16);
  }

  // Tricolour above the pediment.
  const poleTop = state >= 4 ? 102 : 116;
  s.line(
    [
      [5.5, 4.45, 74],
      [5.5, 4.45, poleTop],
    ],
    'gray2',
  );
  s.line(
    [
      [5.5, 4.45, poleTop],
      [5.5, 4.45, poleTop + 1],
    ],
    'ochre2',
  );
  ov.push({ sprite: state >= 2 ? 'lm.flag.fr.torn' : 'lm.flag.fr', u: 5.5, v: 4.45, z: poleTop, flag: true });

  // Candelabra lamps at the stair foot.
  const lp = lamp(state >= 2);
  for (const u of [1.6, 9.4]) s.sprite(lp.img, 2, 14, u, 6.95, 1, { emit: state >= 2 ? undefined : lp.night });

  banner(s, state, 3.1, 7.9, 5.68, 46, 10, 'MERDE ALORS');
  rubble(s, state, 1.4, 9.6, 4.7, 5.75, 18, 10, seed);
  rubble(s, state, 0.1, 1.2, 5.75, 6.95, 1, 4, seed + 1);
  return { scene: s, overlays: ov };
}

