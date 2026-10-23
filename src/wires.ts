// Flexible wires between terminals, with beads of "current" running along
// them in the direction conventional current flows.
import * as THREE from 'three';
import type { Footprint, Terminal } from './parts/base';
import { C, WIRE_COLORS } from './theme';

const RADIUS = 0.05;
const UP = new THREE.Vector3(0, 1, 0);
const dotGeo = new THREE.SphereGeometry(0.052, 10, 8);
const clipGeo = new THREE.CylinderGeometry(0.075, 0.06, 0.16, 16);
const tipGeo = new THREE.CapsuleGeometry(0.085, 0.16, 6, 16);
let colorCursor = 0;
const WHITE = new THREE.Color('#ffffff');

let nextWireId = 1;

export class Wire {
  /** View-bar toggle: show the beads of current running along wires. */
  static showFlow = true;
  /** While a hint singles out a wire, the others fade back. */
  static focus: Wire | null = null;
  /** Bodies on the table (world rectangles, margin included) that wires go round. */
  static obstacles: Footprint[] = [];
  /** Changes whenever an obstacle moves, so wires re-route. */
  static obstacleKey = '';
  readonly id = `w${nextWireId++}`;
  readonly group = new THREE.Group();
  readonly tube: THREE.Mesh;
  /** End while it is being dragged; null once attached. */
  freeEnd: THREE.Vector3 | null = null;
  b: Terminal | null = null;
  /** Signed current a → b, amperes. */
  current = 0;
  dying = false;
  /** Pulse red: this is the wire a hint asks to take off. */
  alert = false;
  private alertT = 0;
  private baseColor = new THREE.Color();
  /** Called once the removal animation is over. */
  onGone?: () => void;

  private material: THREE.MeshStandardMaterial;
  private clipA: THREE.Mesh;
  private clipB: THREE.Mesh;
  /** Plug head that follows the finger while the wire is being dragged. */
  private tip: THREE.Mesh;
  private dots: THREE.InstancedMesh;
  private curve: THREE.CatmullRomCurve3 | null = null;
  private length = 1;
  private phase = 0;
  private lateral = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6);
  private lastKey = '';
  private grow = 0;
  private fade = 1;
  private readonly p0 = new THREE.Vector3();
  private readonly p3 = new THREE.Vector3();

  constructor(readonly a: Terminal) {
    this.material = new THREE.MeshStandardMaterial({ color: C.teal, roughness: 0.38, transparent: true });
    this.tube = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.tube.castShadow = true;
    this.tube.userData.wire = this;
    const clipMat = new THREE.MeshStandardMaterial({ color: '#7d8590', metalness: 0.7, roughness: 0.3 });
    this.clipA = new THREE.Mesh(clipGeo, clipMat);
    this.clipB = new THREE.Mesh(clipGeo, clipMat);
    this.dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: '#fff6d6' }), 48);
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.tip = new THREE.Mesh(tipGeo, this.material);
    this.tip.castShadow = true;
    this.group.add(this.tube, this.clipA, this.clipB, this.tip, this.dots);
    this.setColorFor(a, null);
  }

  /** Red for wires on "+", dark for "−", otherwise cycle a cheerful set. */
  setColorFor(a: Terminal, b: Terminal | null) {
    const pol = [a.polarity, b?.polarity];
    const isBat = (t: Terminal | null) => t?.part.kind === 'battery';
    let color: string;
    if ((isBat(a) && a.polarity === 'plus') || (isBat(b) && b!.polarity === 'plus')) color = C.red;
    else if ((isBat(a) && a.polarity === 'minus') || (isBat(b) && b!.polarity === 'minus')) color = C.navy2;
    else if (pol.includes('plus')) color = C.red;
    else if (pol.includes('minus')) color = C.navy2;
    else color = WIRE_COLORS[colorCursor++ % WIRE_COLORS.length];
    this.material.color.set(color);
    this.material.emissive.set(color);
    this.baseColor.set(color);
  }

  attach(b: Terminal) {
    this.b = b;
    this.freeEnd = null;
    this.setColorFor(this.a, b);
    this.lastKey = '';
  }

  other(t: Terminal): Terminal | null {
    return t === this.a ? this.b : this.a;
  }

  touches(t: Terminal) {
    return this.a === t || this.b === t;
  }

  remove(onGone?: () => void) {
    this.dying = true;
    this.onGone = onGone;
  }

  /** Point halfway along the wire, for pointing at it. */
  midpoint(out = new THREE.Vector3()): THREE.Vector3 {
    return this.pointAt(0.5, out);
  }

  /** Point at fraction u (0..1) of the wire's length. */
  pointAt(u: number, out = new THREE.Vector3()): THREE.Vector3 {
    if (this.curve) return this.curve.getPointAt(u, out);
    return out.copy(this.p0).lerp(this.p3, u);
  }

  /** Evenly spaced points along the wire, for screen-space hit tests. */
  samples(n = 24): THREE.Vector3[] {
    return Array.from({ length: n + 1 }, (_, i) => this.pointAt(i / n));
  }

  private endpoints() {
    this.a.attachPoint(this.p0);
    if (this.b) this.b.attachPoint(this.p3);
    else if (this.freeEnd) this.p3.copy(this.freeEnd);
  }

  private rebuild() {
    const p0 = this.p0;
    const p3 = this.p3;
    const flat = new THREE.Vector3(p3.x - p0.x, 0, p3.z - p0.z);
    const d = flat.length();
    const dir = d > 1e-4 ? flat.clone().divideScalar(d) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(dir, UP);
    const pts: THREE.Vector3[] = [p0.clone()];
    const lift = (p: THREE.Vector3, to: THREE.Vector3, along: number, y: number) => {
      const v = new THREE.Vector3(to.x - p.x, 0, to.z - p.z);
      const n = v.length();
      return p.clone().addScaledVector(n > 1e-4 ? v.divideScalar(n) : dir, Math.min(along, n * 0.4)).setY(y);
    };
    const corners = d < 1.8 ? [] : route(p0, p3, Wire.obstacles);

    if (d < 1.8) {
      pts.push(p0.clone().addScaledVector(UP, 0.25).addScaledVector(dir, d * 0.15));
      pts.push(p0.clone().lerp(p3, 0.5).setY(Math.max(p0.y, p3.y) + 0.3 + d * 0.1));
      pts.push(p3.clone().addScaledVector(UP, 0.25).addScaledVector(dir, -d * 0.15));
    } else if (corners.length) {
      // Round the bodies in the way: off the post, along the table past each corner, up again.
      const first = new THREE.Vector3(corners[0].x, 0, corners[0].z);
      const last = new THREE.Vector3(corners[corners.length - 1].x, 0, corners[corners.length - 1].z);
      pts.push(lift(p0, first, 0.3, p0.y + 0.12));
      for (const c of corners) pts.push(new THREE.Vector3(c.x, 0.1, c.z));
      pts.push(lift(p3, last, 0.3, p3.y + 0.12));
    } else {
      // Rise off the post, drop to the table, lie there in a lazy curve, rise again.
      const bend = Math.min(0.7, d * 0.12) * this.lateral;
      pts.push(lift(p0, p3, 0.3, p0.y + 0.12));
      pts.push(lift(p0, p3, 0.85, 0.32));
      const m = p0.clone().lerp(p3, 0.5).addScaledVector(side, bend).setY(d > 3 ? 0.08 : 0.2);
      pts.push(m);
      pts.push(lift(p3, p0, 0.85, 0.32));
      pts.push(lift(p3, p0, 0.3, p3.y + 0.12));
    }
    pts.push(p3.clone());

    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.length = this.curve.getLength();
    const segs = Math.max(24, Math.min(110, Math.round(this.length * 14)));
    const r = RADIUS * Math.min(1, this.grow) * (this.dying ? this.fade : 1) * (this.alert ? 1.7 : 1);
    const geo = new THREE.TubeGeometry(this.curve, segs, Math.max(0.005, r), 8, false);
    this.tube.geometry.dispose();
    this.tube.geometry = geo;

    // Crimped ferrules sitting on the post tops.
    this.clipA.position.copy(p0).setY(p0.y + 0.03);
    this.clipB.position.copy(p3).setY(p3.y + 0.03);
    // Free end: an insulated plug with a metal pin pointing down.
    const free = !this.b;
    this.tip.visible = free;
    this.tip.position.copy(p3).setY(p3.y + 0.2);
    this.clipB.position.y = free ? p3.y + 0.02 : p3.y + 0.03;
  }

  update(dt: number) {
    this.endpoints();
    if (this.grow < 1) this.grow = Math.min(1, this.grow + dt * 7);
    if (this.dying) {
      this.fade = Math.max(0, this.fade - dt * 5);
      this.material.opacity = this.fade;
      if (this.fade === 0) {
        this.group.removeFromParent();
        this.tube.geometry.dispose();
        this.onGone?.();
        return;
      }
    }
    const key = `${this.p0.x.toFixed(3)},${this.p0.y.toFixed(3)},${this.p0.z.toFixed(3)}|${this.p3.x.toFixed(3)},${this.p3.y.toFixed(3)},${this.p3.z.toFixed(3)}|${this.grow}|${this.fade}|${this.alert}|${Wire.obstacleKey}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.rebuild();
    }

    const I = this.dying ? 0 : this.current;
    const mag = Math.abs(I);
    if (!this.dying) {
      const faded = Wire.focus && Wire.focus !== this && !this.alert;
      this.material.opacity = THREE.MathUtils.damp(this.material.opacity, faded ? 0.3 : 1, 8, dt);
    }
    if (this.alert) {
      // Blink between red and white so it stands out even among red wires.
      this.alertT += dt;
      const pulse = 0.5 + 0.5 * Math.sin(this.alertT * 7);
      this.material.color.set(C.red).lerp(WHITE, pulse * 0.85);
      this.material.emissive.set(C.red);
      this.material.emissiveIntensity = 0.25 + (1 - pulse) * 0.5;
    } else {
      if (this.alertT) {
        this.alertT = 0;
        this.material.emissive.copy(this.baseColor);
        this.material.color.copy(this.baseColor);
      }
      this.material.emissiveIntensity = THREE.MathUtils.damp(this.material.emissiveIntensity, mag > 0.01 ? 0.28 : 0, 6, dt);
    }
    if (!this.curve || mag < 0.01 || !Wire.showFlow) {
      this.dots.count = 0;
      return;
    }
    const speed = Math.min(3.2, 0.7 + mag * 5); // world units per second
    this.phase = (this.phase + (Math.sign(I) * speed * dt) / this.length + 1) % 1;
    const n = Math.max(3, Math.min(48, Math.round(this.length * 2.2)));
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const u = (this.phase + i / n) % 1;
      this.curve.getPointAt(u, p);
      // Beads swell slightly in the middle of their run, so the flow reads as motion.
      const s = 0.85 + 0.35 * Math.sin(u * Math.PI);
      m.makeScale(s, s, s).setPosition(p);
      this.dots.setMatrixAt(i, m);
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
  }
}

type P2 = { x: number; z: number };

/**
 * A path on the table from a to b that goes round every rectangle in the
 * way, as the corners to pass (a and b not included). Each crossing is
 * replaced by the shorter way round that rectangle (the hull of the two
 * ends and its corners); a few rounds settle chains of obstacles.
 */
function route(a: THREE.Vector3, b: THREE.Vector3, rects: Footprint[]): P2[] {
  const path: P2[] = [
    { x: a.x, z: a.z },
    { x: b.x, z: b.z },
  ];
  // Bodies the ends sit in (or right against) are left alone.
  const free = rects.filter((r) => !inside(path[0], r) && !inside(path[1], r));
  for (let round = 0; round < 8; round++) {
    let changed = false;
    for (let i = 0; i < path.length - 1 && !changed; i++) {
      const p = path[i];
      const q = path[i + 1];
      const hit = free
        .map((r) => ({ r, t: crossing(p, q, r) }))
        .filter((h) => h.t !== null)
        .sort((u, v) => u.t! - v.t!)[0];
      if (!hit) continue;
      path.splice(i + 1, 0, ...detour(p, q, hit.r));
      changed = true;
    }
    if (!changed) break;
  }
  return path.slice(1, -1);
}

function inside(p: P2, r: Footprint) {
  return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
}

/** Where (0..1) segment p→q first enters rectangle r, or null if it misses. */
function crossing(p: P2, q: P2, r: Footprint): number | null {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dz = q.z - p.z;
  for (const [delta, lo, hi, start] of [
    [dx, r.x0, r.x1, p.x],
    [dz, r.z0, r.z1, p.z],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (start <= lo || start >= hi) return null;
      continue;
    }
    let a = (lo - start) / delta;
    let b = (hi - start) / delta;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 >= t1) return null;
  }
  return t1 - t0 > 1e-4 ? t0 : null;
}

/** The corners of r to pass going round it from p to q, the shorter way. */
function detour(p: P2, q: P2, r: Footprint): P2[] {
  const c: P2[] = [
    { x: r.x0, z: r.z0 },
    { x: r.x1, z: r.z0 },
    { x: r.x1, z: r.z1 },
    { x: r.x0, z: r.z1 },
  ];
  // Convex hull (monotone chain) of p, q and the four corners.
  const all = [p, q, ...c].sort((u, v) => u.x - v.x || u.z - v.z);
  const cross = (o: P2, u: P2, v: P2) => (u.x - o.x) * (v.z - o.z) - (u.z - o.z) * (v.x - o.x);
  const half = (pts: P2[]) => {
    const h: P2[] = [];
    for (const pt of pts) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], pt) <= 0) h.pop();
      h.push(pt);
    }
    h.pop();
    return h;
  };
  const hull = [...half(all), ...half([...all].reverse())];
  const ip = hull.indexOf(p);
  const iq = hull.indexOf(q);
  if (ip < 0 || iq < 0) return [];
  const walk = (step: number) => {
    const out: P2[] = [];
    for (let i = (ip + step + hull.length) % hull.length; i !== iq; i = (i + step + hull.length) % hull.length) out.push(hull[i]);
    return out;
  };
  const len = (chain: P2[]) => {
    let s = 0;
    let prev = p;
    for (const pt of [...chain, q]) {
      s += Math.hypot(pt.x - prev.x, pt.z - prev.z);
      prev = pt;
    }
    return s;
  };
  const one = walk(1);
  const two = walk(-1);
  return len(one) <= len(two) ? one : two;
}
