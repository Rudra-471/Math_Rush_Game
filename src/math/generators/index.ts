import type { Generator, GenOptions, Question, Rng } from '../types';
import * as A from './arithmetic';
import * as F from './fractions';
import * as G from './algebra';

export const GENERATORS: Record<string, Generator> = {
  'count.objects10': A.countObjects10,
  'count.objects20': A.countObjects20,
  'cmp.numbers20': A.cmpNumbers20,
  'num.before-after': A.numBeforeAfter,
  'add.1d': A.add1d,
  'add.within20': A.addWithin20,
  'sub.within10': A.subWithin10,
  'sub.within20': A.subWithin20,
  'pattern.skip2': A.patternSkip,
  'add.2d.nocarry': A.add2dNoCarry,
  'add.2d.carry': A.add2dCarry,
  'sub.2d.noborrow': A.sub2dNoBorrow,
  'sub.2d.borrow': A.sub2dBorrow,
  'mul.table.2-5': A.mulTable2to5,
  'mul.table.6-9': A.mulTable6to9,
  'mul.table.10-12': A.mulTable10to12,
  'div.facts': A.divFacts,
  'pattern.arith': A.patternArith,
  'frac.identify': F.fracIdentify,
  'frac.compare.samedenom': F.fracCompare,
  'mental.round10': A.mentalRound10,
  'frac.equiv': F.fracEquiv,
  'frac.add.samedenom': F.fracAddSame,
  'frac.add.diffdenom': F.fracAddDiff,
  'dec.add': F.decAdd,
  'dec.compare': F.decCompare,
  'dec.numberline': F.decNumberLine,
  'pct.of.easy': F.pctOfEasy,
  'ratio.simplify': F.ratioSimplify,
  'ratio.share': F.ratioShare,
  'alg.missing-number': G.algMissing,
  'order-of-ops': G.orderOfOps,
  'estimate.product': G.estimateProduct,
  'alg.linear1': G.algLinear1,
  'alg.linear.negative': G.algLinearNeg,
  'exp.powers': G.expPowers,
  'exp.rules': G.expRules,
  'sqrt.perfect': G.sqrtPerfect,
  'sqrt.estimate': G.sqrtEstimate,
  'pct.change': G.pctChange,
  'pct.reverse': G.pctReverse,
  'int.negatives': G.intNegatives,
  'logic.sequence': G.logicSequence,
  'logic.which-is-odd': G.logicOdd,
};

export function generate(skillId: string, level: number, rng: Rng, opts?: GenOptions): Question {
  const g = GENERATORS[skillId];
  if (!g) throw new Error(`No generator for ${skillId}`);
  return g(Math.min(10, Math.max(1, Math.round(level))), rng, opts);
}

/** Fact keys a Leitner-tracked skill can produce (used to seed boxes). */
export function factsForSkill(skillId: string): string[] {
  const out: string[] = [];
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (skillId === 'add.1d') for (const a of range(1, 9)) for (const b of range(1, 9)) if (a + b <= 10) out.push(`${a}+${b}`);
  if (skillId === 'add.within20') for (const a of range(3, 9)) for (const b of range(3, 9)) if (a + b > 10) out.push(`${a}+${b}`);
  const tables: Record<string, number[]> = { 'mul.table.2-5': [2, 3, 4, 5], 'mul.table.6-9': [6, 7, 8, 9], 'mul.table.10-12': [10, 11, 12] };
  if (tables[skillId]) for (const a of tables[skillId]) for (const b of range(2, 12)) out.push(`${a}x${b}`);
  if (skillId === 'div.facts') for (const d of range(2, 9)) for (const q of range(2, 9)) out.push(`${d * q}/${d}`);
  return out;
}
