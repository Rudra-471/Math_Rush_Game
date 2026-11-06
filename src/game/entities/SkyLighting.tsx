import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { game } from '../runtime';
import { BIOMES, biomeIndexAt, type Biome } from '../world/Biomes';
import { inTunnel } from '../loop/step';
import { useAssets, type SkyName } from '../assets/assets';

const SKY_FOR_BIOME: SkyName[] = ['city', 'heritage', 'snow', 'night'];

/** Average radiance just above the horizon of an equirect HDR → fog colour that matches the sky. */
function horizonColor(t: THREE.DataTexture, out: THREE.Color): THREE.Color {
  const { width, height } = t.image as { width: number; height: number };
  const data = (t.image as { data: Uint16Array | Float32Array }).data;
  const half = data instanceof Uint16Array;
  const row = Math.floor(height * 0.47);
  let r = 0, g = 0, b = 0, n = 0;
  for (let x = 0; x < width; x += 4) {
    const i = (row * width + x) * 4;
    const f = (v: number) => (half ? THREE.DataUtils.fromHalfFloat(v) : v);
    r += f(data[i]); g += f(data[i + 1]); b += f(data[i + 2]); n++;
  }
  return out.setRGB(r / n, g / n, b / n, THREE.LinearSRGBColorSpace);
}
const fogTarget = new THREE.Color();

const sunDir = new THREE.Vector3();
const col = new THREE.Color();

function configureSky(sky: Sky, b: Biome) {
  const u = sky.material.uniforms;
  u.turbidity.value = b.turbidity;
  u.rayleigh.value = b.rayleigh;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;
  const phi = THREE.MathUtils.degToRad(90 - b.sunElevation);
  const theta = THREE.MathUtils.degToRad(b.sunAzimuth);
  sunDir.setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sunDir);
}

/**
 * Physically based sky (Rayleigh/Mie scattering), image-based lighting baked from that sky with
 * PMREM, a sun that follows the player for crisp shadows, filmic tone mapping and matched fog.
 */
export function SkyLighting({ shadows, shadowMap }: { shadows: boolean; shadowMap: number }) {
  const { gl, scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const biomeRef = useRef('');
  const envRT = useRef<THREE.WebGLRenderTarget | null>(null);

  const { sky, bakeScene, bakeSky, pmrem, fog } = useMemo(() => {
    const sky = new Sky();
    sky.scale.setScalar(900);
    const bakeSky = new Sky();
    bakeSky.scale.setScalar(10);
    const bakeScene = new THREE.Scene();
    bakeScene.add(bakeSky);
    // a ground disc in the bake so reflections show a darker lower hemisphere
    const groundBake = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: '#4d4a45' }));
    groundBake.rotation.x = -Math.PI / 2;
    groundBake.position.y = -0.5;
    bakeScene.add(groundBake);
    return { sky, bakeScene, bakeSky, pmrem: new THREE.PMREMGenerator(gl), fog: new THREE.Fog('#c7d6e2', 70, 330) };
  }, [gl]);

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.6;
    scene.fog = fog;
    scene.add(sky);
    return () => {
      scene.remove(sky);
      envRT.current?.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, sky, fog, pmrem]);

  useFrame((_, dt) => {
    const rt = game.rt;
    const bi = biomeIndexAt(rt.distance);
    const b = BIOMES[bi];
    const hdr = useAssets.getState().sky[SKY_FOR_BIOME[bi]];
    const key = `${bi}|${hdr ? 'hdr' : 'proc'}`;
    if (biomeRef.current !== key) {
      biomeRef.current = key;
      configureSky(sky, b);
      configureSky(bakeSky, b);
      (bakeScene.children[1] as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>).material.color.set(b.ground).multiplyScalar(0.6);
      const next = pmrem.fromScene(bakeScene, 0.02);
      envRT.current?.dispose();
      envRT.current = next;
      scene.environment = next.texture;
      scene.environmentIntensity = b.night ? 0.35 : 0.9;
      if (hdr) {
        // photographic CC0 sky: visible background + image-based lighting from the same HDR
        sky.visible = false;
        scene.background = hdr;
        scene.backgroundIntensity = b.night ? 1.6 : 1;
        scene.environment = hdr;
        scene.environmentIntensity = b.night ? 1.4 : 0.85;
        horizonColor(hdr, fogTarget).multiplyScalar(scene.backgroundIntensity);
      } else {
        sky.visible = true;
        scene.background = null;
        fogTarget.set(b.fog);
      }
    }
    const tun = inTunnel(rt);
    const k = 1 - Math.exp(-dt * 1.5);
    gl.toneMappingExposure = THREE.MathUtils.lerp(gl.toneMappingExposure, tun ? b.exposure * 1.2 : b.exposure, k);
    fog.color.lerp(tun ? col.set('#1b1230') : fogTarget, k);
    fog.near = THREE.MathUtils.lerp(fog.near, tun ? 20 : b.night ? 40 : 70, k);
    fog.far = THREE.MathUtils.lerp(fog.far, tun ? 130 : b.night ? 220 : 330, k);

    const L = sun.current;
    if (L) {
      L.color.lerp(col.set(b.sunColor), k);
      L.intensity = THREE.MathUtils.lerp(L.intensity, tun ? 0.4 : b.sunIntensity, k);
      // sun follows the player: direction from the sky model, tight shadow frustum
      L.position.set(rt.x + sunDir.x * 40, Math.max(8, sunDir.y * 40), sunDir.z * 40 - 12);
      L.target.position.set(rt.x, 0, -12);
      L.target.updateMatrixWorld();
    }
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(hemi.current.intensity, b.hemiIntensity, k);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#cfe3ff', '#5a5048', 0.5]} />
      <directionalLight
        ref={sun}
        intensity={3}
        castShadow={shadows}
        shadow-mapSize-width={shadowMap || 512}
        shadow-mapSize-height={shadowMap || 512}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}
