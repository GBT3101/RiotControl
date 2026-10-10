/**
 * STOCKHOLM — city copy (E5). Fields and limits: ../cities.ts. The UI fonts have no å, so
 * the Swedish here avoids it (ä and ö are fine).
 */
import type { CityCopy } from '../cities';

export const stockholm: CityCopy = {
  name: 'Stockholm',
  tagline: 'Riots, but lagom. Then fika.',
  capitol: 'Riksdagshuset',
  victoryDecks: [
    'Ministry hails "lagom response". Riksdag agrees by consensus, after a vote on the vote.',
    'Order restored in Gamla stan. Both sides break for fika at three. Cinnamon buns neutral.',
    'Calm returns. Protesters take a queue number to leave and wait patiently for their turn.',
    'Minister hands out flat-pack medals. Some assembly required. Allen key not included.',
  ],
  defeatDecks: [
    'Protesters dance on the Riksdag. Minister last seen on a "routine" ferry to Finland.',
    'Regime falls by consensus. Everyone agrees it was lagom. Nobody raised their voice.',
    'Crowd takes the Riksdagshuset, then tidies up and recycles the barricades by colour.',
  ],
  welcome: 'Välkommen till Stockholm. Fourteen islands, many bridges. We hold the bridges.',
  flavour: [
    'Fika break. Mandatory. Even riots stop for cinnamon buns. Especially riots.',
    'The protesters asked politely if they may storm us. We said no. They are thinking.',
    'Dark at three p.m. Excellent for us. Bad for their selfies. Morale is mixed.',
    'Someone opened a tin of surströmming on the steps. Evacuate the press room.',
  ],
  masthead: {
    title: 'Dagens Ordning',
    dateline: 'STOCKHOLM · EXTRA · 25 KR',
    motto: '»Ordning och reda«',
  },
  slogans: ['NEJ!', 'LAGOM', 'FIKA!', 'USCH', 'SKAM!', 'HEJ?', 'NEJ{x}'],
};
