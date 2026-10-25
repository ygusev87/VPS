// The tester: a dial with a needle that shows the voltage across its two
// posts. It barely draws any current, so it can sit across anything. A tap
// says the number out loud ("три вольта").
import * as THREE from 'three';
import type { CircuitElement, ElementKind } from '../circuit/solver';
import { Part, type PartKind } from './base';
import { boundsWhere, model } from './assets';
import { basePlate, damp, mat, mesh, PLATE_TOP, roundedBox, signDecal } from './kit';
import { C } from '../theme';

/** Full scale, volts. */
const SCALE = 12;
/** Needle swing either side of straight up, radians. */
const SWING = 1.05;

/** The scale: a card for the code-built case, or a round face (pivot at 0.6 of its height). */
function dialTexture(round = false): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = round ? 512 : 320;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf6ea';
  if (round) {
    g.beginPath();
    g.arc(256, 256, 252, 0, Math.PI * 2);
    g.fill();
  } else g.fillRect(0, 0, 512, 320);
  const cx = 256;
  const cy = round ? 307 : 290;
  const r = round ? 215 : 220;
  // Coloured bands: a little, a lot, too much.
  const band = (from: number, to: number, color: string) => {
    g.beginPath();
    g.strokeStyle = color;
    g.lineWidth = 26;
    const a0 = -Math.PI / 2 - SWING + (from / SCALE) * SWING * 2;
    const a1 = -Math.PI / 2 - SWING + (to / SCALE) * SWING * 2;
    g.arc(cx, cy, r - 20, a0, a1);
    g.stroke();
  };
  band(0, 4, '#7cc58a');
  band(4, 8, '#f2c230');
  band(8, 12, '#ec7a5c');
  g.strokeStyle = '#24304a';
  g.fillStyle = '#24304a';
  g.font = 'bold 34px "Fira Sans Condensed", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let v = 0; v <= SCALE; v++) {
    const a = -Math.PI / 2 - SWING + (v / SCALE) * SWING * 2;
    const big = v % 3 === 0;
    g.lineWidth = big ? 6 : 3;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (r - (big ? 44 : 36)), cy + Math.sin(a) * (r - (big ? 44 : 36)));
    g.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
    g.stroke();
    if (big) g.fillText(String(v), cx + Math.cos(a) * (r - 76), cy + Math.sin(a) * (r - 76));
  }
  g.font = 'bold 30px "Fira Sans Condensed", sans-serif';
  g.fillText('В', cx, cy - 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let dial: THREE.Texture | null = null;
let roundDial: THREE.Texture | null = null;

export class Tester extends Part {
  readonly kind: PartKind = 'tester';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.1;
  private needle = new THREE.Group();
  private angle = -SWING;
  private shown = 0;
  private flick = 0;

  constructor() {
    super();
    const plate = basePlate(2.0, 1.6, 'тестер');
    // A yellow case leaning back, its dial facing the viewer.
    const box = new THREE.Group();
    const shell = roundedBox(1.6, 1.2, 0.34, 0.1, '#f2c230', 0.45);
    shell.position.y = 0.6;
    dial ??= dialTexture();
    const face = mesh(new THREE.PlaneGeometry(1.4, 0.875), new THREE.MeshStandardMaterial({ map: dial, roughness: 0.6 }), false);
    face.position.set(0, 0.74, 0.171);
    const glass = mesh(
      new THREE.PlaneGeometry(1.42, 0.89),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.05, clearcoat: 1 }),
      false,
    );
    glass.position.set(0, 0.74, 0.2);
    // The needle turns about a pin near the bottom of the dial.
    const stick = mesh(new THREE.BoxGeometry(0.03, 0.56, 0.01), mat(C.red, 0.4), false);
    stick.position.y = 0.28;
    const pin = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), mat(C.navy2, 0.4), false);
    pin.rotation.x = Math.PI / 2;
    this.needle.add(stick, pin);
    this.needle.position.set(0, 0.74 - 0.875 / 2 + 0.08, 0.18);
    const foot = roundedBox(1.2, 0.12, 0.5, 0.05, C.navy2, 0.5);
    foot.position.set(0, 0.06, 0.05);
    box.add(shell, face, glass, this.needle, foot);
    box.position.set(0, PLATE_TOP, -0.2);
    box.rotation.x = -0.5;
    const sculpt = model('tester', { height: 1.15, rotateY: -Math.PI / 2 });
    if (sculpt) {
      // The sculpted case has a round dial (facing +x in the model): lay our
      // scale over it and pivot the needle low in its middle.
      box.clear();
      box.rotation.x = 0;
      box.position.set(0, PLATE_TOP - 0.02, -0.25);
      const front = new THREE.Box3().setFromObject(sculpt).max.z;
      const ring = boundsWhere(sculpt, (v) => v.z > front - 0.06);
      const c = ring.getCenter(new THREE.Vector3());
      const d = Math.min(ring.max.x - ring.min.x, ring.max.y - ring.min.y) * 0.84;
      roundDial ??= dialTexture(true);
      const card = mesh(new THREE.CircleGeometry(d / 2, 48), new THREE.MeshStandardMaterial({ map: roundDial, roughness: 0.6 }), false);
      card.position.set(c.x, c.y, front + 0.01);
      this.needle.position.set(c.x, c.y - d * 0.1, front + 0.02);
      this.needle.scale.setScalar(d / 1.3);
      box.add(sculpt, card, this.needle);
    }
    const plus = signDecal('plus', C.red, 0.28);
    plus.position.set(0.66, PLATE_TOP + 0.005, 0.1);
    const minus = signDecal('minus', C.navy, 0.28);
    minus.position.set(-0.66, PLATE_TOP + 0.005, 0.1);
    this.body.add(plate, box, plus, minus);
    this.addTerminal('a', 'plus', 0.7, 0.55);
    this.addTerminal('b', 'minus', -0.7, 0.55);
    this.pickable(plate, box);
  }

  /** A meter: a very high resistance, so it hardly changes the circuit. */
  protected electrical(): Partial<CircuitElement> {
    return { r: 1e5 };
  }

  /** Volts across the posts, + when wired the right way round. */
  get volts() {
    return this.state.voltage;
  }

  tap(): boolean {
    super.tap();
    this.flick = 1;
    this.sounds.push({ kind: 'volts', v: this.volts });
    return false;
  }

  protected animate(dt: number) {
    // A real needle swings past and settles; backwards it bangs on the stop.
    this.shown = damp(this.shown, this.volts, 5, dt);
    const v = THREE.MathUtils.clamp(this.shown, -1.2, SCALE + 0.4);
    const goal = -SWING + (v / SCALE) * SWING * 2;
    const k = 1 - Math.exp(-dt * 7);
    this.angle += (goal - this.angle) * k + Math.sin(this.time * 22) * 0.004 * Math.min(1, Math.abs(this.volts));
    this.flick = Math.max(0, this.flick - dt * 3);
    this.needle.rotation.z = -this.angle + Math.sin(this.time * 30) * this.flick * 0.05;
  }
}
