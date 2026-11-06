import { HINT, LEARNING_SLOWMO, LEARNING_SLOWMO_DIST, SCORE, TUNNEL_SPEED_MULT, WORLD } from '@/config/tuning';
import { bus } from '@/events/bus';
import { useGame } from '@/store/gameStore';
import { hasPowerUp, type Runtime } from '../runtime';
import { playerUpdate } from '../systems/PlayerSystem';
import { collisionUpdate } from '../systems/CollisionSystem';
import { gateUpdate, nearGate } from '../systems/GateSystem';
import { powerUpUpdate } from '../systems/PowerUpSystem';
import { effectiveSpeed, spawnUpdate } from '../systems/SpawnSystem';

export function inTunnel(rt: Runtime): boolean {
  return rt.tunnels.some((t) => rt.distance >= t.s && rt.distance < t.s + t.len);
}

/** One simulation tick. Order matters: input/player → move world → spawn → collide → maths → power-ups. */
export function stepGame(rt: Runtime, rawDt: number, viewChunks: number) {
  let ts = 1;
  if (rt.slowmoTimer > 0) {
    rt.slowmoTimer -= rawDt;
    ts = HINT.slowmo;
    if (rt.slowmoTimer <= 0) useGame.getState().showHint(null);
  } else if (hasPowerUp(rt, 'freeze')) ts = 0.5;
  else if (rt.learningMode && nearGate(rt, LEARNING_SLOWMO_DIST)) ts = LEARNING_SLOWMO;
  rt.timeScale = ts;
  const dt = rawDt * ts;
  rt.elapsed += dt;

  rt.speed = effectiveSpeed(rt, rt.distance) * (inTunnel(rt) ? TUNNEL_SPEED_MULT : 1);
  const prevX = rt.x;
  playerUpdate(rt, dt);
  const step = rt.speed * dt;
  rt.distance += step;
  rt.score += step * SCORE.perMeter * rt.scoreMult * (hasPowerUp(rt, 'multiplier') ? 2 : 1);
  rt.stats.cleanDistance += step;
  rt.stats.maxCleanDistance = Math.max(rt.stats.maxCleanDistance, rt.stats.cleanDistance);

  spawnUpdate(rt, dt, false, viewChunks);
  collisionUpdate(rt, dt, prevX);
  gateUpdate(rt);
  powerUpUpdate(rt, dt);

  for (const o of rt.obstacles) {
    if (o.kind === 'movingTrain' && !o.horned && o.s - rt.distance < (rt.speed + o.speed) * WORLD.movingTrainWarnSec + 10) {
      o.horned = true;
      bus.emit('HORN');
    }
  }
  if (rt.hearts <= 0 && rt.slowmoTimer <= 0 && !rt.learningMode) rt.over = true;
  rt.shake = Math.max(0, rt.shake - rawDt * 3);
  rt.punch = Math.max(0, rt.punch - rawDt * 2.5);
}

/** Attract-mode tick behind the menus: slow scroll, no hazards. */
export function stepMenu(rt: Runtime, dt: number) {
  rt.speed = 5;
  rt.distance += rt.speed * dt;
  rt.elapsed += dt;
  rt.grounded = true;
  spawnUpdate(rt, dt, true, 3);
}
