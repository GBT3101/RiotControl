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

/**
 * UI pixel scale in device px (device px per UI pixel, always an integer).
 *
 * The largest scale that keeps ≥ ~300 UI px on the short side, but never smaller than ~2 CSS px
 * per UI pixel (1.5 on phone-sized screens, where every UI pixel counts):
 * 1440×900@1 → 3 (480×300 UI px), 1920×1080@1 → 3, 2560×1440@1 → 4, 768×1024@1 → 2,
 * iPhone 844×390@3 → 5 (506×234 UI px; 390×844 → 234×506).
 */
export function uiScale(cssShortSide: number, dpr: number): number {
  const minCss = cssShortSide < 500 ? 1.5 : 2;
  const minK = Math.max(1, Math.ceil(minCss * dpr - 1e-6));
  return Math.max(minK, Math.floor((cssShortSide * dpr) / 300));
}
