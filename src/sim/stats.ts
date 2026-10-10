/**
 * Run statistics ledger ("At what cost?" summary, PLAN §1.8). Plain JSON-able data.
 */
import { PROTESTER_IDS, type ProtesterId } from '../data/protesters';
import { UNIT_IDS, type UnitId } from '../data/units';

export interface StatsLedger {
  /** Simulated seconds. */
  time: number;
  wave: number;
  level: number;
  protestersFallen: Record<ProtesterId, number>;
  /** Fallen by lethal vs non-lethal (KO) killing blows. */
  protestersKilled: number;
  protestersKO: number;
  protestersSpawned: number;
  /** Officers lost by unit type (Sniper Brigade counts members). */
  officersLost: Record<UnitId, number>;
  unitsDeployed: Record<UnitId, number>;
  bretaSpawned: number;
  bretaDowned: number;
  hateEarned: number;
  hateSpent: number;
  legitEarned: number;
  peakCrowd: number;
  /** Integrity HP lost in total and the final integrity fraction. */
  capitolDamage: number;
  capitolIntegrity: number;
  /** Damage absorbed by Ministry units. */
  damageTaken: number;
  /** Times a mob rammed an officer over (outnumbering knockdowns, sim/mob.ts). */
  officersRammed: number;
  /** Protesters that started climbing a facade toward a rooftop unit. */
  climbsStarted: number;
}

function zeros<K extends string>(keys: readonly K[]): Record<K, number> {
  const r = {} as Record<K, number>;
  for (const k of keys) r[k] = 0;
  return r;
}

export function createStats(): StatsLedger {
  return {
    time: 0,
    wave: 0,
    level: 0,
    protestersFallen: zeros(PROTESTER_IDS),
    protestersKilled: 0,
    protestersKO: 0,
    protestersSpawned: 0,
    officersLost: zeros(UNIT_IDS),
    unitsDeployed: zeros(UNIT_IDS),
    bretaSpawned: 0,
    bretaDowned: 0,
    hateEarned: 0,
    hateSpent: 0,
    legitEarned: 0,
    peakCrowd: 0,
    capitolDamage: 0,
    capitolIntegrity: 1,
    damageTaken: 0,
    officersRammed: 0,
    climbsStarted: 0,
  };
}

/** Deep copy (for end-state events). */
export function snapshotStats(s: StatsLedger): StatsLedger {
  return {
    ...s,
    protestersFallen: { ...s.protestersFallen },
    officersLost: { ...s.officersLost },
    unitsDeployed: { ...s.unitsDeployed },
  };
}

/** Total protesters fallen. */
export function totalFallen(s: StatsLedger): number {
  let n = 0;
  for (const k of PROTESTER_IDS) n += s.protestersFallen[k];
  return n;
}

export function totalOfficersLost(s: StatsLedger): number {
  let n = 0;
  for (const k of UNIT_IDS) n += s.officersLost[k];
  return n;
}
