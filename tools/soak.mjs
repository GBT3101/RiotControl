#!/usr/bin/env node
/**
 * Soak / bug-bash run (M13b): plays real games in headless Chromium and records everything that
 * goes wrong — console errors & warnings, page errors, unhandled rejections, failed requests,
 * JS heap growth across restarts (after forced GC), Pixi scene-graph / texture / listener /
 * worker / audio-node growth, long tasks and per-frame JS cost (sim / view / render).
 *
 *   node tools/soak.mjs                       # flows + victory & defeat game for every city
 *   node tools/soak.mjs --only flows          # menu flows + restart leak check only
 *   node tools/soak.mjs --only games --cities paris --speed 60
 *   node tools/soak.mjs --no-build --dist /tmp/dist --json shots/soak.json
 *
 * Games: `?city=X&autoplay=1&bot=escalate` (victory) and `bot=passive` (defeat); the loop's time
 * scale is raised to `--speed` (default 40×) so a 45-minute run takes a few minutes. Each game
 * then goes through the end screen (newspaper → ledger → buttons).
 *
 * Flows: title → (Enter) city select → (1) Madrid → Esc pause → settings → close → resume → 3×
 * restart (heap after GC each time) → other city → London → defeat → end screen → play again
 * → quit to title.
 *
 * Exit 1 on any page error / console error, or when the heap grows > --leak-mb across restarts.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { build, preview } from 'vite';

const root = resolve(import.meta.dirname, '..');
const { values: args } = parseArgs({
  options: {
    only: { type: 'string', default: 'all' },
    cities: { type: 'string', default: 'madrid,london,paris' },
    speed: { type: 'string', default: '40' },
    viewport: { type: 'string', default: '1024x640' },
    'no-build': { type: 'boolean', default: false },
    dist: { type: 'string', default: 'dist' },
    json: { type: 'string' },
    'leak-mb': { type: 'string', default: '12' },
    'max-minutes': { type: 'string', default: '70' },
    restarts: { type: 'string', default: '3' },
  },
});
const cities = args.cities.split(',').filter(Boolean);
const speed = Number(args.speed) || 40;
const [vw, vh] = args.viewport.split('x').map(Number);
const outDir = resolve(root, args.dist);

if (!args['no-build']) {
  console.log(`Building into ${outDir}…`);
  await build({ root, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
}
const server = await preview({
  root,
  logLevel: 'warn',
  build: { outDir },
  preview: { port: 0, host: '127.0.0.1' },
});
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--js-flags=--expose-gc',
  ],
});

/** Page instrumentation: listeners, workers, audio nodes, long tasks, frame deltas. */
const INSTRUMENT = () => {
  Error.stackTraceLimit = 40;
  const S = (window.__soak = {
    listeners: 0,
    listenersByTarget: {},
    workers: 0,
    audioNodes: 0,
    longTasks: [],
    frames: [],
    rejections: [],
  });
  const kind = (t) =>
    t === window ? 'window' : t === document ? 'document' : t?.tagName ? t.tagName : t?.constructor?.name ?? '?';
  const live = new WeakMap();
  const add = EventTarget.prototype.addEventListener;
  const rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (fn) {
      let m = live.get(this);
      if (!m) live.set(this, (m = new Set()));
      const cap = typeof opts === 'boolean' ? opts : !!opts?.capture;
      const key = `${type}|${cap}`;
      let set = m[key];
      if (!set) set = m[key] = new Set();
      if (!set.has(fn)) {
        set.add(fn);
        S.listeners++;
        const k = `${kind(this)}:${type}`;
        S.listenersByTarget[k] = (S.listenersByTarget[k] ?? 0) + 1;
      }
    }
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    const m = live.get(this);
    const cap = typeof opts === 'boolean' ? opts : !!opts?.capture;
    const set = m?.[`${type}|${cap}`];
    if (set?.delete(fn)) {
      S.listeners--;
      const k = `${kind(this)}:${type}`;
      S.listenersByTarget[k] = (S.listenersByTarget[k] ?? 0) - 1;
    }
    return rem.call(this, type, fn, opts);
  };
  const W = window.Worker;
  window.Worker = class extends W {
    constructor(...a) {
      super(...a);
      S.workers++;
    }
    terminate() {
      S.workers--;
      super.terminate();
    }
  };
  if (window.BaseAudioContext) {
    for (const name of Object.getOwnPropertyNames(BaseAudioContext.prototype)) {
      if (!name.startsWith('create')) continue;
      const f = BaseAudioContext.prototype[name];
      if (typeof f !== 'function') continue;
      BaseAudioContext.prototype[name] = function (...a) {
        S.audioNodes++;
        return f.apply(this, a);
      };
    }
  }
  S.draws = 0;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = C.prototype[name];
      if (!f) continue;
      C.prototype[name] = function (...a) {
        S.draws++;
        return f.apply(this, a);
      };
    }
  }
  window.addEventListener('unhandledrejection', (e) =>
    S.rejections.push(String(e.reason?.stack ?? e.reason)),
  );
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) S.longTasks.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* no long-task API */
  }
  let last = 0;
  const raf = (t) => {
    if (last) S.frames.push(t - last);
    if (S.frames.length > 20000) S.frames.splice(0, 10000);
    last = t;
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
};

async function newPage(viewport = { width: vw, height: vh }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(INSTRUMENT);
  const page = await context.newPage();
  const log = { errors: [], warnings: [] };
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') log.errors.push(t);
    else if (m.type() === 'warning' && !/GPU stall|WebGL|swiftshader/i.test(t)) log.warnings.push(t);
  });
  page.on('pageerror', (e) =>
    log.errors.push(`pageerror @${log.step ?? '?'}: ${e.stack ?? e.message}`),
  );
  page.on('requestfailed', (r) => log.errors.push(`requestfailed: ${r.url()}`));
  const cdp = await context.newCDPSession(page);
  return { context, page, log, cdp };
}

const waitReady = (page, timeout = 60000) =>
  page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout });
const waitFor = (page, fn, arg, timeout = 60000) =>
  page.waitForFunction(fn, arg, { timeout, polling: 200 });

/** Heap after a forced GC (MB) + scene/texture/listener/worker/audio counters. */
async function snapshot(page, cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(300);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  const extra = await page.evaluate(() => {
    const r = window.__riot;
    let nodes = 0;
    const dead = [];
    const walk = (c, path) => {
      nodes++;
      const t = c.texture;
      if (c.anchor && t && (t.destroyed || !t.source || t.source.destroyed || !t.source.style))
        dead.push(`${path}/${c.label || c.constructor.name} tex=${t.label}`);
      for (const ch of c.children ?? []) walk(ch, `${path}/${c.label || c.constructor.name}`);
    };
    walk(r.stage.app.stage, '');
    const ts = r.stage.app.renderer.texture;
    const S = window.__soak;
    const texByLabel = {};
    const managed = (ts?.managedTextures ?? []).filter(Boolean);
    for (const t of managed) {
      const k = `${t.label ?? '?'}:${t.width}x${t.height}`;
      texByLabel[k] = (texByLabel[k] ?? 0) + 1;
    }
    return {
      dead,
      texByLabel,
      nodes,
      textures: managed.length,
      listeners: S.listeners,
      workers: S.workers,
      audioNodes: S.audioNodes,
      byTarget: { ...S.listenersByTarget },
    };
  });
  return { heapMB: +(usedSize / 1048576).toFixed(1), ...extra };
}

/** Frame stats since the last call (rAF deltas, long tasks, game JS per frame). */
async function frameStats(page) {
  return page.evaluate(() => {
    const S = window.__soak;
    const f = S.frames.splice(0).sort((a, b) => a - b);
    const lt = S.longTasks.splice(0);
    const q = (p) => (f.length ? +f[Math.min(f.length - 1, Math.floor(f.length * p))].toFixed(1) : 0);
    const g = window.__riot.game;
    let perf = null;
    if (g) {
      const n = Math.max(1, g.perf.frames);
      perf = {
        frames: g.perf.frames,
        simMs: +(g.perf.sim / n).toFixed(2),
        viewMs: +(g.perf.view / n).toFixed(2),
        renderMs: +(g.perf.render / n).toFixed(2),
      };
      g.perf.sim = g.perf.view = g.perf.render = g.perf.frames = 0;
    }
    return {
      frames: f.length,
      p50: q(0.5),
      p95: q(0.95),
      max: q(1),
      over100: f.filter((x) => x > 100).length,
      longTasks: lt.length,
      longTaskMax: lt.length ? Math.max(...lt) : 0,
      perf,
    };
  });
}

const report = { when: new Date().toISOString(), viewport: args.viewport, speed, flows: null, games: [] };
let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`✗ ${msg}`);
};

// ── Flows ──────────────────────────────────────────────────────────────────────────────────
async function flows() {
  console.log('\n== Flows: title → select → game → pause → settings → restart ×N → other city → end');
  const { context, page, log, cdp } = await newPage();
  const screens = [];
  await page.exposeFunction('__soakScreen', (n) => screens.push(n));
  const t0 = Date.now();
  await page.goto(new URL('index.html?tutorial=0&hints=0', base).href);
  await waitReady(page);
  await page.evaluate(() => window.__riot.ui.bus.on('screen', (e) => window.__soakScreen(e.name)));
  const mode = () => page.evaluate(() => window.__riot.ui.mode);
  const inRun = () =>
    waitFor(page, () => {
      const ui = window.__riot.ui;
      return ui.mode === 'game' && ui.game && !ui.game.attract && ui.hud && ui.game.perf.frames > 5;
    });
  const step = async (name, fn) => {
    const s = Date.now();
    log.step = name;
    await fn();
    console.log(`  ✓ ${name} (${Date.now() - s} ms)`);
  };
  const r = { steps: [], heap: [], errors: log.errors, warnings: log.warnings };
  await step('title shown', async () => {
    if ((await mode()) !== 'title') throw new Error(`mode ${await mode()}`);
  });
  r.heap.push({ at: 'title', ...(await snapshot(page, cdp)) });
  await step('Enter → city select', async () => {
    await page.keyboard.press('Enter');
    await waitFor(page, () => window.__riot.ui.mode === 'select');
  });
  await page.waitForTimeout(1500);
  await step('1 → Madrid run', async () => {
    await page.keyboard.press('Digit1');
    await inRun();
  });
  await page.waitForTimeout(1500);
  await step('Esc → pause menu', async () => {
    await page.keyboard.press('Escape');
    await waitFor(page, () => window.__riot.ui.topScreen?.constructor?.name && window.__riot.ui.game.paused);
  });
  await step('settings → close → resume', async () => {
    await page.evaluate(() => window.__riot.ui.openSettings(true));
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await waitFor(page, () => !window.__riot.ui.topScreen && !window.__riot.ui.game.paused);
  });
  await step('start waves, play 6 s at 3×', async () => {
    await page.keyboard.press('Enter');
    await page.keyboard.press('KeyF');
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(6000);
  });
  r.heap.push({ at: 'run 1', ...(await snapshot(page, cdp)) });
  const n = Number(args.restarts) || 3;
  for (let k = 0; k < n; k++) {
    await step(`restart ${k + 1}/${n}`, async () => {
      await page.evaluate(() => window.__riot.ui.restart());
      await inRun();
      await page.evaluate(() => {
        window.__riot.ui.game.startWaves();
        window.__riot.ui.game.setSpeed(3);
      });
      await page.waitForTimeout(6000);
    });
    r.heap.push({ at: `restart ${k + 1}`, ...(await snapshot(page, cdp)) });
  }
  await step('quit → title → other city → London', async () => {
    await page.evaluate(() => window.__riot.ui.otherCity());
    await waitFor(page, () => window.__riot.ui.mode === 'select');
    await page.waitForTimeout(800);
    await page.keyboard.press('Digit2');
    await inRun();
  });
  await step('London: defeat → end screen', async () => {
    await page.evaluate(() => {
      const w = window.__riot.ui.game.world;
      w.startWaves();
      w.capitol.damage(w, w.capitol.hp + 1);
    });
    await waitFor(page, () => window.__riot.ui.mode === 'end', null, 30000);
  });
  await step('end screen: skip → buttons → play again (Enter)', async () => {
    for (let k = 0; k < 6; k++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    await page.keyboard.press('Enter');
    await inRun();
  });
  await step('quit to title', async () => {
    await page.evaluate(() => window.__riot.ui.quitToTitle());
    await waitFor(page, () => window.__riot.ui.mode === 'title');
    await page.waitForTimeout(1500);
  });
  r.heap.push({ at: 'title again', ...(await snapshot(page, cdp)) });
  r.frames = await frameStats(page);
  r.screens = screens;
  r.rejections = await page.evaluate(() => window.__soak.rejections);
  r.wallS = Math.round((Date.now() - t0) / 1000);
  await context.close();
  // Leak verdict: heap across the restarts (same city, same art).
  const restarts = r.heap.filter((h) => h.at.startsWith('restart'));
  const first = r.heap.find((h) => h.at === 'run 1');
  const last = restarts[restarts.length - 1];
  r.growth = {
    heapMB: +(last.heapMB - first.heapMB).toFixed(1),
    nodes: last.nodes - first.nodes,
    textures: last.textures - first.textures,
    listeners: last.listeners - first.listeners,
    workers: last.workers - first.workers,
  };
  console.log('  heap (MB after GC):', r.heap.map((h) => `${h.at} ${h.heapMB}`).join(' · '));
  console.log('  growth run 1 → last restart:', JSON.stringify(r.growth));
  if (r.growth.heapMB > Number(args['leak-mb'])) fail(`heap grew ${r.growth.heapMB} MB across restarts`);
  if (r.growth.listeners > 2) fail(`listeners grew by ${r.growth.listeners} across restarts`);
  if (r.growth.workers > 0) fail(`workers grew by ${r.growth.workers}`);
  if (r.growth.nodes > 50) fail(`scene graph grew by ${r.growth.nodes} nodes`);
  if (log.errors.length) fail(`flows: ${log.errors.length} console/page errors`);
  if (r.rejections.length) fail(`flows: ${r.rejections.length} unhandled rejections`);
  report.flows = r;
}

// ── Games ──────────────────────────────────────────────────────────────────────────────────
async function game(city, bot) {
  const want = bot === 'passive' ? 'defeat' : 'victory';
  console.log(`\n== ${city} · ${bot} (expect ${want}) at ${speed}×`);
  const { context, page, log, cdp } = await newPage();
  const t0 = Date.now();
  await page.goto(
    new URL(`index.html?city=${city}&autoplay=1&bot=${bot}&tutorial=0&hints=0`, base).href,
  );
  await waitReady(page);
  // Time the bot's decisions (the controller's private bot).
  await page.evaluate((s) => {
    const g = window.__riot.ui.game;
    const b = g.bot;
    const S = window.__soak;
    S.bot = { n: 0, total: 0, max: 0, over8: 0 };
    const upd = b.update.bind(b);
    b.update = () => {
      const a = performance.now();
      upd();
      const d = performance.now() - a;
      if (d > 0.05) {
        S.bot.n++;
        S.bot.total += d;
        if (d > S.bot.max) S.bot.max = d;
        if (d > 8) S.bot.over8++;
      }
    };
    // Raw loop time scale (the HUD speed button only knows 1×/2×/3×).
    g.loop.timeScale = s;
  }, speed);
  const start = await snapshot(page, cdp);
  await frameStats(page);
  const samples = [];
  const maxMs = Number(args['max-minutes']) * 60 * 1000;
  let st;
  while (Date.now() - t0 < maxMs) {
    await page.waitForTimeout(10000);
    st = await page.evaluate(() => {
      const ui = window.__riot.ui;
      const w = ui.game.world;
      return {
        mode: ui.mode,
        phase: w.phase,
        time: Math.round(w.time),
        wave: w.director.wave,
        level: w.level,
        crowd: w.crowd.count,
        units: w.units.count,
        integrity: +w.capitol.integrity.toFixed(2),
        hate: w.hate,
        legit: w.legit,
      };
    });
    const fs = await frameStats(page);
    samples.push({ ...st, ...fs });
    process.stdout.write(
      `  t=${st.time}s w${st.wave} L${st.level} crowd ${st.crowd} cap ${st.integrity} · frame p50 ${fs.p50} p95 ${fs.p95} max ${fs.max} · JS sim ${fs.perf?.simMs} view ${fs.perf?.viewMs} render ${fs.perf?.renderMs}\n`,
    );
    if (st.phase !== 'playing') break;
  }
  let endOk = false;
  if (st.phase !== 'playing') {
    // Slow down so the end screen runs at real time.
    await page.evaluate(() => (window.__riot.ui.game.loop.timeScale = 1));
    try {
      await waitFor(page, () => window.__riot.ui.mode === 'end', null, 20000);
      for (let k = 0; k < 6; k++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(1000);
      endOk = await page.evaluate(() => window.__riot.ui.topScreen?.phase === 'done');
    } catch {
      endOk = false;
    }
  }
  const end = await snapshot(page, cdp);
  const ledger = await page.evaluate(() => {
    const w = window.__riot.ui.game?.world;
    if (!w) return null;
    const s = w.stats;
    return {
      hateEarned: s.hateEarned,
      hateSpent: s.hateSpent,
      hateNow: w.hate,
      startHate: 100,
      consistent: 100 + s.hateEarned - s.hateSpent === w.hate,
      peakCrowd: s.peakCrowd,
    };
  });
  const bot_ = await page.evaluate(() => window.__soak.bot);
  const rejections = await page.evaluate(() => window.__soak.rejections);
  await context.close();
  const peakCrowd = ledger?.peakCrowd ?? Math.max(...samples.map((s) => s.crowd));
  const heavy = samples.filter((s) => s.crowd >= 1500 && s.perf);
  const avg = (arr, k) =>
    arr.length ? +(arr.reduce((a, s) => a + s.perf[k], 0) / arr.length).toFixed(2) : null;
  const res = {
    city,
    bot,
    outcome: st.phase,
    expected: want,
    endScreen: endOk,
    simTime: st.time,
    wave: st.wave,
    level: st.level,
    peakCrowd,
    wallS: Math.round((Date.now() - t0) / 1000),
    heapStartMB: start.heapMB,
    heapEndMB: end.heapMB,
    texturesStart: start.textures,
    texturesEnd: end.textures,
    textureGrowth: Object.entries(end.texByLabel)
      .map(([k, v]) => [k.replace(/\d+/g, '#'), v - (start.texByLabel[k] ?? 0)])
      .filter(([, d]) => d > 0)
      .reduce((m, [k, d]) => ((m[k] = (m[k] ?? 0) + d), m), {}),
    nodesEnd: end.nodes,
    botDecisions: bot_ && {
      n: bot_.n,
      avgMs: +(bot_.total / Math.max(1, bot_.n)).toFixed(2),
      maxMs: +bot_.max.toFixed(1),
      over8ms: bot_.over8,
    },
    heavyJs: heavy.length
      ? { sim: avg(heavy, 'simMs'), view: avg(heavy, 'viewMs'), render: avg(heavy, 'renderMs') }
      : null,
    worstFrame: Math.max(...samples.map((s) => s.max)),
    longTasks: samples.reduce((a, s) => a + s.longTasks, 0),
    ledger,
    errors: log.errors,
    warnings: [...new Set(log.warnings)],
    rejections,
  };
  console.log(
    `  → ${res.outcome} (${res.endScreen ? 'end screen ok' : 'END SCREEN MISSING'}) t=${res.simTime}s wave ${res.wave}, peak ${peakCrowd}, heap ${res.heapStartMB} → ${res.heapEndMB} MB, bot max ${res.botDecisions?.maxMs} ms, wall ${res.wallS}s`,
  );
  if (res.outcome !== want) fail(`${city}/${bot}: ${res.outcome}, expected ${want}`);
  if (!res.endScreen) fail(`${city}/${bot}: end screen did not finish`);
  if (ledger && !ledger.consistent) fail(`${city}/${bot}: Hate ledger inconsistent ${JSON.stringify(ledger)}`);
  if (log.errors.length) fail(`${city}/${bot}: ${log.errors.length} console/page errors`);
  if (rejections.length) fail(`${city}/${bot}: unhandled rejections`);
  for (const e of log.errors.slice(0, 5)) console.error(`    ${e.slice(0, 300)}`);
  for (const e of res.warnings.slice(0, 5)) console.warn(`    warn: ${e.slice(0, 200)}`);
  report.games.push(res);
}

// ── Perf probes ────────────────────────────────────────────────────────────────────────────
/** Per-frame JS cost of a scene: game.perf (sim/view/render) + view sub-timings + draw calls. */
async function probe(name, query, viewport, opts = {}) {
  const { context, page, log } = await newPage(viewport);
  await page.goto(new URL(`index.html?${query}`, base).href);
  await waitReady(page, 90000);
  if (opts.title)
    await waitFor(page, () => window.__riot.ui.game?.attract && window.__riot.ui.game.perf.frames > 3);
  await page.waitForTimeout(opts.settle ?? 3000);
  await page.evaluate(() => {
    const g = window.__riot.ui.game;
    const S = window.__soak;
    S.bot = { n: 0, total: 0, max: 0, over8: 0 };
    const b = g.bot;
    if (b) {
      const upd = b.update.bind(b);
      b.update = () => {
        const a = performance.now();
        upd();
        const d = performance.now() - a;
        if (d > 0.05) {
          S.bot.n++;
          S.bot.total += d;
          if (d > S.bot.max) S.bot.max = d;
          if (d > 8) S.bot.over8++;
        }
      };
    }
    const T = g.view.timing;
    for (const k of Object.keys(T)) T[k] = 0;
    g.perf.sim = g.perf.view = g.perf.render = g.perf.frames = 0;
    g.perf.ui = g.perf.ticks = 0;
    S.ticks0 = g.world.tick;
    S.draws = 0;
    S.frames.length = 0;
    S.longTasks.length = 0;
  });
  await page.waitForTimeout(opts.ms ?? 15000);
  const r = await page.evaluate(() => {
    const g = window.__riot.ui.game;
    const S = window.__soak;
    const n = Math.max(1, g.perf.frames);
    const T = g.view.timing;
    const tf = Math.max(1, T.frames);
    const sub = {};
    for (const k of Object.keys(T)) if (k !== 'frames') sub[k] = +(T[k] / tf).toFixed(2);
    const f = [...S.frames].sort((a, b) => a - b);
    const ticks = Math.max(1, g.world.tick - S.ticks0);
    return {
      frames: g.perf.frames,
      simMsPerTick: +(g.perf.sim / ticks).toFixed(2),
      viewMs: +(g.perf.view / n).toFixed(2),
      uiMs: g.perf.ui === undefined ? null : +(g.perf.ui / n).toFixed(2),
      renderMs: +(g.perf.render / n).toFixed(2),
      sub,
      drawsPerFrame: +(S.draws / n).toFixed(1),
      frameP50: f.length ? +f[Math.floor(f.length / 2)].toFixed(1) : 0,
      crowd: g.world.crowd.count,
      drawn: g.view.stats?.protesters ?? g.view.protesters.visibleCount,
      bot: S.bot.n ? { n: S.bot.n, avgMs: +(S.bot.total / S.bot.n).toFixed(2), maxMs: +S.bot.max.toFixed(1) } : null,
      quality: window.__riot.ui.quality?.(window.__riot.ui.params) ?? null,
    };
  });
  r.errors = log.errors;
  await context.close();
  console.log(`  ${name}: ${JSON.stringify(r)}`);
  return r;
}

async function perf() {
  console.log('\n== Perf probes');
  const desk = { width: 1440, height: 900 };
  report.perf = {
    stress3000: await probe('stress 3000 (Madrid, crowd)', 'city=madrid&stress=3000&focus=crowd&tutorial=0&hints=0&mute', desk),
    stress3000far: await probe('stress 3000 zoomed out', 'city=madrid&stress=3000&focus=crowd&zoom=1&tutorial=0&hints=0&mute', desk),
    title: await probe('title attract bot', 'mute', desk, { title: true, settle: 1500 }),
  };
}

// ── Touch-target audit ─────────────────────────────────────────────────────────────────────
/** Every visible tappable UI node smaller than 44×44 CSS px (hit rect incl. padding). */
async function touchAudit() {
  console.log('\n== Touch targets (≥ 44 CSS px) on phones');
  const out = {};
  const phones = {
    'phone-landscape': { width: 844, height: 390 },
    'phone-portrait': { width: 390, height: 844 },
  };
  for (const [vpName, vp] of Object.entries(phones)) {
    const context = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(INSTRUMENT);
    const page = await context.newPage();
    await page.goto(new URL('index.html?mute&tutorial=0&hints=0', base).href);
    await waitReady(page, 90000);
    const scan = (label) =>
      page.evaluate((label) => {
        const ui = window.__riot.ui;
        const small = [];
        const walk = (c, path) => {
          if (!c.visible || c.alpha <= 0.01) return;
          const h = c.__ui;
          const name = c.label || c.constructor.name;
          if (h && (h.tap || h.longPress) && !h.blockOnly && !h.disabled) {
            const r = h.hit ? (typeof h.hit === 'function' ? h.hit() : h.hit) : null;
            const b = r ?? (() => { const q = c.getLocalBounds(); return { x: q.x, y: q.y, w: q.width, h: q.height }; })();
            const a = c.toGlobal({ x: b.x, y: b.y });
            const z = c.toGlobal({ x: b.x + b.w, y: b.y + b.h });
            const dpr = window.devicePixelRatio;
            const w = (z.x - a.x) / dpr;
            const hh = (z.y - a.y) / dpr;
            if (w < 43.5 || hh < 43.5) small.push(`${label} ${path}/${name} ${w.toFixed(0)}×${hh.toFixed(0)}`);
          }
          for (const ch of c.children ?? []) walk(ch, `${path}/${name}`);
        };
        walk(ui.hudLayer, '');
        walk(ui.topLayer, '');
        return small;
      }, label);
    const found = [];
    found.push(...(await scan('title')));
    await page.evaluate(() => window.__riot.ui.showCitySelect(true));
    await page.waitForTimeout(1500);
    found.push(...(await scan('select')));
    await page.evaluate(() => window.__riot.ui.startRun('madrid'));
    await waitFor(page, () => window.__riot.ui.mode === 'game' && window.__riot.ui.hud);
    await page.waitForTimeout(1500);
    found.push(...(await scan('hud')));
    await page.evaluate(() => {
      const g = window.__riot.ui.game;
      g.world.economy.hate = 500;
      g.beginDeploy('riot');
    });
    await page.waitForTimeout(500);
    found.push(...(await scan('deploy')));
    await page.evaluate(() => {
      const ui = window.__riot.ui;
      ui.game.beginDeploy(null);
      ui.openPause();
    });
    await page.waitForTimeout(800);
    found.push(...(await scan('pause')));
    await page.evaluate(() => window.__riot.ui.openSettings());
    await page.waitForTimeout(800);
    found.push(...(await scan('settings')));
    await page.evaluate(() => {
      const ui = window.__riot.ui;
      ui.pop();
      ui.closePause();
      ui.showEnd(true);
    });
    await page.waitForTimeout(1000);
    for (let k = 0; k < 8; k++) {
      await page.evaluate(() => window.__riot.ui.screenKey('Space'));
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(2000);
    found.push(...(await scan('end')));
    out[vpName] = found;
    console.log(`  ${vpName}: ${found.length ? found.join('\n    ') : 'all ≥ 44 CSS px'}`);
    await context.close();
  }
  report.touch = out;
}

try {
  if (args.only === 'touch') await touchAudit();
  if (args.only === 'perf') await perf();
  if (args.only === 'all' || args.only === 'flows') await flows();
  if (args.only === 'all' || args.only === 'games') {
    for (const city of cities) {
      await game(city, 'escalate');
      await game(city, 'passive');
    }
  }
} catch (err) {
  fail(`soak aborted: ${err.stack ?? err}`);
} finally {
  await browser.close();
  await server.close();
}
if (args.json) {
  const f = resolve(root, args.json);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(report, null, 2));
  console.log(`\nreport → ${f}`);
}
console.log(failed ? '\nSOAK: FAILURES (see above)' : '\nSOAK: OK');
process.exit(failed ? 1 : 0);
