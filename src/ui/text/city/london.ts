/**
 * LONDON — city copy (E0: moved verbatim from cities.ts; masthead from
 * art/uikit/newspaper.ts, slogans from art/protesters/sign.ts). Fields and limits: ../cities.ts.
 */
import type { CityCopy } from '../cities';

export const london: CityCopy = {
  name: 'London',
  tagline: 'Keep calm and kettle on.',
  capitol: 'Palace of Westminster',
  victoryDecks: [
    'Ministry hails "proportionate response". Officials deny everything, including this paper.',
    'Order restored. Tea served. Inquiry scheduled for 2047.',
    'Big Ben strikes on time for once. Minister claims credit.',
    'Crowds disperse in an orderly queue. "Very British," says nobody involved.',
  ],
  defeatDecks: [
    'Protesters dance on Westminster. Big Ben stops, out of sheer embarrassment.',
    'Mob takes Parliament, immediately forms a committee. Nothing changes.',
    'Regime falls. Weather: drizzle. Commuters mildly inconvenienced.',
  ],
  welcome: 'Welcome to London, Minister. Grey sky, grey stone, grey area. Our favourite.',
  flavour: [
    'Lovely weather for a crackdown. By which I mean it is drizzling. Again.',
    'They have formed a queue to riot. I find that oddly reassuring.',
    'Bit of a lull. Fancy a cuppa? No? Suit yourself, guv.',
    'A protester just apologised to a horse. Only in London.',
  ],
  masthead: {
    title: 'The Daily Order',
    dateline: 'LONDON · LATE EXTRA · 50p',
    motto: '"Keep calm and obey"',
  },
  slogans: ['OI!', 'NO!', 'TEA?', 'BAH', 'NAFF', 'SORRY', 'MEH', 'OI OI', 'PANTS', 'CHEEK'],
};
