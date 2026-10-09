/**
 * Automatic quality tier (PLAN §4.2): desktop / mobile / low. Drives the crowd concurrency cap
 * (sim), protester variant count (art), FX/body budgets and silhouettes (view). On top of the
 * tier, the controller's frame-time governor (game/governor.ts) degrades the view further on
 * devices that still cannot keep up.
 */
import type { QualityTier } from '../data/balance';

/** What the classifier looks at (all optional: browsers expose different subsets). */
export interface DeviceInfo {
  cores?: number;
  /** GB (Chromium only). */
  memory?: number;
  /** Primary pointer is coarse (touch). */
  coarse?: boolean;
  /** Touch points (iPadOS reports a Mac UA but 5 touch points). */
  touchPoints?: number;
  /** Screen size in CSS px. */
  screenW?: number;
  screenH?: number;
  dpr?: number;
  userAgent?: string;
}

const MOBILE_UA = /Android|iPhone|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i;
const TABLET_UA = /iPad|Tablet/i;

/** Pure tier classification (unit-tested). */
export function classifyQuality(d: DeviceInfo): QualityTier {
  const cores = d.cores ?? 4;
  const mem = d.memory ?? 8;
  const ua = d.userAgent ?? '';
  const short = Math.min(d.screenW ?? 1920, d.screenH ?? 1080);
  const touch = !!d.coarse || (d.touchPoints ?? 0) > 1;
  const phoneUa = MOBILE_UA.test(ua) && !TABLET_UA.test(ua);
  const phone = phoneUa || (touch && short < 600);
  // Weak hardware: few cores or little memory, or an older/low-end phone (≤ 4 cores).
  if (cores <= 2 || mem <= 2 || (phone && cores <= 4 && mem <= 3)) return 'low';
  // Phones and small touch tablets: the mobile tier (1500 concurrent protesters, lighter FX).
  if (phone || (d.coarse && short < 820) || mem <= 4) return 'mobile';
  return 'desktop';
}

export function detectQuality(): QualityTier {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'desktop';
  return classifyQuality({
    cores: navigator.hardwareConcurrency,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    touchPoints: navigator.maxTouchPoints,
    screenW: screen.width,
    screenH: screen.height,
    dpr: window.devicePixelRatio,
    userAgent: navigator.userAgent,
  });
}
