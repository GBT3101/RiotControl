/**
 * Special-skill sounds (playtest round 2): recipes + mix settings, merged into the SFX catalogue
 * (`catalog.ts`) under the ids of `specialIds.ts`. Trigger them like any SFX:
 * `audio.play('missileBoom', { x, y })`. Which sim event plays what: docs/art/specials.md.
 *
 * Same layer recipes as combat.ts (we cannot listen, so structure carries the design):
 * - gallop = clops on a 3-beat-plus-suspension pattern that tightens and swells (a charge);
 * - crowd impact = body thump + crunch sweep + formant "oof" grunts + scattered clatter;
 * - rapid fire = five driven pistol cracks on a strict 120 ms grid, each followed by the slide's
 *   mechanical clack, then brass casings tinkling;
 * - booms = crack + low-passed brown blast + sub plunge + debris + rumble tails, scaled up from
 *   the frag (sharp, short) to the missile (deep, long, rolling thunder);
 * - air strike = a doppler rotor swoop, a rocket salvo, a chain of booms walking along a line.
 */
import type { SfxPolicy } from '../limiter';
import type { BusName } from '../types';
import type { SfxDef } from './catalog';
import { ahr, burst, bus, glide, partials, perc, scatter, tone, type Synth } from './kit';
import type { SpecialSfxId } from './specialIds';

// ── Ram ──────────────────────────────────────────────────────────────────────────────────

function clop(s: Synth, t: number, g: number): void {
  burst(s, { t, type: 'bandpass', f: 1050 * s.v(0.12), q: 3.2, peak: 0.85 * g, decay: 0.03 });
  tone(s, { t, f0: 260 * s.v(0.08), f1: 150, drop: 0.035, peak: 0.45 * g, decay: 0.05 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 420, peak: 0.45 * g, attack: 0.002, decay: 0.06 });
}

/** Gallop build-up: strides tighten from a canter to a flat-out charge, swelling, with snorts. */
export function ramGallop(s: Synth): void {
  let t = s.t;
  const strides = 7;
  for (let k = 0; k < strides; k++) {
    const u = k / (strides - 1);
    const stride = 0.36 - u * 0.15;
    const g = 0.45 + u * 0.55;
    clop(s, t + s.r(0, 0.008), g * 0.8);
    clop(s, t + stride * 0.2, g * 0.75);
    clop(s, t + stride * 0.42, g);
    // Snort / breath on every other stride.
    if (k % 2 === 1) {
      burst(s, { t: t + stride * 0.55, kind: 'pink', type: 'bandpass', f: 700, q: 1.5, peak: 0.18 * g, attack: 0.02, decay: 0.09 });
    }
    t += stride;
  }
  // Tack jingle riding on top.
  scatter(s, s.t + 0.2, 1.2, 7, (ti) => partials(s, ti, s.r(3200, 4200), [1, 2.4], [0.025, 0.012], [0.08, 0.05]));
  // Rising wind of speed.
  burst(s, { t: s.t + 0.4, kind: 'pink', type: 'bandpass', f: 500, f1: 1400, sweep: 1.1, q: 0.8, peak: 0.12, attack: 0.8, decay: 0.3 });
}

/** Charging horse into a crowd: heavy thump, crunch, two "oof" grunts, clattering signs. */
export function ramImpact(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2.2);
  tone(s, { t, f0: 105 * s.v(0.08), f1: 42, drop: 0.12, peak: 1, decay: 0.24, dest: mix });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 650, peak: 0.9, attack: 0.002, decay: 0.16, dest: mix });
  burst(s, { t, type: 'bandpass', f: 380, f1: 1300, sweep: 0.1, q: 3.5, peak: 0.9, attack: 0.006, decay: 0.12, dest: mix });
  burst(s, { t, type: 'highpass', f: 2600, peak: 0.3, decay: 0.02, dest: mix });
  // Grunts: formant-filtered saw with a downward pitch bend.
  for (let k = 0; k < 2; k++) {
    const tg = t + 0.03 + k * s.r(0.07, 0.11);
    const f0 = s.r(150, 230);
    const o = s.osc('sawtooth', f0, tg, 0.18);
    glide(o.frequency, tg, s.hz(f0), s.hz(f0 * 0.62), 0.16);
    const g = s.gain();
    ahr(g.gain, tg, 0.2, 0.01, 0.04, 0.12);
    for (const [f, q, lv] of [
      [620, 6, 1],
      [1150, 7, 0.55],
    ] as const) {
      const bp = s.filter('bandpass', f * s.v(0.08), q);
      const lg = s.gain(lv);
      o.connect(bp).connect(lg).connect(g);
    }
    g.connect(s.out);
  }
  // Placards and shoes clattering.
  scatter(s, t + 0.06, 0.4, 7, (ti) =>
    burst(s, { t: ti, type: 'bandpass', f: s.r(900, 2400), q: 2.5, peak: s.r(0.08, 0.2), decay: s.r(0.015, 0.04) }),
  );
}

// ── Rapid fire ───────────────────────────────────────────────────────────────────────────

function shot(s: Synth, t: number, k: number): void {
  const mix = bus(s, 1, 2.6);
  burst(s, { t, type: 'highpass', f: 1600, q: 0.7, peak: 1, decay: 0.03, dest: mix });
  burst(s, { t, type: 'bandpass', f: (680 + k * 18) * s.v(0.05), q: 0.75, peak: 0.95, decay: 0.09, dest: mix });
  tone(s, { t, f0: 155 * s.v(0.04), f1: 55, drop: 0.05, peak: 0.8, decay: 0.08, dest: mix });
  // Slide cycling: a tight mechanical clack 45 ms after the shot.
  const tc = t + 0.045;
  burst(s, { t: tc, type: 'bandpass', f: 2900, q: 3.2, peak: 0.32, decay: 0.012 });
  tone(s, { t: tc, f0: 1750, peak: 0.08, decay: 0.014, type: 'triangle' });
  burst(s, { t: tc + 0.018, type: 'bandpass', f: 2200, q: 3, peak: 0.22, decay: 0.012 });
}

/** Five pistol shots on a strict 120 ms grid, slide clacks, room tail, casings tinkling. */
export function rapidFire(s: Synth): void {
  const t = s.t;
  for (let k = 0; k < 5; k++) shot(s, t + k * 0.12, k);
  burst(s, { t, kind: 'pink', type: 'lowpass', f: 1500, peak: 0.28, attack: 0.01, decay: 0.75 });
  // Brass on asphalt: bright inharmonic pings, front-loaded after the burst starts.
  scatter(s, t + 0.22, 0.65, 9, (ti) =>
    partials(s, ti, s.r(4200, 6200), [1, 1.48, 2.3], [0.05, 0.03, 0.015], [0.07, 0.05, 0.03]),
  );
}

// ── Real grenade ─────────────────────────────────────────────────────────────────────────

/** Pin pulled (ring scrape) and the spoon flicking off with a ping. */
export function fragPin(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'bandpass', f: 2600, f1: 4800, sweep: 0.07, q: 4, peak: 0.45, attack: 0.01, decay: 0.07 });
  partials(s, t + 0.012, 3600, [1, 1.9], [0.12, 0.05], [0.06, 0.04]);
  const tp = t + 0.16;
  burst(s, { t: tp, type: 'bandpass', f: 3200, q: 3, peak: 0.5, decay: 0.012 });
  partials(s, tp, 2450 * s.v(0.03), [1, 2.71, 5.13], [0.22, 0.1, 0.05], [0.24, 0.14, 0.08]);
}

/** Overarm throw whoosh, then the grenade clinking and skittering on the asphalt. */
export function fragThrow(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'bandpass', f: 420, f1: 1700, sweep: 0.2, q: 2.2, peak: 0.6, attack: 0.08, decay: 0.16 });
  const tl = t + 0.34;
  partials(s, tl, 1900 * s.v(0.05), [1, 2.3, 3.7], [0.2, 0.1, 0.05], [0.07, 0.05, 0.03]);
  burst(s, { t: tl, kind: 'brown', type: 'lowpass', f: 700, peak: 0.3, attack: 0.002, decay: 0.04 });
  partials(s, tl + 0.09, 2100, [1, 2.4], [0.1, 0.05], [0.05, 0.03]);
  partials(s, tl + 0.15, 2000, [1, 2.4], [0.05, 0.02], [0.04, 0.02]);
}

/** Sharp, lethal boom: hard crack, short punchy blast, shrapnel whizzing off, quick tail. */
export function fragBoom(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 3);
  burst(s, { t, type: 'highpass', f: 1800, peak: 0.9, decay: 0.03, dest: mix });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 1200, peak: 1, attack: 0.002, decay: 0.45, dest: mix });
  burst(s, { t, kind: 'pink', type: 'lowpass', f: 3000, peak: 0.6, attack: 0.001, decay: 0.18, dest: mix });
  tone(s, { t, f0: 105, f1: 34, drop: 0.3, peak: 1, decay: 0.42, dest: mix });
  // Shrapnel whizzes: fast falling whistles.
  scatter(s, t + 0.02, 0.35, 6, (ti) => {
    const f0 = s.r(4200, 6500);
    tone(s, { t: ti, f0, f1: f0 * 0.45, drop: 0.12, peak: s.r(0.025, 0.05), attack: 0.004, decay: 0.12 });
  });
  scatter(s, t + 0.08, 0.6, 10, (ti) =>
    burst(s, { t: ti, type: 'bandpass', f: s.r(1300, 3600), q: 2, peak: s.r(0.06, 0.16), decay: s.r(0.012, 0.035) }),
  );
  burst(s, { t: t + 0.05, kind: 'brown', type: 'lowpass', f: 260, peak: 0.4, attack: 0.04, decay: 0.9 });
}

// ── Tank missile ─────────────────────────────────────────────────────────────────────────

/** Ignition pop, then a roaring rocket motor that rises and recedes (doppler whistle). */
export function missileLaunch(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2);
  tone(s, { t, f0: 190, f1: 70, drop: 0.08, peak: 0.8, decay: 0.12, dest: mix });
  burst(s, { t, type: 'bandpass', f: 900, q: 0.8, peak: 0.8, decay: 0.07, dest: mix });
  // Motor roar: noise through a rising band, swelling then fading as it flies off.
  const d = 1.35;
  const n = s.noise('white', t + 0.02, d);
  const bp = s.filter('bandpass', 700, 0.9);
  glide(bp.frequency, t + 0.02, s.hz(700), s.hz(2600), 0.5);
  bp.frequency.exponentialRampToValueAtTime(s.hz(1300), t + d);
  const g = s.gain();
  g.gain.setValueAtTime(0, t + 0.02);
  g.gain.linearRampToValueAtTime(0.75, t + 0.12);
  g.gain.linearRampToValueAtTime(0.5, t + 0.5);
  g.gain.exponentialRampToValueAtTime(1e-4, t + d);
  n.connect(bp).connect(g).connect(s.out);
  // Low rumble of the exhaust + receding whistle.
  burst(s, { t: t + 0.02, kind: 'brown', type: 'lowpass', f: 260, peak: 0.55, attack: 0.03, decay: 0.8 });
  tone(s, { t: t + 0.1, f0: 1650, f1: 950, drop: 1.1, peak: 0.06, attack: 0.15, decay: 1.1 });
}

/** The big one: deep blast, sub plunge, long debris rain, rolling thunder tail. */
export function missileBoom(s: Synth): void {
  const t = s.t;
  const mix = bus(s, 1, 2.8);
  burst(s, { t, type: 'highpass', f: 1200, peak: 0.6, decay: 0.07, dest: mix });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 520, peak: 1, attack: 0.003, decay: 1.6, dest: mix });
  burst(s, { t, kind: 'pink', type: 'lowpass', f: 2000, peak: 0.75, attack: 0.002, decay: 0.6, dest: mix });
  tone(s, { t, f0: 56, f1: 18, drop: 1, peak: 1, attack: 0.005, decay: 1.6, dest: mix });
  // Secondary thumps (the multi-stage fireball and the bursts across the zone).
  for (const [dt, f] of [
    [0.16, 80],
    [0.31, 70],
    [0.47, 64],
  ] as const) {
    tone(s, { t: t + dt, f0: f, f1: 30, drop: 0.2, peak: 0.45, decay: 0.3 });
    burst(s, { t: t + dt, kind: 'brown', type: 'lowpass', f: 700, peak: 0.35, attack: 0.003, decay: 0.25 });
  }
  scatter(s, t + 0.2, 2.2, 26, (ti) =>
    burst(s, { t: ti, type: 'bandpass', f: s.r(900, 3400), q: 2, peak: s.r(0.05, 0.16), decay: s.r(0.012, 0.045) }),
  );
  // Rolling thunder: two slow, low swells with a wobble.
  for (const [dt, peak, dec] of [
    [0.1, 0.6, 2.6],
    [0.7, 0.4, 2.2],
  ] as const) {
    const n = s.noise('brown', t + dt, dec + 0.3);
    const lp = s.filter('lowpass', 150, 0.9);
    const g = s.gain();
    ahr(g.gain, t + dt, peak, 0.25, 0.1, dec);
    const lfo = s.osc('sine', 3.2 * s.v(0.2), t + dt, dec + 0.3);
    const depth = s.gain(peak * 0.35);
    lfo.connect(depth).connect(g.gain);
    n.connect(lp).connect(g).connect(s.out);
  }
}

// ── Air strike ───────────────────────────────────────────────────────────────────────────

/** Helicopter diving through: rotor chop speeding up and dropping in pitch past the listener. */
export function airSwoop(s: Synth): void {
  const t = s.t;
  const d = 2.1;
  let ti = t;
  while (ti < t + d) {
    const u = (ti - t) / d;
    const bell = Math.sin(Math.PI * Math.min(1, u * 1.1)) * 0.9 + 0.1;
    const doppler = u < 0.5 ? 1.15 : 0.82;
    burst(s, { t: ti, kind: 'pink', type: 'lowpass', f: (700 - 250 * u) * doppler, q: 1.3, peak: 0.85 * bell, attack: 0.005, decay: 0.055 });
    tone(s, { t: ti, f0: (84 - 18 * u) * doppler, peak: 0.32 * bell, attack: 0.004, decay: 0.05 });
    ti += 0.085 - 0.02 * Math.sin(Math.PI * u);
  }
  // Turbine whine and air rush, doppler-shifted.
  tone(s, { t, f0: 2600, f1: 1500, drop: d, peak: 0.05, attack: 0.6, decay: d - 0.6 });
  burst(s, { t, kind: 'pink', type: 'bandpass', f: 2400, f1: 600, sweep: d, q: 1, peak: 0.35, attack: d * 0.5, decay: d * 0.45 });
}

/** A salvo of six rockets leaving the pods: pop + tearing hiss each, 80 ms apart. */
export function rocketSalvo(s: Synth): void {
  for (let k = 0; k < 6; k++) {
    const t = s.t + k * 0.08 + s.r(0, 0.012);
    tone(s, { t, f0: 240 * s.v(0.06), f1: 110, drop: 0.05, peak: 0.45, decay: 0.07 });
    burst(s, { t, type: 'bandpass', f: 3200, f1: 1100, sweep: 0.3, q: 1.4, peak: 0.45, attack: 0.01, decay: 0.32 });
    burst(s, { t, type: 'highpass', f: 2500, peak: 0.25, decay: 0.03 });
  }
}

/** A chain of explosions walking along the strike line, then one long rumble. */
export function strikeChain(s: Synth): void {
  const t = s.t;
  const n = 9;
  for (let k = 0; k < n; k++) {
    const tk = t + k * 0.08 + s.r(0, 0.016);
    const g = 0.75 + (k % 3 === 0 ? 0.25 : 0);
    const mix = bus(s, g, 2.2);
    burst(s, { t: tk, kind: 'brown', type: 'lowpass', f: 950 * s.v(0.1), peak: 1, attack: 0.002, decay: 0.32, dest: mix });
    tone(s, { t: tk, f0: 95 * s.v(0.08), f1: 34, drop: 0.22, peak: 0.85, decay: 0.3, dest: mix });
    burst(s, { t: tk, type: 'highpass', f: 1500, peak: 0.4, decay: 0.035, dest: mix });
  }
  scatter(s, t + 0.1, 1.4, 18, (ti) =>
    burst(s, { t: ti, type: 'bandpass', f: s.r(1000, 3200), q: 2, peak: s.r(0.05, 0.14), decay: s.r(0.012, 0.04) }),
  );
  burst(s, { t: t + 0.1, kind: 'brown', type: 'lowpass', f: 200, peak: 0.55, attack: 0.25, decay: 2 });
}

// ── Shared UI ────────────────────────────────────────────────────────────────────────────

/** Bell voice: sine + inharmonic overtone, short attack (chimes). */
function bell(s: Synth, t: number, f: number, peak: number, decay: number): void {
  partials(s, t, f, [1, 2.76, 5.4], [peak, peak * 0.32, peak * 0.1], [decay, decay * 0.55, decay * 0.3]);
}

/** Tier 1 ready (ram, rapid fire — L4–5): two bright bell notes (E6 → A6). */
export function skillReady1(s: Synth): void {
  bell(s, s.t, 1319, 0.16, 0.3);
  bell(s, s.t + 0.09, 1760, 0.16, 0.45);
}

/** Tier 2 ready (frag — L6): a rising triad with a metallic edge (C6 E6 G6). */
export function skillReady2(s: Synth): void {
  bell(s, s.t, 1047, 0.15, 0.3);
  bell(s, s.t + 0.08, 1319, 0.15, 0.3);
  bell(s, s.t + 0.16, 1568, 0.17, 0.55);
  tone(s, { t: s.t + 0.16, f0: 3136, peak: 0.03, decay: 0.3, type: 'triangle' });
}

/** Tier 3 ready (missile, air strike — L9–10): low brass hit under a four-note bell run. */
export function skillReady3(s: Synth): void {
  const t = s.t;
  const o = s.osc('sawtooth', 196, t, 0.6);
  const lp = s.filter('lowpass', 900, 1.2);
  glide(lp.frequency, t, s.hz(1600), s.hz(500), 0.5);
  const g = s.gain();
  perc(g.gain, t, 0.18, 0.012, 0.55);
  o.connect(lp).connect(g).connect(s.out);
  bell(s, t, 784, 0.13, 0.3);
  bell(s, t + 0.08, 1047, 0.14, 0.3);
  bell(s, t + 0.16, 1319, 0.15, 0.3);
  bell(s, t + 0.24, 1568, 0.18, 0.7);
}

/** Reticle moved / paint point added: a dry tick. */
export function aimTick(s: Synth): void {
  tone(s, { t: s.t, f0: 2400, f1: 1900, drop: 0.012, peak: 0.25, decay: 0.022 });
  burst(s, { t: s.t, type: 'highpass', f: 5000, peak: 0.08, decay: 0.006 });
}

/** Target locked: two quick rising beeps. */
export function aimLock(s: Synth): void {
  for (const [dt, f] of [
    [0, 1400],
    [0.075, 2100],
  ] as const) {
    const lp = s.filter('lowpass', 4000, 0.7);
    const g = s.gain();
    ahr(g.gain, s.t + dt, 0.13, 0.003, 0.045, 0.02);
    s.osc('square', f, s.t + dt, 0.08).connect(lp);
    lp.connect(g).connect(s.out);
  }
}

/** Aim / paint cancelled: a falling blip. */
export function aimCancel(s: Synth): void {
  tone(s, { t: s.t, f0: 900, f1: 420, drop: 0.12, peak: 0.3, decay: 0.14, type: 'triangle' });
}

/** Paint stroke tick (every ~half tile of the strike line): a soft spray-can "pssk". */
export function paintTick(s: Synth): void {
  burst(s, { t: s.t, type: 'highpass', f: 4200, q: 0.7, peak: 0.22, attack: 0.004, decay: 0.035 });
  tone(s, { t: s.t, f0: 3100, peak: 0.04, decay: 0.015 });
}

// ── Catalogue entries ────────────────────────────────────────────────────────────────────

type P = Omit<SfxPolicy, 'dur'>;
const pol = (priority: number, maxVoices: number, minInterval: number, extra: Partial<P> = {}): P => ({
  priority,
  maxVoices,
  minInterval,
  aggregate: true,
  steal: true,
  ...extra,
});

function def(
  bus: BusName,
  dur: number,
  gain: number,
  variants: number,
  policy: P,
  recipe: (s: Synth) => void,
  extra: Partial<SfxDef> = {},
): SfxDef {
  return { bus, dur, gain, variants, jitter: 0.03, spatial: bus !== 'ui', policy, recipe, ...extra };
}

const UI = pol(10, 2, 0.03, { aggregate: false });

/** Mix levels calibrated with the offline render (peak at bus input ≈ the stock SFX). */
export const SPECIAL_SFX: Readonly<Record<SpecialSfxId, SfxDef>> = {
  ramGallop: def('sfx', 2.3, 0.55, 1, pol(6, 1, 0.8), ramGallop),
  ramImpact: def('sfx', 0.65, 0.5, 2, pol(5, 3, 0.08, { boostCap: 1.4 }), ramImpact),
  rapidFire: def('sfx', 1.4, 0.5, 1, pol(7, 2, 0.3), rapidFire),
  fragPin: def('sfx', 0.5, 0.8, 1, pol(6, 2, 0.2), fragPin),
  fragThrow: def('sfx', 0.6, 0.85, 1, pol(6, 2, 0.2), fragThrow),
  fragBoom: def('sfx', 1.6, 0.65, 2, pol(9, 3, 0.08), fragBoom, {
    duck: { bus: 'ambience', db: 5, hold: 0.4 },
  }),
  missileLaunch: def('sfx', 1.6, 0.55, 1, pol(8, 1, 0.5), missileLaunch),
  missileBoom: def('sfx', 3.8, 0.68, 1, pol(10, 1, 0.3), missileBoom, {
    jitter: 0.02,
    duck: { bus: 'ambience', db: 9, hold: 1.2 },
  }),
  airSwoop: def('sfx', 2.3, 0.6, 1, pol(7, 1, 1), airSwoop),
  rocketSalvo: def('sfx', 1.0, 0.55, 1, pol(7, 2, 0.3), rocketSalvo),
  strikeChain: def('sfx', 2.6, 0.7, 1, pol(9, 1, 0.5), strikeChain, {
    duck: { bus: 'ambience', db: 7, hold: 1 },
  }),
  skillReady1: def('ui', 0.6, 0.9, 1, pol(10, 1, 0.4), skillReady1, { jitter: 0 }),
  skillReady2: def('ui', 0.8, 0.9, 1, pol(10, 1, 0.4), skillReady2, { jitter: 0 }),
  skillReady3: def('ui', 1.1, 0.9, 1, pol(10, 1, 0.4), skillReady3, {
    jitter: 0,
    duck: { bus: 'music', db: 4, hold: 0.6 },
  }),
  aimTick: def('ui', 0.05, 0.6, 1, pol(10, 2, 0.04, { aggregate: false, boostCap: 1 }), aimTick, { jitter: 0.05 }),
  aimLock: def('ui', 0.2, 0.9, 1, UI, aimLock, { jitter: 0 }),
  aimCancel: def('ui', 0.2, 0.6, 1, UI, aimCancel, { jitter: 0 }),
  paintTick: def('ui', 0.06, 0.6, 2, pol(10, 2, 0.05, { aggregate: false, boostCap: 1 }), paintTick, {
    jitter: 0.08,
  }),
};
