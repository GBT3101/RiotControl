/* Protester headwear, face accessories and torso / back gear (M4b). Do not reformat.
 * Headwear & face parts share the head origin (neck pixel, head box 9×9 → 4,8).
 * Torso gear attaches at the torso's `neck` anchor (row 0 of the grid = shoulder row unless the
 * origin says otherwise). Keys: BODY_KEYS (+ GEAR_KEYS: X/x/Z/y = $gear, fixed colours). */

export const HEADWEAR_BOOK = `
# ---------------------------------------------------------------- headwear
== hat.beanie.se 4,9
....N....
...MMMn..
..NMMMMn.
.NMMMMMMn
.zNNNNNNz

== hat.beanie.ne 4,9
....N....
...MMMn..
..NMMMMn.
.NMMMMMMn
.zNNNNNNz

== hat.cap.se 4,8
..........
...NMMn...
..NMMMMn..
.nMMMMNNNn

== hat.cap.ne 4,8
.........
...NMMn..
..NMMMMn.
.NMMzMMMn

== hat.capback.se 5,8
..........
....NMMn..
...NMMMMn.
NNnMMMMMMn

== hat.capback.ne 4,8
.........
...NMMn..
..NMMMMn.
nnMMMMMMn

== hat.hood.se 5,8
....UTTt..
...UTTTTt.
..UTTTTTTt
.UTTd....t
.UTd......
.UTd......
.UTd......
..dd......

== hat.hood.ne 5,8
....UTTt..
...UTTTTt.
..UTTTTTTt
.UTTTTTTtt
.UTTTTTTtd
.UTTTTTtdd
..UTTTtdd.
...dddd...

== hat.balaclava.se 4,8
.........
...NMMM..
..NMMMMM.
.NMMMMMMn
.MMMM...M
.nMMMMMMn
..nMMMMM.
...nMMn..
....nn...

== hat.balaclava.ne 4,8
.........
...NMMM..
..NMMMMM.
.NMMMMMMn
.MMMMMMMn
.nMMMMMMn
..nMMMMn.
...nMMn..
....nn...

== hat.foil.se 4,11
.....N...
....NMn..
...NMNMn.
..NMMNMn.
.NnMNMMnn

== hat.foil.ne 4,11
.....N...
....NMn..
...NMNMn.
..NMMNMn.
.NnMNMMnn

== hat.cone.se 4,12
....M.....
....MN....
...NNNN...
...nMMM...
..nMMMMM..
..zNNNNN..
.znMMMMMM.
zzzzzzzzzz

== hat.cone.ne 4,12
....M.....
....MN....
...NNNN...
...nMMM...
..nMMMMM..
..zNNNNN..
.znMMMMMM.
zzzzzzzzzz

== hat.bucket.se 5,8
....nMMn..
...NMMMMn.
..NMMMMMMn
NNNNNNNNNn

== hat.bucket.ne 5,8
....nMMn..
...NMMMMn.
..NMMMMMMn
NNNNNNNNNn

== hat.beret.se 4,8
....n....
..NMMMM..
.NMMMMMMn
..nnnnnn.

== hat.beret.ne 4,8
....n....
..NMMMM..
.NMMMMMMn
..nnnnnn.

== hat.headband.se 4,8
.........
.........
.........
.MNNMMMMM
M........
nM.......

== hat.headband.ne 4,8
.........
.........
.........
.MNNMMMMn
...MM....
...nM....

== hat.headphones.se 4,9
...kkkk..
..k....k.
.........
.........
.kM......
.nM......

== hat.headphones.ne 4,9
...kkkk..
..k....k.
.........
.........
Mk.....kM
Mn.....nM

== hat.cowl.se 5,9
...UTTt...
..UTTTTt..
.UTTTTTTt.
UTTTTTTTtt
UTTd....Vt
UTd.......
UTd.......
dUTd......
ddUd......
.ddd......

== hat.cowl.ne 5,9
...UTTt...
..UTTTTt..
.UTTTTTTt.
UTTTTTTTtt
UTTTTTTTtd
UTTTTTTTtd
UTTTTTTtdd
.UTTTTtdd.
..dddddd..

== hat.raincoathood.se 5,8
....UTTt..
...UTTTTt.
..UTTTTTTt
.UTTd....t
.UTd......
..d.......

== hat.raincoathood.ne 5,8
....UTTt..
...UTTTTt.
..UTTTTTTt
.UTTTTTTtt
.UTTTTTTtd
..dddddd..
`;

export const FACE_BOOK = `
== face.glasses.se 4,8
.........
.........
.........
.........
....kwkwk

== face.shades.se 4,8
.........
.........
.........
.....g...
....kkkkk

== face.goggles.se 4,8
.........
.........
.........
.kkkkkkkk
.k..kNkNk
.....kkk.

== face.goggles.ne 4,8
.........
.........
.........
.kkkkkkkk
.kkkkkkkk

== face.septum.se 4,8
.........
.........
.........
.........
.........
......Y..

== face.earring.se 4,8
.........
.........
.........
.........
.........
.Y.......

== face.paint.se 4,8
.........
.........
...x.....
....x.x..
.........
....x.x..
....x.x..

== face.mask.se 4,8
.........
.........
.........
.........
.........
.nMMMMMMM
..nMMMMMM
...nMMn..
....nn...

== face.mask.ne 4,8
.........
.........
.........
.........
.........
.nM......
nMn......

== face.scarf.se 4,8
.........
.........
.........
.........
.........
.kwkwkwkw
.wkwkwkwk
..wkwkwk.
...kwkw..
`;

export const GEAR_BOOK = `
# ---------------------------------------------------------------- torso / back gear (origin = neck)
== gear.straps.se 3,-1
.x..x.
.x..x.
.x..x.
.y..y.

== gear.backpack.se 5,-1
ZX..
XXx.
XXx.
XXx.
xxy.

== gear.backpack.ne 3,-1
.ZXXx.
ZXXXXx
XyyyXx
XXXXXx
xxxxxy

== gear.crate.se 5,0
g...
gZX.
XXx.
XXx.
XXx.
xxy.

== gear.crate.ne 3,0
.g.g.g
.ZXXx.
ZXXXXx
XyyyXx
XXXXXx
xxxxxy

== gear.tote.se 6,-1
......x.
.....x..
....x...
...x....
.ZXX....
.XXXx...
.XXXx...
.xxxy...

== gear.tote.ne 2,-1
x.......
.x......
..x.....
...x....
....ZXXx
....XXXx
....XXXx
....xxxy

== gear.strap.se 3,-1
....k.
...k..
..kw..
.k....
k.....

== gear.strap.ne 3,-1
.k....
..k...
...k..
....k.
.....k

== gear.scarf.se 3,0
kwkwkw
.wkwk.

== gear.scarf.ne 3,0
kwkwkw
wkwkwk
.k....
.w....

== gear.leaf.se 3,-1
......
....g.
......

== gear.board.ne 6,0
...R.R.R....
.cCCCCCCCCcR
RcCCCCCCCCcR
.cCCRrRrCCc.
RcCRRrRRCCcR
.cCCRrRrCCc.
RcCCCCCCCCc.
.cCCCCCCCCcR
.ccccccccccc
`;
