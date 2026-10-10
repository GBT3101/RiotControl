/**
 * Global balance constants (economy, waves, crowd, navigation, Capitol). Everything the sim
 * tunes lives here or in units.ts / protesters.ts / levels.ts so M12 can tune without code
 * changes. Units: tiles, seconds, tiles/s, HP.
 */

export type QualityTier = 'low' | 'mobile' | 'desktop';

export const BALANCE = {
  // ── Economy (PLAN §1.6) ────────────────────────────────────────────────────────────────
  startHate: 100,
  startLegit: 0,
  /** Hate on any own unit death (blockades included; each Sniper Brigade member counts). */
  hatePerUnitDeath: 1,
  /**
   * Ordinary protester kills pay their `hate` into a tally that pays out 1 Hate per this many
   * points (owner, playtest round: "1 Hate per 3 protesters"). `bounty` types (Breta) pay in full.
   */
  protestersPerHate: 3,

  // ── Simulation ─────────────────────────────────────────────────────────────────────────
  /** Fixed sim rate (Hz). */
  hz: 30,
  /** Base protester walk speed (tiles/s) — ProtesterDef.speed multiplies it (playtest round:
   *  1.5× the M12 1.15). */
  walkSpeed: 1.725,
  /** The view's run cycle plays above this multiple of `walkSpeed` (sprinting Prophets, aura). */
  runAnimAbove: 1.4,
  /** Per-protester gait variation (±fraction). */
  gaitVariation: 0.1,
  /** Crowd separation radius (tiles, centre to centre). */
  separationRadius: 0.5,
  separationStrength: 2.2,
  /** Max neighbours examined per protester per tick (bounded cost in dense crowds). */
  separationMaxNeighbours: 14,
  /** Lateral lane bias so hordes spread across wide roads (fraction of speed). */
  laneSpread: 0.35,
  /** Velocity smoothing (1/s). */
  acceleration: 8,
  /** Wall avoidance band (tiles from a blocked tile edge). */
  wallBand: 0.28,
  /** Stationary units with free melee slots pull marching protesters within this many tiles
   *  of their edge into the slots (interception/blocking). */
  engageRadius: 1.3,
  /** Protester decision interval in ticks (targeting/climb checks are staggered). */
  thinkTicks: 8,
  /** Unit retargeting interval (s). */
  unitRetarget: 0.2,
  /** Switch target only if the new one scores below this fraction of the current one. */
  targetHysteresis: 0.7,
  /** Protester status DoT rates (HP/s): choking in tear gas (PLAN: gas 10 dmg/s) and burning. */
  gasDps: 10,
  burnDps: 6,
  /** Seconds a freshly spawned protester mills around its door. */
  millTime: [0.6, 1.6] as [number, number],
  /** District rally points (M7): walk there first when the detour is at most this (tiles of
   *  path), gather within `rallyRadius` for `rallyGather` seconds, then march. */
  rallyMaxDetour: 14,
  rallyRadius: 2.2,
  rallyGather: [1.2, 3] as [number, number],
  /** Give up walking to the rally point after this many seconds. */
  rallyGiveUp: 18,

  // ── Navigation ────────────────────────────────────────────────────────────────────────
  /** Extra flow-field cost of a blockade tile (passable in the field so blocked crowds still press on it). */
  blockadeTileCost: 30,
  /** Extra flow-field cost of a tile held by a stationary ground unit (crowds flow around). */
  unitTileCost: 3,
  /** Minimum seconds between flow-field recomputes when blockers change. */
  flowRecomputeInterval: 0.5,

  // ── Capitol ───────────────────────────────────────────────────────────────────────────
  /** Integrity HP (UI shows %). */
  capitolHp: 40000,
  /** Protesters within this flow distance (tiles) of the steps attack the Capitol. */
  capitolReach: 1.2,
  /** Integrity fractions below which the Capitol enters damage states 1..5 (graffiti → collapsing). */
  capitolDamageThresholds: [0.9, 0.7, 0.5, 0.3, 0.12] as const,
  /** Interval between aggregated `capitolDamaged` events (s). */
  capitolEventInterval: 1,

  // ── Outnumbering (playtest round: "protesters ram lone units over") ───────────────────
  /**
   * A ground unit's *odds* = protesters within `radius` of it ÷ its support (itself plus friendly
   * ground units within `supportRadius`, weighted by `UnitDef.mobWeight`). Protester melee
   * hits it × (1 + `slope` × (odds − `UnitDef.mobHold`)), clamped to [`minMult`, `maxMult`]:
   * a lone officer in a mob melts, a tight squad shrugs blows off. Rooftop units count the
   * climbers on their roof against themselves (ground cover nearby counts as a second defender).
   */
  mob: {
    radius: 1.2,
    supportRadius: 3,
    slope: 0.3,
    minMult: 0.5,
    maxMult: 3.5,
    /** Recomputed every this many ticks. */
    everyTicks: 6,
    /**
     * Rammed over: a unit that can be knocked down (`UnitDef.rammable`) facing at least
     * `ramOdds` gets knocked down with probability `ramChance` × (odds − ramOdds + 1) (≤ 0.6)
     * per update: `ramDamage` × the type's HP (crush, ignores armour) and `ramStun` seconds down.
     */
    ramOdds: 5,
    ramChance: 0.02,
    ramDamage: 0.25,
    ramStun: 1.2,
  },

  // ── Climbing / rooftops (PLAN §1.4) ───────────────────────────────────────────────────
  /** Base reach (tiles from the footprint) at which a passing climber notices a rooftop unit. */
  climbDetectRadius: 4,
  /** A Riot Control / horse within this many tiles of the footprint: nobody climbs. */
  guardRadius: 2.5,
  climbSecondsPerStorey: 1.5,
  /** Climbers per roof when the rooftop unit has ground cover… */
  maxClimbersPerRoof: 1,
  /** …and when it is isolated. */
  maxClimbersIsolated: 4,
  /** Seconds a protester may spend walking to its climb point. */
  climbGiveUp: 9,
  climb: {
    /** No friendly ground unit within this many tiles of the footprint = isolated. */
    coverRadius: 6,
    /** A covered rooftop unit is noticed this much less often (× chance)… */
    coveredFactor: 0.1,
    /** …and from this much less far (× reach). */
    coveredReach: 0.5,
    /** Per protester decision (≈ 0.27 s): base chance to divert once in reach. */
    chance: 0.04,
    /** Rage: the rooftop unit's shooting at the crowd (seconds, decays at half speed). At
     *  `rageFull` seconds the chance is ×`rageChance` and the reach grows by `rageReach`. */
    rageFull: 15,
    rageChance: 6,
    rageReach: 6,
    /** Roof brawl: climbers grapple for at least this many DPS (plus the outnumbering bonus;
     *  a roof holds `UnitDef.mobHold` climbers per defender). */
    brawlDps: 8,
    /** The rooftop unit's point-blank defence deals this fraction of its weapon damage. */
    defendFactor: 0.5,
  },

  // ── Bodies ───────────────────────────────────────────────────────────────────────────
  bodyTtl: [20, 40] as [number, number],
  maxBodies: 1500,
  /** TTL removed per trampling protester per check. */
  trampleTtlCost: 0.4,
  trampleCheckTicks: 15,

  // ── Wave director (PLAN §1.5) ─────────────────────────────────────────────────────────
  waves: {
    /** Wave 1 size. */
    base: 30,
    /** Growth per wave. */
    growth: 1.08,
    /** +fraction per player level. */
    perLevel: 0.03,
    /** +fraction per elapsed minute of the run… */
    perMinute: 0.01,
    /** …plus this × minutes² (the late-game surge: big hordes after ~25 min). */
    perMinute2: 0.0002,
    maxSize: 3500,
    groupSize: [6, 24] as [number, number],
    /** Seconds between emissions from one door group. */
    emitInterval: 0.12,
    /** Concurrent door groups emitting. */
    maxEmitters: 16,
    maxSpawnsPerTick: 8,
    /** Jitter on the nominal gap between door groups (gap = group size × spawn window / wave size). */
    groupInterval: [0.6, 1.4] as [number, number],
    /** Spawn window (s) of a wave: `base + perSqrt × √size`, capped — waves stream in, they
     *  don't burst (≈19 s for wave 1, ≈36 s for 500, 40 s cap from ~680). */
    spawnWindow: { base: 14, perSqrt: 1.0, max: 40 },
    /** Breather between waves (s); shrinks from max toward min as waves advance. */
    breather: [16, 24] as [number, number],
    /** Call-early bonus Hate = seconds remaining × this. */
    callEarlyFactor: 0.5,
    /** Wave ends once spawning finished and alive ≤ this fraction of its size… */
    endAliveFraction: 0.1,
    /** …or this many seconds after spawning finished. */
    endTimeout: 45,
    /** Weight multiplier for types unlocked at the current/previous level. */
    newestBoost: 1.6,
    newestWindow: 1,
    /** A type joining mid-run enters at this weight fraction, +`introStep` per wave (≤ 1). */
    introStart: 0.15,
    introStep: 0.15,
    breta: { chance: 0.01, paparazzi: [6, 10] as [number, number] },
  },

  /** Max simultaneously alive protesters per quality tier (spawn queue waits above it). */
  concurrency: { low: 800, mobile: 1500, desktop: 3200 } as Record<QualityTier, number>,
  /** Crowd storage capacity (≥ every tier's cap + Breta groups). */
  crowdCapacity: 4096,
} as const;

/** Wave size for a wave index (1-based), player level and elapsed seconds. */
export function waveSize(wave: number, level: number, elapsed: number): number {
  const w = BALANCE.waves;
  const size =
    w.base *
    Math.pow(w.growth, Math.max(0, wave - 1)) *
    (1 + w.perLevel * level) *
    (1 + w.perMinute * (elapsed / 60) + w.perMinute2 * (elapsed / 60) ** 2);
  return Math.min(w.maxSize, Math.round(size));
}

/** Seconds over which a wave of `size` protesters is released. */
export function spawnSeconds(size: number): number {
  const sw = BALANCE.waves.spawnWindow;
  return Math.min(sw.max, sw.base + sw.perSqrt * Math.sqrt(Math.max(0, size)));
}

/** Breather length (s) after `wave`. */
export function breatherSeconds(wave: number): number {
  const [lo, hi] = BALANCE.waves.breather;
  return Math.max(lo, hi - (wave - 1) * 0.5);
}
