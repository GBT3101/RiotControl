# M8 — status handoff (world view & game feel)

Typecheck clean, `npm run lint` clean, `npx vitest run` 41 files / 2446 tests green, build OK,
`tools/smoke.mjs` passed (before the last audio wiring). `npm run shots` was running at handoff
(background) — re-run it. Nothing committed since the orchestrator's WIP checkpoint e1ab403.

## 1. DONE
**Lazy art boot** (`src/game/assets/`)
- `jobs.ts` — pure art jobs run in Web Workers: `units`, `fx` (FX + markers + cursors + props +
  decals), `uikit`, `vehicles`, `protesters` (type list + variant index range [from,to)),
  `buildings` (paintBuilding → depth pieces + lit-window pieces + trimmed shadow; part/parts),
  `capitol` (given damage states), `landmarks` (that city's secondary landmarks only), `terrain`
  (16×16-tile chunks composited to RGBA, 4 frames if water). Each job packs its own atlas with
  `packSprites` (new, DOM-free, in `art/lib/atlas.ts`) → main thread `installPacked` (BufferImage
  textures, merged into global `art` via `Art._merge`). `buildArt`/gallery API unchanged.
- `loader.ts` — worker pool (= hardwareConcurrency, ≤6), longest-first, inline fallback, worker
  version probe; `cache.ts` — IndexedDB cache of job results keyed by hashed worker URL (prod only).
- `index.ts` — `criticalJobs` (units, fx, 8 variants/type of early protesters, capitol state 0,
  landmarks, buildings×3, terrain×5) vs `deferredJobs` (vehicles, uikit, capitol 1–4, remaining
  variants, crazy/cultist/prophet). Views tolerate missing deferred art (`onArtUpdated`).
- `game/loading.ts` loading screen (logo glint 12 fps, hazard bar, tip from `game/tips.ts`).
- Boot (`game/boot.ts`): stage → loading → critical art → World → debug setup/skip →
  GameController → deferred art in background → `dataset.ready` after deferred art.

**View** (`src/view/`): `layers.ts` (stack, see header), `depth.ts` (footprint → square g×g
pieces, front-strip assignment H=∞, `pieceDepthKey`), `terrainView.ts`, `staticView.ts`
(buildings/landmarks/capitol pieces, lights, shadows, props incl. lamp pools, capitol state +
overlays incl. Big Ben hands from game clock, chunk buckets detached off-screen),
`protesterView.ts` (pooled crowd, `VariantTable`, anim choice from PANIM/PS, lastAtk sync, hit/
door/flash/heave/climb/roof, prophet windup near units, LOD, red ghosts capped 40),
`unitView.ts` (humans/rooftop/brigade/blockade/humvee/tank/heli, blue ghosts, `pick`, `muzzle`),
`bodyView.ts` (state-driven from sim body ring; death anims, thrown-sniper arc, horse flee, KO
stars, blood + splat decals, trample dust, cap → bake into decal RT, wrecks), `combatView.ts`
(projectiles, gas clouds/fire areas, tracers/pellets, explosions, shake/hit-stop),
`fx.ts` (pooled FX, per-layer pools, lightGain), `decalLayer.ts` (map-sized RT),
`juice.ts` (shake, hit-stop, Hate fists → `hateTarget`, `onArrive`), `overlays.ts` (deploy tile
glow + ghost, selection/range ring, waypoint), `ambient.ts` (parked cars that burn/flip with
escalation, sirens, pigeons scatter, litter), `daylight.ts` (tod → tint/darkness/hour),
`occlusion.ts` (tile occlusion grid for silhouettes), `worldView.ts` (orchestrator + grade).

**Game** (`src/game/`): `controller.ts` (API below), `events.ts` (GameEventMap), `input.ts`
(keys), `debugHud.ts`, `params.ts`, `quality.ts`, `scenes.ts` (debug scenes). `main.ts` boots the
game; `?demo=1` keeps the M1 demo (dynamic import). M11 audio wired in `boot.ts: wireAudio`.

**M7 remainder (sim)**: rally points (`sim/rally.ts`, PS.RALLY/GATHER, `crowd.district`,
`BALANCE.rally*`), rooftop units fight climbers on their roof (`unit/basic.ts defendRoof`),
commandables avoid each other + never stack on arrival (`unit/common.ts`).
**Tests**: `tests/game-m7`, `game-assets`, `view-depth`, `view-daylight` (incl. occlusion).
**Screens**: `docs/progress/m8-*.png` (11 curated: 3 cities day/golden/night, phone landscape &
portrait, climbers, deploy mode, loading).

## 2. IN PROGRESS (exact state)
- Audio wiring just added (`wireAudio`, `controller.onSimEvents`, `?mute`): typechecks/lints;
  NOT yet verified in a browser run (shots/smoke not re-run after it).
- `npm run shots` was running; check it exits 0 (20 s ready timeout; phone viewports are slow in
  SwiftShader — if it times out, it's the shot tool's 20 s limit, not a crash).

## 3. REMAINS (prioritized)
1. Re-run gates + `npm run shots` + `node tools/smoke.mjs` after the audio wiring.
2. Write `docs/M8.md` (architecture, controller API, event list, perf, debug params) — not done.
3. Overlay polish (M9 may take): tile highlights/waypoint draw over buildings; rooftop deploy
   highlight should mark roofs; range ring only for range ≥1.5.
4. Ghosts: enemy silhouettes still smear when a whole crowd is behind a block (cap 40, alpha .22);
   a crisp group silhouette needs a depth/stencil approach (ColorMatrixFilter bled/blurred — dropped).
5. First-visit boot ≈3.0–3.4 s in this 4-core SwiftShader sandbox (target <3 s); cached reload
   ≈0.6 s. Further: smaller critical set, terrain JIT warmup per worker.
6. Optional: chimney smoke, health bars, heli bank poses, building fade near selection.

## 4. Key decisions / gotchas / APIs
- Depth: entities `depthKey(x,y)`; buildings/capitol/landmarks are split into square sub-boxes
  (g = gcd(w,d)), pixels assigned to the FRONT sub-box per screen x (H=∞), sorted with
  `pieceDepthKey`. Rooftop units/on-roof protesters use `roof.frontKey + n`.
- Pixi only applies `defaultAnchor` at construction → always swap textures via `view/sprites.setTex`.
- Grade: container tint on terrain/decals/bodies; per-sprite tint in entities (lit windows/lamps
  must stay untinted and sort with their piece); people get grade mixed 30% toward white.
- Additive lights: scale by darkness (`fx.lightGain`), fire glows capped 12 — overlapping additive
  pools wash out to white otherwise.
- View clock `WorldView.now` is monotonic (after victory/defeat alpha keeps cycling).
- Gas/fire puff timing derives from area age (correct after skip/pause).
- Controller API (M9): `beginDeploy(unit|null)`, `deployAt(i,j)`, `deployOptions()`, `select(id)`,
  `commandTo(i,j)`, `useAbility(id)`, `useAllAbilities()`, `startWaves()` (prep → waves, breather →
  call early), `callNextWaveEarly()`, `setPaused/togglePause/setSpeed/cycleSpeed`, `cancel()`,
  `tap(TapEvent)`, `hover(info)`, `tapTile(i,j)`, `focusTile(i,j)`, `setHateTarget(x,y)` (UI px),
  `hud(): HudSnapshot`, `bus` (sim events + `hatePickupArrived deployModeChanged deployFailed
  selectionChanged pauseChanged speedChanged timeOfDay gameOver ready artComplete`), `perf`,
  `onFrame`, `onSimEvents`, `keepPlacing`. Touch deploy = tap to preview, tap same tile to confirm.
- Debug params (`game/params.ts`): `city seed mapSeed autoplay t stress level hate wave tod quality
  zoom u v focus=crowd|climb|gas|units scene=showcase|climb|gas freeze debug hud=0 nocache mute demo`.
  Good mid-battle shot: `?city=london&autoplay=1&t=55&level=8&hate=4000&wave=15&focus=crowd&hud=0&zoom=3`.
- `window.__riot` = {stage, game, world, map, camera, input, loop, view, timings, overlay};
  `view.timing` per-sub-view ms. Probe scripts (playwright: fps, CDP profile, eval, interaction,
  loading shot) live in the scratchpad, not the repo.
- Perf (SwiftShader, 1440×900): GPU-bound 3–8 fps (main thread ~90% idle). JS per frame at
  3000 crowd/~1000 drawn: view 3.4–5.4 ms (protesters 1.4–2.9), Pixi render JS 4.5–6.9 ms, sim
  ≈2 ms/tick. Normal battle (~400 crowd): view 3.5, render 4.4. Off-screen static buckets are
  detached to keep the per-frame entity sort small.
- Quality tiers: desktop/mobile/low → sim concurrency cap, protester variants (all/12/8),
  FX budget (900/400/220), body cap (600/300/150), ghosts off on low.

## 5. Status
typecheck ✓ · lint ✓ · vitest 2446/2446 ✓ · build ✓ · smoke ✓ (pre-audio) · shots: re-run.
Known issues: see §3 items 3–5; Paris/Madrid crowds die fast vs the autoplay bot (use lower level).
