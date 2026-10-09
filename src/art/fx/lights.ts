/**
 * Light sprites for night scenes, meant to be drawn with **additive blending** on a light
 * layer (dark colours add a little light, bright colours a lot). Concentric, pixel-clean bands
 * (no dithering, no outline) give a soft look while staying palette-pure.
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, inEllipse, px } from './draw';

/**
 * Banded radial light: `bands` = colours from the outside in; `rx, ry` outer radii.
 * Band edges get a gentle 8-lobed wobble so rings don't look compass-drawn.
 */
export function lightPool(rx: number, ry: number, bands: readonly string[], wobble = 0, phase = 0): PixelBuffer {
  const W = Math.ceil(rx * 2) + 2;
  const H = Math.ceil(ry * 2) + 2;
  const b = buf(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const n = bands.length;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx);
      const w = 1 + wobble * Math.sin(a * 5 + phase);
      for (let i = n - 1; i >= 0; i--) {
        // Band radii: quadratic falloff — wider dim outer bands, tight bright core.
        const k = Math.pow((n - i) / n, 0.8) * w;
        if (inEllipse(x, y, cx, cy, rx * k, ry * k)) {
          px(b, x, y, bands[i]!);
          break;
        }
      }
    }
  }
  return b;
}

export function registerLights(reg: SpriteRegistry): void {
  const centre = (b: PixelBuffer): { x: number; y: number } => ({ x: Math.floor(b.w / 2), y: Math.floor(b.h / 2) });
  const lamp = lightPool(30, 15, ['earth0', 'earth1', 'earth2', 'earth3']);
  reg.add('fx.light.lamp', { group: 'fx', frames: lamp, anchor: centre(lamp), tags: ['additive'] });
  const halo = lightPool(10, 10, ['earth1', 'earth3', 'ochre1', 'ochre3', 'ochre4']);
  reg.add('fx.light.halo', { group: 'fx', frames: halo, anchor: centre(halo), tags: ['additive'] });
  const fire = [0, 1, 2].map((f) =>
    padTo(lightPool(26 + f, 14 + (f % 2), ['rust0', 'rust1', 'rust2', 'rust3'], 0.035, f * 2.1), 58, 32),
  );
  reg.add('fx.light.fire', { group: 'fx', frames: fire, fps: 8, anchor: centre(fire[2]!), tags: ['additive'] });
  for (const [name, bands] of [
    ['red', ['rust0', 'crim1', 'crim2', 'rust4']],
    ['blue', ['navy1', 'navy2', 'blue1', 'blue2']],
  ] as const) {
    const fr = [16, 13, 9, 13].map((r) => padTo(lightPool(r, r * 0.6, bands), 34, 22));
    reg.add(`fx.light.siren.${name}`, { group: 'fx', frames: fr, fps: 8, anchor: { x: 17, y: 11 }, tags: ['additive'] });
  }
  const blast = lightPool(44, 24, ['rust0', 'rust1', 'rust3', 'ochre2', 'ochre3', 'ochre4']);
  reg.add('fx.light.blast', { group: 'fx', frames: blast, anchor: centre(blast), tags: ['additive'] });
  const muzzle = lightPool(12, 7, ['earth1', 'earth3', 'ochre2', 'ochre4']);
  reg.add('fx.light.muzzle', { group: 'fx', frames: muzzle, anchor: centre(muzzle), tags: ['additive'] });
  const window = lightPool(8, 6, ['earth1', 'earth2', 'ochre1']);
  reg.add('fx.light.window', { group: 'fx', frames: window, anchor: centre(window), tags: ['additive'] });
}

function padTo(src: PixelBuffer, W: number, H: number): PixelBuffer {
  const b = buf(W, H);
  const ox = Math.floor((W - src.w) / 2);
  const oy = Math.floor((H - src.h) / 2);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (!src.data[i + 3]) continue;
      b.data.set(src.data.subarray(i, i + 4), ((y + oy) * W + x + ox) * 4);
    }
  }
  return b;
}

export { padTo };
