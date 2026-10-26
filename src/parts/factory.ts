// The factory's parts: gears that turn each other once their teeth meet
// (a motor gear drives them; a press takes the turning), and pipes that
// carry paint from a pump tank, end to end, into a paint booth. Neither is
// a wire: like the wind and the light (src/parts/wind.ts, chain.ts) they
// are links worked out every frame (`turnGears`, `runPipes`), and a gear or
// pipe let go near its partner lines itself up (`fitGear`, `fitPipe`).
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox } from './kit';
import { gearGeometry } from './mech';
import { glowFor, sprite } from './models';

/** Teeth meet when the centres are this close to the sum of the radii. */
const MESH_TOL = 0.35;
const GEAR_Y = PLATE_TOP + 0.35;
/** Axles this close are one shaft (a gear set on a bare motor or a machine). */
const AXLE_TOL = 0.25;

/** Something with a gear lying flat (its axle upright) that can turn or be turned. */
export interface Geared {
  gearR: number;
  /** Where its gear's axle is (world). */
  gearAt(out?: THREE.Vector3): THREE.Vector3;
  /** Turning now (radians a second, + anticlockwise seen from above), set by `turnGears`. */
  turn: number;
  /** It turns by itself (a motor with power): the others follow. */
  drive?(): number;
}

export const isGeared = (p: Part): p is Part & Geared => typeof (p as unknown as Geared).gearAt === 'function';

/** A flat gear on its axle, teeth round the rim. */
function gearMesh(r: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const teeth = Math.round(r * 14);
  const wheel = mesh(gearGeometry(teeth, r, 0.12), mat(color, 0.4, 0.25));
  wheel.rotation.x = -Math.PI / 2;
  const hub = mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.2, 16), mat(C.metal, 0.3, 0.8));
  // Spokes show it turning.
  for (let i = 0; i < 3; i++) {
    const spoke = mesh(new THREE.BoxGeometry(r * 1.4, 0.03, 0.07), mat(C.navy2, 0.5), false);
    spoke.rotation.y = (i / 3) * Math.PI;
    spoke.position.y = 0.07;
    g.add(spoke);
  }
  g.add(wheel, hub);
  return g;
}

/** A motor with a gear on top: with power it turns, and every gear meshed with it follows. */
export class GearMotor extends Part implements Geared {
  readonly kind: PartKind = 'gearMotor';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.1;
  readonly gearR = 0.6;
  turn = 0;
  private wheel: THREE.Group;
  private speed = 0;

  constructor() {
    super();
    const plate = basePlate(1.6, 1.4, 'мотор');
    const box = roundedBox(0.8, 0.3, 0.7, 0.08, C.teal, 0.45);
    box.position.set(0, PLATE_TOP + 0.15, -0.1);
    this.wheel = gearMesh(this.gearR, C.amber);
    this.wheel.position.set(0, GEAR_Y, -0.1);
    this.body.add(plate, box, this.wheel);
    this.addTerminal('a', 'plus', 0.6, 0.45);
    this.addTerminal('b', 'minus', -0.6, 0.45);
    this.pickable(plate, box);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 8 };
  }

  gearAt(out = new THREE.Vector3()) {
    return this.root.localToWorld(out.set(0, GEAR_Y, -0.1));
  }

  drive() {
    return this.speed;
  }

  protected animate(dt: number) {
    const l = this.state.level;
    this.speed = damp(this.speed, Math.abs(l) > 0.15 ? 2.2 * Math.sign(l) * Math.min(1.5, Math.abs(l)) : 0, 3, dt);
    this.wheel.rotation.y += this.turn * dt;
  }
}

/** A gear on a peg: no wires; it turns when its teeth meet a turning gear's. */
export class Gear extends Part implements Geared {
  readonly kind: PartKind;
  readonly elementKind: ElementKind = 'wire';
  readonly radius: number;
  readonly gearR: number;
  turn = 0;
  private wheel: THREE.Group;

  constructor(size: boolean | 'small' = false) {
    super();
    this.kind = size === 'small' ? 'smallGear' : size ? 'bigGear' : 'gear';
    this.gearR = size === 'small' ? 0.4 : size ? 1.0 : 0.6;
    this.radius = this.gearR + 0.2;
    const plate = basePlate(this.gearR * 2 + 0.2, this.gearR * 2 + 0.2);
    const peg = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 10), mat(C.metal, 0.3, 0.8));
    peg.position.set(0, PLATE_TOP + 0.2, 0);
    this.wheel = gearMesh(this.gearR, size === 'small' ? '#4cc46a' : size ? '#e05a4a' : '#3f86d6');
    this.wheel.position.set(0, GEAR_Y, 0);
    this.body.add(plate, peg, this.wheel);
    this.pickable(plate, this.wheel);
  }

  elements(): CircuitElement[] {
    return [];
  }

  gearAt(out = new THREE.Vector3()) {
    return this.root.localToWorld(out.set(0, GEAR_Y, 0));
  }

  /** It is turning (a gear chain got through to it). */
  get spinning() {
    return Math.abs(this.turn) > 0.3;
  }

  protected animate(dt: number) {
    this.wheel.rotation.y += this.turn * dt;
  }
}

/** A press: its input gear, turned through a gear chain, works the ram up and down; each stroke stamps a toy. */
export class Press extends Part implements Geared {
  readonly kind: PartKind = 'press';
  readonly elementKind: ElementKind = 'wire';
  readonly radius = 1.6;
  readonly gearR = 0.6;
  turn = 0;
  /** Strokes so far. */
  stamps = 0;
  private wheel: THREE.Group;
  private ram: THREE.Group;
  private phase = 0;

  constructor() {
    super();
    const plate = basePlate(2.4, 1.6, 'пресс');
    const frame = mat('#5a6a7a', 0.45, 0.3);
    const posts = [-0.55, 0.55].map((x) => {
      const p = mesh(new THREE.BoxGeometry(0.18, 1.6, 0.4), frame);
      p.position.set(x + 0.4, PLATE_TOP + 0.8, -0.2);
      return p;
    });
    const top = mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), frame);
    top.position.set(0.4, PLATE_TOP + 1.65, -0.2);
    const anvil = roundedBox(0.8, 0.25, 0.6, 0.05, '#8a90a0', 0.5);
    anvil.position.set(0.4, PLATE_TOP + 0.13, -0.2);
    this.ram = new THREE.Group();
    const head = roundedBox(0.7, 0.3, 0.5, 0.05, C.red, 0.4);
    const rod = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 10), mat(C.metal, 0.3, 0.8));
    rod.position.y = 0.45;
    this.ram.add(head, rod);
    this.ram.position.set(0.4, PLATE_TOP + 1.2, -0.2);
    this.wheel = gearMesh(this.gearR, C.amber);
    this.wheel.position.set(-0.75, GEAR_Y, -0.2);
    this.body.add(plate, ...posts, top, anvil, this.ram, this.wheel);
    this.pickable(plate, top, anvil);
  }

  elements(): CircuitElement[] {
    return [];
  }

  gearAt(out = new THREE.Vector3()) {
    return this.root.localToWorld(out.set(-0.75, GEAR_Y, -0.2));
  }

  get working() {
    return Math.abs(this.turn) > 0.3;
  }

  protected animate(dt: number) {
    this.wheel.rotation.y += this.turn * dt;
    if (this.working) {
      const before = this.phase;
      this.phase = (this.phase + dt * 0.6) % 1;
      if (before < 0.5 && this.phase >= 0.5) {
        this.stamps++;
        this.sounds.push({ kind: 'clack' });
        this.effects.push({ kind: 'sparks', at: this.root.localToWorld(new THREE.Vector3(0.4, PLATE_TOP + 0.3, -0.2)), n: 8, color: '#ffd36b' });
      }
    }
    // Down fast, up slowly.
    const p = this.phase;
    const down = p < 0.5 ? 1 - (p / 0.5) ** 3 : (p - 0.5) / 0.5;
    this.ram.position.y = PLATE_TOP + 0.45 + down * 0.75;
  }
}

/** A straight piece of see-through pipe, 2 long. Tap to turn it a quarter round. Paint shows inside while it flows. */
export class Pipe extends Part {
  readonly kind: PartKind = 'pipe';
  readonly elementKind: ElementKind = 'wire';
  readonly radius = 1.1;
  /** 0: along x, 1: along z. */
  aim: 0 | 1 = 0;
  /** Paint is going through it now (set by `runPipes`). */
  flowing = false;
  private tube = new THREE.Group();
  private paint: THREE.Mesh;
  private fill = 0;

  constructor() {
    super();
    const plate = basePlate(0.9, 0.9);
    const glass = new THREE.MeshStandardMaterial({ color: '#dfeef5', roughness: 0.1, transparent: true, opacity: 0.45 });
    const pipe = mesh(new THREE.CylinderGeometry(0.2, 0.2, 2, 18, 1, true), glass, false);
    pipe.rotation.z = Math.PI / 2;
    (pipe.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const rims = [-1, 1].map((x) => {
      const r = mesh(new THREE.TorusGeometry(0.21, 0.05, 8, 18), mat(C.brass, 0.3, 0.8));
      r.rotation.y = Math.PI / 2;
      r.position.x = x * 0.97;
      return r;
    });
    this.paint = mesh(new THREE.CylinderGeometry(0.15, 0.15, 2, 14), new THREE.MeshStandardMaterial({ color: '#ff5fa8', emissive: '#ff5fa8', emissiveIntensity: 0.25, roughness: 0.3 }), false);
    this.paint.rotation.z = Math.PI / 2;
    this.paint.scale.y = 0.001;
    const stand = mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), mat(C.navy2, 0.5));
    stand.position.y = -0.3;
    this.tube.add(pipe, ...rims, this.paint, stand);
    this.tube.position.y = PLATE_TOP + 0.5;
    this.body.add(plate, this.tube);
    this.pickable(plate, pipe);
  }

  elements(): CircuitElement[] {
    return [];
  }

  /** Its two open ends (world, at ground height). */
  ends(): [THREE.Vector3, THREE.Vector3] {
    const p = this.root.position;
    const d = this.aim === 0 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    return [p.clone().addScaledVector(d, -1).setY(0), p.clone().addScaledVector(d, 1).setY(0)];
  }

  tap(): boolean {
    super.tap();
    this.aim = this.aim === 0 ? 1 : 0;
    this.sounds.push({ kind: 'tick' });
    return false;
  }

  protected animate(dt: number) {
    this.tube.rotation.y = damp(this.tube.rotation.y, this.aim === 0 ? 0 : -Math.PI / 2, 12, dt);
    this.fill = damp(this.fill, this.flowing ? 1 : 0, 2.5, dt);
    this.paint.scale.y = Math.max(0.001, this.fill);
  }
}

/** A tank of paint with a pump: with power it pushes paint out of its spout into the pipes. */
export class PaintTank extends Part {
  readonly kind: PartKind = 'tank';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.3;
  private level = 0;
  private wheel: THREE.Mesh;

  constructor() {
    super();
    const plate = basePlate(1.8, 1.5, 'бак с краской');
    const tank = mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 22), mat('#ff8fc4', 0.35));
    tank.position.set(-0.2, PLATE_TOP + 0.6, -0.15);
    const band = mesh(new THREE.TorusGeometry(0.56, 0.04, 8, 24), mat(C.brass, 0.3, 0.8));
    band.rotation.x = Math.PI / 2;
    band.position.set(-0.2, PLATE_TOP + 0.9, -0.15);
    const spout = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 12), mat(C.brass, 0.3, 0.8));
    spout.rotation.z = Math.PI / 2;
    spout.position.set(0.55, PLATE_TOP + 0.5, -0.15);
    this.wheel = mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 14), mat(C.red, 0.4));
    this.wheel.position.set(-0.2, PLATE_TOP + 1.35, -0.15);
    this.wheel.rotation.x = Math.PI / 2;
    this.body.add(plate, tank, band, spout, this.wheel);
    this.addTerminal('a', 'none', 0.7, 0.5);
    this.addTerminal('b', 'none', -0.7, 0.5);
    this.pickable(plate, tank);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  get pumping() {
    return this.level > 0.5;
  }

  /** Where paint comes out (world, ground height): the first pipe's end goes here. */
  outlet(): THREE.Vector3 {
    return this.root.localToWorld(new THREE.Vector3(0.9, 0, -0.15)).setY(0);
  }

  protected animate(dt: number) {
    this.level = damp(this.level, Math.abs(this.state.level) > 0.15 ? 1 : 0, 4, dt);
    this.wheel.rotation.z += this.level * dt * 6;
  }
}

/** A paint booth: with power and paint coming in through its pipe, it sprays the toys. */
export class PaintBooth extends Part {
  readonly kind: PartKind = 'paintBooth';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.6;
  /** Paint reaches its inlet now (set by `runPipes`). */
  fed = false;
  private spray: THREE.Sprite[] = [];
  private on = 0;

  constructor() {
    super();
    const plate = basePlate(2.4, 1.6, 'покраска');
    const booth = roundedBox(1.6, 1.4, 1.1, 0.1, '#f4f1ea', 0.5);
    booth.position.set(0.2, PLATE_TOP + 0.7, -0.15);
    const stripe = mesh(new THREE.BoxGeometry(1.62, 0.18, 1.12), mat('#ff5fa8', 0.5));
    stripe.position.set(0.2, PLATE_TOP + 1.2, -0.15);
    const door = mesh(new THREE.PlaneGeometry(0.8, 0.8), mat('#2a3148', 0.3));
    door.position.set(0.2, PLATE_TOP + 0.55, 0.41);
    const inlet = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.4, 12), mat(C.brass, 0.3, 0.8));
    inlet.rotation.z = Math.PI / 2;
    inlet.position.set(-0.8, PLATE_TOP + 0.5, -0.15);
    const colors = ['rgba(255,95,168,0.9)', 'rgba(95,200,255,0.9)', 'rgba(255,220,80,0.9)'];
    for (let i = 0; i < 9; i++) {
      const s = sprite(glowFor(colors[i % 3]), 0.25);
      s.userData.t = i / 9;
      this.spray.push(s);
    }
    this.body.add(plate, booth, stripe, door, inlet, ...this.spray);
    this.addTerminal('a', 'none', 1.05, 0.6);
    this.addTerminal('b', 'none', -0.4, 0.6);
    this.pickable(plate, booth);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  /** Where the last pipe's end goes (world, ground height). */
  inlet(): THREE.Vector3 {
    return this.root.localToWorld(new THREE.Vector3(-1.0, 0, -0.15)).setY(0);
  }

  get painting() {
    return this.on > 0.5;
  }

  protected animate(dt: number) {
    this.on = damp(this.on, this.fed && Math.abs(this.state.level) > 0.15 ? 1 : 0, 4, dt);
    for (const s of this.spray) {
      s.userData.t = (s.userData.t + dt * 1.2) % 1;
      const t = s.userData.t as number;
      s.position.set(0.2 + Math.sin(t * 9 + s.id) * 0.4, PLATE_TOP + 1.5 - t * 0.9, -0.15 + Math.cos(t * 7 + s.id) * 0.3);
      s.material.opacity = this.on * (1 - t) * 0.9;
    }
  }
}

/** A robot arm: with power it swings to and fro, picking a toy off the line and putting it in a box. */
export class RobotArm extends Part {
  readonly kind: PartKind = 'robotArm';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.4;
  /** Toys moved so far. */
  moves = 0;
  private base = new THREE.Group();
  private upper = new THREE.Group();
  private claw = new THREE.Group();
  private t = 0;

  constructor() {
    super();
    const plate = basePlate(1.8, 1.6, 'робот');
    const foot = mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.25, 20), mat(C.navy2, 0.45));
    foot.position.set(0, PLATE_TOP + 0.12, -0.15);
    const lower = roundedBox(0.2, 1, 0.2, 0.05, '#f2c230', 0.45);
    lower.position.y = 0.5;
    this.upper.add(roundedBox(0.9, 0.16, 0.16, 0.04, '#f2c230', 0.45));
    this.upper.children[0].position.x = 0.45;
    this.upper.position.y = 1;
    const jaw = [-0.08, 0.08].map((z) => {
      const j = mesh(new THREE.BoxGeometry(0.06, 0.25, 0.04), mat(C.metal, 0.3, 0.8));
      j.position.set(0, -0.12, z);
      return j;
    });
    this.claw.add(...jaw);
    this.claw.position.x = 0.9;
    this.upper.add(this.claw);
    this.base.add(lower, this.upper);
    this.base.position.set(0, PLATE_TOP + 0.25, -0.15);
    this.body.add(plate, foot, this.base);
    this.addTerminal('a', 'none', 0.7, 0.55);
    this.addTerminal('b', 'none', -0.7, 0.55);
    this.pickable(plate, foot, lower);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  protected animate(dt: number) {
    if (Math.abs(this.state.level) > 0.15) {
      const before = this.t;
      this.t = (this.t + dt * 0.35) % 1;
      if (before < 0.5 && this.t >= 0.5) {
        this.moves++;
        this.sounds.push({ kind: 'tick' });
      }
    }
    // Round from the line to the box and back, dipping at each end.
    this.base.rotation.y = Math.sin(this.t * Math.PI * 2) * 1.4;
    this.upper.rotation.z = -0.3 - Math.abs(Math.cos(this.t * Math.PI * 2)) * 0.4;
  }
}

/** A packing machine: with power it folds a box shut round a toy and ties a bow, again and again. */
export class Packer extends Part {
  readonly kind: PartKind = 'packer';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.4;
  /** Boxes packed so far. */
  boxes = 0;
  private lids: THREE.Object3D[] = [];
  private bow: THREE.Object3D;
  private t = 0;

  constructor() {
    super();
    const plate = basePlate(1.8, 1.5, 'упаковка');
    const box = mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat('#c9a27a', 0.8));
    box.position.set(0, PLATE_TOP + 0.3, -0.15);
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      const lid = mesh(new THREE.BoxGeometry(0.4, 0.04, 0.8), mat('#d9b48a', 0.8));
      lid.position.x = -s * 0.2;
      hinge.add(lid);
      hinge.position.set(s * 0.4, PLATE_TOP + 0.6, -0.15);
      this.lids.push(hinge);
    }
    this.bow = mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 14), mat(C.red, 0.4));
    this.bow.position.set(0, PLATE_TOP + 0.7, -0.15);
    this.body.add(plate, box, ...this.lids, this.bow);
    this.addTerminal('a', 'none', 0.7, 0.5);
    this.addTerminal('b', 'none', -0.7, 0.5);
    this.pickable(plate, box);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  protected animate(dt: number) {
    if (Math.abs(this.state.level) > 0.15) {
      const before = this.t;
      this.t = (this.t + dt * 0.4) % 1;
      if (before < 0.6 && this.t >= 0.6) {
        this.boxes++;
        this.sounds.push({ kind: 'ding' });
      }
    }
    const shut = this.t < 0.6 ? this.t / 0.6 : 1;
    this.lids.forEach((l, i) => (l.rotation.z = (i ? 1 : -1) * (1 - shut) * 1.6));
    this.bow.visible = this.t >= 0.6;
  }
}

// ───────────────────────── The links ─────────────────────────

/** Turning spreads from every motor gear through the gears its teeth meet (each the other way, slower if bigger). */
export function turnGears(parts: Part[]) {
  const gears = parts.filter(isGeared) as (Part & Geared)[];
  if (!gears.length) return;
  for (const g of gears) g.turn = 0;
  const done = new Set<Part>();
  const queue: (Part & Geared)[] = [];
  for (const g of gears) {
    const d = g.drive?.() ?? 0;
    if (Math.abs(d) < 0.05) continue;
    g.turn = d;
    done.add(g);
    queue.push(g);
  }
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  while (queue.length) {
    const g = queue.shift()!;
    g.gearAt(a);
    for (const o of gears) {
      if (done.has(o)) continue;
      o.gearAt(b);
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      // On one axle (a gear set on a motor's or a machine's shaft): the same turning.
      if (d < AXLE_TOL) o.turn = g.turn;
      else if (g.gearR > 0 && o.gearR > 0 && Math.abs(d - (g.gearR + o.gearR)) <= MESH_TOL) o.turn = (-g.turn * g.gearR) / o.gearR;
      else continue;
      done.add(o);
      queue.push(o);
    }
  }
}

/** Paint runs from each pumping tank's spout along pipes laid end to end; a booth whose inlet it reaches is fed. */
export function runPipes(parts: Part[]) {
  const pipes = parts.filter((p): p is Pipe => p instanceof Pipe);
  const booths = parts.filter((p): p is PaintBooth => p instanceof PaintBooth);
  if (!pipes.length && !booths.length) return;
  for (const p of pipes) p.flowing = false;
  for (const b of booths) b.fed = false;
  for (const tank of parts) {
    if (!(tank instanceof PaintTank) || !tank.pumping) continue;
    let at = tank.outlet();
    for (let step = 0; step < 24; step++) {
      const booth = booths.find((b) => b.inlet().distanceTo(at) < 0.5);
      if (booth) {
        booth.fed = true;
        break;
      }
      const next = pipes.find((p) => !p.flowing && p.ends().some((e) => e.distanceTo(at) < 0.5));
      if (!next) break;
      next.flowing = true;
      const [e0, e1] = next.ends();
      at = e0.distanceTo(at) < e1.distanceTo(at) ? e1 : e0;
    }
  }
}

/** A gear let go near a gear: it slides to where the teeth meet. True if it moved. */
export function fitGear(part: Part, parts: Part[]): boolean {
  if (!isGeared(part) || (part as Part & Geared).drive) return false;
  const me = part as Part & Geared;
  const a = me.gearAt();
  // A bare shaft (gearR 0: a motor or machine without its own gear) takes a gear let go over it.
  for (const o of parts) {
    if (o === part || !isGeared(o) || o.gearR > 0) continue;
    const b = o.gearAt();
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < 0.9) {
      if (d < 0.05) return false;
      part.root.position.x += b.x - a.x;
      part.root.position.z += b.z - a.z;
      return true;
    }
  }
  let best: { o: Part & Geared; d: number } | null = null;
  for (const o of parts) {
    if (o === part || !isGeared(o)) continue;
    const b = o.gearAt();
    const d = Math.hypot(a.x - b.x, a.z - b.z) - (me.gearR + o.gearR);
    if (Math.abs(d) < 0.9 && (!best || Math.abs(d) < Math.abs(best.d))) best = { o, d };
  }
  if (!best || Math.abs(best.d) < 0.05) return false;
  const b = best.o.gearAt();
  const dir = new THREE.Vector3(a.x - b.x, 0, a.z - b.z).normalize();
  part.root.position.addScaledVector(dir, -best.d);
  return true;
}

/**
 * A pipe let go near an open end (a spout, a pipe's end, a booth's inlet)
 * lines up end to end, turned to fit; a tank or a booth let go near a
 * pipe's end moves so its spout or inlet meets it.
 */
export function fitPipe(part: Part, parts: Part[]): boolean {
  if (part instanceof PaintTank || part instanceof PaintBooth) {
    const mine = part instanceof PaintTank ? part.outlet() : part.inlet();
    let best: THREE.Vector3 | null = null;
    for (const o of parts) {
      if (!(o instanceof Pipe)) continue;
      for (const e of o.ends()) if (e.distanceTo(mine) < 1.6 && (!best || e.distanceTo(mine) < best.distanceTo(mine))) best = e;
    }
    if (!best || best.distanceTo(mine) < 0.05) return false;
    part.root.position.add(best.clone().sub(mine).setY(0));
    return true;
  }
  if (!(part instanceof Pipe)) return false;
  const open: THREE.Vector3[] = [];
  for (const o of parts) {
    if (o === part) continue;
    if (o instanceof PaintTank) open.push(o.outlet());
    if (o instanceof PaintBooth) open.push(o.inlet());
    if (o instanceof Pipe) open.push(...o.ends());
  }
  let best: { at: THREE.Vector3; aim: 0 | 1; end: number; d: number } | null = null;
  const p = part.root.position;
  for (const aim of [0, 1] as const) {
    const dir = aim === 0 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    for (const s of [-1, 1]) {
      const end = p.clone().addScaledVector(dir, s);
      for (const o of open) {
        const d = end.setY(0).distanceTo(o);
        if (d < 1.2 && (!best || d < best.d)) best = { at: o, aim, end: s, d };
      }
    }
  }
  if (!best) return false;
  part.aim = best.aim;
  const dir = best.aim === 0 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  p.copy(best.at).addScaledVector(dir, -best.end);
  return true;
}
