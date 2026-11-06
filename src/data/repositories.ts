import { db, type AttemptRow, type Inventory, type Lifetime, type MissionRow, type Profile, type RunRow, type SkillRow } from './db';
import type { SkillStates } from '@/math/adaptive/selector';
import type { Band } from '@/math/types';
import { STARTER_OWNED } from '@/meta/shop';
import { migrateProfile, CURRENT_SCHEMA } from './migrations';

export const MAX_PROFILES = 4;

export const emptyLifetime = (): Lifetime => ({
  runs: 0, questions: 0, correct: 0, carryCorrect: 0, fastCorrect: 0, tunnelsPerfect: 0,
  missionsCompleted: 0, coinsEarned: 0, bestDistance: 0, minutesPlayed: 0,
});

function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

// ---------- profiles ----------
export async function listProfiles(): Promise<Profile[]> {
  const ps = await db.profiles.orderBy('createdAt').toArray();
  return ps.map(migrateProfile);
}

export async function createProfile(name: string, character: string, band: Band, learningMode: boolean): Promise<Profile> {
  const p: Profile = {
    id: uid(), name: name.trim().slice(0, 16) || 'Player', character, band, learningMode, createdAt: Date.now(),
    focusTopics: [], dailyLimitMin: 0, xp: 0, bestScore: 0, lifetime: emptyLifetime(),
    dailyStreak: { lastDate: '', count: 0 }, schema: CURRENT_SCHEMA,
  };
  await db.transaction('rw', db.profiles, db.inventory, async () => {
    await db.profiles.put(p);
    await db.inventory.put({
      profileId: p.id, coins: 0, owned: [...STARTER_OWNED],
      equipped: { character, shoes: 'trail-none', board: 'board-classic' },
      upgrades: {}, hoverboards: 1, reviveKeys: 1,
    });
  });
  return p;
}

export const saveProfile = (p: Profile) => db.profiles.put(p);

export async function deleteProfileData(profileId: string, keepProfile: boolean) {
  await db.transaction('rw', [db.profiles, db.skills, db.attempts, db.runs, db.inventory, db.missions, db.achievements], async () => {
    await db.skills.where('profileId').equals(profileId).delete();
    await db.attempts.where('profileId').equals(profileId).delete();
    await db.runs.where('profileId').equals(profileId).delete();
    await db.missions.where('profileId').equals(profileId).delete();
    await db.achievements.where('profileId').equals(profileId).delete();
    if (!keepProfile) {
      await db.inventory.delete(profileId);
      await db.profiles.delete(profileId);
    }
  });
}

// ---------- skills ----------
export async function loadSkills(profileId: string): Promise<SkillStates> {
  const rows = await db.skills.where('profileId').equals(profileId).toArray();
  return Object.fromEntries(
    rows.map((r) => {
      const st = { ...r } as Partial<SkillRow>;
      delete st.profileId;
      return [r.skillId, st as Omit<SkillRow, 'profileId'>];
    }),
  );
}

export async function saveSkills(profileId: string, states: SkillStates) {
  const rows: SkillRow[] = Object.values(states).map((s) => ({ ...s, profileId }));
  await db.skills.bulkPut(rows);
}

// ---------- attempts (batched writer: flush every 2 s or at run end) ----------
let queue: AttemptRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function enqueueAttempt(a: AttemptRow) {
  queue.push(a);
  if (!timer) timer = setTimeout(() => void flushAttempts(), 2000);
}

export async function flushAttempts() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  await db.attempts.bulkAdd(batch);
}

export async function attemptsSince(profileId: string, since: number): Promise<AttemptRow[]> {
  return db.attempts.where('[profileId+at]').between([profileId, since], [profileId, Infinity]).toArray();
}

/** Keep raw attempts for 180 days (runs table keeps the daily aggregates). */
export async function pruneAttempts() {
  const cutoff = Date.now() - 180 * 86_400_000;
  await db.attempts.where('at').below(cutoff).delete();
}

// ---------- runs ----------
export const addRun = (r: RunRow) => db.runs.add(r);
export async function runsSince(profileId: string, since: number): Promise<RunRow[]> {
  return db.runs.where('[profileId+startedAt]').between([profileId, since], [profileId, Infinity]).toArray();
}

// ---------- inventory ----------
export const loadInventory = (profileId: string) => db.inventory.get(profileId) as Promise<Inventory | undefined>;
export const saveInventory = (inv: Inventory) => db.inventory.put(inv);

// ---------- missions ----------
export const loadMissions = (profileId: string, date: string) => db.missions.get([profileId, date]);
export const saveMissions = (row: MissionRow) => db.missions.put(row);

// ---------- achievements ----------
export async function loadAchievements(profileId: string): Promise<Set<string>> {
  const rows = await db.achievements.where('profileId').equals(profileId).toArray();
  return new Set(rows.map((r) => r.achId));
}
export const addAchievements = (profileId: string, ids: string[]) =>
  db.achievements.bulkPut(ids.map((achId) => ({ profileId, achId, at: Date.now() })));

// ---------- parent PIN (salted SHA-256 via Web Crypto) ----------
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hasPin(): Promise<boolean> {
  return !!(await db.meta.get('pinHash'));
}

export async function setPin(pin: string) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
  await db.meta.bulkPut([
    { key: 'pinSalt', value: salt },
    { key: 'pinHash', value: await sha256(`${salt}:${pin}`) },
  ]);
}

export async function checkPin(pin: string): Promise<boolean> {
  const salt = await db.meta.get('pinSalt');
  const hash = await db.meta.get('pinHash');
  if (!salt || !hash) return false;
  return (await sha256(`${salt.value}:${pin}`)) === hash.value;
}
