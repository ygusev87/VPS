// Sculpted part bodies (generated image → 3D with Higgsfield, then compressed
// by scripts/optimize-models.sh). Parts fall back to their code-built bodies
// when a model is missing or fails to load.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const cache = new Map<string, THREE.Object3D>();

export async function loadModels(names: string[]): Promise<void> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
          const mat = m.material as THREE.MeshStandardMaterial;
          // Generated PBR maps tend to read dull under our soft studio light.
          mat.envMapIntensity = 1.2;
        });
        cache.set(name, gltf.scene);
      } catch {
        // Keep the code-built fallback.
      }
    }),
  );
}

export interface Fit {
  /** Target size along x (world units); the model is scaled uniformly. */
  width?: number;
  /** Or target size along z. */
  depth?: number;
  /** Or target height. */
  height?: number;
  /** Turn about y before fitting (radians). */
  rotateY?: number;
}

/** A fitted copy of a model: base at y = 0, centred on x/z. Null when not loaded. */
export function model(name: string, fit: Fit): THREE.Group | null {
  const src = cache.get(name);
  if (!src) return null;
  const inner = src.clone(true);
  // Each copy owns its materials so parts can glow independently.
  inner.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = (m.material as THREE.Material).clone();
  });
  inner.rotation.y = fit.rotateY ?? 0;
  const holder = new THREE.Group();
  holder.add(inner);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const s = fit.width ? fit.width / size.x : fit.depth ? fit.depth / size.z : fit.height ? fit.height / size.y : 1;
  inner.scale.setScalar(s);
  holder.updateMatrixWorld(true);
  box.setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  return holder;
}

export function hasModel(name: string) {
  return cache.has(name);
}

/** Iterate every vertex of a fitted model in its holder's space. */
function eachVertex(holder: THREE.Object3D, fn: (v: THREE.Vector3) => void) {
  holder.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const v = new THREE.Vector3();
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    const toHolder = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) fn(v.fromBufferAttribute(pos, i).applyMatrix4(toHolder));
  });
}

/** Mean of all vertices — for a symmetric rotor this is its spin axis. */
export function centroid(holder: THREE.Object3D): THREE.Vector3 {
  const sum = new THREE.Vector3();
  let n = 0;
  eachVertex(holder, (v) => {
    sum.add(v);
    n++;
  });
  return n ? sum.divideScalar(n) : sum;
}

/** Average of the vertices within `eps` of the model's far end along an axis (e.g. a shaft tip). */
export function tip(holder: THREE.Object3D, axis: 'x' | 'y' | 'z', dir: 1 | -1, eps = 0.03): THREE.Vector3 {
  let best = -Infinity;
  eachVertex(holder, (v) => (best = Math.max(best, v[axis] * dir)));
  const sum = new THREE.Vector3();
  let n = 0;
  eachVertex(holder, (v) => {
    if (v[axis] * dir > best - eps) {
      sum.add(v);
      n++;
    }
  });
  return n ? sum.divideScalar(n) : sum;
}

export function sizeOf(o: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
}
