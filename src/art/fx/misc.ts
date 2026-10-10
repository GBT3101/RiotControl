/**
 * Misc FX: helicopter rotor wash, water splash, level-up confetti, the "+1" Hate pickup (angry face),
 * the Legitimacy wax-seal stamp pop.
 */
import { grid } from '../lib/grid';
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, ellipse, ellipseRing, line, outlineBuf, prng, px, rect, stamp } from './draw';

/* Rotor wash ---------------------------------------------------------------- */

function rotorWash(): PixelBuffer[] {
  const W = 64;
  const H = 32;
  const cx = W / 2;
  const cy = H / 2;
  const F = 6;
  const streakAngles = [0.3, 1.1, 1.9, 2.6, 3.5, 4.3, 5.0, 5.8];
  return Array.from({ length: F }, (_, f) => {
    const b = buf(W, H);
    for (const ring of [0, 0.5]) {
      const p = (f / F + ring) % 1;
      const r = 9 + p * 21;
      const c = p < 0.45 ? 'stone4' : p < 0.8 ? 'stone3' : 'stone2';
      // Long arcs with three gaps that rotate as the ring expands.
      ellipseRing(b, cx, cy, r, r * 0.5, (_x, _y, a) =>
        Math.sin(a * 3 + p * 4) > -0.55 ? c : null,
      );
    }
    // A few dust streaks blown outward, staggered.
    streakAngles.forEach((a, i) => {
      const p = (f / F + i * 0.37) % 1;
      const r0 = 12 + p * 16;
      line(
        b,
        cx + Math.cos(a) * r0,
        cy + Math.sin(a) * r0 * 0.5,
        cx + Math.cos(a) * (r0 + 4),
        cy + Math.sin(a) * (r0 + 4) * 0.5,
        p < 0.5 ? 'stone5' : 'stone3',
      );
    });
    return b;
  });
}

/* Water splash -------------------------------------------------------------- */

function splash(): PixelBuffer[] {
  const W = 25;
  const H = 22;
  const cx = 12;
  const by = 17;
  const rnd = prng(5);
  const drops = Array.from({ length: 9 }, () => ({
    vx: (rnd() - 0.5) * 3,
    vy: -2.6 - rnd() * 1.6,
  }));
  return [0, 1, 2, 3, 4, 5].map((f) => {
    const b = buf(W, H);
    // Ripple rings.
    if (f >= 1)
      ellipseRing(
        b,
        cx + 0.5,
        by + 0.5,
        3 + f * 1.6,
        (3 + f * 1.6) * 0.45,
        f < 4 ? 'sky' : 'blue2',
      );
    if (f >= 3)
      ellipseRing(b, cx + 0.5, by + 0.5, 2 + (f - 3) * 1.6, (2 + (f - 3) * 1.6) * 0.45, 'blue2');
    // Crown column (frames 0-2).
    const ch = [5, 8, 5, 2, 0, 0][f]!;
    for (let i = 0; i < ch; i++) {
      const w = i < ch - 2 ? 2 : 1;
      rect(b, cx - w + 1, by - i, w * 2 - 1, 1, i > ch - 3 ? 'white' : 'sky');
      if (w === 2) px(b, cx + 1, by - i, 'blue2');
    }
    for (const d of drops) {
      const t = f + 0.7;
      const x = Math.round(cx + d.vx * t);
      const y = Math.round(by - 2 + d.vy * t + 0.55 * t * t);
      if (y <= by && f > 0) {
        px(b, x, y, f < 3 ? 'white' : 'sky');
        if (f < 3) px(b, x, y + 1, 'blue2');
      }
    }
    return b;
  });
}

/* Confetti ----------------------------------------------------------------- */

const CONFETTI_COLOURS = [
  'crim2',
  'hivis2',
  'blue2',
  'lime',
  'pink2',
  'ochre3',
  'white',
  'teal2',
  'lilac',
];

function confettiPiece(b: PixelBuffer, x: number, y: number, c: string, spin: number): void {
  x = Math.round(x);
  y = Math.round(y);
  switch (spin % 4) {
    case 0:
      rect(b, x, y, 3, 2, c);
      break;
    case 1:
      rect(b, x, y, 2, 2, c);
      break;
    case 2:
      rect(b, x, y, 1, 2, c);
      break;
    default:
      rect(b, x, y, 2, 1, c);
  }
}

function confettiLoop(): PixelBuffer[] {
  const W = 48;
  const H = 56;
  const F = 8;
  const rnd = prng(23);
  const pieces = Array.from({ length: 22 }, (_, i) => ({
    x: rnd() * (W - 4),
    ph: rnd(),
    c: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]!,
    sp: Math.floor(rnd() * 4),
    sway: 1 + rnd() * 2,
  }));
  return Array.from({ length: F }, (_, f) => {
    const b = buf(W, H);
    for (const p of pieces) {
      const t = (p.ph + f / F) % 1;
      confettiPiece(
        b,
        p.x + Math.sin(t * Math.PI * 4 + p.ph * 6) * p.sway,
        t * (H - 3),
        p.c,
        p.sp + f,
      );
    }
    return b;
  });
}

function confettiBurst(): PixelBuffer[] {
  const W = 56;
  const H = 48;
  const rnd = prng(41);
  const pieces = Array.from({ length: 26 }, (_, i) => {
    const a = -Math.PI * (0.15 + rnd() * 0.7);
    const v = 8 + rnd() * 6;
    return {
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      c: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]!,
      sp: i % 4,
    };
  });
  return Array.from({ length: 8 }, (_, f) => {
    const b = buf(W, H);
    for (const p of pieces) {
      const t = f + 1;
      // Drag: velocity decays, gravity is gentle so paper floats.
      const k = (1 - Math.pow(0.72, t)) / 0.28;
      const x = W / 2 + p.vx * k;
      const y = H - 6 + p.vy * k + 0.3 * t * t;
      if (y < H - 1) confettiPiece(b, x, y, p.c, p.sp + f);
    }
    return b;
  });
}

/* Hate pickup: a tiny furious face huffing steam ------------------------ */

const ANGRY = `
  ..ooooo..
  .ohHRRRo.
  okkRRRkko
  oRkkRkkro
  oRwkRkwro
  oRRRRRrro
  oRkkkkkro
  .okRRrko.
  ..ooooo..
`;
const ANGRY_KEYS = {
  o: 'rust0',
  R: 'crim2',
  r: 'crim1',
  H: 'rust4',
  h: 'rust3',
  k: 'ink',
  w: 'white',
};

function hatePickup(): PixelBuffer[] {
  const face = grid(ANGRY, ANGRY_KEYS);
  // Steam puffs vent from the left temple and drift up and out ([x, y, colour] per frame);
  // the right side mirrors it.
  const left: Array<Array<[number, number, string]>> = [
    [[1, 2, 'gray7']],
    [
      [1, 2, 'gray7'],
      [0, 1, 'white'],
      [1, 1, 'white'],
    ],
    [
      [0, 1, 'gray7'],
      [0, 0, 'white'],
      [1, 0, 'gray7'],
    ],
    [[0, 0, 'gray7']],
  ];
  const steam = left.map((f) => [
    ...f,
    ...f.map(([x, y, c]): [number, number, string] => [10 - x, y, c]),
  ]);
  return steam.map((puffs) => {
    const b = buf(11, 11);
    stamp(b, face, 1, 1);
    for (const [x, y, c] of puffs) px(b, x, y, c);
    return b;
  });
}

/* Wax seal ------------------------------------------------------------------ */

/**
 * Gold wax seal: scalloped disc with banded upper-left light, embossed rim ring and a
 * "column" emblem (the Ministry's pillar of order). `sy` squashes vertically (impact frame).
 */
export function waxSeal(r: number, sy = 1, emblem = true): PixelBuffer {
  const S = Math.ceil(r * 2 + 4);
  const b = buf(S, S);
  const cx = S / 2;
  const cy = S / 2;
  const inSeal = (x: number, y: number, rr: number): boolean => {
    const dx = x + 0.5 - cx;
    const dy = (y + 0.5 - cy) / sy;
    const a = Math.atan2(dy, dx);
    const rad = rr + 0.7 * Math.cos(a * 9);
    return dx * dx + dy * dy <= rad * rad;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inSeal(x, y, r)) continue;
      const lit = !inSeal(x + 1, y + 1, r)
        ? 'ochre1'
        : !inSeal(x - 1, y - 1, r)
          ? 'ochre4'
          : 'ochre2';
      px(b, x, y, lit);
    }
  }
  // Embossed inner ring.
  ellipseRing(b, cx, cy, r * 0.62, r * 0.62 * sy, (x, y) =>
    x + y < cx + cy - 1 ? 'ochre1' : 'ochre3',
  );
  if (emblem && r >= 5) {
    // Tiny column: capital, shaft, base.
    const ex = Math.round(cx - 0.5);
    const ey = Math.round(cy - 0.5);
    const hh = Math.max(1, Math.round(r * 0.3 * sy));
    rect(b, ex - 1, ey - hh, 3, 1, 'earth3');
    rect(b, ex, ey - hh + 1, 1, hh * 2 - 1, 'earth3');
    rect(b, ex - 1, ey + hh, 3, 1, 'earth3');
    px(b, ex + 1, ey, 'ochre3');
  }
  outlineBuf(b, 'earth1');
  return b;
}

function sealPop(): PixelBuffer[] {
  const S = 25;
  const frames: PixelBuffer[] = [];
  const seal = waxSeal(7);
  const squash = waxSeal(7, 0.72);
  const steps: Array<[PixelBuffer, number, boolean]> = [
    [seal, -8, false],
    [squash, 2, true],
    [seal, 0, true],
    [seal, -1, false],
    [seal, 0, false],
    [seal, 0, false],
  ];
  steps.forEach(([s, dy, ring], f) => {
    const b = buf(S, S);
    if (ring) {
      const rr = f === 1 ? 9 : 11;
      ellipseRing(b, S / 2, S / 2 + 3, rr, rr * 0.5, (x, y) =>
        (x + y) % 2 === 0 ? 'ochre3' : null,
      );
    }
    stamp(b, s, Math.round((S - s.w) / 2), Math.round((S - s.h) / 2) + dy);
    if (f >= 3) {
      // Sparkles.
      const sp =
        f === 3
          ? [
              [3, 4],
              [21, 6],
            ]
          : f === 4
            ? [
                [2, 3],
                [22, 5],
                [20, 19],
              ]
            : [[21, 18]];
      for (const [x, y] of sp) {
        px(b, x!, y!, 'white');
        if (f === 4) {
          px(b, x! - 1, y!, 'ochre4');
          px(b, x! + 1, y!, 'ochre4');
          px(b, x!, y! - 1, 'ochre4');
          px(b, x!, y! + 1, 'ochre4');
        }
      }
    }
    frames.push(b);
  });
  return frames;
}

export function registerMisc(reg: SpriteRegistry): void {
  reg.add('fx.rotorwash', { group: 'fx', frames: rotorWash(), fps: 12, anchor: { x: 32, y: 16 } });
  reg.add('fx.splash', {
    group: 'fx',
    frames: splash(),
    fps: 12,
    loop: false,
    anchor: { x: 12, y: 17 },
  });
  reg.add('fx.confetti', { group: 'fx', frames: confettiLoop(), fps: 10, anchor: { x: 24, y: 0 } });
  reg.add('fx.confetti.burst', {
    group: 'fx',
    frames: confettiBurst(),
    fps: 12,
    loop: false,
    anchor: { x: 28, y: 47 },
  });
  reg.add('fx.pickup.hate', { group: 'fx', frames: hatePickup(), fps: 10, anchor: { x: 5, y: 5 } });
  reg.add('fx.seal.pop', {
    group: 'fx',
    frames: sealPop(),
    fps: 12,
    loop: false,
    anchor: { x: 12, y: 12 },
  });
  void ellipse;
}
