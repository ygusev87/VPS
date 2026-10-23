// Second wave of parts: carousel, windmill, music box, push button and a
// three-button control panel. Same recipe as models.ts: sculpted bodies when
// the models are loaded, code-built fallbacks otherwise, and everything that
// moves or glows built in code.
import * as THREE from 'three';
import type { CircuitElement, CircuitResult, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { centroid, model, sizeOf, tip } from './assets';
import { Part, type PartKind, type Terminal } from './base';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox, signDecal } from './kit';
import { glowFor, sprite } from './models';

// ──────────────────────────── Carousel ─────────────────────────────

export class Carousel extends Part {
  readonly kind: PartKind = 'carousel';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.6;
  private rotor = new THREE.Group();
  private speed = 0;
  private bob: THREE.Object3D[] = [];

  constructor() {
    super();
    const plate = basePlate(2.8, 2.8, 'карусель');
    // Motor drum the ride sits on.
    const drum = mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.32, 40), mat(C.navy2, 0.4));
    drum.position.set(0, PLATE_TOP + 0.16, -0.25);
    const rim = mesh(new THREE.TorusGeometry(0.98, 0.04, 8, 48), mat(C.brass, 0.3, 0.8));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, PLATE_TOP + 0.32, -0.25);

    const ride = model('carousel', { height: 2.1 });
    if (ride) {
      const c = centroid(ride);
      ride.position.set(-c.x, 0, -c.z);
      this.rotor.add(ride);
    } else {
      const deck = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 40), mat('#d9a066', 0.5));
      deck.position.y = 0.06;
      const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 12), mat(C.brass, 0.3, 0.8));
      pole.position.y = 0.8;
      const roof = mesh(new THREE.ConeGeometry(1.0, 0.5, 24), mat(C.red, 0.4));
      roof.position.y = 1.7;
      this.rotor.add(deck, pole, roof);
      const colors = ['#ffffff', '#f5a3c7', '#7fb6ff', '#ffd75e'];
      colors.forEach((col, i) => {
        const a = (i / 4) * Math.PI * 2;
        const seat = new THREE.Group();
        const horse = mesh(new THREE.CapsuleGeometry(0.12, 0.3, 6, 12), mat(col, 0.5));
        horse.rotation.z = Math.PI / 2;
        horse.position.y = 0.6;
        const rod = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), mat(C.brass, 0.3, 0.8));
        rod.position.y = 0.8;
        seat.add(horse, rod);
        seat.position.set(Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62);
        this.rotor.add(seat);
        this.bob.push(horse);
      });
    }
    this.rotor.position.set(0, PLATE_TOP + 0.32, -0.25);

    this.body.add(plate, drum, rim, this.rotor);
    this.addTerminal('a', 'none', 1.05, 1.05);
    this.addTerminal('b', 'none', -1.05, 1.05);
    this.pickable(plate, drum, this.rotor);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 10 };
  }

  protected animate(dt: number) {
    // A gentle ride: slower than the fan, eases in and out.
    const target = Math.max(-1.6, Math.min(1.6, this.state.level)) * 2.4;
    this.speed = damp(this.speed, target, 1.2, dt);
    this.rotor.rotation.y += this.speed * dt;
    this.bob.forEach((h, i) => (h.position.y = 0.6 + Math.sin(this.time * 3 + i * 1.6) * 0.08 * Math.min(1, Math.abs(this.speed))));
  }
}

// ──────────────────────────── Windmill ─────────────────────────────

export class Windmill extends Part {
  readonly kind: PartKind = 'windmill';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.5;
  private sails = new THREE.Group();
  private speed = 0;

  constructor() {
    super();
    const plate = basePlate(2.6, 2.2, 'мельница');
    const tower = model('windmill', { height: 2.3, rotateY: -Math.PI / 2 });
    const frame = new THREE.Group();
    let hub: THREE.Vector3;
    if (tower) {
      tower.position.set(0, PLATE_TOP, -0.35);
      frame.add(tower);
      // The hub is the frontmost point of the roof.
      hub = tip(tower, 'z', 1, 0.05).add(tower.position);
      hub.y = Math.max(hub.y, PLATE_TOP + 1.6);
    } else {
      const body = mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.7, 24), mat('#f3ece0', 0.6));
      body.position.set(0, PLATE_TOP + 0.85, -0.35);
      const roof = mesh(new THREE.ConeGeometry(0.55, 0.6, 24), mat(C.navy2, 0.5));
      roof.position.set(0, PLATE_TOP + 2.0, -0.35);
      frame.add(body, roof);
      hub = new THREE.Vector3(0, PLATE_TOP + 1.75, 0.15);
    }

    const blades = model('sails', { height: 1.75, rotateY: -Math.PI / 2 });
    if (blades) {
      const c = centroid(blades);
      const back = new THREE.Box3().setFromObject(blades).min.z;
      blades.position.set(-c.x, -c.y, -back);
      this.sails.add(blades);
    } else {
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        const sail = roundedBox(0.22, 0.9, 0.04, 0.02, C.red, 0.6);
        sail.position.y = 0.2;
        arm.add(sail);
        arm.rotation.z = (i * Math.PI) / 2;
        this.sails.add(arm);
      }
    }
    this.sails.position.copy(hub).add(new THREE.Vector3(0, 0, 0.04));

    this.body.add(plate, frame, this.sails);
    this.addTerminal('a', 'none', 0.95, 0.8);
    this.addTerminal('b', 'none', -0.95, 0.8);
    this.pickable(plate, frame, this.sails);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 9 };
  }

  protected animate(dt: number) {
    const target = Math.max(-1.6, Math.min(1.6, this.state.level)) * 6;
    this.speed = damp(this.speed, target, 1.0, dt);
    this.sails.rotation.z -= this.speed * dt;
  }
}

// ──────────────────────────── Music box ────────────────────────────

let noteTex: THREE.Texture | null = null;
function noteTexture(): THREE.Texture {
  if (noteTex) return noteTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#24304a';
  ctx.font = '700 104px "Fira Sans Condensed", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♪', 64, 70);
  noteTex = new THREE.CanvasTexture(c);
  noteTex.colorSpace = THREE.SRGBColorSpace;
  return noteTex;
}

/** Picture for each music box song (same order as SONGS in audio.ts). */
export const SONG_ICONS = ['⭐', '🐑', '🐮', '🚣', '🌉', '🕷️', '🔔', '😴'];

const iconTex = new Map<string, THREE.Texture>();
function iconTexture(icon: string): THREE.Texture {
  let t = iconTex.get(icon);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  // A cream badge so the picture reads on any background.
  ctx.fillStyle = '#fffaf2';
  ctx.strokeStyle = '#cec0ad';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = '72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 64, 70);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  iconTex.set(icon, t);
  return t;
}

export class MusicBox extends Part {
  readonly kind: PartKind = 'musicbox';
  readonly elementKind: ElementKind = 'buzzer';
  readonly radius = 1.1;
  /** Which tune plays; a tap on the box moves to the next one. */
  song = 0;
  private box = new THREE.Group();
  private notes: THREE.Sprite[] = [];
  private icon: THREE.Sprite;
  private iconPop = 0;

  constructor() {
    super();
    const plate = basePlate(2.0, 1.7, 'шкатулка');
    const sculpt = model('musicbox', { width: 1.25 });
    if (sculpt) this.box.add(sculpt);
    else {
      const b = roundedBox(1.1, 0.75, 0.85, 0.12, '#d79a4f', 0.5);
      this.box.add(b);
    }
    this.box.position.set(0, PLATE_TOP, -0.2);
    const plus = signDecal('plus', C.red, 0.3);
    plus.position.set(0.68, PLATE_TOP + 0.005, -0.3);

    const colors = [C.teal, C.red, C.amber, '#8a63c9'];
    for (let i = 0; i < 5; i++) {
      const n = sprite(noteTexture(), 0.45);
      n.material = n.material.clone();
      n.material.color.set(colors[i % colors.length]);
      n.userData.t = i / 5;
      n.userData.x = (Math.random() - 0.5) * 0.8;
      this.notes.push(n);
      this.body.add(n);
    }

    this.icon = sprite(iconTexture(SONG_ICONS[0]), 0.62);
    this.icon.material = this.icon.material.clone();
    this.icon.material.opacity = 0;
    this.icon.position.set(0, PLATE_TOP + 1.45, -0.2);

    this.body.add(plate, this.box, plus, this.icon);
    this.addTerminal('a', 'plus', 0.68, 0.55);
    this.addTerminal('b', 'minus', -0.68, 0.55);
    this.pickable(plate, this.box);
  }

  get playing() {
    return this.state.level > 0.2;
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return !!point && this.root.worldToLocal(point.clone()).y > PLATE_TOP + 0.2;
  }

  /** Next song: its picture pops up over the box. */
  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    if (!this.controlAt(null, point ?? null)) return false;
    this.song = (this.song + 1) % SONG_ICONS.length;
    this.icon.material.map = iconTexture(SONG_ICONS[this.song]);
    this.iconPop = 1;
    this.sounds.push({ kind: 'song', song: this.song });
    return false;
  }

  protected animate(dt: number) {
    const on = this.playing;
    // The song picture: big for a moment after a tap, then small while playing.
    this.iconPop = Math.max(0, this.iconPop - dt * 0.6);
    const show = this.iconPop > 0 ? 1 : on ? 0.9 : 0;
    this.icon.material.opacity = damp(this.icon.material.opacity, show, 8, dt);
    this.icon.scale.setScalar(0.55 + this.iconPop * 0.35 + (on ? Math.sin(this.time * 4) * 0.03 : 0));
    this.icon.position.y = PLATE_TOP + 1.35 + this.iconPop * 0.3;
    // The lid hops to the beat.
    this.box.scale.y = on ? 1 + Math.max(0, Math.sin(this.time * 9)) * 0.04 : damp(this.box.scale.y, 1, 10, dt);
    for (const n of this.notes) {
      n.userData.t = (n.userData.t + dt * 0.45) % 1;
      const t = n.userData.t as number;
      n.position.set((n.userData.x as number) + Math.sin(t * 6 + n.id) * 0.2, PLATE_TOP + 1.0 + t * 1.6, -0.2);
      n.material.opacity = on ? Math.sin(t * Math.PI) : damp(n.material.opacity, 0, 6, dt);
      n.material.rotation = Math.sin(t * 5 + n.id) * 0.4;
    }
  }
}

// ─────────────────────────── Push button ───────────────────────────

/** Momentary: the circuit is closed only while a finger holds it down. */
export class PushButton extends Part {
  readonly kind: PartKind = 'button';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 1.1;
  private cap = new THREE.Group();
  private press = 0;
  private ringMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0, depthWrite: false });

  constructor() {
    super();
    const plate = basePlate(2.0, 1.7, 'кнопка');
    const sculpt = model('button', { width: 1.3 });
    if (sculpt) this.cap.add(sculpt);
    else {
      const base = roundedBox(1.1, 0.25, 1.1, 0.08, C.navy2);
      const dome = mesh(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.red, 0.25));
      dome.position.y = 0.25;
      dome.scale.y = 0.6;
      this.cap.add(base, dome);
    }
    this.cap.position.set(0, PLATE_TOP, -0.2);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 48), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, PLATE_TOP + 0.01, -0.2);

    this.body.add(plate, this.cap, ring);
    this.addTerminal('a', 'none', 0.68, 0.55);
    this.addTerminal('b', 'none', -0.68, 0.55);
    this.pickable(plate, this.cap);
  }

  /** Only the cap is a button; the plate still drags the part around. */
  pressStart(hit: THREE.Object3D | null): boolean {
    let o = hit;
    while (o && o !== this.cap) o = o.parent;
    if (!o) return false;
    this.closed = true;
    return true;
  }

  pressEnd() {
    this.closed = false;
  }

  protected animate(dt: number) {
    this.press = damp(this.press, this.closed ? 1 : 0, 25, dt);
    this.cap.scale.y = 1 - this.press * 0.18;
    this.ringMat.opacity = this.press * 0.8;
  }
}

// ────────────────────────── Button panel ───────────────────────────

const PANEL_COLORS = [C.red, '#f2c230', '#3fa34d'];
/** Local x of the panel's three buttons (and of the clip pair under each). */
export const PANEL_BUTTON_X = [-1.0, 0, 1.0];
const PANEL_PAIR = 0.3;

/**
 * A control panel with its own battery inside. Under each button sits a pair
 * of clips in the button's colour: wire a gadget to a pair, press that
 * button, and it runs. Buttons latch: tap on, tap off.
 */
export class ButtonPanel extends Part {
  readonly kind: PartKind = 'panel';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 2.2;
  readonly on = [false, false, false];
  private lamps: THREE.MeshStandardMaterial[] = [];
  private halos: THREE.Sprite[] = [];
  private rings: THREE.MeshBasicMaterial[] = [];
  private flowing = [false, false, false];
  private buttonTop = PLATE_TOP + 0.8;

  constructor() {
    super();
    const plate = basePlate(4.6, 2.9);
    const sculpt = model('panel', { width: 3.4, rotateY: -Math.PI / 2 });
    const box = new THREE.Group();
    if (sculpt) {
      box.add(sculpt);
      this.buttonTop = PLATE_TOP + sizeOf(sculpt).y;
    } else {
      box.add(roundedBox(3.4, 0.6, 1.4, 0.1, C.navy2));
      PANEL_BUTTON_X.forEach((x, i) => {
        const cap = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.18, 28), mat(PANEL_COLORS[i], 0.25));
        cap.position.set(x, 0.68, 0);
        box.add(cap);
      });
      this.buttonTop = PLATE_TOP + 0.78;
    }
    box.position.set(0, PLATE_TOP, -0.5);
    this.body.add(plate, box);

    PANEL_BUTTON_X.forEach((x, i) => {
      const color = PANEL_COLORS[i];
      // A coloured pad under each clip pair, joined to its button by a stripe,
      // so "this pair belongs to that button" reads without words.
      const pad = roundedBox(1.0, 0.012, 0.62, 0.006, color, 0.7);
      (pad.material as THREE.MeshStandardMaterial).transparent = true;
      (pad.material as THREE.MeshStandardMaterial).opacity = 0.35;
      pad.position.set(x, PLATE_TOP + 0.006, 0.95);
      pad.receiveShadow = true;
      const stripe = roundedBox(0.16, 0.012, 0.42, 0.006, color, 0.7);
      (stripe.material as THREE.MeshStandardMaterial).transparent = true;
      (stripe.material as THREE.MeshStandardMaterial).opacity = 0.35;
      stripe.position.set(x, PLATE_TOP + 0.006, 0.45);
      const plus = signDecal('plus', C.red, 0.2);
      plus.position.set(x - PANEL_PAIR, PLATE_TOP + 0.014, 1.36);
      const minus = signDecal('minus', C.navy2, 0.2);
      minus.position.set(x + PANEL_PAIR, PLATE_TOP + 0.014, 1.36);

      const m = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: color, emissiveIntensity: 0, roughness: 0.3 });
      const lamp = mesh(new THREE.SphereGeometry(0.07, 16, 10), m);
      lamp.position.set(x, PLATE_TOP + 0.04, 0.72);
      this.lamps.push(m);
      const halo = sprite(glowFor(i === 0 ? 'rgba(255,90,70,0.9)' : i === 1 ? 'rgba(255,215,80,0.9)' : 'rgba(80,200,110,0.9)'), 1.0);
      halo.position.set(x, this.buttonTop + 0.25, -0.45);
      this.halos.push(halo);
      // A lit ring round a latched button, so "on" reads at a glance.
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 10, 40), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, this.buttonTop - 0.12, -0.5);
      this.rings.push(ringMat);
      this.body.add(pad, stripe, plus, minus, lamp, halo, ring);

      this.addTerminal(`p${i}`, 'plus', x - PANEL_PAIR, 0.95, color);
      this.addTerminal(`m${i}`, 'minus', x + PANEL_PAIR, 0.95);
    });
    this.pickable(plate, box);
  }

  /** Clip pairs (plus, minus) — each works like a battery behind its button. */
  outputs(): [Terminal, Terminal][] {
    return PANEL_BUTTON_X.map((_, i) => [this.terminal(`p${i}`), this.terminal(`m${i}`)]);
  }

  elements(): CircuitElement[] {
    const P = `${this.id}.P`;
    const N = `${this.id}.N`;
    return [
      { id: `${this.id}#bat`, kind: 'battery', a: P, b: N, r: 0.3 },
      ...PANEL_BUTTON_X.map((_, i): CircuitElement => ({ id: `${this.id}#${i}`, kind: 'switch', a: P, b: this.terminal(`p${i}`).id, closed: this.on[i] })),
      ...PANEL_BUTTON_X.map((_, i): CircuitElement => ({ id: `${this.id}#m${i}`, kind: 'wire', a: N, b: this.terminal(`m${i}`).id })),
    ];
  }

  onSolved(r: CircuitResult) {
    this.flowing = this.on.map((on, i) => on && Math.abs(r.elements.get(`${this.id}#${i}`)?.current ?? 0) > 0.01);
    this.closed = this.on.some(Boolean);
  }

  /** Top of button i, in part-local units (for hints pointing at it). */
  buttonPoint(i: number): THREE.Vector3 {
    return new THREE.Vector3(PANEL_BUTTON_X[i], this.buttonTop, -0.5);
  }

  /** Which button a touch is on, or -1: only the upper part of the box counts. */
  private buttonAt(point: THREE.Vector3 | null | undefined): number {
    if (!point) return -1;
    const local = this.root.worldToLocal(point.clone());
    if (local.y < this.buttonTop - 0.6 || local.z > 0.45) return -1;
    let best = 0;
    PANEL_BUTTON_X.forEach((x, i) => {
      if (Math.abs(local.x - x) < Math.abs(local.x - PANEL_BUTTON_X[best])) best = i;
    });
    return Math.abs(local.x - PANEL_BUTTON_X[best]) < 0.5 ? best : -1;
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return this.buttonAt(point) >= 0;
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    const i = this.buttonAt(point);
    if (i < 0) return false;
    this.on[i] = !this.on[i];
    return true;
  }

  protected animate(dt: number) {
    this.on.forEach((on, i) => {
      const target = on ? (this.flowing[i] ? 2.6 : 1.2) : 0;
      this.lamps[i].emissiveIntensity = damp(this.lamps[i].emissiveIntensity, target, 10, dt);
      const halo = this.halos[i];
      halo.material.opacity = damp(halo.material.opacity, on ? 0.85 : 0, 10, dt);
      halo.scale.setScalar(0.9 + (on ? Math.sin(this.time * 4 + i) * 0.08 : 0));
      this.rings[i].opacity = damp(this.rings[i].opacity, on ? 0.6 + 0.4 * Math.sin(this.time * 5 + i) ** 2 : 0, 12, dt);
    });
  }
}

// ──────────────────────────── Instruments ──────────────────────────

/** Little green lamp on an instrument's plate: lit means "plugged in, play me". */
function powerLamp(x: number, z: number) {
  const m = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: '#3fe07a', emissiveIntensity: 0, roughness: 0.3 });
  const lamp = mesh(new THREE.SphereGeometry(0.07, 16, 10), m);
  lamp.position.set(x, PLATE_TOP + 0.05, z);
  return { lamp, m };
}

const BAR_COLORS = ['#e5533d', '#f08a3a', '#f2c230', '#5cb85c', '#2bb3a8', '#3f86d6', '#6c5fc7', '#d45fa8'];
/** C major, C5 to C6 (MIDI). */
const BAR_NOTES = [72, 74, 76, 77, 79, 81, 83, 84];

/** Eight rainbow bars: with power, each touch rings a note; slide to play a run. */
export class Xylophone extends Part {
  readonly kind: PartKind = 'xylophone';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.9;
  private bars: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; x: number; half: number; press: number }[] = [];
  private notes: THREE.Sprite[] = [];
  private nextNote = 0;
  private held = -1;
  private power: { lamp: THREE.Mesh; m: THREE.MeshStandardMaterial };
  private readonly barY = PLATE_TOP + 0.24;

  constructor() {
    super();
    const plate = basePlate(3.6, 2.3, 'ксилофон');
    const frame = new THREE.Group();
    const wood = mat('#c98a4b', 0.6);
    const n = BAR_COLORS.length;
    const xs = BAR_COLORS.map((_, i) => -1.3 + (i * 2.6) / (n - 1));
    const halves = BAR_COLORS.map((_, i) => 0.66 - i * 0.035);
    // Two rails under the bars, converging like on a real xylophone.
    for (const sign of [-1, 1]) {
      const a = new THREE.Vector3(xs[0] - 0.25, 0, -0.25 + sign * (halves[0] - 0.17));
      const b = new THREE.Vector3(xs[n - 1] + 0.25, 0, -0.25 + sign * (halves[n - 1] - 0.17));
      const len = a.distanceTo(b);
      const rail = mesh(new RoundedBoxGeometry(len, 0.12, 0.16, 2, 0.04), wood);
      rail.position.copy(a).lerp(b, 0.5).setY(PLATE_TOP + 0.06);
      rail.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      frame.add(rail);
    }
    BAR_COLORS.forEach((color, i) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.15, emissive: color, emissiveIntensity: 0 });
      const bar = mesh(new RoundedBoxGeometry(0.3, 0.1, halves[i] * 2, 3, 0.04), m);
      bar.position.set(xs[i], this.barY, -0.25);
      frame.add(bar);
      for (const sign of [-1, 1]) {
        const pin = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), mat(C.metal, 0.3, 0.8), false);
        pin.position.set(0, 0.06, sign * (halves[i] - 0.17));
        bar.add(pin);
      }
      this.bars.push({ mesh: bar, mat: m, x: xs[i], half: halves[i], press: 0 });
    });
    for (let i = 0; i < 4; i++) {
      const s = sprite(noteTexture(), 0.4);
      s.material = s.material.clone();
      s.material.opacity = 0;
      this.notes.push(s);
      this.body.add(s);
    }
    this.power = powerLamp(-1.55, -0.95);
    this.body.add(plate, frame, this.power.lamp);
    this.addTerminal('a', 'none', 1.45, 0.8);
    this.addTerminal('b', 'none', -1.45, 0.8);
    this.pickable(plate, frame);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 20 };
  }

  get powered() {
    return this.state.level > 0.2;
  }

  private barAt(point: THREE.Vector3 | null | undefined): number {
    if (!point) return -1;
    const local = this.root.worldToLocal(point.clone());
    if (local.y < this.barY - 0.12) return -1;
    let best = -1;
    let bestD = 0.22;
    this.bars.forEach((b, i) => {
      const d = Math.abs(local.x - b.x);
      if (d < bestD && Math.abs(local.z + 0.25) < b.half + 0.05) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return this.barAt(point) >= 0;
  }

  private strike(i: number) {
    const b = this.bars[i];
    b.press = 1;
    this.sounds.push({ kind: 'xylophone', note: BAR_NOTES[i] });
    const s = this.notes[this.nextNote++ % this.notes.length];
    s.material.color.set(BAR_COLORS[i]);
    s.userData.t = 0;
    s.userData.x = b.x;
  }

  pressStart(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    const i = this.barAt(point);
    if (i < 0 || !this.powered) return false;
    this.held = i;
    this.strike(i);
    return true;
  }

  pressMove(_hit: THREE.Object3D | null, point: THREE.Vector3 | null) {
    const i = this.barAt(point);
    if (i >= 0 && i !== this.held && this.powered) {
      this.held = i;
      this.strike(i);
    }
  }

  pressEnd() {
    this.held = -1;
  }

  tap(hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    if (!this.powered && this.barAt(point) >= 0) this.sounds.push({ kind: 'noPower' });
    void hit;
    return false;
  }

  protected animate(dt: number) {
    for (const b of this.bars) {
      b.press = Math.max(0, b.press - dt * 3.5);
      b.mesh.position.y = this.barY - b.press * 0.045;
      b.mat.emissiveIntensity = b.press * 0.7;
    }
    this.power.m.emissiveIntensity = damp(this.power.m.emissiveIntensity, this.powered ? 2.2 : 0, 8, dt);
    for (const s of this.notes) {
      if (s.userData.t === undefined) continue;
      s.userData.t += dt * 1.2;
      const t = s.userData.t as number;
      s.position.set((s.userData.x as number) + Math.sin(t * 7) * 0.08, this.barY + 0.4 + t * 1.3, -0.25);
      s.material.opacity = t < 1 ? Math.sin(Math.min(1, t) * Math.PI) : 0;
    }
  }
}

/** A snare drum: with power, every touch on the head is a hit. */
export class Drum extends Part {
  readonly kind: PartKind = 'drum';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.25;
  private drum = new THREE.Group();
  private hit = 0;
  private top = PLATE_TOP + 0.8;
  private ripple: THREE.Mesh;
  private rippleMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  private power: { lamp: THREE.Mesh; m: THREE.MeshStandardMaterial };

  constructor() {
    super();
    const plate = basePlate(2.3, 2.1, 'барабан');
    const sculpt = model('drum', { width: 1.55 });
    if (sculpt) {
      this.drum.add(sculpt);
      this.top = PLATE_TOP + sizeOf(sculpt).y;
    } else {
      const shell = mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.6, 40), mat(C.red, 0.3));
      shell.position.y = 0.3;
      const head = mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.05, 40), mat('#f7f2ea', 0.7));
      head.position.y = 0.62;
      this.drum.add(shell, head);
      this.top = PLATE_TOP + 0.65;
    }
    this.drum.position.set(0, PLATE_TOP, -0.2);
    this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40), this.rippleMat);
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.position.set(0, this.top + 0.02, -0.2);
    this.power = powerLamp(-0.95, -0.85);
    this.body.add(plate, this.drum, this.ripple, this.power.lamp);
    this.addTerminal('a', 'none', 0.78, 0.68);
    this.addTerminal('b', 'none', -0.78, 0.68);
    this.pickable(plate, this.drum);
  }

  protected electrical(): Partial<CircuitElement> {
    return { r: 20 };
  }

  get powered() {
    return this.state.level > 0.2;
  }

  private onHead(point: THREE.Vector3 | null | undefined) {
    if (!point) return false;
    return this.root.worldToLocal(point.clone()).y > this.top - 0.3;
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return this.onHead(point);
  }

  pressStart(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    if (!this.onHead(point) || !this.powered) return false;
    this.hit = 1;
    this.sounds.push({ kind: 'drum' });
    return true;
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    if (!this.powered && this.onHead(point)) this.sounds.push({ kind: 'noPower' });
    return false;
  }

  protected animate(dt: number) {
    this.hit = Math.max(0, this.hit - dt * 4);
    this.drum.scale.set(1 + this.hit * 0.05, 1 - this.hit * 0.08, 1 + this.hit * 0.05);
    const t = 1 - this.hit;
    this.ripple.scale.setScalar(1 + t * 2.4);
    this.rippleMat.opacity = this.hit * 0.8;
    this.power.m.emissiveIntensity = damp(this.power.m.emissiveIntensity, this.powered ? 2.2 : 0, 8, dt);
  }
}
