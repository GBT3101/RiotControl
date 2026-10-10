/**
 * M2 map viewer (dev tool): canvas-2D debug render of the city blueprints.
 *
 *   /maps.html?city=<playable city id>   (madrid|london|paris|…; unbuilt ids fall back to madrid)
 *     &view=top|iso      top-down (default; i → right, j → down) or flat isometric (game camera)
 *     &scale=12          top-down pixels per tile
 *     &seed=0            building/decor seed
 *     &approaches=0      hide approach polylines
 *
 * Shows ground materials, markings, buildings shaded by storeys (rooftop-capable outlined in
 * yellow), the Capitol + steps, landmarks, spawn districts (+ doors, rally flags, unlock wave),
 * chokepoints, street names, decor, and a flow-field preview (distance to the steps).
 */
import { envStyle } from '../art/env/style';
import {
  BLUEPRINTS,
  GROUNDS,
  LANDMARKS,
  MARKINGS,
  PLAYABLE_CITIES,
  loadMap,
  playableOr,
  type CityId,
  type MapData,
} from '../maps';
import { descend, distanceField } from '../maps/flow';
import { rasterize } from '../maps/rasterize';
import { validateMap, type Issue } from '../maps/validate';

const q = new URLSearchParams(location.search);
const city: CityId = playableOr(q.get('city'));
const view = q.get('view') === 'iso' ? 'iso' : 'top';
const S = Math.max(4, Math.min(24, Number(q.get('scale') ?? 12) || 12));
const seed = Number(q.get('seed') ?? 0) || 0;
const showApproaches = q.get('approaches') !== '0';

const GROUND_COLOR: Record<(typeof GROUNDS)[number], string> = {
  lot: '#251e2e',
  asphalt: '#5d6274',
  sidewalk: '#a7a09a',
  cobble: '#8d7b69',
  plaza: '#d1bf98',
  steps: '#f4ecd8',
  bridge: '#a8916f',
  grass: '#5e9a47',
  parkPath: '#cdb27e',
  water: '#3577b4',
  quay: '#77767f',
};
/** Building tint of the city (EnvCity.mapTint). */
const CITY_TINT = (c: CityId): [number, number, number] => [...envStyle(c).mapTint];
const DISTRICT_COLORS = [
  '#ff5d73',
  '#4fd1ff',
  '#ffd23f',
  '#9b5de5',
  '#3ddc84',
  '#ff9f1c',
  '#f15bb5',
];

const DECOR_STYLE: Record<string, { c: string; r: number; glyph?: string }> = {
  tree: { c: '#2f7a33', r: 0.42 },
  lamp: { c: '#ffe066', r: 0.16 },
  bench: { c: '#8a5a33', r: 0.2, glyph: 'b' },
  bin: { c: '#3a5a3a', r: 0.14 },
  kiosk: { c: '#2a9d8f', r: 0.3, glyph: 'K' },
  phonebox: { c: '#e63946', r: 0.25, glyph: 'T' },
  postbox: { c: '#c1121f', r: 0.16 },
  morris: { c: '#2d6a4f', r: 0.25, glyph: 'M' },
  metro: { c: '#e63946', r: 0.3, glyph: 'M' },
  tube: { c: '#1d4ed8', r: 0.3, glyph: 'U' },
  busstop: { c: '#457b9d', r: 0.22, glyph: 'B' },
  hydrant: { c: '#d62828', r: 0.12 },
  bollard: { c: '#222', r: 0.12 },
  planter: { c: '#6a994e', r: 0.2 },
  cafe: { c: '#bc6c25', r: 0.25, glyph: 'c' },
  statue: { c: '#e9c46a', r: 0.3, glyph: 'S' },
  fountain: { c: '#90e0ef', r: 0.3, glyph: 'F' },
  flag: { c: '#f4a261', r: 0.2, glyph: 'f' },
  boat: { c: '#fff', r: 0.2 },
  railing: { c: '#222', r: 0.1 },
  wallace: { c: '#2d6a4f', r: 0.2, glyph: 'w' },
};
const decorStyle = (kind: string): { c: string; r: number; glyph?: string } =>
  DECOR_STYLE[kind] ?? DECOR_STYLE[kind.split('.')[0]!] ?? { c: '#f0f', r: 0.2, glyph: '?' };

// ---------------------------------------------------------------------------------------------

const t0 = performance.now();
const bp = BLUEPRINTS[city]!;
const fresh = rasterize(bp, seed);
const rasterMs = performance.now() - t0;
const map: MapData = seed === 0 ? loadMap(city) : fresh;
const t1 = performance.now();
const issues = validateMap(map, bp);
const validateMs = performance.now() - t1;
const field = distanceField(map, map.capitol.steps, { costs: true });

document.title = `Riot Control — ${map.name} map`;
const style = document.createElement('style');
style.textContent = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #17131f; color: #e8e2f0; font: 13px/1.35 system-ui, sans-serif; }
  header { display: flex; gap: 14px; align-items: baseline; padding: 10px 16px; background: #221c2e; border-bottom: 1px solid #3a3148; flex-wrap: wrap; }
  header h1 { font-size: 16px; margin: 0; letter-spacing: .08em; }
  header a { color: #ffd23f; text-decoration: none; padding: 2px 6px; border-radius: 4px; }
  header a.on { background: #ffd23f; color: #221c2e; }
  main { display: flex; gap: 16px; padding: 16px; align-items: flex-start; flex-wrap: wrap; }
  .col { display: flex; flex-direction: column; gap: 12px; max-width: 460px; }
  canvas { image-rendering: pixelated; display: block; border: 1px solid #3a3148; }
  h2 { font-size: 13px; margin: 0 0 4px; color: #ffd23f; text-transform: uppercase; letter-spacing: .08em; }
  table { border-collapse: collapse; } td { padding: 1px 8px 1px 0; vertical-align: top; }
  .err { color: #ff6b6b; } .warn { color: #ffd166; } .ok { color: #3ddc84; }
  .sw { display: inline-block; width: 10px; height: 10px; margin-right: 4px; vertical-align: -1px; border: 1px solid #0006; }
  .legend { columns: 2; font-size: 12px; }
`;
document.head.append(style);

const header = document.createElement('header');
const link = (label: string, params: Record<string, string>, on: boolean): string => {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(params)) p.set(k, v);
  return `<a class="${on ? 'on' : ''}" href="?${p}">${label}</a>`;
};
header.innerHTML =
  `<h1>RIOT CONTROL · MAPS</h1>` +
  PLAYABLE_CITIES.map((c) => link(c, { city: c }, c === city)).join('') +
  `<span>|</span>` +
  link('top-down', { view: 'top' }, view === 'top') +
  link('iso', { view: 'iso' }, view === 'iso') +
  `<span style="opacity:.7">${map.w}×${map.h} · seed ${seed} · raster ${rasterMs.toFixed(1)} ms · validate ${validateMs.toFixed(1)} ms</span>`;
document.body.append(header);
const main = document.createElement('main');
document.body.append(main);

// ---------------------------------------------------------------------------------------------
// Top-down render
// ---------------------------------------------------------------------------------------------

function shade(rgb: [number, number, number], f: number): string {
  return `rgb(${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v * f)))).join(',')})`;
}

function drawTop(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = map.w * S;
  cv.height = map.h * S;
  const g = cv.getContext('2d')!;
  const { w, h } = map;
  // Ground.
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      g.fillStyle = GROUND_COLOR[GROUNDS[map.ground[j * w + i]!]!];
      g.fillRect(i * S, j * S, S, S);
    }
  }
  // Markings.
  g.fillStyle = '#f2f2f2';
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const m = MARKINGS[map.marking[j * w + i]!];
      const x = i * S;
      const y = j * S;
      const u = Math.max(1, Math.round(S / 10));
      if (m === 'dashI') g.fillRect(x + S * 0.2, y + S / 2 - u / 2, S * 0.6, u);
      else if (m === 'dashJ') g.fillRect(x + S / 2 - u / 2, y + S * 0.2, u, S * 0.6);
      else if (m === 'zebraI')
        for (let t = 1; t < 5; t += 2) g.fillRect(x + S * 0.15, y + (t * S) / 5, S * 0.7, S / 5);
      else if (m === 'zebraJ')
        for (let t = 1; t < 5; t += 2) g.fillRect(x + (t * S) / 5, y + S * 0.15, S / 5, S * 0.7);
      else if (m === 'stopI') g.fillRect(x + S / 2 - u, y, u * 2, S);
      else if (m === 'stopJ') g.fillRect(x, y + S / 2 - u, S, u * 2);
    }
  }
  // Buildings.
  const tint = CITY_TINT(city);
  const districtOf = new Map<number, number>();
  map.spawns.forEach((s, k) => s.buildingIds.forEach((id) => districtOf.set(id, k)));
  for (const b of map.buildings) {
    const f = 0.45 + b.storeys * 0.1;
    const base: [number, number, number] =
      b.kind === 'civic'
        ? [150, 140, 190]
        : b.kind === 'commercial'
          ? [tint[0] * 0.8, tint[1] * 0.85, tint[2] * 1.05]
          : tint;
    g.fillStyle = shade(base, f);
    g.fillRect(b.i * S + 1, b.j * S + 1, b.w * S - 2, b.d * S - 2);
    // Roof hint: mansard/pitched ridge lines.
    g.strokeStyle = 'rgba(0,0,0,.25)';
    g.lineWidth = 1;
    if (b.roof === 'pitched' || b.roof === 'mansard') {
      g.beginPath();
      if (b.w >= b.d) {
        g.moveTo(b.i * S + 3, (b.j + b.d / 2) * S);
        g.lineTo((b.i + b.w) * S - 3, (b.j + b.d / 2) * S);
      } else {
        g.moveTo((b.i + b.w / 2) * S, b.j * S + 3);
        g.lineTo((b.i + b.w / 2) * S, (b.j + b.d) * S - 3);
      }
      g.stroke();
    }
    if (b.roof === 'mansard') {
      g.strokeRect(b.i * S + 4, b.j * S + 4, b.w * S - 8, b.d * S - 8);
    }
    const dk = districtOf.get(b.id);
    if (dk !== undefined) {
      g.strokeStyle = DISTRICT_COLORS[dk % DISTRICT_COLORS.length]!;
      g.lineWidth = 2;
      g.strokeRect(b.i * S + 2, b.j * S + 2, b.w * S - 4, b.d * S - 4);
    }
    if (b.rooftop) {
      g.strokeStyle = '#ffe14d';
      g.lineWidth = 2;
      g.strokeRect(b.i * S + 1, b.j * S + 1, b.w * S - 2, b.d * S - 2);
    } else {
      g.strokeStyle = 'rgba(0,0,0,.55)';
      g.lineWidth = 1;
      g.strokeRect(b.i * S + 1.5, b.j * S + 1.5, b.w * S - 3, b.d * S - 3);
    }
    // Storey count.
    if (S >= 10) {
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.font = `${Math.round(S * 0.6)}px monospace`;
      g.fillText(String(b.storeys), b.i * S + 3, b.j * S + S * 0.75);
    }
  }
  // Doors (spawn doors coloured by district).
  for (const b of map.buildings) {
    const dk = districtOf.get(b.id);
    for (const d of b.doors) {
      g.fillStyle =
        dk !== undefined ? DISTRICT_COLORS[dk % DISTRICT_COLORS.length]! : 'rgba(30,20,40,.6)';
      const r = dk !== undefined ? S * 0.22 : S * 0.12;
      g.beginPath();
      g.arc((d.i + 0.5) * S, (d.j + 0.5) * S, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Decor.
  for (const d of map.decor) {
    const st = decorStyle(d.kind);
    g.fillStyle = st.c;
    g.beginPath();
    g.arc((d.i + 0.5) * S, (d.j + 0.5) * S, st.r * S, 0, Math.PI * 2);
    g.fill();
    if (st.glyph && S >= 10) {
      g.fillStyle = '#fff';
      g.font = `bold ${Math.round(S * 0.45)}px sans-serif`;
      g.textAlign = 'center';
      g.fillText(st.glyph, (d.i + 0.5) * S, (d.j + 0.68) * S);
      g.textAlign = 'left';
    }
  }
  // Capitol + landmarks.
  const c = map.capitol;
  g.fillStyle = '#c1121f';
  g.fillRect(c.i * S, c.j * S, c.w * S, c.d * S);
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.strokeRect(c.i * S + 1, c.j * S + 1, c.w * S - 2, c.d * S - 2);
  // Front facade marker.
  g.fillStyle = '#ffd23f';
  g.fillRect(c.i * S, (c.j + c.d) * S - 3, c.w * S, 3);
  label(g, 'CAPITOL', (c.i + c.w / 2) * S, (c.j + c.d / 2) * S, '#fff', 13, '#5a0010');
  for (const l of map.landmarks) {
    const def = LANDMARKS[l.id];
    g.fillStyle = '#d4a017';
    g.fillRect(l.i * S, l.j * S, def.w * S, def.d * S);
    g.strokeStyle = '#3d2c00';
    g.lineWidth = 2;
    g.strokeRect(l.i * S + 1, l.j * S + 1, def.w * S - 2, def.d * S - 2);
    label(
      g,
      def.label,
      (l.i + def.w / 2) * S,
      (l.j + def.d / 2) * S - (def.d < 3 ? S : 0),
      '#fff8dc',
      11,
      '#3d2c00',
    );
  }
  // Civic names.
  for (const cv2 of bp.civic)
    label(g, cv2.name, (cv2.i + cv2.w / 2) * S, (cv2.j + cv2.d / 2) * S, '#e8e2ff', 9, '#2a2340');
  // Approaches.
  if (showApproaches) {
    for (const a of bp.approaches) {
      g.strokeStyle = a.final ? 'rgba(255,60,90,.85)' : 'rgba(255,140,60,.55)';
      g.lineWidth = a.final ? 3 : 2;
      g.setLineDash(a.final ? [] : [6, 5]);
      g.beginPath();
      a.path.forEach(([x, y], k) => (k ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)));
      g.stroke();
      const [ex, ey] = a.path[a.path.length - 1]!;
      const [px, py] = a.path[a.path.length - 2] ?? a.path[0]!;
      arrow(g, px * S, py * S, ex * S, ey * S);
    }
    g.setLineDash([]);
  }
  // Street names.
  for (const s of map.streets)
    streetLabel(
      g,
      s.path.map((p) => [p.i * S, p.j * S] as const),
      s.name,
    );
  for (const l of bp.labels ?? [])
    label(g, l.text, l.at[0] * S, l.at[1] * S, '#e0f4ff', 14, '#0b2740');
  for (const r of bp.rivers) {
    const mid = r.path[Math.floor(r.path.length / 2)]!;
    label(g, r.name, mid[0] * S, mid[1] * S, '#e0f4ff', 14, '#0b2740');
  }
  // Chokepoints.
  for (const ch of map.chokepoints) {
    g.strokeStyle = '#ff2bd6';
    g.lineWidth = 3;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.arc((ch.i + 0.5) * S, (ch.j + 0.5) * S, (ch.radius + 0.5) * S, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    label(
      g,
      `⚠ ${ch.name}`,
      (ch.i + 0.5) * S,
      (ch.j - ch.radius - 0.4) * S,
      '#ffd0f5',
      11,
      '#5a0050',
    );
  }
  // Spawn districts.
  map.spawns.forEach((s, k) => {
    const d = bp.districts.find((x) => x.id === s.id)!;
    const col = DISTRICT_COLORS[k % DISTRICT_COLORS.length]!;
    const [i0, j0, i1, j1] = d.area;
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.setLineDash([10, 6]);
    g.strokeRect(i0 * S + 2, j0 * S + 2, (i1 - i0 + 1) * S - 4, (j1 - j0 + 1) * S - 4);
    g.setLineDash([]);
    const rx = (s.rally.i + 0.5) * S;
    const ry = (s.rally.j + 0.5) * S;
    g.fillStyle = col;
    g.fillRect(rx - 1, ry - S * 1.4, 2, S * 1.4);
    g.beginPath();
    g.moveTo(rx + 1, ry - S * 1.4);
    g.lineTo(rx + S, ry - S * 1.1);
    g.lineTo(rx + 1, ry - S * 0.8);
    g.fill();
    label(
      g,
      `${s.name} · W${s.unlockWave} · ${s.buildingIds.length}🏠`,
      rx,
      ry + S * 0.9,
      '#fff',
      12,
      col,
    );
  });
  // Camera start.
  g.strokeStyle = '#fff';
  g.lineWidth = 1;
  g.strokeRect((map.cameraStart.i - 11) * S, (map.cameraStart.j - 11) * S, 22 * S, 22 * S);
  return cv;
}

function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fg: string,
  size: number,
  bg: string,
): void {
  g.font = `bold ${size}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const wd = g.measureText(text).width;
  g.fillStyle = bg;
  g.globalAlpha = 0.82;
  g.fillRect(x - wd / 2 - 3, y - size / 2 - 2, wd + 6, size + 4);
  g.globalAlpha = 1;
  g.fillStyle = fg;
  g.fillText(text, x, y + 1);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
}

function streetLabel(
  g: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[],
  text: string,
): void {
  // Longest segment.
  let best = 0;
  let bl = -1;
  for (let k = 0; k + 1 < pts.length; k++) {
    const l = Math.hypot(pts[k + 1]![0] - pts[k]![0], pts[k + 1]![1] - pts[k]![1]);
    if (l > bl) {
      bl = l;
      best = k;
    }
  }
  const a = pts[best]!;
  const b = pts[best + 1] ?? a;
  let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (ang > Math.PI / 2) ang -= Math.PI;
  if (ang < -Math.PI / 2) ang += Math.PI;
  g.save();
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  g.rotate(ang);
  g.font = 'italic bold 11px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(20,16,28,.85)';
  g.strokeText(text, 0, 0);
  g.fillStyle = '#fff';
  g.fillText(text, 0, 0);
  g.restore();
}

function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - 10 * Math.cos(a - 0.45), y1 - 10 * Math.sin(a - 0.45));
  g.lineTo(x1 - 10 * Math.cos(a + 0.45), y1 - 10 * Math.sin(a + 0.45));
  g.closePath();
  g.fillStyle = g.strokeStyle;
  g.fill();
}

// ---------------------------------------------------------------------------------------------
// Flow preview
// ---------------------------------------------------------------------------------------------

function drawFlow(scale: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = map.w * scale;
  cv.height = map.h * scale;
  const g = cv.getContext('2d')!;
  let max = 0;
  for (const d of field) if (Number.isFinite(d) && d > max) max = d;
  for (let j = 0; j < map.h; j++) {
    for (let i = 0; i < map.w; i++) {
      const k = j * map.w + i;
      const d = field[k]!;
      const gr = GROUNDS[map.ground[k]!]!;
      if (!Number.isFinite(d)) {
        g.fillStyle = gr === 'water' ? '#1d3f63' : map.building[k]! >= 0 ? '#2a2333' : '#120f18';
      } else {
        const t = d / max;
        // Hot (near) → cold (far).
        const hue = 10 + t * 230;
        const band = Math.floor(d / 6) % 2 === 0 ? 52 : 46;
        g.fillStyle = `hsl(${hue} 85% ${band}%)`;
      }
      g.fillRect(i * scale, j * scale, scale, scale);
    }
  }
  // Shortest routes from every rally point.
  map.spawns.forEach((s, k) => {
    const route = descend(map, field, s.rally);
    g.strokeStyle = DISTRICT_COLORS[k % DISTRICT_COLORS.length]!;
    g.lineWidth = 2;
    g.beginPath();
    route.forEach((p, n) =>
      n
        ? g.lineTo((p.i + 0.5) * scale, (p.j + 0.5) * scale)
        : g.moveTo((p.i + 0.5) * scale, (p.j + 0.5) * scale),
    );
    g.stroke();
  });
  const c = map.capitol;
  g.fillStyle = '#fff';
  g.fillRect(c.i * scale, c.j * scale, c.w * scale, c.d * scale);
  for (const ch of map.chokepoints) {
    g.strokeStyle = '#ff2bd6';
    g.lineWidth = 2;
    g.beginPath();
    g.arc((ch.i + 0.5) * scale, (ch.j + 0.5) * scale, (ch.radius + 0.5) * scale, 0, Math.PI * 2);
    g.stroke();
  }
  return cv;
}

// ---------------------------------------------------------------------------------------------
// Flat isometric render (game camera orientation)
// ---------------------------------------------------------------------------------------------

function drawIso(): HTMLCanvasElement {
  const TW = 16;
  const TH = 8;
  const SH = 5; // px per storey
  const { w, h } = map;
  const cv = document.createElement('canvas');
  cv.width = (w + h) * (TW / 2) + 4;
  cv.height = (w + h) * (TH / 2) + 6 * SH + 40;
  const g = cv.getContext('2d')!;
  const ox = h * (TW / 2) + 2;
  const oy = 6 * SH + 20;
  const px = (i: number, j: number): [number, number] => [
    ox + (i - j) * (TW / 2),
    oy + (i + j) * (TH / 2),
  ];
  const tint = CITY_TINT(city);
  const diamond = (i: number, j: number, z: number): void => {
    const [x, y] = px(i, j);
    g.beginPath();
    g.moveTo(x, y - z);
    g.lineTo(x + TW / 2, y + TH / 2 - z);
    g.lineTo(x, y + TH - z);
    g.lineTo(x - TW / 2, y + TH / 2 - z);
    g.closePath();
  };
  const heightAt = (i: number, j: number): number => {
    const b = map.building[j * w + i]!;
    if (b >= 0) return map.buildings[b]!.storeys * SH;
    const c = map.capitol;
    if (i >= c.i && j >= c.j && i < c.i + c.w && j < c.j + c.d) return 7 * SH;
    for (const l of map.landmarks) {
      const d = LANDMARKS[l.id];
      if (i >= l.i && j >= l.j && i < l.i + d.w && j < l.j + d.d)
        return (l.id === 'eiffel' ? 14 : 4) * SH;
    }
    return 0;
  };
  const colorAt = (i: number, j: number): [number, number, number] => {
    const b = map.building[j * w + i]!;
    if (b >= 0) {
      const bd = map.buildings[b]!;
      return bd.kind === 'civic'
        ? [170, 160, 205]
        : bd.rooftop
          ? [tint[0], tint[1] * 1.05, tint[2] * 0.8]
          : tint;
    }
    const c = map.capitol;
    if (i >= c.i && j >= c.j && i < c.i + c.w && j < c.j + c.d) return [235, 225, 205];
    return [212, 160, 23];
  };
  for (let s = 0; s < w + h - 1; s++) {
    for (let i = Math.max(0, s - h + 1); i <= Math.min(w - 1, s); i++) {
      const j = s - i;
      const k = j * w + i;
      const z = heightAt(i, j);
      g.fillStyle = GROUND_COLOR[GROUNDS[map.ground[k]!]!];
      diamond(i, j, 0);
      g.fill();
      if (z > 0) {
        const col = colorAt(i, j);
        const [x, y] = px(i, j);
        // Left face (+j edge, lit).
        g.fillStyle = shade(col, 0.82);
        g.beginPath();
        g.moveTo(x - TW / 2, y + TH / 2 - z);
        g.lineTo(x, y + TH - z);
        g.lineTo(x, y + TH);
        g.lineTo(x - TW / 2, y + TH / 2);
        g.fill();
        // Right face (+i edge, shaded).
        g.fillStyle = shade(col, 0.6);
        g.beginPath();
        g.moveTo(x + TW / 2, y + TH / 2 - z);
        g.lineTo(x, y + TH - z);
        g.lineTo(x, y + TH);
        g.lineTo(x + TW / 2, y + TH / 2);
        g.fill();
        g.fillStyle = shade(col, 1.08);
        diamond(i, j, z);
        g.fill();
      }
    }
  }
  for (const s of map.streets) {
    const pts = s.path.map((p) => px(p.i, p.j));
    streetLabel(g, pts, s.name);
  }
  for (const l of map.landmarks) {
    const d = LANDMARKS[l.id];
    const [x, y] = px(l.i + d.w / 2, l.j + d.d / 2);
    label(g, d.label, x, y - 30, '#fff8dc', 10, '#3d2c00');
  }
  const c = map.capitol;
  const [cx, cy] = px(c.i + c.w / 2, c.j + c.d / 2);
  label(g, 'CAPITOL', cx, cy - 46, '#fff', 12, '#5a0010');
  return cv;
}

// ---------------------------------------------------------------------------------------------
// Side panel
// ---------------------------------------------------------------------------------------------

function panel(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'col';
  const errs = issues.filter((x: Issue) => x.level === 'error');
  const warns = issues.filter((x: Issue) => x.level === 'warn');
  const roof = map.buildings.filter((b) => b.rooftop).length;
  const res = map.buildings.filter((b) => b.kind === 'residential').length;
  const decorCounts = new Map<string, number>();
  for (const d of map.decor) decorCounts.set(d.kind, (decorCounts.get(d.kind) ?? 0) + 1);
  const groundCounts = new Map<string, number>();
  for (const v of map.ground)
    groundCounts.set(GROUNDS[v]!, (groundCounts.get(GROUNDS[v]!) ?? 0) + 1);
  el.innerHTML = `
    <div><h2>${map.name}</h2>
      <table>
        <tr><td>buildings</td><td>${map.buildings.length} (${res} residential, ${roof} rooftop)</td></tr>
        <tr><td>spawns</td><td>${map.spawns.map((s) => `${s.name} W${s.unlockWave} (${s.buildingIds.length})`).join(', ')}</td></tr>
        <tr><td>chokepoints</td><td>${map.chokepoints.map((c) => c.name).join(', ')}</td></tr>
        <tr><td>streets</td><td>${map.streets.length} named</td></tr>
        <tr><td>decor</td><td>${map.decor.length}: ${[...decorCounts].map(([k, v]) => `${k} ${v}`).join(', ')}</td></tr>
      </table>
    </div>
    <div><h2>Validation</h2>${
      errs.length + warns.length === 0
        ? '<span class="ok">all checks pass</span>'
        : [...errs, ...warns]
            .map(
              (x) =>
                `<div class="${x.level === 'error' ? 'err' : 'warn'}">${x.level}: ${x.msg}</div>`,
            )
            .join('')
    }</div>
    <div><h2>Legend</h2><div class="legend">${Object.entries(GROUND_COLOR)
      .map(
        ([k, c]) =>
          `<div><span class="sw" style="background:${c}"></span>${k} (${groundCounts.get(k) ?? 0})</div>`,
      )
      .join('')}
      <div><span class="sw" style="border:2px solid #ffe14d"></span>rooftop bldg</div>
      <div><span class="sw" style="background:#c1121f"></span>Capitol</div>
      <div><span class="sw" style="background:#d4a017"></span>landmark</div>
      <div><span class="sw" style="border:2px dashed #ff2bd6"></span>chokepoint</div>
    </div></div>`;
  return el;
}

if (view === 'top') {
  main.append(drawTop());
  const col = panel();
  const h2 = document.createElement('h2');
  h2.textContent = 'Flow field → Capitol steps';
  col.prepend(drawFlow(Math.max(3, Math.floor(S / 2))));
  col.prepend(h2);
  main.append(col);
} else {
  main.append(drawIso());
  main.append(panel());
}
(window as unknown as { __maps: unknown }).__maps = { map, issues, field };
document.documentElement.dataset.ready = 'true';
