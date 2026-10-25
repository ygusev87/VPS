// The farm: a busy toy farm the child moves about on, picking whom to help.
// By day a hot cow wants a fan, a thirsty pig a pump, the tractor an open
// gate, the sheep a working mill, the kitten a lift down from the loft, the
// goat kids a carousel, the bees a watered flower bed, the horse a fan, the
// puppy a ball cannon; in the evening the hens and the geese want light, the
// rabbits and the eggs warmth, the cows a lullaby; at night a fox sneaks up to
// the rabbits and an alarm bell sends it away; in the morning the ducklings
// want a fountain and the rooster a bell. Each helper has a ring on the
// grass: a part dropped near it snaps in.
import * as THREE from 'three';
import type { Hint } from './hints';
import type { Level } from './levels';
import { clipsOf, hasModel, model, type Fit } from './parts/assets';
import type { Part, PartKind } from './parts/base';
import { Launcher, type Ball } from './parts/chain';
import { Carousel, PushButton } from './parts/extra';
import { Gate, Pump, Solar } from './parts/farm';
import { Lift } from './parts/more';
import { bakeGroup, mat, mesh } from './parts/kit';
import { glowFor } from './parts/models';
import { flowers, groundMaterial, onLane, pond, type Ellipse, type GroundPlan } from './ground';
import { AMBIENT } from './parts/wind';
import { isActive } from './world';
import { dressing } from './decor';
import { Pest } from './pest';
import { type Gait, type ToyKind } from './life';
import type { PhraseId } from './voice';
import { DECOR, FENCES, MEADOW, MUD, PATHS, PONDS, SOIL } from './farm-decor';
import { StoryMap, blob, boxHouse, instances, v, type Critter, type MapHooks, type MapProgress, type Need, type NeedSpec, type Phase } from './storymap';

/** Model files only the farm needs (loaded when it opens). */
export const FARM_MODELS = ['well', 'hayloft', 'cow', 'pig', 'hen', 'rabbit', 'dog', 'fox', 'fox-rig', 'barn', 'coop', 'tractor', 'duck', 'sheep', 'pole', 'solar', 'doghouse', 'sack',
  // Day two (each falls back to a stand-in until its model is made).
  'kitten', 'goat', 'kid', 'beehive', 'flowerbed-buds', 'flowerbed-bloom', 'nest', 'chick', 'goose', 'rooster', 'horse', 'stable',
  // Scenery.
  'tree-oak', 'tree-pine', 'bush', 'haystack', 'hutch', 'fence', 'fence-post', 'fence-lite', 'fence-post-lite', 'rock-cluster', 'flower-cluster',
  // And whatever the dressing uses (a model not made yet is simply left out).
  ...DECOR.map((g) => g.model)].filter((m, i, all) => all.indexOf(m) === i);
/** What each one says when poked. */
const FARM_VOICES: Record<string, PhraseId> = {
  cow: 'moo', pig: 'oink', sheep: 'baa', hen: 'cluck', rabbit: 'munch', dog: 'woof', duck: 'quack', kitten: 'meow', goat: 'maa', kid: 'maa',
  beehive: 'buzz', horse: 'neigh', puppy: 'yap', nest: 'peep', chick: 'peep', goose: 'honk', rooster: 'crow', tractor: 'beep',
};
/** How the herd (animals in the dressing) moves about. */
const HERD: Record<string, Gait> = { cow: 'graze', horse: 'graze', sheep: 'graze', goat: 'graze', kid: 'hop', pig: 'graze', hen: 'peck', chick: 'peck', rooster: 'peck', rabbit: 'hop', duck: 'waddle', goose: 'waddle' };
/** Things placed to be poked (each does something funny). */
const TOYS: [ToyKind, number, number, number][] = [
  ['mouse', -7.5, -18.5, 0.4],
  ['well', -1.5, -3.2, 0.3],
  ['scarecrow', 8.3, 25.2, 0],
  ['mailbox', -32.5, -21.6, 0],
  ['frog', -34.6, 8.4, -0.6],
];

/** Animals drawn with another one's model: the puppy is the dog, smaller. */
const MODEL_OF: Record<string, string> = { puppy: 'dog' };

/** What the drawers offer on the farm. */
// No batteries: on the farm the power comes from the poles, the sun and the wind.
export const FARM_TRAY: Level['tray'] = [
  { kind: 'fan', count: 2 },
  { kind: 'floorFan', count: 1 },
  { kind: 'pump', count: 3 },
  { kind: 'windmill', count: 1 },
  { kind: 'bulb', count: 2 },
  // Warm light for the geese, not an alarm-red one.
  { kind: 'led', count: 2, color: 'yellow' },
  { kind: 'heater', count: 2 },
  { kind: 'musicbox', count: 1 },
  { kind: 'button', count: 1 },
  { kind: 'bell', count: 1 },
  { kind: 'buzzer', count: 1 },
  { kind: 'switch', count: 2 },
];
/** The rest of the farm's drawers (the kitten's lift, the goats' carousel, the puppy's cannon). */
export const FARM_TRAY_TWO: { kind: PartKind; count: number }[] = [
  { kind: 'lift', count: 1 },
  { kind: 'carousel', count: 1 },
  { kind: 'launcher', count: 1 },
];

export type FarmHooks = MapHooks;

/**
 * The farm is laid out after the farm-v3 concept (assets-src/farm-v3: a full,
 * busy toy farm like the mobile farm games): x to the right, z towards the
 * viewer (south). The look — buildings, trees, props, fences, paths — is data
 * in src/farm-decor.ts; here are the animals, their rings and the poles.
 */
const W = 110;
const D = 75;
/**
 * How far a helper reaches, in the units the first small farm used (a fan
 * blows 4.2·K at the cow, the eggs warm within 3.4·K).
 */
const K = 1.5;

/** The farm's story so far, as saved between visits. */
export interface FarmProgress extends MapProgress {
  trough: number;
  mill: number;
  fountain: number;
  foxChased: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Bumped whenever the farm is laid out anew: a farm saved on an older layout would have its parts in the wrong places. */
/** Where the smoke leaves a house model (fitted model space, from assets-src/farm-v3/buildings/anchors.json). */
const CHIMNEY: Record<string, [number, number, number]> = { farmhouse: [4.188, 8.535, -0.461] };

export const FARM_LAYOUT = 4;

// The cows' pasture in the middle: one cow is hot by day (a fan) and cannot sleep at night (a lullaby).
const COW = v(12.5, 0.5);
const COW_FAN = v(10, 4);
const COW_MUSIC = v(16, 4);
// The pig pen north-east: the pump's ring is placed so it pours into the trough.
const TROUGH = v(28.9, -13.2);
const PIG = v(30.5, -16);
// The wheat field south-east with its gate on the north side; the tractor waits on the road above it.
const GATE = v(30, 17);
const GATE_SPOT = v(28.3, 17.4);
const TRACTOR_AT = v(30, 12);
/** The middle of the field the tractor drives round. */
const FIELD = v(29, 26.5);
// The sheep's hill in the north-east corner, the mill's ring on it.
const MILL = v(44, -22);
// The hens' coop north of the pasture, the nest beside it, the rooster on its other side.
const HEN = v(9.5, -17.5);
const HEN_LIGHT = v(7, -15);
const NEST = v(17, -17.5);
const NEST_SPOT = v(16, -14);
const ROOSTER = v(1, -13);
const ROOSTER_SPOT = v(-1, -10);
// The rabbits' hutch in the west; the dog's kennel beside it guards them from the fox.
const RABBIT = v(-41, -11.5);
const RABBIT_HEATER = v(-43, -8);
const DOG = v(-36.5, -14);
// The kitten on the hay loft by the barn's south-west corner (as high as the lift's cabin at the top).
const LIFT_SPOT = v(-19, -16);
const LOFT = v(LIFT_SPOT.x - 2.3, LIFT_SPOT.z - 0.25);
const LOFT_TOP = 1.95;
// The puppy's cannon shoots along +x, over open ground.
const LAUNCH_SPOT = v(-23, -8);
const PUPPY = v(-20, -5.8);
// The goats' yard west of the middle.
const CAROUSEL_SPOT = v(-15, 5);
const GOATS = v(-14.5, 2);
// The bees south-west: the pump's ring is placed so it pours into the flower bed.
const BED = v(-18.1, 16.8);
const HIVE = v(-16, 21.5);
const BED_PUMP = v(BED.x - 1.9, BED.z + 0.2);
// The horses' paddock east.
const HORSE = v(42.5, 9.5);
const HORSE_FAN = v(39, 13);
// The pond west, the ducks on it; the geese on its south shore.
const POND = v(-40, 3.5);
const DUCK_PUMP = v(-30.5, 5.5);
const GEESE = v(-33.5, 12.5);
const GEESE_SPOT = v(-31, 15.5);

/**
 * The poles, the sun and the wind: one by every yard, a little apart from
 * its ring so wires run short. Pinned in this order (saved wires find map
 * parts by it), so new ones only ever go at the end.
 */
const POLES = [
  v(6, 1), // the cow's fan
  v(20, 1), // the cow's music box
  v(21.5, -13.5), // the pigs' pump and the nest's heater
  v(2.5, -15), // the hens' light
  v(-5.5, -10), // the rooster's bell
  v(-48, -8), // the rabbits' heater
  v(26, 13.5), // the field's gate
  v(-35.5, -7.5), // the fox's button and bell
  v(-23.5, -12.5), // the kitten's lift and the puppy's cannon
  v(-20, 5), // the goats' carousel
  v(-15, 17), // the bees' pump
  v(34.5, 13.5), // the horse's fan
  v(-26.5, 14.5), // the geese's light
];
const SOLAR_AT = v(39, -22);
const WIND_AT = v(-27, 9.5);

export class FarmMap extends StoryMap {
  protected readonly width = W;
  protected readonly depth = D;
  readonly layout = FARM_LAYOUT;
  protected readonly intro = 'farmIntro';
  /** Where the lanes, the field and the mud are (set when the board is built). */
  private plan!: GroundPlan;
  /** Where flowers may grow on the ground (set with the board; the yards are kept clear when they are sown). */
  private flowerFree: (x: number, z: number) => boolean = () => true;
  private trough!: THREE.Mesh;
  troughLevel = 0;
  private tractor!: THREE.Group;
  private tractorT = -1;
  private fox!: Critter;
  /** Plays the fox's walk, as fast as the fox is going (none without the rigged model). */
  private foxMixer: THREE.AnimationMixer | null = null;
  private foxWalk: THREE.AnimationAction | null = null;
  private foxT = -1;
  private foxRun = 0;
  private foxPressedAt = -1;
  private foxTipSaid = false;
  private gate!: Gate;
  private foxChased = false;
  /** The mill's flour: sacks fill up while it turns. */
  millLevel = 0;
  private sacks: THREE.Object3D[] = [];
  /** The ducks' fountain grows while a pump pours into the pond. */
  fountainLevel = 0;
  private fountain: THREE.Sprite[] = [];
  /** Day two: the kitten up on the hay loft, riding the lift, or safe on the ground. */
  private kitten: 'stuck' | 'riding' | 'down' = 'stuck';
  /** How long the goat kids have been going round on the carousel. */
  private rideT = 0;
  /** The flower bed blooms while a pump waters it (0..1). */
  bloom = 0;
  private bees: THREE.Sprite[] = [];
  private beds: { buds: THREE.Object3D; bloom: THREE.Object3D } | null = null;
  /** Warmth the eggs have had; at 1 the chicks hatch. */
  warmth = 0;
  private eggs: THREE.Object3D[] = [];
  /** Balls the puppy has caught. */
  private caught = 0;
  private chasing: Ball | null = null;

  /** Lay the farm out: the board, the working props, the poles, the animals and what they need, then the dressing round them. */
  protected build() {
    this.buildBoard();
    this.buildPlaces();
    this.placeParts();
    this.buildCritters();
    this.buildNeeds();
    this.dress();
    this.sowFlowers();
    // The crow comes by day and in the evening, once the story is under way.
    this.pest = new Pest(this.scenery, this.stage, this.world, { say: (id) => this.hooks.say(id), zap: (at) => this.hooks.zap?.(at), chime: () => this.hooks.chime() }, () => (this.phase === 'day' || this.phase === 'evening' || this.phase === 'morning') && this.phaseT > 20);
    AMBIENT.strength = 0.55;
    AMBIENT.dir.set(-0.7, 0, 0.7).normalize();
  }

  protected cleanup() {
    AMBIENT.strength = 0;
    Solar.sun = 1;
  }

  progress(): FarmProgress {
    return super.progress() as FarmProgress;
  }

  protected saveExtra() {
    return { trough: r2(this.troughLevel), mill: r2(this.millLevel), fountain: r2(this.fountainLevel), foxChased: this.foxChased };
  }

  /** What is full, chased off and grown stays so. */
  protected restoreExtra(m: MapProgress) {
    const p = m as FarmProgress;
    this.troughLevel = p.trough;
    this.millLevel = p.mill;
    this.fountainLevel = p.fountain;
    this.foxChased = p.foxChased;
    // The tractor has long gone through the gate into the field.
    if (this.needs.some((n) => n.done && n.critter.name === 'tractor')) this.tractorT = 30;
    const done = (name: string) => this.needs.some((n) => n.done && n.critter.name === name);
    if (done('kitten')) this.settleKitten();
    if (done('beehive')) this.bloom = 1;
    if (done('nest')) this.warmth = 1;
    // One day now: every animal asks from the start.
    this.day = 1;
    if (this.phase === 'night') this.foxT = 0;
  }

  // ───────────────────────── Building ─────────────────────────

  private buildBoard() {
    const plan = (this.plan = groundPlan());
    const top = groundMaterial(plan);
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
    for (const p of PONDS) this.scenery.add(pond(p));
    // Flowers in clumps on the grass: not on the paths, the fields, the mud or in the water.
    const inside = (x: number, z: number, e: Ellipse, grow: number) => ((x - e.x) / (e.rx + grow)) ** 2 + ((z - e.z) / (e.rz + grow)) ** 2 < 1;
    const fields = [plan.field, ...(plan.fields ?? [])];
    this.flowerFree = (x: number, z: number) =>
      !onLane(plan, x, z, 0.8) &&
      !PONDS.some((p) => inside(x, z, p, 1.5)) &&
      !plan.mud.some((m) => inside(x, z, m, 1)) &&
      !fields.some((f) => x > f.x0 - 1 && x < f.x1 + 1 && z > f.z0 - 1 && z < f.z1 + 1);
  }

  /** What works in the story: the trough, the mill's sacks, the fountain, the loft, the flower bed, the eggs, the bees, the tractor. */
  private buildPlaces() {
    const still = new THREE.Group();
    // Trough in the pig pen: a wooden box with water that rises.
    const troughBox = mesh(new THREE.BoxGeometry(2, 0.45, 0.8), mat('#9a6a3e', 0.7));
    troughBox.position.set(TROUGH.x, 0.22, TROUGH.z);
    const inner = mesh(new THREE.BoxGeometry(1.8, 0.4, 0.6), mat('#5a3a22', 0.8));
    inner.position.set(TROUGH.x, 0.27, TROUGH.z);
    this.trough = mesh(new THREE.BoxGeometry(1.78, 1, 0.58), new THREE.MeshStandardMaterial({ color: '#4fb3e8', roughness: 0.05, transparent: true, opacity: 0.85 }), false);
    this.trough.position.set(TROUGH.x, 0.08, TROUGH.z);
    this.trough.scale.y = 0.001;
    still.add(troughBox, inner);
    this.scenery.add(this.trough);
    // Flour sacks by the mill appear one by one while it turns.
    for (let i = 0; i < 3; i++) {
      const sack = flourSack();
      sack.position.set(MILL.x + 1.6 + i * 0.75, 0, MILL.z + 1.4 - (i % 2) * 0.3);
      sack.visible = false;
      this.sacks.push(sack);
      this.scenery.add(sack);
    }
    // The fountain in the duck pond: droplets thrown up from the middle.
    for (let i = 0; i < 30; i++) {
      const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(120,200,255,0.95)'), transparent: true, depthWrite: false, opacity: 0 }));
      d.scale.setScalar(0.42);
      d.userData.t = i / 30;
      d.userData.a = (i * 2.4) % (Math.PI * 2);
      this.fountain.push(d);
      this.scenery.add(d);
    }
    const spout = mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.3, 16), mat('#d9dde3', 0.4, 0.3));
    spout.position.set(POND.x, 0.1, POND.z);
    this.scenery.add(spout);
    // The kitten's hay loft, the bees' flower bed, three eggs in the nest, the bees (out once it blooms).
    const hayloft = hasModel('hayloft') ? model('hayloft', {}) : null;
    hayloft?.position.set(LOFT.x, 0, LOFT.z);
    still.add(hayloft ?? loft(LOFT));
    const buds = this.add('flowerbed-buds', { width: 2.6 }, BED.x, BED.z, () => flowerBed(false));
    const bloom = this.add('flowerbed-bloom', { width: 2.6 }, BED.x, BED.z, () => flowerBed(true));
    bloom.visible = false;
    this.beds = { buds, bloom };
    for (let i = 0; i < 3; i++) {
      const e = egg();
      e.position.set(NEST.x + (i - 1) * 0.3, 0.2, NEST.z + (i % 2) * 0.2 - 0.1);
      this.eggs.push(e);
      this.scenery.add(e);
    }
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(255,205,60,0.95)'), transparent: true, depthWrite: false, opacity: 0 }));
      b.scale.setScalar(0.3);
      this.bees.push(b);
      this.scenery.add(b);
    }
    this.scenery.add(bakeGroup(still));
    // The tractor waits on the road above the gate, facing it.
    this.tractor = <THREE.Group>this.add('tractor', { depth: 2.6, rotateY: Math.PI }, TRACTOR_AT.x, TRACTOR_AT.z, () => boxHouse('#3f8a4f', '#2a3148', 2.2, 1.2, 1.4), Math.PI);
  }

  /** The power sources and the gate are part of the map: they cannot be moved. */
  private placeParts() {
    for (const p of POLES) this.pin('pole', p);
    // The sun runs the mill (by day only), the wind the ducks' fountain.
    this.pin('solar', SOLAR_AT);
    this.pin('windGen', WIND_AT);
    this.gate = this.pin('gate', GATE) as Gate;
  }

  protected voiceOf(base: string): PhraseId | null {
    return FARM_VOICES[base] ?? null;
  }

  /** The fox walks on its paws (its rigged model, when that is there); the puppy is the dog, smaller. */
  protected critterModel(base: string, fit: Fit, name: string): THREE.Object3D {
    return (base === 'fox' ? model('fox-rig', fit) : null) ?? model(MODEL_OF[base] ?? base, fit) ?? STAND_INS[base]?.() ?? blob(name);
  }

  private buildCritters() {
    this.critter('cow', { width: 2.4 }, COW, 1.9, 0.25);
    this.critter('pig', { width: 1.7 }, PIG, 1.2, 0.3);
    this.critter('sheep', { width: 1.7, rotateY: -Math.PI / 2 }, v(46.5, -27), 1.3, 0.2);
    this.critter('sheep2', { width: 1.5, rotateY: -Math.PI / 2 }, v(49, -25), 1.2, -0.5);
    // Ducklings wait at the edge of the pond (they swim round the fountain once it plays).
    this.critter('duck', { height: 0.9, rotateY: -Math.PI / 2 }, v(POND.x + 3.3, POND.z + 2.1), 0.9, Math.PI);
    this.critter('duck2', { height: 0.8, rotateY: -Math.PI / 2 }, v(POND.x + 4.6, POND.z + 0.9), 0.8, Math.PI);
    this.critter('duck3', { height: 0.8, rotateY: -Math.PI / 2 }, v(POND.x + 3.9, POND.z - 0.8), 0.8, Math.PI);
    this.critter('hen', { height: 1.25 }, HEN, 1.25, -0.4);
    this.critter('hen2', { height: 1.1 }, HEN.clone().add(v(1.5, 1.3)), 1.1, 0.6);
    this.critter('rabbit', { height: 1.25 }, RABBIT, 1.25, 0.2);
    this.critter('dog', { height: 1.5 }, DOG, 1.5, -0.6);
    this.fox = this.critter('fox', { width: 1.7 }, FOX_PATH[0], 1, 0);
    this.fox.group.visible = false;
    this.fox.roams = true;
    this.fox.mute = true;
    const walk = clipsOf('fox-rig')[0];
    if (walk && hasModel('fox-rig')) {
      this.foxMixer = new THREE.AnimationMixer(this.fox.group);
      this.foxWalk = this.foxMixer.clipAction(walk).play();
    }
    // The tractor speaks for the gate (its bubble floats above it).
    this.adopt('tractor', this.tractor, 2).roams = true;
    // A hot cow sweats: little blue drops.
    const cow = this.critters.get('cow')!;
    cow.sweat = [0, 1, 2].map((i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(120,190,255,0.95)'), transparent: true, depthWrite: false, opacity: 0 }));
      s.scale.setScalar(0.3);
      s.userData.t = i / 3;
      this.scenery.add(s);
      return s;
    });
    const kitten = this.critter('kitten', { height: 0.75 }, LOFT.clone().add(v(0.3, 0.2)), 0.75, -0.6);
    kitten.base = LOFT_TOP;
    this.critter('goat', { width: 1.6 }, v(GOATS.x + 2.5, GOATS.z - 0.5), 1.4, 0.3);
    this.critter('kid', { width: 1 }, v(GOATS.x - 3, GOATS.z - 1), 0.9, -0.4);
    this.critter('kid2', { width: 0.95 }, v(GOATS.x + 2, GOATS.z + 4), 0.9, 2.2);
    this.critter('beehive', { height: 1.3 }, HIVE, 1.3, 0);
    this.critter('horse', { width: 2.6 }, HORSE, 2.1, 0.2);
    this.critter('puppy', { height: 0.8 }, PUPPY, 0.8, Math.PI);
    this.critter('nest', { width: 1.3 }, NEST, 0.5, 0);
    ['chick', 'chick2', 'chick3'].forEach((name, i) => {
      const c = this.critter(name, { height: 0.45 }, v(NEST.x + Math.cos(i * 2.1) * 0.9, NEST.z + Math.sin(i * 2.1) * 0.9), 0.45, i * 2);
      c.group.visible = false;
    });
    this.critter('goose', { height: 1.2 }, GEESE, 1.2, 0.4);
    this.critter('goose2', { height: 1.1 }, GEESE.clone().add(v(1.3, 0.6)), 1.1, -0.3);
    this.critter('rooster', { height: 1.2 }, ROOSTER, 1.2, -0.3);
    for (const name of ['kid', 'kid2', 'puppy']) this.rest.set(name, this.critters.get(name)!.home.clone());
  }

  /** Everyone's need, all asking from the start (each in its part of the day); the child picks whom to help. */
  private buildNeeds() {
    const near = (kinds: PartKind[], at: THREE.Vector3, r: number) => () =>
      this.world.parts.some((p) => kinds.includes(p.kind) && isActive(p) && p.root.position.distanceTo(at) < r);
    const get = (name: string) => this.critters.get(name)!;
    const cow = get('cow');
    const add = (n: NeedSpec) => this.addNeed(n);
    const FANS: PartKind[] = ['fan', 'floorFan', 'pcFan'];
    // Day.
    add({ critter: cow, phase: 'day', ask: 'cowHot', thanks: 'cowHappy', icon: 'fan', kinds: FANS, spot: COW_FAN, met: near(FANS, cow.home, 4.2 * K) });
    add({ critter: get('pig'), phase: 'day', ask: 'pigThirsty', thanks: 'pigHappy', icon: 'pump', kinds: ['pump'], spot: v(TROUGH.x - 1.9, TROUGH.z + 0.2), met: () => this.troughLevel > 0.95 });
    add({ critter: get('tractor'), phase: 'day', ask: 'gateStuck', thanks: 'gateHappy', icon: 'gate', kinds: [], spot: GATE_SPOT, met: () => this.gate.open > 0.97 });
    add({ critter: get('sheep'), phase: 'day', ask: 'sheepMill', thanks: 'sheepHappy', icon: 'windmill', kinds: ['windmill'], spot: MILL.clone(), met: () => this.millLevel >= 1 });
    add({ critter: get('kitten'), phase: 'day', ask: 'kittenStuck', thanks: 'kittenHappy', icon: 'lift', kinds: ['lift'], spot: LIFT_SPOT, met: () => this.kitten === 'down' });
    add({ critter: get('goat'), phase: 'day', ask: 'goatsAsk', thanks: 'goatsHappy', icon: 'carousel', kinds: ['carousel'], spot: CAROUSEL_SPOT, met: () => this.rideT > 3 });
    add({ critter: get('beehive'), phase: 'day', ask: 'beesAsk', thanks: 'beesHappy', icon: 'pump', kinds: ['pump'], spot: BED_PUMP, met: () => this.bloom >= 1, sticker: 'bee' });
    add({ critter: get('horse'), phase: 'day', ask: 'horseHot', thanks: 'horseHappy', icon: 'fan', kinds: FANS, spot: HORSE_FAN, met: near(FANS, HORSE, 4.2 * K) });
    add({ critter: get('puppy'), phase: 'day', ask: 'puppyAsk', thanks: 'puppyHappy', icon: 'launcher', kinds: ['launcher'], spot: LAUNCH_SPOT, met: () => this.caught >= 2 });
    // Evening.
    add({ critter: get('hen'), phase: 'evening', ask: 'henDark', thanks: 'henHappy', icon: 'bulb', kinds: ['bulb', 'led'], spot: HEN_LIGHT, met: near(['bulb', 'led'], HEN, 4.8 * K) });
    add({ critter: get('rabbit'), phase: 'evening', ask: 'rabbitCold', thanks: 'rabbitHappy', icon: 'heater', kinds: ['heater'], spot: RABBIT_HEATER, met: near(['heater'], RABBIT, 4.2 * K) });
    add({ critter: cow, phase: 'evening', ask: 'cowSleepy', thanks: 'cowSleep', icon: 'musicbox', kinds: ['musicbox'], spot: COW_MUSIC, met: near(['musicbox'], cow.home, 4.5 * K), sticker: 'cow' });
    add({ critter: get('nest'), phase: 'evening', ask: 'eggsCold', thanks: 'chicksHatched', icon: 'heater', kinds: ['heater', 'bulb'], spot: NEST_SPOT, met: () => this.warmth >= 1, sticker: 'chick' });
    add({ critter: get('goose'), phase: 'evening', ask: 'geeseDark', thanks: 'geeseHappy', icon: 'led', kinds: ['led', 'bulb'], spot: GEESE_SPOT, met: near(['led', 'bulb'], GEESE, 4 * K) });
    // Night: the dog warns about the fox; a button on the path and a bell chase it off.
    add({ critter: get('dog'), phase: 'night', ask: 'foxTip', thanks: 'foxScared', icon: 'button', kinds: ['button'], hintPhrase: 'foxTip', spot: FOX_BUTTON.clone(), focus: [DOG.clone(), FOX_BUTTON.clone(), BELL_SPOT.clone()], met: () => this.foxChased, sticker: 'fox' });
    // Morning: the ducklings want a fountain, the rooster a bell.
    add({ critter: get('duck'), phase: 'morning', ask: 'ducksAsk', thanks: 'ducksHappy', icon: 'pump', kinds: ['pump'], spot: DUCK_PUMP, met: () => this.fountainLevel > 0.95 });
    add({
      critter: get('rooster'),
      phase: 'morning',
      ask: 'roosterAsk',
      thanks: 'roosterHappy',
      icon: 'bell',
      kinds: ['bell', 'buzzer'],
      spot: ROOSTER_SPOT,
      met: () => this.world.parts.some((p) => (p.kind === 'bell' || p.kind === 'buzzer') && p.state.level > 0.05 && p.root.position.distanceTo(ROOSTER) < 4 * K),
    });
  }

  /**
   * The farm's dressing (src/farm-decor.ts): buildings, trees, props and
   * fences, each kind one instanced model. Anything small that would stand on
   * a ring, a pole, an animal, the fox's path or the puppy's line of fire is
   * left out, so the dressing can be laid out freely round the tasks.
   */
  private dress() {
    const keep = [
      ...this.needs.flatMap((n) => [n.spot, ...n.more.map((s) => s.spot)]),
      ...[...this.critters.values()].filter((c) => !c.roams || c.name === 'tractor').map((c) => c.home),
      ...this.world.parts.map((p) => p.root.position),
      BELL_SPOT,
    ];
    // The tractor's way: down through the gate, then its loop round the field (as updateTractor drives it).
    const loop = Array.from({ length: 25 }, (_, i) => v(FIELD.x + Math.cos((i / 24) * Math.PI * 2) * 4.2, FIELD.z + Math.sin((i / 24) * Math.PI * 2) * 6));
    const lines = [FOX_PATH, [LAUNCH_SPOT, v(LAUNCH_SPOT.x + 15, LAUNCH_SPOT.z)], [TRACTOR_AT, v(TRACTOR_AT.x, FIELD.z - 6)], loop];
    // The toys to poke, and the herd: animals in the dressing wander about instead of standing still.
    const bodies: Partial<Record<ToyKind, () => THREE.Object3D | null>> = { mouse: () => model('haystack', { width: 2.2 }), well: () => model('well', { width: 2.8 }) };
    for (const [kind, x, z, yaw] of TOYS) this.life.addToy(kind, x, z, yaw, bodies[kind]?.() ?? undefined);
    keep.push(...this.life.toySpots);
    const herd = DECOR.filter((g) => HERD[g.model]);
    for (const g of herd) {
      for (const [x, z, yaw, s] of g.items) {
        const m = model(g.model, g.fit);
        if (!m) break;
        m.scale.multiplyScalar(s);
        this.life.addExtra(m, x, z, yaw, HERD[g.model], FARM_VOICES[g.model] ?? null, g.model === 'hen' || g.model === 'rabbit' ? 1.8 : 2.6);
      }
    }
    const { group, drawn, inTheWay } = dressing(DECOR.filter((g) => !HERD[g.model]), FENCES, keep, lines);
    this.scenery.add(group);
    // Butterflies over the garden and the flowers, fireflies by the pond at night; smoke from the house.
    this.life.addFlutters([v(4, 21), v(-18, 19), v(13, 26), v(-40, 22), v(44, -24), v(-10, 0)], [POND, v(-35, 14)]);
    const house = DECOR.find((g) => (g.model === 'house' || g.model === 'farmhouse') && drawn.has(g.model));
    if (house) {
      const [x, z, yaw, s] = house.items[0];
      const pipe = CHIMNEY[house.model];
      if (pipe) {
        // The measured top of the chimney, turned and scaled with the house.
        this.life.addSmoke(new THREE.Vector3(pipe[0], pipe[1], pipe[2]).multiplyScalar(s).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(v(x, z)));
      } else {
        const box = new THREE.Box3().setFromObject(group.children[[...drawn].indexOf(house.model)] ?? group);
        this.life.addSmoke(v(x + 1.5, z).setY(Math.max(3, box.max.y)));
      }
    }
    const trees = [...drawn].some((m) => m.startsWith('tree'));
    // Without the full dressing yet: a wood round the edges of the board, groves and bushes.
    if (!trees) {
      const green = greeneryFor(this.plan, (x, z) => !inTheWay(x, z, 3));
      for (const [name, fit, items] of [
        ['tree-oak', { height: 3 }, green.oak],
        ['tree-pine', { height: 3.6 }, green.pine],
        ['bush', { width: 1.8 }, green.bush],
        ['rock-cluster', { width: 1.8 }, green.rock],
      ] as const) {
        const wood = instances(name, fit, items);
        if (wood) this.scenery.add(wood);
      }
    }
    // Young wheat on the field until the wheat is modelled.
    if (!drawn.has('crop-wheat')) this.scenery.add(sprouts(this.plan.field));
  }

  /**
   * Clumps of wild flowers on the grass (sculpted, or little flat ones without the
   * model) — sown last, so they keep off every ring, animal and pole.
   */
  private sowFlowers() {
    const taken = [...this.needs.flatMap((n) => [n.spot, ...n.more.map((s) => s.spot)]), ...[...this.critters.values()].map((c) => c.home), ...this.world.parts.map((p) => p.root.position)];
    const free = (x: number, z: number) => this.flowerFree(x, z) && taken.every((t) => Math.hypot(x - t.x, z - t.z) > 2.6);
    const spots: [number, number, number][] = [];
    for (let tries = 0; spots.length < 80 && tries < 6000; tries++) {
      const x = (Math.random() - 0.5) * (W - 3);
      const z = (Math.random() - 0.5) * (D - 3);
      if (free(x, z) && spots.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 1.8)) spots.push([x, z, 0.8 + Math.random() * 0.45]);
    }
    const bloom = instances('flower-cluster', { height: 0.45 }, spots);
    bloom?.traverse((o) => (o.castShadow = false));
    this.scenery.add(bloom ?? flowers(this.plan, 160, free));
  }

  /** Where the kids and the puppy go back to between rides and games. */
  private rest = new Map<string, THREE.Vector3>();
  private liftWaitT = 0;

  private updateDayTwo(dt: number) {
    const today = true;
    this.updateKitten(dt, today);
    this.updateRide(dt, today);
    this.updateBloom(dt);
    this.updateEggs(dt, today && this.phase === 'evening');
    this.updatePuppy(dt, today);
  }

  /** Up on the loft until a lift comes up; rides it down; then safe on the grass. */
  private updateKitten(dt: number, today: boolean) {
    const c = this.critters.get('kitten')!;
    const lift = this.world.parts.find((p): p is Lift => p instanceof Lift && p.root.position.distanceTo(LIFT_SPOT) < 0.8);
    if (this.kitten === 'stuck') {
      if (!today || !lift) return;
      if (lift.end === 'top') {
        this.kitten = 'riding';
        lift.driver = false;
        c.hop = 1;
        this.liftWaitT = 0;
        this.hooks.say('kittenRide');
        return;
      }
      // Going the wrong way (down, at the bottom already): tell them to swap the wires.
      this.liftWaitT = lift.end === 'bottom' && lift.state.level < -0.15 ? this.liftWaitT + dt : 0;
      if (this.liftWaitT > 2.5) {
        this.liftWaitT = -20;
        this.hooks.say('liftUp');
      }
      return;
    }
    if (this.kitten !== 'riding') return;
    if (!lift) {
      // The lift was taken away: the kitten is back up on the loft.
      this.kitten = 'stuck';
      c.base = LOFT_TOP;
      const home = LOFT.clone().add(v(0.3, 0.2));
      c.group.position.set(home.x, LOFT_TOP, home.z);
      c.home.copy(home);
      return;
    }
    const at = lift.cabinFloor(new THREE.Vector3());
    c.group.position.x = at.x;
    c.group.position.z = at.z;
    c.home.set(at.x, 0, at.z);
    c.base = at.y;
    if (lift.end === 'bottom') {
      lift.driver = true;
      this.settleKitten();
      return;
    }
    // Waiting at the top: the current has to go the other way now.
    this.liftWaitT = lift.end === 'top' && Math.abs(lift.state.level) < 0.15 ? this.liftWaitT + dt : lift.end === 'top' ? this.liftWaitT + dt : 0;
    if (this.liftWaitT > 3) {
      this.liftWaitT = -20;
      this.hooks.say('liftSwap');
    }
  }

  /** The kitten hops out of the lift onto the grass. */
  private settleKitten() {
    this.kitten = 'down';
    const c = this.critters.get('kitten')!;
    const at = LIFT_SPOT.clone().add(v(1.7, 1.2));
    c.group.position.set(at.x, 0, at.z);
    c.home.copy(at);
    c.base = 0;
    c.hop = 1;
  }

  /** The goat kids hop on a turning carousel and go round; off again when it stops. */
  private updateRide(dt: number, today: boolean) {
    const car = this.world.parts.find((p): p is Carousel => p instanceof Carousel && p.root.position.distanceTo(CAROUSEL_SPOT) < 0.8);
    const riding = today && !!car && Math.abs(car.spin) > 0.4;
    if (riding) this.rideT += dt;
    ['kid', 'kid2'].forEach((name, i) => {
      const c = this.critters.get(name)!;
      const p = c.group.position;
      if (riding) {
        const at = car!.seat(0.62, i * Math.PI + Math.PI / 4, new THREE.Vector3());
        const ahead = car!.seat(0.62, i * Math.PI + Math.PI / 4 + Math.sign(car!.spin) * 0.2, new THREE.Vector3());
        p.x = at.x;
        p.z = at.z;
        c.base = at.y;
        c.group.rotation.y = Math.atan2(ahead.x - at.x, ahead.z - at.z) - Math.PI / 2;
      } else {
        const home = this.rest.get(name)!;
        p.x += (home.x - p.x) * Math.min(1, dt * 3);
        p.z += (home.z - p.z) * Math.min(1, dt * 3);
        c.base = (c.base ?? 0) * Math.max(0, 1 - dt * 4);
      }
      c.home.set(p.x, 0, p.z);
    });
  }

  /** A pump pouring into the flower bed makes it bloom; then the bees come out. */
  private updateBloom(dt: number) {
    const watering = this.world.parts.some((p) => p instanceof Pump && p.pumping && p.outlet().distanceTo(BED) < 1.8);
    if (watering) this.bloom = Math.min(1, this.bloom + dt * 0.3);
    if (this.beds) {
      this.beds.buds.visible = this.bloom < 1;
      this.beds.bloom.visible = this.bloom > 0;
      this.beds.bloom.scale.setScalar(0.25 + 0.75 * this.bloom);
    }
    this.bees.forEach((b, i) => {
      const a = this.time * (0.9 + i * 0.13) + i * 1.7;
      const k = (Math.sin(this.time * 0.4 + i) + 1) / 2;
      b.position.set(THREE.MathUtils.lerp(HIVE.x, BED.x, k) + Math.cos(a) * 0.8, 1.1 + Math.sin(a * 2.3) * 0.25, THREE.MathUtils.lerp(HIVE.z, BED.z, k) + Math.sin(a) * 0.6);
      b.material.opacity = this.bloom >= 1 ? 0.95 : 0;
    });
  }

  /** Kept warm in the evening, the eggs wobble, then crack: three chicks. */
  private updateEggs(dt: number, now: boolean) {
    const warm = now && this.world.parts.some((p) => (p.kind === 'heater' || p.kind === 'bulb') && isActive(p) && p.root.position.distanceTo(NEST) < 3.4 * K);
    if (warm) this.warmth = Math.min(1, this.warmth + dt * 0.15);
    const hatched = this.warmth >= 1;
    this.eggs.forEach((e, i) => {
      e.visible = !hatched;
      e.rotation.z = warm ? Math.sin(this.time * 18 + i * 2) * 0.12 * this.warmth : 0;
    });
    ['chick', 'chick2', 'chick3'].forEach((name, i) => {
      const c = this.critters.get(name)!;
      if (hatched && !c.group.visible) c.hop = 1;
      c.group.visible = hatched;
      if (!hatched) return;
      // Chicks potter round the nest.
      const a = this.time * 0.5 + i * 2.1;
      c.group.position.x = NEST.x + Math.cos(a) * 1;
      c.group.position.z = NEST.z + Math.sin(a) * 0.8;
      c.group.rotation.y = -a;
      c.home.set(c.group.position.x, 0, c.group.position.z);
    });
  }

  /** The puppy runs after every ball the cannon shoots, then trots back. */
  private updatePuppy(dt: number, today: boolean) {
    const c = this.critters.get('puppy')!;
    const p = c.group.position;
    const launcher = this.world.parts.find((q): q is Launcher => q instanceof Launcher && q.root.position.distanceTo(LAUNCH_SPOT) < 0.8);
    const ball = launcher?.ball ?? null;
    if (today && ball && ball !== this.chasing && !this.caughtBalls.has(ball)) this.chasing = ball;
    if (this.chasing && this.chasing !== ball) this.chasing = null;
    const target = this.chasing ? this.chasing.pos : this.rest.get('puppy')!;
    const to = v(target.x - p.x, target.z - p.z);
    const dist = to.length();
    const speed = this.chasing ? 4.5 : 2;
    if (dist > 0.05) {
      p.x += (to.x / dist) * Math.min(dist, speed * dt);
      p.z += (to.z / dist) * Math.min(dist, speed * dt);
      if (dist > 0.3) c.group.rotation.y = Math.atan2(to.x, to.z) - Math.PI / 2;
    }
    c.home.set(p.x, 0, p.z);
    if (this.chasing && dist < 0.6) {
      this.caughtBalls.add(this.chasing);
      this.chasing = null;
      this.caught++;
      c.hop = 1;
      this.hooks.chime();
    }
  }
  private caughtBalls = new WeakSet<Ball>();

  // ───────────────────────── Story ─────────────────────────

  protected phaseBegins(p: Phase) {
    if (p === 'evening') this.hooks.say('evening');
    if (p === 'night') {
      this.foxT = 0;
      if (!this.foxChased) this.hooks.say('foxComes');
    }
    if (p === 'morning') this.hooks.say('ducksAsk');
    if (p === 'done') this.hooks.say('morning');
  }

  protected helpedNeed(n: Need) {
    if (n.critter.name === 'tractor') this.tractorT = 0;
  }

  /** The fox does not ask for anything: tapped, it is a reminder of how to chase it off. */
  protected tapped(c: Critter) {
    if (c !== this.fox) return false;
    this.hooks.say('foxTip');
    return true;
  }

  /**
   * The kitten is in the lift at the top: the current has to run the other
   * way. Take off the two wires as they are, then wire the lift the other way
   * round: the pole's plus to the lift's other leg.
   */
  private swapHint(): Hint | null {
    if (this.kitten !== 'riding') return null;
    const lift = this.world.parts.find((p): p is Lift => p instanceof Lift && p.root.position.distanceTo(LIFT_SPOT) < 0.8);
    const pole = this.nearestSource(LIFT_SPOT);
    if (!lift || !pole || lift.state.level < -0.15) return null;
    const [plus, minus] = [pole.terminal('a'), pole.terminal('b')];
    const [a, b] = [lift.terminal('a'), lift.terminal('b')];
    const w = this.world;
    // Wires the old way round go first.
    const old = w.wires.find((x) => x.b && ((x.touches(a) && w.wired(a, plus)) || (x.touches(b) && w.wired(b, minus))));
    if (old) return { type: 'tapWire', wire: old, at: lift, problem: 'reversed', phrase: 'liftSwap', u: 0.5 };
    if (!w.wired(plus, b)) return { type: 'connect', from: b, to: plus, phrase: 'liftSwap' };
    if (!w.wired(a, minus)) return { type: 'connect', from: a, to: minus, phrase: 'liftSwap' };
    return null;
  }

  /** The fox's button is down: now a bell (or buzzer) to go with it. */
  protected extraHint(trayLeft: (k: PartKind) => number): Hint | null {
    const swap = this.swapHint();
    if (swap) return swap;
    if (this.day === 1 && this.phase === 'night' && !this.world.parts.some((p) => p.kind === 'bell' || p.kind === 'buzzer') && trayLeft('bell') > 0)
      return { type: 'drag', kind: 'bell', to: BELL_SPOT.clone(), phrase: 'foxTip' };
    // Both on their rings: one loop from the pole through the button and the bell.
    if (this.day === 1 && this.phase === 'night') {
      const near = (at: THREE.Vector3, kinds: PartKind[]) => this.world.parts.find((p) => kinds.includes(p.kind) && p.root.position.distanceTo(at) < 4);
      const button = near(FOX_BUTTON, ['button']);
      const bell = near(BELL_SPOT, ['bell', 'buzzer']);
      const pole = this.nearestSource(FOX_BUTTON);
      if (button && bell && pole) return this.chainHint(pole, [button, bell]);
    }
    return null;
  }

  protected tick(dt: number) {
    Solar.sun = Math.max(0, 1 - this.night * 1.6);
    // Gusts on the hill.
    AMBIENT.strength = 0.55 + Math.sin(this.time * 0.37) * 0.12 + Math.sin(this.time * 1.3) * 0.05;

    // The trough fills while a pump pours into it.
    const pouring = this.world.parts.some((p) => p instanceof Pump && p.pumping && p.outlet().distanceTo(TROUGH) < 1.6);
    this.troughLevel = Math.min(1, Math.max(0, this.troughLevel + dt * (pouring ? 0.25 : -0.01)));
    this.trough.scale.y = Math.max(0.001, this.troughLevel * 0.34);
    this.trough.position.y = 0.08 + this.troughLevel * 0.17;
    // The mill grinds flour while its sails turn.
    const milling = this.world.parts.some((p) => p.kind === 'windmill' && isActive(p) && p.root.position.distanceTo(MILL) < 2.5);
    if (milling) this.millLevel = Math.min(1, this.millLevel + dt * 0.18);
    this.sacks.forEach((sack, i) => {
      const want = this.millLevel >= (i + 1) / 3 - 0.01;
      if (want && !sack.visible) {
        sack.visible = true;
        sack.userData.pop = 0;
        this.hooks.chime();
      }
      if (sack.visible) {
        sack.userData.pop = Math.min(1, (sack.userData.pop ?? 1) + dt * 3);
        sack.scale.setScalar(0.3 + 0.7 * Math.sin((sack.userData.pop as number) * Math.PI * 0.6) / Math.sin(Math.PI * 0.6));
      }
    });
    // The fountain plays while a pump stands at the pond's edge.
    const spraying = this.world.parts.some((p) => p instanceof Pump && p.pumping && p.root.position.distanceTo(POND) < 7 * K);
    this.fountainLevel = Math.min(1, Math.max(0, this.fountainLevel + dt * (spraying ? 0.35 : -0.2)));
    for (const d of this.fountain) {
      d.userData.t = (d.userData.t + dt * 0.9) % 1;
      const t = d.userData.t as number;
      const h = this.fountainLevel * 2.6;
      const r = t * 1.3 * this.fountainLevel;
      d.position.set(POND.x + Math.cos(d.userData.a) * r, 0.2 + h * 4 * t * (1 - t), POND.z + Math.sin(d.userData.a) * r);
      d.material.opacity = this.fountainLevel * (1 - t * 0.6) * 0.9;
    }
    this.updateDayTwo(dt);
    this.updateFox(dt);
    this.updateTractor(dt);
  }

  /** With the fountain on, the ducklings swim round it. */
  protected afterAnimate(dt: number) {
    if (this.fountainLevel <= 0.3) return;
    ['duck', 'duck2', 'duck3'].forEach((name, i) => {
      const c = this.critters.get(name);
      if (!c) return;
      const a = this.time * 0.45 + i * 2.1;
      const k = Math.min(1, dt * 1.5);
      c.group.position.x += (POND.x + Math.cos(a) * 2.7 * K - c.group.position.x) * k;
      c.group.position.z += (POND.z + Math.sin(a) * 1.7 * K - c.group.position.z) * k;
      c.group.position.y = -0.12 + Math.sin(this.time * 3 + i) * 0.03;
      c.group.rotation.y = Math.atan2(-Math.cos(a) * 1.7, -Math.sin(a) * 2.7);
    });
  }

  private updateTractor(dt: number) {
    if (this.tractorT < 0) return;
    // Down the road, through the gate, then round and round the field.
    this.tractorT += dt;
    const t = this.tractorT;
    const p = this.tractor.position;
    if (t < 4) {
      p.set(TRACTOR_AT.x, 0, TRACTOR_AT.z + t * 2.6);
      this.tractor.rotation.y = Math.PI;
    } else {
      const a = (t - 4) * 0.35 - Math.PI / 2;
      const target = new THREE.Vector3(FIELD.x + Math.cos(a) * 4.2, 0, FIELD.z + Math.sin(a) * 6);
      const dir = target.clone().sub(p);
      if (dir.lengthSq() > 1e-4) this.tractor.rotation.y = Math.atan2(-dir.x, -dir.z);
      p.lerp(target, Math.min(1, dt * 2));
    }
    p.y = Math.abs(Math.sin(t * 14)) * 0.03;
  }

  private updateFox(dt: number) {
    const fox = this.fox;
    if (this.phase !== 'night' || (this.foxChased && this.foxRun === 0)) {
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
    let s = scared ? this.foxRun : Math.min(this.foxT * FOX_SNEAK, pathLength());
    if (scared) {
      this.foxRun = Math.max(0, this.foxRun - dt * FOX_RUN);
      s = this.foxRun;
      if (this.foxRun === 0) {
        fox.group.visible = false;
        return;
      }
    }
    const { at, dir } = pathAt(s);
    fox.group.position.copy(at);
    // A button on its path: the fox climbs up onto it (and so presses it) instead of walking through it.
    for (const p of this.world.parts) {
      if (!(p instanceof PushButton)) continue;
      const d = Math.hypot(p.root.position.x - at.x, p.root.position.z - at.z);
      // The fox is long (its nose is a unit ahead): it starts climbing two units off.
      if (d > 2) continue;
      let top = buttonTops.get(p);
      if (top === undefined) {
        top = new THREE.Box3().setFromObject(p.body).max.y - p.root.position.y;
        // A button just put down is still popping up: measure it again next time.
        if (top > 0.5) buttonTops.set(p, top);
      }
      fox.group.position.y = Math.max(fox.group.position.y, top * (1 - THREE.MathUtils.smoothstep(d, 1.1, 2)));
    }
    fox.group.rotation.y = Math.atan2(scared ? -dir.x : dir.x, scared ? -dir.z : dir.z) - Math.PI / 2;
    fox.home.copy(at);
    // The paws keep pace with the ground: quicker when it runs off, still while it waits at the coop.
    if (this.foxMixer && this.foxWalk) {
      this.foxWalk.timeScale = scared ? FOX_WALK_RUN : s < pathLength() ? FOX_WALK_SNEAK : 0;
      this.foxMixer.update(dt);
    }
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
        this.foxChased = true;
        this.critters.get('dog')!.hop = 1;
        this.hooks.look?.(at.clone());
        return;
      }
      // At the coop with no alarm: wait, then slink back and try again.
      if (s >= pathLength() && this.foxT > pathLength() / FOX_SNEAK + 3) {
        if (!this.foxTipSaid) {
          this.foxTipSaid = true;
          this.hooks.say('foxTip');
        }
        this.foxT = -6;
      }
    }
    void this.foxPressedAt;
  }

}

// ───────────────────────── Fox path ─────────────────────────

/** How high each button's top is, for the fox stepping onto it. */
const buttonTops = new WeakMap<Part, number>();
/** Where the fox's button goes: on its path, by the dog's kennel. */
const FOX_BUTTON = v(-34, -10);
/** Out of the wood on the north edge, between the house and the barn, down past the kennel to the rabbits' hutch. */
const FOX_PATH = [v(-27, -37), v(-27.5, -29), v(-29.5, -19), v(-32.5, -12.5), FOX_BUTTON, v(-38, -10), v(-39.5, -10.8)];
/** The fox's speed (units a second) sneaking up and running off, and how fast its walk clip plays then. */
const FOX_SNEAK = 1.2;
const FOX_RUN = 4.5;
// The rig's steps are short: the clip runs fast so the paws keep up with the ground (Codex measured the stride).
const FOX_WALK_SNEAK = 3;
// Running off, a little short of keeping pace: any faster and the legs blur.
const FOX_WALK_RUN = 7;
/** Where a hint asks for the bell: by the fox's button, off its path. */
const BELL_SPOT = v(-30, -6.5);
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

/** Where the paths, the fields, the mud and the meadows lie (from the dressing; painted by src/ground.ts). */
function groundPlan(): GroundPlan {
  // The wheat field is the one the tractor drives on; the garden's beds are more ploughed ground.
  const fields = SOIL.length ? SOIL : [{ x0: FIELD.x - 5.5, z0: FIELD.z - 8.5, x1: FIELD.x + 5.5, z1: FIELD.z + 8 }];
  const field = fields.reduce((best, f) => (Math.hypot((f.x0 + f.x1) / 2 - FIELD.x, (f.z0 + f.z1) / 2 - FIELD.z) < Math.hypot((best.x0 + best.x1) / 2 - FIELD.x, (best.z0 + best.z1) / 2 - FIELD.z) ? f : best));
  return {
    width: W,
    depth: D,
    lanes: [...PATHS.map((p) => ({ pts: p.points, w: p.width })), { pts: FOX_PATH.map((q) => [q.x, q.z] as [number, number]), w: 1.1 }],
    field,
    fields: fields.filter((f) => f !== field),
    mud: MUD,
    hill: MEADOW[0] ?? { x: MILL.x, z: MILL.z - 4, rx: 10, rz: 7 },
    meadows: MEADOW.slice(1),
    // A bright, juicy farm, like the toy farms of the mobile games.
    saturation: 1,
  };
}





/** A white flour sack, tied at the top. */
function flourSack(): THREE.Group {
  const sculpt = model('sack', { height: 1.1 });
  if (sculpt) return sculpt;
  const g = new THREE.Group();
  const cloth = mat('#f4efe4', 0.85);
  const body = mesh(new THREE.SphereGeometry(0.42, 18, 12), cloth);
  body.scale.set(1, 1.2, 0.85);
  body.position.y = 0.45;
  const neck = mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 12), cloth);
  neck.position.y = 0.95;
  const tie = mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 16), mat('#c84a3a', 0.6));
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.92;
  g.add(body, neck, tie);
  return g;
}

/** The hay loft by the barn: a plank platform on posts, as high as the lift's cabin at the top, with hay on it. */
function loft({ x, z }: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#a8774a', 0.75);
  const deck = mesh(new THREE.BoxGeometry(1.8, 0.14, 1.5), wood);
  deck.position.y = LOFT_TOP - 0.07;
  g.add(deck);
  for (const sx of [-0.78, 0.78]) {
    for (const sz of [-0.62, 0.62]) {
      const post = mesh(new THREE.BoxGeometry(0.14, LOFT_TOP, 0.14), wood);
      post.position.set(sx, LOFT_TOP / 2, sz);
      g.add(post);
    }
  }
  const hay = mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e3c25a', 0.9));
  hay.scale.set(1, 0.7, 0.9);
  hay.position.set(-0.4, LOFT_TOP, -0.3);
  g.add(hay);
  g.position.set(x, 0, z);
  return g;
}

/** A raised flower bed: closed green buds, or a riot of flowers. */
function flowerBed(open: boolean): THREE.Group {
  const g = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(2.6, 0.3, 1.6), mat('#9a6a3e', 0.8));
  box.position.y = 0.15;
  const soil = mesh(new THREE.BoxGeometry(2.4, 0.06, 1.4), mat('#6a4a30', 0.95));
  soil.position.y = 0.31;
  g.add(box, soil);
  const colors = ['#ff6f91', '#ffd23f', '#b388ff', '#ff9f43', '#ffffff'];
  for (let i = 0; i < 12; i++) {
    const x = -1 + (i % 6) * 0.4;
    const z = i < 6 ? -0.35 : 0.35;
    const stem = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), mat('#4f9a45', 0.7));
    stem.position.set(x, 0.5, z);
    const head = mesh(new THREE.SphereGeometry(open ? 0.16 : 0.08, 10, 8), mat(open ? colors[i % colors.length] : '#6fb35a', 0.6));
    head.position.set(x, open ? 0.72 : 0.68, z);
    if (open) head.scale.y = 0.6;
    g.add(stem, head);
  }
  return g;
}

/** A speckled egg for the nest. */
function egg(): THREE.Mesh {
  const e = mesh(new THREE.SphereGeometry(0.13, 14, 10), mat('#f7efe0', 0.5));
  e.scale.set(1, 1.3, 1);
  return e;
}

/** Code-built stand-ins for day two's places that are critters (tap them, they ask). */
const STAND_INS: Record<string, () => THREE.Object3D> = {
  beehive: () => {
    const g = new THREE.Group();
    [0.36, 0.3, 0.22].forEach((r, i) => {
      const ring = mesh(new THREE.CylinderGeometry(r, r + 0.04, 0.32, 18), mat(i % 2 ? '#e8b63a' : '#f2c94c', 0.6));
      ring.position.y = 0.16 + i * 0.3;
      g.add(ring);
    });
    const door = mesh(new THREE.CircleGeometry(0.08, 12), mat('#3a2a14', 0.9));
    door.position.set(0, 0.12, 0.39);
    g.add(door);
    return g;
  },
  nest: () => {
    const g = new THREE.Group();
    const bowl = mesh(new THREE.TorusGeometry(0.45, 0.16, 8, 20), mat('#c9a15a', 0.95));
    bowl.rotation.x = Math.PI / 2;
    bowl.position.y = 0.14;
    const bottom = mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.08, 18), mat('#b08a48', 0.95));
    bottom.position.y = 0.05;
    g.add(bowl, bottom);
    return g;
  },
};

function sprouts(field: GroundPlan['field']): THREE.InstancedMesh {
  const geo = new THREE.ConeGeometry(0.12, 0.35, 5);
  const im = new THREE.InstancedMesh(geo, mat('#5aa64a', 0.7), 400);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let x = field.x0 + 0.6; x < field.x1 - 0.4 && i < 400; x += 0.9) {
    for (let z = field.z0 + 0.7; z < field.z1 - 0.5 && i < 400; z += 1.3) {
      m.makeTranslation(x, 0.17, z + (Math.random() - 0.5) * 0.3);
      im.setMatrixAt(i++, m);
    }
  }
  im.count = i;
  im.castShadow = true;
  return im;
}

/**
 * A stand-in wood until the dressing has its trees: a thick band of pines and
 * oaks round the board's edge (so it never ends in bare grass), groves in the
 * corners and bushes between — never on a path, a field, the water or in the
 * way of a task. Always the same (a fixed seed).
 */
function greeneryFor(plan: GroundPlan, free: (x: number, z: number) => boolean) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const fields = [plan.field, ...(plan.fields ?? [])];
  type Item = [number, number, number];
  const all: Item[] = [];
  const ok = (x: number, z: number, room: number) =>
    Math.abs(x) < W / 2 - 1 &&
    Math.abs(z) < D / 2 - 1 &&
    free(x, z) &&
    !onLane(plan, x, z, room) &&
    !fields.some((f) => x > f.x0 - 1.5 && x < f.x1 + 1.5 && z > f.z0 - 1.5 && z < f.z1 + 1.5) &&
    !PONDS.some((p) => ((x - p.x) / (p.rx + 2)) ** 2 + ((z - p.z) / (p.rz + 2)) ** 2 < 1) &&
    all.every(([tx, tz]) => Math.hypot(x - tx, z - tz) > room + 0.4);
  const oak: Item[] = [];
  const pine: Item[] = [];
  const bush: Item[] = [];
  const rock: Item[] = [];
  const tree = (x: number, z: number, pines: number) => {
    if (!ok(x, z, 1.6)) return;
    const it: Item = [x, z, 0.85 + rnd() * 0.5];
    all.push(it);
    (rnd() < pines ? pine : oak).push(it);
  };
  // The edge: three rows deep, mostly pines.
  for (let row = 0; row < 3; row++) {
    const inset = 1.6 + row * 2.4;
    for (let x = -W / 2 + 2; x < W / 2 - 1; x += 2.6) {
      tree(x + (rnd() - 0.5) * 1.6, -D / 2 + inset + (rnd() - 0.5), 0.7);
      tree(x + (rnd() - 0.5) * 1.6, D / 2 - inset + (rnd() - 0.5), 0.7);
    }
    for (let z = -D / 2 + 4; z < D / 2 - 3; z += 2.6) {
      tree(-W / 2 + inset + (rnd() - 0.5), z + (rnd() - 0.5) * 1.6, 0.7);
      tree(W / 2 - inset + (rnd() - 0.5), z + (rnd() - 0.5) * 1.6, 0.7);
    }
  }
  // An orchard in the south-west, apple trees in rows.
  for (let x = -50; x <= -33; x += 4) for (let z = 17; z <= 31; z += 4) tree(x + (rnd() - 0.5), z + (rnd() - 0.5), 0);
  // Bushes along the paths' sides and at the feet of the trees.
  for (let i = 0; i < 260; i++) {
    const x = (rnd() - 0.5) * (W - 6);
    const z = (rnd() - 0.5) * (D - 6);
    if (!onLane(plan, x, z, 2.2) || !ok(x, z, 1)) continue;
    const it: Item = [x, z, 0.6 + rnd() * 0.45];
    all.push(it);
    bush.push(it);
  }
  for (const [tx, tz] of oak.concat(pine)) {
    if (rnd() > 0.1) continue;
    const a = rnd() * Math.PI * 2;
    const x = tx + Math.cos(a) * 2;
    const z = tz + Math.sin(a) * 2;
    if (!ok(x, z, 1)) continue;
    const it: Item = [x, z, 0.7 + rnd() * 0.5];
    all.push(it);
    (rnd() < 0.5 ? rock : bush).push(it);
  }
  return { oak, pine, bush, rock };
}
