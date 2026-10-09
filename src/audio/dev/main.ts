/**
 * Audio dev page (`audio.html`): audition every SFX and loop, drive the adaptive music and the
 * crowd bed, run a real-time stress test with an output meter, and expose offline render
 * checks on `window.__audioDev` (used by src/audio/dev/check.mjs).
 */
import { AudioEngine } from '../engine';
import { SFX } from '../sfx/catalog';
import { LOOP_IDS, SFX_IDS, type LoopId, type MusicPhase, type SfxId, type VolumeChannel } from '../types';
import { VOLUME_CHANNELS } from '../settings';
import { renderCatalogue, renderMusic, renderStress, reportGrains, reportLoops, reportSfx } from './offline';

const audio = new AudioEngine();
audio.autoUnlock();
audio.setListener({ x: 0, y: 0 }, 2, 1440);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, kids: (Node | string)[] = []): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const k of kids) e.append(k);
  return e;
};

// ── Unlock & volumes ────────────────────────────────────────────────────────────────────

$('#unlock').addEventListener('click', () => {
  void audio.unlock().then((ok) => {
    $('#unlock').textContent = ok ? 'audio running' : 'unlock failed';
  });
});

const vol = $('#volumes');
for (const ch of VOLUME_CHANNELS) {
  const input = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(audio.getSettings()[ch]) });
  input.addEventListener('input', () => audio.setVolume(ch as VolumeChannel, Number(input.value)));
  vol.append(el('label', {}, [ch, input]));
}
const muteBox = el('input', { type: 'checkbox', checked: audio.muted });
muteBox.addEventListener('change', () => audio.mute(muteBox.checked));
vol.append(el('label', {}, ['mute', muteBox]));

// ── SFX grid ────────────────────────────────────────────────────────────────────────────

const spread = $<HTMLInputElement>('#spread');
function pos(): { x?: number; y?: number } {
  if (!spread.checked) return {};
  return { x: (Math.random() * 2 - 1) * 900, y: (Math.random() * 2 - 1) * 300 };
}
const groups: Record<string, SfxId[]> = {};
for (const id of SFX_IDS) (groups[SFX[id].bus] ??= []).push(id);
const grid = $('#sfx');
for (const [bus, ids] of Object.entries(groups)) {
  const box = el('fieldset', {}, [el('legend', { textContent: bus })]);
  for (const id of ids) {
    const b = el('button', { textContent: id, title: `${SFX[id].variants ? `baked ×${SFX[id].variants}` : 'live'}` });
    b.addEventListener('click', () => audio.play(id, pos()));
    box.append(b);
  }
  grid.append(box);
}

// ── Loops ───────────────────────────────────────────────────────────────────────────────

const loopsOn = new Set<LoopId>();
const loopBox = $('#loops');
for (const id of LOOP_IDS) {
  const cb = el('input', { type: 'checkbox' });
  cb.addEventListener('change', () => (cb.checked ? loopsOn.add(id) : loopsOn.delete(id)));
  loopBox.append(el('label', {}, [cb, id]));
}
const loopX = $<HTMLInputElement>('#loopX');
const orbit = $<HTMLInputElement>('#orbit');

// ── Music & crowd ───────────────────────────────────────────────────────────────────────

const phase = $<HTMLSelectElement>('#phase');
const city = $<HTMLSelectElement>('#city');
const level = $<HTMLInputElement>('#level');
const crowd = $<HTMLInputElement>('#crowd');
const night = $<HTMLInputElement>('#night');
const anger = $<HTMLInputElement>('#anger');
const autoAnger = $<HTMLInputElement>('#autoAnger');
function applyMusic(): void {
  audio.setCity(city.value === 'none' ? null : (city.value as 'madrid' | 'london' | 'paris'));
  audio.setMusicState({
    phase: phase.value as MusicPhase,
    level: Number(level.value),
    crowd: Number(crowd.value),
    night: night.checked,
  });
  audio.setCrowd({ size: Number(crowd.value), ...(autoAnger.checked ? { anger: undefined } : { anger: Number(anger.value) }), near: 0.7 });
  $('#levelV').textContent = level.value;
  $('#crowdV').textContent = crowd.value;
  $('#angerV').textContent = autoAnger.checked ? 'auto' : anger.value;
}
for (const i of [phase, city, level, crowd, night, anger, autoAnger]) i.addEventListener('input', applyMusic);
applyMusic();
$('#musicOff').addEventListener('click', () => {
  phase.value = 'menu';
  crowd.value = '0';
  applyMusic();
});
for (const k of ['clap', 'hoHey', 'boo'] as const) {
  $(`#chant-${k}`).addEventListener('click', () => audio.forceChant(k));
}

// ── Stress ──────────────────────────────────────────────────────────────────────────────

let stress = false;
let stressDebt = 0;
$('#stress').addEventListener('click', () => {
  stress = !stress;
  $('#stress').textContent = stress ? 'stop stress' : 'stress: 200 hits/s + MG + booms';
  if (stress) {
    crowd.value = '3000';
    level.value = '10';
    phase.value = 'wave';
    applyMusic();
  }
});
const HITS: SfxId[] = ['baton', 'punch', 'shieldThud', 'bodyFall', 'rubberHit', 'bat'];

// ── Meter & stats ───────────────────────────────────────────────────────────────────────

let tap: AnalyserNode | null = null;
let buf: Float32Array<ArrayBuffer> | null = null;
let maxPeak = 0;
let clips = 0;
$('#resetMeter').addEventListener('click', () => {
  maxPeak = 0;
  clips = 0;
});

let last = performance.now();
let frame = 0;
function loop(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frame++;
  const t = now / 1000;
  for (const id of loopsOn) {
    const x = orbit.checked ? Math.cos(t * 0.7) * 700 : Number(loopX.value);
    const y = orbit.checked ? Math.sin(t * 0.7) * 250 : 0;
    audio.loop(`dev:${id}`, id, { x, y, ttl: 0.3 });
  }
  if (stress) {
    stressDebt += 200 * dt;
    while (stressDebt >= 1) {
      stressDebt--;
      audio.play(HITS[Math.floor(Math.random() * HITS.length)]!, { x: (Math.random() * 2 - 1) * 500, y: (Math.random() * 2 - 1) * 300 });
    }
    if (frame % 6 === 0) audio.play('pistol', { x: (Math.random() * 2 - 1) * 300, y: 0 });
    if (frame % 4 === 0) audio.play('rifle', { x: (Math.random() * 2 - 1) * 300, y: 0 });
    if (frame % 30 === 0) audio.play(Math.random() < 0.5 ? 'explosionBig' : 'explosionMedium', { x: (Math.random() * 2 - 1) * 300, y: 0 });
    for (let k = 0; k < 3; k++) audio.loop(`stress-mg:${k}`, 'mgLoop', { x: (k - 1) * 250, y: 40 });
  }
  if (!tap && audio.unlocked) {
    tap = audio.outputTap();
    if (tap) buf = new Float32Array(tap.fftSize);
  }
  if (tap && buf) {
    tap.getFloatTimeDomainData(buf);
    let p = 0;
    for (let i = 0; i < buf.length; i++) {
      const a = Math.abs(buf[i]!);
      if (a > p) p = a;
      if (a >= 0.999) clips++;
    }
    maxPeak = Math.max(maxPeak, p);
    const dbv = p > 0 ? 20 * Math.log10(p) : -99;
    $<HTMLElement>('#meterBar').style.width = `${Math.max(0, Math.min(100, ((dbv + 48) / 48) * 100))}%`;
    $('#meterTxt').textContent = `${dbv.toFixed(1)} dBFS  (max ${(20 * Math.log10(maxPeak || 1e-9)).toFixed(1)}, clipped samples ${clips})`;
  }
  if (frame % 10 === 0) $('#stats').textContent = JSON.stringify(audio.stats(), null, 1);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── Offline checks ──────────────────────────────────────────────────────────────────────

const dev = { reportSfx, reportLoops, reportGrains, renderMusic, renderStress, renderCatalogue, audio };
(window as unknown as { __audioDev: typeof dev }).__audioDev = dev;

$('#offline').addEventListener('click', () => {
  $('#offlineOut').textContent = 'rendering…';
  void (async () => {
    const sfx = await reportSfx();
    const lines = sfx.map(
      (r) => `${r.id.padEnd(16)} peak ${r.outPeak.toFixed(2)}  rms ${r.outRms.toFixed(3)}  ${r.duration.toFixed(2)}s  ${r.renderMs.toFixed(0)}ms`,
    );
    const st = await renderStress(4);
    lines.push('', `stress: peak ${st.peakDb.toFixed(1)} dBFS, rms ${st.rmsDb.toFixed(1)} dBFS, clipped ${st.clipped}, load ${st.load.toFixed(2)}`);
    $('#offlineOut').textContent = lines.join('\n');
  })();
});

document.documentElement.dataset.ready = 'true';
