/**
 * Combat FX: projectiles in flight (state-driven from the sim: tank shells, bazooka rockets,
 * spinning molotovs, gas grenades with trails — arcs drawn from the sim's parabolic height,
 * bazookas aimed at rooftops climb to the roof), area effects (tear-gas clouds composed of
 * puffs from `gasCloudLayout` that grow → boil → fade and drift with rotor wash; fire patches
 * with flicker light), and one-shot FX from sim events (tracers, rubber pellets, explosions,
 * shockwaves, scorch decals, camera flashes, muzzle light at night).
 */
import { Sprite } from 'pixi.js';
import { art, type AnimClip } from '../art/lib/atlas';
import { gasCloudLayout } from '../art/fx';
import { depthKey, tileToWorld } from '../core/iso';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';
import type { DecalLayer } from './decalLayer';
import type { FxSystem } from './fx';
import type { Juice } from './juice';
import type { ViewLayers } from './layers';
import { setTex } from './sprites';
import type { RoofInfo } from './staticView';
import type { ViewRect } from './terrainView';

const SCREEN_DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;

/** Screen direction name for a world-px vector (iso diagonals are 2:1). */
export function screenDir(dx: number, dy: number): (typeof SCREEN_DIRS)[number] {
  const a = Math.atan2(dy * 2, dx);
  let o = Math.round(a / (Math.PI / 4));
  if (o < 0) o += 8;
  return SCREEN_DIRS[o % 8]!;
}

/** Height (px) of one sim "tile" of projectile altitude. */
const Z_PX = 16;

interface ProjEnt {
  sprite: Sprite;
  kind: string;
  trail: number;
  lastX: number;
  lastY: number;
  seen: boolean;
}

interface Puff {
  sprite: Sprite;
  dx: number;
  dy: number;
  variant: string;
  start: number;
}

interface AreaEnt {
  kind: 'gas' | 'fire';
  puffs: Puff[];
  light: Sprite | null;
  smokeT: number;
  seen: boolean;
  born: number;
}

export class CombatView {
  private readonly projs = new Map<number, ProjEnt>();
  private readonly areas = new Map<number, AreaEnt>();
  private readonly spritePool: Sprite[] = [];
  grade = 0xffffff;
  /** Tear gas stays gas-green at night: graded only part of the way. */
  gasTint = 0xffffff;
  darkness = 0;
  private readonly tmp = { x: 0, y: 0 };
  private readonly litXY: number[] = [];
  /** Tracers spawned this frame (budget). */
  private tracerBudget = 0;

  constructor(
    private readonly world: World,
    private readonly layers: ViewLayers,
    private readonly fx: FxSystem,
    private readonly decals: DecalLayer,
    private readonly juice: Juice,
    private readonly roofOfUnitSlot: (slot: number) => RoofInfo | undefined,
    private readonly muzzleOf: (unitId: number, out: { x: number; y: number }) => boolean,
  ) {}

  private take(): Sprite {
    const s = this.spritePool.pop() ?? new Sprite();
    s.visible = true;
    s.alpha = 1;
    s.blendMode = 'normal';
    s.scale.set(1, 1);
    return s;
  }

  private give(s: Sprite): void {
    s.removeFromParent();
    s.visible = false;
    this.spritePool.push(s);
  }

  // ── Events ───────────────────────────────────────────────────────────────────────────

  /** Handle one sim event (call for each drained event). Returns nothing. */
  onEvent(e: SimEvent, now: number, realMs: number, view: ViewRect): void {
    switch (e.type) {
      case 'fired':
        this.onFired(e, now, view);
        break;
      case 'exploded':
        this.onExploded(e, now, realMs, view);
        break;
      case 'flash': {
        const p = tileToWorld(e.x, e.y);
        this.fx.spawn('fx.camflash', p.x, p.y, now, {
          layer: 'entity',
          z: 15,
          emissive: true,
          bias: 3,
        });
        this.fx.spawn('fx.light.halo', p.x, p.y - 15, now, { layer: 'light', life: 0.12 });
        break;
      }
      default:
    }
  }

  private inView(x: number, y: number, view: ViewRect, m = 64): boolean {
    return x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m * 2;
  }

  private onFired(e: Extract<SimEvent, { type: 'fired' }>, now: number, view: ViewRect): void {
    if (e.projectileId >= 0 || e.weapon === 'gasCone') return;
    const t1 = tileToWorld(e.x1, e.y1);
    let sx: number;
    let sy: number;
    if (e.shooterKind === 'unit') {
      if (!this.muzzleOf(e.shooterId, this.tmp)) return;
      sx = this.tmp.x;
      sy = this.tmp.y;
    } else {
      const p = tileToWorld(e.x0, e.y0);
      sx = p.x + 6;
      sy = p.y - 12;
    }
    const tx = t1.x;
    const ty = t1.y - 9;
    if (!this.inView(sx, sy, view) && !this.inView(tx, ty, view)) return;
    if (this.tracerBudget <= 0) return;
    this.tracerBudget--;
    const dx = tx - sx;
    const dy = ty - sy;
    const d = Math.max(1, Math.hypot(dx, dy));
    const dir = screenDir(dx, dy);
    if (e.weapon === 'rubber') {
      const sp = 380;
      this.fx.spawn('fx.pellet', sx, sy, now, {
        layer: 'air',
        loop: true,
        life: d / sp,
        vx: (dx / d) * sp,
        vy: (dy / d) * sp,
        emissive: true,
      });
    } else {
      const long = e.weapon === 'sniper' || e.weapon === 'mg' || e.weapon === 'doorGun';
      const sp = 1100;
      this.fx.spawn(long ? `fx.tracer.long.${dir}` : `fx.tracer.${dir}`, sx, sy, now, {
        layer: 'air',
        life: Math.max(0.05, d / sp),
        vx: (dx / d) * sp,
        vy: (dy / d) * sp,
        emissive: true,
        priority: 0,
      });
      if ((e.tick + e.shooterId) % 3 === 0) {
        this.fx.spawn('fx.impact.dirt', t1.x, t1.y, now + 0.0, {
          layer: 'entity',
          offset: -d / sp,
          priority: 0,
        });
      }
    }
    if (this.darkness > 0.1) {
      this.fx.spawn('fx.light.muzzle', sx, sy, now, {
        layer: 'light',
        life: 0.07,
        alpha: this.darkness,
      });
    }
    if (e.weapon === 'mg' && e.tick % 4 === 0) {
      this.fx.spawn('fx.casing', sx, sy + 4, now, {
        layer: 'entity',
        vx: (e.tick % 2 ? 1 : -1) * 20,
        vz: 40,
        g: 200,
        life: 0.35,
        priority: 0,
      });
    }
  }

  private onExploded(
    e: Extract<SimEvent, { type: 'exploded' }>,
    now: number,
    realMs: number,
    view: ViewRect,
  ): void {
    const p = tileToWorld(e.x, e.y);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const near = this.inView(x, y, view, 120);
    switch (e.kind) {
      case 'molotov':
        this.fx.spawn('fx.molotov.shatter', x, y, now, { layer: 'entity', emissive: true });
        this.fx.spawn('fx.light.fire', x, y, now, {
          layer: 'light',
          life: 0.4,
          fade: 0.3,
          alpha: 0.3,
        });
        break;
      case 'bazooka':
        this.fx.spawn('fx.explosion.medium', x, y, now, {
          layer: 'entity',
          emissive: true,
          priority: 2,
        });
        this.fx.spawn('fx.shockwave.small', x, y, now, { layer: 'ground' });
        this.fx.spawn('fx.light.blast', x, y, now, {
          layer: 'light',
          life: 0.15,
          fade: 0.1,
          alpha: 0.35,
        });
        this.decals.bake(`decal.scorch.${(e.tick % 3) as number}`, x, y);
        if (near) this.juice.shake(2, 0.25);
        break;
      case 'shell':
        this.fx.spawn('fx.explosion.big', x, y, now, {
          layer: 'entity',
          emissive: true,
          priority: 2,
        });
        this.fx.spawn('fx.shockwave.big', x, y, now, { layer: 'ground' });
        this.fx.spawn('fx.light.blast', x, y, now, {
          layer: 'light',
          life: 0.2,
          fade: 0.15,
          alpha: 0.4,
        });
        this.decals.bake(`decal.scorch.${e.tick % 3}`, x, y);
        if (near) {
          this.juice.shake(3, 0.35);
          this.juice.hitStop(40, realMs);
        }
        break;
      case 'prophet':
        this.fx.spawn('fx.explosion.prophet', x, y, now, {
          layer: 'entity',
          emissive: true,
          priority: 2,
        });
        this.fx.spawn('fx.shockwave.big', x, y, now, { layer: 'ground' });
        this.fx.spawn('fx.light.blast', x, y, now, {
          layer: 'light',
          life: 0.25,
          fade: 0.2,
          alpha: 0.4,
        });
        this.decals.bake(`decal.scorch.${e.tick % 3}`, x, y);
        if (near) {
          this.juice.shake(4, 0.45);
          this.juice.hitStop(60, realMs);
        }
        break;
      default:
    }
  }

  // ── Per frame: projectiles & areas ───────────────────────────────────────────────────

  update(now: number, view: ViewRect): void {
    this.tracerBudget = 40;
    this.updateProjectiles(now);
    this.updateAreas(now, view);
  }

  private updateProjectiles(now: number): void {
    for (const pe of this.projs.values()) pe.seen = false;
    for (const p of this.world.projectiles.active) {
      let pe = this.projs.get(p.id);
      const w = tileToWorld(p.x, p.y);
      if (!pe) {
        const s = this.take();
        this.layers.air.addChild(s);
        pe = { sprite: s, kind: p.kind, trail: 0, lastX: w.x, lastY: w.y, seen: true };
        this.projs.set(p.id, pe);
      }
      pe.seen = true;
      const f = Math.min(1, p.t / p.dur);
      let lift = p.z * Z_PX;
      if (p.roofTarget >= 0) {
        const roof = this.roofOfUnitSlot(p.roofTarget);
        if (roof) lift += roof.top * f;
      }
      const x = Math.round(w.x);
      const y = Math.round(w.y);
      const dx = w.x - pe.lastX;
      const dy = w.y - lift - pe.lastY;
      const s = pe.sprite;
      let name: string;
      switch (p.kind) {
        case 'shell':
          name = `fx.tracer.long.${screenDir(dx, dy)}`;
          break;
        case 'bazooka':
          name = `fx.tracer.${screenDir(dx, dy)}`;
          break;
        case 'molotov':
          name = 'fx.molotov.bottle';
          break;
        default:
          name = 'fx.gas.canister';
      }
      if (art.has(name)) {
        const clip = art.anim(name);
        setTex(s, clip.frames[clip.frameAt(now)]!);
      }
      s.position.set(x, y - Math.round(lift));
      s.zIndex = depthKey(x, y);
      s.tint = p.kind === 'gasGrenade' ? this.grade : 0xffffff;
      // Trails.
      if (now - pe.trail > (p.kind === 'gasGrenade' ? 0.05 : 0.07)) {
        pe.trail = now;
        if (p.kind === 'gasGrenade') {
          this.fx.spawn('fx.gas.trail', x, y, now, { layer: 'air', z: lift, priority: 0 });
        } else if (p.kind === 'bazooka' || p.kind === 'shell') {
          this.fx.spawn('fx.smoke.puff', x, y, now, { layer: 'air', z: lift, priority: 0 });
        }
      }
      pe.lastX = w.x;
      pe.lastY = w.y - lift;
    }
    for (const [id, pe] of this.projs) {
      if (pe.seen) continue;
      this.give(pe.sprite);
      this.projs.delete(id);
    }
  }

  private updateAreas(now: number, view: ViewRect): void {
    for (const a of this.areas.values()) a.seen = false;
    // Fire glows placed this frame (x, y pairs): nearby fires share one glow — overlapping
    // additive pools blow out to pink/white.
    const lit = this.litXY;
    lit.length = 0;
    for (const a of this.world.areas.active) {
      let ae = this.areas.get(a.id);
      if (!ae) {
        ae = { kind: a.kind, puffs: [], light: null, smokeT: 0, seen: true, born: now };
        const rx = Math.round(a.r * 22.6);
        // Puff timing follows the area's own age (correct after a time-skip / when paused).
        const born = now - (a.dur - a.ttl);
        if (a.kind === 'gas') {
          const n = Math.max(6, Math.min(12, Math.round(a.r * 4)));
          for (const pl of gasCloudLayout(a.id * 7 + 3, n, rx)) {
            const s = this.take();
            this.layers.entities.addChild(s);
            ae.puffs.push({
              sprite: s,
              dx: pl.dx,
              dy: pl.dy,
              variant: pl.variant,
              start: born + pl.delay,
            });
          }
        } else {
          const n = a.r >= 1.4 ? 4 : a.r >= 0.9 ? 2 : 1;
          for (let k = 0; k < n; k++) {
            const s = this.take();
            this.layers.entities.addChild(s);
            const ang = (k / n) * Math.PI * 2 + a.id;
            const d = k === 0 ? 0 : rx * 0.55;
            ae.puffs.push({
              sprite: s,
              dx: Math.round(Math.cos(ang) * d),
              dy: Math.round(Math.sin(ang) * d * 0.5),
              variant: k === 0 && a.r >= 0.9 ? 'medium' : 'small',
              start: born - k * 0.13,
            });
          }
          const l = this.take();
          l.blendMode = 'add';
          this.layers.lights.addChild(l);
          ae.light = l;
        }
        this.areas.set(a.id, ae);
      }
      ae.seen = true;
      const c = tileToWorld(a.x, a.y);
      const cx = Math.round(c.x);
      const cy = Math.round(c.y);
      const visible =
        cx > view.x0 - 80 && cx < view.x1 + 80 && cy > view.y0 - 60 && cy < view.y1 + 80;
      const left = a.ttl;
      for (const pf of ae.puffs) {
        const s = pf.sprite;
        s.visible = visible;
        if (!visible) continue;
        const x = cx + pf.dx;
        const y = cy + pf.dy;
        let clip: AnimClip;
        let fi: number;
        if (ae.kind === 'gas') {
          const age = now - pf.start;
          if (age < 0) {
            s.visible = false;
            continue;
          }
          const grow = art.anim(`fx.gas.puff.${pf.variant}.grow`);
          const fade = art.anim(`fx.gas.puff.${pf.variant}.fade`);
          if (left < fade.duration + 0.05) {
            clip = fade;
            fi = Math.min(
              fade.frames.length - 1,
              Math.floor((fade.duration + 0.05 - left) * fade.fps),
            );
          } else if (age < grow.duration) {
            clip = grow;
            fi = Math.min(grow.frames.length - 1, Math.floor(age * grow.fps));
          } else {
            clip = art.anim(`fx.gas.puff.${pf.variant}.loop`);
            fi = clip.frameAt(age + pf.dx * 0.01);
          }
          s.tint = this.gasTint;
          s.alpha = 0.9;
        } else {
          clip = art.anim(`fx.fire.patch.${pf.variant}`);
          fi = clip.frameAt(now - pf.start);
          s.tint = 0xffffff;
          s.alpha = Math.min(1, left / 0.5);
        }
        setTex(s, clip.frames[fi]!);
        s.position.set(x, y);
        s.zIndex = depthKey(x, y) + (ae.kind === 'gas' ? 8 : 0);
      }
      if (ae.light) {
        const lc = art.anim('fx.light.fire');
        setTex(ae.light, lc.frames[lc.frameAt(now)]!);
        ae.light.position.set(cx, cy);
        let show = visible && lit.length < 16;
        for (let k = 0; show && k < lit.length; k += 2) {
          if (Math.abs(lit[k]! - cx) < 40 && Math.abs(lit[k + 1]! - cy) < 22) show = false;
        }
        if (show) lit.push(cx, cy);
        ae.light.visible = show;
        ae.light.alpha = (0.03 + 0.24 * this.darkness) * Math.min(1, left / 0.5);
      }
      // Big fires (wrecks) smoke.
      if (ae.kind === 'fire' && a.r >= 1.4 && visible && now - ae.smokeT > 1.4) {
        ae.smokeT = now;
        this.fx.spawn('fx.smoke.column.black', cx, cy, now, {
          layer: 'entity',
          life: 2.2,
          loop: true,
          fade: 0.8,
          bias: 4,
          priority: 0,
        });
      }
    }
    for (const [id, ae] of this.areas) {
      if (ae.seen) continue;
      for (const pf of ae.puffs) this.give(pf.sprite);
      if (ae.light) this.give(ae.light);
      this.areas.delete(id);
    }
  }
}
