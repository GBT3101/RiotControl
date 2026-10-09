/**
 * Boot pieces used by the app shell (src/ui/app.ts):
 *
 * - `ArtStore` — lazy art (M8): city-independent atlases (units, FX, vehicles, UI kit) are
 *   loaded once; each city gets an `ArtSession` (critical jobs before the first frame, deferred
 *   stages in the background). Switching city disposes the previous session's atlas pages.
 *   Restarting the same city reuses its art instantly.
 * - `createGame` — a World + GameController for a city (debug params: economy jumps, time
 *   skips, stress, scenes, camera focus).
 * - `bindGameAudio` — M11 audio for a running game (sim events → SFX, listener, music).
 *
 * Timings are exposed on `window.__riot.timings`.
 */
import type { Audio } from '../audio';
import { tileToWorld } from '../core/iso';
import { BALANCE, type QualityTier } from '../data/balance';
import { LEVELS } from '../data/levels';
import { PT } from '../data/protesters';
import type { CityId } from '../maps/contract';
import { loadMap } from '../maps';
import type { PixelStage } from '../render/stage';
import { Bot } from '../sim/headless';
import { World } from '../sim/world';
import { resetClipCache } from '../view/unitView';
import {
  criticalJobs,
  deferredStages,
  emptyCityArt,
  installResults,
  type CityArt,
  type CityArtOptions,
} from './assets';
import { ArtCache } from './assets/cache';
import type { ArtJob, JobResult } from './assets/jobs';
import { createBuffer, type PixelBuffer } from '../art/lib/pixels';
import { ArtLoader } from './assets/loader';
import { GameController } from './controller';
import type { GameParams } from './params';
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

export function emptyTimings(): BootTimings {
  return {
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
}

/** Upload atlas pages to the GPU now (no hitch on the first game frames). */
function preupload(stage: PixelStage, sources: Array<{ source: unknown }>): void {
  const tex = (stage.app.renderer as unknown as { texture?: { initSource?(s: unknown): void } })
    .texture;
  if (!tex?.initSource) return;
  for (const s of sources) tex.initSource(s.source);
}

/** Job kinds that do not depend on the city (loaded once per page visit). */
const SHARED_KINDS = new Set<ArtJob['kind']>(['units', 'fx', 'vehicles', 'uikit']);

/** One city's art: critical set installed, deferred stages streaming in. */
export class ArtSession {
  readonly cityArt: CityArt = emptyCityArt();
  complete = false;
  /** Called after each deferred stage is installed (the running game refreshes its views). */
  onUpdate: (() => void) | null = null;
  /** Resolves when every deferred stage is installed. */
  readonly whenComplete: Promise<void>;
  private resolveComplete!: () => void;
  private disposed = false;
  loader: ArtLoader | null = null;
  /** Resolves once the critical set is installed. */
  critical: Promise<void> = Promise.resolve();

  constructor(readonly opts: CityArtOptions) {
    this.whenComplete = new Promise((r) => (this.resolveComplete = r));
  }

  get city(): CityId {
    return this.opts.city;
  }

  get alive(): boolean {
    return !this.disposed;
  }

  /** @internal */
  _markComplete(): void {
    this.complete = true;
    this.resolveComplete();
  }

  /** Stop streaming and free this city's atlas pages. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loader?.terminate();
    this.loader = null;
    for (const p of this.cityArt.pages) p.texture.destroy(true);
    this.cityArt.pages.length = 0;
  }
}

export class ArtStore {
  private readonly shared = emptyCityArt();
  private readonly sharedDone = new Set<string>();
  current: ArtSession | null = null;
  readonly timings: BootTimings = emptyTimings();

  constructor(
    private readonly stage: PixelStage,
    private readonly nocache = false,
  ) {}

  /** Can `opts` reuse the current session's art? */
  matches(opts: CityArtOptions): boolean {
    const c = this.current;
    return (
      !!c &&
      c.alive &&
      c.opts.city === opts.city &&
      c.opts.mapSeed === opts.mapSeed &&
      c.opts.seed === opts.seed &&
      c.opts.quality === opts.quality &&
      (opts.lean !== false || c.opts.lean === false || c.complete)
    );
  }

  private filter(jobs: readonly ArtJob[]): ArtJob[] {
    return jobs.filter((j) => !(SHARED_KINDS.has(j.kind) && this.sharedDone.has(j.kind)));
  }

  private async newLoader(): Promise<ArtLoader> {
    const loader = new ArtLoader();
    this.timings.workers = loader.workerCount;
    // Repeat visits: packed atlases come straight from IndexedDB (production builds only — the
    // hashed worker URL versions the cache).
    if (!import.meta.env.DEV && !this.nocache) {
      loader.cache = await ArtCache.open(await loader.version());
    }
    return loader;
  }

  private install(results: Parameters<typeof installResults>[0], jobs: ArtJob[], s: ArtSession) {
    const city = results.filter((_, k) => !SHARED_KINDS.has(jobs[k]!.kind));
    const shared = results.filter((_, k) => SHARED_KINDS.has(jobs[k]!.kind));
    installResults(shared, this.shared);
    installResults(city, s.cityArt);
    for (const j of jobs) if (SHARED_KINDS.has(j.kind)) this.sharedDone.add(j.kind);
    preupload(
      this.stage,
      [...this.shared.pages, ...s.cityArt.pages].map((p) => p.texture),
    );
  }

  /**
   * Art for a city: reuses the current session when it matches, else disposes it and loads the
   * critical set (progress 0..1), then streams the deferred stages in the background.
   */
  async load(opts: CityArtOptions, onProgress?: (p: number) => void): Promise<ArtSession> {
    if (this.matches(opts)) {
      await this.current!.critical;
      return this.current!;
    }
    this.current?.dispose();
    resetClipCache();
    const s = new ArtSession(opts);
    this.current = s;
    let doneCritical!: () => void;
    s.critical = new Promise((r) => (doneCritical = r));
    try {
      await this.loadInto(s, opts, onProgress);
    } finally {
      doneCritical();
    }
    return s;
  }

  private async loadInto(
    s: ArtSession,
    opts: CityArtOptions,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    const t0 = performance.now();
    const loader = await this.newLoader();
    s.loader = loader;
    const crit = this.filter(criticalJobs(opts));
    const results = await loader.run(crit, (done, total) => onProgress?.(done / total));
    if (!s.alive) return;
    this.install(results, crit, s);
    this.timings.criticalArt = performance.now() - t0;
    void (async () => {
      for (const stage of deferredStages(opts)) {
        const jobs = this.filter(stage);
        if (!s.alive) return;
        if (jobs.length > 0) {
          const r = await loader.run(jobs);
          if (!s.alive) return;
          this.install(r, jobs, s);
        }
        resetClipCache();
        s.onUpdate?.();
      }
      this.timings.deferredArt = performance.now() - t0;
      this.timings.jobs = loader.timings;
      loader.terminate();
      s.loader = null;
      s._markComplete();
      console.info(`[riot] all art ${this.timings.deferredArt.toFixed(0)} ms (${opts.city})`);
    })().catch((err: unknown) => console.warn('[riot] deferred art failed', err));
  }
}

/** Pixels of one sprite inside a packed (not installed) atlas. */
export function packedSprite(
  atlas: NonNullable<JobResult['atlas']>,
  name: string,
): PixelBuffer | null {
  const sp = atlas.sprites.find((x) => x.def.name === name);
  const f = sp?.frames[0];
  if (!sp || !f) return null;
  const page = atlas.pages[f.page];
  if (!page) return null;
  const b = createBuffer(sp.def.w, sp.def.h);
  for (let y = 0; y < sp.def.h; y++) {
    const o = ((f.y + y) * page.w + f.x) * 4;
    b.data.set(page.data.subarray(o, o + sp.def.w * 4), y * sp.def.w * 4);
  }
  return b;
}

/** Composite depth pieces (each with its own anchor) back into one image. Pure. */
export function assemblePieces(
  items: ReadonlyArray<{ buf: PixelBuffer; anchor: { x: number; y: number } }>,
): PixelBuffer | null {
  if (!items.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const it of items) {
    x0 = Math.min(x0, -it.anchor.x);
    y0 = Math.min(y0, -it.anchor.y);
    x1 = Math.max(x1, it.buf.w - it.anchor.x);
    y1 = Math.max(y1, it.buf.h - it.anchor.y);
  }
  const out = createBuffer(x1 - x0, y1 - y0);
  for (const it of items) {
    const ox = -it.anchor.x - x0;
    const oy = -it.anchor.y - y0;
    for (let y = 0; y < it.buf.h; y++)
      for (let x = 0; x < it.buf.w; x++) {
        const i = (y * it.buf.w + x) * 4;
        if (it.buf.data[i + 3] !== 255) continue;
        out.data.set(it.buf.data.subarray(i, i + 4), ((oy + y) * out.w + ox + x) * 4);
      }
  }
  return out;
}

/** Capitol (state 0) image assembled from a packed atlas's depth pieces. */
function packedCapitol(atlas: NonNullable<JobResult['atlas']>, city: CityId): PixelBuffer | null {
  const re = new RegExp(`^lm\\.cap\\.${city}\\.0\\.\\d+$`);
  const items: Array<{ buf: PixelBuffer; anchor: { x: number; y: number } }> = [];
  for (const sp of atlas.sprites) {
    if (!re.test(sp.def.name)) continue;
    const b = packedSprite(atlas, sp.def.name);
    if (b) items.push({ buf: b, anchor: sp.def.anchor });
  }
  return assemblePieces(items);
}

/**
 * Capitol art (state 0) of several cities as plain pixels (city-select postcards). Runs the
 * capitol jobs in a throwaway worker pool; nothing is installed on the GPU.
 */
export async function capitolPictures(
  cities: readonly CityId[],
  nocache = false,
): Promise<Map<CityId, PixelBuffer>> {
  const out = new Map<CityId, PixelBuffer>();
  const loader = new ArtLoader(Math.min(3, cities.length));
  try {
    if (!import.meta.env.DEV && !nocache) {
      loader.cache = await ArtCache.open(await loader.version());
    }
    const jobs: ArtJob[] = cities.map((city) => ({ kind: 'capitol', city, states: [0] }));
    const res = await loader.run(jobs);
    res.forEach((r, k) => {
      const city = cities[k]!;
      const b = r.atlas ? packedCapitol(r.atlas, city) : null;
      if (b) out.set(city, b);
    });
  } finally {
    loader.terminate();
  }
  return out;
}

/** Art options for a run (lean = the run opens at the camera start in the prep phase). */
export function cityArtOptions(params: GameParams, quality: QualityTier): CityArtOptions {
  return {
    city: params.city,
    mapSeed: params.mapSeed,
    seed: params.seed,
    quality,
    // Normal play opens at the camera start in the prep phase: only the ground around it and
    // a few first-wave looks are needed for the first frame. Debug jumps need everything.
    lean:
      params.skip === 0 &&
      params.stress === 0 &&
      !params.scene &&
      !params.focus &&
      params.camU === undefined &&
      params.camV === undefined,
  };
}

export interface CreateGameOptions {
  /** Attract mode (title backdrop): a bot plays, no audio. */
  attract?: boolean;
  /** Simulation seed (default params.seed; protester looks always use params.seed). */
  worldSeed?: number;
}

/** A new World + GameController for `params.city` on art that is already installed. */
export function createGame(
  stage: PixelStage,
  session: ArtSession,
  params: GameParams,
  quality: QualityTier,
  opts: CreateGameOptions = {},
): GameController {
  const map = loadMap(params.city, params.mapSeed);
  const world = new World(map, { seed: opts.worldSeed ?? params.seed, quality });
  applyDebugEconomy(world, params);
  if (params.stress > 0) stressSpawn(world, params.stress);
  const sceneFocus = params.scene ? setupScene(world, params.scene) : null;
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
  const game = new GameController(stage, world, session.cityArt, {
    quality,
    autoplay: params.autoplay,
    tod: params.tod,
    zoom: params.zoom,
    camU: params.camU,
    camV: params.camV,
  });
  if (opts.attract) game.attract = true;
  if (sceneFocus && !params.focus) game.focusTile(sceneFocus.i, sceneFocus.j);
  if (params.focus) focusOn(game, params.focus);
  session.onUpdate = () => {
    if (!game.destroyed) game.view.onArtUpdated();
  };
  return game;
}

/** ?level=N&hate=N — jump the economy (screenshots, debugging). */
function applyDebugEconomy(world: World, p: GameParams): void {
  if (p.level !== undefined) {
    const lvl = Math.max(0, Math.min(LEVELS.length - 1, Math.round(p.level)));
    world.economy.level = lvl;
    world.economy.legit = Math.max(LEVELS[lvl]!.legit, Math.round(p.legit ?? 0));
  }
  if (p.hate !== undefined) world.economy.hate = Math.max(0, Math.round(p.hate));
  if (p.wave !== undefined && p.wave > 1)
    world.director.wave = Math.min(60, Math.round(p.wave)) - 1;
}

/** ?stress=N — N protesters marching from every district at once (perf profiling). */
function stressSpawn(world: World, n: number): void {
  const map = world.map;
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
}

/** Debug camera focus: `crowd` (densest crowd), `climb` (a roof with climbers), `gas`, `units`. */
export function focusOn(game: GameController, what: string): void {
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
  const c = densestCrowd(game);
  game.focusTile(c.i, c.j);
}

/** Tile with the most protesters around it (7×7 window, sampled every 2 tiles). */
export function densestCrowd(game: GameController): { i: number; j: number; n: number } {
  const w = game.world;
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
  return { i: bi, j: bj, n: Math.max(0, best) };
}

/**
 * M11 procedural audio for a running game: sim events → SFX, the listener follows the camera,
 * music follows the run. Returns a per-frame function (call it after each rendered frame).
 */
export function bindGameAudio(game: GameController, audio: Audio): (dtMs: number) => void {
  const w = game.world;
  audio.setCity(w.map.city);
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
  return (dtMs) => {
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
}
