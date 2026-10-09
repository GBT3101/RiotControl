/* Protester held items (M4b) — part book, keys: ITEM_KEYS in items.ts. Do not reformat.
 * Name `item.<id>.<orientation>`; origin = grip pixel (lands on the arm's @hand anchor).
 * Orientations: down (hanging at the side), up (raised), fwd (horizontal, pointing the way the
 * protester faces), back (wound up behind the head), swing (mid-swing, smear), low (forward-down,
 * follow-through), face (held at the face), dangle (camera on its strap), lit (molotov burning).
 * Optional @tip = muzzle / release / flash pixel. */

export const ITEM_BOOK = `
# ---------------------------------------------------------------- stick / plank (wood)
== item.stick.down 0,1
O
o
o
o
o
o
o

== item.stick.up 0,5
O
O
o
o
o
o
o

== item.stick.fwd 1,0
oooooOO

== item.stick.back 5,5
O.....
oO....
.oo...
..oo..
...oo.
....oo

== item.stick.swing 0,5
.....wO
....wOo
...wOo.
..oOo..
.oo....
oo.....

== item.stick.low 0,0
oo.....
.ooo...
...ooO.
.....oO

# ---------------------------------------------------------------- baseball bat (item tone)
== item.bat.down 0,1
i.
I.
I.
II
YI
II

== item.bat.up 0,5
YI
II
IY
I.
I.
i.
i.

== item.bat.fwd 1,0
iIIIYY
...III

== item.bat.back 5,5
YI....
IIi...
.IIi..
..Ii..
...ii.
....ii

== item.bat.swing 0,5
....wYI
...wIIi
...IIi.
..IIi..
.ii....
ii.....

== item.bat.low 0,0
ii.....
.iII...
...IIY.
....IYY

# ---------------------------------------------------------------- bottle (green glass)
== item.bottle.down 0,0
g.
G.
gG
gg

== item.bottle.up 0,3
Gg
gg
g.
G.

== item.bottle.fwd 0,0
gGgg
.ggG

== item.bottle.back 2,2
Gg.
ggg
..g

== item.bottle.swing 0,2
.wG
gg.
g..

== item.bottle.low 0,0
gg.
.gG

# ---------------------------------------------------------------- molotov (bottle + rag, lit)
== item.molotov.down 0,0
c.
g.
gG
gg

== item.molotov.lit 0,1
F.
c.
g.
gG
gg

== item.molotov.back 2,3
.f.
Fc.
.gg
..g

== item.molotov.swing 0,3
..F
.wc
.g.
g..

== item.molotov.up 0,3
F
c
g
G

# ---------------------------------------------------------------- shiv (taped blade)
== item.shiv.down 0,0
k
m
m

== item.shiv.fwd 0,0
kmmw

== item.shiv.back 1,1
m.
kk

== item.shiv.up 0,2
w
m
k

== item.shiv.low 0,0
km.
..m

# ---------------------------------------------------------------- machete
== item.machete.down 0,0
k.
M.
m.
m.
mw

== item.machete.up 0,5
wm
m.
m.
m.
M.
k.

== item.machete.fwd 0,0
kMmmmw
..MMM.

== item.machete.back 4,4
wm...
mmM..
..mM.
...Mk
....k

== item.machete.swing 0,4
....ww
...wm.
..mm..
.Mm...
k.....

== item.machete.low 0,0
kk....
.Mmm..
...mmw

# ---------------------------------------------------------------- umbrella (closed, canopy = item tone)
== item.umbrella.down 0,1
k.
o.
I.
I.
Ii
Ii
.m

== item.umbrella.up 0,5
.m
Ii
Ii
I.
I.
o.
k.

== item.umbrella.fwd 1,0
kIIIIim
.oiiii.

== item.umbrella.back 5,5
m.....
iI....
.iI...
..iI..
...oo.
....ok

== item.umbrella.swing 0,5
....wIm
...wIi.
..wIi..
..Ii...
.o.....
k......

== item.umbrella.low 0,0
ko.....
..iII..
....IIm

# ---------------------------------------------------------------- megaphone (bonks & shouts)
== item.megaphone.down 0,0
k..
iI.
iIY
IIY
www

== item.megaphone.face 0,1
...IYw
kIIIIw
.iIIIw
...iiw

== item.megaphone.fwd 0,1
...IYw
kIIIIw
.iIIIw
...iiw

== item.megaphone.back 2,3
www
YII
.Ii
..k

== item.megaphone.swing 0,3
..wwY
.wYI.
.Ii..
k....

== item.megaphone.low 0,0
kII..
.iIIw
...ww

== item.megaphone.up 0,4
www
YII
YIi
.Ii
.k.

# ---------------------------------------------------------------- phone (filming)
== item.phone.face 0,1
kk
kw
kk

== item.phone.down 0,0
k
k

== item.phone.up 0,2
kk
kw
kk

# ---------------------------------------------------------------- vape
== item.vape.face 0,0
gw

== item.vape.down 0,0
g
g

# ---------------------------------------------------------------- pot & spoon (Madrid cacerolada)
== item.pot.down 0,0
kBBBk
.BbB.

== item.pot.face 0,1
.kBBBk
kBBBBB
.BbbB.

== item.pot.up 0,3
.kBBBk
kBBBBB
.BbbB.
..k...

== item.pot.fwd 0,0
kkBBBk
..BbB.

# ---------------------------------------------------------------- baguette (Paris)
== item.baguette.down 0,1
O.
O.
o.
O.
o.
O.
.O

== item.baguette.up 0,5
O
o
O
o
O
O
O

== item.baguette.fwd 1,0
OoOoOOO

== item.baguette.back 5,5
O.....
oO....
.OO...
..oO..
...OO.
....OO

== item.baguette.swing 0,5
.....wO
....wOo
...wOO.
..oOo..
.OO....
OO.....

== item.baguette.low 0,0
OO.....
.oOO...
...oOO.
.....OO

# ---------------------------------------------------------------- flag (pole + cloth, 2 flutter frames)
== item.flag.up 0,9
oIIIY.
oIYIIY
oiIIY.
oi.i..
o.....
o.....
o.....
o.....
o.....
o.....

== item.flag.up2 0,9
oIIY..
oIIIYY
oiIIIY
o.ii..
o.....
o.....
o.....
o.....
o.....
o.....

# ---------------------------------------------------------------- pistol / revolver
== item.pistol.down 0,0
B
b
b

== item.pistol.fwd 0,0
@tip 4,0
bBBm
b...

== item.pistol.up 0,2
m.
B.
bb

# ---------------------------------------------------------------- rifle (two hands: R aim, L reach)
== item.rifle.fwd 1,0
@tip 9,0
oobbbBBBmm
.o..b.....

== item.rifle.down 1,2
..m
..B
.bb
.b.
ob.
o..

== item.rifle.up 1,7
..m
..B
..b
.bb
.b.
.b.
ob.
o..

# ---------------------------------------------------------------- bazooka (on the shoulder)
== item.bazooka.fwd 5,-2
@tip 12,0
@back -1,0
BBBBBBFBBBBBm
bbbbbbFbbbbbb
....kk.k.....

== item.bazooka.down 1,1
.bb
bBb
.Bb
.Bb
.Fb
.Bb
.Bb
.Bb
.mm

# ---------------------------------------------------------------- camera (big lens + flash)
== item.camera.face 0,1
@tip 4,-1
.wk..
bbBmm
bbBkk

== item.camera.down 0,0
k.
bB
bm

== item.camera.dangle 0,0
k..
.k.
.bB
.bm

== item.camera.swing 0,4
...bB
...mb
..k..
.k...
k....

== item.camera.up 0,4
bB
mb
.k
.k
.k

== item.camera.fwd 0,0
kkkbB
...mb
`;
