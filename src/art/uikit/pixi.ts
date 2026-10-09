/**
 * Pixi helpers for the UI kit (browser only): turn generated PixelBuffers (text, panels,
 * cards, meters…) into nearest-sampled textures. Cache textures you re-use; call
 * `texture.destroy(true)` when replacing a dynamic one (e.g. a counter that changed).
 */
import { CanvasSource, Texture } from 'pixi.js';
import type { PixelBuffer } from '../lib/pixels';
import { FONTS, textSprite, type FontName, type TextOptions } from './text';

/** PixelBuffer → Texture (nearest, resolution 1). */
export function bufferTexture(buf: PixelBuffer, label = 'uikit'): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = buf.w;
  canvas.height = buf.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('bufferTexture: no 2D context');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.w, buf.h), 0, 0);
  const source = new CanvasSource({ resource: canvas, scaleMode: 'nearest', resolution: 1 });
  return new Texture({ source, label });
}

/** Bitmap text → Texture (tightly trimmed; see textSprite). */
export function textTexture(
  font: FontName,
  str: string,
  colour: string,
  opts: TextOptions = {},
): Texture {
  return bufferTexture(textSprite(FONTS[font], str, colour, opts), `text:${str.slice(0, 24)}`);
}
