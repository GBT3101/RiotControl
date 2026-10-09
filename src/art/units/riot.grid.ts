/* Riot Control officer — part book (keys: RIOT_KEYS in riot.ts). Canvas 24×26, feet on row 22.
 * Headers: `== name x,y` = top-left on the canvas. Do not reformat. */

export const RIOT_PARTS = `
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

# ---------------------------------------------------------------- SE (front three-quarter)
== torso 7,11
.2444332..
3444443321
3yYYYYyy21
3yyyyyyy21
.333332221
.oooogooo.

== head 6,3
....3444....
..33444443..
.3344444432.
.333333zzzz.
.2233Vwwwwvz
.2232wewwevz
.22123LLLLs.
..1123SSSms.
...11.ssss..

# Visor raised: the smug face.
== head.up 6,3
....3zzzz...
..334vwwVz..
.3344444zz2.
.3333333332.
.2233oLLoLs.
.2232eLLeLs.
.22123LLLLs.
..1123SSmms.
...11.ssss..

== head.blink 6,3
....3zzzz...
..334vwwVz..
.3344444zz2.
.3333333332.
.2233oLLoLs.
.2232sLLsLs.
.22123LLLLs.
..1123SSmms.
...11.ssss..

# Pain: visor knocked up, eyes squeezed, mouth open.
== head.hurt 6,3
....3zzzz...
..334vwwVz..
.3344444zz2.
.3333333332.
.2233LLLLLs.
.2232eeLeeL.
.22123LLLLs.
..1123SmmSs.
...11.ssss..

== arm.rest 3,11
.344.
34443
3443.
.32..
.hH..
xhh..
x....
x....

== arm.fwd 3,11
.344..
34443.
.3443.
..332.
...hH.
..xhh.
.x....
x.....

== arm.back 2,11
..344.
.34443
3443..
32....
hH....
hh....
x.....
x.....

# Wind-up: baton cocked high behind the helmet.
== arm.up 1,2
x.......
.x......
..x.....
..XhH...
...hh...
...43...
...432..
...4432.
...3444.
..34443.
..3443..

# Swing smear (fast frame): arm overhead and forward, baton blurred.
== arm.over 3,1
.......hHXXxx
.......hhX...
......443....
......432....
.....443.....
.....432.....
....443......
....432......
...4432......
...3443......
.34443.......
34443........
3443.........

== smear 1,0
....vVVVVv.......
..vV......VV.....
.v..........V....
v................
v................

# Impact: arm thrust forward, baton chopping down over the shield rim.
== arm.strike 3,11
.344..............
34443.............
.344443333hH......
..2332222.hhxX....
............xxX...
.............xxX..
..............xx..

== arm.tap 3,10
.............X
............xx
.344.......xX.
34443.....xX..
.3443....xX...
..3443..xX....
...3433hH.....
.....33hh.....

== shield 14,11
.fqqq.
fPWPpq
fWPPpq
fPPPpq
f2W22q
f2222q
fPPPpq
fPPWpq
.qqqq.

== shield.tilt 13,11
...fqq.
..fWPpq
.fWPPpq
fPPPpq.
f2W22q.
f2222q.
fPPPpq.
fPPWq..
.qqq...

== shield.ground 13,19
..fqqqqq.
.fPPW22Pq
fPPP22PPq
.qqqqqqq.

== shield.held 14,4
.fqqq.
fPWPpq
fWPPpq
fPPPpq
f2W22q
f2222q
fPPPpq
fPPWpq
.qqqq.

# ---------------------------------------------------------------- deaths / KO (shared by SE+NE)
== fall 1,8
...3444.........
.33444443.......
.3444443zz......
.33333zVwz......
.2233oeLLs......
..2123LmLs.344..
...11sss344443..
.......3yYYyy21.
.......3yyyyy21.
........3332221.
.........332.221
.........32..221
........nBb..nBb
........bbbb.bbb

== fall.ne 1,8
...3444.........
.33444443.......
.34444443.......
.33444433.......
.22333322z......
..2122222.344...
...1111.344443..
.......3YYYYy21.
.......3yoyoy21.
........3332221.
.........332.221
.........32..221
........nBb..nBb
........bbbb.bbb

== lie 0,13
..3444................
.334444zz..........Hb.
3344444Vwz.2444...3nBb
3333333wwz344443322Bb.
.2223LLLLs3yYYYy33322.
..11sSmSs.3yyyyy2222..
.........hH33332......

== lie.flat 0,13
......................
..3444..............b.
.334444zz.2444....3nBb
3344444Vwz344443322Bb.
3333LLLLs.3yYYYy33322.
.222sSmSs.3yyyyy2222..
.........hH33332......

== ko.body 4,12
.....3333........
....344443.......
...3yYYYy21......
...3yyyyy21......
...33333221......
..hH.3333222hH...
..hh.333.222hh...
.......nBb..nBb..
.......bbbb.bbbb.

== ko.head 6,4
....3zzzz...
..334vwwVz..
.3344444zz2.
.3333333332.
.2233eLLeLs.
.2232LLLLLs.
.22123LLLLs.
..1123SoSSs.
...11.ssss..

# ---------------------------------------------------------------- NE (back three-quarter)
== torso.ne 7,11
.2333322..
3444433321
3YYYYYYyy1
3yoyoyoyy1
.333332221
.oooooooo.

== head.ne 6,3
....3444....
..33444443..
.3344444432.
.3344443332z
.333333322zz
.233333222z.
.222222221..
..2222221...
...11111....

== arm.ne.rest 15,11
.443.
44443
.3443
..23.
..Hh.
..hhx
....x
....x

== arm.ne.up 16,2
.......x
......x.
.....x..
...hHX..
...hh...
...34...
..334...
.3443...
.4443...
44443...
.3443...

== arm.ne.strike 15,6
...........x.
..........xX.
.........hH..
........hh...
.......34....
.443..344....
44443443.....
.34443.......
..23.........

== shield.ne 3,11
.fqq.
fqpPf
fqppf
fqo2f
fqppf
fqppf
fqppf
fqppf
.fff.
`;
