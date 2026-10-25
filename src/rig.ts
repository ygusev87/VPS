// The farm's leading animals have a skeleton from Tripo (a rig only, no bought
// animation clips): their head and tail are bones we turn ourselves. Which
// bone is which, the axes (in the model's own space, as it comes from the
// file) and the safe angles were measured by Codex
// (assets-src/farm-v3/hero-rigs/*-controls.json).
import * as THREE from 'three';

type Control = [bone: string, axis: [number, number, number], degrees: number];

interface RigSpec {
  head: Control;
  look: Control;
  tail?: Control;
  /** Which way its nose points, in the model's own space (+X unless told). */
  forward?: [number, number, number];
}

export const RIGS: Record<string, RigSpec> = {
  cow: { head: ['tripo::Head_1', [0, 0, 1], -15], look: ['tripo::Head_1', [0, 1, 0], 15], tail: ['bone_1', [1, 0, 0], 20] },
  horse: { head: ['tripo::Head_0', [0, 0, 1], -15], look: ['tripo::Head_0', [0, 1, 0], 15], tail: ['tripo::Tail_0', [1, 0, 0], 20] },
  pig: { head: ['tripo::Head_1', [0, 0, 1], -15], look: ['tripo::Head_1', [0, 1, 0], 15], tail: ['bone_10', [1, 0, 0], 20] },
  goat: { head: ['bone_5', [0, 0, 1], -15], look: ['bone_5', [0, 1, 0], 15], tail: ['bone_17', [1, 0, 0], 20] },
  dog: {
    head: ['tripo::Head_1', [-0.8243625977, 0, 0.5660621057], -15],
    look: ['tripo::Head_1', [0, 1, 0], 15],
    tail: ['tripo::Tail_0', [0.5660621057, 0, 0.8243625977], 20],
    forward: [0.5660621057, 0, 0.8243625977],
  },
};

/** three.js renames nodes as it loads them ("tripo::Head_1" becomes "tripoHead_1"). */
const loaded = (name: string) => THREE.PropertyBinding.sanitizeNodeName(name);

interface Joint {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  /** The axis in the bone's parent's space, and the full angle (radians). */
  axis: THREE.Vector3;
  max: number;
}

const q = new THREE.Quaternion();
/**
 * Codex measured ±15° as surely clean; at the map's distance nearly twice that
 * still looks clean (checked on all five), and a 15° nod is hard to see.
 */
const GAIN = 1.8;

export class Rig {
  private head: Joint;
  private look: Joint;
  private tail: Joint | null;
  readonly forward: THREE.Vector3;

  private constructor(head: Joint, look: Joint, tail: Joint | null, forward: THREE.Vector3) {
    this.head = head;
    this.look = look;
    this.tail = tail;
    this.forward = forward;
  }

  /** The rig of a model as model() returns it (its first child is the file's scene), or null if the bones are not there. */
  static of(model: THREE.Object3D, kind: string): Rig | null {
    const spec = RIGS[kind];
    const scene = model.children[0];
    if (!spec || !scene) return null;
    model.updateMatrixWorld(true);
    const sceneQ = scene.getWorldQuaternion(new THREE.Quaternion()).invert();
    const joint = ([name, axis, deg]: Control): Joint | null => {
      let bone: THREE.Bone | null = null;
      scene.traverse((o) => {
        if (!bone && (o as THREE.Bone).isBone && (o.name === loaded(name) || o.userData.name === name)) bone = o as THREE.Bone;
      });
      if (!bone) return null;
      const b = bone as THREE.Bone;
      // From the model's own space into the space the bone turns in (its parent's).
      const parentQ = b.parent!.getWorldQuaternion(new THREE.Quaternion()).premultiply(sceneQ);
      return { bone: b, rest: b.quaternion.clone(), axis: new THREE.Vector3(...axis).applyQuaternion(parentQ.invert()).normalize(), max: THREE.MathUtils.degToRad(deg) * GAIN };
    };
    const head = joint(spec.head);
    const look = joint(spec.look);
    if (!head || !look) return null;
    const tail = spec.tail ? joint(spec.tail) : null;
    return new Rig(head, look, tail, new THREE.Vector3(...(spec.forward ?? [1, 0, 0])));
  }

  /**
   * Pose it: nod 0 … 1 (head down), look -1 … 1 (to its left or right),
   * tail -1 … 1. The head's two turns share a bone, so they are made together.
   */
  set(nod: number, look: number, tail: number) {
    const h = this.head;
    h.bone.quaternion.copy(h.rest);
    h.bone.quaternion.premultiply(q.setFromAxisAngle(h.axis, h.max * nod));
    h.bone.quaternion.premultiply(q.setFromAxisAngle(this.look.axis, this.look.max * THREE.MathUtils.clamp(look, -1, 1)));
    if (this.tail) {
      const t = this.tail;
      t.bone.quaternion.copy(t.rest).premultiply(q.setFromAxisAngle(t.axis, t.max * THREE.MathUtils.clamp(tail, -1, 1)));
    }
  }
}
