import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA, QUALITY, SPEED } from '@/config/tuning';
import { useGame } from '@/store/gameStore';
import { useSettings, effectiveTier } from '@/store/settingsStore';
import { formatAnswer } from '@/math/format';
import { game, hasPowerUp } from '../runtime';
import { stepGame, stepMenu, inTunnel } from './step';
import { onRunOver } from '../runController';
import { intro, introCamera, stepIntro, type CamPose } from '../intro/director';
import { finishIntro } from '../intro/flow';

const lookTarget = new THREE.Vector3();
const introPose: CamPose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50, roll: 0, cut: true };
const introLook = new THREE.Vector3();
const PUBLISH_MS = 100;

/** The single useFrame that ticks every system in order (runs before render: priority −1). */
export function GameLoop() {
  const { camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const lastPublish = useRef(0);
  const camX = useRef(0);
  const camY = useRef(CAMERA.offset[1]);
  const fps = useRef({ frames: 0, t: 0, value: 60, lowFor: 0 });
  const three = useThree();
  if (import.meta.env.DEV) Object.assign(window, { __three: three });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const rt = game.rt;
    const g = useGame.getState();
    const phase = g.phase;

    // --- FPS + auto quality tier (drop a tier if below target for 3 s) ---
    const f = fps.current;
    f.frames++;
    f.t += delta;
    if (f.t >= 0.5) {
      f.value = f.frames / f.t;
      f.frames = 0;
      f.t = 0;
      const s = useSettings.getState();
      if (s.quality === 'auto' && phase === 'RUNNING') {
        const tier = s.autoTier;
        const target = tier === 'low' ? 26 : 45;
        f.lowFor = f.value < target ? f.lowFor + 0.5 : 0;
        if (f.lowFor >= 3 && tier !== 'low') {
          s.setAutoTier(tier === 'high' ? 'medium' : 'low');
          f.lowFor = 0;
        }
      }
    }

    if (phase === 'INTRO') {
      // cinematic: scripted world + choreographed camera (hard cuts snap, moves are damped)
      stepIntro(rt, dt);
      introCamera(rt, introPose);
      const kk = introPose.cut ? 1 : 1 - Math.exp(-dt * 10);
      cam.position.lerp(introPose.pos, kk);
      introLook.lerp(introPose.look, introPose.cut ? 1 : kk);
      cam.lookAt(introLook);
      cam.rotateZ(introPose.roll);
      if (Math.abs(cam.fov - introPose.fov) > 0.05) {
        cam.fov = introPose.cut ? introPose.fov : cam.fov + (introPose.fov - cam.fov) * kk;
        cam.updateProjectionMatrix();
      }
      if (intro.done) finishIntro();
      return;
    }

    if (phase === 'RUNNING') {
      stepGame(rt, dt, QUALITY[effectiveTier()].viewChunks);
      if (rt.over) {
        onRunOver();
        return;
      }
    } else if (phase === 'MENU' || phase === 'PROFILE' || phase === 'BOOT' || phase === 'SETUP') {
      stepMenu(rt, dt);
    }

    // --- camera rig: damped follow, FOV with speed, shake, punch ---
    const running = phase === 'RUNNING' || phase === 'PAUSED' || phase === 'COUNTDOWN' || phase === 'GAME_OVER';
    const k = 1 - Math.exp(-CAMERA.followStiffness * dt);
    camX.current += (rt.x * 0.75 - camX.current) * k;
    const tun = inTunnel(rt);
    const targetY = CAMERA.offset[1] + rt.y * 0.55 - (tun ? 0.35 : 0);
    camY.current += (targetY - camY.current) * (1 - Math.exp(-6 * dt));
    const reduce = useSettings.getState().reduceMotion;
    const shake = reduce ? 0 : rt.shake * CAMERA.shakeAmp;
    const t = state.clock.elapsedTime;
    if (running) {
      cam.position.set(
        camX.current + Math.sin(t * 47) * shake,
        camY.current + Math.cos(t * 53) * shake,
        CAMERA.offset[2] - (reduce ? 0 : rt.punch * 0.6),
      );
      lookTarget.set(camX.current * 0.6, 1.0 + rt.y * 0.5, -CAMERA.lookAhead);
    } else {
      // attract mode: slow orbit around the runner
      const a = Math.sin(t * 0.25) * 0.5;
      cam.position.set(Math.sin(a) * 7, 3.0, Math.cos(a) * 7);
      lookTarget.set(0, 1.4, -2);
    }
    cam.lookAt(lookTarget);
    const { vStart, vMax } = SPEED[rt.band];
    const sp = THREE.MathUtils.clamp((rt.speed - vStart) / (vMax - vStart), 0, 1);
    const fovTarget = running && !reduce ? CAMERA.fovMin + (CAMERA.fovMax - CAMERA.fovMin) * sp : CAMERA.fovMin;
    if (Math.abs(cam.fov - fovTarget) > 0.05) {
      cam.fov += (fovTarget - cam.fov) * (1 - Math.exp(-3 * dt));
      cam.updateProjectionMatrix();
    }

    // --- publish coarse values to the UI every 100 ms ---
    const now = performance.now();
    if (phase === 'RUNNING' && now - lastPublish.current > PUBLISH_MS) {
      lastPublish.current = now;
      g.setHud({
        score: Math.round(rt.score),
        coins: rt.coinsRun,
        distance: Math.floor(rt.distance),
        hearts: rt.hearts,
        streak: rt.streak,
        mult: rt.streak >= 10 ? 4 : rt.streak >= 6 ? 3 : rt.streak >= 3 ? 2 : 1,
        powerups: rt.powerups.map((p) => ({ type: p.type, remaining: p.remaining, total: p.total })),
        hoverboard: rt.hoverboard,
        hoverboardReady: !rt.hoverboardUsed,
        inTunnel: tun,
      });
      if (useSettings.getState().debug) {
        const next = rt.gates.find((x) => x.state !== 'resolved' && x.question);
        g.setDebug({
          fps: Math.round(f.value),
          speed: Math.round(rt.speed * 10) / 10,
          chunk: rt.activeChunkId,
          next: next?.question
            ? `${next.question.skillId} L${next.question.level} P=${next.pCorrect.toFixed(2)} → ${formatAnswer(next.question.answer)}`
            : '—',
        });
      }
      void hasPowerUp;
    }
  }, -1);

  return null;
}
