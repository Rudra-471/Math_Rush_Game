import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LANES } from '@/config/tuning';
import { formatAnswer } from '@/math/format';
import { useSettings } from '@/store/settingsStore';
import { game, type GateRow } from '../runtime';
import { Label } from './labelTexture';

const ROWS = 5;
const POST_H = 4.6;
const BLUR_STEPS = [14, 10, 7, 4, 2, 0];

interface ArchRefs {
  label: Label;
  glow: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
}

function palette(colorBlind: boolean) {
  const good: [string, string] = colorBlind ? ['#38bdf8', '#0369a1'] : ['#4ade80', '#15803d'];
  const bad: [string, string] = colorBlind ? ['#fdba74', '#c2410c'] : ['#f87171', '#b91c1c'];
  return { idle: ['#3b82f6', '#1e3a8a'] as [string, string], good, bad, hidden: ['#64748b', '#1e293b'] as [string, string] };
}

/**
 * Answer gates: steel gantries with three glass answer boards. Options are written on the
 * boards as soon as the question exists, starting blurred and sharpening as the runner approaches
 * (fully sharp at the 60 % reveal point).
 */
export function Gates() {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const arches = useMemo<ArchRefs[][]>(
    () =>
      Array.from({ length: ROWS }, () =>
        [0, 1, 2].map(() => ({
          label: new Label(320, 200),
          glow: new THREE.MeshStandardMaterial({ color: '#3b82f6', emissive: '#3b82f6', emissiveIntensity: 0.6, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
          frame: new THREE.MeshStandardMaterial({ color: '#c7ccd3', metalness: 0.9, roughness: 0.3, emissive: '#3b82f6', emissiveIntensity: 0.15 }),
        })),
      ),
    [],
  );
  const lightStrip = useMemo(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#93c5fd', emissiveIntensity: 2.5, toneMapped: false }), []);
  const assign = useRef<Array<GateRow | null>>(Array(ROWS).fill(null));

  useEffect(() => () => arches.flat().forEach((a) => { a.label.dispose(); a.glow.dispose(); a.frame.dispose(); }), [arches]);

  useFrame(() => {
    const rt = game.rt;
    const d = rt.distance;
    const pal = palette(useSettings.getState().colorBlind);
    const visible = rt.gates.filter((g) => g.s > d - 15 && g.s < d + 280).slice(0, ROWS);
    for (let r = 0; r < ROWS; r++) {
      const g = visible[r] ?? null;
      assign.current[r] = g;
      const grp = groups.current[r];
      if (grp) grp.visible = !!g;
      if (!g || !grp) continue;
      grp.position.z = d - g.s;
      const q = g.question;
      // blur: heavy before the banner, easing to sharp at the reveal point
      let blur = BLUR_STEPS[0];
      if (g.state === 'revealed' || g.state === 'resolved') blur = 0;
      else if (q && Number.isFinite(g.showAt) && d >= g.showAt) {
        const t = Math.min(1, (d - g.showAt) / Math.max(1, g.revealAt - g.showAt));
        blur = BLUR_STEPS[Math.min(BLUR_STEPS.length - 1, 1 + Math.floor(t * (BLUR_STEPS.length - 1)))];
      }
      const pulse = g.state === 'revealed' ? 0.5 + Math.sin(rt.elapsed * 6) * 0.5 : 0;
      for (let i = 0; i < 3; i++) {
        const a = arches[r][i];
        let colors = q ? pal.idle : pal.hidden;
        if (g.state === 'resolved' && g.result && q) {
          if (i === q.answerIndex) colors = pal.good;
          else if (i === g.result.chosen) colors = pal.bad;
        }
        const text = q ? formatAnswer(q.choices[i]) : '';
        a.label.drawBoard(text, colors[0], colors[1], blur, g.state === 'resolved' && q && i === q.answerIndex ? 1 : 0);
        a.glow.color.set(colors[0]);
        a.glow.emissive.set(colors[0]);
        a.glow.emissiveIntensity = 0.4 + pulse * 0.6;
        a.frame.emissive.set(colors[0]);
      }
    }
  });

  return (
    <>
      {Array.from({ length: ROWS }, (_, r) => (
        <group key={r} ref={(el) => { groups.current[r] = el; }} visible={false}>
          {LANES.map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              {[-1.18, 1.18].map((px) => (
                <group key={px} position={[px, 0, 0]}>
                  <mesh position={[0, POST_H / 2, 0]} material={arches[r][i].frame} castShadow>
                    <boxGeometry args={[0.14, POST_H, 0.14]} />
                  </mesh>
                  <mesh position={[0, 0.04, 0]} material={arches[r][i].frame}>
                    <boxGeometry args={[0.36, 0.08, 0.36]} />
                  </mesh>
                  <mesh position={[0, POST_H * 0.55, -0.075]} material={lightStrip}>
                    <boxGeometry args={[0.03, POST_H * 0.8, 0.01]} />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, POST_H, 0]} material={arches[r][i].frame} castShadow>
                <boxGeometry args={[2.5, 0.16, 0.18]} />
              </mesh>
              {/* light curtain you run through */}
              <mesh position={[0, POST_H / 2, 0]} material={arches[r][i].glow}>
                <planeGeometry args={[2.22, POST_H]} />
              </mesh>
              {/* answer board above the arch */}
              <mesh position={[0, POST_H + 0.95, 0.02]}>
                <planeGeometry args={[2.45, 1.53]} />
                <meshBasicMaterial map={arches[r][i].label.texture} transparent depthWrite={false} toneMapped={false} />
              </mesh>
              {/* board hangers */}
              {[-0.9, 0.9].map((hx) => (
                <mesh key={hx} position={[hx, POST_H + 0.12, 0]} material={arches[r][i].frame}>
                  <boxGeometry args={[0.04, 0.2, 0.04]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </>
  );
}
