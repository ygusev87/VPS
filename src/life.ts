// What makes a map feel alive and worth poking at: animals of the herd that
// wander about their yard (and run off from a finger), butterflies by day and
// fireflies at night, chimney smoke, and toys — things placed to be tapped,
// each doing something funny: a mouse pops out of the haystack, a frog jumps
// into the pond, the scarecrow spins and loses its hat, a letter flies out
// of the mailbox, a bucket splashes down the well.
import * as THREE from 'three';
import { bendable, type Pose } from './bend';
import { mat, mesh } from './parts/kit';
import { glowFor } from './parts/models';
import type { PhraseId } from './voice';

export interface LifeHooks {
  say(id: PhraseId): void;
  chime(): void;
}

/** How a herd animal moves about. */
export type Gait = 'graze' | 'peck' | 'hop' | 'waddle' | 'stroll';

interface Extra {
  group: THREE.Group;
  home: THREE.Vector3;
  roam: number;
  gait: Gait;
  sound: PhraseId | null;
  target: THREE.Vector3;
  wait: number;
  step: number;
  /** Running off from a finger (seconds left). */
  flee: number;
  jump: number;
  /** A grazer's head, tail and breath (null: the model moves as a whole). */
  pose: Pose | null;
  /** Its own clock for grazing and looking about. */
  cycle: number;
}

export type ToyKind = 'mouse' | 'frog' | 'scarecrow' | 'mailbox' | 'well' | 'trashcan' | 'hydrant' | 'clock' | 'soda';

interface Toy {
  kind: ToyKind;
  root: THREE.Group;
  /** Seconds into its trick (-1: resting). */
  t: number;
  parts: Record<string, THREE.Object3D>;
  home: THREE.Vector3;
}

export class Life {
  private extras: Extra[] = [];
  private toys: Toy[] = [];
  private flutters: { s: THREE.Sprite; c: THREE.Vector3; a: number; r: number; k: number }[] = [];
  private flies: { s: THREE.Sprite; c: THREE.Vector3; a: number }[] = [];
  private smoke: { s: THREE.Sprite; at: THREE.Vector3; t: number }[] = [];
  private drops: { s: THREE.Sprite; v: THREE.Vector3; t: number }[] = [];
  private time = 0;
  private seed = 3;

  constructor(
    private scenery: THREE.Group,
    private hooks: LifeHooks,
  ) {}

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /** A herd animal (not one that asks for help) that wanders round its spot. */
  addExtra(model: THREE.Object3D, x: number, z: number, yaw: number, gait: Gait, sound: PhraseId | null, roam = 2.5) {
    const pose = gait === 'graze' ? bendable(model) : null;
    const group = new THREE.Group();
    group.add(model);
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.userData.life = 'extra';
      }
    });
    this.scenery.add(group);
    this.extras.push({ group, home: new THREE.Vector3(x, 0, z), roam, gait, sound, target: new THREE.Vector3(x, 0, z), wait: this.rnd() * 4, step: 0, flee: 0, jump: 0, pose, cycle: this.rnd() * 20 });
  }

  /** A thing placed to be tapped. */
  addToy(kind: ToyKind, x: number, z: number, yaw = 0, body?: THREE.Object3D) {
    const { root, parts } = TOY_BUILDERS[kind](body);
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.userData.life = 'toy';
      }
    });
    this.scenery.add(root);
    this.toys.push({ kind, root, t: -1, parts, home: new THREE.Vector3(x, 0, z) });
  }

  /** Where the toys stand (kept clear of the dressing). */
  get toySpots(): THREE.Vector3[] {
    return this.toys.map((t) => t.home);
  }

  /** Butterflies round these spots by day, fireflies round those by night. */
  addFlutters(spots: THREE.Vector3[], fireflies: THREE.Vector3[]) {
    const colors = ['#ffd23f', '#ff8fb1', '#8fd3ff', '#ffffff', '#ffb347'];
    spots.forEach((c, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: butterflyTexture(colors[i % colors.length]), transparent: true, depthWrite: false }));
      s.scale.setScalar(0.45);
      this.scenery.add(s);
      this.flutters.push({ s, c: c.clone(), a: this.rnd() * 6.28, r: 1 + this.rnd() * 1.5, k: 0.6 + this.rnd() * 0.5 });
    });
    for (const c of fireflies) {
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(255,240,120,0.95)'), transparent: true, depthWrite: false, opacity: 0 }));
        s.scale.setScalar(0.35);
        this.scenery.add(s);
        this.flies.push({ s, c: c.clone().add(new THREE.Vector3((this.rnd() - 0.5) * 4, 0, (this.rnd() - 0.5) * 3)), a: this.rnd() * 6.28 });
      }
    }
  }

  /** Smoke curling up from a chimney. */
  addSmoke(at: THREE.Vector3) {
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(235,235,240,0.8)'), transparent: true, depthWrite: false, opacity: 0 }));
      this.scenery.add(s);
      this.smoke.push({ s, at: at.clone(), t: i / 8 });
    }
  }

  /** Meshes a finger can hit. */
  pickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const g of [...this.extras.map((e) => e.group), ...this.toys.map((t) => t.root)]) g.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o));
    return out;
  }

  /** A tap landed on this mesh: the animal runs off, the toy does its trick. True if it was ours. */
  tap(hit: THREE.Object3D): boolean {
    const owner = (g: THREE.Object3D) => {
      let o: THREE.Object3D | null = hit;
      while (o && o !== g) o = o.parent;
      return !!o;
    };
    const extra = this.extras.find((e) => owner(e.group));
    if (extra) {
      extra.flee = 1.6;
      extra.jump = 1;
      // Off the other way from where it stood, a little further than its usual stroll.
      const a = this.rnd() * Math.PI * 2;
      extra.target.set(extra.home.x + Math.cos(a) * extra.roam, 0, extra.home.z + Math.sin(a) * extra.roam);
      if (extra.sound) this.hooks.say(extra.sound);
      return true;
    }
    const toy = this.toys.find((t) => owner(t.root));
    if (!toy) return false;
    if (toy.t < 0) {
      toy.t = 0;
      this.hooks.say(TOY_SOUND[toy.kind]);
      this.hooks.chime();
    }
    return true;
  }

  update(dt: number, night: number, eye?: THREE.Vector3) {
    this.time += dt;
    for (const e of this.extras) this.moveExtra(e, dt, eye);
    for (const t of this.toys) if (t.t >= 0) this.playToy(t, dt);
    const day = 1 - night;
    for (const f of this.flutters) {
      f.a += dt * f.k;
      const flap = Math.abs(Math.sin(this.time * 14 + f.r * 5));
      f.s.position.set(f.c.x + Math.cos(f.a) * f.r, 0.9 + Math.sin(f.a * 2.3) * 0.35, f.c.z + Math.sin(f.a * 1.3) * f.r * 0.7);
      f.s.scale.set(0.45 * (0.35 + 0.65 * flap), 0.38, 1);
      f.s.material.opacity = day > 0.5 ? 1 : 0;
    }
    for (const f of this.flies) {
      f.a += dt * 0.7;
      f.s.position.set(f.c.x + Math.cos(f.a) * 1.4, 0.7 + Math.sin(f.a * 3.1) * 0.4, f.c.z + Math.sin(f.a * 1.7) * 1);
      f.s.material.opacity = night > 0.5 ? (0.5 + 0.5 * Math.sin(this.time * 4 + f.c.x)) * night : 0;
    }
    for (const p of this.smoke) {
      p.t = (p.t + dt * 0.22) % 1;
      p.s.position.set(p.at.x + Math.sin(p.t * 4 + p.at.z) * 0.4 * p.t + p.t * 0.6, p.at.y + p.t * 3, p.at.z);
      p.s.scale.setScalar(0.5 + p.t * 1.6);
      p.s.material.opacity = (1 - p.t) * 0.55;
    }
    for (const d of this.drops) {
      d.t += dt;
      d.v.y -= 9 * dt;
      d.s.position.addScaledVector(d.v, dt);
      d.s.material.opacity = Math.max(0, 1 - d.t * 1.5);
    }
    this.drops = this.drops.filter((d) => {
      if (d.t < 0.7) return true;
      d.s.removeFromParent();
      return false;
    });
  }

  /** Stroll to a spot near home, stand a while (grazing, pecking), choose another. */
  private moveExtra(e: Extra, dt: number, eye?: THREE.Vector3) {
    const p = e.group.position;
    e.jump = Math.max(0, e.jump - dt * 2.5);
    e.flee = Math.max(0, e.flee - dt);
    const to = e.target.clone().sub(p).setY(0);
    const dist = to.length();
    const speed = e.flee > 0 ? 3.2 : e.gait === 'graze' ? 0.45 : e.gait === 'peck' ? 0.9 : e.gait === 'hop' ? 1.3 : e.gait === 'stroll' ? 1.1 : 0.6;
    let moving = false;
    if (dist > 0.05 && (e.wait <= 0 || e.flee > 0)) {
      moving = true;
      p.addScaledVector(to.normalize(), Math.min(dist, speed * dt));
      const yaw = Math.atan2(-to.z, to.x);
      e.group.rotation.y += Math.atan2(Math.sin(yaw - e.group.rotation.y), Math.cos(yaw - e.group.rotation.y)) * Math.min(1, dt * 6);
    } else if (dist <= 0.05) {
      if (e.wait <= 0) e.wait = (e.gait === 'stroll' ? 0.5 : 2) + this.rnd() * (e.gait === 'graze' ? 8 : 4);
      e.wait -= dt;
      if (e.wait <= 0) {
        const a = this.rnd() * Math.PI * 2;
        const r = this.rnd() * e.roam;
        e.target.set(e.home.x + Math.cos(a) * r, 0, e.home.z + Math.sin(a) * r);
      }
    }
    e.step += dt * (moving ? 9 : 2);
    // Each gait has its own little motion: a hop, a peck, a waddle; a jump when startled.
    let y = Math.sin(e.jump * Math.PI) * 0.7;
    let tilt = 0;
    let roll = 0;
    if (e.gait === 'hop' && moving) y += Math.abs(Math.sin(e.step * 0.8)) * 0.35;
    if (e.gait === 'peck' && !moving) tilt = Math.max(0, Math.sin(this.time * 5 + e.home.x)) * 0.35;
    if (e.gait === 'waddle' && moving) roll = Math.sin(e.step) * 0.12;
    if (e.gait === 'stroll' && moving) y += Math.abs(Math.sin(e.step * 0.9)) * 0.06;
    if (e.gait === 'graze' && !moving && !e.pose) tilt = 0.12 + Math.sin(this.time * 0.8 + e.home.z) * 0.06;
    if (e.pose) this.graze(e, e.pose, moving, dt, eye);
    p.y = y;
    const model = e.group.children[0];
    model.rotation.z = -tilt;
    model.rotation.x = roll;
  }

  /**
   * A grazer standing still: nose in the grass, chewing, for a few seconds;
   * then the head comes up and looks about (at you, if you are near). The
   * tail swishes now and then. Walking or running off: head up.
   */
  private graze(e: Extra, pose: Pose, moving: boolean, dt: number, eye?: THREE.Vector3) {
    e.cycle += dt;
    const period = 9 + (Math.abs(e.home.x * 7.3) % 4);
    const down = !moving && e.flee <= 0 && e.cycle % period < period * 0.6;
    const chew = Math.sin(this.time * 6 + e.home.z) * 0.08;
    let look = 0;
    if (!moving && !down) {
      look = Math.sin(this.time * 0.6 + e.home.x) * 0.5;
      if (eye) {
        // The way to the camera, in the animal's own frame (+X is its nose).
        const to = e.group.worldToLocal(eye.clone()).setY(0);
        look = THREE.MathUtils.clamp(Math.atan2(to.z, to.x), -0.8, 0.8);
      }
    }
    pose.graze = THREE.MathUtils.damp(pose.graze, down ? 0.9 + chew : 0, 2.5, dt);
    pose.look = THREE.MathUtils.damp(pose.look, look, 2, dt);
    pose.wag = THREE.MathUtils.damp(pose.wag, Math.max(0, Math.sin(this.time * 0.7 + e.home.z * 3)) ** 3, 3, dt);
    pose.update(this.time);
  }

  private playToy(t: Toy, dt: number) {
    t.t += dt;
    const k = t.t;
    const P = t.parts;
    switch (t.kind) {
      case 'mouse': {
        // Up out of the top of the stack, a look round, down again.
        const up = k < 0.3 ? k / 0.3 : k < 1.9 ? 1 : Math.max(0, 1 - (k - 1.9) / 0.3);
        P.mouse.visible = up > 0.01;
        P.mouse.position.y = P.mouse.userData.y0 + up * 0.5;
        P.mouse.rotation.y = k > 0.4 && k < 1.8 ? Math.sin(k * 6) * 0.8 : 0;
        if (k > 2.3) this.rest(t);
        break;
      }
      case 'frog': {
        // A leap in an arc into the pond, a splash, then back on the bank a moment later.
        const j = Math.min(1, k / 0.7);
        const out = P.frog.userData.out as THREE.Vector3;
        if (k < 0.7) {
          P.frog.position.set(out.x * j, Math.sin(j * Math.PI) * 1.2, out.z * j);
        } else if (P.frog.visible) {
          P.frog.visible = false;
          this.splash(t.root.localToWorld(out.clone()), '#8fd3ff');
        }
        if (k > 3.5) {
          P.frog.visible = true;
          P.frog.position.set(0, 0, 0);
          this.rest(t);
        }
        break;
      }
      case 'scarecrow': {
        // Two turns round, the hat flying up and dropping back on.
        const s = Math.min(1, k / 1.4);
        P.body.rotation.y = s * Math.PI * 4 * (1 - s * 0.15);
        P.hat.position.y = P.hat.userData.y0 + Math.sin(Math.min(1, k / 1.2) * Math.PI) * 1.4;
        P.hat.rotation.y = k * 9;
        if (k > 1.6) {
          P.body.rotation.y = 0;
          P.hat.rotation.y = 0;
          this.rest(t);
        }
        break;
      }
      case 'mailbox': {
        // The flag pops up and a letter flutters out and away, up into the sky.
        P.flag.rotation.z = -Math.min(1, k / 0.2) * Math.PI / 2;
        const f = Math.max(0, k - 0.2);
        P.letter.visible = f > 0 && f < 2.4;
        P.letter.position.set(0.35 + f * 1.2, 1.05 + f * 1.4, Math.sin(f * 5) * 0.4);
        P.letter.rotation.set(Math.sin(f * 7) * 0.6, f * 2, Math.sin(f * 4) * 0.5);
        if (k > 3) {
          P.flag.rotation.z = 0;
          this.rest(t);
        }
        break;
      }
      case 'trashcan': {
        // The lid flips up, a cat pops out with a fish bone, looks round, ducks back.
        const up = k < 0.25 ? k / 0.25 : k < 1.8 ? 1 : Math.max(0, 1 - (k - 1.8) / 0.3);
        P.lid.rotation.x = -up * 1.9;
        P.cat.visible = up > 0.05;
        P.cat.position.y = P.cat.userData.y0 + up * 0.45;
        P.cat.rotation.y = k > 0.3 && k < 1.7 ? Math.sin(k * 5) * 0.7 : 0;
        if (k > 2.2) this.rest(t);
        break;
      }
      case 'hydrant': {
        // A fountain of water out of its top for a moment.
        if (!t.root.userData.sprayed || k - (t.root.userData.sprayed as number) > 0.12) {
          t.root.userData.sprayed = k;
          if (k < 1.4) this.splash(t.root.localToWorld(new THREE.Vector3(0, 0.8, 0)), '#8fd3ff');
        }
        P.cap.rotation.y = k * 12;
        if (k > 1.6) {
          t.root.userData.sprayed = 0;
          this.rest(t);
        }
        break;
      }
      case 'clock': {
        // Rings: the bells shake and the clock jumps on the wall.
        P.face.rotation.z = Math.sin(k * 60) * 0.12 * Math.max(0, 1 - k / 1.6);
        P.face.position.y = P.face.userData.y0 + Math.abs(Math.sin(k * 30)) * 0.08 * Math.max(0, 1 - k / 1.6);
        P.hand.rotation.z = -k * 8;
        if (k > 1.8) this.rest(t);
        break;
      }
      case 'soda': {
        // A can drops out of the machine and rolls off along the floor.
        const c = P.can;
        c.visible = k > 0.3 && k < 2.6;
        const f = Math.max(0, k - 0.3);
        c.position.set(0.1 + f * 1.4, Math.max(0.12, 0.5 - f * 2), 0.45 + f * 0.3);
        c.rotation.x = f * 9;
        if (k > 2.8) this.rest(t);
        break;
      }
      case 'well': {
        // The bucket goes down the well, splash, and winds back up.
        const d = k < 0.8 ? k / 0.8 : k < 1.4 ? 1 : Math.max(0, 1 - (k - 1.4) / 1);
        P.bucket.position.y = P.bucket.userData.y0 - d * (P.bucket.userData.rope ? 1.05 : 1.1);
        P.bucket.userData.hang?.();
        // The sculpted well's winch turns about its own length (x); the old one is a cylinder lying along x.
        if (P.bucket.userData.rope) P.crank.rotation.x = -d * Math.PI * 6;
        else P.crank.rotation.z = -d * Math.PI * 6;
        if (k > 0.8 && !t.root.userData.splashed) {
          t.root.userData.splashed = true;
          this.splash(t.root.localToWorld(new THREE.Vector3(0, 0.9, 0)), '#8fd3ff');
        }
        if (k > 2.5) {
          t.root.userData.splashed = false;
          this.rest(t);
        }
        break;
      }
    }
  }

  private rest(t: Toy) {
    t.t = -1;
  }

  private splash(at: THREE.Vector3, color: string) {
    const tex = glowFor(color === '#8fd3ff' ? 'rgba(143,211,255,0.95)' : 'rgba(255,255,255,0.95)');
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.scale.setScalar(0.25);
      s.position.copy(at);
      const a = (i / 12) * Math.PI * 2;
      this.scenery.add(s);
      this.drops.push({ s, v: new THREE.Vector3(Math.cos(a) * 1.4, 3 + (i % 3), Math.sin(a) * 1.4), t: 0 });
    }
  }
}

const TOY_SOUND: Record<ToyKind, PhraseId> = { mouse: 'squeak', frog: 'ribbit', scarecrow: 'crowCaw', mailbox: 'mailHere', well: 'splash', trashcan: 'binCat', hydrant: 'hydrantSpray', clock: 'clockRing', soda: 'sodaCan' };

/** Code-built toys (a sculpted body is used where it is given). */
const TOY_BUILDERS: Record<ToyKind, (body?: THREE.Object3D) => { root: THREE.Group; parts: Record<string, THREE.Object3D> }> = {
  mouse: (body) => {
    const root = new THREE.Group();
    const stack = body ?? (() => {
      const m = mesh(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e3c25a', 0.9));
      m.scale.set(1, 1.15, 1);
      return m;
    })();
    root.add(stack);
    const top = new THREE.Box3().setFromObject(stack).max.y;
    const mouse = new THREE.Group();
    const grey = mat('#9aa0a8', 0.7);
    const head = mesh(new THREE.SphereGeometry(0.2, 14, 10), grey);
    head.scale.set(1, 0.9, 1.2);
    const nose = mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#ff8fb1', 0.5));
    nose.position.set(0, -0.02, 0.24);
    const eyes = [-0.08, 0.08].map((x) => {
      const e = mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#1a1a22', 0.3), false);
      e.position.set(x, 0.06, 0.18);
      return e;
    });
    const ears = [-0.14, 0.14].map((x) => {
      const e = mesh(new THREE.CircleGeometry(0.11, 16), mat('#c9ced6', 0.7), false);
      e.position.set(x, 0.17, 0);
      return e;
    });
    mouse.add(head, nose, ...eyes, ...ears);
    mouse.userData.y0 = top - 0.45;
    mouse.position.set(0.1, top - 0.45, 0.2);
    mouse.visible = false;
    root.add(mouse);
    return { root, parts: { mouse } };
  },
  frog: () => {
    const root = new THREE.Group();
    const frog = new THREE.Group();
    const green = mat('#5cb85c', 0.5);
    const body = mesh(new THREE.SphereGeometry(0.28, 14, 10), green);
    body.scale.set(1.1, 0.7, 1);
    body.position.y = 0.18;
    const eyes = [-0.12, 0.12].map((x) => {
      const e = mesh(new THREE.SphereGeometry(0.09, 10, 8), mat('#ffffff', 0.4));
      e.position.set(x, 0.38, 0.12);
      const pupil = mesh(new THREE.SphereGeometry(0.045, 8, 6), mat('#1a1a22', 0.3), false);
      pupil.position.set(0, 0.01, 0.07);
      e.add(pupil);
      return e;
    });
    const pad = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 18), mat('#3f9a4f', 0.6));
    pad.position.y = 0.02;
    frog.add(body, ...eyes);
    // It jumps 2.5 ahead (its local -x, towards the water once turned).
    frog.userData.out = new THREE.Vector3(-2.5, 0, 0);
    root.add(pad, frog);
    return { root, parts: { frog } };
  },
  scarecrow: () => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.07, 2, 8), mat('#8a5a32', 0.8));
    pole.position.y = 1;
    const arms = mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), mat('#8a5a32', 0.8));
    arms.position.y = 1.45;
    const shirt = mesh(new THREE.BoxGeometry(0.7, 0.7, 0.32), mat('#d8483c', 0.7));
    shirt.position.y = 1.25;
    const sleeves = mesh(new THREE.BoxGeometry(1.3, 0.18, 0.26), mat('#3f86d6', 0.7));
    sleeves.position.y = 1.45;
    const head = mesh(new THREE.SphereGeometry(0.24, 14, 10), mat('#f2d9a6', 0.8));
    head.position.y = 1.85;
    const straw = [-0.62, 0.62].map((x) => {
      const s = mesh(new THREE.ConeGeometry(0.1, 0.3, 6), mat('#e3c25a', 0.9));
      s.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      s.position.set(x + Math.sign(x) * 0.15, 1.45, 0);
      return s;
    });
    body.add(pole, arms, shirt, sleeves, head, ...straw);
    const hat = new THREE.Group();
    const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 18), mat('#d9b25a', 0.85));
    const crown = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.26, 14), mat('#d9b25a', 0.85));
    crown.position.y = 0.14;
    hat.add(brim, crown);
    hat.position.y = 2.06;
    hat.userData.y0 = 2.06;
    root.add(body, hat);
    return { root, parts: { body, hat } };
  },
  mailbox: () => {
    const root = new THREE.Group();
    const post = mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), mat('#8a5a32', 0.8));
    post.position.y = 0.45;
    const box = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16, 1, false, 0, Math.PI), mat('#3f86d6', 0.5));
    box.rotation.z = Math.PI / 2;
    box.rotation.y = Math.PI / 2;
    box.position.y = 1;
    const base = mesh(new THREE.BoxGeometry(0.44, 0.22, 0.6), mat('#3f86d6', 0.5));
    base.position.y = 0.95;
    const flag = new THREE.Group();
    const stick = mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), mat('#d8483c', 0.5));
    stick.position.y = 0.2;
    const cloth = mesh(new THREE.BoxGeometry(0.03, 0.14, 0.2), mat('#d8483c', 0.5));
    cloth.position.set(0, 0.34, 0.1);
    flag.add(stick, cloth);
    flag.position.set(0.24, 0.95, 0.1);
    flag.rotation.z = 0;
    const letter = mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), mat('#ffffff', 0.6));
    letter.visible = false;
    root.add(post, box, base, flag, letter);
    return { root, parts: { flag, letter } };
  },
  trashcan: () => {
    const root = new THREE.Group();
    const bin = mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.9, 16), mat('#5a7a9a', 0.6));
    bin.position.y = 0.45;
    const lid = new THREE.Group();
    const top = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16), mat('#4a6a8a', 0.6));
    top.position.z = 0.4;
    lid.add(top);
    lid.position.set(0, 0.92, -0.4);
    const cat = new THREE.Group();
    const head = mesh(new THREE.SphereGeometry(0.2, 14, 10), mat('#f2a24a', 0.7));
    const ears = [-0.11, 0.11].map((x) => {
      const e = mesh(new THREE.ConeGeometry(0.07, 0.14, 6), mat('#f2a24a', 0.7));
      e.position.set(x, 0.18, 0);
      return e;
    });
    const bone = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.05), mat('#ffffff', 0.5));
    bone.position.set(0, -0.08, 0.2);
    cat.add(head, ...ears, bone);
    cat.userData.y0 = 0.7;
    cat.position.y = 0.7;
    cat.visible = false;
    root.add(bin, lid, cat);
    return { root, parts: { lid, cat } };
  },
  hydrant: () => {
    const root = new THREE.Group();
    const red = mat('#d8483c', 0.45);
    const body = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.7, 16), red);
    body.position.y = 0.35;
    const cap = mesh(new THREE.SphereGeometry(0.21, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
    cap.position.y = 0.7;
    const arm = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12), red);
    arm.rotation.z = Math.PI / 2;
    arm.position.y = 0.45;
    root.add(body, cap, arm);
    return { root, parts: { cap } };
  },
  clock: () => {
    const root = new THREE.Group();
    const face = new THREE.Group();
    const dial = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 24), mat('#ffffff', 0.4));
    dial.rotation.x = Math.PI / 2;
    const rim = mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 24), mat('#d8483c', 0.4));
    const hand = new THREE.Group();
    const h = mesh(new THREE.BoxGeometry(0.05, 0.45, 0.03), mat('#18213d', 0.4));
    h.position.y = 0.2;
    hand.add(h);
    hand.position.z = 0.08;
    const bells = [-0.38, 0.38].map((x) => {
      const b = mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e0b040', 0.3, 0.6));
      b.position.set(x, 0.62, 0);
      return b;
    });
    face.add(dial, rim, hand, ...bells);
    face.userData.y0 = 2.6;
    face.position.y = 2.6;
    const post = mesh(new THREE.BoxGeometry(0.15, 2.3, 0.15), mat('#8a90a0', 0.4));
    post.position.y = 1.15;
    root.add(post, face);
    return { root, parts: { face, hand } };
  },
  soda: () => {
    const root = new THREE.Group();
    const box = mesh(new THREE.BoxGeometry(1.1, 2, 0.8), mat('#d8483c', 0.45));
    box.position.y = 1;
    const window = mesh(new THREE.PlaneGeometry(0.7, 1), mat('#9fd0e8', 0.2));
    window.position.set(0, 1.25, 0.41);
    const slot = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.05), mat('#2a2f3a', 0.5));
    slot.position.set(0, 0.45, 0.41);
    const can = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.25, 12), mat('#3f86d6', 0.3, 0.5));
    can.rotation.z = Math.PI / 2;
    can.visible = false;
    root.add(box, window, slot, can);
    return { root, parts: { can } };
  },
  well: (body) => {
    if (body) return modelWell(body);
    const root = new THREE.Group();
    const stone = mat('#a9a39a', 0.85);
    const ring = mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.7, 20, 1, true), stone);
    ring.position.y = 0.35;
    (ring.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const rim = mesh(new THREE.TorusGeometry(0.76, 0.1, 8, 24), stone);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.7;
    const water = mesh(new THREE.CircleGeometry(0.68, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3f8fc4', roughness: 0.1 }));
    water.position.y = 0.25;
    const wood = mat('#8a5a32', 0.8);
    const posts = [-0.7, 0.7].map((x) => {
      const p = mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), wood);
      p.position.set(x, 0.8, 0);
      return p;
    });
    const roof = mesh(new THREE.ConeGeometry(1.1, 0.6, 4), mat('#c84a3a', 0.7));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.85;
    const crank = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), wood);
    crank.rotation.z = Math.PI / 2;
    crank.position.y = 1.35;
    const bucket = mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 12), mat('#9a6a3e', 0.7));
    bucket.position.y = 0.95;
    bucket.userData.y0 = 0.95;
    root.add(ring, rim, water, ...posts, roof, crank, bucket);
    return { root, parts: { crank, bucket } };
  },
};

/**
 * The sculpted well (2.8 wide, its front to +Z, measured in
 * assets-src/farm-v3/props/anchors.json): our water in its open throat, a
 * winch between the posts that turns about its own length, a short beam out
 * over the throat, and the rope and bucket hanging from it.
 */
function modelWell(body: THREE.Object3D) {
  const root = new THREE.Group();
  const water = mesh(new THREE.CircleGeometry(0.76, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3f8fc4', roughness: 0.1 }), false);
  water.position.y = 0.2;
  const wood = mat('#8a5a32', 0.8);
  const crank = new THREE.Group();
  crank.position.set(0, 1.7, -0.4);
  const drum = mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 10), wood);
  drum.rotation.z = Math.PI / 2;
  // A handle on the end, so the turning shows.
  const arm = mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), wood);
  arm.position.set(1.12, 0.14, 0);
  const grip = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), wood);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(1.2, 0.28, 0);
  crank.add(drum, arm, grip);
  const beam = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), wood);
  beam.position.set(0, 1.74, 0.03);
  const rope = mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), mat('#d8c39a', 0.9), false);
  const bucket = mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.26, 14), mat('#9a6a3e', 0.7));
  bucket.position.set(0, 1.3, 0.45);
  bucket.userData.y0 = 1.3;
  bucket.userData.rope = rope;
  const hang = () => {
    // The rope from the beam's end down to the bucket's handle.
    const top = 1.7;
    const low = bucket.position.y + 0.13;
    rope.scale.y = Math.max(0.01, top - low);
    rope.position.set(0, (top + low) / 2, 0.45);
  };
  hang();
  bucket.userData.hang = hang;
  root.add(body, water, crank, beam, rope, bucket);
  return { root, parts: { crank, bucket } };
}

const butterflyCache = new Map<string, THREE.Texture>();
/** Two pairs of round wings and a dark body, seen from above. */
function butterflyTexture(color: string): THREE.Texture {
  const hit = butterflyCache.get(color);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  for (const [x, y, r] of [[20, 24, 14], [44, 24, 14], [23, 44, 9], [41, 44, 9]] as const) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#2a2230';
  g.fillRect(30, 14, 4, 38);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  butterflyCache.set(color, t);
  return t;
}
