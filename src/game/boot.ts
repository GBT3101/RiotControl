/**
 * Boot: pixel stage → loading screen → critical art (parallel workers) → simulation → game.
 * Deferred art (vehicles, late protester types) keeps loading in the background after the first
 * frame. Timings are logged and exposed on `window.__riot.timings`.
 */
import { createAudio } from '../audio';
import { tileToWorld } from '../core/iso';
import { BALANCE } from '../data/balance';
import { LEVELS } from '../data/levels';
import { PT } from '../data/protesters';
import { loadMap } from '../maps';
import { DebugOverlay } from '../render/debugOverlay';
import { createPixelStage, type PixelStage } from '../render/stage';
import { Bot } from '../sim/headless';
import { World } from '../sim/world';
import { criticalJobs, deferredJobs, emptyCityArt, loadBatch, type CityArtOptions } from './assets';
import { ArtCache } from './assets/cache';
import { ArtLoader } from './assets/loader';
import { GameController } from './controller';
import { DebugHud } from './debugHud';
import { bindKeyboard } from './input';
import { LoadingScreen } from './loading';
import type { GameParams } from './params';
import { detectQuality } from './quality';
import { setupScene } from './scenes';

export interface BootTimings {
  stage: number;
  loadingShown: number;
  criticalArt: number;
  world: number;
  skip: number;
  firstFrame: number;
  deferredArt: number;
  jobs: Array<{ job: string; ms: number }>;
  workers: number;
}

const CITY_NAMES = { madrid: 'Madrid', london: 'London', paris: 'Paris' } as const;

function nextFrame(): Promise<number> {
  return new Promise((r) => requestAnimationFrame((t) => r(t)));
}

/** Upload atlas pages to the GPU now (no hitch on the first game frames). */
function preupload(stage: PixelStage, sources: Array<{ source: unknown }>): void {
  const tex = (stage.app.renderer as unknown as { texture?: { initSource?(s: unknown): void } })
    .texture;
  if (!tex?.initSource) return;
  for (const s of sources) tex.initSource(s.source);
}

export async function bootGame(host: HTMLElement, params: GameParams): Promise<GameController> {
  const t0 = performance.now();
  const timings: BootTimings = {
    stage: 0,
    loadingShown: 0,
    criticalArt: 0,
    world: 0,
    skip: 0,
    firstFrame: 0,
    deferredArt: 0,
    jobs: [],
    workers: 0,
  };
  const stage = await createPixelStage(host);
  timings.stage = performance.now() - t0;
  const quality = params.quality ?? detectQuality();
  const loading = new LoadingScreen(stage, CITY_NAMES[params.city], params.seed);
  stage.app.stage.addChild(loading.root);
  await nextFrame();
  timings.loadingShown = performance.now() - t0;

  const loader = new ArtLoader();
  timings.workers = loader.workerCount;
  // Repeat visits: packed atlases come straight from IndexedDB (production builds only — the
  // hashed worker URL versions the cache).
  if (!import.meta.env.DEV && !params.nocache) {
    loader.cache = await ArtCache.open(await loader.version());
  }
  const cityOpts: CityArtOptions = {
    city: params.city,
    mapSeed: params.mapSeed,
    seed: params.seed,
    quality,
  };
  const cityArt = emptyCityArt();
  // Start the simulation build while the workers paint.
  const map = loadMap(params.city, params.mapSeed);
  await loadBatch(loader, criticalJobs(cityOpts), cityArt, (done, total) =>
    loading.setProgress((done / total) * 0.92),
  );
  preupload(
    stage,
    cityArt.pages.map((p) => p.texture),
  );
  timings.criticalArt = performance.now() - t0;
  loading.setProgress(0.95);

  const world = new World(map, { seed: params.seed, quality });
  applyDebugEconomy(world, params);
  if (params.stress > 0) stressSpawn(world, params.stress);
  const sceneFocus = params.scene ? setupScene(world, params.scene) : null;
  timings.world = performance.now() - t0;
  if (params.skip > 0) {
    const bot = params.autoplay ? new Bot(world, 'escalate') : null;
    if (params.autoplay || params.stress > 0) world.startWaves();
    const n = Math.round(params.skip / world.dt);
    for (let k = 0; k < n && world.phase === 'playing'; k++) {
      bot?.update();
      if (params.scene === 'gas' && k === 45) world.useAllAbilities();
      world.step();
      if ((k & 63) === 0) world.events.clear();
    }
    world.events.clear();
  } else if (params.autoplay) world.startWaves();
  timings.skip = performance.now() - t0;

  const game = new GameController(stage, world, cityArt, {
    quality,
    autoplay: params.autoplay,
    tod: params.tod,
    zoom: params.zoom,
    camU: params.camU,
    camV: params.camV,
  });
  if (sceneFocus && !params.focus) game.focusTile(sceneFocus.i, sceneFocus.j);
  if (params.focus) focusOn(game, params.focus);
  loading.destroy();
  bindKeyboard(game);
  const overlay = new DebugOverlay(document.body, params.debug);
  const hud = params.hud ? new DebugHud(game) : null;
  game.onFrame = (dtMs) => {
    hud?.update(dtMs);
    overlay.frame(dtMs);
    if (overlay.shown) {
      const s = game.view.stats;
      const cam = game.camera;
      overlay.set(
        'sim',
        `tick ${world.tick}  x${game.speed}${game.paused ? ' PAUSED' : ''}  q=${quality}`,
      );
      overlay.set('crowd', `${world.crowd.count} alive, ${s.protesters} drawn, bodies ${s.bodies}`);
      overlay.set('fx', `${s.fx} fx, decals ${s.decals}, chunks ${s.chunks}`);
      overlay.set('zoom', `${cam.zoom.toFixed(2)} (${cam.range.min}-${cam.range.max})`);
      overlay.set('tod', `${game.view.timeOfDay.toFixed(3)}`);
    }
  };
  wireAudio(game, params);
  if (params.freeze) game.setPaused(true);
  game.start();
  await nextFrame();
  await nextFrame();
  timings.firstFrame = performance.now() - t0;
  game.bus.emit('ready', { city: params.city, bootMs: timings.firstFrame });
  console.info(
    `[riot] first frame ${timings.firstFrame.toFixed(0)} ms (stage ${timings.stage.toFixed(0)}, loading screen ${timings.loadingShown.toFixed(0)}, art ${timings.criticalArt.toFixed(0)}, workers ${timings.workers}, cache hits ${loader.cacheHits}, quality ${quality})`,
  );
  const handle = window as unknown as { __riot: Record<string, unknown> };
  handle.__riot = {
    stage,
    game,
    world,
    map,
    camera: game.camera,
    input: game.input,
    loop: game.loop,
    view: game.view,
    timings,
    overlay,
  };

  // Background: vehicles + late protester types.
  void loadBatch(loader, deferredJobs(cityOpts), cityArt).then(() => {
    preupload(
      stage,
      cityArt.pages.map((p) => p.texture),
    );
    game.view.onArtUpdated();
    timings.deferredArt = performance.now() - t0;
    timings.jobs = loader.timings;
    loader.terminate();
    game.bus.emit('artComplete', { ms: timings.deferredArt });
    console.info(`[riot] all art ${timings.deferredArt.toFixed(0)} ms`);
    // Screenshot tools wait for this (everything drawn, incl. deferred art).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (document.documentElement.dataset.ready = 'true')),
    );
  });
  return game;
}

/** ?level=N&hate=N — jump the economy (screenshots, debugging). */
function applyDebugEconomy(world: World, p: GameParams): void {
  if (p.level !== undefined) {
    const lvl = Math.max(0, Math.min(LEVELS.length - 1, Math.round(p.level)));
    world.economy.level = lvl;
    world.economy.legit = LEVELS[lvl]!.legit;
  }
  if (p.hate !== undefined) world.economy.hate = Math.max(0, Math.round(p.hate));
  if (p.wave !== undefined && p.wave > 1)
    world.director.wave = Math.min(60, Math.round(p.wave)) - 1;
}

/** ?stress=N — N protesters marching from every district at once (perf profiling). */
function stressSpawn(world: World, n: number): void {
  const map = world.map;
  const doors: Array<{ i: number; j: number }> = [];
  for (const d of map.spawns) {
    for (const bid of d.buildingIds)
      for (const door of map.buildings[bid]?.doors ?? []) doors.push(door);
  }
  const walk: number[] = [];
  for (let t = 0; t < world.nav.size; t++)
    if (world.nav.walk[t] && world.nav.dist[t]! > 6) walk.push(t);
  const types = [PT.student, PT.woke, PT.mob, PT.veryViolent, PT.student];
  const cap = Math.min(n, BALANCE.crowdCapacity - 64);
  for (let k = 0; k < cap; k++) {
    const t = walk[(k * 7919) % walk.length]!;
    const i = t % map.w;
    const j = (t - i) / map.w;
    world.spawnProtester(types[k % types.length]!, i + 0.2 + (k % 7) / 10, j + 0.2 + (k % 5) / 8);
  }
  void doors;
}

/** Debug camera focus: `crowd` (densest crowd), `climb` (a roof with climbers), `gas`, `units`. */
function focusOn(game: GameController, what: string): void {
  const w = game.world;
  if (what === 'climb') {
    let best = -1;
    for (const b of w.roofBuildings)
      if (best < 0 || w.roofClimbers[b]! > w.roofClimbers[best]!) best = b;
    const B = best >= 0 ? w.map.buildings[best] : undefined;
    if (B) return game.focusTile(B.i + (B.w >> 1), B.j + (B.d >> 1) + 2);
  }
  if (what === 'gas') {
    const a = w.areas.active.find((x) => x.kind === 'gas') ?? w.areas.active[0];
    if (a) return game.focusTile(Math.floor(a.x), Math.floor(a.y));
  }
  if (what === 'units' && w.units.active.length > 0) {
    let x = 0;
    let y = 0;
    for (const u of w.units.active) {
      x += u.x;
      y += u.y;
    }
    return game.focusTile(
      Math.floor(x / w.units.active.length),
      Math.floor(y / w.units.active.length),
    );
  }
  let best = -1;
  let bi = w.map.cameraStart.i;
  let bj = w.map.cameraStart.j;
  for (let j = 2; j < w.map.h - 2; j += 2) {
    for (let i = 2; i < w.map.w - 2; i += 2) {
      let n = 0;
      for (let dj = -3; dj <= 3; dj++)
        for (let di = -3; di <= 3; di++) n += w.hash.cellCount(i + di, j + dj);
      if (n > best) {
        best = n;
        bi = i;
        bj = j;
      }
    }
  }
  game.focusTile(bi, bj);
}

/** M11 procedural audio: sim events → SFX, listener follows the camera, music follows the run. */
function wireAudio(game: GameController, params: GameParams): void {
  if (params.mute) return;
  try {
    const audio = createAudio();
    audio.autoUnlock();
    audio.setCity(params.city);
    const w = game.world;
    const cap = w.map.capitol;
    const c = tileToWorld(cap.i + cap.w / 2, cap.j + cap.d / 2);
    audio.bindSimEvents(null, {
      capitol: { x: c.x, y: c.y },
      unitType: (id) => w.units.get(id)?.type,
      units: () => w.units.active,
      crowd: () => w.crowd.count,
    });
    game.onSimEvents = (events) => audio.handleSimEvents(events);
    let acc = 1;
    const prevFrame = game.onFrame;
    game.onFrame = (dtMs) => {
      prevFrame?.(dtMs);
      const v = game.camera.view();
      audio.setListener({ x: v.x, y: v.y }, v.zoom, v.width);
      acc += dtMs / 1000;
      if (acc < 1) return;
      acc = 0;
      const d = w.director;
      audio.setMusicState({
        phase: w.phase === 'victory' ? 'victory' : w.phase === 'defeat' ? 'defeat' : d.phase,
        level: w.level,
        crowd: w.crowd.count,
        night: game.view.grade.darkness > 0.5,
      });
    };
    (window as unknown as { __riotAudio?: unknown }).__riotAudio = audio;
  } catch (err) {
    console.warn('[riot] audio unavailable', err);
  }
}
