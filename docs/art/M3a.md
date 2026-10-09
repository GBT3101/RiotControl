# M3a — Environment art: ground, buildings, props, decals

All code in `src/art/env/` (pure, DOM-free, deterministic). Review images:
`docs/progress/m3a-{madrid,london,paris}.png` (composed street corners), `m3a-paris-night.png`
(night layer demo), `m3a-kit.png` (building line-ups ×3 cities + every prop).

## 1. Ground tiles — `ground.ts`

```ts
import {
  groundTile,
  groundTileFrames,
  groundCtxAt,
  GROUND_ANCHOR,
  WATER_FRAMES,
  WATER_FPS,
} from 'src/art/env';
const ctx = groundCtxAt(map, i, j, frame); // neighbours + seed (hash(i,j)) from MapData
const img = groundTile(ctx); // PixelBuffer 32×24, cached by canonical key
const frames = groundTileFrames(ctx); // 4 frames @ 3 fps for water, else 1
```

- **Image**: 32×24. The 32×16 diamond occupies rows 8–23; rows 0–7 are headroom for upright edge
  details (bridge balustrades, quay parapets) on the far edges. **Anchor `GROUND_ANCHOR = {x:16,y:8}`**
  = diamond top vertex → draw at world `((i−j)·16 − 16, (i+j)·8 − 8)`. Bake back-to-front (i+j ascending).
- **Neighbour convention** (tile axes; i → screen SE, j → screen SW): edge neighbours
  `nw=(i−1,j) ne=(i,j−1) se=(i+1,j) sw=(i,j+1)`; corner neighbours `n=(i−1,j−1) e=(i+1,j−1)
s=(i+1,j+1) w=(i−1,j+1)`. Off-map → own ground. Exported as `NEIGHBOUR_OFFSETS`.
- **Elevation model**: roads (asphalt, cobble, bridge) 0 px; sidewalk/plaza/grass/parkPath/steps/
  quay/lot +2 (kerb); water −7. A higher far-side neighbour (n/nw/ne) shows its wall face inside the
  lower tile (kerb faces on roads, ashlar quay walls / earth banks / bridge piers in water, with a
  shadow band on the water); lower neighbours give the higher tile a coping band. Same-level
  transitions: lawn rims, stone edging on paving, grass tufts creeping over gravel paths; contact
  shadow next to `lot` (building) tiles. London gets double-yellow lines along kerbs.
- **Markings** (on the tile centre lines): `dashI/J` dash along that axis at the centre,
  `zebraI/J` zebra bars of a crossing over a road running along that axis, `stopI/J` stop line across
  it at the tile centre. Drawn on asphalt, cobble and bridge.
- **Per-city materials**: Madrid warm granite slabs & setts, green lake water; London grey flags,
  dark setts, mowing-stripe lawns, murky Thames, green iron bridge rails; Paris pale limestone
  slabs, grey-blue pavés, Seine blue-grey, limestone balustrades. 12 seeded detail variants per
  ground (cracks, manholes, patches, stains, seams, gum, hatches, leaves, tufts, daisies, moss…);
  isolated specks are scattered per variant so large areas never show a lattice.
- Gallery samples (group `tiles`, gallery/Node only): `tile.<city>.<ground>.<0-3>`,
  `tile.<city>.mark.<marking>`, `tile.<city>.kerb.{road.nw,road.ne,road.n,road.nwne,side.se,side.sw,side.s}`,
  `tile.<city>.edge.{grass.side,side.grass,path.grass}`, `tile.<city>.water[.quay|.bank|.bridge]`
  (4f @3fps), `tile.<city>.quay.{se,nw}`, `tile.<city>.bridge.{nwse,dash}`, `tile.<city>.steps[.i]`.

## 2. Building kits — `bld/building.ts`

```ts
const art = paintBuilding(buildingData); // BuildingData from the contract (cached per spec)
art.image / art.anchor; // sprite; anchor = footprint top vertex at ground (pixel index)
// → draw at world ((i−j)·16, (i+j)·8) minus anchor
art.lights; // same size: lit windows/shopfronts (ochre3/ochre4), else transparent
art.shadow / art.shadowAnchor; // cast shadow (shadow swatch @ SHADOW_ALPHA), same anchor convention
art.roofTopY; // px above ground of the standable roof (flat/terrace: walls−3; pitched:
// eaves + rise (roof flat/ridge); mansard: walls + 10)
art.roofStand; // standable rect in footprint-local tiles {u0,v0,u1,v1}
art.climbPoints; // [{i,j,face:'sw'|'se'|'ne'|'nw'}] absolute tile coords at drainpipes
art.height; // max px above ground
```

- Sprite size `((w+d)·16+4) × (…)`; non-square footprints supported (M8 slices for depth).
- Assembly: a tiny z-buffered iso rasterizer (`raster.ts`) shears hand-authored facade modules
  (`bld/modules.grid.ts`: Madrid balcony doors + iron balconies, persianas, rejas, portals, roller
  shutters, shops/bars with awnings; London sash windows, balconettes, Georgian doors with fanlights,
  pubs, shopfronts, area railings; Paris Haussmann windows, balconnets, continuous 2nd/5th-floor
  balconies, persiennes, cafés, boutiques, portes cochères; shared flowers, laundry, residents,
  AC units, satellite dishes, "NO" banners, hanging flags) onto lit/shaded faces with cornices,
  string courses, rusticated ground floors, quoins, drainpipes, grime under sills, rain streaks,
  base AO and spray tags. Roofs: flat (parapets + AC/tanks/aerials/dishes/stair housing/skylights),
  terrace (tiled floor, railings, laundry, water tanks), pitched (hipped ring + standable roof flat;
  terracotta channels / slate courses, London chimney stacks with pots, Madrid buhardillas), mansard
  (zinc/slate, dormers aligned to bays, chimney stack rows). Coloured silhouette outline.
- Looks per city (`bld/looks.ts`): Madrid ochre/cream/peach stucco (+ occasional neo-mudéjar brick),
  green awnings; London stock/red brick or white stucco, white sashes, black railings; Paris
  limestone ashlar, zinc, black ironwork. `kind: 'civic'` → stone, grander, balustraded flat roof.
- Doors: `spec.doors` tiles on the +j / +i sides become street doors on the visible faces.
- Perf: 400 mixed buildings ≈ 0.6–0.9 s in Node (test budget 4 s; browser target < 1.5 s).
- Gallery samples (group `buildings`, gallery/Node only): `bld.<city>.<0-11>` (1×1 … 6×6, 2–6
  storeys, all roof types), plus `bld.<city>.{0,1}.lights` and `.shadow`.

## 3. Props — `props.ts` (group `props`, always registered, `hasShadow`)

`propSprite(kind, city, seed?, axis?) → registered name` resolves every `DecorPlacement.kind`
(`PROP_KINDS`): `tree.plane tree.pine tree.chestnut tree.oak bush hedge lamp bench kiosk bin
phonebox postbox morris wallace metro busstop hydrant bollard planter cafe trafficlight sign flag
statue bike cone tape litter pigeon`. Anchor = ground contact = the placement's world point (tile
centre); iso-built props (hedge, bench, kiosk, phonebox, busstop, cafe, tape) anchor on the
projected tile centre. Axis props (`hedge bench busstop cafe tape bike`) have `.i` / `.j` (mirrored).

| name                                                                                             | frames / fps         | notes                                                  |
| ------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------ |
| `prop.tree.{plane,pine,chestnut,oak}.{0-2}`, `prop.bush.{0-2}`                                   | 1                    | clump-built canopies, ~40×50                           |
| `prop.hedge.{i,j}`, `prop.tape.{i,j}`                                                            | 1                    | 1-tile iso box / police tape between posts             |
| `prop.lamp.<city>` + `prop.lamp.<city>.light`                                                    | 1                    | fernandina / Westminster / Paris; light mask for night |
| `prop.bench.<city>.{i,j}`, `prop.kiosk.<city>`, `prop.bin.<city>`, `prop.busstop.<city>.{i,j}`   | 1                    |                                                        |
| `prop.metro.<city>` (+ `prop.metro.paris.light`)                                                 | 1                    | Metro diamond / roundel / Guimard arch                 |
| `prop.hydrant.<city>`, `prop.bollard.<city>`, `prop.planter.<city>.{0,1}`                        | 1                    |                                                        |
| `prop.cafe.<city>.{0,1}.{i,j}`                                                                   | 1                    | table, chairs, parasol                                 |
| `prop.trafficlight.<city>`                                                                       | 3 (R/A/G) @ 0.25 fps |                                                        |
| `prop.flag.<city>`                                                                               | 4 @ 6 fps            | Spain / Union flag / tricolore                         |
| `prop.bike.<city>.{0-2}.{i,j}`                                                                   | 1                    | hire bikes / Vespas                                    |
| `prop.phonebox`, `prop.postbox`, `prop.morris.{0,1}`, `prop.wallace`, `prop.statue`, `prop.cone` | 1                    |                                                        |
| `prop.sign.{noentry,oneway,yield,parking}`                                                       | 1                    | `sign` picks by seed                                   |
| `prop.litter.{0-2}`                                                                              | 1                    | can, paper, bag                                        |
| `prop.pigeon.{idle,peck,fly}`                                                                    | 2 @3 / 3 @6 / 3 @12  |                                                        |

## 4. Decals — `decals.ts` (group `decals`, palette-only, anchor = centre)

`decalSprite(kind, seed?, axis?)` over `DECAL_KINDS`: `decal.tag.{anarchy,heart,no,mola,oi,non,riot}`,
`decal.scorch.{0-2}`, `decal.glass.{0,1}`, `decal.litter.{0-2}`, `decal.puddle.{0,1}`,
`decal.leaflets.{0,1}`, `decal.splat.{0-3}`, `decal.tyre.{0,1}.{i,j}`.

## 5. Previews — `preview.ts`, `scene.ts`

`renderPreview(city, night?)` composes a 16×19 street corner with the real APIs (terrain, buildings

- shadows, props, decals; depth-sorted like M8 will). Registered (gallery/Node only, group
  `preview`) as `env.preview.<city>` and `env.preview.<city>.night` (palette-safe night stand-in:
  everything dimmed 2 steps, lights layers + lamp light pools on top). `scene.ts` is a reusable mini
  compositor for offline renders; `dev.ts` has review helpers (`testTerrain`, `testBuildings`,
  `testProps`, `kitSheet`, `perfBuildings`) — not registered.

## Integration notes (M8)

- Registration is gated: tile/building samples and previews register only when not on the game
  page (`/gallery` or Node), so the game atlas holds just props + decals. The game calls
  `groundTile`/`paintBuilding` directly at map load (bake terrain into chunk RTs; pack buildings).
- Building depth: use the footprint's near vertices (`(i+j+min(w,d))·8`) or slice non-square
  footprints; shadows go in the decal layer under sprites. Night: draw `art.lights` (and prop
  `.light` sprites) additively / unlit over the graded scene.
- Tests: `tests/env-ground.test.ts`, `tests/env-buildings.test.ts`, `tests/env-props.test.ts`.
