/**
 * Wave director (PLAN §1.5): prep phase → waves → breathers → …
 *
 * - Wave size from (wave index, level, elapsed time) — `data/balance.waveSize`.
 * - Composition: unlocked protester types weighted toward the newest ones; a type that joins
 *   mid-run ramps in over a few waves (`introStart`/`introStep`).
 * - Spawn districts unlock by `SpawnDistrict.unlockWave`; protesters exit building doors in
 *   groups (one door per group), throttled per door, per tick and by the quality tier's
 *   concurrency cap (the queue waits while the crowd is at the cap).
 * - Breta: 1% roll per spawn group (max one alive) — she leads the group with 6–10 paparazzi.
 * - Breathers (`BALANCE.waves.breather`, 16–24 s) end automatically; `callNextWaveEarly()` pays
 *   Hate = remaining / 2.
 */
import { BALANCE, breatherSeconds, spawnSeconds, waveSize } from '../data/balance';
import { protesterUnlockLevel, unlockedProtesters } from '../data/levels';
import { PT, protesterDef } from '../data/protesters';
import { gainHate } from './economy';
import { spawnProtester } from './spawn';
import type { World } from './world';

export type DirectorPhase = 'prep' | 'wave' | 'breather';

interface Door {
  building: number;
  i: number;
  j: number;
}

class Emitter {
  active = false;
  district = -1;
  door: Door = { building: -1, i: 0, j: 0 };
  remaining = 0;
  t = 0;
  breta = false;
  paparazzi = 0;
}

export class Director {
  phase: DirectorPhase = 'prep';
  /** Current (or last) wave, 1-based; 0 before the first wave. */
  wave = 0;
  /** Regular protesters in the current wave. */
  waveSize = 0;
  /** Regular protesters still queued for the current wave. */
  toSpawn = 0;
  /** Seconds left in the breather. */
  breather = 0;
  breatherTotal = 0;
  /** Seconds since the current wave finished spawning. */
  tail = 0;
  private groupT = 0;
  private readonly emitters: Emitter[] = [];
  private readonly districtDoors: Door[][];
  private readonly districtWave: number[];
  private types: number[] = [];
  private weights: number[] = [];
  /** Protester type → wave in which it first joined the mix (intro ramp). */
  private readonly joined = new Map<number, number>();
  /** Spawns blocked by the concurrency cap this tick (diagnostics). */
  capped = false;

  constructor(w: World) {
    for (let k = 0; k < BALANCE.waves.maxEmitters; k++) this.emitters.push(new Emitter());
    this.districtDoors = w.map.spawns.map((d) => {
      const doors: Door[] = [];
      for (const bid of d.buildingIds) {
        const b = w.map.buildings[bid];
        if (!b) continue;
        for (const door of b.doors) {
          if (w.nav.inBounds(door.i, door.j) && w.nav.walk[door.j * w.map.w + door.i]) {
            doors.push({ building: bid, i: door.i, j: door.j });
          }
        }
      }
      return doors;
    });
    this.districtWave = w.map.spawns.map((d) => d.unlockWave);
  }

  /** Leave the prep phase ("Let them come"). */
  startWaves(w: World): boolean {
    if (this.phase !== 'prep') return false;
    this.beginWave(w);
    return true;
  }

  /** During a breather: start the next wave now for bonus Hate. Returns the bonus (0 if not possible). */
  callNextWaveEarly(w: World): number {
    if (this.phase !== 'breather') return 0;
    const bonus = Math.floor(this.breather * BALANCE.waves.callEarlyFactor);
    if (bonus > 0) gainHate(w, bonus, w.map.capitol.i, w.map.capitol.j, 'callEarly');
    this.beginWave(w);
    return bonus;
  }

  /** Indices of spawn districts active in `wave`. */
  activeDistricts(wave: number): number[] {
    const out: number[] = [];
    for (let d = 0; d < this.districtDoors.length; d++) {
      if (this.districtWave[d]! <= wave && this.districtDoors[d]!.length > 0) out.push(d);
    }
    if (out.length === 0) {
      // Fallback: the earliest districts that have doors.
      let min = Infinity;
      for (let d = 0; d < this.districtDoors.length; d++) {
        if (this.districtDoors[d]!.length > 0) min = Math.min(min, this.districtWave[d]!);
      }
      for (let d = 0; d < this.districtDoors.length; d++) {
        if (this.districtWave[d] === min && this.districtDoors[d]!.length > 0) out.push(d);
      }
    }
    return out;
  }

  private beginWave(w: World): void {
    this.wave++;
    this.phase = 'wave';
    this.waveSize = waveSize(this.wave, w.economy.level, w.time);
    this.toSpawn = this.waveSize;
    this.tail = 0;
    this.groupT = 0;
    this.breather = 0;
    // Composition weights: newest types boosted.
    const lvl = w.economy.level;
    const ids = unlockedProtesters(lvl);
    this.types = ids.map((id) => PT[id]);
    const wv = BALANCE.waves;
    this.weights = ids.map((id) => {
      const t = PT[id];
      if (!this.joined.has(t)) this.joined.set(t, this.wave);
      const since = this.wave - this.joined.get(t)!;
      // Types joining mid-run start as a trickle and ramp up (time to answer the threat).
      const ramp = this.joined.get(t) === 1 ? 1 : Math.min(1, wv.introStart + wv.introStep * since);
      const ul = protesterUnlockLevel(id);
      const boost = ul >= 0 && ul >= lvl - wv.newestWindow && ul > 0;
      return protesterDef(id).weight * ramp * (boost ? wv.newestBoost : 1);
    });
    w.stats.wave = this.wave;
    w.events.push('waveStart', { wave: this.wave, size: this.waveSize });
  }

  private endWave(w: World): void {
    this.phase = 'breather';
    this.breather = this.breatherTotal = breatherSeconds(this.wave);
    w.crowd.compactFreeList();
    w.events.push('waveEnd', { wave: this.wave, breather: this.breather });
  }

  /** Pick a regular protester type for the current wave. */
  rollType(w: World): number {
    if (this.types.length === 0) return PT.student;
    return w.rng.weighted(this.types, this.weights);
  }

  update(w: World, dt: number): void {
    if (this.phase === 'prep') return;
    if (this.phase === 'breather') {
      this.breather -= dt;
      if (this.breather <= 0) this.beginWave(w);
      return;
    }
    const wv = BALANCE.waves;
    const scale = Math.min(4, Math.max(1, this.waveSize / 150));
    // Open new door groups.
    this.groupT -= dt;
    if (this.toSpawn > 0 && this.groupT <= 0) {
      let em: Emitter | null = null;
      for (const e of this.emitters) {
        if (!e.active) {
          em = e;
          break;
        }
      }
      if (em) {
        const size = this.openGroup(w, em, scale);
        // Spread the wave's groups over its spawn window (a stream, not a burst).
        const [lo, hi] = wv.groupInterval;
        this.groupT = w.rng.range(lo, hi) * size * (spawnSeconds(this.waveSize) / this.waveSize);
      }
    }
    // Emit.
    const cap = BALANCE.concurrency[w.quality];
    let budget = wv.maxSpawnsPerTick;
    this.capped = false;
    let anyActive = false;
    for (const em of this.emitters) {
      if (!em.active) continue;
      anyActive = true;
      em.t -= dt;
      while (em.t <= 0 && budget > 0) {
        if (w.crowd.count >= cap || w.crowd.full) {
          this.capped = true;
          em.t = 0;
          break;
        }
        this.emitOne(w, em);
        budget--;
        em.t += wv.emitInterval;
        if (!em.active) break;
      }
    }
    if (this.toSpawn <= 0 && !anyActive) {
      this.tail += dt;
      const alive = w.crowd.count;
      if (alive <= Math.max(3, this.waveSize * wv.endAliveFraction) || this.tail >= wv.endTimeout) {
        this.endWave(w);
      }
    }
  }

  /** Opens a door group; returns its size. */
  private openGroup(w: World, em: Emitter, scale: number): number {
    const rng = w.rng;
    const districts = this.activeDistricts(this.wave);
    if (districts.length === 0) {
      this.toSpawn = 0;
      return 0;
    }
    const d = rng.pick(districts);
    const door = rng.pick(this.districtDoors[d]!);
    em.district = d;
    const [lo, hi] = BALANCE.waves.groupSize;
    const size = Math.min(this.toSpawn, Math.round(rng.int(lo, hi) * scale));
    this.toSpawn -= size;
    em.active = true;
    em.door = door;
    em.remaining = size;
    em.t = 0;
    em.breta = false;
    em.paparazzi = 0;
    const br = BALANCE.waves.breta;
    let bretaPending = false;
    for (const e of this.emitters) if (e.active && e.breta) bretaPending = true;
    if (w.bretaSlot < 0 && !bretaPending && rng.chance(br.chance)) {
      em.breta = true;
      em.paparazzi = rng.int(br.paparazzi[0], br.paparazzi[1]);
    }
    return size;
  }

  private emitOne(w: World, em: Emitter): void {
    const rng = w.rng;
    const x = em.door.i + 0.5 + rng.range(-0.3, 0.3);
    const y = em.door.j + 0.5 + rng.range(-0.3, 0.3);
    const opts = {
      mill: true,
      building: em.door.building,
      doorI: em.door.i,
      doorJ: em.door.j,
      district: em.district,
    };
    if (em.breta) {
      em.breta = false;
      const s = spawnProtester(w, PT.breta, x, y, opts);
      if (s >= 0) {
        w.events.push('bretaSpawned', { handle: w.crowd.handle(s), x, y, paparazzi: em.paparazzi });
      }
      return;
    }
    if (em.paparazzi > 0) {
      em.paparazzi--;
      spawnProtester(w, PT.paparazzi, x, y, opts);
      return;
    }
    spawnProtester(w, this.rollType(w), x, y, opts);
    em.remaining--;
    if (em.remaining <= 0) em.active = false;
  }

  /** Remaining protesters (queued + emitting) of the current wave. */
  get pending(): number {
    let n = this.toSpawn;
    for (const e of this.emitters) if (e.active) n += e.remaining;
    return n;
  }
}
