// A little life for an animal model with no skeleton (a Tripo body is one
// solid mesh): its vertices are bent as it is drawn. The front part (head and
// neck) dips to the grass or turns to look at you, the back end swishes like a
// tail, the middle breathes. Nothing to buy, and it costs the iPad next to
// nothing. The model faces +X after model() (as the herd walks).
import * as THREE from 'three';

/** How a bent animal holds itself; set every frame, read by its shader. */
export class Pose {
  /** 0 head up … 1 nose in the grass. */
  graze = 0;
  /** Head turned to the side (radians, + turns the nose towards +Z). */
  look = 0;
  /** How hard the tail swishes (0 … 1). */
  wag = 0;
  readonly uniforms = {
    uToH: { value: new THREE.Matrix4() },
    uFromH: { value: new THREE.Matrix4() },
    /** x min, x max, top of the body (in the model's own space, standing on y 0). */
    uBox: { value: new THREE.Vector4() },
    /** graze, look, wag, time. */
    uPose: { value: new THREE.Vector4() },
  };

  update(time: number) {
    this.uniforms.uPose.value.set(this.graze, this.look, this.wag, time);
  }
}

const CHUNK = /* glsl */ `
uniform mat4 uToH;
uniform mat4 uFromH;
uniform vec4 uBox;
uniform vec4 uPose;
vec3 bendBody(vec3 p) {
  vec3 h = (uToH * vec4(p, 1.0)).xyz;
  float len = uBox.y - uBox.x;
  // The head and neck: the front 40 %, bending more towards the nose.
  float x0 = uBox.y - 0.42 * len;
  // (Only above the knees: the front legs stay where they stand.)
  float f = smoothstep(x0, uBox.y, h.x) * smoothstep(uBox.z * 0.3, uBox.z * 0.55, h.y);
  vec2 piv = vec2(x0, uBox.z * 0.72);
  float a = -uPose.x * 0.8 * f;
  vec2 d = h.xy - piv;
  float c = cos(a), s = sin(a);
  h.xy = piv + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  float b = uPose.y * f;
  vec2 e = vec2(h.x - x0, h.z);
  c = cos(b); s = sin(b);
  h.x = x0 + c * e.x - s * e.y;
  h.z = s * e.x + c * e.y;
  // The tail: the last bit of the back swishes from side to side.
  float t = smoothstep(uBox.x + 0.16 * len, uBox.x, h.x) * step(uBox.z * 0.45, h.y);
  h.z += sin(uPose.w * 7.0) * uPose.z * t * len * 0.07;
  // Breathing: the back rises and falls a little.
  h.y += sin(uPose.w * 2.1) * 0.012 * uBox.z * (1.0 - f) * (1.0 - t) * smoothstep(uBox.z * 0.4, uBox.z, h.y);
  return (uFromH * vec4(h, 1.0)).xyz;
}
`;

function patch(m: THREE.Material, pose: Pose) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, pose.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${CHUNK}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = bendBody(transformed);');
  };
  m.customProgramCacheKey = () => 'bend';
}

/**
 * Make a model (as model() returns it, before it is placed) bendable: each
 * mesh's material (and its shadow) gets the bend. Returns the pose to drive.
 */
export function bendable(model: THREE.Object3D): Pose | null {
  const pose = new Pose();
  model.updateMatrixWorld(true);
  const toModel = model.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    meshes.push(mesh);
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(toModel.clone().multiply(mesh.matrixWorld)));
  });
  // One mesh (a Tripo body) is what this is for; a model built of parts moves as it is.
  if (meshes.length !== 1) return null;
  const mesh = meshes[0];
  pose.uniforms.uToH.value.copy(toModel.clone().multiply(mesh.matrixWorld));
  pose.uniforms.uFromH.value.copy(pose.uniforms.uToH.value).invert();
  pose.uniforms.uBox.value.set(box.min.x, box.max.x, box.max.y, 0);
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) patch(m, pose);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  patch(depth, pose);
  mesh.customDepthMaterial = depth;
  return pose;
}
