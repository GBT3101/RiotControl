/**
 * Simulation → view/UI event stream.
 *
 * The sim appends plain event records to `world.events` while stepping; consumers drain
 * them once per rendered frame (`world.events.drain()`), which also covers frames that ran
 * several sim steps. Events are emitted per *occurrence* (a hit, a death, a shot) — never per
 * protester per tick — so the stream stays small. `dispatchEvents` forwards a drained batch
 * to a typed `EventBus` for consumers that prefer subscriptions.
 *
 * Positions are continuous tile coordinates (u, v) — convert with `core/iso.tileToWorld`.
 * Protesters are referenced by **handle** (`slot | gen << 16`, see `Crowd.handle`), units by
 * their stable `unitId`.
 */
import type { EventBus } from '../core/events';
import type { DamageType } from '../data/damage';
import type { ProtesterId } from '../data/protesters';
import type { AbilityId, UnitId, WeaponKind } from '../data/units';
import type { StatsLedger } from './stats';

export type ActorKind = 'protester' | 'unit' | 'capitol' | 'none';

export type ProjectileKind = 'shell' | 'bazooka' | 'molotov' | 'gasGrenade';
export type AreaKind = 'gas' | 'fire';
export type ExplosionKind = ProjectileKind | 'prophet';

export interface SimEventMap {
  /** A protester left a building door (view: door-open + exit animation). */
  spawned: {
    handle: number;
    ptype: ProtesterId;
    x: number;
    y: number;
    building: number;
    doorI: number;
    doorJ: number;
  };
  unitDeployed: { unitId: number; unit: UnitId; x: number; y: number; building: number };
  /** Commandable unit got a new destination. */
  commanded: { unitId: number; toI: number; toJ: number; pathLength: number };
  /** A protester fell. `lethal` false = KO visuals (stars/birds). */
  died: {
    handle: number;
    ptype: ProtesterId;
    x: number;
    y: number;
    cause: DamageType;
    lethal: boolean;
    bodyId: number;
    /** Unit id of the killer, or -1. */
    by: number;
  };
  /** A Ministry unit (or one Sniper Brigade member) fell. */
  unitDied: {
    unitId: number;
    unit: UnitId;
    x: number;
    y: number;
    cause: DamageType;
    lethal: boolean;
    bodyId: number;
    /** Squad member index for squads (0 otherwise); `squadLeft` > 0 = the unit lives on. */
    member: number;
    squadLeft: number;
    thrownOff: boolean;
  };
  /** A damaging hit landed (melee impacts, bullet hits, explosions on units). */
  attacked: {
    attackerKind: ActorKind;
    attackerId: number;
    targetKind: ActorKind;
    targetId: number;
    x: number;
    y: number;
    damage: number;
    dmgType: DamageType;
  };
  /**
   * A weapon fired. Hitscan: `projectileId` -1 and (x1, y1) = impact (draw a tracer).
   * Ballistic: a projectile was launched (track it in `world.projectiles.active`).
   */
  fired: {
    shooterKind: ActorKind;
    shooterId: number;
    weapon: WeaponKind | 'pistol' | 'rifle' | 'molotov' | 'bazooka' | 'gasGrenade';
    x0: number;
    y0: number;
    /** Height of the muzzle in storeys (rooftop shooters), 0 on the ground. */
    z0: number;
    x1: number;
    y1: number;
    projectileId: number;
    hits: number;
  };
  exploded: { kind: ExplosionKind; x: number; y: number; radius: number };
  areaCreated: {
    areaId: number;
    kind: AreaKind;
    x: number;
    y: number;
    radius: number;
    ttl: number;
  };
  /** Climbers threw a rooftop unit (member) off its roof: arc from (fromX, fromY, height) to (toX, toY). */
  thrownOffRoof: {
    unitId: number;
    unit: UnitId;
    member: number;
    building: number;
    fromX: number;
    fromY: number;
    height: number;
    toX: number;
    toY: number;
  };
  climbStart: { handle: number; building: number; x: number; y: number; duration: number };
  reachedRoof: { handle: number; building: number };
  /** A unit's special skill finished charging. */
  abilityReady: { unitId: number; skill: AbilityId };
  /** The Tear Gas Shooter threw its grenade at (x, y) (the `fired` gasGrenade carries the rest). */
  abilityUsed: { unitId: number; x: number; y: number };
  /**
   * One of the five special skills went off (docs/specials.md). (x0, y0) = the unit, (x1, y1) =
   * the target point (ram: the end of the lane; rapid fire: the first target; air strike: the end
   * of the line). `path` = the air strike's line as flat [u0, v0, u1, v1, …] (null otherwise).
   * `impactAt` = seconds until the blast / the ram's gallop / the strike's first impact; `dur` =
   * seconds until it is over. `seed` keys the view's FX recipe. Effects resolve in the sim as
   * `skillHit` / `skillShot` events at those times.
   */
  skillUsed: {
    unitId: number;
    unit: UnitId;
    skill: AbilityId;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    path: number[] | null;
    impactAt: number;
    /** Air strike: the run's lead time (s) — the recipe's `lead` option. */
    lead: number;
    dur: number;
    radius: number;
    seed: number;
  };
  /**
   * A skill landed: the frag / missile blast, air-strike impact `index` (k-th along the line), or
   * a protester bowled over by the ram (index = that hit's number in the run). `kills` = protesters
   * it dropped.
   */
  skillHit: {
    unitId: number;
    skill: AbilityId;
    x: number;
    y: number;
    radius: number;
    index: number;
    kills: number;
  };
  /** One rapid-fire shot (`index` 0…shots-1): tracer from (x0, y0) to (x1, y1). */
  skillShot: {
    unitId: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    hits: number;
    index: number;
  };
  /** A ram / air strike run is over (the unit is free again). */
  skillEnded: { unitId: number; skill: AbilityId };
  /** Paparazzi flash blinded a unit. */
  flash: { handle: number; x: number; y: number; unitId: number };
  bretaSpawned: { handle: number; x: number; y: number; paparazzi: number };
  levelUp: { level: number; units: UnitId[]; protesters: ProtesterId[] };
  waveStart: { wave: number; size: number };
  waveEnd: { wave: number; breather: number };
  /** Aggregated Capitol damage (at most once per `capitolEventInterval`). */
  capitolDamaged: { amount: number; integrity: number; state: number };
  capitolState: { state: number; integrity: number };
  hateGained: { amount: number; x: number; y: number; reason: 'protester' | 'unit' | 'callEarly' };
  hateSpent: { amount: number; unit: UnitId };
  legitGained: { amount: number; x: number; y: number; unit: UnitId };
  defeat: { stats: StatsLedger };
  victory: { stats: StatsLedger };
}

export type SimEventType = keyof SimEventMap;
export type SimEvent = {
  [K in SimEventType]: { type: K; tick: number } & SimEventMap[K];
}[SimEventType];

/** Narrow helper: `if (isEvent(e, 'died')) e.lethal`. */
export function isEvent<K extends SimEventType>(
  e: SimEvent,
  type: K,
): e is Extract<SimEvent, { type: K }> {
  return e.type === type;
}

/** Double-buffered per-frame event list. */
export class EventBuffer {
  private cur: SimEvent[] = [];
  private spare: SimEvent[] = [];
  /** Safety valve when nobody drains (keeps memory bounded). */
  maxPending = 50000;
  tick = 0;

  push<K extends SimEventType>(type: K, payload: SimEventMap[K]): void {
    if (this.cur.length >= this.maxPending) this.cur.length = 0;
    const e = payload as SimEventMap[K] & { type: K; tick: number };
    e.type = type;
    e.tick = this.tick;
    this.cur.push(e as unknown as SimEvent);
  }

  /** Events since the last drain. The returned array is reused by the drain after next. */
  drain(): readonly SimEvent[] {
    const out = this.cur;
    this.cur = this.spare;
    this.cur.length = 0;
    this.spare = out;
    return out;
  }

  /** Pending events (not drained). */
  get pending(): readonly SimEvent[] {
    return this.cur;
  }

  clear(): void {
    this.cur.length = 0;
  }
}

/** Forward a drained batch to a typed bus (`bus.on('died', …)`). */
export function dispatchEvents(events: readonly SimEvent[], bus: EventBus<SimEventMap>): void {
  for (const e of events) bus.emit(e.type, e as never);
}
