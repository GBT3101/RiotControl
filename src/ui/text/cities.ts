/**
 * City copy: postcard tagline, Capitol name, newspaper decks (victory / defeat variants, one is
 * picked per run), and the Minister's city-flavoured lines (tutorial welcome, idle quips).
 * Limits: tagline ≤ 40, deck ≤ 96 (2 lines under the headline), flavour ≤ 84 (advisor).
 */
import type { CityId } from '../../maps/contract';

export interface CityCopy {
  name: string;
  /** Postcard tagline. */
  tagline: string;
  /** Capitol name (dossier). */
  capitol: string;
  /** Newspaper masthead decks (sub-headlines). The first one is the classic. */
  victoryDecks: readonly string[];
  defeatDecks: readonly string[];
  /** Tutorial welcome (advisor). */
  welcome: string;
  /** Minister's city-flavoured idle lines (breathers). */
  flavour: readonly string[];
}

export const CITY_COPY: Record<CityId, CityCopy> = {
  madrid: {
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
  },
  london: {
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
  },
  paris: {
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
  },
};

/** Deterministic pick from a list (seeded by anything numeric). */
export function pickVariant<T>(list: readonly T[], seed: number): T {
  const n = list.length;
  const k = ((Math.floor(Math.abs(seed)) % n) + n) % n;
  return list[k]!;
}
