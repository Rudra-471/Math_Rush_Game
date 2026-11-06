import { createRng, hashString } from '@/math/rng';
import { getSkill } from '@/math/skills';
import type { RunStats } from '@/game/runtime';

export type MissionType = 'skillCorrect' | 'accuracy' | 'tunnels' | 'coins' | 'cleanRun' | 'streak' | 'distance';

export interface Mission {
  id: string;
  type: MissionType;
  target: number;
  progress: number;
  skillId?: string;
  done: boolean;
  text: string;
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 3 missions/day, seeded by profileId+date: one weak-skill, one gameplay, one mixed (SPEC 10.2). */
export function generateMissions(profileId: string, date: string, weakestSkill: string): Mission[] {
  const rng = createRng(hashString(`${profileId}:${date}`));
  const skillName = getSkill(weakestSkill).name.toLowerCase();
  const n = rng.int(3, 6);
  const weak: Mission = {
    id: 'm1', type: 'skillCorrect', skillId: weakestSkill, target: n, progress: 0, done: false,
    text: `Answer ${n} ${skillName} questions correctly`,
  };
  const gameplayOpts: Mission[] = [
    { id: 'm2', type: 'coins', target: rng.pick([150, 250, 400]), progress: 0, done: false, text: '' },
    { id: 'm2', type: 'cleanRun', target: rng.pick([300, 500, 800]), progress: 0, done: false, text: '' },
    { id: 'm2', type: 'distance', target: rng.pick([800, 1200, 2000]), progress: 0, done: false, text: '' },
  ];
  const mixedOpts: Mission[] = [
    { id: 'm3', type: 'streak', target: rng.pick([4, 6, 8]), progress: 0, done: false, text: '' },
    { id: 'm3', type: 'accuracy', target: rng.pick([70, 80, 90]), progress: 0, done: false, text: '' },
    { id: 'm3', type: 'tunnels', target: rng.pick([1, 2]), progress: 0, done: false, text: '' },
  ];
  const g = rng.pick(gameplayOpts);
  const m = rng.pick(mixedOpts);
  return [weak, { ...g, text: missionText(g) }, { ...m, text: missionText(m) }];
}

function missionText(m: Mission): string {
  switch (m.type) {
    case 'coins': return `Collect ${m.target} coins (total today)`;
    case 'cleanRun': return `Run ${m.target} m without stumbling`;
    case 'distance': return `Run ${m.target} m in one run`;
    case 'streak': return `Get a streak of ${m.target} correct answers`;
    case 'accuracy': return `Reach ${m.target}% accuracy in one run (min 10 questions)`;
    case 'tunnels': return `Complete ${m.target} Challenge Tunnel${m.target > 1 ? 's' : ''} (total today)`;
    default: return m.text;
  }
}

/** Apply one finished run; returns updated missions and the ids that just completed. */
export function applyRun(missions: Mission[], s: RunStats, distance: number): { missions: Mission[]; completed: string[] } {
  const completed: string[] = [];
  const out = missions.map((m) => {
    if (m.done) return m;
    let progress = m.progress;
    switch (m.type) {
      case 'skillCorrect': progress += s.bySkill[m.skillId!]?.correct ?? 0; break;
      case 'coins': progress += s.coins; break;
      case 'tunnels': progress += s.tunnelsCompleted; break;
      case 'cleanRun': progress = Math.max(progress, Math.floor(s.maxCleanDistance)); break;
      case 'distance': progress = Math.max(progress, Math.floor(distance)); break;
      case 'streak': progress = Math.max(progress, s.maxStreak); break;
      case 'accuracy':
        if (s.questions >= 10) progress = Math.max(progress, Math.round((100 * s.correct) / s.questions));
        break;
    }
    const done = progress >= m.target;
    if (done) completed.push(m.text);
    return { ...m, progress: Math.min(progress, m.target), done };
  });
  return { missions: out, completed };
}
