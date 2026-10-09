/**
 * Parallel art loader: a small pool of Web Workers running art jobs (jobs.ts), longest first.
 * Falls back to running jobs inline (yielding a frame between jobs) when workers are not
 * available. Results are handed back in job order; the caller installs the atlases.
 */
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
  /** Per-job timings (ms in the worker) for diagnostics. */
  readonly timings: Array<{ job: string; ms: number }> = [];

  constructor(workers = defaultWorkerCount()) {
    let ok = typeof Worker !== 'undefined' && workers > 0;
    if (ok) {
      try {
        for (let k = 0; k < workers; k++) {
          const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
          w.onmessage = (e: MessageEvent<{ id: number; result?: JobResult; error?: string }>) =>
            this.onMessage(w, e.data);
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

  get workerCount(): number {
    return this.workers.length;
  }

  /** Run jobs (in parallel when possible); resolves with results in input order. */
  async run(jobs: readonly ArtJob[], onProgress?: ProgressFn): Promise<JobResult[]> {
    const total = jobs.reduce((s, j) => s + jobCost(j), 0);
    let done = 0;
    const tick = (job: ArtJob, r: JobResult): void => {
      done += jobCost(job);
      this.timings.push({ job: label(job), ms: r.ms });
      onProgress?.(done, total, label(job));
    };
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
