/**
 * Landmarks (milestone M3b): the three Capitols and the secondary skyline landmarks.
 *
 * Every landmark sprite is anchored on its footprint's **top (north) vertex** — the world
 * position ((i − j)·16, (i + j)·8) of footprint tile (i, j) — exactly like M1 buildings, so
 * `new Sprite(art.tex(name))` at that world point lines the art up with the footprint.
 * Animated details (flags, fire, smoke, clock hands) are overlay sprites placed at the offsets
 * returned by `landmarkOverlays()` (world px relative to the same anchor).
 * Catalogue and conventions: docs/art/M3b.md.
 */
import { SHADOW, SHADOW_ALPHA } from '../palette';
import type { SpriteRegistry } from '../lib/registry';
import type { CityId } from '../../maps/contract';
import { buildBourbon, BOURBON_D, BOURBON_W } from './bourbon';
import { buildCongreso, CONGRESO_D, CONGRESO_W } from './congreso';
import { DAMAGE_STATES, project, type DamageState } from './engine/kit';
import { registerLandmarkFx } from './fx';
import { clearRenderCache } from './engine/scene';
import { registerSecondary } from './secondary';
import { stepTile } from './steps';
import type { Build } from './types';
import { buildWestminster, WESTMINSTER_D, WESTMINSTER_W } from './westminster';

export type { DamageState } from './engine/kit';
export { SECONDARY } from './secondary';

export interface CapitolArt {
  w: number;
  d: number;
  /** Pixels above the anchor (sprite top margin). */
  top: number;
  build: (s: DamageState) => Build;
}

export const CAPITOL_ART: Readonly<Record<CityId, CapitolArt>> = {
  madrid: { w: CONGRESO_W, d: CONGRESO_D, top: 122, build: buildCongreso },
  london: { w: WESTMINSTER_W, d: WESTMINSTER_D, top: 212, build: buildWestminster },
  paris: { w: BOURBON_W, d: BOURBON_D, top: 124, build: buildBourbon },
};

/** An animated overlay: draw `sprite` with its anchor at landmarkAnchor + (x, y), above the landmark. */
export interface OverlayPlacement {
  sprite: string;
  x: number;
  y: number;
}

const OVERLAYS = new Map<string, OverlayPlacement[]>();

/**
 * Overlays for a landmark sprite (`lm.capitol.<city>.<state>` or `lm.<id>`), in draw order.
 * Offsets are world px from the landmark anchor (footprint top vertex). Available after
 * `registerLandmarks` ran (capitols are also computed on demand).
 */
export function landmarkOverlays(name: string): readonly OverlayPlacement[] {
  const hit = OVERLAYS.get(name);
  if (hit) return hit;
  const m = /^lm\.capitol\.(madrid|london|paris)\.([0-4])$/.exec(name);
  if (!m) return [];
  const list = toPlacements(CAPITOL_ART[m[1] as CityId].build(Number(m[2]) as DamageState));
  OVERLAYS.set(name, list);
  return list;
}

export function toPlacements(b: Build): OverlayPlacement[] {
  return b.overlays.map((o) => {
    const p = project(o.u, o.v, o.z);
    return { sprite: o.sprite, x: p.x, y: p.y };
  });
}

export function registerLandmarks(reg: SpriteRegistry): void {
  registerLandmarkFx(reg);
  for (const city of ['madrid', 'london', 'paris'] as const) {
    const art = CAPITOL_ART[city];
    for (const st of DAMAGE_STATES) {
      const b = art.build(st);
      const out = b.scene.render(
        { w: art.w, d: art.d, top: art.top },
        { cacheKey: `capitol.${city}.${st < 4 ? 'intact' : 'ruin'}` },
      );
      const name = `lm.capitol.${city}.${st}`;
      reg.add(name, { group: 'landmarks', frames: out.img, anchor: out.anchor, tags: ['capitol'] });
      OVERLAYS.set(name, toPlacements(b));
      if (st === 0) {
        reg.add(`lm.capitol.${city}.night`, {
          group: 'landmarks',
          frames: out.night,
          anchor: out.anchor,
          tags: ['night'],
        });
        const sh = b.scene.groundShadow(
          { w: art.w, d: art.d, top: 0 },
          SHADOW_ALPHA,
          SHADOW,
          () => true,
        );
        reg.add(`lm.capitol.${city}.shadow`, {
          group: 'landmarks',
          frames: sh.img,
          anchor: sh.anchor,
          hasShadow: true,
          tags: ['shadow'],
        });
      }
    }
    reg.add(`lm.capitol.${city}.steptile`, {
      group: 'landmarks',
      frames: stepTile(city),
      anchor: { x: 16, y: 0 },
      tags: ['tile'],
    });
  }
  registerSecondary(reg, OVERLAYS);
  clearRenderCache();
}
