import { describe, expect, it } from 'vitest';
import { densityBoost, panSector, SfxLimiter, type PlayRequest, type SfxPolicy } from '../src/audio/limiter';
import { policyOf } from '../src/audio/sfx/catalog';

const base: SfxPolicy = { maxVoices: 4, minInterval: 0, priority: 4, aggregate: true, steal: true, dur: 0.3 };
const policies: Record<string, SfxPolicy> = {
  hit: base,
  gun: { ...base, priority: 6, minInterval: 0.05 },
  boom: { ...base, priority: 9, maxVoices: 2 },
  quiet: { ...base, priority: 2 },
  nosteal: { ...base, steal: false, maxVoices: 1 },
  ui: { ...base, priority: 10, aggregate: false },
};
const pol = (id: string): SfxPolicy => policies[id] ?? base;
const req = (id: string, over: Partial<PlayRequest> = {}): PlayRequest => ({
  id,
  gain: 0.5,
  pan: 0,
  pitch: 1,
  delay: 0,
  lowpass: 0,
  ...over,
});
const big = { maxPerSecond: 1e6, burst: 1e6 };

describe('SfxLimiter', () => {
  it('aggregates 200 identical hits in one frame into ≤ 3 louder triggers (one per pan sector)', () => {
    const l = new SfxLimiter(pol, big);
    for (let i = 0; i < 200; i++) l.submit(req('hit', { pan: ((i % 21) - 10) / 10, gain: 0.3 + (i % 5) * 0.1 }));
    const out = l.flush(0);
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out.reduce((n, t) => n + t.count, 0)).toBe(200);
    for (const t of out) {
      expect(t.gain).toBeGreaterThan(0.7); // max gain 0.7 boosted by the count
      expect(t.gain).toBeLessThanOrEqual(0.7 * 2 + 1e-9);
    }
    expect(new Set(out.map((t) => panSector(t.pan))).size).toBe(out.length);
  });

  it('density boost grows with count and is capped', () => {
    expect(densityBoost(1)).toBe(1);
    expect(densityBoost(2)).toBeGreaterThan(1);
    expect(densityBoost(8)).toBeGreaterThan(densityBoost(2));
    expect(densityBoost(1e6)).toBe(2);
    expect(densityBoost(1e6, 1.3)).toBe(1.3);
  });

  it('does not merge different sounds or different delay buckets', () => {
    const l = new SfxLimiter(pol, big);
    l.submit(req('hit'));
    l.submit(req('gun'));
    l.submit(req('hit', { delay: 0.5 }));
    expect(l.flush(0).length).toBe(3);
  });

  it('respects minInterval by carrying requests over and merging them later', () => {
    const l = new SfxLimiter(pol, big);
    l.submit(req('gun'));
    expect(l.flush(0).length).toBe(1);
    l.submit(req('gun'));
    l.submit(req('gun'));
    expect(l.flush(0.02)).toEqual([]); // too soon
    l.submit(req('gun'));
    const later = l.flush(0.06);
    expect(later.length).toBe(1);
    expect(later[0]!.count).toBe(3);
  });

  it('drops carried-over requests that went stale', () => {
    const l = new SfxLimiter(pol, { ...big, carryTtl: 0.1 });
    l.submit(req('gun'));
    l.flush(0);
    l.submit(req('gun'));
    l.flush(0.01);
    expect(l.flush(0.5)).toEqual([]);
    expect(l.stats.dropped).toBe(1);
  });

  it('caps voices per sound: steals the oldest, or drops when stealing is off', () => {
    const l = new SfxLimiter(pol, big);
    const tokens: number[] = [];
    for (let i = 0; i < 4; i++) {
      l.submit(req('hit'));
      tokens.push(l.flush(i * 0.01)[0]!.token);
    }
    expect(l.activeVoices(0.05, 'hit')).toBe(4);
    l.submit(req('hit'));
    const t = l.flush(0.05)[0]!;
    expect(t.steal).toBe(tokens[0]);
    expect(l.activeVoices(0.05, 'hit')).toBe(4);

    const n = new SfxLimiter(pol, big);
    n.submit(req('nosteal'));
    expect(n.flush(0).length).toBe(1);
    n.submit(req('nosteal'));
    expect(n.flush(0.01)).toEqual([]);
    expect(n.stats.dropped).toBe(1);
    // Voice ended → room again.
    n.submit(req('nosteal'));
    expect(n.flush(1).length).toBe(1);
  });

  it('caps new voices per flush, keeping the highest priority first', () => {
    const l = new SfxLimiter(pol, { ...big, maxPerFlush: 2 });
    l.submit(req('quiet', { pan: -1 }));
    l.submit(req('hit', { pan: -1 }));
    l.submit(req('boom', { pan: 1 }));
    l.submit(req('gun', { pan: 0 }));
    const out = l.flush(0);
    expect(out.map((t) => t.id)).toEqual(['boom', 'gun']);
  });

  it('global voice cap steals the weakest lower-priority voice, never a higher one', () => {
    const l = new SfxLimiter(pol, { ...big, maxVoices: 2 });
    l.submit(req('quiet', { pan: -1 }));
    l.submit(req('hit', { pan: 1 }));
    l.flush(0);
    l.submit(req('boom'));
    const [b] = l.flush(0.01);
    expect(b?.steal).toBeGreaterThan(0);
    expect(l.activeVoices(0.01)).toBe(2);
    // A low-priority newcomer cannot evict the boom or the hit.
    l.submit(req('quiet', { pan: 0 }));
    expect(l.flush(0.02)).toEqual([]);
  });

  it('rate-limits new voices with a token bucket (UI exempt)', () => {
    const l = new SfxLimiter(pol, { maxPerSecond: 10, burst: 3, maxVoices: 1000, maxPerFlush: 1000 });
    let n = 0;
    for (let f = 0; f < 60; f++) {
      // 200 hits/s over 1 s at 60 fps, spread over many distinct sounds/sectors.
      for (let k = 0; k < 3; k++) l.submit(req(`s${(f * 3 + k) % 30}`, { pan: ((k % 3) - 1) * 0.9 }));
      n += l.flush(f / 60).length;
    }
    expect(n).toBeLessThanOrEqual(3 + 10 + 1);
    const u = new SfxLimiter(pol, { maxPerSecond: 1, burst: 1 });
    for (let i = 0; i < 5; i++) u.submit(req('ui'));
    expect(u.flush(0).length).toBe(5);
  });

  it('catalogue policies are sane', () => {
    const p = policyOf('baton');
    expect(p.maxVoices).toBeGreaterThan(0);
    expect(p.dur).toBeGreaterThan(0);
    expect(policyOf('click').priority).toBe(10);
    expect(policyOf('nope').priority).toBe(0);
  });
});
