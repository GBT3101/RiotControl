/**
 * Crowd-surge shove (playtest round): the impact when a mob rams a lone officer over.
 *
 * `fx.ram.shove` — 5 frames @14 fps, anchor = the officer's ground point. A cartoon "pow" burst
 * at chest height where the crowd hits him, three speed streaks surging through him, and a
 * kick of street dust rolling out behind. Drawn for an officer facing screen-right (SE / NE),
 * who is knocked back toward screen-left; flip it for SW / NW.
 */
import type { PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';
import { buf, line, paintLobes, px, type Lobe } from './draw';

const W = 34;
const H = 24;
/** Ground point (the officer's feet). */
const AX = 15;
const AY = 21;
const DUST = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'];

/**
 * Cartoon "pow" bursts, hand-drawn: W white core, C cream, Y ochre, R rust rim (light from
 * the upper left, so the rim sits heavier on the lower right). Frame 0 = the hit, 1 = it pops.
 */
// prettier-ignore
const POW = [
  [
    '....R.....',
    '..R.YR..R.',
    '...RCYRYR.',
    '.RRYWWCYR.',
    'RYCWWWWCYR',
    '.RYCWWWYR.',
    '..RYCWCRR.',
    '.R.RYCR.R.',
    '....RR....',
  ],
  [
    '...Y.Y...',
    '.Y.C.C.Y.',
    '..C...C..',
    'YC.....CY',
    '..C...C..',
    '.Y.C.C.Y.',
    '...Y.Y...',
  ],
];
const POW_KEYS: Readonly<Record<string, string>> = {
  W: 'white',
  C: 'stone5',
  Y: 'ochre4',
  R: 'rust3',
};

function pow(b: PixelBuffer, cx: number, cy: number, f: number): void {
  const rows = POW[f]!;
  const ox = cx - (rows[0]!.length >> 1);
  const oy = cy - (rows.length >> 1);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ref = POW_KEYS[row[x]!];
      if (ref) px(b, ox + x, oy + y, ref);
    }
  });
}

/** A speed streak from x0 (leading, bright) to x1 (trailing, dim). */
function streak(b: PixelBuffer, y: number, x0: number, x1: number, dim: boolean): void {
  line(b, x0, y, x1, y, (t) =>
    t < 0.25 ? (dim ? 'stone4' : 'white') : t < 0.6 ? 'stone5' : 'stone3',
  );
}

function shoveFrames(): PixelBuffer[] {
  // Streaks: row, length, stagger (the middle one leads).
  const lines = [
    { y: 8, len: 7, lag: 2 },
    { y: 12, len: 9, lag: 0 },
    { y: 16, len: 6, lag: 3 },
  ];
  const lead = [26, 18, 10, 4, -99];
  const dust: Lobe[][] = [
    [],
    [
      { x: AX - 1, y: AY - 1.5, r: 1.6 },
      { x: AX + 3, y: AY - 1, r: 1.3 },
    ],
    [
      { x: AX - 5, y: AY - 2, r: 2.4 },
      { x: AX - 1, y: AY - 2.5, r: 2.2 },
      { x: AX + 3, y: AY - 1.5, r: 1.5 },
    ],
    [
      { x: AX - 9, y: AY - 2.5, r: 2.2 },
      { x: AX - 4.5, y: AY - 3, r: 2.4 },
      { x: AX + 1, y: AY - 2, r: 1.4 },
    ],
    [
      { x: AX - 11, y: AY - 3, r: 1.5 },
      { x: AX - 6, y: AY - 3.5, r: 1.7 },
    ],
  ];
  return lead.map((x, f) => {
    const b = buf(W, H);
    if (dust[f]!.length) paintLobes(b, dust[f]!, { ramp: DUST, outlineLit: 'stone2' });
    if (x > -99) {
      for (const l of lines) {
        const x0 = x + l.lag;
        const len = f >= 3 ? Math.ceil(l.len / 2) : l.len;
        streak(b, l.y, x0, Math.min(W - 1, x0 + len), f >= 3);
      }
    }
    if (f < 2) pow(b, AX + 7 - f, 10, f);
    return b;
  });
}

export function registerRam(reg: SpriteRegistry): void {
  reg.add('fx.ram.shove', {
    group: 'fx',
    frames: shoveFrames(),
    fps: 14,
    loop: false,
    anchor: { x: AX, y: AY },
  });
}
