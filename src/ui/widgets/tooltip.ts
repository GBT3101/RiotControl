/**
 * Index-card tooltip (M5 `tooltip` 9-slice): first line in small bold caps, the rest in the
 * small font; a final line in quotes is typewritten (mono). Shown on hover (desktop) or long
 * press (touch), positioned next to the node and clamped inside the safe area.
 */
import { Container, Point, Sprite } from 'pixi.js';
import { buf, stamp } from '../../art/fx/draw';
import type { PixelBuffer } from '../../art/lib/pixels';
import { panel } from '../../art/uikit/panels';
import { FONTS, drawText, measureText } from '../../art/uikit/text';
import { swapOwned } from '../core/tex';
import type { UiApp } from '../app';

export function tooltipCard(text: string, maxW = 170): PixelBuffer {
  const lines = text.split('\n');
  const head = lines[0] ?? '';
  const body = lines.slice(1);
  const parts: Array<{ font: (typeof FONTS)[keyof typeof FONTS]; text: string; colour: string }> =
    [];
  parts.push({ font: FONTS.smallBold, text: head, colour: 'ink' });
  for (const l of body) {
    const quote = l.startsWith('"');
    parts.push({
      font: quote ? FONTS.mono : FONTS.small,
      text: l,
      colour: quote ? 'rust1' : 'gray1',
    });
  }
  const inner = maxW - 12;
  let w = 0;
  let h = 0;
  const ms = parts.map((p) => {
    const m = measureText(p.font, p.text, inner);
    w = Math.max(w, m.w);
    h += m.h + 4;
    return m;
  });
  const W = Math.min(maxW, w + 12);
  const H = h + 8;
  const b = buf(W, H);
  stamp(b, panel('tooltip', W, H), 0, 0);
  let y = 6;
  parts.forEach((p, k) => {
    drawText(b, p.font, p.text, 6, y, p.colour, { maxWidth: inner });
    y += ms[k]!.h + 4;
    if (k === 0) y += 1;
  });
  return b;
}

export class Tooltip {
  readonly root = new Container({ label: 'tooltip' });
  private readonly sprite = new Sprite();
  private owner: Container | null = null;
  private text = '';
  private ttl = 0;
  private prefer: 'above' | 'below' | 'auto' = 'auto';

  constructor(private readonly app: UiApp) {
    this.root.addChild(this.sprite);
    this.root.visible = false;
  }

  /**
   * Show `text()` next to `node` (null hides it if `node` owned it). `autoHide` seconds for
   * touch; desktop tooltips follow hover.
   */
  showFor(
    node: Container | null,
    text: () => string,
    autoHide?: number,
    prefer: 'above' | 'below' | 'auto' = 'auto',
  ): void {
    if (!node) {
      if (!autoHide) this.hide();
      return;
    }
    this.owner = node;
    this.prefer = prefer;
    this.ttl = autoHide ?? 0;
    const t = text();
    if (t !== this.text) {
      this.text = t;
      swapOwned(this.sprite, tooltipCard(t, this.app.layout.W < 300 ? 150 : 180), 'ui:tooltip');
    }
    this.root.visible = true;
    this.place();
  }

  hide(): void {
    this.owner = null;
    this.root.visible = false;
  }

  private place(): void {
    const o = this.owner;
    if (!o || o.destroyed) return this.hide();
    const k = this.app.k;
    const b = o.getBounds();
    const tl = new Point(b.x / k, b.y / k);
    const w = this.sprite.texture.width;
    const h = this.sprite.texture.height;
    const l = this.app.layout;
    const bw = b.width / k;
    const bh = b.height / k;
    let x = Math.round(tl.x + bw / 2 - w / 2);
    let y: number;
    const above = Math.round(tl.y - h - 3);
    const below = Math.round(tl.y + bh + 3);
    if (this.prefer === 'above' || (this.prefer === 'auto' && below + h > l.H - l.safe.bottom))
      y = above >= l.safe.top ? above : below;
    else y = below + h <= l.H - l.safe.bottom ? below : above;
    x = Math.max(l.safe.left + 2, Math.min(l.W - l.safe.right - w - 2, x));
    y = Math.max(l.safe.top + 2, Math.min(l.H - h - 2, y));
    this.root.position.set(x, y);
  }

  update(dt: number): void {
    if (!this.root.visible) return;
    if (this.ttl > 0) {
      this.ttl -= dt;
      if (this.ttl <= 0) return this.hide();
    }
    if (this.owner && (this.owner.destroyed || !this.owner.visible || !this.owner.parent?.visible))
      return this.hide();
    this.place();
  }
}
