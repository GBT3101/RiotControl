/**
 * Simulation public API (M6). Headless, deterministic, 30 Hz. See docs/M6.md.
 */
export { World, type WorldOptions, type GamePhase } from './world';
export { Crowd, PS, PANIM, FACINGS, type ProtesterState, type ProtesterAnim } from './crowd';
export { Unit, UnitPool, US, dir8FromDelta, facing4, type UnitState } from './units';
export { Bodies, BODY_KIND } from './bodies';
export { Projectile, Projectiles, TEAM_POLICE, TEAM_PROTESTERS } from './projectiles';
export { Area, Areas } from './areas';
export { Capitol } from './capitol';
export { Director, type DirectorPhase } from './director';
export { Economy } from './economy';
export { Nav } from './nav';
export { SpatialHash } from './spatialHash';
export { HELI_ALTITUDE, type DeployCheck, type DeployFail } from './placement';
export {
  EventBuffer,
  dispatchEvents,
  isEvent,
  type SimEvent,
  type SimEventMap,
  type SimEventType,
  type ActorKind,
  type ProjectileKind,
  type AreaKind,
  type ExplosionKind,
} from './events';
export {
  createStats,
  snapshotStats,
  totalFallen,
  totalOfficersLost,
  type StatsLedger,
} from './stats';
export { buildTestCity, type TestCityOptions } from './testCity';
