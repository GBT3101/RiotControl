# E3 North — environment styles for Berlin, Stockholm and Amsterdam

Files: `src/art/env/cities/{berlin,stockholm,amsterdam}.ts` (+ `.grid.ts`), the shared North
kit `src/art/env/cities/north.kit.ts`, city vehicles `src/art/vehicles/cities/{berlin,stockholm,
amsterdam}.ts`, one index line each in `src/art/env/cities/index.ts` and
`src/art/vehicles/cities/index.ts`. Review images: `docs/progress/e3-north-cities.png` (Madrid,
Berlin, Stockholm, Amsterdam, same camera, zoom 2 day), `e3-north-night.png` (zoom 4 night, same
order), `e3-north-details.png` (Amsterdam canal z4, Gamla stan z3, Berlin Mitte/Alexanderplatz
z3).

## Berlin

- **Buildings** (`look` rolls a `variant`):
  - `altbau` — Gründerzeit stucco in grey, sooty grey, ochre, cream, salmon, pale blue-grey,
    peach and sand; hooded casement windows, pedimented Beletage, iron balconies on slabs,
    double string course, dormers on pitched and mansard roofs (slate or red tile). About 30 % of
    large flat/mansard corner blocks get a **corner turret** with a slate or copper dome
    (`roofs.ornament` → `cornerTurret`).
  - `platte` — Plattenbau: flat-roofed residential slabs of 6 storeys (85 %, 30 % at 5): pale grey
    / beige prefab panels with joints, wide windows, and **loggia stacks with coloured parapet
    panels** (GDR orange, green, blue, ochre, teal) — the blueprint's Friedrichshain edge and
    Leipziger Straße get them. Painted procedurally in `facade.upperBay`.
  - `stone` (civic, 25 % of commercial) — sandstone ashlar for the state; `glass` (18 % of
    commercial) — post-Wende curtain-wall offices.
- **Ground floors**: Späti (bottle-stacked window), Döner Imbiss (the spit in the window), Kneipe
  (frosted panes), roller shutters, Altbau doors.
- **Graffiti: heavy.** Every non-state facade gets spray pieces in a 3×5 letter font (KIEZ,
  BERLIN, KREIZ…), wheat-pasted posters and tags up to the first floor (`facade.finish`), tags on
  85 % of single ground bays, `tagChance` 0.95, rent-strike bedsheets, and the `BLN` ground tag.
- **Street**: granite slabs beside a band of small mosaic setts (`ground.fills.sidewalk`),
  Kopfsteinpflaster lanes, murky green-grey Spree, tall gas lanterns, **Ampelmännchen** traffic
  lights (car lamps cycle, the little man goes green while cars wait), **U-Bahn** (blue U on white),
  **S-Bahn** (green S) and U+S masts (`metro.0–2`), **Litfaßsäulen** (`morris.0–1`), Döner and Späti
  kiosks (`kiosk.0–1`), orange BSR bins, linden trees (`tree.round`), Spree excursion boats
  (`boat`), German flags.
- **Vehicles**: `bus_berlin` (yellow BVG double-decker), `taxi_berlin` (ivory Mercedes with the
  yellow roof sign), `trabi_mint` / `trabi_beige`.
- Protest item: `bottle` (Wegbier). Postcard sky `sky`/`gray6`, minimap roof `gray3`.

## Stockholm

- **Gamla stan** (`variant: 'gamla'`): narrow merchant houses in ochre, rust red, saffron, salmon,
  burnt orange, cream; **street gables** (stepped, Baroque volute, bell, plain) on 80 % of pitched
  roofs, with oculus or paired attic windows; roofs of black tin, verdigris copper or red tile
  (`roofs.slopeTex`). Swedish casements with cross bars, sandstone portals, konditori fronts.
- **Norrmalm / Östermalm** (`variant: 'grand'`, 6 storeys or 5 with a flat/mansard roof, and all
  civic): stone and stucco blocks, iron balconies, copper or tin roofs, **copper-domed corner
  turrets** (onion or round, some with spires) on 60 % of large flat/mansard corners.
- **Street**: granite slabs and gatsten, granite quays with **iron mooring bollards**, iron bridge
  railings, Baltic-blue water, **white lamps hung from a swan-neck mast** (a lamp prop cannot span
  a street, so the wire is a stay off the mast), the blue **T-bana T**, Falu-red kiosks, green bins,
  blue-and-yellow flags (also hung from windows), linden trees, a bronze fountain in a granite
  basin (`fountain`), an equestrian king (`statue.equestrian`), royal guard sentry boxes
  (`sentrybox`), white archipelago steamers and motor launches at the quays (`boat`).
- **Vehicles**: Volvo estates (`volvo_navy/red/beige/white`), the blue `bus_stockholm`.
- Graffiti word `FIKA`; protest item `phone`; postcard sky `sky`/`zinc4` (cool northern light).

## Amsterdam

- **Canal houses**: dark brown, red-brown, plum, black-painted and red brick (some plastered),
  big white sash windows with glazing bars and brick arches, geranium window boxes, raised doors
  with stoops, brown cafés and shops. Every pitched roof with a street face ≤ 3 tiles gets a
  **white-dressed street gable** (seeded: step, neck, bell, spout, point) with a **3D hoist beam
  and hook**, a loading door and attic windows, and a steep anthracite or red pantiled roof
  running back from the street (`paintGable`); the narrow 2×3 canal lots read deep, tall and
  gable-to-the-street. 16 % are **warehouses** (pakhuis): loading doors up the middle with
  green/red shutters and spout gables. Flat roofs keep a white dentil cornice.
- **Quays**: red-brown klinkers, grey stoeptegels, dark canal water, iron bridge railings, GVB
  **tram tracks** on the through streets (`ground.tram`), **elms** (`tree.round`), **bikes**: single
  omafiets, heaps of three, two on a steel hoop rack, a bakfiets (`bike.0–3`, both axes),
  **houseboats** with roof gardens and a glass-roofed canal cruiser (`boat`), red-brown
  **Amsterdammertjes** with their three crosses, herring cart and flower kiosk (`kiosk.0–1`), the
  green **krul** urinal (`krul`, preview icon), XXX flags (also hung red/black/red from windows)
  and the `XXX` ground tag.
- **Vehicles**: `tram_amsterdam` (white, blue skirt and nose, pantograph).
- Protest item `umbrella`, rain puddles; postcard sky `zinc4`/`sky`.

The lean of old canal houses is not modelled (a sheared facade needs rasterizer support; the
straight gables read better at this scale).

## Shared-code changes (all optional, backwards-compatible)

1. `EnvCity.look(kind, d, site?)` — new optional `BuildingSite { w, d, storeys, roof }` argument
   (style.ts), passed by `paintBuilding` through `makeLook`; `Look.variant?: string` (looks.ts), a
   city-defined building type tag read by the city's facade and roof hooks.
2. `OrnamentCtx.street?: 'left' | 'right' | 'back'` (style.ts, filled in bld/building.ts): the
   visible face with the street door, so gables face the street.
3. `propSprite` (props.ts): a city's `props.extra` may provide seeded variants `<kind>.<n>` and
   axis twins `<kind>[.<n>].i|j` (registered as `prop.<key>.<city>`); also the way to replace a kind
   that has per-city shared art (Berlin's `trafficlight.0`).
4. `view/staticView.ts`: `boat` decor is drawn when the city has boat art, along the axis of the
   water it floats on (`waterAxis`). Madrid/London/Paris have no `prop.boat.*`, so nothing changes.

The gable roof, turrets, trees, boats and bikes live in `north.kit.ts` on top of the E3 hooks
(`roofs.ornament`, `roofs.slopeTex`, `facade.finish`, `ground.fills`, `ground.tram`, `props.extra`,
`decals.tagGrid`) and the shared `bld/ornaments.ts` helpers (`prism`, `dome`, `cone`).

**Madrid/London/Paris are pixel-identical**: 6 703 hashes (every registered sprite outside the new
cities, every building of the three maps at seeds 0 and 3 with lights, shadow, roof and climb
data, every decor prop resolution, a ground-tile sample of each map) compared before and after:
0 differences.

## Verification

- `npx vitest run` — 64 files, 4 880 tests pass (incl. `cities-complete`, `env-*`,
  `palette-compliance`); `npm run typecheck`, `eslint`, `prettier --check` clean on the touched
  files.
- Sprites: `node tools/export-sprites.mjs --filter <city>`; gallery `?filter=<city>`,
  `?group=preview`.
- Game: `node tools/shoot.mjs --dev --page game --query
"city=<city>&tutorial=0&hints=0&mute&freeze&hud=0&tod=0.3&zoom=2&nocache"` (+ `zoom=4`,
  `tod=0.75`, `--viewport phone-portrait`, `u=56&v=27` Amsterdam canal, `u=44&v=56` Gamla stan,
  `u=38&v=4` Berlin east). Use `nocache`: the IndexedDB art cache otherwise serves old art.
