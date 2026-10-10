/**
 * BUDAPEST decor vehicles (E3 Central): the yellow BKV tram (the No. 2 along the Pest
 * embankment), yellow taxis with their roof sign, and the blue BKV bus.
 */
import { boxVehicle, bus, sedan, type Builder, type CivDef } from '../civil';

/** Tram body shared by the Central cities: long box, window band, pantograph, destination blind. */
export function tram(spec: {
  body: string;
  band?: string;
  skirt?: string;
  roof: string;
  /** Window band [z0, z1]. */
  rows?: [number, number];
}): Builder {
  const [z0, z1] = spec.rows ?? [7.2, 12.0];
  return (f, s) =>
    boxVehicle(
      {
        L: 46,
        W: 11,
        H: 15,
        wheelR: 2.0,
        wheelX: [-15, -11, 11, 15],
        sill: 2.2,
        body: spec.body,
        screenZ: 6.0,
        rake: 0.3,
        bevel: 1.0,
        paint: (_p, n, q) => {
          const side = Math.abs(n[1]) > 0.6;
          if ((side || n[0] < -0.6) && q[2] > z0 && q[2] < z1) {
            const u = side ? q[0] : q[1];
            if (side && Math.floor((u + 46) / 4.6) !== Math.floor((u + 46.7) / 4.6))
              return spec.body;
            if (side && (Math.abs(q[0] - 6) < 1.8 || Math.abs(q[0] + 9) < 1.8)) return 'dark'; // doors
            return Math.abs(u - (q[2] - z0) * 0.8 - 2) < 0.4 && s === 'ok' ? 'glassHi' : 'glass';
          }
          if (side && q[2] <= z0 && (Math.abs(q[0] - 6) < 1.8 || Math.abs(q[0] + 9) < 1.8))
            return 'dark';
          if (spec.band && q[2] > z0 - 1.4 && q[2] <= z0) return spec.band;
          if (spec.skirt && q[2] < 4.2 && Math.abs(n[2]) < 0.6) return spec.skirt;
          if (n[2] > 0.6) return spec.roof;
          if (n[0] > 0.5 && q[2] > 12.6 && q[2] < 14.2 && Math.abs(q[1]) < 3.5)
            return s === 'ok' ? 'lampAmber' : 'dark';
          return undefined;
        },
        extras: (m, _f, st) => {
          if (st === 'burnt') return;
          // Pantograph: base, folded arms, collector bar.
          m.box('dark', [-3, -2.4, 15], [3, 2.4, 15.8]);
          m.box('steel', [-2.2, -0.3, 15.8], [1.6, 0.3, 18.4]);
          m.box('steel', [-0.4, -3.2, 18.2], [0.4, 3.2, 18.8]);
        },
      },
      f,
      s,
    );
}

/** Budapest taxi: yellow saloon with the black-and-yellow roof sign. */
const taxiBudapest: Builder = sedan('yellow', (m, _f, s) => {
  if (s === 'burnt') return;
  m.boxc('black', [-1.2, 0, 8.8], [1.6, 3.8, 1.2]);
  m.boxc('lampY', [-1.2, 0, 9.5], [1.2, 3.2, 0.5]);
});

export const budapest: readonly CivDef[] = [
  {
    id: 'tram_budapest',
    build: tram({
      body: 'yellow',
      band: 'white',
      skirt: 'gray',
      roof: 'yellow',
      rows: [8.2, 11.8],
    }),
    burnt: true,
    hw: 5.5,
  },
  { id: 'taxi_budapest', build: taxiBudapest, burnt: true, flipped: true, hw: 4.9, roof: 9.6 },
  {
    id: 'bus_budapest',
    build: bus({ body: 'blue', decks: 1, skirt: 'navyDk', rows: [[8.4, 12.6]] }),
    burnt: true,
    burning: true,
    hw: 6,
  },
];
