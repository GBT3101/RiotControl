/**
 * Lazy art boot: which jobs to run when, and installing their results into the global `art`.
 *
 * - **critical** (before the first game frame): units, FX/UI/props/decals, the city's terrain,
 *   buildings, landmarks and the protester types that can appear early.
 * - **deferred** (background, after the first frame): vehicles (L7+ units and street decor) and
 *   late protester types (L6+). Views tolerate their absence until they arrive.
 */
import { installPacked, type AtlasPage } from '../../art/lib/atlas';
import type { ProtesterManifest, ProtesterType } from '../../art/protesters';
import type { QualityTier } from '../../data/balance';
import type { CityId } from '../../maps/contract';
import {
  mergeManifests,
  type ArtJob,
  type BuildingInfo,
  type JobResult,
  type LandmarkInfo,
  type TerrainChunkData,
} from './jobs';
import type { ArtLoader, ProgressFn } from './loader';

export interface CityArtOptions {
  city: CityId;
  mapSeed: number;
  seed: number;
  quality: QualityTier;
}

/** Protester types that can appear before level 6 (built before the first frame). */
const EARLY: ProtesterType[][] = [['student', 'breta'], ['woke'], ['mob'], ['violent', 'paparazzi']];
const LATE: ProtesterType[][] = [['crazy'], ['cultist'], ['prophet']];
/** Variants per type built before the first frame (the rest stream in afterwards). */
const FIRST_VARIANTS = 8;

function variantsFor(q: QualityTier): number | undefined {
  return q === 'desktop' ? undefined : q === 'mobile' ? 12 : 8;
}

function prot(o: CityArtOptions, types: ProtesterType[], from: number, to: number): ArtJob {
  return { kind: 'protesters', city: o.city, seed: o.seed, types, from, to, variants: variantsFor(o.quality) };
}

export function criticalJobs(o: CityArtOptions): ArtJob[] {
  const jobs: ArtJob[] = [
    { kind: 'units' },
    { kind: 'fxui' },
    ...EARLY.map((t) => prot(o, t, 0, FIRST_VARIANTS)),
    { kind: 'capitol', city: o.city, states: [0] },
    { kind: 'landmarks', city: o.city, mapSeed: o.mapSeed },
  ];
  for (let p = 0; p < 3; p++) jobs.push({ kind: 'buildings', city: o.city, mapSeed: o.mapSeed, part: p, parts: 3 });
  for (let p = 0; p < 5; p++) jobs.push({ kind: 'terrain', city: o.city, mapSeed: o.mapSeed, part: p, parts: 5 });
  return jobs;
}

export function deferredJobs(o: CityArtOptions): ArtJob[] {
  return [
    { kind: 'vehicles' },
    { kind: 'capitol', city: o.city, states: [1, 2] },
    { kind: 'capitol', city: o.city, states: [3, 4] },
    ...EARLY.map((t) => prot(o, t, FIRST_VARIANTS, 99)),
    ...LATE.map((t) => prot(o, t, 0, 99)),
  ];
}

/** Everything the world view needs from the city's art jobs. */
export interface CityArt {
  manifest: ProtesterManifest;
  buildings: Map<number, BuildingInfo>;
  landmarks: LandmarkInfo[];
  terrain: TerrainChunkData[];
  pages: AtlasPage[];
}

export function emptyCityArt(): CityArt {
  return {
    manifest: mergeManifests([]),
    buildings: new Map(),
    landmarks: [],
    terrain: [],
    pages: [],
  };
}

/** Install job results into the global atlas and fold their data into `into`. */
export function installResults(results: readonly JobResult[], into: CityArt): void {
  const manifests: ProtesterManifest[] = [into.manifest];
  for (const r of results) {
    if (r.atlas) into.pages.push(...installPacked(r.atlas));
    if (r.protesters) manifests.push(r.protesters);
    if (r.buildings) for (const b of r.buildings) into.buildings.set(b.id, b);
    if (r.landmarks) into.landmarks.push(...r.landmarks);
    if (r.terrain) into.terrain.push(...r.terrain);
  }
  into.manifest = mergeManifests(manifests);
}

/** Run + install a batch. */
export async function loadBatch(
  loader: ArtLoader,
  jobs: readonly ArtJob[],
  into: CityArt,
  onProgress?: ProgressFn,
): Promise<void> {
  const results = await loader.run(jobs, onProgress);
  installResults(results, into);
}
