// Shared building blocks for the toy-like part models.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { C } from '../theme';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: string, roughness = 0.55, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    matCache.set(key, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, shadows = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  return m;
}

export function roundedBox(w: number, h: number, d: number, r: number, color: string, roughness = 0.6): THREE.Mesh {
  const m = mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat(color, roughness));
  m.position.y = h / 2;
  return m;
}

export const PLATE_TOP = 0.16;

let shadowTex: THREE.Texture | null = null;

/** Soft contact shadow so parts sit on the table instead of floating. */
export function contactShadow(w: number, d: number): THREE.Mesh {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    // Strong alphas: the scene blends in linear light, where a soft shadow needs more.
    g.addColorStop(0, 'rgba(60,45,20,0.83)');
    g.addColorStop(0.55, 'rgba(60,45,20,0.47)');
    g.addColorStop(1, 'rgba(60,45,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.25, d * 1.35),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = -1;
  return m;
}

/**
 * The module board every part sits on: a thin cream plate with a tan edge,
 * corner screws and a printed label, like a component card from a kit.
 */
export function basePlate(w: number, d: number, label?: string): THREE.Group {
  const g = new THREE.Group();
  const rim = mesh(new RoundedBoxGeometry(w, PLATE_TOP - 0.02, d, 3, 0.06), mat('#d9cbb6', 0.8));
  rim.position.y = (PLATE_TOP - 0.02) / 2;
  const top = mesh(new RoundedBoxGeometry(w - 0.06, 0.04, d - 0.06, 2, 0.02), mat('#f3ebdc', 0.62));
  top.position.y = PLATE_TOP - 0.02;
  g.add(contactShadow(w, d), rim, top);
  const screwGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 14);
  const slotGeo = new THREE.BoxGeometry(0.08, 0.012, 0.016);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const screw = mesh(screwGeo, mat(C.metal, 0.35, 0.8), false);
    screw.position.set(sx * (w / 2 - 0.13), PLATE_TOP + 0.005, sz * (d / 2 - 0.13));
    const slot = mesh(slotGeo, mat('#6d727c', 0.5, 0.6), false);
    slot.position.copy(screw.position).setY(PLATE_TOP + 0.016);
    slot.rotation.y = 0.6;
    g.add(screw, slot);
  }
  if (label) {
    // Printed along the front edge, between the two posts.
    const l = textDecal(label, Math.min(0.95, w - 1.0), 0.15);
    l.position.set(0, PLATE_TOP + 0.003, d / 2 - 0.15);
    g.add(l);
  }
  return g;
}

/** Small printed caption lying on a surface, in the condensed label face. */
export function textDecal(text: string, width: number, height: number, color: string = C.navy2): THREE.Mesh {
  const ratio = width / height;
  const ch = 64;
  const cw = Math.round(ch * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${ch * 0.62}px "Fira Sans Condensed", system-ui, sans-serif`;
  const spaced = text.toUpperCase().split('').join(String.fromCharCode(8202));
  ctx.fillText(spaced, cw / 2, ch / 2 + 2, cw - 6);
  // A thin outline in the same ink thickens the letters, so small labels stay crisp.
  ctx.strokeStyle = color;
  ctx.lineWidth = ch * 0.035;
  ctx.strokeText(spaced, cw / 2, ch / 2 + 2, cw - 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, depthWrite: false, opacity: 0.97 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Warm pool of light on the table under a lit lamp. */
export function lightPool(size: number, color: string): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: glowTexture(color), transparent: true, depthWrite: false, opacity: 0, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.006;
  m.renderOrder = -1;
  return m;
}

/** Flat sticker with a plus or minus sign, lying on a surface. */
export function signDecal(sign: 'plus' | 'minus', color: string, size = 0.34): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  const t = 22;
  ctx.beginPath();
  ctx.roundRect(64 - 44, 64 - t / 2, 88, t, t / 2);
  ctx.fill();
  if (sign === 'plus') {
    ctx.beginPath();
    ctx.roundRect(64 - t / 2, 64 - 44, t, 88, t / 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Soft radial glow texture used for bulbs, LEDs and halos. */
export function glowTexture(inner: string, outer = 'rgba(255,255,255,0)'): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const streakCache = new Map<string, THREE.Texture>();
/**
 * Motion blur of a spinning rotor, seen face-on: each blade smears into a
 * fading sweep behind it, like a fast propeller photographed.
 */
export function streakTexture(blades: number, color: string): THREE.Texture {
  const key = `${blades}|${color}`;
  const hit = streakCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(128, 128);
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  // A faint full disc, then the sweeps.
  ctx.fillStyle = `rgba(${rgb},0.22)`;
  ctx.beginPath();
  ctx.arc(0, 0, 124, 0, Math.PI * 2);
  ctx.fill();
  const sweep = (Math.PI * 2) / blades;
  const steps = 24;
  for (let b = 0; b < blades; b++) {
    for (let i = 0; i < steps; i++) {
      const a0 = b * sweep + (i / steps) * sweep * 0.85;
      const a1 = a0 + (sweep * 0.85) / steps + 0.01;
      ctx.fillStyle = `rgba(${rgb},${(0.85 * (1 - i / steps) ** 1.3).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 124, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Clear hub.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  // Soft outer edge.
  const edge = ctx.createRadialGradient(0, 0, 100, 0, 0, 128);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = edge;
  ctx.fillRect(-128, -128, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  streakCache.set(key, tex);
  return tex;
}

/** A see-through disc carrying the rotor's blur (faces +z; spin it about z). */
export function rotorBlur(radius: number, blades: number, color: string): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshBasicMaterial({ map: streakTexture(blades, color), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  m.renderOrder = 4;
  return m;
}

/**
 * How solid the blades look and how strong the blur is at a given spin
 * (radians per second): slow — crisp blades; fast — a sweeping blur.
 */
export function blurAmount(omega: number): number {
  return THREE.MathUtils.smoothstep(Math.abs(omega), 6, 20);
}

/** Light rays texture for a lit bulb. */
export function raysTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(256, 256);
  const n = 12;
  for (let i = 0; i < n; i++) {
    ctx.rotate((Math.PI * 2) / n);
    const g = ctx.createLinearGradient(0, 70, 0, 250);
    g.addColorStop(0, 'rgba(255,196,80,0.75)');
    g.addColorStop(1, 'rgba(255,196,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-9, 70);
    ctx.lineTo(9, 70);
    ctx.lineTo(16, 250);
    ctx.lineTo(-16, 250);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}
