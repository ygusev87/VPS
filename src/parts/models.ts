// The parts kit, modelled after the child's physical set: battery box,
// bulb, fan, switch, LED and buzzer. Everything is built from primitives so
// the whole kit ships as code, no model files.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ElementKind } from '../circuit/solver';
import { C } from '../theme';
import { centroid, model, sizeOf, tip } from './assets';
import { Part, type LightColor, type PartKind } from './base';
import { basePlate, blurAmount, damp, glowTexture, lightPool, mat, mesh, PLATE_TOP, raysTexture, rotorBlur, roundedBox, signDecal, textDecal } from './kit';

let warmGlow: THREE.Texture | null = null;
let redGlow: THREE.Texture | null = null;
let rays: THREE.Texture | null = null;
const tex = {
  get warm() {
    return (warmGlow ??= glowTexture('rgba(255,200,90,0.95)'));
  },
  get red() {
    return (redGlow ??= glowTexture('rgba(255,90,70,0.9)'));
  },
  get rays() {
    return (rays ??= raysTexture());
  },
};

export function materialsOf(o: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out = new Set<THREE.MeshStandardMaterial>();
  o.traverse((c) => {
    const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && 'emissive' in m) out.add(m);
  });
  return [...out];
}

/** Materials of a sculpted model, set up to glow in their own colours. */
export function materialsOfMeshes(o: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const mats = materialsOf(o);
  for (const m of mats) {
    m.emissive.set('#ffffff');
    m.emissiveMap = m.map;
    m.emissiveIntensity = 0;
    m.needsUpdate = true;
  }
  return mats;
}

/** What each light colour looks like. `hue` turns the red LED model's colours (radians, YIQ: red→yellow is negative, red→blue positive). */
export const LIGHT: Record<LightColor, { hex: string; glow: string; pool: string; hue: number }> = {
  warm: { hex: '#ffb347', glow: 'rgba(255,200,90,0.95)', pool: 'rgba(255,196,96,0.85)', hue: 0.5 },
  red: { hex: '#ff4a36', glow: 'rgba(255,90,70,0.9)', pool: 'rgba(255,80,60,0.75)', hue: 0 },
  green: { hex: '#3fe07a', glow: 'rgba(80,230,120,0.9)', pool: 'rgba(70,220,110,0.7)', hue: -2.3 },
  blue: { hex: '#4f9dff', glow: 'rgba(90,160,255,0.9)', pool: 'rgba(80,150,255,0.7)', hue: 2.0 },
  yellow: { hex: '#ffd93d', glow: 'rgba(255,225,80,0.95)', pool: 'rgba(255,220,80,0.75)', hue: -1.15 },
};

const glowCache = new Map<string, THREE.Texture>();
export function glowFor(rgba: string): THREE.Texture {
  let t = glowCache.get(rgba);
  if (!t) glowCache.set(rgba, (t = glowTexture(rgba)));
  return t;
}

/**
 * Rotate the hue of a material's colour and emissive maps in the shader, so
 * one red LED model can be any colour. Grey metal parts stay grey.
 */
function hueShift(m: THREE.MeshStandardMaterial): { value: number } {
  const uniform = { value: 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHue = uniform;
    const fn = `
      uniform float uHue;
      vec3 hueRotate(vec3 c, float a) {
        const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
        const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
        vec3 yiq = toYIQ * c;
        float h = atan(yiq.z, yiq.y) + a;
        float ch = length(yiq.yz);
        return toRGB * vec3(yiq.x, ch * cos(h), ch * sin(h));
      }`;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + fn)
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = max(hueRotate(diffuseColor.rgb, uHue), 0.0);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance = max(hueRotate(totalEmissiveRadiance, uHue), 0.0);');
  };
  m.customProgramCacheKey = () => 'hue-shift';
  return uniform;
}

export function sprite(map: THREE.Texture, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }));
  s.scale.setScalar(size);
  s.renderOrder = 10;
  return s;
}

// ───────────────────────────── Battery ─────────────────────────────

export class Battery extends Part {
  readonly kind: PartKind;
  readonly elementKind: ElementKind = 'battery';
  readonly radius: number;
  private holderMat = mat(C.navy2, 0.5).clone();
  private heat: THREE.MeshStandardMaterial[] = [];
  private heatLevel = 0;
  private lamp: THREE.Mesh;
  private lampMat = new THREE.MeshStandardMaterial({ color: '#9a9fae', emissive: C.teal, emissiveIntensity: 0 });
  private steam: THREE.Sprite[] = [];

  /** big: the 4×AA pack, 6 V. */
  constructor(private big = false) {
    super();
    this.kind = big ? 'bigBattery' : 'battery';
    this.radius = big ? 1.75 : 1.55;
    const plate = basePlate(big ? 3.2 : 2.9, big ? 2.6 : 2.0);
    // Open tray with two AA cells, springs on the minus end and red/black leads
    // running to the posts, like the real battery box.
    const tray = new THREE.Group();
    const floor = mesh(new RoundedBoxGeometry(2.5, 0.1, 1.12, 2, 0.04), this.holderMat);
    floor.position.y = 0.05;
    tray.add(floor);
    const wallGeo = new RoundedBoxGeometry(2.5, 0.3, 0.07, 2, 0.03);
    for (const z of [-0.525, 0.525]) {
      const w = mesh(wallGeo, this.holderMat);
      w.position.set(0, 0.15, z);
      tray.add(w);
    }
    const endGeo = new RoundedBoxGeometry(0.09, 0.36, 1.12, 2, 0.03);
    for (const x of [-1.21, 1.21]) {
      const e = mesh(endGeo, this.holderMat);
      e.position.set(x, 0.18, 0);
      tray.add(e);
    }
    const divider = mesh(new THREE.BoxGeometry(2.3, 0.16, 0.04), this.holderMat);
    divider.position.set(0, 0.08, 0);
    tray.add(divider);
    // Cells sit head-to-tail, as in a real series holder.
    const c1 = aaCell(false);
    c1.position.set(0, 0.32, -0.26);
    const c2 = aaCell(true);
    c2.position.set(0, 0.32, 0.26);
    tray.add(c1, c2);
    for (const [x, z] of [
      [-1.1, -0.26],
      [1.1, 0.26],
    ]) {
      const sp = spring();
      sp.position.set(x, 0.32, z);
      sp.rotation.y = x < 0 ? 0 : Math.PI;
      tray.add(sp);
    }
    // Prefer the sculpted model; the code-built tray is the fallback.
    const holder = (big ? model('bigbattery', { width: 2.4 }) : model('battery', { width: 2.3 })) ?? tray;
    holder.position.set(0, PLATE_TOP, big ? -0.35 : -0.3);
    this.heat = materialsOf(holder);

    // Leads from the holder to the posts.
    const lead = (color: string, from: THREE.Vector3, to: THREE.Vector3) => {
      const mid = from.clone().lerp(to, 0.5).setY(PLATE_TOP + 0.05).add(new THREE.Vector3(Math.sign(from.x) * 0.12, 0, 0));
      const curve = new THREE.CatmullRomCurve3([from, mid, to]);
      return mesh(new THREE.TubeGeometry(curve, 24, 0.035, 8), mat(color, 0.4));
    };
    // Leads leave the holder's end walls low and run along the board to the posts.
    const zt = big ? 1.0 : 0.7;
    const leadR = lead(C.red, new THREE.Vector3(1.17, PLATE_TOP + 0.1, big ? 0.3 : 0.05), new THREE.Vector3(1.0, PLATE_TOP + 0.06, zt));
    const leadB = lead('#20242e', new THREE.Vector3(-1.17, PLATE_TOP + 0.1, big ? 0.2 : -0.1), new THREE.Vector3(-1.0, PLATE_TOP + 0.06, zt));

    this.lamp = mesh(new THREE.SphereGeometry(0.06, 16, 10), this.lampMat);
    this.lamp.position.set(0, PLATE_TOP + 0.03, zt + 0.02);

    const plus = signDecal('plus', C.red, 0.3);
    plus.position.set(0.5, PLATE_TOP + 0.005, zt + 0.02);
    const minus = signDecal('minus', C.navy2, 0.3);
    minus.position.set(-0.5, PLATE_TOP + 0.005, zt + 0.02);
    const volts = textDecal(big ? '6 V' : '3 V', 0.5, 0.16);
    volts.position.set(0, PLATE_TOP + 0.004, zt + 0.16);

    this.body.add(plate, holder, leadR, leadB, this.lamp, plus, minus, volts);
    this.addTerminal('a', 'plus', 1.0, zt);
    this.addTerminal('b', 'minus', -1.0, zt);
    this.pickable(plate, holder);

    for (let i = 0; i < 4; i++) {
      const s = sprite(tex.warm, 0.5);
      s.material = s.material.clone();
      s.material.color.set('#ffffff');
      s.userData.t = i / 4;
      this.steam.push(s);
      this.body.add(s);
    }
  }

  protected electrical() {
    return this.big ? { emf: 6, r: 0.6 } : {};
  }

  protected animate(dt: number) {
    const working = Math.max(0, this.state.level);
    this.lampMat.emissiveIntensity = damp(this.lampMat.emissiveIntensity, working > 0.02 && !this.state.shorted ? 2.2 : 0, 8, dt);
    // Short circuit: the holder glows hot red and puffs of "steam" rise.
    const hot = this.state.shorted ? 0.6 + 0.4 * Math.sin(this.time * 9) : 0;
    this.heatLevel = damp(this.heatLevel, hot, 10, dt);
    for (const m of this.heat) {
      m.emissive.set(C.red);
      m.emissiveIntensity = this.heatLevel * 0.9;
    }
    for (const s of this.steam) {
      s.userData.t = (s.userData.t + dt * 0.7) % 1;
      const t = s.userData.t as number;
      s.position.set(Math.sin(t * 9 + s.id) * 0.4, PLATE_TOP + 0.6 + t * 1.6, -0.22);
      s.scale.setScalar(0.4 + t * 0.9);
      s.material.opacity = this.state.shorted ? Math.sin(t * Math.PI) * 0.7 : damp(s.material.opacity, 0, 6, dt);
    }
  }
}

let cellTex: THREE.Texture | null = null;

/** AA cell lying along x; the printed wrap is a canvas texture. */
function aaCell(flip: boolean): THREE.Group {
  if (!cellTex) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = C.amber;
    ctx.fillRect(0, 0, 256, 512);
    ctx.fillStyle = C.navy;
    ctx.fillRect(0, 0, 256, 170);
    ctx.fillStyle = '#fff6d6';
    ctx.fillRect(0, 170, 256, 10);
    ctx.fillStyle = 'rgba(24,33,61,0.85)';
    ctx.font = '700 46px "Fira Sans Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(128, 340);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('1.5V  AA', 0, 16);
    ctx.restore();
    cellTex = new THREE.CanvasTexture(c);
    cellTex.colorSpace = THREE.SRGBColorSpace;
    cellTex.anisotropy = 8;
  }
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.9, 40, 1, true), new THREE.MeshStandardMaterial({ map: cellTex, roughness: 0.35, metalness: 0.15 }));
  const capGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 40);
  const capA = mesh(capGeo, mat(C.metal, 0.25, 0.9));
  capA.position.y = 0.97;
  const capB = mesh(capGeo, mat(C.metal, 0.25, 0.9));
  capB.position.y = -0.97;
  const nub = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 20), mat(C.metal, 0.25, 0.9));
  nub.position.y = 1.02;
  g.add(body, capA, capB, nub);
  g.rotation.z = flip ? Math.PI / 2 : -Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}

function spring(): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const a = t * Math.PI * 2 * 5;
    pts.push(new THREE.Vector3(t * 0.14, Math.sin(a) * 0.12, Math.cos(a) * 0.12));
  }
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.012, 5), mat(C.metal, 0.3, 0.9), false);
}

// ────────────────────────────── Bulb ───────────────────────────────

const FIL_COLD = new THREE.Color('#ff3a10');
const FIL_HOT = new THREE.Color('#ffe2b0');

export class Bulb extends Part {
  readonly kind: PartKind = 'bulb';
  readonly elementKind: ElementKind = 'bulb';
  readonly radius = 1.15;
  private glassMat: THREE.MeshPhysicalMaterial;
  private filamentMat: THREE.MeshStandardMaterial;
  private glow: THREE.Sprite;
  private rays: THREE.Sprite;
  private pool = lightPool(6, 'rgba(255,196,96,0.85)');
  private shown = 0;

  constructor() {
    super();
    this.color = 'warm';
    const plate = basePlate(2.0, 1.55, 'лампа 3 в');
    const socketModel = model('socket', { width: 1.05 });
    const socket = socketModel ?? mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.32, 28), mat(C.navy2, 0.5));
    socket.position.set(0, socketModel ? PLATE_TOP : PLATE_TOP + 0.16, -0.15);
    // Where the glass starts: on the brass collar of the sculpted socket, or on the code-built screw.
    const neck = socketModel ? PLATE_TOP + sizeOf(socketModel).y - 0.08 : PLATE_TOP + 0.66;

    const screwPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const y = (i / 12) * 0.36;
      screwPts.push(new THREE.Vector2(0.27 + 0.025 * Math.sin(i * Math.PI), y));
    }
    const screw = mesh(new THREE.LatheGeometry(screwPts, 28), mat(C.metal, 0.3, 0.85));
    screw.position.set(0, PLATE_TOP + 0.32, -0.15);
    screw.visible = !socketModel;

    const glassProfile = [
      [0.26, 0],
      [0.28, 0.12],
      [0.42, 0.34],
      [0.6, 0.62],
      [0.64, 0.82],
      [0.58, 1.04],
      [0.4, 1.22],
      [0.001, 1.3],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: '#fffaf0',
      transparent: true,
      opacity: 0.34,
      roughness: 0.05,
      clearcoat: 1,
      emissive: '#ffd27a',
      emissiveIntensity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glass = mesh(new THREE.LatheGeometry(glassProfile, 40), this.glassMat, false);
    glass.position.set(0, neck, -0.15);
    glass.renderOrder = 5;

    this.filamentMat = new THREE.MeshStandardMaterial({ color: '#6b5236', emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.5 });
    const fil = new THREE.Group();
    const supportGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6);
    for (const x of [-0.14, 0.14]) {
      const s = mesh(supportGeo, mat(C.metal, 0.4, 0.7), false);
      s.position.set(x, 0.28, 0);
      fil.add(s);
    }
    const coil: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const a = t * Math.PI * 2 * 7;
      coil.push(new THREE.Vector3(-0.14 + t * 0.28, 0.56 + Math.sin(a) * 0.035 + Math.sin(t * Math.PI) * 0.06, Math.cos(a) * 0.035));
    }
    fil.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 120, 0.014, 5), this.filamentMat, false));
    fil.position.set(0, neck, -0.15);

    this.glow = sprite(tex.warm, 3);
    this.glow.position.set(0, neck + 0.6, -0.15);
    this.rays = sprite(tex.rays, 3.6);
    this.rays.position.copy(this.glow.position);
    this.rays.renderOrder = 9;

    this.pool.position.z = -0.15;
    this.body.add(plate, socket, screw, fil, glass, this.glow, this.rays, this.pool);
    this.addTerminal('a', 'none', 0.66, 0.48);
    this.addTerminal('b', 'none', -0.66, 0.48);
    this.pickable(plate, socket, screw, glass);
  }

  /** Tap a bulb to swap its colour. */
  tap(): boolean {
    super.tap();
    const order: LightColor[] = ['warm', 'red', 'green', 'blue'];
    this.setColor(order[(order.indexOf(this.color) + 1) % order.length]);
    return true;
  }

  setColor(c: LightColor) {
    this.color = c;
    const l = LIGHT[c];
    this.glassMat.color.set('#fffaf0').lerp(new THREE.Color(l.hex), c === 'warm' ? 0 : 0.45);
    this.glassMat.emissive.set(c === 'warm' ? '#ffd27a' : l.hex);
    this.filamentMat.emissive.set(l.hex);
    this.glow.material.map = glowFor(l.glow);
    (this.pool.material as THREE.MeshBasicMaterial).map = glowFor(l.pool);
    this.rays.material.color.set(c === 'warm' ? '#ffffff' : l.hex);
    this.lightColor.set(c === 'warm' ? '#ffc98a' : l.hex);
  }

  private lightColor = new THREE.Color('#ffc98a');
  glowLight() {
    if (this.shown < 0.05) return null;
    return { at: this.glow.getWorldPosition(new THREE.Vector3()), color: this.lightColor, power: this.shown };
  }

  protected animate(dt: number) {
    // Eyes judge brightness roughly by the square root of power, so two
    // bulbs in series read as "dim but on" rather than "off".
    const target = Math.min(1.5, Math.sqrt(Math.max(0, this.state.level)));
    // Filaments warm up fast and cool a little slower.
    this.shown = damp(this.shown, target, target > this.shown ? 9 : 5, dt);
    const b = this.shown;
    const flicker = b > 0.05 ? 1 + Math.sin(this.time * 31) * 0.015 : 1;
    // A real filament: dull red when barely fed, then orange, then near white.
    if (this.color === 'warm') this.filamentMat.emissive.copy(FIL_COLD).lerp(FIL_HOT, Math.min(1, b));
    this.filamentMat.emissiveIntensity = (0.5 + b * 9) * b * flicker;
    this.glassMat.emissiveIntensity = b * 1.1;
    this.glassMat.opacity = 0.34 + b * 0.35;
    // The bloom makes the halo now; the painted glow only softens it.
    this.glow.material.opacity = Math.min(0.6, b * 0.55);
    this.glow.scale.setScalar(1.6 + b * 0.9);
    this.rays.material.opacity = Math.min(0.12, Math.max(0, b - 0.4) * 0.2);
    this.rays.material.rotation += dt * 0.25;
    this.rays.scale.setScalar(2.3 + b * 0.7 + Math.sin(this.time * 2) * 0.08);
    (this.pool.material as THREE.MeshBasicMaterial).opacity = Math.min(0.8, b * 0.6);
  }
}

// ─────────────────────────────── Fan ───────────────────────────────

export class Fan extends Part {
  readonly kind: PartKind = 'fan';
  readonly elementKind: ElementKind = 'motor';
  readonly radius = 1.45;
  private rotor = new THREE.Group();
  private blur: THREE.Mesh;
  private bladeMats: THREE.MeshStandardMaterial[] = [];
  private speed = 0;
  private gusts: THREE.Mesh[] = [];

  constructor() {
    super();
    const plate = basePlate(2.6, 2.1, 'мотор');
    const motor = model('motor', { height: 1.3, rotateY: -Math.PI / 2 });
    const frame = new THREE.Group();
    let hubAt: THREE.Vector3;
    if (motor) {
      motor.position.set(0, PLATE_TOP, -0.35);
      frame.add(motor);
      // The shaft is the model's frontmost point.
      hubAt = tip(motor, 'z', 1).add(motor.position);
    } else {
      const stand = roundedBox(0.5, 1.15, 0.42, 0.1, C.navy2);
      stand.position.set(0, PLATE_TOP + 0.575, -0.3);
      const housing = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.72, 32), mat(C.metal, 0.3, 0.7));
      housing.rotation.x = Math.PI / 2;
      housing.position.set(0, PLATE_TOP + 1.42, -0.3);
      const cap = mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.12, 32), mat(C.red, 0.45));
      cap.rotation.x = Math.PI / 2;
      cap.position.set(0, PLATE_TOP + 1.42, -0.68);
      const shaft = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), mat(C.metal, 0.3, 0.9));
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, PLATE_TOP + 1.42, 0.15);
      frame.add(stand, housing, cap, shaft);
      hubAt = new THREE.Vector3(0, PLATE_TOP + 1.42, 0.3);
    }

    const prop = model('propeller', { height: 1.6, rotateY: -Math.PI / 2 });
    if (prop) {
      // Spin about the blades' centre of mass, back face on the shaft tip.
      const c = centroid(prop);
      const back = new THREE.Box3().setFromObject(prop).min.z;
      prop.position.set(-c.x, -c.y, -back - 0.02);
      this.rotor.add(prop);
    } else {
      const hub = mesh(new THREE.SphereGeometry(0.15, 20, 14), mat(C.red, 0.4));
      hub.scale.z = 0.8;
      this.rotor.add(hub);
      const bladeGeo = new THREE.SphereGeometry(1, 24, 12);
      for (let i = 0; i < 3; i++) {
        const arm = new THREE.Group();
        const blade = mesh(bladeGeo, mat(C.teal, 0.45));
        blade.scale.set(0.24, 0.5, 0.04);
        blade.position.y = 0.55;
        blade.rotation.y = 0.45; // pitch
        arm.add(blade);
        arm.rotation.z = (i * Math.PI * 2) / 3;
        this.rotor.add(arm);
      }
    }
    this.rotor.position.copy(hubAt);

    // At speed the blades fade into a sweeping blur, like a real propeller.
    this.blur = rotorBlur(1.08, 3, '#21b7b4');
    this.blur.position.copy(this.rotor.position).setZ(this.rotor.position.z + 0.08);
    // Own copies: materials from the shared cache must not fade on other parts.
    this.rotor.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = (m.material as THREE.Material).clone();
    });
    this.bladeMats = materialsOf(this.rotor);
    for (const m of this.bladeMats) m.transparent = true;

    const gustGeo = new THREE.TorusGeometry(0.5, 0.025, 4, 24, Math.PI * 0.6);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Mesh(gustGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      g.userData.t = i / 6;
      g.userData.a = (i * Math.PI * 2) / 6;
      this.gusts.push(g);
      this.body.add(g);
    }

    this.body.add(plate, frame, this.rotor, this.blur);
    this.addTerminal('a', 'none', 0.95, 0.78);
    this.addTerminal('b', 'none', -0.95, 0.78);
    this.pickable(plate, frame, this.rotor);
  }

  /** Its breeze, for pinwheels and windmills in front of it (see wind.ts). */
  breeze() {
    const strength = Math.abs(this.speed) / 22;
    if (strength < 0.05) return null;
    const origin = this.body.localToWorld(this.rotor.position.clone());
    const dir = new THREE.Vector3(0, 0, 1).transformDirection(this.root.matrixWorld).setY(0).normalize();
    return { origin, dir, strength };
  }

  protected animate(dt: number) {
    const target = Math.max(-1.6, Math.min(1.6, this.state.level)) * 22;
    this.speed = damp(this.speed, target, Math.abs(target) > Math.abs(this.speed) ? 1.6 : 0.9, dt);
    this.rotor.rotation.z -= this.speed * dt;
    const mag = Math.abs(this.speed) / 22;
    const k = blurAmount(this.speed);
    (this.blur.material as THREE.MeshBasicMaterial).opacity = k * 0.95;
    this.blur.rotation.z = this.rotor.rotation.z;
    for (const m of this.bladeMats) m.opacity = 1 - k * 0.3;
    for (const g of this.gusts) {
      g.userData.t = (g.userData.t + dt * (0.6 + mag)) % 1;
      const t = g.userData.t as number;
      const a = g.userData.a as number;
      g.position.set(Math.cos(a) * 0.35, this.rotor.position.y + Math.sin(a) * 0.35, this.rotor.position.z + 0.2 + t * 2.4);
      g.rotation.z = a + this.time * 0.5;
      g.scale.setScalar(0.6 + t * 1.2);
      (g.material as THREE.MeshBasicMaterial).opacity = mag > 0.15 ? Math.sin(t * Math.PI) * 0.75 * Math.min(1, mag) : 0;
    }
  }

  /** Signed rotor speed, rad/s. */
  get spin() {
    return this.speed;
  }
}

// ───────────────────────────── Switch ──────────────────────────────

export class Switch extends Part {
  readonly kind: PartKind = 'switch';
  readonly elementKind: ElementKind = 'switch';
  readonly radius = 1.3;
  /** Knife blade, hinged at +x; rotation.z < 0 lifts it open. */
  private blade = new THREE.Group();
  private angle = -0.95;
  private angleV = 0;
  private sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3c4').multiplyScalar(4), transparent: true, opacity: 0, depthWrite: false });
  private spark!: THREE.Mesh;

  constructor() {
    super();
    const plate = basePlate(2.5, 1.5, 'выключатель');
    // Knife switch: ceramic base with a hinge clip at +x and a contact jaw at −x.
    const base = model('knife', { width: 1.7, rotateY: Math.PI / 2 }) ?? fallbackKnifeBase();
    base.position.set(0, PLATE_TOP, -0.15);
    const h = sizeOf(base).y;

    // The blade: a flat copper strip from the hinge to past the jaw, with an
    // insulated handle so it is obvious where to press.
    const len = 1.55;
    const copper = mat('#c7743e', 0.3, 0.75);
    const strip = mesh(new RoundedBoxGeometry(len, 0.16, 0.05, 2, 0.02), copper);
    strip.position.x = -len / 2 + 0.05;
    const pin = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16), mat(C.brass, 0.3, 0.85));
    pin.rotation.x = Math.PI / 2;
    const handle = mesh(new THREE.CapsuleGeometry(0.085, 0.3, 6, 18), mat(C.red, 0.35));
    handle.rotation.z = Math.PI / 2;
    handle.position.x = -len - 0.08;
    const collar = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18), mat(C.navy2, 0.4));
    collar.rotation.z = Math.PI / 2;
    collar.position.x = -len + 0.12;
    this.blade.add(strip, pin, handle, collar);
    this.blade.position.set(0.66, PLATE_TOP + h * 0.72, -0.15);

    // Flash at the jaw when the blade drops in.
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), this.sparkMat);
    this.spark = spark;
    spark.position.set(-0.66, PLATE_TOP + h * 0.72, -0.15);

    this.body.add(plate, base, this.blade, spark);
    this.addTerminal('a', 'none', 0.95, 0.47);
    this.addTerminal('b', 'none', -0.95, 0.47);
    this.pickable(plate, base, this.blade);
  }

  tap(): boolean {
    this.closed = !this.closed;
    this.angleV += this.closed ? 6 : -6;
    super.tap();
    return true;
  }

  protected animate(dt: number) {
    const target = this.closed ? 0 : -0.95;
    // Stiff spring with a little bounce as the blade seats in the jaw.
    this.angleV += ((target - this.angle) * 320 - this.angleV * 18) * dt;
    this.angle += this.angleV * dt;
    if (this.closed && this.angle > 0) {
      this.angle = 0;
      if (this.angleV > 1) {
        this.sparkMat.opacity = 1;
        this.effects.push({ kind: 'sparks', at: this.spark.getWorldPosition(new THREE.Vector3()), n: 10, color: '#ffe08a' });
      }
      this.angleV *= -0.25;
    }
    this.blade.rotation.z = this.angle;
    this.sparkMat.opacity = Math.max(0, this.sparkMat.opacity - dt * 5);
  }
}

/** Code-built stand-in for the knife switch base. */
function fallbackKnifeBase(): THREE.Group {
  const g = new THREE.Group();
  const block = roundedBox(1.7, 0.18, 0.7, 0.06, '#f3ece0', 0.5);
  const clipGeo = new RoundedBoxGeometry(0.22, 0.42, 0.3, 2, 0.03);
  for (const x of [0.66, -0.66]) {
    const clip = mesh(clipGeo, mat(C.brass, 0.3, 0.85));
    clip.position.set(x, 0.3, 0);
    g.add(clip);
  }
  g.add(block);
  return g;
}

// ────────────────────────────── LED ────────────────────────────────

export class Led extends Part {
  readonly kind: PartKind = 'led';
  readonly elementKind: ElementKind = 'led';
  readonly radius = 1.0;
  private domeMat: THREE.MeshPhysicalMaterial;
  private glow: THREE.Sprite;
  private pool = lightPool(3.6, 'rgba(255,80,60,0.75)');
  private shown = 0;
  /** Materials of the sculpted LED, lit through their own colour map. */
  private ledMats: THREE.MeshStandardMaterial[] = [];
  private hue: { value: number }[] = [];

  constructor() {
    super();
    this.color = 'red';
    const plate = basePlate(1.75, 1.45, 'светодиод');
    this.domeMat = new THREE.MeshPhysicalMaterial({
      color: C.red,
      transparent: true,
      opacity: 0.88,
      roughness: 0.15,
      clearcoat: 1,
      emissive: '#ff3b2a',
      emissiveIntensity: 0,
    });
    const sculpt = model('led', { height: 1.6 });
    const dome = new THREE.Group();
    let domeTop: number;
    if (sculpt) {
      // Push the long legs into the board so only a short stretch shows.
      sculpt.position.set(0, PLATE_TOP - 0.45, -0.2);
      dome.add(sculpt);
      this.ledMats = materialsOfMeshes(sculpt);
      this.hue = this.ledMats.map(hueShift);
      domeTop = PLATE_TOP - 0.45 + 1.6;
    } else {
      const rim = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 28), this.domeMat);
      rim.position.y = 0.035;
      const barrel = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 28), this.domeMat);
      barrel.position.y = 0.25;
      const top = mesh(new THREE.SphereGeometry(0.25, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat);
      top.position.y = 0.43;
      dome.add(rim, barrel, top);
      dome.position.set(0, PLATE_TOP + 0.55, -0.2);
      // Legs: the long one (+) on the right, like a real LED.
      const legMat = mat(C.metal, 0.3, 0.85);
      const legL = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), legMat);
      legL.position.set(-0.1, -0.28, 0);
      const legR = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), legMat);
      legR.position.set(0.1, -0.28, 0);
      dome.add(legL, legR);
      domeTop = PLATE_TOP + 1.05;
    }

    // Copper traces from legs to the posts.
    const traceMat = mat('#c98a4a', 0.4, 0.5);
    const tr = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.07), traceMat, false);
    tr.position.set(0.33, PLATE_TOP + 0.01, 0.12);
    tr.rotation.y = -0.6;
    const tl = tr.clone();
    tl.position.x = -0.33;
    tl.rotation.y = 0.6;

    const plus = signDecal('plus', C.red, 0.3);
    plus.position.set(0.55, PLATE_TOP + 0.005, -0.25);

    this.glow = sprite(tex.red, 2.4);
    this.glow.position.set(0, domeTop - 0.3, -0.2);

    this.pool.position.z = -0.2;
    this.body.add(plate, dome, tr, tl, plus, this.glow, this.pool);
    this.addTerminal('a', 'plus', 0.55, 0.42);
    this.addTerminal('b', 'minus', -0.55, 0.42);
    this.pickable(plate, dome);
  }

  /** Tap an LED to swap its colour. */
  tap(): boolean {
    super.tap();
    const order: LightColor[] = ['red', 'green', 'blue', 'yellow'];
    this.setColor(order[(order.indexOf(this.color) + 1) % order.length]);
    return true;
  }

  setColor(c: LightColor) {
    this.color = c;
    const l = LIGHT[c];
    for (const u of this.hue) u.value = l.hue;
    this.domeMat.color.set(l.hex);
    this.domeMat.emissive.set(l.hex);
    this.lightColor.set(l.hex);
    this.glow.material.map = glowFor(l.glow);
    (this.pool.material as THREE.MeshBasicMaterial).map = glowFor(l.pool);
  }

  private lightColor = new THREE.Color('#ff3b2a');
  glowLight() {
    if (this.shown < 0.05) return null;
    return { at: this.glow.getWorldPosition(new THREE.Vector3()), color: this.lightColor, power: this.shown * 0.6 };
  }

  protected animate(dt: number) {
    const target = Math.min(1.4, this.state.level);
    this.shown = damp(this.shown, target, 14, dt);
    const b = this.shown;
    this.domeMat.emissiveIntensity = b * 4.5;
    for (const m of this.ledMats) m.emissiveIntensity = b * 3.2;
    this.glow.material.opacity = Math.min(0.7, b * 0.65);
    this.glow.scale.setScalar(1.6 + b * 1.2);
    (this.pool.material as THREE.MeshBasicMaterial).opacity = Math.min(0.7, b * 0.55);
  }
}

// ───────────────────────────── Buzzer ──────────────────────────────

export class Buzzer extends Part {
  readonly kind: PartKind = 'buzzer';
  readonly elementKind: ElementKind = 'buzzer';
  readonly radius = 1.05;
  private can: THREE.Group;
  private waves: THREE.Mesh[] = [];

  constructor() {
    super();
    const plate = basePlate(1.8, 1.45, 'зуммер');
    this.can = new THREE.Group();
    const sculpt = model('buzzer', { width: 1.0 });
    const body = mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.5, 36), mat(C.navy, 0.55));
    body.position.y = 0.25;
    const lip = mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 36), mat(C.navy2, 0.5));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.5;
    const hole = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), mat('#05070d', 0.9));
    hole.position.y = 0.51;
    if (sculpt) {
      // Pins go into the board.
      sculpt.position.y = -0.17;
      this.can.add(sculpt);
    } else this.can.add(body, lip, hole);
    this.can.position.set(0, PLATE_TOP, -0.2);

    const plus = signDecal('plus', C.red, 0.3);
    plus.position.set(0.6, PLATE_TOP + 0.005, -0.25);

    const waveGeo = new THREE.TorusGeometry(0.5, 0.03, 6, 48);
    for (let i = 0; i < 3; i++) {
      // Brighter than white, so the rings glow.
      const w = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.amber).multiplyScalar(2.6), transparent: true, opacity: 0, depthWrite: false }));
      w.rotation.x = Math.PI / 2;
      w.position.set(0, PLATE_TOP + 0.6, -0.2);
      w.userData.t = 1 + i;
      this.waves.push(w);
      this.body.add(w);
    }

    this.body.add(plate, this.can, plus);
    this.addTerminal('a', 'plus', 0.6, 0.45);
    this.addTerminal('b', 'minus', -0.6, 0.45);
    this.pickable(plate, this.can);
  }

  get sounding() {
    return this.state.level > 0.2;
  }

  private beepT = 0;
  private nextWave = 0;

  protected animate(dt: number) {
    const on = this.sounding;
    // In step with the sound: a 0.16 s beep every 0.3 s; each beep sends out a ring.
    const prev = this.beepT;
    this.beepT = on ? (this.beepT + dt) % 0.3 : 0;
    const beeping = on && this.beepT < 0.16;
    if (on && this.beepT < prev) {
      const w = this.waves[this.nextWave++ % this.waves.length];
      w.userData.t = 0;
    }
    this.can.scale.set(1 + (beeping ? Math.sin(this.time * 120) * 0.03 : 0), 1 - (beeping ? 0.04 : 0), 1 + (beeping ? Math.sin(this.time * 120) * 0.03 : 0));
    for (const w of this.waves) {
      w.userData.t = Math.min(1, (w.userData.t as number) + dt * 1.4);
      const t = w.userData.t as number;
      w.scale.setScalar(1 + t * 2);
      w.position.y = PLATE_TOP + 0.6 + t * 0.35;
      (w.material as THREE.MeshBasicMaterial).opacity = t < 1 ? (1 - t) ** 1.5 : 0;
    }
  }
}
