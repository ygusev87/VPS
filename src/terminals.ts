// Every terminal post on the table drawn by a few shared instanced meshes:
// one for the metal (all posts are alike) and one per collar look (colour,
// socket shape). A part brings ~2 draws per post; with dozens of parts on a
// map that was most of a frame on the iPad. Each post keeps its own hidden
// meshes, whose world matrices place the instances.
import * as THREE from 'three';
import type { Part } from './parts/base';

export class TerminalBatch {
  readonly root = new THREE.Group();
  private meshes = new Map<string, THREE.InstancedMesh>();

  /** Place the instances where the posts of these parts are now (call before drawing). */
  update(parts: readonly Part[]) {
    const buckets = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; at: THREE.Matrix4[] }>();
    for (const p of parts) {
      if (!p.root.visible || !p.body.visible) continue;
      p.root.updateMatrixWorld(true);
      for (const t of p.terminals) {
        if (!shown(t.post, p.root)) continue;
        for (const m of [t.metal, t.collar]) {
          const mat = m.material as THREE.Material;
          const key = `${m.geometry.uuid}|${mat.uuid}`;
          let b = buckets.get(key);
          if (!b) buckets.set(key, (b = { geo: m.geometry, mat, at: [] }));
          b.at.push(m.matrixWorld);
        }
      }
    }
    for (const [key, im] of this.meshes) if (!buckets.has(key)) im.count = 0;
    for (const [key, b] of buckets) {
      let im = this.meshes.get(key);
      if (!im || im.instanceMatrix.count < b.at.length) {
        if (im) {
          im.removeFromParent();
          im.dispose();
        }
        im = new THREE.InstancedMesh(b.geo, b.mat, Math.ceil(b.at.length * 1.5) + 8);
        im.receiveShadow = true;
        // Posts are all over the board: never culled as one lump.
        im.frustumCulled = false;
        this.meshes.set(key, im);
        this.root.add(im);
      }
      b.at.forEach((m, i) => im!.setMatrixAt(i, m));
      im.count = b.at.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }
}

/** Is this object drawn, i.e. it and every parent up to the part's root visible? */
function shown(o: THREE.Object3D | null, root: THREE.Object3D) {
  for (; o && o !== root; o = o.parent) if (!o.visible) return false;
  return true;
}
