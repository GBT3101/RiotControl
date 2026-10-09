const {runnerImport} = await import('vite');
const imp = async (p) => (await runnerImport(p, {configFile:false, logLevel:'error'})).module;
const R = await imp('./src/art/lib/registry.ts');
const L = await imp('./src/art/uikit/logo.ts');
const reg = new R.SpriteRegistry();
let t = performance.now(); L.registerLogo(reg); console.log('logo', performance.now()-t, reg.list().map(d=>d.name+' '+d.frames.length+' '+d.frames[0].w+'x'+d.frames[0].h));
const P = await imp('./src/art/env/props.ts'); const D = await imp('./src/art/env/decals.ts');
t = performance.now(); const pr = P.buildProps(); console.log('props', performance.now()-t, pr.length);
t = performance.now(); const dc = D.buildDecals(); console.log('decals', performance.now()-t, dc.length);
const M = await imp('./src/maps/index.ts');
const G = await imp('./src/art/env/ground.ts');
const B = await imp('./src/art/env/bld/building.ts');
for (const city of ['madrid','london','paris']) {
  t = performance.now(); const map = M.loadMap(city); const tm = performance.now()-t;
  t = performance.now(); const keys = new Set(); let water=0;
  for (let j=0;j<map.h;j++) for (let i=0;i<map.w;i++) { const c = G.groundCtxAt(map,i,j); const fr = G.groundTileFrames(c); keys.add(G.groundTileKey(c)); if (fr.length>1) water++; }
  const tg = performance.now()-t;
  t = performance.now(); let px=0; for (const b of map.buildings) { const a = B.paintBuilding(b); px += a.image.w*a.image.h; }
  console.log(city, 'map', tm.toFixed(0), 'ground', tg.toFixed(0), keys.size, 'water', water, 'bld', (performance.now()-t).toFixed(0), map.buildings.length, (px/1e6).toFixed(2)+'Mpx', 'landmarks', map.landmarks.map(l=>l.id).join(','), 'decor', map.decor.length);
}
