/**
 * World-space interface markers (gallery group 'ui'): selection rings, valid / invalid tile
 * highlights with marching edges, command waypoint flag, range rings and placement-ghost tint.
 */
import { inTileDiamond } from '../../core/iso';
import { grid } from '../lib/grid';
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, col, ellipseRing, stamp, px } from './draw';

/* Selection rings ------------------------------------------------------------ */

const TEAM = {
  ally: { dark: 'navy1', ring: 'blue1', hi: 'blue2', glint: 'sky' },
  enemy: { dark: 'rust0', ring: 'crim1', hi: 'crim2', glint: 'rust4' },
} as const;

/** Iso ellipse ring with 4 bright bracket arcs (at the diagonals) that pulse in/out. */
function selectionRing(team: keyof typeof TEAM, rx: number): PixelBuffer[] {
  const t = TEAM[team];
  const ry = rx / 2;
  const W = Math.ceil(rx * 2) + 4;
  const H = Math.ceil(ry * 2) + 4;
  return [0, 1, 2, 1].map((p) => {
    const b = buf(W, H);
    const r = rx - 1 + p * 0.5;
    // Under-ring shadow (1 px lower) for contrast on any ground.
    ellipseRing(b, W / 2, H / 2 + 1, r, r / 2, t.dark);
    ellipseRing(b, W / 2, H / 2, r, r / 2, (_x, _y, a) => {
      const d = Math.abs(Math.sin(2 * a)); // 1 at the diagonals
      if (d > 0.82) return p === 2 ? t.glint : t.hi;
      return t.ring;
    });
    return b;
  });
}

/* Tile highlights -------------------------------------------------------------- */

/** Diamond outline (2 px band) with marching dashes; inner 1-px dim ring. 4 frames. */
function tileHighlight(bright: string, mid: string, dim: string): PixelBuffer[] {
  return [0, 1, 2, 3].map((f) => {
    const b = buf(32, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 32; x++) {
        if (!inTileDiamond(x, y)) continue;
        const edge = !inTileDiamond(x - 2, y) || !inTileDiamond(x + 2, y) || !inTileDiamond(x, y - 1) || !inTileDiamond(x, y + 1);
        if (edge) {
          // Perimeter coordinate ~ x for the top half going right, reversed for the bottom half.
          const s = y < 8 ? x : 64 - x;
          px(b, x, y, (Math.floor((s + f * 2) / 4) & 1) === 0 ? bright : mid);
          continue;
        }
        const inner = !inTileDiamond(x - 4, y) || !inTileDiamond(x + 4, y) || !inTileDiamond(x, y - 2) || !inTileDiamond(x, y + 2);
        if (inner && (x + y + f) % 2 === 0) px(b, x, y, dim);
      }
    }
    return b;
  });
}

/* Waypoint ------------------------------------------------------------------------ */

const FLAG = grid(`
  ooooo..
  oRRRRo.
  oRrRRRo
  oRRRRo.
  ooooo..
  oB.....
  oB.....
  oB.....
  oB.....
  oB.....
  ob.....
  .o.....
`, { o: 'ink', R: 'crim2', r: 'stone5', B: 'ochre3', b: 'ochre1' });

function waypoint(): PixelBuffer[] {
  const W = 19;
  const H = 24;
  const ax = 9;
  const ay = 19;
  const drops = [-9, -3, 0, -1, 0, 0];
  return drops.map((dy, f) => {
    const b = buf(W, H);
    if (f >= 2) {
      const r = [0, 0, 4, 6, 8, 7][f]!;
      ellipseRing(b, ax + 0.5, ay + 0.5, r, r / 2, f < 5 ? 'hivis2' : 'hivis1');
      ellipseRing(b, ax + 0.5, ay + 1.5, r, r / 2, (x, y) => (b.data[(y * W + x) * 4 + 3] ? null : 'olive1'));
    } else {
      ellipseRing(b, ax + 0.5, ay + 0.5, 3, 1.5, 'hivis1');
    }
    stamp(b, FLAG, ax - 1, ay - 11 + dy);
    return b;
  });
}

/* Range rings ------------------------------------------------------------------------ */

/** Iso radius in world px for a range of `tiles` (circle in tile space → ellipse on screen). */
export function rangeRadiusPx(tiles: number): { rx: number; ry: number } {
  return { rx: 16 * Math.SQRT2 * tiles, ry: 8 * Math.SQRT2 * tiles };
}

/**
 * Dashed range ring for any radius in tiles (2 frames: dashes march). Bright dash over a dark
 * 1-px drop line so it reads on light and dark ground. Anchor = centre.
 */
export function rangeRing(tiles: number, colour = 'stone5', shadow = 'ink'): PixelBuffer[] {
  const { rx, ry } = rangeRadiusPx(tiles);
  const W = Math.ceil(rx * 2) + 3;
  const H = Math.ceil(ry * 2) + 4;
  return [0, 1].map((f) => {
    const b = buf(W, H);
    const dash = (_x: number, _y: number, a: number): string | null => {
      const s = Math.round(((a + Math.PI) / (Math.PI * 2)) * (rx + ry) * 2.2);
      return (s + f * 3) % 6 < 4 ? colour : null;
    };
    ellipseRing(b, W / 2, H / 2 + 1, rx, ry, (x, y, a) => (dash(x, y, a) ? shadow : null));
    ellipseRing(b, W / 2, H / 2, rx, ry, dash);
    return b;
  });
}

/* Placement ghost tint ----------------------------------------------------------- */

const GHOST_RAMPS = {
  valid: ['navy1', 'navy2', 'blue1', 'blue2', 'sky'],
  invalid: ['rust0', 'crim1', 'crim2', 'rust4', 'pink3'],
} as const;

/**
 * Placement ghost: every opaque pixel is remapped by luminance onto a 5-step blue (valid) or
 * red (invalid) ramp; shadow pixels are dropped. Draw it at ~60% alpha at runtime.
 */
export function ghostTint(src: PixelBuffer, kind: keyof typeof GHOST_RAMPS): PixelBuffer {
  const ramp = GHOST_RAMPS[kind].map((r) => col(r));
  const out = buf(src.w, src.h);
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] !== 255) continue;
    const l = 0.3 * src.data[i]! + 0.59 * src.data[i + 1]! + 0.11 * src.data[i + 2]!;
    const c = ramp[Math.min(4, Math.floor((l / 256) * 5.4))]!;
    out.data[i] = c >>> 24;
    out.data[i + 1] = (c >>> 16) & 255;
    out.data[i + 2] = (c >>> 8) & 255;
    out.data[i + 3] = 255;
  }
  return out;
}

export function registerMarkers(reg: SpriteRegistry): void {
  for (const team of ['ally', 'enemy'] as const) {
    for (const [size, rx] of [['s', 8], ['m', 12], ['l', 22]] as const) {
      const fr = selectionRing(team, rx);
      reg.add(`ui.select.${team}.${size}`, {
        group: 'ui',
        frames: fr,
        fps: 6,
        anchor: { x: Math.floor(fr[0]!.w / 2), y: Math.floor(fr[0]!.h / 2) },
      });
    }
  }
  const tile = { x: 16, y: 0 };
  reg.add('ui.tile.valid', { group: 'ui', frames: tileHighlight('lime', 'green3', 'green4'), fps: 8, anchor: tile });
  reg.add('ui.tile.invalid', { group: 'ui', frames: tileHighlight('rust4', 'crim1', 'crim2'), fps: 8, anchor: tile });
  reg.add('ui.tile.target', { group: 'ui', frames: tileHighlight('hivis2', 'olive2', 'hivis1'), fps: 8, anchor: tile });
  reg.add('ui.waypoint', { group: 'ui', frames: waypoint(), fps: 14, loop: false, anchor: { x: 9, y: 19 } });
  for (let r = 3; r <= 14; r++) {
    const fr = rangeRing(r);
    reg.add(`ui.range.r${r}`, { group: 'ui', frames: fr, fps: 4, anchor: { x: Math.floor(fr[0]!.w / 2), y: Math.floor(fr[0]!.h / 2) } });
  }
}
