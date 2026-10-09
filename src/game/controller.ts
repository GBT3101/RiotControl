/**
 * GameController — the API the UI (M9), tutorial (M10) and audio (M11) build on.
 *
 * Owns one running game: the simulation (`world`), the fixed-step loop, the camera + pointer
 * input, the world view, the typed event bus and the player's interaction state (deploy mode,
 * selection). Every player action goes through a method here; every observable change is an
 * event on `bus` (all sim events + view events, see game/events.ts). Pointer taps/hovers from
 * the camera controller are routed to `tap()` / `hover()` (the UI can call them too).
 *
 *   const game = new GameController(stage, world, cityArt, { quality, ... });
 *   game.bus.on('levelUp', (e) => showUnlockCard(e.units[0]));
 *   game.beginDeploy('riot');          // valid tiles glow, ghost follows the cursor
 *   game.tapTile(i, j);                // or a click on the canvas
 *   game.hud();                        // HUD snapshot (Hate, Legitimacy, wave, crowd, …)
 *   game.start();
 */
import { EventBus } from '../core/events';
import { FixedStepLoop, TIME_SCALES } from '../core/loop';
import { mapWorldBounds, tileToWorld } from '../core/iso';
import type { QualityTier } from '../data/balance';
import { LEVELS, WIN_LEGITIMACY } from '../data/levels';
import { UNITS, UNIT_ORDER, type UnitId } from '../data/units';
import { Camera } from '../render/camera';
import { CameraController, type PointerInfo, type TapEvent } from '../render/cameraInput';
import type { PixelStage } from '../render/stage';
import { zoomRange } from '../render/zoom';
import { Bot, type BotKind } from '../sim/headless';
import type { SimEvent } from '../sim/events';
import type { Unit } from '../sim/units';
import type { World } from '../sim/world';
import type { DirectorPhase } from '../sim/director';
import { WorldView } from '../view/worldView';
import { FrameGovernor } from './governor';
import type { CityArt } from './assets';
import type { GameEventMap } from './events';

export interface ControllerOptions {
  quality: QualityTier;
  /** A bot plays (debug / screenshots). */
  autoplay?: boolean;
  /** Autoplay strategy (default escalate). */
  bot?: BotKind;
  /** Force a time of day (0..1). */
  tod?: number;
  zoom?: number;
  /** Dynamic quality fallback when frames stay slow (default on; see game/governor.ts). */
  governor?: boolean;
  camU?: number;
  camV?: number;
}

/** What the HUD shows. */
export interface HudSnapshot {
  hate: number;
  legit: number;
  level: number;
  /** Legitimacy needed for the next level (WIN_LEGITIMACY at the top). */
  nextLevelAt: number;
  /** 0..1 toward victory. */
  progress: number;
  wave: number;
  phase: DirectorPhase;
  /** Seconds left in the breather (0 otherwise). */
  breather: number;
  /** Protesters alive / still queued in this wave. */
  crowd: number;
  pending: number;
  /** Capitol integrity 0..1 and damage state 0..5. */
  integrity: number;
  capitolState: number;
  paused: boolean;
  speed: number;
  /** Day/night: time of day 0..1 and the clock hour. */
  tod: number;
  hour: number;
  outcome: 'playing' | 'victory' | 'defeat';
}

export interface DeployOption {
  unit: UnitId;
  cost: number;
  /** Keyboard hotkey label ('1'…'0', '-'). */
  hotkey: string;
  unlocked: boolean;
  affordable: boolean;
  /** Level that unlocks it. */
  level: number;
}

export const HOTKEYS: Readonly<Record<UnitId, string>> = {
  riot: '1',
  sniper: '2',
  blockade: '3',
  gas: '4',
  mounted: '5',
  armed: '6',
  soldier: '7',
  humvee: '8',
  brigade: '9',
  tank: '0',
  heli: '-',
};

export class GameController {
  readonly bus = new EventBus<GameEventMap>();
  readonly loop: FixedStepLoop;
  readonly camera = new Camera();
  readonly input: CameraController;
  readonly view: WorldView;
  private readonly bot: Bot | null;
  private deploying: UnitId | null = null;
  private selected = -1;
  private hoverTile: { i: number; j: number } | null = null;
  /** Touch placement: first tap previews, second tap on the same tile confirms. */
  private touchPreview: { i: number; j: number } | null = null;
  /** Keep placing after a deploy (Shift on desktop). */
  keepPlacing = false;
  private disposers: Array<() => void> = [];
  private overShown = false;
  private hitStopped = false;
  /** Raw drained sim events each frame (audio: `audio.handleSimEvents`). */
  onSimEvents: ((events: readonly SimEvent[]) => void) | null = null;
  /** Called after each rendered frame (debug overlay, audio listener, perf probes). */
  onFrame: ((dtMs: number) => void) | null = null;
  /**
   * Called every frame just before the stage is rendered (UI/HUD update — M9). Runs after the
   * world view updated, so screen positions of units are current.
   */
  onPreRender: ((dtMs: number) => void) | null = null;
  /** Title-screen backdrop (a bot plays; the UI hides the HUD). */
  attract = false;
  /** destroy() was called. */
  destroyed = false;
  /** Frame-time governor (null = off). */
  readonly governor: FrameGovernor | null;
  /** Accumulated cost (ms): sim steps (+ bot), view update, UI frame, Pixi render; counts. */
  readonly perf = { sim: 0, view: 0, ui: 0, render: 0, frames: 0, ticks: 0 };

  constructor(
    private readonly stage: PixelStage,
    readonly world: World,
    cityArt: CityArt,
    opts: ControllerOptions,
  ) {
    this.view = new WorldView(stage, world, cityArt, {
      quality: opts.quality,
      bus: this.bus,
      tod: opts.tod,
    });
    this.bot = opts.autoplay ? new Bot(world, opts.bot ?? 'escalate') : null;
    this.governor = opts.governor === false ? null : new FrameGovernor();
    // Camera.
    const map = world.map;
    const b = mapWorldBounds(map.w, map.h);
    const margin = 64;
    this.camera.setBounds({
      minX: b.minX - margin,
      minY: b.minY - 160,
      maxX: b.maxX + margin,
      maxY: b.maxY + margin,
    });
    this.disposers.push(
      stage.onResize((size) =>
        this.camera.setViewport(size.width, size.height, zoomRange(size.width, size.height)),
      ),
    );
    if (opts.zoom) this.camera.zoom = this.camera.targetZoom = Math.round(opts.zoom);
    const c = tileToWorld(
      (opts.camU ?? map.cameraStart.i) + 0.5,
      (opts.camV ?? map.cameraStart.j) + 0.5,
    );
    this.camera.centerOn(c.x, c.y - 30);
    this.input = new CameraController(stage.canvas, this.camera);
    this.input.events.on('tap', (e) => this.tap(e));
    this.input.events.on('hover', (h) => this.hover(h));
    this.loop = new FixedStepLoop({
      update: () => {
        const t = performance.now();
        this.bot?.update();
        this.world.step();
        this.perf.sim += performance.now() - t;
        this.perf.ticks++;
      },
      render: (alpha, frameDtMs) => this.render(alpha, frameDtMs),
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────────────

  start(): void {
    this.loop.start();
  }

  /** Stop the loop and remove this game's world view from the stage (art stays installed). */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    this.input.destroy();
    for (const d of this.disposers) d();
    this.bus.clear();
    this.onFrame = this.onPreRender = null;
    this.onSimEvents = null;
    this.view.destroy();
  }

  private render(alpha: number, frameDtMs: number): void {
    const nowMs = performance.now();
    // Hit-stop: hold the sim for a few frames on big hits.
    if (this.view.juice.stopped(nowMs)) {
      if (!this.loop.paused) {
        this.loop.paused = true;
        this.hitStopped = true;
      }
    } else if (this.hitStopped) {
      this.hitStopped = false;
      this.loop.paused = false;
    }
    const dt = frameDtMs / 1000;
    const lv = this.governor?.sample(frameDtMs);
    if (lv !== undefined && lv !== null) {
      this.view.setDegrade(lv);
      console.info(
        `[riot] frame time ${this.governor!.average.toFixed(0)} ms → quality fallback level ${lv}`,
      );
    }
    this.input.update(dt);
    this.camera.update(dt);
    const events = this.world.events.drain();
    this.view.onEvents(events, nowMs);
    this.onSimEvents?.(events);
    for (const e of events) this.bus.emit(e.type, e as never);
    if (this.world.phase !== 'playing' && !this.overShown) {
      this.overShown = true;
      this.bus.emit('gameOver', {
        victory: this.world.phase === 'victory',
        stats: this.world.stats,
      });
    }
    const simDt = this.loop.paused ? 0 : dt * this.loop.timeScale;
    const tv = performance.now();
    this.view.frame(this.camera.view(), alpha, simDt, dt, nowMs, {
      deploy: this.deploying,
      hasHover: this.hoverTile !== null || this.touchPreview !== null,
      hoverI: (this.touchPreview ?? this.hoverTile)?.i ?? 0,
      hoverJ: (this.touchPreview ?? this.hoverTile)?.j ?? 0,
      selected: this.selected,
    });
    const tu = performance.now();
    this.onPreRender?.(frameDtMs);
    const tr = performance.now();
    this.stage.app.render();
    const te = performance.now();
    this.perf.view += tu - tv;
    this.perf.ui += tr - tu;
    this.perf.render += te - tr;
    this.perf.frames++;
    this.onFrame?.(frameDtMs);
  }

  // ── Deploy ───────────────────────────────────────────────────────────────────────────

  get deployUnit(): UnitId | null {
    return this.deploying;
  }

  /** Enter deploy mode for `unit` (same unit again or null = leave). */
  beginDeploy(unit: UnitId | null): void {
    const next = unit === this.deploying ? null : unit;
    if (next && UNITS[next].level > this.world.level) {
      this.bus.emit('deployFailed', { unit: next, reason: 'locked', i: -1, j: -1 });
      return;
    }
    this.deploying = next;
    this.touchPreview = null;
    if (next) this.select(null);
    this.bus.emit('deployModeChanged', { unit: next });
  }

  /** Try to deploy the current unit at tile (i, j). */
  deployAt(i: number, j: number): Unit | null {
    const unit = this.deploying;
    if (!unit) return null;
    const chk = this.world.canDeploy(unit, i, j);
    if (!chk.ok) {
      this.bus.emit('deployFailed', { unit, reason: chk.reason, i, j });
      return null;
    }
    const u = this.world.deploy(unit, i, j);
    if (u && !this.keepPlacing) this.beginDeploy(null);
    return u;
  }

  /** Touch placement preview tile (first tap), or null. */
  get preview(): { i: number; j: number } | null {
    return this.touchPreview;
  }

  /** Deploy at the touch preview (the UI's ✔ button). */
  confirmPreview(): boolean {
    const p = this.touchPreview;
    if (!p || !this.deploying) return false;
    this.touchPreview = null;
    return this.deployAt(p.i, p.j) !== null;
  }

  /** Options for the deploy bar. */
  deployOptions(): DeployOption[] {
    const w = this.world;
    return UNIT_ORDER.map((unit) => ({
      unit,
      cost: UNITS[unit].cost,
      hotkey: HOTKEYS[unit],
      unlocked: UNITS[unit].level <= w.level,
      affordable: UNITS[unit].cost <= w.hate,
      level: UNITS[unit].level,
    }));
  }

  // ── Selection & commands ─────────────────────────────────────────────────────────────

  get selectedUnit(): number | null {
    return this.selected >= 0 ? this.selected : null;
  }

  select(unitId: number | null): void {
    const id = unitId ?? -1;
    if (id === this.selected) return;
    this.selected = id;
    const u = id >= 0 ? this.world.units.get(id) : undefined;
    this.bus.emit('selectionChanged', { unitId: u ? id : null, unit: u ? u.type : null });
  }

  /** Send the selected commandable unit to tile (i, j). */
  commandTo(i: number, j: number): boolean {
    const u = this.selected >= 0 ? this.world.units.get(this.selected) : undefined;
    if (!u || !u.def.commandable) return false;
    const ok = this.world.command(u.id, i, j);
    if (ok) this.view.overlays.flag(i, j, this.view.now);
    return ok;
  }

  useAbility(unitId: number): boolean {
    return this.world.useAbility(unitId);
  }

  useAllAbilities(): number {
    return this.world.useAllAbilities();
  }

  /** "Let them come" (prep) or call the next wave early (breather). */
  startWaves(): boolean {
    if (this.world.director.phase === 'prep') return this.world.startWaves();
    return this.world.callNextWaveEarly() > 0;
  }

  callNextWaveEarly(): number {
    return this.world.callNextWaveEarly();
  }

  // ── Time ─────────────────────────────────────────────────────────────────────────────

  get paused(): boolean {
    return this.loop.paused && !this.hitStopped;
  }

  setPaused(p: boolean): void {
    this.hitStopped = false;
    if (this.loop.paused === p) return;
    this.loop.paused = p;
    this.bus.emit('pauseChanged', { paused: p });
  }

  togglePause(): void {
    this.setPaused(!this.loop.paused);
  }

  get speed(): number {
    return this.loop.timeScale;
  }

  setSpeed(s: number): void {
    this.loop.timeScale = s;
    this.bus.emit('speedChanged', { speed: s });
  }

  cycleSpeed(): void {
    const i = TIME_SCALES.indexOf(this.loop.timeScale as (typeof TIME_SCALES)[number]);
    this.setSpeed(TIME_SCALES[(i + 1) % TIME_SCALES.length]!);
  }

  // ── Pointer ──────────────────────────────────────────────────────────────────────────

  /** Where +Hate fists fly to (UI px, screen space). M9 points this at the HUD counter. */
  setHateTarget(x: number, y: number): void {
    this.view.juice.hateTarget = { x, y };
  }

  /** Leave deploy mode / clear the selection (Esc, right click). */
  cancel(): void {
    if (this.deploying) this.beginDeploy(null);
    else this.select(null);
  }

  hover(h: PointerInfo | null): void {
    this.hoverTile = h ? this.deployTile(h) : null;
  }

  /**
   * The tile a pointer targets in deploy mode: rooftop units pick the building drawn under
   * the pointer (anywhere on its walls or roof) → its footprint origin; otherwise the ground
   * tile.
   */
  private deployTile(h: PointerInfo): { i: number; j: number } {
    if (this.deploying && UNITS[this.deploying].placement === 'rooftop') {
      const b = this.view.roofAt(h.worldX, h.worldY);
      const bd = b >= 0 ? this.world.map.buildings[b] : undefined;
      if (bd) return { i: bd.i, j: bd.j };
    }
    return { i: h.i, j: h.j };
  }

  /** A tap/click at a canvas point (from CameraController or the UI). */
  tap(e: TapEvent): void {
    if (e.button === 2) {
      this.cancel();
      return;
    }
    const map = this.world.map;
    const inMap = e.i >= 0 && e.j >= 0 && e.i < map.w && e.j < map.h;
    if (this.deploying) {
      const t = this.deployTile(e);
      if (t.i < 0 || t.j < 0 || t.i >= map.w || t.j >= map.h) return;
      if (e.pointerType === 'touch') {
        // Mobile: first tap previews (ghost + glow), a second tap on the same tile confirms.
        const p = this.touchPreview;
        if (!p || p.i !== t.i || p.j !== t.j) {
          this.touchPreview = t;
          return;
        }
        this.touchPreview = null;
      }
      this.deployAt(t.i, t.j);
      return;
    }
    const w = this.view.screenToWorld(e.sx, e.sy);
    const hit = this.view.pickUnit(w.x, w.y);
    if (hit >= 0) {
      const u = this.world.units.get(hit);
      if (u?.abilityReady && this.useAbility(hit)) return;
      this.select(hit);
      return;
    }
    if (this.selected >= 0 && inMap && this.commandTo(e.i, e.j)) return;
    this.select(null);
  }

  /** Tap a tile directly (UI / tests). */
  tapTile(i: number, j: number): void {
    if (this.deploying) {
      this.deployAt(i, j);
      return;
    }
    const p = tileToWorld(i + 0.5, j + 0.5);
    const v = this.camera.view();
    this.tap({
      sx: (p.x - v.x) * v.zoom + Math.floor(v.width / 2),
      sy: (p.y - v.y) * v.zoom + Math.floor(v.height / 2),
      worldX: p.x,
      worldY: p.y,
      u: i + 0.5,
      v: j + 0.5,
      i,
      j,
      button: 0,
      pointerType: 'mouse',
    });
  }

  /** Centre the camera on a tile. */
  focusTile(i: number, j: number): void {
    const p = tileToWorld(i + 0.5, j + 0.5);
    this.camera.centerOn(p.x, p.y);
  }

  // ── Queries ──────────────────────────────────────────────────────────────────────────

  hud(): HudSnapshot {
    const w = this.world;
    const d = w.director;
    const next = LEVELS[w.level + 1];
    return {
      hate: w.hate,
      legit: w.legit,
      level: w.level,
      nextLevelAt: next ? next.legit : WIN_LEGITIMACY,
      progress: w.progress,
      wave: d.wave,
      phase: d.phase,
      breather: d.phase === 'breather' ? Math.max(0, d.breather) : 0,
      crowd: w.crowd.count,
      pending: d.phase === 'wave' ? d.pending : 0,
      integrity: w.capitol.integrity,
      capitolState: w.capitol.state,
      paused: this.paused,
      speed: this.loop.timeScale,
      tod: this.view.timeOfDay,
      hour: this.view.grade.hour,
      outcome: w.phase,
    };
  }
}
