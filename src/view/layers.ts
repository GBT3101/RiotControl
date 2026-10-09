/**
 * World view layer stack (bottom → top):
 *
 *   world (render group; camera transform + integer shake)
 *     terrain    baked ground chunks                         (container tint = grade)
 *     decals     decal render texture, cast shadows          (container tint = grade)
 *     bodies     fallen bodies, dying anims, ground FX        (container tint = grade)
 *     entities   buildings (depth pieces), props, people, vehicles, upright FX — sorted by zIndex
 *                (per-sprite tint: graded sprites get the grade, lit windows stay white)
 *     ghosts     x-ray silhouettes of people behind buildings (ally blue / enemy red)
 *     air        helicopters, thrown snipers, projectiles in flight (per-sprite tint)
 *     lights     additive light sprites (lamps, fires, sirens, flashes); alpha = darkness
 *     overlays   selection & range rings, tile highlights, placement ghosts (never graded)
 *   screen       screen-space FX (Hate pickups flying to the HUD, confetti, stamps)
 */
import { Container } from 'pixi.js';

export interface ViewLayers {
  world: Container;
  terrain: Container;
  decals: Container;
  bodies: Container;
  entities: Container;
  ghostsAlly: Container;
  ghostsEnemy: Container;
  air: Container;
  lights: Container;
  overlays: Container;
  screen: Container;
}

export function createViewLayers(parent: Container): ViewLayers {
  const world = new Container({ label: 'world', isRenderGroup: true });
  const terrain = new Container({ label: 'terrain' });
  const decals = new Container({ label: 'decals' });
  const bodies = new Container({ label: 'bodies' });
  const entities = new Container({ label: 'entities', sortableChildren: true });
  const ghostsAlly = new Container({ label: 'ghosts-ally' });
  const ghostsEnemy = new Container({ label: 'ghosts-enemy' });
  const air = new Container({ label: 'air', sortableChildren: true });
  const lights = new Container({ label: 'lights' });
  const overlays = new Container({ label: 'overlays' });
  const screen = new Container({ label: 'screen-fx' });
  world.addChild(terrain, decals, bodies, entities, ghostsEnemy, ghostsAlly, air, lights, overlays);
  parent.addChild(world, screen);
  return {
    world,
    terrain,
    decals,
    bodies,
    entities,
    ghostsAlly,
    ghostsEnemy,
    air,
    lights,
    overlays,
    screen,
  };
}
