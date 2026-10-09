#!/usr/bin/env node
/**
 * App icons from the art pipeline (M13b): the Riot Control officer portrait
 * (`unit.riot.portrait`, 36×36 RIOT-64 pixels) on an `ink` square, integer-scaled (nearest) —
 * favicon 32 (centre crop at 1×), apple-touch-icon 180 (5×), web-manifest 192 / 512, plus a
 * 2-pixel `crim2` keyline at sizes ≥ 192 (the safe area of round masks keeps the face).
 *
 *   npm run icons            # writes public/icons/*.png (committed; Vite copies public/)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runnerImport } from 'vite';
import { encodePng } from './lib/png.mjs';

const root = resolve(import.meta.dirname, '..');
const load = async (p) =>
  (await runnerImport(resolve(root, p), { root, logLevel: 'error', configFile: false })).module;
const { createArtRegistry } = await load('src/art/index.ts');
const { resolveColor } = await load('src/art/palette.ts');
const reg = createArtRegistry();
const sprite = reg.get('unit.riot.portrait');
const face = sprite.frames[0];
/** Packed 0xRRGGBBAA → [r, g, b, a]. */
const rgba = (c) => [(c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255, c & 255];
const ink = rgba(resolveColor('ink'));
const rim = rgba(resolveColor('crim2'));

function icon(S) {
  const px = new Uint8ClampedArray(S * S * 4);
  for (let i = 0; i < S * S; i++) px.set(ink, i * 4);
  const k = Math.max(1, Math.floor(S / face.w));
  const w = face.w * k;
  const h = face.h * k;
  // Centre horizontally; sit on the bottom edge (the shoulders run off like a bust).
  const ox = Math.floor((S - w) / 2);
  const oy = S - h;
  for (let y = 0; y < h; y++) {
    const ty = oy + y;
    if (ty < 0 || ty >= S) continue;
    for (let x = 0; x < w; x++) {
      const tx = ox + x;
      if (tx < 0 || tx >= S) continue;
      const si = (Math.floor(y / k) * face.w + Math.floor(x / k)) * 4;
      if (face.data[si + 3] < 200) continue;
      px.set(face.data.subarray(si, si + 3), (ty * S + tx) * 4);
      px[(ty * S + tx) * 4 + 3] = 255;
    }
  }
  if (S >= 192) {
    const t = Math.max(2, Math.floor(S / 96));
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (x < t || y < t || x >= S - t || y >= S - t) px.set(rim, (y * S + x) * 4);
  }
  return px;
}

const out = resolve(root, 'public/icons');
mkdirSync(out, { recursive: true });
for (const [name, S] of [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(resolve(out, name), encodePng(S, S, icon(S)));
  console.log(`✓ public/icons/${name} (${S}×${S})`);
}
