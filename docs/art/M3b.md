# M3b — Landmark art: the three Capitols + skyline landmarks

Gallery group: **`landmarks`** (`gallery.html?group=landmarks`). Source: `src/art/landmarks/`.
Previews: `docs/progress/m3b-{madrid,london,paris}.png` (2×) and
`docs/progress/m3b-damage-{madrid,london,paris}.png` (states 0→4, 1×). Re-export with
`M3B_EXPORT=1 npx vitest run tests/landmarks-preview.test.ts`.

## How the art is made

`engine/scene.ts` is a small analytic iso ray-caster: each landmark is modelled from boxes,
gables, hip roofs, n-gon prisms/spires, cylinders, cones, domes and barrel vaults placed in
footprint space, intersected exactly on the 2:1 pixel lattice (crisp 2-px iso steps), then
painted by hand-written **materials** (face-space modules: windows, doors, reliefs, clock dials,
lettering drawn as grids) with 5-level RIOT-64 light ramps (top 4 · lit +j face 3 · shaded +i
face 1), cast shadows (portico columns shadow the walls), contact lines and a coloured exterior
outline. Hand-drawn grids (`sprites.grid.ts`: lions, marble statues, Cibeles, Neptune, Victory,
Cervantes, Nelson, Churchill, guard, lamps) are depth-tested billboards. No noise, palette only.

## Conventions (all landmark sprites)

- **Anchor = the footprint's top (north) vertex** — world `((i − j)·16, (i + j)·8)` of footprint
  tile `(i, j)`. Same rule as M1 buildings: `new Sprite(art.tex(name))` at that world point.
  The footprint diamond spans `x ∈ [anchor.x − 16·d, anchor.x + 16·w]`, bottom vertex at
  `anchor.y + 8·(w + d)`. Sprites never draw below the footprint's bottom vertex nor left of its
  left vertex (test-enforced); tall parts extend upward only (`top` px above the anchor).
- **Front (+j, SW) face is the lit left face.** Every Capitol's portico/porch and stair face +j.
- The sprite paints its own ground for the whole footprint (paving, lawns, gravel) — no `lot`
  tile shows through.
- **Depth sorting:** the footprint is blocked ground, so walkers are only ever outside it. Sort the
  landmark as one building with `boxDepthKey` of its footprint (or M8's slicing); units on the
  `steps` row are always in front of it.
- `*.night` — night-lights mask, same size/anchor as the sprite: draw it **after** colour grading
  (unaffected by the night tint / additive). Lit windows, Big Ben's dials, floodlit portico
  columns, lamps, glowing skylights, Eiffel sparkles, the Eye's rim + capsules, gilded domes.
- `*.shadow` — pre-drawn cast shadow on the ground (shadow swatch @ SHADOW_ALPHA,
  `hasShadow`), anchored at the same footprint top vertex (`anchor.y = 0`), extends right/down.
  Draw in the decals layer. Footprint tiles are excluded (the sprite bakes its own).

## Capitols — `lm.capitol.<city>.<state>`

| City | Building | Footprint w×d | Sprite | Anchor | Notes |
|---|---|---|---|---|---|
| madrid | Congreso de los Diputados | 9×7 | 260×252 | (114, 122) | hexastyle Corinthian portico, relief pediment, bronze lions Daoíz & Velarde on pedestals, grand granite stair, slate roofs, hemicycle hall + glazed lantern, fernandina lamps, railings |
| london | Palace of Westminster | 14×6 | 324×374 | (98, 212) | Elizabeth Tower at low-i front corner (dials on both visible faces, gilded spire), Westminster Hall great gable, St Stephen's porch + steps, pinnacled perpendicular facade, octagonal Central Tower, Victoria Tower (Union flag), lawns + railings |
| paris | Palais Bourbon / Assemblée nationale | 11×7 | 292×270 | (114, 124) | 12 Corinthian columns, pediment relief, gilded "ASSEMBLEE NATIONALE" frieze, full-width stair, 2 seated + 2 standing marble statues, glazed hemicycle skylight, zinc roofs, tricolour |

States (static, 1 frame each; same size & anchor for all five):

| State | What changes |
|---|---|
| 0 | pristine; flag flying |
| 1 | graffiti tags + posters on reachable walls, stairs, pedestals; protest bed-sheet banner (`NO A TODO` / `DOWN WITH THINGS`, `OI NO` / `MERDE ALORS`) |
| 2 | + ~60 % windows smashed, lantern/skylight panes broken, rubble & bottles on stairs/plaza, flag torn (`.torn` overlay), lamps out |
| 3 | + windows burning/gutted with soot plumes, scorched roof zone + smoke, one lion / statue toppled, relief & clock soot, banner scorched |
| 4 | + broken columns with fallen drums, gap torn in entablature/pediment, holes in walls (brick edges, burning interior), roofs burnt through, Big Ben spire & Central Tower snapped (fire on the stump, clock hands gone), flagpoles shortened |

Also per city: `lm.capitol.<city>.night` (state 0 lights), `lm.capitol.<city>.shadow`
(322×163 / 475×240 / 353×179, anchor (16·d+2, 0)), and **`lm.capitol.<city>.steptile`** — a 32×16
ground tile (anchor {16, 0}) of shallow steps in the Capitol's stone.

**Steps:** the grand stair is drawn **inside** each footprint (rising from the +j edge to the
portico). The contract's `steps` tiles (the row along the +j edge, outside the footprint) are left
to ground tiles: use `lm.capitol.<city>.steptile` for them (nosings run along i, parallel to the
facade) so they continue the stair visually. Protesters stand on that row and attack.

### Overlays — `landmarkOverlays(name)`

`import { landmarkOverlays } from 'src/art/landmarks'` → `[{ sprite, x, y }]` for
`lm.capitol.<city>.<state>` (and `lm.<id>`). Draw each overlay sprite with its anchor at
`landmarkAnchorWorld + (x, y)`, after the landmark (in list order). Offsets are stable per state.

| Overlay | Size | Frames @ fps | Anchor | Use |
|---|---|---|---|---|
| `lm.flag.{es,uk,fr}` | 25×22 | 6 @ 8 | (1,1) = pole tip; flies to the right | states 0–1 |
| `lm.flag.{es,uk,fr}.torn` | 25×22 | 6 @ 10 | (1,1) | states 2–4 (ragged fly end, holes) |
| `lm.flag.{es,uk,fr}.small` | 16×16 | 6 @ 8 | (1,1) | secondary landmarks (Palacio de Cibeles) |
| `lm.fx.fire.s / .m / .l` | 8×12 / 12×18 / 18×28 | 6 @ 12 | bottom centre | burning windows / roofs (states 3–4) |
| `lm.fx.smoke` | 22×48 | 6 @ 6 | bottom centre | smoke columns (states 3–4) |
| `lm.capitol.london.hands.l / .r` | 17×17 | 12 @ 1 | (8,8) = dial centre | Big Ben minute hand (12 positions, hour hand advances); `.l` = +j dial, `.r` = +i dial; states 0–3 |

Example offsets (state 0): Madrid flag `(2, −41)`; London Union flag `(182, −58)`, hands.l
`(−77, −75)`, hands.r `(−51, −75)`; Paris flag `(17, −36)` — always read them from
`landmarkOverlays()` rather than hard-coding.

Reference compositor: `src/art/landmarks/preview.ts` (`composePreview`, `composeDamageStrip`):
ground → shadows → landmarks + overlays → actors.

## Secondary landmarks — `lm.<id>` (+ `lm.<id>.night`, `lm.<id>.shadow`)

All anchored on the footprint top vertex (anchor.x = 16·d + 2, + 30 for the Eye's side margin).

| id | Footprint | Sprite | Frames @ fps | Notes |
|---|---|---|---|---|
| cibeles | 3×3 | 100×90 | 4 @ 6 | basin with rippling water + jets, marble Cybele on lion chariot, sceptre |
| neptuno | 3×3 | 100×98 | 4 @ 6 | Neptune on shell chariot with sea-horse, trident, three jets |
| metropolis | 3×3 | 100×182 | 1 | white rotunda with paired columns, slate dome with gilded ribs, gold winged Victory |
| puertaAlcala | 4×2 | 100×132 | 1 | granite gate, 3 see-through arches + 2 side passages, marble columns/arch rings, attic + statues |
| palacioComunicaciones | 8×6 | 228×294 | 1 | white "wedding-cake" palace, corner turrets, central tower, arcade, small Spanish flag overlay |
| cervantes | 1×1 | 36×54 | 1 | bronze Cervantes on granite pedestal |
| abbey | 7×4 | 180×210 | 1 | twin west towers on the +i end with great west window, nave + flying buttresses, north transept rose window on +j |
| nelson | 2×2 | 68×190 | 1 | fluted column, bronze capital, Nelson, plinth reliefs, Landseer lions |
| londonEye | 4×4 | 192×266 | 8 @ 2 | face-on wheel, 32 capsules, 16 spokes, A-frame legs; frames rotate one capsule step (seamless loop); night: blue/pink rim, lit capsules |
| buckingham | 10×5 | 244×222 | 1 | Portland facade, pediment portico + balcony, balustrade, railings with gilded gates, 2 guards in sentry boxes, Union flag overlay |
| churchill | 1×1 | 36×52 | 1 | bronze Churchill (greatcoat, cane) on plinth, lawn |
| obelisk | 2×2 | 68×160 | 1 | pink granite with hieroglyphs, gold pyramidion, gilded pedestal panels |
| concordeFountain | 3×3 | 100×90 | 4 @ 6 | two-tier verdigris fountain, tritons with jets |
| eiffel | 6×6 | 196×440 | 1 | lattice legs (see-through X-bracing), platforms, tapering top, antenna; gravel + lawn; night sparkles + beacon |
| invalides | 8×8 | 260×316 | 1 | church with two-tier portico, columned drum, gilded ribbed dome, lantern + spire, corner chapels, lawns |
| orsay | 10×5 | 244×214 | 1 | limestone station, glass barrel vault, end pavilions with the great clocks on the +j face, arched windows, roof statues |

## Cost

All landmarks are generated at boot by `registerLandmarks` in ≈1.5 s (Node, warm JIT): 15
capitol renders share a geometry/shadow cache per city (states 0–3 identical geometry), secondary
landmarks ≈0.5 s. Atlas footprint ≈3.8 Mpx incl. shadows and all frames (≈1–2 pages of 2048²;
the London Eye's 8 frames are 0.4 Mpx — drop to 4 if atlas space gets tight).

## Tests

- `tests/landmarks-art.test.ts` — registration of every Capitol state / night / shadow / step tile
  and every `LANDMARKS` id; footprint fit (anchor, no overhang below/left); overlays resolve;
  flags tear from state 2, fire from state 3; water + Eye animate.
- `tests/landmarks-preview.test.ts` — compositor smoke test; exports the progress PNGs with
  `M3B_EXPORT=1`.
- `tests/palette-compliance.test.ts` covers all `lm.*` sprites.

## Known gaps / ideas

- Cibeles/Neptune sculpture groups are small at 1× (≈30 px); a bespoke larger sculpture would
  read better.
- The Eiffel Tower's first-level arches are only hinted by two curved members.
- Only state 0 has a night mask; damaged states can reuse it (fires/overlays carry their own
  glow) or M8 can skip windows that are broken.
- No `.small` French/Union flags on secondary Paris landmarks (Invalides could fly one).
