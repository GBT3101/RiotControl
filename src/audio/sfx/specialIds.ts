/**
 * Ids of the special-skill sounds (playtest round 2). Kept in a dependency-free module so
 * `types.ts` can splice them into `SFX_IDS` without an import cycle; the recipes and mix
 * settings live in `specials.ts`. Catalogue: docs/art/specials.md.
 */
export const SPECIAL_SFX_IDS = [
  // Ram (Mounted Riot Police)
  'ramGallop',
  'ramImpact',
  // Rapid fire (Armed Cops)
  'rapidFire',
  // Real grenade (Soldiers)
  'fragPin',
  'fragThrow',
  'fragBoom',
  // Big explosion (Tank)
  'missileLaunch',
  'missileBoom',
  // Air strike (Helicopter)
  'airSwoop',
  'rocketSalvo',
  'strikeChain',
  // Shared UI: skill-ready chime per tier, aim / paint feedback
  'skillReady1',
  'skillReady2',
  'skillReady3',
  'aimTick',
  'aimLock',
  'aimCancel',
  'paintTick',
] as const;

export type SpecialSfxId = (typeof SPECIAL_SFX_IDS)[number];
