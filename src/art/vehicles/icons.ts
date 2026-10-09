/**
 * Deploy-card portraits (32×32): humvee, tank, helicopter in a heroic front three-quarter view.
 */
import type { SpriteRegistry } from '../lib/registry';
import { blit, createBuffer, type PixelBuffer } from '../lib/pixels';
import { heliBody } from './heli';
import { HUMVEE_PIVOT, humveeHull, humveeTurret } from './humvee';
import { MATS } from './materials';
import { Model, renderAnim, rotZ, type View } from './render3d';
import { TANK_PIVOT, tankHull, tankTurret } from './tank';

const SIZE = 32;

function fit(frames: PixelBuffer[]): PixelBuffer {
  const f = frames[0]!;
  const out = createBuffer(SIZE, SIZE);
  blit(out, f, Math.floor((SIZE - f.w) / 2), Math.max(0, SIZE - 1 - f.h));
  return out;
}

export function registerIcons(reg: SpriteRegistry): void {
  const yaw = 22.5;
  // Humvee: turret aimed slightly off-axis for drama.
  {
    const m = humveeHull(0, 'ok');
    m.add(humveeTurret('idle'), HUMVEE_PIVOT, rotZ(-20));
    const v: View = { yaw, scale: 0.72 };
    const a = renderAnim([m], MATS, v, { shadow: false, contour: 2.6 });
    reg.add('veh.humvee.icon', { group: 'vehicles', frames: fit(a.frames), anchor: { x: 16, y: 31 }, tags: ['icon'] });
  }
  {
    const m = tankHull(0, 'ok');
    m.add(tankTurret('idle'), TANK_PIVOT, rotZ(-25));
    const v: View = { yaw, scale: 0.56 };
    const a = renderAnim([m], MATS, v, { shadow: false, contour: 3 });
    reg.add('veh.tank.icon', { group: 'vehicles', frames: fit(a.frames), anchor: { x: 16, y: 31 }, tags: ['icon'] });
  }
  {
    const m = heliBody(0, false);
    // Static blades for the portrait.
    const r = new Model();
    for (const ang of [20, 110]) r.box('dark', [-19, -0.9, 8.4], [19, 0.9, 8.9]).rot('z', ang);
    m.add(r);
    const v: View = { yaw: 45 + 22.5, pitch: 6, scale: 0.56 };
    const a = renderAnim([m], MATS, v, { shadow: false, contour: 3 });
    reg.add('veh.heli.icon', { group: 'vehicles', frames: fit(a.frames), anchor: { x: 16, y: 31 }, tags: ['icon'] });
  }
}
