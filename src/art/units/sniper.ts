/**
 * Rooftop snipers. `makeRooftop()` builds the kneeling rooftop set + the thrown-off-the-roof
 * set for a look (part book + keys); the Rubber Sniper (nervous rookie, orange less-lethal
 * stock) and the Sniper Brigade (brigade.ts) share it.
 */
import type { KeyMap } from '../lib/grid';
import type { RampName } from '../palette';
import { LEG_PARTS } from './body.grid';
import { mergeBooks, parseParts, type AnimDef, type Part, type UnitDef } from './kit';
import { cycle } from './poses';
import { SNIPER_PARTS, THROWN_PARTS } from './sniper.grid';

export const SNIPER_KEYS: KeyMap = {
  o: 'ink',
  '1': 'navy.1',
  '2': 'navy.2',
  '3': 'navy.3',
  '4': 'navy.4',
  K: 'navy.2',
  y: 'hivis.1',
  Y: 'hivis.2',
  g: 'ochre2',
  S: '$skin.1',
  L: '$skin.2',
  s: '$skin.0',
  e: 'ink',
  m: 'earth1',
  R: 'rust3',
  r: 'rust2',
  x: 'gray1',
  X: 'gray4',
  w: 'sky',
  n: 'gray3',
  B: 'gray2',
  b: 'gray1',
  F: 'ochre4',
  f: 'ochre3',
  W: 'white',
};

export interface RooftopLook {
  readonly id: string;
  readonly book: ReadonlyMap<string, Part>;
  readonly thrownBook: ReadonlyMap<string, Part>;
  readonly keys: KeyMap;
  readonly skin: RampName;
  /** Muzzle-flash part name and its top-left for the SE recoil frame. */
  readonly flash: { readonly se: string; readonly ne: string };
  readonly muzzle: { readonly se: { x: number; y: number }; readonly ne: { x: number; y: number } };
  readonly fireNote: string;
  /** Canvas width (long rifles need more room on the right). */
  readonly width?: number;
}

const FIRE_HEAD = 'head+1,1';

function rooftopAnims(look: RooftopLook): AnimDef[] {
  const se = (body: string, head: string, arms: string, extra = ''): string =>
    `_shadow legs.kneel >${body} torso ${head} ${arms} ${extra}`.trim();
  const ne = (body: string, arms: string, extra = '', head = 'head.ne'): string =>
    `_shadow legs.kneel >${body} torso.ne ${head} ${arms} ${extra}`.trim();
  const FALL = ['_shadow.long fall', '_shadow.long lie+0,-1', '_shadow.long lie', '_shadow.long lie.flat'];
  const CLIMB = [
    'climb.0',
    'climb.1',
    'climb.2',
    se('0,0', 'head.up', 'arms.ready+0,1'),
    se('0,0', 'head', 'arms.ready'),
    se('0,0', 'head', 'arms.ready'),
  ];
  return [
    {
      anim: 'idle',
      fps: 5,
      loop: true,
      note: 'Kneeling on the roof, rifle up, scanning.',
      se: cycle(4, (i) => se(`0,${[0, 0, 1, 1][i]}`, `head+${[0, 0, 0, -1][i]},0`, 'arms.ready')),
      ne: cycle(4, (i) => ne(`0,${[0, 0, 1, 1][i]}`, 'arms.ne.ready')),
    },
    {
      anim: 'fidget',
      fps: 6,
      loop: false,
      note: 'Pushes the slipping helmet up, looks around, it slides back down. NE: glances.',
      se: [
        se('0,0', 'head', 'arms.ready'),
        se('0,0', 'head.up', 'arms.ready'),
        se('0,0', 'head.up+-1,0', 'arms.ready'),
        se('0,0', 'head.up+1,0', 'arms.ready'),
        se('0,0', 'head.up', 'arms.ready'),
        se('0,1', 'head', 'arms.ready'),
        se('0,0', 'head.blink', 'arms.ready'),
        se('0,0', 'head', 'arms.ready'),
      ],
      ne: cycle(8, (i) => ne('0,0', 'arms.ne.ready', '', `head.ne+${[0, -1, -1, 0, 1, 1, 0, 0][i]},0`)),
    },
    {
      anim: 'aim',
      fps: 10,
      loop: false,
      note: 'Ready → aim transition (hold the last frame while tracking).',
      se: [
        se('0,0', 'head', 'arms.ready'),
        se('0,0', 'head', 'arms.aim+-1,-2'),
        se('0,0', FIRE_HEAD, 'arms.aim'),
      ],
      ne: [ne('0,0', 'arms.ne.ready'), ne('0,0', 'arms.ne.aim+-1,1'), ne('0,0', 'arms.ne.aim')],
    },
    {
      anim: 'attack',
      fps: 12,
      loop: false,
      impact: 1,
      note: look.fireNote,
      se: [
        se('0,0', FIRE_HEAD, 'arms.aim'),
        se('-1,0', `${FIRE_HEAD} arms.recoil`, '', `> !${look.flash.se}`),
        se('-1,0', FIRE_HEAD, 'arms.aim+-1,0'),
        se('0,0', FIRE_HEAD, 'arms.bolt'),
        se('0,0', FIRE_HEAD, 'arms.aim'),
      ],
      ne: [
        ne('0,0', 'arms.ne.aim'),
        ne('-1,1', 'arms.ne.aim', `> !${look.flash.ne}`),
        ne('-1,1', 'arms.ne.aim'),
        ne('0,0', 'arms.ne.aim+0,1'),
        ne('0,0', 'arms.ne.aim'),
      ],
      muzzle: { se: [null, look.muzzle.se, null, null, null], ne: [null, look.muzzle.ne, null, null, null] },
    },
    {
      anim: 'reload',
      fps: 8,
      loop: false,
      note: 'Rifle tipped up, thumbs a round in, back to ready.',
      se: [
        se('0,0', 'head', 'arms.ready'),
        se('0,1', 'head', 'arms.reload'),
        se('0,1', 'head.blink', 'arms.reload', 'round@14,15'),
        se('0,1', 'head', 'arms.reload', 'round@15,14'),
        se('0,0', 'head', 'arms.reload+0,-1'),
        se('0,0', 'head', 'arms.ready'),
      ],
      ne: [
        ne('0,0', 'arms.ne.ready'),
        ne('0,1', 'arms.ne.ready+0,1'),
        ne('0,1', 'arms.ne.ready+0,2'),
        ne('0,1', 'arms.ne.ready+0,1'),
        ne('0,0', 'arms.ne.ready+0,-1'),
        ne('0,0', 'arms.ne.ready'),
      ],
    },
    {
      anim: 'deploy',
      fps: 8,
      loop: false,
      note: 'Climb-up arrival: hands on the roof edge, hauls himself up, kneels. Roof edge = row 22.',
      se: CLIMB,
      ne: CLIMB,
    },
    {
      anim: 'death',
      fps: 10,
      loop: false,
      note: 'Shot on the roof (bazooka/rifle): jolts, topples sideways, settles. Ends on `body`.',
      se: [
        se('-1,0', 'head.hurt', 'arms.ready+-1,-1'),
        se('-2,1', 'head.hurt', 'arms.ready+-2,1'),
        ...FALL,
        '_shadow.long lie.flat',
      ],
      ne: [ne('-1,0', 'arms.ne.ready+-1,-1'), ne('-2,1', 'arms.ne.ready+-2,1'), ...FALL, '_shadow.long lie.flat'],
    },
    {
      anim: 'body',
      fps: 0,
      loop: false,
      se: ['_shadow.long lie.flat'],
      ne: ['_shadow.long lie.flat'],
    },
  ];
}

const THROWN_ANIMS: AnimDef[] = [
  {
    anim: 'grabbed',
    fps: 8,
    loop: true,
    note: 'Seized by climbers: rifle lost, windmilling. Loop until the throw.',
    se: ['_shadow grab', '_shadow grab+1,0', '_shadow ~grab', '_shadow ~grab+-1,0'],
  },
  {
    anim: 'flail',
    fps: 12,
    loop: true,
    note: 'Airborne spin loop; move the sprite along the parabola (body centre = (11,11)).',
    se: ['flail.a@3,3', 'flail.b%1@3,3', 'flail.a%2@3,3', 'flail.b%3@3,3'],
  },
  {
    anim: 'impact',
    fps: 12,
    loop: false,
    impact: 0,
    note: 'Hits the street: squash, rebound. Then show `splat`.',
    se: ['_shadow impact.0', '_shadow impact.1'],
  },
  {
    anim: 'splat',
    fps: 0,
    loop: false,
    note: 'Body on the street after the fall.',
    se: ['_shadow splat'],
  },
];

export function makeRooftop(look: RooftopLook): [UnitDef, UnitDef] {
  const main: UnitDef = {
    id: look.id,
    group: 'units',
    canvas: { w: look.width ?? 30, h: 26 },
    anchor: { x: 11, y: 22 },
    book: look.book,
    look: { keys: look.keys, slots: { skin: look.skin } },
    hasShadow: true,
    hitFrom: 'idle',
    anims: rooftopAnims(look),
  };
  const thrown: UnitDef = {
    id: look.id,
    group: 'units',
    canvas: { w: 22, h: 22 },
    anchor: { x: 11, y: 19 },
    book: look.thrownBook,
    look: { keys: look.keys, slots: { skin: look.skin } },
    hasShadow: true,
    anims: THROWN_ANIMS,
  };
  return [main, thrown];
}

export const SNIPER_BOOK = mergeBooks(parseParts(LEG_PARTS, 'legs'), parseParts(SNIPER_PARTS, 'sniper'));
export const THROWN_BOOK = parseParts(THROWN_PARTS, 'thrown');

export const [SNIPER, SNIPER_THROWN] = makeRooftop({
  id: 'sniper',
  book: SNIPER_BOOK,
  thrownBook: THROWN_BOOK,
  keys: SNIPER_KEYS,
  skin: 'skin6',
  flash: { se: 'flash', ne: 'flash.small@23,4' },
  muzzle: { se: { x: 26, y: 15 }, ne: { x: 24, y: 6 } },
  fireNote: 'Rubber round: flash on frame 1 (spawn pellet at the muzzle), recoil, bolt, re-aim.',
});
