/**
 * Special-skill FX and aim / paint guides (docs/specials.md, docs/art/specials.md).
 *
 * Sim events → the composition recipes of `art/fx/specialRecipes.ts`: `skillUsed` lays out a
 * skill's whole timeline (ram lane flash + gallop dust, rapid-fire casings, the frag throw, the
 * missile flight, the air-strike rockets) and `skillHit` / `skillShot` add the per-hit pieces
 * (bowled protesters, tracers) plus screen shake / hit-stop on the blasts, timed by the sim. The
 * recipes' delayed spawns are queued here and started when due on the view clock (so they hold
 * while paused or in hit-stop); their decals (scorch, craters) are baked into the decal layer
 * when due. Juice respects the reduced-motion setting.
 *
 * Guides (all on the overlay layer, above the units): the ram lane before the gallop, the tank's
 * range ring + reticle + blast preview in aim mode, and the painted air-strike line while
 * painting and during the run. `guide` is set by the controller every frame.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { art } from '../art/lib/atlas';
import type { PixelBuffer } from '../art/lib/pixels';
import type { Framed } from '../art/fx/specialBlasts';
import { guideRing, ramLane, strikeLine } from '../art/fx/specialGuides';
import {
  airStrikeRecipe,
  fragThrowRecipe,
  missileRecipe,
  ramHitSpawns,
  ramTrailRecipe,
  type FxRecipe,
  type FxSpawn,
} from '../art/fx/specialRecipes';
import { bufferTexture } from '../art/uikit/pixi';
import { tileToWorld } from '../core/iso';
import { abilityOf, UNITS } from '../data/units';
import type { SimEvent } from '../sim/events';
import { screenDir } from './combatView';
import type { DecalLayer } from './decalLayer';
import type { FxSystem } from './fx';
import type { Juice } from './juice';
import type { ViewLayers } from './layers';
import type { ViewRect } from './terrainView';

/** What the controller's aim / paint session shows (tile coords). */
export interface SkillGuide {
  mode: 'aim' | 'paint';
  unitId: number;
  /** The aiming unit (range ring centre) and the aim range (tiles). */
  ox: number;
  oy: number;
  range: number;
  target: { u: number; v: number } | null;
  reticle: 'idle' | 'locked' | 'invalid' | null;
  /** Blast preview radius (tiles; 0 = none). */
  blast: number;
  /** Paint: the stroke (flat tile coords), bumped `strokeVersion` on change. */
  stroke: readonly number[];
  strokeVersion: number;
  painting: boolean;
  maxLen: number;
  width: number;
  /** Voided by a pinch (greyed). */
  invalid: boolean;
  tooLong: boolean;
}

interface UnitLookup {
  /** Ground point (world px) and lift of a unit's sprite. */
  entity(id: number): { x: number; y: number; lift: number } | undefined;
  muzzle(id: number, out: { x: number; y: number }): boolean;
}

interface Pending {
  at: number;
  s: FxSpawn;
}

/** A painted guide shown for a while (ram lane, strike line during the run). */
interface TimedGuide {
  sprite: Sprite;
  frames: Texture[];
  fps: number;
  t0: number;
  until: number;
}

const P = { x: 0, y: 0 };
const M = { x: 0, y: 0 };

/** World px (rounded) of a tile point. */
function wp(u: number, v: number): { x: number; y: number } {
  tileToWorld(u, v, P);
  return { x: Math.round(P.x), y: Math.round(P.y) };
}

function textures(f: Framed, label: string): Texture[] {
  return f.frames.map((b: PixelBuffer) => bufferTexture(b, label));
}

export class SkillView {
  /** Aim / paint session guides (set by the controller each frame; null = none). */
  guide: SkillGuide | null = null;
  private readonly root = new Container({ label: 'skill-guides' });
  private readonly pending: Pending[] = [];
  private readonly decalsDue: Pending[] = [];
  private readonly timed: TimedGuide[] = [];
  /** Recipe of each unit's skill in flight (shake / hit-stop when its blast lands). */
  private readonly recipes = new Map<number, FxRecipe>();
  // Aim mode.
  private readonly ring = new Sprite();
  private ringFrames: Texture[] = [];
  private ringRange = 0;
  private readonly reticle = new Sprite();
  private readonly blast = new Sprite();
  // Paint mode.
  private readonly line = new Sprite();
  private lineFrames: Texture[] = [];
  private lineKey = '';
  private lineAt = -1;
  private lineReal = 0;

  constructor(
    layers: ViewLayers,
    private readonly fx: FxSystem,
    private readonly decals: DecalLayer,
    private readonly juice: Juice,
    private readonly units: UnitLookup,
  ) {
    for (const s of [this.ring, this.blast, this.line, this.reticle]) {
      s.visible = false;
      this.root.addChild(s);
    }
    layers.overlays.addChild(this.root);
  }

  // ── Events ───────────────────────────────────────────────────────────────────────────

  onEvent(e: SimEvent, now: number, realMs: number, view: ViewRect): void {
    switch (e.type) {
      case 'skillUsed':
        this.onUsed(e, now);
        break;
      case 'skillHit':
        this.onHit(e, now, realMs, view);
        break;
      case 'skillShot':
        this.onShot(e, now);
        break;
      default:
    }
  }

  /** Queue a recipe's spawns `t0` s from now (its decals too). */
  private play(r: FxRecipe, now: number, t0 = 0): void {
    for (const s of r.spawns) {
      const at = now + t0 + s.delay;
      (s.decal ? this.decalsDue : this.pending).push({ at, s });
    }
  }

  private onUsed(e: Extract<SimEvent, { type: 'skillUsed' }>, now: number): void {
    const from = wp(e.x0, e.y0);
    const to = wp(e.x1, e.y1);
    const ent = this.units.entity(e.unitId);
    switch (e.skill) {
      case 'ram': {
        // Lane flash during the wind-up, then the gallop dust and hoof puffs.
        const lane = ramLane(to.x - from.x, to.y - from.y, e.radius);
        this.showTimed(lane, from.x, from.y, now, now + e.impactAt + 0.15, 12);
        this.play(ramTrailRecipe(from, to, e.dur - e.impactAt), now, e.impactAt);
        break;
      }
      case 'rapidFire': {
        const left = to.x < from.x;
        this.spawn(
          {
            name: `fx.special.rapid.casings.${left ? 'w' : 'e'}`,
            x: from.x,
            y: from.y + 1,
            delay: 0,
            layer: 'entity',
          },
          now,
        );
        break;
      }
      case 'fragGrenade': {
        const ab = abilityOf(UNITS.soldier, 'fragGrenade');
        const hand = { x: from.x + 2, y: from.y, z: (ent?.lift ?? 0) + 12 };
        const r = fragThrowRecipe(hand, to, { seed: e.seed, radius: e.radius, fuse: ab?.fuse });
        this.recipes.set(e.unitId, r);
        this.play(r, now);
        break;
      }
      case 'missile': {
        const m = this.units.muzzle(e.unitId, M) ? M : { x: from.x, y: from.y - 14 };
        const z = Math.max(4, (ent?.y ?? from.y) - m.y);
        const r = missileRecipe({ x: m.x, y: m.y + z, z }, to, { seed: e.seed, radius: e.radius });
        this.recipes.set(e.unitId, r);
        this.play(r, now);
        break;
      }
      case 'airStrike': {
        const pts: { x: number; y: number }[] = [];
        const path = e.path ?? [e.x0, e.y0, e.x1, e.y1];
        for (let k = 0; k + 1 < path.length; k += 2) pts.push(wp(path[k]!, path[k + 1]!));
        const ab = abilityOf(UNITS.heli, 'airStrike');
        const r = airStrikeRecipe(pts, {
          seed: e.seed,
          width: e.radius,
          lead: e.lead,
          spacing: ab?.spacing,
          cadence: ab?.cadence,
        });
        this.recipes.set(e.unitId, r);
        this.play(r, now);
        // The painted line stays on the street until the last rocket lands.
        const last = r.impacts[r.impacts.length - 1]?.t ?? e.lead;
        const line = strikeLine(pts, { width: e.radius, maxLen: (ab?.maxLength ?? 14) + 1 });
        this.showTimed(line, pts[0]!.x, pts[0]!.y, now, now + last + 0.1, 8);
        break;
      }
      default:
    }
  }

  private onHit(
    e: Extract<SimEvent, { type: 'skillHit' }>,
    now: number,
    realMs: number,
    view: ViewRect,
  ): void {
    const p = wp(e.x, e.y);
    if (e.skill === 'ram') {
      const rider = this.units.entity(e.unitId);
      const left = rider ? p.x < rider.x : e.index % 2 === 0;
      for (const s of ramHitSpawns(p, left, 0)) this.spawn(s, now);
      return;
    }
    if (e.skill === 'airStrike' && e.index > 0) return;
    const r = this.recipes.get(e.unitId);
    if (e.skill !== 'airStrike') this.recipes.delete(e.unitId);
    const near =
      p.x > view.x0 - 160 && p.x < view.x1 + 160 && p.y > view.y0 - 120 && p.y < view.y1 + 160;
    if (!r || !near) return;
    this.juice.shake(r.shake, r.shakeTime);
    if (r.hitStopMs > 0) this.juice.hitStop(r.hitStopMs, realMs);
  }

  private onShot(e: Extract<SimEvent, { type: 'skillShot' }>, now: number): void {
    const t = wp(e.x1, e.y1);
    const m = this.units.muzzle(e.unitId, M) ? M : { x: t.x, y: t.y - 12 };
    const tx = t.x;
    const ty = t.y - 9;
    const dx = tx - m.x;
    const dy = ty - m.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const dir = screenDir(dx, dy);
    const life = Math.max(0.03, d / 700);
    this.fx.spawn(`fx.special.rapid.flash.${dir}`, m.x, m.y, now, {
      layer: 'air',
      emissive: true,
      priority: 2,
    });
    this.fx.spawn('fx.light.muzzle', m.x, m.y, now, { layer: 'light', life: 0.06, alpha: 0.5 });
    this.fx.spawn(`fx.special.rapid.tracer.${dir}`, m.x, m.y, now, {
      layer: 'air',
      vx: dx / life,
      vy: dy / life,
      life,
      emissive: true,
      priority: 2,
    });
    this.fx.spawn('fx.impact.dirt', tx, t.y, now, { layer: 'entity', offset: -life, priority: 1 });
  }

  private spawn(s: FxSpawn, now: number, late = 0): void {
    // A late start (frame hitch) catches up: the clip and the motion skip ahead.
    const k = Math.min(late, 0.1);
    this.fx.spawn(s.name, s.x + (s.vx ?? 0) * k, s.y + (s.vy ?? 0) * k, now, {
      layer: s.layer,
      z: (s.z ?? 0) + (s.vz ?? 0) * k,
      vx: s.vx,
      vy: s.vy,
      vz: s.vz,
      g: s.g,
      life: s.life,
      fade: s.fade,
      flip: s.flip,
      loop: s.loop,
      emissive: s.emissive,
      alpha: s.alpha,
      offset: k,
      priority: 2,
    });
  }

  private showTimed(
    f: Framed,
    x: number,
    y: number,
    now: number,
    until: number,
    fps: number,
  ): void {
    const frames = textures(f, 'skill-guide');
    const sprite = new Sprite(frames[0]!);
    sprite.anchor.set(f.anchor.x / f.frames[0]!.w, f.anchor.y / f.frames[0]!.h);
    sprite.position.set(Math.round(x), Math.round(y));
    this.root.addChildAt(sprite, 0);
    this.timed.push({ sprite, frames, fps, t0: now, until });
  }

  // ── Frame ────────────────────────────────────────────────────────────────────────────

  update(now: number, realMs: number): void {
    // Due spawns and decals.
    this.flushDue(this.pending, now, (p) => this.spawn(p.s, now, now - p.at));
    this.flushDue(this.decalsDue, now, (p) => this.decals.bake(p.s.name, p.s.x, p.s.y));
    for (let k = this.timed.length - 1; k >= 0; k--) {
      const g = this.timed[k]!;
      if (now >= g.until) {
        g.sprite.destroy();
        for (const t of g.frames) t.destroy(true);
        this.timed.splice(k, 1);
        continue;
      }
      g.sprite.texture = g.frames[Math.floor((now - g.t0) * g.fps) % g.frames.length]!;
    }
    this.updateGuide(realMs);
  }

  private flushDue(list: Pending[], now: number, run: (p: Pending) => void): void {
    if (list.length === 0) return;
    let keep = 0;
    for (const p of list) {
      if (p.at <= now) run(p);
      else list[keep++] = p;
    }
    list.length = keep;
  }

  private updateGuide(realMs: number): void {
    const g = this.guide;
    const t = realMs / 1000;
    const aim = g?.mode === 'aim';
    const paint = g?.mode === 'paint';
    this.ring.visible = this.reticle.visible = this.blast.visible = false;
    this.line.visible = paint && g.stroke.length >= 4;
    if (!g) {
      this.lineKey = '';
      return;
    }
    if (aim) {
      // Range ring around the tank (painted once per range: ~10 ms).
      if (g.range > 0) {
        if (this.ringRange !== g.range) {
          for (const tx of this.ringFrames) tx.destroy(true);
          const f = guideRing(g.range, 'range');
          this.ringFrames = textures(f, 'skill-ring');
          this.ring.anchor.set(f.anchor.x / f.frames[0]!.w, f.anchor.y / f.frames[0]!.h);
          this.ringRange = g.range;
        }
        const o = wp(g.ox, g.oy);
        this.ring.position.set(o.x, o.y);
        this.ring.texture = this.ringFrames[Math.floor(t * 4) % this.ringFrames.length]!;
        this.ring.visible = true;
      }
      if (g.target && g.reticle) {
        const p = wp(g.target.u, g.target.v);
        const rn = `ui.special.missile.reticle.${g.reticle}`;
        if (art.has(rn)) {
          const clip = art.anim(rn);
          this.reticle.texture = clip.frames[clip.frameAt(t)]!;
          this.reticle.position.set(p.x, p.y);
          this.reticle.visible = true;
        }
        if (g.reticle !== 'invalid' && g.blast > 0 && art.has('ui.special.missile.blast')) {
          const clip = art.anim('ui.special.missile.blast');
          this.blast.texture = clip.frames[clip.frameAt(t)]!;
          this.blast.position.set(p.x, p.y);
          this.blast.visible = true;
        }
      }
      return;
    }
    // Paint: repaint the line when the stroke changed — at most every 50 ms while the finger
    // moves (1 frame), and once more (4 marching frames) when it rests.
    if (g.stroke.length < 4) return;
    const key = `${g.strokeVersion}:${g.invalid}:${g.painting}`;
    const resting = !g.painting && key !== this.lineKey;
    if (key !== this.lineKey && (resting || t - this.lineReal >= 0.05)) {
      this.lineKey = key;
      this.lineReal = t;
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k + 1 < g.stroke.length; k += 2) pts.push(wp(g.stroke[k]!, g.stroke[k + 1]!));
      const f = strikeLine(pts, {
        maxLen: g.maxLen,
        width: g.width,
        state: g.invalid ? 'invalid' : 'valid',
        frames: g.painting ? 1 : 4,
      });
      for (const tx of this.lineFrames) tx.destroy(true);
      this.lineFrames = textures(f, 'skill-line');
      this.line.anchor.set(f.anchor.x / f.frames[0]!.w, f.anchor.y / f.frames[0]!.h);
      this.line.position.set(pts[0]!.x, pts[0]!.y);
      this.lineAt = t;
    }
    if (this.lineFrames.length > 0)
      this.line.texture =
        this.lineFrames[Math.floor((t - this.lineAt) * 8) % this.lineFrames.length]!;
  }

  destroy(): void {
    for (const g of this.timed) for (const t of g.frames) t.destroy(true);
    for (const t of [...this.ringFrames, ...this.lineFrames]) t.destroy(true);
    this.root.destroy({ children: true });
  }
}
