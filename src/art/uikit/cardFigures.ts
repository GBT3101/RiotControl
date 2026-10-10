/**
 * Deploy-card figures: the whole unit as it appears in the game (idle frame, SE facing, baked
 * ground shadow) standing in the card window on a small Ministry backdrop (navy wall with the
 * faint grid lines + a floor band). Infantry, the horse and the blockade use their in-game
 * sprites at 1×; the vehicles use their card-sized renditions (`veh.<id>.card[.sm]`, rendered
 * from the same models in src/art/vehicles/cardFigures.ts); the Sniper Brigade is a squad of three.
 *
 * DOM-free: `composeFigure` takes a sprite getter, so the HUD feeds it atlas pixels
 * (src/ui/art.ts `unitCardFigure`) and tools / tests feed it a registry.
 */
import type { PixelBuffer, Point } from '../lib/pixels';
import { blit, createBuffer, opaqueBounds } from '../lib/pixels';
import { px, rect, vline } from '../fx/draw';
import type { UnitId } from '../../data/units';
import type { CardState } from './cards';

/** Card window size class: desktop deploy card or compact phone card. */
export type FigureSize = 'card' | 'compact';

/** One sprite of a figure: frame `frame` of `name`, its anchor placed at (dx, dy). */
export interface FigureLayer {
  name: string;
  frame?: number;
  dx: number;
  dy: number;
}

export interface FigureRecipe {
  /** Back to front. */
  layers: readonly FigureLayer[];
  /** Horizontal nudge (px) of the centred figure (crop focus when it is wider than the window). */
  shiftX?: number;
}

/** A composed figure: opaque body pixels + semi-transparent baked shadow pixels. */
export interface CardFigure {
  buf: PixelBuffer;
  /** Bounds of the opaque (body) pixels. */
  body: { x: number; y: number; w: number; h: number };
  /** Bounds of everything (body + shadow). */
  all: { x: number; y: number; w: number; h: number };
  shiftX: number;
}

const one = (name: string, shiftX = 0): FigureRecipe => ({
  layers: [{ name, dx: 0, dy: 0 }],
  shiftX,
});

/** Sniper Brigade squad on the card: back-left, middle, front-right (tighter than in game). */
function squad(dx: number, dy: number, shiftX: number): FigureRecipe {
  const name = 'unit.brigade.idle.se';
  return {
    layers: [
      { name, dx: -dx, dy: -dy },
      { name, dx: 0, dy: 0 },
      { name, dx, dy },
    ],
    shiftX,
  };
}

/** What each unit's card shows, per window size. */
export const CARD_FIGURES: Record<UnitId, Record<FigureSize, FigureRecipe>> = {
  riot: { card: one('unit.riot.idle.se'), compact: one('unit.riot.idle.se') },
  sniper: { card: one('unit.sniper.idle.se'), compact: one('unit.sniper.idle.se') },
  blockade: { card: one('unit.blockade.single.i'), compact: one('unit.blockade.single.i') },
  gas: { card: one('unit.gas.idle.se'), compact: one('unit.gas.idle.se') },
  mounted: { card: one('unit.horse.idle.se'), compact: one('unit.horse.idle.se', -4) },
  armed: { card: one('unit.cop.idle.se'), compact: one('unit.cop.idle.se') },
  soldier: { card: one('unit.soldier.idle.se'), compact: one('unit.soldier.idle.se') },
  humvee: { card: one('veh.humvee.card'), compact: one('veh.humvee.card.sm') },
  brigade: { card: squad(9, 4, 0), compact: squad(7, 4, 0) },
  tank: { card: one('veh.tank.card'), compact: one('veh.tank.card.sm') },
  heli: { card: one('veh.heli.card'), compact: one('veh.heli.card.sm') },
};

/** Sprite pixels + anchor lookup (null while the art is not loaded). */
export type FigureSource = (
  name: string,
  frame: number,
) => { buf: PixelBuffer; anchor: Point } | null;

/** Compose a recipe (null until every layer's art is available). */
export function composeFigure(recipe: FigureRecipe, get: FigureSource): CardFigure | null {
  const parts: Array<{ buf: PixelBuffer; x: number; y: number }> = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const l of recipe.layers) {
    const s = get(l.name, l.frame ?? 0);
    if (!s) return null;
    const x = l.dx - s.anchor.x;
    const y = l.dy - s.anchor.y;
    parts.push({ buf: s.buf, x, y });
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + s.buf.w);
    y1 = Math.max(y1, y + s.buf.h);
  }
  const out = createBuffer(x1 - x0, y1 - y0);
  for (const p of parts) blit(out, p.buf, p.x - x0, p.y - y0);
  const all = opaqueBounds(out);
  if (!all) return null;
  // Body = fully opaque pixels only.
  let bx0 = out.w;
  let by0 = out.h;
  let bx1 = -1;
  let by1 = -1;
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      if (out.data[(y * out.w + x) * 4 + 3] !== 255) continue;
      bx0 = Math.min(bx0, x);
      by0 = Math.min(by0, y);
      bx1 = Math.max(bx1, x);
      by1 = Math.max(by1, y);
    }
  }
  if (bx1 < 0) return null;
  return {
    buf: out,
    body: { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 },
    all,
    shiftX: recipe.shiftX ?? 0,
  };
}

/* Window ------------------------------------------------------------------------------------ */

/** Window metrics per size: floor band height and the gap kept under the figure's lowest pixel. */
const WINDOW = {
  card: { floor: 8, margin: 2 },
  compact: { floor: 6, margin: 1 },
} as const;

interface Look {
  wall: string;
  grid: string;
  floor: string;
  horizon: string;
  shadow: string;
}

function lookOf(st: CardState): Look {
  if (st === 'locked')
    return { wall: 'gray1', grid: 'gray2', floor: 'gray2', horizon: 'gray3', shadow: 'gray1' };
  if (st === 'unaffordable')
    return { wall: 'gray3', grid: 'gray2', floor: 'gray4', horizon: 'gray5', shadow: 'gray2' };
  return { wall: 'stone1', grid: 'stone0', floor: 'stone2', horizon: 'stone3', shadow: 'stone0' };
}

const GREYS = ['ink', 'gray1', 'gray2', 'gray3', 'gray4', 'gray5', 'gray6'];

/** Unaffordable: luminance → gray ramp. */
function greyRef(r: number, g: number, b: number): string {
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return GREYS[Math.min(6, Math.floor((l / 256) * 7.5))]!;
}

/**
 * Paint the window interior `win` (backdrop, floor, figure with its ground shadow, clipped) in
 * the card state's look: unaffordable greys the figure, locked turns it into an ink silhouette
 * with a faint rim on the grey backdrop. `fig` null = empty backdrop (art still loading).
 */
export function drawFigureWindow(
  b: PixelBuffer,
  win: { x: number; y: number; w: number; h: number },
  fig: CardFigure | null,
  st: CardState,
  size: FigureSize,
): void {
  const k = lookOf(st);
  const m = WINDOW[size];
  const floorY = win.y + win.h - m.floor;
  rect(b, win.x, win.y, win.w, win.h, k.wall);
  for (let x = win.x + 3; x < win.x + win.w; x += 6) vline(b, x, win.y, floorY - win.y, k.grid);
  rect(b, win.x, floorY, win.w, win.y + win.h - floorY, k.floor);
  rect(b, win.x, floorY, win.w, 1, k.horizon);
  if (!fig) return;
  const f = fig.buf;
  // Centre the body horizontally and stand the figure (shadow included) on the floor. A tall
  // figure gives up the floor margin first, then has its bottom cropped (head kept in view).
  let ox = win.x + Math.floor((win.w - fig.body.w) / 2) - fig.body.x + fig.shiftX;
  const bottom = fig.all.y + fig.all.h;
  let oy = win.y + win.h - m.margin - bottom;
  if (fig.body.y + oy < win.y) oy = Math.max(win.y + win.h - bottom, win.y - fig.body.y);
  // A body that fits stays wholly inside the window whatever its nudge.
  if (fig.body.w <= win.w) {
    ox = Math.max(win.x - fig.body.x, Math.min(ox, win.x + win.w - fig.body.x - fig.body.w));
  }
  const inWin = (x: number, y: number) =>
    x >= win.x && y >= win.y && x < win.x + win.w && y < win.y + win.h;
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < f.w && y < f.h && f.data[(y * f.w + x) * 4 + 3] === 255;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const tx = ox + x;
      const ty = oy + y;
      if (!inWin(tx, ty)) continue;
      const i = (y * f.w + x) * 4;
      const a = f.data[i + 3]!;
      if (a === 0) continue;
      if (a !== 255) {
        px(b, tx, ty, k.shadow);
        continue;
      }
      if (st === 'locked') {
        px(b, tx, ty, opaque(x, y - 1) ? 'ink' : 'gray3');
      } else if (st === 'unaffordable') {
        px(b, tx, ty, greyRef(f.data[i]!, f.data[i + 1]!, f.data[i + 2]!));
      } else {
        b.data.set(f.data.subarray(i, i + 4), (ty * b.w + tx) * 4);
      }
    }
  }
}
