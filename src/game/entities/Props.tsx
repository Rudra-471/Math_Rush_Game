import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game } from '../runtime';
import { BIOMES, biomeIndexAt } from '../world/Biomes';
import { useAssets, type ModelPart } from '../assets/assets';

const LAMP_SPACING = 22;
const BENCH_SPACING = 44;
const N_LAMPS = 26;
const N_BENCH = 14;
const PLATFORM_TOP = 1.0;
const tmp = new THREE.Object3D();

/** Instanced copies of every part of a glTF model, sharing one matrix list. */
function InstancedModel({ parts, count, place, shadows }: { parts: ModelPart[]; count: number; place: (i: number, o: THREE.Object3D) => void; shadows: boolean }) {
  const refs = useRef<Array<THREE.InstancedMesh | null>>([]);
  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      tmp.position.set(0, 0, 0);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(1, 1, 1);
      place(i, tmp);
      tmp.updateMatrix();
      for (const m of refs.current) m?.setMatrixAt(i, tmp.matrix);
    }
    for (const m of refs.current) if (m) m.instanceMatrix.needsUpdate = true;
  }, [count, place, parts]);
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          args={[p.geometry, p.material, count]}
          castShadow={shadows}
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </>
  );
}

const placeLamp = (i: number, o: THREE.Object3D) => {
  const side = i % 2 ? 1 : -1;
  o.position.set(side * 8.9, PLATFORM_TOP, 30 - Math.floor(i / 2) * LAMP_SPACING);
  o.scale.setScalar(1.3);
};
const placeBench = (i: number, o: THREE.Object3D) => {
  const side = i % 2 ? 1 : -1;
  o.position.set(side * 8.55, PLATFORM_TOP, 30 - Math.floor(i / 2) * BENCH_SPACING - 11);
  o.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2; // face the tracks
};

/** CC0 street furniture on the platforms (Poly Haven street lamp + bench), scrolled as a group. */
export function Props({ shadows }: { shadows: boolean }) {
  const models = useAssets((s) => s.models);
  const lampGroup = useRef<THREE.Group>(null);
  const benchGroup = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const d = game.rt.distance;
    if (lampGroup.current) lampGroup.current.position.z = d % LAMP_SPACING;
    if (benchGroup.current) benchGroup.current.position.z = d % BENCH_SPACING;
    const night = BIOMES[biomeIndexAt(d)].night;
    // lamp heads glow at night
    const lamp = models.street_lamp_01;
    if (lamp) for (const p of lamp) {
      const m = p.material as THREE.MeshStandardMaterial;
      if (m.emissive) {
        m.emissive.set(night ? '#ffd28a' : '#000000');
        m.emissiveIntensity = night ? 0.6 : 0;
      }
    }
    if (glow.current) glow.current.intensity = night ? 12 : 0;
  });

  return (
    <>
      {models.street_lamp_01 && (
        <group ref={lampGroup}>
          <InstancedModel parts={models.street_lamp_01} count={N_LAMPS} place={placeLamp} shadows={shadows} />
        </group>
      )}
      {models.painted_wooden_bench && (
        <group ref={benchGroup}>
          <InstancedModel parts={models.painted_wooden_bench} count={N_BENCH} place={placeBench} shadows={shadows} />
        </group>
      )}
      <pointLight ref={glow} position={[0, 5, -6]} distance={22} intensity={0} color="#ffd9a0" />
    </>
  );
}
