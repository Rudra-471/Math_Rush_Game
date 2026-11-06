import type { Band } from '@/math/types';
import { countTokens } from '@/math/format';
import { PLAYER, SAFETY_METERS, SPAWN_CLAMP, SPEED, TIMING } from '@/config/tuning';

/** SPEC 6.2: speed rises quickly then levels off. */
export function speedAt(distance: number, band: Band): number {
  const { vStart, vMax, k } = SPEED[band];
  return vStart + (vMax - vStart) * (1 - Math.exp(-distance / k));
}

export interface Timing {
  readTime: number;
  decideTime: number;
  spawnDist: number;
}

/**
 * SPEC 7.6 (critical): the question banner appears spawnDist metres before the gate so a
 * child has time to read + decide + change lanes.
 */
export function questionTiming(prompt: string, band: Band, speed: number, levelFraction: number, voice = false): Timing {
  const t = TIMING[band];
  // Voice read-out helps young readers, but they still need the reading time budget.
  const readTime = t.baseRead + t.perToken * countTokens(prompt) + (voice && band === 'beginner' ? 0.4 : 0);
  const decideTime = t.baseDecide * (1 + 0.15 * levelFraction);
  const raw = speed * (readTime + decideTime + PLAYER.laneChangeTime * 2) + SAFETY_METERS;
  const spawnDist = Math.min(SPAWN_CLAMP[1], Math.max(SPAWN_CLAMP[0], raw));
  return { readTime, decideTime, spawnDist };
}
