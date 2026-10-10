/**
 * Berlin — the Reichstag (Bundestag). Footprint 10 (u) × 8 (v). The west portico (six
 * Corinthian columns, "DEM DEUTSCHEN VOLKE" on the frieze, pediment) and its broad stair face
 * +v (Platz der Republik, the lit face). Four corner towers fly the German flag; Foster's glass
 * dome sits over the plenary hall: a see-through lattice (front panes cut away) showing the
 * far half of the glazing, the spiral ramps and the inner mirror cone.
 */
import { Scene, type Material, type ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, mod_, moduleColour, plain, sampleModule } from '../engine/materials';
import {
  balustradeCut,
  banner,
  breakAbove,
  column,
  decalAt,
  rubble,
  scatterDecals,
  scorchZones,
  stairs,
  stepMat,
  type DamageState,
} from '../engine/kit';
import type { Build, Overlay } from '../types';
import { lamp } from '../props';
import {
  RN,
  facesViewer,
  fireOverlays,
  letterAt,
  letters,
  sootAt,
  windowsAt,
  type WinPlace,
} from './northkit';

export const REICHSTAG_W = 10;
export const REICHSTAG_D = 8;

const S = RN.sandstone;
const SD = RN.sandDark;

/** Piano-nobile window with a segmental pediment (5 × 16). */
const WIN_MAIN = mod_(
  `
  .PPP.
  PpppP
  sssss
  FgGgF
  FgggF
  FgggF
  FmmmF
  FgGgF
  FgggF
  FgggF
  FgggF
  FmmmF
  FgggF
  FgggF
  FgggF
  sssss
  `,
  {
    P: { r: S, d: 1 },
    p: { r: S, d: -1 },
    F: { r: S, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: S, d: -1 },
    s: { r: S, d: 1 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

/** Tall round-arched tower window (7 × 20). */
const WIN_TOWER = mod_(
  `
  ..FFF..
  .FgggF.
  FggGggF
  FgggggF
  FgmmmgF
  FgggggF
  FggmggF
  FggGggF
  FggmggF
  FggmggF
  FmmmmmF
  FggmggF
  FggGggF
  FggmggF
  FggmggF
  FggmggF
  FggmggF
  sssssss
  .bbbbb.
  .bkbkb.
  `,
  {
    F: { r: S, d: 1 },
    g: R.dark,
    G: { r: R.glass, d: 0 },
    m: { r: S, d: -1 },
    s: { r: S, d: 1 },
    b: { r: S, d: 0 },
    k: { r: S, d: -2 },
  },
  { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
);

/** Rusticated base-storey window, round-headed (5 × 7). */
const WIN_BASE = mod_(
  `
  .KKK.
  KgggK
  KgGgK
  KgggK
  KgmgK
  KgggK
  KgggK
  `,
  { K: { r: S, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 }, m: { r: S, d: -2 } },
  { g: 'ochre1', G: 'ochre2' },
);

/** Small attic window (3 × 3). */
const WIN_ATTIC = mod_(
  `
  ggg
  gGg
  ggg
  `,
  { g: R.dark, G: { r: R.glass, d: -1 } },
  { g: 'ochre1', G: 'ochre2' },
);

/** West portal: bronze double door under a round arch (11 × 22). */
const PORTAL = mod_(
  `
  ...PPPPP...
  ..PpppppP..
  .PppbbbppP.
  .PpbbobbpP.
  PpbbbobbbpP
  PpbbbobbbpP
  FFbyBoyBbFF
  FbbBBoBBbbF
  FbbbbobbbbF
  FbyBboByBbF
  FbBBBoBBBbF
  FbbbbobbbbF
  FbyBboByBbF
  FbBBBoBBBbF
  FbbbbobbbbF
  FbyBboByBbF
  FbBBBoBBBbF
  FbbbbobbbbF
  FbbbbobbbbF
  FbbbbobbbbF
  FbbbbobbbbF
  FbbbbobbbbF
  `,
  {
    P: { r: S, d: 1 },
    p: { r: S, d: -1 },
    F: { r: S, d: 0 },
    b: 'earth1',
    B: 'earth2',
    o: 'earth0',
    y: 'ochre1',
  },
  { b: 'ochre1', B: 'ochre1', y: 'ochre3' },
);

/** Tympanum: the federal eagle shield flanked by reclining figures (L lit, S shade). */
const RELIEF = mod_(
  `
  ........................LL........................
  .......................LLLS.......................
  .....................LLLLLLLS.....................
  ..................LL.LLLLLLLS.LL..................
  ..........LL.....LLLLLLLLLLLLLLLS.....LL..........
  .........LLLS....LLLL.LLLLL.LLLLS....LLLS.........
  .....LL.LLLLLS....LLLLLLLLLLLLLS....LLLLLS.LL.....
  ...LLLLLLLLLLLS....LLLLLLLLLLLS....LLLLLLLLLLLS...
  .LLLLLLLLLLLLLLS.....LLLLLLLS.....LLLLLLLLLLLLLLS.
  LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
  `,
  { L: { r: S, d: 1 }, S: { r: S, d: 0 } },
);

const INSCRIPTION = letters('DEM DEUTSCHEN VOLKE');

/** Dome geometry (shared with the night mask and the lattice cut). */
const DOME = { uc: 5.0, vc: 2.9, zc: 61, ru: 1.6, rv: 1.6, rz: 38 };
const TOWERS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.1, 1.65, 0.2, 1.85],
  [8.35, 9.9, 0.2, 1.85],
  [0.1, 1.65, 4.0, 5.65],
  [8.35, 9.9, 4.0, 5.65],
];
const TOWER_TOP = 72;

export function buildReichstag(state: DamageState): Build {
  const s = new Scene();
  const ov: Overlay[] = [];
  const seed = 4400;

  // --- Windows -----------------------------------------------------------------------------
  const wins: WinPlace[] = [];
  let id = 0;
  const add = (
    side: 'left' | 'right',
    tag: string,
    c0: number,
    zTop: number,
    m: typeof WIN_MAIN,
    plane?: number,
  ): void => {
    wins.push({ side, tag, c0, zTop, m, id: id++, plane });
  };
  // Front (west) bays between towers and portico, side (south) bays between the towers.
  for (const c0 of [28, 36, 120, 128]) {
    add('left', 'body', c0, 40, WIN_MAIN, 5.5);
    add('left', 'body', c0, 12, WIN_BASE);
    add('left', 'body', c0 + 1, 54, WIN_ATTIC);
  }
  for (const c0 of [33, 41, 49, 57]) {
    add('right', 'body', c0, 40, WIN_MAIN, 9.75);
    add('right', 'body', c0, 12, WIN_BASE);
    add('right', 'body', c0 + 1, 54, WIN_ATTIC);
  }
  // Portico back wall.
  for (const c0 of [50, 60, 96, 106]) add('left', 'body', c0, 40, WIN_MAIN);
  // Towers: one great arched window per visible face, a base window below.
  for (const [side, c0, plane] of [
    ['left', 10, 5.65],
    ['left', 143, 5.65],
    ['right', 14, 9.9],
    ['right', 74, 9.9],
  ] as const) {
    add(side, 'tower', c0, 46, WIN_TOWER, plane);
    add(side, 'tower', c0 + 1, 12, WIN_BASE);
  }
  if (state >= 3) for (const f of fireOverlays(wins, state, seed)) ov.push(f);

  // --- Damage bookkeeping ------------------------------------------------------------------
  const decals = scatterDecals(
    state,
    seed,
    [
      ['left', 'body', 25, 44, 2, 15],
      ['left', 'body', 117, 135, 2, 15],
      ['left', 'tower', 2, 25, 2, 15],
      ['left', 'tower', 135, 157, 2, 15],
      ['right', 'body', 30, 63, 2, 15],
      ['right', 'tower', 65, 89, 2, 15],
      ['left', 'podium', 44, 116, 2, 15],
      ['left', 'stairs', 44, 116, 2, 14],
    ],
    1.3,
  );
  const holes: Array<{ side: 'left' | 'right'; fx: number; z: number; r: number }> =
    state >= 4
      ? [
          { side: 'left', fx: 128, z: 28, r: 7 },
          { side: 'right', fx: 45, z: 24, r: 8 },
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
      ? [[7.6, 1.5, 0.75]]
      : state >= 4
        ? [
            [7.5, 1.5, 1.2],
            [2.3, 3.8, 1.0],
            [5.2, 4.7, 0.6],
          ]
        : [],
  );
  if (state === 3) ov.push({ sprite: 'lm.fx.smoke', u: 7.6, v: 1.5, z: 60 });
  if (state >= 4) {
    ov.push({ sprite: 'lm.fx.fire.l', u: 7.5, v: 1.6, z: 58 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 2.3, v: 3.8, z: 58 });
    ov.push({ sprite: 'lm.fx.fire.m', u: 5.4, v: 3.4, z: 64 });
    ov.push({ sprite: 'lm.fx.smoke', u: 5.2, v: 2.8, z: 84 });
  }

  // --- Materials ------------------------------------------------------------------------------
  const interior: Material = (c) => {
    if (c.night) return c.z < 12 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
    if (state >= 3 && c.z < 10) return hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1';
    return c.z < 18 ? 'gray1' : 'ink';
  };
  const holeEdge = (c: ShadeCtx, side: 'left' | 'right'): string | null | undefined => {
    if (!holes.length || !inHole(side, c.fx, c.fz, 2)) return undefined;
    if (c.night) return null;
    return lv(R.brick, c.level - (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
  };
  /** Shared wall courses: rusticated base, string course, cornice, attic. */
  const courses = (c: ShadeCtx, quoin: boolean): string => {
    const z = c.fz;
    if (z < 16) {
      if (z === 15) return lv(S, c.level + 1);
      if (z <= 2) return lv(SD, c.level);
      if (mod(z, 4) === 3) return lv(SD, c.level);
      const row = Math.floor(z / 4);
      if (mod(c.fx + row * 5, 10) === 0) return lv(SD, c.level);
      return lv(S, c.level);
    }
    if (z === 16) return lv(SD, c.level);
    if (z >= 55) return lv(S, c.level + 1);
    if (z === 50) return lv(SD, c.level);
    if (z === 49) return lv(S, c.level + 1);
    if (z === 48) return mod(c.fx, 2) === 0 ? lv(S, c.level) : lv(SD, c.level);
    if (z === 47) return lv(S, c.level + 1);
    if (z === 46) return lv(SD, c.level);
    if (z > 50) return z === 51 ? lv(S, c.level - 1) : lv(S, c.level);
    if (quoin) return mod(z, 6) === 0 ? lv(SD, c.level) : lv(S, c.level + (c.level >= 3 ? 1 : 0));
    return lv(S, c.level);
  };

  const bodyWall: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.side === 'top') return c.night ? null : lv(S, c.level);
    const side = c.side === 'right' ? 'right' : 'left';
    const he = holeEdge(c, side);
    if (he !== undefined) return he;
    // Portico back wall: the bronze portal.
    if (side === 'left' && c.fx >= 42 && c.fx < 118) {
      const k = sampleModule(PORTAL, c, 75, 37);
      if (k !== null) {
        if (state >= 3 && !c.night && 'bBoy'.includes(k))
          return hash(c.fx, c.fz) < 0.3 ? 'rust1' : 'ink';
        return moduleColour(PORTAL, k, c);
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
    // Portico recess in deep shade.
    if (side === 'left' && c.fx > 42 && c.fx < 118 && z >= 16 && z < 56)
      return lv(S, Math.min(c.level, 2) - (z > 44 ? 1 : 0));
    // Giant pilasters between the bays (piano nobile).
    if (z > 16 && z < 46) {
      const pil = side === 'left' ? [26, 34, 42, 118, 126, 134] : [31, 39, 47, 55, 63];
      for (const p of pil) {
        if (c.fx === p) return lv(S, c.level + 1);
        if (c.fx === p + 1) return lv(S, c.level - 1);
      }
    }
    return courses(c, false);
  };

  const towerWall: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.side === 'top') return c.night ? null : lv(S, c.level);
    const side = c.side === 'right' ? 'right' : 'left';
    const w = windowsAt(c, wins, state, seed);
    if (w !== undefined) return w;
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    const so = sootAt(c, wins, state, seed, 18);
    if (so) return so;
    if (c.edge) return S[0];
    const z = c.fz;
    const t = c.prim.aabb;
    const a0 = side === 'left' ? t[0] : t[2];
    const a1 = side === 'left' ? t[1] : t[3];
    const local = c.fx - Math.floor(a0 * 16);
    const span = Math.floor(a1 * 16) - Math.floor(a0 * 16);
    const mid = span / 2;
    // Upper stage: recessed panel with a round oculus, dentil cornice on top.
    if (z >= TOWER_TOP - 2) return lv(S, c.level + 1);
    if (z === TOWER_TOP - 3) return lv(SD, c.level);
    if (z === TOWER_TOP - 4) return mod(c.fx, 2) ? lv(SD, c.level) : lv(S, c.level + 1);
    if (z > 51 && z < TOWER_TOP - 5) {
      const dx = local + 0.5 - mid;
      const dz = z - 60;
      const r = Math.hypot(dx, dz * 1.1);
      if (r < 3) return state >= 2 && hash(c.fx, 7) < 0.5 ? 'ink' : lv(R.dark, c.level);
      if (r < 4.2) return lv(S, c.level + 1);
      if (Math.abs(dx) < mid - 3 && z > 53 && z < TOWER_TOP - 7) return lv(S, c.level - 1);
    }
    // Corner quoins (rusticated edges).
    const quoin = local <= 2 || local >= span - 2;
    if (quoin && z > 16 && z < 46) return mod(z, 6) < 3 ? lv(S, c.level + 1) : lv(SD, c.level);
    // Paired pilasters flanking the great window.
    if (z > 16 && z < 46 && (Math.abs(local - mid) === 6 || Math.abs(local - mid) === 7))
      return lv(S, c.level + (local < mid ? 1 : -1));
    return courses(c, quoin);
  };

  // --- Ground -----------------------------------------------------------------------------------
  const ground: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    if (c.edge) return lv(R.paving, 0);
    // Granite setts with a lighter band along the lawn edge.
    const ju = mod(c.u * 4, 1) < 0.07;
    const jv = mod(c.v * 4, 1) < 0.14;
    return lv(R.paving, c.level - (ju || jv ? 1 : 0));
  };
  s.box(0, REICHSTAG_W, 0, REICHSTAG_D, 0, 1, ground, { cast: false, tag: 'ground' });

  // --- Main block -------------------------------------------------------------------------------
  const bodyCut = holes.length
    ? (u: number, v: number, z: number, f: number): boolean => {
        if (f === 3) return inHole('left', Math.floor(u * 16), Math.floor(z));
        if (f === 1) return inHole('right', Math.floor(v * 16), Math.floor(z));
        return false;
      }
    : undefined;
  s.box(0.25, 9.75, 0.35, 5.5, 1, 56, bodyWall, { tag: 'body', cut: bodyCut });
  const roofM: Material = (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return R.slate[1];
    const sc = scorch(c.u, c.v);
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    return lv(RN.lead, c.level - (mod(c.fz, 3) === 0 ? 1 : 0));
  };
  const roofCut =
    state >= 4
      ? (u: number, v: number): boolean =>
          scorch(u, v) === 2 && hash(Math.floor(u * 3), Math.floor(v * 3)) < 0.8
      : undefined;
  s.hip(0.5, 9.5, 0.6, 5.25, 56, 60, 0.9, roofM, { cut: roofCut });
  // Balustrade along the front and side cornice.
  const bal: Material = (c) => (c.night ? null : c.edge ? S[0] : lv(S, c.level));
  s.box(1.65, 8.35, 5.32, 5.5, 56, 60, bal, { cut: balustradeCut(56, 60) });
  s.box(9.57, 9.75, 1.85, 4.0, 56, 60, bal, { cut: balustradeCut(56, 60) });

  // --- Corner towers ----------------------------------------------------------------------------
  TOWERS.forEach(([u0, u1, v0, v1], i) => {
    s.box(u0, u1, v0, v1, 1, TOWER_TOP, towerWall, { tag: 'tower' });
    const front = i === 3; // the near tower loses its crown in state 4
    const cut = state >= 4 && front ? breakAbove(TOWER_TOP + 2, 3) : undefined;
    // Set-back crown storey with a pierced balustrade, corner pedestals with obelisk finials.
    const crown: Material = (c) => {
      if (c.side === 'back') return interior(c);
      if (c.night) return null;
      if (c.edge) return S[0];
      if (c.side === 'top') return lv(S, c.level);
      if (c.fz >= TOWER_TOP + 7) return lv(S, c.level + 1);
      if (c.fz === TOWER_TOP + 6) return lv(SD, c.level);
      if (mod(c.fx, 4) === 1 && c.fz > TOWER_TOP + 1) return lv(SD, c.level);
      return lv(S, c.level);
    };
    s.box(u0 + 0.12, u1 - 0.12, v0 + 0.12, v1 - 0.12, TOWER_TOP, TOWER_TOP + 9, crown, {
      tag: 'crown',
      cut,
    });
    const fin = plain(S, { rim: true });
    for (const [pu, pv] of [
      [u0 + 0.1, v1 - 0.1],
      [u1 - 0.1, v1 - 0.1],
      [u1 - 0.1, v0 + 0.1],
      [u0 + 0.1, v0 + 0.1],
    ] as const) {
      if (state >= 4 && front) continue;
      s.box(pu - 0.11, pu + 0.11, pv - 0.11, pv + 0.11, TOWER_TOP, TOWER_TOP + 5, fin, { cut });
      s.prismN(pu, pv, 0.07, 0.02, TOWER_TOP + 5, TOWER_TOP + 14, 4, fin);
    }
    // Flagpole + German flag.
    const pu = (u0 + u1) / 2;
    const pv = (v0 + v1) / 2;
    const top = state >= 4 ? (front ? TOWER_TOP + 10 : TOWER_TOP + 22) : TOWER_TOP + 32;
    if (state >= 4 && front) {
      ov.push({ sprite: 'lm.fx.fire.m', u: pu, v: pv, z: TOWER_TOP + 4 });
      return;
    }
    s.line(
      [
        [pu, pv, TOWER_TOP + 9],
        [pu, pv, top],
      ],
      'gray2',
    );
    s.line(
      [
        [pu, pv, top],
        [pu, pv, top + 1],
      ],
      'ochre2',
    );
    ov.push({
      sprite: state >= 2 ? 'lm.flag.de.torn' : 'lm.flag.de',
      u: pu,
      v: pv,
      z: top,
      flag: true,
    });
  });

  // --- The glass dome ---------------------------------------------------------------------------
  const D = DOME;
  // Stone drum ring the dome stands on.
  const drum: Material = (c) => {
    if (c.side === 'top') {
      // The plenary hall's glass ceiling, seen through the dome.
      const r = Math.hypot(c.u - D.uc, c.v - D.vc);
      if (r > D.ru - 0.02) return c.night ? null : c.edge ? 'zinc1' : 'zinc3';
      const grid = mod(c.u * 8, 1) < 0.15 || mod(c.v * 8, 1) < 0.15;
      if (c.night) return grid ? 'ochre2' : 'ochre4';
      if (state >= 3) return grid ? 'ink' : 'gray1';
      return grid ? 'zinc0' : 'zinc1';
    }
    if (c.night) return null;
    return lv(RN.steel, c.level + (c.fz === D.zc - 1 ? 1 : 0));
  };
  s.cyl(D.uc, D.vc, D.ru + 0.18, 56, D.zc, drum, { tag: 'drum', edges: false });
  const domeHole = (u: number, v: number, z: number): boolean => {
    if (state < 4) return false;
    // A torn gap in the lattice on the near-right flank.
    const a = Math.atan2(v - D.vc, u - D.uc);
    return a > -0.35 && a < 0.75 && z > D.zc + 6 + Math.sin(a * 9) * 3 && z < D.zc + 27;
  };
  const latticeAt = (u: number, v: number, z: number): { rib: boolean; ring: boolean } => {
    const a = Math.atan2(v - D.vc, u - D.uc);
    const k = mod((a / (2 * Math.PI)) * 24, 1);
    const e = (z - D.zc) / D.rz;
    // Ribs converge toward the top: keep them ~1 px wide on screen.
    const w = 0.13 / Math.max(0.35, Math.sqrt(Math.max(0, 1 - e * e)));
    return { rib: k < w, ring: mod(z - D.zc, 4) < 1 };
  };
  const domeCut = (u: number, v: number, z: number, f: number): boolean => {
    if (f >= 0) return false;
    if (!facesViewer(u, v, z, D)) return false;
    if (domeHole(u, v, z)) return true;
    const l = latticeAt(u, v, z);
    return !l.rib && !l.ring;
  };
  const smoky = (c: ShadeCtx): boolean =>
    state >= 3 && c.z < D.zc + (state >= 4 ? 30 : 16) + Math.sin(c.u * 7) * 3;
  const domeMat: Material = (c) => {
    if (c.side === 'back') {
      // Far half of the glazing seen through the near panes, and the hall's glass ceiling.
      const l = latticeAt(c.u, c.v, c.z);
      if (c.night) return l.rib || l.ring ? 'ochre2' : c.z < D.zc + 2 ? 'ochre4' : 'ochre3';
      if (smoky(c))
        return l.rib || l.ring ? 'gray1' : hash(c.px >> 1, c.py >> 1) < 0.5 ? 'gray2' : 'gray3';
      if (l.rib || l.ring) return 'zinc3';
      if (state >= 2 && hash(Math.floor(c.u * 24), Math.floor(c.z / 4), 5) < 0.25)
        return hash(c.px, c.py) < 0.5 ? 'ink' : 'zinc1';
      // Sky reflection brighter toward the upper-left of the far glazing.
      return c.sx < (D.uc - D.vc) * 16 - 2 && c.z > D.zc + 14 ? 'zinc3' : 'zinc2';
    }
    if (c.night) return 'ochre2';
    // Near lattice: bright steel members, catch-lights on the upper-left.
    if (c.edge) return 'zinc1';
    if (smoky(c)) return 'gray2';
    if (c.rim && c.lambert > 0.45) return 'white';
    if (c.lambert > 0.8 && !c.shadow) return 'gray7';
    return c.level >= 3 ? 'zinc4' : c.level === 2 ? 'zinc3' : 'zinc2';
  };
  s.ell(D.uc, D.vc, D.zc, D.ru, D.rv, D.rz, domeMat, {
    zMin: D.zc,
    cut: domeCut,
    tag: 'dome',
    emit: (c) => {
      if (c.side !== 'back') return 'ochre2';
      const l = latticeAt(c.u, c.v, c.z);
      return l.rib || l.ring ? 'ochre2' : 'ochre3';
    },
  });
  // Viewing platform ring and the open oculus at the crown.
  const oculus: Material = (c) => {
    if (c.night) return c.side === 'back' ? 'ochre3' : null;
    if (c.side === 'back') return 'zinc1';
    if (c.edge) return 'zinc0';
    return lv(RN.steel, c.level + (c.side === 'top' ? 0 : 1));
  };
  s.cyl(D.uc, D.vc, 0.42, D.zc + D.rz - 4, D.zc + D.rz + 1, oculus, {
    tag: 'dome',
    cut: (u, v, _z, f) => f === 1 && Math.hypot(u - D.uc, v - D.vc) < 0.28,
  });
  // Inner mirror cone (state 4: fallen).
  if (state < 4) {
    const cone: Material = (c) => {
      const a = Math.atan2(c.v - D.vc, c.u - D.uc);
      const facet = Math.floor((a / (2 * Math.PI)) * 30 + 30);
      const row = Math.floor((c.z - D.zc) / 4);
      const k = mod(facet + row, 3);
      if (c.night) return k === 0 ? 'white' : 'ochre4';
      if (state >= 3 && c.z < D.zc + 12) return k === 0 ? 'gray2' : 'gray1';
      // Hundreds of mirrors: bright facets reflecting the sky, darker ones the hall.
      if (k === 0) return c.lambert > 0.2 ? 'white' : 'zinc4';
      if (k === 1) return c.lambert > 0.2 ? 'sky' : 'zinc3';
      return c.lambert > 0.2 ? 'zinc4' : 'zinc2';
    };
    s.cone(D.uc, D.vc, 0.16, 0.74, D.zc, D.zc + 27, cone, {
      tag: 'cone',
      cast: false,
      edges: false,
    });
  }
  // The two spiral ramps hugging the glazing.
  for (const ph of [0, Math.PI]) {
    const pts: Array<[number, number, number]> = [];
    for (let k = 0; k <= 120; k++) {
      const t = k / 120;
      const z = D.zc + 3 + t * (D.rz - 9);
      const e = (z - D.zc) / D.rz;
      const r = D.ru * Math.sqrt(Math.max(0, 1 - e * e)) - 0.12;
      const a = ph + t * Math.PI * 2 * 1.5;
      pts.push([D.uc + Math.cos(a) * r, D.vc + Math.sin(a) * r, z]);
    }
    s.line(pts, state >= 3 ? 'gray2' : 'gray6', { emit: 'ochre4' });
    s.line(
      pts.map(([u, v, z]) => [u, v, z - 1] as [number, number, number]),
      state >= 3 ? 'gray1' : 'zinc2',
    );
  }

  // --- West portico -------------------------------------------------------------------------------
  const podMat: Material = (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return S[0];
    if (c.side === 'top') return lv(S, c.level);
    if (c.fz === 15) return lv(S, c.level + 1);
    if (mod(c.fz, 4) === 3) return lv(SD, c.level);
    return lv(S, c.level);
  };
  s.box(2.65, 7.35, 5.5, 6.45, 1, 16, podMat, { tag: 'podium' });
  stairs(s, 2.65, 7.35, 7.85, 6.45, 1, 16, 6, stepMat(S, decals));
  // Low cheek walls with lamps.
  for (const u0 of [2.35, 7.35]) s.box(u0, u0 + 0.3, 6.45, 7.85, 1, 6, podMat, { tag: 'podium' });
  const broken =
    state >= 4
      ? new Map([
          [1, 30],
          [4, 22],
        ])
      : new Map<number, number>();
  for (let k = 0; k < 6; k++) {
    column(s, {
      u: 3.0 + k * 0.8,
      v: 6.15,
      z0: 16,
      z1: 47,
      r: 0.16,
      ramp: RN.sandPale,
      brokenAt: broken.get(k),
      tag: 'col',
    });
  }
  if (state >= 4) {
    const rub = plain(RN.sandPale);
    s.cyl(3.3, 7.0, 0.16, 6, 11, rub);
    s.box(5.4, 5.8, 6.9, 7.3, 3, 8, rub);
    s.hip(6.2, 6.8, 7.2, 7.7, 1, 6, 0.28, rub);
    s.hip(0.7, 1.5, 6.0, 6.7, 1, 6, 0.38, plain(R.brick));
    s.hip(8.4, 9.3, 6.2, 6.9, 1, 7, 0.4, plain(S));
  }
  const entCut =
    state >= 4
      ? (u: number, _v: number, z: number): boolean =>
          Math.abs(u - 3.85) < 0.42 + Math.sin(z * 0.9) * 0.08 - (z - 47) * 0.01
      : undefined;
  const textC0 = Math.round(5.0 * 16 - INSCRIPTION.w / 2);
  const entab: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return c.side === 'left' && letterAt(INSCRIPTION, c, textC0, 55) ? 'ochre3' : null;
    if (c.edge) return S[0];
    if (c.side === 'top') return lv(S, c.level);
    const z = c.fz;
    if (c.side === 'left' && letterAt(INSCRIPTION, c, textC0, 55)) {
      if (state >= 3 && c.fx > textC0 + 20 && c.fx < textC0 + 32) return lv(R.char, c.level);
      return state >= 1 && c.fx >= textC0 + 52 && c.fx < textC0 + 56 && c.fz < 53
        ? 'crim2' // someone sprayed over the K
        : 'earth1';
    }
    if (z >= 57) return lv(S, c.level + 1);
    if (z === 56) return mod(c.fx, 2) ? lv(SD, c.level) : lv(S, c.level);
    if (z === 50) return lv(S, c.level + 1);
    if (z === 49 || z === 47) return lv(SD, c.level);
    return lv(S, c.level);
  };
  s.box(2.6, 7.4, 5.5, 6.5, 47, 58, entab, { cut: entCut, tag: 'entab' });
  const pedCut =
    state >= 4
      ? (u: number, _v: number, z: number): boolean =>
          u > 3.0 && u < 4.4 + Math.sin(z * 0.7) * 0.1 && z < 70 - (u - 3.0) * 4
      : undefined;
  const pediment: Material = (c) => {
    if (c.side === 'back') return interior(c);
    if (c.night) return null;
    if (c.edge) return S[0];
    if (c.side !== 'left') return roofM(c);
    const apexZ = 72 - (Math.abs(c.u - 5.0) / 2.4) * 14;
    const fromTop = apexZ - c.z;
    if (fromTop < 2) return lv(S, c.level + 1);
    if (fromTop < 3) return lv(SD, c.level);
    if (c.fz <= 59) return c.fz === 59 ? lv(SD, c.level) : lv(S, c.level + 1);
    const rk = sampleModule(RELIEF, c, 55, 69);
    if (rk) {
      const col = moduleColour(RELIEF, rk, c)!;
      return state >= 3 && hash(c.fx, c.fz) < 0.3 ? lv(R.char, c.level) : col;
    }
    return lv(S, c.level - 2);
  };
  s.gable(2.6, 7.4, 5.5, 6.55, 58, 72, 'v', pediment, { cut: pedCut, tag: 'pediment' });
  // Acroteria: small sculpted groups at the pediment corners and apex.
  const acro = plain(RN.sandPale, { rim: true });
  for (const [u, z0] of [
    [2.75, 58],
    [7.25, 58],
  ] as const) {
    if (state >= 4 && u < 5) continue;
    s.box(u - 0.12, u + 0.12, 6.3, 6.5, z0, z0 + 3, acro);
    s.ell(u, 6.4, z0 + 3, 0.1, 0.1, 5, acro, { zMin: z0 + 3 });
  }

  // --- Lamps, banner, rubble ------------------------------------------------------------------------
  const lp = lamp(state >= 2);
  for (const u of [2.5, 7.5])
    s.sprite(lp.img, 2, 14, u, 7.2, 6, { emit: state >= 2 ? undefined : lp.night });
  for (const u of [1.0, 9.0]) s.sprite(lp.img, 2, 14, u, 7.4, 1, { emit: lp.night });
  banner(s, state, 3.15, 6.85, 6.4, 44, 10, 'NEIN DANKE');
  rubble(s, state, 2.8, 7.2, 5.6, 6.35, 16, 9, seed);
  rubble(s, state, 0.3, 2.3, 6.0, 7.8, 1, 6, seed + 1);
  rubble(s, state, 7.7, 9.7, 6.0, 7.8, 1, 6, seed + 2);
  return { scene: s, overlays: ov };
}
