/**
 * Secondary landmarks (LANDMARKS in src/maps/contract.ts) at their contract footprints.
 * Each builder returns a Scene for one animation frame (fountains / the London Eye animate;
 * the rest are static). Registration: `lm.<id>` (+ `.night`, `.shadow`).
 * Builders live per city in src/art/landmarks/<city>/landmarks.ts (registry.ts merges them).
 */
import { SHADOW, SHADOW_ALPHA } from '../palette';
import type { SpriteRegistry } from '../lib/registry';
import { LANDMARKS, type LandmarkId } from '../../maps/contract';
import { project } from './engine/kit';
import type { Build, Overlay } from './types';
import { SECONDARY } from './registry';

export { SECONDARY } from './registry';
export type { SecondaryArt } from './shared';

export function registerSecondary(
  reg: SpriteRegistry,
  overlays: Map<string, Array<{ sprite: string; x: number; y: number }>>,
): void {
  for (const id of Object.keys(SECONDARY) as LandmarkId[]) {
    const art = SECONDARY[id]!;
    const def = LANDMARKS[id];
    const cv = {
      w: def.w,
      d: def.d,
      top: art.top,
      left: 2 + (art.side ?? 0),
      right: 2 + (art.side ?? 0),
    };
    const frames = [];
    let first: Build | null = null;
    let night = null;
    for (let f = 0; f < art.frames; f++) {
      const b = art.build(f);
      const out = b.scene.render(cv, {
        cacheKey: art.frames > 1 && id !== 'londonEye' ? `lm.${id}` : undefined,
      });
      frames.push(out.img);
      if (f === 0) {
        first = b;
        night = out;
      }
    }
    const name = `lm.${id}`;
    reg.add(name, {
      group: 'landmarks',
      frames,
      fps: art.fps,
      anchor: night!.anchor,
      tags: ['landmark', def.city],
    });
    reg.add(`${name}.night`, {
      group: 'landmarks',
      frames: night!.night,
      anchor: night!.anchor,
      tags: ['night'],
    });
    const sh = first!.scene.groundShadow(cv, SHADOW_ALPHA, SHADOW, () => true);
    reg.add(`${name}.shadow`, {
      group: 'landmarks',
      frames: sh.img,
      anchor: sh.anchor,
      hasShadow: true,
      tags: ['shadow'],
    });
    overlays.set(
      name,
      first!.overlays.map((o: Overlay) => {
        const p = project(o.u, o.v, o.z);
        return { sprite: o.sprite, x: p.x, y: p.y };
      }),
    );
  }
}
