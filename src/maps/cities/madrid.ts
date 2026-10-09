/**
 * MADRID — Congreso de los Diputados and the ~3 km around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): real NORTH is −i (left), EAST is −j (up), so the
 * Congreso's portico on Plaza de las Cortes faces west/+j toward Sol, with the Paseo del Prado,
 * the Prado museum and the Retiro "behind" it at the top. A pure 90° rotation of the real map:
 * the topology (Sol → Carrera de San Jerónimo → Cortes → Neptuno → Paseo del Prado; Cibeles at
 * the Alcalá crossing; Gran Vía forking off Alcalá at the Metrópolis) is preserved.
 */
import type { Blueprint } from '../blueprint';
import { circle, poly, rect } from '../blueprint';

const PRADO_J = 19.5; // centre line of Paseo de Recoletos / del Prado (j 15..23)
const ALCALA_I = 16.5; // Calle de Alcalá north–south section (i 14..18)
const CARRERA_I = 31.5; // Carrera de San Jerónimo (i 30..32)

export const madrid: Blueprint = {
  city: 'madrid',
  name: 'Madrid',
  w: 72,
  h: 72,
  seed: 0x6d616472,
  style: {
    roofs: { pitched: 5, terrace: 4, flat: 1 },
    storeys: [3, 5],
    residential: 0.72,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.035 },
      { kind: 'bench', p: 0.02 },
      { kind: 'hydrant', p: 0.012 },
      { kind: 'busstop', p: 0.012 },
      { kind: 'kiosk', p: 0.006 },
      { kind: 'planter', p: 0.012 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.03 },
      { kind: 'bin', p: 0.015 },
      { kind: 'planter', p: 0.012 },
    ],
    laneSurface: 'cobble',
    maxBlock: 13,
  },

  areas: [
    // --- Retiro (base layer): lawns, the Estanque, paths. Fenced by railings (lot ring).
    {
      ground: 'grass',
      shape: rect(19, 0, 56, 7),
      name: 'Parque del Retiro',
      trees: { kinds: ['tree.pine', 'tree.round', 'tree.round'], density: 0.42 },
    },
    { ground: 'water', shape: rect(36, 1, 46, 4), name: 'Estanque del Retiro' },
    { ground: 'parkPath', shape: rect(35, 5, 47, 5) }, // lake promenade
    { ground: 'parkPath', shape: rect(20, 6, 55, 6) }, // Paseo de Coches (inner ring)
    { ground: 'parkPath', shape: rect(27, 0, 27, 6) }, // Paseo de la Argentina
    { ground: 'parkPath', shape: rect(52, 0, 52, 6) },
    // Jardín Botánico (walkable lawn, fenced on the street sides by its own railings below).
    {
      ground: 'grass',
      shape: rect(48, 11, 58, 14),
      name: 'Real Jardín Botánico',
      trees: { kinds: ['tree.round', 'tree.cypress'], density: 0.45 },
    },
    // --- Top layer: plazas, roundabouts, the Prado promenade.
    // Salón del Prado: tree-lined central promenade of the boulevard.
    {
      ground: 'parkPath',
      shape: rect(23, 18, 59, 20),
      layer: 'top',
      trees: { kinds: ['tree.plane'], density: 0.5 },
    },
    {
      ground: 'parkPath',
      shape: rect(0, 18, 10, 20),
      layer: 'top',
      trees: { kinds: ['tree.plane'], density: 0.5 },
    },
    // Cibeles roundabout + island.
    { ground: 'asphalt', shape: circle(17, 20, 5.6), layer: 'top', name: 'Plaza de Cibeles' },
    { ground: 'plaza', shape: circle(17, 20, 2.3), layer: 'top' },
    // Neptuno roundabout + island.
    {
      ground: 'asphalt',
      shape: circle(31.5, 20, 4.6),
      layer: 'top',
      name: 'Plaza de Cánovas del Castillo',
    },
    { ground: 'plaza', shape: circle(31.5, 20, 2.3), layer: 'top' },
    // Plaza de la Independencia (Puerta de Alcalá).
    {
      ground: 'asphalt',
      shape: circle(17, 6, 4.6),
      layer: 'top',
      name: 'Plaza de la Independencia',
    },
    { ground: 'grass', shape: { rect: [14, 5, 19, 7] }, layer: 'top' },
    // Glorieta de Atocha (Emperador Carlos V).
    { ground: 'asphalt', shape: circle(64.5, 20, 4.6), layer: 'top', name: 'Glorieta de Atocha' },
    { ground: 'grass', shape: circle(64.5, 20, 1.9), layer: 'top' },
    // Plaza de las Cortes — the Congreso forecourt (steps are painted on top of it).
    { ground: 'plaza', shape: rect(30, 34, 47, 40), layer: 'top', name: 'Plaza de las Cortes' },
    // Plaza de Canalejas.
    { ground: 'plaza', shape: rect(28, 43, 33, 47), layer: 'top', name: 'Plaza de Canalejas' },
    // Puerta del Sol — the half-moon.
    {
      ground: 'plaza',
      shape: poly([20, 55], [33, 55], [35, 58], [35, 63], [32, 66], [22, 66], [19, 63], [19, 58]),
      layer: 'top',
      name: 'Puerta del Sol',
    },
    // Plaza de Santa Ana.
    { ground: 'plaza', shape: rect(41, 50, 50, 55), layer: 'top', name: 'Plaza de Santa Ana' },
    // Plaza Mayor (enclosed; arches below).
    { ground: 'cobble', shape: rect(36, 64, 43, 69), layer: 'top', name: 'Plaza Mayor' },
    // Callao, Plaza de España, Plaza de Chueca, Plaza de Lavapiés, Plaza del Dos de Mayo.
    { ground: 'plaza', shape: rect(9, 52, 14, 56), layer: 'top', name: 'Plaza del Callao' },
    {
      ground: 'plaza',
      shape: poly([0, 62], [6, 62], [9, 65], [9, 72], [0, 72]),
      layer: 'top',
      name: 'Plaza de España',
    },
    {
      ground: 'grass',
      shape: rect(1, 65, 5, 69),
      layer: 'top',
      trees: { kinds: ['tree.round'], density: 0.5 },
    },
    { ground: 'plaza', shape: rect(5, 30, 9, 33), layer: 'top', name: 'Plaza de Chueca' },
    { ground: 'plaza', shape: rect(57, 47, 61, 51), layer: 'top', name: 'Plaza de Lavapiés' },
    { ground: 'plaza', shape: rect(3, 50, 7, 53), layer: 'top', name: 'Plaza del Dos de Mayo' },
    // Retiro railings: blocked strip along the park's street sides, with gates (parkPath).
    { ground: 'lot', shape: rect(19, 7, 56, 7), layer: 'top', reserve: true },
    { ground: 'lot', shape: rect(19, 0, 19, 7), layer: 'top', reserve: true },
    { ground: 'lot', shape: rect(56, 0, 56, 7), layer: 'top', reserve: true },
    { ground: 'parkPath', shape: rect(40, 7, 41, 7), layer: 'top' }, // Puerta de Felipe IV
    { ground: 'parkPath', shape: rect(53, 7, 54, 7), layer: 'top' }, // Puerta del Ángel Caído
    { ground: 'parkPath', shape: rect(19, 2, 19, 3), layer: 'top' }, // Puerta de la Independencia
  ],

  rivers: [],

  roads: [
    // ── The great north–south axis (left → right): Recoletos · Cibeles · Prado · Atocha.
    {
      name: 'Paseo de Recoletos',
      path: [
        [-1, PRADO_J],
        [17, PRADO_J],
      ],
      width: 9,
      trees: 'tree.plane',
      labelPath: [
        [1, PRADO_J],
        [11, PRADO_J],
      ],
    },
    {
      name: 'Paseo del Prado',
      path: [
        [17, PRADO_J],
        [65, PRADO_J],
      ],
      width: 9,
      trees: 'tree.plane',
      labelPath: [
        [37, PRADO_J],
        [58, PRADO_J],
      ],
    },
    // ── Calle de Alcalá: Salamanca → Puerta de Alcalá → Cibeles → Metrópolis → Canalejas → Sol.
    {
      name: 'Calle de Alcalá',
      path: [
        [ALCALA_I, -1],
        [ALCALA_I, 31],
        [22.5, 37],
        [22.5, 52],
        [26.5, 56],
      ],
      width: 5,
      trees: 'tree.plane',
      labelPath: [
        [ALCALA_I, 24],
        [ALCALA_I, 31],
        [22.5, 37],
        [22.5, 50],
      ],
    },
    // ── Gran Vía: from the Metrópolis fork down to Callao and Plaza de España.
    {
      name: 'Gran Vía',
      path: [
        [ALCALA_I, 31],
        [11.5, 36],
        [11.5, 56],
        [4.5, 63],
      ],
      width: 5,
      trees: null,
      storeyBonus: 2,
      labelPath: [
        [11.5, 38],
        [11.5, 52],
      ],
    },
    // ── Carrera de San Jerónimo: Neptuno → (Congreso) → Cortes → Canalejas → Sol. Narrow.
    {
      name: 'Carrera de San Jerónimo',
      path: [
        [CARRERA_I, 20],
        [CARRERA_I, 56],
      ],
      width: 3,
      rooftops: true,
      storeyBonus: 1,
      labelPath: [
        [CARRERA_I, 41],
        [CARRERA_I, 54],
      ],
    },
    {
      name: 'Calle de Sevilla',
      path: [
        [22.5, 45.5],
        [CARRERA_I, 45.5],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Calle del Prado',
      path: [
        [45.5, 40],
        [45.5, 51],
      ],
      width: 3,
      rooftops: true,
      cafes: true,
    },
    {
      name: 'Calle del Príncipe',
      path: [
        [CARRERA_I, 48.5],
        [41, 48.5],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
      cafes: true,
    },
    {
      name: 'Calle de Espoz y Mina',
      path: [
        [34, 57.5],
        [47.5, 57.5],
        [47.5, 55],
      ],
      width: 3,
    },
    {
      name: 'Calle de las Huertas',
      path: [
        [53.5, 23],
        [53.5, 61],
      ],
      width: 3,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Calle de Atocha',
      path: [
        [34, 61.5],
        [47.5, 61.5],
        [62, 31],
        [64.5, 21],
      ],
      width: 5,
      trees: null,
      labelPath: [
        [49, 58],
        [58, 39],
      ],
    },
    // ── Around Sol.
    {
      name: 'Calle Mayor',
      path: [
        [28.5, 65],
        [28.5, 73],
      ],
      width: 3,
    },
    {
      name: 'Calle del Arenal',
      path: [
        [22.5, 65],
        [22.5, 73],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
    },
    {
      name: 'Calle de Preciados',
      path: [
        [20, 60.5],
        [12, 60.5],
        [12, 56],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
    },
    {
      name: 'Calle de la Montera',
      path: [
        [22, 56],
        [22, 50.5],
        [13, 50.5],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Calle de Toledo',
      path: [
        [40.5, 69],
        [40.5, 73],
      ],
      width: 3,
    },
    {
      name: 'Calle de Embajadores',
      path: [
        [47.5, 61.5],
        [47.5, 73],
      ],
      width: 3,
    },
    {
      name: 'Calle de Lavapiés',
      path: [
        [51, 61.5],
        [59.5, 52],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
    },
    {
      name: 'Calle de Argumosa',
      path: [
        [61, 49.5],
        [73, 49.5],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Calle del Doctor Fourquet',
      path: [
        [59.5, 47],
        [59.5, 38],
        [73, 38],
      ],
      width: 3,
    },
    {
      name: 'Ronda de Atocha',
      path: [
        [64.5, 20],
        [73, 30],
      ],
      width: 5,
    },
    {
      name: 'Calle de la Magdalena',
      path: [
        [53.5, 59.5],
        [73, 59.5],
      ],
      width: 3,
    },
    {
      name: 'Calle de Segovia',
      path: [
        [56.5, 61],
        [56.5, 73],
      ],
      width: 3,
    },
    // ── Retiro edge & the museum strip.
    {
      name: 'Calle de Alfonso XII',
      path: [
        [30, 9.5],
        [65, 9.5],
      ],
      width: 3,
      trees: 'tree.round',
    },
    {
      name: 'Calle de Montalbán',
      path: [
        [30.5, 9],
        [30.5, 15],
      ],
      width: 2,
    },
    {
      name: 'Avenida de la Ciudad de Barcelona',
      path: [
        [64.5, 20],
        [73, 11.5],
      ],
      width: 5,
      trees: 'tree.plane',
    },
    {
      name: 'Calle del Doctor Esquerdo',
      path: [
        [66.5, -1],
        [66.5, 17],
      ],
      width: 3,
    },
    // ── Salamanca (top-left).
    {
      name: 'Calle de Serrano',
      path: [
        [-1, 5.5],
        [14, 5.5],
      ],
      width: 5,
      trees: 'tree.plane',
      cafes: true,
    },
    {
      name: 'Calle de Goya',
      path: [
        [7, -1],
        [7, 15],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    // ── Chueca & Malasaña (left).
    {
      name: 'Calle del Barquillo',
      path: [
        [-1, 27.5],
        [14, 27.5],
      ],
      width: 3,
    },
    {
      name: 'Calle de Hortaleza',
      path: [
        [-1, 37.5],
        [12, 37.5],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Calle de Fuencarral',
      path: [
        [-1, 45.5],
        [9, 45.5],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
      cafes: true,
    },
    {
      name: 'Calle de San Bernardo',
      path: [
        [-1, 57.5],
        [9, 57.5],
      ],
      width: 3,
    },
    {
      name: 'Calle de la Princesa',
      path: [
        [4, 63],
        [4, 73],
      ],
      width: 4,
    },
  ],

  bridges: [],

  landmarks: [
    { id: 'cibeles', i: 16, j: 19 },
    { id: 'neptuno', i: 30, j: 19 },
    { id: 'puertaAlcala', i: 15, j: 5 },
    { id: 'palacioComunicaciones', i: 21, j: 9 },
    { id: 'metropolis', i: 18, j: 32 },
    { id: 'cervantes', i: 37, j: 39 },
  ],

  capitol: { i: 33, j: 27, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Banco de España', i: 19, j: 25, w: 5, d: 4, storeys: 4, roof: 'flat' },
    { name: 'Museo del Prado', i: 34, j: 11, w: 6, d: 4, storeys: 3, roof: 'pitched' },
    { name: 'Los Jerónimos', i: 40, j: 11, w: 6, d: 4, storeys: 3, roof: 'pitched' },
    { name: 'Estación de Atocha', i: 59, j: 11, w: 6, d: 4, storeys: 3, roof: 'flat' },
    { name: 'Museo Thyssen', i: 25, j: 25, w: 4, d: 3, storeys: 4, roof: 'terrace', rooftop: true },
    { name: 'Real Casa de Correos', i: 24, j: 66, w: 4, d: 3, storeys: 3, roof: 'pitched' },
    { name: 'Teatro Español', i: 43, j: 56, w: 4, d: 3, storeys: 3, roof: 'pitched' },
  ],

  zones: [
    // Gran Vía: tall commercial palaces.
    {
      shape: poly([9, 30], [20, 30], [20, 36], [15, 36], [15, 58], [8, 58], [8, 36]),
      storeys: [5, 6],
      residential: 0.25,
    },
    // Salamanca: elegant tall blocks.
    { shape: rect(0, 0, 14, 14), storeys: [4, 6], residential: 0.85 },
    // Lavapiés / La Latina: older, lower corralas.
    {
      shape: rect(48, 30, 72, 72),
      storeys: [3, 4],
      residential: 0.9,
      roofs: { pitched: 7, terrace: 2 },
    },
    // Near the Congreso: grand civic-ish blocks, never spawn buildings.
    { shape: rect(30, 21, 49, 41), storeys: [4, 5], residential: 0, kind: 'commercial' },
  ],

  districts: [
    { id: 'lavapies', name: 'Lavapiés', unlockWave: 1, area: [55, 32, 71, 58], rally: [59, 49] },
    { id: 'malasana', name: 'Malasaña', unlockWave: 1, area: [0, 40, 9, 61], rally: [5, 51] },
    { id: 'chueca', name: 'Chueca', unlockWave: 2, area: [0, 23, 13, 39], rally: [7, 31] },
    { id: 'latina', name: 'La Latina', unlockWave: 3, area: [36, 62, 71, 71], rally: [44, 66] },
    { id: 'salamanca', name: 'Salamanca', unlockWave: 4, area: [0, 0, 13, 14], rally: [7, 6] },
    { id: 'arguelles', name: 'Argüelles', unlockWave: 6, area: [0, 59, 18, 71], rally: [5, 63] },
    { id: 'vallecas', name: 'Vallecas', unlockWave: 8, area: [57, 0, 71, 15], rally: [66, 6] },
  ],

  chokepoints: [
    { name: 'Carrera de San Jerónimo', at: [CARRERA_I, 42], radius: 2 },
    { name: 'Plaza de Neptuno', at: [CARRERA_I, 26], radius: 2 },
    { name: 'Calle del Prado', at: [45.5, 45], radius: 2 },
  ],

  approaches: [
    {
      name: 'Carrera de San Jerónimo (from Sol)',
      path: [
        [CARRERA_I, 56],
        [CARRERA_I, 41],
      ],
      final: true,
    },
    {
      name: 'Carrera de San Jerónimo (from Neptuno)',
      path: [
        [CARRERA_I, 24],
        [CARRERA_I, 34],
      ],
      final: true,
    },
    {
      name: 'Calle del Prado (from Santa Ana)',
      path: [
        [45.5, 51],
        [45.5, 41],
      ],
      final: true,
    },
    {
      name: 'Paseo del Prado',
      path: [
        [64, PRADO_J],
        [33, PRADO_J],
      ],
    },
    {
      name: 'Paseo de Recoletos',
      path: [
        [0, PRADO_J],
        [30, PRADO_J],
      ],
    },
    {
      name: 'Calle de Alcalá',
      path: [
        [ALCALA_I, 0],
        [ALCALA_I, 31],
        [22.5, 37],
        [22.5, 46],
        [31, 46],
      ],
    },
    {
      name: 'Gran Vía',
      path: [
        [4.5, 63],
        [11.5, 56],
        [11.5, 36],
        [ALCALA_I, 31],
      ],
    },
    {
      name: 'Calle de Atocha',
      path: [
        [62, 31],
        [47.5, 61.5],
        [34, 61.5],
      ],
    },
  ],

  decor: [
    // Puerta del Sol: Oso y Madroño, Carlos III, Km 0, metro, Tío Pepe kiosk.
    { kind: 'statue.bear', at: [26, 57] },
    { kind: 'statue.equestrian', at: [27, 61] },
    { kind: 'metro', at: [21, 59] },
    { kind: 'metro', at: [32, 63] },
    { kind: 'kiosk', at: [30, 58] },
    { kind: 'fountain', at: [24, 62] },
    // Plaza de Santa Ana: Calderón & Lorca.
    { kind: 'statue', at: [45, 52] },
    { kind: 'metro', at: [42, 51] },
    // Callao & Gran Vía.
    { kind: 'metro', at: [10, 54] },
    { kind: 'metro', at: [13, 30] },
    // Plaza de España: Cervantes monument.
    { kind: 'statue', at: [3, 63] },
    // Plaza Mayor: Felipe III.
    { kind: 'statue.equestrian', at: [39, 66] },
    // Cortes: bollards in front of the steps line, lamp standards.
    { kind: 'lamp', at: [31, 36] },
    { kind: 'lamp', at: [44, 36] },
    { kind: 'flag', at: [33, 39] },
    { kind: 'flag', at: [41, 39] },
    // Retiro: Ángel Caído + Alfonso XII monument by the Estanque.
    { kind: 'statue', at: [50, 3] },
    { kind: 'statue.equestrian', at: [41, 0] },
    { kind: 'boat', at: [39, 2] },
    { kind: 'boat', at: [44, 3] },
    // Chueca, Lavapiés, Dos de Mayo.
    { kind: 'metro', at: [6, 31] },
    { kind: 'metro', at: [58, 48] },
    { kind: 'statue', at: [5, 51] },
    { kind: 'kiosk', at: [60, 50] },
  ],

  noLanes: [rect(27, 21, 50, 58)],

  labels: [
    { text: 'Retiro', at: [30, 3] },
    { text: 'Barrio de las Letras', at: [48, 33] },
  ],
};
