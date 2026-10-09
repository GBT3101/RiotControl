/** M10 hints: rate limiter, priorities, staleness, once-only persistence. */
import { describe, expect, it } from 'vitest';
import { HintScheduler, type HintOffer } from '../src/ui/hints/scheduler';
import {
  HINT_RULES,
  HINTS_KEY,
  capitolRule,
  codexRule,
  idleRule,
  levelRule,
  loadSeenHints,
  saveSeenHints,
} from '../src/ui/hints/defs';
import { HINT_TEXT, type HintTextId } from '../src/ui/text/hints';
import { memoryStorage } from '../src/ui/storage';

const offer = (
  id: string,
  priority = 1,
  ttl = 30,
  once: HintOffer['once'] = 'profile',
): HintOffer => ({
  id,
  channel: 'advisor',
  priority,
  ttl,
  once,
});

describe('hint scheduler', () => {
  it('shows at most one hint per minGap and queues the rest', () => {
    const s = new HintScheduler([], { minGap: 20 });
    s.offer(offer('a'));
    s.offer(offer('b'));
    expect(s.next()?.id).toBe('a');
    expect(s.next()).toBeNull();
    s.tick(19);
    expect(s.next()).toBeNull();
    s.tick(1.5);
    expect(s.next()?.id).toBe('b');
  });

  it('prefers higher priority, then older offers', () => {
    const s = new HintScheduler();
    s.offer(offer('low', 1));
    s.tick(1);
    s.offer(offer('high', 5));
    s.offer(offer('high2', 5));
    expect(s.next()?.id).toBe('high');
  });

  it('drops stale offers', () => {
    const s = new HintScheduler([], { minGap: 20 });
    s.offer(offer('first', 9));
    s.offer(offer('stale', 1, 10));
    s.offer(offer('fresh', 1, 60));
    expect(s.next()?.id).toBe('first');
    s.tick(21);
    expect(s.pending.map((p) => p.id)).toEqual(['fresh']);
    expect(s.next()?.id).toBe('fresh');
  });

  it('respects channel availability without losing the offer', () => {
    const s = new HintScheduler();
    s.offer(offer('a'));
    expect(s.next(() => false)).toBeNull();
    expect(s.pending.length).toBe(1);
    expect(s.next(() => true)?.id).toBe('a');
  });

  it('never repeats once-only hints, ignores duplicates', () => {
    const s = new HintScheduler([], { minGap: 0 });
    expect(s.offer(offer('a'))).toBe(true);
    expect(s.offer(offer('a'))).toBe(false);
    expect(s.next()?.id).toBe('a');
    expect(s.offer(offer('a'))).toBe(false);
    // run-once: back after resetRun; never: always repeatable.
    s.offer(offer('r', 1, 30, 'run'));
    expect(s.next()?.id).toBe('r');
    expect(s.offer(offer('r', 1, 30, 'run'))).toBe(false);
    s.resetRun();
    expect(s.offer(offer('r', 1, 30, 'run'))).toBe(true);
    expect(s.offer(offer('a'))).toBe(false); // profile survives a new run
    s.offer(offer('idle', 0, 30, 'never'));
    s.next();
    s.next();
    expect(s.offer(offer('idle', 0, 30, 'never'))).toBe(true);
  });

  it('markSeen consumes a hint without showing it', () => {
    const s = new HintScheduler();
    s.offer(offer('codex:mob'));
    s.markSeen('codex:mob');
    expect(s.pending.length).toBe(0);
    expect(s.offer(offer('codex:mob'))).toBe(false);
  });

  it('persists profile-once hints across sessions', () => {
    const st = memoryStorage();
    const s = new HintScheduler(loadSeenHints(st), {
      minGap: 0,
      onSeen: () => saveSeenHints(s.seen, st),
    });
    s.offer(offer('breta'));
    s.offer(offer('level3', 1, 30, 'run'));
    s.next();
    s.next();
    expect(JSON.parse(st.data.get(HINTS_KEY)!)).toEqual({ seen: ['breta'] });
    const s2 = new HintScheduler(loadSeenHints(st));
    expect(s2.offer(offer('breta'))).toBe(false);
    expect(s2.offer(offer('level3', 1, 30, 'run'))).toBe(true);
    s2.resetProfile();
    expect(s2.offer(offer('breta'))).toBe(true);
  });

  it('survives corrupt storage', () => {
    const st = memoryStorage();
    st.setItem(HINTS_KEY, '{nope');
    expect(loadSeenHints(st)).toEqual([]);
    st.setItem(HINTS_KEY, JSON.stringify({ seen: ['a', 3, null] }));
    expect(loadSeenHints(st)).toEqual(['a']);
    expect(loadSeenHints(null)).toEqual([]);
  });
});

describe('hint table', () => {
  it('every fixed hint has text and a rule', () => {
    for (const id of Object.keys(HINT_TEXT) as HintTextId[]) {
      expect(HINT_RULES[id], id).toBeTruthy();
      expect(HINT_RULES[id].ttl).toBeGreaterThan(0);
    }
    expect(Object.keys(HINT_RULES).sort()).toEqual(Object.keys(HINT_TEXT).sort());
  });

  it('once-scopes: one-offs per profile, blurbs per run, filler repeatable', () => {
    expect(capitolRule.once).toBe('profile');
    expect(codexRule.channel).toBe('toast');
    expect(levelRule.once).toBe('run');
    expect(idleRule.once).toBe('never');
  });
});
