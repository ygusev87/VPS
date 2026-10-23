// Dev tool: /tools/viewer.html?m=battery shows a model from four sides with
// axes (x red, y green, z blue) so it can be oriented on its plate.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const name = new URLSearchParams(location.search).get('m') ?? 'battery';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync(`/models/${name}.glb`);
const box = new THREE.Box3().setFromObject(gltf.scene);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
document.title = `${name} ${size.toArray().map((v) => v.toFixed(3)).join(' × ')}`;

const views: [string, THREE.Vector3][] = [
  ['front +z', new THREE.Vector3(0, 0.15, 1)],
  ['right +x', new THREE.Vector3(1, 0.15, 0)],
  ['top +y', new THREE.Vector3(0, 1, 0.001)],
  ['game view', new THREE.Vector3(0, 1, 0.78)],
];
for (const [label, dir] of views) {
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setSize(480, 360);
  r.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6eddd');
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.DirectionalLight('#fff', 2).translateY(5).translateZ(3));
  scene.add(gltf.scene.clone());
  scene.add(new THREE.AxesHelper(size.length() * 0.7));
  const cam = new THREE.PerspectiveCamera(30, 480 / 360, 0.01, 100);
  cam.position.copy(center).addScaledVector(dir.normalize(), size.length() * 2.2);
  cam.lookAt(center);
  r.render(scene, cam);
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  wrap.innerHTML = `<div class="label">${label} — ${document.title}</div>`;
  wrap.appendChild(r.domElement);
  document.getElementById('views')!.appendChild(wrap);
}
