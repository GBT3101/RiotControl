/**
 * AMSTERDAM city vehicles (E3 North): the GVB tram, white with blue skirt and a blue nose.
 */
import { boxVehicle, type Builder, type CivDef } from '../civil';

/** Low-floor articulated tram: long white body, blue skirt and front, pantograph. */
const tram: Builder = (f, s) =>
  boxVehicle(
    {
      L: 58,
      W: 11,
      H: 14,
      wheelR: 2.2,
      wheelX: [-22, -8, 8, 22],
      sill: 1.2,
      body: 'white',
      screenZ: 4.2,
      rake: 0.6,
      bevel: 1.4,
      paint: (_p, n, q) => {
        const side = Math.abs(n[1]) > 0.6;
        if (q[2] < 4.0 && Math.abs(n[2]) < 0.6) return 'blue';
        if (n[0] > 0.5 && q[2] < 6.5) return 'blue';
        if (side) {
          // Articulation joints.
          if (Math.abs(q[0] + 9.5) < 0.5 || Math.abs(q[0] - 9.5) < 0.5) return 'dark';
          if (q[2] > 6.0 && q[2] < 11.6) {
            if (Math.floor((q[0] + 80) / 4) !== Math.floor((q[0] + 80.6) / 4)) return 'white';
            return s === 'ok' && Math.abs(q[0] - (q[2] - 6) * 0.8 + 3) < 0.4 ? 'glassHi' : 'glass';
          }
          // Doors.
          for (const x of [-15, 0, 15]) if (Math.abs(q[0] - x) < 1.6 && q[2] < 11.6) return 'dark';
          if (q[2] > 12.4 && q[2] < 13.2) return 'blue';
        }
        if (n[0] > 0.5 && q[2] > 11.8 && Math.abs(q[1]) < 3.5)
          return s === 'ok' ? 'lampAmber' : 'dark';
        return undefined;
      },
      extras: (m, _f, st) => {
        if (st === 'burnt') return;
        // Roof boxes and the pantograph.
        m.box('gray', [-6, -3, 14], [6, 3, 15.2]);
        m.box('steel', [-4, -0.3, 15.2], [3, 0.3, 15.7]);
        m.box('steel', [2.6, -2.6, 18.8], [3.4, 2.6, 19.3]);
        for (let k = 0; k < 6; k++)
          m.box(
            'steel',
            [-1 + k * 0.6, -0.25, 15.6 + k * 0.55],
            [-0.4 + k * 0.6, 0.25, 16.2 + k * 0.55],
          );
      },
    },
    f,
    s,
  );

export const amsterdam: readonly CivDef[] = [
  { id: 'tram_amsterdam', build: tram, burnt: true, hw: 5.5, roof: 14 },
];
