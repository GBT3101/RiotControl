/**
 * Vehicles (M4c): MG Humvee, tank, helicopter, decor/ambient vehicles, wrecks, card icons.
 * See docs/art/M4c.md for the catalogue, anchors and integration offsets (meta.ts).
 *
 * All directions are rendered natively (no mirroring) so lighting stays upper-left and
 * stencil text is never mirrored.
 */
import type { SpriteRegistry } from '../lib/registry';
import { registerCivil } from './civil';
import { DIR16, DIR8, yaw16, yaw8 } from './dirs';
import { HELI_MUZZLE, HELI_POSES, heliBody, type HeliPose } from './heli';
import { downwashAnim, heliBeam, heliShadow, rotorAnim } from './heliFx';
import { HUMVEE_MUZZLE, humveeHull, humveeTurret, type HullState } from './humvee';
import { registerIcons } from './icons';
import { MATS } from './materials';
import { Model, project, renderAnim, renderFx, type V3, type View } from './render3d';
import { muzzleFlash, puff } from './stamps';
import { TANK_MUZZLE, TANK_RECOIL, tankHull, tankTurret } from './tank';

const G = 'vehicles';

/** Frames that share geometry and differ only in overlays (fire/smoke): rasterise once. */
function fxAnim(models: Model[], v: View) {
  const base = new Model();
  base.prims.push(...models[0]!.prims);
  base.decals.push(...models[0]!.decals);
  return renderFx(
    base,
    models.map((m) => m.overlays),
    MATS,
    v,
  );
}

/** Add a muzzle flash overlay pointing along the barrel (model +x through `muzzle`). */
function withFlash(m: Model, muzzle: V3, view: View, size: 1 | 2, phase: 0 | 1): Model {
  const a = project(muzzle, view);
  const b = project([muzzle[0] + 4, muzzle[1], muzzle[2]], view);
  const f = muzzleFlash(b.x - a.x, b.y - a.y, size, phase);
  m.overlay({ at: muzzle, img: f.img, origin: f.origin });
  return m;
}

function registerHumvee(reg: SpriteRegistry): void {
  const states: Array<[HullState, string]> = [
    ['ok', 'drive'],
    ['dmg1', 'drive.dmg1'],
    ['dmg2', 'drive.dmg2'],
    ['wreck', 'wreck'],
  ];
  for (const [state, name] of states) {
    for (const d of DIR8) {
      const v = { yaw: yaw8(d) };
      const models = [0, 1, 2, 3].map((f) => humveeHull(f, state));
      const a = state === 'wreck' ? fxAnim(models, v) : renderAnim(models, MATS, v);
      reg.add(`veh.humvee.${name}.${d}`, {
        group: G,
        frames: a.frames,
        fps: state === 'wreck' ? 8 : 10,
        anchor: a.anchor,
        hasShadow: true,
        tags: ['vehicle', 'humvee', state],
      });
    }
  }
  for (const d of DIR8) {
    const v = { yaw: yaw8(d) };
    const idle = renderAnim([humveeTurret('idle')], MATS, v, { shadow: false });
    reg.add(`veh.humvee.turret.${d}`, {
      group: G,
      frames: idle.frames,
      anchor: idle.anchor,
      tags: ['turret'],
    });
    const dmg = renderAnim([humveeTurret('idle', true)], MATS, v, { shadow: false });
    reg.add(`veh.humvee.turret.dmg.${d}`, {
      group: G,
      frames: dmg.frames,
      anchor: dmg.anchor,
      tags: ['turret'],
    });
    const fire = renderAnim(
      [
        withFlash(humveeTurret('fire0'), HUMVEE_MUZZLE, v, 1, 0),
        withFlash(humveeTurret('fire1'), HUMVEE_MUZZLE, v, 1, 1),
      ],
      MATS,
      v,
      { shadow: false },
    );
    reg.add(`veh.humvee.turret.fire.${d}`, {
      group: G,
      frames: fire.frames,
      fps: 20,
      anchor: fire.anchor,
      tags: ['turret'],
    });
  }
}

/** Tank fire: f0 big flash + full recoil, f1 fading flash, f2–f3 muzzle smoke as the gun runs out. */
function tankFireModel(f: 0 | 1 | 2 | 3, view: View, state: 'ok' | 'dmg'): Model {
  const m = tankTurret(f, state);
  const muzzle: V3 = [TANK_MUZZLE[0] - TANK_RECOIL[f], 0, TANK_MUZZLE[2]];
  if (f <= 1) withFlash(m, muzzle, view, 2, f as 0 | 1);
  if (f >= 1) {
    const p = f === 1 ? puff('m', 'light') : f === 2 ? puff('l', 'light') : puff('l', 'grey');
    m.overlay({
      at: [TANK_MUZZLE[0] + 2, 0, TANK_MUZZLE[2] + f],
      img: p,
      origin: { x: p.w >> 1, y: p.h >> 1 },
      dy: -f,
      front: f > 1,
    });
  }
  return m;
}

function registerTank(reg: SpriteRegistry): void {
  const states = [
    ['ok', 'drive'],
    ['dmg1', 'drive.dmg1'],
    ['dmg2', 'drive.dmg2'],
  ] as const;
  for (const [state, name] of states) {
    for (const d of DIR8) {
      const a = renderAnim(
        [0, 1, 2, 3].map((f) => tankHull(f, state)),
        MATS,
        { yaw: yaw8(d) },
      );
      reg.add(`veh.tank.${name}.${d}`, {
        group: G,
        frames: a.frames,
        fps: 10,
        anchor: a.anchor,
        hasShadow: true,
        tags: ['vehicle', 'tank', state],
      });
    }
  }
  for (const d of DIR8) {
    // Burning wreck with the turret knocked askew (baked in).
    const a = fxAnim(
      [0, 1, 2, 3].map((f) => tankHull(f, 'wreck', { yaw: 28 })),
      { yaw: yaw8(d) },
    );
    reg.add(`veh.tank.wreck.${d}`, {
      group: G,
      frames: a.frames,
      fps: 8,
      anchor: a.anchor,
      hasShadow: true,
      tags: ['wreck'],
    });
    // Tread dust: puffs kicked up behind both tracks (draw under the hull unless the rear faces
    // the camera: n, ne, nw, e, w → over the hull).
    const dust = [0, 1, 2, 3].map((f) => {
      const m = new Model();
      for (const y of [-6.7, 6.7]) {
        for (let k = 0; k < 3; k++) {
          const p = puff(k === 0 ? 's' : k === 1 ? 'm' : 'l', 'dust');
          const t = k + f / 4;
          m.overlay({
            at: [-16 - t * 3, y + (k % 2 ? 0.8 : -0.8), 0.5 + t * 1.2],
            img: p,
            origin: { x: p.w >> 1, y: p.h - 1 },
            front: true,
          });
        }
      }
      return m;
    });
    const da = renderAnim(dust, MATS, { yaw: yaw8(d) }, { shadow: false, outline: false });
    reg.add(`veh.tank.dust.${d}`, {
      group: G,
      frames: da.frames,
      fps: 10,
      anchor: da.anchor,
      tags: ['fx'],
    });
  }
  for (const d of DIR16) {
    const v = { yaw: yaw16(d) };
    const idle = renderAnim([tankTurret('idle')], MATS, v, { shadow: false });
    reg.add(`veh.tank.turret.${d}`, {
      group: G,
      frames: idle.frames,
      anchor: idle.anchor,
      tags: ['turret'],
    });
    const dmg = renderAnim([tankTurret('idle', 'dmg')], MATS, v, { shadow: false });
    reg.add(`veh.tank.turret.dmg.${d}`, {
      group: G,
      frames: dmg.frames,
      anchor: dmg.anchor,
      tags: ['turret'],
    });
    const fire = renderAnim(
      ([0, 1, 2, 3] as const).map((f) => tankFireModel(f, v, 'ok')),
      MATS,
      v,
      { shadow: false },
    );
    reg.add(`veh.tank.turret.fire.${d}`, {
      group: G,
      frames: fire.frames,
      fps: 12,
      loop: false,
      anchor: fire.anchor,
      tags: ['turret'],
    });
  }
}

function registerHeli(reg: SpriteRegistry): void {
  const poses: HeliPose[] = ['hover', 'fly', 'bankl', 'bankr'];
  for (const pose of poses) {
    for (const d of DIR8) {
      const v = { yaw: yaw8(d), ...HELI_POSES[pose] };
      const a = renderAnim(
        [0, 1, 2, 3].map((f) => heliBody(f, false, v)),
        MATS,
        v,
        { shadow: false },
      );
      reg.add(`veh.heli.${pose}.${d}`, {
        group: G,
        frames: a.frames,
        fps: 12,
        anchor: a.anchor,
        tags: ['heli'],
      });
    }
  }
  for (const d of DIR8) {
    const v = { yaw: yaw8(d), ...HELI_POSES.hover };
    const a = renderAnim(
      [0, 1, 2, 3].map((f) => heliBody(f, true, v)),
      MATS,
      v,
      { shadow: false },
    );
    reg.add(`veh.heli.fire.${d}`, {
      group: G,
      frames: a.frames,
      fps: 12,
      anchor: a.anchor,
      tags: ['heli'],
    });
    const s = heliShadow(yaw8(d));
    reg.add(`veh.heli.shadow.${d}`, {
      group: G,
      frames: s.frames,
      anchor: s.anchor,
      hasShadow: true,
      tags: ['shadow'],
    });
    const b = heliBeam(yaw8(d));
    reg.add(`veh.heli.beam.${d}`, {
      group: G,
      frames: b.frames,
      anchor: b.anchor,
      tags: ['additive', 'night'],
    });
  }
  const r = rotorAnim();
  reg.add('veh.heli.rotor', {
    group: G,
    frames: r.frames,
    fps: 24,
    anchor: r.anchor,
    hasShadow: true,
    tags: ['rotor'],
  });
  const w = downwashAnim();
  reg.add('veh.heli.downwash', {
    group: G,
    frames: w.frames,
    fps: 10,
    anchor: w.anchor,
    tags: ['fx'],
  });
  void HELI_MUZZLE;
}

export function registerVehicles(reg: SpriteRegistry): void {
  registerHumvee(reg);
  registerTank(reg);
  registerHeli(reg);
  registerCivil(reg);
  registerIcons(reg);
}
