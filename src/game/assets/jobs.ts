/**
 * Art build jobs (pure, DOM-free). The loader runs them in Web Workers (in parallel) or inline;
 * each job generates a slice of the game's art with the art modules' public generators and
 * packs it into its own atlas pages (`packSprites`), so the main thread only uploads textures.
 *
 * Core jobs (city-independent): `units`, `fx` (FX, world markers, cursors, props, decals),
 * `uikit` (fonts, panels, cards … for the HUD), `vehicles`. City jobs (map load): `protesters` (paper-doll sheets for the city, split by type),
 * `buildings` (paintBuilding for the map's buildings, split into depth pieces), `landmarks`
 * (that city's Capitol states + its landmarks only), `terrain` (ground chunks baked to RGBA).
 * Gallery/preview sprites are never built here.
 */
import { buildDecals, getDecal } from '../../art/env/decals';
import { paintBuilding } from '../../art/env/bld/building';
import {
  GROUND_ANCHOR,
  WATER_FRAMES,
  groundCtxAt,
  groundTileFrames,
  isAnimatedGround,
} from '../../art/env/ground';
import { buildProps } from '../../art/env/props';
import { registerFx } from '../../art/fx';
import { CAPITOL_ART, SECONDARY, toPlacements, type OverlayPlacement } from '../../art/landmarks';
import type { DamageState } from '../../art/landmarks/engine/kit';
import { clearRenderCache } from '../../art/landmarks/engine/scene';
import { registerLandmarkFx } from '../../art/landmarks/fx';
import { stepTile } from '../../art/landmarks/steps';
import { packSprites, type PackableDef, type PackedAtlas } from '../../art/lib/atlas';
import type { PixelBuffer, Point } from '../../art/lib/pixels';
import { SpriteRegistry } from '../../art/lib/registry';
import { SHADOW, SHADOW_ALPHA } from '../../art/palette';
import {
  DEFAULT_VARIANTS,
  PROTESTER_TYPES,
  registerVariant,
  rollVariant,
  type ProtesterManifest,
  type ProtesterType,
  type VariantInfo,
} from '../../art/protesters';
import { registerCursors } from '../../art/ui/cursors';
import { registerUiKit } from '../../art/uikit';
import { registerUnits } from '../../art/units';
import { registerVehicles } from '../../art/vehicles';
import {
  GROUNDS,
  LANDMARKS,
  loadMap,
  type CityId,
  type LandmarkId,
  type MapData,
} from '../../maps';
import { footprintAssignment, splitFrames, trimToContent } from '../../view/depth';

// ── Job descriptions ───────────────────────────────────────────────────────────────────

export type ArtJob =
  | { kind: 'units' }
  | { kind: 'fx' }
  | { kind: 'uikit' }
  | { kind: 'vehicles' }
  | {
      kind: 'protesters';
      city: CityId;
      seed: number;
      types: ProtesterType[];
      /** Variant index range per type: [from, to) (clamped to the type's count). */
      from: number;
      to: number;
      /** Total variants per type (default: the art's defaults; lower on mobile). */
      variants?: number;
    }
  | { kind: 'buildings'; city: CityId; mapSeed: number; part: number; parts: number }
  | { kind: 'capitol'; city: CityId; states: number[] }
  | { kind: 'landmarks'; city: CityId; mapSeed: number }
  | { kind: 'terrain'; city: CityId; mapSeed: number; part: number; parts: number };

/** Rough relative cost (progress bar weights / scheduling: longest first). */
export function jobCost(job: ArtJob): number {
  switch (job.kind) {
    case 'units':
      return 2;
    case 'fx':
      return 3;
    case 'uikit':
      return 2;
    case 'vehicles':
      return 15;
    case 'protesters':
      return job.types.length * (Math.max(1, Math.min(job.to, job.variants ?? 28) - job.from) / 12);
    case 'buildings':
      return 4 / job.parts;
    case 'capitol':
      return 1 + job.states.length;
    case 'landmarks':
      return 4;
    case 'terrain':
      return 10 / job.parts;
  }
}

// ── Job outputs ────────────────────────────────────────────────────────────────────────

/** One square depth piece of a split sprite (see view/depth.ts). */
export interface PieceInfo {
  /** Sprite name (frames = the source frames). */
  name: string;
  /** Night light layer piece (same anchor), if any lit pixel falls into it. */
  light?: string;
  /** Footprint-local tile origin of the sub-box and its size. */
  di: number;
  dj: number;
  g: number;
}

export interface BuildingInfo {
  id: number;
  pieces: PieceInfo[];
  shadow?: string;
  roofTopY: number;
  roofStand: { u0: number; v0: number; u1: number; v1: number };
  climbPoints: Array<{ i: number; j: number; face: 'sw' | 'se' | 'ne' | 'nw' }>;
  height: number;
}

export interface LandmarkInfo {
  /** `capitol` or a LandmarkId. */
  id: string;
  /** Damage state for the Capitol (0–4), else 0. */
  state: number;
  pieces: PieceInfo[];
  /** Lights pieces live in `pieces[k].light` (state 0 night mask for the Capitol). */
  shadow?: string;
  overlays: OverlayPlacement[];
  w: number;
  d: number;
  fps: number;
  frames: number;
}

export interface TerrainChunkData {
  ci: number;
  cj: number;
  /** World px of the buffer's top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** RGBA frames (1, or WATER_FRAMES for chunks with animated water). */
  frames: Uint8Array[];
}

export interface JobResult {
  atlas: PackedAtlas | null;
  protesters?: ProtesterManifest;
  buildings?: BuildingInfo[];
  landmarks?: LandmarkInfo[];
  terrain?: TerrainChunkData[];
  /** Milliseconds spent generating (diagnostics). */
  ms: number;
}

/** Transferable buffers of a result (for postMessage). */
export function transfersOf(r: JobResult): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  if (r.atlas) for (const p of r.atlas.pages) out.push(p.data.buffer as ArrayBuffer);
  if (r.terrain)
    for (const c of r.terrain) for (const f of c.frames) out.push(f.buffer as ArrayBuffer);
  return out;
}

// ── Runner ─────────────────────────────────────────────────────────────────────────────

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function runJob(job: ArtJob): JobResult {
  const t0 = now();
  const reg = new SpriteRegistry();
  const r: JobResult = { atlas: null, ms: 0 };
  switch (job.kind) {
    case 'units':
      registerUnits(reg);
      break;
    case 'fx':
      registerFx(reg);
      registerCursors(reg);
      registerPropsAndDecals(reg);
      break;
    case 'uikit':
      registerUiKit(reg);
      break;
    case 'vehicles':
      registerVehicles(reg);
      break;
    case 'protesters':
      r.protesters = buildProtesterRange(reg, job);
      break;
    case 'buildings':
      r.buildings = buildBuildings(reg, loadMap(job.city, job.mapSeed), job.part, job.parts);
      break;
    case 'capitol':
      r.landmarks = buildCapitol(reg, job.city, job.states);
      break;
    case 'landmarks':
      r.landmarks = buildLandmarks(reg, loadMap(job.city, job.mapSeed));
      break;
    case 'terrain':
      r.terrain = buildTerrain(loadMap(job.city, job.mapSeed), job.part, job.parts);
      break;
  }
  const defs = reg.list() as PackableDef[];
  r.atlas = defs.length > 0 ? packSprites(defs) : null;
  r.ms = now() - t0;
  return r;
}

function registerPropsAndDecals(reg: SpriteRegistry): void {
  for (const p of buildProps()) {
    reg.add(p.name, {
      group: 'props',
      frames: p.sprite.frames,
      fps: p.sprite.fps ?? 0,
      anchor: p.sprite.anchor,
      hasShadow: true,
    });
    if (p.sprite.light) {
      reg.add(`${p.name}.light`, {
        group: 'props',
        frames: p.sprite.light,
        anchor: p.sprite.anchor,
      });
    }
  }
  for (const d of buildDecals()) {
    reg.add(d.name, { group: 'decals', frames: d.sprite.img, anchor: d.sprite.anchor });
  }
}

// ── Split sprites into depth pieces ────────────────────────────────────────────────────

/** Front-strip assignment height (see view/depth.ts: any H ≥ the sprite works; ∞ = front strips). */
const H_FRONT = 1e6;

function registerPieces(
  reg: SpriteRegistry,
  prefix: string,
  frames: readonly PixelBuffer[],
  anchor: Point,
  w: number,
  d: number,
  fps: number,
  lights: readonly PixelBuffer[] | null,
  group: string,
): PieceInfo[] {
  const f0 = frames[0]!;
  const as = footprintAssignment(f0.w, f0.h, anchor, w, d, H_FRONT);
  const pieces = splitFrames(frames, anchor, as);
  const lightPieces = lights ? splitFrames(lights, anchor, as) : [];
  const out: PieceInfo[] = [];
  pieces.forEach((p, k) => {
    const name = `${prefix}.${k}`;
    reg.add(name, { group, frames: p.frames, fps, anchor: p.anchor, hasShadow: true });
    const info: PieceInfo = { name, di: p.a * as.g, dj: p.b * as.g, g: as.g };
    const lp = lightPieces.find((q) => q.a === p.a && q.b === p.b);
    if (lp) {
      info.light = `${name}.l`;
      reg.add(info.light, { group, frames: lp.frames, anchor: lp.anchor });
    }
    out.push(info);
  });
  return out;
}

function registerShadow(
  reg: SpriteRegistry,
  name: string,
  img: PixelBuffer,
  anchor: Point,
): string | undefined {
  const t = trimToContent([img], anchor);
  if (!t) return undefined;
  reg.add(name, { group: 'shadows', frames: t.frames, anchor: t.anchor, hasShadow: true });
  return name;
}

// ── Buildings ──────────────────────────────────────────────────────────────────────────

function buildBuildings(
  reg: SpriteRegistry,
  map: MapData,
  part: number,
  parts: number,
): BuildingInfo[] {
  const out: BuildingInfo[] = [];
  for (const b of map.buildings) {
    if (b.id % parts !== part) continue;
    const art = paintBuilding(b);
    const prefix = `b.${map.city}.${b.id}`;
    const pieces = registerPieces(
      reg,
      prefix,
      [art.image],
      art.anchor,
      b.w,
      b.d,
      0,
      [art.lights],
      'buildings',
    );
    out.push({
      id: b.id,
      pieces,
      shadow: registerShadow(reg, `${prefix}.sh`, art.shadow, art.shadowAnchor),
      roofTopY: art.roofTopY,
      roofStand: art.roofStand,
      climbPoints: art.climbPoints,
      height: art.height,
    });
  }
  return out;
}

// ── Landmarks ──────────────────────────────────────────────────────────────────────────

function buildCapitol(
  reg: SpriteRegistry,
  city: CityId,
  states: readonly number[],
): LandmarkInfo[] {
  const out: LandmarkInfo[] = [];
  const cap = CAPITOL_ART[city];
  if (states.includes(0)) registerLandmarkFx(reg);
  // The state 0 night mask lights the intact states' windows (broken ones show fire instead).
  let night: PixelBuffer | null = null;
  const wanted = [...states].sort();
  if (wanted.some((s) => s <= 1) && !wanted.includes(0)) wanted.unshift(0);
  for (const st of wanted as DamageState[]) {
    const b = cap.build(st);
    const r = b.scene.render(
      { w: cap.w, d: cap.d, top: cap.top },
      { cacheKey: `capitol.${city}.${st < 4 ? 'intact' : 'ruin'}` },
    );
    if (st === 0) night = r.night;
    if (!states.includes(st)) continue;
    const lights = st <= 1 && night ? [night] : null;
    const pieces = registerPieces(
      reg,
      `lm.cap.${city}.${st}`,
      [r.img],
      r.anchor,
      cap.w,
      cap.d,
      0,
      lights,
      'landmarks',
    );
    let shadow: string | undefined;
    if (st === 0) {
      const sh = b.scene.groundShadow(
        { w: cap.w, d: cap.d, top: 0 },
        SHADOW_ALPHA,
        SHADOW,
        () => true,
      );
      shadow = registerShadow(reg, `lm.cap.${city}.sh`, sh.img, sh.anchor);
    }
    out.push({
      id: 'capitol',
      state: st,
      pieces,
      shadow,
      overlays: toPlacements(b),
      w: cap.w,
      d: cap.d,
      fps: 0,
      frames: 1,
    });
  }
  clearRenderCache();
  return out;
}

function buildLandmarks(reg: SpriteRegistry, map: MapData): LandmarkInfo[] {
  const out: LandmarkInfo[] = [];
  const city = map.city;
  const ids = [...new Set(map.landmarks.map((l) => l.id))] as LandmarkId[];
  for (const id of ids) {
    const art = SECONDARY[id];
    const def = LANDMARKS[id];
    if (!art) continue;
    const cv = {
      w: def.w,
      d: def.d,
      top: art.top,
      left: 2 + (art.side ?? 0),
      right: 2 + (art.side ?? 0),
    };
    const frames: PixelBuffer[] = [];
    let first: ReturnType<typeof art.build> | null = null;
    let nightImg: PixelBuffer | null = null;
    let anchor: Point = { x: 0, y: 0 };
    for (let f = 0; f < art.frames; f++) {
      const b = art.build(f);
      const r = b.scene.render(cv, {
        cacheKey: art.frames > 1 && id !== 'londonEye' ? `lm.${id}` : undefined,
      });
      frames.push(r.img);
      if (f === 0) {
        first = b;
        nightImg = r.night;
        anchor = r.anchor;
      }
    }
    const pieces = registerPieces(
      reg,
      `lm.${city}.${id}`,
      frames,
      anchor,
      def.w,
      def.d,
      art.fps,
      nightImg ? [nightImg] : null,
      'landmarks',
    );
    const sh = first!.scene.groundShadow(cv, SHADOW_ALPHA, SHADOW, () => true);
    out.push({
      id,
      state: 0,
      pieces,
      shadow: registerShadow(reg, `lm.${city}.${id}.sh`, sh.img, sh.anchor),
      overlays: toPlacements(first!),
      w: def.w,
      d: def.d,
      fps: art.fps,
      frames: art.frames,
    });
  }
  clearRenderCache();
  return out;
}

// ── Terrain ────────────────────────────────────────────────────────────────────────────

export const CHUNK = 16;
/** Headroom above a chunk for tiles taller than their diamond (GROUND_ANCHOR.y). */
const TOP_MARGIN = 8;

/** Alpha-over blit (src-over, straight alpha). Opaque pixels copy as 32-bit words. */
function blitOver(
  dst: Uint8Array,
  dw: number,
  dh: number,
  src: PixelBuffer,
  dx: number,
  dy: number,
): void {
  const s = src.data;
  const d32 = new Uint32Array(dst.buffer, dst.byteOffset, dw * dh);
  const s32 = new Uint32Array(s.buffer, s.byteOffset, src.w * src.h);
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dh) continue;
    const srow = y * src.w;
    const drow = ty * dw + dx;
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dw) continue;
      const a = s[(srow + x) * 4 + 3]!;
      if (a === 255) d32[drow + x] = s32[srow + x]!;
      else if (a !== 0) blendPixel(dst, (drow + x) * 4, s, (srow + x) * 4, a);
    }
  }
}

function blendPixel(
  dst: Uint8Array,
  di: number,
  s: Uint8ClampedArray | Uint8Array,
  si: number,
  a: number,
): void {
  const da = dst[di + 3]!;
  const k = a / 255;
  const f = da * (1 - k);
  const oa = a + f;
  dst[di] = Math.round((s[si]! * a + dst[di]! * f) / oa);
  dst[di + 1] = Math.round((s[si + 1]! * a + dst[di + 1]! * f) / oa);
  dst[di + 2] = Math.round((s[si + 2]! * a + dst[di + 2]! * f) / oa);
  dst[di + 3] = Math.round(oa);
}

function hash3(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Ground decals sprinkled into the baked terrain (city flavour, before any riot). */
function sprinkleDecal(map: MapData, i: number, j: number): string | null {
  const g = GROUNDS[map.ground[j * map.w + i]!];
  const h = hash3(i, j, 0xdeca1);
  const r = (h % 1000) / 1000;
  if (g === 'sidewalk' || g === 'plaza' || g === 'cobble') {
    if (r < 0.012)
      return `decal.tag.${['anarchy', 'heart', 'no', 'oi', 'riot', map.city === 'madrid' ? 'mola' : 'non'][h % 6]}`;
    if (r < 0.03) return `decal.litter.${h % 3}`;
    if (r < 0.04) return `decal.leaflets.${h % 2}`;
    if (map.city === 'london' && r < 0.06) return `decal.puddle.${h % 2}`;
  } else if (g === 'asphalt') {
    if (map.city === 'london' && r < 0.02) return `decal.puddle.${h % 2}`;
    if (r < 0.006) return `decal.scorch.${h % 3}`;
  }
  return null;
}

function buildTerrain(map: MapData, part: number, parts: number): TerrainChunkData[] {
  const out: TerrainChunkData[] = [];
  const nu = Math.ceil(map.w / CHUNK);
  const nv = Math.ceil(map.h / CHUNK);
  const steps = stepTile(map.city);
  const decals = new Map<string, { img: PixelBuffer; anchor: Point }>();
  const decal = (name: string): { img: PixelBuffer; anchor: Point } | null => {
    let d = decals.get(name);
    if (!d) {
      try {
        const s = getDecal(name);
        d = { img: s.img, anchor: s.anchor };
      } catch {
        return null;
      }
      decals.set(name, d);
    }
    return d;
  };
  let k = 0;
  for (let cj = 0; cj < nv; cj++) {
    for (let ci = 0; ci < nu; ci++, k++) {
      if (k % parts !== part) continue;
      const i0 = ci * CHUNK;
      const j0 = cj * CHUNK;
      const i1 = Math.min(i0 + CHUNK, map.w);
      const j1 = Math.min(j0 + CHUNK, map.h);
      const minX = (i0 - j1) * 16;
      const maxX = (i1 - j0) * 16;
      const minY = (i0 + j0) * 8 - TOP_MARGIN;
      const maxY = (i1 + j1) * 8;
      const w = maxX - minX;
      const h = maxY - minY;
      let animated = false;
      for (let j = j0; j < j1 && !animated; j++) {
        for (let i = i0; i < i1; i++) {
          if (isAnimatedGround(GROUNDS[map.ground[j * map.w + i]!]!)) {
            animated = true;
            break;
          }
        }
      }
      const nf = animated ? WATER_FRAMES : 1;
      const frames: Uint8Array[] = [];
      for (let f = 0; f < nf; f++) {
        const buf = new Uint8Array(w * h * 4);
        for (let s = i0 + j0; s <= i1 + j1 - 2; s++) {
          for (let i = i0; i < i1; i++) {
            const j = s - i;
            if (j < j0 || j >= j1) continue;
            const ctx = groundCtxAt(map, i, j);
            const tf = groundTileFrames(ctx);
            const img = tf[f % tf.length]!;
            const x = (i - j) * 16 - minX;
            const y = (i + j) * 8 - minY;
            blitOver(buf, w, h, img, x - GROUND_ANCHOR.x, y - GROUND_ANCHOR.y);
            if (ctx.ground === 'steps') blitOver(buf, w, h, steps, x - 16, y);
          }
        }
        // Decals on top of the ground (inside each tile's own area).
        for (let j = j0; j < j1; j++) {
          for (let i = i0; i < i1; i++) {
            const name = sprinkleDecal(map, i, j);
            if (!name) continue;
            const d = decal(name);
            if (!d || d.img.w > 26 || d.img.h > 12) continue;
            const x = (i - j) * 16 - minX;
            const y = (i + j) * 8 + 8 - minY;
            blitOver(buf, w, h, d.img, x - d.anchor.x, y - d.anchor.y);
          }
        }
        frames.push(buf);
      }
      out.push({ ci, cj, x: minX, y: minY, w, h, frames });
    }
  }
  return out;
}

/** Variants [from, to) of each type (pure; same rolls as buildProtesterSheets). */
function buildProtesterRange(
  reg: SpriteRegistry,
  job: Extract<ArtJob, { kind: 'protesters' }>,
): ProtesterManifest {
  const manifest: ProtesterManifest = {
    variants: Object.fromEntries(PROTESTER_TYPES.map((t) => [t, [] as VariantInfo[]])) as Record<
      ProtesterType,
      VariantInfo[]
    >,
    events: {},
    frames: 0,
    pixels: 0,
  };
  for (const type of job.types) {
    const total =
      type === 'breta'
        ? 1
        : Math.min(DEFAULT_VARIANTS[type], job.variants ?? DEFAULT_VARIANTS[type]);
    for (let i = job.from; i < Math.min(job.to, total); i++) {
      const v = rollVariant(type, i, { seed: job.seed, city: job.city });
      manifest.variants[type].push(registerVariant(reg, v, { mirrors: 'text' }, manifest));
    }
  }
  return manifest;
}

/** Merge per-type protester manifests from several jobs. */
export function mergeManifests(list: readonly ProtesterManifest[]): ProtesterManifest {
  const out: ProtesterManifest = {
    variants: {} as ProtesterManifest['variants'],
    events: {},
    frames: 0,
    pixels: 0,
  };
  for (const m of list) {
    for (const [t, v] of Object.entries(m.variants)) {
      const key = t as ProtesterType;
      out.variants[key] = [...(out.variants[key] ?? []), ...v];
    }
    Object.assign(out.events, m.events);
    out.frames += m.frames;
    out.pixels += m.pixels;
  }
  return out;
}
