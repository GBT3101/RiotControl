# M4b — Protester art & variation system

Every protester is a seeded **paper-doll**: one hand-drawn base (heads, torsos, legs, arms as
key grids) + overlays (hair, headwear, face gear, back gear, held items, signs) attached to
per-frame anchors and coloured through semantic `$slot.step` keys resolved to local tone
ramps (palette swatches only). Builds (slim / regular / stocky, +1 px tall, Breta's tiny
build) are derived from the same drawings by duplicating / removing grid columns and rows.

Review images: `docs/progress/m4b-crowd.png` (200-person horde, 1× scene shown at 2×),
`m4b-crowd-3x.png` (3× crop), `m4b-types.png` (each type × 6 variants, 4×),
`m4b-anims.png` (animation strips, 3×).

## Files (`src/art/protesters/`)
| File | What |
|---|---|
| `index.ts` | `registerProtesters(reg)` (showcase + crowd preview) and public re-exports |
| `build.ts` | `buildProtesterSheets`, `registerVariant`, `protesterVariantCount`, `protesterSprite`, `ANIMS`, trimming, manifest/events |
| `variants.ts` | `rollVariant(type, i, {seed, city})` — per-type wardrobes, loadouts, gaits |
| `anims.ts` | pose tables for every animation (frames, fps, key frames) |
| `figure.ts` | `renderFigure(look, facing, pose, mirror)` — the compositor (z-order, builds, transforms, FX, shadow) |
| `rig.ts` | key alphabets, cached part rendering, mirroring, rotate/shear/squash, fast outline |
| `book.ts` | part-book parser + grid ops (`dupCol`, `dupRow`, `delRow`, `mirrorPart`, `clipAbove`) |
| `body.grid.ts`, `hair.grid.ts`, `gear.grid.ts`, `items.grid.ts`, `fx.grid.ts` | hand-authored grids |
| `glyphs.ts`, `sign.ts` | 3×5 sign font + 5×5 symbols, slogan lists per city, sign & sandwich-board builders |
| `tones.ts` | local 4-step cloth / 3-step skin & hair ramps (no navy / hi-vis / olive) |
| `crowd.ts`, `lineup.ts` | review images (crowd preview, type lineup) |

## API
```ts
import { buildProtesterSheets, protesterSprite, protesterVariantCount } from './art/protesters';
import { SpriteRegistry } from './art/lib/registry';
import { buildArt, createArt } from './art/lib/atlas';

const reg = new SpriteRegistry();
const manifest = buildProtesterSheets(reg, { city: 'paris', seed: runSeed });   // ~1.5 s, pure
const protArt = buildArt(reg, 2048, createArt());                                // 2 pages

// per crowd member: pick a variant of its type (by loadout for cultists)
const v = manifest.variants.cultist.filter((x) => x.loadout === 'bazooka')[k % n];
const { name, flip } = protesterSprite((n) => protArt.has(n), v.prefix, 'walk', 'sw');
sprite.texture = protArt.anim(name).frames[f];  sprite.scale.x = flip ? -1 : 1;
```
- `BuildOptions`: `city` (`'madrid'|'london'|'paris'|'any'`, flavours slogans + city items),
  `seed`, `variantsPerType` (number or per-type map), `types`, `mirrors` (`'text'` default |
  `true` | `false`), `group`, `anims`.
- Rolls depend only on `(seed, type, index, city)` — `v7` is identical whatever the count.
- `protesterVariantCount(type)` = defaults: student 28, woke 26, mob 26, violent 22, crazy 20,
  cultist 20, prophet 12, breta 1, paparazzi 8 (163 variants).
- `manifest.variants[type][i]`: `{ prefix, loadout, gait, idle, anims }`.
  Loadouts: student `none`; woke `fists|umbrella|megaphone|baguette|sign`; mob
  `fists|stick|bat|bottle|sign`; violent `shiv+molotov`; crazy `pistol`; cultist
  `machete|rifle|bazooka` (cycled by index so every set has all three); prophet `explode`;
  breta `aura`; paparazzi `strap+flash`.
- `manifest.events[spriteName] = { frame, dx, dy }`: key frame + point relative to the anchor
  (as drawn, facing screen-right; **negate dx when flipping**). Examples (default seed):
  bazooka fire frame 2, muzzle ≈ (+11, −12); rifle shot frame 1, muzzle ≈ (+16, −11);
  pistol shot frame 1, muzzle ≈ (+12, −10); molotov release frame 2 at the hand ≈ (+6, −15);
  melee impact = frame 2 (swing/bonk), 1 (punch/stab), 3 (paparazzi strap) at the hand;
  heave release frame 2 ≈ (+7, −14); paparazzi flash frame 0 at the flash ≈ (+9, −15).
  Values differ slightly per variant (builds) — always read them from the manifest.

## Names
`prot.<type>.v<n>.<anim>.<facing>` — types: `student woke mob violent crazy cultist prophet
breta paparazzi`. **Anchor** = ground pixel between the feet (sole row); the blob shadow is
baked one row below. Frames of one sprite share a size (union-trimmed); sizes ≈ 16–21 × 22–25
(standing), Breta with her sign 21×36, bodies ≈ 24×16.

| Anim | Facings drawn | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| `idle` | se, ne | 4 | 5 | ✓ | per variant: chant / sign wave / cardboard pump / phone filming / vape (puffs) / megaphone / menace (weapon tap) / bottle toss / twitch / preach / finger-wag (Breta) / flash pops / cult chant / pot-banging (Madrid) |
| `walk` | se, ne | 8 | 10 | ✓ | gaits: `stroll`, `march` (angry fist pump, lean), `twitch` (crazy), `stomp` (Breta), `shuffle` (paparazzi, hunched) — bounce from the leg frames |
| `run` | se, ne | 6 | 12 | ✓ | lean forward; prophets sprint arms up |
| `attack` | se, ne | 4–6 | 12 | ✗ | punch(4, impact 1) · swing(5, impact 2: stick/bat/bottle/umbrella/megaphone/baguette/machete) · bonk (sign chop, 5, impact 2) · stab (shiv, 4, impact 1) · pistol (4, shot 1) · rifle (4, shot 1) · bazooka (6, fire 2 with front flash + backblast, smoke 3–4) · strap (paparazzi, 5, impact 3) |
| `molotov` | se, ne | 6 | 12 | ✗ | very violent: light (flame), wind-up, **release frame 2**, follow-through |
| `flash` | se, ne | 2 | 12 | ✗ | paparazzi camera flash (big burst, small burst) |
| `windup` | se, ne | 4 | 12 | ✓ | prophet pre-explosion: shake, outline glows rust/ochre, fuse sparks (explosion = M5) |
| `climb` | ne (+nw flip) | 4 | 8 | ✓ | back view, hand over hand (woke / mob / violent) |
| `heave` | se, ne | 4 | 8 | ✗ | grab & throw a rooftop sniper, release frame 2 |
| `hit` | se, ne | 2 | 12 | ✗ | white flash frame + 1 px knock-back wince |
| `die` | se, ne | 4 | 10 | ✗ | lethal: recoil → stagger → buckle → falling (45° shear) → **chain into `body`** |
| `body` | se (+sw flip) | 2 | 10 | ✗ | bounce + settle face-down; hold frame 1 (blood = M5 overlay) |
| `ko` | se, ne | 6 | 8 | ✗ | dizzy X-eyed stagger → sink → fall backward → **chain into `kobody`** |
| `kobody` | se (+sw flip) | 2 | 8 | ✗ | bounce + settle face-up with X-eyes (stars/birds = M5) |
| `door` | se (+sw flip) | 3 | 6 | ✗ | step out of a door, look around, stretch |

Bodies (`body`, `kobody`) are the same for every facing (NE/NW deaths end on them too) and keep
the variant's colours, so fallen protesters stay unique.

## Mirroring & lettering
SW / NW are horizontal flips of SE / NE — except **lettering**: signs and sandwich boards
must stay readable, so for variants carrying text the `.sw` sprites of SE animations are
re-rendered with the sign unflipped (`mirrors: 'text'`, default). Everything else is flipped
at runtime (`protesterSprite()` tells you which). `mirrors: true` registers every SW / NW
copy (used by the gallery showcase), `false` none.

## Atlas cost
Default build (163 variants, `mirrors: 'text'`): 3 355 sprites, 14 795 frames, ≈ 7.1 M px →
**2 pages of 2048²** (2048×2039 + 2048×1773). `mirrors: false`: 13 307 frames, 2 pages
(second ≈ 66 % full). `mirrors: true` would need ~4 pages — don't. Lower `variantsPerType` on
mobile tiers (cost scales linearly; ~44 k px per variant). Build time ≈ 1.5 s in Node.

## Types — looks & accents (art bible §3.5)
- **Student** — backpacks/totes, beanies, caps, headphones, glasses; hand-made cardboard or
  pole signs (misspelt slogans), phones filming, vapes, flags, megaphones; city items
  (umbrella / baguette / pot & spoon). Stroll or march. No attack.
- **Violent Woke** — dyed hair (pink, hot pink, blue, purple, green, teal, orange, red; 25 %
  split-dye), septum rings, earrings, glasses, oversized thrift jackets, puffers, totes,
  megaphones, umbrellas, pole signs, flags; furious faces; climbs.
- **Violent Mob** — hoodies & tracksuits (grey / red), caps (forward / back), hoods, traffic
  cone helmets, bandanas & face masks, stubble; sticks, bats, bottles, sign poles; climbs.
- **Very Violent** — black bloc (gray-on-ink), balaclavas or hoods, black & white checkered
  scarves, goggles, crates of bottles / backpacks; shiv + molotov; climbs.
- **Crazy Mob** — tinfoil hats, Hawaiian shirts, bathrobes, wild hair / comb-overs, beards,
  garish shoes, shorts; twitchy gait, wide eyes; revolver.
- **Doomsday Cultists — "The Order of the Final Hour"** (fictional): rounded ochre-red /
  sackcloth hooded robes with a gold hourglass emblem and hood clasp, ritual face paint;
  machete / rifle / bazooka. Deliberately no real-world religious or ethnic dress cues.
  M13a variety: robe tones cult / maroon / ochre / sack / red / orange / brown (some plain robes
  without the emblem), hood shapes `cowl`, `cowlpeak` (drooping tasselled peak), `cowlclock`
  (gold clock-hand spikes), `cowlcrest` (hourglass crest) or bare-headed acolytes, hoods in the
  robe tone or a contrasting rank tone, face paint `paint` / `paintlines` (sand-trickle streaks)
  / `paintband` (gold band) / `paintchin`, back regalia `totem` (gold hourglass on a pole),
  `banner` (hourglass sigil flag), `scroll` (scroll case), hip `lantern`, varied builds and
  expressions. No pointed hoods (avoids real-world associations).
- **Prophets** — white robes, wild hair & long beards, sandwich boards (“END”, “END!”,
  “NIGH”, “SOON”, “BYE”) bristling with comic red dynamite; arms-raised sprint; glowing wind-up.
- **Breta** — tiny furious climate teen parody: yellow raincoat, braids, leaf pin, scowl, a
  "HOW / DARE / YOU" sign bigger than she is (her presence marker), finger-wag idle, stomp walk.
- **Paparazzi** — photographer vests over shirts, backwards caps, shades, camera straps,
  big lenses, flash pops; hunched shuffle; camera-strap swing.

Parts: 17 hair styles (+4 beards), 13 headwear, 9 face accessories, 15 torso styles + long /
mid hems + skirts, pants / shorts / skirt+tights / robes, 17 held items, 6 back/front gear
pieces, 3×5 font with ¡¿ and 14 symbols, ~60 slogans (generic + per city).

## Gallery
- `protesters`: variant `v0` of every type, all animations, all four facings.
- `crowd`: `prot.crowd.preview` (320×180, 8 frames, ~200 protesters), `prot.crowd.crop3x`,
  `prot.crowd.lineup` (tagged `preview`).

## Notes / requests
- The main registry carries the `crowd` previews (~0.6 M px) — the game atlas should skip
  sprites tagged `preview` (requested shared change: tag filter in `buildArt`, or move gallery
  extras to a gallery-only registry).
- Runtime flips (`scale.x = -1`) mirror around the anchor's left pixel edge; to match the
  registry's pixel-index mirroring (anchor column stays put) shift flipped sprites by +1 px
  in x (or use anchor `(x + 1) / w` for flipped sprites).
