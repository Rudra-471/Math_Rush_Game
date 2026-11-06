import type { Lifetime } from '@/data/db';
import type { RunStats } from '@/game/runtime';
import { mastery } from '@/math/adaptive/rating';
import { SKILLS } from '@/math/skills';
import type { SkillStates } from '@/math/adaptive/selector';

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  check: (c: AchContext) => boolean;
}

export interface AchContext {
  lifetime: Lifetime;
  run: RunStats;
  distance: number;
  skills: SkillStates;
  startAccuracyToday: number | null; // accuracy before this run today
}

const m = (states: SkillStates, id: string) => mastery(states[id], id);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-run', name: 'First Steps', icon: '👟', desc: 'Finish your first run', check: (c) => c.lifetime.runs >= 1 },
  { id: 'first-gate', name: 'Gatekeeper', icon: '🚪', desc: 'Answer your first gate correctly', check: (c) => c.lifetime.correct >= 1 },
  { id: 'table-master-7', name: 'Table Master ×7', icon: '7️⃣', desc: '×7 table mastery ≥ 0.9', check: (c) => m(c.skills, 'mul.table.6-9') >= 0.9 },
  { id: 'carry-champion', name: 'Carry Champion', icon: '🏋️', desc: '50 correct 2-digit additions with carrying', check: (c) => c.lifetime.carryCorrect >= 50 },
  { id: 'lightning-brain', name: 'Lightning Brain', icon: '⚡', desc: '10 correct answers each under 1.5 s', check: (c) => c.lifetime.fastCorrect >= 10 },
  { id: 'perfect-tunnel-10', name: 'Perfect Tunnel ×10', icon: '🌀', desc: '10 Challenge Tunnels with 3/3', check: (c) => c.lifetime.tunnelsPerfect >= 10 },
  { id: 'marathon', name: 'Marathon', icon: '🏃', desc: 'Run 5 km in a single run', check: (c) => c.distance >= 5000 },
  {
    id: 'comeback-kid', name: 'Comeback Kid', icon: '💪', desc: 'Finish a run with 30+ correct after starting the day below 60% accuracy',
    check: (c) => c.run.correct >= 30 && c.startAccuracyToday !== null && c.startAccuracyToday < 0.6,
  },
  {
    id: 'fraction-explorer', name: 'Fraction Explorer', icon: '🍕', desc: 'Unlock every fraction skill',
    check: (c) => SKILLS.filter((s) => s.topic === 'fractions').every((s) => s.prereqs.every((p) => m(c.skills, p) >= 0.7)),
  },
  { id: 'streak-10', name: 'On Fire', icon: '🔥', desc: 'Get a 10-answer streak', check: (c) => c.run.maxStreak >= 10 },
  { id: 'coins-1000', name: 'Coin Collector', icon: '🪙', desc: 'Earn 1,000 coins in total', check: (c) => c.lifetime.coinsEarned >= 1000 },
  { id: 'km-1', name: 'One Kilometre', icon: '🛤️', desc: 'Run 1 km in a single run', check: (c) => c.distance >= 1000 },
];

export function newlyUnlocked(ctx: AchContext, have: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(ctx));
}
