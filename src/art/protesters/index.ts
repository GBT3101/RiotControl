/**
 * Protesters (M4b): paper-doll variation system and every protester type.
 *
 * The main registry (gallery, tests, M1 atlas) gets a **showcase**: variant v0 of each type
 * with every animation (group `protesters`) plus the crowd preview & type lineup (group
 * `crowd`). The game builds its own city-flavoured protester atlas at map load:
 *
 *   const reg = new SpriteRegistry();
 *   const manifest = buildProtesterSheets(reg, { city: 'paris', seed: 7 });
 *   const protArt = buildArt(reg, 2048, createArt());
 *
 * See docs/art/M4b.md for names, frames, fps, anchors, events and atlas cost.
 */
import type { SpriteRegistry } from '../lib/registry';
import { rollVariant, registerVariant } from './build';
import { composeCrowd, cropScale } from './crowd';
import { composeLineup } from './lineup';
import { PROTESTER_TYPES } from './variants';

export function registerProtesters(reg: SpriteRegistry): void {
  for (const type of PROTESTER_TYPES) {
    registerVariant(reg, rollVariant(type, 0), { group: 'protesters', mirrors: true });
  }
  const crowd = composeCrowd({ w: 320, h: 180, count: 200 });
  reg.add('prot.crowd.preview', { group: 'crowd', frames: crowd, fps: 10, anchor: { x: 0, y: 0 }, tags: ['preview'] });
  reg.add('prot.crowd.crop3x', {
    group: 'crowd',
    frames: cropScale(crowd[0]!, 110, 55, 100, 60, 3),
    anchor: { x: 0, y: 0 },
    tags: ['preview'],
  });
  reg.add('prot.crowd.lineup', { group: 'crowd', frames: composeLineup(6), anchor: { x: 0, y: 0 }, tags: ['preview'] });
}

export {
  ANIMS,
  DEFAULT_VARIANTS,
  buildProtesterSheets,
  protesterVariantCount,
  registerVariant,
  rollVariant,
  type BuildOptions,
  type ProtesterManifest,
  type VariantInfo,
  type AnimEvent,
} from './build';
export { PROTESTER_TYPES, type ProtesterType, type Variant } from './variants';
export { composeCrowd } from './crowd';
export { SLOGANS, type City } from './sign';
