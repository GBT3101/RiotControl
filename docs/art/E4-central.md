# E4 Central: Capitols and landmarks for Budapest, Vienna and Prague

Source: `src/art/landmarks/{budapest,vienna,prague}/`. Each folder has an `index.ts` (`LandmarkCity`),
the Capitol builder, `landmarks.ts`, `flag.ts`, and `sprites.grid.ts` for the hand-drawn figures where the city has any. All three are
registered in `src/art/landmarks/cities.ts` with one line each. Gallery: `gallery.html?group=landmarks&filter=budapest`
(also `vienna` and `prague`). Previews: `docs/progress/e4-central-*.png`:

- `capitols-vs-m3b`: the six Capitols at 1×, state 0, Congreso, Westminster and Bourbon first.
- `damage`: states 0→4 for each new Capitol.
- `landmarks`: all 11 secondary landmarks at 1×.
- `night`: the night-lights masks over a darkened sprite.

Everything follows docs/art/M3b.md: the analytic iso ray-caster (`engine/`), 5-level RIOT-64 ramps,
light from the upper left, coloured outlines and cast shadows. Each sprite is anchored on its footprint's top vertex and
faces +v (the lit SW side). Each landmark has `.night` and `.shadow` sprites. The Capitols also have a `.steptile`.

## Capitols: `lm.capitol.<city>.<0-4>`

| City     | Building                         | Footprint | Sprite  | Anchor    | Identity cues                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | -------------------------------- | --------- | ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| budapest | Országház (Hungarian Parliament) | 16×6      | 356×316 | (98, 138) | white Süttő-limestone neo-Gothic range; 16-sided drum with lancets and a pinnacle crown; ribbed ogival red-brown dome; lantern and tall ribbed spire; two chamber blocks with steep roofs and 4 slender towers each; end pavilions with corner turrets; gabled risalits; a pinnacle on every buttress; Kossuth tér entrance with a pointed gable, rose window and portal, flanked by two slender spire-towers; lion stair; lawns; the big Kossuth tér flagpole                                |
| vienna   | Parlament (Austrian Parliament)  | 12×7      | 308×204 | (114, 50) | octastyle Corinthian portico on a podium with a red-ground gilt frieze and relief pediment; two ramps with balustrades and horse tamers at their feet; corner pavilions with pediments and half-columns; bronze quadrigas on the pavilion corners; attic statues; central hall clerestory; green copper roofs; the **Pallas Athene fountain** (gilded helmet, spear, Nike, marble column-plinth, basin) in front                                                                              |
| prague   | Pražský hrad and St Vitus        | 14×6      | 324×348 | (98, 186) | long pale south front of the palace on its terrace wall, with 4 window rows, a central risalit and a gate; terracotta roofs and dormers; the New Castle Steps; garden balustrade and trees; behind it, the dark St Vitus with twin west spires, nave, flying buttresses, apse and crossing flèche, a diamond-patterned slate roof, and the **Great South Tower** with gilt clocks and a stacked green copper Renaissance helmet; St George's Basilica (red front, two pale towers); west wing |

Top margins are trimmed to the tallest point. Overlay offsets come from `landmarkOverlays()`.

| State | Budapest                                                                                                                                                                                                                                                                                | Vienna                                                                                                                                                                                            | Prague                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | pristine, `lm.flag.hu`                                                                                                                                                                                                                                                                  | pristine, `lm.flag.at`                                                                                                                                                                            | pristine, `lm.flag.cz`                                                                                                                                                                                    |
| 1     | graffiti and posters on the range, pavilions, porch, stair and lion pedestals; banners `ELEG!` / `NEM!`                                                                                                                                                                                 | graffiti on the pavilions, podium, ramps and stair; banners `GENUG!` / `NEIN!`                                                                                                                    | graffiti on the terrace wall, palace and steps; banners `DOST!` / `NE!`                                                                                                                                   |
| 2     | about 60 % of windows smashed (including the drum and rose window); rubble; lamps out; lawns trampled; flag `.torn`                                                                                                                                                                     | the same; skylight smashed                                                                                                                                                                        | the same                                                                                                                                                                                                  |
| 3     | burning and gutted windows with soot plumes and fire overlays; one chamber roof scorched with smoke; dome scorched; one lion toppled                                                                                                                                                    | burning windows and soot; a pavilion roof scorched with smoke; pediment relief sooted; frieze darkened; one quadriga thrown onto the ground; one horse tamer gone                                 | burning windows and soot; palace roof scorched with smoke                                                                                                                                                 |
| 4     | roofs burnt through, with embers on the wall tops and 3 fires; holes torn in the range; dome holed and burning; the **dome spire snapped** (fire and smoke on the stump); a portal tower and a chamber tower broken; pinnacles knocked off; both lions down; debris; flagpole shortened | 2 columns broken with fallen drums; gap in the entablature and pediment; wall holes; roofs burnt through; **Athena toppled into her basin**; quadrigas and attic statues gone; flagpole shortened | palace roof burnt through in two places; wall holes; **the green helmet of the Great South Tower snapped and burning**; one west spire broken; nave roof on fire; a garden tree burnt; flagpole shortened |

Night (`lm.capitol.<city>.night`, state 0): lit windows, the drum and lucarnes. Budapest's dome
ribs and spire ribs are floodlit gold. Vienna's portico columns are floodlit and the Athena statue is lit. In Prague the St Vitus lancets and the
Great South Tower clocks glow. The step tiles use granite for Budapest and Vienna and the terrace stone for Prague.

## Secondary landmarks: `lm.<id>`

| id                | Footprint | Sprite  | Anchor     | Notes                                                                                                                                                                                                                                                                                                                         |
| ----------------- | --------- | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stStephens        | 5×7       | 196×206 | (114, 108) | Greek cross in sandstone; great dark-copper dome on a pilastered drum with a lucarne ring, lantern and cross; twin bell towers with clocks, belfries and copper caps; hexastyle portico with pediment and stair on the +v front                                                                                               |
| budaCastle        | 12×5      | 276×230 | (82, 92)   | castle-hill retaining wall (rusticated, buttressed, gate) with a terrace balustrade; long neo-baroque palace with end pavilions; central portico risalit; columned drum; green copper dome and lantern; Turul on its pillar; trees                                                                                            |
| fishermansBastion | 8×3       | 180×150 | (50, 60)   | white neo-Romanesque arcade (see-through arches); crenellated walkway; lower terrace with a stair; 7 turrets with stone-scale conical roofs, the middle one tallest with little cones around it                                                                                                                               |
| kossuth           | 2×2       | 68×78   | (34, 44)   | stepped granite base; marble pedestal with bronze reliefs; bronze Kossuth with 4 ministers at his feet                                                                                                                                                                                                                        |
| rathaus           | 10×6      | 260×248 | (98, 118)  | neo-Gothic: arcaded loggia; lancet rows; Wimperg gables; end pavilions with steep pyramid roofs and turrets; 4 flanking towers; central tower with portal, balcony, clock, octagonal stage, spire and the gilt **Rathausmann**                                                                                                |
| hofburg           | 12×5      | 276×230 | (82, 92)   | **concave Neue Burg wing**: 14 chord segments of one arc; rusticated ground floor; shaded loggia behind a paired colonnade; attic statues; end pavilions; green copper dome behind; small Austrian flag (`lm.flag.at.small`)                                                                                                  |
| stephansdom       | 7×4       | 180×246 | (66, 156)  | steep glazed-tile roof with yellow/green/white/black **zigzag bands**; a 2× **double-headed eagle** mosaic over the choir; Wimperg gables; Heidentürme; north tower with its Renaissance cap; the **Steffl** south tower with an octagonal belfry, crocketed openwork spire and cross                                         |
| bridgeTower       | 2×2       | 68×148  | (34, 114)  | dark Gothic tower; pointed gate arch cut right through (along v); sculpture gallery and heraldic band; steep slate cap with 4 corner turrets and a dormer                                                                                                                                                                     |
| oldTownHall       | 5×3       | 132×182 | (50, 116)  | tower with ashlar, gallery and Gothic cap; **Orloj** with an astronomical dial (blue day sky, dark night, gilt ring, off-centre zodiac ring, hand) and a calendar dial below; apostle windows; canopy; flanking figures; oriel chapel; 3 house fronts (one is the sgraffito House at the Minute); the gilt Renaissance window |
| tynChurch         | 4×3       | 116×220 | (50, 162)  | dark nave with a very steep slate roof; two separated towers, each crowned by a main spire, 8 spirelets and gilt finials; west gable with the gilt Madonna; Týn school with an arcade and gable                                                                                                                               |
| dancingHouse      | 3×2       | 84×108  | (34, 66)   | "Fred": cream panels, wavy cornice lines and staggered windows; the twisted-mesh **Medusa** dome; "Ginger": pinched glass hourglass on slender legs                                                                                                                                                                           |

The secondary landmarks are static (1 frame). All the art is RIOT-64 only (`tests/palette-compliance.test.ts`).

## Flags

| code | Design                                                        |
| ---- | ------------------------------------------------------------- |
| `hu` | red, white, green (horizontal)                                |
| `at` | red, white, red                                               |
| `cz` | white over red with the blue wedge to the middle of the cloth |

## Verification

- `tests/landmarks-art.test.ts`, `tests/palette-compliance.test.ts` and `tests/landmarks-preview.test.ts` pass
  (SPECS entries for the three cities were added).
- In `tests/cities-complete.test.ts`, the Capitol, flags and landmark checks for budapest and vienna pass. Prague's
  blueprint was not registered yet when this was written.
- The pieces were iterated at 3–4× and compared at 1× against Congreso, Westminster and Bourbon (`capitols-vs-m3b`).

## Known gaps

- The Hofburg's dome is a generic green Hofburg dome (Michaelerkuppel-style). It does not stand where it would on a
  real map of the Neue Burg.
- Ginger's glass has no floor-slab banding. Fred's windows only approximate the real irregular pattern.
- Only state 0 has a night mask, as for the M3b Capitols.
