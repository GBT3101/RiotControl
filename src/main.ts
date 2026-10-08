/**
 * Game entry: pixel stage → art registry → atlas → (M1) test map scene.
 * Query params (dev): ?seed=7&cops=50&zoom=3&u=36&v=36&debug
 */
import { createArtRegistry } from './art';
import { buildArt } from './art/lib/atlas';
import { readSceneParams, startTestMapScene } from './demo/testMapScene';
import { createPixelStage } from './render/stage';

async function boot(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game element missing');
  const stage = await createPixelStage(host);
  buildArt(createArtRegistry());
  startTestMapScene(stage, readSceneParams(location.search));
}

boot().catch((err: unknown) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.className = 'boot-error';
  pre.textContent = `Riot Control failed to start:\n${err instanceof Error ? err.stack : String(err)}`;
  document.body.appendChild(pre);
});
