/**
 * BERLIN pixel grids (E3 North). Facade modules use the keys documented in
 * bld/modules.grid.ts; prop grids the keys in props.grid.ts. Hand-aligned — never reflow.
 */

// ------------------------------------------------------------------------- facade modules --

/** Altbau window: stucco hood, two casements with a transom. */
export const BLN_WIN = `
.UTTTTt.
..tttt..
.ffffff.
.fGgfgf.
.fggfkf.
.ffffff.
.fgkfgf.
.fkgfgf.
.ffffff.
.tTTTTt.
`;

/** Beletage window: pediment, tall casements. */
export const BLN_WIN_TALL = `
..UTTt..
.UTTTTt.
.ffffff.
.fGgfgf.
.fggfkf.
.ffffff.
.fgkfgf.
.fkgfgf.
.fkkfgf.
.ffffff.
`;

/** Attic window under the cornice. */
export const BLN_WIN_SMALL = `
........
........
.UTTTTt.
.ffffff.
.fGgfgf.
.fgkfkf.
.ffffff.
.tTTTTt.
........
........
`;

/** Iron balcony on a stone slab (overlay). */
export const BLN_BALCONY = `
........
........
........
........
........
........
IIIIIIII
iIi.iIi.
iiiiiiii
UTTTTTTt
`;

/** Altbau front door: carved double door, transom light, stucco surround. */
export const BLN_DOOR = `
UTTTTTTt
TkGgggkt
TTTTTTTt
TDDDdDDt
TDdDdDdt
TDDDdDDt
TDdhdhdt
TDDDdDDt
TDdDdDdt
tttttttt
`;

/** Späti (2 bays): bright sign, window stacked with bottles, crates by the door. */
export const BLN_SPAETI = `
nnnnnnnnnnnnnnnn
nNNnNNnNnNNnNnnn
nnnnnnnnnnnnnnnn
fkkkkkkkkkkfkDDf
fyCyryCyrykfkDDf
fkkkkkkkkkkfkDhf
fCyrCyrCyrkfkDDf
fkkkkkkkkkkfkDDf
frrrryyyyyrfkDDf
tttttttttttttttt
`;

/** Döner Imbiss (2 bays): red-and-yellow sign, the spit in the window, menu board. */
export const BLN_DOENER = `
rrrrrrrrrrrrrrrr
ryyryyryryyryyrr
rrrrrrrrrrrrrrrr
fkkkkfwwwwwfkDDf
fkeekfwrwrwfkDDf
fkeeefwwwwwfkDhf
fkeekfwrwrwfkDDf
fkkekfwwwwwfkDDf
ffffffffffffkDDf
tttttttttttttttt
`;

/** Kneipe (2 bays): dark wood front, frosted lower panes, warm glow. */
export const BLN_KNEIPE = `
nnnnnnnnnnnnnnnn
nNnNNnNnnNnNNnnn
nnnnnnnnnnnnnnnn
fkkGkfkkkGkffDDf
fkGkkfkkGkkffDDf
fffffffffffffDhf
fWWWWfWWWWWffDDf
fWWWWfWWWWWffDDf
fffffffffffffDDf
tttttttttttttttt
`;

/** Roller shutter (closed shop / garage) — a tagger's favourite canvas. */
export const BLN_ROLLER = `
.tttttt.
.mmmmmm.
.MMMMMM.
.mmmmmm.
.MMMMMM.
.mmmmmm.
.MMMMMM.
.mmmmmm.
.MMMMMM.
.tttttt.
`;

/** Ground-floor window with a stucco hood. */
export const BLN_GROUND_WIN = `
.UTTTTt.
.ffffff.
.fGgfgf.
.fggfkf.
.ffffff.
.fgkfgf.
.fkgfgf.
.ffffff.
.tTTTTt.
........
`;

// ---------------------------------------------------------------------------------- props --

/** Berlin gas lantern: slender dark mast, four-pane lantern with a crown and finial. */
export const LAMP_BERLIN = `
....A....
...MAm...
..MMMmm..
.MMMMMmm.
.mMLFLmm.
..MLLFm..
..MLLLm..
..MLLLm..
...MMm...
...AAA...
...MMm...
....M....
....M....
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
...AAA...
..MMMmm..
..MMMmm..
.MMMMmmm.
.MMMMmmm.
MMMMMmmmm
`;

/** U-Bahn sign: white square, blue frame, blue U. */
export const METRO_BERLIN = `
BBBBBBBBB
BwwwwwwwB
BwBBwBBwB
BwBBwBBwB
BwBBwBBwB
BwBBwBBwB
BwBBBBBwB
BwwBBBwwB
BwwwwwwwB
BBBBBBBBB
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
...MMmm..
`;

/** S-Bahn sign: green disc with a white S. */
export const SBAHN_BERLIN = `
..GGGGG..
.GGwwwGG.
GGwGGGwGG
GGwGGGGGG
GGGwwwGGG
GGGGGGwGG
GGwGGGwGG
.GGwwwGG.
..GGGGG..
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
...MMmm..
`;

/** U and S on one tall mast (an interchange). */
export const US_BERLIN = `
BBBBBBBBB
BwwwwwwwB
BwBBwBBwB
BwBBwBBwB
BwBBwBBwB
BwBBBBBwB
BwwBBBwwB
BBBBBBBBB
....Mm...
..GGGGG..
.GGwwwGG.
GGwGGGwGG
GGGwwGGGG
GGGGGwwGG
GGwGGGwGG
.GGwwwGG.
..GGGGG..
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
....Mm...
...MMmm..
`;

/** Litfaßsäule: dark green crown and plinth, a drum of pasted posters (p/P/y/C/n recoloured). */
export const LITFASS = `
.....AA.....
....GGgg....
...GGGGgg...
..AAAAAAAA..
.GGGGGGgggg.
GGGGGGGggggg
.wpppyyyBBg.
.wpPpyYyBBg.
.wppPyyyBBg.
.wppPyyyBBg.
.cCCwwwwnng.
.cCCwWwwnng.
.cCCwwWwnng.
.cCCwwwwnng.
.yyyCCcwwwg.
.yYyCCcwwwg.
.yyyCCcwWwg.
.yyyCCcwwwg.
.wppyyCCnng.
.wPpyyCCnng.
.GGGGGGgggg.
GGGGGGGggggg
GGGGGGGggggg
`;

/** Traffic light with the Ampelmännchen pedestrian head (R/O/G car lamps, X/Y man lamps). */
export const AMPEL = `
.kkkk..kkkkk.
k2222k.k222k.
k2RR2k.k2X2k.
k2222k.kXXXk.
k2OO2k.k2X2k.
k2222k.kX2Xk.
k2GG2k.kkkkk.
k2222k.k2Y2k.
.kkkk..kYYYk.
..MM...k2Y2k.
..Mm...kY2Yk.
..MmMMMMkkkk.
..Mm.........
..Mm.........
..Mm.........
..Mm.........
..Mm.........
..Mm.........
..Mm.........
..Mm.........
..Mm.........
..Mm.........
..Mm.........
..Mm.........
.MMmm........
`;

/** Graffiti on the ground: a BLN throw-up. */
export const TAG_BLN = `
###..#....#..#
#..#.#....##.#
###..#....#.##
#..#.#....#..#
###..####.#..#
`;
