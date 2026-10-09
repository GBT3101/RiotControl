/**
 * Static animation metadata for Ministry units — no pixels are built, so the sim / view code can
 * read impact frames, muzzle pixels, fps and anchors cheaply (e.g. to time damage ticks and spawn
 * muzzle-flash / tracer / grenade FX at the right pixel).
 *
 *   const m = unitAnimMeta('unit.soldier.attack.sw');
 *   m.impactFrame          // 1
 *   m.muzzle[3]            // { x, y } in sprite pixels (already mirrored for SW/NW) or null
 *   // world position of the muzzle = entity pos - anchor + muzzle
 */
import type { Point } from '../lib/pixels';
import { BRIGADE, BRIGADE_THROWN } from './brigade';
import { COP } from './cop';
import { GAS } from './gas';
import { HORSE } from './horse';
import type { UnitDef } from './kit';
import { RIOT } from './riot';
import { SNIPER, SNIPER_THROWN } from './sniper';
import { SOLDIER } from './soldier';

export interface UnitAnimMeta {
  readonly name: string;
  readonly unit: string;
  readonly anim: string;
  readonly facing: 'se' | 'sw' | 'ne' | 'nw';
  readonly frames: number;
  readonly fps: number;
  readonly loop: boolean;
  readonly width: number;
  readonly height: number;
  readonly anchor: Point;
  /** Frame on which the hit lands / shot fires / projectile is released (attacks, deploy thuds). */
  readonly impactFrame: number | null;
  /** Per-frame muzzle / release pixel (sprite coords), null where nothing fires. */
  readonly muzzle: readonly (Point | null)[];
  readonly note: string;
}

/** Every character-style unit definition (the blockade is listed separately in the catalog doc). */
export const UNIT_DEFS: readonly UnitDef[] = [
  RIOT,
  SNIPER,
  SNIPER_THROWN,
  GAS,
  HORSE,
  COP,
  SOLDIER,
  BRIGADE,
  BRIGADE_THROWN,
];

function build(): Map<string, UnitAnimMeta> {
  const out = new Map<string, UnitAnimMeta>();
  for (const def of UNIT_DEFS) {
    const { w, h } = def.canvas;
    const anims = [...def.anims];
    for (const a of anims) {
      const facings = a.ne ? (['se', 'ne'] as const) : (['se'] as const);
      for (const f of facings) {
        const poses = f === 'se' ? a.se : a.ne!;
        const muz = (f === 'se' ? a.muzzle?.se : (a.muzzle?.ne ?? a.muzzle?.se)) ?? [];
        const muzzle = poses.map((_, i) => muz[i] ?? null);
        const mirror = f === 'se' ? 'sw' : 'nw';
        const base = {
          unit: def.id,
          anim: a.anim,
          frames: poses.length,
          fps: a.fps,
          loop: a.loop,
          width: w,
          height: h,
          impactFrame: a.impact ?? null,
          note: a.note ?? '',
        };
        out.set(`unit.${def.id}.${a.anim}.${f}`, {
          ...base,
          name: `unit.${def.id}.${a.anim}.${f}`,
          facing: f,
          anchor: def.anchor,
          muzzle,
        });
        out.set(`unit.${def.id}.${a.anim}.${mirror}`, {
          ...base,
          name: `unit.${def.id}.${a.anim}.${mirror}`,
          facing: mirror,
          anchor: { x: w - 1 - def.anchor.x, y: def.anchor.y },
          muzzle: muzzle.map((p) => (p ? { x: w - 1 - p.x, y: p.y } : null)),
        });
      }
    }
    if (def.hitFrom) {
      for (const f of ['se', 'sw', 'ne', 'nw'] as const) {
        const mirrored = f === 'sw' || f === 'nw';
        out.set(`unit.${def.id}.hit.${f}`, {
          name: `unit.${def.id}.hit.${f}`,
          unit: def.id,
          anim: 'hit',
          facing: f,
          frames: 2,
          fps: 12,
          loop: false,
          width: w,
          height: h,
          anchor: mirrored ? { x: w - 1 - def.anchor.x, y: def.anchor.y } : def.anchor,
          impactFrame: null,
          muzzle: [null, null],
          note: 'White flash + 1 px knock-back, then the knocked-back frame.',
        });
      }
    }
  }
  return out;
}

let cache: Map<string, UnitAnimMeta> | null = null;

/** All unit animation metadata, keyed by sprite name (SE/NE + mirrored SW/NW). */
export function unitAnimCatalog(): ReadonlyMap<string, UnitAnimMeta> {
  cache ??= build();
  return cache;
}

export function unitAnimMeta(name: string): UnitAnimMeta {
  const m = unitAnimCatalog().get(name);
  if (!m) throw new Error(`unitAnimMeta: unknown unit animation "${name}"`);
  return m;
}

/**
 * Brigade squad layout: the three snipers of one Sniper Brigade, as pixel offsets from the
 * roof-anchor point (back-left, centre, front-right — draw in this order). Mirror x for SW/NW.
 */
export const BRIGADE_SQUAD_OFFSETS: readonly Point[] = [
  { x: -9, y: -4 },
  { x: 0, y: 0 },
  { x: 9, y: 4 },
];
