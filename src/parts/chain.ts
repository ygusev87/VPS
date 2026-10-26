// Chain-reaction parts: one thing sets off the next. A fan's wind turns a
// wind turbine that makes electricity; a lit lamp closes a light sensor; a
// launcher rolls a ball across the table that hits a target, knocks over
// dominoes, rings a drum. `interact()` runs the links between parts each frame.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { MAP_BOARD, Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox } from './kit';
import { glowFor, sprite } from './models';
import { boundsWhere, model, sizeOf, tip } from './assets';
import { traceBeam, type BeamBox, type BeamDisc } from './beam';
import { AMBIENT } from './wind';

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
    // The sculpted tower turns as a whole (its foot is round); the rotor sits on its shaft.
    const sculpt = model('windgen', { height: HUB_Y - PLATE_TOP + 0.25, rotateY: -Math.PI / 2 });
    if (sculpt) {
      this.rotor.position.copy(tip(sculpt, 'z', 1, 0.03)).add(new THREE.Vector3(0, 0, 0.05));
      this.head.add(sculpt, this.rotor);
      this.head.position.set(0, PLATE_TOP, -0.2);
    } else {
      this.rotor.position.z = 0.17;
      this.head.add(nacelle, this.rotor);
      this.head.position.set(0, HUB_Y, -0.2);
    }
    // Lamps on the plate: how much electricity the wind makes.
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: i < 3 ? '#3fe07a' : '#ffc21a', emissiveIntensity: 0, roughness: 0.3 });
      const lamp = mesh(new THREE.SphereGeometry(0.055, 14, 10), m);
      lamp.position.set(-0.27 + i * 0.18, PLATE_TOP + 0.04, 0.55);
      this.lamps.push(m);
      this.body.add(lamp);
    }
    this.body.add(plate, this.head);
    if (!sculpt) this.body.add(foot, tower);
    this.addTerminal('a', 'plus', 0.8, 0.72);
    this.addTerminal('b', 'minus', -0.8, 0.72);
    this.pickable(plate, this.head);
    if (!sculpt) this.pickable(foot, tower);
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
    housing.position.set(0, PLATE_TOP + 0.16, -0.2);
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
      this.triggered = 'world';
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
export function cellTexture(): THREE.Texture {
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
  color: string;
}

/** A little cannon: with power it shoots a ball, again and again. Tap to turn it. */
export class Launcher extends Part {
  readonly kind: PartKind = 'launcher';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.05;
  /** A tap on it is for it (it flips or turns), even where a wire lies over it. */
  controlAt(): boolean {
    return true;
  }
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
  private nextColor = '#e5533d';
  /** Height balls leave at. */
  private mouthY = BARREL_Y;

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
    this.loaded = mesh(new THREE.SphereGeometry(BALL_R, 20, 14), mat('#e5533d', 0.25, 0.1));
    const sculpt = model('cannon', { width: 1 });
    if (sculpt) {
      // Scale the sculpted cannon so its muzzle is where balls leave, turning about its foot.
      const h = sizeOf(sculpt).y;
      const foot = boundsWhere(sculpt, (v) => v.y < h * 0.15).getCenter(new THREE.Vector3());
      const mouth = tip(sculpt, 'x', 1, 0.08);
      const k = MOUTH / (mouth.x - foot.x);
      sculpt.scale.setScalar(k);
      sculpt.position.set(-foot.x * k, 0, -foot.z * k);
      this.mouthY = PLATE_TOP + mouth.y * k;
      this.barrel.add(sculpt);
      this.loaded.position.set(MOUTH - 0.1, mouth.y * k + 0.04, 0);
      this.turret.add(this.barrel, this.loaded);
    } else {
      this.barrel.add(tube, muzzle, back);
      this.barrel.position.y = BARREL_Y - PLATE_TOP;
      this.barrel.rotation.z = 0.12;
      this.loaded.position.set(MOUTH - 0.06, BARREL_Y - PLATE_TOP + 0.07, 0);
      this.turret.add(base, ring, yoke, this.barrel, this.loaded);
    }
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
    const pos = this.root.position.clone().add(new THREE.Vector3(0, this.mouthY + 0.05, -0.15)).addScaledVector(dir, MOUTH);
    const color = this.nextColor;
    const m = mesh(new THREE.SphereGeometry(BALL_R, 20, 14), mat(color, 0.25, 0.1));
    m.position.copy(pos);
    table.add(m);
    const speed = 3.6 + Math.min(1, this.state.level) * 1.6;
    this.ball = { mesh: m, pos, vel: dir.multiplyScalar(speed), still: 0, hits: new Map(), color };
    // Load the next ball in a new colour: the one in the barrel is the one that flies.
    this.nextColor = RAINBOW_BALL[(RAINBOW_BALL.indexOf(color) + 1 + Math.floor(Math.random() * 4)) % RAINBOW_BALL.length];
    this.loaded.material = mat(this.nextColor, 0.25, 0.1);
    this.loaded.visible = false;
    this.recoil = 1;
    this.sounds.push({ kind: 'launch' });
    this.effects.push({ kind: 'exhaust', at: pos.clone(), dir: this.direction() });
    this.effects.push({ kind: 'exhaust', at: pos.clone(), dir: this.direction() });
    // A small flash at the muzzle.
    this.effects.push({ kind: 'sparks', at: pos.clone(), n: 8, color: '#ffd36b' });
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
    stand.position.set(0, PLATE_TOP + 0.07, -0.15);
    const hinge = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 12), mat(C.brass, 0.3, 0.8));
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0, PLATE_TOP + 0.18, -0.15);
    const face = mat('#ffffff', 0.5);
    const disk = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 40), [mat('#d9d9d9', 0.5), new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.5 })] as unknown as THREE.Material);
    disk.rotation.x = Math.PI / 2;
    disk.position.y = TARGET_Y - PLATE_TOP - 0.18;
    const post = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 10), face);
    post.position.y = 0.2;
    // The face looks at the viewer; a hit from any side knocks it over backwards.
    const holder = new THREE.Group();
    const sculpt = model('target', { height: TARGET_Y - PLATE_TOP + 0.5, rotateY: -Math.PI / 2 });
    if (sculpt) {
      // The whole sculpted stand tips over about its foot.
      sculpt.position.y = -0.04;
      this.flap.add(sculpt);
      holder.position.set(0, PLATE_TOP + 0.04, -0.15);
      stand.visible = hinge.visible = false;
    } else {
      this.flap.add(post, disk);
      holder.position.set(0, PLATE_TOP + 0.18, -0.15);
    }
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
  ballHit(by: 'world' | 'finger' = 'world') {
    if (this.closed) {
      this.angleV -= 3;
      return;
    }
    this.triggered = by;
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
    } else this.ballHit('finger');
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
  /** A tap on it is for it (it flips or turns), even where a wire lies over it. */
  controlAt(): boolean {
    return true;
  }
  wind = 0;
  windDir = new THREE.Vector3();
  private pieces: { g: THREE.Group; angle: number; v: number; falling: boolean }[] = [];
  private contact: THREE.MeshStandardMaterial;
  private resetting = 0;

  constructor() {
    super();
    const plate = basePlate(2.9, 1.3, 'домино');
    const rail = roundedBox(2.4, 0.04, 0.42, 0.02, '#e7dcc8', 0.6);
    rail.position.set(-0.05, PLATE_TOP + 0.02, -0.15);
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
  push(by: 'world' | 'finger' = 'world') {
    if (!this.standing || this.resetting > 0) return;
    this.triggered = by;
    this.pieces[0].falling = true;
    this.pieces[0].v = 2.5;
  }

  ballHit() {
    this.push();
  }

  tap(): boolean {
    super.tap();
    if (this.standing) this.push('finger');
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
    // Laid out from a save as closed, but standing: the contact is open.
    if (this.closed && this.standing && this.resetting <= 0) {
      this.closed = false;
      this.wantsSolve = true;
    }
    // A fan's gust, not the map's steady breeze.
    if (this.wind - AMBIENT.strength > 0.35) this.push();
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

// ─────────────────────────────── Laser ───────────────────────────────

const BEAM_Y = PLATE_TOP + 0.32;
const BEAM_SEGS = 16;
const BEAM_COLOR = new THREE.Color('#ff2a1a').multiplyScalar(5);

/** A laser pointer on a turret: with power it shines a thin red beam. Tap to turn it. */
export class Laser extends Part {
  readonly kind: PartKind = 'laser';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 0.95;
  /** A tap on it is for it (it flips or turns), even where a wire lies over it. */
  controlAt(): boolean {
    return true;
  }
  /** 0..3: right, towards the viewer, left, away. */
  aim = 0;
  /** What the beam ends on now (set by `interact`). */
  hit: Part | null = null;
  private turret = new THREE.Group();
  private turn = 0;
  private lens: THREE.MeshStandardMaterial;
  private beam = new THREE.Group();
  private segs: THREE.Mesh[] = [];
  private spot: THREE.Sprite;
  private shown = 0;
  /** How far in front of the middle the beam starts. */
  private reach = 0.42;

  constructor() {
    super();
    const plate = basePlate(1.7, 1.5, 'лазер');
    const base = mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 28), mat(C.navy2, 0.45));
    base.position.y = 0.06;
    const body = roundedBox(0.62, 0.22, 0.26, 0.06, '#d9dde4', 0.3);
    body.geometry.translate(0.06, 0, 0);
    body.position.y = BEAM_Y - PLATE_TOP;
    const stripe = roundedBox(0.2, 0.235, 0.27, 0.03, C.red, 0.4);
    stripe.position.set(-0.12, BEAM_Y - PLATE_TOP, 0);
    this.lens = new THREE.MeshStandardMaterial({ color: '#5a1010', emissive: '#ff2a1a', emissiveIntensity: 0, roughness: 0.15 });
    const lens = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 20), this.lens);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.39, BEAM_Y - PLATE_TOP, 0);
    // A yellow warning triangle on the side.
    const warn = mesh(new THREE.ConeGeometry(0.06, 0.02, 3), mat('#f2c230', 0.5), false);
    warn.rotation.x = Math.PI / 2;
    warn.position.set(0.12, BEAM_Y - PLATE_TOP, 0.135);
    const sculpt = model('laser', { height: 1 });
    if (sculpt) {
      // Scale the sculpted box so its lens (the far +x end) is at beam height.
      const h = sizeOf(sculpt).y;
      const eye = tip(sculpt, 'x', 1, 0.03, (v) => v.y > h * 0.3 && v.y < h * 0.8);
      const k = (BEAM_Y - PLATE_TOP) / eye.y;
      sculpt.scale.setScalar(k);
      this.reach = eye.x * k + 0.02;
      lens.position.set(this.reach - 0.02, BEAM_Y - PLATE_TOP, eye.z * k);
      this.turret.add(sculpt, lens);
    } else this.turret.add(base, body, stripe, lens, warn);
    this.turret.position.set(0, PLATE_TOP, -0.15);
    const segGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8, 1, true);
    segGeo.rotateZ(Math.PI / 2);
    segGeo.translate(0.5, 0, 0);
    for (let i = 0; i < BEAM_SEGS; i++) {
      const m = new THREE.Mesh(segGeo, new THREE.MeshBasicMaterial({ color: BEAM_COLOR, transparent: true, opacity: 0.9, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 6;
      this.segs.push(m);
      this.beam.add(m);
    }
    this.spot = sprite(glowFor('rgba(255,60,40,1)'), 0.7);
    this.beam.add(this.spot);
    this.body.add(plate, this.turret);
    this.addTerminal('a', 'none', 0.6, 0.5);
    this.addTerminal('b', 'none', -0.6, 0.5);
    this.pickable(plate, this.turret);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 15 };
  }

  get powered() {
    return this.state.level > 0.2;
  }

  direction(): [number, number] {
    const a = AIMS[this.aim];
    return [Math.cos(a), -Math.sin(a)];
  }

  /** Where the beam leaves the lens (world x/z). */
  muzzle(): [number, number] {
    const [dx, dz] = this.direction();
    const p = this.root.position;
    return [p.x + dx * this.reach, p.z - 0.15 + dz * this.reach];
  }

  tap(): boolean {
    super.tap();
    this.aim = (this.aim + 1) % 4;
    this.sounds.push({ kind: 'tick' });
    return false;
  }

  /** Draw the beam along these corners (world x/z), or hide it. */
  show(pts: [number, number][] | null) {
    if (!this.beam.parent && this.root.parent) this.root.parent.add(this.beam);
    const on = !!pts && this.shown > 0.05;
    this.segs.forEach((m, i) => {
      const a = pts?.[i];
      const b = pts?.[i + 1];
      m.visible = on && !!a && !!b;
      if (!m.visible || !a || !b) return;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      m.position.set(a[0], BEAM_Y, a[1]);
      m.scale.set(Math.max(0.001, len), 1, 1);
      m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * this.shown;
    });
    const end = pts?.at(-1);
    this.spot.visible = on && !!end;
    if (end) {
      this.spot.position.set(end[0], BEAM_Y, end[1]);
      this.spot.material.opacity = this.shown * (0.75 + Math.sin(this.time * 20) * 0.15);
    }
  }

  /** The beam does not belong to the part's body: take it off the table too. */
  dispose() {
    this.beam.removeFromParent();
    super.dispose();
  }

  protected animate(dt: number) {
    const goal = AIMS[this.aim];
    const diff = Math.atan2(Math.sin(goal - this.turn), Math.cos(goal - this.turn));
    this.turn += diff * Math.min(1, dt * 10);
    this.turret.rotation.y = this.turn;
    this.shown = damp(this.shown, this.powered && Math.abs(diff) < 0.05 ? 1 : 0, 20, dt);
    this.lens.emissiveIntensity = this.shown * 4;
  }
}

/** A mirror on a stand: it turns a laser beam a quarter round. Tap to flip it. No wires. */
export class Mirror extends Part {
  readonly kind: PartKind = 'mirror';
  readonly elementKind: ElementKind = 'wire';
  readonly radius = 0.75;
  /** A tap on it is for it (it flips or turns), even where a wire lies over it. */
  controlAt(): boolean {
    return true;
  }
  /** 0: "/" seen from above, 1: "\". */
  side: 0 | 1 = 0;
  private pane = new THREE.Group();
  private turn = Math.PI / 4;

  constructor() {
    super();
    const plate = basePlate(1.3, 1.3);
    // The sculpted mirror turns on its round foot; the glass gets a real shine on top.
    // The model's glass faces +x, turned a third of a right angle towards +z.
    const sculpt = model('mirror', { height: 1.3, rotateY: -Math.PI / 3 });
    if (sculpt) {
      // The frame is everything above the post; the glass fills its middle.
      const frame = boundsWhere(sculpt, (v) => v.y > 0.52);
      const size = frame.getSize(new THREE.Vector3());
      const c = frame.getCenter(new THREE.Vector3());
      const glass = mesh(
        new THREE.PlaneGeometry(size.x * 0.74, size.y * 0.74),
        new THREE.MeshStandardMaterial({ color: '#e6eef5', roughness: 0.03, metalness: 1, envMapIntensity: 2.2 }),
        false,
      );
      glass.position.set(c.x, c.y, frame.max.z + 0.004);
      this.pane.add(sculpt, glass);
      this.pane.position.set(0, PLATE_TOP, -0.1);
      this.body.add(plate, this.pane);
      this.pickable(plate, this.pane);
      return;
    }
    const foot = mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 24), mat(C.navy2, 0.45));
    foot.position.set(0, PLATE_TOP + 0.04, -0.1);
    const glass = mesh(
      new THREE.BoxGeometry(0.62, 0.6, 0.03),
      new THREE.MeshStandardMaterial({ color: '#dfe9f2', roughness: 0.02, metalness: 1, envMapIntensity: 2 }),
    );
    glass.position.y = 0.36;
    const frame = mesh(new THREE.BoxGeometry(0.68, 0.66, 0.025), mat(C.teal, 0.4));
    frame.position.set(0, 0.36, -0.02);
    this.pane.add(glass, frame);
    this.pane.position.set(0, PLATE_TOP, -0.1);
    this.body.add(plate, foot, this.pane);
    this.pickable(plate, foot, this.pane);
  }

  elements(): CircuitElement[] {
    return [];
  }

  /** The small square around the glass that turns a beam (world). */
  beamBox(): BeamBox {
    const { x, z } = this.root.position;
    return { id: this.id, x0: x - 0.25, x1: x + 0.25, z0: z - 0.35, z1: z + 0.15, mirror: this.side };
  }

  tap(): boolean {
    super.tap();
    this.side = this.side === 0 ? 1 : 0;
    this.sounds.push({ kind: 'tick' });
    return false;
  }

  protected animate(dt: number) {
    // The glass lies along "/" or "\" (seen from above).
    const goal = this.side === 0 ? Math.PI / 4 : -Math.PI / 4;
    this.turn = damp(this.turn, goal, 12, dt);
    this.pane.rotation.y = this.turn;
  }
}

/** Every beam on the table, and what each one lights up. */
export function beams(parts: Part[]): Map<Part, number> {
  const lit = new Map<Part, number>();
  const lasers = parts.filter((p): p is Laser => p instanceof Laser);
  if (!lasers.length) return lit;
  const discs: BeamDisc[] = [];
  for (const l of parts) if (l instanceof Launcher && l.ball) discs.push({ id: 'ball', x: l.ball.pos.x, z: l.ball.pos.z, r: BALL_R });
  for (const laser of lasers) {
    if (!laser.powered) {
      laser.hit = null;
      laser.show(null);
      continue;
    }
    const path = tracePath(parts, laser, laser.aim, discs);
    laser.hit = parts.find((p) => p.id === path.hit) ?? null;
    if (laser.hit) lit.set(laser.hit, (lit.get(laser.hit) ?? 0) + 2);
    laser.show(path.pts);
  }
  return lit;
}

/** The beam a laser would make with these mirror sides (default: as they stand). */
export function tracePath(parts: Part[], laser: Laser, aim = laser.aim, discs: BeamDisc[] = [], sides?: Map<Mirror, 0 | 1>) {
  const boxes: BeamBox[] = [];
  for (const p of parts) {
    if (p === laser) continue;
    if (p instanceof Mirror) {
      const b = p.beamBox();
      if (sides?.has(p)) b.mirror = sides.get(p);
      boxes.push(b);
      continue;
    }
    const raw = p.footprint();
    if (!raw) continue;
    const f = p.turned(raw);
    const { x, z } = p.root.position;
    boxes.push({ id: p.id, x0: x + f.x0, x1: x + f.x1, z0: z + f.z0, z1: z + f.z1 });
  }
  const a = AIMS[aim];
  const [ox, oz] = (() => {
    const p = laser.root.position;
    return [p.x + Math.cos(a) * 0.42, p.z - 0.15 - Math.sin(a) * 0.42];
  })();
  return traceBeam(ox, oz, Math.cos(a), -Math.sin(a), boxes, discs);
}

/**
 * How to get a beam onto this sensor: the laser's aim and the mirror sides
 * (only those that change), trying every combination. Null if no way.
 */
export function aimFor(parts: Part[], laser: Laser, target: Part): { aim: number; flip: Mirror[] } | null {
  const mirrors = parts.filter((p): p is Mirror => p instanceof Mirror).slice(0, 6);
  let best: { aim: number; flip: Mirror[] } | null = null;
  for (let aim = 0; aim < 4; aim++) {
    for (let mask = 0; mask < 1 << mirrors.length; mask++) {
      const sides = new Map<Mirror, 0 | 1>();
      const flip: Mirror[] = [];
      mirrors.forEach((m, i) => {
        const s = ((mask >> i) & 1) as 0 | 1;
        sides.set(m, s);
        if (s !== m.side) flip.push(m);
      });
      if (tracePath(parts, laser, aim, [], sides).hit !== target.id) continue;
      const cost = flip.length + (aim === laser.aim ? 0 : 1);
      if (!best || cost < best.flip.length + (best.aim === laser.aim ? 0 : 1)) best = { aim, flip };
    }
  }
  return best;
}

// ──────────────────────────── Electric bell ────────────────────────────

/** A school bell: with power the little hammer drums on the dome. A ball makes it ring once. */
export class Bell extends Part {
  readonly kind: PartKind = 'bell';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 0.95;
  private hammer = new THREE.Group();
  private dome = new THREE.Group();
  private wobble = 0;

  constructor() {
    super();
    const plate = basePlate(1.7, 1.5, 'звонок');
    const board = roundedBox(0.9, 0.12, 0.5, 0.05, '#c98a4b', 0.6);
    board.position.set(0, PLATE_TOP + 0.06, -0.15);
    const post = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10), mat(C.metal, 0.3, 0.8));
    post.position.set(0.15, PLATE_TOP + 0.37, -0.15);
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(new THREE.Vector2(0.36 * Math.sin((t * Math.PI) / 2) + 0.01, 0.3 * Math.cos((t * Math.PI) / 2)));
    }
    const domeMesh = mesh(new THREE.LatheGeometry(pts, 36), new THREE.MeshStandardMaterial({ color: '#e0b04a', roughness: 0.18, metalness: 0.9, side: THREE.DoubleSide }));
    const knob = mesh(new THREE.SphereGeometry(0.05, 12, 8), mat(C.metal, 0.3, 0.8));
    knob.position.y = 0.3;
    this.dome.add(domeMesh, knob);
    this.dome.position.set(0.15, PLATE_TOP + 0.62, -0.15);
    this.dome.rotation.z = Math.PI;
    // The coil box and the hammer arm reaching to the dome's rim.
    const coil = roundedBox(0.24, 0.2, 0.24, 0.05, C.navy2, 0.45);
    coil.position.set(-0.28, PLATE_TOP + 0.22, -0.15);
    const arm = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), mat(C.metal, 0.3, 0.8));
    arm.position.y = 0.25;
    const ball = mesh(new THREE.SphereGeometry(0.06, 14, 10), mat(C.red, 0.35));
    ball.position.y = 0.5;
    this.hammer.add(arm, ball);
    this.hammer.position.set(-0.28, PLATE_TOP + 0.3, -0.15);
    this.hammer.rotation.z = -0.35;
    const sculpt = model('bell', { height: 1.05 });
    if (sculpt) {
      // The sculpted bell has its own striker: the whole bell shivers as it rings.
      this.dome.clear();
      this.dome.add(sculpt);
      this.dome.position.set(0, PLATE_TOP - 0.02, -0.15);
      this.dome.rotation.z = 0;
      this.body.add(plate, this.dome);
      this.pickable(plate, this.dome);
    } else {
      this.body.add(plate, board, post, this.dome, coil, this.hammer);
      this.pickable(plate, board, this.dome, coil, this.hammer);
    }
    this.addTerminal('a', 'none', 0.6, 0.5);
    this.addTerminal('b', 'none', -0.6, 0.5);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 15 };
  }

  get ringing() {
    return this.state.level > 0.2;
  }

  ballHit() {
    this.wobble = 1;
    this.sounds.push({ kind: 'gong' });
  }

  tap(): boolean {
    super.tap();
    this.ballHit();
    return false;
  }

  protected animate(dt: number) {
    this.wobble = Math.max(0, this.wobble - dt * 2);
    const buzz = this.ringing ? Math.abs(Math.sin(this.time * 70)) : 0;
    this.hammer.rotation.z = -0.35 - buzz * 0.18 - this.wobble * Math.abs(Math.sin(this.time * 40)) * 0.15;
    const sway = (this.ringing ? 0.03 : 0) + this.wobble * 0.06;
    this.dome.rotation.x = Math.sin(this.time * 55) * sway;
  }
}

// ───────────────────────────── Magnet ──────────────────────────────

/** How far an electromagnet reaches for a ball, table units. */
const MAGNET_RANGE = 3.6;

/**
 * A red horseshoe electromagnet: with current it pulls rolling balls in and
 * holds them at its poles; switched off, the ball rolls on the way it came.
 * Tap to turn it a quarter round, like the launcher.
 */
export class Magnet extends Part {
  readonly kind: PartKind = 'magnet';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.0;
  aim = 0;
  /** The ball it holds and how fast that ball was going. */
  caught: { ball: Ball; vel: THREE.Vector3 } | null = null;
  /** Each ball's velocity when it came into reach. */
  readonly approach = new WeakMap<Ball, THREE.Vector3>();
  /** Seconds the current ball has been held, and whether it ever caught one. */
  heldFor = 0;
  everCaught = false;
  private head = new THREE.Group();
  private field: THREE.Mesh[] = [];
  private turn = 0;
  private pull = 0;

  constructor() {
    super();
    const plate = basePlate(1.8, 1.6, 'магнит');
    // Horseshoe: half a torus, legs pointing at the poles (+x in the head's frame).
    const red = mat('#d8483c', 0.4);
    const bend = mesh(new THREE.TorusGeometry(0.3, 0.13, 14, 28, Math.PI), red);
    bend.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    bend.position.x = -0.1;
    const legGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.42, 18);
    const steel = mat('#d9dde3', 0.25, 0.85);
    const tipGeo = new THREE.CylinderGeometry(0.135, 0.135, 0.14, 18);
    for (const z of [-0.3, 0.3]) {
      const leg = mesh(legGeo, red);
      leg.rotation.z = Math.PI / 2;
      leg.position.set(0.11, 0, z);
      const tip = mesh(tipGeo, steel);
      tip.rotation.z = Math.PI / 2;
      tip.position.set(0.39, 0, z);
      this.head.add(leg, tip);
    }
    // Copper coil wound round the bend.
    const copper = mat('#c98a4a', 0.35, 0.6);
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI * 0.8 + Math.PI * 0.1;
      const ring = mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 18), copper);
      ring.position.set(-0.1 - Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      ring.rotation.y = a;
      this.head.add(ring);
    }
    this.head.add(bend);
    // Field lines: faint arcs between the poles that brighten with current.
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(0.3 + i * 0.14, 0.012, 6, 32, Math.PI),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fd6ff').multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false }),
      );
      arc.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
      arc.position.x = 0.46;
      this.field.push(arc);
      this.head.add(arc);
    }
    const stand = roundedBox(0.5, 0.22, 0.9, 0.06, C.navy2, 0.5);
    stand.position.set(-0.2, PLATE_TOP + 0.11, -0.2);
    this.head.position.set(0, PLATE_TOP + 0.36, -0.2);
    const sculpt = model('magnet', { height: 1.0, rotateY: -Math.PI / 2 });
    if (sculpt) {
      // The sculpted horseshoe stands upright, arch to the viewer; balls stick at its +x side.
      for (const c of [...this.head.children]) if (!this.field.includes(c as THREE.Mesh)) c.removeFromParent();
      const front = new THREE.Box3().setFromObject(sculpt).max.x;
      sculpt.position.set(0.3 - front, -0.38, 0);
      this.head.add(sculpt);
      stand.visible = false;
    }
    this.body.add(plate, stand, this.head);
    this.addTerminal('a', 'none', 0.62, 0.5);
    this.addTerminal('b', 'none', -0.62, 0.5);
    this.pickable(plate, stand, this.head);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 12 };
  }

  get on() {
    return this.state.level > 0.2;
  }

  /** Where a ball sticks: just past the poles. */
  pole(out = new THREE.Vector3()) {
    const a = AIMS[this.aim];
    return out.set(this.root.position.x + Math.cos(a) * 0.95, PLATE_TOP + 0.36, this.root.position.z - 0.2 - Math.sin(a) * 0.95);
  }

  tap(): boolean {
    super.tap();
    this.aim = (this.aim + 1) % 4;
    this.sounds.push({ kind: 'tick' });
    this.letGo();
    return false;
  }

  /** Off: the ball rolls on as it was going. */
  letGo() {
    if (!this.caught) return;
    this.caught.ball.vel.copy(this.caught.vel);
    this.caught.ball.hits.delete(this);
    this.caught = null;
    this.sounds.push({ kind: 'marble' });
  }

  protected animate(dt: number) {
    const goal = AIMS[this.aim];
    const diff = Math.atan2(Math.sin(goal - this.turn), Math.cos(goal - this.turn));
    this.turn += diff * Math.min(1, dt * 10);
    this.head.rotation.y = this.turn;
    this.pull = damp(this.pull, this.on ? 1 : 0, 6, dt);
    this.field.forEach((f, i) => {
      const t = (this.time * 1.6 + i / 3) % 1;
      (f.material as THREE.MeshBasicMaterial).opacity = this.pull * (0.25 + 0.5 * Math.sin(t * Math.PI));
      f.scale.setScalar(0.9 + t * 0.25);
    });
    this.heldFor = this.caught ? this.heldFor + dt : 0;
    // A held ball trembles a little at the poles.
    this.head.position.x = this.caught ? Math.sin(this.time * 60) * 0.006 : 0;
    if (!this.on) this.letGo();
  }
}

/** Magnets reach for balls; a ball that touches a live magnet's poles is held. */
function attract(parts: Part[], b: Ball, dt: number): boolean {
  for (const m of parts) {
    if (!(m instanceof Magnet) || !m.on) continue;
    if (m.caught?.ball === b) {
      m.pole(b.pos);
      b.vel.set(0, 0, 0);
      b.still = 0;
      return true;
    }
    if (m.caught) continue;
    const p = m.pole(new THREE.Vector3());
    const dx = p.x - b.pos.x;
    const dz = p.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > MAGNET_RANGE) continue;
    // Remember how it was going before the pull, to send it on that way later.
    if (!m.approach.has(b)) m.approach.set(b, b.vel.clone());
    const speed = b.vel.length();
    if (d < 0.45 || d - speed * dt < 0.45) {
      const was = m.approach.get(b)!;
      m.caught = { ball: b, vel: was.lengthSq() > 0.25 ? was : new THREE.Vector3(Math.cos(AIMS[m.aim]), 0, -Math.sin(AIMS[m.aim])).multiplyScalar(4) };
      m.pole(b.pos);
      m.everCaught = true;
      b.vel.set(0, 0, 0);
      b.hits.set(m, performance.now());
      m.sounds.push({ kind: 'clack' });
      return true;
    }
    const power = Math.min(1, m.state.level);
    if (d < 1.7) {
      // Close in: steer straight for the poles (no slingshot round them).
      const want = Math.max(2.5, speed);
      const k = Math.min(1, dt * 8 * power);
      b.vel.x += ((dx / d) * want - b.vel.x) * k;
      b.vel.z += ((dz / d) * want - b.vel.z) * k;
    } else {
      const a = (7 * power) / d ** 1.2;
      b.vel.x += (dx / d) * a * dt;
      b.vel.z += (dz / d) * a * dt;
    }
  }
  return false;
}

// ─────────────────────────────── Belt ────────────────────────────────

const BELT_W = 2.3;
const BELT_D = 0.62;
const BELT_TOP = PLATE_TOP + 0.1;

function beltTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2a3148';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#3a4566';
  for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 6, 32);
  ctx.fillStyle = '#f2c230';
  // Chevrons show which way it runs.
  for (let x = 4; x < 128; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 8, 16);
    ctx.lineTo(x, 24);
    ctx.lineTo(x + 3, 24);
    ctx.lineTo(x + 11, 16);
    ctx.lineTo(x + 3, 8);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

/** A low belt: with power it carries a ball that rolls onto it, left to right (wires swapped: back). */
export class Belt extends Part {
  readonly kind: PartKind = 'belt';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.45;
  private tex = beltTexture();
  private rollers: THREE.Mesh[] = [];
  private flip: THREE.Mesh;
  /** A ball has ridden it at least once. */
  carried = false;
  /** Seconds it has been running. */
  running = 0;

  constructor() {
    super();
    const plate = basePlate(2.9, 1.3, 'транспортёр');
    const belt = mesh(new THREE.BoxGeometry(BELT_W, 0.05, BELT_D), [
      mat('#2a3148', 0.6),
      mat('#2a3148', 0.6),
      new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.7 }),
      mat('#2a3148', 0.6),
      mat('#2a3148', 0.6),
      mat('#2a3148', 0.6),
    ] as unknown as THREE.Material);
    belt.position.set(0, BELT_TOP - 0.025, -0.1);
    this.body.add(plate, belt);
    for (const x of [-BELT_W / 2, BELT_W / 2]) {
      const r = mesh(new THREE.CylinderGeometry(0.06, 0.06, BELT_D + 0.06, 16), mat(C.metal, 0.3, 0.8));
      r.rotation.x = Math.PI / 2;
      r.position.set(x, BELT_TOP - 0.05, -0.1);
      this.rollers.push(r);
      this.body.add(r);
    }
    // Low side rails keep the ball on (tall enough to see, too low to stop a ball).
    for (const z of [-0.1 - BELT_D / 2 - 0.04, -0.1 + BELT_D / 2 + 0.04]) {
      const rail = roundedBox(BELT_W, 0.05, 0.04, 0.015, C.teal, 0.45);
      rail.position.set(0, BELT_TOP + 0.03, z);
      this.body.add(rail);
    }
    // A small motor at the end, with a stripe that spins.
    const motor = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 18), mat(C.red, 0.4));
    motor.rotation.x = Math.PI / 2;
    motor.position.set(-BELT_W / 2, BELT_TOP - 0.02, -0.1 - BELT_D / 2 - 0.14);
    this.flip = mesh(new THREE.BoxGeometry(0.02, 0.16, 0.17), mat('#f2c230', 0.5), false);
    this.flip.position.copy(motor.position);
    this.body.add(motor, this.flip);
    this.addTerminal('a', 'none', 1.2, 0.42);
    this.addTerminal('b', 'none', -1.2, 0.42);
    this.pickable(plate, belt, motor);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  /** Belt speed along +x (world units per second), signed by the current. */
  get speed() {
    const l = Math.max(-1.6, Math.min(1.6, this.state.level));
    return Math.abs(l) > 0.15 ? l * 2 : 0;
  }

  /** The running surface (world rectangle). */
  surface() {
    const { x, z } = this.root.position;
    return { x0: x - BELT_W / 2, x1: x + BELT_W / 2, z0: z - 0.1 - BELT_D / 2, z1: z - 0.1 + BELT_D / 2, y: BELT_TOP };
  }

  protected animate(dt: number) {
    this.running = this.speed !== 0 ? this.running + dt : 0;
    this.tex.offset.x -= (this.speed / BELT_W) * 3 * dt;
    for (const r of this.rollers) r.rotation.y += (this.speed / 0.06) * dt;
    this.flip.rotation.z -= this.speed * 8 * dt;
  }
}

// ─────────────────────────── The links ───────────────────────────

/** Light falling on every light sensor from everything that shines. */
function shine(parts: Part[], laserLit: Map<Part, number>) {
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
      lux += Math.min(1.5, l.sense ?? l.power) * Math.max(0, 1 - d / 5) ** 1.5;
    }
    lux += laserLit.get(s) ?? 0;
    s.sense(lux);
  }
}

const FRICTION = 1.5;
const BOUNCE = 0.45;
/** Balls stop this far out on the workbench (on a map, at its board's edge). */
const LIMIT = 34;

/** Plate rectangle of a part in world units, roughly from its size. */
function plateHalf(p: Part) {
  const f = p.turned(p.plateRect());
  const { x, z } = p.root.position;
  return { x0: x + f.x0, x1: x + f.x1, z0: z + f.z0, z1: z + f.z1 };
}

/** Roll every ball one step: friction, bumping into parts, fading out when still. */
function roll(parts: Part[], dt: number) {
  for (const l of parts) {
    if (!(l instanceof Launcher) || !l.ball) continue;
    const b = l.ball;
    if (attract(parts, b, dt)) {
      b.mesh.position.copy(b.pos);
      continue;
    }
    const steps = Math.ceil((b.vel.length() * dt) / 0.08) || 1;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      b.pos.addScaledVector(b.vel, h);
      const sp = b.vel.length();
      if (sp > 0) b.vel.multiplyScalar(Math.max(0, sp - FRICTION * h) / sp);
      for (const p of parts) {
        const raw = p.footprint();
        if (!raw) continue;
        const f = p.turned(raw);
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
      // A running belt carries the ball along and keeps it in the middle.
      if (p instanceof Belt) {
        const s = p.surface();
        if (b.pos.x > s.x0 && b.pos.x < s.x1 && b.pos.z > s.z0 && b.pos.z < s.z1) {
          floor = s.y + BALL_R;
          p.carried = true;
          if (p.speed !== 0) {
            const k = Math.min(1, dt * 6);
            b.vel.x += (p.speed - b.vel.x) * k;
            // The rails catch a ball dropping in from the side.
            b.vel.z += (((s.z0 + s.z1) / 2 - b.pos.z) * 3 - b.vel.z) * Math.min(1, dt * 25);
          } else {
            b.vel.multiplyScalar(Math.max(0, 1 - dt * 4));
          }
        }
      }
    }
    b.pos.y = b.pos.y > floor ? Math.max(floor, b.pos.y - dt * 3) : damp(b.pos.y, floor, 20, dt);
    const len = Math.hypot(b.pos.x, b.pos.z);
    const edge = MAP_BOARD.half;
    if (edge ? Math.abs(b.pos.x) > edge.x - 0.5 || Math.abs(b.pos.z) > edge.z - 0.5 : len > LIMIT) b.vel.set(0, 0, 0);
    // Roll: turn about the axis across the motion.
    const v = b.vel.length();
    if (v > 0.01) {
      const axis = new THREE.Vector3(b.vel.z, 0, -b.vel.x).normalize();
      b.mesh.rotateOnWorldAxis(axis, (v * dt) / BALL_R);
    }
    b.mesh.position.copy(b.pos);
    if (v > 1) l.effects.push({ kind: 'trail', at: b.pos.clone(), color: b.color });
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
  const lit = beams(parts);
  shine(parts, lit);
  // A beam that ends on a balloon pops it.
  for (const p of lit.keys()) (p as Part & { laserHit?: () => void }).laserHit?.();
  roll(parts, dt);
}
