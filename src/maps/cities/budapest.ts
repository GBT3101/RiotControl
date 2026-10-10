/**
 * BUDAPEST — the Országház (Hungarian Parliament) and the ~2.5 km around it, condensed.
 * Level 1 of the Europe campaign: hosts the tutorial, so the layout is deliberately readable.
 *
 * Orientation (viewer: i → right, j → down): real NORTH is +i (right), EAST is +j (down) — a pure
 * 90° clockwise rotation, topology preserved. The Danube flows along i behind the Parliament
 * (top); the Parliament's long river front runs north–south along i, and its main (east) front
 * faces +j onto Kossuth Lajos tér. Buda lies across the river at the top: Buda Castle and the
 * Fisherman's Bastion on the Castle Hill (top-left), Víziváros along Fő utca, Rózsadomb beyond
 * Margit körút (top-right). Only two bridges cross: the Chain Bridge (left, landing on
 * Széchenyi István tér, aligned with Zrínyi utca and St Stephen's Basilica) and Margaret Bridge
 * (right, continuing straight into the Nagykörút, Margaret Island just north of it).
 *
 * Pest: Kossuth tér is closed on its east side by the Kúria and the Ministry of Agriculture, so
 * crowds reach the steps by three readable approaches — Alkotmány utca (east, the first-wave
 * street and the tutorial chokepoint), Nádor utca (south, from Széchenyi tér and the Chain
 * Bridge) and Falk Miksa / Balassi Bálint utca (north, from the Nagykörút and Margaret Bridge).
 * Bajcsy-Zsilinszky út runs north–south from Deák tér to Nyugati; Andrássy út and the Teréz
 * körút meet at the Oktogon (bottom right); Király utca crosses Erzsébetváros (bottom left).
 */
import type { Blueprint } from '../blueprint';
import { circle, rect } from '../blueprint';

const FO_J = 8.5; // Fő utca, Buda (j 7..9)
const RIVER_J = 14.5; // Danube centre (water j 11..17, quays 10 & 18)
const RAK_J = 20.5; // Pest embankment (j 19..21)
const CB_I = 18; // Chain Bridge / Zrínyi utca axis (i 16..19)
const MB_I = 64.5; // Margaret Bridge / Szent István körút axis (i 62..66)
const ALK_I = 36; // Alkotmány utca (i 34..37)
const NADOR_J = 31.5; // Nádor utca (j 30..32)
const HONVED_J = 43.5; // Honvéd utca (j 42..44)
const BZ_J = 51.5; // Bajcsy-Zsilinszky út / Váci út (j 49..53)
const JA_I = 10; // József Attila utca (i 8..11)
// Andrássy út and the Teréz körút are exact 45° diagonals (clean staircases) meeting at the Oktogon.
const NYUGATI: readonly [number, number] = [61, 51.5];
const ANDRASSY0: readonly [number, number] = [28, 51.5];
const OKTOGON: readonly [number, number] = [44.5, 68];

export const budapest: Blueprint = {
  city: 'budapest',
  name: 'Budapest',
  w: 78,
  h: 72,
  seed: 0x62756461,
  style: {
    roofs: { pitched: 5, terrace: 3, flat: 2 },
    storeys: [3, 5],
    residential: 0.72,
    tree: 'tree.plane',
    sidewalkProps: [
      { kind: 'bin', p: 0.03 },
      { kind: 'bench', p: 0.015 },
      { kind: 'hydrant', p: 0.008 },
      { kind: 'busstop', p: 0.014 },
      { kind: 'kiosk', p: 0.007 },
      { kind: 'planter', p: 0.01 },
      { kind: 'bollard', p: 0.008 },
    ],
    plazaProps: [
      { kind: 'bench', p: 0.025 },
      { kind: 'bin', p: 0.012 },
      { kind: 'planter', p: 0.01 },
    ],
    laneSurface: 'asphalt',
    maxBlock: 13,
  },

  areas: [
    // ── Buda: the Castle Hill (wooded slopes under the Palace and the Bastion).
    {
      ground: 'grass',
      shape: rect(0, 0, 32, 6),
      name: 'Várhegy',
      trees: { kinds: ['tree.round', 'tree.round', 'tree.pine'], density: 0.4 },
    },
    { ground: 'parkPath', shape: rect(13, 3, 23, 3) }, // castle walk under the walls
    { ground: 'parkPath', shape: rect(23, 3, 23, 6) },
    { ground: 'parkPath', shape: rect(32, 0, 32, 6) },
    // ── Margaret Island (north of the bridge, in the river).
    {
      ground: 'grass',
      shape: rect(67, 11, 77, 17),
      layer: 'top',
      name: 'Margitsziget',
      trees: { kinds: ['tree.round', 'tree.plane'], density: 0.35 },
    },
    { ground: 'parkPath', shape: rect(67, 14, 77, 14), layer: 'top' },
    // ── Pest parks.
    {
      ground: 'grass',
      shape: rect(22, 38, 28, 45),
      name: 'Szabadság tér',
      trees: { kinds: ['tree.plane', 'tree.round'], density: 0.25 },
    },
    { ground: 'parkPath', shape: rect(25, 38, 25, 45) },
    { ground: 'parkPath', shape: rect(22, 41, 28, 42) },
    {
      ground: 'grass',
      shape: rect(1, 41, 6, 46),
      name: 'Erzsébet tér',
      trees: { kinds: ['tree.plane', 'tree.round'], density: 0.3 },
    },
    { ground: 'parkPath', shape: rect(4, 41, 4, 46) },
    {
      ground: 'grass',
      shape: rect(70, 22, 77, 25),
      name: 'Szent István park',
      trees: { kinds: ['tree.round'], density: 0.35 },
    },
    // ── Top layer: squares.
    // Kossuth Lajos tér wraps the Parliament (gardens at its north and south ends).
    { ground: 'plaza', shape: rect(29, 22, 54, 37), layer: 'top', name: 'Kossuth Lajos tér' },
    {
      ground: 'grass',
      shape: rect(29, 22, 32, 26),
      layer: 'top',
      trees: { kinds: ['tree.round'], density: 0.25 },
    },
    {
      ground: 'grass',
      shape: rect(51, 22, 54, 27),
      layer: 'top',
      trees: { kinds: ['tree.round'], density: 0.25 },
    },
    // Széchenyi István tér at the Pest end of the Chain Bridge.
    { ground: 'plaza', shape: rect(12, 22, 22, 28), layer: 'top', name: 'Széchenyi István tér' },
    { ground: 'grass', shape: rect(13, 25, 15, 27), layer: 'top' },
    { ground: 'grass', shape: rect(20, 25, 22, 27), layer: 'top' },
    // Szent István tér in front of the Basilica.
    { ground: 'plaza', shape: rect(13, 35, 20, 39), layer: 'top', name: 'Szent István tér' },
    // Clark Ádám tér at the Buda end of the Chain Bridge, under the Castle Hill.
    { ground: 'plaza', shape: rect(14, 4, 22, 6), layer: 'top', name: 'Clark Ádám tér' },
    // Batthyány tér, facing the Parliament across the river.
    { ground: 'plaza', shape: rect(39, 3, 46, 6), layer: 'top', name: 'Batthyány tér' },
    // Vörösmarty tér, Deák Ferenc tér.
    { ground: 'plaza', shape: rect(0, 27, 4, 32), layer: 'top', name: 'Vörösmarty tér' },
    { ground: 'plaza', shape: rect(0, 47, 7, 55), layer: 'top', name: 'Deák Ferenc tér' },
    // Nyugati tér and the Oktogon.
    {
      ground: 'asphalt',
      shape: circle(NYUGATI[0], NYUGATI[1], 4.2),
      layer: 'top',
      name: 'Nyugati tér',
    },
    {
      ground: 'asphalt',
      shape: circle(OKTOGON[0], OKTOGON[1], 3.8),
      layer: 'top',
      name: 'Oktogon',
    },
    { ground: 'plaza', shape: circle(OKTOGON[0], OKTOGON[1], 1.4), layer: 'top' },
    // Jászai Mari tér at the Pest end of Margaret Bridge.
    { ground: 'plaza', shape: rect(60, 22, 61, 28), layer: 'top', name: 'Jászai Mari tér' },
    // Liszt Ferenc tér (cafés).
    { ground: 'plaza', shape: rect(32, 62, 35, 65), layer: 'top', name: 'Liszt Ferenc tér' },
  ],

  rivers: [
    {
      name: 'Duna',
      path: [
        [-2, RIVER_J],
        [80, RIVER_J],
      ],
      width: 7,
      quay: 1,
    },
  ],

  roads: [
    // ── Buda.
    {
      name: 'Fő utca',
      path: [
        [-1, FO_J],
        [79, FO_J],
      ],
      width: 3,
      labelPath: [
        [34, FO_J],
        [56, FO_J],
      ],
    },
    {
      name: 'Csalogány utca',
      path: [
        [52.5, -1],
        [52.5, FO_J],
      ],
      width: 3,
    },
    {
      name: 'Frankel Leó út',
      path: [
        [MB_I, 1],
        [79, 1],
      ],
      width: 2,
    },
    {
      name: 'Mecset utca',
      path: [
        [72, -1],
        [72, FO_J],
      ],
      width: 2,
      surface: 'cobble',
    },
    {
      name: 'Margit körút',
      path: [
        [MB_I, -1],
        [MB_I, FO_J],
      ],
      width: 5,
      trees: 'tree.plane',
    },
    // ── Pest embankment (tram 2) behind the Parliament.
    {
      name: 'Id. Antall József rakpart',
      path: [
        [-1, RAK_J],
        [79, RAK_J],
      ],
      width: 3,
      trees: 'tree.plane',
      labelPath: [
        [36, RAK_J],
        [50, RAK_J],
      ],
    },
    // ── The Nagykörút: Margaret Bridge → Szent István körút → Nyugati → Teréz körút → Oktogon.
    {
      name: 'Szent István körút',
      path: [
        [MB_I, RAK_J],
        [MB_I, 46],
        [NYUGATI[0], NYUGATI[1]],
      ],
      width: 5,
      trees: null,
      storeyBonus: 1,
      labelPath: [
        [MB_I, 30],
        [MB_I, 44],
      ],
    },
    {
      name: 'Teréz körút',
      path: [
        [NYUGATI[0], NYUGATI[1]],
        [OKTOGON[0], OKTOGON[1]],
      ],
      width: 5,
      trees: null,
      storeyBonus: 1,
    },
    {
      name: 'Erzsébet körút',
      path: [
        [OKTOGON[0], OKTOGON[1]],
        [39.5, 73],
      ],
      width: 5,
      trees: null,
      storeyBonus: 1,
    },
    // ── Andrássy út: from Bajcsy-Zsilinszky út past the Opera to the Oktogon (and on to Hősök tere).
    {
      name: 'Andrássy út',
      path: [
        [ANDRASSY0[0], ANDRASSY0[1]],
        [OKTOGON[0], OKTOGON[1]],
        [49.5, 73],
      ],
      width: 5,
      trees: 'tree.plane',
      storeyBonus: 1,
      labelPath: [
        [30, 53.5],
        [40, 63.5],
      ],
    },
    // ── Bajcsy-Zsilinszky út (Deák tér → Nyugati) and Váci út beyond.
    {
      name: 'Bajcsy-Zsilinszky út',
      path: [
        [-1, BZ_J],
        [NYUGATI[0], BZ_J],
      ],
      width: 5,
      trees: null,
      labelPath: [
        [28, BZ_J],
        [52, BZ_J],
      ],
    },
    {
      name: 'Váci út',
      path: [
        [NYUGATI[0], BZ_J],
        [79, BZ_J],
      ],
      width: 5,
      trees: null,
    },
    // ── Lipótváros: the Parliament's streets.
    {
      name: 'Alkotmány utca',
      path: [
        [ALK_I, 37],
        [ALK_I, BZ_J],
      ],
      width: 4,
      trees: 'tree.plane',
      rooftops: true,
    },
    {
      name: 'Nádor utca',
      path: [
        [CB_I, NADOR_J],
        [29, NADOR_J],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Honvéd utca',
      path: [
        [ALK_I, HONVED_J],
        [MB_I, HONVED_J],
      ],
      width: 3,
    },
    {
      name: 'Balassi Bálint utca',
      path: [
        [54, 25.5],
        [MB_I, 25.5],
      ],
      width: 3,
      rooftops: true,
    },
    {
      name: 'Falk Miksa utca',
      path: [
        [54, 33.5],
        [MB_I, 33.5],
      ],
      width: 3,
      rooftops: true,
      cafes: true,
    },
    {
      name: 'Zrínyi utca',
      path: [
        [CB_I, 28],
        [CB_I, 35],
      ],
      width: 4,
      surface: 'cobble',
      sidewalk: 0,
      cafes: true,
      rooftops: true,
    },
    {
      name: 'József Attila utca',
      path: [
        [JA_I, 22],
        [JA_I, BZ_J],
      ],
      width: 4,
      trees: null,
    },
    // ── Újlipótváros.
    {
      name: 'Pozsonyi út',
      path: [
        [MB_I, 29.5],
        [79, 29.5],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Újpesti rakpart',
      path: [
        [MB_I, RAK_J],
        [79, RAK_J],
      ],
      width: 3,
      trees: 'tree.plane',
    },
    // ── Belváros & Erzsébetváros.
    {
      name: 'Király utca',
      path: [
        [5, 55],
        [22, 72],
      ],
      width: 3,
      cafes: true,
    },
    {
      name: 'Dob utca',
      path: [
        [-1, 62.5],
        [17, 62.5],
      ],
      width: 3,
    },
    {
      name: 'Nagymező utca',
      path: [
        [35, 58.5],
        [54, 58.5],
      ],
      width: 3,
      cafes: true,
    },
  ],

  bridges: [
    {
      name: 'Széchenyi Lánchíd',
      path: [
        [CB_I, FO_J],
        [CB_I, RAK_J + 1],
      ],
      width: 4,
    },
    {
      name: 'Margit híd',
      path: [
        [MB_I, FO_J],
        [MB_I, RAK_J],
      ],
      width: 5,
    },
  ],

  landmarks: [
    { id: 'budaCastle', i: 1, j: 1 },
    { id: 'fishermansBastion', i: 24, j: 2 },
    { id: 'stStephens', i: 16, j: 40 },
    { id: 'kossuth', i: 50, j: 31 },
  ],

  capitol: { i: 34, j: 22, stepRows: 2, stepInset: 1 },

  civic: [
    { name: 'Kúria', i: 38, j: 38, w: 6, d: 4, storeys: 4, roof: 'pitched' },
    {
      name: 'Földművelésügyi Minisztérium',
      i: 44,
      j: 38,
      w: 6,
      d: 4,
      storeys: 4,
      roof: 'pitched',
      rooftop: true,
    },
    {
      name: 'Magyar Tudományos Akadémia',
      i: 23,
      j: 22,
      w: 6,
      d: 4,
      storeys: 4,
      roof: 'flat',
      rooftop: true,
    },
    {
      name: 'Gresham-palota',
      i: 12,
      j: 29,
      w: 4,
      d: 4,
      storeys: 5,
      roof: 'pitched',
      rooftop: true,
    },
    {
      name: 'Magyar Nemzeti Bank',
      i: 22,
      j: 46,
      w: 6,
      d: 3,
      storeys: 4,
      roof: 'flat',
      rooftop: true,
    },
    { name: 'Nyugati pályaudvar', i: 64, j: 56, w: 6, d: 4, storeys: 3, roof: 'pitched' },
    { name: 'Operaház', i: 24, j: 56, w: 4, d: 3, storeys: 4, roof: 'pitched' },
    { name: 'Vigadó', i: 2, j: 22, w: 5, d: 3, storeys: 4, roof: 'pitched' },
    { name: 'Mátyás-templom', i: 27, j: 0, w: 3, d: 2, storeys: 6, roof: 'pitched' },
    { name: 'Szent Anna-templom', i: 39, j: 0, w: 3, d: 3, storeys: 4, roof: 'pitched' },
  ],

  zones: [
    // Lipótváros: ministries, banks, grand eclectic offices — never spawn buildings.
    {
      shape: rect(12, 22, 62, 50),
      storeys: [4, 5],
      residential: 0.15,
      kind: 'commercial',
      roofs: { pitched: 4, flat: 3, terrace: 1 },
    },
    // Víziváros & Rózsadomb: lower Buda houses on the slope.
    {
      shape: rect(33, 0, 77, 6),
      storeys: [2, 4],
      residential: 0.9,
      roofs: { pitched: 7, terrace: 1 },
      maxLen: 3,
      maxDepth: 3,
    },
    // Erzsébetváros / Terézváros: tall courtyard blocks.
    { shape: rect(0, 53, 77, 71), storeys: [4, 5], residential: 0.85 },
  ],

  districts: [
    {
      id: 'terezvaros',
      name: 'Terézváros',
      unlockWave: 1,
      area: [34, 53, 58, 64],
      rally: [46, 59],
    },
    {
      id: 'erzsebetvaros',
      name: 'Erzsébetváros',
      unlockWave: 1,
      area: [0, 56, 30, 71],
      rally: [10, 62],
    },
    {
      id: 'ujlipotvaros',
      name: 'Újlipótváros',
      unlockWave: 3,
      area: [67, 26, 77, 50],
      rally: [71, 29],
    },
    { id: 'vizivaros', name: 'Víziváros', unlockWave: 4, area: [33, 0, 49, 6], rally: [36, 8] },
    { id: 'belvaros', name: 'Belváros', unlockWave: 6, area: [0, 22, 9, 48], rally: [3, 30] },
    { id: 'rozsadomb', name: 'Rózsadomb', unlockWave: 8, area: [51, 0, 77, 6], rally: [68, 8] },
  ],

  chokepoints: [
    { name: 'Alkotmány utca', at: [ALK_I, 41], radius: 2 },
    { name: 'Széchenyi Lánchíd', at: [CB_I, RIVER_J], radius: 2 },
    { name: 'Margit híd', at: [MB_I, RIVER_J], radius: 2 },
  ],

  approaches: [
    {
      name: 'Alkotmány utca',
      path: [
        [ALK_I, BZ_J],
        [ALK_I, 37],
      ],
      final: true,
    },
    {
      name: 'Nádor utca (from Széchenyi tér)',
      path: [
        [CB_I, NADOR_J],
        [29, NADOR_J],
      ],
      final: true,
    },
    {
      name: 'Falk Miksa utca',
      path: [
        [MB_I, 33.5],
        [54, 33.5],
      ],
      final: true,
    },
    {
      name: 'Széchenyi Lánchíd → Nádor utca',
      path: [
        [CB_I, FO_J],
        [CB_I, NADOR_J],
        [29, NADOR_J],
      ],
    },
    {
      name: 'Margit híd → Szent István körút',
      path: [
        [MB_I, FO_J],
        [MB_I, 33.5],
      ],
    },
    {
      name: 'Bajcsy-Zsilinszky út',
      path: [
        [NYUGATI[0], BZ_J],
        [ALK_I, BZ_J],
      ],
    },
    {
      name: 'Andrássy út',
      path: [
        [OKTOGON[0], OKTOGON[1]],
        [ANDRASSY0[0], ANDRASSY0[1]],
      ],
    },
  ],

  decor: [
    // Kossuth tér: the national flag, Rákóczi on horseback, flags by the steps, the poet by the river.
    { kind: 'flag', at: [41, 34] },
    { kind: 'flag', at: [36, 31] },
    { kind: 'flag', at: [47, 31] },
    { kind: 'statue.equestrian', at: [31, 32] },
    { kind: 'statue', at: [30, 21] },
    { kind: 'metro', at: [52, 36] },
    // Chain Bridge lions at both ends, Széchenyi statue, Zero Kilometre stone.
    { kind: 'statue.lion', at: [15, 22] },
    { kind: 'statue.lion', at: [20, 22] },
    { kind: 'statue.lion', at: [15, 6] },
    { kind: 'statue.lion', at: [20, 6] },
    { kind: 'statue', at: [17, 24] },
    { kind: 'statue', at: [18, 9] },
    // Szent István tér, Szabadság tér (fountain), Vörösmarty tér, Deák tér, Erzsébet tér.
    { kind: 'lamp', at: [15, 37] },
    { kind: 'lamp', at: [21, 37] },
    { kind: 'fountain', at: [27, 42] },
    { kind: 'statue', at: [2, 30] },
    { kind: 'kiosk', at: [5, 27] },
    { kind: 'metro', at: [4, 52] },
    { kind: 'metro', at: [6, 48] },
    { kind: 'fountain', at: [5, 43] },
    // Oktogon, Nyugati, Batthyány tér metros; Margaret Island fountain.
    { kind: 'metro', at: [38, 66] },
    { kind: 'metro', at: [57, 55] },
    { kind: 'metro', at: [44, 6] },
    { kind: 'fountain', at: [72, 14] },
    { kind: 'statue', at: [42, 4] },
    // Sightseeing boats on the Danube.
    { kind: 'boat', at: [27, 15] },
    { kind: 'boat', at: [52, 13] },
    { kind: 'boat', at: [7, 16] },
  ],

  // Kossuth tér's east side and the Parliament's surroundings: no automatic alleys, so the
  // designed approaches stay the only ways onto the square.
  noLanes: [rect(23, 22, 58, 42)],

  labels: [
    { text: 'Várhegy', at: [14, 1] },
    { text: 'Margitsziget', at: [71, 12] },
  ],
};
