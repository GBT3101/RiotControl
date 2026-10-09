/**
 * PARIS — Assemblée nationale (Palais Bourbon) and the ~3 km around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): north-up, unrotated — NORTH is −j, EAST is +i.
 * The Seine runs behind the palace (top) and bends south-west at the left edge toward the
 * Eiffel Tower. The portico of the real palace faces the river and the Pont de la Concorde; here
 * the Capitol's front (+j) is its south side on Rue de l'Université / Place du Palais-Bourbon,
 * so the Pont de la Concorde lands at its back on the Quai d'Orsay: crowds crossing from
 * Concorde must split around the palace along Rue Aristide-Briand or Boulevard Saint-Germain.
 * Across the river: Place de la Concorde (obelisk, fountains), the Champs-Élysées, the Grand &
 * Petit Palais and the Tuileries. Left bank: Esplanade + Hôtel des Invalides (left), Musée d'Orsay
 * (right), Boulevard Saint-Germain curving south-east toward the Latin Quarter.
 */
import type { Blueprint } from '../blueprint';
import { poly, rect } from '../blueprint';

const SEINE_J = 22; // water j 19..24, quays 18 & 25
const QUAI_J = 27.5; // Quai d'Orsay / Anatole-France (j 26..28)
const COURS_J = 16.5; // Cours la Reine / Quai des Tuileries (j 15..17)
const CONC_I = 35.5; // Pont de la Concorde / Rue Royale / Rue de Bourgogne axis
const ALEX_I = 16.5; // Pont Alexandre III / Av. Winston-Churchill / Esplanade axis
const UNIV_J = 39.5; // Rue de l'Université (j 38..40) — directly in front of the steps
const SG_I = 45.5; // Boulevard Saint-Germain north–south section (i 43..47)

export const paris: Blueprint = {
  city: 'paris',
  name: 'Paris',
  w: 72,
  h: 72,
  seed: 0x70617269,
  style: {
    roofs: { mansard: 8, flat: 1, pitched: 1 },
    storeys: [4, 5],
    residential: 0.75,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.025 },
      { kind: 'morris', p: 0.01 },
      { kind: 'wallace', p: 0.008 },
      { kind: 'bench', p: 0.012 },
      { kind: 'kiosk', p: 0.006 },
      { kind: 'busstop', p: 0.012 },
      { kind: 'bollard', p: 0.02 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.02 },
      { kind: 'bin', p: 0.01 },
      { kind: 'morris', p: 0.006 },
    ],
    laneSurface: 'cobble',
    maxBlock: 13,
  },

  areas: [
    // Jardin des Tuileries (+ Grand Bassin Octogonal, central allée).
    {
      ground: 'grass',
      shape: rect(46, 6, 59, 13),
      name: 'Jardin des Tuileries',
      trees: { kinds: ['tree.chestnut', 'tree.round'], density: 0.4 },
    },
    { ground: 'parkPath', shape: rect(46, 9, 59, 10) },
    { ground: 'parkPath', shape: rect(54, 6, 55, 13) },
    { ground: 'water', shape: rect(48, 8, 51, 11), name: 'Grand Bassin' },
    // Jardins des Champs-Élysées (between the avenue and Cours la Reine).
    {
      ground: 'grass',
      shape: rect(26, 12, 27, 14),
      trees: { kinds: ['tree.chestnut'], density: 0.45 },
    },
    // Esplanade des Invalides: lawns either side of a central allée.
    {
      ground: 'grass',
      shape: rect(13, 29, 19, 46),
      name: 'Esplanade des Invalides',
      trees: { kinds: ['tree.plane'], density: 0.18 },
    },
    { ground: 'parkPath', shape: rect(15, 29, 17, 46) },
    // Champ de Mars.
    {
      ground: 'grass',
      shape: rect(0, 47, 7, 59),
      name: 'Champ de Mars',
      trees: { kinds: ['tree.plane', 'tree.round'], density: 0.25 },
    },
    { ground: 'parkPath', shape: rect(3, 47, 4, 59) },
    // Square du Vert-Galant style riverside lawn by the Orsay quay.
    // --- Top layer.
    // Place de la Concorde: the octagon.
    {
      ground: 'plaza',
      shape: poly([29, 3], [43, 3], [45, 5], [45, 14], [43, 15], [29, 15], [27, 13], [27, 5]),
      layer: 'top',
      name: 'Place de la Concorde',
    },
    // Forecourt: Rue de l'Université widened in front of the steps.
    { ground: 'plaza', shape: rect(28, 37, 42, 41), layer: 'top', name: "Rue de l'Université" },
    // Place du Palais-Bourbon (south of the forecourt; Rue de Bourgogne leaves from it).
    { ground: 'plaza', shape: rect(32, 42, 39, 45), layer: 'top', name: 'Place du Palais-Bourbon' },
    // Place Vauban behind the Invalides dome.
    { ground: 'plaza', shape: rect(15, 60, 22, 62), layer: 'top', name: 'Place Vauban' },
    // Place Saint-Germain-des-Prés.
    { ground: 'plaza', shape: rect(60, 54, 65, 58), layer: 'top', name: 'Saint-Germain-des-Prés' },
    // Trocadéro gardens across from the Eiffel Tower.
  ],

  rivers: [
    {
      name: 'La Seine',
      path: [
        [-1, 37],
        [7, 29],
        [14, SEINE_J],
        [73, SEINE_J],
      ],
      width: 6,
      quay: 1,
    },
  ],

  roads: [
    // ── Right bank.
    {
      name: 'Avenue des Champs-Élysées',
      path: [
        [-1, 9.5],
        [29, 9.5],
      ],
      width: 5,
      trees: 'tree.plane',
      cafes: true,
    },
    {
      name: 'Rue Royale',
      path: [
        [CONC_I, -1],
        [CONC_I, 4],
      ],
      width: 5,
      trees: null,
    },
    {
      name: 'Rue de Rivoli',
      path: [
        [43, 4],
        [73, 4],
      ],
      width: 4,
      trees: null,
      storeyBonus: 1,
    },
    {
      name: 'Rue du Faubourg Saint-Honoré',
      path: [
        [-1, 2.5],
        [30, 2.5],
      ],
      width: 3,
    },
    {
      name: 'Cours la Reine',
      path: [
        [8, COURS_J],
        [29, COURS_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Quai des Tuileries',
      path: [
        [43, COURS_J],
        [73, COURS_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Avenue Winston-Churchill',
      path: [
        [ALEX_I, 9.5],
        [ALEX_I, 16],
      ],
      width: 3,
    },
    {
      name: 'Avenue de New-York',
      path: [
        [10, COURS_J],
        [4, 22],
        [-1, 22],
      ],
      width: 3,
    },
    {
      name: "Avenue d'Iéna",
      path: [
        [-1, 15.5],
        [8, 15.5],
      ],
      width: 3,
    },
    {
      name: 'Rue des Pyramides',
      path: [
        [62.5, -1],
        [62.5, 15],
      ],
      width: 3,
    },
    {
      name: 'Rue de Castiglione',
      path: [
        [50.5, -1],
        [50.5, 4],
      ],
      width: 3,
    },
    // ── Left bank: the quais.
    {
      name: "Quai d'Orsay",
      path: [
        [12, QUAI_J],
        [SG_I, QUAI_J],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: true,
      labelPath: [
        [21, QUAI_J],
        [30, QUAI_J],
      ],
    },
    {
      name: 'Quai Anatole-France',
      path: [
        [SG_I, QUAI_J],
        [73, QUAI_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Quai Branly',
      path: [
        [12.5, QUAI_J],
        [12, 33],
        [8, 38.5],
        [-1, 38.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    // ── Around the Palais Bourbon.
    {
      name: 'Rue Aristide-Briand',
      path: [
        [28.5, QUAI_J],
        [28.5, 41],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Boulevard Saint-Germain',
      path: [
        [SG_I, QUAI_J],
        [SG_I, 47.5],
        [60.5, 56],
        [73, 56],
      ],
      width: 5,
      trees: 'tree.plane',
      cafes: true,
      labelPath: [
        [SG_I, 42],
        [SG_I, 47.5],
        [60.5, 56],
      ],
    },
    {
      name: "Rue de l'Université",
      path: [
        [13, UNIV_J],
        [73, UNIV_J],
      ],
      width: 3,
      rooftops: true,
      labelPath: [
        [48, UNIV_J],
        [62, UNIV_J],
      ],
    },
    {
      name: 'Rue de Bourgogne',
      path: [
        [CONC_I, 45],
        [CONC_I, 63],
      ],
      width: 3,
      rooftops: true,
      cafes: true,
    },
    {
      name: 'Rue Saint-Dominique',
      path: [
        [10, 48.5],
        [SG_I, 48.5],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Rue de Grenelle',
      path: [
        [24.5, 55.5],
        [57, 55.5],
      ],
      width: 3,
    },
    {
      name: 'Rue de Varenne',
      path: [
        [28, 63.5],
        [56.5, 63.5],
      ],
      width: 3,
    },
    {
      name: 'Rue de Lille',
      path: [
        [SG_I, 34.5],
        [73, 34.5],
      ],
      width: 3,
    },
    {
      name: 'Rue de Bellechasse',
      path: [
        [54.5, QUAI_J],
        [54.5, 55],
      ],
      width: 3,
    },
    {
      name: 'Rue du Bac',
      path: [
        [67.5, QUAI_J],
        [67.5, 73],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Rue de Sèvres',
      path: [
        [24.5, 68.5],
        [73, 68.5],
      ],
      width: 3,
    },
    {
      name: 'Rue de Constantine',
      path: [
        [21.5, QUAI_J],
        [21.5, 49],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Boulevard des Invalides',
      path: [
        [25.5, 48.5],
        [25.5, 73],
      ],
      width: 5,
      trees: 'tree.plane',
    },
    {
      name: 'Rue Fabert',
      path: [
        [11.5, 32],
        [11.5, 49],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Avenue de Tourville',
      path: [
        [9, 59.5],
        [25, 59.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Avenue de la Bourdonnais',
      path: [
        [9.5, 38],
        [9.5, 73],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Avenue de Suffren',
      path: [
        [-1, 67.5],
        [9, 67.5],
      ],
      width: 3,
    },
  ],

  bridges: [
    {
      name: 'Pont de la Concorde',
      path: [
        [CONC_I, 14],
        [CONC_I, 27],
      ],
      width: 5,
    },
    {
      name: 'Pont Alexandre III',
      path: [
        [ALEX_I, 16],
        [ALEX_I, 27],
      ],
      width: 5,
    },
    {
      name: 'Passerelle Léopold-Sédar-Senghor',
      path: [
        [54.5, 16],
        [54.5, 27],
      ],
      width: 3,
    },
    {
      name: 'Pont Royal',
      path: [
        [67.5, 16],
        [67.5, 27],
      ],
      width: 3,
    },
  ],

  landmarks: [
    { id: 'obelisk', i: 35, j: 8 },
    { id: 'concordeFountain', i: 34, j: 4 },
    { id: 'concordeFountain', i: 34, j: 11 },
    { id: 'invalides', i: 14, j: 50 },
    { id: 'eiffel', i: 1, j: 41 },
    { id: 'orsay', i: 56, j: 29 },
  ],

  capitol: { i: 30, j: 30, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Hôtel de Lassay', i: 41, j: 30, w: 2, d: 6, storeys: 3, roof: 'mansard', rooftop: true },
    { name: 'Grand Palais', i: 9, j: 11, w: 6, d: 4, storeys: 4, roof: 'flat' },
    { name: 'Petit Palais', i: 19, j: 11, w: 6, d: 4, storeys: 3, roof: 'flat' },
    { name: 'Orangerie', i: 46, j: 13, w: 4, d: 2, storeys: 2, roof: 'flat' },
    { name: 'Jeu de Paume', i: 46, j: 6, w: 4, d: 2, storeys: 2, roof: 'flat' },
    { name: 'Hôtel Matignon', i: 38, j: 65, w: 5, d: 3, storeys: 3, roof: 'mansard' },
    { name: 'Musée Rodin', i: 28, j: 58, w: 5, d: 4, storeys: 3, roof: 'mansard' },
    { name: 'École Militaire', i: 1, j: 68, w: 6, d: 4, storeys: 3, roof: 'mansard' },
    { name: 'Ministère des Affaires étrangères', i: 23, j: 29, w: 4, d: 6, storeys: 4, roof: 'mansard', rooftop: true },
  ],

  zones: [
    // Faubourg Saint-Germain: hôtels particuliers & ministries near the Assemblée.
    { shape: rect(26, 28, 48, 56), storeys: [4, 5], residential: 0.15, kind: 'commercial' },
    // 8e: grand Haussmann blocks.
    { shape: rect(0, 0, 27, 8), storeys: [5, 6], residential: 0.85 },
  ],

  districts: [
    { id: 'latin', name: 'Quartier Latin', unlockWave: 1, area: [57, 40, 71, 66], rally: [64, 47] },
    { id: 'montparnasse', name: 'Montparnasse', unlockWave: 1, area: [27, 64, 56, 71], rally: [45, 66] },
    { id: 'grenelle', name: 'Grenelle', unlockWave: 2, area: [0, 59, 24, 71], rally: [14, 65] },
    { id: 'bastille', name: 'République & Bastille', unlockWave: 3, area: [58, 0, 71, 15], rally: [66, 4] },
    { id: 'batignolles', name: 'Batignolles', unlockWave: 4, area: [0, 0, 27, 6], rally: [14, 2] },
    { id: 'trocadero', name: 'Trocadéro', unlockWave: 6, area: [0, 11, 12, 31], rally: [4, 15] },
  ],

  chokepoints: [
    { name: 'Pont de la Concorde', at: [CONC_I, 21], radius: 2 },
    { name: 'Pont Alexandre III', at: [ALEX_I, 21], radius: 2 },
    { name: 'Rue de Bourgogne', at: [CONC_I, 50], radius: 2 },
  ],

  approaches: [
    { name: "Rue de l'Université (west)", path: [[13, UNIV_J], [29, UNIV_J]], final: true },
    { name: "Rue de l'Université (east)", path: [[60, UNIV_J], [42, UNIV_J]], final: true },
    { name: 'Rue de Bourgogne', path: [[CONC_I, 62], [CONC_I, 42]], final: true },
    { name: 'Pont de la Concorde', path: [[CONC_I, 8], [CONC_I, 28], [SG_I, 28], [SG_I, 37]] },
    { name: 'Pont Alexandre III', path: [[ALEX_I, 10], [ALEX_I, 28], [28.5, 28], [28.5, 37]] },
    { name: 'Boulevard Saint-Germain', path: [[73, 56], [60.5, 56], [SG_I, 47.5], [SG_I, 40]] },
    { name: 'Boulevard des Invalides', path: [[25.5, 71], [25.5, 48.5], [21.5, 48.5], [21.5, 40]] },
  ],

  decor: [
    // Concorde: rostral lamp columns, statues of the French cities at the corners.
    { kind: 'statue', at: [28, 5] },
    { kind: 'statue', at: [44, 5] },
    { kind: 'statue', at: [28, 13] },
    { kind: 'statue', at: [44, 13] },
    { kind: 'lamp.rostral', at: [31, 7] },
    { kind: 'lamp.rostral', at: [40, 7] },
    { kind: 'lamp.rostral', at: [31, 11] },
    { kind: 'lamp.rostral', at: [40, 11] },
    // Forecourt: tricolour flags, statues on the steps' wings.
    { kind: 'flag', at: [30, 39] },
    { kind: 'flag', at: [40, 39] },
    { kind: 'statue', at: [35, 43] },
    // Pont Alexandre III gilded columns.
    { kind: 'column.gilded', at: [14, 17] },
    { kind: 'column.gilded', at: [18, 17] },
    { kind: 'column.gilded', at: [14, 26] },
    { kind: 'column.gilded', at: [18, 26] },
    // Métro (Guimard) entrances, kiosks, Morris columns, Wallace fountains.
    { kind: 'metro', at: [33, 14] },
    { kind: 'metro', at: [44, 40] },
    { kind: 'metro', at: [23, 50] },
    { kind: 'metro', at: [60, 57] },
    { kind: 'metro', at: [59, 2] },
    { kind: 'kiosk', at: [62, 55] },
    { kind: 'morris', at: [33, 42] },
    { kind: 'wallace', at: [38, 44] },
    { kind: 'statue.equestrian', at: [18, 61] },
    { kind: 'boat', at: [30, 21] },
    { kind: 'boat', at: [60, 20] },
  ],

  noLanes: [rect(26, 28, 48, 47)],

  labels: [
    { text: 'Tuileries', at: [58, 7] },
    { text: 'Faubourg Saint-Germain', at: [50, 46] },
  ],
};
