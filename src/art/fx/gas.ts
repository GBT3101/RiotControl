/**
 * Tear gas: drifting vapour puffs (4 variants × grow / linger / dissipate), the canister
 * (spin) and its smoke trail. A gas cloud = 6–12 puffs of mixed variants with random offsets,
 * each started with a random delay; see docs/art/M5.md.
 *
 * M13a redesign — gas must read as see-through vapour, not a bunch of solid grapes:
 *  - no dark exterior outline; flattened, ground-hugging billows merged into one soft body
 *    with a scalloped crown,
 *  - a pale lime rim on the lit (upper-left) edges, a cool green3 belly line underneath,
 *  - short interior swirl strokes where billows overlap (no per-lobe crescents / creases),
 *  - authored tears through the body (the ground shows through — layered puffs look
 *    translucent), widening as the puff dissipates,
 *  - 1-px wisps curling off the crown and the downwind side, 4 curl phases.
 * Variants vary in size: a large, b medium tall, c small scrap, d long low streak.
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, has, prng, px } from './draw';

/** Gas ramp: belly, deep, body, light, glint. */
export const GAS_RAMP = ['olive2', 'green3', 'green4', 'lime', 'stone5'] as const;

/** Flattened billow (ellipse) relative to the puff centre. */
interface Billow {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Authored tears (# = see-through), placed by their top-left pixel relative to the centre. */
const TEARS: readonly (readonly string[])[] = [
  ['.###', '###.'],
  ['##.', '.##'],
  ['.##', '##.'],
  ['###'],
  ['.##.', '####', '.##.'],
];

/** Wisps (G green4 root, L lime tip): 4 curl phases; the bottom-left pixel is the root. */
const WISPS: readonly (readonly (readonly string[])[])[] = [
  // Up-right curl off the crown.
  [
    ['..L', '.L.', 'G..'],
    ['.LL', 'G..', 'G..'],
    ['LL.', '..L', '.G.'],
    ['..L', 'GL.', 'G..'],
  ],
  // Rightward trailing streamer off the downwind side.
  [
    ['GGL.', '...L'],
    ['GGLL', '....'],
    ['GL..', '..LL'],
    ['GGL.', '...L'],
  ],
  // Small left lick.
  [
    ['L.', '.G'],
    ['LG', '..'],
    ['L.', 'LG'],
    ['.L', 'LG'],
  ],
];
const WISP_KEYS: Record<string, string> = { L: 'lime', G: 'green4' };

interface Tear {
  k: number;
  x: number;
  y: number;
}
interface Wisp {
  k: number;
  x: number;
  y: number;
}

interface PuffDef {
  billows: Billow[];
  tears: Tear[];
  wisps: Wisp[];
}

const PUFFS: Record<string, PuffDef> = {
  // Large rolling billow, leaning downwind (right); an arch at the base.
  a: {
    billows: [
      { x: -7.5, y: 1, rx: 4, ry: 3.5 },
      { x: -3, y: -3, rx: 5, ry: 4.5 },
      { x: 3, y: -4, rx: 4.5, ry: 4 },
      { x: 7, y: -0.5, rx: 4.5, ry: 4 },
      { x: 10.5, y: 2.5, rx: 3, ry: 2 },
      { x: -1.5, y: 1.5, rx: 6.5, ry: 3.5 },
      { x: 4.5, y: 2, rx: 5, ry: 3 },
    ],
    tears: [{ k: 4, x: 0, y: 3 }],
    wisps: [
      { k: 0, x: 7, y: -6 },
      { k: 1, x: 13, y: 2 },
      { k: 2, x: -13, y: 0 },
    ],
  },
  // Medium, tall-crowned.
  b: {
    billows: [
      { x: -5, y: 0, rx: 4, ry: 3.5 },
      { x: -0.5, y: -3.5, rx: 4.5, ry: 4 },
      { x: 4.5, y: -1.5, rx: 4, ry: 3.5 },
      { x: 7.5, y: 2, rx: 3, ry: 2 },
      { x: 0.5, y: 2, rx: 6, ry: 3 },
    ],
    tears: [{ k: 1, x: 3, y: 3 }],
    wisps: [
      { k: 0, x: 3, y: -7 },
      { k: 1, x: 10, y: 2 },
    ],
  },
  // Small scrap.
  c: {
    billows: [
      { x: -2.5, y: -1, rx: 3.5, ry: 3 },
      { x: 2.5, y: -1.5, rx: 3.5, ry: 3 },
      { x: 0, y: 1.5, rx: 5, ry: 2.5 },
    ],
    tears: [],
    wisps: [
      { k: 1, x: 5, y: 2 },
      { k: 2, x: -7, y: -1 },
    ],
  },
  // Long low streak hugging the ground.
  d: {
    billows: [
      { x: -8.5, y: 1.5, rx: 3.5, ry: 2.5 },
      { x: -4, y: -1.5, rx: 4.5, ry: 3.5 },
      { x: 1.5, y: -1, rx: 4, ry: 3 },
      { x: 6.5, y: 0, rx: 4, ry: 3 },
      { x: 11.5, y: 2, rx: 3, ry: 1.8 },
      { x: 0.5, y: 2.5, rx: 9.5, ry: 2 },
    ],
    tears: [{ k: 3, x: -3, y: 3 }],
    wisps: [
      { k: 0, x: -5, y: -5 },
      { k: 1, x: 14, y: 2 },
    ],
  },
};

export const GAS_PUFF_VARIANTS = Object.keys(PUFFS);
const W = 34;
const H = 24;
const CX = 16;
const CY = 13;

function inB(x: number, y: number, b: Billow): boolean {
  if (b.rx < 0.6 || b.ry < 0.5) return false;
  const dx = (x + 0.5 - b.x) / b.rx;
  const dy = (y + 0.5 - b.y) / b.ry;
  return dx * dx + dy * dy <= 1;
}

interface PlacedTear {
  k: number;
  x: number;
  y: number;
  /** Extra see-through ellipse (dissipation), radius 0 = none. */
  r: number;
}
interface PlacedWisp {
  k: number;
  x: number;
  y: number;
  phase: number;
}

/** Paint one gas frame (absolute coordinates). */
function paintGas(
  billows: readonly Billow[],
  tears: readonly PlacedTear[],
  wisps: readonly PlacedWisp[],
): PixelBuffer {
  const b = buf(W, H);
  const m = new Uint8Array(W * H);
  const hole = new Uint8Array(W * H);
  const front = new Int8Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      billows.forEach((bl, i) => {
        if (inB(x, y, bl)) front[y * W + x] = i;
      });
      if (front[y * W + x]! >= 0) m[y * W + x] = 1;
    }
  }
  for (const t of tears) {
    const rows = TEARS[t.k]!;
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const x = Math.round(t.x) + i;
        const y = Math.round(t.y) + j;
        if (k === '#' && x >= 0 && y >= 0 && x < W && y < H) hole[y * W + x] = 1;
      }),
    );
    if (t.r > 0) {
      const w = rows[0]!.length;
      const e = {
        x: Math.round(t.x) + w / 2,
        y: Math.round(t.y) + rows.length / 2,
        rx: t.r,
        ry: t.r * 0.6,
      };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inB(x, y, e)) hole[y * W + x] = 1;
    }
  }
  for (let i = 0; i < W * H; i++) if (hole[i]) m[i] = 0;
  const on = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
  // Drop 1-px bridges, then any scrap smaller than 6 px (clean clusters, never noise).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      const n = +on(x - 1, y) + +on(x + 1, y) + +on(x, y - 1) + +on(x, y + 1);
      if (n <= 1) m[y * W + x] = 0;
    }
  }
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!m[i] || seen[i]) continue;
    const comp: number[] = [i];
    seen[i] = 1;
    for (let q = 0; q < comp.length; q++) {
      const c = comp[q]!;
      const cx = c % W;
      const cy = (c - cx) / W;
      for (const [nx, ny] of [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ] as const) {
        const j = ny * W + nx;
        if (on(nx, ny) && !seen[j]) {
          seen[j] = 1;
          comp.push(j);
        }
      }
    }
    if (comp.length < 6) for (const c of comp) m[c] = 0;
  }
  const isHole = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && hole[y * W + x] === 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      let ref = 'green4';
      const up = !on(x, y - 1);
      const left = !on(x - 1, y);
      const down = !on(x, y + 1);
      if (isHole(x, y - 1))
        ref = 'lime'; // lit far wall of a tear
      else if (isHole(x, y + 1))
        ref = 'green3'; // shaded near wall
      else if (down) ref = 'green3';
      else if (up || left) ref = 'lime';
      else if (!on(x, y - 2) || (!on(x - 1, y - 1) && !on(x - 2, y)))
        ref = 'lime'; // 2-px crown rim
      else if (!on(x, y - 3) && !on(x - 1, y - 2)) ref = 'lime'; // thicker on the sunny side
      px(b, x, y, ref);
    }
  }
  // Interior swirls: a short lit arc on the upper-left of each front billow, inside the body.
  billows.forEach((bl, i) => {
    if (i === 0 || bl.rx < 3.5 || bl.y > CY) return; // crown billows only
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (front[y * W + x] !== i || !on(x, y)) continue;
        const nx = (x + 0.5 - bl.x) / bl.rx;
        const ny = (y + 0.5 - bl.y) / bl.ry;
        const r = Math.hypot(nx, ny);
        const a = Math.atan2(ny, nx);
        if (r < 0.7 || a > -1.7 || a < -2.8) continue;
        // Only where the billow's rim lies inside the body (it overlaps a back billow).
        if (!on(x - 1, y - 1) || !on(x, y - 1) || !on(x - 1, y) || !on(x + 1, y + 1)) continue;
        if (inB(x - 1, y - 1, bl)) continue;
        px(b, x, y, 'lime');
      }
    }
  });
  // Wisps curl off the body (strokes only fill empty pixels).
  for (const w of wisps) {
    const rows = WISPS[w.k]![w.phase & 3]!;
    const y0 = Math.round(w.y) - rows.length + 1;
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        if (k === '.') return;
        const xx = Math.round(w.x) + i;
        const yy = y0 + j;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || has(b, xx, yy)) return;
        px(b, xx, yy, WISP_KEYS[k]!);
      }),
    );
  }
  return b;
}

function at(bl: Billow, s: number, dx = 0, dy = 0, dr = 0): Billow {
  return {
    x: CX + bl.x * s + dx,
    y: CY + bl.y * s + dy,
    rx: Math.max(0, bl.rx * s + dr),
    ry: Math.max(0, bl.ry * 1.15 * s + dr * 0.7),
  };
}

function puffFrames(variant: string): {
  grow: PixelBuffer[];
  loop: PixelBuffer[];
  fade: PixelBuffer[];
} {
  const P = PUFFS[variant]!;
  const rnd = prng(variant.charCodeAt(0) * 977);
  const wispAt = (f: number, s = 1, lift = 0): PlacedWisp[] =>
    P.wisps.map((w, i) => ({ k: w.k, phase: f + i, x: CX + w.x * s, y: CY + w.y * s - lift }));
  const tearAt = (dx: number, dy: number, r = 0): PlacedTear[] =>
    P.tears.map((t) => ({ k: t.k, x: CX + t.x + dx, y: CY + t.y + dy, r }));
  // Grow: rolls out of a small kernel (tears open on the last frame), slight overshoot.
  const grow = [0.4, 0.72, 1.06].map((s, i) =>
    paintGas(
      P.billows.map((b) => at(b, s, 0, (2 - i) * 1.2)),
      i < 2 ? [] : tearAt(0, 0),
      i < 2 ? [] : wispAt(0, s),
    ),
  );
  // Linger: billows breathe out of phase, tears wander a pixel, wisps curl.
  const phases = P.billows.map(() => rnd() * Math.PI * 2);
  const loop = [0, 1, 2, 3].map((f) => {
    const t = (f / 4) * Math.PI * 2;
    return paintGas(
      P.billows.map((b, i) => {
        const a = t + phases[i]!;
        return at(
          b,
          1,
          Math.round(Math.cos(a) * 0.7),
          Math.round(Math.sin(a) * 0.5),
          Math.sin(a) * 0.5,
        );
      }),
      tearAt([0, 1, 1, 0][f]!, [0, 0, -1, 0][f]!),
      wispAt(f),
    );
  });
  // Dissipate: tears widen and rip the body apart, billows thin and lift, wisps trail off.
  const fade = [0, 1, 2, 3].map((f) => {
    const shrink = [0.5, 1.3, 2.3, 3.2][f]!;
    const spread = [0.6, 1.5, 2.6, 3.6][f]!;
    const billows = P.billows.map((b) => {
      const len = Math.hypot(b.x, b.y) || 1;
      return {
        x: CX + b.x + (b.x / len) * spread,
        y: CY + b.y + (b.y / len) * spread * 0.5 - f * 1.4,
        rx: Math.max(0, b.rx - shrink),
        ry: Math.max(0, b.ry * 1.15 - shrink * 0.75),
      };
    });
    const tears = P.tears.length
      ? tearAt(0, -f * 1.4, 1 + f * 1.2)
      : [{ k: 1, x: CX - 1, y: CY - f * 1.4, r: f * 1.2 }];
    return paintGas(billows, tears, wispAt(f + 1, 1 + f * 0.15, f * 2));
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

/** Trail puff behind the flying canister: 4 frames, small → bigger (torn) → fading wisp. */
const TRAIL = `
  ..........  ..........  ..........  .....L....
  ..........  ..........  ....LL.LL.  ..LL..L...
  ..........  .....LL...  ..LLGGLGGL  .LG..LGL..
  ....LL....  ...LLGGL..  .LGGG..GGG  .G...GGG..
  ...LGG....  ..LGGGGG..  .GGGGLGGGD  ..D...D...
  ...GGD....  ..GGGGGD..  ..DGGGGDD.  ..........
  ....DD....  ...DDDD...  ...DDD....  ..........
  ..........  ..........  ..........  ..........
  ..........  ..........  ..........  ..........`;

function trailFrames(): PixelBuffer[] {
  const K: Record<string, string> = { L: 'lime', G: 'green4', D: 'green3' };
  const rows = TRAIL.split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  return [0, 1, 2, 3].map((f) => {
    const b = buf(10, 9);
    rows.forEach((r, y) => {
      const cells = r.split(/\s+/)[f]!;
      [...cells].forEach((k, x) => k !== '.' && px(b, x, y, K[k]!));
    });
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
 * Organic gas-cloud layout: `n` puffs (6–12) scattered loosely in an iso ellipse of radius
 * `rx` (ry = rx/2), back puffs first (draw in this order). Big billows (a, b) sit near the
 * middle, small scraps (c) and low streaks (d) fray the edges; puffs keep a minimum spacing
 * (best of a few candidates) so the cloud reads as drifting layers, not one heap. Staggered
 * delays (the middle blooms first).
 */
export function gasCloudLayout(seed: number, n = 9, rx = 36): PuffPlacement[] {
  const rnd = prng(seed);
  const out: PuffPlacement[] = [];
  const pick = (d: number): string => {
    const r = rnd();
    if (d < 0.45) return r < 0.55 ? 'a' : 'b';
    if (d < 0.75) return r < 0.4 ? 'b' : r < 0.7 ? 'd' : 'a';
    return r < 0.55 ? 'c' : 'd';
  };
  for (let i = 0; i < n; i++) {
    let best = { dx: 0, dy: 0, d: 0, score: -1 };
    for (let tries = 0; tries < (i === 0 ? 1 : 4); tries++) {
      const a = rnd() * Math.PI * 2;
      const d = i === 0 ? 0 : 0.2 + Math.sqrt(rnd()) * 0.68;
      const dx = Math.round(Math.cos(a) * rx * d);
      const dy = Math.round(Math.sin(a) * rx * 0.5 * d);
      let score = 1e9;
      for (const p of out) score = Math.min(score, Math.hypot(p.dx - dx, (p.dy - dy) * 2));
      if (score > best.score) best = { dx, dy, d, score };
    }
    out.push({
      dx: best.dx,
      dy: best.dy,
      variant: pick(best.d),
      delay: Math.round((best.d * 0.5 + rnd() * 0.25) * 100) / 100,
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
  reg.add('fx.gas.canister', {
    group: 'fx',
    frames: canisterFrames(),
    fps: 16,
    anchor: { x: 3, y: 3 },
  });
  reg.add('fx.gas.trail', {
    group: 'fx',
    frames: trailFrames(),
    fps: 12,
    loop: false,
    anchor: { x: 4, y: 4 },
  });
}
