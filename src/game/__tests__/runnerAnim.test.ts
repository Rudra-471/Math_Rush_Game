import { describe, expect, it } from 'vitest';
import {
  airPose, basePose, celebrateLayer, crashPose, fallPose, idlePose, KEYS, landLayer, laneLayer, readyPose, rollPose,
  runPose, stumbleLayer, surfPose, waveLayer, type JumpTrick, type Pose,
} from '../entities/runnerAnim';

const finite = (p: Pose) => KEYS.every((k) => Number.isFinite(p[k]));

describe('runner animation poses', () => {
  it('every state and layer produces finite joint values across its whole range', () => {
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const all: Array<(p: Pose) => void> = [
        (p) => runPose(p, u * 20), (p) => fallPose(p), (p) => rollPose(p, u), (p) => surfPose(p, u * 10),
        (p) => idlePose(p, u * 10), (p) => readyPose(p), (p) => crashPose(p, u),
        (p) => { runPose(p, u); laneLayer(p, u, -1); landLayer(p, u); stumbleLayer(p, u); celebrateLayer(p, u); waveLayer(p, u * 5); },
        ...(['tuck', 'flip', 'spin', 'split'] as JumpTrick[]).map((t) => (p: Pose) => airPose(p, t, u)),
      ];
      for (const f of all) {
        const p = basePose();
        f(p);
        expect(finite(p)).toBe(true);
      }
    }
  });

  it('front flip and roll complete a full turn; spin completes 360° of yaw', () => {
    const flip = basePose(); airPose(flip, 'flip', 1);
    expect(Math.abs(flip.rootX)).toBeCloseTo(Math.PI * 2, 5);
    const roll = basePose(); rollPose(roll, 1);
    expect(Math.abs(roll.rootX)).toBeCloseTo(Math.PI * 2, 5);
    const spin = basePose(); airPose(spin, 'spin', 1);
    expect(spin.rootY).toBeCloseTo(Math.PI * 2, 5);
  });

  it('roll tucks low under the slide hitbox mid-way', () => {
    const p = basePose();
    rollPose(p, 0.45);
    expect(p.pivot).toBeLessThan(0.6);
    expect(p.pelvisY).toBeLessThan(0.7);
  });
});
