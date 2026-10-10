/**
 * Secondary landmarks of Madrid — Cibeles and Neptune fountains, Metrópolis, Puerta de
 * Alcalá, Palacio de Cibeles, Cervantes (E0: moved verbatim from
 * secondary.ts). Contract footprints: LANDMARKS in src/maps/contract.ts.
 */
import { Scene, type Material } from '../engine/scene';
import { R, lv, mod, plain } from '../engine/materials';
import { roofMat, stairs, stepMat } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { CERVANTES, CIBELES, NEPTUNE, VICTORY, figure, marbleStatue } from '../props';
import { basin, classicalWall, jet, paving, plate, type SecondaryArt } from '../shared';

function cibeles(frame: number): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  basin(s, 1.5, 1.5, 1.38, 1.22, 5, frame, 4, R.granite);
  // Rock base and the marble group.
  s.hip(1.0, 2.0, 1.1, 1.9, 2, 9, 0.3, plain(R.marble));
  s.sprite(figure(CIBELES, 'marble', 'cibeles'), 17, 21, 1.55, 1.55, 9);
  // Sceptre.
  s.line(
    [
      [1.62, 1.35, 20],
      [1.62, 1.35, 33],
    ],
    'gray5',
    { bias: 0.3 },
  );
  // Jets from the lions' mouths and the basin edge.
  jet(s, [1.05, 1.95, 12], [0.55, 2.35, 3], 6, frame);
  jet(s, [1.3, 2.05, 12], [1.05, 2.55, 3], 5, frame + 2);
  return { scene: s, overlays: [] };
}

function neptuno(frame: number): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  basin(s, 1.5, 1.5, 1.38, 1.22, 5, frame, 4, R.granite);
  s.hip(1.05, 1.95, 1.05, 1.95, 2, 8, 0.25, plain(R.marble));
  s.sprite(figure(NEPTUNE, 'marble', 'neptune'), 12, 19, 1.55, 1.55, 8);
  // Trident.
  s.line(
    [
      [1.7, 1.2, 24],
      [1.7, 1.2, 40],
    ],
    'gray4',
    { bias: 0.4 },
  );
  s.line(
    [
      [1.64, 1.26, 40],
      [1.76, 1.14, 40],
    ],
    'gray4',
    { bias: 0.4 },
  );
  s.line(
    [
      [1.64, 1.26, 40],
      [1.64, 1.26, 42],
    ],
    'gray4',
    { bias: 0.4 },
  );
  s.line(
    [
      [1.76, 1.14, 40],
      [1.76, 1.14, 42],
    ],
    'gray4',
    { bias: 0.4 },
  );
  jet(s, [1.0, 1.9, 9], [0.5, 2.4, 3], 7, frame);
  jet(s, [2.0, 1.0, 9], [2.5, 0.6, 3], 7, frame + 1);
  jet(s, [1.9, 1.9, 9], [2.4, 2.4, 3], 6, frame + 2);
  return { scene: s, overlays: [] };
}

function metropolis(): Build {
  const s = new Scene();
  plate(s, 3, 3, paving);
  const white = R.portland;
  const wall = classicalWall({
    ramp: white,
    pitch: 7,
    off: 2,
    rows: [70, 58, 46, 34, 22],
    top: 78,
    base: 12,
  });
  s.box(0.15, 2.3, 0.15, 1.5, 1, 78, wall);
  s.box(0.15, 1.5, 0.15, 2.3, 1, 78, wall);
  // Rotunda with paired columns.
  const rot: Material = (c) => {
    const a = Math.atan2(c.v - 1.95, c.u - 1.95);
    const col = mod(Math.floor(a * 7), 3) === 0;
    const win = !col && mod(c.fz, 12) > 3 && mod(c.fz, 12) < 10 && c.fz > 14 && c.fz < 76;
    if (c.night) return win ? 'ochre2' : null;
    if (c.edge) return white[0];
    if (win) return lv(R.dark, c.level);
    if (col && c.lambert > 0.5 && !c.shadow) return white[4];
    if (c.fz >= 76) return lv(white, c.level + 1);
    return lv(white, c.level + (col ? 0 : -1) + (c.fz > 12 ? 0 : -1) + 1);
  };
  s.cyl(1.95, 1.95, 0.85, 1, 80, rot);
  s.cyl(1.95, 1.95, 0.72, 80, 88, plain(white, { rim: true }));
  // Slate dome with gilded ribs and garlands.
  const dome: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'ink';
    const a = Math.atan2(c.v - 1.95, c.u - 1.95);
    const rib = Math.abs(mod((a * 4) / Math.PI + 0.5, 1) - 0.5) < 0.09;
    if (rib || mod(c.fz, 9) === 0) return lv(R.gold, c.level);
    return lv(R.slate, c.level + 1);
  };
  s.ell(1.95, 1.95, 88, 0.7, 0.7, 26, dome, { zMin: 88 });
  s.cyl(1.95, 1.95, 0.16, 110, 118, plain(R.gold));
  s.sprite(figure(VICTORY, 'gold', 'victory'), 4, 11, 1.95, 1.95, 118);
  return { scene: s, overlays: [] };
}

function puertaAlcala(): Build {
  const s = new Scene();
  plate(s, 4, 2, paving);
  const g = R.granite;
  const M = R.marble;
  // Openings through the gate (along v): three round arches + two square side passages.
  const ARCH_U = [1.4, 2.0, 2.6];
  const opening = (u: number, z: number): boolean => {
    for (const cu of ARCH_U) {
      const dx = (u - cu) * 16;
      if (Math.abs(dx) < 3.5 && z > 1 && (z < 17 || Math.hypot(dx, z - 17) < 3.5)) return true;
    }
    for (const cu of [0.62, 3.38]) if (Math.abs(u - cu) < 0.14 && z < 14 && z > 1) return true;
    return false;
  };
  const gate: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'back') return lv(g, 1);
    if (c.edge) return g[0];
    if (c.side === 'top') return lv(g, c.level);
    const z = c.fz;
    if (z >= 39) return lv(M, c.level + (z === 39 ? -1 : 0));
    if (z >= 36) return mod(c.fx, 2) ? lv(M, c.level - 1) : lv(M, c.level);
    if (c.side === 'left') {
      const u = c.u;
      // Attached Ionic columns flanking the arches.
      for (const cu of [1.1, 1.7, 2.3, 2.9]) {
        const dx = (u - cu) * 16;
        if (Math.abs(dx) < 1.5 && z > 3) return lv(M, c.level + (dx < 0 ? 1 : -1));
        if (Math.abs(dx) < 2.5 && z > 32 && z < 36) return lv(M, c.level);
      }
      // Arch rings, keystones and dark reveals.
      for (const cu of ARCH_U) {
        const dx = (u - cu) * 16;
        const r = Math.hypot(dx, z - 17);
        if (z >= 17 && r >= 3.5 && r < 5.5) return lv(M, c.level + (Math.abs(dx) < 0.8 ? 1 : 0));
        if (Math.abs(Math.abs(dx) - 3.9) < 0.6 && z < 17 && z > 1) return lv(g, c.level - 2);
      }
      if (z < 4) return lv(g, c.level - 1);
    }
    return mod(z, 5) === 0 ? lv(g, c.level - 1) : lv(g, c.level);
  };
  s.box(0.2, 3.8, 0.7, 1.3, 1, 42, gate, {
    cut: (u, _v, z, f) => (f === 2 || f === 3 ? opening(u, z) : false),
  });
  // Attic with the central pediment and the sculpted trophies.
  const attic: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return M[0];
    if (c.side === 'left' && c.fz > 44 && c.fz < 50 && mod(c.fx, 3) !== 0)
      return lv(M, c.level - 1);
    return lv(M, c.level + (c.rim ? 1 : 0));
  };
  s.box(1.15, 2.85, 0.8, 1.2, 42, 52, attic);
  s.gable(1.1, 2.9, 0.75, 1.25, 52, 59, 'v', attic);
  s.sprite(marbleStatue('seated', false, true), 6, 17, 2.0, 1.0, 59, { bias: 0.2 });
  for (const u of [0.55, 3.45]) {
    s.box(u - 0.2, u + 0.2, 0.85, 1.15, 42, 46, plain(M));
    s.sprite(marbleStatue('standing', false, true), 4, 19, u, 1.0, 46);
  }
  return { scene: s, overlays: [] };
}

function palacioComunicaciones(): Build {
  const s = new Scene();
  plate(s, 8, 6, paving);
  const w = R.marble;
  const wall = classicalWall({ ramp: w, pitch: 9, off: 3, rows: [56, 42, 28], top: 64, base: 14 });
  const roof = roofMat(R.slateLit, undefined, 3);
  s.box(0.5, 7.5, 0.5, 4.9, 1, 64, wall);
  s.hip(0.6, 7.4, 0.6, 4.8, 64, 74, 1.2, roof);
  // Corner turrets with pinnacle roofs.
  const tw = classicalWall({
    ramp: w,
    pitch: 7,
    off: 1,
    rows: [80, 62, 44, 26],
    top: 86,
    base: 14,
  });
  for (const [u, v] of [
    [0.9, 4.6],
    [7.1, 4.6],
    [7.1, 0.9],
    [0.9, 0.9],
  ] as const) {
    s.box(u - 0.55, u + 0.55, v - 0.55, v + 0.55, 1, 86, tw);
    s.hip(u - 0.6, u + 0.6, v - 0.6, v + 0.6, 86, 104, 0.6, roof);
    s.line(
      [
        [u, v, 104],
        [u, v, 110],
      ],
      'gray2',
    );
  }
  // Central tower on the front.
  s.box(3.3, 4.7, 4.0, 5.4, 1, 104, tw);
  s.hip(3.25, 4.75, 3.95, 5.45, 104, 116, 0.25, roof);
  s.box(3.6, 4.4, 4.3, 5.1, 116, 128, tw);
  s.hip(3.55, 4.45, 4.25, 5.15, 128, 150, 0.45, roof);
  for (const [u, v] of [
    [3.3, 5.4],
    [4.7, 5.4],
    [4.7, 4.0],
  ] as const) {
    s.prismN(u, v, 0.1, 0.1, 100, 112, 4, plain(w));
    s.prismN(u, v, 0.1, 0, 112, 122, 4, plain(R.slateLit));
  }
  // Grand entrance arcade: three arches on the tower base.
  const arcade: Material = (c) => {
    if (c.night) return c.fz < 20 ? 'ochre2' : null;
    if (c.edge) return w[0];
    const a = mod(c.fx - 54, 7);
    if (a > 1 && c.fz < 18 + (a === 2 || a === 6 ? 0 : 1)) return lv(R.dark, c.level);
    return lv(w, c.level + 1);
  };
  s.box(3.3, 4.7, 5.4, 5.75, 1, 22, arcade);
  stairs(s, 3.3, 4.7, 6.0, 5.75, 1, 3, 1, stepMat(R.granite));
  s.line(
    [
      [4.0, 4.7, 150],
      [4.0, 4.7, 172],
    ],
    'gray2',
  );
  return {
    scene: s,
    overlays: [{ sprite: 'lm.flag.es.small', u: 4.0, v: 4.7, z: 172, flag: true }],
  };
}

function cervantes(): Build {
  const s = new Scene();
  plate(s, 1, 1, paving);
  const g = R.granite;
  s.box(0.1, 0.9, 0.1, 0.9, 1, 4, plain(g));
  s.box(0.22, 0.78, 0.22, 0.78, 4, 18, plain(g, { rim: true }));
  s.box(0.18, 0.82, 0.18, 0.82, 18, 21, plain(g, { rim: true }));
  s.sprite(figure(CERVANTES, 'bronze', 'cervantes'), 3, 12, 0.5, 0.5, 21);
  return { scene: s, overlays: [] };
}

export const LANDMARKS_MADRID: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  cibeles: { top: 40, frames: 4, fps: 6, build: cibeles },
  neptuno: { top: 48, frames: 4, fps: 6, build: neptuno },
  metropolis: { top: 132, frames: 1, fps: 0, build: metropolis },
  puertaAlcala: { top: 82, frames: 1, fps: 0, build: puertaAlcala },
  palacioComunicaciones: { top: 180, frames: 1, fps: 0, build: palacioComunicaciones },
  cervantes: { top: 36, frames: 1, fps: 0, build: cervantes },
};
