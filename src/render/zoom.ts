/**
 * Integer zoom policy. Zoom = device pixels per world pixel (always an integer at rest).
 *
 * - Default: the integer that makes ~22 tiles span the *longer* screen side (≈ 20–24 tiles):
 *   1440×900 @1x → 2, 1920×1080 @1x → 3, 2560 @1x → 4, iPhone 844×390 @3x → 4.
 *   Using the longer side keeps the zoom stable when a phone rotates.
 * - Range: 5 integer levels [min, min+4], where min keeps ≤ ~48 tiles across the long side.
 * - UI scale (device px per UI pixel) is chosen in CSS terms so touch targets stay usable.
 */
import { TILE_W } from '../core/iso';

export const TARGET_TILES_ACROSS = 22;
export const MAX_TILES_ACROSS = 48;
export const ZOOM_LEVELS = 5;

export interface ZoomRange {
  min: number;
  max: number;
  def: number;
}

export function zoomRange(deviceW: number, deviceH: number): ZoomRange {
  const longSide = Math.max(deviceW, deviceH);
  const min = Math.max(1, Math.floor(longSide / (MAX_TILES_ACROSS * TILE_W)));
  const max = min + ZOOM_LEVELS - 1;
  const ideal = Math.round(longSide / (TARGET_TILES_ACROSS * TILE_W));
  return { min, max, def: Math.min(max, Math.max(min, ideal)) };
}

/** UI pixel scale in device px: ~2 CSS px per UI pixel on phones, ~3 on large screens. */
export function uiScale(cssShortSide: number, dpr: number): number {
  const cssPerPixel = cssShortSide >= 720 ? 3 : 2;
  return Math.max(1, Math.round(cssPerPixel * dpr));
}
