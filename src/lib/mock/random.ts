/**
 * PRNG determinista (mulberry32). Se usa para generar todo el dataset mock
 * de forma reproducible: mismos resultados en servidor y cliente (evita
 * mismatches de hidratación) y entre recargas.
 */
export function createRng(seed: number) {
  let state = seed >>> 0;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type Rng = ReturnType<typeof createRng>;

export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randomBetween(rng, min, max + 1));
}

/** Distribuye `total` en `count` partes aleatorias que suman exactamente `total`. */
export function splitRandomly(rng: Rng, total: number, count: number, minShare = 0.05): number[] {
  if (count === 1) return [total];
  const weights = Array.from({ length: count }, () => minShare + rng());
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / weightSum) * total);
}
