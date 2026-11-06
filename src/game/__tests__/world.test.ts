import { describe, expect, it } from 'vitest';
import { PATTERNS } from '../world/chunks';
import { validatePattern } from '../world/fairness';
import { questionTiming, speedAt } from '../systems/timing';
import { SPAWN_CLAMP, SPEED } from '@/config/tuning';
import { streakMultiplier } from '../systems/GateSystem';
import { levelFromXp, xpForLevel, scoreMultiplier } from '@/meta/progression';
import { applyRun, generateMissions } from '@/meta/missions';
import { newStats } from '../runtime';

describe('chunk fairness (every pattern has a safe path at max speed)', () => {
  for (const p of PATTERNS) {
    it(p.id, () => {
      for (const v of [9, 16, 22, 30]) {
        const r = validatePattern(p, v);
        expect(r.ok, r.reason).toBe(true);
      }
    });
  }
  it('validator rejects an impossible wall of trains', () => {
    const wall = {
      id: 'wall', difficulty: 5 as const, tags: [], length: 40,
      objects: [0, 1, 2].map((lane) => ({ type: 'train' as const, lane, z: 10, cars: 2 })),
    };
    expect(validatePattern(wall, 20).ok).toBe(false);
  });
});

describe('speed curve + question timing', () => {
  it('speed starts at vStart and levels off toward vMax', () => {
    expect(speedAt(0, 'beginner')).toBeCloseTo(SPEED.beginner.vStart);
    expect(speedAt(50000, 'expert')).toBeCloseTo(SPEED.expert.vMax, 1);
    expect(speedAt(1000, 'advanced')).toBeGreaterThan(speedAt(500, 'advanced'));
  });
  it('young children get more distance for the same prompt', () => {
    const young = questionTiming('7 + 5 = ?', 'beginner', 12, 0.3);
    const teen = questionTiming('7 + 5 = ?', 'expert', 12, 0.3);
    expect(young.spawnDist).toBeGreaterThan(teen.spawnDist);
    expect(young.readTime).toBeGreaterThan(teen.readTime);
  });
  it('spawn distance is clamped to [45, 220] m', () => {
    expect(questionTiming('1 + 1 = ?', 'expert', 1, 0).spawnDist).toBe(SPAWN_CLAMP[0]);
    expect(questionTiming('After a 20% rise it is 60. Original?', 'beginner', 60, 1).spawnDist).toBe(SPAWN_CLAMP[1]);
  });
});

describe('scoring, XP, missions', () => {
  it('streak multiplier 1→2→3→4 at 3/6/10', () => {
    expect([0, 2, 3, 5, 6, 9, 10, 25].map(streakMultiplier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it('xp curve and levels', () => {
    expect(xpForLevel(1)).toBe(200);
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(200).level).toBe(2);
    expect(scoreMultiplier(100)).toBe(3);
  });
  it('missions are deterministic per profile+date and complete from run stats', () => {
    const a = generateMissions('p1', '2026-11-06', 'add.2d.carry');
    const b = generateMissions('p1', '2026-11-06', 'add.2d.carry');
    expect(a).toEqual(b);
    expect(a[0].skillId).toBe('add.2d.carry');
    const s = newStats();
    s.bySkill['add.2d.carry'] = { asked: 10, correct: 10 };
    s.coins = 1000; s.maxCleanDistance = 5000; s.maxStreak = 20; s.questions = 20; s.correct = 20; s.tunnelsCompleted = 5;
    const r = applyRun(a, s, 5000);
    expect(r.missions.every((m) => m.done)).toBe(true);
    expect(r.completed).toHaveLength(3);
  });
});
