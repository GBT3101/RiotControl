/**
 * The game's typed event bus: every simulation event (re-exported from sim/events.ts, see
 * docs/M6.md) plus view/controller events. UI (M9) and audio (M11) subscribe here:
 *
 *   controller.bus.on('died', (e) => …);            // sim event
 *   controller.bus.on('hatePickupArrived', (e) => …); // view event: a +Hate fist reached the HUD
 */
import type { AbilityId, UnitId } from '../data/units';
import type { DeployFail, SimEventMap } from '../sim';
import type { StatsLedger } from '../sim/stats';

export interface ViewEventMap {
  /** A floating Hate fist reached `hateTarget` (UI: bump the counter now). */
  hatePickupArrived: { amount: number };
  /** Deploy mode entered/left (unit = null). */
  deployModeChanged: { unit: UnitId | null };
  /** A deployment click was rejected. */
  deployFailed: { unit: UnitId; reason: DeployFail | null; i: number; j: number };
  /** Selected commandable/ability unit (null = none). */
  selectionChanged: { unitId: number | null; unit: UnitId | null };
  /** The tank's aim mode / the helicopter's paint mode began or ended (all null). */
  skillModeChanged: {
    unitId: number | null;
    skill: AbilityId | null;
    mode: 'aim' | 'paint' | null;
  };
  pauseChanged: { paused: boolean };
  speedChanged: { speed: number };
  /** Time of day changed noticeably (≈ every 1/100 of a day). */
  timeOfDay: { tod: number; hour: number; darkness: number };
  /** Victory / defeat (after the sim's `victory`/`defeat`). */
  gameOver: { victory: boolean; stats: StatsLedger };
  /** Assets loaded and the first frame is on screen. */
  ready: { city: string; bootMs: number };
  /** All deferred art loaded (far ground, all protester looks, vehicles, UI kit, Capitol states). */
  artComplete: { ms: number };
}

export type GameEventMap = SimEventMap & ViewEventMap;
export type GameEventType = keyof GameEventMap;
