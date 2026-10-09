/**
 * Bitmap text API (DOM-free). Fonts are authored as glyph grids (fonts/*.grid.ts) and built
 * once on first use. Everything renders straight into PixelBuffers with palette colours.
 *
 *   import { FONTS, drawText, measureText, textSprite } from '../art/uikit/text';
 *   const label = textSprite(FONTS.large, 'ORDER RESTORED', 'stone5', { outline: 'ink', shadow: 'rust0' });
 *   drawText(panel, FONTS.small, 'Hate: 120', 6, 4, 'ink');
 *
 * Coordinates: (x, y) is the left edge of the first glyph and the **top of the cap line**
 * (accents draw above y, descenders below the baseline y + capHeight).
 */
import { col } from '../fx/draw';
import { createBuffer, setPixel, type PixelBuffer } from '../lib/pixels';
import { LARGE_ACCENTS, LARGE_GLYPHS } from './fonts/large.grid';
import { SMALL_ACCENTS, SMALL_GLYPHS } from './fonts/small.grid';

export interface Glyph {
  readonly w: number;
  readonly h: number;
  /** Row offset of the mask's first row relative to the cap top (negative = above). */
  readonly y0: number;
  readonly mask: Uint8Array;
  /** Horizontal advance in px (glyph width + letter spacing, or the mono cell). */
  readonly adv: number;
  /** x offset of the mask inside its advance cell (mono fonts centre glyphs). */
  readonly x0: number;
}

export interface BitmapFont {
  readonly name: string;
  readonly capHeight: number;
  /** Rows used above the cap line by accents. */
  readonly ascent: number;
  /** Rows used below the baseline by descenders. */
  readonly descent: number;
  /** Baseline-to-baseline distance. */
  readonly lineHeight: number;
  readonly spaceAdv: number;
  readonly upperOnly: boolean;
  readonly glyphs: ReadonlyMap<string, Glyph>;
  readonly kerning: ReadonlyMap<string, number>;
}

/* ------------------------------------------------------------- building */

interface RawGlyph {
  w: number;
  rows: string[];
}

function parseBlocks(src: string): Map<string, RawGlyph> {
  const out = new Map<string, RawGlyph>();
  let name: string | null = null;
  let rows: string[] = [];
  const flush = (): void => {
    if (name === null) return;
    const w = Math.max(...rows.map((r) => r.length));
    rows.forEach((r, i) => {
      if (r.length !== w) throw new Error(`font glyph "${name}" row ${i} width ${r.length} ≠ ${w}`);
    });
    out.set(name, { w, rows });
    name = null;
    rows = [];
  };
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('@')) {
      flush();
      name = line.slice(1);
    } else if (line !== '' && name !== null) rows.push(line);
  }
  flush();
  return out;
}

function toGlyph(g: RawGlyph, spacing: number, y0 = 0): Glyph {
  const h = g.rows.length;
  const mask = new Uint8Array(g.w * h);
  g.rows.forEach((r, y) => [...r].forEach((c, x) => (mask[y * g.w + x] = c === 'X' ? 1 : 0)));
  return { w: g.w, h, y0, mask, adv: g.w + spacing, x0: 0 };
}

function topRow(g: Glyph): number {
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) if (g.mask[y * g.w + x]) return y + g.y0;
  return g.y0;
}

function bottomRow(g: Glyph): number {
  for (let y = g.h - 1; y >= 0; y--)
    for (let x = 0; x < g.w; x++) if (g.mask[y * g.w + x]) return y + g.y0;
  return g.y0;
}

/** Combine a base glyph with an accent mark above (or a cedilla below). */
function compose(base: Glyph, acc: Glyph, below: boolean, spacing: number): Glyph {
  const accH = acc.h;
  // Trim blank leading rows of the accent so diaeresis sits low.
  let lead = 0;
  while (lead < accH - 1 && ![...acc.mask.subarray(lead * acc.w, (lead + 1) * acc.w)].some(Boolean))
    lead++;
  const realH = accH - lead;
  const ay = below ? bottomRow(base) + 1 : topRow(base) - 1 - realH;
  const w = Math.max(base.w, acc.w);
  const bx = Math.floor((w - base.w) / 2);
  const ax =
    Math.floor((w - acc.w) / 2) + (below ? 0 : base.w % 2 === 0 && acc.w % 2 === 1 ? 0 : 0);
  const y0 = Math.min(base.y0, ay);
  const y1 = Math.max(base.y0 + base.h, ay + realH);
  const h = y1 - y0;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < base.h; y++) {
    for (let x = 0; x < base.w; x++)
      if (base.mask[y * base.w + x]) mask[(y + base.y0 - y0) * w + x + bx] = 1;
  }
  for (let y = lead; y < accH; y++) {
    for (let x = 0; x < acc.w; x++)
      if (acc.mask[y * acc.w + x]) mask[(ay + y - lead - y0) * w + x + ax] = 1;
  }
  return { w, h, y0, mask, adv: w + spacing, x0: 0 };
}

const ACCENTED: Record<string, [string, string]> = {
  á: ['a', 'acute'],
  à: ['a', 'grave'],
  â: ['a', 'circ'],
  ä: ['a', 'diaer'],
  ã: ['a', 'tilde'],
  é: ['e', 'acute'],
  è: ['e', 'grave'],
  ê: ['e', 'circ'],
  ë: ['e', 'diaer'],
  í: ['ı', 'acute'],
  ì: ['ı', 'grave'],
  î: ['ı', 'circ'],
  ï: ['ı', 'diaer'],
  ó: ['o', 'acute'],
  ò: ['o', 'grave'],
  ô: ['o', 'circ'],
  ö: ['o', 'diaer'],
  õ: ['o', 'tilde'],
  ú: ['u', 'acute'],
  ù: ['u', 'grave'],
  û: ['u', 'circ'],
  ü: ['u', 'diaer'],
  ñ: ['n', 'tilde'],
  ç: ['c', 'cedilla'],
  ÿ: ['y', 'diaer'],
  Á: ['A', 'acute'],
  À: ['A', 'grave'],
  Â: ['A', 'circ'],
  Ä: ['A', 'diaer'],
  Ã: ['A', 'tilde'],
  É: ['E', 'acute'],
  È: ['E', 'grave'],
  Ê: ['E', 'circ'],
  Ë: ['E', 'diaer'],
  Í: ['I', 'acute'],
  Ì: ['I', 'grave'],
  Î: ['I', 'circ'],
  Ï: ['I', 'diaer'],
  Ó: ['O', 'acute'],
  Ò: ['O', 'grave'],
  Ô: ['O', 'circ'],
  Ö: ['O', 'diaer'],
  Õ: ['O', 'tilde'],
  Ú: ['U', 'acute'],
  Ù: ['U', 'grave'],
  Û: ['U', 'circ'],
  Ü: ['U', 'diaer'],
  Ñ: ['N', 'tilde'],
  Ç: ['C', 'cedilla'],
};

interface FontSpec {
  name: string;
  glyphs: string;
  accents: string;
  capHeight: number;
  spacing: number;
  spaceAdv: number;
  lineGap: number;
  upperOnly: boolean;
  kerning: Record<string, number>;
}

function buildFont(spec: FontSpec): BitmapFont {
  const raw = parseBlocks(spec.glyphs);
  const accRaw = parseBlocks(spec.accents);
  const glyphs = new Map<string, Glyph>();
  for (const [ch, g] of raw) glyphs.set(ch, toGlyph(g, spec.spacing));
  const accents = new Map<string, Glyph>();
  for (const [n, g] of accRaw) accents.set(n, toGlyph(g, 0));
  for (const [ch, [b, a]] of Object.entries(ACCENTED)) {
    const base =
      glyphs.get(b) ?? glyphs.get(b.toUpperCase()) ?? (b === 'ı' ? glyphs.get('I') : undefined);
    const acc = accents.get(a);
    if (!base || !acc) continue;
    if (spec.upperOnly && ch !== ch.toUpperCase()) continue;
    glyphs.set(ch, compose(base, acc, a === 'cedilla', spec.spacing));
  }
  let ascent = 0;
  let descent = 0;
  for (const g of glyphs.values()) {
    ascent = Math.max(ascent, -g.y0);
    descent = Math.max(descent, g.y0 + g.h - spec.capHeight);
  }
  return {
    name: spec.name,
    capHeight: spec.capHeight,
    ascent,
    descent,
    lineHeight: spec.capHeight + Math.max(descent, ascent) + spec.lineGap,
    spaceAdv: spec.spaceAdv,
    upperOnly: spec.upperOnly,
    glyphs,
    kerning: new Map(Object.entries(spec.kerning)),
  };
}

/** Monospaced copy (typewriter): every glyph centred in a fixed cell. */
function monoFont(src: BitmapFont, cell: number, name: string): BitmapFont {
  const glyphs = new Map<string, Glyph>();
  for (const [ch, g] of src.glyphs) {
    glyphs.set(ch, { ...g, adv: cell, x0: Math.max(0, Math.floor((cell - 1 - g.w) / 2 + 0.5)) });
  }
  return { ...src, name, glyphs, spaceAdv: cell, kerning: new Map() };
}

/** Faux-bold copy: every stroke doubled 1 px to the right. */
/**
 * Hand-drawn bold glyphs where the generic "smear 1 px right" bolding closes the counters
 * (a 1-px-gap "+", "×" or '"' would melt into a blob). Rows from the cap top.
 */
const BOLD_OVERRIDES: Record<string, readonly string[]> = {
  '+': ['......', '..XX..', '..XX..', 'XXXXXX', 'XXXXXX', '..XX..', '..XX..'],
  '×': ['......', '......', 'XX..XX', '.XXXX.', '..XX..', '.XXXX.', 'XX..XX'],
  '"': ['XX.XX', 'XX.XX', 'X..X.'],
};

function boldFont(src: BitmapFont, name: string): BitmapFont {
  const glyphs = new Map<string, Glyph>();
  for (const [ch, g] of src.glyphs) {
    const o = BOLD_OVERRIDES[ch];
    if (o) {
      const bw = o[0]!.length;
      const mask = new Uint8Array(bw * o.length);
      o.forEach((r, y) => [...r].forEach((c, x) => (mask[y * bw + x] = c === 'X' ? 1 : 0)));
      glyphs.set(ch, { ...g, w: bw, h: o.length, y0: 0, mask, adv: bw + (g.adv - g.w) });
      continue;
    }
    const w = g.w + 1;
    const mask = new Uint8Array(w * g.h);
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (!g.mask[y * g.w + x]) continue;
        mask[y * w + x] = 1;
        mask[y * w + x + 1] = 1;
      }
    }
    glyphs.set(ch, { ...g, w, mask, adv: g.adv + 1 });
  }
  return { ...src, name, glyphs, spaceAdv: src.spaceAdv + 1 };
}

const SMALL_KERN: Record<string, number> = {
  Ta: -1,
  Tc: -1,
  Te: -1,
  To: -1,
  Tu: -1,
  Tr: -1,
  Ty: -1,
  'T.': -1,
  'T,': -1,
  LT: -1,
  LV: -1,
  LY: -1,
  AV: -1,
  VA: -1,
  AT: -1,
  TA: -1,
  AY: -1,
  YA: -1,
  'r.': -1,
  'r,': -1,
  'f.': -1,
  'F.': -1,
  'P.': -1,
  'P,': -1,
  Yo: -1,
  Ya: -1,
  Va: -1,
  Ve: -1,
  Vo: -1,
};
const LARGE_KERN: Record<string, number> = {
  LT: -2,
  LV: -1,
  LY: -2,
  AV: -1,
  VA: -1,
  AT: -1,
  TA: -1,
  AY: -1,
  YA: -1,
  'T.': -1,
  'T,': -1,
  'P.': -1,
};

let cache: {
  small: BitmapFont;
  smallBold: BitmapFont;
  mono: BitmapFont;
  large: BitmapFont;
} | null = null;

function fonts(): NonNullable<typeof cache> {
  if (cache) return cache;
  const small = buildFont({
    name: 'small',
    glyphs: SMALL_GLYPHS,
    accents: SMALL_ACCENTS,
    capHeight: 7,
    spacing: 1,
    spaceAdv: 3,
    lineGap: 1,
    upperOnly: false,
    kerning: SMALL_KERN,
  });
  const large = buildFont({
    name: 'large',
    glyphs: LARGE_GLYPHS,
    accents: LARGE_ACCENTS,
    capHeight: 12,
    spacing: 2,
    spaceAdv: 5,
    lineGap: 2,
    upperOnly: true,
    kerning: LARGE_KERN,
  });
  cache = {
    small,
    smallBold: boldFont(small, 'smallBold'),
    mono: monoFont(small, 6, 'mono'),
    large,
  };
  return cache;
}

/** The four fonts: small (5×7), smallBold (HUD numbers), mono (typewriter), large (12 px caps). */
export const FONTS = {
  get small(): BitmapFont {
    return fonts().small;
  },
  get smallBold(): BitmapFont {
    return fonts().smallBold;
  },
  get mono(): BitmapFont {
    return fonts().mono;
  },
  get large(): BitmapFont {
    return fonts().large;
  },
};
export type FontName = keyof typeof FONTS;

/* ------------------------------------------------------------- layout */

function glyphFor(font: BitmapFont, ch: string): Glyph | null {
  if (ch === ' ') return null;
  const c = font.upperOnly ? ch.toUpperCase() : ch;
  return font.glyphs.get(c) ?? font.glyphs.get(c.toUpperCase()) ?? font.glyphs.get('?') ?? null;
}

/** Width of a single line in px (no trailing letter-space). */
export function lineWidth(font: BitmapFont, line: string, tracking = 0): number {
  const chars = [...line];
  let w = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const g = glyphFor(font, ch);
    if (i === chars.length - 1) {
      w += g ? g.x0 + g.w : font.spaceAdv;
      break;
    }
    w += (g ? g.adv : font.spaceAdv) + tracking + (font.kerning.get(ch + chars[i + 1]!) ?? 0);
  }
  return Math.max(0, w);
}

/** Greedy word wrap to `maxWidth` px (explicit \n respected). */
export function wrapText(font: BitmapFont, str: string, maxWidth: number, tracking = 0): string[] {
  const out: string[] = [];
  for (const para of str.split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) {
      const tryLine = cur ? `${cur} ${word}` : word;
      if (cur && lineWidth(font, tryLine, tracking) > maxWidth) {
        out.push(cur);
        cur = word;
      } else cur = tryLine;
    }
    out.push(cur);
  }
  return out;
}

export interface TextMetrics {
  w: number;
  /** Cap top of the first line to the baseline of the last line. */
  h: number;
  lines: string[];
}

export function measureText(
  font: BitmapFont,
  str: string,
  maxWidth?: number,
  tracking = 0,
): TextMetrics {
  const lines = maxWidth ? wrapText(font, str, maxWidth, tracking) : str.split('\n');
  return {
    w: Math.max(0, ...lines.map((l) => lineWidth(font, l, tracking))),
    h: (lines.length - 1) * font.lineHeight + font.capHeight,
    lines,
  };
}

/* ------------------------------------------------------------- drawing */

export interface TextOptions {
  /** 1-px exterior outline colour (8-neighbour by default — chunky title look). */
  outline?: string;
  /** 4-neighbour outline only (lighter look for small text). */
  outlineThin?: boolean;
  /** Drop shadow colour (offset 1,1 by default; drawn under the outline). */
  shadow?: string;
  shadowOffset?: { x: number; y: number };
  /** Vertical colour bands top → bottom over the cap height (overrides `colour` per row). */
  ramp?: readonly string[];
  /** Horizontal alignment of every line relative to x (x = left edge / centre / right edge). */
  align?: 'left' | 'center' | 'right';
  /** Wrap width in px. */
  maxWidth?: number;
  /** Extra px between glyphs. Default: 1 with a thick (8-neighbour) outline, else 0. */
  tracking?: number;
  /** Extra px between lines. */
  lineGap?: number;
}

/** Effective tracking for a set of options. */
export function trackingOf(opts: TextOptions): number {
  return opts.tracking ?? (opts.outline && !opts.outlineThin ? 1 : 0);
}

/** Render text into a mask (1 = glyph). Returns the mask and its origin offset. */
function rasterise(
  font: BitmapFont,
  str: string,
  opts: TextOptions,
): {
  w: number;
  h: number;
  m: Uint8Array;
  rowOf: Int16Array;
  ox: number;
  oy: number;
  lines: string[];
} {
  const met = measureText(font, str, opts.maxWidth, trackingOf(opts));
  const lh = font.lineHeight + (opts.lineGap ?? 0);
  const pad = 3;
  const w = met.w + pad * 2;
  const h = (met.lines.length - 1) * lh + font.capHeight + font.ascent + font.descent + pad * 2;
  const m = new Uint8Array(w * h);
  const rowOf = new Int16Array(w * h).fill(-99); // cap-relative row for ramp colouring
  const ox = pad;
  const oy = pad + font.ascent;
  met.lines.forEach((line, li) => {
    const lw = lineWidth(font, line, trackingOf(opts));
    let x =
      opts.align === 'center'
        ? Math.floor((met.w - lw) / 2)
        : opts.align === 'right'
          ? met.w - lw
          : 0;
    const chars = [...line];
    chars.forEach((ch, i) => {
      const g = glyphFor(font, ch);
      if (g) {
        for (let gy = 0; gy < g.h; gy++) {
          for (let gx = 0; gx < g.w; gx++) {
            if (!g.mask[gy * g.w + gx]) continue;
            const px = ox + x + g.x0 + gx;
            const py = oy + li * lh + g.y0 + gy;
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            m[py * w + px] = 1;
            rowOf[py * w + px] = g.y0 + gy;
          }
        }
      }
      const next = chars[i + 1];
      x +=
        (g ? g.adv : font.spaceAdv) +
        trackingOf(opts) +
        (next ? (font.kerning.get(ch + next) ?? 0) : 0);
    });
  });
  return { w, h, m, rowOf, ox, oy, lines: met.lines };
}

function stampMask(
  dst: PixelBuffer,
  r: ReturnType<typeof rasterise>,
  dx: number,
  dy: number,
  colourAt: (i: number) => string | null,
): void {
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const c = colourAt(y * r.w + x);
      if (c) setPixel(dst, x + dx, y + dy, col(c));
    }
  }
}

function dilate(r: { w: number; h: number; m: Uint8Array }, corners: boolean): Uint8Array {
  const o = new Uint8Array(r.m.length);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      if (r.m[y * r.w + x]) continue;
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (let dx = -1; dx <= 1 && !hit; dx++) {
          if (!dx && !dy) continue;
          if (!corners && dx && dy) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < r.w && yy < r.h && r.m[yy * r.w + xx]) hit = true;
        }
      }
      if (hit) o[y * r.w + x] = 1;
    }
  }
  return o;
}

/**
 * Draw text into `buf` (in place) and return it. `colour` is a palette ref; see TextOptions.
 * (x, y) = left / top of the cap line of the first line (alignment shifts lines within the
 * measured block, whose left edge stays at x unless align = center / right, which treat x as
 * the block's centre / right edge).
 */
export function drawText(
  buf: PixelBuffer,
  font: BitmapFont,
  str: string,
  x: number,
  y: number,
  colour: string,
  opts: TextOptions = {},
): PixelBuffer {
  const r = rasterise(font, str, opts);
  const met = measureText(font, str, opts.maxWidth, trackingOf(opts));
  const bx =
    opts.align === 'center' ? x - Math.floor(met.w / 2) : opts.align === 'right' ? x - met.w : x;
  const dx = bx - r.ox;
  const dy = y - r.oy;
  const ring = opts.outline ? dilate(r, !opts.outlineThin) : null;
  if (opts.shadow) {
    const so = opts.shadowOffset ?? { x: 1, y: 1 };
    stampMask(buf, r, dx + so.x, dy + so.y, (i) => (r.m[i] || ring?.[i] ? opts.shadow! : null));
  }
  if (ring) stampMask(buf, r, dx, dy, (i) => (ring[i] ? opts.outline! : null));
  const ramp = opts.ramp;
  stampMask(buf, r, dx, dy, (i) => {
    if (!r.m[i]) return null;
    if (!ramp) return colour;
    const row = r.rowOf[i]!;
    const k = Math.max(
      0,
      Math.min(ramp.length - 1, Math.floor((row / font.capHeight) * ramp.length)),
    );
    return ramp[k]!;
  });
  return buf;
}

/** Text rendered into a tightly-fitting new buffer (outline / shadow included). */
export function textSprite(
  font: BitmapFont,
  str: string,
  colour: string,
  opts: TextOptions = {},
): PixelBuffer {
  const met = measureText(font, str, opts.maxWidth, trackingOf(opts));
  const extra =
    (opts.outline ? 1 : 0) +
    (opts.shadow
      ? Math.max(1, Math.abs(opts.shadowOffset?.y ?? 1), Math.abs(opts.shadowOffset?.x ?? 1))
      : 0);
  const W = met.w + extra * 2 + 2;
  const H = met.h + font.ascent + font.descent + extra * 2 + 2;
  const tmp = createBuffer(Math.max(1, W), Math.max(1, H));
  const x0 =
    opts.align === 'center'
      ? Math.floor(W / 2)
      : opts.align === 'right'
        ? W - extra - 1
        : extra + 1;
  drawText(tmp, font, str, x0, extra + 1 + font.ascent, colour, opts);
  return trim(tmp);
}

/** Crop a buffer to its opaque bounds. */
export function trim(src: PixelBuffer): PixelBuffer {
  let x0 = src.w;
  let y0 = src.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (!src.data[(y * src.w + x) * 4 + 3]) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return createBuffer(1, 1);
  const out = createBuffer(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) {
    out.data.set(
      src.data.subarray((y * src.w + x0) * 4, (y * src.w + x1 + 1) * 4),
      (y - y0) * out.w * 4,
    );
  }
  return out;
}

/** Every character the fonts support (for specimens / tests). */
export function supportedChars(font: BitmapFont): string[] {
  return [...font.glyphs.keys()].filter((c) => c.length === 1 && c !== 'ı');
}
