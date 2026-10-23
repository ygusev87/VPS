import * as THREE from 'three';
import type { ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { mat, mesh } from './kit';

export type PartKind = 'battery' | 'bulb' | 'fan' | 'switch' | 'led' | 'buzzer';
export type Polarity = 'plus' | 'minus' | 'none';

export interface ElectricState {
  /** Normalised activity, see solver. Signed for motors. */
  level: number;
  current: number;
  reversed: boolean;
  shorted: boolean;
}

export type Highlight = 'none' | 'available' | 'target' | 'warn';

const POST_H = 0.36;
const PLATE_TOP = 0.24;

const ringGeo = new THREE.TorusGeometry(0.3, 0.04, 8, 40);

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
    readonly key: 'a' | 'b',
    readonly polarity: Polarity,
    local: THREE.Vector3,
  ) {
    this.id = `${part.id}.${key}`;
    const collarColor = polarity === 'plus' ? C.red : polarity === 'minus' ? C.navy2 : C.tealDeep;
    const collar = mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 24), mat(collarColor, 0.45));
    collar.position.y = 0.05;
    const shaft = mesh(new THREE.CylinderGeometry(0.11, 0.11, POST_H, 16), mat(C.brass, 0.35, 0.6));
    shaft.position.y = POST_H / 2;
    const cap = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 20), mat(C.brass, 0.3, 0.7));
    cap.position.y = POST_H;
    const slot = mesh(new THREE.BoxGeometry(0.26, 0.03, 0.04), mat('#8a6a32', 0.5, 0.4), false);
    slot.position.y = POST_H + 0.045;
    this.post.add(collar, shaft, cap, slot);

    this.ringMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0, depthWrite: false });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.1;
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
    const s = 1 + (h === 'none' ? 0 : 0.18 * wave) + this.flash * 0.6;
    this.ring.scale.setScalar(s);
  }
}

let nextId = 1;

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
  /** Pre-placed by a level: can be moved but not thrown away. */
  locked = false;
  closed = false;

  state: ElectricState = { level: 0, current: 0, reversed: false, shorted: false };

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

  protected addTerminal(key: 'a' | 'b', polarity: Polarity, x: number, z: number) {
    const t = new Terminal(this, key, polarity, new THREE.Vector3(x, 0, z));
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

  terminal(key: 'a' | 'b'): Terminal {
    return this.terminals.find((t) => t.key === key)!;
  }

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
  tap(): boolean {
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

  /** Called when the part leaves the table for good. */
  dispose() {
    this.root.removeFromParent();
  }
}
