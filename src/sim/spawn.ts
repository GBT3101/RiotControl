/**
 * Protester creation (used by the wave director, Breta groups, tests and debug tools).
 */
import { BALANCE } from '../data/balance';
import { PROTESTERS, PT } from '../data/protesters';
import { PANIM, PS } from './crowd';
import type { World } from './world';

export interface SpawnOpts {
  /** Start in SPAWNING (mill at the door) instead of MARCH. */
  mill?: boolean;
  /** Door/building for the `spawned` event (-1 = none). */
  building?: number;
  doorI?: number;
  doorJ?: number;
  /** Force a loadout index (cultists). */
  loadout?: number;
}

/** Spawn one protester at (x, y); returns its slot or -1 when the crowd is full. */
export function spawnProtester(
  w: World,
  type: number,
  x: number,
  y: number,
  opts: SpawnOpts = {},
): number {
  const c = w.crowd;
  const s = c.alloc();
  if (s < 0) return -1;
  const def = PROTESTERS[type]!;
  const rng = w.rng;
  c.type[s] = type;
  c.variant[s] = rng.nextU32();
  c.x[s] = c.px[s] = x;
  c.y[s] = c.py[s] = y;
  c.hp[s] = c.maxHp[s] = def.hp;
  const gv = BALANCE.gaitVariation;
  c.speed[s] = BALANCE.walkSpeed * def.speed * (1 + rng.range(-gv, gv));
  c.lane[s] = rng.range(-1, 1);
  if (def.loadouts.length > 1) {
    c.loadout[s] =
      opts.loadout ?? def.loadouts.indexOf(rng.weighted(def.loadouts, (l) => l.weight));
  } else c.loadout[s] = 0;
  // Stagger first attacks so crowds do not strike in unison.
  c.cd[s] = rng.range(0, 1);
  c.cd2[s] = rng.range(0, 2);
  if (opts.mill) {
    c.state[s] = PS.SPAWNING;
    const [lo, hi] = BALANCE.millTime;
    c.stT[s] = rng.range(lo, hi);
  } else c.state[s] = PS.MARCH;
  if (type === PT.paparazzi && w.bretaSlot >= 0) c.state[s] = PS.FOLLOW;
  c.anim[s] = PANIM.IDLE;
  if (type === PT.breta) {
    w.bretaSlot = s;
    w.stats.bretaSpawned++;
  }
  w.stats.protestersSpawned++;
  w.events.push('spawned', {
    handle: c.handle(s),
    ptype: def.id,
    x,
    y,
    building: opts.building ?? -1,
    doorI: opts.doorI ?? -1,
    doorJ: opts.doorJ ?? -1,
  });
  return s;
}
