// Card pictures are rendered from the same 3D models as the table, so the
// tray and the level picker always match what the child will see.
import * as THREE from 'three';
import type { PartKind } from './parts/base';
import { createPart } from './parts/models';

const cache = new Map<string, string>();

export function renderThumbs(kinds: PartKind[]): void {
  const size = 256;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fffaf0', '#d9c5ac', 1.8));
  const sun = new THREE.DirectionalLight('#fff3df', 2.4);
  sun.position.set(-4, 10, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  for (const kind of kinds) {
    for (const lit of [false, true]) {
      const part = createPart(kind);
      if (lit) {
        part.state = { level: 1, current: 0.3, reversed: false, shorted: false };
        part.closed = true;
      }
      // Let springs and glows settle.
      for (let i = 0; i < 40; i++) part.update(0.05);
      scene.add(part.root);
      // Frame the solid parts only; glow sprites would push the camera away.
      const box = new THREE.Box3();
      part.root.updateMatrixWorld(true);
      part.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.castShadow) box.expandByObject(m);
      });
      const center = box.getCenter(new THREE.Vector3());
      const r = box.getSize(new THREE.Vector3()).length() / 2;
      const dir = new THREE.Vector3(0.25, 0.75, 1).normalize();
      camera.position.copy(center).addScaledVector(dir, r / Math.sin(THREE.MathUtils.degToRad(14)) * 0.78);
      camera.lookAt(center);
      renderer.render(scene, camera);
      cache.set(`${kind}:${lit}`, renderer.domElement.toDataURL('image/png'));
      part.root.removeFromParent();
    }
  }
  renderer.dispose();
  renderer.forceContextLoss();
}

export function thumb(kind: PartKind, lit = false): string {
  return cache.get(`${kind}:${lit}`) ?? '';
}
