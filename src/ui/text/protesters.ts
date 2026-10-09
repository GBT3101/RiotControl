/**
 * Protester codex: one line per type for the "NEW THREAT" / "FIRST SIGHTING" alerts (≤ 64
 * chars, small font, 2 lines in a 200-px alert). Satire of types, never of real groups: the
 * cult is the fictional "Order of the Final Hour"; Breta is a gentle parody.
 */
import type { ProtesterId } from '../../data/protesters';

export interface ThreatCopy {
  /** Codex line (alert body). */
  line: string;
}

export const PROTESTER_COPY: Record<ProtesterId, ThreatCopy> = {
  student: { line: 'Filming everything. Harmless. Statistically. Mostly.' },
  woke: { line: 'Furious, dyed, and climbing your drainpipes. Guard the roofs.' },
  mob: { line: 'Sticks, bottles and traffic cones worn as helmets.' },
  veryViolent: { line: 'Black bloc. Molotovs. Very strong opinions on bins.' },
  crazy: { line: 'Bathrobes, tinfoil hats and, regrettably, real guns.' },
  cultist: { line: 'The Order of the Final Hour. Bazookas aimed at roofs.' },
  prophet: { line: 'They explode on contact. The end is, apparently, nigh.' },
  breta: { line: 'How dare you. Worth +100 Hate. Paparazzi included.' },
  paparazzi: { line: 'Camera flashes blind your officers. Exclusive!' },
};

/** Alert titles for the first sighting of a type (codex hint toasts). */
export const SIGHTING_TITLE = (name: string): string => `FIRST SIGHTING: ${name.toUpperCase()}`;
