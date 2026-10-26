// More things to set off one another on the workbench, from the playtest's
// wish list. A balloon holds a lever up: pop it (a ball, the laser or a
// finger) and the lever drops to close the circuit. Skittles stand on a
// short lane: a ball knocks them down and the last one falling closes the
// contact. A garland of little bulbs chases its lights round. A kettle warms
// up, steams, and whistles when it boils.
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { Part, type Footprint, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox } from './kit';
import { glowFor, sprite } from './models';

const BALLOON_COLORS = ['#e5533d', '#f2c230', '#2bb3a8', '#3f86d6', '#8a63c9', '#ff7fb0'];

/** A green lamp on the plate: lit while the contact is closed. */
function contactLamp(x: number, z: number) {
  const m = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: '#3fe07a', emissiveIntensity: 0, roughness: 0.3 });
  const l = mesh(new THREE.SphereGeometry(0.06, 14, 10), m);
  l.position.set(x, PLATE_TOP + 0.04, z);
  return { mesh: l, mat: m };
}

// ─────────────────────────────── Balloon ───────────────────────────────

const LEVER_Y = PLATE_TOP + 0.42;
const BALLOON_Y = PLATE_TOP + 1.75;

/**
 * A balloon on a string tied to a lever: while it floats it holds the lever
 * up and the contact open. A ball rolling into it, the laser's beam or a
 * finger pops it — bang, bits of rubber — the lever drops and closes the
 * circuit. Tap again to blow up a new one.
 */
export class Balloon extends Part {
  readonly kind: PartKind = 'balloon';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 0.95;
  /** A tap on it is for it (it pops or comes back), even where a wire lies over it. */
  controlAt(): boolean {
    return true;
  }
  private ball = new THREE.Group();
  private skin: THREE.MeshStandardMaterial;
  private string: THREE.Mesh;
  private lever = new THREE.Group();
  private lamp: ReturnType<typeof contactLamp>;
  /** 1 floating … 0 popped; grows back after a tap. */
  private size = 1;
  private grow = 0;
  private leverAngle = 0;
  private colour = 0;

  constructor() {
    super();
    const plate = basePlate(1.7, 1.5, 'шарик');
    const post = roundedBox(0.16, 0.42, 0.16, 0.04, C.navy2, 0.45);
    post.position.set(-0.3, PLATE_TOP + 0.21, -0.15);
    // The lever pivots at the post and reaches out to where the string is tied.
    const arm = mesh(new THREE.BoxGeometry(0.62, 0.06, 0.08), mat(C.brass, 0.3, 0.8));
    arm.position.x = 0.3;
    const knob = mesh(new THREE.SphereGeometry(0.06, 12, 8), mat(C.red, 0.35));
    knob.position.x = 0.6;
    this.lever.add(arm, knob);
    this.lever.position.set(-0.3, LEVER_Y, -0.15);
    const pad = mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), mat(C.metal, 0.3, 0.8));
    pad.position.set(0.3, PLATE_TOP + 0.03, -0.15);
    this.skin = new THREE.MeshStandardMaterial({ color: BALLOON_COLORS[0], roughness: 0.25, metalness: 0.05 });
    const rubber = mesh(new THREE.SphereGeometry(0.42, 28, 20), this.skin);
    rubber.scale.set(1, 1.18, 1);
    const tie = mesh(new THREE.ConeGeometry(0.07, 0.1, 10), this.skin);
    tie.position.y = -0.52;
    tie.rotation.x = Math.PI;
    // A highlight: a balloon is shiny.
    const shine = mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }), false);
    shine.position.set(-0.17, 0.2, 0.3);
    this.ball.add(rubber, tie, shine);
    this.ball.position.set(0.3, BALLOON_Y, -0.15);
    this.string = mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), mat('#5a5f73', 0.7), false);
    this.lamp = contactLamp(0, 0.45);
    this.body.add(plate, post, this.lever, pad, this.ball, this.string, this.lamp.mesh);
    this.addTerminal('a', 'none', 0.6, 0.5);
    this.addTerminal('b', 'none', -0.6, 0.5);
    this.pickable(plate, post, this.lever, this.ball);
  }

  /** Balls bounce off its post and the lever (where it stands on the table). */
  footprint(): Footprint {
    return { x0: -0.45, x1: 0.55, z0: -0.4, z1: 0.1 };
  }

  get popped() {
    return this.size < 0.5;
  }

  private pop(by: 'world' | 'finger') {
    if (this.popped) return;
    this.size = 0;
    this.grow = 0;
    this.closed = true;
    this.triggered = by;
    this.wantsSolve = true;
    this.sounds.push({ kind: 'burst' });
    const at = this.root.localToWorld(this.ball.position.clone());
    this.effects.push({ kind: 'sparks', at, n: 22, color: BALLOON_COLORS[this.colour] });
    this.effects.push({ kind: 'sparks', at, n: 10, color: '#ffffff' });
  }

  ballHit() {
    this.pop('world');
  }

  /** The laser's beam reached it. */
  laserHit() {
    this.pop('world');
  }

  tap(): boolean {
    super.tap();
    if (this.popped) {
      // A new balloon, in the next colour, blown up from nothing.
      this.colour = (this.colour + 1) % BALLOON_COLORS.length;
      this.skin.color.set(BALLOON_COLORS[this.colour]);
      this.grow = 1;
      this.sounds.push({ kind: 'tick' });
    } else this.pop('finger');
    return true;
  }

  protected animate(dt: number) {
    if (this.grow > 0) {
      this.size = Math.min(1, this.size + dt * 1.6);
      if (this.size >= 1) {
        this.grow = 0;
        this.closed = false;
        this.triggered = null;
        this.wantsSolve = true;
      }
    }
    const s = Math.max(0.001, this.size);
    this.ball.scale.setScalar(s);
    this.ball.visible = this.size > 0.02;
    // It bobs on its string; the lever is held up while it floats.
    const bob = Math.sin(this.time * 1.6) * 0.05;
    this.ball.position.set(0.3 + Math.sin(this.time * 0.9) * 0.05, BALLOON_Y + bob - (1 - s) * 0.9, -0.15);
    this.ball.rotation.z = Math.sin(this.time * 0.9) * 0.08;
    const up = this.size > 0.5 ? 0.18 : -0.62;
    this.leverAngle = damp(this.leverAngle, up, this.size > 0.5 ? 6 : 14, dt);
    this.lever.rotation.z = this.leverAngle;
    // The string from the lever's tip to the knot, or hanging limp once popped.
    const tipPos = new THREE.Vector3(0.6 * Math.cos(this.leverAngle) - 0.3, LEVER_Y + 0.6 * Math.sin(this.leverAngle), -0.15);
    const knot = this.ball.visible ? this.ball.position.clone().add(new THREE.Vector3(0, -0.56 * s, 0)) : tipPos.clone().add(new THREE.Vector3(0.05, -0.3, 0));
    const len = tipPos.distanceTo(knot);
    this.string.scale.set(1, Math.max(0.01, len), 1);
    this.string.position.copy(tipPos).lerp(knot, 0.5);
    this.string.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), knot.clone().sub(tipPos).normalize());
    this.lamp.mat.emissiveIntensity = damp(this.lamp.mat.emissiveIntensity, this.closed ? 2.4 : 0, 12, dt);
  }
}

// ─────────────────────────────── Skittles ───────────────────────────────

const PIN_SPOTS: [number, number][] = [
  [0.45, 0],
  [0.2, -0.15],
  [0.2, 0.15],
  [-0.05, -0.3],
  [-0.05, 0],
  [-0.05, 0.3],
];

function pinGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const prof = [
    [0.0, 0],
    [0.07, 0.01],
    [0.1, 0.1],
    [0.1, 0.2],
    [0.06, 0.32],
    [0.045, 0.38],
    [0.06, 0.45],
    [0.055, 0.52],
    [0.0, 0.55],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 18);
}

/**
 * Six skittles on a short lane: a ball rolling in knocks them flying, and
 * when they are down the contact under them closes. Tap to set them up again
 * (or, standing, to knock them over by hand).
 */
export class Skittles extends Part {
  readonly kind: PartKind = 'skittles';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 1.05;
  controlAt(): boolean {
    return true;
  }
  private pins: { g: THREE.Group; home: THREE.Vector3; angle: number; v: number; dir: number; push: THREE.Vector3; delay: number }[] = [];
  private lamp: ReturnType<typeof contactLamp>;
  private down = false;
  private settle = 0;

  constructor() {
    super();
    const plate = basePlate(1.9, 1.6, 'кегли');
    const lane = roundedBox(1.4, 0.04, 1.0, 0.02, '#e9c98f', 0.55);
    lane.position.set(0.05, PLATE_TOP + 0.02, -0.15);
    const geo = pinGeometry();
    const white = mat('#fbf7ef', 0.3);
    const red = mat(C.red, 0.35);
    for (const [x, z] of PIN_SPOTS) {
      const g = new THREE.Group();
      const pin = mesh(geo, white);
      // Bold red neck stripes and a red cap, so the skittles stand out on the cream lane.
      const band = mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.07, 14), red, false);
      band.position.y = 0.37;
      const cap = mesh(new THREE.SphereGeometry(0.058, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, false);
      cap.position.y = 0.5;
      g.add(pin, band, cap);
      const home = new THREE.Vector3(x, PLATE_TOP + 0.04, z - 0.15);
      g.position.copy(home);
      this.pins.push({ g, home, angle: 0, v: 0, dir: 0, push: new THREE.Vector3(), delay: 0 });
      this.body.add(g);
    }
    this.lamp = contactLamp(-0.6, 0.45);
    this.body.add(plate, lane, this.lamp.mesh);
    this.addTerminal('a', 'none', 0.65, 0.55);
    this.addTerminal('b', 'none', -0.65, 0.55);
    this.pickable(plate, lane, ...this.pins.map((p) => p.g));
  }

  footprint(): Footprint {
    return { x0: -0.25, x1: 0.6, z0: -0.55, z1: 0.25 };
  }

  private knock(by: 'world' | 'finger') {
    if (this.down) return;
    this.down = true;
    this.triggered = by;
    this.settle = 0.9;
    // Front ones first, the back row a moment later; each flies its own way.
    this.pins.forEach((p, i) => {
      p.delay = i === 0 ? 0 : 0.05 + i * 0.05;
      p.dir = Math.random() * Math.PI * 2;
      p.push.set(-0.15 - Math.random() * 0.35, 0, (Math.random() - 0.5) * 0.5);
      p.v = 7 + Math.random() * 4;
    });
    this.sounds.push({ kind: 'pins' });
  }

  ballHit() {
    this.knock('world');
  }

  tap(): boolean {
    super.tap();
    if (this.down) {
      this.down = false;
      this.closed = false;
      this.triggered = null;
      this.wantsSolve = true;
      for (const p of this.pins) p.delay = 0;
      this.sounds.push({ kind: 'tick' });
    } else this.knock('finger');
    return true;
  }

  protected animate(dt: number) {
    for (const p of this.pins) {
      if (this.down) {
        if (p.delay > 0) {
          p.delay -= dt;
          continue;
        }
        p.angle = Math.min(Math.PI / 2, p.angle + p.v * dt);
        p.v = Math.max(2, p.v - dt * 6);
        p.g.position.lerp(p.home.clone().add(p.push), Math.min(1, dt * 6));
      } else {
        p.angle = damp(p.angle, 0, 10, dt);
        p.g.position.lerp(p.home, Math.min(1, dt * 10));
      }
      // Tip over about its foot, the way it was hit.
      p.g.rotation.set(0, p.dir, 0);
      p.g.rotateZ(p.angle);
    }
    // The contact closes once they are down (not at the first touch).
    if (this.down && this.settle > 0) {
      this.settle -= dt;
      if (this.settle <= 0) {
        this.closed = true;
        this.wantsSolve = true;
        this.effects.push({ kind: 'sparks', at: this.root.localToWorld(new THREE.Vector3(0.2, PLATE_TOP + 0.2, -0.15)), n: 12, color: '#ffd36b' });
      }
    }
    this.lamp.mat.emissiveIntensity = damp(this.lamp.mat.emissiveIntensity, this.closed ? 2.4 : 0, 12, dt);
  }
}

// ─────────────────────────────── Garland ───────────────────────────────

const GARLAND_COLORS = ['#ff4d4d', '#ffb02e', '#ffe34d', '#4fdc6a', '#3fb6ff', '#a66cff'];
const GARLAND_N = 12;

/** A string of little coloured bulbs between two posts: with current the lights chase along it. */
export class Garland extends Part {
  readonly kind: PartKind = 'garland';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.15;
  private bulbs: { m: THREE.MeshStandardMaterial; glow: THREE.Sprite; color: THREE.Color }[] = [];
  private shown = 0;
  private wire: THREE.Mesh;

  constructor() {
    super();
    const plate = basePlate(2.3, 1.3, 'гирлянда');
    const wood = mat('#c98a4b', 0.6);
    const posts = [-0.95, 0.95].map((x) => {
      const p = mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 10), wood);
      p.position.set(x, PLATE_TOP + 0.5, -0.15);
      const cap = mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(C.brass, 0.3, 0.8));
      cap.position.set(x, PLATE_TOP + 1.02, -0.15);
      return [p, cap];
    });
    // The cord sags between the post tops.
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector3(-0.95 + t * 1.9, PLATE_TOP + 0.98 - Math.sin(t * Math.PI) * 0.4, -0.15));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    this.wire = mesh(new THREE.TubeGeometry(curve, 40, 0.012, 5, false), mat('#2a3555', 0.5), false);
    for (let i = 0; i < GARLAND_N; i++) {
      const at = curve.getPointAt((i + 0.5) / GARLAND_N);
      const color = new THREE.Color(GARLAND_COLORS[i % GARLAND_COLORS.length]);
      const m = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.55), emissive: color, emissiveIntensity: 0, roughness: 0.2 });
      const bulb = mesh(new THREE.SphereGeometry(0.055, 12, 10), m, false);
      bulb.scale.set(1, 1.35, 1);
      bulb.position.copy(at).add(new THREE.Vector3(0, -0.06, 0));
      const glow = sprite(glowFor(`rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},0.8)`), 0.5);
      glow.position.copy(bulb.position);
      this.bulbs.push({ m, glow, color });
      this.body.add(bulb, glow);
    }
    this.body.add(plate, ...posts.flat(), this.wire);
    this.addTerminal('a', 'none', 0.85, 0.35);
    this.addTerminal('b', 'none', -0.85, 0.35);
    this.pickable(plate, ...posts.flat());
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 8 };
  }

  glowLight() {
    if (this.shown < 0.05) return null;
    const mid = this.bulbs[GARLAND_N >> 1];
    // Many small bulbs, not one lamp: a soft light on the table (enough for a light sensor close by).
    return { at: mid.glow.getWorldPosition(new THREE.Vector3()), color: new THREE.Color('#ffc8e6'), power: Math.min(0.45, this.shown * 0.3) };
  }

  protected animate(dt: number) {
    const target = Math.min(1.4, Math.sqrt(Math.max(0, this.state.level)));
    this.shown = damp(this.shown, target, 8, dt);
    // A wave of light runs along; faster with more current.
    const speed = 3 + this.shown * 4;
    this.bulbs.forEach((b, i) => {
      const chase = 0.35 + 0.65 * Math.max(0, Math.sin(this.time * speed - i * 0.9)) ** 2;
      const k = this.shown * chase;
      // At night the dark (and a lower bloom threshold) does the work: small
      // glows, so each bulb and the running wave stay apart instead of one blur.
      const night = Part.night;
      b.m.emissiveIntensity = k * (night ? 0.8 : 3.2);
      b.glow.material.opacity = Math.min(1, k * (night ? 0.3 : 0.9));
      b.glow.scale.setScalar(night ? 0.18 + k * 0.1 : 0.35 + k * 0.25);
    });
  }
}

// ─────────────────────────────── Kettle ───────────────────────────────

const SPOUT = new THREE.Vector3(0.42, PLATE_TOP + 0.62, -0.15);

/**
 * A round kettle on a hot plate: with current it warms (the plate glows),
 * starts to steam from the spout, and when it boils it whistles, the lid
 * rattling. Switched off, it cools down slowly.
 */
export class Kettle extends Part {
  readonly kind: PartKind = 'kettle';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 0.95;
  /** 0 cold … 1 boiling. */
  heat = 0;
  private lid = new THREE.Group();
  private ring: THREE.MeshStandardMaterial;
  private puffs: THREE.Sprite[] = [];
  private whistleAt = 0;

  constructor() {
    super();
    const plate = basePlate(1.7, 1.5, 'чайник');
    const stove = roundedBox(0.95, 0.12, 0.8, 0.05, C.navy2, 0.45);
    stove.position.set(0, PLATE_TOP + 0.06, -0.15);
    this.ring = new THREE.MeshStandardMaterial({ color: '#4a3a34', emissive: '#ff4a1a', emissiveIntensity: 0, roughness: 0.5 });
    const hob = mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 28), this.ring, false);
    hob.rotation.x = Math.PI / 2;
    hob.position.set(0, PLATE_TOP + 0.13, -0.15);
    // A round teal kettle: a lathe body, a spout, a handle over the top.
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new THREE.Vector2(0.06 + Math.sin(t * Math.PI) * 0.32 + (1 - t) * 0.04, t * 0.5));
    }
    const pot = mesh(new THREE.LatheGeometry(pts, 32), mat(C.teal, 0.3, 0.1));
    pot.position.set(0, PLATE_TOP + 0.13, -0.15);
    const spout = mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.36, 12), mat(C.teal, 0.3, 0.1));
    spout.position.set(0.3, PLATE_TOP + 0.45, -0.15);
    spout.rotation.z = -1.0;
    const whistle = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10), mat(C.brass, 0.3, 0.8));
    whistle.position.copy(SPOUT);
    whistle.rotation.z = -1.0;
    const handle = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20, Math.PI), mat(C.navy2, 0.4));
    handle.position.set(0, PLATE_TOP + 0.63, -0.15);
    const lidTop = mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.05, 20), mat(C.teal, 0.3, 0.1));
    const knob = mesh(new THREE.SphereGeometry(0.045, 12, 8), mat(C.red, 0.35));
    knob.position.y = 0.05;
    this.lid.add(lidTop, knob);
    this.lid.position.set(0, PLATE_TOP + 0.64, -0.15);
    // Steam a touch blue-grey, so it shows on the cream table.
    for (let i = 0; i < 7; i++) {
      const p = sprite(glowFor('rgba(225,235,250,0.95)'), 0.4);
      p.userData.t = i / 7;
      this.puffs.push(p);
      this.body.add(p);
    }
    this.body.add(plate, stove, hob, pot, spout, whistle, handle, this.lid);
    this.addTerminal('a', 'none', 0.6, 0.5);
    this.addTerminal('b', 'none', -0.6, 0.5);
    this.pickable(plate, stove, pot, spout, handle, this.lid);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 12 };
  }

  get boiling() {
    return this.heat > 0.85;
  }

  tap(): boolean {
    super.tap();
    // A peek under the lid.
    this.lid.position.y = PLATE_TOP + 0.74;
    return false;
  }

  protected animate(dt: number) {
    const on = this.state.level > 0.2;
    // Warms in about seven seconds; cools in fifteen.
    this.heat = THREE.MathUtils.clamp(this.heat + (on ? dt * 0.14 * Math.min(1.2, this.state.level) : -dt / 15), 0, 1);
    this.ring.emissiveIntensity = damp(this.ring.emissiveIntensity, on ? 2.5 : 0, 4, dt);
    const steam = THREE.MathUtils.smoothstep(this.heat, 0.35, 0.8);
    const dir = new THREE.Vector3(0.75, 0.66, 0).normalize();
    for (const p of this.puffs) {
      p.userData.t = (p.userData.t + dt * (0.5 + steam * 0.6)) % 1;
      const t = p.userData.t as number;
      p.position.copy(SPOUT).addScaledVector(dir, 0.1 + t * 0.6).add(new THREE.Vector3(0, t * t * 0.5, Math.sin(t * 6 + p.id) * 0.06));
      p.scale.setScalar(0.25 + t * 0.7);
      p.material.opacity = steam * Math.sin(t * Math.PI);
    }
    // Boiling: the lid rattles and every few seconds the whistle sings.
    const rattle = this.boiling ? Math.abs(Math.sin(this.time * 31)) * 0.035 : 0;
    this.lid.position.y = damp(this.lid.position.y, PLATE_TOP + 0.64 + rattle, 20, dt);
    this.lid.rotation.z = this.boiling ? Math.sin(this.time * 23) * 0.06 : 0;
    this.whistleAt -= dt;
    if (this.boiling && on && this.whistleAt <= 0) {
      this.whistleAt = 4;
      this.sounds.push({ kind: 'whistle' });
    }
    if (!this.boiling) this.whistleAt = Math.min(this.whistleAt, 0.3);
  }
}
