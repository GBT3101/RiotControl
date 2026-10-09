/**
 * Rate limiter / aggregator for one-shot sounds (pure, time injected, unit-tested).
 *
 * Requests are collected during a frame (`submit`) and resolved once (`flush(now)`):
 *  1. **Aggregate** — identical sounds in the same flush, pan sector (left/centre/right) and
 *     delay bucket merge into one trigger whose gain grows with the count (denser, louder —
 *     never N separate voices). 200 baton hits in one frame → at most 3 triggers.
 *  2. **Min interval** — a key that fired less than `minInterval` ago carries its group over
 *     to a later flush (merged again), so machine-gun-rate events cannot machine-gun voices.
 *  3. **Per-sound voice cap** — at `maxVoices` the oldest voice of that sound is stolen (or the
 *     new one dropped when the policy says `steal: false`).
 *  4. **Global caps** — at most `maxPerFlush` new voices per flush (highest priority × gain
 *     first), a token bucket of `maxPerSecond` new voices (UI exempt) and `maxVoices` alive in
 *     total; a newcomer steals the weakest lower-priority voice.
 */

export interface SfxPolicy {
  /** Concurrent voices of this sound. */
  maxVoices: number;
  /** Seconds between triggers of the same key (sound × sector). */
  minInterval: number;
  /** 0…10: explosions > guns > hits > ambience. UI uses 10. */
  priority: number;
  /** Merge same-flush requests (per pan sector). */
  aggregate: boolean;
  /** At `maxVoices`: steal the oldest voice (true) or drop the newcomer (false). */
  steal: boolean;
  /** Estimated voice length in seconds (bookkeeping until the engine refines it). */
  dur: number;
  /** Max loudness boost from aggregation (1 = none). Default 2. */
  boostCap?: number;
}

export interface PlayRequest {
  id: string;
  gain: number;
  pan: number;
  pitch: number;
  delay: number;
  /** Distance low-pass cutoff (Hz), 0 = none. */
  lowpass: number;
}

export interface Trigger extends PlayRequest {
  /** Requests merged into this trigger. */
  count: number;
  /** Voice token for `release`/`setEnd`. */
  token: number;
  /** Voice token the engine must fade out to make room, or -1. */
  steal: number;
}

export interface LimiterOptions {
  maxVoices: number;
  maxPerFlush: number;
  /** Token bucket: sustained new voices per second (priority < 10; UI is exempt). */
  maxPerSecond: number;
  /** Token bucket burst size. */
  burst: number;
  /** Carried-over groups older than this are dropped (seconds). */
  carryTtl: number;
}

export interface LimiterStats {
  requested: number;
  triggered: number;
  merged: number;
  dropped: number;
}

interface Group {
  key: string;
  /** Interval key: sound × sector (aggregating) or sound (non-aggregating). */
  ikey: string;
  req: PlayRequest;
  count: number;
  maxGain: number;
  panSum: number;
  weight: number;
  since: number;
}

interface VoiceRec {
  token: number;
  id: string;
  start: number;
  end: number;
  priority: number;
  gain: number;
}

/** Loudness growth of an aggregated hit: +~1.8 dB per doubling, capped. */
export function densityBoost(count: number, cap = 2): number {
  if (count <= 1) return 1;
  return Math.min(cap, 1 + 0.3 * Math.log2(count));
}

export function panSector(pan: number): number {
  return pan < -0.3 ? 0 : pan > 0.3 ? 2 : 1;
}

export class SfxLimiter {
  readonly opts: LimiterOptions;
  readonly stats: LimiterStats = { requested: 0, triggered: 0, merged: 0, dropped: 0 };
  private pending = new Map<string, Group>();
  private carry = new Map<string, Group>();
  private lastAt = new Map<string, number>();
  private voices: VoiceRec[] = [];
  private nextToken = 1;
  private seq = 0;

  constructor(
    private readonly policyOf: (id: string) => SfxPolicy,
    opts: Partial<LimiterOptions> = {},
  ) {
    this.opts = { maxVoices: 40, maxPerFlush: 12, maxPerSecond: 60, burst: 16, carryTtl: 0.25, ...opts };
    this.tokens = this.opts.burst;
  }

  private tokens: number;
  private lastFlush = -1;

  get pendingCount(): number {
    return this.pending.size;
  }

  submit(req: PlayRequest): void {
    this.stats.requested++;
    const p = this.policyOf(req.id);
    const bucket = Math.round(req.delay * 20);
    const ikey = p.aggregate ? `${req.id}|${panSector(req.pan)}` : req.id;
    const key = p.aggregate ? `${ikey}|${bucket}` : `${req.id}|#${this.seq++}`;
    const g = this.pending.get(key);
    const w = Math.max(1e-4, req.gain);
    if (g) {
      g.count++;
      this.stats.merged++;
      g.panSum += req.pan * w;
      g.weight += w;
      if (req.gain > g.maxGain) {
        g.maxGain = req.gain;
        g.req = { ...req, delay: Math.min(req.delay, g.req.delay) };
      } else if (req.delay < g.req.delay) g.req.delay = req.delay;
      if (req.lowpass === 0 || (g.req.lowpass !== 0 && req.lowpass > g.req.lowpass))
        g.req.lowpass = req.lowpass;
    } else {
      this.pending.set(key, {
        key,
        ikey,
        req: { ...req },
        count: 1,
        maxGain: req.gain,
        panSum: req.pan * w,
        weight: w,
        since: -1,
      });
    }
  }

  /** Voices alive at `now` for a sound id (all ids when omitted). */
  activeVoices(now: number, id?: string): number {
    let n = 0;
    for (const v of this.voices) if (v.end > now && (id === undefined || v.id === id)) n++;
    return n;
  }

  /** Refine a voice's end time (engine knows the real buffer length). */
  setEnd(token: number, end: number): void {
    const v = this.voices.find((x) => x.token === token);
    if (v) v.end = end;
  }

  release(token: number): void {
    const i = this.voices.findIndex((x) => x.token === token);
    if (i >= 0) this.voices.splice(i, 1);
  }

  /** Resolve everything submitted since the last flush into voice triggers. */
  flush(now: number): Trigger[] {
    // Expire voices; refill the rate bucket.
    if (this.voices.length) this.voices = this.voices.filter((v) => v.end > now);
    if (this.lastFlush >= 0 && now > this.lastFlush) {
      this.tokens = Math.min(this.opts.burst, this.tokens + (now - this.lastFlush) * this.opts.maxPerSecond);
    }
    this.lastFlush = now;

    // Merge carried-over groups with fresh ones.
    for (const [key, c] of this.carry) {
      if (now - c.since > this.opts.carryTtl) {
        this.stats.dropped += c.count;
        this.carry.delete(key);
        continue;
      }
      const g = this.pending.get(key);
      if (g) {
        g.count += c.count;
        g.panSum += c.panSum;
        g.weight += c.weight;
        g.since = c.since;
        if (c.maxGain > g.maxGain) {
          g.maxGain = c.maxGain;
          g.req = c.req;
        }
      } else this.pending.set(key, c);
      this.carry.delete(key);
    }

    const ready = [...this.pending.values()];
    this.pending.clear();

    // Highest priority × loudness first.
    const score = (g: Group): number => this.policyOf(g.req.id).priority * 10 + g.maxGain;
    ready.sort((a, b) => score(b) - score(a));

    const out: Trigger[] = [];
    for (const g of ready) {
      const p = this.policyOf(g.req.id);
      const last = this.lastAt.get(g.ikey);
      const exempt = p.priority >= 10;
      const starved = !exempt && this.tokens < 1;
      if (starved || (p.minInterval > 0 && last !== undefined && now - last < p.minInterval - 1e-9)) {
        // Too soon / over budget: carry over and merge into a later, denser trigger.
        if (g.since < 0) g.since = now;
        const c = this.carry.get(g.key);
        if (c) {
          c.count += g.count;
          c.panSum += g.panSum;
          c.weight += g.weight;
        } else this.carry.set(g.key, g);
        continue;
      }
      if (out.length >= this.opts.maxPerFlush) {
        this.stats.dropped += g.count;
        continue;
      }
      const gain = g.maxGain * densityBoost(g.count, p.boostCap ?? 2);
      let steal = -1;
      // Per-sound cap.
      const mine = this.voices.filter((v) => v.id === g.req.id && v.end > now);
      if (mine.length >= p.maxVoices) {
        if (!p.steal) {
          this.stats.dropped += g.count;
          continue;
        }
        let oldest = mine[0]!;
        for (const v of mine) if (v.start < oldest.start) oldest = v;
        steal = oldest.token;
      } else if (this.voices.length >= this.opts.maxVoices) {
        // Global cap: steal the weakest voice of lower or equal priority.
        let victim: VoiceRec | null = null;
        for (const v of this.voices) {
          if (v.priority > p.priority) continue;
          if (
            !victim ||
            v.priority < victim.priority ||
            (v.priority === victim.priority && v.gain < victim.gain)
          )
            victim = v;
        }
        if (!victim) {
          this.stats.dropped += g.count;
          continue;
        }
        steal = victim.token;
      }
      if (steal >= 0) this.release(steal);
      if (!exempt) this.tokens -= 1;
      const token = this.nextToken++;
      const start = now + g.req.delay;
      this.voices.push({ token, id: g.req.id, start, end: start + p.dur, priority: p.priority, gain });
      this.lastAt.set(g.ikey, now);
      this.stats.triggered++;
      out.push({
        ...g.req,
        gain,
        pan: g.weight > 0 ? g.panSum / g.weight : g.req.pan,
        count: g.count,
        token,
        steal,
      });
    }
    return out;
  }

  reset(): void {
    this.pending.clear();
    this.carry.clear();
    this.lastAt.clear();
    this.voices = [];
  }
}
