/**
 * The audio engine: context lifecycle, mixer, voices, loops, crowd bed, music, sim binding.
 *
 * Graph:
 *   voices ─► [sfx | ui | ambience] bus ─┐
 *   music ─► EQ (hold-music "phone" band) ─► music bus ─┤─► master ─► glue comp ─► limiter ─► out
 *   sfx & music buses ─► room (two damped feedback delays) ─┘
 * Each bus = volume gain → duck gain. Mute suspends the context (zero CPU) and drops requests.
 */
import { tileToWorld } from '../core/iso';
import type { SimEvent } from '../sim/events';
import { bakeLoop, bakeRecipe, offlineCtor, trimBuffer, variantRng } from './baker';
import { bakeGrains, CrowdBed } from './crowd';
import { SfxLimiter, type Trigger } from './limiter';
import { musicIntensity, type Flavour, type Theme } from './music/patterns';
import { Sequencer } from './music/sequencer';
import {
  DEFAULT_SETTINGS,
  defaultStorage,
  loadSettings,
  saveSettings,
  sanitizeSettings,
  sliderToGain,
  type SettingsStorage,
} from './settings';
import { policyOf, SFX } from './sfx/catalog';
import { noiseBuffer, Synth } from './sfx/kit';
import { LOOPS } from './sfx/loops';
import {
  createSimMapState,
  mapSimEvent,
  type SimBindOptions,
  type SimEventSource,
  type SimMapState,
} from './simEvents';
import { CULL_GAIN, DEFAULT_LISTENER, makeListener, spatialize, type Listener } from './spatial';
import {
  BUSES,
  type AudioCity,
  type AudioSettings,
  type AudioStats,
  type BusName,
  type CrowdInfo,
  type LoopId,
  type LoopOptions,
  type MusicState,
  type PlayOptions,
  type SfxId,
  type VolumeChannel,
  type WorldPos,
} from './types';

export interface AudioOptions {
  /** Settings storage (default: localStorage when available; null = don't persist). */
  storage?: SettingsStorage | null;
  storageKey?: string;
  /** Music seed: the same seed gives the same tunes (default 1 → stable per city). */
  seed?: number;
  /** Supply a context (e.g. OfflineAudioContext for render checks). */
  context?: BaseAudioContext;
  /** Override the clock used for voice/loop scheduling (offline renders). */
  clock?: () => number;
  /** Lower voice caps for weak devices. */
  quality?: 'low' | 'normal';
  /** Don't start the background tick timer (offline/manual driving via `update`). */
  manual?: boolean;
}

/** Everything the game needs (M8/M9 wiring, see docs/M11.md). */
export interface Audio {
  readonly unlocked: boolean;
  readonly muted: boolean;
  /** Create/resume the AudioContext. Call from a user gesture handler (mobile/iOS). */
  unlock(): Promise<boolean>;
  /** Attach gesture listeners that unlock (and re-resume after iOS interruptions). */
  autoUnlock(target?: EventTarget): () => void;
  setCity(city: AudioCity | null): void;
  setMusicState(state: Partial<MusicState>): void;
  play(id: SfxId, opts?: PlayOptions): void;
  /** Keep-alive sustained sound: call every frame (or event) while it should sound. */
  loop(key: string, id: LoopId, opts?: LoopOptions): void;
  stopLoop(key: string): void;
  setCrowd(info: CrowdInfo): void;
  /** Map sim events to sounds. `source` may be null when feeding via `handleSimEvents`. */
  bindSimEvents(source: SimEventSource | null, opts?: SimBindOptions): () => void;
  handleSimEvents(events: readonly SimEvent[]): void;
  /** Camera centre (world px), zoom (device px per world px), canvas width (device px). */
  setListener(center: WorldPos, zoom: number, viewW: number): void;
  setVolume(channel: VolumeChannel, value: number): void;
  setVolumes(v: Partial<Omit<AudioSettings, 'muted'>>): void;
  /** Set mute, or toggle when called without an argument. */
  mute(muted?: boolean): void;
  getSettings(): AudioSettings;
  stats(): AudioStats;
  dispose(): void;
}

interface Bus {
  vol: GainNode;
  duck: GainNode;
}

interface VoiceRec {
  out: GainNode;
  srcs: AudioScheduledSourceNode[];
  end: number;
}

interface LoopEmitter {
  key: string;
  id: LoopId;
  x?: number;
  y?: number;
  volume: number;
  rate: number;
  ttl: number;
  lastSeen: number;
  vx: number;
  vy: number;
  lastPosT: number;
  playing: {
    src: AudioBufferSourceNode;
    gain: GainNode;
    pan: StereoPannerNode | null;
    lp: BiquadFilterNode;
  } | null;
  gainNow: number;
  pan: number;
  lpf: number;
}

type AudioCtor = new (opts?: AudioContextOptions) => AudioContext;

function audioCtor(): AudioCtor | null {
  const g = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Sounds pre-baked right after unlock (most frequent first). */
const PREBAKE: readonly SfxId[] = [
  'baton', 'punch', 'shieldThud', 'bodyFall', 'pistol', 'rifle', 'rubberPop', 'rubberHit',
  'doorOpen', 'hateChing', 'typeTick', 'click', 'hover', 'deploy', 'koBoing', 'bulletHit',
  'metalHit', 'gasSpray', 'canisterPop', 'explosionBig', 'explosionMedium', 'sniper',
];

export class AudioEngine implements Audio {
  private ctx: BaseAudioContext | null = null;
  private live: AudioContext | null = null;
  private settings: AudioSettings;
  private readonly storage: SettingsStorage | null;
  private readonly storageKey: string | undefined;
  private buses = {} as Record<BusName, Bus>;
  private master: GainNode | null = null;
  private outNode: GainNode | null = null;
  private eq: { hp: BiquadFilterNode; lp: BiquadFilterNode } | null = null;
  private listener: Listener = DEFAULT_LISTENER;
  readonly limiter: SfxLimiter;
  private voices = new Map<number, VoiceRec>();
  private baked = new Map<string, AudioBuffer[]>();
  private bakeQueue: string[] = [];
  private bakeSet = new Set<string>();
  private baking = false;
  private loops = new Map<string, LoopEmitter>();
  private crowdBed: CrowdBed | null = null;
  private seq: Sequencer | null = null;
  private music: MusicState = { phase: 'menu', level: 0, crowd: 0, night: false };
  private musicSet = false;
  private city: AudioCity | null = null;
  private crowd: CrowdInfo = { size: 0 };
  private flushQueued = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastPoll = 0;
  private sim: SimMapState = createSimMapState();
  private simUnsub: (() => void) | null = null;
  private anger = 0.3;
  private counters = { culled: 0 };
  private disposed = false;
  private unlockListeners: (() => void) | null = null;
  private readonly opts: AudioOptions;
  private onVisibility = (): void => this.visibility();

  constructor(opts: AudioOptions = {}) {
    this.opts = opts;
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage;
    this.storageKey = opts.storageKey;
    this.settings = loadSettings(this.storage, this.storageKey);
    const low = opts.quality === 'low';
    this.limiter = new SfxLimiter(policyOf, {
      maxVoices: low ? 24 : 40,
      maxPerFlush: low ? 8 : 12,
      maxPerSecond: low ? 30 : 50,
    });
    if (opts.context) this.build(opts.context);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────────────

  get unlocked(): boolean {
    return !!this.ctx && (!this.live || this.live.state === 'running');
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  get context(): BaseAudioContext | null {
    return this.ctx;
  }

  private now(): number {
    return this.opts.clock ? this.opts.clock() : (this.ctx?.currentTime ?? 0);
  }

  unlock(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (!this.ctx) {
      const Ctor = audioCtor();
      if (!Ctor) return Promise.resolve(false);
      let c: AudioContext;
      try {
        c = new Ctor({ latencyHint: 'interactive' });
      } catch {
        try {
          c = new Ctor();
        } catch {
          return Promise.resolve(false);
        }
      }
      this.live = c;
      this.build(c);
    }
    const live = this.live;
    if (!live) return Promise.resolve(true);
    // iOS: start a silent buffer inside the gesture to unlock output.
    try {
      const b = live.createBuffer(1, 1, live.sampleRate);
      const s = live.createBufferSource();
      s.buffer = b;
      s.connect(live.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
    if (this.settings.muted) return Promise.resolve(true);
    if (live.state === 'running') return Promise.resolve(true);
    return live.resume().then(
      () => (live.state as string) === 'running',
      () => false,
    );
  }

  autoUnlock(target: EventTarget = globalThis as unknown as EventTarget): () => void {
    if (this.unlockListeners) return this.unlockListeners;
    const types = ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'];
    const h = (): void => {
      if (!this.ctx || (this.live && this.live.state !== 'running' && !this.settings.muted)) {
        void this.unlock();
      }
    };
    for (const t of types) target.addEventListener(t, h, { capture: true, passive: true });
    const off = (): void => {
      for (const t of types) target.removeEventListener(t, h, { capture: true });
      this.unlockListeners = null;
    };
    this.unlockListeners = off;
    return off;
  }

  private build(c: BaseAudioContext): void {
    this.ctx = c;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.12;
    const trim = c.createGain();
    trim.gain.value = 0.9;
    this.master = c.createGain();
    this.master.connect(comp).connect(lim).connect(trim).connect(c.destination);
    this.outNode = trim;

    // Room: two damped feedback delays (cheap "space" for guns, booms and the band).
    const roomIn = c.createGain();
    const roomOut = c.createGain();
    roomOut.gain.value = 0.5;
    for (const [d, fb] of [
      [0.087, 0.32],
      [0.131, 0.28],
    ] as const) {
      const delay = c.createDelay(0.5);
      delay.delayTime.value = d;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      const g = c.createGain();
      g.gain.value = fb;
      roomIn.connect(delay).connect(lp).connect(g).connect(delay);
      lp.connect(roomOut);
    }
    roomOut.connect(this.master);

    for (const name of BUSES) {
      const vol = c.createGain();
      const duck = c.createGain();
      vol.connect(duck).connect(this.master);
      this.buses[name] = { vol, duck };
    }
    const sendSfx = c.createGain();
    sendSfx.gain.value = 0.12;
    this.buses.sfx.duck.connect(sendSfx).connect(roomIn);
    const sendMusic = c.createGain();
    sendMusic.gain.value = 0.18;
    this.buses.music.duck.connect(sendMusic).connect(roomIn);

    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 20;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 20000;
    hp.connect(lp).connect(this.buses.music.vol);
    this.eq = { hp, lp };

    this.applyVolumes();
    this.seq = new Sequencer(c, hp, this.opts.seed ?? 1);
    this.crowdBed = new CrowdBed(
      c,
      this.buses.ambience.vol,
      (k) => noiseBuffer(c, k),
      (now) => this.seq?.clock(now) ?? null,
    );
    this.applyMusic();
    if (!this.opts.manual) {
      this.timer = setInterval(() => this.update(), 50);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
    }
    void this.prebake();
  }

  private visibility(): void {
    if (!this.live || typeof document === 'undefined') return;
    if (document.hidden) void this.live.suspend().catch(() => {});
    else if (!this.settings.muted) void this.live.resume().catch(() => {});
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.simUnsub?.();
    this.unlockListeners?.();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.live) void this.live.close().catch(() => {});
    this.ctx = null;
    this.live = null;
  }

  // ── Settings ──────────────────────────────────────────────────────────────────────────

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setVolume(channel: VolumeChannel, value: number): void {
    this.setVolumes({ [channel]: value });
  }

  setVolumes(v: Partial<Omit<AudioSettings, 'muted'>>): void {
    this.settings = sanitizeSettings({ ...this.settings, ...v });
    saveSettings(this.settings, this.storage, this.storageKey);
    this.applyVolumes();
  }

  mute(muted?: boolean): void {
    const m = muted ?? !this.settings.muted;
    this.settings = { ...this.settings, muted: m };
    saveSettings(this.settings, this.storage, this.storageKey);
    this.applyVolumes();
    if (this.live) {
      if (m) void this.live.suspend().catch(() => {});
      else void this.live.resume().catch(() => {});
    }
  }

  private applyVolumes(): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : sliderToGain(s.master), t, 0.03);
    for (const name of BUSES) this.buses[name].vol.gain.setTargetAtTime(sliderToGain(s[name]), t, 0.03);
  }

  private duck(bus: BusName, db: number, hold: number): void {
    const c = this.ctx;
    if (!c) return;
    const g = this.buses[bus].duck.gain;
    const t = this.now();
    const target = Math.pow(10, -db / 20);
    g.cancelScheduledValues(t);
    g.setTargetAtTime(Math.min(g.value, target), t, 0.02);
    g.setTargetAtTime(1, t + hold, 0.35);
  }

  // ── Listener ──────────────────────────────────────────────────────────────────────────

  setListener(center: WorldPos, zoom: number, viewW: number): void {
    this.listener = makeListener(center, zoom, viewW);
  }

  // ── One-shots ─────────────────────────────────────────────────────────────────────────

  play(id: SfxId, o: PlayOptions = {}): void {
    if (!this.ctx || this.settings.muted || this.disposed) return;
    const def = SFX[id];
    if (!def) return;
    let gain = o.volume ?? 1;
    let pan = 0;
    let lowpass = 0;
    if (def.spatial && o.x !== undefined && o.y !== undefined) {
      const sp = spatialize(o.x, o.y, this.listener);
      if (sp.gain * gain < CULL_GAIN) {
        this.counters.culled++;
        return;
      }
      gain *= sp.gain;
      pan = sp.pan;
      lowpass = sp.lowpass;
    }
    this.limiter.submit({ id, gain, pan, pitch: o.pitch ?? 1, delay: Math.max(0, o.delay ?? 0), lowpass });
    this.queueFlush();
  }

  private queueFlush(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    queueMicrotask(() => {
      this.flushQueued = false;
      this.flush();
    });
  }

  /** Resolve pending requests into voices now (normally automatic, once per microtask). */
  flush(): void {
    if (!this.ctx) return;
    const now = this.now();
    for (const tr of this.limiter.flush(now)) this.startVoice(tr, now);
  }

  private startVoice(tr: Trigger, now: number): void {
    const c = this.ctx!;
    const id = tr.id as SfxId;
    const def = SFX[id];
    if (tr.steal >= 0) this.killVoice(tr.steal, now);
    const t0 = now + tr.delay;
    const out = c.createGain();
    out.gain.value = tr.gain * def.gain;
    let head: AudioNode = out;
    if (tr.lowpass > 0) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = tr.lowpass;
      head.connect(lp);
      head = lp;
    }
    if (tr.pan !== 0 && typeof c.createStereoPanner === 'function') {
      const p = c.createStereoPanner();
      p.pan.value = tr.pan;
      head.connect(p);
      head = p;
    }
    head.connect(this.buses[def.bus].vol);
    const rate = tr.pitch * (1 + (Math.random() * 2 - 1) * def.jitter);
    const srcs: AudioScheduledSourceNode[] = [];
    let end = t0 + def.dur / rate;
    const buffers = this.baked.get(id);
    if (buffers && buffers.length) {
      const k = Math.floor(Math.random() * buffers.length);
      const play = (buf: AudioBuffer, at: number, r: number, g: number): void => {
        const src = c.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = r;
        if (g !== 1) {
          const gg = c.createGain();
          gg.gain.value = g;
          src.connect(gg).connect(out);
        } else src.connect(out);
        src.start(at);
        srcs.push(src);
        end = Math.max(end, at + buf.duration / r);
      };
      end = 0;
      play(buffers[k]!, t0, rate, 1);
      // Aggregated crowds of hits: layer more variants for a denser, fuller impact.
      if (tr.count >= 3 && buffers.length > 1) {
        play(buffers[(k + 1) % buffers.length]!, t0 + 0.012 + Math.random() * 0.02, rate * 1.03, 0.55);
      }
      if (tr.count >= 10 && buffers.length > 2) {
        play(buffers[(k + 2) % buffers.length]!, t0 + 0.035 + Math.random() * 0.025, rate * 0.97, 0.4);
      }
    } else {
      def.recipe(new Synth(c, out, t0, Math.random, rate));
      if (def.variants > 0) this.requestBake(id);
    }
    this.voices.set(tr.token, { out, srcs, end });
    this.limiter.setEnd(tr.token, end);
    if (def.duck) this.duck(def.duck.bus, def.duck.db, def.duck.hold);
    if (!this.opts.manual) {
      const ms = Math.max(50, (end - now) * 1000 + 100);
      setTimeout(() => this.releaseVoice(tr.token), ms);
    }
  }

  private releaseVoice(token: number): void {
    const v = this.voices.get(token);
    if (!v) return;
    this.voices.delete(token);
    try {
      v.out.disconnect();
    } catch {
      /* already gone */
    }
  }

  private killVoice(token: number, now: number): void {
    const v = this.voices.get(token);
    if (!v) return;
    v.out.gain.cancelScheduledValues(now);
    v.out.gain.setTargetAtTime(0, now, 0.01);
    for (const s of v.srcs) {
      try {
        s.stop(now + 0.05);
      } catch {
        /* not started yet / already stopped */
      }
    }
    this.voices.delete(token);
    if (!this.opts.manual) setTimeout(() => v.out.disconnect(), 120);
  }

  // ── Baking ────────────────────────────────────────────────────────────────────────────

  private requestBake(key: string): void {
    if (this.bakeSet.has(key) || this.baked.has(key) || !offlineCtor()) return;
    this.bakeSet.add(key);
    this.bakeQueue.push(key);
    void this.runBakes();
  }

  private async runBakes(): Promise<void> {
    if (this.baking) return;
    this.baking = true;
    try {
      while (this.bakeQueue.length && this.ctx && !this.disposed) {
        const key = this.bakeQueue.shift()!;
        await this.bakeOne(key);
      }
    } finally {
      this.baking = false;
    }
  }

  private async bakeOne(key: string): Promise<void> {
    const c = this.ctx;
    if (!c) return;
    const sr = c.sampleRate;
    const make = (ch: number, len: number, rate: number): AudioBuffer => c.createBuffer(ch, len, rate);
    try {
      if (key.startsWith('loop:')) {
        const id = key.slice(5) as LoopId;
        const d = LOOPS[id];
        const buf = await bakeLoop(sr, d.length, d.xfade, d.recipe, variantRng(key, 0), make);
        this.baked.set(key, [buf]);
      } else if (key === 'grains') {
        const g = await bakeGrains(sr);
        this.crowdBed?.setGrains(g);
        this.baked.set(key, []);
      } else {
        const def = SFX[key as SfxId];
        const list: AudioBuffer[] = [];
        const n = this.opts.quality === 'low' ? Math.min(2, def.variants) : def.variants;
        for (let v = 0; v < n; v++) {
          const raw = await bakeRecipe(sr, def.dur, def.recipe, variantRng(key, v));
          list.push(trimBuffer(raw, make));
        }
        this.baked.set(key, list);
      }
    } catch {
      this.baked.set(key, []); // give up: live synthesis keeps working
    } finally {
      this.bakeSet.delete(key);
    }
  }

  /** Bake loops, crowd grains and the most frequent one-shots (background, serial). */
  prebake(ids: readonly string[] = []): Promise<void> {
    const keys = ids.length
      ? ids
      : [
          ...Object.keys(LOOPS).map((k) => `loop:${k}`),
          'grains',
          ...PREBAKE,
        ];
    for (const k of keys) this.requestBake(k);
    return this.waitBakes();
  }

  /** Resolves when the bake queue is empty. */
  async waitBakes(): Promise<void> {
    while (this.baking || this.bakeQueue.length) await new Promise((r) => setTimeout(r, 10));
  }

  getBaked(id: string): readonly AudioBuffer[] | undefined {
    return this.baked.get(id);
  }

  // ── Loops ─────────────────────────────────────────────────────────────────────────────

  loop(key: string, id: LoopId, o: LoopOptions = {}): void {
    if (!this.ctx || this.settings.muted || this.disposed) return;
    const now = this.now();
    let e = this.loops.get(key);
    if (!e) {
      e = {
        key,
        id,
        volume: 1,
        rate: 1,
        ttl: 0.25,
        lastSeen: now,
        vx: 0,
        vy: 0,
        lastPosT: now,
        playing: null,
        gainNow: 0,
        pan: 0,
        lpf: 0,
      };
      this.loops.set(key, e);
      if (!this.baked.has(`loop:${id}`)) this.requestBake(`loop:${id}`);
    }
    if (o.x !== undefined && o.y !== undefined) {
      if (e.x !== undefined && e.y !== undefined && now > e.lastPosT + 0.02) {
        const dt = now - e.lastPosT;
        e.vx = e.vx * 0.6 + ((o.x - e.x) / dt) * 0.4;
        e.vy = e.vy * 0.6 + ((o.y - e.y) / dt) * 0.4;
        e.lastPosT = now;
      } else if (e.x === undefined) e.lastPosT = now;
      e.x = o.x;
      e.y = o.y;
    }
    e.volume = o.volume ?? e.volume;
    e.rate = o.rate ?? e.rate;
    e.ttl = o.ttl ?? e.ttl;
    e.lastSeen = now;
  }

  stopLoop(key: string): void {
    const e = this.loops.get(key);
    if (!e) return;
    this.stopEmitter(e, this.now());
    this.loops.delete(key);
  }

  private stopEmitter(e: LoopEmitter, now: number): void {
    const p = e.playing;
    if (!p) return;
    const d = LOOPS[e.id];
    p.gain.gain.cancelScheduledValues(now);
    p.gain.gain.setValueAtTime(p.gain.gain.value, now);
    p.gain.gain.linearRampToValueAtTime(0, now + d.fadeOut);
    try {
      p.src.stop(now + d.fadeOut + 0.02);
    } catch {
      /* ignore */
    }
    if (!this.opts.manual) setTimeout(() => p.gain.disconnect(), (d.fadeOut + 0.2) * 1000);
    e.playing = null;
  }

  private updateLoops(now: number): void {
    const groups = new Map<LoopId, LoopEmitter[]>();
    for (const e of this.loops.values()) {
      if (now - e.lastSeen > e.ttl) {
        this.stopEmitter(e, now);
        this.loops.delete(e.key);
        continue;
      }
      let g = 1;
      let pan = 0;
      let lp = 0;
      if (e.x !== undefined && e.y !== undefined) {
        const sp = spatialize(e.x, e.y, this.listener);
        g = sp.gain;
        pan = sp.pan;
        lp = sp.lowpass;
      }
      e.gainNow = g * e.volume;
      e.pan = pan;
      e.lpf = lp;
      const list = groups.get(e.id) ?? [];
      list.push(e);
      groups.set(e.id, list);
    }
    for (const [id, list] of groups) {
      const def = LOOPS[id];
      list.sort((a, b) => b.gainNow - a.gainNow);
      list.forEach((e, i) => {
        const audible = i < def.max && e.gainNow >= CULL_GAIN;
        if (!audible) {
          this.stopEmitter(e, now);
          return;
        }
        if (!e.playing) this.startEmitter(e, now);
        const p = e.playing;
        if (!p) return;
        p.gain.gain.setTargetAtTime(e.gainNow * def.gain, now, 0.06);
        p.pan?.pan.setTargetAtTime(e.pan, now, 0.06);
        p.lp.frequency.setTargetAtTime(e.lpf > 0 ? e.lpf : 18000, now, 0.08);
        let rate = e.rate;
        if (def.doppler && e.x !== undefined && e.y !== undefined) {
          const dx = e.x - this.listener.x;
          const dy = e.y - this.listener.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const vr = (dx * e.vx + dy * e.vy) / dist; // + = moving away
          rate *= 1 - Math.max(-0.06, Math.min(0.06, vr / 1500));
        }
        p.src.playbackRate.setTargetAtTime(rate, now, 0.1);
      });
    }
  }

  private startEmitter(e: LoopEmitter, now: number): void {
    const c = this.ctx!;
    const buf = this.baked.get(`loop:${e.id}`)?.[0];
    if (!buf) {
      this.requestBake(`loop:${e.id}`);
      return;
    }
    const def = LOOPS[e.id];
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = e.rate;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(e.gainNow * def.gain, now + def.fadeIn);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 18000;
    let pan: StereoPannerNode | null = null;
    src.connect(gain).connect(lp);
    if (typeof c.createStereoPanner === 'function') {
      pan = c.createStereoPanner();
      lp.connect(pan).connect(this.buses[def.bus].vol);
    } else lp.connect(this.buses[def.bus].vol);
    src.start(now, Math.random() * buf.duration);
    e.playing = { src, gain, pan, lp };
  }

  // ── Crowd ─────────────────────────────────────────────────────────────────────────────

  setCrowd(info: CrowdInfo): void {
    this.crowd = { ...this.crowd, ...info };
  }

  // ── Music ─────────────────────────────────────────────────────────────────────────────

  setCity(city: AudioCity | null): void {
    this.city = city;
    this.applyMusic();
  }

  setMusicState(s: Partial<MusicState>): void {
    this.music = { ...this.music, ...s };
    this.musicSet = true;
    this.applyMusic();
  }

  private applyMusic(): void {
    if (!this.seq || !this.musicSet) return;
    const m = this.music;
    const theme: Theme =
      m.phase === 'wave' || m.phase === 'breather'
        ? 'march'
        : m.phase === 'victory'
          ? 'victory'
          : m.phase === 'defeat'
            ? 'defeat'
            : 'hold';
    const flavour: Flavour = m.phase === 'menu' ? 'ministry' : (this.city ?? 'ministry');
    this.seq.setTarget({
      theme,
      flavour,
      // Low quality caps the arrangement at layer 3 (no chip doubling / extra rolls).
      intensity:
        m.phase === 'breather'
          ? 0
          : Math.min(this.opts.quality === 'low' ? 0.74 : 1, musicIntensity(m.level, m.crowd)),
      night: m.night,
      vamp: m.phase === 'breather',
    });
    if (this.eq && this.ctx) {
      const t = this.ctx.currentTime;
      const phone = m.phase === 'menu';
      this.eq.hp.frequency.setTargetAtTime(phone ? 320 : 20, t, 0.2);
      this.eq.lp.frequency.setTargetAtTime(phone ? 3400 : 20000, t, 0.2);
    }
  }

  // ── Sim events ────────────────────────────────────────────────────────────────────────

  bindSimEvents(source: SimEventSource | null, opts: SimBindOptions = {}): () => void {
    this.simUnsub?.();
    this.sim = createSimMapState(opts);
    let off: (() => void) | void = undefined;
    if (source) off = source((e) => mapSimEvent(e, this, this.sim));
    const unsub = (): void => {
      if (typeof off === 'function') off();
      if (this.simUnsub === unsub) this.simUnsub = null;
    };
    this.simUnsub = unsub;
    return unsub;
  }

  handleSimEvents(events: readonly SimEvent[]): void {
    // Always map (unit-type tracking must see every deploy); sounds no-op until unlocked.
    for (const e of events) mapSimEvent(e, this, this.sim);
  }

  private pollSim(now: number): void {
    const o = this.sim.opts;
    if (o.crowd) this.crowd = { ...this.crowd, size: o.crowd() };
    if (o.units) {
      const P = { x: 0, y: 0 };
      for (const u of o.units()) {
        const id: LoopId | null =
          u.type === 'heli' ? 'heliLoop' : u.type === 'humvee' ? 'humveeLoop' : u.type === 'tank' ? 'tankLoop' : null;
        if (!id) continue;
        tileToWorld(u.x, u.y, P);
        this.loop(`veh:${u.id}`, id, {
          x: P.x,
          y: P.y,
          volume: u.moving ? 1 : 0.55,
          rate: u.moving ? 1.25 : 1,
          ttl: 0.4,
        });
      }
    }
    // Activity → anger (decays with ~2 s time constant).
    const act = this.sim.activity;
    this.sim.activity = 0;
    const dt = Math.max(0.05, now - this.lastPoll);
    const target = Math.min(1, act / dt / 40);
    this.anger += (target - this.anger) * Math.min(1, dt / 2);
  }

  // ── Tick ──────────────────────────────────────────────────────────────────────────────

  /** Periodic update (~20 Hz): music scheduling, loops, crowd bed, sim polling. */
  update(nowOverride?: number): void {
    if (!this.ctx || this.disposed) return;
    if (this.live && this.live.state !== 'running') return;
    const now = nowOverride ?? this.now();
    if (now - this.lastPoll >= 0.1) {
      this.pollSim(now);
      this.lastPoll = now;
    }
    this.seq?.tick(now);
    this.updateLoops(now);
    const cr = this.crowd;
    const anger = cr.anger ?? Math.min(1, 0.25 + this.anger * 0.75 + this.music.level * 0.02);
    this.crowdBed?.set(cr.size, anger, cr.near ?? 0.5);
    this.crowdBed?.tick(now);
  }

  /** Dev: an analyser on the final (post-limiter) output. */
  outputTap(fftSize = 2048): AnalyserNode | null {
    if (!this.ctx || !this.outNode) return null;
    const a = this.ctx.createAnalyser();
    a.fftSize = fftSize;
    this.outNode.connect(a);
    return a;
  }

  /** Dev helpers. */
  forceChant(kind: 'clap' | 'hoHey' | 'boo' = 'clap'): void {
    if (this.ctx) this.crowdBed?.forceChant(this.now(), kind);
  }

  stats(): AudioStats {
    const now = this.now();
    const s = this.limiter.stats;
    let baked = 0;
    for (const v of this.baked.values()) if (v.length) baked++;
    return {
      unlocked: this.unlocked,
      state: this.live?.state ?? (this.ctx ? 'offline' : 'none'),
      voices: this.limiter.activeVoices(now),
      loops: [...this.loops.values()].filter((e) => e.playing).length,
      requested: s.requested,
      triggered: s.triggered,
      merged: s.merged,
      dropped: s.dropped,
      culled: this.counters.culled,
      baked,
      bakeQueue: this.bakeQueue.length + (this.baking ? 1 : 0),
      music: this.seq?.info() ?? null,
    };
  }
}

export function createAudio(opts?: AudioOptions): Audio {
  return new AudioEngine(opts);
}

export { DEFAULT_SETTINGS };
