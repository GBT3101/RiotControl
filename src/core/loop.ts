/**
 * Fixed-step simulation loop with interpolated rendering.
 *
 * The simulation always advances in fixed `stepMs` increments (30 Hz by default). Real time is
 * multiplied by `timeScale` (1×/2×/3×) and accumulated; rendering receives `alpha` in [0, 1) —
 * how far we are between the previous and the current sim state — for interpolation.
 *
 * `advance(dtMs)` is pure bookkeeping (no timers), so it is fully testable in Node. `start()`
 * drives it from requestAnimationFrame in the browser.
 */
export interface LoopCallbacks {
  /** Advance the simulation by exactly one fixed step. `tick` counts steps since creation. */
  update(stepSeconds: number, tick: number): void;
  /** Draw. `alpha` = interpolation factor, `frameDtMs` = real (unscaled) frame time. */
  render(alpha: number, frameDtMs: number): void;
}

export interface LoopOptions {
  /** Simulation rate in Hz (default 30). */
  hz?: number;
  /** Max sim steps per advance() — prevents the spiral of death after a stall (default 8). */
  maxStepsPerFrame?: number;
  /** Clamp of a single real frame delta in ms (tab switches etc., default 250). */
  maxFrameMs?: number;
}

const EPS = 1e-6;

export const TIME_SCALES = [1, 2, 3] as const;
export type TimeScale = (typeof TIME_SCALES)[number];

export class FixedStepLoop {
  readonly stepMs: number;
  readonly stepSeconds: number;
  readonly maxStepsPerFrame: number;
  readonly maxFrameMs: number;

  timeScale: number = 1;
  paused = false;
  /** Number of sim steps executed so far. */
  tick = 0;
  /** Interpolation factor of the last advance(). */
  alpha = 0;

  private accumulator = 0;
  private rafId = 0;
  private lastNow = -1;

  constructor(
    private readonly callbacks: LoopCallbacks,
    options: LoopOptions = {},
  ) {
    const hz = options.hz ?? 30;
    this.stepMs = 1000 / hz;
    this.stepSeconds = 1 / hz;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 8;
    this.maxFrameMs = options.maxFrameMs ?? 250;
  }

  /**
   * Feed a real-time frame delta. Runs 0..n sim steps then renders once.
   * Returns the number of sim steps executed.
   */
  advance(frameDtMs: number): number {
    const dt = Math.min(Math.max(frameDtMs, 0), this.maxFrameMs);
    let steps = 0;
    if (!this.paused) {
      this.accumulator += dt * this.timeScale;
      // Allow more steps at higher time scales so 3× really is 3×.
      const maxSteps = this.maxStepsPerFrame * Math.max(1, Math.ceil(this.timeScale));
      // Small epsilon: 1000/30 is not exact in binary floating point.
      while (this.accumulator + EPS >= this.stepMs && steps < maxSteps) {
        this.callbacks.update(this.stepSeconds, this.tick);
        this.tick++;
        this.accumulator = Math.max(0, this.accumulator - this.stepMs);
        steps++;
      }
      // Still behind after the cap: drop the backlog instead of spiralling.
      if (this.accumulator + EPS >= this.stepMs) this.accumulator %= this.stepMs;
    }
    this.alpha = this.accumulator / this.stepMs;
    this.callbacks.render(this.alpha, dt);
    return steps;
  }

  /** Run one sim step immediately (debug "step" while paused). */
  stepOnce(): void {
    this.callbacks.update(this.stepSeconds, this.tick);
    this.tick++;
  }

  /** Simulated seconds elapsed. */
  get simTime(): number {
    return this.tick * this.stepSeconds;
  }

  start(): void {
    if (this.rafId) return;
    const frame = (now: number): void => {
      const dt = this.lastNow < 0 ? 0 : now - this.lastNow;
      this.lastNow = now;
      this.advance(dt);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.lastNow = -1;
  }

  get running(): boolean {
    return this.rafId !== 0;
  }
}

/** Linear interpolation helper for render-side smoothing of sim positions. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
