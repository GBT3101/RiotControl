/**
 * ROME — Palazzo Montecitorio (Camera dei Deputati) and the centro storico around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): north-up, unrotated — NORTH is −j, EAST is +i.
 * Bernini's façade of Montecitorio really faces south onto Piazza di Montecitorio and its
 * obelisk, so the Capitol's +j front is its true front. Piazza Colonna (Column of Marcus
 * Aurelius, Palazzo Chigi) opens east of it onto Via del Corso; Basile's rear façade sits on
 * Piazza del Parlamento behind. The Pantheon is south-west (Piazza della Rotonda), the Trevi
 * Fountain east across the Corso, Piazza Navona west, and the Corso runs straight south to
 * Piazza Venezia and the Vittoriano; Via dei Fori Imperiali carries on south-east to the
 * Colosseum in the bottom-right corner.
 *
 * The Tiber is the barrier on the left: it bends east at the top (Ponte Cavour, Ponte Umberto I,
 * Prati across it), swings west round Castel Sant'Angelo, then back east past Ponte Sisto and
 * Ponte Garibaldi with Trastevere across. Everything between the river and the Corso is the
 * narrow, cobbled centro storico: the three final approaches into Piazza di Montecitorio are
 * alleys (Uffici del Vicario, Via della Maddalena) and Piazza Colonna.
 */
import type { Blueprint } from '../blueprint';
import { poly, rect } from '../blueprint';

const CORSO_I = 49; // Via del Corso (width 4: i 47..50)
const SCROFA_I = 26.5; // Via di Ripetta / della Scrofa / Corso del Rinascimento (i 25..27)
const MADDALENA_I = 37; // Via della Maddalena (width 2: i 36..37)
const CAMPO_MARZIO_I = 30; // Via di Campo Marzio (width 2: i 29..30)
const TRITONE_J = 11; // Via del Tritone (width 4: j 9..12)
const CVE_J = 48; // Corso Vittorio Emanuele II / Via del Plebiscito (width 4: j 46..49)

/** Tiber centre line; the Lungoteveri run 5 tiles either side. */
const TEVERE: readonly (readonly [number, number])[] = [
  [11.5, -1],
  [16.5, 9],
  [16.5, 13],
  [9.5, 22],
  [8.5, 38],
  [15.5, 52],
  [17.5, 73],
];
const bank = (d: number, from: number, to: number): [number, number][] =>
  TEVERE.slice(from, to + 1).map(([i, j]) => [i + d, j]);

export const rome: Blueprint = {
  city: 'rome',
  name: 'Roma',
  w: 78,
  h: 72,
  seed: 0x726f6d61,
  style: {
    roofs: { pitched: 6, terrace: 4, flat: 1 },
    storeys: [3, 5],
    residential: 0.74,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.03 },
      { kind: 'bollard', p: 0.03 },
      { kind: 'hydrant', p: 0.014 },
      { kind: 'bench', p: 0.01 },
      { kind: 'kiosk', p: 0.006 },
      { kind: 'busstop', p: 0.012 },
      { kind: 'planter', p: 0.01 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.015 },
      { kind: 'bin', p: 0.012 },
      { kind: 'bollard', p: 0.02 },
      { kind: 'planter', p: 0.01 },
    ],
    laneSurface: 'cobble',
    maxBlock: 11,
  },

  areas: [
    // --- Base layer: the Fori Imperiali ruins (lawns, umbrella pines) either side of the avenue.
    {
      ground: 'grass',
      shape: poly([55, 60], [63, 60], [66, 63], [66, 71], [57, 71], [55, 68]),
      name: 'Foro Romano',
      trees: { kinds: ['tree.pine', 'tree.pine', 'tree.round'], density: 0.3 },
    },
    {
      ground: 'grass',
      shape: poly([57, 53], [62, 53], [65, 57], [63, 59], [57, 59]),
      name: 'Foro di Traiano',
      trees: { kinds: ['tree.pine'], density: 0.22 },
    },
    // Largo di Torre Argentina: the sunken Area Sacra (the cats' republic).
    {
      ground: 'grass',
      shape: rect(39, 42, 43, 45),
      name: 'Largo di Torre Argentina',
      trees: { kinds: ['tree.pine'], density: 0.25 },
    },
    // --- Top layer: piazzas.
    // Piazza di Montecitorio (the obelisk) — the forecourt; steps are painted over its top rows.
    {
      ground: 'plaza',
      shape: rect(30, 20, 42, 25),
      layer: 'top',
      name: 'Piazza di Montecitorio',
    },
    // Piazza Colonna (Column of Marcus Aurelius), open onto Via del Corso.
    { ground: 'plaza', shape: rect(43, 17, 46, 25), layer: 'top', name: 'Piazza Colonna' },
    // Piazza del Parlamento behind the palace (Basile's façade).
    { ground: 'plaza', shape: rect(31, 10, 41, 13), layer: 'top', name: 'Piazza del Parlamento' },
    // Piazza della Rotonda in front of the Pantheon's portico.
    { ground: 'plaza', shape: rect(29, 35, 37, 38), layer: 'top', name: 'Piazza della Rotonda' },
    // Piazza di Pietra (Temple of Hadrian).
    { ground: 'plaza', shape: rect(40, 29, 44, 31), layer: 'top', name: 'Piazza di Pietra' },
    // Piazza Navona: the long stadium square.
    { ground: 'plaza', shape: rect(18, 27, 22, 41), layer: 'top', name: 'Piazza Navona' },
    // Campo de' Fiori.
    { ground: 'plaza', shape: rect(26, 51, 31, 55), layer: 'top', name: "Campo de' Fiori" },
    // Piazza di Trevi, crammed in front of the fountain.
    { ground: 'plaza', shape: rect(52, 23, 59, 26), layer: 'top', name: 'Piazza di Trevi' },
    // Piazza Venezia under the Vittoriano.
    { ground: 'plaza', shape: rect(42, 56, 56, 59), layer: 'top', name: 'Piazza Venezia' },
    // Piazza del Campidoglio (Michelangelo's oval, Marcus Aurelius on horseback).
    { ground: 'plaza', shape: rect(36, 62, 41, 66), layer: 'top', name: 'Piazza del Campidoglio' },
    // Piazza del Colosseo.
    {
      ground: 'plaza',
      shape: poly([64, 59], [77, 59], [77, 71], [67, 71], [64, 68]),
      layer: 'top',
      name: 'Piazza del Colosseo',
    },
    // Piazza di Spagna (the Barcaccia) at the end of Via dei Condotti.
    { ground: 'plaza', shape: rect(59, 1, 63, 7), layer: 'top', name: 'Piazza di Spagna' },
    // Piazza Barberini at the top of Via del Tritone.
    { ground: 'plaza', shape: rect(68, 8, 74, 13), layer: 'top', name: 'Piazza Barberini' },
    // Piazza del Quirinale.
    { ground: 'plaza', shape: rect(60, 27, 66, 30), layer: 'top', name: 'Piazza del Quirinale' },
    // Piazza della Repubblica (Esedra) where Via Nazionale ends.
    {
      ground: 'plaza',
      shape: poly([72, 31], [77, 31], [77, 38], [74, 38], [72, 35]),
      layer: 'top',
      name: 'Piazza della Repubblica',
    },
    // Trastevere: Piazza di Santa Maria in Trastevere, Piazza Trilussa.
    {
      ground: 'plaza',
      shape: rect(2, 58, 6, 61),
      layer: 'top',
      name: 'Piazza di Santa Maria in Trastevere',
    },
    { ground: 'plaza', shape: rect(6, 53, 9, 56), layer: 'top', name: 'Piazza Trilussa' },
    // Prati: Piazza Cavour.
    { ground: 'plaza', shape: rect(2, 3, 6, 6), layer: 'top', name: 'Piazza Cavour' },
  ],

  rivers: [{ name: 'Tevere', path: TEVERE, width: 5, quay: 1 }],

  roads: [
    // ── The Lungoteveri (plane-tree embankments) on both banks.
    {
      name: 'Lungotevere Marzio',
      path: bank(5, 0, 3),
      width: 3,
      trees: 'tree.plane',
      labelPath: [
        [21.5, 9],
        [21.5, 13],
      ],
    },
    {
      name: 'Lungotevere Tor di Nona',
      path: bank(5, 3, 4),
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Lungotevere dei Tebaldi',
      path: bank(5, 4, 6),
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Lungotevere Prati',
      path: bank(-5, 0, 3),
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Lungotevere Castello',
      path: bank(-5, 3, 4),
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Lungotevere della Farnesina',
      path: bank(-5, 4, 6),
      width: 3,
      trees: 'tree.plane',
    },
    // ── Via del Corso: Piazza del Popolo → Largo Chigi → Piazza Colonna → Piazza Venezia.
    {
      name: 'Via del Corso',
      path: [
        [CORSO_I, -1],
        [CORSO_I, 56],
      ],
      width: 4,
      trees: null,
      rooftops: true,
      storeyBonus: 1,
      labelPath: [
        [CORSO_I, 28],
        [CORSO_I, 44],
      ],
    },
    // ── Via del Tritone: Largo Chigi uphill to Piazza Barberini.
    {
      name: 'Via del Tritone',
      path: [
        [CORSO_I, TRITONE_J],
        [79, TRITONE_J],
      ],
      width: 4,
      trees: null,
      labelPath: [
        [52, TRITONE_J],
        [66, TRITONE_J],
      ],
    },
    // ── Ponte Cavour → Via Tomacelli → Via dei Condotti → Piazza di Spagna.
    {
      name: 'Via Tomacelli',
      path: [
        [20, 5],
        [CORSO_I, 5],
      ],
      width: 4,
      trees: null,
    },
    {
      name: 'Via dei Condotti',
      path: [
        [CORSO_I, 4.5],
        [58, 4.5],
      ],
      width: 3,
      surface: 'cobble',
      cafes: true,
      rooftops: true,
    },
    // ── West of Montecitorio: Ripetta → Scrofa → Corso del Rinascimento.
    {
      name: 'Via di Ripetta',
      path: [
        [SCROFA_I, -1],
        [SCROFA_I, 12],
      ],
      width: 3,
    },
    {
      name: 'Via della Scrofa',
      path: [
        [SCROFA_I, 12],
        [SCROFA_I, 27],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Corso del Rinascimento',
      path: [
        [SCROFA_I, 27],
        [SCROFA_I, CVE_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Via Giuseppe Zanardelli',
      path: [
        [21, 12],
        [SCROFA_I, 12],
      ],
      width: 4,
      trees: null,
    },
    {
      name: 'Via di Campo Marzio',
      path: [
        [CAMPO_MARZIO_I, 5],
        [CAMPO_MARZIO_I, 11],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Via del Parlamento',
      path: [
        [41, 11],
        [CORSO_I, 11],
      ],
      width: 2,
      surface: 'plaza',
    },
    {
      name: 'Via degli Uffici del Vicario',
      path: [
        [SCROFA_I, 23],
        [31, 23],
      ],
      width: 2,
      surface: 'plaza',
      rooftops: true,
      cafes: true,
    },
    // Via dei Pastini: Pantheon → Piazza di Pietra → Corso (a dog-leg alley).
    {
      name: 'Via dei Pastini',
      path: [
        [MADDALENA_I, 31],
        [40, 31],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Via di Pietra',
      path: [
        [44, 30],
        [CORSO_I, 30],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Via del Seminario',
      path: [
        [MADDALENA_I, 34],
        [42, 34],
        [42, 40],
        [CORSO_I, 40],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Via Giustiniani',
      path: [
        [SCROFA_I, 37],
        [29, 37],
      ],
      width: 2,
      surface: 'cobble',
    },
    // Painted after the alleys it crosses so its paving stays continuous.
    {
      name: 'Via della Maddalena',
      path: [
        [MADDALENA_I, 25],
        [MADDALENA_I, 36],
      ],
      width: 2,
      surface: 'plaza',
      rooftops: true,
      cafes: true,
    },
    // West of Navona.
    {
      name: 'Via dei Coronari',
      path: [
        [14, 25],
        [17, 25],
        [17, 27],
        [22, 27],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Via del Governo Vecchio',
      path: [
        [13, 43],
        [18, 43],
        [18, 41],
        [22, 41],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    // ── Corso Vittorio Emanuele II (+ Via del Plebiscito into Piazza Venezia).
    {
      name: 'Corso Vittorio Emanuele II',
      path: [
        [18, CVE_J],
        [39, CVE_J],
      ],
      width: 4,
      trees: null,
      labelPath: [
        [20, CVE_J],
        [33, CVE_J],
      ],
    },
    {
      name: 'Via del Plebiscito',
      path: [
        [39, CVE_J],
        [CORSO_I, CVE_J],
      ],
      width: 4,
      trees: null,
    },
    {
      name: 'Via della Rotonda',
      path: [
        [MADDALENA_I, 38],
        [MADDALENA_I, 46],
      ],
      width: 2,
      surface: 'plaza',
      cafes: true,
    },
    // Campo de' Fiori, Via dei Pettinari → Ponte Sisto.
    {
      name: 'Via dei Giubbonari',
      path: [
        [31, 52],
        [35, 52],
        [35, 49],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Via dei Pettinari',
      path: [
        [22, 55],
        [26, 55],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Via dei Baullari',
      path: [
        [28, 49],
        [28, 51],
      ],
      width: 2,
      surface: 'cobble',
    },
    // Via Arenula: Largo Argentina → Ponte Garibaldi.
    {
      name: 'Via Arenula',
      path: [
        [37, 49],
        [37, 56],
        [24, 62],
      ],
      width: 4,
      trees: null,
    },
    // Testaccio: Via Marmorata south toward the Piramide.
    {
      name: 'Via Marmorata',
      path: [
        [27.5, 60],
        [27.5, 73],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    // Via del Teatro di Marcello: Piazza Venezia → the Ghetto → the river.
    {
      name: 'Via del Teatro di Marcello',
      path: [
        [42.5, 58],
        [33.5, 66],
        [33.5, 73],
      ],
      width: 3,
      trees: 'tree.pine',
    },
    // ── East of the Corso: Trevi alleys.
    {
      name: 'Via delle Muratte',
      path: [
        [CORSO_I, 25],
        [53, 25],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Via del Lavatore',
      path: [
        [52, 23],
        [52, 13],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Via della Stamperia',
      path: [
        [60, 13],
        [60, 23],
        [59, 23],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Via della Dataria',
      path: [
        [59, 26],
        [62, 26],
        [62, 27],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Via del Quirinale',
      path: [
        [66, 28.5],
        [70, 28.5],
        [70, 24.5],
        [79, 24.5],
      ],
      width: 3,
      trees: null,
      labelPath: [
        [66, 28.5],
        [70, 28.5],
      ],
    },
    {
      name: 'Via delle Quattro Fontane',
      path: [
        [71.5, 14],
        [71.5, 31],
      ],
      width: 3,
    },
    {
      name: 'Via Vittorio Veneto',
      path: [
        [71, -1],
        [71, 7],
      ],
      width: 4,
      trees: 'tree.plane',
      cafes: true,
    },
    {
      name: 'Via Sistina',
      path: [
        [64, 4.5],
        [69, 4.5],
        [69, 7],
      ],
      width: 3,
    },
    // ── Via Nazionale: Largo Magnanapoli up to the Esedra; Via IV Novembre down to Venezia.
    {
      name: 'Via Nazionale',
      path: [
        [59, 52],
        [74, 37],
      ],
      width: 4,
      trees: null,
      storeyBonus: 1,
    },
    {
      name: 'Via IV Novembre',
      path: [
        [55, 57],
        [55, 52],
        [59, 52],
      ],
      width: 3,
    },
    {
      name: 'Via Cavour',
      path: [
        [65, 62],
        [79, 48],
      ],
      width: 4,
      trees: null,
    },
    {
      name: 'Via dei Serpenti',
      path: [
        [66, 46],
        [66, 60],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Via Panisperna',
      path: [
        [61, 56],
        [67, 56],
        [67, 52],
        [72, 52],
      ],
      width: 2,
      surface: 'cobble',
    },
    // ── Via dei Fori Imperiali: Piazza Venezia to the Colosseum.
    {
      name: 'Via dei Fori Imperiali',
      path: [
        [55.5, 58.5],
        [66, 66],
      ],
      width: 5,
      trees: null,
      rooftops: false,
    },
    // ── Prati.
    {
      name: 'Via Crescenzio',
      path: [
        [-1, 16.5],
        [12, 16.5],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Via Cola di Rienzo',
      path: [
        [-1, 1.5],
        [7, 1.5],
      ],
      width: 3,
      cafes: true,
    },
    // ── Trastevere.
    {
      name: 'Viale di Trastevere',
      path: [
        [11, 62],
        [3, 70],
        [3, 73],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    {
      name: 'Via della Lungaretta',
      path: [
        [-1, 64],
        [7, 64],
        [7, 62],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Via della Scala',
      path: [
        [4, 49],
        [4, 58],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
  ],

  bridges: [
    {
      name: 'Ponte Cavour',
      path: [
        [8, 5],
        [21, 5],
      ],
      width: 4,
    },
    {
      name: 'Ponte Umberto I',
      path: [
        [10, 12],
        [22, 12],
      ],
      width: 4,
    },
    {
      name: "Ponte Sant'Angelo",
      path: [
        [3, 28],
        [16, 28],
      ],
      width: 4,
    },
    {
      name: 'Ponte Vittorio Emanuele II',
      path: [
        [7, CVE_J],
        [20, CVE_J],
      ],
      width: 4,
    },
    {
      name: 'Ponte Sisto',
      path: [
        [9, 55],
        [23, 55],
      ],
      width: 2,
      sidewalk: 0,
    },
    {
      name: 'Ponte Garibaldi',
      path: [
        [10, 62],
        [25, 62],
      ],
      width: 4,
    },
  ],

  landmarks: [
    { id: 'pantheon', i: 30, j: 31 },
    { id: 'trevi', i: 54, j: 20 },
    { id: 'vittoriano', i: 44, j: 60 },
    { id: 'colosseum', i: 67, j: 62 },
  ],

  capitol: { i: 32, j: 14, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Palazzo Chigi', i: 43, j: 13, w: 4, d: 4, storeys: 4, roof: 'terrace', rooftop: true },
    {
      name: 'Palazzo Madama',
      i: 28,
      j: 40,
      w: 4,
      d: 4,
      storeys: 4,
      roof: 'terrace',
      rooftop: true,
    },
    { name: 'Palazzo del Quirinale', i: 61, j: 22, w: 6, d: 4, storeys: 4, roof: 'pitched' },
    { name: 'Palazzo di Giustizia', i: 2, j: 9, w: 6, d: 4, storeys: 5, roof: 'flat' },
    { name: 'Palazzo Senatorio', i: 36, j: 67, w: 6, d: 3, storeys: 4, roof: 'pitched' },
    { name: 'Mercati di Traiano', i: 57, j: 49, w: 4, d: 3, storeys: 3, roof: 'flat' },
  ],

  zones: [
    // Centro storico: low-rise, terracotta roofs and roof terraces, shops below.
    {
      shape: rect(13, 6, 47, 60),
      storeys: [3, 4],
      residential: 0.6,
      roofs: { pitched: 5, terrace: 5 },
      maxLen: 4,
    },
    // Around the Camera: palazzi of government, never spawn buildings.
    { shape: rect(28, 8, 47, 39), storeys: [4, 5], residential: 0, kind: 'commercial' },
    // Prati: tall Umbertine blocks.
    { shape: rect(0, 0, 12, 21), storeys: [4, 6], residential: 0.88 },
    // Esquilino: big Piedmontese apartment blocks.
    { shape: rect(66, 32, 77, 58), storeys: [4, 6], residential: 0.85 },
  ],

  districts: [
    {
      id: 'trastevere',
      name: 'Trastevere',
      unlockWave: 1,
      area: [0, 50, 10, 71],
      rally: [4, 60],
    },
    { id: 'monti', name: 'Monti', unlockWave: 1, area: [56, 42, 70, 61], rally: [70, 57] },
    {
      id: 'esquilino',
      name: 'Esquilino & Termini',
      unlockWave: 2,
      area: [71, 26, 77, 58],
      rally: [75, 37],
    },
    { id: 'prati', name: 'Prati', unlockWave: 3, area: [0, 0, 11, 25], rally: [4, 5] },
    { id: 'testaccio', name: 'Testaccio', unlockWave: 4, area: [18, 56, 35, 71], rally: [27, 69] },
    { id: 'flaminio', name: 'Flaminio', unlockWave: 6, area: [20, 0, 46, 4], rally: [36, 3] },
  ],

  chokepoints: [
    { name: 'Via del Corso (Piazza Colonna)', at: [CORSO_I, 20], radius: 2 },
    { name: 'Via della Scrofa', at: [SCROFA_I, 18], radius: 2 },
    { name: 'Via della Maddalena', at: [MADDALENA_I, 29], radius: 2 },
  ],

  approaches: [
    {
      name: 'Piazza Colonna (from Via del Corso)',
      path: [
        [CORSO_I, 21],
        [43, 21],
      ],
      final: true,
    },
    {
      name: 'Via della Maddalena (from the Pantheon)',
      path: [
        [MADDALENA_I, 37],
        [MADDALENA_I, 26],
      ],
      final: true,
    },
    {
      name: 'Via degli Uffici del Vicario (from Via della Scrofa)',
      path: [
        [SCROFA_I, 23],
        [30, 23],
      ],
      final: true,
    },
    {
      name: 'Via del Corso (from Piazza del Popolo)',
      path: [
        [CORSO_I, 0],
        [CORSO_I, 21],
      ],
    },
    {
      name: 'Via del Tritone',
      path: [
        [77, TRITONE_J],
        [CORSO_I, TRITONE_J],
      ],
    },
    {
      name: 'Ponte Umberto I',
      path: [
        [10, 12],
        [SCROFA_I, 12],
        [SCROFA_I, 23],
      ],
    },
    {
      name: 'Corso Vittorio Emanuele II',
      path: [
        [18, CVE_J],
        [36, CVE_J],
        [36, 38],
      ],
    },
    {
      name: 'Via Nazionale',
      path: [
        [74, 37],
        [59, 52],
        [55, 52],
        [55, 57],
        [CORSO_I, 57],
        [CORSO_I, 25],
      ],
    },
  ],

  decor: [
    // Piazza di Montecitorio: flags (the obelisk is part of the Capitol art, E4).
    { kind: 'flag', at: [32, 22] },
    { kind: 'flag', at: [40, 22] },
    // Piazza Colonna: the Column of Marcus Aurelius + fountain.
    { kind: 'column.gilded', at: [44, 21] },
    { kind: 'fountain', at: [45, 24] },
    // Piazza della Rotonda: the fountain with its obelisk.
    { kind: 'fountain', at: [33, 37] },
    // Piazza Navona: Fontana del Nettuno, dei Quattro Fiumi, del Moro.
    { kind: 'fountain', at: [20, 29] },
    { kind: 'statue', at: [20, 34] },
    { kind: 'fountain', at: [20, 39] },
    // Campo de' Fiori: Giordano Bruno; market kiosks.
    { kind: 'statue', at: [28, 53] },
    { kind: 'kiosk', at: [30, 52] },
    // Campidoglio: Marcus Aurelius.
    { kind: 'statue.equestrian', at: [38, 64] },
    // Piazza di Spagna: the Barcaccia; Piazza Barberini: the Triton.
    { kind: 'fountain', at: [61, 5] },
    { kind: 'fountain', at: [71, 10] },
    // Piazza del Quirinale: the Dioscuri and their obelisk.
    { kind: 'statue', at: [63, 29] },
    // Piazza della Repubblica: Fontana delle Naiadi.
    { kind: 'fountain', at: [75, 34] },
    // Santa Maria in Trastevere fountain.
    { kind: 'fountain', at: [4, 59] },
    // Ponte Sant'Angelo: Bernini's angels.
    { kind: 'statue', at: [6, 27] },
    { kind: 'statue', at: [12, 27] },
    { kind: 'statue', at: [6, 29] },
    { kind: 'statue', at: [12, 29] },
    // Metro entrances: Spagna, Barberini, Colosseo, Cavour; kiosks (edicole).
    { kind: 'metro', at: [64, 2] },
    { kind: 'metro', at: [68, 13] },
    { kind: 'metro', at: [64, 60] },
    { kind: 'metro', at: [72, 50] },
    { kind: 'kiosk', at: [47, 27] },
    { kind: 'kiosk', at: [43, 56] },
    { kind: 'kiosk', at: [24, 47] },
    // Piazza Venezia flowerbed lamps.
    { kind: 'lamp', at: [44, 57] },
    { kind: 'lamp', at: [53, 57] },
    // Tiber: tourist boats.
    { kind: 'boat', at: [14, 33] },
    { kind: 'boat', at: [16, 60] },
  ],

  noLanes: [rect(27, 8, 47, 39)],

  labels: [
    { text: 'Campo Marzio', at: [36, 6] },
    { text: "Castel Sant'Angelo", at: [1, 24] },
    { text: 'Ghetto', at: [28, 60] },
  ],
};
