// The real factory's own parts (the owner's ask: harder, new mechanics, not
// the same wiring again). The wiring box: an open cabinet with a grid of
// tiles, each with a piece of copper on it; a tap turns a tile, and the box
// lets the current through only when the pieces join from its left post to
// its right one (src/parts/tiles.ts).
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP } from './kit';
import { flow, hintTile, makePuzzle, opens, turn, type Side, type TileGrid } from './tiles';

const TILE = 1;

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
    this.pickable(plate, tray, door, ...this.tiles);
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
      s.position.set(x, PLATE_TOP + 0.36, 0.3);
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
    sign(0, '#e8483f', new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16));
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
    this.addTerminal('p', 'plus', -1.05, -0.45);
    this.addTerminal('n', 'minus', -1.05, 0.45);
    this.addTerminal('a', 'none', 1.05, -0.45);
    this.addTerminal('b', 'none', 1.05, 0.45);
    this.pickable(plate, box, this.lever);
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
    this.marks.forEach((m, i) => (m.emissiveIntensity = damp(m.emissiveIntensity, i - 1 === this.pos ? 1.8 : 0.1, 10, dt)));
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
  private wheels: THREE.Mesh[] = [];
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
    this.addTerminal('a', 'none', -RAIL - 0.2, 0.75);
    this.addTerminal('b', 'none', -RAIL + 0.6, 0.75);
    this.pickable(plate, tub);
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
    for (const w of this.wheels) w.rotation.y -= moved / 0.15;
    const end = this.x >= RAIL - 1e-3 ? 1 : this.x <= -RAIL + 1e-3 ? -1 : 0;
    if (end && end !== this.end) this.sounds.push({ kind: 'clank' });
    if (end) this.v = 0;
    this.end = end;
    this.cart.position.x = this.x;
    this.cart.position.y = PLATE_TOP + (Math.abs(moved) > 1e-4 ? Math.abs(Math.sin(this.time * 18)) * 0.015 : 0);
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
    const rod = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 12), mat('#c9ced6', 0.25, 0.9));
    rod.position.y = 0.6;
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
    this.addTerminal('a', 'plus', -1.75, -0.75);
    this.addTerminal('b', 'minus', 1.75, -0.75);
    this.pickable(plate, frame, ...this.caps);
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
    // Down fast while both are held, back up slowly; a stamp each time it lands.
    this.ramY = damp(this.ramY, on ? 1 : 0, on ? 9 : 3, dt);
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
