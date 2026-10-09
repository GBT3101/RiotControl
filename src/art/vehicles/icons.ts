/**
 * Deploy-card portraits (32×32): humvee, tank, helicopter — rendered at native 1× in a heroic
 * front three-quarter view and cropped tight around the crew/turret (cards frame them).
 */
import type { SpriteRegistry } from '../lib/registry';
import { crop, type PixelBuffer } from '../lib/pixels';
import { heliBody } from './heli';
import { HUMVEE_PIVOT, humveeHull, humveeTurret } from './humvee';
import { MATS } from './materials';
import { projectPx, renderAnim, rotZ, type Model, type V3, type View } from './render3d';
import { TANK_PIVOT, tankHull, tankTurret } from './tank';

const SIZE = 32;

function portrait(m: Model, v: View, focus: V3): PixelBuffer {
  const a = renderAnim([m], MATS, v, { shadow: false });
  const f = projectPx(focus, v);
  const cx = a.anchor.x + f.x;
  const cy = a.anchor.y + f.y;
  return crop(a.frames[0]!, cx - SIZE / 2, cy - SIZE / 2, SIZE, SIZE);
}

export function registerIcons(reg: SpriteRegistry): void {
  const add = (id: string, buf: PixelBuffer) =>
    reg.add(`veh.${id}.icon`, {
      group: 'vehicles',
      frames: buf,
      anchor: { x: 16, y: 31 },
      tags: ['icon'],
    });
  {
    const m = humveeHull(0, 'ok');
    m.add(humveeTurret('idle'), HUMVEE_PIVOT, rotZ(-30));
    add('humvee', portrait(m, { yaw: 22.5 }, [3, 0, 10]));
  }
  {
    const m = tankHull(0, 'ok');
    m.add(tankTurret('idle'), TANK_PIVOT, rotZ(-35));
    add('tank', portrait(m, { yaw: 22.5 }, [5, 0, 9]));
  }
  {
    const m = heliBody(0, false);
    add('heli', portrait(m, { yaw: 67.5, pitch: 6 }, [2, 0, 0]));
  }
}
