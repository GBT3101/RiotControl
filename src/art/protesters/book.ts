/**
 * Part books (M4b): hand-authored key grids with an origin pixel and named anchors.
 *
 *   == head.se 4,9            part `head.se`, origin (attach pixel) at (4, 9) of its grid
 *   @hand 2,5                 optional named anchors (grid coordinates)
 *   ..HHH..                   rows ('.' transparent); blank lines end the block
 *   # comment                 ignored
 *
 * Grid ops used to derive body builds from one drawing (column/row duplication keeps the
 * hand-made clusters intact and shifts origin + anchors consistently).
 */
import { keyGrid, type KeyGrid } from '../lib/grid';
import type { Point } from '../lib/pixels';

export interface PartDef {
  readonly name: string;
  readonly grid: KeyGrid;
  readonly origin: Point;
  readonly anchors: Readonly<Record<string, Point>>;
}

export type Book = ReadonlyMap<string, PartDef>;

export function parseBook(src: string, bookName = 'book'): Map<string, PartDef> {
  const book = new Map<string, PartDef>();
  let cur: { name: string; origin: Point; anchors: Record<string, Point>; rows: string[] } | null =
    null;
  const flush = (): void => {
    if (!cur) return;
    if (!cur.rows.length) throw new Error(`${bookName}: part "${cur.name}" has no rows`);
    if (book.has(cur.name)) throw new Error(`${bookName}: duplicate part "${cur.name}"`);
    book.set(cur.name, {
      name: cur.name,
      grid: keyGrid(cur.rows, `${bookName}:${cur.name}`),
      origin: cur.origin,
      anchors: cur.anchors,
    });
    cur = null;
  };
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) continue;
    if (line === '') {
      if (cur && cur.rows.length) flush();
      continue;
    }
    if (line.startsWith('==')) {
      flush();
      const m = /^==\s*(\S+)\s+(-?\d+),(-?\d+)\s*$/.exec(line);
      if (!m) throw new Error(`${bookName}: bad header "${line}"`);
      cur = { name: m[1]!, origin: { x: +m[2]!, y: +m[3]! }, anchors: {}, rows: [] };
      continue;
    }
    if (line.startsWith('@')) {
      const m = /^@(\S+)\s+(-?\d+),(-?\d+)\s*$/.exec(line);
      if (!m || !cur) throw new Error(`${bookName}: bad anchor "${line}"`);
      cur.anchors[m[1]!] = { x: +m[2]!, y: +m[3]! };
      continue;
    }
    if (!cur) throw new Error(`${bookName}: row outside a part: "${line}"`);
    cur.rows.push(line);
  }
  flush();
  return book;
}

export function partOf(book: Book, name: string): PartDef {
  const p = book.get(name);
  if (!p) throw new Error(`protesters: unknown part "${name}"`);
  return p;
}

/** Duplicate column `x` (the copy lands at x+1). Points with px > x shift right. */
export function dupCol(p: PartDef, x: number): PartDef {
  if (x < 0 || x >= p.grid.w) return p;
  const rows = p.grid.rows.map((r) => r.slice(0, x + 1) + r[x] + r.slice(x + 1));
  const sh = (q: Point): Point => (q.x > x ? { x: q.x + 1, y: q.y } : q);
  return {
    name: p.name,
    grid: keyGrid(rows, p.name),
    origin: sh(p.origin),
    anchors: Object.fromEntries(Object.entries(p.anchors).map(([k, v]) => [k, sh(v)])),
  };
}

/** Duplicate row `y` (the copy lands at y+1). Points with py > y shift down. */
export function dupRow(p: PartDef, y: number): PartDef {
  if (y < 0 || y >= p.grid.h) return p;
  const rows = [...p.grid.rows.slice(0, y + 1), p.grid.rows[y]!, ...p.grid.rows.slice(y + 1)];
  const sh = (q: Point): Point => (q.y > y ? { x: q.x, y: q.y + 1 } : q);
  return {
    name: p.name,
    grid: keyGrid(rows, p.name),
    origin: sh(p.origin),
    anchors: Object.fromEntries(Object.entries(p.anchors).map(([k, v]) => [k, sh(v)])),
  };
}

/** Delete row `y`. Points below it shift up. */
export function delRow(p: PartDef, y: number): PartDef {
  if (y < 0 || y >= p.grid.h || p.grid.h < 2) return p;
  const rows = [...p.grid.rows.slice(0, y), ...p.grid.rows.slice(y + 1)];
  const sh = (q: Point): Point => (q.y > y ? { x: q.x, y: q.y - 1 } : q);
  return {
    name: p.name,
    grid: keyGrid(rows, p.name),
    origin: sh(p.origin),
    anchors: Object.fromEntries(Object.entries(p.anchors).map(([k, v]) => [k, sh(v)])),
  };
}

/**
 * Mirror a part horizontally (origin and anchors follow); `swap` exchanges key letters so
 * lit / shaded edges stay lit from the upper-left after the flip.
 */
export function mirrorPart(p: PartDef, swap: Readonly<Record<string, string>> = {}): PartDef {
  const w = p.grid.w;
  const rows = p.grid.rows.map((r) =>
    [...r]
      .reverse()
      .map((c) => swap[c] ?? c)
      .join(''),
  );
  const mx = (q: Point): Point => ({ x: w - 1 - q.x, y: q.y });
  return {
    name: `${p.name}~`,
    grid: keyGrid(rows, p.name),
    origin: mx(p.origin),
    anchors: Object.fromEntries(Object.entries(p.anchors).map(([k, v]) => [k, mx(v)])),
  };
}

/** Replace key letters (e.g. turn a sleeve into bare skin). */
export function rekey(p: PartDef, map: Readonly<Record<string, string>>): PartDef {
  const rows = p.grid.rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));
  return { ...p, grid: keyGrid(rows, p.name) };
}

/** Keep only rows ≥ y (e.g. hair peeking out below a beanie). */
export function clipAbove(p: PartDef, y: number): PartDef {
  const rows = p.grid.rows.map((r, i) => (i < y ? '.'.repeat(r.length) : r));
  return { ...p, grid: keyGrid(rows, p.name) };
}
