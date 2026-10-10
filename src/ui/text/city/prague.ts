/**
 * PRAGUE — city copy (E5). Fields and limits: ../cities.ts. The UI fonts have no háček
 * letters (č ř š ž ě ů), so the Czech here sticks to words without them.
 */
import type { CityCopy } from '../cities';

export const prague: CityCopy = {
  name: 'Prague',
  tagline: 'Pivo first. Revolution after. Ahoj!',
  capitol: 'Prague Castle',
  victoryDecks: [
    'Ministry hails "proportionate response". Astronomical clock confirms: still 1410.',
    'Order restored on Charles Bridge. Tourists did not notice. The statues did, said nothing.',
    'Castle secured. Minister poses at a window. Advisers gently pull him back inside.',
    'Calm returns. Beer prices unchanged, which locals call the real victory.',
  ],
  defeatDecks: [
    'Protesters dance in the Castle. Minister leaves by the door, for once. Historians stunned.',
    'Regime falls. Crowd celebrates with pivo, then politely asks for the bill. Twice.',
    "Castle taken. The clock's skeleton rings its bell. Nobody is sure for whom.",
  ],
  welcome: 'Vítejte, Minister. Prague: a hundred spires and a long tradition of exits by window.',
  flavour: [
    'A pause. Locals spend it in a pub, guarding a beer. Our officers call it training.',
    'The protesters threw a dumpling. Bread dumpling. It bounced. Engineering marvel.',
    'Note to staff: in Prague, all meetings are held on the ground floor. For reasons.',
    'The clock says it is 1410. The Ministry agrees. Progress is overrated.',
  ],
  masthead: {
    title: 'Klidné Listy',
    dateline: 'PRAHA · NOVÉ VYDÁNÍ · 20 KORUN',
    motto: '»Klid, prosím«',
  },
  slogans: ['NE!', 'DOST!', 'HANBA', 'FUJ!', 'PIVO?', 'NE NE', 'AHOJ'],
};
