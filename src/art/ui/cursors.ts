/** Tile cursors (hover / tap highlight). Placeholder until the M5 UI kit. */
import { resolveColor } from '../palette';
import { diamondTile, onDiamondEdge } from '../lib/painter';
import type { SpriteRegistry } from '../lib/registry';

function ring(outer: string, inner: string, corners: string) {
  const o = resolveColor(outer);
  const i = resolveColor(inner);
  const k = resolveColor(corners);
  return diamondTile((x, y) => {
    const edge = (['nw', 'ne', 'se', 'sw'] as const).some((e) => onDiamondEdge(x, y, e, 2));
    if (!edge) return null;
    // Brighter "brackets" near the four vertices, dimmer mid-edges.
    const nearVertex = Math.abs(x + 0.5 - 16) > 11 || Math.abs(y + 0.5 - 8) > 5.5;
    if (nearVertex) return k;
    return (x + y) % 2 === 0 ? o : i;
  });
}

export function registerCursors(reg: SpriteRegistry): void {
  const anchor = { x: 16, y: 0 };
  reg.add('ui.cursor.hover', { group: 'ui', frames: ring('stone4', 'stone3', 'white'), anchor });
  reg.add('ui.cursor.tap', {
    group: 'ui',
    frames: [ring('hivis1', 'olive2', 'hivis2'), ring('hivis2', 'hivis1', 'white')],
    fps: 4,
    anchor,
  });
}
