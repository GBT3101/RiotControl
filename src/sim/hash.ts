/**
 * Deterministic 32-bit state hash (FNV-1a over float bit patterns) for replay/determinism
 * tests. Covers the crowd, units, projectiles, areas, economy, Capitol, director and RNG.
 */
import type { World } from './world';

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

class Hasher {
  h = 0x811c9dc5;
  int(v: number): void {
    let h = this.h;
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 24) & 0xff;
    this.h = Math.imul(h, 0x01000193);
  }
  num(v: number): void {
    f32[0] = v;
    this.int(u32[0]!);
  }
}

export function hashWorld(w: World): number {
  const H = new Hasher();
  H.int(w.tick);
  for (const v of w.rng.getState()) H.int(v);
  const c = w.crowd;
  H.int(c.count);
  for (let s = 0; s < c.hi; s++) {
    if (!c.alive[s]) continue;
    H.int(s);
    H.int(c.uid[s]!);
    H.int(c.type[s]!);
    H.int(c.state[s]!);
    H.num(c.x[s]!);
    H.num(c.y[s]!);
    H.num(c.hp[s]!);
  }
  for (const u of w.units.active) {
    H.int(u.id);
    H.num(u.x);
    H.num(u.y);
    H.num(u.hp);
    H.int(u.members);
    H.num(u.mob);
    H.num(u.rage);
    H.num(u.charge);
  }
  for (const p of w.projectiles.active) {
    H.int(p.id);
    H.num(p.x);
    H.num(p.y);
  }
  for (const r of w.skills.active) {
    H.int(r.id);
    H.num(r.t);
  }
  for (const a of w.areas.active) {
    H.int(a.id);
    H.num(a.ttl);
  }
  H.num(w.economy.hate);
  H.num(w.economy.legit);
  H.int(w.economy.level);
  H.int(w.economy.killTally);
  H.num(w.capitol.hp);
  H.int(w.director.wave);
  H.int(w.bodies.count);
  return H.h >>> 0;
}
