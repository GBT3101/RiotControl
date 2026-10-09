/**
 * Capitol integrity (PLAN §1.4 "Arrival at Capitol"). Protesters on the steps chip at it every
 * second (per-type DPS); 0 → defeat. Five damage states for the view (graffiti → smashed
 * windows → fires → toppled statues → collapsing), state 0 = pristine.
 */
import { BALANCE } from '../data/balance';
import { snapshotStats } from './stats';
import type { World } from './world';

export class Capitol {
  readonly maxHp: number = BALANCE.capitolHp;
  hp: number = BALANCE.capitolHp;
  /** 0 pristine … 5 collapsing. */
  state = 0;
  /** Protesters currently attacking (counted by the crowd update each tick). */
  attackers = 0;
  private pending = 0;
  private eventT = 0;

  /** Integrity fraction 0..1. */
  get integrity(): number {
    return Math.max(0, this.hp / this.maxHp);
  }

  /** State for an integrity fraction. */
  static stateFor(integrity: number): number {
    let st = 0;
    for (const th of BALANCE.capitolDamageThresholds) if (integrity < th) st++;
    return st;
  }

  /** Called by attacking protesters. */
  damage(w: World, amount: number): void {
    if (amount <= 0 || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.pending += amount;
    w.stats.capitolDamage += amount;
    const st = Capitol.stateFor(this.integrity);
    if (st !== this.state) {
      this.state = st;
      w.events.push('capitolState', { state: st, integrity: this.integrity });
    }
    if (this.hp <= 0 && w.phase === 'playing') {
      this.flush(w);
      w.phase = 'defeat';
      w.syncStats();
      w.events.push('defeat', { stats: snapshotStats(w.stats) });
    }
  }

  update(w: World, dt: number): void {
    this.eventT -= dt;
    if (this.eventT <= 0 && this.pending > 0) this.flush(w);
  }

  private flush(w: World): void {
    w.events.push('capitolDamaged', {
      amount: this.pending,
      integrity: this.integrity,
      state: this.state,
    });
    this.pending = 0;
    this.eventT = BALANCE.capitolEventInterval;
  }
}
