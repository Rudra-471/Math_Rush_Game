// Pure maths types — no three.js / React / DOM imports anywhere under src/math.

export type GateKind = 'choice3' | 'compare' | 'numberLine' | 'estimate' | 'missing';

export interface Fraction {
  n: number;
  d: number;
}

/** number | fraction | string (e.g. '<', '3:4', 'x = 4'). */
export type Answer = number | Fraction | string;

export type Band = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type Hint =
  | { type: 'numberLine'; start: number; jumps: number[]; text: string }
  | { type: 'dotArray'; rows: number; cols: number; text: string }
  | { type: 'groups'; total: number; groups: number; text: string }
  | { type: 'fractionBars'; fractions: Fraction[]; text: string }
  | { type: 'percentGrid'; percent: number; text: string }
  | { type: 'balance'; steps: string[]; text: string }
  | { type: 'text'; text: string };

export interface Question {
  id: string;
  skillId: string;
  level: number; // 1..10 inside the skill
  kind: GateKind;
  prompt: string; // '7 × 8 = ?'
  speech: string; // 'seven times eight'
  answer: Answer;
  choices: Answer[]; // exactly 3, includes answer exactly once
  answerIndex: number;
  distractorTags: string[]; // tag per choice ('' for the correct one)
  explanation: Hint;
  difficulty: number; // Elo-scale estimate
  factKey?: string; // Leitner fact id, e.g. '7x8'
}

export interface Attempt {
  profileId: string;
  questionId: string;
  skillId: string;
  level: number;
  correct: boolean;
  chosenTag?: string;
  responseMs: number;
  context: 'gate' | 'orb' | 'challenge' | 'boss';
  at: number;
}

export interface Rng {
  next(): number; // [0,1)
  int(min: number, max: number): number; // inclusive
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

export interface GenOptions {
  fact?: string;
}

export type Generator = (level: number, rng: Rng, opts?: GenOptions) => Question;
