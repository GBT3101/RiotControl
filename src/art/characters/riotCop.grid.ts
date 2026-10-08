/* Riot Control officer — hand-authored pixel grids (keys: see COP_KEYS in riotCop.ts).
 * Interior canvas 13×18 (outline is added automatically). Do not reformat. */

/** Head + torso, facing SE. 13×13, attaches at 'body'. */
export const UPPER_SE = `
....34432....
...3444332...
..344433322..
..333333221..
..32VVvvvx1..
..21LSSSSs1..
..21SSeSeSs..
...1sSSsSs...
..332112221..
..3yyYYYYO1..
..2YYYYYOO1..
..222222111..
..kkkckkkkk..
`;

/** Head + torso, facing NE (back three-quarter). 13×13. */
export const UPPER_NE = `
....34432....
...3444332...
..344443322..
..334433321..
..333333221..
..233332211..
..122222111..
...k1111k....
..332222221..
..3yyYYYYO1..
..2YYYYYOO1..
..222222111..
..kkkkkkkkk..
`;

/** Riot shield held in front (SE). 5×8, attaches at 'shield'. */
export const SHIELD_SE = `
.ffq.
fPPpq
fWPpq
fPWpq
fPPWq
fPPpq
fpppq
.qqq.
`;

/** Shield edge peeking out behind the left shoulder (NE). 3×9, drawn behind the body. */
export const SHIELD_NE = `
.ff
fqq
fpq
fpq
fpq
fpq
fpq
fqq
.ff
`;

/** Baton arm (near side) for SE, attaches at 'arm'. 3×7, frames: rest, swing fwd, swing back. */
export const ARM_SE = `
.33
.32
.32
.1k
mb.
b..
b..
`;

/** Baton arm (near side) for NE. 3×7. */
export const ARM_NE = `
33.
23.
21.
k1.
.bm
..b
..b
`;

/** Legs, idle stance (body bobs above). 13×5, attaches at 'legs' (row 13). */
const LEGS_STAND = `
...3222212...
...322.212...
...321.211...
.%nBBB.nBBB%.
..%%%%%%%%%..
`;

export const LEGS_IDLE = [LEGS_STAND, LEGS_STAND, LEGS_STAND, LEGS_STAND].join('\n\n');

/** Walk cycle legs: contact, down, pass, contact (other foot), down, pass. 13×5 each. */
export const LEGS_WALK = `
...3222222...
..322...221..
.321.....21..
.nBB.....nBB.
..%%%%%%%%%..

...3222221...
..3221.221...
..321..211...
.%nBB..nBB%..
..%%%%%%%%%..

...3222221...
...32212.....
...32.211....
.%.nBBnBB.%..
..%%%%%%%%%..

...3222222...
..321...222..
.32......21..
.nBB.....nBB.
..%%%%%%%%%..

...3222221...
...322.2221..
...321..211..
..%nBB..nBB%.
..%%%%%%%%%..

....3222221..
.....32212...
....321.21...
..%..nBBnBB%.
..%%%%%%%%%..
`;
