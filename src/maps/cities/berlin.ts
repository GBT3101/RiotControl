/**
 * BERLIN — the Reichstag and the ~3 km around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): real NORTH is −i (left), EAST is −j (up), as for
 * Madrid and London. The Reichstag's west portal ("Dem Deutschen Volke") faces +j onto the
 * Platz der Republik. The Spree comes in from the east (top) along Schiffbauerdamm /
 * Reichstagufer, turns north just past the Reichstag's north-east corner (the Spreebogen, here a
 * left turn) and flows west (down) past the Paul-Löbe-Haus, the Chancellery, the Hauptbahnhof and
 * Schloss Bellevue: Moabit, Wedding and Prenzlauer Berg lie across it on the left and top-left,
 * reachable only over the Weidendammer, Marschall-, Moltke- and Lutherbrücke.
 *
 * East of the Reichstag (top): Dorotheenstraße, Wilhelmstraße and Friedrichstraße, Unter den
 * Linden running up from Pariser Platz, Gendarmenmarkt, and the Fernsehturm on Alexanderplatz at
 * the far east edge. South (right): Ebertstraße past the Brandenburg Gate to Potsdamer Platz and
 * Leipziger Straße, Kreuzberg beyond. West and south-west (bottom): the Tiergarten, cut by the
 * Straße des 17. Juni down to the Victory Column on the Großer Stern.
 *
 * The Brandenburg Gate is blocking: crowds coming down Unter den Linden squeeze round its two
 * ends on Pariser Platz. Crowds from Mitte arrive behind the Reichstag and must walk round it —
 * along Scheidemannstraße (south side) or Reichstagufer / Paul-Löbe-Allee (north side) — to
 * reach the steps.
 */
import type { Blueprint } from '../blueprint';
import { circle, poly, rect } from '../blueprint';

const FR_J = 9; // Friedrichstraße / Chausseestraße (j 7..10)
const WILH_J = 15.5; // Wilhelmstraße / Marschallbrücke / Luisenstraße (j 14..16)
const EBERT_J = 27; // Ebertstraße (j 25..28)
const LINDEN_I = 50; // Unter den Linden (i 47..52), the Gate
const MITTE_I = 50.5; // Straße des 17. Juni (i 48..52) → Victory Column
const PLA_I = 24; // Paul-Löbe-Allee (i 22..25)
const SCH_I = 38; // Scheidemannstraße (i 36..39)
const WB_J = 47; // Willy-Brandt-Straße / Moltkebrücke (j 45..48)
const JFD_J = 58.5; // John-Foster-Dulles-Allee west leg / Lutherbrücke (j 57..59)
const INV_I = 5.5; // Invalidenstraße / Alt-Moabit (i 4..6)
const STERN: readonly [number, number] = [50.5, 66.5]; // Großer Stern

export const berlin: Blueprint = {
  city: 'berlin',
  name: 'Berlin',
  w: 76,
  h: 76,
  seed: 0x6265726c,
  style: {
    roofs: { flat: 5, pitched: 3, mansard: 2 },
    storeys: [4, 5],
    residential: 0.72,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.028 },
      { kind: 'morris', p: 0.012 },
      { kind: 'busstop', p: 0.014 },
      { kind: 'bench', p: 0.01 },
      { kind: 'bike', p: 0.014 },
      { kind: 'hydrant', p: 0.006 },
      { kind: 'kiosk', p: 0.004 },
      { kind: 'bollard', p: 0.008 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.02 },
      { kind: 'bin', p: 0.012 },
      { kind: 'morris', p: 0.006 },
      { kind: 'bike', p: 0.008 },
    ],
    laneSurface: 'asphalt',
    maxBlock: 14,
  },

  areas: [
    // The Tiergarten: east part between Scheidemannstraße and Tiergartenstraße, west part down
    // to the Spree at Bellevue.
    {
      ground: 'grass',
      shape: rect(40, 29, 61, 75),
      name: 'Tiergarten',
      trees: { kinds: ['tree.oak', 'tree.round', 'tree.chestnut', 'tree.plane'], density: 0.34 },
    },
    {
      ground: 'grass',
      shape: rect(18, 53, 47, 67),
      trees: { kinds: ['tree.oak', 'tree.round', 'tree.chestnut'], density: 0.3 },
    },
    // Neuer See and the Rousseau island pond (south-west corner of the park).
    {
      ground: 'water',
      shape: poly([54, 69], [58, 68], [60, 70], [59, 73], [55, 74], [53, 72]),
      name: 'Neuer See',
    },
    {
      ground: 'water',
      shape: poly([42, 38], [45, 37], [46, 40], [43, 41]),
      name: 'Goldfischteich',
    },
    // Tiergarten paths.
    { ground: 'parkPath', shape: rect(40, 41, 61, 41) },
    { ground: 'parkPath', shape: rect(40, 55, 47, 55) },
    { ground: 'parkPath', shape: rect(53, 55, 61, 55) },
    { ground: 'parkPath', shape: rect(44, 29, 44, 63) },
    { ground: 'parkPath', shape: rect(57, 29, 57, 63) },
    { ground: 'parkPath', shape: rect(30, 60, 30, 64) },
    // Kanzlergarten behind the Chancellery.
    {
      ground: 'grass',
      shape: rect(18, 49, 25, 52),
      trees: { kinds: ['tree.round'], density: 0.2 },
    },
    // Platz der Republik: the lawn in front of the Reichstag with a central path.
    { ground: 'grass', shape: rect(26, 37, 35, 44), name: 'Platz der Republik' },
    { ground: 'parkPath', shape: rect(30, 37, 31, 44) },
    // --- Top layer: squares.
    // Forecourt below the west portal.
    { ground: 'plaza', shape: rect(26, 33, 35, 36), layer: 'top', name: 'Platz der Republik' },
    // Pariser Platz east of the Gate (the Gate itself is placed on top).
    { ground: 'plaza', shape: rect(44, 17, 55, 24), layer: 'top', name: 'Pariser Platz' },
    // Platz des 18. März west of the Gate.
    { ground: 'plaza', shape: rect(45, 25, 54, 28), layer: 'top', name: 'Platz des 18. März' },
    // Alexanderplatz under the TV tower (far east edge).
    { ground: 'plaza', shape: rect(25, 0, 32, 5), layer: 'top', name: 'Alexanderplatz' },
    // Gendarmenmarkt.
    { ground: 'plaza', shape: rect(55, 0, 62, 5), layer: 'top', name: 'Gendarmenmarkt' },
    // Potsdamer Platz junction.
    { ground: 'plaza', shape: rect(62, 29, 68, 32), layer: 'top', name: 'Potsdamer Platz' },
    // Großer Stern roundabout around the Victory Column.
    { ground: 'asphalt', shape: circle(STERN[0], STERN[1], 6), layer: 'top', name: 'Großer Stern' },
    { ground: 'plaza', shape: circle(STERN[0], STERN[1], 3), layer: 'top' },
  ],

  rivers: [
    {
      name: 'Spree',
      path: [
        [22, -1],
        [22, 20],
        [15, 20],
        [15, 77],
      ],
      width: 4,
      quay: 1,
    },
  ],

  roads: [
    // ── North bank: Prenzlauer Berg, Wedding, Moabit.
    {
      name: 'Chausseestraße',
      path: [
        [-1, FR_J],
        [10, FR_J],
      ],
      width: 4,
    },
    {
      name: 'Torstraße',
      path: [
        [9.5, -1],
        [9.5, 7],
      ],
      width: 3,
    },
    {
      name: 'Invalidenstraße',
      path: [
        [INV_I, -1],
        [INV_I, WB_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Alt-Moabit',
      path: [
        [INV_I, WB_J],
        [INV_I, 77],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Luisenstraße',
      path: [
        [INV_I, WILH_J],
        [19, WILH_J],
      ],
      width: 3,
    },
    {
      name: 'Schiffbauerdamm',
      path: [
        [17.5, FR_J],
        [17.5, 16],
      ],
      width: 3,
      cafes: true,
    },
    // ── Mitte, east of the Reichstag.
    {
      name: 'Friedrichstraße',
      path: [
        [10, FR_J],
        [77, FR_J],
      ],
      width: 4,
      trees: null,
      cafes: true,
      labelPath: [
        [53, FR_J],
        [63, FR_J],
      ],
    },
    {
      name: 'Wilhelmstraße',
      path: [
        [26, WILH_J],
        [77, WILH_J],
      ],
      width: 3,
      rooftops: true,
      labelPath: [
        [53, WILH_J],
        [63, WILH_J],
      ],
    },
    {
      name: 'Reichstagufer',
      path: [
        [27.5, -1],
        [27.5, 23.5],
        [22, 23.5],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: true,
      labelPath: [
        [27.5, 10],
        [27.5, 20],
      ],
    },
    {
      name: 'Dorotheenstraße',
      path: [
        [37.5, -1],
        [37.5, 26],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Unter den Linden',
      path: [
        [LINDEN_I, -1],
        [LINDEN_I, 17],
      ],
      width: 6,
      trees: 'tree.round',
      storeyBonus: 1,
    },
    {
      name: 'Leipziger Straße',
      path: [
        [66, -1],
        [66, 28],
      ],
      width: 4,
      storeyBonus: 1,
    },
    {
      name: 'Ebertstraße',
      path: [
        [36, EBERT_J],
        [77, EBERT_J],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    // ── The Reichstag's sides and the Platz der Republik.
    {
      name: 'Scheidemannstraße',
      path: [
        [SCH_I, 25],
        [SCH_I, 49],
      ],
      width: 4,
      trees: 'tree.plane',
      rooftops: false,
    },
    {
      name: 'Paul-Löbe-Allee',
      path: [
        [PLA_I, 23],
        [PLA_I, 49],
      ],
      width: 4,
      trees: null,
      rooftops: true,
    },
    {
      name: 'Willy-Brandt-Straße',
      path: [
        [18, WB_J],
        [36, WB_J],
      ],
      width: 4,
      trees: 'tree.plane',
    },
    // ── Tiergarten.
    {
      name: 'Straße des 17. Juni',
      path: [
        [MITTE_I, 28],
        [MITTE_I, 77],
      ],
      width: 5,
      trees: 'tree.round',
      rooftops: false,
      labelPath: [
        [MITTE_I, 36],
        [MITTE_I, 56],
      ],
    },
    {
      name: 'John-Foster-Dulles-Allee',
      path: [
        [38.5, 48],
        [38.5, JFD_J],
        [18, JFD_J],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: false,
    },
    {
      name: 'Spreeweg',
      path: [
        [24.5, 59],
        [24.5, 66.5],
        [45, 66.5],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: false,
    },
    {
      name: 'Tiergartenstraße',
      path: [
        [63.5, 28],
        [63.5, 77],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    {
      name: 'Hofjägerallee',
      path: [
        [56, 66.5],
        [63, 66.5],
      ],
      width: 3,
      trees: 'tree.plane',
      rooftops: false,
    },
    {
      name: 'Altonaer Straße',
      path: [
        [STERN[0] - 3.5, 70],
        [36, 77],
      ],
      width: 3,
    },
  ],

  bridges: [
    {
      name: 'Weidendammer Brücke',
      path: [
        [18, FR_J],
        [26, FR_J],
      ],
      width: 4,
    },
    {
      name: 'Marschallbrücke',
      path: [
        [18, WILH_J],
        [26, WILH_J],
      ],
      width: 3,
    },
    {
      name: 'Moltkebrücke',
      path: [
        [INV_I + 1.5, WB_J],
        [19, WB_J],
      ],
      width: 4,
    },
    {
      name: 'Lutherbrücke',
      path: [
        [INV_I + 1.5, JFD_J],
        [19, JFD_J],
      ],
      width: 3,
    },
  ],

  landmarks: [
    { id: 'brandenburgGate', i: 47, j: 23 },
    { id: 'victoryColumn', i: 49, j: 65 },
    { id: 'tvTower', i: 26, j: 0 },
  ],

  capitol: { i: 26, j: 25, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Paul-Löbe-Haus', i: 18, j: 25, w: 4, d: 6, storeys: 5, roof: 'flat', rooftop: true },
    { name: 'Paul-Löbe-Haus', i: 18, j: 32, w: 4, d: 6, storeys: 5, roof: 'flat', rooftop: true },
    { name: 'Bundeskanzleramt', i: 18, j: 49, w: 6, d: 4, storeys: 6, roof: 'flat', rooftop: true },
    {
      name: 'Jakob-Kaiser-Haus',
      i: 29,
      j: 17,
      w: 6,
      d: 4,
      storeys: 5,
      roof: 'flat',
      rooftop: true,
    },
    { name: 'Schweizer Botschaft', i: 27, j: 49, w: 3, d: 3, storeys: 3, roof: 'mansard' },
    { name: 'Haus der Kulturen der Welt', i: 30, j: 51, w: 6, d: 4, storeys: 3, roof: 'flat' },
    { name: 'Schloss Bellevue', i: 18, j: 61, w: 5, d: 4, storeys: 3, roof: 'mansard' },
    { name: 'Hauptbahnhof', i: 6, j: 39, w: 6, d: 4, storeys: 4, roof: 'flat' },
    { name: 'Hotel Adlon', i: 56, j: 17, w: 4, d: 4, storeys: 6, roof: 'mansard', rooftop: true },
    { name: 'Akademie der Künste', i: 56, j: 21, w: 4, d: 3, storeys: 5, roof: 'flat' },
    { name: 'Konzerthaus', i: 57, j: 1, w: 4, d: 3, storeys: 4, roof: 'pitched' },
    { name: 'Berliner Ensemble', i: 13, j: 11, w: 3, d: 3, storeys: 4, roof: 'pitched' },
    { name: 'Philharmonie', i: 66, j: 34, w: 5, d: 4, storeys: 4, roof: 'pitched' },
  ],

  zones: [
    // Government quarter around the Reichstag: stone and glass, never spawn buildings.
    {
      shape: rect(17, 17, 46, 56),
      storeys: [4, 6],
      residential: 0.1,
      kind: 'commercial',
      roofs: { flat: 6, mansard: 1 },
    },
    // Friedrichstadt: tall stone office blocks.
    {
      shape: rect(53, 0, 75, 24),
      storeys: [5, 6],
      residential: 0.55,
      roofs: { flat: 4, mansard: 2 },
    },
    // Friedrichshain edge: Plattenbau slabs.
    { shape: rect(32, 0, 46, 6), storeys: [5, 6], residential: 0.95, roofs: { flat: 1 } },
    // Moabit, Wedding, Prenzlauer Berg: Altbau tenements.
    {
      shape: rect(0, 0, 11, 75),
      storeys: [4, 5],
      residential: 0.92,
      roofs: { pitched: 4, flat: 3, mansard: 1 },
    },
    { shape: rect(0, 0, 17, 13), storeys: [4, 5], residential: 0.92 },
    // Kreuzberg / Tiergarten-Süd: Altbau, a little lower.
    { shape: rect(65, 33, 75, 75), storeys: [4, 5], residential: 0.85 },
  ],

  districts: [
    {
      id: 'kreuzberg',
      name: 'Kreuzberg',
      unlockWave: 1,
      area: [68, 0, 75, 24],
      rally: [72, WILH_J],
    },
    { id: 'moabit', name: 'Moabit', unlockWave: 1, area: [0, 50, 11, 75], rally: [5, 62] },
    { id: 'mitte', name: 'Mitte', unlockWave: 2, area: [53, 0, 63, 24], rally: [57, WILH_J] },
    { id: 'wedding', name: 'Wedding', unlockWave: 3, area: [0, 17, 11, 37], rally: [5, 26] },
    {
      id: 'prenzlauerberg',
      name: 'Prenzlauer Berg',
      unlockWave: 4,
      area: [0, 0, 16, 13],
      rally: [9, 3],
    },
    {
      id: 'friedrichshain',
      name: 'Friedrichshain',
      unlockWave: 6,
      area: [33, 0, 46, 6],
      rally: [42, FR_J],
    },
  ],

  chokepoints: [
    { name: 'Marschallbrücke', at: [21, WILH_J], radius: 2 },
    { name: 'Moltkebrücke', at: [14, WB_J], radius: 2 },
    { name: 'Brandenburger Tor', at: [54, 24], radius: 2 },
  ],

  approaches: [
    {
      name: 'Scheidemannstraße',
      path: [
        [SCH_I, EBERT_J],
        [SCH_I, 34],
        [35, 34],
      ],
      final: true,
    },
    {
      name: 'Paul-Löbe-Allee',
      path: [
        [PLA_I, WB_J],
        [PLA_I, 34],
        [26, 34],
      ],
      final: true,
    },
    {
      name: 'Platz der Republik',
      path: [
        [30.5, WB_J - 1],
        [30.5, 36],
      ],
      final: true,
    },
    {
      name: 'Unter den Linden → Brandenburger Tor',
      path: [
        [LINDEN_I, 2],
        [LINDEN_I, 20],
        [45, 22],
        [45, EBERT_J],
        [SCH_I, EBERT_J],
      ],
    },
    {
      name: 'Ebertstraße (Potsdamer Platz)',
      path: [
        [66, EBERT_J],
        [SCH_I, EBERT_J],
      ],
    },
    {
      name: 'Moltkebrücke',
      path: [
        [INV_I, WB_J],
        [PLA_I, WB_J],
      ],
    },
    {
      name: 'Marschallbrücke → Reichstagufer',
      path: [
        [INV_I, WILH_J],
        [27.5, WILH_J],
        [27.5, 23.5],
        [PLA_I, 23.5],
      ],
    },
  ],

  decor: [
    // Forecourt: flags, the Bundestag U-Bahn.
    { kind: 'flag', at: [27, 35] },
    { kind: 'flag', at: [34, 35] },
    { kind: 'metro', at: [36, 44] },
    // Pariser Platz / Gate: Ampelmännchen lights, U-Bahn, a souvenir kiosk.
    { kind: 'metro', at: [45, 19] },
    { kind: 'trafficlight', at: [44, 25] },
    { kind: 'trafficlight', at: [55, 25] },
    { kind: 'kiosk', at: [54, 18] },
    // Friedrichstraße & Linden.
    { kind: 'metro', at: [46, 7] },
    { kind: 'trafficlight', at: [46, 11] },
    { kind: 'trafficlight', at: [53, 11] },
    { kind: 'trafficlight', at: [39, 24] },
    { kind: 'trafficlight', at: [35, 13] },
    { kind: 'morris', at: [53, 6] },
    // Alexanderplatz: Weltzeituhr-ish column, kiosks.
    { kind: 'statue', at: [31, 2] },
    { kind: 'kiosk', at: [25, 4] },
    { kind: 'kiosk', at: [31, 5] },
    // Gendarmenmarkt: Schiller.
    { kind: 'statue', at: [56, 2] },
    // Potsdamer Platz: U-Bahn + traffic-light tower.
    { kind: 'metro', at: [62, 30] },
    { kind: 'trafficlight', at: [68, 29] },
    // Hauptbahnhof, Moabit, Wedding.
    { kind: 'metro', at: [7, 44] },
    { kind: 'kiosk', at: [7, 48] },
    { kind: 'kiosk', at: [3, 20] },
    { kind: 'metro', at: [7, 6] },
    // Spree tour boats.
    { kind: 'boat', at: [21, 5] },
    { kind: 'boat', at: [14, 32] },
    { kind: 'boat', at: [14, 66] },
    { kind: 'boat', at: [55, 71] },
  ],

  noLanes: [rect(17, 17, 46, 50), rect(40, 16, 63, 26)],

  labels: [
    { text: 'Tiergarten', at: [56, 46] },
    { text: 'Moabit', at: [5, 71] },
  ],
};
