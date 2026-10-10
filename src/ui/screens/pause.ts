/**
 * Pause menu: the world freezes under a dim layer; a manila dossier with RESUME / SETTINGS /
 * RESTART / QUIT TO TITLE and a typed summary of the run so far.
 */
import { Container, Sprite } from 'pixi.js';
import { rubberStamp } from '../../art/uikit/banners';
import { stamp } from '../../art/fx/draw';
import { FONTS, drawText } from '../../art/uikit/text';
import type { GameController } from '../../game/controller';
import { Button, stampFaces } from '../core/button';
import { capBlockH, textBelow, type Box, type TextBox } from '../core/boxes';
import { makeInteractive } from '../core/node';
import { ownTex, destroyOwned } from '../core/tex';
import { formatDuration, formatNumber } from '../records';
import { CITY_COPY } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';
import { dossier } from './common';
import { backdrop, fitBackdrop, type Screen } from './screen';

const PAUSE_W = 160;

/**
 * Pause dossier geometry (buffer px; the folder tab takes the top 10): the PAUSED stamp in its
 * own row under the tab, the typed run summary under it (wrapped), then the buttons — so the
 * stamp can never sit on the summary, whatever the wave, level or time.
 */
export function pauseLayout(
  lines: string[],
  st: { w: number; h: number },
  buttonW: number,
  buttonH: number,
  buttons: number,
): { w: number; h: number; textW: number; stamp: Box; lines: TextBox[]; buttons: Box[] } {
  const w = PAUSE_W;
  const textW = w - 24;
  const stampBox = { x: Math.floor((w - st.w) / 2), y: 10 + 4, w: st.w, h: st.h };
  let after = stampBox.y + st.h + 2;
  let cap = after + 3;
  const boxes = lines.map((t) => {
    const b = textBelow(FONTS.mono, t, 12, cap, after, textW);
    cap = b.capY + capBlockH(FONTS.mono, t, textW) + 4;
    after = b.y + b.h + 1;
    return b;
  });
  let y = Math.max(after, cap - 3);
  y += 6;
  const pitch = buttonH + 4;
  const btns = Array.from({ length: buttons }, (_, k) => ({
    x: Math.floor((w - buttonW) / 2),
    y: y + k * pitch,
    w: buttonW,
    h: buttonH,
  }));
  return { w, h: y + buttons * pitch + 4, textW, stamp: stampBox, lines: boxes, buttons: btns };
}

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
    const s = this.game.hud();
    const st = rubberStamp('PAUSED', 'navy2', { tilt: -0.05, seed: 2 });
    const lines = [
      `WAVE ${s.wave} · LEVEL ${s.level}`,
      `${formatNumber(s.legit)} LEGIT · ${formatDuration(this.game.world.time)}`,
    ];
    const lay = pauseLayout(lines, st, this.buttons[0]!.w, this.buttons[0]!.h, this.buttons.length);
    const b = dossier(
      lay.w,
      lay.h - 10,
      `FILE: ${CITY_COPY[this.game.world.map.city].name.toUpperCase()}`,
    );
    stamp(b, st, lay.stamp.x, lay.stamp.y);
    lines.forEach((t, k) =>
      drawText(b, FONTS.mono, t, lay.lines[k]!.x, lay.lines[k]!.capY, 'gray1', {
        maxWidth: lay.textW,
      }),
    );
    const old = this.panel.texture;
    this.panel.texture = ownTex(b, 'ui:pause');
    if (old && old.label === 'ui:pause') old.destroy(true);
    const x = Math.floor((l.W - lay.w) / 2);
    const y = Math.max(l.safe.top + 2, Math.floor((l.H - lay.h) / 2));
    this.panel.position.set(x, y);
    this.buttons.forEach((btn, k) =>
      btn.position.set(x + lay.buttons[k]!.x, y + lay.buttons[k]!.y),
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
