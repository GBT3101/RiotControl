/**
 * Crowd preview (M4b review image): ~200 seeded protesters of every type marching on a plain
 * iso road, each a different variant with its own animation phase. Pure / deterministic.
 */
import { Rng } from '../../core/rng';
import { blit, createBuffer, type PixelBuffer } from '../lib/pixels';
import { resolveColor } from '../palette';
import * as A from './anims';
import { trimFrames } from './build';
import { renderFigure, type Facing, type Pose } from './figure';
import { mirrorX } from '../lib/pixels';
import { rollVariant, type ProtesterType, type Variant } from './variants';
import type { City } from './sign';

export interface CrowdOptions {
  w?: number;
  h?: number;
  count?: number;
  seed?: number | string;
  city?: City;
  frames?: number;
}

const MIX: ReadonlyArray<readonly [ProtesterType, number]> = [
  ['student', 30],
  ['woke', 24],
  ['mob', 20],
  ['violent', 14],
  ['crazy', 9],
  ['cultist', 8],
  ['prophet', 4],
];

interface Actor {
  x: number;
  y: number;
  frames: PixelBuffer[];
  anchor: { x: number; y: number };
  phase: number;
  /** Frame hold (1 = 10 fps-ish at 8 frames, 2 = half speed for 4-frame idles). */
  hold: number;
}

function animFrames(v: Variant, poses: Pose[], facing: Facing, mirror: boolean): { frames: PixelBuffer[]; anchor: { x: number; y: number } } {
  const t = trimFrames(poses.map((p) => renderFigure(v.look, facing, p).buf));
  if (!mirror) return t;
  return { frames: t.frames.map(mirrorX), anchor: { x: t.frames[0]!.w - 1 - t.anchor.x, y: t.anchor.y } };
}

/** Plain asphalt road with faint iso tile seams and a dashed lane line. */
export function roadBackground(w: number, h: number): PixelBuffer {
  const buf = createBuffer(w, h);
  const base = resolveColor('gray2');
  const seam = resolveColor('gray1');
  const fleck = resolveColor('gray3');
  const line = resolveColor('gray6');
  const rng = new Rng('road');
  const put = (x: number, y: number, c: number): void => {
    const i = (y * w + x) * 4;
    buf.data[i] = (c >>> 24) & 255;
    buf.data[i + 1] = (c >>> 16) & 255;
    buf.data[i + 2] = (c >>> 8) & 255;
    buf.data[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // iso diamond seams of 32×16 tiles: lines x/2 ± y = const
      const a = (((x >> 1) + y) % 16 + 16) % 16;
      const b = (((x >> 1) - y) % 16 + 16) % 16;
      let c = base;
      if ((a === 0 || b === 0) && (x + y) % 3 !== 0) c = seam;
      else if (rng.chance(0.025)) c = fleck;
      put(x, y, c);
    }
  }
  // dashed centre line running NE→SW through the middle
  for (let x = 0; x < w; x++) {
    const y = Math.round(h / 2 + (w / 2 - x) / 2);
    if (y < 0 || y >= h - 1) continue;
    if (Math.floor(x / 10) % 2 === 0) {
      put(x, y, line);
      put(x, y + 1, line);
    }
  }
  return buf;
}

/** Compose the animated crowd preview (frames share the same actors). */
export function composeCrowd(opts: CrowdOptions = {}): PixelBuffer[] {
  const W = opts.w ?? 320;
  const H = opts.h ?? 180;
  const N = opts.count ?? 200;
  const F = opts.frames ?? 8;
  const rng = new Rng(`crowd:${opts.seed ?? 'riot'}`);
  const city = opts.city ?? 'any';
  const counters = new Map<ProtesterType, number>();
  const actors: Actor[] = [];
  const add = (v: Variant, x: number, y: number, kind: 'walk' | 'idle' | 'attack' | 'run' | 'ko' | 'die' | 'flash', facing: Facing, mirror: boolean): void => {
    let spec: A.AnimSpec | undefined;
    let poses: Pose[];
    if (kind === 'ko' || kind === 'die') {
      spec = kind === 'ko' ? A.ko(v.kit, facing) : A.die(v.kit, facing);
      poses = [spec.poses[spec.poses.length - 1]!];
    } else {
      spec =
        kind === 'idle'
          ? A.idle(v.kit, facing)
          : kind === 'attack'
            ? (A.attack(v.kit, facing) ?? A.idle(v.kit, facing))
            : kind === 'run'
              ? A.run(v.kit, facing)
              : kind === 'flash'
                ? A.flash(v.kit, facing)
                : A.walk(v.kit, facing);
      poses = spec.poses;
    }
    const a = animFrames(v, poses, facing, mirror);
    actors.push({ x, y, frames: a.frames, anchor: a.anchor, phase: rng.int(0, 7), hold: poses.length <= 4 ? 2 : 1 });
  };
  const next = (t: ProtesterType): Variant => {
    const i = counters.get(t) ?? 0;
    counters.set(t, i + 1);
    return rollVariant(t, i, { seed: opts.seed, city });
  };
  // The horde flows from the upper right toward the lower left (screen SW), filling a wide street band.
  for (let n = 0; n < N; n++) {
    const t = rng.weighted(MIX.map((m) => m[0]), MIX.map((m) => m[1]));
    const v = next(t);
    const u = rng.next();
    const x = Math.round(12 + u * (W - 24) + rng.range(-6, 6));
    const yc = H / 2 + (W / 2 - x) / 2;
    const y = Math.round(yc + rng.range(-H * 0.36, H * 0.36));
    if (y < 22 || y > H - 4) {
      n--;
      continue;
    }
    const r = rng.next();
    if (r < 0.05) add(v, x, y, 'idle', 'se', false);
    else if (r < 0.1 && v.kit.attack !== 'none') add(v, x, y, 'attack', 'se', rng.chance(0.5));
    else if (r < 0.16) add(v, x, y, 'run', 'se', true);
    else if (r < 0.2) add(v, x, y, 'walk', 'ne', rng.chance(0.5));
    else add(v, x, y, 'walk', 'se', rng.chance(0.8));
  }
  // A few casualties and Breta with her paparazzi.
  for (let k = 0; k < 4; k++) add(next(rng.pick(['student', 'woke', 'mob'] as const)), rng.int(30, W - 30), rng.int(40, H - 20), k % 2 ? 'ko' : 'die', 'se', rng.chance(0.5));
  const bx = Math.round(W * 0.42);
  const by = Math.round(H * 0.62);
  add(rollVariant('breta', 0, { city }), bx, by, 'walk', 'se', true);
  for (let k = 0; k < 6; k++) {
    const pv = rollVariant('paparazzi', k, { seed: opts.seed, city });
    const ang = (k / 6) * Math.PI * 2;
    add(pv, bx + Math.round(Math.cos(ang) * 16), by + Math.round(Math.sin(ang) * 8), k % 3 === 0 ? 'flash' : 'walk', 'se', Math.cos(ang) > 0);
  }
  actors.sort((a, b) => a.y - b.y || a.x - b.x);

  const bg = roadBackground(W, H);
  const out: PixelBuffer[] = [];
  for (let f = 0; f < F; f++) {
    const frame = createBuffer(W, H);
    frame.data.set(bg.data);
    for (const a of actors) {
      const fi = Math.floor((f + a.phase) / a.hold) % a.frames.length;
      const img = a.frames[fi]!;
      blitOver(frame, img, a.x - a.anchor.x, a.y - a.anchor.y);
    }
    out.push(frame);
  }
  return out;
}

/** Blit with shadow pixels darkening the background by switching to the next-darker road tone. */
function blitOver(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number): void {
  const shadowOn = new Map<number, number>([
    [resolveColor('gray2') >>> 8, resolveColor('gray1')],
    [resolveColor('gray3') >>> 8, resolveColor('gray2')],
    [resolveColor('gray1') >>> 8, resolveColor('ink')],
    [resolveColor('gray6') >>> 8, resolveColor('gray4')],
  ]);
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.w) continue;
      const si = (y * src.w + x) * 4;
      const a = src.data[si + 3]!;
      if (a === 0) continue;
      const di = (ty * dst.w + tx) * 4;
      if (a < 255) {
        const rgb = (dst.data[di]! << 16) | (dst.data[di + 1]! << 8) | dst.data[di + 2]!;
        const c = shadowOn.get(rgb);
        if (c !== undefined) {
          dst.data[di] = (c >>> 24) & 255;
          dst.data[di + 1] = (c >>> 16) & 255;
          dst.data[di + 2] = (c >>> 8) & 255;
        }
        continue;
      }
      dst.data[di] = src.data[si]!;
      dst.data[di + 1] = src.data[si + 1]!;
      dst.data[di + 2] = src.data[si + 2]!;
      dst.data[di + 3] = 255;
    }
  }
}

/** Nearest-neighbour upscale of a crop (review crops only). */
export function cropScale(src: PixelBuffer, x: number, y: number, w: number, h: number, s: number): PixelBuffer {
  const out = createBuffer(w * s, h * s);
  for (let yy = 0; yy < h * s; yy++) {
    for (let xx = 0; xx < w * s; xx++) {
      const sx = x + Math.floor(xx / s);
      const sy = y + Math.floor(yy / s);
      const si = (sy * src.w + sx) * 4;
      const di = (yy * out.w + xx) * 4;
      for (let c = 0; c < 4; c++) out.data[di + c] = src.data[si + c]!;
    }
  }
  return out;
}

export { blit };
