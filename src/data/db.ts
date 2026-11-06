import Dexie, { type Table } from 'dexie';
import type { Attempt, Band } from '@/math/types';
import type { Topic } from '@/math/skills';
import type { LeitnerBox } from '@/math/adaptive/leitner';
import type { PowerUpType } from '@/config/tuning';
import type { Mission } from '@/meta/missions';

export interface Lifetime {
  runs: number;
  questions: number;
  correct: number;
  carryCorrect: number;
  fastCorrect: number;
  tunnelsPerfect: number;
  missionsCompleted: number;
  coinsEarned: number;
  bestDistance: number;
  minutesPlayed: number;
}

export interface Profile {
  id: string;
  name: string;
  character: string;
  band: Band;
  learningMode: boolean;
  createdAt: number;
  focusTopics: Topic[];
  dailyLimitMin: number; // 0 = no limit
  xp: number;
  bestScore: number;
  lifetime: Lifetime;
  dailyStreak: { lastDate: string; count: number };
  schema: number;
}

export interface SkillRow {
  profileId: string;
  skillId: string;
  rating: number;
  attempts: number;
  correct: number;
  recentMs: number[];
  facts: Record<string, LeitnerBox>;
  lastAt: number;
}

export interface AttemptRow extends Attempt {
  id?: number;
}

export interface RunRow {
  id?: number;
  profileId: string;
  startedAt: number;
  durationSec: number;
  distance: number;
  score: number;
  coins: number;
  questions: number;
  correct: number;
}

export interface Inventory {
  profileId: string;
  coins: number;
  owned: string[];
  equipped: { character: string; shoes: string; board: string };
  upgrades: Partial<Record<PowerUpType, number>>;
  hoverboards: number;
  reviveKeys: number;
}

export interface MissionRow {
  profileId: string;
  date: string;
  missions: Mission[];
  chestClaimed: boolean;
}

export interface AchievementRow {
  profileId: string;
  achId: string;
  at: number;
}

export interface MetaRow {
  key: string;
  value: string;
}

export class MathRushDB extends Dexie {
  profiles!: Table<Profile, string>;
  skills!: Table<SkillRow, [string, string]>;
  attempts!: Table<AttemptRow, number>;
  runs!: Table<RunRow, number>;
  inventory!: Table<Inventory, string>;
  missions!: Table<MissionRow, [string, string]>;
  achievements!: Table<AchievementRow, [string, string]>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'mathrush') {
    super(name);
    this.version(1).stores({
      profiles: 'id, name, createdAt',
      skills: '[profileId+skillId], profileId',
      attempts: '++id, profileId, skillId, at, [profileId+at]',
      runs: '++id, profileId, startedAt, [profileId+startedAt]',
      inventory: 'profileId',
      missions: '[profileId+date], profileId',
      achievements: '[profileId+achId], profileId',
      meta: 'key',
    });
  }
}

export const db = new MathRushDB();
