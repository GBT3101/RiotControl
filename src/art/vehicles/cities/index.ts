/**
 * City-only decor vehicles (trams, local taxis …), one module per city exporting a
 * `readonly CivDef[]` built with the kit in ../civil.ts (car, sedan, hatch, bus, boxVehicle …).
 * Add exactly one line per city (docs/E0.md):
 *
 *   export { budapest } from './budapest';
 *
 * Madrid, London and Paris vehicles predate the split and stay in ../civil.ts (CIVS).
 */
export {};
export { budapest } from './budapest';
