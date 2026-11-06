import type { Band } from '../types';
import { bandIndex, getSkill, levelDifficulty, LEVEL_STEP } from '../skills';
import { createBox, keep, promote, reset, type LeitnerBox } from './leitner';

export interface SkillState {
  skillId: string;
  rating: number;
  attempts: number;
  correct: number;
  recentMs: number[]; // last ~15 response times
  facts: Record<string, LeitnerBox>;
  lastAt: number;
}

export const TARGET_P = 0.78;

export const pCorrect = (r: number, d: number): number => 1 / (1 + Math.exp(-(r - d)));

export function median(xs: number[]): number {
  if (xs.length === 0) return Infinity;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Elo-style update (SPEC 7.7). Returns a new state object. */
export function updateRating(st: SkillState, difficulty: number, correct: boolean, responseMs: number, now = Date.now()): SkillState {
  const med = st.recentMs.length >= 3 ? median(st.recentMs) : 4000;
  const fast = responseMs < med;
  const outcome = correct ? (fast ? 1 : 0.85) : 0;
  const K = st.attempts < 10 ? 0.4 : 0.15;
  const P = pCorrect(st.rating, difficulty);
  return {
    ...st,
    rating: st.rating + K * (outcome - P),
    attempts: st.attempts + 1,
    correct: st.correct + (correct ? 1 : 0),
    recentMs: [...st.recentMs, responseMs].slice(-15),
    lastAt: now,
  };
}

/** Level whose difficulty gives P(correct) ≈ target. */
export function levelForTarget(rating: number, skillId: string, target = TARGET_P): number {
  const d = rating - Math.log(target / (1 - target));
  const lvl = 1 + (d - getSkill(skillId).base) / LEVEL_STEP;
  return Math.min(10, Math.max(1, Math.round(lvl)));
}

/** 0..1 mastery shown to parents: sigmoid(r − d_level10). */
export function mastery(st: SkillState | undefined, skillId: string): number {
  if (!st) return 0;
  return pCorrect(st.rating, levelDifficulty(skillId, 10));
}

/** Starting rating from the age band chosen at setup (only a starting point). */
export function initialRating(skillId: string, band: Band): number {
  const sk = getSkill(skillId);
  const diff = bandIndex(band) - bandIndex(sk.band);
  const logit = Math.log(TARGET_P / (1 - TARGET_P));
  if (diff > 0) return levelDifficulty(skillId, 10) + 1.0; // below the child's band: mostly mastered
  if (diff === 0) return sk.base + logit + LEVEL_STEP; // start around level 2
  return sk.base + logit - LEVEL_STEP * diff * 2; // above band: starts at level 1
}

export function newSkillState(skillId: string, band: Band): SkillState {
  return { skillId, rating: initialRating(skillId, band), attempts: 0, correct: 0, recentMs: [], facts: {}, lastAt: 0 };
}

export function recordFact(st: SkillState, factKey: string | undefined, correct: boolean, fast: boolean, now: number): SkillState {
  if (!factKey) return st;
  const box = st.facts[factKey] ?? createBox(now);
  const next = correct ? (fast ? promote(box, now) : keep(box, now)) : reset(now);
  return { ...st, facts: { ...st.facts, [factKey]: next } };
}
