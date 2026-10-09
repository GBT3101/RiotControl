/**
 * URL query parameters (dev & debug aids). See docs/M8.md.
 *
 *   ?city=madrid|london|paris   city to play (default madrid)
 *   ?seed=N                     run seed (sim + protester looks; default 1)
 *   ?mapSeed=N                  map variation seed (default 0 = canonical)
 *   ?autoplay=1                 a bot plays (deploys, starts waves, throws gas)
 *   ?t=SECONDS                  fast-forward the sim before the first frame (with autoplay → mid-battle)
 *   ?stress=N                   spawn N protesters around the map at start (perf profiling)
 *   ?level=N&hate=N             debug economy (unlock everything for screenshots)
 *   ?wave=N                     first wave is wave N (bigger hordes right away)
 *   ?tod=0..1                   force time of day (0.1 day, .4 golden, .55 dusk, .7 night, .95 dawn)
 *   ?quality=low|mobile|desktop override the auto quality tier
 *   ?zoom=N&u=I&v=J             camera zoom / centre (tiles);  ?focus=crowd centres on the biggest crowd
 *   ?debug                      debug overlay on;  ?hud=0 hide the debug HUD
 *   ?demo=1                     the M1 test-map demo scene
 *   ?nocache                    ignore the IndexedDB art cache;  ?mute  no audio
 *   ?scene=showcase             debug scenario: every unit + every protester type near the camera
 */
import type { QualityTier } from '../data/balance';
import { CITIES, type CityId } from '../maps/contract';

export interface GameParams {
  city: CityId;
  seed: number;
  mapSeed: number;
  autoplay: boolean;
  skip: number;
  stress: number;
  level?: number;
  wave?: number;
  hate?: number;
  tod?: number;
  quality?: QualityTier;
  zoom?: number;
  focus?: string;
  camU?: number;
  camV?: number;
  debug: boolean;
  hud: boolean;
  demo: boolean;
  /** Freeze animated time (shots). */
  freeze: boolean;
  nocache: boolean;
  mute: boolean;
  scene?: string;
}

export function readParams(search: string): GameParams {
  const q = new URLSearchParams(search);
  const num = (k: string): number | undefined => {
    const v = q.get(k);
    if (v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const city = q.get('city') as CityId | null;
  const quality = q.get('quality') as QualityTier | null;
  return {
    city: city && CITIES.includes(city) ? city : 'madrid',
    seed: num('seed') ?? 1,
    mapSeed: num('mapSeed') ?? 0,
    autoplay: q.get('autoplay') === '1' || q.get('autoplay') === 'true',
    skip: Math.max(0, Math.min(1800, num('t') ?? 0)),
    stress: Math.max(0, Math.min(4000, num('stress') ?? 0)),
    level: num('level'),
    wave: num('wave'),
    hate: num('hate'),
    tod: num('tod'),
    quality: quality && ['low', 'mobile', 'desktop'].includes(quality) ? quality : undefined,
    zoom: num('zoom'),
    focus: q.get('focus') ?? undefined,
    camU: num('u'),
    camV: num('v'),
    debug: q.has('debug'),
    hud: q.get('hud') !== '0',
    demo: q.get('demo') === '1',
    freeze: q.has('freeze'),
    nocache: q.has('nocache'),
    mute: q.has('mute'),
    scene: q.get('scene') ?? undefined,
  };
}
