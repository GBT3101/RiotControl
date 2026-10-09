/**
 * Hand-authored facade modules (M3a). Each cell is one bay × one storey (8×10 px) or a 2-bay
 * shopfront (16×10), drawn *unsheared* in face space — the rasterizer shears them onto the iso
 * face. Openings and overlays are separate so balconies, blinds, plants, laundry, banners and
 * peeking residents combine freely.
 *
 * Keys (resolved per building / per window by the facade painter):
 *   .  wall (transparent)        w  wall shadow             W  wall highlight
 *   T  trim (stone surround)     t  trim shadow             U  trim highlight
 *   g  glass                     G  glass reflection        k  glass deep / interior
 *   f  window frame              F  frame shadow
 *   S  shutter / blind           s  shutter shadow
 *   I  iron highlight            i  iron                    x  ink
 *   D  door                      d  door shadow             h  brass handle / knocker
 *   a  awning                    A  awning stripe           n  sign board   N  sign letters
 *   m  metal                     M  metal highlight         c  curtain / cloth   C  cloth 2
 *   p  leaves                    P  flowers                 e  skin   H  hair   r  red   y  yellow
 */

// ------------------------------------------------------------------------------- Madrid ----

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

// ------------------------------------------------------------------------------- London ----

/** Georgian sash window with stone lintel and sill. */
export const LDN_SASH = `
........
.UUUUUt.
.ffffff.
.fkkkkf.
.fkGggf.
.ffffff.
.fkgGgf.
.fkggGf.
.ffffff.
.UUUUUt.
`;

/** Taller first-floor sash with a cast-iron balconette. */
export const LDN_SASH_TALL = `
.UUUUUt.
.ffffff.
.fkkkkf.
.fkGggf.
.fkgGgf.
.ffffff.
.fkggGf.
.IIIIII.
.i.ii.i.
.iiiiii.
`;

/** Small attic / top-floor sash. */
export const LDN_SASH_SMALL = `
........
........
.UUUUt..
.ffff...
.fkGf...
.fkgf...
.ffff...
.UUUUt..
........
........
`;

/** Georgian front door with fanlight. */
export const LDN_DOOR = `
.UUUUUt.
.UkGgkU.
.UffffU.
.UDDDDU.
.UDdDdU.
.UDDhDU.
.UDdDdU.
.UDDDDU.
.UDDDDU.
tttttttt
`;

/** Pub front (2 bays): painted fascia with gilded letters, big panes, door. */
export const LDN_PUB = `
nnnnnnnnnnnnnnnn
nNNnNnNNnNNnNnNn
nnnnnnnnnnnnnnnn
fkkGgkfkkGgkfDDf
fkGgkkfkGgkkfDDf
fgkkkcfgkkkcfDhf
fkkkcCfkkkcCfDDf
ffffffffffffffff
nnnnnnnnnnnnfDDf
tttttttttttttttt
`;

/** London shopfront (2 bays): fascia, large window, recessed door. */
export const LDN_SHOP = `
nnnnnnnnnnnnnnnn
nnNNnNnNNnNnNnnn
aaAAaaAAaaAAaaAA
fkkGgkkcCkkfkDDf
fkGgkkcCckkfkDDf
fgkkkkkkGgkfkDhf
fkkkkkkkgGkfkDDf
ffffffffffffkDDf
nnnnnnnnnnnnkddf
tttttttttttttttt
`;

/** Basement-area railings with gilded tips (overlay at the foot of the ground floor). */
export const LDN_RAILINGS = `
........
........
........
........
........
y.y.y.y.
i.i.i.i.
iiiiiiii
i.i.i.i.
i.i.i.i.
`;

// -------------------------------------------------------------------------------- Paris ----

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

// ----------------------------------------------------------------------- Shared overlays ----

/** Flower pots on a balcony / sill. */
export const FLOWERS = `
........
........
........
........
.pPp.Pp.
pPpp.pPp
........
........
........
........
`;

/** Laundry hung over the balcony rail. */
export const LAUNDRY = `
........
........
........
........
........
xxxxxxxx
.cc.CC..
.cc.CC.c
.c..C...
........
`;

/** Resident peeking out (head and shoulders in the opening). */
export const PEEK = `
........
........
........
...HH...
...ee...
..cHec..
..cccc..
........
........
........
`;

/** Window air-conditioning box on the wall beside a window (Madrid). */
export const AC_UNIT = `
........
........
........
........
........
........
.....mMM
.....mxm
.....mmm
......x.
`;

/** Protest bed-sheet banner hanging from the balcony ("NO"). Spans the storey below. */
export const BANNER_NO = `
........
........
........
........
........
........
x......x
cccccccc
crcccrcc
crrcrcrc
crcrrcrc
crccrcrc
cccccccc
`;

/** Flag hung from a balcony (stripes = c / C / c). */
export const BALCONY_FLAG = `
........
........
........
........
........
........
.x......
.cccccc.
.CCCCCC.
.CCCCCC.
.cccccc.
`;

/** Satellite dish bolted to the wall. */
export const SAT_DISH = `
........
........
........
......MM
.....MmM
.....mMx
......x.
........
........
........
`;

/** Drainpipe hopper head + pipe segment (column 0 = pipe). */
export const PIPE_HEAD = `
mm
mx
m.
`;
