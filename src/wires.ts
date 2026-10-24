// Flexible wires between terminals. Current shows as pulses of light running
// inside the cable in the direction conventional current flows; when a circuit
// closes, the light fills the wires from the battery's "+" round the loop.
import * as THREE from 'three';
import type { Footprint, Terminal } from './parts/base';
import { C, WIRE_COLORS } from './theme';

const RADIUS = 0.05;
const UP = new THREE.Vector3(0, 1, 0);
/** Spacing of the light pulses along a wire, world units. */
const PULSE = 0.55;
/** How fast the light front fills a wire when the circuit closes, units per second. */
const FILL_SPEED = 9;
const FLOW_COLOR = new THREE.Color('#ffe2a0');
const clipGeo = new THREE.CylinderGeometry(0.075, 0.06, 0.16, 16);
const tipGeo = new THREE.CapsuleGeometry(0.085, 0.16, 6, 16);
// A cable clip: a little arch over the wire with two feet pressed into the table.
const clipArchGeo = new THREE.TorusGeometry(0.1, 0.034, 8, 16, Math.PI);
const clipFootGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.035, 12);
const clipMat = new THREE.MeshStandardMaterial({ color: '#24304a', roughness: 0.35 });
const clipFootMat = new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.3, metalness: 0.6 });
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
  /** Tidy mode: wires lay themselves out in straight runs with right-angle bends. */
  static neat = false;
  /** Table cells each tidy wire runs along, so the next one picks a free lane. */
  static lanes = new Map<string, Set<number>>();
  /** Brightness of the current's light: higher by day so it reads against the paper. */
  static glow = 1.4;
  /**
   * 0 at the battery's "+" (highest voltage), 1 at "−": how far down the loop
   * a wire sits, so the light front reaches it in order. Set after each solve.
   */
  potential = 0;
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
  /**
   * Where the child laid the cable with their finger (table points, world
   * units). Empty: the wire finds its own way round the parts.
   */
  route: THREE.Vector3[] = [];
  private clips: { g: THREE.Group; t: number }[] = [];
  /** Where clips sit: the laid points, or the bends of a tidy wire. */
  private clipAt: P2[] = [];

  private material: THREE.MeshStandardMaterial;
  private clipA: THREE.Mesh;
  private clipB: THREE.Mesh;
  /** Plug head that follows the finger while the wire is being dragged. */
  private tip: THREE.Mesh;
  private flow = {
    uLen: { value: 1 },
    uPhase: { value: 0 },
    uAmp: { value: 0 },
    uDir: { value: 1 },
    uFront: { value: 1e3 },
    uHeat: { value: 0 },
    uFlowColor: { value: FLOW_COLOR },
  };
  /** Seconds since the current started (negative while waiting for the front). */
  private fillT = 0;
  private flowing = false;
  private curve: THREE.CatmullRomCurve3 | null = null;
  private length = 1;
  private lateral = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6);
  private lastKey = '';
  private grow = 0;
  private fade = 1;
  private readonly p0 = new THREE.Vector3();
  private readonly p3 = new THREE.Vector3();

  constructor(readonly a: Terminal) {
    this.material = new THREE.MeshStandardMaterial({ color: C.teal, roughness: 0.32, transparent: true });
    this.material.onBeforeCompile = (shader) => this.injectFlow(shader);
    this.material.customProgramCacheKey = () => 'wire-flow';
    this.tube = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.tube.castShadow = true;
    this.tube.userData.wire = this;
    const clipMat = new THREE.MeshStandardMaterial({ color: '#7d8590', metalness: 0.7, roughness: 0.3 });
    this.clipA = new THREE.Mesh(clipGeo, clipMat);
    this.clipB = new THREE.Mesh(clipGeo, clipMat);
    this.tip = new THREE.Mesh(tipGeo, this.material);
    this.tip.castShadow = true;
    this.group.add(this.tube, this.clipA, this.clipB, this.tip);
    this.setColorFor(a, null);
  }

  /**
   * Light inside the cable: a faint glowing core plus bright comets moving
   * with the current, brighter than white so the bloom makes them shine.
   */
  private injectFlow(shader: THREE.WebGLProgramParametersWithUniforms) {
    Object.assign(shader.uniforms, this.flow);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float wireU;\nvarying float vWireU;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWireU = wireU;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vWireU;
        uniform float uLen, uPhase, uAmp, uDir, uFront, uHeat;
        uniform vec3 uFlowColor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float s = vWireU * uLen;
          float along = uDir > 0.0 ? s : uLen - s;
          float lit = smoothstep(uFront + 0.05, uFront - 0.15, along);
          float f = fract((along - uPhase) / ${PULSE.toFixed(2)});
          float comet = smoothstep(0.62, 0.97, f) * (1.0 - smoothstep(0.97, 1.0, f)) + 0.25 * pow(f, 2.0);
          float core = pow(max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 1.4);
          vec3 glow = uFlowColor * uAmp * lit * (0.15 + 3.4 * comet) * (0.3 + 0.7 * core);
          float edge = exp(-abs(along - uFront) * 7.0) * step(uFront, uLen + 0.3);
          glow += uFlowColor * uAmp * edge * 6.0 * core;
          // Far too much current: the wire heats up red-orange and shimmers.
          glow += vec3(1.0, 0.28, 0.06) * uHeat * (2.2 + 1.2 * sin(along * 9.0 + uPhase * 4.0));
          totalEmissiveRadiance += glow;
        }`,
      );
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
    Wire.lanes.delete(this.id);
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
    const tidy = Wire.neat && this.b ? neatRoute(p0, p3, Wire.obstacles, this.id) : null;
    const corners = tidy ? [] : this.route.length ? laid(p0, p3, this.route, Wire.obstacles) : d < 1.8 ? [] : route(p0, p3, Wire.obstacles);
    this.clipAt = tidy ? tidy.slice(1, -1) : this.route.map((r) => ({ x: r.x, z: r.z }));

    if (tidy) {
      // Straight runs on the table with tight rounded corners; each post is left
      // towards the front, the way the posts face.
      pts.push(new THREE.Vector3(p0.x, p0.y - 0.08, p0.z + 0.12));
      pts.push(new THREE.Vector3(tidy[0].x, 0.07, tidy[0].z));
      for (let i = 1; i < tidy.length - 1; i++) {
        const c = tidy[i];
        const prev = tidy[i - 1];
        const next = tidy[i + 1];
        const r = Math.min(0.16, Math.hypot(c.x - prev.x, c.z - prev.z) / 2.2, Math.hypot(next.x - c.x, next.z - c.z) / 2.2);
        const towards = (a: P2, b: P2, t: number) => {
          const n = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          return new THREE.Vector3(a.x + ((b.x - a.x) / n) * t, 0.07, a.z + ((b.z - a.z) / n) * t);
        };
        pts.push(towards(c, prev, r), towards(c, next, r));
      }
      const end = tidy[tidy.length - 1];
      pts.push(new THREE.Vector3(end.x, 0.07, end.z));
      pts.push(new THREE.Vector3(p3.x, p3.y - 0.08, p3.z + 0.12));
    } else if (d < 1.8 && !corners.length) {
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

    // Runs along the table get evenly spaced points, so the smooth curve cannot
    // sag below the table after a steep drop off a post (it would vanish there).
    const dense: THREE.Vector3[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a.y < 0.15 && b.y < 0.15) {
        const n = Math.floor(a.distanceTo(b) / 0.5);
        for (let k = 1; k < n; k++) dense.push(a.clone().lerp(b, k / n));
      }
      dense.push(b);
    }
    pts.length = 0;
    pts.push(...dense);

    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    // And if a bend still dips, lift those points back onto the table.
    for (let i = 0; i < 3; i++) {
      let low = false;
      for (let k = 0; k <= 80; k++) if (this.curve.getPoint(k / 80).y < 0.045) low = true;
      if (!low) break;
      for (const p of pts) if (p.y < 0.15) p.y += 0.04;
      this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    }
    this.length = this.curve.getLength();
    const segs = Math.max(24, Math.min(110, Math.round(this.length * 14)));
    const r = RADIUS * Math.min(1, this.grow) * (this.dying ? this.fade : 1) * (this.alert ? 1.7 : 1);
    const geo = new THREE.TubeGeometry(this.curve, segs, Math.max(0.005, r), 8, false);
    // Distance along the wire (0..1) for the flow shader.
    const uv = geo.attributes.uv;
    const along = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) along[i] = uv.getX(i);
    geo.setAttribute('wireU', new THREE.BufferAttribute(along, 1));
    this.flow.uLen.value = this.length;
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
    this.placeClips();
  }

  /** Fix the laid cable to the table: one clip per laid point, across the wire. */
  private placeClips() {
    const want = this.b ? this.clipAt.length : 0;
    while (this.clips.length > want) this.clips.pop()!.g.removeFromParent();
    while (this.clips.length < want) {
      const g = new THREE.Group();
      const arch = new THREE.Mesh(clipArchGeo, clipMat);
      arch.castShadow = true;
      const f1 = new THREE.Mesh(clipFootGeo, clipFootMat);
      const f2 = new THREE.Mesh(clipFootGeo, clipFootMat);
      f1.position.x = -0.1;
      f2.position.x = 0.1;
      g.add(arch, f1, f2);
      g.scale.setScalar(0.001);
      // Clips snap on one after another, from the start of the cable.
      this.clips.push({ g, t: -this.clips.length * 0.08 });
      this.group.add(g);
    }
    if (!this.curve) return;
    const pt = new THREE.Vector3();
    const tan = new THREE.Vector3();
    this.clips.forEach((c, i) => {
      const r = this.clipAt[i];
      // Nearest spot on the cable to the laid point.
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k <= 60; k++) {
        this.curve!.getPointAt(k / 60, pt);
        const dd = (pt.x - r.x) ** 2 + (pt.z - r.z) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = k / 60;
        }
      }
      this.curve!.getPointAt(best, pt);
      this.curve!.getTangentAt(best, tan);
      c.g.position.set(pt.x, Math.max(0.0, pt.y - 0.04), pt.z);
      c.g.rotation.set(0, Math.atan2(-tan.x, -tan.z) + Math.PI / 2, 0);
    });
  }

  /** The obstacles near this wire, as a string: it re-routes only when one of them moves. */
  private nearbyObstacles(): string {
    const M = 3;
    const x0 = Math.min(this.p0.x, this.p3.x) - M;
    const x1 = Math.max(this.p0.x, this.p3.x) + M;
    const z0 = Math.min(this.p0.z, this.p3.z) - M;
    const z1 = Math.max(this.p0.z, this.p3.z) + M;
    let k = '';
    for (const r of Wire.obstacles) if (r.x1 > x0 && r.x0 < x1 && r.z1 > z0 && r.z0 < z1) k += `${r.x0.toFixed(2)},${r.z0.toFixed(2)};`;
    return k;
  }

  /** How many clips are on (for the clicking sound as they snap). */
  get clipCount() {
    return this.clipAt.length;
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
    const key = `${this.p0.x.toFixed(3)},${this.p0.y.toFixed(3)},${this.p0.z.toFixed(3)}|${this.p3.x.toFixed(3)},${this.p3.y.toFixed(3)},${this.p3.z.toFixed(3)}|${this.grow}|${this.fade}|${this.alert}|${this.nearbyObstacles()}|${this.route.length}|${Wire.neat}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.rebuild();
    }

    for (const c of this.clips) {
      if (c.t >= 1) continue;
      c.t = Math.min(1, c.t + dt * 4);
      const k = Math.max(0, c.t);
      // Overshoot a little, like a clip clicking into place.
      c.g.scale.setScalar(Math.max(0.001, k < 0.7 ? (k / 0.7) * 1.25 : 1.25 - ((k - 0.7) / 0.3) * 0.25));
    }
    if (this.dying) for (const c of this.clips) c.g.scale.setScalar(Math.max(0.001, this.fade));

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
    // The light: waits for its turn (wires nearer "+" light first), then fills the wire.
    const on = !!this.curve && mag > 0.01 && Wire.showFlow;
    if (on && !this.flowing) this.fillT = -this.potential * 0.45;
    this.flowing = on;
    if (on) this.fillT += dt;
    const f = this.flow;
    f.uFront.value = on ? Math.max(0, this.fillT) * FILL_SPEED : f.uFront.value;
    f.uAmp.value = THREE.MathUtils.damp(f.uAmp.value, on ? Math.min(1, 0.35 + mag * 3) * Wire.glow : 0, on ? 10 : 4, dt);
    f.uHeat.value = THREE.MathUtils.damp(f.uHeat.value, Math.min(1, Math.max(0, (mag - 1.2) / 1.5)), 3, dt);
    if (on) {
      f.uDir.value = Math.sign(I);
      const speed = Math.min(3.2, 0.8 + mag * 5);
      f.uPhase.value = (f.uPhase.value + speed * dt) % (PULSE * 1000);
    }
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

/**
 * The child's laid route between the posts, as table points: the laid points
 * themselves, with detours added wherever a stretch would cut through a part.
 */
function laid(a: THREE.Vector3, b: THREE.Vector3, pts: THREE.Vector3[], rects: Footprint[]): P2[] {
  const way: P2[] = [{ x: a.x, z: a.z }, ...pts.map((p) => ({ x: p.x, z: p.z })), { x: b.x, z: b.z }];
  const out: P2[] = [];
  for (let i = 0; i < way.length - 1; i++) {
    const from = new THREE.Vector3(way[i].x, 0, way[i].z);
    const to = new THREE.Vector3(way[i + 1].x, 0, way[i + 1].z);
    // Bodies a post sits next to are not "in the way" of the short hop off it.
    out.push(...route(from, to, rects));
    if (i + 1 < way.length - 1) out.push(way[i + 1]);
  }
  return out;
}

/**
 * Tidy a finger's trail into a cable route: drop jitter (Ramer–Douglas–Peucker),
 * keep clear of the posts, and add clips along long straight runs.
 */
export function tidyRoute(a: THREE.Vector3, b: THREE.Vector3, trail: THREE.Vector3[]): THREE.Vector3[] {
  const all = [a.clone().setY(0), ...trail, b.clone().setY(0)];
  const keep = new Array(all.length).fill(false);
  keep[0] = keep[all.length - 1] = true;
  const rdp = (i: number, j: number) => {
    let far = -1;
    let farD = 0.28;
    const ax = all[i].x, az = all[i].z, bx = all[j].x, bz = all[j].z;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((bx - ax) * (az - all[k].z) - (ax - all[k].x) * (bz - az)) / len;
      if (d > farD) {
        far = k;
        farD = d;
      }
    }
    if (far < 0) return;
    keep[far] = true;
    rdp(i, far);
    rdp(far, j);
  };
  rdp(0, all.length - 1);
  const bends = all.filter((_, i) => keep[i]);
  // A straight pull means "just connect": let the wire find its own way.
  if (bends.length <= 2) return [];
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < bends.length - 1; i++) {
    const p = bends[i];
    const q = bends[i + 1];
    if (i > 0) out.push(p.clone());
    const n = Math.floor(p.distanceTo(q) / 2.2);
    for (let k = 1; k <= n; k++) out.push(p.clone().lerp(q, k / (n + 1)));
  }
  return out.filter((p) => p.distanceTo(a.clone().setY(0)) > 0.6 && p.distanceTo(b.clone().setY(0)) > 0.6);
}

/**
 * A tidy route between two posts: straight runs along a grid with as few
 * bends as possible, around every body, keeping off lanes other tidy wires
 * already use. Both ends first step forward off their posts. Returns the
 * points to pass (the two exits and every bend), or null if boxed in.
 */
function neatRoute(a: THREE.Vector3, b: THREE.Vector3, rects: Footprint[], id: string): P2[] | null {
  const S = 0.3;
  const ax = a.x;
  const az = a.z + 0.4;
  const bx = b.x;
  const bz = b.z + 0.4;
  const minX = Math.min(ax, bx) - 3;
  const minZ = Math.min(az, bz) - 3;
  const W = Math.ceil((Math.max(ax, bx) + 3 - minX) / S) + 1;
  const H = Math.ceil((Math.max(az, bz) + 3 - minZ) / S) + 1;
  if (W * H > 30000) return null;
  const at = (x: number, z: number) => Math.round((x - minX) / S) + Math.round((z - minZ) / S) * W;
  const gx = (i: number) => minX + (i % W) * S;
  const gz = (i: number) => minZ + Math.floor(i / W) * S;
  // Lanes are keyed on a shared table grid, so wires agree on what is taken.
  const lane = (i: number) => Math.round(gx(i) / S) * 100003 + Math.round(gz(i) / S);

  const blocked = new Uint8Array(W * H);
  const exitA = { x: ax, z: az };
  const exitB = { x: bx, z: bz };
  for (const r of rects) {
    if (inside(exitA, r) || inside(exitB, r)) continue;
    const i0 = Math.max(0, Math.ceil((r.x0 - minX) / S));
    const i1 = Math.min(W - 1, Math.floor((r.x1 - minX) / S));
    const j0 = Math.max(0, Math.ceil((r.z0 - minZ) / S));
    const j1 = Math.min(H - 1, Math.floor((r.z1 - minZ) / S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[i + j * W] = 1;
  }
  const taken = new Set<number>();
  for (const [other, cells] of Wire.lanes) if (other !== id) for (const c of cells) taken.add(c);

  const start = at(ax, az);
  const goal = at(bx, bz);
  blocked[start] = blocked[goal] = 0;
  const DX = [1, 0, -1, 0];
  const DZ = [0, 1, 0, -1];
  const g = new Float32Array(W * H * 4).fill(Infinity);
  const from = new Int32Array(W * H * 4).fill(-1);
  const heap: [number, number][] = [];
  const push = (f: number, n: number) => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const hx = goal % W;
  const hz = Math.floor(goal / W);
  const h = (i: number) => Math.abs((i % W) - hx) + Math.abs(Math.floor(i / W) - hz);
  for (let d = 0; d < 4; d++) {
    g[start * 4 + d] = 0;
    push(h(start), start * 4 + d);
  }
  let end = -1;
  while (heap.length) {
    const [, node] = pop();
    const cell = node >> 2;
    const dir = node & 3;
    if (cell === goal) {
      end = node;
      break;
    }
    const cx = cell % W;
    const cz = Math.floor(cell / W);
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((dir + 2) & 3)) continue;
      const nx = cx + DX[nd];
      const nz = cz + DZ[nd];
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const next = nx + nz * W;
      if (blocked[next]) continue;
      const cost = g[node] + 1 + (nd !== dir ? 3 : 0) + (taken.has(lane(next)) ? 2.5 : 0);
      const nn = next * 4 + nd;
      if (cost < g[nn]) {
        g[nn] = cost;
        from[nn] = node;
        push(cost + h(next), nn);
      }
    }
  }
  if (end < 0) return null;
  const cells: number[] = [];
  const dirs: number[] = [];
  for (let n = end; n >= 0; n = from[n]) {
    cells.push(n >> 2);
    dirs.push(n & 3);
  }
  cells.reverse();
  dirs.reverse();
  Wire.lanes.set(id, new Set(cells.map(lane)));
  const out: P2[] = [exitA];
  for (let i = 1; i < cells.length - 1; i++) if (dirs[i + 1] !== dirs[i]) out.push({ x: gx(cells[i]), z: gz(cells[i]) });
  out.push(exitB);
  // The grid start/end cells are rounded; pull the first and last bends onto the exits' lines.
  if (out.length > 2) {
    const s1 = out[1];
    if (Math.abs(s1.x - ax) < S) s1.x = ax;
    else s1.z = az;
    const e1 = out[out.length - 2];
    if (Math.abs(e1.x - bx) < S) e1.x = bx;
    else e1.z = bz;
  }
  return out;
}
