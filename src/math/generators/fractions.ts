import type { Generator } from '../types';
import { buildQuestion, scale } from '../build';
import { rules, type Candidate } from '../distractors';
import { compareFrac, frac, fracValue, gcd, roundN, simplify } from '../format';
import { explainFractions, explainPercent } from '../explain';

const C = (value: number, tag: string): Candidate => ({ value, tag });

export const fracIdentify: Generator = (level, rng) => {
  const d = rng.int(2, scale(level, 4, 10));
  const n = rng.int(1, d - 1);
  const bar = '■'.repeat(n) + '□'.repeat(d - n);
  return buildQuestion(
    {
      skillId: 'frac.identify', level, prompt: `${bar}  shaded = ?`,
      speech: 'What fraction of the bar is shaded?',
      answer: frac(n, d),
      candidates: [
        { value: frac(d - n, d), tag: 'near-miss' },
        { value: frac(n, d - n), tag: 'near-miss' },
        { value: frac(n, d + 1), tag: 'miscount' },
        { value: frac(n + 1, d), tag: 'miscount' },
      ],
      hint: explainFractions([frac(n, d)], `${n} of the ${d} equal parts are shaded, so it is ${n}/${d}.`),
    },
    rng,
  );
};

export const fracCompare: Generator = (level, rng) => {
  let a, b;
  if (level <= 4 || rng.chance(0.4)) {
    const d = rng.int(3, scale(level, 6, 12));
    a = frac(rng.int(1, d - 1), d);
    b = frac(rng.int(1, d - 1), d);
  } else {
    const n = rng.int(1, 3);
    a = frac(n, rng.int(n + 1, 10));
    b = frac(n, rng.int(n + 1, 10));
  }
  const c = compareFrac(a, b);
  const answer = c < 0 ? '<' : c > 0 ? '>' : '=';
  const sameDen = a.d === b.d;
  return buildQuestion(
    {
      skillId: 'frac.compare.samedenom', level, kind: 'compare',
      prompt: `${a.n}/${a.d}  ?  ${b.n}/${b.d}`, answer, fixedChoices: ['<', '=', '>'],
      candidates: [{ value: '', tag: sameDen ? 'compare-flip' : 'bigger-denominator' }],
      hint: explainFractions([a, b], sameDen
        ? `Same-size pieces: more pieces is bigger, so ${a.n}/${a.d} ${answer} ${b.n}/${b.d}.`
        : `Same number of pieces, but smaller pieces when the bottom is bigger.`),
    },
    rng,
  );
};

export const fracEquiv: Generator = (level, rng) => {
  const d = rng.int(2, scale(level, 5, 9));
  const n = rng.int(1, d - 1);
  const k = rng.int(2, scale(level, 3, 6));
  const D = d * k;
  const ans = n * k;
  return buildQuestion(
    {
      skillId: 'frac.equiv', level, kind: 'missing', prompt: `${n}/${d} = ?/${D}`, answer: ans,
      candidates: [C(n + (D - d), 'near-miss'), C(ans + 1, 'off-by-one'), C(ans - 1, 'off-by-one'), C(n * d, 'op-swap')],
      hint: explainFractions([frac(n, d), frac(ans, D)], `The bottom was multiplied by ${k}, so multiply the top by ${k} too: ${ans}.`),
    },
    rng,
  );
};

export const fracAddSame: Generator = (level, rng) => {
  const d = rng.int(3, scale(level, 6, 12));
  const a = rng.int(1, d - 2);
  const b = rng.int(1, d - 1 - a);
  const ans = frac(a + b, d);
  return buildQuestion(
    {
      skillId: 'frac.add.samedenom', level, prompt: `${a}/${d} + ${b}/${d} = ?`, answer: ans,
      candidates: [
        { value: rules.fracAddTopsBottoms(frac(a, d), frac(b, d)), tag: 'frac-add-tops-bottoms' },
        { value: frac(a + b + 1, d), tag: 'off-by-one' },
        { value: frac(a * b, d), tag: 'op-swap' },
        { value: frac(a + b - 1, d), tag: 'off-by-one' },
      ],
      hint: explainFractions([frac(a, d), frac(b, d), ans], `Same bottom: add the tops only. ${a} + ${b} = ${a + b}, so ${a + b}/${d}.`),
    },
    rng,
  );
};

export const fracAddDiff: Generator = (level, rng) => {
  const dens = level <= 4 ? [2, 3, 4] : [2, 3, 4, 5, 6, 8];
  let d1 = rng.pick(dens), d2 = rng.pick(dens);
  while (d2 === d1) d2 = rng.pick(dens);
  if (d1 > d2) [d1, d2] = [d2, d1];
  const a = frac(rng.int(1, d1 - 1), d1);
  const b = frac(rng.int(1, d2 - 1), d2);
  const ans = simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
  return buildQuestion(
    {
      skillId: 'frac.add.diffdenom', level, prompt: `${a.n}/${a.d} + ${b.n}/${b.d} = ?`, answer: ans,
      candidates: [
        { value: rules.fracAddTopsBottoms(a, b), tag: 'frac-add-tops-bottoms' },
        { value: frac(a.n + b.n, a.d * b.d), tag: 'frac-add-tops-bottoms' },
        { value: frac(ans.n + 1, ans.d), tag: 'near-miss' },
      ],
      hint: explainFractions([a, b, ans], `Make the bottoms the same first (${a.d * b.d / gcd(a.d, b.d)}), then add the tops.`),
    },
    rng,
  );
};

export const decAdd: Generator = (level, rng) => {
  const dp = level >= 7 ? 2 : 1;
  const p = 10 ** dp;
  let A = 0, B = 0;
  for (let i = 0; i < 30; i++) {
    A = rng.int(p + 1, scale(level, 5, 20) * p);
    B = rng.int(p + 1, scale(level, 5, 20) * p);
    if (A % 10 && B % 10 && (A % 10) + (B % 10) >= 10) break;
  }
  const a = A / p, b = B / p;
  const ans = roundN(a + b, 4);
  return buildQuestion(
    {
      skillId: 'dec.add', level, prompt: `${a} + ${b} = ?`, answer: ans,
      candidates: [
        C(rules.forgotCarry(A, B) / p, 'forgot-carry'),
        C(roundN(ans + 1 / p, 4), 'off-by-one'),
        C(roundN(ans - 1 / p, 4), 'off-by-one'),
        C(roundN(ans + 1, 4), 'place-value'),
      ],
      hint: { type: 'text', text: `Line up the decimal points: ${a} + ${b} = ${ans}.` },
    },
    rng,
  );
};

export const decCompare: Generator = (level, rng) => {
  const whole = level >= 5 ? rng.int(0, 5) : 0;
  const a = whole + rng.int(1, 9) / 10;
  const b = rng.chance(0.15) ? a : roundN(whole + rng.int(1, 99) / 100, 2);
  const [x, y] = rng.chance(0.5) ? [a, b] : [b, a];
  const answer = x < y ? '<' : x > y ? '>' : '=';
  return buildQuestion(
    {
      skillId: 'dec.compare', level, kind: 'compare', prompt: `${x}  ?  ${y}`, answer,
      fixedChoices: ['<', '=', '>'], candidates: [{ value: '', tag: 'decimal-length' }],
      hint: { type: 'text', text: `Compare tenths first: ${x.toFixed(2)} vs ${y.toFixed(2)}, so ${x} ${answer} ${y}.` },
    },
    rng,
  );
};

export const decNumberLine: Generator = (level, rng) => {
  const seg = level <= 4 ? 1 : 0.5;
  const segIdx = rng.int(0, 2);
  const lo = segIdx * seg;
  const steps = seg === 1 ? 10 : 50;
  const v = roundN(lo + (rng.int(1, steps - 1) / steps) * seg, 2);
  const labels = [0, 1, 2].map((i) => `${roundN(i * seg, 2)}–${roundN((i + 1) * seg, 2)}`);
  return buildQuestion(
    {
      skillId: 'dec.numberline', level, kind: 'numberLine', prompt: `Where is ${v}?`, answer: labels[segIdx],
      fixedChoices: labels, candidates: [{ value: '', tag: 'magnitude' }],
      hint: { type: 'numberLine', start: 0, jumps: [v], text: `${v} sits between ${labels[segIdx].replace('–', ' and ')}.` },
    },
    rng,
  );
};

export const pctOfEasy: Generator = (level, rng) => {
  const pct = level <= 3 ? 50 : rng.pick([10, 25, 50, 75, 20]);
  const unit = 100 / gcd(pct, 100);
  const of = unit * rng.int(1, scale(level, 4, 20));
  const ans = (pct * of) / 100;
  return buildQuestion(
    {
      skillId: 'pct.of.easy', level, prompt: `${pct}% of ${of} = ?`, answer: ans,
      candidates: [C(rules.pctAsNumber(pct, of), 'pct-as-number'), C(ans * 2, 'near-miss'), C(ans + (ans >= 10 ? 10 : 1), 'near-miss'), C(ans / 2, 'near-miss')],
      hint: explainPercent(pct, of),
    },
    rng,
  );
};

export const ratioSimplify: Generator = (level, rng) => {
  let p = rng.int(1, scale(level, 4, 9)), q = rng.int(1, scale(level, 5, 9));
  while (gcd(p, q) !== 1 || p === q) { p = rng.int(1, 9); q = rng.int(1, 9); }
  const k = rng.int(2, scale(level, 4, 9));
  const ans = `${p}:${q}`;
  return buildQuestion(
    {
      skillId: 'ratio.simplify', level, prompt: `Simplify ${p * k}:${q * k}`,
      speech: `Simplify the ratio ${p * k} to ${q * k}`, answer: ans,
      candidates: [
        { value: `${q}:${p}`, tag: 'compare-flip' },
        { value: `${p + 1}:${q}`, tag: 'near-miss' },
        { value: `${p}:${q + 1}`, tag: 'near-miss' },
      ],
      hint: { type: 'text', text: `Divide both sides by ${k}: ${p * k}÷${k} = ${p}, ${q * k}÷${k} = ${q}.` },
    },
    rng,
  );
};

export const ratioShare: Generator = (level, rng) => {
  const p = rng.int(1, 5);
  let q = rng.int(1, 5);
  while (p === q) q = rng.int(1, 5);
  const unit = rng.int(2, scale(level, 6, 15));
  const total = (p + q) * unit;
  const bigger = Math.max(p, q) * unit;
  return buildQuestion(
    {
      skillId: 'ratio.share', level, prompt: `Share ${total} in ratio ${p}:${q}. Bigger part?`,
      speech: `Share ${total} in the ratio ${p} to ${q}. What is the bigger part?`, answer: bigger,
      candidates: [C(Math.min(p, q) * unit, 'near-miss'), C(total / 2, 'op-swap'), C(Math.max(p, q) * (unit + 1), 'near-miss'), C(bigger + unit, 'near-miss')],
      hint: { type: 'groups', total, groups: p + q, text: `${p + q} parts of ${unit}. The bigger share is ${Math.max(p, q)} parts = ${bigger}.` },
    },
    rng,
  );
};

export { fracValue };
