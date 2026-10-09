/**
 * Game feel: integer-pixel screen shake, hit-stop, floating "+1" Hate fists flying to the HUD,
 * Legitimacy wax-seal pops, level-up confetti.
 *
 * Hate pickups live in screen space (UI scale): a fist pops up at the death's screen position
 * (0.16 s), then flies (0.6 s, eased in-out along a small arc) to `hateTarget` (a screen point
 * the UI provides; top-left by default), vanishes and emits `onArrive(amount)`. Deaths close
 * together while a fist is still popping merge into it ("+12"); at most `maxPickups` fly at
 * once — overflow Hate is added to the youngest fist.
 */
import { Container, Sprite } from 'pixi.js';
import { art } from '../art/lib/atlas';
import { FONTS, textSprite } from '../art/uikit/text';
import { bufferTexture } from '../art/uikit/pixi';
import type { Texture } from 'pixi.js';
import { setTex } from './sprites';

interface Pickup {
  icon: Sprite;
  label: Sprite;
  x0: number;
  y0: number;
  t0: number;
  amount: number;
  shown: number;
  dur: number;
}

/** Pop (rise) phase of a pickup, s. */
const POP = 0.16;
/** Flight to the HUD, s. */
const FLY = 0.6;
/** Pickups spawned within this many UI px (while still popping) merge into one. */
const MERGE_R = 48;

export class Juice {
  /** Screen-space container (UI scale applied by the owner). */
  readonly screen = new Container({ label: 'juice' });
  private shakeAmp = 0;
  private shakeT = 0;
  private stopUntil = 0;
  private readonly pickups: Pickup[] = [];
  private readonly free: Pickup[] = [];
  private readonly labels = new Map<number, Texture>();
  /** UI px. */
  hateTarget = { x: 18, y: 14 };
  maxPickups = 10;
  reducedMotion = false;
  onArrive: ((amount: number) => void) | null = null;
  /** Screen shake offset in world px (integer). */
  ox = 0;
  oy = 0;

  /** Kick the camera: amplitude in world px (decays over `dur` s). */
  shake(amp: number, dur = 0.35): void {
    if (this.reducedMotion) return;
    if (amp > this.shakeAmp) this.shakeAmp = amp;
    this.shakeT = Math.max(this.shakeT, dur);
  }

  /** Freeze the simulation for `ms` (real time). */
  hitStop(ms: number, nowMs: number): void {
    this.stopUntil = Math.max(this.stopUntil, nowMs + ms);
  }

  stopped(nowMs: number): boolean {
    return nowMs < this.stopUntil;
  }

  private labelTex(n: number): Texture {
    let t = this.labels.get(n);
    if (!t) {
      t = bufferTexture(
        textSprite(FONTS.smallBold, `+${n}`, 'crim2', { outline: 'rust0' }),
        `+${n}`,
      );
      this.labels.set(n, t);
    }
    return t;
  }

  /** A Hate pickup at screen point (sx, sy) in UI px. */
  hate(amount: number, sx: number, sy: number, realNow: number): void {
    if (!art.has('fx.pickup.hate')) {
      this.onArrive?.(amount);
      return;
    }
    // Merge into a fist that is still popping nearby; at the cap, into the youngest one.
    let youngest: Pickup | null = null;
    for (const q of this.pickups) {
      if (!youngest || q.t0 > youngest.t0) youngest = q;
      if (realNow - q.t0 < POP && Math.abs(q.x0 - sx) < MERGE_R && Math.abs(q.y0 - sy) < MERGE_R) {
        q.amount += amount;
        return;
      }
    }
    if (youngest && this.pickups.length >= this.maxPickups) {
      youngest.amount += amount;
      return;
    }
    let p = this.free.pop();
    if (!p) {
      p = {
        icon: new Sprite(),
        label: new Sprite(),
        x0: 0,
        y0: 0,
        t0: 0,
        amount: 0,
        shown: 0,
        dur: 0,
      };
      p.label.anchor.set(0, 0.5);
      this.screen.addChild(p.icon, p.label);
    }
    p.icon.visible = p.label.visible = true;
    p.x0 = sx;
    p.y0 = sy;
    p.t0 = realNow;
    p.amount = amount;
    p.shown = -1;
    p.dur = FLY;
    this.pickups.push(p);
  }

  update(realDt: number, realNow: number): void {
    // Shake.
    if (this.shakeT > 0) {
      this.shakeT -= realDt;
      const a = Math.max(0, Math.round(this.shakeAmp * Math.min(1, this.shakeT / 0.3)));
      const ph = Math.floor(realNow * 40);
      this.ox = a === 0 ? 0 : ((ph * 7919) % (2 * a + 1)) - a;
      this.oy = a === 0 ? 0 : ((ph * 104729) % (2 * a + 1)) - a;
      if (this.shakeT <= 0) {
        this.shakeAmp = 0;
        this.ox = this.oy = 0;
      }
    }
    // Pickups.
    const clip = art.has('fx.pickup.hate') ? art.anim('fx.pickup.hate') : null;
    for (let k = this.pickups.length - 1; k >= 0; k--) {
      const p = this.pickups[k]!;
      const age = realNow - p.t0;
      let x: number;
      let y: number;
      if (age < POP) {
        // Pop: quick ease-out rise.
        const f = age / POP;
        x = p.x0;
        y = p.y0 - 8 * (1 - (1 - f) * (1 - f));
      } else {
        const f = Math.min(1, (age - POP) / p.dur);
        // Ease in-out (cubic): leaves gently, accelerates, lands softly.
        const e = f < 0.5 ? 4 * f * f * f : 1 - (-2 * f + 2) ** 3 / 2;
        const sx = p.x0;
        const sy = p.y0 - 8;
        x = sx + (this.hateTarget.x - sx) * e;
        y = sy + (this.hateTarget.y - sy) * e - Math.sin(f * Math.PI) * 18;
        if (f >= 1) {
          p.icon.visible = p.label.visible = false;
          this.pickups.splice(k, 1);
          this.free.push(p);
          this.onArrive?.(p.amount);
          continue;
        }
      }
      if (p.shown !== p.amount) {
        p.shown = p.amount;
        p.label.texture = this.labelTex(Math.min(p.amount, 9999));
      }
      if (clip) setTex(p.icon, clip.frames[clip.frameAt(age)]!);
      p.icon.position.set(Math.round(x), Math.round(y));
      p.label.position.set(Math.round(x) + 7, Math.round(y));
      // The amount reads during the pop and the first part of the flight.
      p.label.visible = age < POP + FLY * 0.45;
    }
  }

  get flying(): number {
    return this.pickups.length;
  }
}
