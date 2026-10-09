/**
 * Pooled one-shot / timed animated sprites (explosions, tracers, puffs, sparks, KO stars …).
 *
 *   fx.spawn('fx.explosion.big', x, y, { layer: 'entity', emissive: true });
 *   fx.spawn('fx.tracer.e', x0, y0, { z: 8, vx, vy, life: 0.1 });
 *
 * Positions are world px of the ground point; `z` lifts the sprite (height in px). Sprites in
 * the `entity` layer sort by their ground point (or an explicit `depth`). Every update writes
 * integer positions only. No allocation per frame once the pools are warm.
 */
import { Sprite, type Container } from 'pixi.js';
import { art, type AnimClip } from '../art/lib/atlas';
import { depthKey } from '../core/iso';
import type { ViewLayers } from './layers';
import { setTex } from './sprites';

export type FxLayer = 'entity' | 'ground' | 'air' | 'light' | 'overlay' | 'screen';

export interface FxOpts {
  layer?: FxLayer;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Gravity on z (px/s², positive pulls down). */
  g?: number;
  /** Lifetime (s); default = one pass of the clip (or forever for looping clips: give life). */
  life?: number;
  loop?: boolean;
  /** Fade out over the last `fade` seconds. */
  fade?: number;
  flip?: boolean;
  /** Not affected by the day/night grade (fire, flashes). */
  emissive?: boolean;
  /** Explicit sort key (entity/air layers). */
  depth?: number;
  /** Depth bias added to the automatic key. */
  bias?: number;
  alpha?: number;
  tint?: number;
  /** Start this many seconds into the clip. */
  offset?: number;
  /** Hold the last frame instead of disappearing (until life ends). */
  hold?: boolean;
  /** Freeze on a given frame. */
  frame?: number;
  /** Low priority FX are skipped when over budget. */
  priority?: number;
}

export class Fx {
  sprite!: Sprite;
  clip!: AnimClip;
  layer: FxLayer = 'entity';
  alive = false;
  t0 = 0;
  life = 0;
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  g = 0;
  loop = false;
  fade = 0;
  flip = false;
  emissive = false;
  depth: number | null = null;
  bias = 0;
  alpha = 1;
  hold = false;
  frame = -1;
  offset = 0;
  /** User data (e.g. the owning area id). */
  tag = 0;
}

export class FxSystem {
  private readonly active: Fx[] = [];
  /** Per-layer pools: sprites stay attached to their layer (no O(n) removeChild). */
  private readonly free: Record<FxLayer, Fx[]> = {
    entity: [],
    ground: [],
    air: [],
    light: [],
    overlay: [],
    screen: [],
  };
  private readonly containers: Record<FxLayer, Container>;
  budget: number;
  grade = 0xffffff;
  /** Skipped spawns (diagnostics). */
  dropped = 0;

  constructor(layers: ViewLayers, budget = 700) {
    this.budget = budget;
    this.containers = {
      entity: layers.entities,
      ground: layers.bodies,
      air: layers.air,
      light: layers.lights,
      overlay: layers.overlays,
      screen: layers.screen,
    };
  }

  get count(): number {
    return this.active.length;
  }

  spawn(name: string, x: number, y: number, now: number, o: FxOpts = {}): Fx | null {
    if (!art.has(name)) return null;
    if (this.active.length >= this.budget && (o.priority ?? 1) < 2) {
      this.dropped++;
      return null;
    }
    const clip = art.anim(name);
    const layer = o.layer ?? 'entity';
    let f = this.free[layer].pop();
    if (!f) {
      f = new Fx();
      f.sprite = new Sprite();
      this.containers[layer].addChild(f.sprite);
    }
    f.clip = clip;
    f.layer = layer;
    f.alive = true;
    f.t0 = now - (o.offset ?? 0);
    f.loop = o.loop ?? false;
    f.life = o.life ?? (clip.duration > 0 && !f.loop ? clip.duration : 1);
    f.x = x;
    f.y = y;
    f.z = o.z ?? 0;
    f.vx = o.vx ?? 0;
    f.vy = o.vy ?? 0;
    f.vz = o.vz ?? 0;
    f.g = o.g ?? 0;
    f.fade = o.fade ?? 0;
    f.flip = o.flip ?? false;
    f.emissive = o.emissive ?? false;
    f.depth = o.depth ?? null;
    f.bias = o.bias ?? 0;
    f.alpha = o.alpha ?? 1;
    f.hold = o.hold ?? false;
    f.frame = o.frame ?? -1;
    f.tag = 0;
    const s = f.sprite;
    setTex(s, clip.frames[0]!);
    s.alpha = f.alpha;
    s.visible = true;
    s.blendMode = layer === 'light' ? 'add' : 'normal';
    s.tint =
      o.tint ??
      (f.emissive || layer === 'light' || layer === 'overlay' || layer === 'screen'
        ? 0xffffff
        : this.grade);
    this.active.push(f);
    this.place(f, now);
    return f;
  }

  kill(f: Fx): void {
    f.life = -1;
  }

  update(now: number, dt: number): void {
    const list = this.active;
    for (let k = list.length - 1; k >= 0; k--) {
      const f = list[k]!;
      const age = now - f.t0;
      if (age >= f.life || f.life < 0) {
        this.release(f);
        list[k] = list[list.length - 1]!;
        list.pop();
        continue;
      }
      if (dt > 0) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vz -= f.g * dt;
        f.z += f.vz * dt;
      }
      this.place(f, now);
    }
  }

  /** Re-tint graded FX when the grade changes. */
  setGrade(tint: number): void {
    if (tint === this.grade) return;
    this.grade = tint;
    for (const f of this.active) {
      if (!f.emissive && (f.layer === 'entity' || f.layer === 'ground' || f.layer === 'air')) {
        f.sprite.tint = tint;
      }
    }
  }

  private place(f: Fx, now: number): void {
    const s = f.sprite;
    const clip = f.clip;
    const age = now - f.t0;
    // Delayed start (negative offset): invisible until then.
    s.visible = age >= 0;
    if (age < 0) return;
    let fi: number;
    if (f.frame >= 0) fi = Math.min(f.frame, clip.frames.length - 1);
    else if (f.loop) fi = clip.frameAt(age);
    else {
      fi = clip.fps > 0 ? Math.floor(age * clip.fps) : 0;
      if (fi >= clip.frames.length) fi = clip.frames.length - 1;
      else if (fi < 0) fi = 0;
    }
    setTex(s, clip.frames[fi]!);
    const x = Math.round(f.x);
    const gy = Math.round(f.y);
    s.position.set(f.flip ? x + 1 : x, gy - Math.round(f.z));
    s.scale.x = f.flip ? -1 : 1;
    if (f.layer === 'entity' || f.layer === 'air') {
      s.zIndex = f.depth ?? depthKey(x, gy) + f.bias;
    }
    if (f.fade > 0) {
      const left = f.life - age;
      s.alpha = left < f.fade ? (f.alpha * Math.max(0, left)) / f.fade : f.alpha;
    }
  }

  private release(f: Fx): void {
    f.alive = false;
    f.sprite.visible = false;
    this.free[f.layer].push(f);
  }

  clear(): void {
    for (const f of this.active) this.release(f);
    this.active.length = 0;
  }
}
