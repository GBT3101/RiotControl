/**
 * Protester table — PLAN.md §1.4. Baseline numbers; tuned in M12.
 *
 * Speeds are multipliers of `BALANCE.walkSpeed` (tiles/s). Melee attacks are expressed as
 * DPS delivered in hits every `interval` seconds (hit damage = dps × interval).
 * `capitolDps` = Integrity HP removed per second while attacking the Capitol steps.
 */
import type { DamageType } from './damage';

export const PROTESTER_IDS = [
  'student',
  'woke',
  'mob',
  'veryViolent',
  'crazy',
  'cultist',
  'prophet',
  'breta',
  'paparazzi',
] as const;
export type ProtesterId = (typeof PROTESTER_IDS)[number];

/** Numeric type ids stored in the crowd SoA (`crowd.type`). */
export const PT = {
  student: 0,
  woke: 1,
  mob: 2,
  veryViolent: 3,
  crazy: 4,
  cultist: 5,
  prophet: 6,
  breta: 7,
  paparazzi: 8,
} as const satisfies Record<ProtesterId, number>;

export interface MeleeDef {
  dps: number;
  interval: number;
  dmgType: DamageType;
  lethal: boolean;
}

export interface RangedDef {
  weapon: 'pistol' | 'rifle' | 'molotov' | 'bazooka';
  delivery: 'hitscan' | 'ballistic';
  damage: number;
  cooldown: number;
  range: number;
  dmgType: DamageType;
  lethal: boolean;
  /** Ballistic: area radius at impact (tiles). */
  aoeRadius?: number;
  projectileSpeed?: number;
  /** May target units on rooftops (bazooka). */
  targetsRooftops?: boolean;
  /** Ballistic: leaves a fire patch that burns units. */
  fire?: { radius: number; duration: number; dps: number };
}

/** A weapon kit. Most types have one; cultists roll one of several per protester. */
export interface LoadoutDef {
  id: string;
  weight: number;
  melee: MeleeDef | null;
  ranged: RangedDef | null;
}

export interface ProtesterDef {
  id: ProtesterId;
  index: number;
  name: string;
  /** Level from which the type joins the wave mix; -1 = special (Breta/paparazzi). */
  level: number;
  hp: number;
  /** × BALANCE.walkSpeed. */
  speed: number;
  /** Collision radius (tiles). */
  radius: number;
  /** Hate paid when the protester falls. */
  hate: number;
  /** Capitol Integrity HP per second while on the steps. */
  capitolDps: number;
  /** Diverts to climb unguarded rooftops hosting snipers. */
  climbs: boolean;
  loadouts: LoadoutDef[];
  /** Explodes on contact with ground units (Prophets). */
  explode?: {
    damage: number;
    radius: number;
    /** Fraction of a tank's max HP dealt to tanks instead of `damage`. */
    vsTankFraction: number;
    /** Damage factor applied to other protesters in the blast. */
    crowdFactor: number;
    /** Integrity HP removed when exploding on the Capitol steps. */
    capitolDamage: number;
  };
  /** Speed aura for nearby protesters (Breta). */
  aura?: { radius: number; speedBonus: number };
  /** Camera flash that blinds (stuns) a unit (paparazzi). */
  flash?: { range: number; blind: number; cooldown: number };
  /** Base weight in wave composition (before the "newest type" boost). */
  weight: number;
  /** Values not in the brief (owner to confirm). */
  chosen?: string[];
}

const melee = (dps: number, lethal = true): MeleeDef => ({
  dps,
  interval: 1,
  dmgType: 'melee',
  lethal,
});
const kit = (melee_: MeleeDef | null, ranged: RangedDef | null, id = 'default', weight = 1) => ({
  id,
  weight,
  melee: melee_,
  ranged,
});

export const PROTESTERS: readonly ProtesterDef[] = [
  {
    id: 'student',
    index: PT.student,
    name: 'Student',
    level: 0,
    hp: 30,
    speed: 1.0,
    radius: 0.22,
    hate: 1,
    capitolDps: 1,
    climbs: false,
    loadouts: [kit(null, null)],
    weight: 10,
  },
  {
    id: 'woke',
    index: PT.woke,
    name: 'Violent Woke',
    level: 0,
    hp: 40,
    speed: 1.05,
    radius: 0.22,
    hate: 1,
    capitolDps: 2,
    climbs: true,
    loadouts: [kit(melee(3), null)],
    weight: 7,
    chosen: ['capitolDps 2'],
  },
  {
    id: 'mob',
    index: PT.mob,
    name: 'Violent Mob',
    level: 2,
    hp: 60,
    speed: 1.0,
    radius: 0.24,
    hate: 1,
    capitolDps: 3,
    climbs: true,
    loadouts: [kit(melee(6), null)],
    weight: 7,
    chosen: ['capitolDps 3'],
  },
  {
    id: 'veryViolent',
    index: PT.veryViolent,
    name: 'Very Violent Mob',
    level: 4,
    hp: 70,
    speed: 1.1,
    radius: 0.24,
    hate: 1,
    capitolDps: 4,
    climbs: true,
    loadouts: [
      kit(melee(8), {
        weapon: 'molotov',
        delivery: 'ballistic',
        damage: 25,
        cooldown: 6,
        range: 4,
        dmgType: 'fire',
        lethal: true,
        aoeRadius: 1.2,
        projectileSpeed: 6,
        fire: { radius: 1.2, duration: 4, dps: 8 },
      }),
    ],
    weight: 5,
    chosen: ['molotov aoe r=1.2', 'fire patch 8 dps', 'capitolDps 4'],
  },
  {
    id: 'crazy',
    index: PT.crazy,
    name: 'Crazy Mob',
    level: 6,
    hp: 60,
    speed: 1.15,
    radius: 0.22,
    hate: 1,
    capitolDps: 3,
    climbs: false,
    loadouts: [
      kit(null, {
        weapon: 'pistol',
        delivery: 'hitscan',
        damage: 12,
        cooldown: 1.5,
        range: 6,
        dmgType: 'bullet',
        lethal: true,
      }),
    ],
    weight: 5,
    chosen: ['capitolDps 3'],
  },
  {
    id: 'cultist',
    index: PT.cultist,
    name: 'Doomsday Cultist',
    level: 8,
    hp: 90,
    speed: 0.95,
    radius: 0.24,
    hate: 1,
    capitolDps: 5,
    climbs: false,
    loadouts: [
      kit(melee(12), null, 'machete', 5),
      kit(
        null,
        {
          weapon: 'rifle',
          delivery: 'hitscan',
          damage: 10,
          cooldown: 1.2,
          range: 7,
          dmgType: 'bullet',
          lethal: true,
        },
        'rifle',
        3,
      ),
      kit(
        null,
        {
          weapon: 'bazooka',
          delivery: 'ballistic',
          damage: 80,
          cooldown: 8,
          range: 7,
          dmgType: 'explosion',
          lethal: true,
          aoeRadius: 1.5,
          projectileSpeed: 9,
          targetsRooftops: true,
        },
        'bazooka',
        2,
      ),
    ],
    weight: 5,
    chosen: ['loadout weights 5/3/2', 'rifle cd 1.2', 'bazooka aoe r=1.5', 'capitolDps 5'],
  },
  {
    id: 'prophet',
    index: PT.prophet,
    name: 'The Prophets',
    level: 10,
    hp: 50,
    speed: 1.3,
    radius: 0.22,
    hate: 1,
    capitolDps: 0,
    climbs: false,
    loadouts: [kit(null, null)],
    explode: { damage: 150, radius: 2, vsTankFraction: 0.5, crowdFactor: 0.5, capitolDamage: 40 },
    weight: 3,
    chosen: ['blast hurts crowd at 50%', 'capitol blast 40'],
  },
  {
    id: 'breta',
    index: PT.breta,
    name: 'Breta',
    level: -1,
    hp: 300,
    speed: 0.8,
    radius: 0.2,
    hate: 100,
    capitolDps: 1,
    climbs: false,
    loadouts: [kit(null, null)],
    aura: { radius: 3, speedBonus: 0.25 },
    weight: 0,
    chosen: ['aura radius 3', 'capitolDps 1'],
  },
  {
    id: 'paparazzi',
    index: PT.paparazzi,
    name: 'Paparazzi',
    level: -1,
    hp: 50,
    speed: 1.0,
    radius: 0.22,
    hate: 1,
    capitolDps: 2,
    climbs: false,
    loadouts: [kit(melee(15), null)],
    flash: { range: 3, blind: 1.5, cooldown: 5 },
    weight: 0,
    chosen: ['flash range 3', 'capitolDps 2'],
  },
];

export const protesterDef = (id: ProtesterId): ProtesterDef => PROTESTERS[PT[id]]!;
