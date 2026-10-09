/**
 * World overlays driven by the controller's UI state: selection ring + range ring under the
 * selected unit, deploy-mode tile highlights (valid / invalid diamonds around the cursor),
 * rooftop deploy mode's roof highlights (the standable roof surface of every free rooftop
 * building; the hovered one in hi-vis), the placement ghost (unit art remapped to the
 * blue/red ghost ramp) and command waypoints. Never colour-graded.
 *
 * Sorting: ground marks (tile highlights, range ring, selection ring of ground units) live in
 * the `marks` layer under every standing thing, so buildings in front hide them; upright
 * markers (waypoint flag, placement ghost) and roof highlights / rooftop selection rings sort
 * inside `entities` with the world.
 */
import { Container, Sprite, Texture } from 'pixi.js';
import { art } from '../art/lib/atlas';
import { ghostTint, rangeRing } from '../art/fx';
import { px } from '../art/fx/draw';
import { createBuffer, type PixelBuffer } from '../art/lib/pixels';
import { bufferTexture } from '../art/uikit/pixi';
import { depthKey, tileToWorld } from '../core/iso';
import { UNITS, type UnitId } from '../data/units';
import type { World } from '../sim/world';
import type { ViewLayers } from './layers';
import { setTex } from './sprites';
import type { RoofInfo } from './staticView';
import { UNIT_ART } from './unitView';

export interface OverlayState {
  /** Unit type being placed (deploy mode), or null. */
  deploy: UnitId | null;
  /** Hovered tile (deploy preview / command target). */
  hoverI: number;
  hoverJ: number;
  hasHover: boolean;
  /** Selected unit id, or -1. */
  selected: number;
}

const ghostCache = new Map<string, Texture>();

function anchored(t: Texture, a: { x: number; y: number }): Texture {
  return new Texture({ source: t.source, defaultAnchor: a, label: t.label });
}
const ringCache = new Map<number, Texture>();

/**
 * Shape cues so team / validity never rely on colour alone (M13b, colour-blind safety):
 * an iso "✖" over an invalid placement spot, and a downward ally chevron over the selected
 * unit (enemy x-ray ghosts get a "!" pip in the protester view). Drawn from a key grid in
 * RIOT-64 colours with an `ink` keyline.
 */
function cueTexture(rows: readonly string[], fill: string, label: string): Texture {
  const h = rows.length + 2;
  const w = rows[0]!.length + 2;
  const b = createBuffer(w, h);
  const on = (x: number, y: number): boolean => rows[y - 1]?.[x - 1] === 'X';
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (on(x, y)) px(b, x, y, fill);
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) px(b, x, y, 'ink');
    }
  return anchored(bufferTexture(b, label), { x: 0.5, y: 0.5 });
}

const CROSS_ROWS = ['XX.....XX', '..XX.XX..', '....X....', '..XX.XX..', 'XX.....XX'];
const ALLY_PIP_ROWS = ['XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
let crossTex: Texture | null = null;
let allyPipTex: Texture | null = null;
const crossTexture = (): Texture => (crossTex ??= cueTexture(CROSS_ROWS, 'crim2', 'cue:cross'));
const allyPipTexture = (): Texture =>
  (allyPipTex ??= cueTexture(ALLY_PIP_ROWS, 'blue2', 'cue:ally'));

function ghostTexture(unit: UnitId, ok: boolean): Texture | null {
  const key = `${unit}:${ok}`;
  let t = ghostCache.get(key);
  if (t) return t;
  const name =
    unit === 'blockade'
      ? 'unit.blockade.single.i'
      : unit === 'humvee'
        ? 'veh.humvee.drive.se'
        : unit === 'tank'
          ? 'veh.tank.drive.se'
          : unit === 'heli'
            ? 'veh.heli.hover.se'
            : `unit.${UNIT_ART[unit]}.idle.se`;
  if (!art.has(name)) return null;
  const tex = art.tex(name);
  // Read the frame back from the atlas page buffer (buffer-backed pages expose `resource`).
  const src = tex.source.resource as Uint8Array | undefined;
  if (!(src instanceof Uint8Array)) return null;
  const f = tex.frame;
  const buf: PixelBuffer = createBuffer(f.width, f.height);
  const pw = tex.source.width;
  for (let y = 0; y < f.height; y++) {
    const s = ((f.y + y) * pw + f.x) * 4;
    buf.data.set(src.subarray(s, s + f.width * 4), y * f.width * 4);
  }
  t = anchored(bufferTexture(ghostTint(buf, ok ? 'valid' : 'invalid'), `ghost:${key}`), {
    x: tex.defaultAnchor?.x ?? 0.5,
    y: tex.defaultAnchor?.y ?? 1,
  });
  ghostCache.set(key, t);
  return t;
}

function ringTexture(tiles: number): Texture | null {
  const r = Math.round(tiles * 2) / 2;
  let t = ringCache.get(r);
  if (t) return t;
  const buf = rangeRing(r)[0]!;
  t = anchored(bufferTexture(buf, `ring:${r}`), { x: 0.5, y: 0.5 });
  ringCache.set(r, t);
  return t;
}

type RoofStyle = 'valid' | 'target' | 'invalid';
const ROOF_COLOURS: Readonly<Record<RoofStyle, readonly [string, string, string]>> = {
  valid: ['lime', 'green3', 'lime'],
  target: ['hivis2', 'olive2', 'hivis1'],
  invalid: ['rust4', 'crim1', 'crim2'],
};

/**
 * Highlight of a roof surface: the footprint-local tile rectangle [u0,u1)×[v0,v1) as an iso
 * parallelogram — 2-px dashed rim, sparse checker fill. Returns the buffer and the world
 * offset of its top-left corner relative to the footprint's top vertex.
 */
export function roofHighlight(
  r: { u0: number; v0: number; u1: number; v1: number },
  style: RoofStyle,
): { buf: PixelBuffer; ox: number; oy: number } {
  const [bright, mid, dim] = ROOF_COLOURS[style];
  const ox = Math.floor((r.u0 - r.v1) * 16);
  const oy = Math.floor((r.u0 + r.v0) * 8);
  const w = Math.ceil((r.u1 - r.v0) * 16) - ox;
  const h = Math.ceil((r.u1 + r.v1) * 8) - oy;
  const b = createBuffer(Math.max(1, w), Math.max(1, h));
  const inside = (x: number, y: number): boolean => {
    const X = x + ox + 0.5;
    const Y = y + oy + 0.5;
    const u = Y / 16 + X / 32;
    const v = Y / 16 - X / 32;
    return u >= r.u0 && u < r.u1 && v >= r.v0 && v < r.v1;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) {
        px(b, x, y, (Math.floor((x + (y < h / 2 ? 0 : 2)) / 4) & 1) === 0 ? bright : mid);
      } else if ((x + y) % 2 === 0 && (style !== 'valid' || y % 2 === 0)) px(b, x, y, dim);
    }
  }
  return { buf: b, ox, oy };
}

export interface OverlayDeps {
  unitPos: (id: number) => { x: number; y: number; lift: number; key: number } | undefined;
  roof: (building: number) => RoofInfo | undefined;
  /** Standable roof rectangle (footprint-local tiles) of a building. */
  roofStand: (building: number) => { u0: number; v0: number; u1: number; v1: number } | undefined;
  /** Occlusion level at a world point (0 visible, 1 partly, 2 fully behind a building). */
  occlusion: (x: number, y: number) => number;
}

interface RoofMark {
  sprite: Sprite;
  tex: Partial<Record<RoofStyle, Texture>>;
}

export class OverlayView {
  /** Ground marks (tile highlights, range ring, ground selection ring). */
  readonly root = new Container({ label: 'overlay-marks' });
  private readonly tiles: Sprite[] = [];
  private readonly ghost = new Sprite();
  private readonly ring = new Sprite();
  private readonly range = new Sprite();
  private readonly waypoint = new Sprite();
  /** Shape cues: ✖ on an invalid spot, ▼ over the selected ally. */
  private readonly cross = new Sprite();
  private readonly pip = new Sprite();
  private readonly roofMarks = new Map<number, RoofMark>();
  private waypointT = -99;
  private waypointUntil = -99;

  constructor(
    private readonly world: World,
    private readonly layers: ViewLayers,
    private readonly deps: OverlayDeps,
  ) {
    layers.marks.addChild(this.root);
    this.ghost.alpha = 0.75;
    this.range.alpha = 0.9;
    this.root.addChild(this.range);
    for (const s of [this.ghost, this.waypoint]) {
      s.visible = false;
      layers.entities.addChild(s);
    }
    for (const s of [this.cross, this.pip]) {
      s.visible = false;
      layers.overlays.addChild(s);
    }
  }

  /** Show the command flag at tile (i, j). */
  flag(i: number, j: number, now: number): void {
    const p = tileToWorld(i + 0.5, j + 0.5);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    this.waypoint.position.set(x, y);
    this.waypoint.zIndex = depthKey(x, y);
    this.waypointT = now;
    this.waypointUntil = now + 1.6;
  }

  /** Roof highlight sprite for building `b` in `style` (built lazily), or null. */
  private roofMark(b: number, style: RoofStyle): Sprite | null {
    let m = this.roofMarks.get(b);
    if (!m) {
      const sprite = new Sprite();
      sprite.visible = false;
      this.layers.entities.addChild(sprite);
      m = { sprite, tex: {} };
      this.roofMarks.set(b, m);
    }
    const roof = this.deps.roof(b);
    const stand = this.deps.roofStand(b);
    const bd = this.world.map.buildings[b];
    if (!roof || !stand || !bd) return null;
    let t = m.tex[style];
    const hl = roofHighlight(stand, style);
    if (!t) {
      t = bufferTexture(hl.buf, `roof:${b}:${style}`);
      m.tex[style] = t;
    }
    const p0 = tileToWorld(bd.i, bd.j);
    const s = m.sprite;
    if (s.texture !== t) s.texture = t;
    s.position.set(Math.round(p0.x) + hl.ox, Math.round(p0.y) + hl.oy - roof.top);
    s.zIndex = roof.frontKey + 1;
    s.visible = true;
    return s;
  }

  update(st: OverlayState, now: number): void {
    const w = this.world;
    // Deploy mode: tile highlights around the cursor + ghost.
    let used = 0;
    this.ghost.visible = false;
    this.cross.visible = false;
    this.pip.visible = false;
    for (const m of this.roofMarks.values()) m.sprite.visible = false;
    if (st.deploy && UNITS[st.deploy].placement === 'rooftop') this.updateRoofs(st, now);
    else if (st.deploy && st.hasHover) {
      const def = UNITS[st.deploy];
      const R = 4;
      const valid = art.has('ui.tile.valid') ? art.anim('ui.tile.valid') : null;
      const invalid = art.has('ui.tile.invalid') ? art.anim('ui.tile.invalid') : null;
      if (def.placement !== 'air' && valid) {
        for (let dj = -R; dj <= R; dj++) {
          for (let di = -R; di <= R; di++) {
            if (Math.abs(di) + Math.abs(dj) > R + 1) continue;
            const i = st.hoverI + di;
            const j = st.hoverJ + dj;
            if (!w.nav.inBounds(i, j)) continue;
            const chk = w.canDeploy(st.deploy, i, j);
            const ok = chk.ok || chk.reason === 'hate';
            if (!ok && !(di === 0 && dj === 0)) continue;
            const isHover = di === 0 && dj === 0;
            const clip = ok
              ? isHover && art.has('ui.tile.target')
                ? art.anim('ui.tile.target')
                : valid
              : invalid;
            if (!clip) continue;
            let s = this.tiles[used];
            if (!s) {
              s = new Sprite();
              this.root.addChild(s);
              this.tiles.push(s);
            }
            used++;
            s.visible = true;
            setTex(s, clip.frames[clip.frameAt(now)]!);
            const p = tileToWorld(i, j);
            s.position.set(p.x, p.y);
          }
        }
      }
      const chk = w.canDeploy(st.deploy, st.hoverI, st.hoverJ);
      const g = ghostTexture(st.deploy, chk.ok);
      if (g) {
        setTex(this.ghost, g);
        const p = tileToWorld(chk.x, chk.y);
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        this.ghost.position.set(x, y - (def.placement === 'air' ? 40 : 0));
        this.ghost.zIndex = depthKey(x, y) + (def.placement === 'air' ? 1e6 : 0);
        this.ghost.visible = true;
        // Behind a building: x-ray the preview on top (fainter) so the player sees the spot.
        const hidden = def.placement !== 'air' && this.deps.occlusion(x, y) > 0;
        const parent = hidden ? this.layers.overlays : this.layers.entities;
        if (this.ghost.parent !== parent) parent.addChild(this.ghost);
        this.ghost.alpha = hidden ? 0.5 : 0.75;
        if (!chk.ok && chk.reason !== 'hate') this.showCross(x, y - 1);
      }
    }
    for (let k = used; k < this.tiles.length; k++) this.tiles[k]!.visible = false;
    // Selection + range ring.
    this.ring.visible = false;
    this.range.visible = false;
    if (st.selected >= 0) {
      const u = w.units.get(st.selected);
      const pos = this.deps.unitPos(st.selected);
      if (u && pos) {
        const size =
          u.type === 'tank' || u.type === 'heli'
            ? 'l'
            : u.type === 'humvee' || u.type === 'mounted'
              ? 'm'
              : 's';
        const rc = art.has(`ui.select.ally.${size}`) ? art.anim(`ui.select.ally.${size}`) : null;
        if (rc) {
          setTex(this.ring, rc.frames[rc.frameAt(now)]!);
          const onRoof = pos.lift > 0 && u.type !== 'heli';
          // Ground units: a ground mark; rooftop units: sorted just behind the unit.
          const parent = onRoof ? this.layers.entities : this.root;
          if (this.ring.parent !== parent) parent.addChild(this.ring);
          this.ring.zIndex = pos.key - 1;
          this.ring.position.set(pos.x, pos.y - (onRoof ? pos.lift : 0));
          this.ring.visible = true;
          // Ally chevron above the head (bobs 1 px).
          const head = u.type === 'tank' || u.type === 'heli' ? 40 : u.type === 'humvee' ? 30 : 26;
          const bob = Math.floor(now * 3) % 2;
          setTex(this.pip, allyPipTexture());
          this.pip.position.set(pos.x, pos.y - pos.lift - head - bob);
          this.pip.visible = true;
        }
        const r = u.def.attack?.range ?? 0;
        const rt = r >= 1.5 ? ringTexture(r) : null;
        if (rt) {
          setTex(this.range, rt);
          this.range.position.set(pos.x, pos.y);
          this.range.visible = true;
        }
      }
    }
    // Waypoint flag.
    const wc = art.has('ui.waypoint') ? art.anim('ui.waypoint') : null;
    if (wc && now < this.waypointUntil) {
      this.waypoint.visible = true;
      const f = Math.min(wc.frames.length - 1, Math.floor((now - this.waypointT) * wc.fps));
      setTex(this.waypoint, wc.frames[f]!);
    } else this.waypoint.visible = false;
  }

  private showCross(x: number, y: number): void {
    setTex(this.cross, crossTexture());
    this.cross.position.set(Math.round(x), Math.round(y));
    this.cross.visible = true;
  }

  /** Rooftop deploy: highlight every free rooftop; the hovered building in hi-vis / red. */
  private updateRoofs(st: OverlayState, now: number): void {
    const w = this.world;
    const unit = st.deploy!;
    const map = w.map;
    let hovered = -1;
    if (st.hasHover && w.nav.inBounds(st.hoverI, st.hoverJ)) {
      hovered = map.building[st.hoverJ * map.w + st.hoverI] ?? -1;
    }
    const pulse = 0.75 + 0.25 * Math.sin(now * 6);
    for (const b of map.buildings) {
      if (!b.rooftop) continue;
      const free = (w.roofUnit[b.id] ?? -1) < 0;
      const isHover = b.id === hovered;
      if (!free && !isHover) continue;
      let style: RoofStyle = 'valid';
      if (isHover) {
        const chk = w.canDeploy(unit, b.i, b.j);
        style = chk.ok || chk.reason === 'hate' ? 'target' : 'invalid';
      }
      const s = this.roofMark(b.id, style);
      if (s) s.alpha = isHover ? 1 : pulse;
      if (isHover && style === 'invalid') {
        const roof = this.deps.roof(b.id);
        if (roof) this.showCross(roof.x, roof.y - roof.top - 2);
      }
    }
    // Ghost on the hovered roof.
    if (hovered < 0) return;
    const bd = map.buildings[hovered];
    const roof = this.deps.roof(hovered);
    if (!bd?.rooftop || !roof) return;
    const chk = w.canDeploy(unit, bd.i, bd.j);
    const g = ghostTexture(unit, chk.ok);
    if (!g) return;
    setTex(this.ghost, g);
    if (this.ghost.parent !== this.layers.entities) this.layers.entities.addChild(this.ghost);
    this.ghost.alpha = 0.75;
    this.ghost.position.set(roof.x, roof.y - roof.top);
    this.ghost.zIndex = roof.frontKey + 2;
    this.ghost.visible = true;
  }
}
