import { describe, expect, it } from 'vitest';
import { BALANCE, breatherSeconds, waveSize } from '../src/data/balance';
import { armourTable, DMG } from '../src/data/damage';
import {
  LEVELS,
  WIN_LEGITIMACY,
  levelForLegit,
  nextLevelLegit,
  unlockedProtesters,
  unlockedUnits,
} from '../src/data/levels';
import { PROTESTERS, PROTESTER_IDS, PT, protesterDef } from '../src/data/protesters';
import { UNITS, UNIT_IDS } from '../src/data/units';

describe('data tables', () => {
  // Legitimacy is owner-fixed (PLAN §1.3); costs (×0.6), HP, timings and ranges are the M12 /
  // playtest-round values (docs/M12.md) — update both together.
  it('has all 11 player units with PLAN §1.3 numbers (playtest-round stats)', () => {
    expect(UNIT_IDS).toHaveLength(11);
    const t = (id: keyof typeof UNITS) => UNITS[id];
    expect([t('riot').cost, t('riot').legit, t('riot').hp, t('riot').meleeSlots]).toEqual([
      5, 5, 60, 3,
    ]);
    expect(t('riot').attack).toMatchObject({ damage: 12, cleave: 2, cooldown: 1, lethal: false });
    expect(t('riot').armour.melee).toBe(0.3);
    expect(t('sniper')).toMatchObject({ cost: 7, legit: 10, placement: 'rooftop', hp: 40 });
    expect(t('sniper').attack).toMatchObject({
      damage: 22,
      cooldown: 1.8,
      range: 9,
      lethal: false,
    });
    expect(t('blockade')).toMatchObject({
      cost: 7,
      legit: 10,
      hp: 600,
      maxTiles: 3,
      attack: null,
    });
    expect(t('gas')).toMatchObject({ cost: 10, legit: 15, hp: 70 });
    expect(t('gas').attack).toMatchObject({ range: 3, damage: 10, stun: 0.4 });
    expect(t('gas').ability).toMatchObject({ charge: 14, radius: 2.5, duration: 6 });
    expect(t('mounted')).toMatchObject({ cost: 10, hp: 120, commandable: true });
    expect(t('mounted').attack?.damage).toBe(20);
    expect(t('armed')).toMatchObject({ cost: 50, legit: 20, hp: 95 });
    expect(t('armed').attack).toMatchObject({
      damage: 60,
      cooldown: 1.2,
      range: 7,
      pierce: 4,
      lethal: true,
    });
    expect(t('soldier')).toMatchObject({ cost: 100, legit: 40, hp: 140 });
    expect(t('soldier').attack).toMatchObject({
      damage: 25,
      cooldown: 1.4,
      range: 8,
      burst: { count: 3 },
    });
    expect(t('humvee')).toMatchObject({ cost: 300, legit: 60, hp: 480, commandable: true });
    expect(t('humvee').attack).toMatchObject({ damage: 15, range: 8 });
    expect(t('humvee').attack!.cooldown).toBeCloseTo(0.1);
    expect(t('humvee').armour.melee).toBe(0.5);
    expect(t('brigade')).toMatchObject({
      cost: 500,
      legit: 80,
      hp: 90,
      squad: 3,
      placement: 'rooftop',
    });
    expect(t('brigade').attack).toMatchObject({
      damage: 80,
      cooldown: 1,
      range: 14,
      splash: { radius: 1 },
    });
    expect(t('tank')).toMatchObject({
      cost: 600,
      legit: 100,
      hp: 1800,
      crushes: true,
      commandable: true,
    });
    expect(t('tank').attack).toMatchObject({
      damage: 200,
      cooldown: 4,
      range: 10,
      aoe: { radius: 2.5 },
    });
    expect(t('tank').attack!.aoe!.friendlyFire).toBeGreaterThan(0);
    expect(t('heli')).toMatchObject({
      cost: 1000,
      placement: 'air',
      invulnerable: true,
      commandable: true,
    });
    expect(t('heli').attack).toMatchObject({ damage: 12, range: 7 });
    expect(t('heli').attack!.cooldown).toBeCloseTo(1 / 12);
  });

  it('unit levels match the level table', () => {
    for (const l of LEVELS) expect(UNITS[l.unit].level).toBe(l.level);
  });

  it('has protester types incl. Breta & paparazzi with §1.4 numbers (playtest-round weapons)', () => {
    expect(PROTESTER_IDS).toHaveLength(9);
    PROTESTERS.forEach((p, i) => expect(p.index).toBe(i));
    expect(protesterDef('student')).toMatchObject({ hp: 35, speed: 1, capitolDps: 1 });
    expect(protesterDef('student').loadouts[0]!.melee).toBeNull();
    expect(protesterDef('woke')).toMatchObject({ hp: 40, speed: 1.05, climbs: true });
    expect(protesterDef('woke').loadouts[0]!.melee!.dps).toBe(4);
    expect(protesterDef('mob').loadouts[0]!.melee!.dps).toBe(5);
    const vv = protesterDef('veryViolent').loadouts[0]!;
    expect(vv.melee!.dps).toBe(6);
    expect(vv.ranged).toMatchObject({ weapon: 'molotov', range: 4, damage: 11, cooldown: 12 });
    expect(vv.ranged!.fire!.duration).toBe(4);
    expect(protesterDef('crazy').loadouts[0]!.ranged).toMatchObject({
      damage: 4,
      cooldown: 3,
      range: 6,
    });
    const cult = protesterDef('cultist');
    expect(cult.hp).toBe(65);
    expect(cult.loadouts.map((l) => l.id)).toEqual(['machete', 'rifle', 'bazooka']);
    expect(cult.loadouts[2]!.ranged).toMatchObject({
      damage: 20,
      range: 7,
      cooldown: 14,
      targetsRooftops: true,
    });
    expect(protesterDef('prophet').explode).toMatchObject({
      damage: 60,
      radius: 2,
      vsTankFraction: 0.5,
    });
    expect(protesterDef('breta')).toMatchObject({ hp: 300, speed: 0.8, hate: 100 });
    expect(protesterDef('breta').aura!.speedBonus).toBe(0.25);
    expect(protesterDef('paparazzi').loadouts[0]!.melee!.dps).toBe(15);
    expect(protesterDef('paparazzi').flash).toMatchObject({ blind: 1.5, cooldown: 5 });
    for (const p of PROTESTERS) expect(p.hate).toBe(p.id === 'breta' ? 100 : 1);
    expect(PT.paparazzi).toBe(8);
  });

  it('levels: thresholds, unlocks, win', () => {
    expect(LEVELS.map((l) => l.legit)).toEqual([
      0, 10, 30, 50, 100, 200, 300, 500, 800, 1200, 2000,
    ]);
    expect(WIN_LEGITIMACY).toBe(5000);
    expect(levelForLegit(0)).toBe(0);
    expect(levelForLegit(9)).toBe(0);
    expect(levelForLegit(10)).toBe(1);
    expect(levelForLegit(799)).toBe(7);
    expect(levelForLegit(4999)).toBe(10);
    expect(nextLevelLegit(0)).toBe(10);
    expect(nextLevelLegit(10)).toBeNull();
    expect(unlockedUnits(0)).toEqual(['riot']);
    expect(unlockedUnits(3)).toEqual(['riot', 'sniper', 'blockade', 'gas']);
    expect(unlockedProtesters(0)).toEqual(['student', 'woke']);
    expect(unlockedProtesters(4)).toEqual(['student', 'woke', 'mob', 'veryViolent']);
    expect(unlockedProtesters(10)).toContain('prophet');
    expect(unlockedProtesters(10)).not.toContain('breta');
  });

  it('economy constants and wave curve', () => {
    expect(BALANCE.startHate).toBe(100);
    expect(BALANCE.hatePerUnitDeath).toBe(1);
    expect(BALANCE.protestersPerHate).toBe(3);
    expect(waveSize(1, 0, 0)).toBe(30);
    expect(waveSize(2, 0, 0)).toBeGreaterThan(30);
    expect(waveSize(40, 10, 48 * 60)).toBeGreaterThanOrEqual(1500);
    for (let k = 1; k < 30; k++)
      expect(waveSize(k + 1, 3, 0)).toBeGreaterThanOrEqual(waveSize(k, 3, 0));
    expect(breatherSeconds(1)).toBeLessThanOrEqual(24);
    expect(breatherSeconds(50)).toBeGreaterThanOrEqual(12);
    expect(BALANCE.concurrency.desktop).toBeGreaterThanOrEqual(3000);
    expect(BALANCE.concurrency.mobile).toBe(1500);
    expect(BALANCE.crowdCapacity).toBeGreaterThanOrEqual(4096);
  });

  it('armour tables', () => {
    const t = armourTable({ melee: 0.3 });
    expect(t[DMG.melee]).toBeCloseTo(0.7);
    expect(t[DMG.bullet]).toBe(1);
  });
});
