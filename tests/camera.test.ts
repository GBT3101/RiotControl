import { describe, expect, it } from 'vitest';
import { Camera, applyToContainer } from '../src/render/camera';
import { uiScale, zoomRange } from '../src/render/zoom';

function cam() {
  const c = new Camera();
  c.setViewport(1440, 900, zoomRange(1440, 900));
  c.setBounds({ minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 });
  return c;
}

describe('zoom policy', () => {
  it('picks ~22 tiles across the long side', () => {
    expect(zoomRange(1440, 900).def).toBe(2);
    expect(zoomRange(1920, 1080).def).toBe(3);
    expect(zoomRange(2532, 1170).def).toBe(4);
    // Portrait phones: ≥ 10.5 tiles across the width (≈ 12 at zoom 3).
    expect(zoomRange(1170, 2532).def).toBe(3);
    expect(zoomRange(1536, 2048).def).toBe(3);
    const r = zoomRange(1440, 900);
    expect(r.max - r.min).toBe(4);
    expect(r.min).toBeGreaterThanOrEqual(1);
  });

  it('ui scale is an integer ≥ 1', () => {
    expect(uiScale(900, 1)).toBe(3);
    expect(uiScale(1080, 1)).toBe(3);
    expect(uiScale(1440, 1)).toBe(4);
    expect(uiScale(390, 3)).toBe(5); // phone: ≥ 1.5 CSS px per UI px (M9)
    expect(uiScale(768, 1)).toBe(2);
    expect(uiScale(400, 1.25)).toBe(2);
  });
});

describe('Camera', () => {
  it('eases to an integer zoom keeping the focus point fixed', () => {
    const c = cam();
    c.centerOn(0, 0);
    const before = c.screenToWorld(1000, 300);
    c.zoomBy(1, 1000, 300);
    for (let i = 0; i < 120; i++) c.update(1 / 60);
    expect(c.zoom).toBe(3);
    expect(Number.isInteger(c.zoom)).toBe(true);
    const after = c.screenToWorld(1000, 300);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('clamps zoom levels and position to bounds', () => {
    const c = cam();
    c.zoomTo(99);
    expect(c.targetZoom).toBe(c.range.max);
    c.zoomTo(-5);
    expect(c.targetZoom).toBe(c.range.min);
    c.centerOn(5000, -5000);
    const half = 1440 / 2 / c.zoom;
    expect(c.x).toBeCloseTo(1000 - half);
    expect(c.y).toBeCloseTo(-1000 + 900 / 2 / c.zoom);
  });

  it('centres on an axis where the view exceeds the bounds', () => {
    const c = cam();
    c.setBounds({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
    expect(c.x).toBe(50);
    expect(c.y).toBe(50);
  });

  it('pans by screen deltas and decays inertia to rest', () => {
    const c = cam();
    c.centerOn(0, 0);
    c.panByScreen(20, 0);
    expect(c.x).toBe(-20 / c.zoom);
    c.setVelocity(300, 0);
    for (let i = 0; i < 300; i++) c.update(1 / 60);
    expect(c.vx).toBe(0);
    expect(c.settled).toBe(true);
  });

  it('snaps the rendered view to whole world pixels', () => {
    const c = cam();
    c.centerOn(10.4, 20.6);
    const v = c.view();
    expect(v).toMatchObject({ x: 10, y: 21 });
    const pos = { x: 0, y: 0 };
    let s = 0;
    applyToContainer(
      { position: { set: (x, y) => Object.assign(pos, { x, y }) }, scale: { set: (k) => (s = k) } },
      v,
    );
    expect(s).toBe(c.zoom);
    expect(Number.isInteger(pos.x) && Number.isInteger(pos.y)).toBe(true);
  });
});
