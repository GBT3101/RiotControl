/**
 * AMSTERDAM — the Royal Palace on the Dam and the canal belt around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): real NORTH is +i (right), EAST is +j (down), WEST is
 * −j (up). The palace's long front faces east onto the Dam, so it looks +j at the National
 * Monument, with the Nieuwe Kerk beside it to the north (right). Damrak runs north (right) from
 * the Dam to Stationsplein and Centraal Station on the IJ; Rokin and Kalverstraat run south
 * (left) to Muntplein. Behind the palace (up): Nieuwezijds Voorburgwal, Spuistraat and the canal
 * belt. The four canals — Singel, Herengracht, Keizersgracht, Prinsengracht — are concentric
 * ⌐-shapes: their western reaches run north–south across the top of the map, bend at the
 * south-west and their southern reaches run east–west down the left side to the Amstel. Each
 * canal has a narrow quay street on both banks, lined with elms, bikes and houseboats; the
 * Brouwersgracht closes the ring in the north-west. Beyond Prinsengracht lie the Jordaan (top)
 * and Oud-West (top-left); De Pijp is south of the ring (left edge); De Wallen with the
 * Oudezijds canals lies east of Damrak (below the Dam) and Centrum-Oost across the Amstel.
 *
 * Every crowd from outside the centre has to cross canals, so the canal bridges — Raadhuisstraat
 * over the Singel from the Jordaan, Muntplein / Vijzelstraat from De Pijp, the Blauwbrug from
 * Centrum-Oost — are the chokepoints. Centraal Station's footprint runs along i, so it lies along
 * the IJ-side end of Damrak with its front on Stationsplein.
 */
import type { Blueprint, BridgeDef, DecorDef, P, RiverDef, RoadDef } from '../blueprint';
import { rect } from '../blueprint';

/** A belt canal: western reach along i at j = c, bend, southern reach along j at i = s. */
interface Canal {
  name: string;
  c: number;
  s: number;
  /** Where the western reach ends on the right (Brouwersgracht or the IJ). */
  right: number;
}

const BEND = 3; // 45° chamfer of the south-west bends
const AMSTEL_J = 67; // Amstel water (j 65..68), continued by the Oudezijds Voorburgwal
const IJ_I = 78.5; // IJ water (i 77..79)
const BROUWERS_I = 68; // Brouwersgracht water (i 67..68)

const CANALS: readonly Canal[] = [
  { name: 'Prinsengracht', c: 16, s: 11, right: BROUWERS_I },
  { name: 'Keizersgracht', c: 23, s: 18, right: BROUWERS_I },
  { name: 'Herengracht', c: 30, s: 25, right: BROUWERS_I },
  { name: 'Singel', c: 37, s: 32, right: IJ_I },
];
const [PRINSEN, KEIZERS, HEREN, SINGEL] = CANALS as [Canal, Canal, Canal, Canal];

const RAADHUIS_I = 50.5; // Raadhuisstraat / Rozengracht (i 49..51)
const HARTEN_I = 41; // Gasthuismolensteeg / Hartenstraat / Reestraat (i 40..41)
const WESTER_I = 60.5; // Westerstraat (i 59..61)
const LEIDSE_J = 45; // Leidsestraat (j 44..46)
const VIJZEL_J = 58; // Vijzelstraat / Rokin (j 56..59)
const NZV_J = 46; // Nieuwezijds Voorburgwal (j 45..47)
const DAMRAK_J = 58.5; // Damrak (j 56..60)
const DAMSTRAAT_I = 46.5; // Damstraat / Oude Hoogstraat (i 45..47)
const OZV_J = 67; // Oudezijds Voorburgwal water (j 66..67)
const OZA_J = 74; // Oudezijds Achterburgwal water (j 73..74)
const BLAUW_I = 37.5; // Blauwbrug / Weesperstraat (i 36..38)

const canalWater = (k: Canal): RiverDef => ({
  name: k.name,
  path: [
    [k.right, k.c],
    [k.s + BEND, k.c],
    [k.s, k.c + BEND],
    [k.s, AMSTEL_J],
  ],
  width: 2,
  quay: 0,
});

/** Quay streets on both banks of a belt canal (1 tile, brick-paved). */
function quays(k: Canal): RoadDef[] {
  const o = 1.5;
  const d = o * Math.SQRT2;
  const sum = k.s + k.c + BEND;
  const end = k.right === IJ_I ? 76 : BROUWERS_I - 2;
  const inner: P[] = [
    [end, k.c + o],
    [sum + d - (k.c + o), k.c + o],
    [k.s + o, sum + d - (k.s + o)],
    [k.s + o, AMSTEL_J - 2],
  ];
  const outer: P[] = [
    [end, k.c - o],
    [sum - d - (k.c - o), k.c - o],
    [k.s - o, sum - d - (k.s - o)],
    [k.s - o, AMSTEL_J - 2],
  ];
  const quay = (path: P[]): RoadDef => ({
    name: k.name,
    path,
    width: 1.5,
    surface: 'cobble',
    cls: 'lane',
    rooftops: false,
    labelPath: [
      [k.s + 8, path[0]![1]],
      [k.s + 22, path[0]![1]],
    ],
  });
  return [quay(inner), quay(outer)];
}

/** Bridges where a street running along j crosses the western reaches. */
const bridgesJ = (names: readonly string[], i: number, width: number, ks: readonly Canal[]) =>
  ks.map((k, n): BridgeDef => ({
    name: names[n] ?? names[0]!,
    path: [
      [i, k.c - 2],
      [i, k.c + 1],
    ],
    width,
  }));

/** Bridges where a street running along i crosses the southern reaches. */
const bridgesI = (names: readonly string[], j: number, width: number, ks: readonly Canal[]) =>
  ks.map((k, n): BridgeDef => ({
    name: names[n] ?? names[0]!,
    path: [
      [k.s - 2, j],
      [k.s + 1, j],
    ],
    width,
  }));

/** Elms and bikes along the quays, houseboats moored on the canals. */
function canalDecor(k: Canal): DecorDef[] {
  const out: DecorDef[] = [];
  const end = k.right === IJ_I ? 74 : BROUWERS_I - 3;
  for (let i = k.s + 6, n = 0; i <= end; i += 3, n++) {
    out.push({ kind: n % 2 ? 'bike' : 'tree.round', at: [i, k.c + 1.5], axis: 'i' });
    out.push({ kind: n % 2 ? 'tree.round' : 'bollard', at: [i + 1, k.c - 1.5], axis: 'i' });
    if (n % 3 === 1) out.push({ kind: 'boat', at: [i, k.c - 0.5] });
  }
  for (let j = k.c + 6, n = 0; j <= AMSTEL_J - 4; j += 3, n++) {
    out.push({ kind: n % 2 ? 'bike' : 'tree.round', at: [k.s + 1.5, j], axis: 'j' });
    out.push({ kind: n % 2 ? 'tree.round' : 'bollard', at: [k.s - 1.5, j + 1], axis: 'j' });
    if (n % 3 === 2) out.push({ kind: 'boat', at: [k.s - 0.5, j] });
  }
  return out;
}

export const amsterdam: Blueprint = {
  city: 'amsterdam',
  name: 'Amsterdam',
  w: 80,
  h: 80,
  seed: 0x616d7374,
  style: {
    roofs: { pitched: 8, flat: 2 },
    storeys: [4, 5],
    residential: 0.78,
    tree: 'tree.round',
    sidewalkProps: [
      { kind: 'bike', p: 0.04 },
      { kind: 'bollard', p: 0.03 },
      { kind: 'bin', p: 0.02 },
      { kind: 'bench', p: 0.008 },
      { kind: 'planter', p: 0.01 },
      { kind: 'kiosk', p: 0.004 },
      { kind: 'busstop', p: 0.01 },
    ],
    plazaProps: [
      { kind: 'bike', p: 0.03 },
      { kind: 'bench', p: 0.015 },
      { kind: 'bin', p: 0.01 },
      { kind: 'bollard', p: 0.01 },
    ],
    laneSurface: 'cobble',
    maxBlock: 10,
  },

  areas: [
    // --- Top layer: squares.
    { ground: 'plaza', shape: rect(42, 54, 60, 61), layer: 'top', name: 'Dam' },
    { ground: 'plaza', shape: rect(55, 53, 62, 53), layer: 'top' },
    { ground: 'plaza', shape: rect(63, 53, 75, 61), layer: 'top', name: 'Stationsplein' },
    { ground: 'plaza', shape: rect(34, 39, 39, 47), layer: 'top', name: 'Spui' },
    { ground: 'plaza', shape: rect(33, 50, 38, 63), layer: 'top', name: 'Muntplein' },
    { ground: 'plaza', shape: rect(0, 41, 8, 49), layer: 'top', name: 'Leidseplein' },
    { ground: 'plaza', shape: rect(52, 18, 53, 20), layer: 'top', name: 'Westermarkt' },
    { ground: 'plaza', shape: rect(30, 70, 41, 75), layer: 'top', name: 'Waterlooplein' },
    { ground: 'plaza', shape: rect(56, 76, 67, 79), layer: 'top', name: 'Nieuwmarkt' },
    // Wertheimpark-style green by the Amstel, Plantage.
    {
      ground: 'grass',
      shape: rect(10, 71, 19, 79),
      name: 'Plantage',
      trees: { kinds: ['tree.round', 'tree.plane'], density: 0.35 },
      layer: 'top',
    },
  ],

  rivers: [
    {
      name: 'IJ',
      path: [
        [IJ_I, -1],
        [IJ_I, 81],
      ],
      width: 3,
      quay: 1,
    },
    ...CANALS.map(canalWater),
    {
      name: 'Brouwersgracht',
      path: [
        [BROUWERS_I, -1],
        [BROUWERS_I, SINGEL.c],
      ],
      width: 2,
      quay: 0,
    },
    {
      name: 'Amstel',
      path: [
        [-1, AMSTEL_J],
        [43, AMSTEL_J],
      ],
      width: 4,
      quay: 0,
    },
    {
      name: 'Oudezijds Voorburgwal',
      path: [
        [42, OZV_J],
        [IJ_I, OZV_J],
      ],
      width: 2,
      quay: 0,
    },
    {
      name: 'Oudezijds Achterburgwal',
      path: [
        [48, OZA_J],
        [IJ_I, OZA_J],
      ],
      width: 2,
      quay: 0,
    },
  ],

  roads: [
    // ── The canal quays.
    ...CANALS.flatMap(quays),
    {
      name: 'Brouwersgracht',
      path: [
        [BROUWERS_I - 2.5, 0],
        [BROUWERS_I - 2.5, SINGEL.c - 1.5],
      ],
      width: 1.5,
      surface: 'cobble',
      cls: 'lane',
    },
    {
      name: 'Brouwersgracht',
      path: [
        [BROUWERS_I + 1.5, 0],
        [BROUWERS_I + 1.5, SINGEL.c - 1.5],
      ],
      width: 1.5,
      surface: 'cobble',
      cls: 'lane',
    },
    // ── Behind the palace.
    {
      name: 'Spuistraat',
      path: [
        [36, 42],
        [77, 42],
      ],
      width: 2,
      rooftops: true,
    },
    {
      name: 'Nieuwezijds Voorburgwal',
      path: [
        [36, NZV_J],
        [77, NZV_J],
      ],
      width: 3,
      trees: 'tree.round',
      rooftops: true,
      labelPath: [
        [52, NZV_J],
        [70, NZV_J],
      ],
    },
    {
      name: 'Paleisstraat',
      path: [
        [45, NZV_J],
        [45, 55],
      ],
      width: 2,
      surface: 'plaza',
      rooftops: true,
    },
    {
      name: 'Raadhuisstraat',
      path: [
        [RAADHUIS_I, NZV_J],
        [RAADHUIS_I, PRINSEN.c + 1],
      ],
      width: 3,
      rooftops: true,
      storeyBonus: 1,
      labelPath: [
        [RAADHUIS_I, KEIZERS.c + 2],
        [RAADHUIS_I, SINGEL.c - 2],
      ],
    },
    {
      name: 'Rozengracht',
      path: [
        [RAADHUIS_I, -1],
        [RAADHUIS_I, PRINSEN.c - 2],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Hartenstraat',
      path: [
        [HARTEN_I, 41],
        [HARTEN_I, PRINSEN.c + 1],
      ],
      width: 2,
      surface: 'plaza',
      cafes: true,
      labelPath: [
        [HARTEN_I, HEREN.c + 1],
        [HARTEN_I, KEIZERS.c - 1],
      ],
    },
    // ── Jordaan, Oud-West.
    {
      name: 'Westerstraat',
      path: [
        [WESTER_I, -1],
        [WESTER_I, PRINSEN.c - 2],
      ],
      width: 3,
      trees: 'tree.round',
    },
    {
      name: 'Elandsgracht',
      path: [
        [30.5, -1],
        [30.5, PRINSEN.c - 2],
      ],
      width: 3,
    },
    {
      name: 'Marnixstraat',
      path: [
        [-1, 1.5],
        [BROUWERS_I + 2, 1.5],
      ],
      width: 3,
    },
    {
      name: 'Overtoom',
      path: [
        [4.5, 3],
        [4.5, 41],
      ],
      width: 3,
      trees: 'tree.round',
    },
    {
      name: 'Haarlemmerstraat',
      path: [
        [73, 3],
        [73, SINGEL.c - 2],
      ],
      width: 2,
      cafes: true,
    },
    // ── South of the Dam: Kalverstraat, Rokin, Leidsestraat, Vijzelstraat.
    {
      name: 'Kalverstraat',
      path: [
        [37, 53],
        [45, 53],
      ],
      width: 2,
      surface: 'plaza',
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Rokin',
      path: [
        [37, VIJZEL_J],
        [44, VIJZEL_J],
      ],
      width: 4,
      trees: null,
      rooftops: true,
    },
    {
      name: 'Leidsestraat',
      path: [
        [-1, LEIDSE_J],
        [36, LEIDSE_J],
      ],
      width: 3,
      cafes: true,
      rooftops: true,
      labelPath: [
        [12, LEIDSE_J],
        [24, LEIDSE_J],
      ],
    },
    {
      name: 'Vijzelstraat',
      path: [
        [-1, VIJZEL_J],
        [33, VIJZEL_J],
      ],
      width: 4,
      rooftops: true,
      labelPath: [
        [12, VIJZEL_J],
        [24, VIJZEL_J],
      ],
    },
    // ── North of the Dam: Nieuwendijk, Damrak.
    {
      name: 'Nieuwendijk',
      path: [
        [55, 52],
        [63, 52],
      ],
      width: 2,
      surface: 'plaza',
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Damrak',
      path: [
        [60, DAMRAK_J],
        [77, DAMRAK_J],
      ],
      width: 5,
      trees: null,
      storeyBonus: 1,
    },
    // ── De Wallen and Centrum-Oost.
    {
      name: 'Damstraat',
      path: [
        [DAMSTRAAT_I, 61],
        [DAMSTRAAT_I, 72],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Oude Hoogstraat',
      path: [
        [DAMSTRAAT_I, 72],
        [DAMSTRAAT_I, 81],
      ],
      width: 3,
    },
    {
      name: 'Oudezijds Voorburgwal',
      path: [
        [43, OZV_J - 2.5],
        [76, OZV_J - 2.5],
      ],
      width: 1.5,
      surface: 'cobble',
      cls: 'lane',
    },
    {
      name: 'Oudezijds Voorburgwal',
      path: [
        [43, OZV_J + 1.5],
        [76, OZV_J + 1.5],
      ],
      width: 1.5,
      surface: 'cobble',
      cls: 'lane',
    },
    {
      name: 'Oudezijds Achterburgwal',
      path: [
        [47, OZA_J - 2.5],
        [76, OZA_J - 2.5],
      ],
      width: 1.5,
      surface: 'cobble',
      cls: 'lane',
    },
    {
      name: 'Oudezijds Achterburgwal',
      path: [
        [47, OZA_J + 1.5],
        [76, OZA_J + 1.5],
      ],
      width: 1.5,
      surface: 'cobble',
      cls: 'lane',
    },
    {
      name: 'Zeedijk',
      path: [
        [70.5, 62],
        [70.5, 79],
      ],
      width: 2,
      surface: 'plaza',
      cafes: true,
    },
    {
      name: 'Amstel',
      path: [
        [-1, AMSTEL_J + 2.5],
        [42, AMSTEL_J + 2.5],
      ],
      width: 1.5,
      surface: 'cobble',
      cls: 'lane',
    },
    {
      name: 'Weesperstraat',
      path: [
        [BLAUW_I, 70],
        [BLAUW_I, 81],
      ],
      width: 3,
      trees: 'tree.round',
    },
    {
      name: 'Jodenbreestraat',
      path: [
        [24, 77],
        [56, 77],
      ],
      width: 2,
    },
    {
      name: 'Plantage Middenlaan',
      path: [
        [21, 69],
        [21, 81],
      ],
      width: 3,
      trees: 'tree.round',
    },
  ],

  bridges: [
    ...bridgesJ(['Raadhuisstraat'], RAADHUIS_I, 3, CANALS),
    ...bridgesJ(['Reestraat', 'Hartenstraat', 'Gasthuismolensteeg'], HARTEN_I, 2, [
      KEIZERS,
      HEREN,
      SINGEL,
    ]),
    ...bridgesJ(['Westerstraat'], WESTER_I, 3, [PRINSEN]),
    ...bridgesJ(['Elandsgracht'], 30.5, 3, [PRINSEN]),
    ...bridgesI(['Leidsestraat'], LEIDSE_J, 3, CANALS),
    ...bridgesI(['Vijzelstraat'], VIJZEL_J, 4, CANALS),
    {
      name: 'Marnixstraat',
      path: [
        [BROUWERS_I - 2, 1.5],
        [BROUWERS_I + 1, 1.5],
      ],
      width: 3,
    },
    {
      name: 'Haarlemmerstraat',
      path: [
        [73, SINGEL.c - 2],
        [73, SINGEL.c + 1],
      ],
      width: 2,
    },
    {
      name: 'Blauwbrug',
      path: [
        [BLAUW_I, 63],
        [BLAUW_I, 70],
      ],
      width: 3,
    },
    {
      name: 'Magere Brug',
      path: [
        [21, 63],
        [21, 70],
      ],
      width: 2,
    },
    {
      name: 'Damstraat',
      path: [
        [DAMSTRAAT_I, OZV_J - 2],
        [DAMSTRAAT_I, OZV_J + 1],
      ],
      width: 3,
    },
    {
      name: 'Oude Hoogstraat',
      path: [
        [DAMSTRAAT_I, OZA_J - 2],
        [DAMSTRAAT_I, OZA_J + 1],
      ],
      width: 3,
    },
    {
      name: 'Zeedijk',
      path: [
        [70.5, OZV_J - 2],
        [70.5, OZV_J + 1],
      ],
      width: 2,
    },
    {
      name: 'Zeedijk',
      path: [
        [70.5, OZA_J - 2],
        [70.5, OZA_J + 1],
      ],
      width: 2,
    },
  ],

  landmarks: [
    { id: 'nationalMonument', i: 50, j: 58 },
    { id: 'nieuweKerk', i: 55, j: 48 },
    { id: 'centraalStation', i: 63, j: 49 },
    { id: 'westerkerk', i: 54, j: 18 },
  ],

  capitol: { i: 46, j: 48, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Beurs van Berlage', i: 60, j: 62, w: 6, d: 2, storeys: 4, roof: 'pitched' },
    { name: 'Munttoren', i: 36, j: 48, w: 2, d: 2, storeys: 5, roof: 'pitched' },
    { name: 'Magna Plaza', i: 55, j: 43, w: 6, d: 2, storeys: 5, roof: 'pitched', rooftop: true },
    { name: 'Oude Kerk', i: 58, j: 69, w: 5, d: 2, storeys: 5, roof: 'pitched' },
    { name: 'De Waag', i: 60, j: 77, w: 3, d: 2, storeys: 3, roof: 'pitched' },
    { name: 'Stopera', i: 26, j: 71, w: 4, d: 4, storeys: 4, roof: 'flat', rooftop: true },
  ],

  zones: [
    // The canal belt: narrow, tall gabled canal houses.
    {
      shape: rect(9, 13, 77, 41),
      storeys: [4, 5],
      residential: 0.82,
      maxLen: 3,
      maxDepth: 3,
      roofs: { pitched: 9, flat: 1 },
    },
    { shape: rect(9, 41, 32, 64), storeys: [4, 5], residential: 0.8, maxLen: 3, maxDepth: 3 },
    // Jordaan: lower workers' houses.
    { shape: rect(0, 0, 66, 13), storeys: [3, 4], residential: 0.95, maxLen: 3 },
    // Around the Dam: department stores and hotels.
    {
      shape: rect(33, 42, 62, 63),
      storeys: [4, 6],
      residential: 0.2,
      kind: 'commercial',
      roofs: { pitched: 4, flat: 3 },
    },
    // De Wallen: narrow old houses, a few warehouses.
    { shape: rect(42, 62, 77, 79), storeys: [3, 5], residential: 0.85, maxLen: 3, maxDepth: 3 },
    // Centrum-Oost and De Pijp: 19th-century blocks.
    {
      shape: rect(0, 69, 41, 79),
      storeys: [4, 5],
      residential: 0.9,
      roofs: { flat: 3, pitched: 4 },
    },
  ],

  districts: [
    {
      id: 'jordaan',
      name: 'Jordaan',
      unlockWave: 1,
      area: [14, 0, 66, 12],
      rally: [RAADHUIS_I, 6],
    },
    { id: 'depijp', name: 'De Pijp', unlockWave: 1, area: [0, 50, 8, 64], rally: [4, VIJZEL_J] },
    { id: 'dewallen', name: 'De Wallen', unlockWave: 2, area: [48, 63, 77, 79], rally: [70.5, 76] },
    {
      id: 'centrumoost',
      name: 'Centrum-Oost',
      unlockWave: 3,
      area: [0, 70, 41, 79],
      rally: [BLAUW_I, 77],
    },
    { id: 'oudwest', name: 'Oud-West', unlockWave: 5, area: [0, 0, 9, 38], rally: [4.5, 20] },
  ],

  chokepoints: [
    { name: 'Raadhuisstraat (Singel)', at: [RAADHUIS_I, SINGEL.c], radius: 2 },
    { name: 'Muntplein', at: [SINGEL.s, VIJZEL_J], radius: 2 },
    { name: 'Damstraat (Oudezijds Voorburgwal)', at: [DAMSTRAAT_I, OZV_J], radius: 2 },
  ],

  approaches: [
    {
      name: 'Damrak',
      path: [
        [68, DAMRAK_J],
        [54, 57],
      ],
      final: true,
    },
    {
      name: 'Rokin',
      path: [
        [37, VIJZEL_J],
        [46, 57],
      ],
      final: true,
    },
    {
      name: 'Damstraat',
      path: [
        [DAMSTRAAT_I, 66],
        [DAMSTRAAT_I, 61],
        [48, 58],
      ],
      final: true,
    },
    {
      name: 'Raadhuisstraat → Paleisstraat',
      path: [
        [RAADHUIS_I, 4],
        [RAADHUIS_I, NZV_J],
        [45, NZV_J],
        [45, 54],
      ],
    },
    {
      name: 'Vijzelstraat → Muntplein',
      path: [
        [2, VIJZEL_J],
        [37, VIJZEL_J],
      ],
    },
    {
      name: 'Leidsestraat → Spui',
      path: [
        [4, LEIDSE_J],
        [36, LEIDSE_J],
      ],
    },
    {
      name: 'Blauwbrug → Muntplein',
      path: [
        [BLAUW_I, 77],
        [BLAUW_I, 62],
      ],
    },
  ],

  decor: [
    // The Dam: flags at the palace, pigeons' favourite lamp posts, bikes everywhere.
    { kind: 'flag', at: [47, 56] },
    { kind: 'flag', at: [53, 56] },
    { kind: 'statue', at: [37, 50] },
    { kind: 'kiosk', at: [58, 57] },
    { kind: 'kiosk', at: [43, 60] },
    { kind: 'metro', at: [60, 61] },
    { kind: 'metro', at: [36, 61] },
    { kind: 'metro', at: [64, 61] },
    { kind: 'metro', at: [64, 77] },
    { kind: 'statue', at: [35, 43] },
    { kind: 'statue', at: [56, 19] },
    { kind: 'kiosk', at: [4, 43] },
    { kind: 'kiosk', at: [32, 72] },
    { kind: 'bike', at: [66, 54] },
    { kind: 'bike', at: [68, 54] },
    { kind: 'bike', at: [70, 54] },
    { kind: 'bike', at: [72, 54] },
    // Boats on the IJ and the Amstel.
    { kind: 'boat', at: [78, 20] },
    { kind: 'boat', at: [78, 56] },
    { kind: 'boat', at: [10, 66] },
    { kind: 'boat', at: [28, 67] },
    { kind: 'boat', at: [60, 66] },
    ...CANALS.flatMap(canalDecor),
  ],

  noLanes: [rect(42, 47, 62, 62)],

  labels: [
    { text: 'Jordaan', at: [22, 6] },
    { text: 'De Wallen', at: [62, 72] },
  ],
};
