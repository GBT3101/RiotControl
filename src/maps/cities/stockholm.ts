/**
 * STOCKHOLM — Riksdagshuset on Helgeandsholmen and the islands around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): unrotated, NORTH is −j (up), EAST is +i (right).
 * Helgeandsholmen is a small island in the Norrström between Norrmalm (north) and Gamla stan
 * (south). The Riksdag fills most of it; its front (+j) faces south over the Stallkanalen to
 * Mynttorget, the square where Stockholm demonstrates, with the Royal Palace just beyond. Behind
 * it (top) the Norrström separates the island from Norrmalm's ministries (Rosenbad, Arvfurstens
 * palats), Gustav Adolfs torg, the Opera, Kungsträdgården and Drottninggatan.
 *
 * Every crowd has to cross water. Three bridges reach the island and are its only entries:
 * Riksbron (from Drottninggatan, straight onto Riksgatan), Norrbro (from Gustav Adolfs torg over
 * the island's east end and on to the palace) and Stallbron (from Mynttorget, straight into the
 * forecourt). Further out, Vasabron and Centralbron link Norrmalm to Gamla stan and Riddarholmen,
 * Stadshusbron and Kungsbron bring Kungsholmen over Klara sjö, and Slussen and Centralbron bring
 * Södermalm over the Söderström. Kungsholmen with the Stadshuset tower sits west across Klara sjö,
 * Riddarholmen with its church spire south-west across the Riddarholmskanalen, Riddarfjärden
 * opens to the west and Strömmen / Saltsjön to the east.
 */
import type { Blueprint } from '../blueprint';
import { rect } from '../blueprint';

const AXIS_I = 36.5; // Drottninggatan → Riksbron → Riksgatan → Stallbron → Mynttorget → Västerlånggatan
const NORRBRO_I = 51; // Norrbro (i 49..52)
const VASA_I = 30; // Vasabron (i 28..31)
const CENTRAL_I = 21.5; // Centralbron (i 20..22)
const SLUSSEN_I = 43; // Slussen / Götgatan (i 40..45)
const STROM_J = 23.5; // Strömgatan (j 22..24), Norrmalm's quay street
const FREDS_J = 17.5; // Fredsgatan (j 16..18)
const HAMN_J = 9.5; // Hamngatan (j 8..10)
const KUNGS_J = 3.5; // Kungsgatan (j 2..4)
const NORRSTROM_J = 28; // Norrström water (j 26..29)
const STALL_J = 44; // Stallkanalen water (j 43..44)
const SODER_J = 68; // Söderström water (j 67..68)

export const stockholm: Blueprint = {
  city: 'stockholm',
  name: 'Stockholm',
  w: 72,
  h: 80,
  seed: 0x73746f63,
  style: {
    roofs: { pitched: 6, flat: 3, mansard: 1 },
    storeys: [4, 5],
    residential: 0.72,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.026 },
      { kind: 'bench', p: 0.012 },
      { kind: 'busstop', p: 0.012 },
      { kind: 'bike', p: 0.012 },
      { kind: 'kiosk', p: 0.004 },
      { kind: 'planter', p: 0.008 },
      { kind: 'bollard', p: 0.01 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.02 },
      { kind: 'bin', p: 0.012 },
      { kind: 'planter', p: 0.012 },
    ],
    laneSurface: 'cobble',
    maxBlock: 12,
  },

  areas: [
    // ── Open water (the channels between the islands are rivers below, with their quays).
    { ground: 'water', shape: rect(16, 26, 32, 44), name: 'Strömmen' },
    { ground: 'water', shape: rect(56, 26, 71, 45), name: 'Strömmen' },
    { ground: 'water', shape: rect(0, 42, 13, 66), name: 'Riddarfjärden' },
    { ground: 'water', shape: rect(60, 45, 71, 66), name: 'Saltsjön' },
    // Kungsträdgården: lawns, the central allée and the cherry trees.
    {
      ground: 'grass',
      shape: rect(58, 11, 63, 21),
      name: 'Kungsträdgården',
      trees: { kinds: ['tree.round', 'tree.chestnut'], density: 0.35 },
    },
    { ground: 'parkPath', shape: rect(60, 11, 61, 21) },
    // Strömparterren under Norrbro at the island's east tip.
    {
      ground: 'grass',
      shape: rect(53, 31, 54, 36),
      trees: { kinds: ['tree.round'], density: 0.3 },
    },
    // Stadshuset's waterfront garden on Riddarfjärden, reached past its east wing.
    {
      ground: 'grass',
      shape: rect(0, 39, 10, 40),
      trees: { kinds: ['tree.round'], density: 0.25 },
    },
    // ── Top layer: squares.
    // Riksdag forecourt facing the Stallkanalen.
    { ground: 'plaza', shape: rect(34, 37, 54, 41), layer: 'top', name: 'Riksplan' },
    { ground: 'plaza', shape: rect(45, 17, 52, 24), layer: 'top', name: 'Gustav Adolfs torg' },
    { ground: 'plaza', shape: rect(17, 19, 26, 24), layer: 'top', name: 'Tegelbacken' },
    { ground: 'plaza', shape: rect(11, 26, 11, 40), layer: 'top', name: 'Stadshusgården' },
    { ground: 'plaza', shape: rect(31, 6, 41, 11), layer: 'top', name: 'Sergels torg' },
    { ground: 'plaza', shape: rect(33, 46, 40, 49), layer: 'top', name: 'Mynttorget' },
    { ground: 'cobble', shape: rect(45, 46, 57, 47), layer: 'top', name: 'Lejonbacken' },
    { ground: 'cobble', shape: rect(56, 48, 58, 56), layer: 'top', name: 'Slottsbacken' },
    { ground: 'cobble', shape: rect(40, 54, 44, 57), layer: 'top', name: 'Stortorget' },
    { ground: 'plaza', shape: rect(37, 63, 45, 65), layer: 'top', name: 'Järntorget' },
    { ground: 'cobble', shape: rect(15, 50, 19, 52), layer: 'top', name: 'Birger Jarls torg' },
  ],

  rivers: [
    {
      name: 'Klara sjö',
      path: [
        [14.5, -1],
        [14.5, 43],
      ],
      width: 3,
    },
    {
      name: 'Norrström',
      path: [
        [17, NORRSTROM_J],
        [62, NORRSTROM_J],
      ],
      width: 4,
    },
    {
      name: 'Stallkanalen',
      path: [
        [24, STALL_J],
        [61, STALL_J],
      ],
      width: 2,
    },
    {
      name: 'Riddarholmskanalen',
      path: [
        [25.5, 43],
        [25.5, 69],
      ],
      width: 3,
    },
    {
      name: 'Söderström',
      path: [
        [-1, SODER_J],
        [73, SODER_J],
      ],
      width: 2,
    },
    // Quays along the open water (no extra water: width 0 paints the embankment only).
    {
      name: 'Norr Mälarstrand',
      path: [
        [0, 41.5],
        [13, 41.5],
      ],
      width: 0,
    },
    {
      name: 'Blasieholmskajen',
      path: [
        [56, 25.5],
        [72, 25.5],
      ],
      width: 0,
    },
    {
      name: 'Helgeandsholmen',
      path: [
        [33.5, 30],
        [33.5, 42],
      ],
      width: 0,
    },
    {
      name: 'Strömparterren',
      path: [
        [55.5, 30],
        [55.5, 42],
      ],
      width: 0,
    },
    {
      name: 'Riddarholmen',
      path: [
        [14.5, 45],
        [14.5, 66],
      ],
      width: 0,
    },
    {
      name: 'Skeppsbron',
      path: [
        [59.5, 45],
        [59.5, 66],
      ],
      width: 0,
    },
  ],

  roads: [
    // ── Kungsholmen.
    {
      name: 'Hantverkargatan',
      path: [
        [-1, 24.5],
        [10, 24.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Fleminggatan',
      path: [
        [-1, 6.5],
        [10, 6.5],
      ],
      width: 3,
    },
    {
      name: 'Scheelegatan',
      path: [
        [5.5, -1],
        [5.5, 33],
      ],
      width: 3,
    },
    // ── Norrmalm.
    {
      name: 'Vasagatan',
      path: [
        [24.5, -1],
        [24.5, 20],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: true,
    },
    {
      name: 'Kungsgatan',
      path: [
        [16, KUNGS_J],
        [73, KUNGS_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Hamngatan',
      path: [
        [16, HAMN_J],
        [73, HAMN_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Fredsgatan',
      path: [
        [16, FREDS_J],
        [45, FREDS_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Strömgatan',
      path: [
        [16, STROM_J],
        [73, STROM_J],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: true,
      labelPath: [
        [53, STROM_J],
        [70, STROM_J],
      ],
    },
    {
      name: 'Drottninggatan',
      path: [
        [AXIS_I, -1],
        [AXIS_I, STROM_J],
      ],
      width: 3,
      sidewalk: 0,
      surface: 'plaza',
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Regeringsgatan',
      path: [
        [44.5, -1],
        [44.5, 17],
      ],
      width: 3,
    },
    {
      name: 'Kungsträdgårdsgatan',
      path: [
        [56.5, HAMN_J],
        [56.5, STROM_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Birger Jarlsgatan',
      path: [
        [66.5, -1],
        [66.5, STROM_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    // ── Helgeandsholmen.
    {
      name: 'Riksgatan',
      path: [
        [AXIS_I, 30],
        [AXIS_I, 38],
      ],
      width: 3,
      sidewalk: 0,
      surface: 'plaza',
      rooftops: true,
    },
    // ── Gamla stan.
    {
      name: 'Munkbroleden',
      path: [
        [29.5, 46],
        [29.5, 66],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Storkyrkobrinken',
      path: [
        [30, 51],
        [46, 51],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Köpmangatan',
      path: [
        [37, 61],
        [56, 61],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Österlånggatan',
      path: [
        [54, 56],
        [54, 66],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    // Painted after the cobble cross streets so the pedestrian axis stays plaza at the crossings.
    {
      name: 'Västerlånggatan',
      path: [
        [36, 49],
        [36, 63],
      ],
      width: 2,
      surface: 'plaza',
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Skeppsbron',
      path: [
        [57.5, 46],
        [57.5, 66],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: true,
    },
    // ── Södermalm.
    {
      name: 'Söder Mälarstrand',
      path: [
        [-1, 71.5],
        [40, 71.5],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: true,
    },
    {
      name: 'Katarinavägen',
      path: [
        [46, 71.5],
        [73, 71.5],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Götgatan',
      path: [
        [SLUSSEN_I, 71],
        [SLUSSEN_I, 81],
      ],
      width: 4,
      cafes: true,
    },
    {
      name: 'Hornsgatan',
      path: [
        [-1, 78.5],
        [41, 78.5],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Folkungagatan',
      path: [
        [45, 78.5],
        [73, 78.5],
      ],
      width: 3,
    },
  ],

  bridges: [
    {
      name: 'Riksbron',
      path: [
        [AXIS_I, STROM_J],
        [AXIS_I, 31],
      ],
      width: 3,
    },
    {
      name: 'Norrbro',
      path: [
        [NORRBRO_I, 22],
        [NORRBRO_I, 47],
      ],
      width: 4,
    },
    {
      name: 'Stallbron',
      path: [
        [AXIS_I, 41],
        [AXIS_I, 47],
      ],
      width: 3,
    },
    {
      name: 'Vasabron',
      path: [
        [VASA_I, 22],
        [VASA_I, 47],
      ],
      width: 4,
    },
    {
      name: 'Centralbron',
      path: [
        [CENTRAL_I, 22],
        [CENTRAL_I, 72],
      ],
      width: 3,
    },
    {
      name: 'Riddarhusbron',
      path: [
        [19, 53.5],
        [29, 53.5],
      ],
      width: 3,
    },
    {
      name: 'Stadshusbron',
      path: [
        [9, 24.5],
        [19, 24.5],
      ],
      width: 3,
    },
    {
      name: 'Kungsbron',
      path: [
        [9, 6.5],
        [19, 6.5],
      ],
      width: 3,
    },
    {
      name: 'Slussen',
      path: [
        [SLUSSEN_I, 64],
        [SLUSSEN_I, 72],
      ],
      width: 6,
    },
  ],

  landmarks: [
    { id: 'royalPalace', i: 47, j: 48 },
    { id: 'cityHall', i: 3, j: 34 },
    { id: 'riddarholmen', i: 15, j: 56 },
  ],

  capitol: { i: 38, j: 31, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Rosenbad', i: 26, j: 19, w: 6, d: 3, storeys: 5, roof: 'pitched', rooftop: true },
    {
      name: 'Arvfurstens palats',
      i: 39,
      j: 19,
      w: 5,
      d: 3,
      storeys: 4,
      roof: 'pitched',
      rooftop: true,
    },
    { name: 'Kungliga Operan', i: 53, j: 18, w: 4, d: 4, storeys: 4, roof: 'flat', rooftop: true },
    { name: 'Centralstationen', i: 17, j: 11, w: 6, d: 4, storeys: 3, roof: 'pitched' },
    { name: 'Kulturhuset', i: 31, j: 12, w: 6, d: 3, storeys: 6, roof: 'flat', rooftop: true },
    { name: 'Riddarhuset', i: 31, j: 52, w: 4, d: 3, storeys: 3, roof: 'mansard' },
    { name: 'Börshuset', i: 39, j: 52, w: 6, d: 2, storeys: 3, roof: 'pitched' },
    { name: 'Storkyrkan', i: 47, j: 57, w: 5, d: 3, storeys: 5, roof: 'pitched' },
    { name: 'Wrangelska palatset', i: 15, j: 46, w: 2, d: 3, storeys: 3, roof: 'mansard' },
  ],

  zones: [
    // Gamla stan: narrow, tall gabled merchant houses.
    {
      shape: rect(27, 46, 59, 66),
      storeys: [4, 5],
      residential: 0.75,
      maxLen: 4,
      roofs: { pitched: 9, mansard: 1 },
    },
    // Riddarholmen: palaces, no homes.
    { shape: rect(15, 46, 23, 66), storeys: [3, 4], residential: 0, kind: 'commercial' },
    // Government Norrmalm by the water.
    {
      shape: rect(17, 11, 56, 24),
      storeys: [4, 6],
      residential: 0.25,
      roofs: { pitched: 3, flat: 3, mansard: 2 },
    },
    // Södermalm: lower pastel houses.
    { shape: rect(0, 69, 71, 79), storeys: [3, 5], residential: 0.92 },
    // Kungsholmen, Vasastan and Östermalm: tall stone blocks.
    { shape: rect(0, 0, 11, 40), storeys: [5, 6], residential: 0.9 },
    {
      shape: rect(60, 0, 71, 24),
      storeys: [5, 6],
      residential: 0.88,
      roofs: { pitched: 4, mansard: 3, flat: 2 },
    },
  ],

  districts: [
    { id: 'norrmalm', name: 'Norrmalm', unlockWave: 1, area: [17, 0, 33, 10], rally: [AXIS_I, 5] },
    {
      id: 'sodermalm',
      name: 'Södermalm',
      unlockWave: 1,
      area: [0, 70, 71, 79],
      rally: [SLUSSEN_I, 75],
    },
    {
      id: 'kungsholmen',
      name: 'Kungsholmen',
      unlockWave: 2,
      area: [0, 0, 11, 33],
      rally: [5, 20],
    },
    { id: 'ostermalm', name: 'Östermalm', unlockWave: 3, area: [60, 0, 71, 21], rally: [66, 14] },
    { id: 'vasastan', name: 'Vasastan', unlockWave: 5, area: [38, 0, 59, 7], rally: [46, KUNGS_J] },
  ],

  chokepoints: [
    { name: 'Riksbron', at: [AXIS_I, NORRSTROM_J], radius: 2 },
    { name: 'Norrbro', at: [NORRBRO_I, NORRSTROM_J], radius: 2 },
    { name: 'Stallbron', at: [AXIS_I, STALL_J], radius: 2 },
  ],

  approaches: [
    {
      name: 'Riksbron → Riksgatan',
      path: [
        [AXIS_I, 26],
        [AXIS_I, 37],
        [39, 37.5],
      ],
      final: true,
    },
    {
      name: 'Stallbron',
      path: [
        [AXIS_I, 48],
        [AXIS_I, 41],
        [39, 40],
      ],
      final: true,
    },
    {
      name: 'Norrbro',
      path: [
        [NORRBRO_I, 21],
        [NORRBRO_I, 39],
        [46, 39],
      ],
      final: true,
    },
    {
      name: 'Drottninggatan',
      path: [
        [AXIS_I, 2],
        [AXIS_I, STROM_J],
      ],
    },
    {
      name: 'Strömgatan → Norrbro',
      path: [
        [66, STROM_J],
        [NORRBRO_I, STROM_J],
      ],
    },
    {
      name: 'Vasabron',
      path: [
        [VASA_I, 22],
        [VASA_I, 47],
      ],
    },
    {
      name: 'Slussen → Västerlånggatan',
      path: [
        [SLUSSEN_I, 72],
        [SLUSSEN_I, 64],
        [36, 63],
        [36, 49],
      ],
    },
  ],

  decor: [
    // Riksplan: flags in front of the steps.
    { kind: 'flag', at: [38, 39] },
    { kind: 'flag', at: [47, 39] },
    // Gustav II Adolf on his square, flags at the Opera.
    { kind: 'statue.equestrian', at: [48, 21] },
    { kind: 'flag', at: [52, 22] },
    // Kungsträdgården: Karl XII, and the fountain.
    { kind: 'statue', at: [60, 21] },
    { kind: 'fountain', at: [60, 15] },
    // Sergels torg: the glass obelisk, T-Centralen.
    { kind: 'statue', at: [36, 8] },
    { kind: 'metro', at: [33, 10] },
    { kind: 'metro', at: [61, 10] },
    { kind: 'metro', at: [28, 47] },
    { kind: 'metro', at: [46, 70] },
    // Stortorget well, the palace obelisk, Birger Jarl.
    { kind: 'fountain', at: [42, 56] },
    { kind: 'statue', at: [57, 52] },
    { kind: 'statue', at: [17, 51] },
    // Sentry boxes at the palace.
    { kind: 'sentrybox', at: [46, 47] },
    { kind: 'sentrybox', at: [56, 47] },
    // Hot-dog kiosks.
    { kind: 'kiosk', at: [50, 18] },
    { kind: 'kiosk', at: [23, 20] },
    { kind: 'kiosk', at: [38, 64] },
    // Ferries and boats.
    { kind: 'boat', at: [62, 34] },
    { kind: 'boat', at: [67, 40] },
    { kind: 'boat', at: [65, 55] },
    { kind: 'boat', at: [5, 50] },
    { kind: 'boat', at: [8, 60] },
    { kind: 'boat', at: [25, 33] },
    { kind: 'boat', at: [44, 27] },
  ],

  noLanes: [rect(33, 29, 56, 43)],

  labels: [
    { text: 'Riddarfjärden', at: [6, 52] },
    { text: 'Saltsjön', at: [66, 56] },
    { text: 'Gamla stan', at: [33, 58] },
    { text: 'Kungsholmen', at: [6, 2] },
  ],
};
