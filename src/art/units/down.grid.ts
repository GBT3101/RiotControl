/* Rammed-over poses (playtest round): the seated, dazed "bowled over" legs shared by the
 * ground units without a KO rig of their own (riot has `ko.body`), and the weapons they drop
 * when the crowd knocks them flat. Same canvas conventions as body.grid.ts (24×26, feet on
 * row 22). Leg keys: 1-4 trousers, K knee, n/B/b boots; weapon keys are the owning unit's.
 * Do not reformat. */

/** Sitting on the street, legs out toward the camera, boots up (matches riot `ko.body`). */
export const DOWN_LEG_PARTS = `
== legs.sit 6,17
..33332222...nB.
.333333222222nBb
.3333331122222Bb
..33333333K3nBb.
...........nBBb.
...........bbb..
`;

/** Armed cop: the pistol skitters out of his hands. */
export const COP_DOWN_PARTS = `
== pistol.ground 0,0
.XXXX
GGoo.
.o...
`;

/** Tear gas: the launcher lies on the street. */
export const GAS_DOWN_PARTS = `
== launcher.ground 0,0
.xXXXX..
OxxxxxXX
O..xxxxo
`;

/** Soldier: the rifle lands flat on the street. */
export const SOLDIER_DOWN_PARTS = `
== rifle.ground 0,0
.xXXXXXXXXXx
xxxxxxxxxxx.
..x.xx......
`;
