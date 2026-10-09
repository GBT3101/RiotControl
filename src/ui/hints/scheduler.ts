/**
 * Hint rate limiter (pure, unit-tested). Hints are *offered* when their trigger fires; the
 * scheduler shows at most one every `minGap` seconds, highest priority first, drops offers
 * older than their `ttl` (stale), ignores duplicates, and remembers once-only hints:
 * `once: 'profile'` (persisted through `onSeen`), `'run'` (until `resetRun`), `'never'`
 * (repeatable: idle quips, memos).
 *
 * Time only advances through `tick(dt)` — the caller stops ticking while the game is paused.
 */
export type HintChannel = 'advisor' | 'toast';
export type HintOnce = 'profile' | 'run' | 'never';

export interface HintOffer {
  id: string;
  channel: HintChannel;
  /** Higher shows first. */
  priority: number;
  /** Seconds the offer stays valid. */
  ttl: number;
  once: HintOnce;
}

interface Queued extends HintOffer {
  at: number;
}

export interface SchedulerOptions {
  /** Minimum seconds between two shown hints (default 20). */
  minGap?: number;
  /** A profile-once hint was shown / consumed (persist it). */
  onSeen?: (id: string) => void;
}

export class HintScheduler {
  now = 0;
  lastShown = -Infinity;
  readonly minGap: number;
  readonly seen: Set<string>;
  private readonly runSeen = new Set<string>();
  private queue: Queued[] = [];
  private readonly onSeen?: (id: string) => void;

  constructor(seen: Iterable<string> = [], opts: SchedulerOptions = {}) {
    this.seen = new Set(seen);
    this.minGap = opts.minGap ?? 20;
    this.onSeen = opts.onSeen;
  }

  /** Was this hint already shown (or consumed) for its once-scope? */
  spent(id: string): boolean {
    return this.seen.has(id) || this.runSeen.has(id);
  }

  get pending(): readonly HintOffer[] {
    return this.queue;
  }

  /** Offer a hint; false if it was already spent or is already queued. */
  offer(o: HintOffer): boolean {
    if (o.once !== 'never' && this.spent(o.id)) return false;
    if (this.queue.some((q) => q.id === o.id)) return false;
    this.queue.push({ ...o, at: this.now });
    return true;
  }

  /** Consume a hint without showing it (another UI element already said it). */
  markSeen(id: string, once: HintOnce = 'profile'): void {
    this.queue = this.queue.filter((q) => q.id !== id);
    this.spend(id, once);
  }

  private spend(id: string, once: HintOnce): void {
    if (once === 'profile') {
      if (!this.seen.has(id)) {
        this.seen.add(id);
        this.onSeen?.(id);
      }
    } else if (once === 'run') this.runSeen.add(id);
  }

  tick(dt: number): void {
    this.now += dt;
    this.queue = this.queue.filter((q) => this.now - q.at <= q.ttl);
  }

  /** Seconds until another hint may show (0 = now). */
  get cooldown(): number {
    return Math.max(0, this.lastShown + this.minGap - this.now);
  }

  /**
   * The hint to show now (removed from the queue and marked spent), or null. `canShow`
   * filters by channel availability (advisor busy, dossier on screen…).
   */
  next(canShow: (o: HintOffer) => boolean = () => true): HintOffer | null {
    if (this.cooldown > 0 || !this.queue.length) return null;
    const order = [...this.queue].sort((a, b) => b.priority - a.priority || a.at - b.at);
    const pick = order.find((q) => canShow(q));
    if (!pick) return null;
    this.queue = this.queue.filter((q) => q !== pick);
    this.lastShown = this.now;
    this.spend(pick.id, pick.once);
    const { at: _at, ...offer } = pick;
    return offer;
  }

  /** New run: forget run-once hints and pending offers. */
  resetRun(): void {
    this.runSeen.clear();
    this.queue = [];
    this.lastShown = -Infinity;
    this.now = 0;
  }

  /** Forget everything (Settings → tutorial replay). */
  resetProfile(): void {
    this.seen.clear();
    this.resetRun();
  }
}
