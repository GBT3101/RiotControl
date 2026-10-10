/**
 * Debug scenarios for screenshots and visual checks (`?scene=showcase`): every unit type
 * deployed around the camera start, a crowd of every protester type marching in, a sniper roof
 * left unguarded for the climbers, a gas grenade ready; `?scene=skills`: the five special-skill
 * units charged in front of a crowd. Not used by normal play.
 */
import { PT } from '../data/protesters';
import type { UnitId } from '../data/units';
import type { World } from '../sim/world';

/** Road tiles by distance to (ci, cj). */
function roadsNear(w: World, ci: number, cj: number, r: number): Array<{ i: number; j: number }> {
  const out: Array<{ i: number; j: number; d: number }> = [];
  for (let j = Math.max(0, cj - r); j < Math.min(w.map.h, cj + r); j++) {
    for (let i = Math.max(0, ci - r); i < Math.min(w.map.w, ci + r); i++) {
      if (!w.nav.road[j * w.map.w + i]) continue;
      out.push({ i, j, d: (i - ci) ** 2 + (j - cj) ** 2 });
    }
  }
  return out.sort((a, b) => a.d - b.d || a.i - b.i || a.j - b.j);
}

/**
 * Set up a debug scenario; returns the tile the camera should look at (or null).
 * `showcase`: everything at once · `climb`: an unguarded sniper roof with climbers on its
 * visible facade · `gas`: a tear-gas shooter with a charged grenade facing a crowd.
 */
export function setupScene(w: World, name: string): { i: number; j: number } | null {
  if (name === 'climb') return climbScene(w);
  if (name === 'gas') return gasScene(w);
  if (name === 'skills') return skillsScene(w);
  if (name !== 'showcase') return null;
  const e = w.economy;
  e.level = 10;
  e.legit = 2000;
  e.hate = 99999;
  const c = w.map.cameraStart;
  const roads = roadsNear(w, c.i, c.j, 16);
  const used = new Set<string>();
  const place = (unit: UnitId, minD: number, spacing = 2): boolean => {
    for (const p of roads) {
      if ((p.i - c.i) ** 2 + (p.j - c.j) ** 2 < minD * minD) continue;
      let close = false;
      for (const k of used) {
        const [a, b] = k.split(',').map(Number) as [number, number];
        if (Math.abs(a - p.i) < spacing && Math.abs(b - p.j) < spacing) close = true;
      }
      if (close) continue;
      if (w.deploy(unit, p.i, p.j)) {
        used.add(`${p.i},${p.j}`);
        return true;
      }
    }
    return false;
  };
  for (const u of [
    'riot',
    'riot',
    'riot',
    'gas',
    'armed',
    'soldier',
    'mounted',
    'blockade',
  ] as UnitId[])
    place(u, 3);
  place('humvee', 6, 3);
  place('tank', 8, 4);
  place('heli', 2, 3);
  // Snipers on the nearest rooftops (one left unguarded far from the riot line).
  const roofs = w.map.buildings
    .filter((b) => b.rooftop)
    .sort(
      (a, b) =>
        (a.i + a.w / 2 - c.i) ** 2 +
        (a.j + a.d / 2 - c.j) ** 2 -
        ((b.i + b.w / 2 - c.i) ** 2 + (b.j + b.d / 2 - c.j) ** 2),
    );
  let n = 0;
  for (const b of roofs) {
    if (n >= 3) break;
    if (w.deploy(n === 1 ? 'brigade' : 'sniper', b.i, b.j)) n++;
  }
  for (const u of w.units.active) if (u.def.ability) u.charge = u.def.ability.charge - 0.5;
  // A crowd of every type around the far side of the camera start.
  const types = [
    PT.student,
    PT.woke,
    PT.mob,
    PT.veryViolent,
    PT.crazy,
    PT.cultist,
    PT.prophet,
    PT.woke,
  ];
  const spots = roadsNear(w, c.i - 10, c.j - 10, 12);
  for (let k = 0; k < 260; k++) {
    const p = spots[(k * 7) % Math.max(1, spots.length)];
    if (!p) break;
    w.spawnProtester(
      types[k % types.length]!,
      p.i + 0.2 + (k % 5) * 0.15,
      p.j + 0.3 + (k % 3) * 0.2,
    );
  }
  w.startWaves();
  return null;
}

function stunned(w: World, s: number, hp: number): void {
  tough(w, s, hp);
  if (s >= 0) w.crowd.stun[s] = 600;
}

function tough(w: World, s: number, hp: number): void {
  if (s < 0) return;
  w.crowd.hp[s] = hp;
  w.crowd.maxHp[s] = hp;
}

function climbScene(w: World): { i: number; j: number } | null {
  w.economy.level = 8;
  w.economy.hate = 9999;
  const c = w.map.cameraStart;
  // A rooftop building with walkable tiles along its +j (front-left, visible) face.
  const cands = w.map.buildings
    .filter((b) => b.rooftop && b.storeys >= 3)
    .map((b) => {
      let front = 0;
      for (let i = b.i; i < b.i + b.w; i++) if (w.nav.walk[(b.j + b.d) * w.map.w + i]) front++;
      return { b, front, d: (b.i - c.i) ** 2 + (b.j - c.j) ** 2 };
    })
    .filter((x) => x.front >= 2)
    .sort((x, y) => x.d - y.d);
  const pick = cands[0]?.b;
  if (!pick) return null;
  const sniperBrigade = cands[1]?.b;
  w.deploy('sniper', pick.i, pick.j);
  if (sniperBrigade) w.deploy('brigade', sniperBrigade.i, sniperBrigade.j);
  const types = [PT.woke, PT.mob, PT.veryViolent];
  for (const B of [pick, sniperBrigade]) {
    if (!B) continue;
    for (let k = 0; k < 6; k++) {
      const i = B.i + (k % B.w);
      const j = B.j + B.d + 1 + (k % 2);
      if (!w.nav.walk[j * w.map.w + i]) continue;
      tough(w, w.spawnProtester(types[k % 3]!, i + 0.5, j + 0.4), 400);
    }
  }
  return { i: pick.i + (pick.w >> 1), j: pick.j + pick.d + 1 };
}

/** No building / landmark in the 5 tile rows in front of (screen-below) the tile. */
function openFront(w: World, q: { i: number; j: number }): boolean {
  for (let k = 1; k <= 5; k++) {
    for (let s = -2; s <= 2; s++) {
      const i = q.i + k + s;
      const j = q.j + k - s;
      if (i < 0 || j < 0 || i >= w.map.w || j >= w.map.h) return false;
      if (!w.nav.walk[j * w.map.w + i]) return false;
    }
  }
  return true;
}

function gasScene(w: World): { i: number; j: number } | null {
  w.economy.level = 3;
  w.economy.hate = 9999;
  const c = w.map.cameraStart;
  const nav = w.nav;
  const mw = w.map.w;
  // A road tile 8–14 flow steps out from the Capitol, with open road up-stream of it.
  // Open ground (plazas / wide avenues) so the cloud is not hidden behind a block.
  const roads = roadsNear(w, c.i, c.j, 20).filter((p) => {
    const d = nav.dist[p.j * mw + p.i]!;
    return d >= 6 && d <= 16 && roadsNear(w, p.i, p.j, 4).length >= 40;
  });
  // Strict pass first (crowd in the open with nothing in front), then any open road.
  for (const strict of [true, false]) {
    for (const p of roads) {
      const d0 = nav.dist[p.j * mw + p.i]!;
      const up = roadsNear(w, p.i, p.j, 6).filter((q) => {
        const d = nav.dist[q.j * mw + q.i]!;
        // M14: the crowd (and so the cloud) stands in the open, not tucked behind a block.
        if (d <= d0 + 3 || d >= d0 + 7) return false;
        return !strict || (roadsNear(w, q.i, q.j, 3).length >= 30 && openFront(w, q));
      });
      if (up.length < (strict ? 4 : 6)) continue;
      const u = w.deploy('gas', p.i, p.j);
      if (!u) continue;
      u.charge = (u.def.ability?.charge ?? 10) - 0.2;
      for (let k = 0; k < 48; k++) {
        const q = up[k % up.length]!;
        tough(
          w,
          w.spawnProtester(k % 2 ? PT.student : PT.woke, q.i + 0.3 + (k % 3) * 0.2, q.j + 0.4),
          150,
        );
      }
      return { i: p.i - 2, j: p.j - 2 };
    }
  }
  return null;
}

/**
 * Special skills (docs/specials.md): Mounted Riot Police, Armed Cops, Soldiers, a Tank and the
 * Helicopter, all charged, on open road a few tiles from a dense (tough) crowd. Use them from the
 * console / a script: `__riot.game.useAbility(id)`.
 */
function skillsScene(w: World): { i: number; j: number } | null {
  w.economy.level = 10;
  w.economy.hate = 99999;
  const nav = w.nav;
  const mw = w.map.w;
  const steps = w.map.capitol.steps;
  const s0 = steps[steps.length >> 1] ?? w.map.cameraStart;
  const dist = (q: { i: number; j: number }): number => nav.dist[q.j * mw + q.i]!;
  // Open road a few steps out from the Capitol steps, the crowd further up the same approach.
  // Open ground with nothing tall in front of it (screen-below), so every skill reads.
  const open = (p: { i: number; j: number }): number => {
    let n = 0;
    for (let k = -1; k <= 6; k++)
      for (let q = -3; q <= 3; q++) {
        const i = p.i + k + q;
        const j = p.j + k - q;
        if (i >= 0 && j >= 0 && i < mw && j < w.map.h && nav.walk[j * mw + i]) n++;
      }
    return n;
  };
  const roads = roadsNear(w, s0.i, s0.j, 16)
    .filter((p) => dist(p) >= 4 && dist(p) <= 12)
    .sort((a, b) => open(b) - open(a));
  for (const p of roads) {
    const d0 = dist(p);
    const up = roadsNear(w, p.i, p.j, 8).filter((q) => {
      const e = Math.hypot(q.i - p.i, q.j - p.j);
      return dist(q) > d0 + 1 && e >= 3.5 && e <= 7 && open(q) >= 46;
    });
    if (up.length < 12) continue;
    const near = roadsNear(w, p.i, p.j, 4);
    let k = 0;
    for (const unit of ['tank', 'soldier', 'armed', 'mounted'] as UnitId[]) {
      while (k < near.length && !w.deploy(unit, near[k]!.i, near[k]!.j)) k += 2;
      k += 3;
    }
    w.deploy('heli', p.i + 1, p.j + 1);
    // The crowd holds still (long stun) so each skill can be watched on it.
    for (let n = 0; n < 140; n++) {
      const q = up[n % up.length]!;
      stunned(
        w,
        w.spawnProtester(
          [PT.student, PT.woke, PT.mob][n % 3]!,
          q.i + 0.2 + (n % 4) * 0.2,
          q.j + 0.2 + ((n >> 2) % 3) * 0.3,
        ),
        300,
      );
    }
    for (const u of w.units.active) {
      if (u.def.ability) u.charge = u.def.ability.charge - 0.2;
      // The tank's main gun (friendly fire) holds: its missile is the show here.
      if (u.type === 'tank') u.cd = 1e6;
    }
    w.startWaves();
    const ci = up.reduce((a, q) => a + q.i, 0) / up.length;
    const cj = up.reduce((a, q) => a + q.j, 0) / up.length;
    return { i: Math.round((p.i + ci) / 2), j: Math.round((p.j + cj) / 2) };
  }
  return null;
}
