/* HUD icons, button glyphs and cursors — hand-authored grids. Keys per icon in icons.ts.
 * Do not reformat. */

/** Hate: furious red face — V brows, glaring eyes, clenched teeth in a frown (13×13). */
export const HATE = `
....ooooo....
..oohHHRRoo..
.ohHRRRRRRro.
.oHkkRRRkkro.
ohRRkkRkkRRro
oRRwwkRkwwrro
oRRRwkRkwrrro
oRRRRRRRRRrro
oRRRkkkkkRrro
.oRkwwwwwkro.
.orkRRRRRkro.
..oorrrrroo..
....ooooo....
`;

/** Hate, tiny (8×8) for cost tags: V brows, white eyes, frown. */
export const HATE_TINY = `
..oooo..
.ohHRRo.
okkRRkko
oRwkkwro
oRRRRRro
oRkkkkro
.okRRko.
..oooo..
`;

/** Capitol pediment (13×12). */
export const CAPITOL = `
......o......
....ooWoo....
..ooWWWWsoo..
ooWWWWWWWWsoo
oSSSSSSSSSSSo
ooooooooooooo
oWsoWsoWsoWso
oWsoWsoWsoWso
oWsoWsoWsoWso
ooooooooooooo
oSSSSSSSSSSso
ooooooooooooo
`;

/** Megaphone (wave counter, 13×11). */
export const MEGAPHONE = `
........oo...
......ooRo..o
....ooRRro.o.
oooooRRRRro..
oWWoRRRRRro.o
oWWoRRRRrro.o
oooooRRRRro..
..oBo.ooRro.o
..oBo...ooro.
..ooo.....oo.
.............
`;

/** Crowd (protester count, 13×11): three heads with a sign. */
export const CROWD = `
.....ooooo...
.....oPPPo...
.....ooooo...
......oo.....
..ooo.oo.ooo.
.oSSso..oSSso
.oSSsooooSSso
..oooSSsoooo.
.oHHoSSsoGGo.
oHHHHoooGGGGo
oHHHHoHHoGGGo
`;

/** Stopwatch (timer, 11×12). */
export const STOPWATCH = `
....ooo....
....oBo....
..ooooooo..
.oWWWWWWso.
oWWWWoWWWso
oWWWWoWWWso
oWWWWooWWso
oWWWWWWWWso
oWWWWWWWWso
.osWWWWWsso
..ooooooo..
...........
`;

/** Padlock (locked cards, 9×11). */
export const PADLOCK = `
..ooooo..
.oZzzzZo.
.oZo.oZo.
.oZo.oZo.
ooooooooo
oBBBBBBbo
oBYYoYBbo
oBYYoYBbo
oBBBBBBbo
obbbbbbbo
ooooooooo
`;

/** Grenade (ability charged, 9×11) — bounces in code. */
export const GRENADE = `
....oo...
...oZzo..
..oooooo.
.oGGGGgo.
oGLGGGggo
oGGGGGggo
oGGGgGggo
oGGGGGggo
.oGGGggo.
..ooooo..
.........
`;

/** Prophets warning: hazard triangle with the cult's hourglass (15×13). */
export const PROPHET_WARN = `
.......o.......
......oYo......
.....oYYYo.....
.....oYYYo.....
....oYoooYo....
....oYoooYo....
...oYYYoYYYo...
...oYYYoYYYo...
..oYYYoroYYYo..
..oYYorrroYYo..
.oYYYoooooYYYo.
.oYYYYYYYYYYYo.
.ooooooooooooo.
`;

/* Button glyphs (9×9 masks; X = glyph). */
export const GLYPHS: Record<string, string> = {
  pause: `
    .........
    .XX..XX..
    .XX..XX..
    .XX..XX..
    .XX..XX..
    .XX..XX..
    .XX..XX..
    .XX..XX..
    .........
  `,
  play: `
    .........
    .XX......
    .XXXX....
    .XXXXXX..
    .XXXXXXX.
    .XXXXXX..
    .XXXX....
    .XX......
    .........
  `,
  sound: `
    ....X....
    ...XX..X.
    XXXXX...X
    XXXXX.X.X
    XXXXX.X.X
    XXXXX...X
    ...XX..X.
    ....X....
    .........
  `,
  mute: `
    ....X....
    ...XX....
    XXXXX....
    XXXXX.X.X
    XXXXX..X.
    XXXXX.X.X
    ...XX....
    ....X....
    .........
  `,
  settings: `
    ...X.X...
    .X.XXX.X.
    ..XXXXX..
    XXXX.XXXX
    .XX...XX.
    XXXX.XXXX
    ..XXXXX..
    .X.XXX.X.
    ...X.X...
  `,
  codex: `
    .........
    XXXX.XXXX
    X..XXX..X
    X.XXXXX.X
    X..XXX..X
    X.XXXXX.X
    X..XXX..X
    XXXXXXXXX
    ....X....
  `,
  close: `
    .........
    .XX...XX.
    .XXX.XXX.
    ..XXXXX..
    ...XXX...
    ..XXXXX..
    .XXX.XXX.
    .XX...XX.
    .........
  `,
  check: `
    .........
    .......XX
    ......XXX
    .....XXX.
    XX..XXX..
    XXXXXX...
    .XXXX....
    ..XX.....
    .........
  `,
  plus: `
    .........
    ...XXX...
    ...XXX...
    XXXXXXXXX
    XXXXXXXXX
    XXXXXXXXX
    ...XXX...
    ...XXX...
    .........
  `,
  next: `
    .........
    ..XX.....
    ..XXXX...
    ..XXXXXX.
    ..XXXXXXX
    ..XXXXXX.
    ..XXXX...
    ..XX.....
    .........
  `,
};

/* Cursors (pointer / command). Hotspot noted in icons.ts. */
export const CURSOR_POINTER = `
oo..........
oWo.........
oWWo........
oWWWo.......
oWWWWo......
oWWWWWo.....
oWWWWWWo....
oWWWWWWWo...
oWWWWWoooo..
oWWoWWo.....
oWo.oWWo....
oo..oWWo....
.....oo.....
`;

export const CURSOR_MOVE = `
....ooooo....
....oYYYo....
....oYYYo....
....oYYYo....
.ooooYYYoooo.
.oYYYYYYYYYo.
..oYYYYYYYo..
...oYYYYYo...
....oYYYo....
.....oYo.....
......o......
..ooo...ooo..
.o.........o.
..ooo...ooo..
`;

export const CURSOR_ATTACK = `
.....ooo.....
.....oRo.....
...ooRRRoo...
..oRo.R.oRo..
.oR...R...Ro.
ooR.......Roo
oRRRR.o.RRRRo
ooR.......Roo
.oR...R...Ro.
..oRo.R.oRo..
...ooRRRoo...
.....oRo.....
.....ooo.....
`;

export const CURSOR_DENY = `
...ooooo...
..oRRRRRo..
.oRRoooRRo.
oRRo..oRRRo
oRo..oRRoRo
oRo.oRRo.Ro
oRooRRo..Ro
oRRRRo..oRo
.oRRoooRRo.
..oRRRRRo..
...ooooo...
`;

export const CURSOR_DEPLOY = `
.......oooo..
......oBBbo..
......oBBbo..
.......oBo...
.......oBo...
.....oooBooo.
....oRRRRRRro
....oRRRRRRro
.....ooooooo.
.............
..o.o.o.o.o..
.............
`;
