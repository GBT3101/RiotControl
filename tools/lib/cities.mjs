/**
 * Playable cities for Node tools (playtest, soak): the cities with a blueprint
 * (src/maps/cities/index.ts), loaded through Vite's module runner. `pickCities` validates a
 * `--cities a,b` list against them (an unbuilt city is a usage error, not a silent Madrid).
 */
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

const ROOT = resolve(import.meta.dirname, '../..');

export async function playableCities() {
  const maps = await runnerImport(resolve(ROOT, 'src/maps/index.ts'), {
    root: ROOT,
    configFile: false,
    logLevel: 'error',
  });
  return [...maps.module.PLAYABLE_CITIES];
}

/** `--cities` value (comma list; empty / 'all' = every playable city) → validated list. */
export async function pickCities(arg, tool) {
  const playable = await playableCities();
  const asked = !arg || arg === 'all' ? playable : arg.split(',').filter(Boolean);
  const bad = asked.filter((c) => !playable.includes(c));
  if (bad.length) {
    console.error(
      `${tool}: not playable yet (no blueprint): ${bad.join(', ')} — playable: ${playable.join(', ')}`,
    );
    process.exit(2);
  }
  return asked;
}
