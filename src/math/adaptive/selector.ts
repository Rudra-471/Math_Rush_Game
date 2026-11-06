import type { Band, Question, Rng } from '../types';
import { BANDS, bandIndex, SKILLS, type Skill, type Topic } from '../skills';
import { generate, factsForSkill } from '../generators';
import { placeAnswerAt } from '../build';
import { PositionBag } from '../distractors';
import { dueFacts } from './leitner';
import { levelForTarget, mastery, median, newSkillState, pCorrect, type SkillState } from './rating';

export type SkillStates = Record<string, SkillState>;

export interface SelectorInput {
  band: Band;
  states: SkillStates;
  focusTopics: Topic[];
  recent: string[]; // most recent skill ids, newest last
  now: number;
  rng: Rng;
}

export function stateOf(states: SkillStates, skillId: string, band: Band): SkillState {
  return states[skillId] ?? newSkillState(skillId, band);
}

export function isUnlocked(skill: Skill, states: SkillStates, band: Band): boolean {
  return skill.prereqs.every((p) => mastery(stateOf(states, p, band), p) >= 0.7);
}

export function bandMastery(band: Band, states: SkillStates, profileBand: Band): number {
  const list = SKILLS.filter((s) => s.band === band);
  return list.reduce((acc, s) => acc + mastery(stateOf(states, s.id, profileBand), s.id), 0) / list.length;
}

export function candidateSkills(inp: SelectorInput): Skill[] {
  const bi = bandIndex(inp.band);
  let pool = SKILLS.filter((s) => s.band === inp.band && isUnlocked(s, inp.states, inp.band));
  // Strong children climb: include the next band when this band is mostly mastered.
  const next = BANDS[bi + 1];
  if (next && bandMastery(inp.band, inp.states, inp.band) >= 0.75) {
    pool = pool.concat(SKILLS.filter((s) => s.band === next && isUnlocked(s, inp.states, inp.band)));
  }
  if (pool.length === 0) pool = SKILLS.filter((s) => s.band === inp.band && s.prereqs.length === 0);
  return pool;
}

export function skillScore(s: Skill, inp: SelectorInput): number {
  const st = stateOf(inp.states, s.id, inp.band);
  const due = dueFacts(st.facts, inp.now).length > 0 ? 1 : 0;
  const m = mastery(st, s.id);
  const newly = st.attempts === 0 ? 1 : 0;
  const focus = inp.focusTopics.includes(s.topic) ? 1 : 0;
  const recent3 = inp.recent.slice(-3).filter((r) => r === s.id).length;
  return 3 * due + 2 * (1 - m) + 1.5 * newly + 1 * focus - 2 * recent3;
}

/** SPEC 7.7 selector: softmax over weighted scores; never the same skill 3 times in a row. */
export function nextSkill(inp: SelectorInput): string {
  let cands = candidateSkills(inp);
  const [a, b] = inp.recent.slice(-2);
  if (a && a === b && cands.length > 1) cands = cands.filter((s) => s.id !== a);
  const scores = cands.map((s) => skillScore(s, inp) / 0.7);
  const mx = Math.max(...scores);
  const w = scores.map((x) => Math.exp(x - mx));
  const total = w.reduce((x, y) => x + y, 0);
  let r = inp.rng.next() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= w[i];
    if (r <= 0) return cands[i].id;
  }
  return cands[cands.length - 1].id;
}

export interface Picked {
  question: Question;
  pCorrect: number;
  decideMs: number; // median response for the skill (for speed bonus)
}

/** A per-run session: keeps recent skills + balanced answer positions. */
export class MathSession {
  readonly recent: string[] = [];
  private bag: PositionBag;
  constructor(
    private rng: Rng,
    public band: Band,
    public states: SkillStates,
    public focusTopics: Topic[] = [],
  ) {
    this.bag = new PositionBag(rng);
  }

  pickSkill(now = Date.now()): string {
    return nextSkill({ band: this.band, states: this.states, focusTopics: this.focusTopics, recent: this.recent, now, rng: this.rng });
  }

  question(skillId?: string, now = Date.now()): Picked {
    const id = skillId ?? this.pickSkill(now);
    const st = stateOf(this.states, id, this.band);
    const level = levelForTarget(st.rating, id);
    let fact: string | undefined;
    const due = dueFacts(st.facts, now);
    if (due.length && this.rng.chance(0.7)) fact = due[0];
    else if (!due.length) {
      const all = factsForSkill(id).filter((f) => !st.facts[f]);
      if (all.length && this.rng.chance(0.3)) fact = this.rng.pick(all);
    }
    let q = generate(id, level, this.rng, fact ? { fact } : undefined);
    q = placeAnswerAt(q, this.bag.next());
    this.recent.push(id);
    if (this.recent.length > 10) this.recent.shift();
    return { question: q, pCorrect: pCorrect(st.rating, q.difficulty), decideMs: median(st.recentMs) };
  }
}
