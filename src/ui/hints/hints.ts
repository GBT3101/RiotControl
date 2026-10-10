/**
 * Contextual hints (M10): game events → offers → `HintScheduler` (≤ 1 hint / 20 s, priority,
 * stale offers dropped, once per profile persisted in `riot.hints.v1`) → the Minister (advisor
 * line) or a toast (alert card). Advisor hints wait while the tutorial runs, a level-up dossier
 * is on screen or the Minister is already talking; nothing ever pauses the game.
 *
 * Debug: `?hints=0` disables hints, `?hint=<id>` shows one right away (screenshots), e.g.
 * `?hint=gasCharged`, `?hint=capitol3`, `?hint=codex:woke`, `?hint=level7`, `?hint=memo`.
 */
import { LEVELS, WIN_LEGITIMACY } from '../../data/levels';
import { protesterDef, type ProtesterId } from '../../data/protesters';
import { UNITS } from '../../data/units';
import type { GameController } from '../../game/controller';
import { waveForecast } from '../../sim/forecast';
import { protesterFigure } from '../art';
import { CITY_COPY } from '../text/cities';
import { HINT_TEXT, IDLE_QUIPS, MEMO_TITLE, type HintTextId } from '../text/hints';
import { CAPITOL_COPY, LEVEL_BLURBS } from '../text/moments';
import { PROTESTER_COPY, SIGHTING_TITLE } from '../text/protesters';
import { TIPS } from '../text/tips';
import type { AdvisorMood } from '../widgets/advisor';
import type { UiApp } from '../app';
import {
  ALMOST_AT,
  STALL_SECONDS,
  HINT_RULES,
  capitolHintId,
  capitolRule,
  codexHintId,
  codexRule,
  idleRule,
  levelHintId,
  levelRule,
  loadSeenHints,
  memoRule,
  saveSeenHints,
} from './defs';
import { HintScheduler, type HintOffer } from './scheduler';

export type HintContent =
  | { channel: 'advisor'; text: string; mood: AdvisorMood }
  | { channel: 'toast'; title: string; line: string; protester?: ProtesterId };

export class Hints {
  readonly sched: HintScheduler;
  private game: GameController | null = null;
  private unsubs: Array<() => void> = [];
  private readonly typesSeen = new Set<ProtesterId>();
  private breathers = 0;
  private capitolHitOffered = false;
  /** Wave-phase game seconds since the last officer death / level-up. */
  private stall = 0;
  private enabled = true;
  private rnd = 1;

  constructor(private readonly app: UiApp) {
    this.sched = new HintScheduler(loadSeenHints(), {
      onSeen: () => saveSeenHints(this.sched.seen),
    });
    app.bus.on('lowHate', () => this.offerFixed('lowHate'));
    app.bus.on('levelUpShown', (e) => this.onLevelUp(e.level));
  }

  /** Forget every seen hint (Settings → TUTORIAL REPLAY). */
  resetProfile(): void {
    this.sched.resetProfile();
    saveSeenHints([]);
  }

  bind(game: GameController): void {
    this.unbind();
    const search = typeof location !== 'undefined' ? location.search : '';
    const q = new URLSearchParams(search);
    this.enabled = q.get('hints') !== '0' && !game.attract;
    if (!this.enabled) return;
    this.game = game;
    this.sched.resetRun();
    this.typesSeen.clear();
    this.breathers = 0;
    this.capitolHitOffered = false;
    this.stall = 0;
    this.rnd = (Date.now() % 9973) + 1;
    const b = game.bus;
    this.unsubs.push(
      b.on('thrownOffRoof', () => this.offerFixed('sniperThrown')),
      b.on('unitDied', (e) => {
        this.stall = 0;
        if (e.unit === 'blockade') this.offerFixed('blockadeBroken');
      }),
      b.on('capitolDamaged', () => {
        if (this.capitolHitOffered) return;
        this.capitolHitOffered = true;
        this.offerFixed('capitolHit');
      }),
      b.on('capitolState', (e) => {
        if (e.state >= 1 && CAPITOL_COPY[e.state])
          this.sched.offer({ id: capitolHintId(e.state), ...capitolRule });
      }),
      b.on('abilityReady', () => this.offerFixed('gasCharged')),
      b.on('unitDeployed', (e) => {
        if (UNITS[e.unit].commandable && e.unit !== 'heli') this.offerFixed('commandable');
        if (e.unit === 'gas') this.offerFixed('gasThrow');
      }),
      b.on('bretaSpawned', () => this.offerFixed('breta')),
      b.on('spawned', (e) => {
        if (this.typesSeen.has(e.ptype)) return;
        this.typesSeen.add(e.ptype);
        if (e.ptype === 'prophet') this.offerFixed('prophets');
        if (e.ptype === 'cultist' || e.ptype === 'prophet') this.offerFixed('realWeapons');
        this.sched.offer({ id: codexHintId(e.ptype), ...codexRule });
      }),
      b.on('levelUp', (e) => {
        this.stall = 0;
        // The NEW THREAT alert already introduces these types.
        for (const p of e.protesters) this.sched.markSeen(codexHintId(p));
      }),
      b.on('attacked', (e) => {
        if (e.attackerKind === 'unit' && e.targetKind === 'unit' && e.attackerId !== e.targetId)
          this.offerFixed('friendlyFire');
        // Rammed over by the mob (the crush hit of sim/mob.ts): the first one teaches grouping.
        if (e.targetKind === 'unit' && e.dmgType === 'crush') this.offerFixed('rammed');
      }),
      // A climber heads up a roof nobody on the ground covers: lone snipers get stormed.
      b.on('climbStart', (e) => {
        if (e.building >= 0 && !game.world.roofCovered[e.building]) this.offerFixed('roofStormed');
      }),
      b.on('waveEnd', (e) => {
        this.breathers++;
        // First breather before a district joins in: point at the incoming-wave flags.
        if (waveForecast(game.world).districts.some((d) => d.isNew)) this.offerFixed('forecast');
        if (e.breather < 10 || e.wave < 2) return;
        const quip = this.breathers % 2 === 0;
        this.sched.offer({
          id: quip ? 'idle' : 'memo',
          ...(quip ? idleRule : memoRule),
          ttl: Math.max(4, e.breather - 4),
        });
      }),
    );
    const force = q.get('hint');
    if (force) setTimeout(() => this.forceShow(force), 600);
  }

  unbind(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.game = null;
  }

  private offerFixed(id: HintTextId): void {
    if (!this.enabled) return;
    this.sched.offer({ id, ...HINT_RULES[id] });
  }

  private onLevelUp(level: number): void {
    if (!this.enabled || !this.game || level < 1 || level >= LEVELS.length) return;
    if (level === 5 && !this.sched.spent('lethal')) return this.offerFixed('lethal');
    if (level === 10 && !this.sched.spent('heli')) return this.offerFixed('heli');
    this.sched.offer({ id: levelHintId(level), ...levelRule });
  }

  /* ── Frame ─────────────────────────────────────────────────────────────────────── */

  update(dt: number): void {
    const g = this.game;
    const app = this.app;
    if (!g || g.destroyed || app.mode !== 'game' || app.topScreen || g.paused) return;
    this.sched.tick(dt);
    const w = g.world;
    if (w.legit >= WIN_LEGITIMACY * ALMOST_AT && w.legit < WIN_LEGITIMACY)
      this.offerFixed('almost');
    // M12: progress comes from losing officers — nudge players who only kill protesters.
    if (w.director.phase === 'wave') {
      this.stall += dt * g.speed;
      if (this.stall > STALL_SECONDS && w.level < LEVELS.length - 1) {
        this.offerFixed('stalled');
        this.stall = 0;
      }
    }
    const hint = this.sched.next((o) => this.canShow(o));
    if (hint) this.show(hint);
  }

  private canShow(o: HintOffer): boolean {
    if (o.channel === 'toast') return true;
    const app = this.app;
    return !app.tutorial.active && !app.advisor.speaking && !app.moments.busy;
  }

  /** Text for a hint id (null if unknown). */
  content(id: string): HintContent | null {
    const touch = this.app.touch;
    if (id in HINT_TEXT) {
      const h = HINT_TEXT[id as HintTextId];
      return { channel: 'advisor', text: touch && h.touch ? h.touch : h.text, mood: h.mood };
    }
    let m = /^capitol(\d)$/.exec(id);
    if (m) {
      const c = CAPITOL_COPY[Number(m[1])];
      return c ? { channel: 'advisor', text: c.minister, mood: c.mood } : null;
    }
    m = /^level(\d+)$/.exec(id);
    if (m) {
      const b = LEVEL_BLURBS[Number(m[1])];
      return b ? { channel: 'advisor', text: b.text, mood: b.mood } : null;
    }
    m = /^codex:(\w+)$/.exec(id);
    if (m) {
      const p = m[1] as ProtesterId;
      const c = PROTESTER_COPY[p];
      return c
        ? {
            channel: 'toast',
            title: SIGHTING_TITLE(protesterDef(p).name),
            line: c.line,
            protester: p,
          }
        : null;
    }
    if (id === 'idle') {
      const city = this.game?.world.map.city ?? this.app.city;
      const pool = [...IDLE_QUIPS, ...CITY_COPY[city].flavour];
      return { channel: 'advisor', text: pool[this.roll(pool.length)]!, mood: 'idle' };
    }
    if (id === 'memo')
      return { channel: 'toast', title: MEMO_TITLE, line: TIPS[this.roll(TIPS.length)]! };
    return null;
  }

  private roll(n: number): number {
    this.rnd = (this.rnd * 16807) % 2147483647;
    return this.rnd % n;
  }

  private show(o: HintOffer): void {
    const c = this.content(o.id);
    if (!c) return;
    if (c.channel === 'advisor') {
      void this.app.advisor.say(c.text, c.mood);
      return;
    }
    const fig = c.protester ? protesterFigure(c.protester) : null;
    this.app.moments.alert('info', c.title, c.line, fig, { ttl: 7, key: `hint:${o.id}` });
    this.app.sfx('click');
  }

  /** Debug: show a hint now (ignores the rate limit and once-only state). */
  forceShow(id: string): void {
    const c = this.content(id);
    if (!c) return;
    if (c.channel === 'advisor') void this.app.advisor.say(c.text, c.mood, { sticky: true });
    else this.show({ id, ...memoRule });
  }
}
