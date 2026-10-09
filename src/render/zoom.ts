/**
 * Integer zoom policy. Zoom = device pixels per world pixel (always an integer at rest).
 *
 * - Default: the integer that makes ~22 tiles span the *longer* screen side (≈ 20–24 tiles):
 *   1440×900 @1x → 2, 1920×1080 @1x → 3, 2560 @1x → 4, iPhone 844×390 @3x → 4.
 *   Portrait screens are capped so the *width* still shows ≥ ~10.5 tiles (M13b: iPhone
 *   390×844 @3x → 3, ≈ 12 tiles across instead of 9). The camera keeps the player's zoom when
 *   the device rotates mid-game (the default only applies to the first viewport).
 * - Range: 5 integer levels [min, min+4], where min keeps ≤ ~48 tiles across the long side.
 * - UI scale (device px per UI pixel) is chosen in CSS terms so touch targets stay usable.
 */
import { TILE_W } from '../core/iso';

export const TARGET_TILES_ACROSS = 22;
export const MAX_TILES_ACROSS = 48;
export const ZOOM_LEVELS = 5;
/** Minimum tiles across the screen width at the default zoom (portrait phones). */
export const MIN_TILES_WIDE = 10.5;

export interface ZoomRange {
  min: number;
  max: number;
  def: number;
}

export function zoomRange(deviceW: number, deviceH: number): ZoomRange {
  const longSide = Math.max(deviceW, deviceH);
  const min = Math.max(1, Math.floor(longSide / (MAX_TILES_ACROSS * TILE_W)));
  const max = min + ZOOM_LEVELS - 1;
  const fitW = Math.max(1, Math.floor(deviceW / (MIN_TILES_WIDE * TILE_W)));
  const ideal = Math.min(fitW, Math.round(longSide / (TARGET_TILES_ACROSS * TILE_W)));
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

/** Smallest UI area (UI px) the HUD layout supports on the short / long side. */
export const MIN_UI_SHORT = 190;
export const MIN_UI_LONG = 400;

/**
 * "Larger interface" setting (M13b): one integer step above `uiScale` when the screen still
 * leaves ≥ MIN_UI_SHORT × MIN_UI_LONG UI px, else the normal scale.
 */
export function uiScaleLarge(cssW: number, cssH: number, dpr: number): number {
  const k = uiScale(Math.min(cssW, cssH), dpr);
  const k1 = k + 1;
  const short = Math.floor((Math.min(cssW, cssH) * dpr) / k1);
  const long = Math.floor((Math.max(cssW, cssH) * dpr) / k1);
  return short >= MIN_UI_SHORT && long >= MIN_UI_LONG ? k1 : k;
}
