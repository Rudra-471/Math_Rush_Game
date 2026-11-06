import type { Answer, GateKind, Hint, Question, Rng } from './types';
import { type Candidate, fallbackCandidates, filterCandidates } from './distractors';
import { promptToSpeech } from './format';
import { makeId, shuffle } from './rng';
import { levelDifficulty } from './skills';

export interface BuildInput {
  skillId: string;
  level: number;
  kind?: GateKind;
  prompt: string;
  speech?: string;
  answer: Answer;
  candidates: Candidate[];
  hint: Hint;
  factKey?: string;
  allowNegative?: boolean;
  /** Fixed choice set (e.g. ['<','=','>']) — kept in this order, no shuffling. */
  fixedChoices?: Answer[];
}

/** Assemble a Question with exactly 3 unique choices and exactly one correct answer. */
export function buildQuestion(input: BuildInput, rng: Rng): Question {
  const { skillId, level, prompt, answer, hint } = input;
  const kind = input.kind ?? 'choice3';
  const id = makeId(rng);
  const difficulty = levelDifficulty(skillId, level);
  const speech = input.speech ?? promptToSpeech(prompt);

  if (input.fixedChoices) {
    const choices = input.fixedChoices;
    const idx = choices.findIndex((c) => c === answer);
    return {
      id, skillId, level, kind, prompt, speech, answer, choices,
      answerIndex: idx,
      distractorTags: choices.map((c) => (c === answer ? '' : input.candidates[0]?.tag ?? 'near-miss')),
      explanation: hint, difficulty, factKey: input.factKey,
    };
  }

  // Prefer diagnostic (misconception) candidates; shuffle within that set for variety.
  const diag = filterCandidates(answer, shuffle([...input.candidates], rng), input.allowNegative);
  let picked = diag.slice(0, 2);
  if (picked.length < 2) {
    const extra = filterCandidates(
      answer,
      [...picked, ...fallbackCandidates(answer, rng)],
      input.allowNegative,
    );
    picked = extra.slice(0, 2);
  }
  if (picked.length < 2) throw new Error(`Could not build distractors for ${skillId} ${prompt}`);

  const answerIndex = rng.int(0, 2);
  const choices: Answer[] = [];
  const tags: string[] = [];
  let w = 0;
  for (let i = 0; i < 3; i++) {
    if (i === answerIndex) {
      choices.push(answer);
      tags.push('');
    } else {
      choices.push(picked[w].value);
      tags.push(picked[w].tag);
      w++;
    }
  }
  return {
    id, skillId, level, kind, prompt, speech, answer, choices, answerIndex,
    distractorTags: tags, explanation: hint, difficulty, factKey: input.factKey,
  };
}

/** Move the correct answer to a given index (used by the position bag for balance). */
export function placeAnswerAt(q: Question, index: number): Question {
  if (q.kind === 'compare' || q.kind === 'numberLine' || q.kind === 'estimate') return q;
  if (index === q.answerIndex) return q;
  const choices = [...q.choices];
  const tags = [...q.distractorTags];
  [choices[index], choices[q.answerIndex]] = [choices[q.answerIndex], choices[index]];
  [tags[index], tags[q.answerIndex]] = [tags[q.answerIndex], tags[index]];
  return { ...q, choices, distractorTags: tags, answerIndex: index };
}

/** Linear level scaling helper: lerp between lo and hi across levels 1..10. */
export function scale(level: number, lo: number, hi: number): number {
  return Math.round(lo + ((hi - lo) * (Math.min(10, Math.max(1, level)) - 1)) / 9);
}
