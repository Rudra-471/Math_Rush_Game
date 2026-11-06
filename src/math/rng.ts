import type { Rng } from './types';

/** mulberry32 — small, fast, seedable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number | string): Rng {
  const f = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
  return {
    next: f,
    int: (min, max) => min + Math.floor(f() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
  };
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let idCounter = 0;
export function makeId(rng: Rng): string {
  idCounter = (idCounter + 1) % 1e9;
  return `${Math.floor(rng.next() * 1e9).toString(36)}-${idCounter.toString(36)}`;
}
