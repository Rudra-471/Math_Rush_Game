import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LANES, POWERUPS, type PowerUpType } from '@/config/tuning';
import { game } from '../runtime';
import { iconTexture, Label } from './labelTexture';
import { coinGeometry } from './models';

const MAX_COINS = 160;
const MAX_MATH = 8;
const tmp = new THREE.Object3D();

/** Coins (one InstancedMesh), operation coins, power-up pickups and maths orbs. */
export function Collectibles() {
  const coins = useRef<THREE.InstancedMesh>(null);
  const mathCoins = useRef<THREE.InstancedMesh>(null);
  const pickupRefs = useRef<Array<THREE.Sprite | null>>([]);
  const orbRefs = useRef<Array<THREE.Group | null>>([]);
  const orbLabels = useMemo(() => [0, 1, 2].map(() => new Label(256, 128)), []);
  const icons = useMemo(() => {
    const out = {} as Record<PowerUpType, THREE.SpriteMaterial>;
    for (const k of Object.keys(POWERUPS) as PowerUpType[]) {
      out[k] = new THREE.SpriteMaterial({ map: iconTexture(POWERUPS[k].icon, POWERUPS[k].color), depthWrite: false });
    }
    return out;
  }, []);
  const lastOrbVersion = useRef(-1);
  const coinGeo = useMemo(() => coinGeometry(), []);

  useEffect(() => () => orbLabels.forEach((l) => l.dispose()), [orbLabels]);

  useFrame(() => {
    const rt = game.rt;
    const d = rt.distance;
    const spin = rt.elapsed * 4;
    let n = 0, m = 0;
    for (const c of rt.coins) {
      if (c.taken || c.s > d + 200 || c.s < d - 5) continue;
      tmp.position.set(c.x, c.y + Math.sin(rt.elapsed * 3 + c.s) * 0.08, d - c.s);
      tmp.rotation.set(0, spin + c.s * 0.3, 0);
      tmp.scale.setScalar(c.math ? 1.5 : 1);
      tmp.updateMatrix();
      if (c.math) {
        if (m < MAX_MATH) mathCoins.current!.setMatrixAt(m++, tmp.matrix);
      } else if (n < MAX_COINS) coins.current!.setMatrixAt(n++, tmp.matrix);
    }
    coins.current!.count = n;
    coins.current!.instanceMatrix.needsUpdate = true;
    mathCoins.current!.count = m;
    mathCoins.current!.instanceMatrix.needsUpdate = true;

    // pickups (max 3 visible)
    let p = 0;
    for (const pu of rt.pickups) {
      if (pu.taken || pu.s > d + 200 || pu.s < d - 5 || p >= 3) continue;
      const sp = pickupRefs.current[p++];
      if (!sp) continue;
      sp.visible = true;
      sp.material = icons[pu.type];
      sp.position.set(LANES[pu.lane], 1.2 + Math.sin(rt.elapsed * 4) * 0.15, d - pu.s);
    }
    for (; p < 3; p++) if (pickupRefs.current[p]) pickupRefs.current[p]!.visible = false;

    // orbs
    if (lastOrbVersion.current !== rt.gatesVersion) {
      lastOrbVersion.current = rt.gatesVersion;
      rt.orbs.forEach((o, i) => orbLabels[i].draw(o.label, '#7c3aed'));
    }
    for (let i = 0; i < 3; i++) {
      const g = orbRefs.current[i];
      if (!g) continue;
      const o = rt.orbs[i];
      g.visible = !!o;
      if (o) g.position.set(LANES[o.lane], 1.3 + Math.sin(rt.elapsed * 3 + i) * 0.15, d - o.s);
    }
  });

  return (
    <>
      <instancedMesh ref={coins} args={[coinGeo, undefined, MAX_COINS]} frustumCulled={false} castShadow>
        <meshStandardMaterial color="#f5c542" metalness={1} roughness={0.22} emissive="#7a4a00" emissiveIntensity={0.25} envMapIntensity={1.6} />
      </instancedMesh>
      <instancedMesh ref={mathCoins} args={[coinGeo, undefined, MAX_MATH]} frustumCulled={false}>
        <meshStandardMaterial color="#c084fc" metalness={0.9} roughness={0.2} emissive="#9333ea" emissiveIntensity={1.4} toneMapped={false} />
      </instancedMesh>
      {[0, 1, 2].map((i) => (
        <sprite key={i} ref={(r) => { pickupRefs.current[i] = r; }} scale={[1.1, 1.1, 1.1]} visible={false}>
          <mesh scale={0.62}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#dff1ff" roughness={0.05} metalness={0.1} transparent opacity={0.28} depthWrite={false} envMapIntensity={2} emissive="#88ccff" emissiveIntensity={0.3} />
          </mesh>
        </sprite>
      ))}
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(r) => { orbRefs.current[i] = r; }} visible={false}>
          <mesh>
            <sphereGeometry args={[0.55, 20, 14]} />
            <meshStandardMaterial color="#c084fc" emissive="#9333ea" emissiveIntensity={1.4} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <planeGeometry args={[1.8, 0.9]} />
            <meshBasicMaterial map={orbLabels[i].texture} transparent depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}
