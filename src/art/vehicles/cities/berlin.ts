/**
 * BERLIN city vehicles (E3 North): the yellow BVG double-decker, the ivory Mercedes taxi with its
 * yellow roof sign, and a pastel Trabant for the nostalgics.
 */
import { car, bus, sedan, type Builder, type CivDef } from '../civil';

/** BVG double-decker: all yellow, dark window bands, dark skirt. */
const busBerlin: Builder = bus({
  body: 'yellow',
  decks: 2,
  skirt: 'dark',
  roofMat: 'yellow',
  rows: [
    [6.6, 10.6],
    [15.6, 20.4],
  ],
});

/** Berlin taxi: light-ivory saloon with the yellow TAXI roof sign. */
const taxiBerlin: Builder = sedan('cream', (m, f, s) => {
  if (s === 'burnt') return;
  m.boxc('yellow', [-1.0, 0, 8.9], [1.6, 3.8, 1.3]);
  m.boxc(f % 2 === 0 ? 'lampAmber' : 'yellow', [-1.0, 0, 9.8], [1.0, 2.4, 0.5]);
});

/** Trabant 601: small, square, two-tone with a white roof. */
const trabi = (body: string): Builder => (f, s) =>
  car(
    {
      L: 17,
      W: 9.0,
      wheelR: 1.9,
      wheelX: [-5.6, 5.2],
      sill: 1.4,
      belt: 4.8,
      roof: 8.4,
      cabin: [-6.6, 3.0],
      rake: [1.2, 2.4],
      body,
      roofMat: 'white',
      nose: 1.0,
      tail: 0.6,
      hub: 'cream',
    },
    f,
    s,
  );

export const berlin: readonly CivDef[] = [
  { id: 'bus_berlin', build: busBerlin, burnt: true, burning: true, hw: 6 },
  { id: 'taxi_berlin', build: taxiBerlin, burnt: true, flipped: true, hw: 4.9, roof: 9.6 },
  { id: 'trabi_mint', build: trabi('mint'), burnt: true, flipped: true, hw: 4.5, roof: 8.4 },
  { id: 'trabi_beige', build: trabi('beige'), hw: 4.5 },
];
