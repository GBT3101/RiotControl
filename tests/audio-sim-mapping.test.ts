import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
import { tileToWorld } from '../src/core/iso';
import type { SimEvent, SimEventMap, SimEventType } from '../src/sim/events';
import { dispatchEvents } from '../src/sim/events';
import { createStats } from '../src/sim/stats';
import type { Unit } from '../src/sim/units';
import {
  busSource,
  createSimMapState,
  IGNORED_SIM_EVENTS,
  mapSimEvent,
  SIM_EVENT_AUDIO,
  SIM_EVENT_TYPES,
  type SimAudioSink,
  type SimBindOptions,
} from '../src/audio/simEvents';
import { SFX } from '../src/audio/sfx/catalog';
import { LOOPS } from '../src/audio/sfx/loops';
import { LOOP_IDS, SFX_IDS, type LoopId, type LoopOptions, type PlayOptions, type SfxId } from '../src/audio/types';

/** One sample payload per event type — the mapped type forces this list to stay complete. */
const SAMPLES: { [K in SimEventType]: SimEventMap[K] } = {
  spawned: { handle: 1, ptype: 'student', x: 10, y: 10, building: 3, doorI: 10, doorJ: 9 },
  unitDeployed: { unitId: 7, unit: 'riot', x: 12.5, y: 12.5, building: -1 },
  commanded: { unitId: 7, toI: 20, toJ: 20, pathLength: 9 },
  died: { handle: 1, ptype: 'woke', x: 11, y: 11, cause: 'melee', lethal: false, bodyId: 1, by: 7 },
  unitDied: {
    unitId: 7, unit: 'riot', x: 12, y: 12, cause: 'melee', lethal: true, bodyId: 2,
    member: 0, squadLeft: 0, thrownOff: false,
  },
  attacked: {
    attackerKind: 'unit', attackerId: 7, targetKind: 'protester', targetId: 1,
    x: 11, y: 11, damage: 10, dmgType: 'melee',
  },
  fired: {
    shooterKind: 'unit', shooterId: 8, weapon: 'pistol', x0: 5, y0: 5, z0: 0,
    x1: 9, y1: 9, projectileId: -1, hits: 1,
  },
  exploded: { kind: 'shell', x: 15, y: 15, radius: 2.5 },
  areaCreated: { areaId: 4, kind: 'gas', x: 14, y: 14, radius: 2.5, ttl: 6 },
  thrownOffRoof: {
    unitId: 9, unit: 'sniper', member: 0, building: 2, fromX: 20, fromY: 20, height: 3, toX: 21, toY: 22,
  },
  climbStart: { handle: 3, building: 2, x: 19, y: 19, duration: 2 },
  reachedRoof: { handle: 3, building: 2 },
  abilityReady: { unitId: 10 },
  abilityUsed: { unitId: 10, x: 16, y: 16 },
  flash: { handle: 5, x: 13, y: 13, unitId: 7 },
  bretaSpawned: { handle: 6, x: 30, y: 30, paparazzi: 8 },
  levelUp: { level: 3, units: ['gas'], protesters: [] },
  waveStart: { wave: 2, size: 40 },
  waveEnd: { wave: 2, breather: 15 },
  capitolDamaged: { amount: 12, integrity: 0.9, state: 1 },
  capitolState: { state: 2, integrity: 0.6 },
  hateGained: { amount: 1, x: 11, y: 11, reason: 'protester' },
  hateSpent: { amount: 5, unit: 'riot' },
  legitGained: { amount: 5, x: 12, y: 12, unit: 'riot' },
  defeat: { stats: createStats() },
  victory: { stats: createStats() },
};

const ev = <K extends SimEventType>(type: K, over: Partial<SimEventMap[K]> = {}): SimEvent =>
  ({ ...SAMPLES[type], ...over, type, tick: 0 }) as unknown as SimEvent;

class RecordingSink implements SimAudioSink {
  plays: { id: SfxId; opts?: PlayOptions }[] = [];
  loops: { key: string; id: LoopId; opts?: LoopOptions }[] = [];
  play(id: SfxId, opts?: PlayOptions): void {
    this.plays.push({ id, opts });
  }
  loop(key: string, id: LoopId, opts?: LoopOptions): void {
    this.loops.push({ key, id, opts });
  }
  get ids(): string[] {
    return [...this.plays.map((p) => p.id), ...this.loops.map((l) => l.id)];
  }
}

function run(events: SimEvent[], rnd = (): number => 0.1): RecordingSink {
  const sink = new RecordingSink();
  const st = createSimMapState({ rnd, capitol: { x: 100, y: 200 } });
  for (const e of events) mapSimEvent(e, sink, st);
  return sink;
}

// Compile-time: the sim's live unit list fits the `units` provider as documented in docs/M11.md.
export const unitsProviderFits = (active: Unit[]): SimBindOptions => ({ units: () => active });

describe('sim event → audio mapping', () => {
  it('covers every sim event type (handled or explicitly ignored)', () => {
    expect(new Set(SIM_EVENT_TYPES)).toEqual(new Set(Object.keys(SAMPLES)));
    for (const type of SIM_EVENT_TYPES) {
      const entry = SIM_EVENT_AUDIO[type];
      expect(entry === 'ignore' || typeof entry === 'function', type).toBe(true);
    }
    expect(IGNORED_SIM_EVENTS.sort()).toEqual(['abilityUsed', 'climbStart', 'hateSpent', 'reachedRoof']);
  });

  it('every handled event produces at least one valid sound', () => {
    for (const type of SIM_EVENT_TYPES) {
      const sink = run([ev('unitDeployed'), ev(type)]);
      const own = run([ev(type)]);
      if (SIM_EVENT_AUDIO[type] === 'ignore') {
        expect(own.ids, type).toEqual([]);
        continue;
      }
      expect(sink.ids.length, type).toBeGreaterThan(0);
      for (const p of [...sink.plays, ...own.plays]) expect(SFX_IDS).toContain(p.id);
      for (const l of [...sink.loops, ...own.loops]) expect(LOOP_IDS).toContain(l.id);
    }
  });

  it('every SFX and loop id has a catalogue entry', () => {
    for (const id of SFX_IDS) expect(SFX[id], id).toBeDefined();
    for (const id of LOOP_IDS) expect(LOOPS[id], id).toBeDefined();
  });

  it('converts tile positions to world pixels', () => {
    const s = run([ev('fired', { weapon: 'sniper', x0: 10, y0: 4 })]);
    const w = tileToWorld(10, 4);
    expect(s.plays[0]).toMatchObject({ id: 'sniper', opts: { x: w.x, y: w.y } });
  });

  it('maps weapons by kind, MG and door gun as keep-alive loops per shooter', () => {
    const weapons: [string, string][] = [
      ['rubber', 'rubberPop'], ['pistol', 'pistol'], ['rifle', 'rifle'], ['sniper', 'sniper'],
      ['cannon', 'tankCannon'], ['bazooka', 'bazooka'], ['molotov', 'molotovThrow'],
      ['gasGrenade', 'canisterPop'], ['gasCone', 'gasSpray'],
    ];
    for (const [weapon, sfx] of weapons) {
      const s = run([ev('fired', { weapon: weapon as never })]);
      expect(s.plays[0]?.id, weapon).toBe(sfx);
    }
    const mg = run([ev('fired', { weapon: 'mg', shooterId: 42 })]);
    expect(mg.loops[0]).toMatchObject({ key: 'mg:42', id: 'mgLoop' });
    const dg = run([ev('fired', { weapon: 'doorGun', shooterId: 43 })]);
    expect(dg.loops[0]).toMatchObject({ key: 'dg:43', id: 'doorGunLoop' });
    expect(run([ev('fired', { weapon: 'baton' })]).ids).toEqual([]);
  });

  it('uses tracked unit types for melee sounds', () => {
    const riotHit = run([
      ev('unitDeployed', { unitId: 1, unit: 'riot' }),
      ev('attacked', { attackerKind: 'protester', targetKind: 'unit', targetId: 1, dmgType: 'melee' }),
    ]);
    expect(riotHit.plays.at(-1)?.id).toBe('shieldThud');
    const blockade = run([
      ev('unitDeployed', { unitId: 2, unit: 'blockade' }),
      ev('attacked', { attackerKind: 'protester', targetKind: 'unit', targetId: 2, dmgType: 'melee' }),
    ]);
    expect(blockade.plays.at(-1)?.id).toBe('metalHit');
    const horse = run([
      ev('unitDeployed', { unitId: 3, unit: 'mounted' }),
      ev('attacked', { attackerKind: 'unit', attackerId: 3, dmgType: 'melee' }),
    ]);
    expect(horse.plays.at(-1)?.id).toBe('bat');
    const baton = run([ev('attacked', { attackerKind: 'unit', attackerId: 99, dmgType: 'melee' })]);
    expect(baton.plays[0]?.id).toBe('baton');
    const gallop = run([ev('unitDeployed', { unitId: 3, unit: 'mounted' }), ev('commanded', { unitId: 3 })]);
    expect(gallop.plays.at(-1)?.id).toBe('hooves');
  });

  it('distinguishes KO from lethal deaths and specials', () => {
    const ko = run([ev('died', { lethal: false })], () => 0.1);
    expect(ko.ids).toEqual(['bodyFall', 'koBoing']);
    const lethal = run([ev('died', { lethal: true, cause: 'bullet' })]);
    expect(lethal.ids).toEqual(['bodyFall']);
    expect(run([ev('died', { cause: 'crush' })]).ids).toEqual(['crunch']);
    expect(run([ev('died', { ptype: 'breta' })]).ids).toContain('paparazzi');
    expect(run([ev('exploded', { kind: 'prophet' })]).ids).toEqual(['prophetBoom']);
    expect(run([ev('exploded', { kind: 'molotov' })]).ids).toEqual(['glassSmash', 'fireWhoosh']);
  });

  it('turns gas and fire areas into loops that live for the area ttl', () => {
    const gas = run([ev('areaCreated', { kind: 'gas', areaId: 5, ttl: 6 })]);
    expect(gas.loops[0]).toMatchObject({ key: 'area:5', id: 'gasLoop', opts: { ttl: 6 } });
    const fire = run([ev('areaCreated', { kind: 'fire', areaId: 6, ttl: 4 })]);
    expect(fire.loops[0]).toMatchObject({ key: 'area:6', id: 'fireLoop', opts: { ttl: 4 } });
  });

  it('positions Capitol sounds at the configured Capitol', () => {
    const s = run([ev('capitolDamaged')]);
    expect(s.plays[0]).toMatchObject({ id: 'capitolHit', opts: { x: 100, y: 200 } });
  });

  it('busSource subscribes to every type on an EventBus', () => {
    const bus = new EventBus<SimEventMap>();
    const seen: string[] = [];
    const off = busSource(bus)((e) => seen.push(e.type));
    dispatchEvents([ev('levelUp'), ev('waveStart'), ev('died')], bus);
    expect(seen).toEqual(['levelUp', 'waveStart', 'died']);
    off?.();
    dispatchEvents([ev('levelUp')], bus);
    expect(seen.length).toBe(3);
  });
});
