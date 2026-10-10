/**
 * BERLIN — city copy (E5). Fields and limits: ../cities.ts. The fonts have no ß: write "ss".
 */
import type { CityCopy } from '../cities';

export const berlin: CityCopy = {
  name: 'Berlin',
  tagline: 'Ordnung muss sein. Afterwards, techno.',
  capitol: 'Reichstag',
  victoryDecks: [
    'Ministry hails "proportionate response". Dome visitors may resume looking down on MPs.',
    'Order restored. Späti owners report record sales to both sides. Club queue unaffected.',
    'Calm at the Brandenburg Gate. The quadriga keeps facing the other way, as usual.',
    'Minister celebrates at a club. Turned away at the door: "Not tonight." A setback.',
  ],
  defeatDecks: [
    'Protesters dance on the Reichstag. Bass drop heard in Potsdam. Minister "unreachable".',
    'Regime falls. Berlin shrugs: "Rent is still too high." Next protest on Monday.',
    'Crowd opens a club in the Reichstag dome. The queue already reaches the Tiergarten.',
  ],
  welcome: 'Willkommen in Berlin. Everything is allowed, except being late. Let us begin.',
  flavour: [
    'A break. In Berlin, this is when the techno starts. Officers, earplugs in.',
    'Our riot police were refused entry at a club. Not enough black. Fair, honestly.',
    'Protest registered, permit stamped, route approved. Even the riots are punctual.',
    'Someone painted a mural on our water cannon. It is now worth more than the truck.',
  ],
  masthead: {
    title: 'Der Ordner',
    dateline: 'BERLIN · SONDERAUSGABE · 2 €',
    motto: '»Ruhe ist die erste Bürgerpflicht«',
  },
  slogans: ['NEIN!', 'DOCH!', 'ALTER', 'MIETE!', 'ICKE', 'NEE!', 'KIEZ!'],
};
