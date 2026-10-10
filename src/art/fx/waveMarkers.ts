/**
 * Incoming-wave markers (Kingdom Rush style "the next wave comes from here"), gallery group
 * 'ui':
 *
 * - `fx.forecast.chevron.<dir>` — iso ground chevrons painted along a district's route toward
 *   the Capitol (8 tile directions × 3 shades: dim / lit / bright; the view runs a bright pulse
 *   down the trail). Rasterised in tile space, so every edge is a clean 2:1 iso line.
 * - `ui.forecast.flag.t1..t3` — the rally marker: crimson swallow-tail protest banner on a
 *   wooden pole with a brass finial, waving (4 frames). The banner carries 1–3 "!" marks: the
 *   size of the crowd as a shape, not just a colour.
 * - `ui.forecast.ring` — pulse ring at the pole's foot (4 frames).
 * - `ui.forecast.new` — hi-vis "NEW" tag for districts joining for the first time (2 frames).
 * - `ui.forecast.edge.<dir>` — edge-of-screen pointer for off-screen districts: crimson
 *   rally disc with the "!" marks and a cream arrowhead pointing at the district (8 screen
 *   directions × 2 frames, the arrow nudges outward).
 * - `forecastPlate(count)` / `forecastCountTag(count)` / `forecastBadge(head)` — runtime pieces:
 *   the crowd-size plate (crowd icon + expected count), its compact form under edge pointers
 *   and the round badge with the leading protester type's head and shoulders.
 * - `MINIMAP_FLAG` — the 4×6 flag glyph the minimap stamps on each district.
 *
 * Light from the upper left, coloured outlines (rust0 on crimson, ink on UI pieces), RIOT-64.
 */
import { grid } from '../lib/grid';
import type { PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';
import { ICONS } from '../uikit/icons';
import { FONTS, drawText, measureText } from '../uikit/text';
import { buf, disc, ellipseRing, has, hline, outlineBuf, px, rect, stamp, vline } from './draw';

/* Directions ---------------------------------------------------------------------- */

/** Tile-space directions (du, dv), named by where they point on screen. */
export const TILE_DIRS = {
  e: [1, -1],
  se: [1, 0],
  s: [1, 1],
  sw: [0, 1],
  w: [-1, 1],
  nw: [-1, 0],
  n: [-1, -1],
  ne: [0, -1],
} as const satisfies Record<string, readonly [number, number]>;
export type ForecastDir = keyof typeof TILE_DIRS;
export const FORECAST_DIRS = Object.keys(TILE_DIRS) as ForecastDir[];

/** Screen direction of a tile-space step (du, dv) — nearest of the 8 chevron directions. */
export function tileDirName(du: number, dv: number): ForecastDir {
  const a = Math.atan2(dv, du); // tile-space angle; +u = 0
  const k = (Math.round(a / (Math.PI / 4)) + 8) % 8;
  // k: 0 (+u) se, 1 (+u+v) s, 2 (+v) sw, 3 w, 4 nw, 5 n, 6 ne, 7 e
  return (['se', 's', 'sw', 'w', 'nw', 'n', 'ne', 'e'] as const)[k]!;
}

/** Screen-space direction (0 = east, clockwise, 45° steps) for the edge pointers. */
export const SCREEN_DIRS: readonly ForecastDir[] = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];

/** Nearest of the 8 screen directions for a screen vector (y down). */
export function screenDirName(dx: number, dy: number): ForecastDir {
  const k = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  return SCREEN_DIRS[k]!;
}

/* Ground chevrons ------------------------------------------------------------------ */

const CHEVRON_SHADES = [
  { fill: 'crim1', lit: 'crim2', dark: 'rust1', rim: 'rust0' }, // dim
  { fill: 'crim2', lit: 'rust4', dark: 'crim1', rim: 'rust0' }, // lit
  { fill: 'rust4', lit: 'ochre4', dark: 'rust3', rim: 'rust1' }, // bright (the pulse)
] as const;

/** Chevron size in tiles: half-span of the arms, stroke thickness, tip offset from centre. */
const CH = { span: 0.56, stroke: 0.3, tip: 0.36 };

/**
 * A ground chevron pointing along tile direction `dir`, as painted road marking: each pixel
 * centre is projected back onto the ground plane and tested against the "V" in tile units.
 * Fill with an upper-left lit rim and a lower-right shade, coloured outline. Anchor = centre.
 */
export function routeChevron(dir: ForecastDir, shade: 0 | 1 | 2): PixelBuffer {
  const [du, dv] = TILE_DIRS[dir];
  const len = Math.hypot(du, dv);
  const ax = du / len;
  const ay = dv / len;
  const W = 39;
  const H = 21;
  const cx = 19.5;
  const cy = 10.5;
  const inside = (x: number, y: number): boolean => {
    const X = x + 0.5 - cx;
    const Y = y + 0.5 - cy;
    const u = Y / 16 + X / 32;
    const v = Y / 16 - X / 32;
    const along = u * ax + v * ay;
    const across = Math.abs(-u * ay + v * ax);
    const back = CH.tip - along - across;
    return across <= CH.span && back >= 0 && back <= CH.stroke;
  };
  const s = CHEVRON_SHADES[shade];
  const b = buf(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const top = !inside(x, y - 1) || !inside(x - 1, y);
      const bottom = !inside(x, y + 1) || !inside(x + 1, y);
      px(b, x, y, top && !bottom ? s.lit : bottom && !top ? s.dark : s.fill);
    }
  }
  outlineBuf(b, s.rim);
  return b;
}

/* Rally banner ---------------------------------------------------------------------- */

const POLE_H = 27;
const FLAG_W = 16;
const FLAG_H = 11;

/** Pole with a brass finial (5 wide incl. outline). Foot = bottom-centre pixel. */
const POLE = grid(
  `
  .ooo.
  oYYbo
  oYbbo
  .obo.
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .oPpo
  .opqo
  .ooo.
`,
  { o: 'ink', Y: 'ochre4', b: 'ochre2', P: 'earth4', p: 'earth2', q: 'earth1' },
);

/** "!" mark, 2×8 (bar, gap, dot). */
const BANG = [1, 1, 1, 1, 1, 0, 1, 1];

/** Banner cloth: inside (not in the swallow-tail notch at the fly end)? */
function inBanner(x: number, y: number): boolean {
  const mid = (FLAG_H - 1) / 2;
  return !(x >= FLAG_W - 4 && Math.abs(y - mid) < x - (FLAG_W - 4) - 0.5);
}

/** Left columns of the tier's "!" marks (2 px wide, 2 px apart), centred in the hoist part. */
function markColumns(tier: number): number[] {
  const mw = tier * 2 + (tier - 1) * 2;
  const x0 = 1 + Math.floor((FLAG_W - 4 - mw) / 2);
  return Array.from({ length: tier }, (_, m) => x0 + m * 4);
}

/**
 * Rally banner for a threat tier (1–3 "!" marks), 4 waving frames. The cloth waves in 3-column
 * panels (folds stay flat facets) shaded by the fold's slope; each "!" rides its fold as one
 * rigid piece so it never shears. The hoist edge is the pole. Anchor = the pole's foot.
 */
export function rallyFlagFrames(tier: 1 | 2 | 3): PixelBuffer[] {
  const W = 5 + FLAG_W + 1;
  const H = POLE_H + 1;
  const out: PixelBuffer[] = [];
  for (let f = 0; f < 4; f++) {
    const b = buf(W, H);
    const cloth = buf(W, H);
    const ph = (f / 4) * Math.PI * 2;
    const wave = (x: number): { off: number; tone: number } => {
      const gx = Math.floor(x / 3) * 3 + 1;
      const k = gx / FLAG_W;
      const slope = Math.cos(gx * 0.45 - ph);
      return {
        off: Math.round(1.4 * k * Math.sin(gx * 0.45 - ph) + k * 1.2),
        tone: x === 0 ? 0 : slope > 0.85 ? 2 : slope < -0.7 ? 0 : 1,
      };
    };
    for (let x = 0; x < FLAG_W; x++) {
      const { off, tone } = wave(x);
      for (let y = 0; y < FLAG_H; y++) {
        if (!inBanner(x, y)) continue;
        let c = tone === 0 ? 'crim1' : tone === 2 ? 'rust3' : 'crim2';
        // Top hem catches the light; bottom hem in shade.
        if (y === 0) c = tone === 0 ? 'crim2' : 'rust4';
        else if (y === FLAG_H - 1) c = 'crim1';
        px(cloth, 4 + x, 3 + y + off, c);
      }
    }
    for (const mx of markColumns(tier)) {
      const { off, tone } = wave(mx);
      for (let r = 0; r < 8; r++) {
        if (!BANG[r]) continue;
        px(cloth, 4 + mx, 5 + r + off, tone === 0 ? 'stone4' : 'stone5');
        px(cloth, 5 + mx, 5 + r + off, tone === 0 ? 'stone3' : r < 4 ? 'white' : 'stone4');
      }
    }
    outlineBuf(cloth, 'ink');
    stamp(b, cloth, 0, 0);
    stamp(b, POLE, 0, 0);
    out.push(b);
  }
  return out;
}

/** Anchor (pole foot) of the rally banner frames. */
export const FLAG_ANCHOR = { x: 2, y: POLE_H - 1 };

/** Pulse ring at the pole's foot: an iso ring widening and fading (4 frames). */
export function rallyRingFrames(): PixelBuffer[] {
  const W = 30;
  const H = 16;
  const steps = [
    { r: 5, c: 'rust4' },
    { r: 8, c: 'crim2' },
    { r: 11, c: 'crim2' },
    { r: 13.5, c: 'crim1' },
  ];
  return steps.map(({ r, c }) => {
    const b = buf(W, H);
    ellipseRing(b, W / 2, H / 2 - 0.5, r, r / 2, c);
    ellipseRing(b, W / 2, H / 2 + 0.5, r, r / 2, (x, y) => (has(b, x, y) ? null : 'rust0'));
    return b;
  });
}

/* NEW tag ----------------------------------------------------------------------------- */

/** Hi-vis "NEW" tag with an ink keyline; frame 1 is the bright blink. */
export function newTagFrames(): PixelBuffer[] {
  const font = FONTS.smallBold;
  const tw = measureText(font, 'NEW').w;
  const W = tw + 7;
  const H = font.capHeight + 6;
  return [0, 1].map((f) => {
    const b = buf(W, H);
    rect(b, 1, 1, W - 2, H - 2, f ? 'ochre4' : 'hivis2');
    hline(b, 2, H - 2, W - 4, f ? 'hivis2' : 'hivis1');
    hline(b, 2, 1, W - 4, f ? 'white' : 'ochre4');
    outlineBuf(b, 'ink');
    // Square the corners off by one pixel (tag shape).
    for (const [x, y] of [
      [0, 0],
      [W - 1, 0],
      [0, H - 1],
      [W - 1, H - 1],
    ] as const) {
      b.data.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 4);
    }
    px(b, 1, 1, 'ink');
    px(b, W - 2, 1, 'ink');
    px(b, 1, H - 2, 'ink');
    px(b, W - 2, H - 2, 'ink');
    drawText(b, font, 'NEW', 4, 3, 'ink');
    return b;
  });
}

/* Edge pointer -------------------------------------------------------------------------- */

const EDGE_R = 8.5;
const EDGE_SIZE = 37;

/**
 * Edge-of-screen pointer: a crimson map pin — rally disc drawn out into a point aimed at the
 * district (screen direction `dir`), lit upper-left, shaded lower-right, ink outline — with
 * the tier's "!" marks. Frame 1 stretches the point 1 px (a nudge). Anchor = disc centre.
 */
export function edgePointerFrames(dir: ForecastDir, tier: 1 | 2 | 3): PixelBuffer[] {
  const k = SCREEN_DIRS.indexOf(dir);
  const a = (k * Math.PI) / 4;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const c = EDGE_SIZE / 2;
  const R = EDGE_R;
  return [0, 1].map((f) => {
    const b = buf(EDGE_SIZE, EDGE_SIZE);
    const tip = R + 5 + f;
    const inside = (x: number, y: number): boolean => {
      const X = x + 0.5 - c;
      const Y = y + 0.5 - c;
      if (X * X + Y * Y <= R * R) return true;
      const along = X * dx + Y * dy;
      const across = Math.abs(-X * dy + Y * dx);
      // Point: flanks from the disc to a 2-px blunt tip.
      return along > 2 && along <= tip && across <= ((tip - along) / tip) * R * 0.95 + 0.6;
    };
    // Drop lone spikes (pixels with fewer than two 4-neighbours): no single-pixel noise.
    const solid = (x: number, y: number): boolean => {
      if (!inside(x, y)) return false;
      let n = 0;
      if (inside(x - 1, y)) n++;
      if (inside(x + 1, y)) n++;
      if (inside(x, y - 1)) n++;
      if (inside(x, y + 1)) n++;
      return n >= 2;
    };
    for (let y = 0; y < EDGE_SIZE; y++) {
      for (let x = 0; x < EDGE_SIZE; x++) {
        if (!solid(x, y)) continue;
        const X = x + 0.5 - c;
        const Y = y + 0.5 - c;
        const rim = !solid(x - 1, y) || !solid(x, y - 1);
        const low = !solid(x + 1, y) || !solid(x, y + 1);
        let col = X + Y > R * 0.9 ? 'crim1' : 'crim2';
        if (rim && X + Y < 0) col = 'rust4';
        else if (low && X + Y > 0) col = 'rust1';
        px(b, x, y, col);
      }
    }
    outlineBuf(b, 'ink');
    // "!" marks.
    const mw = tier * 2 + (tier - 1) * 2;
    const x0 = Math.round(c - mw / 2);
    const y0 = Math.round(c - 4);
    for (let m = 0; m < tier; m++) {
      for (let r = 0; r < 8; r++) {
        if (!BANG[r]) continue;
        px(b, x0 + m * 4, y0 + r, 'stone5');
        px(b, x0 + m * 4 + 1, y0 + r, r < 4 ? 'white' : 'stone4');
        px(b, x0 + m * 4 + 2, y0 + r + 1, 'rust1');
      }
    }
    return b;
  });
}

export const EDGE_ANCHOR = { x: Math.floor(EDGE_SIZE / 2), y: Math.floor(EDGE_SIZE / 2) };

/* Plate & badge ------------------------------------------------------------------------ */

/**
 * Crowd-size plate: ink-keylined dark leather tag with the HUD's crowd icon and the expected
 * head count (e.g. "40"). Used under the rally banner and the edge pointer.
 */
export function forecastPlate(text: string): PixelBuffer {
  const icon = ICONS.crowd();
  const font = FONTS.smallBold;
  const tw = measureText(font, text).w;
  const W = icon.w + tw + 9;
  const H = Math.max(icon.h, font.capHeight) + 4;
  const b = buf(W, H);
  rect(b, 1, 1, W - 2, H - 2, 'gray1');
  hline(b, 2, 1, W - 4, 'gray3');
  vline(b, 1, 2, H - 4, 'gray2');
  hline(b, 2, H - 2, W - 4, 'ink');
  outlineBuf(b, 'ink');
  // Rounded corners.
  for (const [x, y] of [
    [0, 0],
    [W - 1, 0],
    [0, H - 1],
    [W - 1, H - 1],
  ] as const) {
    b.data.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 4);
  }
  stamp(b, icon, 2, Math.floor((H - icon.h) / 2));
  drawText(b, font, text, icon.w + 4, Math.floor((H - font.capHeight) / 2), 'stone5', {
    shadow: 'ink',
  });
  return b;
}

/** Compact count tag (no icon) under an edge pointer. */
export function forecastCountTag(text: string): PixelBuffer {
  const font = FONTS.smallBold;
  const tw = measureText(font, text).w;
  const W = tw + 7;
  const H = font.capHeight + 6;
  const b = buf(W, H);
  rect(b, 1, 1, W - 2, H - 2, 'gray1');
  hline(b, 2, 1, W - 4, 'gray3');
  hline(b, 2, H - 2, W - 4, 'ink');
  outlineBuf(b, 'ink');
  for (const [x, y] of [
    [0, 0],
    [W - 1, 0],
    [0, H - 1],
    [W - 1, H - 1],
  ] as const) {
    b.data.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 4);
  }
  drawText(b, font, text, 3, 3, 'stone5', { shadow: 'ink' });
  return b;
}

/**
 * Round badge (19×19) with a protester's head and shoulders inside (cream face plate, coloured
 * ring, ink outline) — "this type leads the wave". Without a head: a crimson "!".
 */
export function forecastBadge(head: PixelBuffer | null, ring = 'crim2'): PixelBuffer {
  const S = 19;
  const c = S / 2;
  const b = buf(S, S);
  disc(b, c, c, 9.4, 'ink');
  disc(b, c, c, 8.4, ring);
  disc(b, c, c, 6.8, 'stone4');
  ellipseRing(b, c, c, 6.8, 6.8, (x, y) => (x + y < S - 3 ? 'stone5' : null));
  if (head) {
    const hx = Math.round(c - head.w / 2);
    const hy = Math.round(c - head.h / 2) + 1;
    // Clip the bust to the face plate.
    for (let y = 0; y < head.h; y++) {
      for (let x = 0; x < head.w; x++) {
        const o = (y * head.w + x) * 4;
        if (head.data[o + 3] !== 255) continue;
        const X = hx + x + 0.5 - c;
        const Y = hy + y + 0.5 - c;
        if (X * X + Y * Y > 7.4 * 7.4) continue;
        const p = ((hy + y) * S + hx + x) * 4;
        b.data[p] = head.data[o]!;
        b.data[p + 1] = head.data[o + 1]!;
        b.data[p + 2] = head.data[o + 2]!;
        b.data[p + 3] = 255;
      }
    }
  } else {
    for (let r = 0; r < 8; r++) {
      if (!BANG[r]) continue;
      px(b, 9, 5 + r, 'crim2');
      px(b, 10, 5 + r, 'crim1');
    }
  }
  return b;
}

/* Minimap glyph -------------------------------------------------------------------------- */

/**
 * 6×8 minimap flag with its ink keyline (foot = column 1 of the bottom row). Keys: k ink,
 * o pole, R cloth.
 */
export const MINIMAP_FLAG = [
  'kkkkk.',
  'koRRRk',
  'koRRRk',
  'koRRk.',
  'kokk..',
  'kok...',
  'kok...',
  '.k....',
] as const;

/* Registration ------------------------------------------------------------------------- */

export function registerWaveMarkers(reg: SpriteRegistry): void {
  for (const dir of FORECAST_DIRS) {
    reg.add(`fx.forecast.chevron.${dir}`, {
      group: 'ui',
      frames: [routeChevron(dir, 0), routeChevron(dir, 1), routeChevron(dir, 2)],
      fps: 3,
      anchor: { x: 19, y: 10 },
    });
  }
  for (const tier of [1, 2, 3] as const) {
    reg.add(`ui.forecast.flag.t${tier}`, {
      group: 'ui',
      frames: rallyFlagFrames(tier),
      fps: 6,
      anchor: FLAG_ANCHOR,
    });
    reg.add(`ui.forecast.edge.e.t${tier}`, {
      group: 'ui',
      frames: edgePointerFrames('e', tier),
      fps: 3,
      anchor: EDGE_ANCHOR,
    });
  }
  for (const dir of FORECAST_DIRS) {
    if (dir === 'e') continue;
    reg.add(`ui.forecast.edge.${dir}.t2`, {
      group: 'ui',
      frames: edgePointerFrames(dir, 2),
      fps: 3,
      anchor: EDGE_ANCHOR,
    });
  }
  const ring = rallyRingFrames();
  reg.add('ui.forecast.ring', {
    group: 'ui',
    frames: ring,
    fps: 6,
    anchor: { x: Math.floor(ring[0]!.w / 2), y: Math.floor(ring[0]!.h / 2) },
  });
  reg.add('ui.forecast.new', { group: 'ui', frames: newTagFrames(), fps: 3 });
  reg.add('ui.forecast.plate', { group: 'ui', frames: forecastPlate('40') });
  reg.add('ui.forecast.count', { group: 'ui', frames: forecastCountTag('120') });
  reg.add('ui.forecast.badge', { group: 'ui', frames: forecastBadge(null) });
}
