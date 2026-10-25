// Fourth wave: things that teach by doing — a hand-crank generator (no
// battery: spin it and the bulb lights), a lift whose cabin goes up or down
// depending on which way the wires go, and a crane with an electromagnet that
// picks up steel balls while powered and drops them when switched off.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { model, tip } from './assets';
import { Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox, signDecal } from './kit';
import { glowFor, sprite } from './models';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ───────────────────────────── Dynamo ──────────────────────────────

/** Volts per radian-per-second of the crank (about 6 V at a brisk spin). */
const VOLTS_PER_RAD = 0.55;
const MAX_EMF = 6;

/**
 * A generator turned by hand: circle a finger round the crank and it makes
 * electricity — the faster, the more. Let go and it coasts to a stop.
 */
export class Dynamo extends Part {
  readonly kind: PartKind = 'dynamo';
  readonly elementKind: ElementKind = 'battery';
  readonly radius = 1.3;
  private crank = new THREE.Group();
  private axle = new THREE.Vector3(0, PLATE_TOP + 0.9, -0.2);
  private angle = 0;
  /** Crank speed, rad/s. */
  omega = 0;
  private held = false;
  private lastAngle = 0;
  private lastTime = 0;
  private emf = 0;
  private lamps: THREE.MeshStandardMaterial[] = [];
  private spark: THREE.Sprite;

  constructor() {
    super();
    const plate = basePlate(2.4, 2.2, 'динамо');
    const sculpt = model('dynamo', { width: 1.45, rotateY: -Math.PI / 2 });
    const box = new THREE.Group();
    if (sculpt) {
      box.add(sculpt);
      // The crank goes on the model's brass stub: its highest point.
      const stub = tip(sculpt, 'y', 1, 0.03);
      this.axle.set(stub.x, PLATE_TOP + stub.y - 0.02, -0.2 + stub.z);
    } else {
      const b = roundedBox(1.4, 0.9, 1.1, 0.14, C.teal, 0.4);
      b.position.y = 0.45;
      box.add(b);
      this.axle.y = PLATE_TOP + 0.9;
    }
    box.position.set(0, PLATE_TOP, -0.2);

    // The crank: a short shaft, an arm, and a red knob to hold.
    const shaft = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16), mat(C.brass, 0.3, 0.8));
    shaft.position.y = 0.08;
    const arm = roundedBox(0.72, 0.07, 0.14, 0.03, C.navy2, 0.4);
    arm.position.set(0.32, 0.17, 0);
    const knob = mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.34, 20), mat(C.red, 0.3));
    knob.position.set(0.62, 0.36, 0);
    const cap = mesh(new THREE.SphereGeometry(0.11, 20, 12), mat(C.red, 0.3));
    cap.position.set(0.62, 0.53, 0);
    this.crank.add(shaft, arm, knob, cap);
    this.crank.position.copy(this.axle);

    // A row of five lamps on the plate: how much electricity is being made.
    for (let i = 0; i < 5; i++) {
      const m = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: i < 3 ? '#3fe07a' : i < 4 ? '#ffc21a' : '#ff4a36', emissiveIntensity: 0, roughness: 0.3 });
      const lamp = mesh(new THREE.SphereGeometry(0.06, 14, 10), m);
      lamp.position.set(-0.36 + i * 0.18, PLATE_TOP + 0.04, 0.62);
      this.lamps.push(m);
      this.body.add(lamp);
    }
    this.spark = sprite(glowFor('rgba(255,230,120,0.95)'), 0.9);
    this.spark.position.copy(this.axle).add(new THREE.Vector3(0, 0.3, 0));

    const plus = signDecal('plus', C.red, 0.26);
    plus.position.set(0.82, PLATE_TOP + 0.005, 0.42);
    this.body.add(plate, box, this.crank, this.spark, plus);
    this.addTerminal('a', 'plus', 0.82, 0.78);
    this.addTerminal('b', 'minus', -0.82, 0.78);
    this.pickable(plate, box, this.crank);
    this.holdPlane = this.axle.y + 0.2;
  }

  protected electrical(): Partial<CircuitElement> {
    return { emf: this.emf, r: 1 };
  }

  /** Volts it makes right now. */
  get volts() {
    return this.emf;
  }

  /** Local position of the knob, for a hint pointing at it. */
  knobPoint(): THREE.Vector3 {
    return new THREE.Vector3(this.axle.x + Math.cos(this.angle) * 0.62, this.axle.y + 0.5, this.axle.z - Math.sin(this.angle) * 0.62);
  }

  private fingerAngle(point: THREE.Vector3) {
    const l = this.root.worldToLocal(point.clone());
    return Math.atan2(-(l.z - this.axle.z), l.x - this.axle.x);
  }

  controlAt(hit: THREE.Object3D | null): boolean {
    for (let o = hit; o; o = o.parent) if (o === this.crank) return true;
    return false;
  }

  pressStart(hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    if (!this.controlAt(hit) || !point) return false;
    this.held = true;
    this.lastAngle = this.fingerAngle(point);
    this.lastTime = performance.now();
    return true;
  }

  pressMove(_hit: THREE.Object3D | null, point: THREE.Vector3 | null) {
    if (!this.held || !point) return;
    const now = performance.now();
    const a = this.fingerAngle(point);
    const d = wrap(a - this.lastAngle);
    const dt = Math.max(0.008, (now - this.lastTime) / 1000);
    // Follow the finger; the speed is smoothed so jittery touches don't flicker the bulb.
    this.angle += d;
    this.omega = THREE.MathUtils.lerp(this.omega, d / dt, Math.min(1, dt * 8));
    this.lastAngle = a;
    this.lastTime = now;
  }

  pressEnd() {
    this.held = false;
  }

  protected animate(dt: number) {
    if (!this.held) {
      // Coasts on its flywheel for a moment after the finger lets go.
      this.omega = damp(this.omega, 0, 0.9, dt);
      this.angle += this.omega * dt;
    } else if (performance.now() - this.lastTime > 150) {
      // Finger resting on the knob: the crank stops.
      this.omega = damp(this.omega, 0, 6, dt);
    }
    this.crank.rotation.y = this.angle;
    const emf = Math.min(MAX_EMF, Math.abs(this.omega) * VOLTS_PER_RAD);
    if (Math.abs(emf - this.emf) > 0.04 || (emf === 0 && this.emf !== 0)) {
      this.emf = emf < 0.05 ? 0 : emf;
      this.wantsSolve = true;
    }
    const lit = (this.emf / MAX_EMF) * 5;
    this.lamps.forEach((m, i) => (m.emissiveIntensity = damp(m.emissiveIntensity, lit > i + 0.3 ? 2.4 : 0, 12, dt)));
    this.spark.material.opacity = damp(this.spark.material.opacity, this.emf > 4.5 ? 0.6 + Math.random() * 0.4 : 0, 20, dt);
  }
}

// ────────────────────────────── Lift ───────────────────────────────

const LIFT_BOTTOM = PLATE_TOP + 0.08;
const LIFT_TOP = PLATE_TOP + 1.75;

/** A cabin in a tower: current one way takes it up, the other way down. */
export class Lift extends Part {
  readonly kind: PartKind = 'lift';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.3;
  private cabin = new THREE.Group();
  private rope: THREE.Mesh;
  private pulley: THREE.Mesh;
  private y = LIFT_BOTTOM;
  private v = 0;
  private atEnd: 'top' | 'bottom' | null = 'bottom';
  private floorLamps: THREE.MeshStandardMaterial[] = [];
  private passenger = new THREE.Group();
  /** The cabin's walls and window: lowered to an open car when a kitten rides. */
  private shell!: THREE.Object3D;
  private window_!: THREE.Object3D;
  private roof!: THREE.Object3D;

  constructor() {
    super();
    const plate = basePlate(2.3, 2.3, 'лифт');
    const tower = new THREE.Group();
    const pillar = (x: number, z: number) => {
      const p = roundedBox(0.12, 2.45, 0.12, 0.03, C.navy2, 0.45);
      p.position.set(x, PLATE_TOP + 1.22, z);
      tower.add(p);
    };
    const W = 0.56;
    const D = 0.5;
    const ZC = -0.25;
    pillar(-W, ZC - D);
    pillar(W, ZC - D);
    pillar(-W, ZC + D);
    pillar(W, ZC + D);
    // Cross bars at the back and sides; the front stays open to see the cabin.
    for (let i = 0; i < 4; i++) {
      const y = PLATE_TOP + 0.35 + i * 0.62;
      const back = roundedBox(W * 2, 0.07, 0.07, 0.02, C.amber, 0.5);
      back.position.set(0, y, ZC - D);
      const l = roundedBox(0.07, 0.07, D * 2, 0.02, C.amber, 0.5);
      l.position.set(-W, y, ZC);
      const r = l.clone();
      r.position.x = W;
      tower.add(back, l, r);
    }
    const roof = (this.roof = roundedBox(W * 2 + 0.3, 0.32, D * 2 + 0.3, 0.08, C.red, 0.4));
    roof.position.set(0, PLATE_TOP + 2.6, ZC);
    this.pulley = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 20), mat(C.brass, 0.3, 0.8));
    this.pulley.rotation.x = Math.PI / 2;
    this.pulley.position.set(0, PLATE_TOP + 2.3, ZC);
    const floor = roundedBox(W * 2 + 0.16, 0.06, D * 2 + 0.16, 0.03, C.navy2, 0.5);
    floor.position.set(0, PLATE_TOP + 0.03, ZC);
    tower.add(roof, this.pulley, floor);

    // The cabin with a little passenger looking out of the open front.
    const shell = (this.shell = roundedBox(0.86, 0.72, 0.8, 0.08, '#ffb547', 0.4));
    shell.position.y = 0.36;
    const window_ = (this.window_ = mesh(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshStandardMaterial({ color: '#2a3555', roughness: 0.15, metalness: 0.3 })));
    window_.position.set(0, 0.42, 0.405);
    const head = mesh(new THREE.SphereGeometry(0.11, 18, 12), mat('#f5c7a0', 0.6));
    head.position.set(0, 0.48, 0.3);
    const hat = mesh(new THREE.ConeGeometry(0.09, 0.14, 16), mat(C.teal, 0.5));
    hat.position.set(0, 0.62, 0.3);
    this.passenger.add(head, hat);
    this.cabin.add(shell, window_, this.passenger);
    this.cabin.position.set(0, this.y, ZC + 0.02);
    this.rope = mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), mat('#2a2f3a', 0.6), false);
    this.rope.position.set(0, 0, ZC);

    for (const [y, i] of [
      [LIFT_BOTTOM + 0.36, 0],
      [LIFT_TOP + 0.36, 1],
    ] as const) {
      const m = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: '#3fe07a', emissiveIntensity: 0, roughness: 0.3 });
      const lamp = mesh(new THREE.SphereGeometry(0.06, 14, 10), m);
      lamp.position.set(W + 0.12, y, ZC + D + 0.02);
      this.floorLamps[i] = m;
      tower.add(lamp);
    }

    this.body.add(plate, tower, this.cabin, this.rope);
    this.addTerminal('a', 'none', 0.85, 0.8);
    this.addTerminal('b', 'none', -0.85, 0.8);
    this.pickable(plate, tower, this.cabin);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 10 };
  }

  /** Where the cabin stands: at the top, at the bottom, or on its way. */
  get end() {
    return this.atEnd;
  }

  /** The middle of the cabin's floor, in world space (a passenger stands there). */
  cabinFloor(target = new THREE.Vector3()) {
    return this.cabin.localToWorld(target.set(0, 0.1, 0));
  }

  /** The farm's kitten rides instead of the little driver. */
  set driver(on: boolean) {
    this.passenger.visible = on;
    // A closed cabin (and the tower's roof, at the top) would hide the kitten: an open
    // platform under the floor it stands on, so the rider is seen all the way.
    this.shell.scale.y = on ? 1 : 0.1 / 0.72;
    this.shell.position.y = on ? 0.36 : 0.05;
    this.window_.visible = on;
    this.roof.visible = on;
  }

  protected animate(dt: number) {
    const l = Math.max(-1.6, Math.min(1.6, this.state.level));
    this.v = damp(this.v, Math.abs(l) > 0.15 ? l * 0.75 : 0, 5, dt);
    const before = this.y;
    this.y = THREE.MathUtils.clamp(this.y + this.v * dt, LIFT_BOTTOM, LIFT_TOP);
    const moved = this.y - before;
    this.pulley.rotation.y += moved * 6;
    const end = this.y >= LIFT_TOP - 1e-3 ? 'top' : this.y <= LIFT_BOTTOM + 1e-3 ? 'bottom' : null;
    if (end && end !== this.atEnd) {
      this.sounds.push({ kind: 'ding' });
      if (end === 'top') this.sounds.push({ kind: 'liftTop' });
    }
    this.atEnd = end;
    this.cabin.position.y = this.y;
    // The passenger bobs a little on the way.
    this.passenger.position.y = Math.abs(moved) > 1e-4 ? Math.sin(this.time * 14) * 0.012 : 0;
    const ropeTop = PLATE_TOP + 2.22;
    const ropeBottom = this.y + 0.72;
    this.rope.scale.y = Math.max(0.01, ropeTop - ropeBottom);
    this.rope.position.y = (ropeTop + ropeBottom) / 2;
    this.floorLamps[0].emissiveIntensity = damp(this.floorLamps[0].emissiveIntensity, end === 'bottom' ? 2.2 : 0, 10, dt);
    this.floorLamps[1].emissiveIntensity = damp(this.floorLamps[1].emissiveIntensity, end === 'top' ? 2.2 : 0, 10, dt);
  }
}

// ────────────────────────────── Crane ──────────────────────────────

const JIB = 1.55;
const MAST_Z = -0.25;
const JIB_Y = PLATE_TOP + 2.1;
const MAGNET_Y = PLATE_TOP + 0.95;
const PILE = new THREE.Vector2(JIB, MAST_Z);
const BUCKET = new THREE.Vector2(-JIB, MAST_Z);
const BALL_R = 0.09;

type BallState = 'pile' | 'lift' | 'held' | 'fall' | 'bucket' | 'home';
interface Ball {
  m: THREE.Mesh;
  state: BallState;
  home: THREE.Vector3;
  slot: THREE.Vector3;
  vy: number;
  t: number;
}

/**
 * A tower crane with an electromagnet. Powered, the magnet lifts the steel
 * balls below it; turn the jib by dragging it, switch the power off over the
 * bucket, and the balls drop in. Balls dropped elsewhere roll back home.
 */
export class Crane extends Part {
  readonly kind: PartKind = 'crane';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 2.1;
  private slew = new THREE.Group();
  private magnet = new THREE.Group();
  private cable: THREE.Mesh;
  private balls: Ball[] = [];
  private yaw = 0;
  private yawGoal = 0;
  private held = false;
  private done = false;
  private resetIn = 0;
  private magnetGlow: THREE.Sprite;

  constructor() {
    super();
    const plate = basePlate(4.0, 2.6, 'кран');
    const yellow = '#f2c230';
    const mast = roundedBox(0.3, JIB_Y - PLATE_TOP, 0.3, 0.05, yellow, 0.45);
    mast.position.set(0, (JIB_Y + PLATE_TOP) / 2, MAST_Z);
    const foot = roundedBox(0.7, 0.14, 0.7, 0.05, C.navy2, 0.5);
    foot.position.set(0, PLATE_TOP + 0.07, MAST_Z);
    // Zig-zag braces up the mast, the classic crane look.
    for (let i = 0; i < 5; i++) {
      const b = roundedBox(0.04, 0.42, 0.04, 0.015, C.navy2, 0.5);
      b.position.set(0, PLATE_TOP + 0.3 + i * 0.36, MAST_Z + 0.16);
      b.rotation.z = i % 2 ? 0.6 : -0.6;
      plate.add(b);
    }

    // The turning top: operator cab, jib with trolley, counter-jib with weight.
    const cab = roundedBox(0.42, 0.34, 0.38, 0.06, C.red, 0.4);
    cab.position.set(0.05, -0.18, 0);
    const glass = mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshStandardMaterial({ color: '#2a3555', roughness: 0.15, metalness: 0.3 }));
    glass.position.set(0.05, -0.15, 0.195);
    const jib = roundedBox(JIB + 0.25, 0.12, 0.16, 0.03, yellow, 0.45);
    jib.position.set((JIB + 0.25) / 2 - 0.1, 0.08, 0);
    const counter = roundedBox(0.7, 0.1, 0.16, 0.03, yellow, 0.45);
    counter.position.set(-0.4, 0.08, 0);
    const weight = roundedBox(0.26, 0.26, 0.24, 0.04, '#8a90a0', 0.5);
    weight.position.set(-0.62, -0.06, 0);
    const trolley = roundedBox(0.18, 0.08, 0.2, 0.02, C.navy2, 0.5);
    trolley.position.set(JIB, 0.0, 0);
    this.slew.add(cab, glass, jib, counter, weight, trolley);
    this.slew.position.set(0, JIB_Y, MAST_Z);

    const core = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 24), mat('#3a3f4b', 0.4, 0.6));
    const rim = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 28), mat(C.red, 0.4));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.06;
    this.magnet.add(core, rim);
    this.magnetGlow = sprite(glowFor('rgba(120,200,255,0.8)'), 0.8);
    this.magnetGlow.position.y = -0.12;
    this.magnet.add(this.magnetGlow);
    this.cable = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), mat('#2a2f3a', 0.6), false);

    // A bucket for the balls, and the balls on their pile.
    const bucket = mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.32, 24, 1, true), mat(C.teal, 0.45));
    (bucket.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    bucket.position.set(BUCKET.x, PLATE_TOP + 0.16, BUCKET.y);
    const bottom = mesh(new THREE.CircleGeometry(0.26, 24), mat(C.tealDeep, 0.5));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(BUCKET.x, PLATE_TOP + 0.01, BUCKET.y);
    const pad = mesh(new THREE.CircleGeometry(0.38, 28), mat('#e3d4bd', 0.8));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(PILE.x, PLATE_TOP + 0.006, PILE.y);
    const steel = new THREE.MeshStandardMaterial({ color: '#cfd5de', metalness: 1, roughness: 0.18 });
    const homes = [
      [-0.11, -0.08],
      [0.1, -0.1],
      [0.0, 0.11],
      [0.12, 0.09],
    ];
    homes.forEach(([dx, dz], i) => {
      const m = mesh(new THREE.SphereGeometry(BALL_R, 20, 14), steel);
      const home = new THREE.Vector3(PILE.x + dx, PLATE_TOP + BALL_R, PILE.y + dz);
      const slot = new THREE.Vector3(BUCKET.x + dx * 0.8, PLATE_TOP + BALL_R + 0.02, BUCKET.y + dz * 0.8);
      m.position.copy(home);
      this.balls.push({ m, state: 'pile', home, slot, vy: 0, t: i * 0.12 });
      this.body.add(m);
    });

    this.body.add(plate, mast, foot, this.slew, this.magnet, this.cable, bucket, bottom, pad);
    this.addTerminal('a', 'none', 1.7, 1.0);
    this.addTerminal('b', 'none', -1.7, 1.0);
    this.pickable(plate, mast, this.slew, this.magnet);
    this.holdPlane = JIB_Y;
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 12 };
  }

  get powered() {
    return this.state.level > 0.2;
  }

  private magnetPos(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.yaw) * JIB, MAGNET_Y, MAST_Z - Math.sin(this.yaw) * JIB);
  }

  private onTop(hit: THREE.Object3D | null) {
    for (let o = hit; o; o = o.parent) if (o === this.slew || o === this.magnet) return true;
    return false;
  }

  controlAt(hit: THREE.Object3D | null): boolean {
    return this.onTop(hit);
  }

  /** Grab the jib or the magnet and swing the crane round. */
  pressStart(hit: THREE.Object3D | null): boolean {
    if (!this.onTop(hit)) return false;
    this.held = true;
    return true;
  }

  pressMove(_hit: THREE.Object3D | null, point: THREE.Vector3 | null) {
    if (!this.held || !point) return;
    const l = this.root.worldToLocal(point.clone());
    if (Math.hypot(l.x, l.z - MAST_Z) < 0.2) return;
    this.yawGoal = this.yaw + wrap(Math.atan2(-(l.z - MAST_Z), l.x) - this.yaw);
  }

  pressEnd() {
    this.held = false;
  }

  protected animate(dt: number) {
    this.yaw = damp(this.yaw, this.yawGoal, 10, dt);
    this.slew.rotation.y = this.yaw;
    const mp = this.magnetPos();
    this.magnet.position.copy(mp);
    const top = JIB_Y - 0.02;
    this.cable.scale.y = top - (mp.y + 0.08);
    this.cable.position.set(mp.x, (top + mp.y + 0.08) / 2, mp.z);
    const on = this.powered;
    this.magnetGlow.material.opacity = damp(this.magnetGlow.material.opacity, on ? 0.5 + Math.sin(this.time * 6) * 0.15 : 0, 8, dt);

    let heldNow = 0;
    this.balls.forEach((b, i) => {
      const p = b.m.position;
      const under = Math.hypot(p.x - mp.x, p.z - mp.z) < 0.55;
      switch (b.state) {
        case 'pile':
        case 'bucket':
          // A powered magnet right above pulls balls up (also out of the bucket).
          if (on && under && !this.done) {
            b.state = 'lift';
            b.t = 0;
            this.sounds.push({ kind: 'clank' });
          }
          break;
        case 'lift': {
          b.t += dt * 3;
          const target = this.heldSpot(i, mp);
          p.lerp(target, Math.min(1, b.t));
          if (b.t >= 1) b.state = 'held';
          if (!on) b.state = 'fall';
          break;
        }
        case 'held':
          p.copy(this.heldSpot(i, mp));
          heldNow++;
          if (!on) {
            b.state = 'fall';
            b.vy = 0;
          }
          break;
        case 'fall': {
          b.vy -= 9.8 * dt;
          p.y += b.vy * dt;
          const inBucket = Math.hypot(p.x - BUCKET.x, p.z - BUCKET.y) < 0.3;
          const floor = PLATE_TOP + BALL_R + (inBucket ? 0.02 : 0);
          if (p.y <= floor) {
            p.y = floor;
            if (inBucket) {
              b.state = 'bucket';
              p.x = THREE.MathUtils.lerp(p.x, b.slot.x, 0.5);
              p.z = THREE.MathUtils.lerp(p.z, b.slot.z, 0.5);
              this.sounds.push({ kind: 'ding' });
            } else {
              b.state = 'home';
              b.t = -0.6;
              this.sounds.push({ kind: 'clank' });
            }
          }
          break;
        }
        case 'home':
          // Rest a moment, then roll back to the pile.
          b.t += dt;
          if (b.t > 0) {
            p.lerp(b.home, Math.min(1, dt * 3));
            if (p.distanceTo(b.home) < 0.01) b.state = 'pile';
          }
          break;
      }
    });
    if (heldNow && !this.wasHolding) this.sounds.push({ kind: 'craneHold' });
    this.wasHolding = heldNow > 0;

    if (!this.done && this.balls.every((b) => b.state === 'bucket')) {
      this.done = true;
      this.resetIn = 4;
      this.sounds.push({ kind: 'craneDone' });
    }
    if (this.done) {
      this.resetIn -= dt;
      if (this.resetIn <= 0) {
        // Tip the bucket back onto the pile for another go.
        this.done = false;
        this.balls.forEach((b, i) => {
          b.state = 'home';
          b.t = -i * 0.15;
        });
      }
    }
  }

  private wasHolding = false;

  /** Where held ball i sits, clustered under the magnet. */
  private heldSpot(i: number, mp: THREE.Vector3) {
    const a = (i / this.balls.length) * Math.PI * 2;
    return new THREE.Vector3(mp.x + Math.cos(a) * 0.1, mp.y - 0.2 - (i % 2) * 0.05, mp.z + Math.sin(a) * 0.1);
  }
}
