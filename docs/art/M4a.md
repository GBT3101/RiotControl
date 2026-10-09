# M4a — Ministry units art (catalog)

All player ground/rooftop units, their full animation sets, the blockade, and portraits.
Source: `src/art/units/` (entry `registerUnits(reg)`), tests: `tests/units-art.test.ts`.
Screens: `docs/progress/m4a-lineup.png` (all units idle SE, 4×, on asphalt),
`docs/progress/m4a-anims.png` (key strips, 4×), `docs/progress/m4a-portraits.png`.

Vehicles (humvee / tank / heli) and their icons are M4c.

## Conventions (read this first)

- **Names**: `unit.<id>.<anim>.<facing>`, ids `riot sniper blockade gas horse cop soldier brigade`.
  SE and NE are drawn; **SW / NW are registered mirrors** of SE / NE. Every unit sprite of a
  given id (except the thrown-off set and the blockade) shares **one canvas size and one anchor**,
  so switching anims never jumps.
- **Anchor** = the ground-contact pixel (between the boots / hooves; for rooftop units the knee on
  the roof surface). Position the Pixi sprite at the integer world point of the entity
  (`new Sprite(art.tex(name))` already has the anchor preset). Mirrored sprites have their
  anchor mirrored by the registry (`x' = w-1-x`) — use `def.anchor` / the catalog, not a constant.
- **Shadows** are baked in (the `shadow` swatch at ≈45% alpha, `hasShadow: true`); the
  thrown `flail` frames have none (draw a ground shadow under the arc yourself if wanted).
- **Hit**: `unit.<id>.hit.<f>` = 2 frames @12 fps: white flash (outline kept) with 1 px knock-back,
  then the knocked-back plain frame. Play once, then return to the previous anim.
- **Fidgets**: `fidget` (and `fidget2` for riot) are 8-frame one-shots; play one every ~4–10 s
  (random) instead of a loop of `idle`, then return to `idle`.
- **Deploy-in**: units arrive with `run` (jog/gallop loop) from the map edge / van, then play
  `deploy` once at the placement tile. Rooftop units use `deploy` (climb-up) at the roof edge
  directly; the blockade drops in (`unit.blockade.deploy.<axis>`).
- **Death → body**: `death` ends on the body pose; then show `body` (1 frame) for 20–40 s.
  M13a: riot / gas / cop / soldier NE deaths use a back-view mid-fall part (`fall.ne`) instead
  of the SE fall frame (no more face pop on the way down); the lying frames stay shared.
  Riot also has `ko` (sitting, head lolling, 4 f loop) for non-lethal downs.
- **Impact frames** (damage tick / projectile spawn / dust) and **muzzle pixels** (flash already
  drawn into the frame; spawn tracers / pellets / grenade there) are in the tables below and
  available in code without building textures:

```ts
import { unitAnimMeta, unitAnimCatalog, BRIGADE_SQUAD_OFFSETS } from '../art/units';
const m = unitAnimMeta('unit.soldier.attack.sw');
m.impactFrame;     // 1 (soldier: shots on 1, 3, 5 — every frame with a muzzle point)
m.muzzle[3];       // {x, y} in sprite pixels, already mirrored for SW/NW, or null
// world muzzle = entityWorldPos - m.anchor + m.muzzle[frame]
```

- **Personality / variants**: riot officer skin variants `unit.riot.v1…v5.{idle,walk}.*`
  (gallery group `variants`, `COP_SKINS` lists the skin ramps; used by the demo crowd). All
  other units have one fixed look with a personality each (smug riot cop, nervous rookie sniper
  whose helmet slides over his eyes, gas-masked head-tilting weirdo, moustached mounted officer,
  sweaty armed cop with a coffee-stained vest, stoic soldier, cold sniper captain).
- **Team language**: navy + hi-vis for police units (riot, sniper, gas, horse, cop), olive for
  the army, black + olive ghillie for the brigade; every unit has a 1 px `ink` outline.

## Units

### Riot Control (`riot`) — navy armour, hi-vis band, visor helmet, shield + baton
Attack = baton cocked → smear frame → shield bash + chop (impact 3) → recover. Fidgets: shield
tap and visor flip (the smug face). Deploy: skid, shield up, SLAM (impact 3 — spawn dust).
Death: stagger, shield drops forward, falls back, bounce, settle (body lies up-left of the anchor,
shield in front). `ko` for non-lethal downs (KO stars from M5 above row 3).

### Rubber Sniper (`sniper`) — rooftop, kneeling, orange less-lethal stock
`idle` (rifle up, scanning) → `aim` (3 f, hold last) → `attack` (flash on frame 1) → `reload`.
`deploy` = climb-up arrival (hands on the roof edge, haul up, kneel; roof edge is row 22).
**Thrown off the roof** (own 22×22 canvas, anchor (11,19)): `grabbed` (4 f struggle loop while
climbers hold him) → `flail` (4 f spin loop; move along the parabola, body centre at (11,11)) →
`impact` (2 f squash on the street, impact frame 0 — spawn dust / KO stars) → `splat` (body).
`death` (shot on the roof) ends on `body` lying on the roof.

### Sniper Brigade (`brigade`) — 3 elite snipers per roof
Same rig as the rookie (all anims incl. climb-up and the thrown set, in the brigade's look),
black tactical kit, ghillie tufts, balaclava, long suppressed rifle, big flash (lethal; splash
r=1 at the target). Canvas 38×26 for the long barrel. Place **three** sprites per roof at
`BRIGADE_SQUAD_OFFSETS` from the roof anchor point: (−9,−4), (0,0), (+9,+4) — draw back-left
first; mirror x for SW/NW; de-sync them with phase offsets. Thrown one by one.

### Tear Gas Shooter (`gas`) — gas mask, 40 mm launcher, grenade bandolier
`attack` = **spray loop** (4 f @10, puffs drawn in; damage ticks continuously). Ability:
`charged` replaces `idle` while the grenade is ready (bounces a grenade in his palm) — this is
the "pulsing" unit-side cue (the HUD icon is M5/M9); `throw` (6 f, release on frame 3 at the
muzzle point → spawn the grenade projectile there). Fidget: head tilt + filter wheeze.

### Mounted Riot Police (`horse`) — horse + rider, canvas 36×40, anchor (17,36)
Dark bay with white socks, hi-vis POLICE saddle cloth, clear face visor; moustached rider with a
long baton. `walk` = 4-beat walk (8 f), `run` = gallop (6 f) for commanded moves. `attack` =
overhead swing down the near side (impact 3). `deploy` = gallop in, **rear-up** pawing the air,
land (impact 5 = dust). `death`: the horse rears and throws the rider; **from frame 3 the horse
is no longer drawn — spawn `unit.horse.flee.<facing>` (riderless gallop loop) at the same
position and run it off the map**; the rider tumbles and ends on `body`. The horse never dies
on screen (tasteful).

### Armed Cops (`cop`) — cap, light-blue shirt, stab vest, two-handed pistol
Walks/idles at low ready. `attack`: raise → aim → BANG (flash + recoil, impact 2) → settle;
piercing shot = spawn the tracer at the muzzle on frame 2. `reload`: pistol up, mag drops,
new mag slapped in. Fidget: sweats (cap up, drop of sweat rolls off). Deploy: skids in, sweeps
the street with the pistol.

### Soldiers (`soldier`) — olive fatigues, helmet + goggles, automatic rifle
`attack` = **3-round burst** (7 f @15): muzzle flashes on frames 1, 3, 5 (one damage tick each;
`impactFrame` = first). `crouch` = crouched-aiming idle (use while engaged between bursts).
`reload`, `fidget` (goggles down, scan), `deploy` (double-time in, halt, **salute**).

### Blockade (`blockade`) — concrete jersey barrier in Ministry colours

Canvas 32×32, **anchor (16,14) = the tile's top vertex** (place it exactly like a tile; the
barrier runs through the tile centre, anchor + (0,8), from edge midpoint to edge midpoint).

| sprite | frames | fps | notes |
|---|---|---|---|
| `unit.blockade.<piece>.<axis>` | 3 | 0 | piece `single`/`end0`/`mid`/`end1`, axis `i`/`j`. **Frame = damage state**: 0 pristine, 1 dented, 2 wrecked (`art.tex(name, state)`). |
| `unit.blockade.deploy.<axis>` | 5 | 12 | dropped in from above; impact (thud + dust) on frame 2. |
| `unit.blockade.burst.<axis>` | 7 | 12 | destruction: white flash, chunks fly, dust, low rubble stump on the last frame (keep it as a decal or fade it). |

Axis `i` = barrier runs along the i axis (screen down-right; use it on roads running along j),
axis `j` = runs along j (screen down-left). Runs: 1 tile `single`; 2 tiles `end0 + end1`;
3 tiles `end0 + mid + end1` (`end0` at the lower tile index). Segments join seamlessly
(continuing ends are painted past the tile and clipped, no outline seams). Hi-vis/navy chevron
band + navy POLICE stencil marks; the wreck has chunks bitten out, exposed rebar, pink protest
graffiti and rubble.

## Portraits (`unit.<id>.portrait`, group `portraits`)

32×32 busts, transparent background (the M5 deploy card / codex frames them), anchor
bottom-centre (16,31): riot (smug, visor up), sniper (nervous freckled rookie, helmet too big,
sweat), gas (mask, glinting lenses), horse (the moustache), cop (sweaty, cap band), soldier
(stoic, stubble), brigade (cold captain: boonie with ghillie tufts, balaclava, scar),
blockade (barrier + traffic cone icon). Vehicle icons: M4c.

## Animation tables (generated from `catalog.ts`; SW/NW = mirrors with mirrored anchors/muzzles)

#### `unit.riot.*` — canvas 24x26, anchor (11,22)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| idle | 4 | 5 | yes | SE/NE (+SW/NW) | — | — |  |
| fidget | 8 | 6 | no | SE/NE (+SW/NW) | — | — | Shield tap: baton raps the shield rim twice. Play occasionally instead of idle. |
| fidget2 | 8 | 6 | no | SE/NE (+SW/NW) | — | — | Visor flip: visor up, smug look + blink, visor down (SE). NE: glance over shoulder. |
| walk | 8 | 10 | yes | SE/NE (+SW/NW) | — | — |  |
| run | 6 | 12 | yes | SE/NE (+SW/NW) | — | — | Jog / charge; used for the deploy jog-in from the map edge. |
| attack | 6 | 12 | no | SE/NE (+SW/NW) | 3 | — | Anticipation (baton cocked) → smear → shield-bash + baton chop (impact) → recover. |
| deploy | 6 | 10 | no | SE/NE (+SW/NW) | 3 | — | Arrival after the jog-in: skid, raise shield, SLAM it down (impact = dust), smug stand. |
| death | 8 | 10 | no | SE/NE (+SW/NW) | — | — | Stagger → shield drops → knees buckle → falls back → bounce → settle. Ends on `body`. |
| body | 1 | 0 | no | SE/NE (+SW/NW) | — | — | Lying on his back, shield beside him. Stays 20–40 s. |
| ko | 4 | 6 | yes | SE/NE (+SW/NW) | — | — | Knocked out sitting, head lolling (M5 orbits KO stars above row 3). |
| hit | 2 | 12 | no | SE/NE (+SW/NW) | — | — | White flash + 1 px knock-back, then the knocked-back frame. |

#### `unit.sniper.*` — canvas 30x26, anchor (11,22)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| idle | 4 | 5 | yes | SE/NE (+SW/NW) | — | — | Kneeling on the roof, rifle up, scanning. |
| fidget | 8 | 6 | no | SE/NE (+SW/NW) | — | — | Pushes the slipping helmet up, looks around, it slides back down. NE: glances. |
| aim | 3 | 10 | no | SE/NE (+SW/NW) | — | — | Ready → aim transition (hold the last frame while tracking). |
| attack | 5 | 12 | no | SE/NE (+SW/NW) | 1 | 1: 26,15 / 1: 24,6 | Rubber round: flash on frame 1 (spawn pellet at the muzzle), recoil, bolt, re-aim. |
| reload | 6 | 8 | no | SE/NE (+SW/NW) | — | — | Rifle tipped up, thumbs a round in, back to ready. |
| deploy | 6 | 8 | no | SE/NE (+SW/NW) | — | — | Climb-up arrival: hands on the roof edge, hauls himself up, kneels. Roof edge = row 22. |
| death | 7 | 10 | no | SE/NE (+SW/NW) | — | — | Shot on the roof (bazooka/rifle): jolts, topples sideways, settles. Ends on `body`. |
| body | 1 | 0 | no | SE/NE (+SW/NW) | — | — |  |
| hit | 2 | 12 | no | SE/NE (+SW/NW) | — | — | White flash + 1 px knock-back, then the knocked-back frame. |

#### `unit.sniper.*` — canvas 22x22, anchor (11,19)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| grabbed | 4 | 8 | yes | SE (+SW) | — | — | Seized by climbers: rifle lost, windmilling. Loop until the throw. |
| flail | 4 | 12 | yes | SE (+SW) | — | — | Airborne spin loop; move the sprite along the parabola (body centre = (11,11)). |
| impact | 2 | 12 | no | SE (+SW) | 0 | — | Hits the street: squash, rebound. Then show `splat`. |
| splat | 1 | 0 | no | SE (+SW) | — | — | Body on the street after the fall. |

#### `unit.gas.*` — canvas 30x26, anchor (11,22)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| idle | 4 | 5 | yes | SE/NE (+SW/NW) | — | — |  |
| fidget | 8 | 6 | no | SE/NE (+SW/NW) | — | — | Cocks his head like a curious dog; the filter wheezes a puff. |
| charged | 4 | 6 | yes | SE/NE (+SW/NW) | — | — | Ability ready: bounces a gas grenade in his palm (replace idle while charged). |
| walk | 8 | 10 | yes | SE/NE (+SW/NW) | — | — |  |
| run | 6 | 12 | yes | SE/NE (+SW/NW) | — | — |  |
| attack | 4 | 10 | yes | SE/NE (+SW/NW) | 0 | 0: 20,13; 1: 20,12; 2: 20,13; 3: 20,13 / 0: 24,6; 1: 24,7; 2: 24,6; 3: 24,7 | Gas spray, looping while engaged (10 dmg/s — tick on any frame). Puffs drawn in. |
| throw | 6 | 12 | no | SE/NE (+SW/NW) | 3 | 3: 13,1 / 3: 26,2 | Grenade ability: wind-up → overhead → release (spawn the projectile on frame 3 at the muzzle point) → follow-through. |
| deploy | 6 | 10 | no | SE/NE (+SW/NW) | — | — | Jogs in, skids, levels the launcher, tilts his head at the crowd. |
| death | 8 | 10 | no | SE/NE (+SW/NW) | — | — |  |
| body | 1 | 0 | no | SE/NE (+SW/NW) | — | — |  |
| hit | 2 | 12 | no | SE/NE (+SW/NW) | — | — | White flash + 1 px knock-back, then the knocked-back frame. |

#### `unit.horse.*` — canvas 36x40, anchor (17,36)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| idle | 4 | 5 | yes | SE/NE (+SW/NW) | — | — |  |
| fidget | 8 | 6 | no | SE/NE (+SW/NW) | — | — | Horse tosses its head, paws the ground, swishes its tail; rider twirls nothing, just glares. |
| walk | 8 | 10 | yes | SE/NE (+SW/NW) | — | — | 4-beat walk (near hind, near fore, far hind, far fore). |
| run | 6 | 12 | yes | SE/NE (+SW/NW) | — | — | Gallop / trot (commanded moves, deploy arrival). |
| attack | 6 | 12 | no | SE/NE (+SW/NW) | 3 | — | Rider winds up, swings the long baton down the near side (impact), recovers. |
| deploy | 7 | 8 | no | SE/NE (+SW/NW) | 5 | — | Gallops in, rears up pawing the air (rider brandishes baton), lands (impact = dust). |
| death | 8 | 10 | no | SE/NE (+SW/NW) | — | — | Horse rears and throws the rider, who tumbles and lands. From frame 3 the horse is not drawn: spawn `flee` there. Ends on `body`. |
| body | 1 | 0 | no | SE/NE (+SW/NW) | — | — |  |
| flee | 6 | 12 | yes | SE/NE (+SW/NW) | — | — | Riderless horse bolting (after `death` frame 3). Move it off the map; despawn. |
| hit | 2 | 12 | no | SE/NE (+SW/NW) | — | — | White flash + 1 px knock-back, then the knocked-back frame. |

#### `unit.cop.*` — canvas 30x26, anchor (11,22)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| idle | 4 | 5 | yes | SE/NE (+SW/NW) | — | — |  |
| fidget | 8 | 6 | no | SE/NE (+SW/NW) | — | — | Sweats: cap up, blink, a drop of sweat rolls off. NE: nervous glances. |
| walk | 8 | 10 | yes | SE/NE (+SW/NW) | — | — | Patrols at low ready, pistol out. |
| run | 6 | 12 | yes | SE/NE (+SW/NW) | — | — |  |
| attack | 5 | 12 | no | SE/NE (+SW/NW) | 2 | 2: 22,11 / 2: 22,6 | Raise → aim → BANG (flash, recoil) → settle. Shot fires on the impact frame. |
| reload | 6 | 8 | no | SE/NE (+SW/NW) | — | — | Pistol up, empty magazine drops, fresh one slapped in. |
| deploy | 6 | 10 | no | SE/NE (+SW/NW) | — | — | Arrives running, skids, sweeps the pistol across the street, settles at low ready. |
| death | 8 | 10 | no | SE/NE (+SW/NW) | — | — | Stagger → buckle → falls back → bounce → settle. Ends on `body`. |
| body | 1 | 0 | no | SE/NE (+SW/NW) | — | — |  |
| hit | 2 | 12 | no | SE/NE (+SW/NW) | — | — | White flash + 1 px knock-back, then the knocked-back frame. |

#### `unit.soldier.*` — canvas 30x26, anchor (11,22)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| idle | 4 | 5 | yes | SE/NE (+SW/NW) | — | — |  |
| fidget | 8 | 5 | no | SE/NE (+SW/NW) | — | — | Pulls the goggles down, scans the street, pushes them back up. NE: scans left/right. |
| crouch | 4 | 4 | yes | SE/NE (+SW/NW) | — | — | Crouched, rifle shouldered — the engaged idle between bursts. |
| walk | 8 | 10 | yes | SE/NE (+SW/NW) | — | — |  |
| run | 6 | 12 | yes | SE/NE (+SW/NW) | — | — |  |
| attack | 7 | 15 | no | SE/NE (+SW/NW) | 1 | 1: 22,13; 3: 22,13; 5: 22,13 / 1: 23,4; 3: 23,4; 5: 23,4 | Three-round burst: flashes on frames 1, 3, 5 (one damage tick each). |
| reload | 6 | 8 | no | SE/NE (+SW/NW) | — | — | Muzzle dips, magazine drops, fresh one seated, charging handle racked. |
| deploy | 6 | 8 | no | SE/NE (+SW/NW) | — | — | Double-times in, halts, salutes, back to port arms. |
| death | 8 | 10 | no | SE/NE (+SW/NW) | — | — |  |
| body | 1 | 0 | no | SE/NE (+SW/NW) | — | — |  |
| hit | 2 | 12 | no | SE/NE (+SW/NW) | — | — | White flash + 1 px knock-back, then the knocked-back frame. |

#### `unit.brigade.*` — canvas 38x26, anchor (11,22)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| idle | 4 | 5 | yes | SE/NE (+SW/NW) | — | — | Kneeling on the roof, rifle up, scanning. |
| fidget | 8 | 6 | no | SE/NE (+SW/NW) | — | — | Pushes the slipping helmet up, looks around, it slides back down. NE: glances. |
| aim | 3 | 10 | no | SE/NE (+SW/NW) | — | — | Ready → aim transition (hold the last frame while tracking). |
| attack | 5 | 12 | no | SE/NE (+SW/NW) | 1 | 1: 31,15 / 1: 28,3 | Lethal round: big flash on frame 1 (spawn tracer/impact; splash r=1), recoil, bolt. |
| reload | 6 | 8 | no | SE/NE (+SW/NW) | — | — | Rifle tipped up, thumbs a round in, back to ready. |
| deploy | 6 | 8 | no | SE/NE (+SW/NW) | — | — | Climb-up arrival: hands on the roof edge, hauls himself up, kneels. Roof edge = row 22. |
| death | 7 | 10 | no | SE/NE (+SW/NW) | — | — | Shot on the roof (bazooka/rifle): jolts, topples sideways, settles. Ends on `body`. |
| body | 1 | 0 | no | SE/NE (+SW/NW) | — | — |  |
| hit | 2 | 12 | no | SE/NE (+SW/NW) | — | — | White flash + 1 px knock-back, then the knocked-back frame. |

#### `unit.brigade.*` — canvas 22x22, anchor (11,19)

| anim | frames | fps | loop | facings | impact | muzzle (SE frame: x,y / NE) | notes |
|---|---|---|---|---|---|---|---|
| grabbed | 4 | 8 | yes | SE (+SW) | — | — | Seized by climbers: rifle lost, windmilling. Loop until the throw. |
| flail | 4 | 12 | yes | SE (+SW) | — | — | Airborne spin loop; move the sprite along the parabola (body centre = (11,11)). |
| impact | 2 | 12 | no | SE (+SW) | 0 | — | Hits the street: squash, rebound. Then show `splat`. |
| splat | 1 | 0 | no | SE (+SW) | — | — | Body on the street after the fall. |

## Authoring notes (for whoever extends this)

- `kit.ts` is a small pose compositor: part books (`*.grid.ts`, `== name x,y` headers = home
  position on the unit canvas) + pose strings (`'_shadow legs.walk:3 >0,1 torso head arm.fwd
  !flash'`; `~` mirror, `%n` rotate 90°×n, `@x,y` absolute, `>dx,dy` group offset, `!` drawn
  after the outline, `_` drawn underneath unoutlined). Frames are composed palette-pure and
  auto-outlined in `ink`.
- Humanoid legs (`body.grid.ts`) are shared by every ground unit; trouser/boot colours come
  from each unit's key map. The rooftop rig (`sniper.ts: makeRooftop`) is shared by sniper and
  brigade (the brigade overrides head/torso/rifle parts and recolours the rest).
- The horse's legs are single hand-drawn leg poses phased into the walk / gallop cycles
  (`horse.ts`), far legs re-keyed darker.
