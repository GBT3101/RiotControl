/**
 * Mounted Riot Police — dark bay police horse (white socks, hi-vis POLICE saddle cloth, face
 * visor) + moustached rider with a long baton. Legs are single hand-drawn leg poses phased into
 * a 4-beat walk (8f) and a rotary gallop (6f). Death: the horse rears and throws the rider;
 * from frame 3 the horse is gone — spawn `unit.horse.flee.*` (riderless gallop) there and run it
 * off the map. Tasteful: the horse never dies on screen.
 */
import type { KeyMap } from '../lib/grid';
import { mergeBooks, parseParts, type UnitDef } from './kit';
import { cycle } from './poses';
import { HORSE_LEGS, HORSE_PARTS } from './horse.grid';

export const HORSE_KEYS: KeyMap = {
  o: 'ink',
  H: 'earth3',
  h: 'earth2',
  d: 'earth1',
  G: 'earth4',
  F: 'earth2',
  f: 'earth1',
  M: 'gray1',
  m: 'ink',
  W: 'gray7',
  Q: 'gray5',
  K: 'gray2',
  q: 'gray1',
  e: 'ink',
  V: 'sky',
  y: 'hivis.1',
  Y: 'hivis.2',
  '1': 'navy.1',
  '2': 'navy.2',
  '3': 'navy.3',
  '4': 'navy.4',
  g: 'ochre2',
  z: 'zinc2',
  v: 'zinc3',
  w: 'sky',
  S: '$skin.1',
  L: '$skin.2',
  s: '$skin.0',
  j: 'gray1',
  J: 'gray3',
  x: 'gray1',
  X: 'gray5',
  n: 'gray3',
  B: 'gray2',
  b: 'gray1',
};

/** Far-side legs: the same drawings re-keyed one step darker. */
const FAR_KEY: Readonly<Record<string, string>> = { H: 'F', h: 'f', d: 'f', W: 'Q', K: 'q' };
const FAR_LEGS = HORSE_LEGS.split('\n')
  .map((l) =>
    l.trim().startsWith('==')
      ? l.replace('== leg.', '== legf.')
      : l.replace(/[HhdWK]/g, (c) => FAR_KEY[c] ?? c),
  )
  .join('\n');

const book = mergeBooks(
  parseParts(HORSE_LEGS, 'horse.legs'),
  parseParts(FAR_LEGS, 'horse.legsfar'),
  parseParts(HORSE_PARTS, 'horse'),
);

type LegPose = 'plant' | 'fwd' | 'back' | 'lift' | 'tuck' | 'reach';
/** Leg top x per leg: near hind, far hind, near front, far front. */
const LEG_X = { nh: 9, fh: 12, nf: 21, ff: 24 } as const;
const legs = (p: Record<keyof typeof LEG_X, LegPose>, dy = 0): string =>
  [
    `legf.${p.fh}@${LEG_X.fh - 2},${23 + dy}`,
    `legf.${p.ff}@${LEG_X.ff - 2},${23 + dy}`,
    `leg.${p.nh}@${LEG_X.nh - 2},${23 + dy}`,
    `leg.${p.nf}@${LEG_X.nf - 2},${23 + dy}`,
  ].join(' ');

const STAND = legs({ nh: 'plant', fh: 'plant', nf: 'plant', ff: 'plant' });
const PAW = legs({ nh: 'plant', fh: 'plant', nf: 'lift', ff: 'plant' });

/** 4-beat walk: each leg runs this cycle, offset by its phase. */
const WALK_CYCLE: LegPose[] = ['fwd', 'plant', 'plant', 'back', 'back', 'lift', 'lift', 'fwd'];
const WALK_PHASE = { nh: 0, nf: 2, fh: 4, ff: 6 };
const walkLegs = (i: number): string =>
  legs({
    nh: WALK_CYCLE[(i + WALK_PHASE.nh) % 8]!,
    fh: WALK_CYCLE[(i + WALK_PHASE.fh) % 8]!,
    nf: WALK_CYCLE[(i + WALK_PHASE.nf) % 8]!,
    ff: WALK_CYCLE[(i + WALK_PHASE.ff) % 8]!,
  });

/** Rotary gallop: suspension with legs tucked, then hind → fore landing. */
const GALLOP_CYCLE: LegPose[] = ['reach', 'plant', 'back', 'lift', 'tuck', 'tuck'];
const GALLOP_PHASE = { fh: 0, nh: 1, ff: 3, nf: 4 };
const GALLOP_BOB = [0, 1, 0, -1, -2, -1];
const gallopLegs = (i: number): string =>
  legs(
    {
      nh: GALLOP_CYCLE[(i + GALLOP_PHASE.nh) % 6]!,
      fh: GALLOP_CYCLE[(i + GALLOP_PHASE.fh) % 6]!,
      nf: GALLOP_CYCLE[(i + GALLOP_PHASE.nf) % 6]!,
      ff: GALLOP_CYCLE[(i + GALLOP_PHASE.ff) % 6]!,
    },
    0,
  );

interface Mount {
  legs: string;
  body?: number;
  head?: string;
  tail?: string;
  arm?: string;
  rider?: number;
  riderHead?: string;
  extra?: string;
  riderless?: boolean;
}

const mountSE = (m: Mount): string => {
  const b = m.body ?? 0;
  const r = m.rider ?? b;
  const rider = m.riderless
    ? ''
    : `>0,${r} rider.leg rider.torso ${m.riderHead ?? 'rider.head'} rider.arm.${m.arm ?? 'rest'}`;
  return `_shadow >0,${b} ${m.tail ?? 'tail'} > ${m.legs} >0,${b} horse.body ${m.head ?? 'horse.head'} ${rider} > ${m.extra ?? ''}`.trim();
};
const mountNE = (m: Mount): string => {
  const b = m.body ?? 0;
  const r = m.rider ?? b;
  const rider = m.riderless
    ? ''
    : `>0,${r} rider.leg.ne rider.torso.ne rider.head.ne rider.arm.ne.${m.arm ?? 'rest'}`;
  return `_shadow > ${m.legs} >0,${b} horse.body.ne ${m.head ?? 'horse.head.ne'} ${rider} >0,${b} ${m.tail ?? 'tail.ne'} > ${m.extra ?? ''}`.trim();
};

const WALK_BOB = [0, 1, 0, 0, 0, 1, 0, 0];
const HEAD_NOD = [0, 1, 1, 0, 0, 1, 1, 0];

const REAR = (front: string, extra = '', rider = 'rider.leg+1,2 rider.torso+1,2 rider.head+1,2 rider.arm.up+1,2'): string =>
  `_shadow horse.rear ${front} ${rider} ${extra}`.trim();

export const HORSE: UnitDef = {
  id: 'horse',
  group: 'units',
  canvas: { w: 36, h: 40 },
  anchor: { x: 17, y: 36 },
  origin: { x: 0, y: 6 },
  book,
  look: { keys: HORSE_KEYS, slots: { skin: 'skin4' } },
  hasShadow: true,
  hitFrom: 'idle',
  anims: [
    {
      anim: 'idle',
      fps: 5,
      loop: true,
      se: cycle(4, (i) => mountSE({ legs: STAND, body: [0, 0, 1, 1][i], rider: [0, 0, 1, 1][i] })),
      ne: cycle(4, (i) => mountNE({ legs: STAND, body: [0, 0, 1, 1][i] })),
    },
    {
      anim: 'fidget',
      fps: 6,
      loop: false,
      note: 'Horse tosses its head, paws the ground, swishes its tail; rider twirls nothing, just glares.',
      se: [
        mountSE({ legs: STAND }),
        mountSE({ legs: STAND, head: 'horse.head.up' }),
        mountSE({ legs: STAND, head: 'horse.head.up', tail: 'tail.swish' }),
        mountSE({ legs: PAW, head: 'horse.head', tail: 'tail.swish' }),
        mountSE({ legs: STAND, head: 'horse.head.down' }),
        mountSE({ legs: PAW, head: 'horse.head.down', tail: 'tail.swish' }),
        mountSE({ legs: STAND, head: 'horse.head' }),
        mountSE({ legs: STAND }),
      ],
      ne: [
        mountNE({ legs: STAND }),
        mountNE({ legs: STAND, head: 'horse.head.ne+0,-1' }),
        mountNE({ legs: STAND, head: 'horse.head.ne+0,-2' }),
        mountNE({ legs: PAW, head: 'horse.head.ne+0,-1' }),
        mountNE({ legs: STAND, head: 'horse.head.ne+0,1' }),
        mountNE({ legs: PAW, head: 'horse.head.ne+0,1' }),
        mountNE({ legs: STAND }),
        mountNE({ legs: STAND }),
      ],
    },
    {
      anim: 'walk',
      fps: 10,
      loop: true,
      note: '4-beat walk (near hind, near fore, far hind, far fore).',
      se: cycle(8, (i) =>
        mountSE({
          legs: walkLegs(i),
          body: WALK_BOB[i],
          head: `horse.head+0,${HEAD_NOD[i]}`,
          tail: i % 4 < 2 ? 'tail' : 'tail.swish',
        }),
      ),
      ne: cycle(8, (i) =>
        mountNE({ legs: walkLegs(i), body: WALK_BOB[i], head: `horse.head.ne+0,${HEAD_NOD[i]}` }),
      ),
    },
    {
      anim: 'run',
      fps: 12,
      loop: true,
      note: 'Gallop / trot (commanded moves, deploy arrival).',
      se: cycle(6, (i) =>
        mountSE({
          legs: gallopLegs(i),
          body: GALLOP_BOB[i],
          rider: (GALLOP_BOB[i] ?? 0) + (i % 3 === 0 ? 1 : 0),
          head: `horse.head+0,${[1, 1, 0, 0, -1, 0][i]}`,
          tail: 'tail.fly',
        }),
      ),
      ne: cycle(6, (i) =>
        mountNE({
          legs: gallopLegs(i),
          body: GALLOP_BOB[i],
          rider: (GALLOP_BOB[i] ?? 0) + (i % 3 === 0 ? 1 : 0),
          head: `horse.head.ne+0,${[1, 1, 0, 0, -1, 0][i]}`,
        }),
      ),
    },
    {
      anim: 'attack',
      fps: 12,
      loop: false,
      impact: 3,
      note: 'Rider winds up, swings the long baton down the near side (impact), recovers.',
      se: [
        mountSE({ legs: STAND, arm: 'up', head: 'horse.head.up' }),
        mountSE({ legs: STAND, arm: 'up+0,1', rider: 1, head: 'horse.head.up' }),
        mountSE({ legs: PAW, arm: 'over', extra: '!smear' }),
        mountSE({ legs: STAND, arm: 'strike', rider: 1, head: 'horse.head+0,1' }),
        mountSE({ legs: STAND, arm: 'strike+0,1', rider: 1 }),
        mountSE({ legs: STAND }),
      ],
      ne: [
        mountNE({ legs: STAND, arm: 'up' }),
        mountNE({ legs: STAND, arm: 'up+0,1', rider: 1 }),
        mountNE({ legs: PAW, arm: 'strike+-1,-2' }),
        mountNE({ legs: STAND, arm: 'strike', rider: 1 }),
        mountNE({ legs: STAND, arm: 'strike+0,1', rider: 1 }),
        mountNE({ legs: STAND }),
      ],
    },
    {
      anim: 'deploy',
      fps: 8,
      loop: false,
      impact: 5,
      note: 'Gallops in, rears up pawing the air (rider brandishes baton), lands (impact = dust).',
      se: [
        mountSE({ legs: gallopLegs(3), body: -1, tail: 'tail.fly' }),
        mountSE({ legs: STAND, head: 'horse.head.up', tail: 'tail.fly' }),
        REAR('rear.legs.front@25,11'),
        REAR('rear.legs.front2@25,10'),
        REAR('rear.legs.front@25,11'),
        mountSE({ legs: STAND, body: 1, rider: 2, head: 'horse.head.down' }),
        mountSE({ legs: STAND }),
      ],
      ne: [
        mountNE({ legs: gallopLegs(3), body: -1 }),
        mountNE({ legs: STAND, head: 'horse.head.ne+0,-2' }),
        REAR('rear.legs.front@25,11'),
        REAR('rear.legs.front2@25,10'),
        REAR('rear.legs.front@25,11'),
        mountNE({ legs: STAND, body: 1, rider: 2 }),
        mountNE({ legs: STAND }),
      ],
    },
    {
      anim: 'death',
      fps: 10,
      loop: false,
      note: 'Horse rears and throws the rider, who tumbles and lands. From frame 3 the horse is not drawn: spawn `flee` there. Ends on `body`.',
      se: [
        REAR('rear.legs.front@25,11', '', 'rider.leg+1,2 rider.torso+1,2 rider.head.hurt+1,2 rider.arm.up+1,2'),
        REAR('rear.legs.front2@25,10', 'rider.tumble%3@1,-1', ''),
        mountSE({ legs: STAND, head: 'horse.head.up', riderless: true, tail: 'tail.fly', extra: 'rider.tumble%1@0,8' }),
        '_rider.shadow rider.tumble%2@2,16',
        '_rider.shadow rider.lie+0,-2',
        '_rider.shadow rider.lie',
        '_rider.shadow rider.lie.flat',
        '_rider.shadow rider.lie.flat',
      ],
      ne: [
        REAR('rear.legs.front@25,11', '', 'rider.leg+1,2 rider.torso+1,2 rider.head.hurt+1,2 rider.arm.up+1,2'),
        REAR('rear.legs.front2@25,10', 'rider.tumble%3@1,-1', ''),
        mountNE({ legs: STAND, head: 'horse.head.ne+0,-2', riderless: true, extra: 'rider.tumble%1@0,8' }),
        '_rider.shadow rider.tumble%2@2,16',
        '_rider.shadow rider.lie+0,-2',
        '_rider.shadow rider.lie',
        '_rider.shadow rider.lie.flat',
        '_rider.shadow rider.lie.flat',
      ],
    },
    {
      anim: 'body',
      fps: 0,
      loop: false,
      se: ['_rider.shadow rider.lie.flat'],
      ne: ['_rider.shadow rider.lie.flat'],
    },
    {
      anim: 'flee',
      fps: 12,
      loop: true,
      note: 'Riderless horse bolting (after `death` frame 3). Move it off the map; despawn.',
      se: cycle(6, (i) =>
        mountSE({
          legs: gallopLegs(i),
          body: GALLOP_BOB[i],
          head: `horse.head.up+0,${[1, 1, 0, 0, -1, 0][i]}`,
          tail: 'tail.fly',
          riderless: true,
        }),
      ),
      ne: cycle(6, (i) =>
        mountNE({ legs: gallopLegs(i), body: GALLOP_BOB[i], riderless: true }),
      ),
    },
  ],
};
