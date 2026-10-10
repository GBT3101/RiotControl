import { describe, expect, it } from 'vitest';
import { avenueWorld, eventsOf } from './sim-fixtures';

describe('placement validation', () => {
  it('road units: placeable road, unlocked, affordable, not occupied', () => {
    const w = avenueWorld();
    expect(w.canDeploy('riot', 6, 8)).toMatchObject({ ok: true, cost: 5 });
    expect(w.canDeploy('riot', 4, 8).ok).toBe(true); // sidewalk is road
    expect(w.canDeploy('riot', 1, 8).reason).toBe('notRoad'); // lot
    expect(w.canDeploy('riot', 7, 15).ok).toBe(true); // Capitol steps: the last line (M12)
    w.economy.level = 2;
    expect(w.canDeploy('blockade', 7, 15).reason).toBe('notRoad'); // …but never walled off
    w.economy.level = 0;
    expect(w.canDeploy('riot', 99, 8).reason).toBe('bounds');
    expect(w.canDeploy('sniper', 12, 6).reason).toBe('locked');
    const u = w.deploy('riot', 6, 8)!;
    expect(u.x).toBe(6.5);
    expect(w.canDeploy('riot', 6, 8).reason).toBe('occupied');
    expect(w.deploy('riot', 6, 8)).toBeNull();
    w.economy.hate = 2;
    expect(w.canDeploy('riot', 7, 8).reason).toBe('hate');
    const ev = w.events.drain();
    expect(eventsOf(ev, 'unitDeployed')).toHaveLength(1);
    expect(eventsOf(ev, 'hateSpent')[0]!.amount).toBe(5);
  });

  it('rooftop: building with rooftop flag, one unit per roof (brigade squad of 3)', () => {
    const w = avenueWorld();
    w.economy.level = 8;
    w.economy.hate = 2000;
    expect(w.canDeploy('sniper', 6, 8).reason).toBe('notRooftop');
    const chk = w.canDeploy('sniper', 12, 6);
    expect(chk.ok).toBe(true);
    expect(chk.tiles).toHaveLength(9);
    const s = w.deploy('sniper', 12, 6)!;
    expect(s.building).toBeGreaterThanOrEqual(0);
    expect([s.x, s.y]).toEqual([12.5, 6.5]);
    expect(s.z).toBe(3);
    expect(w.canDeploy('sniper', 11, 5).reason).toBe('roofTaken');
    expect(w.canDeploy('brigade', 13, 7).reason).toBe('roofTaken');
    expect(w.canDeploy('riot', 12, 6).reason).toBe('notRoad');
    const b = w.deploy('brigade', 0, 0)!; // residential block A is also a rooftop
    expect(b.members).toBe(3);
  });

  it('air: anywhere on the map', () => {
    const w = avenueWorld();
    w.economy.level = 10;
    w.economy.hate = 5000;
    expect(w.canDeploy('heli', 0, 17).ok).toBe(true); // lot
    expect(w.canDeploy('heli', 12, 6).ok).toBe(true); // roof
    const h = w.deploy('heli', 7, 7)!;
    expect(h.z).toBeGreaterThan(0);
    expect(w.canDeploy('heli', 7, 7).ok).toBe(true); // air does not occupy tiles
  });

  it('blockade snaps across the road (up to 3 tiles) and blocks movement', () => {
    const w = avenueWorld();
    w.economy.level = 2;
    const chk = w.canDeploy('blockade', 7, 9);
    expect(chk.ok).toBe(true);
    // Avenue runs along j, so the blockade spans along i, centred on the pick.
    expect(chk.tiles).toEqual([
      { i: 6, j: 9 },
      { i: 7, j: 9 },
      { i: 8, j: 9 },
    ]);
    // Next to an occupied tile the span shifts to the free side.
    w.deploy('riot', 9, 9);
    const chk2 = w.canDeploy('blockade', 8, 9);
    expect(chk2.tiles.map((t) => t.i)).toEqual([6, 7, 8]);
    const b = w.deploy('blockade', 8, 9)!;
    expect(b.tiles).toHaveLength(3);
    expect(w.nav.solid[9 * w.map.w + 7]).toBe(1);
    expect(w.canDeploy('riot', 7, 9).reason).toBe('occupied');
    // At the kerb the span is limited by the road edge.
    const chk3 = w.canDeploy('blockade', 4, 11);
    expect(chk3.tiles[0]).toEqual({ i: 4, j: 11 });
    expect(chk3.tiles).toHaveLength(3);
  });
});
