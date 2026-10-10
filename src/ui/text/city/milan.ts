/**
 * MILAN — city copy (E5). Fields and limits: ../cities.ts.
 */
import type { CityCopy } from '../cities';

export const milan: CityCopy = {
  name: 'Milan',
  tagline: 'Riot by six. Aperitivo at seven.',
  capitol: 'Palazzo Marino',
  victoryDecks: [
    'Ministry hails "proportionate response". Delivered on time and under budget. In Milan.',
    'Order restored on Piazza della Scala. The audience applauds and demands an encore.',
    'Calm in the Galleria. Officers spin on the mosaic bull for luck. Bull unavailable.',
    'Minister celebrates with a risotto. It takes eighteen minutes. He times it.',
  ],
  defeatDecks: [
    'Protesters dance on Palazzo Marino. Minister last seen on a "routine" train to Lugano.',
    "Regime falls during Fashion Week. Coverage limited to the protesters' outfits. Stunning.",
    'Crowd takes Palazzo Marino. Duomo still under repair since 1386. Very relatable.',
  ],
  welcome: 'Benvenuto a Milano. Here even the riots run on time. Please keep up, Minister.',
  flavour: [
    'A pause. In Milan, a pause is a meeting. Bring slides. Wear the good shoes.',
    'The protesters are better dressed than our officers. Morale has suffered.',
    'Someone opened a pop-up shop on the barricade. Sold out in ten minutes.',
    'Fog off the Navigli. Hard to see the crowd. Easy to see their sunglasses.',
  ],
  masthead: {
    title: 'Il Puntuale',
    dateline: 'MILANO · EDIZIONE SPECIALE · 2 €',
    motto: "»Prima il dovere, poi l'aperitivo«",
  },
  slogans: ['UÈ!', 'NO!', 'MA VA', 'SPRITZ', 'CIAO', 'DAI!', 'OH MA'],
};
