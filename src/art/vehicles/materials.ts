/**
 * Vehicle materials: hue-shifted RIOT-64 ramps (darkest → lightest) with the step a lit
 * vertical ("left") face uses. Top faces get +1, shaded ("right") faces −1, lit edges +1 more.
 */
import type { SwatchName } from '../palette';
import type { Material, MatTable } from './render3d';

const m = (ramp: SwatchName[], base: number, extra: Partial<Material> = {}): Material => ({
  ramp,
  base,
  ...extra,
});

/** Shared vehicle materials. Vehicle modules extend this table. */
export const MATS: MatTable = {
  // --- Army olive & sand ---
  olive: m(['green0', 'green1', 'olive1', 'olive2', 'stone3', 'stone4'], 2, { ol: 'ink' }),
  oliveDk: m(['green0', 'green0', 'green1', 'olive1', 'olive2', 'stone3'], 2, { ol: 'ink' }),
  sand: m(['stone0', 'stone1', 'stone2', 'stone3', 'stone4', 'stone5'], 2, { ol: 'ink' }),
  mud: m(['earth0', 'earth1', 'earth2', 'earth3', 'earth4'], 2, { ol: 'ink' }),
  canvas: m(['stone0', 'stone1', 'stone2', 'stone3', 'stone4', 'stone5'], 2, { ol: 'ink' }),
  canvasDk: m(['ink', 'stone0', 'stone1', 'stone2', 'stone3'], 2, { ol: 'ink' }),
  sandbag: m(['earth1', 'earth2', 'earth3', 'stone2', 'stone3', 'stone4'], 2, { ol: 'earth0', spec: true }),
  sandbagDk: m(['earth0', 'earth1', 'earth2', 'earth3', 'stone2'], 2, { ol: 'earth0' }),
  jerry: m(['rust0', 'rust1', 'rust2', 'rust3', 'rust4'], 2, { ol: 'rust0', spec: true }),
  jerryDk: m(['rust0', 'rust0', 'rust1', 'rust2'], 1, { ol: 'rust0' }),
  // --- Mechanical ---
  tyre: m(['ink', 'ink', 'gray1', 'gray2', 'gray3'], 2, { ol: 'ink' }),
  tread: m(['ink', 'gray1', 'gray2', 'gray3', 'gray4'], 1, { ol: 'ink' }),
  rubber: m(['ink', 'gray1', 'gray2', 'gray3'], 1, { ol: 'ink' }),
  steel: m(['ink', 'gray1', 'gray2', 'gray3', 'gray4', 'gray6'], 2, { ol: 'ink', spec: true }),
  gun: m(['ink', 'gray1', 'gray2', 'gray3', 'gray5'], 1, { ol: 'ink', spec: true }),
  chrome: m(['gray2', 'zinc1', 'zinc2', 'zinc3', 'zinc4', 'white'], 2, { ol: 'ink', spec: true }),
  dark: m(['ink', 'ink', 'gray1', 'gray2'], 1, { ol: 'ink', noEdge: true }),
  grille: m(['ink', 'ink', 'gray1', 'gray2'], 1, { ol: 'ink', noEdge: true, noContour: true }),
  // --- Glass ---
  glass: m(['navy0', 'navy1', 'zinc1', 'zinc2', 'zinc3', 'sky'], 2, { ol: 'ink', noEdge: true }),
  glassHi: m(['zinc3', 'sky', 'white'], 1, { ol: 'ink', flat: true }),
  glassBroken: m(['ink', 'ink', 'gray1', 'gray2'], 1, { ol: 'ink', noEdge: true }),
  // --- Lamps (unshaded) ---
  lampW: m(['white'], 0, { flat: true }),
  lampY: m(['ochre4'], 0, { flat: true }),
  lampAmber: m(['ochre2'], 0, { flat: true }),
  lampR: m(['crim2'], 0, { flat: true }),
  lampRdk: m(['rust1'], 0, { flat: true }),
  lampB: m(['blue2'], 0, { flat: true }),
  lampBhi: m(['sky'], 0, { flat: true }),
  lampBoff: m(['navy2'], 0, { flat: true }),
  inkFlat: m(['ink'], 0, { flat: true }),
  wire: m(['ink', 'gray1', 'gray2', 'gray3'], 1, { ol: 'ink', noOutline: true, noEdge: true, noContour: true }),
  // --- People ---
  skin: m(['earth2', 'earth3', 'earth4', 'earth5', 'earth6'], 2, { ol: 'earth1' }),
  skinDk: m(['earth0', 'earth1', 'earth2', 'earth3', 'earth4'], 2, { ol: 'earth0' }),
  navyCloth: m(['ink', 'navy0', 'navy1', 'navy2', 'blue1'], 2, { ol: 'ink' }),
  helmetNavy: m(['ink', 'navy0', 'navy1', 'navy2', 'blue1', 'blue2'], 2, { ol: 'ink', spec: true }),
  helmetOlive: m(['green0', 'olive1', 'olive2', 'stone3', 'stone4'], 1, { ol: 'ink', spec: true }),
  hivis: m(['olive1', 'olive2', 'hivis1', 'hivis2'], 2, { ol: 'ink' }),
  visor: m(['ink', 'gray1', 'zinc1', 'zinc3'], 1, { ol: 'ink', noEdge: true }),
  // --- Paint colours (civil vehicles) ---
  white: m(['gray4', 'gray5', 'gray6', 'gray7', 'white', 'white'], 3, { ol: 'gray2' }),
  cream: m(['stone1', 'stone2', 'stone3', 'stone4', 'stone5', 'white'], 3, { ol: 'stone0' }),
  red: m(['rust0', 'crim1', 'rust2', 'crim2', 'rust3', 'rust4'], 2, { ol: 'rust0' }),
  redBus: m(['rust0', 'rust1', 'crim1', 'crim2', 'rust3', 'rust4'], 2, { ol: 'rust0' }),
  blue: m(['navy0', 'navy1', 'navy2', 'blue1', 'blue2', 'sky'], 3, { ol: 'navy0' }),
  navy: m(['ink', 'navy0', 'navy1', 'navy2', 'blue1', 'blue2'], 2, { ol: 'ink', spec: true }),
  navyDk: m(['ink', 'ink', 'navy0', 'navy1', 'navy2'], 2, { ol: 'ink' }),
  green: m(['green0', 'green1', 'green2', 'green3', 'green4', 'lime'], 2, { ol: 'green0' }),
  teal: m(['green0', 'zinc0', 'teal1', 'teal2', 'sky'], 2, { ol: 'green0' }),
  yellow: m(['earth3', 'ochre1', 'ochre2', 'ochre3', 'ochre4'], 2, { ol: 'earth1' }),
  hivisPaint: m(['olive2', 'hivis1', 'hivis2', 'ochre4'], 1, { ol: 'olive1' }),
  black: m(['ink', 'ink', 'gray1', 'gray2', 'gray3', 'gray5'], 2, { ol: 'ink', spec: true }),
  silver: m(['gray3', 'gray4', 'gray5', 'gray6', 'gray7', 'white'], 2, { ol: 'gray2' }),
  plum: m(['plum0', 'plum1', 'purple', 'lilac', 'pink3'], 1, { ol: 'plum0' }),
  orange: m(['rust1', 'rust2', 'rust3', 'rust4', 'ochre3'], 1, { ol: 'rust0' }),
  mint: m(['green1', 'teal1', 'teal2', 'sky', 'white'], 1, { ol: 'green0' }),
  beige: m(['stone0', 'stone1', 'stone2', 'stone3', 'stone4', 'stone5'], 3, { ol: 'stone0' }),
  gray: m(['gray2', 'gray3', 'gray4', 'gray5', 'gray6'], 2, { ol: 'ink' }),
  redDk: m(['rust0', 'rust0', 'rust1', 'crim1', 'rust2'], 2, { ol: 'rust0' }),
  mintDk: m(['green1', 'green1', 'teal1', 'teal2', 'sky'], 1, { ol: 'green0' }),
  canvasGrey: m(['ink', 'gray1', 'gray2', 'gray3', 'gray4'], 2, { ol: 'ink' }),
  cardboard: m(['earth1', 'earth2', 'earth3', 'earth4', 'earth5'], 2, { ol: 'earth0' }),
  denim: m(['navy0', 'navy1', 'navy2', 'blue1', 'blue2'], 2, { ol: 'ink' }),
  helmetRed: m(['rust0', 'crim1', 'crim2', 'rust3', 'rust4', 'white'], 2, { ol: 'rust0', spec: true }),
  glassGrille: m(['ink', 'navy0', 'zinc0', 'zinc1'], 2, { ol: 'ink', noEdge: true }),
  lampGreen: m(['lime'], 0, { flat: true }),
  lampGreenDk: m(['green3'], 0, { flat: true }),
  // --- Damage ---
  char: m(['ink', 'ink', 'gray1', 'gray2', 'gray3'], 2, { ol: 'ink' }),
  charRust: m(['ink', 'rust0', 'earth1', 'earth2', 'earth3'], 2, { ol: 'ink' }),
  soot: m(['ink', 'gray1', 'gray2', 'gray3'], 1, { ol: 'ink' }),
  ember: m(['rust3'], 0, { flat: true }),
  emberHi: m(['ochre3'], 0, { flat: true }),
  scrape: m(['gray3', 'gray4', 'gray5', 'gray6', 'gray7'], 2, { ol: 'ink' }),
  dentDk: m(['ink', 'green0', 'green1', 'olive1'], 1, { ol: 'ink' }),
};

/** Map every non-lamp material to its burnt equivalent (for wrecks). */
export function burntKey(key: string): string {
  if (['char', 'soot', 'charRust', 'glassBroken', 'inkFlat', 'dark', 'grille', 'ember', 'emberHi'].includes(key)) return key;
  if (key.startsWith('lamp') || key === 'inkFlat') return 'soot';
  if (key.startsWith('glass')) return 'glassBroken';
  if (key === 'tyre' || key === 'rubber' || key === 'tread') return 'soot';
  if (key === 'steel' || key === 'gun' || key === 'chrome') return 'char';
  if (key.startsWith('skin') || key.endsWith('Cloth') || key.startsWith('helmet')) return 'char';
  if (key === 'sandbag' || key === 'sandbagDk' || key === 'mud') return 'charRust';
  return 'char';
}
