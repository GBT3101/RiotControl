/**
 * BUDAPEST pixel grids (E3 Central). Facade modules use the keys of bld/modules.grid.ts plus the
 * city keys resolved in budapest.ts: 1 2 3 = Zsolnay ceramic (green, ochre, brown), 4 = ceramic
 * highlight. Prop grids use the keys of props.grid.ts. Hand-aligned — never reflow
 * (Prettier-ignored).
 */

// ------------------------------------------------------------------------- facade modules --

/** Pest double box window (kapcsolt ablak): hood cornice, T-mullion, sill on consoles. */
export const BUD_WIN = `
UUUUUUUU
.tttttt.
.TkkfkkT
.TfffffT
.TkGfkkT
.TGgfkgT
.TggfGgT
.TkgfggT
.UUUUUUU
..t...t.
`;

/** Piano-nobile window with a triangular pediment. */
export const BUD_WIN_PED = `
...UUt..
.UUTTTt.
UUUUUUUt
.TkkfkkT
.TfffffT
.TkGfkkT
.TGgfkgT
.TggfGgT
.TkgfggT
.UUUUUUU
`;

/** Piano-nobile window with a segmental hood. */
export const BUD_WIN_SEG = `
..UUUU..
.UTTTTt.
UUUUUUUt
.TkkfkkT
.TfffffT
.TkGfkkT
.TGgfkgT
.TggfGgT
.TkgfggT
.UUUUUUU
`;

/** Balcony door (opening to the floor; the balcony overlay covers its foot). */
export const BUD_BALDOOR = `
UUUUUUUU
.tTTTTTt
.TfffffT
.TkGfgkT
.TkgfGkT
.TkgfgkT
.TkgfgkT
.TGgfgkT
.TfffffT
.TfffffT
`;

/** Wrought-iron balcony on a stone slab (overlay). */
export const BUD_BALCONY = `
........
........
........
........
........
........
IIIIIIII
i.IiiI.i
iIi..iIi
tUUUUUUt
`;

/** Attic / frieze-storey window. */
export const BUD_WIN_SMALL = `
........
UUUUUUUU
.TfffffT
.TkGfgkT
.TkgfgkT
.TfffffT
.UUUUUUU
..t...t.
........
........
`;

/** Secession window: rounded head, ceramic tile band under the sill. */
export const BUD_SEC_WIN = `
..UUUU..
.UtttttU
.TfffffT
.TkGfgkT
.TkgfGkT
.TkgfgkT
.TGgfgkT
.TfffffT
.UUUUUUU
.1213121
`;

/** Secession ceramic panel between storeys (overlay on the wall above a window). */
export const BUD_SEC_TILES = `
.2.4.2..
21232124
.2.3.2..
........
........
........
........
........
........
........
`;

/** Arched carriage gate (kapu) into the courtyard (gangház): fanlight over a panelled door. */
export const BUD_GATE = `
..UUUU..
.UtkktU.
UtkGkktU
TdDDdDDT
TdDdDdDT
TdDDdDDT
TdDhdDDT
TdDdDdDT
TdDDdDDT
tttttttt
`;

/** Barred ground-floor window. */
export const BUD_GRILLE = `
........
UUUUUUUU
.TfffffT
.TiGiGiT
.TIIIIIT
.TigikiT
.TikiGiT
.TIIIIIT
.UUUUUUU
........
`;

/** Rolled-down shop shutter. */
export const BUD_ROLLER = `
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

/** Pasted-up posters (ruin-bar flyers) on the ground floor (overlay). */
export const BUD_POSTERS = `
........
........
........
.cc..CC.
.cx..CC.
.cc..Cx.
.cc.....
...PPP..
...PxP..
...PPP..
`;

/** Pest shopfront in a stone portal (2 bays): fascia, display window, door with transom. */
export const BUD_SHOP = `
TTTTTTTTTTTTTTTT
TnnnnnnnnnnnnnnT
TnNnNNnNnNNnNnnT
TnnnnnnnnnnnnnnT
TfkkGgkcCkkfkgfT
TfkGgkcCckkfDDfT
TfgkkkkkGgkfDdfT
TfkkkkkkgGkfDhfT
TfffffffffffDDfT
tttttttttttttttt
`;

/** Shopfront with a striped awning. */
export const BUD_SHOP_AWN = `
nnnnnnnnnnnnnnnn
nNnNNnnNnNNnNnnn
aAaAaAaAaAaAaAaA
aAaAaAaAaAaAaAaA
.a.A.a.A.a.A.a.A
TfkkGgkcCkkfDDfT
TfgkkkkkGgkfDdfT
TfkkkkkkgGkfDhfT
TfffffffffffDDfT
tttttttttttttttt
`;

/** Presszó / ruin-bar front: dark joinery, bright sign, posters on the pier. */
export const BUD_BAR = `
nnnnnnnnnnnnnnnn
nNNnNnNNnnNnNNnn
nnnnnnnnnnnnnnnn
FfkkGgkkfDDDfccF
FfkGgkkcfDDDfcxF
FfgkkkcCfDhDfccF
FfkkkkkkfDDDfPPF
FffffffffDDDfPPF
FFFFFFFFFDDDFFFF
tttttttttttttttt
`;

/** Hungarian tricolour hung from a balcony (keys 1 red, 2 white, 3 green). */
export const BUD_FLAG = `
........
........
........
........
........
........
.x......
.111111.
.222222.
.333333.
........
`;

// ---------------------------------------------------------------------------------- props --

/** Ornate cast-iron candelabra (Pest embankment / Andrássy út): three lanterns on scrolls. */
export const LAMP_BUDAPEST = `
......A......
.....MMm.....
....MLFLm....
....MLLLm....
.....MMm.....
..A...M...A..
.MMm..M..MMm.
MLFLm.M.MLFLm
MLLLm.M.MLLLm
.MMm..M..MMm.
..M...M...m..
..MM..M..mm..
...MMMMmmm...
.....MMm.....
.....AAA.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....AMm.....
.....MMm.....
.....MMm.....
.....MMm.....
.....MMm.....
....MMMmm....
....AAAAA....
...MMMMmmm...
..MMmMmMmmm..
..MMMMMmmmm..
`;

/** BKV metro sign: white M on a blue panel, the line's red band (M2) below. */
export const METRO_BUDAPEST = `
NNNNNNNNN
NwNNNNNwN
NwwNNNwwN
NwNwNwNwN
NwNNwNNwN
NwNNNNNwN
NNNNNNNNN
CCCCCCCCC
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

/** Cast-iron bollard with a ball top. */
export const BOLLARD_BUDAPEST = `
.Mm.
MMmm
.Mm.
AAAA
.Mm.
.Mm.
.Mm.
MMmm
`;

/** Chain Bridge lion: reclining stone lion (maned head up, paws forward) on its plinth. */
export const LION_BUDAPEST = `
...ttTt...............
..tTTTTTt.............
.tTTTTTTTt............
.TkTTTTTTtt...........
TTTTTTTTTSt...........
sTTsTTTTTStTTTTTTTt...
.sTTTTTTTSTTTTTTTTTt..
..tSTTTTTSTTTTTTTTTSt.
..TTTTSSTTTTTTTSTTTSStt
TTTTTTSsTTTTTTtSTTTSSs.t
sSSSSSssSSSSSSsSSSSSss.t
WWWWWWWWWWWWWWWWWWWWWWSs
TTTTTTTTTTTTTTTTTTTTTSSs
TTtTTTTTTTTTTTTTTTtTTSSs
TTTTTTTTTTTTTTTTTTTTTSSs
TTTTTTTTTTTTTTTTTTTTTSSs
`;

/** Bronze statue (verdigris) on a tall stone plinth. */
export const STATUE_BUDAPEST = `
....Qq.....
....QQ.....
...qQQq....
..qQQQQq...
..QqQQqQ...
..Q.QQq.q..
....QQq....
....QQq....
...qQQqq...
...qQ.qq...
...qQ.qq...
..qqq.qqq..
.WWWWWWWWS.
.TTTTTTTSs.
..TTTTTSs..
..TtTTTSs..
..TTTTTSs..
..TTTTTSs..
..TTtTTSs..
.TTTTTTTSs.
WWWWWWWWWSs
TTTTTTTTTSs
`;

/** Equestrian bronze (Rákóczi on Kossuth tér) on a stone plinth. */
export const EQUESTRIAN_BUDAPEST = `
.......Qq...........
.......QQ...........
......qQQq..........
..Qq..QQQq..........
.QQQq.qQqq..........
QQqQQqQQqqqqqqq.....
qq.qQQQQQQQQqqqq....
....qQQQQQQQQQqqqq..
.....QQQqqqqqqqq.qq.
.....Qq.Qq...qQ.qq..
.....Qq..Qq..Q..q...
....Qq...Qq.Qq..q...
....q.....q.q....q..
.WWWWWWWWWWWWWWWWWWS
.TTTTTTTTTTTTTTTTTSs
.TTtTTTTTTTTTTTTTTSs
.TTTTTTTTTTTTTTTTTSs
.TTTTTTTTTTTTTTtTTSs
WWWWWWWWWWWWWWWWWWWS
TTTTTTTTTTTTTTTTTTSs
`;
