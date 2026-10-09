/**
 * "Ministry Dossier" panels. Every kind can be drawn at any size with `panel(kind, w, h)`
 * (pixel-exact, patterns stay crisp — preferred), and is also registered as a 9-slice source
 * sprite `ui.panel.<kind>` with insets in `NINE_SLICE` for Pixi's NineSliceSprite (edges and
 * centre of the sources are uniform, so stretching them is safe except leather stitching —
 * use `panel()` for that one).
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, has, hline, px, rect, stamp, vline } from '../fx/draw';
import { grid } from '../lib/grid';

export type PanelKind = 'manila' | 'paper' | 'brass' | 'leather' | 'tooltip' | 'bubble' | 'card' | 'recess' | 'newsprint';

export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 9-slice insets of the registered source sprites (also the safe content padding). */
export const NINE_SLICE: Record<PanelKind, Insets> = {
  manila: { left: 5, top: 5, right: 6, bottom: 7 },
  paper: { left: 10, top: 4, right: 4, bottom: 5 },
  brass: { left: 6, top: 6, right: 6, bottom: 7 },
  leather: { left: 7, top: 7, right: 7, bottom: 8 },
  tooltip: { left: 4, top: 6, right: 4, bottom: 5 },
  bubble: { left: 6, top: 5, right: 6, bottom: 7 },
  card: { left: 3, top: 3, right: 4, bottom: 5 },
  recess: { left: 2, top: 3, right: 2, bottom: 2 },
  newsprint: { left: 6, top: 6, right: 7, bottom: 8 },
};

const SOURCE_SIZE: Record<PanelKind, [number, number]> = {
  manila: [24, 24],
  paper: [24, 20],
  brass: [24, 24],
  leather: [32, 32],
  tooltip: [16, 16],
  bubble: [24, 20],
  card: [16, 16],
  recess: [12, 12],
  newsprint: [32, 32],
};

/** Round the corners of a filled rect by clearing pixels (r = 1..3). */
function roundCorners(b: PixelBuffer, x: number, y: number, w: number, h: number, r: number): void {
  const cut: Array<[number, number]> = r === 1 ? [[0, 0]] : r === 2 ? [[0, 0], [1, 0], [0, 1]] : [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]];
  for (const [cx, cy] of cut) {
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const xx = sx > 0 ? x + cx : x + w - 1 - cx;
      const yy = sy > 0 ? y + cy : y + h - 1 - cy;
      b.data.fill(0, (yy * b.w + xx) * 4, (yy * b.w + xx) * 4 + 4);
    }
  }
}

/** Ink outline around whatever is opaque (4-neighbour). */
function inkOutline(b: PixelBuffer, ref = 'ink'): void {
  const marks: Array<[number, number]> = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (has(b, x, y)) continue;
      if (has(b, x + 1, y) || has(b, x - 1, y) || has(b, x, y + 1) || has(b, x, y - 1)) marks.push([x, y]);
    }
  }
  for (const [x, y] of marks) px(b, x, y, ref);
}

/** Bevelled slab: face + light top/left band + dark bottom/right band (thickness t). */
function slab(b: PixelBuffer, x: number, y: number, w: number, h: number, face: string, light: string, dark: string, t = 1, deep?: string): void {
  rect(b, x, y, w, h, face);
  for (let i = 0; i < t; i++) {
    hline(b, x + i, y + i, w - i * 2, light);
    vline(b, x + i, y + i, h - i * 2, light);
    hline(b, x + i, y + h - 1 - i, w - i * 2, i === 0 && deep ? deep : dark);
    vline(b, x + w - 1 - i, y + i, h - i * 2, i === 0 && deep ? deep : dark);
  }
}

const RIVET = grid(`
  .ab.
  abbc
  bbcc
  .cc.
`, { a: 'ochre4', b: 'ochre2', c: 'earth3' });

function drawManila(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  // Folder body with a 2-px chunky bevel and a darker back sheet peeking at the bottom.
  rect(b, 1, 2, w - 2, h - 3, 'ochre1');
  slab(b, 1, 1, w - 3, h - 4, 'stone4', 'stone5', 'stone3', 2, 'ochre1');
  // Fibre flecks along the bevel (uniform period 6 so 9-slicing tiles cleanly).
  for (let x = 4; x < w - 6; x += 6) px(b, x, h - 6, 'stone3');
  inkOutline(b);
  return b;
}

function drawPaper(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  rect(b, 1, 1, w - 2, h - 2, 'white');
  // Shadow edge bottom/right (paper sits on the folder).
  hline(b, 2, h - 2, w - 3, 'stone3');
  vline(b, w - 2, 2, h - 3, 'stone3');
  hline(b, 1, 1, w - 3, 'white');
  // Red margin rule.
  vline(b, 7, 1, h - 3, 'crim2');
  inkOutline(b, 'stone1');
  return b;
}

function drawBrass(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  slab(b, 1, 1, w - 2, h - 2, 'ochre2', 'ochre4', 'ochre1', 2, 'earth3');
  // Engraved inner border.
  const ix = 4;
  for (let x = ix; x < w - ix; x++) {
    px(b, x, ix, 'earth3');
    px(b, x, h - ix - 1, 'ochre3');
  }
  for (let y = ix; y < h - ix; y++) {
    px(b, ix, y, 'earth3');
    px(b, w - ix - 1, y, 'ochre3');
  }
  roundCorners(b, 1, 1, w - 2, h - 2, 2);
  inkOutline(b, 'earth1');
  return b;
}

function drawLeather(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  slab(b, 1, 1, w - 2, h - 2, 'earth1', 'earth2', 'earth0', 2, 'ink');
  // Grain: sparse 2-px ticks on a regular lattice (period 8 × 6).
  for (let y = 6; y < h - 6; y += 6) for (let x = 6 + ((y / 6) % 2) * 4; x < w - 6; x += 8) {
    px(b, x, y, 'earth0');
    px(b, x + 1, y, 'earth2');
  }
  // Stitching inset 4 px (dash 2 / gap 2).
  for (let x = 5; x < w - 5; x++) {
    if ((x >> 1) % 2 === 0) {
      px(b, x, 4, 'stone2');
      px(b, x, h - 5, 'stone1');
    }
  }
  for (let y = 5; y < h - 5; y++) {
    if ((y >> 1) % 2 === 0) {
      px(b, 4, y, 'stone2');
      px(b, w - 5, y, 'stone1');
    }
  }
  roundCorners(b, 1, 1, w - 2, h - 2, 2);
  inkOutline(b);
  // Brass corner caps.
  stamp(b, RIVET, 1, 1);
  stamp(b, RIVET, w - 5, 1);
  stamp(b, RIVET, 1, h - 5);
  stamp(b, RIVET, w - 5, h - 5);
  return b;
}

function drawTooltip(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  rect(b, 1, 1, w - 2, h - 2, 'stone5');
  hline(b, 1, h - 2, w - 2, 'stone3');
  vline(b, w - 2, 1, h - 2, 'stone3');
  // Index-card red header rule + blue hairline.
  hline(b, 1, 3, w - 3, 'crim2');
  hline(b, 2, h - 4, w - 5, 'sky');
  inkOutline(b);
  return b;
}

function drawBubble(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  rect(b, 1, 1, w - 2, h - 3, 'white');
  hline(b, 3, h - 3, w - 6, 'stone4');
  vline(b, w - 2, 3, h - 7, 'stone4');
  roundCorners(b, 1, 1, w - 2, h - 3, 3);
  // Drop shadow 1 px under the bubble.
  inkOutline(b);
  for (let x = 3; x < w - 3; x++) if (!has(b, x, h - 1)) px(b, x, h - 1, 'stone1');
  return b;
}

function drawCard(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  rect(b, 1, 1, w - 2, h - 2, 'ochre1');
  slab(b, 1, 1, w - 3, h - 3, 'stone4', 'stone5', 'stone3', 1);
  hline(b, 2, h - 3, w - 4, 'stone3');
  inkOutline(b);
  return b;
}

function drawRecess(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  rect(b, 0, 0, w, h, 'navy0');
  hline(b, 0, 0, w, 'ink');
  hline(b, 0, 1, w, 'ink');
  vline(b, 0, 0, h, 'ink');
  hline(b, 1, h - 1, w - 1, 'navy1');
  vline(b, w - 1, 1, h - 1, 'navy1');
  return b;
}

function drawNewsprint(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  rect(b, 1, 1, w - 3, h - 3, 'stone4');
  slab(b, 1, 1, w - 3, h - 3, 'stone4', 'stone5', 'stone3', 1);
  // Yellowed edge band.
  for (let x = 2; x < w - 3; x++) {
    px(b, x, 2, 'stone5');
    px(b, x, h - 4, 'stone3');
  }
  // Drop shadow (offset 2) for the sheet lying on the desk.
  for (let y = 3; y < h; y++) {
    for (let x = 3; x < w; x++) if (!has(b, x, y) && (x >= w - 2 || y >= h - 2)) px(b, x, y, 'ink');
  }
  inkOutline(b, 'stone1');
  return b;
}

const DRAW: Record<PanelKind, (w: number, h: number) => PixelBuffer> = {
  manila: drawManila,
  paper: drawPaper,
  brass: drawBrass,
  leather: drawLeather,
  tooltip: drawTooltip,
  bubble: drawBubble,
  card: drawCard,
  recess: drawRecess,
  newsprint: drawNewsprint,
};

/** A panel of any size (≥ its 9-slice insets + 2). */
export function panel(kind: PanelKind, w: number, h: number): PixelBuffer {
  const ins = NINE_SLICE[kind];
  return DRAW[kind](Math.max(w, ins.left + ins.right + 2), Math.max(h, ins.top + ins.bottom + 2));
}

/* Decorations ---------------------------------------------------------------- */

/** Folder tab (sits on top of a manila panel's top edge, overlapping by 2 px). */
export function folderTab(w: number): PixelBuffer {
  const b = buf(w, 8);
  slab(b, 1, 1, w - 2, 8, 'stone4', 'stone5', 'stone3', 1);
  roundCorners(b, 1, 1, w - 2, 8, 2);
  for (let x = 0; x < w; x++) b.data.fill(0, (7 * w + x) * 4, (7 * w + x) * 4 + 4);
  inkOutline(b);
  for (let x = 2; x < w - 2; x++) b.data.fill(0, (7 * w + x) * 4, (7 * w + x) * 4 + 4);
  return b;
}

export const PAPERCLIP = grid(`
  ..oooo..
  .oZzzZo.
  oZo..oZo
  oz.oo.zo
  oz.oZ.zo
  oz.oZ.zo
  oz.oZ.zo
  oz.oz.zo
  oz.oz.zo
  oZo.oZzo
  .oZo.oo.
  ..oo....
`, { o: 'ink', Z: 'zinc4', z: 'zinc2' });

/** Speech-bubble tail pointing left (attach at the bubble's left edge, y ≈ 6). */
export const BUBBLE_TAIL_LEFT = grid(`
  .......o
  .....ooW
  ...ooWWW
  .ooWWWWW
  oWWWWWWW
  .oossWWW
  ...ooosW
  ......oo
`, { o: 'ink', W: 'white', s: 'stone4' });

export const BUBBLE_TAIL_DOWN = grid(`
  oWWWWWWo
  .oWWWWso
  .oWWWso.
  ..oWso..
  ..oWo...
  ...oo...
  ...o....
`, { o: 'ink', W: 'white', s: 'stone4' });

export function registerPanels(reg: SpriteRegistry): void {
  for (const kind of Object.keys(DRAW) as PanelKind[]) {
    const [w, h] = SOURCE_SIZE[kind];
    reg.add(`ui.panel.${kind}`, { group: 'ui', frames: panel(kind, w, h), anchor: { x: 0, y: 0 }, tags: ['nineslice'] });
  }
  reg.add('ui.panel.tab', { group: 'ui', frames: folderTab(24), anchor: { x: 0, y: 7 } });
  reg.add('ui.panel.clip', { group: 'ui', frames: PAPERCLIP, anchor: { x: 0, y: 0 } });
  reg.add('ui.panel.bubble.tail.left', { group: 'ui', frames: BUBBLE_TAIL_LEFT, anchor: { x: 7, y: 4 } });
  reg.add('ui.panel.bubble.tail.down', { group: 'ui', frames: BUBBLE_TAIL_DOWN, anchor: { x: 3, y: 0 } });
}
