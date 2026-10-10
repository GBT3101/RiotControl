/**
 * STOCKHOLM city vehicles (E3 North): boxy Volvo estates in Swedish family colours and the blue
 * inner-city bus (blåbuss).
 */
import { bus, car, type Builder, type CivDef } from '../civil';

/** Volvo 240-style estate: long, square, the roof carried to the tailgate, roof rails. */
const volvo =
  (body: string): Builder =>
  (f, s) =>
    car(
      {
        L: 23,
        W: 9.8,
        wheelR: 2.3,
        wheelX: [-7.2, 7.0],
        sill: 1.4,
        belt: 5.2,
        roof: 9.0,
        cabin: [-11.0, 4.0],
        rake: [0.4, 3.0],
        body,
        nose: 0.8,
        tail: 0.3,
        extras: (m, _f, st) => {
          if (st === 'burnt') return;
          for (const y of [-3.6, 3.6]) m.box('steel', [-9.5, y - 0.3, 9.0], [2.5, y + 0.3, 9.6]);
          m.box('chrome', [11.2, -3.4, 2.4], [11.7, 3.4, 4.6]);
        },
      },
      f,
      s,
    );

/** SL blåbuss: blue single-decker with a dark skirt. */
const busStockholm: Builder = bus({
  body: 'blue',
  decks: 1,
  skirt: 'navyDk',
  roofMat: 'blue',
  rows: [[8.4, 12.6]],
  bandZ: [2.4, 3.6],
});

export const stockholm: readonly CivDef[] = [
  {
    id: 'volvo_navy',
    build: volvo('navy'),
    burnt: true,
    flipped: true,
    burning: true,
    hw: 4.9,
    roof: 9.0,
  },
  { id: 'volvo_red', build: volvo('red'), burnt: true, flipped: true, hw: 4.9, roof: 9.0 },
  { id: 'volvo_beige', build: volvo('beige'), hw: 4.9 },
  { id: 'volvo_white', build: volvo('white'), hw: 4.9 },
  { id: 'bus_stockholm', build: busStockholm, burnt: true, burning: true, hw: 6 },
];
