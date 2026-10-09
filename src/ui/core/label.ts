/**
 * Bitmap-text sprite that re-renders only when its text changes (HUD counters, timers).
 */
import { Sprite, Texture } from 'pixi.js';
import { FONTS, textSprite, type FontName, type TextOptions } from '../../art/uikit/text';
import { createBuffer } from '../../art/lib/pixels';
import { bufferTexture } from '../../art/uikit/pixi';

export class Label extends Sprite {
  private cur = '\u0000';
  private curColour = '';

  constructor(
    readonly font: FontName,
    public colour: string,
    public opts: TextOptions = {},
    text = '',
  ) {
    super(Texture.EMPTY);
    this.roundPixels = true;
    this.set(text);
  }

  /** Width in UI px of the current text (0 when empty). */
  get textWidth(): number {
    return this.texture === Texture.EMPTY ? 0 : this.texture.width;
  }

  set(text: string, colour = this.colour): this {
    if (text === this.cur && colour === this.curColour) return this;
    this.cur = text;
    this.curColour = colour;
    this.colour = colour;
    const old = this.texture;
    if (text === '') this.texture = Texture.EMPTY;
    else {
      const buf = textSprite(FONTS[this.font], text, colour, this.opts);
      this.texture = bufferTexture(buf.w > 0 ? buf : createBuffer(1, 1), 'label');
    }
    if (old && old !== Texture.EMPTY && old !== this.texture) old.destroy(true);
    return this;
  }

  get text(): string {
    return this.cur;
  }

  override destroy(): void {
    if (this.texture && this.texture !== Texture.EMPTY) this.texture.destroy(true);
    super.destroy();
  }
}
