/* M4c hand-drawn 2D stamps: flames, smoke & dust puffs, stencils, micro font.
 * Keys are resolved in stamps.ts. Do not reformat. */

/** Big flame tongue, 4-frame flicker loop. 9×13. r o y Y W = fire ramp dark → white-hot. */
export const FLAME_L = `
...r.....
...rr....
..ror....
..roor...
.roor..r.
.royor.r.
.royyorr.
royYyyor.
royYYyor.
royYWYyor
.oyYWWyo.
.ryYWWYr.
..rrrrr..

.....r...
....rr...
....ror..
...roor..
.r.royor.
.r.royor.
.rroyyor.
.royyYor.
royYYYyor
royYWYyor
.oyWWYyo.
.ryYWWyr.
..rrrrr..

.........
....r....
....r....
...ror...
..rooor..
..royor..
.roryyor.
.royYyor.
royYYYyor
royYWYyor
.oyWWWyo.
.ryYWWYr.
..rrrrr..

.........
.........
...r.....
...rr..r.
..ror..r.
..roor.or
.royoror.
.royyoyor
royYYyyor
royYWYyor
.oyWWYyo.
.ryYWWyr.
..rrrrr..
`;

/** Small flame, 4 frames. 5×8. */
export const FLAME_S = `
..r..
..r..
.ror.
.ror.
royor
roYor
rYWyr
.rrr.

.....
..r..
.rr..
.ror.
royor
royYr
rYWyr
.rrr.

..r..
.r...
.ror.
.ror.
royr.
royor
ryWYr
.rrr.

.....
...r.
..rr.
.ror.
royor
rYyor
rYWyr
.rrr.
`;

/** Smoke / dust puffs, lit from the upper left (a lightest … d darkest). */
export const PUFF_S = `
.ab.
abbc
bccd
.dd.
`;

export const PUFF_M = `
..aab..
.aabbc.
abbbccd
abbccdd
.bccdd.
..ddd..
`;

export const PUFF_L = `
...aab...
..aabbbc.
.aabbbccd
abbbbccdd
abbbcccdd
.bcccddd.
..cdddd..
`;

/** Ministry star (side doors), white stencil. */
export const STAR = `
..W..
WWWWW
.WWW.
.W.W.
`;

/** Unit chevron stencil. */
export const CHEVRON = `
W...W
WW.WW
.WWW.
..W..
`;

/** Red cross for the ambulance. */
export const CROSS = `
.RR.
RRRR
RRRR
.RR.
`;

/** Paris RATP roundel (teal ring). */
export const RATP = `
.TT.
T..T
T..T
.TT.
`;

/** London roundel (red ring, blue bar). */
export const ROUNDEL = `
.RRR.
BBBBB
.RRR.
`;

/** 3×5 micro font for stencils (only the glyphs we need). */
export const MICRO_FONT: Record<string, string> = {
  A: `.W.\nW.W\nWWW\nW.W\nW.W`,
  B: `WW.\nW.W\nWW.\nW.W\nWW.`,
  C: `.WW\nW..\nW..\nW..\n.WW`,
  D: `WW.\nW.W\nW.W\nW.W\nWW.`,
  E: `WWW\nW..\nWW.\nW..\nWWW`,
  I: `WWW\n.W.\n.W.\n.W.\nWWW`,
  L: `W..\nW..\nW..\nW..\nWWW`,
  M: `W.W\nWWW\nWWW\nW.W\nW.W`,
  N: `WW.\nW.W\nW.W\nW.W\nW.W`,
  O: `.W.\nW.W\nW.W\nW.W\n.W.`,
  P: `WW.\nW.W\nWW.\nW..\nW..`,
  R: `WW.\nW.W\nWW.\nW.W\nW.W`,
  S: `.WW\nW..\n.W.\n..W\nWW.`,
  T: `WWW\n.W.\n.W.\n.W.\n.W.`,
  U: `W.W\nW.W\nW.W\nW.W\nWWW`,
  X: `W.W\nW.W\n.W.\nW.W\nW.W`,
  '0': `WWW\nW.W\nW.W\nW.W\nWWW`,
  '1': `.W.\nWW.\n.W.\n.W.\nWWW`,
  '7': `WWW\n..W\n.W.\n.W.\n.W.`,
  ' ': `...\n...\n...\n...\n...`,
};
