/**
 * Blockade — modular concrete jersey barrier painted in Ministry colours (hi-vis / navy
 * chevron band + a navy "POLICE" stencil), one segment per tile, spanning up to three tiles.
 *
 * Sprites (canvas 32×32, anchor (16,14) = the tile's top vertex, so place the sprite exactly like
 * a tile; the barrier runs through the tile centre (anchor + (0,8)) from edge-midpoint to
 * edge-midpoint, so neighbouring segments join seamlessly):
 *
 *   unit.blockade.<piece>.<axis>   piece: single | end0 | mid | end1     axis: i | j
 *       3 frames = damage states [pristine, dented, wrecked] (fps 0 — pick the frame by HP)
 *       end0 = the low-index end (i-axis: upper-left, j-axis: upper-right), end1 = high end.
 *       A run of n tiles: n=1 single; n=2 end0+end1; n=3 end0+mid+end1.
 *   unit.blockade.deploy.<axis>    5 frames @12: dropped in from above, thud + dust (impact 2)
 *   unit.blockade.burst.<axis>     7 frames @12: destruction (white flash, chunks, dust, rubble)
 *
 * The i-axis art is painted in "face coordinates" (u along the barrier, v down its face); the
 * j-axis versions are the mirror image re-shaded (its long face is the dark right face).
 */
import { resolveColor, type RGBA } from '../palette';
import { blit, createBuffer, mirrorX, outline, setPixel, type PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';
import { whiteFlash } from './kit';

export type BlockadePiece = 'single' | 'end0' | 'mid' | 'end1';
export type BlockadeAxis = 'i' | 'j';
export const BLOCKADE_PIECES: readonly BlockadePiece[] = ['single', 'end0', 'mid', 'end1'];
export const BLOCKADE_STATES = ['pristine', 'dented', 'wrecked'] as const;

const W = 32;
const H = 32;
const ANCHOR = { x: 16, y: 14 };
/** Face height (rows) and length (columns) of one segment. */
const FH = 8;
const FL = 16;
/** Screen position of face (u, v) for the i-axis: front face starts at (6, 12). */
const fx = (u: number): number => 6 + u;
const fy = (u: number, v: number): number => 12 + Math.floor(u / 2) + v;

interface Shade {
  face: RGBA[]; // top → bottom of the long face: highlight, main, main, shade…
  top: RGBA;
  topEdge: RGBA;
  end: RGBA;
  endShade: RGBA;
}

const C = (n: string): RGBA => resolveColor(n);
const SHADE: Record<BlockadeAxis, Shade> = {
  // i-axis: the long face faces SW → "left face" (mid tone); its end cap faces SE (dark).
  i: {
    face: [C('gray7'), C('gray6'), C('gray6'), C('gray6'), C('gray6'), C('gray5'), C('gray5'), C('gray4')],
    top: C('white'),
    topEdge: C('gray7'),
    end: C('gray4'),
    endShade: C('gray3'),
  },
  // j-axis (painted as i then mirrored): the long face faces SE → darkest; end cap mid.
  j: {
    face: [C('gray6'), C('gray5'), C('gray5'), C('gray5'), C('gray5'), C('gray4'), C('gray4'), C('gray3')],
    top: C('gray7'),
    topEdge: C('gray6'),
    end: C('gray6'),
    endShade: C('gray5'),
  },
};

const HIVIS = C('hivis2');
const HIVIS_D = C('hivis1');
const NAVY = C('navy1');
const NAVY_L = C('navy2');
const CRACK = C('gray3');
const CRACK_D = C('gray2');
const REBAR = C('rust1');
const REBAR_L = C('rust2');
const TAG = C('pink2');
const TAG_D = C('pink1');
const SHADOW = resolveColor('ink', 115);

/** "POLICE" stencil — stubby navy letter marks (same shorthand as the vests), face rows 4-5. */
const STENCIL_U = [2, 4, 6, 8, 10, 12];

/** Notches knocked out of the top edge: [u, depth] (wrecked has deeper bites). */
const CHIPS = {
  dented: [
    [4, 1],
    [5, 1],
    [11, 1],
  ],
  wrecked: [
    [3, 1],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 2],
    [8, 1],
    [12, 1],
    [13, 2],
  ],
} as const;

/** Cracks as face-coordinate pixel lists. */
const CRACKS = {
  dented: [
    [9, 1],
    [9, 2],
    [10, 3],
    [10, 4],
    [11, 5],
    [2, 5],
    [3, 6],
  ],
  wrecked: [
    [9, 1],
    [9, 2],
    [10, 3],
    [10, 4],
    [11, 5],
    [11, 6],
    [2, 4],
    [3, 5],
    [3, 6],
    [14, 2],
    [13, 3],
    [14, 4],
  ],
} as const;

function paintSegment(piece: BlockadePiece, state: number, axis: BlockadeAxis): PixelBuffer {
  const s = SHADE[axis];
  const buf = createBuffer(W, H);
  const capLo = piece === 'single' || piece === 'end0';
  const capHi = piece === 'single' || piece === 'end1';
  // Continuing ends are painted 4 px past the tile and clipped after the outline, so a run of
  // segments joins without seams (neighbours paint identical pixels).
  const u0 = capLo ? 1 : -4;
  const u1 = capHi ? FL - 2 : FL + 4; // exclusive
  const chips = new Map<number, number>();
  if (state >= 1) for (const [u, d] of CHIPS[state === 1 ? 'dented' : 'wrecked']) chips.set(u, d);
  const depth = (u: number): number => chips.get(((u % FL) + FL) % FL) ?? 0;

  // Ground contact shadow (one row below the face, plus a lip to the lower-left).
  for (let u = u0 - 1; u < u1 + 2; u++) {
    setPixel(buf, fx(u), fy(u, FH + 1), SHADOW);
    setPixel(buf, fx(u) - 1, fy(u, FH + 1), SHADOW);
    setPixel(buf, fx(u) - 2, fy(u, FH + 1), SHADOW);
  }

  // Top face: two rows above the front face, shifted +2 columns (the back edge).
  for (let u = u0; u < u1 + 2; u++) {
    const d = depth(u - 2) || depth(u);
    if (capLo && u < u0 + 1) continue;
    const yTop = fy(u, 0) - 1;
    if (u >= u0 + 2 || !capLo) setPixel(buf, fx(u), yTop - 1 + d, d ? s.topEdge : s.top);
    if (u < u1 + 1) setPixel(buf, fx(u), yTop + d, d ? s.face[1]! : s.topEdge);
  }

  // Long face.
  for (let u = u0; u < u1; u++) {
    for (let v = depth(u); v < FH; v++) {
      let c = s.face[v]!;
      // Chevron band: rows 1-2, alternating hi-vis / navy every 3 columns, slanted.
      if (v === 1 || v === 2) {
        const k = Math.floor((u + (v === 2 ? 1 : 0)) / 3) % 2;
        c = k === 0 ? (v === 1 ? HIVIS : HIVIS_D) : v === 1 ? NAVY_L : NAVY;
      }
      if (state === 2 && (v === 1 || v === 2) && u >= 1 && u <= 8) c = s.face[v + 2]!; // band scraped off
      setPixel(buf, fx(u), fy(u, v), c);
    }
  }

  // Jersey base flare: a darker lip one row lower, stepping out toward the viewer.
  for (let u = u0; u < u1; u++) {
    setPixel(buf, fx(u), fy(u, FH), s.face[7]!);
    setPixel(buf, fx(u) - 1, fy(u, FH), s.face[6]!);
  }

  // End caps. Low end: rounded top corner. High end: visible end face (2 columns, darker).
  if (capHi) {
    for (let k = 0; k < 2; k++) {
      const u = u1 + k;
      for (let v = 0; v < FH; v++) {
        const y = fy(u1 - 1, v) - (k === 0 ? 0 : 0) + (k === 1 ? 0 : 0);
        setPixel(buf, fx(u), y + (k === 1 ? -1 : 0) + (v === 0 && k === 1 ? 1 : 0), v < 2 ? s.end : s.endShade);
      }
    }
  }

  // Stencil marks.
  STENCIL_U.forEach((u, i) => {
    if (u < u0 || u >= u1 || (state === 2 && i % 2 === 0)) return;
    setPixel(buf, fx(u), fy(u, 4), NAVY);
    setPixel(buf, fx(u), fy(u, 5), i === 3 ? s.face[5]! : NAVY);
  });

  // Damage: cracks, dents, rebar, graffiti, rubble.
  if (state >= 1) {
    for (const [u, v] of CRACKS[state === 1 ? 'dented' : 'wrecked']) {
      if (u >= u0 && u < u1 && v >= depth(u)) setPixel(buf, fx(u), fy(u, v), v > 3 ? CRACK_D : CRACK);
    }
    // A dent: shaded scoop with a lit lower lip.
    const du = 12;
    if (du < u1) {
      setPixel(buf, fx(du), fy(du, 4), s.face[7]!);
      setPixel(buf, fx(du + 1), fy(du + 1, 4), s.face[7]!);
      setPixel(buf, fx(du), fy(du, 5), s.face[0]!);
    }
  }
  if (state === 2) {
    // Exposed rebar poking out of the big bite.
    const rb: Array<[number, number, RGBA]> = [
      [5, 2, REBAR],
      [5, 1, REBAR_L],
      [6, 0, REBAR_L],
      [7, -1, REBAR],
    ];
    for (const [u, v, c] of rb) if (u >= u0 && u < u1) setPixel(buf, fx(u), fy(u, v), c);
    // Protest graffiti: a pink anarchy-ish scrawl (the crowd left its mark).
    const tag: Array<[number, number, RGBA]> = [
      [10, 2, TAG],
      [11, 1, TAG],
      [12, 2, TAG],
      [11, 3, TAG_D],
      [13, 3, TAG],
    ];
    for (const [u, v, c] of tag) if (u >= u0 && u < u1) setPixel(buf, fx(u), fy(u, v), c);
  }

  outline(buf, C('ink'));
  // Clip continuing ends back to this tile's columns [fx(0), fx(FL)).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((!capLo && x < fx(0)) || (!capHi && x >= fx(FL))) setPixel(buf, x, y, 0);
    }
  }
  // Rubble at the foot of a wreck (drawn after the outline: small chunks with their own edge).
  if (state === 2) {
    for (const [u, dy] of [
      [2, 1],
      [8, 2],
      [13, 1],
    ] as const) {
      if (u < u0 || u >= u1) continue;
      const x = fx(u) - 2;
      const y = fy(u, FH) + dy;
      setPixel(buf, x, y, s.face[1]!);
      setPixel(buf, x + 1, y, s.face[5]!);
      setPixel(buf, x, y + 1, C('ink'));
      setPixel(buf, x + 1, y + 1, C('ink'));
    }
  }
  return axis === 'j' ? mirrorX(buf) : buf;
}

/** Concrete chunk (3×3) for the burst. */
function chunk(c: RGBA, d: RGBA): PixelBuffer {
  const b = createBuffer(3, 3);
  setPixel(b, 0, 0, c);
  setPixel(b, 1, 0, c);
  setPixel(b, 0, 1, c);
  setPixel(b, 1, 1, d);
  setPixel(b, 2, 1, d);
  setPixel(b, 1, 2, d);
  return b;
}

function dust(r: number, light: boolean): PixelBuffer {
  const b = createBuffer(r * 2 + 1, r * 2 + 1);
  const c = C(light ? 'gray7' : 'gray6');
  const e = C(light ? 'gray6' : 'gray5');
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y * 1.6;
      if (d <= r * r) setPixel(b, x + r, y + r, d > (r - 1) * (r - 1) ? e : c);
    }
  }
  return b;
}

function burstFrames(axis: BlockadeAxis): PixelBuffer[] {
  const wreck = paintSegment('single', 2, axis);
  const s = SHADE[axis];
  const ch = [chunk(s.face[0]!, s.face[5]!), chunk(s.top, s.face[3]!), chunk(HIVIS, NAVY)];
  const frames: PixelBuffer[] = [whiteFlash(wreck)];
  // Chunk trajectories (dx, dy per frame), mirrored for j by the final mirror pass.
  const paths: Array<Array<[number, number]>> = [
    [
      [8, 12],
      [5, 6],
      [3, 4],
      [2, 8],
      [2, 15],
      [2, 19],
    ],
    [
      [16, 14],
      [17, 6],
      [19, 2],
      [21, 3],
      [22, 9],
      [23, 18],
    ],
    [
      [12, 13],
      [11, 5],
      [10, 0],
      [9, 1],
      [9, 7],
      [10, 17],
    ],
  ];
  for (let f = 1; f <= 6; f++) {
    const b = createBuffer(W, H);
    const k = f - 1;
    // Low rubble remains; it grows as chunks land.
    const base = paintSegment('single', 2, 'i');
    const rubble = createBuffer(W, H);
    // Only the bottom 3 rows of the wreck stay as the stump.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (base.data[i + 3] === 0) continue;
        const yFace = y - (12 + Math.floor((x - 6) / 2));
        if (yFace >= 5) {
          for (let c = 0; c < 4; c++) rubble.data[i + c] = base.data[i + c]!;
        }
      }
    }
    blit(b, rubble, 0, 0);
    // Dust puffs swelling then thinning.
    const r = [3, 4, 5, 4, 3, 2][k]!;
    if (k < 5) {
      blit(b, dust(r, k < 2), 6 - r, 18 - r);
      blit(b, dust(r, k < 2), 20 - r, 24 - r);
      if (k < 4) blit(b, dust(Math.max(1, r - 1), true), 13 - r, 14 - r);
    }
    paths.forEach((p, i) => {
      const [x, y] = p[k]!;
      if (k < 5) blit(b, outline(cloneOf(ch[i]!), C('ink')), x, y);
    });
    frames.push(axis === 'j' ? mirrorX(b) : b);
  }
  return frames;
}

function cloneOf(src: PixelBuffer): PixelBuffer {
  const b = createBuffer(src.w + 2, src.h + 2);
  blit(b, src, 1, 1);
  return b;
}

function deployFrames(axis: BlockadeAxis): PixelBuffer[] {
  const seg = paintSegment('single', 0, axis);
  // Strip the ground shadow from the falling copies (shadow stays on the ground).
  const noShadow = createBuffer(W, H);
  for (let i = 0; i < seg.data.length; i += 4) {
    if (seg.data[i + 3] !== 255) continue;
    for (let c = 0; c < 4; c++) noShadow.data[i + c] = seg.data[i + c]!;
  }
  const shadowOnly = createBuffer(W, H);
  for (let i = 0; i < seg.data.length; i += 4) {
    if (seg.data[i + 3] === 0 || seg.data[i + 3] === 255) continue;
    for (let c = 0; c < 4; c++) shadowOnly.data[i + c] = seg.data[i + c]!;
  }
  const frame = (dy: number, puff: number): PixelBuffer => {
    const b = createBuffer(W, H);
    blit(b, noShadow, 0, dy);
    if (puff > 0) {
      const d = dust(puff, true);
      const l = axis === 'i' ? [5, 21] : [26, 10];
      const r = axis === 'i' ? [23, 27] : [8, 27];
      blit(b, d, l[0]! - puff, l[1]! - puff);
      blit(b, d, r[0]! - puff, r[1]! - puff);
    }
    const out = createBuffer(W, H);
    blit(out, shadowOnly, 0, 0);
    blit(out, b, 0, 0);
    return out;
  };
  return [frame(-12, 0), frame(-5, 0), frame(1, 2), frame(0, 3), frame(0, 0)];
}

/** Card / codex icon: a pristine barrier with a traffic cone, 32×32. */
function portrait(): PixelBuffer {
  const out = createBuffer(32, 32);
  blit(out, paintSegment('single', 0, 'i'), 0, 4);
  const cone = createBuffer(7, 10);
  const o = C('rust3');
  const d = C('rust1');
  const w = C('white');
  const rows = ['...o...', '..ooo..', '..www..', '..oOo..', '.wwwww.', '.ooood.', 'ooooodd'];
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      setPixel(cone, x, y + 2, ch === 'w' ? w : ch === 'd' ? d : ch === 'O' ? C('rust4') : o);
    }),
  );
  outline(cone, C('ink'));
  blit(out, cone, 22, 20);
  return out;
}

export function registerBlockade(reg: SpriteRegistry): void {
  reg.add('unit.blockade.portrait', { group: 'portraits', frames: [portrait()], fps: 0, hasShadow: true });
  for (const axis of ['i', 'j'] as const) {
    for (const piece of BLOCKADE_PIECES) {
      reg.add(`unit.blockade.${piece}.${axis}`, {
        group: 'units',
        frames: [0, 1, 2].map((st) => paintSegment(piece, st, axis)),
        fps: 0,
        loop: false,
        anchor: ANCHOR,
        hasShadow: true,
        tags: ['damage-states'],
      });
    }
    reg.add(`unit.blockade.deploy.${axis}`, {
      group: 'units',
      frames: deployFrames(axis),
      fps: 12,
      loop: false,
      anchor: ANCHOR,
      hasShadow: true,
    });
    reg.add(`unit.blockade.burst.${axis}`, {
      group: 'units',
      frames: burstFrames(axis),
      fps: 12,
      loop: false,
      anchor: ANCHOR,
      hasShadow: true,
    });
  }
}
