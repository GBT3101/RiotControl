#!/usr/bin/env node
/* global process, console, window, document, URL */
/**
 * Headless audio render check (Playwright + the audio lab page, Vite dev server).
 *
 *   node src/audio/dev/check.mjs            # SFX + loops + music + stress report
 *   node src/audio/dev/check.mjs --quick    # skip the long music renders
 *   node src/audio/dev/check.mjs --json out.json
 *   node src/audio/dev/check.mjs --shot shots/audio-lab.png   # + screenshot of the lab
 *
 * Renders every sound with OfflineAudioContext in Chromium and checks: non-silent, no SFX
 * peak above 1.0 at bus input, loop seams small, and the stress mix stays below 0 dBFS
 * (limiter) with no clipped samples. Exit code 1 on any failure.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '../../..');
const { values: args } = parseArgs({
  options: {
    quick: { type: 'boolean', default: false },
    json: { type: 'string' },
    shot: { type: 'string' },
  },
});

const server = await createServer({ root, logLevel: 'warn', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${server.config.server.port}/`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const failures = [];
const out = {};
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') failures.push(`console: ${m.text()}`);
  });
  await page.goto(new URL('audio.html', base).href);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 60000 });

  // Real-time smoke: unlock, click every SFX button, run all loops + the stress test for 3 s.
  await page.click('#unlock');
  await page.waitForFunction(() => window.__audioDev.audio.unlocked, null, { timeout: 10000 });
  for (const b of await page.$$('#sfx button')) await b.click();
  for (const c of await page.$$('#loops input')) await c.check();
  await page.selectOption('#phase', 'wave');
  await page.selectOption('#city', 'madrid');
  await page.click('#stress');
  await page.waitForTimeout(3000);
  const rt = await page.evaluate(() => ({ stats: window.__audioDev.audio.stats(), meter: document.querySelector('#meterTxt').textContent }));
  await page.click('#stress');
  console.log(`Real-time smoke: ${rt.meter}\n  ${JSON.stringify(rt.stats)}`);
  if (!rt.stats.music) failures.push('real-time: music not playing');
  if (rt.stats.triggered < 50) failures.push('real-time: too few voices triggered');
  if (/clipped samples [1-9]/.test(rt.meter ?? '')) failures.push(`real-time clipping: ${rt.meter}`);
  if (args.shot) await page.screenshot({ path: resolve(root, args.shot), fullPage: true });
  out.realtime = rt;

  const sfx = await page.evaluate(() => window.__audioDev.reportSfx());
  out.sfx = sfx;
  console.log('SFX (peak/rms after catalogue gain, at bus input):');
  for (const r of sfx) {
    const flag = r.rms < 0.002 ? '  << SILENT?' : r.outPeak > 1 ? '  << HOT' : '';
    if (flag) failures.push(`${r.id}${flag}`);
    console.log(
      `  ${r.id.padEnd(16)} peak ${r.outPeak.toFixed(3)}  rms ${r.outRms.toFixed(4)}  len ${r.duration.toFixed(2)}s  render ${r.renderMs.toFixed(0)}ms${flag}`,
    );
  }

  const loops = await page.evaluate(() => window.__audioDev.reportLoops());
  out.loops = loops;
  console.log('Loops:');
  for (const r of loops) {
    const flag = r.rms < 0.002 ? '  << SILENT?' : '';
    if (flag) failures.push(`${r.id}${flag}`);
    console.log(`  ${r.id.padEnd(28)} peak ${r.outPeak.toFixed(3)}  rms ${r.outRms.toFixed(4)}  ${r.renderMs.toFixed(0)}ms${flag}`);
  }

  const grains = await page.evaluate(() => window.__audioDev.reportGrains());
  out.grains = grains;
  console.log('Crowd grains (raw):');
  console.log(
    '  ' +
      grains
        .map((r) => {
          if (r.rms < 0.002) failures.push(`grain ${r.id} silent`);
          if (r.peak > 1) failures.push(`grain ${r.id} hot`);
          return `${r.id} ${r.peak.toFixed(2)}/${r.rms.toFixed(3)}`;
        })
        .join('  '),
  );

  const mixes = [];
  mixes.push(await page.evaluate(() => window.__audioDev.renderCatalogue()));
  if (!args.quick) {
    const cases = [
      { phase: 'menu', city: 'ministry', level: 0, crowd: 0, night: false, seconds: 12 },
      { phase: 'prep', city: 'madrid', level: 0, crowd: 0, night: false, seconds: 10 },
      { phase: 'prep', city: 'paris', level: 0, crowd: 0, night: false, seconds: 10 },
      { phase: 'prep', city: 'london', level: 0, crowd: 0, night: false, seconds: 10 },
      { phase: 'wave', city: 'london', level: 2, crowd: 60, night: false, seconds: 12, crowdBed: 60 },
      { phase: 'wave', city: 'madrid', level: 6, crowd: 600, night: false, seconds: 12, crowdBed: 600 },
      { phase: 'wave', city: 'paris', level: 10, crowd: 3000, night: true, seconds: 12, crowdBed: 3000 },
      { phase: 'breather', city: 'london', level: 5, crowd: 0, night: false, seconds: 8 },
      { phase: 'victory', city: 'london', level: 10, crowd: 0, night: false, seconds: 14 },
      { phase: 'defeat', city: 'paris', level: 10, crowd: 0, night: false, seconds: 16 },
      { phase: 'wave', city: 'ministry', level: 0, crowd: 0, night: false, seconds: 20, crowdBed: 60, anger: 0.2, music: false },
      { phase: 'wave', city: 'ministry', level: 0, crowd: 0, night: false, seconds: 20, crowdBed: 600, anger: 0.5, music: false },
      { phase: 'wave', city: 'ministry', level: 0, crowd: 0, night: false, seconds: 20, crowdBed: 3000, anger: 1, music: false },
    ];
    for (const c of cases) mixes.push(await page.evaluate((o) => window.__audioDev.renderMusic(o), c));
  }
  mixes.push(await page.evaluate(() => window.__audioDev.renderStress(6, 200)));
  out.mixes = mixes;
  console.log('Mixes (post-limiter):');
  for (const m of mixes) {
    const silent = m.rms < 0.001;
    const hot = m.peak > 1 || m.clipped > 0;
    if (silent) failures.push(`${m.label}: silent`);
    if (hot) failures.push(`${m.label}: clipping (peak ${m.peak.toFixed(3)}, ${m.clipped} samples)`);
    console.log(
      `  ${m.label}\n    peak ${m.peakDb.toFixed(1)} dBFS  rms ${m.rmsDb.toFixed(1)} dBFS  clipped ${m.clipped}  render load ${m.load.toFixed(3)}  voices→ triggered ${m.stats.triggered}/${m.stats.requested} merged ${m.stats.merged} dropped ${m.stats.dropped}`,
    );
    console.log(`    0.5 s RMS windows: ${m.windows.join(' ')}`);
  }
} finally {
  await browser.close();
  await server.close();
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll audio checks passed.');
