/**
 * MADRID — city copy (E0: moved verbatim from cities.ts; masthead from
 * art/uikit/newspaper.ts, slogans from art/protesters/sign.ts). Fields and limits: ../cities.ts.
 */
import type { CityCopy } from '../cities';

export const madrid: CityCopy = {
  name: 'Madrid',
  tagline: 'Siesta is cancelled. ¡No a todo!',
  capitol: 'Congreso de los Diputados',
  victoryDecks: [
    'Ministry hails "proportionate response". Lions on the steps decline to comment.',
    'Calm returns to Sol. Churros stand reports record sales to both sides.',
    'Minister thanks officers, posthumously. Promises a plaque, eventually, mañana.',
    'Order restored by 3 p.m. Ministry takes the rest of the day off. Siesta, obviously.',
  ],
  defeatDecks: [
    'Protesters dance on the Congreso. Minister last seen boarding a "routine" flight.',
    'Bronze lions join the protest. Statement expected after lunch, which ends at six.',
    'Crowd occupies Congreso, orders tapas. Ministry "studying the bill".',
  ],
  welcome: '¡Bienvenido! Madrid. Lovely city. Very loud. We are here to fix the loud part.',
  flavour: [
    'Vale, vale. A quiet breather. Nobody tell the press we had a siesta.',
    'They chant "¡No a todo!". To be fair, so does our tax office.',
    'Someone left a tortilla on the Congreso steps. Bomb squad says: delicious.',
    'In Madrid even the riots start at ten at night. We are ahead of schedule.',
  ],
  masthead: {
    title: 'El Orden',
    dateline: 'MADRID · EDICIÓN ESPECIAL · 2 €',
    motto: '«Todo en orden, nada en duda»',
  },
  slogans: ['¡NO!', 'BASTA', 'OLE', 'VALE', '¡YA!', 'ADIOS', 'NO!', 'FUERA', '¿POR?', 'JOPE'],
};
