/**
 * VIENNA — the Parlament on the Ringstraße and the ~2.5 km around it, condensed.
 *
 * Orientation (viewer: i → right, j → down): real NORTH is +i (right), EAST is +j (down) — a pure
 * 90° clockwise rotation, topology preserved. The Parlament fronts the Dr.-Karl-Renner-Ring with
 * its ramp and Athena fountain facing +j (real east). The Ring is drawn as the big U it is
 * around the Innere Stadt: its west leg runs along i in front of the Parlament (Burgring →
 * Dr.-Karl-Renner-Ring → Universitätsring), the Opernring turns along j at the left (real south),
 * and the Schottenring / Franz-Josefs-Kai closes it on the right along the Donaukanal (real
 * north-east). Outside the Ring, behind the Parlament (top): Schmerlingplatz, the museums on
 * Maria-Theresien-Platz, Josefstadt, Neubau, Mariahilf (Mariahilfer Straße) and Alsergrund
 * (University, Votivkirche). Inside: the Volksgarten (fenced, gated) directly across the Ring,
 * the Heldenplatz with the Neue Burg, the Burgtheater opposite the Rathaus, Ballhausplatz,
 * Michaelerplatz, Herrengasse, Kohlmarkt, Graben and Stephansplatz with the Stephansdom;
 * Wieden and Karlsplatz lie beyond the Opernring (left).
 *
 * The barrier is the Ring itself plus the Hofburg / Volksgarten park mass: the Innere Stadt
 * reaches the Parlament only through the Volksgarten gates, the Burgtor, Löwelstraße or round
 * the Ring; the outer districts come round the Parlament's flanks (Stadiongasse to the north,
 * Schmerlingplatz to the south) or down the Ring.
 */
import type { Blueprint } from '../blueprint';
import { rect } from '../blueprint';

const OPER_I = 18.5; // Opernring / Kärntner Ring (i 15..21)
const RING_J = 28.5; // west leg of the Ring (j 25..31)
const SCHOTT_I = 66.5; // Schottenring / Franz-Josefs-Kai (i 63..69)
const KANAL_I = 74.5; // Donaukanal (water i 71..77)
const AUERS_J = 7.5; // Auerspergstraße / Landesgerichtsstraße (j 6..8)
const REICHS_J = 11.5; // Reichsratsstraße behind the Parlament (j 10..12)
const MUSEUM_I = 33; // Museumstraße (i 32..34)
const STADION_I = 51; // Stadiongasse (i 50..52)
const LOEWEL_I = 51; // Löwelstraße (inside the Ring, same axis)
const HERREN_J = 52.5; // Herrengasse (j 51..53)
const KAERNTNER_J = 63.5; // Kärntner Straße (j 62..64)

export const vienna: Blueprint = {
  city: 'vienna',
  name: 'Vienna',
  w: 80,
  h: 72,
  seed: 0x7769656e,
  style: {
    roofs: { pitched: 5, mansard: 2, terrace: 2, flat: 1 },
    storeys: [4, 5],
    residential: 0.72,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.03 },
      { kind: 'bench', p: 0.012 },
      { kind: 'busstop', p: 0.014 },
      { kind: 'kiosk', p: 0.008 },
      { kind: 'hydrant', p: 0.006 },
      { kind: 'bollard', p: 0.01 },
      { kind: 'planter', p: 0.008 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.025 },
      { kind: 'bin', p: 0.012 },
      { kind: 'planter', p: 0.008 },
    ],
    laneSurface: 'asphalt',
    maxBlock: 13,
  },

  areas: [
    // ── Base: parks.
    {
      ground: 'grass',
      shape: rect(38, 32, 49, 41),
      name: 'Volksgarten',
      trees: { kinds: ['tree.round', 'tree.chestnut'], density: 0.3 },
    },
    { ground: 'parkPath', shape: rect(43, 33, 44, 41) },
    { ground: 'parkPath', shape: rect(39, 37, 48, 37) },
    {
      ground: 'grass',
      shape: rect(22, 32, 28, 41),
      name: 'Burggarten',
      trees: { kinds: ['tree.round', 'tree.chestnut'], density: 0.4 },
    },
    { ground: 'parkPath', shape: rect(22, 36, 28, 36) },
    {
      ground: 'grass',
      shape: rect(29, 32, 37, 41),
      name: 'Heldenplatz',
      trees: { kinds: ['tree.round'], density: 0.05 },
    },
    {
      ground: 'grass',
      shape: rect(53, 21, 62, 24),
      name: 'Rathauspark',
      trees: { kinds: ['tree.plane', 'tree.round'], density: 0.35 },
    },
    {
      ground: 'grass',
      shape: rect(72, 13, 79, 24),
      name: 'Sigmund-Freud-Park',
      trees: { kinds: ['tree.round'], density: 0.3 },
    },
    { ground: 'parkPath', shape: rect(72, 18, 79, 18) },
    {
      ground: 'grass',
      shape: rect(0, 50, 7, 58),
      name: 'Resselpark',
      trees: { kinds: ['tree.round', 'tree.plane'], density: 0.3 },
    },
    // ── Top: squares.
    // Heldenplatz: the parade ground in front of the Neue Burg, and the Burgtor in its railing.
    { ground: 'plaza', shape: rect(29, 37, 37, 41), layer: 'top' },
    { ground: 'lot', shape: rect(22, 32, 37, 32), layer: 'top', reserve: true },
    { ground: 'plaza', shape: rect(32, 32, 34, 32), layer: 'top', name: 'Äußeres Burgtor' },
    { ground: 'parkPath', shape: rect(25, 32, 25, 32), layer: 'top' },
    // Volksgarten railings, with gates on the Ring, Ballhausplatz and Löwelstraße.
    { ground: 'lot', shape: rect(38, 32, 49, 32), layer: 'top', reserve: true },
    { ground: 'lot', shape: rect(38, 32, 38, 41), layer: 'top', reserve: true },
    { ground: 'lot', shape: rect(49, 32, 49, 41), layer: 'top', reserve: true },
    { ground: 'parkPath', shape: rect(43, 32, 44, 32), layer: 'top' },
    { ground: 'parkPath', shape: rect(43, 41, 44, 41), layer: 'top' },
    { ground: 'parkPath', shape: rect(49, 37, 49, 37), layer: 'top' },
    // The Parlament's forecourt (ramp + Athena fountain) and Schmerlingplatz.
    { ground: 'plaza', shape: rect(36, 22, 52, 24), layer: 'top', name: 'Pallas-Athene-Brunnen' },
    { ground: 'plaza', shape: rect(35, 13, 37, 24), layer: 'top', name: 'Schmerlingplatz' },
    { ground: 'plaza', shape: rect(53, 19, 62, 20), layer: 'top', name: 'Rathausplatz' },
    { ground: 'plaza', shape: rect(19, 13, 27, 24), layer: 'top', name: 'Maria-Theresien-Platz' },
    { ground: 'grass', shape: rect(21, 15, 25, 17), layer: 'top' },
    { ground: 'grass', shape: rect(21, 20, 25, 22), layer: 'top' },
    // Inside the Ring.
    { ground: 'plaza', shape: rect(39, 42, 45, 44), layer: 'top', name: 'Ballhausplatz' },
    { ground: 'plaza', shape: rect(46, 46, 49, 49), layer: 'top', name: 'Minoritenplatz' },
    { ground: 'cobble', shape: rect(30, 48, 35, 51), layer: 'top', name: 'Michaelerplatz' },
    { ground: 'cobble', shape: rect(56, 54, 61, 58), layer: 'top', name: 'Freyung' },
    { ground: 'plaza', shape: rect(38, 64, 50, 71), layer: 'top', name: 'Stephansplatz' },
    { ground: 'plaza', shape: rect(57, 63, 62, 68), layer: 'top', name: 'Schwedenplatz' },
    // Karlsplatz (beyond the Opernring).
    { ground: 'plaza', shape: rect(0, 59, 7, 66), layer: 'top', name: 'Karlsplatz' },
    { ground: 'water', shape: rect(2, 61, 5, 62), layer: 'top' },
    // The far bank of the canal (Leopoldstadt) is out of the picture: water to the map edge.
    { ground: 'water', shape: rect(78, 32, 79, 71), layer: 'top' },
  ],

  rivers: [
    {
      name: 'Donaukanal',
      path: [
        [83, 23.5],
        [KANAL_I, 32],
        [KANAL_I, 75],
      ],
      width: 7,
      quay: 1,
    },
  ],

  roads: [
    // ── The Ringstraße (west leg along i, Opernring along j at the left, Schottenring at the right).
    {
      name: 'Burgring',
      path: [
        [15, RING_J],
        [38, RING_J],
      ],
      width: 7,
      trees: 'tree.plane',
      storeyBonus: 1,
    },
    {
      name: 'Dr.-Karl-Renner-Ring',
      path: [
        [38, RING_J],
        [53, RING_J],
      ],
      width: 7,
      trees: 'tree.plane',
      storeyBonus: 1,
    },
    {
      name: 'Universitätsring',
      path: [
        [53, RING_J],
        [70, RING_J],
      ],
      width: 7,
      trees: 'tree.plane',
      storeyBonus: 1,
    },
    {
      name: 'Opernring',
      path: [
        [OPER_I, 25],
        [OPER_I, 50],
      ],
      width: 7,
      trees: 'tree.plane',
      storeyBonus: 1,
      labelPath: [
        [OPER_I, 36],
        [OPER_I, 48],
      ],
    },
    {
      name: 'Kärntner Ring',
      path: [
        [OPER_I, 50],
        [OPER_I, 73],
      ],
      width: 7,
      trees: 'tree.plane',
      storeyBonus: 1,
    },
    {
      name: 'Schottenring',
      path: [
        [SCHOTT_I, 25],
        [SCHOTT_I, 44],
      ],
      width: 7,
      trees: 'tree.plane',
      storeyBonus: 1,
    },
    {
      name: 'Franz-Josefs-Kai',
      path: [
        [SCHOTT_I, 44],
        [SCHOTT_I, 73],
      ],
      width: 5,
      trees: 'tree.plane',
    },
    // ── Behind the Parlament.
    {
      name: 'Reichsratsstraße',
      path: [
        [MUSEUM_I, REICHS_J],
        [STADION_I, REICHS_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Auerspergstraße',
      path: [
        [14, AUERS_J],
        [STADION_I, AUERS_J],
      ],
      width: 3,
    },
    {
      name: 'Landesgerichtsstraße',
      path: [
        [STADION_I, AUERS_J],
        [72, AUERS_J],
      ],
      width: 3,
    },
    {
      name: 'Stadiongasse',
      path: [
        [STADION_I, AUERS_J],
        [STADION_I, 25],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Museumstraße',
      path: [
        [MUSEUM_I, -1],
        [MUSEUM_I, 25],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Universitätsstraße',
      path: [
        [64.5, AUERS_J],
        [64.5, 25],
      ],
      width: 3,
    },
    {
      name: 'Alser Straße',
      path: [
        [64.5, -1],
        [64.5, AUERS_J],
      ],
      width: 3,
    },
    {
      name: 'Währinger Straße',
      path: [
        [71, -1],
        [71, 25],
      ],
      width: 4,
    },
    {
      name: 'Josefstädter Straße',
      path: [
        [57.5, -1],
        [57.5, AUERS_J],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Lerchenfelder Straße',
      path: [
        [42.5, -1],
        [42.5, AUERS_J],
      ],
      width: 3,
    },
    {
      name: 'Burggasse',
      path: [
        [25.5, -1],
        [25.5, 12],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Mariahilfer Straße',
      path: [
        [14, 22],
        [9.5, 10],
        [6.5, -1],
      ],
      width: 4,
      trees: null,
      cafes: true,
      labelPath: [
        [9.5, 10],
        [6.5, 0],
      ],
    },
    // ── Inside the Ring.
    {
      name: 'Löwelstraße',
      path: [
        [LOEWEL_I, 32],
        [LOEWEL_I, 46],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Herrengasse',
      path: [
        [35, HERREN_J],
        [62, HERREN_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Kohlmarkt',
      path: [
        [35, 51.5],
        [41.5, 58],
      ],
      width: 2,
      surface: 'cobble',
      cafes: true,
    },
    {
      name: 'Graben',
      path: [
        [41, 57],
        [41, 64],
      ],
      width: 4,
      surface: 'plaza',
      sidewalk: 0,
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Kärntner Straße',
      path: [
        [22, KAERNTNER_J],
        [38, KAERNTNER_J],
      ],
      width: 3,
      surface: 'plaza',
      sidewalk: 0,
      cafes: true,
      rooftops: true,
    },
    {
      name: 'Rotenturmstraße',
      path: [
        [50, 67.5],
        [63, 67.5],
      ],
      width: 3,
    },
    {
      name: 'Wollzeile',
      path: [
        [44.5, 71],
        [44.5, 73],
      ],
      width: 2,
    },
    {
      name: 'Schottengasse',
      path: [
        [61.5, 32],
        [61.5, 54],
      ],
      width: 3,
    },
    // ── Wieden & Karlsplatz.
    {
      name: 'Wiedner Hauptstraße',
      path: [
        [-1, 58.5],
        [15, 58.5],
      ],
      width: 3,
    },
    {
      name: 'Operngasse',
      path: [
        [-1, 44.5],
        [15, 44.5],
      ],
      width: 3,
    },
    {
      name: 'Getreidemarkt',
      path: [
        [0, 30.5],
        [15, 30.5],
      ],
      width: 3,
    },
  ],

  bridges: [],

  landmarks: [
    { id: 'rathaus', i: 53, j: 13 },
    { id: 'hofburg', i: 24, j: 42 },
    { id: 'stephansdom', i: 41, j: 66 },
  ],

  capitol: { i: 38, j: 13, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Burgtheater', i: 54, j: 33, w: 6, d: 4, storeys: 4, roof: 'pitched', rooftop: true },
    {
      name: 'Kunsthistorisches Museum',
      i: 15,
      j: 14,
      w: 4,
      d: 6,
      storeys: 4,
      roof: 'pitched',
    },
    { name: 'Naturhistorisches Museum', i: 28, j: 14, w: 4, d: 6, storeys: 4, roof: 'pitched' },
    {
      name: 'Universität Wien',
      i: 66,
      j: 19,
      w: 4,
      d: 4,
      storeys: 4,
      roof: 'pitched',
      rooftop: true,
    },
    { name: 'Votivkirche', i: 73, j: 6, w: 6, d: 4, storeys: 6, roof: 'pitched' },
    { name: 'Bundeskanzleramt', i: 39, j: 45, w: 6, d: 3, storeys: 4, roof: 'pitched' },
    { name: 'Staatsoper', i: 22, j: 57, w: 4, d: 5, storeys: 5, roof: 'pitched', rooftop: true },
    { name: 'Karlskirche', i: 1, j: 67, w: 6, d: 4, storeys: 6, roof: 'pitched' },
    { name: 'Schottenkirche', i: 57, j: 59, w: 4, d: 3, storeys: 5, roof: 'pitched' },
    { name: 'MuseumsQuartier', i: 9, j: 15, w: 4, d: 5, storeys: 3, roof: 'flat' },
  ],

  zones: [
    // Ring palaces and ministries around the Parlament, the Hofburg and the Graben: never homes.
    {
      shape: rect(15, 9, 70, 50),
      storeys: [4, 5],
      residential: 0.1,
      kind: 'commercial',
      roofs: { pitched: 3, mansard: 2, flat: 2 },
    },
    // Biedermeier Josefstadt & Spittelberg: lower.
    { shape: rect(16, 0, 63, 8), storeys: [3, 4], residential: 0.9 },
  ],

  districts: [
    { id: 'neubau', name: 'Neubau', unlockWave: 1, area: [14, 0, 35, 11], rally: [19, 3] },
    { id: 'wieden', name: 'Wieden', unlockWave: 1, area: [0, 32, 14, 71], rally: [7, 45] },
    { id: 'josefstadt', name: 'Josefstadt', unlockWave: 2, area: [44, 0, 62, 5], rally: [57, 2] },
    { id: 'alsergrund', name: 'Alsergrund', unlockWave: 3, area: [63, 0, 79, 11], rally: [71, 2] },
    {
      id: 'innerestadt',
      name: 'Innere Stadt',
      unlockWave: 4,
      area: [50, 50, 62, 71],
      rally: [56, 67],
    },
    { id: 'mariahilf', name: 'Mariahilf', unlockWave: 6, area: [0, 0, 13, 28], rally: [7, 8] },
  ],

  chokepoints: [
    { name: 'Stadiongasse', at: [STADION_I, 17], radius: 2 },
    { name: 'Schmerlingplatz', at: [36, 17], radius: 2 },
    { name: 'Löwelstraße', at: [LOEWEL_I, 38], radius: 2 },
  ],

  approaches: [
    {
      name: 'Stadiongasse',
      path: [
        [STADION_I, AUERS_J],
        [STADION_I, 23],
      ],
      final: true,
    },
    {
      name: 'Schmerlingplatz',
      path: [
        [36, REICHS_J],
        [36, 23],
      ],
      final: true,
    },
    {
      name: 'Dr.-Karl-Renner-Ring (from the Volksgarten)',
      path: [
        [43.5, 41],
        [43.5, 25],
      ],
      final: true,
    },
    {
      name: 'Universitätsring',
      path: [
        [SCHOTT_I, RING_J],
        [53, RING_J],
      ],
    },
    {
      name: 'Burgring',
      path: [
        [OPER_I, RING_J],
        [38, RING_J],
      ],
    },
    {
      name: 'Löwelstraße',
      path: [
        [LOEWEL_I, 46],
        [LOEWEL_I, 32],
      ],
    },
    {
      name: 'Opernring',
      path: [
        [OPER_I, 50],
        [OPER_I, RING_J],
      ],
    },
  ],

  decor: [
    // The Parlament: Pallas Athene fountain on the forecourt, the Rossebändiger on the ramp, flags.
    { kind: 'fountain', at: [44, 23] },
    { kind: 'statue.equestrian', at: [38, 23] },
    { kind: 'statue.equestrian', at: [49, 23] },
    { kind: 'flag', at: [41, 22] },
    { kind: 'flag', at: [47, 22] },
    // Heldenplatz: Prince Eugene and Archduke Charles; Burggarten: Mozart.
    { kind: 'statue.equestrian', at: [31, 39] },
    { kind: 'statue.equestrian', at: [36, 39] },
    { kind: 'statue', at: [25, 34] },
    // Volksgarten: Theseus temple, fountain.
    { kind: 'statue', at: [41, 35] },
    { kind: 'fountain', at: [46, 39] },
    // Maria-Theresien-Platz.
    { kind: 'statue', at: [23, 19] },
    // Rathausplatz, Schmerlingplatz, Ballhausplatz, Michaelerplatz, Freyung.
    { kind: 'lamp', at: [55, 20] },
    { kind: 'lamp', at: [60, 20] },
    { kind: 'statue', at: [36, 15] },
    { kind: 'flag', at: [42, 43] },
    { kind: 'fountain', at: [33, 50] },
    { kind: 'fountain', at: [58, 56] },
    // U-Bahn: Stephansplatz, Karlsplatz, Volkstheater, Schottentor, Schwedenplatz, Herrengasse.
    { kind: 'metro', at: [48, 65] },
    { kind: 'metro', at: [6, 64] },
    { kind: 'metro', at: [31, 23] },
    { kind: 'metro', at: [69, 24] },
    { kind: 'metro', at: [60, 66] },
    { kind: 'metro', at: [45, 51] },
    // Karlsplatz pond; Stephansplatz kiosks; boats on the canal.
    { kind: 'kiosk', at: [39, 69] },
    { kind: 'kiosk', at: [62, 64] },
    { kind: 'boat', at: [74, 40] },
    { kind: 'boat', at: [75, 60] },
  ],

  // The Parlament's flanks and the park mass: no automatic alleys, so Stadiongasse and
  // Schmerlingplatz stay the only ways round the building and the Volksgarten stays a wall.
  noLanes: [rect(30, 9, 56, 47)],

  labels: [
    { text: 'Volksgarten', at: [40, 34] },
    { text: 'Heldenplatz', at: [30, 34] },
    { text: 'Innere Stadt', at: [50, 58] },
    { text: 'Donaukanal', at: [74, 50] },
  ],
};
