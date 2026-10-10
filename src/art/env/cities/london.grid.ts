/**
 * LONDON pixel grids (E0: moved verbatim from bld/modules.grid.ts and props.grid.ts).
 * Facade modules use the keys documented in bld/modules.grid.ts; prop grids the keys in
 * props.grid.ts. Hand-aligned — never reflow (Prettier-ignored).
 */

// ------------------------------------------------------------------------- facade modules --

/** Georgian sash window with stone lintel and sill. */
export const LDN_SASH = `
........
.UUUUUt.
.ffffff.
.fkkkkf.
.fkGggf.
.ffffff.
.fkgGgf.
.fkggGf.
.ffffff.
.UUUUUt.
`;

/** Taller first-floor sash with a cast-iron balconette. */
export const LDN_SASH_TALL = `
.UUUUUt.
.ffffff.
.fkkkkf.
.fkGggf.
.fkgGgf.
.ffffff.
.fkggGf.
.IIIIII.
.i.ii.i.
.iiiiii.
`;

/** Small attic / top-floor sash. */
export const LDN_SASH_SMALL = `
........
........
.UUUUt..
.ffff...
.fkGf...
.fkgf...
.ffff...
.UUUUt..
........
........
`;

/** Georgian front door with fanlight. */
export const LDN_DOOR = `
.UUUUUt.
.UkGgkU.
.UffffU.
.UDDDDU.
.UDdDdU.
.UDDhDU.
.UDdDdU.
.UDDDDU.
.UDDDDU.
tttttttt
`;

/** Pub front (2 bays): painted fascia with gilded letters, big panes, door. */
export const LDN_PUB = `
nnnnnnnnnnnnnnnn
nNNnNnNNnNNnNnNn
nnnnnnnnnnnnnnnn
fkkGgkfkkGgkfDDf
fkGgkkfkGgkkfDDf
fgkkkcfgkkkcfDhf
fkkkcCfkkkcCfDDf
ffffffffffffffff
nnnnnnnnnnnnfDDf
tttttttttttttttt
`;

/** London shopfront (2 bays): fascia, large window, recessed door. */
export const LDN_SHOP = `
nnnnnnnnnnnnnnnn
nnNNnNnNNnNnNnnn
aaAAaaAAaaAAaaAA
fkkGgkkcCkkfkDDf
fkGgkkcCckkfkDDf
fgkkkkkkGgkfkDhf
fkkkkkkkgGkfkDDf
ffffffffffffkDDf
nnnnnnnnnnnnkddf
tttttttttttttttt
`;

/** Basement-area railings with gilded tips (overlay at the foot of the ground floor). */
export const LDN_RAILINGS = `
........
........
........
........
........
y.y.y.y.
i.i.i.i.
iiiiiiii
i.i.i.i.
i.i.i.i.
`;

// ---------------------------------------------------------------------------------- props --

/** London Westminster-style lamp: black with gilded crown, tapered lantern. */
export const LAMP_LONDON = `
....A....
...AAA...
...mAm...
..MMMmm..
.MMMMmmm.
.MLFLLLm.
..MLFLm..
..MLLLm..
...MMm...
...AAA...
....M....
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...AMA...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
..MMMmm..
..AAAAA..
..MMMmm..
.MMMMmmm.
.MmMmMmm.
MMMMMmmmm
`;

/** London Underground roundel on a post. */
export const METRO_LONDON = `
...cccc...
..cCCCCc..
.cCwwwwCc.
NNNNNNNNNN
NwwwwwwwwN
NNNNNNNNNN
.cCwwwwCc.
..cCCCCc..
...cccc...
....Mm....
....Mm....
....Mm....
....Mm....
....Mm....
....Mm....
....Mm....
....Mm....
....Mm....
....Mm....
....Mm....
....Mm....
...MMmm...
`;
