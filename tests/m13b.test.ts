/**
 * M13b — UX, performance & mobile: pure pieces (wheel classification, zoom/UI-scale policy,
 * frame governor, quality tiers, camera diamond clamp, settings) plus the Hate ledger identity
 * and the music phase mapping.
 */
import { describe, expect, it } from 'vitest';
import { bindGameAudio } from '../src/game/boot';
import type { GameController } from '../src/game/controller';
import { FrameGovernor, governorEnabled } from '../src/game/governor';
import { readParams } from '../src/game/params';
import { classifyQuality } from '../src/game/quality';
import type { Audio } from '../src/audio';
import { Camera } from '../src/render/camera';
import { classifyWheel } from '../src/render/cameraInput';
import { uiScale, uiScaleLarge, zoomRange } from '../src/render/zoom';
import { BALANCE } from '../src/data/balance';
import { BOT_KINDS } from '../src/sim/bots';
import { runHeadless } from '../src/sim/headless';
import { World } from '../src/sim/world';
import { loadMap } from '../src/maps';
import { GAME_SETTINGS_KEY, loadGameSettings, sanitizeGameSettings } from '../src/ui/settings';
import { memoryStorage } from '../src/ui/storage';

describe('wheel → pan or zoom', () => {
  it('mouse notches zoom', () => {
    expect(
      classifyWheel({ deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false, wheelDeltaY: -120 }),
    ).toBe('zoom');
    expect(classifyWheel({ deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false })).toBe('zoom');
    expect(classifyWheel({ deltaX: 0, deltaY: -100, deltaMode: 0, ctrlKey: false })).toBe('zoom');
  });
  it('trackpad pinch (ctrl+wheel) zooms', () => {
    expect(classifyWheel({ deltaX: 0, deltaY: 2.5, deltaMode: 0, ctrlKey: true })).toBe('zoom');
  });
  it('two-finger trackpad scrolls pan', () => {
    expect(classifyWheel({ deltaX: 4, deltaY: 0, deltaMode: 0, ctrlKey: false })).toBe('pan');
    expect(
      classifyWheel({ deltaX: 0, deltaY: -3, deltaMode: 0, ctrlKey: false, wheelDeltaY: 9 }),
    ).toBe('pan');
    expect(classifyWheel({ deltaX: 0, deltaY: 7.5, deltaMode: 0, ctrlKey: false })).toBe('pan');
  });
});

describe('zoom & UI scale policy', () => {
  it('portrait phones show ≥ 10.5 tiles across', () => {
    const r = zoomRange(1170, 2532);
    expect(r.def).toBe(3);
    expect(1170 / (r.def * 32)).toBeGreaterThanOrEqual(10.5);
    expect(zoomRange(2532, 1170).def).toBe(4);
    expect(zoomRange(1440, 900).def).toBe(2);
  });
  it('larger UI is one step up only where the layout still fits', () => {
    expect(uiScaleLarge(844, 390, 3)).toBe(uiScale(390, 3) + 1); // 422×195 UI px
    expect(uiScaleLarge(1920, 1080, 1)).toBe(uiScale(1080, 1) + 1); // 480×270
    expect(uiScaleLarge(1440, 900, 1)).toBe(uiScale(900, 1)); // 360×225 would be too small
    // iPhone SE portrait (320×568 @2): one step up would leave 160 UI px — stays.
    expect(uiScaleLarge(320, 568, 2)).toBe(uiScale(320, 2));
  });
});

describe('frame governor', () => {
  it('steps down after sustained slow frames and recovers slowly', () => {
    const g = new FrameGovernor();
    const changes: number[] = [];
    for (let k = 0; k < 300; k++) {
      const c = g.sample(60);
      if (c !== null) changes.push(c);
    }
    expect(changes[0]).toBe(1);
    expect(g.level).toBe(2);
    for (let k = 0; k < 60 * 70; k++) g.sample(16);
    expect(g.level).toBe(0);
  });
  it('ignores stalls and short hitches', () => {
    const g = new FrameGovernor();
    for (let k = 0; k < 20; k++) g.sample(2000);
    for (let k = 0; k < 30; k++) g.sample(80);
    for (let k = 0; k < 200; k++) g.sample(16);
    expect(g.level).toBe(0);
  });
  it('is forced by ?governor and off without a navigator', () => {
    expect(governorEnabled(true)).toBe(true);
    expect(governorEnabled(false)).toBe(false);
    expect(readParams('?governor=0').governor).toBe(false);
    expect(readParams('').governor).toBeUndefined();
  });
});

describe('quality tier detection', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
  it('classifies phones, tablets, desktops and weak hardware', () => {
    expect(
      classifyQuality({ cores: 6, coarse: true, screenW: 390, screenH: 844, userAgent: iphone }),
    ).toBe('mobile');
    expect(classifyQuality({ cores: 8, memory: 8, screenW: 1920, screenH: 1080 })).toBe('desktop');
    expect(classifyQuality({ cores: 2, screenW: 1920, screenH: 1080 })).toBe('low');
    expect(classifyQuality({ cores: 4, memory: 2, coarse: true, screenW: 360, screenH: 780 })).toBe(
      'low',
    );
    expect(
      classifyQuality({ cores: 8, coarse: true, touchPoints: 5, screenW: 1024, screenH: 1366 }),
    ).toBe('desktop');
    expect(
      classifyQuality({ cores: 8, coarse: true, touchPoints: 5, screenW: 768, screenH: 1024 }),
    ).toBe('mobile');
    // Touch-screen laptop: fine pointer, big screen → desktop.
    expect(
      classifyQuality({ cores: 8, memory: 16, touchPoints: 10, screenW: 1366, screenH: 768 }),
    ).toBe('desktop');
  });
});

describe('camera diamond clamp', () => {
  it('keeps the view over the map diamond', () => {
    const c = new Camera();
    c.setViewport(1170, 2532, zoomRange(1170, 2532));
    c.diamond = { w: 72, h: 72, inset: 0.6 };
    c.centerOn(-2000, 400); // far outside the left corner
    const u = c.y / 16 + c.x / 32;
    const v = c.y / 16 - c.x / 32;
    const m = 0.6 * (1170 / 2 / 3 / 32 + 2532 / 2 / 3 / 16);
    expect(u).toBeGreaterThanOrEqual(m - 1e-6);
    expect(v).toBeLessThanOrEqual(72 - m + 1e-6);
    // The middle of the map is untouched.
    c.centerOn(0, 72 * 8);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(576);
  });
});

describe('settings (M13b)', () => {
  it('ui size sanitises and defaults to auto', () => {
    expect(sanitizeGameSettings({ uiSize: 'large' }).uiSize).toBe('large');
    expect(sanitizeGameSettings({ uiSize: 'huge' }).uiSize).toBe('auto');
  });
  it('first run follows prefers-reduced-motion; stored choices win', () => {
    const st = memoryStorage();
    expect(loadGameSettings(st, true).shake).toBe(false);
    expect(loadGameSettings(st, false).shake).toBe(true);
    st.data.set(GAME_SETTINGS_KEY, JSON.stringify({ shake: true }));
    expect(loadGameSettings(st, true).shake).toBe(true);
  });
  it('?bot accepts every sim bot kind (params keeps a local copy of the list)', () => {
    for (const k of BOT_KINDS) expect(readParams(`?bot=${k}`).bot).toBe(k);
    expect(readParams('?bot=nope').bot).toBe('escalate');
  });
});

describe('Hate ledger', () => {
  it('start grant + earned − spent = Hate held (end-screen "Hate unspent")', () => {
    const r = runHeadless({ seconds: 240, bot: 'balanced', seed: 3 });
    expect(r.stats.hateSpent).toBeGreaterThan(0);
    expect(BALANCE.startHate + r.stats.hateEarned - r.stats.hateSpent).toBe(r.hate);
  });
});

describe('music follows every phase', () => {
  it('prep → wave → breather → victory / defeat', () => {
    const w = new World(loadMap('madrid', 0), { seed: 1 });
    const states: string[] = [];
    const audio = {
      setCity() {},
      bindSimEvents() {},
      handleSimEvents() {},
      setListener() {},
      setMusicState: (s: { phase: string }) => states.push(s.phase),
    } as unknown as Audio;
    const game = {
      world: w,
      camera: { view: () => ({ x: 0, y: 0, zoom: 2, width: 100, height: 100 }) },
      view: { grade: { darkness: 0 } },
      onSimEvents: null,
    } as unknown as GameController;
    const tick = bindGameAudio(game, audio);
    tick(1000);
    w.startWaves();
    w.run(1);
    tick(1000);
    w.director.phase = 'breather';
    tick(1000);
    w.phase = 'victory';
    tick(1000);
    w.phase = 'defeat';
    tick(1000);
    expect(states).toEqual(['prep', 'wave', 'breather', 'victory', 'defeat']);
  });
});
