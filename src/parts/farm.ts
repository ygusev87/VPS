// Parts built into the farm map: a power pole, a solar panel, a water pump,
// a heater and a motorised gate. The pole, panel and gate are pinned to the
// map; the pump and heater come from the drawers like any other part.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { Part, type PartKind } from './base';
import { cellTexture } from './chain';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox, signDecal } from './kit';
import { glowFor, materialsOf, sprite } from './models';
import { model, tip } from './assets';

const wood = () => mat('#9a6a3e', 0.7);

// ─────────────────────────────── Pole ───────────────────────────────

/** The farm's mains: a wooden pole with wires to the edge of the map. Steady but not endless. */
export class Pole extends Part {
  readonly kind: PartKind = 'pole';
  readonly elementKind: ElementKind = 'battery';
  readonly radius = 1.1;
  private lamp: THREE.MeshStandardMaterial;

  constructor() {
    super();
    const plate = basePlate(1.9, 1.6, 'сеть');
    const pole = mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.4, 12), wood());
    pole.position.set(0, PLATE_TOP + 1.7, -0.3);
    const arm = mesh(new THREE.BoxGeometry(1.3, 0.1, 0.1), wood());
    arm.position.set(0, PLATE_TOP + 3.1, -0.3);
    const wooden: THREE.Object3D[] = [pole, arm];
    this.body.add(plate, pole, arm);
    for (const x of [-0.5, 0, 0.5]) {
      const ins = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 10), mat('#e8eef5', 0.2, 0.1));
      ins.position.set(x, PLATE_TOP + 3.23, -0.3);
      wooden.push(ins);
      this.body.add(ins);
    }
    // A grey box with the sockets the child wires to.
    const box = roundedBox(0.5, 0.42, 0.26, 0.05, '#8a93a6', 0.5);
    box.position.set(0, PLATE_TOP + 0.75, -0.14);
    this.lamp = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: '#3fe07a', emissiveIntensity: 2, roughness: 0.3 });
    const l = mesh(new THREE.SphereGeometry(0.05, 12, 8), this.lamp);
    l.position.set(0, PLATE_TOP + 0.85, 0);
    const bolt = sprite(glowFor('rgba(255,210,80,0.9)'), 0.01);
    this.body.add(box, l, bolt);
    const plus = signDecal('plus', C.red, 0.26);
    plus.position.set(0.62, PLATE_TOP + 0.005, 0.2);
    this.body.add(plus);
    this.addTerminal('a', 'plus', 0.62, 0.52);
    this.addTerminal('b', 'minus', -0.62, 0.52);
    const sculpt = model('pole', { height: 2.5, rotateY: Math.PI / 2 });
    if (sculpt) {
      // The sculpted pole has its own insulators and socket box; it stands at
      // the back of the board so it never hides the posts.
      for (const o of [...wooden, box]) o.visible = false;
      const back = new THREE.Box3().setFromObject(sculpt).min.z;
      sculpt.position.set(0, PLATE_TOP - 0.02, -0.78 - back);
      l.position.set(0, PLATE_TOP + 0.03, 0.15);
      this.body.add(sculpt);
      this.pickable(plate, sculpt);
    } else this.pickable(plate, pole, box);
  }

  protected electrical(): Partial<CircuitElement> {
    // About two gadgets' worth; more and it sags (the weak-battery hint shows).
    return { emf: 6, r: 3 };
  }

  protected animate(dt: number) {
    this.lamp.emissiveIntensity = damp(this.lamp.emissiveIntensity, 1.6 + Math.sin(this.time * 2) * 0.4, 6, dt);
  }
}

// ──────────────────────────── Solar panel ────────────────────────────

/** Makes electricity from sunshine: plenty by day, nothing at night. */
export class Solar extends Part {
  readonly kind: PartKind = 'solar';
  readonly elementKind: ElementKind = 'battery';
  readonly radius = 1.3;
  /** 0 at night .. 1 at noon (set by the map). */
  static sun = 1;
  private emf = 6;
  private sunMat: THREE.MeshStandardMaterial;

  constructor() {
    super();
    const plate = basePlate(2.2, 1.9, 'солнце');
    const panel = new THREE.Group();
    const frame = roundedBox(1.7, 0.06, 1.1, 0.03, '#d9dde4', 0.3);
    const cells = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: cellTexture(), roughness: 0.15, metalness: 0.4 }));
    cells.rotation.x = -Math.PI / 2;
    cells.position.y = 0.065;
    panel.add(frame, cells);
    panel.position.set(0, PLATE_TOP + 0.75, -0.25);
    panel.rotation.x = -0.6;
    const leg = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.75, 10), mat(C.metal, 0.3, 0.8));
    leg.position.set(0, PLATE_TOP + 0.37, -0.25);
    // A little sun badge that glows while it works.
    this.sunMat = new THREE.MeshStandardMaterial({ color: '#f2c230', emissive: '#ffcf3a', emissiveIntensity: 1.5, roughness: 0.4 });
    const sun = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 20), this.sunMat);
    sun.position.set(-0.7, PLATE_TOP + 0.02, 0.45);
    const sculpt = model('solar', { height: 1.5, rotateY: -Math.PI / 2 });
    if (sculpt) {
      // The sculpted panel tilts towards the viewer on its own stand.
      sculpt.position.set(0, PLATE_TOP - 0.02, -0.3);
      this.body.add(plate, sculpt, sun);
    } else this.body.add(plate, leg, panel, sun);
    const plus = signDecal('plus', C.red, 0.26);
    plus.position.set(0.72, PLATE_TOP + 0.005, 0.3);
    this.body.add(plus);
    this.addTerminal('a', 'plus', 0.72, 0.65);
    this.addTerminal('b', 'minus', -0.2, 0.65);
    if (sculpt) this.pickable(plate, sculpt);
    else this.pickable(plate, leg, panel);
  }

  protected electrical(): Partial<CircuitElement> {
    // At night it is simply off (an open circuit), so nothing flows back into it.
    return this.emf > 0.05 ? { emf: this.emf, r: 2.5 } : { emf: 0, r: 1e6 };
  }

  get volts() {
    return this.emf;
  }

  protected animate(dt: number) {
    const emf = 6.5 * Solar.sun;
    if (Math.abs(emf - this.emf) > 0.1 || (emf < 0.05) !== (this.emf < 0.05)) {
      this.emf = emf;
      this.wantsSolve = true;
    }
    this.sunMat.emissiveIntensity = damp(this.sunMat.emissiveIntensity, Solar.sun * 2, 4, dt);
  }
}

// ─────────────────────────────── Pump ───────────────────────────────

/** A water pump: with power it pours water from its spout (to the right). */
export class Pump extends Part {
  readonly kind: PartKind = 'pump';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.0;
  private wheel = new THREE.Group();
  private stream: THREE.Mesh;
  private drops: { m: THREE.Mesh; t: number }[] = [];
  private flow = 0;
  /** Where the water leaves the spout. */
  private spoutY = PLATE_TOP + 0.72;

  constructor() {
    super();
    const plate = basePlate(1.8, 1.5, 'насос');
    const tank = mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.7, 24), mat(C.red, 0.4));
    tank.position.set(-0.25, PLATE_TOP + 0.35, -0.2);
    const cap = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24), mat(C.navy2, 0.45));
    cap.position.set(-0.25, PLATE_TOP + 0.74, -0.2);
    const pipe = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.25, PLATE_TOP + 0.7, -0.2),
      new THREE.Vector3(0.2, PLATE_TOP + 1.0, -0.2),
      new THREE.Vector3(0.65, PLATE_TOP + 0.95, -0.2),
      new THREE.Vector3(0.85, PLATE_TOP + 0.75, -0.2),
    ]);
    const hose = mesh(new THREE.TubeGeometry(pipe, 24, 0.06, 10, false), mat('#3f86d6', 0.5));
    // The flywheel on the side spins while it pumps.
    for (let i = 0; i < 4; i++) {
      const spoke = mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), mat(C.metal, 0.3, 0.8));
      spoke.rotation.z = (i * Math.PI) / 4;
      this.wheel.add(spoke);
    }
    const rim = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), mat(C.navy2, 0.4));
    this.wheel.add(rim);
    this.wheel.position.set(-0.25, PLATE_TOP + 0.4, 0.2);
    const water = new THREE.MeshStandardMaterial({ color: '#4fb3e8', roughness: 0.1, transparent: true, opacity: 0 });
    this.stream = mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.7, 10, 1, true), water, false);
    this.stream.position.set(0.88, PLATE_TOP + 0.38, -0.2);
    const dropGeo = new THREE.SphereGeometry(0.04, 8, 6);
    for (let i = 0; i < 8; i++) {
      const m = mesh(dropGeo, new THREE.MeshStandardMaterial({ color: '#4fb3e8', roughness: 0.1 }), false);
      m.visible = false;
      this.drops.push({ m, t: i / 8 });
      this.body.add(m);
    }
    const sculpt = model('pump', { height: 1.05 });
    if (sculpt) {
      // The sculpted pump's spout (its +x end) pours where the code-built hose did.
      const spout = tip(sculpt, 'x', 1, 0.06);
      sculpt.position.set(0.9 - spout.x, PLATE_TOP - 0.02, -0.2 - spout.z);
      this.spoutY = PLATE_TOP - 0.02 + spout.y - 0.04;
      this.stream.scale.y = (this.spoutY - PLATE_TOP) / 0.7;
      this.stream.position.y = PLATE_TOP + (this.spoutY - PLATE_TOP) / 2;
      this.body.add(plate, sculpt, this.stream);
      this.pickable(plate, sculpt);
    } else {
      this.body.add(plate, tank, cap, hose, this.wheel, this.stream);
      this.pickable(plate, tank, hose);
    }
    this.addTerminal('a', 'none', 0.62, 0.5);
    this.addTerminal('b', 'none', -0.62, 0.5);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  get pumping() {
    return Math.abs(this.state.level) > 0.15;
  }

  /** Where the water lands (world), for filling a trough. */
  outlet(): THREE.Vector3 {
    return this.root.localToWorld(new THREE.Vector3(0.9, 0, -0.2));
  }

  protected animate(dt: number) {
    this.flow = damp(this.flow, this.pumping ? 1 : 0, 3, dt);
    this.wheel.rotation.z -= this.flow * 14 * dt;
    (this.stream.material as THREE.MeshStandardMaterial).opacity = this.flow * 0.7;
    this.stream.scale.x = this.stream.scale.z = 0.4 + this.flow * 0.6;
    for (const d of this.drops) {
      d.t = (d.t + dt * 1.6) % 1;
      d.m.visible = this.flow > 0.2;
      d.m.position.set(0.88 + d.t * 0.25 + Math.sin(d.t * 9 + d.m.id) * 0.04, this.spoutY - d.t * d.t * (this.spoutY - PLATE_TOP), -0.2 + Math.cos(d.t * 7 + d.m.id) * 0.06);
    }
  }
}

// ─────────────────────────────── Heater ───────────────────────────────

/** A little electric heater: its coils glow orange and warm what is near. */
export class Heater extends Part {
  readonly kind: PartKind = 'heater';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 0.95;
  private coils: THREE.MeshStandardMaterial;
  /** The sculpted radiator's materials: they blush orange when hot. */
  private shell: THREE.MeshStandardMaterial[] = [];
  private waves: THREE.Sprite[] = [];
  private shown = 0;

  constructor() {
    super();
    const plate = basePlate(1.7, 1.4, 'обогрев');
    this.coils = new THREE.MeshStandardMaterial({ color: '#5a3a2a', emissive: '#ff6a1a', emissiveIntensity: 0, roughness: 0.4 });
    const sculpt = model('heater', { width: 1.15, rotateY: -Math.PI / 2 });
    if (sculpt) {
      sculpt.position.set(0, PLATE_TOP, -0.2);
      this.shell = materialsOf(sculpt);
      for (const m of this.shell) {
        m.emissive.set('#ff5a1a');
        m.emissiveIntensity = 0;
      }
      for (let i = 0; i < 3; i++) {
        const w = sprite(glowFor('rgba(255,140,60,0.5)'), 0.6);
        w.userData.t = i / 3;
        this.waves.push(w);
        this.body.add(w);
      }
      this.body.add(plate, sculpt);
      this.addTerminal('a', 'none', 0.6, 0.45);
      this.addTerminal('b', 'none', -0.6, 0.45);
      this.pickable(plate, sculpt);
      return;
    }
    const box = roundedBox(0.95, 0.75, 0.42, 0.08, '#f6eddd', 0.45);
    box.position.set(0, PLATE_TOP + 0.4, -0.2);
    for (let i = 0; i < 4; i++) {
      const coil = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), this.coils);
      coil.rotation.z = Math.PI / 2;
      coil.position.set(0, PLATE_TOP + 0.2 + i * 0.13, 0.02);
      this.body.add(coil);
    }
    // The grille in front of the coils.
    for (let i = 0; i < 6; i++) {
      const bar = mesh(new THREE.BoxGeometry(0.02, 0.6, 0.02), mat(C.navy2, 0.4), false);
      bar.position.set(-0.36 + i * 0.145, PLATE_TOP + 0.4, 0.04);
      this.body.add(bar);
    }
    for (const x of [-0.35, 0.35]) {
      const foot = roundedBox(0.16, 0.06, 0.5, 0.02, C.navy2, 0.45);
      foot.position.set(x, PLATE_TOP + 0.03, -0.2);
      this.body.add(foot);
    }
    for (let i = 0; i < 3; i++) {
      const w = sprite(glowFor('rgba(255,140,60,0.5)'), 0.6);
      w.userData.t = i / 3;
      this.waves.push(w);
      this.body.add(w);
    }
    this.body.add(plate, box);
    this.addTerminal('a', 'none', 0.6, 0.45);
    this.addTerminal('b', 'none', -0.6, 0.45);
    this.pickable(plate, box);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 12 };
  }

  get warm() {
    return this.state.level > 0.2;
  }

  glowLight() {
    if (this.shown < 0.1) return null;
    return { at: this.root.localToWorld(new THREE.Vector3(0, PLATE_TOP + 0.5, 0.3)), color: new THREE.Color('#ff7a2a'), power: this.shown * 0.5 };
  }

  protected animate(dt: number) {
    // Coils warm up slowly and cool slowly, like real ones.
    this.shown = damp(this.shown, this.warm ? Math.min(1.3, this.state.level) : 0, 1.5, dt);
    this.coils.emissiveIntensity = this.shown * 3;
    for (const m of this.shell) m.emissiveIntensity = this.shown * 0.4;
    for (const w of this.waves) {
      w.userData.t = (w.userData.t + dt * 0.5) % 1;
      const t = w.userData.t as number;
      w.position.set(Math.sin(t * 8 + w.id) * 0.15, PLATE_TOP + 0.9 + t * 0.9, -0.1);
      w.material.opacity = this.shown * Math.sin(t * Math.PI) * 0.5;
    }
  }
}

// ─────────────────────────────── Gate ───────────────────────────────

/** The farm gate: its motor swings it open while it has power. */
export class Gate extends Part {
  readonly kind: PartKind = 'gate';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.8;
  /** 0 shut .. 1 wide open. */
  open = 0;
  private leaf = new THREE.Group();
  private gear: THREE.Mesh;

  constructor() {
    super();
    const plate = basePlate(1.4, 1.3, 'ворота');
    plate.position.x = -1.9;
    const w = wood();
    for (const x of [-1.6, 1.6]) {
      const post = mesh(new THREE.BoxGeometry(0.22, 1.4, 0.22), w);
      post.position.set(x, 0.7, -0.6);
      this.body.add(post);
    }
    // The gate leaf, hinged on the left post: two rails, slats and a diagonal brace.
    const span = 3.0;
    for (const y of [0.35, 0.95]) {
      const rail = mesh(new THREE.BoxGeometry(span, 0.12, 0.08), mat('#f6eddd', 0.6));
      rail.position.set(span / 2, y, 0);
      this.leaf.add(rail);
    }
    for (let i = 0; i <= 5; i++) {
      const slat = mesh(new THREE.BoxGeometry(0.1, 0.8, 0.07), mat('#f6eddd', 0.6));
      slat.position.set(0.1 + (i * (span - 0.2)) / 5, 0.65, 0);
      this.leaf.add(slat);
    }
    const brace = mesh(new THREE.BoxGeometry(Math.hypot(span, 0.6), 0.1, 0.07), mat(C.red, 0.5));
    brace.rotation.z = Math.atan2(0.6, span);
    brace.position.set(span / 2, 0.65, 0.02);
    this.leaf.add(brace);
    this.leaf.position.set(-1.5, 0, -0.6);
    // The motor box by the hinge, with a gear that turns.
    const motor = roundedBox(0.5, 0.45, 0.4, 0.06, C.navy2, 0.45);
    motor.position.set(-1.9, PLATE_TOP + 0.22, -0.1);
    this.gear = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), mat(C.amber, 0.4, 0.3));
    this.gear.rotation.x = Math.PI / 2;
    this.gear.position.set(-1.9, PLATE_TOP + 0.25, 0.13);
    this.body.add(plate, this.leaf, motor, this.gear);
    this.addTerminal('a', 'none', -1.4, 0.35);
    this.addTerminal('b', 'none', -2.4, 0.35);
    this.pickable(plate, motor, this.leaf);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  protected animate(dt: number) {
    const l = this.state.level;
    // Opens with power (a bit faster with more), stays where it is without.
    if (Math.abs(l) > 0.15) this.open = Math.min(1, this.open + dt * 0.35 * Math.min(1.5, Math.abs(l)));
    this.leaf.rotation.y = this.open * 1.45;
    this.gear.rotation.y += Math.abs(l) > 0.15 && this.open < 1 ? dt * 8 : 0;
  }
}
