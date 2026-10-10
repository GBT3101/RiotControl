/**
 * LONDON — environment style (E0: moved verbatim from the M3a painters). Stock and red brick
 * terraces, stucco and Portland stone, slate roofs with chimney-pot stacks, sash windows, area
 * railings, grey York-stone pavements, Tube roundels, red buses and black cabs, rain puddles.
 */
import { C } from '../color';
import { GLOW, GLOW_HI } from '../bld/kit';
import { stampModule } from '../bld/face';
import * as M from '../bld/modules.grid';
import * as P from '../props.grid';
import type { EnvCity } from '../style';
import * as G from './london.grid';

export const london: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('zinc1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: true,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray3'),
    side: {
      tones: [C('gray5'), C('gray5'), C('gray6'), C('gray5'), C('gray4')],
      joint: C('gray3'),
      grid: { rows: 2, cols: 2, stagger: 0.5 },
    },
    cobble: {
      tones: [C('gray4'), C('gray4'), C('gray3'), C('gray4'), C('stone1')],
      joint: C('gray2'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    plaza: {
      tones: [C('gray6'), C('gray6'), C('gray7')],
      border: C('gray5'),
      joint: C('gray4'),
    },
    grass: { base: 'grass', stripes: true, dry: 0 },
    gravel: { base: C('stone2'), dark: C('stone1'), light: C('stone3') },
    water: {
      deep: C('zinc0'),
      base: C('zinc1'),
      ripple: C('zinc0'),
      hi: C('zinc3'),
      spark: C('zinc4'),
    },
    quayLit: C('gray5'),
    quayShade: C('gray4'),
    quayJoint: C('gray2'),
    rail: { top: C('green3'), lit: C('green2'), shade: C('green1'), dark: C('green0') },
    lot: C('gray4'),
    leaves: true,
    ironRail: true,
  },

  awnings: [
    ['green1', 'white'],
    ['navy1', 'white'],
    ['crim1', 'white'],
    ['gray1', 'stone4'],
  ],
  look(kind, d) {
    const civic = kind === 'civic';
    const style = civic
      ? 'portland'
      : d.weighted<string>([
          ['stock', 4],
          ['red', 3],
          ['stucco', 2],
          ['grey', 2],
        ]);
    const wall = {
      stock: d.pick(['earth4', 'stone2']),
      red: d.pick(['rust2', 'rust1']),
      stucco: d.pick(['white', 'gray7', 'stone5']),
      grey: 'stone2',
      portland: 'gray7',
    }[style]!;
    const stucco = style === 'stucco' || style === 'portland';
    return {
      mat: stucco ? (civic ? 'ashlar' : 'smooth') : 'brick',
      wall: C(wall),
      groundMat: stucco || d.chance(0.6) ? 'smooth' : 'brick',
      ground: stucco ? C(wall) : C(d.pick(['white', 'gray7', 'stone5'])),
      trim: stucco ? C(d.pick(['white', 'stone5'])) : C(d.pick(['white', 'stone5', 'gray7'])),
      frame: C('white'),
      shutter: C('green1'),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(d.pick(['crim1', 'gray1', 'navy1', 'green1', 'ochre2', 'teal1', 'plum1'])),
      slope: 'slate',
      flat: C('gray3'),
      quoins: !stucco && d.chance(0.35),
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k; // 1 = first floor
      if (k === 0 && upper >= 3) return 'small';
      if (fromGround === 1 && kind !== 'commercial') return d.chance(0.6) ? 'tall' : 'plain';
      return 'plain';
    },
    upperBay({ f, type, x0, y0, res, glow, glowHi, d }) {
      if (type === 'small') stampModule(f, G.LDN_SASH_SMALL, x0 + 1, y0, res, glow, glowHi);
      else if (type === 'tall') stampModule(f, G.LDN_SASH_TALL, x0, y0, res, glow, glowHi);
      else stampModule(f, G.LDN_SASH, x0, y0, res, glow, glowHi);
      const r = d.next();
      if (r < 0.05) stampModule(f, M.PEEK, x0, y0, res);
      else if (r < 0.14 && type !== 'small') stampModule(f, M.FLOWERS, x0, y0 + 4, res);
      else if (r < 0.17 && type === 'tall') stampModule(f, M.BANNER_NO, x0, y0, res);
      if (d.chance(0.04)) stampModule(f, M.SAT_DISH, x0, y0, res);
    },
    door: G.LDN_DOOR,
    shop: (d) => (d.chance(0.35) ? G.LDN_PUB : G.LDN_SHOP),
    groundBay({ f, x0, y0, res, d, commercial, civic }) {
      stampModule(f, G.LDN_SASH, x0, y0, res, d.chance(0.35) ? GLOW : 0, GLOW_HI);
      if (!commercial && !civic) stampModule(f, G.LDN_RAILINGS, x0, y0, res);
    },
    shopChance: 0,
    pipe: 'gray1',
    rusticateSmooth: true,
    doubleStringCourse: false,
    eavesTrim: true,
    dentilParapet: false,
    tagChance: 0.2,
  },

  roofs: {
    terraceTiles: ['gray4', 'gray6', 'gray5'],
    // Brick stacks on the party walls with a row of terracotta pots.
    pitchedChimneys: 'partyWalls',
    dormer: false,
    mansardStacks: ['rust2', 'rust3'],
    clutter: false,
  },

  props: {
    lamp: { grid: G.LAMP_LONDON, keys: { M: 'gray2', m: 'gray1', A: 'ochre2' } },
    metal: ['gray2', 'gray1'],
    bench: { frame: 'gray1', wood: 'earth4' },
    kiosk: { body: 'gray1', roof: 'crim1', top: { sign: 'navy1' } },
    bin: { grid: P.BIN, keys: { B: 'gray2', b: 'gray1', A: 'ochre2', d: 'ink', m: 'gray1' } },
    bollard: { grid: P.BOLLARD, keys: { M: 'gray2', m: 'gray1', A: 'ochre2' } },
    hydrant: { M: 'crim2', m: 'crim1', A: 'gray5' },
    metro: { grid: G.METRO_LONDON, shadow: 3 },
    busStop: { frame: 'gray2', roof: 'gray5', flag: 'crim2' },
    planter: 'gray6',
    cafe: { chair: 'earth2', table: 'gray6', umbrellas: [['green1', 'green2']] },
    flag: (x, y, W, H) => {
      // Union flag, simplified: blue field, white saltire + white-edged red cross.
      const cx = (W - 1) / 2;
      const cy = (H - 1) / 2;
      if (Math.abs(x - cx) < 1 || Math.abs(y - cy) < 0.6) return C('crim2');
      if (Math.abs(x - cx) < 2 || Math.abs(y - cy) < 1.6) return C('white');
      const diag =
        Math.abs((x - cx) * (H / W) - (y - cy)) < 0.7 ||
        Math.abs((x - cx) * (H / W) + (y - cy)) < 0.7;
      if (diag) return C('white');
      return C('navy1');
    },
    bike: { colours: ['crim2'], basket: true, scooters: false },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 4, 'pitched', 'residential'],
      [3, 0, 2, 4, 4, 'pitched', 'commercial'],
      [5, 0, 2, 4, 5, 'flat', 'commercial'],
      [14, 0, 2, 4, 5, 'mansard', 'residential'],
    ],
    park: ['tree.oak', 'tree.plane'],
    street: 'tree.plane',
    seed: 1000,
    icons: [
      ['phonebox', 13, 12],
      ['postbox', 7, 12, 0.6, 0.4],
      ['metro', 13, 5, 0.3, 0.7],
      ['kiosk', 15, 5],
    ],
  },

  sampleRoof: 'pitched',
  decals: { tag: 'non', puddles: true },
  cars: [
    'cab_london',
    'cab_london',
    'hatch_blue',
    'sedan_black',
    'delivery_van',
    'hatch_silver',
    'sedan',
    'hatch',
    'bus_london',
  ],
  minimapRoof: 'zinc2',
  postcardSky: ['sky', 'blue2'],
  mapTint: [176, 92, 74],
  protest: { item: 'umbrella', wokeChance: 0 },
};
