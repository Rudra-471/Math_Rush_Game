import { PATTERNS, INTRO_AT, type Pattern } from '../world/chunks';
import type { Runtime, Obstacle, ObstacleKind } from '../runtime';
import { LEARNING_SPEED_MULT, PICKUP_CHANCE_PER_CHUNK, MATH_COIN_CHANCE_PER_CHUNK, RHYTHM, WORLD, type PowerUpType } from '@/config/tuning';
import { speedAt } from './timing';

const POWERUP_TYPES: PowerUpType[] = ['magnet', 'sneakers', 'multiplier', 'shield', 'freeze', 'doubleAnswer'];
const TUNNEL_LEN = 20 + RHYTHM.tunnelGateSpacing * 3 + 20;

export function effectiveSpeed(rt: Runtime, at: number): number {
  return speedAt(at, rt.band) * (rt.learningMode ? LEARNING_SPEED_MULT : 1);
}

function addObstacle(rt: Runtime, kind: ObstacleKind, lane: number, s: number, extra: Partial<Obstacle> = {}): Obstacle {
  const base: Obstacle = {
    id: rt.nextId++, kind, lane, s, len: WORLD.barrierDepth, top: 0, bottom: 0, speed: 0, horned: false, cars: 1,
  };
  if (kind === 'low') base.top = WORLD.lowBarrierHeight;
  if (kind === 'high') { base.top = WORLD.highBarrierTop; base.bottom = WORLD.highBarrierBottom; }
  if (kind === 'ramp') { base.len = WORLD.rampLength; base.top = WORLD.trainHeight; }
  const o = { ...base, ...extra };
  rt.obstacles.push(o);
  return o;
}

function addCoins(rt: Runtime, lane: number, s: number, count: number, arc: 'flat' | 'over' | 'roof' = 'flat') {
  for (let i = 0; i < count; i++) {
    let y = 0.9;
    if (arc === 'over') y = 0.9 + 1.5 * Math.sin((Math.PI * i) / Math.max(1, count - 1));
    if (arc === 'roof') y = WORLD.trainHeight + 0.9;
    rt.coins.push({ s: s + i * 2, lane, y, x: (lane - 1) * 2.6, taken: false, math: false });
  }
}

function maxDifficulty(rt: Runtime, d: number): number {
  const cap = rt.learningMode ? 2 : rt.band === 'beginner' ? 3 : rt.band === 'intermediate' ? 4 : 5;
  return Math.min(cap, 1 + Math.floor(d / 250));
}

function choosePattern(rt: Runtime, c0: number, menu: boolean): Pattern {
  if (menu) return PATTERNS[0];
  const maxD = maxDifficulty(rt, c0);
  const pool = PATTERNS.filter(
    (p) =>
      p.difficulty <= maxD &&
      p.tags.every((t) => (INTRO_AT[t] ?? 0) <= c0) &&
      !(rt.lastPatternDense && p.difficulty >= 4) &&
      !(rt.activeChunkId === 'gate' && p.tags.includes('moving')),
  );
  // Weight toward the current difficulty ceiling as the run goes on.
  const weights = pool.map((p) => 1 + (p.difficulty === maxD ? 1.5 : 0) + (p.tags.includes('calm') ? -0.5 : 0));
  let r = rt.rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function laneFreeAt(rt: Runtime, lane: number, s: number, margin: number): boolean {
  return !rt.obstacles.some((o) => o.lane === lane && o.s - margin < s && o.s + o.len + margin > s);
}

function placePattern(rt: Runtime, p: Pattern, c0: number) {
  for (const o of p.objects) {
    const s = c0 + o.z;
    switch (o.type) {
      case 'low':
      case 'high':
        addObstacle(rt, o.type, o.lane, s);
        break;
      case 'train':
        addObstacle(rt, 'train', o.lane, s, { len: o.cars * WORLD.trainCarLength, top: WORLD.trainHeight, cars: o.cars });
        break;
      case 'rampTrain':
        addObstacle(rt, 'ramp', o.lane, s);
        addObstacle(rt, 'train', o.lane, s + WORLD.rampLength, { len: o.cars * WORLD.trainCarLength, top: WORLD.trainHeight, cars: o.cars });
        break;
      case 'movingTrain':
        addObstacle(rt, 'movingTrain', o.lane, s, {
          len: o.cars * WORLD.trainCarLength, top: WORLD.trainHeight, cars: o.cars, speed: WORLD.movingTrainSpeed,
        });
        break;
      case 'coinLine':
        addCoins(rt, o.lane, s, o.count, o.arc);
        break;
    }
  }
  rt.activeChunkId = p.id;
  rt.lastPatternDense = p.difficulty >= 4;
}

function maybeExtras(rt: Runtime, c0: number) {
  const onTrack = rt.pickups.some((p) => !p.taken && p.s > rt.distance);
  const r = rt.rng.next();
  if (!onTrack && r < PICKUP_CHANCE_PER_CHUNK && c0 > 150) {
    const lane = rt.rng.int(0, 2);
    const s = c0 + rt.rng.int(8, 32);
    if (laneFreeAt(rt, lane, s, 4)) rt.pickups.push({ s, lane, type: rt.rng.pick(POWERUP_TYPES), taken: false });
  } else if (r > 1 - MATH_COIN_CHANCE_PER_CHUNK && c0 > 200) {
    const lane = rt.rng.int(0, 2);
    const s = c0 + rt.rng.int(8, 32);
    if (laneFreeAt(rt, lane, s, 3)) rt.coins.push({ s, lane, y: 1.1, x: (lane - 1) * 2.6, taken: false, math: true });
  }
}

function addGate(rt: Runtime, s: number, tunnel?: number) {
  rt.gates.push({
    id: rt.nextId++, s, state: 'pending', labels: ['?', '?', '?'], pCorrect: 0, decideMs: 0,
    showAt: Infinity, revealAt: Infinity, shownAtMs: 0, tunnel,
  });
  rt.gatesVersion++;
}

function scheduleNextGate(rt: Runtime, after: number) {
  const v = effectiveSpeed(rt, after);
  const secs = RHYTHM.gateMinSec + rt.rng.next() * (RHYTHM.gateMaxSec - RHYTHM.gateMinSec);
  rt.nextGateS = after + Math.max(RHYTHM.gateMinGapSec, secs) * v;
}

function generateNext(rt: Runtime, menu: boolean) {
  const c0 = rt.generatedTo;
  const L = WORLD.chunkLength;
  if (!menu && c0 >= rt.nextTunnelS) {
    // Challenge Tunnel: calm segment with 3 gates in a row on one skill.
    const id = rt.nextId++;
    rt.tunnels.push({ id, s: c0, len: TUNNEL_LEN, correct: 0, answered: 0, entered: false, done: false });
    for (let i = 0; i < 3; i++) addGate(rt, c0 + 20 + RHYTHM.tunnelGateSpacing * (i + 1) - 25, id);
    for (let i = 0; i < 6; i++) addCoins(rt, i % 3, c0 + 15 + i * 45, 6);
    rt.generatedTo = c0 + TUNNEL_LEN;
    rt.nextTunnelS = rt.generatedTo + RHYTHM.tunnelEveryMeters;
    scheduleNextGate(rt, rt.generatedTo);
    rt.activeChunkId = 'tunnel';
    return;
  }
  if (!menu && rt.nextGateS <= c0 + 25) {
    // Calm gate chunk: no obstacles 20 m before and 10 m after the gate row.
    const gs = c0 + 25;
    addGate(rt, gs);
    addCoins(rt, rt.rng.int(0, 2), c0 + 4, 6);
    scheduleNextGate(rt, gs);
    rt.generatedTo = c0 + L;
    rt.activeChunkId = 'gate';
    rt.lastPatternDense = false;
    return;
  }
  placePattern(rt, choosePattern(rt, c0, menu), c0);
  if (!menu) maybeExtras(rt, c0);
  rt.generatedTo = c0 + L;
}

export function initSpawner(rt: Runtime) {
  rt.generatedTo = 0;
  // first chunk is always calm so the run starts gently
  placePattern(rt, PATTERNS[0], 0);
  rt.generatedTo = WORLD.chunkLength;
  rt.nextGateS = RHYTHM.firstGateMeters;
  rt.nextTunnelS = RHYTHM.tunnelEveryMeters;
}

export function spawnUpdate(rt: Runtime, dt: number, menu = false, viewChunks = WORLD.chunksAhead) {
  const ahead = WORLD.chunkLength * viewChunks;
  while (rt.generatedTo < rt.distance + ahead) generateNext(rt, menu);

  // Moving trains roll toward the player once they're inside the warning window.
  for (const o of rt.obstacles) {
    if (o.kind !== 'movingTrain') continue;
    const warnDist = (rt.speed + o.speed) * WORLD.movingTrainWarnSec;
    if (o.s - rt.distance < warnDist + 10) {
      // never roll into a gate's calm zone (kids must be free to pick any lane at a gate)
      let floor = -Infinity;
      for (const g of rt.gates) if (g.s < o.s) floor = Math.max(floor, g.s + RHYTHM.calmAfter + 20);
      o.s = Math.max(floor, o.s - o.speed * dt);
    }
  }

  // Recycle everything that has passed behind the camera.
  const cut = rt.distance - WORLD.recycleBehind;
  if (rt.obstacles.length && rt.obstacles[0].s + 60 < cut) {
    rt.obstacles = rt.obstacles.filter((o) => o.s + o.len > cut);
  }
  if (rt.coins.length > 120 || (rt.coins.length && rt.coins[0].s < cut - 20)) rt.coins = rt.coins.filter((c) => c.s > cut && !(c.taken && c.s < rt.distance));
  if (rt.pickups.length) rt.pickups = rt.pickups.filter((p) => p.s > cut && !p.taken);
  if (rt.gates.length && rt.gates[0].s < cut && rt.gates[0].state === 'resolved') {
    rt.gates = rt.gates.filter((g) => g.s > cut || g.state !== 'resolved');
    rt.gatesVersion++;
  }
  if (rt.tunnels.length && rt.tunnels[0].s + rt.tunnels[0].len < cut - 50) rt.tunnels = rt.tunnels.filter((t) => t.s + t.len > cut - 50);
}

export { TUNNEL_LEN };
