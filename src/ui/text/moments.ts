/**
 * Copy for the run's big moments: level-up blurbs (the Minister comments on each new tool —
 * escalating absurdity), wave banner sub-lines, Capitol damage alerts per state, newspaper
 * closing lines. Limits in tests/ui-text.test.ts.
 */
import type { AdvisorMood } from '../widgets/advisor';

export interface Blurb {
  text: string;
  mood: AdvisorMood;
}

/** Minister's comment after the level-up dossier, L1–L10 (index = level). */
export const LEVEL_BLURBS: Readonly<Record<number, Blurb>> = {
  1: { text: 'Snipers approved. Rubber bullets. Rubber budget, too.', mood: 'smug' },
  2: {
    text: 'Blockades approved. Across a narrow street, concrete always wins the debate.',
    mood: 'idle',
  },
  3: {
    text: 'Tear gas: approved by a committee that does not exist. Fire from behind.',
    mood: 'smug',
  },
  4: { text: 'Horses approved. They outrank you now. Do not look them in the eye.', mood: 'idle' },
  5: {
    text: 'Real guns. Approved retroactively, by a form that approves itself.',
    mood: 'sweat',
  },
  6: { text: 'Soldiers. Defence lent them to us. Defence does not know yet.', mood: 'sweat' },
  7: {
    text: 'A Humvee. Approved during a meeting about parking. It was a long meeting.',
    mood: 'smug',
  },
  8: {
    text: 'Sniper Brigade approved. Their union demanded a roof each. We said share.',
    mood: 'idle',
  },
  9: { text: 'A tank. The form said "proportionate". Someone crossed it out. Me.', mood: 'smug' },
  10: {
    text: 'A helicopter. Cannot die, so earns no Legitimacy. Like a minister, but louder.',
    mood: 'smug',
  },
};

/** Small line under the "WAVE n INCOMING" banner (picked per wave). ≤ 40 chars. */
export const WAVE_LINES: readonly string[] = [
  'They brought snacks.',
  'Now with more megaphones.',
  'Some of them made new signs.',
  'Someone is livestreaming this.',
  'They have a drum. Of course they do.',
  'Ministry estimate: a few. Police: lots.',
  'Fewer than last time. (Source: us.)',
  'Banners spelled correctly this time.',
  'Their aunts have joined the group chat.',
  'Reports of a guitar. God help us.',
  'Spontaneous. Organised for weeks.',
  'Peaceful, until further notice.',
];

/** First wave gets its own line. */
export const FIRST_WAVE_LINE = 'Here they come. Smile for the cameras.';

export function waveLine(wave: number): string {
  if (wave <= 1) return FIRST_WAVE_LINE;
  return WAVE_LINES[(wave * 7 + 3) % WAVE_LINES.length]!;
}

export interface CapitolCopy {
  /** Alert title (bold caps). */
  title: string;
  /** Alert line. */
  line: string;
  /** The Minister's reaction (hint, once per profile per state). */
  minister: string;
  mood: AdvisorMood;
}

/** Index = Capitol damage state (1 graffiti … 5 collapsing). */
export const CAPITOL_COPY: Readonly<Record<number, CapitolCopy>> = {
  1: {
    title: 'GRAFFITI ON THE CAPITOL',
    line: 'Mostly spelled correctly. Protesters are at the steps.',
    minister: 'Graffiti on the Capitol! Hold them before they learn to rhyme.',
    mood: 'sweat',
  },
  2: {
    title: 'WINDOWS SMASHED',
    line: 'Glaziers are billing by the hour. Hold the steps!',
    minister: 'They broke the windows. The heating bill was already a scandal.',
    mood: 'sweat',
  },
  3: {
    title: 'THE CAPITOL IS ON FIRE',
    line: 'Fire brigade on strike in solidarity. Of course.',
    minister: 'Fire! It is fine. It is fine. Put more men on the steps. It is fine.',
    mood: 'panic',
  },
  4: {
    title: 'STATUES TOPPLED',
    line: 'Integrity critical. The statues had no comment.',
    minister: 'The statues are down. Those were historic! Well. Historical-ish.',
    mood: 'panic',
  },
  5: {
    title: 'THE CAPITOL IS COLLAPSING',
    line: 'Integrity critical. Last chance to restore order!',
    minister: 'It is collapsing! I have a flight at six. Hold them, please!',
    mood: 'panic',
  },
};

/** Closing line on the end screen. The first is canonical (used half the time). ≤ 38 chars. */
export const VICTORY_CLOSERS: readonly string[] = [
  'You kept order. But at what cost?',
  'Order was kept. The receipt was not.',
  'You restored order. Who restores you?',
  'Peace returned. Nobody asked it to.',
];

export const DEFEAT_CLOSERS: readonly string[] = [
  'You lost order. It cost exactly the same.',
  'Order fell. The invoice did not.',
  'The regime fell. The paperwork stands.',
];

/** Pick a closing line: canonical half of the time. */
export function closingLine(victory: boolean, seed: number): string {
  const list = victory ? VICTORY_CLOSERS : DEFEAT_CLOSERS;
  const s = Math.floor(Math.abs(seed));
  if (s % 2 === 0) return list[0]!;
  return list[1 + (Math.floor(s / 2) % (list.length - 1))]!;
}
