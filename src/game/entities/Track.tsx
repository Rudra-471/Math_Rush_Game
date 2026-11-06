import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANES } from '@/config/tuning';
import { game } from '../runtime';
import { BIOMES, biomeIndexAt } from '../world/Biomes';
import { asphaltTex, ballastTex, bumpNoiseTex, concreteTex } from '../materials/textures';
import { pbrMaterial, scrollMaterial, useAssets } from '../assets/assets';

const LEN = 460;
const Z0 = 30; // track extends from +30 (behind camera) to -430
const SLEEPER = 0.9;
const SLEEPERS = Math.ceil(LEN / SLEEPER);
const MAST_SPACING = 30;
const MASTS = Math.ceil(LEN / MAST_SPACING) + 1;
const WIRE_START = -4;
const WIRE_LEN = WIRE_START - (Z0 - LEN);
const WIRE_Z = WIRE_START - WIRE_LEN / 2;
const tmp = new THREE.Object3D();
const col = new THREE.Color();

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** Ballast, concrete sleepers, steel rails, platforms with safety lines, overhead line masts + wires. */
export function Track({ shadows }: { shadows: boolean }) {
  const sleepers = useRef<THREE.InstancedMesh>(null);
  const sleeperGroup = useRef<THREE.Group>(null);
  const masts = useRef<THREE.InstancedMesh>(null);
  const mastGroup = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    const ballast = ballastTex().clone();
    ballast.needsUpdate = true;
    ballast.repeat.set(1, LEN / 4);
    const ground = asphaltTex().clone();
    ground.needsUpdate = true;
    ground.repeat.set(10, LEN / 12);
    const plat = concreteTex('#b2aea6', 'platform').clone();
    plat.needsUpdate = true;
    plat.repeat.set(1, LEN / 6);
    const bump = bumpNoiseTex().clone();
    bump.needsUpdate = true;
    bump.repeat.set(2, LEN / 2);
    return {
      ballast: new THREE.MeshStandardMaterial({ map: ballast, bumpMap: bump, bumpScale: 2.5, roughness: 0.95 }),
      ground: new THREE.MeshStandardMaterial({ map: ground, roughness: 0.95, color: '#7d7a73' }),
      plat: new THREE.MeshStandardMaterial({ map: plat, roughness: 0.85, color: '#b2aea6' }),
      sleeper: new THREE.MeshStandardMaterial({ map: concreteTex('#6f6b65', 'sleeper'), roughness: 0.9, bumpMap: bumpNoiseTex(), bumpScale: 1 }),
      rail: new THREE.MeshStandardMaterial({ color: '#8d939b', metalness: 0.9, roughness: 0.42 }),
      railSide: new THREE.MeshStandardMaterial({ color: '#5a4334', metalness: 0.6, roughness: 0.8 }),
      steel: new THREE.MeshStandardMaterial({ color: '#6d747c', metalness: 0.8, roughness: 0.45 }),
      wire: new THREE.MeshStandardMaterial({ color: '#2d2a27', metalness: 0.7, roughness: 0.5 }),
      yellow: new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.6 }),
      edge: new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.7 }),
    };
  }, []);

  // CC0 photo-scanned PBR materials (null until loaded → procedural fallback above)
  const tex = useAssets((st) => st.tex);
  const real = useMemo(
    () => ({
      ballast: pbrMaterial(tex.gravel, [3, LEN / 2.6], { normalScale: new THREE.Vector2(1.4, 1.4) }),
      sleeper: pbrMaterial(tex.concrete_floor, [0.6, 0.15], { color: '#c9c4bc' }),
      plat: pbrMaterial(tex.rectangular_paving, [1.4, LEN / 2.8]),
      ground: pbrMaterial(tex.asphalt_02, [28, LEN / 8]),
      snow: pbrMaterial(tex.snow_02, [28, LEN / 8]),
    }),
    [tex],
  );
  const groundMesh = useRef<THREE.Mesh>(null);

  const geos = useMemo(() => {
    // rail cross-section: head + web + foot, extruded along the track
    const railG = mergeGeometries([box(0.075, 0.05, LEN, 0, 0.215, 0), box(0.02, 0.09, LEN, 0, 0.15, 0), box(0.14, 0.025, LEN, 0, 0.1, 0)])!;
    railG.translate(0, 0, Z0 - LEN / 2);
    // concrete sleeper with tapered top + rail pads
    const sleeperG = mergeGeometries([box(2.25, 0.15, 0.24, 0, 0.05, 0), box(1.9, 0.04, 0.18, 0, 0.14, 0)])!;
    // overhead-line mast (H-beam) with a cantilever arm spanning the three tracks
    const mastG = mergeGeometries([
      box(0.25, 6.8, 0.25, 0, 3.4, 0),
      box(0.35, 0.4, 0.35, 0, 0.2, 0),
      box(9.2, 0.16, 0.16, 4.6, 6.4, 0),
      box(0.08, 0.9, 0.08, 4.6 - 0.2, 5.95, 0),
      box(0.08, 0.9, 0.08, 4.6 - 2.8, 5.95, 0),
      box(0.08, 0.9, 0.08, 4.6 + 2.4, 5.95, 0),
      box(6.2, 0.06, 0.06, 4.6, 6.0, 0),
    ])!;
    return { railG, sleeperG, mastG };
  }, []);

  useLayoutEffect(() => {
    const m = sleepers.current!;
    let i = 0;
    for (const x of LANES) {
      for (let k = 0; k < SLEEPERS; k++) {
        tmp.position.set(x, 0.02, Z0 - k * SLEEPER);
        tmp.rotation.set(0, 0, 0);
        tmp.scale.set(1, 1, 1);
        tmp.updateMatrix();
        m.setMatrixAt(i++, tmp.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    const M = masts.current!;
    for (let k = 0; k < MASTS; k++) {
      tmp.position.set(-5.4, 0, Z0 - k * MAST_SPACING);
      tmp.updateMatrix();
      M.setMatrixAt(k, tmp.matrix);
    }
    M.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    const d = game.rt.distance;
    if (sleeperGroup.current) sleeperGroup.current.position.z = d % SLEEPER;
    if (mastGroup.current) mastGroup.current.position.z = d % MAST_SPACING;
    // scroll textures with the treadmill
    const v = d / LEN;
    for (const m of [mats.ballast, mats.ground, mats.plat, real.ballast, real.plat, real.ground, real.snow]) scrollMaterial(m, v);
    const bio = BIOMES[biomeIndexAt(d)];
    const k = 1 - Math.exp(-dt * 1.5);
    mats.ground.color.lerp(col.set(bio.ground), k);
    mats.plat.color.lerp(col.set(bio.platform), k);
    if (real.plat) real.plat.color.lerp(col.set(bio.night ? '#8d8a94' : '#ffffff'), k);
    if (groundMesh.current) {
      const want = (bio.decor === 'pine' ? real.snow : real.ground) ?? mats.ground;
      if (groundMesh.current.material !== want) groundMesh.current.material = want;
    }
  });

  const zc = Z0 - LEN / 2;
  return (
    <>
      <mesh ref={groundMesh} rotation-x={-Math.PI / 2} position={[0, -0.03, zc]} receiveShadow material={real.ground ?? mats.ground}>
        <planeGeometry args={[220, LEN]} />
      </mesh>
      {/* ballast bed: one wide strip with sloped shoulders */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0, zc]} receiveShadow material={real.ballast ?? mats.ballast}>
        <planeGeometry args={[8.6, LEN]} />
      </mesh>
      <group ref={sleeperGroup}>
        <instancedMesh ref={sleepers} args={[geos.sleeperG, undefined, SLEEPERS * 3]} material={real.sleeper ?? mats.sleeper} receiveShadow castShadow={false} frustumCulled={false} />
      </group>
      {LANES.map((x) =>
        [-0.72, 0.72].map((o) => (
          <mesh key={`${x}${o}`} geometry={geos.railG} material={mats.rail} position={[x + o, 0, 0]} castShadow={shadows} receiveShadow />
        )),
      )}
      {/* platforms: concrete slab, white coping edge, yellow tactile safety line */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 7.6, 0, zc]}>
          <mesh position={[0, 0.5, 0]} receiveShadow castShadow={false} material={real.plat ?? mats.plat}>
            <boxGeometry args={[3.4, 1.0, LEN]} />
          </mesh>
          <mesh position={[-side * 1.62, 1.01, 0]} material={mats.edge} receiveShadow>
            <boxGeometry args={[0.22, 0.04, LEN]} />
          </mesh>
          <mesh position={[-side * 1.2, 1.012, 0]} material={mats.yellow} receiveShadow>
            <boxGeometry args={[0.32, 0.03, LEN]} />
          </mesh>
          <mesh position={[side * 1.7 - side * 0.05, 1.45, 0]} material={mats.steel}>
            <boxGeometry args={[0.06, 0.9, LEN]} />
          </mesh>
        </group>
      ))}
      {/* overhead contact wires above each track */}
      {/* wires start in front of the camera (a wire passing over the lens smears across the screen) */}
      {LANES.map((x) => (
        <mesh key={`w${x}`} position={[x, 5.55, WIRE_Z]} material={mats.wire}>
          <boxGeometry args={[0.03, 0.03, WIRE_LEN]} />
        </mesh>
      ))}
      {LANES.map((x) => (
        <mesh key={`m${x}`} position={[x, 6.05, WIRE_Z]} material={mats.wire}>
          <boxGeometry args={[0.025, 0.025, WIRE_LEN]} />
        </mesh>
      ))}
      <group ref={mastGroup}>
        <instancedMesh ref={masts} args={[geos.mastG, mats.steel, MASTS]} castShadow={shadows} frustumCulled={false} />
      </group>
    </>
  );
}
