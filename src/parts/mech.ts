// Big machines that keep going: a marble run with a screw lift, a water mill
// with a pump, and a conveyor belt with a press and a paint tunnel. All built
// from code; speed follows the power, and they settle slowly when it stops.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox } from './kit';
import { glowFor, sprite } from './models';

const T = PLATE_TOP;
const RAINBOW = ['#e5533d', '#f08a3a', '#f2c230', '#5cb85c', '#2bb3a8', '#3f86d6', '#8a63c9', '#d45fa8'];

/** A spur gear lying in the x/y plane (turn it to face elsewhere), centred on z. */
export function gearGeometry(teeth: number, r: number, depth: number, hole = 0.3): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const th = Math.min(0.08, r * 0.18);
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i % 4;
    const rr = k === 1 || k === 2 ? r : r - th;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const h = new THREE.Path();
  h.absarc(0, 0, r * hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A gear with a hub and an axle pin, as a group (faces +z). */
function gear(teeth: number, r: number, color: string, depth = 0.08): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(gearGeometry(teeth, r, depth), mat(color, 0.4, 0.25)));
  const hub = mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, depth + 0.04, 16), mat(C.metal, 0.3, 0.8));
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

abstract class Machine extends Part {
  readonly elementKind: ElementKind = 'motor';
  /** Signed drive, 0 when off; follows the power smoothly. */
  protected drive = 0;

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  get running() {
    return Math.abs(this.drive) > 0.05;
  }

  protected updateDrive(dt: number, up = 1.5, down = 1.2) {
    const target = Math.max(-1.6, Math.min(1.6, this.state.level));
    this.drive = damp(this.drive, target, Math.abs(target) > Math.abs(this.drive) ? up : down, dt);
  }
}

// ───────────────────────────── Marble run ─────────────────────────────

const LX = 1.55;
const LZ = -0.55;
const LIFT_Y0 = T + 0.22;
const LIFT_Y1 = T + 2.75;
const BALL_R = 0.1;
const PITCH = 0.5;
const FUNNEL = new THREE.Vector3(-1.35, 0, -0.08);
const WHEEL_AT = new THREE.Vector3(0.1, T + 1.39, 0.45);

/** A sampled path the balls follow, with arc length. */
class Track {
  pts: THREE.Vector3[] = [];
  cum: number[] = [];
  /** Rolling speed at each sample. */
  speed: number[] = [];
  length = 0;
  add(p: THREE.Vector3) {
    const last = this.pts.at(-1);
    this.cum.push(last ? this.length + last.distanceTo(p) : 0);
    this.length = this.cum.at(-1)!;
    this.pts.push(p);
  }
  index(s: number): number {
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  at(s: number, out: THREE.Vector3): THREE.Vector3 {
    const i = this.index(s);
    const j = Math.min(i + 1, this.pts.length - 1);
    const span = this.cum[j] - this.cum[i] || 1;
    return out.copy(this.pts[i]).lerp(this.pts[j], (s - this.cum[i]) / span);
  }
}

/** Two rails under a stretch of path, with posts down to the plate. */
function rails(points: THREE.Vector3[], color: string, posts: boolean): THREE.Group {
  const g = new THREE.Group();
  const up = new THREE.Vector3(0, 1, 0);
  for (const side of [-1, 1]) {
    const rail: THREE.Vector3[] = [];
    points.forEach((p, i) => {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(points.length - 1, i + 1)];
      const t = b.clone().sub(a).normalize();
      const n = t.clone().cross(up).setY(0).normalize();
      rail.push(p.clone().addScaledVector(n, side * 0.075).add(new THREE.Vector3(0, -0.075, 0)));
    });
    const curve = new THREE.CatmullRomCurve3(rail);
    g.add(mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 2), 0.022, 6, false), mat(color, 0.35, 0.3)));
  }
  if (posts) {
    const wood = mat('#c98a4b', 0.6);
    let since = 0.3;
    for (let i = 1; i < points.length; i++) {
      since += points[i].distanceTo(points[i - 1]);
      const p = points[i];
      if (since < 0.85 || p.y < T + 0.45) continue;
      since = 0;
      const h = p.y - 0.1 - T;
      const post = mesh(new THREE.CylinderGeometry(0.03, 0.035, h, 8), wood);
      post.position.set(p.x, T + h / 2, p.z);
      g.add(post);
    }
  }
  return g;
}

/**
 * Coloured balls ride up a screw lift, roll down three zig-zag ramps, turn a
 * paddle wheel, spiral round a funnel and come back to the lift — for ever.
 */
export class MarbleRun extends Machine {
  readonly kind: PartKind = 'marbleRun';
  readonly radius = 2.6;
  private track = new Track();
  private liftLen = 0;
  /** Where the funnel spiral starts and the paddle wheel sits, along the track. */
  private funnelAt = 0;
  private wheelS = 0;
  private balls: { mesh: THREE.Mesh; s: number }[] = [];
  private screw: THREE.Group;
  private gears: { g: THREE.Group; ratio: number }[] = [];
  private wheel = new THREE.Group();
  private wheelSpin = 0;
  private liftSpeed = 0;

  constructor() {
    super();
    const plate = basePlate(4.4, 2.9, 'горка');
    const frame = new THREE.Group();
    const tr = this.track;

    // 1. The lift: straight up the glass tube.
    for (let y = LIFT_Y0; y < LIFT_Y1; y += 0.05) tr.add(new THREE.Vector3(LX, y, LZ));
    tr.add(new THREE.Vector3(LX, LIFT_Y1, LZ));
    this.liftLen = tr.length;

    // 2. Ramps: out of the top, zig-zag down to the funnel.
    const ramp = new THREE.CatmullRomCurve3(
      [
        [LX, LIFT_Y1, LZ],
        [LX - 0.12, T + 2.84, LZ - 0.04],
        [LX - 0.45, T + 2.74, LZ - 0.12],
        [-1.5, T + 2.32, -0.88],
        [-1.86, T + 2.24, -0.56],
        [-1.6, T + 2.16, -0.24],
        [0.95, T + 1.72, -0.2],
        [1.27, T + 1.64, 0.1],
        [0.95, T + 1.56, 0.42],
        [WHEEL_AT.x, WHEEL_AT.y, WHEEL_AT.z],
        [-0.95, T + 1.12, 0.42],
        [FUNNEL.x, T + 1.02, FUNNEL.z + 0.5],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      'centripetal',
    );
    const rampPts = ramp.getSpacedPoints(160);
    for (const p of rampPts.slice(1)) tr.add(p);
    // Find the wheel along the track.
    let best = Infinity;
    for (let i = 0; i < tr.pts.length; i++) {
      const d = tr.pts[i].distanceTo(WHEEL_AT);
      if (d < best) {
        best = d;
        this.wheelS = tr.cum[i];
      }
    }
    this.funnelAt = tr.length;

    // 3. Round and round the funnel, faster as it narrows.
    const turns = 2.25;
    for (let i = 1; i <= 120; i++) {
      const u = i / 120;
      const a = Math.PI / 2 + u * turns * Math.PI * 2;
      const r = 0.47 - 0.4 * u ** 0.85;
      tr.add(new THREE.Vector3(FUNNEL.x + Math.cos(a) * r, T + 1.02 - u * 0.5, FUNNEL.z + Math.sin(a) * r));
    }
    // 4. Drop through the hole and roll home along the floor to the lift.
    const home = new THREE.CatmullRomCurve3(
      [
        [FUNNEL.x, T + 0.5, FUNNEL.z],
        [FUNNEL.x, T + 0.24, FUNNEL.z + 0.1],
        [FUNNEL.x + 0.5, T + 0.21, FUNNEL.z + 0.45],
        [0.4, T + 0.2, 0.62],
        [1.35, T + 0.2, 0.42],
        [LX + 0.12, T + 0.2, LZ + 0.4],
        [LX, LIFT_Y0, LZ],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      'centripetal',
    );
    const homePts = home.getSpacedPoints(80);
    for (const p of homePts.slice(1)) tr.add(p);

    // Rolling speed from the slope: steeper is faster, the funnel is quick.
    for (let i = 0; i < tr.pts.length; i++) {
      const a = tr.pts[Math.max(0, i - 4)];
      const b = tr.pts[Math.min(tr.pts.length - 1, i + 4)];
      const ds = Math.max(1e-3, tr.cum[Math.min(tr.pts.length - 1, i + 4)] - tr.cum[Math.max(0, i - 4)]);
      const slope = Math.max(0, (a.y - b.y) / ds);
      tr.speed.push(Math.min(2.6, 1.1 + slope * 5));
    }

    frame.add(rails(rampPts, C.teal, true), rails(homePts.slice(3), C.teal, false));

    // Glass lift tube with the screw inside, a motor and gears on top.
    const tubeH = LIFT_Y1 - T + 0.1;
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, tubeH, 28, 1, true),
      new THREE.MeshStandardMaterial({ color: '#dff4f2', roughness: 0.1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    glass.position.set(LX, T + tubeH / 2, LZ);
    const helix: THREE.Vector3[] = [];
    for (let y = 0; y <= tubeH; y += 0.025) {
      const a = (y / PITCH) * Math.PI * 2;
      helix.push(new THREE.Vector3(Math.cos(a) * 0.135, y, Math.sin(a) * 0.135));
    }
    this.screw = new THREE.Group();
    this.screw.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), helix.length, 0.025, 6, false), mat(C.amber, 0.4)));
    const axle = mesh(new THREE.CylinderGeometry(0.02, 0.02, tubeH, 8), mat(C.metal, 0.3, 0.8));
    axle.position.y = tubeH / 2;
    this.screw.add(axle);
    this.screw.position.set(LX, T, LZ);
    for (const y of [T + 0.05, LIFT_Y1 + 0.1]) {
      const collar = mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 28), mat(C.navy2, 0.5));
      collar.rotation.x = Math.PI / 2;
      collar.position.set(LX, y, LZ);
      frame.add(collar);
    }
    // Top: big gear on the screw, pinion on the motor behind it.
    const top = LIFT_Y1 + 0.24;
    const big = gear(16, 0.32, C.amber);
    big.rotation.x = -Math.PI / 2;
    big.position.set(LX, top, LZ);
    const pin = gear(9, 0.18, C.red);
    pin.rotation.x = -Math.PI / 2;
    pin.position.set(LX, top, LZ - 0.5);
    const motor = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.38, 24), mat(C.navy2, 0.4));
    motor.position.set(LX, top + 0.24, LZ - 0.5);
    const motorCap = mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 24), mat(C.red, 0.45));
    motorCap.position.set(LX, top + 0.45, LZ - 0.5);
    const mast = mesh(new THREE.CylinderGeometry(0.05, 0.06, top - T, 10), mat('#c98a4b', 0.6));
    mast.position.set(LX, T + (top - T) / 2 - 0.05, LZ - 0.5);
    frame.add(big, pin, motor, motorCap, mast);
    this.gears.push({ g: big, ratio: 1 }, { g: pin, ratio: -16 / 9 });
    // Side gears on the tower, just for the joy of watching them turn.
    const g1 = gear(14, 0.3, C.teal);
    g1.position.set(LX + 0.45, T + 0.95, LZ + 0.05);
    const g2 = gear(8, 0.17, C.amber);
    g2.position.set(LX + 0.45, T + 0.95 + 0.45, LZ + 0.05);
    const g3 = gear(10, 0.21, C.red);
    g3.position.set(LX + 0.45, T + 0.95 + 0.45 + 0.36, LZ + 0.05);
    const strut = mesh(new THREE.BoxGeometry(0.06, 1.5, 0.05), mat('#c98a4b', 0.6));
    strut.position.set(LX + 0.45, T + 0.85, LZ - 0.02);
    frame.add(strut, g1, g2, g3);
    this.gears.push({ g: g1, ratio: 1.2 }, { g: g2, ratio: -1.2 * (14 / 8) }, { g: g3, ratio: 1.2 * (14 / 10) });

    // Paddle wheel over the bottom ramp.
    for (let i = 0; i < 6; i++) {
      const p = roundedBox(0.06, 0.3, 0.22, 0.02, i % 2 ? C.red : '#f2c230', 0.5);
      p.position.y = 0;
      p.geometry.translate(0, 0.05, 0);
      const arm = new THREE.Group();
      arm.add(p);
      arm.rotation.z = (i * Math.PI) / 3;
      this.wheel.add(arm);
    }
    const hubW = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), mat(C.metal, 0.3, 0.8));
    hubW.rotation.x = Math.PI / 2;
    this.wheel.add(hubW);
    this.wheel.position.copy(WHEEL_AT).add(new THREE.Vector3(0, 0.33, 0));
    const wheelPost = mesh(new THREE.CylinderGeometry(0.03, 0.035, WHEEL_AT.y + 0.33 - T, 8), mat('#c98a4b', 0.6));
    wheelPost.position.set(WHEEL_AT.x, T + (WHEEL_AT.y + 0.33 - T) / 2, WHEEL_AT.z - 0.2);
    frame.add(wheelPost);

    // The funnel.
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      prof.push(new THREE.Vector2(0.12 + 0.48 * u ** 1.3, T + 0.4 + u * 0.62));
    }
    const funnel = mesh(new THREE.LatheGeometry(prof, 36), new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.35, side: THREE.DoubleSide }));
    funnel.position.set(FUNNEL.x, 0, FUNNEL.z);
    const rim = mesh(new THREE.TorusGeometry(0.6, 0.025, 8, 40), mat(C.red, 0.4));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(FUNNEL.x, T + 1.02, FUNNEL.z);
    frame.add(funnel, rim);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + 0.4;
      const leg = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.7, 8), mat('#c98a4b', 0.6));
      leg.position.set(FUNNEL.x + Math.cos(a) * 0.4, T + 0.35, FUNNEL.z + Math.sin(a) * 0.4);
      frame.add(leg);
    }

    // Twelve balls, queued at the bottom of the lift to start with.
    const ballGeo = new THREE.SphereGeometry(BALL_R, 20, 14);
    for (let i = 0; i < 12; i++) {
      const m = mesh(ballGeo, mat(RAINBOW[i % RAINBOW.length], 0.25, 0.1));
      this.balls.push({ mesh: m, s: tr.length - 0.05 - i * 0.24 });
      frame.add(m);
    }

    this.body.add(plate, frame, glass, this.screw, this.wheel);
    this.addTerminal('a', 'none', 1.95, 1.15);
    this.addTerminal('b', 'none', -1.95, 1.15);
    this.pickable(plate, frame, glass, this.screw, this.wheel);
    this.placeBalls();
  }

  private placeBalls() {
    for (const b of this.balls) this.track.at(b.s, b.mesh.position);
  }

  protected animate(dt: number) {
    this.updateDrive(dt, 1.6, 2.5);
    this.liftSpeed = Math.abs(this.drive) * 0.75;
    const L = this.track.length;
    const tr = this.track;
    // Leaders first, so followers queue behind where the leader now is.
    const order = [...this.balls].sort((a, b) => b.s - a.s);
    for (let k = 0; k < order.length; k++) {
      const b = order[k];
      const lead = k === 0 ? order[order.length - 1].s + L : order[k - 1].s;
      const inLift = b.s < this.liftLen;
      const v = inLift ? this.liftSpeed : tr.speed[tr.index(b.s)];
      let next = b.s + v * dt;
      const nextLift = next >= L || next < this.liftLen;
      const gap = inLift || nextLift ? PITCH : BALL_R * 2.3;
      next = Math.min(next, lead - gap);
      if (next < b.s) next = b.s;
      // Events along the way, for sound and the paddle wheel.
      if (b.s < this.wheelS && next >= this.wheelS) {
        this.wheelSpin = -9;
        this.sounds.push({ kind: 'marble' });
      }
      if (b.s < this.funnelAt && next >= this.funnelAt) this.sounds.push({ kind: 'marble' });
      b.s = next >= L ? next - L : next;
    }
    this.placeBalls();
    for (const b of this.balls) b.mesh.rotation.x += dt * 8;
    const spin = (this.liftSpeed / PITCH) * Math.PI * 2;
    this.screw.rotation.y -= spin * dt;
    for (const g of this.gears) g.g.rotation.z += spin * 0.4 * g.ratio * dt;
    this.wheelSpin = damp(this.wheelSpin, 0, 0.8, dt);
    this.wheel.rotation.z += this.wheelSpin * dt;
  }
}

// ───────────────────────────── Water mill ─────────────────────────────

const POOL = { x0: -1.0, x1: 1.2, z0: -1.12, z1: -0.02, h: 0.42 };
const WHEEL = new THREE.Vector3(-0.15, T + 1.12, -0.57);
const WHEEL_R = 0.6;
const SPOUT = new THREE.Vector3(0.4, T + 1.95, -0.57);
const PIPE = [
  new THREE.Vector3(-1.45, T + 0.55, -0.57),
  new THREE.Vector3(-1.45, T + 2.3, -0.57),
  new THREE.Vector3(0.95, T + 2.3, -0.57),
];

/**
 * The pump lifts water up a clear pipe into a high trough; it pours onto the
 * mill wheel and falls back into the pool. Switch off and the trough keeps
 * pouring for a while, so the wheel slows down gently.
 */
export class WaterMill extends Machine {
  readonly kind: PartKind = 'waterMill';
  readonly radius = 2.1;
  /** Water in the pool and up in the trough, 0..1 each (they add up to 1). */
  pool = 1;
  trough = 0;
  /** How fast water pours from the trough now, for the sound. */
  pour = 0;
  private wheel = new THREE.Group();
  private omega = 0;
  private poolWater: THREE.Mesh;
  private troughWater: THREE.Mesh;
  private blobs: { mesh: THREE.Mesh; u: number }[] = [];
  private drops: { mesh: THREE.Mesh; t: number; x: number; z: number; from: number; to: number }[] = [];
  private stream: THREE.Mesh;
  private gears: { g: THREE.Group; ratio: number }[] = [];
  private pumpRotor = new THREE.Group();
  private pipeLen = 0;

  constructor() {
    super();
    const plate = basePlate(3.6, 2.6, 'водяная мельница');
    const frame = new THREE.Group();
    const wood = mat('#a86d3a', 0.6);
    const water = new THREE.MeshStandardMaterial({ color: '#3aa6d9', roughness: 0.1, transparent: true, opacity: 0.72 });

    // Pool: four low walls, water inside.
    const { x0, x1, z0, z1, h } = POOL;
    const wall = (w: number, d: number, x: number, z: number) => {
      const m = roundedBox(w, h, d, 0.03, '#b8a48a', 0.8);
      m.position.set(x, T, z);
      frame.add(m);
    };
    wall(x1 - x0, 0.08, (x0 + x1) / 2, z0);
    wall(x1 - x0, 0.08, (x0 + x1) / 2, z1);
    wall(0.08, z1 - z0, x0, (z0 + z1) / 2);
    wall(0.08, z1 - z0, x1, (z0 + z1) / 2);
    this.poolWater = mesh(new THREE.BoxGeometry(x1 - x0 - 0.1, 1, z1 - z0 - 0.1), water, false);
    this.poolWater.position.set((x0 + x1) / 2, T, (z0 + z1) / 2);
    frame.add(this.poolWater);

    // Trough on two legs, high at the back.
    const trough = new THREE.Group();
    const tw = 0.95;
    const td = 0.5;
    const ty = T + 1.95;
    const bottom = roundedBox(tw, 0.05, td, 0.02, '#a86d3a', 0.6);
    bottom.position.y = -0.03;
    trough.add(bottom);
    for (const [w, d, x, z] of [
      [tw, 0.05, 0, -td / 2],
      [tw, 0.05, 0, td / 2],
      [0.05, td, tw / 2, 0],
    ] as const) {
      const m = roundedBox(w, 0.22, d, 0.02, '#a86d3a', 0.6);
      m.position.set(x, 0, z);
      trough.add(m);
    }
    // The open end narrows into a spout.
    const lip = roundedBox(0.2, 0.04, 0.18, 0.015, '#a86d3a', 0.6);
    lip.position.set(-tw / 2 - 0.08, 0.0, 0);
    trough.add(lip);
    this.troughWater = mesh(new THREE.BoxGeometry(tw - 0.08, 1, td - 0.08), water, false);
    this.troughWater.position.set(0, 0.0, 0);
    trough.add(this.troughWater);
    trough.position.set(SPOUT.x + tw / 2 + 0.08, ty, SPOUT.z);
    frame.add(trough);
    for (const x of [-tw / 2 + 0.1, tw / 2 - 0.05]) {
      const leg = mesh(new THREE.CylinderGeometry(0.035, 0.04, ty - T, 8), wood);
      leg.position.set(trough.position.x + x, T + (ty - T) / 2, SPOUT.z - td / 2 - 0.02);
      frame.add(leg);
    }

    // The wheel: two rims, spokes, paddles, on an A-frame.
    const rimGeo = new THREE.TorusGeometry(WHEEL_R, 0.035, 8, 40);
    for (const z of [-0.18, 0.18]) {
      const r = mesh(rimGeo, wood);
      r.position.z = z;
      this.wheel.add(r);
      for (let i = 0; i < 5; i++) {
        const spoke = mesh(new THREE.BoxGeometry(WHEEL_R * 2, 0.04, 0.04), wood);
        spoke.rotation.z = (i * Math.PI) / 5;
        spoke.position.z = z;
        this.wheel.add(spoke);
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10;
      const paddle = mesh(new THREE.BoxGeometry(0.2, 0.04, 0.38), mat(i % 2 ? '#d8483c' : '#e9a14a', 0.55));
      paddle.position.set(Math.cos(a) * (WHEEL_R - 0.05), Math.sin(a) * (WHEEL_R - 0.05), 0);
      paddle.rotation.z = a;
      this.wheel.add(paddle);
    }
    const axle = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 12), mat(C.metal, 0.3, 0.8));
    axle.rotation.x = Math.PI / 2;
    axle.position.z = 0.1;
    this.wheel.add(axle);
    this.wheel.position.copy(WHEEL);
    for (const z of [WHEEL.z - 0.3, WHEEL.z + 0.3]) {
      for (const sx of [-1, 1]) {
        const leg = mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.15, 8), wood);
        leg.position.set(WHEEL.x + sx * 0.25, T + 0.52, z);
        leg.rotation.z = sx * 0.42;
        frame.add(leg);
      }
    }
    // Gears on the front end of the axle.
    const gBig = gear(14, 0.3, C.amber);
    gBig.position.set(WHEEL.x, WHEEL.y, WHEEL.z + 0.45);
    const gSmall = gear(8, 0.17, C.teal);
    const a = Math.PI * 1.25;
    gSmall.position.set(WHEEL.x + Math.cos(a) * 0.45, WHEEL.y + Math.sin(a) * 0.45, WHEEL.z + 0.45);
    const gTiny = gear(7, 0.14, C.red);
    gTiny.position.set(gSmall.position.x - 0.3, gSmall.position.y + 0.06, WHEEL.z + 0.45);
    frame.add(gBig, gSmall, gTiny);
    this.gears.push({ g: gBig, ratio: 1 }, { g: gSmall, ratio: -14 / 8 }, { g: gTiny, ratio: 14 / 7 });

    // Pump: a box with a turning impeller, a hose from the pool, the clear pipe up.
    const pump = roundedBox(0.5, 0.45, 0.5, 0.08, C.red, 0.45);
    pump.position.set(PIPE[0].x, T, PIPE[0].z);
    const pumpTop = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 20), mat(C.navy2, 0.4));
    pumpTop.position.set(PIPE[0].x, T + 0.5, PIPE[0].z);
    for (let i = 0; i < 4; i++) {
      const blade = mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), mat('#f2c230', 0.4));
      blade.rotation.y = (i * Math.PI) / 4;
      this.pumpRotor.add(blade);
    }
    this.pumpRotor.position.set(PIPE[0].x, T + 0.48, PIPE[0].z + 0.27);
    this.pumpRotor.rotation.x = Math.PI / 2;
    const hose = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12), mat('#3f86d6', 0.5));
    hose.rotation.z = Math.PI / 2;
    hose.position.set((PIPE[0].x + x0) / 2 + 0.04, T + 0.2, PIPE[0].z);
    frame.add(pump, pumpTop, this.pumpRotor, hose);
    const glass = new THREE.MeshStandardMaterial({ color: '#dff4f2', roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
    for (let i = 0; i < PIPE.length - 1; i++) {
      const p = PIPE[i];
      const q = PIPE[i + 1];
      const len = p.distanceTo(q);
      const tube = mesh(new THREE.CylinderGeometry(0.075, 0.075, len, 18, 1, true), glass, false);
      tube.position.copy(p).lerp(q, 0.5);
      tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize());
      frame.add(tube);
      this.pipeLen += len;
      const elbow = mesh(new THREE.SphereGeometry(0.085, 14, 10), mat(C.navy2, 0.4));
      elbow.position.copy(q);
      frame.add(elbow);
    }
    const pipePost = mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.1, 8), wood);
    pipePost.position.set(-0.2, T + 1.2, PIPE[1].z - 0.12);
    frame.add(pipePost);
    const blobGeo = new THREE.SphereGeometry(0.055, 12, 8);
    for (let i = 0; i < 9; i++) {
      const m = mesh(blobGeo, water, false);
      m.visible = false;
      this.blobs.push({ mesh: m, u: i / 9 });
      frame.add(m);
    }

    // Pouring water: a glassy ribbon and drops, from the spout, the pipe end and off the wheel.
    this.stream = mesh(new THREE.CylinderGeometry(0.05, 0.07, 1, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#7fd0f0', roughness: 0.1, transparent: true, opacity: 0 }), false);
    frame.add(this.stream);
    const dropGeo = new THREE.SphereGeometry(0.04, 8, 6);
    for (let i = 0; i < 26; i++) {
      const m = mesh(dropGeo, water, false);
      m.visible = false;
      this.drops.push({ mesh: m, t: 1, x: 0, z: 0, from: 0, to: 0 });
      frame.add(m);
    }

    this.body.add(plate, frame, this.wheel);
    this.addTerminal('a', 'none', 1.55, 1.0);
    this.addTerminal('b', 'none', -1.55, 1.0);
    this.pickable(plate, frame, this.wheel);
  }

  private spawn(x: number, z: number, from: number, to: number) {
    const d = this.drops.find((q) => q.t >= 1);
    if (!d) return;
    Object.assign(d, { t: 0, x: x + (Math.random() - 0.5) * 0.08, z: z + (Math.random() - 0.5) * 0.12, from, to });
  }

  private dropClock = 0;
  protected animate(dt: number) {
    this.updateDrive(dt, 1.5, 2);
    const pumping = this.pool > 0.08 ? Math.abs(this.drive) * 0.16 : 0;
    this.pour = this.trough > 0.01 ? 0.03 + this.trough * 0.15 : 0;
    const moved = Math.min(pumping * dt, 1 - this.trough);
    this.trough = Math.max(0, this.trough + moved - this.pour * dt);
    this.pool = 1 - this.trough;

    // Water levels.
    const ph = 0.04 + this.pool * (POOL.h - 0.12);
    this.poolWater.scale.y = ph;
    this.poolWater.position.y = T + ph / 2 + 0.02;
    const th = Math.max(0.001, this.trough * 0.17);
    this.troughWater.scale.y = th;
    this.troughWater.position.y = -0.01 + th / 2;
    this.troughWater.visible = this.trough > 0.01;

    // Blobs climb the pipe while it pumps.
    const flow = pumping / 0.16;
    for (const b of this.blobs) {
      b.u = (b.u + dt * flow * 0.35) % 1;
      b.mesh.visible = flow > 0.05;
      let d = b.u * this.pipeLen;
      for (let i = 0; i < PIPE.length - 1; i++) {
        const len = PIPE[i].distanceTo(PIPE[i + 1]);
        if (d <= len || i === PIPE.length - 2) {
          b.mesh.position.copy(PIPE[i]).lerp(PIPE[i + 1], Math.min(1, d / len));
          break;
        }
        d -= len;
      }
    }

    // The stream from the spout onto the wheel.
    const pourK = Math.min(1, this.pour / 0.12);
    const top = SPOUT.y - 0.02;
    const hit = WHEEL.y + Math.sqrt(Math.max(0, WHEEL_R ** 2 - (SPOUT.x - WHEEL.x) ** 2));
    this.stream.scale.set(0.4 + pourK * 0.8, top - hit, 0.4 + pourK * 0.8);
    this.stream.position.set(SPOUT.x - 0.02, (top + hit) / 2, SPOUT.z);
    (this.stream.material as THREE.MeshStandardMaterial).opacity = pourK * 0.65;
    this.stream.visible = pourK > 0.02;

    this.dropClock -= dt;
    if (this.dropClock <= 0) {
      this.dropClock = 0.05;
      // From the pipe end into the trough.
      if (flow > 0.1) this.spawn(PIPE[2].x, PIPE[2].z, PIPE[2].y - 0.05, T + 1.95);
      // Spray off the wheel's left side into the pool.
      if (pourK > 0.1) {
        this.spawn(WHEEL.x - 0.45 - Math.random() * 0.2, WHEEL.z, WHEEL.y - 0.3, T + POOL.h * this.pool);
        if (Math.random() < pourK) this.spawn(SPOUT.x, SPOUT.z, hit, WHEEL.y - 0.2);
      }
    }
    for (const d of this.drops) {
      if (d.t >= 1) {
        d.mesh.visible = false;
        continue;
      }
      d.t = Math.min(1, d.t + dt * 2.2);
      d.mesh.visible = true;
      d.mesh.position.set(d.x - d.t * 0.1, d.from + (d.to - d.from) * d.t * d.t, d.z);
    }

    // Falling water drives the wheel; it has weight, so it slows gently.
    const target = -this.pour * 22;
    this.omega = damp(this.omega, target, Math.abs(target) > Math.abs(this.omega) ? 1.2 : 0.4, dt);
    this.wheel.rotation.z += this.omega * dt;
    for (const g of this.gears) g.g.rotation.z += this.omega * g.ratio * dt;
    this.pumpRotor.rotation.y += pumping * 120 * dt;
  }
}

// ───────────────────────────── Conveyor ─────────────────────────────

const OV = { x: 1.2, r: 0.45, z: -0.1 };
const BELT_Y = T + 0.42;
const OVAL_LEN = 4 * OV.x + 2 * Math.PI * OV.r;
const PRESS_X = -0.45;
const PAINT_X = 0.35;
const BOX_COLORS = ['#e5533d', '#f2c230', '#2bb3a8', '#3f86d6', '#8a63c9', '#5cb85c'];

/** Point and direction on the oval at arc length s (front straight runs +x). */
function oval(s: number, out: THREE.Vector3, dir?: THREE.Vector3): THREE.Vector3 {
  const L = OVAL_LEN;
  let u = ((s % L) + L) % L;
  const straight = 2 * OV.x;
  const arc = Math.PI * OV.r;
  if (u < straight) {
    out.set(-OV.x + u, BELT_Y, OV.z + OV.r);
    dir?.set(1, 0, 0);
    return out;
  }
  u -= straight;
  if (u < arc) {
    const a = Math.PI / 2 - u / OV.r;
    out.set(OV.x + Math.cos(a) * OV.r, BELT_Y, OV.z + Math.sin(a) * OV.r);
    dir?.set(Math.sin(a), 0, -Math.cos(a));
    return out;
  }
  u -= arc;
  if (u < straight) {
    out.set(OV.x - u, BELT_Y, OV.z - OV.r);
    dir?.set(-1, 0, 0);
    return out;
  }
  u -= straight;
  const a = -Math.PI / 2 - u / OV.r;
  out.set(-OV.x + Math.cos(a) * OV.r, BELT_Y, OV.z + Math.sin(a) * OV.r);
  dir?.set(Math.sin(a), 0, -Math.cos(a));
  return out;
}

let starTex: THREE.Texture | null = null;
function starTexture(): THREE.Texture {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.translate(64, 64);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 22 : 54;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

/**
 * A belt running round an oval carries coloured boxes: a press stamps a star
 * on each one, and the paint tunnel gives it a new colour.
 */
export class Conveyor extends Machine {
  readonly kind: PartKind = 'conveyor';
  readonly radius = 2.5;
  private s = 0;
  private slats: THREE.Mesh[] = [];
  private boxes: { g: THREE.Group; mat: THREE.MeshStandardMaterial; star: THREE.Mesh; color: number; offset: number; squash: number; stamped: boolean; painted: boolean }[] = [];
  private piston: THREE.Group;
  private gears: { g: THREE.Group; ratio: number }[] = [];
  private tunnelGlow: THREE.MeshStandardMaterial;
  private sparks: THREE.Sprite[] = [];
  private press = 0;

  constructor() {
    super();
    const plate = basePlate(4.2, 2.4, 'конвейер');
    const frame = new THREE.Group();
    // The island inside the belt and the frame under it.
    const shape = new THREE.Shape();
    shape.absarc(OV.x, 0, OV.r - 0.24, -Math.PI / 2, Math.PI / 2, false);
    shape.absarc(-OV.x, 0, OV.r - 0.24, Math.PI / 2, (3 * Math.PI) / 2, false);
    const island = mesh(new THREE.ExtrudeGeometry(shape, { depth: BELT_Y - T - 0.02, bevelEnabled: false }), mat(C.navy2, 0.5));
    island.rotation.x = Math.PI / 2;
    island.position.set(0, BELT_Y - 0.02, OV.z);
    const outer = new THREE.Shape();
    outer.absarc(OV.x, 0, OV.r + 0.27, -Math.PI / 2, Math.PI / 2, false);
    outer.absarc(-OV.x, 0, OV.r + 0.27, Math.PI / 2, (3 * Math.PI) / 2, false);
    const base = mesh(new THREE.ExtrudeGeometry(outer, { depth: BELT_Y - T - 0.06, bevelEnabled: false }), mat('#8a93a6', 0.55, 0.2));
    base.rotation.x = Math.PI / 2;
    base.position.set(0, BELT_Y - 0.06, OV.z);
    frame.add(island, base);

    // Slats of the belt.
    const n = 36;
    const slatGeo = new THREE.BoxGeometry(OVAL_LEN / n - 0.025, 0.04, 0.46);
    const slatMat = mat('#2a3148', 0.6);
    for (let i = 0; i < n; i++) {
      const sl = mesh(slatGeo, slatMat);
      sl.userData.offset = (i * OVAL_LEN) / n;
      this.slats.push(sl);
      frame.add(sl);
    }

    // Gears at both ends of the island, the motor on the right one,
    // and a little gearbox on the front of the frame.
    for (const sx of [-1, 1]) {
      const g = gear(10, 0.2, sx > 0 ? C.amber : C.teal);
      g.rotation.x = -Math.PI / 2;
      g.position.set(sx * OV.x, BELT_Y + 0.03, OV.z);
      frame.add(g);
      this.gears.push({ g, ratio: 1 });
    }
    const motor = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.36, 20), mat(C.red, 0.45));
    motor.position.set(OV.x, BELT_Y + 0.25, OV.z);
    const motorCap = mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.05, 20), mat(C.navy2, 0.45));
    motorCap.position.set(OV.x, BELT_Y + 0.45, OV.z);
    frame.add(motor, motorCap);
    const faceZ = OV.z + OV.r + 0.29;
    const gA = gear(12, 0.14, C.amber, 0.05);
    gA.position.set(0.95, T + 0.17, faceZ);
    const gB = gear(8, 0.1, C.teal, 0.05);
    gB.position.set(0.95 + 0.235, T + 0.17, faceZ);
    const gC = gear(8, 0.1, C.red, 0.05);
    gC.position.set(0.95 - 0.235, T + 0.17, faceZ);
    frame.add(gA, gB, gC);
    this.gears.push({ g: gA, ratio: 1.4 }, { g: gB, ratio: -1.4 * 1.5 }, { g: gC, ratio: -1.4 * 1.5 });

    // The press, on a gantry over the front run.
    const gantry = new THREE.Group();
    const steel = mat('#5d6b85', 0.45, 0.4);
    for (const dz of [-0.42, 0.42]) {
      const post = mesh(new THREE.BoxGeometry(0.1, 1.25, 0.1), steel);
      post.position.set(PRESS_X, T + 0.625, OV.z + OV.r + dz);
      gantry.add(post);
    }
    const beam = roundedBox(0.36, 0.22, 1.0, 0.05, '#f2c230', 0.45);
    beam.position.set(PRESS_X, T + 1.2, OV.z + OV.r);
    gantry.add(beam);
    this.piston = new THREE.Group();
    const rod = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 12), mat(C.metal, 0.3, 0.8));
    rod.position.y = 0.25;
    const head = roundedBox(0.3, 0.08, 0.3, 0.03, C.red, 0.45);
    head.position.y = -0.04;
    this.piston.add(rod, head);
    this.piston.position.set(PRESS_X, T + 0.95, OV.z + OV.r);
    gantry.add(this.piston);
    frame.add(gantry);

    // The paint tunnel over the back run.
    const tunnel = new THREE.Group();
    const tw = 0.8;
    for (const dz of [-0.3, 0.3]) {
      const w = roundedBox(tw, 0.72, 0.06, 0.03, '#f6eddd', 0.6);
      w.position.set(0, 0, dz);
      tunnel.add(w);
    }
    const roof = roundedBox(tw + 0.08, 0.08, 0.72, 0.03, C.teal, 0.5);
    roof.position.y = 0.72;
    tunnel.add(roof);
    this.tunnelGlow = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff4d6d', emissiveIntensity: 0.4, roughness: 0.4 });
    const stripe = mesh(new THREE.BoxGeometry(tw - 0.06, 0.12, 0.07), this.tunnelGlow, false);
    stripe.position.set(0, 0.5, 0.31);
    tunnel.add(stripe);
    tunnel.position.set(PAINT_X, T + 0.1, OV.z - OV.r);
    frame.add(tunnel);
    for (let i = 0; i < 6; i++) {
      const sp = sprite(glowFor('rgba(255,255,255,1)'), 0.22);
      sp.material = sp.material.clone();
      sp.material.opacity = 0;
      sp.userData.t = 1;
      this.sparks.push(sp);
      frame.add(sp);
    }

    // Six boxes riding the belt.
    const boxGeo = new THREE.BoxGeometry(0.34, 0.3, 0.34);
    const starGeo = new THREE.PlaneGeometry(0.24, 0.24);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: BOX_COLORS[i], roughness: 0.55 });
      const b = mesh(boxGeo, m);
      b.position.y = 0.17;
      const tape = mesh(new THREE.BoxGeometry(0.35, 0.02, 0.07), mat('#f6eddd', 0.6), false);
      tape.position.y = 0.32;
      const star = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ map: starTexture(), transparent: true, color: '#fff4c2', depthWrite: false }));
      star.rotation.x = -Math.PI / 2;
      star.position.y = 0.335;
      star.visible = false;
      g.add(b, tape, star);
      frame.add(g);
      this.boxes.push({ g, mat: m, star, color: i, offset: (i * OVAL_LEN) / 6 + 0.3, squash: 0, stamped: false, painted: false });
    }

    this.body.add(plate, frame);
    this.addTerminal('a', 'none', 1.85, 0.95);
    this.addTerminal('b', 'none', -1.85, 0.95);
    this.pickable(plate, frame);
    this.place();
  }

  private place() {
    const p = new THREE.Vector3();
    const d = new THREE.Vector3();
    for (const sl of this.slats) {
      oval(this.s + (sl.userData.offset as number), p, d);
      sl.position.set(p.x, BELT_Y, p.z);
      sl.rotation.y = Math.atan2(-d.z, d.x);
    }
    for (const b of this.boxes) {
      oval(this.s + b.offset, p, d);
      b.g.position.set(p.x, BELT_Y + 0.02, p.z);
      b.g.rotation.y = Math.atan2(-d.z, d.x);
    }
  }

  protected animate(dt: number) {
    this.updateDrive(dt, 1.4, 2.2);
    const v = this.drive * 0.8;
    this.s += v * dt;
    this.place();
    const spin = v / 0.3;
    for (const g of this.gears) g.g.rotation.z -= spin * g.ratio * dt;

    // Press: comes down onto the box under it.
    let under = 0;
    for (const b of this.boxes) {
      const front = Math.abs(b.g.position.z - (OV.z + OV.r)) < 0.05;
      const dx = Math.abs(b.g.position.x - PRESS_X);
      if (front) under = Math.max(under, 1 - dx / 0.16);
      if (front && dx < 0.03 && !b.stamped && this.running) {
        b.stamped = true;
        b.star.visible = true;
        b.squash = 1;
        this.sounds.push({ kind: 'stamp' });
      }
      if (front && dx > 0.6) b.stamped = false;
      // Paint tunnel: a new colour on the way through, and the star washes off.
      const back = Math.abs(b.g.position.z - (OV.z - OV.r)) < 0.05;
      const px = Math.abs(b.g.position.x - PAINT_X);
      if (back && px < 0.03 && !b.painted && this.running) {
        b.painted = true;
        b.color = (b.color + 1) % BOX_COLORS.length;
        b.mat.color.set(BOX_COLORS[b.color]);
        b.star.visible = false;
        this.tunnelGlow.emissive.set(BOX_COLORS[b.color]);
        this.sounds.push({ kind: 'paint' });
        for (const s of this.sparks) {
          s.userData.t = Math.random() * 0.3;
          s.userData.x = PAINT_X + (v >= 0 ? -1 : 1) * 0.45;
          s.material.color.set(BOX_COLORS[b.color]);
        }
      }
      if (back && px > 0.6) b.painted = false;
      b.squash = Math.max(0, b.squash - dt * 4);
      b.g.scale.set(1 + b.squash * 0.12, 1 - b.squash * 0.2, 1 + b.squash * 0.12);
    }
    this.press = damp(this.press, Math.max(0, under), 14, dt);
    this.piston.position.y = T + 0.95 - this.press * 0.32;
    for (const s of this.sparks) {
      s.userData.t = Math.min(1, (s.userData.t as number) + dt * 1.5);
      const t = s.userData.t as number;
      s.position.set((s.userData.x as number) + Math.sin(t * 9 + s.id) * 0.15, T + 0.5 + t * 0.6, OV.z - OV.r + Math.cos(t * 7 + s.id) * 0.2);
      s.material.opacity = t < 1 ? Math.sin(t * Math.PI) * 0.9 : 0;
    }
  }
}
