// Renderer, camera and the endless table. The camera never rotates: one
// finger on empty table pans, two fingers pinch-zoom, so a touch on a part
// always means "grab".
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { C } from './theme';

/**
 * Picture quality. 2: soft shadows in corners and joints (ambient occlusion),
 * glow and smoothing at full sharpness; 1: glow and smoothing at a lower
 * resolution; 0: plain render. The game starts high and steps down by
 * itself when the device cannot keep up (`?q=0..2` forces one).
 */
export type Quality = 0 | 1 | 2;

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const VIEW_DIR = new THREE.Vector3(0, 1, 0.78).normalize();
const MIN_DIST = 7;
// Far enough to see a whole map at once, even on a phone held upright (its view is narrow).
const MAX_DIST = 900;
/** How far from the origin the view may wander over the workbench (a map sets its own, see `limit`). */
const LIMIT = 36;
/** Largest on-screen scale `frame()` will choose, in CSS pixels per table unit. */
const MAX_PPU = 46;

/**
 * The table's paper: a shade darker than the cream panels (C.bg), so the parts'
 * cream plates stand out on it by day, and the panels read as cards above it.
 */
const TABLE = '#ece0ca';

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
  private hemi: THREE.HemisphereLight;
  private fill: THREE.DirectionalLight;
  private ground: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private w = 1;
  private h = 1;
  private nightK = 0;
  private bgK = -1;
  /** Screen-filling paper behind everything (see drawBackground). */
  private backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { map: { value: null as THREE.Texture | null }, gain: { value: BACK_GAIN } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.99999, 1.0); }`,
      fragmentShader: `uniform sampler2D map; uniform float gain; varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(texture2D(map, vUv).rgb * gain, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthWrite: false,
      depthTest: false,
    }),
  );
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private finish: FinishOutputPass | null = null;
  quality: Quality = 2;
  /** How far from the origin the view may wander: the workbench's LIMIT, or as far as a map reaches. */
  limit = LIMIT;
  /**
   * The canvas changed size on its own (iPad rotation: Safari fires "resize"
   * before the layout has the new size). `flipped`: portrait ↔ landscape.
   */
  onResize?: (flipped: boolean) => void;
  /** Set by `?q=`: never change quality on our own. */
  private pinned = false;
  private slowFor = 0;
  private lastFrame = 0;
  private shadowView = new THREE.Matrix4();
  private shadowTick = 0;
  /** Something is being dragged: keep shadows fresh every frame. */
  busy = false;
  private sinceStart = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    // No canvas antialiasing: every frame goes through the post chain (SMAA, or a multisampled target).
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    // Soft studio reflections make plastic and brass read as real materials.
    this.makeEnvironment();
    this.scene.environmentIntensity = DAY.env;
    // An iPad may take the GPU away (memory pressure, the game put away) and give it back: three.js
    // uploads textures and models again by itself, but the reflections were drawn on the GPU — redraw
    // them, and the post-processing targets, or everything comes back dark.
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.makeEnvironment();
      this.buildComposer();
      this.renderer.shadowMap.needsUpdate = true;
    });

    // The paper background is drawn by the scene (so glow can spill over it);
    // the grid fades into it with distance.
    this.scene.fog = new THREE.Fog(TABLE, 30, 80);
    this.scene.add(this.world);
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -100;
    this.scene.add(this.backdrop);

    this.hemi = new THREE.HemisphereLight('#fffaf0', '#d9c5ac', DAY.hemi);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3df', DAY.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 5;
    this.sun.shadow.blurSamples = 16;
    this.scene.add(this.sun, this.sun.target);
    // A cool light from behind draws bright rims along the tops of the parts.
    this.fill = new THREE.DirectionalLight('#e8f2ff', DAY.rim);
    this.fill.position.set(8, 6, -6);
    this.scene.add(this.fill);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.renderOrder = -2;
    const shadows = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: '#3c2d14', opacity: 0.55 }));
    shadows.rotation.x = -Math.PI / 2;
    shadows.position.y = 0.002;
    shadows.receiveShadow = true;
    // The table gets its darkening from contact shadows; AO is for the parts' own creases.
    shadows.userData.noAO = true;
    shadows.renderOrder = -1;
    this.scene.add(this.ground, shadows);

    const q = new URLSearchParams(location.search).get('q');
    if (q === '0' || q === '1' || q === '2') {
      this.quality = +q as Quality;
      this.pinned = true;
    }
    this.buildComposer();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Catch size changes the resize event missed, before they stretch the picture. */
  /**
   * The canvas's place on the page, read once a frame. project() runs hundreds
   * of times a frame (hint badges, wires on screen); asking the page each time
   * makes Safari redo its layout after every HUD change.
   */
  private rect = { left: 0, top: 0, width: 1, height: 1 };

  private checkSize() {
    const b = this.canvas.getBoundingClientRect();
    this.rect = { left: b.left, top: b.top, width: b.width || 1, height: b.height || 1 };
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h || (w === this.w && h === this.h)) return;
    const wasWide = this.w > this.h;
    this.resize();
    this.onResize?.(wasWide !== w > h);
  }

  /**
   * Retina sharpness within a pixel budget: every post pass touches each pixel,
   * and a 12.9" iPad at 2× is 5.6 million of them. ~4 MP keeps the 11" iPad
   * at almost 2× and the big one at ~1.7×, which SMAA makes look just as crisp.
   */
  private pixelRatio() {
    const budget = this.quality === 2 ? 4.0e6 : this.quality === 1 ? 3.0e6 : 2.2e6;
    const css = Math.max(1, this.w * this.h);
    return Math.max(1, Math.min(window.devicePixelRatio, 2, Math.sqrt(budget / css)));
  }

  /** The studio reflections every material shows (drawn on the GPU, so redrawn after a lost context). */
  private makeEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  /** The post-processing chain for the current quality. */
  private buildComposer() {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    this.finish = null;
    const r = this.renderer;
    // Always through a linear HDR target (so translucent layers look the same at
    // every quality); the plain one uses the GPU's own antialiasing.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, samples: this.quality === 0 ? 4 : 0 });
    const composer = new EffectComposer(r, target);
    if (this.quality === 0) {
      composer.addPass(new RenderPass(this.scene, this.camera));
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.sizeComposer();
      return;
    }
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.quality >= 2) composer.addPass(new SoftShadows(this.scene, this.camera));
    // Only what is brighter than white glows: lit lamps, LEDs, the current.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 1.0);
    // A glow is soft anyway: work at no more than ~1200 px across (it starts at half of that).
    const bloomSize = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w: number, h: number) => {
      const k = Math.min(1, AO_DIV / Math.max(w, h));
      bloomSize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    };
    composer.addPass(this.bloom);
    // Tone mapping, sRGB and the finishing touch in one full-screen pass.
    this.finish = new FinishOutputPass();
    composer.addPass(this.finish);
    composer.addPass(new SMAAPass());
    this.composer = composer;
    this.setNightLook();
    this.sizeComposer();
  }

  private sizeComposer() {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(this.w, this.h);
  }

  /**
   * Step quality down when frames stay slow (below ~40 per second for a few
   * seconds), never back up, so it settles instead of flickering.
   */
  private watchSpeed() {
    const now = performance.now();
    const dt = this.lastFrame ? now - this.lastFrame : 16;
    this.lastFrame = now;
    // A long gap means the game was in the background, not that it is slow.
    if (this.pinned || this.quality === 0 || document.hidden || dt > 1500) return;
    this.sinceStart += dt;
    if (this.sinceStart < 4000) return;
    this.slowFor = dt > 25 ? this.slowFor + dt : Math.max(0, this.slowFor - dt * 2);
    if (this.slowFor > 2500) {
      this.slowFor = 0;
      this.sinceStart = 2000;
      this.quality = (this.quality - 1) as Quality;
      this.buildComposer();
      this.resize();
    }
  }

  /**
   * Night table: the room goes dark (a cool moonlight stays so parts can be
   * found), while everything that glows keeps its full brightness.
   */
  setNight(on: boolean) {
    this.setNightAmount(on ? 1 : 0);
  }

  /** The workbench's graph paper; a map lies on its own board and hides it. */
  showGrid(on: boolean) {
    this.ground.visible = on;
  }

  /** 0 day .. 1 night, smoothly (a sunset on a map). */
  setNightAmount(k: number) {
    k = THREE.MathUtils.clamp(k, 0, 1);
    this.nightK = k;
    const L = THREE.MathUtils.lerp;
    const mix = (a: string, b: string) => new THREE.Color(a).lerp(new THREE.Color(b), k);
    this.hemi.intensity = L(DAY.hemi, 0.22, k);
    this.hemi.color.copy(mix('#fffaf0', '#9fb2e6'));
    this.hemi.groundColor.copy(mix('#d9c5ac', '#2a3150'));
    this.sun.intensity = L(DAY.sun, 0.35, k);
    // Through warm orange at dusk to cool moonlight.
    this.sun.color.copy(k < 0.5 ? new THREE.Color('#fff3df').lerp(new THREE.Color('#ffb070'), k * 2) : new THREE.Color('#ffb070').lerp(new THREE.Color('#b9c8ff'), (k - 0.5) * 2));
    this.fill.intensity = L(DAY.rim, 0.3, k);
    this.scene.environmentIntensity = L(DAY.env, 0.14, k);
    (this.ground.material as THREE.MeshBasicMaterial).color.copy(mix('#ffffff', '#5b6687'));
    if (Math.abs(k - this.bgK) > 0.04 || k === 0 || k === 1) {
      this.bgK = k;
      this.drawBackground();
    }
    this.setNightLook();
  }

  /** At night everything bright glows wider, like eyes used to the dark. */
  private setNightLook() {
    if (this.bloom) {
      const k = this.nightK;
      this.bloom.strength = THREE.MathUtils.lerp(0.7, 1.05, k);
      this.bloom.radius = THREE.MathUtils.lerp(0.55, 0.7, k);
      this.bloom.threshold = THREE.MathUtils.lerp(2.4, 0.75, k);
    }
    if (this.finish) {
      const k = this.nightK;
      this.finish.uniforms.uVignette.value = THREE.MathUtils.lerp(0.12, 0.42, k);
      this.finish.uniforms.uVibrance.value = THREE.MathUtils.lerp(0.65, 0.25, k);
      this.finish.uniforms.uContrast.value = THREE.MathUtils.lerp(1.12, 1.02, k);
    }
  }

  /**
   * The paper (or night) background as a screen-filling texture, with colours
   * pre-compensated for tone mapping so it matches the page around the panels.
   */
  private drawBackground() {
    const w = 256;
    const h = Math.max(16, Math.round((256 * this.h) / Math.max(1, this.w)));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const k = this.nightK;
    ctx.fillStyle = '#' + new THREE.Color(TABLE).lerp(new THREE.Color(C.night), k).getHexString();
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w * 0.5, h * 0.45);
    ctx.scale(1.2 * w, 0.9 * h);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.6);
    const glow = new THREE.Color('#fffaf0').lerp(new THREE.Color('#2a3352'), k);
    const rgb = `${Math.round(glow.r * 255)},${Math.round(glow.g * 255)},${Math.round(glow.b * 255)}`;
    g.addColorStop(0, `rgba(${rgb},${0.22 + 0.4 * k})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const cache = new Map<number, [number, number, number]>();
    for (let i = 0; i < d.length; i += 4) {
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let out = cache.get(key);
      if (!out) {
        out = untoneSrgb(d[i], d[i + 1], d[i + 2], BACK_GAIN);
        cache.set(key, out);
      }
      d[i] = out[0];
      d[i + 1] = out[1];
      d[i + 2] = out[2];
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = this.backdrop.material as THREE.ShaderMaterial;
    (m.uniforms.map.value as THREE.Texture | null)?.dispose();
    m.uniforms.map.value = tex;
    const base = new THREE.Color(TABLE).lerp(new THREE.Color(C.night), k);
    const [r, gg, b] = untone(base.r, base.g, base.b);
    (this.scene.fog as THREE.Fog).color.setRGB(r, gg, b, THREE.LinearSRGBColorSpace);
  }

  /** How dark it is now (0 day .. 1 night). */
  get nightAmount() {
    return this.nightK;
  }

  /** Tall screens lay level parts out top-to-bottom. */
  get portrait() {
    const sw = this.w - this.insets.left - this.insets.right;
    const sh = this.h - this.insets.top - this.insets.bottom;
    return sh > sw * 1.15;
  }

  /** Does this point show in the free part of the view (not under the panels)? */
  inView(p: THREE.Vector3, margin = 30): boolean {
    const s = this.project(p);
    const r = this.rect;
    const { top, bottom, left, right } = this.insets;
    return s.x > r.left + left + margin && s.x < r.left + this.w - right - margin && s.y > r.top + top + margin && s.y < r.top + this.h - bottom - margin;
  }

  setInsets(insets: Insets) {
    this.insets = insets;
    this.resize();
  }

  resize() {
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio());
    const b = this.canvas.getBoundingClientRect();
    this.rect = { left: b.left, top: b.top, width: b.width || this.w, height: b.height || this.h };
    this.renderer.setSize(this.w, this.h, false);
    this.sizeComposer();
    this.drawBackground();
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
    // Far enough to see the far edge of a big map from high up; near grows with it to keep depth precise.
    this.camera.far = Math.max(300, this.distance * 2.5);
    this.camera.near = Math.max(0.5, this.distance * 0.02);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const f = this.scene.fog as THREE.Fog;
    f.near = this.distance * 1.15;
    f.far = this.distance * 3.4;
    // Shadows follow the view.
    const s = this.sun.shadow.camera;
    const r = this.distance * 0.75;
    this.sun.position.copy(this.target).add(new THREE.Vector3(-7, 12, 5));
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
    if (len > this.limit) target.multiplyScalar(this.limit / len);
    this.target.copy(target);
    this.goalTarget.copy(target);
    this.distance = this.goalDistance = THREE.MathUtils.clamp(distance, MIN_DIST, MAX_DIST);
    this.placeCamera();
  }

  /** When the child last moved the view themself (a pan, a pinch, the wheel, the zoom buttons). */
  ownLook = 0;

  /** Keep the table point `anchor` under screen point (x, y). */
  panTo(anchor: THREE.Vector3, x: number, y: number) {
    const p = this.screenToPlane(x, y);
    if (!p) return;
    this.ownLook = performance.now();
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
    this.ownLook = performance.now();
    this.goalDistance = THREE.MathUtils.clamp(this.goalDistance * factor, MIN_DIST, MAX_DIST);
  }

  /**
   * Smoothly fit a set of table points into the free area, no bigger than
   * `maxPpu` screen pixels per table unit (the farm allows a closer look).
   */
  frame(points: THREE.Vector3[], instant = false, maxPpu = MAX_PPU) {
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
    if (ppu > maxPpu) hi *= ppu / maxPpu;
    this.target.copy(saveT);
    this.distance = saveD;
    this.placeCamera();
    this.goalTarget.copy(center);
    this.goalDistance = THREE.MathUtils.clamp(hi, Math.max(MIN_DIST, (11 * MAX_PPU) / maxPpu), MAX_DIST);
    if (instant) this.setView(this.goalTarget.clone(), this.goalDistance);
  }

  /**
   * The camera operator: if something happens off screen (a ball hits a far
   * target, the fox comes), ease the view over so it can be seen.
   * Returns true if the view moves.
   */
  glance(point: THREE.Vector3, margin = 50): boolean {
    const { top, bottom, left, right } = this.insets;
    const p = this.project(point);
    if (p.x > left + margin && p.x < this.w - right - margin && p.y > top + margin && p.y < this.h - bottom - margin) return false;
    const r = this.rect;
    const c = this.screenToPlane(r.left + left + (this.w - left - right) / 2, r.top + top + (this.h - top - bottom) / 2);
    if (!c) return false;
    // Bring it most of the way in, not dead centre, so the view does not jump about.
    const goal = this.target.clone().addScaledVector(point.clone().setY(0).sub(c), 0.7);
    const len = Math.hypot(goal.x, goal.z);
    if (len > this.limit) goal.multiplyScalar(this.limit / len);
    this.goalTarget.copy(goal).setY(0);
    return true;
  }

  render() {
    this.checkSize();
    this.watchSpeed();
    // The sun's shadow map is a whole extra draw of the scene: redraw it every
    // other frame, or every frame while the view (and so the shadow camera) moves.
    const moved = !this.shadowView.equals(this.camera.matrixWorld);
    this.shadowView.copy(this.camera.matrixWorld);
    this.renderer.shadowMap.needsUpdate = moved || this.busy || ++this.shadowTick % 2 === 0;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /**
   * Compile shaders for these objects now (during the loading screen) so the
   * first time one appears on the table doesn't stall a frame.
   */
  warmUp(objects: THREE.Object3D[]) {
    const g = new THREE.Group();
    for (const o of objects) g.add(o);
    this.scene.add(g);
    this.renderer.compile(this.scene, this.camera);
    // A real draw also uploads textures and geometry.
    this.render();
    this.scene.remove(g);
    // The compiled shaders are what we came for: give back the throwaway parts' geometry
    // (an iPad has little video memory). Shared pieces simply upload again when next drawn.
    g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    // And the textures only one throwaway part had (its own label, its own canvas): a texture
    // two parts share comes from a cache and stays; materials stay too, they hold the shaders.
    const uses = new Map<THREE.Texture, number>();
    const textures = (o: THREE.Object3D) => {
      const m = (o as THREE.Mesh).material;
      return (Array.isArray(m) ? m : m ? [m] : []).flatMap((mat) => Object.values(mat).filter((v): v is THREE.Texture => v instanceof THREE.Texture));
    };
    g.traverse((o) => textures(o).forEach((t) => uses.set(t, (uses.get(t) ?? 0) + 1)));
    this.scene.traverse((o) => textures(o).forEach((t) => uses.delete(t)));
    for (const [t, n] of uses) if (n === 1) t.dispose();
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
    const r = this.rect;
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  /** World → CSS pixel coordinates relative to the viewport. */
  project(v: THREE.Vector3): { x: number; y: number } {
    const r = this.rect;
    const p = v.clone().project(this.camera);
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** How many CSS pixels one world unit spans at point v. */
  pixelsPerUnit(v: THREE.Vector3): number {
    const a = this.project(v);
    const b = this.project(v.clone().add(new THREE.Vector3(1, 0, 0)));
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Where the view is heading: to come back to after a look elsewhere. */
  viewGoal() {
    return { target: this.goalTarget.clone(), distance: this.goalDistance };
  }

  /** Ease the view to this centre and distance. */
  easeTo(target: THREE.Vector3, distance: number) {
    this.goalTarget.copy(target).setY(0);
    this.goalDistance = THREE.MathUtils.clamp(distance, MIN_DIST, MAX_DIST);
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
    ctx.fillStyle = major ? 'rgba(196,178,152,0.65)' : 'rgba(206,192,173,0.39)';
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

/**
 * Ambient occlusion: darkens creases, joints and the table right next to the
 * parts, at half resolution. Only solid things count: the screen backdrop,
 * sprites, glows, decals and other layers that do not write depth are hidden
 * while it draws its depth-and-normals picture.
 */
class SoftShadows extends GTAOPass {
  private hidden: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super(scene, camera, 256, 256);
    this.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.2, thickness: 1.5, scale: 2.4, samples: 16 });
    this.updatePdMaterial({ radius: 9, rings: 3, samples: 16, lumaPhi: 10, depthPhi: 2, normalPhi: 3 });
    this.blendIntensity = 0.8;
    // The pass's own (internal) hooks around its depth-and-normals render.
    const self = this as unknown as Record<'_overrideVisibility' | '_restoreVisibility', () => void>;
    const hide = self._overrideVisibility.bind(this);
    const show = self._restoreVisibility.bind(this);
    self._overrideVisibility = () => {
      hide();
      scene.traverse((o) => {
        if (!o.visible) return;
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if ((o as THREE.Sprite).isSprite || (m && !Array.isArray(m) && m.depthWrite === false) || o.userData.noAO) {
          o.visible = false;
          this.hidden.push(o);
        }
      });
    };
    self._restoreVisibility = () => {
      for (const o of this.hidden) o.visible = true;
      this.hidden.length = 0;
      show();
    };
  }

  private sinceFresh = 0;
  private lastView = new THREE.Matrix4();

  /**
   * The AO pass draws the whole scene again (depth and normals), as costly as
   * the picture itself. While the view stands still, recompute it only every
   * third frame and blend the last result in between: a spinning blade's
   * shading lagging by two frames cannot be seen.
   */
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, dt: number, mask: boolean) {
    const view = this.camera.matrixWorld;
    const moved = !this.lastView.equals(view);
    if (moved || ++this.sinceFresh >= 3) {
      this.sinceFresh = 0;
      this.lastView.copy(view);
      return super.render(renderer, writeBuffer, readBuffer, dt, mask);
    }
    const self = this as unknown as { _renderGBuffer: boolean; _renderPass: (...a: unknown[]) => void };
    const pass = self._renderPass;
    self._renderPass = (r: unknown, material: unknown, ...rest: unknown[]) => {
      if (material === this.gtaoMaterial || material === this.pdMaterial) return;
      pass.call(this, r, material, ...rest);
    };
    const gbuffer = self._renderGBuffer;
    self._renderGBuffer = false;
    super.render(renderer, writeBuffer, readBuffer, dt, mask);
    self._renderGBuffer = gbuffer;
    self._renderPass = pass;
  }

  /** AO is soft by nature: at most ~1000 pixels across is plenty (and cheap on a retina iPad). */
  setSize(width: number, height: number) {
    const k = Math.min(1, AO_DIV / Math.max(width, height));
    super.setSize(Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k)));
  }
}

let AO_DIV = 1200;

/** The backdrop texture holds colours divided by this, so it can be brighter than white. */
const BACK_GAIN = 2;

/** Day lighting: soft fill, a warm key, a rim from behind, studio reflections. */
const DAY = { hemi: 0.4, sun: 3.0, rim: 1.1, env: 0.75 };

/** Last touch after tone mapping: a soft vignette and a hint of warmth at the edges. */
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.12 }, uVibrance: { value: 0.65 }, uContrast: { value: 1.12 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignette, uVibrance, uContrast;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 p = vUv - 0.5;
      float v = smoothstep(0.35, 0.95, length(p * vec2(1.1, 1.0)));
      // Colourful toys get richer, the pale paper stays as it is.
      float hi = max(c.r, max(c.g, c.b));
      float sat = hi > 0.0 ? (hi - min(c.r, min(c.g, c.b))) / hi : 0.0;
      float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = lum + (c.rgb - lum) * (1.0 + uVibrance * sat);
      // Contrast for the toys' mid-tones and shadows; light paper and plates keep their colour.
      vec3 punchy = clamp((c.rgb - 0.45) * uContrast + 0.45, 0.0, 1.0);
      c.rgb = mix(punchy, c.rgb, smoothstep(0.62, 0.86, lum));
      c.rgb *= 1.0 - v * uVignette;
      c.rgb = mix(c.rgb, c.rgb * vec3(1.02, 0.99, 0.95), v);
      gl_FragColor = c;
    }`,
};

/**
 * OutputPass (tone mapping and sRGB) with the FinishShader's touch folded into
 * the same shader: one full-screen pass fewer, which counts at retina sizes.
 */
class FinishOutputPass extends OutputPass {
  constructor() {
    super();
    const m = this.material as THREE.RawShaderMaterial;
    m.uniforms.uVignette = { value: 0.12 };
    m.uniforms.uVibrance = { value: 0.65 };
    m.uniforms.uContrast = { value: 1.12 };
    const body = FinishShader.fragmentShader;
    const finish = body.slice(body.indexOf('vec2 p = vUv - 0.5;'), body.lastIndexOf('gl_FragColor = c;'));
    const src = m.fragmentShader;
    const end = src.lastIndexOf('}');
    m.fragmentShader =
      src.slice(0, end).replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\nuniform float uVignette, uVibrance, uContrast;') +
      `\n{ vec4 c = gl_FragColor;\n${finish}\ngl_FragColor = c; }\n}`;
  }
}

/** three.js's Neutral tone mapping (linear in, linear out). */
function neutral(r: number, g: number, b: number): [number, number, number] {
  const start = 0.8 - 0.04;
  const x = Math.min(r, g, b);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  r -= offset;
  g -= offset;
  b -= offset;
  const peak = Math.max(r, g, b);
  if (peak < start) return [r, g, b];
  const d = 1 - start;
  const np = 1 - (d * d) / (peak + d - start);
  const k = np / peak;
  const t = 1 - 1 / (0.15 * (peak - np) + 1);
  return [r * k * (1 - t) + np * t, g * k * (1 - t) + np * t, b * k * (1 - t) + np * t];
}

/** The linear colour that tone-maps to (r, g, b). */
function untone(r: number, g: number, b: number): [number, number, number] {
  let x: [number, number, number] = [r, g, b];
  for (let i = 0; i < 40; i++) {
    const y = neutral(...x);
    x = [x[0] + (r - y[0]), x[1] + (g - y[1]), x[2] + (b - y[2])];
  }
  return x;
}

/** Pre-compensated colour for a texture the shader multiplies by `gain` (values may exceed 1). */
function untoneSrgb(r: number, g: number, b: number, gain: number): [number, number, number] {
  const c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  const [lr, lg, lb] = untone(c.r, c.g, c.b);
  c.setRGB(lr / gain, lg / gain, lb / gain, THREE.LinearSRGBColorSpace);
  const out = { r: 0, g: 0, b: 0 };
  c.getRGB(out, THREE.SRGBColorSpace);
  return [Math.round(Math.min(1, out.r) * 255), Math.round(Math.min(1, out.g) * 255), Math.round(Math.min(1, out.b) * 255)];
}
