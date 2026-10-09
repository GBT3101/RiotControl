/**
 * Parallel art loader: a small pool of Web Workers running art jobs (jobs.ts), longest first.
 * Falls back to running jobs inline (yielding a frame between jobs) when workers are not
 * available. Results are handed back in job order; the caller installs the atlases.
 */
import type { ArtCache } from './cache';
import { jobCost, runJob, type ArtJob, type JobResult } from './jobs';

export type ProgressFn = (done: number, total: number, label: string) => void;

interface Pending {
  job: ArtJob;
  index: number;
  resolve: (r: JobResult) => void;
  reject: (e: Error) => void;
}

const nextFrame = (): Promise<void> =>
  new Promise((r) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => r());
    else setTimeout(r, 0);
  });

export class ArtLoader {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Pending[] = [];
  private busy = new Map<Worker, Pending>();
  private seq = 1;
  private readonly inline: boolean;
  /** Per-job timings (ms in the worker; -1 = from the cache) for diagnostics. */
  readonly timings: Array<{ job: string; ms: number }> = [];
  /** Optional persistent cache (IndexedDB). */
  cache: ArtCache | null = null;
  cacheHits = 0;

  constructor(workers = defaultWorkerCount()) {
    let ok = typeof Worker !== 'undefined' && workers > 0;
    if (ok) {
      try {
        for (let k = 0; k < workers; k++) {
          const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
          w.onmessage = (
            e: MessageEvent<{ id: number; result?: JobResult; error?: string; version?: string }>,
          ) => {
            if (e.data.version !== undefined) this.onVersion?.(e.data.version);
            else this.onMessage(w, e.data);
          };
          w.onerror = (e) => this.onError(w, new Error(e.message || 'art worker error'));
          this.workers.push(w);
          this.idle.push(w);
        }
      } catch {
        ok = false;
        this.terminate();
      }
    }
    this.inline = !ok;
  }

  private onVersion: ((v: string) => void) | null = null;

  /** The art build version (hashed worker bundle URL), '' without workers. */
  version(): Promise<string> {
    const w = this.idle[0];
    if (!w) return Promise.resolve('');
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(''), 2000);
      this.onVersion = (v) => {
        clearTimeout(t);
        this.onVersion = null;
        resolve(v);
      };
      w.postMessage({ id: 0, hello: true });
    });
  }

  get workerCount(): number {
    return this.workers.length;
  }

  /** Run jobs (in parallel when possible); resolves with results in input order. */
  async run(jobs: readonly ArtJob[], onProgress?: ProgressFn): Promise<JobResult[]> {
    const total = jobs.reduce((s, j) => s + jobCost(j), 0);
    let done = 0;
    const tick = (job: ArtJob, r: JobResult, cached = false): void => {
      done += jobCost(job);
      this.timings.push({ job: label(job), ms: cached ? -1 : r.ms });
      onProgress?.(done, total, label(job));
    };
    // Cache hits first; only the misses go to the workers.
    const cached = this.cache
      ? await Promise.all(jobs.map((j) => this.cache!.get(j)))
      : jobs.map(() => undefined);
    const misses: ArtJob[] = [];
    jobs.forEach((j, k) => {
      const hit = cached[k];
      if (hit) {
        this.cacheHits++;
        tick(j, hit, true);
      } else misses.push(j);
    });
    if (misses.length === 0) return cached as JobResult[];
    const fresh = await this.runFresh(misses, tick);
    let m = 0;
    return jobs.map((j, k) => {
      const hit = cached[k];
      if (hit) return hit;
      const r = fresh[m++]!;
      this.cache?.put(j, r);
      return r;
    });
  }

  private async runFresh(
    jobs: readonly ArtJob[],
    tick: (job: ArtJob, r: JobResult) => void,
  ): Promise<JobResult[]> {
    if (this.inline) {
      const out: JobResult[] = [];
      for (const job of jobs) {
        await nextFrame();
        const r = runJob(job);
        tick(job, r);
        out.push(r);
      }
      return out;
    }
    const order = jobs.map((job, index) => ({ job, index }));
    order.sort((a, b) => jobCost(b.job) - jobCost(a.job));
    const results = new Array<JobResult>(jobs.length);
    await Promise.all(
      order.map(
        ({ job, index }) =>
          new Promise<void>((resolve, reject) => {
            this.queue.push({
              job,
              index,
              resolve: (r) => {
                results[index] = r;
                tick(job, r);
                resolve();
              },
              reject,
            });
            this.pump();
          }),
      ),
    );
    return results;
  }

  private pump(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const w = this.idle.pop()!;
      const p = this.queue.shift()!;
      this.busy.set(w, p);
      w.postMessage({ id: this.seq++, job: p.job });
    }
  }

  private onMessage(w: Worker, msg: { result?: JobResult; error?: string }): void {
    const p = this.busy.get(w);
    this.busy.delete(w);
    this.idle.push(w);
    if (p) {
      if (msg.result) p.resolve(msg.result);
      else p.reject(new Error(`art job ${label(p.job)} failed: ${msg.error ?? '?'}`));
    }
    this.pump();
  }

  private onError(w: Worker, err: Error): void {
    const p = this.busy.get(w);
    this.busy.delete(w);
    if (p) {
      // Retry inline so a broken worker never blocks the game.
      try {
        p.resolve(runJob(p.job));
      } catch (e) {
        p.reject(e instanceof Error ? e : err);
      }
    }
    this.idle.push(w);
    this.pump();
  }

  terminate(): void {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.idle = [];
  }
}

export function defaultWorkerCount(): number {
  const hc = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
  // The main thread only animates the loading screen meanwhile: use every core.
  return Math.max(2, Math.min(6, hc));
}

export function label(job: ArtJob): string {
  switch (job.kind) {
    case 'protesters':
      return `protesters(${job.types.join(',')})`;
    case 'buildings':
    case 'terrain':
      return `${job.kind}[${job.part}/${job.parts}]`;
    default:
      return job.kind;
  }
}
