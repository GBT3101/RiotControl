/**
 * BARCELONA — city copy (E5). Fields and limits: ../cities.ts.
 */
import type { CityCopy } from '../cities';

export const barcelona: CityCopy = {
  name: 'Barcelona',
  tagline: 'Prou! Right after the vermut.',
  capitol: 'Parlament de Catalunya',
  victoryDecks: [
    'Ministry hails "proportionate response". Sagrada Família still unfinished. Unrelated.',
    "Order restored in the Ciutadella. The park's stone mammoth declines to comment.",
    'Calm on the Rambla. Pickpockets report a tough day: everyone was holding a shield.',
    'Minister celebrates with pa amb tomàquet. Rubs the tomato on the wrong side. Scandal.',
  ],
  defeatDecks: [
    'Protesters dance on the Parlament. Minister last seen on a "routine" cruise ship.',
    'Regime falls. Crowd builds a human tower on the Parlament and waves from the top.',
    'Parlament taken. The first new session is held on the beach. Attendance: excellent.',
  ],
  welcome: 'Benvinguts a Barcelona. Sea, sun, Gaudí. Try not to dent any Gaudí, Minister.',
  flavour: [
    'A pause. Locals call it vermut hour. It starts at noon and ends when it ends.',
    'The protesters have built a human tower. Six storeys. Our ladder has four.',
    'Dinner here is at ten p.m. The riot will be served afterwards. Book ahead.',
    'Someone set off a correfoc. Fire, drums, dragons. Apparently it is a festival.',
  ],
  masthead: {
    title: "Diari de l'Ordre",
    dateline: 'BARCELONA · EDICIÓ ESPECIAL · 2 €',
    motto: '»Molt de seny, poca rauxa«',
  },
  slogans: ['PROU!', 'NO!', 'VOLEM', 'QUÈ?', 'APA!', 'BUF', 'VISCA!'],
};
