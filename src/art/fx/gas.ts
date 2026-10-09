/**
 * Tear gas: layered cartoon puffs (4 variants × grow / linger / dissipate), the canister
 * (spin) and its smoke trail. A gas cloud = 6–12 puffs of mixed variants with random offsets,
 * each started with a random delay; see docs/art/M5.md.
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, paintLobes, prng, px, type Lobe } from './draw';

/** Gas ramp: outline, shadow, body, light, spec. */
export const GAS_RAMP = ['olive1', 'olive2', 'green4', 'lime', 'stone5'] as const;

/** Lobe layouts (relative to the puff centre), back lobes first. */
const LAYOUTS: Record<string, Lobe[]> = {
  a: [
    { x: -1, y: -3.5, r: 5.5 },
    { x: -5.5, y: 0.5, r: 4.5 },
    { x: 5, y: -0.5, r: 5 },
    { x: 0.5, y: 2, r: 5 },
  ],
  b: [
    { x: 2, y: -4, r: 4.5 },
    { x: -3.5, y: -2, r: 5 },
    { x: 6.5, y: 1, r: 4 },
    { x: -6.5, y: 2.5, r: 3.5 },
    { x: 1, y: 2.5, r: 5 },
  ],
  c: [
    { x: -2.5, y: -3, r: 4.5 },
    { x: 3.5, y: -2, r: 4 },
    { x: -5, y: 2, r: 3.5 },
    { x: 1, y: 1.5, r: 4.5 },
  ],
  d: [
    { x: 0, y: -4.5, r: 4 },
    { x: -4.5, y: -1, r: 4.5 },
    { x: 4.5, y: -1.5, r: 4.5 },
    { x: -1.5, y: 2.5, r: 4.5 },
    { x: 5, y: 3, r: 3 },
  ],
};

export const GAS_PUFF_VARIANTS = Object.keys(LAYOUTS);
const W = 28;
const H = 22;
const CX = 14;
const CY = 12;

function frame(lobes: readonly Lobe[]): PixelBuffer {
  const b = buf(W, H);
  paintLobes(b, lobes, { ramp: GAS_RAMP, outlineLit: 'olive2', creases: false, spec: 'one' });
  return b;
}

function place(l: Lobe, s: number, dx = 0, dy = 0, dr = 0): Lobe {
  return { x: CX + l.x * s + dx, y: CY + l.y * s + dy, r: Math.max(0.9, l.r * s + dr) };
}

function puffFrames(variant: string): { grow: PixelBuffer[]; loop: PixelBuffer[]; fade: PixelBuffer[] } {
  const L = LAYOUTS[variant]!;
  const rnd = prng(variant.charCodeAt(0) * 977);
  // Grow: pops out of a small kernel with a little overshoot.
  const grow = [0.35, 0.7, 1.06].map((s, i) =>
    frame(L.map((l) => place(l, s, 0, (2 - i) * 1.2))),
  );
  // Linger: lobes breathe out of phase (±0.5 px) and drift a pixel — a slow boil.
  const phases = L.map(() => rnd() * Math.PI * 2);
  const loop = [0, 1, 2, 3].map((f) =>
    frame(
      L.map((l, i) => {
        const a = (f / 4) * Math.PI * 2 + phases[i]!;
        return place(l, 1, Math.round(Math.cos(a) * 0.6), Math.round(Math.sin(a) * 0.6), Math.sin(a) * 0.5);
      }),
    ),
  );
  // Dissipate: the cluster breaks apart — lobes drift outward and up, shrink, then wisp out.
  const fade = [0, 1, 2, 3].map((f) => {
    const spread = [0.5, 1.4, 2.6, 3.8][f]!;
    const shrink = [0.4, 1.3, 2.3, 3.1][f]!;
    const lobes = L.map((l) => {
      const len = Math.hypot(l.x, l.y) || 1;
      return {
        x: CX + l.x + (l.x / len) * spread,
        y: CY + l.y + (l.y / len) * spread * 0.6 - f * 1.5,
        r: Math.max(0.9, l.r - shrink - (rnd() < 0.3 ? 0.5 : 0)),
      };
    }).filter((l, i) => f < 3 || l.r > 1.4 || i % 2 === 0);
    return frame(lobes);
  });
  return { grow, loop, fade };
}

/** Spinning canister (5×5 frames): metal tube, green band, smoking nozzle. */
function canisterFrames(): PixelBuffer[] {
  const shapes = [
    // [x,y,ref][] per frame — tiny hand-placed rotations: horizontal, diag, vertical, diag.
    ['.ooo.', 'oZGzo', '.ooo.'],
    ['..oo.', '.oGzo', 'oZGo.', '.oo..'],
    ['.o.', 'oZo', 'oGo', 'ozo', '.o.'],
    ['.oo..', 'oZGo.', '.oGzo', '..oo.'],
  ];
  const K: Record<string, string> = { o: 'ink', Z: 'zinc4', z: 'zinc2', G: 'green3' };
  return shapes.map((rows) => {
    const b = buf(7, 7);
    const ox = Math.floor((7 - rows[0]!.length) / 2);
    const oy = Math.floor((7 - rows.length) / 2);
    rows.forEach((r, y) => [...r].forEach((k, x) => k !== '.' && px(b, ox + x, oy + y, K[k]!)));
    return b;
  });
}

/** Trail puff behind the flying canister: 4 frames, small → bigger → fading wisp. */
function trailFrames(): PixelBuffer[] {
  const sets: Lobe[][] = [
    [{ x: 4.5, y: 4.5, r: 1.6 }],
    [
      { x: 4, y: 4.5, r: 2.2 },
      { x: 5.5, y: 4, r: 1.6 },
    ],
    [
      { x: 3.5, y: 4, r: 2.6 },
      { x: 5.8, y: 3.5, r: 2 },
    ],
    [
      { x: 3.5, y: 3, r: 1.8 },
      { x: 6, y: 2.5, r: 1.3 },
    ],
  ];
  return sets.map((lobes) => {
    const b = buf(10, 9);
    paintLobes(b, lobes, { ramp: GAS_RAMP, outlineLit: 'olive2' });
    return b;
  });
}

export interface PuffPlacement {
  dx: number;
  dy: number;
  variant: string;
  /** Start delay in seconds (stagger the grow anims). */
  delay: number;
}

/**
 * Organic gas-cloud layout: `n` puffs (6–12) scattered in an iso ellipse of radius `rx`
 * (ry = rx/2), back puffs first (draw in this order), mixed variants and staggered delays.
 */
export function gasCloudLayout(seed: number, n = 9, rx = 36): PuffPlacement[] {
  const rnd = prng(seed);
  const out: PuffPlacement[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = i === 0 ? 0 : Math.sqrt(rnd()) * 0.85;
    out.push({
      dx: Math.round(Math.cos(a) * rx * d),
      dy: Math.round(Math.sin(a) * rx * 0.5 * d),
      variant: GAS_PUFF_VARIANTS[Math.floor(rnd() * GAS_PUFF_VARIANTS.length)]!,
      delay: Math.round((d * 0.5 + rnd() * 0.25) * 100) / 100,
    });
  }
  return out.sort((p, q) => p.dy - q.dy);
}

export function registerGas(reg: SpriteRegistry): void {
  const anchor = { x: CX, y: CY + 6 };
  for (const v of GAS_PUFF_VARIANTS) {
    const f = puffFrames(v);
    reg.add(`fx.gas.puff.${v}.grow`, { group: 'fx', frames: f.grow, fps: 10, loop: false, anchor });
    reg.add(`fx.gas.puff.${v}.loop`, { group: 'fx', frames: f.loop, fps: 5, anchor });
    reg.add(`fx.gas.puff.${v}.fade`, { group: 'fx', frames: f.fade, fps: 8, loop: false, anchor });
  }
  reg.add('fx.gas.canister', { group: 'fx', frames: canisterFrames(), fps: 16, anchor: { x: 3, y: 3 } });
  reg.add('fx.gas.trail', { group: 'fx', frames: trailFrames(), fps: 12, loop: false, anchor: { x: 4, y: 4 } });
}
