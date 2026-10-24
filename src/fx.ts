// 3D effects on the table: sparks, smoke, a flash ring when a part powers on,
// and a few real lights that lit lamps cast on the table and their neighbours.
import * as THREE from 'three';

const MAX = 700;

interface Particle {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: THREE.Color;
  gravity: number;
  drag: number;
  bounce: boolean;
}

/** A pool of round soft points; additive for sparks, normal blending for smoke. */
class Points {
  readonly mesh: THREE.Points;
  private list: Particle[] = [];
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);
  private geo = new THREE.BufferGeometry();
  readonly material: THREE.ShaderMaterial;

  constructor(additive: boolean) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 800 }, soft: { value: additive ? 0.15 : 0.6 } },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.0, size * scale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float soft;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = 1.0 - smoothstep(1.0 - soft - 0.2, 1.0, d);
          if (a <= 0.0) discard;
          gl_FragColor = vec4(vColor, a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Points(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }

  add(q: Omit<Particle, 'life'>) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ ...q, life: 0 });
  }

  update(dt: number) {
    let n = 0;
    const keep: Particle[] = [];
    for (const q of this.list) {
      q.life += dt;
      if (q.life >= q.max) continue;
      q.v.y -= q.gravity * dt;
      q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt));
      q.p.addScaledVector(q.v, dt);
      if (q.bounce && q.p.y < 0.02) {
        q.p.y = 0.02;
        q.v.y = Math.abs(q.v.y) * 0.35;
        q.v.x *= 0.6;
        q.v.z *= 0.6;
      }
      keep.push(q);
      const t = q.life / q.max;
      this.pos.set([q.p.x, q.p.y, q.p.z], n * 3);
      this.col.set([q.color.r, q.color.g, q.color.b], n * 3);
      this.size[n] = q.size * (1 + q.grow * t);
      // Fade in quickly, out slowly.
      this.alpha[n] = Math.min(1, t * 12) * (1 - t) ** 1.5;
      n++;
    }
    this.list = keep;
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'color', 'size', 'alpha']) (this.geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Flash ring lying on the table, expanding and fading. */
interface Ring {
  mesh: THREE.Mesh;
  t: number;
  size: number;
}

/** Something that shines: a lit bulb or LED. */
export interface Glow {
  at: THREE.Vector3;
  color: THREE.Color;
  /** 0..~1.5 */
  power: number;
}

const LAMPS = 3;

export class Fx {
  readonly group = new THREE.Group();
  private sparks = new Points(true);
  private smoke = new Points(false);
  private rings: Ring[] = [];
  private ringGeo = new THREE.RingGeometry(0.9, 1, 64);
  private lamps: THREE.PointLight[] = [];
  /** Night: lamps light the room much more. */
  night = false;

  constructor() {
    this.group.add(this.sparks.mesh, this.smoke.mesh);
    for (let i = 0; i < LAMPS; i++) {
      const l = new THREE.PointLight('#ffcf80', 0, 7, 2);
      l.castShadow = false;
      this.lamps.push(l);
      this.group.add(l);
    }
  }

  /** Point size scale for the current canvas height (pixels per unit at distance 1). */
  resize(heightPx: number, fov: number) {
    const s = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    this.sparks.material.uniforms.scale.value = s;
    this.smoke.material.uniforms.scale.value = s;
  }

  /** A burst of hot sparks, e.g. when a wire clicks onto a post. */
  burst(at: THREE.Vector3, n = 14, color = '#ffd88a', speed = 2.4) {
    const c = new THREE.Color(color).multiplyScalar(4);
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, 0.6 + Math.random(), Math.random() - 0.5).normalize();
      this.sparks.add({
        p: at.clone(),
        v: dir.multiplyScalar(speed * (0.4 + Math.random())),
        max: 0.25 + Math.random() * 0.45,
        size: 0.05 + Math.random() * 0.04,
        grow: -0.6,
        color: c.clone().lerp(new THREE.Color(5, 5, 4.5), Math.random() * 0.5),
        gravity: 7,
        drag: 1.2,
        bounce: true,
      });
    }
  }

  /** A puff of grey smoke drifting up (a battery overheating). */
  puff(at: THREE.Vector3) {
    for (let i = 0; i < 2; i++) {
      const g = 0.1 + Math.random() * 0.08;
      this.smoke.add({
        p: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)),
        v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3),
        max: 1.6 + Math.random() * 0.8,
        size: 0.35,
        grow: 2.2,
        color: new THREE.Color(g, g, g * 1.05),
        gravity: -0.2,
        drag: 0.6,
        bounce: false,
      });
    }
  }

  /** Dust blown out over the table from under a rotor. */
  dust(at: THREE.Vector3, radius: number) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const g = 0.75 + Math.random() * 0.15;
      this.smoke.add({
        p: at.clone().addScaledVector(dir, radius * (0.3 + Math.random() * 0.4)).setY(0.08),
        v: dir.multiplyScalar(1.4 + Math.random()).setY(0.15),
        max: 0.7 + Math.random() * 0.4,
        size: 0.18,
        grow: 1.6,
        color: new THREE.Color(g, g * 0.9, g * 0.75),
        gravity: 0,
        drag: 1.5,
        bounce: false,
      });
    }
  }

  /** A little grey puff from an exhaust pipe. */
  exhaust(at: THREE.Vector3, dir: THREE.Vector3) {
    const g = 0.45 + Math.random() * 0.15;
    this.smoke.add({
      p: at.clone(),
      v: dir.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.35, 0)),
      max: 0.6 + Math.random() * 0.3,
      size: 0.09,
      grow: 2.5,
      color: new THREE.Color(g, g, g),
      gravity: -0.1,
      drag: 1,
      bounce: false,
    });
  }

  /** Little floating motes of light rising from a part that just came alive. */
  sparkle(at: THREE.Vector3, color: string, n = 10, radius = 0.8) {
    const c = new THREE.Color(color).multiplyScalar(3.5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.4 + Math.random() * 0.6);
      this.sparks.add({
        p: at.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.1 + Math.random() * 0.3, Math.sin(a) * r)),
        v: new THREE.Vector3(0, 0.6 + Math.random() * 0.8, 0),
        max: 0.7 + Math.random() * 0.6,
        size: 0.06,
        grow: -0.5,
        color: c,
        gravity: 0,
        drag: 0.8,
        bounce: false,
      });
    }
  }

  /** A ring of light spreading over the table from a part. */
  ring(at: THREE.Vector3, color: string, size = 1.6) {
    const m = new THREE.Mesh(
      this.ringGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(this.night ? 0.7 : 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(0.03);
    m.renderOrder = 19;
    this.group.add(m);
    this.rings.push({ mesh: m, t: 0, size });
  }

  /** Give the brightest lamps on the table real light. */
  shine(glows: Glow[]) {
    glows.sort((a, b) => b.power - a.power);
    this.lamps.forEach((l, i) => {
      const g = glows[i];
      const target = g ? Math.min(1.5, g.power) * (this.night ? 5 : 3) : 0;
      l.intensity = THREE.MathUtils.lerp(l.intensity, target, 0.25);
      if (g) {
        l.position.copy(g.at);
        l.color.copy(g.color);
      }
    });
  }

  update(dt: number) {
    this.sparks.update(dt);
    this.smoke.update(dt);
    this.rings = this.rings.filter((r) => {
      r.t += dt * 1.6;
      const m = r.mesh.material as THREE.MeshBasicMaterial;
      if (r.t >= 1) {
        r.mesh.removeFromParent();
        m.dispose();
        return false;
      }
      const e = 1 - (1 - r.t) ** 3;
      r.mesh.scale.setScalar(0.2 + e * r.size);
      m.opacity = (1 - r.t) ** 2;
      return true;
    });
  }
}
