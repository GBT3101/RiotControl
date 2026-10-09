/**
 * Protester animation pose tables (M4b). Each generator returns one Pose per frame for a
 * variant Kit and facing; figure.ts renders them. Timing follows art bible §3.4.
 */
import type { Facing, HeldItem, Pose } from './figure';

export type Gait = 'stroll' | 'march' | 'twitch' | 'stomp' | 'shuffle';
export type Carry =
  | 'none'
  | 'pole'
  | 'card'
  | 'item'
  | 'phone'
  | 'megaphone'
  | 'rifle'
  | 'bazooka'
  | 'camera'
  | 'pot';
export type Attack = 'none' | 'punch' | 'swing' | 'stab' | 'pistol' | 'rifle' | 'bazooka' | 'strap' | 'bonk';
export type Idle =
  | 'chant'
  | 'sign'
  | 'card'
  | 'phone'
  | 'vape'
  | 'megaphone'
  | 'menace'
  | 'toss'
  | 'twitch'
  | 'preach'
  | 'wag'
  | 'flash'
  | 'cult'
  | 'pot';

export interface Kit {
  carry: Carry;
  /** Item carried in idle / walk / run (carry 'item'). */
  carryItem?: string;
  attack: Attack;
  /** Item used by swing / stab / pistol attacks. */
  weapon?: string;
  idle: Idle;
  gait: Gait;
  climbs: boolean;
  molotov: boolean;
  special?: 'breta' | 'paparazzi' | 'prophet';
  /** Default face for walk / run. */
  mood: string;
}

export interface AnimSpec {
  poses: Pose[];
  fps: number;
  loop: boolean;
  /** Gameplay-relevant frame (impact / release / shot), if any. */
  keyFrame?: number;
  /** Name of the work-canvas point to report for the key frame (muzzle / release). */
  keyPoint?: string;
}

const it = (id: string | undefined, ori: string): HeldItem | null => (id ? { id, ori } : null);

/** Item / sign shown while not attacking. */
function carried(k: Kit, ori = 'down'): Partial<Pose> {
  switch (k.carry) {
    case 'item':
      return { itemR: it(k.carryItem, ori) };
    case 'phone':
      return { armR: 'face', itemR: it('phone', 'face') };
    case 'megaphone':
      return { armR: 'face', itemR: it('megaphone', 'face') };
    case 'pole':
      return { armR: 'up', sign: 'pole' };
    case 'card':
      return { armR: 'hold', armL: 'hold', sign: 'card' };
    case 'rifle':
      return { itemR: it('rifle', 'down') };
    case 'bazooka':
      return { armR: 'face', armL: 'reach', itemR: it('bazooka', 'fwd') };
    case 'camera':
      return { armR: 'face', armL: 'reach', itemR: it('camera', 'face') };
    case 'pot':
      return { itemR: it('pot', 'down') };
    default:
      return {};
  }
}

/** Two-handed carries lock both arms; one-handed lock only R. */
function locksR(k: Kit): boolean {
  return ['phone', 'megaphone', 'pole', 'card', 'bazooka', 'camera'].includes(k.carry);
}
function locksL(k: Kit): boolean {
  return ['card', 'bazooka', 'camera'].includes(k.carry);
}

// ------------------------------------------------------------------------------------ idle
export function idle(k: Kit, _f: Facing): AnimSpec {
  const bob = [0, 0, 1, 1];
  const base = (i: number): Pose => ({
    legs: 'stand',
    bob: bob[i],
    armR: 'down',
    armL: 'down',
    face: k.mood === 'happy' ? 'happy' : k.mood,
  });
  const P = (fn: (i: number) => Partial<Pose>): Pose[] =>
    [0, 1, 2, 3].map((i) => ({ ...base(i), ...fn(i) }) as Pose);
  let poses: Pose[];
  switch (k.idle) {
    case 'chant':
      poses = P((i) => ({
        armR: i < 2 ? 'upF' : 'pump',
        face: i < 2 ? 'shout' : 'angry',
        ...(k.carry === 'item' ? { itemR: it(k.carryItem, i < 2 ? 'up' : 'down') } : {}),
      }));
      break;
    case 'sign':
      poses = P((i) => ({ armR: 'up', sign: 'pole', signDy: [0, -1, -2, -1][i], armL: i < 2 ? 'down' : 'swingB', face: i === 1 ? 'shout' : undefined }));
      break;
    case 'card':
      poses = P((i) => ({ armR: 'hold', armL: 'hold', sign: 'card', signDy: [0, -1, 0, 1][i], hy: i === 1 ? -1 : 0, face: i % 2 ? 'shout' : 'angry' }));
      break;
    case 'phone':
      poses = P((i) => ({ armR: 'face', itemR: it('phone', 'face'), hx: i === 3 ? -1 : 0, face: i === 2 ? 'happy' : 'neutral', fx: i === 1 ? [{ id: 'spark2', at: 'handR', dx: 1, dy: -1 }] : undefined }));
      break;
    case 'vape':
      poses = P((i) => ({
        armR: i === 1 || i === 2 ? 'face' : 'down',
        itemR: it('vape', i === 1 || i === 2 ? 'face' : 'down'),
        fx: i === 2 ? [{ id: 'vape1', at: 'mouth', dx: 1, dy: -1 }] : i === 3 ? [{ id: 'vape2', at: 'mouth', dx: 1, dy: -2 }] : i === 0 ? [{ id: 'vape3', at: 'mouth', dx: 2, dy: -4 }] : undefined,
        face: 'neutral',
      }));
      break;
    case 'megaphone':
      poses = P((i) => ({ armR: 'face', itemR: it('megaphone', 'face'), armL: i % 2 ? 'upF' : 'down', face: 'shout', hy: i % 2 ? -1 : 0 }));
      break;
    case 'menace':
      poses = P((i) => ({ legs: 'wide', armR: i % 2 ? 'swingF' : 'down', itemR: it(k.carryItem ?? k.weapon, i % 2 ? 'low' : 'down'), face: 'angry' }));
      break;
    case 'toss':
      poses = P((i) => ({ legs: 'wide', armR: ['chest', 'face', 'chest', 'down'][i]!, itemR: it(k.carryItem, ['up', 'up', 'up', 'down'][i]!), itemL: null, face: 'angry', hy: i === 1 ? -1 : 0 }));
      break;
    case 'twitch':
      poses = P((i) => ({ hx: [0, 1, 0, -1][i], face: ['wide', 'angry', 'wide', 'shout'][i], armR: i === 3 ? 'upF' : 'down', itemR: it(k.weapon, i === 3 ? 'up' : 'down'), armL: i === 1 ? 'swingF' : 'down', dx: i === 2 ? 1 : 0 }));
      break;
    case 'preach':
      poses = P((i) => ({ armR: i % 2 ? 'up' : 'upF', armL: i % 2 ? 'upF' : 'up', face: 'shout', hy: i % 2 ? -1 : 0 }));
      break;
    case 'wag':
      poses = P((i) => ({ armR: i % 2 ? 'wag2' : 'wag', armL: 'hold', sign: 'cardL', face: 'scowl', dy: i === 3 ? 0 : 0, legs: i === 2 ? 'wide' : 'stand' }));
      break;
    case 'flash':
      poses = P((i) => ({ armR: 'face', armL: 'reach', itemR: it('camera', 'face'), lean: 1, hy: 1, fx: i === 2 ? [{ id: 'flashbig', at: 'tipR' }] : i === 3 ? [{ id: 'flash', at: 'tipR' }] : undefined }));
      break;
    case 'cult':
      poses = P((i) => ({
        ...carried(k, 'up'),
        armR: k.carry === 'bazooka' ? 'face' : k.carry === 'rifle' ? 'chest' : i < 2 ? 'chest' : 'up',
        itemR: k.carry === 'bazooka' ? it('bazooka', 'fwd') : k.carry === 'rifle' ? it('rifle', 'up') : it(k.carryItem, 'up'),
        hy: i % 2,
        face: 'neutral',
      }));
      break;
    case 'pot':
      poses = P((i) => ({ armR: i % 2 ? 'up' : 'upF', itemR: it('pot', 'up'), armL: i % 2 ? 'face' : 'upF', face: 'shout', fx: i % 2 ? [{ id: 'spark2', at: 'handR', dx: 1, dy: -4 }] : undefined }));
      break;
  }
  if (k.idle !== 'card' && k.idle !== 'sign' && k.idle !== 'wag' && (k.carry === 'card' || k.carry === 'pole')) {
    // sign carriers keep the sign visible
    poses = poses.map((p) => ({ ...p, ...carried(k) }));
  }
  return { poses, fps: 5, loop: true };
}

// ------------------------------------------------------------------------------------ walk
const WALK_LEGS = ['walk0', 'walk1', 'walk2', 'walk3'];
const SWING_R = ['swingF', 'swingF', 'down', 'swingB', 'swingB', 'swingB', 'down', 'swingF'];
const SWING_L = ['swingB', 'swingB', 'down', 'swingF', 'swingF', 'swingF', 'down', 'swingB'];
const PUMP_R = ['pump', 'pump', 'down', 'swingB', 'swingB', 'swingB', 'down', 'pump'];
const PUMP_L = ['swingB', 'swingB', 'down', 'pump', 'pump', 'pump', 'down', 'swingB'];

export function walk(k: Kit, _f: Facing): AnimSpec {
  const poses: Pose[] = [];
  for (let i = 0; i < 8; i++) {
    const half = i >= 4;
    let p: Pose = {
      legs: WALK_LEGS[i % 4]!,
      swap: half,
      armR: SWING_R[i]!,
      armL: SWING_L[i]!,
      face: k.mood,
    };
    switch (k.gait) {
      case 'march':
        p = { ...p, armR: PUMP_R[i]!, armL: PUMP_L[i]!, lean: i % 4 === 1 ? 1 : 0, hy: i % 4 === 1 ? 1 : 0 };
        break;
      case 'twitch':
        p = {
          ...p,
          hx: [0, 1, 0, 0, -1, 0, 1, 0][i],
          dx: [0, 0, 1, 0, 0, -1, 0, 0][i],
          face: i === 2 || i === 5 ? 'wide' : k.mood,
          armL: i === 5 ? 'upF' : p.armL,
        };
        break;
      case 'stomp':
        p = { ...p, armR: PUMP_R[i]!, armL: PUMP_L[i]!, bob: i % 4 === 0 ? 1 : 0, dy: i % 4 === 0 ? 0 : 0, face: 'scowl' };
        break;
      case 'shuffle':
        p = { ...p, legs: i % 2 ? 'shuffle1' : 'shuffle0', swap: i % 4 >= 2, lean: 1, hy: 1 };
        break;
      default:
        break;
    }
    const c = carried(k);
    p = { ...p, ...c };
    if (locksR(k) && !locksL(k) && k.gait === 'march') p.armL = PUMP_L[i]!;
    if (k.carry === 'item' || k.carry === 'rifle' || k.carry === 'pot') {
      // keep the swing but the item hangs from the hand
      p.armR = SWING_R[i] === 'swingF' ? 'swingF' : SWING_R[i]!;
    }
    poses.push(p);
  }
  return { poses, fps: 10, loop: true };
}

// ------------------------------------------------------------------------------------ run
const RUN_R = ['pump', 'pump', 'down', 'swingB', 'swingB', 'down'];
const RUN_L = ['swingB', 'swingB', 'down', 'pump', 'pump', 'down'];

export function run(k: Kit, _f: Facing): AnimSpec {
  const poses: Pose[] = [];
  for (let i = 0; i < 6; i++) {
    let p: Pose = {
      legs: ['run0', 'run1', 'run2'][i % 3]!,
      swap: i >= 3,
      lean: 1,
      armR: RUN_R[i]!,
      armL: RUN_L[i]!,
      face: k.special === 'prophet' ? 'shout' : k.mood === 'happy' || k.mood === 'neutral' ? 'shout' : k.mood,
    };
    if (k.special === 'prophet') p = { ...p, armR: i % 2 ? 'up' : 'upF', armL: i % 2 ? 'upF' : 'up', lean: 0 };
    else p = { ...p, ...carried(k) };
    if (k.carry === 'item' || k.carry === 'rifle' || k.carry === 'pot') p.armR = RUN_R[i] === 'pump' ? 'swingF' : RUN_R[i]!;
    if (k.special === 'paparazzi') p = { ...p, lean: 1, hy: 1 };
    poses.push(p);
  }
  return { poses, fps: 12, loop: true };
}

// ------------------------------------------------------------------------------------ attacks
export function attack(k: Kit, _f: Facing): AnimSpec | undefined {
  const w = k.weapon;
  const keep: Partial<Pose> = locksL(k) && k.attack !== 'bonk' ? {} : {};
  switch (k.attack) {
    case 'punch':
      return {
        fps: 12,
        loop: false,
        keyFrame: 1,
        keyPoint: 'handR',
        poses: [
          { legs: 'wide', armR: 'swingB', armL: 'pump', lean: -1, face: 'angry' },
          { legs: 'step', armR: 'fwd', armL: 'swingB', lean: 1, dx: 1, face: 'shout' },
          { legs: 'step', armR: 'fwd', armL: 'swingB', lean: 1, dx: 1, face: 'shout' },
          { legs: 'wide', armR: 'pump', armL: 'down', lean: 0, face: 'angry' },
        ],
      };
    case 'swing':
      return {
        fps: 12,
        loop: false,
        keyFrame: 2,
        keyPoint: 'handR',
        poses: [
          { legs: 'wide', armR: 'back', itemR: it(w, 'back'), armL: 'swingF', lean: -1, face: 'angry', ...keep },
          { legs: 'step', armR: 'upF', itemR: it(w, 'swing'), armL: 'down', lean: 0, face: 'shout' },
          { legs: 'step', armR: 'fwd', itemR: it(w, 'fwd'), armL: 'swingB', lean: 1, dx: 1, face: 'shout' },
          { legs: 'step', armR: 'swingF', itemR: it(w, 'low'), armL: 'swingB', lean: 1, dx: 1, face: 'angry' },
          { legs: 'wide', armR: 'down', itemR: it(w, 'down'), armL: 'down', lean: 0, face: 'angry' },
        ],
      };
    case 'bonk':
      // sign-on-a-pole chop
      return {
        fps: 12,
        loop: false,
        keyFrame: 2,
        keyPoint: 'handR',
        poses: [
          { legs: 'wide', armR: 'up', sign: 'pole', signDy: -2, armL: 'swingF', lean: -1, face: 'angry' },
          { legs: 'step', armR: 'up', sign: 'pole', signDy: -1, armL: 'down', lean: 0, face: 'shout' },
          { legs: 'step', armR: 'upF', sign: 'pole', signDy: 3, armL: 'swingB', lean: 1, dx: 1, face: 'shout' },
          { legs: 'step', armR: 'upF', sign: 'pole', signDy: 2, armL: 'swingB', lean: 1, dx: 1, face: 'angry' },
          { legs: 'wide', armR: 'up', sign: 'pole', armL: 'down', lean: 0, face: 'angry' },
        ],
      };
    case 'stab':
      return {
        fps: 12,
        loop: false,
        keyFrame: 1,
        keyPoint: 'handR',
        poses: [
          { legs: 'wide', armR: 'chest', itemR: it(w, 'down'), armL: 'swingF', lean: -1, face: 'angry' },
          { legs: 'step', armR: 'fwd', itemR: it(w, 'fwd'), armL: 'swingB', lean: 1, dx: 1, face: 'shout' },
          { legs: 'step', armR: 'fwd', itemR: it(w, 'fwd'), armL: 'swingB', lean: 1, dx: 1, face: 'angry' },
          { legs: 'wide', armR: 'swingF', itemR: it(w, 'low'), armL: 'down', lean: 0, face: 'angry' },
        ],
      };
    case 'pistol':
      return {
        fps: 12,
        loop: false,
        keyFrame: 1,
        keyPoint: 'tipR',
        poses: [
          { legs: 'wide', armR: 'aim', itemR: it(w ?? 'pistol', 'fwd'), armL: 'down', face: 'wide' },
          { legs: 'wide', armR: 'aim', itemR: it(w ?? 'pistol', 'fwd'), armL: 'down', face: 'shout', fx: [{ id: 'muzzle', at: 'tipR', dx: 1 }] },
          { legs: 'wide', armR: 'aim', itemR: it(w ?? 'pistol', 'fwd'), armL: 'swingB', face: 'shout', lean: -1, hy: -1 },
          { legs: 'wide', armR: 'aim', itemR: it(w ?? 'pistol', 'fwd'), armL: 'down', face: 'wide' },
        ],
      };
    case 'rifle':
      return {
        fps: 12,
        loop: false,
        keyFrame: 1,
        keyPoint: 'tipR',
        poses: [
          { legs: 'wide', armR: 'aim', armL: 'reach', itemR: it('rifle', 'fwd'), face: 'angry' },
          { legs: 'wide', armR: 'aim', armL: 'reach', itemR: it('rifle', 'fwd'), face: 'angry', fx: [{ id: 'muzzle', at: 'tipR', dx: 1 }] },
          { legs: 'wide', armR: 'aim', armL: 'reach', itemR: it('rifle', 'fwd'), face: 'angry', lean: -1 },
          { legs: 'wide', armR: 'aim', armL: 'reach', itemR: it('rifle', 'fwd'), face: 'angry' },
        ],
      };
    case 'bazooka': {
      const b = { armR: 'face', armL: 'reach', itemR: it('bazooka', 'fwd') };
      return {
        fps: 12,
        loop: false,
        keyFrame: 2,
        keyPoint: 'tipR',
        poses: [
          { legs: 'wide', ...b, face: 'angry' },
          { legs: 'wide', ...b, face: 'angry', lean: 1 },
          { legs: 'wide', ...b, face: 'shout', fx: [{ id: 'muzzlebig', at: 'tipR', dx: 1 }, { id: 'backblast', at: 'backR' }] },
          { legs: 'wide', ...b, face: 'shout', lean: -1, dx: -1, fx: [{ id: 'smoke', at: 'backR', dx: -2 }] },
          { legs: 'wide', ...b, face: 'angry', dx: -1, fx: [{ id: 'smoke', at: 'backR', dx: -4, dy: -2 }] },
          { legs: 'wide', ...b, face: 'angry' },
        ],
      };
    }
    case 'strap':
      return {
        fps: 12,
        loop: false,
        keyFrame: 3,
        keyPoint: 'handR',
        poses: [
          { legs: 'wide', armR: 'down', itemR: it('camera', 'dangle'), armL: 'down', face: 'angry', lean: 1 },
          { legs: 'wide', armR: 'back', itemR: it('camera', 'swing'), armL: 'swingF', face: 'angry', lean: -1 },
          { legs: 'step', armR: 'up', itemR: it('camera', 'up'), armL: 'down', face: 'shout' },
          { legs: 'step', armR: 'fwd', itemR: it('camera', 'fwd'), armL: 'swingB', face: 'shout', lean: 1, dx: 1 },
          { legs: 'wide', armR: 'down', itemR: it('camera', 'dangle'), armL: 'down', face: 'angry' },
        ],
      };
    default:
      return undefined;
  }
}

/** Very Violent: molotov throw (release frame 2 = bottle leaves the hand at `handR`). */
export function molotov(_k: Kit, _f: Facing): AnimSpec {
  const fl = (id: string): Pose['fx'] => [{ id, at: 'handR', dy: -4 }];
  return {
    fps: 12,
    loop: false,
    keyFrame: 2,
    keyPoint: 'handR',
    poses: [
      { legs: 'stand', armR: 'chest', itemR: it('molotov', 'lit'), armL: 'down', face: 'angry', fx: [{ id: 'flame', at: 'handR', dy: -4 }] },
      { legs: 'wide', armR: 'back', itemR: it('molotov', 'back'), armL: 'swingF', lean: -1, face: 'angry', fx: [{ id: 'flame2', at: 'handR', dx: 1, dy: -2 }] },
      { legs: 'step', armR: 'upF', itemR: it('molotov', 'swing'), armL: 'swingB', lean: 1, face: 'shout', fx: fl('flame') },
      { legs: 'step', armR: 'fwd', armL: 'swingB', lean: 1, dx: 1, face: 'shout' },
      { legs: 'wide', armR: 'swingF', armL: 'down', face: 'angry' },
      { legs: 'stand', armR: 'down', armL: 'down', face: 'angry' },
    ],
  };
}

/** Paparazzi flash pop (2 frames, bright burst at the camera's flash). */
export function flash(_k: Kit, _f: Facing): AnimSpec {
  const b = { legs: 'wide', armR: 'face', armL: 'reach', itemR: it('camera', 'face'), lean: 1, hy: 1 } as const;
  return {
    fps: 12,
    loop: false,
    keyFrame: 0,
    keyPoint: 'tipR',
    poses: [
      { ...b, fx: [{ id: 'flashbig', at: 'tipR' }] },
      { ...b, fx: [{ id: 'flash', at: 'tipR' }] },
    ],
  };
}

/** Prophet pre-explosion wind-up: shaking, glowing outline, fuse sparks (explosion = M5). */
export function windup(_k: Kit, _f: Facing): AnimSpec {
  return {
    fps: 12,
    loop: true,
    keyPoint: 'chest',
    poses: [0, 1, 2, 3].map((i) => ({
      legs: i % 2 ? 'wide' : 'stand',
      armR: i % 2 ? 'up' : 'upF',
      armL: i % 2 ? 'upF' : 'up',
      dx: [0, 1, 0, -1][i],
      hy: i % 2 ? -1 : 0,
      face: 'shout',
      glow: i % 2 ? 'ochre3' : 'rust2',
      fx: [{ id: i % 2 ? 'spark' : 'spark2', at: 'chest', dx: i % 2 ? -5 : 5, dy: -4 }],
    })),
  };
}

/** Facade climb (back view; NE drawn, NW mirrored). */
export function climb(_k: Kit, _f: Facing): AnimSpec {
  return {
    fps: 8,
    loop: true,
    poses: [
      { legs: 'climb0', armR: 'up', armL: 'chest', view: 'ne', noShadow: true, dy: 0 },
      { legs: 'climb1', armR: 'upF', armL: 'upF', view: 'ne', noShadow: true, dy: -1 },
      { legs: 'climb0', swap: true, armR: 'chest', armL: 'up', view: 'ne', noShadow: true, dy: 0 },
      { legs: 'climb1', swap: true, armR: 'upF', armL: 'upF', view: 'ne', noShadow: true, dy: -1 },
    ],
  };
}

/** Grab & throw a rooftop sniper (release frame 2). */
export function heave(_k: Kit, _f: Facing): AnimSpec {
  return {
    fps: 8,
    loop: false,
    keyFrame: 2,
    keyPoint: 'handR',
    poses: [
      { legs: 'crouch', armR: 'down', armL: 'down', lean: 1, face: 'angry' },
      { legs: 'wide', armR: 'up', armL: 'up', lean: -1, face: 'shout', hy: -1 },
      { legs: 'step', armR: 'upF', armL: 'upF', lean: 1, dx: 1, face: 'shout' },
      { legs: 'stand', armR: 'down', armL: 'down', face: 'happy' },
    ],
  };
}

/** Hit: 1 white flash frame + 1 knock-back frame. */
export function hit(k: Kit, f: Facing): AnimSpec {
  const i0 = idle(k, f).poses[0]!;
  return {
    fps: 12,
    loop: false,
    poses: [
      { ...i0, white: true },
      { ...i0, dx: -1, lean: -1, face: 'wince', hy: -1, fx: undefined },
    ],
  };
}

const LETHAL_LYING: Pose = { legs: 'stand', armR: 'up', armL: 'upF', view: 'ne', xf: 'cw', noBack: true };
const KO_LYING: Pose = { legs: 'wide', armR: 'up', armL: 'up', view: 'se', xf: 'ccw', face: 'ko', noBack: true };

/**
 * Lethal death, standing part: recoil → stagger → buckle → fall forward (4 frames). Chain
 * into `body` (bounce + settle, face down) — split so the tall and the wide poses don't
 * share one bounding box in the atlas.
 */
export function die(_k: Kit, _f: Facing): AnimSpec {
  return {
    fps: 10,
    loop: false,
    poses: [
      { legs: 'stand', armR: 'upF', armL: 'upF', dx: -1, lean: -1, hy: -1, face: 'wince' },
      { legs: 'step', armR: 'up', armL: 'swingB', dx: -1, lean: -1, face: 'wince' },
      { legs: 'crouch', armR: 'limp', armL: 'limp', hy: 1, face: 'dead' },
      { legs: 'stand', armR: 'swingF', armL: 'swingF', face: 'dead', xf: 'tiltF' },
    ],
  };
}

/** Lethal body: hits the ground (bounce) then settles face down; hold the last frame. */
export function body(_k: Kit, _f: Facing): AnimSpec {
  return { fps: 10, loop: false, poses: [{ ...LETHAL_LYING, dy: -1 }, { ...LETHAL_LYING }] };
}

/** KO body (face up, X-eyes): bounce then settle. */
export function koBody(_k: Kit, _f: Facing): AnimSpec {
  return { fps: 8, loop: false, poses: [{ ...KO_LYING, dy: -1 }, { ...KO_LYING }] };
}

/** Non-lethal KO, standing part: dizzy stagger → sink → fall backward. Chain into `kobody`. */
export function ko(_k: Kit, _f: Facing): AnimSpec {
  return {
    fps: 8,
    loop: false,
    poses: [
      { legs: 'stand', armR: 'swingB', armL: 'swingB', dx: -1, lean: -1, face: 'wince' },
      { legs: 'wide', armR: 'upF', armL: 'down', hx: 1, face: 'ko' },
      { legs: 'stand', armR: 'down', armL: 'upF', hx: -1, dx: 1, face: 'ko' },
      { legs: 'wide', armR: 'upF', armL: 'swingF', hx: 1, face: 'ko' },
      { legs: 'crouch', armR: 'limp', armL: 'limp', face: 'ko' },
      { legs: 'stand', armR: 'upF', armL: 'upF', face: 'ko', xf: 'tiltB' },
    ],
  };
}

/** Stepping out of a residential door (SE drawn, SW mirrored). */
export function door(k: Kit, _f: Facing): AnimSpec {
  return {
    fps: 6,
    loop: false,
    poses: [
      { legs: 'step', armR: 'swingF', armL: 'swingB', lean: 1, face: k.mood },
      { legs: 'stand', armR: 'down', armL: 'down', face: 'look', hx: -1 },
      { legs: 'stand', armR: 'up', armL: 'up', face: 'happy', hy: -1 },
    ],
  };
}
