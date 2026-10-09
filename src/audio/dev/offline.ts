/**
 * Offline render checks (run in a browser — the dev page exposes them on `window.__audioDev`,
 * and `src/audio/dev/check.mjs` drives them headlessly through Playwright).
 */
import { bakeLoop, bakeRecipe, bufferStats, offlineCtor, variantRng, type BufferStats } from '../baker';
import { AudioEngine } from '../engine';
import type { Flavour } from '../music/patterns';
import { SFX } from '../sfx/catalog';
import { LOOPS } from '../sfx/loops';
import { GRAIN_KINDS, GRAINS } from '../crowd';
import { LOOP_IDS, SFX_IDS, type MusicPhase, type SfxId } from '../types';

const SR = 48000;

export interface SoundReport extends BufferStats {
  id: string;
  /** Peak after the catalogue gain (what hits the bus at volume 1). */
  outPeak: number;
  outRms: number;
  renderMs: number;
}

function db(x: number): number {
  return x > 0 ? 20 * Math.log10(x) : -Infinity;
}

export async function reportSfx(ids: readonly string[] = SFX_IDS): Promise<SoundReport[]> {
  const out: SoundReport[] = [];
  for (const id of ids) {
    const def = SFX[id as SfxId];
    const t0 = performance.now();
    const buf = await bakeRecipe(SR, def.dur, def.recipe, variantRng(id, 0));
    const ms = performance.now() - t0;
    const st = bufferStats(buf);
    out.push({ id, ...st, outPeak: st.peak * def.gain, outRms: st.rms * def.gain, renderMs: ms });
  }
  return out;
}

export async function reportGrains(): Promise<SoundReport[]> {
  const out: SoundReport[] = [];
  for (const kind of GRAIN_KINDS) {
    const spec = GRAINS[kind];
    for (let v = 0; v < spec.variants; v++) {
      const t0 = performance.now();
      const buf = await bakeRecipe(SR, spec.dur, (s) => spec.draw(s, v), variantRng(`grain.${kind}`, v));
      const st = bufferStats(buf);
      out.push({ id: `${kind}#${v}`, ...st, outPeak: st.peak, outRms: st.rms, renderMs: performance.now() - t0 });
    }
  }
  return out;
}

export async function reportLoops(): Promise<SoundReport[]> {
  const out: SoundReport[] = [];
  for (const id of LOOP_IDS) {
    const d = LOOPS[id];
    const Ctor = offlineCtor()!;
    const tmp = new Ctor(1, 1, SR);
    const t0 = performance.now();
    const buf = await bakeLoop(SR, d.length, d.xfade, d.recipe, variantRng(id, 0), (ch, len, rate) =>
      tmp.createBuffer(ch, len, rate),
    );
    const ms = performance.now() - t0;
    const st = bufferStats(buf);
    // Seam check: jump between the last and first sample relative to the RMS.
    const data = buf.getChannelData(0);
    const seam = Math.abs(data[data.length - 1]! - data[0]!);
    out.push({ id: `${id} (seam ${seam.toFixed(3)})`, ...st, outPeak: st.peak * d.gain, outRms: st.rms * d.gain, renderMs: ms });
  }
  return out;
}

export interface MixReport {
  label: string;
  seconds: number;
  peak: number;
  peakDb: number;
  rms: number;
  rmsDb: number;
  clipped: number;
  renderMs: number;
  /** Render time / audio time (lower = cheaper; < 1 = faster than real time). */
  load: number;
  stats: ReturnType<AudioEngine['stats']>;
  /** Short-term RMS per 0.5 s window (dBFS) to see dynamics. */
  windows: number[];
}

function mixReport(label: string, buf: AudioBuffer, renderMs: number, eng: AudioEngine): MixReport {
  let peak = 0;
  let sum = 0;
  let clipped = 0;
  const n = buf.length;
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const win = Math.floor(buf.sampleRate * 0.5);
  const windows: number[] = [];
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(L[i]!), Math.abs(R[i]!));
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    const e = (L[i]! * L[i]! + R[i]! * R[i]!) / 2;
    sum += e;
    wsum += e;
    if ((i + 1) % win === 0) {
      windows.push(Math.round(db(Math.sqrt(wsum / win)) * 10) / 10);
      wsum = 0;
    }
  }
  const rms = Math.sqrt(sum / n);
  return {
    label,
    seconds: buf.duration,
    peak,
    peakDb: db(peak),
    rms,
    rmsDb: db(rms),
    clipped,
    renderMs,
    load: renderMs / 1000 / buf.duration,
    stats: eng.stats(),
    windows,
  };
}

/** Offline engine driven by a simulated clock. */
async function offlineEngine(seconds: number): Promise<{ eng: AudioEngine; ctx: OfflineAudioContext; clock: { t: number } }> {
  const Ctor = offlineCtor()!;
  const ctx = new Ctor(2, Math.ceil(seconds * SR), SR);
  const clock = { t: 0 };
  const eng = new AudioEngine({ context: ctx, manual: true, storage: null, clock: () => clock.t });
  await eng.prebake();
  return { eng, ctx, clock };
}

/**
 * Drive an offline render just-in-time like the real-time engine: suspend every `step`
 * seconds, run `fn(t)` (which schedules what is due), resume. Without this every voice of the
 * whole render would sit in the graph from t = 0 and inflate the measured load.
 */
function drive(ctx: OfflineAudioContext, seconds: number, step: number, fn: (t: number) => void): void {
  fn(0);
  const n = Math.floor((seconds - 0.2) / step);
  for (let k = 1; k <= n; k++) {
    const at = k * step;
    void ctx.suspend(at).then(() => {
      fn(at);
      void ctx.resume();
    });
  }
}

export interface MusicRenderOpts {
  phase: MusicPhase;
  city: Flavour;
  level: number;
  crowd: number;
  night: boolean;
  seconds: number;
  /** Also run the crowd bed at this size (0 = off). */
  crowdBed?: number;
  /** Crowd anger override (default: automatic). */
  anger?: number;
  /** false = crowd bed only, no music. */
  music?: boolean;
}

export async function renderMusic(o: MusicRenderOpts): Promise<MixReport> {
  const { eng, ctx, clock } = await offlineEngine(o.seconds);
  eng.setCity(o.city === 'ministry' ? null : o.city);
  if (o.music !== false) eng.setMusicState({ phase: o.phase, level: o.level, crowd: o.crowd, night: o.night });
  eng.setCrowd({ size: o.crowdBed ?? 0, ...(o.anger !== undefined ? { anger: o.anger } : {}) });
  drive(ctx, o.seconds, 0.1, (at) => {
    for (const t of [at, at + 0.05]) {
      clock.t = t;
      eng.update(t);
    }
  });
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  return mixReport(`${o.music === false ? 'crowd bed only' : `music ${o.phase}/${o.city}`} L${o.level} crowd ${o.crowd}${o.crowdBed ? ` bed ${o.crowdBed}` : ''}${o.anger !== undefined ? ` anger ${o.anger}` : ''}${o.night ? ' night' : ''}`, buf, performance.now() - t0, eng);
}

/**
 * Worst-case mix: ~200 melee hits/s at random positions, 3 MG loops, pistols/rifles, an
 * explosion every 0.5 s, a 3000-strong crowd bed and the march at full intensity.
 */
export async function renderStress(seconds = 6, hitsPerSecond = 200): Promise<MixReport> {
  const { eng, ctx, clock } = await offlineEngine(seconds);
  eng.setListener({ x: 0, y: 0 }, 2, 1440);
  eng.setCity('london');
  eng.setMusicState({ phase: 'wave', level: 10, crowd: 3000, night: false });
  eng.setCrowd({ size: 3000, anger: 1, near: 1 });
  let rngS = 12345;
  const rnd = (): number => {
    rngS = (Math.imul(rngS, 1664525) + 1013904223) >>> 0;
    return rngS / 4294967296;
  };
  const hits: SfxId[] = ['baton', 'punch', 'shieldThud', 'bodyFall', 'rubberHit', 'bat'];
  const fps = 60;
  let debt = 0;
  const frame = (f: number): void => {
    const t = f / fps;
    clock.t = t;
    debt += hitsPerSecond / fps;
    while (debt >= 1) {
      debt -= 1;
      eng.play(hits[Math.floor(rnd() * hits.length)]!, { x: (rnd() * 2 - 1) * 500, y: (rnd() * 2 - 1) * 300 });
    }
    if (f % 6 === 0) eng.play('pistol', { x: (rnd() * 2 - 1) * 300, y: 0 });
    if (f % 4 === 0) eng.play('rifle', { x: (rnd() * 2 - 1) * 300, y: 0 });
    if (f % 30 === 0) eng.play(rnd() < 0.5 ? 'explosionBig' : 'explosionMedium', { x: (rnd() * 2 - 1) * 300, y: 0 });
    if (f % 90 === 0) eng.play('tankCannon', { x: 100, y: 50 });
    for (let k = 0; k < 3; k++) eng.loop(`mg:${k}`, 'mgLoop', { x: (k - 1) * 250, y: 40 });
    eng.loop('fire:1', 'fireLoop', { x: -120, y: 60, ttl: 10 });
    eng.loop('heli', 'heliLoop', { x: Math.sin(t) * 300, y: -100 });
    eng.flush();
    eng.update(t);
  };
  const step = 0.1;
  drive(ctx, seconds, step, (at) => {
    const f0 = Math.round(at * fps);
    for (let f = f0; f < f0 + step * fps; f++) frame(f);
  });
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  return mixReport(`stress ${hitsPerSecond} hits/s + 3 MG + booms + crowd 3000 + march L4`, buf, performance.now() - t0, eng);
}

/** Every SFX once, spaced out, through the full mix chain (limiter included). */
export async function renderCatalogue(): Promise<MixReport> {
  const gap = 0.9;
  const seconds = SFX_IDS.length * gap + 3;
  const { eng, ctx, clock } = await offlineEngine(seconds);
  SFX_IDS.forEach((id, i) => {
    clock.t = i * gap;
    eng.play(id);
    eng.flush();
  });
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  return mixReport('catalogue through the mix', buf, performance.now() - t0, eng);
}
