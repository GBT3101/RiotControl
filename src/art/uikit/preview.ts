/**
 * Dev-only preview compositions (docs/progress/m5-*.png). Not imported by the game; also a
 * worked example of how the kit fits together at 1440×900 (UI scale 3 → 480×300 UI px).
 */
import type { PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';
import { buf, rect, stamp } from '../fx/draw';
import { gasCloudLayout } from '../fx/gas';
import { rubberStamp, ribbon } from './banners';
import { roundButton, bigRedButton } from './buttons';
import { deployCard, integrityMeter, legitMeter, OFFICER_BUST, type CardState } from './cards';
import { ICONS, glyph } from './icons';
import { BUBBLE_TAIL_LEFT, PAPERCLIP, folderTab, minimapFrame, panel } from './panels';
import { ministerAnims, portraitBox } from './portraits';
import { FONTS, drawText, measureText } from './text';
import { frontPage } from './newspaper';
import { logoFrames } from './logo';

const SW = 480;
const SH = 300;

function label(b: PixelBuffer, text: string, x: number, y: number): number {
  drawText(b, FONTS.smallBold, text, x, y, 'stone5', { shadow: 'ink' });
  return measureText(FONTS.smallBold, text).w;
}

/** Full HUD at UI resolution 480×300 (transparent where the world shows through). */
export function composeHud(): PixelBuffer {
  const b = buf(SW, SH);
  // --- Top bar (leather) -----------------------------------------------------------
  const top = panel('leather', SW, 26);
  stamp(b, top, 0, 0);
  let x = 9;
  stamp(b, ICONS.hate(), x, 7);
  x += label(b, '1,250', x + 16, 10) + 26;
  stamp(b, legitMeter(0.62, 4, 88), x, 4);
  x += 94;
  stamp(b, integrityMeter(0.58, 80), x, 5);
  x += 88;
  stamp(b, ICONS.wave(), x, 8);
  x += label(b, 'WAVE 7', x + 16, 10) + 24;
  stamp(b, ICONS.crowd(), x, 6);
  x += label(b, '842', x + 17, 10) + 24;
  void x;
  // Toggles (right).
  const toggles = ['pause', 'speed2', 'sound', 'settings', 'codex'] as const;
  toggles.forEach((t, i) =>
    stamp(
      b,
      roundButton(t, i === 1 ? 'hover' : 'normal', 'sm'),
      SW - 8 - (toggles.length - i) * 19,
      3,
    ),
  );
  // --- Minimap (bottom right) ------------------------------------------------------
  const mm = minimapFrame(84, 84);
  const mmx = SW - mm.w - 4;
  const mmy = SH - mm.h - 4;
  stamp(b, mm, mmx, mmy);
  // Stylised map inside: grass, river, roads, capitol, crowd dots.
  rect(b, mmx + 6, mmy + 14, 72, 72, 'green2');
  rect(b, mmx + 6, mmy + 60, 72, 6, 'blue1');
  rect(b, mmx + 30, mmy + 14, 6, 72, 'gray3');
  rect(b, mmx + 6, mmy + 36, 72, 5, 'gray3');
  rect(b, mmx + 40, mmy + 44, 10, 8, 'stone5');
  for (let i = 0; i < 18; i++)
    rect(b, mmx + 8 + ((i * 37) % 64), mmy + 18 + ((i * 23) % 16), 1, 1, 'crim2');
  rect(b, mmx + 20, mmy + 30, 26, 18, 'stone5');
  rect(b, mmx + 21, mmy + 31, 24, 16, 'green2');
  rect(b, mmx + 20, mmy + 30, 26, 1, 'white');
  // --- Deploy bar (bottom centre) ---------------------------------------------------
  const cards: Array<[number, CardState, number?]> = [
    [5, 'ready'],
    [7, 'selected'],
    [7, 'ready'],
    [10, 'ready'],
    [10, 'unaffordable'],
    [50, 'locked', 5],
    [100, 'locked', 6],
    [300, 'locked', 7],
  ];
  const barW = cards.length * 39 + 14;
  const barX = SW - 92 - barW;
  const bar = panel('leather', barW, 60);
  stamp(b, bar, barX, SH - 60);
  cards.forEach(([cost, st, lvl], i) => {
    stamp(
      b,
      deployCard({ portrait: OFFICER_BUST, cost, hotkey: String(i + 1), state: st, level: lvl }),
      barX + 7 + i * 39,
      SH - 54,
    );
  });
  // --- Advisor (bottom left): portrait + speech bubble ----------------------------------
  const face = ministerAnims().talk[1]!;
  const box = portraitBox(face);
  stamp(b, box, 4, SH - box.h - 64);
  const text = "Every fallen officer makes us MORE legitimate. Isn't democracy beautiful?";
  const bw = 150;
  const tm = measureText(FONTS.mono, text, bw - 14);
  const bub = panel('bubble', bw, tm.h + 16);
  const bx = box.w + 12;
  const by = SH - box.h - 64 + 6;
  stamp(b, bub, bx, by);
  stamp(b, BUBBLE_TAIL_LEFT, bx - 7, by + 10);
  drawText(b, FONTS.mono, text, bx + 7, by + 7, 'ink', { maxWidth: bw - 14 });
  const nm = panel('brass', measureText(FONTS.smallBold, 'THE MINISTER').w + 12, 15);
  drawText(nm, FONTS.smallBold, 'THE MINISTER', 6, 4, 'earth1', {
    shadow: 'ochre4',
    shadowOffset: { x: 0, y: 1 },
  });
  stamp(b, nm, 10, SH - box.h - 64 - 10);
  // --- Level-up moment (centre) -------------------------------------------------------
  const rib = ribbon('NEW TOOL OF ORDER APPROVED');
  stamp(b, rib, Math.floor((SW - rib.w) / 2), 40);
  // Unlock dossier: manila sheet with the new card, typed notes, clip, tab and stamps.
  const dx = Math.floor(SW / 2) - 95;
  const dy = 86;
  stamp(b, folderTab(46), dx + 8, dy - 9);
  drawText(b, FONTS.small, 'FILE 07', dx + 13, dy - 6, 'earth2');
  const dossier = panel('manila', 190, 84);
  stamp(b, dossier, dx, dy);
  const sheet = panel('paper', 128, 58);
  stamp(b, sheet, dx + 54, dy + 7);
  const unlock = deployCard({ portrait: OFFICER_BUST, cost: 7, hotkey: '2', state: 'ready' });
  stamp(b, unlock, dx + 10, dy + 12);
  stamp(b, PAPERCLIP, dx + 168, dy - 4);
  drawText(b, FONTS.smallBold, 'RUBBER SNIPER', dx + 65, dy + 12, 'ink');
  drawText(b, FONTS.mono, 'Rooftops only.\nNon-lethal.*\nRange: 9', dx + 65, dy + 24, 'gray1', {
    lineGap: -1,
  });
  drawText(b, FONTS.small, '*mostly', dx + 65, dy + 53, 'stone1');
  const st = rubberStamp('APPROVED', 'green2', { tilt: -0.1 });
  stamp(b, st, dx + 106, dy + 50);
  const lv = rubberStamp('LEVEL 1', 'crim1', { font: FONTS.smallBold, tilt: 0.08, seed: 3 });
  stamp(b, lv, dx + 2, dy + 60);
  // Gas grenade ability hint.
  const call = roundButton('next', 'normal', 'lg');
  void call;
  void glyph;
  void bigRedButton;
  return b;
}

/** FX sheet (unscaled; export at 4×): explosions, gas cloud, fire, blood, KO, flashes. */
export function composeFxSheet(reg: SpriteRegistry): PixelBuffer {
  const W = 420;
  const H = 292;
  const b = buf(W, H);
  rect(b, 0, 0, W, H, 'gray2');
  for (let y = 0; y < H; y += 16) rect(b, 0, y, W, 1, 'gray1');
  const put = (name: string, frame: number, x: number, y: number): void => {
    const d = reg.get(name);
    const f = d.frames[Math.min(frame, d.frames.length - 1)]!;
    stamp(b, f, x - d.anchor.x, y - d.anchor.y);
  };
  // Row 1: tank-shell explosion sequence, bazooka, grenade.
  [0, 1, 2, 4, 6, 8].forEach((f, i) => put('fx.explosion.big', f, 26 + i * 40, 62));
  put('fx.explosion.medium', 2, 290, 62);
  put('fx.explosion.medium', 4, 330, 62);
  put('fx.explosion.small', 2, 368, 62);
  put('fx.explosion.small', 4, 398, 62);
  // Row 2: the Prophet's comic boom.
  [0, 2, 4, 7].forEach((f, i) => put('fx.explosion.prophet', f, 40 + i * 72, 148));
  put('fx.smoke.column.black', 3, 330, 150);
  put('fx.smoke.column.grey', 5, 386, 150);
  // Row 3: composed gas cloud, fire, molotov.
  for (const p of gasCloudLayout(7, 8, 48))
    put(`fx.gas.puff.${p.variant}.loop`, Math.floor(p.delay * 10) % 4, 60 + p.dx, 214 + p.dy);
  put('fx.gas.canister', 1, 130, 196);
  put('fx.gas.trail', 2, 140, 198);
  put('fx.fire.patch.medium', 0, 176, 222);
  put('fx.fire.patch.small', 2, 214, 218);
  put('fx.molotov.bottle', 1, 236, 186);
  put('fx.molotov.shatter', 3, 262, 220);
  put('fx.fire.burning', 1, 300, 218);
  put('fx.rotorwash', 1, 362, 214);
  // Row 4: blood, KO, flashes, muzzle, misc.
  const r4 = 270;
  put('fx.blood.splat.c', 0, 20, r4);
  put('fx.blood.splat.a', 0, 40, r4 + 6);
  put('fx.blood.puff.b', 1, 62, r4 - 6);
  put('fx.ko.stars', 1, 92, r4 - 8);
  put('fx.ko.birds', 2, 124, r4 - 8);
  put('fx.anger', 1, 150, r4 - 8);
  put('fx.sweat', 1, 166, r4 - 12);
  put('fx.camflash', 0, 188, r4 - 6);
  put('fx.muzzle.rifle.e', 0, 210, r4 - 6);
  put('fx.muzzle.cannon.se', 0, 236, r4 - 8);
  put('fx.muzzle.mg.ne', 0, 262, r4 - 4);
  put('fx.seal.pop', 4, 290, r4 - 6);
  put('fx.pickup.hate', 0, 312, r4 - 8);
  put('fx.splash', 2, 334, r4 + 2);
  put('fx.sparks', 2, 362, r4 - 8);
  put('ui.select.ally.m', 1, 392, r4 - 2);
  put('ui.tile.valid', 1, 392, r4 + 4);
  return b;
}

/** Fonts sheet (export at 3×). */
export function composeFonts(reg: SpriteRegistry): PixelBuffer {
  const parts = [
    'ui.font.large.specimen',
    'ui.font.small.specimen',
    'ui.font.smallbold.specimen',
    'ui.font.mono.specimen',
  ].map((n) => reg.get(n).frames[0]!);
  const W = Math.max(...parts.map((p) => p.w)) + 8;
  const H = parts.reduce((s, p) => s + p.h + 4, 4);
  const b = buf(W, H);
  rect(b, 0, 0, W, H, 'gray1');
  let y = 4;
  for (const p of parts) {
    stamp(b, p, 4, y);
    y += p.h + 4;
  }
  return b;
}

/** Title + newspapers sheet (export at 2×). */
export function composeTitle(): PixelBuffer {
  const logo = logoFrames()[3]!;
  const win = frontPage(
    'london',
    'ORDER RESTORED',
    'Ministry hails "proportionate response". Officials deny everything, including this newspaper.',
    250,
    230,
    ['APPROVED', 'green2'],
  );
  const lose = frontPage(
    'paris',
    'THE REGIME HAS FALLEN',
    'Protesters dance on the Assemblée. Minister last seen boarding a "routine" flight.',
    250,
    230,
    ['DENIED', 'crim1'],
  );
  const W = 520;
  const H = logo.h + 240 + 12;
  const b = buf(W, H);
  rect(b, 0, 0, W, H, 'navy0');
  stamp(b, logo, Math.floor((W - logo.w) / 2), 4);
  stamp(b, win, 6, logo.h + 10);
  stamp(b, lose, W - lose.w - 6, logo.h + 10);
  return b;
}
