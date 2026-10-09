/**
 * Hand-authored ground detail stamps (M3a). "Relative" stamps: digits are shade offsets from
 * the material base colour ('3' = base, '2' one step darker, '4' one lighter, '0'/'1' deeper
 * shadow, '5' highlight); letters are absolute colours given by the caller; '.' = transparent.
 * They adapt to every city's material ramp.
 */

/** Round cast-iron manhole cover (flush, slightly darker than the road). */
export const MANHOLE = `
...1111...
.11222211.
1224242421
1242424221
.12222221.
...1111...
`;

/** Square service hatch (sidewalk / plaza). */
export const HATCH = `
...11...
.112211.
1242422.
.24242..
..221...
`;

/** Gutter drain grate (long side along the kerb). */
export const DRAIN = `
..0000..
.000000.
00505050
.050505.
..1111..
`;

/** Hairline crack across asphalt. */
export const CRACK_A = `
1.........
.11.......
...1......
....11.1..
......1.11
`;

export const CRACK_B = `
......11
....11..
...1....
.11.1...
1....1..
`;

/** Repaired trench patch — darker fresh tarmac with a lit seam on the upper-left. */
export const PATCH = `
.....4444..
...44222224
.4422222222
42222222222
.2222222221
...2222221.
.....211...
`;

/** Oil / water stain (soft, two-tone). */
export const STAIN = `
...2222...
.22211222.
2221111222
.22211122.
...2222...
`;

/** Tar seam lines (sealant across the carriageway). */
export const SEAM = `
1.......
.11.....
...11...
.....11.
.......1
`;

/** Worn grit speckle cluster. */
export const GRIT = `
2...4..
..2...2
.4..2..
`;

/** Cracked slab line for paving. */
export const SLAB_CRACK = `
..1...
..1...
.1....
1.11..
....1.
`;

/** Chewing-gum blots (very city). */
export const GUM = `
4.....5
......4
..5....
`;

/** Fallen leaves (absolute keys: y ochre, o rust, b earth). */
export const LEAVES = `
.y.....
yoy..b.
.y..bob
...y.b.
..yoy..
`;

/** Grass tufts / clover / daisies (absolute keys: g/G/L greens, w white, y yellow, p pink). */
export const TUFT = `
G.G.G
gGgGg
.ggg.
`;
export const TUFT_SMALL = `
G.G
gGg
`;
export const CLUMP = `
...gggg...
.gggddggg.
ggdddddddg
.ggddddgg.
...gggg...
`;
export const DAISIES = `
.w....
wyw.w.
.w.wyw
...gw.
`;
export const FLOWERS = `
.p...
pyp.p
.p.pyp
.....p
`;
export const DRY_PATCH = `
...yyyy..
.yyLyyLyy
yyLyyyyLy
.yyyyLyy.
...yyy...
`;

/** Pebble cluster for gravel paths (relative). */
export const PEBBLES = `
.45..
4532.
.2..4
...42
`;

/** Moss between cobbles (absolute: g green). */
export const MOSS = `
.g...
g.g.g
...g.
`;

/** Puddle reflection on a tile (absolute: d dark water, l light, s sky). */
export const PUDDLE = `
...dddd...
.dddlsddd.
dddsllsddd
.ddddddddd
...dddd...
`;
