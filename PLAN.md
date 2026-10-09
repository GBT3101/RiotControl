# RIOT CONTROL — Master Plan

> *"Order has been restored. But at what cost?"*

An isometric, pixel-art, horde-scale tower/castle-defense parody for web (desktop + mobile).
Hordes of protesters pour out of their homes across a stylised Madrid, London or Paris and march
on the Capitol. You are the Ministry: you place riot police, snipers, blockades and,
as your *Legitimacy* grows, increasingly absurd firepower. Your own fallen men feed your
Legitimacy. Every death feeds your *Hate*. Both sides are the joke.

This document is the **single source of truth** for design, art direction, architecture and
the milestone roadmap. `HANDOFF.md` is the live status log. Every agent working on this repo
reads both before touching code.

---

## 0. Decisions already locked (from the product owner)

| Topic | Decision |
|---|---|
| Run structure | **Waves + Capitol HP.** Prep phase → escalating waves with short breathers and a "call next wave early" bonus. Capitol has an Integrity bar; if it reaches 0 the regime falls (game over). Win at **5000 Legitimacy**. |
| Map scale | **Large pannable city** (~3–4 screens wide), drag/pinch pan, wheel/pinch zoom (integer pixel steps), minimap. |
| Audio | **Procedural** SFX + music via WebAudio (no audio files). Mute toggle. |
| Violence | **Cartoon blood**: small pixel blood puffs/splats from *lethal* weapons only (L5+). Non-lethal kills (batons, rubber, gas) = KO stars / dizzy birds. Bodies fall, stay, get trampled/fade. |
| Cities | Madrid, London, Paris. Layout knowledge of the ~5 km around the parliament, condensed & re-drawn by hand in pixel art. No real map tiles used. |
| Platforms | Desktop web + mobile web (touch). Landscape is primary; portrait must remain playable. |
| Art | All art authored by Opus 5.5 subagents at **high effort**. No image-generation models, no stock assets, no external sprite packs. |

Environment note: OSM/Overpass/Nominatim are blocked by the sandbox network policy; city
knowledge comes from the agents' geographic knowledge (allowed by the brief: "just get the knowledge").

---

## 1. Game design

### 1.1 Core loop
1. **Prep phase** (first wave only: untimed until the player presses *"Let them come"*; later
   breathers are 12–20 s). Player spends Hate to place units.
2. **Wave**: protesters burst out of residential doors across the city, merge into crowds on the
   streets and flow along the road network toward the Capitol.
3. Units fight; everybody dies eventually. Deaths pay out:
   - Any **player unit** death → **+10 Hate** and **+X Legitimacy** (per-unit table below).
   - Any **protester** death → **+1 Hate** (Breta → **+100 Hate**).
4. Legitimacy crosses thresholds → **Level up** → new units unlock *and* new protester types join
   the mix (escalation spiral — the satire is that your escalation causes theirs).
5. Protesters that reach the Capitol attack it and reduce **Integrity**. 0 → *"The Regime Has Fallen"*.
6. Reach **5000 Legitimacy** → victory → **"At what cost?"** summary.

Start: **100 Hate, 0 Legitimacy, Level 0**, Capitol Integrity 100%.

### 1.2 Levels (Legitimacy thresholds)
| Lvl | Legit | Unlocks unit | New protesters in the mix |
|---|---|---|---|
| 0 | 0 | Riot Control | Students, Violent Woke |
| 1 | 10 | Rubber Sniper (rooftops) | — |
| 2 | 30 | Blockade | Violent Mob |
| 3 | 50 | Tear Gas Shooter | — |
| 4 | 100 | Mounted Riot Police (horse + bat, commandable) | Very Violent Mob (molotovs, shivs) |
| 5 | 200 | Armed Cops (real guns, piercing shots) | — |
| 6 | 300 | Soldiers (automatic rifles) | Crazy Mob (guns) |
| 7 | 500 | Machine-Gun Humvee (commandable) | — |
| 8 | 800 | Sniper Brigade (rooftops, lethal radius) | Doomsday Cultists (assorted weapons, bazookas vs rooftops) |
| 9 | 1200 | Tank (commandable, crushes, friendly-fire AOE) | — |
| 10 | 2000 | Helicopter (invulnerable, commandable) | The Prophets (explode on ground units) |
| — | 5000 | **Victory** | |

Special (any level, **1% per spawn-group roll**, max 1 alive): **Breta** + paparazzi entourage.

### 1.3 Player units (baseline numbers — tuned in M12)

> **Tuned values live in `src/data/*` and `docs/M12.md`** (authoritative). Notable M12 changes beyond the brief: Capitol 18000 HP; breathers 16–24 s; per-type protester resistances to non-lethal damage (cultists/prophets shrug off rubber & gas); Capitol steps deployable for ground units; gas stuns once on entry. Owner-fixed numbers (costs, Legitimacy, Hate payouts, thresholds, start values, win at 5000) are unchanged and test-pinned.
"Legit" = Legitimacy granted when the unit dies. All deaths also grant **+10 Hate**.

| Unit | Cost | Legit | Placement | HP | Attack | Notes |
|---|---|---|---|---|---|---|
| Riot Control | 5 | 5 | Road | 100 | Baton melee 10 dmg / 1.0 s | Shield: −30% melee dmg. Engages up to 3 protesters at once (blocking slots). **Guards** rooftops: a building with an alive Riot Control (or any ground melee unit) within 2.5 tiles of its footprint cannot be climbed. |
| Rubber Sniper | 7 | 10 | Rooftop | 60 | Rubber round 20 dmg / 1.5 s, range 9 | Non-lethal KO visuals. Vulnerable to climbers. When killed by climbers he is **thrown off the roof** (visible arc, flail, impact, body). |
| Blockade | 7 | 10 | Road (snaps across road width, up to 3 tiles) | 400 | — | Physically blocks flow. Protesters attack it; damage states (pristine → dented → wrecked). |
| Tear Gas Shooter | 10 | 15 | Road | 80 | Gas spray cone, range 3, 10 dmg/s + 1 s stun | **Ability**: grenade charges 10 s; when charged, a pulsing icon appears — tap/click the unit to throw at the densest crowd in range (desktop: hotkey `G` throws all charged). Cloud r=2.5 tiles, 6 s, stun + DoT. |
| Mounted Riot Police | 10 | 15* | Road | 200 | Bat 20 dmg / 1.0 s (2× Riot Control) | **Commandable**: select → tap a road tile → paths there (roads only). Fast. Knocks students aside. |
| Armed Cops | 50 | 20 | Road | 120 | Pistol 60 dmg / 1.2 s, range 7, **pierces up to 4** in a line | First lethal unit — blood begins. |
| Soldiers | 100 | 40 | Road | 180 | Auto-rifle bursts 3×25 / 1.4 s, range 8 | Spray spreads across targets. |
| MG Humvee ("hammer") | 300 | 60 | Road | 800 | Roof MG 15 dmg × 10/s, range 8 | **Commandable**. Vehicle armor (melee −50%). Burning wreck when destroyed. |
| Sniper Brigade | 500 | 80 | Rooftop | 150 | 80 dmg lethal shots, 1.0 s, range 14, **splash r=1** | Squad of 3 visible snipers on one roof. Climb-able; bazooka-able. |
| Tank | 600 | 100 | Road | 3000 | Cannon 200 AOE r=2.5 / 4 s, range 10. **Crushes** protesters it drives over. | **Commandable**. Shells hurt *your own* units in the blast. Prophets deal 50% of its max HP each. |
| Helicopter | 1000 | — | Air (anywhere) | ∞ | Door-gun spray 12 dmg × 12/s, range 7 | **Commandable** (any tile). Cannot be harmed. Rotor wash blows tear gas. |

\* Not specified by the brief — chosen value, flagged for the owner.

### 1.4 Protesters
Every protester instance is **visually unique**: seeded paper-doll variant (skin tone, hair style &
colour, top, bottoms, shoes, accessory, sign & slogan, ±1 px height, gait speed ±10%, animation
phase offset). Types must still be readable at a glance by **silhouette + accent colour**.

| Type | From Lvl | HP | Speed | Attack | Look & personality |
|---|---|---|---|---|---|
| Student | 0 | 30 | 1.0 | **None** — just wants to reach the Capitol (still damages it on arrival: 1). | Backpacks, beanies, glasses, tote bags, hand-made cardboard signs with misspellings, phones held up filming. Some chant, some vape. |
| Violent Woke | 0 | 40 | 1.05 | Melee 3 dps; climbs roofs | Dyed hair (pink / blue / purple / green / split-dye), septum rings, oversized thrift jackets, tote bags, megaphones, umbrellas. Furious faces. |
| Violent Mob | 2 | 60 | 1.0 | Melee 6 dps (sticks, bottles, signs-on-poles); climbs | Hoodies, tracksuits, caps, bandanas, bats, traffic cones as helmets. |
| Very Violent Mob | 4 | 70 | 1.1 | Shiv melee 8 dps; **molotov** (range 4, 25 AOE + 4 s fire patch, 6 s cd); climbs | Black bloc, balaclavas, black & white checkered scarves, goggles, backpacks of bottles. |
| Crazy Mob | 6 | 60 | 1.15 | Pistol/revolver 12 dmg / 1.5 s, range 6 | Unhinged: tinfoil hats, bathrobes, wild hair, Hawaiian shirts, mismatched shoes; erratic gait. |
| Doomsday Cultist | 8 | 90 | 0.95 | Mixed loadouts: machete (12 melee), rifle (10 ranged), **bazooka** (80 AOE, range 7, **can target rooftop units**, 8 s cd) | Members of a **fictional** apocalypse cult — "The Order of the Final Hour": hooded hourglass-emblem robes, sackcloth, ritual paint. *Deliberately not referencing any real religion or ethnicity.* |
| The Prophets | 10 | 50 | 1.3 | **Explode** on contact with ground units: 150 AOE r=2; vs Tank: 50% of tank max HP. | The cult's ascended: white robes, wild beards/hair, "THE END IS NIGH" sandwich boards stuffed with comic dynamite; they sprint, arms raised. |
| **Breta** (special) | any | 300 | 0.8 | None herself; aura +25% speed to nearby | Tiny furious climate teen parody: yellow raincoat, braids, scowl, "HOW DARE YOU" sign. **+100 Hate** when downed. |
| Paparazzi (Breta's entourage, 6–10) | with Breta | 50 | 1.0 | **Very violent**: camera-strap melee 15 dps + flash (blinds = 1.5 s stun, 5 s cd) | Vests, lenses, flashes going off constantly (screen-space flash sparkles). |

**Climbing**: climbers (woke, mob, very violent) within 3 tiles of a building that hosts a rooftop
unit and is **not guarded** (see Riot Control) divert, climb drainpipes/balconies (visible climbing
animation up the facade), fight on the roof, and **throw the sniper off** (arc + flail + impact).
Sniper Brigade members get thrown one by one.

**Arrival at Capitol**: protesters reaching the Capitol steps attack it (Integrity damage per
second by type). Capitol has **5 visual damage states** (graffiti → smashed windows → fires →
toppled statues → collapsing).

### 1.5 Waves & director
- Waves are generated by a **director** from (wave index, player level, elapsed time).
- Size curve: wave 1 ≈ 30, ~×1.25 per wave, + level multiplier; late game ≥ 1500 per wave,
  peak concurrency targets: 300 (early) → 3000+ (late, desktop) / 1500 (mobile, auto-detected).
- Spawn districts unlock progressively (1–2 at start → all 5–7 by mid game). Protesters exit
  residential doors (door-open animation), mill briefly, then join the flow.
- Composition draws from unlocked types with weights shifting toward newest types.
- Between waves: breather 16–24 s (M12; brief draft said 12–20 s); "Call early" button grants bonus Hate (= seconds remaining / 2).
- Target run length to 5000 Legitimacy: **35–50 minutes** at 1× speed. Speed toggle 1×/2×(/3×).

### 1.6 Economy rules (exact)
- Player unit death: +10 Hate, +Legit (table). Blockade counts as a unit.
- Protester death: +1 Hate (Breta: +100). Paparazzi: +1.
- Hate is never refunded on selling (no selling — the Ministry never admits mistakes).
  *(Optional later: "Reassign" = unit walks off map, no refund.)*
- Level-ups are instant; a fanfare banner + unlock card ("NEW TOOL OF ORDER APPROVED").

### 1.7 Controls
| Action | Desktop | Mobile |
|---|---|---|
| Pan | Drag (LMB/MMB), WASD/arrows, edge-scroll (option) | One-finger drag |
| Zoom | Wheel (integer pixel steps, eased) | Pinch |
| Deploy | Click card (or 1–0 hotkeys) → valid tiles glow → click to place; ghost preview; RMB/Esc cancels; Shift keeps placing | Tap card → valid tiles glow → tap tile → ghost + ✔ confirm button (prevents misplacement while panning) |
| Select / command mobile unit | Click unit → click road tile | Tap unit → tap road tile |
| Gas grenade | Click charged unit / `G` | Tap charged unit |
| Pause / speed | Space / `F` | HUD buttons |

### 1.8 End states
- **Victory** (5000 Legit): animated pixel newspaper front page (city-localised parody masthead:
  *El Orden* / *The Daily Order* / *L'Ordre du Jour*) headline "ORDER RESTORED" + stats ledger:
  protesters fallen by type (with mini portraits), officers lost by type, Breta downed?, Hate
  spent, peak crowd, time, Capitol damage. Closing line: **"You kept order. But at what cost?"**
- **Defeat** (Integrity 0): newspaper "THE REGIME HAS FALLEN" + protesters dancing on the Capitol.

### 1.9 Tutorial & hints
- Advisor character: **The Minister of the Interior** (sweaty, pencil moustache, sunglasses,
  ministry lanyard) appears in a pixel portrait box with typewriter text and blink/talk animation.
- First run per city (skippable, replayable from settings): 6–8 short steps — pan/zoom, deploy
  Riot Control on the road, "Let them come", Hate & Legitimacy explained ("Every fallen officer
  makes us *more* legitimate. Isn't democracy beautiful?"), level-up → sniper on roofs, guard
  the roof with Riot Control.
- Contextual hints (once each): first sniper thrown, first blockade broken, low Hate, Capitol
  under attack, first ability charged, first commandable unit, Breta sighted, Prophets sighted.
- Loading-screen/breather tips with satirical tone.

### 1.10 Tone & writing
Parody on **both** sides, never hateful toward real groups. The government is a cynical machine
that profits from its own losses; the protesters are absurd, earnest, violent, filming
themselves. Slogans are generic or self-parodying ("I'D RATHER BE HERE", "DOWN WITH THINGS",
"¡NO A TODO!", "MERDE ALORS", "OI! NO!", "MY SIGN IS BIGGER THAN YOUR ARGUMENT"). City flavour
in text (Spanish/English/French snippets). All strings live in `src/data/strings/`.

---

## 2. Cities (condensed ~5 km radius, re-drawn — not traced)

Each map: ~**72×72 iso tiles**, Capitol placed so that a natural barrier (river/park) covers one
side; **4–7 spawn districts** at the edges; avenues 4–6 tiles wide, streets 2–3 tiles;
**2–3 chokepoints** (bridges, narrow streets, plazas as kill zones); rooftops lining avenues.
Real street names appear as pixel street-sign labels and in the minimap.

### Madrid — Capitol: **Congreso de los Diputados** (Palacio de las Cortes)
Neoclassical portico, 6 Corinthian columns, triangular pediment, bronze lions (Daoíz & Velarde)
flanking the steps; Plaza de las Cortes with Cervantes statue.
- Key roads: Carrera de San Jerónimo (→ Puerta del Sol, west), Calle de Alcalá & Gran Vía
  (north-west, Metrópolis dome + winged Victory), Paseo del Prado (north–south boulevard east of
  Congreso: Neptune fountain at Cánovas del Castillo, Cibeles fountain + Palacio de
  Comunicaciones to the north), Paseo de Recoletos/Castellana (north), Calle de Atocha (south,
  Atocha station), Calle Mayor/Plaza Mayor (west).
- Barrier: **Retiro Park** to the east (trees, El Ángel Caído / lake as decoration; few paths).
- Spawn districts: Malasaña (N), Chueca (NNE), Salamanca (NE), Lavapiés (S), La Latina (SW),
  Vallecas (SE edge), Argüelles (NW).
- Style: ochre/terracotta/cream 4–6 storey blocks, iron balconies, red tile roofs, green awnings,
  Tío Pepe sign on Sol, metro "Metro" diamond signs, churros kiosks, red-white buses.

### London — Capitol: **Palace of Westminster**
Gothic revival facade, **Elizabeth Tower** (Big Ben, clock face, gilded spire) and Victoria
Tower; Parliament Square statues & lawn; Westminster Abbey to the SW.
- Key roads: Whitehall (north to Trafalgar Square, Nelson's Column), The Mall (west, Buckingham
  Palace at far end), Victoria Street (SW → Victoria station), Millbank (south along river),
  Great George St / Birdcage Walk, Westminster Bridge & Lambeth Bridge (east, across the Thames
  from Lambeth / South Bank — London Eye, County Hall), Horseferry Rd.
- Barrier: **the Thames** behind the palace; bridges are chokepoints. St James's Park to the W.
- Spawn districts: Camden (N), Soho/Covent Garden (NNE), Shoreditch/Hackney (NE edge),
  Lambeth/Brixton (S across river), Bermondsey/Elephant (SE), Pimlico (SW).
- Style: brown/red brick terraces, Portland-stone whites, slate roofs, chimney pots, red phone
  boxes, red double-deckers, black cabs, Tube roundels, drizzle-grey sky palette.

### Paris — Capitol: **Assemblée nationale (Palais Bourbon)**
12-column Greek portico facing the Seine and Pont de la Concorde, statues on the steps,
tricolour. Across the river: Place de la Concorde (obelisk, fountains).
- Key roads: Pont de la Concorde (north, the critical bridge), Quai d'Orsay (west/east along
  the Seine), Boulevard Saint-Germain (east/south-east), Rue de l'Université, Esplanade des
  Invalides (west, gold dome), Rue de Rivoli & Tuileries (NE across river), Champs-Élysées
  (far NW towards the Arc de Triomphe), Rue Royale → Madeleine (N).
- Barrier: **the Seine** north of the Assemblée; Concorde/Alexandre III/Solférino bridges.
- Decoration landmarks: Eiffel Tower silhouette (W), Musée d'Orsay clocks (E), Invalides dome.
- Spawn districts: Belleville/République (NE), Bastille (E), Latin Quarter (SE),
  Montparnasse (S), Batignolles (N across river), 16e/Trocadéro (W).
- Style: Haussmann cream-limestone blocks, wrought-iron balconies, grey-blue zinc mansard roofs
  with chimney rows, café terraces, Morris columns, Wallace fountains, Vespas, baguettes.

Map data format (code-authored, see M2): road polylines with width and name → rasterised tile
grid; city blocks between roads auto-filled with seeded city-style buildings (2–6 storeys, roof
types) plus hand-placed landmarks; spawn doors, Capitol footprint & approach steps, decoration.
Validators assert every spawn reaches the Capitol and chokepoints exist.

---

## 3. Art bible (binding for every art agent)

**North star**: *Kingdom Rush* readability & charm × modern indie pixel art (think *Into the Breach*
crispness, *Eastward* richness, *Kingdom Two Crowns* atmosphere). Chunky, saturated, cartoon
proportions, rich hue-shifted shading, intentional clusters — **never** programmer art
(flat rectangles, gradients, anti-aliased circles, blurry scaling, noisy random pixels).

### 3.1 Pixel grid & scale
- **Iso tile: 32×16 px** (2:1 dimetric). Storey height 10 px. Building heights 2–6 storeys.
- Humans: **~11×18 px** (big heads ~5–6 px, KR-style chunky hands/feet). Horse+rider 22×24.
  Humvee ~40×28. Tank ~52×38. Helicopter ~60×30 + rotor. Capitol 180–260 px wide.
- Rendering is **pixel-perfect**: nearest-neighbour, integer zoom only (1×–5×; default 3×
  desktop, 2× phones — chosen so ~20–24 tiles span the screen), camera snapped to whole
  world pixels, no sub-pixel sprite positions, no rotated/scaled sprites (rotation must be
  pre-drawn frames). UI is rendered at its own integer scale.

### 3.2 Palette — "RIOT-64"
One master palette (≤ 64 colours) defined in `src/art/palette.ts` as **named hue-shifted ramps**
(3–6 steps each): shadows shift toward cool violet/blue, highlights toward warm yellow.
Required ramps: asphalt, kerb/stone, sidewalk, cobble, Madrid ochre, Madrid terracotta,
London brick, Portland stone, slate, Paris limestone, zinc, foliage, grass, water, metal, glass,
skin ×6 (broad, diverse range), natural hair ×4, dyed hair (pink, blue, purple, green, teal),
police navy, hi-vis yellow, army olive, cult sackcloth/ochre-red, white robe, fire, gas green,
cartoon blood red, UI parchment/manila, UI brass, UI ministry red, night tint.
All sprites use palette colours only (enforced by a test that scans generated textures).

### 3.3 Light, outline, shadow
- Sun from **upper-left**. Iso boxes: top face lightest, left face mid, right face darkest.
- Outlines: characters get a 1 px **dark coloured** exterior outline (darkest tone of the
  adjacent material or `ink` #1a1424-ish — never pure #000), interior lines selective (sel-out).
- Every ground entity has a soft 2-tone dither-free blob shadow (palette `shadow` at ~45% alpha
  is allowed for shadow layers only). Buildings cast pre-drawn shadows to the lower-right.

### 3.4 Animation standards
| Anim | Frames | FPS | Notes |
|---|---|---|---|
| Idle | 4 | 5 | breathing, blink, weight shift; protesters wave signs |
| Walk | 6–8 | 10 | contact/pass poses, bob, arm swing; crowd uses phase offsets |
| Run/charge | 6 | 12 | lean forward |
| Attack | 4–6 | 12 | clear anticipation → impact frame → recovery; impact frame aligns with damage tick |
| Hit | 1–2 | — | white flash frame + 1 px knock-back |
| Death | 6–8 | 10 | stagger → fall → bounce → settle; ends in a **body** frame |
| Body | 1–2 | — | stays 20–40 s (cap & oldest-first fade), trample dust when crowd walks over |
| Climb | 4 | 8 | hands over hands on facade |
| Thrown off roof | 4 flail loop + impact | 12 | spinning flail along a parabolic arc |
| KO (non-lethal) | 3 loop | 6 | stars/birds orbit, then fade to body |
- Directions: draw **SE and NE** (front ¾ and back ¾); mirror for SW/NW. Vehicles: **8 directions**
  (draw S, SE, E, NE, N; mirror the rest). Helicopter rotor is a separate 4-frame layer.
- Squash & stretch on impacts, 1-frame smears on fast melee swings, muzzle flashes 1–2 frames.

### 3.5 Readability & team language
- **Ministry side**: navy + hi-vis yellow accents (police), olive (army), blue selection ring.
- **Protesters**: warm, chaotic, multicolour; type accent: student = backpack/cardboard,
  woke = neon hair, mob = hoodie grey/red, very violent = black + checkered scarf, crazy =
  garish patterns, cult = ochre-red robes, prophets = white robes, Breta = yellow raincoat.
- Health bars only on damaged entities, tiny (8×1 px), hidden when the crowd is dense unless hovered.

### 3.6 UI art direction — "The Ministry Dossier"
Manila folders, typewritten labels, red rubber stamps ("APPROVED", "CLASSIFIED", "DENIED"),
brass plaque buttons, paper-clip details, chunky 2–3 px bevels — Kingdom Rush chunkiness in a
bureaucratic skin. **Custom bitmap pixel font** authored in code (small 5×7-ish, large ~8×12,
Latin-1 incl. á é í ó ú ñ ç à è ê ô ü ¡ ¿ £ €). Icons: Hate = cracked crimson heart; Legitimacy
= gold wax seal/stamp; Integrity = Capitol pediment.

### 3.7 Atmosphere
- Waves cycle **day → golden hour → dusk → night (streetlights, fire glow, flashing
  sirens) → dawn** via palette-aware colour grading + additive light sprites.
- Ambient life: pigeons that scatter, curtains twitching in windows, residents peeking,
  flags fluttering, smoke from chimneys, river shimmer, litter accumulating as riots grow.
- Juice: screen shake (tiny, integer px), hit-stop on big hits (40 ms), floating "+1 ✊" Hate
  pickups that fly to the HUD counter, Legitimacy seal "stamps" on officer death.

### 3.8 Authoring method (how art is produced in code)
All art is generated **at boot** from source authored by agents:
1. **Pixel grids**: sprites/frames written as string grids with single-character palette keys
   (`'.'` transparent), parsed to `ImageData`. Used for characters, props, icons, font, faces.
2. **Paper-doll layers**: base body frames + per-frame anchored overlay layers (hair, headwear,
   top, bottoms, held item, sign) with **semantic keys** (e.g. `H` hair, `S` shirt) remapped to
   variant ramps → thousands of unique protesters from a hand-made base.
3. **Procedural painters** (only for large repetitive surfaces — facades, roofs, terrain): code
   that places *hand-authored* modules (window, balcony, door, cornice pieces drawn as grids)
   with seeded variation, then a finishing pass (edge highlights, AO, grime). Never raw noise.
4. Everything is packed into atlases at boot (cached); a **gallery page** shows every sprite and
   animation at 1× and 4×, and a Playwright script exports PNGs for review.
5. Art agents must **look at their output** (export PNG → view) and iterate before handing off.

---

## 4. Technical architecture

**Stack**: TypeScript (strict) · Vite · PixiJS v8 (WebGL, WebGPU when available) · Vitest ·
Playwright (pre-installed Chromium) for screenshots/smoke tests · ESLint + Prettier.
No other runtime deps without orchestrator approval. Deployed as static site (GitHub Pages
workflow, `base: './'`).

```
index.html              game entry           gallery.html  dev sprite gallery
src/
  main.ts               boot: atlas build → title screen
  core/                 loop (fixed 30 Hz sim, interpolated render), rng (seeded), events, iso math, time scale
  render/               pixel-perfect stage, camera (pan/zoom/inertia/bounds), layers, depth sort, chunked terrain RT, light/colour grade
  art/
    palette.ts          RIOT-64 ramps
    lib/                grid parser, painter, paper-doll compositor, outline, atlas packer
    tiles/ buildings/ capitols/ props/ characters/ protesters/ vehicles/ fx/ ui/ font/ portraits/
  data/                 units.ts, protesters.ts, levels.ts, waves.ts, balance.ts, strings/{en,es,fr}
  maps/                 format.ts, rasterize.ts, validate.ts, madrid.ts, london.ts, paris.ts
  sim/                  world (SoA typed arrays), spatial hash, flow fields, crowd steering,
                        combat, projectiles, status effects, behaviours/, director, economy, capitol
  view/                 entity views, animation state machines, bodies & decals, fx, floaters
  ui/                   HUD, deploy bar, placement, selection/commands, screens/, tutorial/, widgets
  audio/                synth engine, sfx, adaptive music
tools/                  shoot.mjs (Playwright PNG export), playtest.ts (headless balance bot)
tests/                  vitest suites
docs/progress/          curated screenshots per milestone (small PNGs)
```

### 4.1 Simulation
- **Deterministic** fixed-step sim (30 Hz) independent from rendering; seeded RNG; headless-runnable
  in Node for tests and balance bots.
- Crowd = **struct-of-arrays** typed arrays (position, velocity, type, variant, hp, state, target…),
  capacity 4096+ with free-list. Player units/vehicles/projectiles in a small object world.
- Movement: per-tile **flow fields** to the Capitol (recomputed incrementally when blockades/units
  change costs) + local steering (separation via **uniform spatial hash**, alignment, wall
  avoidance) so hordes spread across wide roads and pile up at blockades.
- Engagement: units expose a limited number of melee "slots"; surplus protesters press around/past.
- Rooftops: buildings have roof polygons + climb points; climbing is a scripted state machine.
- Bodies are sim-light records (position, type, variant, ttl); trampling = crowd overlap counter.

### 4.2 Rendering
- World container drawn at integer zoom; terrain baked into chunked render textures; buildings,
  units, bodies depth-sorted by iso Y (buildings split into slices where needed).
- Occlusion: units behind buildings get a 1-colour silhouette pass (ally blue / enemy red).
- Sprite pooling; crowd LOD: off-screen protesters not rendered; at very high counts, far-zoom
  uses reduced animation rate. Bodies above cap get baked into a decal RT.
- Performance budget: **3000 active protesters @ 60 fps** on a mid desktop; **1500 @ 30+ fps** on a
  mid phone (auto quality tier; concurrency cap per tier, spawn queue throttles).

### 4.3 Persistence
`localStorage`: settings (audio, speed default, quality, tutorial-done flags), best runs per city.
Wrapped in try/catch; game works without it.

### 4.4 Quality gates (every milestone)
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` clean; `npm run shots` produces
screenshots at **1440×900**, **844×390** (phone landscape) and **390×844** (phone portrait);
no console errors.

---

## 5. Milestones

Each milestone is executed by one or more subagents; the orchestrator reviews code + screenshots,
updates `HANDOFF.md`, commits and pushes. Art milestones run on **Opus 5.5, high effort**.
`[P]` = can run in parallel with its siblings (disjoint directories).

### M0 — Plan & handoff ✅ (orchestrator)
PLAN.md, HANDOFF.md, CLAUDE.md.

### M1 — Foundation & pipelines (code)
- Vite + TS strict + Pixi v8 scaffold, scripts (`dev`, `build`, `typecheck`, `lint`, `test`, `shots`, `gallery`).
- Pixel-perfect stage, integer zoom, camera (drag/inertia/wheel/pinch/keys/bounds), resize/DPR, orientation handling.
- Fixed-step loop + interpolation, seeded RNG, event bus, iso math utils (+ tests).
- Art pipeline: palette module (initial RIOT-64 draft), grid parser, paper-doll compositor API,
  atlas packer, palette-compliance test, `gallery.html`, `tools/shoot.mjs`.
- Test map: procedural 72×72 placeholder grid rendered with stub tiles to prove the pipeline.
- GitHub Pages workflow.
**DoD**: pans/zooms smoothly at desktop & phone viewports; gallery renders a sample sprite; screenshots exported.

### M2 — City blueprints [P] (design/code)
Map format, rasteriser, validators, and the three blueprints (roads with names/widths, blocks,
landmarks, Capitol footprint & steps, spawn districts/doors, chokepoints, rooftop candidates,
decor anchors). Debug render with flat colours + minimap data. Tests: connectivity, spawn reach,
road widths, no unreachable rooftops.
**DoD**: three maps load in the debug viewer and *read* as their cities to someone who knows them.

### M3a — Environment art: ground, buildings, props [P] (art, Opus high)
Terrain tiles + transitions (asphalt w/ lane markings, crosswalks, kerbs, sidewalks per city,
cobbles, plaza paving, grass, park paths, water with animated shimmer, bridges, quays), city
building kits ×3 (modules + procedural assembly + roof types + rooftop details), props (trees ×4
species, streetlamps per city, benches, bins, kiosks, phone boxes, Morris columns, metro signs,
parked cars/buses/cabs, café terraces, statues, fountains, flags), damage/decals (graffiti,
scorch, litter, broken glass).

### M3b — Landmark art: the three Capitols + skyline landmarks [P] (art, Opus high)
Congreso, Palace of Westminster + Elizabeth Tower (animated clock hands), Palais Bourbon;
each with **5 damage states**, animated flags, steps for arriving protesters. Secondary landmarks:
Cibeles, Neptune, Metrópolis, Puerta de Alcalá; Westminster Abbey, Nelson's Column, London Eye,
Big double-decker; Concorde obelisk, Eiffel Tower, Invalides dome, Orsay.

### M4a — Ministry units art [P] (art, Opus high)
All 11 player units, full animation sets (§3.4), including rooftop poses, sniper thrown-off-roof
sequence, horse gait cycle, ability throw, muzzle flashes, deploy-in animation (units arrive by
running in / rappelling / vehicle drop), portraits for cards.

### M4b — Protester art & variation system [P] (art, Opus high)
Paper-doll base bodies & all overlays for 7 types + Breta + paparazzi; ≥ 12 hair styles,
≥ 10 tops, ≥ 6 bottoms, ≥ 15 accessories/held items, sign system with pixel-text slogans
(per-city lists), climbing, throwing, molotov, bazooka, explode (prophets), door-exit animation.
Gallery page showing a crowd of 200 seeded variants.

### M4c — Vehicles art [P] (art, Opus high)
Humvee, tank (turret rotates independently, tread animation, crush), helicopter (rotor layer,
banking frames, door gunner), police vans/ambulances as decor, burning wrecks.

### M5 — FX & UI kit art [P] (art, Opus high)
FX: muzzle flashes, tracers, rubber pellets, tear-gas cloud (layered animated puffs that drift),
molotov arc + fire patch, explosions (small/medium/tank-shell/prophet), smoke, dust, sparks,
KO stars/birds, cartoon blood puffs & splats, camera flashes, shells/casings, debris, rotor wash.
UI kit: bitmap fonts, 9-slice dossier panels, buttons (states), deploy cards (+locked silhouette),
HUD icons, Capitol integrity bar, Legitimacy seal meter, level-up banner, stamps, minimap frame,
Minister advisor portrait (talk/blink), cursors, selection rings, placement ghosts/tile highlights,
title logo "RIOT CONTROL" (big pixel lettering with stamp/smoke treatment).

### M6 — Simulation core [P] (code)
Entity storage, spatial hash, flow fields & crowd steering, combat & damage types, projectiles,
status effects, death→body lifecycle, economy (Hate/Legit), levels/unlocks, Capitol integrity,
wave director, deterministic headless runner + tests. Works with placeholder rendering.

### M7 — Behaviours (code)
Per-unit & per-protester behaviours: guarding/climbing/throw-off, blockade snapping & blocking,
gas spray + grenade ability, commandable units (road-only pathing; heli free), piercing shots,
bursts, tank crush + friendly-fire AOE, bazooka vs rooftops, molotov fire patches, prophets'
explosions (tank 50% rule), Breta + paparazzi flock & flashes, door spawning.

### M8 — Integration: world view & game feel (code)
Bind sim → sprites, animation state machines, depth sort & occlusion silhouettes, bodies &
trample, decals baking, FX spawning, floaters, hit-stop, shake, colour grading & day/night,
ambient life, performance LOD & quality tiers.

### M9 — UI/UX & screens (code)
Title screen (animated city panorama + logo), city select (three postcards), HUD, deploy bar
(responsive: bottom bar landscape; bottom sheet portrait), placement flow (ghosts, valid tiles,
mobile confirm), selection & commands, ability affordances, pause/speed/settings, level-up
banner & unlock cards, minimap, game over & victory newspapers, stats ledger.

### M10 — Tutorial, hints & writing (code + writing)
Advisor dialogue system, first-run tutorial, contextual hints, tips, all strings (EN primary,
city-flavoured snippets), unit/protester codex descriptions.

### M11 — Audio (code)
WebAudio synth: SFX (batons, shield thuds, rubber pops, gas hiss, gunshots by caliber, MG,
cannon, explosions, molotov whoosh, glass, crowd chants & roar scaled by crowd size, sirens,
helicopter, horse hooves, camera shutters, UI clicks, stamps, level-up fanfare) and adaptive
march/brass-chiptune music that escalates with level/crowd. Mixer, limiter, mute, volume sliders.

### M12 — Balance & director tuning (code)
Headless playtest bots (cheap, balanced, turtle, escalate-fast strategies) across all cities;
tune curves to hit §1.5 targets (dozens → thousands, 35–50 min, losable but winnable).

### M13 — Performance, mobile & polish
Profiling with 3000+ protesters, mobile quality tiers, touch ergonomics, safe-areas/notches,
accessibility (reduced shake, colour-blind-safe team markers), loading screen, bug bash,
full visual consistency review of all art.

### M14 — Release
README (how to play/run), credits, final screenshots/GIF, Pages deploy verified.

### Dependency graph
```
M1 ─┬─ M2 ─────────────┐
    ├─ M3a ─┐          │
    ├─ M3b ─┤          │
    ├─ M4a ─┼─ (art) ──┼─ M8 ─ M9 ─ M10 ─ M11 ─ M12 ─ M13 ─ M14
    ├─ M4b ─┤          │
    ├─ M4c ─┤          │
    ├─ M5 ──┘          │
    └─ M6 ── M7 ───────┘
```

---

## 6. Orchestration protocol

- The orchestrator (lead agent) spawns subagents per milestone with: scope, owned directories,
  acceptance criteria, and the instruction to read PLAN.md + HANDOFF.md first.
- **Directory ownership** prevents conflicts between parallel agents; shared files
  (`package.json`, `src/main.ts`, registries) are changed only by the orchestrator or the
  milestone that owns them. New npm deps require orchestrator approval.
- Subagents do **not** commit; the orchestrator reviews (reads code, views screenshots), runs the
  quality gates, commits with a milestone-tagged message, and pushes.
- Art review checklist: palette compliance, pixel-perfect (no AA/mixels), silhouette readability
  at 1×, consistent light direction & outline, animation timing/weight, personality/variation,
  city identity. Rejected art goes back to the same agent with concrete notes.
- `HANDOFF.md` is updated at the end of every milestone: what exists, how to run, decisions,
  known issues, next steps.

## 7. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Code-authored art looks "AI-generic" | Strict art bible, hand-authored grids & modules, mandatory visual self-review loop, orchestrator art review with rejection. |
| Thousands of agents on mobile | SoA sim, spatial hash, flow fields, pooling, LOD, quality tiers, concurrency caps. |
| Isometric occlusion hides action | Road layouts designed with camera-facing setbacks, silhouettes, building fade near cursor. |
| Parallel agents conflicting | Directory ownership, orchestrator-only commits, small shared registries. |
| Tone tipping into hateful | Fictional cult, no real religions/ethnicities, satire aimed at power & absurdity on both sides. |
| Scope creep | Milestone DoDs, features beyond the brief go to a "later" list in HANDOFF.md. |
