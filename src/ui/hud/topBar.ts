/**
 * Top bar (leather strip): Hate counter (counts up when the "+N" fists arrive), Legitimacy seal
 * meter (level + progress to the next threshold), Capitol integrity bar (cracks), wave counter /
 * breather countdown, crowd count, and the pause / speed / mute / settings toggles.
 * One row on wide screens, two rows on narrow ones (portrait phones, tablets).
 */
import { Container, Sprite } from 'pixi.js';
import { integrityMeter, legitMeter } from '../../art/uikit/cards';
import { ICONS } from '../../art/uikit/icons';
import { panel } from '../../art/uikit/panels';
import { FONTS, measureText } from '../../art/uikit/text';
import { LEVELS, WIN_LEGITIMACY } from '../../data/levels';
import { UNITS } from '../../data/units';
import type { GameController, HudSnapshot } from '../../game/controller';
import { formatNumber } from '../records';
import { Button, roundFaces } from '../core/button';
import { Label } from '../core/label';
import { makeInteractive } from '../core/node';
import { swapOwned, uiTex, destroyOwned } from '../core/tex';
import { HateCounter, compactNumber, levelProgress, waveStatus } from '../model';
import { TOP_ROW_H, type HudLayout } from '../layout';
import type { UiApp } from '../app';

const LABEL_OPTS = { shadow: 'ink' } as const;

interface Slot {
  x: number;
  y: number;
}

/** Label slot: position and the widest text that fits before the next piece. */
interface LabelSlot extends Slot {
  maxW: number;
}

export interface TopBarLayout {
  hateIcon: Slot;
  hate: LabelSlot;
  legit: Slot & { w: number };
  integ: Slot & { w: number };
  waveIcon: Slot;
  wave: LabelSlot;
  crowdIcon: Slot;
  crowd: LabelSlot;
  buttons: Slot[];
}

/** Widest wave status the slot must hold ("NEXT 24s", "WAVE 100"). */
const WAVE_LABEL_W = 56;
/** Narrowest crowd slot ("9999", "12.3k"). */
const CROWD_MIN_W = 29;
/** Room kept for the crowd count ("12,345"; longer counts turn compact: "12.3k"). */
const CROWD_LABEL_W = 40;

/**
 * Top bar slots (UI px), left to right: Hate, Legitimacy seal + bar, integrity bar, wave status,
 * crowd count, then the four round buttons at the right end of the last row. Each label slot
 * says how wide its text may get before it would touch the next piece; the meters take what
 * is left. Pure (unit-tested at phone and desktop widths).
 */
export function topBarLayout(l: HudLayout, bw: number, bh: number): TopBarLayout {
  const top = l.safe.top;
  const left = l.safe.left + 7;
  const right = l.W - l.safe.right - 6;
  const rowY = (r: number): number => top + 1 + r * TOP_ROW_H;
  const cy = (r: number): number => rowY(r) + Math.floor(TOP_ROW_H / 2);
  const br = l.topRows - 1;
  const buttons = [0, 1, 2, 3].map((k) => ({
    x: right - (4 - k) * (bw + 1),
    y: cy(br) - Math.floor(bh / 2),
  }));
  const btnLeft = right - 4 * (bw + 1) - 4;
  const hateIcon = { x: left, y: cy(0) - 6 };
  const label = (x: number, r: number, end: number): LabelSlot => ({
    x,
    y: cy(r) - 3,
    maxW: end - x - 2,
  });
  if (l.topRows === 1) {
    const fixed = 54 + 6 + 8 + 16 + WAVE_LABEL_W + 17 + CROWD_LABEL_W;
    const avail = btnLeft - left - fixed;
    const legitW = Math.max(64, Math.min(110, Math.floor(avail * 0.55)));
    const integW = Math.max(56, Math.min(96, avail - legitW));
    const legit = { x: left + 54, y: cy(0) - 9, w: legitW };
    const integ = { x: legit.x + legitW + 6, y: cy(0) - 8, w: integW };
    const wx = integ.x + integW + 8;
    const cx = wx + 16 + WAVE_LABEL_W;
    return {
      hateIcon,
      hate: label(left + 16, 0, legit.x),
      legit,
      integ,
      waveIcon: { x: wx, y: cy(0) - 5 },
      wave: label(wx + 16, 0, cx),
      crowdIcon: { x: cx, y: cy(0) - 7 },
      crowd: label(cx + 17, 0, btnLeft),
      buttons,
    };
  }
  const avail = right - left - 52;
  const legitW = Math.max(60, Math.floor(avail * 0.52));
  const integW = Math.max(52, avail - legitW - 6);
  // Row 2 shares its left part between the wave status and the crowd count; on the narrowest
  // phones (360 CSS px) the wave status gets less room and switches to its short form.
  const room = btnLeft - (left + 16) - 2 - 17 - CROWD_MIN_W - 2;
  const cx = left + 16 + Math.max(0, Math.min(WAVE_LABEL_W, room)) + 2;
  return {
    hateIcon,
    hate: label(left + 16, 0, left + 52),
    legit: { x: left + 52, y: cy(0) - 9, w: legitW },
    integ: { x: left + 52 + legitW + 6, y: cy(0) - 8, w: integW },
    waveIcon: { x: left, y: cy(1) - 5 },
    wave: label(left + 16, 1, cx),
    crowdIcon: { x: cx, y: cy(1) - 7 },
    crowd: label(cx + 17, 1, btnLeft),
    buttons,
  };
}

/**
 * Round button size: large on touch screens, small on desktop and on the narrowest touch
 * layouts (Large UI on a 390-px phone) so row 2 keeps room for the wave and crowd counters —
 * the buttons' hit padding keeps them ≥ 44 CSS px either way.
 */
export function topBarButtonSize(l: Pick<HudLayout, 'W'>, touch: boolean): 'lg' | 'sm' {
  return touch && l.W >= 205 ? 'lg' : 'sm';
}

/** Short wave status for the narrowest top bars: "PREP", "24s", "W40". */
export function shortWaveStatus(phase: string, wave: number, breather: number): string {
  if (phase === 'prep') return 'PREP';
  if (phase === 'breather') return `${Math.ceil(breather)}s`;
  return `W${wave}`;
}

/** A count for a label slot: "12,345" when it fits (wide bar), else "12.3k" / "9999". */
export function fitCount(n: number, maxW: number, compact = false): string {
  const full = formatNumber(n);
  return !compact && measureText(FONTS.smallBold, full).w <= maxW ? full : compactNumber(n);
}

export class TopBar {
  readonly root = new Container({ label: 'topbar' });
  private readonly bg = new Sprite();
  private readonly hateIcon = new Sprite(uiTex('icon:hate', ICONS.hate));
  private readonly hateLabel = new Label('smallBold', 'stone5', LABEL_OPTS);
  private readonly legit = new Sprite();
  private readonly integ = new Sprite();
  private readonly waveIcon = new Sprite(uiTex('icon:wave', ICONS.wave));
  private readonly waveLabel = new Label('smallBold', 'stone5', LABEL_OPTS);
  private readonly crowdIcon = new Sprite(uiTex('icon:crowd', ICONS.crowd));
  private readonly crowdLabel = new Label('smallBold', 'stone5', LABEL_OPTS);
  readonly pause: Button;
  readonly speed: Button;
  readonly mute: Button;
  readonly settings: Button;
  readonly hate: HateCounter;
  private legitKey = '';
  private integKey = '';
  private legitW = 88;
  private integW = 80;
  private shake = 0;
  private integX = 0;
  private integY = 0;
  private hateX = 0;
  private hateY = 0;
  private flashT = 0;
  /** Tooltip text provider for the meters (desktop hover). */
  private layoutKey = '';
  private slots: TopBarLayout | null = null;
  private btnSize: 'lg' | 'sm' = 'sm';

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    this.hate = new HateCounter(game.world.hate);
    const big = topBarButtonSize(app.layout, app.touch);
    this.btnSize = big;
    this.pause = new Button(roundFaces('pause', big), {
      onTap: () => app.pauseButton(),
      pad: 3,
    });
    this.speed = new Button(roundFaces(`speed${game.speed}` as 'speed1', big), {
      onTap: () => game.cycleSpeed(),
      pad: 3,
    });
    this.mute = new Button(roundFaces(app.muted ? 'mute' : 'sound', big), {
      onTap: () => app.toggleMute(),
      pad: 3,
    });
    this.settings = new Button(roundFaces('settings', big), {
      onTap: () => app.openSettings(true),
      pad: 3,
    });
    makeInteractive(this.bg, { blockOnly: true });
    // Touch: grow the meters' hit areas vertically to ≥ 44 CSS px (they are ~18 UI px tall).
    const padY = app.touch ? 6 : 1;
    const meterHit = (sp: Sprite) => () => ({
      x: -2,
      y: -padY,
      w: sp.texture.width + 4,
      h: sp.texture.height + padY * 2,
    });
    makeInteractive(this.legit, {
      hit: meterHit(this.legit),
      hover: (o) => app.tooltip.showFor(o ? this.legit : null, () => this.legitTip()),
      longPress: () => {
        app.tooltip.showFor(this.legit, () => this.legitTip(), 2.5);
        return true;
      },
      tap: () => app.tooltip.showFor(this.legit, () => this.legitTip(), 2.5),
    });
    makeInteractive(this.integ, {
      hit: meterHit(this.integ),
      hover: (o) => app.tooltip.showFor(o ? this.integ : null, () => this.integTip()),
      tap: () => {
        const c = game.world.map.capitol;
        game.focusTile(c.i + (c.w >> 1), c.j + c.d + 2);
      },
    });
    this.root.addChild(
      this.bg,
      this.hateIcon,
      this.hateLabel,
      this.legit,
      this.integ,
      this.waveIcon,
      this.waveLabel,
      this.crowdIcon,
      this.crowdLabel,
      this.pause,
      this.speed,
      this.mute,
      this.settings,
    );
    game.bus.on('hatePickupArrived', (e) => this.hate.arrive(e.amount));
    game.bus.on('hateSpent', (e) => this.hate.spend(e.amount));
    game.bus.on('speedChanged', (e) =>
      this.speed.setFaces(roundFaces(`speed${e.speed}` as 'speed1', this.btnSize)),
    );
    game.bus.on('pauseChanged', (e) =>
      this.pause.setFaces(roundFaces(e.paused ? 'play' : 'pause', this.btnSize)),
    );
    game.bus.on('capitolState', () => {
      if (this.app.settings.shake) this.shake = 0.5; // reduced motion: no HUD shake
    });
    game.bus.on('capitolDamaged', () => {
      this.flashT = 0.3;
    });
  }

  refreshMute(): void {
    this.mute.setFaces(roundFaces(this.app.muted ? 'mute' : 'sound', this.btnSize));
  }

  private legitTip(): string {
    const w = this.game.world;
    const next = LEVELS[w.level + 1];
    return next
      ? `LEGITIMACY ${formatNumber(w.legit)} / ${formatNumber(next.legit)}\nLevel ${w.level}. Next: ${UNITS[next.unit].name}.\nEvery fallen officer adds Legitimacy.`
      : `LEGITIMACY ${formatNumber(w.legit)} / ${formatNumber(WIN_LEGITIMACY)}\nMaximum level. ${formatNumber(WIN_LEGITIMACY)} restores order.`;
  }

  private integTip(): string {
    const c = this.game.world.capitol;
    return `CAPITOL INTEGRITY ${Math.ceil(c.integrity * 100)}%\nAt 0% the regime falls. Tap to look.`;
  }

  /** Screen point (UI px) of the Hate counter — fists fly here. */
  get hateTarget(): { x: number; y: number } {
    return { x: this.hateX + 6, y: this.hateY + 6 };
  }

  /** UI rects for tutorial pointers (M10): Hate counter, Legitimacy seal + bar, integrity. */
  hateRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.hateX - 2, y: this.hateY - 3, w: 18 + this.hateLabel.textWidth, h: 18 };
  }

  legitRect(): { x: number; y: number; w: number; h: number } {
    const t = this.legit.texture;
    return { x: this.legit.x - 1, y: this.legit.y - 1, w: t.width + 2, h: t.height + 2 };
  }

  integRect(): { x: number; y: number; w: number; h: number } {
    const t = this.integ.texture;
    return { x: this.integX - 1, y: this.integY - 1, w: t.width + 2, h: t.height + 2 };
  }

  layout(l: HudLayout): void {
    const key = `${l.W}x${l.H}:${l.topRows}:${l.safe.top}:${l.safe.left}:${l.safe.right}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    swapOwned(this.bg, panel('leather', l.W, l.topBar.h), 'ui:topbar');
    const size = topBarButtonSize(l, this.app.touch);
    if (size !== this.btnSize) {
      this.btnSize = size;
      this.pause.setFaces(roundFaces(this.game.paused ? 'play' : 'pause', size));
      this.speed.setFaces(roundFaces(`speed${this.game.speed}` as 'speed1', size));
      this.settings.setFaces(roundFaces('settings', size));
      this.refreshMute();
    }
    const btns = [this.pause, this.speed, this.mute, this.settings];
    const s = topBarLayout(l, btns[0]!.w, btns[0]!.h);
    btns.forEach((b, k) => b.position.set(s.buttons[k]!.x, s.buttons[k]!.y));
    this.hateX = s.hateIcon.x;
    this.hateY = s.hateIcon.y;
    this.hateIcon.position.set(s.hateIcon.x, s.hateIcon.y);
    this.hateLabel.position.set(s.hate.x, s.hate.y);
    this.legitW = s.legit.w;
    this.integW = s.integ.w;
    this.legit.position.set(s.legit.x, s.legit.y);
    this.integ.position.set(s.integ.x, s.integ.y);
    this.waveIcon.position.set(s.waveIcon.x, s.waveIcon.y);
    this.waveLabel.position.set(s.wave.x, s.wave.y);
    this.crowdIcon.position.set(s.crowdIcon.x, s.crowdIcon.y);
    this.crowdLabel.position.set(s.crowd.x, s.crowd.y);
    this.slots = s;
    this.integX = this.integ.x;
    this.integY = this.integ.y;
    this.legitKey = this.integKey = '';
  }

  update(dt: number, h: HudSnapshot): void {
    this.hate.update(dt, h.hate);
    const narrow = this.app.layout.topRows === 2;
    const sl = this.slots;
    this.hateLabel.set(
      fitCount(this.hate.display, sl?.hate.maxW ?? 36, narrow),
      this.hate.bump > 0 ? 'hivis2' : 'stone5',
    );
    this.hateIcon.y = this.hateY - (this.hate.bump > 0.15 ? 1 : 0);
    const prog = levelProgress(h.legit, h.level);
    const lk = `${h.level}:${Math.round(prog * this.legitW)}:${this.legitW}`;
    if (lk !== this.legitKey) {
      this.legitKey = lk;
      swapOwned(this.legit, legitMeter(prog, h.level, this.legitW), 'ui:legit');
    }
    const ik = `${Math.round(h.integrity * this.integW)}:${this.integW}`;
    if (ik !== this.integKey) {
      this.integKey = ik;
      swapOwned(this.integ, integrityMeter(h.integrity, this.integW), 'ui:integ');
    }
    // Shake the integrity meter on damage-state changes; tint flash on hits.
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.integ.x =
        this.integX + (this.shake > 0 ? (Math.floor(this.shake * 30) % 2 ? 1 : -1) : 0);
    } else this.integ.x = this.integX;
    this.integ.y = this.integY;
    this.flashT = Math.max(0, this.flashT - dt);
    this.integ.tint = this.flashT > 0 && Math.floor(this.flashT * 20) % 2 ? 0xffb0a0 : 0xffffff;
    let status = waveStatus(h.phase, h.wave, h.breather);
    if (sl && measureText(FONTS.smallBold, status).w > sl.wave.maxW)
      status = shortWaveStatus(h.phase, h.wave, h.breather);
    this.waveLabel.set(status, h.phase === 'breather' && h.breather <= 5 ? 'hivis2' : 'stone5');
    this.crowdLabel.set(fitCount(h.crowd + h.pending, sl?.crowd.maxW ?? 32, narrow));
  }

  destroy(): void {
    destroyOwned(this.root);
  }
}
