/**
 * VIENNA — environment style (E3 Central). Ringstraße grandeur: cream, Schönbrunn-yellow, white
 * and pale-grey stucco palaces with rusticated ground floors, pilasters between the bays,
 * pedimented Beletage windows, stone balustrades, attic balustrades with statues and green
 * copper domes; Gründerzeit apartment blocks behind under dark grey roofs with copper corner
 * cupolas. Wide boulevards with tram tracks, grey-green Ringstraße candelabras, U-Bahn cubes,
 * orange litter bins, Kaffeehaus fronts and Würstelstände, red-white-red flags.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI } from '../bld/kit';
import { stampModule, type KeyResolver } from '../bld/face';
import * as M from '../bld/modules.grid';
import { PROFILES, billboard, dome, gable, prism } from '../bld/ornaments';
import type { Look } from '../bld/looks';
import type { EnvCity, OrnamentCtx, SlopeTex } from '../style';
import { hash } from '../util';
import * as P from '../props.grid';
import { boat, fountain, stand, type BoatColours } from './central';
import * as G from './vienna.grid';

const shadeBy = (c: RGBA, l: number): RGBA => (l > 0 ? lighter(c, l) : l < 0 ? darker(c, -l) : c);
const mod = (a: number, m: number): number => ((a % m) + m) % m;

function flagRes(res: KeyResolver): KeyResolver {
  const K: Record<string, RGBA> = { '1': C('crim2'), '2': C('white') };
  return (k, x, y) => K[k] ?? res(k, x, y);
}

// ------------------------------------------------------------------------------------ roofs --

/** Dark grey slate, verdigris copper (standing seams) and dull Viennese clay tiles. */
function slopeTex(look: Look, rise: number): SlopeTex {
  if (look.slope === 'zinc') {
    return (a, b, l) => {
      const ai = mod(Math.floor(a), 4);
      const bi = Math.floor(b);
      if (bi <= 0) return C('teal1');
      let c = ai === 0 ? C('teal2') : C('teal1');
      if (bi >= rise - 1) c = C('teal2');
      else if (hash(Math.floor(a) >> 2, bi, 5) % 13 === 0) c = C('teal1');
      return shadeBy(c, l);
    };
  }
  if (look.slope === 'terracotta') {
    return (a, b, l) => {
      const ai = Math.floor(a);
      const bi = Math.floor(b);
      if (bi <= 0) return C('earth1');
      if (bi >= rise - 1) return shadeBy(C('rust1'), l);
      let c = mod(ai, 3) === 0 ? C('rust1') : C('earth2');
      if (bi % 2 === 0) c = darker(c);
      return shadeBy(c, l);
    };
  }
  return (a, b, l) => {
    const ai = Math.floor(a);
    const bi = Math.floor(b);
    if (bi <= 0) return C('gray1');
    if (bi >= rise - 1) return shadeBy(C('teal1'), l); // copper ridge capping
    const course = Math.floor(bi / 2);
    let c = C('gray3');
    if (bi % 2 === 0) c = C('gray2');
    else if (mod(ai + course * 3, 5) === 0) c = C('gray2');
    else if (hash(ai >> 1, course, 23) % 13 === 0) c = C('gray4');
    return shadeBy(c, l);
  };
}

const COPPER = [C('zinc0'), C('teal1'), C('teal1'), C('teal2'), C('teal2')];

const FINIAL = `
.y.
yYy
.y.
yyy
`;
/** Marble attic statue. */
const STATUE = `
.WW.
.TT.
TTTt
TTTt
.Tt.
.TTt
TT.t
`;

function ornament(o: OrnamentCtx): void {
  const { cv, look, kind, w, d, H, rise, dice } = o;
  const gilt = { y: C('ochre2'), Y: C('ochre3') };
  const marble = { W: C('white'), T: C('stone5'), t: C('stone3') };
  const side = o.street === 'right' ? 'right' : 'left';
  const len = (side === 'left' ? w : d) * 16;
  const pediment = (span: number, z0: number, h: number): void => {
    const s0 = Math.round((len - span) / 2);
    const T = side === 'left' ? look.trim : darker(look.trim);
    const wall = side === 'left' ? look.wall : darker(look.wall);
    gable(cv, {
      side,
      w,
      d,
      s0,
      s1: s0 + span,
      z0,
      h,
      profile: PROFILES.pediment,
      tex: (x, y, edge) => {
        if (edge <= 0) return lighter(T);
        if (edge === 1 || y === 0) return darker(T);
        // Sculpted tympanum: a few lighter figures in relief.
        if (y > 1 && y < h - 3 && Math.abs(x - span / 2) < span / 4 && (x + y) % 3 === 0)
          return lighter(wall);
        return wall;
      },
    });
    const apex =
      side === 'left'
        ? { u: (s0 + span / 2) / 16, v: d + 0.03 }
        : { u: w + 0.03, v: d - (s0 + span / 2) / 16 };
    billboard(cv, { ...apex, z: z0 + h + 1 }, STATUE, marble, 2);
  };

  if (kind === 'civic') {
    const flat = o.roof === 'flat' || o.roof === 'terrace';
    const zTop = flat ? H : H + rise;
    if (len >= 32)
      pediment(
        Math.min(44, len - 8),
        flat ? H - 1 : H - 1,
        Math.min(12, Math.round(Math.min(44, len - 8) / 4)),
      );
    // Statues along the attic balustrade of both street faces.
    if (flat) {
      for (let k = 1; k < w * 2; k += 2)
        billboard(cv, { u: k / 2, v: d - 0.05, z: H + 3 }, STATUE, marble);
      for (let k = 1; k < d * 2; k += 2)
        billboard(cv, { u: w - 0.05, v: k / 2, z: H + 3 }, STATUE, {
          W: C('stone5'),
          T: C('stone4'),
          t: C('stone2'),
        });
    }
    // Copper dome on a drum over the centre of the bigger palaces.
    if (w >= 3 && d >= 3) {
      const cu = w / 2;
      const cvv = d / 2;
      prism(cv, {
        cu,
        cv: cvv,
        z0: zTop - 2,
        z1: zTop + 7,
        r: 0.42,
        n: 12,
        tex: (s, x, y) => {
          if (y < 0) return look.trim;
          if (y === 0) return lighter(look.trim);
          if (y === 1) return darker(look.trim);
          if (x % 4 === 2 && y > 2 && y < 8) return C('navy1');
          return s > 0.55 ? look.wall : darker(look.wall, s > 0.3 ? 1 : 2);
        },
      });
      dome(cv, {
        cu,
        cv: cvv,
        z0: zTop + 7,
        r: 0.44,
        h: 13,
        ramp: COPPER,
        ribs: 12,
        rib: C('sky'),
      });
      prism(cv, {
        cu,
        cv: cvv,
        z0: zTop + 19,
        z1: zTop + 23,
        r: 0.1,
        n: 6,
        tex: (s) => (s > 0.5 ? C('teal2') : C('teal1')),
      });
      billboard(cv, { u: cu, v: cvv, z: zTop + 23 }, FINIAL, gilt, 1);
    }
    return;
  }
  // Gründerzeit: copper corner cupola on taller corner blocks.
  if (o.storeys >= 4 && w >= 2 && d >= 2 && o.roof !== 'mansard' && dice.chance(0.2)) {
    const cu = w - 0.3;
    const cvv = d - 0.3;
    const zr = o.roof === 'pitched' ? H + Math.round(rise * 0.35) : H;
    const top = zr + 6;
    prism(cv, {
      cu,
      cv: cvv,
      z0: H - 3,
      z1: top,
      r: 0.3,
      n: 8,
      tex: (s, x, y) => {
        if (y < 0) return look.trim;
        if (y === 0) return lighter(look.trim);
        if (y === 1) return darker(look.trim);
        if (x % 4 === 1 && y > 2 && y < 7) return y === 3 ? look.trim : C('navy1');
        return s > 0.5 ? look.wall : darker(look.wall, s > 0.25 ? 1 : 2);
      },
    });
    dome(cv, {
      cu,
      cv: cvv,
      z0: top,
      r: 0.34,
      h: 11,
      ramp: COPPER,
      ribs: 8,
      rib: C('sky'),
      onion: 0.12,
    });
    billboard(cv, { u: cu, v: cvv, z: top + 11 }, FINIAL, gilt, 1);
  } else if (o.roof !== 'mansard' && len >= 32 && dice.chance(0.3)) {
    // Central risalit crowned by a small pediment.
    pediment(24, H - 1, 7);
  }
}

// ----------------------------------------------------------------------------------- props --

const BOAT: BoatColours = {
  hull: 'white',
  band: 'crim1',
  cabin: 'white',
  roof: 'gray6',
  flag: ['crim2', 'white', 'crim2'],
};

export const vienna: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('stone1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray3'),
    side: {
      tones: [C('gray5'), C('gray5'), C('gray6'), C('gray4'), C('stone2')],
      joint: C('gray4'),
      grid: { rows: 3, cols: 2, stagger: 0.5 },
    },
    cobble: {
      tones: [C('gray4'), C('gray5'), C('gray4'), C('stone2'), C('gray3')],
      joint: C('gray2'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    plaza: {
      tones: [C('stone4'), C('stone4'), C('gray7'), C('stone4')],
      border: C('stone3'),
      joint: C('stone3'),
    },
    grass: { base: 'grass', stripes: true, dry: 0.08 },
    gravel: { base: C('stone4'), dark: C('stone3'), light: C('stone5') },
    water: {
      deep: C('zinc0'),
      base: C('teal1'),
      ripple: C('zinc1'),
      hi: C('teal2'),
      spark: C('sky'),
    },
    quayLit: C('stone3'),
    quayShade: C('stone2'),
    quayJoint: C('stone1'),
    rail: { top: C('green2'), lit: C('green1'), shade: C('green0'), dark: C('ink') },
    lot: C('gray4'),
    leaves: true,
    ironRail: true,
    tram: { at: [0.3, 0.7], rail: C('gray5'), railHi: C('gray7'), groove: C('gray1') },
  },

  awnings: [
    ['crim1', 'white'],
    ['green1', 'stone4'],
    ['earth1', 'ochre2'],
    ['navy1', 'white'],
  ],
  look(kind, d) {
    const civic = kind === 'civic';
    const variant = civic ? 'palais' : d.chance(0.35) ? 'ring' : 'gruender';
    const wallName = civic
      ? d.pick(['stone4', 'stone5', 'white', 'gray7', 'ochre3'])
      : d.weighted<string>([
          ['stone4', 5],
          ['ochre3', 3],
          ['white', 2],
          ['gray7', 3],
          ['stone3', 2],
          ['earth6', 1],
          ['gray6', 1],
          ['stone5', 2],
        ]);
    const slope: Look['slope'] = civic
      ? d.weighted<Look['slope']>([
          ['zinc', 5],
          ['slate', 3],
        ])
      : d.weighted<Look['slope']>([
          ['slate', 7],
          ['terracotta', 2],
          ['zinc', 1],
        ]);
    const pale = ['stone5', 'white', 'gray7'].includes(wallName);
    return {
      mat: civic ? 'ashlar' : 'stucco',
      wall: C(wallName),
      groundMat: civic || variant === 'ring' || d.chance(0.5) ? 'ashlar' : 'smooth',
      ground: civic ? C('stone3') : pale ? C(d.pick(['stone4', 'gray6'])) : darker(C(wallName)),
      trim: pale
        ? C(d.pick(['stone4', 'gray6', 'stone5']))
        : C(d.pick(['white', 'stone5', 'white'])),
      frame: C(d.pick(['white', 'white', 'earth2', 'gray7'])),
      shutter: C('gray5'),
      iron: C('gray1'),
      ironHi: C('gray3'),
      door: C(d.pick(['earth1', 'earth2', 'green1', 'earth1'])),
      slope,
      flat: C('gray4'),
      quoins: false,
      variant,
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k;
      if (k === 0 && upper >= 4) return d.chance(kind === 'civic' ? 0.7 : 0.4) ? 'small' : 'plain';
      if (fromGround === 1) return kind === 'civic' || d.chance(0.25) ? 'balcony' : 'tall';
      if (fromGround === 2 && kind !== 'commercial') return 'tall';
      return 'plain';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      const x = x0 - 1;
      if (type === 'small') stampModule(f, G.VIE_WIN_SMALL, x, y0, res, glow, glowHi);
      else if (type === 'balcony') {
        stampModule(f, G.VIE_BALDOOR, x, y0, res, glow, glowHi);
        if (d.chance(0.08)) stampModule(f, M.FLOWERS, x0, y0 - 1, res);
      } else if (type === 'tall')
        stampModule(
          f,
          (x0 >> 1) % 3 === 1 ? G.VIE_WIN_SEG : G.VIE_WIN_PED,
          x,
          y0,
          res,
          glow,
          glowHi,
        );
      else stampModule(f, G.VIE_WIN, x, y0, res, glow, glowHi);
      if (type === 'small') return;
      const r = d.next();
      if (r < 0.04) stampModule(f, M.PEEK, x0, y0, res);
      else if (r < 0.08 && look.variant !== 'palais') stampModule(f, M.FLOWERS, x0, y0 + 3, res);
      else if (r < 0.09) stampModule(f, M.BANNER_NO, x0, y0, res);
      else if (r < 0.1) stampModule(f, G.VIE_FLAG, x0, y0, flagRes(res));
    },
    door: G.VIE_DOOR,
    shop: (d) => (d.chance(0.45) ? G.VIE_CAFE : G.VIE_SHOP),
    groundBay({ f, x0, y0, res, d }) {
      stampModule(f, G.VIE_GWIN, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
    },
    shopChance: 0.45,
    pipe: 'gray4',
    rusticateSmooth: true,
    doubleStringCourse: true,
    eavesTrim: true,
    dentilParapet: true,
    tagChance: 0.2,
  },

  roofs: {
    terraceTiles: ['gray3', 'gray5', 'gray4'],
    pitchedChimneys: 'random',
    dormer: true,
    mansardStacks: ['stone3', 'stone4'],
    clutter: false,
    slopeTex,
    ornament: { headroom: 16, paint: ornament },
  },

  props: {
    lamp: { grid: G.LAMP_VIENNA, keys: { M: 'green1', m: 'green0', A: 'ochre1' } },
    metal: ['gray2', 'gray1'],
    bench: { frame: 'gray1', wood: 'green2' },
    kiosk: { body: 'gray6', roof: 'crim1', top: { sign: 'crim1' } },
    bin: {
      grid: G.BIN_VIENNA,
      keys: { B: 'rust3', b: 'rust2', A: 'gray6', d: 'ink', M: 'gray3', m: 'gray2' },
    },
    bollard: { grid: P.BOLLARD, keys: { M: 'gray2', m: 'gray1', A: 'white' } },
    hydrant: { M: 'crim2', m: 'crim1', A: 'gray5' },
    metro: { grid: G.METRO_VIENNA, shadow: 3 },
    busStop: { frame: 'gray2', roof: 'gray5', flag: 'crim2' },
    planter: 'stone4',
    cafe: {
      chair: 'earth2',
      table: 'white',
      umbrellas: [
        ['crim1', 'white'],
        ['white', 'white'],
        ['green1', 'stone4'],
      ],
    },
    // Austria: red / white / red.
    flag: (_x, y, _W, H) => (y < H / 3 || y >= (2 * H) / 3 ? C('crim2') : C('white')),
    bike: { colours: ['crim2'], basket: true, scooters: true },
    extra: {
      'boat.i': (k) => boat(k, 'i', BOAT),
      'boat.j': (k) => boat(k, 'j', BOAT),
      // Würstelstand and a Trafik / newspaper stand.
      'kiosk.0': (k) =>
        stand(k, {
          body: 'gray6',
          trim: 'crim1',
          awning: ['crim1', 'white'],
          goods: ['rust3', 'ochre3', 'earth4', 'rust3'],
          sign: 'crim1',
          signText: 'white',
        }),
      'kiosk.1': (k) =>
        stand(k, {
          body: 'navy1',
          trim: 'gray6',
          awning: ['navy2', 'white'],
          goods: ['white', 'gray6', 'crim2', 'ochre3'],
          sign: 'ochre2',
          signText: 'ink',
        }),
      fountain: (k) => fountain(k, { stone: 'stone4', water: 'teal1', jet: 'sky' }),
      'statue.equestrian': (k) =>
        k.gridProp(
          G.EQUESTRIAN_VIENNA,
          {
            q: 'gray1',
            Q: 'gray3',
            T: 'stone4',
            t: 'stone3',
            S: 'stone2',
            s: 'stone1',
            W: 'stone5',
          },
          { shadow: 8 },
        ),
      'statue.0': (k) =>
        k.gridProp(
          G.STATUE_VIENNA,
          { T: 'white', t: 'stone4', S: 'stone3', s: 'stone2', W: 'white' },
          { shadow: 5 },
        ),
      'statue.1': (k) =>
        k.gridProp(
          G.STATUE_VIENNA,
          { T: 'gray4', t: 'gray2', S: 'stone3', s: 'stone2', W: 'stone5' },
          { shadow: 5 },
        ),
    },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 5, 'pitched', 'residential'],
      [3, 0, 2, 4, 5, 'flat', 'commercial'],
      [5, 0, 2, 4, 5, 'pitched', 'residential'],
      [12, 0, 4, 4, 4, 'flat', 'civic'],
    ],
    park: ['tree.chestnut', 'tree.plane'],
    street: 'tree.chestnut',
    seed: 1200,
    icons: [
      ['kiosk', 13, 12],
      ['metro', 7, 5, 0.3, 0.7],
      ['flag', 7, 14],
      ['morris', 15, 12],
    ],
  },

  sampleRoof: 'pitched',
  decals: {
    tag: 'oida',
    tagGrid: `
.##..###.###...##.
#..#..#..#..#.#..#
#..#..#..#..#.####
#..#..#..#..#.#..#
.##..###.###..#..#
`,
    puddles: false,
  },
  cars: [
    'taxi_vienna',
    'sedan_black',
    'hatch_silver',
    'hatch_white',
    'sedan',
    'hatch_blue',
    'delivery_van',
    'tram_vienna',
    'bus_vienna',
    'sedan_black',
  ],
  minimapRoof: 'gray4',
  postcardSky: ['sky', 'stone5'],
  mapTint: [224, 206, 160],
  protest: { item: 'umbrella', wokeChance: 0 },
};
