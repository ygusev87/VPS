// Third wave: things that move and flash — a race track with a car, a
// helicopter that takes off with enough power, a fire truck, a traffic light
// and a disco ball. Sculpted bodies where a model exists; tracks, rotors,
// lamps and the ball are built in code.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { model, sizeOf, tip } from './assets';
import { Part, type Footprint, type PartKind } from './base';
import { basePlate, damp, lightPool, mat, mesh, PLATE_TOP, roundedBox } from './kit';
import { glowFor, sprite } from './models';

/** Which way each vehicle model faces once loaded: turn so its nose points at +x. */
const FACE = { racecar: 0, helicopter: Math.PI / 2, firetruck: Math.PI / 2 };

/** Height of a model's surface at local (x, z), found by dropping a ray on it. */
function surfaceY(o: THREE.Object3D, x: number, z: number, fallback: number): number {
  o.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 50, z).applyMatrix4(o.parent?.matrixWorld ?? new THREE.Matrix4()), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(o, true)[0];
  return hit ? o.parent!.worldToLocal(hit.point.clone()).y : fallback;
}

// ──────────────────────────── Race track ───────────────────────────

const RX = 1.65;
/** Where the chequered line is on the oval (the car stops here on red). */
const STOP_T = Math.PI / 2;
const RZ = 0.92;
const ROAD = 0.27;
const TRACK_Z = -0.3;

function ellipseShape(rx: number, rz: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  return s;
}

function checkerTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#18213d' : '#ffffff';
      ctx.fillRect(i * 4, j * 4, 4, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** An oval road with a little car that laps it; more power, faster laps. */
export class RaceTrack extends Part {
  readonly kind: PartKind = 'track';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 2.5;
  private car = new THREE.Group();
  private body3 = new THREE.Group();
  private lamps: THREE.Sprite[] = [];
  private t = Math.PI / 2;
  private speed = 0;
  private lap = 0;
  /** Set each frame by the game: a powered traffic light beside the track says stop. */
  redLight = false;
  /** The car is standing at the line waiting for green. */
  waiting = false;

  constructor() {
    super();
    const plate = basePlate(4.6, 3.3, 'трасса');
    const track = new THREE.Group();
    track.position.set(0, PLATE_TOP, TRACK_Z);

    const grass = mesh(new THREE.ShapeGeometry(ellipseShape(RX - ROAD, RZ - ROAD), 48), mat('#86c26d', 0.9), false);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.012;
    grass.receiveShadow = true;
    const ring = ellipseShape(RX + ROAD, RZ + ROAD);
    ring.holes.push(ellipseShape(RX - ROAD, RZ - ROAD));
    const road = mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.035, bevelEnabled: false, curveSegments: 64 }), mat('#4b505c', 0.85), false);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    track.add(grass, road);

    // Kerbs along both edges, dashes down the middle.
    const n = 64;
    const kerb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.03, 0.06), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n * 2);
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.01, 0.025), new THREE.MeshBasicMaterial({ color: '#f5f0e6' }), n / 2);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ang = Math.atan2(RZ * Math.cos(a), -RX * Math.sin(a));
      q.setFromAxisAngle(up, -ang);
      for (const [k, r] of [
        [0, ROAD + 0.03],
        [1, -ROAD - 0.03],
      ] as const) {
        const nx = Math.cos(a) * (RX + r);
        const nz = Math.sin(a) * (RZ + r);
        m4.compose(new THREE.Vector3(nx, 0.05, nz), q, new THREE.Vector3(1, 1, 1));
        kerb.setMatrixAt(i * 2 + k, m4);
        kerb.setColorAt(i * 2 + k, new THREE.Color(i % 2 ? C.red : '#ffffff'));
      }
      if (i % 2 === 0) {
        m4.compose(new THREE.Vector3(Math.cos(a) * RX, 0.04, Math.sin(a) * RZ), q, new THREE.Vector3(1, 1, 1));
        dash.setMatrixAt(i / 2, m4);
      }
    }
    kerb.castShadow = true;
    track.add(kerb, dash);

    const start = new THREE.Mesh(new THREE.PlaneGeometry(0.12, ROAD * 2), new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.7 }));
    start.rotation.x = -Math.PI / 2;
    start.position.set(0, 0.04, RZ);
    start.rotation.z = Math.PI / 2;
    track.add(start);

    // The car: nose along +x of its own group.
    const sculpt = model('racecar', { width: 0.66, rotateY: FACE.racecar });
    if (sculpt) this.body3.add(sculpt);
    else {
      const shell = roundedBox(0.62, 0.16, 0.3, 0.06, C.red, 0.35);
      shell.position.y = 0.13;
      const cab = roundedBox(0.26, 0.12, 0.24, 0.05, '#bfe3f0', 0.2);
      cab.position.set(-0.04, 0.25, 0);
      this.body3.add(shell, cab);
      for (const [x, z] of [
        [0.2, 0.15],
        [-0.2, 0.15],
        [0.2, -0.15],
        [-0.2, -0.15],
      ]) {
        const w = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), mat('#22252c', 0.7));
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.07, z);
        this.body3.add(w);
      }
    }
    for (const z of [-0.08, 0.08]) {
      const l = sprite(glowFor('rgba(255,236,170,0.95)'), 0.22);
      l.position.set(0.36, 0.12, z);
      this.lamps.push(l);
      this.body3.add(l);
    }
    this.car.add(this.body3);
    track.add(this.car);
    this.placeCar();

    this.body.add(plate, track);
    this.addTerminal('a', 'none', 1.95, 1.3);
    this.addTerminal('b', 'none', -1.95, 1.3);
    this.pickable(plate, track);
  }

  footprint(): Footprint {
    return { x0: -RX - ROAD - 0.1, x1: RX + ROAD + 0.1, z0: TRACK_Z - RZ - ROAD - 0.1, z1: TRACK_Z + RZ + ROAD + 0.1 };
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 10 };
  }

  /** How fast the car goes now (0..~1.6), for the engine sound. */
  get carSpeed() {
    return Math.abs(this.speed) / 2.2;
  }

  private onCar(hit: THREE.Object3D | null) {
    for (let o = hit; o; o = o.parent) if (o === this.car) return true;
    return false;
  }

  controlAt(hit: THREE.Object3D | null): boolean {
    return this.onCar(hit);
  }

  tap(hit?: THREE.Object3D | null): boolean {
    super.tap();
    if (this.onCar(hit ?? null)) this.sounds.push({ kind: 'honk' });
    return false;
  }

  private placeCar() {
    const x = Math.cos(this.t) * RX;
    const z = Math.sin(this.t) * RZ;
    const dir = Math.sign(this.speed) || 1;
    const dx = -Math.sin(this.t) * RX * dir;
    const dz = Math.cos(this.t) * RZ * dir;
    this.car.position.set(x, 0.04, z);
    this.car.rotation.y = -Math.atan2(dz, dx);
  }

  protected animate(dt: number) {
    let target = Math.max(-1.6, Math.min(1.6, this.state.level)) * 2.2;
    // On red the car brakes smoothly to the chequered line and waits there.
    const TAU = Math.PI * 2;
    const dir = Math.sign(target || this.speed);
    const ahead = dir > 0 ? (((STOP_T - this.t) % TAU) + TAU) % TAU : (((this.t - STOP_T) % TAU) + TAU) % TAU;
    const braking = this.redLight && dir !== 0 && ahead < 1.1;
    if (braking) target = dir * Math.min(Math.abs(target), ahead * 3);
    this.speed = damp(this.speed, target, braking ? 6 : 1.5, dt);
    const before = Math.floor(this.t / TAU);
    let step = this.speed * dt;
    if (braking && Math.abs(step) >= ahead) step = dir * ahead;
    this.waiting = braking && ahead - Math.abs(step) < 0.02;
    if (this.waiting) this.speed = 0;
    this.t += step;
    const after = Math.floor(this.t / (Math.PI * 2));
    if (after !== before && Math.abs(this.speed) > 0.5) {
      this.lap++;
      this.sounds.push({ kind: 'lap' });
    }
    this.placeCar();
    // Lean out on the bends and rumble a little with speed.
    const v = Math.abs(this.speed);
    this.body3.rotation.x = Math.sin(this.t * 2) * 0.05 * Math.min(1, v / 2) * Math.sign(this.speed);
    this.body3.position.y = Math.abs(Math.sin(this.time * 40)) * 0.01 * Math.min(1, v);
    for (const l of this.lamps) l.material.opacity = damp(l.material.opacity, v > 0.2 ? 0.9 : 0, 6, dt);
  }
}

// ──────────────────────────── Helicopter ───────────────────────────

function padTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3c4458';
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(128, 128, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 140px "Fira Sans Condensed", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Spins its rotor on any power; with twice the power it lifts off and hovers. */
export class Helicopter extends Part {
  readonly kind: PartKind = 'helicopter';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.5;
  private craft = new THREE.Group();
  private rotor = new THREE.Group();
  private tail = new THREE.Group();
  private blur: THREE.Mesh;
  private spin = 0;
  private alt = 0;
  /** Seconds the rotor has been turning without enough power to fly. */
  grounded = 0;

  constructor() {
    super();
    const plate = basePlate(2.9, 2.7, 'вертолёт');
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), new THREE.MeshStandardMaterial({ map: padTexture(), roughness: 0.8 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, PLATE_TOP + 0.004, -0.2);
    pad.receiveShadow = true;

    const sculpt = model('helicopter', { width: 1.7, rotateY: FACE.helicopter });
    let top = new THREE.Vector3(0.1, 0.75, 0);
    let tailTip = new THREE.Vector3(-0.85, 0.5, 0);
    if (sculpt) {
      this.craft.add(sculpt);
      top = tip(sculpt, 'y', 1, 0.04);
      tailTip = tip(sculpt, 'x', -1, 0.06);
    } else {
      const cabin = mesh(new THREE.SphereGeometry(0.4, 24, 16), mat('#f2c230', 0.35));
      cabin.scale.set(1.2, 0.9, 0.9);
      cabin.position.set(0.15, 0.45, 0);
      const boom = mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.8, 12), mat('#f2c230', 0.35));
      boom.rotation.z = Math.PI / 2;
      boom.position.set(-0.55, 0.5, 0);
      this.craft.add(cabin, boom);
      top = new THREE.Vector3(0.15, 0.8, 0);
    }
    // Main rotor: two long blades on a hub, plus a faint disc that shows the blur at speed.
    const hub = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 16), mat(C.metal, 0.3, 0.8));
    const blades = roundedBox(2.1, 0.025, 0.14, 0.012, C.navy2, 0.4);
    blades.position.y = 0.04;
    this.rotor.add(hub, blades);
    this.rotor.position.copy(top).add(new THREE.Vector3(0, 0.05, 0));
    this.blur = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 48),
      new THREE.MeshBasicMaterial({ color: '#c9d3e6', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.blur.rotation.x = -Math.PI / 2;
    this.blur.position.copy(this.rotor.position).add(new THREE.Vector3(0, 0.05, 0));
    const tb = roundedBox(0.5, 0.02, 0.07, 0.01, C.navy2, 0.4);
    this.tail.add(tb);
    this.tail.position.copy(tailTip).add(new THREE.Vector3(0, 0, 0.07));
    this.tail.rotation.x = Math.PI / 2;
    this.craft.add(this.rotor, this.blur, this.tail);
    this.craft.position.set(0, PLATE_TOP, -0.2);

    this.body.add(plate, pad, this.craft);
    this.addTerminal('a', 'none', 1.15, 0.95);
    this.addTerminal('b', 'none', -1.15, 0.95);
    this.pickable(plate, this.craft);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 8 };
  }

  get flying() {
    return this.alt > 0.3;
  }

  /** Rotor speed 0..~1.6 for the whir sound. */
  get rotorSpeed() {
    return Math.abs(this.spin) / 30;
  }

  protected animate(dt: number) {
    const l = Math.max(-1.8, Math.min(1.8, this.state.level));
    this.spin = damp(this.spin, l * 30, 1.6, dt);
    this.rotor.rotation.y += this.spin * dt;
    this.tail.rotation.y += this.spin * 1.4 * dt;
    (this.blur.material as THREE.MeshBasicMaterial).opacity = Math.min(0.35, Math.abs(this.spin) / 60);
    // Lift needs about twice one battery: a 6 V pack or two in series.
    const lift = Math.max(0, Math.abs(l) - 1.35) * 2.6;
    this.alt = damp(this.alt, Math.min(1.6, lift), 1.1, dt);
    const sway = this.alt > 0.05 ? Math.sin(this.time * 1.7) : 0;
    this.craft.position.y = PLATE_TOP + this.alt + sway * 0.05 * Math.min(1, this.alt);
    this.craft.rotation.z = sway * 0.04 * Math.min(1, this.alt);
    this.craft.rotation.x = Math.cos(this.time * 1.3) * 0.03 * Math.min(1, this.alt);
    this.grounded = Math.abs(l) > 0.3 && !this.flying ? this.grounded + dt : 0;
  }
}

// ──────────────────────────── Fire truck ───────────────────────────

/** Flashes red and blue and sounds its siren for a while when power comes on. */
export class FireTruck extends Part {
  readonly kind: PartKind = 'firetruck';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.7;
  /** Seconds of siren left; tapping the truck winds it up again. */
  siren = 0;
  private beacons: { s: THREE.Sprite; cap: THREE.MeshStandardMaterial; color: string }[] = [];
  private pools: THREE.Mesh[] = [];
  private head: THREE.Sprite[] = [];
  private was = false;

  constructor() {
    super();
    const plate = basePlate(3.3, 2.1, 'пожарная');
    const truck = new THREE.Group();
    const sculpt = model('firetruck', { width: 2.5, rotateY: FACE.firetruck });
    let size = new THREE.Vector3(2.5, 1.0, 1.1);
    if (sculpt) {
      truck.add(sculpt);
      size = sizeOf(sculpt);
    } else {
      const b = roundedBox(2.5, 0.6, 1.0, 0.1, C.red, 0.35);
      b.position.y = 0.45;
      truck.add(b);
    }
    truck.position.set(0, PLATE_TOP, -0.2);
    // Beacons on the cab roof (the cab is the +x end).
    const cabX = size.x / 2 - 0.42;
    const roof = sculpt ? surfaceY(sculpt, cabX, 0, size.y) : size.y;
    for (const [z, color] of [
      [-0.16, '#ff3b30'],
      [0.16, '#3b82ff'],
    ] as const) {
      const cap = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.25, transparent: true, opacity: 0.9 });
      const m = mesh(new THREE.CapsuleGeometry(0.07, 0.1, 6, 12), cap);
      m.rotation.x = Math.PI / 2;
      m.position.set(cabX, roof + 0.05, z);
      const s = sprite(glowFor(color === '#ff3b30' ? 'rgba(255,70,60,0.95)' : 'rgba(70,130,255,0.95)'), 0.9);
      s.position.set(cabX, roof + 0.12, z);
      truck.add(m, s);
      this.beacons.push({ s, cap, color });
      const pool = lightPool(3.0, color === '#ff3b30' ? 'rgba(255,60,50,0.55)' : 'rgba(60,120,255,0.55)');
      pool.position.set(z < 0 ? 0.4 : -0.4, PLATE_TOP + 0.01, -0.2 + z * 3);
      this.pools.push(pool);
      this.body.add(pool);
    }
    for (const z of [-0.3, 0.3]) {
      const h = sprite(glowFor('rgba(255,240,190,0.95)'), 0.3);
      h.position.set(size.x / 2 + 0.02, 0.32, z);
      truck.add(h);
      this.head.push(h);
    }

    this.body.add(plate, truck);
    this.addTerminal('a', 'none', 1.35, 0.72);
    this.addTerminal('b', 'none', -1.35, 0.72);
    this.pickable(plate, truck);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 15 };
  }

  get powered() {
    return this.state.level > 0.2;
  }

  tap(hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap(hit, point);
    if (this.powered) this.siren = 4;
    else this.sounds.push({ kind: 'honk' });
    return false;
  }

  protected animate(dt: number) {
    const on = this.powered;
    if (on && !this.was) this.siren = 4;
    this.was = on;
    this.siren = Math.max(0, this.siren - dt);
    const phase = Math.floor(this.time * 6) % 2;
    this.beacons.forEach((b, i) => {
      const lit = on && phase === i;
      b.s.material.opacity = damp(b.s.material.opacity, lit ? 1 : 0, 30, dt);
      b.cap.emissiveIntensity = lit ? 2.5 : 0.1;
      this.pools[i].visible = true;
      (this.pools[i].material as THREE.MeshBasicMaterial).opacity = damp((this.pools[i].material as THREE.MeshBasicMaterial).opacity, lit ? 0.8 : 0, 30, dt);
    });
    for (const h of this.head) h.material.opacity = damp(h.material.opacity, on ? 0.9 : 0, 6, dt);
  }
}

// ─────────────────────────── Traffic light ─────────────────────────

const PHASES: { lamps: [boolean, boolean, boolean]; time: number; blink?: number }[] = [
  { lamps: [true, false, false], time: 3 },
  { lamps: [true, true, false], time: 1 },
  { lamps: [false, false, true], time: 3 },
  { lamps: [false, false, true], time: 1.4, blink: 2 },
  { lamps: [false, true, false], time: 1 },
];
const LAMP_COLORS = ['#ff3b30', '#ffc21a', '#22c55e'];

/** Red, yellow, green on its own once powered; a tap skips to the next light. */
export class TrafficLight extends Part {
  readonly kind: PartKind = 'trafficLight';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.0;
  private phase = 0;
  private left = PHASES[0].time;
  private lenses: THREE.MeshStandardMaterial[] = [];
  private glows: THREE.Sprite[] = [];

  constructor() {
    super();
    const plate = basePlate(1.9, 1.8, 'светофор');
    const pole = mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 16), mat('#9aa1ad', 0.35, 0.6));
    pole.position.set(0, PLATE_TOP + 0.5, -0.25);
    const foot = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 24), mat(C.navy2, 0.5));
    foot.position.set(0, PLATE_TOP + 0.04, -0.25);
    const box = roundedBox(0.62, 1.5, 0.44, 0.1, C.navy2, 0.45);
    box.position.set(0, PLATE_TOP + 1.65, -0.25);
    this.body.add(plate, pole, foot, box);
    LAMP_COLORS.forEach((color, i) => {
      const y = PLATE_TOP + 2.13 - i * 0.47;
      const m = new THREE.MeshStandardMaterial({ color: '#3b3f4a', emissive: color, emissiveIntensity: 0, roughness: 0.2 });
      const lens = mesh(new THREE.SphereGeometry(0.17, 24, 16), m);
      lens.scale.z = 0.45;
      lens.position.set(0, y, -0.02);
      const visor = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.22, 24, 1, true, -Math.PI / 2, Math.PI), mat(C.navy2, 0.45));
      visor.rotation.x = Math.PI / 2;
      visor.position.set(0, y + 0.02, 0.06);
      (visor.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      const g = sprite(glowFor(color === LAMP_COLORS[0] ? 'rgba(255,70,60,0.9)' : color === LAMP_COLORS[1] ? 'rgba(255,200,40,0.9)' : 'rgba(40,210,100,0.9)'), 0.9);
      g.position.set(0, y, 0.1);
      this.body.add(lens, visor, g);
      this.lenses.push(m);
      this.glows.push(g);
    });
    this.addTerminal('a', 'none', 0.62, 0.55);
    this.addTerminal('b', 'none', -0.62, 0.55);
    this.pickable(plate, pole, box);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 20 };
  }

  get powered() {
    return this.state.level > 0.2;
  }

  /** Powered and not showing green: cars beside it should stop. */
  get stopsTraffic() {
    return this.powered && !PHASES[this.phase].lamps[2];
  }

  tap(hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap(hit, point);
    if (!this.powered) {
      this.sounds.push({ kind: 'noPower' });
      return false;
    }
    this.next();
    return false;
  }

  private next() {
    this.phase = (this.phase + 1) % PHASES.length;
    this.left = PHASES[this.phase].time;
    this.sounds.push({ kind: 'tick' });
  }

  protected animate(dt: number) {
    const on = this.powered;
    if (on) {
      this.left -= dt;
      if (this.left <= 0) this.next();
    }
    const p = PHASES[this.phase];
    const blinkOff = p.blink ? Math.floor(this.time * p.blink * 2) % 2 === 1 : false;
    this.lenses.forEach((m, i) => {
      const lit = on && p.lamps[i] && !blinkOff;
      m.emissiveIntensity = damp(m.emissiveIntensity, lit ? 2.6 : 0, 18, dt);
      this.glows[i].material.opacity = damp(this.glows[i].material.opacity, lit ? 0.85 : 0, 18, dt);
    });
  }
}

// ──────────────────────────── Disco ball ───────────────────────────

const SPOT_COLORS = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b388ff', '#ff9f1c'];

/** A mirror ball that spins and scatters coloured spots over the table. */
export class DiscoBall extends Part {
  readonly kind: PartKind = 'disco';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.1;
  private ball: THREE.Mesh;
  private spots: { m: THREE.Mesh; r: number; a: number; s: number }[] = [];
  private spin = 0;
  private turn = 0;

  constructor() {
    super();
    const plate = basePlate(2.1, 2.0, 'диско');
    const metal = mat('#9aa1ad', 0.3, 0.7);
    const arch = mesh(new THREE.TorusGeometry(0.9, 0.045, 10, 40, Math.PI), metal);
    arch.position.set(0, PLATE_TOP + 0.05, -0.2);
    const base = mesh(new THREE.BoxGeometry(1.95, 0.08, 0.22), mat(C.navy2, 0.5));
    base.position.set(0, PLATE_TOP + 0.04, -0.2);
    const chain = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), metal);
    chain.position.set(0, PLATE_TOP + 0.85, -0.2);
    this.ball = mesh(
      new THREE.IcosahedronGeometry(0.36, 2),
      new THREE.MeshStandardMaterial({ color: '#e6ebf2', metalness: 1, roughness: 0.12, flatShading: true }),
    );
    this.ball.position.set(0, PLATE_TOP + 0.39, -0.2);
    this.body.add(plate, arch, base, chain, this.ball);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(0.17 + (i % 3) * 0.04, 20),
        new THREE.MeshBasicMaterial({ color: SPOT_COLORS[i % SPOT_COLORS.length], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      this.spots.push({ m, r: 1.3 + (i % 4) * 0.55, a: (i / 14) * Math.PI * 2 * 3, s: 0.8 + (i % 3) * 0.25 });
      this.body.add(m);
    }
    this.addTerminal('a', 'none', 0.7, 0.62);
    this.addTerminal('b', 'none', -0.7, 0.62);
    this.pickable(plate, arch, this.ball);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 12 };
  }

  protected animate(dt: number) {
    const l = Math.min(1.6, Math.abs(this.state.level));
    this.spin = damp(this.spin, l * 2.2, 1.5, dt);
    this.ball.rotation.y += this.spin * dt;
    this.turn += this.spin * dt;
    for (const s of this.spots) {
      const a = s.a + this.turn * s.s;
      s.m.position.set(Math.cos(a) * s.r, 0.02, -0.2 + Math.sin(a) * s.r * 0.8);
      (s.m.material as THREE.MeshBasicMaterial).opacity = damp((s.m.material as THREE.MeshBasicMaterial).opacity, l > 0.15 ? 0.55 + 0.3 * Math.sin(this.time * 5 + s.r) : 0, 6, dt);
    }
  }
}
