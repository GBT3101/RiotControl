/**
 * Vienna — the Austrian Parliament (Parlament) on the Ringstraße. Footprint 12 (u) × 7 (v).
 * Theophil Hansen's Greek-revival temple: the octastyle Corinthian portico on its podium, the two
 * ramps sweeping up to it (horse tamers at their feet), the corner pavilions with their own
 * pediments, bronze quadrigas on the roof corners, attic statues, and the Pallas Athene fountain
 * in front on the +v side.
 */
import { Scene, type Material, type ShadeCtx } from '../engine/scene';
import {
  R,
  hash,
  lv,
  mod,
  mod_,
  moduleColour,
  plain,
  sampleModule,
  type Ramp5,
} from '../engine/materials';
import {
  banner,
  column,
  decalAt,
  paintWindow,
  rubble,
  scatterDecals,
  scorchZones,
  soot,
  stepMat,
  stairs,
  windowStatus,
  type DamageState,
} from '../engine/kit';
import { grid } from '../../lib/grid';
import type { Build, Overlay } from '../types';
import { figure, lamp } from '../props';
import { basin } from '../shared';
import { ATHENA, ATTIC, QUADRIGA, TAMER } from './sprites.grid';

export const PARLAMENT_W = 12;
export const PARLAMENT_D = 7;

/** Hansen's pale sandstone (slightly cooler than Paris limestone). */
export const VSTONE: Ramp5 = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'];
/** Greyish-green weathered copper roofs. */
export const VCOPPER: Ramp5 = ['green0', 'zinc0', 'zinc1', 'green2', 'teal1'];
const V = VSTONE;

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
  .sssss.
  `,
  {
    P: { r: V, d: 1 },
    p: { r: V, d: -2 },
    F: { r: V, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: V, d: -1 },
    s: { r: V, d: 1 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

const WIN_LOW = mod_(
  `
  .FFF.
  FgGgF
  FgggF
  FgmgF
  FgggF
  `,
  { F: { r: R.granite, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: { r: R.granite, d: -1 } },
  { g: 'ochre1', G: 'ochre2' },
);

/** Pediment relief: the Emperor granting the constitution to the peoples (figures). */
const RELIEF = mod_(
  `
  ...............................LL...............................
  ..............................LLLS..............................
  ...........................LL.LLLLS.LL..........................
  ..........................LLLSLLLLSLLLS.........................
  ...............LL........LLLLLLLLLLLLLLS........LL..............
  ..............LLLS...LL.LLLL.LLLLL.LLLLS.LL....LLLS.............
  .......LL....LLLLLS.LLLSLLLLLLLLLLLLLLLSLLLS..LLLLLS....LL......
  ......LLLS..LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLS..LLLS.....
  ..LL.LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLS...
  LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
  `,
  { L: { r: V, d: 1 }, S: { r: V, d: 0 } },
);

const ATHENA_KEYS = {
  o: 'gray3',
  h: 'white',
  l: 'gray7',
  m: 'gray6',
  d: 'gray5',
  g: 'ochre2',
  G: 'ochre3',
  y: 'ochre1',
};

/** Floodlit Athena for the night mask (warm-lit marble, glowing gilt). */
function athenaNight(): ReturnType<typeof grid> {
  return grid(
    ATHENA,
    {
      o: 'stone1',
      h: 'stone5',
      l: 'stone4',
      m: 'stone3',
      d: 'stone2',
      g: 'ochre3',
      G: 'ochre4',
      y: 'ochre2',
    },
    {},
    'athenaNight',
  );
}

function athena(toppled: boolean): ReturnType<typeof grid> {
  if (!toppled) return grid(ATHENA, ATHENA_KEYS, {}, 'athena');
  // Knocked off her column: lying on her back in the basin (transposed).
  const rows = ATHENA.trim()
    .split('\n')
    .map((r) => r.trim());
  const h = rows.length;
  const w = rows[0]!.length;
  const out: string[] = [];
  for (let x = 0; x < w; x++) {
    let r = '';
    for (let y = h - 1; y >= 0; y--) r += rows[y]![x]!;
    out.push(r);
  }
  return grid(out.reverse().join('\n'), ATHENA_KEYS, {}, 'athenaToppled');
}

export function buildParlament(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 5500;

  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'pav', 4, 36, 2, 14],
      ['left', 'pav', 156, 186, 2, 14],
      ['right', 'pav', 14, 74, 2, 14],
      ['left', 'body', 46, 66, 2, 14],
      ['left', 'body', 128, 146, 2, 14],
      ['left', 'podium', 66, 126, 2, 16],
      ['left', 'ramp', 30, 60, 2, 10],
      ['left', 'ramp', 132, 164, 2, 10],
      ['left', 'stairs', 70, 120, 1, 6],
    ],
    1.3,
  );
  const scorch = scorchZones(
    state === 3
      ? [[9.6, 2.4, 0.8]]
      : state >= 4
        ? [
            [9.8, 2.2, 1.3],
            [2.4, 2.8, 1.1],
            [6.0, 1.6, 0.8],
          ]
        : [],
  );
  const roof = copperRoof(scorch);
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.75
      : undefined;
  if (state >= 3) ov.push({ sprite: 'lm.fx.smoke', u: 9.6, v: 2.4, z: 58 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 9.8, v: 2.4, z: 48 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 2.4, v: 2.9, z: 50 });
    ov.push({ sprite: 'lm.fx.smoke', u: 2.4, v: 2.7, z: 60 });
  }

  // Window bays: [side, tag, fx, zTop, module] ; burning ones get soot + fire.
  const bays: Array<{
    side: 'left' | 'right';
    fx: number;
    zTop: number;
    low: boolean;
    id: number;
  }> = [];
  const addBays = (side: 'left' | 'right', xs: number[], low: boolean, zTop: number): void => {
    for (const fx of xs) bays.push({ side, fx, zTop, low, id: bays.length });
  };
  // Front (+v): pavilions and the wings between them and the portico.
  addBays('left', [12, 24, 160, 172], false, 40);
  addBays('left', [12, 24, 160, 172], true, 14);
  addBays('left', [46, 58, 124, 136], false, 38);
  addBays('left', [47, 59, 125, 137], true, 14);
  addBays('right', [18, 32, 46, 60, 74], false, 40);
  addBays('right', [19, 33, 47, 61, 75], true, 14);
  const burnt: Array<{ side: 'left' | 'right'; fx: number; zTop: number }> = [];
  for (const b of bays) {
    const st = windowStatus(state, b.id * 3 + 1, seed);
    if (st === 'burning' || st === 'gutted')
      burnt.push({ side: b.side, fx: b.fx + 3, zTop: b.zTop });
    if (st === 'burning' && !b.low) {
      const u = b.side === 'left' ? (b.fx + 3) / 16 : 11.45;
      const v = b.side === 'left' ? (b.fx < 40 || b.fx > 150 ? 4.95 : 4.65) : (b.fx + 3) / 16;
      ov.push({ sprite: 'lm.fx.fire.s', u, v, z: b.zTop - 9 });
    }
  }

  const interior: Material = (c) => {
    if (c.night) return c.z < 12 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
    return c.z < 10 && state >= 3 ? (hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1') : 'ink';
  };
  const holes: Array<{ side: 'left' | 'right'; fx: number; z: number; r: number }> =
    state >= 4
      ? [
          { side: 'left', fx: 166, z: 26, r: 8 },
          { side: 'right', fx: 40, z: 24, r: 7 },
        ]
      : [];
  const inHole = (side: string, fx: number, z: number, grow = 0): boolean =>
    holes.some((h) => {
      if (h.side !== side) return false;
      const dx = fx - h.fx;
      const dz = (z - h.z) * 1.2;
      const a = Math.atan2(dz, dx);
      const rr = h.r + Math.sin(a * 5 + h.fx) * 1.5 + Math.cos(a * 3) * 1.1 + grow;
      return dx * dx + dz * dz < rr * rr;
    });
  const wallCut = holes.length
    ? (u: number, v: number, z: number, f: number): boolean =>
        (f === 3 && inHole('left', Math.floor(u * 16), Math.floor(z))) ||
        (f === 1 && inHole('right', Math.floor(v * 16), Math.floor(z)))
    : undefined;

  const wall =
    (top: number): Material =>
    (c: ShadeCtx) => {
      if (c.side === 'back') return interior(c);
      if (c.side === 'top') {
        if (scorch(c.u, c.v) === 2)
          return c.night ? 'rust3' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust2';
        return c.night ? null : lv(V, c.level);
      }
      const side = c.side === 'right' ? 'right' : 'left';
      if (holes.length && inHole(side, c.fx, c.fz, 2)) {
        if (c.night) return null;
        return lv(R.brick, c.level - (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
      }
      for (const b of bays) {
        if (b.side !== side) continue;
        const st = windowStatus(state, b.id * 3 + 1, seed);
        const p = paintWindow(b.low ? WIN_LOW : WIN, c, b.fx, b.zTop, st);
        if (p !== undefined) return p;
      }
      if (c.night) return null;
      const d = decalAt(decals, c);
      if (d) return d;
      for (const bw of burnt) {
        if (bw.side !== side) continue;
        const sd = soot(c, bw.fx, bw.zTop, 3, 14);
        if (sd) return sd;
      }
      if (c.edge) return V[0];
      const z = c.fz;
      if (z >= top - 2) return lv(V, c.level + 1);
      if (z === top - 3) return lv(V, c.level - 1);
      if (z === top - 5) return mod(c.fx, 2) ? lv(V, c.level - 1) : lv(V, c.level);
      // Rusticated granite ground floor.
      if (z < 20) {
        if (z === 19) return lv(V, c.level + 1);
        if (mod(z, 4) === 0) return lv(R.granite, c.level - 1);
        if (mod(c.fx + Math.floor(z / 4) * 5, 10) === 0) return lv(R.granite, c.level - 1);
        return lv(R.granite, c.level);
      }
      // Pilaster strips.
      if (mod(c.fx - 6, 12) === 0) return lv(V, c.level + 1);
      return lv(V, c.level);
    };

  // --- Ground: Ringstraße forecourt -------------------------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    const lawn = c.v > 5.0 && c.v < 6.9 && ((c.u > 0.3 && c.u < 2.2) || (c.u > 9.8 && c.u < 11.7));
    if (lawn) {
      if (state >= 2 && hash(Math.floor(c.u * 6), Math.floor(c.v * 6)) < 0.25 * (state - 1))
        return lv(R.gravel, c.level - 1);
      return lv(R.grass, c.level - (mod(c.px + c.py, 7) === 0 ? 1 : 0));
    }
    const ju = mod(c.u * 4, 1) < 0.07;
    const jv = mod(c.v * 4, 1) < 0.14;
    return lv(R.paving, c.level - (ju || jv ? 1 : 0));
  };
  s.box(0, PARLAMENT_W, 0, PARLAMENT_D, 0, 1, ground, { cast: false, tag: 'ground' });

  // --- Main block, central hall, corner pavilions ------------------------------------------
  s.box(0.6, 11.4, 0.6, 4.6, 1, 46, wall(46), { tag: 'body', cut: wallCut });
  s.hip(0.8, 11.2, 0.8, 4.4, 46, 54, 1.0, roof, { cut: roofCut });
  // Central Hall of Columns: raised clerestory with a glass roof.
  const hall: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(V, c.level);
    const win = mod(c.fx, 8) > 2 && mod(c.fx, 8) < 6 && c.fz > 53 && c.fz < 61;
    if (c.night) return win ? 'ochre2' : null;
    if (c.edge) return V[0];
    if (win) return state >= 2 && hash(c.fx >> 3, 3) < 0.5 ? 'ink' : lv(R.dark, c.level);
    if (c.fz >= 63) return lv(V, c.level + 1);
    return lv(V, c.level);
  };
  s.box(4.2, 7.8, 1.2, 3.8, 46, 64, hall);
  const glass: Material = (c) => {
    if (c.night) return mod(c.fx, 4) === 0 ? null : 'ochre2';
    if (c.edge) return 'ink';
    if (state >= 2 && mod(c.fx, 7) < 2) return 'ink';
    if (mod(c.fx, 4) === 0) return lv(R.metal, c.level);
    return lv(R.glassSky, c.level);
  };
  s.hip(4.3, 7.7, 1.3, 3.7, 64, 72, [0.6, 1.25], roof, { cut: roofCut });
  s.box(4.9, 7.1, 2.3, 2.7, 70, 73, glass);
  // Pavilions with their own pediments (the two chambers).
  const pavPed: Material = (c) => {
    if (c.side !== 'left') return roof(c);
    if (c.night) return null;
    if (c.edge) return V[0];
    const mid = c.prim.aabb[0] + 1.05;
    const apex = 64 - (Math.abs(c.u - mid) / 1.05) * 12;
    if (apex - c.z < 2) return lv(V, c.level + 1);
    if (c.fz <= 53) return lv(V, c.level + 1);
    return lv(V, c.level - 2);
  };
  for (const u0 of [0.4, 9.5]) {
    s.box(u0, u0 + 2.1, 0.4, 4.9, 1, 52, wall(52), { tag: 'pav', cut: wallCut });
    s.hip(u0 + 0.05, u0 + 2.05, 0.45, 4.85, 52, 60, [0.4, 0.8], roof, { cut: roofCut });
    s.gable(u0, u0 + 2.1, 4.4, 4.98, 52, 64, 'v', pavPed);
    // Attached half-columns on the pavilion front.
    for (let k = 0; k < 4; k++) {
      const u = u0 + 0.3 + k * 0.5;
      s.cyl(u, 4.92, 0.07, 20, 50, (c) =>
        c.night ? null : c.edge ? V[0] : !c.shadow && c.lambert > 0.6 ? V[4] : lv(V, c.level),
      );
    }
  }
  // Attic statues along the main cornice.
  const attic = grid(ATTIC, { o: 'gray3', h: 'white', l: 'gray7', m: 'gray6' }, {}, 'attic');
  for (let u = 2.9; u < 9.2; u += 0.55) {
    if (u > 3.9 && u < 8.1) continue;
    if (state >= 4 && hash(Math.round(u * 10), 1) < 0.5) continue;
    s.sprite(attic, 1, 6, u, 4.62, 46);
  }
  // Quadrigas on the pavilion roof corners.
  const quad = figure(QUADRIGA, 'bronze', 'quadriga');
  const quadSpots: Array<[number, number]> = [
    [0.75, 4.55],
    [2.15, 4.55],
    [9.85, 4.55],
    [11.25, 4.55],
  ];
  quadSpots.forEach(([u, v], k) => {
    s.box(u - 0.22, u + 0.22, v - 0.22, v + 0.22, 52, 56, plain(V, { rim: true }));
    if (state >= 4 && k === 2) return;
    if (state >= 3 && k === 1) return;
    s.sprite(quad, 10, 11, u, v, 56);
  });
  if (state >= 3) s.sprite(quad, 10, 11, 2.35, 5.6, 1);

  // --- Portico on its podium, the ramps ------------------------------------------------------
  const podium: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return R.granite[0];
    if (c.side === 'top') return lv(R.paving, c.level);
    if (c.fz >= 18) return lv(V, c.level + 1);
    if (mod(c.fz, 4) === 2) return lv(R.granite, c.level - 1);
    return lv(R.granite, c.level);
  };
  s.box(3.9, 8.1, 4.6, 5.75, 1, 19, podium, { tag: 'podium' });
  // Ramps: inclined slabs rising toward the portico from both sides (along u).
  const rampMat: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return R.granite[0];
    if (c.side === 'top' || c.side === 'slopeR' || c.side === 'slopeL')
      return lv(R.paving, c.level - (mod(c.fx, 4) === 0 ? 1 : 0));
    if (mod(c.fz, 4) === 2) return lv(R.granite, c.level - 1);
    return lv(R.granite, c.level);
  };
  const ramp = (uLow: number, uHigh: number): void => {
    const k = 18 / (uHigh - uLow); // px per tile
    const lo = Math.min(uLow, uHigh);
    const hi = Math.max(uLow, uHigh);
    const dir = uHigh > uLow ? 1 : -1;
    s.poly(
      [
        { nu: -1, nv: 0, nz: 0, c: -lo },
        { nu: 1, nv: 0, nz: 0, c: hi },
        { nu: 0, nv: -1, nz: 0, c: -5.05 },
        { nu: 0, nv: 1, nz: 0, c: 5.7 },
        { nu: 0, nv: 0, nz: -1, c: -1 },
        // z ≤ 1 + k·dir·(u − uLow)
        { nu: -k * dir, nv: 0, nz: 1, c: 1 - k * dir * uLow },
      ],
      [lo, hi, 5.05, 5.7, 1, 19],
      rampMat,
      { tag: 'ramp' },
    );
    // Balustrade along the outer edge.
    for (let u = lo + 0.06; u < hi; u += 0.125) {
      const z = 1 + k * dir * (u - uLow);
      s.line(
        [
          [u, 5.72, z],
          [u, 5.72, z + 4],
        ],
        mod(Math.round(u * 8), 2) ? 'stone3' : 'stone4',
      );
    }
    s.line(
      [
        [lo, 5.72, 1 + (dir > 0 ? 4 : 22)],
        [hi, 5.72, 1 + (dir > 0 ? 22 : 4)],
      ],
      'stone5',
    );
  };
  ramp(1.9, 3.9);
  ramp(10.1, 8.1);
  // Horse tamers (bronze) on pedestals at the ramp feet.
  const tamer = figure(TAMER, 'bronze', 'tamer');
  for (const [i, u] of [1.55, 10.45].entries()) {
    s.box(u - 0.3, u + 0.3, 5.1, 5.7, 1, 9, podium, { tag: 'ramp' });
    if (state >= 4 || (state === 3 && i === 0)) continue;
    s.sprite(tamer, 7, 14, u, 5.4, 9);
  }
  // Front stair down to the Athena fountain.
  stairs(s, 4.4, 7.6, 6.2, 5.75, 1, 6, 3, stepMat(R.granite, decals));

  // Octastyle Corinthian portico.
  const broken =
    state >= 4
      ? new Map([
          [2, 34],
          [5, 28],
        ])
      : new Map<number, number>();
  for (let k = 0; k < 8; k++) {
    column(s, {
      u: 4.25 + k * 0.5,
      v: 5.45,
      z0: 19,
      z1: 52,
      r: 0.12,
      ramp: R.limePale,
      brokenAt: broken.get(k),
      tag: 'col',
    });
  }
  if (state >= 4) {
    const rub = plain(R.limePale);
    s.cyl(5.1, 6.4, 0.12, 6, 10, rub);
    s.box(6.9, 7.3, 6.3, 6.6, 1, 5, rub);
    s.hip(4.6, 5.3, 5.95, 6.5, 1, 7, 0.3, rub);
  }
  const gapCut =
    state >= 4
      ? (u: number, _v: number, z: number): boolean =>
          Math.abs(u - 5.5) < 0.6 - (z - 52) * 0.012 + Math.sin(z) * 0.05
      : undefined;
  const entab: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    if (c.edge) return V[0];
    if (c.side === 'top') return lv(V, c.level);
    const z = c.fz;
    if (z >= 58) return lv(V, c.level + 1);
    if (z === 57) return mod(c.fx, 2) ? lv(V, c.level - 2) : lv(V, c.level);
    // Painted frieze band (Hansen's red-ground frieze with gilt figures).
    if (z >= 53 && z <= 55 && c.side === 'left')
      return mod(c.fx, 4) === 0 ? lv(R.gold, c.level - 1) : state >= 3 ? 'rust1' : 'rust2';
    if (z === 52) return lv(V, c.level - 1);
    return lv(V, c.level);
  };
  s.box(4.0, 8.0, 4.6, 5.7, 52, 60, entab, { cut: gapCut });
  const pediment: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    if (c.edge) return V[0];
    if (c.side !== 'left') return roof(c);
    const apexZ = 76 - (Math.abs(c.u - 6.0) / 2.0) * 16;
    const fromTop = apexZ - c.z;
    if (fromTop < 2) return lv(V, c.level + 1);
    if (fromTop < 3) return lv(V, c.level - 2);
    if (c.fz <= 61) return c.fz === 61 ? lv(V, c.level - 2) : lv(V, c.level + 1);
    const rk = sampleModule(RELIEF, c, 64, 73);
    if (rk) {
      const col = moduleColour(RELIEF, rk, c)!;
      return state >= 3 && hash(c.fx, c.fz) < 0.3 ? lv(R.char, c.level) : col;
    }
    return lv(V, c.level - 2);
  };
  const pedCut =
    state >= 4
      ? (u: number, _v: number, z: number): boolean =>
          u > 4.8 && u < 6.2 && z < 72 - (u - 4.8) * 2 + Math.sin(u * 20)
      : undefined;
  s.gable(4.0, 8.0, 4.6, 5.7, 60, 76, 'v', pediment, { cut: pedCut });
  // Acroteria statues on the pediment.
  for (const [u, z] of [
    [4.1, 60],
    [7.9, 60],
    [6.0, 76],
  ] as const) {
    if (state >= 4 && u < 5) continue;
    s.sprite(attic, 1, 6, u, 5.6, z);
  }

  // Flagpole on the central hall (Austrian flag).
  const poleTop = state >= 4 ? 88 : 100;
  s.line(
    [
      [6.0, 2.5, 70],
      [6.0, 2.5, poleTop],
    ],
    'gray2',
  );
  s.line(
    [
      [6.0, 2.5, poleTop],
      [6.0, 2.5, poleTop + 1],
    ],
    'ochre2',
  );
  ov.push({
    sprite: state >= 2 ? 'lm.flag.at.torn' : 'lm.flag.at',
    u: 6.0,
    v: 2.5,
    z: poleTop,
    flag: true,
  });

  // --- Pallas Athene fountain -----------------------------------------------------------------
  const AU = 6.0;
  const AV = 6.45;
  basin(s, AU, AV, 0.62, 0.54, 4, 0, 4, R.granite);
  const marble: Material = (c) => {
    if (c.night) return c.side === 'curve' && c.lambert > 0.4 && c.z < 30 ? 'stone4' : null;
    if (c.edge) return R.marble[0];
    // Relief band on the column-like plinth.
    if (c.fz > 14 && c.fz < 20)
      return mod(c.sx + c.fz, 3) === 0 ? lv(R.marble, c.level - 1) : lv(R.marble, c.level);
    if (!c.shadow && c.lambert > 0.6) return R.marble[4];
    return lv(R.marble, c.level);
  };
  s.cyl(AU, AV, 0.26, 3, 8, plain(R.granite, { rim: true }));
  s.cyl(AU, AV, 0.17, 8, 30, marble);
  s.cyl(AU, AV, 0.22, 30, 32, plain(R.marble, { rim: true }));
  if (state >= 4) s.sprite(athena(true), 11, 6, AU + 0.3, AV + 0.2, 3);
  else s.sprite(athena(false), 6, 21, AU, AV, 32, { emit: state < 2 ? athenaNight() : undefined });
  // Spear.
  if (state < 4) {
    s.line(
      [
        [AU + 0.12, AV - 0.12, 30],
        [AU + 0.12, AV - 0.12, 58],
      ],
      'ochre1',
      { bias: 0.4 },
    );
    s.line(
      [
        [AU + 0.12, AV - 0.12, 58],
        [AU + 0.12, AV - 0.12, 61],
      ],
      'ochre3',
      { bias: 0.4 },
    );
  }
  // Lamps.
  const lp = lamp(state >= 2);
  for (const u of [3.6, 8.4])
    s.sprite(lp.img, 2, 14, u, 6.6, 1, { emit: state >= 2 ? undefined : lp.night });

  banner(s, state, 4.4, 7.6, 5.8, 17, 9, 'GENUG!');
  banner(s, state, 0.6, 2.3, 4.99, 16, 8, 'NEIN!');
  rubble(s, state, 0.4, 11.6, 5.0, 6.8, 1, 16, seed);
  rubble(s, state, 4.0, 8.0, 4.7, 5.6, 19, 6, seed + 1);
  return { scene: s, overlays: ov };
}

/** Weathered copper roofs with standing seams; scorch zones from state 3. */
function copperRoof(scorch: (u: number, v: number) => 0 | 1 | 2): Material {
  return (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return VCOPPER[0];
    const sc = scorch(c.u, c.v);
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    const seam = mod(c.sx, 3) === 0;
    return lv(VCOPPER, c.level - (seam ? 2 : 0));
  };
}
