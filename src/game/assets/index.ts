/**
 * Lazy art boot: which jobs to run when, and installing their results into the global `art`.
 *
 * - **critical** (before the first game frame): units, FX/UI/props/decals, buildings, the
 *   Capitol, landmarks, the ground around the camera start and a few looks of the first-wave
 *   protester types (a run opens in the prep phase — no protesters on screen yet).
 * - **deferred** (background, after the first frame), in two stages: (1) the rest of the
 *   ground and every protester look; (2) vehicles (L7+ units, street decor), the UI kit and
 *   Capitol damage states. Views tolerate their absence until they arrive.
 *
 * `lean: false` (debug skips / scenes / custom camera) puts all ground and 8 looks of every
 * early type into the critical set, since the first frame may be mid-battle anywhere.
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
  /** Smallest critical set (normal play: the run opens at the camera start, prep phase). */
  lean?: boolean;
}

/** Protester types that can appear before level 6 (built before the first frame). */
const EARLY: ProtesterType[][] = [
  ['student', 'breta'],
  ['woke'],
  ['mob'],
  ['violent', 'paparazzi'],
];
const LATE: ProtesterType[][] = [['crazy'], ['cultist'], ['prophet']];
/** Variants per type built before the first frame (the rest stream in afterwards). */
const FIRST_VARIANTS = 8;
/** Lean boot: first-wave types only, a few looks each. */
const LEAN_TYPES: ProtesterType[][] = [['student'], ['woke'], ['mob']];
const LEAN_VARIANTS = 3;

function variantsFor(q: QualityTier): number | undefined {
  return q === 'desktop' ? undefined : q === 'mobile' ? 12 : 8;
}

function prot(o: CityArtOptions, types: ProtesterType[], from: number, to: number): ArtJob {
  return {
    kind: 'protesters',
    city: o.city,
    seed: o.seed,
    types,
    from,
    to,
    variants: variantsFor(o.quality),
  };
}

export function criticalJobs(o: CityArtOptions): ArtJob[] {
  const jobs: ArtJob[] = [
    { kind: 'units' },
    { kind: 'fx' },
    ...(o.lean
      ? LEAN_TYPES.map((t) => prot(o, t, 0, LEAN_VARIANTS))
      : EARLY.map((t) => prot(o, t, 0, FIRST_VARIANTS))),
    { kind: 'capitol', city: o.city, states: [0] },
    { kind: 'landmarks', city: o.city, mapSeed: o.mapSeed },
  ];
  for (let p = 0; p < 3; p++)
    jobs.push({ kind: 'buildings', city: o.city, mapSeed: o.mapSeed, part: p, parts: 3 });
  const tp = o.lean ? 2 : 5;
  for (let p = 0; p < tp; p++) {
    jobs.push({
      kind: 'terrain',
      city: o.city,
      mapSeed: o.mapSeed,
      part: p,
      parts: tp,
      region: o.lean ? 'near' : undefined,
    });
  }
  return jobs;
}

/** Background jobs in stages (each stage is one batch; views refresh after each). */
export function deferredStages(o: CityArtOptions): ArtJob[][] {
  const first: ArtJob[] = [];
  if (o.lean) {
    for (let p = 0; p < 4; p++) {
      first.push({
        kind: 'terrain',
        city: o.city,
        mapSeed: o.mapSeed,
        part: p,
        parts: 4,
        region: 'far',
      });
    }
    first.push(
      ...LEAN_TYPES.map((t) => prot(o, t, LEAN_VARIANTS, 99)),
      prot(o, ['breta'], 0, 99),
      prot(o, ['violent', 'paparazzi'], 0, 99),
    );
  } else first.push(...EARLY.map((t) => prot(o, t, FIRST_VARIANTS, 99)));
  first.push(...LATE.map((t) => prot(o, t, 0, 99)));
  return [
    first,
    [
      { kind: 'vehicles' },
      { kind: 'uikit' },
      { kind: 'capitol', city: o.city, states: [1, 2] },
      { kind: 'capitol', city: o.city, states: [3, 4] },
    ],
  ];
}

export function deferredJobs(o: CityArtOptions): ArtJob[] {
  return deferredStages(o).flat();
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
