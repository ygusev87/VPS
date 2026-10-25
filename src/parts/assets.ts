// Sculpted part bodies (generated image → 3D with Higgsfield, then compressed
// by scripts/optimize-models.sh). Parts fall back to their code-built bodies
// when a model is missing or fails to load.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const cache = new Map<string, THREE.Object3D>();
/** Animation clips of rigged models (the farm's walking fox). */
const clipCache = new Map<string, THREE.AnimationClip[]>();

export async function loadModels(names: string[]): Promise<void> {
  const loader = new GLTFLoader();
  // The decoder compiles WebAssembly; preview hosts may forbid that and don't need it.
  if (!import.meta.env.VITE_MODELS_AS_JS) loader.setMeshoptDecoder(MeshoptDecoder);
  await Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await parseWithImages(loader, import.meta.env.VITE_MODELS_AS_JS ? await moduleBytes(name) : await fileBytes(name));
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
          if ((m as THREE.SkinnedMesh).isSkinnedMesh) gltf.scene.userData.skinned = true;
          const mat = m.material as THREE.MeshStandardMaterial;
          // Generated PBR maps tend to read dull under our soft studio light.
          mat.envMapIntensity = 1.2;
        });
        cache.set(name, gltf.scene);
        if (gltf.animations.length) clipCache.set(name, gltf.animations);
      } catch {
        // Keep the code-built fallback.
      }
    }),
  );
}

async function fileBytes(name: string): Promise<ArrayBuffer> {
  const r = await fetch(`${import.meta.env.BASE_URL}models/${name}.glb`);
  if (!r.ok) throw new Error(`model ${name}: ${r.status}`);
  return r.arrayBuffer();
}

/**
 * For hosts that serve only scripts, styles, images and the like (the claude.ai
 * preview): each model ships as `models/<name>.js` exporting the .glb bytes in
 * base64, without meshopt.
 */
async function moduleBytes(name: string): Promise<ArrayBuffer> {
  const url = new URL(`models/${name}.js`, document.baseURI).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default: string };
  return Uint8Array.from(atob(mod.default), (c) => c.charCodeAt(0)).buffer;
}

/**
 * Parse a .glb with its textures decoded through <img>. GLTFLoader prefers
 * createImageBitmap when it exists, but on iPad/iPhone (Safari, and above all
 * a game started from the Home Screen) WebP textures decoded that way come out
 * black. The loader decides synchronously inside parse(), so hiding
 * createImageBitmap for that call is enough.
 */
function parseWithImages(loader: GLTFLoader, bin: ArrayBuffer): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  return new Promise((resolve, reject) => {
    const original = window.createImageBitmap;
    (window as { createImageBitmap?: unknown }).createImageBitmap = undefined;
    try {
      loader.parse(bin, '', resolve, reject);
    } finally {
      window.createImageBitmap = original;
    }
  });
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
  // A rigged model needs its own skeleton, bound to its own copy of the bones.
  const inner = src.userData.skinned ? cloneSkinned(src) : src.clone(true);
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

/**
 * Frees the video memory of every model texture nothing in `scene` shows (the
 * workbench's parts while a map is open): an iPad has little of it. A texture
 * keeps its picture, so it simply goes up to the GPU again if it is drawn later.
 */
export function releaseUnused(scene: THREE.Object3D) {
  const used = new Set<THREE.Texture>();
  const textures = (m: THREE.Material) => Object.values(m).filter((v): v is THREE.Texture => v instanceof THREE.Texture);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) for (const mat of ([] as THREE.Material[]).concat(m.material)) for (const t of textures(mat)) used.add(t);
  });
  let freed = 0;
  for (const src of cache.values()) {
    src.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of ([] as THREE.Material[]).concat(m.material))
        for (const t of textures(mat))
          if (!used.has(t)) {
            t.dispose();
            freed++;
          }
    });
  }
  return freed;
}

/** A model's animation clips (empty when it has none or is not loaded). */
export function clipsOf(name: string): THREE.AnimationClip[] {
  return clipCache.get(name) ?? [];
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

/**
 * Average of the vertices within `eps` of the model's far end along an axis
 * (e.g. a shaft tip), optionally only among the vertices `where` accepts.
 */
export function tip(holder: THREE.Object3D, axis: 'x' | 'y' | 'z', dir: 1 | -1, eps = 0.03, where?: (v: THREE.Vector3) => boolean): THREE.Vector3 {
  let best = -Infinity;
  eachVertex(holder, (v) => {
    if (!where || where(v)) best = Math.max(best, v[axis] * dir);
  });
  const sum = new THREE.Vector3();
  let n = 0;
  eachVertex(holder, (v) => {
    if (v[axis] * dir > best - eps && (!where || where(v))) {
      sum.add(v);
      n++;
    }
  });
  return n ? sum.divideScalar(n) : sum;
}

/** Bounding box of the vertices `where` accepts, in the holder's space. */
export function boundsWhere(holder: THREE.Object3D, where: (v: THREE.Vector3) => boolean): THREE.Box3 {
  const box = new THREE.Box3();
  eachVertex(holder, (v) => {
    if (where(v)) box.expandByPoint(v);
  });
  return box;
}

export function sizeOf(o: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
}
