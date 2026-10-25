// Parts built into the city map: the tram's substation, pinned to the map
// like the farm's gate — wire it to a pole and the trams get their power.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox } from './kit';

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
