/**
 * Frame-time governor (M13b): a dynamic quality fallback for devices that cannot hold the
 * frame rate. It watches an exponential moving average of real frame times; when the average
 * stays above `badMs` for `badFor` seconds it steps the view down one level (see
 * `WorldView.setDegrade`), and when it stays below `goodMs` for `goodFor` seconds it steps
 * back up. The slow recovery keeps it from oscillating. Pure (unit-tested).
 *
 * Pixel-perfect rendering rules out resolution scaling (zoom is always an integer number of
 * device pixels), so the fallback trades animation rate, FX, bodies and x-ray ghosts instead.
 */
export interface GovernorOptions {
  badMs: number;
  goodMs: number;
  badFor: number;
  goodFor: number;
  maxLevel: number;
}

export const GOVERNOR_DEFAULTS: Readonly<GovernorOptions> = {
  badMs: 42, // < 24 fps
  goodMs: 22, // > 45 fps
  badFor: 4,
  goodFor: 30,
  maxLevel: 2,
};

export class FrameGovernor {
  level = 0;
  private ema = 16.7;
  private badT = 0;
  private goodT = 0;
  private readonly o: GovernorOptions;

  constructor(opts: Partial<GovernorOptions> = {}) {
    this.o = { ...GOVERNOR_DEFAULTS, ...opts };
  }

  /** Average frame time (ms). */
  get average(): number {
    return this.ema;
  }

  /** Feed one real frame time (ms). Returns the new level when it changed, else null. */
  sample(dtMs: number): number | null {
    // Ignore stalls (tab switches, loading hitches): they say nothing about steady load.
    if (!(dtMs > 0) || dtMs > 250) return null;
    const o = this.o;
    this.ema += (dtMs - this.ema) * 0.08;
    const dt = dtMs / 1000;
    if (this.ema > o.badMs) {
      this.goodT = 0;
      this.badT += dt;
      if (this.badT >= o.badFor && this.level < o.maxLevel) {
        this.level++;
        this.badT = 0;
        return this.level;
      }
    } else if (this.ema < o.goodMs) {
      this.badT = 0;
      this.goodT += dt;
      if (this.goodT >= o.goodFor && this.level > 0) {
        this.level--;
        this.goodT = 0;
        return this.level;
      }
    } else {
      this.badT = Math.max(0, this.badT - dt);
      this.goodT = 0;
    }
    return null;
  }
}

/**
 * Is the governor on? `?governor=1|0` forces it; otherwise on, except under automation
 * (`navigator.webdriver`: headless screenshot/soak runs render slowly on purpose).
 */
export function governorEnabled(param: boolean | undefined): boolean {
  if (param !== undefined) return param;
  if (typeof navigator === 'undefined') return false;
  return !(navigator as Navigator & { webdriver?: boolean }).webdriver;
}
