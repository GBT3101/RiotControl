/**
 * Tiny sign lettering (M4b): a 3×5 pixel capital font (variable width: I, !, ¡, . are 1 px,
 * M / W are 5 px) plus 5×5 protest symbols. Used to paint slogans on protest signs and
 * sandwich boards. Glyphs are drawn as `#` on `.`.
 */

const G3: Record<string, string> = {
  A: '.#.|#.#|###|#.#|#.#',
  B: '##.|#.#|##.|#.#|##.',
  C: '.##|#..|#..|#..|.##',
  D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..',
  G: '.##|#..|#.#|#.#|.##',
  H: '#.#|#.#|###|#.#|#.#',
  I: '#|#|#|#|#',
  J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#',
  L: '#..|#..|#..|#..|###',
  M: '#...#|##.##|#.#.#|#...#|#...#',
  N: '#..#|##.#|#.##|#..#|#..#',
  O: '.#.|#.#|#.#|#.#|.#.',
  P: '##.|#.#|##.|#..|#..',
  Q: '.#.|#.#|#.#|##.|.##',
  R: '##.|#.#|##.|#.#|#.#',
  S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###',
  V: '#.#|#.#|#.#|#.#|.#.',
  W: '#...#|#...#|#.#.#|##.##|#...#',
  X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.',
  Z: '###|..#|.#.|#..|###',
  '0': '###|#.#|#.#|#.#|###',
  '1': '.#|##|.#|.#|.#',
  '2': '##.|..#|.#.|#..|###',
  '3': '##.|..#|.#.|..#|##.',
  '4': '#.#|#.#|###|..#|..#',
  '5': '###|#..|##.|..#|##.',
  '6': '.##|#..|###|#.#|###',
  '7': '###|..#|.#.|.#.|.#.',
  '8': '###|#.#|###|#.#|###',
  '9': '###|#.#|###|..#|##.',
  '!': '#|#|#|.|#',
  '¡': '#|.|#|#|#',
  '?': '##.|..#|.#.|...|.#.',
  '¿': '.#.|...|.#.|#..|.##',
  '.': '.|.|.|.|#',
  "'": '#|#|.|.|.',
  '-': '...|...|###|...|...',
  '+': '...|.#.|###|.#.|...',
  '=': '...|###|...|###|...',
  '£': '.##|.#.|###|.#.|###',
  '€': '.##|###|#..|###|.##',
  // Accented capitals collapse to their base letter (no room for accents at this size).
};

const ACCENTS: Record<string, string> = { É: 'E', È: 'E', Ê: 'E', Á: 'A', À: 'A', Ó: 'O', Í: 'I', Ú: 'U', Ñ: 'N', Ç: 'C' };

/** 5×5 symbols, referenced in slogans as `{name}`. */
export const SYMBOLS: Record<string, string> = {
  heart: '.#.#.|#####|#####|.###.|..#..',
  anarchy: '.###.|#.#.#|#####|##.##|.###.',
  fist: '.###.|#####|#####|.###.|.###.',
  arrow: '..#..|...#.|#####|...#.|..#..',
  peace: '.###.|#.#.#|#.#.#|##.##|.###.',
  skull: '.###.|#.#.#|#####|.###.|.#.#.',
  hourglass: '#####|.###.|..#..|.###.|#####',
  earth: '.###.|##..#|#.###|#..##|.###.',
  frown: '#...#|.....|.###.|#...#|.....',
  smile: '#...#|.....|#...#|.###.|.....',
  x: '#...#|.#.#.|..#..|.#.#.|#...#',
  bolt: '...#.|..#..|.###.|..#..|.#...',
  eye: '.....|.###.|#.#.#|.###.|.....',
  sun: '#.#.#|.###.|##.##|.###.|#.#.#',
};

function glyphRows(ch: string): string[] {
  const c = ACCENTS[ch] ?? ch;
  const g = G3[c];
  if (!g) throw new Error(`glyphs: no glyph for "${ch}"`);
  return g.split('|');
}

type Token = { rows: string[] };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '{') {
      const end = text.indexOf('}', i);
      const name = text.slice(i + 1, end);
      const s = SYMBOLS[name];
      if (!s) throw new Error(`glyphs: unknown symbol {${name}}`);
      out.push({ rows: s.split('|') });
      i = end;
    } else if (ch === ' ') out.push({ rows: ['.', '.', '.', '.', '.'] });
    else out.push({ rows: glyphRows(ch.toUpperCase()) });
  }
  return out;
}

/** Render one line of text to `#`/`.` rows (5 tall, 1 px letter spacing). */
export function textRows(text: string): string[] {
  const toks = tokenize(text);
  const rows = ['', '', '', '', ''];
  toks.forEach((t, i) => {
    for (let y = 0; y < 5; y++) rows[y] += (t.rows[y] ?? '') + (i < toks.length - 1 ? '.' : '');
  });
  // Collapse the double gap around spaces (space glyph is already 1 px).
  return rows;
}

export function textWidth(text: string): number {
  return textRows(text)[0]!.length;
}
