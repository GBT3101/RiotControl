#!/usr/bin/env node
/**
 * Interaction smoke test for the game page (Playwright Chromium, uses the existing dist/):
 * mouse drag pans, wheel zooms to an integer level, a click is a tap (not a drag), keys pan,
 * touch tap works on a phone viewport. Run `npm run build` first.  Exit 1 on failure.
 */
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { preview } from 'vite';

const root = resolve(import.meta.dirname, '..');
const server = await preview({ root, logLevel: 'warn', preview: { port: 0, host: '127.0.0.1' } });
const url = new URL('index.html?cops=10', server.resolvedUrls.local[0]).href;
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};
const state = (page) =>
  page.evaluate(() => {
    const r = window.__riot;
    return { x: r.camera.x, y: r.camera.y, zoom: r.camera.zoom, target: r.camera.targetZoom };
  });

try {
  // --- Desktop mouse / keyboard ---------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const taps = [];
  await page.exposeFunction('__tap', (t) => taps.push(t));
  await page.evaluate(() => window.__riot.input.events.on('tap', (e) => window.__tap(e)));

  const s0 = await state(page);
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(540, 350, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const s1 = await state(page);
  check(
    s1.x > s0.x && s1.y > s0.y,
    `mouse drag pans (Δ ${(s1.x - s0.x).toFixed(1)}, ${(s1.y - s0.y).toFixed(1)})`,
  );
  check(taps.length === 0, 'a drag does not emit a tap');

  await page.mouse.click(700, 420);
  await page.waitForTimeout(100);
  check(
    taps.length === 1 && Number.isInteger(taps[0].i),
    `click emits a tap with tile coords (${taps[0]?.i},${taps[0]?.j})`,
  );

  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(800);
  const s2 = await state(page);
  check(
    s2.zoom === s1.zoom + 1 && Number.isInteger(s2.zoom),
    `wheel zooms in to an integer level (${s1.zoom} → ${s2.zoom})`,
  );

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  const s3 = await state(page);
  check(s3.x > s2.x, 'D key pans right');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await ctx.close();

  // --- Phone touch ------------------------------------------------------------------------------
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const pp = await phone.newPage();
  await pp.goto(url);
  await pp.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const ptaps = [];
  await pp.exposeFunction('__tap', (t) => ptaps.push(t));
  await pp.evaluate(() => window.__riot.input.events.on('tap', (e) => window.__tap(e)));
  await pp.touchscreen.tap(200, 400);
  await pp.waitForTimeout(100);
  check(ptaps.length === 1 && ptaps[0].pointerType === 'touch', 'touch tap emits a tap');
  // Two-finger pinch-out via CDP touch events → zoom in, settling on an integer level.
  const z0 = (await state(pp)).zoom;
  const cdp = await phone.newCDPSession(pp);
  const touch = (type, pts) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: pts.map(([x, y], id) => ({ x, y, id })),
    });
  await touch('touchStart', [
    [170, 400],
    [220, 400],
  ]);
  for (let k = 1; k <= 10; k++) {
    await touch('touchMove', [
      [170 - k * 8, 400],
      [220 + k * 8, 400],
    ]);
  }
  await touch('touchEnd', []);
  await pp.waitForTimeout(800);
  const z1 = await state(pp);
  check(
    z1.zoom > z0 && Number.isInteger(z1.zoom),
    `pinch zooms in and settles (${z0} → ${z1.zoom})`,
  );
  check(ptaps.length === 1, 'a pinch does not emit a tap');
  const dims = await pp.evaluate(() => {
    const c = document.querySelector('canvas');
    return { w: c.width, h: c.height, scrollY: window.scrollY, bodyH: document.body.scrollHeight };
  });
  check(
    dims.w === 1170 && dims.h === 2532,
    `canvas backing store is device pixels (${dims.w}×${dims.h})`,
  );
  check(dims.scrollY === 0 && dims.bodyH <= 844, 'page does not scroll');
  await phone.close();
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  console.error(`${failures.length} smoke check(s) failed.`);
  process.exit(1);
}
