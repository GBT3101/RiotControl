/* Soldier — part book (keys: SOLDIER_KEYS in soldier.ts). Canvas 30×26, feet on row 22.
 * Olive fatigues, plate carrier with pouches, helmet with goggles, automatic rifle. Stoic.
 * Do not reformat. */

export const SOLDIER_PARTS = `
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
.3443332..
3443333221
3P2P2P2231
322222222p
.2PP22221.
.oooogooo.

== head 6,3
....3443....
..33444433..
.3344443332.
.3qqwwqq322.
.22222222221
.1rSLLLLLS..
.1sSLeLLeL..
..sSLLLLs...
..1sSmmSs...

== head.blink 6,3
....3443....
..33444433..
.3344443332.
.3qqwwqq322.
.22222222221
.1rSLLLLLS..
.1sSLsLLsL..
..sSLLLLs...
..1sSmmSs...

# Goggles down, chin up — the stoic look-around.
== head.goggles 6,3
....3443....
..33444433..
.3344443332.
.3333333322.
.22222222221
.1rqqwwqwwq.
.1sSLLLLLL..
..sSLLLLs...
..1sSmmSs...

== head.hurt 6,3
....3443....
..33444433..
.3344443332.
.3qqwwqq322.
.22222222221
.1rSLLLLLS..
.1sSeeLeeL..
..sSLooLs...
..1sSSSSs...

# Port arms: rifle diagonal across the chest, muzzle up-right.
== arms.port 4,8
............Xx
...........Xx.
..........Xx..
.33......Xx...
3333....LSx...
.3333.XxSS....
..333Xxx......
...LSx........
...SXx........
....x.........

# Shouldered, aiming right. Muzzle pixel (23,13).
== arms.aim 5,11
.33...............
3333..............
.33333xXXXXXXXXXXx
..33LSxxxxxxxxxxx.
....SSx.xxLS......
.......x..........

== arms.recoil 4,11
.33...............
3333..............
.33333xXXXXXXXXXXx
..33LSxxxxxxxxxxx.
....SSx.xxLS......
.......x..........

# Reload: muzzle dipped, magazine out, off hand on the magazine well.
== arms.reload1 5,11
.33...........
3333..........
.33333xXXX....
..33LSxxxxXX..
....SS.xxLS.xx
.......x......

== arms.reload2 5,11
.33...........
3333..........
.33333xXXX....
..33LSxxxxXX..
....SS.xx..xx.
........LS....

== mag 11,16
x
x

# Salute (deploy): near hand to the helmet brim, rifle grounded in the far hand.
== arms.salute 3,5
....LS........
....SS........
...333........
..333.........
.3333.......Xx
3333........Xx
.333.......LSx
.33........SSx
............x.
............x.
............x.

== flash 23,11
...f...
..fFf..
ffFWFff
..fFf..
...f...

== flash.small 23,12
.f.
fWf
.f.

# ---------------------------------------------------------------- crouch (prone-ish firing stance)
== torso.crouch 7,13
.3443332..
3443333221
3P2P2P2231
322222222p
.oooogooo.

# ---------------------------------------------------------------- deaths
== fall 1,8
...3443.........
.3344443........
.3qqwwq3........
.22222222.......
.1rSLeLLe.......
..sSLmmS.4432...
...ssss.443332..
.......3P2P2231.
.......32222221.
........222222p.
.........333.221
.........32..221
........nBb..nBb
........bbbb.bbb

== lie 0,13
..3443................
.344443q.........Hb...
3444443wq..443...3nBb.
3333333qq.44333333Bb..
2222rrSLs.3P2P2P2222..
.1r1sSmSs.32222222....
.........LS22222xXXx..

== lie.flat 0,13
......................
..3443...........b....
.344443q...443..3nBb..
3444443wq.443333333...
2222rrSLs.3P2P2P2222..
.1r1sSmSs.32222222....
.........LS22222xXXx..

# ---------------------------------------------------------------- NE
== torso.ne 7,11
.3443332..
3443333221
32PPPPP221
322222222p
.22222221.
.oooooooo.

== head.ne 6,3
....3443....
..33444433..
.3344443332.
.3344433322.
.22222222221
..2111111q..
...rrrrrr...
...sSSSs....

== arms.ne.port 9,6
..........Xx
.........Xx.
........Xx..
.......Xx...
......Xx33..
.....LSx3333
....SSx.333.
...Xx...33..

# NE aim: rifle pointing up-right. Muzzle pixel (24,5).
== arms.ne.aim 11,4
............x
...........Xx
..........Xx.
.........Xx..
........Xx...
......LSx....
.....SSx.33..
....xxx.3333.
...xx...333..
.......33....
`;
