// The band: instruments that play together with the music box. Once powered,
// the shared conductor in audio.ts tells each one what to play (`cue`); the
// child can also play them by hand.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { model, sizeOf } from './assets';
import { Part, type PartKind } from './base';
import { BAR_COLORS, noteTexture, powerLamp } from './extra';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox } from './kit';
import { materialsOf, sprite } from './models';

/** Little notes floating up from an instrument as it plays. */
class Notes {
  private list: THREE.Sprite[] = [];
  private next = 0;
  constructor(parent: THREE.Object3D, count = 4, size = 0.38) {
    for (let i = 0; i < count; i++) {
      const s = sprite(noteTexture(), size);
      s.material = s.material.clone();
      s.material.opacity = 0;
      this.list.push(s);
      parent.add(s);
    }
  }
  emit(at: THREE.Vector3, color: string) {
    const s = this.list[this.next++ % this.list.length];
    s.material.color.set(color);
    s.userData.t = 0;
    s.userData.at = at.clone();
  }
  update(dt: number) {
    for (const s of this.list) {
      if (s.userData.t === undefined) continue;
      s.userData.t += dt * 1.1;
      const t = s.userData.t as number;
      const at = s.userData.at as THREE.Vector3;
      s.position.set(at.x + Math.sin(t * 7 + s.id) * 0.1, at.y + t * 1.2, at.z);
      s.material.opacity = t < 1 ? Math.sin(Math.min(1, t) * Math.PI) : 0;
    }
  }
}

/** Shared bits: a green power lamp, "needs power" taps, a cue from the band. */
abstract class BandPart extends Part {
  readonly elementKind: ElementKind = 'bulb';
  protected power: { lamp: THREE.Mesh; m: THREE.MeshStandardMaterial };
  protected notes: Notes;

  constructor(lampX: number, lampZ: number) {
    super();
    this.power = powerLamp(lampX, lampZ);
    this.body.add(this.power.lamp);
    this.notes = new Notes(this.body);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 20 };
  }

  get powered() {
    return this.state.level > 0.2;
  }

  /** The conductor played a note on this instrument (MIDI, or a stroke index). */
  abstract cue(note: number): void;

  protected animate(dt: number) {
    this.power.m.emissiveIntensity = damp(this.power.m.emissiveIntensity, this.powered ? 2.2 : 0, 8, dt);
    this.notes.update(dt);
  }
}

// ─────────────────────────────── Piano ───────────────────────────────

const WHITE = [60, 62, 64, 65, 67, 69, 71, 72];
/** Black keys sit after these white keys. */
const BLACK_AFTER = [0, 1, 3, 4, 5];
const KEY_STEP = 0.3;
const KEY_Z = -0.12;

/** A toy upright piano: plays the chords with the band, and every key by hand. */
export class Piano extends BandPart {
  readonly kind: PartKind = 'piano';
  readonly radius = 1.7;
  private keys: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; note: number; x: number; black: boolean; press: number; y: number }[] = [];
  private held = -1;
  private readonly keyTop = PLATE_TOP + 0.3;

  constructor() {
    super(-1.35, -1.0);
    const plate = basePlate(3.1, 2.3, 'пианино');
    const frame = new THREE.Group();
    const red = '#d8483c';
    const cabinet = roundedBox(2.75, 1.15, 0.55, 0.1, red, 0.45);
    cabinet.position.set(0, PLATE_TOP + 0.575, -0.72);
    const lid = roundedBox(2.85, 0.08, 0.66, 0.03, '#f6eddd', 0.5);
    lid.position.set(0, PLATE_TOP + 1.17, -0.72);
    const panel = roundedBox(2.3, 0.5, 0.04, 0.02, '#f6eddd', 0.55);
    panel.position.set(0, PLATE_TOP + 0.62, -0.44);
    const bed = roundedBox(2.75, 0.2, 0.85, 0.05, red, 0.45);
    bed.position.set(0, PLATE_TOP + 0.1, KEY_Z - 0.03);
    frame.add(cabinet, lid, panel, bed);
    for (const sx of [-1.28, 1.28]) {
      const cheek = roundedBox(0.16, 0.42, 0.9, 0.05, red, 0.45);
      cheek.position.set(sx, PLATE_TOP + 0.21, KEY_Z - 0.03);
      frame.add(cheek);
    }
    // A painted note on the front panel.
    const badge = sprite(noteTexture(), 0.34);
    badge.position.set(0, PLATE_TOP + 0.66, -0.4);
    badge.material = badge.material.clone();
    badge.material.color.set(C.navy);
    frame.add(badge);

    const whiteGeo = new RoundedBoxGeometry(KEY_STEP - 0.03, 0.1, 0.78, 2, 0.025);
    WHITE.forEach((note, i) => {
      const x = (i - 3.5) * KEY_STEP;
      const m = new THREE.MeshStandardMaterial({ color: '#fbf7ef', roughness: 0.35, emissive: BAR_COLORS[i], emissiveIntensity: 0 });
      const key = mesh(whiteGeo, m);
      key.position.set(x, this.keyTop - 0.05, KEY_Z);
      // A coloured dot, like on a toy piano, so keys can be found by colour.
      const dot = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 16), mat(BAR_COLORS[i], 0.5), false);
      dot.position.set(0, 0.055, 0.25);
      key.add(dot);
      frame.add(key);
      this.keys.push({ mesh: key, mat: m, note, x, black: false, press: 0, y: this.keyTop - 0.05 });
    });
    const blackGeo = new RoundedBoxGeometry(0.17, 0.12, 0.44, 2, 0.03);
    for (const after of BLACK_AFTER) {
      const x = (after - 3.5 + 0.5) * KEY_STEP;
      const m = new THREE.MeshStandardMaterial({ color: C.navy, roughness: 0.3, emissive: C.teal, emissiveIntensity: 0 });
      const key = mesh(blackGeo, m);
      const y = this.keyTop + 0.04;
      key.position.set(x, y, KEY_Z - 0.17);
      frame.add(key);
      this.keys.push({ mesh: key, mat: m, note: WHITE[after] + 1, x, black: true, press: 0, y });
    }

    this.body.add(plate, frame);
    this.addTerminal('a', 'none', 1.3, 0.82);
    this.addTerminal('b', 'none', -1.3, 0.82);
    this.pickable(plate, frame);
  }

  private keyAt(point: THREE.Vector3 | null | undefined): number {
    if (!point) return -1;
    const l = this.root.worldToLocal(point.clone());
    if (l.y < this.keyTop - 0.15 || Math.abs(l.z - KEY_Z) > 0.5 || Math.abs(l.x) > 4 * KEY_STEP + 0.05) return -1;
    // The back half of the keys has the black ones between the white.
    if (l.z < KEY_Z + 0.02) {
      const b = this.keys.findIndex((k) => k.black && Math.abs(l.x - k.x) < 0.1);
      if (b >= 0) return b;
    }
    let best = -1;
    let bestD = Infinity;
    this.keys.forEach((k, i) => {
      const d = Math.abs(l.x - k.x);
      if (!k.black && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return this.keyAt(point) >= 0;
  }

  private strike(i: number, sound: boolean) {
    const k = this.keys[i];
    k.press = 1;
    if (sound) this.sounds.push({ kind: 'piano', note: k.note });
    const color = k.black ? C.teal : BAR_COLORS[WHITE.indexOf(k.note)];
    this.notes.emit(new THREE.Vector3(k.x, this.keyTop + 0.3, KEY_Z), color);
  }

  pressStart(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    const i = this.keyAt(point);
    if (i < 0 || !this.powered) return false;
    this.held = i;
    this.strike(i, true);
    return true;
  }

  pressMove(_hit: THREE.Object3D | null, point: THREE.Vector3 | null) {
    const i = this.keyAt(point);
    if (i >= 0 && i !== this.held && this.powered) {
      this.held = i;
      this.strike(i, true);
    }
  }

  pressEnd() {
    this.held = -1;
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    if (!this.powered && this.keyAt(point) >= 0) this.sounds.push({ kind: 'noPower' });
    return false;
  }

  cue(note: number) {
    const i = this.keys.findIndex((k) => k.note === note);
    if (i >= 0) {
      this.keys[i].press = Math.max(this.keys[i].press, 0.8);
      if (Math.random() < 0.3) this.strike(i, false);
    }
  }

  protected animate(dt: number) {
    super.animate(dt);
    for (const k of this.keys) {
      k.press = Math.max(0, k.press - dt * 3);
      k.mesh.position.y = k.y - k.press * 0.05;
      k.mesh.rotation.x = k.press * 0.06;
      k.mat.emissiveIntensity = k.press * 0.55;
    }
  }
}

// ─────────────────────────────── Tuba ───────────────────────────────

const TUBA_TAPS = [48, 43, 45, 41];

/** A brass tuba: the "oom-pah" bass of the band. */
export class Tuba extends BandPart {
  readonly kind: PartKind = 'tuba';
  readonly radius = 1.15;
  private horn = new THREE.Group();
  private top = PLATE_TOP + 1.5;
  private puff = 0;
  private taps = 0;

  constructor() {
    super(-0.85, -0.85);
    const plate = basePlate(2.0, 1.9, 'туба');
    const sculpt = model('tuba', { height: 1.55 });
    if (sculpt) {
      // The scan comes out as rough metal; polish it into shiny brass.
      for (const m of materialsOf(sculpt)) {
        m.metalnessMap = m.roughnessMap = null;
        m.metalness = 0.85;
        m.roughness = 0.32;
        m.needsUpdate = true;
      }
      this.horn.add(sculpt);
      this.top = PLATE_TOP + sizeOf(sculpt).y;
    } else {
      const brass = mat(C.brass, 0.25, 0.85);
      const pts = [0.12, 0.13, 0.15, 0.2, 0.3, 0.5].map((r, i) => new THREE.Vector2(r, i * 0.28));
      const bell = mesh(new THREE.LatheGeometry(pts, 32), brass);
      const loop = mesh(new THREE.TorusGeometry(0.28, 0.08, 12, 32), brass);
      loop.position.set(0, 0.45, 0.15);
      this.horn.add(bell, loop);
      this.top = PLATE_TOP + 1.4;
    }
    this.horn.position.set(0, PLATE_TOP, -0.15);
    this.body.add(plate, this.horn);
    this.addTerminal('a', 'none', 0.72, 0.65);
    this.addTerminal('b', 'none', -0.72, 0.65);
    this.pickable(plate, this.horn);
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return !!point && this.powered && this.root.worldToLocal(point.clone()).y > PLATE_TOP + 0.35;
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    const onHorn = !!point && this.root.worldToLocal(point.clone()).y > PLATE_TOP + 0.35;
    if (!onHorn) return false;
    if (!this.powered) {
      this.sounds.push({ kind: 'noPower' });
      return false;
    }
    const note = TUBA_TAPS[this.taps++ % TUBA_TAPS.length];
    this.sounds.push({ kind: 'tuba', note });
    this.cue(note);
    return false;
  }

  cue(_note: number) {
    this.puff = 1;
    this.notes.emit(new THREE.Vector3(0, this.top + 0.1, -0.15), C.amber);
  }

  protected animate(dt: number) {
    super.animate(dt);
    this.puff = Math.max(0, this.puff - dt * 3.5);
    const s = this.puff * this.puff;
    this.horn.scale.set(1 + s * 0.06, 1 - s * 0.05, 1 + s * 0.06);
  }
}

// ────────────────────────────── Maracas ──────────────────────────────

/** Two maracas in a stand that rock and rattle the rhythm. */
export class Maracas extends BandPart {
  readonly kind: PartKind = 'maracas';
  readonly radius = 1.1;
  private sticks: { pivot: THREE.Group; base: number; kick: number; v: number }[] = [];
  private flip = 0;

  constructor() {
    super(-0.8, -0.8);
    const plate = basePlate(1.9, 1.75, 'маракасы');
    const frame = new THREE.Group();
    const stand = roundedBox(1.0, 0.24, 0.42, 0.08, '#c98a4b', 0.6);
    stand.position.set(0, PLATE_TOP + 0.12, -0.2);
    frame.add(stand);
    const heads = [
      { color: '#e5533d', band: '#f2c230' },
      { color: '#2bb3a8', band: '#f6eddd' },
    ];
    heads.forEach((h, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(i === 0 ? -0.2 : 0.2, PLATE_TOP + 0.22, -0.2);
      const handle = mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.6, 14), mat('#a86d3a', 0.55));
      handle.position.y = 0.3;
      const head = mesh(new THREE.SphereGeometry(0.27, 26, 18), mat(h.color, 0.4));
      head.scale.y = 1.15;
      head.position.y = 0.82;
      const ring = mesh(new THREE.TorusGeometry(0.255, 0.035, 8, 32), mat(h.band, 0.45));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.82;
      const ring2 = ring.clone();
      ring2.scale.setScalar(0.8);
      ring2.position.y = 1.0;
      const cap = mesh(new THREE.SphereGeometry(0.06, 12, 8), mat(h.band, 0.45));
      cap.position.y = 1.12;
      pivot.add(handle, head, ring, ring2, cap);
      const base = i === 0 ? 0.28 : -0.28;
      pivot.rotation.z = base;
      frame.add(pivot);
      this.sticks.push({ pivot, base, kick: 0, v: 0 });
    });
    this.body.add(plate, frame);
    this.addTerminal('a', 'none', 0.68, 0.6);
    this.addTerminal('b', 'none', -0.68, 0.6);
    this.pickable(plate, frame);
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return !!point && this.powered && this.root.worldToLocal(point.clone()).y > PLATE_TOP + 0.4;
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    const onTop = !!point && this.root.worldToLocal(point.clone()).y > PLATE_TOP + 0.4;
    if (!onTop) return false;
    if (!this.powered) {
      this.sounds.push({ kind: 'noPower' });
      return false;
    }
    this.sounds.push({ kind: 'shake' });
    this.cue(1);
    this.cue(1);
    return false;
  }

  cue(note: number) {
    const s = this.sticks[this.flip++ % 2];
    s.v += note ? 6 : 3.5;
    if (note) this.notes.emit(s.pivot.position.clone().add(new THREE.Vector3(0, 1.2, 0)), this.flip % 2 ? '#e5533d' : C.teal);
  }

  protected animate(dt: number) {
    super.animate(dt);
    // Each maraca is a stiff spring around its resting lean.
    for (const s of this.sticks) {
      s.v += (-s.kick * 160 - s.v * 11) * dt;
      s.kick += s.v * dt;
      s.pivot.rotation.z = s.base + s.kick * (s.base > 0 ? -1 : 1) * 0.5;
      s.pivot.rotation.x = s.kick * 0.15;
    }
  }
}

// ─────────────────────────────── Bells ───────────────────────────────

/** C, D, E, G, A — any of them sound good together. */
const BELL_PC = [0, 2, 4, 7, 9];
const BELL_COLORS = ['#e5533d', '#f2c230', '#5cb85c', '#3f86d6', '#8a63c9'];
const BELL_X = [-0.84, -0.42, 0, 0.42, 0.84];
const BAR_Y = PLATE_TOP + 1.55;

function bellGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    // From the crown down to a flared lip.
    const r = 0.05 + 0.1 * Math.sin(t * 1.3) + 0.08 * t ** 4;
    pts.push(new THREE.Vector2(r, -t * 0.32));
  }
  pts.push(new THREE.Vector2(0.2, -0.335), new THREE.Vector2(0.16, -0.31));
  return new THREE.LatheGeometry(pts, 28);
}

/** A row of hanging bells: they sparkle the chord notes over the tune. */
export class Bells extends BandPart {
  readonly kind: PartKind = 'bells';
  readonly radius = 1.35;
  private bells: { pivot: THREE.Group; mat: THREE.MeshStandardMaterial; angle: number; v: number; glow: number }[] = [];

  constructor() {
    super(-1.05, -0.9);
    const plate = basePlate(2.5, 1.9, 'колокольчики');
    const frame = new THREE.Group();
    const wood = mat('#c98a4b', 0.6);
    for (const sx of [-1.08, 1.08]) {
      const post = mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.55, 14), wood);
      post.position.set(sx, PLATE_TOP + 0.775, -0.25);
      const foot = roundedBox(0.36, 0.1, 0.5, 0.04, '#a86d3a', 0.6);
      foot.position.set(sx, PLATE_TOP + 0.05, -0.25);
      frame.add(post, foot);
    }
    const bar = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 14), wood);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, BAR_Y, -0.25);
    frame.add(bar);
    const geo = bellGeometry();
    const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6);
    const clapGeo = new THREE.SphereGeometry(0.045, 10, 8);
    BELL_X.forEach((x, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, BAR_Y, -0.25);
      const cord = mesh(cordGeo, mat(C.navy2, 0.6), false);
      cord.position.y = -0.2;
      const m = new THREE.MeshStandardMaterial({ color: BELL_COLORS[i], roughness: 0.25, metalness: 0.45, emissive: BELL_COLORS[i], emissiveIntensity: 0, side: THREE.DoubleSide });
      const bell = mesh(geo, m);
      bell.position.y = -0.38;
      const clapper = mesh(clapGeo, mat(C.brass, 0.3, 0.8), false);
      clapper.position.y = -0.7;
      pivot.add(cord, bell, clapper);
      frame.add(pivot);
      this.bells.push({ pivot, mat: m, angle: 0, v: 0, glow: 0 });
    });
    this.body.add(plate, frame);
    this.addTerminal('a', 'none', 1.0, 0.68);
    this.addTerminal('b', 'none', -1.0, 0.68);
    this.pickable(plate, frame);
  }

  private bellAt(point: THREE.Vector3 | null | undefined): number {
    if (!point) return -1;
    const l = this.root.worldToLocal(point.clone());
    if (l.y < BAR_Y - 0.95 || l.y > BAR_Y + 0.1) return -1;
    let best = -1;
    let bestD = 0.22;
    BELL_X.forEach((x, i) => {
      const d = Math.abs(l.x - x);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return this.bellAt(point) >= 0;
  }

  private ring(i: number, strength: number) {
    const b = this.bells[i];
    b.v += (i % 2 ? 1 : -1) * 2.2 * strength;
    b.glow = Math.max(b.glow, strength);
    this.notes.emit(new THREE.Vector3(BELL_X[i], BAR_Y - 0.4, -0.15), BELL_COLORS[i]);
  }

  pressStart(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    const i = this.bellAt(point);
    if (i < 0 || !this.powered) return false;
    this.sounds.push({ kind: 'bell', note: 84 + BELL_PC[i] });
    this.ring(i, 1);
    return true;
  }

  pressMove(_hit: THREE.Object3D | null, point: THREE.Vector3 | null) {
    const i = this.bellAt(point);
    if (i >= 0 && this.powered && this.bells[i].glow < 0.5) {
      this.sounds.push({ kind: 'bell', note: 84 + BELL_PC[i] });
      this.ring(i, 1);
    }
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    if (!this.powered && this.bellAt(point) >= 0) this.sounds.push({ kind: 'noPower' });
    return false;
  }

  /** A ball knocks the frame: every bell rings, one after another. */
  ballHit() {
    if (!this.powered) return super.ballHit();
    BELL_PC.forEach((pc, i) =>
      setTimeout(() => {
        this.sounds.push({ kind: 'bell', note: 84 + pc });
        this.ring(i, 1);
      }, i * 110),
    );
  }

  cue(note: number) {
    // The bell closest in pitch swings.
    const pc = note % 12;
    let best = 0;
    BELL_PC.forEach((p, i) => {
      if (Math.abs(p - pc) < Math.abs(BELL_PC[best] - pc)) best = i;
    });
    this.ring(best, 0.7);
  }

  protected animate(dt: number) {
    super.animate(dt);
    for (const b of this.bells) {
      b.v += (-b.angle * 45 - b.v * 2.2) * dt;
      b.angle += b.v * dt;
      b.pivot.rotation.z = b.angle * 0.35;
      b.glow = Math.max(0, b.glow - dt * 2);
      b.mat.emissiveIntensity = b.glow * 0.6;
    }
  }
}
