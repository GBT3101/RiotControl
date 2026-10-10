/**
 * The Europe campaign (E1): the twelve cities on the Ministry's map, where they are and what
 * the map says about them. A city is *built* (playable, DEPLOY on its card) as soon as its
 * blueprint is registered (`isPlayable`, src/maps); until then its pin is "under construction".
 * Progression rules come later — for now every built city is open.
 */
import { isPlayable, type CityId } from '../maps';

export interface CampaignCity {
  id: CityId;
  /** Display name (pin tag, card title). */
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Level 1 hosts the basic tutorial. */
  level?: number;
  /** Dry one-liner for the "under construction" card (≤ 40 chars). */
  note: string;
}

/** Map order = west → east-ish reading order of the brief (Budapest first: level 1). */
export const CAMPAIGN: readonly CampaignCity[] = [
  {
    id: 'budapest',
    name: 'Budapest',
    country: 'Hungary',
    lat: 47.498,
    lon: 19.04,
    level: 1,
    note: 'Two banks of the Danube, one Ministry.',
  },
  {
    id: 'berlin',
    name: 'Berlin',
    country: 'Germany',
    lat: 52.52,
    lon: 13.405,
    note: 'Punctual trains, punctual riots.',
  },
  {
    id: 'stockholm',
    name: 'Stockholm',
    country: 'Sweden',
    lat: 59.329,
    lon: 18.069,
    note: 'Polite unrest, flat-pack barricades.',
  },
  {
    id: 'vienna',
    name: 'Vienna',
    country: 'Austria',
    lat: 48.208,
    lon: 16.374,
    note: 'Order, but make it a waltz.',
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    lat: 52.368,
    lon: 4.904,
    note: 'Bicycles outnumber the police. Again.',
  },
  {
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    lat: 41.903,
    lon: 12.496,
    note: 'Riots here have a 2,000-year archive.',
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    lat: 41.387,
    lon: 2.169,
    note: 'The park is lovely. The park is a front.',
  },
  {
    id: 'prague',
    name: 'Prague',
    country: 'Czechia',
    lat: 50.076,
    lon: 14.438,
    note: 'Defenestration risk: historic.',
  },
  {
    id: 'milan',
    name: 'Milan',
    country: 'Italy',
    lat: 45.464,
    lon: 9.19,
    note: 'Even the protesters are well dressed.',
  },
  {
    id: 'madrid',
    name: 'Madrid',
    country: 'Spain',
    lat: 40.417,
    lon: -3.704,
    note: 'Siesta suspended until further notice.',
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    lat: 51.507,
    lon: -0.128,
    note: 'Keep calm. Carry a baton.',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    lat: 48.857,
    lon: 2.352,
    note: 'Cobblestones: a renewable resource.',
  },
];

/** The first level (basic tutorial); steered to on a first visit. */
export const FIRST_CITY: CityId = 'budapest';

/** The only city that runs the Minister's briefing (PLAN §8.1): the first level. */
export const TUTORIAL_CITY: CityId = FIRST_CITY;

/** Can this city be played yet (its map is built)? Data-driven: blueprints light pins up. */
export function isBuilt(id: CityId): boolean {
  return isPlayable(id);
}

export function campaignCity(id: CityId): CampaignCity {
  const c = CAMPAIGN.find((k) => k.id === id);
  if (!c) throw new Error(`campaign: unknown city "${id}"`);
  return c;
}

/** Pin label ribbon for a city (Level 1 · Tutorial), if any. */
export function levelRibbon(c: CampaignCity): string | undefined {
  return c.level === 1 ? 'LEVEL 1 · TUTORIAL' : undefined;
}
