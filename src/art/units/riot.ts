/**
 * Riot Control — navy armour, hi-vis band, visor helmet, polycarbonate shield and baton.
 * Personality: smug. The visor-flip fidget shows the smirk; the deploy slams the shield down.
 */
import type { KeyMap } from '../lib/grid';
import { LEG_PARTS } from './body.grid';
import { mergeBooks, parseParts, type UnitDef } from './kit';
import { cycle } from './poses';
import { RIOT_PARTS } from './riot.grid';

export const RIOT_KEYS: KeyMap = {
  o: 'ink',
  '1': 'navy.1',
  '2': 'navy.2',
  '3': 'navy.3',
  '4': 'navy.4',
  y: 'hivis.1',
  Y: 'hivis.2',
  g: 'ochre2',
  K: 'zinc2',
  n: 'gray3',
  B: 'gray2',
  b: 'gray1',
  h: 'gray1',
  H: 'gray3',
  x: 'gray1',
  X: 'gray5',
  e: 'navy0',
  z: 'zinc2',
  v: 'zinc3',
  w: 'sky',
  V: 'white',
  S: '$skin.1',
  L: '$skin.2',
  s: '$skin.0',
  m: 'earth1',
  P: 'zinc4',
  p: 'zinc3',
  q: 'zinc2',
  f: 'zinc1',
  W: 'white',
};

/** Skin ramps officers are drawn with (the Ministry recruits from everywhere). */
export const COP_SKINS = ['skin5', 'skin3', 'skin6', 'skin2', 'skin4', 'skin1'] as const;

const book = mergeBooks(parseParts(LEG_PARTS, 'legs'), parseParts(RIOT_PARTS, 'riot'));

// SE building blocks ---------------------------------------------------------------------------
const se = (legs: string, body: string, head: string, arm: string, shield: string): string =>
  `_shadow ${legs} >${body} torso ${head} ${arm} > ${shield}`;
const ne = (legs: string, body: string, head: string, arm: string, shield: string): string =>
  `_shadow ${legs} ${shield} >${body} torso.ne ${head} ${arm}`;

const WALK_BOB = [0, 1, 0, 0, 0, 1, 0, 0];
const WALK_ARM = ['fwd', 'fwd', 'rest', 'back', 'back', 'back', 'rest', 'fwd'];
const WALK_ARM_NE = [1, 1, 0, -1, -1, -1, 0, 1];
const RUN_BOB = [0, 1, -1, 0, 1, -1];
const RUN_ARM = ['fwd', 'rest', 'back', 'back', 'rest', 'fwd'];
const RUN_ARM_NE = [1, 0, -1, -1, 0, 1];

const FALL = [
  '_shadow.long fall shield.ground',
  '_shadow.long lie+0,-1 shield.ground',
  '_shadow.long lie shield.ground',
  '_shadow.long lie.flat shield.ground',
  '_shadow.long lie.flat shield.ground',
];

export const RIOT: UnitDef = {
  id: 'riot',
  group: 'units',
  canvas: { w: 24, h: 26 },
  anchor: { x: 11, y: 22 },
  book,
  look: { keys: RIOT_KEYS, slots: { skin: 'skin5' } },
  hasShadow: true,
  hitFrom: 'idle',
  anims: [
    {
      anim: 'idle',
      fps: 5,
      loop: true,
      se: cycle(4, (i) => {
        const b = [0, 0, 1, 1][i]!;
        return se('legs.stand', `0,${b}`, 'head', 'arm.rest', `shield+0,${[0, 0, 0, 1][i]}`);
      }),
      ne: cycle(4, (i) => {
        const b = [0, 0, 1, 1][i]!;
        return ne('legs.stand', `0,${b}`, 'head.ne', 'arm.ne.rest', `shield.ne+0,${b}`);
      }),
    },
    {
      anim: 'fidget',
      fps: 6,
      loop: false,
      note: 'Shield tap: baton raps the shield rim twice. Play occasionally instead of idle.',
      se: [
        se('legs.stand', '0,0', 'head', 'arm.rest', 'shield'),
        se('legs.stand', '0,0', 'head', 'arm.tap', 'shield'),
        se('legs.stand', '0,0', 'head', 'arm.tap+0,1', 'shield+0,1'),
        se('legs.stand', '0,0', 'head', 'arm.tap', 'shield'),
        se('legs.stand', '0,0', 'head', 'arm.tap+0,1', 'shield+0,1'),
        se('legs.stand', '0,0', 'head', 'arm.tap', 'shield'),
        se('legs.stand', '0,1', 'head', 'arm.rest', 'shield+0,1'),
        se('legs.stand', '0,0', 'head', 'arm.rest', 'shield'),
      ],
      ne: cycle(8, (i) => {
        const hx = [0, -1, -1, -1, 0, 1, 1, 0][i]!;
        return ne('legs.stand', '0,0', `head.ne+${hx},0`, 'arm.ne.rest', 'shield.ne');
      }),
    },
    {
      anim: 'fidget2',
      fps: 6,
      loop: false,
      note: 'Visor flip: visor up, smug look + blink, visor down (SE). NE: glance over shoulder.',
      se: [
        se('legs.stand', '0,0', 'head', 'arm.rest', 'shield'),
        se('legs.stand', '0,1', 'head.up', 'arm.rest', 'shield'),
        se('legs.stand', '0,0', 'head.up', 'arm.rest', 'shield'),
        se('legs.stand', '0,0', 'head.up', 'arm.rest', 'shield'),
        se('legs.stand', '0,0', 'head.blink', 'arm.rest', 'shield'),
        se('legs.stand', '0,0', 'head.up', 'arm.rest', 'shield'),
        se('legs.stand', '0,1', 'head', 'arm.rest', 'shield'),
        se('legs.stand', '0,0', 'head', 'arm.rest', 'shield'),
      ],
      ne: cycle(8, (i) => {
        const hx = [0, 1, 1, 1, 1, 0, 0, 0][i]!;
        const b = [0, 0, 0, 1, 1, 1, 0, 0][i]!;
        return ne('legs.stand', `0,${b}`, `head.ne+${hx},0`, 'arm.ne.rest', `shield.ne+0,${b}`);
      }),
    },
    {
      anim: 'walk',
      fps: 10,
      loop: true,
      se: cycle(8, (i) =>
        se(`legs.walk:${i}`, `0,${WALK_BOB[i]}`, 'head', `arm.${WALK_ARM[i]}`, `shield+0,${WALK_BOB[i]}`),
      ),
      ne: cycle(8, (i) =>
        ne(
          `legs.walk:${i}`,
          `0,${WALK_BOB[i]}`,
          'head.ne',
          `arm.ne.rest+${WALK_ARM_NE[i]},0`,
          `shield.ne+0,${WALK_BOB[i]}`,
        ),
      ),
    },
    {
      anim: 'run',
      fps: 12,
      loop: true,
      note: 'Jog / charge; used for the deploy jog-in from the map edge.',
      se: cycle(6, (i) =>
        se(`legs.run:${i}`, `1,${RUN_BOB[i]}`, 'head', `arm.${RUN_ARM[i]}`, `shield+1,${RUN_BOB[i]}`),
      ),
      ne: cycle(6, (i) =>
        ne(
          `legs.run:${i}`,
          `1,${RUN_BOB[i]}`,
          'head.ne',
          `arm.ne.rest+${RUN_ARM_NE[i]},0`,
          `shield.ne+1,${RUN_BOB[i]}`,
        ),
      ),
    },
    {
      anim: 'attack',
      fps: 12,
      loop: false,
      impact: 3,
      note: 'Anticipation (baton cocked) → smear → shield-bash + baton chop (impact) → recover.',
      se: [
        '_shadow legs.brace >-1,0 torso head arm.up > shield+-1,0',
        '_shadow legs.brace >-1,1 torso head arm.up > shield+-1,1',
        '_shadow legs.brace >1,0 torso head > shield+2,0 >1,0 arm.over !smear',
        '_shadow legs.brace >1,0 torso head > shield+3,0 >1,0 arm.strike',
        '_shadow legs.brace >1,0 torso head > shield+2,0 >1,0 arm.strike+0,1',
        '_shadow legs.stand torso head arm.rest shield+1,0',
      ],
      ne: [
        '_shadow legs.brace shield.ne+-1,0 >-1,0 torso.ne head.ne arm.ne.up',
        '_shadow legs.brace shield.ne+-1,1 >-1,1 torso.ne head.ne arm.ne.up',
        '_shadow legs.brace shield.ne+2,-1 >1,0 torso.ne head.ne arm.ne.strike+-1,1',
        '_shadow legs.brace shield.ne+3,-1 >1,-1 torso.ne head.ne arm.ne.strike',
        '_shadow legs.brace shield.ne+2,0 >1,0 torso.ne head.ne arm.ne.strike+0,1',
        '_shadow legs.stand shield.ne+1,0 torso.ne head.ne arm.ne.rest',
      ],
    },
    {
      anim: 'deploy',
      fps: 10,
      loop: false,
      impact: 3,
      note: 'Arrival after the jog-in: skid, raise shield, SLAM it down (impact = dust), smug stand.',
      se: [
        se('legs.run:0', '1,0', 'head', 'arm.back', 'shield+1,0'),
        se('legs.brace', '-1,0', 'head', 'arm.rest', 'shield+-1,-3'),
        se('legs.brace', '0,-1', 'head.up', 'arm.rest', 'shield+0,-5'),
        se('legs.brace', '0,1', 'head', 'arm.rest', 'shield+0,2'),
        se('legs.brace', '0,1', 'head', 'arm.rest', 'shield+0,1'),
        se('legs.stand', '0,0', 'head', 'arm.rest', 'shield'),
      ],
      ne: [
        ne('legs.run:0', '1,0', 'head.ne', 'arm.ne.rest+1,0', 'shield.ne+1,0'),
        ne('legs.brace', '-1,0', 'head.ne', 'arm.ne.rest', 'shield.ne+-1,-3'),
        ne('legs.brace', '0,-1', 'head.ne', 'arm.ne.rest', 'shield.ne+0,-5'),
        ne('legs.brace', '0,1', 'head.ne', 'arm.ne.rest', 'shield.ne+0,2'),
        ne('legs.brace', '0,1', 'head.ne', 'arm.ne.rest', 'shield.ne+0,1'),
        ne('legs.stand', '0,0', 'head.ne', 'arm.ne.rest', 'shield.ne'),
      ],
    },
    {
      anim: 'death',
      fps: 10,
      loop: false,
      note: 'Stagger → shield drops → knees buckle → falls back → bounce → settle. Ends on `body`.',
      se: [
        '_shadow legs.brace >-1,0 torso head.hurt arm.up > shield.tilt+1,0',
        '_shadow legs.brace >-2,1 torso head.hurt arm.back > shield.tilt+2,3',
        '_shadow legs.crouch shield.ground >-2,3 torso head.hurt arm.back',
        ...FALL,
      ],
      ne: [
        '_shadow legs.brace shield.ne+-1,0 >-1,0 torso.ne head.ne arm.ne.up',
        '_shadow legs.brace shield.ne+-2,3 >-2,1 torso.ne head.ne arm.ne.rest',
        '_shadow legs.crouch shield.ground >-2,3 torso.ne head.ne arm.ne.rest',
        ...FALL,
      ],
    },
    {
      anim: 'body',
      fps: 0,
      loop: false,
      note: 'Lying on his back, shield beside him. Stays 20–40 s.',
      se: ['_shadow.long lie.flat shield.ground'],
      ne: ['_shadow.long lie.flat shield.ground'],
    },
    {
      anim: 'ko',
      fps: 6,
      loop: true,
      note: 'Knocked out sitting, head lolling (M5 orbits KO stars above row 3).',
      se: cycle(4, (i) => `_shadow ko.body ko.head+${[-1, 0, 1, 0][i]},${[0, 0, 0, 1][i]}`),
      ne: cycle(4, (i) => `_shadow ko.body ko.head+${[-1, 0, 1, 0][i]},${[0, 0, 0, 1][i]}`),
    },
  ],
};
