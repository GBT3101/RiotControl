# M4c — Vehicles art catalogue

Everything lives in `src/art/vehicles/` (entry `registerVehicles`, gallery group **`vehicles`**,
497 sprites). Previews: `docs/progress/m4c-lineup.png` (every vehicle, every facing, 3×),
`m4c-street.png` (in situ on iso roads with M1 riot cops for scale), `m4c-states.png`
(fire / damage / wreck / heli poses / aftermath / card icons).

## How it is made

Vehicles have to exist in 8 consistent facings (the tank turret in 16) with independent
turrets, pitch/bank poses and damaged / burnt / overturned states. They are therefore authored
as **hand-placed part models** (`humvee.ts`, `tank.ts`, `heli.ts`, `civil.ts`: every panel, lamp,
sandbag, jerry can, antenna, crew member and stencil placed by hand in pixel units) and
rasterised by `render3d.ts`, a tiny orthographic ray caster built to produce *pixel art*:

- one sample per pixel at pixel centres — no anti-aliasing, no blending, RIOT-64 only;
- shading quantised to **ramp steps** per material: top face +1, lit (left) face = base,
  shaded (right) face −1, sun from the upper left; hue-shifted ramps in `materials.ts`;
- clean-up passes a pixel artist does by hand: lit-edge highlights on convex top edges and
  camera-facing corners, sel-out contour lines where a part passes in front of another,
  orphan-pixel removal, coloured exterior outline (per material), sun-cast blob shadow to the
  lower right (palette `shadow` swatch at 45 %);
- hand-drawn 2D details from `stamps.grid.ts`: flame tongues (4f), smoke/dust puffs, Ministry
  star & chevron stencils, red cross, RATP/London roundels, a 3×5 micro font for lettering
  (POLICE, LONDON), muzzle-flash star bursts. Face decals follow the face's iso slope;
  lettering (`text()` returns per-column glyph `cells`) is stepped glyph by glyph — each 3×5
  letter stays upright and the next one steps down the 2:1 face (M13a; shearing column by
  column tore the letters apart). flames/flashes are depth-tested billboards.

All facings are rendered **natively** (nothing is mirrored), so lighting always comes from the
upper left and lettering is never reversed. Output is deterministic (tested).

## Facings

`dirs.ts`: `DIR8 = se, s, sw, w, nw, n, ne, e` (screen compass); tank turret `DIR16` adds
`sse, ssw, wsw, wnw, nnw, nne, ene, ese`. Tile mapping: **+i = SE, −i = NW, +j = SW, −j = NE**,
so E = (+i, −j), S = (+i, +j), W = (−i, +j), N = (−i, −j).
Helpers: `facing8(di, dj)`, `facing16(di, dj)` (movement/aim vector in tile space → facing),
`dirToTile(dir)`.
Decor vehicles use `DIR4 = se, sw, nw, ne` (they drive along the tile axes).

## Layers, anchors & z-order

Anchor = the pixel on the entity's world position (ground centre of the vehicle). Integer
offsets for attached layers come from `meta.ts` (pure maths, cheap at runtime):

| function | meaning |
|---|---|
| `humveeTurretOffset(hullDir, frame)` | turret anchor relative to the hull anchor (includes the drive bob) |
| `humveeMuzzle(turretDir)` | M2 muzzle relative to the turret anchor (tracers, impacts) |
| `humveeEngine(hullDir)` | hood point (sparks, extra smoke) |
| `tankTurretOffset(hullDir)` | turret anchor relative to the hull anchor (hull does not bob) |
| `tankMuzzle(turretDir16, fireFrame?)` | muzzle relative to the turret anchor (recoil aware) |
| `tankEngine(hullDir)` | engine deck |
| `heliHubOffset(pose, dir)` | rotor hub relative to the body anchor |
| `heliMuzzle(pose, dir)` / `heliLight(pose, dir)` | door-gun muzzle / searchlight lens |
| `metaTables()` | all of the above precomputed (debug / docs) |

Draw order per vehicle: **shadow-bearing hull → turret** (turrets always sit on top).
Tank dust: draw *under* the hull when the hull faces se/s/sw, *over* it for w/nw/n/ne/e (the
dust is behind the tank, which is then nearer the camera). Helicopter: `shadow` (ground layer,
at the ground point) → `downwash` (ground) → `body` at `(x, y − HELI_ALT)` → `rotor` at
body + `heliHubOffset`. Everything airborne goes in the air layer above all ground sprites.
Recommended hover bob: ±1 px every ~0.6 s applied to body + rotor (not the shadow).

## MG Humvee — `veh.humvee.*` (8 facings)

Olive army Humvee: canvas-covered rear bed, sandbags across the nose, red jerry cans on the
tailgate, two whip antennae, mud-caked flanks, Ministry star/chevron stencils, wide stance.

| sprite | size (se) | frames | fps | anchor (se) | notes |
|---|---|---|---|---|---|
| `drive.<d>` | 43×45 | 4 | 10 | 20,32 | wheel lugs + body bob `[0,1,1,0]`; frame 0 = parked |
| `drive.dmg1.<d>` | 43×45 | 4 | 10 | 20,32 | dents, scrapes, cracked windscreen, dead headlight, bent antenna |
| `drive.dmg2.<d>` | 43×37 | 4 | 10 | 20,24 | + scorch, torn canvas, lost mirror, rising engine smoke |
| `wreck.<d>` | 42×51 | 4 | 8 | 20,39 | burnt, on its rims, 3 animated fires + black smoke column |
| `turret.<d>` | 18×15 | 1 | — | 6,11 (pivot) | gunner (navy helmet + hi-vis band, goggles), M2, gun shield, ammo can |
| `turret.dmg.<d>` | 18×15 | 1 | — | pivot | scorched shield (use with dmg2) |
| `turret.fire.<d>` | 24×15 | 2 | 20 | pivot | recoil + muzzle flash (big, fading) — one loop per shot at 10 shots/s |
| `icon` | 32×32 | 1 | — | 16,31 | card portrait |

## Tank — `veh.tank.*` (hull 8, turret 16 facings)

Angular olive MBT: five-panel side skirts, animated tracks & road wheels, engine grilles, tow
cable, spare links, commander in a navy beret + headset leaning out of the cupola with a
pintle MG, stowage basket, smoke dischargers, two antennae, turret-ring shadow on the hull.

| sprite | size (se) | frames | fps | anchor (se) | notes |
|---|---|---|---|---|---|
| `drive.<d>` | 54×36 | 4 | 10 | 25,20 | tread cleats slide 0.5 px/frame (seamless), road-wheel hubs turn |
| `drive.dmg1.<d>` | 54×36 | 4 | 10 | 25,20 | dents, one skirt panel blown off |
| `drive.dmg2.<d>` | 54×48 | 4 | 10 | 25,32 | three panels gone, scorch, black engine smoke |
| `wreck.<d>` | 54×70 | 4 | 8 | 25,52 | turret baked in, knocked 28° askew with drooping gun; fires + smoke |
| `dust.<d>` | ~35×27 | 4 | 10 | hull anchor | tread dust behind both tracks (driving / crushing) |
| `turret.<d16>` | 39×33 | 1 | — | 17,23 (pivot) | |
| `turret.dmg.<d16>` | 39×33 | 1 | — | pivot | scorched (with dmg2) |
| `turret.fire.<d16>` | 47×36 | 4 | 12, **once** | pivot | f0 shot: 3 px recoil + big flash; f1 fading flash + smoke; f2–f3 gun runs out, smoke drifts |
| `icon` | 32×32 | 1 | — | 16,31 | |

Crush: play `dust.<d>` while driving over protesters (the gore/KO itself is M5/M7).

## Helicopter — `veh.heli.*` (8 facings)

Ministry police helicopter: dark navy, hi-vis Battenburg band, yellow tail stripes, blue/red
strobes (alternating frames), Nightsun searchlight under the nose, enclosed fenestron
(animated), and a door gunner (navy helmet, goggles) in the open starboard door.

| sprite | size (se) | frames | fps | anchor | notes |
|---|---|---|---|---|---|
| `hover.<d>` | 47×39 | 4 | 12 | centre of mass | fenestron spin + strobes |
| `fly.<d>` | 45×43 | 4 | 12 | CoM | 9° nose-down (moving) |
| `bankl.<d>` / `bankr.<d>` | ~45×41 | 4 | 12 | CoM | 13° roll + 5° pitch (turning) |
| `fire.<d>` | 47×39 | 4 | 12 | CoM | door gun spray: flash on frames 0 (big) & 2 (fading) |
| `rotor` | 65×35 | 4 | 24 | hub | 4 blades, 22.5°/frame, translucent blur wedges + rim (shadow swatch) |
| `shadow.<d>` | 43×22 | 1 | — | ground point | body footprint, shadow swatch |
| `downwash` | 90×47 | 4 | 10 | ground point | expanding dust rings |
| `beam.<d>` | ~33×45 | 1 | — | ground point | night searchlight cone + spot ~1.3 tiles ahead, tagged `additive`: draw with additive blending at night |
| `icon` | 32×32 | 1 | — | 16,31 | |

`HELI_ALT = 40` world px: body anchor = ground point − (0, 40). The beam is pre-drawn for that
altitude in the hover pose.

## Decor / ambient vehicles — `veh.<id>.<variant>.<se|sw|nw|ne>`

Ids (`CIVIL_IDS`): `police_van` (navy, Battenburg, POLICE lettering, blue lightbar),
`ambulance` (green/yellow Battenburg, red crosses, lightbar), `fire_truck` (red, ladder,
lightbar), `bus_london` (red double-decker, gold LONDON fleet name between the decks), `bus_madrid` (EMT livery: white, blue roof/skirt, red band — no lettering),
`bus_paris` (RATP white/jade + roundel), `cab_london` (black cab, amber TAXI lamp),
`taxi_madrid` (white, red door band, green roof lamp), `car_2cv` (Paris 2CV-ish, mint),
`car_twingo` (Paris one-box, yellow), `hatch` (red) + `hatch_blue|white|yellow|green|silver`,
`sedan` (plum) + `sedan_black|beige|teal`, `delivery_van` (white, orange stripe, roof rack +
parcel), `scooter` (mint Vespa) + `scooter_red`.

| variant | frames | fps | for |
|---|---|---|---|
| `drive` | 2 | 8 | wheel lugs; emergency lights alternate; scooters have a rider |
| `parked` | 1 (2 @ 4 fps with flashing lights for police_van, ambulance, fire_truck) | | parked decor (scooters without rider) |
| `burnt` | 1 | — | riot aftermath: charred, rust-bloomed panels, ash on top, glass gone, on rims |
| `flipped` | 1 | — | overturned on its roof, wheels in the air (scooter: on its side) |
| `burning` | 4 | 8 | burnt shell with flames + smoke (hatch, sedan, all buses) |

Aftermath coverage: `burnt` — police_van, ambulance, all buses, cab_london, taxi_madrid,
car_2cv, car_twingo, hatch, sedan, delivery_van, scooter; `flipped` — police_van,
cab_london, taxi_madrid, car_2cv, car_twingo, hatch, sedan, delivery_van, scooter.
Sizes (se): cars 28–36 × 21–25, vans 42–43 × 34–35, fire truck 52×40, single-deck buses
61×45, double-decker 65×56. Anchor = ground centre (e.g. hatch 15,15). Colour variants share
the burnt/flipped sprites of their base id (`hatch`, `sedan`).

## Offsets per facing (world px)

| dir | humvee turret (frame 0/1/2/3) | humvee muzzle | humvee engine | tank turret | tank engine | heli hub hover | heli hub fly | heli muzzle | heli light |
|---|---|---|---|---|---|---|---|---|---|
| se | -1,-13 / -1,-14 / -1,-14 / -1,-13 | 10,-1 | 8,-4 | -1,-10 | -11,-15 | 0,-8 | 1,-7 | -13,5 | 5,10 |
| s | 0,-14 / 0,-15 / 0,-15 / 0,-14 | 0,1 | 0,-3 | 0,-11 | 0,-17 | 0,-8 | 0,-7 | -15,-1 | -3,10 |
| sw | 1,-13 / 1,-14 / 1,-14 / 1,-13 | -10,-1 | -8,-4 | 2,-10 | 11,-15 | 0,-8 | -1,-7 | -9,-6 | -10,7 |
| w | 1,-13 / 1,-14 / 1,-14 / 1,-13 | -14,-6 | -11,-8 | 2,-10 | 16,-10 | 0,-8 | -2,-8 | 3,-8 | -10,3 |
| nw | 1,-12 / 1,-13 / 1,-13 / 1,-12 | -10,-11 | -8,-12 | 2,-9 | 11,-4 | 0,-8 | -1,-9 | 13,-4 | -5,0 |
| n | 0,-12 / 0,-13 / 0,-13 / 0,-12 | 0,-13 | 0,-14 | 0,-9 | 0,-2 | 0,-8 | 0,-9 | 15,2 | 3,-1 |
| ne | -1,-12 / -1,-13 / -1,-13 / -1,-12 | 10,-11 | 8,-12 | -1,-9 | -11,-4 | 0,-8 | 1,-9 | 9,6 | 10,2 |
| e | -1,-13 / -1,-14 / -1,-14 / -1,-13 | 14,-6 | 11,-8 | -2,-10 | -16,-10 | 0,-8 | 2,-8 | -3,8 | 10,6 |

Humvee muzzle is per *turret* facing; tank muzzle per 16-way turret facing (at rest; pass the
fire frame to `tankMuzzle` for recoil):

| turret | se | sse | s | ssw | sw | wsw | w | wnw | nw | nnw | n | nne | ne | ene | e | ese |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tank muzzle | 20,8 | 11,11 | 0,12 | -11,11 | -20,8 | -26,3 | -29,-3 | -26,-8 | -20,-13 | -11,-16 | 0,-17 | 11,-16 | 20,-13 | 26,-8 | 29,-3 | 26,3 |

Heli hub/muzzle/light are relative to the **body** anchor (already at altitude).

## Files

`render3d.ts` (renderer & clean-up passes), `materials.ts` (ramps), `parts.ts` (wheels,
sandbags, jerry cans, antennae, crew figures), `stamps.ts` + `stamps.grid.ts` (2D art),
`fxparts.ts` (smoke columns, flames), `humvee.ts`, `tank.ts`, `heli.ts`, `heliFx.ts` (rotor,
shadow, beam, downwash), `civil.ts` (decor), `icons.ts`, `meta.ts`, `dirs.ts`, `index.ts`.
Tests: `tests/vehicles-art.test.ts`.

## Cost / known gaps

- Generating all 497 vehicle sprites takes ~1.1 s warm / ~1.7 s cold in Node (≈1.55 M atlas
  pixels). If boot time matters, cache the built atlas (or build vehicles lazily after the
  first frame).
- The rotor disc does not tilt with the fly/bank poses (reads fine at game zoom).
- Decor vehicles have no `e/w/n/s` facings (they only drive along tile axes, per brief).
- Burnt colour variants share one sprite per base model (`hatch`, `sedan`).
