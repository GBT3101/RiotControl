/**
 * Amsterdam — Koninklijk Paleis on the Dam. Footprint 9 (u) × 6 (v). Van Campen's wide
 * classical sandstone block faces +v (the Dam): two pilaster orders over five window rows, the
 * central risalit with the seven small entrance arches (one per province, no grand portico),
 * the sculpted pediment with Peace on top, and the domed cupola with the gilded cog
 * weathervane. Low lead roof, Dutch flags.
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
  breakAbove,
  decalAt,
  rubble,
  scatterDecals,
  scorchZones,
  stairs,
  stepMat,
  type DamageState,
} from '../engine/kit';
import type { Build, Overlay } from '../types';
import { figure, lamp } from '../props';
import { RN, fireOverlays, flat, sootAt, windowsAt, type WinPlace } from '../berlin/northkit';
import { PEACE, SHIP_VANE } from './sprites.grid';

export const PALEIS_W = 9;
export const PALEIS_D = 6;

const S = RN.sandPale;
const SD: Ramp5 = ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'];

const WIN_TALL = mod_(
  `
  .FFFFF.
  .FgGgF.
  .FgggF.
  .FmmmF.
  .FgGgF.
  .FgggF.
  .FmmmF.
  .FgGgF.
  .FgggF.
  .FgggF.
  .FgggF.
  .sssss.
  `,
  { F: { r: S, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: 'gray6', s: { r: S, d: 1 } },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);
const WIN_SMALL = mod_(
  `
  .FFFFF.
  .FgGgF.
  .FmmmF.
  .FgggF.
  .sssss.
  `,
  { F: { r: S, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: 'gray6', s: { r: S, d: 1 } },
  { g: 'ochre1', G: 'ochre2', m: 'ochre1' },
);

/** Tympanum: the Maid of Amsterdam among sea-gods and tritons (L lit, S shade). */
const RELIEF = mod_(
  `
  .....................LL.....................
  ....................LLLS....................
  ...................LLLLLS...................
  ..............LL..LLLLLLLS..LL..............
  .............LLLS.LLL.LLLS.LLLS.............
  ......LL....LLLLLSLLLLLLLLSLLLLLS....LL.....
  .....LLLLS.LLL.LLLLLLLLLLLLLLL.LLLS.LLLLS...
  ..LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLS.
  LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
  `,
  { L: { r: S, d: 1 }, S: { r: S, d: 0 } },
);

const CUP = { u: 4.5, v: 2.5 };

export function buildPaleis(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 6600;

  // --- Windows: two orders, each a tall window with a small one above ------------------------
  const wins: WinPlace[] = [];
  let id = 0;
  const rows: Array<[number, typeof WIN_TALL]> = [
    [18, WIN_TALL],
    [27, WIN_SMALL],
    [48, WIN_TALL],
    [56, WIN_SMALL],
  ];
  const frontBays = [7, 17, 27, 37, 49, 58, 67, 76, 85, 97, 107, 117, 127];
  for (const c0 of frontBays) {
    const risalit = c0 > 45 && c0 < 95;
    for (const [zTop, m] of rows) {
      if (risalit && zTop === 18) continue; // the seven entrance arches below
      wins.push({
        side: 'left',
        tag: risalit ? 'risalit' : 'body',
        c0,
        zTop,
        m,
        id: id++,
        plane: risalit ? 4.95 : 4.7,
      });
    }
  }
  for (const c0 of [8, 18, 28, 38, 48, 58]) {
    for (const [zTop, m] of rows)
      wins.push({ side: 'right', tag: 'body', c0, zTop, m, id: id++, plane: 8.7 });
  }
  if (state >= 3) {
    // Flames only from the tall windows, and not all of them (the facade has 100+ openings).
    const fires = fireOverlays(
      wins.filter((w) => w.m === WIN_TALL),
      state,
      seed,
    );
    fires.forEach((f, k) => {
      if (k % 2 === 0) ov.push(f);
    });
  }

  // --- Damage -------------------------------------------------------------------------------
  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'body', 5, 44, 2, 12],
      ['left', 'body', 96, 138, 2, 12],
      ['left', 'risalit', 48, 96, 1, 12],
      ['right', 'body', 8, 70, 2, 12],
      ['left', 'stairs', 46, 98, 1, 4],
    ],
    1.4,
  );
  const holes: Array<{ side: 'left' | 'right'; fx: number; z: number; r: number }> =
    state >= 4
      ? [
          { side: 'left', fx: 112, z: 34, r: 8 },
          { side: 'right', fx: 34, z: 24, r: 7 },
        ]
      : [];
  const inHole = (side: 'left' | 'right', fx: number, z: number, grow = 0): boolean =>
    holes.some((h) => {
      if (h.side !== side) return false;
      const dx = fx - h.fx;
      const dz = (z - h.z) * 1.2;
      const a = Math.atan2(dz, dx);
      const rr = h.r + Math.sin(a * 5 + h.fx) * 1.6 + Math.cos(a * 3) * 1.2 + grow;
      return dx * dx + dz * dz < rr * rr;
    });
  const scorch = scorchZones(
    state === 3
      ? [[7.3, 1.4, 0.7]]
      : state >= 4
        ? [
            [7.2, 1.5, 1.1],
            [1.8, 3.2, 1.0],
          ]
        : [],
  );
  if (state === 3) ov.push({ sprite: 'lm.fx.smoke', u: 7.3, v: 1.4, z: 70 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 7.2, v: 1.6, z: 66 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 1.8, v: 3.3, z: 66 });
    ov.push({ sprite: 'lm.fx.fire.m', u: CUP.u, v: CUP.v + 0.5, z: 84 });
    ov.push({ sprite: 'lm.fx.smoke', u: CUP.u, v: CUP.v, z: 96 });
  }

  // --- Materials --------------------------------------------------------------------------------
  const interior: Material = (c) => {
    if (c.night) return c.z < 12 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
    if (state >= 3 && c.z < 10) return hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1';
    return c.z < 18 ? 'gray1' : 'ink';
  };
  const pilasterAt = (c: ShadeCtx, side: 'left' | 'right'): number => {
    // Column of the pilaster nearest this face pixel (−1 if none): between window bays.
    const bays = side === 'left' ? frontBays : [8, 18, 28, 38, 48, 58];
    for (let k = 0; k + 1 < bays.length; k++) {
      const p = Math.round((bays[k]! + 7 + bays[k + 1]!) / 2) - 1;
      if (c.fx === p || c.fx === p + 1) return c.fx - p;
    }
    return -1;
  };
  const wall: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.side === 'top') return c.night ? null : lv(S, c.level);
    const side = c.side === 'right' ? 'right' : 'left';
    if (holes.length && inHole(side, c.fx, c.fz, 2))
      return c.night ? null : lv(R.brick, c.level - (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
    // Seven entrance arches of the risalit.
    if (side === 'left' && c.prim.tag === 'risalit' && c.fz < 14) {
      for (let k = 0; k < 7; k++) {
        const cx = 50.5 + k * 6.6;
        const dx = Math.abs(c.fx + 0.5 - cx);
        const top = 10 + Math.sqrt(Math.max(0, 4 - dx * dx)) * 1.2;
        if (dx < 2.2 && c.fz < top) {
          if (c.night) return c.fz < 9 ? 'ochre2' : 'ochre1';
          if (state >= 3) return hash(c.fx, c.fz) < 0.3 ? 'rust1' : 'ink';
          return c.fz < 2 ? 'gray1' : lv(R.dark, c.level);
        }
        if (dx < 3.0 && c.fz < top + 1.5 && c.fz > 2) return c.night ? null : lv(S, c.level + 1);
      }
    }
    const w = windowsAt(c, wins, state, seed);
    if (w !== undefined) return w;
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    const so = sootAt(c, wins, state, seed);
    if (so) return so;
    if (c.edge) return S[0];
    const z = c.fz;
    // Base, the two entablatures and the main cornice.
    if (z <= 2) return lv(SD, c.level);
    if (z >= 62) return lv(S, c.level + 1);
    if (z === 61) return mod(c.fx, 2) ? lv(SD, c.level) : lv(S, c.level);
    if (z === 60 || z === 32) return lv(SD, c.level);
    if (z === 31 || z === 33) return lv(S, c.level + 1);
    if (z === 30) return lv(SD, c.level);
    // Pilasters (lit flank / shaded flank), capitals just under each entablature.
    const p = pilasterAt(c, side);
    if (p >= 0) {
      if (z === 29 || z === 59) return lv(S, c.level + 1);
      return lv(S, c.level + (p === 0 ? 1 : -1));
    }
    // Festoons between the upper windows (carved garlands).
    if (z >= 57 && z <= 59 && mod(c.fx, 3) === 1) return lv(S, c.level - 1);
    // Weathering: faint darker courses.
    if (mod(z, 5) === 0) return lv(SD, c.level + 1);
    return lv(S, c.level);
  };

  // --- Ground -------------------------------------------------------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    if (c.edge) return lv(R.paving, 0);
    // Dam square setts: small bricks in a herringbone-ish rhythm.
    const k = mod(Math.floor(c.u * 8) + Math.floor(c.v * 8), 2);
    const j = mod(c.u * 8, 1) < 0.12 || mod(c.v * 8, 1) < 0.2;
    return lv(R.paving, c.level - (j ? 1 : 0) - (k && j ? 0 : 0));
  };
  s.box(0, PALEIS_W, 0, PALEIS_D, 0, 1, ground, { cast: false, tag: 'ground' });

  // --- Body + risalit ------------------------------------------------------------------------------
  const cutFor = (plane: number) =>
    holes.length
      ? (u: number, v: number, z: number, f: number): boolean => {
          if (f === 3 && Math.abs(v - plane) < 0.01)
            return inHole('left', Math.floor(u * 16), Math.floor(z));
          if (f === 1) return inHole('right', Math.floor(v * 16), Math.floor(z));
          return false;
        }
      : undefined;
  s.box(0.3, 8.7, 0.5, 4.7, 1, 64, wall, { tag: 'body', cut: cutFor(4.7) });
  s.box(3.0, 6.0, 4.7, 4.95, 1, 64, wall, { tag: 'risalit' });
  // Pediment over the risalit.
  const pedCut =
    state >= 4
      ? (u: number, _v: number, z: number): boolean =>
          u > 3.3 && u < 4.4 + Math.sin(z) * 0.1 && z < 76 - (u - 3.3) * 6
      : undefined;
  const roofM: Material = (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return R.slate[1];
    const sc = scorch(c.u, c.v);
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    return lv(RN.lead, c.level - (mod(c.fz, 3) === 0 ? 1 : 0));
  };
  const pediment: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    if (c.edge) return S[0];
    if (c.side !== 'left') return roofM(c);
    const apexZ = 80 - (Math.abs(c.u - 4.5) / 1.5) * 16;
    const fromTop = apexZ - c.z;
    if (fromTop < 2) return lv(S, c.level + 1);
    if (fromTop < 3) return lv(SD, c.level);
    if (c.fz <= 65) return c.fz === 65 ? lv(SD, c.level) : lv(S, c.level + 1);
    const rk = sampleModule(RELIEF, c, 50, 75);
    if (rk) {
      const col = moduleColour(RELIEF, rk, c)!;
      return state >= 3 && hash(c.fx, c.fz) < 0.3 ? lv(R.char, c.level) : col;
    }
    return lv(S, c.level - 2);
  };
  s.gable(2.95, 6.05, 4.65, 5.0, 64, 80, 'v', pediment, { cut: pedCut, tag: 'pediment' });
  // Low lead roof behind a plain parapet.
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.8
      : undefined;
  s.hip(0.45, 8.55, 0.65, 4.55, 64, 72, 1.0, roofM, { cut: roofCut });
  // Chimneys.
  for (const [u, v] of [
    [1.4, 1.1],
    [7.6, 1.1],
    [7.6, 3.9],
    [1.4, 3.9],
  ] as const)
    s.box(u - 0.12, u + 0.12, v - 0.12, v + 0.12, 66, 76, flat(S, true));

  // --- Cupola: octagonal base, open drum with columns, dome, lantern, ship ---------------------------
  const cupBroken = state >= 4 ? breakAbove(96, 2) : undefined;
  s.prismN(CUP.u, CUP.v, 0.78, 0.78, 66, 80, 8, flat(S, true), { rot: Math.PI / 8, tag: 'cup' });
  const drum: Material = (c) => {
    const a = Math.atan2(c.v - CUP.v, c.u - CUP.u);
    const k = mod((a * 12) / (2 * Math.PI), 1);
    const opening = k > 0.35 && c.fz > 82 && c.fz < 95 - Math.abs(k - 0.68) * 6;
    if (c.night) return opening ? 'ochre2' : null;
    if (c.edge) return S[0];
    if (opening) return state >= 2 ? 'ink' : lv(R.dark, c.level);
    if (c.fz >= 96) return lv(S, c.level + 1);
    if (!c.shadow && c.lambert > 0.55 && k < 0.3) return S[4];
    return lv(S, c.level);
  };
  s.cyl(CUP.u, CUP.v, 0.62, 80, 98, drum, { tag: 'cup', cut: cupBroken });
  const dome: Material = (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : 'rust1';
    if (c.night) return null;
    if (c.edge) return RN.copper[0];
    if (state >= 3) return lv(R.char, c.level);
    const a = Math.atan2(c.v - CUP.v, c.u - CUP.u);
    const rib = Math.abs(mod((a * 8) / Math.PI + 0.5, 1) - 0.5) < 0.1;
    if (rib) return lv(R.gold, c.level - 1);
    return lv(RN.copper, c.level);
  };
  s.ell(CUP.u, CUP.v, 98, 0.66, 0.66, 14, dome, { zMin: 98, cut: cupBroken });
  if (state < 4) {
    s.cyl(CUP.u, CUP.v, 0.17, 110, 117, (c) => {
      if (c.night) return mod(Math.floor(c.sx), 3) === 0 ? null : 'ochre2';
      if (c.edge) return S[0];
      return mod(Math.floor(c.sx), 3) === 0 ? lv(R.dark, c.level) : lv(S, c.level);
    });
    s.ell(CUP.u, CUP.v, 117, 0.2, 0.2, 5, plain(RN.copper, { rim: true }), { zMin: 117 });
    s.line(
      [
        [CUP.u, CUP.v, 121],
        [CUP.u, CUP.v, 126],
      ],
      'ochre1',
    );
    s.ell(CUP.u, CUP.v, 124, 0.06, 0.06, 2, plain(R.gold, { rim: true }));
    s.sprite(figure(SHIP_VANE, 'gold', 'shipVane'), 4, 9, CUP.u, CUP.v, 127);
  }

  // --- Pediment statues (Peace at the apex, two at the corners) -----------------------------------
  const peace = figure(PEACE, 'bronze', 'peace');
  s.sprite(peace, 3, 11, 4.5, 4.85, 80);
  for (const [i, u] of [3.1, 5.9].entries()) {
    if ((state === 3 && i === 1) || state >= 4) continue;
    s.sprite(peace, 3, 11, u, 4.85, 65);
  }
  if (state >= 3) s.sprite(figure(PEACE, 'bronze', 'peace'), 3, 2, 6.2, 5.85, 1);

  // --- Flags at the front corners ------------------------------------------------------------------
  for (const [i, u] of [0.9, 8.1].entries()) {
    const top = state >= 4 && i === 1 ? 82 : 98;
    s.line(
      [
        [u, 4.3, 64],
        [u, 4.3, top],
      ],
      'gray2',
    );
    s.line(
      [
        [u, 4.3, top],
        [u, 4.3, top + 1],
      ],
      'ochre2',
    );
    ov.push({
      sprite: state >= 2 ? 'lm.flag.nl.torn' : 'lm.flag.nl',
      u,
      v: 4.3,
      z: top,
      flag: true,
    });
  }

  // --- Steps, lamps, banner, rubble ----------------------------------------------------------------
  stairs(s, 2.9, 6.1, 5.9, 4.95, 1, 4, 3, stepMat(R.granite, decals));
  const lp = lamp(state >= 2);
  for (const u of [2.4, 6.6])
    s.sprite(lp.img, 2, 14, u, 5.6, 1, { emit: state >= 2 ? undefined : lp.night });
  for (const u of [0.6, 8.4]) s.sprite(lp.img, 2, 14, u, 5.5, 1, { emit: lp.night });
  banner(s, state, 3.2, 5.8, 4.99, 46, 9, 'NOU NEE');
  rubble(s, state, 2.9, 6.1, 5.0, 5.9, 1, 8, seed);
  rubble(s, state, 0.3, 2.8, 4.8, 5.9, 1, 5, seed + 1);
  rubble(s, state, 6.2, 8.7, 4.8, 5.9, 1, 5, seed + 2);
  return { scene: s, overlays: ov };
}
