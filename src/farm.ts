// The farm: a diorama lying on the workbench. Animals ask for help in turn —
// a hot cow wants a fan, a thirsty pig a pump, the tractor an open gate; in
// the evening the hens want light and the rabbits warmth; at night a fox
// sneaks up and an alarm bell sends it away. Then the sun comes up.
import * as THREE from 'three';
import type { Hint } from './hints';
import { model, type Fit } from './parts/assets';
import type { Part, PartKind } from './parts/base';
import { PushButton } from './parts/extra';
import { Gate, Pump, Solar } from './parts/farm';
import { mat, mesh } from './parts/kit';
import { glowFor } from './parts/models';
import { AMBIENT } from './parts/wind';
import type { Stage } from './stage';
import { thumb } from './thumbs';
import type { PhraseId } from './voice';
import { isActive, type World } from './world';

/** Model files only the farm needs (loaded when it opens). */
export const FARM_MODELS = ['cow', 'pig', 'hen', 'rabbit', 'dog', 'fox', 'barn', 'coop', 'tractor'];

/** What the drawers offer on the farm. */
export const FARM_TRAY: { kind: PartKind; count: number }[] = [
  { kind: 'fan', count: 2 },
  { kind: 'floorFan', count: 1 },
  { kind: 'pump', count: 1 },
  { kind: 'bulb', count: 2 },
  { kind: 'led', count: 2 },
  { kind: 'heater', count: 1 },
  { kind: 'button', count: 1 },
  { kind: 'bell', count: 1 },
  { kind: 'buzzer', count: 1 },
  { kind: 'switch', count: 2 },
  { kind: 'battery', count: 1 },
  { kind: 'bigBattery', count: 1 },
];

export interface FarmHooks {
  say(id: PhraseId): void;
  /** Confetti and a cheer at a point on the table. */
  cheer(at: THREE.Vector3): void;
  /** The whole farm is happy. */
  done(): void;
  /** A soft sound for a happy animal. */
  chime(): void;
  /** Someone was helped (an animal's name, or 'fox' when it is chased off). */
  helped?(name: string, at: THREE.Vector3): void;
  /** Something worth seeing is happening here (the camera may glance at it). */
  look?(at: THREE.Vector3): void;
}

/** Board size (world units) and where it lies. */
const W = 38;
const D = 26;

type Phase = 'day' | 'evening' | 'night' | 'morning' | 'done';

interface Critter {
  name: string;
  group: THREE.Group;
  /** Rests here; bobs and hops around it. */
  home: THREE.Vector3;
  height: number;
  bubble: THREE.Sprite;
  hearts: THREE.Sprite[];
  hop: number;
  mood: 'calm' | 'asking' | 'happy';
  sweat?: THREE.Sprite[];
}

interface Need {
  critter: Critter;
  phase: Phase;
  ask: PhraseId;
  thanks: PhraseId;
  /** Shown in the bubble, and dragged from the drawers by a hint. */
  icon: PartKind;
  /** Where the part should go (a ring on the grass). */
  spot: THREE.Vector3;
  ring: THREE.Mesh;
  done: boolean;
  /** Seconds the need has been met in a row. */
  held: number;
  met(): boolean;
}

const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export class FarmMap {
  readonly scenery = new THREE.Group();
  private critters = new Map<string, Critter>();
  private needs: Need[] = [];
  phase: Phase = 'day';
  private phaseT = 0;
  private night = 0;
  private trough!: THREE.Mesh;
  troughLevel = 0;
  private tractor!: THREE.Group;
  private tractorT = -1;
  private fox!: Critter;
  private foxT = -1;
  private foxRun = 0;
  private foxPressedAt = -1;
  private foxTipSaid = false;
  private gate!: Gate;
  private time = 0;

  constructor(
    private stage: Stage,
    private world: World,
    private hooks: FarmHooks,
  ) {}

  /** Lay the farm out on the table (the world must be empty). */
  start() {
    this.stage.world.add(this.scenery);
    this.buildBoard();
    this.buildPlaces();
    this.placeParts();
    this.buildCritters();
    this.buildNeeds();
    this.setPhase('day');
    AMBIENT.strength = 0.55;
    AMBIENT.dir.set(-0.7, 0, 0.7).normalize();
  }

  dispose() {
    this.scenery.removeFromParent();
    AMBIENT.strength = 0;
    Solar.sun = 1;
    this.stage.setNightAmount(0);
  }

  /** The farm's corners, for fitting it on screen. */
  bounds(): THREE.Vector3[] {
    return [v(-W / 2 + 1, -D / 2 + 1), v(W / 2 - 1, D / 2 - 1)];
  }

  get nightAmount() {
    return this.night;
  }

  /** How many needs are met, of how many. */
  get score(): [number, number] {
    return [this.needs.filter((n) => n.done).length + (this.phase === 'morning' || this.phase === 'done' ? 1 : 0), this.needs.length + 1];
  }

  // ───────────────────────── Building ─────────────────────────

  private buildBoard() {
    const tex = boardTexture();
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const side = mat('#8a6a46', 0.8);
    const board = mesh(new THREE.BoxGeometry(W, 0.5, D), [side, side, top, side, side, side] as unknown as THREE.Material);
    board.position.y = -0.26;
    board.receiveShadow = true;
    board.castShadow = false;
    this.scenery.add(board);
    // A darker rim, like the edge of a model board.
    const rim = mesh(new THREE.BoxGeometry(W + 0.4, 0.4, D + 0.4), mat('#6e5236', 0.8));
    rim.position.y = -0.36;
    this.scenery.add(rim);
  }

  private add(name: string, fit: Fit, x: number, z: number, fallback: () => THREE.Object3D, rotY = 0) {
    const m = model(name, fit) ?? fallback();
    m.position.set(x, 0, z);
    m.rotation.y = rotY;
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scenery.add(m);
    return m;
  }

  private buildPlaces() {
    // Barn (cows), coop (hens), hutch (rabbits), kennel (dog), pig pen with trough.
    this.add('barn', { width: 5, rotateY: -Math.PI / 2 }, -12, -8.2, () => boxHouse('#c84a3a', '#5a5f6a', 6, 4, 4.5));
    this.add('coop', { width: 2.7, rotateY: -Math.PI / 2 }, -3.2, 7.2, () => boxHouse('#f2c230', '#d8483c', 3.2, 2.2, 2.6));
    this.scenery.add(hutch(-14, 6.6));
    this.scenery.add(kennel(6.2, 8.4));
    // Fences: the cow pen, the pig pen, and the long fence before the field (with the gate).
    this.scenery.add(fence([v(-16, -5.2), v(-16, 0.8), v(-7, 0.8), v(-7, -5.2)]));
    this.scenery.add(fence([v(-1.2, -9), v(-1.2, -3), v(5.5, -3), v(5.5, -9)]));
    this.scenery.add(fence([v(9.5, 3), v(18.5, 3)]));
    this.scenery.add(fence([v(4.5, 3), v(6.5, 3)]));
    // Trough in the pig pen: a wooden box with water that rises.
    const troughBox = mesh(new THREE.BoxGeometry(2, 0.45, 0.8), mat('#9a6a3e', 0.7));
    troughBox.position.set(3.4, 0.22, -5.2);
    const inner = mesh(new THREE.BoxGeometry(1.8, 0.4, 0.6), mat('#5a3a22', 0.8));
    inner.position.set(3.4, 0.27, -5.2);
    this.trough = mesh(new THREE.BoxGeometry(1.78, 1, 0.58), new THREE.MeshStandardMaterial({ color: '#4fb3e8', roughness: 0.05, transparent: true, opacity: 0.85 }), false);
    this.trough.position.set(3.4, 0.08, -5.2);
    this.trough.scale.y = 0.001;
    this.scenery.add(troughBox, inner, this.trough);
    // Trees round the edges; a little wood in the bottom-left where the fox lives.
    const trees: [number, number, number][] = [
      [-17.5, -11.5, 1.2], [-15, -11.8, 1], [17.5, -11.5, 1.1], [17.6, 11.6, 1.2], [-17.6, 9.5, 1.3], [-16.4, 11.6, 1.1],
      [-14.2, 12, 0.9], [-17.8, 6.6, 1], [9.6, 12, 0.9], [-6, -11.8, 0.9], [6.5, -11.6, 1], [0.8, 11.8, 0.8],
    ];
    for (const [x, z, s] of trees) this.scenery.add(tree(x, z, s));
    // Haystacks and sprouts in the field.
    for (const [x, z] of [[-8.5, -9.5], [-6.6, -10.2], [16.5, 0.6]]) this.scenery.add(haystack(x, z));
    this.scenery.add(sprouts());
    // The tractor waits on the road below the gate.
    this.tractor = <THREE.Group>this.add('tractor', { depth: 2.6, rotateY: Math.PI }, 8, 7.4, () => boxHouse('#3f8a4f', '#2a3148', 2.2, 1.2, 1.4), 0);
  }

  /** The power sources and the gate are part of the map: they cannot be moved. */
  private placeParts() {
    const pin = (kind: PartKind, x: number, z: number) => {
      const p = this.world.addPart(kind, x, z, { locked: true, appear: false });
      p.pinned = true;
      return p;
    };
    pin('pole', -4.2, -1.2);
    pin('solar', -6.6, -10);
    pin('windGen', 15.6, 5.8);
    this.gate = pin('gate', 8, 3.2) as Gate;
  }

  private critter(name: string, fit: Fit, x: number, z: number, height: number, face = 0): Critter {
    const group = new THREE.Group();
    const m = model(name.replace(/\d+$/, ''), fit) ?? blob(name);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.userData.critter = name;
      }
    });
    group.add(m);
    group.position.set(x, 0, z);
    group.rotation.y = face;
    this.scenery.add(group);
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    bubble.scale.set(1.7, 1.5, 1);
    bubble.position.set(x, height + 1.1, z);
    bubble.renderOrder = 12;
    this.scenery.add(bubble);
    const hearts: THREE.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false, opacity: 0 }));
      h.scale.setScalar(0.6);
      h.userData.t = 1;
      hearts.push(h);
      this.scenery.add(h);
    }
    const c: Critter = { name, group, home: new THREE.Vector3(x, 0, z), height, bubble, hearts, hop: 0, mood: 'calm' };
    this.critters.set(name, c);
    return c;
  }

  private buildCritters() {
    this.critter('cow', { width: 2.4 }, -11, -2.4, 1.9, 0.25);
    this.critter('pig', { width: 1.7 }, 1.6, -6, 1.2, 0.3);
    this.critter('hen', { height: 1.25 }, -0.8, 8.6, 1.25, -0.4);
    this.critter('hen2', { height: 1.1 }, -1.9, 9.6, 1.1, 0.6);
    this.critter('rabbit', { height: 1.25 }, -11.7, 7.6, 1.25, 0.2);
    this.critter('dog', { height: 1.5 }, 4.4, 8.6, 1.5, -0.6);
    this.fox = this.critter('fox', { width: 1.7 }, -17, 11.5, 1, 0);
    this.fox.group.visible = false;
    // The tractor speaks for the gate (its bubble floats above it).
    const t = this.tractor;
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    bubble.scale.set(1.7, 1.5, 1);
    bubble.renderOrder = 12;
    this.scenery.add(bubble);
    t.traverse((o) => (o.userData.critter = 'tractor'));
    this.critters.set('tractor', { name: 'tractor', group: t as THREE.Group, home: t.position.clone(), height: 2, bubble, hearts: [], hop: 0, mood: 'calm' });
    // A hot cow sweats: little blue drops.
    const cow = this.critters.get('cow')!;
    cow.sweat = [0, 1, 2].map((i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(120,190,255,0.95)'), transparent: true, depthWrite: false, opacity: 0 }));
      s.scale.setScalar(0.3);
      s.userData.t = i / 3;
      this.scenery.add(s);
      return s;
    });
  }

  private ring(spot: THREE.Vector3): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(spot).setY(0.03);
    m.renderOrder = 3;
    this.scenery.add(m);
    return m;
  }

  private buildNeeds() {
    const near = (kinds: PartKind[], at: THREE.Vector3, r: number) => () =>
      this.world.parts.some((p) => kinds.includes(p.kind) && isActive(p) && p.root.position.distanceTo(at) < r);
    const cow = this.critters.get('cow')!;
    const pig = this.critters.get('pig')!;
    const add = (n: Omit<Need, 'ring' | 'done' | 'held'>) => this.needs.push({ ...n, ring: this.ring(n.spot), done: false, held: 0 });
    add({ critter: cow, phase: 'day', ask: 'cowHot', thanks: 'cowHappy', icon: 'fan', spot: v(-8.6, -2.4), met: near(['fan', 'floorFan', 'pcFan'], cow.home, 4.2) });
    add({
      critter: pig,
      phase: 'day',
      ask: 'pigThirsty',
      thanks: 'pigHappy',
      icon: 'pump',
      spot: v(2.4, -4.5),
      met: () => this.troughLevel > 0.95,
    });
    add({ critter: this.critters.get('tractor')!, phase: 'day', ask: 'gateStuck', thanks: 'gateHappy', icon: 'gate', spot: v(6.3, 3.6), met: () => this.gate.open > 0.97 });
    add({ critter: this.critters.get('hen')!, phase: 'evening', ask: 'henDark', thanks: 'henHappy', icon: 'bulb', spot: v(0.9, 6.4), met: near(['bulb', 'led'], v(-1.5, 8), 4.8) });
    add({ critter: this.critters.get('rabbit')!, phase: 'evening', ask: 'rabbitCold', thanks: 'rabbitHappy', icon: 'heater', spot: v(-9.4, 7.2), met: near(['heater'], v(-12.6, 7), 4.2) });
  }

  // ───────────────────────── Story ─────────────────────────

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    for (const n of this.needs) n.critter.mood = n.phase === p && !n.done ? 'asking' : n.done ? 'happy' : 'calm';
    if (p === 'evening') this.hooks.say('evening');
    if (p === 'night') {
      this.foxT = 0;
      this.hooks.say('foxComes');
      this.hooks.look?.(FOX_PATH[2].clone());
    }
    if (p === 'morning') this.hooks.say('morning');
  }

  /** Tap on an animal: it tells what it needs (or says thanks). */
  tapAt(x: number, y: number): boolean {
    const meshes: THREE.Object3D[] = [];
    this.scenery.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.userData.critter) meshes.push(o);
    });
    const hit = this.stage.raycast(x, y, meshes)[0];
    if (!hit) return false;
    const name = hit.object.userData.critter as string;
    const c = this.critters.get(name === 'hen2' ? 'hen' : name);
    if (!c) return false;
    c.hop = 1;
    const need = this.needs.find((n) => n.critter === c);
    if (name === 'fox') this.hooks.say('foxTip');
    else if (need && !need.done && need.phase === this.phase) this.hooks.say(need.ask);
    else if (need?.done) this.hooks.say(need.thanks);
    else if (name === 'dog' && this.phase === 'night') this.hooks.say('foxTip');
    return true;
  }

  /** The next helpful nudge: bring the part a waiting animal asks for. */
  hint(trayLeft: (k: PartKind) => number): Hint | null {
    for (const n of this.needs) {
      if (n.done || n.phase !== this.phase) continue;
      if (n.icon === 'gate') continue;
      const kinds = n.icon === 'fan' ? ['fan', 'floorFan', 'pcFan'] : n.icon === 'bulb' ? ['bulb', 'led'] : [n.icon];
      const placed = this.world.parts.some((p) => kinds.includes(p.kind) && p.root.position.distanceTo(n.spot) < 4.5);
      if (!placed && trayLeft(n.icon) > 0) return { type: 'drag', kind: n.icon, to: n.spot.clone(), phrase: 'placeHere' };
    }
    if (this.phase === 'night' && !this.world.parts.some((p) => p.kind === 'button') && trayLeft('button') > 0)
      return { type: 'drag', kind: 'button', to: FOX_PATH[2].clone(), phrase: 'foxTip' };
    return null;
  }

  update(dt: number) {
    this.time += dt;
    this.phaseT += dt;
    // Daylight: day → dusk in the evening → night → sunrise.
    const goal = this.phase === 'evening' ? 0.72 : this.phase === 'night' ? 1 : 0;
    this.night = THREE.MathUtils.damp(this.night, goal, 0.6, dt);
    this.stage.setNightAmount(this.night);
    Solar.sun = Math.max(0, 1 - this.night * 1.6);
    // Gusts on the hill.
    AMBIENT.strength = 0.55 + Math.sin(this.time * 0.37) * 0.12 + Math.sin(this.time * 1.3) * 0.05;

    // The trough fills while a pump pours into it.
    const pouring = this.world.parts.some((p) => p instanceof Pump && p.pumping && p.outlet().distanceTo(this.trough.position.clone().setY(0)) < 1.6);
    this.troughLevel = Math.min(1, Math.max(0, this.troughLevel + dt * (pouring ? 0.25 : -0.01)));
    this.trough.scale.y = Math.max(0.001, this.troughLevel * 0.34);
    this.trough.position.y = 0.08 + this.troughLevel * 0.17;

    for (const n of this.needs) {
      if (n.done || n.phase !== this.phase) {
        (n.ring.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.damp((n.ring.material as THREE.MeshBasicMaterial).opacity, 0, 6, dt);
        continue;
      }
      // The ring shows where the helper goes; it pulses gently.
      (n.ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(this.time * 3) * 0.2;
      n.ring.scale.setScalar(1 + Math.sin(this.time * 3) * 0.05);
      n.held = n.met() ? n.held + dt : 0;
      if (n.held > 0.8) {
        n.done = true;
        n.critter.mood = 'happy';
        n.critter.hop = 1;
        this.hooks.say(n.thanks);
        this.hooks.chime();
        this.hooks.cheer(n.critter.home.clone().setY(n.critter.height));
        this.hooks.helped?.(n.critter.name, n.critter.home.clone().setY(n.critter.height));
        for (const h of n.critter.hearts) h.userData.t = Math.random() * -0.6;
        if (n.critter.name === 'tractor') this.tractorT = 0;
      }
    }

    // Move the story on when everything of this part of the day is done.
    const left = this.needs.filter((n) => n.phase === this.phase && !n.done).length;
    if (this.phase === 'day' && left === 0 && this.phaseT > 1) this.waitThen('evening', 4);
    else if (this.phase === 'evening' && left === 0 && this.phaseT > 1) this.waitThen('night', 4);
    else if (this.phase === 'morning' && this.phaseT > 4) {
      this.phase = 'done';
      this.hooks.done();
    }

    this.updateFox(dt);
    this.updateTractor(dt);
    for (const c of this.critters.values()) this.animateCritter(c, dt);
  }

  private nextAt = -1;
  private waitThen(p: Phase, seconds: number) {
    if (this.nextAt < 0) this.nextAt = this.time + seconds;
    if (this.time >= this.nextAt) {
      this.nextAt = -1;
      this.setPhase(p);
    }
  }

  private updateTractor(dt: number) {
    if (this.tractorT < 0) return;
    // Up the road, through the gate, then round and round the field.
    this.tractorT += dt;
    const t = this.tractorT;
    const p = this.tractor.position;
    if (t < 4) {
      p.set(8, 0, 7.4 - t * 2.1);
      this.tractor.rotation.y = 0;
    } else {
      const a = (t - 4) * 0.35;
      const target = new THREE.Vector3(13.5 + Math.cos(a) * 3.6, 0, -4 + Math.sin(a) * 4.6);
      const dir = target.clone().sub(p);
      if (dir.lengthSq() > 1e-4) this.tractor.rotation.y = Math.atan2(-dir.x, -dir.z);
      p.lerp(target, Math.min(1, dt * 2));
    }
    p.y = Math.abs(Math.sin(t * 14)) * 0.03;
  }

  private updateFox(dt: number) {
    const fox = this.fox;
    if (this.phase !== 'night') {
      fox.group.visible = false;
      return;
    }
    // Back in the wood for a moment before the next try.
    if (this.foxT < 0) {
      fox.group.visible = false;
      this.foxT = Math.min(0, this.foxT + dt);
      if (this.foxT < 0) return;
    }
    fox.group.visible = true;
    fox.mood = 'asking';
    this.foxT += dt;
    // Sneak along the path towards the coop; scared — run back; else wait, slink off, come again.
    const scared = this.foxRun > 0;
    let s = scared ? this.foxRun : Math.min(this.foxT * 1.1, pathLength());
    if (scared) {
      this.foxRun = Math.max(0, this.foxRun - dt * 4.5);
      s = this.foxRun;
      if (this.foxRun === 0) {
        fox.group.visible = false;
        this.foxT = 0;
        this.setPhase('morning');
        return;
      }
    }
    const { at, dir } = pathAt(s);
    fox.group.position.copy(at);
    fox.group.rotation.y = Math.atan2(scared ? -dir.x : dir.x, scared ? -dir.z : dir.z) - Math.PI / 2;
    fox.home.copy(at);
    // Paws on a button press it.
    if (!scared) {
      for (const p of this.world.parts) {
        if (p instanceof PushButton && p.root.position.distanceTo(at) < 1.3 && !p.closed) {
          p.ballHit();
          this.foxPressedAt = this.time;
        }
      }
      // A bell or buzzer ringing while the fox is close scares it away.
      const ringing = this.world.parts.some((p) => (p.kind === 'bell' || p.kind === 'buzzer') && p.state.level > 0.05);
      if (ringing && s > 3) {
        this.foxRun = s;
        this.hooks.say('foxScared');
        this.hooks.chime();
        this.hooks.cheer(at.clone().setY(1));
        this.hooks.helped?.('fox', at.clone().setY(1));
        const dog = this.critters.get('dog')!;
        dog.hop = 1;
        return;
      }
      // At the coop with no alarm: wait, then slink back and try again.
      if (s >= pathLength() && this.foxT > pathLength() / 1.1 + 3) {
        if (!this.foxTipSaid) {
          this.foxTipSaid = true;
          this.hooks.say('foxTip');
        }
        this.foxT = -6;
      }
    }
    void this.foxPressedAt;
  }

  private animateCritter(c: Critter, dt: number) {
    c.hop = Math.max(0, c.hop - dt * 2.2);
    const bob = c.mood === 'asking' ? Math.max(0, Math.sin(this.time * 4 + c.home.x)) * 0.12 : Math.sin(this.time * 1.5 + c.home.x) * 0.02;
    const hop = Math.sin(c.hop * Math.PI) * 0.6;
    if (c.name !== 'tractor' && c.name !== 'fox') {
      c.group.position.y = Math.max(0, bob + hop);
      c.group.scale.set(1, 1 + (c.mood === 'asking' ? Math.sin(this.time * 8) * 0.015 : 0), 1);
    }
    // Speech bubble with the part it wants; a heart when happy.
    const mat = c.bubble.material as THREE.SpriteMaterial;
    const show = c.mood === 'asking' && c.name !== 'fox' ? 1 : 0;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, show, 6, dt);
    if (show && !mat.map) {
      const need = this.needs.find((n) => n.critter === c);
      if (need) mat.map = bubbleTexture(need.icon);
      mat.needsUpdate = true;
    }
    const base = c.name === 'tractor' ? this.tractor.position : c.group.position;
    c.bubble.position.set(base.x, c.height + 1.2 + Math.sin(this.time * 2.5 + c.home.z) * 0.08, base.z);
    c.bubble.scale.set(1.7, 1.5, 1).multiplyScalar(1 + Math.max(0, Math.sin(this.time * 4)) * 0.06 * show);
    for (const h of c.hearts) {
      if (h.userData.t >= 1) {
        h.material.opacity = 0;
        continue;
      }
      h.userData.t += dt * 0.6;
      const t = Math.max(0, h.userData.t as number);
      h.position.set(c.group.position.x + Math.sin(t * 6 + h.id) * 0.3, c.height + 0.4 + t * 1.6, c.group.position.z);
      h.material.opacity = h.userData.t > 0 ? Math.sin(t * Math.PI) : 0;
    }
    // A hot cow drips sweat until the fan comes.
    if (c.sweat) {
      for (const s of c.sweat) {
        s.userData.t = (s.userData.t + dt * 0.8) % 1;
        const t = s.userData.t as number;
        s.position.set(c.home.x + 0.3 + (s.id % 3) * 0.2, c.height - t * 0.8, c.home.z + 0.4);
        s.material.opacity = c.mood === 'asking' ? Math.sin(t * Math.PI) * 0.9 : 0;
      }
    }
  }

  /** Which parts of the map the child cannot throw away (none; all are pinned or theirs). */
  isMapPart(p: Part) {
    return p.pinned;
  }
}

// ───────────────────────── Fox path ─────────────────────────

const FOX_PATH = [v(-17.5, 11.8), v(-13, 11), v(-8.5, 10.6), v(-5, 9.6), v(-3.4, 8.8)];
function pathLength() {
  let l = 0;
  for (let i = 1; i < FOX_PATH.length; i++) l += FOX_PATH[i].distanceTo(FOX_PATH[i - 1]);
  return l;
}
function pathAt(s: number): { at: THREE.Vector3; dir: THREE.Vector3 } {
  for (let i = 1; i < FOX_PATH.length; i++) {
    const a = FOX_PATH[i - 1];
    const b = FOX_PATH[i];
    const len = a.distanceTo(b);
    if (s <= len || i === FOX_PATH.length - 1) {
      return { at: a.clone().lerp(b, Math.min(1, Math.max(0, s / len))), dir: b.clone().sub(a).normalize() };
    }
    s -= len;
  }
  return { at: FOX_PATH[0].clone(), dir: v(1, 0) };
}

// ───────────────────────── Scenery helpers ─────────────────────────

/** The board's painted top: grass, paths, the field, the pond, mud. */
function boardTexture(): THREE.Texture {
  const px = 64;
  const c = document.createElement('canvas');
  c.width = W * px;
  c.height = D * px;
  const ctx = c.getContext('2d')!;
  const X = (x: number) => (x + W / 2) * px;
  const Z = (z: number) => (z + D / 2) * px;
  ctx.fillStyle = '#a3c17f';
  ctx.fillRect(0, 0, c.width, c.height);
  // Grass speckles.
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(80,120,60,0.22)' : 'rgba(205,225,160,0.28)';
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 6);
  }
  // The field: plowed rows.
  ctx.fillStyle = '#9a7650';
  ctx.beginPath();
  ctx.roundRect(X(9.5), Z(-11.5), 9 * px, 13.5 * px, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,55,30,0.45)';
  ctx.lineWidth = 10;
  for (let x = 10; x < 18.5; x += 0.9) {
    ctx.beginPath();
    ctx.moveTo(X(x), Z(-11));
    ctx.lineTo(X(x), Z(1.5));
    ctx.stroke();
  }
  // Paths: soft sand-coloured lanes.
  const path = (pts: [number, number][], w: number) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#d6bd86';
    ctx.lineWidth = w * px;
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,200,0.35)';
    ctx.lineWidth = w * px * 0.45;
    ctx.stroke();
  };
  path([[8, 13], [8, 2], [8, -2], [12, -3]], 2.4);
  path([[-12, -5], [-12, 0], [-4, 1.5], [3, 1.5], [8, 2]], 1.4);
  path([[-3.4, 8.8], [-5, 9.6], [-8.5, 10.6], [-13, 11], [-18, 11.8]], 1.1);
  path([[-4, 1.5], [-3.2, 5.5]], 1.2);
  // Mud in the pig pen, the pond by the house.
  const blobPaint = (x: number, z: number, rx: number, rz: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(X(x), Z(z), rx * px, rz * px, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  blobPaint(1.6, -6.2, 2.4, 1.6, '#8a6a46');
  blobPaint(1.8, -6.4, 1.6, 1.0, '#7a5a3a');
  blobPaint(14, 11, 3.2, 1.8, '#c9e6f0');
  blobPaint(14, 11, 2.8, 1.5, '#5bb5d8');
  blobPaint(13.4, 10.6, 1.2, 0.5, 'rgba(255,255,255,0.35)');
  // Flowers.
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = ['#ffffff', '#ffd23f', '#ff8fb1', '#b388ff'][i % 4];
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function boxHouse(wall: string, roof: string, w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(w, h, d), mat(wall, 0.7));
  body.position.y = h / 2;
  const r = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.6, 4), mat(roof, 0.7));
  r.rotation.y = Math.PI / 4;
  r.position.y = h + h * 0.3;
  g.add(body, r);
  return g;
}

function hutch(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#b98654', 0.7);
  const box = mesh(new THREE.BoxGeometry(2.6, 1.3, 1.6), wood);
  box.position.y = 0.95;
  const roof = mesh(new THREE.BoxGeometry(2.9, 0.12, 1.9), mat('#3f86d6', 0.6));
  roof.position.y = 1.65;
  roof.rotation.x = 0.12;
  const mesh1 = mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ color: '#d9dde4', transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  mesh1.position.set(0.4, 0.95, 0.81);
  for (const sx of [-1.15, 1.15]) {
    for (const sz of [-0.7, 0.7]) {
      const leg = mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), wood);
      leg.position.set(sx, 0.17, sz);
      g.add(leg);
    }
  }
  g.add(box, roof, mesh1);
  g.position.set(x, 0, z);
  return g;
}

function kennel(x: number, z: number): THREE.Group {
  const g = boxHouse('#c98a4b', '#d8483c', 1.6, 1.1, 1.4);
  const door = mesh(new THREE.CircleGeometry(0.35, 20), mat('#2a1a10', 0.9));
  door.position.set(0, 0.45, 0.71);
  g.add(door);
  g.position.set(x, 0, z);
  g.rotation.y = -0.4;
  return g;
}

function fence(pts: THREE.Vector3[]): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#f6eddd', 0.6);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n);
      const post = mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), wood);
      post.position.set(p.x, 0.4, p.z);
      g.add(post);
    }
    for (const y of [0.35, 0.65]) {
      const rail = mesh(new THREE.BoxGeometry(len, 0.08, 0.06), wood);
      rail.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      rail.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      g.add(rail);
    }
  }
  return g;
}

function tree(x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.2, 10), mat('#7a5232', 0.8));
  trunk.position.y = 0.6;
  g.add(trunk);
  const greens = ['#6f9f56', '#7fae62', '#5f9150'];
  [[0, 1.8, 0, 1], [0.45, 1.5, 0.2, 0.75], [-0.4, 1.55, -0.15, 0.7], [0.05, 2.4, 0.05, 0.65]].forEach(([dx, y, dz, r], i) => {
    const ball = mesh(new THREE.IcosahedronGeometry(r, 1), mat(greens[i % 3], 0.75));
    ball.position.set(dx, y, dz);
    g.add(ball);
  });
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  return g;
}

function haystack(x: number, z: number): THREE.Mesh {
  const m = mesh(new THREE.SphereGeometry(0.9, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e3c25a', 0.9));
  m.scale.y = 1.1;
  m.position.set(x, 0, z);
  return m;
}

function sprouts(): THREE.InstancedMesh {
  const geo = new THREE.ConeGeometry(0.12, 0.35, 5);
  const im = new THREE.InstancedMesh(geo, mat('#5aa64a', 0.7), 90);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let x = 10.45; x < 18.3 && i < 90; x += 0.9) {
    for (let z = -10.5; z < 1 && i < 90; z += 1.3) {
      m.makeTranslation(x, 0.17, z + (Math.random() - 0.5) * 0.3);
      im.setMatrixAt(i++, m);
    }
  }
  im.count = i;
  im.castShadow = true;
  return im;
}

/** A stand-in animal when its model did not load: a coloured rounded body. */
function blob(name: string): THREE.Group {
  const colors: Record<string, string> = { cow: '#f4f4f4', pig: '#f5a9b8', hen: '#ffffff', hen2: '#ffffff', rabbit: '#b9bdc6', dog: '#c98a4b', fox: '#f08a3a' };
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(colors[name] ?? '#ffffff', 0.6));
  body.scale.set(1.4, 0.9, 0.9);
  body.position.y = 0.6;
  g.add(body);
  return g;
}

let heartTex: THREE.Texture | null = null;
function heartTexture(): THREE.Texture {
  if (heartTex) return heartTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.font = '100px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❤️', 64, 70);
  heartTex = new THREE.CanvasTexture(c);
  heartTex.colorSpace = THREE.SRGBColorSpace;
  return heartTex;
}

const bubbleCache = new Map<string, THREE.Texture>();
/** A speech bubble with a picture of the part an animal is asking for. */
function bubbleTexture(kind: PartKind): THREE.Texture {
  const hit = bubbleCache.get(kind);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 226;
  const ctx = c.getContext('2d')!;
  const draw = (img?: HTMLImageElement) => {
    ctx.clearRect(0, 0, 256, 226);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#18213d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 176, 44);
    ctx.moveTo(108, 182);
    ctx.lineTo(128, 220);
    ctx.lineTo(148, 182);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(110, 176, 36, 10);
    if (img) ctx.drawImage(img, 40, 14, 176, 164);
    else {
      ctx.font = '110px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#18213d';
      ctx.fillText(kind === 'gate' ? '🚜' : '❓', 128, 100);
    }
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  draw();
  const src = kind === 'gate' ? '' : thumb(kind, true);
  if (src) {
    const img = new Image();
    img.onload = () => draw(img);
    img.src = src;
  }
  bubbleCache.set(kind, tex);
  return tex;
}
