/**
 * Stockholm — Riksdagshuset on Helgeandsholmen. Footprint 10 (u) × 6 (v). The grand curved
 * neo-baroque east front faces +v (Norrbro and Strömmen, the lit side): a rusticated granite
 * base, a long bowed facade of pale stone, and the central rounded bay with six giant columns,
 * a statue-lined attic and a copper-green dome. Copper mansard roofs; Swedish flags.
 */
import { Scene, type Material, type Plane, type ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, mod_, moduleColour, plain, sampleModule } from '../engine/materials';
import {
  banner,
  breakAbove,
  decalAt,
  rubble,
  roundStone,
  scatterDecals,
  scorchZones,
  stairs,
  stepMat,
  type DamageState,
} from '../engine/kit';
import type { Build, Overlay } from '../types';
import { lamp, marbleStatue } from '../props';
import {
  RN,
  fireOverlays,
  flat,
  seamRoof,
  sootAt,
  windowsAt,
  type WinPlace,
} from '../berlin/northkit';

export const RIKSDAG_W = 10;
export const RIKSDAG_D = 6;

const P = RN.pale;
const G = R.granite;
const CU = RN.copper;

/** Long front: a vertical cylinder far behind gives the gentle bow. */
const BOW = { uc: 5.0, vc: -6.0, r: 10.4 };
/** Central rounded bay. */
const BAY = { uc: 5.0, vc: 3.6, r: 1.55 };

const WIN = mod_(
  `
  .PPPP.
  PppppP
  .FFFF.
  .FgGF.
  .FggF.
  .FmmF.
  .FgGF.
  .FggF.
  .FggF.
  .ssss.
  `,
  {
    P: { r: P, d: 1 },
    p: { r: P, d: -1 },
    F: { r: P, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: P, d: -1 },
    s: { r: P, d: 1 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);
const WIN_UP = mod_(
  `
  .FFFF.
  .FgGF.
  .FggF.
  .FmmF.
  .FggF.
  .ssss.
  `,
  { F: { r: P, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: { r: P, d: -1 }, s: { r: P, d: 1 } },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);
const WIN_BASE = mod_(
  `
  .KKKK.
  KggggK
  KgGggK
  KggggK
  KggmgK
  KggggK
  `,
  { K: { r: G, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: { r: G, d: -2 } },
  { g: 'ochre1', G: 'ochre2' },
);
/** Arched bronze-and-glass doors in the bay base. */
const DOOR = mod_(
  `
  ..KKKKK..
  .KgggggK.
  KggGgggGK
  KgmmommgK
  KbbbobbbK
  KbybobybK
  KbbbobbbK
  KbybobybK
  KbbbobbbK
  KbbbobbbK
  `,
  {
    K: { r: G, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: 'earth1',
    o: 'earth0',
    b: 'earth1',
    y: 'ochre1',
  },
  { g: 'ochre2', G: 'ochre3', y: 'ochre2' },
);

export function buildRiksdag(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 5500;

  // --- Windows ------------------------------------------------------------------------------
  const wins: WinPlace[] = [];
  let id = 0;
  const frontV = (u: number): number => BOW.vc + Math.sqrt(BOW.r * BOW.r - (u - BOW.uc) ** 2);
  for (const c0 of [8, 18, 28, 38, 48, 106, 116, 126, 136, 146]) {
    const pl = frontV((c0 + 3) / 16);
    wins.push({ side: 'left', tag: 'body', c0, zTop: 34, m: WIN, id: id++, plane: pl });
    wins.push({ side: 'left', tag: 'body', c0, zTop: 46, m: WIN_UP, id: id++ });
    wins.push({ side: 'left', tag: 'body', c0, zTop: 13, m: WIN_BASE, id: id++ });
  }
  for (const c0 of [10, 20, 30, 40]) {
    wins.push({ side: 'right', tag: 'body', c0, zTop: 34, m: WIN, id: id++, plane: 9.7 });
    wins.push({ side: 'right', tag: 'body', c0, zTop: 46, m: WIN_UP, id: id++ });
    wins.push({ side: 'right', tag: 'body', c0, zTop: 13, m: WIN_BASE, id: id++ });
  }
  // Tall windows behind the bay's columns.
  for (const c0 of [60, 70, 84, 94])
    wins.push({ side: 'left', tag: 'bay', c0, zTop: 38, m: WIN, id: id++ });
  if (state >= 3) for (const f of fireOverlays(wins, state, seed)) ov.push(f);

  // --- Damage -------------------------------------------------------------------------------
  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'body', 4, 52, 2, 15],
      ['left', 'body', 106, 156, 2, 15],
      ['right', 'body', 8, 50, 2, 15],
      ['left', 'bay', 58, 102, 2, 14],
      ['left', 'stairs', 62, 98, 1, 6],
    ],
    1.3,
  );
  const holes: Array<{ side: 'left' | 'right'; fx: number; z: number; r: number }> =
    state >= 4
      ? [
          { side: 'left', fx: 30, z: 26, r: 8 },
          { side: 'right', fx: 26, z: 30, r: 7 },
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
      ? [[2.2, 1.6, 0.7]]
      : state >= 4
        ? [
            [2.2, 1.7, 1.2],
            [8.0, 2.0, 1.0],
          ]
        : [],
  );
  if (state === 3) ov.push({ sprite: 'lm.fx.smoke', u: 2.2, v: 1.6, z: 62 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 2.2, v: 1.8, z: 58 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 8.0, v: 2.1, z: 58 });
    ov.push({ sprite: 'lm.fx.fire.m', u: BAY.uc, v: BAY.vc + 0.6, z: 66 });
    ov.push({ sprite: 'lm.fx.smoke', u: BAY.uc, v: BAY.vc, z: 80 });
  }

  // --- Materials ------------------------------------------------------------------------------
  const interior: Material = (c) => {
    if (c.night) return c.z < 12 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
    if (state >= 3 && c.z < 10) return hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1';
    return c.z < 18 ? 'gray1' : 'ink';
  };
  const sideOf = (c: ShadeCtx): 'left' | 'right' => (c.side === 'right' ? 'right' : 'left');
  /** Courses: rusticated granite base, pale stone storeys, cornices. */
  const courses = (c: ShadeCtx, top: number): string => {
    const z = c.fz;
    if (z < 16) {
      if (z === 15) return lv(G, c.level + 1);
      if (mod(z, 4) === 3) return lv(G, c.level - 1);
      const row = Math.floor(z / 4);
      if (mod(c.fx + row * 4, 8) === 0) return lv(G, c.level - 1);
      return lv(G, c.level);
    }
    if (z === 16) return lv(P, c.level - 1);
    if (z >= top - 2) return lv(P, c.level + 1);
    if (z === top - 3) return lv(P, c.level - 1);
    if (z === top - 4) return mod(c.fx, 2) ? lv(P, c.level - 1) : lv(P, c.level);
    if (z === 37 || z === 38) return lv(P, c.level + (z === 38 ? 1 : -1));
    return lv(P, c.level);
  };
  const body: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.side === 'top') return c.night ? null : lv(P, c.level);
    const side = sideOf(c);
    if (holes.length && inHole(side, c.fx, c.fz, 2))
      return c.night ? null : lv(R.brick, c.level - (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
    const w = windowsAt(c, wins, state, seed);
    if (w !== undefined) return w;
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    const so = sootAt(c, wins, state, seed);
    if (so) return so;
    if (c.edge) return P[0];
    // Pilaster strips between the window bays of the bowed front.
    if (c.fz > 16 && c.fz < 46 && (side === 'left' ? mod(c.fx - 5, 10) : mod(c.fx - 7, 10)) === 0)
      return lv(P, c.level + 1);
    return courses(c, 52);
  };

  // --- Ground --------------------------------------------------------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side !== 'top') return lv(G, c.level - 1);
    if (c.edge) return lv(R.paving, 0);
    const ju = mod(c.u * 4, 1) < 0.07;
    const jv = mod(c.v * 4, 1) < 0.14;
    return lv(R.paving, c.level - (ju || jv ? 1 : 0));
  };
  s.box(0, RIKSDAG_W, 0, RIKSDAG_D, 0, 1, ground, { cast: false, tag: 'ground' });

  // --- The bowed main block ----------------------------------------------------------------------------
  const slabUV = (u0: number, u1: number, v0: number, z0: number, z1: number): Plane[] => [
    { nu: -1, nv: 0, nz: 0, c: -u0 },
    { nu: 1, nv: 0, nz: 0, c: u1 },
    { nu: 0, nv: -1, nz: 0, c: -v0 },
    { nu: 0, nv: 0, nz: -1, c: -z0 },
    { nu: 0, nv: 0, nz: 1, c: z1 },
  ];
  const bodyCut = holes.length
    ? (u: number, v: number, z: number, f: number): boolean => {
        if (f < 0) return inHole('left', Math.floor(u * 16), Math.floor(z));
        if (f === 1) return inHole('right', Math.floor(v * 16), Math.floor(z));
        return false;
      }
    : undefined;
  s.add(
    slabUV(0.3, 9.7, 0.4, 1, 52),
    [0.3, 9.7, 0.4, 4.4, 1, 52],
    body,
    { tag: 'body', cut: bodyCut },
    {
      kind: 'cyl',
      uc: BOW.uc,
      vc: BOW.vc,
      r: BOW.r,
    },
  );
  // Curved pierced balustrade along the bowed cornice.
  const balMat: Material = (c) =>
    c.night ? null : c.side === 'back' ? lv(P, 1) : c.edge ? P[0] : lv(P, c.level);
  s.add(
    slabUV(0.3, 9.7, 0.4, 52, 56),
    [0.3, 9.7, 0.4, 4.4, 52, 56],
    balMat,
    {
      tag: 'bal',
      cut: (u, v, z, f) => {
        if (f === 4) return Math.hypot(u - BOW.uc, v - BOW.vc) < BOW.r - 0.14;
        if (f < 0) return z > 53.5 && z < 54.5 + 0.5 && mod(Math.floor(u * 16), 3) === 0;
        return false;
      },
    },
    { kind: 'cyl', uc: BOW.uc, vc: BOW.vc, r: BOW.r },
  );
  // Copper mansard roof with dormers, ridge cresting.
  const roof = seamRoof(RN.copperDark, scorch);
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.8
      : undefined;
  s.hip(0.5, 9.5, 0.6, 3.15, 52, 70, [0.7, 1.275], roof, { cut: roofCut });
  const dormer: Material = (c) => {
    if (c.night)
      return c.side === 'left' && mod(c.fx, 16) > 5 && mod(c.fx, 16) < 10 && c.fz < 61
        ? 'ochre2'
        : null;
    if (c.edge) return P[0];
    if (c.side === 'left' || c.side === 'right') {
      const dx = mod(c.fx, 16);
      if (dx > 5 && dx < 10 && c.fz >= 56 && c.fz <= 60)
        return state >= 2 ? 'ink' : lv(R.dark, c.level);
      return lv(P, c.level);
    }
    return roof(c);
  };
  for (const u of [1.45, 2.45, 7.55, 8.55]) {
    s.box(u - 0.28, u + 0.28, 2.75, 3.35, 52, 61, dormer);
    s.gable(u - 0.34, u + 0.34, 2.7, 3.38, 61, 65, 'v', dormer);
  }
  // Chimneys.
  for (const [u, v] of [
    [1.2, 1.2],
    [8.6, 1.0],
  ] as const)
    s.box(u - 0.14, u + 0.14, v - 0.12, v + 0.12, 60, 72, flat(P, true));

  // --- Central bay: columns, attic with statues, copper dome ---------------------------------------
  const bayPlanes = (z0: number, z1: number, v0 = BAY.vc): Plane[] => [
    { nu: 0, nv: -1, nz: 0, c: -v0 },
    { nu: 0, nv: 0, nz: -1, c: -z0 },
    { nu: 0, nv: 0, nz: 1, c: z1 },
  ];
  const bayWall: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.side === 'top') return c.night ? null : lv(P, c.level);
    if (c.fz < 16) {
      const k = sampleModule(DOOR, c, 76, 11);
      if (k !== null) {
        if (state >= 3 && !c.night && 'bmoy'.includes(k))
          return hash(c.fx, c.fz) < 0.3 ? 'rust1' : 'ink';
        return moduleColour(DOOR, k, c);
      }
    }
    const w = windowsAt(c, wins, state, seed);
    if (w !== undefined) return w;
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return P[0];
    // Behind the colonnade: in shade.
    if (c.fz > 16 && c.fz < 46) return lv(P, Math.min(c.level, 2));
    return courses(c, 52);
  };
  s.add(
    bayPlanes(1, 52),
    [BAY.uc - BAY.r, BAY.uc + BAY.r, BAY.vc, BAY.vc + BAY.r, 1, 52],
    bayWall,
    { tag: 'bay' },
    {
      kind: 'cyl',
      uc: BAY.uc,
      vc: BAY.vc,
      r: BAY.r,
    },
  );
  // Six giant columns on the curve.
  const colR = BAY.r + 0.22;
  const colMat = roundStone(RN.pale);
  for (let k = 0; k < 6; k++) {
    const a = ((22 + k * 27.2) * Math.PI) / 180;
    const u = BAY.uc + Math.cos(a) * colR;
    const v = BAY.vc + Math.sin(a) * colR;
    const brokenTop = state >= 4 && (k === 1 || k === 4) ? 28 + k * 2 : 0;
    s.cyl(u, v, 0.15, 16, 18, flat(P));
    s.cyl(u, v, 0.12, 18, brokenTop || 43, colMat, {
      tag: 'col',
      cut: brokenTop ? breakAbove(brokenTop - 2, k) : undefined,
    });
    if (!brokenTop) s.cone(u, v, 0.12, 0.17, 43, 46, colMat);
  }
  // Base podium under the columns (rusticated granite), entablature ring and attic.
  const ring = (
    z0: number,
    z1: number,
    r: number,
    mat: Material,
    o: { tag?: string; cut?: (u: number, v: number, z: number, f: number) => boolean } = {},
  ): void => {
    s.add(bayPlanes(z0, z1), [BAY.uc - r, BAY.uc + r, BAY.vc, BAY.vc + r, z0, z1], mat, o, {
      kind: 'cyl',
      uc: BAY.uc,
      vc: BAY.vc,
      r,
    });
  };
  const podium: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return G[0];
    if (c.side === 'top') return lv(G, c.level);
    return courses(c, 52);
  };
  ring(1, 16, colR + 0.2, podium, {
    tag: 'bay',
    cut: (u, v, z, f) => f < 0 && z < 14 && Math.abs(u - BAY.uc) < 0.36 && v > BAY.vc,
  });
  const entab: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return c.fz < 50 && c.side === 'curve' ? 'stone4' : null;
    if (c.edge) return P[0];
    if (c.side === 'top') return lv(P, c.level);
    const z = c.fz;
    if (z >= 51) return lv(P, c.level + 1);
    if (z === 50) return mod(c.fx, 2) ? lv(P, c.level - 2) : lv(P, c.level);
    if (z === 46 || z === 48) return lv(P, c.level - 1);
    return lv(P, c.level);
  };
  const entCut =
    state >= 4
      ? (u: number, _v: number, z: number): boolean => Math.abs(u - 4.3) < 0.35 + Math.sin(z) * 0.06
      : undefined;
  ring(46, 53, colR + 0.18, entab, { cut: entCut });
  ring(53, 58, colR + 0.05, balMat, {
    tag: 'bal',
    cut: (u, v, z, f) => {
      if (f === 2) return Math.hypot(u - BAY.uc, v - BAY.vc) < colR - 0.1;
      return f < 0 && z > 54.5 && z < 56.5 && mod(Math.floor(u * 16), 3) === 0;
    },
  });
  // Statues on the attic.
  for (let k = 0; k < 4; k++) {
    const a = ((35 + k * 36.7) * Math.PI) / 180;
    const u = BAY.uc + Math.cos(a) * (colR - 0.02);
    const v = BAY.vc + Math.sin(a) * (colR - 0.02);
    if ((state === 3 && k === 2) || (state >= 4 && k % 2 === 0)) {
      s.sprite(marbleStatue('standing', true, true), 10, 8, u, Math.min(5.9, v + 1.6), 1);
      continue;
    }
    s.sprite(marbleStatue('standing', false, true), 4, 19, u, v, 53);
  }
  // Copper dome over the bay with a lantern and gilded crown finial.
  const dome: Material = (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return CU[0];
    const sc = scorch(c.u, c.v);
    if (state >= 3 && (sc || c.z < 64 + (state - 3) * 6)) return lv(R.char, c.level);
    const a = Math.atan2(c.v - BAY.vc, c.u - BAY.uc);
    const rib = Math.abs(mod((a * 10) / Math.PI + 0.5, 1) - 0.5) < 0.1;
    if (rib) return lv(CU, c.level - 1);
    if (mod(c.fz, 6) === 0) return lv(CU, c.level - 1);
    return lv(CU, c.level);
  };
  s.ell(BAY.uc, BAY.vc, 56, BAY.r - 0.05, BAY.r - 0.05, 24, dome, {
    zMin: 56,
    cut:
      state >= 4
        ? (u, v, z) => z > 62 && z < 74 && u > BAY.uc - 0.2 && u < BAY.uc + 0.7 && v > BAY.vc
        : undefined,
  });
  s.cyl(BAY.uc, BAY.vc, 0.28, 78, 86, (c) => {
    if (c.night) return mod(Math.floor(c.sx), 3) === 0 ? null : 'ochre2';
    if (c.edge) return P[0];
    return mod(Math.floor(c.sx), 3) === 0 ? lv(R.dark, c.level) : lv(P, c.level);
  });
  s.ell(BAY.uc, BAY.vc, 86, 0.3, 0.3, 7, plain(CU, { rim: true }), { zMin: 86 });
  if (state < 4) {
    s.line(
      [
        [BAY.uc, BAY.vc, 93],
        [BAY.uc, BAY.vc, 100],
      ],
      'ochre2',
    );
    s.ell(BAY.uc, BAY.vc, 97, 0.07, 0.07, 2, plain(R.gold, { rim: true }));
  }

  // Steps to the bay's doors.
  stairs(s, 4.3, 5.7, 5.95, 5.25, 1, 5, 3, stepMat(G, decals));

  // --- Flags on the roof ---------------------------------------------------------------------------------
  for (const [i, u] of [2.5, 7.5].entries()) {
    const top = state >= 4 && i === 0 ? 84 : 98;
    s.line(
      [
        [u, 1.85, 66],
        [u, 1.85, top],
      ],
      'gray2',
    );
    s.line(
      [
        [u, 1.85, top],
        [u, 1.85, top + 1],
      ],
      'ochre2',
    );
    ov.push({
      sprite: state >= 2 ? 'lm.flag.se.torn' : 'lm.flag.se',
      u,
      v: 1.85,
      z: top,
      flag: true,
    });
  }

  // Lamps along the quay side, banner, rubble.
  const lp = lamp(state >= 2);
  for (const u of [1.0, 3.6, 6.4, 9.0])
    s.sprite(lp.img, 2, 14, u, Math.min(5.8, frontV(u) + 1.3), 1, {
      emit: state >= 2 && u < 5 ? undefined : lp.night,
    });
  banner(s, state, 4.15, 5.85, BAY.vc + colR + 0.25, 40, 9, 'NOG NU');
  rubble(s, state, 3.6, 6.4, 5.3, 5.95, 1, 7, seed);
  rubble(s, state, 0.4, 3.0, 4.2, 5.9, 1, 5, seed + 1);
  rubble(s, state, 7.0, 9.6, 4.2, 5.9, 1, 5, seed + 2);
  return { scene: s, overlays: ov };
}
