/**
 * City vehicle registry: src/art/vehicles/cities/<city>.ts → `veh.<id>.*` sprites, registered
 * after the shared decor vehicles (civil.ts). Ids must be unique across cities (`tram_budapest`).
 */
import { cityTable, citiesOf, type CityTable } from '../../maps/cityTable';
import type { SpriteRegistry } from '../lib/registry';
import { registerCiv, type CivDef } from './civil';
import * as CITY_VEHICLE_MODULES from './cities';

export const OWN_VEHICLES: CityTable<readonly CivDef[]> = cityTable<readonly CivDef[]>(
  CITY_VEHICLE_MODULES,
  'city vehicles',
);

/** Ids of every city-only vehicle (in registration order). */
export const CITY_VEHICLE_IDS: readonly string[] = citiesOf(OWN_VEHICLES).flatMap((c) =>
  OWN_VEHICLES[c]!.map((v) => v.id),
);

export function registerCityVehicles(reg: SpriteRegistry): void {
  for (const c of citiesOf(OWN_VEHICLES)) for (const v of OWN_VEHICLES[c]!) registerCiv(reg, v);
}
