/**
 * Game entry. Without `?city` the game opens on the title screen (M9: title → city select →
 * run); `?city=madrid|london|paris` (or `?skipTitle=1`) boots straight into a run. The M1
 * test-map demo stays reachable with `?demo=1`. All debug params: src/game/params.ts.
 */
import { readParams } from './game/params';

async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game element missing');
  const params = readParams(location.search);
  if (params.demo) {
    const [
      { createArtRegistry },
      { buildArt },
      { readSceneParams, startTestMapScene },
      { createPixelStage },
    ] = await Promise.all([
      import('./art'),
      import('./art/lib/atlas'),
      import('./demo/testMapScene'),
      import('./render/stage'),
    ]);
    const stage = await createPixelStage(host);
    buildArt(createArtRegistry());
    startTestMapScene(stage, readSceneParams(location.search));
    return;
  }
  const [{ createPixelStage }, { startApp }] = await Promise.all([
    import('./render/stage'),
    import('./ui/app'),
  ]);
  const stage = await createPixelStage(host);
  await startApp(stage, host, params);
}

boot().catch((err: unknown) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.className = 'boot-error';
  pre.textContent = `Riot Control failed to start:\n${err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)}`;
  document.body.appendChild(pre);
});
