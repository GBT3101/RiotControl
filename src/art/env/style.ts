/**
 * Per-city environment style (E0): everything the terrain, building, prop and preview painters
 * need to know about a city lives in ONE module, src/art/env/cities/<city>.ts, which exports an
 * `EnvCity`. The painters never test a city id; they read the style (`envStyle(city)`).
 *
 * Adding a city: write cities/<city>.ts (+ an optional cities/<city>.grid.ts for its pixel
 * grids) and add one line to cities/index.ts. Field-by-field guide: docs/E0.md §E3.
 */
import type { BuildingKind, CityId, RoofType } from '../../maps/contract';
import { cityTable, citiesOf, resolveCities, type CityTable } from '../../maps/cityTable';
import type { RGBA } from '../palette';
import type { Face, KeyResolver } from './bld/face';
import type { FacePlan, FloorType } from './bld/facade';
import type { Look } from './bld/looks';
import * as ENV_MODULES from './cities';
import type { CityMats } from './ground';
import type { IsoCanvas } from './raster';
import type { BayLayout } from './bld/facade';
import type { PropKit, PropSprite } from './props';
import type { Dice } from './util';

/** The city-specific part of a building's palette roll (looks.ts adds awning, signs, cloth). */
export type CityLook = Omit<Look, 'city' | 'awning' | 'sign' | 'signText' | 'cloth' | 'lit'>;

/** Footprint, height and roof of the building being rolled (EnvCity.look's optional 3rd arg). */
export interface BuildingSite {
  w: number;
  d: number;
  storeys: number;
  roof: RoofType;
}

/** One upper-storey bay to paint (facade.ts → FacadeStyle.upperBay). */
export interface BayCtx {
  f: Face;
  look: Look;
  type: FloorType;
  /** Bay origin on the face (px). */
  x0: number;
  y0: number;
  res: KeyResolver;
  /** Night glow colours for lit windows (0 = dark window). */
  glow: RGBA;
  glowHi: RGBA;
  d: Dice;
}

/** One single ground-floor bay that is neither a street door nor a double shopfront. */
export interface GroundBayCtx {
  f: Face;
  look: Look;
  x0: number;
  y0: number;
  res: KeyResolver;
  d: Dice;
  commercial: boolean;
  civic: boolean;
}

/** Facade rhythm and modules (bld/facade.ts). Grids are modules.grid.ts-style strings. */
export interface FacadeStyle {
  /** Storey type of upper storey `k` (0 = top) of `upper` upper storeys. */
  floor(k: number, upper: number, roof: RoofType, kind: BuildingKind, d: Dice): FloorType;
  /** Paint one upper-storey bay (windows, balconies, blinds, residents …). */
  upperBay(c: BayCtx): void;
  /** Ground-floor street-door module (residents' exits). */
  door: string;
  /** Double-bay shopfront module (may roll between variants). */
  shop(d: Dice): string;
  /** Paint a single ground-floor bay. */
  groundBay(c: GroundBayCtx): void;
  /** Chance that a non-civic, non-commercial building still gets shopfronts (0 = none). */
  shopChance: number;
  /** Drainpipe swatch. */
  pipe: string;
  /** Rusticate smooth ground floors too (not only ashlar ones). */
  rusticateSmooth: boolean;
  /** Second, lighter string course above the ground floor. */
  doubleStringCourse: boolean;
  /** Pitched roofs: trim-coloured eaves board. */
  eavesTrim: boolean;
  /** Flat / terrace parapets: dentil band. */
  dentilParapet: boolean;
  /** Chance of a spray tag at street level. */
  tagChance: number;
  /**
   * Optional finishing pass (E3 South), run after the cornice / eaves and before drainpipes and
   * weathering: city cornices (Roman cornicione, Modernista crests), corner tribunes, peeling
   * plaster … with fresh dice. Cities without it are unchanged.
   */
  finish?(c: FacadeFinishCtx): void;
}

/** What FacadeStyle.finish sees: the painted face, its look and plan (bld/facade.ts). */
export interface FacadeFinishCtx {
  f: Face;
  look: Look;
  plan: FacePlan;
  d: Dice;
}

/** Slope texture: a = px along the eave, b = px of rise above the eave, light −1 | 0 | 1. */
export type SlopeTex = (a: number, b: number, light: number) => RGBA;

/** Roofscape (bld/building.ts). */
export interface RoofStyle {
  /** Roof-terrace floor tiles [joint, tile, odd tile] (swatches). */
  terraceTiles: readonly [string, string, string];
  /** Pitched-roof chimneys: brick stacks on both party walls, or a random plain one. */
  pitchedChimneys: 'partyWalls' | 'random';
  /** Attic dormer (buhardilla) on the front slope of pitched roofs, now and then. */
  dormer: boolean;
  /** Mansard chimney-stack plaster [wall, highlight] (swatches). */
  mansardStacks: readonly [string, string];
  /** Water tanks and laundry lines on every flat roof (else only on terraces). */
  clutter: boolean;
  /** Optional custom slope texture (copper, glazed tiles …); `look.slope` still picks ridges. */
  slopeTex?: (look: Look, rise: number) => SlopeTex;
  /**
   * Optional skyline parts painted after the roof (E3): gables, domes, attic statues, spires,
   * corner turrets … (helpers in bld/ornaments.ts). Cities without it are unchanged.
   */
  ornament?: RoofOrnament;
}

/** Extra roof / skyline parts (RoofStyle.ornament), drawn into the building's iso canvas. */
export interface RoofOrnament {
  /** Extra sprite headroom (px) above the usual 18 px for parts that rise above the roof. */
  headroom: number;
  paint(o: OrnamentCtx): void;
}

/** What an ornament painter knows about the building (bld/building.ts). */
export interface OrnamentCtx {
  cv: IsoCanvas;
  look: Look;
  kind: BuildingKind;
  roof: RoofType;
  /** Footprint (tiles): u runs along w (+u face = right, shaded), v along d (+v face = left, lit). */
  w: number;
  d: number;
  /** Wall-top height (px) and the roof's rise above it (pitched / mansard). */
  H: number;
  rise: number;
  /** Storeys with facade. */
  storeys: number;
  seed: number;
  /** Fresh dice for the ornaments (the roof's own rolls are unaffected). */
  dice: Dice;
  /** Bay layouts of the left (+v, length w·16) and right (+u, length d·16) faces. */
  bays: { left: BayLayout; right: BayLayout };
  /** Visible face with the street door(s) (left wins), or 'back' if none is on a visible face. */
  street?: 'left' | 'right' | 'back';
}

/** Street furniture (props.ts). Swatch names; grids are props.grid.ts-style strings. */
export interface PropStyle {
  /** Street lamp: grid + keys M (metal lit), m (metal), A (accent); L/F are the lamp light. */
  lamp: { grid: string; keys: Readonly<Record<string, string>> };
  /** Street metal [lit, base] (traffic lights). */
  metal: readonly [string, string];
  bench: { frame: string; wood: string };
  /** News kiosk: body/roof colours, and a dome (Paris) or a sign board on top. */
  kiosk: { body: string; roof: string; top: 'dome' | { sign: string } };
  bin: { grid: string; keys: Readonly<Record<string, string>> };
  bollard: { grid: string; keys: Readonly<Record<string, string>> };
  /** Hydrant keys (M, m, A) on the shared HYDRANT grid. */
  hydrant: Readonly<Record<string, string>>;
  /** Metro / Tube / U-Bahn sign: grid, shadow length, keys that glow at night. */
  metro: { grid: string; shadow: number; lightKeys?: readonly string[] };
  busStop: { frame: string; roof: string; flag: string };
  /** Planter stone swatch. */
  planter: string;
  /** Café terrace: chair/table swatches and the umbrella colour pairs (one is rolled). */
  cafe: { chair: string; table: string; umbrellas: ReadonlyArray<readonly [string, string]> };
  /** Small flag on a pole (13×8 cloth): colour of cloth pixel (x, y). */
  flag: (x: number, y: number, W: number, H: number) => RGBA;
  /** Parked hire bikes: frame colours (one is rolled), basket, Vespas among them. */
  bike: { colours: readonly string[]; basket: boolean; scooters: boolean };
  /**
   * City-only props: decor kind → builder, registered as `prop.<kind>.<city>` (a blueprint
   * places them with `{ kind }` like any prop).
   */
  extra?: Readonly<Record<string, (k: PropKit) => PropSprite>>;
}

/** Gallery street-corner preview (preview.ts). */
export interface PreviewPlan {
  /** Buildings along the far pavement: [i, j, w, d, storeys, roof, kind]. */
  blds: ReadonlyArray<
    readonly [
      i: number,
      j: number,
      w: number,
      d: number,
      storeys: number,
      roof: RoofType,
      kind: BuildingKind,
    ]
  >;
  /** Park tree kinds [main, accent] and the street tree. */
  park: readonly [string, string];
  street: string;
  /** Base seed of the buildings. */
  seed: number;
  /** City icons: [prop kind, i, j, du?, dv?]. */
  icons: ReadonlyArray<readonly [kind: string, i: number, j: number, du?: number, dv?: number]>;
}

export interface EnvCity {
  /** Ground materials (ground.ts). */
  ground: CityMats;
  /** Building palette: awning colour pairs [stripe, alt] and the per-building roll. */
  awnings: ReadonlyArray<readonly [string, string]>;
  look(kind: BuildingKind, d: Dice, site?: BuildingSite): CityLook;
  facade: FacadeStyle;
  roofs: RoofStyle;
  props: PropStyle;
  preview: PreviewPlan;
  /** Roof of the gallery building samples marked 'city'. */
  sampleRoof: RoofType;
  /**
   * Ground decals sprinkled into the terrain (game/assets/jobs.ts): the local graffiti word
   * (`decal.tag.<tag>`: a shared design — anarchy, heart, no, mola, oi, non, riot — or the
   * city's own `tagGrid`, a decals.ts-style grid) and rain puddles.
   */
  decals: { tag: string; tagGrid?: string; puddles: boolean };
  /** Parked cars (decor vehicle ids, repeats = weight; view/ambient.ts). */
  cars: readonly string[];
  /** Minimap roof swatch. */
  minimapRoof: string;
  /** City-select postcard backdrop [sky, horizon] swatches. */
  postcardSky: readonly [string, string];
  /** Map viewer building tint (dev page). */
  mapTint: readonly [number, number, number];
  /**
   * Protesters' city item (an `item.<id>` of art/protesters/items.grid.ts: 'umbrella',
   * 'baguette', 'pot' — 'pot' means banging pots, cacerolada): students carry it, and woke
   * protesters swing it with `wokeChance` (else an umbrella).
   */
  protest: { item: string; wokeChance: number };
}

/** Cities with their own environment style (canonical order). */
export const OWN_ENV: CityTable<EnvCity> = cityTable<EnvCity>(ENV_MODULES, 'env style');
export const ENV_CITIES: readonly CityId[] = citiesOf(OWN_ENV);

/** Style city for art lookups: the city itself, or Madrid while its style is being built. */
export function envCity(city: CityId): CityId {
  return OWN_ENV[city] ? city : 'madrid';
}

const ENV: Readonly<Record<CityId, EnvCity>> = resolveCities(OWN_ENV, () => OWN_ENV.madrid!);

export function envStyle(city: CityId): EnvCity {
  return ENV[city];
}
