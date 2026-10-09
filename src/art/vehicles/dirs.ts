/**
 * Vehicle facings (screen compass). Tile-axis mapping: +i = SE, −i = NW, +j = SW, −j = NE;
 * so E = +i −j, S = +i +j, W = −i +j, N = −i −j.
 *
 * Yaw (degrees, see render3d.ts): forward = (cos, sin) in tile (i, j) space.
 */
export const DIR8 = ['se', 's', 'sw', 'w', 'nw', 'n', 'ne', 'e'] as const;
export type Dir8 = (typeof DIR8)[number];

/** 16-point compass for the tank turret (22.5° steps, starting at SE, clockwise on screen). */
export const DIR16 = [
  'se',
  'sse',
  's',
  'ssw',
  'sw',
  'wsw',
  'w',
  'wnw',
  'nw',
  'nnw',
  'n',
  'nne',
  'ne',
  'ene',
  'e',
  'ese',
] as const;
export type Dir16 = (typeof DIR16)[number];

/** Decor vehicles drive along the tile axes only. */
export const DIR4 = ['se', 'sw', 'nw', 'ne'] as const;
export type Dir4 = (typeof DIR4)[number];

export function yaw8(d: Dir8): number {
  return DIR8.indexOf(d) * 45;
}
export function yaw16(d: Dir16): number {
  return DIR16.indexOf(d) * 22.5;
}

/** Unit tile-space (Δi, Δj) step of a facing — handy for movement code. */
export function dirToTile(d: Dir8 | Dir16): { di: number; dj: number } {
  const y = (DIR16.indexOf(d as Dir16) * 22.5 * Math.PI) / 180;
  return { di: Math.cos(y), dj: Math.sin(y) };
}

/** Nearest 8-way facing for a tile-space movement vector (Δi, Δj). */
export function facing8(di: number, dj: number): Dir8 {
  const a = (Math.atan2(dj, di) * 180) / Math.PI;
  const k = (((Math.round(a / 45) % 8) + 8) % 8) as number;
  return DIR8[k]!;
}

/** Nearest 16-way facing for a tile-space vector (turret aiming). */
export function facing16(di: number, dj: number): Dir16 {
  const a = (Math.atan2(dj, di) * 180) / Math.PI;
  const k = (((Math.round(a / 22.5) % 16) + 16) % 16) as number;
  return DIR16[k]!;
}
