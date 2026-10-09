/** Credits: a typewritten personnel file. */
import { Container, Sprite } from 'pixi.js';
import { rubberStamp } from '../../art/uikit/banners';
import { FONTS, drawText, measureText } from '../../art/uikit/text';
import { stamp } from '../../art/fx/draw';
import { Button, stampFaces } from '../core/button';
import { makeInteractive } from '../core/node';
import { swapOwned } from '../core/tex';
import { CREDITS, UI_TEXT } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';
import { dossier } from './common';
import { backdrop, fitBackdrop, type Screen } from './screen';

export class CreditsScreen implements Screen {
  readonly root = new Container({ label: 'credits' });
  readonly modal = true;
  private readonly dim = backdrop(0.55);
  private readonly panel = new Sprite();
  private readonly back: Button;

  constructor(private readonly app: UiApp) {
    makeInteractive(this.panel, { tap: () => app.pop(this) });
    this.back = new Button(stampFaces('BACK', 80), { onTap: () => app.pop(this), pad: 3 });
    this.root.addChild(this.dim, this.panel, this.back);
  }

  layout(l: HudLayout): void {
    fitBackdrop(this.dim, l);
    const w = Math.min(260, l.W - 8);
    const inner = w - 24;
    let h = 26;
    const blocks = CREDITS.map(([k, v]) => {
      const m = measureText(FONTS.mono, v, inner);
      const bh = 10 + m.h + 6;
      h += bh;
      return { k, v, bh };
    });
    const dm = measureText(FONTS.small, UI_TEXT.disclaimer, inner);
    h += dm.h + 10 + this.back.h + 8;
    h = Math.min(h, l.H - l.safe.top - l.safe.bottom - 14);
    const b = dossier(w, h, 'FILE: PERSONNEL');
    let y = 10 + 10;
    for (const bl of blocks) {
      drawText(b, FONTS.smallBold, bl.k, 12, y, 'crim1');
      drawText(b, FONTS.mono, bl.v, 12, y + 10, 'gray1', { maxWidth: inner });
      y += bl.bh;
    }
    drawText(b, FONTS.small, UI_TEXT.disclaimer, 12, y + 2, 'stone1', { maxWidth: inner });
    const st = rubberStamp('TOP SECRET', 'crim1', { font: FONTS.smallBold, tilt: 0.07, seed: 9 });
    stamp(b, st, w - st.w - 12, 16);
    swapOwned(this.panel, b, 'ui:credits');
    const x = Math.floor((l.W - w) / 2);
    const y0 = Math.max(l.safe.top + 2, Math.floor((l.H - b.h) / 2));
    this.panel.position.set(x, y0);
    this.back.position.set(x + Math.floor((w - this.back.w) / 2), y0 + b.h - this.back.h - 8);
  }

  update(): void {}

  key(code: string): boolean {
    if (code === 'Escape') {
      this.app.pop(this);
      return true;
    }
    return false;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
