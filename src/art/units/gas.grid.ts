/* Tear Gas Shooter — part book (keys: GAS_KEYS in gas.ts). Canvas 30×26, feet on row 22.
 * Navy helmet, full-face gas mask (big glinting lenses, olive filter canister), hi-vis vest with a
 * bandolier of gas grenades, stubby 40 mm launcher. A curious, head-tilting weirdo.
 * Do not reformat. */

export const GAS_PARTS = `
== shadow 6,20
...%%%%%%%...
.%%%%%%%%%%%.
%%%%%%%%%%%%%
.%%%%%%%%%%%.

== shadow.long 0,17
....%%%%%%%%%%%%%....
.%%%%%%%%%%%%%%%%%%%.
%%%%%%%%%%%%%%%%%%%%%
.%%%%%%%%%%%%%%%%%%%.

# ---------------------------------------------------------------- SE
== torso 7,11
.2333322..
3343332221
3yGyyyGy21
3yyGyyyy21
.3332G2221
.oooogooo.

== head 6,3
....2333....
..23444432..
.2344444332.
.1222222221.
.kKKKKKKKk..
.kKwTKKwTk..
.kKTTKKTTK..
..kKKMMKk...
...kkMNNM...

# Head cocked (fidget): the whole mask leans, lenses catch the light.
== head.tilt 6,3
.....2333...
...23444432.
..2344444332
..1222222221
.kKKKKKKKk1.
.kKwwKKwwk..
.kKTTKKTTK..
..kKKMMKk...
...kkMNNM...

== head.hurt 6,3
....2333....
..23444432..
.2344444332.
.1222222221.
.kKKKKKKKk..
.kKoTKKoTk..
.kKTTKKTTK..
..kKKMMKk...
...kkMNNM...

# Launcher at the hip, muzzle down-right (idle / walk).
== arms.hold 5,11
.33.........
3333........
333.........
.33LS.......
..SSxXX.....
...OxxxXX...
...O..xxxo..
.......oo...

# Launcher levelled. Muzzle pixel (20,13).
== arms.aim 5,11
.33.............
3333............
.3333LSxxXXXXXXo
..33.SSxxxxxxxxo
.....OOx..LS....
......OO........

# Far hand keeps the launcher at the hip while the near arm throws.
== launcher.side 12,14
LSxXX...
.OxxxXX.
.O..xxxo
......o.

== arm.rest 5,11
.33.
3333
333.
.33.
.LS.
.SS.

# Near arm holding a grenade by the hip (charged idle base).
== arm.grenade 4,11
..33..
.3333.
.333..
..33..
..LSg.
..SGG.
...gG.

# Wind-up: grenade cocked behind the helmet.
== arm.windup 1,4
.gG.....
gGGg....
.SL.....
.SS3....
..333...
..3333..
...3333.
...3333.
....333.
.....33.

== arm.over 4,2
.......LS..
.......SS..
......33...
......33...
.....33....
.....33....
....333....
...333.....
..3333.....
.3333......
3333.......

# Release: arm flung forward, hand open.
== arm.release 4,11
.33..........
3333.........
.33333333SL..
..33333..SSs.

== grenade 0,0
.gG
gGG
gGg

== grenade.pin 0,0
..w
gGG
gGG
gGg

# Gas puffs at the muzzle (drawn without outline).
== puff.s 0,0
.a.
aAa
.a.

== puff.m 0,0
.aa.
aAAa
aAZa
.aa.

== puff.l 0,0
..aaa.
.aAAAa
aAZZAa
aAAAAa
.aaaa.

== wheeze 0,0
.Z
Z.

# ---------------------------------------------------------------- deaths
== fall 1,8
...2333.........
.2344443........
.122222.........
.kKKKKKk........
.kKoTKoTk.......
..kKMMKk.333....
...kkMNN3333....
.......3yGyy21..
.......3yyGyy21.
........3332221.
.........333.221
.........32..221
........nBb..nBb
........bbbb.bbb

== fall.ne 1,8
...2333.........
.2344443........
.2344443........
.1222222........
.kkkkkkkM.......
..kkkkkk.333....
...kkkNN3333....
.......3yoyo21..
.......3yoyoy21.
........3332221.
.........333.221
.........32..221
........nBb..nBb
........bbbb.bbb

== lie 0,13
..2333................
.23444k..........Hb...
2344422kT.333....3nBb.
234444kKK3333333.Bb...
222kkTKMN3yGyyy3322...
.1kkKKkN.3yyGyy2222...
..........LS2222......

== lie.flat 0,13
......................
..2333...........b....
.23444k...333...3nBb..
2344422kT3333333.Bb...
234444kKK3yGyyy3322...
.22kkTKMN3yyGyy2222...
..........LS2222......

# ---------------------------------------------------------------- NE
== torso.ne 7,11
.2333322..
3333333221
3yyyyyyy21
3yoyoyoyy1
.3332222N1
.oooooooo.

== head.ne 6,3
....2333....
..23444432..
.2344444332.
.2344443322.
.1222222221.
..kkkkkkkM..
..kkkkkkMNN.
...kkkkkNN..

== arms.ne.hold 12,11
.....33.
....3333
..333333
.SL33...
xXo.....
xx......
O.......

# NE aim: launcher up-right. Muzzle pixel (24,7).
== arms.ne.aim 13,6
..........o
........XXo
......xXXx.
....LSxxx..
...SSxx33..
...O..3333.
..OO..333..
.....33....

== arm.ne.windup 16,2
.....gG.
....gGGg
.....LS.
....3SS.
...333..
..3333..
.3333...
3333....
333.....

== arm.ne.release 16,6
.......SL
......SS.
.....33..
....33...
..333....
.3333....
3333.....
333......
`;
