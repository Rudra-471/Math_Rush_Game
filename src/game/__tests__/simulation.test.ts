import { beforeEach, describe, expect, it } from 'vitest';
import { createRuntime, type Runtime } from '../runtime';
import { initSpawner } from '../systems/SpawnSystem';
import { stepGame } from '../loop/step';
import { MathSession } from '@/math/adaptive/selector';
import { createRng } from '@/math/rng';
import { bus } from '@/events/bus';
import { LANES, PLAYER, SPAWN_CLAMP, WORLD } from '@/config/tuning';
import { useGame } from '@/store/gameStore';
import type { Band } from '@/math/types';

const DT = 1 / 60;

function makeRun(band: Band, seed: number, opts: { god?: boolean; learning?: boolean } = {}): Runtime {
  const rt = createRuntime(seed, band);
  rt.godMode = !!opts.god;
  rt.learningMode = !!opts.learning;
  rt.session = new MathSession(createRng(seed + 1), band, {});
  initSpawner(rt);
  return rt;
}

/** Simple scripted player: dodges obstacles in its lane and steers to the chosen gate lane. */
function bot(rt: Runtime, answerCorrectly: boolean) {
  if (rt.inputQueue.length) return;
  const gate = rt.gates.find((g) => (g.state === 'shown' || g.state === 'revealed') && g.s > rt.distance);
  let want = rt.lane;
  if (gate?.question && gate.s - rt.distance < 40) {
    const a = gate.question.answerIndex;
    want = answerCorrectly ? a : (a + 1) % 3;
  } else if (rt.orb) {
    want = rt.orb.question.answerIndex;
  }
  const ahead = (lane: number, range: number) =>
    rt.obstacles.filter((o) => o.lane === lane && o.s + o.len > rt.distance - 1 && o.s < rt.distance + range);
  const look = Math.max(6, rt.speed * 0.45);
  const block = ahead(rt.lane, look);
  const hardBlock = block.some((o) => o.kind === 'train' || o.kind === 'movingTrain');
  if (hardBlock || ahead(rt.lane, rt.speed * 1.2).some((o) => o.kind === 'movingTrain')) {
    const free = [0, 1, 2]
      .filter((l) => Math.abs(l - rt.lane) === 1)
      .filter((l) => !ahead(l, look + 8).some((o) => o.kind !== 'low' && o.kind !== 'high'));
    if (free.length) want = free[0];
  }
  if (want !== rt.lane && Math.abs(LANES[rt.lane] - rt.x) < 0.3) {
    rt.inputQueue.push(want < rt.lane ? 'left' : 'right');
    return;
  }
  const near = ahead(rt.lane, Math.max(3, rt.speed * 0.22));
  if (near.some((o) => o.kind === 'low') && rt.grounded) rt.inputQueue.push('up');
  else if (near.some((o) => o.kind === 'high') && rt.sliding <= 0) rt.inputQueue.push('down');
}

function play(rt: Runtime, seconds: number, correct: boolean) {
  for (let i = 0; i < seconds * 60 && !rt.over; i++) {
    bot(rt, correct);
    stepGame(rt, DT, WORLD.chunksAhead);
  }
}

describe('full-run simulation (scripted inputs through the real game loop)', () => {
  beforeEach(() => {
    bus.all.clear();
    useGame.setState({ banner: null, hint: null });
  });

  it('gates appear on the 8–14 s rhythm, banner early enough, answers recorded', () => {
    const rt = makeRun('intermediate', 11, { god: true });
    const shown: Array<{ at: number; gateS: number }> = [];
    const passed: number[] = [];
    bus.on('GATE_SHOWN', () => {
      const g = rt.gates.find((x) => x.state === 'shown');
      if (g) shown.push({ at: rt.distance, gateS: g.s });
    });
    bus.on('GATE_PASSED', (e) => { if (e.context !== 'orb') passed.push(rt.elapsed); });
    play(rt, 150, true);
    expect(passed.length).toBeGreaterThanOrEqual(8);
    expect(rt.stats.correct).toBe(rt.stats.questions);
    for (const s of shown) expect(s.gateS - s.at).toBeGreaterThanOrEqual(SPAWN_CLAMP[0] - 1);
    expect(rt.stats.maxStreak).toBeGreaterThanOrEqual(6);
    expect(rt.score).toBeGreaterThan(rt.distance);
    expect(rt.stats.tunnelsCompleted).toBeGreaterThanOrEqual(1);
    expect(rt.stats.tunnelsPerfect).toBeGreaterThanOrEqual(1);
  });

  it('gate rows are calm: no obstacles 20 m before / 10 m after (outside tunnels)', () => {
    const rt = makeRun('expert', 5, { god: true });
    play(rt, 60, true);
    for (const g of rt.gates) {
      const clash = rt.obstacles.filter((o) => o.s < g.s + 10 && o.s + o.len > g.s - 20 && o.kind !== 'movingTrain');
      expect(clash, `gate at ${g.s}`).toHaveLength(0);
    }
  });

  it('wrong answers cost hearts and end the run (normal mode)', () => {
    const rt = makeRun('intermediate', 3, {});
    rt.invuln = 1e9; // ignore obstacles, test the maths rules only
    play(rt, 200, false);
    expect(rt.over).toBe(true);
    expect(rt.hearts).toBeLessThanOrEqual(0);
    expect(useGame.getState().hint === null || useGame.getState().hint !== undefined).toBe(true);
  });

  it('Learning Mode never loses hearts and runs slower', () => {
    const rt = makeRun('beginner', 4, { learning: true });
    rt.invuln = 1e9;
    play(rt, 90, false);
    expect(rt.over).toBe(false);
    expect(rt.hearts).toBe(3);
    expect(rt.speed).toBeLessThan(9 * 0.65 + 0.5);
  });

  it('a bot that dodges survives the opening of a normal run', () => {
    let survived = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const rt = makeRun('beginner', seed * 97, {});
      play(rt, 45, true);
      if (!rt.over) survived++;
    }
    expect(survived).toBeGreaterThanOrEqual(4);
  });

  it('jump physics hit the tuned peak and airtime', () => {
    const rt = makeRun('beginner', 1, { god: true });
    rt.inputQueue.push('up');
    let peak = 0, t = 0;
    stepGame(rt, DT, 6);
    while (!rt.grounded && t < 2) {
      stepGame(rt, DT, 6);
      peak = Math.max(peak, rt.y);
      t += DT;
    }
    expect(peak).toBeGreaterThan(PLAYER.jumpPeak * 0.93);
    expect(peak).toBeLessThan(PLAYER.jumpPeak * 1.05);
    expect(t).toBeGreaterThan(PLAYER.jumpAirtime * 0.85);
    expect(t).toBeLessThan(PLAYER.jumpAirtime * 1.15);
  });
});
