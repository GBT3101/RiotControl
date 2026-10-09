/**
 * Player ("Ministry") unit table — PLAN.md §1.3. Baseline numbers; tuned in M12.
 *
 * Units of measure: distances & ranges in **tiles**, times in **seconds**, speeds in
 * **tiles/second**, damage in HP. "Legit" = Legitimacy granted when the unit dies (every
 * unit death also grants `BALANCE.hatePerUnitDeath` Hate).
 */
import type { Armour, DamageType } from './damage';

export const UNIT_IDS = [
  'riot',
  'sniper',
  'blockade',
  'gas',
  'mounted',
  'armed',
  'soldier',
  'humvee',
  'brigade',
  'tank',
  'heli',
] as const;
export type UnitId = (typeof UNIT_IDS)[number];

/** Where a unit may be deployed. */
export type Placement = 'road' | 'rooftop' | 'air';

/** Weapon identity — drives FX/SFX in the view (`fired.weapon`). */
export type WeaponKind =
  | 'none'
  | 'baton'
  | 'bat'
  | 'rubber'
  | 'gasCone'
  | 'pistol'
  | 'rifle'
  | 'mg'
  | 'sniper'
  | 'cannon'
  | 'doorGun';

/** How an attack delivers its damage. */
export type Delivery = 'none' | 'melee' | 'hitscan' | 'cone' | 'ballistic';

export interface AttackDef {
  weapon: WeaponKind;
  delivery: Delivery;
  /** Damage per hit (per shot for bursts; per second for `cone`). */
  damage: number;
  dmgType: DamageType;
  /** Lethal source → blood & bodies; non-lethal → KO. */
  lethal: boolean;
  /** Seconds between attacks (between burst starts for bursts). */
  cooldown: number;
  /** Range in tiles (melee: reach from the unit centre). */
  range: number;
  /** Won't fire at targets closer than this (keeps the tank out of its own blast). */
  minRange?: number;
  /** Several shots per attack. */
  burst?: { count: number; interval: number };
  /** Hitscan pierces up to N protesters in a line (incl. the first). */
  pierce?: number;
  /** Half-width (tiles) of the piercing line. */
  pierceWidth?: number;
  /** Each shot may instead hit a random protester within `spread` tiles of the target. */
  spread?: number;
  spreadChance?: number;
  /** Extra damage to protesters around the impact (hitscan). `factor` × damage. */
  splash?: { radius: number; factor: number };
  /** Area damage at the impact point (ballistic). `friendlyFire` = factor applied to own ground units (0 = none). */
  aoe?: { radius: number; friendlyFire: number };
  /** Ballistic flight speed (tiles/s). */
  projectileSpeed?: number;
  /** Stun (s) applied to each protester hit. */
  stun?: number;
  /** Cone full angle in degrees (`cone` delivery). */
  coneAngle?: number;
  /** Seconds a hit protester keeps choking (gas DoT status) after the hit. */
  gasLinger?: number;
}

export interface AbilityDef {
  id: 'gasGrenade';
  /** Seconds to charge. */
  charge: number;
  /** Max throw distance (tiles). */
  range: number;
  /** Cloud radius (tiles). */
  radius: number;
  /** Cloud lifetime (s). */
  duration: number;
  /** Damage per second to protesters in the cloud. */
  dps: number;
  /** Stun (s) refreshed while inside the cloud. */
  stun: number;
  projectileSpeed: number;
}

/** Behaviour module ids — see `src/sim/behaviours/unit/`. */
export type UnitBehaviourId =
  | 'melee'
  | 'ranged'
  | 'rooftop'
  | 'blockade'
  | 'gasser'
  | 'mountedMelee'
  | 'vehicleGun'
  | 'tank'
  | 'heli';

export interface UnitDef {
  id: UnitId;
  name: string;
  /** Level at which the unit unlocks (see levels.ts). */
  level: number;
  /** Hate cost. */
  cost: number;
  /** Legitimacy granted on death. */
  legit: number;
  placement: Placement;
  /** HP (per squad member for squads). `Infinity` = cannot be harmed. */
  hp: number;
  /** Collision radius (tiles) for ground units. */
  radius: number;
  /** Movement speed (tiles/s); 0 = static post. */
  speed: number;
  /** Player can select and send it somewhere (`World.command`). */
  commandable: boolean;
  /** How many protesters it can hold in melee at once (blocking slots; per tile for blockades). */
  meleeSlots: number;
  armour: Armour;
  attack: AttackDef | null;
  ability?: AbilityDef;
  /** Squad size (Sniper Brigade = 3 members on one roof). */
  squad: number;
  /** An alive unit of this kind guards nearby rooftops against climbers. */
  guardsRooftops: boolean;
  vehicle: boolean;
  /** Kills protesters it drives over. */
  crushes: boolean;
  /** Cannot be damaged or targeted. */
  invulnerable: boolean;
  /** Blockades: max tiles spanned across the road. */
  maxTiles: number;
  /** Knocks students aside while moving (impulse in tiles/s, stun s). */
  knockback?: { impulse: number; stun: number };
  /** Leaves a burning wreck on death. */
  wreck?: { radius: number; duration: number; dps: number };
  /** Rotor wash pushes gas clouds within this radius (tiles). */
  rotorWash?: number;
  behaviour: UnitBehaviourId;
  /** Flagged when a value is not in the brief (chosen, owner to confirm). */
  chosen?: string[];
}

const NONE: AttackDef | null = null;

export const UNITS: Readonly<Record<UnitId, UnitDef>> = {
  riot: {
    id: 'riot',
    name: 'Riot Control',
    level: 0,
    cost: 5,
    legit: 5,
    placement: 'road',
    hp: 100,
    radius: 0.32,
    speed: 0,
    commandable: false,
    meleeSlots: 3,
    armour: { melee: 0.3 },
    attack: {
      weapon: 'baton',
      delivery: 'melee',
      damage: 10,
      dmgType: 'melee',
      lethal: false,
      cooldown: 1.0,
      range: 1.0,
    },
    squad: 1,
    guardsRooftops: true,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    behaviour: 'melee',
  },
  sniper: {
    id: 'sniper',
    name: 'Rubber Sniper',
    level: 1,
    cost: 7,
    legit: 10,
    placement: 'rooftop',
    hp: 60,
    radius: 0.3,
    speed: 0,
    commandable: false,
    meleeSlots: 0,
    armour: {},
    attack: {
      weapon: 'rubber',
      delivery: 'hitscan',
      damage: 20,
      dmgType: 'rubber',
      lethal: false,
      cooldown: 1.5,
      range: 9,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    behaviour: 'rooftop',
  },
  blockade: {
    id: 'blockade',
    name: 'Blockade',
    level: 2,
    cost: 7,
    legit: 10,
    placement: 'road',
    hp: 400,
    radius: 0.5,
    speed: 0,
    commandable: false,
    meleeSlots: 4,
    armour: {},
    attack: NONE,
    squad: 1,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 3,
    behaviour: 'blockade',
    chosen: ['meleeSlots 4 per tile'],
  },
  gas: {
    id: 'gas',
    name: 'Tear Gas Shooter',
    level: 3,
    cost: 10,
    legit: 15,
    placement: 'road',
    hp: 80,
    radius: 0.32,
    speed: 0,
    commandable: false,
    meleeSlots: 1,
    armour: {},
    attack: {
      weapon: 'gasCone',
      delivery: 'cone',
      damage: 10,
      dmgType: 'gas',
      lethal: false,
      cooldown: 0.25,
      range: 3,
      stun: 1,
      coneAngle: 70,
      gasLinger: 0.5,
    },
    ability: {
      id: 'gasGrenade',
      charge: 10,
      range: 7,
      radius: 2.5,
      duration: 6,
      dps: 10,
      stun: 1,
      projectileSpeed: 8,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    behaviour: 'gasser',
    chosen: ['coneAngle 70°', 'grenade range 7'],
  },
  mounted: {
    id: 'mounted',
    name: 'Mounted Riot Police',
    level: 4,
    cost: 10,
    legit: 15,
    placement: 'road',
    hp: 200,
    radius: 0.42,
    speed: 3.2,
    commandable: true,
    meleeSlots: 2,
    armour: { melee: 0.2 },
    attack: {
      weapon: 'bat',
      delivery: 'melee',
      damage: 20,
      dmgType: 'melee',
      lethal: false,
      cooldown: 1.0,
      range: 1.2,
    },
    squad: 1,
    guardsRooftops: true,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    knockback: { impulse: 3, stun: 0.6 },
    behaviour: 'mountedMelee',
    chosen: ['legit 15', 'speed 3.2', 'meleeSlots 2', 'armour melee 20%'],
  },
  armed: {
    id: 'armed',
    name: 'Armed Cops',
    level: 5,
    cost: 50,
    legit: 20,
    placement: 'road',
    hp: 120,
    radius: 0.32,
    speed: 0,
    commandable: false,
    meleeSlots: 1,
    armour: {},
    attack: {
      weapon: 'pistol',
      delivery: 'hitscan',
      damage: 60,
      dmgType: 'bullet',
      lethal: true,
      cooldown: 1.2,
      range: 7,
      pierce: 4,
      pierceWidth: 0.35,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    behaviour: 'ranged',
  },
  soldier: {
    id: 'soldier',
    name: 'Soldiers',
    level: 6,
    cost: 100,
    legit: 40,
    placement: 'road',
    hp: 180,
    radius: 0.32,
    speed: 0,
    commandable: false,
    meleeSlots: 1,
    armour: { melee: 0.1 },
    attack: {
      weapon: 'rifle',
      delivery: 'hitscan',
      damage: 25,
      dmgType: 'bullet',
      lethal: true,
      cooldown: 1.4,
      range: 8,
      burst: { count: 3, interval: 0.1 },
      spread: 1.5,
      spreadChance: 0.6,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    behaviour: 'ranged',
  },
  humvee: {
    id: 'humvee',
    name: 'MG Humvee',
    level: 7,
    cost: 300,
    legit: 60,
    placement: 'road',
    hp: 800,
    radius: 0.6,
    speed: 3.5,
    commandable: true,
    meleeSlots: 4,
    armour: { melee: 0.5, bullet: 0.3, fire: 0.3 },
    attack: {
      weapon: 'mg',
      delivery: 'hitscan',
      damage: 15,
      dmgType: 'bullet',
      lethal: true,
      cooldown: 0.1,
      range: 8,
      spread: 1.0,
      spreadChance: 0.4,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: true,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    wreck: { radius: 1.2, duration: 10, dps: 6 },
    behaviour: 'vehicleGun',
    chosen: ['speed 3.5', 'armour bullet/fire 30%', 'wreck fire'],
  },
  brigade: {
    id: 'brigade',
    name: 'Sniper Brigade',
    level: 8,
    cost: 500,
    legit: 80,
    placement: 'rooftop',
    hp: 150,
    radius: 0.3,
    speed: 0,
    commandable: false,
    meleeSlots: 0,
    armour: {},
    attack: {
      weapon: 'sniper',
      delivery: 'hitscan',
      damage: 80,
      dmgType: 'bullet',
      lethal: true,
      cooldown: 1.0,
      range: 14,
      splash: { radius: 1, factor: 1 },
    },
    squad: 3,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    behaviour: 'rooftop',
    chosen: ['hp 150 per member', 'splash full damage', 'one shot per second for the squad'],
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    level: 9,
    cost: 600,
    legit: 100,
    placement: 'road',
    hp: 3000,
    radius: 0.9,
    speed: 1.6,
    commandable: true,
    meleeSlots: 6,
    armour: { melee: 0.8, bullet: 0.8, fire: 0.6, explosion: 0.2 },
    attack: {
      weapon: 'cannon',
      delivery: 'ballistic',
      damage: 200,
      dmgType: 'explosion',
      lethal: true,
      cooldown: 4,
      range: 10,
      minRange: 2.8,
      aoe: { radius: 2.5, friendlyFire: 1 },
      projectileSpeed: 14,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: true,
    crushes: true,
    invulnerable: false,
    maxTiles: 1,
    wreck: { radius: 1.5, duration: 12, dps: 6 },
    behaviour: 'tank',
    chosen: ['speed 1.6', 'armour', 'meleeSlots 6'],
  },
  heli: {
    id: 'heli',
    name: 'Helicopter',
    level: 10,
    cost: 1000,
    legit: 0,
    placement: 'air',
    hp: Infinity,
    radius: 0.8,
    speed: 5,
    commandable: true,
    meleeSlots: 0,
    armour: {},
    attack: {
      weapon: 'doorGun',
      delivery: 'hitscan',
      damage: 12,
      dmgType: 'bullet',
      lethal: true,
      cooldown: 1 / 12,
      range: 7,
      spread: 1.2,
      spreadChance: 0.5,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: true,
    crushes: false,
    invulnerable: true,
    maxTiles: 1,
    rotorWash: 2.5,
    behaviour: 'heli',
    chosen: ['legit 0 (cannot die)', 'speed 5'],
  },
};

/** Deploy-bar order (= unlock order). */
export const UNIT_ORDER: readonly UnitId[] = UNIT_IDS;

/** Numeric index of a unit type (stable; used in typed arrays and bodies). */
export const unitIndex = (id: UnitId): number => UNIT_IDS.indexOf(id);
