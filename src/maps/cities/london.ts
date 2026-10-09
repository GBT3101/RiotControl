/**
 * LONDON — Palace of Westminster and the ~3 km around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): real NORTH is −i (left), EAST is −j (up). The
 * palace's river front runs north–south along the Thames, so here it lies along i with the
 * Thames directly behind it (top) and Elizabeth Tower at its low-i (north) end, as the contract
 * footprint expects. Its front (+j) faces Old Palace Yard and the Abbey; Parliament Square is
 * front-left, Whitehall runs left (north) to Trafalgar Square, The Mall and St James's Park lead
 * down (west) to Buckingham Palace, Victoria Street runs down-right (south-west) to Victoria, and
 * Millbank follows the river right (south) toward Pimlico. Lambeth and the South Bank lie across
 * the river at the top, reached only by Westminster Bridge and Lambeth Bridge.
 */
import type { Blueprint } from '../blueprint';
import { circle, poly, rect } from '../blueprint';

const RIVER_J = 18; // Thames centre line (water j 15..20, quays 14 & 21)
const WB_I = 39.5; // Westminster Bridge / Bridge Street (i 37..41)
const LB_I = 66; // Lambeth Bridge / Horseferry Road (i 64..67)
const WH_J = 27.5; // Whitehall (j 25..29)
const MALL_I = 10.5; // The Mall (i 8..12)

export const london: Blueprint = {
  city: 'london',
  name: 'London',
  w: 80,
  h: 72,
  seed: 0x6c6f6e64,
  style: {
    roofs: { pitched: 5, flat: 4, terrace: 1 },
    storeys: [3, 5],
    residential: 0.7,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.03 },
      { kind: 'phonebox', p: 0.012 },
      { kind: 'postbox', p: 0.012 },
      { kind: 'busstop', p: 0.014 },
      { kind: 'bench', p: 0.012 },
      { kind: 'hydrant', p: 0.006 },
      { kind: 'bollard', p: 0.012 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.025 },
      { kind: 'bin', p: 0.012 },
      { kind: 'planter', p: 0.01 },
    ],
    laneSurface: 'asphalt',
    maxBlock: 13,
  },

  areas: [
    // St James's Park with its lake; Green Park strip by Buckingham.
    {
      ground: 'grass',
      shape: rect(13, 38, 26, 58),
      name: "St James's Park",
      trees: { kinds: ['tree.plane', 'tree.round', 'tree.willow'], density: 0.3 },
    },
    {
      ground: 'water',
      shape: poly([15, 45], [21, 44], [24, 47], [23, 51], [17, 53], [15, 50]),
      name: "St James's Park Lake",
    },
    { ground: 'parkPath', shape: rect(13, 41, 26, 41) },
    { ground: 'parkPath', shape: rect(13, 55, 26, 55) },
    { ground: 'parkPath', shape: rect(19, 53, 19, 58) },
    { ground: 'parkPath', shape: rect(25, 38, 25, 55) },
    {
      ground: 'grass',
      shape: rect(0, 53, 7, 58),
      name: 'Green Park',
      trees: { kinds: ['tree.plane', 'tree.round'], density: 0.4 },
    },
    // Victoria Tower Gardens (between Millbank and the river) & Embankment gardens.
    {
      ground: 'grass',
      shape: rect(57, 22, 63, 31),
      name: 'Victoria Tower Gardens',
      trees: { kinds: ['tree.plane'], density: 0.3 },
    },
    { ground: 'parkPath', shape: rect(57, 25, 63, 25) },
    {
      ground: 'grass',
      shape: rect(21, 18, 30, 20),
      name: 'Whitehall Gardens',
      trees: { kinds: ['tree.plane', 'tree.round'], density: 0.35 },
      layer: 'top',
    },
    // South Bank: Jubilee Gardens by the Eye.
    {
      ground: 'grass',
      shape: rect(28, 2, 30, 8),
      layer: 'top',
      trees: { kinds: ['tree.round'], density: 0.3 },
    },
    // --- Top layer: squares.
    // Parliament Square: traffic ring + lawn island.
    { ground: 'asphalt', shape: rect(27, 25, 41, 37), layer: 'top', name: 'Parliament Square' },
    {
      ground: 'grass',
      shape: rect(30, 28, 37, 34),
      layer: 'top',
      trees: { kinds: ['tree.round'], density: 0.08 },
    },
    // Old Palace Yard — the palace forecourt (steps painted on top).
    { ground: 'plaza', shape: rect(41, 28, 58, 37), layer: 'top', name: 'Old Palace Yard' },
    // Trafalgar Square.
    { ground: 'plaza', shape: rect(4, 19, 14, 32), layer: 'top', name: 'Trafalgar Square' },
    { ground: 'water', shape: rect(5, 21, 6, 22), layer: 'top' },
    { ground: 'water', shape: rect(5, 29, 6, 30), layer: 'top' },
    // Horse Guards Parade (gravel).
    { ground: 'parkPath', shape: rect(12, 32, 20, 35), layer: 'top', name: 'Horse Guards Parade' },
    // Victoria Memorial roundabout in front of Buckingham Palace.
    {
      ground: 'asphalt',
      shape: circle(10.5, 60, 4.6),
      layer: 'top',
      name: 'Queen Victoria Memorial',
    },
    { ground: 'plaza', shape: circle(10.5, 60, 2.2), layer: 'top' },
    // Lambeth Bridge roundabout.
    { ground: 'asphalt', shape: circle(LB_I, 33.5, 3.6), layer: 'top' },
    // Smith Square.
    { ground: 'plaza', shape: rect(56, 41, 61, 45), layer: 'top', name: 'Smith Square' },
    // Covent Garden piazza.
    { ground: 'cobble', shape: rect(2, 5, 6, 8), layer: 'top', name: 'Covent Garden' },
  ],

  rivers: [
    {
      name: 'River Thames',
      path: [
        [81, RIVER_J],
        [34, RIVER_J],
        [25, 13],
        [21, 6],
        [20, -2],
      ],
      width: 6,
      quay: 1,
    },
  ],

  roads: [
    // ── Across the river (South Bank / Lambeth).
    {
      name: 'Westminster Bridge Road',
      path: [
        [WB_I, -1],
        [WB_I, 14],
      ],
      width: 5,
      trees: null,
    },
    {
      name: 'Lambeth Palace Road',
      path: [
        [WB_I, 10.5],
        [LB_I, 10.5],
      ],
      width: 3,
    },
    {
      name: 'Albert Embankment',
      path: [
        [LB_I, 10.5],
        [81, 10.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Lambeth Road',
      path: [
        [LB_I, -1],
        [LB_I, 14],
      ],
      width: 4,
    },
    {
      name: 'Kennington Lane',
      path: [
        [LB_I, 4.5],
        [81, 4.5],
      ],
      width: 3,
    },
    {
      name: 'Belvedere Road',
      path: [
        [24, 9.5],
        [WB_I, 9.5],
      ],
      width: 3,
    },
    {
      name: 'York Road',
      path: [
        [31.5, -1],
        [31.5, 9],
      ],
      width: 3,
    },
    {
      name: 'Baylis Road',
      path: [
        [WB_I, 3.5],
        [LB_I, 3.5],
      ],
      width: 3,
    },
    // ── North bank: the Embankment, Whitehall, Trafalgar.
    {
      name: 'Victoria Embankment',
      path: [
        [36, 24],
        [30, 24],
        [23, 17],
        [17, 9],
        [16, -1],
      ],
      width: 4,
      trees: 'tree.plane',
      labelPath: [
        [30, 23.5],
        [23, 17],
      ],
    },
    {
      name: 'Bridge Street',
      path: [
        [WB_I, 22],
        [WB_I, 26],
      ],
      width: 5,
    },
    {
      name: 'Whitehall',
      path: [
        [11, WH_J],
        [28, WH_J],
      ],
      width: 5,
      trees: null,
      storeyBonus: 1,
    },
    {
      name: 'Northumberland Avenue',
      path: [
        [11, 21],
        [19, 13],
      ],
      width: 4,
    },
    {
      name: 'Strand',
      path: [
        [10, 21],
        [10, 10],
        [12, -1],
      ],
      width: 4,
      cafes: true,
    },
    {
      name: 'Charing Cross Road',
      path: [
        [-1, 14.5],
        [10, 14.5],
      ],
      width: 3,
    },
    // ── The Mall, Horse Guards, Birdcage Walk, Buckingham.
    {
      name: 'The Mall',
      path: [
        [MALL_I, 33],
        [MALL_I, 57],
      ],
      width: 5,
      trees: 'tree.plane',
      rooftops: false,
      surface: 'asphalt',
    },
    {
      name: 'Horse Guards Road',
      path: [
        [MALL_I, 37.5],
        [28, 37.5],
      ],
      width: 3,
      rooftops: false,
    },
    {
      name: 'Birdcage Walk',
      path: [
        [28.5, 37],
        [28.5, 60.5],
        [13, 60.5],
      ],
      width: 3,
      trees: 'tree.plane',
      labelPath: [
        [28.5, 44],
        [28.5, 58],
      ],
    },
    {
      name: 'Pall Mall',
      path: [
        [-1, 36.5],
        [MALL_I, 36.5],
      ],
      width: 3,
    },
    {
      name: 'Piccadilly',
      path: [
        [-1, 46],
        [MALL_I, 46],
      ],
      width: 4,
    },
    {
      name: 'Constitution Hill',
      path: [
        [6.5, 59.5],
        [-1, 59.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    // ── Victoria Street & the south-west.
    {
      name: 'Victoria Street',
      path: [
        [39.5, 37],
        [39.5, 41],
        [58, 60],
        [58, 73],
      ],
      width: 5,
      trees: null,
      storeyBonus: 1,
      labelPath: [
        [41, 43],
        [56, 58],
      ],
    },
    {
      name: 'Buckingham Gate',
      path: [
        [28.5, 52.5],
        [52, 52.5],
      ],
      width: 3,
    },
    {
      name: 'Tothill Street',
      path: [
        [28.5, 43.5],
        [55.5, 43.5],
      ],
      width: 3,
    },
    {
      name: 'Great Smith Street',
      path: [
        [49.5, 44],
        [49.5, 51],
      ],
      width: 3,
    },
    // ── Abingdon Street → Millbank, Horseferry Road, Pimlico.
    {
      name: 'Abingdon Street',
      path: [
        [41, 33.5],
        [LB_I, 33.5],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Millbank',
      path: [
        [LB_I, 33.5],
        [81, 33.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Horseferry Road',
      path: [
        [LB_I, 33.5],
        [LB_I, 48],
        [52, 48],
      ],
      width: 4,
      labelPath: [
        [LB_I, 36],
        [LB_I, 46],
      ],
    },
    {
      name: 'Great College Street',
      path: [
        [55.5, 36],
        [55.5, 48],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Marsham Street',
      path: [
        [49.5, 51],
        [49.5, 55],
        [62.5, 55],
        [62.5, 41],
      ],
      width: 3,
    },
    {
      name: 'Vauxhall Bridge Road',
      path: [
        [58, 62],
        [81, 46],
      ],
      width: 5,
      trees: 'tree.plane',
    },
    {
      name: 'Lupus Street',
      path: [
        [70.5, 52],
        [70.5, 73],
      ],
      width: 3,
    },
    {
      name: 'Buckingham Palace Road',
      path: [
        [17.5, 60.5],
        [17.5, 73],
      ],
      width: 3,
    },
    {
      name: 'Eaton Square',
      path: [
        [17.5, 66.5],
        [36.5, 66.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Eccleston Street',
      path: [
        [36.5, 60.5],
        [36.5, 73],
      ],
      width: 3,
    },
  ],

  bridges: [
    {
      name: 'Westminster Bridge',
      path: [
        [WB_I, 13],
        [WB_I, 23],
      ],
      width: 5,
    },
    {
      name: 'Lambeth Bridge',
      path: [
        [LB_I, 13],
        [LB_I, 33],
      ],
      width: 4,
    },
  ],

  landmarks: [
    { id: 'abbey', i: 43, j: 38 },
    { id: 'churchill', i: 33, j: 29 },
    { id: 'nelson', i: 8, j: 25 },
    { id: 'londonEye', i: 24, j: 3 },
    { id: 'buckingham', i: 6, j: 65 },
  ],

  capitol: { i: 42, j: 22, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'County Hall', i: 33, j: 1, w: 4, d: 4, storeys: 5, roof: 'pitched', rooftop: true },
    { name: 'Lambeth Palace', i: 69, j: 6, w: 6, d: 3, storeys: 3, roof: 'pitched' },
    {
      name: 'Ministry of Defence',
      i: 21,
      j: 22,
      w: 6,
      d: 3,
      storeys: 5,
      roof: 'flat',
      rooftop: true,
    },
    { name: 'Banqueting House', i: 13, j: 22, w: 4, d: 3, storeys: 4, roof: 'flat', rooftop: true },
    { name: 'Horse Guards', i: 12, j: 30, w: 6, d: 1 + 1, storeys: 3, roof: 'pitched' },
    { name: 'HM Treasury', i: 21, j: 30, w: 6, d: 4, storeys: 5, roof: 'flat', rooftop: true },
    { name: "St Margaret's", i: 50, j: 38, w: 3, d: 3, storeys: 3, roof: 'pitched' },
    { name: 'Tate Britain', i: 72, j: 28, w: 6, d: 4, storeys: 3, roof: 'flat' },
    { name: 'Westminster Cathedral', i: 50, j: 61, w: 4, d: 4, storeys: 5, roof: 'pitched' },
    { name: 'Victoria Station', i: 61, j: 64, w: 6, d: 4, storeys: 3, roof: 'flat' },
    { name: 'National Gallery', i: 0, j: 22, w: 4, d: 6, storeys: 4, roof: 'flat' },
  ],

  zones: [
    // Whitehall & Westminster: government stone, never spawn buildings.
    {
      shape: rect(11, 20, 64, 46),
      storeys: [4, 5],
      residential: 0.1,
      kind: 'commercial',
      roofs: { flat: 4, pitched: 3 },
    },
    // Pimlico stucco terraces: long, shallow, residential.
    {
      shape: rect(60, 48, 80, 72),
      storeys: [3, 5],
      residential: 0.95,
      maxDepth: 3,
      roofs: { pitched: 3, flat: 3, terrace: 2 },
    },
    // Lambeth: lower brick terraces.
    { shape: rect(22, 0, 80, 14), storeys: [2, 4], residential: 0.9, maxDepth: 3 },
    // Covent Garden / Soho: dense mixed.
    { shape: rect(0, 0, 16, 19), storeys: [3, 5], residential: 0.75 },
  ],

  districts: [
    { id: 'pimlico', name: 'Pimlico', unlockWave: 1, area: [62, 48, 79, 71], rally: [70, 58] },
    { id: 'covent', name: 'Covent Garden', unlockWave: 1, area: [0, 0, 15, 19], rally: [6, 6] },
    { id: 'lambeth', name: 'Lambeth', unlockWave: 2, area: [56, 0, 79, 13], rally: [72, 4] },
    { id: 'southbank', name: 'Waterloo', unlockWave: 3, area: [28, 0, 58, 9], rally: [36, 9] },
    { id: 'victoria', name: 'Victoria', unlockWave: 4, area: [38, 50, 61, 71], rally: [45, 56] },
    { id: 'mayfair', name: 'Mayfair & Soho', unlockWave: 6, area: [0, 34, 7, 52], rally: [3, 41] },
    { id: 'belgravia', name: 'Belgravia', unlockWave: 8, area: [14, 62, 37, 71], rally: [26, 66] },
  ],

  chokepoints: [
    { name: 'Westminster Bridge', at: [WB_I, 18], radius: 2 },
    { name: 'Lambeth Bridge', at: [LB_I, 18], radius: 2 },
    { name: 'Parliament Square', at: [40, 30], radius: 2 },
  ],

  approaches: [
    {
      name: 'Parliament Square → St Margaret Street',
      path: [
        [28, WH_J],
        [WB_I, WH_J],
        [WB_I, 31],
        [43, 31],
      ],
      final: true,
    },
    {
      name: 'Abingdon Street (from Millbank)',
      path: [
        [LB_I, 33.5],
        [58, 33.5],
      ],
      final: true,
    },
    {
      name: 'Great College Street',
      path: [
        [55.5, 41],
        [55.5, 36],
      ],
      final: true,
    },
    {
      name: 'Westminster Bridge',
      path: [
        [WB_I, 4],
        [WB_I, 23],
      ],
    },
    {
      name: 'Lambeth Bridge',
      path: [
        [LB_I, 4],
        [LB_I, 33],
      ],
    },
    {
      name: 'Whitehall',
      path: [
        [11, WH_J],
        [28, WH_J],
      ],
    },
    {
      name: 'Victoria Street',
      path: [
        [58, 60],
        [39.5, 41],
        [39.5, 37],
      ],
    },
    {
      name: 'Millbank',
      path: [
        [79, 33.5],
        [LB_I, 33.5],
      ],
    },
    {
      name: 'Birdcage Walk',
      path: [
        [28.5, 60],
        [28.5, 37],
      ],
    },
  ],

  decor: [
    // Parliament Square statues (Churchill is a landmark) + Trafalgar lions & fountains.
    { kind: 'statue', at: [31, 33] },
    { kind: 'statue', at: [35, 33] },
    { kind: 'statue', at: [36, 29] },
    { kind: 'statue.lion', at: [7, 24] },
    { kind: 'statue.lion', at: [10, 24] },
    { kind: 'statue.lion', at: [7, 27] },
    { kind: 'statue.lion', at: [10, 27] },
    { kind: 'statue.equestrian', at: [12, 21] },
    // Victoria Memorial.
    { kind: 'statue', at: [10, 59] },
    // Old Palace Yard: Richard the Lionheart, flags.
    { kind: 'statue.equestrian', at: [43, 34] },
    { kind: 'flag', at: [46, 35] },
    { kind: 'flag', at: [54, 35] },
    // Horse Guards sentries' boxes, Cenotaph on Whitehall.
    { kind: 'sentrybox', at: [14, 29] },
    { kind: 'sentrybox', at: [17, 29] },
    { kind: 'cenotaph', at: [25, 29] },
    // Tube entrances.
    { kind: 'tube', at: [36, 24] },
    { kind: 'tube', at: [12, 19] },
    { kind: 'tube', at: [57, 63] },
    { kind: 'tube', at: [42, 10] },
    { kind: 'tube', at: [64, 50] },
    // Phone boxes in Parliament Square, Buxton Memorial in the gardens.
    { kind: 'phonebox', at: [41, 27] },
    { kind: 'phonebox', at: [26, 37] },
    { kind: 'fountain', at: [60, 24] },
    // Pelicans on the lake.
    { kind: 'boat', at: [18, 49] },
  ],

  noLanes: [rect(36, 20, 66, 46), rect(10, 20, 30, 37)],

  labels: [
    { text: 'St James’s Park', at: [19, 47] },
    { text: 'Lambeth', at: [62, 1] },
  ],
};
