// The city's parts: the tram's substation, pinned to the map like the
// farm's gate (wire it to a pole and the trams get their power), and the
// city's own devices, on the city's drawers and in free play.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox } from './kit';
import { glowFor, sprite } from './models';

/** A little booth with a lightning sign; a green lamp on its roof lights when it has power. */
export class Substation extends Part {
  readonly kind: PartKind = 'substation';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.5;
  private lamp: THREE.MeshStandardMaterial;
  private hum = 0;

  constructor() {
    super();
    const plate = basePlate(2.2, 1.8, 'подстанция');
    const booth = roundedBox(1.5, 1.4, 1.0, 0.1, C.teal, 0.45);
    booth.position.set(0, PLATE_TOP + 0.7, -0.3);
    const roof = roundedBox(1.7, 0.16, 1.2, 0.05, C.navy2, 0.5);
    roof.position.set(0, PLATE_TOP + 1.48, -0.3);
    // A yellow lightning bolt on the front.
    const bolt = new THREE.Shape([new THREE.Vector2(0.08, 0.32), new THREE.Vector2(-0.14, -0.02), new THREE.Vector2(0.0, -0.02), new THREE.Vector2(-0.08, -0.32), new THREE.Vector2(0.16, 0.06), new THREE.Vector2(0.02, 0.06)]);
    const sign = mesh(new THREE.ShapeGeometry(bolt), mat(C.amber, 0.4), false);
    sign.position.set(0, PLATE_TOP + 0.75, 0.21);
    this.lamp = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: '#3fe07a', emissiveIntensity: 0, roughness: 0.3 });
    const lamp = mesh(new THREE.SphereGeometry(0.12, 14, 10), this.lamp);
    lamp.position.set(0.5, PLATE_TOP + 1.66, -0.3);
    this.body.add(plate, booth, roof, sign, lamp);
    this.addTerminal('a', 'none', 0.75, 0.55);
    this.addTerminal('b', 'none', -0.75, 0.55);
    this.pickable(plate, booth);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  /** It has power (the trams can run). */
  get live() {
    return this.hum > 0.5;
  }

  protected animate(dt: number) {
    const on = Math.abs(this.state.level) > 0.15;
    this.hum = damp(this.hum, on ? 1 : 0, 4, dt);
    this.lamp.emissiveIntensity = damp(this.lamp.emissiveIntensity, on ? 2.2 + Math.sin(this.time * 3) * 0.4 : 0, 8, dt);
  }
}

// ───────────────────────── The city's own devices ─────────────────────────
// Each has its model drawn in code until it is sculpted; the moving part
// (arm, wheel, brushes, span, hook, ladder) is its own group.

const white = () => mat('#f4f1ea', 0.5);
const red = () => mat(C.red, 0.45);
const steel = () => mat('#9aa3ad', 0.35, 0.6);
const on = (l: number) => Math.abs(l) > 0.15;

/** A parking barrier: the striped arm goes up while there is power, and down again without. */
export class Barrier extends Part {
  readonly kind: PartKind = 'barrier';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.5;
  /** 0 down .. 1 up. */
  open = 0;
  private arm = new THREE.Group();

  constructor() {
    super();
    const plate = basePlate(1.5, 1.2, 'шлагбаум');
    const post = roundedBox(0.36, 0.9, 0.36, 0.06, C.navy2, 0.45);
    post.position.set(-0.4, PLATE_TOP + 0.45, -0.2);
    const lamp = mesh(new THREE.SphereGeometry(0.09, 12, 8), mat(C.amber, 0.3));
    lamp.position.set(-0.4, PLATE_TOP + 0.95, -0.2);
    for (let i = 0; i < 6; i++) {
      const seg = mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), i % 2 ? white() : red());
      seg.position.set(0.21 + i * 0.42, 0, 0);
      this.arm.add(seg);
    }
    this.arm.position.set(-0.3, PLATE_TOP + 0.75, -0.2);
    this.body.add(plate, post, lamp, this.arm);
    this.addTerminal('a', 'none', 0.55, 0.45);
    this.addTerminal('b', 'none', -0.55, 0.45);
    this.pickable(plate, post);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  protected animate(dt: number) {
    this.open = damp(this.open, on(this.state.level) ? 1 : 0, 2.5, dt);
    this.arm.rotation.z = this.open * 1.4;
  }
}

/** A Ferris wheel: turns with the current; its cabins hang straight. */
export class FerrisWheel extends Part {
  readonly kind: PartKind = 'ferris';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.7;
  private wheel = new THREE.Group();
  private cabins: THREE.Object3D[] = [];
  private turnV = 0;

  constructor() {
    super();
    const plate = basePlate(2.4, 1.5, 'колесо обозрения');
    const legs = [-0.5, 0.5].flatMap((z) =>
      [-0.7, 0.7].map((x) => {
        const leg = mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), mat(C.navy2, 0.45));
        leg.position.set(x / 2, PLATE_TOP + 0.9, z * 0.45 - 0.15);
        leg.rotation.z = -x * 0.35;
        return leg;
      }),
    );
    const R = 1.05;
    const rim = mesh(new THREE.TorusGeometry(R, 0.05, 8, 40), mat(C.teal, 0.4));
    this.wheel.add(rim);
    const colors = [C.red, C.amber, '#3f86d6', '#5cb85c', '#ff8fb1', '#b388ff', C.red, C.amber];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = mesh(new THREE.BoxGeometry(0.03, R, 0.03), white(), false);
      spoke.position.set((Math.cos(a) * R) / 2, (Math.sin(a) * R) / 2, 0);
      spoke.rotation.z = a - Math.PI / 2;
      this.wheel.add(spoke);
      const cabin = roundedBox(0.26, 0.22, 0.22, 0.05, colors[i], 0.45);
      const hang = new THREE.Group();
      cabin.position.y = -0.16;
      hang.add(cabin);
      hang.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      this.cabins.push(hang);
      this.wheel.add(hang);
    }
    const hub = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 14), mat(C.brass, 0.3, 0.7));
    hub.rotation.x = Math.PI / 2;
    this.wheel.add(hub);
    this.wheel.position.set(0, PLATE_TOP + 1.75, -0.15);
    this.body.add(plate, ...legs, this.wheel);
    this.addTerminal('a', 'none', 0.95, 0.5);
    this.addTerminal('b', 'none', -0.95, 0.5);
    this.pickable(plate, rim, hub);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 8 };
  }

  get spin() {
    return this.turnV;
  }

  protected animate(dt: number) {
    const l = this.state.level;
    this.turnV = damp(this.turnV, on(l) ? 0.7 * Math.sign(l) * Math.min(1.5, Math.abs(l)) : 0, 1.5, dt);
    this.wheel.rotation.z += this.turnV * dt;
    for (const c of this.cabins) c.rotation.z = -this.wheel.rotation.z + Math.sin(this.time * 2 + c.id) * 0.06 * Math.abs(this.turnV);
  }
}

/** A car wash: two tall brushes spin and water sprays while it runs. */
export class CarWash extends Part {
  readonly kind: PartKind = 'carWash';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.7;
  private brushes: THREE.Object3D[] = [];
  private spray: THREE.Sprite[] = [];
  private speed = 0;

  constructor() {
    super();
    const plate = basePlate(2.6, 1.6, 'автомойка');
    const frame = mat('#3f86d6', 0.45);
    const posts = [-1, 1].map((x) => {
      const p = mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), frame);
      p.position.set(x, PLATE_TOP + 0.75, -0.2);
      return p;
    });
    const beam = mesh(new THREE.BoxGeometry(2.3, 0.22, 0.4), frame);
    beam.position.set(0, PLATE_TOP + 1.55, -0.2);
    const sign = roundedBox(0.9, 0.3, 0.06, 0.04, C.amber, 0.4);
    sign.position.set(0, PLATE_TOP + 1.85, -0.05);
    for (const x of [-0.6, 0.6]) {
      const brush = new THREE.Group();
      const core = mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 14), mat('#e05a9a', 0.9));
      brush.add(core);
      for (let i = 0; i < 6; i++) {
        const stripe = mesh(new THREE.BoxGeometry(0.05, 1.2, 0.5), mat(i % 2 ? '#ff8fb1' : '#7fd3ff', 0.9), false);
        stripe.rotation.y = (i / 6) * Math.PI;
        brush.add(stripe);
      }
      brush.position.set(x, PLATE_TOP + 0.75, -0.2);
      this.brushes.push(brush);
    }
    for (let i = 0; i < 10; i++) {
      const s = sprite(glowFor('rgba(140,210,255,0.9)'), 0.22);
      s.userData.t = i / 10;
      this.spray.push(s);
    }
    this.body.add(plate, ...posts, beam, sign, ...this.brushes, ...this.spray);
    this.addTerminal('a', 'none', 1.05, 0.6);
    this.addTerminal('b', 'none', -1.05, 0.6);
    this.pickable(plate, beam, ...posts);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 8 };
  }

  get running() {
    return this.speed > 0.5;
  }

  protected animate(dt: number) {
    this.speed = damp(this.speed, on(this.state.level) ? 1 : 0, 3, dt);
    this.brushes.forEach((b, i) => (b.rotation.y += (i ? -1 : 1) * this.speed * 12 * dt));
    for (const s of this.spray) {
      s.userData.t = (s.userData.t + dt * 1.4) % 1;
      const t = s.userData.t as number;
      s.position.set(-0.8 + t * 1.6, PLATE_TOP + 1.4 - t * t * 1.1, -0.2 + Math.sin(t * 9 + s.id) * 0.25);
      s.material.opacity = this.speed * (1 - t) * 0.9;
    }
  }
}

/** A drawbridge: the span lifts while there is power (a boat can pass), and comes down without. */
export class Drawbridge extends Part {
  readonly kind: PartKind = 'drawbridge';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.9;
  /** 0 down .. 1 up. */
  up = 0;
  private span = new THREE.Group();

  constructor() {
    super();
    const plate = basePlate(1.3, 1.6, 'мост');
    plate.position.x = -1.6;
    const tower = roundedBox(0.5, 1.2, 0.5, 0.06, '#c9a27a', 0.6);
    tower.position.set(-1.6, PLATE_TOP + 0.6, -0.3);
    const roof = mesh(new THREE.ConeGeometry(0.42, 0.4, 4), red());
    roof.rotation.y = Math.PI / 4;
    roof.position.set(-1.6, PLATE_TOP + 1.4, -0.3);
    const deck = mesh(new THREE.BoxGeometry(3, 0.1, 1), mat('#a8774a', 0.75));
    deck.position.x = 1.5;
    for (const z of [-0.45, 0.45]) {
      const rail = mesh(new THREE.BoxGeometry(3, 0.25, 0.05), white());
      rail.position.set(1.5, 0.15, z);
      this.span.add(rail);
    }
    this.span.add(deck);
    this.span.position.set(-1.2, PLATE_TOP + 0.05, 0);
    this.body.add(plate, tower, roof, this.span);
    this.addTerminal('a', 'none', -1.15, 0.6);
    this.addTerminal('b', 'none', -2.05, 0.6);
    this.pickable(plate, tower);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  protected animate(dt: number) {
    this.up = damp(this.up, on(this.state.level) ? 1 : 0, 1.4, dt);
    this.span.rotation.z = this.up * 1.15;
  }
}

/** A tower crane for the building site: with power the hook takes a block up again and again. */
export class TowerCrane extends Part {
  readonly kind: PartKind = 'towerCrane';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.6;
  /** Blocks lifted to the top so far. */
  lifts = 0;
  private top = new THREE.Group();
  private hook = new THREE.Group();
  private cable: THREE.Mesh;
  private cycle = 0;

  constructor() {
    super();
    const plate = basePlate(1.6, 1.6, 'башенный кран');
    const yellow = '#f2c230';
    const mast = roundedBox(0.22, 2.6, 0.22, 0.04, yellow, 0.45);
    mast.position.set(-0.4, PLATE_TOP + 1.3, -0.3);
    const jib = roundedBox(2.4, 0.12, 0.14, 0.03, yellow, 0.45);
    jib.position.set(0.7, 0, 0);
    const counter = roundedBox(0.4, 0.3, 0.3, 0.04, '#8a90a0', 0.5);
    counter.position.set(-0.6, -0.1, 0);
    const cab = roundedBox(0.3, 0.26, 0.26, 0.05, C.red, 0.4);
    cab.position.set(0, -0.2, 0);
    this.top.add(jib, counter, cab);
    this.top.position.set(-0.4, PLATE_TOP + 2.65, -0.3);
    this.cable = mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 6), mat('#2a2f3a', 0.6), false);
    const block = roundedBox(0.36, 0.26, 0.36, 0.03, '#d8483c', 0.7);
    block.position.y = -0.18;
    this.hook.add(block);
    this.body.add(plate, mast, this.top, this.cable, this.hook);
    this.addTerminal('a', 'none', 0.6, 0.6);
    this.addTerminal('b', 'none', -0.6, 0.6);
    this.pickable(plate, mast);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  protected animate(dt: number) {
    if (on(this.state.level)) {
      const before = this.cycle;
      this.cycle = (this.cycle + dt * 0.25) % 1;
      if (before < 0.5 && this.cycle >= 0.5) {
        this.lifts++;
        this.sounds.push({ kind: 'ding' });
      }
    }
    // Up from the ground (0..0.5), swings round and down again (0.5..1).
    const c = this.cycle;
    const h = c < 0.5 ? c * 2 : 1 - (c - 0.5) * 2;
    this.top.rotation.y = Math.sin(c * Math.PI * 2) * 0.6;
    const x = 1.6;
    const y = PLATE_TOP + 0.3 + h * 1.9;
    const p = new THREE.Vector3(x, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.top.rotation.y).add(new THREE.Vector3(-0.4, 0, -0.3));
    this.hook.position.set(p.x, y, p.z);
    const len = PLATE_TOP + 2.6 - y;
    this.cable.scale.y = Math.max(0.01, len);
    this.cable.position.set(p.x, y + len / 2, p.z);
  }
}

/** A street lamp with its own light sensor: it lights up by itself once it gets dark (with power). */
export class DuskLamp extends Part {
  readonly kind: PartKind = 'duskLamp';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 0.9;
  /** How dark the map is (0 day .. 1 night), set by the map. */
  static dark = 0;
  private glass: THREE.MeshStandardMaterial;
  private halo: THREE.Sprite;
  private shown = 0;

  constructor() {
    super();
    const plate = basePlate(1.2, 1.2, 'фонарь');
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 10), mat(C.navy2, 0.45));
    pole.position.set(0, PLATE_TOP + 1.1, -0.2);
    const arm = mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), mat(C.navy2, 0.45));
    arm.position.set(0.22, PLATE_TOP + 2.15, -0.2);
    this.glass = new THREE.MeshStandardMaterial({ color: '#f7f2dc', emissive: '#ffd36b', emissiveIntensity: 0, roughness: 0.2 });
    const head = mesh(new THREE.SphereGeometry(0.17, 16, 10), this.glass);
    head.position.set(0.45, PLATE_TOP + 2.05, -0.2);
    const eye = mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#2a3148', 0.2));
    eye.position.set(0, PLATE_TOP + 1.4, -0.12);
    this.halo = sprite(glowFor('rgba(255,220,120,0.9)'), 1.6);
    this.halo.position.copy(head.position);
    this.body.add(plate, pole, arm, head, eye, this.halo);
    this.addTerminal('a', 'none', 0.45, 0.4);
    this.addTerminal('b', 'none', -0.45, 0.4);
    this.pickable(plate, pole, head);
  }

  /** It is shining now. */
  get lit() {
    return this.shown > 0.5;
  }

  glowLight() {
    if (this.shown < 0.05) return null;
    return { at: this.halo.getWorldPosition(new THREE.Vector3()), color: new THREE.Color('#ffd36b'), power: this.shown };
  }

  protected animate(dt: number) {
    const dark = Math.max(Part.night ? 1 : 0, DuskLamp.dark);
    this.shown = damp(this.shown, this.state.level > 0.12 && dark > 0.4 ? 1 : 0, 6, dt);
    this.glass.emissiveIntensity = this.shown * 3;
    this.halo.material.opacity = this.shown * 0.7;
  }
}

/** A neon sign: its four letters light up one after another while it has power. */
export class NeonSign extends Part {
  readonly kind: PartKind = 'neon';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.5;
  private letters: THREE.MeshStandardMaterial[] = [];
  private level = 0;

  constructor() {
    super();
    const plate = basePlate(2.3, 1, 'вывеска');
    const board = roundedBox(2, 0.7, 0.1, 0.05, '#1e2440', 0.5);
    board.position.set(0, PLATE_TOP + 1.05, -0.2);
    const legs = [-0.8, 0.8].map((x) => {
      const l = mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07), mat(C.navy2, 0.45));
      l.position.set(x, PLATE_TOP + 0.35, -0.2);
      return l;
    });
    ['#ff4fa0', '#4fe0ff', '#ffe04f', '#7dff6b'].forEach((c, i) => {
      const m = new THREE.MeshStandardMaterial({ color: '#2a2f45', emissive: c, emissiveIntensity: 0, roughness: 0.3 });
      this.letters.push(m);
      const letter = mesh(i % 2 ? new THREE.TorusGeometry(0.16, 0.045, 8, 20) : new THREE.BoxGeometry(0.1, 0.42, 0.06), m, false);
      letter.position.set(-0.68 + i * 0.45, PLATE_TOP + 1.05, -0.13);
      this.body.add(letter);
    });
    this.body.add(plate, board, ...legs);
    this.addTerminal('a', 'none', 1.0, 0.35);
    this.addTerminal('b', 'none', -1.0, 0.35);
    this.pickable(plate, board);
  }

  glowLight() {
    if (this.level < 0.05) return null;
    return { at: this.root.localToWorld(new THREE.Vector3(0, PLATE_TOP + 1.05, 0)), color: new THREE.Color('#ff7fd0'), power: this.level * 0.7 };
  }

  protected animate(dt: number) {
    this.level = damp(this.level, this.state.level > 0.12 ? 1 : 0, 8, dt);
    const n = Math.floor(this.time * 3) % 6;
    this.letters.forEach((m, i) => (m.emissiveIntensity = this.level * (n >= 4 || i <= n ? 2.6 : 0.4)));
  }
}

/** A fire engine's ladder: with power it rises and stretches out towards a roof. */
export class FireLadder extends Part {
  readonly kind: PartKind = 'ladder';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.6;
  /** 0 folded .. 1 fully up and out. */
  reach = 0;
  private boom = new THREE.Group();
  private outer = new THREE.Group();

  constructor() {
    super();
    const plate = basePlate(2.2, 1.2, 'лестница');
    const turn = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 16), red());
    turn.position.set(-0.7, PLATE_TOP + 0.1, -0.15);
    const ladder = (len: number) => {
      const g = new THREE.Group();
      for (const z of [-0.12, 0.12]) {
        const rail = mesh(new THREE.BoxGeometry(len, 0.05, 0.04), steel());
        rail.position.set(len / 2, 0, z);
        g.add(rail);
      }
      for (let i = 0; i < Math.round(len / 0.25); i++) {
        const rung = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.24), steel(), false);
        rung.position.set(0.12 + i * 0.25, 0, 0);
        g.add(rung);
      }
      return g;
    };
    this.boom.add(ladder(1.6));
    this.outer.add(ladder(1.5));
    this.outer.position.set(0.1, 0.05, 0);
    this.boom.add(this.outer);
    this.boom.position.set(-0.7, PLATE_TOP + 0.25, -0.15);
    this.body.add(plate, turn, this.boom);
    // Both posts at the plate's ends, so a finger on its middle moves the ladder rather than starting a wire.
    this.addTerminal('a', 'none', 0.95, 0.42);
    this.addTerminal('b', 'none', -1.0, 0.42);
    this.pickable(plate, turn);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  protected animate(dt: number) {
    if (on(this.state.level)) this.reach = Math.min(1, this.reach + dt * 0.3);
    this.boom.rotation.z = this.reach * 0.75;
    this.outer.position.x = 0.1 + this.reach * 1.3;
  }
}
