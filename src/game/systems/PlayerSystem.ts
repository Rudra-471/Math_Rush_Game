import { GRAVITY, JUMP_V, LANES, LANE_WIDTH, PLAYER, WORLD } from '@/config/tuning';
import { bus } from '@/events/bus';
import { hasPowerUp, type Runtime } from '../runtime';

const LANE_K = 3.2 / PLAYER.laneChangeTime; // ease-out lerp rate

/** Height of the walkable surface (train roof / ramp) under the player, or 0. */
export function surfaceUnder(rt: Runtime): number {
  let best = 0;
  for (const o of rt.obstacles) {
    if (o.kind !== 'train' && o.kind !== 'movingTrain' && o.kind !== 'ramp') continue;
    if (Math.abs(rt.x - LANES[o.lane]) > WORLD.trainWidth / 2 + 0.1) continue;
    if (rt.distance < o.s || rt.distance > o.s + o.len) continue;
    const h = o.kind === 'ramp' ? (o.top * (rt.distance - o.s)) / o.len : o.top;
    // only stand on it if our feet are near/above the surface (step-up tolerance for ramps)
    if (rt.y >= h - 0.45 && h > best) best = h;
  }
  return best;
}

export function playerHeight(rt: Runtime): number {
  return rt.sliding > 0 ? PLAYER.slideHeight : PLAYER.height;
}

export function playerUpdate(rt: Runtime, dt: number) {
  rt.laneTimer += dt;
  rt.sideBumpTimer += dt;
  if (rt.invuln > 0) rt.invuln -= dt;

  // --- input (buffered, max 1 extra) ---
  if (rt.inputQueue.length > PLAYER.bufferMax + 1) rt.inputQueue.splice(0, rt.inputQueue.length - PLAYER.bufferMax - 1);
  const action = rt.inputQueue[0];
  if (action) {
    let consumed = false;
    if (action === 'left' || action === 'right') {
      // a new lane change starts once the previous one is mostly done
      if (rt.laneTimer >= PLAYER.laneChangeTime * 0.6 || rt.sideBumpTimer < PLAYER.coyoteTime) {
        const target = rt.lane + (action === 'left' ? -1 : 1);
        if (target >= 0 && target <= 2) {
          rt.prevLane = rt.lane;
          rt.lane = target;
          rt.laneTimer = 0;
          bus.emit('LANE');
        }
        consumed = true;
      }
    } else if (action === 'up') {
      if (rt.grounded) {
        const peak = PLAYER.jumpPeak * (hasPowerUp(rt, 'sneakers') ? PLAYER.sneakersMult : 1);
        rt.vy = hasPowerUp(rt, 'sneakers') ? Math.sqrt(2 * GRAVITY * peak) : JUMP_V;
        rt.grounded = false;
        rt.sliding = 0;
        bus.emit('JUMP');
        consumed = true;
      }
    } else if (action === 'down') {
      if (rt.grounded) {
        rt.sliding = PLAYER.slideTime;
        bus.emit('SLIDE');
      } else {
        rt.vy = Math.min(rt.vy, -JUMP_V); // fast fall, then slide on landing
        rt.sliding = PLAYER.slideTime;
      }
      consumed = true;
    }
    if (consumed) rt.inputQueue.shift();
  }

  // --- horizontal ---
  const tx = LANES[rt.lane];
  rt.x += (tx - rt.x) * (1 - Math.exp(-LANE_K * dt));
  if (Math.abs(tx - rt.x) < 0.002) rt.x = tx;

  // --- vertical ---
  const ground = surfaceUnder(rt);
  rt.groundY = ground;
  if (rt.grounded) {
    if (ground < rt.y - 0.05) rt.grounded = false; // walked off a roof
    else rt.y = ground;
  }
  if (!rt.grounded) {
    const g = GRAVITY * (rt.vy < 0 && rt.sliding > 0 ? 3 : 1);
    rt.vy -= g * dt;
    rt.y += rt.vy * dt;
    if (rt.y <= ground) {
      rt.y = ground;
      rt.vy = 0;
      rt.grounded = true;
      bus.emit('LAND');
    }
  }
  if (rt.grounded && rt.sliding > 0) rt.sliding -= dt;
  if (rt.stumbleFlash > 0) rt.stumbleFlash -= dt;
}

/** Nearest lane index to the current x (used to decide which gate/orb was chosen). */
export function laneAtX(x: number): number {
  return Math.max(0, Math.min(2, Math.round(x / LANE_WIDTH) + 1));
}
