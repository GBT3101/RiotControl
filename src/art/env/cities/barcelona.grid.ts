/**
 * BARCELONA pixel grids (E3 South). Facade modules use the keys documented in
 * bld/modules.grid.ts (T/t/U stone trim, f/F joinery, k/g/G glass, S/s persianes, I/i wrought
 * iron, D/d door, a/A awning, n/N sign); prop grids the keys in props.grid.ts.
 * Hand-aligned — never reflow (Prettier-ignored).
 */

// ------------------------------------------------------------------------- facade modules --

/** Balconera: tall glazed balcony door with painted wooden leaves (Eixample, every floor). */
export const BCN_DOOR = `
.UTTTTt.
.TffffT.
.TkkkfT.
.TGgkfT.
.TgGkfT.
.TkgkfT.
.TggkfT.
.TkkkfT.
.TffFfT.
.tTTTTt.
`;

/** Persiana de llibret: slatted blind let down, its foot pushed out over the rail. */
export const BCN_PERSIANA = `
........
.sSSSSs.
..SSSS..
..ssss..
..SSSS..
..ssss..
.SSSSSS.
.ssssss.
........
........
`;

/** Persiana rolled right up into a bundle under the lintel. */
export const BCN_PERSIANA_UP = `
........
.sSSSSs.
..ssss..
........
........
........
........
........
........
........
`;

/** Wrought-iron balcony with a stone slab on little brackets (overlay, rows 6–9). */
export const BCN_BALCONY = `
........
........
........
........
........
........
IIIIIIII
iIi.iIi.
i.iIi.iI
UTTTTTTt
`;

/** Modernista balcony: whiplash-curved iron, bellied front (overlay). */
export const BCN_BALCONY_MOD = `
........
........
........
........
........
.IIIIII.
IiIiiIiI
I.ii.i.I
.IiIIiI.
UTTTTTTt
`;

/** Entresòl: low mezzanine window. */
export const BCN_WIN_SMALL = `
........
........
........
.UTTTTt.
.TkkkkT.
.TkGggT.
.TkgGgT.
.tTTTTt.
........
........
`;

/** Ciutat Vella: narrow window in thick dark stone, little iron balcony. */
export const BCN_GOTHIC = `
........
..UTTt..
..TkkT..
..TGkT..
..TgGT..
..TkgT..
..TggT..
.IIIIII.
.i.ii.i.
.tTTTTt.
`;

/** Eixample portal: arched wooden entrance with an iron fanlight. */
export const BCN_PORTAL = `
.UTTTTt.
UTiIiITt
TdIiIidt
TdDDDDdt
TdDdDDdt
TdDDDDdt
TdDhDDdt
TdDdDDdt
TdDDDDdt
tttttttt
`;

/** Modernista shop (2 bays): carved dark-wood front, gilded name, rounded shoulders. */
export const BCN_SHOP = `
.nnnnnnnnnnnnnn.
nNnNNnNnnNnNNnNn
nnnnnnnnnnnnnnnn
nkkkkkkkkknDDDDn
nkGgkcCkkknDddDn
ngGkkcCkGknDhDDn
nkgkkkkkgGnDDDDn
nkkkkkkkkknDdDDn
nnnnnnnnnnnDDDDn
tttttttttttttttt
`;

/** Bar / bodega (2 bays): awning, folding glass doors open to the street. */
export const BCN_BAR = `
nNnNNnNnNnNNnNnn
aaaaaaaaaaaaaaaa
AAAAAAAAAAAAAAAA
TkkkkkTkkkkkTDDt
TkGgcCTkcCGgTDdt
TgGkcCTkcCgGTDht
TkkkkkTkkkkkTDDt
TkkkkkTkkkkkTDDt
TTTTTTTTTTTTTDDt
tttttttttttttttt
`;

/** Metal roller shutter (persiana metàl·lica) — canvas for the street painters. */
export const BCN_SHUTTER = `
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

/** Barred window (reixa) of an old-town ground floor. */
export const BCN_REIXA = `
........
..UTTt..
..TkkT..
..IiIT..
..iGiT..
..IiIT..
..igiT..
..IiIT..
.tTTTTt.
........
`;

// ---------------------------------------------------------------------------------- props --

/** Modernista lamp (after Falqués): dark iron post, scrolled arms, two crowned lanterns. */
export const LAMP_BCN = `
..k.......k..
.kAk.....kAk.
MMMmm...MMMmm
.MLFm...MLFm.
.MLLm...MLLm.
..Mm.....Mm..
...MM...Mm...
....MMAMm....
.....AAA.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
....MAMAm....
.....MMm.....
....MMMmm....
...MAMMmAm...
...MMMMmmm...
..MMMMMmmmm..
`;

/** Metro: red diamond with a white M on a tall post. */
export const METRO_BCN = `
......c......
.....cCc.....
....cCCCc....
...cCCCCCc...
..cCwCCCwCc..
.cCCwwCwwCCc.
cCCCwCwCwCCCc
.cCCwCCCwCCc.
..cCwCCCwCc..
...cCCCCCc...
....cCCCc....
.....cCc.....
......c......
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
......Mm.....
.....MMmm....
`;

/** Bollard (pilona): dark cast iron with a rounded head. */
export const BOLLARD_BCN = `
.Mm.
MMmm
.Mm.
AAAA
MMmm
MMmm
MMmm
MMmm
`;

/** Font de Canaletes: cast-iron lamp-post fountain, four lanterns, spouts over a basin. */
export const CANALETES = `
...k.....k...
..kAk...kAk..
..MLm.k.MLm..
..MFm.A.MFm..
...M.MMm.m...
....MMMmm....
.....AAA.....
.....MMm.....
.....MMm.....
.....MMm.....
.....AAA.....
.....MMm.....
.....MMm.....
....MAMAm....
...UMMMmmU...
...U.MMm.U...
..MMMMMmmmm..
..MAMAMAmAm..
..MMMMMmmmm..
.SSSSSSSsss..
`;
