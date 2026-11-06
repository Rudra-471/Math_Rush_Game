import type { Attempt } from '@/math/types';
import { getSkill, SKILL_MAP, TOPIC_LABEL, type Topic } from '@/math/skills';
import { TAG_TEXT } from '@/math/distractors';
import { median } from '@/math/adaptive/rating';

const DAY = 86_400_000;

export interface RunLite {
  startedAt: number;
  durationSec: number;
}

export function accuracy(as: Attempt[]): number | null {
  return as.length ? as.filter((a) => a.correct).length / as.length : null;
}

export function between(as: Attempt[], from: number, to: number): Attempt[] {
  return as.filter((a) => a.at >= from && a.at < to);
}

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Per-day accuracy and median speed for the last `days` days (oldest first). */
export function dailySeries(as: Attempt[], now: number, days = 30) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const out: Array<{ day: string; accuracy: number | null; medianSec: number | null; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const from = start.getTime() - i * DAY;
    const sl = between(as, from, from + DAY);
    const acc = accuracy(sl);
    out.push({
      day: dayKey(from),
      accuracy: acc === null ? null : Math.round(acc * 100),
      medianSec: sl.length ? Math.round(median(sl.map((a) => a.responseMs)) / 100) / 10 : null,
      count: sl.length,
    });
  }
  return out;
}

export function topicOf(skillId: string): Topic {
  return SKILL_MAP[skillId]?.topic ?? 'counting';
}

/** Most common misconception tag among wrong answers (with share). */
export function topMisconception(as: Attempt[]): { tag: string; share: number } | null {
  const wrong = as.filter((a) => !a.correct && a.chosenTag);
  if (!wrong.length) return null;
  const counts = new Map<string, number>();
  for (const a of wrong) counts.set(a.chosenTag!, (counts.get(a.chosenTag!) ?? 0) + 1);
  const [tag, n] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  return { tag, share: n / as.filter((a) => !a.correct).length };
}

/** SPEC 11 insight rules — plain-English sentences, no AI needed. */
export function insights(as: Attempt[], runs: RunLite[], now: number, childName = 'Your child'): string[] {
  const out: string[] = [];
  const last7 = between(as, now - 7 * DAY, now + 1);
  const prev7 = between(as, now - 14 * DAY, now - 7 * DAY);
  const skills = [...new Set(last7.map((a) => a.skillId))];
  for (const s of skills) {
    const a1 = accuracy(last7.filter((a) => a.skillId === s));
    const a0 = accuracy(prev7.filter((a) => a.skillId === s));
    if (a1 !== null && a0 !== null && a1 - a0 >= 0.1) out.push(`Big improvement in ${getSkill(s).name.toLowerCase()}! 🎉`);
  }
  for (const s of skills) {
    const sa = last7.filter((a) => a.skillId === s);
    const m = topMisconception(sa);
    if (m && m.share >= 0.3 && sa.filter((a) => !a.correct).length >= 2) {
      out.push(`${childName} ${TAG_TEXT[m.tag] ?? m.tag}. Try practising ${getSkill(s).name.toLowerCase()} together.`);
    }
  }
  const topics = [...new Set(last7.map((a) => topicOf(a.skillId)))];
  for (const t of topics) {
    const r1 = last7.filter((a) => topicOf(a.skillId) === t).map((a) => a.responseMs);
    const r0 = prev7.filter((a) => topicOf(a.skillId) === t).map((a) => a.responseMs);
    if (r1.length >= 3 && r0.length >= 3 && median(r1) <= median(r0) * 0.8) {
      out.push(`Answers are getting faster in ${TOPIC_LABEL[t].toLowerCase()}. ⚡`);
    }
  }
  const minutes7 = runs.filter((r) => r.startedAt >= now - 7 * DAY).reduce((x, r) => x + r.durationSec / 60, 0);
  if (minutes7 < 30) out.push('Short practice daily works best — try 10 minutes a day.');
  return out;
}

export function toCsv(as: Attempt[]): string {
  const head = 'date,skill,level,correct,response_ms,context,misconception';
  const rows = as.map((a) =>
    [new Date(a.at).toISOString(), a.skillId, a.level, a.correct ? 1 : 0, a.responseMs, a.context, a.chosenTag ?? ''].join(','),
  );
  return [head, ...rows].join('\n');
}
