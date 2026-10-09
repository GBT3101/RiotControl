/**
 * Protester variants (M4b): seeded, deterministic wardrobe rolls per type.
 *
 * Every variant = Look (paper-doll parts + tone ramps) + Kit (what it carries, how it moves
 * and fights). Rolls depend only on (seed, type, index, city), never on how many variants
 * are built, so variant `v7` of a type is stable across quality tiers.
 */
import { Rng } from '../../core/rng';
import type { Attack, Carry, Gait, Idle, Kit } from './anims';
import type { Build, Look } from './figure';
import { SLOGANS, STUDENT_SLOGANS, makeBoard, makeSign, type City, type SignStyle } from './sign';
import {
  CLOTH,
  DYED_HAIR,
  HAIR,
  NATURAL_HAIR,
  SKIN,
  SKIN_TONES,
  type ClothTone,
  type HairTone,
  type Tone,
} from './tones';

export const PROTESTER_TYPES = [
  'student',
  'woke',
  'mob',
  'violent',
  'crazy',
  'cultist',
  'prophet',
  'breta',
  'paparazzi',
] as const;
export type ProtesterType = (typeof PROTESTER_TYPES)[number];

export interface Variant {
  type: ProtesterType;
  index: number;
  look: Look;
  kit: Kit;
  /** Gameplay loadout the visuals match (sim should pick variants by loadout). */
  loadout: string;
}

type W<T> = ReadonlyArray<readonly [T, number]>;
function pw<T>(rng: Rng, opts: W<T>): T {
  return rng.weighted(
    opts.map((o) => o[0]),
    opts.map((o) => o[1]),
  );
}
const cl = (n: ClothTone): Tone => CLOTH[n];
const skinCloth = (s: Tone): Tone => [s[0]!, s[0]!, s[1]!, s[2]!];

const BRIGHT: readonly ClothTone[] = ['red', 'scarlet', 'orange', 'mustard', 'yellow', 'teal', 'sky', 'purple', 'pink', 'lime', 'green', 'magenta', 'lilac', 'cream', 'white'];
const EARTHY: readonly ClothTone[] = ['mustard', 'maroon', 'forest', 'tan', 'brown', 'khaki', 'cream', 'ochre', 'purple', 'plum', 'teal', 'red', 'pink'];
const PANTS: readonly ClothTone[] = ['denim', 'denim', 'stonewash', 'charcoal', 'black', 'khaki', 'brown', 'grey', 'cream'];
const SHOES: W<[ClothTone, ClothTone]> = [
  [['white', 'white'], 4],
  [['charcoal', 'white'], 2],
  [['red', 'white'], 1],
  [['sky', 'white'], 1],
  [['black', 'charcoal'], 3],
  [['brown', 'brown'], 2],
  [['lime', 'white'], 0.5],
  [['pink', 'white'], 0.5],
];
const GEAR_TONES: readonly ClothTone[] = ['red', 'teal', 'mustard', 'green', 'purple', 'orange', 'sky', 'charcoal', 'pink', 'brown', 'lime', 'forest'];
const BOARDS: W<Tone> = [
  [CLOTH.cardboard, 6],
  [CLOTH.white, 3],
  [CLOTH.yellow, 1],
  [CLOTH.pink, 1],
  [CLOTH.sky, 1],
  [CLOTH.lime, 0.6],
];
const INKS: W<string> = [
  ['ink', 6],
  ['crim1', 3],
  ['plum0', 1],
  ['green1', 1],
  ['rust0', 1],
];

interface Wear {
  hair: string;
  hairTone: HairTone;
  hairAlt?: HairTone;
  beard?: string;
  hat?: string;
  hatTone: ClothTone;
  face: string[];
  top: string;
  topTone: ClothTone;
  accTone: ClothTone;
  sleeves: 'short' | 'long' | 'bare' | 'acc';
  bottom: 'pants' | 'shorts' | 'skirt';
  botTone: ClothTone;
  skirtTone?: ClothTone;
  tights?: ClothTone;
  shoe: [ClothTone, ClothTone];
  back?: string;
  gearTone: ClothTone;
  front: string[];
  itemTone: ClothTone;
  expr: string;
  build: Build;
  boardWord?: string;
  boardKeys?: Record<string, string>;
}

function baseWear(rng: Rng): Wear {
  return {
    hair: 'short',
    hairTone: rng.pick(NATURAL_HAIR),
    face: [],
    top: 'tee',
    topTone: rng.pick(BRIGHT),
    accTone: rng.pick(BRIGHT),
    sleeves: 'short',
    bottom: 'pants',
    botTone: rng.pick(PANTS),
    shoe: pw(rng, SHOES),
    gearTone: rng.pick(GEAR_TONES),
    hatTone: rng.pick(BRIGHT),
    itemTone: rng.pick(BRIGHT),
    front: [],
    expr: 'neutral',
    build: { width: pw(rng, [[0, 3], [1, 5], [2, 3]] as const), tall: rng.chance(0.4) },
  };
}

function sleevesFor(top: string, rng: Rng): Wear['sleeves'] {
  if (top === 'tee' || top === 'print' || top === 'hawaiian') return rng.chance(0.8) ? 'short' : 'long';
  if (top === 'vest') return 'acc';
  return 'long';
}

function sign(rng: Rng, city: City, card: boolean, student: boolean, name: string): ReturnType<typeof makeSign> {
  const pool = [
    ...(student ? STUDENT_SLOGANS : []),
    ...SLOGANS.any,
    ...(city !== 'any' ? SLOGANS[city] : []),
    ...(city !== 'any' ? SLOGANS[city] : []),
  ];
  const style: SignStyle = {
    text: rng.pick(pool),
    board: pw(rng, BOARDS),
    ink: pw(rng, INKS),
    card,
    torn: rng.chance(0.3),
  };
  return makeSign(style, name);
}

const CITY_ITEM: Readonly<Record<City, string>> = {
  any: 'umbrella',
  london: 'umbrella',
  paris: 'baguette',
  madrid: 'pot',
};

interface Rolled {
  wear: Wear;
  kit: Kit;
  loadout: string;
  sign?: ReturnType<typeof makeSign>;
}

function rollStudent(rng: Rng, city: City, name: string): Rolled {
  const w = baseWear(rng);
  w.hair = pw(rng, [['short', 3], ['bob', 2], ['curly', 2], ['ponytail', 2], ['long', 2], ['afro', 1.5], ['bun', 1.5], ['buzz', 1.5], ['braids', 1], ['pixie', 1], ['spiky', 1], ['dreads', 1]]);
  if (rng.chance(0.15)) w.hairTone = rng.pick(DYED_HAIR);
  w.hat = pw(rng, [[undefined, 6], ['beanie', 2], ['cap', 1], ['capback', 1], ['bucket', 0.7], ['headphones', 0.8]]);
  if (rng.chance(0.3)) w.face.push('glasses');
  if (rng.chance(0.1)) w.face.push('earring');
  w.top = pw(rng, [['tee', 3], ['print', 3], ['stripes', 2], ['hoodie', 3], ['jacket', 1], ['puffer', 1.5], ['track', 1]]);
  w.sleeves = sleevesFor(w.top, rng);
  w.bottom = pw(rng, [['pants', 6], ['shorts', 1.5], ['skirt', 1.5]]);
  if (w.bottom === 'skirt') {
    w.skirtTone = rng.pick(['denim', 'charcoal', 'red', 'mustard', 'forest', 'plum', 'khaki'] as const);
    if (rng.chance(0.5)) w.tights = rng.pick(['black', 'charcoal', 'maroon', 'purple'] as const);
  }
  w.back = pw(rng, [['backpack', 5.5], ['tote', 2], [undefined, 2.5]]);
  w.expr = rng.pick(['neutral', 'neutral', 'happy']);
  const carry: Carry = pw(rng, [['card', 2.6], ['pole', 1.6], ['phone', 2.2], ['none', 2], ['megaphone', 0.6], ['item', 1], ['flag', 0.6]]);
  const idle: Idle =
    carry === 'card' ? 'card' : carry === 'pole' || carry === 'flag' ? 'sign' : carry === 'phone' ? 'phone' : carry === 'megaphone' ? 'megaphone' : carry === 'item' && city === 'madrid' ? 'pot' : rng.chance(0.5) ? 'vape' : 'chant';
  const item = CITY_ITEM[city];
  const kit: Kit = {
    carry: carry === 'item' && item === 'pot' ? 'pot' : carry,
    carryItem: carry === 'item' ? item : undefined,
    attack: 'none',
    idle,
    gait: pw(rng, [['stroll', 7], ['march', 3]]),
    climbs: false,
    molotov: false,
    mood: w.expr,
  };
  return { wear: w, kit, loadout: 'none', sign: carry === 'card' || carry === 'pole' ? sign(rng, city, carry === 'card', true, name) : undefined };
}

function rollWoke(rng: Rng, city: City, name: string): Rolled {
  const w = baseWear(rng);
  w.hair = pw(rng, [['pixie', 3], ['bob', 2.5], ['mohawk', 1.5], ['short', 1.5], ['buzz', 1], ['spiky', 1.5], ['curly', 1.5], ['long', 1.5], ['bun', 1], ['mullet', 1], ['dreads', 1], ['afro', 1], ['ponytail', 1]]);
  w.hairTone = rng.chance(0.9) ? rng.pick(DYED_HAIR) : rng.pick(NATURAL_HAIR);
  if (rng.chance(0.25)) w.hairAlt = rng.pick(DYED_HAIR.filter((t) => t !== w.hairTone));
  if (rng.chance(0.5)) w.face.push('septum');
  if (rng.chance(0.3)) w.face.push('earring');
  if (rng.chance(0.25)) w.face.push('glasses');
  w.hat = pw(rng, [[undefined, 8], ['beret', 1], ['beanie', 1], ['headband', 0.7]]);
  w.top = pw(rng, [['jacket', 4], ['puffer', 1.5], ['hoodie', 1.5], ['print', 1.5], ['stripes', 1], ['tee', 1]]);
  w.topTone = rng.pick(EARTHY);
  w.accTone = rng.pick(BRIGHT);
  w.sleeves = sleevesFor(w.top, rng);
  w.bottom = pw(rng, [['pants', 6], ['skirt', 2], ['shorts', 0.7]]);
  if (w.bottom === 'skirt') {
    w.skirtTone = rng.pick(['plum', 'charcoal', 'forest', 'maroon', 'denim', 'pink'] as const);
    w.tights = rng.pick(['black', 'charcoal', 'purple', 'maroon', 'teal'] as const);
  }
  w.shoe = rng.chance(0.6) ? ['black', 'charcoal'] : w.shoe;
  w.back = pw(rng, [['tote', 4.5], ['backpack', 1.5], [undefined, 4]]);
  w.expr = 'angry';
  const carry: Carry = pw(rng, [['megaphone', 2], ['item', 2], ['pole', 3], ['none', 3], ['flag', 1]]);
  const item = city === 'paris' && rng.chance(0.4) ? 'baguette' : 'umbrella';
  const kit: Kit = {
    carry,
    carryItem: carry === 'item' ? item : carry === 'megaphone' ? 'megaphone' : undefined,
    attack: carry === 'item' || carry === 'megaphone' ? 'swing' : carry === 'pole' ? 'bonk' : 'punch',
    weapon: carry === 'item' ? item : carry === 'megaphone' ? 'megaphone' : undefined,
    idle: carry === 'megaphone' ? 'megaphone' : carry === 'pole' || carry === 'flag' ? 'sign' : 'chant',
    gait: pw(rng, [['march', 6], ['stroll', 4]]),
    climbs: true,
    molotov: false,
    mood: 'angry',
  };
  return { wear: w, kit, loadout: kit.attack === 'punch' ? 'fists' : (kit.weapon ?? 'sign'), sign: carry === 'pole' ? sign(rng, city, false, false, name) : undefined };
}

function rollMob(rng: Rng, city: City, name: string): Rolled {
  const w = baseWear(rng);
  w.hair = pw(rng, [['short', 3], ['buzz', 3], ['mullet', 1.5], ['bald', 1.5], ['curly', 1], ['spiky', 1], ['ponytail', 0.7], ['afro', 0.7]]);
  if (rng.chance(0.4)) w.beard = rng.pick(['stubble', 'full', 'moustache', 'stubble']);
  w.hat = pw(rng, [[undefined, 2.5], ['cap', 3], ['capback', 1.5], ['hood', 2], ['cone', 1], ['headband', 0.8], ['beanie', 1]]);
  w.hatTone = rng.pick(['red', 'charcoal', 'black', 'scarlet', 'white', 'grey', 'maroon', 'sky', 'green'] as const);
  if (rng.chance(0.25)) w.face.push('mask');
  w.top = pw(rng, [['hoodie', 4.5], ['track', 3.5], ['tee', 1], ['puffer', 1]]);
  w.topTone = rng.pick(['grey', 'charcoal', 'red', 'maroon', 'scarlet', 'black', 'grey', 'red', 'green', 'sky', 'white'] as const);
  w.accTone = rng.pick(['white', 'grey', 'red', 'mustard'] as const);
  w.sleeves = sleevesFor(w.top, rng);
  w.botTone = rng.pick(['charcoal', 'grey', 'black', 'denim', 'stonewash', 'red'] as const);
  w.shoe = rng.pick([['white', 'white'], ['black', 'white'], ['white', 'white'], ['red', 'white']] as Array<[ClothTone, ClothTone]>);
  w.back = pw(rng, [[undefined, 8], ['backpack', 1]]);
  w.expr = 'angry';
  const weapon = pw(rng, [['stick', 2.5], ['bat', 2.5], ['bottle', 2], ['pole', 1.5], ['none', 1.5]] as const);
  const kit: Kit = {
    carry: weapon === 'pole' ? 'pole' : weapon === 'none' ? 'none' : 'item',
    carryItem: weapon === 'pole' || weapon === 'none' ? undefined : weapon,
    attack: weapon === 'pole' ? 'bonk' : weapon === 'none' ? 'punch' : 'swing',
    weapon: weapon === 'pole' || weapon === 'none' ? undefined : weapon,
    idle: weapon === 'pole' ? 'sign' : weapon === 'none' ? 'chant' : 'menace',
    gait: pw(rng, [['march', 7], ['stroll', 3]]),
    climbs: true,
    molotov: false,
    mood: 'angry',
  };
  w.itemTone = rng.pick(['red', 'cream', 'tan', 'charcoal', 'metal'] as const);
  return { wear: w, kit, loadout: weapon === 'none' ? 'fists' : weapon === 'pole' ? 'sign' : weapon, sign: weapon === 'pole' ? sign(rng, city, false, false, name) : undefined };
}

function rollViolent(rng: Rng, _city: City): Rolled {
  const w = baseWear(rng);
  w.hair = pw(rng, [['short', 3], ['buzz', 2], ['spiky', 1], ['long', 1], ['ponytail', 1], ['mohawk', 0.5]]);
  w.hairTone = rng.pick(['black', 'darkBrown', 'brown', 'blonde', 'black'] as const);
  w.hat = pw(rng, [['balaclava', 4.5], ['hood', 3.5], ['cap', 1], [undefined, 1]]);
  w.hatTone = rng.chance(0.85) ? 'black' : rng.pick(['charcoal', 'maroon', 'forest'] as const);
  const scarf = w.hat !== 'balaclava' && rng.chance(0.6);
  if (scarf) {
    w.face.push('scarf');
    w.front.push('scarf');
  } else if (w.hat !== 'balaclava' && rng.chance(0.6)) w.face.push('mask');
  if (rng.chance(0.4)) w.face.push('goggles');
  w.top = pw(rng, [['hoodie', 7], ['puffer', 1.5], ['jacket', 1.5]]);
  w.topTone = rng.chance(0.8) ? 'black' : 'charcoal';
  w.accTone = rng.pick(['charcoal', 'grey', 'black', 'red'] as const);
  w.sleeves = 'long';
  w.botTone = rng.pick(['black', 'charcoal', 'black'] as const);
  w.shoe = ['black', 'charcoal'];
  w.back = pw(rng, [['crate', 4], ['backpack', 3], [undefined, 3]]);
  w.gearTone = rng.pick(['black', 'charcoal', 'charcoal', 'maroon', 'forest'] as const);
  w.expr = 'angry';
  const carry = pw(rng, [['molotov', 5], ['shiv', 3], ['none', 2]] as const);
  const kit: Kit = {
    carry: carry === 'none' ? 'none' : 'item',
    carryItem: carry === 'none' ? undefined : carry,
    attack: 'stab',
    weapon: 'shiv',
    idle: carry === 'molotov' ? 'toss' : carry === 'shiv' ? 'menace' : 'chant',
    gait: 'march',
    climbs: true,
    molotov: true,
    mood: 'angry',
  };
  return { wear: w, kit, loadout: 'shiv+molotov' };
}

function rollCrazy(rng: Rng, _city: City): Rolled {
  const w = baseWear(rng);
  w.hair = pw(rng, [['wild', 4], ['combover', 1.5], ['bald', 1.5], ['long', 1], ['curly', 1], ['mullet', 1], ['afro', 0.7], ['spiky', 0.7]]);
  w.hairTone = rng.pick(['grey', 'white', 'ginger', 'brown', 'black', 'platinum', 'grey', 'auburn'] as const);
  if (rng.chance(0.45)) w.beard = rng.pick(['full', 'stubble', 'moustache']);
  w.hat = pw(rng, [['foil', 4], [undefined, 3], ['cap', 0.8], ['bucket', 0.8], ['headphones', 0.6]]);
  w.hatTone = w.hat === 'foil' ? 'foil' : rng.pick(BRIGHT);
  if (rng.chance(0.25)) w.face.push('glasses');
  else if (rng.chance(0.2)) w.face.push('shades');
  w.top = pw(rng, [['hawaiian', 3.5], ['bathrobe', 3], ['tee', 1], ['stripes', 1], ['puffer', 0.8], ['print', 0.7]]);
  w.topTone =
    w.top === 'bathrobe'
      ? rng.pick(['pink', 'sky', 'white', 'maroon', 'lilac', 'teal', 'tan', 'cream'] as const)
      : rng.pick(['teal', 'pink', 'orange', 'lime', 'sky', 'magenta', 'yellow', 'red', 'purple'] as const);
  w.accTone = rng.pick(['yellow', 'white', 'pink', 'lime', 'orange', 'sky', 'red'] as const);
  w.sleeves = w.top === 'bathrobe' ? 'long' : sleevesFor(w.top, rng);
  w.bottom = pw(rng, [['shorts', 4], ['pants', 3]]);
  w.botTone = rng.pick(['khaki', 'denim', 'plum', 'red', 'lime', 'tan', 'grey', 'sky'] as const);
  w.shoe = rng.pick([['lime', 'white'], ['pink', 'white'], ['orange', 'white'], ['brown', 'brown'], ['white', 'white'], ['purple', 'white'], ['yellow', 'white']] as Array<[ClothTone, ClothTone]>);
  w.back = pw(rng, [[undefined, 8], ['tote', 1]]);
  w.expr = 'wide';
  const kit: Kit = {
    carry: 'item',
    carryItem: 'pistol',
    attack: 'pistol',
    weapon: 'pistol',
    idle: 'twitch',
    gait: 'twitch',
    climbs: false,
    molotov: false,
    mood: rng.chance(0.5) ? 'wide' : 'angry',
  };
  return { wear: w, kit, loadout: 'pistol' };
}

function rollCultist(rng: Rng, _city: City, index: number): Rolled {
  const w = baseWear(rng);
  w.hair = pw(rng, [['bald', 3], ['buzz', 2], ['long', 1], ['short', 1]]);
  w.hat = rng.chance(0.7) ? 'cowl' : undefined;
  if (rng.chance(0.8)) w.face.push('paint');
  if (rng.chance(0.25)) w.beard = rng.pick(['full', 'stubble']);
  w.top = 'robe';
  w.topTone = pw(rng, [['cult', 5], ['maroon', 2], ['ochre', 2], ['sack', 2], ['red', 1]] as const);
  w.accTone = rng.pick(['mustard', 'yellow', 'cream', 'mustard'] as const);
  w.sleeves = 'long';
  w.botTone = 'sack';
  w.shoe = ['brown', 'brown'];
  w.expr = 'neutral';
  // Loadouts cycle so every variant set has all three (machete / rifle / bazooka).
  const loadout = (['machete', 'rifle', 'machete', 'bazooka', 'rifle'] as const)[index % 5]!;
  const kit: Kit = {
    carry: loadout === 'machete' ? 'item' : loadout,
    carryItem: loadout === 'machete' ? 'machete' : undefined,
    attack: loadout === 'machete' ? 'swing' : loadout,
    weapon: loadout === 'machete' ? 'machete' : undefined,
    idle: 'cult',
    gait: 'march',
    climbs: false,
    molotov: false,
    mood: 'neutral',
  };
  w.itemTone = rng.pick(['cult', 'sack', 'khaki', 'maroon'] as const);
  return { wear: w, kit, loadout };
}

function rollProphet(rng: Rng, _city: City): Rolled {
  const w = baseWear(rng);
  w.hair = pw(rng, [['wild', 4], ['long', 2], ['bald', 1.5], ['dreads', 1], ['curly', 1]]);
  w.hairTone = rng.pick(['white', 'grey', 'grey', 'platinum', 'black', 'brown', 'ginger'] as const);
  w.beard = rng.chance(0.7) ? 'prophet' : rng.chance(0.5) ? 'full' : undefined;
  w.top = 'plainrobe';
  w.topTone = 'robe';
  w.accTone = rng.pick(['tan', 'brown', 'mustard'] as const);
  w.sleeves = 'long';
  w.botTone = 'robe';
  w.shoe = ['tan', 'brown'];
  w.back = 'board';
  w.boardWord = pw(rng, [['END', 4], ['END!', 2], ['NIGH', 2], ['SOON', 1.5], ['BYE', 1]]);
  w.boardKeys = pw<Record<string, string>>(rng, [[{}, 3], [{ y: 'earth3', c: 'stone2', C: 'stone3', Y: 'stone4', k: 'ink' }, 2], [{ y: 'gray5', c: 'gray6', C: 'white', Y: 'white', k: 'crim1' }, 1.5]]);
  w.expr = 'shout';
  const kit: Kit = { carry: 'none', attack: 'none', idle: 'preach', gait: rng.chance(0.5) ? 'march' : 'stroll', climbs: false, molotov: false, special: 'prophet', mood: 'shout' };
  return { wear: w, kit, loadout: 'explode' };
}

function rollBreta(rng: Rng): Rolled {
  const w = baseWear(rng);
  w.hair = 'braids';
  w.hairTone = 'brown';
  w.top = 'raincoat';
  w.topTone = 'yellow';
  w.accTone = 'green';
  w.sleeves = 'long';
  w.botTone = 'denim';
  w.shoe = ['brown', 'brown'];
  w.front = ['leaf'];
  w.expr = 'scowl';
  w.build = { width: 0, tall: false, tiny: true };
  const kit: Kit = { carry: 'card', attack: 'none', idle: 'wag', gait: 'stomp', climbs: false, molotov: false, special: 'breta', mood: 'scowl' };
  const s = makeSign({ text: ['HOW', 'DARE', 'YOU'], board: CLOTH.cardboard, ink: 'ink', card: true, torn: false }, 'breta.sign');
  return { wear: w, kit, loadout: 'aura', sign: s };
}

function rollPaparazzi(rng: Rng): Rolled {
  const w = baseWear(rng);
  w.hair = pw(rng, [['short', 3], ['bald', 2], ['buzz', 2], ['combover', 1], ['ponytail', 1]]);
  if (rng.chance(0.4)) w.beard = 'stubble';
  w.hat = pw(rng, [[undefined, 5], ['capback', 3], ['cap', 1]]);
  w.hatTone = rng.pick(['charcoal', 'red', 'black', 'tan'] as const);
  if (rng.chance(0.35)) w.face.push('shades');
  w.top = 'vest';
  w.topTone = rng.pick(['khaki', 'tan', 'sack', 'charcoal', 'brown'] as const);
  w.accTone = rng.pick(['white', 'sky', 'cream', 'grey', 'black', 'red'] as const);
  w.sleeves = 'acc';
  w.botTone = rng.pick(['denim', 'khaki', 'charcoal', 'black'] as const);
  w.shoe = rng.pick([['brown', 'brown'], ['white', 'white'], ['black', 'charcoal']] as Array<[ClothTone, ClothTone]>);
  w.front = ['strap'];
  w.expr = 'happy';
  const kit: Kit = { carry: 'camera', attack: 'strap', idle: 'flash', gait: 'shuffle', climbs: false, molotov: false, special: 'paparazzi', mood: 'happy' };
  return { wear: w, kit, loadout: 'strap+flash' };
}

/** Build the final Look (tones resolved). */
function toLook(w: Wear, skinTone: Tone, s?: ReturnType<typeof makeSign>): Look {
  const top = cl(w.topTone);
  const acc = cl(w.accTone);
  const skin = skinTone;
  const sk = skinCloth(skin);
  const bot = w.bottom === 'skirt' ? (w.tights ? cl(w.tights) : sk) : cl(w.botTone);
  const shin = w.bottom === 'pants' ? cl(w.botTone) : w.tights ? cl(w.tights) : sk;
  const sleeve = w.sleeves === 'bare' ? sk : w.sleeves === 'acc' ? acc : top;
  const fore = w.sleeves === 'long' ? top : w.sleeves === 'acc' ? (w.top === 'vest' ? acc : sk) : sk;
  const tones: Record<string, Tone> = {
    skin,
    hair: HAIR[w.hairTone],
    top,
    acc,
    sleeve,
    fore,
    bot: w.bottom === 'shorts' ? cl(w.botTone) : bot,
    shin,
    shoe: cl(w.shoe[0]),
    sole: cl(w.shoe[1]),
    hat: cl(w.hatTone),
    gear: cl(w.gearTone),
    item: cl(w.itemTone),
    skirt: w.skirtTone ? cl(w.skirtTone) : top,
  };
  return {
    build: w.build,
    tones,
    hairAlt: w.hairAlt ? HAIR[w.hairAlt] : undefined,
    hair: w.hair,
    beard: w.beard,
    hat: w.hat,
    face: w.face,
    top: w.top,
    back: w.back,
    front: w.front,
    sign: s,
    board: w.back === 'board' ? makeBoard(w.boardWord, w.boardKeys) : undefined,
    expr: w.expr,
    skirt: w.bottom === 'skirt',
  };
}

export interface RollOptions {
  seed?: number | string;
  city?: City;
}

/** Deterministic variant `index` of `type`. */
export function rollVariant(type: ProtesterType, index: number, opts: RollOptions = {}): Variant {
  const city = opts.city ?? 'any';
  const rng = new Rng(`${opts.seed ?? 'riot'}:${type}:${index}:${city}`);
  const skinTone = SKIN[rng.pick(SKIN_TONES)];
  const name = `prot.${type}.v${index}.sign`;
  let r: Rolled;
  switch (type) {
    case 'student':
      r = rollStudent(rng, city, name);
      break;
    case 'woke':
      r = rollWoke(rng, city, name);
      break;
    case 'mob':
      r = rollMob(rng, city, name);
      break;
    case 'violent':
      r = rollViolent(rng, city);
      break;
    case 'crazy':
      r = rollCrazy(rng, city);
      break;
    case 'cultist':
      r = rollCultist(rng, city, index);
      break;
    case 'prophet':
      r = rollProphet(rng, city);
      break;
    case 'breta':
      r = rollBreta(rng);
      break;
    case 'paparazzi':
      r = rollPaparazzi(rng);
      break;
  }
  const skin = type === 'breta' ? SKIN.skin5 : skinTone;
  return { type, index, look: toLook(r.wear, skin, r.sign), kit: r.kit, loadout: r.loadout };
}

export type { Attack, Gait, Idle };
