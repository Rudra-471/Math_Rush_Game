import { PLAYER, WORLD } from '@/config/tuning';
import { footprint, type Pattern } from './chunks';

/**
 * Fairness validator (SPEC 6.5): from any lane at chunk entry, at the given speed a safe path
 * must exist. Trains block a lane (moving trains block from their start to the chunk end;
 * ramped trains are passable only by staying in lane from the ramp). Barriers are passable
 * (jump/slide) but two barrier rows closer than one jump arc in the same lane fail.
 * Edges (first/last 4 m) must be free of trains so chunk joins are always fair.
 */
export function validatePattern(p: Pattern, speed: number): { ok: boolean; reason?: string } {
  const L = p.length;
  const blocked: boolean[][] = [0, 1, 2].map(() => Array(L + 1).fill(false));
  const rampEntry: boolean[][] = [0, 1, 2].map(() => Array(L + 1).fill(false));
  const barriers: number[][] = [[], [], []];

  for (const o of p.objects) {
    if (o.type === 'coinLine') continue;
    const [a, b] = footprint(o, WORLD.trainCarLength, WORLD.rampLength, WORLD.barrierDepth);
    if (o.lane < 0 || o.lane > 2) return { ok: false, reason: `bad lane in ${p.id}` };
    if (o.type === 'low' || o.type === 'high') {
      barriers[o.lane].push(o.z);
      continue;
    }
    if (a < 4 || b > L - 4) return { ok: false, reason: `${p.id}: train touches chunk edge` };
    const end = o.type === 'movingTrain' ? L : Math.ceil(b);
    for (let z = Math.floor(a); z <= end; z++) {
      blocked[o.lane][z] = true;
      if (o.type === 'rampTrain') rampEntry[o.lane][z] = true;
    }
  }

  // Barriers in one lane must be at least one jump arc apart.
  const arc = speed * PLAYER.jumpAirtime;
  for (const zs of barriers) {
    zs.sort((x, y) => x - y);
    for (let i = 1; i < zs.length; i++) {
      if (zs[i] - zs[i - 1] < Math.min(arc, 8)) return { ok: false, reason: `${p.id}: barriers too close` };
    }
  }

  // DP over 1 m slices, separately for every entry lane.
  const laneChangeM = Math.ceil(speed * PLAYER.laneChangeTime) + 1;
  const open = (l: number, z: number) => z > L || !blocked[l][z] || rampEntry[l][z];
  for (let start = 0; start < 3; start++) {
    let reach = [0, 1, 2].map((l) => l === start);
    for (let z = 0; z < L; z++) {
      const next = [false, false, false];
      for (let l = 0; l < 3; l++) {
        if (!reach[l]) continue;
        if (open(l, z + 1)) next[l] = true;
        // lane change: current lane free for the first half, target lane for the whole move
        for (const nl of [l - 1, l + 1]) {
          if (nl < 0 || nl > 2) continue;
          let free = true;
          for (let k = 1; k <= laneChangeM; k++) {
            if (!open(nl, z + k) || (k <= laneChangeM / 2 && !open(l, z + k))) free = false;
          }
          // landing in the target lane at z + laneChangeM: mark reachable there by keeping lane open
          if (free) next[nl] = true;
        }
      }
      reach = next;
      if (!reach.some(Boolean)) return { ok: false, reason: `${p.id}: no safe path from lane ${start} at z=${z}` };
    }
  }
  return { ok: true };
}
