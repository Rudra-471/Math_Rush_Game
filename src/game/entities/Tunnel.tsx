import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { game } from '../runtime';
import { concreteTex, bumpNoiseTex } from '../materials/textures';
import { pbrMaterial, useAssets } from '../assets/assets';

const SEG = 6;
const MAX = 50;
const tmp = new THREE.Object3D();

/** Challenge Tunnel: cast-concrete vault with ribbed segments, LED strips and a portal face. */
export function Tunnel({ shadows }: { shadows: boolean }) {
  const shell = useRef<THREE.InstancedMesh>(null);
  const leds = useRef<THREE.InstancedMesh>(null);
  const portals = useRef<THREE.InstancedMesh>(null);
  const ledMat = useRef<THREE.MeshStandardMaterial>(null);

  const { shellG, ledG, portalG, concrete } = useMemo(() => {
    // half-cylinder vault (inside faces) + rib
    const vault = new THREE.CylinderGeometry(10.5, 10.5, SEG, 32, 1, true, -Math.PI / 2, Math.PI);
    vault.rotateX(Math.PI / 2);
    vault.rotateZ(Math.PI);
    const rib = new THREE.TorusGeometry(10.35, 0.3, 6, 32, Math.PI);
    rib.translate(0, 0, SEG / 2);
    const walls = [-1, 1].map((s) => { const g = new THREE.BoxGeometry(0.5, 1.6, SEG); g.translate(s * 10.2, 0.8, 0); return g; });
    const shellG = mergeGeometries([vault.toNonIndexed(), rib.toNonIndexed(), ...walls.map((g) => g.toNonIndexed())])!;
    const ledG = mergeGeometries([-1, 1].map((s) => { const g = new THREE.BoxGeometry(0.08, 0.08, SEG * 0.8); g.translate(s * 9.4, 3.6, 0); return g; }))!;
    const ring = new THREE.RingGeometry(10.5, 13.5, 32, 1, 0, Math.PI);
    const portalG = mergeGeometries([ring, (() => { const g = new THREE.PlaneGeometry(30, 4); g.translate(0, 14.5, 0); return g; })()])!;
    const concrete = new THREE.MeshStandardMaterial({ map: concreteTex('#8f8b84', 'tunnel'), bumpMap: bumpNoiseTex(), bumpScale: 2, roughness: 0.9, side: THREE.DoubleSide });
    return { shellG, ledG, portalG, concrete };
  }, []);

  const tex = useAssets((st) => st.tex);
  const realConcrete = useMemo(() => {
    const m = pbrMaterial(tex.concrete_floor, [3, 1], { color: '#b8b3ab' });
    if (m) m.side = THREE.DoubleSide;
    return m;
  }, [tex]);

  useFrame(() => {
    const rt = game.rt;
    const d = rt.distance;
    let n = 0, p = 0;
    for (const t of rt.tunnels) {
      if (t.s > d + 300 || t.s + t.len < d - 20) continue;
      for (const s of [t.s, t.s + t.len]) {
        if (s > d - 10 && s < d + 300 && p < 4) {
          tmp.position.set(0, 0, d - s);
          tmp.rotation.set(0, 0, 0);
          tmp.scale.set(1, 1, 1);
          tmp.updateMatrix();
          portals.current!.setMatrixAt(p++, tmp.matrix);
        }
      }
      const first = Math.max(t.s, Math.floor((d - 12) / SEG) * SEG);
      for (let s = first; s < t.s + t.len && s < d + 280 && n < MAX; s += SEG) {
        tmp.position.set(0, 0, d - s - SEG / 2);
        tmp.rotation.set(0, 0, 0);
        tmp.scale.set(1, 1, 1);
        tmp.updateMatrix();
        shell.current!.setMatrixAt(n, tmp.matrix);
        leds.current!.setMatrixAt(n++, tmp.matrix);
      }
    }
    for (const [m, c] of [[shell.current!, n], [leds.current!, n], [portals.current!, p]] as const) {
      m.count = c;
      m.instanceMatrix.needsUpdate = true;
    }
    if (ledMat.current) ledMat.current.emissiveIntensity = 3 + Math.sin(rt.elapsed * 5) * 0.8;
  });

  return (
    <>
      <instancedMesh ref={shell} args={[shellG, undefined, MAX]} material={realConcrete ?? concrete} receiveShadow castShadow={false} frustumCulled={false} />
      <instancedMesh ref={leds} args={[ledG, undefined, MAX]} frustumCulled={false}>
        <meshStandardMaterial ref={ledMat} color="#000" emissive="#c084fc" emissiveIntensity={3} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={portals} args={[portalG, undefined, 4]} castShadow={shadows} frustumCulled={false}>
        <meshStandardMaterial color="#7d7972" roughness={0.85} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}
