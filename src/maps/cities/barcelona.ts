/**
 * BARCELONA — the Parlament de Catalunya in the Parc de la Ciutadella and the ~3 km around it,
 * condensed.
 *
 * Orientation (viewer: i → right, j → down): the map is aligned with the Eixample grid, the way
 * barcelonins give directions. "Mar" (the sea, real SE) is −j (top), "muntanya" (real NW) is +j
 * (bottom), "Besòs" (real NE) is −i (left) and "Llobregat" (real SW) is +i (right): a pure
 * rotation, so the topology is preserved. The Parlament (the old arsenal) faces +j across the
 * park toward the Pujades gate, Passeig de Lluís Companys and the Arc de Triomf; the Cascada and
 * the park lake lie in front of it to the left.
 *
 * Barriers: the sea and Port Vell along the top and the fenced park itself, entered by three
 * gates — Pujades (from Lluís Companys), Picasso (from El Born via Carrer de la Princesa) and
 * Wellington (from the Vila Olímpica). Right of the park: El Born, Via Laietana, the Barri Gòtic
 * (Plaça de Sant Jaume, the Cathedral), La Rambla from the Columbus monument up to Plaça de
 * Catalunya, and El Raval beyond. Below: the Eixample grid with its chamfered corners (xamfrans)
 * down to the Sagrada Família on Carrer de Mallorca.
 */
import type { AreaDef, Blueprint } from '../blueprint';
import { poly, rect } from '../blueprint';

// Eixample streets: centre line and half-width (tiles).
const MARINA_I = 4; // Carrer de la Marina (w4: i 2..5)
const SARDENYA_I = 17.5; // Carrer de Sardenya (w3: i 16..18)
const SANT_JOAN_I = 32.5; // Lluís Companys / Passeig de Sant Joan (w7: i 29..35)
const GIRONA_I = 44.5; // Carrer de Girona (w3: i 43..45)
const LAIETANA_I = 54; // Via Laietana / Carrer de Pau Claris (w4: i 52..55)
const GRACIA_I = 64; // Passeig de Gràcia (w6: i 61..66)
const RAMBLA_CAT_I = 74; // Rambla de Catalunya (w4: i 72..75)
const ALI_BEI_J = 38; // Carrer d'Ali Bei / Ronda de Sant Pere (w4: j 36..39)
const GRAN_VIA_J = 48; // Gran Via de les Corts Catalanes (w6: j 45..50)
const ARAGO_J = 58.5; // Carrer d'Aragó (w3: j 57..59)
const MALLORCA_J = 68.5; // Carrer de Mallorca (w3: j 67..69)
const PROVENCA_J = 78.5; // Carrer de Provença (w3: j 77..79)
const WELLINGTON_I = 14.5; // Carrer de Wellington (w3: i 13..15)
const PICASSO_I = 43.5; // Passeig de Picasso (w3: i 42..44)
const PUJADES_J = 30.5; // Passeig de Pujades (w3: j 29..31)
const PRINCESA_J = 24; // Carrer de la Princesa / de Jaume I (w2: j 23..24)
const COLOM_J = 14; // Passeig de Colom / Av. del Marquès de l'Argentera (w4: j 12..15)

const COLS: readonly (readonly [number, number])[] = [
  [MARINA_I, 2],
  [SARDENYA_I, 1.5],
  [SANT_JOAN_I, 3.5],
  [GIRONA_I, 1.5],
  [LAIETANA_I, 2],
  [GRACIA_I, 3],
  [RAMBLA_CAT_I, 2],
];
const ROWS: readonly (readonly [number, number])[] = [
  [GRAN_VIA_J, 3],
  [ARAGO_J, 1.5],
  [MALLORCA_J, 1.5],
  [PROVENCA_J, 1.5],
];

/**
 * The xamfrans: every Eixample block has its four corners cut at 45°, so each crossing opens
 * into a small octagonal plaza. At tile scale: a 3-tile staircase triangle of paving in each
 * block corner (tile centres strictly inside the triangle — see `inShape`).
 */
function chamfers(): AreaDef[] {
  const k = 2.5;
  const out: AreaDef[] = [];
  const corner = (x: number, y: number, sx: number, sy: number): void => {
    out.push({
      ground: 'plaza',
      layer: 'top',
      shape: poly([x, y], [x + sx * k, y], [x, y + sy * k]),
    });
  };
  const cross = (c: number, hc: number, r: number, hr: number, upper: boolean): void => {
    if (upper) {
      corner(c - hc, r - hr, -1, -1);
      corner(c + hc, r - hr, 1, -1);
    }
    corner(c - hc, r + hr, -1, 1);
    corner(c + hc, r + hr, 1, 1);
  };
  for (const [r, hr] of ROWS) for (const [c, hc] of COLS) cross(c, hc, r, hr, true);
  // Ali Bei / Ronda de Sant Pere is the old-town edge: only its Eixample (+j) side is chamfered.
  for (const [c, hc] of COLS.slice(0, 4)) cross(c, hc, ALI_BEI_J, 2, false);
  return out;
}

export const barcelona: Blueprint = {
  city: 'barcelona',
  name: 'Barcelona',
  w: 80,
  h: 80,
  seed: 0x62636e61,
  style: {
    roofs: { terrace: 6, flat: 3, pitched: 1 },
    storeys: [4, 6],
    residential: 0.74,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.03 },
      { kind: 'bench', p: 0.016 },
      { kind: 'bike', p: 0.014 },
      { kind: 'busstop', p: 0.012 },
      { kind: 'kiosk', p: 0.006 },
      { kind: 'planter', p: 0.01 },
      { kind: 'bollard', p: 0.012 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.025 },
      { kind: 'bin', p: 0.012 },
      { kind: 'planter', p: 0.012 },
    ],
    laneSurface: 'cobble',
    maxBlock: 11,
  },

  areas: [
    // --- Parc de la Ciutadella (base layer): lawns, the lake, inner promenades.
    {
      ground: 'grass',
      shape: rect(16, 7, 41, 28),
      name: 'Parc de la Ciutadella',
      trees: { kinds: ['tree.plane', 'tree.round', 'tree.round'], density: 0.34 },
    },
    { ground: 'parkPath', shape: rect(18, 26, 39, 26) },
    { ground: 'parkPath', shape: rect(18, 9, 18, 26) },
    { ground: 'parkPath', shape: rect(18, 9, 24, 9) },
    { ground: 'water', shape: rect(23, 21, 28, 24), name: 'Estany del Parc' },
    // Plaça de la Sagrada Família (Gaudí's pond side is off-map left of Marina).
    {
      ground: 'grass',
      shape: rect(20, 70, 28, 75),
      name: 'Plaça de la Sagrada Família',
      trees: { kinds: ['tree.round', 'tree.plane'], density: 0.35 },
    },
    { ground: 'water', shape: rect(22, 72, 25, 73) },
    // --- Top layer.
    // The park railings (blocked) …
    { ground: 'lot', shape: rect(16, 7, 41, 7), layer: 'top', reserve: true },
    { ground: 'lot', shape: rect(16, 28, 41, 28), layer: 'top', reserve: true },
    { ground: 'lot', shape: rect(16, 7, 16, 28), layer: 'top', reserve: true },
    { ground: 'lot', shape: rect(41, 7, 41, 28), layer: 'top', reserve: true },
    // … and the three gates with their paved avenues into the Parlament's forecourt.
    { ground: 'plaza', shape: rect(21, 16, 37, 19), layer: 'top', name: 'Plaça del Parlament' },
    { ground: 'plaza', shape: rect(30, 20, 34, 28), layer: 'top', name: 'Portal de Pujades' },
    { ground: 'plaza', shape: rect(36, 20, 37, 24), layer: 'top' },
    { ground: 'plaza', shape: rect(38, 23, 41, 24), layer: 'top', name: 'Portal de Picasso' },
    { ground: 'plaza', shape: rect(16, 17, 20, 18), layer: 'top', name: 'Portal de Wellington' },
    // La Rambla's central promenade (plane trees, kiosks, flower stalls).
    {
      ground: 'plaza',
      shape: poly([67, 20], [70, 20], [66.5, 34], [63.5, 34]),
      layer: 'top',
      trees: { kinds: ['tree.plane'], density: 0.3 },
    },
    // Plaça del Portal de la Pau: the Columbus roundabout.
    {
      ground: 'asphalt',
      shape: poly([64, 12], [73, 12], [73, 21], [64, 21]),
      layer: 'top',
      name: 'Plaça del Portal de la Pau',
    },
    { ground: 'plaza', shape: rect(66, 14, 70, 18), layer: 'top' },
    // Plaça de Catalunya.
    { ground: 'plaza', shape: rect(57, 34, 69, 42), layer: 'top', name: 'Plaça de Catalunya' },
    { ground: 'grass', shape: rect(60, 37, 66, 39), layer: 'top' },
    // Plaça d'Urquinaona.
    { ground: 'plaza', shape: rect(51, 35, 56, 40), layer: 'top', name: "Plaça d'Urquinaona" },
    // Passeig de Lluís Companys: the brick-paved promenade up to the Arc de Triomf.
    {
      ground: 'plaza',
      shape: rect(29, 32, 35, 39),
      layer: 'top',
      name: 'Passeig de Lluís Companys',
      trees: { kinds: ['tree.plane'], density: 0.2 },
    },
    // Gòtic & Born squares.
    { ground: 'plaza', shape: rect(56, 22, 60, 26), layer: 'top', name: 'Plaça de Sant Jaume' },
    { ground: 'plaza', shape: rect(55, 33, 62, 33), layer: 'top', name: 'Pla de la Seu' },
    { ground: 'plaza', shape: rect(64, 28, 66, 31), layer: 'top', name: 'Plaça Reial' },
    { ground: 'plaza', shape: rect(46, 31, 50, 33), layer: 'top', name: 'Passeig del Born' },
    // The Eixample xamfrans.
    ...chamfers(),
  ],

  rivers: [
    {
      name: 'Mar Mediterrani',
      path: [
        [-1, 1],
        [81, 1],
      ],
      width: 2,
      quay: 1,
    },
    {
      name: 'Port Vell',
      path: [
        [63, 5],
        [82, 5],
      ],
      width: 10,
      quay: 1,
    },
  ],

  roads: [
    // ── Seafront.
    {
      name: 'Passeig Marítim',
      path: [
        [-1, 4.5],
        [57, 4.5],
      ],
      width: 3,
      trees: null,
      cafes: true,
    },
    {
      name: 'Passeig de Joan de Borbó',
      path: [
        [55.5, 3],
        [55.5, 13],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Avinguda del Marquès de l’Argentera',
      path: [
        [PICASSO_I - 1.5, COLOM_J],
        [LAIETANA_I, COLOM_J],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    {
      name: 'Passeig de Colom',
      path: [
        [LAIETANA_I, COLOM_J],
        [81, COLOM_J],
      ],
      width: 4,
      trees: 'tree.plane',
      labelPath: [
        [56, COLOM_J],
        [63, COLOM_J],
      ],
    },
    // ── Around the park.
    {
      name: 'Carrer de Wellington',
      path: [
        [WELLINGTON_I, 3],
        [WELLINGTON_I, ALI_BEI_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Passeig de Picasso',
      path: [
        [PICASSO_I, COLOM_J],
        [PICASSO_I, PUJADES_J + 1.5],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: true,
    },
    {
      name: 'Passeig de Pujades',
      path: [
        [WELLINGTON_I, PUJADES_J],
        [PICASSO_I, PUJADES_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Passeig de Lluís Companys',
      path: [
        [SANT_JOAN_I, 29],
        [SANT_JOAN_I, ALI_BEI_J],
      ],
      width: 7,
      surface: 'plaza',
      trees: null,
      rooftops: true,
    },
    // ── El Born & the Barri Gòtic.
    {
      name: 'Carrer de la Princesa',
      path: [
        [PICASSO_I, PRINCESA_J],
        [LAIETANA_I, PRINCESA_J],
      ],
      width: 2,
      surface: 'plaza',
      rooftops: true,
      cafes: true,
    },
    {
      name: 'Carrer de Jaume I',
      path: [
        [LAIETANA_I, PRINCESA_J],
        [57, PRINCESA_J],
      ],
      width: 2,
      surface: 'plaza',
      rooftops: true,
    },
    {
      name: 'Via Laietana',
      path: [
        [LAIETANA_I, COLOM_J],
        [LAIETANA_I, ALI_BEI_J],
      ],
      width: 4,
      trees: null,
      storeyBonus: 1,
    },
    {
      name: 'Carrer de Montcada',
      path: [
        [47, PRINCESA_J],
        [47, 31],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Carrer de l’Argenteria',
      path: [
        [50, 33],
        [50, 28],
        [52, 28],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Carrer de Ferran',
      path: [
        [60, 26],
        [66, 26],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Carrer del Bisbe',
      path: [
        [58, 26],
        [58, 29],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Portal de l’Àngel',
      path: [
        [59.5, 33],
        [59.5, 35],
      ],
      width: 3,
      surface: 'plaza',
      cafes: true,
    },
    {
      name: 'Carrer de la Mercè',
      path: [
        [56, 17],
        [65, 17],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    // ── La Rambla: Columbus up to Plaça de Catalunya.
    {
      name: 'La Rambla',
      path: [
        [68.5, 20],
        [65, 34],
      ],
      width: 7,
      trees: null,
      rooftops: true,
      cafes: true,
      labelPath: [
        [70.5, 22],
        [67.5, 33],
      ],
    },
    // ── El Raval.
    {
      name: 'Carrer de l’Hospital',
      path: [
        [68, 28.5],
        [81, 28.5],
      ],
      width: 3,
    },
    {
      name: 'Carrer Nou de la Rambla',
      path: [
        [70, 22],
        [81, 22],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Rambla del Raval',
      path: [
        [76.5, 22],
        [76.5, 36],
      ],
      width: 3,
      surface: 'plaza',
      cafes: true,
      trees: 'tree.plane',
    },
    {
      name: 'Ronda de la Universitat',
      path: [
        [69, 39],
        [81, 39],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    // ── Barceloneta.
    {
      name: 'Carrer de l’Almirall Aixada',
      path: [
        [47, 6],
        [47, 12],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Carrer de Sant Carles',
      path: [
        [51, 6],
        [51, 12],
      ],
      width: 2,
      surface: 'cobble',
    },
    // ── The Eixample grid. Rows (Besòs → Llobregat).
    {
      name: 'Carrer d’Ali Bei',
      path: [
        [-1, ALI_BEI_J],
        [SANT_JOAN_I, ALI_BEI_J],
      ],
      width: 4,
    },
    {
      name: 'Ronda de Sant Pere',
      path: [
        [SANT_JOAN_I, ALI_BEI_J],
        [57, ALI_BEI_J],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    {
      name: 'Gran Via de les Corts Catalanes',
      path: [
        [-1, GRAN_VIA_J],
        [81, GRAN_VIA_J],
      ],
      width: 6,
      trees: 'tree.plane',
      storeyBonus: 1,
      labelPath: [
        [36, GRAN_VIA_J],
        [60, GRAN_VIA_J],
      ],
    },
    {
      name: 'Carrer d’Aragó',
      path: [
        [-1, ARAGO_J],
        [81, ARAGO_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Carrer de Mallorca',
      path: [
        [-1, MALLORCA_J],
        [81, MALLORCA_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Carrer de Provença',
      path: [
        [-1, PROVENCA_J],
        [81, PROVENCA_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    // Columns (mar → muntanya).
    {
      name: 'Carrer de la Marina',
      path: [
        [MARINA_I, 3],
        [MARINA_I, 81],
      ],
      width: 4,
      trees: 'tree.plane',
      labelPath: [
        [MARINA_I, 14],
        [MARINA_I, 30],
      ],
    },
    {
      name: 'Carrer de Sardenya',
      path: [
        [SARDENYA_I, ALI_BEI_J],
        [SARDENYA_I, 81],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Passeig de Sant Joan',
      path: [
        [SANT_JOAN_I, ALI_BEI_J],
        [SANT_JOAN_I, 81],
      ],
      width: 7,
      trees: 'tree.plane',
      cafes: true,
    },
    {
      name: 'Carrer de Girona',
      path: [
        [GIRONA_I, ALI_BEI_J],
        [GIRONA_I, 81],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Carrer de Pau Claris',
      path: [
        [LAIETANA_I, ALI_BEI_J],
        [LAIETANA_I, 81],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    {
      name: 'Passeig de Gràcia',
      path: [
        [GRACIA_I, 42],
        [GRACIA_I, 81],
      ],
      width: 6,
      trees: 'tree.plane',
      cafes: true,
      storeyBonus: 1,
    },
    {
      name: 'Rambla de Catalunya',
      path: [
        [RAMBLA_CAT_I, 39],
        [RAMBLA_CAT_I, 81],
      ],
      width: 4,
      trees: 'tree.plane',
      cafes: true,
    },
  ],

  bridges: [],

  landmarks: [
    { id: 'cascada', i: 17, j: 21 },
    { id: 'arcTriomf', i: 31, j: 34 },
    { id: 'columbus', i: 67, j: 15 },
    { id: 'sagradaFamilia', i: 7, j: 71 },
  ],

  capitol: { i: 25, j: 10, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Hivernacle', i: 36, j: 9, w: 4, d: 3, storeys: 2, roof: 'flat' },
    { name: 'Umbracle', i: 36, j: 13, w: 4, d: 3, storeys: 2, roof: 'flat' },
    {
      name: 'Castell dels Tres Dragons',
      i: 36,
      j: 25,
      w: 4,
      d: 2,
      storeys: 3,
      roof: 'flat',
      rooftop: true,
    },
    {
      name: 'Palau de Justícia',
      i: 36,
      j: 32,
      w: 6,
      d: 3,
      storeys: 4,
      roof: 'pitched',
      rooftop: true,
    },
    { name: 'Santa Maria del Mar', i: 44, j: 26, w: 5, d: 4, storeys: 4, roof: 'pitched' },
    { name: 'Palau de la Generalitat', i: 61, j: 21, w: 3, d: 4, storeys: 3, roof: 'terrace' },
    { name: 'Ajuntament', i: 56, j: 19, w: 5, d: 3, storeys: 3, roof: 'terrace', rooftop: true },
    { name: 'Catedral', i: 56, j: 29, w: 6, d: 4, storeys: 4, roof: 'pitched' },
    { name: 'Casa Batlló', i: 67, j: 51, w: 3, d: 3, storeys: 5, roof: 'pitched' },
    {
      name: 'Casa Milà',
      i: 67,
      j: 70,
      w: 4,
      d: 4,
      storeys: 5,
      roof: 'terrace',
      rooftop: true,
    },
  ],

  zones: [
    // Eixample: six-storey blocks round inner courtyards, flat roof terraces (terrats).
    {
      shape: rect(0, 40, 79, 79),
      storeys: [5, 6],
      residential: 0.82,
      roofs: { terrace: 6, flat: 3 },
      maxLen: 5,
    },
    // Ciutat Vella: narrow, tall-ish old-town houses.
    {
      shape: rect(42, 15, 79, 35),
      storeys: [4, 5],
      residential: 0.7,
      roofs: { terrace: 5, pitched: 2, flat: 1 },
      maxLen: 4,
    },
    // Barceloneta: low fishermen's quarter.
    {
      shape: rect(42, 5, 56, 11),
      storeys: [3, 4],
      residential: 0.95,
      roofs: { terrace: 4, flat: 2 },
      maxLen: 3,
    },
    // Vila Olímpica: modern slab blocks.
    {
      shape: rect(0, 3, 15, 35),
      storeys: [5, 6],
      residential: 0.8,
      roofs: { flat: 5, terrace: 1 },
    },
    // Lluís Companys: courts and offices, never spawn buildings.
    { shape: rect(28, 29, 42, 35), storeys: [4, 5], residential: 0, kind: 'commercial' },
  ],

  districts: [
    { id: 'raval', name: 'El Raval', unlockWave: 1, area: [70, 16, 79, 35], rally: [77, 28] },
    { id: 'poblenou', name: 'Poblenou', unlockWave: 1, area: [0, 3, 12, 37], rally: [4, 20] },
    {
      id: 'barceloneta',
      name: 'La Barceloneta',
      unlockWave: 2,
      area: [42, 5, 57, 12],
      rally: [50, 4],
    },
    { id: 'eixample', name: "L'Eixample", unlockWave: 3, area: [35, 40, 60, 66], rally: [44, 53] },
    { id: 'gracia', name: 'Gràcia', unlockWave: 4, area: [61, 60, 79, 79], rally: [64, 74] },
    { id: 'santmarti', name: 'Sant Martí', unlockWave: 6, area: [0, 40, 14, 66], rally: [4, 53] },
  ],

  chokepoints: [
    { name: 'Passeig de Lluís Companys', at: [SANT_JOAN_I, 32], radius: 2 },
    { name: 'Portal de Picasso (Carrer de la Princesa)', at: [PICASSO_I, PRINCESA_J], radius: 2 },
    { name: 'Carrer de Wellington', at: [WELLINGTON_I, 18], radius: 2 },
  ],

  approaches: [
    {
      name: 'Portal de Pujades (from Lluís Companys)',
      path: [
        [SANT_JOAN_I, 37],
        [32, 20],
      ],
      final: true,
    },
    {
      name: 'Portal de Picasso (from Carrer de la Princesa)',
      path: [
        [56, PRINCESA_J],
        [37, PRINCESA_J],
        [37, 20],
      ],
      final: true,
    },
    {
      name: 'Portal de Wellington',
      path: [
        [12, 17.5],
        [21, 17.5],
      ],
      final: true,
    },
    {
      name: 'Passeig de Sant Joan',
      path: [
        [SANT_JOAN_I, 79],
        [SANT_JOAN_I, 38],
      ],
    },
    {
      name: 'Via Laietana',
      path: [
        [LAIETANA_I, 13],
        [LAIETANA_I, PRINCESA_J],
      ],
    },
    {
      name: 'La Rambla',
      path: [
        [68.5, 20],
        [65, 34],
        [57, 38],
      ],
    },
    {
      name: 'Carrer de la Marina',
      path: [
        [MARINA_I, 79],
        [MARINA_I, 18],
        [14, 18],
      ],
    },
  ],

  decor: [
    // Forecourt flags; General Prim on horseback in the park.
    { kind: 'flag', at: [23, 18] },
    { kind: 'flag', at: [35, 18] },
    { kind: 'statue.equestrian', at: [20, 12] },
    // Plaça de Catalunya: fountains and statues.
    { kind: 'fountain', at: [59, 36] },
    { kind: 'fountain', at: [67, 36] },
    { kind: 'statue', at: [58, 41] },
    { kind: 'statue', at: [68, 41] },
    // La Rambla: kiosks and flower stalls, Canaletes fountain, the Liceu metro.
    { kind: 'kiosk', at: [68, 23] },
    { kind: 'kiosk', at: [67, 27] },
    { kind: 'kiosk', at: [66, 31] },
    { kind: 'wallace', at: [65, 33] },
    { kind: 'metro', at: [64, 29] },
    // Plaça Reial: Gaudí's lamps and the Three Graces fountain.
    { kind: 'lamp', at: [64, 28] },
    { kind: 'lamp', at: [66, 31] },
    { kind: 'fountain', at: [65, 29] },
    // Plaça de Sant Jaume, Pla de la Seu.
    { kind: 'lamp', at: [58, 24] },
    { kind: 'statue', at: [57, 33] },
    // Rambla del Raval: Botero's cat.
    { kind: 'statue', at: [76, 32] },
    // Metro entrances (the red rhombus): Jaume I, Urquinaona, Arc de Triomf, Barceloneta,
    // Sagrada Família, Passeig de Gràcia, Drassanes.
    { kind: 'metro', at: [52, 25] },
    { kind: 'metro', at: [51, 40] },
    { kind: 'metro', at: [36, 40] },
    { kind: 'metro', at: [53, 11] },
    { kind: 'metro', at: [15, 70] },
    { kind: 'metro', at: [60, 51] },
    { kind: 'metro', at: [64, 22] },
    // Port Vell and the park lake.
    { kind: 'boat', at: [70, 4] },
    { kind: 'boat', at: [62, 7] },
    { kind: 'boat', at: [76, 8] },
    { kind: 'boat', at: [25, 22] },
  ],

  noLanes: [rect(15, 6, 42, 29)],

  labels: [
    { text: 'Zoo', at: [20, 13] },
    { text: 'El Born', at: [45, 20] },
    { text: 'Barri Gòtic', at: [58, 16] },
    { text: 'Vila Olímpica', at: [7, 10] },
  ],
};
