// The real factory's own parts (the owner's ask: harder, new mechanics, not
// the same wiring again). The wiring box: an open cabinet with a grid of
// tiles, each with a piece of copper on it; a tap turns a tile, and the box
// lets the current through only when the pieces join from its left post to
// its right one (src/parts/tiles.ts).
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { Part, type PartKind, type PlugShape } from './base';
import { model, type Fit } from './assets';
import { basePlate, damp, mat, mesh, PLATE_TOP } from './kit';
import type { Geared } from './factory';
import { flow, hintTile, makePuzzle, opens, turn, type Side, type TileGrid } from './tiles';

const TILE = 1;

/** The sculpted bodies of the factory's machines (Codex's GLBs, loaded with the factory). */
export const WORKSHOP_MODELS = ['factory-cabinet', 'lever-box', 'rail-cart', 'lathe', 'shaft-motor', 'safety-press', 'socket-board', 'hoist'];

/**
 * Swap code-built stand-ins for a sculpted body when its model has loaded:
 * the model stands at `at` (part-local) and the stand-ins go. Moving and
 * electric bits (tiles, levers, rams, dials, posts) stay code-built.
 */
function sculpt(part: Part, name: string, fit: Fit, at: THREE.Vector3, standIns: THREE.Object3D[]): THREE.Group | null {
  const m = model(name, fit);
  if (!m) return null;
  m.position.copy(at);
  for (const o of standIns) o.removeFromParent();
  part.body.add(m);
  return m;
}

export class WireBox extends Part {
  readonly kind: PartKind = 'wireBox';
  readonly elementKind: ElementKind = 'switch';
  readonly radius: number;
  grid: TileGrid;
  private tiles: THREE.Group[] = [];
  private strips: THREE.MeshStandardMaterial[] = [];
  private shown: number[] = [];
  private lamp: THREE.MeshStandardMaterial;

  constructor(size = 2, grid?: TileGrid) {
    super();
    this.grid = grid ?? makePuzzle(size, size);
    const { w, h } = this.grid;
    const half = { x: (w * TILE) / 2, z: (h * TILE) / 2 };
    this.radius = Math.max(half.x, half.z) + 0.9;
    const plate = basePlate(w * TILE + 1.6, h * TILE + 0.9);
    // The cabinet: a grey steel tray round the tiles, its door swung open to the north.
    const steel = mat('#8d97a3', 0.45, 0.6);
    const tray = mesh(new THREE.BoxGeometry(w * TILE + 0.24, 0.16, h * TILE + 0.24), steel);
    tray.position.y = PLATE_TOP + 0.08;
    const door = mesh(new THREE.BoxGeometry(w * TILE + 0.24, 0.6, 0.06), steel);
    door.position.set(0, PLATE_TOP + 0.3, -half.z - 0.2);
    const stripe = mesh(new THREE.BoxGeometry(w * TILE * 0.7, 0.12, 0.02), mat('#f5c33b', 0.5));
    stripe.position.set(0, PLATE_TOP + 0.42, -half.z - 0.16);
    // A lamp on the door lights when the way is open.
    this.lamp = new THREE.MeshStandardMaterial({ color: '#3a4250', emissive: '#7dff6b', emissiveIntensity: 0, roughness: 0.3 });
    const lamp = mesh(new THREE.SphereGeometry(0.1, 14, 10), this.lamp, false);
    lamp.position.set(half.x * 0.7, PLATE_TOP + 0.5, -half.z - 0.14);
    this.body.add(plate, tray, door, stripe, lamp);
    // The sculpted cabinet is the low tray; the open door with its stripe and lamp stays code-built.
    const body = sculpt(this, 'factory-cabinet', { width: w * TILE + 0.5 }, new THREE.Vector3(0, PLATE_TOP, -0.1), [tray]);
    this.grid.tiles.forEach((t, i) => {
      const g = this.tileMesh(t.shape === 'blank' ? [] : ([0, 1, 2, 3] as Side[]).filter((s) => opens({ shape: t.shape, turns: 0 }, s)));
      g.position.copy(this.cellAt(i));
      g.rotation.y = -t.turns * (Math.PI / 2);
      this.shown.push(t.turns);
      this.tiles.push(g);
      this.body.add(g);
    });
    // The posts at the way's two ends, just outside the tray.
    const inRow = Math.floor(this.grid.in.cell / w);
    const outRow = Math.floor(this.grid.out.cell / w);
    this.addTerminal('a', 'none', -half.x - 0.5, -half.z + (inRow + 0.5) * TILE);
    this.addTerminal('b', 'none', half.x + 0.5, -half.z + (outRow + 0.5) * TILE);
    this.pickable(plate, door, ...(body ? [body] : [tray]), ...this.tiles);
    this.closed = flow(this.grid).done;
  }

  /** A tile's centre, part-local. */
  cellAt(i: number): THREE.Vector3 {
    const { w, h } = this.grid;
    return new THREE.Vector3(((i % w) + 0.5) * TILE - (w * TILE) / 2, PLATE_TOP + 0.17, (Math.floor(i / w) + 0.5) * TILE - (h * TILE) / 2);
  }

  /** The tile under a point (world), or −1. */
  cellOf(point: THREE.Vector3): number {
    const p = this.root.worldToLocal(point.clone());
    const { w, h } = this.grid;
    const x = Math.floor((p.x + (w * TILE) / 2) / TILE);
    const z = Math.floor((p.z + (h * TILE) / 2) / TILE);
    return x < 0 || z < 0 || x >= w || z >= h ? -1 : z * w + x;
  }

  /** Where to point for the next tile to turn (part-local), or null when the way is open. */
  hintPoint(): THREE.Vector3 | null {
    const i = hintTile(this.grid);
    return i === null ? null : this.cellAt(i);
  }

  private tileMesh(sides: Side[]): THREE.Group {
    const g = new THREE.Group();
    const slab = mesh(new THREE.BoxGeometry(TILE - 0.06, 0.06, TILE - 0.06), mat('#2b3242', 0.7));
    const copper = new THREE.MeshStandardMaterial({ color: '#c7743e', roughness: 0.3, metalness: 0.75, emissive: '#ffb347', emissiveIntensity: 0 });
    this.strips.push(copper);
    g.add(slab);
    for (const s of sides) {
      const strip = mesh(new THREE.BoxGeometry(0.14, 0.05, TILE / 2), copper, false);
      // Drawn running north from the centre, then turned to its side.
      strip.position.set(0, 0.05, -TILE / 4);
      const arm = new THREE.Group();
      arm.add(strip);
      arm.rotation.y = -s * (Math.PI / 2);
      g.add(arm);
    }
    if (sides.length) {
      const hub = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14), copper, false);
      hub.position.y = 0.05;
      g.add(hub);
    }
    return g;
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return !!point && this.cellOf(point) >= 0;
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    const i = point ? this.cellOf(point) : -1;
    if (i < 0) return false;
    this.grid = turn(this.grid, i);
    const was = this.closed;
    this.closed = flow(this.grid).done;
    this.sounds.push({ kind: 'tick' });
    if (this.closed && !was) this.sounds.push({ kind: 'ding' });
    return true;
  }

  protected animate(dt: number) {
    const { lit } = flow(this.grid);
    const live = Math.abs(this.state.current) > 0.01;
    this.grid.tiles.forEach((t, i) => {
      // Turn smoothly the shortest way round to the tile's new quarter.
      const target = -t.turns * (Math.PI / 2);
      let cur = this.tiles[i].rotation.y;
      while (target - cur > Math.PI) cur += Math.PI * 2;
      while (cur - target > Math.PI) cur -= Math.PI * 2;
      this.tiles[i].rotation.y = damp(cur, target, 14, dt);
      // The joined pieces shine; with current through them they glow.
      this.strips[i].emissiveIntensity = damp(this.strips[i].emissiveIntensity, lit[i] ? (live ? 1.6 + Math.sin(this.time * 6 + i) * 0.3 : 0.35) : 0, 8, dt);
    });
    this.lamp.emissiveIntensity = damp(this.lamp.emissiveIntensity, this.closed ? 2.5 : 0, 8, dt);
  }
}

/**
 * The reversing switch: a three-way lever between a source and a motor —
 * right is forward, left is back (the current through the motor turns round),
 * the middle stops it. Inside, four contacts: forward joins + to a and − to b,
 * back joins + to b and − to a.
 */
export class Reverser extends Part {
  readonly kind: PartKind = 'reverser';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 1.6;
  /** −1 back, 0 stop, 1 forward. */
  pos: -1 | 0 | 1 = 0;
  private lever = new THREE.Group();
  private marks: THREE.MeshStandardMaterial[] = [];
  /** The arrows are glow over a sculpted lid (not a second painted set). */
  private overlay = false;

  constructor() {
    super();
    const plate = basePlate(2.6, 1.9);
    const box = mesh(new THREE.BoxGeometry(1.5, 0.35, 1.1), mat('#8d97a3', 0.45, 0.6));
    box.position.y = PLATE_TOP + 0.175;
    // Arrows on the box: back (left, orange), stop (middle, red), forward (right, green).
    const sign = (x: number, color: string, shape: THREE.BufferGeometry) => {
      const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1, roughness: 0.4 });
      this.marks.push(m);
      const s = mesh(shape, m, false);
      s.position.set(x, PLATE_TOP + 0.415, 0.3);
      this.body.add(s);
    };
    const arrow = (dir: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(0.16 * dir, 0);
      shape.lineTo(-0.1 * dir, 0.14);
      shape.lineTo(-0.1 * dir, -0.14);
      shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }).rotateX(-Math.PI / 2);
    };
    sign(-0.5, '#ff9a3c', arrow(-1));
    // A square stop, as on the sculpted lid.
    sign(0, '#e8483f', new THREE.BoxGeometry(0.2, 0.03, 0.2));
    sign(0.5, '#4cc46a', arrow(1));
    // The lever: a stubby handle on a pivot at the back, swinging over the arrows.
    const stick = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 12), mat('#2b3242', 0.4, 0.5));
    stick.rotation.x = Math.PI / 2 - 0.5;
    stick.position.set(0, 0.2, 0.3);
    const knob = mesh(new THREE.SphereGeometry(0.17, 16, 12), mat('#e8483f', 0.35));
    knob.position.set(0, 0.38, 0.62);
    this.lever.add(stick, knob);
    this.lever.position.set(0, PLATE_TOP + 0.35, -0.35);
    this.body.add(plate, box, this.lever);
    const body = sculpt(this, 'lever-box', { width: 1.5 }, new THREE.Vector3(0, PLATE_TOP, 0), [box]);
    // The sculpted lid has its own painted arrows: ours only light up over the chosen one.
    if (body) for (const m of this.marks) Object.assign(m, { transparent: true, opacity: 0, depthWrite: false });
    this.overlay = !!body;
    this.addTerminal('p', 'plus', -1.05, -0.45);
    this.addTerminal('n', 'minus', -1.05, 0.45);
    this.addTerminal('a', 'none', 1.05, -0.45);
    this.addTerminal('b', 'none', 1.05, 0.45);
    this.pickable(plate, body ?? box, this.lever);
  }

  elements(): CircuitElement[] {
    const t = (k: string) => this.terminal(k).id;
    const sw = (key: string, a: string, b: string, closed: boolean): CircuitElement => ({ id: `${this.id}#${key}`, kind: 'switch', a: t(a), b: t(b), closed });
    return [sw('f1', 'p', 'a', this.pos === 1), sw('f2', 'n', 'b', this.pos === 1), sw('r1', 'p', 'b', this.pos === -1), sw('r2', 'n', 'a', this.pos === -1)];
  }

  /** Part-local point of the arrow for a position (for the hand of a hint). */
  posPoint(pos: -1 | 0 | 1): THREE.Vector3 {
    return new THREE.Vector3(pos * 0.5, PLATE_TOP + 0.4, 0.3);
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    if (!point) return false;
    const p = this.root.worldToLocal(point.clone());
    return Math.abs(p.x) < 0.85 && Math.abs(p.z) < 0.65;
  }

  /** A tap on an arrow sets the lever there: right forward, left back, the middle stops. */
  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    const x = point ? this.root.worldToLocal(point.clone()).x : 0;
    this.pos = x > 0.25 ? 1 : x < -0.25 ? -1 : 0;
    this.closed = this.pos !== 0;
    this.sounds.push({ kind: 'clack' });
    return true;
  }

  protected animate(dt: number) {
    this.lever.rotation.z = damp(this.lever.rotation.z, -this.pos * 0.55, 14, dt);
    this.marks.forEach((m, i) => {
      const on = i - 1 === this.pos;
      m.emissiveIntensity = damp(m.emissiveIntensity, on ? 1.8 : 0.1, 10, dt);
      if (this.overlay) m.opacity = damp(m.opacity, on ? 0.85 : 0, 10, dt);
    });
  }
}

const RAIL = 3.6;

/**
 * A cart on a short railway, pulled by a motor in its end: the current one
 * way drives it east, the other way west; it stops at the buffers. It can
 * carry a load (the map puts one in it).
 */
export class RailCart extends Part {
  readonly kind: PartKind = 'railCart';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 4.6;
  /** Where the cart is along the rails, −RAIL..RAIL (part-local x). */
  x = 0;
  private v = 0;
  private cart = new THREE.Group();
  private wheels: THREE.Object3D[] = [];
  /** The axis the wheels roll about: the code-built ones lie on their side (y), the sculpted ones turn about z. */
  private wheelAxis: 'y' | 'z' = 'y';
  private end: -1 | 1 | 0 = 0;
  /** What rides in the cart (the map hangs a load here). */
  readonly bed = new THREE.Group();

  constructor() {
    super();
    const plate = basePlate(RAIL * 2 + 2, 1.7);
    const steel = mat('#8d97a3', 0.35, 0.75);
    for (const z of [-0.35, 0.35]) {
      const rail = mesh(new THREE.BoxGeometry(RAIL * 2 + 1.4, 0.08, 0.08), steel);
      rail.position.set(0, PLATE_TOP + 0.04, z);
      this.body.add(rail);
    }
    for (let x = -RAIL - 0.6; x <= RAIL + 0.6; x += 0.6) {
      const tie = mesh(new THREE.BoxGeometry(0.16, 0.04, 1), mat('#7a5a3c', 0.8), false);
      tie.position.set(x, PLATE_TOP + 0.02, 0);
      this.body.add(tie);
    }
    for (const x of [-RAIL - 0.75, RAIL + 0.75]) {
      const buffer = mesh(new THREE.BoxGeometry(0.2, 0.4, 1), mat('#f5c33b', 0.5));
      buffer.position.set(x, PLATE_TOP + 0.2, 0);
      this.body.add(buffer);
    }
    const tub = mesh(new THREE.BoxGeometry(1.2, 0.5, 0.9), mat('#e8483f', 0.45, 0.2));
    tub.position.y = 0.42;
    const rim = mesh(new THREE.BoxGeometry(1.3, 0.08, 1), mat('#2b3242', 0.4, 0.5));
    rim.position.y = 0.7;
    this.cart.add(tub, rim);
    for (const [x, z] of [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]]) {
      const w = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14), mat('#2b3242', 0.4, 0.6));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.17, z);
      this.wheels.push(w);
      this.cart.add(w);
    }
    this.bed.position.y = 0.72;
    this.cart.add(this.bed);
    this.cart.position.y = PLATE_TOP;
    this.body.add(plate, this.cart);
    // Codex's sculpted wagon, with four wheels of its own (turning about their local z) and its coil of steel as the load.
    const wagon = model('rail-cart', { width: 1.3 });
    if (wagon) {
      for (const o of [tub, rim, ...this.wheels]) o.removeFromParent();
      wagon.position.y = 0.08;
      this.cart.add(wagon);
      this.wheels = ['front-left', 'front-right', 'rear-left', 'rear-right'].map((n) => wagon.getObjectByName(`wheel-${n}`)).filter((o): o is THREE.Mesh => !!o);
      this.wheelAxis = 'z';
      const coil = wagon.getObjectByName('load-coil');
      if (coil) {
        this.root.updateMatrixWorld(true);
        this.bed.attach(coil);
      }
    }
    this.addTerminal('a', 'none', -RAIL - 0.2, 0.75);
    this.addTerminal('b', 'none', -RAIL + 0.6, 0.75);
    this.pickable(plate, wagon ?? tub);
  }

  /** The cart's place in the world. */
  cartAt(out = new THREE.Vector3()): THREE.Vector3 {
    return this.root.localToWorld(out.set(this.x, 0, 0));
  }

  protected animate(dt: number) {
    const l = Math.max(-1.6, Math.min(1.6, this.state.level));
    this.v = damp(this.v, Math.abs(l) > 0.15 ? l * 1.6 : 0, 4, dt);
    const before = this.x;
    this.x = THREE.MathUtils.clamp(this.x + this.v * dt, -RAIL, RAIL);
    const moved = this.x - before;
    for (const w of this.wheels) w.rotation[this.wheelAxis] -= moved / 0.15;
    const end = this.x >= RAIL - 1e-3 ? 1 : this.x <= -RAIL + 1e-3 ? -1 : 0;
    if (end && end !== this.end) this.sounds.push({ kind: 'clank' });
    if (end) this.v = 0;
    this.end = end;
    this.cart.position.x = this.x;
    // The code-built tub rattles along; the sculpted wagon's wheels stay on the rails.
    this.cart.position.y = PLATE_TOP + (this.wheelAxis === 'y' && Math.abs(moved) > 1e-4 ? Math.abs(Math.sin(this.time * 18)) * 0.015 : 0);
  }
}

/**
 * A press with a two-hand guard, as in a real factory: the ram comes down
 * only while both big buttons, far apart, are held — one finger on each, so
 * no hand can be under it. Inside: the two buttons in a row, then the motor.
 */
export class SafetyPress extends Part {
  readonly kind: PartKind = 'safetyPress';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 2.2;
  /** Left and right button held. */
  readonly held = [false, false];
  /** Strokes made (each stamps whatever lies on the anvil). */
  strokes = 0;
  private ram = new THREE.Group();
  private ramY = 0;
  private caps: THREE.Mesh[] = [];
  private lamps: THREE.MeshStandardMaterial[] = [];
  private down = false;
  private cycle = 0;

  constructor() {
    super();
    const plate = basePlate(4.2, 2.2);
    const steel = mat('#8d97a3', 0.4, 0.65);
    const frame = new THREE.Group();
    for (const x of [-0.75, 0.75]) {
      const post = mesh(new THREE.BoxGeometry(0.25, 2, 0.4), steel);
      post.position.set(x, PLATE_TOP + 1, -0.35);
      frame.add(post);
    }
    const top = mesh(new THREE.BoxGeometry(1.9, 0.35, 0.6), mat('#f5c33b', 0.5));
    top.position.set(0, PLATE_TOP + 2.1, -0.35);
    const anvil = mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), mat('#2b3242', 0.5, 0.4));
    anvil.position.set(0, PLATE_TOP + 0.15, -0.35);
    frame.add(top, anvil);
    const head = mesh(new THREE.BoxGeometry(1, 0.35, 0.7), mat('#e8483f', 0.4, 0.3));
    // Long enough to stay in the beam's sleeve with the ram right down.
    const rod = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 12), mat('#c9ced6', 0.25, 0.9));
    rod.position.y = 0.85;
    this.ram.add(head, rod);
    this.ram.position.set(0, PLATE_TOP + 1.4, -0.35);
    // Yellow-black guard stripes on the base, and the two buttons wide apart.
    for (const side of [-1, 1]) {
      const stand = mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.3, 20), mat('#2b3242', 0.45, 0.4));
      stand.position.set(side * 1.6, PLATE_TOP + 0.15, 0.35);
      const cap = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 24), mat('#4cc46a', 0.35));
      cap.position.set(side * 1.6, PLATE_TOP + 0.38, 0.35);
      const lamp = new THREE.MeshStandardMaterial({ color: '#3a4250', emissive: '#7dff6b', emissiveIntensity: 0, roughness: 0.3 });
      this.lamps.push(lamp);
      const bulb = mesh(new THREE.SphereGeometry(0.08, 12, 8), lamp, false);
      bulb.position.set(side * 1.6, PLATE_TOP + 0.35, -0.2);
      this.caps.push(cap);
      this.body.add(stand, cap, bulb);
    }
    this.body.add(plate, frame, this.ram);
    const body = sculpt(this, 'safety-press', { width: 1.9 }, new THREE.Vector3(0, PLATE_TOP, -0.35), [frame]);
    this.addTerminal('a', 'plus', -1.75, -0.75);
    this.addTerminal('b', 'minus', 1.75, -0.75);
    this.pickable(plate, body ?? frame, ...this.caps);
  }

  elements(): CircuitElement[] {
    const X = `${this.id}.X`;
    const Y = `${this.id}.Y`;
    return [
      { id: `${this.id}#L`, kind: 'switch', a: this.terminal('a').id, b: X, closed: this.held[0] },
      { id: `${this.id}#R`, kind: 'switch', a: X, b: Y, closed: this.held[1] },
      { id: this.id, kind: 'motor', a: Y, b: this.terminal('b').id, r: 6 },
    ];
  }

  /** Which button a point (world) is on: 0 left, 1 right, or −1. */
  buttonAt(point: THREE.Vector3 | null | undefined): number {
    if (!point) return -1;
    const p = this.root.worldToLocal(point.clone());
    for (const i of [0, 1]) if (Math.hypot(p.x - (i ? 1.6 : -1.6), p.z - 0.35) < 0.55) return i;
    return -1;
  }

  /** Part-local top of a button (for the hint's hand). */
  buttonPoint(i: number): THREE.Vector3 {
    return new THREE.Vector3(i ? 1.6 : -1.6, PLATE_TOP + 0.46, 0.35);
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return this.buttonAt(point) >= 0;
  }

  pressStart(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    const i = this.buttonAt(point);
    if (i < 0) return false;
    this.held[i] = true;
    this.sounds.push({ kind: 'tick' });
    return true;
  }

  pressEnd(point?: THREE.Vector3 | null) {
    const i = this.buttonAt(point);
    if (i >= 0) this.held[i] = false;
    else this.held.fill(false);
  }

  protected animate(dt: number) {
    const on = Math.abs(this.state.level) > 0.15;
    // While both are held it keeps stamping, down and up; let go and it rises and stops.
    if (on) this.cycle += dt * 1.4;
    const target = on ? 0.5 - 0.5 * Math.cos(this.cycle * Math.PI * 2) : 0;
    this.ramY = on ? target : damp(this.ramY, 0, 3, dt);
    const landed = this.ramY > 0.95;
    if (landed && !this.down) {
      this.strokes++;
      this.sounds.push({ kind: 'stamp' });
      this.effects.push({ kind: 'dust', at: this.root.localToWorld(new THREE.Vector3(0, PLATE_TOP + 0.3, -0.35)), radius: 0.6 });
    }
    this.down = landed;
    this.ram.position.y = PLATE_TOP + 1.4 - this.ramY * 0.75;
    this.caps.forEach((c, i) => (c.position.y = PLATE_TOP + (this.held[i] ? 0.32 : 0.38)));
    this.lamps.forEach((m, i) => (m.emissiveIntensity = damp(m.emissiveIntensity, this.held[i] ? 2.4 : 0, 12, dt)));
  }
}

/** The height of a shaft's top, where a gear set on it turns. */
const SHAFT_Y = PLATE_TOP + 0.35;

/**
 * A motor with a bare shaft: no gear of its own, so a gear set on the shaft
 * turns with it — the size of that gear sets how fast the next one goes.
 */
export class ShaftMotor extends Part implements Geared {
  readonly kind: PartKind = 'shaftMotor';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.1;
  readonly gearR = 0;
  turn = 0;
  private speed = 0;
  private shaft: THREE.Mesh;

  constructor() {
    super();
    const plate = basePlate(1.8, 1.6);
    // A flat motor under the shaft, so the gear set on it turns in plain sight above.
    const can = mesh(new THREE.BoxGeometry(1.1, 0.24, 0.9), mat('#2f8f8c', 0.4, 0.3));
    can.position.set(0, PLATE_TOP + 0.12, -0.1);
    this.shaft = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12), mat('#c9ced6', 0.25, 0.9));
    this.shaft.position.set(0, PLATE_TOP + 0.25, -0.35);
    const collar = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.2), mat('#2b3242', 0.5), false);
    collar.position.y = 0.2;
    this.shaft.add(collar);
    this.body.add(plate, can, this.shaft);
    const body = sculpt(this, 'shaft-motor', { width: 1.1 }, new THREE.Vector3(0, PLATE_TOP, -0.1), [can]);
    this.addTerminal('a', 'plus', 0.65, 0.55);
    this.addTerminal('b', 'minus', -0.65, 0.55);
    this.pickable(plate, body ?? can);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 8 };
  }

  gearAt(out = new THREE.Vector3()) {
    return this.root.localToWorld(out.set(0, SHAFT_Y, -0.35));
  }

  drive() {
    return this.speed;
  }

  protected animate(dt: number) {
    const l = this.state.level;
    this.speed = damp(this.speed, Math.abs(l) > 0.15 ? 2.2 * Math.sign(l) * Math.min(1.5, Math.abs(l)) : 0, 3, dt);
    this.shaft.rotation.y += this.turn * dt;
  }
}

/** How fast a lathe wants to turn (radians a second at its shaft), by what it makes. */
export const LATHE_SPEED = { slow: [0.5, 1.4], fast: [3.6, 9] } as const;

/**
 * A lathe on a bare shaft, turned through gears: it shapes a wooden toy only
 * at its own speed — a dial with a green band says whether the gears make it
 * too slow, too fast or just right. Swap a small and a big gear to change it.
 */
export class Lathe extends Part implements Geared {
  readonly kind: PartKind = 'lathe';
  readonly elementKind: ElementKind = 'wire';
  readonly radius = 1.8;
  readonly gearR = 0;
  turn = 0;
  /** The speed it needs. */
  want: keyof typeof LATHE_SPEED = 'slow';
  /** Seconds of good turning (a toy is done after a few). */
  made = 0;
  private spindle = new THREE.Group();
  private needle = new THREE.Group();
  private band: THREE.Mesh;
  private shown = 0;

  constructor() {
    super();
    const plate = basePlate(3.2, 1.7);
    const bed = mesh(new THREE.BoxGeometry(2.4, 0.3, 0.6), mat('#8d97a3', 0.4, 0.6));
    bed.position.set(0.3, PLATE_TOP + 0.15, 0.2);
    const head = mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), mat('#2f8f8c', 0.45, 0.3));
    head.position.set(-0.7, PLATE_TOP + 0.65, 0.2);
    const tail = mesh(new THREE.BoxGeometry(0.4, 0.5, 0.5), mat('#2f8f8c', 0.45, 0.3));
    tail.position.set(1.3, PLATE_TOP + 0.55, 0.2);
    // The workpiece between the centres: a wooden spindle that turns.
    const wood = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 16), mat('#d9a066', 0.7));
    wood.rotation.z = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), mat('#e8483f', 0.5));
    ring.rotation.y = Math.PI / 2;
    this.spindle.add(wood, ring);
    this.spindle.position.set(0.3, PLATE_TOP + 0.75, 0.2);
    // The shaft at the back left takes the gear; the dial stands on the head.
    const shaft = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12), mat('#c9ced6', 0.25, 0.9));
    shaft.position.set(-1.1, PLATE_TOP + 0.25, -0.45);
    const face = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), mat('#f6eddd', 0.6));
    face.rotation.x = Math.PI / 2;
    face.position.set(-0.7, PLATE_TOP + 1.25, 0.5);
    this.band = mesh(new THREE.RingGeometry(0.18, 0.27, 24, 1, 0, 1), mat('#4cc46a', 0.5), false);
    this.band.position.set(-0.7, PLATE_TOP + 1.25, 0.53);
    const pin = mesh(new THREE.BoxGeometry(0.03, 0.24, 0.02), mat('#e8483f', 0.4), false);
    pin.position.y = 0.12;
    this.needle.add(pin);
    this.needle.position.set(-0.7, PLATE_TOP + 1.25, 0.55);
    this.body.add(plate, bed, head, tail, this.spindle, shaft, face, this.band, this.needle);
    const body = sculpt(this, 'lathe', { width: 2.6 }, new THREE.Vector3(0.1, PLATE_TOP, 0.2), [bed, head, tail]);
    this.pickable(plate, ...(body ? [body] : [bed, head, tail]));
    this.setWant('slow');
  }

  elements(): CircuitElement[] {
    return [];
  }

  /** Which speed it needs; the dial's green band moves to it. */
  setWant(want: keyof typeof LATHE_SPEED) {
    this.want = want;
    const [lo, hi] = LATHE_SPEED[want];
    const a = (v: number) => Math.PI * 0.75 - Math.min(1, v / 6) * Math.PI * 1.5;
    this.band.geometry.dispose();
    this.band.geometry = new THREE.RingGeometry(0.18, 0.27, 24, 1, a(hi) + Math.PI / 2, a(lo) - a(hi));
  }

  gearAt(out = new THREE.Vector3()) {
    return this.root.localToWorld(out.set(-1.1, SHAFT_Y, -0.45));
  }

  /** How it is turning: 'still', 'slow', 'fast' (too fast) or 'ok'. */
  get speed(): 'still' | 'slow' | 'fast' | 'ok' {
    const v = Math.abs(this.turn);
    const [lo, hi] = LATHE_SPEED[this.want];
    return v < 0.2 ? 'still' : v < lo ? 'slow' : v > hi ? 'fast' : 'ok';
  }

  protected animate(dt: number) {
    const v = Math.abs(this.turn);
    this.shown = damp(this.shown, v, 4, dt);
    this.needle.rotation.z = Math.PI * 0.75 - Math.min(1, this.shown / 6) * Math.PI * 1.5;
    this.spindle.rotation.x += this.turn * 2 * dt;
    const s = this.speed;
    // Too fast it shakes and throws sparks; just right it throws curls of wood.
    this.spindle.position.y = PLATE_TOP + 0.75 + (s === 'fast' ? Math.sin(this.time * 60) * 0.03 : 0);
    if (s === 'ok') {
      this.made += dt;
      if (Math.random() < dt * 6) this.effects.push({ kind: 'sparks', at: this.root.localToWorld(new THREE.Vector3(0.3 + (Math.random() - 0.5), PLATE_TOP + 0.8, 0.35)), n: 3, color: '#e8b878' });
    } else if (s === 'fast' && Math.random() < dt * 4) this.effects.push({ kind: 'sparks', at: this.root.localToWorld(new THREE.Vector3(0.3, PLATE_TOP + 0.8, 0.35)), n: 4 });
  }
}

const SOCKETS: PlugShape[] = ['round', 'square', 'triangle'];

/**
 * The power board of the factory floor: fed from a pole through two plain
 * posts, it hands the power on through three pairs of shaped sockets — round,
 * square, triangle. A machine with triangle plugs takes power only from the
 * triangle pair.
 */
export class SocketBoard extends Part {
  readonly kind: PartKind = 'socketBoard';
  readonly elementKind: ElementKind = 'wire';
  readonly radius = 2;

  constructor() {
    super();
    const plate = basePlate(3.4, 2);
    const board = mesh(new THREE.BoxGeometry(2.6, 0.9, 0.18), mat('#f6eddd', 0.6));
    board.position.set(0, PLATE_TOP + 0.45, -0.75);
    const frame = mesh(new THREE.BoxGeometry(2.75, 1.0, 0.12), mat('#8d97a3', 0.4, 0.6));
    frame.position.set(0, PLATE_TOP + 0.45, -0.85);
    this.body.add(plate, frame, board);
    const body = sculpt(this, 'socket-board', { width: 2.6 }, new THREE.Vector3(0, PLATE_TOP, -0.8), [frame, board]);
    this.addTerminal('p', 'plus', -1.45, 0.75);
    this.addTerminal('n', 'minus', -1.45, -0.05);
    SOCKETS.forEach((shape, i) => {
      const x = -0.6 + i * 0.9;
      this.addTerminal(`${shape}+`, 'plus', x, -0.05).shaped(shape);
      this.addTerminal(`${shape}-`, 'minus', x, 0.7).shaped(shape);
    });
    this.pickable(plate, ...(body ? [body] : [board, frame]));
  }

  elements(): CircuitElement[] {
    const t = (k: string) => this.terminal(k).id;
    return SOCKETS.flatMap((shape): CircuitElement[] => [
      { id: `${this.id}#${shape}+`, kind: 'wire', a: t('p'), b: t(`${shape}+`) },
      { id: `${this.id}#${shape}-`, kind: 'wire', a: t('n'), b: t(`${shape}-`) },
    ]);
  }

  protected animate() {}
}
