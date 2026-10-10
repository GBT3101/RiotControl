/**
 * MILAN decor vehicles (E3 South): the orange "Ventotto" (Peter Witt tram, 1928) with its
 * trolley pole, the white Milan taxi and the ATM bus; Fiat 500s and Smarts as in Rome.
 */
import { boxVehicle, bus, type Builder, type CivDef } from '../civil';
import { cinquecento, smart, taxiWhite } from './rome';

/** Ventotto: single car, two bogies, long window band, cream belt, trolley pole. */
const ventotto: Builder = (f, s) =>
  boxVehicle(
    {
      L: 40,
      W: 10.4,
      H: 14,
      wheelR: 1.9,
      wheelX: [-13, -10, 10, 13],
      sill: 2.4,
      body: 'orange',
      screenZ: 6.4,
      rake: 0.2,
      bevel: 1.2,
      paint: (_p, n, q) => {
        const side = Math.abs(n[1]) > 0.6;
        const [z0, z1] = [7.4, 11.8];
        if ((side || n[0] < -0.6) && q[2] > z0 && q[2] < z1) {
          const u = side ? q[0] : q[1];
          if (side && Math.floor((u + 40) / 3.4) !== Math.floor((u + 40.6) / 3.4)) return 'orange';
          if (side && (Math.abs(q[0] - 1) < 1.6 || Math.abs(q[0] + 15) < 1.6)) return 'dark';
          return Math.abs(u - (q[2] - z0) * 0.8 - 2) < 0.4 && s === 'ok' ? 'glassHi' : 'glass';
        }
        if (side && q[2] <= z0 && (Math.abs(q[0] - 1) < 1.6 || Math.abs(q[0] + 15) < 1.6))
          return 'dark';
        if (q[2] > z0 - 1.2 && q[2] <= z0 && Math.abs(n[2]) < 0.6) return 'cream';
        if (q[2] > z1 && q[2] < z1 + 0.8 && Math.abs(n[2]) < 0.6) return 'cream';
        if (q[2] < 3.6 && Math.abs(n[2]) < 0.6) return 'redDk';
        if (n[2] > 0.6) return 'gray';
        if (n[0] > 0.5 && q[2] > 12.4 && q[2] < 13.6 && Math.abs(q[1]) < 3)
          return s === 'ok' ? 'lampAmber' : 'dark';
        return undefined;
      },
      extras: (m, _f, st) => {
        if (st === 'burnt') return;
        // Clerestory and the trolley pole raised to the wire.
        m.box('gray', [-15, -2.2, 14], [15, 2.2, 15.2]);
        m.box('dark', [-6, -0.6, 15.2], [-4, 0.6, 16.2]);
        for (let k = 0; k < 7; k++)
          m.boxc('steel', [-5 - k * 1.3, 0, 16.6 + k * 0.9], [1.4, 0.5, 0.5]);
      },
    },
    f,
    s,
  );

export const milan: readonly CivDef[] = [
  { id: 'tram_milan', build: ventotto, burnt: true, hw: 5.2 },
  { id: 'taxi_milan', build: taxiWhite, burnt: true, flipped: true, hw: 4.9, roof: 9.6 },
  {
    id: 'bus_milan',
    build: bus({
      body: 'white',
      decks: 1,
      band: 'orange',
      skirt: 'gray',
      rows: [[8.4, 12.6]],
      bandZ: [4.2, 5.2],
    }),
    burnt: true,
    burning: true,
    hw: 6,
  },
  { id: 'fiat500_milan', build: cinquecento('beige'), hw: 4.3 },
  { id: 'smart_milan', build: smart('white'), hw: 4.3 },
];
