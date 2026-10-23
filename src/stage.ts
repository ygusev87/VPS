// Renderer, camera, lights and the play mat. The camera is fixed (no orbit
// controls) so every touch on a tablet means "grab", never "rotate".
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { C } from './theme';

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Bounds {
  hx: number;
  hz: number;
}

const VIEW_DIR = new THREE.Vector3(0, 1, 0.82).normalize();

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
  readonly world = new THREE.Group();
  bounds: Bounds = { hx: 6, hz: 4 };
  insets: Insets = { top: 90, bottom: 130, left: 12, right: 12 };
  private sun: THREE.DirectionalLight;
  private mat: THREE.Group | null = null;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  onBoundsChange?: (b: Bounds) => void;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(C.bg);
    this.scene.add(this.world);

    const hemi = new THREE.HemisphereLight('#fffaf0', '#d9c5ac', 1.6);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#fff3df', 2.3);
    this.sun.position.set(-5, 12, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 6;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#e6f3ff', 0.5);
    fill.position.set(6, 5, -4);
    this.scene.add(fill);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  get portrait() {
    return this.bounds.hz > this.bounds.hx * 1.15;
  }

  setInsets(insets: Insets) {
    this.insets = insets;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;

    const safeW = Math.max(100, w - this.insets.left - this.insets.right);
    const safeH = Math.max(100, h - this.insets.top - this.insets.bottom);
    // Shape the table like the free screen area; depth is foreshortened by the tilt.
    const ratio = (safeW / safeH) * 0.8;
    let hx: number;
    let hz: number;
    if (ratio >= 1) {
      hz = 3.3;
      hx = Math.max(3.6, Math.min(ratio * hz, 6.2));
    } else {
      // Portrait: a narrower, deeper table; levels lay their parts out top-to-bottom.
      hx = ratio < 0.75 ? 2.5 : 3.3;
      hz = Math.max(3.3, Math.min(hx / ratio, 5.6));
    }
    const changed = Math.abs(hx - this.bounds.hx) > 0.01 || Math.abs(hz - this.bounds.hz) > 0.01 || !this.mat;
    this.bounds = { hx, hz };
    if (changed) this.buildMat();
    this.fitCamera(w, h);
    if (changed) this.onBoundsChange?.(this.bounds);

    const s = this.sun.shadow.camera;
    s.left = -hx - 3;
    s.right = hx + 3;
    s.top = hz + 4;
    s.bottom = -hz - 4;
    s.near = 1;
    s.far = 40;
    s.updateProjectionMatrix();
  }

  /** Move the camera back until the whole mat fits inside the safe rectangle. */
  private fitCamera(w: number, h: number) {
    const { hx, hz } = this.bounds;
    const m = 0.45;
    const corners = [
      new THREE.Vector3(-hx - m, 0, -hz - m),
      new THREE.Vector3(hx + m, 0, -hz - m),
      new THREE.Vector3(-hx - m, 0, hz + m),
      new THREE.Vector3(hx + m, 0, hz + m),
      new THREE.Vector3(-hx, 1.8, -hz),
      new THREE.Vector3(hx, 1.8, -hz),
    ];
    const { top, bottom, left, right } = this.insets;
    const fits = (dist: number, cz: number) => {
      this.placeCamera(dist, cz);
      for (const c of corners) {
        const p = c.clone().project(this.camera);
        const x = ((p.x + 1) / 2) * w;
        const y = ((1 - p.y) / 2) * h;
        if (x < left || x > w - right || y < top || y > h - bottom) return false;
      }
      return true;
    };
    // Shift the look-at point so the mat centres in the safe area, then search distance.
    const cz = ((bottom - top) / h) * hz * 0.9;
    let lo = 4;
    let hi = 120;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid, cz)) hi = mid;
      else lo = mid;
    }
    this.placeCamera(hi, cz);
  }

  private placeCamera(dist: number, cz: number) {
    const target = new THREE.Vector3(0, 0, cz);
    this.camera.position.copy(target).addScaledVector(VIEW_DIR, dist);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private buildMat() {
    if (this.mat) {
      this.mat.removeFromParent();
      this.mat.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mm = m.material as THREE.MeshStandardMaterial;
          mm.map?.dispose();
          mm.dispose();
        }
      });
    }
    const { hx, hz } = this.bounds;
    const W = hx * 2 + 1.2;
    const D = hz * 2 + 1.2;
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.3, 0.3, D + 0.3, 4, 0.35), new THREE.MeshStandardMaterial({ color: C.line, roughness: 0.9 }));
    rim.position.y = -0.17;
    rim.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: matTexture(W, D), roughness: 0.92 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = -0.015;
    top.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.33;
    floor.receiveShadow = true;
    g.add(rim, top, floor);
    this.scene.add(g);
    this.mat = g;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Screen point → point on the horizontal plane at height y. */
  screenToPlane(x: number, y: number, height = 0, out = new THREE.Vector3()): THREE.Vector3 | null {
    this.setRay(x, y);
    this.plane.constant = -height;
    return this.raycaster.ray.intersectPlane(this.plane, out);
  }

  raycast(x: number, y: number, objects: THREE.Object3D[]): THREE.Intersection[] {
    this.setRay(x, y);
    return this.raycaster.intersectObjects(objects, false);
  }

  private setRay(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  /** World → CSS pixel coordinates relative to the viewport. */
  project(v: THREE.Vector3): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const p = v.clone().project(this.camera);
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** How many CSS pixels one world unit spans at point v. */
  pixelsPerUnit(v: THREE.Vector3): number {
    const a = this.project(v);
    const b = this.project(v.clone().add(new THREE.Vector3(1, 0, 0)));
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}

/** Cream mat with a fine grid and PCB-style traces around the edge. */
function matTexture(W: number, D: number): THREE.Texture {
  const ppu = 96;
  const cw = Math.min(4096, Math.round(W * ppu));
  const ch = Math.min(4096, Math.round(D * ppu));
  const sx = cw / W;
  const sy = ch / D;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#faf4e9';
  ctx.fillRect(0, 0, cw, ch);

  // Soft spotlight in the middle, like the reference artboard.
  const g = ctx.createRadialGradient(cw * 0.45, ch * 0.45, 0, cw * 0.45, ch * 0.45, Math.max(cw, ch) * 0.7);
  g.addColorStop(0, 'rgba(255,250,240,0.9)');
  g.addColorStop(1, 'rgba(239,227,209,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);

  const step = 0.5;
  ctx.lineWidth = 1.5;
  for (let x = 0, i = 0; x <= W + 1e-6; x += step, i++) {
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(206,192,173,0.55)' : 'rgba(206,192,173,0.28)';
    ctx.beginPath();
    ctx.moveTo(x * sx, 0);
    ctx.lineTo(x * sx, ch);
    ctx.stroke();
  }
  for (let y = 0, i = 0; y <= D + 1e-6; y += step, i++) {
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(206,192,173,0.55)' : 'rgba(206,192,173,0.28)';
    ctx.beginPath();
    ctx.moveTo(0, y * sy);
    ctx.lineTo(cw, y * sy);
    ctx.stroke();
  }

  // Decorative traces with 45° bends hugging the edges.
  ctx.strokeStyle = C.trace;
  ctx.fillStyle = '#faf4e9';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const u = sx;
  const trace = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * u, y * u) : ctx.moveTo(x * u, y * u)));
    ctx.stroke();
    for (const [x, y] of [pts[0], pts[pts.length - 1]]) {
      ctx.beginPath();
      ctx.arc(x * u, y * u, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };
  const e = 0.28;
  trace([[e, 1.2], [e, e + 0.5], [e + 0.5, e], [2.2, e]]);
  trace([[e + 0.2, 1.8], [e + 0.2, 1.1], [e + 0.7, 0.6], [1.6, 0.6]]);
  trace([[W - e, D - 1.2], [W - e, D - e - 0.5], [W - e - 0.5, D - e], [W - 2.2, D - e]]);
  trace([[W - e - 0.2, D - 1.8], [W - e - 0.2, D - 1.1], [W - e - 0.7, D - 0.6], [W - 1.6, D - 0.6]]);
  trace([[W - 2.6, e], [W - e - 0.5, e], [W - e, e + 0.5], [W - e, 1.5]]);
  trace([[2.6, D - e], [e + 0.5, D - e], [e, D - e - 0.5], [e, D - 1.5]]);

  // Little pixel blocks, like the reference's trace ornaments.
  ctx.fillStyle = '#d9c5ac';
  for (let i = 0; i < 4; i++) ctx.fillRect((W / 2 - 0.5 + i * 0.28) * u, (e - 0.07) * u, 0.14 * u, 0.14 * u);
  for (let i = 0; i < 4; i++) ctx.fillRect((W / 2 - 0.5 + i * 0.28) * u, (D - e - 0.07) * u, 0.14 * u, 0.14 * u);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
