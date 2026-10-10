/**
 * Player ("Ministry") unit table — PLAN.md §1.3. Baseline numbers; tuned in M12 and again in the
 * playtest round (far less HP: a lone officer is rammed over, a tight group holds — BALANCE.mob).
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

/** Can this unit type be deployed on a roof (its main or alternative placement)? */
export function deploysOnRoofs(def: UnitDef): boolean {
  return def.placement === 'rooftop' || def.altPlacement === 'rooftop';
}

/** Can this unit type be deployed on a road tile (its main or alternative placement)? */
export function deploysOnRoads(def: UnitDef): boolean {
  return def.placement === 'road' || def.altPlacement === 'road';
}

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
  /** Melee: each swing also hits other protesters held in its slots, up to N in total. */
  cleave?: number;
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

/** Special skill ids (docs/specials.md). */
export type AbilityId =
  'gasGrenade' | 'ram' | 'rapidFire' | 'fragGrenade' | 'missile' | 'airStrike';

/**
 * How the player aims a skill: `auto` fires on a tap (the sim picks the target), `point` enters
 * the tank's aim mode (reticle + range ring), `line` the helicopter's paint mode (drag a line).
 */
export type AbilityAim = 'auto' | 'point' | 'line';

interface AbilityBase {
  /** Seconds to charge (pauses while the unit is stunned or knocked down). */
  charge: number;
  aim: AbilityAim;
}

/** Tear Gas Shooter: a gas grenade at the densest crowd in range. */
export interface GasGrenadeAbility extends AbilityBase {
  id: 'gasGrenade';
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

/** Mounted Riot Police: gallop a straight lane, bowling over everyone in it (non-lethal). */
export interface RamAbility extends AbilityBase {
  id: 'ram';
  /** Lane length (tiles); the run stops early at a wall, a blockade or the end of the road. */
  length: number;
  /** Lane half-width (tiles) around the horse's path. */
  halfWidth: number;
  /** Gallop speed (tiles/s). */
  speed: number;
  /** Seconds the lane flashes before the gallop starts. */
  windup: number;
  /** Damage to each protester bowled over (KO when it drops them; never lethal). */
  damage: number;
  /** Stun (s) for survivors, and the sideways knock-back impulse (tiles/s). */
  stun: number;
  impulse: number;
}

/** Armed Cops: a burst of piercing pistol shots at the nearest targets. */
export interface RapidFireAbility extends AbilityBase {
  id: 'rapidFire';
  shots: number;
  /** Seconds between shots. */
  interval: number;
  range: number;
  damage: number;
  /** Each shot pierces up to N protesters within `pierceWidth` of its line. */
  pierce: number;
  pierceWidth: number;
}

/** Soldiers: a real (lethal) frag grenade at the densest crowd in range. */
export interface FragAbility extends AbilityBase {
  id: 'fragGrenade';
  range: number;
  radius: number;
  damage: number;
  /** Seconds on the ground before it goes off. */
  fuse: number;
}

/** Tank: a player-aimed missile with a huge blast. */
export interface MissileAbility extends AbilityBase {
  id: 'missile';
  /** Max distance of the aimed point from the tank (tiles). */
  range: number;
  radius: number;
  damage: number;
}

/** Helicopter: a strafing run along a line the player paints. */
export interface AirStrikeAbility extends AbilityBase {
  id: 'airStrike';
  /** Painted line length limits (tiles). */
  maxLength: number;
  minLength: number;
  /** Everything within this distance (tiles) of the line dies. */
  width: number;
  damage: number;
  /** Seconds from the call to the first impact at the least (the heli also has to get there). */
  lead: number;
  /** Impact spacing along the line (tiles) and seconds between impacts. */
  spacing: number;
  cadence: number;
  /** Speed (tiles/s) of the heli's dive toward the start of the line. */
  diveSpeed: number;
}

export type AbilityDef =
  | GasGrenadeAbility
  | RamAbility
  | RapidFireAbility
  | FragAbility
  | MissileAbility
  | AirStrikeAbility;

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
  /**
   * A second place the player may deploy it (Soldiers: a road tile *or* a deployable roof). An
   * instance's actual spot is `Unit.building` (≥ 0 = standing on that roof).
   */
  altPlacement?: Placement;
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
  /**
   * Outnumbering (BALANCE.mob): attackers per supporter at which protester melee lands at full
   * strength — harder beyond, softer below (roof units: climbers per defender).
   */
  mobHold: number;
  /** Support it lends to friendly ground units within `BALANCE.mob.supportRadius`. */
  mobWeight: number;
  /** Can be rammed over (knocked down) by a mob that outnumbers it. */
  rammable: boolean;
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
    hp: 60,
    radius: 0.32,
    speed: 0,
    commandable: false,
    meleeSlots: 3,
    armour: { melee: 0.3, fire: 0.3, bullet: 0.3, explosion: 0.2 },
    attack: {
      weapon: 'baton',
      delivery: 'melee',
      damage: 12,
      cleave: 2,
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
    mobHold: 3,
    mobWeight: 1,
    rammable: true,
    behaviour: 'melee',
  },
  sniper: {
    id: 'sniper',
    name: 'Rubber Sniper',
    level: 1,
    cost: 7,
    legit: 10,
    placement: 'rooftop',
    hp: 40,
    radius: 0.3,
    speed: 0,
    commandable: false,
    meleeSlots: 0,
    armour: {},
    attack: {
      weapon: 'rubber',
      delivery: 'hitscan',
      // Base protesters (Student 35, Violent Woke 40 HP) take exactly two balls.
      damage: 22,
      dmgType: 'rubber',
      lethal: false,
      cooldown: 1.8,
      range: 9,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    mobHold: 1,
    mobWeight: 0,
    rammable: false,
    behaviour: 'rooftop',
  },
  blockade: {
    id: 'blockade',
    name: 'Blockade',
    level: 2,
    cost: 7,
    legit: 10,
    placement: 'road',
    hp: 600,
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
    mobHold: 10,
    mobWeight: 1,
    rammable: false,
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
    hp: 70,
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
      stun: 0.4,
      coneAngle: 70,
      gasLinger: 0.5,
    },
    ability: {
      id: 'gasGrenade',
      aim: 'auto',
      charge: 14,
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
    mobHold: 2,
    mobWeight: 1,
    rammable: true,
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
    hp: 120,
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
    // docs/specials.md: the higher the unit's level, the longer the charge (18/22/28/45/60 s).
    ability: {
      id: 'ram',
      aim: 'auto',
      charge: 18,
      length: 6,
      halfWidth: 0.55,
      speed: 8,
      windup: 0.5,
      damage: 80,
      stun: 2.5,
      impulse: 4,
    },
    squad: 1,
    guardsRooftops: true,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    knockback: { impulse: 3, stun: 0.6 },
    mobHold: 2.5,
    mobWeight: 1,
    rammable: true,
    behaviour: 'mountedMelee',
    chosen: ['legit 15', 'speed 3.2', 'meleeSlots 2', 'armour melee 20%'],
  },
  armed: {
    id: 'armed',
    name: 'Armed Cops',
    level: 5,
    cost: 20,
    legit: 20,
    placement: 'road',
    hp: 95,
    radius: 0.32,
    speed: 0,
    commandable: false,
    meleeSlots: 1,
    armour: { bullet: 0.25 },
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
    ability: {
      id: 'rapidFire',
      aim: 'auto',
      charge: 22,
      shots: 5,
      interval: 0.12,
      range: 7,
      damage: 60,
      pierce: 4,
      pierceWidth: 0.35,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    mobHold: 2,
    mobWeight: 1,
    rammable: true,
    behaviour: 'ranged',
  },
  soldier: {
    id: 'soldier',
    name: 'Soldiers',
    level: 6,
    cost: 50,
    legit: 40,
    // Owner request: "Soldiers can also be put on rooftops like the snipers or on the ground."
    placement: 'road',
    altPlacement: 'rooftop',
    hp: 140,
    radius: 0.32,
    speed: 0,
    commandable: false,
    meleeSlots: 1,
    armour: { melee: 0.1, bullet: 0.25, fire: 0.2 },
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
    ability: {
      id: 'fragGrenade',
      aim: 'auto',
      charge: 28,
      range: 6,
      radius: 2.2,
      damage: 1000,
      fuse: 0.15,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: false,
    crushes: false,
    invulnerable: false,
    maxTiles: 1,
    mobHold: 2.5,
    mobWeight: 1,
    rammable: true,
    behaviour: 'ranged',
  },
  humvee: {
    id: 'humvee',
    name: 'MG Humvee',
    level: 7,
    cost: 80,
    legit: 60,
    placement: 'road',
    hp: 480,
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
    mobHold: 6,
    mobWeight: 2,
    rammable: false,
    behaviour: 'vehicleGun',
    chosen: ['speed 3.5', 'armour bullet/fire 30%', 'wreck fire'],
  },
  brigade: {
    id: 'brigade',
    name: 'Sniper Brigade',
    level: 8,
    cost: 100,
    legit: 80,
    placement: 'rooftop',
    hp: 90,
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
    mobHold: 1,
    mobWeight: 0,
    rammable: false,
    behaviour: 'rooftop',
    chosen: ['hp 150 per member', 'splash full damage', 'one shot per second for the squad'],
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    level: 9,
    cost: 200,
    legit: 100,
    placement: 'road',
    hp: 1800,
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
    ability: {
      id: 'missile',
      aim: 'point',
      charge: 45,
      range: 16,
      radius: 4.5,
      damage: 600,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: true,
    crushes: true,
    invulnerable: false,
    maxTiles: 1,
    wreck: { radius: 1.5, duration: 12, dps: 6 },
    mobHold: 12,
    mobWeight: 3,
    rammable: false,
    behaviour: 'tank',
    chosen: ['speed 1.6', 'armour', 'meleeSlots 6'],
  },
  heli: {
    id: 'heli',
    name: 'Helicopter',
    level: 10,
    cost: 300,
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
    ability: {
      id: 'airStrike',
      aim: 'line',
      charge: 60,
      maxLength: 14,
      minLength: 1.5,
      width: 1.2,
      damage: 1000,
      lead: 0.6,
      spacing: 0.7,
      cadence: 0.075,
      diveSpeed: 12,
    },
    squad: 1,
    guardsRooftops: false,
    vehicle: true,
    crushes: false,
    invulnerable: true,
    maxTiles: 1,
    rotorWash: 2.5,
    mobHold: 99,
    mobWeight: 0,
    rammable: false,
    behaviour: 'heli',
    chosen: ['legit 0 (cannot die)', 'speed 5'],
  },
};

/** Deploy-bar order (= unlock order). */
export const UNIT_ORDER: readonly UnitId[] = UNIT_IDS;

/** Numeric index of a unit type (stable; used in typed arrays and bodies). */
export const unitIndex = (id: UnitId): number => UNIT_IDS.indexOf(id);

/** The skill of a unit type, narrowed to one kind (undefined when it has another or none). */
export function abilityOf<K extends AbilityId>(
  def: UnitDef,
  id: K,
): Extract<AbilityDef, { id: K }> | undefined {
  const a = def.ability;
  return a && a.id === id ? (a as Extract<AbilityDef, { id: K }>) : undefined;
}
