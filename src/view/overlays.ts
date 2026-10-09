/**
 * World overlays driven by the controller's UI state: selection ring + range ring under the
 * selected unit, deploy-mode tile highlights (valid / invalid diamonds around the cursor),
 * the placement ghost (unit art remapped to the blue/red ghost ramp) and command waypoints.
 * Never colour-graded.
 */
import { Container, Sprite, Texture } from 'pixi.js';
import { art } from '../art/lib/atlas';
import { ghostTint, rangeRing } from '../art/fx';
import { createBuffer, type PixelBuffer } from '../art/lib/pixels';
import { bufferTexture } from '../art/uikit/pixi';
import { tileToWorld } from '../core/iso';
import { UNITS, type UnitId } from '../data/units';
import type { World } from '../sim/world';
import { setTex } from './sprites';
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

export class OverlayView {
  readonly root = new Container({ label: 'overlay-ui' });
  private readonly tiles: Sprite[] = [];
  private readonly ghost = new Sprite();
  private readonly ring = new Sprite();
  private readonly range = new Sprite();
  private readonly waypoint = new Sprite();
  private waypointT = -99;
  private waypointUntil = -99;

  constructor(
    private readonly world: World,
    parent: Container,
    private readonly unitPos: (id: number) => { x: number; y: number; lift: number } | undefined,
  ) {
    parent.addChild(this.root);
    this.ghost.alpha = 0.7;
    this.range.alpha = 0.9;
    this.root.addChild(this.range, this.ring, this.ghost, this.waypoint);
  }

  /** Show the command flag at tile (i, j). */
  flag(i: number, j: number, now: number): void {
    const p = tileToWorld(i + 0.5, j + 0.5);
    this.waypoint.position.set(Math.round(p.x), Math.round(p.y));
    this.waypointT = now;
    this.waypointUntil = now + 1.6;
  }

  update(st: OverlayState, now: number): void {
    const w = this.world;
    // Deploy mode: tile highlights around the cursor + ghost.
    let used = 0;
    this.ghost.visible = false;
    if (st.deploy && st.hasHover) {
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
              this.root.addChildAt(s, 0);
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
        let lift = 0;
        if (def.placement === 'air') lift = 40;
        this.ghost.position.set(Math.round(p.x), Math.round(p.y) - lift);
        this.ghost.visible = true;
      }
    }
    for (let k = used; k < this.tiles.length; k++) this.tiles[k]!.visible = false;
    // Selection + range ring.
    this.ring.visible = false;
    this.range.visible = false;
    if (st.selected >= 0) {
      const u = w.units.get(st.selected);
      const pos = this.unitPos(st.selected);
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
          this.ring.position.set(pos.x, pos.y - (u.type === 'heli' ? 0 : pos.lift));
          this.ring.visible = true;
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
}
