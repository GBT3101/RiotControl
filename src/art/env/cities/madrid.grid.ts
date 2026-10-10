/**
 * MADRID pixel grids (E0: moved verbatim from bld/modules.grid.ts and props.grid.ts).
 * Facade modules use the keys documented in bld/modules.grid.ts; prop grids the keys in
 * props.grid.ts. Hand-aligned — never reflow (Prettier-ignored).
 */

// ------------------------------------------------------------------------- facade modules --

/** French balcony door (balcón) — frame colour 'f' varies (white, green, brown). */
export const MAD_DOOR = `
........
.UTTTTt.
.TttttT.
.TkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.TfFfFT.
.TfFfFT.
.tTTTTt.
`;

/** Smaller window (top floor / back streets). */
export const MAD_WIN = `
........
........
.UTTTTt.
.TkkkkT.
.TkGggT.
.TkgGgT.
.TkggGT.
.tTTTTt.
..wwww..
........
`;

/** Wrought-iron balcony (overlay, rows 6–9). */
export const MAD_BALCONY = `
........
........
........
........
........
........
.IIIIII.
.i.ii.i.
.iiiiii.
..tTTt..
`;

/** Roll-up persiana half down (overlay). */
export const MAD_BLIND_HALF = `
........
........
........
..SSSS..
..ssss..
..SSSS..
..ssss..
........
........
........
`;

/** Persiana fully down. */
export const MAD_BLIND_FULL = `
........
........
........
..SSSS..
..ssss..
..SSSS..
..ssss..
..SSSS..
..ssss..
........
`;

/** Madrid shopfront (2 bays): sign, scalloped awning, shop window, door. */
export const MAD_SHOP = `
nnNnNNnnNnNnnNNn
aaAAaaAAaaAAaaAA
aaAAaaAAaaAAaaAA
a.Aa.Aa.Aa.Aa.Aa
tkkkkkkkkkkfDDDt
tkGgcckcgkkfDdDt
tgGkkcCkkGkfDhDt
tggkkkkkgGkfDdDt
tffffffffffftttt
tttttttttttttttt
`;

/** Bar / taberna front: tiled dado, wooden frames, small awning. */
export const MAD_BAR = `
nNNnNnNNnNnnNNnn
aAaAaAaAaAaAaAaA
.a.a.a.a.a.a.a.a
tFDDDFkkGgkkkkFt
tFDhDFkGgkckkkFt
tFDDDFkgkkCkkGFt
tFDDDFfffffffffT
tFDDDFrUrUrUrUrt
tFDDDFUrUrUrUrUt
tttttttttttttttt
`;

/** Portal: big wooden street door with stone surround. */
export const MAD_PORTAL = `
........
.UTTTTt.
.TddddT.
.TdDDdT.
.TdDDdT.
.TddddT.
.TdDDdT.
.TdDhdT.
.TdDDdT.
.tttttt.
`;

/** Roll-down metal shutter (closed shop / garage). */
export const MAD_ROLLER = `
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

/** Barred ground-floor window (reja). */
export const MAD_REJA = `
........
.UTTTTt.
.TkkkkT.
.IiIiIT.
.TiGiGT.
.IiIiIT.
.TigigT.
.IiIiIT.
.tTTTTt.
........
`;

// ---------------------------------------------------------------------------------- props --

/** Madrid "fernandina": cast-iron post, ringed shaft, four-pane lantern with crown. */
export const LAMP_MADRID = `
....k....
...kAk...
..kMMmk..
.MMMMMmm.
..MLFLm..
..MLLFm..
..MLLLm..
..MLLLm..
.MMMMMmm.
..mMMmm..
...MMm...
...AAA...
...MMm...
...MMm...
...MMm...
...MMm...
..MMMmm..
...MMm...
...MMm...
...MMm...
...MMm...
...MMm...
..AAAAA..
..MMMmm..
..MMMmm..
.MMMMmmm.
.MMMMmmm.
MMMMMmmmm
`;

/** Madrid "Metro" red diamond on a post. */
export const METRO_MADRID = `
....cc....
...cCCc...
..cCwwCc..
.cCwCCwCc.
cCCwwwwCCc
.NNNNNNNN.
.NwwwwwwN.
.NNNNNNNN.
..cCwwCc..
...cCCc...
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
