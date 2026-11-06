import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LANES, WORLD } from '@/config/tuning';
import { game } from '../runtime';
import { bumpNoiseTex, hazardTex, trainSideTex } from '../materials/textures';
import { useAssets } from '../assets/assets';
import { cabGeometry, CAR_L, highBarrierGeometry, liveryGeometry, lowBarrierGeometry, rampGeometry, trainCarGeometry } from './models';

const MAX_BARRIERS = 40;
const MAX_CARS = 70;
const MAX_CABS = 20;
const MAX_RAMPS = 12;
const tmp = new THREE.Object3D();
const col = new THREE.Color();
const LIVERIES = ['#1d4ed8', '#047857', '#7c3aed', '#c2410c', '#0e7490'];

/** Obstacles as InstancedMeshes (one draw call per material group). */
export function Obstacles({ shadows }: { shadows: boolean }) {
  const low = useRef<THREE.InstancedMesh>(null);
  const high = useRef<THREE.InstancedMesh>(null);
  const cars = useRef<THREE.InstancedMesh>(null);
  const livery = useRef<THREE.InstancedMesh>(null);
  const cabs = useRef<THREE.InstancedMesh>(null);
  const ramps = useRef<THREE.InstancedMesh>(null);
  const barrierParts = useRef<Array<THREE.InstancedMesh | null>>([]);
  const models = useAssets((st) => st.models);
  const tex = useAssets((st) => st.tex);
  const jersey = models.concrete_road_barrier;

  const geos = useMemo(() => ({
    car: trainCarGeometry(), livery: liveryGeometry(), cab: cabGeometry(),
    low: lowBarrierGeometry(), high: highBarrierGeometry(), ramp: rampGeometry(),
  }), []);

  const mats = useMemo(() => {
    const steelMap = trainSideTex('#9aa1a9');
    const steel = new THREE.MeshStandardMaterial({ map: steelMap, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#0d1620', metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 });
    const gear = new THREE.MeshStandardMaterial({ color: '#1e1f22', metalness: 0.6, roughness: 0.65 });
    const roof = new THREE.MeshStandardMaterial({ color: '#8b9097', metalness: 0.5, roughness: 0.5, bumpMap: bumpNoiseTex(), bumpScale: 0.6 });
    const paint = new THREE.MeshPhysicalMaterial({ color: '#e5e7eb', metalness: 0.2, roughness: 0.35, clearcoat: 0.8 });
    const lamp = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c2', emissiveIntensity: 2.5, toneMapped: false });
    const display = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff9f1c', emissiveIntensity: 2, toneMapped: false });
    const board = new THREE.MeshStandardMaterial({ map: hazardTex('#d62828', '#f8f8f8', 'hz-red'), roughness: 0.45, metalness: 0.1 });
    const boardY = new THREE.MeshStandardMaterial({ map: hazardTex('#f4c20d', '#1b1b1b', 'hz-yellow'), roughness: 0.45, metalness: 0.1 });
    const barrierSteel = new THREE.MeshStandardMaterial({ color: '#8d949c', metalness: 0.85, roughness: 0.35 });
    const amber = new THREE.MeshStandardMaterial({ color: '#ffb000', emissive: '#ff9500', emissiveIntensity: 2, toneMapped: false });
    const deck = new THREE.MeshStandardMaterial({ color: '#6e737a', metalness: 0.85, roughness: 0.45, bumpMap: bumpNoiseTex(), bumpScale: 3 });
    const liveryM = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.3, roughness: 0.35 });
    return { steel, glass, gear, roof, paint, lamp, display, board, boardY, barrierSteel, amber, deck, liveryM };
  }, []);

  // CC0 scanned metal plate detail on train bodies, roofs and ramp decks
  useEffect(() => {
    const set = tex.metal_plate;
    if (!set) return;
    const apply = (m: THREE.MeshStandardMaterial, rep: [number, number], keepMap: boolean) => {
      const nor = set.nor.clone();
      nor.repeat.set(rep[0], rep[1]);
      nor.needsUpdate = true;
      const arm = set.arm.clone();
      arm.repeat.set(rep[0], rep[1]);
      arm.needsUpdate = true;
      m.normalMap = nor;
      m.normalScale.set(0.35, 0.35);
      m.roughnessMap = arm;
      if (!keepMap) {
        const diff = set.diff.clone();
        diff.repeat.set(rep[0], rep[1]);
        diff.needsUpdate = true;
        m.map = diff;
      }
      m.needsUpdate = true;
    };
    apply(mats.steel, [3, 1], true);
    apply(mats.roof, [3, 1], false);
    apply(mats.deck, [1, 3], false);
  }, [tex, mats]);

  useLayoutEffect(() => {
    for (let i = 0; i < MAX_CARS; i++) livery.current!.setColorAt(i, col.set('#ffffff'));
    for (let i = 0; i < MAX_CABS; i++) cabs.current!.setColorAt(i, col.set('#ffffff'));
  }, []);

  useFrame(() => {
    const rt = game.rt;
    const d = rt.distance;
    let nl = 0, nh = 0, nc = 0, ncab = 0, nr = 0;
    const blink = Math.sin(rt.elapsed * 9) > 0;
    for (const o of rt.obstacles) {
      if (o.s > d + 280 || o.s + o.len < d - 15) continue;
      const x = LANES[o.lane];
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(1, 1, 1);
      if (o.kind === 'low' && nl < MAX_BARRIERS) {
        tmp.position.set(x, 0, d - o.s - o.len / 2);
        if (jersey) tmp.scale.set(1.4, 1.03, 1);
        tmp.updateMatrix();
        if (jersey) for (const m of barrierParts.current) m?.setMatrixAt(nl, tmp.matrix);
        else low.current!.setMatrixAt(nl, tmp.matrix);
        nl++;
      } else if (o.kind === 'high' && nh < MAX_BARRIERS) {
        tmp.position.set(x, 0, d - o.s - o.len / 2);
        tmp.updateMatrix();
        high.current!.setMatrixAt(nh++, tmp.matrix);
      } else if (o.kind === 'ramp' && nr < MAX_RAMPS) {
        tmp.position.set(x, 0, d - o.s - o.len / 2);
        tmp.updateMatrix();
        ramps.current!.setMatrixAt(nr++, tmp.matrix);
      } else if (o.kind === 'train' || o.kind === 'movingTrain') {
        const moving = o.kind === 'movingTrain';
        const c = moving ? '#b91c1c' : LIVERIES[o.id % LIVERIES.length];
        for (let i = 0; i < o.cars && nc < MAX_CARS; i++) {
          tmp.position.set(x, 0, d - (o.s + (i + 0.5) * WORLD.trainCarLength));
          tmp.updateMatrix();
          cars.current!.setMatrixAt(nc, tmp.matrix);
          livery.current!.setMatrixAt(nc, tmp.matrix);
          livery.current!.setColorAt(nc++, col.set(c));
          if (i === 0 && ncab < MAX_CABS) {
            cabs.current!.setMatrixAt(ncab, tmp.matrix);
            cabs.current!.setColorAt(ncab++, col.set(moving ? '#ffffff' : '#e8e8e8'));
          }
        }
      }
    }
    const set = (m: THREE.InstancedMesh | null, n: number) => {
      if (!m) return;
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    set(low.current, jersey ? 0 : nl);
    for (const m of barrierParts.current) set(m, nl);
    set(high.current, nh);
    set(cars.current, nc);
    set(livery.current, nc);
    set(cabs.current, ncab);
    set(ramps.current, nr);
    mats.amber.emissiveIntensity = blink ? 3 : 0.2;
    // oncoming trains flash their headlights
    const anyMoving = rt.obstacles.some((o) => o.kind === 'movingTrain' && o.s - d < 200 && o.s > d);
    mats.lamp.emissiveIntensity = anyMoving && Math.sin(rt.elapsed * 12) > 0 ? 6 : 2.5;
  });

  void CAR_L;
  return (
    <>
      <instancedMesh ref={cars} args={[geos.car, [mats.steel, mats.glass, mats.gear, mats.roof], MAX_CARS]} castShadow={shadows} receiveShadow frustumCulled={false} />
      <instancedMesh ref={livery} args={[geos.livery, mats.liveryM, MAX_CARS]} frustumCulled={false} />
      <instancedMesh ref={cabs} args={[geos.cab, [mats.paint, mats.glass, mats.lamp, mats.display], MAX_CABS]} castShadow={shadows} frustumCulled={false} />
      {jersey?.map((p, i) => (
        <instancedMesh key={`j${i}`} ref={(el) => { barrierParts.current[i] = el; }} args={[p.geometry, p.material, MAX_BARRIERS]} castShadow={shadows} receiveShadow frustumCulled={false} />
      ))}
      <instancedMesh ref={low} args={[geos.low, [mats.board, mats.barrierSteel, mats.amber], MAX_BARRIERS]} castShadow={shadows} frustumCulled={false} />
      <instancedMesh ref={high} args={[geos.high, [mats.boardY, mats.barrierSteel, mats.amber], MAX_BARRIERS]} castShadow={shadows} frustumCulled={false} />
      <instancedMesh ref={ramps} args={[geos.ramp, [mats.deck, mats.barrierSteel], MAX_RAMPS]} castShadow={shadows} receiveShadow frustumCulled={false} />
    </>
  );
}
