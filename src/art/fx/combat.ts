/**
 * Combat reactions: cartoon blood puffs & ground splats (lethal weapons only), KO stars and
 * dizzy birds (non-lethal), sweat drops, anger-vein pop, paparazzi camera flash.
 */
import { grid, sheet } from '../lib/grid';
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, ellipse, mask, ellipseMask, fillMask, outlineBuf, paintLobes, prng, px, stamp, mget, type Lobe } from './draw';

const BLOOD = ['rust0', 'crim1', 'crim2', 'crim2', 'rust4'];

function bloodPuff(seed: number, n: number): PixelBuffer[] {
  const rnd = prng(seed);
  const drops = Array.from({ length: n }, () => ({ vx: (rnd() - 0.5) * 3.2, vy: -0.8 - rnd() * 1.6 }));
  return [0, 1, 2, 3].map((f) => {
    const b = buf(17, 15);
    const r = [2.2, 3.4, 3, 2][f]!;
    const lobes: Lobe[] = f < 3
      ? [
          { x: 8 - f * 0.6, y: 7 - f * 0.3, r },
          { x: 9.5 + f * 0.5, y: 6 - f * 0.4, r: r * 0.75 },
          { x: 7.5, y: 8.5, r: r * 0.6 },
        ]
      : [
          { x: 6, y: 6, r: 1.6 },
          { x: 11, y: 5.5, r: 1.3 },
        ];
    paintLobes(b, lobes, { ramp: BLOOD, outlineLit: 'crim1' });
    for (const d of drops) {
      const t = f + 1;
      const x = Math.round(8 + d.vx * t);
      const y = Math.round(7 + d.vy * t + 0.55 * t * t);
      if (y < 15 && f > 0) {
        px(b, x, y, 'crim2');
        if (f < 3) px(b, x, y + 1, 'crim1');
      }
    }
    return b;
  });
}

/** Ground splat decal: flattened blob + satellite drops, 3 tones, wet highlight. */
function splat(seed: number, W: number, H: number): PixelBuffer {
  const rnd = prng(seed);
  const b = buf(W, H);
  const k = mask(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = i === 0 ? 0 : 1.5 + rnd() * (W * 0.18);
    const r = i === 0 ? W * 0.2 : W * (0.08 + rnd() * 0.1);
    ellipseMask(k, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.5, r, r * 0.62);
  }
  // Satellite droplets.
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const d = W * (0.3 + rnd() * 0.15);
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d * 0.45);
    if (x > 0 && y > 0 && x < W - 1 && y < H - 1) {
      k.m[y * W + x] = 1;
      if (rnd() < 0.4) k.m[y * W + x + 1] = 1;
    }
  }
  fillMask(b, k, 'crim1');
  // Darker lower-right rim, bright upper-left inner highlight.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mget(k, x, y)) continue;
      if (!mget(k, x + 1, y + 1) || !mget(k, x, y + 1)) px(b, x, y, 'rust0');
      else if (mget(k, x - 1, y - 1) && mget(k, x - 2, y - 1) && mget(k, x + 2, y + 1) && mget(k, x - 1, y - 2) === 0) px(b, x, y, 'crim2');
    }
  }
  // Wet glint on the main pool.
  px(b, Math.round(cx - W * 0.08), Math.round(cy - 1), 'rust4');
  return b;
}

/* KO stars & birds ------------------------------------------------------- */

const STAR_BIG = grid(`
  ..o..
  .oYo.
  oYWYo
  .oYo.
  ..o..
`, { o: 'rust1', Y: 'ochre3', W: 'ochre4' });
const STAR_SMALL = grid(`
  .o.
  oYo
  .o.
`, { o: 'rust1', Y: 'ochre2' });

const BIRD_KEYS = { o: 'earth1', Y: 'ochre3', y: 'ochre2', k: 'ink', r: 'rust3', W: 'ochre4' };
const BIRDS = sheet(`
  .o.o...
  oYoYo..
  .oYYkro
  .oYYYo.
  ..ooo..

  .......
  ..ooo..
  .oYYkro
  oYYYYo.
  .ooyo..
`, BIRD_KEYS);

function koFrames(kind: 'stars' | 'birds'): PixelBuffer[] {
  const W = 25;
  const H = 13;
  const cx = 12;
  const cy = 6;
  const out: PixelBuffer[] = [];
  const F = 6;
  for (let f = 0; f < F; f++) {
    const b = buf(W, H);
    const items = [0, 1, 2].map((i) => {
      const a = ((f / F + i / 3) * Math.PI * 2) % (Math.PI * 2);
      return { a, x: cx + Math.cos(a) * 9, y: cy + Math.sin(a) * 3.2 };
    });
    // Back (upper) items first, smaller.
    items.sort((p, q) => p.y - q.y);
    for (const it of items) {
      const front = Math.sin(it.a) > -0.2;
      if (kind === 'stars') {
        const s = front ? STAR_BIG : STAR_SMALL;
        stamp(b, s, Math.round(it.x - (s.w - 1) / 2), Math.round(it.y - (s.h - 1) / 2));
      } else {
        // Birds fly clockwise: moving right when in front.
        let bird = BIRDS[(f + Math.round(it.a * 2)) % 2]!;
        if (Math.cos(it.a + Math.PI / 2) < 0) bird = mirror(bird);
        stamp(b, bird, Math.round(it.x - 3), Math.round(it.y - 2));
      }
    }
    out.push(b);
  }
  return out;
}

function mirror(src: PixelBuffer): PixelBuffer {
  const o = buf(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const j = (y * src.w + (src.w - 1 - x)) * 4;
      o.data.set(src.data.subarray(i, i + 4), j);
    }
  }
  return o;
}

/* Sweat, anger, camera flash -------------------------------------------- */

const SWEAT = sheet(`
  .......
  ...o...
  ..oSo..
  ..oSo..
  .oSWSo.
  .oSSBo.
  ..ooo..
  .......
  .......
  .......

  .......
  .......
  ...o...
  ..oSo..
  .oSWSo.
  .oSSSo.
  .oSSBo.
  ..ooo..
  .......
  .......

  .......
  .......
  .......
  .......
  ...o...
  ..oSo..
  .oWSBo.
  ..ooo..
  .......
  .......

  .......
  .......
  .......
  .......
  .......
  .......
  .......
  .S...S.
  ..o.o..
  .......
`, { o: 'blue1', S: 'sky', W: 'white', B: 'blue2' });

/** Anger vein "💢": four curved brackets, convex sides to the centre. Pop: small → big → settle → pulse. */
const ANGER = (() => {
  const big = `
    ...#...#...
    ...#...#...
    ..##...##..
    ###.....###
    ...........
    ...........
    ...........
    ###.....###
    ..##...##..
    ...#...#...
    ...#...#...
  `;
  const small = `
    ...........
    ...........
    ....#.#....
    ...##.##...
    ..#.....#..
    ...........
    ..#.....#..
    ...##.##...
    ....#.#....
    ...........
    ...........
  `;
  const mid = `
    ...........
    ...#...#...
    ...#...#...
    .###...###.
    ...........
    ...........
    ...........
    .###...###.
    ...#...#...
    ...#...#...
    ...........
  `;
  const mk = (src: string): PixelBuffer => {
    const b = buf(13, 13);
    stamp(b, grid(src, { '#': 'crim2' }), 1, 1);
    outlineBuf(b, 'rust0');
    return b;
  };
  return [mk(small), mk(big), mk(mid), mk(big), mk(mid)];
})();

function camFlash(): PixelBuffer[] {
  const S = 21;
  const c = 10;
  return [1, 0.75, 0.45, 0.2].map((s, f) => {
    const b = buf(S, S);
    const L = Math.round(9 * s);
    const D = Math.round(5 * s);
    for (let i = -L; i <= L; i++) {
      const t = Math.abs(i) / Math.max(1, L);
      const r = t < 0.3 ? 'white' : t < 0.7 ? 'ochre4' : 'sky';
      px(b, c + i, c, r);
      px(b, c, c + i, r);
    }
    for (let i = -D; i <= D; i++) {
      const r = Math.abs(i) < 2 ? 'white' : 'ochre4';
      if (f < 3) {
        px(b, c + i, c + i, r);
        px(b, c + i, c - i, r);
      }
    }
    if (f < 2) {
      ellipse(b, c + 0.5, c + 0.5, 2.6 * s + 0.5, 2.6 * s + 0.5, 'ochre4');
      ellipse(b, c + 0.5, c + 0.5, 1.8 * s + 0.4, 1.8 * s + 0.4, 'white');
    }
    return b;
  });
}

export function registerCombat(reg: SpriteRegistry): void {
  reg.add('fx.blood.puff.a', { group: 'fx', frames: bloodPuff(3, 5), fps: 14, loop: false, anchor: { x: 8, y: 8 } });
  reg.add('fx.blood.puff.b', { group: 'fx', frames: bloodPuff(8, 7), fps: 14, loop: false, anchor: { x: 8, y: 8 } });
  const splats: Array<[number, number, number]> = [
    [1, 18, 9], [2, 16, 8], [3, 22, 11], [4, 14, 7], [5, 20, 10],
  ];
  splats.forEach(([seed, w, h], i) => {
    const b = splat(seed * 13, w, h);
    reg.add(`fx.blood.splat.${'abcde'[i]}`, { group: 'fx', frames: b, anchor: { x: Math.floor(w / 2), y: Math.floor(h / 2) }, tags: ['decal'] });
  });
  reg.add('fx.ko.stars', { group: 'fx', frames: koFrames('stars'), fps: 8, anchor: { x: 12, y: 6 } });
  reg.add('fx.ko.birds', { group: 'fx', frames: koFrames('birds'), fps: 8, anchor: { x: 12, y: 6 } });
  reg.add('fx.sweat', { group: 'fx', frames: SWEAT, fps: 8, loop: false, anchor: { x: 3, y: 1 } });
  reg.add('fx.anger', { group: 'fx', frames: ANGER, fps: 10, loop: false, anchor: { x: 6, y: 6 } });
  reg.add('fx.camflash', { group: 'fx', frames: camFlash(), fps: 16, loop: false, anchor: { x: 10, y: 10 } });
}
