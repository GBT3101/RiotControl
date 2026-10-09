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
 * The bot is intentionally simple (M12 writes the real balance bots): it starts the waves,
 * deploys the best affordable unlocked unit on road tiles along the Capitol approaches (or on
 * nearby rooftops), throws charged gas grenades and calls breathers early when rich.
 */
import { UNITS, UNIT_ORDER, type UnitId } from '../data/units';
import type { MapData } from '../maps/contract';
import type { QualityTier } from '../data/balance';
import { buildTestCity } from './testCity';
import { World } from './world';
import type { SimEventType } from './events';
import { totalFallen, totalOfficersLost, type StatsLedger } from './stats';

export type BotKind = 'none' | 'riot' | 'escalate';

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
}

/** Simple scripted player. */
export class Bot {
  private readonly approach: number[];
  private readonly roofs: number[];
  private nextAct = 0;
  constructor(
    private readonly w: World,
    private readonly kind: BotKind,
  ) {
    const nav = w.nav;
    // Road tiles 2–14 flow-steps from the steps, nearest first.
    const tiles: number[] = [];
    for (let t = 0; t < nav.size; t++) {
      const d = nav.dist[t]!;
      if (nav.road[t] && d >= 2 && d <= 14) tiles.push(t);
    }
    tiles.sort((a, b) => nav.dist[a]! - nav.dist[b]! || a - b);
    this.approach = tiles;
    const cap = w.map.capitol;
    const cx = cap.i + cap.w / 2;
    const cy = cap.j + cap.d / 2;
    this.roofs = w.map.buildings
      .filter((b) => b.rooftop)
      .map((b) => b.id)
      .sort((a, b) => {
        const A = w.map.buildings[a]!;
        const B = w.map.buildings[b]!;
        const da = (A.i + A.w / 2 - cx) ** 2 + (A.j + A.d / 2 - cy) ** 2;
        const db = (B.i + B.w / 2 - cx) ** 2 + (B.j + B.d / 2 - cy) ** 2;
        return da - db || a - b;
      });
  }

  update(): void {
    const w = this.w;
    if (this.kind === 'none' || w.time < this.nextAct) return;
    this.nextAct = w.time + 1;
    w.useAllAbilities();
    if (w.director.phase === 'breather' && w.hate > 400) w.callNextWaveEarly();
    for (let tries = 0; tries < 3; tries++) {
      const unit = this.pickUnit();
      if (!unit) return;
      if (!this.place(unit)) return;
    }
  }

  private pickUnit(): UnitId | null {
    const w = this.w;
    const affordable = UNIT_ORDER.filter(
      (id) => UNITS[id].level <= w.level && UNITS[id].cost <= w.hate && id !== 'heli',
    );
    if (affordable.length === 0) return null;
    if (this.kind === 'riot') {
      // Mostly riot lines, a sniper or blockade now and then.
      const r = (w.tick >> 5) % 5;
      if (r === 0 && affordable.includes('sniper')) return 'sniper';
      if (r === 1 && affordable.includes('blockade')) return 'blockade';
      if (r === 2 && affordable.includes('gas')) return 'gas';
      return affordable.includes('riot') ? 'riot' : null;
    }
    // escalate: best affordable, but keep some riot control in the mix
    const best = affordable[affordable.length - 1]!;
    return (w.tick >> 5) % 3 === 0 ? 'riot' : best;
  }

  private place(unit: UnitId): boolean {
    const w = this.w;
    const mw = w.map.w;
    if (UNITS[unit].placement === 'rooftop') {
      for (const b of this.roofs) {
        const B = w.map.buildings[b]!;
        if (w.deploy(unit, B.i, B.j)) return true;
      }
      return false;
    }
    for (const t of this.approach) {
      const i = t % mw;
      const j = (t - i) / mw;
      // Spread out: skip tiles next to an existing ground unit.
      let crowded = false;
      for (const u of w.units.active) {
        if (u.building >= 0) continue;
        if (Math.abs(u.x - (i + 0.5)) < 1.6 && Math.abs(u.y - (j + 0.5)) < 1.6) {
          crowded = true;
          break;
        }
      }
      if (crowded) continue;
      if (w.deploy(unit, i, j)) return true;
    }
    return false;
  }
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
  let k = 0;
  for (; k < steps && w.phase === 'playing'; k++) {
    bot.update();
    const t0 = performance.now();
    w.step();
    const dt = performance.now() - t0;
    total += dt;
    if (dt > max) max = dt;
    for (const e of w.events.drain()) events[e.type] = (events[e.type] ?? 0) + 1;
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
    `  state hash ${r.hash.toString(16)}`,
  ].join('\n');
}

/** CLI entry: --seconds N --seed S --bot none|riot|escalate --quality low|mobile|desktop */
export function main(argv: string[]): HeadlessResult {
  const arg = (name: string): string | undefined => {
    const k = argv.indexOf(`--${name}`);
    return k >= 0 ? argv[k + 1] : undefined;
  };
  const r = runHeadless({
    seconds: Number(arg('seconds') ?? 300),
    seed: Number(arg('seed') ?? 1),
    bot: (arg('bot') as BotKind | undefined) ?? 'riot',
    quality: (arg('quality') as QualityTier | undefined) ?? 'desktop',
    onProgress: (w) =>
      console.info(
        `t=${w.time.toFixed(0)}s wave ${w.director.wave} (${w.director.phase}) crowd ${w.crowd.count} units ${w.units.count} hate ${w.hate} legit ${w.legit} L${w.level} integrity ${(w.capitol.integrity * 100).toFixed(0)}%`,
      ),
  });
  console.info(formatSummary(r));
  return r;
}
