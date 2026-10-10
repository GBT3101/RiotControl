/**
 * PRAGUE decor vehicles (E3 Central): the red-and-cream tram (Tatra T3 lines) and taxis with
 * the yellow roof sign.
 */
import { sedan, type Builder, type CivDef } from '../civil';
import { tram } from './budapest';

const taxiPrague: Builder = sedan('silver', (m, _f, s) => {
  if (s === 'burnt') return;
  m.boxc('yellow', [-1.2, 0, 8.8], [1.6, 3.8, 1.2]);
  m.boxc('lampY', [-1.2, 0, 9.5], [1.2, 3.2, 0.5]);
});

export const prague: readonly CivDef[] = [
  {
    id: 'tram_prague',
    build: tram({ body: 'red', band: 'cream', skirt: 'redDk', roof: 'cream', rows: [8.2, 11.8] }),
    burnt: true,
    hw: 5.5,
  },
  { id: 'taxi_prague', build: taxiPrague, burnt: true, flipped: true, hw: 4.9, roof: 9.6 },
];
