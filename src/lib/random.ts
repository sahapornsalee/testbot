/** Unbiased, cryptographically secure random helpers. */

function randomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] as number;
}

/** Integer in [0, max). Uses rejection sampling to avoid modulo bias. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new RangeError("max must be an integer in 1..2^32");
  const limit = 2 ** 32 - (2 ** 32 % max);
  let value = randomUint32();
  while (value >= limit) value = randomUint32();
  return value % max;
}

/** Integer in [min, max] inclusive. */
export function randomBetween(min: number, max: number): number {
  return min + randomInt(max - min + 1);
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
