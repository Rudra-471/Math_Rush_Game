import * as THREE from 'three';
import { LANES, WORLD } from '@/config/tuning';
import { bus } from '@/events/bus';
import type { Question } from '@/math/types';
import { createRuntime, game, type Runtime } from '../runtime';
import { laneAtX, playerUpdate } from '../systems/PlayerSystem';
import { collisionUpdate } from '../systems/CollisionSystem';

/**
 * Intro cinematic ("movie scene") driven by the real engine: a hand-placed world, a scripted
 * runner and five camera shots with hard cuts, a crane, an orbit, a chase and bullet-time.
 *
 *  A  0–5 s    dawn aerial crane over the city
 *  B  5–9 s    platform-level: an oncoming express thunders past
 *  C  9–13 s   hero orbit, the question appears, runner crouches ready
 *  D  13 s→    chase cam, jump, lane change, bullet-time through the right gate
 *  E  +1.4 s   crane up and back for the title
 */

const D0 = 100; // runner's track position at the start
const BARRIER_S = D0 + 24;
const GATE_S = D0 + 62;
const TRAIN_PASS_T = 7.2; // when the express passes the camera
const E_DELAY = 1.4; // gate → title shot
const E_LEN = 4.4;

export const intro = {
  t: 0,
  gatePassedAt: -1,
  done: false,
  jumped: false,
  moved: false,
  fired: new Set<string>(),
  slow: 0, // 0..1 bullet-time amount
  shot: '',
};

export const INTRO_QUESTION: Question = {
  id: 'intro', skillId: 'mul.table.6-9', level: 5, kind: 'choice3', prompt: '7 × 8 = ?', speech: 'seven times eight',
  answer: 56, choices: [54, 63, 56], answerIndex: 2, distractorTags: ['table-neighbour', 'table-neighbour', ''],
  explanation: { type: 'dotArray', rows: 7, cols: 8, text: '7 rows of 8 make 56.' }, difficulty: 1,
};

function cue(name: string, at: number) {
  if (intro.t >= at && !intro.fired.has(name)) {
    intro.fired.add(name);
    bus.emit('INTRO', { cue: name });
  }
}

/** Build the hand-placed world and reset the clock. */
export function startIntro() {
  const rt = createRuntime(77, 'intermediate');
  rt.godMode = true;
  rt.distance = D0;
  rt.speed = 0;
  rt.pose = 'idle';
  rt.generatedTo = 1e9; // no procedural spawning during the film
  rt.nextGateS = rt.nextTunnelS = 1e9;
  // set dressing: a parked train on the left track beyond the gate, a barrier to jump, coin trails
  rt.obstacles.push(
    { id: 1, kind: 'train', lane: 0, s: GATE_S + 14, len: 3 * WORLD.trainCarLength, top: WORLD.trainHeight, bottom: 0, speed: 0, horned: true, cars: 3 },
    { id: 2, kind: 'low', lane: 1, s: BARRIER_S, len: WORLD.barrierDepth, top: WORLD.lowBarrierHeight, bottom: 0, speed: 0, horned: true, cars: 1 },
    { id: 3, kind: 'train', lane: 0, s: D0 - 30, len: 2 * WORLD.trainCarLength, top: WORLD.trainHeight, bottom: 0, speed: 0, horned: true, cars: 2 },
  );
  const coin = (lane: number, s: number, y = 0.9) => rt.coins.push({ s, lane, y, x: LANES[lane], taken: false, math: false });
  for (let i = 0; i < 6; i++) coin(1, D0 + 6 + i * 2.2);
  for (let i = 0; i < 6; i++) coin(1, BARRIER_S - 4 + i * 1.6, 0.9 + 1.5 * Math.sin((Math.PI * i) / 5));
  for (let i = 0; i < 8; i++) coin(2, BARRIER_S + 12 + i * 2.2);
  for (let i = 0; i < 12; i++) coin(2, GATE_S + 4 + i * 2.2);
  rt.gates.push({
    id: 10, s: GATE_S, state: 'pending', question: INTRO_QUESTION, labels: INTRO_QUESTION.choices.map(String),
    pCorrect: 0.8, decideMs: 4000, showAt: Infinity, revealAt: Infinity, shownAtMs: 0,
  });
  game.rt = rt;
  Object.assign(intro, { t: 0, gatePassedAt: -1, done: false, jumped: false, moved: false, slow: 0, shot: '' });
  intro.fired.clear();
}

export const introLength = () => (intro.gatePassedAt > 0 ? intro.gatePassedAt + E_DELAY + E_LEN : 99);

/** Advance the scripted scene. `dt` is real time; the world runs in (possibly slowed) game time. */
export function stepIntro(rt: Runtime, dt: number) {
  intro.t += dt;
  const t = intro.t;
  cue('drone', 0);
  cue('horn', 5.3);
  cue('pass', TRAIN_PASS_T - 0.25);
  cue('boom', 9);
  cue('question', 11);
  cue('riser', 12.1);
  cue('go', 13);

  // --- runner script ---
  if (t < 13) {
    rt.speed = 0;
    rt.pose = t > 11.8 ? 'ready' : 'idle';
  } else {
    rt.pose = 'run';
    rt.speed = Math.min(13, 13 * ((t - 13) / 0.9));
  }

  // --- bullet time around the gate ---
  const g = rt.gates[0];
  const toGate = GATE_S - rt.distance;
  let slowTarget = 0;
  if (g.state !== 'resolved' && toGate < 7 && t > 13) slowTarget = 1;
  if (intro.gatePassedAt > 0 && t < intro.gatePassedAt + 0.9) slowTarget = 1;
  intro.slow += (slowTarget - intro.slow) * (1 - Math.exp(-dt * (slowTarget ? 6 : 3)));
  const ts = 1 - 0.8 * intro.slow;
  rt.timeScale = ts;
  const wdt = dt * ts;
  rt.elapsed += wdt;

  // --- the express in shot B (moves itself; removed afterwards) ---
  if (t >= 5 && t < 9.2) {
    let tr = rt.obstacles.find((o) => o.id === 99);
    if (!tr) {
      tr = { id: 99, kind: 'movingTrain', lane: 2, s: 0, len: 3 * WORLD.trainCarLength, top: WORLD.trainHeight, bottom: 0, speed: 0, horned: true, cars: 3 };
      rt.obstacles.push(tr);
    }
    tr.s = D0 + 8 + 34 * (TRAIN_PASS_T - t);
  } else if (t >= 9.2) rt.obstacles = rt.obstacles.filter((o) => o.id !== 99);

  // --- question appears on the boards, sharpening as the runner approaches ---
  if (t >= 11 && g.state === 'pending') {
    g.state = 'shown';
    g.showAt = rt.distance;
    g.revealAt = rt.distance + 34;
    rt.gatesVersion++;
  }
  if (g.state === 'shown' && rt.distance >= g.revealAt) g.state = 'revealed';

  // --- scripted inputs: jump the barrier, then step right to the "56" lane ---
  if (t >= 13) {
    if (!intro.jumped && BARRIER_S - rt.distance < 3.4) {
      rt.inputQueue.push('up');
      intro.jumped = true;
    }
    if (!intro.moved && rt.distance > BARRIER_S + 5 && rt.grounded) {
      rt.inputQueue.push('right');
      intro.moved = true;
    }
  }
  const prevX = rt.x;
  playerUpdate(rt, wdt);
  rt.distance += rt.speed * wdt;
  collisionUpdate(rt, wdt, prevX); // coins (god mode: no crashes)

  if (g.state !== 'resolved' && rt.distance >= GATE_S) {
    const chosen = laneAtX(rt.x);
    g.state = 'resolved';
    g.result = { chosen, correct: chosen === INTRO_QUESTION.answerIndex };
    rt.gatesVersion++;
    intro.gatePassedAt = t;
    bus.emit('GATE_PASSED', { question: INTRO_QUESTION, chosen, correct: g.result.correct, responseMs: 0, context: 'gate', streak: 3 });
  }
  if (intro.gatePassedAt > 0) cue('title', intro.gatePassedAt + E_DELAY);
  if (t > introLength()) intro.done = true;
}

// ---------------------------------------------------------------- camera
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const A0 = v(1.5, 17, 30), A1 = v(6, 5.2, 9), LA0 = v(0, 6, -160), LA1 = v(0, 1.2, -8);
const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3(), chaseP = new THREE.Vector3(), sideP = new THREE.Vector3();

export interface CamPose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  roll: number;
  cut: boolean; // hard cut this frame (no smoothing)
}

/** Camera choreography for the current intro time. */
export function introCamera(rt: Runtime, out: CamPose): CamPose {
  const t = intro.t;
  let shot: string;
  const px = rt.x, py = rt.y;
  if (t < 5) {
    shot = 'A';
    const u = ease(clamp01(t / 5));
    out.pos.lerpVectors(A0, A1, u);
    out.look.lerpVectors(LA0, LA1, u);
    out.fov = 48;
    out.roll = 0;
  } else if (t < 9) {
    shot = 'B';
    const drift = (t - 5) / 4;
    out.pos.set(5.1 - drift * 0.3, 1.35, -8 - drift * 0.8);
    // whip-pan to follow the train as it rushes by
    const follow = smooth(TRAIN_PASS_T - 0.35, TRAIN_PASS_T + 0.5, t);
    out.look.set(2.6 - follow * 2.2, 1.6, -60 + follow * 75);
    out.fov = 40;
    out.roll = -0.02;
  } else if (t < 13) {
    shot = 'C';
    // hero orbit around the face, swinging behind the runner at the end
    const u = (t - 9) / 4;
    const ang = THREE.MathUtils.lerp(-2.5, -0.55, ease(clamp01(u * 1.05)));
    const r = THREE.MathUtils.lerp(2.4, 3.1, u);
    out.pos.set(px + Math.sin(ang) * r, 1.75 - u * 0.15, Math.cos(ang) * -r * -1);
    out.look.set(px, 1.5 - u * 0.2, 0);
    if (t > 12.2) {
      const w = ease(clamp01((t - 12.2) / 0.8));
      chaseP.set(px + 0.8, 1.7, 3.4);
      out.pos.lerp(chaseP, w);
      tmpL.set(px, 1.2, -10);
      out.look.lerp(tmpL, w);
    }
    out.fov = 36 + u * 6;
    out.roll = 0;
  } else if (intro.gatePassedAt < 0 || t < intro.gatePassedAt + E_DELAY) {
    shot = 'D';
    // chase cam, swinging to a side "bullet-time" angle while time slows
    chaseP.set(px + 0.8, py * 0.6 + 1.7, 3.4);
    sideP.set(px + 3.4, py * 0.6 + 1.25, 0.6);
    out.pos.lerpVectors(chaseP, sideP, ease(intro.slow));
    tmpL.set(px * 0.8, 1.1 + py * 0.5, -10);
    tmpP.set(px, 1.2 + py, -1.5);
    out.look.lerpVectors(tmpL, tmpP, intro.slow);
    out.fov = 48 + Math.min(1, rt.speed / 13) * 12 - intro.slow * 10;
    out.roll = 0.04 * (1 - intro.slow);
  } else {
    shot = 'E';
    const u = ease(clamp01((t - intro.gatePassedAt - E_DELAY) / 3.2));
    chaseP.set(px + 0.8, 1.7, 3.4);
    tmpP.set(0, 24, 30);
    out.pos.lerpVectors(chaseP, tmpP, u);
    tmpL.set(px, 1.1, -10);
    tmpP.set(0, 0, -110);
    out.look.lerpVectors(tmpL, tmpP, u);
    out.fov = 52 + u * 8;
    out.roll = 0;
  }
  out.cut = shot !== intro.shot && (shot === 'B' || shot === 'C' || intro.shot === '');
  intro.shot = shot;
  return out;
}
