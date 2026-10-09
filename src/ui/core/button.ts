/**
 * Buttons from the M5 kit: every state (normal / hover / pressed / disabled) is a pre-rendered
 * texture; pressed art is drawn lower inside the same frame, so the sprite never moves.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import type { PixelBuffer } from '../../art/lib/pixels';
import { bigRedButton, roundButton, stampButton, type ButtonState } from '../../art/uikit/buttons';
import type { GlyphName } from '../../art/uikit/icons';
import { FONTS } from '../../art/uikit/text';
import { makeInteractive, type PressState, type Rect, type UiPointerEvent } from './node';
import { uiTex } from './tex';

export type ButtonFaces = Record<ButtonState, Texture>;

export function facesFrom(key: string, make: (s: ButtonState) => PixelBuffer): ButtonFaces {
  return {
    normal: uiTex(`${key}:normal`, () => make('normal')),
    hover: uiTex(`${key}:hover`, () => make('hover')),
    pressed: uiTex(`${key}:pressed`, () => make('pressed')),
    disabled: uiTex(`${key}:disabled`, () => make('disabled')),
  };
}

export const roundFaces = (g: GlyphName, size: 'lg' | 'sm' = 'sm'): ButtonFaces =>
  facesFrom(`round:${g}:${size}`, (s) => roundButton(g, s, size));

export const stampFaces = (label: string, minW = 0, big = false): ButtonFaces =>
  facesFrom(`stamp:${label}:${minW}:${big}`, (s) =>
    stampButton(label, minW, s, big ? FONTS.large : FONTS.smallBold),
  );

export const redFaces = (label: string, minW = 0): ButtonFaces =>
  facesFrom(`red:${label}:${minW}`, (s) => bigRedButton(label, s, minW));

export interface ButtonOptions {
  onTap: (e: UiPointerEvent) => void;
  /** Extra hit padding (UI px) — keeps touch targets ≥ 44 CSS px. */
  pad?: number;
  /** Vertical hit padding (default `pad`). */
  padY?: number;
  sound?: boolean;
  longPress?: (e: UiPointerEvent) => boolean | void;
  hover?: (over: boolean) => void;
}

/** Hook for UI sounds (set by the app: hover/click). */
export const buttonSounds: { hover: (() => void) | null; click: (() => void) | null } = {
  hover: null,
  click: null,
};

export class Button extends Container {
  readonly sprite: Sprite;
  private state: PressState = 'normal';
  private _disabled = false;

  constructor(
    private faces: ButtonFaces,
    opts: ButtonOptions,
  ) {
    super();
    this.sprite = new Sprite(faces.normal);
    this.addChild(this.sprite);
    const pad = opts.pad ?? 0;
    const padY = opts.padY ?? pad;
    makeInteractive(this, {
      hit: (): Rect => ({
        x: -pad,
        y: -padY,
        w: this.sprite.texture.width + pad * 2,
        h: this.sprite.texture.height + padY * 2,
      }),
      tap: (e) => {
        if (this._disabled) return;
        if (opts.sound !== false) buttonSounds.click?.();
        opts.onTap(e);
      },
      longPress: opts.longPress,
      hover: (over) => {
        if (over && !this._disabled && opts.sound !== false) buttonSounds.hover?.();
        opts.hover?.(over);
      },
      state: (s) => {
        this.state = s;
        this.refresh();
      },
    });
  }

  get w(): number {
    return this.sprite.texture.width;
  }

  get h(): number {
    return this.sprite.texture.height;
  }

  get disabled(): boolean {
    return this._disabled;
  }

  set disabled(d: boolean) {
    if (d === this._disabled) return;
    this._disabled = d;
    const h = (this as unknown as { __ui: { disabled?: boolean } }).__ui;
    h.disabled = d;
    this.refresh();
  }

  setFaces(f: ButtonFaces): void {
    this.faces = f;
    this.refresh();
  }

  private refresh(): void {
    this.sprite.texture = this._disabled ? this.faces.disabled : this.faces[this.state];
  }
}
