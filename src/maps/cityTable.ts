/**
 * Per-city registries (E0). Every per-city concern (blueprint, environment style, Capitol and
 * landmark art, music, copy …) keeps one module per city in its own `cities/` folder, plus a
 * `cities/index.ts` holding nothing but one line per city:
 *
 *   export { budapest } from './budapest';
 *
 * The concern imports that index as a namespace and turns it into a table here:
 *
 *   import * as OWN from './cities';
 *   export const OWN_STYLES = cityTable<EnvCity>(OWN, 'env style');     // cities that have one
 *   export const STYLE = resolveCities(OWN_STYLES, (c) => OWN_STYLES.madrid!); // every CityId
 *
 * `cityTable` keeps the canonical `CITIES` order (the namespace itself is alphabetical) and
 * rejects exports that are not city ids. `resolveCities` fills the gaps with a stand-in so a
 * city that is still being built (blueprint in, art not yet) renders instead of crashing; the
 * completeness test (tests/cities-complete.test.ts) fails CI until every gap is closed.
 */
import { CITIES, type CityId } from './contract';

export type CityTable<T> = Readonly<Partial<Record<CityId, T>>>;

/** A module namespace of `export { <city> } from './<city>'` lines → table in CITIES order. */
export function cityTable<T>(ns: Readonly<Partial<Record<CityId, T>>>, what: string): CityTable<T> {
  for (const k of Object.keys(ns)) {
    if (!(CITIES as readonly string[]).includes(k))
      throw new Error(`${what}: "${k}" is not a CityId (src/maps/contract.ts)`);
  }
  const out: Partial<Record<CityId, T>> = {};
  for (const c of CITIES) {
    const v = ns[c];
    if (v !== undefined) out[c] = v;
  }
  return out;
}

/** Cities present in a table, in canonical order. */
export function citiesOf<T>(t: CityTable<T>): CityId[] {
  return CITIES.filter((c) => t[c] !== undefined);
}

/** Total table: own entries, `standIn(city)` for the cities that have none yet. */
export function resolveCities<T>(
  t: CityTable<T>,
  standIn: (city: CityId) => T,
): Readonly<Record<CityId, T>> {
  const out = {} as Record<CityId, T>;
  for (const c of CITIES) out[c] = t[c] ?? standIn(c);
  return out;
}
