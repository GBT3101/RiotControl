/**
 * Game "moments" (the game keeps running underneath):
 * - level-up: "NEW TOOL OF ORDER APPROVED" ribbon drops in + the unlock dossier (manila folder,
 *   the new deploy card, typewritten notes, paper clip, APPROVED / LEVEL n rubber stamps that
 *   slam down) — auto-dismisses, tap to dismiss;
 * - wave incoming: hazard-tape banner slides across;
 * - alerts (stacked top-left, tap to jump the camera): new threat (protester figure), Breta
 *   sighted, Prophets warning, Capitol damage state;
 * - info toasts (short centred one-liners: "NOT ENOUGH HATE").
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { buf, rect, stamp } from '../../art/fx/draw';
import type { PixelBuffer } from '../../art/lib/pixels';
import { ribbon, rubberStamp, waveBanner } from '../../art/uikit/banners';
import { deployCard } from '../../art/uikit/cards';
import { ICONS } from '../../art/uikit/icons';
import { PAPERCLIP, folderTab, panel } from '../../art/uikit/panels';
import { bretaPortrait } from '../../art/uikit/portraits';
import { FONTS, drawText, measureText, textSprite } from '../../art/uikit/text';
import { LEVELS } from '../../data/levels';
import { protesterDef, type ProtesterId } from '../../data/protesters';
import { UNITS, type UnitId } from '../../data/units';
import { HOTKEYS } from '../../game/controller';
import { protesterFigure, scaleUp, unitPortrait } from '../art';
import { ease, prog, stampDrop } from '../core/anim';
import { makeInteractive } from '../core/node';
import { ownTex, uiTex, destroyOwned } from '../core/tex';
import { CAPITOL_COPY, PROTESTER_COPY, UI_TEXT, UNIT_COPY, waveLine } from '../strings';
import type { UiApp } from '../app';

/* ── Pixel compositions ───────────────────────────────────────────────────────────── */

/** Unlock dossier (190×84 + tab above): returns the base (without stamps) and stamp layers. */
export function unlockDossier(
  unit: UnitId,
  level: number,
): { base: PixelBuffer; approved: PixelBuffer; levelStamp: PixelBuffer } {
  const W = 190;
  const H = 84;
  const b = buf(W + 4, H + 14);
  const oy = 10;
  stamp(b, panel('manila', W, H), 0, oy);
  stamp(b, folderTab(46), 8, oy - 8);
  rect(b, 9, oy - 1, 44, 2, 'stone4');
  drawText(b, FONTS.small, `FILE ${String(level).padStart(2, '0')}`, 14, oy - 7, 'earth2');
  stamp(b, panel('paper', 128, 58), 54, oy + 7);
  const card = deployCard({
    portrait: unitPortrait(unit),
    cost: UNITS[unit].cost,
    hotkey: HOTKEYS[unit],
    state: 'ready',
  });
  stamp(b, card, 10, oy + 12);
  stamp(b, PAPERCLIP, 168, oy - 4);
  const copy = UNIT_COPY[unit];
  drawText(b, FONTS.smallBold, UNITS[unit].name.toUpperCase(), 65, oy + 12, 'ink', {
    maxWidth: 112,
  });
  drawText(b, FONTS.mono, copy.notes, 65, oy + 24, 'gray1', { lineGap: -1 });
  drawText(b, FONTS.small, copy.footnote, 65, oy + 53, 'stone1');
  return {
    base: b,
    approved: rubberStamp('APPROVED', 'green2', { tilt: -0.1 }),
    levelStamp: rubberStamp(`LEVEL ${level}`, 'crim1', {
      font: FONTS.smallBold,
      tilt: 0.08,
      seed: 3,
    }),
  };
}

export type AlertKind = 'threat' | 'breta' | 'prophets' | 'capitol' | 'info';

const ALERT_INK: Record<AlertKind, string> = {
  threat: 'crim1',
  breta: 'hivis2',
  prophets: 'crim2',
  capitol: 'ochre2',
  info: 'navy2',
};

/** Alert card: coloured left band, icon/figure well, title (bold) + line (small). */
export function alertCard(
  kind: AlertKind,
  title: string,
  line: string,
  icon: PixelBuffer | null,
  maxW = 190,
): PixelBuffer {
  const iw = icon ? Math.max(20, icon.w + 6) : 0;
  const textW = maxW - iw - 16;
  const tm = measureText(FONTS.smallBold, title, textW);
  const lm = line ? measureText(FONTS.small, line, textW) : { w: 0, h: 0 };
  const W = Math.min(maxW, Math.max(tm.w, lm.w) + iw + 16);
  const H = Math.max(icon ? icon.h + 8 : 0, tm.h + (line ? lm.h + 4 : 0) + 12);
  const b = buf(W, H);
  stamp(b, panel('tooltip', W, H), 0, 0);
  rect(b, 1, 1, 3, H - 3, ALERT_INK[kind]);
  if (icon) {
    rect(b, 6, 4, iw - 2, H - 8, 'navy0');
    stamp(b, icon, 6 + Math.floor((iw - 2 - icon.w) / 2), H - 4 - icon.h);
  }
  const x = 8 + iw;
  drawText(b, FONTS.smallBold, title, x, 5, kind === 'info' ? 'ink' : 'crim1', {
    maxWidth: textW,
  });
  if (line) drawText(b, FONTS.small, line, x, 5 + tm.h + 4, 'gray1', { maxWidth: textW });
  return b;
}

/* ── Runtime ─────────────────────────────────────────────────────────────────────── */

interface Alert {
  sprite: Sprite;
  tex: Texture;
  t0: number;
  ttl: number;
  y: number;
  targetY: number;
  onTap?: () => void;
  key: string;
}

interface Stage {
  kind: 'levelup' | 'wave';
  t0: number;
  dur: number;
  root: Container;
  parts: Record<string, Sprite>;
  owned: Texture[];
  dismissed: boolean;
  holder?: Container;
}

export class Moments {
  readonly root = new Container({ label: 'moments' });
  private readonly alertLayer = new Container({ label: 'alerts' });
  private readonly stageLayer = new Container({ label: 'stage-moments' });
  private readonly infoLayer = new Container({ label: 'info-toasts' });
  private readonly alerts: Alert[] = [];
  private readonly queue: Array<() => Stage> = [];
  private current: Stage | null = null;
  private now = 0;
  private info: { sprite: Sprite; tex: Texture; t0: number } | null = null;

  constructor(private readonly app: UiApp) {
    this.root.addChild(this.stageLayer, this.alertLayer, this.infoLayer);
  }

  /** Remove everything (new run). */
  clear(): void {
    for (const a of this.alerts) {
      a.sprite.destroy();
      a.tex.destroy(true);
    }
    this.alerts.length = 0;
    this.queue.length = 0;
    if (this.current) this.endStage(this.current);
    this.current = null;
    if (this.info) {
      this.info.sprite.destroy();
      this.info.tex.destroy(true);
      this.info = null;
    }
  }

  /* Center-stage moments (queued) */

  levelUp(level: number): void {
    const def = LEVELS[level];
    if (!def) return;
    this.queue.push(() => this.makeLevelUp(level, def.unit));
  }

  wave(n: number): void {
    // A wave banner never waits behind a level-up for long: drop stale ones.
    this.queue.push(() => this.makeWave(n));
  }

  private makeLevelUp(level: number, unit: UnitId): Stage {
    const root = new Container({ label: 'levelup' });
    const narrow = this.app.layout.W < 310;
    const rib = ribbon(UI_TEXT.levelUp, narrow ? FONTS.smallBold : FONTS.large);
    const d = unlockDossier(unit, level);
    const owned = [ownTex(rib, 'levelup:ribbon'), ownTex(d.base, 'levelup:dossier')];
    const ribbonS = new Sprite(owned[0]!);
    const dossierSprite = new Sprite(owned[1]!);
    const dossier = new Container({ label: 'dossier' });
    dossier.addChild(dossierSprite);
    const approved = new Sprite(uiTex('stamp:approved', () => d.approved));
    const lvl = new Sprite(ownTex(d.levelStamp, 'levelup:lvl'));
    owned.push(lvl.texture);
    approved.anchor.set(0.5);
    lvl.anchor.set(0.5);
    dossier.addChild(approved, lvl);
    approved.position.set(
      106 + Math.floor(d.approved.w / 2),
      10 + 50 + Math.floor(d.approved.h / 2),
    );
    lvl.position.set(2 + Math.floor(d.levelStamp.w / 2), 10 + 67 + Math.floor(d.levelStamp.h / 2));
    approved.visible = lvl.visible = false;
    root.addChild(ribbonS, dossier);
    const st: Stage = {
      kind: 'levelup',
      t0: this.now,
      dur: 6.5,
      root,
      parts: { ribbon: ribbonS, dossier: dossierSprite, approved, lvl },
      holder: dossier,
      owned,
      dismissed: false,
    };
    makeInteractive(dossierSprite, { tap: () => (st.dismissed = true) });
    makeInteractive(ribbonS, { tap: () => (st.dismissed = true) });
    return st;
  }

  private makeWave(n: number): Stage {
    const root = new Container({ label: 'wave-banner' });
    const t = ownTex(waveBanner(n), 'wave:banner');
    const s = new Sprite(t);
    // M10: a dry sub-line under the banner (outlined small text, no panel).
    const sub = textSprite(FONTS.small, waveLine(n), 'stone5', {
      outline: 'ink',
      outlineThin: true,
    });
    const st = ownTex(sub, 'wave:sub');
    const subS = new Sprite(st);
    root.addChild(s, subS);
    return {
      kind: 'wave',
      t0: this.now,
      dur: 2.8,
      root,
      parts: { banner: s, sub: subS },
      owned: [t, st],
      dismissed: false,
    };
  }

  private endStage(st: Stage): void {
    destroyOwned(st.root);
    for (const t of st.owned) t.destroy(true);
  }

  private updateStage(st: Stage): boolean {
    const l = this.app.layout;
    const t = this.now - st.t0;
    if (st.kind === 'wave') {
      const s = st.parts.banner!;
      const w = s.texture.width;
      const cx = Math.floor((l.W - w) / 2);
      let x: number;
      if (t < 0.35) x = Math.round(-w + (cx + w) * ease.outCubic(t / 0.35));
      else if (t < st.dur - 0.35) x = cx;
      else x = Math.round(cx + (l.W - cx) * ease.inCubic((t - (st.dur - 0.35)) / 0.35));
      s.position.set(x, l.bannerY + 4);
      const sub = st.parts.sub;
      if (sub) {
        const sw = sub.texture.width;
        const sx = Math.floor((l.W - sw) / 2) + (x - cx);
        sub.position.set(sx, l.bannerY + 4 + s.texture.height + 2);
        sub.visible = t > 0.25;
      }
      return t < st.dur;
    }
    const rib = st.parts.ribbon!;
    const dosS = st.parts.dossier!;
    const dos = st.holder ?? dosS;
    if (st.dismissed && st.dur > t + 0.3) st.dur = t + 0.3;
    const out = st.dur - t < 0.3 ? 1 - (st.dur - t) / 0.3 : 0;
    const rx = Math.floor((l.W - rib.texture.width) / 2);
    const ry = l.bannerY;
    const rp = prog(t, 0, 0.45);
    rib.position.set(rx, Math.round(ry - 40 * (1 - ease.outBounce(rp))) - Math.round(out * 60));
    const dx = Math.floor((l.W - dosS.texture.width) / 2);
    const dyTarget = ry + rib.texture.height + 2;
    const dp = prog(t, 0.25, 0.4);
    // Keep the dossier clear of the deploy bar on short screens.
    const maxY = l.deploy.y - dosS.texture.height - 2;
    const dy = Math.min(dyTarget, maxY);
    dos.position.set(dx, Math.round(dy - 30 * (1 - ease.outBack(dp))) + Math.round(out * 20));
    dos.alpha = dp <= 0 ? 0 : 1 - out;
    rib.alpha = 1 - out;
    const a = st.parts.approved!;
    const lv = st.parts.lvl!;
    const ta = t - 0.85;
    if (ta >= 0) {
      if (!a.visible) this.app.sfx('stamp');
      a.visible = true;
      a.y = 10 + 50 + Math.floor(a.texture.height / 2) + stampDrop(ta / 0.2);
    }
    const tl = t - 1.25;
    if (tl >= 0) {
      if (!lv.visible) this.app.sfx('stamp');
      lv.visible = true;
      lv.y = 10 + 67 + Math.floor(lv.texture.height / 2) + stampDrop(tl / 0.2);
    }
    return t < st.dur;
  }

  /* Alerts (stacked, top-left) */

  alert(
    kind: AlertKind,
    title: string,
    line: string,
    icon: PixelBuffer | null,
    opts: { ttl?: number; onTap?: () => void; key?: string } = {},
  ): void {
    const key = opts.key ?? `${kind}:${title}`;
    // De-duplicate: refresh an identical alert instead of stacking it.
    const dup = this.alerts.find((a) => a.key === key);
    if (dup) {
      dup.t0 = this.now;
      return;
    }
    const maxW = Math.min(200, this.app.layout.W - 12);
    const tex = ownTex(alertCard(kind, title, line, icon, maxW), `alert:${kind}`);
    const sprite = new Sprite(tex);
    const a: Alert = {
      sprite,
      tex,
      t0: this.now,
      ttl: opts.ttl ?? 6,
      y: 0,
      targetY: 0,
      onTap: opts.onTap,
      key,
    };
    makeInteractive(sprite, {
      tap: () => {
        a.onTap?.();
        a.ttl = Math.min(a.ttl, this.now - a.t0 + 0.2);
      },
    });
    this.alertLayer.addChild(sprite);
    this.alerts.unshift(a);
    if (this.alerts.length > 4) {
      const old = this.alerts.pop()!;
      old.sprite.destroy();
      old.tex.destroy(true);
    }
  }

  newThreat(p: ProtesterId, onTap?: () => void): void {
    const fig = protesterFigure(p);
    const icon = fig ? scaleUp(fig, fig.h <= 22 ? 1 : 1) : null;
    this.alert('threat', UI_TEXT.newThreat(protesterDef(p).name), PROTESTER_COPY[p].line, icon, {
      ttl: 7,
      onTap,
    });
  }

  breta(onTap?: () => void): void {
    this.alert('breta', UI_TEXT.bretaTitle, UI_TEXT.bretaLine, bretaPortrait(), {
      ttl: 8,
      onTap,
    });
  }

  prophets(onTap?: () => void): void {
    this.alert('prophets', UI_TEXT.prophetsTitle, UI_TEXT.prophetsLine, ICONS.prophets(), {
      ttl: 7,
      onTap,
    });
  }

  capitol(state: number, onTap?: () => void): void {
    const c = CAPITOL_COPY[state];
    this.alert('capitol', c?.title ?? 'CAPITOL DAMAGED', c?.line ?? '', ICONS.capitol(), {
      ttl: 6,
      onTap,
      key: 'capitol',
    });
  }

  /** Short centred one-liner (errors, confirmations). */
  infoToast(text: string): void {
    if (this.info) {
      this.info.sprite.destroy();
      this.info.tex.destroy(true);
    }
    const m = measureText(FONTS.smallBold, text);
    const b = buf(m.w + 14, m.h + 10);
    stamp(b, panel('tooltip', b.w, b.h), 0, 0);
    drawText(b, FONTS.smallBold, text, 7, 5, 'crim1');
    const tex = ownTex(b, 'info-toast');
    const sprite = new Sprite(tex);
    this.infoLayer.addChild(sprite);
    this.info = { sprite, tex, t0: this.now };
  }

  update(dt: number): void {
    this.now += dt;
    const l = this.app.layout;
    // Stage queue.
    if (!this.current && this.queue.length > 0) {
      this.current = this.queue.shift()!();
      this.stageLayer.addChild(this.current.root);
    }
    if (this.current && !this.updateStage(this.current)) {
      this.endStage(this.current);
      this.current = null;
    }
    // Alerts: slide/fade in from the left, stack downward under the top bar.
    let y = l.topBar.h + 4;
    for (let k = 0; k < this.alerts.length; k++) {
      const a = this.alerts[k]!;
      const t = this.now - a.t0;
      if (t > a.ttl) {
        a.sprite.destroy();
        a.tex.destroy(true);
        this.alerts.splice(k, 1);
        k--;
        continue;
      }
      a.targetY = y;
      a.y = a.y === 0 ? y : a.y + (a.targetY - a.y) * Math.min(1, dt * 12);
      const inP = ease.outCubic(prog(t, 0, 0.3));
      const outP = t > a.ttl - 0.3 ? ease.inCubic((t - (a.ttl - 0.3)) / 0.3) : 0;
      // Short slide + fade (a full off-screen slide read as a card clipped at the screen edge
      // whenever a frame caught it mid-way).
      a.sprite.position.set(
        Math.round(l.safe.left + 4 - 16 * (1 - inP) - 16 * outP),
        Math.round(a.y),
      );
      a.sprite.alpha = Math.max(0, Math.min(1, inP * (1 - outP)));
      y += a.tex.height + 3;
    }
    // Info toast: centred above the wave button area.
    if (this.info) {
      const t = this.now - this.info.t0;
      if (t > 1.8) {
        this.info.sprite.destroy();
        this.info.tex.destroy(true);
        this.info = null;
      } else {
        const s = this.info.sprite;
        s.position.set(
          Math.floor((l.W - s.texture.width) / 2),
          Math.round(l.deploy.y - 52 - Math.min(4, t * 30)),
        );
        s.alpha = t > 1.5 ? 1 - (t - 1.5) / 0.3 : 1;
      }
    }
  }

  /** Is a level-up dossier on screen (tutorial can wait for it). */
  get busy(): boolean {
    return !!this.current || this.queue.length > 0;
  }
}
