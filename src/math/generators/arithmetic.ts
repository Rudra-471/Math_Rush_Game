import type { Generator, Rng } from '../types';
import { buildQuestion, scale } from '../build';
import { rules, type Candidate } from '../distractors';
import { numberToWords } from '../format';
import { explainAdd, explainSub, explainMul, explainDiv } from '../explain';

const C = (value: number, tag: string): Candidate => ({ value, tag });
const OBJECTS = ['🍎', '⭐', '🐟', '🎈', '🚂', '🍌', '⚽', '🌸'];
const NAMES: Record<string, string> = {
  '🍎': 'apples', '⭐': 'stars', '🐟': 'fish', '🎈': 'balloons',
  '🚂': 'trains', '🍌': 'bananas', '⚽': 'balls', '🌸': 'flowers',
};

function parseFact(fact: string | undefined, sep: string): [number, number] | null {
  if (!fact) return null;
  const parts = fact.split(sep).map(Number);
  return parts.length === 2 && parts.every(Number.isFinite) ? [parts[0], parts[1]] : null;
}

function countGen(skillId: string, maxHi: number): Generator {
  return (level, rng) => {
    const n = rng.int(Math.max(1, scale(level, 2, maxHi) - 4), scale(level, 4, maxHi));
    const obj = rng.pick(OBJECTS);
    const groups: string[] = [];
    for (let i = 0; i < n; i += 5) groups.push(obj.repeat(Math.min(5, n - i)));
    return buildQuestion(
      {
        skillId, level,
        prompt: `${groups.join(' ')}  How many?`,
        speech: `How many ${NAMES[obj]}?`,
        answer: n,
        candidates: [C(n - 1, 'miscount'), C(n + 1, 'miscount'), C(n + 2, 'miscount'), C(n - 2, 'miscount')],
        hint: { type: 'text', text: `Count them in fives: there are ${n}.` },
      },
      rng,
    );
  };
}

export const countObjects10 = countGen('count.objects10', 10);
export const countObjects20 = countGen('count.objects20', 20);

export const cmpNumbers20: Generator = (level, rng) => {
  const hi = scale(level, 10, 20);
  const a = rng.int(0, hi);
  const b = rng.chance(0.2) ? a : rng.int(0, hi);
  const answer = a < b ? '<' : a > b ? '>' : '=';
  return buildQuestion(
    {
      skillId: 'cmp.numbers20', level, kind: 'compare',
      prompt: `${a}  ?  ${b}`,
      speech: `Is ${numberToWords(a)} less than, equal to, or more than ${numberToWords(b)}?`,
      answer, fixedChoices: ['<', '=', '>'],
      candidates: [{ value: '', tag: 'compare-flip' }],
      hint: {
        type: 'numberLine', start: Math.min(a, b), jumps: a === b ? [] : [Math.abs(a - b)],
        text: a === b ? `${a} and ${b} are the same.` : `${Math.max(a, b)} is further along the number line, so ${a} ${answer} ${b}.`,
      },
    },
    rng,
  );
};

export const numBeforeAfter: Generator = (level, rng) => {
  const hi = scale(level, 10, 100);
  const n = rng.int(2, hi);
  const after = rng.chance(0.5);
  const answer = after ? n + 1 : n - 1;
  return buildQuestion(
    {
      skillId: 'num.before-after', level,
      prompt: after ? `What comes after ${n}?` : `What comes before ${n}?`,
      answer,
      candidates: [C(after ? n - 1 : n + 1, 'off-by-one'), C(n, 'off-by-one'), C(answer + (after ? 1 : -1), 'off-by-one')],
      hint: { type: 'numberLine', start: n, jumps: [after ? 1 : -1], text: `One step ${after ? 'forward' : 'back'} from ${n} is ${answer}.` },
    },
    rng,
  );
};

function addGen(skillId: string, maxSum: number, minA = 1): Generator {
  return (level, rng, opts) => {
    let pair = parseFact(opts?.fact, '+');
    if (!pair) {
      const sumHi = scale(level, Math.min(10, maxSum), maxSum);
      const a = rng.int(minA, Math.max(minA, Math.min(9, sumHi - 1)));
      const b = rng.int(1, Math.max(1, Math.min(9, sumHi - a)));
      pair = [a, b];
    }
    const [a, b] = pair;
    const ans = a + b;
    return buildQuestion(
      {
        skillId, level, prompt: `${a} + ${b} = ?`, answer: ans, factKey: `${a}+${b}`,
        candidates: [
          ...rules.offByOne(ans).map((v) => C(v, 'off-by-one')),
          C(Math.abs(a - b), 'op-swap'),
          C(rules.digitReversal(ans), 'digit-reversal'),
        ],
        hint: explainAdd(a, b),
      },
      rng,
    );
  };
}
export const add1d = addGen('add.1d', 18);
export const addWithin20 = addGen('add.within20', 20, 3);

function subGen(skillId: string, maxA: number): Generator {
  return (level, rng) => {
    const a = rng.int(Math.min(4, maxA), scale(level, Math.min(10, maxA), maxA));
    const b = rng.int(1, a - 1 > 0 ? a - 1 : 1);
    const ans = a - b;
    return buildQuestion(
      {
        skillId, level, prompt: `${a} − ${b} = ?`, answer: ans,
        candidates: [...rules.offByOne(ans).map((v) => C(v, 'off-by-one')), C(a + b, 'op-swap')],
        hint: explainSub(a, b),
      },
      rng,
    );
  };
}
export const subWithin10 = subGen('sub.within10', 10);
export const subWithin20 = subGen('sub.within20', 20);

export const patternSkip: Generator = (level, rng) => {
  const step = level <= 3 ? 2 : level <= 6 ? rng.pick([2, 5]) : rng.pick([2, 5, 10]);
  const start = step * rng.int(0, scale(level, 3, 10));
  const seq = [0, 1, 2, 3].map((i) => start + i * step);
  const ans = start + 4 * step;
  return buildQuestion(
    {
      skillId: 'pattern.skip2', level, prompt: `${seq.join(', ')}, ?`,
      speech: `${seq.map(numberToWords).join(', ')}, what comes next?`,
      answer: ans,
      candidates: [C(ans + 1, 'off-by-one'), C(ans - 1, 'off-by-one'), C(ans + step, 'near-miss'), C(seq[3] + 1, 'off-by-one')],
      hint: { type: 'numberLine', start: seq[3], jumps: [step], text: `It goes up by ${step} each time: ${seq[3]} + ${step} = ${ans}.` },
    },
    rng,
  );
};

function twoDigit(rng: Rng, lo: number, hi: number): number {
  return rng.int(lo, hi);
}

export const add2dNoCarry: Generator = (level, rng) => {
  const ta = rng.int(1, scale(level, 4, 8));
  const tb = rng.int(1, 9 - ta);
  const oa = rng.int(0, 8);
  const ob = rng.int(0, 9 - oa);
  const a = ta * 10 + oa;
  const b = level <= 2 ? ob : tb * 10 + ob;
  const ans = a + b;
  return buildQuestion(
    {
      skillId: 'add.2d.nocarry', level, prompt: `${a} + ${b} = ?`, answer: ans,
      candidates: [C(ans + 10, 'place-value'), C(ans - 10, 'place-value'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one')), C(rules.digitReversal(ans), 'digit-reversal')],
      hint: explainAdd(a, b),
    },
    rng,
  );
};

export const add2dCarry: Generator = (level, rng) => {
  let a = 0, b = 0;
  for (let i = 0; i < 50; i++) {
    a = level <= 2 ? twoDigit(rng, 11, 39) : twoDigit(rng, 12, scale(level, 50, 89));
    b = level <= 1 ? rng.int(3, 9) : twoDigit(rng, 12, scale(level, 39, 89));
    if ((a % 10) + (b % 10) >= 10) break;
  }
  if ((a % 10) + (b % 10) < 10) { a = 47; b = 38; }
  const ans = a + b;
  return buildQuestion(
    {
      skillId: 'add.2d.carry', level, prompt: `${a} + ${b} = ?`, answer: ans,
      candidates: [C(rules.forgotCarry(a, b), 'forgot-carry'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one')), C(ans + 10, 'place-value'), C(ans - 10, 'forgot-carry')],
      hint: explainAdd(a, b),
    },
    rng,
  );
};

export const sub2dNoBorrow: Generator = (level, rng) => {
  const ta = rng.int(2, scale(level, 5, 9));
  const oa = rng.int(1, 9);
  const tb = rng.int(1, ta - 1);
  const ob = rng.int(0, oa);
  const a = ta * 10 + oa;
  const b = level <= 2 ? ob || 1 : tb * 10 + ob;
  const ans = a - b;
  return buildQuestion(
    {
      skillId: 'sub.2d.noborrow', level, prompt: `${a} − ${b} = ?`, answer: ans,
      candidates: [C(ans + 10, 'place-value'), C(ans - 10, 'place-value'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one'))],
      hint: explainSub(a, b),
    },
    rng,
  );
};

export const sub2dBorrow: Generator = (level, rng) => {
  let a = 52, b = 17;
  for (let i = 0; i < 50; i++) {
    const ca = rng.int(21, scale(level, 50, 99));
    const cb = level <= 1 ? rng.int(3, 9) : rng.int(11, ca - 5);
    if (ca % 10 < cb % 10 && ca - cb > 0) { a = ca; b = cb; break; }
  }
  const ans = a - b;
  return buildQuestion(
    {
      skillId: 'sub.2d.borrow', level, prompt: `${a} − ${b} = ?`, answer: ans,
      candidates: [C(rules.borrowReverse(a, b), 'borrow-reverse'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one')), C(ans + 10, 'borrow-reverse')],
      hint: explainSub(a, b),
    },
    rng,
  );
};

function mulGen(skillId: string, tables: number[]): Generator {
  return (level, rng, opts) => {
    let pair = parseFact(opts?.fact, 'x');
    if (!pair) {
      const a = rng.pick(tables);
      const b = rng.int(2, scale(level, 5, 12));
      pair = rng.chance(0.5) ? [a, b] : [b, a];
    }
    const [a, b] = pair;
    const ans = a * b;
    const missing = level >= 9 && rng.chance(0.35);
    const candidates = missing
      ? [...rules.offByOne(b).map((v) => C(v, 'table-neighbour')), C(ans - a, 'op-swap'), C(b + 2, 'table-neighbour')]
      : [...rules.tableNeighbour(a, b).map((v) => C(v, 'table-neighbour')), C(a + b, 'op-swap'), C(rules.digitReversal(ans), 'digit-reversal'), ...rules.offByOne(ans).map((v) => C(v, 'off-by-one'))];
    return buildQuestion(
      {
        skillId, level, kind: missing ? 'missing' : 'choice3',
        prompt: missing ? `${a} × ? = ${ans}` : `${a} × ${b} = ?`,
        answer: missing ? b : ans, factKey: `${a}x${b}`, candidates,
        hint: explainMul(a, b),
      },
      rng,
    );
  };
}
export const mulTable2to5 = mulGen('mul.table.2-5', [2, 3, 4, 5]);
export const mulTable6to9 = mulGen('mul.table.6-9', [6, 7, 8, 9]);
export const mulTable10to12 = mulGen('mul.table.10-12', [10, 11, 12]);

export const divFacts: Generator = (level, rng, opts) => {
  let pair = parseFact(opts?.fact, '/');
  if (!pair) {
    const d = rng.int(2, scale(level, 5, 12));
    const q = rng.int(2, scale(level, 5, 12));
    pair = [d * q, d];
  }
  const [total, d] = pair;
  const q = total / d;
  const missing = rng.chance(0.4);
  return buildQuestion(
    {
      skillId: 'div.facts', level, kind: missing ? 'missing' : 'choice3',
      prompt: missing ? `? × ${d} = ${total}` : `${total} ÷ ${d} = ?`,
      answer: q, factKey: `${total}/${d}`,
      candidates: [...rules.offByOne(q).map((v) => C(v, 'table-neighbour')), C(total - d, 'op-swap'), C(d, 'op-swap'), C(q + 2, 'table-neighbour')],
      hint: explainDiv(total, d),
    },
    rng,
  );
};

export const patternArith: Generator = (level, rng) => {
  const step = rng.int(3, scale(level, 6, 25)) * (level >= 6 && rng.chance(0.4) ? -1 : 1);
  const start = step > 0 ? rng.int(1, scale(level, 10, 60)) : rng.int(-step * 5 + 1, -step * 5 + 60);
  const seq = [0, 1, 2, 3].map((i) => start + i * step);
  const ans = start + 4 * step;
  return buildQuestion(
    {
      skillId: 'pattern.arith', level, prompt: `${seq.join(', ')}, ?`,
      speech: `${seq.map(numberToWords).join(', ')}, what comes next?`, answer: ans,
      candidates: [C(ans + 1, 'off-by-one'), C(ans - 1, 'off-by-one'), C(seq[3] - step, 'near-miss'), C(ans + step, 'near-miss')],
      hint: { type: 'numberLine', start: seq[3], jumps: [step], text: `The rule is ${step > 0 ? '+' : '−'}${Math.abs(step)} each time: ${seq[3]} ${step > 0 ? '+' : '−'} ${Math.abs(step)} = ${ans}.` },
    },
    rng,
  );
};

export const mentalRound10: Generator = (level, rng) => {
  const to100 = level >= 6 && rng.chance(0.6);
  const unit = to100 ? 100 : 10;
  let n: number;
  do n = rng.int(unit + 1, to100 ? scale(level, 999, 999) : scale(level, 99, 999));
  while (n % unit === unit / 2 || n % unit === 0);
  const ans = Math.round(n / unit) * unit;
  const other = ans > n ? ans - unit : ans + unit;
  return buildQuestion(
    {
      skillId: 'mental.round10', level, prompt: `Round ${n} to the nearest ${unit}`, answer: ans,
      candidates: [C(other, 'near-miss'), C(Math.round(n / (unit / 10)) * (unit / 10), 'place-value'), C(ans + unit, 'near-miss')],
      hint: { type: 'numberLine', start: Math.floor(n / unit) * unit, jumps: [unit], text: `${n} is closer to ${ans} than to ${other}.` },
    },
    rng,
  );
};
