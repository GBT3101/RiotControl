/** Easing and tiny tween helpers (UI animations are driven by per-frame `update(dt)`). */
export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outBounce: (t: number) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Progress 0..1 of an animation that started at `t0` and lasts `dur` (s). */
export function prog(now: number, t0: number, dur: number): number {
  return dur <= 0 ? 1 : clamp01((now - t0) / dur);
}

/** Rubber-stamp drop: 6 → 0 px over 3 steps with a 1-step hold (M5 §7). Returns y offset. */
export function stampDrop(t: number): number {
  if (t <= 0) return -8;
  if (t < 0.25) return -6;
  if (t < 0.5) return -3;
  return 0;
}
