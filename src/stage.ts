// Renderer, camera and the endless table. The camera never rotates: one
// finger on empty table pans, two fingers pinch-zoom, so a touch on a part
// always means "grab".
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { C } from './theme';

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const VIEW_DIR = new THREE.Vector3(0, 1, 0.78).normalize();
const MIN_DIST = 7;
const MAX_DIST = 46;
/** How far from the origin the view may wander. */
const LIMIT = 26;
/** Largest on-screen scale `frame()` will choose, in CSS pixels per table unit. */
const MAX_PPU = 64;

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(26, 1, 0.5, 300);
  readonly world = new THREE.Group();
  insets: Insets = { top: 90, bottom: 130, left: 80, right: 12 };
  /** Point on the table the camera looks at, and how far away it is. */
  readonly target = new THREE.Vector3();
  distance = 20;
  private goalTarget = new THREE.Vector3();
  private goalDistance = 20;
  private sun: THREE.DirectionalLight;
  private ground: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private w = 1;
  private h = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Soft studio reflections make plastic and brass read as real materials.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();

    // The page background shows through; the grid fades into it with distance.
    this.scene.fog = new THREE.Fog(C.bg, 30, 80);
    this.scene.add(this.world);

    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#d9c5ac', 1.05));
    this.sun = new THREE.DirectionalLight('#fff3df', 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 5;
    this.sun.shadow.blurSamples = 16;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#e8f2ff', 0.45);
    fill.position.set(8, 6, -6);
    this.scene.add(fill);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.renderOrder = -2;
    const shadows = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: '#3c2d14', opacity: 0.2 }));
    shadows.rotation.x = -Math.PI / 2;
    shadows.position.y = 0.002;
    shadows.receiveShadow = true;
    shadows.renderOrder = -1;
    this.scene.add(this.ground, shadows);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Tall screens lay level parts out top-to-bottom. */
  get portrait() {
    const sw = this.w - this.insets.left - this.insets.right;
    const sh = this.h - this.insets.top - this.insets.bottom;
    return sh > sw * 1.15;
  }

  setInsets(insets: Insets) {
    this.insets = insets;
    this.resize();
  }

  resize() {
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    // Put the optical centre in the middle of the free area between panels.
    const { top, bottom, left, right } = this.insets;
    const sx = left + (this.w - left - right) / 2;
    const sy = top + (this.h - top - bottom) / 2;
    this.camera.setViewOffset(this.w, this.h, this.w / 2 - sx, this.h / 2 - sy, this.w, this.h);
    this.placeCamera();
  }

  private placeCamera() {
    this.camera.position.copy(this.target).addScaledVector(VIEW_DIR, this.distance);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const f = this.scene.fog as THREE.Fog;
    f.near = this.distance * 1.15;
    f.far = this.distance * 3.4;
    // Shadows follow the view.
    const s = this.sun.shadow.camera;
    const r = this.distance * 0.75;
    this.sun.position.copy(this.target).add(new THREE.Vector3(-6, 14, 8));
    this.sun.target.position.copy(this.target);
    s.left = -r;
    s.right = r;
    s.top = r;
    s.bottom = -r;
    s.near = 1;
    s.far = 60;
    s.updateProjectionMatrix();
  }

  /** Ease toward the goal view (after framing or a button press). */
  update(dt: number) {
    if (this.target.distanceToSquared(this.goalTarget) < 1e-6 && Math.abs(this.distance - this.goalDistance) < 1e-3) return;
    this.target.x = THREE.MathUtils.damp(this.target.x, this.goalTarget.x, 6, dt);
    this.target.z = THREE.MathUtils.damp(this.target.z, this.goalTarget.z, 6, dt);
    this.distance = THREE.MathUtils.damp(this.distance, this.goalDistance, 6, dt);
    this.placeCamera();
  }

  /** Jump the view (used while a finger drives it). */
  private setView(target: THREE.Vector3, distance: number) {
    target.y = 0;
    const len = Math.hypot(target.x, target.z);
    if (len > LIMIT) target.multiplyScalar(LIMIT / len);
    this.target.copy(target);
    this.goalTarget.copy(target);
    this.distance = this.goalDistance = THREE.MathUtils.clamp(distance, MIN_DIST, MAX_DIST);
    this.placeCamera();
  }

  /** Keep the table point `anchor` under screen point (x, y). */
  panTo(anchor: THREE.Vector3, x: number, y: number) {
    const p = this.screenToPlane(x, y);
    if (!p) return;
    this.setView(this.target.clone().add(anchor).sub(p), this.distance);
  }

  /** Zoom by a factor around a screen point, keeping that point fixed. */
  zoomAt(factor: number, x: number, y: number) {
    const anchor = this.screenToPlane(x, y);
    this.setView(this.target.clone(), this.distance * factor);
    if (anchor) this.panTo(anchor, x, y);
  }

  /** Set zoom immediately (pinch); pair with panTo to keep the fingers' spot. */
  setDistance(d: number) {
    this.setView(this.target.clone(), d);
  }

  zoomBy(factor: number) {
    this.goalDistance = THREE.MathUtils.clamp(this.goalDistance * factor, MIN_DIST, MAX_DIST);
  }

  /** Smoothly fit a set of table points into the free area. */
  frame(points: THREE.Vector3[], instant = false) {
    if (!points.length) points = [new THREE.Vector3()];
    const box = new THREE.Box3().setFromPoints(points);
    const center = box.getCenter(new THREE.Vector3()).setY(0);
    const corners = [
      new THREE.Vector3(box.min.x, 0, box.min.z),
      new THREE.Vector3(box.max.x, 0, box.min.z),
      new THREE.Vector3(box.min.x, 0, box.max.z),
      new THREE.Vector3(box.max.x, 0, box.max.z),
      new THREE.Vector3(box.min.x, 1.8, box.min.z),
      new THREE.Vector3(box.max.x, 1.8, box.min.z),
    ];
    const { top, bottom, left, right } = this.insets;
    const pad = 28;
    const saveT = this.target.clone();
    const saveD = this.distance;
    let lo = MIN_DIST;
    let hi = MAX_DIST;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      this.target.copy(center);
      this.distance = mid;
      this.placeCamera();
      const ok = corners.every((c) => {
        const p = this.project(c);
        return p.x > left + pad && p.x < this.w - right - pad && p.y > top + pad && p.y < this.h - bottom - pad;
      });
      if (ok) hi = mid;
      else lo = mid;
    }
    // On big monitors the free area is huge; don't blow the parts up past the
    // reference's scale, leave the extra room as open table instead.
    this.target.copy(center);
    this.distance = hi;
    this.placeCamera();
    const ppu = this.pixelsPerUnit(center);
    if (ppu > MAX_PPU) hi *= ppu / MAX_PPU;
    this.target.copy(saveT);
    this.distance = saveD;
    this.placeCamera();
    this.goalTarget.copy(center);
    this.goalDistance = THREE.MathUtils.clamp(hi, 11, MAX_DIST);
    if (instant) this.setView(this.goalTarget.clone(), this.goalDistance);
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

  /** Table area currently in view (roughly), for placing new parts. */
  viewCenter(): THREE.Vector3 {
    return this.goalTarget.clone();
  }
}

/** Transparent graph-paper tile: fine lines every 0.5 units, stronger every 2. */
function gridTexture(): THREE.Texture {
  const px = 512; // one tile = 4 units
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  const step = px / 8;
  for (let i = 0; i < 8; i++) {
    const major = i % 4 === 0;
    ctx.fillStyle = major ? 'rgba(196,178,152,0.38)' : 'rgba(206,192,173,0.2)';
    const t = major ? 2 : 1.5;
    ctx.fillRect(i * step, 0, t, px);
    ctx.fillRect(0, i * step, px, t);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(100, 100);
  tex.anisotropy = 8;
  return tex;
}
