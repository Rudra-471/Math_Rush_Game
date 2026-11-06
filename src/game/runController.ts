import { bus } from '@/events/bus';
import { useGame } from '@/store/gameStore';
import { useProfile } from '@/store/profileStore';
import * as repo from '@/data/repositories';
import { MathSession } from '@/math/adaptive/selector';
import { createRng } from '@/math/rng';
import { createRuntime, game, newStats } from './runtime';
import { initSpawner } from './systems/SpawnSystem';
import { applyRun, todayKey } from '@/meta/missions';
import { levelFromXp, levelReward, runXp, scoreMultiplier } from '@/meta/progression';
import { newlyUnlocked, ACHIEVEMENTS } from '@/meta/achievements';
import { LIVES, PLAYER } from '@/config/tuning';
import type { RunSummary } from '@/store/gameStore';

let runStartedAt = 0;
let startAccuracyToday: number | null = null;
let attemptLoggerOn = false;

function ensureAttemptLogger() {
  if (attemptLoggerOn) return;
  attemptLoggerOn = true;
  bus.on('GATE_PASSED', (e) => {
    const p = useProfile.getState().profile;
    if (!p || useGame.getState().phase === 'INTRO') return; // the intro film is not real practice
    repo.enqueueAttempt({
      profileId: p.id, questionId: e.question.id, skillId: e.question.skillId, level: e.question.level,
      correct: e.correct, chosenTag: e.correct ? undefined : e.question.distractorTags[e.chosen] || undefined,
      responseMs: Math.round(e.responseMs), context: e.context, at: Date.now(),
    });
  });
  bus.on('TOAST', (t) => useGame.getState().toast(t));
}

/** Minutes played today (for the parent's daily limit). */
export async function minutesToday(profileId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const runs = await repo.runsSince(profileId, start.getTime());
  return runs.reduce((a, r) => a + r.durationSec / 60, 0);
}

export async function startRun(): Promise<'ok' | 'limit'> {
  ensureAttemptLogger();
  const { profile, skills, inventory } = useProfile.getState();
  if (!profile) return 'ok';
  if (profile.dailyLimitMin > 0 && (await minutesToday(profile.id)) >= profile.dailyLimitMin) return 'limit';

  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const rt = createRuntime(seed, profile.band);
  rt.learningMode = profile.learningMode;
  rt.session = new MathSession(createRng(seed + 7), profile.band, structuredClone(skills), profile.focusTopics);
  rt.upgradeLevels = { ...(inventory?.upgrades ?? {}) };
  rt.scoreMult = scoreMultiplier(profile.lifetime.missionsCompleted);
  rt.hearts = LIVES.start;
  initSpawner(rt);
  game.rt = rt;
  runStartedAt = Date.now();

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  void repo.attemptsSince(profile.id, dayStart.getTime()).then((a) => {
    startAccuracyToday = a.length >= 5 ? a.filter((x) => x.correct).length / a.length : null;
  });

  const g = useGame.getState();
  g.newRun();
  g.setOverlay(null);
  countdown();
  return 'ok';
}

function countdown() {
  const g = useGame.getState();
  g.setPhase('COUNTDOWN');
  let n = 3;
  g.setCountdown(n);
  const tick = () => {
    n--;
    if (useGame.getState().phase !== 'COUNTDOWN') return;
    if (n <= 0) {
      g.setCountdown(0);
      g.setPhase('RUNNING');
    } else {
      g.setCountdown(n);
      setTimeout(tick, 650);
    }
  };
  setTimeout(tick, 650);
}

/** Called by the loop when rt.over flips. */
export function onRunOver() {
  const rt = game.rt;
  const { inventory, profile } = useProfile.getState();
  bus.emit('RUN_END');
  const summary: RunSummary = {
    score: Math.round(rt.score), distance: Math.round(rt.distance), coins: rt.coinsRun, stats: rt.stats,
    best: profile?.bestScore ?? 0, newBest: Math.round(rt.score) > (profile?.bestScore ?? 0),
    xpGained: 0, levelBefore: 1, levelAfter: 1, xpFracBefore: 0, xpFracAfter: 0, missionsCompleted: [], achievements: [],
    canRevive: !rt.revived && !rt.learningMode && (inventory?.reviveKeys ?? 0) > 0,
    durationSec: Math.round((Date.now() - runStartedAt) / 1000),
  };
  useGame.getState().setSummary(summary);
  useGame.getState().setBanner(null);
  useGame.getState().showHint(null);
  useGame.getState().setPhase('GAME_OVER');
}

export async function revive() {
  const rt = game.rt;
  await useProfile.getState().updateInventory((inv) => ({ ...inv, reviveKeys: Math.max(0, inv.reviveKeys - 1) }));
  rt.revived = true;
  rt.over = false;
  rt.hearts = Math.max(rt.hearts, 1);
  rt.invuln = 3;
  rt.stumbleFlash = 3;
  rt.y = 0;
  rt.vy = 0;
  rt.grounded = true;
  rt.slowmoTimer = 0;
  rt.obstacles = rt.obstacles.filter((o) => o.s > rt.distance + 40 || o.s + o.len < rt.distance - 2);
  void PLAYER;
  countdown();
}

export async function commitRun(): Promise<void> {
  const rt = game.rt;
  const ps = useProfile.getState();
  const profile = ps.profile;
  const g = useGame.getState();
  const summary = g.summary;
  if (!profile || !summary || !rt.session) return;
  await repo.flushAttempts();

  // adaptive skill states
  const states = rt.session.states;
  await repo.saveSkills(profile.id, states);
  ps.setSkills(structuredClone(states));

  // missions
  let missionsDone: string[] = [];
  let chestCoins = 0;
  let chestKey = false;
  if (ps.missions) {
    const { missions, completed } = applyRun(ps.missions.missions, rt.stats, rt.distance);
    missionsDone = completed;
    let chestClaimed = ps.missions.chestClaimed;
    if (!chestClaimed && missions.every((m) => m.done)) {
      chestClaimed = true;
      chestCoins = 250;
      chestKey = true;
    }
    await ps.setMissions({ ...ps.missions, missions, chestClaimed });
  }

  // lifetime + streak
  const s = rt.stats;
  const lt = { ...profile.lifetime };
  lt.runs++;
  lt.questions += s.questions;
  lt.correct += s.correct;
  lt.carryCorrect += s.bySkill['add.2d.carry']?.correct ?? 0;
  lt.fastCorrect += s.fastCorrect;
  lt.tunnelsPerfect += s.tunnelsPerfect;
  lt.missionsCompleted += missionsDone.length;
  lt.coinsEarned += rt.coinsRun + chestCoins;
  lt.bestDistance = Math.max(lt.bestDistance, rt.distance);
  lt.minutesPlayed += summary.durationSec / 60;
  const today = todayKey();
  let dailyStreak = profile.dailyStreak;
  if (chestCoins > 0 && dailyStreak.lastDate !== today) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    dailyStreak = { lastDate: today, count: dailyStreak.lastDate === todayKey(y) ? dailyStreak.count + 1 : 1 };
  }

  // XP & level
  const before = levelFromXp(profile.xp);
  const xpGained = runXp(s.correct, rt.distance, missionsDone.length);
  const after = levelFromXp(profile.xp + xpGained);
  let levelCoins = 0;
  let levelKeys = 0;
  for (let l = before.level + 1; l <= after.level; l++) {
    const r = levelReward(l);
    levelCoins += r.coins;
    if (r.reviveKey) levelKeys++;
  }

  // achievements
  const unlocked = newlyUnlocked({ lifetime: lt, run: s, distance: rt.distance, skills: states, startAccuracyToday }, ps.achievements);
  await ps.addAchievements(unlocked.map((a) => a.id));

  await ps.updateInventory((inv) => ({
    ...inv,
    coins: inv.coins + rt.coinsRun + chestCoins + levelCoins,
    reviveKeys: inv.reviveKeys + levelKeys + (chestKey ? 1 : 0),
  }));
  await ps.updateProfile({
    lifetime: lt, xp: profile.xp + xpGained, bestScore: Math.max(profile.bestScore, Math.round(rt.score)), dailyStreak,
  });
  await repo.addRun({
    profileId: profile.id, startedAt: runStartedAt, durationSec: summary.durationSec, distance: Math.round(rt.distance),
    score: Math.round(rt.score), coins: rt.coinsRun, questions: s.questions, correct: s.correct,
  });

  g.setSummary({
    ...summary, xpGained, levelBefore: before.level, levelAfter: after.level, xpFracBefore: before.frac, xpFracAfter: after.frac,
    missionsCompleted: chestCoins ? [...missionsDone, 'Daily chest: +250 coins & a Revive Key!'] : missionsDone,
    achievements: unlocked.map((a) => `${a.icon} ${a.name}`),
    coins: rt.coinsRun + levelCoins + chestCoins,
  });
  g.setPhase('REWARDS');
}

/** Quit from pause: end the run normally (progress is saved on Continue). */
export function quitRun() {
  game.rt.over = true;
  game.rt.stats = game.rt.stats ?? newStats();
  onRunOver();
}

/** Restart from pause: save what was learned, then start a fresh run. */
export async function restartRun() {
  onRunOver();
  await commitRun();
  await startRun();
}

export { ACHIEVEMENTS };
