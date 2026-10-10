/**
 * M4c vehicles: catalogue completeness, frame/anchor sanity, palette purity, facing helpers and
 * integration offsets.
 */
import { describe, expect, it } from 'vitest';
import { SpriteRegistry } from '../src/art/lib/registry';
import { PALETTE_RGB, SHADOW, SWATCHES } from '../src/art/palette';
import { CIVIL_IDS } from '../src/art/vehicles/civil';
import { DIR16, DIR4, DIR8, dirToTile, facing16, facing8 } from '../src/art/vehicles/dirs';
import { registerVehicles } from '../src/art/vehicles';
import { text } from '../src/art/vehicles/stamps';
import {
  heliHubOffset,
  humveeMuzzle,
  humveeTurretOffset,
  metaTables,
  tankMuzzle,
  tankTurretOffset,
} from '../src/art/vehicles/meta';

const reg = new SpriteRegistry();
registerVehicles(reg);
const defs = reg.list();

describe('vehicle catalogue', () => {
  it('registers everything under veh.* in the vehicles group', () => {
    expect(defs.length).toBeGreaterThan(400);
    for (const d of defs) {
      expect(d.name.startsWith('veh.')).toBe(true);
      expect(d.group).toBe('vehicles');
    }
  });

  it('has 8 facings for humvee, tank hull and helicopter layers', () => {
    for (const d of DIR8) {
      for (const n of [
        `veh.humvee.drive.${d}`,
        `veh.humvee.drive.dmg1.${d}`,
        `veh.humvee.drive.dmg2.${d}`,
        `veh.humvee.wreck.${d}`,
        `veh.humvee.turret.${d}`,
        `veh.humvee.turret.dmg.${d}`,
        `veh.humvee.turret.fire.${d}`,
        `veh.tank.drive.${d}`,
        `veh.tank.drive.dmg1.${d}`,
        `veh.tank.drive.dmg2.${d}`,
        `veh.tank.wreck.${d}`,
        `veh.tank.dust.${d}`,
        `veh.heli.hover.${d}`,
        `veh.heli.fly.${d}`,
        `veh.heli.bankl.${d}`,
        `veh.heli.bankr.${d}`,
        `veh.heli.fire.${d}`,
        `veh.heli.shadow.${d}`,
        `veh.heli.beam.${d}`,
      ]) {
        expect(reg.has(n), n).toBe(true);
      }
    }
    expect(reg.get('veh.humvee.drive.se').frames).toHaveLength(4);
    expect(reg.get('veh.humvee.turret.fire.se').frames).toHaveLength(2);
    expect(reg.get('veh.humvee.wreck.se').frames).toHaveLength(4);
    expect(reg.get('veh.tank.drive.se').frames).toHaveLength(4);
    expect(reg.get('veh.heli.rotor').frames).toHaveLength(4);
    expect(reg.get('veh.heli.downwash').frames).toHaveLength(4);
  });

  it('has a 16-way tank turret with 4-frame non-looping fire', () => {
    for (const d of DIR16) {
      expect(reg.has(`veh.tank.turret.${d}`)).toBe(true);
      const f = reg.get(`veh.tank.turret.fire.${d}`);
      expect(f.frames).toHaveLength(4);
      expect(f.loop).toBe(false);
    }
  });

  it('has decor vehicles on both tile axes, with aftermath variants', () => {
    for (const id of CIVIL_IDS) {
      for (const d of DIR4) {
        expect(reg.has(`veh.${id}.drive.${d}`), id).toBe(true);
        expect(reg.has(`veh.${id}.parked.${d}`), id).toBe(true);
      }
    }
    for (const id of ['hatch', 'sedan', 'car_twingo', 'bus_london', 'bus_madrid', 'bus_paris']) {
      expect(reg.has(`veh.${id}.burnt.se`), id).toBe(true);
    }
    for (const id of ['hatch', 'sedan', 'car_2cv', 'police_van']) {
      expect(reg.has(`veh.${id}.flipped.sw`), id).toBe(true);
    }
    expect(reg.get('veh.police_van.parked.se').frames).toHaveLength(2); // flashing lightbar
  });

  it('has 32×32 deploy-card icons', () => {
    for (const id of ['humvee', 'tank', 'heli']) {
      const d = reg.get(`veh.${id}.icon`);
      expect(d.frames[0]!.w).toBe(32);
      expect(d.frames[0]!.h).toBe(32);
    }
  });
});

describe('vehicle pixels', () => {
  const shadowRgb = parseInt(SWATCHES[SHADOW].slice(1), 16);

  it('uses RIOT-64 only; partial alpha only as the shadow swatch on hasShadow sprites', () => {
    // Collect offenders (one expect per pixel made this test slow enough to time out).
    const bad = new Set<string>();
    for (const d of defs) {
      for (const f of d.frames) {
        for (let i = 0; i < f.data.length; i += 4) {
          const a = f.data[i + 3]!;
          if (a === 0) continue;
          const rgb = (f.data[i]! << 16) | (f.data[i + 1]! << 8) | f.data[i + 2]!;
          if (a < 255) {
            if (!d.hasShadow || rgb !== shadowRgb) bad.add(`${d.name} alpha ${a}`);
          } else if (!PALETTE_RGB.has(rgb)) bad.add(`${d.name} #${rgb.toString(16)}`);
        }
      }
    }
    expect([...bad]).toEqual([]);
  });

  it('keeps anchors inside frames and frames non-empty', () => {
    for (const d of defs) {
      const f0 = d.frames[0]!;
      expect(d.anchor.x).toBeGreaterThanOrEqual(0);
      expect(d.anchor.y).toBeGreaterThanOrEqual(0);
      expect(d.anchor.x).toBeLessThan(f0.w);
      expect(d.anchor.y).toBeLessThan(f0.h);
      expect(
        f0.data.some((v, i) => i % 4 === 3 && v > 0),
        d.name,
      ).toBe(true);
    }
  });

  it('stays within the art-bible size budget', () => {
    const h = reg.get('veh.humvee.drive.se').frames[0]!;
    expect(h.w).toBeGreaterThan(34);
    expect(h.w).toBeLessThan(52);
    const t = reg.get('veh.tank.drive.se').frames[0]!;
    expect(t.w).toBeGreaterThan(44);
    expect(t.w).toBeLessThan(64);
  });

  it('is deterministic', () => {
    const r2 = new SpriteRegistry();
    registerVehicles(r2);
    const a = reg.get('veh.tank.turret.fire.sse').frames[0]!.data;
    const b = r2.get('veh.tank.turret.fire.sse').frames[0]!.data;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  }, 60_000); // two full vehicle registrations (~5 s under parallel load)
});

describe('facings & offsets', () => {
  it('maps tile axes to screen facings (+i SE, −i NW, +j SW, −j NE)', () => {
    expect(facing8(1, 0)).toBe('se');
    expect(facing8(-1, 0)).toBe('nw');
    expect(facing8(0, 1)).toBe('sw');
    expect(facing8(0, -1)).toBe('ne');
    expect(facing8(1, 1)).toBe('s');
    expect(facing8(1, -1)).toBe('e');
    expect(facing16(1, 0.4)).toBe('sse');
    const t = dirToTile('sw');
    expect(t.di).toBeCloseTo(0);
    expect(t.dj).toBeCloseTo(1);
  });

  it('puts the humvee turret on the roof and bobs it with the body', () => {
    const p0 = humveeTurretOffset('se', 0);
    const p1 = humveeTurretOffset('se', 1);
    expect(p0.y).toBeLessThan(-8);
    expect(p1.y).toBe(p0.y - 1);
    expect(humveeMuzzle('e').x).toBeGreaterThan(8);
    expect(humveeMuzzle('w').x).toBeLessThan(-8);
  });

  it('places tank muzzle along the barrel and recoils it', () => {
    expect(tankMuzzle('e').x).toBeGreaterThan(20);
    expect(tankMuzzle('s').y).toBeGreaterThan(10);
    expect(tankMuzzle('e', 0).x).toBeLessThan(tankMuzzle('e').x);
    expect(tankTurretOffset('se').y).toBeLessThan(0);
    expect(heliHubOffset('hover', 'se').y).toBeLessThan(-6);
    const m = metaTables();
    expect(Object.keys(m.tankMuzzle)).toHaveLength(16);
  });
});

describe('M13a vehicle lettering', () => {
  it('micro-font lettering maps every column to its glyph start (stepped decals)', () => {
    const t = text('LONDON', 'ochre3');
    expect(t.cells.length).toBe(t.w);
    expect(t.cells[0]).toBe(0);
    // Columns of one glyph share its start; starts increase monotonically.
    for (let x = 1; x < t.w; x++) expect(t.cells[x]!).toBeGreaterThanOrEqual(t.cells[x - 1]!);
    expect(new Set(t.cells).size).toBe(6);
  });
});
