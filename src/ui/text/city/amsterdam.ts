/**
 * AMSTERDAM — city copy (E5). Fields and limits: ../cities.ts.
 */
import type { CityCopy } from '../cities';

export const amsterdam: CityCopy = {
  name: 'Amsterdam',
  tagline: 'Doe normaal. The Ministry insists.',
  capitol: 'Koninklijk Paleis',
  victoryDecks: [
    'Ministry hails "proportionate response". Bikes fished out of the canals: 4,000. Owners: 0.',
    'Order restored on the Dam. Pigeons resume control. Herring stands report brisk trade.',
    'Calm returns. Protesters cycle home in an orderly line. Officers on foot cannot keep up.',
    'Minister celebrates on a canal boat. Low bridge. Hat lost. Dignity mostly intact.',
  ],
  defeatDecks: [
    'Protesters dance on the Dam. Minister last seen pedalling a "routine" bike to Schiphol.',
    'Regime falls. Crowd parks 9,000 bikes outside the Palace. Nobody can get in, or out.',
    'Palace taken. New government meets on a houseboat. It is, admittedly, very gezellig.',
  ],
  welcome: 'Welkom! Amsterdam: canals, gables and bikes. The bikes have right of way. Always.',
  flavour: [
    'A street organ is playing. The officers are swaying. Stop that at once.',
    'The protesters are very direct. They told me my plan is bad. Then offered coffee.',
    'Every barricade here is made of bicycles. Very green. Very hard to climb.',
    'We tried to kettle them. They brought their own kettle. And tea. And stroopwafels.',
  ],
  masthead: {
    title: 'Het Ordeblad',
    dateline: 'AMSTERDAM · EXTRA EDITIE · € 2',
    motto: '»Doe maar gewoon«',
  },
  slogans: ['NEE!', 'HOU OP', 'DOEI!', 'BOEH', 'HÈ?', 'NOU!', 'NEE{x}'],
};
