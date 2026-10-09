/** Small helpers for writing pose tables. */

/** `n` poses produced by `fn(i)`. */
export function cycle(n: number, fn: (i: number) => string): string[] {
  return Array.from({ length: n }, (_, i) => fn(i));
}
