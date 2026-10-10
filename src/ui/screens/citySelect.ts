/**
 * City select: three dossier postcards (Madrid, London, Paris) over the dimmed live city. Each
 * shows the capitol in a photo window (real landmark art: the loaded city from the atlas, the
 * others painted in background workers), the city name, a tagline, the best result from
 * localStorage (or a CLASSIFIED stamp) and a DEPLOY stamp button.
 */
import { Container, Sprite } from 'pixi.js';
import { buf, hline, px, rect, stamp } from '../../art/fx/draw';
import { crop, opaqueBounds, type PixelBuffer } from '../../art/lib/pixels';
import { rubberStamp } from '../../art/uikit/banners';
import {
  FONTS,
  drawText,
  measureText,
  type BitmapFont,
  type TextOptions,
} from '../../art/uikit/text';
import { assemblePieces, capitolPictures } from '../../game/boot';
import { art } from '../../art/lib/atlas';
import { CITIES, type CityId } from '../../maps/contract';
import { Button, stampFaces } from '../core/button';
import { overlaps, textBox, type Box } from '../core/boxes';
import { makeInteractive } from '../core/node';
import { atlasBuffer, ownTex, destroyOwned } from '../core/tex';
import { formatDuration, formatNumber, type CityRecord } from '../records';
import { CITY_COPY } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';
import { dossier, heading } from './common';
import { backdrop, fitBackdrop, type Screen } from './screen';

/** Pictures painted once per page visit (workers). */
const pictures = new Map<CityId, PixelBuffer>();
let painting: Promise<void> | null = null;

/**
 * Crop a postcard window out of the capitol art: the w×h window with the most opaque pixels
 * (prefers the upper facade on ties). Pure.
 */
export function postcardCrop(src: PixelBuffer, w: number, h: number): PixelBuffer {
  const ob = opaqueBounds(src) ?? { x: 0, y: 0, w: src.w, h: src.h };
  // Summed-area table of opacity.
  const W = src.w;
  const sat = new Int32Array((src.w + 1) * (src.h + 1));
  for (let y = 0; y < src.h; y++) {
    let row = 0;
    for (let x = 0; x < src.w; x++) {
      row += src.data[(y * W + x) * 4 + 3] === 255 ? 1 : 0;
      sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1]! + row;
    }
  }
  const sum = (x: number, y: number): number => {
    const x1 = Math.min(src.w, x + w);
    const y1 = Math.min(src.h, y + h);
    return (
      sat[y1 * (W + 1) + x1]! -
      sat[y * (W + 1) + x1]! -
      sat[y1 * (W + 1) + x]! +
      sat[y * (W + 1) + x]!
    );
  };
  let best = -1;
  let bx = Math.max(0, ob.x + Math.floor((ob.w - w) / 2));
  let by = ob.y;
  for (let y = Math.max(0, ob.y - 4); y <= Math.max(0, src.h - h); y += 2) {
    for (
      let x = Math.max(0, ob.x - 4);
      x <= Math.max(0, Math.min(src.w - w, ob.x + ob.w - w + 4));
      x += 2
    ) {
      // Slight preference for the horizontal centre and the upper part.
      const n = sum(x, y) - Math.abs(x + w / 2 - (ob.x + ob.w / 2)) * 0.5 - (y - ob.y) * 0.8;
      if (n > best) {
        best = n;
        bx = x;
        by = y;
      }
    }
  }
  return crop(
    src,
    Math.min(bx, Math.max(0, src.w - w)),
    Math.min(by, Math.max(0, src.h - h)),
    w,
    h,
  );
}

/** Sky + ground behind the capitol cut-out, then the art; photo border. */
function photo(city: CityId, art: PixelBuffer | null, w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  const sky =
    city === 'london' ? ['sky', 'blue2'] : city === 'paris' ? ['sky', 'lilac'] : ['sky', 'ochre4'];
  for (let y = 0; y < h; y++) hline(b, 0, y, w, y < h * 0.55 ? sky[0]! : sky[1]!);
  rect(b, 0, Math.floor(h * 0.78), w, h - Math.floor(h * 0.78), 'stone3');
  if (art) {
    const c = postcardCrop(art, w, h + 10);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = ((y + 6) * c.w + x) * 4;
        if (y + 6 >= c.h || c.data[i + 3] !== 255) continue;
        b.data.set(c.data.subarray(i, i + 4), (y * w + x) * 4);
      }
  } else {
    drawText(b, FONTS.small, 'PHOTO PENDING', Math.floor(w / 2), Math.floor(h / 2) - 3, 'gray3', {
      align: 'center',
    });
  }
  // White photo border + ink frame.
  const out = buf(w + 6, h + 6);
  rect(out, 0, 0, w + 6, h + 6, 'ink');
  rect(out, 1, 1, w + 4, h + 4, 'white');
  hline(out, 1, h + 4, w + 4, 'stone4');
  stamp(out, b, 3, 3);
  return out;
}

function recordLines(r: CityRecord): string[] {
  if (r.runs === 0) return [];
  const out = [`BEST ${formatNumber(r.bestLegit)} LEGIT · WAVE ${r.bestWave}`];
  out.push(
    r.wins > 0
      ? `WON ${r.wins}/${r.runs} · FASTEST ${formatDuration(r.fastestWin)}`
      : `RUNS ${r.runs} · NO VICTORY YET`,
  );
  return out;
}

/**
 * The whole postcard (dossier) for one city, and the boxes of everything typed or stamped on
 * it (buffer px). `button` is the DEPLOY button's box in the same coordinates: no text or stamp
 * runs under it (lines re-wrap left of it, or are left out when there is no room).
 */
export function postcard(
  city: CityId,
  rec: CityRecord,
  w: number,
  h: number,
  art: PixelBuffer | null,
  horizontal: boolean,
  button: Box,
): { buf: PixelBuffer; boxes: Record<string, Box> } {
  const copy = CITY_COPY[city];
  const b = dossier(w, h, `FILE: ${copy.name.toUpperCase()}`, !horizontal);
  const boxes: Record<string, Box> = { button };
  const oy = 10;
  // A text block that may not run under the button: narrowed left of it, else dropped.
  const typeLine = (
    font: BitmapFont,
    str: string,
    x: number,
    y: number,
    maxW: number,
    colour: string,
    key: string,
    centre?: number,
    opts: TextOptions = {},
  ): boolean => {
    const at = (mw: number): Box => {
      const t = textBox(font, str, x, y, mw);
      return centre === undefined ? t : { ...t, x: centre - Math.floor(t.w / 2) };
    };
    let mw = maxW;
    let box = at(mw);
    if (overlaps(box, button, 2)) {
      mw = button.x - 3 - x;
      box = at(mw);
      if (mw < 30 || centre !== undefined || overlaps(box, button, 2)) return false;
    }
    if (box.y + box.h > oy + h - 3) return false;
    drawText(b, font, str, centre ?? x, y, colour, {
      ...opts,
      maxWidth: mw,
      ...(centre !== undefined ? { align: 'center' as const } : {}),
    });
    boxes[key] = box;
    return true;
  };
  const classified = rubberStamp('CLASSIFIED', 'crim1', {
    font: FONTS.smallBold,
    tilt: -0.06,
    seed: 5,
  });
  if (horizontal) {
    const pw = Math.min(110, Math.floor(w * 0.46));
    const ph = h - 22;
    stamp(b, photo(city, art, pw, ph), 6, oy + 6);
    boxes.photo = { x: 6, y: oy + 6, w: pw + 6, h: ph + 6 };
    const x = pw + 16;
    const tw = w - x - 8;
    typeLine(FONTS.large, copy.name.toUpperCase(), x, oy + 7, tw, 'ink', 'name', undefined, {
      shadow: 'stone3',
    });
    typeLine(FONTS.small, copy.tagline, x, oy + 24, tw, 'rust1', 'tagline');
    let y = oy + 24 + measureText(FONTS.small, copy.tagline, tw).h + 6;
    const lines = recordLines(rec);
    lines.forEach((l, k) => {
      if (typeLine(FONTS.small, l, x, y, tw, 'gray1', `record${k}`))
        y = boxes[`record${k}`]!.y + boxes[`record${k}`]!.h + 3 + FONTS.small.ascent;
    });
    if (!lines.length) {
      const sb = { x, y, w: classified.w, h: classified.h };
      if (!overlaps(sb, button, 2) && sb.y + sb.h <= oy + h - 2 && sb.x + sb.w <= w - 4) {
        stamp(b, classified, x, y);
        boxes.stamp = sb;
      } else typeLine(FONTS.small, 'NO RECORD ON FILE', x, y, tw, 'stone1', 'stamp');
    }
    return { buf: b, boxes };
  }
  const pw = w - 16;
  const ph = Math.max(40, Math.min(76, Math.floor(h * 0.42)));
  stamp(b, photo(city, art, pw - 6, ph), 8, oy + 7);
  boxes.photo = { x: 8, y: oy + 7, w: pw, h: ph + 6 };
  let y = oy + 7 + ph + 10;
  const nm = measureText(FONTS.large, copy.name.toUpperCase());
  typeLine(
    FONTS.large,
    copy.name.toUpperCase(),
    Math.floor((w - nm.w) / 2),
    y,
    w,
    'ink',
    'name',
    undefined,
    {
      shadow: 'stone3',
    },
  );
  y += 17;
  typeLine(FONTS.small, copy.tagline, 8, y, w - 16, 'rust1', 'tagline', Math.floor(w / 2));
  y += measureText(FONTS.small, copy.tagline, w - 16).h + 5;
  for (let x = 8; x < w - 8; x += 2) px(b, x, y, 'stone2');
  y += 4;
  // Records and the stamp stay above the DEPLOY button.
  const lines = recordLines(rec);
  lines.forEach((l, k) => {
    if (y + FONTS.small.capHeight > button.y - 3) return;
    if (measureText(FONTS.small, l, w - 12).h + y > button.y - 3) return;
    const key = `record${k}`;
    // A long record wraps: the next line goes under all of it.
    if (typeLine(FONTS.small, l, 6, y, w - 12, 'gray1', key, Math.floor(w / 2)))
      y = Math.max(y + 10, boxes[key]!.y + boxes[key]!.h + 1 + FONTS.small.ascent);
  });
  if (!rec.runs) {
    const sb = { x: Math.floor((w - classified.w) / 2), y, w: classified.w, h: classified.h };
    if (!overlaps(sb, button, 2) && sb.y + sb.h <= oy + h - 2) {
      stamp(b, classified, sb.x, sb.y);
      boxes.stamp = sb;
    } else
      typeLine(
        FONTS.small,
        'NO RECORD ON FILE',
        6,
        y,
        w - 12,
        'stone1',
        'stamp',
        Math.floor(w / 2),
      );
  }
  return { buf: b, boxes };
}

export class CitySelectScreen implements Screen {
  readonly root = new Container({ label: 'city-select' });
  readonly modal = true;
  private readonly dim = backdrop(0.45);
  private readonly title = new Sprite();
  private readonly cards: Array<{ city: CityId; sprite: Sprite; go: Button }> = [];
  private readonly back: Button;
  private l: HudLayout | null = null;
  private t = 0;
  private alive = true;

  constructor(private readonly app: UiApp) {
    this.title.texture = ownTex(heading('SELECT A CITY'), 'ui:select-title');
    this.root.addChild(this.dim, this.title);
    for (const city of CITIES) {
      const sprite = new Sprite();
      const go = new Button(stampFaces('DEPLOY'), { onTap: () => this.choose(city), pad: 3 });
      makeInteractive(sprite, { tap: () => this.choose(city) });
      this.cards.push({ city, sprite, go });
      this.root.addChild(sprite, go);
    }
    this.back = new Button(stampFaces('BACK'), { onTap: () => this.goBack(), pad: 3 });
    this.root.addChild(this.back);
    // Capitol pictures: the loaded city comes straight from the atlas; paint the others.
    for (const c of CITIES) {
      if (pictures.has(c)) continue;
      const re = new RegExp(`^lm\\.cap\\.${c}\\.0\\.\\d+$`);
      const items = art
        .names()
        .filter((n) => re.test(n))
        .map((n) => ({ buf: atlasBuffer(n), anchor: art.anim(n).anchor }))
        .filter((x): x is { buf: PixelBuffer; anchor: { x: number; y: number } } => !!x.buf);
      const b = assemblePieces(items);
      if (b) pictures.set(c, b);
    }
    const missing = CITIES.filter((c) => !pictures.has(c));
    if (missing.length && !painting) {
      painting = capitolPictures(missing, app.params.nocache)
        .then((m) => {
          for (const [c, b] of m) pictures.set(c, b);
        })
        .catch(() => undefined);
    }
    void painting?.then(() => {
      if (this.alive && this.l) this.layout(this.l);
    });
  }

  private choose(city: CityId): void {
    void this.app.startRun(city);
  }

  private goBack(): void {
    this.app.pop(this);
    this.app.backToTitleMenu();
  }

  layout(l: HudLayout): void {
    this.l = l;
    fitBackdrop(this.dim, l);
    const horizontal = l.W < 420;
    const tw = this.title.texture.width;
    this.title.position.set(Math.floor((l.W - tw) / 2), l.safe.top + 6);
    const top = l.safe.top + 6 + this.title.texture.height + 4;
    const bottom = l.H - l.safe.bottom - 34;
    if (horizontal) {
      const w = Math.min(300, l.W - 12);
      const avail = bottom - top;
      // Taller cards where there is room: the record lines wrap on narrow phones.
      const h = Math.max(70, Math.min(124, Math.floor(avail / 3) - 14));
      this.cards.forEach((c, k) => {
        const y = top + k * (h + 14);
        const x = Math.floor((l.W - w) / 2);
        const btn = { x: w - c.go.w - 8, y: h + 6 - c.go.h, w: c.go.w, h: c.go.h };
        const card = postcard(
          c.city,
          this.app.records[c.city],
          w,
          h,
          pictures.get(c.city) ?? null,
          true,
          btn,
        );
        this.setCard(c, card.buf, x, y);
        c.go.position.set(x + btn.x, y + btn.y);
      });
    } else {
      const gap = 10;
      const w = Math.min(150, Math.floor((l.W - l.safe.left - l.safe.right - 16 - gap * 2) / 3));
      const h = Math.max(120, Math.min(196, bottom - top - 16));
      const x0 = Math.floor((l.W - (w * 3 + gap * 2)) / 2);
      this.cards.forEach((c, k) => {
        const x = x0 + k * (w + gap);
        const btn = { x: Math.floor((w - c.go.w) / 2), y: h + 4 - c.go.h, w: c.go.w, h: c.go.h };
        const card = postcard(
          c.city,
          this.app.records[c.city],
          w,
          h,
          pictures.get(c.city) ?? null,
          false,
          btn,
        );
        this.setCard(c, card.buf, x, top);
        c.go.position.set(x + btn.x, top + btn.y);
      });
    }
    this.back.position.set(l.safe.left + 6, l.H - l.safe.bottom - this.back.h - 4);
  }

  private setCard(c: { sprite: Sprite }, b: PixelBuffer, x: number, y: number): void {
    const old = c.sprite.texture;
    c.sprite.texture = ownTex(b, 'ui:postcard');
    if (old && old.label === 'ui:postcard') old.destroy(true);
    c.sprite.position.set(x, y);
  }

  update(dt: number): void {
    this.t += dt;
  }

  key(code: string): boolean {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[code];
    if (n !== undefined) {
      this.choose(CITIES[n]!);
      return true;
    }
    if (code === 'Escape') {
      this.goBack();
      return true;
    }
    return false;
  }

  destroy(): void {
    this.alive = false;
    for (const c of this.cards)
      if (c.sprite.texture.label === 'ui:postcard') c.sprite.texture.destroy(true);
    destroyOwned(this.root);
  }
}
