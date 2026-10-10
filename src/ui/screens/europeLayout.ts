/**
 * Campaign map layout maths (E1), pure and unit-tested:
 *
 * - `zoomPlan`: the map's integer zoom range (device px per map px) for a screen — min shows
 *   the whole sheet, the default frames the twelve cities in the free area beside the card.
 * - `screenPlan`: where the header, BACK, card and the free map area go (UI px).
 * - `layoutTags`: city name tags around their pins (UI px). Greedy, most constrained first;
 *   a tag never overlaps a pin, another tag or the map's edge, and is hidden when no spot is
 *   free (the selected city and Level 1 are placed first, so they always show).
 */
import { overlaps, type Box } from '../core/boxes';

/** Pin footprint relative to its needle tip (UI px): head, needle and shadow. */
export const PIN_BOX = { x: -4, y: -11, w: 11, h: 13 } as const;
/** Head centre relative to the tip (leader threads start here). */
export const PIN_HEAD = { x: 0, y: -8 } as const;

export function pinBox(ax: number, ay: number): Box {
  return { x: ax + PIN_BOX.x, y: ay + PIN_BOX.y, w: PIN_BOX.w, h: PIN_BOX.h };
}

export interface ZoomPlan {
  min: number;
  max: number;
  def: number;
}

/**
 * Zoom range for a sheet of `sheet` map px on a device-px screen. `free` is the device-px area
 * not covered by the card / header, `core` the map-px box that must fit there by default.
 */
export function zoomPlan(
  dev: { w: number; h: number },
  free: { w: number; h: number },
  sheet: { w: number; h: number },
  core: { w: number; h: number },
): ZoomPlan {
  const fitAll = Math.floor(Math.min(dev.w / sheet.w, free.h / sheet.h));
  const min = Math.max(1, fitAll);
  let def = min;
  for (let z = min; z <= min + 6; z++) if (core.w * z <= free.w && core.h * z <= free.h) def = z;
  return { min, max: def + 3, def };
}

export interface ScreenPlan {
  /** Header plaque area (centred text) and BACK button spot. */
  header: Box;
  back: { x: number; y: number };
  /** Card (folder incl. its 10 px tab) and whether it uses the wide/short postcard. */
  card: Box;
  horizontal: boolean;
  /** Map area not covered by the header or the card. */
  free: Box;
  /** Two-line header (desktop / landscape) or one line (portrait). */
  headerLines: 1 | 2;
}

export interface Safe {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** BACK button size (stamp face, UI px). */
export const BACK_SIZE = { w: 44, h: 26 } as const;

/** Screen regions (UI px) for a W×H UI with safe-area insets. */
export function screenPlan(W: number, H: number, safe: Safe): ScreenPlan {
  const portrait = W < 420;
  const top = safe.top + 4;
  const back = { x: safe.left + 5, y: top };
  const headerX = back.x + BACK_SIZE.w + 6;
  const headerW = W - safe.right - 5 - headerX - (portrait ? 0 : BACK_SIZE.w + 6);
  const headerLines: 1 | 2 = portrait || H < 260 ? 1 : 2;
  const headerH = headerLines === 2 ? 30 : BACK_SIZE.h;
  const header = { x: headerX, y: top, w: headerW, h: headerH };
  const below = top + Math.max(headerH, BACK_SIZE.h) + 4;
  if (portrait) {
    const cw = Math.min(300, W - safe.left - safe.right - 12);
    const ch = Math.max(96, Math.min(124, Math.floor((H - below) * 0.3)));
    const card = {
      x: Math.floor((W - cw) / 2),
      y: H - safe.bottom - 6 - ch - 10,
      w: cw,
      h: ch + 10,
    };
    return {
      header,
      back,
      card,
      horizontal: true,
      free: { x: 0, y: below, w: W, h: card.y - below - 2 },
      headerLines,
    };
  }
  const cw = Math.max(136, Math.min(176, Math.floor(W * 0.3)));
  const ch = Math.min(236, H - below - safe.bottom - 6 - 10);
  const card = { x: W - safe.right - 6 - cw, y: below, w: cw, h: ch + 10 };
  return {
    header,
    back,
    card,
    horizontal: false,
    free: { x: 0, y: below, w: card.x - 4, h: H - below },
    headerLines,
  };
}

export interface TagIn {
  id: string;
  /** Pin needle tip (UI px). */
  x: number;
  y: number;
  /** Tag size (UI px). */
  w: number;
  h: number;
  /** Lower = placed earlier (selected 0, level 1 next, …). */
  rank: number;
}

export interface TagOut {
  id: string;
  pin: Box;
  /** Tag box, or null when hidden (no free spot). */
  tag: Box | null;
  /** The tag sits away from its pin (a thread is drawn). */
  leader: boolean;
}

/** Candidate tag positions around a pin, nearest first (relative to the needle tip). */
function candidates(w: number, h: number): Array<{ dx: number; dy: number; leader: boolean }> {
  const head = PIN_HEAD.y;
  const out: Array<{ dx: number; dy: number; leader: boolean }> = [
    { dx: 8, dy: head - (h >> 1), leader: false },
    { dx: -7 - w, dy: head - (h >> 1), leader: false },
    { dx: -(w >> 1), dy: PIN_BOX.y - 2 - h, leader: false },
    { dx: -(w >> 1), dy: 4, leader: false },
  ];
  for (const r of [8, 16, 26, 38]) {
    out.push(
      { dx: 8 + r, dy: head - (h >> 1), leader: true },
      { dx: -7 - w - r, dy: head - (h >> 1), leader: true },
      { dx: -(w >> 1), dy: PIN_BOX.y - 2 - h - r, leader: true },
      { dx: -(w >> 1), dy: 4 + r, leader: true },
      { dx: 6 + r * 0.7, dy: PIN_BOX.y - 2 - h - r * 0.7, leader: true },
      { dx: -6 - w - r * 0.7, dy: PIN_BOX.y - 2 - h - r * 0.7, leader: true },
      { dx: 6 + r * 0.7, dy: 3 + r * 0.7, leader: true },
      { dx: -6 - w - r * 0.7, dy: 3 + r * 0.7, leader: true },
    );
  }
  return out.map((c) => ({ ...c, dx: Math.round(c.dx), dy: Math.round(c.dy) }));
}

/** Does the segment (a → b) pass through box `r`? (Leader threads must not cross pins.) */
function segmentHits(ax: number, ay: number, bx: number, by: number, r: Box): boolean {
  const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
  for (let i = 0; i <= n; i++) {
    const x = ax + ((bx - ax) * i) / (n || 1);
    const y = ay + ((by - ay) * i) / (n || 1);
    if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return true;
  }
  return false;
}

/** Nearest point of box `r` to (x, y): where a leader thread meets its tag. */
export function nearestOn(r: Box, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(r.x, Math.min(r.x + r.w - 1, x)),
    y: Math.max(r.y, Math.min(r.y + r.h - 1, y)),
  };
}

/**
 * Place every tag (see module doc). `area` bounds the tags (the sheet). `avoid` are extra boxes
 * no tag may touch; spots inside `prefer` (the part of the map on screen) are tried first.
 */
export function layoutTags(
  pins: readonly TagIn[],
  area: Box,
  avoid: readonly Box[] = [],
  prefer?: Box,
): TagOut[] {
  const pinBoxes = new Map(pins.map((p) => [p.id, pinBox(p.x, p.y)]));
  const crowd = (p: TagIn): number =>
    pins.filter((q) => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 48).length;
  const order = [...pins].sort((a, b) => a.rank - b.rank || crowd(b) - crowd(a));
  const placed: Box[] = [];
  const threads: Array<[number, number, number, number]> = [];
  const out = new Map<string, TagOut>();
  const inside = (t: Box, r: Box): boolean =>
    t.x >= r.x && t.y >= r.y && t.x + t.w <= r.x + r.w && t.y + t.h <= r.y + r.h;
  for (const p of order) {
    const pb = pinBoxes.get(p.id)!;
    let best: TagOut = { id: p.id, pin: pb, tag: null, leader: false };
    const all = candidates(p.w, p.h);
    // On-screen spots first; then the rest, least off-screen first (the camera pans to it).
    const offArea = (c: { dx: number; dy: number }): number => {
      if (!prefer) return 0;
      const t = { x: p.x + c.dx, y: p.y + c.dy, w: p.w, h: p.h };
      const ix = Math.max(0, Math.min(t.x + t.w, prefer.x + prefer.w) - Math.max(t.x, prefer.x));
      const iy = Math.max(0, Math.min(t.y + t.h, prefer.y + prefer.h) - Math.max(t.y, prefer.y));
      return t.w * t.h - ix * iy;
    };
    const tries = prefer
      ? all
          .map((c, i) => ({ c, i, o: offArea(c) }))
          .sort(
            (a, b) =>
              (a.o > 0 ? 1 : 0) - (b.o > 0 ? 1 : 0) || (a.o > 0 ? a.o - b.o : 0) || a.i - b.i,
          )
          .map((e) => e.c)
      : all;
    let thread: [number, number, number, number] | null = null;
    for (const c of tries) {
      const t = { x: p.x + c.dx, y: p.y + c.dy, w: p.w, h: p.h };
      if (!inside(t, area)) continue;
      if ([...pinBoxes.values()].some((b) => overlaps(t, b, 1))) continue;
      if (placed.some((b) => overlaps(t, b, 1)) || avoid.some((b) => overlaps(t, b, 1))) continue;
      if (threads.some(([ax, ay, bx, by]) => segmentHits(ax, ay, bx, by, t))) continue;
      thread = null;
      if (c.leader) {
        const hx = p.x + PIN_HEAD.x;
        const hy = p.y + PIN_HEAD.y;
        const e = nearestOn(t, hx, hy);
        const others = [...pinBoxes.entries()].filter(([id]) => id !== p.id).map(([, b]) => b);
        if (others.some((b) => segmentHits(hx, hy, e.x, e.y, b))) continue;
        if (placed.some((b) => segmentHits(hx, hy, e.x, e.y, b))) continue;
        thread = [hx, hy, e.x, e.y];
      }
      best = { id: p.id, pin: pb, tag: t, leader: c.leader };
      break;
    }
    if (best.tag) placed.push(best.tag);
    if (best.tag && thread) threads.push(thread);
    out.set(p.id, best);
  }
  return pins.map((p) => out.get(p.id)!);
}
