import type { Answer, Fraction } from './types';

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export const frac = (n: number, d: number): Fraction => ({ n, d });

export function simplify(f: Fraction): Fraction {
  const g = gcd(f.n, f.d);
  const s = f.d < 0 ? -1 : 1;
  return { n: (s * f.n) / g, d: (s * f.d) / g };
}

export const fracValue = (f: Fraction) => f.n / f.d;

export function compareFrac(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const x = a.n * b.d - b.n * a.d;
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}

export function isFraction(a: Answer): a is Fraction {
  return typeof a === 'object' && a !== null && 'n' in a && 'd' in a;
}

/** Round to avoid floating noise (0.1 + 0.2). */
export function roundN(x: number, dp = 6): number {
  const p = 10 ** dp;
  return Math.round(x * p) / p;
}

/** Canonical key used for equality/uniqueness of answers. Fractions compare by value. */
export function answerKey(a: Answer): string {
  if (typeof a === 'number') return `n:${roundN(a)}`;
  if (isFraction(a)) {
    const s = simplify(a);
    return `f:${s.n}/${s.d}`;
  }
  return `s:${a}`;
}

export function answersEqual(a: Answer, b: Answer): boolean {
  return answerKey(a) === answerKey(b);
}

export function formatNumber(x: number): string {
  const r = roundN(x, 4);
  const s = Number.isInteger(r) ? String(r) : String(r);
  return s.replace('-', '−');
}

export function formatAnswer(a: Answer): string {
  if (typeof a === 'number') return formatNumber(a);
  if (isFraction(a)) return `${formatNumber(a.n)}/${formatNumber(a.d)}`;
  return a;
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Spoken English for integers (|n| < 1,000,000); decimals read digit by digit. */
export function numberToWords(x: number): string {
  if (x < 0) return `minus ${numberToWords(-x)}`;
  if (!Number.isInteger(x)) {
    const [i, d] = String(roundN(x, 4)).split('.');
    return `${numberToWords(Number(i))} point ${d.split('').map((c) => ONES[Number(c)]).join(' ')}`;
  }
  if (x < 20) return ONES[x];
  if (x < 100) return TENS[Math.floor(x / 10)] + (x % 10 ? ` ${ONES[x % 10]}` : '');
  if (x < 1000)
    return `${ONES[Math.floor(x / 100)]} hundred${x % 100 ? ` and ${numberToWords(x % 100)}` : ''}`;
  if (x < 1_000_000)
    return `${numberToWords(Math.floor(x / 1000))} thousand${x % 1000 ? ` ${numberToWords(x % 1000)}` : ''}`;
  return String(x);
}

/** Turn a prompt like '7 × 8 = ?' into speakable text. */
export function promptToSpeech(prompt: string): string {
  return prompt
    .replace(/(\d+)\/(\d+)/g, (_m, n, d) => `${numberToWords(+n)} over ${numberToWords(+d)}`)
    .replace(/−?\d+(\.\d+)?/g, (m) => numberToWords(Number(m.replace('−', '-'))))
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/\+/g, ' plus ')
    .replace(/ − | - /g, ' minus ')
    .replace(/%/g, ' percent')
    .replace(/√/g, 'square root of ')
    .replace(/\^/g, ' to the power ')
    .replace(/= \?$/g, 'equals WHATQ')
    .replace(/\?/g, ' what ')
    .replace('WHATQ', 'what?')
    .replace(/=/g, ' equals ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens used by the read-time formula: numbers and operators. */
export function countTokens(prompt: string): number {
  const m = prompt.match(/\d+(\.\d+)?|[+\-−×÷=?<>%√^]|[A-Za-z]+/g);
  return Math.max(1, m ? m.length : 1);
}
