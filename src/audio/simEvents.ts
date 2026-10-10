/**
 * Sim event → sound mapping (pure; driven through a sink so it is unit-testable).
 *
 * `SIM_EVENT_AUDIO` has an entry for **every** `SimEventType` (enforced by the type): a handler
 * or `'ignore'`. Positions arrive in tile coordinates and are converted to world pixels.
 * Unit types are tracked from `unitDeployed` (or resolved through `opts.unitType`) because
 * `attacked`/`commanded` only carry ids.
 */
import { tileToWorld } from '../core/iso';
import type { EventBus } from '../core/events';
import type { UnitId } from '../data/units';
import type { SimEvent, SimEventMap, SimEventType } from '../sim/events';
import type { LoopId, LoopOptions, PlayOptions, SfxId, WorldPos } from './types';

export interface SimAudioSink {
  play(id: SfxId, opts?: PlayOptions): void;
  loop(key: string, id: LoopId, opts?: LoopOptions): void;
}

/** A subscription function: receives a handler, returns an unsubscribe (optional). */
export type SimEventSource = (handler: (e: SimEvent) => void) => (() => void) | void;

export interface SimBindOptions {
  /** Capitol position in world pixels (for `capitolDamaged` / `capitolState`). */
  capitol?: WorldPos | null;
  /** Resolve a unit's type by id (fallback when `unitDeployed` was not observed). */
  unitType?: (unitId: number) => UnitId | undefined;
  /**
   * Polled ~10×/s: live units (sim `world.units.active` fits). Vehicles get engine/rotor
   * loops that follow them (humvee, tank, heli).
   */
  units?: () => Iterable<{ id: number; type: string; x: number; y: number; moving?: boolean }>;
  /** Polled ~10×/s: alive protesters (e.g. `world.crowd.count`) for the crowd bed. */
  crowd?: () => number;
  /** Random source (tests). */
  rnd?: () => number;
}

export interface SimMapState {
  units: Map<number, { type: UnitId; x: number; y: number }>;
  /** Recent combat activity (decays in the engine; drives crowd anger). */
  activity: number;
  opts: SimBindOptions;
  rnd: () => number;
}

type Ev<K extends SimEventType> = Extract<SimEvent, { type: K }>;
type Handler<K extends SimEventType> = (e: Ev<K>, sink: SimAudioSink, st: SimMapState) => void;
export type SimEventAudioTable = { [K in SimEventType]: Handler<K> | 'ignore' };

const P = { x: 0, y: 0 };
/** Tile coords → world-pixel PlayOptions (reuses one scratch object for the position). */
function at(u: number, v: number, extra?: PlayOptions): PlayOptions {
  tileToWorld(u, v, P);
  return { x: P.x, y: P.y, ...extra };
}

function unitType(st: SimMapState, id: number): UnitId | undefined {
  return st.units.get(id)?.type ?? st.opts.unitType?.(id);
}

function track(st: SimMapState, id: number, x: number, y: number): void {
  const u = st.units.get(id);
  if (u) {
    u.x = x;
    u.y = y;
  }
}

const VEHICLES: ReadonlySet<string> = new Set(['blockade', 'humvee', 'tank']);

export const SIM_EVENT_AUDIO: SimEventAudioTable = {
  spawned: (e, sink) => sink.play('doorOpen', at(e.doorI + 0.5, e.doorJ + 0.5, { volume: 0.6 })),

  unitDeployed: (e, sink, st) => {
    st.units.set(e.unitId, { type: e.unit, x: e.x, y: e.y });
    sink.play('deploy');
    const p = at(e.x, e.y);
    switch (e.unit) {
      case 'riot':
        sink.play('shieldThud', { ...p, volume: 0.6 });
        break;
      case 'blockade':
        sink.play('blockadeSlam', p);
        break;
      case 'mounted':
        sink.play('horseWhinny', p);
        break;
      case 'humvee':
        sink.play('humveeRev', p);
        break;
      case 'tank':
        sink.play('tankTracks', p);
        break;
      case 'heli':
        sink.play('heliPass', p);
        break;
      case 'gas':
        sink.play('canisterPop', { ...p, volume: 0.5 });
        break;
      default:
        sink.play('bolt', p);
    }
  },

  commanded: (e, sink, st) => {
    const u = st.units.get(e.unitId);
    const type = unitType(st, e.unitId);
    const p = u ? at(u.x, u.y) : undefined;
    if (type === 'mounted') sink.play('hooves', p);
    else if (type === 'humvee') sink.play('humveeRev', p);
    else if (type === 'tank') sink.play('tankTracks', p);
    else if (type === 'heli') sink.play('heliPass', p);
    else sink.play('click');
  },

  died: (e, sink, st) => {
    st.activity += 1;
    const p = at(e.x, e.y);
    if (e.ptype === 'breta') {
      sink.play('koBoing', { ...p, volume: 1, pitch: 0.8 });
      sink.play('paparazzi', p);
      sink.play('crowdBoo');
      return;
    }
    if (e.cause === 'crush') {
      sink.play('crunch', p);
      return;
    }
    sink.play('bodyFall', { ...p, volume: e.cause === 'explosion' ? 0.5 : 0.8, delay: 0.05 });
    if (!e.lethal) {
      const r = st.rnd();
      if (r < 0.35) sink.play('koBoing', { ...p, volume: 0.8 });
      else if (r < 0.55) sink.play('dizzy', { ...p, volume: 0.8, delay: 0.15 });
    }
  },

  unitDied: (e, sink, st) => {
    st.activity += 2;
    const p = at(e.x, e.y);
    if (e.squadLeft <= 0) st.units.delete(e.unitId);
    switch (e.unit) {
      case 'blockade':
        sink.play('metalWreck', p);
        return;
      case 'humvee':
      case 'tank':
        sink.play('explosionBig', p);
        sink.play('metalWreck', { ...p, delay: 0.1 });
        return;
      case 'mounted':
        sink.play('horseWhinny', { ...p, pitch: 0.85 });
        break;
      default:
        break;
    }
    if (!e.thrownOff) sink.play('bodyFall', { ...p, volume: 1 });
    sink.play('whistle', { ...p, volume: 0.7, delay: 0.2 });
  },

  attacked: (e, sink, st) => {
    st.activity += 0.5;
    const p = at(e.x, e.y);
    if (e.targetKind === 'capitol') {
      sink.play('capitolHit', { ...p, volume: 0.6 });
      return;
    }
    if (e.dmgType === 'crush') {
      sink.play('crunch', p);
      return;
    }
    if (e.attackerKind === 'unit') {
      if (e.dmgType !== 'melee') return;
      sink.play(unitType(st, e.attackerId) === 'mounted' ? 'bat' : 'baton', p);
      return;
    }
    if (e.targetKind !== 'unit') return;
    track(st, e.targetId, e.x, e.y);
    const target = unitType(st, e.targetId);
    if (e.dmgType === 'melee') {
      if (target === 'riot') sink.play('shieldThud', p);
      else if (target && VEHICLES.has(target)) sink.play('metalHit', p);
      else sink.play('punch', p);
    } else if (e.dmgType === 'bullet') {
      sink.play(target && VEHICLES.has(target) ? 'ricochet' : 'bulletHit', p);
    }
    // explosion → `exploded`; gas / fire → their area loops.
  },

  fired: (e, sink, st) => {
    st.activity += 0.25;
    if (e.shooterKind === 'unit') track(st, e.shooterId, e.x0, e.y0);
    const p = at(e.x0, e.y0);
    switch (e.weapon) {
      case 'rubber':
        sink.play('rubberPop', p);
        sink.play('rubberHit', at(e.x1, e.y1, { delay: 0.06, volume: 0.8 }));
        return;
      case 'pistol':
        sink.play('pistol', p);
        return;
      case 'rifle':
        sink.play('rifle', p);
        return;
      case 'mg':
        sink.loop(`mg:${e.shooterId}`, 'mgLoop', { ...p, ttl: 0.22 });
        return;
      case 'doorGun':
        sink.loop(`dg:${e.shooterId}`, 'doorGunLoop', { ...p, ttl: 0.2 });
        return;
      case 'sniper':
        sink.play('sniper', p);
        return;
      case 'cannon':
        sink.play('tankCannon', p);
        return;
      case 'bazooka':
        sink.play('bazooka', p);
        return;
      case 'molotov':
        sink.play('molotovThrow', p);
        return;
      case 'gasGrenade':
        sink.play('canisterPop', p);
        return;
      case 'gasCone':
        sink.play('gasSpray', p);
        return;
      default:
        // baton / bat / none: melee lands through `attacked`.
        return;
    }
  },

  exploded: (e, sink, st) => {
    st.activity += 3;
    const p = at(e.x, e.y);
    switch (e.kind) {
      case 'shell':
        sink.play('explosionBig', p);
        return;
      case 'bazooka':
        sink.play('explosionMedium', p);
        return;
      case 'molotov':
        sink.play('glassSmash', p);
        sink.play('fireWhoosh', { ...p, delay: 0.03 });
        return;
      case 'gasGrenade':
        sink.play('metalHit', { ...p, volume: 0.35, pitch: 1.4 });
        return;
      case 'prophet':
        sink.play('prophetBoom', p);
        return;
    }
  },

  areaCreated: (e, sink) => {
    const p = at(e.x, e.y);
    sink.loop(`area:${e.areaId}`, e.kind === 'gas' ? 'gasLoop' : 'fireLoop', {
      x: p.x,
      y: p.y,
      ttl: e.ttl,
      volume: Math.min(1.3, 0.6 + e.radius * 0.25),
    });
  },

  thrownOffRoof: (e, sink) => {
    sink.play('fallWhistle', at(e.fromX, e.fromY));
    sink.play('bodyFall', at(e.toX, e.toY, { volume: 1.2, delay: 0.75 }));
    sink.play('crowdRoar', { volume: 0.45, delay: 0.8 });
  },

  climbStart: 'ignore', // too frequent; the climb is a visual beat (view).
  reachedRoof: 'ignore', // the following fight/throw-off carries the sound.

  abilityReady: (e, sink) => {
    // Ready chime by tier (docs/art/specials.md): the gas grenade keeps its own.
    switch (e.skill) {
      case 'gasGrenade':
        sink.play('abilityReady');
        return;
      case 'ram':
      case 'rapidFire':
        sink.play('skillReady1');
        return;
      case 'fragGrenade':
        sink.play('skillReady2');
        return;
      default:
        sink.play('skillReady3');
    }
  },
  abilityUsed: 'ignore', // the `fired` gasGrenade event carries the sound.

  skillUsed: (e, sink, st) => {
    st.activity += 2;
    const p = at(e.x0, e.y0);
    switch (e.skill) {
      case 'ram':
        sink.play('ramGallop', p);
        return;
      case 'rapidFire':
        sink.play('rapidFire', p); // all five shots in one sound (120 ms grid = the sim's)
        return;
      case 'fragGrenade':
        sink.play('fragPin', p);
        sink.play('fragThrow', { ...p, delay: 0.08 });
        return;
      case 'missile':
        sink.play('missileLaunch', p);
        return;
      case 'airStrike': {
        // The run: swoop as the heli dives in, the salvo as the first rocket leaves.
        const end = at(e.x1, e.y1);
        sink.play('airSwoop', { ...end, delay: Math.max(0, e.lead - 1.2) });
        sink.play('rocketSalvo', { ...end, delay: Math.max(0, e.lead - 0.22) });
        return;
      }
      default:
    }
  },

  skillHit: (e, sink, st) => {
    const p = at(e.x, e.y);
    switch (e.skill) {
      case 'ram':
        sink.play('ramImpact', p);
        return;
      case 'fragGrenade':
        st.activity += 3;
        sink.play('fragBoom', p);
        return;
      case 'missile':
        st.activity += 5;
        sink.play('missileBoom', p);
        return;
      case 'airStrike':
        // One chain sound (9 booms + rumble) for the whole run.
        if (e.index === 0) {
          st.activity += 5;
          sink.play('strikeChain', p);
        }
        return;
      default:
    }
  },
  skillShot: 'ignore', // `rapidFire` (on skillUsed) carries all five shots.
  skillEnded: 'ignore',

  flash: (e, sink) => {
    const p = at(e.x, e.y);
    sink.play('shutter', p);
    sink.play('flashWhine', { ...p, delay: 0.04 });
  },

  bretaSpawned: (e, sink) => {
    sink.play('paparazzi', at(e.x, e.y));
    sink.play('crowdRoar', { volume: 0.6 });
  },

  levelUp: (_e, sink) => sink.play('levelUp'),

  waveStart: (_e, sink) => {
    sink.play('waveAlarm');
    sink.play('siren', { volume: 0.5, delay: 1.1 });
  },

  waveEnd: (_e, sink) => sink.play('whistle', { volume: 0.8 }),

  capitolDamaged: (e, sink, st) => {
    const c = st.opts.capitol;
    const v = Math.min(1, 0.4 + e.amount / 60);
    sink.play('capitolHit', c ? { x: c.x, y: c.y, volume: v } : { volume: v * 0.5 });
  },

  capitolState: (_e, sink, st) => {
    const c = st.opts.capitol;
    const p = c ? { x: c.x, y: c.y } : {};
    sink.play('glassBreak', p);
    sink.play('alarmBell', { ...p, volume: 0.8, delay: 0.2 });
    sink.play('crowdRoar', { volume: 0.8 });
  },

  hateGained: (e, sink) => {
    if (e.reason === 'callEarly') {
      sink.play('hateChing', { volume: 1 });
      sink.play('stamp', { delay: 0.1 });
    } else if (e.reason === 'unit') sink.play('hateChing', { volume: 0.6 });
    else sink.play('hateChing', { volume: e.amount >= 50 ? 1 : 0.35 });
  },
  hateSpent: 'ignore', // `unitDeployed` plays the deploy thunk.

  legitGained: (_e, sink) => sink.play('legitStamp'),

  defeat: (_e, sink) => sink.play('defeatStinger'),
  victory: (_e, sink) => sink.play('victoryStinger'),
};

/** Every sim event type, in table order (for bus subscriptions and coverage tests). */
export const SIM_EVENT_TYPES = Object.keys(SIM_EVENT_AUDIO) as SimEventType[];
export const IGNORED_SIM_EVENTS = SIM_EVENT_TYPES.filter((k) => SIM_EVENT_AUDIO[k] === 'ignore');

export function createSimMapState(opts: SimBindOptions = {}): SimMapState {
  return { units: new Map(), activity: 0, opts, rnd: opts.rnd ?? Math.random };
}

export function mapSimEvent(e: SimEvent, sink: SimAudioSink, st: SimMapState): void {
  const h = SIM_EVENT_AUDIO[e.type] as Handler<SimEventType> | 'ignore' | undefined;
  if (!h || h === 'ignore') return;
  h(e as Ev<SimEventType>, sink, st);
}

/** Subscribe a handler to every sim event on a typed bus (`dispatchEvents` output). */
export function busSource(bus: EventBus<SimEventMap>): SimEventSource {
  return (handler) => {
    const offs = SIM_EVENT_TYPES.map((type) =>
      bus.on(type, (payload) => {
        const ev = payload as unknown as SimEvent;
        handler(ev.type === type ? ev : ({ ...payload, type, tick: 0 } as unknown as SimEvent));
      }),
    );
    return () => offs.forEach((off) => off());
  };
}
