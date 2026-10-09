/**
 * Hint table (trigger → channel / priority / staleness / once-scope) and persistence. The copy
 * lives in src/ui/text (hints.ts, moments.ts, protesters.ts, tips.ts). docs/M10.md lists the
 * triggers.
 */
import type { ProtesterId } from '../../data/protesters';
import { browserStorage, readJson, writeJson, type KeyValueStorage } from '../storage';
import type { HintTextId } from '../text/hints';
import type { HintOffer } from './scheduler';

export const HINTS_KEY = 'riot.hints.v1';

type Rule = Omit<HintOffer, 'id'>;

const advisor = (priority: number, ttl = 25): Rule => ({
  channel: 'advisor',
  priority,
  ttl,
  once: 'profile',
});

/** Rules of the fixed (HINT_TEXT) hints. */
export const HINT_RULES: Record<HintTextId, Rule> = {
  capitolHit: advisor(9, 15),
  prophets: advisor(8, 20),
  breta: advisor(7, 20),
  sniperThrown: advisor(6),
  lowHate: advisor(6, 15),
  gasCharged: advisor(5, 30),
  commandable: advisor(5, 30),
  blockadeBroken: advisor(4),
  friendlyFire: advisor(4),
  lethal: advisor(5, 40),
  heli: advisor(5, 40),
  almost: advisor(6, 60),
  stalled: advisor(5, 40),
  realWeapons: advisor(7, 30),
  gasThrow: advisor(4, 30),
};

/** Seconds of wave time without an officer death or level-up before "Legitimacy stalled?". */
export const STALL_SECONDS = 90;

/** Capitol damage state N (1–5): the Minister's reaction. */
export const capitolRule: Rule = advisor(9, 15);
export const capitolHintId = (state: number): string => `capitol${state}`;

/** First sighting of a protester type: codex toast. */
export const codexRule: Rule = { channel: 'toast', priority: 3, ttl: 20, once: 'profile' };
export const codexHintId = (p: ProtesterId): string => `codex:${p}`;

/** Level-up blurb (every run). */
export const levelRule: Rule = { channel: 'advisor', priority: 2, ttl: 30, once: 'run' };
export const levelHintId = (level: number): string => `level${level}`;

/** Breather filler: Minister quip or a Ministry memo (tip). Repeatable. */
export const idleRule: Rule = { channel: 'advisor', priority: 0, ttl: 12, once: 'never' };
export const memoRule: Rule = { channel: 'toast', priority: 0, ttl: 12, once: 'never' };

/** Fraction of the win Legitimacy that triggers "almost legitimate". */
export const ALMOST_AT = 0.9;

export function loadSeenHints(storage: KeyValueStorage | null = browserStorage()): string[] {
  const raw = readJson(storage, HINTS_KEY) as { seen?: unknown } | null;
  const seen = raw && Array.isArray(raw.seen) ? raw.seen : [];
  return seen.filter((x): x is string => typeof x === 'string').slice(0, 200);
}

export function saveSeenHints(
  seen: Iterable<string>,
  storage: KeyValueStorage | null = browserStorage(),
): boolean {
  return writeJson(storage, HINTS_KEY, { seen: [...seen] });
}
