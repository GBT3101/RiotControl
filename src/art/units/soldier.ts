/**
 * Soldiers — olive fatigues, plate carrier, helmet with goggles, automatic rifle.
 * Personality: stoic. Three-round bursts, crouched firing idle, salute on deploy.
 */
import type { KeyMap } from '../lib/grid';
import { LEG_PARTS } from './body.grid';
import { mergeBooks, parseParts, type UnitDef } from './kit';
import { cycle } from './poses';
import { SOLDIER_PARTS } from './soldier.grid';

export const SOLDIER_KEYS: KeyMap = {
  o: 'ink',
  '1': 'olive.0',
  '2': 'olive.1',
  '3': 'olive.2',
  '4': 'olive.3',
  K: 'olive.1',
  P: 'olive.2',
  p: 'green0',
  q: 'gray2',
  w: 'teal2',
  g: 'ochre1',
  r: 'gray1',
  S: '$skin.1',
  L: '$skin.2',
  s: '$skin.0',
  e: 'ink',
  m: 'earth1',
  n: 'earth2',
  B: 'earth1',
  b: 'earth0',
  H: 'earth1',
  x: 'gray1',
  X: 'gray4',
  F: 'ochre4',
  f: 'ochre3',
  W: 'white',
};

const book = mergeBooks(parseParts(LEG_PARTS, 'legs'), parseParts(SOLDIER_PARTS, 'soldier'));

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
/** NE (back view) falls: the mid-fall frame shows the back of the head (M13a), then the
 *  shared lying frames. */
const FALL_NE = [FALL[0]!.replace(' fall', ' fall.ne'), ...FALL.slice(1)];

const AIM = 'arms.aim';
const KICK = 'arms.recoil > !flash+-1,0';
const KICK_NE = 'arms.ne.aim+-1,1 > !flash.small@22,3';

export const SOLDIER: UnitDef = {
  id: 'soldier',
  group: 'units',
  canvas: { w: 30, h: 26 },
  anchor: { x: 11, y: 22 },
  book,
  look: { keys: SOLDIER_KEYS, slots: { skin: 'skin3' } },
  hasShadow: true,
  hitFrom: 'idle',
  anims: [
    {
      anim: 'idle',
      fps: 5,
      loop: true,
      se: cycle(4, (i) => se('legs.stand', `0,${[0, 0, 1, 1][i]}`, 'head', 'arms.port')),
      ne: cycle(4, (i) => ne('legs.stand', `0,${[0, 0, 1, 1][i]}`, 'arms.ne.port')),
    },
    {
      anim: 'fidget',
      fps: 5,
      loop: false,
      note: 'Pulls the goggles down, scans the street, pushes them back up. NE: scans left/right.',
      se: [
        se('legs.stand', '0,0', 'head', 'arms.port'),
        se('legs.stand', '0,0', 'head.goggles', 'arms.port'),
        se('legs.stand', '0,0', 'head.goggles+-1,0', 'arms.port'),
        se('legs.stand', '0,0', 'head.goggles+-1,0', 'arms.port'),
        se('legs.stand', '0,0', 'head.goggles+1,0', 'arms.port'),
        se('legs.stand', '0,0', 'head.goggles', 'arms.port'),
        se('legs.stand', '0,0', 'head.blink', 'arms.port'),
        se('legs.stand', '0,0', 'head', 'arms.port'),
      ],
      ne: cycle(8, (i) => {
        const hx = [0, -1, -1, -1, 1, 1, 0, 0][i]!;
        return `_shadow legs.stand torso.ne head.ne+${hx},0 arms.ne.port`;
      }),
    },
    {
      anim: 'crouch',
      fps: 4,
      loop: true,
      note: 'Crouched, rifle shouldered — the engaged idle between bursts.',
      se: cycle(4, (i) => {
        const b = [0, 0, 1, 0][i]!;
        return `_shadow legs.crouch >0,${2 + b} torso.crouch@7,11 head ${AIM}`;
      }),
      ne: cycle(4, (i) => {
        const b = [0, 0, 1, 0][i]!;
        return `_shadow legs.crouch >0,${2 + b} torso.ne head.ne arms.ne.aim`;
      }),
    },
    {
      anim: 'walk',
      fps: 10,
      loop: true,
      se: cycle(8, (i) => se(`legs.walk:${i}`, `0,${WALK_BOB[i]}`, 'head', 'arms.port')),
      ne: cycle(8, (i) => ne(`legs.walk:${i}`, `0,${WALK_BOB[i]}`, 'arms.ne.port')),
    },
    {
      anim: 'run',
      fps: 12,
      loop: true,
      se: cycle(6, (i) => se(`legs.run:${i}`, `1,${RUN_BOB[i]}`, 'head', 'arms.port')),
      ne: cycle(6, (i) => ne(`legs.run:${i}`, `1,${RUN_BOB[i]}`, 'arms.ne.port')),
    },
    {
      anim: 'attack',
      fps: 15,
      loop: false,
      impact: 1,
      note: 'Three-round burst: flashes on frames 1, 3, 5 (one damage tick each).',
      se: [
        se('legs.brace', '0,0', 'head', AIM),
        se('legs.brace', '-1,0', 'head.blink', KICK),
        se('legs.brace', '0,0', 'head', AIM),
        se('legs.brace', '-1,0', 'head.blink', KICK),
        se('legs.brace', '0,0', 'head', AIM),
        se('legs.brace', '-1,0', 'head.blink', KICK),
        se('legs.brace', '0,0', 'head', AIM),
      ],
      ne: [
        ne('legs.brace', '0,0', 'arms.ne.aim'),
        ne('legs.brace', '0,0', KICK_NE),
        ne('legs.brace', '0,0', 'arms.ne.aim'),
        ne('legs.brace', '0,0', KICK_NE),
        ne('legs.brace', '0,0', 'arms.ne.aim'),
        ne('legs.brace', '0,0', KICK_NE),
        ne('legs.brace', '0,0', 'arms.ne.aim'),
      ],
      muzzle: {
        se: [null, { x: 22, y: 13 }, null, { x: 22, y: 13 }, null, { x: 22, y: 13 }, null],
        ne: [null, { x: 23, y: 4 }, null, { x: 23, y: 4 }, null, { x: 23, y: 4 }, null],
      },
    },
    {
      anim: 'reload',
      fps: 8,
      loop: false,
      note: 'Muzzle dips, magazine drops, fresh one seated, charging handle racked.',
      se: [
        se('legs.stand', '0,0', 'head', AIM),
        se('legs.stand', '0,1', 'head', 'arms.reload1'),
        se('legs.stand', '0,1', 'head', 'arms.reload2', 'mag@12,19'),
        se('legs.stand', '0,1', 'head.blink', 'arms.reload1', 'mag@12,21'),
        se('legs.stand', '0,0', 'head', 'arms.aim+-1,0', 'mag@12,21'),
        se('legs.stand', '0,0', 'head', AIM),
      ],
      ne: [
        ne('legs.stand', '0,0', 'arms.ne.port'),
        ne('legs.stand', '0,1', 'arms.ne.port+0,1'),
        ne('legs.stand', '0,1', 'arms.ne.port+0,2', 'mag@14,19'),
        ne('legs.stand', '0,1', 'arms.ne.port+0,1', 'mag@14,21'),
        ne('legs.stand', '0,0', 'arms.ne.port+-1,0', 'mag@14,21'),
        ne('legs.stand', '0,0', 'arms.ne.port'),
      ],
    },
    {
      anim: 'deploy',
      fps: 8,
      loop: false,
      note: 'Double-times in, halts, salutes, back to port arms.',
      se: [
        se('legs.run:0', '1,0', 'head', 'arms.port'),
        se('legs.stand', '0,1', 'head', 'arms.port'),
        se('legs.stand', '0,0', 'head', 'arms.salute'),
        se('legs.stand', '0,0', 'head', 'arms.salute'),
        se('legs.stand', '0,0', 'head.blink', 'arms.salute'),
        se('legs.stand', '0,0', 'head', 'arms.port'),
      ],
      ne: [
        ne('legs.run:0', '1,0', 'arms.ne.port'),
        ne('legs.stand', '0,1', 'arms.ne.port'),
        ne('legs.stand', '0,0', 'arms.ne.port+0,-1'),
        ne('legs.stand', '0,0', 'arms.ne.port+0,-1'),
        ne('legs.stand', '0,0', 'arms.ne.port'),
        ne('legs.stand', '0,0', 'arms.ne.port'),
      ],
    },
    {
      anim: 'death',
      fps: 10,
      loop: false,
      se: [
        se('legs.brace', '-1,0', 'head.hurt', 'arms.port+-1,-1'),
        se('legs.brace', '-2,1', 'head.hurt', 'arms.port+-2,1'),
        se('legs.crouch', '-2,3', 'head.hurt', 'arms.port+-2,2'),
        ...FALL,
      ],
      ne: [
        ne('legs.brace', '-1,0', 'arms.ne.port+-1,-1'),
        ne('legs.brace', '-2,1', 'arms.ne.port+-2,1'),
        ne('legs.crouch', '-2,3', 'arms.ne.port+-2,2'),
        ...FALL_NE,
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
