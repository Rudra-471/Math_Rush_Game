import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRAVITY, LANES, PLAYER } from '@/config/tuning';
import { bus } from '@/events/bus';
import { useGame } from '@/store/gameStore';
import {
  airPose, basePose, celebrateLayer, crashPose, fallPose, idlePose, KEYS, landLayer, laneLayer, readyPose, rollPose,
  runPose, stumbleLayer, surfPose, waveLayer, type JumpTrick, type Pose,
} from './runnerAnim';
import type { CharacterDef } from '@/meta/shop';
import { game } from '../runtime';
import { fabricTex } from '../materials/textures';

interface Props {
  character: CharacterDef;
  boardColor: string;
  trailColor: string;
  shadows: boolean;
  /** turntable preview mode (character select) */
  preview?: boolean;
}

/** Capsule limb hanging down from its joint (joint at local origin). */
function Limb({ r, len, mat, shadows, scale }: { r: number; len: number; mat: THREE.Material; shadows: boolean; scale?: [number, number, number] }) {
  return (
    <mesh position={[0, -len / 2 - r * 0.3, 0]} material={mat} castShadow={shadows} scale={scale}>
      <capsuleGeometry args={[r, len, 6, 14]} />
    </mesh>
  );
}

/**
 * Realistic-proportioned procedural runner (original design) with a jointed skeleton and an
 * animation state machine: sprint, jump tricks (tuck / flip / spin / split), forward roll,
 * lane-change hop, landing squash, hoverboard surf, stumble, crash and fist pump.
 */
export function Player({ character: c, boardColor, trailColor, shadows, preview }: Props) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const offset = useRef<THREE.Group>(null);
  const pelvis = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const j = {
    shL: useRef<THREE.Group>(null), shR: useRef<THREE.Group>(null),
    elL: useRef<THREE.Group>(null), elR: useRef<THREE.Group>(null),
    hipL: useRef<THREE.Group>(null), hipR: useRef<THREE.Group>(null),
    knL: useRef<THREE.Group>(null), knR: useRef<THREE.Group>(null),
    anL: useRef<THREE.Group>(null), anR: useRef<THREE.Group>(null),
  };
  const board = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Mesh>(null);
  const blob = useRef<THREE.Mesh>(null);
  const phase = useRef(0);

  const m = useMemo(
    () => ({
      skin: new THREE.MeshPhysicalMaterial({ color: c.skin, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#ffd9c4'), sheenRoughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: c.hair, roughness: 0.6, metalness: 0.05 }),
      top: new THREE.MeshStandardMaterial({ map: fabricTex(c.shirt, `top-${c.id}`), roughness: 0.85 }),
      pants: new THREE.MeshStandardMaterial({ map: fabricTex(c.pants, `pants-${c.id}`, true), roughness: 0.9 }),
      shoe: new THREE.MeshStandardMaterial({ color: c.shoes, roughness: 0.45 }),
      sole: new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.7 }),
      pack: new THREE.MeshStandardMaterial({ color: '#2b3440', roughness: 0.75 }),
      strap: new THREE.MeshStandardMaterial({ color: '#15191f', roughness: 0.7 }),
      accent: new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.5, metalness: 0.1 }),
      dark: new THREE.MeshStandardMaterial({ color: '#101215', roughness: 0.25 }),
      eyeW: new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.3 }),
    }),
    [c],
  );

  const anim = useRef({
    t: 0, jumpAt: -9, airDur: 0.62, trick: 'tuck' as JumpTrick, lastTrick: 'tuck' as JumpTrick,
    landAt: -9, laneAt: -9, laneDir: 1, stumbleAt: -9, crashAt: -9, celebAt: -9, rt: null as unknown,
  });
  const cur = useRef<Pose>(basePose());
  const target = useRef<Pose>(basePose());

  // game events drive the animation state machine
  useEffect(() => {
    if (preview) return;
    const A = anim.current;
    const onJump = () => {
      const rt = game.rt;
      A.jumpAt = A.t;
      A.airDur = Math.max(0.3, (2 * rt.vy) / GRAVITY);
      const big = A.airDur > 0.75;
      const r = Math.random();
      let trick: JumpTrick = big ? (r < 0.5 ? 'flip' : r < 0.8 ? 'spin' : 'tuck') : r < 0.4 ? 'tuck' : r < 0.65 ? 'spin' : r < 0.85 ? 'split' : 'flip';
      if (trick === A.lastTrick && trick !== 'tuck') trick = 'tuck';
      A.trick = A.lastTrick = trick;
    };
    const onLand = () => { A.landAt = A.t; A.jumpAt = -9; };
    const onLane = () => {
      const rt = game.rt;
      A.laneAt = A.t;
      A.laneDir = Math.sign(LANES[rt.lane] - rt.x) || 1;
    };
    const onHit = (e: { kind: 'stumble' | 'crash' | 'absorbed' }) => {
      if (e.kind === 'crash') A.crashAt = A.t;
      else A.stumbleAt = A.t;
    };
    const onGate = (e: { correct: boolean }) => { if (e.correct) A.celebAt = A.t; };
    bus.on('JUMP', onJump);
    bus.on('LAND', onLand);
    bus.on('LANE', onLane);
    bus.on('HIT', onHit);
    bus.on('GATE_PASSED', onGate);
    return () => {
      bus.off('JUMP', onJump);
      bus.off('LAND', onLand);
      bus.off('LANE', onLane);
      bus.off('HIT', onHit);
      bus.off('GATE_PASSED', onGate);
    };
  }, [preview]);

  useFrame((_, dt) => {
    const rt = game.rt;
    const g = root.current, P = pelvis.current, S = spine.current, SP = spin.current, OF = offset.current;
    if (!g || !P || !S || !SP || !OF) return;
    const A = anim.current;
    if (A.rt !== rt) {
      // new run / new scene: clear one-shot states
      Object.assign(A, { rt, jumpAt: -9, landAt: -9, laneAt: -9, stumbleAt: -9, crashAt: -9, celebAt: -9 });
    }
    const phaseName = useGame.getState().phase;
    const scale = phaseName === 'RUNNING' || phaseName === 'INTRO' ? rt.timeScale : 1;
    A.t += dt * scale;
    const t = A.t;
    const T = target.current;
    Object.assign(T, basePose());

    if (preview) {
      g.position.set(0, 0, 0);
      idlePose(T, t);
      T.headY = 0;
      waveLayer(T, t);
    } else {
      g.position.set(rt.x, rt.y + (rt.hoverboard > 0 ? 0.2 : 0), 0);
      const rolling = rt.sliding > 0 && rt.grounded;
      if (A.crashAt > 0) crashPose(T, (t - A.crashAt) / 0.55);
      else if (rt.pose === 'idle') idlePose(T, t);
      else if (rt.pose === 'ready') readyPose(T);
      else if (rolling) rollPose(T, 1 - rt.sliding / PLAYER.slideTime);
      else if (!rt.grounded) {
        const u = (t - A.jumpAt) / A.airDur;
        if (A.jumpAt > 0 && u < 1.05 && rt.sliding <= 0) airPose(T, A.trick, u);
        else fallPose(T);
      } else if (rt.hoverboard > 0) surfPose(T, t);
      else {
        const speedFactor = Math.max(0.45, rt.speed / 12);
        phase.current += dt * scale * 8.5 * speedFactor;
        runPose(T, phase.current, Math.min(1, 0.55 + rt.speed / 20));
      }
      if (A.crashAt < 0) {
        if (t - A.laneAt < 0.24) laneLayer(T, (t - A.laneAt) / 0.24, A.laneDir);
        if (t - A.landAt < 0.16 && rt.grounded && !rolling) landLayer(T, (t - A.landAt) / 0.16);
        if (t - A.stumbleAt < 0.6) stumbleLayer(T, (t - A.stumbleAt) / 0.6);
        if (t - A.celebAt < 0.55 && rt.grounded && !rolling && rt.hoverboard <= 0) celebrateLayer(T, (t - A.celebAt) / 0.55);
      }
    }

    // blend toward the target (snappy); whole-body trick rotations are applied exactly
    const C = cur.current;
    const k = 1 - Math.exp(-dt * 20);
    for (const key of KEYS) {
      if (key === 'rootX' || key === 'rootY') C[key] = T[key];
      else C[key] += (T[key] - C[key]) * k;
    }
    P.position.y = C.pelvisY;
    S.rotation.set(C.spineX, C.spineY, C.spineZ);
    if (head.current) head.current.rotation.set(C.headX, C.headY, 0);
    j.hipL.current!.rotation.set(C.hipL, 0, C.hipLz);
    j.hipR.current!.rotation.set(C.hipR, 0, C.hipRz);
    j.knL.current!.rotation.x = C.knL;
    j.knR.current!.rotation.x = C.knR;
    j.anL.current!.rotation.x = C.anL;
    j.anR.current!.rotation.x = C.anR;
    j.shL.current!.rotation.set(C.shL, 0, C.shLz);
    j.shR.current!.rotation.set(C.shR, 0, C.shRz);
    j.elL.current!.rotation.x = C.elL;
    j.elR.current!.rotation.x = C.elR;
    SP.position.set(0, C.pivot, C.rootDz);
    OF.position.y = -C.pivot;
    SP.rotation.set(C.rootX, C.rootY, C.rootZ);

    if (preview) return;
    g.visible = rt.stumbleFlash > 0 && A.crashAt < 0 ? Math.floor(rt.elapsed * 14) % 2 === 0 : true;
    if (board.current) board.current.visible = rt.hoverboard > 0;
    if (trail.current) trail.current.visible = trailColor !== 'transparent' && rt.grounded && rt.sliding <= 0 && rt.pose === 'run';
    if (blob.current) {
      blob.current.position.y = -rt.y + rt.groundY + 0.03;
      blob.current.scale.setScalar(Math.max(0.4, 1 - (rt.y - rt.groundY) * 0.25));
    }
  });

  const acc = c.accessory;
  const sh = shadows;
  return (
    <group ref={root}>
      <group ref={spin} position={[0, 1, 0]} rotation-order="YXZ">
      <group ref={offset} position={[0, -1, 0]}>
      <group ref={pelvis} position={[0, 0.95, 0]}>
        {/* hips / shorts top */}
        <mesh material={m.pants} castShadow={sh} scale={[1.25, 0.8, 0.85]}>
          <sphereGeometry args={[0.15, 18, 12]} />
        </mesh>
        {/* legs */}
        {([['hipL', 'knL', 'anL', -0.095], ['hipR', 'knR', 'anR', 0.095]] as const).map(([hip, kn, an, x]) => (
          <group key={hip} ref={j[hip]} position={[x, -0.04, 0]}>
            <Limb r={0.068} len={0.36} mat={m.pants} shadows={sh} />
            <group ref={j[kn]} position={[0, -0.45, 0]}>
              <Limb r={0.055} len={0.34} mat={m.pants} shadows={sh} />
              <group ref={j[an]} position={[0, -0.4, 0]}>
                <mesh position={[0, -0.03, -0.05]} material={m.shoe} castShadow={sh}>
                  <boxGeometry args={[0.11, 0.08, 0.27]} />
                </mesh>
                <mesh position={[0, -0.075, -0.05]} material={m.sole}>
                  <boxGeometry args={[0.12, 0.03, 0.29]} />
                </mesh>
              </group>
            </group>
          </group>
        ))}
        {/* upper body */}
        <group ref={spine} position={[0, 0.06, 0]}>
          <mesh position={[0, 0.27, 0]} material={m.top} castShadow={sh} scale={[1.3, 1, 0.78]}>
            <capsuleGeometry args={[0.15, 0.26, 8, 18]} />
          </mesh>
          {/* hood bunched at the neck */}
          <mesh position={[0, 0.5, 0.05]} material={m.top} scale={[1.2, 0.5, 1]}>
            <torusGeometry args={[0.1, 0.045, 8, 18]} />
          </mesh>
          {/* backpack + straps */}
          <mesh position={[0, 0.3, 0.17]} material={m.pack} castShadow={sh}>
            <boxGeometry args={[0.28, 0.34, 0.13]} />
          </mesh>
          <mesh position={[0, 0.2, 0.24]} material={m.strap}>
            <boxGeometry args={[0.2, 0.12, 0.03]} />
          </mesh>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 0.36, -0.09]} material={m.strap} rotation-x={0.1}>
              <boxGeometry args={[0.04, 0.3, 0.02]} />
            </mesh>
          ))}
          {/* neck + head */}
          <mesh position={[0, 0.55, 0]} material={m.skin}>
            <cylinderGeometry args={[0.045, 0.05, 0.1, 12]} />
          </mesh>
          <group ref={head} position={[0, 0.7, 0]}>
            <mesh material={m.skin} castShadow={sh} scale={[0.9, 1.08, 0.98]}>
              <sphereGeometry args={[0.115, 24, 18]} />
            </mesh>
            {/* hair cap (thicker at the back) */}
            <mesh position={[0, 0.03, 0.012]} material={m.hair} scale={[0.95, 0.95, 1.02]}>
              <sphereGeometry args={[0.122, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            </mesh>
            <mesh position={[0, -0.01, 0.03]} material={m.hair} scale={[0.93, 0.85, 0.9]}>
              <sphereGeometry args={[0.118, 20, 12, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.5]} />
            </mesh>
            {[-0.1, 0.1].map((x) => (
              <mesh key={x} position={[x * 1.02, -0.005, 0]} material={m.skin} scale={[0.4, 0.7, 0.5]}>
                <sphereGeometry args={[0.04, 10, 8]} />
              </mesh>
            ))}
            {[-0.038, 0.038].map((x) => (
              <group key={x} position={[x, 0.005, -0.104]}>
                <mesh material={m.eyeW} scale={[1, 0.6, 0.4]}><sphereGeometry args={[0.018, 10, 8]} /></mesh>
                <mesh position={[0, 0, -0.006]} material={m.dark}><sphereGeometry args={[0.009, 8, 6]} /></mesh>
              </group>
            ))}
            <mesh position={[0, -0.025, -0.115]} material={m.skin} scale={[0.7, 1, 0.9]}><sphereGeometry args={[0.018, 8, 6]} /></mesh>
            {acc === 'cap' && (
              <group position={[0, 0.06, 0]}>
                <mesh material={m.accent} scale={[1, 0.62, 1.05]}><sphereGeometry args={[0.128, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
                <mesh position={[0, -0.005, -0.15]} material={m.accent} rotation-x={0.12}><boxGeometry args={[0.18, 0.012, 0.11]} /></mesh>
              </group>
            )}
            {acc === 'ponytail' && (
              <mesh position={[0, 0.0, 0.16]} material={m.hair} rotation-x={0.5} scale={[0.6, 1.5, 0.6]}><sphereGeometry args={[0.06, 12, 10]} /></mesh>
            )}
            {acc === 'bun' && <mesh position={[0, 0.1, 0.09]} material={m.hair}><sphereGeometry args={[0.055, 12, 10]} /></mesh>}
            {acc === 'headband' && (
              <mesh position={[0, 0.04, 0]} rotation-x={Math.PI / 2 - 0.15} material={m.accent}><torusGeometry args={[0.118, 0.014, 6, 24]} /></mesh>
            )}
            {acc === 'turban' && (
              <mesh position={[0, 0.07, 0.01]} material={m.accent} scale={[1.05, 0.75, 1.1]}><sphereGeometry args={[0.135, 20, 12]} /></mesh>
            )}
            {acc === 'helmet' && (
              <mesh position={[0, 0.03, 0]} material={m.accent} scale={[1.12, 1, 1.15]}><sphereGeometry args={[0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} /></mesh>
            )}
            {acc === 'glasses' && (
              <group position={[0, 0.005, -0.112]}>
                {[-0.038, 0.038].map((x) => <mesh key={x} position={[x, 0, 0]} material={m.dark}><torusGeometry args={[0.024, 0.004, 6, 16]} /></mesh>)}
              </group>
            )}
          </group>
          {/* arms */}
          {([['shL', 'elL', -0.21], ['shR', 'elR', 0.21]] as const).map(([shName, elName, x]) => (
            <group key={shName} ref={j[shName]} position={[x, 0.45, 0]}>
              <mesh material={m.top} scale={[1, 0.9, 1]}><sphereGeometry args={[0.065, 12, 10]} /></mesh>
              <Limb r={0.05} len={0.22} mat={m.top} shadows={sh} />
              <group ref={j[elName]} position={[0, -0.3, 0]}>
                <Limb r={0.042} len={0.2} mat={m.top} shadows={sh} />
                <mesh position={[0, -0.3, 0]} material={m.skin} scale={[0.8, 1.1, 0.55]}>
                  <sphereGeometry args={[0.048, 10, 8]} />
                </mesh>
              </group>
            </group>
          ))}
          {/* hood resting on the upper back */}
          <mesh position={[0, 0.5, 0.11]} rotation-x={0.5} material={m.top} scale={[1.1, 0.7, 0.6]}>
            <sphereGeometry args={[0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      </group>
      </group>
      </group>
      <mesh ref={board} position={[0, 0.06, 0]} visible={false} castShadow={sh}>
        <boxGeometry args={[0.55, 0.06, 1.35]} />
        <meshPhysicalMaterial color={boardColor} metalness={0.4} roughness={0.25} clearcoat={1} emissive={boardColor} emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={trail} position={[0, 0.06, 1.6]} visible={false}>
        <boxGeometry args={[0.35, 0.02, 2.6]} />
        <meshBasicMaterial color={trailColor === 'transparent' ? '#ffffff' : trailColor} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </mesh>
      {!shadows && !preview && (
        <mesh ref={blob} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <circleGeometry args={[0.45, 24]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
