/**
 * Pure HUD model helpers (unit-tested): card states, the Hate counter that only counts up when
 * the floating fists arrive, Legitimacy progress, wave status text.
 */
import type { CardState } from '../art/uikit/cards';
import { LEVELS, WIN_LEGITIMACY } from '../data/levels';
import type { DirectorPhase } from '../sim/director';

export interface CardInput {
  unlocked: boolean;
  affordable: boolean;
  level: number;
  cost: number;
}

/** Deploy card state: locked → selected → unaffordable → ready. */
export function cardState(o: CardInput, selected: boolean): CardState {
  if (!o.unlocked) return 'locked';
  if (selected) return 'selected';
  if (!o.affordable) return 'unaffordable';
  return 'ready';
}

/**
 * The HUD Hate counter. The sim's Hate rises the moment something dies; the counter only rises
 * when the "+N" fist reaches it (`arrive`). Spending is immediate. The shown value never exceeds
 * the sim value and catches up if it lags for too long (a fist lost off-screen, debug jumps).
 */
export class HateCounter {
  /** Value the counter is heading to. */
  target: number;
  /** Value currently displayed (rolls toward target). */
  shown: number;
  /** Seconds the target has been below the sim value. */
  private lag = 0;
  /** Bump animation (s remaining). */
  bump = 0;

  constructor(initial: number) {
    this.target = initial;
    this.shown = initial;
  }

  arrive(amount: number): void {
    this.target += amount;
    this.bump = 0.25;
  }

  spend(amount: number): void {
    this.target -= amount;
    this.shown = Math.min(this.shown, this.target);
  }

  /** Per frame: `sim` = the simulation's Hate. */
  update(dt: number, sim: number): void {
    if (this.target > sim) this.target = sim;
    if (this.target < sim) {
      this.lag += dt;
      if (this.lag > 2.5) {
        this.target = sim;
        this.lag = 0;
      }
    } else this.lag = 0;
    const d = this.target - this.shown;
    if (d > 0) {
      // Roll up: fast for big jumps, at least 1 per frame.
      this.shown = Math.min(
        this.target,
        this.shown + Math.max(1, Math.ceil(d * Math.min(1, dt * 12))),
      );
    } else if (d < 0) this.shown = this.target;
    this.bump = Math.max(0, this.bump - dt);
  }

  get display(): number {
    return Math.max(0, Math.floor(this.shown));
  }
}

/** Progress (0..1) from the current level's threshold to the next (or to victory). */
export function levelProgress(legit: number, level: number): number {
  const lo = LEVELS[level]?.legit ?? 0;
  const hi = LEVELS[level + 1]?.legit ?? WIN_LEGITIMACY;
  if (hi <= lo) return 1;
  return Math.max(0, Math.min(1, (legit - lo) / (hi - lo)));
}

/** Short wave status for the top bar. */
export function waveStatus(phase: DirectorPhase, wave: number, breather: number): string {
  if (phase === 'prep') return 'PREP';
  if (phase === 'breather') return `NEXT ${Math.ceil(breather)}s`;
  return `WAVE ${wave}`;
}

/** Bonus Hate for calling the next wave early (mirrors director.callNextWaveEarly). */
export function callEarlyBonus(breather: number, factor: number): number {
  return Math.max(0, Math.floor(breather * factor));
}

/** "12.3k" style compact number for narrow counters. */
export function compactNumber(n: number): string {
  const v = Math.floor(n);
  if (v < 10000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 100000 ? 1 : 0)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}
