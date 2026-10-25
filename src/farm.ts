// The farm: a big diorama the child moves about on. Animals ask for help in
// turn — a hot cow wants a fan, a thirsty pig a pump, the tractor an open
// gate, the sheep a working mill; in the evening the hens want light, the
// rabbits warmth and the cows a lullaby; at night a fox sneaks up and an
// alarm bell sends it away; in the morning the ducklings want a fountain.
// Each helper has a ring on the grass: a part dropped near it snaps in.
import * as THREE from 'three';
import type { Hint } from './hints';
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
import { StoryMap, blob, boxHouse, instances, patched, v, type Critter, type MapHooks, type MapProgress, type Need, type NeedSpec, type Phase } from './storymap';

/** Model files only the farm needs (loaded when it opens). */
export const FARM_MODELS = ['cow', 'pig', 'hen', 'rabbit', 'dog', 'fox', 'fox-rig', 'barn', 'coop', 'tractor', 'duck', 'sheep', 'pole', 'solar', 'doghouse', 'sack',
  // Day two (each falls back to a stand-in until its model is made).
  'kitten', 'goat', 'kid', 'beehive', 'flowerbed-buds', 'flowerbed-bloom', 'nest', 'chick', 'goose', 'rooster', 'horse', 'stable',
  // Scenery.
  'tree-oak', 'tree-pine', 'bush', 'haystack', 'hutch', 'fence', 'fence-post', 'rock-cluster', 'flower-cluster'];
/** Animals drawn with another one's model: the puppy is the dog, smaller. */
const MODEL_OF: Record<string, string> = { puppy: 'dog' };

/** What the drawers offer on the farm. */
// No batteries: on the farm the power comes from the poles, the sun and the wind.
export const FARM_TRAY: { kind: PartKind; count: number }[] = [
  { kind: 'fan', count: 2 },
  { kind: 'floorFan', count: 1 },
  { kind: 'pump', count: 2 },
  { kind: 'windmill', count: 1 },
  { kind: 'bulb', count: 2 },
  { kind: 'led', count: 2 },
  { kind: 'heater', count: 1 },
  { kind: 'musicbox', count: 1 },
  { kind: 'button', count: 1 },
  { kind: 'bell', count: 1 },
  { kind: 'buzzer', count: 1 },
  { kind: 'switch', count: 2 },
];
/** Added to the drawers when the farm has its second day. */
export const FARM_TRAY_TWO: { kind: PartKind; count: number }[] = [
  { kind: 'lift', count: 1 },
  { kind: 'carousel', count: 1 },
  { kind: 'launcher', count: 1 },
];

export type FarmHooks = MapHooks;

/**
 * The farm is big, so every task has room round it: the yards stand far apart
 * (S times as far as on the first, crowded board) and inside a yard the animal,
 * the ring for its part and the pole are K times as far apart, so wires run
 * short and tidy instead of over one another.
 */
const S = 2.35;
const K = 1.5;
/** Board size (world units), centred on 0. */
const W = Math.round(72 * S);
const D = Math.round(48 * S);


/** The farm's story so far, as saved between visits. */
export interface FarmProgress extends MapProgress {
  trough: number;
  mill: number;
  fountain: number;
  foxChased: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Bumped whenever the farm is laid out anew: a farm saved on an older layout would have its parts in the wrong places. */
export const FARM_LAYOUT = 2;

/**
 * Places are written as they were on the 72×48 board (where the yards had
 * first been pulled apart by YARDS), and moved onto the big board here: each
 * site's middle goes S times as far out, and what is in the site K times as far
 * from that middle. Pairs that must stay exact (the pump pouring into the
 * trough, the loft beside the lift's cabin) are built from these points with
 * fixed offsets.
 */
const SITES = {
  cow: [-15, -5],
  pig: [2.2, -8.7],
  field: [18.5, -5.75],
  hen: [-1, 12],
  rabbit: [-17, 12],
  dog: [8, 16.5],
  sheep: [-27.5, -16.5],
  pond: [27, 15],
  kitten: [-21.5, -3],
  goats: [29.5, -15.5],
  bees: [2.5, -18.5],
  horse: [-27.5, 1],
  puppy: [1.5, 19.5],
  geese: [17.5, 21],
} as const;
type Site = keyof typeof SITES;
/** A point of a site, given where it was on the 72×48 board. */
const L = (site: Site, x: number, z: number) => {
  const [ax, az] = SITES[site];
  return v(ax * S + (x - ax) * K, az * S + (z - az) * K);
};
/** A point of the open farm between the sites (lanes, woods), from the 72×48 board. */
const G = (x: number, z: number) => v(x * S, z * S);

/** How each day-one yard was moved apart on the 72×48 board (its points are written from before that). */
const YARDS = {
  cow: [-3.5, -1.5],
  pig: [0, -2.5],
  field: [4.5, -1],
  hen: [0, 4],
  rabbit: [-6, 5],
  dog: [2.5, 8],
  sheep: [-6, -5],
  pond: [8, 4],
} as const;
type Yard = keyof typeof YARDS;
/** A point of a day-one yard, given where it was on the first board. */
const at = (yard: Yard, x: number, z: number) => L(yard, x + YARDS[yard][0], z + YARDS[yard][1]);

/** Landmarks: the pig trough, the mill on the hill, the middle of the duck pond. */
const TROUGH = at('pig', 3.4, -5.2);
const MILL = at('sheep', -19.5, -12.5);
const POND = at('pond', 19, 12.5);
/** The gate into the field, and the road up through it from the bottom edge; the tractor waits on it. */
const GATE = at('field', 8, 3.2);
const ROAD_X = GATE.x;
const TRACTOR_Z = L('field', 12.5, 6.4).z;
/** The middle of the field the tractor drives round. */
const FIELD = at('field', 14, -4.75);
/** The lane along the yards, between the cow pen and the coop. */
const LANE_Z = G(0, 3.6).z;

// Day two's yards, in the free corners of the board.
/** The lift's ring, and the hay loft beside its cabin where the kitten is stuck (as high as the cabin at the top). */
const LIFT_SPOT = L('kitten', -21.2, -3.2);
const LOFT = v(LIFT_SPOT.x - 2.3, LIFT_SPOT.z - 0.25);
const LOFT_TOP = 1.95;
const GOATS = L('goats', 29.5, -17.5);
const CAROUSEL_SPOT = L('goats', 29.5, -12.6);
/** The flower bed and the hive; the pump's ring is placed so it pours into the bed (as at the trough). */
const BED = L('bees', 2, -18.5);
const HIVE = L('bees', 5.8, -19.8);
const BED_PUMP = v(BED.x - 1.9, BED.z + 0.2);
const STABLE = L('horse', -31, -1);
const HORSE = L('horse', -28, 1.5);
const HORSE_FAN = L('horse', -25.6, 1.6);
/** The puppy waits by the cannon's ring; balls fly off along +x into open grass. */
const PUPPY = L('puppy', 3.5, 20.2);
const LAUNCH_SPOT = L('puppy', -0.5, 20.8);
const NEST = L('hen', 5, 11.4);
const NEST_SPOT = L('hen', 5.2, 9.3);
const GEESE = L('geese', 18.5, 21.5);
const GEESE_SPOT = L('geese', 16.2, 20.2);
/** The rooster between the coop and the hens' pole, its bell's ring close to the pole. */
const ROOSTER = L('hen', -0.2, 9.8);
const ROOSTER_SPOT = L('hen', -1.6, 8.2);
/** A pole for each new yard (the nest and the rooster share the hens' pole). */
const POLES_TWO = [L('kitten', -19.2, -0.8), L('goats', 25.8, -10.6), L('bees', -1.8, -15.4), L('horse', -22, 1.5), L('puppy', -2.6, 17.8), L('geese', 16, 23.2)];
/** By the gate, which used to need a long wire from the pigs' pole. */
const GATE_POLE = L('field', 10, 5.8);
/** Day two needs these animals' models (see dayTwo). */
const DAY_TWO_ANIMALS = ['kitten', 'goat', 'kid', 'goose', 'rooster', 'horse', 'chick'];

/** Will the farm have its second day (once its models are loaded)? `?day2` forces it, for testing. */
export function hasDayTwo() {
  return DAY_TWO_ANIMALS.every(hasModel) || new URLSearchParams(location.search).has('day2');
}

export class FarmMap extends StoryMap {
  protected readonly width = W;
  protected readonly depth = D;
  readonly layout = FARM_LAYOUT;
  protected readonly intro = 'farmIntro';
  /** Where the lanes, the field and the mud are (set when the board is built). */
  private plan!: GroundPlan;
  /** Where flowers may grow on the ground (set with the board; the yards are kept clear when they are sown). */
  private flowerFree: (x: number, z: number) => boolean = () => true;
  /** Every fence on the farm, as polylines; built together once the places are laid out. */
  private fences: THREE.Vector3[][] = [];
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
  /**
   * The second day comes once its animals' models are there (stand-ins would
   * spoil the farm); `?day2` in the address turns it on anyway, for testing.
   */
  dayTwo = false;
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

  /** Lay the farm out: the board, the yards, the poles, the animals and what they need. */
  protected build() {
    this.dayTwo = hasDayTwo();
    this.buildBoard();
    this.buildPlaces();
    if (this.dayTwo) this.buildPlacesTwo();
    this.scenery.add(fences(this.fences));
    this.placeParts();
    this.placePartsTwo();
    this.buildCritters();
    if (this.dayTwo) this.buildCrittersTwo();
    this.buildNeeds();
    if (this.dayTwo) this.buildNeedsTwo();
    this.sowFlowers();
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

  /** What is full, chased off and grown stays so; day two only on a farm that has it. */
  protected restoreExtra(m: MapProgress) {
    const p = m as FarmProgress;
    this.troughLevel = p.trough;
    this.millLevel = p.mill;
    this.fountainLevel = p.fountain;
    this.foxChased = p.foxChased;
    // The tractor has long gone through the gate into the field.
    if (this.needs.some((n) => n.done && n.critter.name === 'tractor')) this.tractorT = 30;
    // Day two's animals that were helped stay helped.
    const done = (name: string) => this.needs.some((n) => n.done && n.critter.name === name);
    if (this.dayTwo && done('kitten')) this.settleKitten();
    if (done('beehive')) this.bloom = 1;
    if (done('nest')) this.warmth = 1;
    if (!this.dayTwo) this.day = 1;
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
    const shore = { x: POND.x, z: POND.z, ...POND_SIZE };
    this.scenery.add(pond(shore));
    // Flowers in clumps on the grass: not on the lanes, the field, the mud or by the pond.
    const inside = (x: number, z: number, e: Ellipse, grow: number) => ((x - e.x) / (e.rx + grow)) ** 2 + ((z - e.z) / (e.rz + grow)) ** 2 < 1;
    const f = plan.field;
    this.flowerFree = (x: number, z: number) =>
      !onLane(plan, x, z, 0.8) && !inside(x, z, shore, 1.5) && !plan.mud.some((m) => inside(x, z, m, 1)) && !(x > f.x0 - 1 && x < f.x1 + 1 && z > f.z0 - 1 && z < f.z1 + 1);
    // Mossy rocks round the pond (not on the side of the ducks' pump ring and the wind generator).
    const rocks: [number, number, number][] = [0.4, 1.3, 2.6, 3.7].map((a, i) => [POND.x + Math.cos(a) * (shore.rx + 1.6), POND.z + Math.sin(a) * (shore.rz + 1.4), 0.8 + (i % 3) * 0.2]);
    const rocky = instances('rock-cluster', { width: 1.8 }, rocks);
    if (rocky) this.scenery.add(rocky);
  }

  private buildPlaces() {
    // Fences, trees, haystacks, hutch and kennel never move: built into one group and baked (few draw calls).
    const still = new THREE.Group();
    // Barn (cows), coop (hens), hutch (rabbits), kennel (dog), pig pen with trough.
    const barn = at('cow', -12, -8.2);
    this.add('barn', { width: 5, rotateY: -Math.PI / 2 }, barn.x, barn.z, () => boxHouse('#c84a3a', '#5a5f6a', 6, 4, 4.5));
    const coop = at('hen', -3.2, 7.2);
    this.add('coop', { width: 2.7, rotateY: -Math.PI / 2 }, coop.x, coop.z, () => boxHouse('#f2c230', '#d8483c', 3.2, 2.2, 2.6));
    const hutchAt = at('rabbit', -14, 6.6);
    const sculptedHutch = model('hutch', { width: 2.9, rotateY: -Math.PI / 2 });
    if (sculptedHutch) {
      sculptedHutch.position.set(hutchAt.x, 0, hutchAt.z);
      this.scenery.add(sculptedHutch);
    } else still.add(hutch(hutchAt));
    still.add(kennel(at('dog', 6.2, 8.4)));
    // Fences: the cow pen, the pig pen, the long fence before the field (with the gate), the sheep fold.
    this.fences.push([at('cow', -16, -5.2), at('cow', -16, 0.8), at('cow', -7, 0.8), at('cow', -7, -5.2)]);
    this.fences.push([at('pig', -1.2, -9.5), at('pig', -1.2, -3), at('pig', 5.5, -3), at('pig', 5.5, -9.5)]);
    this.fences.push([at('field', 9.5, 3), at('field', 18.5, 3)]);
    this.fences.push([at('field', 4.5, 3), at('field', 6.5, 3)]);
    this.fences.push([at('sheep', -27, -9), at('sheep', -27, -17.5), at('sheep', -21.5, -17.5)]);
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
    // Trees and bushes round the edges, a wood in the bottom-left where the fox lives, groves in the open:
    // each kind is one sculpted model drawn all at once (instanced); code-built trees without the models.
    const green = greeneryFor(this.plan);
    for (const [name, fit, items] of [
      ['tree-oak', { height: 3 }, green.oak],
      ['tree-pine', { height: 3.6 }, green.pine],
      ['bush', { width: 1.8 }, green.bush],
      ['rock-cluster', { width: 1.8 }, green.rock],
    ] as const) {
      const wood = instances(name, fit, items);
      if (wood) this.scenery.add(wood);
      else if (name.startsWith('tree')) for (const [x, z, s] of items) still.add(tree(x, z, s));
    }
    // Haystacks by the barn, in the field and on the hill.
    for (const p of [at('cow', -8.5, -9.5), at('cow', -6.6, -10.2), at('field', 16.5, 0.6), at('sheep', -24.5, -15.8)]) {
      const stack = model('haystack', { width: 1.9 });
      if (!stack) {
        still.add(haystack(p.x, p.z));
        continue;
      }
      stack.position.set(p.x, 0, p.z);
      stack.rotation.y = p.x;
      this.scenery.add(stack);
    }
    this.scenery.add(sprouts(this.plan.field));
    this.scenery.add(bakeGroup(still));
    // The tractor waits on the road below the gate.
    this.tractor = <THREE.Group>this.add('tractor', { depth: 2.6, rotateY: Math.PI }, ROAD_X, TRACTOR_Z, () => boxHouse('#3f8a4f', '#2a3148', 2.2, 1.2, 1.4), 0);
  }

  /** The power sources and the gate are part of the map: they cannot be moved. */
  private placeParts() {
    // A pole by every yard, so wires stay short; the sun runs the mill, the wind the fountain.
    const put = (kind: PartKind, p: THREE.Vector3) => this.pin(kind, p);
    put('pole', at('cow', -10, 2.6));
    put('pole', at('pig', 3.6, -1.4));
    put('pole', at('hen', 1.8, 4.4));
    put('pole', at('rabbit', -7.6, 6.4));
    put('solar', at('sheep', -20, -7.6));
    put('windGen', at('pond', 24.2, 8));
    this.gate = put('gate', GATE) as Gate;
  }

  /** The fox walks on its paws (its rigged model, when that is there); the puppy is the dog, smaller. */
  protected critterModel(base: string, fit: Fit, name: string): THREE.Object3D {
    return (base === 'fox' ? model('fox-rig', fit) : null) ?? model(MODEL_OF[base] ?? base, fit) ?? STAND_INS[base]?.() ?? blob(name);
  }

  private buildCritters() {
    this.critter('cow', { width: 2.4 }, at('cow', -11, -2.4), 1.9, 0.25);
    this.critter('pig', { width: 1.7 }, at('pig', 1.8, -7.4), 1.2, 0.3);
    this.critter('sheep', { width: 1.7, rotateY: -Math.PI / 2 }, at('sheep', -23.6, -12.6), 1.3, 0.2);
    this.critter('sheep2', { width: 1.5, rotateY: -Math.PI / 2 }, at('sheep', -25, -15), 1.2, -0.5);
    // Ducklings wait at the edge of the pond (they swim round the fountain once it plays).
    this.critter('duck', { height: 0.9, rotateY: -Math.PI / 2 }, v(POND.x + 2.2 * K, POND.z + 1.4 * K), 0.9, Math.PI);
    this.critter('duck2', { height: 0.8, rotateY: -Math.PI / 2 }, v(POND.x + 3.1 * K, POND.z + 0.6 * K), 0.8, Math.PI);
    this.critter('duck3', { height: 0.8, rotateY: -Math.PI / 2 }, v(POND.x + 2.6 * K, POND.z - 0.5 * K), 0.8, Math.PI);
    this.critter('hen', { height: 1.25 }, at('hen', -0.8, 8.6), 1.25, -0.4);
    this.critter('hen2', { height: 1.1 }, at('hen', -1.9, 9.6), 1.1, 0.6);
    this.critter('rabbit', { height: 1.25 }, at('rabbit', -11.7, 7.6), 1.25, 0.2);
    this.critter('dog', { height: 1.5 }, at('dog', 4.4, 8.6), 1.5, -0.6);
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
  }

  private buildNeeds() {
    const near = (kinds: PartKind[], at: THREE.Vector3, r: number) => () =>
      this.world.parts.some((p) => kinds.includes(p.kind) && isActive(p) && p.root.position.distanceTo(at) < r);
    const get = (name: string) => this.critters.get(name)!;
    const cow = get('cow');
    const add = (n: NeedSpec) => this.addNeed(n);
    const FANS: PartKind[] = ['fan', 'floorFan', 'pcFan'];
    // Day.
    add({ critter: cow, phase: 'day', ask: 'cowHot', thanks: 'cowHappy', icon: 'fan', kinds: FANS, spot: at('cow', -8.6, -2.4), met: near(FANS, cow.home, 4.2 * K) });
    add({ critter: get('pig'), phase: 'day', ask: 'pigThirsty', thanks: 'pigHappy', icon: 'pump', kinds: ['pump'], spot: v(TROUGH.x - 1.9, TROUGH.z + 0.2), met: () => this.troughLevel > 0.95 });
    add({ critter: get('tractor'), phase: 'day', ask: 'gateStuck', thanks: 'gateHappy', icon: 'gate', kinds: [], spot: at('field', 6.3, 3.6), met: () => this.gate.open > 0.97 });
    add({ critter: get('sheep'), phase: 'day', ask: 'sheepMill', thanks: 'sheepHappy', icon: 'windmill', kinds: ['windmill'], spot: MILL.clone(), met: () => this.millLevel >= 1 });
    // Evening.
    add({ critter: get('hen'), phase: 'evening', ask: 'henDark', thanks: 'henHappy', icon: 'bulb', kinds: ['bulb', 'led'], spot: at('hen', 0.9, 6.6), met: near(['bulb', 'led'], at('hen', -1.5, 8), 4.8 * K) });
    add({ critter: get('rabbit'), phase: 'evening', ask: 'rabbitCold', thanks: 'rabbitHappy', icon: 'heater', kinds: ['heater'], spot: at('rabbit', -9.2, 7.6), met: near(['heater'], at('rabbit', -12.6, 7), 4.2 * K) });
    add({ critter: cow, phase: 'evening', ask: 'cowSleepy', thanks: 'cowSleep', icon: 'musicbox', kinds: ['musicbox'], spot: at('cow', -13.6, -1.3), met: near(['musicbox'], cow.home, 4.5 * K), sticker: 'cow' });
    // Night: the dog warns about the fox; a button on the path and a bell chase it off.
    add({ critter: get('dog'), phase: 'night', ask: 'foxTip', thanks: 'foxScared', icon: 'button', kinds: ['button'], hintPhrase: 'foxTip', spot: FOX_BUTTON.clone(), focus: [FOX_BUTTON.clone(), BELL_SPOT.clone()], met: () => this.foxChased, sticker: 'fox' });
    // Morning: the ducklings want a fountain.
    add({ critter: get('duck'), phase: 'morning', ask: 'ducksAsk', thanks: 'ducksHappy', icon: 'pump', kinds: ['pump'], spot: v(POND.x + 2.2 * K, POND.z - 4.3 * K), met: () => this.fountainLevel > 0.95 });
  }

  /**
   * Clumps of wild flowers on the grass (sculpted, or little flat ones without the
   * model) — sown last, so they keep off every ring, animal and pole.
   */
  private sowFlowers() {
    const taken = [...this.needs.map((n) => n.spot), ...[...this.critters.values()].map((c) => c.home), ...this.world.parts.map((p) => p.root.position)];
    const free = (x: number, z: number) => this.flowerFree(x, z) && taken.every((t) => Math.hypot(x - t.x, z - t.z) > 2.6);
    const spots: [number, number, number][] = [];
    for (let tries = 0; spots.length < 110 && tries < 5000; tries++) {
      const x = (Math.random() - 0.5) * (W - 3);
      const z = (Math.random() - 0.5) * (D - 3);
      if (free(x, z) && spots.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 2)) spots.push([x, z, 0.8 + Math.random() * 0.45]);
    }
    this.scenery.add(instances('flower-cluster', { height: 0.45 }, spots) ?? flowers(this.plan, 160, free));
  }

  // ───────────────────────── Day two ─────────────────────────
  // New animals live on the farm from the start; they ask for help on the second day.

  private buildPlacesTwo() {
    const still = new THREE.Group();
    still.add(loft(LOFT));
    this.fences.push([v(GOATS.x - 3.5 * K, GOATS.z + 2.6 * K), v(GOATS.x - 3.5 * K, GOATS.z - 3.2 * K), v(GOATS.x + 3.5 * K, GOATS.z - 3.2 * K), v(GOATS.x + 3.5 * K, GOATS.z + 2.6 * K)]);
    this.scenery.add(bakeGroup(still));
    this.add('stable', { width: 4.2, rotateY: -Math.PI / 2 }, STABLE.x, STABLE.z, () => boxHouse('#b5653a', '#5a5f6a', 4, 2.8, 3.4));
    const buds = this.add('flowerbed-buds', { width: 2.6 }, BED.x, BED.z, () => flowerBed(false));
    const bloom = this.add('flowerbed-bloom', { width: 2.6 }, BED.x, BED.z, () => flowerBed(true));
    bloom.visible = false;
    this.beds = { buds, bloom };
    // Three eggs in the nest; they crack open when the chicks hatch.
    for (let i = 0; i < 3; i++) {
      const e = egg();
      e.position.set(NEST.x + (i - 1) * 0.3, 0.2, NEST.z + (i % 2) * 0.2 - 0.1);
      this.eggs.push(e);
      this.scenery.add(e);
    }
    // Bees, out once the flowers bloom.
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(255,205,60,0.95)'), transparent: true, depthWrite: false, opacity: 0 }));
      b.scale.setScalar(0.3);
      this.bees.push(b);
      this.scenery.add(b);
    }
  }

  /**
   * The gate's pole, then day two's poles, pinned after day one's: saved wires
   * find map parts by their order, so new ones only ever go at the end.
   */
  private placePartsTwo() {
    for (const p of [GATE_POLE, FOX_POLE, ...(this.dayTwo ? POLES_TWO : [])]) {
      const pole = this.world.addPart('pole', p.x, p.z, { locked: true, appear: false });
      pole.pinned = true;
    }
  }

  private buildCrittersTwo() {
    const kitten = this.critter('kitten', { height: 0.75 }, LOFT.clone().add(v(0.3, 0.2)), 0.75, -0.6);
    kitten.base = LOFT_TOP;
    this.critter('goat', { width: 1.6 }, v(GOATS.x - 1.6, GOATS.z - 1.2), 1.4, 0.3);
    this.critter('kid', { width: 1 }, v(GOATS.x + 0.8, GOATS.z - 0.4), 0.9, -0.4);
    this.critter('kid2', { width: 0.95 }, v(GOATS.x + 1.8, GOATS.z + 0.8), 0.9, 2.2);
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

  private buildNeedsTwo() {
    const get = (name: string) => this.critters.get(name)!;
    const FANS: PartKind[] = ['fan', 'floorFan', 'pcFan'];
    const near = (kinds: PartKind[], at: THREE.Vector3, r: number) => () =>
      this.world.parts.some((p) => kinds.includes(p.kind) && isActive(p) && p.root.position.distanceTo(at) < r);
    const two = (n: NeedSpec) => this.addNeed({ ...n, day: 2 });
    two({ critter: get('kitten'), phase: 'day', ask: 'kittenStuck', thanks: 'kittenHappy', icon: 'lift', kinds: ['lift'], spot: LIFT_SPOT, met: () => this.kitten === 'down' });
    two({ critter: get('goat'), phase: 'day', ask: 'goatsAsk', thanks: 'goatsHappy', icon: 'carousel', kinds: ['carousel'], spot: CAROUSEL_SPOT, met: () => this.rideT > 3 });
    two({ critter: get('beehive'), phase: 'day', ask: 'beesAsk', thanks: 'beesHappy', icon: 'pump', kinds: ['pump'], spot: BED_PUMP, met: () => this.bloom >= 1, sticker: 'bee' });
    two({ critter: get('horse'), phase: 'day', ask: 'horseHot', thanks: 'horseHappy', icon: 'fan', kinds: FANS, spot: HORSE_FAN, met: near(FANS, HORSE, 4.2 * K) });
    two({ critter: get('puppy'), phase: 'day', ask: 'puppyAsk', thanks: 'puppyHappy', icon: 'launcher', kinds: ['launcher'], spot: LAUNCH_SPOT, met: () => this.caught >= 2 });
    two({ critter: get('nest'), phase: 'evening', ask: 'eggsCold', thanks: 'chicksHatched', icon: 'heater', kinds: ['heater', 'bulb'], spot: NEST_SPOT, met: () => this.warmth >= 1, sticker: 'chick' });
    two({ critter: get('goose'), phase: 'evening', ask: 'geeseDark', thanks: 'geeseHappy', icon: 'led', kinds: ['led', 'bulb'], spot: GEESE_SPOT, met: near(['led', 'bulb'], GEESE, 4 * K) });
    two({
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

  /** Where the kids and the puppy go back to between rides and games. */
  private rest = new Map<string, THREE.Vector3>();
  private liftWaitT = 0;

  private updateDayTwo(dt: number) {
    if (!this.dayTwo) return;
    const today = this.day === 2;
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
    if (watering && this.day === 2) this.bloom = Math.min(1, this.bloom + dt * 0.3);
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
    const two = this.day === 2;
    if (p === 'day' && two) this.hooks.say('dayTwo');
    if (p === 'evening') this.hooks.say('evening');
    if (p === 'night') {
      this.foxT = 0;
      if (!this.foxChased) this.hooks.say('foxComes');
    }
    if (p === 'morning') this.hooks.say(two ? 'roosterAsk' : 'ducksAsk');
    if (p === 'done') this.hooks.say('morning');
  }

  /** After the first morning a second day begins, with new animals asking for help. */
  protected after(p: Phase) {
    if (p === 'morning' && this.day === 1 && this.dayTwo) return { next: 'day' as Phase, wait: 4, first: () => (this.day = 2) };
    return super.after(p);
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

  /** The fox's button is down: now a bell (or buzzer) to go with it. */
  protected extraHint(trayLeft: (k: PartKind) => number): Hint | null {
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
    // Up the road, through the gate, then round and round the field.
    this.tractorT += dt;
    const t = this.tractorT;
    const p = this.tractor.position;
    if (t < 4) {
      p.set(ROAD_X, 0, TRACTOR_Z - t * 2.1 * K);
      this.tractor.rotation.y = 0;
    } else {
      const a = (t - 4) * 0.35;
      const target = new THREE.Vector3(FIELD.x + (Math.cos(a) * 3.6 - 0.5) * K, 0, FIELD.z + (Math.sin(a) * 4.6 + 0.75) * K);
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

/** From the wood in the corner, below the rabbits, up to the coop. */
/** How high each button's top is, for the fox stepping onto it. */
const buttonTops = new WeakMap<Part, number>();
/** Where the fox's button goes: on its path, a short walk out of the wood. */
const FOX_BUTTON = G(-13.5, 15.6);
const FOX_PATH = [G(-22.5, 19.5), G(-20.5, 17), FOX_BUTTON, G(-8, 14.4), at('hen', -4.8, 10.2)];
/** The fox's speed (units a second) sneaking up and running off, and how fast its walk clip plays then. */
const FOX_SNEAK = 1.2;
const FOX_RUN = 4.5;
// The rig's steps are short: the clip runs fast so the paws keep up with the ground (Codex measured the stride).
const FOX_WALK_SNEAK = 3;
// Running off, a little short of keeping pace: any faster and the legs blur.
const FOX_WALK_RUN = 7;
/** Where a hint asks for the bell: by the fox's button, off its path. */
const BELL_SPOT = FOX_BUTTON.clone().add(v(2.7 * K, -3.2 * K));
/** A pole of its own by the fox's path, so the button and the bell need short wires. */
const FOX_POLE = FOX_BUTTON.clone().add(v(1.7, -5.7));
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

/** Where the lanes, the field, the mud and the hill lie (painted by src/ground.ts). */
function groundPlan(): GroundPlan {
  const [cx, cz] = [L('cow', -15.5, -6.5).x, L('cow', -15.5, -6.5).z];
  const coop = at('hen', -3.2, 7.2);
  const hutchAt = at('rabbit', -14, 6.6);
  const lanes: GroundPlan['lanes'] = [
    // The road from the bottom edge through the gate into the field.
    { pts: [[ROAD_X, D / 2], [ROAD_X, GATE.z], [ROAD_X, FIELD.z + 2 * K], [FIELD.x, FIELD.z + K]], w: 2.6 },
    // The lane from the cow pen along the yards to the road, and lanes off it to the coop and the hutch.
    // (These wander a little, like trodden paths; the road and the fox's path stay as they are walked.)
    { pts: wander([[cx, cz], [cx, LANE_Z], [ROAD_X, LANE_Z]], 1), w: 1.6 },
    { pts: wander([[coop.x, LANE_Z], [coop.x, coop.z - 2.4]], 2), w: 1.3 },
    { pts: wander([[cx, LANE_Z], [hutchAt.x + 2.5, hutchAt.z - 2]], 3), w: 1.2 },
    // Up the hill to the mill, and down to the pond.
    { pts: wander([[cx, cz], [G(-21, -9.5).x, G(-21, -9.5).z], [MILL.x + K, MILL.z + 2.5 * K]], 4), w: 1.3 },
    { pts: wander([[ROAD_X, G(0, 10).z], [G(20, 11).x, G(20, 11).z], [POND.x + 0.6 * K, POND.z - 4.4 * K]], 5), w: 1.2 },
    // The fox's path out of the wood.
    { pts: FOX_PATH.map((q) => [q.x, q.z] as [number, number]).reverse(), w: 1.1 },
  ];
  const f0 = at('field', 9.5, -11.5);
  const f1 = at('field', 18.5, 2);
  const mud = at('pig', 1.6, -6.2);
  return {
    width: W,
    depth: D,
    lanes,
    field: { x0: f0.x, z0: f0.z, x1: f1.x, z1: f1.z },
    mud: [{ x: mud.x, z: mud.z, rx: 2.4 * K, rz: 1.6 * K }],
    hill: { x: MILL.x - 2 * K, z: MILL.z - 0.5 * K, rx: 9 * K, rz: 7 * K },
  };
}

/**
 * A lane that wanders gently instead of running ruler-straight: each stretch
 * bends to and fro a little, its ends (and so the corners) staying put.
 */
function wander(pts: [number, number][], seed: number): [number, number][] {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.round(len / 1.5));
    const [nx, nz] = [-(bz - az) / len, (bx - ax) / len];
    const amp = Math.min(1.1, len * 0.04);
    const phase = seed * 1.7 + i;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const off = amp * Math.sin(Math.PI * t) * Math.sin(t * len * 0.35 + phase);
      out.push([ax + (bx - ax) * t + nx * off, az + (bz - az) * t + nz * off]);
    }
  }
  return out;
}

/** The duck pond (its bed, water and shore). */
const POND_SIZE = { rx: 5.1 * K, rz: 3.3 * K };

function hutch({ x, z }: THREE.Vector3): THREE.Group {
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

function kennel({ x, z }: THREE.Vector3): THREE.Group {
  const sculpt = model('doghouse', { width: 1.6 });
  if (sculpt) {
    sculpt.position.set(x, 0, z);
    sculpt.rotation.y = -0.4;
    return sculpt;
  }
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

/**
 * The farm's fences from the sculpted section (a post with two rails reaching
 * to the next post, 2 long) and a lone post to close each run: sections are
 * stretched a little to fit each stretch exactly. Code-built fences without them.
 */
function fences(lines: THREE.Vector3[][]): THREE.Object3D {
  const section = model('fence', { height: 0.8 });
  const post = model('fence-post', { height: 0.8 });
  if (!section || !post) {
    const built = new THREE.Group();
    for (const line of lines) built.add(fence(line));
    return bakeGroup(built);
  }
  // model() centres the section; its post's axis was 2 short of the rails' far end.
  section.updateMatrixWorld(true);
  const start = new THREE.Box3().setFromObject(section).max.x - 2;
  const up = new THREE.Vector3(0, 1, 0);
  const sections: THREE.Matrix4[] = [];
  const posts: THREE.Matrix4[] = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const len = a.distanceTo(b);
      const n = Math.max(1, Math.round(len / 2));
      const turn = new THREE.Quaternion().setFromAxisAngle(up, -Math.atan2(b.z - a.z, b.x - a.x));
      for (let k = 0; k < n; k++) {
        const p = a.clone().lerp(b, k / n);
        sections.push(new THREE.Matrix4().compose(p, turn, new THREE.Vector3(len / n / 2, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(-start, 0, 0)));
      }
    }
    posts.push(new THREE.Matrix4().makeTranslation(line[line.length - 1].x, 0, line[line.length - 1].z));
  }
  return new THREE.Group().add(patched(section, sections), patched(post, posts));
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

function haystack(x: number, z: number): THREE.Mesh {
  const m = mesh(new THREE.SphereGeometry(0.9, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e3c25a', 0.9));
  m.scale.y = 1.1;
  m.position.set(x, 0, z);
  return m;
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
 * Where the trees and bushes grow: a wood in the bottom-left corner (the
 * fox's), a ring along the board's edge and small groves, oaks and pines mixed,
 * with bushes between — never on a lane, in the field or in a yard. Always the
 * same (a fixed seed).
 */
function greeneryFor(plan: GroundPlan) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const clear: [THREE.Vector3, number][] = Object.entries(SITES).map(([name, [x, z]]) => [
    v(x * S, z * S),
    name === 'field' ? 20 : name === 'pond' || name === 'sheep' ? 15 : 11,
  ]);
  const f = plan.field;
  type Item = [number, number, number];
  const all: Item[] = [];
  const ok = (x: number, z: number, room: number, yard: number) =>
    Math.abs(x) < W / 2 - 1.5 &&
    Math.abs(z) < D / 2 - 1.5 &&
    !onLane(plan, x, z, room) &&
    !(x > f.x0 - 3 && x < f.x1 + 3 && z > f.z0 - 3 && z < f.z1 + 3) &&
    clear.every(([c, r]) => Math.hypot(x - c.x, z - c.z) > r - yard) &&
    all.every(([tx, tz]) => Math.hypot(x - tx, z - tz) > room + 0.6);
  const oak: Item[] = [];
  const pine: Item[] = [];
  const bush: Item[] = [];
  const tree = (x: number, z: number, pines: number) => {
    if (!ok(x, z, 2, 0)) return;
    const it: Item = [x, z, 0.85 + rnd() * 0.45];
    all.push(it);
    (rnd() < pines ? pine : oak).push(it);
  };
  // The fox's wood: mostly pines.
  const wood = G(-25, 19.5);
  for (let i = 0; i < 160; i++) tree(wood.x + (rnd() - 0.5) * 30, wood.z + (rnd() - 0.5) * 16, 0.6);
  // Along the edges.
  for (let x = -W / 2 + 3; x < W / 2 - 2; x += 6) {
    tree(x + (rnd() - 0.5) * 3, -D / 2 + 2.5 + rnd() * 2, 0.4);
    tree(x + (rnd() - 0.5) * 3, D / 2 - 2.5 - rnd() * 2, 0.4);
  }
  for (let z = -D / 2 + 6; z < D / 2 - 5; z += 6) {
    tree(-W / 2 + 2.5 + rnd() * 2, z + (rnd() - 0.5) * 3, 0.4);
    tree(W / 2 - 2.5 - rnd() * 2, z + (rnd() - 0.5) * 3, 0.4);
  }
  // Small groves in the open.
  for (let g = 0; g < 14; g++) {
    const cx = (rnd() - 0.5) * (W - 16);
    const cz = (rnd() - 0.5) * (D - 12);
    for (let i = 0; i < 5; i++) tree(cx + (rnd() - 0.5) * 7, cz + (rnd() - 0.5) * 6, 0.3);
  }
  // Bushes: at the feet of the trees and in twos and threes on the grass (they may come a little closer to the yards).
  for (const [tx, tz] of [...all]) {
    if (rnd() < 0.35) {
      const a = rnd() * Math.PI * 2;
      const x = tx + Math.cos(a) * 2.2;
      const z = tz + Math.sin(a) * 2.2;
      if (ok(x, z, 1, 2)) {
        const it: Item = [x, z, 0.7 + rnd() * 0.5];
        all.push(it);
        bush.push(it);
      }
    }
  }
  for (let g = 0; g < 40; g++) {
    const cx = (rnd() - 0.5) * (W - 8);
    const cz = (rnd() - 0.5) * (D - 8);
    for (let i = 0; i < 3; i++) {
      const x = cx + (rnd() - 0.5) * 3;
      const z = cz + (rnd() - 0.5) * 2;
      if (!ok(x, z, 1, 2)) continue;
      const it: Item = [x, z, 0.7 + rnd() * 0.5];
      all.push(it);
      bush.push(it);
    }
  }
  // Mossy rocks at the edges of the groves and here and there in the open.
  const rock: Item[] = [];
  for (const [tx, tz] of oak.concat(pine)) {
    if (rnd() > 0.12) continue;
    const a = rnd() * Math.PI * 2;
    const x = tx + Math.cos(a) * 2.6;
    const z = tz + Math.sin(a) * 2.6;
    if (ok(x, z, 1.2, 0)) {
      const it: Item = [x, z, 0.7 + rnd() * 0.5];
      all.push(it);
      rock.push(it);
    }
  }
  return { oak, pine, bush, rock };
}
