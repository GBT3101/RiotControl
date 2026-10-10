/**
 * Prop builders shared by the Central cities (E3 Central: Budapest, Vienna, Prague), handed the
 * PropKit of props.ts: moored river boats, street-food / souvenir stands, advertising columns,
 * stone fountains. Each city passes its own colours.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import type { PropKit, PropSprite } from '../props';
import type { IsoCanvas } from '../raster';

const sh = (c: RGBA, n: number): RGBA => (n < 0 ? darker(c, -n) : n > 0 ? lighter(c, n) : c);

export interface BoatColours {
  hull: string;
  band: string;
  cabin: string;
  roof: string;
  /** Three flag stripes (top → bottom) at the stern. */
  flag: readonly [string, string, string];
}

/**
 * River sightseeing boat moored along the water (`axis` = the water's direction). Drawn at the
 * water level (7 px under the tile's ground), offset to the far bank side of the tile.
 */
export function boat(k: PropKit, axis: 'i' | 'j', c: BoatColours): PropSprite {
  return k.isoProp(
    14,
    (cv) => {
      // Work in (a along the boat, b across) and map to (u, v).
      const P = (a: number, b: number, z: number): { u: number; v: number; z: number } =>
        axis === 'i' ? { u: a, v: b, z } : { u: b, v: a, z };
      const box = (
        a0: number,
        b0: number,
        a1: number,
        b1: number,
        z0: number,
        z1: number,
        t: {
          top: (a: number, z: number) => RGBA;
          along: (a: number, z: number) => RGBA;
          end: (z: number) => RGBA;
        },
      ): void => {
        const p0 = P(a0, b0, 0);
        const p1 = P(a1, b1, 0);
        const u0 = Math.min(p0.u, p1.u);
        const u1 = Math.max(p0.u, p1.u);
        const v0 = Math.min(p0.v, p1.v);
        const v1 = Math.max(p0.v, p1.v);
        boxUV(cv, u0, v0, z0, u1, v1, z1, {
          top: (u, v) => t.top(axis === 'i' ? u : v, z1),
          left: (u, _v, z) => (axis === 'i' ? t.along(u, z) : sh(t.end(z), 0)),
          right: (_u, v, z) => (axis === 'i' ? sh(t.end(z), -1) : sh(t.along(v, z), -1)),
        });
      };
      const hull = C(c.hull);
      const band = C(c.band);
      const cabin = C(c.cabin);
      const roof = C(c.roof);
      const A0 = -0.55;
      const A1 = 0.95;
      const B0 = 0.04;
      const B1 = 0.3;
      // Hull with a painted band and a dark waterline.
      box(A0, B0, A1, B1, -8, -3, {
        top: () => C('earth3'),
        along: (_a, z) => (z < -6.5 ? C('gray1') : z > -5 && z < -3.8 ? band : hull),
        end: (z) => (z < -6.5 ? C('gray1') : z > -5 && z < -3.8 ? band : hull),
      });
      // Bow wedge.
      const bow = [P(A1, B0, -3), P(A1 + 0.14, (B0 + B1) / 2, -3), P(A1, B1, -3)];
      cv.poly(bow, () => C('earth3'));
      cv.poly(
        [
          P(A1, B1, -3),
          P(A1 + 0.14, (B0 + B1) / 2, -3),
          P(A1 + 0.12, (B0 + B1) / 2, -8),
          P(A1, B1, -8),
        ],
        (_u, _v, z) => (z < -6.5 ? C('gray1') : hull),
      );
      // Glazed saloon and its sun deck.
      box(A0 + 0.18, B0 + 0.04, A1 - 0.1, B1 - 0.04, -3, 2, {
        top: () => roof,
        along: (a, z) => {
          const x = Math.floor((a - A0) * 32);
          if (z > 1) return roof;
          return x % 5 === 0 ? cabin : z > -0.5 ? C('zinc3') : C('navy1');
        },
        end: (z) => (z > 1 ? roof : C('navy1')),
      });
      box(A0 + 0.22, B0 + 0.06, A1 - 0.16, B1 - 0.06, 2, 3, {
        top: (a) => (Math.floor(a * 16) % 3 === 0 ? sh(roof, -1) : roof),
        along: () => sh(roof, -1),
        end: () => sh(roof, -1),
      });
      // Wheelhouse and stern flag.
      box(A1 - 0.32, B0 + 0.08, A1 - 0.12, B1 - 0.08, 3, 6, {
        top: () => roof,
        along: (_a, z) => (z > 4 ? C('navy1') : cabin),
        end: () => cabin,
      });
      const stern = P(A0 + 0.06, (B0 + B1) / 2, -3);
      cv.pole(stern, 9, C('gray2'));
      for (let z = 3; z < 6; z++) {
        const col = C(c.flag[5 - z]!);
        for (let k2 = 1; k2 <= 4; k2++) {
          const p = P(A0 + 0.06 - k2 * 0.03 * (axis === 'i' ? 1 : 1), (B0 + B1) / 2, -3 + z + 3);
          cv.dot(p, col, 1);
        }
      }
    },
    { shadow: 0 },
  );
}

function boxUV(
  cv: IsoCanvas,
  u0: number,
  v0: number,
  z0: number,
  u1: number,
  v1: number,
  z1: number,
  t: {
    top: (u: number, v: number) => RGBA;
    left: (u: number, v: number, z: number) => RGBA;
    right: (u: number, v: number, z: number) => RGBA;
  },
): void {
  cv.box(u0, v0, z0, u1, v1, z1, { top: t.top, left: t.left, right: t.right });
}

export interface StandColours {
  body: string;
  trim: string;
  awning: readonly [string, string];
  /** Goods on the counter (souvenirs, sausages, papers …). */
  goods: readonly string[];
  sign: string;
  signText: string;
}

/** Street stand: box with a serving hatch, striped awning, goods on the counter, roof sign. */
export function stand(k: PropKit, c: StandColours): PropSprite {
  const body = C(c.body);
  const trim = C(c.trim);
  const aw = [C(c.awning[0]), C(c.awning[1])];
  return k.isoProp(
    24,
    (cv) => {
      cv.box(0.2, 0.25, 0, 0.8, 0.75, 13, {
        top: () => trim,
        left: (u, _v, z) => {
          const x = Math.floor((u - 0.2) * 16);
          const y = Math.floor(z);
          if (y === 12) return lighter(trim);
          if (y >= 6 && y <= 10 && x >= 1 && x <= 8) {
            if (y === 6) return C(c.goods[x % c.goods.length]!);
            return y === 10 ? C('navy1') : C('navy0');
          }
          if (y === 5 && x >= 0 && x <= 9) return trim;
          if (y < 1) return darker(body, 2);
          return x % 4 === 0 && y < 5 ? darker(body) : body;
        },
        right: (_u, v, z) => {
          const y = Math.floor(z);
          const x = Math.floor((0.75 - v) * 16);
          if (y === 12) return trim;
          if (y >= 3 && y <= 9 && x >= 2 && x <= 5) return darker(C('navy1'));
          return darker(body);
        },
      });
      // Awning over the hatch (+v side), sloping out and down.
      cv.poly(
        [
          { u: 0.16, v: 0.75, z: 13 },
          { u: 0.84, v: 0.75, z: 13 },
          { u: 0.84, v: 0.9, z: 11 },
          { u: 0.16, v: 0.9, z: 11 },
        ],
        (u) => aw[Math.floor(((u - 0.16) * 16) / 2) % 2]!,
      );
      // Sign board on the roof.
      const sc = C(c.sign);
      const st = C(c.signText);
      cv.box(0.26, 0.48, 13, 0.74, 0.54, 18, {
        top: () => lighter(sc),
        left: (u, _v, z) => {
          const x = Math.floor((u - 0.26) * 32);
          const y = Math.floor(z);
          if (y === 13 || y === 17) return darker(sc);
          return (y === 15 || y === 14) && x > 1 && x < 14 && x % 3 !== 0 ? st : sc;
        },
        right: () => darker(sc),
      });
    },
    { shadow: 0 },
  );
}

/** Round stone fountain basin with a bowl and a water jet. */
export function fountain(k: PropKit, c: { stone: string; water: string; jet: string }): PropSprite {
  const stone = C(c.stone);
  const water = C(c.water);
  return k.isoProp(
    22,
    (cv) => {
      const ring = (r: number, z0: number, z1: number, col: (s: number) => RGBA): void => {
        const N = 16;
        for (let q = 0; q < N; q++) {
          const a0 = (q / N) * Math.PI * 2;
          const a1 = ((q + 1) / N) * Math.PI * 2;
          const am = (a0 + a1) / 2;
          const s = 0.5 + 0.35 * Math.sin(am) - 0.4 * Math.cos(am);
          cv.poly(
            [
              { u: 0.5 + Math.cos(a0) * r, v: 0.5 + Math.sin(a0) * r, z: z1 },
              { u: 0.5 + Math.cos(a1) * r, v: 0.5 + Math.sin(a1) * r, z: z1 },
              { u: 0.5 + Math.cos(a1) * r, v: 0.5 + Math.sin(a1) * r, z: z0 },
              { u: 0.5 + Math.cos(a0) * r, v: 0.5 + Math.sin(a0) * r, z: z0 },
            ],
            () => col(s),
          );
        }
        const lid = [];
        for (let q = 0; q < 16; q++) {
          const a = (q / 16) * Math.PI * 2;
          lid.push({ u: 0.5 + Math.cos(a) * r, v: 0.5 + Math.sin(a) * r, z: z1 });
        }
        return void lid;
      };
      const disc = (r: number, z: number, col: (u: number, v: number) => RGBA): void => {
        const pts = [];
        for (let q = 0; q < 16; q++) {
          const a = (q / 16) * Math.PI * 2;
          pts.push({ u: 0.5 + Math.cos(a) * r, v: 0.5 + Math.sin(a) * r, z });
        }
        cv.poly(pts, col);
      };
      const stoneShade = (s: number): RGBA =>
        s > 0.66 ? lighter(stone) : s > 0.33 ? stone : darker(stone);
      ring(0.44, 0, 4, stoneShade);
      disc(0.44, 4, (u, v) => {
        const r = Math.hypot(u - 0.5, v - 0.5);
        if (r > 0.38) return lighter(stone);
        return Math.floor((u + v) * 12) % 3 === 0 ? lighter(water) : water;
      });
      ring(0.07, 4, 10, stoneShade);
      ring(0.2, 10, 12, stoneShade);
      disc(0.2, 12, (u, v) => (Math.hypot(u - 0.5, v - 0.5) > 0.15 ? lighter(stone) : water));
      // Jet and falling water.
      const jet = C(c.jet);
      cv.pole({ u: 0.5, v: 0.5, z: 12 }, 7, C('white'), 2);
      for (const [du, dv] of [
        [-0.2, 0.0],
        [0.0, 0.2],
        [0.2, 0.0],
        [0.0, -0.2],
      ] as const)
        for (let z = 5; z < 11; z += 2)
          cv.dot({ u: 0.5 + du * 1.05, v: 0.5 + dv * 1.05, z }, jet, 2);
    },
    { shadow: 0 },
  );
}
