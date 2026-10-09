/* "Dossier Small" — 5×7 cap-height pixel font (HUD numbers, labels, advisor text).
 * Each glyph: `@<char>` then rows of X (ink) / . (empty). Rows start at the cap line;
 * 7 cap rows + up to 2 descender rows (lowercase x-height = 5, starting on cap row 2).
 * Accented letters are composed in code (see fonts/index.ts). Do not reformat. */
export const SMALL_GLYPHS = `
@A
.XXX.
X...X
X...X
XXXXX
X...X
X...X
X...X

@B
XXXX.
X...X
X...X
XXXX.
X...X
X...X
XXXX.

@C
.XXX.
X...X
X....
X....
X....
X...X
.XXX.

@D
XXXX.
X...X
X...X
X...X
X...X
X...X
XXXX.

@E
XXXXX
X....
X....
XXXX.
X....
X....
XXXXX

@F
XXXXX
X....
X....
XXXX.
X....
X....
X....

@G
.XXX.
X...X
X....
X.XXX
X...X
X...X
.XXXX

@H
X...X
X...X
X...X
XXXXX
X...X
X...X
X...X

@I
XXX
.X.
.X.
.X.
.X.
.X.
XXX

@J
..XX
...X
...X
...X
X..X
X..X
.XX.

@K
X...X
X..X.
X.X..
XX...
X.X..
X..X.
X...X

@L
X...
X...
X...
X...
X...
X...
XXXX

@M
X...X
XX.XX
X.X.X
X.X.X
X...X
X...X
X...X

@N
X...X
XX..X
XX..X
X.X.X
X..XX
X..XX
X...X

@O
.XXX.
X...X
X...X
X...X
X...X
X...X
.XXX.

@P
XXXX.
X...X
X...X
XXXX.
X....
X....
X....

@Q
.XXX.
X...X
X...X
X...X
X.X.X
X..X.
.XX.X

@R
XXXX.
X...X
X...X
XXXX.
X.X..
X..X.
X...X

@S
.XXX.
X...X
X....
.XXX.
....X
X...X
.XXX.

@T
XXXXX
..X..
..X..
..X..
..X..
..X..
..X..

@U
X...X
X...X
X...X
X...X
X...X
X...X
.XXX.

@V
X...X
X...X
X...X
X...X
.X.X.
.X.X.
..X..

@W
X...X
X...X
X...X
X.X.X
X.X.X
XX.XX
X...X

@X
X...X
X...X
.X.X.
..X..
.X.X.
X...X
X...X

@Y
X...X
X...X
.X.X.
..X..
..X..
..X..
..X..

@Z
XXXXX
....X
...X.
..X..
.X...
X....
XXXXX

@0
.XXX.
X...X
X..XX
X.X.X
XX..X
X...X
.XXX.

@1
..X..
.XX..
..X..
..X..
..X..
..X..
.XXX.

@2
.XXX.
X...X
....X
...X.
..X..
.X...
XXXXX

@3
XXXXX
...X.
..X..
...X.
....X
X...X
.XXX.

@4
...X.
..XX.
.X.X.
X..X.
XXXXX
...X.
...X.

@5
XXXXX
X....
XXXX.
....X
....X
X...X
.XXX.

@6
..XX.
.X...
X....
XXXX.
X...X
X...X
.XXX.

@7
XXXXX
....X
...X.
..X..
.X...
.X...
.X...

@8
.XXX.
X...X
X...X
.XXX.
X...X
X...X
.XXX.

@9
.XXX.
X...X
X...X
.XXXX
....X
...X.
.XX..

@a
....
....
.XX.
...X
.XXX
X..X
.XXX

@b
X...
X...
XXX.
X..X
X..X
X..X
XXX.

@c
....
....
.XXX
X...
X...
X...
.XXX

@d
...X
...X
.XXX
X..X
X..X
X..X
.XXX

@e
....
....
.XX.
X..X
XXXX
X...
.XXX

@f
.XX
X..
XXX
X..
X..
X..
X..

@g
....
....
.XXX
X..X
X..X
X..X
.XXX
...X
.XX.

@h
X...
X...
XXX.
X..X
X..X
X..X
X..X

@i
X
.
X
X
X
X
X

@ı
.
.
X
X
X
X
X

@j
.X
..
.X
.X
.X
.X
.X
.X
X.

@k
X...
X...
X..X
X.X.
XX..
X.X.
X..X

@l
X.
X.
X.
X.
X.
X.
.X

@m
.....
.....
XXXX.
X.X.X
X.X.X
X.X.X
X.X.X

@n
....
....
XXX.
X..X
X..X
X..X
X..X

@o
....
....
.XX.
X..X
X..X
X..X
.XX.

@p
....
....
XXX.
X..X
X..X
X..X
XXX.
X...
X...

@q
....
....
.XXX
X..X
X..X
X..X
.XXX
...X
...X

@r
...
...
X.X
XX.
X..
X..
X..

@s
....
....
.XXX
X...
.XX.
...X
XXX.

@t
X..
X..
XXX
X..
X..
X..
.XX

@u
....
....
X..X
X..X
X..X
X..X
.XXX

@v
.....
.....
X...X
X...X
.X.X.
.X.X.
..X..

@w
.....
.....
X...X
X...X
X.X.X
X.X.X
.X.X.

@x
....
....
X..X
X..X
.XX.
X..X
X..X

@y
....
....
X..X
X..X
X..X
X..X
.XXX
...X
.XX.

@z
....
....
XXXX
...X
.XX.
X...
XXXX

@!
X
X
X
X
X
.
X

@?
.XX.
X..X
...X
..X.
.X..
....
.X..

@¡
X
.
X
X
X
X
X

@¿
..X.
....
..X.
.X..
X...
X..X
.XX.

@.
.
.
.
.
.
.
X

@,
..
..
..
..
..
..
.X
X.

@:
.
.
X
.
.
.
X

@;
..
..
.X
..
..
..
.X
X.

@-
...
...
...
XXX

@+
.....
..X..
..X..
XXXXX
..X..
..X..

@=
...
...
XXX
...
XXX

@×
.....
.....
X...X
.X.X.
..X..
.X.X.
X...X

@'
X
X

@"
X.X
X.X

@/
..X
..X
.X.
.X.
.X.
X..
X..

@(
.X
X.
X.
X.
X.
X.
.X

@)
X.
.X
.X
.X
.X
.X
X.

@%
XX..X
XX..X
...X.
..X..
.X...
X..XX
X..XX

@#
.X.X.
XXXXX
.X.X.
.X.X.
XXXXX
.X.X.

@&
.XX..
X..X.
X.X..
.X...
X.X.X
X..X.
.XX.X

@£
.XX.
X..X
X...
XXX.
X...
X...
XXXX

@€
..XXX
.X...
XXXX.
.X...
XXXX.
.X...
..XXX

@*
.....
X.X.X
.XXX.
X.X.X

@_
....
....
....
....
....
....
....
XXXX

@<
..X
.X.
X..
.X.
..X

@>
X..
.X.
..X
.X.
X..
@·
.
.
.
X

@«
.....
.....
.X.X.
X.X..
.X.X.

@»
.....
.....
.X.X.
..X.X
.X.X.

@°
.X.
X.X
.X.
`;

/** Accent marks (2 rows), centred over the base glyph. */
export const SMALL_ACCENTS = `
@acute
.X
X.

@grave
X.
.X

@circ
.X.
X.X

@diaer
...
X.X

@tilde
.X.X
X.X.

@cedilla
.X
X.
`;
