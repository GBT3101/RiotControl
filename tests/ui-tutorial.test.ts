/** M10 tutorial: step machine, run gating, overlay geometry, done-flag persistence. */
import { describe, expect, it } from 'vitest';
import {
  completeTutorial,
  dimRects,
  placeAdvisor,
  shouldGreet,
  shouldRunTutorial,
  tutorialParam,
  intersects,
} from '../src/ui/tutorial/geometry';
import { TUTORIAL_STEPS, TutorialMachine, type StepDef } from '../src/ui/tutorial/machine';
import { loadGameSettings, saveGameSettings } from '../src/ui/settings';
import { memoryStorage } from '../src/ui/storage';
import { TUTORIAL_TEXT } from '../src/ui/text/tutorial';
import { CAMPAIGN, FIRST_CITY, TUTORIAL_CITY } from '../src/ui/campaign';

function harness(steps?: readonly StepDef[]) {
  const log: string[] = [];
  const m = new TutorialMachine(
    {
      show: (s) => log.push(`show:${s.id}`),
      leave: (s) => log.push(`leave:${s.id}`),
      finish: (skipped) => log.push(skipped ? 'skipped' : 'done'),
    },
    steps,
  );
  return { m, log };
}

/** Run frames until the machine shows `id` (or give up). */
function runTo(m: TutorialMachine, id: string, calm = true): void {
  for (let k = 0; k < 400 && !(m.state === 'showing' && m.step?.id === id); k++) {
    m.update(0.1, calm);
    if (m.state === 'showing' && m.step && !m.step.until) m.linesFinished();
  }
}

describe('tutorial step machine', () => {
  it('has 6–9 steps with text for each', () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(6);
    expect(TUTORIAL_STEPS.length).toBeLessThanOrEqual(9);
    for (const s of TUTORIAL_STEPS) expect(TUTORIAL_TEXT[s.id].length).toBeGreaterThan(0);
  });

  it('shows the welcome, then advances on read / on the right facts', () => {
    const { m, log } = harness();
    m.start();
    m.update(0.1);
    expect(log).toEqual(['show:welcome']);
    // A read step waits for its lines (and min time).
    for (let k = 0; k < 30; k++) m.update(0.1);
    expect(m.step?.id).toBe('welcome');
    m.linesFinished();
    m.update(0.1);
    m.update(0.1);
    expect(m.step?.id).toBe('pan');
    expect(m.state).toBe('showing');
    // Pan: advances on 'panned'; unrelated facts do nothing.
    m.fact('waveStarted');
    m.update(2);
    expect(m.step?.id).toBe('pan');
    m.fact('panned');
    m.update(0.1);
    m.update(0.1);
    expect(m.step?.id).toBe('deploy');
    m.update(1);
    expect(m.step?.id).toBe('deploy');
    m.fact('deployed');
    m.update(0.1);
    expect(log).toContain('leave:deploy');
  });

  it('skips action steps whose fact already holds (player ahead of the briefing)', () => {
    const { m, log } = harness();
    m.fact('panned');
    m.fact('deployed');
    m.start();
    runTo(m, 'hate');
    expect(log).not.toContain('show:pan');
    expect(log).not.toContain('show:deploy');
    expect(m.step?.id).toBe('hate');
  });

  it('waits for gates (first officer death, level 1) and for calm', () => {
    const { m } = harness();
    m.start(5); // legit
    for (let k = 0; k < 50; k++) m.update(0.2);
    expect(m.state).toBe('waiting');
    m.fact('officerDied');
    m.update(0.1, false); // dossier on screen
    expect(m.state).toBe('waiting');
    m.update(0.1, true);
    expect(m.state).toBe('showing');
    expect(m.step?.id).toBe('legit');
    m.linesFinished();
    m.update(2);
    m.update(0.1);
    expect(m.step?.id).toBe('sniper');
    expect(m.state).toBe('waiting');
    m.fact('level1');
    m.update(0.1);
    expect(m.state).toBe('showing');
  });

  it('times out a step only after its lines finished', () => {
    const { m } = harness();
    m.start(1); // pan, timeout 14 s
    m.update(0.1);
    expect(m.step?.id).toBe('pan');
    for (let k = 0; k < 20; k++) m.update(1);
    expect(m.step?.id).toBe('pan');
    m.linesFinished();
    m.update(0.1);
    expect(m.step?.id).toBe('deploy');
  });

  it('skip ends it immediately and reports skipped', () => {
    const { m, log } = harness();
    m.start();
    m.update(0.1);
    m.skip();
    expect(m.state).toBe('skipped');
    expect(m.active).toBe(false);
    expect(log).toEqual(['show:welcome', 'leave:welcome', 'skipped']);
    m.update(1);
    expect(log.length).toBe(3);
  });

  it('finishes after the last step', () => {
    const { m, log } = harness();
    for (const f of [
      'panned',
      'deployed',
      'waveStarted',
      'officerDied',
      'level1',
      'sniperDeployed',
    ] as const)
      m.fact(f);
    m.start();
    for (let k = 0; k < 300 && m.active; k++) {
      m.update(0.5);
      m.linesFinished();
    }
    expect(m.state).toBe('done');
    expect(log[log.length - 1]).toBe('done');
  });
});

describe('tutorial gating & persistence', () => {
  it('reads ?tutorial=0/1', () => {
    expect(tutorialParam('?tutorial=0')).toBe(false);
    expect(tutorialParam('?city=paris&tutorial=1')).toBe(true);
    expect(tutorialParam('?city=paris')).toBe(null);
  });

  it('runs on first visit / replay, never in attract or with tutorial=0', () => {
    const g = {
      param: null,
      attract: false,
      debugRun: false,
      replay: false,
      done: false,
      tutorialCity: true,
    };
    expect(shouldRunTutorial(g)).toBe(true);
    expect(shouldRunTutorial({ ...g, done: true })).toBe(false);
    expect(shouldRunTutorial({ ...g, done: true, replay: true })).toBe(true);
    expect(shouldRunTutorial({ ...g, debugRun: true })).toBe(false);
    expect(shouldRunTutorial({ ...g, debugRun: true, param: true })).toBe(true);
    expect(shouldRunTutorial({ ...g, param: false })).toBe(false);
    expect(shouldRunTutorial({ ...g, attract: true, param: true })).toBe(false);
  });

  it('runs only in Budapest, the first level; other cities just greet once', () => {
    expect(TUTORIAL_CITY).toBe('budapest');
    expect(FIRST_CITY).toBe(TUTORIAL_CITY);
    expect(CAMPAIGN.find((c) => c.level === 1)?.id).toBe(TUTORIAL_CITY);
    const g = {
      param: null,
      attract: false,
      debugRun: false,
      replay: false,
      done: false,
      tutorialCity: false,
    };
    // Madrid, London, Paris & co: no briefing, first visit or not, replay or not.
    expect(shouldRunTutorial(g)).toBe(false);
    expect(shouldRunTutorial({ ...g, replay: true })).toBe(false);
    expect(shouldRunTutorial({ ...g, done: true, replay: true })).toBe(false);
    // …only forced with ?tutorial=1 (screenshots, tests).
    expect(shouldRunTutorial({ ...g, param: true })).toBe(true);
    // The welcome line instead, once.
    expect(shouldGreet(g)).toBe(true);
    expect(shouldGreet({ ...g, done: true })).toBe(false);
    expect(shouldGreet({ ...g, param: false })).toBe(false);
    expect(shouldGreet({ ...g, param: true })).toBe(false);
    expect(shouldGreet({ ...g, debugRun: true })).toBe(false);
    expect(shouldGreet({ ...g, attract: true })).toBe(false);
    // Budapest briefs instead of greeting.
    expect(shouldGreet({ ...g, tutorialCity: true })).toBe(false);
    expect(shouldRunTutorial({ ...g, tutorialCity: true })).toBe(true);
  });

  it('persists the done flag per city and clears replay', () => {
    const st = memoryStorage();
    const s = loadGameSettings(st);
    s.replayTutorial = true;
    completeTutorial(s, 'budapest');
    saveGameSettings(s, st);
    const back = loadGameSettings(st);
    expect(back.tutorialDone).toEqual({ budapest: true });
    expect(back.replayTutorial).toBe(false);
    expect(
      shouldRunTutorial({
        param: null,
        attract: false,
        debugRun: false,
        replay: back.replayTutorial,
        done: !!back.tutorialDone.budapest,
        tutorialCity: true,
      }),
    ).toBe(false);
  });
});

describe('overlay geometry', () => {
  it('dim rects cover the screen except the holes', () => {
    const W = 480;
    const H = 300;
    const holes = [
      { x: 100, y: 50, w: 40, h: 20 },
      { x: 300, y: 60, w: 30, h: 100 },
      { x: -5, y: 280, w: 30, h: 40 },
    ];
    const rects = dimRects(W, H, holes);
    let area = 0;
    for (const r of rects) {
      area += r.w * r.h;
      for (const h of holes) expect(intersects(r, h)).toBe(false);
      for (const o of rects) if (o !== r) expect(intersects(r, o)).toBe(false);
    }
    const holeArea = 40 * 20 + 30 * 100 + 25 * 20;
    expect(area).toBe(W * H - holeArea);
    expect(dimRects(W, H, [])).toEqual([{ x: 0, y: 0, w: W, h: H }]);
  });

  it('moves the advisor off highlighted zones', () => {
    const def = { x: 4, bottom: 240, maxW: 470 };
    const size = { w: 250, h: 90 };
    // Nothing in the way: default spot.
    expect(placeAdvisor(def, size, [{ x: 300, y: 10, w: 20, h: 20 }], 30)).toBe(def);
    // Wave button right above the bar, under the advisor: raised above it.
    const wave = { x: 180, y: 200, w: 120, h: 40 };
    const p = placeAdvisor(def, size, [wave], 30);
    expect(p.bottom).toBeLessThanOrEqual(198);
    expect(intersects({ x: 4, y: p.bottom - 90, w: 250, h: 90 }, wave)).toBe(false);
    // Cramped (phone landscape): picks the least-overlapping spot, never below the default.
    const q = placeAdvisor(
      { x: 4, bottom: 180, maxW: 498 },
      { w: 256, h: 98 },
      [
        { x: 172, y: 143, w: 162, h: 42 },
        { x: 243, y: 125, w: 21, h: 22 },
      ],
      34,
    );
    expect(q.bottom).toBe(132);
  });
});
