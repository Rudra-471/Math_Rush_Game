import type { Band, Question } from '@/math/types';
import type { MathSession } from '@/math/adaptive/selector';
import type { PowerUpType } from '@/config/tuning';
import { createRng } from '@/math/rng';
import type { Rng } from '@/math/types';

/**
 * Mutable per-run game state. Systems mutate it every frame inside the single GameLoop
 * useFrame; React never re-renders from it directly (coarse values are published to zustand).
 */

export type ObstacleKind = 'low' | 'high' | 'train' | 'movingTrain' | 'ramp';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  lane: number;
  s: number; // near end (track metres)
  len: number;
  top: number; // top height
  bottom: number; // bottom height (high barriers float)
  speed: number; // moving trains: m/s toward the player
  horned: boolean;
  cars: number;
}

export interface Coin {
  s: number;
  lane: number;
  y: number;
  x: number; // magnet pulls x
  taken: boolean;
  math: boolean; // operation coin → spawns maths orbs
}

export interface Pickup {
  s: number;
  lane: number;
  type: PowerUpType;
  taken: boolean;
}

export interface Orb {
  s: number;
  lane: number;
  label: string;
  index: number;
  taken: boolean;
}

export type GateState = 'pending' | 'queued' | 'shown' | 'revealed' | 'resolved';

export interface GateRow {
  id: number;
  s: number;
  state: GateState;
  question?: Question;
  labels: string[];
  pCorrect: number;
  decideMs: number;
  showAt: number; // track position where the banner appears
  revealAt: number;
  shownAtMs: number; // performance.now() when banner shown
  tunnel?: number; // tunnel id
  result?: { chosen: number; correct: boolean };
}

export interface Tunnel {
  id: number;
  s: number;
  len: number;
  skillId?: string;
  correct: number;
  answered: number;
  entered: boolean;
  done: boolean;
}

export interface ActivePowerUp {
  type: PowerUpType;
  remaining: number;
  total: number;
}

export interface OrbChallenge {
  question: Question;
  s: number;
  shownAtMs: number;
}

export interface RunStats {
  questions: number;
  correct: number;
  maxStreak: number;
  bySkill: Record<string, { asked: number; correct: number }>;
  tunnelsCompleted: number;
  tunnelsPerfect: number;
  coins: number;
  stumbles: number;
  cleanDistance: number;
  maxCleanDistance: number;
  fastCorrect: number; // < 1.5 s
  orbsCorrect: number;
}

export interface Runtime {
  rng: Rng;
  band: Band;
  learningMode: boolean;
  godMode: boolean;
  session: MathSession | null;
  // motion
  distance: number;
  speed: number;
  baseSpeed: number;
  timeScale: number;
  slowmoTimer: number;
  elapsed: number;
  // player
  lane: number;
  prevLane: number;
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
  groundY: number;
  sliding: number; // remaining seconds
  laneTimer: number; // time since lane change started
  sideBumpTimer: number;
  invuln: number;
  stumbleFlash: number;
  inputQueue: Array<'left' | 'right' | 'up' | 'down'>;
  hoverboard: number; // remaining seconds
  hoverboardUsed: boolean;
  // world
  nextId: number;
  generatedTo: number;
  lastPatternDense: boolean;
  nextGateS: number;
  nextTunnelS: number;
  obstacles: Obstacle[];
  coins: Coin[];
  pickups: Pickup[];
  orbs: Orb[];
  gates: GateRow[];
  tunnels: Tunnel[];
  activeChunkId: string;
  orb: OrbChallenge | null;
  gatesVersion: number; // bumps when gate labels change (render sync)
  // scoring
  score: number;
  coinsRun: number;
  hearts: number;
  streak: number;
  powerups: ActivePowerUp[];
  shieldArmed: boolean;
  revived: boolean;
  stats: RunStats;
  // camera fx
  shake: number;
  punch: number;
  over: boolean;
  scoreMult: number;
  upgradeLevels: Record<string, number>;
  /** runner pose override (intro cinematic) */
  pose: 'run' | 'idle' | 'ready';
}

export function newStats(): RunStats {
  return {
    questions: 0, correct: 0, maxStreak: 0, bySkill: {}, tunnelsCompleted: 0, tunnelsPerfect: 0,
    coins: 0, stumbles: 0, cleanDistance: 0, maxCleanDistance: 0, fastCorrect: 0, orbsCorrect: 0,
  };
}

export function createRuntime(seed: number, band: Band): Runtime {
  return {
    rng: createRng(seed), band, learningMode: false, godMode: false, session: null,
    distance: 0, speed: 0, baseSpeed: 0, timeScale: 1, slowmoTimer: 0, elapsed: 0,
    lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, grounded: true, groundY: 0, sliding: 0, laneTimer: 1,
    sideBumpTimer: 1, invuln: 0, stumbleFlash: 0, inputQueue: [], hoverboard: 0, hoverboardUsed: false,
    nextId: 1, generatedTo: 0, lastPatternDense: false, nextGateS: 0, nextTunnelS: 0,
    obstacles: [], coins: [], pickups: [], orbs: [], gates: [], tunnels: [], activeChunkId: '',
    orb: null, gatesVersion: 0,
    score: 0, coinsRun: 0, hearts: 3, streak: 0, powerups: [], shieldArmed: false, revived: false,
    stats: newStats(), shake: 0, punch: 0, over: false, scoreMult: 1, upgradeLevels: {}, pose: 'run',
  };
}

/** The one live runtime (replaced on every new run). */
export const game: { rt: Runtime } = { rt: createRuntime(1, 'intermediate') };

export function hasPowerUp(rt: Runtime, t: PowerUpType): boolean {
  return rt.powerups.some((p) => p.type === t);
}
