/**
 * VIENNA pixel grids (E3 Central). Facade modules use the keys of bld/modules.grid.ts; the
 * 10-px-wide modules span a whole bay (stamped one px left of the bay's window origin) and carry
 * the pilasters on their outer columns (W lit, w shaded). Prop grids use the keys of
 * props.grid.ts. Hand-aligned — never reflow (Prettier-ignored).
 */

// ------------------------------------------------------------------------- facade modules --

/** Gründerzeit box window (Kastenfenster): straight hood, transom cross, sill on consoles. */
export const VIE_WIN = `
WUUUUUUUUw
W.tttttt.w
W.TfffffTw
W.TkGfkkTw
W.TfffffTw
W.TkgfGkTw
W.TGgfkgTw
W.TkgfggTw
W.UUUUUUUw
W..t...t.w
`;

/** Beletage window with a triangular pediment. */
export const VIE_WIN_PED = `
W....UU..w
W..UUttU.w
WUUUUUUUUw
W.TkGfkkTw
W.TfffffTw
W.TkgfGkTw
W.TGgfkgTw
W.TkgfggTw
W.TkgfgkTw
WUUUUUUUUw
`;

/** Beletage window with a segmental pediment. */
export const VIE_WIN_SEG = `
W..UUUU..w
W.UttttU.w
WUUUUUUUUw
W.TkGfkkTw
W.TfffffTw
W.TkgfGkTw
W.TGgfkgTw
W.TkgfggTw
W.TkgfgkTw
WUUUUUUUUw
`;

/** Balcony door behind a stone balustrade (Beletage of the palais). */
export const VIE_BALDOOR = `
W....UU..w
W..UUttU.w
WUUUUUUUUw
W.TkGfkkTw
W.TfffffTw
W.TkgfGkTw
WUUUUUUUUw
W.TtTtTtTw
W.TtTtTtTw
WttttttttW
`;

/** Attic window under the cornice, with a frieze panel. */
export const VIE_WIN_SMALL = `
W........w
WUUUUUUUUw
W.TfffffTw
W.TkGfkkTw
W.TkgfgkTw
W.UUUUUUUw
W........w
W..tttt..w
W........w
W........w
`;

/** Arched portal with rusticated voussoirs and a fanlight (8 px). */
export const VIE_DOOR = `
.tUUUUt.
tUkGkkUt
UkkkkkkU
TffffffT
TDDdDDdT
TDdDDdDT
TDDdhDdT
TDdDDdDT
TDDdDDdT
tttttttt
`;

/** Round-headed ground-floor window in the rustication. */
export const VIE_GWIN = `
........
..UUUU..
.UkkkkU.
.TkGfkT.
.TkgfGT.
.TggfkT.
.TkgfgT.
.UUUUUU.
..t..t..
........
`;

/** Kaffeehaus front (2 bays): dark wood, gilt lettering, awning, café curtains on brass rods. */
export const VIE_CAFE = `
nnnnnnnnnnnnnnnn
nNnNNnNnnNNnNnNn
aaAAaaAAaaAAaaAA
.a..A..a..A..a..
DkkGgkkDkkgGkDdD
DcccccchcccccDhD
DcGgcckDccgGcDdD
DckggckDckggcDdD
DDDDDDDDDDDDDDdD
tttttttttttttttt
`;

/** Shop in a stone portal (2 bays): black-and-gilt fascia, display window, door. */
export const VIE_SHOP = `
TTTTTTTTTTTTTTTT
TnnnnnnnnnnnnnnT
TnNnNNnNnNNnNnnT
TnnnnnnnnnnnnnnT
TfkkGgkcCkkfDDfT
TfkGgkcCckkfDdfT
TfgkkkkkGgkfDhfT
TfkkkkkkgGkfDDfT
TfffffffffffDDfT
tttttttttttttttt
`;

/** Austrian flag hung from a window (keys 1 red, 2 white). */
export const VIE_FLAG = `
........
........
........
........
........
........
.x......
.111111.
.222222.
.111111.
........
`;

// ---------------------------------------------------------------------------------- props --

/** Ringstraße candelabra: tall grey-green post, cross arm with two hanging lanterns. */
export const LAMP_VIENNA = `
......A......
......M......
..MMMMMMmmm..
.M....M....m.
MMmm..M..MMmm
MLFm..M..MLFm
MLLm..M..MLLm
.Mm...M...Mm.
..m...M...m..
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
.....AMm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
.....MMmm....
....AAAAA....
....MMMmm....
...MMMMmmm...
..MMMMMmmmm..
`;

/** U-Bahn cube on a pole: white U on blue, the line colour band below (U2 purple). */
export const METRO_VIENNA = `
....uu....
..uuuuuu..
NNuuuuuuBB
NNNNuuBBBB
NwNwNBwBwB
NwNwNBwBwB
NwwwNBwwwB
NNNNNBBBBB
vvvvvvvvvv
..NNNBBB..
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

/** Vienna litter bin (orange, "Mistkübel") on its post. */
export const BIN_VIENNA = `
.BBBBB.
BdddddB
BBBBBbb
BAAAAAb
BBBBBbb
BBBBBbb
.BBBbb.
..mmm..
..Mm...
..Mm...
.MMmm..
`;

/** Rearing equestrian bronze (Heldenplatz) on a tall plinth. */
export const EQUESTRIAN_VIENNA = `
.........Qq.......
.........QQ.......
........qQQq......
..QQ....QQQq......
.QQQq..qQqq.......
.qQQQQqQQqq.......
...qQQQQQQqq......
..Q..qQQQQQqqq....
.Q.....QQQQQqqqq..
........qQQqqq.qq.
.........Qq.q...q.
........Qq..q.....
.......qq...qq....
.WWWWWWWWWWWWWWWS.
.TTTTTTTTTTTTTTSs.
..TTTTTTTTTTTTSs..
..TTtTTTTTTTTTSs..
..TTTTTTTTTTTTSs..
..TTTTTTTTTtTTSs..
..TTTTTTTTTTTTSs..
.TTTTTTTTTTTTTTSs.
WWWWWWWWWWWWWWWWSs
TTTTTTTTTTTTTTTTSs
`;

/** Marble monument: robed figure on a pedestal with a cornice. */
export const STATUE_VIENNA = `
..t........
..T.TT.....
..T.Tt.....
..TtTTt....
...TTTTt...
...TTTTtT..
...TTTtt.t.
...TTTtt...
..tTTTTtt..
..TTTTTtt..
.tTTTTTTtt.
.WWWWWWWWS.
.SSSSSSSSs.
..TTTTTSs..
..TtTTTSs..
..TTTTTSs..
..TTTTTSs..
.WWWWWWWSs.
WWWWWWWWWSs
TTTTTTTTTSs
`;
