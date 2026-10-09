/**
 * Explosions: grenade (small), bazooka (medium), tank shell (big) and the Prophet's comic
 * boom (huge, with a jagged cartoon starburst, pamphlet confetti and a shockwave ring).
 * Sequence: white flash → hot fireball → rising mushroom with smoke cap → smoke breaks up.
 * Anchor = ground zero (the impact point on the ground).
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import {
  buf,
  ellipseRing,
  has,
  mask,
  outlineMaskInto,
  fillMask,
  paintLobes,
  prng,
  px,
  rect,
  mset,
  type Lobe,
} from './draw';

const HOT = ['rust0', 'rust2', 'rust3', 'ochre3', 'ochre4'];
const HOT_WHITE = ['rust1', 'ochre2', 'ochre3', 'ochre4', 'white'];
const SMOKE_DARK = ['ink', 'gray1', 'gray2', 'gray3', 'gray4'];
const SMOKE = ['gray1', 'gray3', 'gray4', 'gray5', 'gray6'];

/** A puffy cluster: one big centre lobe + `n` ring lobes, sorted back (top) to front. */
export function cluster(
  cx: number,
  cy: number,
  R: number,
  n: number,
  seed: number,
  squash = 1,
): Lobe[] {
  const rnd = prng(seed);
  const lobes: Lobe[] = [{ x: cx, y: cy, r: R * 0.62 }];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
    const d = R * (0.45 + rnd() * 0.15);
    lobes.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d * squash,
      r: R * (0.36 + rnd() * 0.14),
    });
  }
  return lobes.sort((a, b) => a.y - b.y);
}

/** Star-burst polygon mask (comic flash), `spikes` points, radii ro/ri. */
function starburst(
  b: PixelBuffer,
  cx: number,
  cy: number,
  ro: number,
  ri: number,
  spikes: number,
  seed: number,
  fill: string[],
  outlineRef: string | null,
): void {
  const rnd = prng(seed);
  const radii: number[] = [];
  for (let i = 0; i < spikes * 2; i++)
    radii.push(i % 2 === 0 ? ro * (0.8 + rnd() * 0.25) : ri * (0.85 + rnd() * 0.2));
  const k = mask(b.w, b.h);
  const k2 = mask(b.w, b.h);
  const k3 = mask(b.w, b.h);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * 1.15;
      let a = Math.atan2(dy, dx);
      if (a < 0) a += Math.PI * 2;
      const seg = (a / (Math.PI * 2)) * spikes * 2;
      const i0 = Math.floor(seg) % (spikes * 2);
      const i1 = (i0 + 1) % (spikes * 2);
      const t = seg - Math.floor(seg);
      const r = radii[i0]! * (1 - t) + radii[i1]! * t;
      const d = Math.hypot(dx, dy);
      if (d <= r) mset(k, x, y);
      if (d <= r * 0.68) mset(k2, x, y);
      if (d <= r * 0.36) mset(k3, x, y);
    }
  }
  fillMask(b, k, fill[0]!);
  fillMask(b, k2, fill[1]!);
  fillMask(b, k3, fill[2]!);
  if (outlineRef) outlineMaskInto(b, k, () => outlineRef);
}

interface Particle {
  vx: number;
  vy: number;
  kind: number;
  spin: number;
}

function particles(n: number, seed: number, speed: number): Particle[] {
  const rnd = prng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI * (0.08 + rnd() * 0.84);
    const s = speed * (0.55 + rnd() * 0.6);
    return {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s * 1.1,
      kind: i % 4,
      spin: Math.floor(rnd() * 4),
    };
  });
}

/** Debris chunk (2×2 rubble with lit corner) at (x, y). */
function debris(b: PixelBuffer, x: number, y: number, kind: number): void {
  x = Math.round(x);
  y = Math.round(y);
  if (has(b, x, y) || has(b, x + 1, y) || has(b, x, y + 1)) return; // stays behind the cloud
  if (kind === 0) {
    rect(b, x, y, 2, 2, 'gray2');
    px(b, x, y, 'gray4');
  } else if (kind === 1) {
    rect(b, x, y, 2, 1, 'earth2');
    px(b, x, y, 'earth4');
  } else if (kind === 2) {
    px(b, x, y, 'ink');
    px(b, x + 1, y, 'gray2');
  } else {
    px(b, x, y, 'rust3');
  }
}

/** Paper confetti (pamphlets: white sheets with a typed line, a few coloured flyers). */
function paper(b: PixelBuffer, x: number, y: number, kind: number, spin: number): void {
  x = Math.round(x);
  y = Math.round(y);
  const fill = ['white', 'stone5', 'pink3', 'hivis2'][kind]!;
  const s = spin % 4;
  if (s === 0) {
    rect(b, x, y, 3, 2, fill);
    px(b, x + 1, y + 1, 'gray5');
  } else if (s === 1) {
    rect(b, x, y, 2, 3, fill);
    px(b, x, y + 1, 'gray5');
  } else if (s === 2) {
    rect(b, x, y, 3, 1, fill);
  } else {
    px(b, x, y, fill);
    px(b, x + 1, y + 1, fill);
  }
}

interface ExplosionSpec {
  /** Fireball radius at full size. */
  R: number;
  frames: number;
  seed: number;
  debris: number;
  ring: boolean;
  prophet?: boolean;
}

function explosion(spec: ExplosionSpec): {
  frames: PixelBuffer[];
  anchor: { x: number; y: number };
} {
  const { R, seed } = spec;
  const W = Math.round(R * 3.4) + (spec.prophet ? 8 : 0);
  const H = Math.round(R * 3.4);
  const gx = Math.floor(W / 2);
  const gy = H - Math.round(R * 0.7);
  const parts = particles(spec.debris, seed + 7, R * 0.55);
  const confetti = spec.prophet ? particles(22, seed + 99, R * 0.5) : [];
  const n = spec.frames;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < n; f++) {
    const b = buf(W, H);
    const t = f / (n - 1); // 0..1
    // Ground shockwave ring (behind everything), frames 1..3.
    if (spec.ring && f >= 1 && f <= 3) {
      const rr = R * (0.9 + f * 0.45);
      ellipseRing(
        b,
        gx + 0.5,
        gy + 0.5,
        rr,
        rr * 0.45,
        f === 3 ? 'stone3' : 'stone5',
        f === 1 ? 2 : 1,
      );
    }
    if (f === 0) {
      if (spec.prophet) {
        starburst(
          b,
          gx + 0.5,
          gy - R * 0.6,
          R * 1.25,
          R * 0.62,
          11,
          seed,
          ['ochre3', 'ochre4', 'white'],
          'rust1',
        );
      } else {
        starburst(
          b,
          gx + 0.5,
          gy - R * 0.5,
          R * 1.0,
          R * 0.5,
          9,
          seed,
          ['ochre3', 'ochre4', 'white'],
          'rust3',
        );
      }
    } else {
      // Fireball rises and grows; smoke cap takes over from frame 3.
      const rise = R * (0.35 + t * 1.25);
      const grow = Math.min(1.08, 0.72 + t * 1.2);
      const fireR = R * grow * Math.max(0, 1 - Math.max(0, t - 0.3) * 1.6);
      const smokeR = R * (t < 0.12 ? 0 : 0.95 + t * 0.4);
      const cy = gy - rise;
      if (smokeR > 0) {
        const fade = Math.max(0, (t - 0.55) / 0.45);
        const lobes = cluster(
          gx + 0.5,
          cy - R * 0.25,
          smokeR,
          spec.prophet ? 7 : 5,
          seed + 3,
          0.7,
        ).map((l, i) => ({
          ...l,
          // Break apart at the end: lobes drift outward and shrink.
          x: l.x + (l.x - gx) * fade * 0.7,
          y: l.y + (l.y - cy) * fade * 0.5 - fade * R * 0.3,
          r: Math.max(0.9, l.r * (1 - fade * 0.55) - (i % 2) * fade * 1.5),
        }));
        paintLobes(b, lobes, {
          ramp: t > 0.5 ? SMOKE : SMOKE_DARK,
          outlineLit: t > 0.5 ? 'gray2' : 'gray1',
        });
        // Smoke stem down to the ground (mushroom) in the middle frames.
        if (t > 0.2 && t < 0.75) {
          const stem: Lobe[] = [];
          for (let y = gy - 2; y > cy; y -= Math.max(1.5, R * 0.16))
            stem.push({ x: gx + 0.5, y, r: (R * 0.2 + (gy - y) * 0.04) * (1 - fade) + 0.8 });
          paintLobes(b, stem.reverse(), { ramp: SMOKE_DARK, outlineLit: 'gray1' });
        }
      }
      // Base dust skirt in early frames (wide, flat, behind the fireball's foot).
      if (f >= 1 && t < 0.62) {
        const sk = R * (0.7 + t * 1.4);
        const skirt: Lobe[] = [-1, 1, -0.7, 0.7, -0.35, 0.35, 0].map((s, i) => ({
          x: gx + 0.5 + s * sk,
          y: gy - 1 - (1 - Math.abs(s)) * R * 0.18 + (i % 2),
          r: (R * 0.26 + (1 - Math.abs(s)) * R * 0.12) * (1 - t * 0.7) + 1,
          sy: 0.7,
        }));
        paintLobes(b, skirt, {
          ramp: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
          outlineLit: 'stone2',
        });
      }
      if (fireR > 1) {
        const fl = cluster(gx + 0.5, cy + R * 0.12, fireR, spec.prophet ? 7 : 5, seed + 1, 0.8);
        paintLobes(b, fl, { ramp: f === 1 ? HOT_WHITE : HOT, mode: 'hot' });
      }
    }
    // Debris arcs.
    for (const p of parts) {
      const tt = f * 1.0;
      const x = gx + p.vx * tt;
      const y = gy - R * 0.3 + p.vy * tt + 0.9 * tt * tt * (R / 10);
      if (f >= 1 && y < gy + 2 && x >= 0 && x < W - 2) debris(b, x, y, p.kind);
    }
    for (const p of confetti) {
      const tt = f;
      const x = gx + p.vx * tt * 1.2 + Math.sin(tt * 1.7 + p.spin) * 2;
      const y = gy - R * 0.7 + p.vy * tt * 1.15 + 0.35 * tt * tt * (R / 10);
      if (f >= 1 && y < gy + 6 && y > 0) paper(b, x, y, p.kind, p.spin + f);
    }
    frames.push(b);
  }
  return { frames, anchor: { x: gx, y: gy } };
}

/** Standalone shockwave ring (ground decal FX): 5 frames expanding & thinning. */
function shockwave(R: number): PixelBuffer[] {
  const W = Math.round(R * 2 + 4);
  const H = Math.round(R + 4);
  return [0.3, 0.5, 0.7, 0.86, 1].map((s, i) => {
    const b = buf(W, H);
    ellipseRing(
      b,
      W / 2,
      H / 2,
      R * s,
      R * s * 0.5,
      i < 2 ? 'white' : i < 4 ? 'stone4' : 'stone2',
      i === 0 ? 2 : 1,
    );
    if (i < 3)
      ellipseRing(b, W / 2, H / 2, R * s - 2, (R * s - 2) * 0.5, (x, y) =>
        (x + y) % 3 === 0 ? 'stone3' : null,
      );
    return b;
  });
}

export function registerExplosions(reg: SpriteRegistry): void {
  const specs: Array<[string, ExplosionSpec, number]> = [
    ['small', { R: 7, frames: 7, seed: 11, debris: 6, ring: false }, 16],
    ['medium', { R: 10, frames: 8, seed: 23, debris: 9, ring: true }, 14],
    ['big', { R: 14, frames: 10, seed: 37, debris: 14, ring: true }, 14],
    ['prophet', { R: 18, frames: 12, seed: 51, debris: 12, ring: true, prophet: true }, 14],
  ];
  for (const [name, spec, fps] of specs) {
    const { frames, anchor } = explosion(spec);
    reg.add(`fx.explosion.${name}`, { group: 'fx', frames, fps, loop: false, anchor });
  }
  for (const [name, R] of [
    ['small', 14],
    ['big', 30],
  ] as const) {
    const fr = shockwave(R);
    reg.add(`fx.shockwave.${name}`, {
      group: 'fx',
      frames: fr,
      fps: 16,
      loop: false,
      anchor: { x: Math.floor(fr[0]!.w / 2), y: Math.floor(fr[0]!.h / 2) },
    });
  }
}
