/* Shared humanoid leg kit (Ministry ground units). Canvas 24×26, feet on row 22, hips row 17.
 * Keys: 1-4 trousers (dark→light, per-unit ramp), K knee (pads or trouser), b/B/n boots
 * (dark, mid, highlight). Near leg (screen-left in SE) is the lighter one and drawn on top.
 * Do not reformat. */

export const LEG_PARTS = `
== legs.stand 6,17
..33332222..
..333..222..
..3KK..2KK..
..332..221..
..nBb..nBb..
..bbbb.bbbb.

# Walk, 8 frames (10 fps). Body bob: 0 1 0 0 0 1 0 0.
== legs.walk 6,17
..33332222..
..333.2222..
.33K...22K..
.32.....221.
nBb.....nBBb
bbb.....bbbb

..33332222..
..333..222..
.33K...2K2..
.32....221..
.nBb...nBBb.
.bb....bbbb.

..33332222..
..3333.222..
..33K..2K2..
...3nB.221..
...bb..nBBb.
.......bbbb.

..33332222..
..3332222...
..22.333K...
..21..332...
.nB...nBBb..
.bb...bbbb..

..33332222..
..2223333...
.22K..333K..
.21.....332.
nBb.....nBBb
bbb.....bbbb

..33332222..
..2223333...
.22K..33K...
.21....332..
.nB....nBBb.
.bb....bbbb.

..33332222..
..2223333...
..22K.33K...
...2nB332...
...bb.nBBb..
......bbbb..

..33332222..
..3332222...
..333.22K...
..332..221..
.nBb...nBb..
.bbb...bbbb.

# Run / jog, 6 frames (12 fps). Body bob: 0 1 -1 0 1 -1, lean +1 x.
== legs.run 6,17
..33332222..
.3333..2222.
33K.....22K.
32.......221
nB......nBBb
b.......bbbb

..33332222..
..333.2222..
.33K...2K2..
nB3....221..
bb....nBBb..
......bbbb..

..33332222..
..3332222...
..33K22K....
...3nB2nB...
...bb..bb...
............

..33332222..
.2222..3333.
22K.....33K.
21.......332
nB......nBBb
b.......bbbb

..33332222..
..222.3333..
.22K...3K3..
nB2....332..
bb....nBBb..
......bbbb..

..33332222..
..2223333...
..22K33K....
...2nB3nB...
...bb..bb...
............

# Wide braced stance (attacks, shield plant).
== legs.brace 6,17
..33332222..
.333....222.
.3KK....2KK.
.32......221
nBb......nBb
bbbb....bbbb

# Crouch (knees bent, hips low) — hips on row 19.
== legs.crouch 5,19
..333322222...
.33KK...2KK2..
.nBbb...nBBb..
bbbb....bbbbb.

# Kneel (near knee down, far foot planted) — hips on row 19.
== legs.kneel 5,18
..33332222....
..333KK.222...
.nB333KK.22...
.bbbb.3K.nBb..
.......bbbbb..
`;
