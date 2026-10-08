/**
 * Tiny deterministic "patrol" sim for the M1 demo: officers wander the road network along the
 * iso axes, pausing now and then. Pure logic (fixed 30 Hz steps), rendered with interpolation.
 */
import { facingFromTileDelta, type Facing } from '../core/iso';
import { Rng } from '../core/rng';
import type { TestMap } from './testMap';

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface Walker {
  /** Continuous tile coords now and at the previous step (for interpolation). */
  u: number;
  v: number;
  pu: number;
  pv: number;
  du: number;
  dv: number;
  /** Tiles per second. */
  speed: number;
  /** Remaining idle time in seconds (> 0 = standing). */
  idle: number;
  facing: Facing;
  variant: number;
  /** Animation phase offset (s) so the crowd doesn't march in lockstep. */
  phase: number;
}

export class WalkerSim {
  readonly walkers: Walker[] = [];
  private readonly rng: Rng;

  constructor(
    private readonly map: TestMap,
    count: number,
    seed: number,
    variants: number,
  ) {
    this.rng = new Rng(seed).fork('walkers');
    const spots: Array<[number, number]> = [];
    for (let j = 0; j < map.size; j++) {
      for (let i = 0; i < map.size; i++) if (map.walkable(i, j)) spots.push([i, j]);
    }
    // Bias spawns toward the central plaza so the default view is lively.
    const centre = map.size / 2;
    for (let k = 0; k < count; k++) {
      const [i, j] = this.rng.weighted(spots, (s) => {
        const d = Math.hypot(s[0] - centre, s[1] - centre);
        return d < 14 ? 6 : 1;
      });
      const w: Walker = {
        u: i + 0.5,
        v: j + 0.5,
        pu: i + 0.5,
        pv: j + 0.5,
        du: 0,
        dv: 0,
        speed: this.rng.range(1.0, 1.35),
        idle: this.rng.chance(0.3) ? this.rng.range(0.5, 4) : 0,
        facing: this.rng.pick(['se', 'sw', 'ne', 'nw'] as const),
        variant: this.rng.int(0, variants - 1),
        phase: this.rng.range(0, 10),
      };
      this.chooseDir(w);
      this.walkers.push(w);
    }
  }

  private chooseDir(w: Walker): void {
    const i = Math.floor(w.u);
    const j = Math.floor(w.v);
    const options = DIRS.filter(([du, dv]) => this.map.walkable(i + du, j + dv));
    // Prefer going straight; avoid reversing unless it's a dead end.
    const straight = options.find(([du, dv]) => du === w.du && dv === w.dv);
    const nonReverse = options.filter(([du, dv]) => du !== -w.du || dv !== -w.dv);
    let pick: readonly [number, number] | undefined;
    if (straight && this.rng.chance(0.8)) pick = straight;
    else if (nonReverse.length) pick = this.rng.pick(nonReverse);
    else pick = options[0];
    w.du = pick?.[0] ?? 0;
    w.dv = pick?.[1] ?? 0;
    if (w.du || w.dv) w.facing = facingFromTileDelta(w.du, w.dv);
  }

  step(dt: number): void {
    for (const w of this.walkers) {
      w.pu = w.u;
      w.pv = w.v;
      if (w.idle > 0) {
        w.idle -= dt;
        continue;
      }
      const ci = Math.floor(w.u);
      const cj = Math.floor(w.v);
      const cu = ci + 0.5;
      const cv = cj + 0.5;
      const before = (w.u - cu) * w.du + (w.v - cv) * w.dv;
      w.u += w.du * w.speed * dt;
      w.v += w.dv * w.speed * dt;
      const after = (w.u - cu) * w.du + (w.v - cv) * w.dv;
      // Crossed the centre of the current tile: decide where to go next.
      if (before < 0 && after >= 0) {
        w.u = cu;
        w.v = cv;
        if (this.rng.chance(0.04)) {
          w.idle = this.rng.range(0.8, 3);
          continue;
        }
        const ahead = this.map.walkable(ci + w.du, cj + w.dv);
        if (!ahead || this.rng.chance(0.12)) this.chooseDir(w);
      }
    }
  }
}
