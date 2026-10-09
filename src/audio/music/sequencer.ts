/**
 * Adaptive music sequencer: look-ahead scheduler on the AudioContext clock.
 *
 * `tick(now)` (called every ~50 ms by the engine) generates whole bars just before they are
 * due and schedules every note with sample accuracy. State changes (`setTarget`) take effect
 * on the next bar boundary: theme / flavour switches start the new style at bar 0 (a march
 * entered from hold music gets a one-bar snare-roll pickup), layer & night changes apply to
 * the next bar, tempo follows intensity at section boundaries. One-shot themes (victory,
 * defeat) play their form once and then fall silent.
 */
import { INSTRUMENTS } from './instruments';
import {
  generateBar,
  layerFor,
  pickupBar,
  stepsPerBar,
  styleFor,
  tempoFor,
  type BarPlan,
  type Flavour,
  type Style,
  type Theme,
} from './patterns';

export interface MusicTarget {
  theme: Theme | null;
  flavour: Flavour;
  intensity: number;
  night: boolean;
  /** Breather "parade rest" vamp (march without melody). */
  vamp: boolean;
}

interface Playing {
  style: Style;
  section: number;
  bar: number;
  tempo: number;
  ended: boolean;
  night: boolean;
  layer: number;
  vamp: boolean;
}

export interface SequencerInfo {
  theme: string;
  bar: number;
  tempo: number;
  layer: number;
}

export class Sequencer {
  private target: MusicTarget = { theme: null, flavour: 'ministry', intensity: 0, night: false, vamp: false };
  private cur: Playing | null = null;
  private nextBar = 0;
  private barStart = 0;
  private barDur = 0;
  private beatDur = 0.5;
  private out: GainNode;
  private totalBars = 0;
  /** Seconds scheduled ahead of `now`. */
  lookahead = 0.25;

  constructor(
    private readonly c: BaseAudioContext,
    private readonly dest: AudioNode,
    private readonly seed = 1,
  ) {
    this.out = c.createGain();
    this.out.connect(dest);
  }

  setTarget(t: Partial<MusicTarget>): void {
    this.target = { ...this.target, ...t };
  }

  getTarget(): Readonly<MusicTarget> {
    return this.target;
  }

  info(): SequencerInfo | null {
    if (!this.cur || this.cur.ended) return null;
    return { theme: this.cur.style.id, bar: this.totalBars, tempo: this.cur.tempo, layer: this.cur.layer };
  }

  /** Beat grid for things that want to land in time (crowd chants). */
  clock(now: number): { beatDur: number; nextBeat: number } | null {
    if (!this.cur || this.cur.ended || this.barDur <= 0) return null;
    const since = now - this.barStart;
    const k = Math.ceil(since / this.beatDur - 1e-6);
    return { beatDur: this.beatDur, nextBeat: this.barStart + k * this.beatDur };
  }

  /** Hard stop (fade out what is already scheduled). */
  stop(now: number): void {
    this.out.gain.setTargetAtTime(0, now, 0.05);
    const old = this.out;
    setTimeout(() => old.disconnect(), 400);
    this.out = this.c.createGain();
    this.out.connect(this.dest);
    this.cur = null;
    this.nextBar = 0;
  }

  tick(now: number): void {
    if (this.nextBar < now - 0.05) {
      // Fell behind (tab throttled / context resumed): re-anchor instead of a note avalanche.
      this.nextBar = now + 0.05;
    }
    let guard = 0;
    while (this.nextBar < now + this.lookahead && guard++ < 4) this.scheduleNext();
  }

  private wanted(): { style: Style | null } {
    const t = this.target;
    return { style: t.theme ? styleFor(t.theme, t.flavour) : null };
  }

  private scheduleNext(): void {
    const { style } = this.wanted();
    if (!style) {
      this.cur = null;
      this.nextBar += 0.25;
      return;
    }
    const t = this.target;
    let pickup: BarPlan | null = null;
    if (!this.cur || this.cur.style.id !== style.id) {
      const fromHold = this.cur && !this.cur.ended && this.cur.style.theme === 'hold';
      if (fromHold && style.theme === 'march') pickup = pickupBar(style);
      this.cur = {
        style,
        section: 0,
        bar: 0,
        tempo: tempoFor(style, t.intensity, t.night),
        ended: false,
        night: t.night,
        layer: layerFor(t.intensity),
        vamp: t.vamp,
      };
    }
    const p = this.cur;
    if (p.ended) {
      this.nextBar += 0.25;
      return;
    }
    if (pickup) {
      this.playBar(pickup, p.tempo, style);
      return;
    }
    // Bar-boundary updates.
    p.night = t.night;
    p.layer = layerFor(t.intensity);
    p.vamp = t.vamp;
    if (p.bar === 0) p.tempo = tempoFor(style, t.intensity, t.night);
    const section = style.form[p.section]!;
    const formEnd = style.oneShot && p.section === style.form.length - 1;
    const plan = generateBar({
      style,
      section,
      barInSection: p.bar,
      layer: style.theme === 'march' ? p.layer : 1,
      night: p.night && style.theme === 'march',
      seed: this.seed,
      vamp: p.vamp && style.theme === 'march',
      formEnd: formEnd && p.bar === (style.sections[section]?.length ?? 8) - 1,
    });
    this.playBar(plan, p.tempo, style);
    // Advance.
    p.bar++;
    const len = style.sections[section]?.length ?? 8;
    if (p.bar >= len) {
      p.bar = 0;
      p.section++;
      if (p.section >= style.form.length) {
        if (style.oneShot) p.ended = true;
        p.section = 0;
      }
    }
  }

  private playBar(plan: BarPlan, tempo: number, style: Style): void {
    const stepDur = 60 / tempo / style.stepsPerBeat;
    const t0 = this.nextBar;
    for (const n of plan.notes) {
      const fn = INSTRUMENTS[n.inst];
      const o = n.bend !== undefined || n.vib !== undefined ? { bend: n.bend, vib: n.vib } : undefined;
      fn(this.c, this.out, t0 + n.step * stepDur, n.len * stepDur, n.midi, n.vel, o);
    }
    this.barStart = t0;
    this.barDur = plan.steps * stepDur;
    this.beatDur = stepDur * style.stepsPerBeat;
    this.nextBar = t0 + this.barDur;
    this.totalBars++;
  }

  /** Schedule bars covering [from, from + seconds) — offline rendering helper. */
  renderSpan(from: number, seconds: number): void {
    this.nextBar = from;
    let guard = 0;
    while (this.nextBar < from + seconds && guard++ < 512) this.scheduleNext();
  }

  /** Length in seconds of one bar of a style at a tempo (for tests/tools). */
  static barSeconds(style: Style, tempo: number): number {
    return (stepsPerBar(style) * 60) / tempo / style.stepsPerBeat;
  }
}
