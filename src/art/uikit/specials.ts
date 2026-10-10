/**
 * Special-skill HUD art (playtest round 2): one 11×11 icon per skill (ram, rapid fire, frag
 * grenade, missile, air strike) plus "aim" and "cancel"; the bouncing ready cue that floats over
 * a charged unit (same hi-vis bubble as the gas grenade cue, 17×22, 4 frames) and round brass
 * buttons for the info panel (22×24, BUTTON_STATES frames). The charge ring is the existing
 * `abilityRing(step)` (cards.ts). Catalogue: docs/art/specials.md.
 */
import { grid, type KeyMap } from '../lib/grid';
import type { PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';
import { buf, col, ellipse, inEllipse, outlineBuf, px, rect, stamp } from '../fx/draw';
import { BUTTON_STATES, roundButton, type ButtonState } from './buttons';
import { ICON_AIR, ICON_FRAG, ICON_RAM, ICON_RAPID } from './specials.grid';

export const SPECIAL_SKILLS = ['ram', 'rapid', 'frag', 'missile', 'air'] as const;
export type SpecialSkill = (typeof SPECIAL_SKILLS)[number];
export type SpecialIconName = SpecialSkill | 'aim' | 'cancel';
export const SPECIAL_ICON_NAMES: readonly SpecialIconName[] = [...SPECIAL_SKILLS, 'aim', 'cancel'];

const RAM_KEYS: KeyMap = {
  o: 'earth0',
  H: 'earth3',
  h: 'earth4',
  n: 'earth1',
  M: 'gray1',
  k: 'ink',
  B: 'navy2',
  W: 'stone5',
};
const RAPID_KEYS: KeyMap = { o: 'earth1', R: 'rust3', r: 'rust4', Y: 'ochre2', y: 'ochre1' };
const FRAG_KEYS: KeyMap = {
  o: 'ink',
  Z: 'zinc3',
  z: 'zinc2',
  P: 'ochre2',
  L: 'stone3',
  G: 'olive2',
  g: 'olive1',
};
const AIR_KEYS: KeyMap = {
  o: 'ink',
  G: 'gray5',
  N: 'navy2',
  S: 'sky',
  Y: 'hivis2',
  W: 'white',
  O: 'ochre3',
  r: 'rust3',
};

/** Missile icon: an olive missile climbing to the upper right, ochre band, flame at the tail. */
function missileIcon(): PixelBuffer {
  const b = buf(11, 11);
  const body = buf(11, 11);
  // Axis from tail (2.6, 8.4) to tip (9.2, 1.8): unit u = (1, -1)/√2, normal n = (1, 1)/√2.
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < 11; x++) {
      const dx = x + 0.5 - 2.6;
      const dy = y + 0.5 - 8.4;
      const u = (dx - dy) / Math.SQRT2;
      const v = (dx + dy) / Math.SQRT2;
      if (u < -0.2 && u > -3.4 && Math.abs(v) < 1.1 - (-u - 0.2) * 0.25) {
        px(b, x, y, u > -1.2 ? 'ochre4' : u > -2.2 ? 'ochre3' : 'rust3');
        continue;
      }
      let ref: string | null = null;
      if (u >= 0 && u <= 6.6 && Math.abs(v) <= 1.25) {
        ref = v < -0.45 ? 'stone3' : v > 0.45 ? 'olive1' : 'olive2';
        if (u > 4.3 && u < 5.2) ref = 'ochre3';
      } else if (u > 6.6 && u <= 8.6 && Math.abs(v) <= 1.25 * (1 - (u - 6.6) / 2.2)) ref = 'stone4';
      else if (u >= 0 && u <= 1.8 && Math.abs(v) <= 2.4) ref = 'olive1';
      if (ref) px(body, x, y, ref);
    }
  }
  outlineBuf(body, 'ink');
  stamp(b, body, 0, 0);
  return b;
}

/** Aim: a crimson sight ring with four ticks and a white centre pip. */
function aimIcon(): PixelBuffer {
  const b = buf(11, 11);
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < 11; x++) {
      const inner = inEllipse(x, y, 5.5, 5.5, 3.2, 3.2);
      if (inEllipse(x, y, 5.5, 5.5, 4.6, 4.6) && !inEllipse(x, y, 5.5, 5.5, 3.1, 3.1) && !inner)
        px(b, x, y, x + y < 9 ? 'rust4' : 'crim2');
    }
  }
  for (const [x, y] of [
    [5, 0],
    [5, 1],
    [5, 9],
    [5, 10],
    [0, 5],
    [1, 5],
    [9, 5],
    [10, 5],
  ] as const)
    px(b, x, y, 'crim2');
  px(b, 5, 5, 'white');
  px(b, 4, 5, 'stone4');
  px(b, 5, 4, 'stone4');
  outlineBuf(b, 'rust0');
  return b;
}

/** Cancel: crimson disc with a white X, lit rim. */
function cancelIcon(): PixelBuffer {
  const b = buf(11, 11);
  ellipse(b, 5.5, 5.5, 4.7, 4.7, 'crim1');
  ellipse(b, 5.2, 5.2, 3.9, 3.9, 'crim2');
  for (let k = 0; k < 5; k++) {
    px(b, 3 + k, 3 + k, 'white');
    px(b, 7 - k, 3 + k, 'white');
  }
  px(b, 3, 2, 'rust4');
  px(b, 2, 3, 'rust4');
  outlineBuf(b, 'rust0');
  return b;
}

const ICON_CACHE = new Map<SpecialIconName, PixelBuffer>();

/** The 11×11 icon of a skill (or 'aim' / 'cancel'). Cached; do not mutate. */
export function specialIcon(name: SpecialIconName): PixelBuffer {
  let b = ICON_CACHE.get(name);
  if (b) return b;
  switch (name) {
    case 'ram':
      b = grid(ICON_RAM, RAM_KEYS, {}, 'icon.ram');
      break;
    case 'rapid':
      b = grid(ICON_RAPID, RAPID_KEYS, {}, 'icon.rapid');
      break;
    case 'frag':
      b = grid(ICON_FRAG, FRAG_KEYS, {}, 'icon.frag');
      break;
    case 'missile':
      b = missileIcon();
      break;
    case 'air':
      b = grid(ICON_AIR, AIR_KEYS, {}, 'icon.air');
      break;
    case 'aim':
      b = aimIcon();
      break;
    default:
      b = cancelIcon();
  }
  ICON_CACHE.set(name, b);
  return b;
}

/** Greyscale remap (disabled buttons): luminance → gray ramp, palette-safe. */
function greyed(src: PixelBuffer): PixelBuffer {
  const ramp = ['ink', 'gray1', 'gray2', 'gray3', 'gray4', 'gray5', 'gray6'].map((r) => col(r));
  const out = buf(src.w, src.h);
  for (let i = 0; i < src.data.length; i += 4) {
    if (!src.data[i + 3]) continue;
    const l = 0.3 * src.data[i]! + 0.59 * src.data[i + 1]! + 0.11 * src.data[i + 2]!;
    const c = ramp[Math.min(6, Math.floor((l / 256) * 7))]!;
    out.data[i] = c >>> 24;
    out.data[i + 1] = (c >>> 16) & 255;
    out.data[i + 2] = (c >>> 8) & 255;
    out.data[i + 3] = 255;
  }
  return out;
}

/**
 * Ready cue that bobs over a charged unit in the world (frame 0–3 @8 fps, anchor bottom-centre
 * {8, 21}): hi-vis speech bubble (alternating hivis1/hivis2) with a tail, skill icon inside —
 * the same language as the gas grenade cue in the info panel.
 */
export function specialCue(skill: SpecialSkill, f: number): PixelBuffer {
  const g = specialIcon(skill);
  const b = buf(17, 22);
  const dy = [0, -2, -3, -1][f % 4]!;
  const fill = f % 2 ? 'hivis2' : 'hivis1';
  rect(b, 2, 3 + dy, 13, 13, 'ink');
  rect(b, 3, 2 + dy, 11, 15, 'ink');
  rect(b, 3, 4 + dy, 11, 11, fill);
  rect(b, 4, 3 + dy, 9, 13, fill);
  // Tail.
  rect(b, 7, 17 + dy, 3, 1, 'ink');
  rect(b, 8, 18 + dy, 1, 1, 'ink');
  rect(b, 8, 17 + dy, 1, 1, fill);
  stamp(b, g, 8 - Math.floor(g.w / 2), 9 + dy - Math.floor(g.h / 2));
  return b;
}

/**
 * Round brass info-panel button with the icon in the well (22×24, same body as
 * `roundButton(…, 'lg')`); pressed sinks 1 px, disabled greys the icon.
 */
export function specialButton(name: SpecialIconName, state: ButtonState): PixelBuffer {
  const b = roundButton(null, state, 'lg');
  const icon = state === 'disabled' ? greyed(specialIcon(name)) : specialIcon(name);
  stamp(
    b,
    icon,
    11 - Math.floor(icon.w / 2) - 0,
    11 - Math.floor(icon.h / 2) + (state === 'pressed' ? 1 : 0),
  );
  return b;
}

export function registerSpecialUi(reg: SpriteRegistry): void {
  for (const n of SPECIAL_ICON_NAMES) {
    reg.add(`ui.special.icon.${n}`, {
      group: 'ui',
      frames: specialIcon(n),
      anchor: { x: 5, y: 5 },
    });
    reg.add(`ui.special.btn.${n}`, {
      group: 'ui',
      frames: BUTTON_STATES.map((s) => specialButton(n, s)),
      anchor: { x: 0, y: 0 },
    });
  }
  for (const s of SPECIAL_SKILLS) {
    reg.add(`ui.special.cue.${s}`, {
      group: 'ui',
      frames: [0, 1, 2, 3].map((f) => specialCue(s, f)),
      fps: 8,
      anchor: { x: 8, y: 21 },
    });
  }
}
