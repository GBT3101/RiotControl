/* Protester hair styles (M4b) — part book, keys: BODY_KEYS (H/h/G = $hair). Do not reformat.
 * Same origin as the heads (neck pixel; head box 9×9 → origin 4,8). `hair.X.se` / `hair.X.ne`
 * draw over the head; `hairback.X.se` draws behind the torso (long hair seen from the front). */

export const HAIR_BOOK = `
== hair.short.se 4,8
...hhHh..
..hHHGGh.
.hHHHHGGh
.hHHHHhH.
.hHh.....
..h......

== hair.short.ne 4,8
...hhHh..
..hHHGGh.
.hHHHHGHh
.hHHHHHHh
.hHHHHHHh
..hHHHHh.
...hhhh..

== hair.buzz.se 4,8
.........
...hhHh..
..hHHHHh.
.hHhhhh..
.hh......

== hair.buzz.ne 4,8
.........
...hhHh..
..hHHHHh.
.hHHHHHHh
.hHhhhhHh
..hhhhhh.

== hair.bob.se 4,8
...hHHh..
.hhHHGGh.
hHHHHHGGh
hHHHHHHHh
hHHh....H
hHHh.....
hhHh.....
.hh......

== hair.bob.ne 4,8
...hHHh..
.hhHHGGh.
hHHHHHGGh
hHHHHHHHh
hHHHHHHHh
hHHHHHHHh
hhHHHHHhh
.hhhhhhh.

== hair.afro.se 5,10
...hHHHh...
.hhHHGGHHh.
hHHHHHGGGHh
hHHHHHHGHHh
hHHHHHHHHHh
hHHHHHhhHh.
hHHHh......
.hHHh......
..hh.......

== hair.afro.ne 5,10
...hHHHh...
.hhHHGGHHh.
hHHHHHGGGHh
hHHHHHHGHHh
hHHHHHHHHHh
hHHHHHHHHHh
hHHHHHHHHHh
.hHHHHHHHh.
..hhhhhhh..

== hair.mohawk.se 4,10
....hG...
...hHG...
...hHGh..
..hHHGh..
..hHHh...

== hair.mohawk.ne 4,10
....hG...
...hHG...
...hHGh..
..hHHGh..
..hHHHh..
..hHHh...
...hh....

== hair.bun.se 4,10
...hHh...
..hHGGh..
...hhh...
..hHHGh..
.hHHHHGh.
.hHHHhhH.
.hHh.....
..h......

== hair.bun.ne 4,10
...hHh...
..hHGGh..
...hhh...
..hHHGh..
.hHHHHGHh
.hHHHHHHh
.hHHHHHHh
..hHHHHh.
...hhhh..

== hair.long.se 4,8
...hHHh..
..hHHGGh.
.hHHHHGGh
.hHHHHHhH
.hHH....H
.hHH.....
.hHH.....
.hh......

== hairback.long.se 4,8
.........
.........
.........
.........
.........
hH.......
hH.......
hH.......
hh.......
hH.......
hh.......

== hair.long.ne 4,8
...hHHh..
..hHHGGh.
.hHHHHGGh
.hHHHHHHh
.hHHHHHHh
.hHHHHHHh
.hHHHHHHh
.hHHHHHHh
..hHHHHh.
..hHHHHh.
...hhhh..

== hair.curly.se 5,8
...hHhH....
.hHGhHGh...
hHGHHGHGh..
hHHHHHhHH..
hHhH.......
hHHh.......
.hh........

== hair.curly.ne 5,8
...hHhH....
.hHGhHGh...
hHGHHGHGh..
hHHGHHHGHh.
hHHHHGHHHh.
hHGHHHHGHh.
.hHHGHHHh..
..hhhhhh...

== hair.ponytail.se 4,8
...hhHh..
..hHHGGh.
.hHHHHGGh
.hHHHHhH.
.hHh.....
hh.......
hH.......
.h.......

== hair.ponytail.ne 4,8
...hhHh..
..hHHGGh.
.hHHHHGHh
.hHHHHHHh
.hHhGHhHh
..hHGHh..
...hHh...
...hHh...
....h....

== hair.braids.se 4,8
...hHHh..
..hHGGHh.
.hHHHGGHh
.hHhHHHh.
.hH.....h
hH.......
hH.......
Hh.......
hh.......

== hair.braids.ne 4,8
...hHHh..
..hHGGHh.
.hHHHGGHh
.hHHHHHHh
.hHHhHHHh
hHhHhHhHh
hH.....hH
Hh.....Hh
hh.....hh

== hair.mullet.se 4,8
...hhHh..
..hHHGGh.
.hHHHGGh.
.hHHHhh..
.hHh.....
hHHh.....
hHh......
hh.......

== hair.mullet.ne 4,8
...hhHh..
..hHHGGh.
.hHHHGGHh
.hHHHHHHh
.hHHHHHHh
hHHHHHHHh
hHHHHHHhh
.hhhhhhh.

== hair.spiky.se 4,9
.h.h.h...
.hHhGhG..
..hHHGGh.
.hHHHHGGh
.hHhHhH..
.hHh.....
..h......

== hair.spiky.ne 4,9
.h.h.h.h.
.hHhGhGh.
..hHHGGh.
.hHHHHGHh
.hHHHHHHh
.hHHHHHHh
..hHhHhh.

== hair.wild.se 5,9
.h..h.h....
hHh.hGhh...
.hHHHGGHh..
hHHHHHHGGh.
.hHHHhHhH..
hHHh....h..
.hHh.......
hh.........

== hair.wild.ne 5,9
.h..h.h.h..
hHh.hGhhGh.
.hHHHGGHHh.
hHHHHHHGHHh
.hHHHHHHHh.
hHHHHHHHHHh
.hHHHHHHHh.
hh.hhhhh.hh

== hair.pixie.se 4,8
...hhHhh.
..hHHGGHh
.hHHHHGGH
.hhhHHHH.
.hh......

== hair.pixie.ne 4,8
...hhHhh.
..hHHGGHh
.hHHHHGHh
.hHHHHHHh
.hHHHHHHh
.hhhhHHhh
..hhhhh..

== hair.dreads.se 4,8
..hHhHh..
.hHGHGHh.
hHHHHGHHh
hHhHhHhH.
hHhH.....
hh.h.....
hH.H.....
h..h.....

== hair.dreads.ne 4,8
..hHhHh..
.hHGHGHh.
hHHHHGHHh
hHHHHHHHh
hHhHhHhHh
hHhHhHhHh
hH.H.h.Hh
h..H.h..h

== hair.bald.se 4,8
.........
....LL...
.........

== hair.bald.ne 4,8
.........
....LL...
.........

== hair.combover.se 4,8
.........
...hHHHh.
..h.LS...
.hh......
.hh......

== hair.combover.ne 4,8
.........
...hHHHh.
..hLSLSh.
.hhSSSShh
.hHhhhhHh
..hhhhh..
`;

/** Beards / facial hair (SE only — the NE back view hides them). Same head-box origin. */
export const BEARD_BOOK = `
== beard.full.se 4,8
.........
.........
.........
.........
.........
.hh....h.
..hHHHhH.
...hHHh..
....hh...

== beard.stubble.se 4,8
.........
.........
.........
.........
.........
.........
..s..s.s.
...ssss..
.........

== beard.moustache.se 4,8
.........
.........
.........
.........
.........
.....hHh.
.........
.........
.........

== beard.prophet.se 4,8
.........
.........
.........
.........
.........
.hh....h.
.hhHHHHH.
..hHHGHh.
..hHHGHh.
...hHHh..
...hHh...
....h....
`;
