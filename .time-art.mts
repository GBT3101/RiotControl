const {runnerImport} = await import('vite');
const t0 = performance.now();
const imp = async (p) => (await runnerImport(p, {configFile:false, logLevel:'error'})).module;
const R = await imp('./src/art/lib/registry.ts');
const mods = {
  stubTiles: ['./src/art/tiles/stubTiles.ts','registerStubTiles'],
  stubBoxes: ['./src/art/buildings/stubBoxes.ts','registerStubBoxes'],
  cursors: ['./src/art/ui/cursors.ts','registerCursors'],
  env: ['./src/art/env/index.ts','registerEnvironment'],
  landmarks: ['./src/art/landmarks/index.ts','registerLandmarks'],
  units: ['./src/art/units/index.ts','registerUnits'],
  protesters: ['./src/art/protesters/index.ts','registerProtesters'],
  vehicles: ['./src/art/vehicles/index.ts','registerVehicles'],
  fx: ['./src/art/fx/index.ts','registerFx'],
  uikit: ['./src/art/uikit/index.ts','registerUiKit'],
};
console.log('import base', (performance.now()-t0).toFixed(0));
for (const [k,[p,f]] of Object.entries(mods)) {
  const m = await imp(p);
  const reg = new R.SpriteRegistry();
  const t = performance.now();
  m[f](reg);
  let px=0, fr=0; for (const d of reg.list()) for (const b of d.frames) { px += b.w*b.h; fr++; }
  console.log(k, (performance.now()-t).toFixed(0)+'ms', reg.size, 'sprites', fr, 'frames', (px/1e6).toFixed(2)+'Mpx');
}
const P = await imp('./src/art/protesters/index.ts');
for (const city of ['madrid']) { const reg = new R.SpriteRegistry(); const t=performance.now(); const m = P.buildProtesterSheets(reg,{city, seed:1}); console.log('protSheets', city, (performance.now()-t).toFixed(0), reg.size, m.frames, (m.pixels/1e6).toFixed(2)); }
