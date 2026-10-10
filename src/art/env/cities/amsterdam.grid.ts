/**
 * AMSTERDAM pixel grids (E3 North). Facade modules use the keys documented in
 * bld/modules.grid.ts; prop grids the keys in props.grid.ts. Hand-aligned — never reflow.
 */

// ------------------------------------------------------------------------- facade modules --

/** Big white sash window, glazing bars, brick soldier-course arch over it. */
export const AMS_WIN = `
........
.wwwwww.
.ffffff.
.fGkfkf.
.fkkfkf.
.ffffff.
.fkkfGf.
.fkgfkf.
.ffffff.
..wwww..
`;

/** Taller first-floor window (bel-etage). */
export const AMS_WIN_TALL = `
.wwwwww.
.ffffff.
.fGkfkf.
.fkkfkf.
.fkgfkf.
.ffffff.
.fkkfGf.
.fkkfkf.
.fgkfkf.
.ffffff.
`;

/** Small top-floor window. */
export const AMS_WIN_SMALL = `
........
........
.wwwwww.
.ffffff.
.fGkfkf.
.ffffff.
.fkkfkf.
.ffffff.
..wwww..
........
`;

/** Warehouse loading door with its two shutters (centre bay of a pakhuis). */
export const AMS_LUIK = `
.wwwwww.
.ffffff.
.fSsSsf.
.fsSsSf.
.fSsSsf.
.fsSsSf.
.fSsSsf.
.fsSsSf.
.ffffff.
.tTTTTt.
`;

/** Small warehouse window with closed shutters. */
export const AMS_SHUTTERED = `
........
........
.wwwwww.
.ffffff.
.fSfSsf.
.fsfsSf.
.fSfSsf.
.ffffff.
........
........
`;

/** Window box with geraniums (overlay). */
export const AMS_GERANIUMS = `
........
........
........
........
........
........
........
.PpPPpP.
.iiiiii.
........
`;

/** Raised front door: fanlight, panelled door, stone stoop. */
export const AMS_DOOR = `
.UTTTTt.
.TkGgkT.
.TffffT.
.TDDDDT.
.TDdDdT.
.TDDhDT.
.TDdDdT.
.TDDDDT.
UTTTTTTt
tttttttt
`;

/** Ground-floor window over a barred basement window (souterrain). */
export const AMS_GROUND_WIN = `
.ffffff.
.fGkfkf.
.fkkfkf.
.ffffff.
.fkkfGf.
.fkgfkf.
.ffffff.
........
.iIiIii.
.ikikik.
`;

/** Brown café (2 bays): dark wood front, gilded name, small-paned windows, curtains. */
export const AMS_CAFE = `
nnnnnnnnnnnnnnnn
nNnNNnNnnNnNNnnn
nnnnnnnnnnnnnnnn
fkkGkfkkkGfffDDf
fkGkkfkkGkkffDDf
ffffffffffffkDhf
fcckcfcckccfkDDf
fCcccfCcCccfkDDf
ffffffffffffkDDf
tttttttttttttttt
`;

/** Shop (2 bays): fascia, striped awning, big window, recessed door. */
export const AMS_SHOP = `
nnnnnnnnnnnnnnnn
nnNNnNnNNnNnNnnn
aAaAaAaAaAaAaAaA
.a.A.a.A.a.A.a.A
fkkGgkkcCkkfkDDf
fkGgkkcCckkfkDhf
fgkkkkkkGgkfkDDf
fkkkkkkkgGkfkDDf
ffffffffffffkDDf
tttttttttttttttt
`;

// ---------------------------------------------------------------------------------- props --

/** Amsterdam canal lantern: black-green cast iron, four-pane lantern, crown and bracket. */
export const LAMP_AMSTERDAM = `
....A....
...mMm...
..MMMmm..
.MMMMMmm.
..MLFLm..
..MLLFm..
..MLLLm..
...MLm...
...MMm...
....M....
...MMm...
...AMm...
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
..MMMmm..
..AAAAA..
..MMMmm..
.MMMMmmm.
MMMMMmmmm
`;

/** "Amsterdammertje": red-brown cast-iron bollard with the three St Andrew's crosses. */
export const BOLLARD_AMSTERDAM = `
.MMm.
MMMmm
MwMwm
MMwmm
MwMwm
MMMmm
MwMwm
MMwmm
MwMwm
MMMmm
MwMwm
MMwmm
MwMwm
MMMmm
.MMm.
`;

/** Street bin (grey, red band). */
export const BIN_AMSTERDAM = `
.AAAAA.
AdddddA
BBBBBbb
BBBBBbb
BAAAAAb
BBBBBbb
BBBBBbb
BBBBBbb
.BBBbb.
..mmm..
`;

/** Metro / tram stop pole: blue panel with a white M, line plate below. */
export const METRO_AMSTERDAM = `
.nnnnnnnn.
nNNNNNNNNn
nNwNNNNwNn
nNwwNNwwNn
nNwNwwNwNn
nNwNNNNwNn
nNwNNNNwNn
nNNNNNNNNn
.nnnnnnnn.
...wwww...
...w33w...
...wwww...
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

/** Graffiti on the ground: XXX, the city's three crosses. */
export const TAG_XXX = `
#...#.#...#.#...#
.#.#...#.#...#.#.
..#.....#.....#..
.#.#...#.#...#.#.
#...#.#...#.#...#
`;
