/**
 * Stub iso buildings for the M1 test map: shaded boxes with hand-drawn window/door modules.
 * M3a replaces these with the per-city building kits.
 */
import { STOREY_H } from '../../core/iso';
import { rampSwatch, resolveColor, type RampName, type RGBA } from '../palette';
import { grid, type KeyMap } from '../lib/grid';
import { boxShadow, isoBox, type BoxModule, type RoofFill } from '../lib/painter';
import type { PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';

// Windows are drawn un-sheared; the painter shears them along the 2:1 face slope.
// Keys: f frame, g glass, G glass highlight, s sill, d dark recess.
const WINDOW = `
ffff
fGgf
fgdf
fgdf
fddf
ssss
`;
const BALCONY_WINDOW = `
ffff
fGgf
fgdf
fgdf
rrrr
rkkr
`;
const DOOR = `
ffffff
fddddf
fdgGdf
fdggdf
fdddDf
fddddf
`;

interface Style {
  name: string;
  wall: RampName;
  roof: RoofFill;
  rim?: RampName;
}

const mod = (a: number, m: number): number => ((a % m) + m) % m;
const col = (ramp: RampName, step: number): RGBA => resolveColor(rampSwatch(ramp, step));

/** Roof tiles in courses running along the u axis, staggered breaks (terracotta / slate). */
function tiledRoof(ramp: RampName, course: number, tileLen: number): RoofFill {
  return (x, y) => {
    const s = 2 * y + x; // constant along u-lines
    const row = Math.floor(s / course);
    const r = mod(s, course);
    const d = mod(2 * y - x + (row % 2) * (tileLen / 2) * 2, tileLen * 2);
    if (r <= 1) return col(ramp, 1); // course shadow
    if (r <= 3) return col(ramp, 3); // lit tile lip
    if (d <= 1) return col(ramp, 1); // tile break
    return col(ramp, 2);
  };
}

/** Standing-seam metal roof (Paris zinc): seams along the v axis. */
function seamRoof(ramp: RampName, pitch: number): RoofFill {
  return (x, y) => {
    const d = mod(2 * y - x, pitch * 2);
    if (d <= 1) return col(ramp, 4);
    if (d <= 3) return col(ramp, 1);
    return col(ramp, 2);
  };
}

const STYLES: readonly Style[] = [
  {
    name: 'ochre',
    wall: 'madridOchre',
    roof: tiledRoof('madridTerracotta', 6, 6),
    rim: 'madridOchre',
  },
  { name: 'brick', wall: 'londonBrick', roof: tiledRoof('slate', 6, 10), rim: 'portlandStone' },
  { name: 'stone', wall: 'parisLimestone', roof: seamRoof('zinc', 5), rim: 'parisLimestone' },
];

function windowKeys(wall: RampName, left: boolean): KeyMap {
  return {
    f: `${wall}.${left ? 1 : 0}`,
    d: left ? 'navy1' : 'navy0',
    g: left ? 'zinc2' : 'zinc1',
    G: left ? 'sky' : 'zinc2',
    s: `${wall}.${left ? 4 : 3}`,
    r: left ? 'gray2' : 'gray1',
    k: left ? 'gray1' : 'ink',
    D: 'ochre2',
  };
}

function modulesFor(style: Style, n: number, storeys: number): BoxModule[] {
  const mods: BoxModule[] = [];
  const faceW = 16 * n;
  for (const face of ['left', 'right'] as const) {
    const left = face === 'left';
    const win = grid(WINDOW, windowKeys(style.wall, left), {}, 'window');
    const bal = grid(BALCONY_WINDOW, windowKeys(style.wall, left), {}, 'balcony');
    const door = grid(DOOR, windowKeys(style.wall, left), {}, 'door');
    for (let s = 0; s < storeys; s++) {
      const row = 3 + s * STOREY_H; // first storey starts below the 3-row cornice
      const ground = s === storeys - 1;
      for (let col = 3; col + 4 <= faceW - 2; col += 6) {
        if (ground && left && col === 3 + 6 * Math.floor((faceW - 8) / 12)) {
          mods.push({ img: door, face, col, row: row + 3 });
          continue;
        }
        const img: PixelBuffer = s % 2 === 1 && !ground ? bal : win;
        mods.push({ img, face, col, row: row + 2 });
      }
    }
  }
  return mods;
}

/** Name of a stub box sprite: `bld.stub.<style>.<n>x<storeys>`. */
export function stubBoxName(style: string, n: number, storeys: number): string {
  return `bld.stub.${style}.${n}x${storeys}`;
}

export const STUB_BOX_SIZES: ReadonlyArray<readonly [n: number, storeys: number]> = [
  [2, 2],
  [2, 3],
  [3, 3],
  [3, 4],
  [4, 4],
  [4, 5],
];

export function registerStubBoxes(reg: SpriteRegistry): void {
  for (const style of STYLES) {
    for (const [n, storeys] of STUB_BOX_SIZES) {
      const height = storeys * STOREY_H + 3;
      const box = isoBox({
        n,
        height,
        wall: style.wall,
        roof: style.roof,
        rim: style.rim,
        storeyH: STOREY_H,
        modules: modulesFor(style, n, storeys),
      });
      reg.add(stubBoxName(style.name, n, storeys), {
        group: 'buildings',
        frames: box.img,
        anchor: box.anchor,
      });
    }
  }
  for (const [n, storeys] of STUB_BOX_SIZES) {
    const sh = boxShadow(n, storeys * STOREY_H + 3);
    reg.add(`bld.stub.shadow.${n}x${storeys}`, {
      group: 'buildings',
      frames: sh.img,
      anchor: sh.anchor,
      hasShadow: true,
    });
  }
}
