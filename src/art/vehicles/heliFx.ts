/**
 * Helicopter layers drawn in 2D: main-rotor blur disc, ground shadow, searchlight beam & spot,
 * downwash dust ring. All shapes are computed on the ground/rotor plane and rasterised one
 * sample per pixel with palette colours only.
 */
import { SHADOW, SHADOW_ALPHA, resolveColor, type RGBA } from '../palette';
import { blit, createBuffer, setPixel, getPixel, type PixelBuffer, type Point } from '../lib/pixels';
import { heliBody, HELI_ALT, HELI_LIGHT, HELI_POSES } from './heli';
import { MATS } from './materials';
import { cropAnim, project, renderModel, type Anim } from './render3d';
import { puff } from './stamps';

const SHADOW_C = resolveColor(SHADOW, SHADOW_ALPHA);
/** Rotor radius (world units). */
export const ROTOR_R = 21;

/** Ground-plane (a, b) of a screen offset. */
function ground(sx: number, sy: number): [number, number] {
  return [sy + sx / 2, sy - sx / 2];
}

/**
 * Main rotor: 4 blades, 4 frames (22.5° per frame → seamless), anchored on the hub.
 * Blades are solid with a translucent motion-blur wedge trailing each, plus a faint rim.
 */
export function rotorAnim(): Anim {
  const R = ROTOR_R;
  const W = Math.ceil(R * 1.42) * 2 + 5;
  const H = Math.ceil(R * 0.71) * 2 + 5;
  const cx = W >> 1;
  const cy = H >> 1;
  const blade = resolveColor('gray2');
  const bladeHi = resolveColor('gray4');
  const tip = resolveColor('hivis1');
  const hub = resolveColor('gray1');
  const hubHi = resolveColor('zinc2');
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 4; f++) {
    const buf = createBuffer(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [a, b] = ground(x - cx, (y - cy) * 1);
        const r = Math.hypot(a, b);
        if (r > R + 0.5) continue;
        if (r < 1.9) {
          setPixel(buf, x, y, r < 1 ? hubHi : hub);
          continue;
        }
        const th = (Math.atan2(b, a) * 180) / Math.PI;
        let best = 999;
        for (let k = 0; k < 4; k++) {
          const ang = f * 22.5 + k * 90;
          // Rotation direction: counter-clockwise on screen → trail lies at larger angles.
          const d = (((th - ang) % 360) + 360) % 360;
          best = Math.min(best, d);
        }
        // Blade: angular half-width shrinking with radius (≈ constant chord).
        const bw = (0.9 / r) * (180 / Math.PI);
        let c: RGBA | 0 = 0;
        if (best < bw || best > 360 - bw) c = r > R - 2 ? tip : best < bw * 0.4 || best > 360 - bw * 0.4 ? bladeHi : blade;
        else if (best < 26 && r > 4) c = SHADOW_C;
        else if (r > R - 0.9) c = SHADOW_C;
        if (c) setPixel(buf, x, y, c);
      }
    }
    frames.push(buf);
  }
  return { frames, anchor: { x: cx, y: cy } };
}

/** Ground shadow of the body (vertical footprint), anchored at the ground point under the CoM. */
export function heliShadow(yaw: number): Anim {
  const v = { yaw };
  const r = renderModel(heliBody(0, false, v), MATS, v, { shadowOnly: true, w: 90, h: 70, ax: 45, ay: 35 });
  // Add a faint rotor-disc ring in the shadow (every other pixel would be dither — keep it solid).
  return cropAnim([r.buf], r.anchor);
}

/**
 * Searchlight beam (for night; draw with additive blending): from the lens at altitude down to
 * a spot on the ground ~1.3 tiles ahead. Anchor = the helicopter's ground point.
 */
export function heliBeam(yaw: number, alt = HELI_ALT): Anim {
  const v = { yaw, ...HELI_POSES.hover };
  const lens = project(HELI_LIGHT, v);
  const L: Point = { x: lens.x, y: lens.y - alt };
  const fwd: [number, number] = [Math.cos((yaw * Math.PI) / 180), Math.sin((yaw * Math.PI) / 180)];
  const dist = 20;
  const sr = 8.5;
  const spot = { x: (fwd[0] - fwd[1]) * dist, y: ((fwd[0] + fwd[1]) * dist) / 2 };
  const W = 120;
  const H = 120;
  const ax = 60;
  const ay = 70;
  const buf = createBuffer(W, H);
  const beam = resolveColor('gray1');
  const beamCore = resolveColor('gray2');
  const s0 = resolveColor('stone0');
  const s1 = resolveColor('stone1');
  const s2 = resolveColor('stone2');
  const s3 = resolveColor('stone3');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x - ax;
      const sy = y - ay;
      // Spot ellipse on the ground.
      const [a, b] = ground(sx - spot.x, sy - spot.y);
      const r = Math.hypot(a, b) / sr;
      if (r <= 1) {
        setPixel(buf, x, y, r < 0.35 ? s3 : r < 0.6 ? s2 : r < 0.85 ? s1 : s0);
        continue;
      }
      // Beam: points whose segment towards the lens passes the spot (cone between lens & ellipse).
      const t = (sy - L.y) / (spot.y - L.y || 1e-6);
      const along = Math.abs(spot.y - L.y) > Math.abs(spot.x - L.x) ? t : (sx - L.x) / (spot.x - L.x || 1e-6);
      if (along < 0.04 || along > 1) continue;
      const px = L.x + (sx - L.x) / along;
      const py = L.y + (sy - L.y) / along;
      const [pa, pb] = ground(px - spot.x, py - spot.y);
      const pr = Math.hypot(pa, pb) / sr;
      if (pr <= 1) setPixel(buf, x, y, pr < 0.3 ? beamCore : beam);
    }
  }
  return cropAnim([buf], { x: ax, y: ay });
}

/** Rotor downwash: expanding ring of dust puffs on the ground, 4-frame loop. Anchor = centre. */
export function downwashAnim(): Anim {
  const W = 110;
  const H = 64;
  const ax = 55;
  const ay = 32;
  const small = puff('s', 'dust');
  const med = puff('m', 'dust');
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 4; f++) {
    const buf = createBuffer(W, H);
    const rings: Array<[number, PixelBuffer, number]> = [
      [10 + f * 3, med, 0],
      [22 + f * 3, small, 15],
    ];
    for (const [r, img, off] of rings) {
      const n = r < 20 ? 10 : 14;
      for (let k = 0; k < n; k++) {
        const th = ((k * 360) / n + off + f * 4) * (Math.PI / 180);
        const a = Math.cos(th) * r;
        const b = Math.sin(th) * r;
        const x = Math.round(a - b) + ax - (img.w >> 1);
        const y = Math.round((a + b) / 2) + ay - (img.h >> 1);
        // Outer ring thins out: skip alternate puffs on the last frame.
        if (r > 28 && k % 2 === 1) continue;
        blit(buf, img, x, y);
      }
    }
    frames.push(buf);
  }
  return cropAnim(frames, { x: ax, y: ay });
}

/** Utility for previews/tests: does a buffer contain any pixel? */
export function isEmpty(b: PixelBuffer): boolean {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (getPixel(b, x, y) & 255) return false;
  return true;
}
