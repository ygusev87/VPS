// The factory: a toy factory hall with one production line, and a level of
// its own — its machines, gears and pipes, not the workbench's parts. The
// hall is dim until the main switch is wired in; then the press is driven
// through a gear train from a motor, paint runs through pipes from a pump
// tank into the paint booth, a lamp over the line lets a light sensor start
// the robot arm, the packing machine runs on its switch, and a belt loads
// the boxes onto the lorry. Once a station works, the toys go
// through it: stamped, painted, picked, packed and driven away.
import * as THREE from 'three';
import { groundMaterial, type GroundPlan } from './ground';
import { sandboxHint, type Hint } from './hints';
import { model, type Fit } from './parts/assets';
import type { Part, PartKind } from './parts/base';
import { Belt, LightSensor } from './parts/chain';
import { Packer, PaintBooth, Pipe, Press, RobotArm } from './parts/factory';
import type { Substation } from './parts/city';
import { mat, mesh } from './parts/kit';
import { glowFor } from './parts/models';
import { StoryMap, blob, v, type Critter, type MapProgress, type Need, type NeedSpec, type Phase } from './storymap';
import type { PhraseId } from './voice';
import { activeAt, isActive } from './world';

/** Model files the factory needs (each falls back to a code-built stand-in). */
export const FACTORY_MODELS = ['pole', 'child', 'kitten', 'flower-cluster'];

/** What the drawers offer in the factory: its own machines and what their chains need. */
export const FACTORY_TRAY: { kind: PartKind; count: number }[] = [
  { kind: 'switch', count: 3 },
  { kind: 'gearMotor', count: 1 },
  { kind: 'gear', count: 1 },
  { kind: 'bigGear', count: 1 },
  { kind: 'tank', count: 1 },
  { kind: 'pipe', count: 3 },
  { kind: 'bulb', count: 1 },
  { kind: 'lightSensor', count: 1 },
  { kind: 'robotArm', count: 1 },
  { kind: 'packer', count: 1 },
  { kind: 'belt', count: 1 },
];

/** Bumped whenever the factory is laid out anew (a save on another layout starts it afresh). */
export const FACTORY_LAYOUT = 1;

export interface FactoryProgress extends MapProgress {
  loaded: number;
}

const W = 110;
const D = 75;
/** The line the toys travel along, from the press to the lorry. */
const LINE_Z = -2.2;
/** How dark the hall is till its lights are switched on. */
const DIM = 0.55;

// 1. The main switch: the hall's electrical panel (pinned), a switch to put in its circuit.
const PANEL = v(-44, -20);
const MAIN_SWITCH = v(-40, -16.5);
const PANEL_POLE = v(-38, -21);
// 2. The press, worked through a gear train from a motor: big gear, small gear, motor gear, each meshing the next.
const PRESS = v(-26, -6);
const PRESS_GEAR = v(PRESS.x - 0.75, PRESS.z - 0.2);
const BIG_GEAR = v(PRESS_GEAR.x - 1.6, PRESS_GEAR.z);
const SMALL_GEAR = v(BIG_GEAR.x - 1.6, BIG_GEAR.z);
const MOTOR = v(SMALL_GEAR.x - 1.2, SMALL_GEAR.z + 0.1);
const PRESS_POLE = v(-33, -10.2);
// 3. Paint: a pump tank, three pipes end to end from its spout, the booth (pinned) at the far end.
const TANK = v(-16, -5.85);
const SPOUT = v(TANK.x + 0.9, TANK.z - 0.15);
const PIPES = [0, 1, 2].map((i) => v(SPOUT.x + 1 + i * 2, SPOUT.z));
const BOOTH = v(SPOUT.x + 6 + 1, SPOUT.z + 0.15);
const TANK_POLE = v(-17, -10.5);
const BOOTH_POLE = v(-5, -9.8);
// 4. The robot: a lamp over the line, a light sensor in its light, the arm the sensor switches on.
const LAMP = v(4, -10);
const SENSOR = v(6, -10);
const ROBOT = v(8.5, -6.5);
const ROBOT_POLE = v(6, -14.2);
// 5. The packing machine, on a switch (it has to keep working while the toys come).
const PACKER = v(22, -6);
const PACK_SWITCH = v(18.5, -9.5);
const PACK_POLE = v(22, -11.2);
// 6. Loading: a belt from the line to the lorry, on a switch.
const BELT_SPOT = v(36, -4.5);
const LOAD_SWITCH = v(33, -8.5);
const LOAD_POLE = v(37.5, -9.5);
const LORRY = v(44.5, -2.5);

/** Where each station stands on the line (a toy stops there till it works). */
const STATIONS = [PRESS.x, BOOTH.x, ROBOT.x, PACKER.x, BELT_SPOT.x, LORRY.x - 2];

const VOICES: Record<string, PhraseId> = { foreman: 'shopHello', worker: 'hammer', lorry: 'beep', cat: 'meow' };
const MODEL_OF: Record<string, string> = { cat: 'kitten' };

export class FactoryMap extends StoryMap {
  protected readonly width = W;
  protected readonly depth = D;
  readonly layout = FACTORY_LAYOUT;
  protected readonly intro = 'factoryIntro';
  readonly ownHints = true;
  private poles = new Map<THREE.Vector3, Part>();
  private panel!: Substation;
  private press!: Press;
  private booth!: PaintBooth;
  /** The hall's lights are on (the main switch works). */
  private lit = false;
  private lamps: { glow: THREE.Sprite; bulb: THREE.MeshStandardMaterial }[] = [];
  /** Toys on the line: how far along (x) and what has been done to them. */
  private toys: { m: THREE.Group; x: number; stage: number }[] = [];
  private stampsSeen = 0;
  /** Boxes on the lorry; at three it drives off. */
  loaded = 0;
  private lorry!: Critter;
  private drivenOff = 0;
  private steam: THREE.Sprite[] = [];

  protected build() {
    this.buildBoard();
    this.buildHall();
    this.placeParts();
    this.buildCritters();
    this.buildNeeds();
    // A clock on the back wall, a soda machine, workers walking about.
    this.life.addToy('clock', 0, -35.6, 0);
    this.life.addToy('soda', -52.5, -24, Math.PI / 2);
    for (const [x, z] of [[-12, 12], [16, 14], [34, -18], [-40, 14]] as const) this.life.addExtra(worker('#3f86d6', '#f2c230'), x, z, 0, 'stroll', 'hammer', 4);
    this.life.addFlutters([], [v(-20, -25), v(20, -25)]);
  }

  protected saveExtra() {
    return { loaded: this.loaded };
  }

  protected restoreExtra(m: MapProgress) {
    const p = m as FactoryProgress;
    this.loaded = p.loaded ?? 0;
    if (this.needs.find((n) => n.critter.name === 'lorry')?.done) this.drivenOff = 1;
  }

  protected voiceOf(base: string): PhraseId | null {
    return VOICES[base] ?? null;
  }

  protected critterModel(base: string, fit: Fit, name: string): THREE.Object3D {
    return model(MODEL_OF[base] ?? base, fit) ?? STAND_INS[base]?.() ?? blob(name);
  }

  /** Dim till the main switch works; then the hall's lamps are on, whatever the time. */
  protected darkness() {
    return this.lit ? 0 : DIM;
  }

  /** The factory works one long shift: when all its stations work, that is the end. */
  protected after(_p: Phase) {
    return { next: 'done' as Phase, wait: 4 };
  }

  // ───────────────────────── Building ─────────────────────────

  private buildBoard() {
    const plan: GroundPlan = {
      width: W,
      depth: D,
      // Yellow walkways along the line and to the panel.
      lanes: [
        { pts: [[-50, 2], [50, 2]], w: 2.2 },
        { pts: [[-44, 2], [-44, -14]], w: 1.8 },
      ],
      field: { x0: 0, z0: 0, x1: 0, z1: 0 },
      mud: [],
      hill: { x: 0, z: 0, rx: 0.01, rz: 0.01 },
      // A grey concrete floor with yellow walkways.
      tiles: { base: 'asphalt', hill: 'asphalt', lane: 'path', field: 'asphalt', mud: 'asphalt' },
      saturation: 0.7,
    };
    const top = groundMaterial(plan);
    const side = mat('#6a6f78', 0.8);
    const board = mesh(new THREE.BoxGeometry(W, 0.5, D), [side, side, top, side, side, side] as unknown as THREE.Material);
    board.position.y = -0.26;
    board.receiveShadow = true;
    board.castShadow = false;
    this.scenery.add(board);
  }

  /** The hall: walls with windows at the back and sides, pillars, ceiling lamps, the conveyor line, crates and barrels. */
  private buildHall() {
    const wall = mat('#c9c1b4', 0.85);
    const glass = mat('#9fd0e8', 0.2);
    const back = mesh(new THREE.BoxGeometry(W, 5, 0.6), wall);
    back.position.set(0, 2.5, -D / 2 + 0.3);
    this.scenery.add(back);
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
      const s = mesh(new THREE.BoxGeometry(0.6, 5, D), wall);
      s.position.set(x, 2.5, 0);
      this.scenery.add(s);
    }
    for (let x = -48; x <= 48; x += 8) {
      const win = mesh(new THREE.BoxGeometry(5, 2, 0.1), glass, false);
      win.position.set(x, 3, -D / 2 + 0.65);
      this.scenery.add(win);
    }
    for (let x = -40; x <= 40; x += 20) {
      for (const z of [-20, 14]) {
        const pillar = mesh(new THREE.BoxGeometry(0.8, 5, 0.8), mat('#e0b040', 0.6));
        pillar.position.set(x, 2.5, z);
        this.scenery.add(pillar);
      }
    }
    // Lamps hanging over the hall: dark till the main switch works.
    for (let x = -40; x <= 40; x += 16) {
      for (const z of [-26, -12, 6]) {
        const bulb = new THREE.MeshStandardMaterial({ color: '#f7f2dc', emissive: '#ffe9a8', emissiveIntensity: 0, roughness: 0.3 });
        const shade = mesh(new THREE.ConeGeometry(0.7, 0.5, 16, 1, true), mat('#3f86d6', 0.5));
        shade.position.set(x, 4.6, z);
        const b = mesh(new THREE.SphereGeometry(0.25, 12, 8), bulb, false);
        b.position.set(x, 4.35, z);
        const cord = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), mat('#2a2f3a', 0.6), false);
        cord.position.set(x, 5.6, z);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(255,235,170,0.9)'), transparent: true, depthWrite: false, opacity: 0 }));
        glow.scale.setScalar(3.2);
        glow.position.set(x, 4.2, z);
        this.lamps.push({ glow, bulb });
        this.scenery.add(shade, b, cord, glow);
      }
    }
    // The conveyor line the toys ride along.
    const belt = mesh(new THREE.BoxGeometry(84, 0.3, 1.4), mat('#3a3f4b', 0.7));
    belt.position.set(1, 0.35, LINE_Z);
    this.scenery.add(belt);
    for (let x = -40; x <= 42; x += 2) {
      const leg = mesh(new THREE.BoxGeometry(0.12, 0.35, 1.3), mat('#8a90a0', 0.4, 0.5), false);
      leg.position.set(x, 0.12, LINE_Z);
      this.scenery.add(leg);
    }
    // Crates, barrels and a pallet stack about the hall; steam from a pipe by the paint shop.
    for (const [x, z, s] of [[-50, -30, 1], [-48, -30, 0.8], [50, -30, 1.1], [48, -28, 0.9], [-50, 30, 1], [50, 30, 1], [-20, 30, 0.9], [30, 30, 1]] as const) this.scenery.add(crate(x, z, s));
    for (const [x, z] of [[-52, 10], [-52, 13], [52, 14], [-30, 32], [12, 32]] as const) this.scenery.add(barrel(x, z));
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(240,240,245,0.75)'), transparent: true, depthWrite: false, opacity: 0 }));
      s.userData.t = i / 8;
      this.steam.push(s);
      this.scenery.add(s);
    }
    const chimney = mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.5, 12), mat('#8a90a0', 0.4, 0.5));
    chimney.position.set(-4, 2.25, -14);
    this.scenery.add(chimney);
  }

  /** The poles, the panel, the press and the paint booth are part of the hall. */
  private placeParts() {
    for (const p of [PANEL_POLE, PRESS_POLE, TANK_POLE, BOOTH_POLE, ROBOT_POLE, PACK_POLE, LOAD_POLE]) this.poles.set(p, this.pin('pole', p));
    this.panel = this.pin('substation', PANEL) as Substation;
    this.press = this.pin('press', PRESS) as Press;
    this.booth = this.pin('paintBooth', BOOTH) as PaintBooth;
  }

  private buildCritters() {
    this.critter('foreman', { height: 1.6 }, v(PANEL.x - 1, PANEL.z + 5), 1.6, 0.4);
    const workers: [string, THREE.Vector3][] = [['worker', v(PRESS.x + 2, PRESS.z - 4)], ['worker2', v(TANK.x + 4, TANK.z - 4.5)], ['worker3', v(ROBOT.x + 3, ROBOT.z - 4)], ['worker4', v(PACKER.x + 3, PACKER.z - 3.5)]];
    for (const [name, at] of workers) this.critter(name, { height: 1.5 }, at, 1.5, 0.3);
    this.lorry = this.critter('lorry', { width: 5 }, LORRY, 2.2, Math.PI);
    this.lorry.roams = true;
    // A cat asleep on the crates (poke it).
    const cat = this.critter('cat', { height: 0.6 }, v(-49, -29.5), 0.6, 0.5);
    cat.base = 1.05;
  }

  private buildNeeds() {
    const get = (name: string) => this.critters.get(name)!;
    const add = (n: NeedSpec) => this.addNeed(n);
    const slot = (icon: PartKind, spot: THREE.Vector3) => ({ icon, kinds: [icon], spot });
    add({ critter: get('foreman'), phase: 'day', ask: 'breakerAsk', thanks: 'breakerHappy', icon: 'switch', kinds: ['switch'], spot: MAIN_SWITCH, focus: [PANEL.clone(), MAIN_SWITCH.clone(), PANEL_POLE.clone(), v(PANEL.x - 1, PANEL.z + 5)], met: () => this.lit, sticker: 'breaker' });
    add({ critter: get('worker'), phase: 'day', ask: 'pressAsk', thanks: 'pressHappy', icon: 'gearMotor', kinds: ['gearMotor'], spot: MOTOR, more: [slot('gear', SMALL_GEAR), slot('bigGear', BIG_GEAR)], focus: [PRESS.clone(), MOTOR.clone(), PRESS_POLE.clone()], met: () => this.press.stamps >= 3, sticker: 'press' });
    add({ critter: get('worker2'), phase: 'day', ask: 'paintAsk', thanks: 'paintHappy', icon: 'tank', kinds: ['tank'], spot: TANK, more: PIPES.map((p) => slot('pipe', p)), focus: [TANK.clone(), BOOTH.clone(), TANK_POLE.clone(), BOOTH_POLE.clone()], met: () => this.booth.painting, sticker: 'paint' });
    add({ critter: get('worker3'), phase: 'day', ask: 'robotAsk', thanks: 'robotHappy', icon: 'robotArm', kinds: ['robotArm'], spot: ROBOT, more: [slot('bulb', LAMP), slot('lightSensor', SENSOR)], met: () => ((this.on(ROBOT, ['robotArm']) as RobotArm | undefined)?.moves ?? 0) >= 2 && !!(this.on(SENSOR, ['lightSensor']) as LightSensor | undefined)?.closed, sticker: 'robot' });
    add({ critter: get('worker4'), phase: 'day', ask: 'packAsk', thanks: 'packHappy', icon: 'packer', kinds: ['packer'], spot: PACKER, more: [slot('switch', PACK_SWITCH)], met: () => ((this.on(PACKER, ['packer']) as Packer | undefined)?.boxes ?? 0) >= 2, sticker: 'packer' });
    add({ critter: this.lorry, phase: 'day', ask: 'loadAsk', thanks: 'loadHappy', icon: 'belt', kinds: ['belt'], spot: BELT_SPOT, more: [slot('switch', LOAD_SWITCH)], focus: [BELT_SPOT.clone(), LOAD_SWITCH.clone(), LORRY.clone()], met: () => this.loaded >= 3, sticker: 'lorry' });
  }

  private on(at: THREE.Vector3, kinds: PartKind[]): Part | undefined {
    return this.world.parts.find((p) => kinds.includes(p.kind) && p.root.position.distanceTo(at) < 0.8);
  }

  private working(at: THREE.Vector3, kinds: PartKind[]) {
    const p = this.on(at, kinds);
    return !!p && isActive(p);
  }

  /** How each station is wired: loops from its pole through its parts and back. */
  private loops(n: Need): [Part | undefined, (Part | undefined)[]][] {
    const pole = (at: THREE.Vector3) => this.poles.get(at);
    switch (n.critter.name) {
      case 'foreman': return [[pole(PANEL_POLE), [this.on(MAIN_SWITCH, ['switch']), this.panel]]];
      case 'worker': return [[pole(PRESS_POLE), [this.on(MOTOR, ['gearMotor'])]]];
      case 'worker2': return [[pole(TANK_POLE), [this.on(TANK, ['tank'])]], [pole(BOOTH_POLE), [this.booth]]];
      case 'worker3': return [[pole(ROBOT_POLE), [this.on(LAMP, ['bulb'])]], [pole(ROBOT_POLE), [this.on(SENSOR, ['lightSensor']), this.on(ROBOT, ['robotArm'])]]];
      case 'worker4': return [[pole(PACK_POLE), [this.on(PACK_SWITCH, ['switch']), this.on(PACKER, ['packer'])]]];
      case 'lorry': return [[pole(LOAD_POLE), [this.on(LOAD_SWITCH, ['switch']), this.on(BELT_SPOT, ['belt'])]]];
    }
    return [];
  }

  /** The next wire of this station's loops, then pressing its own switch or button (nobody else's). */
  protected extraHint(): Hint | null {
    const n = this.focused && !this.focused.done && this.isNow(this.focused) ? this.focused : this.current();
    if (!n) return null;
    // A pipe on its ring but turned across the line: a tap turns it back.
    for (const at of PIPES) {
      const pipe = this.on(at, ['pipe']) as Pipe | undefined;
      if (pipe && pipe.aim !== 0 && n.critter.name === 'worker2') return { type: 'tap', part: pipe, phrase: 'pipeTurn' };
    }
    const mine = new Set<Part>();
    for (const [src, parts] of this.loops(n)) {
      if (!src || parts.some((p) => !p)) continue;
      const h = this.chainHint(src, parts as Part[]);
      if (h) return h;
      mine.add(src);
      for (const p of parts) mine.add(p!);
    }
    for (const sw of mine) {
      if (sw.kind !== 'switch' && sw.kind !== 'button') continue;
      for (const el of sw.elements()) {
        if (el.kind !== 'switch' || el.closed) continue;
        const r = this.world.trial((e) => (e.id === el.id ? { ...e, closed: true } : e));
        if (r.shorted.size) continue;
        if ([...mine].some((p) => !activeAt(p.kind, p.state.level) && activeAt(p.kind, r.elements.get(p.id)?.level ?? 0)))
          return { type: 'tap', part: sw, phrase: sw.kind === 'button' ? 'holdButton' : 'tapSwitch' };
      }
    }
    const h = sandboxHint(this.world);
    if (!h) return null;
    const about = h.type === 'connect' ? [h.from.part, h.to.part] : h.type === 'drag' ? [] : [h.type === 'tapWire' ? h.at : h.part];
    return about.length && about.every((p) => p && mine.has(p)) ? h : null;
  }

  // ───────────────────────── Story ─────────────────────────

  protected phaseBegins(p: Phase) {
    if (p === 'done') this.hooks.say('factoryDone');
  }

  protected tick(dt: number) {
    // The hall's lights come on once the panel has power through the main switch.
    const lit = this.panel.live && !!this.on(MAIN_SWITCH, ['switch'])?.closed;
    if (lit && !this.lit) this.hooks.chime();
    this.lit = lit;
    this.lamps.forEach((l, i) => {
      const on = this.lit && this.phaseT * 3 > i * 0.15 ? 1 : 0;
      l.bulb.emissiveIntensity = THREE.MathUtils.damp(l.bulb.emissiveIntensity, on * 2.5, 6, dt);
      l.glow.material.opacity = THREE.MathUtils.damp(l.glow.material.opacity, on * 0.6, 6, dt);
    });
    // Steam from the pipe by the paint shop while the paint flows.
    for (const s of this.steam) {
      s.userData.t = (s.userData.t + dt * 0.3) % 1;
      const t = s.userData.t as number;
      s.position.set(-4 + Math.sin(t * 5 + s.id) * 0.4 * t, 4.6 + t * 3, -14);
      s.scale.setScalar(0.6 + t * 1.8);
      s.material.opacity = (this.booth.painting ? 0.7 : 0.25) * (1 - t);
    }
    this.updateLine(dt);
    this.updateLorry(dt);
  }

  /**
   * Each stroke of the press puts a toy on the line. It rides along to the
   * next station and waits there till that station works: the booth paints
   * it, the robot lifts it, the packer boxes it, the belt puts it on the lorry.
   */
  private updateLine(dt: number) {
    if (this.press.stamps > this.stampsSeen) {
      this.stampsSeen = this.press.stamps;
      if (this.toys.length < 8) {
        const m = toyMesh();
        m.position.set(PRESS.x + 0.4, 0.75, LINE_Z);
        this.scenery.add(m);
        this.toys.push({ m, x: PRESS.x + 0.4, stage: 1 });
      }
    }
    const works = [
      () => true,
      () => this.booth.painting,
      () => this.working(ROBOT, ['robotArm']),
      () => this.working(PACKER, ['packer']),
      () => !!(this.on(BELT_SPOT, ['belt']) as Belt | undefined) && Math.abs((this.on(BELT_SPOT, ['belt']) as Belt).speed) > 0.05,
      // The lorry takes every box the belt brings.
      () => true,
    ];
    // Front to back, so a toy waits behind the one ahead.
    const order = [...this.toys].sort((a, b) => b.x - a.x);
    let ahead = Infinity;
    for (const t of order) {
      const next = STATIONS[t.stage] ?? Infinity;
      const goal = Math.min(next, ahead - 1.2);
      if (t.x < goal) t.x = Math.min(goal, t.x + dt * 2);
      if (t.x >= next - 0.01 && t.stage < STATIONS.length && works[t.stage]?.()) {
        // Done at this station: what it does shows on the toy.
        t.stage++;
        dressToy(t.m, t.stage);
        this.hooks.chime();
        if (t.stage === STATIONS.length) {
          this.loaded++;
          t.m.removeFromParent();
        }
      }
      t.m.position.x = t.x;
      t.m.position.y = 0.75 + (t.stage >= 4 ? 0.1 : 0);
      ahead = t.x;
    }
    this.toys = this.toys.filter((t) => t.stage < STATIONS.length);
  }

  /** Loaded up, the lorry hoots and drives off out of the hall. */
  private updateLorry(dt: number) {
    if (this.needs.find((n) => n.critter === this.lorry)?.done) this.drivenOff = Math.min(1, this.drivenOff + dt * 0.15);
    const p = this.lorry.group.position;
    p.set(LORRY.x, 0, LORRY.z + this.drivenOff * 40);
    this.lorry.home.copy(p);
    this.lorry.group.visible = this.drivenOff < 1;
  }
}

// ───────────────────────── Stand-ins ─────────────────────────

/** A toy on the line: a plain stamped shape, then painted, then boxed with a bow. */
function toyMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.28, 14, 10), mat('#e8e4dc', 0.6));
  body.name = 'body';
  const ears = [-0.16, 0.16].map((x) => {
    const e = mesh(new THREE.SphereGeometry(0.1, 10, 8), mat('#e8e4dc', 0.6));
    e.position.set(x, 0.25, 0);
    e.name = 'ear';
    return e;
  });
  const box = mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), mat('#c9a27a', 0.8));
  box.name = 'box';
  box.visible = false;
  const bow = mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 14), mat('#d8483c', 0.4));
  bow.position.y = 0.34;
  bow.name = 'bow';
  bow.visible = false;
  g.add(body, ...ears, box, bow);
  return g;
}

/** What each station leaves on the toy: paint (2), a lift off the line (3), a box with a bow (4). */
function dressToy(g: THREE.Group, stage: number) {
  if (stage === 2) {
    const color = ['#ff5fa8', '#5fc8ff', '#ffd23f', '#7dff6b'][Math.floor(Math.random() * 4)];
    g.traverse((o) => (o.name === 'body' || o.name === 'ear') && ((o as THREE.Mesh).material = mat(color, 0.45)));
  }
  if (stage === 4) {
    g.traverse((o) => {
      if (o.name === 'box' || o.name === 'bow') o.visible = true;
      if (o.name === 'body' || o.name === 'ear') o.visible = false;
    });
  }
}

function crate(x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(1.6, 1, 1.6), mat('#c9945a', 0.8));
  box.position.y = 0.5;
  const band = mesh(new THREE.BoxGeometry(1.62, 0.12, 1.62), mat('#8a5a32', 0.8));
  band.position.y = 0.5;
  g.add(box, band);
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = x * 0.3;
  return g;
}

function barrel(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const b = mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), mat('#3f86d6', 0.5));
  b.position.y = 0.6;
  const rim = mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 18), mat('#2a3148', 0.5));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.2;
  g.add(b, rim);
  g.position.set(x, 0, z);
  return g;
}

/** A little person: body, head and a hard hat. */
function worker(body: string, hat: string, h = 1.3): THREE.Group {
  const g = new THREE.Group();
  const b = mesh(new THREE.CylinderGeometry(0.22 * h, 0.27 * h, 0.75 * h, 14), mat(body, 0.6));
  b.position.y = 0.38 * h;
  const head = mesh(new THREE.SphereGeometry(0.21 * h, 14, 10), mat('#f2d9a6', 0.7));
  head.position.y = 0.95 * h;
  const helmet = mesh(new THREE.SphereGeometry(0.24 * h, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat, 0.4));
  helmet.position.y = 1.0 * h;
  g.add(b, head, helmet);
  return g;
}

const STAND_INS: Record<string, () => THREE.Object3D> = {
  foreman: () => worker('#3f86d6', '#ffffff'),
  worker: () => worker('#ff8f2a', '#f2c230'),
  lorry: () => {
    const g = new THREE.Group();
    const cab = mesh(new THREE.BoxGeometry(1.5, 1.4, 1.8), mat('#d8483c', 0.4));
    cab.position.set(1.8, 0.95, 0);
    const back = mesh(new THREE.BoxGeometry(3.4, 1.7, 1.9), mat('#f4f1ea', 0.5));
    back.position.set(-0.6, 1.1, 0);
    g.add(cab, back);
    for (const [x, z] of [[-1.6, -0.95], [-1.6, 0.95], [1.8, -0.95], [1.8, 0.95]]) {
      const w = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), mat('#2a2f3a', 0.6));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.4, z);
      g.add(w);
    }
    return g;
  },
};
