import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/**
 * Post-processing per quality tier: ambient occlusion (high), bloom (medium+), SMAA, filmic output.
 * Takes over rendering (useFrame priority 1).
 */
export function PostFX({ ao, bloom }: { ao: boolean; bloom: boolean }) {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => {
    const c = new EffectComposer(gl, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 }));
    c.addPass(new RenderPass(scene, camera));
    if (ao) {
      const gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1 });
      gtao.blendIntensity = 0.85;
      c.addPass(gtao);
    }
    if (bloom) c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.3, 7.0));
    c.addPass(new OutputPass());
    c.addPass(new SMAAPass());
    return c;
  }, [gl, scene, camera, ao, bloom]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, dt) => {
    composer.render(dt);
  }, 1);

  return null;
}
