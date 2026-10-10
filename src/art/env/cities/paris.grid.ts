/**
 * PARIS pixel grids (E0: moved verbatim from bld/modules.grid.ts and props.grid.ts).
 * Facade modules use the keys documented in bld/modules.grid.ts; prop grids the keys in
 * props.grid.ts. Hand-aligned — never reflow (Prettier-ignored).
 */

// ------------------------------------------------------------------------- facade modules --

/** Haussmann French window: moulded surround with a little hood. */
export const PAR_WIN = `
.tUUUUt.
.TttttT.
.TkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.TkgggT.
.TkgggT.
.TfFFfT.
.UUUUUt.
`;

/** Balconnet (individual cast-iron guard, overlay). */
export const PAR_BALCONNET = `
........
........
........
........
........
........
.IIIIII.
.iIi.Ii.
.iiiiii.
........
`;

/** Closed persiennes (grey folding shutters, overlay). */
export const PAR_PERSIENNES = `
........
........
..SSSS..
..ssss..
..SSSS..
..ssss..
..SSSS..
..ssss..
..SsSS..
........
`;

/** Paris café front (2 bays): striped awning, gilded name, terrace glazing. */
export const PAR_CAFE = `
nNnNNnNnNNnNnNNn
AaAaAaAaAaAaAaAa
AaAaAaAaAaAaAaAa
.A.a.A.a.A.a.A.a
fkkGgkfkkGgkfDDf
fkGgkcfkGgkkfDhf
fgkkcCfgkkkcfDDf
fffffffffffffDDf
nnnnnnnnnnnnfDDf
tttttttttttttttt
`;

/** Paris boutique / boulangerie: painted wooden front with gilded lettering. */
export const PAR_SHOP = `
nnnnnnnnnnnnnnnn
nNnNNnNnNnNNnNnn
nnnnnnnnnnnnnnnn
nkkGgkkcCkknkDDn
nkGgkkcCckknkDDn
ngkkkkkkGgknkDhn
nkkkkkkkgGknkDDn
nnnnnnnnnnnnkDDn
nNnnNnnNnnnnkddn
tttttttttttttttt
`;

/** Porte cochère: tall arched carriage door. */
export const PAR_DOOR = `
.tUUUUt.
.UdDDdT.
.TDDDDT.
.TDdDDT.
.TDdDDT.
.TDDDDT.
.TDdhDT.
.TDdDDT.
.TDDDDT.
tttttttt
`;

// ---------------------------------------------------------------------------------- props --

/** Paris lamp: green cast iron, lantern on a scrolled bracket, fluted shaft. */
export const LAMP_PARIS = `
.....k.....
....kMk....
...MMMmm...
..MMMMMmm..
...MLFLm...
...MLLFm...
...MLLLm...
...mMMmm...
....MMm....
..MM.M.mm..
.M...M...m.
.M..MMm..m.
..M.MMm.m..
....MMm....
....MMm....
....AAA....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
...MMMmm...
...AAAAA...
...MMMmm...
..MMMMmmm..
..MmMmMmm..
.MMMMMmmmm.
`;

/** Paris litter bin: green hoop with grey bag. */
export const BIN_PARIS = `
.MMMMM.
M66666m
M65556m
.65556.
.65556.
.66556.
.66655.
..666..
..MMm..
..MMm..
.MMMmm.
`;

/** Paris potelet (ball-topped). */
export const BOLLARD_PARIS = `
.Mm.
MMmm
.Mm.
.Mm.
.Mm.
.Mm.
.Mm.
MMmm
`;

/** Paris Guimard entrance: green cast-iron arch, orange lamps, "METROPOLITAIN" plate. */
export const METRO_PARIS = `
.OY..................YO.
.YO..................OY.
..GG................gg..
...G.GGGGGGGGGGGGGG.g...
...GGywwywwywwywwywGg...
...G.GGGGGGGGGGGGGG.g...
...G................g...
...G................g...
...G................g...
...G................g...
...G................g...
...G................g...
..GGG..............ggg..
..GGG..............ggg..
.GGGGG............ggggg.
`;
