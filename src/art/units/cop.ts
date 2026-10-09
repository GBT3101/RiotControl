/**
 * Armed Cops — the first lethal unit. Peaked cap, light-blue shirt, navy stab vest (with a
 * coffee stain), moustache, a permanent bead of sweat. Two-handed pistol, piercing shots.
 */
import type { KeyMap } from '../lib/grid';
import { LEG_PARTS } from './body.grid';
import { COP_PARTS } from './cop.grid';
import { mergeBooks, parseParts, type UnitDef } from './kit';
import { cycle } from './poses';

export const COP_KEYS: KeyMap = {
  o: 'ink',
  '1': 'navy.1',
  '2': 'navy.2',
  '3': 'navy.2',
  '4': 'navy.3',
  K: 'navy.2',
  c: 'blue2',
  d: 'blue1',
  y: 'hivis.1',
  Y: 'hivis.2',
  C: 'earth3',
  g: 'ochre2',
  W: 'white',
  r: 'earth1',
  M: 'earth1',
  S: '$skin.1',
  L: '$skin.2',
  s: '$skin.0',
  e: 'ink',
  w: 'sky',
  n: 'gray3',
  B: 'gray2',
  b: 'gray1',
  H: 'gray2',
  X: 'gray4',
  G: 'gray3',
  F: 'ochre4',
  f: 'ochre3',
};

const book = mergeBooks(parseParts(LEG_PARTS, 'legs'), parseParts(COP_PARTS, 'cop'));

const se = (legs: string, body: string, head: string, arms: string, extra = ''): string =>
  `_shadow ${legs} >${body} torso ${head} ${arms} ${extra}`.trim();
const ne = (legs: string, body: string, arms: string, extra = ''): string =>
  `_shadow ${legs} >${body} torso.ne head.ne ${arms} ${extra}`.trim();

const WALK_BOB = [0, 1, 0, 0, 0, 1, 0, 0];
const RUN_BOB = [0, 1, -1, 0, 1, -1];

const FALL = [
  '_shadow.long fall',
  '_shadow.long lie+0,-1',
  '_shadow.long lie',
  '_shadow.long lie.flat',
  '_shadow.long lie.flat',
];

export const COP: UnitDef = {
  id: 'cop',
  group: 'units',
  canvas: { w: 30, h: 26 },
  anchor: { x: 11, y: 22 },
  book,
  look: { keys: COP_KEYS, slots: { skin: 'skin4' } },
  hasShadow: true,
  hitFrom: 'idle',
  anims: [
    {
      anim: 'idle',
      fps: 5,
      loop: true,
      se: cycle(4, (i) => se('legs.stand', `0,${[0, 0, 1, 1][i]}`, 'head', 'arms.low')),
      ne: cycle(4, (i) => ne('legs.stand', `0,${[0, 0, 1, 1][i]}`, 'arms.ne.low')),
    },
    {
      anim: 'fidget',
      fps: 6,
      loop: false,
      note: 'Sweats: cap up, blink, a drop of sweat rolls off. NE: nervous glances.',
      se: [
        se('legs.stand', '0,0', 'head', 'arms.low'),
        se('legs.stand', '0,0', 'head.mop', 'arms.low'),
        se('legs.stand', '0,0', 'head.mop', 'arms.low', '!sweat'),
        se('legs.stand', '0,0', 'head.blink', 'arms.low', '!sweat+0,1'),
        se('legs.stand', '0,0', 'head', 'arms.low', '!sweat+1,3'),
        se('legs.stand', '0,1', 'head', 'arms.low', '!sweat+1,6'),
        se('legs.stand', '0,1', 'head.blink', 'arms.low'),
        se('legs.stand', '0,0', 'head', 'arms.low'),
      ],
      ne: cycle(8, (i) => {
        const hx = [0, -1, -1, 0, 1, 1, 0, 0][i]!;
        return `_shadow legs.stand torso.ne head.ne+${hx},0 arms.ne.low`;
      }),
    },
    {
      anim: 'walk',
      fps: 10,
      loop: true,
      note: 'Patrols at low ready, pistol out.',
      se: cycle(8, (i) => se(`legs.walk:${i}`, `0,${WALK_BOB[i]}`, 'head', 'arms.low')),
      ne: cycle(8, (i) => ne(`legs.walk:${i}`, `0,${WALK_BOB[i]}`, 'arms.ne.low')),
    },
    {
      anim: 'run',
      fps: 12,
      loop: true,
      se: cycle(6, (i) => se(`legs.run:${i}`, `1,${RUN_BOB[i]}`, 'head', 'arms.low')),
      ne: cycle(6, (i) => ne(`legs.run:${i}`, `1,${RUN_BOB[i]}`, 'arms.ne.low')),
    },
    {
      anim: 'attack',
      fps: 12,
      loop: false,
      impact: 2,
      note: 'Raise → aim → BANG (flash, recoil) → settle. Shot fires on the impact frame.',
      se: [
        se('legs.brace', '0,0', 'head', 'arms.aim+-1,1'),
        se('legs.brace', '0,0', 'head', 'arms.aim'),
        se('legs.brace', '-1,0', 'head.blink', 'arms.recoil', '> !flash'),
        se('legs.brace', '-1,0', 'head', 'arms.recoil+0,1'),
        se('legs.brace', '0,0', 'head', 'arms.aim'),
      ],
      ne: [
        ne('legs.brace', '0,0', 'arms.ne.aim+-1,1'),
        ne('legs.brace', '0,0', 'arms.ne.aim'),
        ne('legs.brace', '-1,1', 'arms.ne.aim+0,-1', '> !flash.small'),
        ne('legs.brace', '-1,1', 'arms.ne.aim'),
        ne('legs.brace', '0,0', 'arms.ne.aim'),
      ],
      muzzle: {
        se: [null, null, { x: 22, y: 11 }, null, null],
        ne: [null, null, { x: 22, y: 6 }, null, null],
      },
    },
    {
      anim: 'reload',
      fps: 8,
      loop: false,
      note: 'Pistol up, empty magazine drops, fresh one slapped in.',
      se: [
        se('legs.stand', '0,0', 'head', 'arms.low'),
        se('legs.stand', '0,0', 'head', 'arms.reload1', 'mag@10,11'),
        se('legs.stand', '0,1', 'head.blink', 'arms.reload1', 'mag@10,17'),
        se('legs.stand', '0,1', 'head', 'arms.reload2', 'mag@11,21'),
        se('legs.stand', '0,0', 'head', 'arms.reload1', 'mag@11,21'),
        se('legs.stand', '0,0', 'head', 'arms.low'),
      ],
      ne: [
        ne('legs.stand', '0,0', 'arms.ne.low'),
        ne('legs.stand', '0,0', 'arms.ne.low+1,-2', 'mag@14,17'),
        ne('legs.stand', '0,1', 'arms.ne.low+1,-2', 'mag@14,21'),
        ne('legs.stand', '0,1', 'arms.ne.low', 'mag@14,21'),
        ne('legs.stand', '0,0', 'arms.ne.low+0,-1', 'mag@14,21'),
        ne('legs.stand', '0,0', 'arms.ne.low'),
      ],
    },
    {
      anim: 'deploy',
      fps: 10,
      loop: false,
      note: 'Arrives running, skids, sweeps the pistol across the street, settles at low ready.',
      se: [
        se('legs.run:0', '1,0', 'head', 'arms.low'),
        se('legs.brace', '-1,0', 'head', 'arms.low'),
        se('legs.brace', '0,0', 'head+-1,0', 'arms.aim+-1,1'),
        se('legs.brace', '0,0', 'head', 'arms.aim'),
        se('legs.brace', '0,0', 'head+1,0', 'arms.aim'),
        se('legs.stand', '0,0', 'head', 'arms.low'),
      ],
      ne: [
        ne('legs.run:0', '1,0', 'arms.ne.low'),
        ne('legs.brace', '-1,0', 'arms.ne.low'),
        ne('legs.brace', '0,0', 'arms.ne.aim+-1,1'),
        ne('legs.brace', '0,0', 'arms.ne.aim'),
        ne('legs.brace', '0,0', 'arms.ne.aim'),
        ne('legs.stand', '0,0', 'arms.ne.low'),
      ],
    },
    {
      anim: 'death',
      fps: 10,
      loop: false,
      note: 'Stagger → buckle → falls back → bounce → settle. Ends on `body`.',
      se: [
        se('legs.brace', '-1,0', 'head.hurt', 'arms.recoil+-1,0'),
        se('legs.brace', '-2,1', 'head.hurt', 'arm.back'),
        se('legs.crouch', '-2,3', 'head.hurt', 'arm.back'),
        ...FALL,
      ],
      ne: [
        ne('legs.brace', '-1,0', 'arms.ne.aim+-1,0'),
        ne('legs.brace', '-2,1', 'arm.ne.rest'),
        ne('legs.crouch', '-2,3', 'arm.ne.rest'),
        ...FALL,
      ],
    },
    {
      anim: 'body',
      fps: 0,
      loop: false,
      se: ['_shadow.long lie.flat'],
      ne: ['_shadow.long lie.flat'],
    },
  ],
};
