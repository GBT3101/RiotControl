/**
 * Shared map contract between city blueprints (M2), terrain/building art (M3a),
 * landmark art (M3b), the simulation (M6) and the world view (M8).
 *
 * OWNED BY THE ORCHESTRATOR — do not change without orchestrator approval.
 *
 * Coordinates: tile (i, j); i grows toward screen bottom-right (SE), j toward
 * screen bottom-left (SW). Tile (i,j) top vertex is at world ((i-j)*16, (i+j)*8).
 * Flat arrays are row-major: index = j * w + i.
 *
 * A building footprint {i, j, w, d} covers tiles i..i+w-1 × j..j+d-1. The camera
 * sees two of its faces: the LEFT face (the +j edge, facing SW, lit) and the
 * RIGHT face (the +i edge, facing SE, shaded). Capitol fronts face SW (+j).
 */

/**
 * Every city of the Europe campaign (PLAN §2, §8). A city is *playable* once its blueprint is
 * registered (src/maps/cities/index.ts → `PLAYABLE_CITIES` in src/maps); the rest are known ids
 * that nothing at runtime may load yet. Order = canonical iteration order (the original three
 * first, so their art, atlases and saves stay byte-identical).
 */
export type CityId =
  | 'madrid'
  | 'london'
  | 'paris'
  | 'budapest'
  | 'berlin'
  | 'stockholm'
  | 'vienna'
  | 'amsterdam'
  | 'rome'
  | 'barcelona'
  | 'prague'
  | 'milan';
export const CITIES: readonly CityId[] = [
  'madrid',
  'london',
  'paris',
  'budapest',
  'berlin',
  'stockholm',
  'vienna',
  'amsterdam',
  'rome',
  'barcelona',
  'prague',
  'milan',
];

/** Ground materials; the index in this array is the value stored in `MapData.ground`. */
export const GROUNDS = [
  'lot', // 0 under buildings / private courtyards — blocked
  'asphalt', // 1 road carriageway
  'sidewalk', // 2 pavement
  'cobble', // 3 old-town streets / cobbled squares
  'plaza', // 4 paved square
  'steps', // 5 monumental stairs (Capitol approach)
  'bridge', // 6 bridge deck
  'grass', // 7 lawns / park grass (walkable, slow)
  'parkPath', // 8 gravel park paths
  'water', // 9 river / lake / fountain basin — blocked
  'quay', // 10 embankment wall / riverside edge — blocked
] as const;
export type Ground = (typeof GROUNDS)[number];
export const groundId = (g: Ground): number => GROUNDS.indexOf(g);

/** Walkable by protesters and ground units. */
export const WALKABLE: ReadonlySet<Ground> = new Set<Ground>([
  'asphalt',
  'sidewalk',
  'cobble',
  'plaza',
  'steps',
  'bridge',
  'grass',
  'parkPath',
]);
/** "Road" tiles where road-placed player units and blockades may be deployed. */
export const PLACEABLE_ROAD: ReadonlySet<Ground> = new Set<Ground>([
  'asphalt',
  'sidewalk',
  'cobble',
  'plaza',
  'bridge',
]);
/** Movement cost multiplier for flow fields (1 = normal). */
export const GROUND_COST: Readonly<Partial<Record<Ground, number>>> = {
  asphalt: 1,
  sidewalk: 1,
  cobble: 1.1,
  plaza: 1,
  steps: 1.3,
  bridge: 1,
  grass: 1.6,
  parkPath: 1.2,
};

/**
 * Road markings painted on a tile. "I" = the road runs along the i axis (screen
 * NW→SE), "J" = along the j axis (screen NE→SW).
 *  dash*  — dashed centre line along the road
 *  zebra* — pedestrian crossing across a road running along that axis
 *  stop*  — solid stop line across a road running along that axis
 */
export const MARKINGS = ['none', 'dashI', 'dashJ', 'zebraI', 'zebraJ', 'stopI', 'stopJ'] as const;
export type Marking = (typeof MARKINGS)[number];

export type RoofType = 'flat' | 'pitched' | 'mansard' | 'terrace';
export type BuildingKind = 'residential' | 'commercial' | 'civic';

export interface TilePos {
  i: number;
  j: number;
}

export interface BuildingData {
  id: number;
  i: number;
  j: number;
  w: number;
  d: number;
  /** 2–6 storeys; 1 storey = 10 world px. */
  storeys: number;
  style: CityId;
  kind: BuildingKind;
  roof: RoofType;
  /** Player rooftop units (snipers) may be deployed on this roof. */
  rooftop: boolean;
  /** Walkable tiles adjacent to the footprint where residents exit (protester spawn doors). */
  doors: TilePos[];
  /** Seed for deterministic art variation. */
  seed: number;
}

/** Fixed footprints so blueprints (M2) and landmark art (M3b) agree. */
export const CAPITOL_FOOTPRINT: Readonly<Record<CityId, { w: number; d: number }>> = {
  madrid: { w: 9, d: 7 }, // Congreso de los Diputados
  london: { w: 14, d: 6 }, // Palace of Westminster incl. Elizabeth Tower at the low-i end
  paris: { w: 11, d: 7 }, // Palais Bourbon (Assemblée nationale)
  budapest: { w: 16, d: 6 }, // Országház: long neo-Gothic river front, central dome
  berlin: { w: 10, d: 8 }, // Reichstag with the glass dome
  stockholm: { w: 10, d: 6 }, // Riksdagshuset on Helgeandsholmen
  vienna: { w: 12, d: 7 }, // Parlament (Greek revival portico, Athena fountain in front)
  amsterdam: { w: 9, d: 6 }, // Koninklijk Paleis on the Dam
  rome: { w: 9, d: 6 }, // Palazzo Montecitorio (obelisk on the piazza)
  barcelona: { w: 9, d: 6 }, // Parlament de Catalunya, Parc de la Ciutadella
  prague: { w: 14, d: 6 }, // Prague Castle front with St Vitus
  milan: { w: 9, d: 6 }, // Palazzo Marino on Piazza della Scala
};

export interface CapitolPlacement {
  i: number;
  j: number;
  w: number;
  d: number;
  /** Front steps: walkable 'steps' tiles along the +j edge where protesters arrive and attack. */
  steps: TilePos[];
}

export interface LandmarkDef {
  city: CityId;
  w: number;
  d: number;
  /** Blocks movement (true) or is walk-around decor inside a plaza that still blocks its own tiles. */
  blocking: boolean;
  label: string;
}

/** Secondary landmarks drawn by M3b and placed by M2 (footprints in tiles). */
export const LANDMARKS = {
  cibeles: { city: 'madrid', w: 3, d: 3, blocking: true, label: 'Fuente de Cibeles' },
  neptuno: { city: 'madrid', w: 3, d: 3, blocking: true, label: 'Fuente de Neptuno' },
  metropolis: { city: 'madrid', w: 3, d: 3, blocking: true, label: 'Edificio Metrópolis' },
  puertaAlcala: { city: 'madrid', w: 4, d: 2, blocking: true, label: 'Puerta de Alcalá' },
  palacioComunicaciones: {
    city: 'madrid',
    w: 8,
    d: 6,
    blocking: true,
    label: 'Palacio de Cibeles',
  },
  cervantes: { city: 'madrid', w: 1, d: 1, blocking: true, label: 'Cervantes' },
  abbey: { city: 'london', w: 7, d: 4, blocking: true, label: 'Westminster Abbey' },
  nelson: { city: 'london', w: 2, d: 2, blocking: true, label: "Nelson's Column" },
  londonEye: { city: 'london', w: 4, d: 4, blocking: true, label: 'London Eye' },
  buckingham: { city: 'london', w: 10, d: 5, blocking: true, label: 'Buckingham Palace' },
  churchill: { city: 'london', w: 1, d: 1, blocking: true, label: 'Churchill' },
  obelisk: { city: 'paris', w: 2, d: 2, blocking: true, label: 'Obélisque' },
  concordeFountain: { city: 'paris', w: 3, d: 3, blocking: true, label: 'Fontaine de la Concorde' },
  eiffel: { city: 'paris', w: 6, d: 6, blocking: true, label: 'Tour Eiffel' },
  invalides: { city: 'paris', w: 8, d: 8, blocking: true, label: 'Les Invalides' },
  orsay: { city: 'paris', w: 10, d: 5, blocking: true, label: "Musée d'Orsay" },
  // ── Europe campaign (PLAN §8.2). Footprints: docs/E0.md (real proportions, game scale). ──
  stStephens: { city: 'budapest', w: 5, d: 7, blocking: true, label: 'Szent István-bazilika' },
  budaCastle: { city: 'budapest', w: 12, d: 5, blocking: true, label: 'Budavári Palota' },
  fishermansBastion: { city: 'budapest', w: 8, d: 3, blocking: true, label: 'Halászbástya' },
  kossuth: { city: 'budapest', w: 2, d: 2, blocking: true, label: 'Kossuth-emlékmű' },
  brandenburgGate: { city: 'berlin', w: 6, d: 2, blocking: true, label: 'Brandenburger Tor' },
  victoryColumn: { city: 'berlin', w: 3, d: 3, blocking: true, label: 'Siegessäule' },
  tvTower: { city: 'berlin', w: 4, d: 4, blocking: true, label: 'Fernsehturm' },
  royalPalace: { city: 'stockholm', w: 9, d: 8, blocking: true, label: 'Kungliga slottet' },
  cityHall: { city: 'stockholm', w: 8, d: 5, blocking: true, label: 'Stadshuset' },
  riddarholmen: { city: 'stockholm', w: 5, d: 3, blocking: true, label: 'Riddarholmskyrkan' },
  rathaus: { city: 'vienna', w: 10, d: 6, blocking: true, label: 'Rathaus' },
  hofburg: { city: 'vienna', w: 12, d: 5, blocking: true, label: 'Hofburg' },
  stephansdom: { city: 'vienna', w: 7, d: 4, blocking: true, label: 'Stephansdom' },
  nationalMonument: {
    city: 'amsterdam',
    w: 3,
    d: 3,
    blocking: true,
    label: 'Nationaal Monument',
  },
  nieuweKerk: { city: 'amsterdam', w: 6, d: 3, blocking: true, label: 'Nieuwe Kerk' },
  centraalStation: { city: 'amsterdam', w: 13, d: 4, blocking: true, label: 'Centraal Station' },
  westerkerk: { city: 'amsterdam', w: 5, d: 3, blocking: true, label: 'Westerkerk' },
  pantheon: { city: 'rome', w: 5, d: 4, blocking: true, label: 'Pantheon' },
  trevi: { city: 'rome', w: 4, d: 3, blocking: true, label: 'Fontana di Trevi' },
  vittoriano: { city: 'rome', w: 10, d: 6, blocking: true, label: 'Vittoriano' },
  colosseum: { city: 'rome', w: 10, d: 8, blocking: true, label: 'Colosseo' },
  arcTriomf: { city: 'barcelona', w: 3, d: 2, blocking: true, label: 'Arc de Triomf' },
  cascada: { city: 'barcelona', w: 5, d: 3, blocking: true, label: 'Cascada' },
  columbus: { city: 'barcelona', w: 3, d: 3, blocking: true, label: 'Monument a Colom' },
  sagradaFamilia: { city: 'barcelona', w: 7, d: 5, blocking: true, label: 'Sagrada Família' },
  bridgeTower: {
    city: 'prague',
    w: 2,
    d: 2,
    blocking: true,
    label: 'Staroměstská mostecká věž',
  },
  oldTownHall: { city: 'prague', w: 5, d: 3, blocking: true, label: 'Staroměstská radnice' },
  tynChurch: { city: 'prague', w: 4, d: 3, blocking: true, label: 'Týnský chrám' },
  dancingHouse: { city: 'prague', w: 3, d: 2, blocking: true, label: 'Tančící dům' },
  duomo: { city: 'milan', w: 10, d: 6, blocking: true, label: 'Duomo di Milano' },
  galleria: { city: 'milan', w: 8, d: 5, blocking: true, label: 'Galleria Vittorio Emanuele II' },
  laScala: { city: 'milan', w: 6, d: 5, blocking: true, label: 'Teatro alla Scala' },
  castello: { city: 'milan', w: 10, d: 8, blocking: true, label: 'Castello Sforzesco' },
} as const satisfies Record<string, LandmarkDef>;
export type LandmarkId = keyof typeof LANDMARKS;

export interface LandmarkPlacement extends TilePos {
  id: LandmarkId;
}

export interface SpawnDistrict {
  id: string;
  name: string;
  /** First wave (1-based) in which this district releases protesters. */
  unlockWave: number;
  /** Residential buildings whose doors release protesters. */
  buildingIds: number[];
  /** Where the district's crowd gathers before marching. */
  rally: TilePos;
}

export interface StreetLabel {
  name: string;
  /** Polyline in tile coordinates along the street centre. */
  path: TilePos[];
  width: number;
}

/** Small props placed by blueprints and drawn by M3a (kind = M3a prop id, e.g. 'tree.plane', 'lamp', 'bench'). */
export interface DecorPlacement extends TilePos {
  kind: string;
  /** 'i' or 'j' — which axis the prop is aligned to, when it matters. */
  axis?: 'i' | 'j';
  seed?: number;
}

export interface Chokepoint extends TilePos {
  name: string;
  radius: number;
}

export interface MapData {
  city: CityId;
  name: string;
  w: number;
  h: number;
  /** GROUNDS index per tile. */
  ground: Uint8Array;
  /** MARKINGS index per tile. */
  marking: Uint8Array;
  /** Index into `buildings` occupying the tile, or -1. Capitol/landmark tiles are -1 but ground 'lot'. */
  building: Int16Array;
  buildings: BuildingData[];
  capitol: CapitolPlacement;
  landmarks: LandmarkPlacement[];
  spawns: SpawnDistrict[];
  streets: StreetLabel[];
  decor: DecorPlacement[];
  chokepoints: Chokepoint[];
  cameraStart: TilePos;
}
