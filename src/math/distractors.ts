import type { Answer, Fraction, Rng } from './types';
import { answerKey, isFraction, roundN, simplify } from './format';

/** Misconception rules (SPEC 7.4). Each returns the wrong value a child with that misconception gives. */
export const rules = {
  /** 47 + 38: add digit columns but drop the carry → 75 */
  forgotCarry(a: number, b: number): number {
    let res = 0;
    let place = 1;
    while (a > 0 || b > 0) {
      res += ((a % 10) + (b % 10)) % 10 * place;
      a = Math.floor(a / 10);
      b = Math.floor(b / 10);
      place *= 10;
    }
    return res;
  },
  /** 52 − 17: subtract smaller digit from larger in each column → 45 */
  borrowReverse(a: number, b: number): number {
    let res = 0;
    let place = 1;
    while (a > 0 || b > 0) {
      res += Math.abs((a % 10) - (b % 10)) * place;
      a = Math.floor(a / 10);
      b = Math.floor(b / 10);
      place *= 10;
    }
    return res;
  },
  offByOne: (x: number): number[] => [x - 1, x + 1],
  opSwap(a: number, b: number, op: '+' | '-' | '×' | '÷'): number[] {
    const out: number[] = [];
    if (op !== '+') out.push(a + b);
    if (op !== '-') out.push(Math.abs(a - b));
    if (op !== '×') out.push(a * b);
    return out;
  },
  tableNeighbour: (a: number, b: number): number[] => [a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b],
  placeValue: (x: number): number[] => [x / 10, x * 10],
  fracAddTopsBottoms: (a: Fraction, b: Fraction): Fraction => ({ n: a.n + b.n, d: a.d + b.d }),
  pctAsNumber: (pct: number, of: number): number => of - pct,
  signError: (x: number): number => -x,
  digitReversal(x: number): number {
    const s = String(Math.abs(x)).split('').reverse().join('');
    return Number(s) * Math.sign(x || 1);
  },
};

export const TAG_TEXT: Record<string, string> = {
  'forgot-carry': 'often forgets to carry when adding',
  'borrow-reverse': 'subtracts the smaller digit from the bigger one instead of borrowing',
  'off-by-one': 'is often off by one',
  'op-swap': 'sometimes uses the wrong operation',
  'table-neighbour': 'mixes up neighbouring times-table facts',
  'place-value': 'mixes up place value (×10 / ÷10)',
  'frac-add-tops-bottoms': 'adds the tops and the bottoms of fractions',
  'pct-as-number': 'treats a percent like a plain number',
  'sign-error': 'makes sign errors with negatives',
  'digit-reversal': 'reverses digits',
  'compare-flip': 'flips the < and > signs',
  'bigger-denominator': 'thinks a bigger bottom number means a bigger fraction',
  'decimal-length': 'thinks longer decimals are bigger',
  'order-of-ops': 'works left-to-right instead of × before +',
  'power-as-multiply': 'multiplies the base by the power instead of repeated multiplying',
  'magnitude': 'misjudges the size of an answer',
  'near-miss': 'is close but not exact',
  'miscount': 'miscounts objects',
};

export interface Candidate {
  value: Answer;
  tag: string;
}

/**
 * Filters (SPEC 7.4): unique, never equals answer, same sign as answer (unless sign-error rule),
 * within ±50% magnitude (with a small absolute window for tiny numbers), integers stay integers.
 */
export function filterCandidates(answer: Answer, cands: Candidate[], allowNegative = false): Candidate[] {
  const seen = new Set<string>([answerKey(answer)]);
  const out: Candidate[] = [];
  for (const c of cands) {
    const v = c.value;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) continue;
      if (typeof answer === 'number') {
        if (Number.isInteger(answer) && !Number.isInteger(roundN(v))) continue;
        const sameSign = Math.sign(v) === Math.sign(answer) || v === 0 || answer === 0;
        if (!sameSign && c.tag !== 'sign-error') continue;
        if (v < 0 && !allowNegative && answer >= 0) continue;
        const window = Math.max(Math.abs(answer) * 0.5, 3);
        if (Math.abs(v - answer) > window && c.tag !== 'place-value' && c.tag !== 'magnitude') continue;
      }
    } else if (isFraction(v)) {
      if (v.d === 0 || v.n <= 0 || v.d <= 0) continue;
    }
    const k = answerKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** Generic fallbacks when misconception rules don't give two valid distractors. */
export function fallbackCandidates(answer: Answer, rng: Rng): Candidate[] {
  if (typeof answer === 'number') {
    const step = Number.isInteger(answer) ? 1 : 0.1;
    const big = Math.abs(answer) >= 20 ? 10 : 2;
    const list = [
      answer + step, answer - step, answer + 2 * step, answer - 2 * step,
      answer + big * step, answer - big * step, answer + 3 * step,
    ].map((v) => roundN(v, 4));
    if (rng.chance(0.5)) list.reverse();
    return list.map((value) => ({ value, tag: 'near-miss' }));
  }
  if (isFraction(answer)) {
    const s = simplify(answer);
    return [
      { value: { n: s.n + 1, d: s.d }, tag: 'near-miss' },
      { value: { n: s.n, d: s.d + 1 }, tag: 'near-miss' },
      { value: { n: Math.max(1, s.n - 1), d: s.d }, tag: 'near-miss' },
      { value: { n: s.n + 1, d: s.d + 1 }, tag: 'near-miss' },
      { value: { n: s.n * 2 + 1, d: s.d * 2 }, tag: 'near-miss' },
    ];
  }
  return [];
}

/**
 * Balanced answer positions over a run: a shuffled bag of [0,1,2] refilled when empty,
 * so the correct lane is never biased toward one side.
 */
export class PositionBag {
  private bag: number[] = [];
  constructor(private rng: Rng) {}
  next(): number {
    if (this.bag.length === 0) {
      this.bag = [0, 1, 2, 0, 1, 2];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop()!;
  }
}
