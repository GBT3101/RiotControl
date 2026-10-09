/**
 * Game entry. `?city=madrid|london|paris` (default Madrid) boots straight into a run; the M1
 * test-map demo stays reachable with `?demo=1`. All debug params: src/game/params.ts.
 */
import { bootGame } from './game/boot';
import { readParams } from './game/params';

async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game element missing');
  const params = readParams(location.search);
  if (params.demo) {
    const [{ createArtRegistry }, { buildArt }, { readSceneParams, startTestMapScene }, { createPixelStage }] =
      await Promise.all([
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
  await bootGame(host, params);
}

boot().catch((err: unknown) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.className = 'boot-error';
  pre.textContent = `Riot Control failed to start:\n${err instanceof Error ? err.stack : String(err)}`;
  document.body.appendChild(pre);
});
