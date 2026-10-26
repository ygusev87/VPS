// A kind, hapless villain: a crow that now and then lands near a wire you
// laid and creeps up to steal it. A tap in time and she takes fright and
// flies off, losing a feather. Too late, and she pecks the wire, gets a tingle
// from it (sparks, feathers on end) and wobbles away dizzy — the wire stays
// where it was: the joke is always on her, never on the child's work.
import * as THREE from 'three';
import { model } from './parts/assets';
import { mat, mesh } from './parts/kit';
import type { Stage } from './stage';
import type { PhraseId } from './voice';
import type { Wire } from './wires';
import type { World } from './world';

export interface PestHooks {
  say(id: PhraseId): void;
  /** Sparks and a puff of smoke where the wire bit back. */
  zap(at: THREE.Vector3): void;
  chime(): void;
}

type Act = 'away' | 'land' | 'sneak' | 'peck' | 'zapped' | 'flee';

/** Seconds of play before her first visit, and between visits. */
const FIRST = 50;
const AGAIN: [number, number] = [80, 130];

export class Pest {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private wings: THREE.Object3D[] = [];
  private head!: THREE.Object3D;
  private feather: THREE.Mesh;
  private act: Act = 'away';
  private t = 0;
  private wait = FIRST;
  private wire: Wire | null = null;
  private at = new THREE.Vector3();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private visits = 0;
  private dizzy = 0;
  private ruffle = 0;
  /** When each wire was first seen (a wire just laid has no path yet). */
  private born = new Map<Wire, number>();
  private clock = 0;

  constructor(
    scenery: THREE.Group,
    private stage: Stage,
    private world: World,
    private hooks: PestHooks,
    /** May she come now? (not at night, not before the story starts) */
    private allowed: () => boolean,
  ) {
    this.build();
    this.root.visible = false;
    this.feather = mesh(new THREE.ConeGeometry(0.06, 0.4, 6), mat('#232836', 0.6), false);
    this.feather.visible = false;
    scenery.add(this.root, this.feather);
  }

  private build() {
    // An invisible ball round her, so a child's finger need not hit her exactly.
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    hit.position.y = 0.5;
    const sculpt = model('crow', { height: 0.57 });
    if (sculpt) {
      // Codex's crow (beak +X): a body and two wings on shoulder hinges, folded while she walks.
      this.head = new THREE.Group();
      for (const [name, side, fold] of [
        ['wing-left', -1, new THREE.Euler(0.28, -1.05, 0)],
        ['wing-right', 1, new THREE.Euler(-0.28, 1.05, 0)],
      ] as const) {
        const wing = sculpt.getObjectByName(name);
        if (!wing) continue;
        wing.userData.side = side;
        wing.userData.fold = fold;
        wing.rotation.copy(fold);
        this.wings.push(wing);
      }
      // (The same reach as before, when the whole drawn crow was scaled to 0.62.)
      hit.scale.setScalar(0.62);
      hit.position.y = 0.31;
      this.body.add(sculpt, this.head, hit);
      this.root.add(this.body);
      this.root.traverse((o) => (o.userData.pest = true));
      return;
    }
    const black = mat('#2a2f3e', 0.55);
    const body = mesh(new THREE.SphereGeometry(0.32, 18, 12), black);
    body.scale.set(1.35, 0.95, 0.9);
    body.position.y = 0.45;
    const tail = mesh(new THREE.BoxGeometry(0.34, 0.05, 0.22), black);
    tail.position.set(-0.48, 0.5, 0);
    tail.rotation.z = 0.35;
    const head = new THREE.Group();
    head.position.set(0.36, 0.72, 0);
    const skull = mesh(new THREE.SphereGeometry(0.2, 16, 12), black);
    const beak = mesh(new THREE.ConeGeometry(0.07, 0.26, 10), mat('#f2b23a', 0.5));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.24, -0.03, 0);
    // Big round googly eyes: she is more silly than scary.
    const eyes = [-0.09, 0.09].map((z) => {
      const white = mesh(new THREE.SphereGeometry(0.075, 12, 10), mat('#ffffff', 0.4), false);
      white.position.set(0.12, 0.07, z);
      const dot = mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#11131a', 0.3), false);
      dot.position.set(0.055, 0, 0);
      white.add(dot);
      return white;
    });
    head.add(skull, beak, ...eyes);
    this.head = head;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.02, 0.58, side * 0.24);
      const wing = mesh(new THREE.SphereGeometry(0.28, 12, 8), black);
      wing.scale.set(1.2, 0.18, 0.75);
      wing.position.set(-0.08, 0, side * 0.16);
      pivot.add(wing);
      pivot.userData.side = side;
      this.wings.push(pivot);
    }
    const legs = [-0.08, 0.08].map((z) => {
      const leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6), mat('#f2b23a', 0.5), false);
      leg.position.set(0.02, 0.12, z);
      return leg;
    });
    this.body.add(body, tail, head, ...this.wings, ...legs, hit);
    this.root.add(this.body);
    // A crow's size beside the farm's animals: about half the dog's height.
    this.root.scale.setScalar(0.62);
    this.root.traverse((o) => (o.userData.pest = true));
  }

  /** Her meshes, for the tap. */
  pickables(): THREE.Object3D[] {
    if (!this.root.visible || this.act === 'flee' || this.act === 'zapped') return [];
    const out: THREE.Object3D[] = [];
    this.root.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o));
    return out;
  }

  /** Tapped before she got the wire: a fright, a lost feather, off she flies. */
  tap(): boolean {
    if (this.act !== 'land' && this.act !== 'sneak' && this.act !== 'peck') return false;
    this.hooks.say('crowScared');
    this.hooks.chime();
    this.feather.visible = true;
    this.feather.position.copy(this.root.position).setY(0.9);
    this.feather.userData.t = 0;
    this.leave();
    return true;
  }

  private leave() {
    this.act = 'flee';
    this.t = 0;
    this.from.copy(this.root.position);
    const away = this.root.position.clone().sub(this.at).setY(0);
    if (away.lengthSq() < 0.01) away.set(1, 0, 0);
    this.to.copy(this.root.position).addScaledVector(away.normalize(), 14).setY(7);
  }

  /** A wire on screen to go for (the middle stretch of it), and a spot to land beside it. */
  private choose(): boolean {
    for (const w of this.world.wires) if (!this.born.has(w)) this.born.set(w, this.clock);
    for (const w of this.born.keys()) if (!this.world.wires.includes(w)) this.born.delete(w);
    const seen = this.world.wires.filter((w) => this.clock - this.born.get(w)! > 3 && this.stage.inView(w.midpoint(), 120));
    if (!seen.length) return false;
    const wire = seen[Math.floor(Math.random() * seen.length)];
    // The stretch of wire farthest from any part: she goes for the wire, not for a part.
    const clear = (q: THREE.Vector3) => Math.min(...this.world.parts.map((p) => p.root.position.distanceTo(q) - p.radius));
    const at = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75].map((u) => wire.pointAt(u)).reduce((a, b) => (clear(b) > clear(a) ? b : a));
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const land = at.clone().add(new THREE.Vector3(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6));
      if (!this.stage.inView(land, 90)) continue;
      this.wire = wire;
      this.at.copy(at).setY(0);
      this.to.copy(land).setY(0);
      this.from.copy(land).add(new THREE.Vector3(-Math.cos(a) * 6, 6, -Math.sin(a) * 6));
      return true;
    }
    return false;
  }

  private face(dir: THREE.Vector3) {
    if (dir.lengthSq() > 1e-4) this.root.rotation.y = Math.atan2(-dir.z, dir.x);
  }

  update(dt: number, time: number) {
    this.t += dt;
    this.clock = time;
    const flap = (speed: number, amp: number) =>
      this.wings.forEach((w) => {
        w.rotation.x = w.userData.side * (0.2 + Math.sin(time * speed) * amp);
        w.rotation.y = THREE.MathUtils.damp(w.rotation.y, 0, 12, dt);
      });
    const fold = () =>
      this.wings.forEach((w) => {
        const f = (w.userData.fold as THREE.Euler | undefined) ?? new THREE.Euler();
        w.rotation.x = THREE.MathUtils.damp(w.rotation.x, f.x, 8, dt);
        w.rotation.y = THREE.MathUtils.damp(w.rotation.y, f.y, 8, dt);
      });
    if (this.feather.visible) {
      // The lost feather see-saws down to the grass.
      const f = this.feather;
      f.userData.t += dt;
      f.position.y = Math.max(0.05, 0.9 - f.userData.t * 0.35);
      f.position.x += Math.sin(f.userData.t * 4) * dt * 0.6;
      f.rotation.z = Math.PI / 2 + Math.sin(f.userData.t * 4) * 0.6;
      if (f.userData.t > 6) f.visible = false;
    }
    switch (this.act) {
      case 'away': {
        this.wait -= dt;
        if (this.wait > 0 || !this.allowed() || !this.choose()) {
          if (this.wait <= 0) this.wait = 6;
          return;
        }
        this.act = 'land';
        this.t = 0;
        this.ruffle = 0;
        this.dizzy = 0;
        this.root.visible = true;
        this.root.position.copy(this.from);
        this.face(this.to.clone().sub(this.from));
        return;
      }
      case 'land': {
        // Gliding down beside the wire.
        const k = Math.min(1, this.t / 1.6);
        this.root.position.lerpVectors(this.from, this.to, 1 - (1 - k) ** 2);
        flap(18, 0.9);
        if (k >= 1) {
          this.act = 'sneak';
          this.t = 0;
          this.from.copy(this.to);
          if (this.visits++ < 2) this.hooks.say('crowSneak');
        }
        return;
      }
      case 'sneak': {
        if (!this.wire || !this.world.wires.includes(this.wire)) return this.leave();
        // On tiptoe, slowly, glancing about: about five seconds to the wire.
        fold();
        const toWire = this.at.clone().sub(this.root.position).setY(0);
        const step = 0.45 * dt;
        if (toWire.length() > 0.5) {
          this.root.position.addScaledVector(toWire.normalize(), step);
          this.face(toWire);
          this.body.position.y = Math.abs(Math.sin(time * 7)) * 0.06;
          this.head.rotation.y = Math.sin(time * 1.7) * 0.6;
        } else {
          this.act = 'peck';
          this.t = 0;
        }
        return;
      }
      case 'peck': {
        this.head.rotation.y = 0;
        this.body.rotation.z = -Math.max(0, Math.sin(this.t * 9)) * 0.45;
        if (this.t > 1.3) {
          this.body.rotation.z = 0;
          this.act = 'zapped';
          this.t = 0;
          this.hooks.zap(this.at.clone().setY(0.4));
          this.hooks.say('crowZapped');
        }
        return;
      }
      case 'zapped': {
        // Feathers on end, a shiver, a dizzy turn on the spot.
        this.ruffle = Math.max(0, 1 - this.t / 1.6);
        const s = 1 + this.ruffle * 0.25 + Math.sin(time * 40) * 0.05 * this.ruffle;
        this.body.scale.set(s, s, s);
        this.dizzy += dt * (4 - this.t * 1.5);
        this.root.rotation.y += dt * 6 * Math.max(0, 1.6 - this.t);
        if (this.t > 2.2) {
          this.body.scale.setScalar(1);
          this.leave();
        }
        return;
      }
      case 'flee': {
        const k = Math.min(1, this.t / 2.2);
        this.root.position.lerpVectors(this.from, this.to, k * k);
        // A wobble in her flight after a tingle.
        this.root.position.z += Math.sin(time * 9) * 0.04 * (this.dizzy > 0 ? 1 : 0);
        this.face(this.to.clone().sub(this.from));
        flap(24, 1);
        if (k >= 1) {
          this.root.visible = false;
          this.act = 'away';
          this.wait = AGAIN[0] + Math.random() * (AGAIN[1] - AGAIN[0]);
        }
        return;
      }
    }
  }
}
