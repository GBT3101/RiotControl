/**
 * ROME pixel grids (E3 South). Facade modules use the keys documented in bld/modules.grid.ts
 * (T/t/U travertine trim, k/g/G glass, S/s green persiane, D/d door, I/i iron, a/A awning,
 * n/N sign, m/M metal shutter, w/W wall shade/light); prop grids the keys in props.grid.ts.
 * Hand-aligned — never reflow (Prettier-ignored).
 */

// ------------------------------------------------------------------------- facade modules --

/** Window in a travertine frame with a little lintel cornice and a sill (8×10). */
export const ROM_WIN = `
........
.UUUUUt.
.tTTTTt.
.TkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.TkgggT.
UTTTTTTt
.wwwwww.
`;

/** Piano nobile: tall window under a triangular pediment (overlays: *_TALL). */
export const ROM_WIN_PED = `
...UT...
..UwwT..
.UwwwwT.
UTTTTTTt
.TkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.TkgggT.
UTTTTTTt
`;

/** Piano nobile: tall window under a segmental (curved) pediment. */
export const ROM_WIN_SEG = `
..UUTt..
.UwwwwT.
UTTTTTTt
.tTTTTt.
.TkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.TkgggT.
UTTTTTTt
`;

/** Attic window under the cornice: small, square. */
export const ROM_WIN_SMALL = `
........
........
.UTTTTt.
.TkkkkT.
.TkGggT.
.TkgGgT.
.tTTTTt.
..wwww..
........
........
`;

/** Green persiane folded open against the wall, either side of the frame. */
export const ROM_SHUT_OPEN = `
........
........
S......S
S......S
s......s
S......S
s......s
S......S
s......s
........
`;

/** Persiane closed over the opening: two louvred leaves meeting in the middle. */
export const ROM_SHUT_CLOSED = `
........
........
.SSSsSS.
.ssssss.
.SSSsSS.
.ssssss.
.SSSsSS.
.ssssss.
........
........
`;

/** One leaf closed, the other folded open (someone peeking out at the riot). */
export const ROM_SHUT_HALF = `
........
........
.SSS...S
.sss...S
.SSS...s
.sss...S
.SSS...s
.sss...S
.......s
........
`;

/** Tall-window persiane, open. */
export const ROM_SHUT_OPEN_TALL = `
........
........
........
S......S
S......S
s......s
S......S
s......s
S......S
s......s
`;

/** Tall-window persiane, closed. */
export const ROM_SHUT_CLOSED_TALL = `
........
........
........
........
.SSSsSS.
.ssssss.
.SSSsSS.
.ssssss.
.SSSsSS.
........
`;

/** Travertine balustrade on the piano nobile (overlay, rows 7–9). */
export const ROM_BALUSTRADE = `
........
........
........
........
........
........
........
UUUUUUUt
TtUtUtUt
tTTTTTTt
`;

/** Plain iron balcony rail (overlay). */
export const ROM_RAIL = `
........
........
........
........
........
........
........
IIIIIIII
i.i..i.i
tTTTTTTt
`;

/** Geraniums in terracotta pots on the sill (overlay). */
export const ROM_GERANIUMS = `
........
........
........
........
........
........
.PpP.pP.
.eee.ee.
........
........
`;

/** Washing line strung across the window (Trastevere), overlay. */
export const ROM_WASHING = `
........
........
........
xxxxxxxx
.cc.CC.c
.cc.CC..
..c.C...
........
........
........
`;

/** Portone: big walnut carriage door in a rusticated travertine arch. */
export const ROM_PORTONE = `
..UUTt..
.UTddTt.
UTdDDdTt
TdDdDDdt
UdDdDDdt
TdDDDDdt
tdDhDDdt
UdDdDDdt
TdDDDDdt
tttttttt
`;

/** Bottega (2 bays): travertine frame, painted name, serranda half up, display window. */
export const ROM_BOTTEGA = `
TTTTTTTTTTTTTTTt
TnNnNNnNnnNnNNnt
TTTTTTTTTTTTTTTt
TmMmMmMmTkkkkkkt
TMmMmMmMTkGgcCkt
TmMmMmMmTgGkcCkt
TkkkkkkkTkkkkkkt
TkGgcCkkTggGkkkt
TkgGcCkkTkgGkkkt
tttttttttttttttt
`;

/** Bar / trattoria (2 bays): plain canvas awning with a valance, glass front and door. */
export const ROM_BAR = `
nnNnNnNNnNnnNnNn
aaaaaaaaaaaaaaaa
aAaAaAaAaAaAaAaA
.a.a.a.a.a.a.a.a
TkkGgkkcCkkTDDDt
TkGgkkkcCkkTDdDt
TgGkkcCkkGkTDhDt
TggkkcCkgGkTDdDt
TTTTTTTTTTTTDDDt
tttttttttttttttt
`;

/** Ground-floor window behind an iron grille (inferriata), travertine frame. */
export const ROM_GRATA = `
........
.UUUUUt.
.TkkkkT.
.IiIiIT.
.TiGiGT.
.IiIiIT.
.TigigT.
.IiIiIT.
UTTTTTTt
........
`;

/** Closed serranda (metal roller shutter) of a shop or garage. */
export const ROM_SERRANDA = `
TTTTTTTt
TmmmmmmT
TMMMMMMT
TmmmmmmT
TMMMMMMT
TmmmmmmT
TMMMMMMT
TmmmmmmT
TMMMMMMT
tttttttt
`;

// ---------------------------------------------------------------------------------- props --

/** Roman lamp: dark cast-iron post, curved pastorale arm, hanging lantern. */
export const LAMP_ROME = `
.......MMMm..
......M...mm.
.....M.....m.
.....M....kAk
.....M....MMm
....MMm..MLFm
.....Mm..MLLm
.....Mm...MLm
.....Mm....k.
.....Mm......
.....AA......
.....Mm......
.....Mm......
.....Mm......
.....Mm......
.....Mm......
.....Mm......
.....Mm......
.....Mm......
.....Mm......
.....Mm......
....MMmm.....
....AAAA.....
....MMmm.....
...MMMMmm....
`;

/** Metropolitana di Roma: red square with a white M on a grey post. */
export const METRO_ROME = `
cCCCCCCCc
CwwCCCwwC
CwwwCwwwC
CwCwwwCwC
CwCCwCCwC
CwCCCCCwC
CwCCCCCwC
ccccccccc
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

/** AMA litter bin: grey drum with a green band and a tiny SPQR plate. */
export const BIN_ROME = `
.AAAAA.
AdddddA
BBBBBbb
BwBwBbb
AAAAAAb
BBBBBbb
BBBBBbb
BBBBBbb
.BBBbb.
..mmm..
`;

/** Dissuasore: dark cast-iron bollard with a travertine-white ring. */
export const BOLLARD_ROME = `
.Mm.
MMmm
AAAA
MMmm
MMmm
MMmm
MMmm
MMmm
`;

/** Il nasone: the cast-iron street drinking fountain with its bent "nose" spout. */
export const NASONE = `
..kMMk...
.MMMMmm..
.MMMMmm..
.MAMMmm..
.MMMMmmkk
.MMMMmmMm
.MMMMmm.U
.MMMMmm.U
.MMMMmm...
.MMMMmm...
.MMMMmm...
MMMMMmmm..
ssSSSSss..
.ssssss...
`;

/** Umbrella-pine canopy mask (# leaves, flat crown) for the hand-built pines. */
export const PINE_CROWN = `
.......#####....######......
....###########.#########...
..########################..
.###########################
############################
.##########################.
...######.####...########...
`;
