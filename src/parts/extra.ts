// Second wave of parts: carousel, windmill, music box, push button and a
// three-button control panel. Same recipe as models.ts: sculpted bodies when
// the models are loaded, code-built fallbacks otherwise, and everything that
// moves or glows built in code.
import * as THREE from 'three';
import type { CircuitElement, CircuitResult, ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { centroid, model, sizeOf, tip } from './assets';
import { Part, type PartKind } from './base';
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

export class MusicBox extends Part {
  readonly kind: PartKind = 'musicbox';
  readonly elementKind: ElementKind = 'buzzer';
  readonly radius = 1.1;
  private box = new THREE.Group();
  private notes: THREE.Sprite[] = [];

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

    this.body.add(plate, this.box, plus);
    this.addTerminal('a', 'plus', 0.68, 0.55);
    this.addTerminal('b', 'minus', -0.68, 0.55);
    this.pickable(plate, this.box);
  }

  get playing() {
    return this.state.level > 0.2;
  }

  protected animate(dt: number) {
    const on = this.playing;
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
/** Local x of the panel's three buttons (and of their outputs). */
export const PANEL_BUTTON_X = [-0.85, 0, 0.85];

/**
 * One input, three outputs: each button connects the input to its own
 * output, so each one can run a different gadget. Buttons latch: tap on,
 * tap off.
 */
export class ButtonPanel extends Part {
  readonly kind: PartKind = 'panel';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 2.0;
  readonly on = [false, false, false];
  private lamps: THREE.MeshStandardMaterial[] = [];
  private halos: THREE.Sprite[] = [];
  private rings: THREE.MeshBasicMaterial[] = [];
  private flowing = [false, false, false];
  private buttonX = PANEL_BUTTON_X;
  private buttonTop = PLATE_TOP + 0.7;

  constructor() {
    super();
    const plate = basePlate(4.0, 2.6, 'пульт');
    const sculpt = model('panel', { width: 2.9, rotateY: -Math.PI / 2 });
    const box = new THREE.Group();
    if (sculpt) {
      box.add(sculpt);
      this.buttonTop = PLATE_TOP + sizeOf(sculpt).y;
    } else {
      box.add(roundedBox(2.9, 0.55, 1.3, 0.1, C.navy2));
      this.buttonX.forEach((x, i) => {
        const cap = mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.16, 28), mat(PANEL_COLORS[i], 0.25));
        cap.position.set(x, 0.62, 0);
        box.add(cap);
      });
      this.buttonTop = PLATE_TOP + 0.7;
    }
    box.position.set(0, PLATE_TOP, -0.35);

    // Indicator lamp in front of each output, glowing in its button's colour.
    this.buttonX.forEach((x, i) => {
      const m = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: PANEL_COLORS[i], emissiveIntensity: 0, roughness: 0.3 });
      const lamp = mesh(new THREE.SphereGeometry(0.07, 16, 10), m);
      lamp.position.set(x, PLATE_TOP + 0.04, 0.62);
      this.lamps.push(m);
      const halo = sprite(glowFor(i === 0 ? 'rgba(255,90,70,0.9)' : i === 1 ? 'rgba(255,215,80,0.9)' : 'rgba(80,200,110,0.9)'), 0.9);
      halo.position.set(x, this.buttonTop + 0.25, -0.3);
      this.halos.push(halo);
      // A lit ring round a latched button, so "on" reads at a glance.
      const ringMat = new THREE.MeshBasicMaterial({ color: PANEL_COLORS[i], transparent: true, opacity: 0, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 10, 40), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, this.buttonTop - 0.12, -0.35);
      this.rings.push(ringMat);
      this.body.add(lamp, halo, ring);
    });

    const plus = signDecal('plus', C.red, 0.28);
    plus.position.set(-1.65, PLATE_TOP + 0.005, 0.55);
    this.body.add(plate, box, plus);
    this.addTerminal('a', 'none', -1.65, 0.95);
    this.buttonX.forEach((x, i) => this.addTerminal(`o${i + 1}`, 'none', x, 0.95, PANEL_COLORS[i]));
    this.pickable(plate, box);
  }

  elements(): CircuitElement[] {
    return this.buttonX.map((_, i) => ({
      id: `${this.id}#${i}`,
      kind: 'switch' as const,
      a: this.terminal('a').id,
      b: this.terminal(`o${i + 1}`).id,
      closed: this.on[i],
    }));
  }

  onSolved(r: CircuitResult) {
    this.flowing = this.on.map((on, i) => on && Math.abs(r.elements.get(`${this.id}#${i}`)?.current ?? 0) > 0.01);
    this.closed = this.on.some(Boolean);
  }

  /** Which button a touch landed on, from where it hit the part. */
  private buttonAt(point: THREE.Vector3 | null | undefined): number {
    if (!point) return 1;
    const local = this.root.worldToLocal(point.clone());
    let best = 0;
    this.buttonX.forEach((x, i) => {
      if (Math.abs(local.x - x) < Math.abs(local.x - this.buttonX[best])) best = i;
    });
    return best;
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    const i = this.buttonAt(point);
    this.on[i] = !this.on[i];
    return true;
  }

  protected animate(dt: number) {
    this.on.forEach((on, i) => {
      const target = on ? (this.flowing[i] ? 2.6 : 1.2) : 0;
      this.lamps[i].emissiveIntensity = damp(this.lamps[i].emissiveIntensity, target, 10, dt);
      const halo = this.halos[i];
      halo.material.opacity = damp(halo.material.opacity, on ? 0.85 : 0, 10, dt);
      this.rings[i].opacity = damp(this.rings[i].opacity, on ? 0.6 + 0.4 * Math.sin(this.time * 5 + i) ** 2 : 0, 12, dt);
      halo.scale.setScalar(0.8 + (on ? Math.sin(this.time * 4 + i) * 0.08 : 0));
    });
  }
}
