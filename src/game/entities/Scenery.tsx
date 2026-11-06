import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { game } from '../runtime';
import { BIOMES, biomeIndexAt, type FacadeKind } from '../world/Biomes';
import { barkTex, facadeRoughTex, facadeTex, leavesTex } from '../materials/textures';
import { useAssets, type PBRSet } from '../assets/assets';

const KINDS: FacadeKind[] = ['brick', 'office', 'concrete', 'sandstone', 'shop'];
const SEG_H = 8, SEG_W = 10, SEG_D = 12;
const PER_KIND = 70;
const SLOTS = 40;
const TREES = 36;
const LAMPS = 26;
const LAMP_SPACING = 22;
const tmp = new THREE.Object3D();
const col = new THREE.Color();

interface Slot {
  s: number;
  side: -1 | 1;
  kind: FacadeKind;
  floors: number;
  sx: number;
  sz: number;
  offset: number;
  tint: string;
  roof: string;
  biome: number;
  dome: boolean;
  sign: string | null;
}
interface TreeSlot { s: number; side: -1 | 1; x: number; scale: number; rot: number; pine: boolean; biome: number }

function noisyBlob(radius: number, detail: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.18 * Math.sin(x * 3.1 + seed) * Math.cos(y * 2.7 + seed * 2) + 0.1 * Math.sin(z * 5.3 + seed);
    p.setXYZ(i, x * n, y * n * 0.85, z * n);
  }
  g.computeVertexNormals();
  return g;
}

/** City scenery: stacked-floor buildings with window facades, roofs, domes, neon signs, trees, lamps. */
export function Scenery({ shadows }: { shadows: boolean }) {
  const buildingRefs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const roofs = useRef<THREE.InstancedMesh>(null);
  const domes = useRef<THREE.InstancedMesh>(null);
  const signs = useRef<THREE.InstancedMesh>(null);
  const trees = useRef<THREE.InstancedMesh>(null);
  const pines = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  const lampGroup = useRef<THREE.Group>(null);
  const slots = useRef<Slot[]>([]);
  const treeSlots = useRef<TreeSlot[]>([]);

  const tex = useAssets((st) => st.tex);
  const mats = useMemo(() => {
    const day: Record<string, THREE.MeshStandardMaterial> = {};
    const wallSet: Partial<Record<FacadeKind, PBRSet | undefined>> = {
      brick: tex.red_brick_03, sandstone: tex.sandstone_brick_wall_01, concrete: tex.grey_plaster, shop: tex.grey_plaster,
    };
    for (const k of KINDS) {
      const ws = wallSet[k];
      const img = ws?.image as CanvasImageSource | undefined;
      const map = facadeTex(k, false, img).clone();
      map.needsUpdate = true;
      map.repeat.set(1, 0.4);
      const rough = facadeRoughTex(k).clone();
      rough.needsUpdate = true;
      rough.repeat.set(1, 0.4);
      const emissive = facadeTex(k, true).clone();
      emissive.needsUpdate = true;
      emissive.repeat.set(1, 0.4);
      let normalMap: THREE.Texture | null = null;
      if (ws) {
        normalMap = ws.nor.clone();
        normalMap.repeat.set(2, 1.6);
        normalMap.needsUpdate = true;
      }
      day[k] = new THREE.MeshStandardMaterial({
        map, roughnessMap: rough, roughness: 1, metalness: 0.05, emissiveMap: emissive, emissive: '#000000', envMapIntensity: 1.2,
        normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
      });
    }
    return {
      facades: day,
      roof: new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.9 }),
      dome: new THREE.MeshStandardMaterial({ color: '#f1e4cc', roughness: 0.55, metalness: 0.1 }),
      sign: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveIntensity: 2.2, toneMapped: false }),
      bark: new THREE.MeshStandardMaterial({ map: barkTex(), roughness: 1 }),
      leaves: new THREE.MeshStandardMaterial({ map: leavesTex('#3f6b2f', 'leaves'), roughness: 0.85 }),
      needles: new THREE.MeshStandardMaterial({ map: leavesTex('#22402f', 'needles'), roughness: 0.9 }),
      lampPole: new THREE.MeshStandardMaterial({ color: '#2f3338', metalness: 0.7, roughness: 0.4 }),
      lampLight: new THREE.MeshStandardMaterial({ color: '#fff2d0', emissive: '#ffdf9e', emissiveIntensity: 0.3, toneMapped: false }),
    };
  }, [tex]);

  const geos = useMemo(() => {
    const seg = new THREE.BoxGeometry(SEG_W, SEG_H, SEG_D);
    const roof = mergeGeometries([new THREE.BoxGeometry(SEG_W + 0.6, 0.5, SEG_D + 0.6), (() => { const g = new THREE.BoxGeometry(2.4, 1.6, 2.4); g.translate(2, 1, -2); return g; })()])!;
    const dome = mergeGeometries([
      (() => { const g = new THREE.SphereGeometry(3.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); return g; })(),
      (() => { const g = new THREE.CylinderGeometry(3.7, 3.7, 0.8, 24); g.translate(0, -0.2, 0); return g; })(),
      (() => { const g = new THREE.ConeGeometry(0.25, 1.8, 8); g.translate(0, 4.3, 0); return g; })(),
    ])!;
    const sign = new THREE.PlaneGeometry(1, 1);
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 8);
    trunk.translate(0, 1.6, 0);
    const crown = mergeGeometries([
      (() => { const g = noisyBlob(1.6, 2, 1); g.translate(0, 4.2, 0); return g; })(),
      (() => { const g = noisyBlob(1.2, 2, 2); g.translate(0.9, 3.6, 0.3); return g; })(),
      (() => { const g = noisyBlob(1.1, 2, 3); g.translate(-0.8, 3.7, -0.4); return g; })(),
      (() => { const g = noisyBlob(1.0, 2, 4); g.translate(0.1, 5.2, 0.2); return g; })(),
    ])!;
    const tree = mergeGeometries([trunk.toNonIndexed(), crown.toNonIndexed()], true)!;
    const pineTrunk = new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6);
    pineTrunk.translate(0, 0.8, 0);
    const pineCrown = mergeGeometries([0, 1, 2, 3].map((i) => { const g = new THREE.ConeGeometry(1.9 - i * 0.4, 2.2, 10); g.translate(0, 2.0 + i * 1.15, 0); return g; }))!;
    const pine = mergeGeometries([pineTrunk.toNonIndexed(), pineCrown.toNonIndexed()], true)!;
    const lamp = mergeGeometries([
      (() => { const g = new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8); g.translate(0, 3.3, 0); return g; })(),
      (() => { const g = new THREE.BoxGeometry(0.9, 0.08, 0.08); g.translate(-0.4, 5.55, 0); return g; })(),
    ].map((g) => g.toNonIndexed()).concat([(() => { const g = new THREE.BoxGeometry(0.55, 0.12, 0.28).toNonIndexed(); g.translate(-0.8, 5.48, 0); return g; })()]), true)!;
    return { seg, roof, dome, sign, tree, pine, lamp };
  }, []);

  function newSlot(s: number, side: -1 | 1): Slot {
    const r = game.rt.rng;
    const bi = biomeIndexAt(s);
    const b = BIOMES[bi];
    const kind = b.facades[Math.floor(r.next() * b.facades.length)];
    const floors = kind === 'shop' ? 1 : kind === 'office' ? 2 + Math.floor(r.next() * 3) : 1 + Math.floor(r.next() * 3);
    const neonColors = ['#ff2d95', '#22d3ee', '#a3e635', '#f59e0b', '#a855f7'];
    return {
      s, side, kind, floors, sx: 0.85 + r.next() * 0.35, sz: 0.75 + r.next() * 0.35, offset: 13 + r.next() * 4,
      tint: b.tints[Math.floor(r.next() * b.tints.length)], roof: b.roof, biome: bi,
      dome: b.decor === 'dome' && kind === 'sandstone' && r.next() < 0.6,
      sign: b.decor === 'neon' && r.next() < 0.7 ? neonColors[Math.floor(r.next() * neonColors.length)] : null,
    };
  }

  useLayoutEffect(() => {
    // create instanceColor buffers before the first shader compile
    for (const k of KINDS) {
      const m = buildingRefs.current[k];
      if (m) for (let i = 0; i < PER_KIND; i++) m.setColorAt(i, col.set('#ffffff'));
    }
    for (let i = 0; i < SLOTS; i++) { roofs.current!.setColorAt(i, col.set('#555')); signs.current!.setColorAt(i, col.set('#fff')); }
    const L = lamps.current!;
    for (let i = 0; i < LAMPS; i++) {
      const side = i % 2 ? 1 : -1;
      tmp.position.set(side * 8.7, 0, 30 - Math.floor(i / 2) * LAMP_SPACING);
      tmp.rotation.set(0, side === 1 ? 0 : Math.PI, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      L.setMatrixAt(i, tmp.matrix);
    }
    L.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    const rt = game.rt;
    const d = rt.distance;
    const night = BIOMES[biomeIndexAt(d)].night;
    for (const k of KINDS) mats.facades[k].emissive.set(night ? '#ffffff' : '#000000');
    mats.lampLight.emissiveIntensity = night ? 3 : 0.3;
    if (lampGroup.current) {
      lampGroup.current.position.z = d % LAMP_SPACING;
      lampGroup.current.visible = !useAssets.getState().models.street_lamp_01;
    }

    // --- building slots (recycle behind the camera) ---
    const S = slots.current;
    if (!S.length) for (let i = 0; i < SLOTS; i++) S.push(newSlot(d - 15 + Math.floor(i / 2) * 13, i % 2 ? 1 : -1));
    let far = -Infinity;
    for (const sl of S) far = Math.max(far, sl.s);
    for (let i = 0; i < S.length; i++) {
      if (S[i].s < d - 25) {
        far += 11 + rt.rng.next() * 5;
        S[i] = newSlot(far, S[i].side);
      }
    }
    const counts: Record<string, number> = {};
    let nr = 0, nd = 0, ns = 0;
    for (const sl of S) {
      const z = d - sl.s;
      const w = SEG_W * sl.sx;
      const x = sl.side * (sl.offset + w / 2);
      const m = buildingRefs.current[sl.kind];
      for (let f = 0; f < sl.floors && m; f++) {
        const n = counts[sl.kind] ?? 0;
        if (n >= PER_KIND) break;
        tmp.position.set(x, SEG_H / 2 + f * SEG_H, z);
        tmp.rotation.set(0, 0, 0);
        tmp.scale.set(sl.sx, 1, sl.sz);
        tmp.updateMatrix();
        m.setMatrixAt(n, tmp.matrix);
        m.setColorAt(n, col.set(sl.tint));
        counts[sl.kind] = n + 1;
      }
      const top = sl.floors * SEG_H;
      tmp.rotation.set(0, 0, 0);
      tmp.position.set(x, top + 0.25, z);
      tmp.scale.set(sl.sx, 1, sl.sz);
      tmp.updateMatrix();
      roofs.current!.setMatrixAt(nr, tmp.matrix);
      roofs.current!.setColorAt(nr++, col.set(sl.roof));
      if (sl.dome) {
        tmp.position.set(x, top + 0.5, z);
        tmp.scale.setScalar(Math.min(sl.sx, sl.sz) * 0.9);
        tmp.updateMatrix();
        domes.current!.setMatrixAt(nd++, tmp.matrix);
      }
      if (sl.sign) {
        tmp.position.set(x - sl.side * (w / 2 + 0.05), SEG_H * 0.55 + (sl.floors > 1 ? SEG_H : 0), z);
        tmp.rotation.set(0, sl.side === 1 ? -Math.PI / 2 : Math.PI / 2, 0);
        tmp.scale.set(6, 1.4, 1);
        tmp.updateMatrix();
        signs.current!.setMatrixAt(ns, tmp.matrix);
        signs.current!.setColorAt(ns++, col.set(sl.sign));
      }
    }
    for (const k of KINDS) {
      const m = buildingRefs.current[k];
      if (!m) continue;
      m.count = counts[k] ?? 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (const [m, n] of [[roofs.current!, nr], [domes.current!, nd], [signs.current!, ns]] as const) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    // --- trees between platform and buildings ---
    const T = treeSlots.current;
    const mk = (s: number, side: -1 | 1): TreeSlot => {
      const bi = biomeIndexAt(s);
      return { s, side, x: side * (10.4 + rt.rng.next() * 1.6), scale: 0.8 + rt.rng.next() * 0.5, rot: rt.rng.next() * 6.28, pine: BIOMES[bi].decor === 'pine', biome: bi };
    };
    if (!T.length) for (let i = 0; i < TREES; i++) T.push(mk(d - 10 + Math.floor(i / 2) * 15 + rt.rng.next() * 6, i % 2 ? 1 : -1));
    let tfar = -Infinity;
    for (const t of T) tfar = Math.max(tfar, t.s);
    let nt = 0, np = 0;
    for (let i = 0; i < T.length; i++) {
      if (T[i].s < d - 20) { tfar += 6 + rt.rng.next() * 10; T[i] = mk(tfar, T[i].side); }
      const t = T[i];
      if (BIOMES[t.biome].decor === 'neon' && i % 3) continue;
      tmp.position.set(t.x, 0, d - t.s);
      tmp.rotation.set(0, t.rot, 0);
      tmp.scale.setScalar(t.scale);
      tmp.updateMatrix();
      if (t.pine) pines.current!.setMatrixAt(np++, tmp.matrix);
      else trees.current!.setMatrixAt(nt++, tmp.matrix);
    }
    trees.current!.count = nt;
    pines.current!.count = np;
    trees.current!.instanceMatrix.needsUpdate = true;
    pines.current!.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {KINDS.map((k) => (
        <instancedMesh
          key={k}
          ref={(el) => { buildingRefs.current[k] = el; }}
          args={[geos.seg, undefined, PER_KIND]} material={mats.facades[k]}
          castShadow={shadows}
          receiveShadow
          frustumCulled={false}
        />
      ))}
      <instancedMesh ref={roofs} args={[geos.roof, undefined, SLOTS]} material={mats.roof} receiveShadow frustumCulled={false} />
      <instancedMesh ref={domes} args={[geos.dome, undefined, SLOTS]} material={mats.dome} castShadow={shadows} frustumCulled={false} />
      <instancedMesh ref={signs} args={[geos.sign, undefined, SLOTS]} material={mats.sign} frustumCulled={false} />
      <instancedMesh ref={trees} args={[geos.tree, undefined, TREES]} material={[mats.bark, mats.leaves]} castShadow={shadows} receiveShadow frustumCulled={false} />
      <instancedMesh ref={pines} args={[geos.pine, undefined, TREES]} material={[mats.bark, mats.needles]} castShadow={shadows} frustumCulled={false} />
      <group ref={lampGroup}>
        <instancedMesh ref={lamps} args={[geos.lamp, undefined, LAMPS]} material={[mats.lampPole, mats.lampPole, mats.lampLight]} castShadow={shadows} frustumCulled={false} />
      </group>
    </>
  );
}
