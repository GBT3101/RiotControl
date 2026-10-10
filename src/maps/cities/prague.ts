/**
 * PRAGUE — Prague Castle with St Vitus on Hradčany and the ~3 km around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): north-up, unrotated — NORTH is −j, EAST is +i.
 * The Castle's long south front (the famous panorama over the Malá Strana roofs) faces +j; its
 * steps open onto the Na Valech rampart terrace. The Castle sits on a hill: the slope below the
 * terrace is a band of palaces and walled gardens with no through lanes, so the only ways up are
 * the long uphill streets and stairways — Nerudova + Ke Hradu to Hradčanské náměstí (west end),
 * Zámecké schody (climbing from Thunovská, reached off Nerudova) and the Staré zámecké schody
 * (east end, from Klárov). Behind it (top) lie the wooded Stag Moat and the Royal Garden with
 * the Belvedere, walled off from Klárov; the Chotek Park leads from Klárov up to Letná.
 *
 * The Vltava runs north–south east of Malá Strana and bends east across the top past Josefov,
 * under the Letná plateau on its far (north) bank.
 * Crossings: Charles Bridge (Mostecká → Malostranské náměstí; the Old Town Bridge Tower stands
 * at its Staré Město end on Křižovnické náměstí), Mánes Bridge (Klárov ↔ Rudolfinum) and the
 * Legion Bridge over Střelecký ostrov (Národní třída ↔ Újezd). Staré Město: Karlova, the Old
 * Town Square (Old Town Hall + astronomical clock, Týn Church), Celetná to the Powder Tower,
 * Melantrichova to Můstek. Nové Město: Národní třída, Na Příkopě, Wenceslas Square up to the
 * National Museum, Karlovo náměstí, the Dancing House on the Rašínovo nábřeží. Petřín's
 * wooded hill fills the south-west; Vinohrady/Žižkov is the east edge.
 *
 * Stairways are cobbled streets ('steps' ground is reserved for the Capitol's own steps and is
 * not deployable), so officers can hold them.
 */
import type { Blueprint } from '../blueprint';
import { rect } from '../blueprint';

const RIVER_I = 43.5; // Vltava (water i 40..46, quays 39 & 47)
const EMB_I = 49.5; // east embankment (Křižovnická → Smetanovo → Masarykovo → Rašínovo nábřeží)
const NERUDOVA_J = 23.5; // Nerudova / Úvoz (j 22..24)
const KEHRADU_I = 10.5; // Ke Hradu ramp (i 9..11)
const SCHODY_I = 21.5; // Zámecké schody (i 20..22)
const UJEZD_I = 28.5; // Karmelitská / Újezd (i 27..29)
const KARLUV_J = 26; // Charles Bridge / Mostecká (j 24..27)
const MANES_J = 16; // Mánes Bridge (j 14..17)
const LEGII_J = 37.5; // Legion Bridge / Národní třída / Na Příkopě (j 36..38)

export const prague: Blueprint = {
  city: 'prague',
  name: 'Prague',
  w: 78,
  h: 77,
  seed: 0x70726168,
  style: {
    roofs: { pitched: 7, mansard: 2, terrace: 1 },
    storeys: [3, 5],
    residential: 0.72,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.03 },
      { kind: 'bench', p: 0.012 },
      { kind: 'bollard', p: 0.02 },
      { kind: 'kiosk', p: 0.006 },
      { kind: 'busstop', p: 0.012 },
      { kind: 'planter', p: 0.008 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.02 },
      { kind: 'bin', p: 0.012 },
      { kind: 'planter', p: 0.01 },
    ],
    laneSurface: 'cobble',
    maxBlock: 12,
  },

  areas: [
    // ── Base: green.
    // Behind the Castle (north): the wooded Stag Moat right under its walls, the Royal Garden
    // beyond it (a dead end: walled off from Klárov), and across the river bend the Letná
    // plateau, reached from Klárov through the Chotek Park.
    {
      ground: 'grass',
      shape: rect(8, 0, 32, 3),
      name: 'Královská zahrada',
      trees: { kinds: ['tree.round', 'tree.chestnut'], density: 0.3 },
    },
    { ground: 'parkPath', shape: rect(9, 1, 28, 1) },
    {
      ground: 'grass',
      shape: rect(10, 4, 34, 6),
      name: 'Jelení příkop',
      trees: { kinds: ['tree.round', 'tree.oak'], density: 0.55 },
    },
    {
      ground: 'grass',
      shape: rect(38, 0, 77, 3),
      name: 'Letná',
      trees: { kinds: ['tree.chestnut', 'tree.round'], density: 0.4 },
    },
    {
      ground: 'grass',
      shape: rect(38, 4, 41, 7),
      name: 'Chotkovy sady',
      trees: { kinds: ['tree.round'], density: 0.35 },
    },
    // Petřín hill (wooded) in the south-west, with its paths.
    {
      ground: 'grass',
      shape: rect(0, 29, 18, 57),
      name: 'Petřín',
      trees: { kinds: ['tree.round', 'tree.round', 'tree.oak'], density: 0.45 },
    },
    { ground: 'parkPath', shape: rect(4, 29, 4, 57) },
    { ground: 'parkPath', shape: rect(4, 45, 18, 45) },
    { ground: 'parkPath', shape: rect(13, 29, 13, 45) },
    // Kampa park on the Malá Strana bank.
    {
      ground: 'grass',
      shape: rect(35, 28, 38, 35),
      name: 'Kampa',
      trees: { kinds: ['tree.round', 'tree.plane'], density: 0.35 },
    },
    // Karlovo náměstí (park square).
    {
      ground: 'grass',
      shape: rect(52, 49, 58, 57),
      name: 'Karlovo náměstí',
      trees: { kinds: ['tree.plane', 'tree.round'], density: 0.3 },
    },
    { ground: 'parkPath', shape: rect(55, 49, 55, 57) },
    // ── Top: the Castle hill.
    // Hradčanské náměstí (west end of the Castle) and the Na Valech terrace in front of the steps.
    { ground: 'plaza', shape: rect(6, 7, 14, 16), layer: 'top', name: 'Hradčanské náměstí' },
    { ground: 'plaza', shape: rect(14, 13, 30, 16), layer: 'top', name: 'Na Valech' },
    // Gardens below the Castle: walled from the terrace (dead-end greenery on the slope).
    {
      ground: 'grass',
      shape: rect(23, 18, 29, 20),
      layer: 'top',
      name: 'Zahrady pod Pražským hradem',
      trees: { kinds: ['tree.round', 'tree.chestnut'], density: 0.45 },
    },
    { ground: 'lot', shape: rect(23, 17, 30, 17), layer: 'top', reserve: true },
    // Klárov (Mánes Bridge head), Malostranské náměstí, Křižovnické náměstí.
    { ground: 'asphalt', shape: rect(35, 8, 38, 18), layer: 'top', name: 'Klárov' },
    // Na Opyši: the east gate forecourt where the Old Castle Steps arrive.
    { ground: 'plaza', shape: rect(29, 8, 30, 12), layer: 'top', name: 'Na Opyši' },
    { ground: 'plaza', shape: rect(25, 22, 32, 28), layer: 'top', name: 'Malostranské náměstí' },
    { ground: 'plaza', shape: rect(48, 22, 53, 30), layer: 'top', name: 'Křižovnické náměstí' },
    // Staroměstské náměstí (Old Town Square).
    { ground: 'cobble', shape: rect(57, 16, 66, 24), layer: 'top', name: 'Staroměstské náměstí' },
    // Střelecký ostrov (island between Charles Bridge and the Legion Bridge).
    {
      ground: 'grass',
      shape: rect(41, 30, 45, 35),
      layer: 'top',
      name: 'Střelecký ostrov',
      trees: { kinds: ['tree.round'], density: 0.4 },
    },
    // Václavské náměstí: the long sloping square with its central gardens, up to the Museum.
    { ground: 'plaza', shape: rect(60, 39, 67, 59), layer: 'top', name: 'Václavské náměstí' },
    {
      ground: 'grass',
      shape: rect(63, 42, 64, 55),
      layer: 'top',
      trees: { kinds: ['tree.plane'], density: 0.5 },
    },
    // Jiráskovo náměstí at the Dancing House.
    { ground: 'plaza', shape: rect(51, 60, 54, 65), layer: 'top', name: 'Jiráskovo náměstí' },
  ],

  rivers: [
    {
      name: 'Vltava',
      path: [
        [RIVER_I, 79],
        [RIVER_I, 11],
        [48, 6.5],
        [80, 6.5],
      ],
      width: 7,
      quay: 1,
    },
  ],

  roads: [
    // ── Up to the Castle.
    {
      name: 'Nerudova',
      path: [
        [26, NERUDOVA_J],
        [KEHRADU_I, NERUDOVA_J],
      ],
      width: 3,
      surface: 'plaza',
      rooftops: true,
      cafes: true,
    },
    {
      name: 'Úvoz',
      path: [
        [KEHRADU_I, NERUDOVA_J],
        [-1, NERUDOVA_J],
      ],
      width: 3,
      surface: 'plaza',
    },
    {
      name: 'Ke Hradu',
      path: [
        [KEHRADU_I, 16],
        [KEHRADU_I, NERUDOVA_J],
      ],
      width: 3,
      surface: 'plaza',
      rooftops: true,
    },
    {
      name: 'Zámecké schody',
      path: [
        [SCHODY_I, 16.5],
        [SCHODY_I, 20.5],
      ],
      width: 3,
      surface: 'plaza',
      sidewalk: 0,
      rooftops: true,
    },
    {
      name: 'Thunovská',
      path: [
        [SCHODY_I, 20.5],
        [24.5, 20.5],
        [24.5, 22],
      ],
      width: 3,
      surface: 'plaza',
      sidewalk: 0,
    },
    {
      name: 'Staré zámecké schody',
      path: [
        [31, 9],
        [36, 9],
      ],
      width: 2,
      surface: 'plaza',
      sidewalk: 0,
      rooftops: true,
    },
    {
      name: 'Loretánská',
      path: [
        [-1, 11.5],
        [6, 11.5],
      ],
      width: 3,
      surface: 'plaza',
    },
    // ── Malá Strana.
    {
      name: 'Letenská',
      path: [
        [36.5, 17],
        [36.5, 22.5],
        [32, 22.5],
      ],
      width: 3,
    },
    {
      name: 'Karmelitská',
      path: [
        [UJEZD_I, 28],
        [UJEZD_I, LEGII_J],
      ],
      width: 3,
    },
    {
      name: 'Újezd',
      path: [
        [UJEZD_I, LEGII_J],
        [UJEZD_I, 78],
      ],
      width: 3,
    },
    // ── East bank.
    {
      name: 'Křižovnická',
      path: [
        [EMB_I, 11],
        [EMB_I, 22],
      ],
      width: 3,
    },
    {
      name: 'Smetanovo nábřeží',
      path: [
        [EMB_I, 29],
        [EMB_I, LEGII_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Masarykovo nábřeží',
      path: [
        [EMB_I, LEGII_J],
        [EMB_I, 59],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Rašínovo nábřeží',
      path: [
        [EMB_I, 59],
        [EMB_I, 78],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Dvořákovo nábřeží',
      path: [
        [EMB_I, 12.5],
        [79, 12.5],
      ],
      width: 3,
      trees: 'tree.plane',
      labelPath: [
        [64, 12.5],
        [76, 12.5],
      ],
    },
    // ── Staré Město & Josefov.
    {
      name: 'Karlova',
      path: [
        [53, 26],
        [57, 26],
        [57, 24],
      ],
      width: 2,
      surface: 'plaza',
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Pařížská',
      path: [
        [62.5, 12],
        [62.5, 16],
      ],
      width: 3,
      trees: 'tree.plane',
      cafes: true,
    },
    {
      name: 'Celetná',
      path: [
        [66, 22.5],
        [74, 22.5],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
      cafes: true,
    },
    {
      name: 'Melantrichova',
      path: [
        [61.5, 24],
        [61.5, 36],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
      cafes: true,
    },
    {
      name: 'Husova',
      path: [
        [56.5, 26],
        [56.5, 36],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
    },
    // ── Nové Město.
    {
      name: 'Národní třída',
      path: [
        [EMB_I, LEGII_J],
        [62, LEGII_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Na Příkopě',
      path: [
        [62, LEGII_J],
        [79, LEGII_J],
      ],
      width: 3,
      surface: 'plaza',
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Vodičkova',
      path: [
        [EMB_I, 46.5],
        [60, 46.5],
      ],
      width: 3,
    },
    {
      name: 'Resslova',
      path: [
        [EMB_I, 59.5],
        [60, 59.5],
      ],
      width: 3,
    },
    {
      name: 'Ječná',
      path: [
        [55, 67.5],
        [79, 67.5],
      ],
      width: 3,
    },
    {
      name: 'Žitná',
      path: [
        [67, 51.5],
        [79, 51.5],
      ],
      width: 3,
    },
    {
      name: 'Vinohradská',
      path: [
        [66, 62.5],
        [79, 62.5],
      ],
      width: 4,
      trees: 'tree.plane',
    },
  ],

  bridges: [
    {
      name: 'Karlův most',
      path: [
        [32, KARLUV_J],
        [50, KARLUV_J],
      ],
      width: 4,
      sidewalk: 1,
    },
    {
      name: 'Mánesův most',
      path: [
        [36, MANES_J],
        [EMB_I, MANES_J],
      ],
      width: 4,
    },
    {
      name: 'Most Legií',
      path: [
        [UJEZD_I, LEGII_J],
        [EMB_I, LEGII_J],
      ],
      width: 3,
    },
  ],

  landmarks: [
    { id: 'bridgeTower', i: 50, j: 25 },
    { id: 'oldTownHall', i: 57, j: 21 },
    { id: 'tynChurch', i: 67, j: 17 },
    { id: 'dancingHouse', i: 51, j: 66 },
  ],

  capitol: { i: 15, j: 7, stepRows: 2, stepInset: 1 },

  civic: [
    // The Belvedere (Queen Anne's summer palace) closing the Royal Garden's east end.
    { name: 'Letohrádek královny Anny', i: 29, j: 0, w: 4, d: 2, storeys: 2, roof: 'pitched' },
    { name: 'Arcibiskupský palác', i: 6, j: 7, w: 4, d: 3, storeys: 3, roof: 'pitched' },
    { name: 'Schwarzenberský palác', i: 6, j: 17, w: 4, d: 4, storeys: 4, roof: 'pitched' },
    { name: 'Poslanecká sněmovna', i: 26, j: 20, w: 5, d: 2, storeys: 3, roof: 'pitched' },
    { name: 'Valdštejnský palác', i: 31, j: 18, w: 4, d: 4, storeys: 3, roof: 'pitched' },
    { name: 'Kostel sv. Mikuláše', i: 27, j: 24, w: 4, d: 3, storeys: 6, roof: 'pitched' },
    { name: 'Rudolfinum', i: 51, j: 15, w: 5, d: 4, storeys: 4, roof: 'pitched', rooftop: true },
    {
      name: 'Národní divadlo',
      i: 51,
      j: 39,
      w: 5,
      d: 4,
      storeys: 5,
      roof: 'pitched',
      rooftop: true,
    },
    { name: 'Národní muzeum', i: 60, j: 60, w: 6, d: 4, storeys: 5, roof: 'pitched' },
    { name: 'Prašná brána', i: 74, j: 20, w: 2, d: 2, storeys: 6, roof: 'pitched' },
    { name: 'Klementinum', i: 51, j: 31, w: 5, d: 4, storeys: 4, roof: 'pitched', rooftop: true },
  ],

  zones: [
    // The Castle district and the hill: palaces, no homes.
    {
      shape: rect(0, 0, 38, 22),
      storeys: [3, 4],
      residential: 0,
      kind: 'commercial',
      roofs: { pitched: 8, mansard: 1 },
    },
    // Baroque Malá Strana and the Old Town: lower, steep red roofs.
    { shape: rect(22, 22, 72, 36), storeys: [3, 4], roofs: { pitched: 9, mansard: 1 } },
    // Josefov: Art Nouveau apartment houses along Pařížská and the embankment.
    { shape: rect(50, 13, 77, 16), storeys: [4, 5], residential: 0.95, maxLen: 3 },
    // Vinohrady: tall Gründerzeit blocks.
    { shape: rect(68, 39, 77, 76), storeys: [4, 6], residential: 0.9 },
  ],

  districts: [
    {
      id: 'staremesto',
      name: 'Staré Město',
      unlockWave: 1,
      area: [51, 25, 68, 35],
      rally: [52, 28],
    },
    {
      id: 'malastrana',
      name: 'Malá Strana',
      unlockWave: 1,
      area: [23, 29, 38, 55],
      rally: [29, 43],
    },
    { id: 'josefov', name: 'Josefov', unlockWave: 2, area: [50, 10, 77, 17], rally: [62, 13] },
    { id: 'hradcany', name: 'Hradčany', unlockWave: 3, area: [0, 5, 5, 28], rally: [2, 23] },
    { id: 'novemesto', name: 'Nové Město', unlockWave: 4, area: [50, 41, 59, 76], rally: [55, 69] },
    {
      id: 'vinohrady',
      name: 'Vinohrady & Žižkov',
      unlockWave: 6,
      area: [68, 39, 77, 76],
      rally: [72, 63],
    },
  ],

  chokepoints: [
    { name: 'Zámecké schody', at: [SCHODY_I, 18], radius: 2 },
    { name: 'Nerudova', at: [25, NERUDOVA_J], radius: 2 },
    { name: 'Karlův most', at: [RIVER_I, KARLUV_J], radius: 2 },
    { name: 'Mánesův most', at: [RIVER_I, MANES_J], radius: 2 },
  ],

  approaches: [
    {
      name: 'Ke Hradu → Hradčanské náměstí',
      path: [
        [KEHRADU_I, NERUDOVA_J],
        [KEHRADU_I, 15],
        [15, 15],
      ],
      final: true,
    },
    {
      name: 'Zámecké schody',
      path: [
        [SCHODY_I, 20.5],
        [SCHODY_I, 15],
      ],
      final: true,
    },
    {
      name: 'Staré zámecké schody (from Klárov)',
      path: [
        [36, 9],
        [29.5, 9],
        [29.5, 14],
      ],
      final: true,
    },
    {
      name: 'Nerudova',
      path: [
        [26, NERUDOVA_J],
        [KEHRADU_I, NERUDOVA_J],
      ],
    },
    {
      name: 'Karlův most → Mostecká',
      path: [
        [50, KARLUV_J],
        [32, KARLUV_J],
      ],
    },
    {
      name: 'Mánesův most → Klárov',
      path: [
        [EMB_I, MANES_J],
        [36.5, MANES_J],
      ],
    },
    {
      name: 'Národní třída → Most Legií → Újezd',
      path: [
        [62, LEGII_J],
        [UJEZD_I, LEGII_J],
        [UJEZD_I, 28],
      ],
    },
  ],

  decor: [
    // The Castle: flags on the terrace, lamps.
    { kind: 'flag', at: [17, 15] },
    { kind: 'flag', at: [26, 15] },
    { kind: 'lamp', at: [14, 16] },
    { kind: 'lamp', at: [29, 16] },
    { kind: 'statue', at: [9, 12] },
    // The Singing Fountain in front of the Belvedere.
    { kind: 'fountain', at: [27, 2] },
    // Charles Bridge statues along the parapets.
    { kind: 'statue', at: [41, 24] },
    { kind: 'statue', at: [44, 24] },
    { kind: 'statue', at: [42, 27] },
    { kind: 'statue', at: [45, 27] },
    // Old Town Square: Jan Hus monument; Malostranské náměstí; Wenceslas on horseback.
    { kind: 'statue', at: [62, 19] },
    { kind: 'lamp', at: [26, 27] },
    { kind: 'statue.equestrian', at: [63, 57] },
    { kind: 'kiosk', at: [61, 45] },
    { kind: 'kiosk', at: [66, 51] },
    // Metro: Malostranská, Staroměstská, Můstek, Muzeum, Národní třída, Karlovo náměstí.
    { kind: 'metro', at: [38, 19] },
    { kind: 'metro', at: [54, 24] },
    { kind: 'metro', at: [60, 39] },
    { kind: 'metro', at: [66, 58] },
    { kind: 'metro', at: [58, 39] },
    { kind: 'metro', at: [52, 58] },
    // Karlovo náměstí fountain; boats on the Vltava.
    { kind: 'fountain', at: [55, 53] },
    { kind: 'boat', at: [43, 45] },
    { kind: 'boat', at: [42, 20] },
    { kind: 'boat', at: [60, 7] },
  ],

  // The Castle hill: no automatic alleys through the palaces, so the streets and stairways
  // above stay the only ways up.
  noLanes: [rect(0, 0, 38, 21)],

  labels: [
    { text: 'Hradčany', at: [2, 9] },
    { text: 'Královská zahrada', at: [12, 2] },
    { text: 'Letná', at: [64, 1] },
    { text: 'Petřín', at: [8, 37] },
    { text: 'Václavské náměstí', at: [60, 49] },
    { text: 'Staroměstské náměstí', at: [57, 17] },
    { text: 'Malá Strana', at: [30, 29] },
  ],
};
