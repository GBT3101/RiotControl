/**
 * Per-city building palettes ("looks"): seeded but cohesive choices of wall, trim, joinery,
 * ironwork, shopfront and roof materials — each city draws from its own palette subset
 * (EnvCity.awnings / EnvCity.look in src/art/env/cities/<city>.ts).
 */
import type { BuildingKind, CityId } from '../../../maps/contract';
import type { RGBA } from '../../palette';
import { C } from '../color';
import { envStyle, type BuildingSite } from '../style';
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
  /** City-defined building type tag for the facade / roof hooks (e.g. Berlin 'platte'). */
  variant?: string;
  /** Probability a window is lit at night. */
  lit: number;
  cloth: RGBA[];
}

const pick = <T>(d: Dice, xs: readonly T[]): T => d.pick(xs);

const CLOTH = [
  'white',
  'sky',
  'pink2',
  'ochre3',
  'crim2',
  'blue1',
  'lime',
  'lilac',
  'teal2',
  'rust3',
];

const SHOP_SIGNS: ReadonlyArray<readonly [string, string]> = [
  ['green1', 'ochre3'],
  ['rust0', 'ochre3'],
  ['navy1', 'stone5'],
  ['gray1', 'ochre2'],
  ['crim1', 'white'],
  ['plum0', 'ochre3'],
  ['teal1', 'white'],
];

/** Roll a building's palette: shared shop colours, then the city's own roll (EnvCity.look). */
export function makeLook(city: CityId, kind: BuildingKind, d: Dice, site?: BuildingSite): Look {
  const style = envStyle(city);
  const aw = pick(d, style.awnings);
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
  return { ...base, ...style.look(kind, d, site) };
}
