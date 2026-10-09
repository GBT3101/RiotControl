/**
 * The world view: binds a running `World` (sim) to Pixi sprites. Owns the layer stack and all
 * sub-views (terrain, static city, crowd, units, bodies, combat FX, ambient life, overlays,
 * juice), turns drained sim events into FX + bus events, and applies the day/night grade.
 *
 *   const view = new WorldView(stage, world, cityArt, { quality, bus });
 *   loop.render = (alpha, dtMs) => { view.frame(camera.view(), alpha, dtMs, performance.now(), ui) };
 */
import type { Renderer } from 'pixi.js';
import { CAPITOL_ART, SECONDARY } from '../art/landmarks';
import type { EventBus } from '../core/events';
import { tileToWorld, type CameraView } from '../core/iso';
import type { QualityTier } from '../data/balance';
import type { GameEventMap } from '../game/events';
import type { CityArt } from '../game/assets';
import { LANDMARKS, type LandmarkId } from '../maps/contract';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';
import { AmbientView } from './ambient';
import { BodyView, type ThrowInfo } from './bodyView';
import { CombatView } from './combatView';
import { gradeAt, mixColor, PREP_TOD, stepTod, targetTod, type Grade } from './daylight';
import { DecalLayer } from './decalLayer';
import { FxSystem } from './fx';
import { Juice } from './juice';
import { createViewLayers, type ViewLayers } from './layers';
import { occlusionGrid, type Box } from './occlusion';
import { OverlayView, type OverlayState } from './overlays';
import { ProtesterView } from './protesterView';
import { StaticView } from './staticView';
import { TerrainView, type ViewRect } from './terrainView';
import { UNIT_ART, UnitView, resetClipCache } from './unitView';
import { uiScale } from '../render/zoom';
import type { PixelStage } from '../render/stage';

export interface WorldViewOptions {
  quality: QualityTier;
  bus: EventBus<GameEventMap>;
  /** Force a time of day (0..1). */
  tod?: number;
}

export interface ViewStats {
  protesters: number;
  bodies: number;
  fx: number;
  chunks: number;
  decals: number;
}

export class WorldView {
  readonly layers: ViewLayers;
  readonly fx: FxSystem;
  readonly juice = new Juice();
  readonly decals: DecalLayer;
  readonly terrain: TerrainView;
  readonly statics: StaticView;
  readonly protesters: ProtesterView;
  readonly units: UnitView;
  readonly bodies: BodyView;
  readonly combat: CombatView;
  readonly ambient: AmbientView;
  readonly overlays: OverlayView;
  private readonly occ: Uint8Array;
  private readonly renderer: Renderer;
  private tod = PREP_TOD;
  private lastTodEmit = -1;
  grade: Grade = gradeAt(PREP_TOD);
  private gradeQ = -1;
  private readonly rect: ViewRect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private uiK = 1;
  private lastView: CameraView = { x: 0, y: 0, zoom: 1, width: 1, height: 1 };
  private readonly pendingThrows = new Map<string, ThrowInfo>();
  /** View clock (interpolated sim seconds). */
  now = 0;

  constructor(
    private readonly stage: PixelStage,
    private readonly world: World,
    private readonly cityArt: CityArt,
    private readonly opts: WorldViewOptions,
  ) {
    this.renderer = stage.app.renderer as Renderer;
    const map = world.map;
    this.layers = createViewLayers(stage.app.stage);
    const q = opts.quality;
    this.fx = new FxSystem(this.layers, q === 'desktop' ? 900 : q === 'mobile' ? 400 : 220);
    this.decals = new DecalLayer(this.renderer, map.w, map.h);
    this.layers.decals.addChild(this.decals.sprite);
    this.terrain = new TerrainView(this.layers.terrain, cityArt.terrain);
    this.statics = new StaticView(map, cityArt, this.layers);
    this.occ = this.buildOcclusion();
    const occluded = (x: number, y: number): boolean => {
      const u = Math.floor(y / 16 + x / 32);
      const v = Math.floor(y / 16 - x / 32);
      if (u < 0 || v < 0 || u >= map.w || v >= map.h) return false;
      return this.occ[v * map.w + u] === 1;
    };
    this.protesters = new ProtesterView(
      world,
      cityArt.manifest,
      this.layers.entities,
      this.layers.ghostsEnemy,
      {
        occluded: q === 'low' ? undefined : occluded,
        roof: (b) => this.statics.roof(b),
        roofTop: (b) => this.statics.roof(b)?.top ?? (map.buildings[b]?.storeys ?? 3) * 10,
      },
    );
    this.units = new UnitView(world, this.layers, (b) => this.statics.roof(b), occluded);
    this.units.onBlockadeGone = (tiles, axis) => {
      // Burst on every tile, rubble stump left as a decal.
      for (const t of tiles) {
        const ti = t % map.w;
        const p = tileToWorld(ti, (t - ti) / map.w);
        const name = `unit.blockade.burst.${axis}`;
        this.fx.spawn(name, p.x, p.y, this.now, { layer: 'entity', bias: 2, priority: 2 });
        this.decals.bake(name, p.x, p.y, { frame: 6 });
      }
    };
    this.bodies = new BodyView(
      world,
      this.layers,
      this.protesters.variants,
      this.fx,
      this.decals,
      q === 'desktop' ? 600 : q === 'mobile' ? 300 : 150,
    );
    this.combat = new CombatView(
      world,
      this.layers,
      this.fx,
      this.decals,
      this.juice,
      (slot) => {
        const u = world.units.at(slot);
        return u && u.building >= 0 ? this.statics.roof(u.building) : undefined;
      },
      (id, out) => this.units.muzzle(id, out),
    );
    this.units.onGasPuff = (u, x, y) => {
      const d = 14 + ((this.world.tick * 13) % 30);
      this.fx.spawn('fx.gas.trail', x + u.aimX * d - u.aimY * d * 0.2, y + (u.aimX + u.aimY) * d * 0.25, this.now, {
        layer: 'entity',
        z: 6,
        vx: (u.aimX - u.aimY) * 14,
        vy: (u.aimX + u.aimY) * 7,
        priority: 0,
      });
    };
    this.ambient = new AmbientView(world, map, this.layers, this.fx, this.decals);
    this.ambient.placeCars();
    this.overlays = new OverlayView(world, this.layers.overlays, (id) => this.units.entity(id));
    this.layers.screen.addChild(this.juice.screen);
    if (q !== 'low') {
      // X-ray silhouettes: team-tinted translucent copies (crisp; filter passes blur/bleed).
      this.layers.ghostsAlly.tint = 0x4f7dff;
      this.layers.ghostsEnemy.tint = 0xff4a3a;
      this.layers.ghostsAlly.alpha = 0.6;
      this.layers.ghostsEnemy.alpha = 0.3;
    } else {
      this.layers.ghostsAlly.visible = this.layers.ghostsEnemy.visible = false;
    }
    this.juice.onArrive = (amount) => opts.bus.emit('hatePickupArrived', { amount });
    this.statics.setCapitolState(world.capitol.state);
    if (opts.tod !== undefined) this.tod = opts.tod;
  }

  private buildOcclusion(): Uint8Array {
    const map = this.world.map;
    const boxes: Box[] = [];
    for (const b of map.buildings) {
      const info = this.cityArt.buildings.get(b.id);
      boxes.push({ i: b.i, j: b.j, w: b.w, d: b.d, h: info ? info.height : b.storeys * 10 });
    }
    const cap = map.capitol;
    boxes.push({ i: cap.i, j: cap.j, w: cap.w, d: cap.d, h: Math.round(CAPITOL_ART[map.city].top * 0.6) });
    for (const lm of map.landmarks) {
      const def = LANDMARKS[lm.id as LandmarkId];
      const art = SECONDARY[lm.id as LandmarkId];
      if (!def || !art) continue;
      // Thin monuments (columns, statues) hardly hide anyone.
      const h = def.w * def.d <= 4 ? 10 : Math.round(art.top * 0.6);
      boxes.push({ i: lm.i, j: lm.j, w: def.w, d: def.d, h });
    }
    return occlusionGrid(map.w, map.h, boxes, (t) => !this.world.nav.walk[t]);
  }

  /** Deferred art arrived (vehicles, late protester types). */
  onArtUpdated(): void {
    resetClipCache();
    this.protesters.variants.rebuild(this.cityArt.manifest);
    this.ambient.placeCars();
    this.statics.refreshCapitol();
  }

  /** World point under a screen point (device px). */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const v = this.lastView;
    return {
      x: v.x + (sx - Math.floor(v.width / 2)) / v.zoom - this.juice.ox,
      y: v.y + (sy - Math.floor(v.height / 2)) / v.zoom - this.juice.oy,
    };
  }

  /** UI px of a world point (for screen-space FX). */
  worldToUi(x: number, y: number): { x: number; y: number } {
    const v = this.lastView;
    return {
      x: ((x - v.x) * v.zoom + Math.floor(v.width / 2)) / this.uiK,
      y: ((y - v.y) * v.zoom + Math.floor(v.height / 2)) / this.uiK,
    };
  }

  /** Unit id at a world point, or -1. */
  pickUnit(x: number, y: number): number {
    return this.units.pick(x, y);
  }

  get stats(): ViewStats {
    return {
      protesters: this.protesters.visibleCount,
      bodies: this.bodies.count,
      fx: this.fx.count,
      chunks: this.terrain.visible,
      decals: this.decals.baked,
    };
  }

  get timeOfDay(): number {
    return this.tod;
  }

  // ── Events ───────────────────────────────────────────────────────────────────────────

  /** Feed a drained batch of sim events (before `frame`). */
  onEvents(events: readonly SimEvent[], realMs: number): void {
    const now = this.now;
    const v = this.rect;
    for (const e of events) {
      switch (e.type) {
        case 'attacked':
          if (e.targetKind === 'protester') this.protesters.onHit(e.targetId, now);
          break;
        case 'spawned':
          if (e.building >= 0) this.protesters.onSpawn(e.handle, now);
          break;
        case 'flash':
          this.protesters.onFlash(e.handle, now);
          break;
        case 'died':
          this.bodies.note(e.bodyId, {
            fresh: true,
            vi: this.protesters.variantOfHandle(e.handle),
            lethal: e.lethal,
          });
          break;
        case 'thrownOffRoof': {
          const roof = this.statics.roof(e.building);
          const p = tileToWorld(e.fromX, e.fromY);
          this.pendingThrows.set(`${e.unitId}:${e.member}`, {
            fromX: roof?.x ?? Math.round(p.x),
            fromY: roof?.y ?? Math.round(p.y),
            top: roof?.top ?? e.height * 10,
            member: e.member,
            art: UNIT_ART[e.unit],
          });
          this.protesters.onHeave(e.building, now);
          break;
        }
        case 'unitDied': {
          const th = this.pendingThrows.get(`${e.unitId}:${e.member}`);
          this.pendingThrows.delete(`${e.unitId}:${e.member}`);
          this.bodies.note(e.bodyId, { fresh: true, vi: -1, lethal: e.lethal, thrown: th });
          this.onUnitDied(e, now);
          break;
        }
        case 'unitDeployed': {
          this.units.onDeployed(e.unitId, now);
          const p = tileToWorld(e.x, e.y);
          if (e.unit !== 'heli' && e.building < 0) {
            this.fx.spawn('fx.dust.land', p.x, p.y, now + 0.25, { layer: 'ground', offset: -0.25 });
          }
          break;
        }
        case 'abilityUsed':
          this.units.onAbilityUsed(e.unitId, now);
          break;
        case 'capitolState':
          this.statics.setCapitolState(e.state);
          this.juice.shake(2, 0.3);
          break;
        case 'hateGained':
          if (e.reason === 'protester' || e.reason === 'unit') {
            const p = tileToWorld(e.x, e.y);
            if (p.x > v.x0 && p.x < v.x1 && p.y > v.y0 && p.y < v.y1) {
              const s = this.worldToUi(p.x, p.y - 14);
              this.juice.hate(e.amount, s.x, s.y, realMs / 1000);
            } else this.opts.bus.emit('hatePickupArrived', { amount: e.amount });
          } else this.opts.bus.emit('hatePickupArrived', { amount: e.amount });
          break;
        case 'legitGained': {
          const p = tileToWorld(e.x, e.y);
          this.fx.spawn('fx.seal.pop', p.x, p.y - 20, now, { layer: 'overlay', priority: 2 });
          break;
        }
        case 'levelUp':
          this.confetti(realMs);
          break;
        default:
      }
      this.combat.onEvent(e, now, realMs, v);
    }
  }

  private onUnitDied(e: Extract<SimEvent, { type: 'unitDied' }>, now: number): void {
    const p = tileToWorld(e.x, e.y);
    if (e.unit === 'humvee' || e.unit === 'tank') {
      this.fx.spawn('fx.explosion.big', p.x, p.y, now, { layer: 'entity', emissive: true, priority: 2 });
      this.fx.spawn('fx.light.blast', p.x, p.y, now, { layer: 'light', life: 0.25, fade: 0.2 });
      this.juice.shake(3, 0.4);
    }
  }

  private confetti(realMs: number): void {
    const s = this.stage.size;
    const w = s.width / this.uiK;
    for (let k = 0; k < 5; k++) {
      this.fx.spawn('fx.confetti.burst', Math.round((w * (k + 1)) / 6), 70 + (k % 2) * 20, realMs / 1000, {
        layer: 'screen',
        offset: -k * 0.12,
      });
    }
  }

  // ── Frame ────────────────────────────────────────────────────────────────────────────

  frame(cam: CameraView, alpha: number, dtSim: number, realDt: number, realMs: number, ui: OverlayState): void {
    const w = this.world;
    this.now = w.time + alpha * w.dt;
    const now = this.now;
    this.lastView = cam;
    // UI scale for the screen layer.
    const s = this.stage.size;
    this.uiK = uiScale(Math.min(s.cssWidth, s.cssHeight), s.dpr);
    this.layers.screen.scale.set(this.uiK);
    // Camera + integer shake.
    this.juice.update(realDt, realMs / 1000);
    const zoom = cam.zoom;
    this.layers.world.scale.set(zoom);
    this.layers.world.position.set(
      Math.floor(cam.width / 2) - (cam.x - this.juice.ox) * zoom,
      Math.floor(cam.height / 2) - (cam.y - this.juice.oy) * zoom,
    );
    const hw = cam.width / 2 / zoom;
    const hh = cam.height / 2 / zoom;
    const r = this.rect;
    r.x0 = cam.x - hw - 8;
    r.x1 = cam.x + hw + 8;
    r.y0 = cam.y - hh - 8;
    r.y1 = cam.y + hh + 8;
    // Time of day & grade.
    this.updateDaylight(dtSim);
    // Views.
    this.terrain.update(now, r);
    this.statics.update(now, r, this.grade.hour);
    this.protesters.lod = this.opts.quality === 'low' || (zoom <= 2 && w.crowd.count > 1600);
    this.protesters.update(now, alpha, r);
    this.units.update(now, alpha, r);
    this.bodies.update(now, r);
    this.combat.update(now, r);
    this.ambient.update(now, dtSim, r);
    this.fx.update(now, dtSim);
    this.overlays.update(ui, now);
    this.decals.flush();
  }

  private updateDaylight(dt: number): void {
    const w = this.world;
    if (this.opts.tod === undefined) {
      const d = w.director;
      let frac = 0;
      if (d.phase === 'wave') {
        const spawned = d.waveSize > 0 ? 1 - d.pending / d.waveSize : 1;
        frac = 0.65 * spawned;
      } else if (d.phase === 'breather') {
        frac = 0.65 + 0.35 * (1 - d.breather / Math.max(1, d.breatherTotal));
      }
      this.tod = stepTod(this.tod, targetTod(d.wave, frac), dt);
    }
    const g = gradeAt(this.tod);
    // Quantise so static sprites re-tint at most a few times per second of transition.
    const q =
      ((((g.tint >> 16) & 255) >> 2) << 16) | ((((g.tint >> 8) & 255) >> 2) << 8) | ((g.tint & 255) >> 2);
    const dq = Math.round(g.darkness * 40);
    if (q !== this.gradeQ || dq !== Math.round(this.grade.darkness * 40)) {
      this.gradeQ = q;
      const tint = ((q >> 16) << 18) | (((q >> 8) & 255) << 10) | ((q & 255) << 2) | 0x030303;
      this.grade = { tint: g.tint === 0xffffff ? 0xffffff : tint, darkness: g.darkness, hour: g.hour };
      const t = this.grade.tint;
      this.layers.terrain.tint = t;
      this.layers.decals.tint = t;
      this.layers.bodies.tint = t;
      this.fx.setGrade(t);
      this.statics.setGrade(t, g.darkness);
      // People & vehicles stay a little brighter than the city so they read at night.
      const pt = mixColor(t, 0xffffff, 0.3);
      this.protesters.grade = pt;
      this.units.grade = pt;
      this.units.darkness = g.darkness;
      this.bodies.grade = t;
      this.combat.grade = t;
      this.combat.darkness = g.darkness;
      this.ambient.grade = t;
      this.ambient.darkness = g.darkness;
    } else this.grade.hour = g.hour;
    if (Math.abs(this.tod - this.lastTodEmit) > 0.01) {
      this.lastTodEmit = this.tod;
      this.opts.bus.emit('timeOfDay', { tod: this.tod, hour: g.hour, darkness: g.darkness });
    }
  }
}
