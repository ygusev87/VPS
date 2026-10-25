// Dev tool: /tools/contact.html?n=battery,bell[&v=top|front|side|game] renders
// models side by side with triangle counts and sizes (?d= another folder).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const q = new URLSearchParams(location.search);
const names = (q.get('n') ?? '').split(',');
const dir = q.get('d') ?? '/models/';
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(240, 240);
r.toneMapping = THREE.NeutralToneMapping;
const env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const views: Record<string, THREE.Vector3> = { top: new THREE.Vector3(0, 1, 0.001), front: new THREE.Vector3(0, 0.12, 1), side: new THREE.Vector3(1, 0.12, 0), game: new THREE.Vector3(0, 1, 0.78) };
const view = views[q.get('v') ?? ''] ?? new THREE.Vector3(0.35, 0.75, 1);
for (const n of names) {
  const g = await loader.loadAsync(`${dir}${n}.glb`);
  let tris = 0;
  g.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) tris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; });
  const box = new THREE.Box3().setFromObject(g.scene);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const s = new THREE.Scene();
  s.background = new THREE.Color('#f6eddd');
  s.environment = env;
  s.add(new THREE.DirectionalLight('#fff', 2).translateY(5).translateZ(3));
  s.add(g.scene);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
  cam.position.copy(c).addScaledVector(view.clone().normalize(), size.length() * 1.9);
  cam.lookAt(c);
  r.render(s, cam);
  const img = new Image();
  img.src = r.domElement.toDataURL();
  const d = document.createElement('div');
  d.className = 'c';
  d.innerHTML = `<b>${n} ${(tris / 1000).toFixed(0)}k ${size.toArray().map((v) => v.toFixed(2)).join('×')}</b>`;
  d.appendChild(img);
  document.getElementById('g')!.appendChild(d);
}
document.title = 'done';
