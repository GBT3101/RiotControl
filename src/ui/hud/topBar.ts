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

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    this.hate = new HateCounter(game.world.hate);
    const big = app.touch ? 'lg' : 'sm';
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
    makeInteractive(this.legit, {
      hover: (o) => app.tooltip.showFor(o ? this.legit : null, () => this.legitTip()),
      longPress: () => {
        app.tooltip.showFor(this.legit, () => this.legitTip(), 2.5);
        return true;
      },
      tap: () => app.tooltip.showFor(this.legit, () => this.legitTip(), 2.5),
    });
    makeInteractive(this.integ, {
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
      this.speed.setFaces(roundFaces(`speed${e.speed}` as 'speed1', big)),
    );
    game.bus.on('pauseChanged', (e) =>
      this.pause.setFaces(roundFaces(e.paused ? 'play' : 'pause', big)),
    );
    game.bus.on('capitolState', () => {
      this.shake = 0.5;
    });
    game.bus.on('capitolDamaged', () => {
      this.flashT = 0.3;
    });
  }

  refreshMute(): void {
    this.mute.setFaces(roundFaces(this.app.muted ? 'mute' : 'sound', this.app.touch ? 'lg' : 'sm'));
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
    const top = l.safe.top;
    const left = l.safe.left + 7;
    const right = l.W - l.safe.right - 6;
    const btns = [this.pause, this.speed, this.mute, this.settings];
    const bw = btns[0]!.w;
    const rowY = (r: number) => top + 1 + r * TOP_ROW_H;
    const cy = (r: number) => rowY(r) + Math.floor(TOP_ROW_H / 2);
    // Buttons: right end of the last row.
    const br = l.topRows - 1;
    btns.forEach((b, k) => {
      b.position.set(right - (btns.length - k) * (bw + 1), cy(br) - Math.floor(b.h / 2));
    });
    const btnLeft = right - btns.length * (bw + 1) - 4;
    // Hate.
    this.hateX = left;
    this.hateY = cy(0) - 6;
    this.hateIcon.position.set(left, cy(0) - 6);
    this.hateLabel.position.set(left + 16, cy(0) - 3);
    if (l.topRows === 1) {
      const avail = btnLeft - left - 54 - 62 - 52 - 16;
      this.legitW = Math.max(64, Math.min(110, Math.floor(avail * 0.55)));
      this.integW = Math.max(56, Math.min(96, avail - this.legitW));
      let x = left + 54;
      this.legit.position.set(x, cy(0) - 9);
      x += this.legitW + 6;
      this.integ.position.set(x, cy(0) - 8);
      x += this.integW + 8;
      this.waveIcon.position.set(x, cy(0) - 5);
      this.waveLabel.position.set(x + 16, cy(0) - 3);
      x += 72;
      this.crowdIcon.position.set(x, cy(0) - 7);
      this.crowdLabel.position.set(x + 17, cy(0) - 3);
    } else {
      const avail = right - left - 52;
      this.legitW = Math.max(60, Math.floor(avail * 0.52));
      this.integW = Math.max(52, avail - this.legitW - 6);
      this.legit.position.set(left + 52, cy(0) - 9);
      this.integ.position.set(left + 52 + this.legitW + 6, cy(0) - 8);
      this.waveIcon.position.set(left, cy(1) - 5);
      this.waveLabel.position.set(left + 16, cy(1) - 3);
      this.crowdIcon.position.set(left + 74, cy(1) - 7);
      this.crowdLabel.position.set(left + 91, cy(1) - 3);
    }
    this.integX = this.integ.x;
    this.integY = this.integ.y;
    this.legitKey = this.integKey = '';
  }

  update(dt: number, h: HudSnapshot): void {
    this.hate.update(dt, h.hate);
    const narrow = this.app.layout.topRows === 2;
    this.hateLabel.set(
      narrow ? compactNumber(this.hate.display) : formatNumber(this.hate.display),
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
    const status = waveStatus(h.phase, h.wave, h.breather);
    this.waveLabel.set(status, h.phase === 'breather' && h.breather <= 5 ? 'hivis2' : 'stone5');
    this.crowdLabel.set(
      narrow ? compactNumber(h.crowd + h.pending) : formatNumber(h.crowd + h.pending),
    );
  }

  destroy(): void {
    destroyOwned(this.root);
  }
}
