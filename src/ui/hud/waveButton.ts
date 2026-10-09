/**
 * The big red "LET THEM COME" push-button in the prep phase and the "CALL EARLY +N" stamp
 * button (with a breather countdown) between waves. Hidden while a wave is running.
 */
import { Container, Sprite } from 'pixi.js';
import { BALANCE } from '../../data/balance';
import type { GameController, HudSnapshot } from '../../game/controller';
import { Button, redFaces, stampFaces } from '../core/button';
import { Label } from '../core/label';
import { callEarlyBonus } from '../model';
import { UI_TEXT } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';

export class WaveButton {
  readonly root = new Container({ label: 'wavebutton' });
  readonly red: Button;
  readonly early: Button;
  private readonly glow = new Sprite();
  private readonly timer = new Label('smallBold', 'stone5', { outline: 'ink' });
  private earlyLabel = '';
  private t = 0;
  private cx = 0;
  private bottom = 0;

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    const minW = app.layout.W < 300 ? 0 : 150;
    this.red = new Button(redFaces(UI_TEXT.letThemCome, minW), {
      onTap: () => this.go(),
      pad: 2,
    });
    this.early = new Button(stampFaces(UI_TEXT.callEarly(0)), {
      onTap: () => this.go(),
      pad: 4,
    });
    this.timer.anchor.set(0.5, 0);
    this.root.addChild(this.glow, this.red, this.early, this.timer);
  }

  private go(): void {
    this.game.startWaves();
  }

  layout(l: HudLayout): void {
    this.cx = l.waveButton.cx;
    this.bottom = l.waveButton.bottom;
  }

  /** UI rect of the visible button (tutorial pointers). */
  rect(): { x: number; y: number; w: number; h: number } | null {
    const b = this.red.visible ? this.red : this.early.visible ? this.early : null;
    return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null;
  }

  update(dt: number, h: HudSnapshot): void {
    this.t += dt;
    const over = h.outcome !== 'playing' || this.game.attract;
    const prep = h.phase === 'prep' && !over;
    const breather = h.phase === 'breather' && !over;
    this.red.visible = prep;
    this.early.visible = breather;
    this.timer.visible = breather;
    if (prep) {
      // Gentle 1-px bob so it reads as "press me".
      const bob = Math.floor(this.t * 2.2) % 2;
      this.red.position.set(this.cx - Math.floor(this.red.w / 2), this.bottom - this.red.h - bob);
    }
    if (breather) {
      const n = callEarlyBonus(h.breather, BALANCE.waves.callEarlyFactor);
      const label = UI_TEXT.callEarly(n);
      if (label !== this.earlyLabel) {
        this.earlyLabel = label;
        this.early.setFaces(stampFaces(label, 96));
      }
      this.early.position.set(this.cx - Math.floor(this.early.w / 2), this.bottom - this.early.h);
      this.timer.set(
        `NEXT WAVE IN ${Math.ceil(h.breather)}s`,
        h.breather <= 5 ? 'hivis2' : 'stone5',
      );
      this.timer.position.set(this.cx, this.early.y - 10);
    }
    void this.app;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
