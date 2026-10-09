/**
 * Automatic quality tier (PLAN §4.2): desktop / mobile / low. Drives the crowd concurrency cap
 * (sim), protester variant count (art), FX/body budgets and silhouettes (view).
 */
import type { QualityTier } from '../data/balance';

export function detectQuality(): QualityTier {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'desktop';
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const small = Math.min(screen.width, screen.height) < 820;
  if (cores <= 2 || mem <= 2) return 'low';
  if ((coarse && small) || mem <= 4) return 'mobile';
  return 'desktop';
}
