/**
 * Landmark overlays: waving flags (hand-drawn designs, procedurally waved with ramp shading),
 * fire tongues, smoke columns and Big Ben's clock hands. All are small animated sprites placed
 * on top of the static landmark sprites at documented offsets (see overlays in index.ts).
 */
import { resolveColor, type SwatchName } from '../palette';
import { createBuffer, setPixel, outline, type PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';
import { hash } from './engine/materials';

// ---------------------------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------------------------

/** Shade ramps per flag colour: [fold shadow, base, highlight]. */
const CLOTH: Record<string, readonly [SwatchName, SwatchName, SwatchName]> = {
  r: ['rust1', 'crim2', 'rust3'],
  y: ['ochre1', 'ochre3', 'ochre4'],
  b: ['navy0', 'navy2', 'blue1'],
  w: ['gray6', 'gray7', 'white'],
  R: ['rust0', 'crim1', 'crim2'],
  o: ['earth3', 'ochre2', 'ochre3'],
  k: ['navy0', 'navy1', 'navy2'],
};

type Design = (x: number, y: number) => string;

const FW = 22;
const FH = 14;

const spain: Design = (x, y) => {
  if (y < 4 || y >= 11) return 'r';
  // Coat of arms near the hoist.
  if (x >= 4 && x <= 7 && y >= 5 && y <= 9) {
    if (x === 4 || x === 7) return y === 5 || y === 9 ? 'y' : 'o';
    return (x + y) % 2 === 0 ? 'R' : 'o';
  }
  return 'y';
};

const france: Design = (x) => (x < 7 ? 'b' : x < 15 ? 'w' : 'r');

const union: Design = (x, y) => {
  const W = FW - 1;
  const H = FH - 1;
  const cx = W / 2;
  const cy = H / 2;
  // Central cross.
  if (Math.abs(x - cx) < 1.6 || Math.abs(y - cy) < 1.1) return 'R';
  if (Math.abs(x - cx) < 2.6 || Math.abs(y - cy) < 2.1) return 'w';
  // Diagonals (saltires): white band with a centred red stripe.
  const k = H / W;
  const n = Math.sqrt(1 + k * k);
  const d1 = Math.abs(y - x * k) / n;
  const d2 = Math.abs(y - H + x * k) / n;
  const d = Math.min(d1, d2);
  if (d < 0.55) return 'R';
  if (d < 1.5) return 'w';
  return 'b';
};

const DESIGNS: Record<string, { d: Design; h: number }> = {
  es: { d: spain, h: FH },
  fr: { d: france, h: FH },
  uk: { d: union, h: FH },
};

/**
 * Waving flag frames. Anchor = the hoist's top pixel (sits on the pole tip): the flag flies
 * to the screen right of the pole. `torn` = ragged fly end, scorch and holes.
 */
export function flagFrames(code: keyof typeof DESIGNS, n = 6, torn = false, scale = 1): PixelBuffer[] {
  const { d, h } = DESIGNS[code]!;
  const w = Math.round(FW * scale);
  const hh = Math.round(h * scale);
  const amp = 2.2;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < n; f++) {
    const buf = createBuffer(w + 3, hh + 8);
    const ph = (f / n) * Math.PI * 2;
    for (let x = 0; x < w; x++) {
      const k = x / w;
      const off = Math.round(amp * k * Math.sin(x * 0.42 - ph) + k * 2.5);
      const slope = Math.cos(x * 0.42 - ph);
      // Ragged fly end for torn flags.
      // Torn: three ragged tongues at the fly end + two holes; scorched near the tear.
      const notch = (y: number): number => {
        const band = Math.floor((y / hh) * 3);
        return Math.round(w * (0.74 + [0.14, 0.04, 0.2][band]!) + Math.sin(y * 1.7) * 1.2);
      };
      for (let y = 0; y < hh; y++) {
        if (torn) {
          if (x >= notch(y)) continue;
          const hx = Math.round(w * 0.42);
          const hy = Math.round(hh * 0.35);
          if (Math.abs(x - hx) + Math.abs(y - hy) < 2) continue;
          if (Math.abs(x - hx - 4) + Math.abs(y - hy - 5) < 1.5) continue;
        }
        const key = d(Math.floor(x / scale), Math.floor(y / scale));
        const ramp = CLOTH[key]!;
        let tone = slope > 0.8 ? 2 : slope < -0.75 ? 0 : 1;
        if (x === 0) tone = 0;
        let sw: SwatchName = ramp[tone]!;
        if (torn && x >= notch(y) - 2) sw = 'gray1';
        else if (torn && x >= notch(y) - 4) sw = ramp[0]!;
        setPixel(buf, x + 1, y + 1 + off, resolveColor(sw));
      }
    }
    outline(buf, resolveColor('ink'));
    frames.push(buf);
  }
  return frames;
}

// ---------------------------------------------------------------------------------------------
// Fire & smoke
// ---------------------------------------------------------------------------------------------

const FIRE_BANDS: SwatchName[] = ['ochre4', 'ochre3', 'ochre2', 'rust3', 'rust2', 'rust1'];

/**
 * Flickering fire: several flame tongues whose heights pulse per frame; colour by distance
 * from each tongue's core (white-hot core → ember tips). Anchor: bottom centre.
 */
export function fireFrames(w: number, h: number, n = 6, seed = 1): PixelBuffer[] {
  const tongues = Math.max(2, Math.round(w / 4));
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < n; f++) {
    const buf = createBuffer(w, h);
    for (let t = 0; t < tongues; t++) {
      const cx = ((t + 0.5) / tongues) * w + (hash(t, seed) - 0.5) * 2;
      const centre = 1 - Math.abs(cx - w / 2) / (w / 2);
      const base = h * (0.45 + 0.55 * centre);
      const th = base * (0.75 + 0.25 * Math.sin((f / n) * Math.PI * 2 * (1 + (t % 2)) + t * 1.7));
      const hw = (w / tongues) * 0.9 + 1;
      const sway = Math.sin((f / n) * Math.PI * 2 + t) * 1.2;
      for (let y = 0; y < h; y++) {
        const up = h - 1 - y; // 0 at the bottom
        if (up > th) continue;
        const k = up / th;
        const half = hw * Math.pow(1 - k, 0.9) * Math.min(1, 0.55 + k * 2.5) + 0.3;
        const xc = cx + sway * k;
        for (let x = 0; x < w; x++) {
          const dx = Math.abs(x + 0.5 - xc);
          if (dx > half) continue;
          // Rounded base: corners of the canvas stay empty.
          const edge = Math.abs(x + 0.5 - w / 2) / (w / 2);
          if (up < 3 && edge > 0.75 + up * 0.08) continue;
          const core = (dx / half) * 0.75 + k * 0.85 + edge * 0.35;
          const band = Math.min(FIRE_BANDS.length - 1, Math.floor(core * 3.4));
          const prev = buf.data[(y * w + x) * 4 + 3]!;
          const col = resolveColor(FIRE_BANDS[band]!);
          if (prev) {
            // Keep the hotter colour where tongues overlap.
            const cur = FIRE_BANDS.findIndex((s) => resolveColor(s) === readRgba(buf, x, y));
            if (cur >= 0 && cur <= band) continue;
          }
          setPixel(buf, x, y, col);
        }
      }
    }
    // Sparks above.
    for (let k = 0; k < 2; k++) {
      const sx = Math.floor(hash(f, k, seed) * w);
      const sy = Math.floor(hash(k, f, seed + 1) * h * 0.4);
      if (!buf.data[(sy * w + sx) * 4 + 3]) setPixel(buf, sx, sy, resolveColor('ochre3'));
    }
    outline(buf, resolveColor('rust1'), { sides: { top: true, left: true, right: true, bottom: false } });
    frames.push(buf);
  }
  return frames;
}

function readRgba(b: PixelBuffer, x: number, y: number): number {
  const i = (y * b.w + x) * 4;
  return ((b.data[i]! << 24) | (b.data[i + 1]! << 16) | (b.data[i + 2]! << 8) | b.data[i + 3]!) >>> 0;
}

/** Rising smoke column: puffs drift up and grow; loops seamlessly. Anchor: bottom centre. */
export function smokeFrames(w: number, h: number, n = 6, dark = true): PixelBuffer[] {
  const ramp: SwatchName[] = dark ? ['gray1', 'gray2', 'gray3', 'gray4'] : ['gray3', 'gray4', 'gray5', 'gray6'];
  const puffs = 5;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < n; f++) {
    const buf = createBuffer(w, h);
    for (let p = puffs - 1; p >= 0; p--) {
      const t = (p + f / n) / puffs; // 0 bottom → 1 top
      const cy = h - 4 - t * (h - 8);
      const cx = w / 2 + Math.sin(t * 4 + p) * 2 + t * (w * 0.18);
      const r = (2.5 + t * (w * 0.3)) * (t > 0.72 ? 1 - (t - 0.72) * 2.2 : 1);
      if (r < 1.2) continue;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const dd = Math.hypot(dx, dy) / r;
          if (dd > 1) continue;
          // Light from upper-left: lit rim on that side.
          const lit = (-dx - dy) / r;
          let tone = lit > 0.55 ? 3 : lit > 0 ? 2 : lit > -0.5 ? 1 : 0;
          if (t > 0.75) tone = Math.min(3, tone + 1);
          setPixel(buf, x, y, resolveColor(ramp[tone]!));
        }
      }
    }
    frames.push(buf);
  }
  return frames;
}

// ---------------------------------------------------------------------------------------------
// Big Ben clock hands (12 minute positions)
// ---------------------------------------------------------------------------------------------

/** Clock hands on a sheared dial face. side: 'l' (+v face) or 'r' (+u face). Anchor: (8, 8). */
export function clockHands(side: 'l' | 'r', n = 12): PixelBuffer[] {
  const frames: PixelBuffer[] = [];
  const ink = resolveColor('ink');
  const gold = resolveColor('earth1');
  const toScreen = (sxFace: number, dz: number): [number, number] => {
    const dx = side === 'l' ? sxFace : sxFace;
    const y = (side === 'l' ? dx : -dx) / 2 - dz;
    return [8 + dx, 8 + y];
  };
  for (let f = 0; f < n; f++) {
    const buf = createBuffer(17, 17);
    const hand = (ang: number, len: number, col: number): void => {
      for (let t = 0; t <= len; t += 0.25) {
        const [x, y] = toScreen(Math.sin(ang) * t, Math.cos(ang) * t);
        setPixel(buf, Math.round(x - 0.5), Math.round(y - 0.5), col);
      }
    };
    const m = (f / n) * Math.PI * 2;
    hand(m, 5.5, ink);
    hand(Math.PI * 2 * (10 / 12) + m / 12, 3.5, gold);
    setPixel(buf, 8, 8, ink);
    frames.push(buf);
  }
  return frames;
}

export function registerLandmarkFx(reg: SpriteRegistry): void {
  const g = 'landmarks';
  for (const code of ['es', 'uk', 'fr'] as const) {
    const fr = flagFrames(code, 6, false);
    reg.add(`lm.flag.${code}`, { group: g, frames: fr, fps: 8, anchor: { x: 1, y: 1 } });
    reg.add(`lm.flag.${code}.torn`, {
      group: g,
      frames: flagFrames(code, 6, true),
      fps: 10,
      anchor: { x: 1, y: 1 },
    });
    reg.add(`lm.flag.${code}.small`, {
      group: g,
      frames: flagFrames(code, 6, false, 0.6),
      fps: 8,
      anchor: { x: 1, y: 1 },
    });
  }
  const fire = (name: string, w: number, h: number, seed: number): void => {
    reg.add(name, { group: g, frames: fireFrames(w, h, 6, seed), fps: 12, anchor: { x: w >> 1, y: h - 1 } });
  };
  fire('lm.fx.fire.s', 8, 12, 1);
  fire('lm.fx.fire.m', 12, 18, 2);
  fire('lm.fx.fire.l', 18, 28, 3);
  reg.add('lm.fx.smoke', { group: g, frames: smokeFrames(22, 48), fps: 6, anchor: { x: 11, y: 47 } });
  reg.add('lm.capitol.london.hands.l', { group: g, frames: clockHands('l'), fps: 1, anchor: { x: 8, y: 8 } });
  reg.add('lm.capitol.london.hands.r', { group: g, frames: clockHands('r'), fps: 1, anchor: { x: 8, y: 8 } });
}
