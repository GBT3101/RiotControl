/**
 * Tutorial pointer art (hand-authored grids, RIOT-64, sun from the upper-left, ink outlines):
 * a hi-vis pointer arrow (down; flipped for "up"), hi-vis corner brackets for the highlight
 * frame (4 rotations), a white-gloved hand for the pan/drag gesture and a tiny double arrow
 * under it. All pure PixelBuffers — the runtime wraps them with `uiTex`.
 */
import { grid, type KeyMap } from '../../art/lib/grid';
import { createBuffer, mirrorX, type PixelBuffer } from '../../art/lib/pixels';

const KEYS: KeyMap = {
  o: 'ink',
  W: 'white',
  Y: 'hivis2',
  y: 'hivis1',
  d: 'olive2',
  s: 'gray7',
  S: 'gray5',
  c: 'crim2',
  C: 'crim1',
};

/** Down-pointing arrow (13×12): light on the left, shade on the right. */
const ARROW = `
....ooooo....
....oWYyo....
....oWYyo....
....oYYyo....
oooooYYyooooo
oWWYYYYYYYyyo
.oWYYYYYYyyo.
..oYYYYYyyo..
...oYYYyyo...
....oYyyo....
.....oyo.....
......o......
`;

/** Up-pointing arrow (13×12), lit from the upper-left. */
const ARROW_UP = `
......o......
.....oWo.....
....oWYyo....
...oWYYYyo...
..oWYYYYYyo..
.oWYYYYYYYyo.
oWWYYYYYYYyyo
oooooYYyooooo
....oWYyo....
....oWYyo....
....oYYyo....
....ooooo....
`;

/** Top-left frame corner (8×8), 2 px thick. */
const CORNER = `
ooooooo.
oYYYYYYo
oYyyyyyo
oYyooooo
oYyo....
oYyo....
oYyo....
oooo....
`;

/** White glove, index finger up (13×15). */
const HAND = `
....oo.......
...oWWo......
...oWso......
...oWso......
...oWsooo....
...oWsoWsooo.
.oooWsoWsoWso
oWWoWWsWWsWso
oWWWWWWWWWWso
.oWWWWWWWWsso
..oWWWWWWWso.
..oWWWWWWsso.
...oWWWWsso..
...occcCCCo..
...ooooooo...
`;

/** Little left-right drag arrow (15×7). */
const DRAG = `
..o.........o..
.oYo.......oYo.
oYYooooooooyYyo
oYYYYYYYYYYYYyo
.oyoooooooooyo.
..o.........o..
...............
`;

let cache: Record<string, PixelBuffer> | null = null;

function flipY(src: PixelBuffer): PixelBuffer {
  const out = createBuffer(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    out.data.set(
      src.data.subarray(y * src.w * 4, (y + 1) * src.w * 4),
      (src.h - 1 - y) * src.w * 4,
    );
  return out;
}

export interface PointerArt {
  arrowDown: PixelBuffer;
  arrowUp: PixelBuffer;
  /** tl, tr, bl, br */
  corners: [PixelBuffer, PixelBuffer, PixelBuffer, PixelBuffer];
  hand: PixelBuffer;
  drag: PixelBuffer;
}

export function pointerArt(): PointerArt {
  if (!cache) {
    const arrowDown = grid(ARROW, KEYS, {}, 'tut.arrow');
    const tl = grid(CORNER, KEYS, {}, 'tut.corner');
    cache = {
      arrowDown,
      arrowUp: grid(ARROW_UP, KEYS, {}, 'tut.arrowUp'),
      tl,
      tr: mirrorX(tl),
      bl: flipY(tl),
      br: flipY(mirrorX(tl)),
      hand: grid(HAND, KEYS, {}, 'tut.hand'),
      drag: grid(DRAG, KEYS, {}, 'tut.drag'),
    };
  }
  const c = cache;
  return {
    arrowDown: c.arrowDown!,
    arrowUp: c.arrowUp!,
    corners: [c.tl!, c.tr!, c.bl!, c.br!],
    hand: c.hand!,
    drag: c.drag!,
  };
}
