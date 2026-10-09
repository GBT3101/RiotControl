/**
 * Unit portraits — 32×32 busts for deploy cards and the codex (`unit.<id>.portrait`, group
 * `portraits`, static, anchor = bottom-centre). Personality per unit: smug riot cop, nervous
 * rookie sniper, gas-masked weirdo, moustached mounted cop, sweaty armed cop, stoic soldier,
 * cold sniper captain. Vehicles' icons are M4c. Transparent background (the card frames them).
 */
import type { KeyMap } from '../lib/grid';
import type { RampName } from '../palette';
import type { SpriteRegistry } from '../lib/registry';
import { composePose, parseParts } from './kit';
import { PORTRAIT_PARTS } from './portraits.grid';

const BASE_KEYS: KeyMap = {
  o: 'ink',
  '1': 'navy.1',
  '2': 'navy.2',
  '3': 'navy.3',
  '4': 'navy.4',
  y: 'hivis.1',
  Y: 'hivis.2',
  z: 'zinc2',
  v: 'zinc3',
  w: 'sky',
  W: 'white',
  V: 'white',
  a: 'white',
  e: 'ink',
  S: '$skin.1',
  L: '$skin.2',
  s: '$skin.0',
  m: 'earth0',
  t: 'white',
  g: 'ochre2',
};

interface PortraitDef {
  id: string;
  skin: RampName;
  keys?: KeyMap;
  pose: string;
}

const FACE = 'neck ear face nose';

export const PORTRAITS: readonly PortraitDef[] = [
  {
    id: 'riot',
    skin: 'skin5',
    pose: `riot.bust ${FACE} riot.eyes riot.brows riot.mouth riot.helmet`,
  },
  {
    id: 'sniper',
    skin: 'skin6',
    pose: `sniper.bust ${FACE} sniper.eyes sniper.mouth sniper.freckles sniper.helmet !sniper.sweat`,
  },
  {
    id: 'blockade',
    skin: 'skin4',
    pose: '',
  },
  {
    id: 'gas',
    skin: 'skin2',
    keys: { k: 'gray2', K: 'gray3', T: 'teal1', M: 'gray4', N: 'olive2', G: 'green3' },
    pose: `gas.bust ${FACE} gas.mask gas.helmet`,
  },
  {
    id: 'horse',
    skin: 'skin4',
    keys: { M: 'gray1', m: 'ink' },
    pose: `horse.bust ${FACE} horse.eyes horse.moustache horse.helmet`,
  },
  {
    id: 'cop',
    skin: 'skin3',
    keys: { c: 'blue2', C: 'earth3', '2': 'navy.2', '1': 'navy.1' },
    pose: `cop.bust ${FACE} cop.eyes cop.brows cop.mouth cop.cap !cop.sweat`,
  },
  {
    id: 'soldier',
    skin: 'skin2',
    keys: { '1': 'green0', '2': 'olive.0', '3': 'olive.1', '4': 'olive.2', P: 'olive.3', q: 'gray2' },
    pose: `soldier.bust ${FACE} soldier.eyes soldier.mouth soldier.stubble soldier.helmet`,
  },
  {
    id: 'brigade',
    skin: 'skin3',
    keys: {
      '1': 'ink',
      '2': 'gray1',
      '3': 'gray2',
      '4': 'gray3',
      y: 'olive.1',
      Y: 'olive.2',
      P: 'olive.1',
      E: 'earth4',
      f: 'earth3',
    },
    pose: `brigade.bust ${FACE} brigade.mask brigade.scar brigade.hat`,
  },
];

const book = parseParts(PORTRAIT_PARTS, 'portraits');

export function registerPortraits(reg: SpriteRegistry): void {
  for (const p of PORTRAITS) {
    if (!p.pose) continue;
    const frame = composePose(
      book,
      { keys: { ...BASE_KEYS, ...p.keys }, slots: { skin: p.skin } },
      { w: 32, h: 32 },
      p.pose,
      `portrait.${p.id}`,
    );
    reg.add(`unit.${p.id}.portrait`, { group: 'portraits', frames: [frame], fps: 0 });
  }
}
