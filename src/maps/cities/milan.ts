/**
 * MILAN — Palazzo Marino (the city council, standing in for the Capitol) on Piazza della Scala,
 * and the centro inside the Cerchia dei Navigli, condensed.
 *
 * Orientation (viewer: i → right, j → down): rotated 180° — NORTH is +j (down), EAST is −i
 * (left), so the Duomo's west façade faces +i (the camera) across Piazza del Duomo, and Palazzo
 * Marino's real front on Piazza della Scala faces +j. Top to bottom: the Navigli (Darsena,
 * Naviglio Grande) along the top edge, Via Torino down to Piazza del Duomo, the Galleria
 * Vittorio Emanuele II linking Piazza del Duomo to Piazza della Scala, Palazzo Marino beside it
 * and the Teatro alla Scala across the piazza, then Brera and Isola at the bottom. Via Dante runs
 * from Cordusio down-right to Largo Cairoli and the Castello Sforzesco, with Parco Sempione
 * behind it in the bottom-right corner. Corso Vittorio Emanuele II (pedestrian) runs left to San
 * Babila and Corso Venezia; Via Manzoni and Via Montenapoleone lead down-left to Porta Venezia.
 *
 * The Galleria is a blocking landmark (contract): crowds marching from Piazza del Duomo to the
 * Scala go round it by Via Silvio Pellico (right) or Via Marino (left, between the Galleria and
 * the palazzo). The ring of the Cerchia dei Navigli (Santa Sofia, Francesco Sforza, Senato,
 * Fatebenefratelli, Pontaccio, Carducci, De Amicis) encloses the centro.
 */
import type { Blueprint } from '../blueprint';
import { poly, rect } from '../blueprint';

const MANZONI_I = 24.5; // Via Manzoni (w3: i 23..25) at the piazza
const MARINO_I = 35; // Via Marino (w2: i 34..35), left of the Galleria
const PELLICO_I = 45; // Via Silvio Pellico (w2: i 44..45), right of the Galleria
const MARGHERITA_I = 49.5; // Via Santa Margherita (w3: i 48..50)
const VERDI_I = 38.5; // Via Verdi → Via Brera (w3: i 37..39)
const CVE_J = 29.5; // Corso Vittorio Emanuele II (w3: j 28..30)
const MAGENTA_J = 33.5; // Corso Magenta (w3: j 32..34)
const VENEZIA_I = 7; // Corso Venezia (w4: i 5..8)
const RING_W = 4;

export const milan: Blueprint = {
  city: 'milan',
  name: 'Milano',
  w: 76,
  h: 76,
  seed: 0x6d696c61,
  style: {
    roofs: { pitched: 4, terrace: 3, flat: 3 },
    storeys: [4, 6],
    residential: 0.72,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.03 },
      { kind: 'bike', p: 0.016 },
      { kind: 'bench', p: 0.01 },
      { kind: 'busstop', p: 0.012 },
      { kind: 'kiosk', p: 0.006 },
      { kind: 'bollard', p: 0.018 },
      { kind: 'planter', p: 0.012 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.015 },
      { kind: 'bin', p: 0.012 },
      { kind: 'planter', p: 0.012 },
      { kind: 'pigeon', p: 0.01 },
    ],
    laneSurface: 'cobble',
    maxBlock: 12,
  },

  areas: [
    // --- Base layer: Parco Sempione behind the Castello; the Giardini Pubblici by Porta Venezia.
    {
      ground: 'grass',
      shape: poly([50, 66], [76, 66], [76, 76], [50, 76]),
      name: 'Parco Sempione',
      trees: { kinds: ['tree.plane', 'tree.round', 'tree.chestnut'], density: 0.38 },
    },
    { ground: 'parkPath', shape: rect(50, 70, 75, 70) },
    { ground: 'parkPath', shape: rect(64, 66, 65, 75) },
    { ground: 'water', shape: rect(54, 72, 58, 74), name: 'Laghetto' },
    {
      ground: 'grass',
      shape: rect(0, 60, 4, 75),
      name: 'Giardini Indro Montanelli',
      trees: { kinds: ['tree.round', 'tree.chestnut'], density: 0.45 },
    },
    // --- Top layer: piazzas.
    // Piazza della Scala — the forecourt (Leonardo's monument); steps painted over it.
    { ground: 'plaza', shape: rect(23, 36, 50, 41), layer: 'top', name: 'Piazza della Scala' },
    // Piazza del Duomo.
    { ground: 'plaza', shape: rect(34, 19, 48, 30), layer: 'top', name: 'Piazza del Duomo' },
    // Piazza dei Mercanti, Piazza Cordusio.
    { ground: 'plaza', shape: rect(49, 23, 53, 28), layer: 'top', name: 'Piazza dei Mercanti' },
    { ground: 'plaza', shape: rect(54, 29, 59, 35), layer: 'top', name: 'Piazza Cordusio' },
    // Piazza San Fedele (Manzoni's statue), Piazza San Babila, Piazza Fontana.
    { ground: 'plaza', shape: rect(19, 32, 23, 36), layer: 'top', name: 'Piazza San Fedele' },
    { ground: 'plaza', shape: rect(4, 25, 13, 32), layer: 'top', name: 'Piazza San Babila' },
    { ground: 'plaza', shape: rect(18, 20, 22, 24), layer: 'top', name: 'Piazza Fontana' },
    // Largo Cairoli + Foro Buonaparte forecourt of the Castello.
    { ground: 'plaza', shape: rect(58, 52, 70, 55), layer: 'top', name: 'Largo Cairoli' },
    // Piazza XXV Aprile / Corso Garibaldi end is off-map; Brera: Piazza San Marco.
    { ground: 'plaza', shape: rect(30, 64, 34, 67), layer: 'top', name: 'Piazza San Marco' },
    // Darsena quay (Porta Ticinese).
    { ground: 'plaza', shape: rect(52, 3, 60, 6), layer: 'top', name: 'Piazza XXIV Maggio' },
  ],

  rivers: [
    {
      name: 'Naviglio Grande',
      path: [
        [51, 1],
        [77, 1],
      ],
      width: 2,
      quay: 1,
    },
    {
      name: 'Naviglio Pavese',
      path: [
        [50, -1],
        [50, 2],
      ],
      width: 2,
      quay: 1,
    },
  ],

  roads: [
    // ── The Cerchia dei Navigli (inner ring, the old canal circuit).
    {
      name: 'Via Santa Sofia',
      path: [
        [16, 18],
        [22, 12],
        [54, 12],
      ],
      width: RING_W,
      trees: 'tree.plane',
      labelPath: [
        [24, 12],
        [40, 12],
      ],
    },
    {
      name: 'Via De Amicis',
      path: [
        [54, 12],
        [62, 20],
        [62, 32],
      ],
      width: RING_W,
      trees: 'tree.plane',
    },
    {
      name: 'Via Carducci',
      path: [
        [62, 32],
        [62, 46],
        [56, 52],
        [56, 60],
      ],
      width: RING_W,
      trees: 'tree.plane',
    },
    {
      name: 'Via Pontaccio',
      path: [
        [56, 60],
        [40, 60],
      ],
      width: RING_W,
      trees: 'tree.plane',
    },
    {
      name: 'Via Fatebenefratelli',
      path: [
        [40, 60],
        [22, 60],
        [16, 54],
      ],
      width: RING_W,
      trees: 'tree.plane',
    },
    {
      name: 'Via Senato',
      path: [
        [16, 54],
        [16, 36],
      ],
      width: RING_W,
      trees: 'tree.plane',
    },
    {
      name: 'Via Francesco Sforza',
      path: [
        [16, 36],
        [16, 18],
      ],
      width: RING_W,
      trees: 'tree.plane',
    },
    // ── Corso Vittorio Emanuele II (pedestrian): Piazza del Duomo → San Babila.
    {
      name: 'Corso Vittorio Emanuele II',
      path: [
        [34, CVE_J],
        [12, CVE_J],
      ],
      width: 3,
      surface: 'plaza',
      cafes: true,
      rooftops: true,
      storeyBonus: 1,
    },
    // ── Around the Galleria (the Galleria itself is a blocking landmark).
    {
      name: 'Via Marino',
      path: [
        [MARINO_I, 30],
        [MARINO_I, 36],
      ],
      width: 2,
      surface: 'plaza',
      rooftops: true,
    },
    {
      name: 'Via Silvio Pellico',
      path: [
        [PELLICO_I, 30],
        [PELLICO_I, 36],
      ],
      width: 2,
      surface: 'plaza',
      rooftops: true,
      cafes: true,
    },
    {
      name: 'Via Santa Margherita',
      path: [
        [MARGHERITA_I, 28],
        [MARGHERITA_I, 40],
      ],
      width: 3,
      rooftops: true,
    },
    // ── Via Manzoni (down to Porta Nuova) and Via Montenapoleone (the Quadrilatero).
    {
      name: 'Via Manzoni',
      path: [
        [MANZONI_I, 41],
        [MANZONI_I, 56],
        [20.5, 77],
      ],
      width: 3,
      rooftops: true,
      storeyBonus: 1,
      labelPath: [
        [MANZONI_I, 45],
        [MANZONI_I, 56],
      ],
    },
    {
      name: 'Via Montenapoleone',
      path: [
        [MANZONI_I, 48.5],
        [VENEZIA_I, 48.5],
      ],
      width: 3,
      cafes: true,
      rooftops: true,
      storeyBonus: 1,
    },
    {
      name: 'Via della Spiga',
      path: [
        [17, 54],
        [VENEZIA_I, 54],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Corso Venezia',
      path: [
        [VENEZIA_I, 32],
        [VENEZIA_I, 77],
      ],
      width: 4,
      trees: null,
      storeyBonus: 1,
    },
    {
      name: 'Corso di Porta Vittoria',
      path: [
        [-1, 22],
        [16, 22],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    {
      name: 'Corso di Porta Romana',
      path: [
        [22, 12],
        [22, 0],
        [18, -1],
      ],
      width: 3,
    },
    {
      name: 'Corso Europa',
      path: [
        [VENEZIA_I, 25],
        [VENEZIA_I, -1],
      ],
      width: 4,
      trees: null,
    },
    // ── Via Verdi → Via Brera.
    {
      name: 'Via Verdi',
      path: [
        [VERDI_I, 41],
        [VERDI_I, 60],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Via Brera',
      path: [
        [VERDI_I, 60],
        [VERDI_I, 77],
      ],
      width: 3,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Via Solferino',
      path: [
        [48.5, 60],
        [48.5, 77],
      ],
      width: 3,
    },
    {
      name: 'Via dei Giardini',
      path: [
        [VENEZIA_I, 64.5],
        [21.5, 64.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    // ── West of the Duomo: Mercanti, Cordusio, Via Dante to the Castello, Corso Magenta.
    {
      name: 'Via dei Mercanti',
      path: [
        [48, 25.5],
        [49, 25.5],
      ],
      width: 2,
      surface: 'plaza',
    },
    {
      name: 'Via Dante',
      path: [
        [57.5, 35],
        [57.5, 39],
        [64.5, 52],
      ],
      width: 3,
      surface: 'plaza',
      cafes: true,
      trees: null,
      rooftops: true,
    },
    {
      name: 'Corso Magenta',
      path: [
        [59, MAGENTA_J],
        [77, MAGENTA_J],
      ],
      width: 3,
    },
    {
      name: 'Via Meravigli',
      path: [
        [53, 31.5],
        [MARGHERITA_I, 31.5],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Foro Buonaparte',
      path: [
        [57.5, 56],
        [57.5, 66],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Viale Gadio',
      path: [
        [70.5, 56],
        [70.5, 66],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Via Sant’Agnese',
      path: [
        [62, 24.5],
        [77, 24.5],
      ],
      width: 2,
      surface: 'cobble',
    },
    // ── South: Via Torino and Corso di Porta Ticinese down to the Navigli.
    {
      name: 'Via Torino',
      path: [
        [48, 21],
        [56, 12],
        [56, 7],
      ],
      width: 3,
      rooftops: true,
      storeyBonus: 1,
      labelPath: [
        [49, 20],
        [55, 13],
      ],
    },
    {
      name: 'Corso di Porta Ticinese',
      path: [
        [56, 7],
        [56, 3],
      ],
      width: 3,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Ripa di Porta Ticinese',
      path: [
        [60, 3.5],
        [77, 3.5],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Via Molino delle Armi',
      path: [
        [40.5, 12],
        [40.5, 3],
        [51, 3],
      ],
      width: 3,
    },
    {
      name: 'Via Larga',
      path: [
        [34, 18.5],
        [22, 18.5],
      ],
      width: 3,
    },
    {
      name: 'Via Mazzini',
      path: [
        [41.5, 12],
        [41.5, 19],
      ],
      width: 3,
    },
  ],

  bridges: [],

  landmarks: [
    { id: 'duomo', i: 24, j: 21 },
    { id: 'galleria', i: 36, j: 31 },
    { id: 'laScala', i: 40, j: 42 },
    { id: 'castello', i: 60, j: 57 },
  ],

  capitol: { i: 25, j: 30, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Palazzo Reale', i: 35, j: 14, w: 5, d: 4, storeys: 4, roof: 'pitched' },
    { name: 'Arengario', i: 43, j: 15, w: 4, d: 3, storeys: 4, roof: 'flat', rooftop: true },
    { name: 'Pinacoteca di Brera', i: 40, j: 63, w: 6, d: 4, storeys: 4, roof: 'pitched' },
    { name: "Basilica di Sant'Ambrogio", i: 66, j: 37, w: 5, d: 4, storeys: 3, roof: 'pitched' },
    {
      name: 'Santa Maria delle Grazie',
      i: 71,
      j: 28,
      w: 5,
      d: 4,
      storeys: 3,
      roof: 'pitched',
    },
    {
      name: 'Palazzo della Ragione',
      i: 50,
      j: 23,
      w: 3,
      d: 2,
      storeys: 3,
      roof: 'pitched',
    },
  ],

  zones: [
    // Centro: tall palazzi, shops and offices; never spawn buildings near the Scala.
    {
      shape: rect(17, 13, 61, 59),
      storeys: [5, 6],
      residential: 0.4,
      roofs: { flat: 4, terrace: 3, pitched: 3 },
    },
    { shape: rect(18, 26, 52, 46), storeys: [5, 6], residential: 0, kind: 'commercial' },
    // Brera: lower, older, ochre houses.
    {
      shape: rect(28, 61, 54, 75),
      storeys: [3, 5],
      residential: 0.85,
      roofs: { pitched: 6, terrace: 2 },
    },
    // Navigli: low case di ringhiera.
    {
      shape: rect(40, 0, 75, 9),
      storeys: [3, 4],
      residential: 0.9,
      roofs: { pitched: 5, terrace: 2 },
    },
  ],

  districts: [
    {
      id: 'navigli',
      name: 'Navigli & Porta Ticinese',
      unlockWave: 1,
      area: [42, 0, 75, 9],
      rally: [60, 5],
    },
    {
      id: 'cittastudi',
      name: 'Città Studi',
      unlockWave: 1,
      area: [0, 0, 13, 24],
      rally: [3, 22],
    },
    {
      id: 'portavenezia',
      name: 'Porta Venezia',
      unlockWave: 2,
      area: [0, 34, 13, 75],
      rally: [7, 50],
    },
    { id: 'brera', name: 'Brera', unlockWave: 3, area: [30, 62, 54, 75], rally: [38, 68] },
    {
      id: 'santambrogio',
      name: "Sant'Ambrogio",
      unlockWave: 4,
      area: [64, 8, 75, 50],
      rally: [70, 33],
    },
    { id: 'isola', name: 'Isola', unlockWave: 6, area: [14, 62, 29, 75], rally: [21, 70] },
  ],

  chokepoints: [
    { name: 'Via Silvio Pellico (Galleria)', at: [PELLICO_I, 33], radius: 2 },
    { name: 'Via Manzoni', at: [MANZONI_I, 51], radius: 2 },
    { name: 'Corso Vittorio Emanuele II', at: [20, CVE_J], radius: 2 },
  ],

  approaches: [
    {
      name: 'Via Silvio Pellico (round the Galleria)',
      path: [
        [PELLICO_I, 21],
        [PELLICO_I, 37],
      ],
      final: true,
    },
    {
      name: 'Via Marino (round the Galleria)',
      path: [
        [24, CVE_J],
        [MARINO_I, CVE_J],
        [MARINO_I, 37],
      ],
      final: true,
    },
    {
      name: 'Via Manzoni',
      path: [
        [MANZONI_I, 60],
        [MANZONI_I, 42],
      ],
      final: true,
    },
    {
      name: 'Via Verdi',
      path: [
        [VERDI_I, 60],
        [VERDI_I, 42],
      ],
      final: true,
    },
    {
      name: 'Corso Vittorio Emanuele II',
      path: [
        [12, CVE_J],
        [34, CVE_J],
      ],
    },
    {
      name: 'Via Torino',
      path: [
        [56, 7],
        [56, 12],
        [48, 21],
      ],
    },
    {
      name: 'Via Dante',
      path: [
        [64.5, 52],
        [57.5, 39],
        [57.5, 35],
      ],
    },
  ],

  decor: [
    // Piazza della Scala: Leonardo's monument; Palazzo Marino's flags.
    { kind: 'statue', at: [36, 40] },
    { kind: 'flag', at: [26, 37] },
    { kind: 'flag', at: [33, 37] },
    // Piazza del Duomo: Vittorio Emanuele II on horseback, lamps, pigeons.
    { kind: 'statue.equestrian', at: [41, 24] },
    { kind: 'pigeon', at: [38, 27] },
    { kind: 'pigeon', at: [44, 21] },
    { kind: 'metro', at: [46, 28] },
    { kind: 'metro', at: [35, 20] },
    // Piazza San Fedele (Manzoni), Piazza Fontana, San Babila, Cordusio, Cairoli.
    { kind: 'statue', at: [21, 34] },
    { kind: 'fountain', at: [20, 22] },
    { kind: 'metro', at: [8, 28] },
    { kind: 'metro', at: [56, 31] },
    { kind: 'statue.equestrian', at: [64, 54] },
    { kind: 'fountain', at: [62, 54] },
    // Brera: Garibaldi's statue on the way to the Pinacoteca; Montenapoleone metro.
    { kind: 'statue', at: [32, 65] },
    { kind: 'metro', at: [22, 50] },
    { kind: 'metro', at: [9, 62] },
    // Darsena: boats on the Naviglio.
    { kind: 'boat', at: [58, 0] },
    { kind: 'boat', at: [66, 1] },
    { kind: 'boat', at: [72, 0] },
    { kind: 'boat', at: [56, 73] },
  ],

  noLanes: [rect(18, 26, 52, 46)],

  labels: [
    { text: 'Quadrilatero della Moda', at: [12, 44] },
    { text: 'Arco della Pace', at: [68, 74] },
    { text: 'Darsena', at: [53, 1] },
  ],
};
