/**
 * Runner animation system for the procedural rig (pure maths, no three.js objects).
 * A base state (run / air / roll / surf / idle / ready / stumble / crash) produces a pose;
 * additive layers (lane hop, landing squash, celebrate, wave) are blended on top.
 *
 * Joint conventions (radians): positive hip/shoulder = limb swings forward (−z),
 * negative knee = shin folds back, negative spineX = lean forward.
 */

export interface Pose {
  pelvisY: number;
  spineX: number; spineY: number; spineZ: number;
  headX: number; headY: number;
  hipL: number; hipR: number; hipLz: number; hipRz: number;
  knL: number; knR: number;
  anL: number; anR: number;
  shL: number; shR: number; shLz: number; shRz: number;
  elL: number; elR: number;
  // whole-body rotation about a pivot (flips, spins, rolls, falls)
  rootX: number; rootY: number; rootZ: number;
  pivot: number; // pivot height above the feet
  rootDz: number; // knock-back slide (crash)
}

export type JumpTrick = 'tuck' | 'flip' | 'spin' | 'split';

export function basePose(): Pose {
  return {
    pelvisY: 0.95, spineX: 0, spineY: 0, spineZ: 0, headX: 0, headY: 0,
    hipL: 0, hipR: 0, hipLz: 0, hipRz: 0, knL: -0.05, knR: -0.05, anL: 0, anR: 0,
    shL: 0.05, shR: 0.05, shLz: -0.12, shRz: 0.12, elL: 0.2, elR: 0.2,
    rootX: 0, rootY: 0, rootZ: 0, pivot: 1, rootDz: 0,
  };
}

export const KEYS = Object.keys(basePose()) as Array<keyof Pose>;
const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const bell = (u: number) => Math.sin(Math.PI * clamp01(u));

/** Full-speed sprint cycle: high knees, pumping arms, forward lean, torso counter-twist. */
export function runPose(p: Pose, phase: number, intensity = 1) {
  const s = Math.sin(phase), c = Math.cos(phase);
  p.pelvisY = 0.93 + Math.abs(Math.sin(phase)) * 0.07 * intensity;
  p.spineX = -0.3 * intensity;
  p.spineY = s * 0.18 * intensity;
  p.headX = 0.22 * intensity;
  p.hipL = s * 1.0 * intensity + 0.1;
  p.hipR = -s * 1.0 * intensity + 0.1;
  p.knL = -(0.2 + 1.6 * Math.pow(Math.max(0, -c), 1.2) * intensity);
  p.knR = -(0.2 + 1.6 * Math.pow(Math.max(0, c), 1.2) * intensity);
  p.anL = 0.2 + Math.max(0, c) * 0.5;
  p.anR = 0.2 + Math.max(0, -c) * 0.5;
  p.shL = -s * 0.95 * intensity;
  p.shR = s * 0.95 * intensity;
  p.shLz = -0.18;
  p.shRz = 0.18;
  p.elL = 1.55 + s * 0.25;
  p.elR = 1.55 - s * 0.25;
}

/** Airborne trick, u = 0..1 through the airtime. */
export function airPose(p: Pose, trick: JumpTrick, u: number) {
  const tuck = bell(u);
  p.pelvisY = 0.95;
  p.headX = 0.1;
  switch (trick) {
    case 'flip': {
      // front flip around the waist: tight tuck at the top, open up to land
      const t = clamp01((u - 0.08) / 0.8);
      p.rootX = -TAU * easeInOut(t);
      p.pivot = 1.0;
      p.spineX = -0.5 * tuck;
      p.hipL = p.hipR = 1.9 * tuck + 0.2;
      p.knL = p.knR = -2.2 * tuck - 0.2;
      p.shL = p.shR = 1.2 * tuck;
      p.elL = p.elR = 1.6;
      p.shLz = -0.4; p.shRz = 0.4;
      break;
    }
    case 'spin': {
      // 360° twist with arms wrapped in
      p.rootY = TAU * easeInOut(clamp01((u - 0.05) / 0.85));
      p.spineX = -0.1;
      p.hipL = 0.9 * tuck; p.hipR = 0.3 * tuck;
      p.knL = -1.4 * tuck; p.knR = -0.7 * tuck;
      p.shL = 0.6; p.shR = 0.6; p.shLz = 0.6; p.shRz = -0.6; p.elL = p.elR = 2.0;
      break;
    }
    case 'split': {
      // stag leap: front leg out, back leg kicked back, arms wide
      p.spineX = -0.2;
      p.hipL = 1.3 * tuck + 0.1; p.hipR = -0.9 * tuck;
      p.knL = -0.2; p.knR = -0.9 * tuck;
      p.shL = 1.6 * tuck; p.shR = -0.4; p.shLz = -1.0 * tuck; p.shRz = 1.0 * tuck; p.elL = p.elR = 0.3;
      break;
    }
    default: {
      // tuck jump: knees to chest, arms up
      p.spineX = -0.25 * tuck;
      p.hipL = 1.5 * tuck + 0.2; p.hipR = 1.2 * tuck + 0.2;
      p.knL = -1.9 * tuck - 0.2; p.knR = -1.6 * tuck - 0.2;
      p.shL = 2.5 * tuck; p.shR = 2.3 * tuck; p.elL = p.elR = 0.5;
    }
  }
}

/** Falling without a jump (walked off a roof) / fast-fall. */
export function fallPose(p: Pose) {
  p.spineX = -0.15;
  p.hipL = 0.6; p.hipR = 0.1; p.knL = -0.9; p.knR = -0.4;
  p.shL = 1.6; p.shR = 1.3; p.shLz = -0.5; p.shRz = 0.5; p.elL = p.elR = 0.4;
}

/** Forward roll under a barrier, u = 0..1 through the slide. */
export function rollPose(p: Pose, u: number) {
  const ball = bell(Math.min(1, u * 1.15));
  p.pivot = 0.95 - 0.45 * ball;
  p.pelvisY = 0.95 - 0.35 * ball;
  p.rootX = -TAU * easeInOut(clamp01(u));
  p.spineX = -1.1 * ball;
  p.headX = 0.8 * ball;
  p.hipL = p.hipR = 2.1 * ball;
  p.knL = p.knR = -2.4 * ball;
  p.shL = p.shR = 1.4 * ball;
  p.elL = p.elR = 2.1 * ball;
}

/** Hoverboard: sideways stance, knees bent, arms out for balance. */
export function surfPose(p: Pose, t: number) {
  const sway = Math.sin(t * 2.2);
  p.rootY = -1.15;
  p.rootZ = sway * 0.05;
  p.pelvisY = 0.8;
  p.spineX = -0.15;
  p.spineY = 0.9; // chest turned to face forward
  p.spineZ = sway * 0.06;
  p.headY = 0.3;
  p.hipLz = -0.35; p.hipRz = 0.35;
  p.hipL = 0.45; p.hipR = 0.45;
  p.knL = p.knR = -0.9;
  p.anL = p.anR = 0.45;
  p.shL = 0.3; p.shR = 0.3; p.shLz = -1.15 + sway * 0.15; p.shRz = 1.15 + sway * 0.15;
  p.elL = p.elR = 0.35;
}

export function idlePose(p: Pose, t: number) {
  p.pelvisY = 0.95 + Math.sin(t * 1.8) * 0.006;
  p.spineX = Math.sin(t * 1.8) * 0.015;
  p.spineY = Math.sin(t * 0.5) * 0.12;
  p.headY = Math.sin(t * 0.45 + 1) * 0.35;
  p.hipL = 0.02; p.hipR = -0.02; p.knL = p.knR = -0.04;
  p.shL = 0.04; p.shR = -0.04; p.elL = p.elR = 0.15;
}

export function readyPose(p: Pose) {
  p.pelvisY = 0.8; p.spineX = -0.55; p.headX = 0.35;
  p.hipL = 0.75; p.hipR = -0.25; p.knL = -1.1; p.knR = -0.7; p.anL = 0.35; p.anR = 0.4;
  p.shL = -0.7; p.shR = 0.9; p.elL = 1.4; p.elR = 1.3;
}

/** Stumble: stagger, arms flail, glance back. u = 0..1. */
export function stumbleLayer(p: Pose, u: number) {
  const w = bell(u);
  p.spineX += 0.45 * w;
  p.spineZ += Math.sin(u * 18) * 0.15 * w;
  p.headY += 1.1 * w;
  p.shL += Math.sin(u * 22) * 1.2 * w + 0.8 * w;
  p.shR += Math.cos(u * 20) * 1.2 * w + 0.8 * w;
  p.shLz -= 0.6 * w;
  p.shRz += 0.6 * w;
  p.rootZ += Math.sin(u * 14) * 0.12 * w;
}

/** Crash: knocked backwards onto the ground. u = 0..1 (then holds). */
export function crashPose(p: Pose, u: number) {
  const k = easeInOut(clamp01(u));
  p.pivot = 0.2;
  p.rootX = 1.5 * k; // fall onto the back
  p.rootDz = 1.6 * k; // pushed back
  p.pelvisY = 0.95 - 0.1 * k;
  p.spineX = 0.3 * k;
  p.headX = -0.4 * k;
  p.hipL = 0.9 * k; p.hipR = 0.4 * k; p.knL = -0.6 * k; p.knR = -1.2 * k;
  p.shL = 2.4 * k; p.shR = 2.0 * k; p.shLz = -0.8 * k; p.shRz = 0.8 * k; p.elL = p.elR = 0.4;
}

/** Additive sideways hop during a lane change. dir = −1 left / +1 right. */
export function laneLayer(p: Pose, u: number, dir: number) {
  const w = bell(u);
  p.pelvisY += 0.1 * w;
  p.rootZ += -dir * 0.32 * w;
  p.spineY += dir * 0.25 * w;
  p.hipLz += -0.25 * w;
  p.hipRz += 0.25 * w;
  p.shLz += -0.5 * w;
  p.shRz += 0.5 * w;
}

/** Landing squash. */
export function landLayer(p: Pose, u: number) {
  const w = 1 - clamp01(u);
  p.pelvisY -= 0.16 * w;
  p.knL -= 0.7 * w;
  p.knR -= 0.7 * w;
  p.hipL += 0.35 * w;
  p.hipR += 0.35 * w;
  p.spineX -= 0.2 * w;
}

/** Fist pump on a correct answer (right arm). */
export function celebrateLayer(p: Pose, u: number) {
  const w = bell(u);
  p.shR = p.shR * (1 - w) + 2.9 * w;
  p.shRz = p.shRz * (1 - w) + 0.25 * w;
  p.elR = p.elR * (1 - w) + (0.6 + Math.sin(u * 25) * 0.3) * w;
  p.headX -= 0.25 * w;
}

/** Friendly wave (character preview). */
export function waveLayer(p: Pose, t: number) {
  const w = Math.max(0, Math.sin(t * 0.8));
  p.shRz = 0.12 + w * 2.6;
  p.elR = w * 0.6 + Math.sin(t * 7) * 0.3 * w;
}
