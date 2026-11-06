import { create } from 'zustand';
import type { Inventory, MissionRow, Profile } from '@/data/db';
import * as repo from '@/data/repositories';
import type { SkillStates } from '@/math/adaptive/selector';
import { mastery } from '@/math/adaptive/rating';
import { SKILLS } from '@/math/skills';
import { generateMissions, todayKey } from '@/meta/missions';
import type { Band } from '@/math/types';

interface ProfileStore {
  loaded: boolean;
  profiles: Profile[];
  profile: Profile | null;
  inventory: Inventory | null;
  skills: SkillStates;
  missions: MissionRow | null;
  achievements: Set<string>;
  sessionStartedAt: number;
  load: () => Promise<void>;
  create: (name: string, character: string, band: Band, learning: boolean) => Promise<void>;
  select: (id: string) => Promise<void>;
  updateProfile: (p: Partial<Profile>) => Promise<void>;
  updateInventory: (fn: (inv: Inventory) => Inventory) => Promise<void>;
  setSkills: (s: SkillStates) => void;
  setMissions: (m: MissionRow) => Promise<void>;
  addAchievements: (ids: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  resetData: (id: string) => Promise<void>;
  logout: () => void;
}

/** Weakest unlocked skill in the child's band (for the daily weak-skill mission). */
export function weakestSkill(band: Band, states: SkillStates): string {
  const inBand = SKILLS.filter((s) => s.band === band && s.prereqs.every((p) => mastery(states[p], p) >= 0.7 || !states[p]));
  const list = inBand.length ? inBand : SKILLS.filter((s) => s.band === band);
  const tried = list.filter((s) => states[s.id]);
  const pool = tried.length ? tried : list.filter((s) => s.prereqs.length === 0);
  return [...pool].sort((a, b) => mastery(states[a.id], a.id) - mastery(states[b.id], b.id))[0]?.id ?? list[0].id;
}

async function ensureMissions(p: Profile, skills: SkillStates): Promise<MissionRow> {
  const date = todayKey();
  const existing = await repo.loadMissions(p.id, date);
  if (existing) return existing;
  const row: MissionRow = { profileId: p.id, date, missions: generateMissions(p.id, date, weakestSkill(p.band, skills)), chestClaimed: false };
  await repo.saveMissions(row);
  return row;
}

export const useProfile = create<ProfileStore>((set, get) => ({
  loaded: false,
  profiles: [],
  profile: null,
  inventory: null,
  skills: {},
  missions: null,
  achievements: new Set(),
  sessionStartedAt: Date.now(),
  load: async () => {
    const profiles = await repo.listProfiles();
    set({ profiles, loaded: true });
    void repo.pruneAttempts();
  },
  create: async (name, character, band, learning) => {
    const p = await repo.createProfile(name, character, band, learning);
    set({ profiles: [...get().profiles, p] });
    await get().select(p.id);
  },
  select: async (id) => {
    const p = get().profiles.find((x) => x.id === id);
    if (!p) return;
    const [inventory, skills, achievements] = await Promise.all([repo.loadInventory(id), repo.loadSkills(id), repo.loadAchievements(id)]);
    const missions = await ensureMissions(p, skills);
    set({ profile: p, inventory: inventory ?? null, skills, missions, achievements, sessionStartedAt: Date.now() });
  },
  updateProfile: async (patch) => {
    const p = get().profile;
    if (!p) return;
    const next = { ...p, ...patch };
    await repo.saveProfile(next);
    set({ profile: next, profiles: get().profiles.map((x) => (x.id === next.id ? next : x)) });
  },
  updateInventory: async (fn) => {
    const inv = get().inventory;
    if (!inv) return;
    const next = fn(structuredClone(inv));
    await repo.saveInventory(next);
    set({ inventory: next });
  },
  setSkills: (skills) => set({ skills }),
  setMissions: async (m) => {
    await repo.saveMissions(m);
    set({ missions: m });
  },
  addAchievements: async (ids) => {
    const p = get().profile;
    if (!p || !ids.length) return;
    await repo.addAchievements(p.id, ids);
    set({ achievements: new Set([...get().achievements, ...ids]) });
  },
  remove: async (id) => {
    await repo.deleteProfileData(id, false);
    set({ profiles: get().profiles.filter((p) => p.id !== id), ...(get().profile?.id === id ? { profile: null } : {}) });
  },
  resetData: async (id) => {
    await repo.deleteProfileData(id, true);
    const p = get().profiles.find((x) => x.id === id);
    if (p) {
      const fresh = { ...p, xp: 0, bestScore: 0, lifetime: repo.emptyLifetime(), dailyStreak: { lastDate: '', count: 0 } };
      await repo.saveProfile(fresh);
      set({ profiles: get().profiles.map((x) => (x.id === id ? fresh : x)) });
      if (get().profile?.id === id) await get().select(id);
    }
  },
  logout: () => set({ profile: null, inventory: null, skills: {}, missions: null, achievements: new Set() }),
}));
