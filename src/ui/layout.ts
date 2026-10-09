/**
 * Responsive HUD layout (pure math, unit-tested). Everything is in UI px — the UI root is
 * scaled by the integer UI scale (`render/zoom.ts: uiScale`), so 1440×900 → 480×300 UI px,
 * 1920×1080 → 640×360, phone 844×390@3 → 506×234, 390×844@3 → 234×506.
 *
 * Rules:
 * - Top bar spans the width (safe-area padded). One row when ≥ TOP_ONE_ROW_W UI px wide,
 *   otherwise two rows (portrait phones, tablets).
 * - Deploy bar: full-size kit cards (38×50) on large screens, compact cards (30×38) when the
 *   screen is short (< 280 UI px: phone landscape) or narrow (< 300: phone portrait). It is
 *   centred at the bottom and scrolls horizontally when the 11 cards don't fit (bottom sheet).
 * - Minimap: bottom-right beside the deploy bar when there is room, else top-right under the
 *   top bar. On phones it is toggleable (hidden by default in portrait).
 * - The wave button (LET THEM COME / CALL EARLY) sits centred just above the deploy bar.
 */
import type { Rect } from './core/node';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export type HudMode = 'wide' | 'compact' | 'portrait';

export interface CardMetrics {
  /** Sprite size (incl. the 2-px glow margin) and the pitch between cards. */
  w: number;
  h: number;
  pitch: number;
  compact: boolean;
}

export const FULL_CARD: CardMetrics = { w: 38, h: 50, pitch: 37, compact: false };
export const COMPACT_CARD: CardMetrics = { w: 30, h: 38, pitch: 29, compact: true };

export const TOP_ROW_H = 24;
export const TOP_ONE_ROW_W = 440;
export const UNIT_COUNT = 11;
/** Leather bar padding around the cards. */
export const BAR_PAD_X = 6;
export const BAR_PAD_Y = 5;

export interface HudLayout {
  W: number;
  H: number;
  safe: Insets;
  mode: HudMode;
  topRows: 1 | 2;
  topBar: Rect;
  card: CardMetrics;
  /** Deploy bar panel. */
  deploy: Rect;
  /** Cards strip viewport inside the bar (scrolls when content > viewport). */
  cardsView: Rect;
  /** Full width of all cards. */
  cardsW: number;
  scrollable: boolean;
  /** Minimap frame rect (null = hidden). */
  minimap: Rect | null;
  /** Phones: a toggle button shows/hides the minimap. */
  minimapToggle: boolean;
  /** Wave button anchor: centre x, bottom y. */
  waveButton: { cx: number; bottom: number };
  /** Free area for the selected-unit panel (left, above the bar). */
  info: Rect;
  /** Advisor: bottom-left corner point above the bar and max width. */
  advisor: { x: number; bottom: number; maxW: number };
  /** Top of the free world area (below the top bar), for banners and toasts. */
  bannerY: number;
  /** Fraction of the screen area covered by the HUD (top bar + deploy bar + minimap). */
  coverage: number;
}

export interface LayoutOptions {
  /** Phone-ish device (coarse pointer). */
  touch?: boolean;
  /** Minimap wanted (phones toggle it). */
  minimap?: boolean;
}

export function layoutMode(W: number, H: number): HudMode {
  if (W < TOP_ONE_ROW_W) return 'portrait';
  if (H < 280) return 'compact';
  return 'wide';
}

export function computeHudLayout(
  W: number,
  H: number,
  safe: Insets = NO_INSETS,
  opts: LayoutOptions = {},
): HudLayout {
  const mode = layoutMode(W, H);
  const topRows: 1 | 2 = W - safe.left - safe.right >= TOP_ONE_ROW_W ? 1 : 2;
  const topH = TOP_ROW_H * topRows + 2 + safe.top;
  const topBar = { x: 0, y: 0, w: W, h: topH };
  const card = H < 280 || W < 300 ? COMPACT_CARD : FULL_CARD;
  const cardsW = (UNIT_COUNT - 1) * card.pitch + card.w;
  const barH = card.h + BAR_PAD_Y * 2 + safe.bottom;
  const availW = W - safe.left - safe.right;
  const touch = opts.touch ?? false;
  const phone = mode !== 'wide' && (touch || H < 280 || W < 300);
  // Minimap frame: the map is drawn in true 2:1 iso, so the inner area is 2:1 too.
  const mmSize = phone ? 72 : W >= 600 && H >= 340 ? 120 : 108;
  const mmWanted = opts.minimap ?? true;
  let barW = Math.min(availW, cardsW + BAR_PAD_X * 2);
  let minimap: Rect | null = null;
  const mmFrameH = minimapFrameH(mmSize) + 4;
  // Bottom-right beside the bar if the bar (centred) leaves room.
  const sideRoom = (availW - barW) / 2;
  if (mmWanted) {
    if (!phone && sideRoom >= mmSize + 4) {
      minimap = {
        x: W - safe.right - mmSize - 4,
        y: H - safe.bottom - mmFrameH - 3,
        w: mmSize,
        h: mmFrameH,
      };
    } else {
      minimap = { x: W - safe.right - mmSize - 4, y: topH + 4, w: mmSize, h: mmFrameH };
    }
  }
  const scrollable = cardsW + BAR_PAD_X * 2 > availW;
  if (scrollable) barW = availW;
  const deploy = {
    x: Math.floor(safe.left + (availW - barW) / 2),
    y: H - barH,
    w: barW,
    h: barH,
  };
  const cardsView = {
    x: deploy.x + BAR_PAD_X,
    y: deploy.y + BAR_PAD_Y,
    w: deploy.w - BAR_PAD_X * 2,
    h: card.h,
  };
  const aboveBar = deploy.y - 4;
  const infoW = Math.min(176, Math.floor(availW * 0.62));
  const infoH = phone ? 46 : 58;
  const info = { x: safe.left + 4, y: aboveBar - infoH, w: infoW, h: infoH };
  const coverage =
    (W * topH + deploy.w * deploy.h + (minimap ? minimap.w * minimap.h : 0)) / (W * H);
  return {
    W,
    H,
    safe,
    mode,
    topRows,
    topBar,
    card,
    deploy,
    cardsView,
    cardsW,
    scrollable,
    minimap,
    minimapToggle: phone,
    waveButton: { cx: Math.floor(W / 2), bottom: aboveBar - 2 },
    info,
    advisor: { x: safe.left + 4, bottom: aboveBar - 2, maxW: availW - 8 },
    bannerY: topH + 6,
    coverage,
  };
}

/** Minimap frame height (without the 4-px compass tab) for a frame width: inner area 2:1. */
export function minimapFrameH(w: number): number {
  return Math.floor((w - 12) / 2) + 12;
}

/** Clamp a horizontal scroll offset (0 = first card visible). */
export function clampScroll(scroll: number, contentW: number, viewW: number): number {
  return Math.max(0, Math.min(Math.max(0, contentW - viewW), scroll));
}

/** Scroll offset that brings card `index` fully into view. */
export function scrollToCard(
  scroll: number,
  index: number,
  card: CardMetrics,
  viewW: number,
  contentW: number,
): number {
  const x0 = index * card.pitch;
  const x1 = x0 + card.w;
  let s = scroll;
  if (x0 < s) s = x0;
  else if (x1 > s + viewW) s = x1 - viewW;
  return clampScroll(s, contentW, viewW);
}

/** Safe-area insets (CSS px) → UI px (rounded up). */
export function insetsToUi(css: Insets, dpr: number, k: number): Insets {
  const f = (v: number) => Math.max(0, Math.ceil((v * dpr) / k - 1e-6));
  return { top: f(css.top), right: f(css.right), bottom: f(css.bottom), left: f(css.left) };
}
