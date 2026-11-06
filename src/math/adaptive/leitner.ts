/** Leitner spaced repetition (SPEC 7.8): 5 boxes; intervals: same run, 1d, 3d, 7d, 21d. */
const DAY = 86_400_000;
export const BOX_INTERVALS = [0, DAY, 3 * DAY, 7 * DAY, 21 * DAY];

export interface LeitnerBox {
  box: number; // 1..5
  dueAt: number;
}

export const createBox = (now: number): LeitnerBox => ({ box: 1, dueAt: now });

export function promote(b: LeitnerBox, now: number): LeitnerBox {
  const box = Math.min(5, b.box + 1);
  return { box, dueAt: now + BOX_INTERVALS[box - 1] };
}

/** Correct but slow: stay in the same box, reschedule. */
export function keep(b: LeitnerBox, now: number): LeitnerBox {
  return { box: b.box, dueAt: now + Math.max(BOX_INTERVALS[b.box - 1], 60_000) };
}

export const reset = (now: number): LeitnerBox => ({ box: 1, dueAt: now });

/** Facts already seen whose review time has come, lowest box first. */
export function dueFacts(facts: Record<string, LeitnerBox>, now: number): string[] {
  return Object.entries(facts)
    .filter(([, b]) => b.dueAt <= now)
    .sort((a, b) => a[1].box - b[1].box || a[1].dueAt - b[1].dueAt)
    .map(([k]) => k);
}
