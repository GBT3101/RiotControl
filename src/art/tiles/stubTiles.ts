/**
 * Stub ground tiles for the M1 test map (M3a replaces these with the real terrain kit).
 * Materials are 16×16 hand-authored lattice patches → seamless 32×16 tiles, plus a few
 * hand-drawn detail stamps for variety and procedural paving joints / road paint.
 */
import { resolveColor, type RampName, type RGBA } from '../palette';
import { grid, type KeyMap } from '../lib/grid';
import {
  diamondTile,
  latticeTile,
  onDiamondEdge,
  stampInDiamond,
  type DiamondEdge,
} from '../lib/painter';
import { cloneBuffer, type PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';

/** Keys '0'..'5' → steps of a ramp. */
export function rampKeys(ramp: RampName): KeyMap {
  const k: Record<string, string> = {};
  for (let i = 0; i <= 5; i++) k[String(i)] = `${ramp}.${i}`;
  return k;
}

// Lattice patches are deliberately calm: every tile repeats them, so detail lives in the
// per-variant stamps below (placed inside the diamond, chosen per tile by the map).
// prettier-ignore
const GRASS_PATCH = `
2222222222222222
2222222222222222
2222232222222222
2222212222222322
2222222222222122
2222222222222222
2232222222222222
2212222222222222
2222222223222222
2222222221222222
2222222222222222
2222222222222232
2222232222222212
2222212222222222
2222222222222222
2222222222222222
`;

// prettier-ignore
const ASPHALT_PATCH = `
3333333333333333
3333333333333333
3333333334333333
3333333333333333
3323333333333333
3333333333333333
3333333333333433
3333333333333333
3333343333333333
3333333333333333
3333333333323333
3333333333333333
3343333333333333
3333333333333333
3333333323333333
3333333333333333
`;

// Grass details: tufts, a darker clump (soft iso blob), flowers.
const GRASS_TUFT = `
3.3.3
23232
.121.
`;
const GRASS_CLUMP = `
...1111...
.11111111.
1111111111
.11111111.
...1111...
`;
const FLOWERS = `
.p...
pwp.y
.p.yY
...Y.
`;

// Asphalt wear: grit, a crack, a manhole cover.
const GRIT = `
2..4.2
.4.2..
2...4.
`;
const CRACK = `
2.....
.22...
...2..
....22
`;
const MANHOLE = `
..2222..
.234432.
22344322
.234432.
..2222..
`;

function c(ref: string): RGBA {
  return resolveColor(ref);
}

/** Paving: joints every half tile along both iso axes, bevel-lit on the upper-left sides. */
function paving(ramp: RampName, joint: number, base = 2): PixelBuffer {
  return diamondTile((x, y) => {
    const s = (((2 * y + x) % joint) + joint) % joint; // along-u joints (NE–SW lines)
    const d = (((2 * y - x) % joint) + joint) % joint; // along-v joints (NW–SE lines)
    if (s <= 1 || d === 0 || d === joint - 1) return c(`${ramp}.${base - 1}`);
    if (s <= 3 || d === 1 || d === 2) return c(`${ramp}.${base + 1}`); // lit bevel below a joint
    return c(`${ramp}.${base}`);
  });
}

/** Asphalt tile with a road-paint dash along one diamond edge. */
function dashTile(base: PixelBuffer, edge: DiamondEdge): PixelBuffer {
  const out = cloneBuffer(base);
  const paint = c('stone4');
  const paintShade = c('gray6');
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      if (!onDiamondEdge(x, y, edge, 2)) continue;
      // Keep a gap near the vertices so dashes read as dashes.
      const lx = edge === 'nw' || edge === 'sw' ? x : 31 - x;
      if (lx < 4 || lx > 12) continue;
      const shade = (edge === 'sw' || edge === 'se') && y === 15 - Math.floor(lx / 2);
      out.data.set(
        [
          ((shade ? paintShade : paint) >>> 24) & 255,
          ((shade ? paintShade : paint) >>> 16) & 255,
          ((shade ? paintShade : paint) >>> 8) & 255,
          255,
        ],
        (y * out.w + x) * 4,
      );
    }
  }
  return out;
}

export function registerStubTiles(reg: SpriteRegistry): void {
  const group = 'tiles';
  const anchor = { x: 16, y: 0 }; // top vertex of the diamond
  const grassKeys: KeyMap = {
    ...rampKeys('grass'),
    p: 'pink2',
    w: 'white',
    y: 'ochre3',
    Y: 'green2',
  };
  const grass = latticeTile(grid(GRASS_PATCH, grassKeys, {}, 'grass patch'));
  const tuft = grid(GRASS_TUFT, grassKeys);
  const grassB = cloneBuffer(grass);
  stampInDiamond(grassB, tuft, 8, 5);
  stampInDiamond(grassB, tuft, 19, 8);
  const grassC = cloneBuffer(grass);
  stampInDiamond(grassC, grid(FLOWERS, grassKeys), 13, 6);
  const grassD = cloneBuffer(grass);
  stampInDiamond(grassD, grid(GRASS_CLUMP, grassKeys), 11, 5);
  stampInDiamond(grassD, tuft, 13, 4);
  reg.add('tile.grass', { group, frames: grass, anchor });
  reg.add('tile.grass.b', { group, frames: grassB, anchor });
  reg.add('tile.grass.c', { group, frames: grassC, anchor });
  reg.add('tile.grass.d', { group, frames: grassD, anchor });

  const asphaltKeys = rampKeys('asphalt');
  const asphalt = latticeTile(grid(ASPHALT_PATCH, asphaltKeys, {}, 'asphalt patch'));
  const grit = grid(GRIT, asphaltKeys);
  const asphaltB = cloneBuffer(asphalt);
  stampInDiamond(asphaltB, grid(CRACK, asphaltKeys), 12, 5);
  const asphaltC = cloneBuffer(asphalt);
  stampInDiamond(asphaltC, grid(MANHOLE, asphaltKeys), 12, 5);
  const asphaltD = cloneBuffer(asphalt);
  stampInDiamond(asphaltD, grit, 7, 6);
  stampInDiamond(asphaltD, grit, 18, 4);
  reg.add('tile.asphalt', { group, frames: asphalt, anchor });
  reg.add('tile.asphalt.b', { group, frames: asphaltB, anchor });
  reg.add('tile.asphalt.c', { group, frames: asphaltC, anchor });
  reg.add('tile.asphalt.d', { group, frames: asphaltD, anchor });
  for (const e of ['nw', 'ne', 'se', 'sw'] as const) {
    reg.add(`tile.asphalt.dash.${e}`, { group, frames: dashTile(asphalt, e), anchor });
  }

  reg.add('tile.sidewalk', { group, frames: paving('sidewalk', 16), anchor });
  reg.add('tile.plaza', { group, frames: paving('plaza', 32), anchor });
  reg.add('tile.plaza.b', { group, frames: paving('plaza', 32, 1), anchor });
}
