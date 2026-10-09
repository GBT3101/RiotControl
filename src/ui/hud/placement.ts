/**
 * Placement flow chrome: a hint strip while in deploy mode ("PLACE RIOT CONTROL — TAP A ROAD"),
 * and on touch the ✔ / ✖ buttons next to the preview ghost (first tap previews, second tap or
 * ✔ confirms, ✖ cancels). Rejected placements show a short reason toast + error sound.
 */
import { Container, Sprite } from 'pixi.js';
import { buf, stamp } from '../../art/fx/draw';
import { glyph } from '../../art/uikit/icons';
import { panel } from '../../art/uikit/panels';
import { FONTS, drawText, measureText } from '../../art/uikit/text';
import { tileToWorld } from '../../core/iso';
import { UNITS } from '../../data/units';
import type { GameController } from '../../game/controller';
import type { DeployFail } from '../../sim';
import { Button, facesFrom, roundFaces } from '../core/button';
import { ownTex } from '../core/tex';
import { roundButton } from '../../art/uikit/buttons';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';

const FAIL_TEXT: Record<string, string> = {
  hate: 'NOT ENOUGH HATE',
  notRoad: 'ROAD TILES ONLY',
  occupied: 'SPOT TAKEN',
  notRooftop: 'PICK A HIGHLIGHTED ROOF',
  roofTaken: 'THAT ROOF IS TAKEN',
  bounds: 'OUTSIDE THE CITY',
  phase: 'NOT NOW, MINISTER',
  locked: 'NOT APPROVED YET',
};

export function failText(reason: DeployFail | null): string {
  return (reason && FAIL_TEXT[reason]) || 'CANNOT DEPLOY THERE';
}

function hintStrip(text: string, sub: string): ReturnType<typeof buf> {
  const m = measureText(FONTS.smallBold, text);
  const s = sub ? measureText(FONTS.small, sub) : { w: 0, h: 0 };
  const w = Math.max(m.w, s.w) + 16;
  const h = m.h + (sub ? s.h + 4 : 0) + 10;
  const b = buf(w, h);
  stamp(b, panel('tooltip', w, h), 0, 0);
  drawText(b, FONTS.smallBold, text, Math.floor(w / 2), 5, 'ink', { align: 'center' });
  if (sub)
    drawText(b, FONTS.small, sub, Math.floor(w / 2), 5 + m.h + 4, 'gray1', { align: 'center' });
  return b;
}

export class Placement {
  readonly root = new Container({ label: 'placement' });
  private readonly hint = new Sprite();
  private readonly ok: Button;
  private readonly no: Button;
  private readonly cancel: Button;
  private hintKey = '';

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    this.ok = new Button(
      facesFrom('confirm:ok', (s) => {
        const b = roundButton(null, s, 'lg');
        stamp(b, glyph('check', 'lime', 'ink'), 5, s === 'pressed' ? 6 : 5);
        return b;
      }),
      { onTap: () => game.confirmPreview(), pad: 4 },
    );
    this.no = new Button(
      facesFrom('confirm:no', (s) => {
        const b = roundButton(null, s, 'lg');
        stamp(b, glyph('close', 'crim2', 'ink'), 5, s === 'pressed' ? 6 : 5);
        return b;
      }),
      { onTap: () => game.beginDeploy(null), pad: 4 },
    );
    this.cancel = new Button(roundFaces('close', 'sm'), {
      onTap: () => game.beginDeploy(null),
      pad: 4,
    });
    this.root.addChild(this.hint, this.ok, this.no, this.cancel);
    game.bus.on('deployFailed', (e) => {
      if (e.reason === 'locked') return;
      app.sfx('error');
      app.toast.info(failText(e.reason));
    });
  }

  update(l: HudLayout): void {
    const unit = this.game.deployUnit;
    this.root.visible = !!unit && !this.game.attract;
    if (!unit) return;
    const roof = UNITS[unit].placement === 'rooftop';
    const touch = this.app.touch;
    const text = `PLACE ${UNITS[unit].name.toUpperCase()}`;
    const sub = touch
      ? roof
        ? 'Tap a glowing roof, tap again to confirm'
        : 'Tap a road, tap again (or ✓) to confirm'.replace('✓', 'OK')
      : roof
        ? 'Click a glowing roof · Shift keeps placing · Esc cancels'
        : 'Click a road · Shift keeps placing · Esc cancels';
    const key = `${text}|${sub}|${l.W < 300}`;
    if (key !== this.hintKey) {
      this.hintKey = key;
      const old = this.hint.texture;
      this.hint.texture = ownTex(hintStrip(text, l.W < 300 ? '' : sub), 'ui:placehint');
      if (old && old.label === 'ui:placehint') old.destroy(true);
    }
    const hx = Math.floor((l.W - this.hint.texture.width) / 2);
    const hy = l.bannerY + 2;
    this.hint.position.set(hx, hy);
    this.cancel.visible = touch;
    this.cancel.position.set(
      hx + this.hint.texture.width + 3,
      hy + Math.floor((this.hint.texture.height - this.cancel.h) / 2),
    );
    const p = this.game.preview;
    this.ok.visible = this.no.visible = touch && !!p;
    if (p && touch) {
      let q = tileToWorld(p.i + 0.5, p.j + 0.5);
      if (roof) {
        const b = this.game.world.map.buildings.find((x) => x.i === p.i && x.j === p.j);
        if (b) q = tileToWorld(b.i + b.w / 2, b.j + b.d / 2);
      }
      const s = this.game.view.worldToUi(q.x, q.y - (roof ? 40 : 20));
      const y = Math.max(
        l.topBar.h + 2,
        Math.min(l.deploy.y - this.ok.h - 2, Math.round(s.y - 30)),
      );
      const x = Math.round(s.x);
      this.ok.position.set(Math.min(l.W - this.ok.w - 2, x + 8), y);
      this.no.position.set(Math.max(2, x - 8 - this.no.w), y);
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
