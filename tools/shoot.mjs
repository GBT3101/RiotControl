#!/usr/bin/env node
/**
 * Headless screenshots with Playwright Chromium (pre-installed in /opt/pw-browsers).
 *
 *   npm run shots                                  # default set (game ×3 viewports + gallery)
 *   node tools/shoot.mjs --page gallery --query group=units --out units
 *   node tools/shoot.mjs --page game --viewport phone-portrait --query "zoom=5&u=36&v=36" --out zoomed
 *   node tools/shoot.mjs --page game --viewport 1280x720 --wait 2000 --no-build
 *   node tools/shoot.mjs --dev ...                 # use the Vite dev server instead of a build
 *
 * Options:
 *   --page game|gallery|<file.html>   page to open (default: the default set)
 *   --query "a=1&b=2"                 query string
 *   --viewport desktop|phone-landscape|phone-portrait|WxH   (default desktop; repeatable)
 *   --dpr N                           device scale factor override
 *   --out name                        output base name (shots/<name>[-<viewport>].png)
 *   --wait ms                         extra wait after the page reports ready (default 800)
 *   --timeout ms                      max wait for the page to report ready (default 20000)
 *   --full / --no-full                full-page screenshot (default: gallery full, game not)
 *   --clip x,y,w,h                    clip rectangle in CSS px
 *   --no-build                        reuse the existing dist/ (preview mode)
 *   --dev                             serve from the dev server (no build)
 *
 * Fails (exit 1) if any page logs a console error or throws.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { build, createServer, preview } from 'vite';

const root = resolve(import.meta.dirname, '..');
const { values: args } = parseArgs({
  options: {
    page: { type: 'string' },
    query: { type: 'string', default: '' },
    viewport: { type: 'string', multiple: true },
    dpr: { type: 'string' },
    out: { type: 'string' },
    wait: { type: 'string', default: '800' },
    timeout: { type: 'string', default: '20000' },
    full: { type: 'boolean' },
    'no-full': { type: 'boolean' },
    clip: { type: 'string' },
    'no-build': { type: 'boolean', default: false },
    dev: { type: 'boolean', default: false },
  },
});

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  'phone-landscape': {
    width: 844,
    height: 390,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'phone-portrait': {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};

function viewportFor(name) {
  if (VIEWPORTS[name]) return { name, ...VIEWPORTS[name] };
  const m = /^(\d+)x(\d+)$/.exec(name);
  if (!m) throw new Error(`Unknown viewport "${name}"`);
  return {
    name,
    width: +m[1],
    height: +m[2],
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  };
}

function pageFile(page) {
  if (!page || page === 'game') return 'index.html';
  if (page === 'gallery') return 'gallery.html';
  return page;
}

/** Build the job list. */
function jobs() {
  if (!args.page) {
    return [
      ...['desktop', 'phone-landscape', 'phone-portrait'].map((v) => ({
        page: 'game',
        query: args.query,
        viewport: viewportFor(v),
        out: `game-${v}`,
        full: false,
      })),
      {
        page: 'gallery',
        query: args.query,
        viewport: viewportFor('desktop'),
        out: 'gallery',
        full: true,
      },
    ];
  }
  const vps = (args.viewport?.length ? args.viewport : ['desktop']).map(viewportFor);
  const base = args.out ?? args.page;
  const full = args['no-full'] ? false : (args.full ?? args.page === 'gallery');
  return vps.map((vp) => ({
    page: args.page,
    query: args.query,
    viewport: vp,
    out: vps.length > 1 || !args.out ? `${base}-${vp.name}` : base,
    full,
  }));
}

async function startServer() {
  if (args.dev) {
    const server = await createServer({
      root,
      logLevel: 'warn',
      server: { port: 0, host: '127.0.0.1' },
    });
    await server.listen();
    const url = server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${server.config.server.port}/`;
    return { url, close: () => server.close() };
  }
  if (!args['no-build']) {
    console.log('Building…');
    await build({ root, logLevel: 'warn' });
  }
  const server = await preview({ root, logLevel: 'warn', preview: { port: 0, host: '127.0.0.1' } });
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('preview server has no URL');
  return { url, close: () => server.close() };
}

const outDir = resolve(root, 'shots');
mkdirSync(outDir, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let failures = 0;
try {
  for (const job of jobs()) {
    const { name: _n, ...vp } = job.viewport;
    if (args.dpr) vp.deviceScaleFactor = Number(args.dpr);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.stack ?? err.message}`));
    page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()}`));
    const q = job.query ? `?${job.query.replace(/^\?/, '')}` : '';
    const url = new URL(pageFile(job.page) + q, server.url).href;
    await page.goto(url, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, {
        timeout: Number(args.timeout) || 20000,
      });
    } catch {
      errors.push('timeout: page never reported ready (document.documentElement.dataset.ready)');
    }
    await page.waitForTimeout(Number(args.wait) || 0);
    const file = resolve(outDir, `${job.out}.png`);
    const clip = args.clip
      ? (([x, y, width, height]) => ({ x, y, width, height }))(args.clip.split(',').map(Number))
      : undefined;
    await page.screenshot({ path: file, fullPage: job.full && !clip, clip });
    if (errors.length) {
      failures++;
      console.error(`✗ ${file}\n  ${errors.join('\n  ')}`);
    } else {
      console.log(
        `✓ ${file}  (${url.replace(server.url, '')}, ${vp.width}×${vp.height}@${vp.deviceScaleFactor})`,
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures) {
  console.error(`${failures} page(s) reported errors.`);
  process.exit(1);
}
