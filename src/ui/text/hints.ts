/**
 * Contextual hint copy (src/ui/hints). Advisor lines ≤ 84 chars; `touch` = touch-device
 * variant. Rules (trigger, channel, priority, staleness) live in src/ui/hints/defs.ts.
 */
import type { AdvisorMood } from '../widgets/advisor';

export interface HintLine {
  text: string;
  touch?: string;
  mood: AdvisorMood;
}

export type HintTextId =
  | 'sniperThrown'
  | 'blockadeBroken'
  | 'lowHate'
  | 'capitolHit'
  | 'gasCharged'
  | 'commandable'
  | 'breta'
  | 'prophets'
  | 'lethal'
  | 'friendlyFire'
  | 'heli'
  | 'almost';

export const HINT_TEXT: Record<HintTextId, HintLine> = {
  sniperThrown: {
    text: 'Our sniper left the roof. Vertically. Guard roofs with Riot Control nearby.',
    mood: 'sweat',
  },
  blockadeBroken: {
    text: 'They broke a blockade. With their hands. Build another. Concrete is cheap.',
    mood: 'sweat',
  },
  lowHate: {
    text: 'We are out of Hate. Be patient. Someone will die soon. Someone always does.',
    mood: 'sweat',
  },
  capitolHit: {
    text: 'They are hitting the Capitol! Everyone who reaches the steps chips at it.',
    mood: 'panic',
  },
  gasCharged: {
    text: 'Gas grenade charged. Click the gas man (or press G) to lob it at the crowd.',
    touch: 'Gas grenade charged. Tap the gas man to lob it at the thickest crowd.',
    mood: 'idle',
  },
  commandable: {
    text: 'This one takes orders. Click him, then click a road to send him there.',
    touch: 'This one takes orders. Tap him, then tap a road to send him there.',
    mood: 'idle',
  },
  breta: {
    text: 'Breta sighted. Worth 100 Hate. Do not make eye contact. She will say it.',
    mood: 'sweat',
  },
  prophets: {
    text: 'Prophets! They explode on contact. Keep tanks and men away. Shoot early.',
    mood: 'panic',
  },
  lethal: {
    text: 'Real bullets now. This is fine. This is policy. I will need more lawyers.',
    mood: 'sweat',
  },
  friendlyFire: {
    text: 'Our tank shelled our own men. Technically friendly. Legitimacy up, so... fine?',
    mood: 'sweat',
  },
  heli: {
    text: 'A helicopter! Nothing can touch it. Select it, then pick any tile. Wheee.',
    mood: 'smug',
  },
  almost: {
    text: 'Almost legitimate... I can smell the medal. Hold on a little longer.',
    mood: 'smug',
  },
};

/** The Minister's idle quips during long breathers (plus the city's flavour lines). */
export const IDLE_QUIPS: readonly string[] = [
  'Quiet. Too quiet. Somebody check whether they unionised.',
  'I have drafted a statement for every outcome. Two of them rhyme.',
  'The press office wants a word. The word is "proportionate".',
  'Brief lull. Perfect time to approve my own expenses.',
  'They are regrouping. So am I. With a biscuit.',
  'I asked for a hotline to the protesters. They put me on hold.',
  'Polls say we are doing great. I wrote the polls, but still.',
  'Somewhere a student is writing a strongly worded zine about us.',
];

/** Title of breather-tip toasts. */
export const MEMO_TITLE = 'MINISTRY MEMO';
