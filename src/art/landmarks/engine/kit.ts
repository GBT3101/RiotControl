/**
 * Architecture kit shared by every landmark: classical columns, stairs, balustrades, window
 * painting with damage states, graffiti / poster decals, soot and fire glow.
 */
import type { SwatchName } from '../../palette';
import { keyGrid, type KeyGrid } from '../../lib/grid';
import {
  R,
  hash,
  lv,
  mod,
  plain,
  type Module,
  type Ramp5,
  sampleModule,
  moduleColour,
} from './materials';
import type { Material, Scene, ShadeCtx } from './scene';

// ---------------------------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------------------------

/** 0 pristine · 1 graffiti & posters · 2 smashed windows · 3 fires & soot · 4 near-collapse. */
export type DamageState = 0 | 1 | 2 | 3 | 4;
export const DAMAGE_STATES: readonly DamageState[] = [0, 1, 2, 3, 4];

/** Window status derived from the damage state and a per-window id. */
export type WinStatus = 'ok' | 'smashed' | 'burning' | 'gutted';

export function windowStatus(state: DamageState, id: number, seed = 0): WinStatus {
  if (state < 2) return 'ok';
  const h = hash(id, seed, 17);
  if (state === 2) return h < 0.62 ? 'smashed' : 'ok';
  if (state === 3) return h < 0.16 ? 'burning' : h < 0.32 ? 'gutted' : h < 0.75 ? 'smashed' : 'ok';
  return h < 0.3 ? 'burning' : h < 0.62 ? 'gutted' : 'smashed';
}

/**
 * Paint a window module with its damage status. Module keys: 'g' glass, 'G' glass highlight,
 * 'm' mullion/transom — everything else is frame. Returns undefined outside the module.
 */
export function paintWindow(
  m: Module,
  c: ShadeCtx,
  c0: number,
  zTop: number,
  status: WinStatus,
): string | null | undefined {
  const k = sampleModule(m, c, c0, zTop);
  if (k === null) return undefined;
  const glass = k === 'g' || k === 'G' || k === 'm';
  if (!glass || status === 'ok') {
    if (glass) return moduleColour(m, k, c);
    if (c.night) return null;
    if (status === 'gutted' || status === 'burning') {
      // Frames scorched near the top of the opening.
      const my = zTop - c.fz;
      if (my < 4 && hash(c.fx, c.fz) < 0.6) return lv(R.char, c.level);
    }
    return moduleColour(m, k, c);
  }
  const mx = c.fx - c0;
  const my = zTop - c.fz;
  const h = m.g.h;
  if (status === 'smashed') {
    const r = hash(mx * 7 + c0, my * 3 + zTop, 5);
    if (c.night) return r < 0.3 ? 'ochre1' : null;
    if (k === 'm') return r < 0.5 ? 'ink' : lv(R.glass, c.level - 1);
    return r < 0.35 ? 'zinc2' : r < 0.45 ? 'sky' : 'ink';
  }
  if (status === 'burning') {
    const rel = my / h; // 0 top → 1 bottom
    const f = hash(mx + c0, my, 9);
    if (rel > 0.55 || f > 0.75) return c.night ? 'ochre4' : f < 0.5 ? 'ochre3' : 'ochre4';
    if (rel > 0.25) return c.night ? 'ochre2' : f < 0.5 ? 'rust3' : 'ochre2';
    return c.night ? 'rust3' : 'rust1';
  }
  // gutted: black hole with a faint ember.
  if (c.night) return my > h - 3 && hash(mx, my) < 0.4 ? 'rust2' : null;
  return my > h - 3 && hash(mx + c0, my) < 0.25 ? 'rust1' : 'ink';
}

/**
 * Soot plume above a burnt opening: a flame-shaped dark stain rising `hgt` px above zTop,
 * centred on column cx. Returns a char swatch or undefined.
 */
export function soot(
  c: ShadeCtx,
  cx: number,
  zTop: number,
  halfW: number,
  hgt: number,
): string | undefined {
  const dz = c.fz - zTop;
  if (dz < 0 || dz > hgt) return undefined;
  const wob = Math.round(Math.sin((dz + cx) * 0.7) * 1.2);
  const hw = halfW + 1 - (dz / hgt) * (halfW - 0.5);
  const dx = Math.abs(c.fx - cx - wob);
  if (dx > hw) return undefined;
  const core = dx < hw * 0.55 && dz < hgt * 0.7;
  if (!core && hash(c.fx, c.fz, 3) < 0.35) return undefined;
  return lv(R.char, core ? c.level - 1 : c.level);
}

// ---------------------------------------------------------------------------------------------
// Decals: graffiti tags and posters, in face space.
// ---------------------------------------------------------------------------------------------

// Spray tags. Keys: a/b/c/d = spray colours chosen per decal; '.' = wall.
const TAGS: KeyGrid[] = [
  // Circle-A
  keyGrid(`
    ..aaa..
    .a.a.a.
    a.a.a.a
    a.aaa.a
    aa...aa
    .a...a.
    ..aaa..
  `),
  // NO!
  keyGrid(`
    a..a.aaa.a
    aa.a.a.a.a
    a.aa.a.a.a
    a..a.a.a..
    a..a.aaa.a
    a.........
  `),
  // Wavy throw-up
  keyGrid(`
    .bbb..bbb...
    bbabbbbabb..
    babbabbbabbb
    bbbbbbbbbbab
    .bbb.bbb.bb.
    ..b......b..
  `),
  // Heart
  keyGrid(`
    .aa.aa.
    abaaaaa
    aaaaaaa
    .aaaaa.
    ..aaa..
    ...a...
  `),
  // Squiggle signature
  keyGrid(`
    a...a.aa.a
    .a.a.a..aa
    ..a...aa.a
    ..a.......
  `),
  // Star
  keyGrid(`
    ...a...
    ...a...
    aaaaaaa
    .aaaaa.
    .aa.aa.
    a.....a
  `),
];

const SPRAY: ReadonlyArray<readonly [SwatchName, SwatchName]> = [
  ['crim2', 'pink3'],
  ['teal2', 'sky'],
  ['pink2', 'white'],
  ['lime', 'green3'],
  ['purple', 'lilac'],
  ['white', 'gray6'],
  ['ochre3', 'crim1'],
];

// Posters: p paper, i ink print, r red block. Pasted flat on walls.
const POSTERS: KeyGrid[] = [
  keyGrid(`
    pppp
    prrp
    prrp
    pppp
    piip
    pppp
  `),
  keyGrid(`
    ppppp
    piiip
    ppppp
    pirip
    prrrp
    ppppp
  `),
  keyGrid(`
    pppp
    piip
    ppip
    piip
    pppp
  `),
];
const PAPER: readonly SwatchName[] = ['stone5', 'ochre3', 'pink3', 'sky', 'white', 'lime'];

export interface Decal {
  side: 'left' | 'right';
  /** Only on prims with this tag (empty = any). */
  tag: string;
  fx: number;
  zTop: number;
  g: KeyGrid;
  cols: Readonly<Record<string, SwatchName>>;
}

/** Scatter graffiti / posters over face rectangles. `zones`: [side, tag, fx0, fx1, z0, z1]. */
export function scatterDecals(
  state: DamageState,
  seed: number,
  zones: ReadonlyArray<readonly ['left' | 'right', string, number, number, number, number]>,
  density = 1,
): Decal[] {
  if (state < 1) return [];
  const out: Decal[] = [];
  const per = state === 1 ? 2 : state === 2 ? 3 : 4;
  zones.forEach(([side, tag, f0, f1, z0, z1], zi) => {
    const span = f1 - f0;
    const n = Math.max(1, Math.round(((per * span) / 40) * density));
    for (let k = 0; k < n; k++) {
      const h1 = hash(seed + zi * 31, k, 1);
      const h2 = hash(seed + zi * 31, k, 2);
      const h3 = hash(seed + zi * 31, k, 3);
      const poster = h3 < 0.35;
      const g = poster
        ? POSTERS[Math.floor(h2 * POSTERS.length)]!
        : TAGS[Math.floor(h2 * TAGS.length)]!;
      const fx = Math.round(f0 + h1 * Math.max(0, span - g.w));
      const zTop = Math.round(z0 + g.h + h3 * Math.max(0, z1 - z0 - g.h));
      let cols: Record<string, SwatchName>;
      if (poster) {
        const pc = PAPER[Math.floor(hash(seed, k, zi) * PAPER.length)]!;
        cols = { p: pc, i: 'ink', r: 'crim1' };
      } else {
        const [a, b] = SPRAY[Math.floor(hash(seed + 7, k, zi) * SPRAY.length)]!;
        cols = { a, b };
      }
      out.push({ side, tag, fx, zTop, g, cols });
    }
  });
  return out;
}

/** Colour of the topmost decal at this pixel, if any. */
export function decalAt(decals: readonly Decal[], c: ShadeCtx): string | undefined {
  if (c.night || decals.length === 0) return undefined;
  const side = c.side === 'left' || c.side === 'right' ? c.side : null;
  if (!side) return undefined;
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i]!;
    if (d.side !== side || (d.tag && d.tag !== c.prim.tag)) continue;
    const mx = c.fx - d.fx;
    const my = d.zTop - c.fz;
    if (mx < 0 || my < 0 || mx >= d.g.w || my >= d.g.h) continue;
    const k = d.g.rows[my]![mx]!;
    if (k === '.') continue;
    const col = d.cols[k];
    if (col) return col;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

/** Material for column-like curved stone with a crisp lit highlight line. */
export function roundStone(r: Ramp5, opts: { night?: SwatchName } = {}): Material {
  return (c) => {
    if (c.night) {
      // Floodlit from below: the lit flank of each column glows warm.
      if (opts.night) return opts.night;
      return c.side === 'curve' && c.lambert > 0.35 && c.z < 60
        ? c.lambert > 0.55
          ? 'stone4'
          : 'stone2'
        : null;
    }
    if (c.edge) return r[0];
    if (c.side === 'curve' && !c.shadow && c.lambert > 0.6) return r[4];
    return lv(r, c.level);
  };
}

export interface ColumnSpec {
  u: number;
  v: number;
  z0: number;
  z1: number;
  r: number;
  ramp: Ramp5;
  /** Corinthian capital (leafy flare) vs plain Doric/Tuscan. */
  order?: 'corinthian' | 'doric';
  /** Break the shaft at this height (damage state 4). */
  brokenAt?: number;
  tag?: string;
}

/** A classical column: square plinth, torus base, shaft, capital, abacus. */
export function column(s: Scene, c: ColumnSpec): void {
  const { u, v, z0, r, ramp } = c;
  const z1 = c.brokenAt ?? c.z1;
  const broken = c.brokenAt !== undefined;
  const mat = roundStone(ramp);
  const flat: Material = (x) => (x.night ? null : x.edge ? ramp[0] : lv(ramp, x.level));
  s.box(u - r * 1.25, u + r * 1.25, v - r * 1.25, v + r * 1.25, z0, z0 + 2, flat, { tag: c.tag });
  s.cyl(u, v, r * 1.18, z0 + 2, z0 + 4, mat, { tag: c.tag });
  const capH = c.order === 'doric' ? 3 : 6;
  const shaftTop = broken ? z1 : c.z1 - capH - 2;
  const jag = (uu: number, vv: number, zz: number, f: number): boolean => {
    if (!broken) return false;
    void f;
    const a = Math.atan2(vv - v, uu - u);
    return zz > z1 - 3 + Math.round(Math.sin(a * 3 + u * 5) * 2 + 1);
  };
  s.cyl(u, v, r, z0 + 4, shaftTop, mat, { tag: c.tag, cut: broken ? jag : undefined });
  if (broken) return;
  if (c.order === 'doric') {
    s.cone(u, v, r, r * 1.3, shaftTop, c.z1 - 2, mat, { tag: c.tag });
  } else {
    // Corinthian: bell with acanthus leaves (alternating lit / shade tufts).
    const leafy: Material = (x) => {
      if (x.night) return null;
      if (x.edge) return ramp[0];
      const leaf = mod(x.sx + (x.fz >> 1), 3) === 0;
      let l = x.level;
      if (!x.shadow && x.lambert > 0.55) l = 4;
      return lv(ramp, leaf ? l - 1 : l);
    };
    s.cone(u, v, r * 1.02, r * 1.45, shaftTop, c.z1 - 2, leafy, { tag: c.tag });
  }
  s.box(u - r * 1.5, u + r * 1.5, v - r * 1.5, v + r * 1.5, c.z1 - 2, c.z1, flat, { tag: c.tag });
}

/** A straight flight of steps rising toward −v (front at vFront, top flush with z1). */
export function stairs(
  s: Scene,
  u0: number,
  u1: number,
  vFront: number,
  vBack: number,
  z0: number,
  z1: number,
  n: number,
  mat: Material,
  tag = 'stairs',
): void {
  const tread = (vFront - vBack) / n;
  const rise = (z1 - z0) / n;
  for (let k = 0; k < n; k++) {
    s.box(u0, u1, vBack, vFront - k * tread, z0, Math.round(z0 + rise * (k + 1)), mat, { tag });
  }
}

/** Stair material: lit nosing on each tread, darker risers. */
export function stepMat(r: Ramp5, decals: readonly Decal[] = []): Material {
  return (c) => {
    if (c.night) return null;
    const d = decalAt(decals, c);
    if (d) return d;
    if (c.edge) return r[0];
    if (c.side === 'top') return c.rim ? r[4] : lv(r, c.level - (c.shadow ? 0 : 1));
    return lv(r, c.level - 1);
  };
}

/** Pierced balustrade material + cut: balusters every `pitch` px between z0+1 and z1-2. */
export function balustradeCut(
  z0: number,
  z1: number,
  pitch = 3,
): (u: number, v: number, z: number, f: number) => boolean {
  return (u, v, z, f) => {
    if (f < 0 || z <= z0 + 1.5 || z >= z1 - 2) return false;
    const n = f === 0 || f === 1 ? Math.floor(v * 16) : Math.floor(u * 16);
    return mod(n, pitch) === 0;
  };
}

/** Thin vertical pole (1 px) from z0 to z1 at (u, v). */
export function pole(
  s: Scene,
  u: number,
  v: number,
  z0: number,
  z1: number,
  colour = 'gray2',
): void {
  s.line(
    [
      [u, v, z0],
      [u, v, z1],
    ],
    colour,
  );
  s.line(
    [
      [u, v, z1],
      [u, v, z1 + 1],
    ],
    'ochre2',
  );
}

/** Screen offset (px, relative to the anchor) of a footprint-space point. */
export function project(u: number, v: number, z: number): { x: number; y: number } {
  return { x: Math.round((u - v) * 16), y: Math.round((u + v) * 8 - z) };
}

// ---------------------------------------------------------------------------------------------
// Gothic Revival walls (Westminster, the Abbey)
// ---------------------------------------------------------------------------------------------

const LANCETS = new Map<Ramp5, Map<number, Module>>();
/** A pointed lancet window module `w` wide (3 or 5) and `h` tall, with a transom. */
export function lancet(w: number, h: number, ramp: Ramp5): Module {
  let byRamp = LANCETS.get(ramp);
  if (!byRamp) {
    byRamp = new Map();
    LANCETS.set(ramp, byRamp);
  }
  const key = w * 1000 + h;
  let m = byRamp.get(key);
  if (m) return m;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const mid = (w - 1) / 2;
      if (y === 0 && Math.abs(x - mid) > 0.5) r += '.';
      else if (y === 1 && w === 5 && Math.abs(x - mid) > 1.5) r += '.';
      else if (y === h - 1) r += 's';
      else if (y === Math.floor(h / 2)) r += 'm';
      else if (w === 5 && x === 2 && y > 1) r += 'm';
      else if (x === 0 && y < 4) r += 'G';
      else r += 'g';
    }
    rows.push(r);
  }
  m = {
    g: keyGrid(rows.join('\n')),
    keys: { g: R.dark, G: { r: R.glass, d: 0 }, m: { r: ramp, d: -1 }, s: { r: ramp, d: 1 } },
    night: { g: 'ochre2', G: 'ochre3', m: 'ochre1' },
  };
  byRamp.set(key, m);
  return m;
}

export interface GothicSpec {
  ramp: Ramp5;
  /** Bay pitch in face pixels and offset of the first buttress. */
  pitch: number;
  off: number;
  /** Window rows: top z and height; `w` = 3 (lancet) or 5 (two-light). */
  rows: ReadonlyArray<{ zTop: number; h: number; w?: number }>;
  /** z of the wall top (parapet top). */
  top: number;
  state: DamageState;
  seed: number;
  decals: readonly Decal[];
  /** Skip windows in this face-column range per side (doors, towers). */
  blank?: (side: 'left' | 'right', fx: number, z: number) => boolean;
  /** Extra painter run before the default (doors, clocks…). */
  extra?: (c: ShadeCtx) => string | null | undefined;
  /** Paint everything in shadow below this z on the left face (arcades). */
  burnt?: Array<{ side: 'left' | 'right'; fx: number; zTop: number }>;
}

/** Perpendicular Gothic facade: buttress strips, lancet rows, string courses, pierced parapet. */
export function gothicWall(g: GothicSpec): Material {
  const r = g.ramp;
  return (c) => {
    if (c.side === 'back') return c.night ? null : c.z < 10 ? 'rust1' : 'ink';
    if (c.side !== 'left' && c.side !== 'right') {
      return c.night ? null : c.edge ? r[0] : lv(r, c.level);
    }
    const side = c.side;
    const ex = g.extra?.(c);
    if (ex !== undefined) return ex;
    const bay = mod(c.fx - g.off, g.pitch);
    const bayIx = Math.floor((c.fx - g.off) / g.pitch);
    const blank = g.blank?.(side, c.fx, c.fz) ?? false;
    if (!blank) {
      for (let ri = 0; ri < g.rows.length; ri++) {
        const row = g.rows[ri]!;
        const w = row.w ?? 3;
        const c0 = c.fx - bay + Math.floor((g.pitch + 2 - w) / 2);
        const st = windowStatus(
          g.state,
          bayIx * 7 + ri + (side === 'right' ? 900 : 0) + c.prim.aabb[0] * 50,
          g.seed,
        );
        const p = paintWindow(lancet(w, row.h, r), c, c0, row.zTop, st);
        if (p !== undefined) return p;
      }
    }
    if (c.night) return null;
    const d = decalAt(g.decals, c);
    if (d) return d;
    if (g.burnt) {
      for (const b of g.burnt) {
        if (b.side !== side) continue;
        const sd = soot(c, b.fx, b.zTop, 2, 14);
        if (sd) return sd;
      }
    }
    if (c.edge) return r[0];
    const z = c.fz;
    const top = g.top;
    // Pierced parapet.
    if (z >= top - 1) return lv(r, c.level + 1);
    if (z >= top - 4) {
      if (z === top - 4) return lv(r, c.level - 1);
      return mod(c.fx + (z === top - 3 ? 1 : 0), 3) === 0 ? lv(r, c.level - 2) : lv(r, c.level);
    }
    if (z === top - 5) return lv(r, c.level - 1);
    if (z <= 2) return lv(r, c.level - 1);
    // String courses below each window row.
    for (const row of g.rows) {
      const zb = row.zTop - row.h - 1;
      if (z === zb) return lv(r, c.level - 1);
    }
    if (bay === 0) return lv(r, c.level + 1);
    if (bay === 1) return lv(r, c.level - 1);
    // Faint vertical panelling.
    if (bay === g.pitch - 1 && mod(z, 2) === 0) return lv(r, c.level - 1);
    return lv(r, c.level);
  };
}

/** Steep roof material (slate / cast iron) with course lines and optional scorch zones. */
export function roofMat(
  ramp: Ramp5,
  scorch?: (u: number, v: number) => 0 | 1 | 2,
  courses = 3,
): Material {
  return (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return ramp[0];
    const sc = scorch?.(c.u, c.v) ?? 0;
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    const course = mod(c.fz, courses) === 0;
    return lv(ramp, c.level - (course ? 1 : 0));
  };
}

/** Scorch-zone helper: list of [u, v, radius]. 2 = charred core, 1 = ember rim. */
export function scorchZones(
  burns: ReadonlyArray<readonly [number, number, number]>,
): (u: number, v: number) => 0 | 1 | 2 {
  return (u, v) => {
    for (const [bu, bv, br] of burns) {
      const a = Math.atan2(v - bv, u - bu);
      const rr = br * (1 + Math.sin(a * 4 + bu) * 0.18);
      const d = Math.hypot((u - bu) * 1.2, v - bv);
      if (d < rr * 0.75) return 2;
      if (d < rr) return 1;
    }
    return 0;
  };
}

/** Jagged-break cut above height zBreak (shattered spires / towers). */
export function breakAbove(zBreak: number, seed = 0): (u: number, v: number, z: number) => boolean {
  return (u, v, z) => z > zBreak + Math.sin(u * 23 + seed) * 3 + Math.cos(v * 17 + seed) * 3;
}

// ---------------------------------------------------------------------------------------------
// Tiny 3×5 face-space lettering (frieze inscriptions)
// ---------------------------------------------------------------------------------------------

const FONT: Record<string, string> = {
  A: '.#.#.#####.##.#',
  B: '##.#.###.#.###.',
  C: '####..#..#..###',
  D: '##.#.##.##.###.',
  E: '####..##.#..###',
  G: '####..#.##.####',
  I: '###.#..#..#.###',
  L: '#..#..#..#..###',
  M: '#.#####.##.##.#',
  N: '##.#.##.##.##.#',
  O: '####.##.##.####',
  P: '####.#####..#..',
  R: '##.#.###.#.##.#',
  S: '####..###..####',
  T: '###.#..#..#..#.',
  U: '#.##.##.##.####',
  Y: '#.##.#.#..#..#.',
  W: '#.##.##.#####.#',
  H: '#.##.#####.##.#',
  '!': '.#..#..#.....#.',
};

/** Letters as a key grid ('t' = letter pixel), 3×5 glyphs, 1 px spacing. */
export function textGrid(str: string): KeyGrid {
  const rows = ['', '', '', '', ''];
  for (const ch of str.toUpperCase()) {
    if (ch === ' ') {
      for (let y = 0; y < 5; y++) rows[y] += '..';
      continue;
    }
    const g = FONT[ch] ?? '...............';
    for (let y = 0; y < 5; y++) rows[y] += g.slice(y * 3, y * 3 + 3).replace(/#/g, 't') + '.';
  }
  return keyGrid(rows.map((r) => r.slice(0, -1)).join('\n'));
}

// ---------------------------------------------------------------------------------------------
// Protest dressing: banners (state ≥ 1) and rubble (state ≥ 2)
// ---------------------------------------------------------------------------------------------

/**
 * A bed-sheet banner hung flat on the +v side at plane v, spanning u0..u1 from zTop down `h` px,
 * with a spray-painted slogan. Ragged lower edge; torn & scorched from state 3.
 */
export function banner(
  s: Scene,
  state: DamageState,
  u0: number,
  u1: number,
  v: number,
  zTop: number,
  h: number,
  text: string,
): void {
  if (state < 1) return;
  const g = textGrid(text);
  const c0 = Math.round(((u0 + u1) / 2) * 16 - g.w / 2);
  const zText = Math.round(zTop - (h - g.h) / 2);
  const mat: Material = (c) => {
    if (c.night) return null;
    const mx = c.fx - c0;
    const my = zText - c.fz;
    if (mx >= 0 && my >= 0 && mx < g.w && my < g.h && g.rows[my]![mx] === 't')
      return state >= 3 && hash(c.fx, 1) < 0.3 ? 'ink' : 'crim1';
    if (c.edge) return 'gray5';
    if (state >= 3 && hash(c.fx >> 1, c.fz >> 1, 4) < 0.18) return lv(R.char, c.level);
    return c.fz >= zTop - 1 ? 'gray6' : c.level >= 3 ? 'white' : 'gray7';
  };
  const cut = (u: number, _v: number, z: number): boolean => {
    const rag =
      Math.round(Math.sin(u * 37) * 1.2 + Math.sin(u * 13) * 1.0) +
      (state >= 3 ? Math.round(hash(Math.floor(u * 16), 2) * 4) : 0);
    return z < zTop - h + 1 + rag;
  };
  s.box(u0, u1, v - 0.03, v, zTop - h - 4, zTop, mat, { cut, tag: 'banner', cast: false });
  // Ropes at the corners.
  s.line(
    [
      [u0, v, zTop],
      [u0, v, zTop + 2],
    ],
    'stone2',
  );
  s.line(
    [
      [u1, v, zTop],
      [u1, v, zTop + 2],
    ],
    'stone2',
  );
}

/** Scatter rubble: bricks, cobbles, bottles and placards in a u/v rectangle at height z. */
export function rubble(
  s: Scene,
  state: DamageState,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  z: number,
  n: number,
  seed: number,
): void {
  if (state < 2) return;
  const count = Math.round(n * (state - 1) * 0.7);
  const kinds: Material[] = [
    plain(R.brick),
    plain(R.granite),
    plain(R.cream),
    (c) => (c.night ? null : c.edge ? 'green0' : lv(R.grass, c.level - 1)),
    (c) => (c.night ? null : c.edge ? 'earth1' : c.side === 'top' ? 'stone5' : 'ochre3'),
  ];
  for (let k = 0; k < count; k++) {
    const u = u0 + hash(seed, k, 1) * (u1 - u0);
    const v = v0 + hash(seed, k, 2) * (v1 - v0);
    const kind = Math.floor(hash(seed, k, 3) * kinds.length);
    const sz = 0.05 + hash(seed, k, 4) * 0.06;
    const hgt = 1 + Math.floor(hash(seed, k, 5) * 2);
    s.box(u - sz, u + sz, v - sz * 0.7, v + sz * 0.7, z, z + hgt, kinds[kind]!, {
      cast: false,
      tag: 'rubble',
    });
  }
}
