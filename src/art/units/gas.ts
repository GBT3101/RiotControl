/**
 * Tear Gas Shooter — gas mask with big glinting lenses, hi-vis vest with a grenade bandolier,
 * stubby 40 mm launcher. Personality: the gas-masked weirdo (head tilts, filter wheezes).
 * Spray attack loops; the grenade ability has a charged idle and a throw.
 */
import type { KeyMap } from '../lib/grid';
import { LEG_PARTS } from './body.grid';
import { GAS_PARTS } from './gas.grid';
import { mergeBooks, parseParts, type UnitDef } from './kit';
import { cycle } from './poses';

export const GAS_KEYS: KeyMap = {
  o: 'ink',
  '1': 'navy.1',
  '2': 'navy.2',
  '3': 'navy.3',
  '4': 'navy.4',
  K: 'gray3',
  k: 'gray2',
  T: 'teal1',
  w: 'sky',
  M: 'gray4',
  N: 'olive2',
  y: 'hivis.1',
  Y: 'hivis.2',
  G: 'green3',
  g: 'green1',
  O: 'earth3',
  x: 'gray1',
  X: 'gray3',
  S: '$skin.1',
  L: '$skin.2',
  s: '$skin.0',
  n: 'gray3',
  B: 'gray2',
  b: 'gray1',
  H: 'gray2',
  a: 'green4',
  A: 'lime',
  Z: 'stone5',
};

const book = mergeBooks(parseParts(LEG_PARTS, 'legs'), parseParts(GAS_PARTS, 'gas'));

const se = (legs: string, body: string, head: string, arms: string, extra = ''): string =>
  `_shadow ${legs} >${body} torso ${head} ${arms} ${extra}`.trim();
const ne = (legs: string, body: string, arms: string, extra = '', head = 'head.ne'): string =>
  `_shadow ${legs} >${body} torso.ne ${head} ${arms} ${extra}`.trim();

const WALK_BOB = [0, 1, 0, 0, 0, 1, 0, 0];
const RUN_BOB = [0, 1, -1, 0, 1, -1];
const FALL = [
  '_shadow.long fall',
  '_shadow.long lie+0,-1',
  '_shadow.long lie',
  '_shadow.long lie.flat',
  '_shadow.long lie.flat',
];

/** Spray puffs leaving the muzzle (SE muzzle ≈ (20,13)), 4-frame loop. */
const PUFFS_SE = [
  '!puff.s@20,12',
  '!puff.s@21,12 !puff.m@23,10',
  '!puff.m@21,11 !puff.l@24,8',
  '!puff.s@20,12 !puff.l@25,7',
];
/** NE muzzle ≈ (24,6). */
const PUFFS_NE = [
  '!puff.s@24,4',
  '!puff.s@25,3 !puff.m@25,0',
  '!puff.m@24,2 !puff.l@24,0',
  '!puff.s@24,4 !puff.l@25,0',
];
const TOSS = [0, -3, -5, -3];

export const GAS: UnitDef = {
  id: 'gas',
  group: 'units',
  canvas: { w: 30, h: 26 },
  anchor: { x: 11, y: 22 },
  book,
  look: { keys: GAS_KEYS, slots: { skin: 'skin2' } },
  hasShadow: true,
  hitFrom: 'idle',
  anims: [
    {
      anim: 'idle',
      fps: 5,
      loop: true,
      se: cycle(4, (i) => se('legs.stand', `0,${[0, 0, 1, 1][i]}`, 'head', 'arms.hold')),
      ne: cycle(4, (i) => ne('legs.stand', `0,${[0, 0, 1, 1][i]}`, 'arms.ne.hold')),
    },
    {
      anim: 'fidget',
      fps: 6,
      loop: false,
      note: 'Cocks his head like a curious dog; the filter wheezes a puff.',
      se: [
        se('legs.stand', '0,0', 'head', 'arms.hold'),
        se('legs.stand', '0,0', 'head.tilt', 'arms.hold'),
        se('legs.stand', '0,0', 'head.tilt', 'arms.hold', '!wheeze@16,11'),
        se('legs.stand', '0,0', 'head.tilt', 'arms.hold', '!wheeze@17,10'),
        se('legs.stand', '0,0', 'head.tilt+1,0', 'arms.hold'),
        se('legs.stand', '0,0', 'head.tilt+1,0', 'arms.hold'),
        se('legs.stand', '0,0', 'head', 'arms.hold', '!wheeze@16,11'),
        se('legs.stand', '0,0', 'head', 'arms.hold'),
      ],
      ne: cycle(8, (i) => {
        const hx = [0, 1, 1, 1, 0, -1, -1, 0][i]!;
        const puff = i === 2 || i === 3 ? `!wheeze@${17 + i - 2},${10 - (i - 2)}` : '';
        return ne('legs.stand', '0,0', 'arms.ne.hold', puff, `head.ne+${hx},0`);
      }),
    },
    {
      anim: 'charged',
      fps: 6,
      loop: true,
      note: 'Ability ready: bounces a gas grenade in his palm (replace idle while charged).',
      se: cycle(4, (i) => {
        const g = TOSS[i]!;
        return i === 0
          ? se('legs.stand', '0,0', 'head', 'launcher.side arm.grenade')
          : se('legs.stand', '0,0', 'head', `launcher.side arm.rest+0,${i === 2 ? -1 : 0}`, `grenade@5,${14 + g}`);
      }),
      ne: cycle(4, (i) =>
        ne('legs.stand', '0,0', `arm.ne.windup@16,${11 + [3, 2, 1, 2][i]!}`, `grenade@21,${11 + TOSS[i]!}`),
      ),
    },
    {
      anim: 'walk',
      fps: 10,
      loop: true,
      se: cycle(8, (i) => se(`legs.walk:${i}`, `0,${WALK_BOB[i]}`, 'head', 'arms.hold')),
      ne: cycle(8, (i) => ne(`legs.walk:${i}`, `0,${WALK_BOB[i]}`, 'arms.ne.hold')),
    },
    {
      anim: 'run',
      fps: 12,
      loop: true,
      se: cycle(6, (i) => se(`legs.run:${i}`, `1,${RUN_BOB[i]}`, 'head', 'arms.hold')),
      ne: cycle(6, (i) => ne(`legs.run:${i}`, `1,${RUN_BOB[i]}`, 'arms.ne.hold')),
    },
    {
      anim: 'attack',
      fps: 10,
      loop: true,
      impact: 0,
      note: 'Gas spray, looping while engaged (10 dmg/s — tick on any frame). Puffs drawn in.',
      se: cycle(4, (i) =>
        se('legs.brace', `0,${i % 2}`, 'head', `arms.aim+0,${i === 1 ? -1 : 0}`, `> ${PUFFS_SE[i]}`),
      ),
      ne: cycle(4, (i) => ne('legs.brace', `0,${i % 2}`, 'arms.ne.aim', `> ${PUFFS_NE[i]}`)),
      muzzle: {
        se: [{ x: 20, y: 13 }, { x: 20, y: 12 }, { x: 20, y: 13 }, { x: 20, y: 13 }],
        ne: [{ x: 24, y: 6 }, { x: 24, y: 7 }, { x: 24, y: 6 }, { x: 24, y: 7 }],
      },
    },
    {
      anim: 'throw',
      fps: 12,
      loop: false,
      impact: 3,
      note: 'Grenade ability: wind-up → overhead → release (spawn the projectile on frame 3 at the muzzle point) → follow-through.',
      se: [
        se('legs.stand', '0,0', 'head', 'launcher.side arm.grenade'),
        se('legs.brace', '-1,0', 'head', 'launcher.side', 'arm.windup'),
        se('legs.brace', '-1,1', 'head', 'launcher.side', 'arm.windup+0,1'),
        se('legs.brace', '1,0', 'head', 'launcher.side', 'arm.over !grenade@12,0'),
        se('legs.brace', '1,1', 'head', 'launcher.side', 'arm.release'),
        se('legs.stand', '0,0', 'head', 'launcher.side arm.rest'),
      ],
      ne: [
        ne('legs.stand', '0,0', 'arm.ne.windup+0,4'),
        ne('legs.brace', '-1,0', 'arm.ne.windup'),
        ne('legs.brace', '-1,1', 'arm.ne.windup'),
        ne('legs.brace', '1,0', 'arm.ne.release', '!grenade@25,1'),
        ne('legs.brace', '1,1', 'arm.ne.release+0,1'),
        ne('legs.stand', '0,0', 'arms.ne.hold'),
      ],
      muzzle: {
        se: [null, null, null, { x: 13, y: 1 }, null, null],
        ne: [null, null, null, { x: 26, y: 2 }, null, null],
      },
    },
    {
      anim: 'deploy',
      fps: 10,
      loop: false,
      note: 'Jogs in, skids, levels the launcher, tilts his head at the crowd.',
      se: [
        se('legs.run:0', '1,0', 'head', 'arms.hold'),
        se('legs.brace', '-1,0', 'head', 'arms.hold'),
        se('legs.brace', '0,0', 'head', 'arms.aim'),
        se('legs.brace', '0,0', 'head.tilt', 'arms.aim'),
        se('legs.stand', '0,0', 'head.tilt', 'arms.hold'),
        se('legs.stand', '0,0', 'head', 'arms.hold'),
      ],
      ne: [
        ne('legs.run:0', '1,0', 'arms.ne.hold'),
        ne('legs.brace', '-1,0', 'arms.ne.hold'),
        ne('legs.brace', '0,0', 'arms.ne.aim'),
        ne('legs.brace', '0,0', 'arms.ne.aim', '', 'head.ne+1,0'),
        ne('legs.stand', '0,0', 'arms.ne.hold', '', 'head.ne+1,0'),
        ne('legs.stand', '0,0', 'arms.ne.hold'),
      ],
    },
    {
      anim: 'death',
      fps: 10,
      loop: false,
      se: [
        se('legs.brace', '-1,0', 'head.hurt', 'arms.hold+-1,-1'),
        se('legs.brace', '-2,1', 'head.hurt', 'arms.hold+-1,1'),
        se('legs.crouch', '-2,3', 'head.hurt', 'arm.rest'),
        ...FALL,
      ],
      ne: [
        ne('legs.brace', '-1,0', 'arms.ne.hold+-1,-1'),
        ne('legs.brace', '-2,1', 'arms.ne.hold+-1,1'),
        ne('legs.crouch', '-2,3', 'arms.ne.hold'),
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
