/**
 * PRAGUE — Prague Castle with St Vitus on Hradčany and the ~3 km around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): north-up, unrotated — NORTH is −j, EAST is +i.
 * The Castle's long south front (the famous panorama over the Malá Strana roofs) faces +j; its
 * steps open onto the Na Valech rampart terrace. The Castle sits on a hill: the slope below the
 * terrace is a band of palaces and walled gardens with no through lanes, so the only ways up are
 * the long uphill streets and stairways — Nerudova + Ke Hradu to Hradčanské náměstí (west end),
 * Zámecké schody (climbing from Thunovská, reached off Nerudova) and the Staré zámecké schody
 * (east end, from Klárov). The Stag Moat and Royal Garden lie behind (top).
 *
 * The Vltava runs north–south east of Malá Strana and bends east across the top past Josefov.
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
const NERUDOVA_J = 18.5; // Nerudova / Úvoz (j 17..19)
const KEHRADU_I = 10.5; // Ke Hradu ramp (i 9..11)
const SCHODY_I = 21.5; // Zámecké schody (i 20..22)
const UJEZD_I = 28.5; // Karmelitská / Újezd (i 27..29)
const KARLUV_J = 21; // Charles Bridge / Mostecká (j 19..22)
const MANES_J = 11; // Mánes Bridge (j 9..12)
const LEGII_J = 32.5; // Legion Bridge / Národní třída / Na Příkopě (j 31..33)

export const prague: Blueprint = {
  city: 'prague',
  name: 'Prague',
  w: 78,
  h: 72,
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
    // The Stag Moat / Royal Garden behind the Castle.
    {
      ground: 'grass',
      shape: rect(10, 0, 36, 1),
      name: 'Jelení příkop',
      trees: { kinds: ['tree.round', 'tree.pine'], density: 0.45 },
    },
    // Petřín hill (wooded) in the south-west, with its paths.
    {
      ground: 'grass',
      shape: rect(0, 24, 18, 52),
      name: 'Petřín',
      trees: { kinds: ['tree.round', 'tree.round', 'tree.pine'], density: 0.45 },
    },
    { ground: 'parkPath', shape: rect(4, 24, 4, 52) },
    { ground: 'parkPath', shape: rect(4, 40, 18, 40) },
    { ground: 'parkPath', shape: rect(13, 24, 13, 40) },
    // Kampa park on the Malá Strana bank.
    {
      ground: 'grass',
      shape: rect(35, 23, 38, 30),
      name: 'Kampa',
      trees: { kinds: ['tree.round', 'tree.plane'], density: 0.35 },
    },
    // Karlovo náměstí (park square).
    {
      ground: 'grass',
      shape: rect(52, 44, 58, 52),
      name: 'Karlovo náměstí',
      trees: { kinds: ['tree.plane', 'tree.round'], density: 0.3 },
    },
    { ground: 'parkPath', shape: rect(55, 44, 55, 52) },
    // ── Top: the Castle hill.
    // Hradčanské náměstí (west end of the Castle) and the Na Valech terrace in front of the steps.
    { ground: 'plaza', shape: rect(6, 2, 14, 11), layer: 'top', name: 'Hradčanské náměstí' },
    { ground: 'plaza', shape: rect(14, 8, 30, 11), layer: 'top', name: 'Na Valech' },
    // Gardens below the Castle: walled from the terrace (dead-end greenery on the slope).
    {
      ground: 'grass',
      shape: rect(23, 13, 29, 15),
      layer: 'top',
      name: 'Zahrady pod Pražským hradem',
      trees: { kinds: ['tree.round', 'tree.cypress'], density: 0.45 },
    },
    { ground: 'lot', shape: rect(23, 12, 30, 12), layer: 'top', reserve: true },
    // Klárov (Mánes Bridge head), Malostranské náměstí, Křižovnické náměstí.
    { ground: 'asphalt', shape: rect(35, 3, 38, 13), layer: 'top', name: 'Klárov' },
    // Na Opyši: the east gate forecourt where the Old Castle Steps arrive.
    { ground: 'plaza', shape: rect(29, 3, 30, 7), layer: 'top', name: 'Na Opyši' },
    { ground: 'plaza', shape: rect(25, 17, 32, 23), layer: 'top', name: 'Malostranské náměstí' },
    { ground: 'plaza', shape: rect(48, 17, 53, 25), layer: 'top', name: 'Křižovnické náměstí' },
    // Staroměstské náměstí (Old Town Square).
    { ground: 'cobble', shape: rect(57, 11, 66, 19), layer: 'top', name: 'Staroměstské náměstí' },
    // Střelecký ostrov (island between Charles Bridge and the Legion Bridge).
    {
      ground: 'grass',
      shape: rect(41, 25, 45, 30),
      layer: 'top',
      name: 'Střelecký ostrov',
      trees: { kinds: ['tree.round'], density: 0.4 },
    },
    // Václavské náměstí: the long sloping square with its central gardens, up to the Museum.
    { ground: 'plaza', shape: rect(60, 34, 67, 54), layer: 'top', name: 'Václavské náměstí' },
    {
      ground: 'grass',
      shape: rect(63, 37, 64, 50),
      layer: 'top',
      trees: { kinds: ['tree.plane'], density: 0.5 },
    },
    // Jiráskovo náměstí at the Dancing House.
    { ground: 'plaza', shape: rect(51, 55, 54, 60), layer: 'top', name: 'Jiráskovo náměstí' },
  ],

  rivers: [
    {
      name: 'Vltava',
      path: [
        [RIVER_I, 74],
        [RIVER_I, 6],
        [48, 1.5],
        [80, 1.5],
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
        [KEHRADU_I, 11],
        [KEHRADU_I, NERUDOVA_J],
      ],
      width: 3,
      surface: 'plaza',
      rooftops: true,
    },
    {
      name: 'Zámecké schody',
      path: [
        [SCHODY_I, 11.5],
        [SCHODY_I, 15.5],
      ],
      width: 3,
      surface: 'plaza',
      sidewalk: 0,
      rooftops: true,
    },
    {
      name: 'Thunovská',
      path: [
        [SCHODY_I, 15.5],
        [24.5, 15.5],
        [24.5, 17],
      ],
      width: 3,
      surface: 'plaza',
      sidewalk: 0,
    },
    {
      name: 'Staré zámecké schody',
      path: [
        [31, 4],
        [36, 4],
      ],
      width: 2,
      surface: 'plaza',
      sidewalk: 0,
      rooftops: true,
    },
    {
      name: 'Loretánská',
      path: [
        [-1, 6.5],
        [6, 6.5],
      ],
      width: 3,
      surface: 'plaza',
    },
    // ── Malá Strana.
    {
      name: 'Letenská',
      path: [
        [36.5, 12],
        [36.5, 17.5],
        [32, 17.5],
      ],
      width: 3,
    },
    {
      name: 'Karmelitská',
      path: [
        [UJEZD_I, 23],
        [UJEZD_I, LEGII_J],
      ],
      width: 3,
    },
    {
      name: 'Újezd',
      path: [
        [UJEZD_I, LEGII_J],
        [UJEZD_I, 73],
      ],
      width: 3,
    },
    // ── East bank.
    {
      name: 'Křižovnická',
      path: [
        [EMB_I, 6],
        [EMB_I, 17],
      ],
      width: 3,
    },
    {
      name: 'Smetanovo nábřeží',
      path: [
        [EMB_I, 24],
        [EMB_I, LEGII_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Masarykovo nábřeží',
      path: [
        [EMB_I, LEGII_J],
        [EMB_I, 54],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Rašínovo nábřeží',
      path: [
        [EMB_I, 54],
        [EMB_I, 73],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Dvořákovo nábřeží',
      path: [
        [EMB_I, 7.5],
        [79, 7.5],
      ],
      width: 3,
      trees: 'tree.plane',
      labelPath: [
        [64, 7.5],
        [76, 7.5],
      ],
    },
    // ── Staré Město & Josefov.
    {
      name: 'Karlova',
      path: [
        [53, 21],
        [57, 21],
        [57, 19],
      ],
      width: 2,
      surface: 'plaza',
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Pařížská',
      path: [
        [62.5, 7],
        [62.5, 11],
      ],
      width: 3,
      trees: 'tree.plane',
      cafes: true,
    },
    {
      name: 'Celetná',
      path: [
        [66, 17.5],
        [74, 17.5],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
      cafes: true,
    },
    {
      name: 'Melantrichova',
      path: [
        [61.5, 19],
        [61.5, 31],
      ],
      width: 3,
      surface: 'cobble',
      sidewalk: 0,
      cafes: true,
    },
    {
      name: 'Husova',
      path: [
        [56.5, 21],
        [56.5, 31],
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
        [EMB_I, 41.5],
        [60, 41.5],
      ],
      width: 3,
    },
    {
      name: 'Resslova',
      path: [
        [EMB_I, 54.5],
        [60, 54.5],
      ],
      width: 3,
    },
    {
      name: 'Ječná',
      path: [
        [55, 62.5],
        [79, 62.5],
      ],
      width: 3,
    },
    {
      name: 'Žitná',
      path: [
        [67, 46.5],
        [79, 46.5],
      ],
      width: 3,
    },
    {
      name: 'Vinohradská',
      path: [
        [66, 57.5],
        [79, 57.5],
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
    { id: 'bridgeTower', i: 50, j: 20 },
    { id: 'oldTownHall', i: 57, j: 16 },
    { id: 'tynChurch', i: 67, j: 12 },
    { id: 'dancingHouse', i: 51, j: 61 },
  ],

  capitol: { i: 15, j: 2, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Arcibiskupský palác', i: 6, j: 2, w: 4, d: 3, storeys: 3, roof: 'pitched' },
    { name: 'Schwarzenberský palác', i: 6, j: 12, w: 4, d: 4, storeys: 4, roof: 'pitched' },
    { name: 'Poslanecká sněmovna', i: 26, j: 15, w: 5, d: 2, storeys: 3, roof: 'pitched' },
    { name: 'Valdštejnský palác', i: 31, j: 13, w: 4, d: 4, storeys: 3, roof: 'pitched' },
    { name: 'Kostel sv. Mikuláše', i: 27, j: 19, w: 4, d: 3, storeys: 6, roof: 'pitched' },
    { name: 'Rudolfinum', i: 51, j: 10, w: 5, d: 4, storeys: 4, roof: 'pitched', rooftop: true },
    {
      name: 'Národní divadlo',
      i: 51,
      j: 34,
      w: 5,
      d: 4,
      storeys: 5,
      roof: 'pitched',
      rooftop: true,
    },
    { name: 'Národní muzeum', i: 60, j: 55, w: 6, d: 4, storeys: 5, roof: 'pitched' },
    { name: 'Prašná brána', i: 74, j: 15, w: 2, d: 2, storeys: 6, roof: 'pitched' },
    { name: 'Klementinum', i: 51, j: 26, w: 5, d: 4, storeys: 4, roof: 'pitched', rooftop: true },
  ],

  zones: [
    // The Castle district and the hill: palaces, no homes.
    {
      shape: rect(0, 0, 38, 17),
      storeys: [3, 4],
      residential: 0,
      kind: 'commercial',
      roofs: { pitched: 8, mansard: 1 },
    },
    // Baroque Malá Strana and the Old Town: lower, steep red roofs.
    { shape: rect(22, 17, 72, 31), storeys: [3, 4], roofs: { pitched: 9, mansard: 1 } },
    // Josefov: Art Nouveau apartment houses along Pařížská and the embankment.
    { shape: rect(50, 8, 77, 11), storeys: [4, 5], residential: 0.95, maxLen: 3 },
    // Vinohrady: tall Gründerzeit blocks.
    { shape: rect(68, 34, 77, 71), storeys: [4, 6], residential: 0.9 },
  ],

  districts: [
    {
      id: 'staremesto',
      name: 'Staré Město',
      unlockWave: 1,
      area: [51, 20, 68, 30],
      rally: [52, 23],
    },
    {
      id: 'malastrana',
      name: 'Malá Strana',
      unlockWave: 1,
      area: [23, 24, 38, 50],
      rally: [29, 38],
    },
    { id: 'josefov', name: 'Josefov', unlockWave: 2, area: [50, 5, 77, 12], rally: [62, 8] },
    { id: 'hradcany', name: 'Hradčany', unlockWave: 3, area: [0, 0, 5, 23], rally: [2, 18] },
    { id: 'novemesto', name: 'Nové Město', unlockWave: 4, area: [50, 36, 59, 71], rally: [55, 64] },
    {
      id: 'vinohrady',
      name: 'Vinohrady & Žižkov',
      unlockWave: 6,
      area: [68, 34, 77, 71],
      rally: [72, 58],
    },
  ],

  chokepoints: [
    { name: 'Zámecké schody', at: [SCHODY_I, 13], radius: 2 },
    { name: 'Nerudova', at: [25, NERUDOVA_J], radius: 2 },
    { name: 'Karlův most', at: [RIVER_I, KARLUV_J], radius: 2 },
    { name: 'Mánesův most', at: [RIVER_I, MANES_J], radius: 2 },
  ],

  approaches: [
    {
      name: 'Ke Hradu → Hradčanské náměstí',
      path: [
        [KEHRADU_I, NERUDOVA_J],
        [KEHRADU_I, 10],
        [15, 10],
      ],
      final: true,
    },
    {
      name: 'Zámecké schody',
      path: [
        [SCHODY_I, 15.5],
        [SCHODY_I, 10],
      ],
      final: true,
    },
    {
      name: 'Staré zámecké schody (from Klárov)',
      path: [
        [36, 4],
        [29.5, 4],
        [29.5, 9],
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
        [UJEZD_I, 23],
      ],
    },
  ],

  decor: [
    // The Castle: flags on the terrace, lamps.
    { kind: 'flag', at: [17, 10] },
    { kind: 'flag', at: [26, 10] },
    { kind: 'lamp', at: [14, 11] },
    { kind: 'lamp', at: [29, 11] },
    { kind: 'statue', at: [9, 7] },
    // Charles Bridge statues along the parapets.
    { kind: 'statue', at: [41, 19] },
    { kind: 'statue', at: [44, 19] },
    { kind: 'statue', at: [42, 22] },
    { kind: 'statue', at: [45, 22] },
    // Old Town Square: Jan Hus monument; Malostranské náměstí; Wenceslas on horseback.
    { kind: 'statue', at: [62, 14] },
    { kind: 'lamp', at: [26, 22] },
    { kind: 'statue.equestrian', at: [63, 52] },
    { kind: 'kiosk', at: [61, 40] },
    { kind: 'kiosk', at: [66, 46] },
    // Metro: Malostranská, Staroměstská, Můstek, Muzeum, Národní třída, Karlovo náměstí.
    { kind: 'metro', at: [38, 14] },
    { kind: 'metro', at: [54, 19] },
    { kind: 'metro', at: [60, 34] },
    { kind: 'metro', at: [66, 53] },
    { kind: 'metro', at: [58, 34] },
    { kind: 'metro', at: [52, 53] },
    // Karlovo náměstí fountain; boats on the Vltava.
    { kind: 'fountain', at: [55, 48] },
    { kind: 'boat', at: [43, 40] },
    { kind: 'boat', at: [42, 15] },
    { kind: 'boat', at: [60, 2] },
  ],

  // The Castle hill: no automatic alleys through the palaces, so the streets and stairways
  // above stay the only ways up.
  noLanes: [rect(0, 0, 38, 16)],

  labels: [
    { text: 'Hradčany', at: [2, 4] },
    { text: 'Petřín', at: [8, 32] },
    { text: 'Václavské náměstí', at: [60, 44] },
    { text: 'Staroměstské náměstí', at: [57, 12] },
    { text: 'Malá Strana', at: [30, 24] },
  ],
};
