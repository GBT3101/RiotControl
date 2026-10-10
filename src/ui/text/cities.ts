/**
 * City copy: postcard tagline, Capitol name, newspaper decks (victory / defeat variants, one is
 * picked per run), the Minister's city-flavoured lines (tutorial welcome, idle quips), the
 * newspaper masthead and the protest-sign slogans. One module per city in city/<city>.ts
 * (city/index.ts lists them, one line per city — docs/E0.md).
 * Limits: tagline ≤ 40, deck ≤ 96 (2 lines under the headline), flavour ≤ 84 (advisor).
 */
import type { CityId } from '../../maps/contract';
import { cityTable, resolveCities, type CityTable } from '../../maps/cityTable';
import * as COPY_MODULES from './city';

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
  /** End-screen newspaper masthead (art/uikit/newspaper.ts; the masthead font has accents). */
  masthead: { title: string; dateline: string; motto: string };
  /**
   * Protest-sign slogans in the local language (art/protesters/sign.ts), ≤ ~17 px wide in the
   * 3×5 sign font: about 5 characters; `{sym}` = a 5×5 symbol (sign.ts SYMBOLS).
   */
  slogans: readonly string[];
}

/** Copy of the cities that have their own (canonical order). */
export const OWN_COPY: CityTable<CityCopy> = cityTable<CityCopy>(COPY_MODULES, 'city copy');

/**
 * Copy per city. A city still being built borrows Madrid's lines under its own name (the
 * completeness test fails until its city/<city>.ts exists).
 */
export const CITY_COPY: Readonly<Record<CityId, CityCopy>> = resolveCities(OWN_COPY, (c) => ({
  ...OWN_COPY.madrid!,
  name: c.charAt(0).toUpperCase() + c.slice(1),
}));

/** Deterministic pick from a list (seeded by anything numeric). */
export function pickVariant<T>(list: readonly T[], seed: number): T {
  const n = list.length;
  const k = ((Math.floor(Math.abs(seed)) % n) + n) % n;
  return list[k]!;
}
