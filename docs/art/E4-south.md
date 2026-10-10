# E4 South — Capitols + landmarks for Rome, Barcelona, Milan

Source: `src/art/landmarks/{rome,barcelona,milan}/` (one line each in `src/art/landmarks/cities.ts`).
Same engine, conventions and overlays as M3b (`docs/art/M3b.md`): analytic iso ray-caster
(`engine/scene.ts`), hand-written materials, RIOT-64 5-level ramps, sun from the upper left,
coloured outlines, every sprite anchored on its footprint's top (north) vertex, `*.night` masks
and `*.shadow` ground shadows for every Capitol and landmark.

Previews: `docs/progress/e4-south-capitols.png` (the three new Capitols under Congreso,
Westminster and Bourbon, same scale, 2×), `e4-south-damage.png` (states 0→4 per city, 2×),
`e4-south-landmarks.png` (all twelve secondary landmarks with shadows, 2×). Review images can also
be exported with `M3B_EXPORT=1 npx vitest run tests/landmarks-preview.test.ts` (SPECS now include
rome, barcelona, milan).

## Files

| File | What |
|---|---|
| `rome/common.ts` | Shared South kit (imported by barcelona/ and milan/): ramps `S.*` (travertine, sienna, terracotta, basalt, milanStone, stucco, redBrick, candoglia, sandstone, ironGreen), sampietrini / slab / sauló / lawn grounds, `coppi()` terracotta roofs, `windows()` damage-aware window slots (fire overlays + soot), wall holes (`inHole`, `holeRim`, `holeCut`), `interior()`, elliptic solids (`ellCyl`, `ellR`, `ovalBasin`), window factories (`winPediment`, `winArch`, `winSquare`) |
| `rome/montecitorio.ts` | Capitol: Palazzo Montecitorio + obelisk |
| `rome/landmarks.ts` | Pantheon, Trevi, Vittoriano, Colosseum |
| `rome/figures.grid.ts` | Oceanus group, quadriga, equestrian Vittorio Emanuele II, niche figure |
| `rome/flag.ts` | `ITALY` (`lm.flag.it`) |
| `barcelona/parlament.ts` | Capitol: Parlament de Catalunya |
| `barcelona/landmarks.ts` | Arc de Triomf, Cascada, Monument a Colom, Sagrada Família (+ crane helper) |
| `barcelona/figures.grid.ts` | Desconsol, Columbus, griffin |
| `barcelona/flag.ts` | `SENYERA` (`lm.flag.cat`), re-exports Madrid's `SPAIN` (`lm.flag.es`) |
| `milan/marino.ts` | Capitol: Palazzo Marino + Leonardo monument |
| `milan/landmarks.ts` | Duomo, Galleria, La Scala, Castello Sforzesco |
| `milan/figures.grid.ts` | Leonardo, his pupils, the Madonnina |

## Capitols — `lm.capitol.<city>.<state>`

All three are 9×6 (contract), front (portal, steps, flags) on the lit +v face, 5 damage states
with the M3b semantics, `.night`, `.shadow` (anchor (98, 0)) and `.steptile`.

| City | Building | Sprite | Anchor | Step stone | Flag overlays (state 0) |
|---|---|---|---|---|---|
| rome | Palazzo Montecitorio | 244×244 | (98, 122) | travertine | `lm.flag.it` (19, −54) |
| barcelona | Parlament de Catalunya | 244×238 | (98, 116) | pale limestone | `lm.flag.cat` (2, −52), `lm.flag.es` (33, −37) |
| milan | Palazzo Marino | 244×246 | (98, 124) | Milan grey stone | `lm.flag.it` (19, −52) |

Shadows: rome 325×165, barcelona 304×154, milan 306×155. Always read overlay offsets from
`landmarkOverlays()`.

- **Montecitorio**: Bernini's front as five stepped segments (centre proudest: the gentle
  convexity, kept to crisp 2:1 edges), sienna render in travertine frames, giant pilasters with
  the rough "scogli" rustication low down, balconied piano nobile with iron railings, four-column
  portal under the central balcony, clock attic with bell gable, terracotta coppi roof with the
  Aula's glass lantern. The red-granite obelisk (globe + spike) stands front-left on the
  sampietrini, with the bronze meridian line in the paving. Banner `BASTA!`.
- **Parlament**: ochre stucco palace with white-stone trims, rusticated ground floor with arched
  windows, alternating triangular / segmental pediments, urn balustrade, end pavilions, central
  pavilion with three-arch loggia, balcony, giant Corinthian order and the pediment with the
  Catalan arms; slate roofs; the oval pond with Llimona's *Desconsol* and park lawns in front.
  Senyera and Spanish flag on two poles. Banner `PROU!`.
- **Palazzo Marino**: grey Mannerist front, rusticated (bugnato) ground floor with barred arched
  windows and mezzanine, pedimented piano nobile between coupled pilasters, half-columns and a
  column-borne balcony at the centre, deep modillion cornice, balustrade with obelisk finials,
  terracotta roof; Leonardo on his pedestal with three visible pupils in a hedged garden on
  Piazza della Scala. Banner `SCIOPERO`.

Damage states (all three): 1 graffiti/posters on walls, pedestals, steps + banner · 2 ~60 %
windows smashed, glass lantern panes broken, flags torn, rubble, lamps out, lawns trampled ·
3 burning/gutted windows with soot plumes and fire overlays, scorched roof + smoke; Rome: the
obelisk's bronze globe has fallen onto the piazza, clock dial sooted; Barcelona: *Desconsol*
toppled into the pond, arms sooted; Milan: Leonardo toppled · 4 one column broken with a fallen
drum, holes torn in the front and side walls (brick rims, burning interior), roofs burnt through
with large fires, shortened flagpoles; Rome: obelisk snapped with its top lying across the
piazza, bell gable broken and burning, clock smashed; Barcelona and Milan: rooftop urn/finial
lost.

## Secondary landmarks — `lm.<id>` (+ `.night`, `.shadow`)

| id | Footprint | Sprite | Anchor | Frames | Notes |
|---|---|---|---|---|---|
| pantheon | 5×4 | 148×154 | (66, 80) | 1 | eight grey-granite columns (+ inner pair), `M AGRIPPA` bronze frieze, pediment, intermediate block with bronze doors, brick rotunda with cornice rings and relieving arches, stepped rings, lead dome with oculus |
| trevi | 4×3 | 116×132 | (50, 74) | 4 @ 6 | Palazzo Poli face, triumphal centre with paired columns, deep exedra with Oceanus on his shell chariot (sea-horse, triton), side niches with allegories, attic statues + papal arms; travertine scogli with moss; animated falls and rippling oval basin |
| vittoriano | 10×6 | 260×258 | (98, 128) | 1 | Botticino terraces with relief panels, two grand flights, side fountains, bronze equestrian Vittorio Emanuele II on his pedestal, concave 16-column colonnade with `PATRIAE UNITATI`, two propylaea crowned with bronze quadrigas |
| colosseum | 10×8 (edge) | 292×242 | (130, 96) | 1 | 48-bay four-tier elliptical arcade (half-columns, attic windows), outer ring broken away on the +u side in stepped brick-buttressed ends, inner ring with ragged top, stepped cavea with radial walls and grass, arena half wooden floor / half open hypogeum |
| arcTriomf | 3×2 | 84×134 | (34, 92) | 1 | red-brick Mudéjar gate, see-through arch along v, moulded archivolt, stone relief frieze, rhombus brick patterns, blind-arcaded attic, corner turrets with stone caps and gilded balls, crowned crest |
| cascada | 5×3 | 132×158 | (50, 92) | 4 @ 6 | triumphal arch with paired columns, grotto with the Birth of Venus, rocks, three animated water steps, side wings with stairs and balustrades, aedicule with the gilded quadriga of Aurora, griffins spouting into the pond |
| columbus | 3×3 | 100×232 | (50, 182) | 1 | stepped round base, two bronze lions, octagonal pedestal with bronze reliefs, drum with allegories, cast-iron column with gilded bands, bronze capital, globe crown and Columbus pointing out to sea |
| sagradaFamilia | 7×5 (edge) | 196×292 | (82, 194) | 1 | Nativity façade on +v (dark, dripping carving, three portals, green Tree of Life), four Nativity + four Passion bell towers with spiral slits and mosaic mitres, Jesus tower with the glass cross, four Evangelists (coloured symbols), Mary's tower with the star, fruit pinnacles on the nave, unfinished concrete Glory end with scaffolding, two yellow tower cranes |
| duomo | 10×6 | 260×302 | (98, 172) | 1 | five-aisled Candoglia nave in three stepped heights with lancet rows, transept, polygonal apse, ~80 guglie in six rows plus flying-buttress ribs, stepped west front on +u with piers, spires, five portals and the great window, octagonal tiburio, lacy main spire and the gilded Madonnina (glows at night) |
| galleria | 8×5 | 212×206 | (82, 100) | 1 | four palace blocks (shop arcades, three window storeys, coppi roofs), glass-and-iron barrel vaults on both arms, octagon drum + glass dome, triumphal arch with glazed lunette and columns on +u, cross-arm entrance on +v |
| laScala | 6×5 | 180×188 | (82, 98) | 1 | Piermarini front: rusticated base, carriage porch with three arches and terrace, paired columns, pediment relief; terracotta roof; Botta's fly tower and elliptical drum behind; lamps |
| castello | 10×8 (edge) | 292×274 | (130, 128) | 1 | brick curtain walls with Ghibelline swallowtail merlons and machicolations, two round torrioni in diamond-point stone with brick crowns, Filarete tower (gate, Sant'Ambrogio niche, clock, loggia, two-tier tempietto, cupola), Rocchetta / Corte Ducale and the Torre di Bona inside, gravel courtyard, lawn moat, bridge |

Water features (trevi, cascada) animate like Cibeles/Concorde (rippling basins + dashed falls
and jets); everything else is static.

## Orientation notes for blueprints (E2)

- Every Capitol and most landmarks face +v (SW, lit). Exceptions: the **Duomo's west front is
  its +u (SE) face** (the flank with the spires faces +v), so Piazza del Duomo belongs on the
  Duomo's +i side; the **Galleria's triumphal arch is on +u** (toward the Duomo) and its cross arm
  opens on +v.
- The Galleria is drawn as a solid, blocking building (the contract marks it `blocking: true`);
  its passages are dark arch openings, not walkable tiles.
- Montecitorio's obelisk is part of the Capitol sprite (front-left of the footprint); the Trevi
  basin and the Cascada pond fill their footprints' +v halves.

## Tests

`tests/landmarks-art.test.ts` (registration, footprint fit, overlays, flags tear / fires appear),
`tests/palette-compliance.test.ts` (all `lm.*`), and the Capitol/landmark checks of
`tests/cities-complete.test.ts` pass for rome, barcelona and milan.
