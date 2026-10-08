/**
 * M1 end-to-end demo scene: baked terrain, stub buildings, ~50 walking officers (depth
 * sorted), a fully working camera, tap/hover tile cursors and the debug overlay.
 */
import { Sprite } from 'pixi.js';
import { FixedStepLoop, TIME_SCALES, lerp } from '../core/loop';
import { boxDepthKey, depthKey, mapWorldBounds, tileToWorld, type Facing } from '../core/iso';
import { art } from '../art/lib/atlas';
import { stubBoxName } from '../art/buildings/stubBoxes';
import { COP_SKINS } from '../art/characters/riotCop';
import { Camera, applyToContainer } from '../render/camera';
import { CameraController } from '../render/cameraInput';
import { DebugOverlay } from '../render/debugOverlay';
import { createLayers } from '../render/layers';
import type { PixelStage } from '../render/stage';
import { ChunkedTerrain } from '../render/terrain';
import { uiScale, zoomRange } from '../render/zoom';
import { generateTestMap, testMapTileName } from './testMap';
import { WalkerSim } from './walkers';

export interface SceneParams {
  seed: number;
  cops: number;
  /** Optional fixed zoom (device px per world px). */
  zoom?: number;
  /** Optional camera centre in tile coords. */
  camU?: number;
  camV?: number;
  debug: boolean;
}

export function readSceneParams(search: string): SceneParams {
  const q = new URLSearchParams(search);
  const num = (k: string): number | undefined => {
    const v = q.get(k);
    if (v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    seed: num('seed') ?? 7,
    cops: Math.max(0, Math.min(2000, num('cops') ?? 50)),
    zoom: num('zoom'),
    camU: num('u'),
    camV: num('v'),
    debug: q.has('debug'),
  };
}

function prefixFor(variant: number): string {
  return variant === 0 ? 'unit.riot' : `unit.riot.v${variant}`;
}

export function startTestMapScene(stage: PixelStage, params: SceneParams): void {
  const layers = createLayers(stage.app.stage);
  const map = generateTestMap(params.seed);

  // Terrain.
  const terrain = new ChunkedTerrain(stage.app.renderer, {
    tilesU: map.size,
    tilesV: map.size,
    tileTexture: (i, j) => art.tex(testMapTileName(map, i, j)),
  });
  terrain.bakeAll();
  layers.terrain.addChild(terrain.container);

  // Buildings + cast shadows.
  for (const b of map.buildings) {
    const p = tileToWorld(b.i, b.j);
    const shadow = new Sprite(art.tex(`bld.stub.shadow.${b.n}x${b.storeys}`));
    shadow.position.set(p.x, p.y);
    layers.decals.addChild(shadow);
    const box = new Sprite(art.tex(stubBoxName(b.style, b.n, b.storeys)));
    box.position.set(p.x, p.y);
    box.zIndex = boxDepthKey(b.i, b.j, b.n);
    layers.entities.addChild(box);
  }

  // Officers.
  const sim = new WalkerSim(map, params.cops, params.seed, COP_SKINS.length);
  const copSprites = sim.walkers.map((w) => {
    const s = new Sprite(art.tex(`${prefixFor(w.variant)}.idle.se`));
    layers.entities.addChild(s);
    return s;
  });

  // Cursors.
  const hover = new Sprite(art.tex('ui.cursor.hover'));
  const tapMark = new Sprite(art.tex('ui.cursor.tap'));
  hover.visible = tapMark.visible = false;
  layers.overlays.addChild(hover, tapMark);
  let tapTime = -10;

  // Camera.
  const camera = new Camera();
  const b = mapWorldBounds(map.size, map.size);
  const margin = 48;
  camera.setBounds({
    minX: b.minX - margin,
    minY: b.minY - margin,
    maxX: b.maxX + margin,
    maxY: b.maxY + margin,
  });
  stage.onResize((size) => {
    camera.setViewport(size.width, size.height, zoomRange(size.width, size.height));
    layers.ui.scale.set(uiScale(Math.min(size.cssWidth, size.cssHeight), size.dpr));
  });
  if (params.zoom) camera.zoom = camera.targetZoom = Math.round(params.zoom);
  const c = tileToWorld(params.camU ?? map.size / 2, params.camV ?? map.size / 2);
  camera.centerOn(c.x, c.y);

  const input = new CameraController(stage.canvas, camera);
  const overlay = new DebugOverlay(document.body, params.debug);
  let lastTap = '—';
  const inMap = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < map.size && j < map.size;
  input.events.on('tap', (e) => {
    lastTap = `${e.i},${e.j} (${e.pointerType} b${e.button})`;
    if (!inMap(e.i, e.j)) return;
    const p = tileToWorld(e.i, e.j);
    tapMark.position.set(p.x, p.y);
    tapMark.visible = true;
    tapTime = loop.simTime;
  });
  input.events.on('hover', (h) => {
    if (!h || !inMap(h.i, h.j)) {
      hover.visible = false;
      overlay.set('tile', '—');
      return;
    }
    const p = tileToWorld(h.i, h.j);
    hover.position.set(p.x, p.y);
    hover.visible = true;
    overlay.set('tile', `${h.i},${h.j}  world ${h.worldX.toFixed(0)},${h.worldY.toFixed(0)}`);
  });
  input.events.on('dragStart', () => (hover.visible = false));

  // Game-speed keys (PLAN §1.7): Space pause, F cycles 1×/2×/3×.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      loop.paused = !loop.paused;
      e.preventDefault();
    } else if (e.code === 'KeyF') {
      const i = TIME_SCALES.indexOf(loop.timeScale as (typeof TIME_SCALES)[number]);
      loop.timeScale = TIME_SCALES[(i + 1) % TIME_SCALES.length]!;
    }
  });

  let firstFrame = true;
  const loop = new FixedStepLoop({
    update: (dt) => sim.step(dt),
    render: (alpha, frameDtMs) => {
      const dt = frameDtMs / 1000;
      input.update(dt);
      camera.update(dt);
      const view = camera.view();
      applyToContainer(layers.world, view);
      const chunks = terrain.cull(view);
      const t = (loop.tick + alpha) * loop.stepSeconds;

      sim.walkers.forEach((w, k) => {
        const s = copSprites[k]!;
        const u = lerp(w.pu, w.u, alpha);
        const v = lerp(w.pv, w.v, alpha);
        const p = tileToWorld(u, v);
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        const facing: Facing = w.facing;
        const moving = w.idle <= 0 && (w.du !== 0 || w.dv !== 0);
        const name = moving
          ? `${prefixFor(w.variant)}.walk.${facing}`
          : `${prefixFor(w.variant)}.idle.${facing === 'ne' ? 'se' : facing === 'nw' ? 'sw' : facing}`;
        const clip = art.anim(name);
        s.texture = clip.frames[clip.frameAt(t + w.phase)]!;
        s.position.set(x, y);
        s.zIndex = depthKey(x, y);
      });
      if (tapMark.visible) {
        const clip = art.anim('ui.cursor.tap');
        tapMark.texture = clip.frames[clip.frameAt(loop.simTime - tapTime)]!;
        if (loop.simTime - tapTime > 3) tapMark.visible = false;
      }

      stage.app.render();
      overlay.frame(frameDtMs);
      if (overlay.shown) {
        overlay.set(
          'zoom',
          `${camera.zoom.toFixed(2)} (target ${camera.targetZoom}, ${camera.range.min}-${camera.range.max})`,
        );
        overlay.set('cam', `${view.x},${view.y}`);
        overlay.set('view', `${view.width}x${view.height} dev px  dpr ${stage.size.dpr}`);
        overlay.set('sim', `tick ${loop.tick}  x${loop.timeScale}${loop.paused ? ' PAUSED' : ''}`);
        overlay.set(
          'ents',
          `${sim.walkers.length} cops  ${map.buildings.length} bldgs  ${chunks}/${terrain.chunkCount} chunks`,
        );
        overlay.set('tap', lastTap);
      }
      if (firstFrame) {
        firstFrame = false;
        document.documentElement.dataset.ready = 'true';
      }
    },
  });
  loop.start();

  // Handle for tools / console debugging.
  (window as unknown as { __riot: unknown }).__riot = {
    stage,
    camera,
    loop,
    map,
    sim,
    input,
    overlay,
  };
}
