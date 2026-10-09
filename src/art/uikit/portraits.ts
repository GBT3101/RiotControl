/**
 * Advisor portraits: The Minister of the Interior (48×48 bust, facing right — put the speech
 * bubble on his right) with idle / talk / blink / sweat / smug / panic animations, the
 * "Breta sighted!" alert portrait and the portrait frame helper.
 */
import { grid, type KeyMap } from '../lib/grid';
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, col, copy, px, rect, stamp } from '../fx/draw';
import { MINISTER_BASE } from './minister.grid';
import { panel } from './panels';

export const MINISTER_KEYS: KeyMap = {
  o: 'ink',
  K: 'ink',
  H: 'gray1',
  J: 'gray3',
  j: 'zinc2',
  L: 'earth6',
  l: 'earth7',
  S: 'earth5',
  s: 'earth4',
  d: 'earth3',
  r: 'rust4',
  W: 'white',
  P: 'ink',
  F: 'ochre2',
  f: 'ochre1',
  G: 'navy0',
  g: 'zinc1',
  Q: 'sky',
  N: 'navy1',
  n: 'navy0',
  b: 'navy2',
  C: 'stone5',
  c: 'stone3',
  X: 'crim1',
  x: 'crim2',
  z: 'rust0',
  Y: 'blue1',
  I: 'white',
  i: 'stone3',
  p: 'earth3',
  e: 'crim2',
  B: 'blue2',
};

/** Paint overlay rows (keys as MINISTER_KEYS; '.' = keep) at (x, y). */
function over(b: PixelBuffer, x: number, y: number, rows: readonly string[]): void {
  rows.forEach((r, j) => {
    [...r].forEach((k, i) => {
      if (k === '.') return;
      const ref = MINISTER_KEYS[k];
      if (typeof ref === 'string') px(b, x + i, y + j, ref);
    });
  });
}

/** Face colour at a column (to erase features): lit left, shaded right. */
function skinAt(x: number): string {
  return x < 26 ? 'L' : x < 28 ? 's' : 'S';
}

function clearMouth(b: PixelBuffer): void {
  for (let y = 29; y <= 32; y++) {
    const row = [...Array(13)].map((_, i) => skinAt(16 + i)).join('');
    over(b, 16, y, [row]);
  }
}

const MOUTHS: Record<string, { y: number; x: number; rows: string[] }> = {
  smirk: { x: 17, y: 29, rows: ['........oo', 'doooooooo.', '..ddddd...'] },
  open1: { x: 17, y: 29, rows: ['........oo', '.oooooooo.', '..ozzzzo..', '...oooo...'] },
  open2: {
    x: 17,
    y: 29,
    rows: ['..........', 'oooooooooo', 'oWWWWWWWWo', '.ozzzzzzo.', '..oooooo..'],
  },
  oh: {
    x: 17,
    y: 29,
    rows: ['..........', '...oooo...', '..ozzzzo..', '..ozxxzo..', '...oooo...'],
  },
  grin: { x: 16, y: 29, rows: ['.o.........o', '..ooooooooo.', '..oWWWWWWWo.', '...ooooooo..'] },
  panic: {
    x: 17,
    y: 29,
    rows: ['..........', '.oooooooo.', '.ozzzzzzo.', '.oWoWoWoWo', '..oooooo..'],
  },
};

function withMouth(b: PixelBuffer, m: keyof typeof MOUTHS): PixelBuffer {
  const out = copy(b);
  clearMouth(out);
  const d = MOUTHS[m]!;
  over(out, d.x, d.y, d.rows);
  return out;
}

const EYES = {
  closed: ['LLLLLL', 'oooooo'],
  happy: ['LooooL', 'oLLLLo'],
  wide: ['WWWWWW', 'WWPWWW'],
};

function withEyes(b: PixelBuffer, e: keyof typeof EYES): PixelBuffer {
  const out = copy(b);
  over(out, 12, 16, EYES[e]);
  over(
    out,
    24,
    16,
    EYES[e].map((r) => r.slice(0, 5) + (e === 'closed' || e === 'happy' ? r[5] : 'o')),
  );
  return out;
}

/** Brows raised high (panic): erase the normal brows, draw arched ones 2 px higher. */
function panicBrows(b: PixelBuffer): PixelBuffer {
  const out = copy(b);
  over(out, 11, 14, ['LLLLLLLL']);
  over(out, 11, 15, ['LLLLLLLL']);
  over(out, 23, 15, ['LLLLLLLS']);
  over(out, 23, 14, ['LLLLLLLS']);
  over(out, 12, 12, ['.oooo.', 'o....o']);
  over(out, 24, 12, ['.oooo.', 'o....o']);
  over(out, 12, 15, ['oooooo']);
  over(out, 24, 15, ['oooooo']);
  return out;
}

/** Glint sweep on the lenses (frame k = 0..2). */
function glint(b: PixelBuffer, k: number): PixelBuffer {
  const out = copy(b);
  for (const lx of [11, 24]) {
    const x = lx + 2 + k * 2;
    px(out, x, 20, 'white');
    px(out, x + 1, 19, 'sky');
    px(out, x - 1, 21, 'sky');
  }
  return out;
}

const DROP = ['.Q.', 'QWQ', 'QQB', '.B.'];

function sweatDrop(b: PixelBuffer, x: number, y: number): PixelBuffer {
  const out = copy(b);
  over(out, x, y, DROP);
  return out;
}

function shift(b: PixelBuffer, dx: number): PixelBuffer {
  const out = buf(b.w, b.h);
  stamp(out, b, dx, 0);
  return out;
}

export function ministerBase(): PixelBuffer {
  return grid(MINISTER_BASE, MINISTER_KEYS, {}, 'minister');
}

export interface MinisterAnims {
  idle: PixelBuffer[];
  talk: PixelBuffer[];
  blink: PixelBuffer[];
  sweat: PixelBuffer[];
  smug: PixelBuffer[];
  panic: PixelBuffer[];
  /** Individual mouth shapes (smirk, open1, open2, oh) for lip-flap driven by text. */
  mouths: PixelBuffer[];
}

export function ministerAnims(): MinisterAnims {
  const base = ministerBase();
  const closed = withEyes(base, 'closed');
  const idle = [
    base,
    base,
    base,
    base,
    glint(base, 0),
    glint(base, 1),
    glint(base, 2),
    base,
    base,
    closed,
    base,
    base,
  ];
  const mouths = (['smirk', 'open1', 'open2', 'oh'] as const).map((m) => withMouth(base, m));
  const talk = [mouths[1]!, mouths[2]!, mouths[1]!, mouths[0]!, mouths[3]!, mouths[1]!];
  const sweat = [
    sweatDrop(base, 31, 11),
    sweatDrop(base, 31, 13),
    sweatDrop(base, 32, 15),
    sweatDrop(base, 32, 18),
  ];
  const smugBase = withEyes(withMouth(base, 'grin'), 'happy');
  const smug = [smugBase, glint(smugBase, 1)];
  const panicFace = withMouth(panicBrows(withEyes(base, 'wide')), 'panic');
  const panic = [0, 1, 2, 3].map((f) => {
    let p = sweatDrop(panicFace, f % 2 ? 6 : 33, 10 + f);
    p = sweatDrop(p, f % 2 ? 33 : 7, 13 - f);
    return shift(p, [0, 1, 0, -1][f]!);
  });
  return { idle, talk, blink: [base, closed, base], sweat, smug, panic, mouths };
}

/* Breta (alert) ------------------------------------------------------------------ */

export const BRETA = `
.......oooooo.......
.....ooYYYYYYoo.....
....oYYYYYYYYYYo....
...oYYyyyyyyyyYYo...
..oYYyoooooooooyYo..
..oYyoHHHHoHHHHoyYo.
.oYYoHHHHHHHHHHHoYo.
.oYyoHoLLLLLLLoHoyYo
.oYyoHLooLLLooLHoyYo
.oYyoLLLoLLLoLLLoyYo
.oYyoLLWPLLLPWLLoyYo
.oYyohLLLLLLLLLLhoyo
.oYYohLLrLLLLrLLhoYo
..oYohhLLoooLLLhhoo.
..oYoHhLoLLLoLLhHo..
..oYoHHoLLLLLLoHHo..
.oYYYoHhooooooHhoYo.
oYYYYYoHhoYYoHhoYYYo
oYYyYYYohoYYohoYYyYo
oYyyyYYYooYYooYYyyYo
`;

const BRETA_KEYS: KeyMap = {
  o: 'ink',
  Y: 'ochre3',
  y: 'ochre2',
  H: 'earth2',
  h: 'earth1',
  L: 'earth7',
  W: 'white',
  P: 'ink',
  r: 'pink3',
};

export function bretaPortrait(): PixelBuffer {
  return grid(BRETA, BRETA_KEYS, {}, 'breta');
}

/** Portrait in an alert frame: flashing red/yellow border, "!" tab (2 frames). */
function bretaAlert(): PixelBuffer[] {
  const face = bretaPortrait();
  return [0, 1].map((f) => {
    const b = buf(26, 26);
    rect(b, 0, 0, 26, 26, 'ink');
    rect(b, 1, 1, 24, 24, f ? 'hivis2' : 'crim2');
    rect(b, 2, 2, 22, 22, 'ink');
    rect(b, 3, 3, 20, 20, 'navy1');
    stamp(b, face, 3, 3);
    // "!" tab top-right.
    rect(b, 19, 0, 7, 9, 'ink');
    rect(b, 20, 1, 5, 7, f ? 'crim2' : 'hivis2');
    px(b, 22, 2, 'ink');
    px(b, 22, 3, 'ink');
    px(b, 22, 4, 'ink');
    px(b, 22, 6, 'ink');
    return b;
  });
}

/** Advisor portrait box (brass-framed recess) with the given portrait frame inside. */
export function portraitBox(face: PixelBuffer): PixelBuffer {
  const b = panel('brass', face.w + 10, face.h + 10);
  rect(b, 4, 4, face.w + 2, face.h + 2, 'navy1');
  for (let y = 5; y < face.h + 5; y += 4)
    for (let x = 5; x < face.w + 5; x++) if ((x + y) % 8 === 0) px(b, x, y, 'navy2');
  stamp(b, face, 5, 5);
  void col;
  return b;
}

export function registerPortraits(reg: SpriteRegistry): void {
  const a = ministerAnims();
  const anchor = { x: 24, y: 47 };
  const g = 'portraits-ui';
  reg.add('ui.portrait.minister.idle', { group: g, frames: a.idle, fps: 6, anchor });
  reg.add('ui.portrait.minister.talk', { group: g, frames: a.talk, fps: 10, anchor });
  reg.add('ui.portrait.minister.mouths', {
    group: g,
    frames: a.mouths,
    fps: 0,
    anchor,
    tags: ['states'],
  });
  reg.add('ui.portrait.minister.blink', {
    group: g,
    frames: a.blink,
    fps: 10,
    loop: false,
    anchor,
  });
  reg.add('ui.portrait.minister.sweat', { group: g, frames: a.sweat, fps: 6, anchor });
  reg.add('ui.portrait.minister.smug', { group: g, frames: a.smug, fps: 3, anchor });
  reg.add('ui.portrait.minister.panic', { group: g, frames: a.panic, fps: 12, anchor });
  reg.add('ui.portrait.minister.boxed', {
    group: g,
    frames: a.idle.map(portraitBox),
    fps: 6,
    anchor: { x: 0, y: 0 },
  });
  reg.add('ui.portrait.breta', { group: g, frames: bretaPortrait(), anchor: { x: 10, y: 19 } });
  reg.add('ui.portrait.breta.alert', {
    group: g,
    frames: bretaAlert(),
    fps: 4,
    anchor: { x: 0, y: 0 },
  });
}
