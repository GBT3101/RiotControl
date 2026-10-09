const {runnerImport} = await import('vite');
const imp = async (p) => (await runnerImport(p, {configFile:false, logLevel:'error'})).module;
const J = await imp('./src/game/assets/jobs.ts');
const jobs = [
 {kind:'buildings', city:'madrid', mapSeed:0, part:0, parts:3},
 {kind:'buildings', city:'madrid', mapSeed:0, part:1, parts:3},
 {kind:'terrain', city:'madrid', mapSeed:0, part:0, parts:5},
 {kind:'terrain', city:'madrid', mapSeed:0, part:1, parts:5},
 {kind:'landmarks', city:'madrid', mapSeed:0},
 {kind:'capitol', city:'madrid', states:[0]},
 {kind:'fxui'},
 {kind:'units'},
 {kind:'protesters', city:'madrid', seed:1, types:['woke'], from:0, to:8},
];
for (const j of jobs) { const t=performance.now(); const r = J.runJob(j); console.log(j.kind, j.part ?? '', (performance.now()-t).toFixed(0), 'ms', r.atlas ? r.atlas.pages.map(p=>p.w+'x'+p.h).join(',') : ''); }
