/**
 * MADRID — environment style (E0: moved verbatim from the M3a painters). Ochre / terracotta /
 * cream stucco blocks with iron balconies and green blinds, terracotta roofs and roof terraces,
 * granite pavements, fernandina lamps, Metro diamonds, EMT buses and white taxis.
 */
import { C, darker } from '../color';
import { GLOW, GLOW_HI, flagRes, tag } from '../bld/kit';
import { stampModule } from '../bld/face';
import * as M from '../bld/modules.grid';
import * as P from '../props.grid';
import type { EnvCity } from '../style';
import * as G from './madrid.grid';

export const madrid: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('stone1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('stone4'),
    kerbLit: C('stone3'),
    kerbShade: C('stone1'),
    side: {
      tones: [C('stone3'), C('stone3'), C('stone2'), C('stone3'), C('stone4')],
      joint: C('stone1'),
      grid: { rows: 2, cols: 3, stagger: 0.5 },
    },
    cobble: {
      tones: [C('stone2'), C('stone2'), C('stone1'), C('stone2'), C('gray5')],
      joint: C('stone0'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    plaza: {
      tones: [C('stone3'), C('stone3'), C('stone4')],
      border: C('stone2'),
      joint: C('stone1'),
    },
    grass: { base: 'grass', stripes: false, dry: 0.35 },
    gravel: { base: C('stone3'), dark: C('stone2'), light: C('stone4') },
    water: {
      deep: C('green0'),
      base: C('teal1'),
      ripple: C('green1'),
      hi: C('teal2'),
      spark: C('sky'),
    },
    quayLit: C('stone2'),
    quayShade: C('stone1'),
    quayJoint: C('stone0'),
    rail: { top: C('stone4'), lit: C('stone3'), shade: C('stone2'), dark: C('stone1') },
    lot: C('stone2'),
    leaves: false,
    ironRail: false,
  },

  awnings: [
    ['green2', 'green3'],
    ['green2', 'white'],
    ['rust1', 'rust2'],
    ['ochre1', 'ochre2'],
    ['navy1', 'white'],
    ['crim1', 'white'],
  ],
  look(kind, d) {
    const civic = kind === 'civic';
    const wallName = civic
      ? d.pick(['stone4', 'stone5', 'earth6'])
      : d.weighted<string>([
          ['ochre2', 6],
          ['ochre3', 4],
          ['stone4', 4],
          ['earth6', 4],
          ['earth5', 2],
          ['rust3', 1],
          ['stone5', 2],
          ['rust2', 1],
        ]);
    const brick = wallName === 'rust2';
    const light = ['stone4', 'stone5', 'earth6', 'ochre3'].includes(wallName);
    return {
      mat: brick ? 'brick' : civic ? 'ashlar' : 'stucco',
      wall: C(wallName),
      groundMat: civic ? 'ashlar' : 'smooth',
      ground: civic ? C('stone3') : d.chance(0.5) ? C('stone3') : darker(C(wallName)),
      trim: light
        ? C(d.pick(['white', 'stone5', 'ochre2']))
        : C(d.pick(['stone5', 'white', 'stone4'])),
      frame: C(d.pick(['white', 'green2', 'earth2', 'white'])),
      shutter: C(d.pick(['green2', 'green3', 'earth3', 'stone3', 'green2'])),
      iron: C('gray2'),
      ironHi: C('gray4'),
      door: C(d.pick(['earth2', 'earth1', 'green1', 'earth3'])),
      slope: 'terracotta',
      flat: C('gray5'),
      quoins: !brick && d.chance(0.5),
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      if (k === 0 && upper >= 4 && d.chance(0.5)) return 'small';
      return kind === 'civic' ? 'tall' : d.chance(0.85) ? 'balcony' : 'plain';
    },
    upperBay({ f, type, x0, y0, res, glow, glowHi, d }) {
      if (type === 'small') {
        stampModule(f, G.MAD_WIN, x0, y0, res, glow, glowHi);
        if (d.chance(0.15)) stampModule(f, M.AC_UNIT, x0, y0, res);
        return;
      }
      stampModule(f, G.MAD_DOOR, x0, y0, res, glow, glowHi);
      const r = d.next();
      if (r < 0.25) stampModule(f, G.MAD_BLIND_HALF, x0, y0, res);
      else if (r < 0.33) stampModule(f, G.MAD_BLIND_FULL, x0, y0, res);
      else if (r < 0.36) stampModule(f, M.PEEK, x0, y0, res);
      if (type === 'balcony') {
        stampModule(f, G.MAD_BALCONY, x0, y0, res);
        const o = d.next();
        if (o < 0.1) stampModule(f, M.FLOWERS, x0, y0, res);
        else if (o < 0.14) stampModule(f, M.LAUNDRY, x0, y0, res);
        else if (o < 0.155) stampModule(f, M.BANNER_NO, x0, y0, res);
        // Hanging flag: Spain red/yellow/red.
        else if (o < 0.17)
          stampModule(f, M.BALCONY_FLAG, x0, y0, flagRes(res, C('crim2'), C('ochre3')));
      } else if (d.chance(0.25)) stampModule(f, M.AC_UNIT, x0, y0, res);
      if (d.chance(0.04)) stampModule(f, M.SAT_DISH, x0, y0, res);
    },
    door: G.MAD_PORTAL,
    shop: (d) => (d.chance(0.35) ? G.MAD_BAR : G.MAD_SHOP),
    groundBay({ f, x0, y0, res, d, commercial }) {
      if (commercial || d.chance(0.25)) {
        stampModule(f, G.MAD_ROLLER, x0, y0, res);
        if (d.chance(0.6)) tag(f, x0 + 1, y0 + 3, d);
      } else stampModule(f, G.MAD_REJA, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
    },
    shopChance: 0,
    pipe: 'gray4',
    rusticateSmooth: false,
    doubleStringCourse: false,
    eavesTrim: false,
    dentilParapet: false,
    tagChance: 0.45,
  },

  roofs: {
    // Floor tiles: terracotta (baldosa de barro).
    terraceTiles: ['rust1', 'earth4', 'rust2'],
    pitchedChimneys: 'random',
    dormer: true,
    mansardStacks: ['stone3', 'stone4'],
    clutter: true,
  },

  props: {
    lamp: { grid: G.LAMP_MADRID, keys: { M: 'gray3', m: 'gray2', A: 'gray4' } },
    metal: ['gray3', 'gray2'],
    bench: { frame: 'gray2', wood: 'earth4' },
    kiosk: { body: 'green2', roof: 'green3', top: { sign: 'crim1' } },
    bin: { grid: P.BIN, keys: { B: 'green2', b: 'green1', A: 'gray5', d: 'ink', m: 'gray2' } },
    bollard: { grid: P.BOLLARD, keys: { M: 'earth2', m: 'earth1', A: 'stone4' } },
    hydrant: { M: 'ochre2', m: 'ochre1', A: 'gray3' },
    metro: { grid: G.METRO_MADRID, shadow: 3 },
    busStop: { frame: 'gray3', roof: 'crim1', flag: 'crim1' },
    planter: 'stone3',
    cafe: {
      chair: 'gray6',
      table: 'gray6',
      umbrellas: [
        ['white', 'green2'],
        ['white', 'crim2'],
        ['ochre3', 'white'],
      ],
    },
    flag: (_x, y, _W, H) => (y < 2 || y >= H - 2 ? C('crim2') : C('ochre3')),
    bike: { colours: ['white'], basket: true, scooters: true },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 5, 'terrace', 'residential'],
      [3, 0, 2, 4, 4, 'pitched', 'commercial'],
      [5, 0, 2, 4, 6, 'flat', 'commercial'],
      [14, 0, 2, 4, 5, 'pitched', 'residential'],
    ],
    park: ['tree.pine', 'tree.plane'],
    street: 'tree.plane',
    seed: 1005,
    icons: [
      ['kiosk', 13, 12],
      ['metro', 13, 5, 0.3, 0.7],
      ['flag', 7, 14],
    ],
  },

  sampleRoof: 'terrace',
  decals: { tag: 'mola', puddles: false },
  cars: [
    'taxi_madrid',
    'taxi_madrid',
    'hatch',
    'hatch_white',
    'sedan_beige',
    'scooter',
    'delivery_van',
    'hatch_silver',
    'sedan',
    'bus_madrid',
  ],
  minimapRoof: 'rust2',
  postcardSky: ['sky', 'ochre4'],
  mapTint: [214, 150, 92],
  protest: { item: 'pot', wokeChance: 0 },
};
