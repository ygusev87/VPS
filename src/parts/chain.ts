// Chain-reaction parts: one thing sets off the next. A fan's wind turns a
// wind turbine that makes electricity; a lit lamp closes a light sensor; a
// launcher rolls a ball across the table that hits a target, knocks over
// dominoes, rings a drum. `interact()` runs the links between parts each frame.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox } from './kit';
import { glowFor, sprite } from './models';

// ──────────────────────────── Wind turbine ────────────────────────────

const MAX_EMF = 6;
const HUB_Y = PLATE_TOP + 2.0;

/** A white wind turbine: wind from a fan turns it, and it makes electricity. */
export class WindGen extends Part {
  readonly kind: PartKind = 'windGen';
  readonly elementKind: ElementKind = 'battery';
  readonly radius = 1.3;
  wind = 0;
  windDir = new THREE.Vector3();
  /** Seconds without a breeze. */
  calm = 0;
  private head = new THREE.Group();
  private rotor = new THREE.Group();
  private omega = 0;
  private emf = 0;
  private lamps: THREE.MeshStandardMaterial[] = [];

  constructor() {
    super();
    const plate = basePlate(2.3, 2.1, 'ветряк');
    const white = mat('#f4f6f8', 0.35);
    const tower = mesh(new THREE.CylinderGeometry(0.07, 0.14, HUB_Y - PLATE_TOP, 20), white);
    tower.position.set(0, (HUB_Y + PLATE_TOP) / 2, -0.2);
    const foot = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 28), mat(C.navy2, 0.45));
    foot.position.set(0, PLATE_TOP + 0.05, -0.2);
    const nacelle = roundedBox(0.2, 0.18, 0.46, 0.07, '#f4f6f8', 0.35);
    nacelle.position.set(0, -0.09, -0.08);
    const nose = mesh(new THREE.SphereGeometry(0.1, 18, 12), mat(C.red, 0.35));
    nose.scale.z = 1.4;
    nose.position.z = 0.02;
    this.rotor.add(nose);
    const bladeGeo = new THREE.BoxGeometry(0.1, 0.95, 0.025);
    bladeGeo.translate(0, 0.5, 0);
    for (let i = 0; i < 3; i++) {
      const b = mesh(bladeGeo, white);
      b.rotation.z = (i * Math.PI * 2) / 3;
      b.rotation.y = 0.25;
      // A red tip stripe, like real turbines.
      const tipStripe = mesh(new THREE.BoxGeometry(0.105, 0.14, 0.03), mat(C.red, 0.4), false);
      tipStripe.position.y = 0.85;
      b.add(tipStripe);
      this.rotor.add(b);
    }
    this.rotor.position.z = 0.17;
    this.head.add(nacelle, this.rotor);
    this.head.position.set(0, HUB_Y, -0.2);
    // Lamps on the plate: how much electricity the wind makes.
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: i < 3 ? '#3fe07a' : '#ffc21a', emissiveIntensity: 0, roughness: 0.3 });
      const lamp = mesh(new THREE.SphereGeometry(0.055, 14, 10), m);
      lamp.position.set(-0.27 + i * 0.18, PLATE_TOP + 0.04, 0.55);
      this.lamps.push(m);
      this.body.add(lamp);
    }
    this.body.add(plate, foot, tower, this.head);
    this.addTerminal('a', 'plus', 0.8, 0.72);
    this.addTerminal('b', 'minus', -0.8, 0.72);
    this.pickable(plate, foot, tower, this.head);
  }

  protected electrical(): Partial<CircuitElement> {
    return { emf: this.emf, r: 1 };
  }

  get volts() {
    return this.emf;
  }

  windPoint(): THREE.Vector3 {
    return this.root.position;
  }

  /** A flick of the finger gives it a short spin (a little electricity). */
  tap(): boolean {
    super.tap();
    this.omega += 6;
    return false;
  }

  protected animate(dt: number) {
    this.calm = this.wind > 0.05 ? 0 : this.calm + dt;
    if (this.windDir.lengthSq() > 1e-4) {
      const d = this.windDir;
      const yaw = Math.atan2(-d.x, -d.z);
      const diff = Math.atan2(Math.sin(yaw - this.head.rotation.y), Math.cos(yaw - this.head.rotation.y));
      this.head.rotation.y += diff * Math.min(1, dt * 1.5);
    }
    // Heavy blades: they take a moment to speed up and coast when the wind stops.
    const target = Math.min(1.6, this.wind) * 13;
    this.omega = damp(this.omega, target, target > this.omega ? 0.9 : 0.35, dt);
    this.rotor.rotation.z -= this.omega * dt;
    const emf = Math.min(MAX_EMF, this.omega * 0.42);
    if (Math.abs(emf - this.emf) > 0.05 || (emf < 0.05 && this.emf !== 0)) {
      this.emf = emf < 0.05 ? 0 : emf;
      this.wantsSolve = true;
    }
    const lit = (this.emf / MAX_EMF) * 4;
    this.lamps.forEach((m, i) => (m.emissiveIntensity = damp(m.emissiveIntensity, lit > i + 0.3 ? 2.4 : 0, 10, dt)));
  }
}

// ──────────────────────────── Light sensor ────────────────────────────

/** Closes its circuit while light from a lamp, LED or beacon falls on it. */
export class LightSensor extends Part {
  readonly kind: PartKind = 'lightSensor';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 0.95;
  /** How much light falls on it now (set by `interact`). */
  lux = 0;
  private eye: THREE.MeshStandardMaterial;
  private indicator: THREE.MeshStandardMaterial;
  private halo: THREE.Sprite;

  constructor() {
    super();
    const plate = basePlate(1.7, 1.5, 'фотодатчик');
    const housing = roundedBox(0.7, 0.32, 0.55, 0.08, C.navy2, 0.45);
    housing.position.set(0, PLATE_TOP, -0.2);
    // A small solar-cell window on top, and a glass eye.
    const cell = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshStandardMaterial({ map: cellTexture(), roughness: 0.25, metalness: 0.3 }));
    cell.rotation.x = -Math.PI / 2;
    cell.position.set(0, PLATE_TOP + 0.325, -0.2);
    this.eye = new THREE.MeshStandardMaterial({ color: '#2a3148', emissive: '#ffd36b', emissiveIntensity: 0, roughness: 0.1, metalness: 0.2 });
    const eye = mesh(new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.eye);
    eye.position.set(0, PLATE_TOP + 0.33, 0.12);
    this.indicator = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: '#3fe07a', emissiveIntensity: 0, roughness: 0.3 });
    const ind = mesh(new THREE.SphereGeometry(0.06, 14, 10), this.indicator);
    ind.position.set(0, PLATE_TOP + 0.04, 0.38);
    this.halo = sprite(glowFor('rgba(255,220,120,0.9)'), 0.9);
    this.halo.position.set(0, PLATE_TOP + 0.45, 0.1);
    this.body.add(plate, housing, cell, eye, ind, this.halo);
    this.addTerminal('a', 'none', 0.6, 0.5);
    this.addTerminal('b', 'none', -0.6, 0.5);
    this.pickable(plate, housing, cell, eye);
  }

  /** Where it looks from. */
  eyePoint(): THREE.Vector3 {
    return this.root.localToWorld(new THREE.Vector3(0, PLATE_TOP + 0.35, 0));
  }

  /** Light changed: switch on above a threshold, off a little below it. */
  sense(lux: number) {
    this.lux = lux;
    const on = this.closed ? lux > 0.18 : lux > 0.28;
    if (on !== this.closed) {
      this.closed = on;
      this.wantsSolve = true;
      this.sounds.push({ kind: 'tick' });
    }
  }

  protected animate(dt: number) {
    const k = Math.min(1, this.lux * 1.5);
    this.eye.emissiveIntensity = damp(this.eye.emissiveIntensity, k * 2.2, 8, dt);
    this.halo.material.opacity = damp(this.halo.material.opacity, k * 0.6, 8, dt);
    this.indicator.emissiveIntensity = damp(this.indicator.emissiveIntensity, this.closed ? 2.4 : 0, 12, dt);
  }
}

let cellTex: THREE.Texture | null = null;
function cellTexture(): THREE.Texture {
  if (cellTex) return cellTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1d3f8a';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#8fb3ff';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 128; x += 32) ctx.strokeRect(x, 0, 0.1, 96);
  for (let y = 0; y <= 96; y += 32) ctx.strokeRect(0, y, 128, 0.1);
  ctx.strokeStyle = '#c9d8ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 124, 92);
  cellTex = new THREE.CanvasTexture(c);
  cellTex.colorSpace = THREE.SRGBColorSpace;
  return cellTex;
}

// ───────────────────────────── Launcher ─────────────────────────────

const BALL_R = 0.14;
const AIMS = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
const MOUTH = 0.62;
const BARREL_Y = PLATE_TOP + 0.42;

/** A ball rolling on the table after leaving a launcher. */
export interface Ball {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Seconds it has been still (it fades out after a moment). */
  still: number;
  /** Parts it hit recently, so one bump counts once. */
  hits: Map<Part, number>;
}

/** A little cannon: with power it shoots a ball, again and again. Tap to turn it. */
export class Launcher extends Part {
  readonly kind: PartKind = 'launcher';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.05;
  /** 0..3: right, towards the viewer, left, away. */
  aim = 0;
  ball: Ball | null = null;
  private turret = new THREE.Group();
  private barrel = new THREE.Group();
  private loaded: THREE.Mesh;
  private reload = 0.6;
  private recoil = 0;
  private turn = 0;
  private misses = 0;

  constructor() {
    super();
    const plate = basePlate(1.9, 1.7, 'пушка');
    const base = mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.18, 32), mat(C.navy2, 0.45));
    base.position.y = 0.09;
    const ring = mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 32), mat(C.brass, 0.3, 0.8));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.18;
    const yoke = roundedBox(0.36, 0.3, 0.42, 0.06, C.red, 0.4);
    yoke.position.y = 0.17;
    // The barrel points along +x of the turret.
    const tube = mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.78, 24), mat(C.teal, 0.35));
    tube.rotation.z = -Math.PI / 2;
    tube.position.x = 0.25;
    const muzzle = mesh(new THREE.TorusGeometry(0.17, 0.04, 10, 24), mat(C.brass, 0.3, 0.8));
    muzzle.rotation.y = Math.PI / 2;
    muzzle.position.x = 0.64;
    const back = mesh(new THREE.SphereGeometry(0.19, 20, 12), mat(C.teal, 0.35));
    back.position.x = -0.14;
    this.barrel.add(tube, muzzle, back);
    this.barrel.position.y = BARREL_Y - PLATE_TOP;
    this.barrel.rotation.z = 0.12;
    this.loaded = mesh(new THREE.SphereGeometry(BALL_R, 20, 14), mat('#e5533d', 0.25, 0.1));
    this.loaded.position.set(MOUTH - 0.06, BARREL_Y - PLATE_TOP + 0.07, 0);
    this.turret.add(base, ring, yoke, this.barrel, this.loaded);
    this.turret.position.set(0, PLATE_TOP, -0.15);
    // An arrow on the plate shows where the ball will go.
    this.body.add(plate, this.turret);
    this.addTerminal('a', 'none', 0.68, 0.6);
    this.addTerminal('b', 'none', -0.68, 0.6);
    this.pickable(plate, this.turret);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 12 };
  }

  get powered() {
    return this.state.level > 0.2;
  }

  /** Which way a ball leaves (flat world direction). */
  direction(): THREE.Vector3 {
    const a = AIMS[this.aim];
    return new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
  }

  /** Tap: turn a quarter round. */
  tap(): boolean {
    super.tap();
    this.aim = (this.aim + 1) % 4;
    this.sounds.push({ kind: 'tick' });
    return false;
  }

  /** The ball leaves the barrel: hand it over to the table. */
  private fire() {
    const table = this.root.parent;
    if (!table) return;
    const dir = this.direction();
    const pos = this.root.position.clone().add(new THREE.Vector3(0, BARREL_Y + 0.05, -0.15)).addScaledVector(dir, MOUTH);
    const m = mesh(new THREE.SphereGeometry(BALL_R, 20, 14), mat(RAINBOW_BALL[Math.floor(Math.random() * RAINBOW_BALL.length)], 0.25, 0.1));
    m.position.copy(pos);
    table.add(m);
    const speed = 3.6 + Math.min(1, this.state.level) * 1.6;
    this.ball = { mesh: m, pos, vel: dir.multiplyScalar(speed), still: 0, hits: new Map() };
    this.loaded.visible = false;
    this.recoil = 1;
    this.sounds.push({ kind: 'launch' });
    this.effects.push({ kind: 'exhaust', at: pos.clone(), dir: this.direction() });
    this.effects.push({ kind: 'exhaust', at: pos.clone(), dir: this.direction() });
  }

  /** The ball has stopped and faded: load the next one. */
  ballGone() {
    if (this.ball) {
      // Two misses in a row: suggest turning the launcher.
      const hitSomething = [...this.ball.hits.keys()].some((p) => p !== this);
      this.misses = hitSomething ? 0 : this.misses + 1;
      if (this.misses === 2) this.sounds.push({ kind: 'missed' });
      this.ball.mesh.removeFromParent();
    }
    this.ball = null;
    this.reload = 1.2;
  }

  protected animate(dt: number) {
    const on = this.powered;
    // The turret swings round to its aim.
    const goal = AIMS[this.aim];
    const diff = Math.atan2(Math.sin(goal - this.turn), Math.cos(goal - this.turn));
    this.turn += diff * Math.min(1, dt * 10);
    this.turret.rotation.y = this.turn;
    if (!this.ball) {
      this.reload = Math.max(0, this.reload - dt);
      this.loaded.visible = this.reload < 0.6;
      this.loaded.scale.setScalar(Math.max(0.001, Math.min(1, (0.6 - this.reload) / 0.3)));
      // Fires when the power comes on, then every time it is loaded again.
      if (on && this.reload === 0) this.fire();
    }
    this.recoil = Math.max(0, this.recoil - dt * 4);
    this.barrel.position.x = -this.recoil * 0.12;
  }

  dispose() {
    if (this.ball) this.ball.mesh.removeFromParent();
    super.dispose();
  }
}

const RAINBOW_BALL = ['#e5533d', '#f2c230', '#2bb3a8', '#3f86d6', '#8a63c9', '#5cb85c'];

// ────────────────────────────── Target ──────────────────────────────

const TARGET_Y = PLATE_TOP + 1.05;

function targetTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const rings = ['#e5533d', '#ffffff', '#e5533d', '#ffffff', '#e5533d'];
  rings.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(64, 64, 62 - i * 12.5, 0, Math.PI * 2);
    ctx.fill();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A bullseye on a spring: a ball (or a finger) knocks it down and it closes the circuit. Tap to stand it up. */
export class Target extends Part {
  readonly kind: PartKind = 'target';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 0.95;
  private flap = new THREE.Group();
  private angle = 0;
  private angleV = 0;
  private lamp: THREE.MeshStandardMaterial;

  constructor() {
    super();
    const plate = basePlate(1.7, 1.5, 'мишень');
    const stand = roundedBox(0.7, 0.14, 0.3, 0.05, C.navy2, 0.45);
    stand.position.set(0, PLATE_TOP, -0.15);
    const hinge = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 12), mat(C.brass, 0.3, 0.8));
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0, PLATE_TOP + 0.18, -0.15);
    const face = mat('#ffffff', 0.5);
    const disk = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 40), [mat('#d9d9d9', 0.5), new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.5 })] as unknown as THREE.Material);
    disk.rotation.x = Math.PI / 2;
    disk.position.y = TARGET_Y - PLATE_TOP - 0.18;
    const post = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 10), face);
    post.position.y = 0.2;
    this.flap.add(post, disk);
    // The face looks at the viewer; a hit from any side knocks it over backwards.
    const holder = new THREE.Group();
    holder.position.set(0, PLATE_TOP + 0.18, -0.15);
    holder.add(this.flap);
    this.lamp = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: '#3fe07a', emissiveIntensity: 0, roughness: 0.3 });
    const l = mesh(new THREE.SphereGeometry(0.06, 14, 10), this.lamp);
    l.position.set(0, PLATE_TOP + 0.04, 0.4);
    this.body.add(plate, stand, hinge, holder, l);
    this.addTerminal('a', 'none', 0.6, 0.5);
    this.addTerminal('b', 'none', -0.6, 0.5);
    this.pickable(plate, stand, this.flap);
  }

  /** Hit: it falls back and latches the contact. */
  ballHit() {
    if (this.closed) {
      this.angleV -= 3;
      return;
    }
    this.closed = true;
    this.angleV = -9;
    this.wantsSolve = true;
    this.sounds.push({ kind: 'ding' });
    this.effects.push({ kind: 'sparks', at: this.root.localToWorld(new THREE.Vector3(0, TARGET_Y, -0.15)), n: 14, color: '#ffd36b' });
  }

  tap(): boolean {
    super.tap();
    if (this.closed) {
      this.closed = false;
      this.angleV = 6;
    } else this.ballHit();
    return true;
  }

  protected animate(dt: number) {
    const target = this.closed ? -1.35 : 0;
    this.angleV += ((target - this.angle) * 90 - this.angleV * 9) * dt;
    this.angle += this.angleV * dt;
    this.flap.rotation.x = this.angle;
    this.lamp.emissiveIntensity = damp(this.lamp.emissiveIntensity, this.closed ? 2.4 : 0, 12, dt);
  }
}

// ────────────────────────────── Dominoes ─────────────────────────────

const DOMINO_N = 7;
const DOMINO_COLORS = ['#e5533d', '#f08a3a', '#f2c230', '#5cb85c', '#2bb3a8', '#3f86d6', '#8a63c9'];
const D_H = 0.52;
const D_W = 0.1;
const D_X0 = -1.05;
const D_STEP = 0.3;
/** How far a domino tips before it hits the next one (and before the last one lands). */
const D_HIT = Math.asin(Math.min(1, (D_STEP - D_W) / D_H));
const D_LAST = 1.3;

/** A row of dominoes: push the first (finger, ball or wind) and the last one closes the circuit. Tap again to stand them up. */
export class Domino extends Part {
  readonly kind: PartKind = 'domino';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 1.45;
  wind = 0;
  windDir = new THREE.Vector3();
  private pieces: { g: THREE.Group; angle: number; v: number; falling: boolean }[] = [];
  private contact: THREE.MeshStandardMaterial;
  private resetting = 0;

  constructor() {
    super();
    const plate = basePlate(2.9, 1.3, 'домино');
    const rail = roundedBox(2.4, 0.04, 0.42, 0.02, '#e7dcc8', 0.6);
    rail.position.set(-0.05, PLATE_TOP, -0.15);
    this.body.add(plate, rail);
    const geo = new THREE.BoxGeometry(D_W, D_H, 0.34);
    geo.translate(-D_W / 2, D_H / 2, 0);
    for (let i = 0; i < DOMINO_N; i++) {
      const g = new THREE.Group();
      const piece = mesh(geo, mat(DOMINO_COLORS[i], 0.4));
      // Two white dots, like real dominoes.
      for (const y of [0.16, 0.36]) {
        const dot = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12), mat('#ffffff', 0.5), false);
        dot.rotation.z = Math.PI / 2;
        dot.position.set(0.002, y, 0);
        piece.add(dot);
      }
      g.add(piece);
      // Pivot on the front-bottom edge, so it tips towards +x.
      g.position.set(D_X0 + i * D_STEP, PLATE_TOP + 0.04, -0.15);
      this.pieces.push({ g, angle: 0, v: 0, falling: false });
      this.body.add(g);
    }
    // The brass contact the last domino lands on.
    this.contact = new THREE.MeshStandardMaterial({ color: C.brass, emissive: '#ffd36b', emissiveIntensity: 0, roughness: 0.3, metalness: 0.8 });
    const pad = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.4), this.contact);
    pad.position.set(D_X0 + (DOMINO_N - 1) * D_STEP + 0.35, PLATE_TOP + 0.04, -0.15);
    this.body.add(pad);
    this.addTerminal('a', 'none', 1.05, 0.38);
    this.addTerminal('b', 'none', -1.05, 0.38);
    this.pickable(plate, rail, ...this.pieces.map((p) => p.g));
  }

  windPoint(): THREE.Vector3 {
    return this.root.localToWorld(new THREE.Vector3(D_X0, 0, -0.15));
  }

  get standing() {
    return this.pieces.every((p) => !p.falling);
  }

  /** Push the first domino. */
  push() {
    if (!this.standing || this.resetting > 0) return;
    this.pieces[0].falling = true;
    this.pieces[0].v = 2.5;
  }

  ballHit() {
    this.push();
  }

  tap(): boolean {
    super.tap();
    if (this.standing) this.push();
    else if (this.pieces.every((p) => p.angle > 0.5)) {
      // All down: stand them up again.
      for (const p of this.pieces) {
        p.falling = false;
        p.v = 0;
      }
      this.resetting = 0.6;
      if (this.closed) {
        this.closed = false;
        this.wantsSolve = true;
      }
    }
    return true;
  }

  protected animate(dt: number) {
    if (this.wind > 0.35) this.push();
    this.resetting = Math.max(0, this.resetting - dt);
    this.pieces.forEach((p, i) => {
      const max = i === DOMINO_N - 1 ? D_LAST : D_HIT + 0.02 + (D_HIT * 0.2);
      if (p.falling) {
        // Gravity tips it faster the further it leans.
        p.v += (6 + Math.sin(p.angle) * 26) * dt;
        p.angle = Math.min(max, p.angle + p.v * dt);
        if (p.angle >= max) {
          if (p.v > 1) this.sounds.push({ kind: 'clack' });
          p.v = 0;
        }
        const next = this.pieces[i + 1];
        if (next && !next.falling && p.angle >= D_HIT) {
          next.falling = true;
          next.v = Math.max(1.5, p.v * 0.6);
        }
        if (i === DOMINO_N - 1 && p.angle >= max && !this.closed) {
          this.closed = true;
          this.wantsSolve = true;
          this.sounds.push({ kind: 'ding' });
          this.effects.push({ kind: 'sparks', at: this.root.localToWorld(new THREE.Vector3(D_X0 + (DOMINO_N - 1) * D_STEP + 0.35, PLATE_TOP + 0.1, -0.15)), n: 12, color: '#ffd36b' });
        }
      } else {
        p.angle = damp(p.angle, 0, 10, dt);
      }
      p.g.rotation.z = -p.angle;
    });
    this.contact.emissiveIntensity = damp(this.contact.emissiveIntensity, this.closed ? 1.6 : 0, 10, dt);
  }
}

// ─────────────────────────── The links ───────────────────────────

/** Light falling on every light sensor from everything that shines. */
function shine(parts: Part[]) {
  const sensors = parts.filter((p): p is LightSensor => p instanceof LightSensor);
  if (!sensors.length) return;
  const lights = parts.flatMap((p) => {
    const g = p.glowLight();
    return g ? [{ part: p, ...g }] : [];
  });
  for (const s of sensors) {
    const eye = s.eyePoint();
    let lux = 0;
    for (const l of lights) {
      if (l.part === s) continue;
      const d = l.at.distanceTo(eye);
      lux += Math.min(1.5, l.power) * Math.max(0, 1 - d / 5) ** 1.5;
    }
    s.sense(lux);
  }
}

const FRICTION = 1.5;
const BOUNCE = 0.45;
const LIMIT = 34;

/** Plate rectangle of a part in world units, roughly from its size. */
function plateHalf(p: Part) {
  const f = p.plateRect();
  const { x, z } = p.root.position;
  return { x0: x + f.x0, x1: x + f.x1, z0: z + f.z0, z1: z + f.z1 };
}

/** Roll every ball one step: friction, bumping into parts, fading out when still. */
function roll(parts: Part[], dt: number) {
  for (const l of parts) {
    if (!(l instanceof Launcher) || !l.ball) continue;
    const b = l.ball;
    const steps = Math.ceil((b.vel.length() * dt) / 0.08) || 1;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      b.pos.addScaledVector(b.vel, h);
      const sp = b.vel.length();
      if (sp > 0) b.vel.multiplyScalar(Math.max(0, sp - FRICTION * h) / sp);
      for (const p of parts) {
        const f = p.footprint();
        if (!f) continue;
        const { x, z } = p.root.position;
        const r = { x0: x + f.x0 - BALL_R, x1: x + f.x1 + BALL_R, z0: z + f.z0 - BALL_R, z1: z + f.z1 + BALL_R };
        if (b.pos.x < r.x0 || b.pos.x > r.x1 || b.pos.z < r.z0 || b.pos.z > r.z1) continue;
        // Its own launcher only stops it on the way back.
        if (p === l && b.hits.size === 0 && (b.mesh.userData.flown ?? 0) < 0.4) continue;
        // Out along the shallowest side, and bounce.
        const dx0 = b.pos.x - r.x0;
        const dx1 = r.x1 - b.pos.x;
        const dz0 = b.pos.z - r.z0;
        const dz1 = r.z1 - b.pos.z;
        const m = Math.min(dx0, dx1, dz0, dz1);
        if (m === dx0) {
          b.pos.x = r.x0;
          b.vel.x = -Math.abs(b.vel.x) * BOUNCE;
        } else if (m === dx1) {
          b.pos.x = r.x1;
          b.vel.x = Math.abs(b.vel.x) * BOUNCE;
        } else if (m === dz0) {
          b.pos.z = r.z0;
          b.vel.z = -Math.abs(b.vel.z) * BOUNCE;
        } else {
          b.pos.z = r.z1;
          b.vel.z = Math.abs(b.vel.z) * BOUNCE;
        }
        const last = b.hits.get(p) ?? -1;
        const now = performance.now();
        if (now - last > 600) {
          b.hits.set(p, now);
          p.ballHit();
          p.sounds.push({ kind: 'bonk' });
        }
      }
    }
    b.mesh.userData.flown = (b.mesh.userData.flown ?? 0) + dt;
    // Height: on the table, or on top of a plate it rolls over; a small hop out of the barrel.
    let floor = BALL_R;
    for (const p of parts) {
      const r = plateHalf(p);
      if (b.pos.x > r.x0 && b.pos.x < r.x1 && b.pos.z > r.z0 && b.pos.z < r.z1) floor = PLATE_TOP + BALL_R;
    }
    b.pos.y = b.pos.y > floor ? Math.max(floor, b.pos.y - dt * 3) : damp(b.pos.y, floor, 20, dt);
    const len = Math.hypot(b.pos.x, b.pos.z);
    if (len > LIMIT) b.vel.set(0, 0, 0);
    // Roll: turn about the axis across the motion.
    const v = b.vel.length();
    if (v > 0.01) {
      const axis = new THREE.Vector3(b.vel.z, 0, -b.vel.x).normalize();
      b.mesh.rotateOnWorldAxis(axis, (v * dt) / BALL_R);
    }
    b.mesh.position.copy(b.pos);
    b.still = v < 0.12 ? b.still + dt : 0;
    if (b.still > 1.2) {
      const k = Math.max(0, 1 - (b.still - 1.2) / 0.4);
      b.mesh.scale.setScalar(Math.max(0.001, k));
      if (k === 0) l.ballGone();
    }
  }
}

/** Every link between parts that is not a wire: light, balls. (Wind is in wind.ts.) */
export function interact(parts: Part[], dt: number) {
  shine(parts);
  roll(parts, dt);
}
