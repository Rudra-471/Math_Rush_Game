import { describe, expect, it } from 'vitest';
import { GENERATORS, generate, factsForSkill } from '../generators';
import { SKILLS, SKILL_MAP } from '../skills';
import { createRng } from '../rng';
import { answerKey, answersEqual, isFraction, fracValue, formatAnswer, promptToSpeech, countTokens } from '../format';
import type { Question } from '../types';

const SEEDS = 120; // × 10 levels × 44 skills ≈ 53k questions

function check(q: Question, skillId: string) {
  expect(q.skillId).toBe(skillId);
  expect(q.choices).toHaveLength(3);
  const keys = q.choices.map(answerKey);
  expect(new Set(keys).size).toBe(3);
  const correct = q.choices.filter((c) => answersEqual(c, q.answer));
  expect(correct).toHaveLength(1);
  expect(answersEqual(q.choices[q.answerIndex], q.answer)).toBe(true);
  expect(q.prompt.length).toBeGreaterThan(0);
  expect(q.speech.length).toBeGreaterThan(0);
  for (const c of q.choices) {
    if (typeof c === 'number') expect(Number.isFinite(c)).toBe(true);
    if (isFraction(c)) expect(c.d).toBeGreaterThan(0);
    expect(formatAnswer(c)).not.toMatch(/NaN|undefined|Infinity/);
  }
  expect(q.prompt).not.toMatch(/NaN|undefined|Infinity/);
}

describe('generators', () => {
  it('every skill has a generator', () => {
    for (const s of SKILLS) expect(GENERATORS[s.id], s.id).toBeTypeOf('function');
  });

  for (const s of SKILLS) {
    it(`${s.id}: exactly one correct, unique choices, valid ranges`, () => {
      for (let level = 1; level <= 10; level++) {
        for (let seed = 0; seed < SEEDS; seed++) {
          const q = generate(s.id, level, createRng(`${s.id}:${level}:${seed}`));
          check(q, s.id);
          const young = SKILL_MAP[s.id].band === 'beginner' || SKILL_MAP[s.id].band === 'intermediate';
          if (young) {
            for (const c of q.choices) {
              if (typeof c === 'number') expect(c, `${q.prompt} → ${c}`).toBeGreaterThanOrEqual(0);
              if (isFraction(c)) expect(fracValue(c)).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  }

  it('Leitner facts reproduce the requested fact', () => {
    for (const id of ['add.1d', 'mul.table.6-9', 'div.facts']) {
      for (const fact of factsForSkill(id)) {
        const q = generate(id, 5, createRng(fact), { fact });
        expect(q.factKey).toBe(fact);
        check(q, id);
      }
    }
  });

  it('same seed → same question (reproducible)', () => {
    const a = generate('add.2d.carry', 5, createRng(42));
    const b = generate('add.2d.carry', 5, createRng(42));
    expect(a.prompt).toBe(b.prompt);
    expect(a.choices).toEqual(b.choices);
  });

  it('level controls number ranges (mul.table.6-9)', () => {
    let maxL1 = 0;
    let maxL10 = 0;
    for (let i = 0; i < 300; i++) {
      const q1 = generate('mul.table.6-9', 1, createRng(i));
      const q10 = generate('mul.table.6-9', 10, createRng(i));
      if (q1.kind === 'choice3') maxL1 = Math.max(maxL1, q1.answer as number);
      if (q10.kind === 'choice3') maxL10 = Math.max(maxL10, q10.answer as number);
    }
    expect(maxL1).toBeLessThanOrEqual(45);
    expect(maxL10).toBeGreaterThan(80);
  });
});

describe('format', () => {
  it('speech reads operators', () => {
    expect(promptToSpeech('7 × 8 = ?')).toBe('seven times eight equals what?');
    expect(promptToSpeech('12 − 5 = ?')).toBe('twelve minus five equals what?');
  });
  it('counts tokens', () => {
    expect(countTokens('7 × 8 = ?')).toBe(5);
  });
  it('fractions compare by value', () => {
    expect(answersEqual({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(true);
  });
});
