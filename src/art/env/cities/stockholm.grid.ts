/**
 * STOCKHOLM pixel grids (E3 North). Facade modules use the keys documented in
 * bld/modules.grid.ts; prop grids the keys in props.grid.ts. Hand-aligned — never reflow.
 */

// ------------------------------------------------------------------------- facade modules --

/** Swedish casement window: white frame, mullion and transom cross, stone surround. */
export const STH_WIN = `
........
.UTTTTt.
.ffffff.
.fGgfgf.
.ffffff.
.fggfkf.
.fgkfgf.
.ffffff.
.tTTTTt.
........
`;

/** Tall window with a pediment hood (stone blocks, first floor). */
export const STH_WIN_TALL = `
..UTTt..
.UTTTTt.
.ffffff.
.fGgfgf.
.ffffff.
.fggfkf.
.fgkfgf.
.fkgfgf.
.ffffff.
.tTTTTt.
`;

/** Small attic / merchant-house window. */
export const STH_WIN_SMALL = `
........
........
..UTTt..
..ffff..
..fGgf..
..ffff..
..fgkf..
..ffff..
..tTTt..
........
`;

/** Iron balcony on brackets (overlay, stone-block floors). */
export const STH_BALCONY = `
........
........
........
........
........
........
IIIIIIII
i.i.i.i.
iiiiiiii
.t....t.
`;

/** Window boxes of red geraniums (overlay). */
export const STH_FLOWERS = `
........
........
........
........
........
........
........
.PpPpPp.
.iiiiii.
........
`;

/** Sandstone portal: pilasters, a carved lintel, panelled double door. */
export const STH_PORTAL = `
UTTTTTTt
UTkGgkTt
UTTTTTTt
.TDDDDt.
.TDdDdt.
.TDDDDt.
.TDdhdt.
.TDDDDt.
.TDdDdt.
tttttttt
`;

/** Shop (2 bays): painted fascia, big window, door. */
export const STH_SHOP = `
nnnnnnnnnnnnnnnn
nNnNNnnNNnNnnNnn
nnnnnnnnnnnnnnnn
TkkGgkkcCkkTkDDT
TkGgkkcCckkTkDDT
TgkkkkkkGgkTkDhT
TkkkkkkkgGkTkDDT
TTTTTTTTTTTTkDDT
TkkkkkkkkkkTkddT
tttttttttttttttt
`;

/** Konditori (2 bays): scalloped awning, gilded name, cake-window glow. */
export const STH_KONDITORI = `
nNnnNnNnnNnNnnNn
aAaAaAaAaAaAaAaA
aAaAaAaAaAaAaAaA
.a.A.a.A.a.A.a.A
fkkGgkfkkGgkfDDf
fkGgcCfkGgkcfDhf
fgkcCcfgkkCcfDDf
fffffffffffffDDf
TTTTTTTTTTTTfDDf
tttttttttttttttt
`;

// ---------------------------------------------------------------------------------- props --

/** Stockholm street lamp: grey mast, a wire stay and a white bell lamp hung from it. */
export const LAMP_STOCKHOLM = `
.......A.........
......MMm........
......MMmkk......
......MMm..kk....
......MMm....kk..
......MMm......k.
......MMm......W.
......MMm.....WWW
......MMm....WWWW
......MMm....LFLL
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
......MMm........
.....MMMmm.......
.....MMMmm.......
....MMMMmmm......
`;

/** T-bana sign: a blue disc with a white T on a grey post. */
export const METRO_STOCKHOLM = `
...nnnnn...
..nNNNNNn..
.nNwwwwwNn.
.nNwwwwwNn.
.nNNNwNNNn.
.nNNNwNNNn.
.nNNNwNNNn.
..nNNwNNn..
...nnnnn...
.....Mm....
.....Mm....
.....Mm....
.....Mm....
.....Mm....
.....Mm....
.....Mm....
.....Mm....
.....Mm....
.....Mm....
.....Mm....
.....Mm....
....MMmm...
`;

/** Cast-iron mooring bollard on the granite quays. */
export const BOLLARD_STOCKHOLM = `
.MMMm.
MMMMmm
.MMmm.
..Mm..
..Mm..
.MMMm.
MMMMmm
`;

/** Green street bin. */
export const BIN_STOCKHOLM = `
.AAAAA.
AdddddA
BBBBBbb
BBBBBbb
BBBBBbb
BAAAAAb
BBBBBbb
BBBBBbb
.BBBbb.
..mmm..
`;

/** Equestrian king on a granite plinth (bronze green). */
export const EQUESTRIAN = `
.........qq.........
........qQqq........
........qQq.........
.......qQQqq........
..qq...qQQqq........
.qQQq..qQqq.........
qQQQqqqQQqq.........
.qqQQQQQQQqqqqqqq...
...qQQQQQQQQQQQqqq..
...qQQQQQQQQQQQQqqq.
...qqQQqqqqqQQqqq.qq
...qq.qq....qq.qq..q
...qq..qq...qq..qq..
...q...q....q....q..
..qq...qq..qq....qq.
.tTTTTTTTTTTTTTTTSs.
..TTTTTTTTTTTTTTSSs.
..TTtTTTTTTTTTTTSSs.
..TTTTTTTTTTTTTTSSs.
..TTTTTTTTTTTTTTSSs.
..TTTTTTTTTTTTTTSSs.
.tTTTTTTTTTTTTTTSSs.
tTTTTTTTTTTTTTTTTSSs
`;

/** Graffiti on the ground: FIKA. */
export const TAG_FIKA = `
####.#.#..#..##..
#....#.#.#..#..#.
###..#.##...####.
#....#.#.#..#..#.
#....#.#..#.#..#.
`;
