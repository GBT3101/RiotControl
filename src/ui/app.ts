/**
 * The app shell (M9): owns the pixel stage, the UI layers and input router, the art store and
 * the running game, and drives the screen flow:
 *
 *   boot/loading → Title (living city backdrop: attract-mode game, drifting camera)
 *     → City select (three dossier postcards) → loading (only if the city's art isn't loaded)
 *     → Game (HUD) ⇄ Pause / Settings → End (newspaper + stats ledger) → again / other city / title
 *
 * `?city=…` (or `?skipTitle=1`) boots straight into a run (all M8 debug params still work);
 * `?screen=title|select` forces a screen; `?moment=levelup|advisor|victory|defeat|threat|breta|
 * prophets|capitol|wave` triggers a UI moment for screenshots (docs/M9.md).
 *
 * Layers (bottom → top): game world · hudLayer (HUD, moments, advisor) · game screen FX (Hate
 * fists fly over the HUD) · topLayer (screens, tooltip). The UI root containers are scaled by
 * the integer UI scale; everything inside is in UI px.
 */
import { Container } from 'pixi.js';
import { createAudio, type Audio } from '../audio';
import type { SfxId } from '../audio/types';
import { EventBus } from '../core/events';
import { tileToWorld } from '../core/iso';
import { UNITS, UNIT_ORDER, type UnitId } from '../data/units';
import { ArtStore, bindGameAudio, cityArtOptions, createGame, densestCrowd } from '../game/boot';
import type { GameController } from '../game/controller';
import { bindKeyboard } from '../game/input';
import { LoadingScreen } from '../game/loading';
import { readParams, type GameParams } from '../game/params';
import { detectQuality } from '../game/quality';
import type { CityId } from '../maps/contract';
import { DebugOverlay } from '../render/debugOverlay';
import type { PixelStage } from '../render/stage';
import { uiScale } from '../render/zoom';
import { buttonSounds } from './core/button';
import { UiInput } from './core/input';
import { clearAtlasBuffers } from './core/tex';
import { Hud } from './hud/hud';
import { computeHudLayout, insetsToUi, NO_INSETS, type HudLayout, type Insets } from './layout';
import { applyRun, loadRecords, saveRecords, type Records } from './records';
import { CitySelectScreen } from './screens/citySelect';
import { CreditsScreen } from './screens/credits';
import { EndScreen } from './screens/end';
import { PauseScreen } from './screens/pause';
import type { Screen } from './screens/screen';
import { SettingsScreen } from './screens/settings';
import { TitleScreen } from './screens/title';
import { loadGameSettings, resolveQuality, saveGameSettings, type GameSettings } from './settings';
import { CITY_COPY } from './strings';
import { Advisor } from './widgets/advisor';
import { Moments } from './widgets/moments';
import { Tooltip } from './widgets/tooltip';
import { totalFallen } from '../sim/stats';

export interface UiEventMap {
  /** A screen became active ('title' | 'select' | 'game' | 'pause' | 'settings' | 'credits' | 'end'). */
  screen: { name: string };
  /** A run started (after the first frame). */
  runStart: { city: CityId; game: GameController };
  runEnd: { city: CityId; victory: boolean };
  /** Hate stayed below the cheapest unlocked unit for a while during a wave (M10 hint hook). */
  lowHate: { hate: number; cheapest: number };
  /** A level-up dossier was shown. */
  levelUpShown: { level: number; unit: UnitId };
}

type ScreenName = 'boot' | 'title' | 'select' | 'game' | 'end';

export class UiApp {
  readonly bus = new EventBus<UiEventMap>();
  readonly input: UiInput;
  /** HUD, moments, advisor (under the screen-space FX). */
  readonly hudLayer = new Container({ label: 'ui-hud' });
  /** Screens and tooltips (top). */
  readonly topLayer = new Container({ label: 'ui-top' });
  readonly tooltip: Tooltip;
  readonly moments: Moments;
  readonly advisor: Advisor;
  readonly toast = { info: (text: string): void => this.moments.infoToast(text) };
  readonly art: ArtStore;
  readonly settings: GameSettings;
  records: Records;
  readonly touch: boolean;
  readonly audio: Audio | null;
  k = 1;
  layout: HudLayout;
  game: GameController | null = null;
  hud: Hud | null = null;
  /** Screen stack (top-most last). */
  readonly screens: Screen[] = [];
  mode: ScreenName = 'boot';
  city: CityId;
  private cssInsets: Insets = NO_INSETS;
  private raf = 0;
  private lastT = -1;
  private gameAudio: ((dtMs: number) => void) | null = null;
  private overlay: DebugOverlay;
  private lowHateT = 0;
  private lowHateFired = false;
  private probe: HTMLDivElement;
  /** Debug params of the current run (direct boots; restart reuses them). */
  private runDebug: GameParams | undefined;
  private loading: LoadingScreen | null = null;
  private generation = 0;

  constructor(
    readonly stage: PixelStage,
    readonly host: HTMLElement,
    readonly params: GameParams,
  ) {
    this.settings = loadGameSettings();
    this.records = loadRecords();
    this.city = params.city;
    this.touch =
      typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);
    this.art = new ArtStore(stage, params.nocache);
    this.input = new UiInput(host, stage.canvas);
    this.input.roots = [this.hudLayer, this.topLayer];
    this.input.onEnterUi = () => this.game?.hover(null);
    this.tooltip = new Tooltip(this);
    this.moments = new Moments(this);
    this.advisor = new Advisor(this);
    this.hudLayer.addChild(this.moments.root, this.advisor.root);
    this.topLayer.addChild(this.tooltip.root);
    stage.app.stage.addChild(this.hudLayer, this.topLayer);
    this.overlay = new DebugOverlay(document.body, params.debug);
    this.probe = document.createElement('div');
    this.probe.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(this.probe);
    this.layout = computeHudLayout(480, 300);
    let audio: Audio | null = null;
    if (!params.mute) {
      try {
        audio = createAudio();
        audio.autoUnlock();
      } catch (err) {
        console.warn('[riot] audio unavailable', err);
      }
    }
    this.audio = audio;
    buttonSounds.hover = () => this.sfx('hover');
    buttonSounds.click = () => this.sfx('click');
    stage.onResize(() => this.relayout());
    bindKeyboard(this);
    const handle = window as unknown as { __riot?: Record<string, unknown> };
    handle.__riot = { ...(handle.__riot ?? {}), stage, ui: this, timings: this.art.timings };
    if (audio) (window as unknown as { __riotAudio?: unknown }).__riotAudio = audio;
  }

  /* ── Lifecycle ───────────────────────────────────────────────────────────────────── */

  async start(): Promise<void> {
    const p = this.params;
    const direct = (p.cityGiven || p.skipTitle) && p.screen !== 'title' && p.screen !== 'select';
    if (direct) {
      await this.startRun(p.city, p);
      return;
    }
    await this.showTitle(p.screen === 'select');
  }

  get muted(): boolean {
    return this.audio?.getSettings().muted ?? true;
  }

  sfx(id: SfxId): void {
    this.audio?.play(id);
  }

  toggleMute(): void {
    if (!this.audio) return;
    this.audio.mute();
    this.hud?.top.refreshMute();
  }

  toggleMinimap(): void {
    if (this.layout.W < 300) this.settings.minimapPortrait = !this.settings.minimapPortrait;
    else this.settings.minimap = !this.settings.minimap;
    saveGameSettings(this.settings);
    this.relayout();
  }

  saveSettings(): void {
    saveGameSettings(this.settings);
    if (this.game) this.game.view.juice.reducedMotion = !this.settings.shake;
  }

  private measureInsets(): Insets {
    try {
      const cs = getComputedStyle(this.probe);
      const n = (v: string) => Math.max(0, parseFloat(v) || 0);
      return {
        top: n(cs.paddingTop),
        right: n(cs.paddingRight),
        bottom: n(cs.paddingBottom),
        left: n(cs.paddingLeft),
      };
    } catch {
      return NO_INSETS;
    }
  }

  relayout(): void {
    const s = this.stage.size;
    this.k = uiScale(Math.min(s.cssWidth, s.cssHeight), s.dpr);
    this.cssInsets = this.measureInsets();
    const W = Math.floor(s.width / this.k);
    const H = Math.floor(s.height / this.k);
    const safe = insetsToUi(this.cssInsets, s.dpr, this.k);
    const mm = W < 300 ? this.settings.minimapPortrait : this.settings.minimap;
    this.layout = computeHudLayout(W, H, safe, { touch: this.touch, minimap: mm });
    this.hudLayer.scale.set(this.k);
    this.topLayer.scale.set(this.k);
    this.hud?.layout(this.layout);
    for (const sc of this.screens) sc.layout(this.layout);
    this.advisor.place(this.layout.advisor.x, this.layout.advisor.bottom, this.layout.advisor.maxW);
  }

  /** Keep the UI layers above a newly created game's world, below its screen FX. */
  private restack(): void {
    const root = this.stage.app.stage;
    const g = this.game;
    if (!g) {
      root.addChild(this.hudLayer, this.topLayer);
      return;
    }
    root.addChild(g.view.layers.world);
    root.addChild(this.hudLayer);
    root.addChild(g.view.layers.screen);
    root.addChild(this.topLayer);
  }

  /* ── Frame driving ───────────────────────────────────────────────────────────────── */

  /** Own RAF loop when no game drives the frames. */
  private ensureOwnLoop(): void {
    if (this.raf || this.game || this.loading) return;
    const tick = (now: number): void => {
      this.raf = 0;
      if (this.game || this.loading) return;
      const dt = this.lastT < 0 ? 0 : Math.min(0.25, (now - this.lastT) / 1000);
      this.lastT = now;
      this.frame(dt);
      this.stage.app.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.lastT = -1;
    this.raf = requestAnimationFrame(tick);
  }

  private frame(dt: number): void {
    this.hud?.update(dt);
    this.moments.update(dt);
    this.advisor.update(dt);
    if (this.hud) {
      const info = this.hud.info.root;
      const bottom = info.visible ? info.y - 4 : this.layout.advisor.bottom;
      this.advisor.place(this.layout.advisor.x, bottom, this.layout.advisor.maxW);
    }
    for (const sc of this.screens) sc.update(dt);
    this.tooltip.update(dt);
    this.watchLowHate(dt);
  }

  private bindGameFrames(game: GameController): void {
    game.onPreRender = (dtMs) => this.frame(Math.min(0.25, dtMs / 1000));
    game.onFrame = (dtMs) => {
      this.gameAudio?.(dtMs);
      const o = this.overlay;
      o.frame(dtMs);
      if (o.shown) {
        const s = game.view.stats;
        const cam = game.camera;
        const w = game.world;
        o.set('sim', `tick ${w.tick}  x${game.speed}${game.paused ? ' PAUSED' : ''}  ${this.mode}`);
        o.set('crowd', `${w.crowd.count} alive, ${s.protesters} drawn, bodies ${s.bodies}`);
        o.set('fx', `${s.fx} fx, decals ${s.decals}, chunks ${s.chunks}`);
        o.set('zoom', `${cam.zoom.toFixed(2)} (${cam.range.min}-${cam.range.max}) ui ${this.k}`);
      }
    };
  }

  /** Screenshot tools wait for `data-ready` (all art installed, screen on display). */
  private markReadyWhenComplete(): void {
    const s = this.art.current;
    const gen = this.generation;
    const done = (): void => {
      if (gen !== this.generation) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          document.documentElement.dataset.ready = 'true';
          if (this.params.moment) this.debugMoment(this.params.moment);
        }),
      );
    };
    if (!s || s.complete) done();
    else void s.whenComplete.then(done);
  }

  /* ── Screens ─────────────────────────────────────────────────────────────────────── */

  push(sc: Screen, name?: string): void {
    this.screens.push(sc);
    this.topLayer.addChild(sc.root);
    this.topLayer.addChild(this.tooltip.root);
    sc.layout(this.layout);
    this.input.reset();
    this.tooltip.hide();
    if (name) this.bus.emit('screen', { name });
  }

  pop(sc?: Screen): void {
    const top = sc ?? this.screens[this.screens.length - 1];
    if (!top) return;
    const k = this.screens.indexOf(top);
    if (k >= 0) this.screens.splice(k, 1);
    top.destroy();
    this.input.reset();
    this.tooltip.hide();
  }

  private clearScreens(): void {
    while (this.screens.length) this.pop();
  }

  get topScreen(): Screen | null {
    return this.screens[this.screens.length - 1] ?? null;
  }

  /* ── Title / select (attract backdrop) ──────────────────────────────────────────── */

  private attractParams(city: CityId): GameParams {
    const p = readParams('');
    return {
      ...p,
      city,
      autoplay: true,
      skip: 26,
      wave: 3,
      hate: 400,
      level: 4,
      tod: 0.32,
      nocache: this.params.nocache,
      quality: this.params.quality,
    };
  }

  private quality(p: GameParams): ReturnType<typeof detectQuality> {
    return p.quality ?? resolveQuality(this.settings.quality, detectQuality);
  }

  /** Destroy the running game (art stays). */
  private endGame(): void {
    this.hud?.destroy();
    this.hud = null;
    this.moments.clear();
    this.advisor.clear();
    this.tooltip.hide();
    if (this.game) {
      this.game.destroy();
      this.game = null;
    }
    this.gameAudio = null;
    this.audio?.bindSimEvents(null, {});
    this.ensureOwnLoop();
  }

  /** Show a loading screen while `city`'s art loads (skipped when it is already loaded). */
  private async loadArt(p: GameParams, attract: boolean): Promise<void> {
    const opts = cityArtOptions(p, this.quality(p));
    if (attract) opts.lean = true;
    if (this.art.matches(opts)) {
      await this.art.load(opts);
      return;
    }
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.hudLayer.visible = this.topLayer.visible = false;
    this.loading = new LoadingScreen(this.stage, CITY_COPY[p.city].name, p.seed);
    this.stage.app.stage.addChild(this.loading.root);
    clearAtlasBuffers();
    try {
      await this.art.load(opts, (f) => this.loading?.setProgress(f * 0.95));
    } finally {
      this.loading.destroy();
      this.loading = null;
      this.hudLayer.visible = this.topLayer.visible = true;
      this.ensureOwnLoop();
    }
  }

  async showTitle(toSelect = false): Promise<void> {
    const gen = ++this.generation;
    this.endGame();
    this.clearScreens();
    this.mode = 'title';
    this.audio?.setCity(null);
    this.audio?.setMusicState({ phase: 'menu' });
    const city = this.settings.lastCity ?? 'madrid';
    // Reuse loaded art for the backdrop when possible (quitting a run).
    const cur = this.art.current;
    const backdrop: CityId = cur?.alive ? cur.city : city;
    const p = this.attractParams(backdrop);
    await this.loadArt(p, true);
    if (gen !== this.generation) return;
    this.startAttract(p);
    this.relayout();
    if (toSelect) this.showCitySelect(true);
    else this.push(new TitleScreen(this), 'title');
    this.markReadyWhenComplete();
  }

  private startAttract(p: GameParams): void {
    const session = this.art.current!;
    const game = createGame(this.stage, session, p, this.quality(p), { attract: true });
    game.setSpeed(1);
    game.view.juice.reducedMotion = true;
    game.setHateTarget(-200, -200);
    this.game = game;
    this.restack();
    this.bindGameFrames(game);
    const handle = window as unknown as { __riot: Record<string, unknown> };
    Object.assign(handle.__riot, {
      game,
      world: game.world,
      map: game.world.map,
      camera: game.camera,
      input: game.input,
      loop: game.loop,
      view: game.view,
      hud: null,
    });
    // Keep the bot's crowd in view: start over the densest crowd.
    const c = densestCrowd(game);
    game.focusTile(c.i, c.j);
    game.bus.on('gameOver', () => {
      // Attract run ended: start a fresh one on the same art.
      setTimeout(() => {
        if (this.game !== game || this.mode === 'game') return;
        game.destroy();
        this.game = null;
        this.startAttract(p);
      }, 1500);
    });
    game.start();
  }

  showCitySelect(fromTitle = true): void {
    const top = this.topScreen;
    if (top instanceof TitleScreen && fromTitle) this.pop(top);
    this.mode = 'select';
    this.push(new CitySelectScreen(this), 'select');
  }

  /** Back from the city select to the title menu (same backdrop). */
  backToTitleMenu(): void {
    this.mode = 'title';
    this.push(new TitleScreen(this), 'title');
  }

  showCredits(): void {
    this.push(new CreditsScreen(this), 'credits');
  }

  /* ── Runs ────────────────────────────────────────────────────────────────────────── */

  /** Start a run in `city` (params: debug URL params for direct boots). */
  async startRun(city: CityId, debugParams?: GameParams): Promise<void> {
    const gen = ++this.generation;
    const p: GameParams = debugParams
      ? { ...debugParams, city }
      : { ...readParams(''), city, nocache: this.params.nocache, quality: this.params.quality };
    this.runDebug = debugParams;
    this.city = city;
    this.settings.lastCity = city;
    saveGameSettings(this.settings);
    this.endGame();
    this.clearScreens();
    this.mode = 'game';
    await this.loadArt(p, false);
    if (gen !== this.generation) return;
    const q = this.quality(p);
    const worldSeed = debugParams ? undefined : (Date.now() % 1_000_000) + 1;
    const game = createGame(this.stage, this.art.current!, p, q, { worldSeed });
    this.game = game;
    game.view.juice.reducedMotion = !this.settings.shake;
    this.restack();
    this.hud = new Hud(this, game);
    this.hudLayer.addChildAt(this.hud.root, 0);
    this.relayout();
    this.bindGameFrames(game);
    this.wireGameEvents(game);
    if (this.audio) {
      this.gameAudio = bindGameAudio(game, this.audio);
      this.audio.setMusicState({ phase: 'prep', level: game.world.level, crowd: 0 });
    }
    if (!p.freeze) game.setSpeed(debugParams?.autoplay ? 1 : this.settings.speed);
    if (p.freeze) game.setPaused(true);
    this.hud.root.visible = p.hud;
    game.start();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const handle = window as unknown as { __riot: Record<string, unknown> };
    Object.assign(handle.__riot, {
      game,
      world: game.world,
      map: game.world.map,
      camera: game.camera,
      input: game.input,
      loop: game.loop,
      view: game.view,
      overlay: this.overlay,
      hud: this.hud,
    });
    game.bus.emit('ready', { city, bootMs: performance.now() });
    this.bus.emit('runStart', { city, game });
    this.bus.emit('screen', { name: 'game' });
    this.markReadyWhenComplete();
  }

  private wireGameEvents(game: GameController): void {
    const focus = (u: number, v: number): void => game.focusTile(Math.floor(u), Math.floor(v));
    game.bus.on('levelUp', (e) => {
      this.moments.levelUp(e.level);
      this.bus.emit('levelUpShown', { level: e.level, unit: e.units[0] ?? 'riot' });
      for (const pt of e.protesters) {
        this.moments.newThreat(pt);
        if (pt === 'prophet') this.moments.prophets();
      }
    });
    game.bus.on('waveStart', (e) => this.moments.wave(e.wave));
    game.bus.on('bretaSpawned', (e) => this.moments.breta(() => focus(e.x, e.y)));
    game.bus.on('capitolState', (e) => {
      const c = game.world.map.capitol;
      this.moments.capitol(e.state, () => focus(c.i + c.w / 2, c.j + c.d + 2));
    });
    game.bus.on('gameOver', (e) => {
      const w = game.world;
      const res = applyRun(this.records, {
        city: w.map.city,
        victory: e.victory,
        legit: w.legit,
        wave: w.director.wave,
        time: e.stats.time,
        fallen: totalFallen(e.stats),
      });
      this.records = res.records;
      saveRecords(this.records);
      this.bus.emit('runEnd', { city: w.map.city, victory: e.victory });
      setTimeout(() => {
        if (this.game !== game) return;
        this.showEnd(e.victory, res.newBest);
      }, 1700);
    });
  }

  showEnd(victory: boolean, newBest = false): void {
    if (!this.game) return;
    this.mode = 'end';
    this.game.select(null);
    this.game.beginDeploy(null);
    if (this.hud) this.hud.root.visible = false;
    this.advisor.clear();
    this.push(new EndScreen(this, this.game, victory, newBest), 'end');
  }

  async restart(): Promise<void> {
    await this.startRun(this.city, this.runDebug);
  }

  async quitToTitle(): Promise<void> {
    await this.showTitle(false);
  }

  async otherCity(): Promise<void> {
    await this.showTitle(true);
  }

  /** Space: pause without the menu (the menu closes if open). */
  quickPause(): void {
    const g = this.game;
    if (!g || this.mode !== 'game') return;
    const top = this.topScreen;
    if (top instanceof PauseScreen) return this.closePause();
    if (top) return;
    g.togglePause();
  }

  /** HUD pause button: resume a quick pause, else open the pause menu. */
  pauseButton(): void {
    const g = this.game;
    if (!g) return;
    if (g.paused && !this.topScreen) g.setPaused(false);
    else this.openPause();
  }

  openPause(): void {
    if (!this.game || this.mode !== 'game' || this.topScreen) return;
    this.game.setPaused(true);
    this.push(new PauseScreen(this, this.game), 'pause');
  }

  closePause(): void {
    const top = this.topScreen;
    if (top instanceof PauseScreen) this.pop(top);
    this.game?.setPaused(false);
  }

  openSettings(fromGame = false): void {
    if (fromGame && this.mode === 'game' && !this.topScreen) {
      this.openPause();
    }
    this.push(new SettingsScreen(this), 'settings');
  }

  /* ── Hooks ───────────────────────────────────────────────────────────────────────── */

  private watchLowHate(dt: number): void {
    const g = this.game;
    if (!g || this.mode !== 'game' || g.attract) return;
    const w = g.world;
    let cheapest = Infinity;
    for (const u of UNIT_ORDER)
      if (UNITS[u].level <= w.level) cheapest = Math.min(cheapest, UNITS[u].cost);
    if (w.director.phase === 'wave' && w.hate < cheapest) {
      this.lowHateT += dt;
      if (this.lowHateT > 6 && !this.lowHateFired) {
        this.lowHateFired = true;
        this.bus.emit('lowHate', { hate: w.hate, cheapest });
      }
    } else {
      this.lowHateT = 0;
      if (w.hate >= cheapest * 3) this.lowHateFired = false;
    }
  }

  screenKey(code: string): boolean {
    return this.topScreen?.key?.(code) ?? false;
  }

  /** Keyboard: deploy hotkey. */
  pickUnit(unit: UnitId): void {
    if (this.mode !== 'game' || this.topScreen || !this.hud) return;
    this.hud.pick(unit);
  }

  /** Esc: leave deploy / clear selection / close the top screen / open pause. */
  escape(): void {
    const top = this.topScreen;
    if (top) {
      if (top.key?.('Escape')) return;
      if (top instanceof PauseScreen) this.closePause();
      else if (!(top instanceof TitleScreen) && !(top instanceof EndScreen)) this.pop(top);
      return;
    }
    const g = this.game;
    if (!g || this.mode !== 'game') return;
    if (g.deployUnit || g.selectedUnit !== null) g.cancel();
    else this.openPause();
  }

  /* ── Debug moments (screenshots) ─────────────────────────────────────────────────── */

  debugMoment(m: string): void {
    const g = this.game;
    if (!g) return;
    const w = g.world;
    switch (m) {
      case 'levelup':
        this.moments.levelUp(Math.max(1, w.level));
        break;
      case 'advisor':
        void this.advisor.say(
          "Every fallen officer makes us MORE legitimate. Isn't democracy beautiful?",
          'smug',
          { sticky: true },
        );
        break;
      case 'threat':
        this.moments.newThreat('veryViolent');
        break;
      case 'breta':
        this.moments.breta();
        break;
      case 'prophets':
        this.moments.prophets();
        break;
      case 'capitol':
        this.moments.capitol(3);
        break;
      case 'wave':
        this.moments.wave(Math.max(1, w.director.wave));
        break;
      case 'select': {
        const u = w.units.active.find((x) => x.def.commandable) ?? w.units.active[0];
        if (u) {
          g.select(u.id);
          const p = tileToWorld(u.x, u.y);
          g.camera.centerOn(p.x, p.y);
        }
        break;
      }
      case 'deploy':
        g.beginDeploy('riot');
        break;
      case 'preview': {
        // Touch placement preview on the closest valid road tile to the screen centre.
        g.beginDeploy('riot');
        const v = g.camera.view();
        const c = g.input.infoAt(Math.floor(v.width / 2), Math.floor(v.height / 2));
        let best: { i: number; j: number } | null = null;
        let bd = Infinity;
        for (let dj = -10; dj <= 10; dj++)
          for (let di = -10; di <= 10; di++) {
            const i = c.i + di;
            const j = c.j + dj;
            if (!w.canDeploy('riot', i, j).ok) continue;
            const d = di * di + dj * dj;
            if (d < bd) {
              bd = d;
              best = { i, j };
            }
          }
        if (best) {
          const p = tileToWorld(best.i + 0.5, best.j + 0.5);
          g.tap({
            ...g.input.infoAt(0, 0),
            worldX: p.x,
            worldY: p.y,
            u: best.i + 0.5,
            v: best.j + 0.5,
            i: best.i,
            j: best.j,
            button: 0,
            pointerType: 'touch',
          });
        }
        break;
      }
      case 'alerts':
        this.moments.newThreat('crazy');
        this.moments.breta();
        this.moments.capitol(2);
        this.moments.wave(Math.max(1, w.director.wave));
        break;
      case 'pause':
        this.openPause();
        break;
      case 'settings':
        this.openSettings(true);
        break;
      case 'victory':
      case 'defeat':
        this.showEnd(m === 'victory', true);
        break;
      default:
    }
  }
}

/** Boot the app: stage → UI → title or straight into a run. */
export async function startApp(
  stage: PixelStage,
  host: HTMLElement,
  params: GameParams,
): Promise<UiApp> {
  const app = new UiApp(stage, host, params);
  app.relayout();
  await app.start();
  return app;
}
