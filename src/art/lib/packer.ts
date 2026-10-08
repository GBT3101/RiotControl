/**
 * Shelf rectangle packer (DOM-free). Sorts by height, fills rows ("shelves") left to right,
 * opens new pages when full. Good packing for sprite sets with similar heights, fast, stable.
 */
export interface PackInput {
  w: number;
  h: number;
}

export interface Placement {
  page: number;
  x: number;
  y: number;
}

export interface PackResult {
  placements: Placement[];
  /** Used size of each page (tight bounds, ≤ pageSize). */
  pages: Array<{ w: number; h: number }>;
}

export function packShelves(items: readonly PackInput[], pageSize = 2048, padding = 1): PackResult {
  const order = items
    .map((it, i) => ({ ...it, i }))
    .sort((a, b) => b.h - a.h || b.w - a.w || a.i - b.i);
  const placements: Placement[] = new Array<Placement>(items.length);
  const pages: Array<{ w: number; h: number }> = [];
  let page = -1;
  let shelfY = 0;
  let shelfH = 0;
  let cursorX = 0;

  const newPage = (): void => {
    page++;
    pages.push({ w: 0, h: 0 });
    shelfY = padding;
    shelfH = 0;
    cursorX = padding;
  };
  newPage();

  for (const it of order) {
    const w = it.w + padding;
    const h = it.h + padding;
    if (it.w + padding * 2 > pageSize || it.h + padding * 2 > pageSize) {
      throw new Error(`packShelves: item ${it.w}×${it.h} larger than page ${pageSize}`);
    }
    if (cursorX + w > pageSize) {
      // Next shelf.
      shelfY += shelfH;
      shelfH = 0;
      cursorX = padding;
    }
    if (shelfY + h > pageSize) newPage();
    placements[it.i] = { page, x: cursorX, y: shelfY };
    cursorX += w;
    shelfH = Math.max(shelfH, h);
    const p = pages[page]!;
    p.w = Math.max(p.w, cursorX);
    p.h = Math.max(p.h, shelfY + shelfH);
  }
  return { placements, pages };
}
