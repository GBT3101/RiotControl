import { it, expect } from 'vitest';
import { GROUNDS, loadMap, type MapData } from '../src/maps';
import { distanceField } from './zz-oldflow';
it('old fails', () => {
    const order = ['asphalt', 'cobble', 'grass', 'parkPath', 'steps', 'cobble', 'asphalt'];
    const map = loadMap('madrid');
    const w = order.length;
    const ground = Uint8Array.from(order.map((g) => GROUNDS.indexOf(g as never)));
    const tiny = { ...map, w, h: 1, ground } as MapData;
    const f = distanceField(tiny, [{ i: 0, j: 0 }], { costs: true });
    console.log('OLD', Array.from(f).join(','));
});
