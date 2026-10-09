/**
 * Tutorial step machine (pure, unit-tested). The Pixi side (`tutorial.ts`) feeds it *facts*
 * from the game (the player panned, deployed, started the wave, an officer died, level 1…),
 * tells it when the advisor finished a step's lines, and reacts to its `show` / `leave` /
 * `finish` hooks. Nothing here blocks the game.
 *
 * Per step:
 * - `gate`: wait for a fact before showing (e.g. the first officer death);
 * - `calm`: also wait until no level-up dossier is on screen;
 * - `until`: advance when the fact holds (the player's action) — if it already holds when the
 *   step would show, the step is skipped (the player was ahead of the briefing);
 * - otherwise advance once the advisor finished the lines (and `minTime` passed);
 * - `timeout`: advance anyway after this many seconds (pan step: players who don't pan).
 */
import type { TutorialStepId } from '../text/tutorial';

export type TutorialFact =
  'panned' | 'deployed' | 'waveStarted' | 'officerDied' | 'level1' | 'sniperDeployed';

export type TutorialTarget =
  | { kind: 'none' }
  | { kind: 'pan' }
  | { kind: 'card'; unit: 'riot' | 'sniper' }
  | { kind: 'tile' }
  | { kind: 'hate' }
  | { kind: 'wave' }
  | { kind: 'seal' }
  | { kind: 'integrity' };

export interface StepDef {
  id: TutorialStepId;
  target: TutorialTarget;
  /** A second target highlighted together (deploy: card + suggested tile). */
  also?: TutorialTarget;
  gate?: TutorialFact;
  calm?: boolean;
  until?: TutorialFact;
  timeout?: number;
  /** Minimum seconds on screen. */
  minTime: number;
}

export const TUTORIAL_STEPS: readonly StepDef[] = [
  { id: 'welcome', target: { kind: 'none' }, minTime: 1 },
  { id: 'pan', target: { kind: 'pan' }, until: 'panned', timeout: 14, minTime: 1.2 },
  {
    id: 'deploy',
    target: { kind: 'card', unit: 'riot' },
    also: { kind: 'tile' },
    until: 'deployed',
    minTime: 0.5,
  },
  { id: 'hate', target: { kind: 'hate' }, minTime: 1.5 },
  { id: 'wave', target: { kind: 'wave' }, until: 'waveStarted', minTime: 0.5 },
  { id: 'legit', target: { kind: 'seal' }, gate: 'officerDied', calm: true, minTime: 1.5 },
  {
    id: 'sniper',
    target: { kind: 'card', unit: 'sniper' },
    gate: 'level1',
    calm: true,
    until: 'sniperDeployed',
    timeout: 25,
    minTime: 1,
  },
  { id: 'guard', target: { kind: 'none' }, minTime: 1.5 },
  { id: 'wrap', target: { kind: 'integrity' }, also: { kind: 'seal' }, minTime: 1.5 },
];

export type MachineState = 'idle' | 'waiting' | 'showing' | 'done' | 'skipped';

export interface MachineHooks {
  /** A step became visible: say its lines, show its pointer. */
  show(step: StepDef, index: number): void;
  /** The step is over (clear sticky lines, hide pointers). */
  leave(step: StepDef, index: number): void;
  /** Tutorial finished (skipped = the player pressed SKIP). */
  finish(skipped: boolean): void;
}

export class TutorialMachine {
  state: MachineState = 'idle';
  index = -1;
  /** Seconds the current step has been showing. */
  t = 0;
  readonly facts = new Set<TutorialFact>();
  private linesDone = false;

  constructor(
    private readonly hooks: MachineHooks,
    readonly steps: readonly StepDef[] = TUTORIAL_STEPS,
  ) {}

  get step(): StepDef | null {
    return this.steps[this.index] ?? null;
  }

  get active(): boolean {
    return this.state === 'waiting' || this.state === 'showing';
  }

  start(from = 0): void {
    if (this.active) return;
    this.index = Math.max(0, Math.min(from, this.steps.length)) - 1;
    this.next();
  }

  fact(f: TutorialFact): void {
    this.facts.add(f);
  }

  /** The advisor finished (or the player dismissed) the current step's lines. */
  linesFinished(): void {
    if (this.state === 'showing') this.linesDone = true;
  }

  skip(): void {
    if (!this.active) return;
    const s = this.step;
    if (this.state === 'showing' && s) this.hooks.leave(s, this.index);
    this.state = 'skipped';
    this.hooks.finish(true);
  }

  /**
   * Advance time. `calm` = no level-up dossier on screen. Call with dt = 0 while the game is
   * paused or a menu is open.
   */
  update(dt: number, calm = true): void {
    if (this.state === 'waiting') {
      const s = this.step!;
      if (s.gate && !this.facts.has(s.gate)) return;
      if (s.calm && !calm) return;
      if (s.until && this.facts.has(s.until)) {
        // The player was ahead of the briefing.
        this.next();
        return;
      }
      this.state = 'showing';
      this.t = 0;
      this.linesDone = false;
      this.hooks.show(s, this.index);
      return;
    }
    if (this.state !== 'showing') return;
    const s = this.step!;
    this.t += dt;
    if (this.t < s.minTime) return;
    const acted = s.until ? this.facts.has(s.until) : this.linesDone;
    const timedOut = s.timeout !== undefined && this.t >= s.timeout && this.linesDone;
    if (acted || timedOut) {
      this.hooks.leave(s, this.index);
      this.next();
    }
  }

  private next(): void {
    this.index++;
    if (this.index >= this.steps.length) {
      this.state = 'done';
      this.hooks.finish(false);
      return;
    }
    this.state = 'waiting';
  }
}
