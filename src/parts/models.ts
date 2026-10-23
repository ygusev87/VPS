// The parts kit, modelled after the child's physical set: battery box,
// bulb, fan, switch, LED and buzzer. Everything is built from primitives so
// the whole kit ships as code, no model files.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { Part, type PartKind } from './base';
import { basePlate, damp, glowTexture, mat, mesh, raysTexture, roundedBox, signDecal } from './kit';

const PLATE_TOP = 0.24;

let warmGlow: THREE.Texture | null = null;
let redGlow: THREE.Texture | null = null;
let rays: THREE.Texture | null = null;
const tex = {
  get warm() {
    return (warmGlow ??= glowTexture('rgba(255,200,90,0.95)'));
  },
  get red() {
    return (redGlow ??= glowTexture('rgba(255,90,70,0.9)'));
  },
  get rays() {
    return (rays ??= raysTexture());
  },
};

function sprite(map: THREE.Texture, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }));
  s.scale.setScalar(size);
  s.renderOrder = 10;
  return s;
}

// ───────────────────────────── Battery ─────────────────────────────

export class Battery extends Part {
  readonly kind: PartKind = 'battery';
  readonly elementKind: ElementKind = 'battery';
  readonly radius = 1.55;
  private holderMat = mat(C.navy2, 0.5).clone();
  private lamp: THREE.Mesh;
  private lampMat = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: C.teal, emissiveIntensity: 0 });
  private steam: THREE.Sprite[] = [];

  constructor() {
    super();
    const plate = basePlate(2.9, 1.8);
    const holder = mesh(new RoundedBoxGeometry(2.5, 0.42, 1.05, 4, 0.12), this.holderMat);
    holder.position.set(0, PLATE_TOP + 0.21, -0.25);

    const cells = new THREE.Group();
    for (const z of [-0.5, 0.0]) cells.add(aaCell(z));
    cells.position.y = PLATE_TOP + 0.47;
    cells.position.z = -0.25 + 0.25;

    this.lamp = mesh(new THREE.SphereGeometry(0.08, 16, 10), this.lampMat);
    this.lamp.position.set(-1.05, PLATE_TOP + 0.44, 0.15);

    const plus = signDecal('plus', C.red, 0.36);
    plus.position.set(0.45, PLATE_TOP + 0.005, 0.6);
    const minus = signDecal('minus', C.navy2, 0.36);
    minus.position.set(-0.45, PLATE_TOP + 0.005, 0.6);

    this.body.add(plate, holder, cells, this.lamp, plus, minus);
    this.addTerminal('a', 'plus', 1.0, 0.55);
    this.addTerminal('b', 'minus', -1.0, 0.55);
    this.pickable(plate, holder, cells);

    for (let i = 0; i < 4; i++) {
      const s = sprite(tex.warm, 0.5);
      s.material = s.material.clone();
      s.material.color.set('#ffffff');
      s.userData.t = i / 4;
      this.steam.push(s);
      this.body.add(s);
    }
  }

  protected animate(dt: number) {
    const working = Math.max(0, this.state.level);
    this.lampMat.emissiveIntensity = damp(this.lampMat.emissiveIntensity, working > 0.02 && !this.state.shorted ? 2.2 : 0, 8, dt);
    // Short circuit: the holder glows hot red and puffs of "steam" rise.
    const hot = this.state.shorted ? 0.6 + 0.4 * Math.sin(this.time * 9) : 0;
    this.holderMat.emissive.set(C.red);
    this.holderMat.emissiveIntensity = damp(this.holderMat.emissiveIntensity, hot * 0.9, 10, dt);
    for (const s of this.steam) {
      s.userData.t = (s.userData.t + dt * 0.7) % 1;
      const t = s.userData.t as number;
      s.position.set(Math.sin(t * 9 + s.id) * 0.4, PLATE_TOP + 0.7 + t * 1.6, -0.25);
      s.scale.setScalar(0.4 + t * 0.9);
      s.material.opacity = this.state.shorted ? Math.sin(t * Math.PI) * 0.7 : damp(s.material.opacity, 0, 6, dt);
    }
  }
}

function aaCell(z: number): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 28), mat(C.amber, 0.4, 0.1));
  body.rotation.z = Math.PI / 2;
  const band = mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.5, 28), mat(C.navy, 0.45));
  band.rotation.z = Math.PI / 2;
  band.position.x = -0.5;
  const nub = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), mat(C.metal, 0.3, 0.8));
  nub.rotation.z = Math.PI / 2;
  nub.position.x = 0.8;
  const spring = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16), mat(C.metal, 0.3, 0.8));
  spring.rotation.z = Math.PI / 2;
  spring.position.x = -0.79;
  g.add(body, band, nub, spring);
  g.position.z = z;
  return g;
}

// ────────────────────────────── Bulb ───────────────────────────────

export class Bulb extends Part {
  readonly kind: PartKind = 'bulb';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.15;
  private glassMat: THREE.MeshPhysicalMaterial;
  private filamentMat: THREE.MeshStandardMaterial;
  private glow: THREE.Sprite;
  private rays: THREE.Sprite;
  private light: THREE.PointLight;
  private shown = 0;

  constructor() {
    super();
    const plate = basePlate(2.0, 1.55);
    const socket = mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.32, 28), mat(C.navy2, 0.5));
    socket.position.set(0, PLATE_TOP + 0.16, -0.15);

    const screwPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const y = (i / 12) * 0.36;
      screwPts.push(new THREE.Vector2(0.27 + 0.025 * Math.sin(i * Math.PI), y));
    }
    const screw = mesh(new THREE.LatheGeometry(screwPts, 28), mat(C.metal, 0.3, 0.85));
    screw.position.set(0, PLATE_TOP + 0.32, -0.15);

    const glassProfile = [
      [0.26, 0],
      [0.28, 0.12],
      [0.42, 0.34],
      [0.6, 0.62],
      [0.64, 0.82],
      [0.58, 1.04],
      [0.4, 1.22],
      [0.001, 1.3],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: '#fffaf0',
      transparent: true,
      opacity: 0.34,
      roughness: 0.05,
      clearcoat: 1,
      emissive: '#ffd27a',
      emissiveIntensity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glass = mesh(new THREE.LatheGeometry(glassProfile, 40), this.glassMat, false);
    glass.position.set(0, PLATE_TOP + 0.66, -0.15);
    glass.renderOrder = 5;

    this.filamentMat = new THREE.MeshStandardMaterial({ color: '#6b5236', emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.5 });
    const fil = new THREE.Group();
    const supportGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6);
    for (const x of [-0.14, 0.14]) {
      const s = mesh(supportGeo, mat(C.metal, 0.4, 0.7), false);
      s.position.set(x, 0.28, 0);
      fil.add(s);
    }
    const coil: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const a = t * Math.PI * 2 * 7;
      coil.push(new THREE.Vector3(-0.14 + t * 0.28, 0.56 + Math.sin(a) * 0.035 + Math.sin(t * Math.PI) * 0.06, Math.cos(a) * 0.035));
    }
    fil.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 120, 0.014, 5), this.filamentMat, false));
    fil.position.set(0, PLATE_TOP + 0.66, -0.15);

    this.glow = sprite(tex.warm, 3);
    this.glow.position.set(0, PLATE_TOP + 1.25, -0.15);
    this.rays = sprite(tex.rays, 3.6);
    this.rays.position.copy(this.glow.position);
    this.rays.renderOrder = 9;
    this.light = new THREE.PointLight('#ffc46b', 0, 7, 1.6);
    this.light.position.copy(this.glow.position);

    this.body.add(plate, socket, screw, fil, glass, this.glow, this.rays, this.light);
    this.addTerminal('a', 'none', 0.66, 0.48);
    this.addTerminal('b', 'none', -0.66, 0.48);
    this.pickable(plate, socket, screw, glass);
  }

  protected animate(dt: number) {
    const target = Math.min(1.6, Math.max(0, this.state.level));
    // Filaments warm up fast and cool a little slower.
    this.shown = damp(this.shown, target, target > this.shown ? 9 : 5, dt);
    const b = this.shown;
    const flicker = b > 0.05 ? 1 + Math.sin(this.time * 31) * 0.015 : 1;
    this.filamentMat.emissiveIntensity = b * 6 * flicker;
    this.glassMat.emissiveIntensity = b * 0.9;
    this.glassMat.opacity = 0.34 + b * 0.35;
    this.glow.material.opacity = Math.min(1, b * 0.95);
    this.glow.scale.setScalar(2.2 + b * 1.6);
    this.rays.material.opacity = Math.min(0.7, Math.max(0, b - 0.25) * 0.95);
    this.rays.material.rotation += dt * 0.25;
    this.rays.scale.setScalar(3 + b * 1.2 + Math.sin(this.time * 2) * 0.1);
    this.light.intensity = b * 9;
  }
}

// ─────────────────────────────── Fan ───────────────────────────────

export class Fan extends Part {
  readonly kind: PartKind = 'fan';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.2;
  private rotor = new THREE.Group();
  private blur: THREE.Mesh;
  private speed = 0;
  private gusts: THREE.Mesh[] = [];

  constructor() {
    super();
    const plate = basePlate(2.0, 1.7);
    const stand = roundedBox(0.5, 1.15, 0.42, 0.1, C.navy2);
    stand.position.set(0, PLATE_TOP + 0.575, -0.3);
    const housing = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.72, 32), mat(C.metal, 0.3, 0.7));
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0, PLATE_TOP + 1.42, -0.3);
    const cap = mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.12, 32), mat(C.red, 0.45));
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, PLATE_TOP + 1.42, -0.68);
    const shaft = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), mat(C.metal, 0.3, 0.9));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, PLATE_TOP + 1.42, 0.15);

    const hub = mesh(new THREE.SphereGeometry(0.15, 20, 14), mat(C.red, 0.4));
    hub.scale.z = 0.8;
    this.rotor.add(hub);
    const bladeGeo = new THREE.SphereGeometry(1, 24, 12);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      const blade = mesh(bladeGeo, mat(C.teal, 0.45));
      blade.scale.set(0.24, 0.5, 0.04);
      blade.position.y = 0.55;
      blade.rotation.y = 0.45; // pitch
      arm.add(blade);
      arm.rotation.z = (i * Math.PI * 2) / 3;
      this.rotor.add(arm);
    }
    this.rotor.position.set(0, PLATE_TOP + 1.42, 0.3);

    this.blur = new THREE.Mesh(
      new THREE.CircleGeometry(1.08, 48),
      new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.blur.position.copy(this.rotor.position).setZ(0.31);

    const gustGeo = new THREE.TorusGeometry(0.5, 0.025, 4, 24, Math.PI * 0.6);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Mesh(gustGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      g.userData.t = i / 6;
      g.userData.a = (i * Math.PI * 2) / 6;
      this.gusts.push(g);
      this.body.add(g);
    }

    this.body.add(plate, stand, housing, cap, shaft, this.rotor, this.blur);
    this.addTerminal('a', 'none', 0.66, 0.52);
    this.addTerminal('b', 'none', -0.66, 0.52);
    this.pickable(plate, stand, housing, cap, this.rotor);
  }

  protected animate(dt: number) {
    const target = Math.max(-1.6, Math.min(1.6, this.state.level)) * 22;
    this.speed = damp(this.speed, target, Math.abs(target) > Math.abs(this.speed) ? 1.6 : 0.9, dt);
    this.rotor.rotation.z -= this.speed * dt;
    const mag = Math.abs(this.speed) / 22;
    (this.blur.material as THREE.MeshBasicMaterial).opacity = Math.min(0.22, mag * 0.22);
    for (const g of this.gusts) {
      g.userData.t = (g.userData.t + dt * (0.6 + mag)) % 1;
      const t = g.userData.t as number;
      const a = g.userData.a as number;
      g.position.set(Math.cos(a) * 0.35, PLATE_TOP + 1.42 + Math.sin(a) * 0.35, 0.5 + t * 2.4);
      g.rotation.z = a + this.time * 0.5;
      g.scale.setScalar(0.6 + t * 1.2);
      (g.material as THREE.MeshBasicMaterial).opacity = mag > 0.15 ? Math.sin(t * Math.PI) * 0.75 * Math.min(1, mag) : 0;
    }
  }

  /** Signed rotor speed, rad/s. */
  get spin() {
    return this.speed;
  }
}

// ───────────────────────────── Switch ──────────────────────────────

export class Switch extends Part {
  readonly kind: PartKind = 'switch';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 1.1;
  private lever = new THREE.Group();
  private angle = 0.55;
  private angleV = 0;
  private indicatorMat = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: C.teal, emissiveIntensity: 0, roughness: 0.4 });

  constructor() {
    super();
    const plate = basePlate(2.0, 1.45);
    const housing = roundedBox(1.15, 0.38, 0.7, 0.12, C.navy2);
    housing.position.set(0, PLATE_TOP + 0.19, -0.15);
    const slotM = roundedBox(0.75, 0.05, 0.22, 0.02, C.navy, 0.8);
    slotM.position.set(0, PLATE_TOP + 0.37, -0.15);

    const stick = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75, 14), mat(C.metal, 0.3, 0.8));
    stick.position.y = 0.375;
    const knob = mesh(new THREE.SphereGeometry(0.2, 24, 16), mat(C.red, 0.35));
    knob.position.y = 0.8;
    this.lever.add(stick, knob);
    this.lever.position.set(0, PLATE_TOP + 0.36, -0.15);

    const indicator = mesh(new THREE.SphereGeometry(0.09, 16, 10), this.indicatorMat);
    indicator.position.set(0.42, PLATE_TOP + 0.4, 0.1);

    this.body.add(plate, housing, slotM, this.lever, indicator);
    this.addTerminal('a', 'none', 0.66, 0.42);
    this.addTerminal('b', 'none', -0.66, 0.42);
    this.pickable(plate, housing, this.lever);
  }

  tap(): boolean {
    this.closed = !this.closed;
    this.angleV += this.closed ? -9 : 9;
    super.tap();
    return true;
  }

  protected animate(dt: number) {
    const target = this.closed ? -0.55 : 0.55;
    this.angleV += ((target - this.angle) * 260 - this.angleV * 16) * dt;
    this.angle += this.angleV * dt;
    this.lever.rotation.z = this.angle;
    this.indicatorMat.emissiveIntensity = damp(this.indicatorMat.emissiveIntensity, this.closed ? 2.4 : 0, 10, dt);
  }
}

// ────────────────────────────── LED ────────────────────────────────

export class Led extends Part {
  readonly kind: PartKind = 'led';
  readonly elementKind: ElementKind = 'led';
  readonly radius = 1.0;
  private domeMat: THREE.MeshPhysicalMaterial;
  private glow: THREE.Sprite;
  private light: THREE.PointLight;
  private shown = 0;

  constructor() {
    super();
    const plate = basePlate(1.75, 1.45);
    this.domeMat = new THREE.MeshPhysicalMaterial({
      color: C.red,
      transparent: true,
      opacity: 0.88,
      roughness: 0.15,
      clearcoat: 1,
      emissive: '#ff3b2a',
      emissiveIntensity: 0,
    });
    const dome = new THREE.Group();
    const rim = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 28), this.domeMat);
    rim.position.y = 0.035;
    const barrel = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 28), this.domeMat);
    barrel.position.y = 0.25;
    const top = mesh(new THREE.SphereGeometry(0.25, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat);
    top.position.y = 0.43;
    dome.add(rim, barrel, top);
    dome.position.set(0, PLATE_TOP + 0.55, -0.2);

    // Legs: the long one (+) on the right, like a real LED.
    const legMat = mat(C.metal, 0.3, 0.85);
    const legL = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), legMat);
    legL.position.set(-0.1, PLATE_TOP + 0.27, -0.2);
    const legR = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), legMat);
    legR.position.set(0.1, PLATE_TOP + 0.27, -0.2);
    const kink = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), legMat);
    kink.position.set(0.1, PLATE_TOP + 0.03, -0.1);

    // Copper traces from legs to the posts.
    const traceMat = mat('#c98a4a', 0.4, 0.5);
    const tr = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.07), traceMat, false);
    tr.position.set(0.33, PLATE_TOP + 0.01, 0.12);
    tr.rotation.y = -0.6;
    const tl = tr.clone();
    tl.position.x = -0.33;
    tl.rotation.y = 0.6;

    const plus = signDecal('plus', C.red, 0.3);
    plus.position.set(0.55, PLATE_TOP + 0.005, -0.25);

    this.glow = sprite(tex.red, 2.4);
    this.glow.position.set(0, PLATE_TOP + 0.85, -0.2);
    this.light = new THREE.PointLight('#ff5a46', 0, 5, 1.7);
    this.light.position.copy(this.glow.position);

    this.body.add(plate, dome, legL, legR, kink, tr, tl, plus, this.glow, this.light);
    this.addTerminal('a', 'plus', 0.55, 0.42);
    this.addTerminal('b', 'minus', -0.55, 0.42);
    this.pickable(plate, dome);
  }

  protected animate(dt: number) {
    const target = Math.min(1.4, this.state.level);
    this.shown = damp(this.shown, target, 14, dt);
    const b = this.shown;
    this.domeMat.emissiveIntensity = b * 2.6;
    this.glow.material.opacity = Math.min(0.95, b * 0.9);
    this.glow.scale.setScalar(1.6 + b * 1.2);
    this.light.intensity = b * 5;
  }
}

// ───────────────────────────── Buzzer ──────────────────────────────

export class Buzzer extends Part {
  readonly kind: PartKind = 'buzzer';
  readonly elementKind: ElementKind = 'buzzer';
  readonly radius = 1.05;
  private can: THREE.Group;
  private waves: THREE.Mesh[] = [];

  constructor() {
    super();
    const plate = basePlate(1.8, 1.45);
    this.can = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.5, 36), mat(C.navy, 0.55));
    body.position.y = 0.25;
    const lip = mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 36), mat(C.navy2, 0.5));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.5;
    const hole = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), mat('#05070d', 0.9));
    hole.position.y = 0.51;
    this.can.add(body, lip, hole);
    this.can.position.set(0, PLATE_TOP, -0.2);

    const plus = signDecal('plus', C.red, 0.3);
    plus.position.set(0.6, PLATE_TOP + 0.005, -0.25);

    const waveGeo = new THREE.TorusGeometry(0.5, 0.03, 6, 48);
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0, depthWrite: false }));
      w.rotation.x = Math.PI / 2;
      w.position.set(0, PLATE_TOP + 0.6, -0.2);
      w.userData.t = i / 3;
      this.waves.push(w);
      this.body.add(w);
    }

    this.body.add(plate, this.can, plus);
    this.addTerminal('a', 'plus', 0.6, 0.45);
    this.addTerminal('b', 'minus', -0.6, 0.45);
    this.pickable(plate, this.can);
  }

  get sounding() {
    return this.state.level > 0.2;
  }

  protected animate(dt: number) {
    const on = this.sounding;
    this.can.scale.setScalar(on ? 1 + Math.sin(this.time * 90) * 0.02 : 1);
    for (const w of this.waves) {
      w.userData.t = (w.userData.t + dt * 1.2) % 1;
      const t = w.userData.t as number;
      w.scale.setScalar(1 + t * 1.6);
      w.position.y = PLATE_TOP + 0.6 + t * 0.4;
      (w.material as THREE.MeshBasicMaterial).opacity = on ? (1 - t) * 0.85 : damp((w.material as THREE.MeshBasicMaterial).opacity, 0, 8, dt);
    }
  }
}

export function createPart(kind: PartKind): Part {
  switch (kind) {
    case 'battery':
      return new Battery();
    case 'bulb':
      return new Bulb();
    case 'fan':
      return new Fan();
    case 'switch':
      return new Switch();
    case 'led':
      return new Led();
    case 'buzzer':
      return new Buzzer();
  }
}

export const PART_KINDS: PartKind[] = ['battery', 'bulb', 'fan', 'switch', 'led', 'buzzer'];
