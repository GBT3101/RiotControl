/**
 * Hate & Legitimacy accounting, level-ups and the victory condition (PLAN §1.1, §1.6).
 */
import { BALANCE } from '../data/balance';
import { LEVELS, WIN_LEGITIMACY, levelForLegit } from '../data/levels';
import type { UnitId } from '../data/units';
import { snapshotStats } from './stats';
import type { World } from './world';

export class Economy {
  hate: number = BALANCE.startHate;
  legit: number = BALANCE.startLegit;
  level = 0;
}

export function gainHate(
  w: World,
  amount: number,
  x: number,
  y: number,
  reason: 'protester' | 'unit' | 'callEarly',
): void {
  if (amount <= 0) return;
  w.economy.hate += amount;
  w.stats.hateEarned += amount;
  w.events.push('hateGained', { amount, x, y, reason });
}

export function spendHate(w: World, amount: number, unit: UnitId): boolean {
  if (w.economy.hate < amount) return false;
  w.economy.hate -= amount;
  w.stats.hateSpent += amount;
  w.events.push('hateSpent', { amount, unit });
  return true;
}

export function gainLegit(w: World, amount: number, x: number, y: number, unit: UnitId): void {
  if (amount <= 0) return;
  const e = w.economy;
  e.legit += amount;
  w.stats.legitEarned += amount;
  w.events.push('legitGained', { amount, x, y, unit });
  const lvl = levelForLegit(e.legit);
  while (e.level < lvl) {
    e.level++;
    const def = LEVELS[e.level]!;
    w.stats.level = e.level;
    w.events.push('levelUp', {
      level: e.level,
      units: [def.unit],
      protesters: [...def.protesters],
    });
  }
  if (e.legit >= WIN_LEGITIMACY && w.phase === 'playing') {
    w.phase = 'victory';
    w.syncStats();
    w.events.push('victory', { stats: snapshotStats(w.stats) });
  }
}
