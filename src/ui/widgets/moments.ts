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
import { CARD_H, CARD_W, deployCard } from '../../art/uikit/cards';
import { ICONS } from '../../art/uikit/icons';
import { PAPERCLIP, folderTab, panel } from '../../art/uikit/panels';
import { bretaPortrait } from '../../art/uikit/portraits';
import { FONTS, drawText, measureText, textSprite } from '../../art/uikit/text';
import { LEVELS } from '../../data/levels';
import { protesterDef, type ProtesterId } from '../../data/protesters';
import { UNITS, type UnitId } from '../../data/units';
import { HOTKEYS } from '../../game/controller';
import { protesterFigure, scaleUp, unitCardFigure } from '../art';
import { ease, prog, stampDrop } from '../core/anim';
import { capBlockH, clearSpot, textBelow, textBox, type Box, type TextBox } from '../core/boxes';
import { makeInteractive } from '../core/node';
import { ownTex, uiTex, destroyOwned } from '../core/tex';
import { CAPITOL_COPY, PROTESTER_COPY, UI_TEXT, UNIT_COPY, waveLine } from '../strings';
import type { UiApp } from '../app';
import type { HudLayout } from '../layout';

/* ── Pixel compositions ───────────────────────────────────────────────────────────── */

const DOSSIER_TEXT_W = 112;
const NOTES_GAP = -1;
/** Folder tab height above the dossier panel (buffer y of the panel's top edge). */
const DOSSIER_TAB = 10;

/** The two rubber stamps that slam onto the unlock dossier. */
export function approvedStamp(): PixelBuffer {
  return rubberStamp('APPROVED', 'green2', { tilt: -0.1 });
}

export function levelStamp(level: number): PixelBuffer {
  return rubberStamp(`LEVEL ${level}`, 'crim1', { font: FONTS.smallBold, tilt: 0.08, seed: 3 });
}

export interface UnlockDossierLayout {
  /** Stamps in a column right of the paper (wide screens) or in a strip under it (narrow). */
  wide: boolean;
  /** Buffer size (the panel starts DOSSIER_TAB px down, under the folder tab). */
  w: number;
  h: number;
  card: Box;
  paper: Box;
  clip: Box;
  title: TextBox;
  notes: TextBox;
  footnote: TextBox;
  approved: Box;
  level: Box;
}

/**
 * Unlock dossier geometry in buffer px. The paper's text flows top-down (a long name that wraps,
 * MOUNTED RIOT POLICE, pushes the notes and the footnote down; the paper grows to fit), and the
 * APPROVED / LEVEL n stamps get boxes of their own, clear of the card, the paper text and the
 * paper clip: a column right of the paper when `wide`, else a strip under the card and paper.
 */
export function unlockDossierLayout(unit: UnitId, level = 10, wide = false): UnlockDossierLayout {
  const copy = UNIT_COPY[unit];
  const oy = DOSSIER_TAB;
  const card: Box = { x: 10, y: oy + 12, w: CARD_W, h: CARD_H };
  const paper: Box = { x: 54, y: oy + 7, w: 128, h: 0 };
  const tx = paper.x + 11;
  const W = DOSSIER_TEXT_W;
  // Designed spacing (cap lines), nudged down only if ink would touch the block above.
  const title = textBox(FONTS.smallBold, UNITS[unit].name.toUpperCase(), tx, paper.y + 5, W);
  const titleH = capBlockH(FONTS.smallBold, UNITS[unit].name.toUpperCase(), W);
  const notesCap = Math.max(paper.y + 17, title.capY + titleH + 5);
  const notes = textBelow(
    FONTS.mono,
    copy.notes,
    tx,
    notesCap,
    title.y + title.h + 1,
    W,
    NOTES_GAP,
  );
  const notesH = capBlockH(FONTS.mono, copy.notes, W, NOTES_GAP);
  const footCap = Math.max(paper.y + 46, notes.capY + notesH + 5);
  const footnote = textBelow(FONTS.small, copy.footnote, tx, footCap, notes.y + notes.h + 1, W);
  const footH = capBlockH(FONTS.small, copy.footnote, W);
  paper.h = Math.max(
    58,
    footnote.capY + footH + 5 - paper.y,
    footnote.y + footnote.h + 3 - paper.y,
  );
  const a = approvedStamp();
  const l = levelStamp(level);
  let w: number;
  let approved: Box;
  let lvl: Box;
  let bottom: number;
  if (wide) {
    // Column right of the paper: APPROVED under the paper clip, LEVEL n below it.
    const colX = paper.x + paper.w + 6;
    const colW = Math.max(a.w, l.w);
    w = colX + colW + 8;
    approved = { x: colX + Math.floor((colW - a.w) / 2), y: oy + 10, w: a.w, h: a.h };
    lvl = { x: colX + Math.floor((colW - l.w) / 2), y: approved.y + a.h + 1, w: l.w, h: l.h };
    bottom = Math.max(paper.y + paper.h, card.y + card.h, lvl.y + lvl.h);
  } else {
    // Strip under the card and the paper: LEVEL n left, APPROVED right.
    w = 190;
    const y = Math.max(paper.y + paper.h, card.y + card.h) + 3;
    lvl = { x: 6, y: y + Math.floor((a.h - l.h) / 2), w: l.w, h: l.h };
    approved = { x: w - a.w - 6, y, w: a.w, h: a.h };
    bottom = Math.max(lvl.y + lvl.h, approved.y + approved.h);
  }
  const clip: Box = { x: w - 22, y: oy - 4, w: PAPERCLIP.w, h: PAPERCLIP.h };
  return {
    wide,
    w,
    h: bottom + 5,
    card,
    paper,
    clip,
    title,
    notes,
    footnote,
    approved,
    level: lvl,
  };
}

/** Unlock dossier (manila folder + tab): the base (without stamps) and the two stamp layers. */
export function unlockDossier(
  unit: UnitId,
  level: number,
  wide = false,
): {
  base: PixelBuffer;
  approved: PixelBuffer;
  levelStamp: PixelBuffer;
  layout: UnlockDossierLayout;
} {
  const lay = unlockDossierLayout(unit, level, wide);
  const b = buf(lay.w, lay.h);
  const oy = DOSSIER_TAB;
  stamp(b, panel('manila', lay.w, lay.h - oy), 0, oy);
  stamp(b, folderTab(46), 8, oy - 8);
  rect(b, 9, oy - 1, 44, 2, 'stone4');
  drawText(b, FONTS.small, `FILE ${String(level).padStart(2, '0')}`, 14, oy - 7, 'earth2');
  stamp(b, panel('paper', lay.paper.w, lay.paper.h), lay.paper.x, lay.paper.y);
  const card = deployCard({
    figure: unitCardFigure(unit, 'card'),
    cost: UNITS[unit].cost,
    hotkey: HOTKEYS[unit],
    state: 'ready',
  });
  stamp(b, card, lay.card.x, lay.card.y);
  stamp(b, PAPERCLIP, lay.clip.x, lay.clip.y);
  const copy = UNIT_COPY[unit];
  drawText(b, FONTS.smallBold, UNITS[unit].name.toUpperCase(), lay.title.x, lay.title.capY, 'ink', {
    maxWidth: DOSSIER_TEXT_W,
  });
  drawText(b, FONTS.mono, copy.notes, lay.notes.x, lay.notes.capY, 'gray1', {
    lineGap: NOTES_GAP,
    maxWidth: DOSSIER_TEXT_W,
  });
  drawText(b, FONTS.small, copy.footnote, lay.footnote.x, lay.footnote.capY, 'stone1', {
    maxWidth: DOSSIER_TEXT_W,
  });
  return { base: b, approved: approvedStamp(), levelStamp: levelStamp(level), layout: lay };
}

/**
 * Resting boxes of the level-up ribbon and the dossier under it (UI px). The pair sits under the
 * top bar and above the deploy bar; when that gap is too short (phone landscape) the pair moves
 * up over the top bar first, and the dossier only then reaches over the deploy bar — it never
 * slides up over the ribbon's text.
 */
export function levelUpPlacement(
  l: Pick<HudLayout, 'W' | 'bannerY' | 'safe'> & { deploy: { y: number } },
  rib: { width: number; height: number },
  dos: { width: number; height: number },
): { ribbon: Box; dossier: Box } {
  const gap = 2;
  const groupH = rib.height + gap + dos.height;
  const floor = l.deploy.y - gap;
  const top = Math.max(l.safe.top + 2, Math.min(l.bannerY, floor - groupH));
  const ribbon = {
    x: Math.floor((l.W - rib.width) / 2),
    y: top,
    w: rib.width,
    h: rib.height,
  };
  const dossier = {
    x: Math.floor((l.W - dos.width) / 2),
    y: top + rib.height + gap,
    w: dos.width,
    h: dos.height,
  };
  return { ribbon, dossier };
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

/** Bottom (UI px) of the wave banner + its sub-line at rest (see updateStage). */
function waveStageBottom(l: HudLayout, st: Stage): number {
  const b = st.parts.banner?.texture.height ?? 0;
  const sub = st.parts.sub?.texture.height ?? 0;
  return l.bannerY + 4 + b + 2 + sub;
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
  /** Resting centre y of each stamp sprite (level-up). */
  stampY?: Record<string, number>;
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
  private info: { sprite: Sprite; tex: Texture; t0: number; at?: Box } | null = null;

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
    const l = this.app.layout;
    const narrow = l.W < 310;
    const rib = ribbon(UI_TEXT.levelUp, narrow ? FONTS.smallBold : FONTS.large, l.W - 4);
    // Stamps beside the paper when the screen is wide enough, else under it.
    const wideW = unlockDossierLayout(unit, level, true).w;
    const d = unlockDossier(unit, level, l.W - l.safe.left - l.safe.right >= wideW + 8);
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
    // Each stamp lands in its own reserved box (unlockDossierLayout): never on the text.
    const centre = (s: Sprite, b: Box): void =>
      void s.position.set(b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2));
    centre(approved, d.layout.approved);
    centre(lvl, d.layout.level);
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
      stampY: {
        approved: d.layout.approved.y + Math.floor(d.layout.approved.h / 2),
        lvl: d.layout.level.y + Math.floor(d.layout.level.h / 2),
      },
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
    const at = levelUpPlacement(l, rib.texture, dosS.texture);
    const rp = prog(t, 0, 0.45);
    rib.position.set(
      at.ribbon.x,
      Math.round(at.ribbon.y - 40 * (1 - ease.outBounce(rp))) - Math.round(out * 60),
    );
    const dp = prog(t, 0.25, 0.4);
    dos.position.set(
      at.dossier.x,
      Math.round(at.dossier.y - 30 * (1 - ease.outBack(dp))) + Math.round(out * 20),
    );
    dos.alpha = dp <= 0 ? 0 : 1 - out;
    rib.alpha = 1 - out;
    const a = st.parts.approved!;
    const lv = st.parts.lvl!;
    const ta = t - 0.85;
    if (ta >= 0) {
      if (!a.visible) this.app.sfx('stamp');
      a.visible = true;
      a.y = (st.stampY?.approved ?? 0) + stampDrop(ta / 0.2);
    }
    const tl = t - 1.25;
    if (tl >= 0) {
      if (!lv.visible) this.app.sfx('stamp');
      lv.visible = true;
      lv.y = (st.stampY?.lvl ?? 0) + stampDrop(tl / 0.2);
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
    // Wrapped (centred) to the screen: long unit names would run off a phone.
    const maxW = Math.min(240, this.app.layout.W - 24);
    const m = measureText(FONTS.smallBold, text, maxW);
    const b = buf(m.w + 14, m.h + 10);
    stamp(b, panel('tooltip', b.w, b.h), 0, 0);
    drawText(b, FONTS.smallBold, text, 7 + Math.floor(m.w / 2), 5, 'crim1', {
      maxWidth: maxW,
      align: 'center',
    });
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
    // Alerts: slide/fade in from the left, stack downward under the top bar — and never over
    // a centre-stage moment: they wait (hidden, timers held) while a level-up dossier is up and
    // stack under the wave banner while it shows.
    const cur = this.current;
    const held = cur?.kind === 'levelup';
    if (held) for (const a of this.alerts) a.t0 += dt;
    this.alertLayer.visible = !held;
    let y = Math.max(l.topBar.h + 4, cur?.kind === 'wave' ? waveStageBottom(l, cur) + 3 : 0);
    // …and stop above the advisor, the unit panel, the wave button and the deploy bar: an
    // alert that does not fit stays hidden (the stack is newest-first, so the oldest go).
    const floor = this.alertFloor(l);
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
      a.sprite.visible = y + a.tex.height <= floor;
      if (a.sprite.visible) y += a.tex.height + 3;
      // Held back for lack of room: its time on screen starts when it gets some.
      else a.t0 = Math.min(this.now, a.t0 + dt);
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
        // Spot chosen when it appears (it then only rises 4 px): clear of the wave button and
        // its countdown, the advisor, the alerts and the unit panel.
        if (!this.info.at) {
          const tw = s.texture.width;
          const th = s.texture.height;
          const avoid = this.toastAvoid();
          const area = { x: 0, y: l.topBar.h + 2, w: l.W, h: l.deploy.y - l.topBar.h - 4 };
          const cy = l.deploy.y - 52 + Math.floor(th / 2);
          this.info.at = clearSpot(tw, th + 4, Math.floor(l.W / 2), cy, avoid, area);
        }
        s.position.set(this.info.at.x, Math.round(this.info.at.y + 4 - Math.min(4, t * 30)));
        s.alpha = t > 1.5 ? 1 - (t - 1.5) / 0.3 : 1;
      }
    }
  }

  /** Lowest y (UI px) of the alert stack: above everything bottom-anchored under it. */
  private alertFloor(l: HudLayout): number {
    const x0 = l.safe.left + 4;
    const x1 = x0 + Math.min(200, l.W - 12);
    const under: Box[] = [{ ...l.deploy }];
    const adv = this.app.advisor.extent();
    if (adv) under.push(adv);
    const hud = this.app.hud;
    if (hud?.info.root.visible) under.push(hud.info.rect());
    const wb = hud?.wave.rect();
    // The wave button and its countdown line above it.
    if (wb) under.push({ x: wb.x, y: wb.y - 12, w: wb.w, h: wb.h + 12 });
    let floor = l.H;
    for (const r of under) if (r.x < x1 && r.x + r.w > x0) floor = Math.min(floor, r.y - 3);
    return floor;
  }

  /** What an info toast keeps clear of. */
  private toastAvoid(): Box[] {
    const out: Box[] = [...this.alertRects()];
    const adv = this.app.advisor.extent();
    if (adv) out.push(adv);
    const hud = this.app.hud;
    if (hud?.info.root.visible) out.push(hud.info.rect());
    const wb = hud?.wave.rect();
    if (wb) out.push({ x: wb.x - 30, y: wb.y - 12, w: wb.w + 60, h: wb.h + 12 });
    const st = this.stageRect();
    if (st) out.push(st);
    return out;
  }

  /** Resting rects (UI px) of the alerts on screen, for HUD pieces that keep clear of them. */
  alertRects(): Box[] {
    if (!this.alertLayer.visible) return [];
    return this.alerts
      .filter((a) => a.sprite.visible && a.sprite.alpha > 0.05)
      .map((a) => ({
        x: this.app.layout.safe.left + 4,
        y: Math.round(a.targetY),
        w: a.tex.width,
        h: a.tex.height,
      }));
  }

  /** Rect (UI px) of the centre-stage moment (wave banner + line, or ribbon + dossier). */
  stageRect(): Box | null {
    const st = this.current;
    if (!st) return null;
    const l = this.app.layout;
    if (st.kind === 'wave') {
      const w = Math.max(st.parts.banner?.texture.width ?? 0, st.parts.sub?.texture.width ?? 0);
      const y = l.bannerY + 4;
      return { x: Math.floor((l.W - w) / 2), y, w, h: waveStageBottom(l, st) - y };
    }
    const rib = st.parts.ribbon!.texture;
    const dos = st.parts.dossier!.texture;
    const at = levelUpPlacement(l, rib, dos);
    const x = Math.min(at.ribbon.x, at.dossier.x);
    return {
      x,
      y: at.ribbon.y,
      w: Math.max(at.ribbon.x + at.ribbon.w, at.dossier.x + at.dossier.w) - x,
      h: at.dossier.y + at.dossier.h - at.ribbon.y,
    };
  }

  /** Is a level-up dossier on screen (tutorial can wait for it). */
  get busy(): boolean {
    return !!this.current || this.queue.length > 0;
  }
}
