import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import * as repo from '../repositories';
import { db } from '../db';
import { migrateProfile } from '../migrations';
import { insights, toCsv, topMisconception } from '@/meta/insights';
import { newSkillState, updateRating } from '@/math/adaptive/rating';
import type { Attempt } from '@/math/types';

const DAY = 86_400_000;

describe('persistence (IndexedDB via Dexie)', () => {
  it('profile + inventory + skills save → reload identical', async () => {
    const p = await repo.createProfile('Asha', 'meera', 'intermediate', false);
    const inv = await repo.loadInventory(p.id);
    expect(inv?.coins).toBe(0);
    expect(inv?.owned).toContain('aarav');
    const st = updateRating(newSkillState('add.2d.carry', 'intermediate'), 0.5, true, 2000);
    await repo.saveSkills(p.id, { 'add.2d.carry': st });
    const back = await repo.loadSkills(p.id);
    expect(back['add.2d.carry']).toEqual(st);
    const list = await repo.listProfiles();
    expect(list.find((x) => x.id === p.id)?.name).toBe('Asha');
  });

  it('batched attempt writer flushes to the store', async () => {
    const p = await repo.createProfile('Ben', 'leo', 'beginner', true);
    for (let i = 0; i < 5; i++) {
      repo.enqueueAttempt({ profileId: p.id, questionId: `q${i}`, skillId: 'add.1d', level: 1, correct: i % 2 === 0, responseMs: 2000, context: 'gate', at: Date.now() });
    }
    await repo.flushAttempts();
    const rows = await repo.attemptsSince(p.id, 0);
    expect(rows).toHaveLength(5);
  });

  it('parent PIN is stored hashed and verified', async () => {
    await repo.setPin('4321');
    const all = await db.meta.toArray();
    expect(all.some((r) => r.value.includes('4321'))).toBe(false);
    expect(await repo.checkPin('4321')).toBe(true);
    expect(await repo.checkPin('1111')).toBe(false);
  });

  it('reset child data keeps the profile, delete removes it', async () => {
    const p = await repo.createProfile('Cy', 'zoe', 'advanced', false);
    await repo.addRun({ profileId: p.id, startedAt: Date.now(), durationSec: 60, distance: 100, score: 10, coins: 1, questions: 2, correct: 1 });
    await repo.deleteProfileData(p.id, true);
    expect(await repo.runsSince(p.id, 0)).toHaveLength(0);
    expect(await db.profiles.get(p.id)).toBeTruthy();
    await repo.deleteProfileData(p.id, false);
    expect(await db.profiles.get(p.id)).toBeUndefined();
  });

  it('migrations upgrade old profiles', () => {
    const old = { id: 'x', name: 'Old', schema: 0 } as unknown as Parameters<typeof migrateProfile>[0];
    const m = migrateProfile(old);
    expect(m.schema).toBe(1);
    expect(m.focusTopics).toEqual([]);
  });
});

describe('parent insight rules (SPEC 11)', () => {
  const now = Date.UTC(2026, 10, 6, 12);
  const mk = (skillId: string, correct: boolean, daysAgo: number, ms = 3000, tag?: string): Attempt => ({
    profileId: 'p', questionId: 'q', skillId, level: 3, correct, responseMs: ms, context: 'gate', at: now - daysAgo * DAY, chosenTag: tag,
  });

  it('detects improvement, misconceptions, speed-up and low practice', () => {
    const as: Attempt[] = [
      ...Array.from({ length: 10 }, (_, i) => mk('add.2d.carry', i < 4, 10, 6000)),
      ...Array.from({ length: 10 }, (_, i) => mk('add.2d.carry', i < 8, 2, 3000, i >= 8 ? 'forgot-carry' : undefined)),
    ];
    const out = insights(as, [{ startedAt: now - DAY, durationSec: 300 }], now, 'Asha');
    expect(out.some((s) => s.startsWith('Big improvement'))).toBe(true);
    expect(out.some((s) => s.includes('forgets to carry'))).toBe(true);
    expect(out.some((s) => s.includes('getting faster'))).toBe(true);
    expect(out.some((s) => s.includes('10 minutes a day'))).toBe(true);
    expect(topMisconception(as)?.tag).toBe('forgot-carry');
  });

  it('exports CSV', () => {
    const csv = toCsv([mk('add.1d', true, 0)]);
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('add.1d');
  });
});
