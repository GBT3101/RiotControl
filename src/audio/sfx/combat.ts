/**
 * Combat one-shots: melee impacts, guns, explosions, fire & glass.
 *
 * Design notes (we cannot listen, so the recipes follow well-known layer structures):
 * - impacts = low pitched thump (sine with a fast downward glide) + filtered noise body +
 *   a short bright transient, glued with mild tanh saturation;
 * - guns = high-passed noise crack (≤ 35 ms) + band-passed noise body + sub thump, driven
 *   hard, plus an *undriven* low-passed tail/slap for room;
 * - explosions = low-passed brown noise blast + sub sine plunge + crack + scattered debris
 *   clicks + long rumble/echo tails.
 */
import { burst, bus, partials, perc, scatter, tone, type Synth } from './kit';

// ── Melee & impacts ──────────────────────────────────────────────────────────────────────

export function baton(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 1.6);
  tone(s, { t, f0: 150 * s.v(0.08), f1: 68, drop: 0.07, peak: 0.8, decay: 0.16, dest: mix });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 700, q: 0.8, peak: 0.9, attack: 0.002, decay: 0.1, dest: mix });
  burst(s, { t, type: 'bandpass', f: 2200 * s.v(0.15), q: 1.1, peak: 0.55, decay: 0.035, dest: mix });
  tone(s, { t, f0: 520 * s.v(0.1), f1: 380, drop: 0.04, peak: 0.22, decay: 0.05, type: 'triangle', dest: mix });
}

/** Mounted police bat: a short swish, then a heavier whack. */
export function bat(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'bandpass', f: 500, f1: 1900, sweep: 0.07, q: 2, peak: 0.28, attack: 0.05, decay: 0.03 });
  const ti = t + 0.06;
  const mix = bus(s, 1, 1.8);
  tone(s, { t: ti, f0: 120 * s.v(0.08), f1: 52, drop: 0.09, peak: 0.9, decay: 0.22, dest: mix });
  burst(s, { t: ti, kind: 'brown', type: 'lowpass', f: 600, peak: 1, attack: 0.002, decay: 0.14, dest: mix });
  burst(s, { t: ti, type: 'bandpass', f: 1800 * s.v(0.1), q: 1, peak: 0.6, decay: 0.04, dest: mix });
  tone(s, { t: ti, f0: 380, f1: 260, drop: 0.05, peak: 0.25, decay: 0.07, type: 'triangle', dest: mix });
}

/** A blow landing on a polycarbonate riot shield: hollow thud + plastic bonk. */
export function shieldThud(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 1.3);
  tone(s, { t, f0: 105 * s.v(0.08), f1: 78, drop: 0.1, peak: 0.8, decay: 0.2, dest: mix });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 500, peak: 0.6, attack: 0.002, decay: 0.1, dest: mix });
  const f = 690 * s.v(0.08);
  partials(s, t, f, [1, 1.9, 2.95], [0.16, 0.1, 0.05], [0.11, 0.08, 0.05], mix);
  burst(s, { t, type: 'highpass', f: 3500, q: 0.7, peak: 0.3, decay: 0.012, dest: mix });
}

export function punch(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2);
  tone(s, { t, f0: 95 * s.v(0.1), f1: 48, drop: 0.08, peak: 0.9, decay: 0.14, dest: mix });
  burst(s, { t, type: 'bandpass', f: 900 * s.v(0.15), q: 0.8, peak: 0.7, decay: 0.06, dest: mix });
  burst(s, { t, type: 'highpass', f: 2500, peak: 0.35, decay: 0.02, dest: mix });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 400, peak: 0.6, attack: 0.002, decay: 0.08, dest: mix });
}

/** Stick/bottle on a blockade or vehicle: inharmonic clang. */
export function metalHit(s: Synth): void {
  const t = s.t;
  const f = 430 * s.v(0.2);
  partials(s, t, f, [1, 2.32, 3.87, 5.21, 6.9], [0.22, 0.16, 0.1, 0.07, 0.04], [0.5, 0.35, 0.25, 0.18, 0.12]);
  burst(s, { t, type: 'highpass', f: 3000, peak: 0.45, decay: 0.03 });
  tone(s, { t, f0: 140, f1: 90, drop: 0.08, peak: 0.45, decay: 0.1 });
}

/** Rubber round landing: rubbery "bloop-thwack". */
export function rubberHit(s: Synth): void {
  const t = s.t;
  tone(s, { t, f0: 320 * s.v(0.1), f1: 110, drop: 0.05, peak: 0.6, decay: 0.09 });
  burst(s, { t, type: 'bandpass', f: 1500, q: 1, peak: 0.45, decay: 0.03 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 500, peak: 0.5, attack: 0.002, decay: 0.06 });
}

export function bulletHit(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'highpass', f: 1800, peak: 0.55, decay: 0.025 });
  tone(s, { t, f0: 200 * s.v(0.1), f1: 90, drop: 0.05, peak: 0.5, decay: 0.06 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 600, peak: 0.5, attack: 0.002, decay: 0.07 });
}

export function ricochet(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'highpass', f: 2500, peak: 0.5, decay: 0.02 });
  const f = 3200 * s.v(0.12);
  tone(s, { t: t + 0.005, f0: f, f1: f * 0.47, drop: 0.3, peak: 0.16, attack: 0.003, decay: 0.32 });
  tone(s, { t: t + 0.012, f0: f * 0.8, f1: f * 0.6, drop: 0.2, peak: 0.07, decay: 0.24, type: 'triangle' });
}

/** Run over by a tank: cartoon squelch with a crunchy edge. */
export function crunch(s: Synth): void {
  const t = s.t;
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 300, peak: 0.9, attack: 0.003, decay: 0.15 });
  burst(s, { t, type: 'bandpass', f: 300, f1: 1100, sweep: 0.12, q: 4, peak: 1.4, attack: 0.01, decay: 0.15 });
  scatter(s, t, 0.12, 6, (ti) =>
    burst(s, { t: ti, type: 'bandpass', f: s.r(1800, 3500), q: 2, peak: s.r(0.15, 0.3), decay: 0.01 }),
  );
}

export function bodyFall(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 1.2);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 280 * s.v(0.1), q: 0.9, peak: 1, attack: 0.004, decay: 0.14, dest: mix });
  tone(s, { t, f0: 85 * s.v(0.1), f1: 52, drop: 0.1, peak: 0.7, decay: 0.14, dest: mix });
  burst(s, { t, type: 'bandpass', f: 1400, q: 0.7, peak: 0.12, decay: 0.06, dest: mix });
  const t2 = t + 0.085 * s.v(0.25);
  burst(s, { t: t2, kind: 'brown', type: 'lowpass', f: 350, peak: 0.45, attack: 0.003, decay: 0.09, dest: mix });
  tone(s, { t: t2, f0: 95, f1: 60, drop: 0.06, peak: 0.3, decay: 0.08, dest: mix });
}

/** Cartoon spring "boing" for a non-lethal KO. */
export function koBoing(s: Synth): void {
  const t = s.t;
  const d = 0.6;
  const o = s.osc('triangle', 180, t, d);
  o.frequency.setValueAtTime(s.hz(180), t);
  o.frequency.exponentialRampToValueAtTime(s.hz(340 * s.v(0.08)), t + 0.05);
  o.frequency.exponentialRampToValueAtTime(s.hz(265), t + 0.5);
  const lfo = s.osc('sine', 17 * s.v(0.1), t, d);
  const depth = s.gain();
  depth.gain.setValueAtTime(110 * s.p, t);
  depth.gain.exponentialRampToValueAtTime(4, t + 0.55);
  lfo.connect(depth).connect(o.frequency);
  const f = s.filter('lowpass', 1900, 1);
  const g = s.gain();
  perc(g.gain, t, 0.5, 0.004, 0.55);
  o.connect(f).connect(g).connect(s.out);
  const sub = s.osc('sine', 90, t, 0.2);
  const sg = s.gain();
  perc(sg.gain, t, 0.35, 0.003, 0.15);
  sub.connect(sg).connect(s.out);
}

/** Dizzy birds tweeting around a KO'd head. */
export function dizzy(s: Synth): void {
  const t = s.t;
  const base = 2600 * s.v(0.08);
  for (let i = 0; i < 4; i++) {
    const ti = t + i * 0.11 + s.r(0, 0.02);
    const f = base * (i % 2 ? 1.12 : 1);
    const o = s.osc('sine', f, ti, 0.1);
    o.frequency.setValueAtTime(s.hz(f), ti);
    o.frequency.exponentialRampToValueAtTime(s.hz(f * 1.45), ti + 0.045);
    o.frequency.exponentialRampToValueAtTime(s.hz(f * 1.2), ti + 0.08);
    const g = s.gain();
    perc(g.gain, ti, 0.14, 0.006, 0.075);
    o.connect(g).connect(s.out);
  }
}

// ── Guns ─────────────────────────────────────────────────────────────────────────────────

export function rubberPop(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 1.5);
  burst(s, { t, type: 'bandpass', f: 1100 * s.v(0.1), q: 0.9, peak: 0.9, decay: 0.05, dest: mix });
  tone(s, { t, f0: 190 * s.v(0.08), f1: 85, drop: 0.06, peak: 0.7, decay: 0.09, dest: mix });
  tone(s, { t, f0: 950, f1: 700, drop: 0.03, peak: 0.2, decay: 0.03, type: 'triangle', dest: mix });
  burst(s, { t, type: 'highpass', f: 3000, peak: 0.35, decay: 0.015, dest: mix });
  burst(s, { t, kind: 'pink', type: 'lowpass', f: 900, peak: 0.25, attack: 0.005, decay: 0.2 });
}

function gunTail(s: Synth, t: number, lp: number, peak: number, decay: number): void {
  burst(s, { t, kind: 'pink', type: 'lowpass', f: lp, peak, attack: 0.006, decay });
}

export function pistol(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2.5);
  burst(s, { t, type: 'highpass', f: 1500, q: 0.7, peak: 1, decay: 0.035, dest: mix });
  burst(s, { t, type: 'bandpass', f: 650 * s.v(0.08), q: 0.7, peak: 1, decay: 0.12, dest: mix });
  tone(s, { t, f0: 150 * s.v(0.06), f1: 55, drop: 0.06, peak: 0.8, decay: 0.1, dest: mix });
  gunTail(s, t, 1600, 0.3, 0.4);
  burst(s, { t: t + 0.09, kind: 'pink', type: 'bandpass', f: 900, q: 0.6, peak: 0.14, attack: 0.01, decay: 0.25 });
}

export function rifle(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 3);
  burst(s, { t, type: 'highpass', f: 2200, peak: 1, decay: 0.028, dest: mix });
  burst(s, { t, type: 'bandpass', f: 950 * s.v(0.08), q: 0.8, peak: 0.9, decay: 0.08, dest: mix });
  tone(s, { t, f0: 125 * s.v(0.06), f1: 50, drop: 0.05, peak: 0.75, decay: 0.08, dest: mix });
  gunTail(s, t, 2000, 0.25, 0.3);
}

/** One heavy MG round (shared by the MG loop and the audition burst). */
export function mgRound(s: Synth, t: number, light = false): void {
  const mix = bus(s, light ? 0.8 : 1, 2.6);
  burst(s, { t, type: 'highpass', f: light ? 2100 : 1700, peak: 0.9, decay: 0.022, dest: mix });
  burst(s, { t, type: 'bandpass', f: (light ? 760 : 520) * s.v(0.06), q: 0.8, peak: 1, decay: 0.07, dest: mix });
  tone(s, { t, f0: (light ? 135 : 105) * s.v(0.05), f1: 48, drop: 0.05, peak: 0.8, decay: 0.08, dest: mix });
  burst(s, { t: t + 0.045, type: 'bandpass', f: 1900, q: 3, peak: 0.14, decay: 0.012 });
  gunTail(s, t, 1200, 0.16, 0.18);
}

export function mgBurst(s: Synth): void {
  for (let i = 0; i < 6; i++) mgRound(s, s.t + i * 0.1 + s.r(-0.004, 0.004));
}

export function sniper(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 3.5);
  burst(s, { t, type: 'highpass', f: 2600, peak: 1, decay: 0.02, dest: mix });
  burst(s, { t, type: 'bandpass', f: 800 * s.v(0.06), q: 0.7, peak: 0.9, decay: 0.1, dest: mix });
  tone(s, { t, f0: 95, f1: 38, drop: 0.1, peak: 0.9, decay: 0.18, dest: mix });
  gunTail(s, t, 1400, 0.35, 0.5);
  burst(s, { t: t + 0.22, kind: 'pink', type: 'lowpass', f: 900, peak: 0.2, attack: 0.02, decay: 0.6 });
  burst(s, { t: t + 0.5, kind: 'pink', type: 'lowpass', f: 600, peak: 0.1, attack: 0.03, decay: 0.7 });
}

export function tankCannon(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2.5);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 420, q: 0.8, peak: 1, attack: 0.002, decay: 0.7, dest: mix });
  tone(s, { t, f0: 72, f1: 26, drop: 0.45, peak: 1, attack: 0.003, decay: 0.8, dest: mix });
  burst(s, { t, type: 'highpass', f: 1000, peak: 0.55, decay: 0.05, dest: mix });
  burst(s, { t, type: 'bandpass', f: 400, q: 0.7, peak: 0.8, decay: 0.25, dest: mix });
  burst(s, { t: t + 0.32, kind: 'brown', type: 'lowpass', f: 300, peak: 0.45, attack: 0.04, decay: 0.9 });
  burst(s, { t: t + 0.75, kind: 'brown', type: 'lowpass', f: 220, peak: 0.25, attack: 0.08, decay: 1.1 });
}

export function bazooka(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 1.8);
  tone(s, { t, f0: 125, f1: 60, drop: 0.1, peak: 0.7, decay: 0.12, dest: mix });
  burst(s, { t, type: 'bandpass', f: 800, q: 0.8, peak: 0.7, decay: 0.08, dest: mix });
  burst(s, { t, type: 'bandpass', f: 900, f1: 2600, sweep: 0.3, q: 1.5, peak: 0.5, attack: 0.06, decay: 0.75 });
  tone(s, { t, f0: 1900, f1: 1300, drop: 0.7, peak: 0.05, attack: 0.05, decay: 0.7 });
}

/** Gas grenade launcher / canister: tube "thunk" + escaping hiss. */
export function canisterPop(s: Synth): void {
  const t = s.t;
  tone(s, { t, f0: 230 * s.v(0.08), f1: 105, drop: 0.06, peak: 0.7, decay: 0.1 });
  burst(s, { t, type: 'bandpass', f: 520, q: 0.9, peak: 0.6, decay: 0.06 });
  tone(s, { t, f0: 1300, f1: 1100, drop: 0.05, peak: 0.12, decay: 0.05, type: 'triangle' });
  burst(s, { t: t + 0.04, type: 'highpass', f: 3000, q: 0.7, peak: 0.25, attack: 0.08, decay: 0.7 });
}

/** One second of tear-gas spray (the sim emits one `fired` per second while spraying). */
export function gasSpray(s: Synth): void {
  const t = s.t;
  const d = 1.15;
  const n = s.noise('white', t, d);
  const hp = s.filter('highpass', 2200, 0.7);
  const lp = s.filter('lowpass', 9000, 0.7);
  const g = s.gain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.06);
  g.gain.linearRampToValueAtTime(0.28, t + 0.95);
  g.gain.exponentialRampToValueAtTime(1e-4, t + d);
  const flutter = s.osc('sine', 23, t, d);
  const fd = s.gain(0.06);
  flutter.connect(fd).connect(g.gain);
  n.connect(hp).connect(lp).connect(g).connect(s.out);
}

export function molotovThrow(s: Synth): void {
  burst(s, { t: s.t, type: 'bandpass', f: 350, f1: 1600, sweep: 0.2, q: 2.5, peak: 0.6, attack: 0.07, decay: 0.2 });
}

/** Bolt / slide racked: "click-clack". */
export function bolt(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'bandpass', f: 2800, q: 3, peak: 0.6, decay: 0.012 });
  tone(s, { t, f0: 1800, peak: 0.15, decay: 0.015, type: 'triangle' });
  const t2 = t + 0.11;
  burst(s, { t: t2, type: 'bandpass', f: 2200, q: 3, peak: 0.7, decay: 0.015 });
  tone(s, { t: t2, f0: 1300, peak: 0.18, decay: 0.02, type: 'triangle' });
  tone(s, { t: t2, f0: 400, f1: 300, drop: 0.03, peak: 0.15, decay: 0.03 });
}

// ── Explosions, fire, glass ──────────────────────────────────────────────────────────────

function debris(s: Synth, t: number, window: number, n: number, lo: number, hi: number, peak: number): void {
  scatter(s, t, window, n, (ti) =>
    burst(s, { t: ti, type: 'bandpass', f: s.r(lo, hi), q: 2, peak: s.r(peak * 0.4, peak), decay: s.r(0.012, 0.04) }),
  );
}

export function explosionSmall(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 1300, peak: 1, attack: 0.002, decay: 0.4, dest: mix });
  tone(s, { t, f0: 115, f1: 40, drop: 0.25, peak: 0.8, decay: 0.35, dest: mix });
  burst(s, { t, type: 'highpass', f: 1200, peak: 0.4, decay: 0.04, dest: mix });
  debris(s, t + 0.05, 0.45, 8, 1500, 4000, 0.25);
}

export function explosionMedium(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2.4);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 900, peak: 1, attack: 0.002, decay: 0.8, dest: mix });
  burst(s, { t, kind: 'pink', type: 'lowpass', f: 2400, peak: 0.6, attack: 0.002, decay: 0.3, dest: mix });
  tone(s, { t, f0: 85, f1: 30, drop: 0.4, peak: 1, decay: 0.7, dest: mix });
  burst(s, { t, type: 'highpass', f: 1500, peak: 0.5, decay: 0.05, dest: mix });
  debris(s, t + 0.1, 1, 14, 1200, 3500, 0.2);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 220, peak: 0.4, attack: 0.05, decay: 1.2 });
}

export function explosionBig(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2.6);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 650, peak: 1, attack: 0.003, decay: 1.3, dest: mix });
  burst(s, { t, kind: 'pink', type: 'lowpass', f: 2200, peak: 0.7, attack: 0.002, decay: 0.45, dest: mix });
  tone(s, { t, f0: 62, f1: 22, drop: 0.7, peak: 1, attack: 0.004, decay: 1.2, dest: mix });
  burst(s, { t, type: 'highpass', f: 1300, peak: 0.55, decay: 0.06, dest: mix });
  debris(s, t + 0.15, 1.5, 22, 1000, 3500, 0.2);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 180, peak: 0.55, attack: 0.1, decay: 2 });
  burst(s, { t: t + 0.45, kind: 'brown', type: 'lowpass', f: 400, peak: 0.3, attack: 0.05, decay: 1 });
}

/** The Prophets' comic dynamite: fuse fizz → cartoon tonal BOOM → tinkly debris. */
export function prophetBoom(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'highpass', f: 4000, peak: 0.18, attack: 0.01, decay: 0.25 });
  debris(s, t, 0.25, 5, 2500, 5000, 0.12);
  const tb = t + 0.28;
  const mix = bus(s, 0.9, 4);
  tone(s, { t: tb, f0: 170, f1: 38, drop: 0.6, peak: 1, decay: 0.9, dest: mix });
  burst(s, { t: tb, kind: 'brown', type: 'lowpass', f: 800, peak: 0.9, attack: 0.003, decay: 0.9, dest: mix });
  burst(s, { t: tb, type: 'highpass', f: 1200, peak: 0.4, decay: 0.06, dest: mix });
  scatter(s, tb + 0.3, 0.9, 10, (ti) =>
    tone(s, { t: ti, f0: s.r(1500, 4000), peak: s.r(0.03, 0.08), decay: s.r(0.05, 0.15) }),
  );
  tone(s, { t: tb + 0.5, f0: 1400, f1: 350, drop: 0.6, peak: 0.07, attack: 0.03, decay: 0.65 });
  burst(s, { t: tb, kind: 'brown', type: 'lowpass', f: 200, peak: 0.4, attack: 0.05, decay: 1.2 });
}

function shards(s: Synth, t: number, window: number, n: number, peak: number): void {
  scatter(s, t, window, n, (ti) =>
    tone(s, { t: ti, f0: s.r(2600, 7200), peak: s.r(peak * 0.35, peak), attack: 0.001, decay: s.r(0.03, 0.12) }),
  );
}

/** Bottle smash (molotov). */
export function glassSmash(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'highpass', f: 2800, peak: 0.8, decay: 0.12 });
  burst(s, { t, type: 'bandpass', f: 5200, q: 1, peak: 0.5, decay: 0.3 });
  burst(s, { t, type: 'bandpass', f: 1800, q: 1.2, peak: 0.4, decay: 0.05 });
  shards(s, t, 0.35, 16, 0.12);
}

/** Window / large pane: bigger crash, then falling pieces. */
export function glassBreak(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'highpass', f: 2200, peak: 1, decay: 0.2 });
  burst(s, { t, type: 'bandpass', f: 4500, q: 0.8, peak: 0.6, decay: 0.45 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 500, peak: 0.4, attack: 0.002, decay: 0.08 });
  shards(s, t, 0.5, 20, 0.13);
  shards(s, t + 0.25, 0.6, 12, 0.08);
}

export function fireWhoosh(s: Synth): void {
  const t = s.t;
  const d = 1.25;
  const n = s.noise('pink', t, d);
  const f = s.filter('lowpass', 300, 1.2);
  f.frequency.setValueAtTime(s.hz(300), t);
  f.frequency.exponentialRampToValueAtTime(s.hz(3200), t + 0.15);
  f.frequency.exponentialRampToValueAtTime(s.hz(700), t + 1.1);
  const g = s.gain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.9, t + 0.1);
  g.gain.exponentialRampToValueAtTime(1e-4, t + d);
  n.connect(f).connect(g).connect(s.out);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 200, peak: 0.6, attack: 0.05, decay: 1.1 });
  debris(s, t + 0.15, 0.9, 10, 2000, 5000, 0.12);
}

/** Masonry hit on the Capitol: thud + rubble trickle. */
export function capitolHit(s: Synth): void {
  const t = s.t;
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 600, peak: 0.8, attack: 0.003, decay: 0.25 });
  tone(s, { t, f0: 90, f1: 55, drop: 0.15, peak: 0.6, decay: 0.2 });
  scatter(s, t + 0.05, 0.6, 12, (ti) =>
    burst(s, { t: ti, type: 'bandpass', f: s.r(600, 2000), q: 1.5, peak: s.r(0.1, 0.25), decay: s.r(0.02, 0.05) }),
  );
}

/** Blockade wrecked / vehicle carcass: two clangs, crash, tinkles. */
export function metalWreck(s: Synth): void {
  const t = s.t;
  partials(s, t, 300, [1, 2.41, 3.9, 5.3, 7.1], [0.25, 0.18, 0.12, 0.08, 0.05], [0.8, 0.6, 0.4, 0.3, 0.2]);
  burst(s, { t, type: 'highpass', f: 1500, peak: 0.6, decay: 0.4 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 300, peak: 0.8, attack: 0.003, decay: 0.5 });
  const t2 = t + 0.12;
  partials(s, t2, 520, [1, 2.3, 3.7], [0.18, 0.12, 0.07], [0.6, 0.4, 0.25]);
  scatter(s, t + 0.2, 0.9, 12, (ti) =>
    tone(s, { t: ti, f0: s.r(1200, 3500), peak: s.r(0.03, 0.08), decay: s.r(0.05, 0.2), type: 'triangle' }),
  );
}

