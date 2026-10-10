/**
 * SFX catalogue: recipe + mix level + bus + rate-limit policy for every `SfxId`.
 *
 * `variants` > 0 → the sound is baked offline into that many buffers (different random seeds)
 * the first time it is needed (or pre-baked after unlock) and later plays as a cheap buffer
 * voice with pitch jitter; 0 → always synthesised live (rare, long or musical sounds).
 * Levels (`gain`) were calibrated with the offline render check (src/audio/dev/check.mjs).
 */
import type { SfxPolicy } from '../limiter';
import type { BusName, SfxId } from '../types';
import * as C from './combat';
import type { Synth } from './kit';
import { SPECIAL_SFX } from './specials';
import * as U from './ui';
import * as W from './world';

export interface DuckSpec {
  bus: BusName;
  /** Attenuation in dB (positive number). */
  db: number;
  /** Seconds held before releasing. */
  hold: number;
}

export interface SfxDef {
  bus: BusName;
  /** Max length in seconds (offline buffer size / voice bookkeeping). */
  dur: number;
  /** Normalisation gain. */
  gain: number;
  variants: number;
  /** Random playback-rate jitter ± (fraction). */
  jitter: number;
  /** Uses x/y (false → always centred). */
  spatial: boolean;
  policy: Omit<SfxPolicy, 'dur'>;
  duck?: DuckSpec;
  recipe: (s: Synth) => void;
}

type P = Omit<SfxPolicy, 'dur'>;
const pol = (
  priority: number,
  maxVoices: number,
  minInterval: number,
  extra: Partial<P> = {},
): P => ({ priority, maxVoices, minInterval, aggregate: true, steal: true, ...extra });

const HIT = pol(4, 4, 0.07);
const GUN = pol(6, 4, 0.06);
const BOOM = pol(9, 3, 0.08);
const UI = pol(10, 4, 0.02, { aggregate: false });

function def(
  bus: BusName,
  dur: number,
  gain: number,
  variants: number,
  policy: P,
  recipe: (s: Synth) => void,
  extra: Partial<SfxDef> = {},
): SfxDef {
  return { bus, dur, gain, variants, jitter: 0.04, spatial: bus !== 'ui', policy, recipe, ...extra };
}

export const SFX: Readonly<Record<SfxId, SfxDef>> = {
  // melee & impacts
  baton: def('sfx', 0.3, 0.5, 3, HIT, C.baton),
  bat: def('sfx', 0.4, 0.5, 3, HIT, C.bat),
  shieldThud: def('sfx', 0.3, 0.5, 3, HIT, C.shieldThud),
  punch: def('sfx', 0.25, 0.45, 3, HIT, C.punch),
  metalHit: def('sfx', 0.6, 0.55, 3, pol(4, 3, 0.06), C.metalHit),
  rubberHit: def('sfx', 0.2, 0.5, 3, HIT, C.rubberHit),
  bulletHit: def('sfx', 0.15, 0.5, 3, HIT, C.bulletHit),
  ricochet: def('sfx', 0.45, 0.6, 3, pol(4, 2, 0.12), C.ricochet),
  crunch: def('sfx', 0.35, 1, 2, pol(5, 2, 0.08), C.crunch),
  bodyFall: def('sfx', 0.35, 0.45, 3, pol(3, 4, 0.05), C.bodyFall),
  koBoing: def('sfx', 0.65, 0.35, 3, pol(3, 2, 0.35, { boostCap: 1.3 }), C.koBoing, { jitter: 0.08 }),
  dizzy: def('sfx', 0.55, 0.9, 2, pol(2, 1, 0.6, { boostCap: 1 }), C.dizzy, { jitter: 0.06 }),
  // weapons
  rubberPop: def('sfx', 0.3, 0.45, 3, GUN, C.rubberPop),
  pistol: def('sfx', 0.6, 0.5, 3, GUN, C.pistol),
  rifle: def('sfx', 0.45, 0.45, 3, GUN, C.rifle),
  mgBurst: def('sfx', 0.85, 0.45, 1, GUN, C.mgBurst),
  sniper: def('sfx', 1.3, 0.55, 2, pol(7, 3, 0.06), C.sniper),
  tankCannon: def('sfx', 2.3, 0.7, 2, pol(8, 2, 0.1), C.tankCannon, {
    duck: { bus: 'ambience', db: 4, hold: 0.3 },
  }),
  bazooka: def('sfx', 1, 0.5, 2, pol(7, 3, 0.08), C.bazooka),
  canisterPop: def('sfx', 0.9, 0.55, 2, pol(5, 3, 0.06), C.canisterPop),
  gasSpray: def('sfx', 1.2, 0.45, 2, pol(4, 3, 0.2, { boostCap: 1.3 }), C.gasSpray),
  molotovThrow: def('sfx', 0.35, 1.4, 2, pol(5, 3, 0.06), C.molotovThrow),
  bolt: def('sfx', 0.25, 1, 2, pol(4, 2, 0.1), C.bolt),
  // explosions, fire, glass, damage
  explosionSmall: def('sfx', 1, 0.6, 2, BOOM, C.explosionSmall),
  explosionMedium: def('sfx', 1.8, 0.7, 2, BOOM, C.explosionMedium, {
    duck: { bus: 'ambience', db: 4, hold: 0.3 },
  }),
  explosionBig: def('sfx', 2.8, 0.75, 2, BOOM, C.explosionBig, {
    duck: { bus: 'ambience', db: 6, hold: 0.5 },
  }),
  prophetBoom: def('sfx', 2, 0.75, 2, BOOM, C.prophetBoom, {
    duck: { bus: 'ambience', db: 5, hold: 0.4 },
  }),
  glassSmash: def('sfx', 0.6, 0.45, 2, pol(5, 3, 0.06), C.glassSmash),
  glassBreak: def('sfx', 1.1, 0.5, 2, pol(5, 2, 0.1), C.glassBreak),
  fireWhoosh: def('sfx', 1.3, 0.6, 2, pol(5, 3, 0.08), C.fireWhoosh),
  capitolHit: def('sfx', 0.9, 0.5, 2, pol(5, 2, 0.25), C.capitolHit),
  metalWreck: def('sfx', 1.4, 0.55, 1, pol(7, 2, 0.15), C.metalWreck),
  // units & vehicles
  hooves: def('sfx', 1.5, 0.6, 2, pol(5, 2, 0.3), W.hooves),
  horseWhinny: def('sfx', 1.45, 0.35, 2, pol(5, 1, 0.6), W.horseWhinny, { jitter: 0.06 }),
  humveeRev: def('sfx', 1.45, 0.45, 1, pol(5, 2, 0.4), W.humveeRev),
  tankTracks: def('sfx', 1.65, 0.45, 1, pol(5, 2, 0.4), W.tankTracks),
  heliPass: def('sfx', 1.6, 0.6, 1, pol(5, 1, 0.6), W.heliPass),
  blockadeSlam: def('sfx', 0.8, 0.5, 1, pol(6, 2, 0.1), W.blockadeSlam),
  fallWhistle: def('sfx', 0.9, 0.55, 1, pol(6, 2, 0.2), W.fallWhistle, { jitter: 0.08 }),
  // world
  siren: def('sfx', 3.4, 0.35, 0, pol(6, 1, 2), W.siren),
  shutter: def('sfx', 0.25, 0.9, 3, pol(3, 3, 0.05), W.shutter),
  flashWhine: def('sfx', 0.85, 0.5, 2, pol(3, 2, 0.15), W.flashWhine),
  paparazzi: def('sfx', 1, 0.6, 0, pol(6, 1, 1), W.paparazzi),
  doorOpen: def('sfx', 0.55, 0.35, 3, pol(2, 3, 0.12, { boostCap: 1.2 }), W.doorOpen, { jitter: 0.06 }),
  whistle: def('sfx', 0.9, 0.5, 1, pol(5, 1, 1.5), W.whistle),
  alarmBell: def('sfx', 1.6, 0.7, 0, pol(7, 1, 2), W.alarmBell),
  crowdRoar: def('ambience', 2.2, 0.5, 0, pol(4, 2, 1.5), W.crowdRoar, { spatial: false }),
  crowdBoo: def('ambience', 2.2, 0.5, 0, pol(4, 1, 2), W.crowdBoo, { spatial: false }),
  clapChant: def('ambience', 2, 0.9, 0, pol(4, 1, 1), W.clapChant, { spatial: false }),
  // UI
  // M13b mix: UI feedback and the advisor's typing duck the crowd bed (ambience bus).
  click: def('ui', 0.08, 0.6, 1, UI, U.click, { duck: { bus: 'ambience', db: 3, hold: 0.15 } }),
  hover: def('ui', 0.04, 0.5, 1, pol(10, 2, 0.03, { aggregate: false }), U.hover),
  deploy: def('ui', 0.3, 0.5, 1, UI, U.deploy),
  error: def('ui', 0.35, 0.4, 1, pol(10, 1, 0.2, { aggregate: false }), U.error),
  stamp: def('ui', 0.35, 0.5, 1, UI, U.stamp, { duck: { bus: 'ambience', db: 4, hold: 0.3 } }),
  typeTick: def('ui', 0.05, 0.5, 3, pol(10, 3, 0.03, { boostCap: 1 }), U.typeTick, {
    jitter: 0.08,
    // Held while the Minister talks (a tick every ~50 ms re-arms it).
    duck: { bus: 'ambience', db: 7, hold: 0.5 },
  }),
  typeBell: def('ui', 1, 0.6, 1, UI, U.typeBell, { duck: { bus: 'ambience', db: 5, hold: 0.8 } }),
  levelUp: def('ui', 1.6, 0.55, 0, UI, U.levelUp, { jitter: 0, duck: { bus: 'music', db: 9, hold: 1.2 } }),
  waveAlarm: def('ui', 1.2, 0.65, 0, pol(10, 1, 1, { aggregate: false }), U.waveAlarm, {
    jitter: 0,
  }),
  hateChing: def('ui', 0.45, 0.9, 2, pol(10, 2, 0.22, { boostCap: 1 }), U.hateChing, { jitter: 0.02 }),
  legitStamp: def('ui', 0.8, 0.35, 1, pol(10, 2, 0.15, { boostCap: 1.2 }), U.legitStamp),
  abilityReady: def('ui', 0.5, 0.9, 1, pol(10, 1, 0.5), U.abilityReady, { jitter: 0 }),
  victoryStinger: def('ui', 2.3, 0.55, 0, UI, U.victoryStinger, {
    jitter: 0,
    duck: { bus: 'music', db: 12, hold: 2.2 },
  }),
  defeatStinger: def('ui', 2.6, 0.55, 0, UI, U.defeatStinger, {
    jitter: 0,
    duck: { bus: 'music', db: 12, hold: 2.4 },
  }),
  // special skills (playtest round 2)
  ...SPECIAL_SFX,
};

const UNKNOWN: SfxPolicy = { priority: 0, maxVoices: 1, minInterval: 0.1, aggregate: true, steal: false, dur: 0.5 };
const policyCache = new Map<string, SfxPolicy>();

export function policyOf(id: string): SfxPolicy {
  let p = policyCache.get(id);
  if (!p) {
    const d = (SFX as Record<string, SfxDef | undefined>)[id];
    p = d ? { ...d.policy, dur: d.dur } : UNKNOWN;
    policyCache.set(id, p);
  }
  return p;
}
