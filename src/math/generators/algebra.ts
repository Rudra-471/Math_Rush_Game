import type { Generator } from '../types';
import { buildQuestion, scale } from '../build';
import { rules, type Candidate } from '../distractors';
import { formatNumber, numberToWords } from '../format';
import { explainBalance, explainPercent } from '../explain';

const C = (value: number, tag: string): Candidate => ({ value, tag });
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const f = formatNumber;

export const algMissing: Generator = (level, rng) => {
  const type = rng.int(0, level >= 4 ? 2 : 1);
  let prompt: string, ans: number, cands: Candidate[], text: string;
  if (type === 0) {
    ans = rng.int(2, scale(level, 20, 80));
    const b = rng.int(2, scale(level, 15, 60));
    prompt = `? + ${b} = ${ans + b}`;
    cands = [C(ans + 2 * b, 'op-swap'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one'))];
    text = `${ans + b} − ${b} = ${ans}`;
  } else if (type === 1) {
    const b = rng.int(2, scale(level, 6, 12));
    ans = rng.int(2, scale(level, 6, 12));
    prompt = `? × ${b} = ${ans * b}`;
    cands = [C(ans * b - b, 'op-swap'), ...rules.offByOne(ans).map((v) => C(v, 'table-neighbour'))];
    text = `${ans * b} ÷ ${b} = ${ans}`;
  } else {
    const a = rng.int(20, scale(level, 50, 99));
    ans = rng.int(3, a - 3);
    prompt = `${a} − ? = ${a - ans}`;
    cands = [C(a + (a - ans), 'op-swap'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one')), C(a - ans, 'near-miss')];
    text = `${a} − ${a - ans} = ${ans}`;
  }
  return buildQuestion(
    { skillId: 'alg.missing-number', level, kind: 'missing', prompt, answer: ans, candidates: cands, hint: explainBalance([text], `Undo it: ${text}.`) },
    rng,
  );
};

export const orderOfOps: Generator = (level, rng) => {
  const a = rng.int(2, scale(level, 9, 20));
  const b = rng.int(2, scale(level, 6, 12));
  const c = rng.int(2, scale(level, 5, 9));
  const variant = rng.int(0, level >= 5 ? 2 : 0);
  let prompt: string, ans: number, wrong: number, text: string;
  if (variant === 0) {
    prompt = `${a} + ${b} × ${c} = ?`; ans = a + b * c; wrong = (a + b) * c;
    text = `× first: ${b} × ${c} = ${b * c}, then + ${a} = ${ans}`;
  } else if (variant === 1) {
    prompt = `(${a} + ${b}) × ${c} = ?`; ans = (a + b) * c; wrong = a + b * c;
    text = `Brackets first: ${a + b}, then × ${c} = ${ans}`;
  } else {
    const big = b * c + a;
    prompt = `${big} − ${b * c} ÷ ${c} = ?`; ans = big - b; wrong = (big - b * c) / c;
    text = `÷ first: ${b * c} ÷ ${c} = ${b}, then ${big} − ${b} = ${ans}`;
  }
  return buildQuestion(
    {
      skillId: 'order-of-ops', level, prompt, answer: ans,
      candidates: [C(wrong, 'order-of-ops'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one')), C(ans + 10, 'near-miss')],
      hint: explainBalance([text], text),
    },
    rng,
  );
};

export const estimateProduct: Generator = (level, rng) => {
  let a = 0, b = 0, k = 2;
  for (let i = 0; i < 100; i++) {
    a = rng.int(11, scale(level, 60, 400));
    b = rng.int(4, scale(level, 30, 300));
    const lg = Math.log10(a * b);
    k = Math.round(lg);
    if (Math.abs(lg - k) < 0.3 && k >= 2) break;
  }
  const choices = [10 ** (k - 1), 10 ** k, 10 ** (k + 1)];
  return buildQuestion(
    {
      skillId: 'estimate.product', level, kind: 'estimate', prompt: `≈ ${a} × ${b} ?`,
      speech: `Roughly, what is ${numberToWords(a)} times ${numberToWords(b)}?`,
      answer: choices[1], fixedChoices: choices, candidates: [{ value: '', tag: 'magnitude' }],
      hint: { type: 'text', text: `Round first: about ${roundSig(a)} × ${roundSig(b)} = ${roundSig(a) * roundSig(b)}, closest to ${choices[1]}.` },
    },
    rng,
  );
};

function roundSig(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  return Math.round(x / p) * p;
}

export const algLinear1: Generator = (level, rng) => {
  const a = rng.int(2, scale(level, 4, 9));
  const x = rng.int(1, scale(level, 8, 15));
  const b = rng.int(1, scale(level, 10, 30)) * (level >= 4 && rng.chance(0.5) ? -1 : 1);
  const c = a * x + b;
  const bs = b < 0 ? `− ${-b}` : `+ ${b}`;
  return buildQuestion(
    {
      skillId: 'alg.linear1', level, prompt: `${a}x ${bs} = ${c}.  x = ?`, answer: x,
      candidates: [C(c - b, 'op-swap'), C((c + b) / a, 'sign-error'), ...rules.offByOne(x).map((v) => C(v, 'near-miss'))],
      hint: explainBalance([`${a}x = ${c} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${c - b}`, `x = ${c - b} ÷ ${a} = ${x}`], `Undo ${bs.replace(' ', '')} first, then divide by ${a}.`),
    },
    rng,
  );
};

export const algLinearNeg: Generator = (level, rng) => {
  const a = -rng.int(2, scale(level, 4, 9));
  const x = rng.int(-scale(level, 6, 12), scale(level, 6, 12)) || 3;
  const b = rng.int(1, scale(level, 12, 30));
  const c = a * x + b;
  return buildQuestion(
    {
      skillId: 'alg.linear.negative', level, prompt: `${f(a)}x + ${b} = ${f(c)}.  x = ?`, answer: x, allowNegative: true,
      candidates: [C(rules.signError(x), 'sign-error'), ...rules.offByOne(x).map((v) => C(v, 'near-miss')), C((c + b) / a, 'sign-error')],
      hint: explainBalance([`${f(a)}x = ${f(c)} − ${b} = ${f(c - b)}`, `x = ${f(c - b)} ÷ ${f(a)} = ${f(x)}`], 'Subtract first, then divide — watch the signs!'),
    },
    rng,
  );
};

export const expPowers: Generator = (level, rng) => {
  const base = rng.int(2, scale(level, 3, 10));
  const maxE = base <= 3 ? scale(level, 3, 6) : base <= 5 ? 3 : 2;
  const e = rng.int(2, Math.max(2, maxE));
  const ans = base ** e;
  return buildQuestion(
    {
      skillId: 'exp.powers', level, prompt: `${base}${sup(e)} = ?`, speech: `${numberToWords(base)} to the power ${numberToWords(e)}`, answer: ans,
      candidates: [C(base * e, 'power-as-multiply'), C(base ** (e - 1), 'near-miss'), C(base ** (e + 1), 'magnitude'), C(ans + base, 'near-miss')],
      hint: { type: 'text', text: `${base}${sup(e)} = ${Array(e).fill(base).join(' × ')} = ${ans}.` },
    },
    rng,
  );
};

export const expRules: Generator = (level, rng) => {
  const base = rng.int(2, 9);
  const m = rng.int(2, scale(level, 5, 9));
  const n = rng.int(2, scale(level, 4, 8));
  const t = rng.int(0, level >= 4 ? 2 : 0);
  let prompt: string, ans: number, wrong: number, text: string;
  if (t === 0) { prompt = `${base}${sup(m)} × ${base}${sup(n)} = ${base}^?`; ans = m + n; wrong = m * n; text = 'Multiplying: add the powers.'; }
  else if (t === 1) { prompt = `(${base}${sup(m)})${sup(n)} = ${base}^?`; ans = m * n; wrong = m + n; text = 'Power of a power: multiply the powers.'; }
  else { const big = m + n; prompt = `${base}${sup(big)} ÷ ${base}${sup(n)} = ${base}^?`; ans = m; wrong = Math.max(1, Math.round(big / n)); text = 'Dividing: subtract the powers.'; }
  return buildQuestion(
    {
      skillId: 'exp.rules', level, kind: 'missing', prompt, speech: prompt.replace('^?', ' to the power what?'), answer: ans,
      candidates: [C(wrong, 'power-as-multiply'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one'))],
      hint: { type: 'text', text: `${text} The answer is ${ans}.` },
    },
    rng,
  );
};

export const sqrtPerfect: Generator = (level, rng) => {
  const r = rng.int(2, scale(level, 6, 15));
  return buildQuestion(
    {
      skillId: 'sqrt.perfect', level, prompt: `√${r * r} = ?`, answer: r,
      candidates: [C(r * 2, 'op-swap'), ...rules.offByOne(r).map((v) => C(v, 'near-miss')), C(r + 2, 'near-miss')],
      hint: { type: 'dotArray', rows: r, cols: r, text: `${r} × ${r} = ${r * r}, so √${r * r} = ${r}.` },
    },
    rng,
  );
};

export const sqrtEstimate: Generator = (level, rng) => {
  let n = 50;
  for (let i = 0; i < 50; i++) {
    n = rng.int(10, scale(level, 100, 400));
    const s = Math.sqrt(n);
    if (!Number.isInteger(s) && Math.abs(s - Math.round(s)) < 0.4) break;
  }
  const ans = Math.round(Math.sqrt(n));
  return buildQuestion(
    {
      skillId: 'sqrt.estimate', level, prompt: `√${n} ≈ ?`, speech: `The square root of ${numberToWords(n)} is about what whole number?`, answer: ans,
      candidates: [...rules.offByOne(ans).map((v) => C(v, 'near-miss')), C(Math.round(n / 2), 'op-swap'), C(ans + 2, 'near-miss')],
      hint: { type: 'text', text: `${ans}² = ${ans * ans}, which is the closest square to ${n}.` },
    },
    rng,
  );
};

export const pctChange: Generator = (level, rng) => {
  const pct = rng.pick(level <= 4 ? [10, 50, 25] : [10, 20, 25, 30, 40, 75, 5]);
  const of = 20 * rng.int(1, scale(level, 5, 25));
  const inc = rng.chance(0.6);
  const ans = inc ? of + (of * pct) / 100 : of - (of * pct) / 100;
  return buildQuestion(
    {
      skillId: 'pct.change', level, prompt: `${inc ? 'Increase' : 'Decrease'} ${of} by ${pct}%`, answer: ans,
      candidates: [C(inc ? of + pct : of - pct, 'pct-as-number'), C(inc ? of - (of * pct) / 100 : of + (of * pct) / 100, 'op-swap'), C((of * pct) / 100, 'near-miss')],
      hint: explainPercent(pct, of),
    },
    rng,
  );
};

export const pctReverse: Generator = (level, rng) => {
  const pct = rng.pick([10, 20, 25, 50]);
  const orig = (100 / pct) * rng.int(2, scale(level, 8, 30));
  const after = Math.round((orig * (100 + pct)) / 100);
  const mult = (100 + pct) / 100;
  return buildQuestion(
    {
      skillId: 'pct.reverse', level, prompt: `After a ${pct}% rise it is ${after}. Original?`, speech: `After a ${pct} percent increase the price is ${after}. What was it before?`, answer: orig,
      candidates: [C(Math.round(after * (1 - pct / 100) * 100) / 100, 'pct-as-number'), C(after - pct, 'pct-as-number'), C(orig + (orig * pct) / 200, 'near-miss')],
      hint: explainBalance([`${after} = ${mult} × original`, `original = ${after} ÷ ${mult} = ${orig}`], `${after} is ${100 + pct}% of the original, so divide by ${mult}.`),
    },
    rng,
  );
};

export const intNegatives: Generator = (level, rng) => {
  const hi = scale(level, 9, 20);
  const a = rng.int(-hi, hi) || -3;
  const b = rng.int(1, hi);
  const op = rng.pick(level <= 3 ? ['+', '−'] : ['+', '−', '×', '÷']);
  let ans: number, prompt: string;
  if (op === '+') { ans = a + b; prompt = `${f(a)} + ${b}`; }
  else if (op === '−') { ans = a - b; prompt = `${f(a)} − ${b}`; }
  else if (op === '×') { const m = -rng.int(2, 6); ans = a * m; prompt = `${f(a)} × (${f(m)})`; }
  else { const d = -rng.int(2, 6); const q = rng.int(-9, 9) || 2; ans = q; prompt = `${f(q * d)} ÷ (${f(d)})`; }
  return buildQuestion(
    {
      skillId: 'int.negatives', level, prompt: `${prompt} = ?`, answer: ans, allowNegative: true,
      candidates: [C(rules.signError(ans), 'sign-error'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one')), C(ans + 2, 'near-miss')],
      hint: { type: 'numberLine', start: op === '+' || op === '−' ? a : 0, jumps: op === '+' ? [b] : op === '−' ? [-b] : [ans], text: `${prompt} = ${f(ans)}. Negative × negative is positive; different signs give a negative.` },
    },
    rng,
  );
};

export const logicSequence: Generator = (level, rng) => {
  const t = rng.int(0, 2);
  let seq: number[], ans: number, wrong: number, rule: string;
  if (t === 0) { const s = rng.int(1, 4); seq = [0, 1, 2, 3].map((i) => (s + i) ** 2); ans = (s + 4) ** 2; wrong = seq[3] + (seq[3] - seq[2]); rule = 'square numbers'; }
  else if (t === 1) { const r = rng.pick([2, 3]); const s = rng.int(1, 5); seq = [0, 1, 2, 3].map((i) => s * r ** i); ans = s * r ** 4; wrong = seq[3] + (seq[3] - seq[2]); rule = `× ${r} each time`; }
  else { let a = rng.int(1, 3), b = rng.int(a, 5); seq = [a, b]; for (let i = 0; i < 3; i++) { [a, b] = [b, a + b]; seq.push(b); } ans = seq[3] + seq[4]; wrong = seq[4] + (seq[4] - seq[3]); seq = seq.slice(0, 5); rule = 'add the two before'; }
  return buildQuestion(
    {
      skillId: 'logic.sequence', level, prompt: `${seq.join(', ')}, ?`, answer: ans,
      candidates: [C(wrong, 'near-miss'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one'))],
      hint: { type: 'text', text: `The rule is "${rule}", so next is ${ans}.` },
    },
    rng,
  );
};

export const logicOdd: Generator = (level, rng) => {
  const k = rng.int(3, scale(level, 6, 12));
  const m1 = k * rng.int(2, 9);
  let m2 = k * rng.int(2, 9);
  while (m2 === m1) m2 = k * rng.int(2, 9);
  let odd = m1 + rng.int(1, k - 1);
  if (odd === m2) odd += k;
  return buildQuestion(
    {
      skillId: 'logic.which-is-odd', level, prompt: `Which is NOT a multiple of ${k}?`, answer: odd,
      candidates: [C(m1, 'magnitude'), C(m2, 'magnitude')],
      hint: { type: 'text', text: `${m1} = ${k} × ${m1 / k} and ${m2} = ${k} × ${m2 / k}, but ${odd} is not in the ${k} times table.` },
    },
    rng,
  );
};
