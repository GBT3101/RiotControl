/**
 * Dev sprite gallery: every registered sprite at 1× and 4× (animated), grouped by category,
 * plus the RIOT-64 palette. Query params:
 *   ?group=units        only one group (or 'palette')
 *   ?filter=riot        name substring
 *   ?bg=light           light background
 *   ?scale=6            big-view scale (default 4)
 *   ?frame=0            freeze animations on a frame (deterministic screenshots)
 *   ?anchor             mark anchor pixels
 */
import { createArtRegistry } from '../art';
import { drawBuffer } from '../art/lib/dom';
import type { PixelBuffer } from '../art/lib/pixels';
import type { SpriteDef } from '../art/lib/registry';
import { RAMPS, SWATCHES, SWATCH_NAMES, type RampName } from '../art/palette';

const q = new URLSearchParams(location.search);
const onlyGroup = q.get('group');
const filter = q.get('filter');
const bigScale = Math.max(2, Math.min(12, Number(q.get('scale') ?? 4) || 4));
const freeze = q.has('frame') ? Number(q.get('frame')) || 0 : null;
let showAnchor = q.has('anchor');

const registry = createArtRegistry();
const root = document.getElementById('gallery')!;
const nav = document.getElementById('groups')!;

if (q.get('bg') === 'light') document.body.classList.add('light');

function link(label: string, params: Record<string, string | null>): HTMLAnchorElement {
  const a = document.createElement('a');
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(params)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  a.href = `?${p.toString()}`;
  a.textContent = label;
  return a;
}

const groups = registry.groups();
const allLink = link('all', { group: null });
if (!onlyGroup) allLink.className = 'on';
nav.appendChild(allLink);
for (const g of ['palette', ...groups]) {
  const a = link(g, { group: g });
  if (g === onlyGroup) a.className = 'on';
  nav.appendChild(a);
}

const bgBtn = document.getElementById('bg')!;
const syncBg = (): void => {
  bgBtn.textContent = document.body.classList.contains('light') ? 'dark bg' : 'light bg';
};
bgBtn.addEventListener('click', () => {
  document.body.classList.toggle('light');
  syncBg();
});
syncBg();
document.getElementById('anchor')!.addEventListener('click', () => {
  showAnchor = !showAnchor;
});

// --- Palette ---------------------------------------------------------------------------------
function swatch(hex: string, title: string): HTMLElement {
  const s = document.createElement('span');
  s.className = 'sw';
  s.style.background = hex;
  s.title = title;
  return s;
}

if (!onlyGroup || onlyGroup === 'palette') {
  const h = document.createElement('h2');
  h.textContent = `palette — RIOT-64 (${SWATCH_NAMES.length} colours)`;
  const sec = document.createElement('section');
  sec.className = 'palette';
  const all = document.createElement('div');
  all.className = 'all';
  for (const n of SWATCH_NAMES) all.appendChild(swatch(SWATCHES[n], `${n} ${SWATCHES[n]}`));
  sec.appendChild(all);
  for (const r of Object.keys(RAMPS) as RampName[]) {
    const row = document.createElement('div');
    row.className = 'ramp';
    const label = document.createElement('b');
    label.textContent = r;
    row.appendChild(label);
    for (const n of RAMPS[r]) row.appendChild(swatch(SWATCHES[n], `${r}: ${n} ${SWATCHES[n]}`));
    sec.appendChild(row);
  }
  root.append(h, sec);
}

// --- Sprites ---------------------------------------------------------------------------------
interface LiveCard {
  def: SpriteDef;
  small: HTMLCanvasElement;
  big: HTMLCanvasElement;
  last: number;
}
const live: LiveCard[] = [];

function withAnchor(buf: PixelBuffer, def: SpriteDef): PixelBuffer {
  if (!showAnchor) return buf;
  const out = { w: buf.w, h: buf.h, data: new Uint8ClampedArray(buf.data) };
  const i = (def.anchor.y * buf.w + def.anchor.x) * 4;
  out.data.set([255, 0, 255, 255], i);
  return out;
}

function card(def: SpriteDef): HTMLElement {
  const f0 = def.frames[0]!;
  const el = document.createElement('div');
  el.className = 'card';
  const views = document.createElement('div');
  views.className = 'views';
  const small = document.createElement('canvas');
  small.width = f0.w;
  small.height = f0.h;
  const big = document.createElement('canvas');
  big.width = f0.w * bigScale;
  big.height = f0.h * bigScale;
  views.append(small, big);
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = def.name;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent =
    `${f0.w}×${f0.h}  ${def.frames.length}f` +
    (def.fps ? ` @${def.fps}fps` : '') +
    `  anchor ${def.anchor.x},${def.anchor.y}`;
  el.append(views, name, meta);
  live.push({ def, small, big, last: -1 });
  return el;
}

let sprites = registry.list();
if (onlyGroup) sprites = sprites.filter((d) => d.group === onlyGroup);
if (filter) sprites = sprites.filter((d) => d.name.includes(filter));
for (const g of groups) {
  const defs = sprites.filter((d) => d.group === g);
  if (!defs.length) continue;
  const h = document.createElement('h2');
  h.textContent = `${g} (${defs.length})`;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const d of defs) grid.appendChild(card(d));
  root.append(h, grid);
}
document.getElementById('count')!.textContent = `${sprites.length}/${registry.size} sprites`;

let lastAnchor = showAnchor;
function tick(now: number): void {
  const t = now / 1000;
  const anchorChanged = lastAnchor !== showAnchor;
  lastAnchor = showAnchor;
  for (const c of live) {
    const n = c.def.frames.length;
    const f =
      freeze !== null
        ? Math.min(freeze, n - 1)
        : c.def.fps > 0 && n > 1
          ? Math.floor(t * c.def.fps) % n
          : 0;
    if (f === c.last && !anchorChanged) continue;
    c.last = f;
    const buf = withAnchor(c.def.frames[f]!, c.def);
    drawBuffer(c.small, buf, 1);
    drawBuffer(c.big, buf, bigScale);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame((now) => {
  tick(now);
  document.documentElement.dataset.ready = 'true';
});
