/**
 * Best results per city (`riot.records.v1`), shown on the city-select postcards. Every known
 * city id has a record (zeros until played); only playable cities can add runs.
 */
import { CITIES, type CityId } from '../maps/contract';
import { browserStorage, readJson, writeJson, type KeyValueStorage } from './storage';

export const RECORDS_KEY = 'riot.records.v1';

export interface CityRecord {
  runs: number;
  wins: number;
  /** Highest Legitimacy reached in any run. */
  bestLegit: number;
  /** Furthest wave reached. */
  bestWave: number;
  /** Fastest victory (sim seconds), 0 = never won. */
  fastestWin: number;
  /** Most protesters fallen in one run. */
  mostFallen: number;
}

export type Records = Record<CityId, CityRecord>;

export interface RunResult {
  city: CityId;
  victory: boolean;
  legit: number;
  wave: number;
  time: number;
  fallen: number;
}

export function emptyRecord(): CityRecord {
  return { runs: 0, wins: 0, bestLegit: 0, bestWave: 0, fastestWin: 0, mostFallen: 0 };
}

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

export function sanitizeRecords(raw: unknown): Records {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as Records;
  for (const c of CITIES) {
    const r = (o[c] && typeof o[c] === 'object' ? o[c] : {}) as Record<string, unknown>;
    out[c] = {
      runs: num(r.runs),
      wins: num(r.wins),
      bestLegit: num(r.bestLegit),
      bestWave: num(r.bestWave),
      fastestWin: num(r.fastestWin),
      mostFallen: num(r.mostFallen),
    };
  }
  return out;
}

/** Fold a finished run into the records (pure). Returns whether it set a new best. */
export function applyRun(rec: Records, run: RunResult): { records: Records; newBest: boolean } {
  const cur = rec[run.city];
  const next: CityRecord = {
    runs: cur.runs + 1,
    wins: cur.wins + (run.victory ? 1 : 0),
    bestLegit: Math.max(cur.bestLegit, Math.floor(run.legit)),
    bestWave: Math.max(cur.bestWave, run.wave),
    fastestWin:
      run.victory && (cur.fastestWin === 0 || run.time < cur.fastestWin)
        ? Math.floor(run.time)
        : cur.fastestWin,
    mostFallen: Math.max(cur.mostFallen, run.fallen),
  };
  const newBest =
    next.bestLegit > cur.bestLegit ||
    next.bestWave > cur.bestWave ||
    next.fastestWin !== cur.fastestWin;
  return { records: { ...rec, [run.city]: next }, newBest };
}

export function loadRecords(storage: KeyValueStorage | null = browserStorage()): Records {
  return sanitizeRecords(readJson(storage, RECORDS_KEY));
}

export function saveRecords(
  rec: Records,
  storage: KeyValueStorage | null = browserStorage(),
): boolean {
  return writeJson(storage, RECORDS_KEY, rec);
}

/** "1:23:45" / "12:05" from seconds. */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 12345 → "12,345". */
export function formatNumber(n: number): string {
  const s = String(Math.floor(Math.abs(n)));
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `-${out}` : out;
}
