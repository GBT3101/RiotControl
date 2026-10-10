/**
 * Deploy-card figures of the vehicles: the whole MG Humvee, tank and helicopter in the in-game
 * SE view, rendered from the same part models at a card-sized pixel scale (the ray caster
 * rasterises one sample per pixel, so a smaller scale is still clean pixel art: ramp-step
 * shading, upper-left light, coloured outlines, sun-cast shadow). Two sizes: `card` for the
 * desktop deploy card window (30×29) and `card.sm` for the compact phone card (22×22).
 * Anchor = ground point (the shadow is baked in, like the in-game sprites).
 */
import { resolveColor } from '../palette';
import type { SpriteRegistry } from '../lib/registry';
import {
  blit,
  createBuffer,
  crop,
  getPixel,
  opaqueBounds,
  setPixel,
  type PixelBuffer,
  type Point,
} from '../lib/pixels';
import { HELI_HUB, heliBody } from './heli';
import { HUMVEE_PIVOT, humveeHull, humveeTurret } from './humvee';
import { MATS } from './materials';
import { projectPx, renderAnim, renderModel, rotZ, type Model, type View } from './render3d';
import { TANK_PIVOT, tankHull, tankTurret } from './tank';

export type CardFigureSize = 'card' | 'card.sm';

/** Pixel scale per vehicle and card size (fitted by eye to the card windows). */
const SCALE: Record<'humvee' | 'tank' | 'heli', Record<CardFigureSize, number>> = {
  humvee: { card: 0.66, 'card.sm': 0.5 },
  tank: { card: 0.54, 'card.sm': 0.4 },
  heli: { card: 0.56, 'card.sm': 0.43 },
};
/** Card hover height of the helicopter body above its ground shadow (px). */
const HELI_CARD_ALT: Record<CardFigureSize, number> = { card: 11, 'card.sm': 8 };

function render(m: Model, v: View): { frame: PixelBuffer; anchor: Point } {
  const a = renderAnim([m], MATS, v);
  return { frame: a.frames[0]!, anchor: a.anchor };
}

/**
 * Stopped main rotor seen in the iso ground plane: 4 blades as 1-px screen lines with a lit
 * upper edge and hi-vis tips, over the hub (same construction as the in-game rotor layer).
 */
function drawRotor(b: PixelBuffer, hub: Point, r: number, angle: number): void {
  const blade = resolveColor('gray1');
  const bladeHi = resolveColor('gray4');
  const tip = resolveColor('hivis1');
  for (let k = 0; k < 4; k++) {
    const ang = ((angle + k * 90) * Math.PI) / 180;
    const a = Math.cos(ang) * r;
    const c = Math.sin(ang) * r;
    const ex = a - c;
    const ey = (a + c) / 2;
    const steps = Math.ceil(Math.max(Math.abs(ex), Math.abs(ey)) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(hub.x + ex * t);
      const y = Math.round(hub.y + ey * t);
      if (x < 0 || y < 1 || x >= b.w || y >= b.h || t * r < 1.2) continue;
      const isTip = t * r > r - 1;
      setPixel(b, x, y, isTip ? tip : blade);
      const above = getPixel(b, x, y - 1);
      if ((above & 255) !== 255 || above === blade) setPixel(b, x, y - 1, isTip ? tip : bladeHi);
    }
  }
  setPixel(b, hub.x, hub.y, resolveColor('gray1'));
  setPixel(b, hub.x, hub.y - 1, resolveColor('zinc2'));
}

/** Whole-vehicle card figure (frame + ground anchor). */
export function vehicleCardFigure(
  id: 'humvee' | 'tank' | 'heli',
  size: CardFigureSize,
): { frame: PixelBuffer; anchor: Point } {
  const scale = SCALE[id][size];
  if (id === 'humvee') {
    const m = humveeHull(0, 'ok');
    m.add(humveeTurret('idle'), HUMVEE_PIVOT, rotZ(-45));
    return render(m, { yaw: 0, scale });
  }
  if (id === 'tank') {
    const m = tankHull(0, 'ok');
    m.add(tankTurret('idle'), TANK_PIVOT, rotZ(-45));
    return render(m, { yaw: 0, scale });
  }
  // Helicopter: hovering body + stopped rotor, its footprint shadow on the ground below.
  const v: View = { yaw: 0, scale };
  const W = 64;
  const H = 64;
  const gx = 32;
  const gy = 44;
  const alt = HELI_CARD_ALT[size];
  const out = createBuffer(W, H);
  const sh = renderModel(heliBody(0, false, v), MATS, v, {
    shadowOnly: true,
    w: W,
    h: H,
    ax: gx,
    ay: gy,
  });
  blit(out, sh.buf, 0, 0);
  const body = renderModel(heliBody(0, false, v), MATS, v, {
    shadow: false,
    w: W,
    h: H,
    ax: gx,
    ay: gy - alt,
  });
  blit(out, body.buf, 0, 0);
  const hub = projectPx(HELI_HUB, v);
  drawRotor(out, { x: gx + hub.x, y: gy - alt + hub.y }, 17 * scale, 0);
  const ob = opaqueBounds(out)!;
  return { frame: crop(out, ob.x, ob.y, ob.w, ob.h), anchor: { x: gx - ob.x, y: gy - ob.y } };
}

export function registerCardFigures(reg: SpriteRegistry): void {
  for (const id of ['humvee', 'tank', 'heli'] as const) {
    for (const size of ['card', 'card.sm'] as const) {
      const f = vehicleCardFigure(id, size);
      reg.add(`veh.${id}.${size}`, {
        group: 'vehicles',
        frames: f.frame,
        anchor: f.anchor,
        hasShadow: true,
        tags: ['card'],
      });
    }
  }
}
