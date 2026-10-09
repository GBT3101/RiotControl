const {runnerImport} = await import('vite');
const imp = async (p) => (await runnerImport(p, {configFile:false, logLevel:'error'})).module;
const R = await imp('./src/art/lib/registry.ts');
const F = await imp('./src/art/fx/index.ts');
const reg = new R.SpriteRegistry(); F.registerFx(reg);
console.log(reg.list().map(d=>d.name+'('+d.frames.length+'@'+d.fps+','+d.frames[0].w+'x'+d.frames[0].h+')').join(' '));
