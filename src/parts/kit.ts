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

/** The cream module board every part sits on, with a tan rim like the reference cards. */
export function basePlate(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const rim = roundedBox(w, 0.22, d, 0.1, C.line, 0.8);
  const top = roundedBox(w - 0.1, 0.24, d - 0.1, 0.09, C.card, 0.75);
  g.add(rim, top);
  return g;
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
