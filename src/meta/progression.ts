import { XP, SCORE } from '@/config/tuning';

/** SPEC 10.1: xpForLevel(n) = 200 × n^1.4 (XP needed to go from level n to n+1). */
export const xpForLevel = (n: number) => Math.round(XP.levelBase * n ** XP.levelExp);

export function levelFromXp(xp: number): { level: number; into: number; need: number; frac: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  const need = xpForLevel(level);
  return { level, into: rest, need, frac: rest / need };
}

export function runXp(correct: number, distance: number, missions: number): number {
  return correct * XP.perCorrect + Math.floor(distance / 10) * XP.perTenMeters + missions * XP.perMission;
}

/** Subway-style score multiplier from lifetime missions. */
export function scoreMultiplier(missionsLifetime: number): number {
  return Math.min(SCORE.scoreMultCap, 1 + SCORE.scoreMultPerMission * missionsLifetime);
}

/** Level-up rewards: coins every level, a Revive Key every 5 levels. */
export function levelReward(level: number): { coins: number; reviveKey: boolean } {
  return { coins: 100 + level * 20, reviveKey: level % 5 === 0 };
}
