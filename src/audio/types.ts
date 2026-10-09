/**
 * Public types of the procedural audio module (M11).
 *
 * The module is pure WebAudio (no audio files, no deps) and imports nothing from the game or
 * view layers — only *types* from `sim/`, `data/` and `maps/` so the event mapping stays in sync
 * with the simulation at compile time.
 */
import type { CityId } from '../maps/contract';

/** Every one-shot sound the engine can synthesise. */
export const SFX_IDS = [
  // melee & impacts
  'baton',
  'bat',
  'shieldThud',
  'punch',
  'metalHit',
  'rubberHit',
  'bulletHit',
  'ricochet',
  'crunch',
  'bodyFall',
  'koBoing',
  'dizzy',
  // weapons
  'rubberPop',
  'pistol',
  'rifle',
  'mgBurst',
  'sniper',
  'tankCannon',
  'bazooka',
  'canisterPop',
  'gasSpray',
  'molotovThrow',
  'bolt',
  // explosions, fire, glass, damage
  'explosionSmall',
  'explosionMedium',
  'explosionBig',
  'prophetBoom',
  'glassSmash',
  'glassBreak',
  'fireWhoosh',
  'capitolHit',
  'metalWreck',
  // units & vehicles
  'hooves',
  'horseWhinny',
  'humveeRev',
  'tankTracks',
  'heliPass',
  'blockadeSlam',
  'fallWhistle',
  // world
  'siren',
  'shutter',
  'flashWhine',
  'paparazzi',
  'doorOpen',
  'whistle',
  'alarmBell',
  'crowdRoar',
  'crowdBoo',
  'clapChant',
  // UI
  'click',
  'hover',
  'deploy',
  'error',
  'stamp',
  'typeTick',
  'typeBell',
  'levelUp',
  'waveAlarm',
  'hateChing',
  'legitStamp',
  'abilityReady',
  'victoryStinger',
  'defeatStinger',
] as const;
export type SfxId = (typeof SFX_IDS)[number];

/** Sustained sounds kept alive by repeated `loop()` calls (keep-alive emitters). */
export const LOOP_IDS = [
  'mgLoop',
  'doorGunLoop',
  'fireLoop',
  'gasLoop',
  'heliLoop',
  'humveeLoop',
  'tankLoop',
] as const;
export type LoopId = (typeof LOOP_IDS)[number];

export const BUSES = ['music', 'sfx', 'ui', 'ambience'] as const;
export type BusName = (typeof BUSES)[number];
export type VolumeChannel = BusName | 'master';

export type MusicPhase = 'menu' | 'prep' | 'wave' | 'breather' | 'victory' | 'defeat';

export interface MusicState {
  phase: MusicPhase;
  /** Player level 0…10. */
  level: number;
  /** Alive protesters (drives intensity together with the level). */
  crowd: number;
  night: boolean;
}

export type AudioCity = CityId;

/** World-pixel position (see `core/iso`: world = unscaled map pixels). */
export interface WorldPos {
  x: number;
  y: number;
}

export interface PlayOptions {
  /** World-pixel position; omit x/y for a non-positional (centred, unattenuated) sound. */
  x?: number;
  y?: number;
  /** Linear gain multiplier (default 1). */
  volume?: number;
  /** Playback-rate multiplier (default 1; small random jitter is always added). */
  pitch?: number;
  /** Seconds from now (default 0). */
  delay?: number;
}

export interface LoopOptions {
  x?: number;
  y?: number;
  volume?: number;
  /** Playback-rate multiplier (engine revs, door-gun cadence). */
  rate?: number;
  /** Seconds the loop survives without another `loop()` call (default 0.25). */
  ttl?: number;
}

export interface CrowdInfo {
  /** Alive protesters (0 silences the bed). */
  size: number;
  /** 0…1. Omit to let the engine derive it from recent combat activity. */
  anger?: number;
  /** 0…1 share of the crowd near the camera (louder, brighter bed). Default 0.5. */
  near?: number;
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  ambience: number;
  muted: boolean;
}

export interface AudioStats {
  unlocked: boolean;
  state: string;
  voices: number;
  loops: number;
  /** Totals since creation. */
  requested: number;
  triggered: number;
  merged: number;
  dropped: number;
  culled: number;
  baked: number;
  bakeQueue: number;
  music: { theme: string; bar: number; tempo: number; layer: number } | null;
}
