/**
 * Fire: molotov bottle (spin), shatter burst, ground fire patches (small / medium loops),
 * burning-person flicker overlay, and a tiny standalone flame.
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, ellipse, ellipseRing, has, paintFlames, prng, px, rect, type Tongue } from './draw';

const BOTTLE = ['..n..', '..n..', '.gGg.', 'gGLGg', 'gGLGg', 'gGLGg', 'gGGGg', '.ggg.'];
const BK: Record<string, string> = { n: 'green2', g: 'green1', G: 'green3', L: 'lime' };

function rot90(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0]!.length;
  const out: string[] = [];
  for (let x = 0; x < w; x++) {
    let r = '';
    for (let y = h - 1; y >= 0; y--) r += rows[y]![x]!;
    out.push(r);
  }
  return out;
}

/** Molotov bottle spinning in flight: 4 frames (0°, 90°, 180°, 270°), burning rag on top. */
function bottleFrames(): PixelBuffer[] {
  const S = 13;
  let rows = BOTTLE;
  const out: PixelBuffer[] = [];
  // Rag tip (the neck's first pixel) per rotation, relative to the grid.
  for (let f = 0; f < 4; f++) {
    const b = buf(S, S);
    const ox = Math.floor((S - rows[0]!.length) / 2);
    const oy = Math.floor((S - rows.length) / 2) + 1;

    rows.forEach((r, y) =>
      [...r].forEach((k, x) => {
        if (k === '.') return;
        px(b, ox + x, oy + y, BK[k]!);
      }),
    );
    // Neck tip position per rotation.
    const tips = [
      { x: 2, y: 0 },
      { x: rows[0]!.length - 1, y: 2 },
      { x: 2, y: rows.length - 1 },
      { x: 0, y: 2 },
    ];
    const tip = { x: ox + tips[f]!.x, y: oy + tips[f]!.y };
    // Outline the glass.
    const glass = new Set<number>();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (has(b, x, y)) glass.add(y * S + x);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (glass.has(y * S + x)) continue;
        if (
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => glass.has((y + dy!) * S + x + dx!) && x + dx! >= 0 && x + dx! < S)
        ) {
          px(b, x, y, 'ink');
        }
      }
    }
    // Rag + flame (always licks upward, trailing).
    px(b, tip.x, tip.y, 'stone4');
    const fy = tip.y - 1;
    px(b, tip.x, fy, 'ochre3');
    px(b, tip.x, fy - 1, f % 2 ? 'ochre2' : 'rust3');
    px(b, tip.x - 1, fy, 'rust3');
    if (f % 2 === 0) px(b, tip.x + 1, fy - 2, 'rust3');
    else px(b, tip.x - 1, fy - 2, 'rust3');
    out.push(b);
    rows = rot90(rows);
  }
  return out;
}

function flameTongues(
  seed: number,
  n: number,
  cx: number,
  baseY: number,
  rx: number,
  ry: number,
  hMin: number,
  hMax: number,
  wMin: number,
): Array<Tongue & { base: number }> {
  const rnd = prng(seed);
  const ts: Array<Tongue & { base: number }> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const d = i === 0 ? 0 : 0.35 + rnd() * 0.6;
    const x = cx + Math.cos(a) * rx * d;
    const y = baseY + Math.sin(a) * ry * d;
    const centre = 1 - d * 0.55;
    const h = hMin + (hMax - hMin) * centre * (0.7 + rnd() * 0.3);
    ts.push({
      x,
      y: Math.round(y),
      w: wMin + rnd() * 2 + centre * 3,
      h,
      base: h,
      lean: 0,
      wob: 0.8,
      ph: rnd() * 6.28,
    });
  }
  // Back tongues first so front ones overlap.
  return ts.sort((p, q) => p.y - q.y);
}

/** Looping ground fire patch with a scorched bed and rising embers. */
function firePatch(
  W: number,
  H: number,
  rx: number,
  ry: number,
  n: number,
  hMax: number,
  seed: number,
): PixelBuffer[] {
  const cx = W / 2;
  const by = H - ry - 1;
  const ts = flameTongues(
    seed,
    n,
    cx,
    by,
    rx * 0.75,
    ry * 0.7,
    hMax * 0.3,
    hMax,
    Math.max(3, rx * 0.32),
  );
  const rnd = prng(seed + 5);
  const embers = Array.from({ length: 4 }, () => ({ x: cx + (rnd() - 0.5) * rx * 1.4, ph: rnd() }));
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 6; f++) {
    const b = buf(W, H);
    // Scorched bed: dark ellipse with glowing rim cracks.
    ellipse(b, cx, by + 0.5, rx, ry, 'earth0');
    ellipse(b, cx, by + 0.5, rx - 2, ry - 1, 'rust0');
    ellipseRing(b, cx, by + 0.5, rx - 2, ry - 1, (x, y) =>
      (x * 3 + y * 5 + f) % 7 === 0 ? 'rust2' : null,
    );
    const a = (f / 6) * Math.PI * 2;
    const frame = ts.map((t, i) => ({
      ...t,
      h: t.base * (1 + 0.2 * Math.sin(a * (i % 2 ? 1 : 2) + t.ph!)),
      ph: t.ph! + a,
      lean: Math.sin(a + i) * 1.2,
    }));
    paintFlames(b, frame, 5);
    // Detached flame licks + embers rising.
    for (const e of embers) {
      const p = (e.ph + f / 6) % 1;
      const y = Math.round(by - hMax * 0.6 - p * hMax * 0.7);
      const x = Math.round(e.x + Math.sin(p * 6) * 1.5);
      if (y >= 0) px(b, x, y, p < 0.5 ? 'ochre3' : 'rust3');
    }
    frames.push(b);
  }
  return frames;
}

/** Flames wrapped around a standing human (~11×18): overlay drawn over the protester sprite. */
function burningOverlay(): PixelBuffer[] {
  const W = 17;
  const H = 24;
  const base: Tongue[] = [
    { x: 4.5, y: 14, w: 4, h: 8 },
    { x: 12.5, y: 13, w: 4, h: 9 },
    { x: 8.5, y: 15, w: 7, h: 15 },
    { x: 6.5, y: 21, w: 5, h: 7 },
    { x: 11, y: 21, w: 5, h: 8 },
  ];
  return [0, 1, 2, 3].map((f) => {
    const b = buf(W, H);
    const a = (f / 4) * Math.PI * 2;
    paintFlames(
      b,
      base.map((t, i) => ({
        ...t,
        h: t.h * (1 + 0.22 * Math.sin(a + i * 1.7)),
        wob: 0.8,
        ph: a + i,
        lean: i % 2 ? 1 : -1,
      })),
      4,
    );
    // Licks detaching from the top.
    const ty = 1 + (f % 2);
    px(b, 8 + (f === 1 ? 1 : f === 3 ? -1 : 0), ty, 'rust3');
    if (f % 2 === 0) px(b, 6, 5 - f, 'ochre3');
    return b;
  });
}

/** Molotov shatter: glass + a splash of fire that spreads into the patch. */
function shatter(): PixelBuffer[] {
  const W = 34;
  const H = 22;
  const cx = 17;
  const by = 16;
  const rnd = prng(77);
  const shards = Array.from({ length: 9 }, () => ({
    vx: (rnd() - 0.5) * 7,
    vy: -1.5 - rnd() * 3,
    k: Math.floor(rnd() * 3),
  }));
  return [0, 1, 2, 3, 4].map((f) => {
    const b = buf(W, H);
    const spread = [3, 7, 11, 13, 14][f]!;
    const hgt = [4, 9, 10, 9, 7][f]!;
    const ts: Tongue[] = [];
    const n = [2, 4, 6, 7, 7][f]!;
    for (let i = 0; i < n; i++) {
      const s = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      ts.push({
        x: cx + s * spread,
        y: by + Math.round(Math.abs(s) * 2 - (i % 2)),
        w: 4 + (1 - Math.abs(s)) * 4,
        h: hgt * (1 - Math.abs(s) * 0.5),
        lean: s * 3,
        wob: 0.6,
        ph: i,
      });
    }
    ts.sort((a, c) => a.y - c.y);
    if (f >= 2) ellipse(b, cx, by + 1.5, spread + 1, 3, 'rust0');
    paintFlames(b, ts, f === 0 ? 5 : 4);
    if (f === 0) {
      for (const [dx, dy] of [
        [0, -5],
        [-3, -3],
        [3, -3],
        [-4, 0],
        [4, 0],
        [0, -1],
        [-1, -2],
        [1, -2],
      ] as const)
        px(b, cx + dx, by + dy, dx === 0 || Math.abs(dy) === 2 ? 'white' : 'sky');
      rect(b, cx - 1, by - 1, 3, 2, 'green3');
      px(b, cx, by - 1, 'lime');
    }
    for (const s of shards) {
      const x = Math.round(cx + s.vx * (f + 1));
      const y = Math.round(by - 3 + s.vy * (f + 1) + 0.9 * (f + 1) * (f + 1));
      if (y < by + 3 && f < 4) px(b, x, y, ['sky', 'white', 'green3'][s.k]!);
    }
    return b;
  });
}

export function registerFire(reg: SpriteRegistry): void {
  reg.add('fx.molotov.bottle', {
    group: 'fx',
    frames: bottleFrames(),
    fps: 14,
    anchor: { x: 6, y: 7 },
  });
  reg.add('fx.molotov.shatter', {
    group: 'fx',
    frames: shatter(),
    fps: 14,
    loop: false,
    anchor: { x: 17, y: 17 },
  });
  const small = firePatch(22, 20, 9, 4, 5, 12, 3);
  reg.add('fx.fire.patch.small', { group: 'fx', frames: small, fps: 10, anchor: { x: 11, y: 15 } });
  const med = firePatch(36, 28, 15, 6.5, 8, 18, 9);
  reg.add('fx.fire.patch.medium', { group: 'fx', frames: med, fps: 10, anchor: { x: 18, y: 21 } });
  reg.add('fx.fire.burning', {
    group: 'fx',
    frames: burningOverlay(),
    fps: 12,
    anchor: { x: 8, y: 21 },
  });
  // Tiny flame (wreck spots, torches, rag): 4 frames.
  const tiny = [0, 1, 2, 3].map((f) => {
    const b = buf(7, 10);
    const a = (f / 4) * Math.PI * 2;
    paintFlames(b, [{ x: 3.5, y: 9, w: 4, h: 8 + Math.sin(a) * 1.5, wob: 0.7, ph: a }], 4);
    return b;
  });
  reg.add('fx.fire.tiny', { group: 'fx', frames: tiny, fps: 10, anchor: { x: 3, y: 9 } });
}
