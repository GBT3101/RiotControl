/**
 * Headless runner: N seconds of simulation with a scripted bot, returning summary stats.
 *
 *   import { runHeadless, formatSummary } from './sim/headless';
 *   console.info(formatSummary(runHeadless({ seconds: 600, seed: 3 })));
 *
 * CLI (no tsx needed — uses Vite's module runner):
 *   node --input-type=module -e "const {runnerImport}=await import('vite');
 *     const {module:m}=await runnerImport('./src/sim/headless.ts',{configFile:false,logLevel:'error'});
 *     await m.main(process.argv.slice(1))" -- --seconds 900 --seed 3 --bot escalate
 *
 * Bots live in `bots.ts` (none / passive / riot / cheap / balanced / escalate / sacrificial).
 * `tools/playtest.mjs` sweeps seeds × bots × cities in parallel (M12 balance tooling); the
 * result carries a `BalanceTrace` (level times, wave sizes, min integrity, Hate/crowd curves).
 */
import type { MapData } from '../maps/contract';
import type { QualityTier } from '../data/balance';
import { MAX_LEVEL } from '../data/levels';
import { buildTestCity } from './testCity';
import { World } from './world';
import type { SimEventType } from './events';
import { totalFallen, totalOfficersLost, type StatsLedger } from './stats';
import { Bot, BOT_KINDS, type BotKind } from './bots';

export { Bot, BOT_KINDS, MapIntel, type BotKind } from './bots';

export interface HeadlessOptions {
  seconds?: number;
  seed?: number;
  map?: MapData;
  quality?: QualityTier;
  bot?: BotKind;
  /** Start waves immediately (default true). */
  startWaves?: boolean;
  /** Progress callback every N simulated seconds. */
  onProgress?: (w: World) => void;
  progressEvery?: number;
}

/** Balance telemetry sampled during a headless run (sim time, not wall clock). */
export interface BalanceTrace {
  /** Sim second each level was first reached (index = level; NaN = never). */
  levelTimes: number[];
  /** Per wave: start time (s) and size. */
  waves: { t: number; size: number }[];
  /** Lowest Capitol integrity seen (0..1). */
  minIntegrity: number;
  /** Hate held, sampled every 10 s. */
  hateSamples: number[];
  /** Legitimacy, sampled every 60 s. */
  legitPerMinute: number[];
  /** Crowd size sampled every 10 s. */
  crowdSamples: number[];
}

export interface HeadlessResult {
  seconds: number;
  ticks: number;
  avgTickMs: number;
  maxTickMs: number;
  phase: World['phase'];
  wave: number;
  hate: number;
  legit: number;
  level: number;
  integrity: number;
  crowd: number;
  units: number;
  stats: StatsLedger;
  events: Partial<Record<SimEventType, number>>;
  hash: number;
  trace: BalanceTrace;
}

export function runHeadless(opts: HeadlessOptions = {}): HeadlessResult {
  const map = opts.map ?? buildTestCity({ seed: opts.seed ?? 7 });
  const w = new World(map, { seed: opts.seed ?? 1, quality: opts.quality ?? 'desktop' });
  const bot = new Bot(w, opts.bot ?? 'riot');
  const seconds = opts.seconds ?? 300;
  const steps = Math.round(seconds / w.dt);
  const events: Partial<Record<SimEventType, number>> = {};
  let total = 0;
  let max = 0;
  if (opts.startWaves ?? true) w.startWaves();
  const every = Math.round((opts.progressEvery ?? 60) / w.dt);
  const trace: BalanceTrace = {
    levelTimes: new Array<number>(MAX_LEVEL + 1).fill(NaN),
    waves: [],
    minIntegrity: 1,
    hateSamples: [],
    legitPerMinute: [],
    crowdSamples: [],
  };
  trace.levelTimes[0] = 0;
  const sample10 = Math.round(10 / w.dt);
  const sample60 = Math.round(60 / w.dt);
  let k = 0;
  for (; k < steps && w.phase === 'playing'; k++) {
    bot.update();
    const t0 = performance.now();
    w.step();
    const dt = performance.now() - t0;
    total += dt;
    if (dt > max) max = dt;
    for (const e of w.events.drain()) {
      events[e.type] = (events[e.type] ?? 0) + 1;
      if (e.type === 'levelUp' && Number.isNaN(trace.levelTimes[e.level]!)) {
        trace.levelTimes[e.level] = w.time;
      } else if (e.type === 'waveStart') trace.waves.push({ t: w.time, size: e.size });
    }
    if (w.capitol.integrity < trace.minIntegrity) trace.minIntegrity = w.capitol.integrity;
    if (k % sample10 === 0) {
      trace.hateSamples.push(w.hate);
      trace.crowdSamples.push(w.crowd.count);
    }
    if (k % sample60 === 0) trace.legitPerMinute.push(w.legit);
    if (opts.onProgress && k % every === 0) opts.onProgress(w);
  }
  w.syncStats();
  return {
    seconds: w.time,
    ticks: k,
    avgTickMs: total / Math.max(1, k),
    maxTickMs: max,
    phase: w.phase,
    wave: w.director.wave,
    hate: w.hate,
    legit: w.legit,
    level: w.level,
    integrity: w.capitol.integrity,
    crowd: w.crowd.count,
    units: w.units.count,
    stats: w.stats,
    events,
    hash: w.stateHash(),
    trace,
  };
}

export function formatSummary(r: HeadlessResult): string {
  const s = r.stats;
  const fallen = Object.entries(s.protestersFallen)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
  const lost = Object.entries(s.officersLost)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
  return [
    `RIOT CONTROL headless — ${r.seconds.toFixed(0)} s, ${r.ticks} ticks, phase ${r.phase}`,
    `  tick: avg ${r.avgTickMs.toFixed(3)} ms, max ${r.maxTickMs.toFixed(2)} ms`,
    `  wave ${r.wave}, level ${r.level}, legit ${r.legit}, hate ${r.hate}, integrity ${(r.integrity * 100).toFixed(1)}%`,
    `  crowd now ${r.crowd} (peak ${s.peakCrowd}), units ${r.units}, spawned ${s.protestersSpawned}`,
    `  fallen ${totalFallen(s)} (KO ${s.protestersKO}, killed ${s.protestersKilled}): ${fallen}`,
    `  officers lost ${totalOfficersLost(s)}: ${lost}`,
    `  hate earned ${s.hateEarned}, spent ${s.hateSpent}; capitol damage ${s.capitolDamage.toFixed(0)}; Breta ${s.bretaSpawned}/${s.bretaDowned}`,
    `  levels at ${r.trace.levelTimes.map((t) => (Number.isNaN(t) ? '-' : (t / 60).toFixed(1))).join(' ')} min; min integrity ${(r.trace.minIntegrity * 100).toFixed(0)}%`,
    `  state hash ${r.hash.toString(16)}`,
  ].join('\n');
}

/** CLI entry: --seconds N --seed S --bot <BOT_KINDS> --quality low|mobile|desktop */
export function main(argv: string[]): HeadlessResult {
  const arg = (name: string): string | undefined => {
    const k = argv.indexOf(`--${name}`);
    return k >= 0 ? argv[k + 1] : undefined;
  };
  const r = runHeadless({
    seconds: Number(arg('seconds') ?? 300),
    seed: Number(arg('seed') ?? 1),
    bot: BOT_KINDS.find((b) => b === arg('bot')) ?? 'riot',
    quality: (arg('quality') as QualityTier | undefined) ?? 'desktop',
    onProgress: (w) =>
      console.info(
        `t=${w.time.toFixed(0)}s wave ${w.director.wave} (${w.director.phase}) crowd ${w.crowd.count} units ${w.units.count} hate ${w.hate} legit ${w.legit} L${w.level} integrity ${(w.capitol.integrity * 100).toFixed(0)}%`,
      ),
  });
  console.info(formatSummary(r));
  return r;
}
