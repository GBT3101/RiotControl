/**
 * Legitimacy levels — PLAN.md §1.2. Level-ups are instant; each unlocks one Ministry unit
 * and possibly new protester types joining the wave mix (the escalation spiral).
 */
import type { ProtesterId } from './protesters';
import type { UnitId } from './units';

export interface LevelDef {
  level: number;
  /** Legitimacy needed to reach this level. */
  legit: number;
  /** Ministry unit approved at this level. */
  unit: UnitId;
  /** Protester types that join the mix from this level. */
  protesters: ProtesterId[];
}

export const LEVELS: readonly LevelDef[] = [
  { level: 0, legit: 0, unit: 'riot', protesters: ['student', 'woke'] },
  { level: 1, legit: 10, unit: 'sniper', protesters: [] },
  { level: 2, legit: 30, unit: 'blockade', protesters: ['mob'] },
  { level: 3, legit: 50, unit: 'gas', protesters: [] },
  { level: 4, legit: 100, unit: 'mounted', protesters: ['veryViolent'] },
  { level: 5, legit: 200, unit: 'armed', protesters: [] },
  { level: 6, legit: 300, unit: 'soldier', protesters: ['crazy'] },
  { level: 7, legit: 500, unit: 'humvee', protesters: [] },
  { level: 8, legit: 800, unit: 'brigade', protesters: ['cultist'] },
  { level: 9, legit: 1200, unit: 'tank', protesters: [] },
  { level: 10, legit: 2000, unit: 'heli', protesters: ['prophet'] },
];

export const MAX_LEVEL = LEVELS.length - 1;

/** Legitimacy that wins the run. */
export const WIN_LEGITIMACY = 5000;

/** Level reached with `legit` Legitimacy. */
export function levelForLegit(legit: number): number {
  let lvl = 0;
  for (const l of LEVELS) if (legit >= l.legit) lvl = l.level;
  return lvl;
}

/** Legitimacy needed for the next level, or null at max level. */
export function nextLevelLegit(level: number): number | null {
  return LEVELS[level + 1]?.legit ?? null;
}

/** Units unlocked at `level` (cumulative). */
export function unlockedUnits(level: number): UnitId[] {
  return LEVELS.filter((l) => l.level <= level).map((l) => l.unit);
}

/** Protester types in the wave mix at `level` (cumulative). */
export function unlockedProtesters(level: number): ProtesterId[] {
  return LEVELS.filter((l) => l.level <= level).flatMap((l) => l.protesters);
}

/** Level at which a protester type joins the mix (-1 for specials). */
export function protesterUnlockLevel(id: ProtesterId): number {
  for (const l of LEVELS) if (l.protesters.includes(id)) return l.level;
  return -1;
}
