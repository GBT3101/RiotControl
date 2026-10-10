import { it } from 'vitest';
import { BLUEPRINTS, PLAYABLE_CITIES, distanceField, rasterize } from '../src/maps';
import { WALKABLE, GROUNDS } from '../src/maps/contract';
import { validateMap } from '../src/maps/validate';
it('flow audit', () => {
  for (const c of PLAYABLE_CITIES) {
    const bp = BLUEPRINTS[c]!;
    const errs: string[] = [];
    for (let seed = 0; seed <= 12; seed++)
      for (const e of validateMap(rasterize(bp, seed), bp))
        if (e.level === 'error') errs.push(`s${seed} ${e.code} ${e.msg}`);
    const map = rasterize(bp, 0);
    const f = distanceField(map, map.capitol.steps, { costs: true });
    const g = distanceField(map, map.capitol.steps, { costs: false });
    let inf = 0;
    for (let k = 0; k < f.length; k++)
      if (WALKABLE.has(GROUNDS[map.ground[k]!]!) && Number.isFinite(g[k]!) && !Number.isFinite(f[k]!)) inf++;
    console.log(`AUDIT ${c.padEnd(10)} lostTiles=${inf} errors=${errs.length} ${[...new Set(errs.map((e) => e.replace(/^s\d+ /, '')))].join(' | ')}`);
  }
}, 600000);
