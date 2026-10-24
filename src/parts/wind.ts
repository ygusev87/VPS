// Wind: fans that blow (a floor fan that turns its head, a glowing computer
// fan) and a pinwheel with no wires at all — it spins in a fan's breeze.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { model, tip } from './assets';
import { Part, type PartKind } from './base';
import { basePlate, blurAmount, damp, mat, mesh, PLATE_TOP, rotorBlur, roundedBox } from './kit';

/** Something that makes a breeze: where from, which way (world, flat), how hard (0..~1.5). */
export interface Breeze {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  strength: number;
}
export interface Blower {
  breeze(): Breeze | null;
}
/** Something the breeze moves. */
export interface WindCatcher {
  wind: number;
  /** Sum of incoming directions, weighted by strength. */
  windDir: THREE.Vector3;
  windPoint(): THREE.Vector3;
}

const isBlower = (p: Part): p is Part & Blower => typeof (p as Partial<Blower>).breeze === 'function';
const isCatcher = (p: Part): p is Part & WindCatcher => (p as Partial<WindCatcher>).windDir instanceof THREE.Vector3;

/** How far a fan's breeze carries, in table units. */
export const WIND_RANGE = 7;

/** Spread every fan's breeze over the parts in front of it. Call each frame. */
export function blowWind(parts: Part[]) {
  const catchers = parts.filter(isCatcher);
  if (!catchers.length) return;
  for (const c of catchers) {
    c.wind = 0;
    c.windDir.set(0, 0, 0);
  }
  const v = new THREE.Vector3();
  for (const p of parts) {
    if (!isBlower(p)) continue;
    const b = p.breeze();
    if (!b || b.strength < 0.05) continue;
    for (const c of catchers) {
      if (c === (p as unknown)) continue;
      v.copy(c.windPoint()).sub(b.origin).setY(0);
      const along = v.dot(b.dir);
      if (along < 0.2 || along > WIND_RANGE) continue;
      const lateral = v.addScaledVector(b.dir, -along).length();
      const spread = 0.8 + along * 0.3;
      if (lateral > spread) continue;
      const w = b.strength * (1 - along / WIND_RANGE) * Math.sqrt(1 - lateral / spread);
      c.wind += w;
      c.windDir.addScaledVector(b.dir, w);
    }
  }
}

/** Puffs of air drifting out of a fan along its local +z. */
class Gusts {
  private rings: THREE.Mesh[] = [];
  constructor(
    parent: THREE.Object3D,
    private at: THREE.Vector3,
    private size = 0.5,
    count = 6,
  ) {
    const geo = new THREE.TorusGeometry(size, 0.022, 4, 24, Math.PI * 0.6);
    for (let i = 0; i < count; i++) {
      const g = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      g.userData.t = i / count;
      g.userData.a = (i * Math.PI * 2) / count;
      this.rings.push(g);
      parent.add(g);
    }
  }
  update(dt: number, mag: number, time: number) {
    for (const g of this.rings) {
      g.userData.t = (g.userData.t + dt * (0.5 + mag)) % 1;
      const t = g.userData.t as number;
      const a = g.userData.a as number;
      const r = this.size * 0.7;
      g.position.set(this.at.x + Math.cos(a) * r, this.at.y + Math.sin(a) * r, this.at.z + 0.2 + t * 2.8);
      g.rotation.z = a + time * 0.5;
      g.scale.setScalar(0.6 + t * 1.3);
      (g.material as THREE.MeshBasicMaterial).opacity = mag > 0.12 ? Math.sin(t * Math.PI) * 0.7 * Math.min(1, mag) : 0;
    }
  }
}

function bladeShape(len: number, wide: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-wide * 0.25, 0);
  s.quadraticCurveTo(-wide * 0.7, len * 0.6, -wide * 0.2, len);
  s.quadraticCurveTo(wide * 0.6, len * 0.95, wide * 0.5, len * 0.3);
  s.quadraticCurveTo(wide * 0.4, 0.05, wide * 0.25, 0);
  s.closePath();
  return s;
}

/** A ring of pitched blades in the x/y plane, spinning about z. */
function bladeRing(n: number, len: number, wide: number, material: THREE.Material, pitch = 0.45, inner = 0.12): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.ShapeGeometry(bladeShape(len - inner, wide), 10);
  geo.translate(0, inner, 0);
  for (let i = 0; i < n; i++) {
    const arm = new THREE.Group();
    const blade = mesh(geo, material);
    blade.rotation.y = pitch;
    arm.add(blade);
    arm.rotation.z = (i * Math.PI * 2) / n;
    g.add(arm);
  }
  return g;
}

// ───────────────────────────── Floor fan ─────────────────────────────

const OSC = 0.65;

/** A tall fan on a stand: its head turns slowly from side to side. */
export class FloorFan extends Part implements Blower {
  readonly kind: PartKind = 'floorFan';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.3;
  /** Turns with the head (stand, motor, blades, guard). */
  private swing = new THREE.Group();
  private rotor = new THREE.Group();
  private blur: THREE.Mesh;
  private gusts: Gusts;
  private speed = 0;
  private phase = 0;
  private hub = new THREE.Vector3();
  private bladeMat: THREE.MeshStandardMaterial;

  constructor() {
    super();
    const plate = basePlate(2.3, 2.1, 'напольный');
    // The model's motor knob points along +x; turn it to face front.
    const stand = model('floorfan', { height: 2.15, rotateY: -Math.PI / 2 });
    if (stand) {
      // Swing about the pole: the middle of the round base.
      const foot = tip(stand, 'y', -1, 0.02);
      stand.position.set(-foot.x, 0, -foot.z);
      this.swing.add(stand);
      // The knob on the motor head is the frontmost point up top.
      this.hub.copy(tip(stand, 'z', 1, 0.04, (v) => v.y > 1.5)).add(stand.position);
    } else {
      const base = mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.18, 32), mat('#9fdcc4', 0.45));
      base.position.y = 0.09;
      const pole = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 14), mat('#fbf7ef', 0.4));
      pole.position.y = 0.95;
      const motor = mesh(new THREE.SphereGeometry(0.28, 24, 16), mat('#9fdcc4', 0.45));
      motor.scale.z = 1.2;
      motor.position.set(0, 1.85, 0);
      this.swing.add(base, pole, motor);
      this.hub.set(0, 1.85, 0.34);
    }
    this.swing.position.set(0, PLATE_TOP, -0.2);
    const hub = this.hub.clone();
    hub.z += 0.12;

    // Blades and the wire guard in front of the motor.
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#bfeee0', roughness: 0.35, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
    this.bladeMat = bladeMat;
    this.rotor.add(bladeRing(5, 0.62, 0.42, bladeMat, 0.5));
    const cap = mesh(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.teal, 0.4));
    cap.rotation.x = Math.PI / 2;
    this.rotor.add(cap);
    this.rotor.position.copy(hub);
    const guard = new THREE.Group();
    const wire = mat('#e9eef2', 0.3, 0.6);
    const rimGeo = new THREE.TorusGeometry(0.7, 0.025, 6, 48);
    const front = mesh(rimGeo, wire, false);
    front.position.z = 0.1;
    const back = mesh(rimGeo, wire, false);
    back.position.z = -0.12;
    guard.add(front, back);
    for (const r of [0.28, 0.5]) {
      const ring = mesh(new THREE.TorusGeometry(r, 0.012, 4, 36), wire, false);
      ring.position.z = 0.13;
      guard.add(ring);
    }
    const spokeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.7, 4);
    for (let i = 0; i < 12; i++) {
      const s = mesh(spokeGeo, wire, false);
      const a = (i * Math.PI * 2) / 12;
      s.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.13);
      s.rotation.z = a - Math.PI / 2;
      guard.add(s);
    }
    const badge = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 24), mat(C.teal, 0.4));
    badge.rotation.x = Math.PI / 2;
    badge.position.z = 0.14;
    guard.add(badge);
    guard.position.copy(hub);
    this.blur = rotorBlur(0.66, 5, '#9fe3cf');
    this.blur.position.copy(hub).setZ(hub.z + 0.04);
    this.swing.add(this.rotor, guard, this.blur);
    this.gusts = new Gusts(this.swing, hub, 0.55);

    this.body.add(plate, this.swing);
    this.addTerminal('a', 'none', 0.85, 0.75);
    this.addTerminal('b', 'none', -0.85, 0.75);
    this.pickable(plate, this.swing);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  breeze(): Breeze | null {
    const strength = Math.abs(this.speed) / 20;
    if (strength < 0.05) return null;
    const origin = this.swing.localToWorld(this.hub.clone());
    const dir = new THREE.Vector3(Math.sin(this.swing.rotation.y), 0, Math.cos(this.swing.rotation.y));
    dir.transformDirection(this.root.matrixWorld).setY(0).normalize();
    return { origin, dir, strength };
  }

  protected animate(dt: number) {
    const target = Math.max(-1.6, Math.min(1.6, this.state.level)) * 20;
    this.speed = damp(this.speed, target, Math.abs(target) > Math.abs(this.speed) ? 1.4 : 0.8, dt);
    this.rotor.rotation.z -= this.speed * dt;
    const mag = Math.abs(this.speed) / 20;
    // The head sweeps side to side while running, and stays where it stopped.
    this.phase += dt * 0.55 * Math.min(1, mag * 1.5);
    this.swing.rotation.y = Math.sin(this.phase) * OSC;
    const k = blurAmount(this.speed);
    (this.blur.material as THREE.MeshBasicMaterial).opacity = k * 0.9;
    this.blur.rotation.z = this.rotor.rotation.z;
    this.bladeMat.opacity = 0.92 - k * 0.3;
    this.gusts.update(dt, mag, this.time);
  }
}

// ──────────────────────────── Computer fan ────────────────────────────

const PC_SIZE = 1.3;
const PC_Y = PLATE_TOP + 0.12 + PC_SIZE / 2;

/** A square computer fan with a rainbow light ring. */
export class PcFan extends Part implements Blower {
  readonly kind: PartKind = 'pcFan';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.15;
  private rotor = new THREE.Group();
  private speed = 0;
  private hue = 0;
  private glowMats: THREE.MeshStandardMaterial[] = [];
  private bladeMat: THREE.MeshStandardMaterial;
  private gusts: Gusts;
  private blur: THREE.Mesh;

  constructor() {
    super();
    const plate = basePlate(2.0, 1.7, 'кулер');
    const frame = new THREE.Group();
    const h = PC_SIZE / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-h + 0.12, -h);
    shape.lineTo(h - 0.12, -h);
    shape.quadraticCurveTo(h, -h, h, -h + 0.12);
    shape.lineTo(h, h - 0.12);
    shape.quadraticCurveTo(h, h, h - 0.12, h);
    shape.lineTo(-h + 0.12, h);
    shape.quadraticCurveTo(-h, h, -h, h - 0.12);
    shape.lineTo(-h, -h + 0.12);
    shape.quadraticCurveTo(-h, -h, -h + 0.12, -h);
    const hole = new THREE.Path();
    hole.absarc(0, 0, h - 0.07, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 40 });
    geo.translate(0, 0, -0.13);
    const box = mesh(geo, mat('#2a3148', 0.45));
    box.position.y = PC_Y;
    frame.add(box);
    // Screws in the corners.
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const s = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), mat(C.metal, 0.3, 0.8), false);
      s.rotation.x = Math.PI / 2;
      s.position.set(sx * (h - 0.11), PC_Y + sy * (h - 0.11), 0.15);
      frame.add(s);
    }
    // Light ring round the opening, and a strip on the front edge.
    const ringMat = new THREE.MeshStandardMaterial({ color: '#30364a', emissive: '#ff4d6d', emissiveIntensity: 0, roughness: 0.3 });
    const ring = mesh(new THREE.TorusGeometry(h - 0.07, 0.03, 8, 60), ringMat, false);
    ring.position.set(0, PC_Y, 0.13);
    const ringBack = ring.clone();
    ringBack.position.z = -0.13;
    this.glowMats.push(ringMat);
    frame.add(ring, ringBack);
    // Feet holding it upright.
    for (const sx of [-0.45, 0.45]) {
      const foot = roundedBox(0.3, 0.14, 0.7, 0.05, C.navy2, 0.5);
      foot.position.set(sx, PLATE_TOP, 0);
      frame.add(foot);
    }
    // Hub with a sticker, seven translucent blades.
    this.bladeMat = new THREE.MeshStandardMaterial({ color: '#eef3ff', emissive: '#ff4d6d', emissiveIntensity: 0, roughness: 0.25, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    this.rotor.add(bladeRing(7, h - 0.1, 0.34, this.bladeMat, 0.55, 0.16));
    const hub = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.16, 28), mat('#1c2133', 0.4));
    hub.rotation.x = Math.PI / 2;
    const sticker = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 28), mat(C.teal, 0.4), false);
    sticker.rotation.x = Math.PI / 2;
    sticker.position.z = 0.085;
    this.rotor.add(hub, sticker);
    this.rotor.position.set(0, PC_Y, 0.02);
    // Four struts behind the blades.
    for (let i = 0; i < 4; i++) {
      const strut = mesh(new THREE.BoxGeometry(0.04, h - 0.1, 0.03), mat('#2a3148', 0.45), false);
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      strut.position.set(Math.cos(a) * (h / 2), PC_Y + Math.sin(a) * (h / 2), -0.11);
      strut.rotation.z = a - Math.PI / 2;
      frame.add(strut);
    }
    this.blur = rotorBlur(h - 0.1, 7, '#e8eeff');
    this.blur.position.set(0, PC_Y, 0.11);
    this.gusts = new Gusts(this.body, new THREE.Vector3(0, PC_Y, 0.1), 0.45);

    this.body.add(plate, frame, this.rotor, this.blur);
    this.addTerminal('a', 'none', 0.75, 0.6);
    this.addTerminal('b', 'none', -0.75, 0.6);
    this.pickable(plate, frame, this.rotor);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 10 };
  }

  private glow = 0;
  /** The rainbow ring tints the table around it. */
  glowLight() {
    if (this.glow < 0.1) return null;
    return { at: this.root.localToWorld(new THREE.Vector3(0, PC_Y, 0.4)), color: new THREE.Color().setHSL(this.hue, 0.95, 0.55), power: this.glow * 0.45 };
  }

  breeze(): Breeze | null {
    const strength = (Math.abs(this.speed) / 26) * 0.8;
    if (strength < 0.05) return null;
    const origin = this.root.localToWorld(new THREE.Vector3(0, PC_Y, 0.2));
    const dir = new THREE.Vector3(0, 0, 1).transformDirection(this.root.matrixWorld).setY(0).normalize();
    return { origin, dir, strength };
  }

  protected animate(dt: number) {
    const target = Math.max(-1.6, Math.min(1.6, this.state.level)) * 26;
    this.speed = damp(this.speed, target, Math.abs(target) > Math.abs(this.speed) ? 2 : 1, dt);
    this.rotor.rotation.z -= this.speed * dt;
    const mag = Math.abs(this.speed) / 26;
    // The colours run round the rainbow faster the faster it spins.
    this.hue = (this.hue + dt * (0.08 + mag * 0.2)) % 1;
    const glow = Math.min(1, mag * 2);
    this.glow = glow;
    for (const m of this.glowMats) {
      m.emissive.setHSL(this.hue, 0.95, 0.55);
      m.emissiveIntensity = glow * 2.2;
    }
    this.bladeMat.emissive.setHSL((this.hue + 0.5) % 1, 0.9, 0.55);
    this.bladeMat.emissiveIntensity = glow * 0.45;
    const k = blurAmount(this.speed);
    const blurMat = this.blur.material as THREE.MeshBasicMaterial;
    blurMat.opacity = k * 0.85;
    // The blur takes on the light ring's colour.
    blurMat.color.setHSL((this.hue + 0.5) % 1, 0.7, 0.75);
    this.blur.rotation.z = this.rotor.rotation.z;
    this.bladeMat.opacity = 0.85 - k * 0.6;
    this.gusts.update(dt, mag, this.time);
  }
}

// ───────────────────────────── Pinwheel ─────────────────────────────

const PIN_Y = PLATE_TOP + 1.85;
const PETALS = ['#e5533d', '#f2c230', '#3f86d6', '#5cb85c'];

function petalGeometry(): THREE.BufferGeometry {
  // One sail of a paper pinwheel: from the centre out, one edge flat to the
  // tip, the other folded back towards the viewer.
  const L = 0.72;
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  const idx: number[] = [];
  const nu = 8;
  const nv = 4;
  const edge2 = -1.5;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      const r1 = 0.04 + u * L;
      const r2 = 0.04 + u * L * 0.7;
      const x = (1 - v) * 0 + v * Math.sin(-edge2) * r2;
      const y = (1 - v) * r1 + v * Math.cos(-edge2) * r2;
      const z = v * u ** 1.4 * 0.3;
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j;
      const b = a + nv + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** No wires: it turns to face the wind and spins. A tap flicks it round too. */
export class Pinwheel extends Part implements WindCatcher {
  readonly kind: PartKind = 'pinwheel';
  readonly elementKind: ElementKind = 'wire';
  readonly radius = 0.8;
  wind = 0;
  windDir = new THREE.Vector3();
  /** Seconds since it last felt a breeze. */
  calm = 0;
  private head = new THREE.Group();
  private wheel = new THREE.Group();
  private omega = 0;

  constructor() {
    super();
    const plate = basePlate(1.4, 1.4);
    const frame = new THREE.Group();
    const weight = mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.teal, 0.4));
    weight.position.y = PLATE_TOP;
    const stick = mesh(new THREE.CylinderGeometry(0.04, 0.045, PIN_Y - PLATE_TOP, 12), mat('#fbf7ef', 0.45));
    stick.position.y = (PIN_Y + PLATE_TOP) / 2;
    frame.add(weight, stick);
    const geo = petalGeometry();
    PETALS.forEach((color, i) => {
      const petal = mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide }));
      petal.rotation.z = (i * Math.PI) / 2;
      this.wheel.add(petal);
    });
    const pin = mesh(new THREE.SphereGeometry(0.07, 14, 10), mat(C.amber, 0.35));
    pin.position.z = 0.05;
    this.wheel.add(pin);
    this.wheel.position.z = 0.1;
    this.head.add(this.wheel);
    this.head.position.y = PIN_Y;
    this.body.add(plate, frame, this.head);
    this.pickable(plate, frame, this.head);
  }

  /** Nothing electrical inside. */
  elements(): CircuitElement[] {
    return [];
  }

  windPoint(): THREE.Vector3 {
    return this.root.position;
  }

  tap(): boolean {
    super.tap();
    this.omega += 9;
    return false;
  }

  get spinning() {
    return Math.abs(this.omega) > 2;
  }

  protected animate(dt: number) {
    this.calm = this.wind > 0.05 ? 0 : this.calm + dt;
    // Face into the wind like a weather vane.
    if (this.windDir.lengthSq() > 1e-4) {
      const d = this.windDir;
      const yaw = Math.atan2(-d.x, -d.z);
      const diff = Math.atan2(Math.sin(yaw - this.head.rotation.y), Math.cos(yaw - this.head.rotation.y));
      this.head.rotation.y += diff * Math.min(1, dt * 2.5);
    }
    const target = this.wind * 30;
    this.omega = damp(this.omega, target, target > this.omega ? 1.6 : 0.5, dt);
    this.wheel.rotation.z -= this.omega * dt;
  }
}
