/**
 * The Minister's first-run briefing (src/ui/tutorial). Each step says 1–2 advisor lines
 * (≤ 84 chars each: ≤ 3 lines in the desktop bubble). `{choke}` = the suggested chokepoint's
 * street name, `{city}` = city name. Touch / mouse variants where the controls differ.
 */
import type { AdvisorMood } from '../widgets/advisor';

export interface TutorialLine {
  text: string;
  /** Touch-device variant. */
  touch?: string;
  mood: AdvisorMood;
}

export type TutorialStepId =
  'welcome' | 'pan' | 'deploy' | 'hate' | 'wave' | 'legit' | 'sniper' | 'guard' | 'wrap';

export const TUTORIAL_TEXT: Record<TutorialStepId, readonly TutorialLine[]> = {
  welcome: [
    // The city welcome line (CITY_COPY.welcome) is said first.
    { text: 'I am your Minister of the Interior. You are my... interior. Shall we?', mood: 'smug' },
  ],
  pan: [
    {
      text: 'First, the map. Drag to look around, mouse wheel to zoom. Go on, inspect.',
      touch: 'First, the map. Drag a finger to look around, pinch to zoom. Go on.',
      mood: 'idle',
    },
  ],
  deploy: [
    {
      text: 'First post: the Capitol steps. Click Riot Control, then click the steps.',
      touch: 'First post: the Capitol steps. Tap Riot Control, then the steps, twice.',
      mood: 'idle',
    },
  ],
  hate: [
    {
      text: 'This is Hate, our currency. Every death generates Hate. Ours are worth ten.',
      mood: 'smug',
    },
    {
      text: 'Theirs are worth one. We did not set the exchange rate. We just enjoy it.',
      mood: 'smug',
    },
  ],
  wave: [
    {
      text: 'A few more cops on {choke} would be wise. They always come that way.',
      mood: 'idle',
    },
    {
      text: 'Ready? Press LET THEM COME. They were coming anyway. This way we look decisive.',
      mood: 'smug',
    },
  ],
  legit: [
    {
      text: 'An officer has fallen. Tragic. Also: +Legitimacy. See the seal fill up?',
      mood: 'sweat',
    },
    {
      text: "Every fallen officer makes us MORE legitimate. Isn't democracy beautiful?",
      mood: 'smug',
    },
    {
      text: 'Killing protesters pays Hate. Losing officers pays Legitimacy. Budget both.',
      mood: 'idle',
    },
  ],
  sniper: [
    {
      text: 'Level 1! Rubber Snipers approved. Put one on a glowing roof by your cops.',
      mood: 'smug',
    },
  ],
  guard: [
    {
      text: 'Careful: the angry ones climb drainpipes and throw snipers off roofs.',
      mood: 'sweat',
    },
    {
      text: 'A riot cop next to the building guards its roof. Nobody climbs on his watch.',
      mood: 'idle',
    },
  ],
  wrap: [
    {
      text: 'Protect the Capitol. If its integrity hits zero, the regime falls. Mine, mostly.',
      mood: 'sweat',
    },
    {
      text: 'Reach 5000 Legitimacy and order is restored. I will be in my office. Napping.',
      mood: 'smug',
    },
  ],
};

export const TUTORIAL_UI = {
  skip: 'SKIP BRIEFING',
  /** Said when the player skips. */
  skipped: 'Fine. Improvise. That is how we wrote the constitution.',
};

/** Fill `{choke}` / `{city}` placeholders. */
export function fillTutorial(text: string, vars: { choke?: string; city?: string }): string {
  return text
    .replace('{choke}', vars.choke ?? 'the avenue')
    .replace('{city}', vars.city ?? 'the city');
}
