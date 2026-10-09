/**
 * Game feel: integer-pixel screen shake, hit-stop, floating "+1" Hate fists flying to the HUD,
 * Legitimacy wax-seal pops, level-up confetti.
 *
 * Hate pickups live in screen space (UI scale): they pop at the death's screen position,
 * hover, then fly to `hateTarget` (a screen point the UI provides; top-left by default) and
 * emit `onArrive(amount)` when they land. At most `maxPickups` fly at once; overflow Hate is
 * folded into the next pickup.
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
  hover: number;
  dur: number;
}

export class Juice {
  /** Screen-space container (UI scale applied by the owner). */
  readonly screen = new Container({ label: 'juice' });
  private shakeAmp = 0;
  private shakeT = 0;
  private stopUntil = 0;
  private readonly pickups: Pickup[] = [];
  private readonly free: Pickup[] = [];
  private pendingHate = 0;
  private readonly labels = new Map<number, Texture>();
  /** UI px. */
  hateTarget = { x: 18, y: 14 };
  maxPickups = 28;
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
    if (this.pickups.length >= this.maxPickups) {
      this.pendingHate += amount;
      return;
    }
    amount += this.pendingHate;
    this.pendingHate = 0;
    if (!art.has('fx.pickup.hate')) {
      this.onArrive?.(amount);
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
        hover: 0,
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
    p.hover = 0.35 + ((sx * 7 + sy) % 10) / 50;
    p.dur = 0.55 + Math.min(0.35, Math.hypot(sx - this.hateTarget.x, sy - this.hateTarget.y) / 900);
    p.label.texture = this.labelTex(Math.min(amount, 999));
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
      if (age < p.hover) {
        const f = age / p.hover;
        x = p.x0;
        y = p.y0 - 10 * Math.sin(f * Math.PI * 0.5);
      } else {
        const f = Math.min(1, (age - p.hover) / p.dur);
        const e = f * f * (3 - 2 * f);
        const sx = p.x0;
        const sy = p.y0 - 10;
        x = sx + (this.hateTarget.x - sx) * e;
        y = sy + (this.hateTarget.y - sy) * e - Math.sin(f * Math.PI) * 30;
        if (f >= 1) {
          p.icon.visible = p.label.visible = false;
          this.pickups.splice(k, 1);
          this.free.push(p);
          this.onArrive?.(p.amount);
          continue;
        }
      }
      if (clip) setTex(p.icon, clip.frames[clip.frameAt(age)]!);
      p.icon.position.set(Math.round(x), Math.round(y));
      p.label.position.set(Math.round(x) + 7, Math.round(y));
      p.label.visible = age < p.hover + 0.15;
    }
  }

  get flying(): number {
    return this.pickups.length;
  }
}
