/**
 * Persistent area effects: tear-gas clouds and fire patches (molotovs, burning wrecks).
 *
 * team 0 (police-made: gas grenades, wreck fires) harms protesters; team 1 (protester-made:
 * molotov fire) harms Ministry ground units. Effects are applied every `AREA_PULSE` seconds as
 * status refreshes (gas → choking DoT + stun, fire → burning DoT), so the DoT itself runs in
 * the crowd/unit updates.
 */
import { PS } from './crowd';
import type { AreaKind } from './events';
import type { World } from './world';

const AREA_PULSE = 0.25;
const areaBuf = new Int32Array(4096);

export class Area {
  id = 0;
  kind: AreaKind = 'gas';
  team = 0;
  x = 0;
  y = 0;
  r = 1;
  ttl = 0;
  /** Initial lifetime (view: fade = ttl / dur). */
  dur = 1;
  dps = 0;
  stun = 0;
  pulse = 0;
}

export class Areas {
  active: Area[] = [];
  private readonly pool: Area[] = [];
  private nextId = 1;

  spawnArea(
    w: World,
    kind: AreaKind,
    x: number,
    y: number,
    r: number,
    ttl: number,
    dps: number,
    stun: number,
    team: number,
  ): Area {
    const a = this.pool.pop() ?? new Area();
    a.id = this.nextId++;
    a.kind = kind;
    a.team = team;
    a.x = x;
    a.y = y;
    a.r = r;
    a.ttl = a.dur = ttl;
    a.dps = dps;
    a.stun = stun;
    a.pulse = 0;
    this.active.push(a);
    w.events.push('areaCreated', { areaId: a.id, kind, x, y, radius: r, ttl });
    return a;
  }

  update(w: World, dt: number): void {
    const list = this.active;
    const c = w.crowd;
    for (let k = list.length - 1; k >= 0; k--) {
      const a = list[k]!;
      a.ttl -= dt;
      if (a.ttl <= 0) {
        list[k] = list[list.length - 1]!;
        list.pop();
        this.pool.push(a);
        continue;
      }
      a.pulse -= dt;
      if (a.pulse > 0) continue;
      a.pulse += AREA_PULSE;
      if (a.team === 0) {
        const n = w.hash.query(c, a.x, a.y, a.r, areaBuf);
        for (let q = 0; q < n; q++) {
          const s = areaBuf[q]!;
          const st = c.state[s]!;
          if (st === PS.ON_ROOF || st === PS.CLIMBING || st === PS.CLIMB_DOWN) continue;
          if (a.kind === 'gas') {
            // Stun on entering the cloud only (not refreshed every pulse): a stagger, then
            // they cough their way through at reduced speed (M12 — stun-lock was overpowered).
            if (a.stun > 0 && c.gasT[s]! <= 0) c.stun[s] = Math.max(c.stun[s]!, a.stun);
            c.gasT[s] = Math.max(c.gasT[s]!, 1);
          } else {
            c.burnT[s] = Math.max(c.burnT[s]!, 1);
          }
        }
      } else {
        const units = w.units.active;
        for (let q = 0; q < units.length; q++) {
          const u = units[q]!;
          if (!u.alive || u.building >= 0 || u.def.placement === 'air') continue;
          const dx = u.x - a.x;
          const dy = u.y - a.y;
          const rr = a.r + u.def.radius;
          if (dx * dx + dy * dy > rr * rr) continue;
          u.burnT = Math.max(u.burnT, 1);
          u.burnDps = Math.max(u.burnDps, a.dps);
        }
      }
    }
  }
}
