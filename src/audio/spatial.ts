/**
 * Camera-relative spatialisation (pure maths, unit-tested).
 *
 * The listener is the camera: `setListener(centreWorld, zoom, viewW)` where `zoom` is device
 * pixels per world pixel and `viewW` the canvas width in device pixels (same unit), so the
 * visible world width is `viewW / zoom`. Sounds inside the central part of the view play at
 * full level, fall off towards and beyond the screen edge, get duller (low-pass) off-screen,
 * and are culled far away. Zooming in (fewer world pixels visible) makes the world louder.
 */
import type { WorldPos } from './types';

export interface Listener {
  x: number;
  y: number;
  /** Half the visible world width, in world pixels. */
  halfW: number;
  /** Zoom loudness factor (zoomed in → > 1). */
  zoomGain: number;
}

/** Visible world width at the default zoom (~22 tiles across, see render/zoom.ts). */
export const REFERENCE_VIEW_WORLD_W = 22 * 32;
/** Below this spatial gain a request is culled before it costs anything. */
export const CULL_GAIN = 0.03;

export function makeListener(center: WorldPos, zoom: number, viewW: number): Listener {
  const z = zoom > 0 ? zoom : 1;
  const worldW = Math.max(64, (viewW > 0 ? viewW : 1280) / z);
  const zoomGain = Math.min(1.25, Math.max(0.7, Math.pow(REFERENCE_VIEW_WORLD_W / worldW, 0.3)));
  return { x: center.x, y: center.y, halfW: worldW / 2, zoomGain };
}

export const DEFAULT_LISTENER: Listener = makeListener({ x: 0, y: 0 }, 1, REFERENCE_VIEW_WORLD_W);

export interface Spatial {
  gain: number;
  /** −1 (left) … 1 (right); never fully hard-panned. */
  pan: number;
  /** Low-pass cutoff in Hz for distant sounds, 0 = none. */
  lowpass: number;
  /** Normalised distance (1 = screen edge horizontally). */
  dist: number;
}

/** Screens are wider than tall: vertical offsets count more (≈ 16:10 aspect). */
const VERTICAL_WEIGHT = 1.6;

export function spatialize(x: number, y: number, l: Listener, out?: Spatial): Spatial {
  const o = out ?? { gain: 1, pan: 0, lowpass: 0, dist: 0 };
  const dx = x - l.x;
  const dy = (y - l.y) * VERTICAL_WEIGHT;
  const d = Math.sqrt(dx * dx + dy * dy) / l.halfW;
  o.dist = d;
  o.gain = (d <= 0.75 ? 1 : Math.pow(1 + 2.2 * (d - 0.75), -1.6)) * l.zoomGain;
  o.pan = Math.max(-1, Math.min(1, dx / l.halfW)) * 0.75;
  o.lowpass = d <= 1 ? 0 : Math.max(900, 18000 / (1 + (d - 1) * 5));
  return o;
}
