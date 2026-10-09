/**
 * Protester sheet builder (M4b): rolls N variants per type and registers every animation
 * for SE / NE (+ mirrored SW / NW) as trimmed sprites.
 *
 *   const reg = new SpriteRegistry();
 *   const manifest = buildProtesterSheets(reg, { city: 'paris', seed: 7 });
 *   const protArt = buildArt(reg, 2048, createArt());          // separate protester atlas
 *   protArt.anim(`prot.woke.v3.walk.se`)
 *
 * Names: `prot.<type>.v<n>.<anim>.<facing>`.
 */
import { createBuffer, crop, type PixelBuffer, type Point } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';
import * as A from './anims';
import { GX, GY, renderFigure, type Facing, type FrameInfo } from './figure';
import { PROTESTER_TYPES, rollVariant, type ProtesterType, type Variant } from './variants';
import type { City } from './sign';

/** Default variants per type (tuned for ≤ 2 atlas pages of 2048², see docs/art/M4b.md). */
export const DEFAULT_VARIANTS: Readonly<Record<ProtesterType, number>> = {
  student: 28,
  woke: 26,
  mob: 26,
  violent: 22,
  crazy: 20,
  cultist: 20,
  prophet: 12,
  breta: 1,
  paparazzi: 8,
};

export function protesterVariantCount(type: ProtesterType): number {
  return DEFAULT_VARIANTS[type];
}

export interface BuildOptions {
  city?: City;
  seed?: number | string;
  /** Override variants per type (a number applies to every type except Breta). */
  variantsPerType?: number | Partial<Record<ProtesterType, number>>;
  /** Restrict to some types. */
  types?: readonly ProtesterType[];
  /** Register mirrored SW / NW copies (default true). */
  mirrors?: boolean;
  /** Gallery group (default 'protesters'). */
  group?: string;
  /** Only build these animations (default all). */
  anims?: readonly string[];
}

export interface AnimEvent {
  /** Frame index of the impact / release / shot. */
  frame: number;
  /** Offset of the hand / muzzle / release point from the sprite anchor (SE / NE as drawn). */
  dx: number;
  dy: number;
}

export interface VariantInfo {
  type: ProtesterType;
  index: number;
  /** Sprite name prefix: `prot.<type>.v<n>`. */
  prefix: string;
  loadout: string;
  gait: string;
  idle: string;
  anims: string[];
}

export interface ProtesterManifest {
  variants: Record<ProtesterType, VariantInfo[]>;
  /** Gameplay events per sprite name (e.g. `prot.cultist.v3.attack.se`). */
  events: Record<string, AnimEvent>;
  frames: number;
  pixels: number;
}

interface AnimDef {
  name: string;
  make: (k: A.Kit, f: Facing) => A.AnimSpec | undefined;
  facings: readonly Facing[];
  /** Register the last frame only (bodies). */
  last?: boolean;
  when?: (v: Variant) => boolean;
}

export const ANIMS: readonly AnimDef[] = [
  { name: 'idle', make: A.idle, facings: ['se', 'ne'] },
  { name: 'walk', make: A.walk, facings: ['se', 'ne'] },
  { name: 'run', make: A.run, facings: ['se', 'ne'] },
  { name: 'attack', make: A.attack, facings: ['se', 'ne'], when: (v) => v.kit.attack !== 'none' },
  { name: 'molotov', make: A.molotov, facings: ['se', 'ne'], when: (v) => v.kit.molotov },
  { name: 'flash', make: A.flash, facings: ['se', 'ne'], when: (v) => v.kit.special === 'paparazzi' },
  { name: 'windup', make: A.windup, facings: ['se', 'ne'], when: (v) => v.kit.special === 'prophet' },
  { name: 'climb', make: A.climb, facings: ['ne'], when: (v) => v.kit.climbs },
  { name: 'heave', make: A.heave, facings: ['se', 'ne'], when: (v) => v.kit.climbs },
  { name: 'hit', make: A.hit, facings: ['se', 'ne'] },
  { name: 'die', make: A.die, facings: ['se', 'ne'] },
  { name: 'ko', make: A.ko, facings: ['se', 'ne'] },
  { name: 'body', make: A.die, facings: ['se'], last: true },
  { name: 'kobody', make: A.ko, facings: ['se'], last: true },
  { name: 'door', make: A.door, facings: ['se'] },
];

const MIRROR: Readonly<Record<Facing, string>> = { se: 'sw', ne: 'nw' };

/** Union-trim frames (same crop for all), returning the anchor of the ground point. */
export function trimFrames(frames: readonly PixelBuffer[]): { frames: PixelBuffer[]; anchor: Point; offset: Point } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (const f of frames) {
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (f.data[(y * f.w + x) * 4 + 3]! === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { frames: frames.map(() => createBuffer(1, 1)), anchor: { x: 0, y: 0 }, offset: { x: 0, y: 0 } };
  // keep the anchor inside the frame
  minX = Math.min(minX, GX);
  maxX = Math.max(maxX, GX);
  minY = Math.min(minY, GY);
  maxY = Math.max(maxY, GY);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return {
    frames: frames.map((f) => crop(f, minX, minY, w, h)),
    anchor: { x: GX - minX, y: GY - minY },
    offset: { x: minX, y: minY },
  };
}

/** Render one animation of a variant (untrimmed work-canvas frames + points). */
export function renderAnim(v: Variant, def: AnimDef, facing: Facing): { spec: A.AnimSpec; frames: FrameInfo[] } | undefined {
  const spec = def.make(v.kit, facing);
  if (!spec) return undefined;
  const poses = def.last ? [spec.poses[spec.poses.length - 1]!] : spec.poses;
  return { spec, frames: poses.map((p) => renderFigure(v.look, facing, p)) };
}

/** Register all sprites of one variant. Returns its info. */
export function registerVariant(
  reg: SpriteRegistry,
  v: Variant,
  opts: { mirrors?: boolean; group?: string; anims?: readonly string[] },
  manifest?: ProtesterManifest,
): VariantInfo {
  const prefix = `prot.${v.type}.v${v.index}`;
  const info: VariantInfo = { type: v.type, index: v.index, prefix, loadout: v.loadout, gait: v.kit.gait, idle: v.kit.idle, anims: [] };
  for (const def of ANIMS) {
    if (def.when && !def.when(v)) continue;
    if (opts.anims && !opts.anims.includes(def.name)) continue;
    for (const facing of def.facings) {
      const r = renderAnim(v, def, facing);
      if (!r) continue;
      const t = trimFrames(r.frames.map((f) => f.buf));
      const name = `${prefix}.${def.name}.${facing}`;
      reg.add(name, {
        group: opts.group ?? 'protesters',
        frames: t.frames,
        fps: def.last ? 0 : r.spec.fps,
        loop: def.last ? false : r.spec.loop,
        anchor: t.anchor,
        hasShadow: true,
        tags: ['protester', v.type],
        mirrorAs: opts.mirrors === false ? undefined : `${prefix}.${def.name}.${MIRROR[facing]}`,
      });
      if (manifest) {
        manifest.frames += t.frames.length * (opts.mirrors === false ? 1 : 2);
        manifest.pixels += t.frames.length * t.frames[0]!.w * t.frames[0]!.h * (opts.mirrors === false ? 1 : 2);
        if (r.spec.keyFrame !== undefined && !def.last) {
          const pt = r.frames[r.spec.keyFrame]!.points[r.spec.keyPoint ?? 'handR'];
          if (pt) manifest.events[name] = { frame: r.spec.keyFrame, dx: pt.x - GX, dy: pt.y - GY };
        }
      }
      if (!info.anims.includes(def.name)) info.anims.push(def.name);
    }
  }
  return info;
}

function countFor(type: ProtesterType, o: BuildOptions): number {
  if (type === 'breta') return 1;
  const v = o.variantsPerType;
  if (typeof v === 'number') return type === 'paparazzi' ? Math.min(v, DEFAULT_VARIANTS.paparazzi) : v;
  return v?.[type] ?? DEFAULT_VARIANTS[type];
}

/** Roll and register every protester variant. Pure and deterministic for given options. */
export function buildProtesterSheets(reg: SpriteRegistry, opts: BuildOptions = {}): ProtesterManifest {
  const manifest: ProtesterManifest = {
    variants: Object.fromEntries(PROTESTER_TYPES.map((t) => [t, [] as VariantInfo[]])) as Record<ProtesterType, VariantInfo[]>,
    events: {},
    frames: 0,
    pixels: 0,
  };
  for (const type of opts.types ?? PROTESTER_TYPES) {
    const n = countFor(type, opts);
    for (let i = 0; i < n; i++) {
      const v = rollVariant(type, i, { seed: opts.seed, city: opts.city });
      manifest.variants[type].push(registerVariant(reg, v, opts, manifest));
    }
  }
  return manifest;
}

export { PROTESTER_TYPES, rollVariant };
export type { ProtesterType, Variant };
