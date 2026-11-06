import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from '@/config/tuning';

/**
 * Procedural, realistic-proportioned models (metres). Each returns a merged geometry whose
 * groups line up with the material arrays in the entity components.
 */

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  return g;
}
function cyl(rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0, axis: 'x' | 'y' | 'z' = 'y') {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg).toNonIndexed();
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
function merge(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts)!;
}

const W = WORLD.trainWidth;
const H = WORLD.trainHeight;
export const CAR_L = WORLD.trainCarLength - 0.5;

/** Metro car. Groups: 0 steel body, 1 glass, 2 dark running gear, 3 roof grey. */
export function trainCarGeometry(): THREE.BufferGeometry {
  const body = box(W, H - 0.75, CAR_L, 0, 0.55 + (H - 0.75) / 2);
  const roofCurve = (() => {
    const g = new THREE.CylinderGeometry(W / 2, W / 2, CAR_L, 20, 1, false, -Math.PI / 2, Math.PI).toNonIndexed();
    g.rotateX(Math.PI / 2);
    g.rotateZ(Math.PI);
    g.scale(1, 0.18, 1);
    g.translate(0, H - 0.2, 0);
    return g;
  })();
  const ac = box(1.2, 0.12, 2.2, 0, H + 0.0, -CAR_L * 0.2);
  const glass = merge([box(W + 0.02, 0.62, CAR_L * 0.86, 0, 1.75), box(W * 0.7, 0.9, 0.04, 0, 1.55, CAR_L / 2 + 0.01), box(W * 0.7, 0.9, 0.04, 0, 1.55, -CAR_L / 2 - 0.01)]);
  const gearParts: THREE.BufferGeometry[] = [box(W - 0.3, 0.32, CAR_L - 0.6, 0, 0.45)];
  for (const bz of [-CAR_L * 0.32, CAR_L * 0.32]) {
    gearParts.push(box(2.0, 0.22, 2.3, 0, 0.36, bz));
    for (const wz of [-0.75, 0.75]) for (const wx of [-0.72, 0.72]) gearParts.push(cyl(0.38, 0.38, 0.12, 16, wx, 0.38, bz + wz, 'x'));
  }
  gearParts.push(box(0.3, 0.3, 0.5, 0, 0.62, CAR_L / 2 + 0.2), box(0.3, 0.3, 0.5, 0, 0.62, -CAR_L / 2 - 0.2));
  return mergeGeometries([body, merge([glass]), merge(gearParts), merge([roofCurve, ac])], true)!;
}

/** Livery stripe (instance-coloured). */
export function liveryGeometry(): THREE.BufferGeometry {
  return merge([box(W + 0.03, 0.16, CAR_L * 0.98, 0, 1.22), box(W + 0.03, 0.05, CAR_L * 0.98, 0, 0.62)]);
}

/** Driver cab face on the leading car. Groups: 0 body paint, 1 windscreen, 2 lamps (emissive), 3 display. */
export function cabGeometry(): THREE.BufferGeometry {
  const z = CAR_L / 2;
  const nose = box(W, H - 0.8, 0.22, 0, 0.6 + (H - 0.8) / 2, z + 0.11);
  const screen = (() => {
    const g = new THREE.PlaneGeometry(W * 0.86, 0.85).toNonIndexed();
    g.rotateX(-0.18);
    g.translate(0, 1.72, z + 0.235);
    return g;
  })();
  const lamps = merge([-0.75, 0.75].map((x) => cyl(0.12, 0.12, 0.06, 16, x, 0.95, z + 0.24, 'z')));
  const display = box(W * 0.6, 0.18, 0.04, 0, 2.3, z + 0.21);
  return mergeGeometries([nose, screen, lamps, display], true)!;
}

/** Low barrier: two hazard boards on A-frame steel legs + amber warning lamp. Groups: 0 boards, 1 steel, 2 lamp. */
export function lowBarrierGeometry(): THREE.BufferGeometry {
  const w = 2.2;
  const boards = merge([box(w, 0.26, 0.05, 0, 0.72), box(w, 0.2, 0.05, 0, 0.36)]);
  const legs: THREE.BufferGeometry[] = [];
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) {
    for (const s of [-1, 1]) {
      const g = box(0.06, 0.95, 0.06);
      g.rotateX(s * 0.25);
      g.translate(x, 0.44, s * 0.11);
      legs.push(g);
    }
    legs.push(box(0.1, 0.04, 0.6, x, 0.02, 0));
  }
  const lamp = cyl(0.07, 0.07, 0.12, 12, w / 2 - 0.2, 0.92, 0);
  return mergeGeometries([boards, merge(legs), lamp], true)!;
}

/** Overhead barrier gantry: hazard sign board on steel posts. Groups: 0 board, 1 steel, 2 lamp. */
export function highBarrierGeometry(): THREE.BufferGeometry {
  const w = 2.3, top = WORLD.highBarrierTop;
  const board = box(w, 1.05, 0.08, 0, WORLD.highBarrierBottom + 0.6);
  const steel = merge([
    box(0.12, top + 0.25, 0.12, -w / 2 - 0.02, (top + 0.25) / 2),
    box(0.12, top + 0.25, 0.12, w / 2 + 0.02, (top + 0.25) / 2),
    box(w + 0.3, 0.1, 0.12, 0, top + 0.25),
    box(0.4, 0.05, 0.4, -w / 2, 0.025),
    box(0.4, 0.05, 0.4, w / 2, 0.025),
  ]);
  const lamps = merge([-w / 2 + 0.1, w / 2 - 0.1].map((x) => cyl(0.07, 0.07, 0.1, 12, x, top + 0.35, 0)));
  return mergeGeometries([board, steel, lamps], true)!;
}

/** Steel ramp up onto a train roof. Groups: 0 deck, 1 frame. */
export function rampGeometry(): THREE.BufferGeometry {
  const L = WORLD.rampLength, h = H, w = W;
  const ang = Math.atan2(h, L);
  const deckLen = Math.hypot(L, h);
  const deck = box(w, 0.08, deckLen);
  deck.rotateX(ang);
  deck.translate(0, h / 2, 0);
  const frame: THREE.BufferGeometry[] = [];
  for (const x of [-w / 2, w / 2]) {
    const rail = box(0.08, 0.3, deckLen, x, 0, 0);
    rail.rotateX(ang);
    rail.translate(0, h / 2 + 0.12, 0);
    frame.push(rail);
    frame.push(box(0.1, h, 0.1, x * 0.9, h / 2, -L / 2 + 0.1));
    frame.push(box(0.1, h / 2, 0.1, x * 0.9, h / 4, 0));
  }
  return mergeGeometries([deck, merge(frame)], true)!;
}

/** Gold coin with raised rim (lathe), facing +z. */
export function coinGeometry(): THREE.BufferGeometry {
  const r = 0.36, t = 0.07;
  const pts = [
    new THREE.Vector2(0, -t * 0.6), new THREE.Vector2(r * 0.8, -t * 0.6), new THREE.Vector2(r * 0.82, -t), new THREE.Vector2(r, -t),
    new THREE.Vector2(r, t), new THREE.Vector2(r * 0.82, t), new THREE.Vector2(r * 0.8, t * 0.6), new THREE.Vector2(0, t * 0.6),
  ];
  const g = new THREE.LatheGeometry(pts, 32);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
