/**
 * MILAN pixel grids (E3 South). Facade modules use the keys documented in bld/modules.grid.ts
 * (T/t/U stone trim, k/g/G glass, S/s persiane, I/i iron, D/d door, x ink, y brass, a/A awning,
 * n/N sign, m/M metal); prop grids the keys in props.grid.ts.
 * Hand-aligned — never reflow (Prettier-ignored).
 */

// ------------------------------------------------------------------------- facade modules --

/** Neoclassical window: flat moulded architrave and a little cornice on consoles. */
export const MIL_WIN = `
.UUUUUU.
.tTttTt.
.TkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.TkgggT.
.TkgggT.
.UTTTTt.
..w..w..
`;

/** Piano nobile: tall window with a straight pediment on consoles. */
export const MIL_WIN_TALL = `
UUUUUUUt
.tTttTt.
.TkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.TkgggT.
.TkgggT.
.TkgggT.
UTTTTTTt
`;

/** Top storey: small square window. */
export const MIL_WIN_SMALL = `
........
........
.UTTTTt.
.TkkkkT.
.TkGggT.
.TkgGgT.
.tTTTTt.
........
........
........
`;

/** Rationalist (1930s): flush square opening in stone cladding, steel frame, no shutters. */
export const MIL_WIN_RAZ = `
........
........
.ttttttt
.tkkkkkt
.tkGgggt
.tkgGggt
.tkggGgt
.tkkkkkt
.UUUUUUU
........
`;

/** Liberty: arched window with a floral keystone and a whiplash iron balconette. */
export const MIL_WIN_LIB = `
..UUUt..
.UkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.TkgggT.
IIiIIiII
iIi.iIi.
.iIiIi..
.UTTTTt.
`;

/** Persiane folded open (Milan grey-green), overlay. */
export const MIL_SHUT_OPEN = `
........
........
S......S
s......s
S......S
s......s
S......S
s......s
........
........
`;

/** Persiane closed, overlay. */
export const MIL_SHUT_CLOSED = `
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

/** Casa di ringhiera: door + window onto the ballatoio (the rail is painted across the bay). */
export const MIL_RINGHIERA = `
........
.UTTt...
.TDDT.Tt
.TDDT.kT
.TDdT.GT
.TDDT.gT
.TDhT...
.TDDT...
........
........
`;

/** Portone in a rusticated granite surround. */
export const MIL_PORTONE = `
UUUUUUUt
UTTTTTTt
TdDDDDdt
TdDdDDdt
TdDDDDdt
TdDdDDdt
TdDhDDdt
TdDdDDdt
TdDDDDdt
tttttttt
`;

/** Quadrilatero boutique (2 bays): black frame, brass name, dark awning, lit vitrine. */
export const MIL_BOUTIQUE = `
xxxxxxxxxxxxxxxx
xyxyyxyxxyyxyxxx
aaaaaaaaaaaaaaaa
.A.A.A.A.A.A.A.A
xkGgkkkcCkkxxDDx
xkgGkkcCckkxxDDx
xkkkkGkkkkGxxDhx
xkcCkgGkkkkxxDDx
xxxxxxxxxxxxxDDx
tttttttttttttttt
`;

/** Bar (2 bays): painted sign, glass front with the aperitivo counter. */
export const MIL_BAR = `
nnNnNNnNnNnNNnNn
TTTTTTTTTTTTTTTt
TkkGgkkTkkkkcCkt
TkGgkkcTkcCkkkkt
TgGkkcCTkcCkgGkt
TkkkkkkTkkkkGgkt
TTTTTTTTTTTTTTkt
TmmmmmmTDDDDTTkt
TMMMMMMTDDhDTTkt
tttttttttttttttt
`;

/** Shop shutter (saracinesca). */
export const MIL_SHUTTER = `
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

/** Barred ground-floor window in rusticated granite. */
export const MIL_GRATA = `
........
.UUUUUt.
.TkkkkT.
.TiIiIT.
.TiGiGT.
.TiIiIT.
.TigigT.
.TiIiIT.
.tTTTTt.
........
`;

/** Hanging tricolore (vertical bands c / C / r on the cloth), overlay. */
export const FLAG_IT = `
........
........
........
........
........
.x......
.ccCCrr.
.ccCCrr.
.ccCCrr.
.ccCCrr.
`;

// ---------------------------------------------------------------------------------- props --

/** Milan lamp: grey-green cast-iron post with the hexagonal "lanterna Milano". */
export const LAMP_MILAN = `
.....k.....
....kAk....
...MMMmm...
..MMMMMmm..
...MLLFm...
...MLFLm...
...MLLLm...
..MMMMMmm..
....Mmm....
....AAA....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
....MMm....
...MAMAm...
...MMMmm...
..MMMMMmm..
..MAMMAmm..
.MMMMMMmmm.
`;

/** Metropolitana Milanese: the "MM" totem with the red / green / yellow line colours. */
export const METRO_MILAN = `
CCCCCCCCCCCCC
CwCCCwCwCCCwC
CwwCwwCwwCwwC
CwCwCwCwCwCwC
CwCCCwCwCCCwC
CwCCCwCwCCCwC
CCCCCCCCCCCCC
CCCCGGGGGyyyy
.....kMm.....
.....kMm.....
.....kMm.....
.....kMm.....
.....kMm.....
.....kMm.....
.....kMm.....
.....kMm.....
.....kMm.....
.....kMm.....
.....kMm.....
....kMMmm....
`;

/** Panettone: the squat concrete dome bollard. */
export const PANETTONE = `
..SSSs..
.SSSSSs.
SSSSSSss
SSSSSSss
ssssssss
`;

/** AMSA bin: grey hoop holding a see-through bag. */
export const BIN_MILAN = `
.MMMMMM.
M666666m
M655566m
.65556..
.665566.
.666566.
..6666..
...MM...
...MM...
..MMmm..
`;
