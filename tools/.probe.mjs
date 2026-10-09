// Scratch probe (M8): open the built game, collect console + timings + fps, screenshot.
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const root = resolve(import.meta.dirname, '..');
const [query = 'city=madrid', out = 'probe', secs = '3', vpName = 'desktop', gpu = 'swift'] = process.argv.slice(2);
const VP = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  portrait: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const server = await preview({ root, logLevel: 'warn', preview: { port: 0, host: '127.0.0.1' } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  args: gpu === 'swift' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu'],
});
const ctx = await browser.newContext({ viewport: { width: VP[vpName].width, height: VP[vpName].height }, deviceScaleFactor: VP[vpName].deviceScaleFactor, isMobile: VP[vpName].isMobile, hasTouch: VP[vpName].hasTouch });
const page = await ctx.newPage();
page.on('console', (m) => console.log(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.stack}`));
const t0 = Date.now();
await page.goto(new URL(`index.html?${query}`, url).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 120000 });
console.log('ready after', Date.now() - t0, 'ms');
const res = await page.evaluate(async (secs) => {
  const r = window.__riot;
  const p = r.game.perf; p.sim = p.view = p.render = p.frames = 0;
  let frames = 0; let worst = 0; let last = performance.now(); const t0 = last;
  await new Promise((done) => {
    const f = (t) => { frames++; worst = Math.max(worst, t - last); last = t; if (t - t0 < secs * 1000) requestAnimationFrame(f); else done(); };
    requestAnimationFrame(f);
  });
  const el = performance.now() - t0;
  const pf = { sim: p.sim / p.frames, view: p.view / p.frames, render: p.render / p.frames };
  return { fps: (frames * 1000) / el, worst, perf: pf, timings: r.timings, crowd: r.world.crowd.count, units: r.world.units.count, stats: r.view.stats, tick: r.world.tick };
}, Number(secs));
console.log(JSON.stringify({ ...res, timings: { ...res.timings, jobs: res.timings.jobs.map((j) => `${j.job}:${j.ms.toFixed(0)}`).join(' ') } }, null, 1));
await page.screenshot({ path: resolve(root, 'shots', `${out}.png`) });
await browser.close();
await server.close();
