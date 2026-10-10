#!/usr/bin/env node
/**
 * Headless balance sweep (M12): N seeds × bots × cities, run in parallel worker threads, using
 * simulated time only. Each worker loads the TS sim once through Vite's module runner.
 *
 *   npm run playtest                                   # 3 seeds × balanced/escalate/passive/cheap/sacrificial × 3 cities
 *   npm run playtest -- --bots balanced --cities madrid --seeds 1,2 --minutes 60
 *   npm run playtest -- --seeds 5 --jobs 4 --json shots/playtest.json --quality mobile
 *
 * Flags: --bots a,b  --cities madrid,london,paris  --seeds N | a,b,c  --minutes M (cap, default 65)
 *        --quality desktop|mobile|low  --jobs J (default min(4, cores))  --json file  --verbose
 *        --set path=value,... (patch balance data for this sweep, e.g. waves.growth=1.15,units.riot.hp=90,
 *        mob.maxMult=1, or bot.spread=3 to spread the bots' officers out of each other's support)
 * Columns: rams = officers rammed over by a mob, climbs = protesters that started up a facade.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!isMainThread) {
  const { runnerImport } = await import('vite');
  const pt = (
    await runnerImport(resolve(ROOT, 'src/sim/playtest.ts'), {
      root: ROOT,
      configFile: false,
      logLevel: 'error',
    })
  ).module;
  if (workerData.set) pt.applyOverrides(workerData.set);
  parentPort.on('message', (job) => {
    if (job === null) {
      parentPort.close();
      return;
    }
    const wall0 = performance.now();
    const r = pt.runPlaytest(job);
    parentPort.postMessage({ ...r, wallMs: performance.now() - wall0 });
  });
} else {
  const argv = process.argv.slice(2);
  const arg = (name, def) => {
    const k = argv.indexOf(`--${name}`);
    return k >= 0 ? argv[k + 1] : def;
  };
  const list = (v) => v.split(',').filter(Boolean);
  const bots = list(arg('bots', 'balanced,escalate,cheap,sacrificial,passive'));
  const cities = list(arg('cities', 'madrid,london,paris'));
  const seedArg = arg('seeds', '3');
  const seeds = seedArg.includes(',')
    ? list(seedArg).map(Number)
    : Array.from({ length: Number(seedArg) }, (_, k) => k + 1);
  const minutes = Number(arg('minutes', '65'));
  const quality = arg('quality', 'desktop');
  const jobsN = Math.max(1, Number(arg('jobs', String(Math.min(4, availableParallelism())))));
  const jsonOut = arg('json', null);
  const verbose = argv.includes('--verbose');
  const set = arg('set', '');

  const jobs = [];
  for (const city of cities)
    for (const bot of bots)
      for (const seed of seeds) jobs.push({ city, bot, seed, minutes, quality });
  const t0 = performance.now();
  const results = [];
  let next = 0;
  const pad = (v, n) => String(v).padStart(n);
  const fmtMin = (t) => (Number.isFinite(t) ? (t / 60).toFixed(1) : '  -');
  const officers = (o) =>
    Object.entries(o)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}:${n}`)
      .join(' ');
  const outcome = (r) => (r.phase === 'victory' ? 'WIN ' : r.phase === 'defeat' ? 'LOSS' : 'TIME');

  console.info(
    `playtest: ${jobs.length} runs (${cities.join('/')} × ${bots.join('/')} × seeds ${seeds.join(',')}), ` +
      `${minutes} min cap, ${quality}, ${jobsN} workers${set ? `, set ${set}` : ''}`,
  );
  console.info(
    'city    bot          seed  out    min  wave lvl  legit   L1   L2   L4   L6   L8  L10  peak minInt hateAvg hateMax  ms/t  rams climbs  officers lost',
  );
  const print = (r) => {
    const lt = r.trace.levelTimes;
    const hs = r.trace.hateSamples;
    const avg = hs.reduce((a, b) => a + b, 0) / Math.max(1, hs.length);
    console.info(
      `${r.city.padEnd(7)} ${r.bot.padEnd(12)} ${pad(r.seed, 4)}  ${outcome(r)} ${pad(fmtMin(r.time), 5)} ${pad(r.wave, 5)} ${pad(r.level, 3)} ${pad(r.legit, 6)} ` +
        [1, 2, 4, 6, 8, 10].map((l) => pad(fmtMin(lt[l]), 4)).join(' ') +
        ` ${pad(r.peakCrowd, 5)} ${pad((r.trace.minIntegrity * 100).toFixed(0) + '%', 6)} ${pad(avg.toFixed(0), 7)} ${pad(Math.max(...hs), 7)} ${pad(r.avgTickMs.toFixed(2), 5)} ${pad(r.rammed, 5)} ${pad(r.climbs, 6)}  ${officers(r.officersLost)}`,
    );
    if (verbose) {
      console.info(
        `        waves: ${r.trace.waves.map((w) => `${(w.t / 60).toFixed(1)}m:${w.size}`).join(' ')}`,
      );
      console.info(`        legit/min: ${r.trace.legitPerMinute.join(' ')}`);
    }
  };

  await new Promise((done) => {
    let running = 0;
    const spawn = () => {
      const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { set } });
      running++;
      const feed = () => worker.postMessage(next < jobs.length ? jobs[next++] : null);
      worker.on('message', (r) => {
        results.push(r);
        print(r);
        feed();
      });
      worker.on('error', (e) => {
        console.error(e);
        process.exitCode = 1;
      });
      worker.on('exit', () => {
        if (--running === 0) done();
      });
      feed();
    };
    for (let k = 0; k < Math.min(jobsN, jobs.length); k++) spawn();
  });

  // Summary per city × bot.
  console.info(
    '\nsummary (per city × bot): wins/runs, time to win (min, median [min–max]), losses at wave, peak crowd',
  );
  const med = (a) => {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN;
  };
  for (const city of cities) {
    for (const bot of bots) {
      const rs = results.filter((r) => r.city === city && r.bot === bot);
      const wins = rs.filter((r) => r.phase === 'victory');
      const losses = rs.filter((r) => r.phase === 'defeat');
      const wt = wins.map((r) => r.time / 60);
      console.info(
        `${city.padEnd(7)} ${bot.padEnd(12)} ${wins.length}/${rs.length} wins` +
          (wt.length
            ? `  ${med(wt).toFixed(1)} [${Math.min(...wt).toFixed(1)}–${Math.max(...wt).toFixed(1)}] min`
            : '') +
          (losses.length ? `  losses at waves ${losses.map((r) => r.wave).join(',')}` : '') +
          `  peak ${Math.max(...rs.map((r) => r.peakCrowd))}`,
      );
    }
  }
  console.info(
    `\n${results.length} runs in ${((performance.now() - t0) / 1000).toFixed(0)} s wall`,
  );
  if (jsonOut) {
    mkdirSync(dirname(resolve(jsonOut)), { recursive: true });
    writeFileSync(jsonOut, JSON.stringify(results, null, 1));
    console.info(`wrote ${jsonOut}`);
  }
}
