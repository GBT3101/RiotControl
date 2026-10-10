/**
 * Hand-authored prop grids (M3a). Drawn without outline (auto coloured outline is added);
 * light from the upper left. Shared keys (see props.ts PROP_KEYS):
 *   k ink · 1–7 gray ramp · w white · z/Z/x zinc · s/S/t/T stone · e/E/b earth/wood
 *   r/R rust · c/C crimson · o/O/y/Y ochre · g/G/h/H/l greens · n/N/B/u/U blues · q/Q teal
 *   p pink · v purple
 * City-themed keys: M metal (lit) · m metal (shade) · A accent (gilding) · L lantern glass
 * (lit at night) · F lantern glass highlight.
 */

// City props (streetlamps, metro signs, city bins & bollards) live in cities/<city>.grid.ts.

// ------------------------------------------------------------------------- street furniture --

/** Litter bin. B = body, b = body shade, A = band/accent, d = dark mouth. */
export const BIN = `
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

/** Red K6 telephone box face details are rasterised; this is the London pillar box. */
export const POSTBOX = `
..kkkk..
.cCCCcck
cCCCCcck
kkkkkkkk
CCCCCccc
CkkkkkCc
CCCCCccc
CCAACccc
CCAACccc
CCCCCccc
CCCCCccc
CCCCCccc
CCCCCccc
kkkkkkkk
`;

/** Fire hydrant (cast iron, city colour 'M'). */
export const HYDRANT = `
..AA..
.MMMm.
.MMMm.
MMMMmm
.MMMm.
AMMMmA
.MMMm.
.MMMm.
MMMMmm
`;

/** Bollard (city colour, gilded/white band). */
export const BOLLARD = `
.Mm.
MMmm
MMmm
AAAA
MMmm
MMmm
MMmm
MMmm
`;

/** Traffic cone. */
export const CONE = `
..R..
..Rr.
.wwW.
.RRr.
.RRrr
wwwWW
RRRrr
eeeee
`;

/** Traffic light: pole + 3-lamp head (L slot recoloured per frame: red / amber / green). */
export const TRAFFIC_LIGHT = `
.kkkk.
k2222k
k2RR2k
k2222k
k2OO2k
k2222k
k2GG2k
k2222k
.kkkk.
..MM..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
.MMmm.
`;

// --------------------------------------------------------------------------------- road signs --

export const SIGN_NOENTRY = `
.cccc.
cCCCCc
CwwwwC
CwwwwC
cCCCCc
.cccc.
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
.MMmm.
`;

export const SIGN_ONEWAY = `
NNNNNN
NwwwNN
NNwwwN
NwwwNN
NNNNNN
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
.MMmm.
`;

export const SIGN_YIELD = `
cCCCCc
.CwwC.
.CwwC.
..CC..
......
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
.MMmm.
`;

export const SIGN_PARKING = `
BBBBBB
BwwwBB
BwBBwB
BwwwBB
BwBBBB
BBBBBB
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
..Mm..
.MMmm.
`;

// ------------------------------------------------------------------------------- Paris kit --

/** Morris column: green dome, poster drum. P = posters (recoloured per variant). */
export const MORRIS = `
.....GG.....
....GGgg....
...GGGGgg...
..GGGGGggg..
.GGGGGGgggg.
AAAAAAAAAAAA
.GGGGGGgggg.
.wpppyyyBBg.
.wpPpyYyBBg.
.wppPyyyBBg.
.cCCwwwwnng.
.cCCwWwwnng.
.cCCwwWwnng.
.cCCwwwwnng.
.yyyCCcwwwg.
.yYyCCcwwwg.
.yyyCCcwWwg.
.yyyCCcwwwg.
.GGGGGGgggg.
.GGGGGGgggg.
GGGGGGGggggg
`;

/** Wallace fountain: green cast iron, dome on four caryatids, basin. */
export const WALLACE = `
....GG....
...GGgg...
..GGGGgg..
.GGGGGGgg.
GAAAAAAAAg
.G.G..g.g.
.G.GG.gg..
.GGG..ggg.
.G.G..g.g.
.GG.GG.gg.
.G.G..g.g.
..GGGGgg..
...GGgg...
...GGgg...
..GGGGgg..
.GGGGGGgg.
GGGGGGGggg
`;

// --------------------------------------------------------------------------------- statues --

/** Bronze orator on a stone plinth (arm raised). */
export const STATUE = `
.....qq.....
....qQqq....
....qQqq.qq.
...qqQqqqq..
..qQQqqqq...
..qQqqqq....
...qQqqq....
...qQqqq....
...qQqqq....
...qq.qq....
...qq.qq....
..qqq.qqq...
.tTTTTTTSSs.
..TTTTTSSs..
..TTTTTSSs..
..TtTTTSSs..
..TTTTTSSs..
..TTTTTSSs..
..TTTTTSSs..
.tTTTTTTSSs.
tTTTTTTTSSSs
`;

// ------------------------------------------------------------------------------- vehicles ----

/** Bicycle, frame along i (rear wheel upper-left). F = frame colour. */
export const BIKE = `
.......kk...
.....FFk....
..kkFF.F.kk.
.k..kFFFk..k
k..k.kF.k...
k..k..kk...k
.kk....k..k.
........kk..
`;

/** Scooter (Vespa-style), along i. F = body colour, f = shade. */
export const SCOOTER = `
.........kk.
........kFk.
...kkk..Fk..
..FFFFFFFf..
.FFFFFFFFf..
kFFFFffFFFk.
.kkkFffkFkk.
k.k.k..k.k.k
.kkk....kkk.
`;

// --------------------------------------------------------------------------------- flags -----

/** Flag pole (flag cloth is painted per frame by code). */
export const FLAGPOLE = `
A
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
M
m
`;

// -------------------------------------------------------------------------------- pigeons ----

/** Pigeon idle (2 frames: head bob). */
export const PIGEON_IDLE = `
..5k...
.556...
..65...
.q556..
.v5556.
..44554
...4...

.......
..5k...
.556...
.q65...
.v5556.
..44554
...4...
`;

/** Pigeon pecking (3 frames). */
export const PIGEON_PECK = `
..5k...
.556...
..65...
.q556..
.v5556.
..44554
...4...

.......
.......
.......
.q5555.
k56556.
.544554
...4...

.......
.......
.......
..5555.
.q6556.
k544554
...4...
`;

/** Pigeon flying (3 frames: wings up, level, down). */
export const PIGEON_FLY = `
..5...5..
..55.55..
...5555..
.k5655...
..q565...
....44...
.........

.........
.........
.555.555.
k5656555.
.q55554..
.........
.........

.........
.........
.k56555..
..q5555..
.555.555.
.55...55.
.........
`;

// ----------------------------------------------------------------------------- small stuff ---

export const LITTER_CAN = `
.Rr.
wRrk
.Rr.
`;
export const LITTER_PAPER = `
.ww6.
w6ww6
.w66.
`;
export const LITTER_BAG = `
..k..
.444.
44434
.433.
`;
