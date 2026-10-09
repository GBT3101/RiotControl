/**
 * Per-city building palettes ("looks"): seeded but cohesive choices of wall, trim, joinery,
 * ironwork, shopfront and roof materials — each city draws from its own palette subset.
 */
import type { BuildingKind, CityId } from '../../../maps/contract';
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import type { Dice } from '../util';

export type WallMat = 'stucco' | 'brick' | 'ashlar' | 'smooth';
export type RoofMat = 'terracotta' | 'slate' | 'zinc';

export interface Look {
  city: CityId;
  mat: WallMat;
  wall: RGBA;
  /** Ground-floor band material & colour (London stucco, Paris rustication, Madrid plinth). */
  groundMat: WallMat;
  ground: RGBA;
  trim: RGBA;
  frame: RGBA;
  shutter: RGBA;
  iron: RGBA;
  ironHi: RGBA;
  door: RGBA;
  awning: [RGBA, RGBA];
  sign: RGBA;
  signText: RGBA;
  slope: RoofMat;
  /** Flat-roof surface colour. */
  flat: RGBA;
  quoins: boolean;
  /** Probability a window is lit at night. */
  lit: number;
  cloth: RGBA[];
}

const pick = <T>(d: Dice, xs: readonly T[]): T => d.pick(xs);

const CLOTH = ['white', 'sky', 'pink2', 'ochre3', 'crim2', 'blue1', 'lime', 'lilac', 'teal2', 'rust3'];

const SHOP_SIGNS: ReadonlyArray<readonly [string, string]> = [
  ['green1', 'ochre3'],
  ['rust0', 'ochre3'],
  ['navy1', 'stone5'],
  ['gray1', 'ochre2'],
  ['crim1', 'white'],
  ['plum0', 'ochre3'],
  ['teal1', 'white'],
];

const AWNINGS: Record<CityId, ReadonlyArray<readonly [string, string]>> = {
  madrid: [
    ['green2', 'green3'],
    ['green2', 'white'],
    ['rust1', 'rust2'],
    ['ochre1', 'ochre2'],
    ['navy1', 'white'],
    ['crim1', 'white'],
  ],
  london: [
    ['green1', 'white'],
    ['navy1', 'white'],
    ['crim1', 'white'],
    ['gray1', 'stone4'],
  ],
  paris: [
    ['crim1', 'crim2'],
    ['crim1', 'white'],
    ['green1', 'green2'],
    ['navy1', 'white'],
    ['rust1', 'ochre2'],
  ],
};

export function makeLook(city: CityId, kind: BuildingKind, d: Dice): Look {
  const aw = pick(d, AWNINGS[city]);
  const sg = pick(d, SHOP_SIGNS);
  const cloth = CLOTH.map((c) => C(c));
  const base = {
    city,
    awning: [C(aw[0]), C(aw[1])] as [RGBA, RGBA],
    sign: C(sg[0]),
    signText: C(sg[1]),
    cloth,
    lit: 0.4,
  };
  if (city === 'madrid') {
    const civic = kind === 'civic';
    const wallName = civic
      ? pick(d, ['stone4', 'stone5', 'earth6'])
      : d.weighted<string>([
          ['ochre2', 5],
          ['ochre3', 3],
          ['stone4', 3],
          ['earth6', 3],
          ['earth5', 2],
          ['rust3', 2],
          ['stone5', 2],
          ['rust2', 2],
        ]);
    const brick = wallName === 'rust2';
    const light = ['stone4', 'stone5', 'earth6', 'ochre3'].includes(wallName);
    return {
      ...base,
      mat: brick ? 'brick' : civic ? 'ashlar' : 'stucco',
      wall: C(wallName),
      groundMat: civic ? 'ashlar' : 'smooth',
      ground: civic ? C('stone3') : d.chance(0.5) ? C('stone3') : darker(C(wallName)),
      trim: light ? C(pick(d, ['white', 'stone5', 'ochre2'])) : C(pick(d, ['stone5', 'white', 'stone4'])),
      frame: C(pick(d, ['white', 'green2', 'earth2', 'white'])),
      shutter: C(pick(d, ['green2', 'green3', 'earth3', 'stone3', 'green2'])),
      iron: C('gray2'),
      ironHi: C('gray4'),
      door: C(pick(d, ['earth2', 'earth1', 'green1', 'earth3'])),
      slope: 'terracotta',
      flat: C('gray5'),
      quoins: !brick && d.chance(0.5),
    };
  }
  if (city === 'london') {
    const civic = kind === 'civic';
    const style = civic ? 'portland' : d.weighted<string>([
      ['stock', 4],
      ['red', 3],
      ['stucco', 2],
      ['grey', 2],
    ]);
    const wall = {
      stock: pick(d, ['earth4', 'stone2']),
      red: pick(d, ['rust2', 'rust1']),
      stucco: pick(d, ['white', 'gray7', 'stone5']),
      grey: 'stone2',
      portland: 'gray7',
    }[style]!;
    const stucco = style === 'stucco' || style === 'portland';
    return {
      ...base,
      mat: stucco ? (civic ? 'ashlar' : 'smooth') : 'brick',
      wall: C(wall),
      groundMat: stucco || d.chance(0.6) ? 'smooth' : 'brick',
      ground: stucco ? C(wall) : C(pick(d, ['white', 'gray7', 'stone5'])),
      trim: stucco ? C(pick(d, ['white', 'stone5'])) : C(pick(d, ['white', 'stone5', 'gray7'])),
      frame: C('white'),
      shutter: C('green1'),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(pick(d, ['crim1', 'gray1', 'navy1', 'green1', 'ochre2', 'teal1', 'plum1'])),
      slope: 'slate',
      flat: C('gray3'),
      quoins: !stucco && d.chance(0.35),
    };
  }
  // Paris — Haussmann limestone.
  const civic = kind === 'civic';
  const wallName = civic ? 'stone5' : d.weighted<string>([
    ['stone4', 6],
    ['stone5', 3],
    ['stone3', 2],
    ['gray7', 1],
  ]);
  return {
    ...base,
    mat: 'ashlar',
    wall: C(wallName),
    groundMat: 'ashlar',
    ground: C(wallName),
    trim: lighter(C(wallName)),
    frame: C(pick(d, ['white', 'gray7', 'stone5'])),
    shutter: C(pick(d, ['gray6', 'stone4', 'zinc3', 'gray7'])),
    iron: C('ink'),
    ironHi: C('gray2'),
    door: C(pick(d, ['green1', 'navy1', 'gray1', 'rust0', 'teal1'])),
    slope: 'zinc',
    flat: C('zinc2'),
    quoins: false,
  };
}
