/**
 * First-run briefing (M10): the Minister walks the player through 9 short steps with pulsing
 * hi-vis brackets + a bobbing arrow on the relevant HUD rect or world tile and a light dim
 * around them. Steps advance on the player's actual actions (pan, deploy, LET THEM COME, …)
 * via `TutorialMachine`. Never pauses or blocks the game: the overlay is not interactive,
 * only the SKIP BRIEFING button is.
 *
 * Runs on the first run per city (settings.tutorialDone), when Settings → TUTORIAL REPLAY is
 * on, or with `?tutorial=1`; never with `?tutorial=0`, in the attract game or debug-jump runs.
 * `?tstep=N` starts at step N (screenshots).
 */
import { Container, Sprite } from 'pixi.js';
import { buf, rect } from '../../art/fx/draw';
import { tileToWorld } from '../../core/iso';
import type { GameController } from '../../game/controller';
import type { GameParams } from '../../game/params';
import type { CityId } from '../../maps/contract';
import { Button, stampFaces } from '../core/button';
import type { Rect } from '../core/node';
import { uiTex } from '../core/tex';
import { CITY_COPY } from '../text/cities';
import { TUTORIAL_TEXT, TUTORIAL_UI, fillTutorial } from '../text/tutorial';
import type { UiApp } from '../app';
import { pointerArt } from './art';
import {
  dimRects,
  inflate,
  placeAdvisor,
  shouldRunTutorial,
  tutorialParam,
  type AdvisorSpot,
} from './geometry';
import { TutorialMachine, type StepDef, type TutorialTarget } from './machine';

const DIM_ALPHA = 0.32;

interface Pointer {
  corners: Sprite[];
  arrow: Sprite;
}

/** 4×4 ink swatch, stretched for the dim (palette-pure). */
function inkPixel(): ReturnType<typeof buf> {
  const b = buf(4, 4);
  rect(b, 0, 0, 4, 4, 'ink');
  return b;
}

/** Is this a debug-jump run (no tutorial unless forced)? */
export function isDebugRun(p: GameParams | undefined): boolean {
  if (!p) return false;
  return (
    p.autoplay ||
    p.skip > 0 ||
    p.stress > 0 ||
    p.freeze ||
    !p.hud ||
    p.level !== undefined ||
    p.wave !== undefined ||
    p.scene !== undefined ||
    p.moment !== undefined
  );
}

export class Tutorial {
  readonly root = new Container({ label: 'tutorial' });
  private readonly dimLayer = new Container({ label: 'tutorial-dim' });
  private readonly dims: Sprite[] = [];
  private readonly pointers: Pointer[] = [];
  private readonly hand = new Sprite();
  private readonly drag = new Sprite();
  readonly skipButton: Button;
  machine: TutorialMachine | null = null;
  private game: GameController | null = null;
  private city: CityId = 'madrid';
  private t = 0;
  private dimA = 0;
  private showId = 0;
  private suggested: { i: number; j: number; name: string } | null = null;
  private camFrom: { x: number; y: number; zoom: number } | null = null;
  private camEase: { x0: number; y0: number; x1: number; y1: number; t: number } | null = null;
  private unsubs: Array<() => void> = [];
  private zones: Rect[] = [];

  constructor(private readonly app: UiApp) {
    const art = pointerArt();
    this.root.addChild(this.dimLayer);
    for (let k = 0; k < 2; k++) {
      const corners = art.corners.map((c, n) => new Sprite(uiTex(`tut:corner${n}`, () => c)));
      const arrow = new Sprite();
      this.root.addChild(...corners, arrow);
      this.pointers.push({ corners, arrow });
    }
    this.hand.texture = uiTex('tut:hand', () => art.hand);
    this.drag.texture = uiTex('tut:drag', () => art.drag);
    this.root.addChild(this.drag, this.hand);
    this.skipButton = new Button(stampFaces(TUTORIAL_UI.skip), {
      onTap: () => this.skip(),
      pad: 3,
    });
    this.root.addChild(this.skipButton);
    this.root.visible = false;
  }

  get active(): boolean {
    return !!this.machine?.active;
  }

  /** A run started: decide whether to brief the player. */
  onRunStart(city: CityId, game: GameController, runParams: GameParams | undefined): void {
    this.stop();
    const search = typeof location !== 'undefined' ? location.search : '';
    const s = this.app.settings;
    const run = shouldRunTutorial({
      param: tutorialParam(search),
      attract: game.attract,
      debugRun: isDebugRun(runParams),
      replay: s.replayTutorial,
      done: !!s.tutorialDone[city],
    });
    if (!run) return;
    if (s.replayTutorial) {
      s.replayTutorial = false;
      this.app.hints.resetProfile();
      this.app.saveSettings();
    }
    this.game = game;
    this.city = city;
    this.suggested = suggestTile(game);
    const cam = game.camera;
    this.camFrom = { x: cam.x, y: cam.y, zoom: cam.targetZoom };
    const m = new TutorialMachine({
      show: (st) => this.show(st),
      leave: (st) => this.leave(st),
      finish: (skipped) => this.finish(skipped),
    });
    this.machine = m;
    const bus = game.bus;
    this.unsubs.push(
      bus.on('unitDeployed', (e) => {
        m.fact('deployed');
        if (e.unit === 'sniper' || e.unit === 'brigade') m.fact('sniperDeployed');
      }),
      bus.on('waveStart', () => m.fact('waveStarted')),
      bus.on('unitDied', () => m.fact('officerDied')),
      bus.on('levelUp', (e) => {
        if (e.level >= 1) m.fact('level1');
      }),
    );
    if (game.world.level >= 1) m.fact('level1');
    if (game.world.director.phase !== 'prep') m.fact('waveStarted');
    const from = Number(new URLSearchParams(search).get('tstep') ?? 0) || 0;
    if (from >= 5) m.fact('officerDied');
    if (from >= 6) m.fact('level1');
    this.root.visible = true;
    m.start(from);
  }

  /** Drop everything (run ended / screen change). */
  stop(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.machine = null;
    this.game = null;
    this.root.visible = false;
    this.camEase = null;
    this.zones = [];
  }

  skip(): void {
    this.machine?.skip();
  }

  /* ── Machine hooks ─────────────────────────────────────────────────────────────── */

  private show(step: StepDef): void {
    const id = ++this.showId;
    const lines = TUTORIAL_TEXT[step.id];
    const vars = { choke: this.suggested?.name, city: CITY_COPY[this.city].name };
    const says: Array<{ text: string; mood: (typeof lines)[number]['mood'] }> = [];
    if (step.id === 'welcome') says.push({ text: CITY_COPY[this.city].welcome, mood: 'idle' });
    for (const l of lines)
      says.push({ text: fillTutorial(this.app.touch && l.touch ? l.touch : l.text, vars), mood: l.mood });
    const adv = this.app.advisor;
    // Action steps keep their last line up until the player acts (or a timeout).
    const sticky = !!step.until && step.timeout === undefined;
    let last: Promise<void> = Promise.resolve();
    says.forEach((s, k) => {
      const isLast = k === says.length - 1;
      last = adv.say(s.text, s.mood, {
        sticky: isLast && sticky,
        hold: isLast && step.timeout !== undefined ? 9 : undefined,
      });
    });
    void last.then(() => {
      if (id === this.showId) this.machine?.linesFinished();
    });
    if (step.id === 'deploy') this.focusSuggested();
    this.app.sfx('click');
  }

  private leave(_step: StepDef): void {
    this.showId++;
    this.app.advisor.clear();
  }

  private finish(skipped: boolean): void {
    const s = this.app.settings;
    s.tutorialDone[this.city] = true;
    s.replayTutorial = false;
    this.app.saveSettings();
    if (skipped) {
      this.app.advisor.clear();
      void this.app.advisor.say(TUTORIAL_UI.skipped, 'idle');
    }
    this.stop();
  }

  /* ── Targets ───────────────────────────────────────────────────────────────────── */

  /** Ease the camera to the suggested tile if it isn't comfortably on screen. */
  private focusSuggested(): void {
    const g = this.game;
    const s = this.suggested;
    if (!g || !s) return;
    const r = this.tileRect(s.i, s.j);
    const l = this.app.layout;
    const ok =
      r &&
      r.x > 40 &&
      r.x + r.w < l.W - 40 &&
      r.y > l.topBar.h + 30 &&
      r.y + r.h < l.deploy.y - 90;
    if (ok) return;
    const p = tileToWorld(s.i + 0.5, s.j + 0.5);
    this.camEase = { x0: g.camera.x, y0: g.camera.y, x1: p.x, y1: p.y - 10, t: 0 };
  }

  private tileRect(i: number, j: number): Rect | null {
    const g = this.game;
    if (!g) return null;
    const v = g.camera.view();
    const k = this.app.k;
    const p = tileToWorld(i + 0.5, j + 0.5);
    const sx = ((p.x - v.x) * v.zoom + Math.floor(v.width / 2)) / k;
    const sy = ((p.y - v.y) * v.zoom + Math.floor(v.height / 2)) / k;
    const w = (32 * v.zoom) / k;
    const h = (16 * v.zoom) / k;
    return { x: Math.round(sx - w / 2), y: Math.round(sy - h / 2), w: Math.round(w), h: Math.round(h) };
  }

  private rectFor(t: TutorialTarget): Rect | null {
    const hud = this.app.hud;
    if (!hud) return null;
    switch (t.kind) {
      case 'card': {
        const r = hud.deploy.cardRect(t.unit);
        const v = this.app.layout.cardsView;
        if (!r || r.x + r.w < v.x || r.x > v.x + v.w) return null;
        return r;
      }
      case 'tile':
        return this.suggested ? this.tileRect(this.suggested.i, this.suggested.j) : null;
      case 'hate':
        return hud.top.hateRect();
      case 'seal':
        return hud.top.legitRect();
      case 'integrity':
        return hud.top.integRect();
      case 'wave':
        return hud.wave.rect();
      default:
        return null;
    }
  }

  /* ── Frame ─────────────────────────────────────────────────────────────────────── */

  update(dt: number): void {
    const m = this.machine;
    const g = this.game;
    if (!m || !g || g.destroyed) {
      this.root.visible = false;
      return;
    }
    const app = this.app;
    const running = app.mode === 'game' && !app.topScreen && !g.paused;
    this.root.visible = app.mode === 'game' && !app.topScreen;
    this.t += dt;
    this.watchPan(g);
    this.easeCamera(g, dt);
    m.update(running ? dt : 0, !app.moments.busy);
    if (!this.machine) return; // finished during update
    this.draw(dt);
  }

  private watchPan(g: GameController): void {
    const m = this.machine!;
    if (m.facts.has('panned') || !this.camFrom || this.camEase) return;
    const c = g.camera;
    const d = Math.abs(c.x - this.camFrom.x) + Math.abs(c.y - this.camFrom.y);
    if (d > 40 || c.targetZoom !== this.camFrom.zoom) m.fact('panned');
  }

  private easeCamera(g: GameController, dt: number): void {
    const e = this.camEase;
    if (!e) return;
    e.t = Math.min(1, e.t + dt / 0.8);
    const k = e.t < 0.5 ? 4 * e.t * e.t * e.t : 1 - (-2 * e.t + 2) ** 3 / 2;
    g.camera.centerOn(e.x0 + (e.x1 - e.x0) * k, e.y0 + (e.y1 - e.y0) * k);
    if (e.t >= 1) this.camEase = null;
  }

  private draw(dt: number): void {
    const m = this.machine!;
    const l = this.app.layout;
    const step = m.state === 'showing' ? m.step : null;
    const targets: Rect[] = [];
    if (step) {
      for (const t of [step.target, step.also]) {
        if (!t) continue;
        const r = this.rectFor(t);
        if (r) targets.push(r);
      }
    }
    // Pointers: pulsing brackets + bobbing arrow.
    const art = pointerArt();
    const pulse = Math.floor(this.t * 4) % 2;
    const bob = Math.round(Math.sin(this.t * 6) * 2);
    this.zones = [];
    this.pointers.forEach((p, k) => {
      const r = targets[k];
      const on = !!r;
      for (const c of p.corners) c.visible = on;
      p.arrow.visible = on;
      if (!r) return;
      const o = 3 + pulse;
      const [tl, tr, bl, br] = p.corners;
      const cw = 8;
      tl!.position.set(r.x - o, r.y - o);
      tr!.position.set(r.x + r.w + o - cw, r.y - o);
      bl!.position.set(r.x - o, r.y + r.h + o - cw);
      br!.position.set(r.x + r.w + o - cw, r.y + r.h + o - cw);
      const cx = Math.round(r.x + r.w / 2);
      const up = r.y + r.h / 2 < l.H * 0.4;
      const a = up ? art.arrowUp : art.arrowDown;
      p.arrow.texture = uiTex(up ? 'tut:arrowUp' : 'tut:arrowDown', () => a);
      const ay = up ? r.y + r.h + o + 3 + Math.abs(bob) : r.y - o - a.h - 2 - Math.abs(bob);
      p.arrow.position.set(cx - Math.floor(a.w / 2), ay);
      this.zones.push(inflate(r, 6));
      this.zones.push({ x: cx - 10, y: ay - 5, w: a.w + 8, h: a.h + 10 });
    });
    // Pan gesture: a gloved hand sliding left/right in the middle of the free area.
    const pan = step?.target.kind === 'pan';
    this.hand.visible = this.drag.visible = pan;
    if (pan) {
      const cx = Math.floor(l.W / 2);
      const cy = Math.floor((l.topBar.h + l.deploy.y) / 2) - 10;
      const ph = (this.t % 1.8) / 1.8;
      const dx = Math.round(Math.sin(ph * Math.PI * 2) * 18);
      this.drag.position.set(cx - Math.floor(this.drag.texture.width / 2), cy + 18);
      this.hand.position.set(cx - 5 + dx, cy - 2);
      this.zones.push({ x: cx - 30, y: cy - 6, w: 60, h: 34 });
    }
    // Light dim around the highlighted rects.
    const want = targets.length ? DIM_ALPHA : 0;
    this.dimA += (want - this.dimA) * Math.min(1, dt * 8);
    const rects = this.dimA > 0.01 ? dimRects(l.W, l.H, targets.map((r) => inflate(r, 3))) : [];
    while (this.dims.length < rects.length) {
      const s = new Sprite(uiTex('tut:ink', () => inkPixel()));
      this.dims.push(s);
      this.dimLayer.addChild(s);
    }
    this.dims.forEach((s, k) => {
      const r = rects[k];
      s.visible = !!r;
      if (!r) return;
      s.position.set(r.x, r.y);
      s.width = r.w;
      s.height = r.h;
      s.alpha = this.dimA;
    });
    // Skip button above the advisor.
    const spot = this.advisorSpot ?? this.app.layout.advisor;
    const ext = this.app.advisor.extent();
    const top = ext ? ext.y : spot.bottom - 74;
    this.skipButton.position.set(spot.x + 2, Math.max(l.topBar.h + 2, top - this.skipButton.h - 3));
  }

  private advisorSpot: AdvisorSpot | null = null;

  /**
   * Where the advisor should sit this frame (keeps it off the highlighted rects and their
   * arrows), or null for the default spot.
   */
  advisorPlacement(def: AdvisorSpot): AdvisorSpot | null {
    if (!this.active || !this.zones.length) {
      this.advisorSpot = this.active ? def : null;
      return null;
    }
    const ext = this.app.advisor.extent();
    const size = { w: ext?.w ?? 250, h: (ext?.h ?? 70) + this.skipButton.h + 4 };
    const l = this.app.layout;
    const spot = placeAdvisor(def, size, this.zones, l.bannerY + 2);
    this.advisorSpot = spot;
    return spot === def ? null : spot;
  }
}

/**
 * Suggested first post: the road tile closest to the chokepoint nearest the Capitol's front
 * steps (the Capitol approach). Null if nothing deployable is near.
 */
export function suggestTile(game: GameController): { i: number; j: number; name: string } | null {
  const w = game.world;
  const map = w.map;
  const cap = map.capitol;
  const ci = cap.i + cap.w / 2;
  const cj = cap.j + cap.d + 1;
  let choke = map.chokepoints[0];
  let best = Infinity;
  for (const c of map.chokepoints) {
    const d = (c.i - ci) ** 2 + (c.j - cj) ** 2;
    if (d < best) {
      best = d;
      choke = c;
    }
  }
  const oi = choke ? Math.round(choke.i) : Math.round(ci);
  const oj = choke ? Math.round(choke.j) : Math.round(cj);
  let out: { i: number; j: number } | null = null;
  let bd = Infinity;
  for (let dj = -6; dj <= 6; dj++)
    for (let di = -6; di <= 6; di++) {
      const i = oi + di;
      const j = oj + dj;
      if (!w.canDeploy('riot', i, j).ok) continue;
      // Must be visible on screen (not behind a building).
      const p = tileToWorld(i + 0.5, j + 0.5);
      if (game.view.occlusionAt(p.x, p.y) !== 0) continue;
      const d = di * di + dj * dj;
      if (d < bd) {
        bd = d;
        out = { i, j };
      }
    }
  return out ? { ...out, name: choke?.name ?? CITY_COPY[map.city].capitol } : null;
}
