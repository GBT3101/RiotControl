/**
 * Protest signs (M4b): boards with tiny pixel slogans (3×5 font, see glyphs.ts), on a pole
 * (held in one hand) or as two-handed cardboard. Front (SE) shows the slogan, back (NE)
 * shows bare cardboard with tape. Slogans are city-flavoured via `SLOGANS[city]`.
 */
import { keyGrid } from '../lib/grid';
import type { PartDef } from './book';
import { textRows } from './glyphs';
import type { SignArt } from './figure';
import type { Tone } from './tones';

export type City = 'madrid' | 'london' | 'paris' | 'any';

/** Short slogans (≤ ~17 px wide in the 3×5 font). `{sym}` = 5×5 symbol. */
export const SLOGANS: Readonly<Record<City, readonly string[]>> = {
  any: [
    'NO!',
    'WHY?',
    'BAH',
    'STOP',
    'NOPE',
    'BOO!',
    '{heart}',
    '{anarchy}',
    '{fist}',
    '{peace}',
    'NO{x}',
    'MEH',
    'RAGE',
    '?!',
    '{frown}',
    'DOWN',
    '{arrow}',
    'LOVE',
    'MORE',
    'LESS',
    'UGH',
    'STOPP',
    'NOOO',
    'WAT',
    'HALP',
    'PLZ',
    'OK?',
    '{eye}{eye}',
    '{bolt}',
    '{sun}',
  ],
  madrid: ['¡NO!', 'BASTA', 'OLE', 'VALE', '¡YA!', 'ADIOS', 'NO!', 'FUERA', '¿POR?', 'JOPE'],
  london: ['OI!', 'NO!', 'TEA?', 'BAH', 'NAFF', 'SORRY', 'MEH', 'OI OI', 'PANTS', 'CHEEK'],
  paris: ['NON!', 'MERDE', 'ZUT', 'GREVE', 'BOF', 'NUL', 'NON', 'HELAS', 'NON{x}', 'OUSTE'],
};

/** Students' hand-made signs (more misspellings). */
export const STUDENT_SLOGANS: readonly string[] = ['STOPP', 'NOOO', 'WAT', 'HALP', 'PLZ', 'WHY?', 'MOAR', 'NO!', 'UGH', '{heart}', '{peace}', 'OK?', 'MEH'];

export interface SignStyle {
  text: string | readonly string[];
  board: Tone;
  ink: string;
  card: boolean;
  /** Torn top-right corner (cardboard). */
  torn?: boolean;
}

function boardRows(lines: readonly string[], torn: boolean): string[] {
  const rendered = lines.map((l) => textRows(l));
  const tw = Math.max(...rendered.map((r) => r[0]!.length));
  const w = tw + 4;
  const rows: string[] = [];
  rows.push('y' + 'Y'.repeat(w - 2) + 'y');
  rendered.forEach((r, li) => {
    if (li > 0) rows.push('Y' + 'C'.repeat(w - 2) + 'c');
    for (const line of r) {
      const pad = tw - line.length;
      const l = Math.floor(pad / 2);
      const body = 'C'.repeat(l) + line.replace(/#/g, 'k').replace(/\./g, 'C') + 'C'.repeat(pad - l);
      rows.push('YC' + body + 'Cc');
    }
  });
  rows.push('y' + 'c'.repeat(w - 2) + 'y');
  if (torn) {
    rows[0] = rows[0]!.slice(0, w - 2) + '..';
    rows[1] = rows[1]!.slice(0, w - 1) + '.';
  }
  return rows;
}

function backRows(w: number, h: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const edge = y === 0 ? 'Y' : y === h - 1 ? 'y' : x === 0 ? 'Y' : x === w - 1 ? 'y' : 'c';
      r += edge;
    }
    rows.push(r);
  }
  // tape cross + pole fixing
  const mx = Math.floor(w / 2);
  rows[1] = rows[1]!.slice(0, 1) + 'w' + rows[1]!.slice(2, w - 2) + 'w' + rows[1]!.slice(w - 1);
  for (let y = 1; y < h - 1; y++) rows[y] = rows[y]!.slice(0, mx) + 'o' + rows[y]!.slice(mx + 1);
  return rows;
}

function withPole(rows: string[], pole: number, back: boolean): { rows: string[]; origin: { x: number; y: number } } {
  const w = rows[0]!.length;
  const mx = Math.floor(w / 2);
  const out = [...rows];
  for (let i = 0; i < pole; i++) out.push('.'.repeat(mx) + (back ? 'o' : 'O') + '.'.repeat(w - mx - 1));
  // grip = 3 px below the board (hand covers the rest of the pole)
  return { rows: out, origin: { x: mx, y: rows.length + 3 } };
}

/** Build front/back sign parts. Keys: see `signKeys`. */
export function makeSign(style: SignStyle, name: string): SignArt & { keys: Record<string, string> } {
  const lines = typeof style.text === 'string' ? [style.text] : style.text;
  const front = boardRows(lines, !!style.torn);
  const w = front[0]!.length;
  const h = front.length;
  const back = backRows(w, h);
  let f: { rows: string[]; origin: { x: number; y: number } };
  let bk: { rows: string[]; origin: { x: number; y: number } };
  if (style.card) {
    f = { rows: front, origin: { x: Math.floor(w / 2), y: h } };
    bk = { rows: back, origin: { x: Math.floor(w / 2), y: h } };
  } else {
    f = withPole(front, 6, false);
    bk = withPole(back, 6, true);
  }
  const part = (rows: string[], origin: { x: number; y: number }, n: string): PartDef => ({
    name: n,
    grid: keyGrid(rows, n),
    origin,
    anchors: {},
  });
  return {
    front: part(f.rows, f.origin, `${name}.front`),
    back: part(bk.rows, bk.origin, `${name}.back`),
    card: style.card,
    keys: signKeys(style.board, style.ink),
  };
}

export function signKeys(board: Tone, ink: string): Record<string, string> {
  return {
    y: board[0]!,
    c: board[1]!,
    C: board[2]!,
    Y: board[3]!,
    k: ink,
    o: 'earth2',
    O: 'earth3',
    w: 'stone5',
  };
}

/**
 * Prophet sandwich board, front side: "END" lettered on cream board, comic red dynamite
 * sticks poking out of the top and sides. Origin = neck (board top sits on the shoulders).
 */
export function makeBoard(word = 'END', board: Readonly<Record<string, string>> = {}): { part: PartDef; keys: Record<string, string> } {
  const text = textRows(word).map((r) => r.replace(/#/g, 'k').replace(/\./g, 'C'));
  const tw = text[0]!.length;
  const w = tw + 2;
  const rows: string[] = [];
  const sticks = [1, 4, w - 5, w - 2];
  const line = (f: (x: number) => string): string => Array.from({ length: w + 2 }, (_, x) => f(x - 1)).join('');
  rows.push(line((x) => (sticks.includes(x) ? 'f' : '.')));
  rows.push(line((x) => (sticks.includes(x) ? 'R' : sticks.includes(x - 1) ? 'r' : '.')));
  rows.push(line((x) => (x < 0 || x >= w ? '.' : x === 0 || x === w - 1 ? 'y' : 'Y')));
  for (let i = 0; i < 7; i++) {
    const t = i >= 1 && i <= 5 ? text[i - 1]! : 'C'.repeat(tw);
    const side = i === 2 || i === 4 ? 'R' : '.';
    rows.push(side + 'Y' + t + 'c' + side);
  }
  rows.push(line((x) => (x < 0 || x >= w ? '.' : x === 0 || x === w - 1 ? 'y' : 'c')));
  return {
    part: { name: 'prophet.board', grid: keyGrid(rows, 'prophet.board'), origin: { x: Math.floor((w + 2) / 2), y: 1 }, anchors: {} },
    keys: { y: 'stone1', c: 'stone3', C: 'stone4', Y: 'stone5', k: 'crim1', R: 'crim2', r: 'crim1', f: 'ochre3', ...board },
  };
}
