import { HINT, LIVES, RHYTHM, SCORE, POWERUPS, type PowerUpType } from '@/config/tuning';
import { bus } from '@/events/bus';
import { formatAnswer } from '@/math/format';
import { recordFact, updateRating, median } from '@/math/adaptive/rating';
import { stateOf } from '@/math/adaptive/selector';
import type { Question } from '@/math/types';
import { useGame } from '@/store/gameStore';
import { hasPowerUp, type GateRow, type Runtime } from '../runtime';
import { laneAtX } from './PlayerSystem';
import { questionTiming } from './timing';
import { effectiveSpeed } from './SpawnSystem';
import { activatePowerUp } from './PowerUpSystem';

const ENCOURAGE = ['Almost! Here’s a trick…', 'Nice try! Look at this…', 'So close! Watch…', 'Good effort! Here’s how…'];

export function streakMultiplier(streak: number): number {
  for (const s of SCORE.streakSteps) if (streak >= s.at) return s.mult;
  return 1;
}

function labelsOf(q: Question): string[] {
  return q.choices.map(formatAnswer);
}

function busy(rt: Runtime): boolean {
  return rt.gates.some((g) => g.state === 'queued' || g.state === 'shown' || g.state === 'revealed') || rt.orb !== null;
}

function queueGate(rt: Runtime, g: GateRow) {
  if (!rt.session) return;
  const tunnel = g.tunnel !== undefined ? rt.tunnels.find((t) => t.id === g.tunnel) : undefined;
  if (tunnel && !tunnel.skillId) tunnel.skillId = rt.session.pickSkill();
  const picked = rt.session.question(tunnel?.skillId);
  const q = picked.question;
  const speed = effectiveSpeed(rt, g.s);
  const tm = questionTiming(q.prompt, rt.band, speed, (q.level - 1) / 9);
  let spawnDist = tm.spawnDist;
  if (tunnel) spawnDist = Math.min(spawnDist, RHYTHM.tunnelGateSpacing - 10);
  // Never show the banner before the player is past the previous gate.
  spawnDist = Math.min(spawnDist, g.s - rt.distance);
  g.question = q;
  g.pCorrect = picked.pCorrect;
  g.decideMs = (tm.readTime + tm.decideTime) * 1000;
  g.showAt = g.s - spawnDist;
  g.revealAt = g.s - spawnDist * (1 - 0.6);
  g.state = 'queued';
}

function showBanner(q: Question, mode: 'gate' | 'orb', revealed: boolean, rt: Runtime) {
  const tunnel = rt.tunnels.find((t) => t.entered && !t.done);
  useGame.getState().setBanner({
    mode, prompt: q.prompt, speech: q.speech, revealed, labels: labelsOf(q), kind: q.kind,
    tunnel: tunnel ? { answered: tunnel.answered, correct: tunnel.correct } : undefined,
  });
}

function applyAnswer(rt: Runtime, q: Question, chosen: number, responseMs: number) {
  const correct = chosen === q.answerIndex;
  const now = Date.now();
  // adaptive engine update
  if (rt.session) {
    const prev = stateOf(rt.session.states, q.skillId, rt.band);
    const fast = responseMs < (prev.recentMs.length >= 3 ? median(prev.recentMs) : 4000);
    let st = updateRating(prev, q.difficulty, correct, responseMs, now);
    st = recordFact(st, q.factKey, correct, fast, now);
    rt.session.states[q.skillId] = st;
  }
  const s = rt.stats;
  s.questions++;
  const bs = (s.bySkill[q.skillId] ??= { asked: 0, correct: 0 });
  bs.asked++;
  if (correct) {
    s.correct++;
    bs.correct++;
    if (responseMs < 1500) s.fastCorrect++;
  }
  return correct;
}

function resolveGate(rt: Runtime, g: GateRow) {
  const q = g.question!;
  const chosen = laneAtX(rt.x);
  const responseMs = performance.now() - g.shownAtMs;
  const tunnel = g.tunnel !== undefined ? rt.tunnels.find((t) => t.id === g.tunnel) : undefined;
  const context = tunnel ? 'challenge' : 'gate';
  const correct = applyAnswer(rt, q, chosen, responseMs);
  g.state = 'resolved';
  g.result = { chosen, correct };
  rt.gatesVersion++;
  const store = useGame.getState();

  if (correct) {
    rt.streak++;
    rt.stats.maxStreak = Math.max(rt.stats.maxStreak, rt.streak);
    const speedBonus = Math.max(0, SCORE.speedBonusMax * (1 - responseMs / Math.max(1, g.decideMs)));
    const dbl = hasPowerUp(rt, 'doubleAnswer') ? 2 : 1;
    const x2 = hasPowerUp(rt, 'multiplier') ? 2 : 1;
    const pts = Math.round((SCORE.correctBase + speedBonus) * streakMultiplier(rt.streak) * rt.scoreMult * dbl * x2);
    rt.score += pts;
    rt.coinsRun += SCORE.coinsPerCorrect * dbl;
    rt.punch = 1;
    const refill = rt.band === 'expert' ? LIVES.refillStreak.expert : LIVES.refillStreak.normal;
    if (!rt.learningMode && rt.streak % refill === 0 && rt.hearts < LIVES.max) {
      rt.hearts++;
      bus.emit('TOAST', { text: 'Extra heart!', icon: '❤️' });
    }
    store.flash({ kind: 'correct', text: `+${pts}` });
    if (tunnel) tunnel.correct++;
  } else {
    let lostHeart = false;
    if (rt.shieldArmed) {
      rt.shieldArmed = false;
      rt.powerups = rt.powerups.filter((p) => p.type !== 'shield');
      bus.emit('TOAST', { text: 'Shield saved you!', icon: '🛡️' });
    } else if (!rt.learningMode && !rt.godMode) {
      rt.hearts--;
      lostHeart = true;
    }
    rt.streak = 0;
    const dur = rt.band === 'expert' ? HINT.expertDurationSec : HINT.durationSec;
    rt.slowmoTimer = dur;
    store.showHint({
      hint: q.explanation, answer: `${q.prompt.replace('?', formatAnswer(q.answer))}`,
      message: ENCOURAGE[Math.floor(rt.rng.next() * ENCOURAGE.length)], duration: dur, lostHeart,
    });
    store.flash({ kind: 'wrong', text: '' });
  }
  if (tunnel) tunnel.answered++;
  bus.emit('GATE_PASSED', { question: q, chosen, correct, responseMs, context, streak: rt.streak });
  store.setBanner(null);
}

export function startOrbChallenge(rt: Runtime) {
  const speed = effectiveSpeed(rt, rt.distance);
  const nextGate = rt.gates.find((g) => g.state !== 'resolved' && g.s > rt.distance);
  const tooClose = nextGate && nextGate.s - rt.distance < RHYTHM.orbMinFromGateSec * speed;
  if (!rt.session || busy(rt) || tooClose) {
    rt.coinsRun += 5;
    bus.emit('COIN', { value: 5 });
    return;
  }
  // find a spot ~40 m ahead where all three lanes are clear
  for (let s = rt.distance + RHYTHM.orbDistance; s < rt.distance + RHYTHM.orbDistance + 30; s += 3) {
    const clear = !rt.obstacles.some((o) => o.s - 4 < s && o.s + o.len + 4 > s);
    if (!clear) continue;
    const q = rt.session.question().question;
    rt.orb = { question: q, s, shownAtMs: performance.now() };
    rt.orbs = labelsOf(q).map((label, i) => ({ s, lane: i, label, index: i, taken: false }));
    rt.gatesVersion++;
    showBanner(q, 'orb', true, rt);
    bus.emit('GATE_SHOWN', { question: q });
    return;
  }
  rt.coinsRun += 5;
}

function resolveOrb(rt: Runtime) {
  const orb = rt.orb!;
  const chosen = laneAtX(rt.x);
  const correct = applyAnswer(rt, orb.question, chosen, performance.now() - orb.shownAtMs);
  const store = useGame.getState();
  if (correct) {
    rt.stats.orbsCorrect++;
    if (rt.rng.chance(0.3)) {
      const types = Object.keys(POWERUPS) as PowerUpType[];
      const t = types[Math.floor(rt.rng.next() * types.length)];
      activatePowerUp(rt, t);
      bus.emit('TOAST', { text: POWERUPS[t].label, icon: POWERUPS[t].icon });
    } else {
      rt.coinsRun += SCORE.orbCoins;
      bus.emit('TOAST', { text: `+${SCORE.orbCoins} coins`, icon: '🪙' });
    }
    store.flash({ kind: 'correct', text: 'Orb!' });
  } else {
    store.flash({ kind: 'wrong', text: '' });
  }
  bus.emit('GATE_PASSED', { question: orb.question, chosen, correct, responseMs: 0, context: 'orb', streak: rt.streak });
  rt.orbs = [];
  rt.orb = null;
  rt.gatesVersion++;
  store.setBanner(null);
}

function tunnelUpdate(rt: Runtime) {
  for (const t of rt.tunnels) {
    if (!t.entered && rt.distance >= t.s) {
      t.entered = true;
      bus.emit('TUNNEL', { phase: 'enter' });
      bus.emit('TOAST', { text: 'Challenge Tunnel!', icon: '🌀' });
    }
    if (t.entered && !t.done && rt.distance >= t.s + t.len) {
      t.done = true;
      rt.stats.tunnelsCompleted++;
      if (t.correct === 3) {
        rt.stats.tunnelsPerfect++;
        rt.score += SCORE.tunnelPerfect * rt.scoreMult;
        rt.coinsRun += 100;
        bus.emit('TOAST', { text: 'Perfect tunnel! Big chest!', icon: '🎁' });
      } else if (t.correct === 2) {
        rt.score += SCORE.tunnelGood * rt.scoreMult;
        rt.coinsRun += 40;
        bus.emit('TOAST', { text: 'Tunnel cleared! Small chest', icon: '🎁' });
      }
      bus.emit('TUNNEL', { phase: 'exit', correct: t.correct });
    }
  }
}

export function gateUpdate(rt: Runtime) {
  tunnelUpdate(rt);
  if (rt.orb && rt.distance >= rt.orb.s) resolveOrb(rt);

  for (const g of rt.gates) {
    if (g.state === 'resolved') continue;
    if (g.state === 'pending') {
      if (g.s - rt.distance < 240 && !busy(rt)) queueGate(rt, g);
      break; // gates are handled strictly in order
    }
    if (g.state === 'queued' && rt.distance >= g.showAt) {
      g.state = 'shown';
      g.shownAtMs = performance.now();
      showBanner(g.question!, 'gate', false, rt);
      bus.emit('GATE_SHOWN', { question: g.question! });
    }
    if (g.state === 'shown' && rt.distance >= g.revealAt) {
      g.state = 'revealed';
      g.labels = labelsOf(g.question!);
      rt.gatesVersion++;
      showBanner(g.question!, 'gate', true, rt);
      bus.emit('GATE_REVEALED', { question: g.question! });
    }
    if ((g.state === 'shown' || g.state === 'revealed') && rt.distance >= g.s) {
      if (g.state === 'shown') g.labels = labelsOf(g.question!);
      resolveGate(rt, g);
    }
    break;
  }
}

/** Is a gate about to be crossed? (Learning Mode slow-mo) */
export function nearGate(rt: Runtime, within: number): boolean {
  return rt.gates.some((g) => (g.state === 'shown' || g.state === 'revealed') && g.s - rt.distance < within && g.s > rt.distance);
}
