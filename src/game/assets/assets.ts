import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { create } from 'zustand';

/**
 * CC0 assets from Poly Haven (see public/assets/CREDITS.md), bundled locally — no runtime
 * network calls beyond our own origin. Core assets load behind the loading screen; biome-specific
 * ones stream in afterwards. Anything that fails to load falls back to the procedural art.
 */

const BASE = `${import.meta.env.BASE_URL}assets/`;

export type TexSet = 'gravel' | 'concrete_floor' | 'rectangular_paving' | 'asphalt_02' | 'red_brick_03' | 'sandstone_brick_wall_01' | 'grey_plaster' | 'metal_plate' | 'snow_02';
export type SkyName = 'city' | 'heritage' | 'snow' | 'night';
export type ModelName = 'concrete_road_barrier' | 'street_lamp_01' | 'painted_wooden_bench';

export interface PBRSet {
  diff: THREE.Texture;
  nor: THREE.Texture;
  arm: THREE.Texture;
  /** raw image of the colour map (for compositing facades) */
  image: HTMLImageElement | ImageBitmap | null;
}

export interface ModelPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

interface AssetState {
  progress: number; // 0..1 for core assets
  coreReady: boolean;
  version: number; // bumps whenever any asset arrives
  tex: Partial<Record<TexSet, PBRSet>>;
  sky: Partial<Record<SkyName, THREE.DataTexture>>;
  models: Partial<Record<ModelName, ModelPart[]>>;
  failed: string[];
}

export const useAssets = create<AssetState>(() => ({
  progress: 0, coreReady: false, version: 0, tex: {}, sky: {}, models: {}, failed: [],
}));

const CORE_TEX: TexSet[] = ['gravel', 'concrete_floor', 'rectangular_paving', 'asphalt_02', 'red_brick_03', 'grey_plaster', 'metal_plate'];
const LATER_TEX: TexSet[] = ['sandstone_brick_wall_01', 'snow_02'];
const CORE_SKY: SkyName[] = ['city'];
const LATER_SKY: SkyName[] = ['heritage', 'snow', 'night'];
const MODELS: ModelName[] = ['concrete_road_barrier', 'street_lamp_01', 'painted_wooden_bench'];
const MODEL_FILE: Record<ModelName, string> = {
  concrete_road_barrier: 'concrete_road_barrier/concrete_road_barrier_1k.gltf',
  street_lamp_01: 'street_lamp_01/street_lamp_01_1k.gltf',
  painted_wooden_bench: 'painted_wooden_bench/painted_wooden_bench_1k.gltf',
};

const texLoader = new THREE.TextureLoader();
const hdrLoader = new HDRLoader();
const gltfLoader = new GLTFLoader();

function bump() {
  useAssets.setState((s) => ({ version: s.version + 1 }));
}

function fail(what: string) {
  useAssets.setState((s) => ({ failed: [...s.failed, what] }));
}

function loadTex(url: string, color: boolean): Promise<THREE.Texture> {
  return new Promise((res, rej) =>
    texLoader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      if (color) t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }, undefined, rej),
  );
}

async function loadSet(name: TexSet) {
  try {
    const [diff, nor, arm] = await Promise.all([
      loadTex(`${BASE}textures/${name}_diff.jpg`, true),
      loadTex(`${BASE}textures/${name}_nor.jpg`, false),
      loadTex(`${BASE}textures/${name}_arm.jpg`, false),
    ]);
    const image = (diff.image as HTMLImageElement | ImageBitmap) ?? null;
    useAssets.setState((s) => ({ tex: { ...s.tex, [name]: { diff, nor, arm, image } } }));
  } catch {
    fail(`texture:${name}`);
  }
}

async function loadSky(name: SkyName) {
  try {
    const t = await new Promise<THREE.DataTexture>((res, rej) => hdrLoader.load(`${BASE}hdri/sky_${name}.hdr`, res, undefined, rej));
    t.mapping = THREE.EquirectangularReflectionMapping;
    useAssets.setState((s) => ({ sky: { ...s.sky, [name]: t } }));
  } catch {
    fail(`sky:${name}`);
  }
}

async function loadModel(name: ModelName) {
  try {
    const gltf = await gltfLoader.loadAsync(`${BASE}models/${MODEL_FILE[name]}`);
    gltf.scene.updateMatrixWorld(true);
    const parts: ModelPart[] = [];
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const geometry = m.geometry.clone();
      geometry.applyMatrix4(m.matrixWorld);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      parts.push({ geometry, material: mats[0] });
    });
    useAssets.setState((s) => ({ models: { ...s.models, [name]: parts } }));
  } catch {
    fail(`model:${name}`);
  }
}

let started = false;

/** Load core assets (with progress), then stream the rest in the background. */
export function loadAssets() {
  if (started) return;
  started = true;
  const jobs: Array<() => Promise<void>> = [
    ...CORE_TEX.map((n) => () => loadSet(n)),
    ...CORE_SKY.map((n) => () => loadSky(n)),
    ...MODELS.map((n) => () => loadModel(n)),
  ];
  let done = 0;
  void Promise.all(
    jobs.map((j) =>
      j().finally(() => {
        done++;
        useAssets.setState({ progress: done / jobs.length });
        bump();
      }),
    ),
  ).then(() => {
    useAssets.setState({ coreReady: true });
    bump();
    // biome extras stream in after the core set
    void Promise.all([...LATER_TEX.map(loadSet), ...LATER_SKY.map(loadSky)]).then(bump);
  });
}

/** Clone a PBR set's textures with a given repeat (each material needs its own offsets). */
export function pbrTextures(set: PBRSet | undefined, repeat: [number, number]) {
  if (!set) return null;
  const c = (t: THREE.Texture) => {
    const x = t.clone();
    x.repeat.set(repeat[0], repeat[1]);
    x.needsUpdate = true;
    return x;
  };
  return { map: c(set.diff), normalMap: c(set.nor), arm: c(set.arm) };
}

/** Build a standard material from a PBR set (ARM = AO / roughness / metalness packed). */
export function pbrMaterial(set: PBRSet | undefined, repeat: [number, number], extra: THREE.MeshStandardMaterialParameters = {}) {
  const t = pbrTextures(set, repeat);
  if (!t) return null;
  return new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, aoMap: t.arm, metalnessMap: t.arm, metalness: 0, roughness: 1, ...extra,
  });
}

/** Scroll every map of a material along v (treadmill). */
export function scrollMaterial(m: THREE.MeshStandardMaterial | null | undefined, v: number) {
  if (!m) return;
  for (const t of [m.map, m.normalMap, m.roughnessMap, m.bumpMap]) if (t) t.offset.y = v * t.repeat.y;
}
