# Special skills — art & sound (playtest round 2)

Everything the integrator needs to show and hear the five new unit skills of `docs/specials.md`
(ram, rapid fire, frag grenade, tank missile, air strike) plus the shared ready cue / aim / paint
UI. Nothing here is wired to the sim yet: this doc is the API.

| Module                                       | What                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/art/fx/specials.ts`                     | `registerSpecials(reg)` — registration (called from `registerFx`)                                             |
| `src/art/fx/specialBlasts.ts`                | fireballs, ground flash, shock rings (any radius), debris, smoke, scorch / crater                             |
| `src/art/fx/specialShots.ts`                 | projectiles (frag, missile, rockets), rapid-fire flash / tracer / casings, ram dust / hoof / knock, `dir16()` |
| `src/art/fx/specialGuides.ts`                | world-space aim / paint painters: `ramLane`, `strikeLine`, `guideRing`, `reticle`                             |
| `src/art/fx/specialRecipes.ts`               | **composition recipes** → timed spawn lists for `FxSystem.spawn` (+ shake / hit-stop hints)                   |
| `src/art/uikit/specials.ts`                  | `registerSpecialUi(reg)` (called from `registerUiKit`): icons, ready cues, round buttons                      |
| `src/audio/sfx/specials.ts`, `specialIds.ts` | 18 procedural SFX, merged into `SFX` / `SFX_IDS`                                                              |

Gallery: `/gallery.html?filter=special` (FX in group `fx`, guides / icons in group `ui`).
Audio lab: `/audio.html` → fieldset **special skills** (every sound + ▶ sequences).
Progress shots: `docs/progress/specials-frag.png`, `specials-missile.png`, `specials-air.png`
(frame-by-frame at 1× and 3× over a real street).

All sprites are RIOT-64 pure (palette-compliance test), lit from the upper left, coloured outlines.
Anchors follow docs/art/M5.md: ground FX → ground point, projectiles → centre, overlays → as noted,
UI → top-left unless noted.

---

## 1. Sprite catalogue

### Ram (Mounted Riot Police)

| Name                                      | Size   | Frames @fps | Loop | Anchor                 | Use                                                                                                               |
| ----------------------------------------- | ------ | ----------- | ---- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `fx.special.ram.dust.e` / `.w`            | 30×18  | 7 @12       | no   | 18,15 / 11,15 (hooves) | gallop dust: rolling cloud + flung clods. `.e` when the horse heads screen-right. One every ~7 px of travel.      |
| `fx.special.ram.hoof`                     | 15×9   | 4 @16       | no   | 7,7                    | hoof-strike puff (ground layer), 3 per stride + a suspension beat                                                 |
| `fx.special.ram.knock.e` / `.w`           | 34×26  | 6 @14       | no   | 12,22 / 21,22 (feet)   | protester bowled aside: impact star at chest height → speed arcs → skid dust. `.e` = knocked toward screen-right. |
| `fx.ko.stars` (existing)                  | 25×13  | 6 @8        | yes  | 12,6 (head top)        | the KO after the knock — reused, fits the language                                                                |
| `ui.special.ram.lane.<se\|sw\|nw\|ne>`    | 137×75 | 4 @10       | yes  | the rider              | 6-tile lane along a tile axis, dashed hi-vis edges, chevron sweep, stop bar                                       |
| `ramLane(dx, dy, half = 0.5, frames = 6)` | any    | —           | —    | rider                  | **painter** for any heading / length (world px offset)                                                            |

### Rapid fire (Armed Cops)

| Name                                | Size   | Frames @fps | Loop | Anchor                        | Use                                                                                |
| ----------------------------------- | ------ | ----------- | ---- | ----------------------------- | ---------------------------------------------------------------------------------- |
| `fx.special.rapid.flash.<dir>`      | 23×23  | 3 @25       | no   | 11,11 (muzzle)                | hot star → small star + smoke curl → curl. dir = screen DIRS (e se s sw w nw n ne) |
| `fx.special.rapid.tracer.<dir>`     | ≤17×17 | 2 @20       | no   | head pixel                    | 15-px streak (hot → cooling dashes); move it from muzzle to target                 |
| `fx.special.rapid.casings.e` / `.w` | 30×22  | 20 @25      | no   | 9,19 / 20,19 (shooter's feet) | 5 casings ejected 3 frames (= 0.12 s) apart, spin, bounce, glint, rest             |

### Real grenade (Soldiers)

| Name                       | Size   | Frames @fps | Loop | Anchor              | Use                                                                                      |
| -------------------------- | ------ | ----------- | ---- | ------------------- | ---------------------------------------------------------------------------------------- |
| `fx.special.frag.grenade`  | 13×13  | 8 @20       | yes  | 6,6                 | olive pineapple frag; body keeps its light, fuse + spoon spin (≠ the zinc gas canister)  |
| `fx.special.frag.spoon`    | 13×13  | 6 @16       | no   | 2,9 (hand)          | spoon lever flicks off at the throw                                                      |
| `fx.special.frag.shadow`   | 7×4    | 1           | —    | 3,2                 | flight shadow (shadow swatch, `hasShadow`), ground layer, follows the grenade's x/y      |
| `fx.special.frag.flash`    | 75×41  | 3 @20       | no   | 37,20               | ground flash pancake: star → hollow ring → sparks (ground layer, emissive)               |
| `fx.special.frag.fireball` | 56×47  | 11 @16      | no   | 25,40 (ground zero) | flash → white-hot ball → banded fireball under a smoke cap → cap breaks up               |
| `fx.special.frag.ring`     | 100×50 | 6 @18       | no   | 50,25               | shock ring whose **last frame sits on the 2.2-tile lethal radius**, dust torus riding it |
| `fx.special.frag.scorch`   | 69×37  | 1           | —    | 34,18               | decal (`tags: ['decal']`)                                                                |
| `ui.special.frag.blast`    | 107×58 | 2 @4        | yes  | 53,29               | 2.2-tile kill-zone preview (optional: debug / tutorial)                                  |

### Big explosion (Tank)

| Name                                 | Size          | Frames @fps | Loop | Anchor              | Use                                                                                                                                   |
| ------------------------------------ | ------------- | ----------- | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `fx.special.missile.<0…15>`          | ≤20×20        | 2 @16       | yes  | missile centre      | missile, 16 screen directions (k·22.5°, 0 = east, clockwise); pick with `dir16(dx, dy)`                                               |
| `fx.special.missile.trail`           | 13×13         | 6 @14       | no   | 6,6                 | exhaust puff, drop one every ~0.035 s of flight                                                                                       |
| `fx.special.missile.launch`          | 39×19         | 7 @16       | no   | 19,15 (launcher)    | back-blast: flash + billows rolling out                                                                                               |
| `fx.special.missile.flash`           | 156×79        | 3 @18       | no   | 77,39               | ground flash pancake (ground layer, emissive)                                                                                         |
| `fx.special.missile.fireball`        | 107×107       | 16 @14      | no   | 51,95 (ground zero) | multi-stage: flash → white-hot → boiling fireball → mushroom (stem + rolling cap, fiery underside) → cap greys, tears, stem lifts off |
| `fx.special.missile.ring`            | 202×102       | 7 @16       | no   | 101,51              | shock ring to the **4.5-tile** radius, heavy dust torus                                                                               |
| `fx.special.burst.a` / `.b`          | 44×34 / 48×38 | 9 @16       | no   | 22,28 / 27,32       | mid bursts: missile secondaries, air-strike chain                                                                                     |
| `fx.special.missile.crater`          | 134×69        | 1           | —    | 67,34               | decal: soot starburst, pit (lit lower-right inner wall), rubble lip                                                                   |
| `fx.special.light.big`               | 186×102       | 1           | —    | 93,51               | additive (`tags: ['additive']`) — light layer                                                                                         |
| `ui.special.missile.reticle.idle`    | 57×33         | 4 @8        | yes  | 28,16 (aimed point) | hi-vis brackets (white inner edge) breathing on the iso diagonals + crosshair                                                         |
| `ui.special.missile.reticle.locked`  | 57×33         | 4 @12       | yes  | 28,16               | brackets snap in, crimson/white, centre blinks                                                                                        |
| `ui.special.missile.reticle.invalid` | 57×33         | 2 @4        | yes  | 28,16               | grey brackets + red X (out of range)                                                                                                  |
| `ui.special.missile.blast`           | 211×110       | 2 @4        | yes  | 105,55              | 4.5-tile blast preview: crimson double ring + iso hazard hatch                                                                        |
| `guideRing(16, 'range')`             | 732×371       | 2           | yes  | centre              | **painter** for the ~16-tile range ring around the tank (not registered: 0.27 MPx per frame; paint once per aim session, ~10 ms)      |

### Air strike (Helicopter)

| Name                                                                                                    | Size   | Frames @fps | Loop | Anchor        | Use                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ------ | ----------- | ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strikeLine(points, opts)`                                                                              | any    | 4 @8        | yes  | first point   | **painter**: the painted line along any drag path (see §3)                                                                                                                      |
| `ui.special.strike.seg.<dir>` / `.invalid`                                                              | ≤34×31 | 4 @8        | yes  | segment start | repeatable straight segment incl. width ghost; chain with `segmentStep(dir)` (axis dirs = 1 tile (±16, ±8), e/w = (±32, 0), n/s = (0, ±16))                                     |
| `ui.special.strike.sample`                                                                              | 291×85 | 1           | —    | 35,20         | gallery demo of the painter (bent path, too-long tail)                                                                                                                          |
| `fx.special.rocket.<0…15>`                                                                              | ≤16×16 | 2 @16       | yes  | centre        | heli rockets (zinc body, red nose), 16 dirs                                                                                                                                     |
| `fx.special.rocket.trail`                                                                               | 9×9    | 5 @16       | no   | 4,4           | rocket exhaust puff                                                                                                                                                             |
| `fx.special.burst.a/b`, `fx.special.strike.scorch.a/b` (37×21 decals), `fx.dust.land`, `fx.light.blast` |        |             |      |               | the strafe chain                                                                                                                                                                |
| flyover                                                                                                 | —      | —           | —    | —             | **reuse** `veh.heli.fly.<dir>` (9° nose-down pose) + `veh.heli.rotor` + `veh.heli.shadow.<dir>` at `HELI_ALT` = 40: it already reads as a diving pass, so no new jet silhouette |

### Shared debris & smoke

| Name                        | Size          | Frames @fps | Loop | Anchor | Use                                                                               |
| --------------------------- | ------------- | ----------- | ---- | ------ | --------------------------------------------------------------------------------- |
| `fx.special.debris.a/b/c/d` | 5×5 (d 7×7)   | 4 @14       | yes  | centre | tumbling asphalt / brick / hot shrapnel / kerb slab — particles on ballistic arcs |
| `fx.special.debris.fire`    | 9×9           | 4 @14       | yes  | 4,5    | burning debris (emissive)                                                         |
| `fx.special.smoke.a` / `.b` | 21×27 / 27×36 | 10 @8       | no   | base   | lingering blast smoke: dark billow → grey → tears                                 |
| `fx.special.dust.roll`      | 22×14         | 7 @10       | no   | base   | base-surge dust that rides outward (give it velocity)                             |

### HUD (group `ui`, screen space at UI scale)

| Name                                                            | Size  | Frames                                             | Anchor               | Use                                                                                                                                                     |
| --------------------------------------------------------------- | ----- | -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui.special.icon.<ram\|rapid\|frag\|missile\|air\|aim\|cancel>` | 11×11 | 1                                                  | 5,5                  | horse head (blaze, navy bridle) · brass cartridges · pineapple frag · climbing missile · Ministry heli + rocket salvo · crimson sight · red cancel disc |
| `ui.special.cue.<skill>`                                        | 17×22 | 4 @8                                               | 8,21 (bottom-centre) | the bouncing ready cue over a charged unit — same hi-vis bubble as the gas cue; tap = use                                                               |
| `ui.special.btn.<icon>`                                         | 22×24 | 4 (`BUTTON_STATES`: normal hover pressed disabled) | 0,0                  | round brass info-panel button (same body as `roundButton(…,'lg')`), icon in the well                                                                    |
| generators                                                      |       |                                                    |                      | `specialIcon(name)`, `specialCue(skill, f)`, `specialButton(name, state)` for `uiTex(...)` like the info panel does                                     |

The charge ring is the existing `abilityRing(step 0…10)` (cards.ts). A stamp button with text
("RAM!", "FIRE MISSILE") can stay `stampFaces(label)`; put `ui.special.btn.*` next to it, or use the
round button alone on compact layouts. In aim / paint mode show `ui.special.btn.cancel`.

---

## 2. Composition recipes (`specialRecipes.ts`)

Each returns `{ spawns, shake, shakeTime, shakeAt, hitStopMs, duration }`. A spawn is
`{ name, x, y, delay, layer, z?, vx?, vy?, vz?, g?, life?, fade?, flip?, loop?, emissive?, alpha?, decal? }`
— absolute world px, velocities px/s, `g` = gravity on z (px/s²). Play it with:

```ts
for (const s of r.spawns) {
  if (s.decal)
    pendingDecals.push({ at: now + s.delay, name: s.name, x: s.x, y: s.y }); // bake when due
  else fx.spawn(s.name, s.x, s.y, now, { ...s, offset: -s.delay, priority: 2 });
}
// at now + r.shakeAt: if (near) juice.shake(r.shake, r.shakeTime); if (r.hitStopMs) juice.hitStop(r.hitStopMs, realMs);
```

(`FxSystem.spawn` already treats a negative `offset` as a delayed start.) All recipes are
deterministic for a `seed`.

| Recipe                                                                                   | Input                         | What it lays out                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fragThrowRecipe(hand{x,y,z}, target, {seed, fuse = 0.15, radius})`                      | thrower's hand, landing point | spoon, spinning grenade on a ballistic arc (peak 18 px + 2/tile) with its ground shadow, rest on the ground, then `fragBlastRecipe` at `impactAt`                                                                                                                                                                                    |
| `fragBlastRecipe(o, {seed, radius = 2.2})`                                               | ground zero                   | flash + fireball + light (0 s), ring (0.03 s), 10 shrapnel slivers reaching the radius in ~0.25 s, 7 debris, 7 rolling dust puffs 0.3 → 0.92 r, 4 smoke puffs (0.25–0.5 s), scorch decal (0.1 s); shake 3 px / 0.35 s, hit-stop 40 ms                                                                                                |
| `missileRecipe(launcher{x,y,z}, target, {seed, radius})`                                 | tank muzzle, aimed point      | back-blast, lofted flight (0.45 s + 0.045 s/tile, peak 40 + 3 px/tile) as 8 straight legs each with the right `fx.special.missile.<k>`, trail puffs every 35 ms, then `missileBlastRecipe` at `impactAt`                                                                                                                             |
| `missileBlastRecipe(o, {seed, radius = 4.5})`                                            | ground zero                   | flash + fireball + big light, ring (0.04 s), 5 secondary bursts at 0.4–0.85 r (0.12–0.55 s, sweeping outward) each with a small scorch, 22 debris (5 burning, slabs), 14 rolling dust puffs, 8 smoke puffs (0.3–1 s), `fx.smoke.column.black` lingering 5 s from 1.1 s, crater decal (0.15 s); shake 5 px / 0.6 s, hit-stop 70 ms    |
| `blastRecipe(o, radius, seed)`                                                           |                               | picks missile style for r ≥ 3, frag style below                                                                                                                                                                                                                                                                                      |
| `rapidFireRecipe(shooter, muzzle{x,y,z}, dir, targets, gap = 0.12)`                      |                               | casings once; per shot: flash + muzzle light + a tracer flying at 700 px/s to the target (nearest of 8 dirs) + `fx.impact.dirt`. Blood on hits stays with the existing combat FX                                                                                                                                                     |
| `ramTrailRecipe(from, to, time)`                                                         | rider path                    | gallop dust every ~7 px (mirrored to the heading), hoof puffs on a 3-strike + suspension gallop                                                                                                                                                                                                                                      |
| `ramHitSpawns(at, flyLeft, delay, headZ = 19, ko = 2.5)`                                 | each bowled protester         | knock burst (mirrored), `fx.ko.stars` over the head, landing dust                                                                                                                                                                                                                                                                    |
| `airStrikeRecipe(path, {seed, width = 1.2, lead = 0.6, spacing = 0.7, cadence = 0.075})` | painted path                  | impacts every 0.7 tile alternating sides inside the corridor, each: rocket (3 legs from 1.6 tiles back at HELI_ALT − 6) + trail, burst, dust, scorch, light every other, 2 chunks; smoke afterwards; also returns `impacts[]` (time, x, y — when the sim's kills should pop) and `flyover[]` keyframes (t, x, y) for the heli sprite |

Layer order (back → front): decal RT (scorch / crater) → `ground` (flash, ring, shadows, guides) →
`entity` depth-sorted at the anchor (fireball, bursts, dust, smoke, debris) → `air` (projectiles,
flashes, tracers, heli) → `light` (additive). Emissive = not graded by day/night (fire, flashes,
tracers, burning debris).

### Radius scaling — drawing a 2.2-tile vs a 4.5-tile blast

A blast's _size_ is carried by the ground layer, its _mass_ by the fireball:

1. **Ring = the lethal radius.** `shockRing(tiles)` draws the last frame exactly on the iso
   ellipse rx = 22.6·r, ry = 11.3·r (`rangeRadiusPx`). Registered: `fx.special.frag.ring` (2.2) and
   `fx.special.missile.ring` (4.5), both from `FRAG_RADIUS` / `MISSILE_RADIUS` in
   `specialRecipes.ts`. If playtests change a radius in `data/units.ts`, change the constant there
   (the rings and previews re-generate at boot) — never scale a sprite.
2. **Flash** ≈ 0.6 r (frag rx 30 for 2.2 tiles; missile rx 64 for 4.5).
3. **One fireball**, sized by tier not by radius: frag R = 12 px (grenade punch, 0.7 s), missile
   R = 22 px with mushroom (1.15 s). Between 3 and 6 tiles use the missile set; below, the frag set.
4. **Everything else is placed in fractions of r**, so it fills any zone: secondary bursts at
   0.4–0.85 r (count ≈ r + 0.5 → 5 for 4.5, none for 2.2), rolling dust from 0.3 r to 0.92 r
   (count ≈ 3·r), debris landing out to ~1.1 r (≈ 3–5 per tile of radius), shrapnel reaching r,
   smoke at 0.05–0.75 r. Use `blastRecipe(o, radius)` and it does this for you.
5. Shake and hit-stop scale with tier (3 px / 40 ms vs 5 px / 70 ms).

---

## 3. Aim & paint UI (world space)

Show what will happen before it happens; nothing fires from these sprites.

- **Ram**: 0.5 s before the gallop, flash the lane: `ui.special.ram.lane.<axis>` or
  `ramLane(to.x − from.x, to.y − from.y)` (any heading; returns frames + anchor = rider), 1–2 loops.
- **Layer**: draw all guides (lane, strike line, reticle) on the `overlay` layer _above_ units — the
  contact sheets showed them vanishing under a dense crowd on the ground layer. Range / blast rings
  may stay on `ground`.
- **Tank missile**: in aim mode draw the range ring `guideRing(16, 'range')` (paint once, anchor =
  tank ground point), the reticle at the pointer / touch (snap to whole world px): `idle` while
  dragging inside range, `locked` after the first tap (second tap fires), `invalid` when outside the
  ring; plus `ui.special.missile.blast` centred on the reticle so the 4.5-tile zone is visible. Sounds:
  `aimTick` on reticle moves (≥ ½ tile), `aimLock` on lock, `aimCancel` on cancel.
- **Air strike**: while dragging, repaint `strikeLine(points, { maxLen: 14 })` (points = the drag path
  in world px, simplified to ≥ ¼-tile steps; the painter is ~5–20 ms for a 14-tile path — throttle to
  every few pointer moves and pass `frames: 1` while the finger moves, 4 frames on release). It draws
  the hi-vis chevron stripe (red/yellow, marching toward the end), start puck, arrowhead, the width ghost
  (dashed hi-vis edges at ±1.2 tiles + iso crimson hatching) and turns the part past `maxLen` grey/red
  ("too long"); `state: 'invalid'` greys the whole line with an X cap (e.g. a pan/zoom gesture took
  over). `ghost: false` hides the corridor; `width` sets it. `paintTick` every ~½ tile painted.
  Straight 8-direction lines can instead be chained from `ui.special.strike.seg.<dir>` (no caps).

All painters return palette-pure `PixelBuffer` frames: turn them into textures with
`bufferTexture(buf)` (uikit/pixi.ts) and place `new Sprite(tex)` with the returned anchor at the
first point. Their hatching is aligned to world pixels, so place them at integer world coords.

---

## 4. Sounds (`src/audio/sfx/specials.ts`)

Ids are part of `SfxId`, so `audio.play(id, { x, y })` works everywhere (`ui` bus ones are
non-positional). Levels were checked with an offline render (48 kHz) against the stock SFX — peak at
bus input after the catalogue gain, loudest-300 ms RMS:

| Id                        | Bus | Len             | Peak / RMS₃₀₀ (dBFS)        | Policy (prio, voices, min interval) | Trigger                                                                                                           |
| ------------------------- | --- | --------------- | --------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ramGallop`               | sfx | 1.9 s           | −10.6 / −29.8               | 6, 1, 0.8 s                         | ram starts (lane flash): strides tighten into a charge, snorts, tack                                              |
| `ramImpact`               | sfx | 0.4 s           | −6.0 / −18.3                | 5, 3, 0.08 s (aggregates)           | each protester bowled: thump, crunch, "oof" grunts, clatter                                                       |
| `rapidFire`               | sfx | 0.8 s           | −5.9 / −18.1                | 7, 2, 0.3 s                         | skill fired: 5 shots on a 120 ms grid + slide clacks + casings tinkle (play once, not per shot)                   |
| `fragPin`                 | sfx | 0.3 s           | −10.8 / −30.4               | 6, 2, 0.2 s                         | soldier readies the grenade                                                                                       |
| `fragThrow`               | sfx | 0.5 s           | −9.4 / −33.3                | 6, 2, 0.2 s                         | at the throw (includes the landing clink at +0.34 s)                                                              |
| `fragBoom`                | sfx | 0.6 s (+tail)   | −3.6 / −12.4                | 9, 3, 0.08 s; ducks ambience 5 dB   | detonation: sharp crack, shrapnel whizz                                                                           |
| `missileLaunch`           | sfx | 1.1 s           | −5.6 / −20.3                | 8, 1, 0.5 s                         | missile fired: ignition + receding roar                                                                           |
| `missileBoom`             | sfx | 3.2 s           | −1.7 / −6.9                 | 10, 1, 0.3 s; ducks ambience 9 dB   | impact: deep blast, secondaries, rolling thunder                                                                  |
| `airSwoop`                | sfx | 2.1 s           | −8.6 / −25.3                | 7, 1, 1 s                           | heli starts its run (doppler rotor + turbine)                                                                     |
| `rocketSalvo`             | sfx | 0.6 s           | −10.1 / −26.1               | 7, 2, 0.3 s                         | first rocket leaves (6 launches 80 ms apart)                                                                      |
| `strikeChain`             | sfx | 1.6 s (+rumble) | −2.0 / −10.0                | 9, 1, 0.5 s; ducks ambience 7 dB    | first impact (9 booms 80 ms apart + rumble)                                                                       |
| `skillReady1` / `2` / `3` | ui  | 0.3–0.6 s       | peaks −14.2 / −13.2 / −12.6 | 10, 1, 0.4 s                        | ready chime by tier: 1 = ram, rapid fire (L4–5); 2 = frag (L6); 3 = missile, air strike (L9–10; ducks music 4 dB) |
| `aimTick`                 | ui  | 20 ms           | −16.2                       | 10, 2, 0.04 s                       | reticle moved                                                                                                     |
| `aimLock`                 | ui  | 0.13 s          | −17.1 / −23.1               | 10, 2, 0.03 s                       | target locked                                                                                                     |
| `aimCancel`               | ui  | 0.1 s           | −15.2                       | 10, 2, 0.03 s                       | aim / paint cancelled                                                                                             |
| `paintTick`               | ui  | 20 ms           | −16.6                       | 10, 2, 0.05 s                       | every ~½ tile painted                                                                                             |

References from the same render: `pistol` −5.8 / −22.4, `explosionSmall` −4.4 / −17.0,
`explosionBig` −1.8 / −7.4, `tankCannon` −3.1 / −9.8, `hooves` −10.8 / −32.5, `heliPass` −9.4 / −27.6,
`abilityReady` −17.7. No special sound exceeds 1.0 at the bus input. Suggested sequences (also the
▶ buttons of the audio lab): ram = gallop → impacts from +1.1 s; frag = pin → throw (+0.35 s) → boom
on impact; missile = launch → boom at `impactAt`; air strike = swoop → salvo (+0.45 s) → chain at the
first impact.
