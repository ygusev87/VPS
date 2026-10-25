// The city: a toy town round a park with a fountain, the step after the farm.
// Most helps here are chains of parts: the tram's substation behind a switch,
// the bakery's oven and a belt to carry the loaves, a fountain pump with a wind
// generator of its own (no pole in the park), grandma's lift on a button held
// while she rides; in the evening three street lamps for the kitten, a disco
// ball whose light starts the music through a light sensor, the fire engine
// and a pump at the burning house; at night dominoes on the raccoon's path
// that ring the alarm as it knocks them over; in the morning a laser beam
// round a mirror onto a light sensor rings the school bell.
import * as THREE from 'three';
import { sandboxHint, type Hint } from './hints';
import { clipsOf, hasModel, model, type Fit } from './parts/assets';
import type { Part, PartKind } from './parts/base';
import { Substation } from './parts/city';
import { Belt, Domino } from './parts/chain';
import { Pump } from './parts/farm';
import { FireTruck } from './parts/fun';
import { mat, mesh } from './parts/kit';
import { glowFor } from './parts/models';
import { Lift } from './parts/more';
import { flowers, groundMaterial, onLane, type GroundPlan } from './ground';
import { AMBIENT } from './parts/wind';
import { StoryMap, blob, boxHouse, instances, v, type Critter, type MapProgress, type Need, type NeedSpec, type Phase } from './storymap';
import { isActive } from './world';

/** Model files the city needs (each falls back to a stand-in until it is made). */
export const CITY_MODELS = ['pole', 'grandma-house', 'bakery', 'fire-station', 'school', 'toy-shop', 'club', 'house-a', 'house-b', 'house-c',
  'baker', 'grandma', 'child', 'kitten', 'raccoon', 'raccoon-rig', 'tram', 'car', 'fountain-basin', 'bench', 'street-lamp', 'bins', 'pigeon',
  'tree-oak', 'tree-pine', 'bush', 'flower-cluster'];

/** What the drawers offer in the city (power comes from the poles). */
export const CITY_TRAY: { kind: PartKind; count: number }[] = [
  { kind: 'trafficLight', count: 1 },
  { kind: 'switch', count: 1 },
  { kind: 'heater', count: 1 },
  { kind: 'belt', count: 1 },
  { kind: 'windGen', count: 1 },
  { kind: 'pump', count: 2 },
  { kind: 'lift', count: 1 },
  { kind: 'button', count: 1 },
  { kind: 'bulb', count: 3 },
  { kind: 'led', count: 3 },
  { kind: 'disco', count: 1 },
  { kind: 'lightSensor', count: 2 },
  { kind: 'musicbox', count: 1 },
  { kind: 'firetruck', count: 1 },
  { kind: 'domino', count: 1 },
  { kind: 'bell', count: 2 },
  { kind: 'laser', count: 1 },
  { kind: 'mirror', count: 1 },
];

/** Bumped whenever the city is laid out anew (a save on another layout starts it afresh). */
export const CITY_LAYOUT = 2;

export interface CityProgress extends MapProgress {
  /** Loaves the belt has brought to the counter. */
  bread: number;
  fountain: number;
  fire: number;
  raccoonChased: boolean;
}

const W = 150;
const D = 100;

// The town: a ring road round the park, roads out from its middle sides, a tram line along the south.
const RING = { x: 28, z: 18 };
const TRAM_Z = 38;
const ROAD = 6;
/** The crossing south of the park, where the cars wait for a traffic light. */
const CROSS = v(0, RING.z);
const LIGHT_SPOT = v(5.5, RING.z + 5.5);
const LIGHT_POLE = v(11, RING.z + 7);
/** The tram's substation by the line, and the switch that has to be in its circuit. */
const SUBSTATION = v(-34, TRAM_Z + 5.5);
const SUB_POLE = v(-28, TRAM_Z + 8);
const TRAM_SWITCH = v(-31.5, TRAM_Z + 9.5);
/** The bakery north of the park: the heater by the oven, the belt to the counter by the baker. */
const BAKERY = v(-14, -31);
const BAKER = v(-8.5, -24.5);
const OVEN_SPOT = v(-14, -24.2);
const BELT_SPOT = v(-11, -21.3);
const COUNTER = v(-7.4, -21.4);
const BAKERY_POLE = v(-16.5, -20);
/** The park's fountain in the middle; the pump's ring at the basin's edge, a wind generator beside it. */
const FOUNTAIN = v(0, 0);
const BASIN_R = 3.2;
const FOUNTAIN_SPOT = v(BASIN_R + 1.6, 1.2);
const WIND_SPOT = v(8.5, 4.5);
/** Grandma's house west of the ring: she waits on her balcony for the lift to bring her shopping up. */
const HOUSE = v(-50, -9);
const LIFT_SPOT = v(-44.6, -8.5);
const LIFT_BUTTON = v(-40.5, -9.5);
const BALCONY = v(LIFT_SPOT.x - 1.5, LIFT_SPOT.z - 0.25);
const BALCONY_TOP = 1.95;
const GRANDMA = v(BALCONY.x - 0.2, BALCONY.z);
/** Her basket of shopping, on the pavement by the lift till it rides up. */
const BASKET = v(LIFT_SPOT.x + 0.4, LIFT_SPOT.z + 2.2);
const HOUSE_POLE = v(-38.5, -5);
/** Evening: a kitten in the park, three street lamps on its way home across the road. */
const KITTEN = v(-17, 9.5);
const LAMPS = [v(-13.5, 11.5), v(-20.5, 13), v(-21.5, 24)];
const KITTEN_WAY = [KITTEN, v(-19.5, 12), v(-20, 22.5), v(-18, 25.3)];
const KITTEN_POLE = v(-16.5, 14);
/** The club east of the ring: the disco ball, a light sensor in its light, the music box behind it. */
const CLUB = v(51, -12);
const DISCO_SPOT = v(43, -9.5);
const CLUB_SENSOR = v(43, -7.4);
const MUSIC_SPOT = v(46.5, -7);
const CLUB_POLE = v(39, -7.5);
/** The fire station south-east, the house down the road with smoke coming out, a pump at its hydrant. */
const STATION = v(50, 13);
const ENGINE_SPOT = v(43, 9.5);
const STATION_POLE = v(39.5, 7.5);
const SMOKE_HOUSE = v(60, 27);
const HYDRANT_SPOT = v(56.5, 22.5);
const HYDRANT_POLE = v(52.5, 21.5);
/** Night: the raccoon's path from the corner of the board to the toy shop's bins, dominoes across it. */
const SHOP = v(50, -33);
const BINS = v(43.5, -27.5);
const DOMINO_SPOT = v(60, -38);
const RACCOON_PATH = [v(73, -47), v(66, -42), DOMINO_SPOT, v(52, -32.5), v(46, -28.5)];
const ALARM_SPOT = DOMINO_SPOT.clone().add(v(-1.5, 4.5));
const SHOP_POLE = DOMINO_SPOT.clone().add(v(3.5, 5.5));
const SHOPKEEPER = v(55, -26.5);
/**
 * Morning: the school north-east of the ring. A laser shines along the
 * school's side to a mirror, the mirror turns the beam onto a light sensor,
 * and the sensor rings the bell by the door.
 */
const SCHOOL = v(18, -32);
const LASER_SPOT = v(25, -30);
const MIRROR_SPOT = v(32, -30);
const SCHOOL_SENSOR = v(32, -24.5);
const SCHOOL_BELL = v(23.5, -25.5);
const SCHOOL_POLE = v(28.5, -26.5);
const SCHOOL_DOOR = v(18, -27.5);

const r2 = (n: number) => Math.round(n * 100) / 100;

export class CityMap extends StoryMap {
  protected readonly width = W;
  protected readonly depth = D;
  readonly layout = CITY_LAYOUT;
  protected readonly intro = 'cityIntro';
  readonly ownHints = true;
  private plan!: GroundPlan;
  /** The cars driving round the ring once the traffic light works (s: how far round). */
  private cars: { c: Critter; s: number }[] = [];
  private driving = false;
  private tram!: Critter;
  private tramX = -12;
  private tramV = 0;
  private substation!: Substation;
  /** The poles, by the place they stand at. */
  private poles = new Map<THREE.Vector3, Part>();
  /** Loaves brought to the counter; each one comes out of the warm oven and rides the belt there. */
  bread = 0;
  private loaves: { m: THREE.Object3D; s: number }[] = [];
  private baked = 0;
  private ovenT = 0;
  fountainLevel = 0;
  private spray: THREE.Sprite[] = [];
  /** Grandma's basket on the pavement, riding up in the lift, or up on her balcony. */
  private grandma: 'waiting' | 'riding' | 'home' = 'waiting';
  private basket!: THREE.Object3D;
  private liftWaitT = 0;
  /** The kitten on its way home along the lamps (0..1). */
  private kittenWalk = 0;
  /** The fire engine's and the pump's work: at 1 the smoke is out. */
  fire = 0;
  private smoke: THREE.Sprite[] = [];
  private raccoon!: Critter;
  private raccoonMixer: THREE.AnimationMixer | null = null;
  private raccoonWalk: THREE.AnimationAction | null = null;
  private raccoonT = -1;
  private raccoonRun = 0;
  private raccoonChased = false;
  private raccoonTipSaid = false;
  /** Seconds till the knocked-over dominoes stand up again (after the raccoon has run). */
  private dominoReset = -1;
  /** The children on their way into school once the bell rings. */
  private schooling = 0;

  protected build() {
    this.buildBoard();
    this.buildPlaces();
    this.placeParts();
    this.buildCritters();
    this.buildNeeds();
    this.sowFlowers();
    // A steady breeze for the park's wind generator.
    AMBIENT.strength = 0.55;
    AMBIENT.dir.set(-0.7, 0, 0.7).normalize();
  }

  protected cleanup() {
    AMBIENT.strength = 0;
  }

  protected saveExtra() {
    return { bread: r2(this.bread), fountain: r2(this.fountainLevel), fire: r2(this.fire), raccoonChased: this.raccoonChased };
  }

  protected restoreExtra(m: MapProgress) {
    const p = m as CityProgress;
    this.bread = this.baked = Math.round(p.bread);
    this.loaves.forEach((l, i) => (l.s = i < this.bread ? Infinity : -1));
    this.fountainLevel = p.fountain;
    this.fire = p.fire;
    this.raccoonChased = p.raccoonChased;
    const done = (name: string) => this.needs.some((n) => n.done && n.critter.name === name);
    this.driving = done('car');
    if (done('grandma')) this.settleGrandma();
    if (done('kitten')) this.kittenWalk = 1;
    if (done('child3')) this.schooling = 1;
    if (this.phase === 'night') this.raccoonT = 0;
  }

  protected critterModel(base: string, fit: Fit, name: string): THREE.Object3D {
    return (base === 'raccoon' ? model('raccoon-rig', fit) : null) ?? model(base, fit) ?? STAND_INS[base]?.() ?? blob(name);
  }

  // ───────────────────────── Building ─────────────────────────

  private buildBoard() {
    const plan = (this.plan = cityPlan());
    const top = groundMaterial(plan);
    const side = mat('#7a6a58', 0.8);
    const board = mesh(new THREE.BoxGeometry(W, 0.5, D), [side, side, top, side, side, side] as unknown as THREE.Material);
    board.position.y = -0.26;
    board.receiveShadow = true;
    board.castShadow = false;
    this.scenery.add(board);
    const rim = mesh(new THREE.BoxGeometry(W + 0.4, 0.4, D + 0.4), mat('#5e5246', 0.8));
    rim.position.y = -0.36;
    this.scenery.add(rim);
    this.scenery.add(roadMarks());
  }

  private buildPlaces() {
    const house = (name: string, at: THREE.Vector3, w: number, wall: string, roof: string, h = 3.2) =>
      this.add(name, { width: w, rotateY: -Math.PI / 2 }, at.x, at.z, () => boxHouse(wall, roof, w, h, w * 0.8));
    house('grandma-house', HOUSE, 5, '#f2c2a2', '#c84a3a', 4.2);
    house('bakery', BAKERY, 6, '#f6e3b8', '#d8483c');
    house('fire-station', STATION, 6.5, '#e05a4a', '#5a5f6a');
    house('school', SCHOOL, 8, '#f2d06b', '#3f86d6', 3.8);
    house('toy-shop', SHOP, 6, '#b7a6f0', '#ff8fb1');
    house('club', CLUB, 6.5, '#5aa6d6', '#f2c230');
    // Houses along the streets.
    const homes: [string, number, number, string, string][] = [
      ['house-a', -62, -32, '#a3d0f0', '#d8483c'], ['house-b', -36, -32, '#f6b0a0', '#3f86d6'], ['house-c', 34, -42, '#c8e6a0', '#c84a3a'],
      ['house-a', -62, 18, '#f2c230', '#5a5f6a'], ['house-b', -48, 22, '#a3d0f0', '#c84a3a'], ['house-c', 22, 28, '#f6e3b8', '#3f86d6'],
      ['house-a', 60, 27, '#e0e0e0', '#5a5f6a'], ['house-b', -18, 28, '#f6b0a0', '#2a6a3a'], ['house-c', 64, -8, '#f2d06b', '#c84a3a'],
    ];
    for (const [name, x, z, wall, roof] of homes) house(name, v(x, z), 4.5, wall, roof);
    // The balcony by the lift, as high as its cabin at the top, and grandma's basket of shopping.
    this.scenery.add(balcony(BALCONY));
    this.basket = this.add('basket', { width: 0.6 }, BASKET.x, BASKET.z, () => basket());
    // The fountain: a basin in the park with water thrown up from the middle.
    this.add('fountain-basin', { width: BASIN_R * 2 }, FOUNTAIN.x, FOUNTAIN.z, () => basin());
    for (let i = 0; i < 36; i++) {
      const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(120,200,255,0.95)'), transparent: true, depthWrite: false, opacity: 0 }));
      d.scale.setScalar(0.42);
      d.userData.t = i / 36;
      d.userData.a = (i * 2.4) % (Math.PI * 2);
      this.spray.push(d);
      this.scenery.add(d);
    }
    // The bakery's counter, and the loaves that come out of the oven one by one.
    this.add('counter', { width: 2 }, COUNTER.x, COUNTER.z, () => counter());
    for (let i = 0; i < 3; i++) {
      const loaf = mesh(new THREE.CapsuleGeometry(0.17, 0.32, 6, 12), mat('#c98a4b', 0.6));
      loaf.rotation.y = Math.PI / 2;
      loaf.rotation.z = Math.PI / 2;
      loaf.visible = false;
      this.loaves.push({ m: loaf, s: -1 });
      this.scenery.add(loaf);
    }
    this.add('hydrant', { height: 0.9 }, HYDRANT_SPOT.x + 1.8, HYDRANT_SPOT.z - 1.2, () => hydrant());
    // Smoke from the house down the road.
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(120,120,130,0.85)'), transparent: true, depthWrite: false, opacity: 0 }));
      s.userData.t = i / 14;
      this.smoke.push(s);
      this.scenery.add(s);
    }
    this.add('bins', { width: 2 }, BINS.x, BINS.z, () => bins());
    // Benches and lamps round the park, trees in it and at the edges.
    for (const [x, z, r] of [[-10, -12, 0], [10, -12, 0], [-21, 0, Math.PI / 2], [21, 0, -Math.PI / 2]]) this.add('bench', { width: 1.8 }, x, z, () => bench(), r);
    const lamps: [number, number, number][] = [-24, -12, 0, 12, 24].flatMap((x) => [[x, -RING.z + 4.2, 1] as [number, number, number], [x, RING.z - 4.2, 1] as [number, number, number]]);
    const streetLamps = instances('street-lamp', { height: 3 }, lamps);
    if (streetLamps) this.scenery.add(streetLamps);
    const green = greenery(this.plan);
    for (const [name, fit, items] of [
      ['tree-oak', { height: 3 }, green.trees],
      ['bush', { width: 1.8 }, green.bushes],
    ] as const) {
      const g = instances(name, fit, items);
      if (g) this.scenery.add(g);
    }
  }

  /** A pole by every place, and the tram's substation: parts of the map. */
  private placeParts() {
    for (const p of [LIGHT_POLE, SUB_POLE, BAKERY_POLE, HOUSE_POLE, KITTEN_POLE, CLUB_POLE, STATION_POLE, HYDRANT_POLE, SHOP_POLE, SCHOOL_POLE]) this.poles.set(p, this.pin('pole', p));
    this.substation = this.pin('substation', SUBSTATION) as Substation;
  }

  private buildCritters() {
    // Three cars wait at the crossing south of the park; the first one speaks for them.
    ['car', 'car2', 'car3'].forEach((name, i) => {
      const c = this.critter(name, { width: 2.4 }, v(CROSS.x + 1.5, CROSS.z + 4 + i * 3.2), 1.3, Math.PI / 2);
      c.roams = true;
      this.cars.push({ c, s: 0 });
    });
    this.tram = this.critter('tram', { width: 7 }, v(this.tramX, TRAM_Z), 2.4, 0);
    this.tram.roams = true;
    // The model faces +x: turned to face the camera.
    this.critter('baker', { height: 1.6 }, BAKER, 1.6, -Math.PI / 2 + 0.3);
    this.critter('pigeon', { height: 0.5 }, v(FOUNTAIN.x - 2.2, FOUNTAIN.z + 3.2), 0.5, 0.5);
    this.critter('pigeon2', { height: 0.45 }, v(FOUNTAIN.x - 3.4, FOUNTAIN.z + 2.4), 0.45, -0.4);
    const grandma = this.critter('grandma', { height: 1.5 }, GRANDMA, 1.5, 0.4);
    grandma.base = BALCONY_TOP;
    this.critter('kitten', { height: 0.75 }, KITTEN, 0.75, -0.6);
    this.critter('child', { height: 1.2 }, v(CLUB.x - 5, CLUB.z + 7.5), 1.2, 0.3);
    this.critter('child2', { height: 1.15 }, v(CLUB.x - 3.5, CLUB.z + 8), 1.15, -0.3);
    this.critter('firefighter', { height: 1.6 }, v(STATION.x - 4.5, STATION.z - 4.5), 1.6, 0.4);
    this.critter('shopkeeper', { height: 1.6 }, SHOPKEEPER, 1.6, 0);
    ['child3', 'child4', 'child5'].forEach((name, i) => this.critter(name, { height: 1.15 }, v(SCHOOL_DOOR.x - 3 + i * 1.6, SCHOOL_DOOR.z + 4), 1.15, i - 1));
    this.raccoon = this.critter('raccoon', { width: 1.4 }, RACCOON_PATH[0], 0.9, 0);
    this.raccoon.group.visible = false;
    this.raccoon.roams = true;
    this.raccoon.mute = true;
    const walk = clipsOf('raccoon-rig')[0];
    if (walk && hasModel('raccoon-rig')) {
      this.raccoonMixer = new THREE.AnimationMixer(this.raccoon.group);
      this.raccoonWalk = this.raccoonMixer.clipAction(walk).play();
    }
  }

  private buildNeeds() {
    const get = (name: string) => this.critters.get(name)!;
    const add = (n: NeedSpec) => this.addNeed(n);
    const lit = (at: THREE.Vector3) => { const p = this.on(at, ['bulb', 'led']); return !!p && isActive(p); };
    // Day: a traffic light to start with, then chains of two parts.
    add({ critter: get('car'), phase: 'day', ask: 'carsAsk', thanks: 'carsHappy', icon: 'trafficLight', kinds: ['trafficLight'], spot: LIGHT_SPOT, met: () => this.working(LIGHT_SPOT, ['trafficLight']) });
    add({ critter: this.tram, phase: 'day', ask: 'tramAsk', thanks: 'tramHappy', icon: 'switch', kinds: ['switch'], spot: TRAM_SWITCH, focus: [SUBSTATION.clone(), TRAM_SWITCH.clone(), v(this.tramX, TRAM_Z)], met: () => this.substation.live && !!this.on(TRAM_SWITCH, ['switch'])?.closed });
    add({ critter: get('baker'), phase: 'day', ask: 'bakerAsk', thanks: 'bakerHappy', icon: 'heater', kinds: ['heater'], spot: OVEN_SPOT, more: [{ icon: 'belt', kinds: ['belt'], spot: BELT_SPOT }], focus: [BAKER.clone(), OVEN_SPOT.clone(), COUNTER.clone()], met: () => this.bread >= 3 });
    add({ critter: get('pigeon'), phase: 'day', ask: 'pigeonsAsk', thanks: 'pigeonsHappy', icon: 'pump', kinds: ['pump'], spot: FOUNTAIN_SPOT, more: [{ icon: 'windGen', kinds: ['windGen'], spot: WIND_SPOT }], met: () => this.fountainLevel > 0.95 });
    add({ critter: get('grandma'), phase: 'day', ask: 'grandmaAsk', thanks: 'grandmaHappy', icon: 'lift', kinds: ['lift'], spot: LIFT_SPOT, more: [{ icon: 'button', kinds: ['button'], spot: LIFT_BUTTON }], met: () => this.grandma === 'home' });
    // Evening.
    add({ critter: get('kitten'), phase: 'evening', ask: 'kittenDark', thanks: 'kittenHome', icon: 'bulb', kinds: ['bulb', 'led'], spot: LAMPS[0], more: LAMPS.slice(1).map((spot) => ({ icon: 'bulb' as PartKind, kinds: ['bulb', 'led'] as PartKind[], spot })), met: () => LAMPS.every(lit) });
    add({ critter: get('child'), phase: 'evening', ask: 'clubAsk', thanks: 'clubHappy', icon: 'disco', kinds: ['disco'], spot: DISCO_SPOT, more: [{ icon: 'lightSensor', kinds: ['lightSensor'], spot: CLUB_SENSOR }, { icon: 'musicbox', kinds: ['musicbox'], spot: MUSIC_SPOT }], met: () => this.working(MUSIC_SPOT, ['musicbox']) && !!this.on(CLUB_SENSOR, ['lightSensor'])?.closed });
    add({ critter: get('firefighter'), phase: 'evening', ask: 'fireAsk', thanks: 'fireHappy', icon: 'firetruck', kinds: ['firetruck'], spot: ENGINE_SPOT, more: [{ icon: 'pump', kinds: ['pump'], spot: HYDRANT_SPOT }], focus: [STATION.clone().add(v(-4.5, -4.5)), ENGINE_SPOT.clone(), HYDRANT_SPOT.clone(), SMOKE_HOUSE.clone()], met: () => this.fire >= 1 });
    // Night: dominoes on the raccoon's path, and the alarm bell they switch on.
    add({ critter: get('shopkeeper'), phase: 'night', ask: 'raccoonTip', thanks: 'raccoonScared', icon: 'domino', kinds: ['domino'], hintPhrase: 'raccoonTip', spot: DOMINO_SPOT.clone(), more: [{ icon: 'bell', kinds: ['bell'], spot: ALARM_SPOT.clone() }], focus: [SHOPKEEPER.clone(), DOMINO_SPOT.clone(), ALARM_SPOT.clone()], met: () => this.raccoonChased, sticker: 'raccoon' });
    // Morning: the school bell, rung by a laser beam.
    add({ critter: get('child3'), phase: 'morning', ask: 'schoolAsk', thanks: 'schoolHappy', icon: 'laser', kinds: ['laser'], spot: LASER_SPOT, more: [{ icon: 'mirror', kinds: ['mirror'], spot: MIRROR_SPOT }, { icon: 'lightSensor', kinds: ['lightSensor'], spot: SCHOOL_SENSOR }, { icon: 'bell', kinds: ['bell'], spot: SCHOOL_BELL }], focus: [SCHOOL_DOOR.clone(), LASER_SPOT.clone(), MIRROR_SPOT.clone(), SCHOOL_SENSOR.clone(), SCHOOL_BELL.clone()], met: () => this.working(SCHOOL_BELL, ['bell']) && !!this.on(SCHOOL_SENSOR, ['lightSensor'])?.closed, sticker: 'school' });
  }

  /** The part of these kinds standing on a ring. */
  private on(at: THREE.Vector3, kinds: PartKind[]): Part | undefined {
    return this.world.parts.find((p) => kinds.includes(p.kind) && p.root.position.distanceTo(at) < 0.8);
  }

  private working(at: THREE.Vector3, kinds: PartKind[]) {
    const p = this.on(at, kinds);
    return !!p && isActive(p);
  }

  /**
   * How each need is wired: loops from a power source through its parts and
   * back (a missing part leaves its loop out; the rings ask for it first).
   */
  private loops(n: Need): [Part | undefined, (Part | undefined)[]][] {
    const pole = (at: THREE.Vector3) => this.poles.get(at);
    switch (n.critter.name) {
      case 'car': return [[pole(LIGHT_POLE), [this.on(LIGHT_SPOT, ['trafficLight'])]]];
      case 'tram': return [[pole(SUB_POLE), [this.on(TRAM_SWITCH, ['switch']), this.substation]]];
      case 'baker': return [[pole(BAKERY_POLE), [this.on(OVEN_SPOT, ['heater'])]], [pole(BAKERY_POLE), [this.on(BELT_SPOT, ['belt'])]]];
      case 'pigeon': return [[this.on(WIND_SPOT, ['windGen']), [this.on(FOUNTAIN_SPOT, ['pump'])]]];
      case 'grandma': return [[pole(HOUSE_POLE), [this.on(LIFT_BUTTON, ['button']), this.on(LIFT_SPOT, ['lift'])]]];
      case 'kitten': return LAMPS.map((at) => [pole(KITTEN_POLE), [this.on(at, ['bulb', 'led'])]]);
      case 'child': return [[pole(CLUB_POLE), [this.on(DISCO_SPOT, ['disco'])]], [pole(CLUB_POLE), [this.on(CLUB_SENSOR, ['lightSensor']), this.on(MUSIC_SPOT, ['musicbox'])]]];
      case 'firefighter': return [[pole(STATION_POLE), [this.on(ENGINE_SPOT, ['firetruck'])]], [pole(HYDRANT_POLE), [this.on(HYDRANT_SPOT, ['pump'])]]];
      case 'shopkeeper': return [[pole(SHOP_POLE), [this.on(DOMINO_SPOT, ['domino']), this.on(ALARM_SPOT, ['bell'])]]];
      case 'child3': return [[pole(SCHOOL_POLE), [this.on(LASER_SPOT, ['laser'])]], [pole(SCHOOL_POLE), [this.on(SCHOOL_SENSOR, ['lightSensor']), this.on(SCHOOL_BELL, ['bell'])]]];
    }
    return [];
  }

  /** Flowers in the park and along the pavements, kept off the rings, the people and the poles. */
  private sowFlowers() {
    const taken = [...this.needs.flatMap((n) => [n.spot, ...n.more.map((m) => m.spot)]), ...[...this.critters.values()].map((c) => c.home), ...this.world.parts.map((p) => p.root.position)];
    const f = this.plan.field;
    const free = (x: number, z: number) =>
      x > f.x0 + 1 && x < f.x1 - 1 && z > f.z0 + 1 && z < f.z1 - 1 && Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) > BASIN_R + 2 && !onLane(this.plan, x, z, 0.8) && taken.every((t) => Math.hypot(x - t.x, z - t.z) > 2.6);
    const spots: [number, number, number][] = [];
    for (let tries = 0; spots.length < 40 && tries < 3000; tries++) {
      const x = f.x0 + Math.random() * (f.x1 - f.x0);
      const z = f.z0 + Math.random() * (f.z1 - f.z0);
      if (free(x, z) && spots.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 2)) spots.push([x, z, 0.8 + Math.random() * 0.45]);
    }
    this.scenery.add(instances('flower-cluster', { height: 0.45 }, spots) ?? flowers(this.plan, 50, free));
  }

  // ───────────────────────── Story ─────────────────────────

  protected phaseBegins(p: Phase) {
    if (p === 'evening') this.hooks.say('cityEvening');
    if (p === 'night') {
      this.raccoonT = 0;
      if (!this.raccoonChased) this.hooks.say('raccoonComes');
    }
    if (p === 'morning') this.hooks.say('schoolAsk');
    if (p === 'done') this.hooks.say('cityDone');
  }

  protected helpedNeed(n: Need) {
    if (n.critter.name === 'car') this.driving = true;
  }

  protected tapped(c: Critter) {
    if (c !== this.raccoon) return false;
    this.hooks.say('raccoonTip');
    return true;
  }

  /**
   * Every part of the chain is on its ring: the next wire of its loops, then
   * the general hints (press the switch, turn the laser), but only about the
   * parts of this need — not grandma's button again while the kitten waits.
   */
  protected extraHint(): Hint | null {
    const n = this.focused && !this.focused.done && this.isNow(this.focused) ? this.focused : this.current();
    if (!n) return null;
    const mine = new Set<Part>();
    for (const [src, parts] of this.loops(n)) {
      if (!src || parts.some((p) => !p)) continue;
      const h = this.chainHint(src, parts as Part[]);
      if (h) return h;
      mine.add(src);
      for (const p of parts) mine.add(p!);
    }
    for (const p of this.world.parts) if (p.kind === 'mirror' && n.more.some((s) => s.kinds.includes('mirror') && p.root.position.distanceTo(s.spot) < 0.8)) mine.add(p);
    const h = sandboxHint(this.world);
    if (!h) return null;
    // The dominoes are for the raccoon to knock over.
    if (h.type === 'tap' && h.part.kind === 'domino') return null;
    const about = h.type === 'connect' ? [h.from.part, h.to.part] : h.type === 'drag' ? [] : [h.type === 'tapWire' ? h.at : h.part];
    return about.length && about.every((p) => p && mine.has(p)) ? h : null;
  }

  protected tick(dt: number) {
    this.updateCars(dt);
    this.updateTram(dt);
    this.updateBakery(dt);
    // The fountain plays while a pump pours into its basin.
    const pouring = this.world.parts.some((p) => p instanceof Pump && p.pumping && p.root.position.distanceTo(FOUNTAIN) < BASIN_R + 2.6);
    this.fountainLevel = Math.min(1, Math.max(0, this.fountainLevel + dt * (pouring ? 0.35 : -0.2)));
    for (const d of this.spray) {
      d.userData.t = (d.userData.t + dt * 0.9) % 1;
      const t = d.userData.t as number;
      const r = t * 1.6 * this.fountainLevel;
      d.position.set(FOUNTAIN.x + Math.cos(d.userData.a) * r, 0.6 + this.fountainLevel * 2.6 * 4 * t * (1 - t), FOUNTAIN.z + Math.sin(d.userData.a) * r);
      d.material.opacity = this.fountainLevel * (1 - t * 0.6) * 0.9;
    }
    this.updateGrandma(dt);
    // The engine out with its siren and the pump at the hydrant put the fire out; the smoke rises till then (from the evening on).
    const engine = this.world.parts.some((p) => p instanceof FireTruck && p.powered && p.root.position.distanceTo(ENGINE_SPOT) < 1.5);
    const hose = this.world.parts.some((p) => p instanceof Pump && p.pumping && p.root.position.distanceTo(HYDRANT_SPOT) < 1.5);
    if (engine && hose && this.phase === 'evening') this.fire = Math.min(1, this.fire + dt * 0.2);
    const burning = (this.phase === 'evening' || (this.phase === 'night' && this.fire < 1)) && this.fire < 1;
    for (const s of this.smoke) {
      s.userData.t = (s.userData.t + dt * 0.25) % 1;
      const t = s.userData.t as number;
      s.position.set(SMOKE_HOUSE.x + Math.sin(t * 5 + s.id) * 0.6 * t, 3.2 + t * 4, SMOKE_HOUSE.z);
      s.scale.setScalar(0.8 + t * 2);
      s.material.opacity = burning ? (1 - t) * 0.7 * (1 - this.fire) : 0;
    }
    this.updateKitten(dt);
    this.updateRaccoon(dt);
    this.updateSchool(dt);
  }

  /**
   * While the heater warms the oven a loaf comes out every few seconds (three
   * in all); a running belt carries each one from the oven to the counter.
   */
  private updateBakery(dt: number) {
    const baking = this.working(OVEN_SPOT, ['heater']);
    if (baking && this.baked < 3) {
      this.ovenT += dt;
      // The next loaf comes out once the one before has left the oven.
      if (this.ovenT > 2.5 && !this.loaves.some((l) => l.s >= 0 && l.s < 1.2)) {
        this.ovenT = 0;
        this.loaves[this.baked++].s = 0;
        this.hooks.chime();
      }
    }
    const belt = this.on(BELT_SPOT, ['belt']) as Belt | undefined;
    const running = !!belt && Math.abs(belt.speed) > 0.05;
    const way = belt ? loafWay(belt) : [OVEN_SPOT, OVEN_SPOT];
    const len = pathLength(way);
    for (const l of this.loaves) {
      l.m.visible = l.s >= 0;
      if (l.s < 0) continue;
      if (l.s !== Infinity && running) l.s += dt * 1.4;
      // Without a belt a loaf waits by the oven.
      if (l.s !== Infinity && belt && len > 0 && l.s >= len) {
        l.s = Infinity;
        this.bread = this.loaves.filter((x) => x.s === Infinity).length;
        this.hooks.chime();
      }
      if (l.s === Infinity) {
        const i = this.loaves.indexOf(l);
        l.m.position.set(COUNTER.x - 0.5 + i * 0.5, 0.92, COUNTER.z);
      } else l.m.position.copy(pathAt(way, l.s).at).setY(l.s < 0.6 ? 0.55 : 0.62);
    }
  }

  /** Once all three lamps are lit the kitten walks home along them, across the road. */
  private updateKitten(dt: number) {
    const c = this.critters.get('kitten')!;
    if (this.needs.find((n) => n.critter === c)?.done) this.kittenWalk = Math.min(1, this.kittenWalk + dt * 0.12);
    if (this.kittenWalk <= 0) return;
    const len = pathLength(KITTEN_WAY);
    const { at, dir } = pathAt(KITTEN_WAY, this.kittenWalk * len);
    c.group.position.x = at.x;
    c.group.position.z = at.z;
    c.home.copy(at);
    if (this.kittenWalk < 1) c.group.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
  }

  /** Round the ring road, keeping to the right, once the light works; waiting at the crossing before that. */
  private updateCars(dt: number) {
    const perimeter = 4 * (RING.x + RING.z);
    this.cars.forEach((car, i) => {
      const p = car.c.group.position;
      if (!this.driving) return;
      car.s = (car.s + dt * 5) % perimeter;
      // Each car starts from the crossing, spaced out round the ring.
      const { at, dir } = ringAt((car.s + i * (perimeter / 3)) % perimeter);
      p.lerp(at, Math.min(1, dt * 4));
      car.c.group.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
      car.c.home.copy(p);
    });
  }

  /** Up and down the line while the substation has power; braking to a stop without it. */
  private updateTram(dt: number) {
    const goal = this.substation?.live ? 3.5 * Math.sign(this.tramV || 1) : 0;
    this.tramV = THREE.MathUtils.damp(this.tramV, goal, 1.5, dt);
    this.tramX += this.tramV * dt;
    if (this.tramX > W / 2 - 12) this.tramV = -Math.abs(this.tramV) || -0.01;
    if (this.tramX < -W / 2 + 12) this.tramV = Math.abs(this.tramV) || 0.01;
    this.tram.group.position.set(this.tramX, 0.06, TRAM_Z);
    this.tram.home.copy(this.tram.group.position);
  }

  /** The basket goes into the lift's cabin at the bottom, rides up, and grandma takes it in on her balcony. */
  private updateGrandma(dt: number) {
    const lift = this.world.parts.find((p): p is Lift => p instanceof Lift && p.root.position.distanceTo(LIFT_SPOT) < 0.8);
    if (this.grandma === 'home') return;
    if (this.grandma === 'waiting') {
      // In it goes while the cabin is down by the pavement (even if it has just started up).
      if (!lift || this.phase !== 'day' || lift.cabinFloor(new THREE.Vector3()).y > 0.7) return;
      this.grandma = 'riding';
      lift.driver = false;
      this.liftWaitT = 0;
      return;
    }
    if (!lift) {
      // The lift was taken away: the basket is back on the pavement.
      this.grandma = 'waiting';
      this.basket.position.set(BASKET.x, 0, BASKET.z);
      return;
    }
    this.basket.position.copy(lift.cabinFloor(new THREE.Vector3()));
    if (lift.end === 'top') {
      lift.driver = true;
      this.settleGrandma();
      return;
    }
    // Still at the bottom with the current driving it down: the wires want swapping.
    this.liftWaitT = lift.end === 'bottom' && lift.state.level < -0.15 ? this.liftWaitT + dt : 0;
    if (this.liftWaitT > 2.5) {
      this.liftWaitT = -20;
      this.hooks.say('liftWrongWay');
    }
  }

  private settleGrandma() {
    this.grandma = 'home';
    this.basket.position.set(BALCONY.x + 0.4, BALCONY_TOP, BALCONY.z + 0.1);
    this.critters.get('grandma')!.hop = 1;
  }

  /** Sneaks to the bins; it knocks over the dominoes on its path, they switch the alarm bell on, and it runs. */
  private updateRaccoon(dt: number) {
    const r = this.raccoon;
    // The raccoon is gone: the dominoes stand up again and the bell stops.
    if (this.dominoReset > 0) {
      this.dominoReset -= dt;
      const d = this.on(DOMINO_SPOT, ['domino']) as Domino | undefined;
      if (this.dominoReset <= 0 && d && !d.standing) d.tap();
    }
    if (this.phase !== 'night' || (this.raccoonChased && this.raccoonRun === 0)) {
      r.group.visible = false;
      return;
    }
    if (this.raccoonT < 0) {
      r.group.visible = false;
      this.raccoonT = Math.min(0, this.raccoonT + dt);
      if (this.raccoonT < 0) return;
    }
    r.group.visible = true;
    r.mood = 'asking';
    this.raccoonT += dt;
    const len = pathLength(RACCOON_PATH);
    const scared = this.raccoonRun > 0;
    let s = scared ? this.raccoonRun : Math.min(this.raccoonT * 1.2, len);
    if (scared) {
      this.raccoonRun = Math.max(0, this.raccoonRun - dt * 4.5);
      s = this.raccoonRun;
      if (this.raccoonRun === 0) {
        r.group.visible = false;
        return;
      }
    }
    const { at, dir } = pathAt(RACCOON_PATH, s);
    r.group.position.copy(at);
    r.group.rotation.y = Math.atan2(scared ? -dir.x : dir.x, scared ? -dir.z : dir.z) - Math.PI / 2;
    r.home.copy(at);
    if (this.raccoonMixer && this.raccoonWalk) {
      this.raccoonWalk.timeScale = scared ? 7 : s < len ? 3 : 0;
      this.raccoonMixer.update(dt);
    }
    if (scared) return;
    // Its paws knock over the first domino.
    for (const p of this.world.parts) if (p instanceof Domino && p.windPoint().distanceTo(at) < 1.6) p.push();
    const ringing = this.working(ALARM_SPOT, ['bell']);
    if (ringing && s > 3) {
      this.raccoonRun = s;
      this.raccoonChased = true;
      this.dominoReset = 4;
      this.hooks.look?.(at.clone());
      return;
    }
    // At the bins with no alarm: rummage a moment, then slink off and come back.
    if (s >= len && this.raccoonT > len / 1.2 + 3) {
      if (!this.raccoonTipSaid) {
        this.raccoonTipSaid = true;
        this.hooks.say('raccoonTip');
      }
      this.raccoonT = -6;
    }
  }

  /** Once the morning bell rings the children run in at the school door. */
  private updateSchool(dt: number) {
    const need = this.needs.find((n) => n.critter.name === 'child3');
    if (need?.done) this.schooling = Math.min(1, this.schooling + dt * 0.5);
    ['child3', 'child4', 'child5'].forEach((name, i) => {
      const c = this.critters.get(name)!;
      if (this.schooling <= 0) return;
      const from = v(SCHOOL_DOOR.x - 3 + i * 1.6, SCHOOL_DOOR.z + 4);
      const p = from.lerp(SCHOOL_DOOR, Math.min(1, this.schooling * 1.2 - i * 0.1));
      c.group.position.x = p.x;
      c.group.position.z = p.z;
      c.home.copy(p);
      c.group.visible = this.schooling < 0.95 || i === 0;
    });
  }
}

// ───────────────────────── Paths ─────────────────────────

/** A point going round the ring road (on its outer lane, anticlockwise from the crossing south of the park). */
function ringAt(s: number): { at: THREE.Vector3; dir: THREE.Vector3 } {
  const x = RING.x + 1.5;
  const z = RING.z + 1.5;
  const corners = [v(0, z), v(x, z), v(x, -z), v(-x, -z), v(-x, z), v(0, z)];
  return pathAt(corners, s % pathLength(corners));
}

/** A loaf's way: out of the oven onto the belt's near end, along it, and off onto the counter. */
function loafWay(belt: Belt): THREE.Vector3[] {
  const s = belt.surface();
  const z = (s.z0 + s.z1) / 2;
  const [from, to] = belt.speed < 0 ? [s.x1 - 0.2, s.x0 + 0.2] : [s.x0 + 0.2, s.x1 - 0.2];
  return [OVEN_SPOT.clone().add(v(0, 0.6)), v(from, z), v(to, z), COUNTER.clone()];
}

function pathLength(pts: THREE.Vector3[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += pts[i].distanceTo(pts[i - 1]);
  return l;
}

function pathAt(pts: THREE.Vector3[], s: number): { at: THREE.Vector3; dir: THREE.Vector3 } {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = a.distanceTo(b);
    if (s <= len || i === pts.length - 1) return { at: a.clone().lerp(b, Math.min(1, Math.max(0, s / len))), dir: b.clone().sub(a).normalize() };
    s -= len;
  }
  return { at: pts[0].clone(), dir: v(1, 0) };
}

// ───────────────────────── Ground ─────────────────────────

/** Paving everywhere, asphalt roads (the ring, the roads out of it, the tram line), grass in the park. */
function cityPlan(): GroundPlan {
  const ring: [number, number][] = [[-RING.x, -RING.z], [RING.x, -RING.z], [RING.x, RING.z], [-RING.x, RING.z], [-RING.x, -RING.z]];
  return {
    width: W,
    depth: D,
    lanes: [
      { pts: ring, w: ROAD },
      { pts: [[0, -RING.z], [0, -D / 2]], w: ROAD },
      { pts: [[0, RING.z], [0, D / 2]], w: ROAD },
      { pts: [[-RING.x, 0], [-W / 2, 0]], w: ROAD },
      { pts: [[RING.x, 0], [W / 2, 0]], w: ROAD },
      { pts: [[-W / 2, TRAM_Z], [W / 2, TRAM_Z]], w: 4 },
    ],
    field: { x0: -RING.x + ROAD / 2 + 1.5, z0: -RING.z + ROAD / 2 + 1.5, x1: RING.x - ROAD / 2 - 1.5, z1: RING.z - ROAD / 2 - 1.5 },
    mud: [],
    hill: { x: 0, z: 0, rx: 0.01, rz: 0.01 },
    tiles: { base: 'paving', hill: 'paving', lane: 'asphalt', field: 'grass', mud: 'grass' },
  };
}

/** White dashes down the middle of every road, zebras at the crossings, rails on the tram line. */
function roadMarks(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.85, depthWrite: false });
  const dashes: THREE.Matrix4[] = [];
  const dash = (x: number, z: number, along: 'x' | 'z', w = 1.2, d = 0.18) => dashes.push(new THREE.Matrix4().compose(v(x, z).setY(0.02), new THREE.Quaternion(), along === 'x' ? new THREE.Vector3(w, 1, d) : new THREE.Vector3(d, 1, w)));
  for (let x = -RING.x + 3; x < RING.x - 2; x += 3) {
    dash(x, -RING.z, 'x');
    dash(x, RING.z, 'x');
  }
  for (let z = -RING.z + 3; z < RING.z - 2; z += 3) {
    dash(-RING.x, z, 'z');
    dash(RING.x, z, 'z');
  }
  for (let x = RING.x + 4; x < W / 2 - 1; x += 3) {
    dash(x, 0, 'x');
    dash(-x, 0, 'x');
  }
  for (let z = RING.z + 4; z < D / 2 - 1; z += 3) {
    dash(0, z, 'z');
    dash(0, -z, 'z');
  }
  // Zebras where the roads leave the ring.
  for (const [x, z, along] of [[0, RING.z + ROAD / 2 + 1.6, 'x'], [0, -RING.z - ROAD / 2 - 1.6, 'x'], [RING.x + ROAD / 2 + 1.6, 0, 'z'], [-RING.x - ROAD / 2 - 1.6, 0, 'z']] as const)
    for (let k = -2; k <= 2; k++) along === 'x' ? dash(x + k * 1.1, z, 'z', 2.2, 0.55) : dash(x, z + k * 1.1, 'x', 2.2, 0.55);
  const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(quad, white, dashes.length);
  dashes.forEach((m, i) => im.setMatrixAt(i, m));
  im.renderOrder = 2;
  g.add(im);
  // Rails along the tram line.
  for (const dz of [-0.75, 0.75]) {
    const rail = mesh(new THREE.BoxGeometry(W, 0.06, 0.12), mat('#9aa0a8', 0.3, 0.8), false);
    rail.position.set(0, 0.03, TRAM_Z + dz);
    g.add(rail);
  }
  return g;
}

/** Trees round the board's edge and in the park's corners, bushes between; off the roads and places. */
function greenery(plan: GroundPlan) {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const busy = [HOUSE, BAKERY, STATION, SCHOOL, SHOP, CLUB, SUBSTATION, SMOKE_HOUSE, BINS, ...RACCOON_PATH, ...LAMPS, ...KITTEN_WAY, LIFT_SPOT, LIFT_BUTTON, OVEN_SPOT, BELT_SPOT, COUNTER, LIGHT_SPOT, TRAM_SWITCH, DISCO_SPOT, CLUB_SENSOR, MUSIC_SPOT, ENGINE_SPOT, HYDRANT_SPOT, LASER_SPOT, MIRROR_SPOT, SCHOOL_SENSOR, SCHOOL_BELL, WIND_SPOT, FOUNTAIN];
  const trees: [number, number, number][] = [];
  const bushes: [number, number, number][] = [];
  const ok = (x: number, z: number, room: number) =>
    Math.abs(x) < W / 2 - 1.5 && Math.abs(z) < D / 2 - 1.5 && !onLane(plan, x, z, room) && busy.every((b) => Math.hypot(x - b.x, z - b.z) > 7) && [...trees, ...bushes].every(([tx, tz]) => Math.hypot(x - tx, z - tz) > room + 0.8);
  for (let x = -W / 2 + 3; x < W / 2 - 2; x += 7) {
    for (const z of [-D / 2 + 2.5, D / 2 - 2.5]) if (ok(x, z, 2)) trees.push([x, z, 0.9 + rnd() * 0.35]);
  }
  for (let z = -D / 2 + 8; z < D / 2 - 6; z += 7) for (const x of [-W / 2 + 2.5, W / 2 - 2.5]) if (ok(x, z, 2)) trees.push([x, z, 0.9 + rnd() * 0.35]);
  const f = plan.field;
  for (const [x, z] of [[f.x0 + 2.5, f.z0 + 2.5], [f.x1 - 2.5, f.z0 + 2.5], [f.x0 + 2.5, f.z1 - 2.5], [f.x1 - 2.5, f.z1 - 2.5], [f.x0 + 7, f.z0 + 2.2], [f.x1 - 7, f.z1 - 2.2]]) if (ok(x, z, 2)) trees.push([x, z, 0.9 + rnd() * 0.3]);
  for (let i = 0; i < 60; i++) {
    const x = (rnd() - 0.5) * (W - 6);
    const z = (rnd() - 0.5) * (D - 6);
    if (ok(x, z, 1)) bushes.push([x, z, 0.7 + rnd() * 0.4]);
  }
  return { trees, bushes };
}

// ───────────────────────── Stand-ins ─────────────────────────

/** Grandma's balcony: a little platform on posts, as high as the lift's cabin at the top. */
function balcony({ x, z }: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(1.6, 0.14, 1.3), mat('#e8e0d0', 0.7));
  deck.position.y = BALCONY_TOP - 0.07;
  g.add(deck);
  const rail = mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), mat('#ffffff', 0.5));
  rail.position.set(0, BALCONY_TOP + 0.25, 0.62);
  g.add(rail);
  for (const sx of [-0.7, 0.7]) {
    const post = mesh(new THREE.BoxGeometry(0.12, BALCONY_TOP, 0.12), mat('#d8cdbd', 0.7));
    post.position.set(sx, BALCONY_TOP / 2, 0.55);
    g.add(post);
  }
  g.position.set(x, 0, z);
  return g;
}

function basin(): THREE.Group {
  const g = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(BASIN_R, 0.35, 10, 40), mat('#d8d4cc', 0.6));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.4;
  const water = mesh(new THREE.CircleGeometry(BASIN_R - 0.2, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5bb5d8', roughness: 0.1, transparent: true, opacity: 0.8 }));
  water.position.y = 0.3;
  const spout = mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.8, 16), mat('#d8d4cc', 0.5));
  spout.position.y = 0.4;
  g.add(rim, water, spout);
  return g;
}

/** The bakery's counter by the baker, where the belt brings the loaves. */
function counter(): THREE.Group {
  const g = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(2, 0.12, 0.8), mat('#c9a27a', 0.6));
  top.position.y = 0.76;
  const front = mesh(new THREE.BoxGeometry(1.9, 0.7, 0.7), mat('#f6e3b8', 0.7));
  front.position.y = 0.35;
  g.add(top, front);
  return g;
}

/** A red fire hydrant by the burning house. */
function hydrant(): THREE.Group {
  const g = new THREE.Group();
  const red = mat('#d8483c', 0.45);
  const body = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.7, 16), red);
  body.position.y = 0.35;
  const cap = mesh(new THREE.SphereGeometry(0.21, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  cap.position.y = 0.7;
  const arm = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12), red);
  arm.rotation.z = Math.PI / 2;
  arm.position.y = 0.45;
  g.add(body, cap, arm);
  return g;
}

/** A wicker basket with a loaf and apples sticking out. */
function basket(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.3, 16), mat('#c8945a', 0.8));
  body.position.y = 0.15;
  const handle = mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 20, Math.PI), mat('#a8774a', 0.8));
  handle.position.y = 0.3;
  const loaf = mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), mat('#c98a4b', 0.6));
  loaf.position.set(-0.05, 0.34, 0);
  loaf.rotation.z = 0.9;
  g.add(body, handle, loaf);
  for (const [x, z] of [[0.12, 0.06], [0.06, -0.12]]) {
    const apple = mesh(new THREE.SphereGeometry(0.07, 10, 8), mat('#d8483c', 0.5));
    apple.position.set(x, 0.32, z);
    g.add(apple);
  }
  return g;
}

function bins(): THREE.Group {
  const g = new THREE.Group();
  [-0.5, 0.5].forEach((x, i) => {
    const b = mesh(new THREE.CylinderGeometry(0.4, 0.35, 0.9, 14), mat(i ? '#3f8a4f' : '#5a7a9a', 0.6));
    b.position.set(x, 0.45, 0);
    g.add(b);
  });
  return g;
}

function bench(): THREE.Group {
  const g = new THREE.Group();
  const seat = mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), mat('#a8774a', 0.7));
  seat.position.y = 0.45;
  const back = mesh(new THREE.BoxGeometry(1.8, 0.4, 0.08), mat('#a8774a', 0.7));
  back.position.set(0, 0.75, -0.22);
  g.add(seat, back);
  return g;
}

/** Code-built stand-ins for the city's people and vehicles. */
const STAND_INS: Record<string, () => THREE.Object3D> = {
  car: () => {
    const g = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(2.2, 0.6, 1.1), mat('#d8483c', 0.4));
    body.position.y = 0.5;
    const top = mesh(new THREE.BoxGeometry(1.1, 0.5, 1.0), mat('#f2f2f2', 0.3));
    top.position.set(-0.1, 1.0, 0);
    g.add(body, top);
    for (const [x, z] of [[-0.7, -0.55], [0.7, -0.55], [-0.7, 0.55], [0.7, 0.55]]) {
      const w = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 14), mat('#2a2f3a', 0.6));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.25, z);
      g.add(w);
    }
    return g;
  },
  tram: () => {
    const g = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(7, 1.8, 1.8), mat('#e05a4a', 0.4));
    body.position.y = 1.2;
    const stripe = mesh(new THREE.BoxGeometry(7.02, 0.5, 1.82), mat('#f6eddd', 0.4));
    stripe.position.y = 1.6;
    const pole = mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), mat('#2a2f3a', 0.5));
    pole.position.set(0, 2.7, 0);
    pole.rotation.z = 0.5;
    g.add(body, stripe, pole);
    return g;
  },
};
