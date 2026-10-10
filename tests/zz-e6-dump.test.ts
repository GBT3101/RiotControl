import { it } from 'vitest';
import { BLUEPRINTS, descend, distanceField, rasterize } from '../src/maps';
const CH = 'L.-,_SB"g~q';
it('dump', () => {
  const city = (process.env.CITY ?? 'paris') as 'paris';
  const bp = BLUEPRINTS[city]!;
  const map = rasterize(bp, Number(process.env.SEED ?? 0));
  const f = distanceField(map, map.capitol.steps, { costs: true });
  const rows = Array.from({ length: map.h }, (_, j) =>
    Array.from({ length: map.w }, (_, i) => (map.building[j * map.w + i] !== -1 ? '#' : CH[map.ground[j * map.w + i]!]!)),
  );
  map.spawns.forEach((s, n) => {
    for (const p of descend(map, f, s.rally)) rows[p.j]![p.i] = String(n);
    rows[s.rally.j]![s.rally.i] = 'R';
  });
  for (const c of map.chokepoints) rows[Math.round(c.j)]![Math.round(c.i)] = 'X';
  const out = ['    ' + Array.from({ length: map.w }, (_, i) => String(Math.floor(i / 10))).join(''), '    ' + Array.from({ length: map.w }, (_, i) => String(i % 10)).join('')];
  rows.forEach((r, j) => out.push(String(j).padStart(3) + ' ' + r.join('')));
  console.log('DUMP\n' + out.join('\n'));
  console.log('DUMP spawns ' + map.spawns.map((s, n) => `${n}=${s.name ?? s.id}@${s.rally.i},${s.rally.j} d=${f[s.rally.j * map.w + s.rally.i]!.toFixed(1)}`).join(' '));
  console.log('DUMP chokes ' + map.chokepoints.map((c) => `${c.name}@${c.i},${c.j} r${c.radius}`).join(' | '));
});
