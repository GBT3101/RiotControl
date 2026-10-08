/**
 * Sample sprite proving the art pipeline: Riot Control officer (M1). M4a redoes all units.
 *
 * Built with the paper-doll compositor: legs are the base frames (one per animation frame),
 * the upper body, shield and baton arm are parts attached to per-frame anchors so the body
 * bobs with the gait. Skin is a semantic slot so officers can vary (`$skin`).
 * Frames are authored without outline on a 13×18 canvas, padded by 1 px and auto-outlined.
 */
import type { RampName } from '../palette';
import { blankFrames, keyFrames, keyGrid, type KeyMap } from '../lib/grid';
import { composeDoll, type DollBase, type DollPart } from '../lib/paperdoll';
import type { SpriteRegistry } from '../lib/registry';
import {
  ARM_SE,
  ARM_NE,
  LEGS_IDLE,
  LEGS_WALK,
  SHIELD_NE,
  SHIELD_SE,
  UPPER_NE,
  UPPER_SE,
} from './riotCop.grid';

/** Shared key alphabet for every cop part. */
export const COP_KEYS: KeyMap = {
  // Navy uniform / helmet (navy ramp: ink, navy0, navy1, navy2, blue1).
  '1': 'navy.1',
  '2': 'navy.2',
  '3': 'navy.3',
  '4': 'navy.4',
  k: 'ink',
  // Raised visor (zinc).
  V: 'zinc4',
  v: 'zinc3',
  x: 'zinc2',
  // Skin (semantic slot).
  L: '$skin.2',
  S: '$skin.1',
  s: '$skin.0',
  e: 'ink',
  // Hi-vis accents.
  y: 'hivis2',
  Y: 'hivis1',
  O: 'olive2',
  c: 'ochre2',
  // Shield (polycarbonate: zinc / sky).
  W: 'white',
  P: 'sky',
  p: 'zinc3',
  q: 'zinc2',
  f: 'zinc1',
  // Baton & boots.
  b: 'gray3',
  m: 'gray5',
  B: 'gray1',
  n: 'gray3',
};

const OUTLINE = 'ink';
/** Body bob per walk frame (0 = up, 1 = down): contact, down, pass, contact, down, pass. */
const WALK_BOB = [0, 1, 0, 0, 1, 0];
const IDLE_BOB = [0, 0, 1, 1];

function partsFor(facing: 'se' | 'ne', legs: string): DollPart[] {
  const upper = keyGrid(facing === 'se' ? UPPER_SE : UPPER_NE, `cop.upper.${facing}`);
  const shield = keyGrid(facing === 'se' ? SHIELD_SE : SHIELD_NE, `cop.shield.${facing}`);
  const arms = keyFrames(facing === 'se' ? ARM_SE : ARM_NE, `cop.arm.${facing}`);
  return [
    { frames: keyFrames(legs, `cop.legs.${facing}`), keys: COP_KEYS, attach: 'legs', z: 0 },
    { frames: upper, keys: COP_KEYS, attach: 'body', z: 1 },
    // SE: shield in front (z 2) and baton arm nearest (z 3). NE: shield is behind the body.
    { frames: shield, keys: COP_KEYS, attach: 'shield', z: facing === 'se' ? 2 : -1 },
    { frames: arms, keys: COP_KEYS, attach: 'arm', z: 3 },
  ];
}

function bodyAnchors(
  bob: readonly number[],
  facing: 'se' | 'ne',
  armSwing: readonly number[],
): DollBase['anchors'] {
  const body = bob.map((b) => ({ x: 0, y: b }));
  const shield =
    facing === 'se' ? bob.map((b) => ({ x: 8, y: 8 + b })) : bob.map((b) => ({ x: 0, y: 7 + b }));
  const arm =
    facing === 'se'
      ? bob.map((b, i) => ({ x: 0, y: 8 + b + (armSwing[i] ?? 0) }))
      : bob.map((b, i) => ({ x: 10, y: 8 + b + (armSwing[i] ?? 0) }));
  return { body, shield, arm, legs: { x: 0, y: 13 } };
}

function build(
  facing: 'se' | 'ne',
  legs: string,
  bob: readonly number[],
  armSwing: readonly number[],
  skin: RampName,
) {
  const base: DollBase = {
    frames: blankFrames(13, 18, bob.length),
    keys: {},
    anchors: bodyAnchors(bob, facing, armSwing),
  };
  return composeDoll(
    base,
    partsFor(facing, legs),
    { slots: { skin } },
    { margin: 1, outline: OUTLINE },
  );
}

/** Skin ramps officers are drawn with (Ministry recruits from everywhere). */
export const COP_SKINS: readonly RampName[] = [
  'skin6',
  'skin5',
  'skin4',
  'skin3',
  'skin2',
  'skin1',
];

/** Register the officer: idle + walk for SE/NE (+ mirrored SW/NW), per skin variant. */
export function registerRiotCop(reg: SpriteRegistry): void {
  COP_SKINS.forEach((skin, i) => {
    const prefix = i === 0 ? 'unit.riot' : `unit.riot.v${i}`;
    const group = i === 0 ? 'units' : 'variants';
    // Foot anchor: between the boots, on the ground row (interior row 16 + 1 px margin).
    const anchor = { x: 7, y: 17 };
    reg.add(`${prefix}.idle.se`, {
      group,
      frames: build('se', LEGS_IDLE, IDLE_BOB, [0, 0, 0, 0], skin),
      fps: 5,
      anchor,
      hasShadow: true,
      mirrorAs: `${prefix}.idle.sw`,
    });
    reg.add(`${prefix}.walk.se`, {
      group,
      frames: build('se', LEGS_WALK, WALK_BOB, [0, 0, 1, 0, 0, -1], skin),
      fps: 10,
      anchor,
      hasShadow: true,
      mirrorAs: `${prefix}.walk.sw`,
    });
    reg.add(`${prefix}.walk.ne`, {
      group,
      frames: build('ne', LEGS_WALK, WALK_BOB, [0, 0, 1, 0, 0, -1], skin),
      fps: 10,
      anchor,
      hasShadow: true,
      mirrorAs: `${prefix}.walk.nw`,
    });
  });
}
