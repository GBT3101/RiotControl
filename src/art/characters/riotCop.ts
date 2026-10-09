/**
 * Deprecated M1 sample officer. M4a moved every unit to `src/art/units/` (`unit.riot.*` is now
 * registered by `registerUnits`). Kept as a no-op shim only because `src/art/index.ts`
 * (orchestrator-owned) still calls it; delete this file and that call together.
 */
import type { SpriteRegistry } from '../lib/registry';

export { COP_SKINS } from '../units/riot';

export function registerRiotCop(_reg: SpriteRegistry): void {
  // Intentionally empty: see src/art/units/.
}
