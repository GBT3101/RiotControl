/**
 * UI copy (EN). M10 moves these into `src/data/strings/` with the rest of the writing; keep the
 * keys stable. Tone (PLAN §1.10): both sides are the joke, never hateful toward real groups.
 */
import type { ProtesterId } from '../data/protesters';
import type { UnitId } from '../data/units';
import type { CityId } from '../maps/contract';

export interface UnitCopy {
  /** One-line role for tooltips / the info panel. */
  role: string;
  /** Short satirical line (tooltip, unlock dossier). */
  quip: string;
  /** Typewritten dossier notes (unlock card), ≤ 3 short lines. */
  notes: string;
  /** Small-print footnote under the notes. */
  footnote: string;
}

export const UNIT_COPY: Record<UnitId, UnitCopy> = {
  riot: {
    role: 'Road. Shield + baton. Guards nearby roofs.',
    quip: 'Holds the line. Occasionally the line holds him.',
    notes: 'Road posts only.\nShield: -30% melee.\nGuards roofs.',
    footnote: '*helmet sold separately',
  },
  sniper: {
    role: 'Rooftops. Long-range rubber rounds.',
    quip: 'Non-lethal. Mostly. Afraid of drainpipes.',
    notes: 'Rooftops only.\nNon-lethal.*\nRange: 9',
    footnote: '*mostly',
  },
  blockade: {
    role: 'Road. Blocks the march (up to 3 tiles).',
    quip: 'A concrete argument. Literally.',
    notes: 'Spans the road.\nStops crowds.\nDents nicely.',
    footnote: '*graffiti included',
  },
  gas: {
    role: 'Road. Gas cone + grenade ability.',
    quip: 'Tear gas is cheaper than listening. Slightly.',
    notes: 'Gas cone, range 3.\nGrenade every 10s.\nTap when charged.',
    footnote: '*wind not consulted',
  },
  mounted: {
    role: 'Commandable. Fast. Knocks students aside.',
    quip: 'The horse has a pension. The officer does not.',
    notes: 'Commandable.\nFast. Hits hard.\nTap, then a road.',
    footnote: '*horse is union',
  },
  armed: {
    role: 'Road. Pistols that pierce a whole queue.',
    quip: 'The first truly proportionate response.',
    notes: 'Lethal rounds.\nPierce 4 in a line.\nRange: 7',
    footnote: '*paperwork pending',
  },
  soldier: {
    role: 'Road. Automatic rifle bursts.',
    quip: 'Borrowed from Defence. Do not tell Defence.',
    notes: 'Burst fire.\nSpray on crowds.\nRange: 8',
    footnote: '*on loan, technically',
  },
  humvee: {
    role: 'Commandable vehicle. Roof machine gun.',
    quip: 'Ten rounds a second of public reassurance.',
    notes: 'Commandable.\nArmoured. Roof MG.\nRange: 8',
    footnote: '*fuel not budgeted',
  },
  brigade: {
    role: 'Rooftops. Three snipers, lethal splash.',
    quip: 'Three professionals sharing one roof and no opinions.',
    notes: 'Squad of three.\nLethal + splash.\nRange: 14',
    footnote: '*bazookas hurt',
  },
  tank: {
    role: 'Commandable. Cannon AOE. Crushes. Hits allies.',
    quip: 'Friendly fire is still technically friendly.',
    notes: 'Commandable.\nCannon blast r2.5.\nMind your men.',
    footnote: '*parking not included',
  },
  heli: {
    role: 'Commandable anywhere. Cannot be harmed.',
    quip: 'Invulnerable. Its budget, however, is classified.',
    notes: 'Fly anywhere.\nDoor gun spray.\nCannot be hurt.',
    footnote: '*budget classified',
  },
};

export interface ThreatCopy {
  /** Toast line under "NEW THREAT: <name>". */
  line: string;
}

export const PROTESTER_COPY: Record<ProtesterId, ThreatCopy> = {
  student: { line: 'Only want to reach the Capitol. Filming everything.' },
  woke: { line: 'Furious, dyed and climbing your drainpipes.' },
  mob: { line: 'Sticks, bottles and traffic-cone helmets.' },
  veryViolent: { line: 'Black bloc. Molotovs. Bring a fire extinguisher.' },
  crazy: { line: 'Tinfoil hats, bathrobes and real guns.' },
  cultist: { line: 'The Order of the Final Hour. Bazookas vs. rooftops.' },
  prophet: { line: 'They explode on contact. The end is, apparently, nigh.' },
  breta: { line: 'How dare you.' },
  paparazzi: { line: 'Flashes blind your officers.' },
};

export interface CityCopy {
  name: string;
  /** Postcard tagline. */
  tagline: string;
  /** Capitol name (dossier). */
  capitol: string;
  /** Victory / defeat newspaper decks. */
  victoryDeck: string;
  defeatDeck: string;
}

export const CITY_COPY: Record<CityId, CityCopy> = {
  madrid: {
    name: 'Madrid',
    tagline: 'Siesta is cancelled. ¡No a todo!',
    capitol: 'Congreso de los Diputados',
    victoryDeck: 'Ministry hails "proportionate response". Lions on the steps decline to comment.',
    defeatDeck: 'Protesters dance on the Congreso. Minister last seen boarding a "routine" flight.',
  },
  london: {
    name: 'London',
    tagline: 'Keep calm and kettle on.',
    capitol: 'Palace of Westminster',
    victoryDeck:
      'Ministry hails "proportionate response". Officials deny everything, including this newspaper.',
    defeatDeck: 'Protesters dance on Westminster. Big Ben stops, out of embarrassment.',
  },
  paris: {
    name: 'Paris',
    tagline: 'Merde alors. Again.',
    capitol: 'Assemblée nationale',
    victoryDeck: 'Ministry hails "proportionate response". Cafés reopen within the hour.',
    defeatDeck:
      'Protesters dance on the Assemblée. Minister last seen boarding a "routine" flight.',
  },
};

export const UI_TEXT = {
  disclaimer: 'A parody. Any resemblance to actual governments is regrettable.',
  letThemCome: 'LET THEM COME',
  callEarly: (n: number) => `CALL EARLY +${n}`,
  levelUp: 'NEW TOOL OF ORDER APPROVED',
  victoryHeadline: 'ORDER RESTORED',
  defeatHeadline: 'THE REGIME HAS FALLEN',
  atWhatCost: 'You kept order. But at what cost?',
  defeatCost: 'You lost order. It cost exactly the same.',
  moveHint: 'TAP A ROAD TO MOVE',
  moveHintMouse: 'CLICK A ROAD TO MOVE',
  confirmHint: 'TAP AGAIN OR ✔ TO DEPLOY',
};

export const CREDITS: ReadonlyArray<[string, string]> = [
  ['DIRECTION', 'The Ministry of the Interior'],
  ['DESIGN & CODE', 'Claude (Opus 5.5) agents'],
  ['PIXEL ART', 'Hand-authored grids, in code'],
  ['MUSIC & SFX', 'Procedural WebAudio'],
  ['ENGINE', 'PixiJS · TypeScript · Vite'],
  ['LEGAL', 'Any resemblance to real events is a coincidence we deeply regret.'],
];
