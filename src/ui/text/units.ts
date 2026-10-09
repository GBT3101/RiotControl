/**
 * Ministry unit copy: deploy-card tooltip (role + quip), unlock dossier (notes + footnote).
 * Limits (tests/ui-text.test.ts): role ≤ 48 chars, quip ≤ 60, notes ≤ 3 lines × 18 chars
 * (mono, 112-px paper), footnote ≤ 24 chars.
 */
import type { UnitId } from '../../data/units';

export interface UnitCopy {
  /** One-line role for tooltips / the info panel. */
  role: string;
  /** Short satirical one-liner (tooltip, quoted in typewriter). */
  quip: string;
  /** Typewritten dossier notes (unlock card), ≤ 3 short lines. */
  notes: string;
  /** Small-print footnote under the notes. */
  footnote: string;
}

export const UNIT_COPY: Record<UnitId, UnitCopy> = {
  riot: {
    role: 'Road. Shield + baton. Guards nearby roofs.',
    quip: 'Holds the line. Occasionally the line holds him.',
    notes: 'Road posts only.\nShield: -30% melee.\nGuards roofs.',
    footnote: '*helmet sold separately',
  },
  sniper: {
    role: 'Rooftops. Long-range rubber rounds.',
    quip: 'Non-lethal. Mostly. Afraid of drainpipes.',
    notes: 'Rooftops only.\nNon-lethal.*\nRange: 9',
    footnote: '*mostly',
  },
  blockade: {
    role: 'Road. Blocks the march (up to 3 tiles).',
    quip: 'A concrete argument. Literally.',
    notes: 'Spans the road.\nStops crowds.\nDents nicely.',
    footnote: '*graffiti included',
  },
  gas: {
    role: 'Road. Gas cone + grenade ability.',
    quip: 'Tear gas is cheaper than listening. Slightly.',
    notes: 'Gas cone, range 3.\nGrenade every 10s.\nTap when charged.',
    footnote: '*wind not consulted',
  },
  mounted: {
    role: 'Commandable. Fast. Knocks students aside.',
    quip: 'The horse has a pension. The officer does not.',
    notes: 'Commandable.\nFast. Hits hard.\nTap, then a road.',
    footnote: '*horse is unionised',
  },
  armed: {
    role: 'Road. Pistols that pierce a whole queue.',
    quip: 'The first truly proportionate response.',
    notes: 'Lethal rounds.\nPierce 4 in a line.\nRange: 7',
    footnote: '*paperwork pending',
  },
  soldier: {
    role: 'Road. Automatic rifle bursts.',
    quip: 'Borrowed from Defence. Do not tell Defence.',
    notes: 'Burst fire.\nSpray on crowds.\nRange: 8',
    footnote: '*on loan, technically',
  },
  humvee: {
    role: 'Commandable vehicle. Roof machine gun.',
    quip: 'Ten rounds a second of public reassurance.',
    notes: 'Commandable.\nArmoured. Roof MG.\nRange: 8',
    footnote: '*fuel not budgeted',
  },
  brigade: {
    role: 'Rooftops. Three snipers, lethal splash.',
    quip: 'Three professionals, one roof, zero opinions.',
    notes: 'Squad of three.\nLethal + splash.\nRange: 14',
    footnote: '*bazookas hurt',
  },
  tank: {
    role: 'Commandable. Cannon AOE. Crushes. Hits allies.',
    quip: 'Friendly fire is still technically friendly.',
    notes: 'Commandable.\nCannon blast r2.5.\nMind your men.',
    footnote: '*parking not included',
  },
  heli: {
    role: 'Commandable anywhere. Cannot be harmed.',
    quip: 'Invulnerable. Its budget, however, is classified.',
    notes: 'Fly anywhere.\nDoor gun spray.\nCannot be hurt.',
    footnote: '*budget classified',
  },
};
