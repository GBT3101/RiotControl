/**
 * Playtest entry for `tools/playtest.mjs` (M12): one headless run on a real city map with a
 * bot, summarised as plain JSON. `applyOverrides` patches balance data in place for parameter
 * sweeps (`--set waves.growth=1.15,units.riot.hp=90,protesters.woke.speed=1.1`).
 */
import { BALANCE, type QualityTier } from '../data/balance';
import { PROTESTERS } from '../data/protesters';
import { UNITS } from '../data/units';
import { loadMap } from '../maps';
import type { CityId } from '../maps/contract';
import { BOT_TUNING, type BotKind } from './bots';
import { runHeadless, type BalanceTrace } from './headless';
import type { StatsLedger } from './stats';

export interface PlaytestJob {
  city: CityId;
  bot: BotKind;
  seed: number;
  minutes: number;
  quality: QualityTier;
}

export interface PlaytestResult extends PlaytestJob {
  phase: string;
  time: number;
  wave: number;
  level: number;
  legit: number;
  hate: number;
  integrity: number;
  avgTickMs: number;
  maxTickMs: number;
  peakCrowd: number;
  spawned: number;
  fallen: StatsLedger['protestersFallen'];
  officersLost: StatsLedger['officersLost'];
  unitsDeployed: StatsLedger['unitsDeployed'];
  hateEarned: number;
  hateSpent: number;
  breta: [number, number];
  trace: BalanceTrace;
}

export function runPlaytest(job: PlaytestJob): PlaytestResult {
  const r = runHeadless({
    seconds: job.minutes * 60,
    seed: job.seed,
    bot: job.bot,
    quality: job.quality,
    map: loadMap(job.city),
    progressEvery: 1e9,
  });
  const s = r.stats;
  return {
    ...job,
    phase: r.phase,
    time: r.seconds,
    wave: r.wave,
    level: r.level,
    legit: r.legit,
    hate: r.hate,
    integrity: r.integrity,
    avgTickMs: r.avgTickMs,
    maxTickMs: r.maxTickMs,
    peakCrowd: s.peakCrowd,
    spawned: s.protestersSpawned,
    fallen: s.protestersFallen,
    officersLost: s.officersLost,
    unitsDeployed: s.unitsDeployed,
    hateEarned: s.hateEarned,
    hateSpent: s.hateSpent,
    breta: [s.bretaSpawned, s.bretaDowned],
    trace: r.trace,
  };
}

/**
 * Patch balance data in place: comma-separated `path=value` pairs. Roots: `balance.` (or a
 * bare BALANCE key), `units.<id>.`, `protesters.<id>.`, `bot.`. Numeric values only. Tooling only —
 * never called by the game. `bot.` patches `BOT_TUNING` (deploy rate/burst).
 */
export function applyOverrides(spec: string): string[] {
  const applied: string[] = [];
  for (const part of spec.split(',').map((p) => p.trim())) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) throw new Error(`override "${part}": expected path=value`);
    const path = part.slice(0, eq).split('.');
    const value = Number(part.slice(eq + 1));
    if (!Number.isFinite(value)) throw new Error(`override "${part}": not a number`);
    let obj: unknown;
    if (path[0] === 'bot') {
      obj = BOT_TUNING;
      path.shift();
    } else if (path[0] === 'units') {
      obj = UNITS;
      path.shift();
    } else if (path[0] === 'protesters') {
      path.shift();
      const id = path.shift();
      obj = PROTESTERS.find((p) => p.id === id);
    } else {
      if (path[0] === 'balance') path.shift();
      obj = BALANCE;
    }
    const last = path.pop();
    for (const k of path) obj = (obj as Record<string, unknown> | undefined)?.[k];
    if (!obj || last === undefined || typeof (obj as Record<string, unknown>)[last] !== 'number') {
      throw new Error(`override "${part}": unknown numeric path`);
    }
    (obj as Record<string, number>)[last] = value;
    applied.push(part);
  }
  return applied;
}
