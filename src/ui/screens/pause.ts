/**
 * Pause menu: the world freezes under a dim layer; a manila dossier with RESUME / SETTINGS /
 * RESTART / QUIT TO TITLE and a typed summary of the run so far.
 */
import { Container, Sprite } from 'pixi.js';
import { rubberStamp } from '../../art/uikit/banners';
import { FONTS, drawText } from '../../art/uikit/text';
import type { GameController } from '../../game/controller';
import { Button, stampFaces } from '../core/button';
import { makeInteractive } from '../core/node';
import { ownTex, destroyOwned } from '../core/tex';
import { formatDuration, formatNumber } from '../records';
import { CITY_COPY } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';
import { dossier } from './common';
import { backdrop, fitBackdrop, type Screen } from './screen';

export class PauseScreen implements Screen {
  readonly root = new Container({ label: 'pause' });
  readonly modal = true;
  private readonly dim = backdrop(0.55);
  private readonly panel = new Sprite();
  private readonly buttons: Button[];

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    const W = 120;
    const mk = (label: string, fn: () => void): Button =>
      new Button(stampFaces(label, W), { onTap: fn, pad: 2 });
    this.buttons = [
      mk('RESUME', () => app.closePause()),
      mk('SETTINGS', () => app.openSettings(false)),
      mk('RESTART', () => void app.restart()),
      mk('QUIT TO TITLE', () => void app.quitToTitle()),
    ];
    makeInteractive(this.panel, { blockOnly: true });
    this.root.addChild(this.dim, this.panel, ...this.buttons);
  }

  layout(l: HudLayout): void {
    fitBackdrop(this.dim, l);
    const w = 160;
    const bh = this.buttons[0]!.h + 4;
    const h = 58 + this.buttons.length * bh + 6;
    const b = dossier(w, h, `FILE: ${CITY_COPY[this.game.world.map.city].name.toUpperCase()}`);
    const st = rubberStamp('PAUSED', 'navy2', { tilt: -0.05, seed: 2 });
    const s = this.game.hud();
    drawText(b, FONTS.mono, `WAVE ${s.wave} · LEVEL ${s.level}`, 12, 38, 'gray1');
    drawText(
      b,
      FONTS.mono,
      `${formatNumber(s.legit)} LEGIT · ${formatDuration(this.game.world.time)}`,
      12,
      48,
      'gray1',
    );
    for (let y = 0; y < st.h; y++)
      for (let x = 0; x < st.w; x++) {
        const i = (y * st.w + x) * 4;
        if (st.data[i + 3] !== 255) continue;
        const tx = Math.floor((w - st.w) / 2) + x;
        const ty = 15 + y;
        if (tx < 0 || ty < 0 || tx >= b.w || ty >= b.h) continue;
        b.data.set(st.data.subarray(i, i + 4), (ty * b.w + tx) * 4);
      }
    const old = this.panel.texture;
    this.panel.texture = ownTex(b, 'ui:pause');
    if (old && old.label === 'ui:pause') old.destroy(true);
    const x = Math.floor((l.W - w) / 2);
    const y = Math.max(l.safe.top + 2, Math.floor((l.H - h - 10) / 2));
    this.panel.position.set(x, y);
    this.buttons.forEach((btn, k) =>
      btn.position.set(x + Math.floor((w - btn.w) / 2), y + 70 + k * bh),
    );
  }

  update(): void {}

  key(code: string): boolean {
    if (code === 'Escape') {
      this.app.closePause();
      return true;
    }
    return false;
  }

  destroy(): void {
    if (this.panel.texture.label === 'ui:pause') this.panel.texture.destroy(true);
    destroyOwned(this.root);
  }
}
