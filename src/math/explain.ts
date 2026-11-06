import type { Fraction, Hint } from './types';
import { formatAnswer } from './format';

/** Hint builders (SPEC 7.5). Each returns a visual model + short, encouraging text. */

export function explainAdd(a: number, b: number): Hint {
  const ans = a + b;
  if (b <= 10) {
    return { type: 'numberLine', start: a, jumps: [b], text: `Start at ${a} and jump ${b} forward: ${ans}.` };
  }
  const tens = Math.floor(b / 10) * 10;
  const ones = b - tens;
  return {
    type: 'numberLine', start: a, jumps: ones ? [tens, ones] : [tens],
    text: `Jump ${tens} to ${a + tens}${ones ? `, then ${ones} more to ${ans}` : ''}.`,
  };
}

export function explainSub(a: number, b: number): Hint {
  const ans = a - b;
  if (b <= 10) return { type: 'numberLine', start: a, jumps: [-b], text: `Start at ${a} and jump ${b} back: ${ans}.` };
  const tens = Math.floor(b / 10) * 10;
  const ones = b - tens;
  return {
    type: 'numberLine', start: a, jumps: ones ? [-tens, -ones] : [-tens],
    text: `Jump back ${tens} to ${a - tens}${ones ? `, then ${ones} more to ${ans}` : ''}.`,
  };
}

export function explainMul(a: number, b: number): Hint {
  return { type: 'dotArray', rows: a, cols: b, text: `${a} rows of ${b} make ${a * b}.` };
}

export function explainDiv(total: number, d: number): Hint {
  return { type: 'groups', total, groups: d, text: `Share ${total} into ${d} groups: ${total / d} in each.` };
}

export function explainFractions(fracs: Fraction[], text: string): Hint {
  return { type: 'fractionBars', fractions: fracs, text };
}

export function explainPercent(pct: number, of: number): Hint {
  return {
    type: 'percentGrid', percent: pct,
    text: `${pct}% means ${pct} out of every 100. ${pct}% of ${of} = ${formatAnswer((pct * of) / 100)}.`,
  };
}

export function explainBalance(steps: string[], text: string): Hint {
  return { type: 'balance', steps, text };
}
