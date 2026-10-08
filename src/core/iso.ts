/**
 * Isometric (2:1 dimetric) coordinate maths for 32×16 tiles.
 *
 * Spaces:
 * - **tile** (u, v): continuous grid coordinates. Tile (i, j) covers [i, i+1) × [j, j+1).
 *   +u runs screen south-east (down-right), +v runs screen south-west (down-left).
 * - **world** (x, y): unscaled pixel space of the map. World (0, 0) is the *top vertex* of
 *   tile (0, 0). One world pixel = one art pixel.
 * - **screen** (sx, sy): device pixels on the canvas, given a camera (centre + integer zoom).
 *
 * Tile diamonds tessellate exactly: pixel (px, py) belongs to the tile containing its centre
 * (px + .5, py + .5). The diamond has row widths 2, 6, …, 30, 30, …, 6, 2 (see `inTileDiamond`).
 */

export const TILE_W = 32;
export const TILE_H = 16;
export const HALF_TW = TILE_W / 2; // 16
export const HALF_TH = TILE_H / 2; // 8
/** Height of one building storey in world pixels (art bible §3.1). */
export const STOREY_H = 10;

export interface Vec2 {
  x: number;
  y: number;
}

export interface TileCoord {
  u: number;
  v: number;
}

/** Continuous tile coords → world pixel coords. */
export function tileToWorld(u: number, v: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  out.x = (u - v) * HALF_TW;
  out.y = (u + v) * HALF_TH;
  return out;
}

/** World centre of integer tile (i, j). */
export function tileCenterWorld(i: number, j: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  return tileToWorld(i + 0.5, j + 0.5, out);
}

/** World pixel coords → continuous tile coords. */
export function worldToTile(x: number, y: number, out: TileCoord = { u: 0, v: 0 }): TileCoord {
  const a = x / TILE_W; // (u - v) / 2
  const b = y / TILE_H; // (u + v) / 2
  out.u = b + a;
  out.v = b - a;
  return out;
}

/** World pixel coords → integer tile indices (floor). */
export function worldToTileIndex(x: number, y: number): { i: number; j: number } {
  const t = worldToTile(x, y);
  return { i: Math.floor(t.u), j: Math.floor(t.v) };
}

/**
 * Is pixel (px, py) — relative to a 32×16 tile image whose top vertex sits on the boundary
 * between columns 15 and 16 — inside the tile diamond? Exact tessellation, no ties.
 */
export function inTileDiamond(px: number, py: number): boolean {
  const dx = Math.abs(px + 0.5 - HALF_TW);
  const dy = Math.abs(py + 0.5 - HALF_TH);
  return dx / HALF_TW + dy / HALF_TH < 1;
}

/** Camera description used for world↔screen conversion (device pixels). */
export interface CameraView {
  /** World point at the screen centre (already snapped for rendering). */
  x: number;
  y: number;
  /** Device pixels per world pixel. */
  zoom: number;
  /** Viewport size in device pixels. */
  width: number;
  height: number;
}

/** Screen-space origin (device px) of world (0,0) for a camera — integer when zoom is. */
export function cameraOrigin(cam: CameraView, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  out.x = Math.floor(cam.width / 2) - cam.x * cam.zoom;
  out.y = Math.floor(cam.height / 2) - cam.y * cam.zoom;
  return out;
}

export function worldToScreen(
  x: number,
  y: number,
  cam: CameraView,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 {
  const o = cameraOrigin(cam);
  out.x = o.x + x * cam.zoom;
  out.y = o.y + y * cam.zoom;
  return out;
}

export function screenToWorld(
  sx: number,
  sy: number,
  cam: CameraView,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 {
  const o = cameraOrigin(cam);
  out.x = (sx - o.x) / cam.zoom;
  out.y = (sy - o.y) / cam.zoom;
  return out;
}

/**
 * Depth key for painter's ordering of ground-anchored things: larger = drawn later (in front).
 * Primary key is world y of the foot point; ties broken by x so ordering is stable.
 * Safe for |x| < 32768 and world y within ±65535 (maps are ~2300 px tall).
 */
export function depthKey(worldX: number, worldY: number): number {
  return Math.round(worldY) * 65536 + Math.round(worldX) + 32768;
}

/**
 * Depth key for a *square* footprint box (i0, j0, size n). Entities strictly behind the box
 * (u < i0 or v < j0) sort before it; entities in front (u ≥ i0+n or v ≥ j0+n) sort after it.
 * Non-square footprints must be split into square slices (M8).
 */
export function boxDepthKey(i0: number, j0: number, n: number): number {
  // Left (i0, j0+n) and right (i0+n, j0) vertices share world y for square boxes.
  const y = (i0 + j0 + n) * HALF_TH;
  // x component 0 = sorts before any entity standing exactly on the vertex line.
  return Math.round(y) * 65536;
}

/** Axis-aligned world bounds of a w×h tile map (diamond's bounding box). */
export function mapWorldBounds(
  tilesU: number,
  tilesV: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: -tilesV * HALF_TW,
    maxX: tilesU * HALF_TW,
    minY: 0,
    maxY: (tilesU + tilesV) * HALF_TH,
  };
}

/** The 4 iso facings used for character art (SE/NE drawn, SW/NW mirrored). */
export type Facing = 'se' | 'sw' | 'ne' | 'nw';

/** Facing for a movement vector in tile space. */
export function facingFromTileDelta(du: number, dv: number): Facing {
  // Screen delta: x ∝ du - dv, y ∝ du + dv.
  const sx = du - dv;
  const sy = du + dv;
  if (sy >= 0) return sx >= 0 ? 'se' : 'sw';
  return sx >= 0 ? 'ne' : 'nw';
}
