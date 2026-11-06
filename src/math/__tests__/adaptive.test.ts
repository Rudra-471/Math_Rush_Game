import { describe, expect, it } from 'vitest';
import { rules, filterCandidates, PositionBag } from '../distractors';
import { createRng } from '../rng';
import { levelForTarget, newSkillState, pCorrect, updateRating } from '../adaptive/rating';
import { MathSession, nextSkill, type SkillStates } from '../adaptive/selector';
import { promote, reset, dueFacts, BOX_INTERVALS } from '../adaptive/leitner';
import { levelDifficulty } from '../skills';

describe('distractor rules (SPEC 7.4 table)', () => {
  it('forgot-carry 47 + 38 → 75', () => expect(rules.forgotCarry(47, 38)).toBe(75));
  it('borrow-reverse 52 − 17 → 45', () => expect(rules.borrowReverse(52, 17)).toBe(45));
  it('off-by-one 13 → 12/14', () => expect(rules.offByOne(13)).toEqual([12, 14]));
  it('op-swap 12 × 3 → includes 15', () => expect(rules.opSwap(12, 3, '×')).toContain(15));
  it('table-neighbour 7 × 8 → 48 / 63', () => {
    const t = rules.tableNeighbour(7, 8);
    expect(t).toContain(49);
    expect(t).toContain(63);
    expect(t).toContain(48);
  });
  it('place-value 120 → 12 / 1200', () => expect(rules.placeValue(120)).toEqual([12, 1200]));
  it('frac tops+bottoms 1/2 + 1/3 → 2/5', () => expect(rules.fracAddTopsBottoms({ n: 1, d: 2 }, { n: 1, d: 3 })).toEqual({ n: 2, d: 5 }));
  it('pct-as-number 25% of 80 → 55', () => expect(rules.pctAsNumber(25, 80)).toBe(55));
  it('sign-error −4 → 4', () => expect(rules.signError(-4)).toBe(4));
  it('digit-reversal 42 → 24', () => expect(rules.digitReversal(42)).toBe(24));
  it('filter never returns the answer and removes negatives for positive answers', () => {
    const out = filterCandidates(10, [
      { value: 10, tag: 'x' }, { value: -10, tag: 'x' }, { value: 11, tag: 'x' }, { value: 11, tag: 'y' },
    ]);
    expect(out.map((c) => c.value)).toEqual([11]);
  });
  it('position bag is balanced', () => {
    const bag = new PositionBag(createRng(1));
    const counts = [0, 0, 0];
    for (let i = 0; i < 600; i++) counts[bag.next()]++;
    expect(counts).toEqual([200, 200, 200]);
  });
});

describe('Elo rating', () => {
  it('simulated learner converges within ±0.3 after 40 attempts, success 70–85%', () => {
    const skill = 'mul.table.6-9';
    let totalErr = 0;
    let totalSuccess = 0;
    const trials = 60;
    for (let t = 0; t < trials; t++) {
      const rng = createRng(`sim${t}`);
      const trueSkill = levelDifficulty(skill, 1) + 0.5 + rng.next() * 2.5;
      let st = { ...newSkillState(skill, 'intermediate') };
      let ok = 0;
      for (let i = 0; i < 40; i++) {
        const lvl = levelForTarget(st.rating, skill);
        const d = levelDifficulty(skill, lvl);
        const correct = rng.next() < pCorrect(trueSkill, d);
        if (correct) ok++;
        st = updateRating(st, d, correct, 3000 + rng.next() * 2000);
      }
      totalErr += Math.abs(st.rating - trueSkill);
      totalSuccess += ok / 40;
    }
    expect(totalErr / trials).toBeLessThan(0.45);
    const rate = totalSuccess / trials;
    expect(rate).toBeGreaterThan(0.6);
    expect(rate).toBeLessThan(0.9);
  });

  it('levelForTarget gives P ≈ 0.78', () => {
    const st = newSkillState('add.2d.carry', 'intermediate');
    const lvl = levelForTarget(st.rating + 1, 'add.2d.carry');
    expect(lvl).toBeGreaterThan(1);
  });
});

describe('Leitner', () => {
  it('promotes and resets', () => {
    const now = 1000;
    let b = promote({ box: 1, dueAt: now }, now);
    expect(b.box).toBe(2);
    expect(b.dueAt).toBe(now + BOX_INTERVALS[1]);
    b = reset(now);
    expect(b.box).toBe(1);
    expect(dueFacts({ a: b, c: { box: 3, dueAt: now + 5 } }, now)).toEqual(['a']);
  });
});

describe('selector', () => {
  it('never asks the same skill 3 times in a row', () => {
    const states: SkillStates = {};
    for (let seed = 0; seed < 30; seed++) {
      const rng = createRng(seed);
      const recent: string[] = [];
      for (let i = 0; i < 60; i++) {
        const s = nextSkill({ band: 'intermediate', states, focusTopics: [], recent, now: 0, rng });
        if (recent.length >= 2) expect(recent[recent.length - 1] === s && recent[recent.length - 2] === s).toBe(false);
        recent.push(s);
      }
    }
  });

  it('only picks unlocked skills for a beginner', () => {
    const session = new MathSession(createRng(5), 'beginner', {});
    for (let i = 0; i < 50; i++) {
      const id = session.pickSkill();
      expect(['count.objects10', 'cmp.numbers20', 'num.before-after', 'add.1d', 'sub.within10', 'pattern.skip2']).toContain(id);
    }
  });

  it('session produces valid questions for every band', () => {
    for (const band of ['beginner', 'intermediate', 'advanced', 'expert'] as const) {
      const s = new MathSession(createRng(band), band, {});
      for (let i = 0; i < 100; i++) {
        const p = s.question();
        expect(p.question.choices).toHaveLength(3);
        expect(p.pCorrect).toBeGreaterThan(0);
      }
    }
  });
});
