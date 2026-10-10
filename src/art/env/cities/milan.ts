/**
 * MILAN — environment style (E3 South). Severe Neoclassical palazzi in grey stone, ochre and
 * Milan yellow, 1930s Rationalist blocks, Liberty flourishes, case di ringhiera with their iron
 * ballatoi toward the Navigli; granite slab pavements, porphyry setts in fans, tram tracks for
 * the orange Ventotto, the red / green / yellow "MM", panettoni bollards, Quadrilatero boutiques
 * under dark awnings, fashion wraps on the facades, the red cross of Milan.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI, tag } from '../bld/kit';
import { K_GLASS, K_RELIEF, K_WALL, stampModule, type Face, type KeyResolver } from '../bld/face';
import { CORNICE, STOREY } from '../bld/facade';
import * as M from '../bld/modules.grid';
import type { GroundFill } from '../ground';
import type { EnvCity, SlopeTex } from '../style';
import type { Dice } from '../util';
import { hash } from '../util';
import * as G from './milan.grid';
import { basinFountain, fanFill, framedFill } from './rome';

// ------------------------------------------------------------------------------- paving --

/**
 * Granite slabs: `cols`×`rows` slabs per tile with fine salt-and-pepper grain (pixel specks:
 * no continuity across tiles needed).
 */
function graniteFill(
  rows: number,
  cols: number,
  base: RGBA,
  alt: RGBA,
  joint: RGBA,
  grain: readonly [RGBA, RGBA],
): GroundFill {
  return (x, y, u, v, seed) => {
    const r = Math.floor(v * rows);
    const c = Math.floor(u * cols + (r % 2) * 0.5);
    const fu = u * cols + (r % 2) * 0.5 - c;
    const fv = v * rows - r;
    if (fv < 0.07 || fu < 0.035) return joint;
    const crossing = (r % 2 === 1 && (c === 0 || c === cols)) || fv > 0.995;
    const tone = crossing ? base : hash(r, c, seed) % 4 === 0 ? alt : base;
    if (fv < 0.14 || fu < 0.07) return lighter(tone);
    const h = hash(x, y, 0x9e1) % 19;
    if (h === 0) return grain[0];
    if (h === 1) return grain[1];
    return tone;
  };
}

// ------------------------------------------------------------------------------- roofs --

/** Marseille tiles: regular interlocking clay tiles, browner and more orderly than Rome's. */
function marsigliesi(_look: unknown, rise: number): SlopeTex {
  const shadeBy = (c: RGBA, l: number): RGBA => (l > 0 ? lighter(c) : l < 0 ? darker(c) : c);
  return (a, b, l) => {
    const ai = Math.floor(a);
    const bi = Math.floor(b);
    if (bi <= 0) return C('earth1');
    if (bi >= rise - 1) return shadeBy(C('earth4'), l);
    const course = Math.floor(bi / 2);
    const col = (((ai + (course % 2) * 2) % 5) + 5) % 5;
    let c =
      hash(Math.floor((ai + (course % 2) * 2) / 5), course, 0x3a) % 9 === 0
        ? C('earth3')
        : C('rust1');
    if (col === 0) c = C('earth2');
    else if (col === 1) c = lighter(c);
    if (bi % 2 === 0) c = darker(c);
    return shadeBy(c, l);
  };
}

// ------------------------------------------------------------------------------ facades --

/** Iron ballatoio of a casa di ringhiera across a whole bay (rows 6–9 of the storey). */
function ballatoio(f: Face, x0: number, y0: number, iron: RGBA, ironHi: RGBA, slab: RGBA): void {
  for (let x = x0 - 1; x < x0 + 9; x++) {
    f.set(x, y0 + 6, ironHi);
    f.set(x, y0 + 7, x % 2 === 0 ? iron : f.get(x, y0 + 7), x % 2 === 0 ? 1 : f.kindAt(x, y0 + 7));
    f.set(x, y0 + 8, x % 2 === 0 ? iron : f.get(x, y0 + 8), x % 2 === 0 ? 1 : f.kindAt(x, y0 + 8));
    f.set(x, y0 + 9, x % 5 === 0 ? darker(slab) : slab);
  }
}

/** Fashion wrap: a giant ad stretched over the facade (models, a brand in big letters). */
function fashionWrap(f: Face, x0: number, y0: number, w: number, h: number, d: Dice): void {
  const bg = C(d.pick(['white', 'ink', 'pink3', 'stone5', 'gray7']));
  const dark = bg === C('ink');
  const fig = dark ? C('stone5') : C('ink');
  const accent = C(d.pick(['crim2', 'pink2', 'ochre3', 'teal2', 'purple']));
  const skin = C(d.pick(['earth6', 'earth4', 'earth2']));
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1;
      f.set(x, y, edge ? C('gray2') : bg, K_RELIEF);
    }
  }
  // Brand: big pseudo-letters along the top.
  for (let x = x0 + 2; x < x0 + w - 2; x++) {
    if ((x - x0) % 4 === 3) continue;
    for (let y = y0 + 2; y < y0 + 5; y++)
      if (hash(x, y, 7) % 5) f.set(x, y, dark ? C('white') : fig);
  }
  // One or two models striding down the runway: hair, face, long coat, legs.
  const n = w > 20 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const cx = x0 + Math.floor(((k + 0.5) * w) / n);
    const top = y0 + 7;
    const bottom = y0 + h - 2;
    const coat = k === 0 ? accent : fig === C('ink') ? C('gray2') : C('gray6');
    const coatEnd = top + 4 + Math.floor((bottom - top - 4) * 0.62);
    f.set(cx, top, fig);
    f.set(cx + 1, top, fig);
    f.set(cx, top + 1, skin);
    f.set(cx + 1, top + 1, fig);
    f.set(cx, top + 2, skin);
    f.set(cx + 1, top + 2, skin);
    f.set(cx, top + 3, skin);
    for (let y = top + 4; y <= coatEnd; y++) {
      const half = y === top + 4 ? 2 : y < top + 8 ? 2 : 1 + ((y - top) % 2);
      for (let x = cx - half + 1; x <= cx + half; x++)
        f.set(x, y, x === cx - half + 1 ? lighter(coat) : coat);
    }
    for (let y = coatEnd + 1; y < bottom; y++) {
      const stride = Math.floor((y - coatEnd) / 2);
      f.set(cx - Math.min(1, stride), y, fig);
      f.set(cx + 1 + Math.min(1, stride), y, fig);
    }
  }
}

/** Hanging tricolore on a balcony (G.FLAG_IT): c green, C white, r red. */
const itRes =
  (res: KeyResolver): KeyResolver =>
  (k, x, y) =>
    k === 'c' ? C('green2') : k === 'C' ? C('white') : k === 'r' ? C('crim2') : res(k, x, y);

// ---------------------------------------------------------------------------- the city --

/** Milan: St George's red cross on white. */
const MILANO = (x: number, y: number, W: number, H: number): RGBA =>
  Math.abs(x - (W - 1) / 2) < 1.1 || Math.abs(y - (H - 1) / 2) < 0.8 ? C('crim2') : C('white');

export const milan: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('zinc1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray3'),
    side: {
      tones: [C('gray5'), C('gray5'), C('gray6')],
      joint: C('gray3'),
      grid: { rows: 2, cols: 1, stagger: 0.5 },
    },
    cobble: {
      tones: [C('stone1'), C('earth2'), C('stone0'), C('gray3')],
      joint: C('gray1'),
      grid: { rows: 6, cols: 6, stagger: 0.5 },
    },
    plaza: {
      tones: [C('gray6'), C('gray6'), C('gray7')],
      border: C('gray5'),
      joint: C('gray4'),
    },
    grass: { base: 'grass', stripes: false, dry: 0.15 },
    gravel: { base: C('stone3'), dark: C('stone2'), light: C('stone4') },
    water: {
      deep: C('navy0'),
      base: C('zinc1'),
      ripple: C('zinc0'),
      hi: C('teal1'),
      spark: C('zinc4'),
    },
    quayLit: C('gray5'),
    quayShade: C('gray4'),
    quayJoint: C('gray3'),
    rail: { top: C('gray3'), lit: C('gray2'), shade: C('gray1'), dark: C('ink') },
    lot: C('gray4'),
    leaves: true,
    ironRail: true,
    fills: {
      sidewalk: graniteFill(2, 1, C('gray5'), C('gray6'), C('gray3'), [C('gray3'), C('gray7')]),
      cobble: fanFill([C('stone1'), C('earth2'), C('stone0'), C('stone1'), C('gray3')], C('gray1')),
      plaza: framedFill(
        graniteFill(2, 2, C('gray6'), C('stone3'), C('gray4'), [C('gray4'), C('white')]),
        C('stone1'),
        C('stone2'),
        C('gray4'),
        0.06,
      ),
    },
    tram: { at: [0.3, 0.4, 0.6, 0.7], rail: C('gray5'), railHi: C('gray6'), groove: C('gray1') },
  },

  awnings: [
    ['gray1', 'gray2'],
    ['ink', 'gray1'],
    ['navy0', 'navy1'],
    ['green0', 'green1'],
    ['rust0', 'rust1'],
  ],
  look(kind, d, site) {
    const civic = kind === 'civic';
    const storeys = site?.storeys ?? 5;
    const low = storeys <= 4;
    const ringhiera = !civic && low && site?.roof === 'pitched' && d.chance(0.55);
    const style = civic
      ? 'neo'
      : ringhiera
        ? 'ringhiera'
        : d.weighted<string>([
            ['neo', low ? 6 : 5],
            ['raz', low ? 0 : 2],
            ['liberty', 2],
          ]);
    const wallName = {
      neo: low
        ? d.pick(['ochre2', 'ochre1', 'stone3', 'gray6', 'earth5'])
        : d.pick(['gray6', 'gray5', 'stone3', 'ochre2', 'gray6', 'stone4']),
      raz: d.pick(['stone4', 'gray6', 'stone3']),
      liberty: d.pick(['stone4', 'earth6', 'stone3']),
      ringhiera: d.pick(['ochre2', 'ochre1', 'earth5', 'rust3', 'ochre2']),
    }[style]!;
    const stone = style === 'raz' || civic || (style === 'neo' && d.chance(0.35));
    return {
      mat: stone ? 'ashlar' : 'stucco',
      wall: C(wallName),
      groundMat: style === 'ringhiera' ? 'smooth' : 'ashlar',
      ground: style === 'ringhiera' ? darker(C(wallName)) : C(d.pick(['gray5', 'gray4', 'stone2'])),
      trim:
        style === 'raz' ? lighter(C(wallName)) : C(d.pick(['stone4', 'gray7', 'white', 'stone5'])),
      frame: C(d.pick(['white', 'gray2', 'earth2'])),
      shutter: C(d.pick(['green1', 'gray4', 'green2', 'earth2', 'gray3'])),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(d.pick(['earth1', 'gray1', 'earth2', 'green0'])),
      slope: 'terracotta',
      flat: C('gray4'),
      quoins: false,
      variant: style,
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k;
      if (kind === 'civic') return fromGround === 1 ? 'tall' : 'plain';
      if (k === 0 && upper >= 3 && d.chance(0.6)) return 'small';
      if (fromGround === 1 && upper >= 3) return 'tall';
      return 'plain';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      const v = look.variant;
      if (v === 'ringhiera') {
        stampModule(f, G.MIL_RINGHIERA, x0, y0, res, glow, glowHi);
        ballatoio(f, x0, y0, look.iron, look.ironHi, lighter(look.trim));
        const o = d.next();
        if (o < 0.3) stampModule(f, M.LAUNDRY, x0, y0, res);
        else if (o < 0.5) stampModule(f, M.FLOWERS, x0, y0, res);
        else if (o < 0.53) stampModule(f, M.PEEK, x0, y0, res);
        return;
      }
      if (v === 'raz') {
        stampModule(f, G.MIL_WIN_RAZ, x0, y0, res, glow, glowHi);
        if (d.chance(0.04)) stampModule(f, M.BANNER_NO, x0, y0, res);
        return;
      }
      if (type === 'small') {
        stampModule(f, G.MIL_WIN_SMALL, x0, y0, res, glow, glowHi);
        return;
      }
      if (v === 'liberty' && type !== 'tall') {
        stampModule(f, G.MIL_WIN_LIB, x0, y0, res, glow, glowHi);
        if (d.chance(0.15)) stampModule(f, M.FLOWERS, x0, y0, res);
        return;
      }
      stampModule(f, type === 'tall' ? G.MIL_WIN_TALL : G.MIL_WIN, x0, y0, res, glow, glowHi);
      const r = d.next();
      if (r < 0.35) stampModule(f, G.MIL_SHUT_OPEN, x0, y0, res);
      else if (r < 0.55) stampModule(f, G.MIL_SHUT_CLOSED, x0, y0, res);
      else if (r < 0.58) stampModule(f, M.PEEK, x0, y0, res);
      const o = d.next();
      if (type === 'tall' && o < 0.45) {
        // Neoclassical iron balcony on the piano nobile, geraniums now and then.
        for (let x = x0; x < x0 + 8; x++) {
          f.set(x, y0 + 7, look.ironHi);
          f.set(x, y0 + 8, x % 2 === 0 ? look.iron : look.ironHi);
          f.set(x, y0 + 9, lighter(look.trim));
        }
        if (o < 0.15) stampModule(f, M.FLOWERS, x0, y0, res);
      } else if (o > 0.975) stampModule(f, G.FLAG_IT, x0, y0, itRes(res));
      else if (o > 0.96) stampModule(f, M.BANNER_NO, x0, y0, res);
      if (d.chance(0.05)) stampModule(f, M.AC_UNIT, x0, y0, res);
    },
    door: G.MIL_PORTONE,
    shop: (d) => (d.chance(0.5) ? G.MIL_BOUTIQUE : G.MIL_BAR),
    groundBay({ f, x0, y0, res, d, commercial }) {
      if (commercial || d.chance(0.25)) {
        stampModule(f, G.MIL_SHUTTER, x0, y0, res);
        if (d.chance(0.7)) tag(f, x0 + 1, y0 + 2 + d.int(0, 4), d);
      } else stampModule(f, G.MIL_GRATA, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
    },
    shopChance: 0.5,
    pipe: 'gray3',
    rusticateSmooth: true,
    doubleStringCourse: true,
    eavesTrim: true,
    dentilParapet: true,
    tagChance: 0.5,
    finish({ f, look, plan, d }) {
      const len = f.w;
      const T = look.trim;
      const v = look.variant;
      const groundTop = plan.H - STOREY;
      if (v === 'neo' || v === 'liberty') {
        // Severe cornice band and a string course over the piano nobile.
        for (let x = 0; x < len; x++) if (f.kindAt(x, 3) === K_WALL) f.set(x, 3, darker(T));
        const y = groundTop - STOREY - 1;
        if (plan.storeys >= 3)
          for (let x = 0; x < len; x++) if (f.kindAt(x, y) === K_WALL) f.set(x, y, T);
      }
      if (v === 'liberty') {
        // Floral frieze under the cornice.
        for (let x = 0; x < len; x++) {
          if (f.kindAt(x, 4) !== K_WALL) continue;
          const m = x % 6;
          f.set(
            x,
            4,
            m === 0 ? C('green2') : m === 3 ? C('pink2') : m === 1 || m === 5 ? lighter(T) : T,
          );
        }
      }
      if (v === 'raz') {
        // Stone cladding joints, horizontal emphasis.
        for (let y = CORNICE; y < groundTop; y += 5)
          for (let x = 0; x < len; x++) if (f.kindAt(x, y) === K_WALL) f.darken(x, y);
      }
      // Fashion wraps over the facades of the centro's big commercial blocks.
      if (plan.kind === 'commercial' && plan.storeys >= 4 && len >= 32 && d.chance(0.1)) {
        const w = Math.min(len - 4, d.int(18, 30));
        const h = Math.min(groundTop - CORNICE - 4, STOREY * d.int(2, 3) + 2);
        const x0 = d.int(2, Math.max(2, len - w - 2));
        const y0 = CORNICE + d.int(2, Math.max(2, groundTop - CORNICE - h - 2));
        if (h > 12) fashionWrap(f, x0, y0, w, h, d);
      }
      void K_GLASS;
    },
  },

  roofs: {
    terraceTiles: ['gray4', 'gray6', 'gray5'],
    pitchedChimneys: 'random',
    dormer: true,
    mansardStacks: ['gray5', 'gray6'],
    clutter: false,
    slopeTex: marsigliesi,
  },

  props: {
    lamp: { grid: G.LAMP_MILAN, keys: { M: 'zinc1', m: 'zinc0', A: 'gray5' } },
    metal: ['zinc1', 'zinc0'],
    bench: { frame: 'gray2', wood: 'earth2' },
    kiosk: { body: 'gray1', roof: 'gray2', top: { sign: 'ochre1' } },
    bin: { grid: G.BIN_MILAN, keys: { M: 'gray3', m: 'gray2' } },
    bollard: { grid: G.PANETTONE, keys: { S: 'gray6', s: 'gray5' } },
    hydrant: { M: 'crim2', m: 'crim1', A: 'gray5' },
    metro: { grid: G.METRO_MILAN, shadow: 3 },
    busStop: { frame: 'gray2', roof: 'gray5', flag: 'ochre2' },
    planter: 'gray5',
    cafe: {
      chair: 'gray1',
      table: 'white',
      umbrellas: [
        ['gray1', 'gray2'],
        ['white', 'gray6'],
        ['navy1', 'white'],
      ],
    },
    flag: MILANO,
    bike: { colours: ['ochre3'], basket: true, scooters: true },
    extra: {
      fountain: (k) => basinFountain(k, 'gray6'),
    },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 6, 'flat', 'commercial'],
      [3, 0, 2, 4, 5, 'terrace', 'commercial'],
      [5, 0, 2, 4, 6, 'pitched', 'residential'],
      [14, 0, 2, 4, 4, 'pitched', 'residential'],
    ],
    park: ['tree.chestnut', 'tree.plane'],
    street: 'tree.plane',
    seed: 1011,
    icons: [
      ['kiosk', 13, 12],
      ['metro', 13, 5, 0.3, 0.7],
      ['flag', 7, 14],
    ],
  },

  sampleRoof: 'pitched',
  decals: {
    tag: 'zio',
    tagGrid: `
###.###..#.
..#..#..#.#
.#...#..#.#
#....#..#.#
###.###..#.
`,
    puddles: true,
  },
  cars: [
    'taxi_milan',
    'hatch_silver',
    'scooter',
    'sedan_black',
    'smart_milan',
    'fiat500_milan',
    'delivery_van',
    'scooter_red',
    'hatch_white',
    'tram_milan',
    'bus_milan',
  ],
  minimapRoof: 'earth3',
  postcardSky: ['sky', 'zinc4'],
  mapTint: [176, 168, 160],
  protest: { item: 'umbrella', wokeChance: 0 },
};
