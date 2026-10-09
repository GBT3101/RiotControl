/* Protester base body parts (M4b) — part book, keys: BODY_KEYS in rig.ts. Do not reformat.
 * Header `== name ox,oy` = origin pixel (attach point) of the part; `@name x,y` = anchors.
 * Facings: `.se` = front three-quarter (looks screen-right/down), `.ne` = back three-quarter.
 * Light from the upper-left. No outline here: frames are auto-outlined in ink. */

export const BODY_BOOK = `
# ================================================================ HEADS (box 9×9, origin = neck)
== head.se 4,8
.........
...LSSS..
..LSSSSS.
.LSSSSSSs
.SSSSeSeS
.sSSSSSSs
..sSSSsS.
...sSSs..
....ss...

== head.ne 4,8
.........
...LSSS..
..LSSSSS.
.LSSSSSSs
.SSSSSSSs
.SsSSSSSs
..sSSSSs.
...sSSs..
....ss...

# ---------------------------------------------------------------- expressions (SE, over the face)
== face.angry.se 4,8
.........
.........
.........
....k.k..
.........
.........
.........
.........

== face.shout.se 4,8
.........
.........
.........
....k.k..
.........
.........
......k..
......o..

== face.happy.se 4,8
.........
.........
.........
.........
.........
.........
.....os..
.........

== face.wince.se 4,8
.........
.........
.........
.........
....kS.kS
.........
......k..
.........

== face.dead.se 4,8
.........
.........
.........
.........
.....s.s.
.........
......o..
.........

== face.ko.se 4,8
.........
.........
.........
...k.kk.k
....k..k.
...k.kk.k
......o..
.........

== face.look.se 4,8
.........
.........
.........
.........
...eSeSSS
.........
.........
.........

== face.scowl.se 4,8
.........
.........
.........
....kkk..
.........
.........
.....oo..
.........

== face.wide.se 4,8
.........
.........
.........
.........
....wewe.
.........
......o..
.........

# ================================================================ TORSOS (origin = hip, below last row)
# anchors: neck (head origin), shL / shR (arm origins)
== torso.tee.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UUdTTt
UTTTtt
UTTTtt
tTTTtd

== torso.tee.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UUTTTt
UTTTtt
UTTTtt
tTTttd

== torso.print.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UUdTTt
UTAVtt
UTVAtt
tTTTtd

== torso.stripes.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
AVAAAa
UTTTtt
AVAAAa
tTTTtd

== torso.stripes.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
AVAAAa
UTTTtt
AVAAAa
tTTttd

== torso.hoodie.se 3,6
@neck 3,0
@shL -1,1
@shR 6,1
dTt...
UUddTt
UTTATt
UTTATt
UTddtt
tTTTtd

== torso.hoodie.ne 3,6
@neck 3,0
@shL -1,1
@shR 6,1
.dTTd.
UdTTdt
UTddtt
UTTTtt
UTTTtt
tTTttd

== torso.jacket.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UTVAdt
UTAAdt
UTAadt
UTAadt
tTd.td

== torso.jacket.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UUTTTt
UTTTtt
UTTTtt
UTTttt
tTTttd

== torso.puffer.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
UUTTTt
UTVdTt
tttttd
UTTTTt
tttttd

== torso.puffer.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
UUTTTt
UTTTTt
tttttd
UTTTTt
tttttd

== torso.hawaiian.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UVdTAt
UTAVTt
VTTtAt
tATTtd

== torso.hawaiian.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UVTTAt
UTAVTt
VTTtAt
tATTtd

== torso.bathrobe.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UVSdTt
UUVdTt
AAAAAa
UTTdtt

== torso.bathrobe.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UUTTTt
UTTTtt
AAAAAa
UTTTtt

== torso.vest.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UAAt.
UTVAdt
UdAAdt
UTAAtt
UddTdd

== torso.vest.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UTTTtt
UdTTdt
UTTTtt
tTTttd

== torso.raincoat.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
UUTTt.
UUdTTt
UTTktt
UTTTtt
UTTktd

== torso.raincoat.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.dTTd.
UdTTdt
UTddtt
UTTTtt
UTTTtd

== torso.robe.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UTVVVt
UTtVtt
UTVVVt
AAVAAa

== torso.robe.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.dTTd.
UTVVVt
UTtVtt
UTVVVt
AAAAAa

== torso.plainrobe.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UUdTTt
UTTdtt
UTTTtt
AAVAAa

== torso.plainrobe.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
UUTTTt
UTTTtt
UTTTtt
AAAAAa

== torso.track.se 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
VUdUTA
UTTUtt
UTTUtt
tTTUtd

== torso.track.ne 3,5
@neck 3,-1
@shL -1,0
@shR 6,0
.UTTt.
VUTTTA
UTTTtt
UTTTtt
tTTttd

# ---------------------------------------------------------------- hems for long garments
# (attach at the hip = torso origin; drawn over the legs; top keys)
== hem.mid.0 3,0
UTTTtd
tTTttd

== hem.mid.1 3,0
UTTTttd
UtTTttd

== hem.mid.2 4,0
.UTTTttd
UTt..ttd

== hem.long.0 3,0
UTTTtd
UTTttd
UTTttd
dtttdd

== hem.long.1 3,0
UTTTttd
UTTTttd
UTt.ttd
dtd.tdd

== hem.long.2 4,0
.UTTTttd
UTTt.ttd
UTt...td
dd.....d

# ================================================================ LEGS (shared SE/NE; origin = ground)
# P/Q lit leg, p dark leg, J/j shins, B/b shoes, W sole. Second half-cycles swap lit/dark.
# @hip = torso attach point; @hem x = hem spread (0..2).
== legs.stand 4,5
@hip 4,-1
@hem 0,0
.QPPPPp..
.QPPpPp..
.QPP.pp..
.QJJ.jj..
.BBBbbb..
.WWW.WWW.

== legs.wide 4,5
@hip 4,-1
@hem 1,0
.QPPPPp...
.QPpPPpp..
QPP...pp..
QJJ...jj..
BBB...bbb.
WWW...WWW.

== legs.walk0 4,5
@hip 4,-1
@hem 2,0
..QPPPp..
.pp.QPP..
.pj..QPJ.
jj....JJ.
bb....BBB
W.....WWW

== legs.walk1 4,5
@hip 4,0
@hem 1,0
.........
..QPPPp..
.ppQPPP..
.jj..JJ..
.bb.BBB..
.W..WWW..

== legs.walk2 4,5
@hip 4,-1
@hem 0,0
..QPPPp..
..QPPpp..
..QPjj...
..QJbb...
..BBBW...
..WWW....

== legs.walk3 4,6
@hip 4,-1
@hem 1,0
..QPPPp..
..QPPPpp.
..QP..jj.
.QJ....jb
.QJ....bb
BBB......
WW.......

== legs.run0 4,5
@hip 4,-2
@hem 2,0
..QPPPp...
.ppPQPPP..
.jj...PPJ.
bj.....JJ.
bb.....BBB
.......WWW

== legs.run1 4,5
@hip 4,-1
@hem 1,0
...QPPp..
..ppQPP..
.pj..PJ..
.bj..JJ..
....BBB..
....WWW..

== legs.run2 4,7
@hip 4,-1
@hem 1,0
..QPPPp..
.QPPPPpp.
.QPJ..jj.
.QJ....jb
.Jb....bb
BB.......
.........
.........

== legs.crouch 4,6
@hip 4,1
@hem 1,0
.........
.........
.QPPPPp..
QPPp.pPp.
QJJ...jj.
BBBb.bbbb
WWW...WWW

== legs.step 4,5
@hip 4,-1
@hem 1,0
..QPPPp..
..pPQPP..
.pj..PJ..
.jj..JJ..
.bb..BBB.
.W...WWW.

== legs.climb0 4,6
@hip 4,-1
@hem 1,0
.QPPPPp..
.QPP.Ppp.
.QPP..jjb
.QJJ..bb.
.QJJ.....
.BBB.....
.WW......

== legs.climb1 4,6
@hip 4,-1
@hem 0,0
.QPPPPp..
.QPP.pp..
.QJJ.jj..
.QJJ.jj..
.BBB.bb..
.WW..bb..
.........

== legs.shuffle0 4,5
@hip 4,0
@hem 1,0
..........
.QPPPPpp..
QPPp..ppj.
QJJ....jj.
BBB....bbb
WWW....WWW

== legs.shuffle1 4,5
@hip 4,-1
@hem 0,0
..QPPPp..
..QPPpp..
..QPjpj..
.QJJ.jj..
.BBBbbb..
.WWW.WWW.

# ================================================================ ARMS (R = screen-right arm)
# origin = shoulder attach; @hand = grip pixel for held items. T/t sleeve, F/f forearm, S/s hand.
== arm.down 0,0
@hand 0,5
Tt
Tt
Ff
Ff
SS
Ss

== arm.swingF 0,0
@hand 2,4
Tt.
tFf
.Ff
.SS
.sS

== arm.swingB 1,0
@hand 0,4
.Tt
.Tt
Ff.
SS.
Ss.

== arm.up 0,6
@hand 0,0
SS
Ss
Ff
Ff
Tt
Tt
Tt

== arm.upF 0,4
@hand 2,0
..SS
..Ss
.Ff.
TFf.
Tt..

== arm.fwd 0,0
@hand 5,1
TtFfSS
ttffSs

== arm.aim 0,0
@hand 5,0
TtFfSS
tt..Ss

== arm.back 3,3
@hand 0,0
SS..
sSF.
..Ft
...T

== arm.chest 1,0
@hand 0,3
.Tt
.tF
.Ff
SS.
Ss.

== arm.face 0,2
@hand 1,-1
.SS
FFs
Tt.
Tt.

== arm.pump 0,0
@hand 2,2
Tt.
tFF
.SS
.Ss

== arm.hip 0,0
@hand 1,3
Tt.
TtF
.FS
.Ss

== arm.wag 0,6
@hand 2,0
..S
..S
.SS
.Ss
.FF
FF.
Tt.

== arm.hold 0,7
@hand 0,0
SS
Ss
Ff
Ff
Ff
Tt
Tt
Tt

== arm.wag2 0,6
@hand 3,0
...S
..S.
.SS.
.Ss.
.FF.
FF..
Tt..

== arm.reach 4,0
@hand 0,2
.ffTt
fFFt.
SS...
Ss...

== arm.limp 0,0
@hand 1,5
Tt.
Tt.
.Ff
.Ff
.SS
.Ss
`;
