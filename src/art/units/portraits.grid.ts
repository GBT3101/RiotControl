/* Unit portraits — 32×32 busts for deploy cards and the codex (keys: PORTRAIT_KEYS in
 * portraits.ts; per-unit key overrides there). Face turned slightly right (toward SE), light from
 * the upper-left. Shared face base + per-unit headgear / expression / bust. Do not reformat. */

export const PORTRAIT_PARTS = `
== face 8,9
...sLLLLLLLLs...
..sLLLLLLLLLLs..
.sLLLLLLLLLLLLs.
.SLLLLLLLLLLLLLs
SSLLLLLLLLLLLLLs
SSLLLLLLLLLLLLLS
SSLLLLLLLLLLLLLS
.SLLLLLLLLLLLLLs
.sSLLLLLLLLLLLs.
..sSLLLLLLLLLSs.
...sSSLLLLLSSs..
....ssSSSSSss...
......ssss......

== ear 6,14
.S.
sLS
sSs
.s.

== nose 19,14
.L..
.LL.
.SLS
.ss.

== neck 12,21
.sSSSSs.
.sSSSSs.
ssSSSSss

# ------------------------------------------------------------------ Riot Control: smug
== riot.helmet 5,2
........oooooo........
......oo444433oo......
.....o4444443333o.....
....o44zzzzzzzzzzo....
...o44zVwwwwwwwwwzo...
...o4zVwwwwwwwwwwzo...
..o344zzzzzzzzzzzz2o..
..o3333333333333332o..
..o332222222222222221o
..o321...............o
..o21................o
..o21.................
..o21.................
...o1.................
....1.................
.....1................

== riot.eyes 11,13
.SSSS...SSSS
.Saae...Saae
..ee.....ee.

== riot.brows 11,11
.ooo.....o..
.........ooo

== riot.mouth 14,18
.....mm
.mmmm..
..ss...

== riot.bust 0,21
................................
...........3oooooooo3...........
.......334oo3sSSSSs3oo4433......
....33444444333SSSS33444443333..
..3444444444333333333444444443..
.34444yYYYYYYYYYYYYYYYYYyy44443.
3444yYYYYYYYYYYYYYYYYYYYYYYyy443
344yyyyyyyyyyyyyyyyyyyyyyyyyy433
3444444444444333333333333333333.
3444444444444433333333333332222.
34444444444443333333333333322222

# ------------------------------------------------------------------ Rubber Sniper: nervous rookie
== sniper.helmet 4,3
.........oooooo.........
.......oo444433oo.......
.....oo44444443333oo....
....o4444444444333332o..
...o444444444443333322o.
..o44444444444333333322o
..o33333333333333333332o
..o22222222222222222221o
...oo1111111111111111oo.
.....o..............o...

== sniper.eyes 11,13
.aaa....aaa.
.aae....aae.
.aee....aee.

== sniper.mouth 15,18
.mm.
mtmm
.mm.

== sniper.freckles 10,16
.s.s.....s.s
..s.......s.

== sniper.sweat 24,12
.w
wW
.w

== sniper.bust 0,21
................................
.........333oooooooooo333.......
......3344443sSSSSs34443333.....
....33444444433SS3344444443333..
..3444444444443333444444444443..
.344yYYYYYYY4433334444444444443.
344yYYYYYYYYy4333344444444444443
34yyyyyyyyyyy4333344444444444443
344444444444443333444444444443..
3444444444444433334444444444433.
34444444444444333344444444444333

# ------------------------------------------------------------------ Tear Gas: the gas-masked weirdo
== gas.helmet 5,2
........oooooo........
......oo444433oo......
.....o4444443333o.....
....o444444443333o....
...o44444444333333o...
..o3333333333333332o..
..o2222222222222221o..
...ooooooooooooooooo..

== gas.mask 6,9
....kkKKKKKKKKkk....
..kkKKKKKKKKKKKKkk..
.kKKKooooKKooooKKkk.
.kKKoTTwToKoTTwTokk.
kKKKoTTTToKoTTTTokkk
kKKKoTTTToKoTTTTokk.
kKKKKooooKKKooooKkk.
.kKKKKKKKKKKKKKKKkk.
.kkKKKKKMMMMKKKKkk..
..kkKKKMNNNNMKKkk...
...kkkKMNMMNMkk.....
.....kkMNNNNMk......
.......kMMMMk.......

== gas.bust 0,21
................................
.........333oooooooooo333.......
......3344443kkkkkkk34443333....
....33444444433kk3344444443333..
..344444yG44443333444yG4444443..
.3444yG44yG4433334yG444yG444443.
344yYYYYYYYYYYYYYYYYYYYYYYYYy433
34yyyyyyyyyyyyyyyyyyyyyyyyyyyy43
344444444G444333334444G4444443..
3444444444G44433334444G44444433.
34444444444G4333334444G444444333

# ------------------------------------------------------------------ Mounted: the moustache
== horse.helmet 5,2
........oooooo........
......oo444433oo......
.....o44zzzzzzz3o.....
....o44zVwwwwwwzzo....
...o44zVwwwwwwwwwzo...
..o3444zzzzzzzzzzz2o..
..o3333333333333332o..
..o332222222222222221o
..o321...............o
..o21................o
..o21.................
...o1.................

== horse.eyes 11,13
.oo......oo.
.ae.....ae..
.ee.....ee..

== horse.moustache 9,17
..MMMMM..MMMMMM.
.MMMMMMMMMMMMMMM
MMM...MMMM...MMM
MM.....mm.....MM

== horse.bust 0,21
................................
...........3oooooooo3...........
.......334oo3sSSSSs3oo4433......
....33444444333SSSS33444443333..
..3444444444333gg33444444443....
.34444444444333gg33444444444443.
344yYYYYYYYYYYYYYYYYYYYYYYYyy443
344yyyyyyyyyyyyyyyyyyyyyyyyyy433
3444444444444333333333333333333.
3444444444444433333333333332222.
34444444444443333333333333322222

# ------------------------------------------------------------------ Armed Cop: sweaty
== cop.cap 5,2
.........oooooo........
.......oo444433oo......
.....oo44444443333oo...
....o44444444443333322o
...o444444444443333332o
...o33333333333333332o.
...oWW22WW22WW22WW22Wo.
...o11111111gg11111111o
...o1oooooooooooooooooo
....oooooooooooooooooo.

== cop.eyes 11,13
.SSS....SSS.
.aae....aae.
..ee.....ee.

== cop.brows 11,12
..ooo..ooo..

== cop.mouth 14,18
.mmmm.
.mttm.

== cop.sweat 22,11
..w.
.wW.
.ww.
....
w...
W...

== cop.bust 0,21
................................
.........ccc3oooooooo3ccc.......
......cccccco3sSSSSs3occcccc....
....ccccccc2222SSSS2222ccccccccc
..ccccccc222222222222222ccccccc.
.cccccc22yYYYYy222222222222ccccc
cccccc222yyyyyy2222222CC22ccccc.
ccccc22222222222222222CCC22cccc.
cccc2222222222222222222222222ccc
ccc22222222222222222222222222ccc
cc2222222222222222222222222222cc

# ------------------------------------------------------------------ Soldier: stoic
== soldier.helmet 4,2
.........oooooo.........
.......oo344433oo.......
.....oo3444444333oo.....
....o34444444433333o....
...o3qqqqwwqqqqqq3332o..
..o33qqqwwwwqqqq333322o.
..o333333333333333333o..
..o2222222222222222222o.
..ooo1111111111111111oo.
.....1..............1...
......1............1....

== soldier.eyes 11,13
.oooo...oooo
..ae.....ae.

== soldier.mouth 13,18
.mmmmmm.
..ssss..

== soldier.stubble 10,17
...s.s.s.s.s.
....s.s.s.s..

== soldier.bust 0,21
................................
.........333oooooooooo333.......
......3344443sSSSSs34443333.....
....334444444333SS33444444433...
..34444PPP444433334444PPP44443..
.344444PPP444433334444PPP444443.
34444444444444333344444444444443
34444PPP4444443333444PPP44444443
344444PPP44444333344PPP44444443.
3444444444444433334444444444433.
34444444444444333344444444444333

# ------------------------------------------------------------------ Sniper Brigade: cold captain
== brigade.hat 3,1
......y.y4y..y..........
....yoo4yY44oyoy........
...oy44y44444y33o.......
..o44444444444333o......
.o3333333333333333o.....
oo2222222222222222oooooo
.oooooooooooooooooo.....

== brigade.mask 6,8
..3333333333333...
.333333333333333..
3333333333333333..
33EEEEEEEEEEEE33..
3EEeeEEEEEEeeEE3..
3EEEEEEEEEEEEEE3..
33333333333333333.
3333333333333333..
.33333333333333...
..333333333333....
...3333333333.....
....33333333......

== brigade.scar 18,11
.f
f.

== brigade.bust 0,21
................................
.........333oooooooooo333.......
......3344y43333333334y443333...
....33y4444433333333334y44333...
..34444yy4443333333344yy4444443.
.344444PPP4433333333444PPP44443.
344444PPP4443333333344PPP444443.
3444y44444444333333344444y44443.
34444444444443333333444444444443
3444444444444433333344444444433.
34444444444444333333444444444333
`;
