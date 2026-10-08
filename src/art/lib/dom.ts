/** Browser-only helpers for turning pixel buffers into canvases (gallery, debug). */
import type { PixelBuffer } from './pixels';

/** Draw a buffer into a new canvas at an integer scale (nearest neighbour). */
export function toCanvas(buf: PixelBuffer, scale = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = buf.w * scale;
  c.height = buf.h * scale;
  drawBuffer(c, buf, scale);
  return c;
}

/** Draw a buffer into an existing canvas (cleared) at an integer scale. */
export function drawBuffer(canvas: HTMLCanvasElement, buf: PixelBuffer, scale = 1): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new ImageData(new Uint8ClampedArray(buf.data), buf.w, buf.h);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (scale === 1) {
    ctx.putImageData(img, 0, 0);
    return;
  }
  const tmp = document.createElement('canvas');
  tmp.width = buf.w;
  tmp.height = buf.h;
  tmp.getContext('2d')?.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, buf.w * scale, buf.h * scale);
}
