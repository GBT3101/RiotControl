/**
 * World layer stack. The `world` container is scaled by the camera's integer zoom; `ui` lives
 * in screen space at its own integer scale.
 *
 *   world
 *     terrain    baked ground chunks (render textures)
 *     decals     ground marks, cast shadows, blood, scorch (unsorted, below everything)
 *     bodies     fallen bodies (sorted cheaply by insertion)
 *     entities   buildings, units, protesters, props — depth-sorted by zIndex (depthKey)
 *     overlays   selection rings, placement ghosts, tile highlights (above entities)
 *   ui           HUD, screen space
 */
import { Container } from 'pixi.js';

export interface WorldLayers {
  root: Container;
  world: Container;
  terrain: Container;
  decals: Container;
  bodies: Container;
  entities: Container;
  overlays: Container;
  ui: Container;
}

export function createLayers(stage: Container): WorldLayers {
  const world = new Container({ label: 'world' });
  const terrain = new Container({ label: 'terrain' });
  const decals = new Container({ label: 'decals' });
  const bodies = new Container({ label: 'bodies' });
  const entities = new Container({ label: 'entities', sortableChildren: true });
  const overlays = new Container({ label: 'overlays' });
  const ui = new Container({ label: 'ui' });
  world.addChild(terrain, decals, bodies, entities, overlays);
  stage.addChild(world, ui);
  return { root: stage, world, terrain, decals, bodies, entities, overlays, ui };
}
