/**
 * Riot Control — procedural audio (M11). Pure WebAudio, no files, no deps.
 * See docs/M11.md for the integration guide.
 */
export { AudioEngine, createAudio, type Audio, type AudioOptions } from './engine';
export {
  busSource,
  IGNORED_SIM_EVENTS,
  SIM_EVENT_AUDIO,
  SIM_EVENT_TYPES,
  type SimBindOptions,
  type SimEventSource,
} from './simEvents';
export { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_KEY } from './settings';
export { musicIntensity } from './music/patterns';
export * from './types';
