/**
 * BARCELONA decor vehicles (E3 South): the black-and-yellow taxi with its green roof lamp and
 * the red TMB bus.
 */
import { bus, sedan, type Builder, type CivDef } from '../civil';

/** Barcelona taxi: black saloon, yellow doors, green "lliure" lamp on the roof. */
const taxiBarcelona: Builder = sedan(
  'black',
  (m, f, s) => {
    if (s === 'burnt') return;
    m.boxc('black', [-1.4, 0, 8.8], [1.2, 3.0, 1.0]);
    m.boxc(f % 2 === 0 ? 'lampGreen' : 'lampGreenDk', [-1.4, 0, 9.5], [0.8, 0.8, 0.5]);
  },
  (_p, n, q) =>
    Math.abs(n[1]) > 0.6 && q[0] > -9 && q[0] < 7 && q[2] < 5.4 && q[2] > 1.4
      ? 'yellow'
      : undefined,
);

export const barcelona: readonly CivDef[] = [
  { id: 'taxi_barcelona', build: taxiBarcelona, burnt: true, flipped: true, hw: 4.9, roof: 9.6 },
  {
    id: 'bus_barcelona',
    build: bus({
      body: 'red',
      decks: 1,
      band: 'white',
      skirt: 'redDk',
      rows: [[8.4, 12.6]],
      bandZ: [4.2, 5.0],
    }),
    burnt: true,
    burning: true,
    hw: 6,
  },
];
