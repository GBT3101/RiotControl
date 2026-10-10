/**
 * VIENNA decor vehicles (E3 Central): the red-and-white Ringstraßenbahn, black taxis with the
 * roof sign, and the red Wiener Linien bus.
 */
import { bus, sedan, type Builder, type CivDef } from '../civil';
import { tram } from './budapest';

const taxiVienna: Builder = sedan('black', (m, _f, s) => {
  if (s === 'burnt') return;
  m.boxc('white', [-1.2, 0, 8.8], [1.6, 3.8, 1.2]);
  m.boxc('lampY', [-1.2, 0, 9.5], [1.2, 3.2, 0.5]);
});

export const vienna: readonly CivDef[] = [
  {
    id: 'tram_vienna',
    build: tram({ body: 'red', band: 'white', skirt: 'redDk', roof: 'white', rows: [8.2, 11.8] }),
    burnt: true,
    hw: 5.5,
  },
  { id: 'taxi_vienna', build: taxiVienna, burnt: true, flipped: true, hw: 4.9, roof: 9.6 },
  {
    id: 'bus_vienna',
    build: bus({
      body: 'red',
      decks: 1,
      band: 'white',
      skirt: 'redDk',
      rows: [[8.4, 12.6]],
      bandZ: [7.4, 8.2],
    }),
    burnt: true,
    burning: true,
    hw: 6,
  },
];
