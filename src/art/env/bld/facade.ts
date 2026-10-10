/**
 * Facade painter: lays hand-authored modules (modules.grid.ts) onto a face canvas with a
 * per-building rhythm — ground-floor shopfronts/portals, storey types, balconies, blinds,
 * residents, laundry and banners — then string courses, cornice, quoins, drainpipes and
 * weathering (grime under sills, rain streaks, base AO, the odd tag).
 */
import type { BuildingKind, CityId, RoofType } from '../../../maps/contract';
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { envStyle } from '../style';
import { Dice, hash } from '../util';
import { Face, K_GLASS, K_RELIEF, K_WALL, n2, stampModule, type KeyResolver } from './face';
import { GLOW, GLOW_HI, tag } from './kit';
import type { Look, WallMat } from './looks';

export const BAY = 10;
export const STOREY = 10;
export const CORNICE = 3;

export interface FacePlan {
  len: number;
  H: number;
  /** Storeys with facade (ground floor = last). */
  storeys: number;
  roof: RoofType;
  kind: BuildingKind;
  side: 'left' | 'right';
  /** Bays that must hold a street door (residents' exits). */
  doorBays: ReadonlySet<number>;
  /** Columns with a drainpipe (also the climb points). */
  pipes: readonly number[];
  seed: number;
  /** Building-wide storey programme (shared by both faces so corners match). */
  floors: readonly FloorType[];
}

export type FloorType = 'balcony' | 'plain' | 'small' | 'gallery' | 'tall';

export interface BayLayout {
  n: number;
  margin: number;
}

export function bayLayout(len: number): BayLayout {
  const n = Math.max(1, Math.floor((len - 2) / BAY));
  return { n, margin: Math.floor((len - n * BAY) / 2) };
}

/** Storey programme, top storey down to the ground floor (exclusive): FacadeStyle.floor. */
export function floorProgramme(
  city: CityId,
  storeys: number,
  roof: RoofType,
  kind: BuildingKind,
  d: Dice,
): FloorType[] {
  const upper = storeys - 1;
  const fs = envStyle(city).facade;
  const out: FloorType[] = [];
  for (let k = 0; k < upper; k++) out.push(fs.floor(k, upper, roof, kind, d));
  return out;
}

// ------------------------------------------------------------------------------ wall texture --

function wallPixel(mat: WallMat, base: RGBA, x: number, y: number, s: number): RGBA {
  switch (mat) {
    case 'brick': {
      const course = y >> 1;
      const off = (course & 1) * 2;
      const bx = (x + off) >> 2;
      if ((y & 1) === 1 && ((x + off) & 3) === 0) return darker(base);
      const h = hash(bx, course, s) % 41;
      if (h === 0) return darker(base);
      return base;
    }
    case 'ashlar': {
      const course = Math.floor(y / 4);
      if (y % 4 === 3) return darker(base);
      if ((x + (course & 1) * 6) % 12 === 0) return darker(base);
      if (hash(Math.floor((x + (course & 1) * 6) / 12), course, s) % 9 === 0) return lighter(base);
      return base;
    }
    case 'smooth':
      return n2(x, y, s) < 0.02 ? darker(base) : base;
    case 'stucco':
    default: {
      const h = hash(x >> 1, y, s) % 41;
      if (h === 0) return darker(base);
      if (h === 1 && (x & 1) === 0) return lighter(base);
      return base;
    }
  }
}

// --------------------------------------------------------------------------------- resolver --

interface WinVars {
  curtain: RGBA;
  cloth1: RGBA;
  cloth2: RGBA;
  hair: RGBA;
  flower: RGBA;
}

function resolver(look: Look, f: Face, v: WinVars): KeyResolver {
  const T = look.trim;
  const map: Record<string, RGBA> = {
    T,
    t: darker(T),
    U: lighter(T),
    g: C('navy1'),
    G: C('zinc2'),
    k: v.curtain,
    f: look.frame,
    F: darker(look.frame),
    S: look.shutter,
    s: darker(look.shutter),
    I: look.ironHi,
    i: look.iron,
    x: C('ink'),
    D: look.door,
    d: darker(look.door),
    h: C('ochre2'),
    a: look.awning[0],
    A: look.awning[1],
    n: look.sign,
    N: look.signText,
    m: C('gray5'),
    M: C('gray6'),
    c: v.cloth1,
    C: v.cloth2,
    p: C('green2'),
    P: v.flower,
    e: C('earth5'),
    H: v.hair,
    r: C('crim2'),
    y: C('ochre2'),
  };
  return (key, x, y) => {
    if (key === 'w') return darker(f.get(x, y));
    if (key === 'W') return lighter(f.get(x, y));
    return map[key] ?? null;
  };
}

// --------------------------------------------------------------------------------- painting --

export function paintFace(look: Look, plan: FacePlan): Face {
  const { len, H, storeys } = plan;
  const fs = envStyle(look.city).facade;
  const f = new Face(len, H);
  const d = new Dice(hash(plan.seed, plan.side === 'left' ? 11 : 23));
  const s = plan.seed;
  const groundTop = H - STOREY;

  // 1. Wall material (ground floor band may differ).
  for (let y = 0; y < H; y++) {
    const g = y >= groundTop;
    const mat = g ? look.groundMat : look.mat;
    const base = g ? look.ground : look.wall;
    for (let x = 0; x < len; x++) f.set(x, y, wallPixel(mat, base, x, y, s), K_WALL);
  }
  // Rusticated ground floor (Paris / civic / London stucco): deep channels.
  if (look.groundMat === 'ashlar' || (fs.rusticateSmooth && look.groundMat === 'smooth')) {
    for (let y = groundTop; y < H; y++) {
      const r = (y - groundTop) % 3;
      if (r === 2) for (let x = 0; x < len; x++) f.tint(x, y, darker(look.ground));
      if (r === 0) for (let x = 0; x < len; x++) f.tint(x, y, lighter(look.ground));
    }
  }
  // Stucco repair patches (Madrid): soft rectangles one step off.
  if (look.mat === 'stucco') {
    const n = d.int(1, 3);
    for (let k = 0; k < n; k++) {
      const pw = d.int(5, 12);
      const ph = d.int(3, 7);
      const px = d.int(0, Math.max(0, len - pw));
      const py = d.int(CORNICE, Math.max(CORNICE, groundTop - ph));
      const up = d.chance(0.5);
      for (let y = py; y < py + ph; y++) {
        for (let x = px; x < px + pw; x++) {
          const edge = x === px || x === px + pw - 1 || y === py || y === py + ph - 1;
          if (edge && n2(x, y, s + 7) < 0.5) continue;
          f.tint(x, y, up ? lighter(look.wall) : darker(look.wall));
        }
      }
    }
  }

  // 2. String course above the ground floor (and Paris balcony floors get slabs from modules).
  for (let x = 0; x < len; x++) {
    f.set(x, groundTop - 1, look.trim, K_RELIEF);
    if (fs.doubleStringCourse) f.set(x, groundTop - 2, lighter(look.trim), K_RELIEF);
  }

  // 3. Quoins.
  if (look.quoins) {
    for (let y = CORNICE; y < groundTop - 1; y++) {
      const block = Math.floor((y - CORNICE) / 3);
      const wdt = block % 2 === 0 ? 3 : 2;
      const joint = (y - CORNICE) % 3 === 2;
      for (let x = 0; x < wdt; x++) {
        f.set(x, y, joint ? darker(look.trim) : x === 0 ? lighter(look.trim) : look.trim, K_RELIEF);
        f.set(len - 1 - x, y, joint ? darker(look.trim) : look.trim, K_RELIEF);
      }
    }
  }

  // 4. Bays & storeys.
  const { n: nb, margin } = bayLayout(len);
  const bx = (b: number): number => margin + b * BAY + 1;
  const vars = (): WinVars => ({
    curtain: d.weighted<RGBA>([
      [C('navy0'), 8],
      [C('rust1'), 1],
      [C('earth6'), 1],
      [C('stone4'), 1],
      [C('green1'), 1],
    ]),
    cloth1: d.pick(look.cloth),
    cloth2: d.pick(look.cloth),
    hair: C(d.pick(['earth1', 'ink', 'ochre2', 'gray6', 'rust1'])),
    flower: C(d.pick(['crim2', 'pink2', 'ochre3', 'rust3', 'white'])),
  });

  // Upper storeys.
  for (let k = 0; k < storeys - 1; k++) {
    const y0 = CORNICE + k * STOREY;
    const type = plan.floors[k] ?? 'plain';
    for (let b = 0; b < nb; b++) {
      const x0 = bx(b);
      const v = vars();
      const res = resolver(look, f, v);
      const lit = d.chance(look.lit);
      const glow = lit ? GLOW : 0;
      const glowHi = lit ? GLOW_HI : 0;
      fs.upperBay({ f, look, type, x0, y0, res, glow, glowHi, d });
    }
    if (type === 'gallery') paintGallery(f, look, y0, nb, margin);
  }

  // Ground floor.
  paintGroundFloor(f, look, plan, groundTop, nb, bx, d, vars);

  // 5. Top: cornice / eaves / parapet (+ the city's own finishing pass, FacadeStyle.finish).
  paintTop(f, look, plan.roof, len);
  fs.finish?.({ f, look, plan, d: new Dice(hash(plan.seed, plan.side === 'left' ? 0xf1 : 0xf2)) });

  // 6. Drainpipes.
  const pipe = C(fs.pipe);
  for (const px of plan.pipes) {
    if (px < 0 || px >= len) continue;
    for (let y = 1; y < H - 1; y++) {
      if (f.kindAt(px, y) === K_GLASS) continue;
      f.set(px, y, y % 9 === 4 ? darker(pipe) : pipe, K_RELIEF);
    }
    f.set(px, 1, lighter(pipe), K_RELIEF);
    f.set(px + 1, 1, pipe, K_RELIEF);
    f.set(px + 1, 2, darker(pipe), K_RELIEF);
    f.set(px + 1, H - 1, darker(pipe), K_RELIEF);
  }

  // 7. Weathering.
  weather(f, look, plan, d);
  f.dropShadows();
  // Ground contact AO.
  for (let x = 0; x < len; x++) {
    f.darken(x, H - 1, 1);
    if (f.kindAt(x, H - 2) !== K_GLASS) f.darken(x, H - 2, n2(x, 0, s) < 0.5 ? 1 : 0);
  }
  return f;
}

/** Paris continuous wrought-iron balcony across the whole storey. */
function paintGallery(f: Face, look: Look, y0: number, nb: number, margin: number): void {
  const len = f.w;
  const x0 = Math.max(0, margin - 2);
  const x1 = Math.min(len - 1, margin + nb * BAY + 1);
  for (let x = x0; x <= x1; x++) {
    f.set(x, y0 + 6, look.ironHi, K_RELIEF);
    const m = (x - x0) % 4;
    if (m === 0 || m === 2) f.set(x, y0 + 7, look.iron, K_RELIEF);
    else if (m === 1) f.set(x, y0 + 7, look.ironHi, K_RELIEF);
    f.set(x, y0 + 8, look.iron, K_RELIEF);
    f.set(x, y0 + 9, x % 6 === 0 ? darker(look.trim) : look.trim, K_RELIEF);
  }
}

function paintGroundFloor(
  f: Face,
  look: Look,
  plan: FacePlan,
  y0: number,
  nb: number,
  bx: (b: number) => number,
  d: Dice,
  vars: () => WinVars,
): void {
  const fs = envStyle(look.city).facade;
  const commercial =
    plan.kind === 'commercial' ||
    (fs.shopChance > 0 && plan.kind !== 'civic' && d.chance(fs.shopChance));
  const civic = plan.kind === 'civic';
  let b = 0;
  while (b < nb) {
    const x0 = bx(b);
    const v = vars();
    const res = resolver(look, f, v);
    const door = plan.doorBays.has(b);
    if (door) {
      stampModule(f, fs.door, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
      b++;
      continue;
    }
    const pair = b + 1 < nb && !plan.doorBays.has(b + 1);
    if (commercial && pair && d.chance(0.8)) {
      const lit = d.chance(0.85);
      const mod = fs.shop(d);
      // Each shop gets its own sign / awning colours.
      const sl = { ...look, ...shopColours(d) };
      const r2 = resolver(sl, f, v);
      stampModule(
        f,
        mod,
        x0 + 1,
        y0,
        signText(r2, sl, x0 + 1, y0, d),
        lit ? GLOW : 0,
        lit ? GLOW_HI : 0,
      );
      b += 2;
      continue;
    }
    // Single bay.
    fs.groundBay({ f, look, x0, y0, res, d, commercial, civic });
    b++;
  }
}

function shopColours(d: Dice): Partial<Look> {
  const SIGNS: ReadonlyArray<readonly [string, string]> = [
    ['green1', 'ochre3'],
    ['rust0', 'ochre3'],
    ['navy1', 'stone5'],
    ['gray1', 'ochre2'],
    ['crim1', 'white'],
    ['plum0', 'ochre3'],
    ['teal1', 'white'],
    ['ochre1', 'white'],
  ];
  const sg = d.pick(SIGNS);
  const out: Partial<Look> = { sign: C(sg[0]), signText: C(sg[1]) };
  if (d.chance(0.5)) {
    const aw = d.pick<[string, string]>([
      ['crim1', 'white'],
      ['green1', 'green2'],
      ['navy1', 'white'],
      ['rust1', 'ochre2'],
      ['green2', 'white'],
    ]);
    out.awning = [C(aw[0]), C(aw[1])];
  }
  return out;
}

/** Replace the grid's fixed letter pattern with seeded pseudo-lettering (readable as a sign). */
function signText(res: KeyResolver, look: Look, x0: number, y0: number, d: Dice): KeyResolver {
  const glyphs = new Set<number>();
  // Pseudo-words: runs of 1–2 px glyph columns with 1 px gaps.
  let x = 2 + d.int(0, 2);
  while (x < 13) {
    const wlen = d.int(2, 4);
    for (let k = 0; k < wlen && x < 14; k++) {
      glyphs.add(x);
      x += d.chance(0.3) ? 1 : 2;
    }
    x += 2;
  }
  return (k, px, py) => {
    if (k === 'N') {
      const lx = px - x0;
      const row = py - y0;
      return glyphs.has(lx) || (row === 1 && glyphs.has(lx - 1) && d.chance(0.5))
        ? look.signText
        : look.sign;
    }
    return res(k, px, py);
  };
}

function paintTop(f: Face, look: Look, roof: RoofType, len: number): void {
  const T = look.trim;
  const fs = envStyle(look.city).facade;
  if (roof === 'pitched') {
    // Eaves: deep shadow under the overhang, rafter-tail rhythm.
    for (let x = 0; x < len; x++) {
      f.set(x, 0, darker(look.wall, 2), K_WALL);
      f.set(x, 1, x % 3 === 0 ? darker(look.wall, 2) : darker(look.wall), K_WALL);
      f.set(x, 2, fs.eavesTrim ? T : f.get(x, 2), fs.eavesTrim ? K_RELIEF : K_WALL);
    }
    return;
  }
  if (roof === 'mansard') {
    // Heavy cornice with modillions.
    for (let x = 0; x < len; x++) {
      f.set(x, 0, lighter(T), K_RELIEF);
      f.set(x, 1, x % 2 === 0 ? T : darker(T), K_RELIEF);
      f.set(x, 2, darker(T, 1), K_RELIEF);
    }
    return;
  }
  // Flat / terrace parapet: coping, panel, band.
  for (let x = 0; x < len; x++) {
    f.set(x, 0, lighter(T), K_RELIEF);
    f.set(x, 1, fs.dentilParapet ? (x % 2 === 0 ? T : darker(T)) : T, K_RELIEF);
    f.set(x, 2, darker(T), K_RELIEF);
  }
}

function weather(f: Face, look: Look, plan: FacePlan, d: Dice): void {
  const { len, H } = plan;
  // Grime streaks under sills: wall pixels right below relief, a few px long.
  for (let x = 0; x < len; x++) {
    for (let y = CORNICE; y < H - STOREY; y++) {
      if (f.kindAt(x, y) !== K_RELIEF || f.kindAt(x, y + 1) !== K_WALL) continue;
      if (hash(x, y, plan.seed) % 7 !== 0) continue;
      const n = 1 + (hash(x, y, 3) % 3);
      for (let k = 2; k <= n + 1; k++) if (f.kindAt(x, y + k) === K_WALL) f.darken(x, y + k);
    }
  }
  // Rain streaks from the cornice.
  const streaks = d.int(1, Math.max(1, Math.floor(len / 12)));
  for (let k = 0; k < streaks; k++) {
    const x = d.int(0, len - 1);
    const l = d.int(3, 9);
    for (let y = CORNICE; y < CORNICE + l; y++)
      if (f.kindAt(x, y) === K_WALL && n2(x, y, 5) < 0.8) f.darken(x, y);
  }
  // A spray tag at street level now and then (not on civic stone).
  if (plan.kind !== 'civic' && d.chance(envStyle(look.city).facade.tagChance)) {
    tag(f, d.int(0, Math.max(0, len - 6)), H - STOREY + d.int(4, 6), d);
  }
}
