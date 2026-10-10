/**
 * PARIS — city copy (E0: moved verbatim from cities.ts; masthead from
 * art/uikit/newspaper.ts, slogans from art/protesters/sign.ts). Fields and limits: ../cities.ts.
 */
import type { CityCopy } from '../cities';

export const paris: CityCopy = {
  name: 'Paris',
  tagline: 'Merde alors. Again.',
  capitol: 'Assemblée nationale',
  victoryDecks: [
    'Ministry hails "proportionate response". Cafés reopen within the hour.',
    'Order restored. Protesters announce a strike against the end of the strike.',
    'Calm on the Seine. Minister photographed with croissant, looking "legitimate".',
    'Assemblée saved. Philosophers already writing ten books about it.',
  ],
  defeatDecks: [
    'Protesters dance on the Assemblée. Minister last seen boarding a "routine" flight.',
    'Regime falls. Nation shrugs, orders an espresso. "C\'est la vie."',
    'Barricades go up, government comes down. A tradition, say historians.',
  ],
  welcome: 'Bienvenue à Paris. Here protest is a national sport. We are the referee.',
  flavour: [
    'Ah, Paris. They are on strike from the riot. It will not last.',
    'Someone threw a baguette at a horse. Stale, the horse reports. Bof.',
    'Oh là là. Even the pigeons are wearing little berets of defiance.',
    'They have a manifesto, a mime and a megaphone. Formidable. Sort of.',
  ],
  masthead: {
    title: "L'Ordre du Jour",
    dateline: 'PARIS · ÉDITION SPÉCIALE · 2 €',
    motto: '« Liberté, Égalité, Formulaire »',
  },
  slogans: ['NON!', 'MERDE', 'ZUT', 'GREVE', 'BOF', 'NUL', 'NON', 'HELAS', 'NON{x}', 'OUSTE'],
};
