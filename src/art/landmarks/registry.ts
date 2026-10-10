/**
 * Landmark art per city (E0): src/art/landmarks/<city>/index.ts exports a `LandmarkCity` — the
 * Capitol (5 damage states), the city's secondary landmarks, the step stone, its flags and any
 * extra overlay sprites. cities.ts lists them (one line per city).
 */
import { CITIES, type CityId, type LandmarkId } from '../../maps/contract';
import { cityTable, citiesOf, resolveCities, type CityTable } from '../../maps/cityTable';
import type { SpriteRegistry } from '../lib/registry';
import * as LANDMARK_MODULES from './cities';
import type { DamageState } from './engine/kit';
import type { Ramp5 } from './engine/materials';
import type { SecondaryArt } from './shared';
import type { Build, FlagDef } from './types';

export interface CapitolArt {
  /** Footprint (must equal CAPITOL_FOOTPRINT[city]). */
  w: number;
  d: number;
  /** Pixels above the anchor (sprite top margin). */
  top: number;
  build: (s: DamageState) => Build;
}

export interface LandmarkCity {
  capitol: CapitolArt;
  /** Stone of the monumental step tiles in front of the Capitol (steps.ts). */
  stepStone: Ramp5;
  /** Art for each of the city's LANDMARKS (contract ids). */
  landmarks: Readonly<Partial<Record<LandmarkId, SecondaryArt>>>;
  /** Flags flown by the city's buildings: code → design (`lm.flag.<code>[.torn|.small]`). */
  flags: Readonly<Record<string, FlagDef>>;
  /** Extra overlay sprites (e.g. Big Ben's clock hands), registered with the flags. */
  registerFx?: (reg: SpriteRegistry) => void;
}

export const OWN_LANDMARKS: CityTable<LandmarkCity> = cityTable<LandmarkCity>(
  LANDMARK_MODULES,
  'landmark art',
);
/** Cities with their own Capitol / landmark art (canonical order). */
export const LANDMARK_CITIES: readonly CityId[] = citiesOf(OWN_LANDMARKS);

/** Per city; a city still being built uses Madrid's art as a stand-in (completeness test). */
const BY_CITY: Readonly<Record<CityId, LandmarkCity>> = resolveCities(
  OWN_LANDMARKS,
  () => OWN_LANDMARKS.madrid!,
);

/** Capitol art of every city (stand-in: Madrid's Congreso). */
export const CAPITOL_ART: Readonly<Record<CityId, CapitolArt>> = Object.fromEntries(
  CITIES.map((c) => [c, BY_CITY[c].capitol]),
) as Record<CityId, CapitolArt>;

/** Step-tile stone of a city's Capitol approach. */
export function stepStone(city: CityId): Ramp5 {
  return BY_CITY[city].stepStone;
}

/** Secondary landmark art that exists, by contract id (city order). */
export const SECONDARY: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = Object.assign(
  {},
  ...LANDMARK_CITIES.map((c) => OWN_LANDMARKS[c]!.landmarks),
) as Partial<Record<LandmarkId, SecondaryArt>>;
