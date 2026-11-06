import type { Band, GateKind } from './types';

export type Topic =
  | 'counting'
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'patterns'
  | 'fractions'
  | 'decimals'
  | 'percent'
  | 'ratio'
  | 'algebra'
  | 'powers'
  | 'logic';

export interface Skill {
  id: string;
  name: string; // parent-friendly
  band: Band;
  topic: Topic;
  prereqs: string[];
  base: number; // Elo difficulty at level 1
  kind: GateKind; // default gate kind
  facts?: boolean; // tracked with Leitner boxes
}

export const BANDS: Band[] = ['beginner', 'intermediate', 'advanced', 'expert'];
export const BAND_INFO: Record<Band, { label: string; ages: string; emoji: string }> = {
  beginner: { label: 'Beginner', ages: '5–7', emoji: '🐣' },
  intermediate: { label: 'Intermediate', ages: '8–10', emoji: '🚀' },
  advanced: { label: 'Advanced', ages: '11–13', emoji: '⚡' },
  expert: { label: 'Expert', ages: '14+', emoji: '🧠' },
};

/** Difficulty step per level inside a skill (Elo units). */
export const LEVEL_STEP = 0.3;

const S = (
  id: string,
  name: string,
  band: Band,
  topic: Topic,
  base: number,
  prereqs: string[] = [],
  kind: GateKind = 'choice3',
  facts = false,
): Skill => ({ id, name, band, topic, base, prereqs, kind, facts });

export const SKILLS: Skill[] = [
  // Beginner 5–7
  S('count.objects10', 'Counting to 10', 'beginner', 'counting', -2.0),
  S('count.objects20', 'Counting to 20', 'beginner', 'counting', -1.6, ['count.objects10']),
  S('cmp.numbers20', 'Comparing numbers to 20', 'beginner', 'counting', -1.6, [], 'compare'),
  S('num.before-after', 'Number before / after', 'beginner', 'counting', -1.8),
  S('add.1d', 'Adding single digits', 'beginner', 'addition', -1.6, [], 'choice3', true),
  S('add.within20', 'Adding within 20', 'beginner', 'addition', -1.2, ['add.1d'], 'choice3', true),
  S('sub.within10', 'Subtracting within 10', 'beginner', 'subtraction', -1.4),
  S('sub.within20', 'Subtracting within 20', 'beginner', 'subtraction', -1.0, ['sub.within10']),
  S('pattern.skip2', 'Counting in 2s, 5s, 10s', 'beginner', 'patterns', -1.2),
  // Intermediate 8–10
  S('add.2d.nocarry', '2-digit adding (no carry)', 'intermediate', 'addition', -0.4, ['add.within20']),
  S('add.2d.carry', '2-digit adding with carrying', 'intermediate', 'addition', 0.2, ['add.2d.nocarry']),
  S('sub.2d.noborrow', '2-digit subtracting (no borrow)', 'intermediate', 'subtraction', -0.3, ['sub.within20']),
  S('sub.2d.borrow', '2-digit subtracting with borrowing', 'intermediate', 'subtraction', 0.4, ['sub.2d.noborrow']),
  S('mul.table.2-5', 'Times tables 2–5', 'intermediate', 'multiplication', -0.3, [], 'choice3', true),
  S('mul.table.6-9', 'Times tables 6–9', 'intermediate', 'multiplication', 0.4, ['mul.table.2-5'], 'choice3', true),
  S('mul.table.10-12', 'Times tables 10–12', 'intermediate', 'multiplication', 0.5, ['mul.table.2-5'], 'choice3', true),
  S('div.facts', 'Division facts', 'intermediate', 'division', 0.6, ['mul.table.2-5'], 'missing', true),
  S('pattern.arith', 'Number patterns', 'intermediate', 'patterns', 0.2, ['pattern.skip2']),
  S('frac.identify', 'Naming fractions', 'intermediate', 'fractions', 0.0),
  S('frac.compare.samedenom', 'Comparing fractions', 'intermediate', 'fractions', 0.3, ['frac.identify'], 'compare'),
  S('mental.round10', 'Rounding to 10 / 100', 'intermediate', 'patterns', 0.1),
  // Advanced 11–13
  S('frac.equiv', 'Equivalent fractions', 'advanced', 'fractions', 1.2, ['frac.identify']),
  S('frac.add.samedenom', 'Adding fractions (same bottom)', 'advanced', 'fractions', 1.2, ['frac.identify']),
  S('frac.add.diffdenom', 'Adding fractions (different bottoms)', 'advanced', 'fractions', 2.0, ['frac.add.samedenom', 'frac.equiv']),
  S('dec.add', 'Adding decimals', 'advanced', 'decimals', 1.4, ['add.2d.carry']),
  S('dec.compare', 'Comparing decimals', 'advanced', 'decimals', 1.2, [], 'compare'),
  S('dec.numberline', 'Decimals on a number line', 'advanced', 'decimals', 1.3, [], 'numberLine'),
  S('pct.of.easy', 'Percent of (10/25/50%)', 'advanced', 'percent', 1.5, ['frac.identify']),
  S('ratio.simplify', 'Simplifying ratios', 'advanced', 'ratio', 1.8, ['frac.equiv']),
  S('ratio.share', 'Sharing in a ratio', 'advanced', 'ratio', 2.2, ['ratio.simplify']),
  S('alg.missing-number', 'Missing numbers', 'advanced', 'algebra', 1.3, ['div.facts'], 'missing'),
  S('order-of-ops', 'Order of operations', 'advanced', 'algebra', 1.8, ['mul.table.6-9']),
  S('estimate.product', 'Estimating products', 'advanced', 'logic', 1.6, ['mul.table.6-9'], 'estimate'),
  // Expert 14+
  S('alg.linear1', 'Solving ax + b = c', 'expert', 'algebra', 2.6, ['alg.missing-number']),
  S('alg.linear.negative', 'Equations with negatives', 'expert', 'algebra', 3.2, ['alg.linear1', 'int.negatives']),
  S('exp.powers', 'Powers', 'expert', 'powers', 2.6, ['mul.table.6-9']),
  S('exp.rules', 'Rules of indices', 'expert', 'powers', 3.2, ['exp.powers']),
  S('sqrt.perfect', 'Square roots', 'expert', 'powers', 2.4, ['mul.table.10-12']),
  S('sqrt.estimate', 'Estimating square roots', 'expert', 'powers', 3.0, ['sqrt.perfect']),
  S('pct.change', 'Percent increase / decrease', 'expert', 'percent', 3.0, ['pct.of.easy']),
  S('pct.reverse', 'Reverse percentages', 'expert', 'percent', 3.6, ['pct.change']),
  S('int.negatives', 'Negative numbers', 'expert', 'algebra', 2.4),
  S('logic.sequence', 'Sequences', 'expert', 'logic', 2.6, ['pattern.arith']),
  S('logic.which-is-odd', 'Odd one out', 'expert', 'logic', 2.4),
];

export const SKILL_MAP: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): Skill {
  const s = SKILL_MAP[id];
  if (!s) throw new Error(`Unknown skill ${id}`);
  return s;
}

export function skillsInBand(band: Band): Skill[] {
  return SKILLS.filter((s) => s.band === band);
}

export function bandIndex(b: Band): number {
  return BANDS.indexOf(b);
}

/** Elo difficulty of a level inside a skill. */
export function levelDifficulty(skillId: string, level: number): number {
  return getSkill(skillId).base + LEVEL_STEP * (level - 1);
}

export const TOPIC_LABEL: Record<Topic, string> = {
  counting: 'Counting',
  addition: 'Addition +',
  subtraction: 'Subtraction −',
  multiplication: 'Multiplication ×',
  division: 'Division ÷',
  patterns: 'Patterns',
  fractions: 'Fractions',
  decimals: 'Decimals',
  percent: 'Percent %',
  ratio: 'Ratio',
  algebra: 'Algebra',
  powers: 'Powers & roots',
  logic: 'Logic & estimation',
};
