/**
 * Day → golden hour → dusk → night → dawn, tied to the waves (PLAN §3.7).
 *
 * Time of day `tod` ∈ [0, 1): 0.00–0.30 day, 0.30–0.45 golden hour, 0.45–0.55 dusk,
 * 0.55–0.85 night, 0.85–1.00 dawn. The prep phase is mid-morning; each wave advances the clock
 * by a quarter cycle (wave 1 ends in golden hour, wave 2 at night, wave 3 night → dawn, …),
 * eased so the light never jumps.
 *
 * The grade is a multiply tint (keeps pixels crisp — no blur, no dithering); lights (lamps,
 * windows, fires) fade in with `darkness`. Pure maths, unit-tested.
 */

export interface Grade {
  /** Multiply tint 0xRRGGBB for graded layers. */
  tint: number;
  /** 0 (day) … 1 (deep night): alpha of additive lights / visibility of lit windows. */
  darkness: number;
  /** Clock hour (0–24) for Big Ben & co. */
  hour: number;
}

type RGB = readonly [number, number, number];

/** Key frames (tod, tint, darkness). */
const KEYS: ReadonlyArray<readonly [number, RGB, number]> = [
  [0.0, [255, 255, 255], 0],
  [0.27, [255, 255, 255], 0],
  [0.38, [255, 222, 176], 0.08],
  [0.47, [214, 160, 176], 0.4],
  [0.55, [130, 120, 186], 0.82],
  [0.62, [98, 104, 168], 1],
  [0.8, [98, 104, 168], 1],
  [0.88, [176, 150, 196], 0.55],
  [0.95, [236, 214, 214], 0.15],
  [1.0, [255, 255, 255], 0],
];

export function gradeAt(tod: number): Grade {
  const t = ((tod % 1) + 1) % 1;
  let k = 0;
  while (k < KEYS.length - 2 && KEYS[k + 1]![0] <= t) k++;
  const [t0, c0, d0] = KEYS[k]!;
  const [t1, c1, d1] = KEYS[k + 1]!;
  const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const s = f * f * (3 - 2 * f);
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * s);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * s);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * s);
  // tod 0 = 07:00, one cycle = 24 h.
  const hour = (7 + t * 24) % 24;
  return { tint: (r << 16) | (g << 8) | b, darkness: d0 + (d1 - d0) * s, hour };
}

/** Prep-phase time of day (mid-morning). */
export const PREP_TOD = 0.08;
/** Fraction of a day cycle per wave. */
export const TOD_PER_WAVE = 0.25;

/**
 * Target time of day for the director's state: the clock runs toward the end of the current
 * wave's quarter; `waveFrac` (0..1) is how far the wave (spawning + fighting + breather) is.
 */
export function targetTod(wave: number, waveFrac: number): number {
  if (wave <= 0) return PREP_TOD;
  return PREP_TOD + (wave - 1 + Math.min(1, Math.max(0, waveFrac))) * TOD_PER_WAVE;
}

/** Ease the displayed clock toward the target (monotonic, never backwards). */
export function stepTod(current: number, target: number, dt: number, rate = 0.012): number {
  if (target <= current) return current;
  return Math.min(
    target,
    current + Math.max(rate * dt, (target - current) * Math.min(1, dt * 0.5)),
  );
}

/** Multiply two 0xRRGGBB colours. */
export function mulColor(a: number, b: number): number {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255;
  const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255;
  const bl = ((a & 255) * (b & 255)) / 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Linear mix of two 0xRRGGBB colours. */
export function mixColor(a: number, b: number, t: number): number {
  const m = (x: number, y: number): number => Math.round(x + (y - x) * t);
  return (
    (m((a >> 16) & 255, (b >> 16) & 255) << 16) |
    (m((a >> 8) & 255, (b >> 8) & 255) << 8) |
    m(a & 255, b & 255)
  );
}
