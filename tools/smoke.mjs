#!/usr/bin/env node
/**
 * Interaction smoke test for the game page (Playwright Chromium, uses the existing dist/):
 * mouse drag pans, wheel zooms to an integer level, a click is a tap (not a drag), keys pan,
 * touch tap works on a phone viewport; M9 UI: taps on HUD cards never reach the world, card →
 * deploy mode, hotkeys, Space pause, title → city select; M10: the first-run briefing shows,
 * advances on a deploy and SKIP BRIEFING ends it (persisted). Run `npm run build` first.
 * Exit 1 on failure.
 */
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { preview } from 'vite';

const root = resolve(import.meta.dirname, '..');
const server = await preview({ root, logLevel: 'warn', preview: { port: 0, host: '127.0.0.1' } });
const base = server.resolvedUrls.local[0];
// The first-run briefing is off for the interaction checks (it has its own block below).
const url = new URL('index.html?city=madrid&tutorial=0', base).href;
/** CSS-px centre of a UI rect (UI px × ui scale / dpr). */
const cssCentre = (page, expr) =>
  page.evaluate((e) => {
    const ui = window.__riot.ui;
    const r = new Function('ui', `return ${e}`)(ui);
    const k = ui.k / window.devicePixelRatio;
    return r ? { x: (r.x + r.w / 2) * k, y: (r.y + r.h / 2) * k } : null;
  }, expr);
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

  // M13b: a two-finger trackpad scroll (horizontal pixel deltas) pans instead of zooming.
  const sp0 = await state(page);
  for (let k = 0; k < 4; k++) await page.mouse.wheel(12, 6);
  await page.waitForTimeout(300);
  const sp1 = await state(page);
  check(
    sp1.x > sp0.x && sp1.zoom === sp0.zoom,
    `trackpad scroll pans without zooming (Δx ${(sp1.x - sp0.x).toFixed(1)}, zoom ${sp1.zoom})`,
  );
  await page.waitForTimeout(300);

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  const s3 = await state(page);
  check(s3.x > s2.x, 'D key pans right');

  // --- M9 HUD -------------------------------------------------------------------------------
  const nTaps = taps.length;
  const card = await cssCentre(page, "ui.hud.deploy.cardRect('riot')");
  await page.mouse.click(card.x, card.y);
  await page.waitForTimeout(150);
  check(
    (await page.evaluate(() => window.__riot.game.deployUnit)) === 'riot',
    'clicking the Riot Control card enters deploy mode',
  );
  check(taps.length === nTaps, 'a HUD click does not fall through to the world');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check(
    (await page.evaluate(() => window.__riot.game.deployUnit)) === null,
    'Esc leaves deploy mode',
  );
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(100);
  check(
    (await page.evaluate(() => window.__riot.game.deployUnit)) === 'riot',
    'hotkey 1 selects Riot Control',
  );
  await page.keyboard.press('Escape');
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  check(await page.evaluate(() => window.__riot.game.paused), 'Space pauses');
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(
    await page.evaluate(
      () =>
        window.__riot.ui.topScreen?.constructor?.name !== undefined && window.__riot.game.paused,
    ),
    'Esc opens the pause menu',
  );
  await page.keyboard.press('Escape');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await ctx.close();

  // --- Title → city select -----------------------------------------------------------------
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tp = await tctx.newPage();
  const terr = [];
  tp.on('pageerror', (e) => terr.push(e.message));
  await tp.goto(new URL('index.html', base).href);
  await tp.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, {
    timeout: 60000,
  });
  check(
    (await tp.evaluate(() => window.__riot.ui.mode)) === 'title',
    'no ?city opens the title screen',
  );
  await tp.keyboard.press('Enter');
  await tp.waitForTimeout(200);
  check(
    (await tp.evaluate(() => window.__riot.ui.mode)) === 'select',
    'Enter on the title opens city select',
  );
  check(terr.length === 0, `no title page errors (${terr.join('; ')})`);
  await tctx.close();

  // --- M10 tutorial ------------------------------------------------------------------------
  const tuctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tu = await tuctx.newPage();
  const tuerr = [];
  tu.on('pageerror', (e) => tuerr.push(e.message));
  // Fresh profile, no params: the briefing runs on the first visit to Budapest (level 1; the
  // only city with the tutorial — PLAN §8.1).
  await tu.goto(new URL('index.html?city=budapest', base).href);
  await tu.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, {
    timeout: 60000,
  });
  await tu.waitForTimeout(500);
  check(
    await tu.evaluate(() => window.__riot.ui.tutorial.active && window.__riot.ui.advisor.speaking),
    'first visit: the Minister briefs the player',
  );
  // Jump to the deploy step and deploy: the step advances on the action.
  const stepAfterDeploy = await tu.evaluate(async () => {
    const ui = window.__riot.ui;
    const m = ui.tutorial.machine;
    m.fact('panned');
    while (m.active && m.step.id !== 'deploy') {
      m.linesFinished();
      m.update(2);
    }
    // Deploy where the briefing points (its suggested tile), through deploy mode.
    const t = ui.tutorial.suggested;
    ui.game.beginDeploy('riot');
    ui.game.deployAt(t.i, t.j);
    // The step needs ≥ 0.5 s on screen and the deploy event (drained once per frame).
    await new Promise((r) => setTimeout(r, 2000));
    return m.step?.id;
  });
  check(stepAfterDeploy !== 'deploy', `deploying advances the briefing (now: ${stepAfterDeploy})`);
  const skip = await cssCentre(
    tu,
    'ui.tutorial.skipButton.getBounds() && { x: ui.tutorial.skipButton.x, y: ui.tutorial.skipButton.y, w: ui.tutorial.skipButton.w, h: ui.tutorial.skipButton.h }',
  );
  await tu.mouse.click(skip.x, skip.y);
  await tu.waitForTimeout(200);
  check(!(await tu.evaluate(() => window.__riot.ui.tutorial.active)), 'SKIP BRIEFING ends it');
  check(
    await tu.evaluate(
      () => JSON.parse(localStorage.getItem('riot.settings.v1')).tutorialDone.budapest === true,
    ),
    'the done flag is persisted',
  );
  await tu.reload();
  await tu.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, {
    timeout: 60000,
  });
  check(
    !(await tu.evaluate(() => window.__riot.ui.tutorial.active)),
    'no briefing on the next visit',
  );
  // Any other city: no briefing, only the Minister's welcome line on the first visit.
  await tu.goto(new URL('index.html?city=paris', base).href);
  await tu.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, {
    timeout: 60000,
  });
  await tu.waitForTimeout(500);
  check(
    await tu.evaluate(() => !window.__riot.ui.tutorial.active && window.__riot.ui.advisor.speaking),
    'other cities: no briefing, just the welcome line',
  );
  check(tuerr.length === 0, `no tutorial page errors (${tuerr.join('; ')})`);
  await tuctx.close();

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
  const pcard = await cssCentre(pp, "ui.hud.deploy.cardRect('riot')");
  await pp.touchscreen.tap(pcard.x, pcard.y);
  await pp.waitForTimeout(150);
  check(
    ptaps.length === 1 && (await pp.evaluate(() => window.__riot.game.deployUnit)) === 'riot',
    'touch on a card enters deploy mode without a world tap',
  );
  await pp.evaluate(() => window.__riot.game.beginDeploy(null));
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
