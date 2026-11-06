import { LANES, LANE_WIDTH, MAGNET_RADIUS, PLAYER, POWERUPS, SCORE, WORLD } from '@/config/tuning';
import { bus } from '@/events/bus';
import { hasPowerUp, type Obstacle, type Runtime } from '../runtime';
import { playerHeight } from './PlayerSystem';
import { activatePowerUp } from './PowerUpSystem';
import { startOrbChallenge } from './GateSystem';

function halfWidth(o: Obstacle): number {
  const w = o.kind === 'low' || o.kind === 'high' ? LANE_WIDTH * 0.42 : WORLD.trainWidth / 2;
  return w * WORLD.hitboxShrink;
}

function overlaps(rt: Runtime, o: Obstacle, x: number): boolean {
  if (Math.abs(x - LANES[o.lane]) >= halfWidth(o) + PLAYER.halfWidth) return false;
  const shrinkS = o.kind === 'low' || o.kind === 'high' ? 0.15 : 0.4;
  if (rt.distance + PLAYER.halfDepth <= o.s + shrinkS || rt.distance - PLAYER.halfDepth >= o.s + o.len - shrinkS) return false;
  const h = playerHeight(rt);
  let top = o.top * WORLD.hitboxShrink + (o.kind === 'low' ? 0 : 0.2);
  if (o.kind === 'ramp') top = (o.top * (rt.distance - o.s)) / o.len;
  if (o.kind === 'train' || o.kind === 'movingTrain' || o.kind === 'ramp') {
    // standing on the roof / ramp surface is fine
    if (rt.y >= top - 0.45) return false;
    if (o.kind === 'ramp') return rt.y < top - 0.8; // entering the ramp from the side
  }
  return rt.y < top && rt.y + h > o.bottom;
}

/** Safe lane for respawn (Learning Mode) — the lane with the most free space ahead. */
function safeLane(rt: Runtime): number {
  let best = rt.lane;
  let bestFree = -1;
  for (let l = 0; l < 3; l++) {
    const blockers = rt.obstacles.filter((o) => o.lane === l && o.s + o.len > rt.distance - 2 && o.s < rt.distance + 40);
    const free = blockers.length ? Math.min(...blockers.map((o) => o.s - rt.distance)) : 999;
    if (free > bestFree) { bestFree = free; best = l; }
  }
  return best;
}

export function collisionUpdate(rt: Runtime, dt: number, prevX: number) {
  if (rt.invuln <= 0 && !rt.godMode) {
    for (const o of rt.obstacles) {
      if (o.s > rt.distance + 3 || o.s + o.len < rt.distance - 3) continue;
      if (!overlaps(rt, o, rt.x)) continue;
      // side hit = the overlap was caused by our own lateral move this frame
      const side = !overlaps(rt, o, prevX) && rt.laneTimer < 0.5;
      if (side) stumble(rt);
      else crash(rt, o);
      break;
    }
  }

  // coins + magnet
  const magnet = hasPowerUp(rt, 'magnet');
  const playerMidY = rt.y + 0.9;
  for (const c of rt.coins) {
    if (c.taken) continue;
    const ds = c.s - rt.distance;
    if (ds > MAGNET_RADIUS + 2 || ds < -1.5) continue;
    if (magnet && !c.math && ds < MAGNET_RADIUS) {
      const k = 1 - Math.exp(-12 * dt);
      c.x += (rt.x - c.x) * k;
      c.y += (playerMidY - c.y) * k;
      c.s += (rt.distance - c.s) * k;
    }
    if (Math.abs(c.s - rt.distance) < 1.0 && Math.abs(c.x - rt.x) < 1.0 && Math.abs(c.y - playerMidY) < 1.3) {
      c.taken = true;
      if (c.math) {
        startOrbChallenge(rt);
      } else {
        const mult = hasPowerUp(rt, 'multiplier') ? 2 : 1;
        rt.coinsRun += mult;
        rt.stats.coins += mult;
        rt.score += SCORE.perCoin * rt.scoreMult * mult;
        bus.emit('COIN', { value: mult });
      }
    }
  }

  // power-up pickups
  for (const p of rt.pickups) {
    if (p.taken || Math.abs(p.s - rt.distance) > 1.0) continue;
    if (Math.abs(LANES[p.lane] - rt.x) < 1.1 && rt.y < 2.2) {
      p.taken = true;
      activatePowerUp(rt, p.type);
      bus.emit('TOAST', { text: POWERUPS[p.type].label, icon: POWERUPS[p.type].icon });
    }
  }
}

export function stumble(rt: Runtime) {
  rt.lane = rt.prevLane;
  rt.laneTimer = 0;
  rt.sideBumpTimer = 0;
  rt.invuln = PLAYER.invulnTime;
  rt.stumbleFlash = PLAYER.invulnTime;
  rt.shake = 1;
  rt.stats.stumbles++;
  rt.stats.cleanDistance = 0;
  if (!rt.learningMode) rt.hearts -= 1;
  bus.emit('HIT', { kind: 'stumble' });
  if (rt.hearts <= 0) rt.over = true;
}

export function crash(rt: Runtime, o: Obstacle) {
  rt.shake = 1.4;
  if (rt.hoverboard > 0) {
    rt.hoverboard = 0;
    rt.invuln = PLAYER.invulnTime;
    rt.stumbleFlash = PLAYER.invulnTime;
    bus.emit('HIT', { kind: 'absorbed' });
    bus.emit('POWERUP', { type: 'hoverboard', on: false });
    return;
  }
  if (rt.learningMode) {
    rt.lane = safeLane(rt);
    rt.prevLane = rt.lane;
    rt.x = LANES[rt.lane];
    rt.y = 0;
    rt.vy = 0;
    rt.grounded = true;
    rt.invuln = 2;
    rt.stumbleFlash = 2;
    bus.emit('HIT', { kind: 'stumble' });
    return;
  }
  void o;
  bus.emit('HIT', { kind: 'crash' });
  rt.over = true;
}
