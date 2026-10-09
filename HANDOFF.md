# RIOT CONTROL — Handoff / Status Log

Live status of the project. Read `PLAN.md` first (design, art bible, architecture, milestones).
Update this file at the end of every milestone.

## Current status

| Milestone                      | Status            | Notes                                                                                                                                                                                                                                           |
| ------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Plan & handoff              | ✅ done           | PLAN.md, HANDOFF.md, CLAUDE.md                                                                                                                                                                                                                  |
| M1 Foundation & pipelines      | ✅ done           | Vite/TS/Pixi 8 scaffold, core (loop/rng/events/iso), pixel-perfect stage + camera, art pipeline (palette, grids, paper-doll, atlas), gallery, shots/smoke tools, 72×72 test map with 50 officers, CI + Pages. Screens: `docs/progress/m1-*.png` |
| M2 City blueprints             | ✅ done           | Madrid 72×72, London 80×72, Paris 72×72 blueprints → `loadMap(city)`; validators; `maps.html` viewer. Docs `docs/M2.md`                                                                                                                         |
| M3a Environment art            | ✅ done           | `groundTile`, `paintBuilding`, `propSprite`, `decalSprite`, city previews. Docs `docs/art/M3a.md`                                                                                                                                               |
| M3b Capitols & landmarks art   | ✅ done           | 3 capitols × 5 damage states, 16 landmarks, overlays (flags/fire/smoke/Big Ben hands). Docs `docs/art/M3b.md`                                                                                                                                   |
| M4a Ministry units art         | ✅ done           | 8 units, full anims, blockade, portraits; `unitAnimMeta()` catalog. Docs `docs/art/M4a.md`                                                                                                                                                      |
| M4b Protesters art & variation | ✅ done           | paper-doll variants for 9 types, `buildProtesterSheets()`. Docs `docs/art/M4b.md`                                                                                                                                                               |
| M4c Vehicles art               | ✅ done           | humvee, tank, heli (8 dirs), 23 decor vehicles; `meta.ts` offsets. Docs `docs/art/M4c.md`                                                                                                                                                       |
| M5 FX & UI kit art             | ✅ done           | FX, fonts + text API, 9-slice panels, cards, meters, Minister, logo, newspapers. Docs `docs/art/M5.md`                                                                                                                                          |
| M6 Simulation core             | ✅ done           | deterministic SoA sim, flow fields, combat, economy, director, most M7 specials. Docs `docs/M6.md`                                                                                                                                              |
| M7 Behaviours                  | ✅ done (M6 + M8) | rally points, rooftop defence, unit avoidance                                                                                                                                                                                                   |     |
| M8 Integration & game feel     | ✅ done           | lazy worker art + IndexedDB cache, map rendering, depth slicing, views, FX, juice, day/night, controller API. Docs `docs/M8.md`                                                                                                                 |
| M9 UI/UX & screens             | ✅ done           | title over live city, city select, HUD, deploy bar, minimap, moments, advisor API, newspapers + ledger, settings. Docs `docs/M9.md`                                                                                                             |
| M10 Tutorial, hints & writing  | ✅ done           | 9-step Minister briefing, hints, copy in `src/ui/text/`. Docs `docs/M10.md`                                                                                                                                                                     |
| M11 Audio                      | ✅ done           | procedural SFX/crowd/music, wired via `boot.ts wireAudio`. Docs `docs/M11.md`                                                                                                                                                                   |
| M12 Balance                    | ✅ done           | bots + `npm run playtest`; balanced wins 33–39 min, passive loses ~wave 10, peak crowd ~2300–2450. Docs `docs/M12.md`                                                                                                                           |
| M13 Performance & polish       | ✅ done           | M13a art polish (`docs/art/*`), M13b UX/perf/mobile/soak (`docs/M13b.md`)                                                                                                                                                                       |
| M14 Release                    | ✅ done           | silhouette sub-uploads (title view 4.86 → 0.95 ms/frame), gas look + gas debug scene, sub-path deploy check, README + `docs/screenshots/`, final handoff (see _M14 notes_)                                                                      |

## How to run

Node 22. `npm ci`, then:

| Command                                                                                       | What                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                                                                 | Vite dev server — game at `/`; dev pages `/gallery.html`, `/maps.html`, `/audio.html`                                                                                                                                      |
| `npm run gallery`                                                                             | dev server opening the sprite gallery                                                                                                                                                                                      |
| `npm run build` / `npm run preview`                                                           | static build into `dist/` (`base: './'` — works from any sub-path, e.g. GitHub Pages `/<repo>/`) / serve it                                                                                                                |
| `npm run typecheck` · `npm run lint` · `npm test`                                             | tsc strict · ESLint (flat, typescript-eslint) · Vitest (Node, ~25 s)                                                                                                                                                       |
| `npm run check`                                                                               | all four gates (typecheck, lint, test, build) — what CI runs                                                                                                                                                               |
| `npm run shots`                                                                               | build + headless Chromium screenshots → `shots/` (gitignored): game @ 1440×900, 844×390@3x (touch), 390×844@3x (touch) + gallery. Exit 1 on any console error.                                                             |
| `node tools/shoot.mjs --page gallery --query group=units --out units`                         | custom shot. Flags: `--page game\|gallery`, `--query`, `--viewport desktop\|phone-landscape\|phone-portrait\|WxH` (repeatable), `--dpr`, `--out`, `--wait ms`, `--full/--no-full`, `--clip x,y,w,h`, `--no-build`, `--dev` |
| `npm run sprites -- --filter riot --scale 10 [--sheet] [--group units] [--bg light\|checker]` | **fast art loop, no browser**: exports registered sprites to `shots/sprites/*.png`                                                                                                                                         |
| `npm run smoke`                                                                               | interaction smoke test on `dist/` (drag, wheel, tap vs drag, keys, touch tap, CDP pinch, device-pixel canvas, no page scroll)                                                                                              |
| `npm run playtest`                                                                            | headless bot games (cities × strategies) → balance report (`docs/M12.md`)                                                                                                                                                  |
| `npm run soak`                                                                                | Playwright soak: full games, UI flows, perf probes, touch audit (`--only flows\|games\|perf\|touch`, `docs/M13b.md`)                                                                                                       |
| `npm run icons`                                                                               | regenerate `public/icons/*` from the in-code officer portrait                                                                                                                                                              |

Deploy: `.github/workflows/pages.yml` builds and publishes `dist/` on every push to `main`
(repo Settings → Pages → Source: **GitHub Actions**). `ci.yml` runs typecheck, lint, test and
build on every push / PR.

Game query params (full list `docs/M8.md` §7, `docs/M9.md`): `city`, `autoplay=1&t=SECONDS`,
`level/hate/wave/legit`, `tod=0..1`, `zoom/u/v/focus=crowd|gas|climb|units`,
`scene=showcase|gas|climb`, `moment=levelup|victory|defeat|…`, `freeze`, `stress=N`,
`tutorial=0&hints=0&mute`, `nocache`, `quality=low|mobile|desktop`. Marketing-shot recipes: see
_M14 notes_ below. Gallery params: `?group=…`, `?filter=<substr>`, `?bg=light`, `?scale=6`,
`?frame=0` (freeze), `?anchor`.
In game: drag / wheel / pinch / WASD+arrows / `+`; `1`–`0`, `-` deploy; `G` gas; Enter waves;
Space pause; F speed; M mute; Tab minimap; `` ` `` debug overlay.
`window.__riot` exposes `{stage, ui, game, world, camera, view, timings, …}`; pages set
`document.documentElement.dataset.ready = 'true'` once ready (tools wait for it).

## Code map (M1)

- `src/core/` — `loop.ts` (fixed 30 Hz, alpha, time scale, pause, spiral cap), `rng.ts` (sfc32: `int/range/chance/pick/weighted/shuffle/fork/getState`), `events.ts` (typed `EventBus`), `iso.ts` (tile↔world↔screen, `inTileDiamond`, `depthKey`, `boxDepthKey`, facings).
- `src/render/` — `stage.ts` (device-pixel canvas, DPR/resize), `zoom.ts` (zoom policy), `camera.ts` (pure camera), `cameraInput.ts` (pointer/touch/wheel/keys → camera; `tap`/`hover` events), `layers.ts`, `terrain.ts` (chunked RT baking + culling), `debugOverlay.ts`.
- `src/art/` — `palette.ts`, `lib/{pixels,grid,paperdoll,painter,registry,packer,atlas,dom}.ts`, `index.ts` (`createArtRegistry()` — every art module registers here), stub art: `characters/riotCop(.grid).ts`, `tiles/stubTiles.ts`, `buildings/stubBoxes.ts`, `ui/cursors.ts`.
- `src/demo/` — M1 test map (`testMap.ts`), patrol sim (`walkers.ts`), scene wiring (`testMapScene.ts`). M2/M8 replace this; `src/main.ts` boots it.
- `src/gallery/` — gallery page. `tools/` — `shoot.mjs`, `smoke.mjs`, `export-sprites.mjs`, `lib/png.mjs`. `tests/` — vitest suites incl. `palette-compliance.test.ts`.

## Art pipeline API (quick reference for M3–M5)

**Rules**: RIOT-64 colours only (test-enforced); only the `shadow` swatch may be semi-transparent (key `%`, ≈45% alpha) and the sprite must set `hasShadow: true`. Light from upper-left. Outline with `'ink'` (or a ramp's darkest). Look at your output: `npm run sprites -- --filter <name> --scale 10`, then the gallery / `npm run shots`.

**Palette** (`src/art/palette.ts`): `SWATCHES` (64 named colours), `RAMPS` (named, darkest→lightest, share swatches). Colour refs everywhere: `'ink'` (swatch), `'navy.2'` (ramp step), `'navy.-1'` (lightest), `'$hair.1'` (semantic slot, resolved per variant). `resolveColor(ref)`, `rampSwatch(ramp, step)`, `SHADOW`, `SHADOW_ALPHA`, `INK`.

**Grids** (`lib/grid.ts`): rows of 1-char keys, `.` transparent, `%` shadow; leading indentation ignored; frames separated by blank lines. Put big grids in `*.grid.ts` files (Prettier-ignored).

```ts
const KEYS = { o: 'ink', N: 'navy.2', S: '$skin.1' };
grid(src, KEYS, { slots: { skin: 'skin4' } }); // → PixelBuffer
sheet(src, KEYS, opts); // → PixelBuffer[] (multi-frame)
keyGrid(src) / keyFrames(src) / renderKeys(g, KEYS, opts) / blankFrames(w, h, n);
```

**Pixels** (`lib/pixels.ts`, DOM-free `PixelBuffer {w,h,data}`): `createBuffer, blit` (palette-safe: no blending), `mirrorX, mirrorAnchor, pad, crop, outline(buf, rgba|fn, {corners, sides}), recolour, silhouette, opaqueBounds`.

**Paper-doll** (`lib/paperdoll.ts`) — base frames + parts attached to per-frame named anchors, `z` order (<0 behind body), semantic slots:

```ts
composeDoll(
  { frames: blankFrames(13, 18, 6), keys: {}, anchors: { body: [{x:0,y:0}, {x:0,y:1}, …], legs: {x:0,y:13} } },
  [{ frames: keyFrames(LEGS), keys: K, attach: 'legs', z: 0 },
   { frames: keyGrid(HAIR), keys: { H: '$hair.1' }, attach: 'head', origin: {x:3,y:4}, z: 2, hiddenOn: [3] }],
  { slots: { skin: 'skin3', hair: 'dyePink' } },
  { margin: 1, outline: 'ink' },
);
pickSlots(rng, { hair: ['dyePink', 'hairBlonde'], skin: ['skin1', …] })   // seeded variant
outline(buf, 'ink') · recolourRefs(buf, { 'navy.2': 'olive.2' }) · mirrorFrames · padFrames · remapKeys
```

For thousands of protesters (M4b): roll N variants per type with `pickSlots` + `composeDoll`, register them (or build a separate atlas with `buildArt(reg, 2048, createArt())`) and assign variants to crowd members by seed.

**Painters** (`lib/painter.ts`, large surfaces only): `latticeTile(patch16x16)` (seamless 32×16 tile from a 16×16 lattice patch), `diamondTile(fn)`, `onDiamondEdge`, `stampInDiamond`, `isoBox({ n, height, wall, roof, rim, storeyH, modules })` (shaded box, windows sheared onto faces; roof = ramp | patch | `(x,y)=>rgba`), `boxShadow(n, h)`.

**Registry** (`lib/registry.ts`) — register in your module's `registerX(reg)` and call it from `src/art/index.ts`:

```ts
reg.add('unit.riot.walk.se', {
  group: 'units',
  frames,
  fps: 10,
  anchor: { x: 7, y: 17 },
  hasShadow: true,
  mirrorAs: 'unit.riot.walk.sw',
});
```

Naming: `<category>.<subject>.<anim>.<facing>` (`unit.*`, `prot.*`, `veh.*`, `tile.*`, `bld.*`, `prop.*`, `fx.*`, `ui.*`). Groups = gallery sections. **Anchor = pixel index** (x, y) that sits on the entity's world position (feet/ground contact; tiles: `{x:16,y:0}` = diamond top vertex; buildings: footprint top vertex). Default anchor: bottom-centre. Mirroring keeps the anchor column (`x' = w-1-x`).

**Runtime** (`lib/atlas.ts`): `buildArt(createArtRegistry())` once at boot packs everything (shelf packer, 2048² pages, nearest). Then `art.tex('tile.grass')` → `Texture` (anchor preset — just `new Sprite(tex)` at integer world coords) and `art.anim('unit.riot.walk.se')` → `{ frames, fps, loop, anchor, frameAt(t) }`.

**Tile geometry**: 32×16 diamonds tessellate exactly with row widths 2,6,…,30,30,…,2 (`inTileDiamond`). Tile (i,j) top vertex at world `((i−j)·16, (i+j)·8)`. Storey = 10 px.

## Decisions log

- 2026-10-08 — Owner choices: waves + Capitol HP (losable), large pannable maps, procedural audio, cartoon blood.
- 2026-10-08 — Stack: TypeScript + Vite + PixiJS v8 + Vitest + Playwright. All art generated in code at boot from hand-authored pixel grids/modules.
- 2026-10-08 — OSM APIs are blocked by the sandbox; city layouts come from geographic knowledge (the brief only asks for the knowledge).
- 2026-10-08 — Religious extremists/Prophets are a **fictional** doomsday cult ("The Order of the Final Hour"), not a real religion.
- 2026-10-08 — "Machine gun hammers" interpreted as **Humvees** with a roof-mounted MG.
- 2026-10-08 (M1) — **Zoom = device pixels per world pixel**, integer at rest. The canvas backing store is exact device pixels (`devicePixelContentBoxSize`, sanity-checked against css×dpr because headless emulation misreports it), Pixi resolution 1 → square, uniform pixels on any DPR. Default zoom = round(longer side / (22 tiles × 32 px)) → 1440×900@1x: 2, 1920×1080@1x: 3, iPhone 844×390@3x: 4 (same in portrait — rotation-stable). Range = 5 integer levels [min, min+4], min keeps ≤48 tiles across. (PLAN's "3× desktop / 2× phones" was in CSS-px terms; the ~22-tiles rule is what we implement.)
- 2026-10-08 (M1) — Zoom eases through fractional scales for ~150 ms (wheel/keys) and follows fingers fractionally while pinching; it always settles on an integer. Camera centre snaps to whole world pixels.
- 2026-10-08 (M1) — UI scale = round(dpr × (2 CSS px, or 3 when the short side ≥ 720 CSS px)) device px per UI pixel (`render/zoom.ts: uiScale`).
- 2026-10-08 (M1) — RIOT-64 draft: 64 swatches in families (violet-greys, zinc, stone, earth/skin ladder, ochre, rust, crimson, plum/pink, navy/blue, teal, greens, olive/hi-vis); 48 named ramps share them. `shadow` = `ink` @ 115/255. The palette is full — swap a swatch rather than add one (and re-run the compliance test).
- 2026-10-08 (M1) — Depth sort: entities use `depthKey(x, y)` (world foot y, then x); square building footprints use `boxDepthKey` — correct for anything outside the footprint. Non-square buildings must be split into square slices (M8). Building cast shadows are separate sprites in the `decals` layer.
- 2026-10-08 (M1) — Semi-transparent pixels never blend inside the art pipeline (`blit` only places shadow pixels on empty ones), so atlases stay palette-pure; blending happens only on the GPU.
- 2026-10-08 (M1) — Playwright: `playwright-core@1.56.1` pinned to match the pre-installed chromium-1194; launched with SwiftShader WebGL flags.
- 2026-10-08 — Values not in the brief (flagged for owner): Mounted Riot Police grants 15 Legitimacy; Helicopter grants none (it cannot die).

## Open questions for the owner

- M12: "cheap" (spam cheapest units) also wins — acceptable given the owner-fixed economy? Breathers lengthened to 16–24 s.
- Paris Capitol: Assemblée nationale (Palais Bourbon) assumed; Madrid: Congreso de los Diputados; London: Palace of Westminster.

## M14 notes (release)

- **Silhouette uploads** (`src/view/silhouette.ts`): `flushSilhouettes` now uploads only the
  rows written since the last flush (`BufferImageSource.update(start, end)` → one
  `texSubImage2D` of 1024 × rows) instead of the whole 4 MB page. Title attract probe
  (`node tools/soak.mjs --only perf`, 1440×900): view sub-timing `other` 4.02 → 0.14 ms/frame,
  view 4.86 → 0.95 ms, render 7.74 → 2.88 ms; stress probes unchanged.
- **Tear gas look**: in a real in-game cloud the puffs sorted behind every protester standing in
  them and used the grass/foliage ramp, so a cloud read as a few hedges at the crowd's edge.
  Now: pale sickly lime body with a cream-lit crown (`lime` / `stone5` / `green4` — nothing else
  in a city is that colour), 8–14 tighter puffs per cloud (one layered mass), GPU alpha 0.7 and a
  16 px depth lift so the gas envelops the people in it (`combatView.ts` `GAS_ALPHA/GAS_LIFT`).
  Before/after: `docs/progress/m14-gas-*.png`.
- **Gas debug scene**: `?scene=gas` throws 1 s before the end of the `?t` skip (cloud is fresh on
  the first frame for any `t`) and prefers a crowd position on open ground with nothing in front
  (falls back to the old pick). Shot: `?city=madrid&scene=gas&t=3.5&focus=gas&zoom=4&freeze&hud=0`.
- **Sub-path deploy check**: `dist/` served from `/RiotControl/` by a plain static server and
  driven by Playwright: no 404s, no console errors; 4 art workers load; IndexedDB
  `riot-control-art` filled on the cold visit (ready 9.2 s under SwiftShader) and the warm visit
  takes all 28 jobs from the cache (ready 1.0 s); manifest, `start_url`, icons and favicon
  resolve under the sub-path. `gallery.html`, `maps.html`, `audio.html` are kept in the build on
  purpose (they work under the sub-path) and are not linked from the game.
- **README.md** + **`docs/screenshots/`** (1440×900 unless noted): `title`, `london-night`,
  `paris-battle`, `madrid-battle`, `level-up`, `newspaper`, `ledger`, `crowd-closeup`,
  `phone-portrait` (390×844@3). Recipes (plus `&tutorial=0&hints=0&mute`):
  - battle: `?city=london&autoplay=1&stress=600&t=22&level=8&hate=2500&wave=14&focus=crowd&tod=0.75&zoom=3&freeze`
    (Paris `level=7&hate=1500&wave=12&tod=0.12`; Madrid `level=9&tod=0.4`; phone: same Madrid, no zoom)
  - level-up: London battle with `level=6&legit=499&tod=0.2&moment=levelup` (~1.5 s after ready)
  - newspaper / ledger: `?city=london&autoplay=1&t=1200&focus=crowd&moment=victory&tod=0.75` — the
    paper holds 3.2 s of UI time (shot it by pinning `ui.topScreen.phaseT` in the `hold` phase);
    ledger ~25 s later (Paris)
  - close-up: `?city=london&scene=showcase&hud=0&zoom=4&tod=0.15&freeze`

## Known issues

- GPU cost unmeasured (SwiftShader sandbox, 2–6 fps here); verify 60 fps and the quality
  governor on real hardware, especially mid-range phones at 3000 / 1500 protesters.
- Phone portrait near map edges still shows a sliver of void.
- Gas depth lift: a puff right behind a building corner can draw up to 16 px over its lower wall
  (reads as drifting gas; acceptable).
- Art debt: Cibeles/Neptune statues small; heli rotor doesn't tilt with bank; flat-roof
  single-pixel specks.
- Audio levels never had a listening pass on real speakers / phones.
- Owner questions still open (see above): "cheap" strategy also wins; Paris Capitol choice.

## Next steps / ideas

- Localisation: ES / FR UI and newspapers (copy already centralised in `src/ui/text/`).
- More cities (Rome, Berlin, Washington…) — blueprint format in `docs/M2.md`.
- Endless mode / daily seed with a leaderboard of "At what cost?" ledgers.
- Real-device GPU profiling pass; PWA offline cache (service worker) on top of the IndexedDB art cache.
- Listening pass on audio levels and the music mix.
- Replay / share card: export the ledger + newspaper as an image.

## Later / out of scope

_(ideas that are not in the brief go here)_
