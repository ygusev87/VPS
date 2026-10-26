import * as THREE from 'three';
import type { CircuitElement, CircuitResult, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { BAKED, bake, mat, PLATE_TOP } from './kit';

/** On a map, its board's half size: parts and balls stay on the board (the workbench keeps them within a round 34). */
export const MAP_BOARD: { half: { x: number; z: number } | null } = { half: null };

export type PartKind =
  | 'battery'
  | 'bigBattery'
  | 'bulb'
  | 'led'
  | 'fan'
  | 'floorFan'
  | 'pcFan'
  | 'pinwheel'
  | 'carousel'
  | 'windmill'
  | 'buzzer'
  | 'musicbox'
  | 'xylophone'
  | 'drum'
  | 'piano'
  | 'tuba'
  | 'maracas'
  | 'bells'
  | 'marbleRun'
  | 'waterMill'
  | 'conveyor'
  | 'track'
  | 'helicopter'
  | 'firetruck'
  | 'trafficLight'
  | 'disco'
  | 'dynamo'
  | 'lift'
  | 'crane'
  | 'windGen'
  | 'lightSensor'
  | 'launcher'
  | 'target'
  | 'balloon'
  | 'skittles'
  | 'garland'
  | 'kettle'
  | 'domino'
  | 'laser'
  | 'mirror'
  | 'bell'
  | 'belt'
  | 'pole'
  | 'solar'
  | 'pump'
  | 'heater'
  | 'gate'
  | 'substation'
  | 'barrier'
  | 'ferris'
  | 'carWash'
  | 'drawbridge'
  | 'towerCrane'
  | 'duskLamp'
  | 'neon'
  | 'ladder'
  | 'gearMotor'
  | 'gear'
  | 'bigGear'
  | 'press'
  | 'pipe'
  | 'tank'
  | 'paintBooth'
  | 'robotArm'
  | 'packer'
  | 'switch'
  | 'button'
  | 'panel'
  | 'tester'
  | 'magnet';

/** Light colours a bulb or LED can take (tap to cycle). */
export type LightColor = 'warm' | 'red' | 'green' | 'blue' | 'yellow';
export type Polarity = 'plus' | 'minus' | 'none';

export interface ElectricState {
  /** Normalised activity, see solver. Signed for motors. */
  level: number;
  current: number;
  /** V(a) − V(b). */
  voltage: number;
  reversed: boolean;
  shorted: boolean;
}

export type Highlight = 'none' | 'available' | 'target' | 'warn';

const POST_H = 0.3;

const ringGeo = new THREE.TorusGeometry(0.24, 0.025, 8, 40);
// Shared terminal geometry: hex nut, coloured insulator, brass stud, knurled thumb nut.
const nutGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 6);
const collarGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.08, 28);
const studGeo = new THREE.CylinderGeometry(0.045, 0.045, POST_H, 12);
const thumbGeo = knurledNut();
const domeGeo = new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);

function knurledNut(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const r = 0.115;
  pts.push(new THREE.Vector2(0.001, 0), new THREE.Vector2(r - 0.012, 0), new THREE.Vector2(r, 0.012));
  pts.push(new THREE.Vector2(r, 0.078), new THREE.Vector2(r - 0.012, 0.09), new THREE.Vector2(0.001, 0.09));
  const g = new THREE.LatheGeometry(pts, 36);
  // Ridges around the rim.
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rr = Math.hypot(v.x, v.z);
    if (rr > r - 0.013) {
      const a = Math.atan2(v.z, v.x);
      const k = 1 + 0.06 * Math.cos(a * 18);
      pos.setXYZ(i, v.x * k, v.y, v.z * k);
    }
  }
  g.computeVertexNormals();
  return g;
}

let metalGeo: THREE.BufferGeometry | null = null;
function postMetal() {
  metalGeo ??= bake([
    { geo: nutGeo, color: C.metal, at: new THREE.Vector3(0, 0.025, 0) },
    { geo: studGeo, color: C.brass, at: new THREE.Vector3(0, POST_H / 2, 0) },
    { geo: thumbGeo, color: C.brass, at: new THREE.Vector3(0, POST_H - 0.12, 0) },
    { geo: domeGeo, color: C.brass, at: new THREE.Vector3(0, POST_H, 0) },
  ]);
  return metalGeo;
}

const collarMats = new Map<string, THREE.MeshStandardMaterial>();
function collarMat(color: string) {
  let m = collarMats.get(color);
  if (!m) collarMats.set(color, (m = mat(color, 0.35)));
  return m;
}

export class Terminal {
  readonly id: string;
  readonly post = new THREE.Group();
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private highlight: Highlight = 'none';
  private pulse = Math.random() * 10;
  private flash = 0;

  constructor(
    readonly part: Part,
    readonly key: string,
    readonly polarity: Polarity,
    local: THREE.Vector3,
    collar?: string,
  ) {
    this.id = `${part.id}.${key}`;
    const collarColor = collar ?? (polarity === 'plus' ? C.red : polarity === 'minus' ? C.navy2 : C.tealDeep);
    // Two draw calls per post: the baked metal (nut, stud, thumb nut, dome) and the coloured collar.
    const metal = new THREE.Mesh(postMetal(), BAKED.metal);
    const ring = new THREE.Mesh(collarGeo, collarMat(collarColor));
    ring.position.y = 0.09;
    metal.receiveShadow = ring.receiveShadow = true;
    this.post.add(metal, ring);

    this.ringMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0, depthWrite: false });
    this.ringMat.visible = false;
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.06;
    this.post.add(this.ring);

    this.post.position.copy(local).setY(PLATE_TOP);
  }

  /** World position of the post top, where wires clip on. */
  attachPoint(target = new THREE.Vector3()): THREE.Vector3 {
    return this.post.localToWorld(target.set(0, POST_H + 0.02, 0));
  }

  setHighlight(h: Highlight) {
    this.highlight = h;
  }

  /** Little spark of colour when a wire snaps on. */
  snap() {
    this.flash = 1;
  }

  update(dt: number) {
    this.pulse += dt;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    const h = this.highlight;
    const target = h === 'none' ? 0 : h === 'available' ? 0.55 : 0.95;
    const color = h === 'warn' ? C.red : C.teal;
    this.ringMat.color.set(color);
    const wave = h === 'none' ? 0 : 0.5 + 0.5 * Math.sin(this.pulse * (h === 'available' ? 4 : 7));
    this.ringMat.opacity = THREE.MathUtils.damp(this.ringMat.opacity, target * (0.55 + 0.45 * wave) + this.flash, 12, dt);
    // An invisible ring still costs a draw call: skip it until it shows.
    this.ringMat.visible = this.ringMat.opacity > 0.004;
    const s = 1 + (h === 'none' ? 0 : 0.18 * wave) + this.flash * 0.6;
    this.ring.scale.setScalar(s);
  }
}

let nextId = 1;

/** Something a part wants heard: a note, a drum hit, a dull "no power" tap. */
export type PartSound =
  | { kind: 'xylophone'; note: number }
  | { kind: 'drum' }
  | { kind: 'noPower' }
  | { kind: 'song'; song: number }
  | { kind: 'honk' }
  | { kind: 'lap' }
  | { kind: 'tick' }
  | { kind: 'ding' }
  | { kind: 'clank' }
  | { kind: 'liftTop' }
  | { kind: 'craneHold' }
  | { kind: 'craneDone' }
  | { kind: 'piano'; note: number }
  | { kind: 'tuba'; note: number }
  | { kind: 'bell'; note: number }
  | { kind: 'shake' }
  | { kind: 'marble' }
  | { kind: 'stamp' }
  | { kind: 'paint' }
  | { kind: 'launch' }
  | { kind: 'bonk' }
  | { kind: 'clack' }
  | { kind: 'missed' }
  | { kind: 'gong' }
  | { kind: 'burst' }
  | { kind: 'pins' }
  | { kind: 'whistle' }
  | { kind: 'volts'; v: number };

/** A 3D effect a part asks for (drained by the game into fx.ts), at a world point. */
export type PartEffect =
  | { kind: 'sparks'; at: THREE.Vector3; n?: number; color?: string }
  | { kind: 'dust'; at: THREE.Vector3; radius: number }
  | { kind: 'exhaust'; at: THREE.Vector3; dir: THREE.Vector3 }
  | { kind: 'trail'; at: THREE.Vector3; color: string };

/** Axis-aligned rectangle on the table (x/z), in world or part-local units. */
export interface Footprint {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export abstract class Part {
  readonly id: string;
  /** Placed on the table; position.y stays 0. */
  readonly root = new THREE.Group();
  /** Child of root, used for lift / bounce / shake without touching layout. */
  readonly body = new THREE.Group();
  readonly terminals: Terminal[] = [];
  /** Meshes that grab the part when touched. */
  readonly pickables: THREE.Object3D[] = [];
  /** Footprint for keeping parts apart. */
  abstract readonly radius: number;
  abstract readonly kind: PartKind;
  abstract readonly elementKind: ElementKind;
  /** Night table: glows can be softer, the dark does the work (set by the game). */
  static night = false;
  /** Pre-placed by a level: can be moved but not thrown away. */
  locked = false;
  /** Built into a map: cannot be moved at all (wires and taps still work). */
  pinned = false;
  closed = false;

  state: ElectricState = { level: 0, current: 0, voltage: 0, reversed: false, shorted: false };
  /** Bulbs and LEDs: current colour. */
  color: LightColor = 'warm';

  /** Sounds asked for since the last frame; the game plays and clears them. */
  readonly sounds: PartSound[] = [];
  /** Effects asked for since the last frame (sparks, dust, exhaust). */
  readonly effects: PartEffect[] = [];
  /** Set when the part's own electrical values changed (e.g. a generator spun up); the world re-solves. */
  wantsSolve = false;
  /**
   * For parts the finger turns while held (a crank, a crane): the height of the
   * horizontal plane the finger is followed on, so moving off the part still counts.
   */
  holdPlane: number | null = null;
  private foot: Footprint | null | undefined;
  private plate: Footprint | undefined;

  private spring = 1;
  private springV = 0;
  private lift = 0;
  private dragging = false;
  private shakeT = 0;
  private hopT = 1;
  private wait = 0;
  protected time = Math.random() * 100;

  constructor() {
    this.id = `p${nextId++}`;
    this.root.add(this.body);
    this.root.userData.part = this;
  }

  protected addTerminal(key: string, polarity: Polarity, x: number, z: number, collar?: string) {
    const t = new Terminal(this, key, polarity, new THREE.Vector3(x, 0, z), collar);
    this.terminals.push(t);
    this.body.add(t.post);
    return t;
  }

  /** Mark meshes in a group as grabbable. */
  protected pickable(...objs: THREE.Object3D[]) {
    for (const o of objs) {
      o.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.userData.part = this;
          this.pickables.push(c);
        }
      });
    }
  }

  terminal(key: string): Terminal {
    return this.terminals.find((t) => t.key === key)!;
  }

  /**
   * The circuit elements inside this part. Most parts are one two-terminal
   * element named after the part; a button panel holds several switches.
   */
  elements(): CircuitElement[] {
    return [{ id: this.id, kind: this.elementKind, a: this.terminal('a').id, b: this.terminal('b').id, closed: this.closed, ...this.electrical() }];
  }

  /** Per-part overrides for the element (e.g. a bigger battery's voltage). */
  protected electrical(): Partial<CircuitElement> {
    return {};
  }

  /** Bulbs and LEDs repaint themselves; other parts ignore colours. */
  setColor(c: LightColor) {
    this.color = c;
  }

  /** After each solve, for parts that care about more than their main element. */
  onSolved(_r: CircuitResult) {}

  /**
   * Finger down on the part. Return true to take over the press (a momentary
   * button stays pressed until pressEnd); the press then never becomes a drag.
   */
  pressStart(_hit: THREE.Object3D | null, _point: THREE.Vector3 | null): boolean {
    return false;
  }

  /** The held finger slid over the part (e.g. along xylophone bars). */
  pressMove(_hit: THREE.Object3D | null, _point: THREE.Vector3 | null) {}

  pressEnd() {}

  /** Pop in from nothing, optionally after a delay in seconds. */
  appear(delay = 0) {
    this.spring = 0.15;
    this.springV = 0;
    this.wait = delay;
  }

  bump(amount = 0.25) {
    this.springV -= amount * 14;
  }

  setDragging(on: boolean) {
    if (this.dragging && !on) this.bump(0.3);
    this.dragging = on;
  }

  shake() {
    this.shakeT = 0.6;
  }

  hop(delay = 0) {
    this.hopT = -delay;
  }

  /** Returns true when the tap did something (e.g. toggled a switch). */
  tap(_hit?: THREE.Object3D | null, _point?: THREE.Vector3 | null): boolean {
    this.bump(0.15);
    return false;
  }

  update(dt: number) {
    this.time += dt;
    if (this.wait > 0) {
      this.wait -= dt;
      this.body.scale.setScalar(0.001);
      return;
    }
    // Under-damped spring on scale for squash-and-stretch pops.
    const k = 220;
    const c = 13;
    this.springV += (-(this.spring - 1) * k - this.springV * c) * dt;
    this.spring += this.springV * dt;
    const s = Math.max(0.01, this.spring);
    this.body.scale.set(s + (1 - s) * 0.5, s * s, s + (1 - s) * 0.5);

    this.lift = THREE.MathUtils.damp(this.lift, this.dragging ? 1 : 0, 14, dt);
    let y = this.lift * 0.45;

    if (this.hopT < 1) {
      this.hopT += dt * 1.6;
      if (this.hopT > 0) y += Math.sin(Math.min(1, this.hopT) * Math.PI) * 0.6;
    }
    this.body.position.y = y;

    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.body.position.x = Math.sin(this.time * 70) * 0.06 * (this.shakeT / 0.6);
    } else {
      this.body.position.x = 0;
    }
    this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, this.dragging ? Math.sin(this.time * 3) * 0.04 : 0, 8, dt);

    for (const t of this.terminals) t.update(dt);
    this.animate(dt);
  }

  /** Per-part reaction to electric state. */
  protected abstract animate(dt: number): void;

  /**
   * Is this touch on something the child presses (a key, a button cap)?
   * Such touches win over a wire lying across them.
   */
  controlAt(_hit: THREE.Object3D | null, _point: THREE.Vector3 | null): boolean {
    return false;
  }

  /**
   * The tall part of the body seen from above (not the flat plate or the
   * terminal posts), in part-local units — wires are routed around it.
   */
  footprint(): Footprint | null {
    if (this.foot !== undefined) return this.foot;
    this.body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.body.matrixWorld).invert();
    const posts = new Set<THREE.Object3D>();
    for (const t of this.terminals) t.post.traverse((o) => posts.add(o));
    const box = new THREE.Box3();
    const one = new THREE.Box3();
    this.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || posts.has(m) || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      one.copy(m.geometry.boundingBox!).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      // Plates, decals and light pools are flat; only what stands up counts.
      if (one.max.y > PLATE_TOP + 0.25 && one.max.y - one.min.y > 0.12) box.union(one);
    });
    this.foot = box.isEmpty() ? null : { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z };
    return this.foot;
  }

  /**
   * Who last closed this trigger (target, dominoes, light sensor, button):
   * another part ("world" — a ball, light, wind) or a finger. A chain counts
   * only when the world did it.
   */
  triggered: 'world' | 'finger' | null = null;

  /** A rolling ball bumped into it (see chain.ts). Most parts just wobble. */
  ballHit() {
    this.bump(0.2);
  }

  /** The flat base plate seen from above, part-local (the lowest wide meshes). */
  plateRect(): Footprint {
    if (this.plate) return this.plate;
    this.body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.body.matrixWorld).invert();
    const box = new THREE.Box3();
    const one = new THREE.Box3();
    this.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry || (m.material as THREE.Material).transparent) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      one.copy(m.geometry.boundingBox!).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      if (m.userData.plate || (one.max.y <= PLATE_TOP + 0.01 && one.min.y < 0.05 && one.max.x - one.min.x > 0.8)) box.union(one);
    });
    const r = this.radius * 0.7;
    this.plate = box.isEmpty() ? { x0: -r, x1: r, z0: -r, z1: r } : { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z };
    return this.plate;
  }

  /**
   * A lit lamp's light for the room (see Fx.shine), or null. `sense` is how
   * strongly a light sensor feels it, when that differs from what is drawn.
   */
  glowLight(): { at: THREE.Vector3; color: THREE.Color; power: number; sense?: number } | null {
    return null;
  }

  /**
   * Tiny details (knobs, screws, little lamps) cast shadows nobody can see but
   * each costs a draw in the shadow pass: let only the bigger shapes cast.
   */
  trimShadows() {
    this.root.updateMatrixWorld(true);
    const s = new THREE.Vector3();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.castShadow || !m.geometry) return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      m.getWorldScale(s);
      if (m.geometry.boundingSphere!.radius * Math.max(s.x, s.y, s.z) < 0.12) m.castShadow = false;
    });
  }

  /** Called when the part leaves the table for good. */
  dispose() {
    this.root.removeFromParent();
  }
}
