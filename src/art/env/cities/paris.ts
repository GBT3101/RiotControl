/**
 * PARIS — environment style (E0: moved verbatim from the M3a painters). Haussmann limestone
 * with continuous wrought-iron balconies and zinc mansards bristling with chimney stacks,
 * cafés everywhere, Guimard Métro signs, Morris columns, Wallace fountains, Vespas.
 */
import { C, lighter } from '../color';
import { GLOW, GLOW_HI, flagRes } from '../bld/kit';
import { stampModule } from '../bld/face';
import * as M from '../bld/modules.grid';
import type { EnvCity } from '../style';
import * as G from './paris.grid';

export const paris: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('zinc1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray4'),
    side: {
      tones: [C('stone3'), C('stone4'), C('stone3'), C('stone3'), C('stone4')],
      joint: C('stone2'),
      grid: { rows: 2, cols: 2, stagger: 0 },
    },
    cobble: {
      tones: [C('zinc2'), C('zinc2'), C('gray5'), C('zinc2'), C('zinc3')],
      joint: C('zinc0'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    plaza: {
      tones: [C('stone4'), C('stone4'), C('stone5')],
      border: C('stone3'),
      joint: C('stone2'),
    },
    grass: { base: 'grass', stripes: false, dry: 0.12 },
    gravel: { base: C('stone4'), dark: C('stone3'), light: C('stone5') },
    water: {
      deep: C('zinc1'),
      base: C('zinc2'),
      ripple: C('zinc1'),
      hi: C('zinc3'),
      spark: C('sky'),
    },
    quayLit: C('stone3'),
    quayShade: C('stone2'),
    quayJoint: C('stone1'),
    rail: { top: C('stone5'), lit: C('stone4'), shade: C('stone3'), dark: C('stone2') },
    lot: C('stone2'),
    leaves: true,
    ironRail: false,
  },

  awnings: [
    ['crim1', 'crim2'],
    ['crim1', 'white'],
    ['green1', 'green2'],
    ['navy1', 'white'],
    ['rust1', 'ochre2'],
  ],
  // Haussmann limestone.
  look(kind, d) {
    const civic = kind === 'civic';
    const wallName = civic
      ? 'stone5'
      : d.weighted<string>([
          ['stone4', 6],
          ['stone5', 3],
          ['stone3', 2],
          ['gray7', 1],
        ]);
    return {
      mat: 'ashlar',
      wall: C(wallName),
      groundMat: 'ashlar',
      ground: C(wallName),
      trim: lighter(C(wallName)),
      frame: C(d.pick(['white', 'gray7', 'stone5'])),
      shutter: C(d.pick(['gray6', 'stone4', 'zinc3', 'gray7'])),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(d.pick(['green1', 'navy1', 'gray1', 'rust0', 'teal1'])),
      slope: 'zinc',
      flat: C('zinc2'),
      quoins: false,
    };
  },

  facade: {
    floor(k, upper, roof) {
      const fromGround = upper - k; // 1 = first floor
      // Haussmann: continuous balconies on the 2nd and 5th floors.
      if (
        fromGround === 2 ||
        (fromGround === 5 && roof !== 'mansard') ||
        (fromGround === upper && upper >= 4 && roof !== 'mansard' && fromGround !== 1)
      )
        return 'gallery';
      return fromGround === 1 && upper >= 3 ? 'plain' : 'balcony';
    },
    upperBay({ f, type, x0, y0, res, glow, glowHi, d }) {
      stampModule(f, G.PAR_WIN, x0, y0, res, glow, glowHi);
      const r = d.next();
      if (r < 0.16) stampModule(f, G.PAR_PERSIENNES, x0, y0, res);
      else if (r < 0.2) stampModule(f, M.PEEK, x0, y0, res);
      if (type === 'balcony') stampModule(f, G.PAR_BALCONNET, x0, y0, res);
      if (type === 'gallery' || type === 'balcony') {
        const o = d.next();
        if (o < 0.09) stampModule(f, M.FLOWERS, x0, y0, res);
        else if (o < 0.105) stampModule(f, M.BANNER_NO, x0, y0, res);
        // Hanging flag: France blue/white bands.
        else if (o < 0.115)
          stampModule(f, M.BALCONY_FLAG, x0, y0, flagRes(res, C('blue1'), C('white')));
      }
    },
    door: G.PAR_DOOR,
    shop: (d) => (d.chance(0.4) ? G.PAR_CAFE : G.PAR_SHOP),
    groundBay({ f, x0, y0, res, d }) {
      stampModule(f, G.PAR_WIN, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
      if (d.chance(0.5)) stampModule(f, G.PAR_PERSIENNES, x0, y0, res);
    },
    shopChance: 0.7,
    pipe: 'zinc2',
    rusticateSmooth: false,
    doubleStringCourse: true,
    eavesTrim: false,
    dentilParapet: true,
    tagChance: 0.45,
  },

  roofs: {
    terraceTiles: ['gray4', 'gray6', 'gray5'],
    pitchedChimneys: 'random',
    dormer: false,
    mansardStacks: ['stone3', 'stone4'],
    clutter: false,
  },

  props: {
    lamp: { grid: G.LAMP_PARIS, keys: { M: 'green2', m: 'green1', A: 'ochre2' } },
    metal: ['green2', 'green1'],
    bench: { frame: 'green1', wood: 'green2' },
    kiosk: { body: 'green1', roof: 'green2', top: 'dome' },
    bin: { grid: G.BIN_PARIS, keys: { M: 'green2', m: 'green1' } },
    bollard: { grid: G.BOLLARD_PARIS, keys: { M: 'green2', m: 'green1' } },
    hydrant: { M: 'crim2', m: 'crim1', A: 'ochre2' },
    metro: { grid: G.METRO_PARIS, shadow: 0, lightKeys: ['O', 'Y'] },
    busStop: { frame: 'green1', roof: 'green2', flag: 'navy2' },
    planter: 'stone4',
    cafe: { chair: 'earth4', table: 'white', umbrellas: [['crim1', 'crim2']] },
    flag: (x, _y, W) => (x < W / 3 ? C('navy2') : x < (2 * W) / 3 ? C('white') : C('crim2')),
    bike: { colours: ['teal2', 'green3', 'blue1'], basket: false, scooters: true },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 6, 'mansard', 'residential'],
      [3, 0, 2, 4, 6, 'mansard', 'commercial'],
      [5, 0, 2, 4, 5, 'mansard', 'commercial'],
      [14, 0, 2, 4, 6, 'mansard', 'residential'],
    ],
    park: ['tree.chestnut', 'tree.plane'],
    street: 'tree.plane',
    seed: 1000,
    icons: [
      ['morris', 13, 12],
      ['wallace', 7, 14],
      ['metro', 13, 4, 0.5, 0.7],
      ['kiosk', 15, 5],
    ],
  },

  sampleRoof: 'mansard',
  decals: { tag: 'non', puddles: false },
  cars: [
    'car_2cv',
    'car_twingo',
    'scooter',
    'scooter_red',
    'hatch_white',
    'sedan_teal',
    'delivery_van',
    'hatch_yellow',
    'bus_paris',
  ],
  minimapRoof: 'navy2',
  postcardSky: ['sky', 'lilac'],
  mapTint: [232, 214, 168],
  protest: { item: 'baguette', wokeChance: 0.4 },
};
