# Wave forecast — "where does the next wave come from?"

Owner feedback (iPhone playtest): _"We need clear indication from where the waves are going to
come from, both in mini map and main map."_ Kingdom Rush-style incoming-wave markers, in the
game's pixel-art look. Screens: `docs/progress/wave-forecast-*.png`.

## What the player sees

Shown during the prep phase, every breather and the first **10 s** of a wave (fades in/out),
for every spawn district that will release protesters in that wave:

| Where                         | What                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Main map, district on screen  | A waving crimson **rally banner** planted on the district's rally point (1–3 **"!"** marks = crowd size), a pulse ring at its foot, a plate with the crowd icon + expected head count, a hi-vis **NEW** tag when the district releases protesters for the first time, a round **badge** with the head and shoulders of the type leading the wave (a type joining the mix this wave, else cultists / prophets; Breta once she is out of that district). |
| Main map, district off screen | A crimson **map-pin pointer** on the screen edge, its point aimed at the district (8 directions), same "!" marks, count tag, NEW tag, badge (Breta / joining types only). Pointers stay clear of the minimap, the map toggle, the unit panel, the wave button + countdown and each other (they slide along their edge first).                                                                                                                          |
| Ground                        | A trail of iso **chevrons** painted on the street from the rally point ~22 tiles toward the Capitol, along the crowd's real route (the Capitol flow field — it bends around blockades). A bright pulse runs down the trail toward the Capitol.                                                                                                                                                                                                         |
| Minimap                       | A blinking flag on each district (ink keyline, white pole), a faint dotted route to the Capitol with a bright runner dot, a blinking hi-vis diamond around NEW districts.                                                                                                                                                                                                                                                                              |
| Advisor                       | Once per profile, at the first breather before a district joins in: _"Protesters gather at the red flags. A new district joins in. Get ready."_ (touch: _"… Tap one to look."_). `?hint=forecast` shows it.                                                                                                                                                                                                                                            |

Tap a banner or a pointer: the camera eases to the district (instant with reduced motion).
Hover (desktop) / long-press (touch): tooltip `LAVAPIÉS (NEW): ABOUT 40 PROTESTERS GATHER HERE.
LED BY DOOMSDAY CULTIST.` In deploy mode the markers let taps through to the placement.

Accessibility: crowd size, direction and novelty are shapes (number of "!" marks, the pin's
point, the NEW text, the chevron direction), never colour alone. Reduced motion (Settings →
screen shake off, or the OS preference on first run) freezes the waving, pulses, blinking and
the pan. Touch targets: banner hit rect 34×50 UI px, pointer 36×52 UI px (≥ 44 CSS px on every
phone UI scale).

## Code

| File                         | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/sim/forecast.ts`        | Read-only forecast. `waveForecast(world, prevWaveLevel)` → `{ wave, phase, eta, size, districts[{ district, id, name, rally, isNew, expected, threat 1–3, breta }], types, newTypes, lead }`; `Forecaster` (remembers the level at each wave start → `newTypes`, caches routes per flow-field recompute); `districtRoute` / `routeFrom` (steps down `nav.flowX/Y`); `leadType`, `typesJoining`, `threatTier` (`THREAT_TIERS` = 40 / 150 per district). Never touches the sim RNG (test: identical state hash with and without forecasting). |
| `src/view/forecastView.ts`   | Owns the `Forecaster`, the shared fade (`alpha`), the wave window (`FORECAST_WAVE_SECONDS`) and the chevron trails in the `marks` layer. `WorldView.forecast`.                                                                                                                                                                                                                                                                                                                                                                              |
| `src/ui/hud/forecast.ts`     | `ForecastMarkers`: banners / pointers / plates / tags / badges, taps, tooltips, pan. Created by `Hud` (`hud.forecast`), which also sets `enabled` (off on the title backdrop and with `hud=0`).                                                                                                                                                                                                                                                                                                                                             |
| `src/ui/hud/forecastEdge.ts` | Pure placement math: `onScreen`, `edgePoint` (ray to the area edge, then slide off avoid-rects), `formatCount`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/ui/hud/minimap.ts`      | Flags, routes and NEW diamonds in the overlay pass (~6 Hz).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/art/fx/waveMarkers.ts`  | Art: `fx.forecast.chevron.<dir>` (8 tile directions × dim/lit/bright, rasterised in tile space so edges are clean 2:1 iso lines), `ui.forecast.flag.t1..3`, `ui.forecast.ring`, `ui.forecast.new`, `ui.forecast.edge.<dir>.t<n>`, `forecastPlate`, `forecastCountTag`, `forecastBadge`, `MINIMAP_FLAG`. Registered via `registerFx` (gallery group `ui`, palette-tested).                                                                                                                                                                   |
| `tests/forecast.test.ts`     | Forecast rules, read-only/determinism, routes (fixture + all three cities), Forecaster new types, Breta pinning, view window/fade, edge placement, count format.                                                                                                                                                                                                                                                                                                                                                                            |

Cost: forecast refresh ≈ 3×/s (a handful of districts, routes cached until the flow field
recomputes); per frame ≤ ~90 chevron sprites and ≤ 7 marker nodes. Measured in headless
Chromium (1440×900, Madrid wave 4, 5 districts): `ForecastMarkers.update` 0.03 ms,
`ForecastView.update` 0.05 ms. Nothing scales with the crowd size.

## How the forecast is derived (and the cleaner API it would like)

The director keeps most of its state private, so the forecast recomputes it from the same data:

- **Districts**: `Director.activeDistricts(wave)` (public). NEW = not active in `wave − 1`.
- **Size**: `waveSize(wave, level, time + breather)`; door groups pick a district uniformly, so
  each expects `size / districts`. During a wave: `director.waveSize`.
- **Types**: `unlockedProtesters(level)`; "lead" = the director's `newestBoost` rule; "joining"
  = unlocked since the previous wave began (the director's `joined` map is private, so the
  `Forecaster` records the level when it sees each wave start).
- **Breta** is a 1 % roll per door group, unknowable ahead; once out, `crowd.district[bretaSlot]`.

A cleaner director API would make the forecast exact and stateless:

1. `director.plan(wave)` → `{ size, districts, weights by type }` computed by the same code
   `beginWave` uses (today `beginWave` both computes and commits).
2. `director.joinedWave(type)` (or expose `joined`) for "types joining this wave".
3. Pre-roll Breta per wave (e.g. when the breather starts) so the marker can warn ahead.
4. `director.waveStartTime` (the view tracks it itself today).

## Debugging

`window.__riot.ui.game.view.forecast.current` is the live forecast; to frame a breather:

```js
const g = __riot.ui.game,
  d = g.world.director;
d.wave = 3;
d.phase = 'breather';
d.breather = d.breatherTotal = 20; // forecasts wave 4
g.focusTile(7, 6);
```

Then `?city=madrid&level=8&tutorial=0&hints=0&mute` shows NEW (Salamanca), cultist badges
and all five Madrid districts.
