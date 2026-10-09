/**
 * Damage types shared by the simulation, the data tables and the view.
 *
 * Every hit carries a damage type (for armour and for the view's hit/death FX) and a
 * `lethal` flag that comes from the *source* (a baton is non-lethal, a pistol is lethal).
 * Non-lethal killing blows produce KO deaths (stars/birds, no blood) in the view.
 */
export const DAMAGE_TYPES = [
  'melee',
  'bullet',
  'rubber',
  'gas',
  'fire',
  'explosion',
  'crush',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/** Numeric ids (stored in typed arrays). `DAMAGE_TYPES[DMG.x] === 'x'`. */
export const DMG = {
  melee: 0,
  bullet: 1,
  rubber: 2,
  gas: 3,
  fire: 4,
  explosion: 5,
  crush: 6,
} as const satisfies Record<DamageType, number>;
export type DamageId = (typeof DMG)[DamageType];

/**
 * Armour = fraction of incoming damage removed per type (0.3 → takes 70%).
 * Missing types take full damage.
 */
export type Armour = Partial<Record<DamageType, number>>;

/** Pre-resolved armour multipliers indexed by `DamageId` (1 = full damage). */
export function armourTable(a: Armour | undefined): Float32Array {
  const t = new Float32Array(DAMAGE_TYPES.length).fill(1);
  if (!a) return t;
  DAMAGE_TYPES.forEach((d, i) => {
    const r = a[d];
    if (r !== undefined) t[i] = Math.max(0, 1 - r);
  });
  return t;
}
