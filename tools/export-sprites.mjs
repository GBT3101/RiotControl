#!/usr/bin/env node
/**
 * Export registered sprites to PNG without a browser (fast art iteration loop).
 *
 *   node tools/export-sprites.mjs                       # every sprite, 6×, into shots/sprites/
 *   node tools/export-sprites.mjs --filter riot --scale 10 --bg light
 *   node tools/export-sprites.mjs --group tiles --sheet  # one contact sheet per group
 *
 * Each sprite becomes a horizontal strip of its frames (scaled, 1 scaled-pixel gutters).
 * Backgrounds: dark (default), light, or checker.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { runnerImport } from 'vite';
import { encodePng } from './lib/png.mjs';

const { values: args } = parseArgs({
  options: {
    filter: { type: 'string' },
    group: { type: 'string' },
    scale: { type: 'string', default: '6' },
    bg: { type: 'string', default: 'dark' },
    out: { type: 'string', default: 'shots/sprites' },
    sheet: { type: 'boolean', default: false },
  },
});

const root = resolve(import.meta.dirname, '..');
const { module: artIndex } = await runnerImport(resolve(root, 'src/art/index.ts'), {
  root,
  logLevel: 'error',
  configFile: false,
});
const registry = artIndex.createArtRegistry();
const scale = Math.max(1, Number(args.scale) | 0);
const outDir = resolve(root, args.out);
mkdirSync(outDir, { recursive: true });

const BG = {
  dark: [
    [0x1e, 0x1b, 0x28],
    [0x1e, 0x1b, 0x28],
  ],
  light: [
    [0xd8, 0xd4, 0xcc],
    [0xd8, 0xd4, 0xcc],
  ],
  checker: [
    [0x2a, 0x26, 0x36],
    [0x34, 0x30, 0x42],
  ],
}[args.bg] ?? [
  [0x1e, 0x1b, 0x28],
  [0x1e, 0x1b, 0x28],
];

function compose(defs) {
  // Rows of sprites (one row per sprite), frames left to right.
  const gap = 2;
  const rows = defs.map((d) => ({
    d,
    w: d.frames.length * (d.frames[0].w + gap) + gap,
    h: d.frames[0].h + gap * 2,
  }));
  const W = Math.max(...rows.map((r) => r.w)) * scale;
  const H = rows.reduce((s, r) => s + r.h, 0) * scale;
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = BG[((x / (scale * 4)) ^ (y / (scale * 4))) & 1];
      const i = (y * W + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
  let oy = 0;
  for (const r of rows) {
    r.d.frames.forEach((f, fi) => {
      const ox = gap + fi * (f.w + gap);
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const si = (y * f.w + x) * 4;
          const a = f.data[si + 3] / 255;
          if (a === 0) continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const di = (((oy + gap + y) * scale + sy) * W + (ox + x) * scale + sx) * 4;
              for (let k = 0; k < 3; k++) px[di + k] = px[di + k] * (1 - a) + f.data[si + k] * a;
            }
          }
        }
      }
    });
    oy += r.h;
  }
  return encodePng(W, H, px);
}

let defs = registry.list(args.group);
if (args.filter) defs = defs.filter((d) => d.name.includes(args.filter));
if (defs.length === 0) {
  console.error('No sprites match.');
  process.exit(1);
}
if (args.sheet) {
  const groups = [...new Set(defs.map((d) => d.group))];
  for (const g of groups) {
    const file = resolve(outDir, `sheet-${g}.png`);
    writeFileSync(file, compose(defs.filter((d) => d.group === g)));
    console.log(file);
  }
} else {
  for (const d of defs) {
    const file = resolve(outDir, `${d.name}.png`);
    writeFileSync(file, compose([d]));
    console.log(file);
  }
}
