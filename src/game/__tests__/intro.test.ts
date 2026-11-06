import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bus } from '@/events/bus';
import { game } from '../runtime';
import { intro, introCamera, introLength, startIntro, stepIntro, type CamPose } from '../intro/director';

describe('intro cinematic', () => {
  it('plays all shots, jumps the barrier, picks the right gate and ends in ~20–30 s', () => {
    bus.all.clear();
    const cues: string[] = [];
    bus.on('INTRO', (e) => cues.push(e.cue));
    startIntro();
    const rt = game.rt;
    const pose: CamPose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50, roll: 0, cut: false };
    const shots = new Set<string>();
    let maxY = 0;
    for (let i = 0; i < 60 * 40 && !intro.done; i++) {
      stepIntro(rt, 1 / 60);
      introCamera(rt, pose);
      shots.add(intro.shot);
      maxY = Math.max(maxY, rt.y);
      expect(Number.isFinite(pose.pos.x + pose.pos.y + pose.pos.z)).toBe(true);
    }
    expect(intro.done).toBe(true);
    expect(introLength()).toBeGreaterThan(18);
    expect(introLength()).toBeLessThan(30);
    expect([...shots]).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(maxY).toBeGreaterThan(1.2); // jumped
    expect(rt.gates[0].result).toEqual({ chosen: 2, correct: true });
    expect(cues).toEqual(['drone', 'horn', 'pass', 'boom', 'question', 'riser', 'go', 'title']);
    expect(rt.obstacles.some((o) => o.id === 99)).toBe(false); // express removed after its shot
  });
});
