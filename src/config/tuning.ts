import type { Band } from '@/math/types';

/** All tunable numbers live here (SPEC 6.2, 6.3, 7.6, 7.9, 8, 9). */

export const LANES = [-2.6, 0, 2.6] as const;
export const LANE_WIDTH = 2.6;

export const SPEED: Record<Band, { vStart: number; vMax: number; k: number }> = {
  beginner: { vStart: 9, vMax: 16, k: 2500 },
  intermediate: { vStart: 11, vMax: 22, k: 2000 },
  advanced: { vStart: 12, vMax: 26, k: 1800 },
  expert: { vStart: 13, vMax: 30, k: 1500 },
};
export const LEARNING_SPEED_MULT = 0.6;
export const LEARNING_SLOWMO = 0.5; // inside the last 15 m before a gate
export const LEARNING_SLOWMO_DIST = 15;
export const TUNNEL_SPEED_MULT = 0.75;

export const PLAYER = {
  laneChangeTime: 0.14,
  jumpPeak: 1.6,
  jumpAirtime: 0.62,
  sneakersMult: 1.75,
  slideTime: 0.65,
  fastFallMult: 3,
  coyoteTime: 0.08,
  invulnTime: 1.5,
  height: 1.8,
  slideHeight: 0.7,
  halfWidth: 0.38,
  halfDepth: 0.35,
  bufferMax: 1,
};
/** Derived jump physics: peak h reached in T/2. */
export const GRAVITY = (8 * PLAYER.jumpPeak) / (PLAYER.jumpAirtime * PLAYER.jumpAirtime);
export const JUMP_V = (4 * PLAYER.jumpPeak) / PLAYER.jumpAirtime;

export const WORLD = {
  chunkLength: 40,
  chunksAhead: 6,
  recycleBehind: 12,
  trainCarLength: 8,
  trainHeight: 2.4,
  trainWidth: 2.2,
  rampLength: 6,
  lowBarrierHeight: 0.85,
  highBarrierBottom: 1.15,
  highBarrierTop: 2.6,
  barrierDepth: 0.5,
  hitboxShrink: 0.87, // hitboxes ~13% smaller than visuals
  movingTrainSpeed: 6,
  movingTrainWarnSec: 2,
  biomeLength: 2000,
};

/** SPEC 7.6 question timing per age band. */
export const TIMING: Record<Band, { baseRead: number; perToken: number; baseDecide: number }> = {
  beginner: { baseRead: 1.6, perToken: 0.45, baseDecide: 2.2 },
  intermediate: { baseRead: 1.0, perToken: 0.3, baseDecide: 1.8 },
  advanced: { baseRead: 0.8, perToken: 0.25, baseDecide: 1.6 },
  expert: { baseRead: 0.6, perToken: 0.2, baseDecide: 1.4 },
};
export const SAFETY_METERS = 8;
export const SPAWN_CLAMP = [45, 220] as const;
export const REVEAL_FRACTION = 0.6; // numbers visible after 60% of the approach

export const RHYTHM = {
  gateMinSec: 8,
  gateMaxSec: 14,
  gateMinGapSec: 6,
  firstGateMeters: 110,
  orbMinFromGateSec: 8,
  orbDistance: 40,
  tunnelEveryMeters: 500,
  tunnelGateSpacing: 90,
  calmBefore: 20,
  calmAfter: 10,
};

export const SCORE = {
  perMeter: 1,
  perCoin: 10,
  correctBase: 100,
  speedBonusMax: 50,
  coinsPerCorrect: 5,
  tunnelPerfect: 1000,
  tunnelGood: 400,
  streakSteps: [
    { at: 10, mult: 4 },
    { at: 6, mult: 3 },
    { at: 3, mult: 2 },
  ],
  orbCoins: 25,
  scoreMultPerMission: 0.1,
  scoreMultCap: 3,
};

export const LIVES = {
  start: 3,
  max: 3,
  refillStreak: { normal: 5, expert: 8 },
};

export const HINT = { durationSec: 2.2, slowmo: 0.3, expertDurationSec: 1.5 };

export type PowerUpType = 'magnet' | 'sneakers' | 'multiplier' | 'shield' | 'freeze' | 'doubleAnswer';
export const POWERUPS: Record<PowerUpType, { label: string; icon: string; base: number; perLevel: number; color: string }> = {
  magnet: { label: 'Coin Magnet', icon: '🧲', base: 8, perLevel: 2, color: '#ef4444' },
  sneakers: { label: 'Super Sneakers', icon: '👟', base: 10, perLevel: 2, color: '#22c55e' },
  multiplier: { label: '2× Multiplier', icon: '✖️', base: 12, perLevel: 2, color: '#eab308' },
  shield: { label: 'Maths Shield', icon: '🛡️', base: 30, perLevel: 5, color: '#3b82f6' },
  freeze: { label: 'Time Freeze', icon: '⏳', base: 5, perLevel: 1, color: '#06b6d4' },
  doubleAnswer: { label: 'Double Answer', icon: '💎', base: 15, perLevel: 3, color: '#a855f7' },
};
export const MAGNET_RADIUS = 6;
export const HOVERBOARD = { duration: 30, price: 300 };
export const UPGRADE_PRICES = [500, 1000, 2000, 4000, 8000];
export const PICKUP_CHANCE_PER_CHUNK = 0.14;
export const MATH_COIN_CHANCE_PER_CHUNK = 0.12;

export const CAMERA = {
  offset: [0, 2.75, 5.3] as const,
  lookAhead: 6,
  fovMin: 60,
  fovMax: 72,
  followStiffness: 14,
  shakeTime: 0.35,
  shakeAmp: 0.25,
};

export const XP = {
  perCorrect: 10,
  perTenMeters: 1,
  perMission: 100,
  levelBase: 200,
  levelExp: 1.4,
};

export const SESSION = { breakReminderMin: 20 };

export const QUALITY = {
  low: { dpr: 1, shadows: false, shadowMap: 0, viewChunks: 4 },
  medium: { dpr: 1.5, shadows: true, shadowMap: 1024, viewChunks: 6 },
  high: { dpr: 2, shadows: true, shadowMap: 2048, viewChunks: 6 },
} as const;
export type QualityTier = keyof typeof QUALITY;
