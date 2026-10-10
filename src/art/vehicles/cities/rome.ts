/**
 * ROME decor vehicles (E3 South): Fiat 500s in pastel and red, Smart fortwos parked nose to
 * kerb, white Roman taxis with their roof sign, the red ATAC bus.
 */
import { bus, car, sedan, type Builder, type CivDef } from '../civil';

/** Fiat 500: tiny, round, short bonnet, chrome hubs. */
export const cinquecento =
  (body: string): Builder =>
  (f, s) =>
    car(
      {
        L: 15,
        W: 8.6,
        wheelR: 2.0,
        wheelX: [-4.8, 4.8],
        sill: 1.1,
        belt: 4.4,
        roof: 8.6,
        cabin: [-6.4, 3.2],
        rake: [1.8, 2.6],
        body,
        nose: 1.5,
        tail: 1.6,
        hub: 'chrome',
        extras: (m, _f, st) => {
          if (st === 'burnt') return;
          for (const y of [-2.6, 2.6]) m.ell('lampW', [7.3, y, 3.9], [0.5, 0.8, 0.8]);
        },
      },
      f,
      s,
    );

/** Smart fortwo: two seats, tall, black safety cell over coloured panels. */
export const smart =
  (body: string): Builder =>
  (f, s) =>
    car(
      {
        L: 11.5,
        W: 8.6,
        wheelR: 2.0,
        wheelX: [-3.6, 3.6],
        sill: 1.2,
        belt: 4.8,
        roof: 9.4,
        cabin: [-5.4, 2.8],
        rake: [0.4, 2.8],
        body,
        roofMat: 'black',
        nose: 1.2,
        tail: 0.3,
      },
      f,
      s,
    );

/** Roman taxi: white saloon with the TAXI box on the roof. */
export const taxiWhite: Builder = sedan('white', (m, _f, s) => {
  if (s === 'burnt') return;
  m.boxc('white', [-1.2, 0, 8.8], [1.6, 3.6, 1.3]);
  m.boxc('lampAmber', [-1.2, 0, 9.6], [1.2, 3.0, 0.5]);
});

export const rome: readonly CivDef[] = [
  {
    id: 'fiat500_rome',
    build: cinquecento('mint'),
    burnt: true,
    flipped: true,
    hw: 4.3,
    roof: 8.6,
  },
  { id: 'fiat500_rome_red', build: cinquecento('red'), hw: 4.3 },
  { id: 'fiat500_rome_cream', build: cinquecento('cream'), hw: 4.3 },
  { id: 'smart_rome', build: smart('silver'), burnt: true, flipped: true, hw: 4.3, roof: 9.4 },
  { id: 'smart_rome_red', build: smart('red'), hw: 4.3 },
  { id: 'taxi_rome', build: taxiWhite, burnt: true, flipped: true, hw: 4.9, roof: 9.6 },
  {
    id: 'bus_rome',
    build: bus({ body: 'red', decks: 1, skirt: 'redDk', rows: [[8.4, 12.6]] }),
    burnt: true,
    burning: true,
    hw: 6,
  },
];
