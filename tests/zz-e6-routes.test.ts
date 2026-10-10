import { it } from 'vitest';
import { BLUEPRINTS, PLAYABLE_CITIES, descend, distanceField, rasterize } from '../src/maps';
import * as old from './zz-oldflow';
it('routes', () => {
  for (const c of PLAYABLE_CITIES) {
    const map = rasterize(BLUEPRINTS[c]!, 0);
    const fN = distanceField(map, map.capitol.steps, { costs: true });
    const fO = old.distanceField(map, map.capitol.steps, { costs: true });
    const out: string[] = [];
    for (const s of map.spawns) {
      const hits = (f: Float32Array, d: typeof descend) => {
        const r = d(map, f, s.rally);
        return map.chokepoints.filter((ch) => r.some((p) => Math.hypot(p.i - ch.i, p.j - ch.j) <= ch.radius + 1.5)).map((ch) => ch.name).join('+') || '-';
      };
      const a = hits(fO, old.descend as typeof descend);
      const b = hits(fN, descend);
      const dn = fN[s.rally.j * map.w + s.rally.i]!;
      const dO = fO[s.rally.j * map.w + s.rally.i]!;
      out.push(`${s.name}: ${a === b ? b : a + ' => ' + b} (${dO.toFixed(0)}→${dn.toFixed(0)})`);
    }
    console.log(`ROUTES ${c}: ${out.join(' ; ')}`);
  }
});
