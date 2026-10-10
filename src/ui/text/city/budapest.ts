/**
 * BUDAPEST — city copy (E5). Fields and limits: ../cities.ts. Budapest is the campaign's first
 * level and hosts the tutorial, so `welcome` opens the Minister's briefing (src/ui/tutorial):
 * the briefing's `{choke}` resolves to the blueprint's chokepoint nearest the Országház steps,
 * "Alkotmány utca" ("More cops on Alkotmány utca, close together.").
 */
import type { CityCopy } from '../cities';

export const budapest: CityCopy = {
  name: 'Budapest',
  tagline: 'Thermal baths closed. Nem, köszönöm!',
  capitol: 'Országház',
  victoryDecks: [
    'Ministry hails "proportionate response". The Parliament dome reports no new cracks.',
    'Calm returns to Kossuth tér. Officers celebrate with lángos. Protesters, with more lángos.',
    'Chain Bridge reopens. Its stone lions, famously tongueless, decline to comment.',
    'Minister takes the waters at the Széchenyi baths. Plays chess against himself. Wins, narrowly.',
  ],
  defeatDecks: [
    'Protesters dance on the Országház. Minister last seen on a "routine" Danube cruise.',
    'Crowd storms Parliament, finds 691 rooms, gets lost in 690. Ministry "regrouping".',
    'Regime falls. Nation orders a pálinka. Historians: "We have seen worse. Often."',
  ],
  welcome: 'Üdvözöljük! Budapest: two cities, one river, one Ministry. Your first posting.',
  flavour: [
    'A lull. Somewhere in Budapest, someone is pouring pálinka. Not for us. Yet.',
    'They chant in Hungarian. Our interpreter fled. I assume it is complimentary.',
    'Buda has the hills, Pest has the Parliament. The crowd has opinions about both.',
    'The Danube is lovely and blue. Officially. Do not check.',
  ],
  masthead: {
    title: 'Pesti Rendelet',
    dateline: 'BUDAPEST · KÜLÖNKIADÁS · 300 Ft',
    motto: '»Rend a lelke mindennek«',
  },
  slogans: ['NEM!', 'ELÉG', 'HAJRÁ', 'JAJ!', 'MIÉRT', 'NA ÉS', 'NYUGI', 'NEM{x}'],
};
