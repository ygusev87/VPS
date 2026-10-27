// The city: a busy toy town round a park, with a canal, a building site, a
// car park and a car wash. It is a level of its own: most helps are built
// from the city's own devices, each with a chain of parts. By day the cars
// want a traffic light, the tram its substation behind a switch, the baker
// an oven and a belt for the loaves, the drivers a barrier (held open with a
// button), the children a Ferris wheel on a wind generator (no pole in the
// park), a muddy car a car wash with a pump, grandma a lift on a button for
// her shopping, the builder a tower crane on a switch, the boat a drawbridge
// on a button; in the evening a kitten wants three street lamps that light
// in the dark, the club a neon sign whose light starts the music through a
// light sensor, the firemen their engine, a ladder for the cat on the burning
// roof and a pump at the hydrant; at night dominoes on the raccoon's path
// ring the alarm; in the morning a laser beam round a mirror onto a light
// sensor rings the school bell.
import * as THREE from 'three';
import { DECOR, FENCES, MEADOW, PATHS, PONDS, SOIL } from './city-decor';
import { dressing, toSegment } from './decor';
import { boardEdge, flowers, groundMaterial, onLane, pond, tiledMaterial, type GroundPlan } from './ground';
import { cards, cellRegion, decal, grassMaterial, hasKit, kitPieces, ribbons, roadNet, roadRuns, roadTiles, standees, tiledDecal, tiledRects, toned } from './kit';

type Rect = { x0: number; z0: number; x1: number; z1: number };
import { sandboxHint, type Hint } from './hints';
import { clipsOf, hasModel, model, type Fit } from './parts/assets';
import type { Part, PartKind } from './parts/base';
import { Belt, Domino } from './parts/chain';
import { Barrier, CarWash, Drawbridge, DuskLamp, FerrisWheel, FireLadder, Substation, TowerCrane } from './parts/city';
import { Pump } from './parts/farm';
import { FireTruck } from './parts/fun';
import { bakeGroup, mat, mesh } from './parts/kit';
import { glowFor } from './parts/models';
import { Lift } from './parts/more';
import { AMBIENT } from './parts/wind';
import { StoryMap, blob, boxHouse, instances, v, type Critter, type MapProgress, type Need, type NeedSpec, type Phase } from './storymap';
import type { PhraseId } from './voice';
import { activeAt, isActive } from './world';

/** Model files the city needs (each falls back to a stand-in until it is made). */
export const CITY_MODELS = ['pole', 'baker', 'grandma', 'child', 'kitten', 'raccoon', 'raccoon-rig', 'tram', 'car', 'fountain-basin', 'bench', 'street-lamp', 'bins', 'pigeon',
  'tree-oak', 'tree-pine', 'bush', 'flower-cluster', 'boat', 'builder', 'firefighter', 'shopkeeper', 'counter', 'hydrant', 'basket',
  ...DECOR.map((g) => g.model)].filter((m, i, all) => all.indexOf(m) === i);

/** What the drawers offer in the city: its own devices, and the parts their chains need (power from the poles). */
export const CITY_TRAY: { kind: PartKind; count: number }[] = [
  { kind: 'trafficLight', count: 1 },
  { kind: 'barrier', count: 1 },
  { kind: 'ferris', count: 1 },
  { kind: 'carWash', count: 1 },
  { kind: 'towerCrane', count: 1 },
  { kind: 'drawbridge', count: 1 },
  { kind: 'duskLamp', count: 3 },
  { kind: 'neon', count: 1 },
  { kind: 'ladder', count: 1 },
  { kind: 'firetruck', count: 1 },
  { kind: 'switch', count: 2 },
  { kind: 'button', count: 3 },
  { kind: 'heater', count: 1 },
  { kind: 'belt', count: 1 },
  { kind: 'windGen', count: 1 },
  { kind: 'pump', count: 2 },
  { kind: 'lift', count: 1 },
  { kind: 'lightSensor', count: 2 },
  { kind: 'musicbox', count: 1 },
  { kind: 'domino', count: 1 },
  { kind: 'bell', count: 2 },
  { kind: 'laser', count: 1 },
  { kind: 'mirror', count: 1 },
];

/** Bumped whenever the city is laid out anew (a save on another layout starts it afresh). */
export const CITY_LAYOUT = 3;

export interface CityProgress extends MapProgress {
  /** Loaves the belt has brought to the counter. */
  bread: number;
  fire: number;
  raccoonChased: boolean;
  parked: number;
  washed: number;
  floors: number;
  boat: number;
  catSaved: boolean;
}

const W = 110;
const D = 75;

// The town: a ring road round the park, roads out from its middle sides, a tram line along the south, a canal in the east.
const RING = { x: 20, z: 12 };
const TRAM_Z = 27;
const ROAD = 6;
/** The canal: a straight strip of water from the north edge down to the harbour. */
const CANAL = { x: 37, w: 3.2, z0: -D / 2, z1: 17 };
const HARBOR = { x: 37, z: 19.5, rx: 5, rz: 3.2 };
/** The crossing south of the park, where the cars wait for a traffic light. */
const CROSS = v(0, RING.z);
const LIGHT_SPOT = v(5.5, RING.z + 5.5);
const LIGHT_POLE = v(10.5, RING.z + 7.5);
/** The tram's substation by the line, and the switch that has to be in its circuit. */
const SUBSTATION = v(-30, TRAM_Z + 4.5);
const TRAM_SWITCH = v(-26.5, TRAM_Z + 7.5);
const SUB_POLE = v(-23.5, TRAM_Z + 4.5);
/** The bakery north of the ring: the heater by the oven, the belt to the counter by the baker. */
const OVEN_SPOT = v(-12, -21.5);
const BELT_SPOT = v(-8.5, -18.5);
const COUNTER = v(-5, -18.6);
const BAKER = v(-6, -21.8);
const BAKERY_POLE = v(-12.5, -17);
/** The car park west: a barrier over its drive, held up with a button while the cars go in. */
const BARRIER_SPOT = v(-34, -4.5);
const PARK_BUTTON = v(-29.5, -8.5);
const PARK_POLE = v(-28.5, -4.5);
const PARK_WAY = [v(-33, 1.5), v(-33, -7.5)];
const PARK_SLOTS = [v(-37, -10), v(-40.5, -10), v(-44, -10)];
/** The park: a Ferris wheel on its own wind generator (no pole in the park), a fountain with pigeons. */
const FERRIS_SPOT = v(7, -3);
const WIND_SPOT = v(12, 3);
const FOUNTAIN = v(-3, 1);
const BASIN_R = 3.2;
/** The car wash south of the west road: the muddy car drives up through it. */
const WASH_SPOT = v(-38, 8);
const WASH_PUMP = v(-33.5, 9);
const WASH_POLE = v(-34.5, 5.5);
const WASH_WAY = [v(-38, 14), v(-38, 8), v(-38, 3.6)];
/** The building site south-west: the crane on a switch builds the house floor by floor. */
const CRANE_SPOT = v(-34, 20);
const CRANE_SWITCH = v(-29.5, 21.5);
const CRANE_POLE = v(-31, 17);
const SITE = v(-41, 20.5);
const BUILDER = v(-37.5, 16.2);
/** Grandma's house north-west: she waits on her balcony for the lift to bring her shopping up. */
const LIFT_SPOT = v(-38.6, -26.5);
const LIFT_BUTTON = v(-34.5, -27.5);
const HOUSE_POLE = v(-34, -23);
const BALCONY = v(LIFT_SPOT.x - 1.5, LIFT_SPOT.z - 0.25);
const BALCONY_TOP = 1.95;
const GRANDMA = v(BALCONY.x - 0.35, BALCONY.z);
/** Her basket of shopping, on the pavement by the lift till it rides up. */
const BASKET = v(LIFT_SPOT.x + 0.4, LIFT_SPOT.z + 2.2);
/** The drawbridge where the east road crosses the canal; the boat waits north of it. */
const BRIDGE_SPOT = v(35.9, 0);
const BRIDGE_BUTTON = v(31.5, -8.5);
const BRIDGE_POLE = v(31, -4.5);
const BOAT_WAY = [v(CANAL.x, -10), v(CANAL.x, HARBOR.z - 0.5)];
/** Evening: a kitten in the park, three street lamps on its way home to the cat house in the corner. */
const KITTEN = v(-13, -5.5);
const LAMPS = [v(-11.5, -2.5), v(-15.2, 1), v(-11.5, 4.5)];
const KITTEN_WAY = [KITTEN, v(-13.5, -2), v(-13.6, 2.5), v(-14.6, 6)];
const KITTEN_POLE = v(-8.5, 1);
/** The club east of the canal: the neon sign, a light sensor in its light, the music box behind it. */
const NEON_SPOT = v(43, -9.5);
const CLUB_SENSOR = v(43, -7.6);
const MUSIC_SPOT = v(46.5, -6.8);
const CLUB_POLE = v(40.5, -11.5);
/** The fire station by the ring, the house burning across the canal with a cat on its roof, a pump at its hydrant. */
const ENGINE_SPOT = v(25.5, 13.5);
const STATION_POLE = v(24, 17.5);
const BURNING = v(48, 8);
const BURNING_TOP = 3.7;
const LADDER_SPOT = v(43.5, 9.5);
const HYDRANT_SPOT = v(44, 14);
const FIRE_POLE = v(40.5, 12.5);
/** Night: the raccoon's path from the corner of the board to the toy shop's bins, dominoes across it. */
const BINS = v(45, -22.5);
const DOMINO_SPOT = v(48, -33);
const RACCOON_PATH = [v(56, -37), v(52, -34), DOMINO_SPOT, v(45.5, -29), v(45.3, -24)];
const ALARM_SPOT = v(50.5, -29.5);
const SHOP_POLE = v(53, -31);
const SHOPKEEPER = v(47.5, -19);
/**
 * Morning: the school north of the ring. A laser shines along its side to a
 * mirror, the mirror turns the beam onto a light sensor, and the sensor rings
 * the bell by the door.
 */
const LASER_SPOT = v(17, -22);
const MIRROR_SPOT = v(24, -22);
const SCHOOL_SENSOR = v(24, -16.5);
const SCHOOL_BELL = v(17, -17.5);
const SCHOOL_POLE = v(20.5, -19.2);
const SCHOOL_DOOR = v(11, -25.5);

/** What each one says when poked. */
const CITY_VOICES: Record<string, PhraseId> = {
  car: 'beep', tram: 'tramDing', baker: 'yum', pigeon: 'coo', grandma: 'grannyOh', kitten: 'meow', cat: 'meow', child: 'giggle',
  firefighter: 'siren', shopkeeper: 'shopHello', builder: 'hammer', boat: 'toot',
};
/** Wall, roof and height of each building, for the painted boxes that stand in until it is sculpted. */
const HOUSES: Record<string, [string, string, number]> = {
  'grandma-house': ['#f2c2a2', '#c84a3a', 4.2], 'fire-station': ['#e05a4a', '#5a5f6a', 3.2], school: ['#f2d06b', '#3f86d6', 3.8], 'toy-shop': ['#b7a6f0', '#ff8fb1', 3.2],
  club: ['#5aa6d6', '#f2c230', 3.4], 'house-a': ['#a3d0f0', '#d8483c', 3.2], 'house-b': ['#f6b0a0', '#3f86d6', 3.4], 'house-c': ['#c8e6a0', '#c84a3a', 3], bakery: ['#f6e3b8', '#d8483c', 3.2],
};
/** Characters drawn with another one's model. */
const MODEL_OF: Record<string, string> = { cat: 'kitten' };

const r2 = (n: number) => Math.round(n * 100) / 100;

export class CityMap extends StoryMap {
  protected readonly width = W;
  protected readonly depth = D;
  readonly layout = CITY_LAYOUT;
  protected readonly intro = 'cityIntro';
  readonly ownHints = true;
  private plan!: GroundPlan;
  /** The ground is Codex's painted kit (src/kit.ts), not the old shader. */
  private kit = false;
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
  /** The cars going into the car park (s: how far along), and how many are in. */
  private parkers: { c: Critter; s: number }[] = [];
  parked = 0;
  /** The muddy car's way through the car wash (0..1), its mud. */
  washed = 0;
  private dirty!: Critter;
  private mud: THREE.Mesh[] = [];
  /** Floors of the house on the building site (0..3), and the crane's count when it was put up. */
  floors = 0;
  private floorMeshes: THREE.Object3D[] = [];
  private craneSeen = -1;
  /** The boat's way down the canal to the harbour (0..1). */
  boat = 0;
  private boatCritter!: Critter;
  /** Grandma's basket on the pavement, riding up in the lift, or up on her balcony. */
  private grandma: 'waiting' | 'riding' | 'home' = 'waiting';
  private basket!: THREE.Object3D;
  private liftWaitT = 0;
  /** The children going round and round on the wheel (seconds). */
  private rideT = 0;
  fountainLevel = 1;
  private spray: THREE.Sprite[] = [];
  /** The kitten on its way home along the lamps (0..1). */
  private kittenWalk = 0;
  /** The fire engine's and the pump's work: at 1 the smoke is out. */
  fire = 0;
  private smoke: THREE.Sprite[] = [];
  /** The cat on the burning roof: down the ladder once it reaches up (0..1). */
  private catDown = 0;
  catSaved = false;
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
    if (this.kit && GREEN) this.greenBlocks();
    this.dress();
    this.sowFlowers();
    // A steady breeze for the park's wind generator.
    AMBIENT.strength = 0.55;
    AMBIENT.dir.set(-0.7, 0, 0.7).normalize();
  }

  protected cleanup() {
    AMBIENT.strength = 0;
    DuskLamp.dark = 0;
  }

  protected saveExtra() {
    return { bread: r2(this.bread), fire: r2(this.fire), raccoonChased: this.raccoonChased, parked: this.parked, washed: r2(this.washed), floors: this.floors, boat: r2(this.boat), catSaved: this.catSaved };
  }

  protected restoreExtra(m: MapProgress) {
    const p = m as CityProgress;
    this.bread = this.baked = Math.round(p.bread ?? 0);
    this.loaves.forEach((l, i) => (l.s = i < this.bread ? Infinity : -1));
    this.fire = p.fire ?? 0;
    this.raccoonChased = !!p.raccoonChased;
    const done = (name: string) => this.needs.some((n) => n.done && n.critter.name === name);
    this.driving = done('car');
    this.parked = done('car4') ? 3 : 0;
    if (this.parked) this.parkers.forEach((pk, i) => this.putParked(pk, i));
    this.washed = done('car7') ? 1 : 0;
    this.floors = done('builder') ? 3 : 0;
    this.boat = done('boat') ? 1 : 0;
    this.catSaved = done('firefighter');
    if (this.catSaved) this.catDown = 1;
    if (done('grandma')) this.settleGrandma();
    if (done('kitten')) this.kittenWalk = 1;
    if (done('child3')) this.schooling = 1;
    if (this.phase === 'night') this.raccoonT = 0;
  }

  protected voiceOf(base: string): PhraseId | null {
    return CITY_VOICES[base] ?? null;
  }

  protected critterModel(base: string, fit: Fit, name: string): THREE.Object3D {
    return (base === 'raccoon' ? model('raccoon-rig', fit) : null) ?? model(MODEL_OF[base] ?? base, fit) ?? STAND_INS[base]?.() ?? blob(name);
  }

  // ───────────────────────── Building ─────────────────────────

  private buildBoard() {
    const plan = (this.plan = cityPlan());
    this.kit = hasKit('city', 'paving-main') && !new URLSearchParams(location.search).has('oldground');
    // Paving C is the one with readable joints (Codex's paving-contrast).
    const top = this.kit ? grassMaterial((kitPieces('city', 'paving-main-c', true)[0] ?? kitPieces('city', 'paving-main', true)[0]), null, [], PAVING_TILE, PAVING_TONE, false) : groundMaterial(plan);
    const side = mat('#000000', 1);
    const board = mesh(new THREE.BoxGeometry(W, 0.5, D), [side, side, top, side, side, side] as unknown as THREE.Material);
    board.position.y = -0.26;
    board.receiveShadow = true;
    board.castShadow = false;
    this.scenery.add(board);
    // A light rim and a matte side round the board (see boardEdge).
    this.scenery.add(boardEdge(W, D, 'city'));
    // The kit's roads carry their own dashes and zebras.
    this.scenery.add(roadMarks(!this.kit, !(this.kit && hasKit('city', 'parking-bay')), !(this.kit && hasKit('city', 'tram-rails-strip'))));
    if (this.kit) this.layKit(plan);
    if (!this.kit || !hasKit('city', 'canal-water')) this.scenery.add(canal());
    for (const p of [HARBOR, ...PONDS]) this.scenery.add(pond(p));
  }

  /**
   * The painted kit over the paving (src/kit.ts): road strips between painted
   * corner, tee and crossing tiles, the drives and the tram street, lawns with
   * a stone kerb, the park's own picture, the canal and the harbour.
   */
  private layKit(plan: GroundPlan) {
    const roads = plan.lanes.filter((l) => l.w === ROAD);
    const net = roadNet(roads, plan);
    const strip = kitPieces('city', 'road-strip', true);
    if (strip.length) this.scenery.add(ribbons(roadRuns(net.segs, net.tiles, ROAD * 0.58, ROAD), strip[0], 7 / ROAD, 14, 0.006, 1, 0.02));
    const tile = (n: string) => kitPieces('city', n)[0];
    this.scenery.add(roadTiles(net.tiles, { corner: tile('road-corner'), tee: tile('road-tee'), cross: tile('road-cross'), end: tile('road-end') }, ROAD * 7 / 6));
    // Zebras where the roads leave the ring (as the old painted dashes stood).
    const zebra = kitPieces('city', 'zebra');
    if (zebra.length)
      for (const [x, z, along] of [[0, RING.z + ROAD / 2 + 1.6, 'x'], [0, -RING.z - ROAD / 2 - 1.6, 'x'], [RING.x + ROAD / 2 + 1.6, 0, 'z'], [-RING.x - ROAD / 2 - 1.6, 0, 'z']] as const) {
        const m = decal({ x0: x - 3, z0: z - 1.5, x1: x + 3, z1: z + 1.5 }, zebra[0], 0, 0.0095, 4);
        // The picture's stripes run across a road going north-south; turned for an east-west road.
        if (along === 'z') m.rotation.y = Math.PI / 2;
        this.scenery.add(m);
      }
    // The tram street has its rails painted in (when the kit has them); the drives are plain narrow asphalt.
    const narrow = kitPieces('city', 'road-lane-strip', true);
    const rails = kitPieces('city', 'tram-rails-strip', true);
    const tram = plan.lanes.filter((l) => l.w !== ROAD && l.pts.every(([, z]) => z === TRAM_Z));
    const drives = plan.lanes.filter((l) => l.w !== ROAD && !tram.includes(l));
    // The drives run a little past their ends, so the last parking bay keeps asphalt beyond its line.
    if (narrow.length) this.scenery.add(ribbons(rails.length ? drives : [...drives, ...tram], narrow[0], 5 / 4, 10, 0.0055, 1, 0.3));
    if (rails.length) this.scenery.add(ribbons(tram, rails[0], 1, 8, 0.0055, 1, 0.1));
    // Painted bays where the cars park.
    const bay = kitPieces('city', 'parking-bay');
    // Inside the painted asphalt of the drive (its kerbs take a little of the lane's width).
    for (const s of bay.length ? PARK_SLOTS : []) this.scenery.add(decal({ x0: s.x - 1.65, z0: s.z - 0.8, x1: s.x + 1.65, z1: s.z + 1.6 }, bay[0], 0, 0.009, 3));
    const lawn = kitPieces('city', 'lawn-main', true);
    const kerb = kitPieces('city', 'kerb-strip', true);
    const park = kitPieces('city', 'park-lawn');
    for (const f of GREEN ? [plan.field] : [plan.field, ...(plan.fields ?? [])]) {
      if (f === plan.field && park.length) {
        // The picture's paved circle sits a little off its middle: move the whole lawn so it rings the fountain (Codex's park review).
        const lawn = toned(decal(f, park[0], 0.3, 0.005), GREEN ? PARK_TONE : LAWN_TONE);
        lawn.position.x += 0.092578;
        lawn.position.z += 0.260231;
        this.scenery.add(lawn);
      }
      else if (lawn.length) this.scenery.add(toned(tiledDecal(f, lawn[0], 8), LAWN_TONE));
      if (kerb.length) {
        const loop: [number, number][] = [[f.x0, f.z0], [f.x1, f.z0], [f.x1, f.z1], [f.x0, f.z1], [f.x0, f.z0]];
        this.scenery.add(ribbons([{ pts: loop, w: 0.5 }], kerb[0], 1, 4, 0.0065, 2, 0.5));
      }
    }
    const water = kitPieces('city', 'canal-water', true);
    if (water.length) this.scenery.add(ribbons([{ pts: [[CANAL.x, CANAL.z0], [CANAL.x, CANAL.z1]], w: CANAL.w }], water[0], 1, 6, 0.012, 1, 0));
    const quay = kitPieces('city', 'quay-strip', true);
    if (quay.length)
      for (const dx of [-1, 1]) {
        // Each bank runs so the picture's left side (its stone) is on the land.
        const x = CANAL.x + dx * (CANAL.w / 2 + 0.3);
        const pts: [number, number][] = dx < 0 ? [[x, CANAL.z1], [x, CANAL.z0]] : [[x, CANAL.z0], [x, CANAL.z1]];
        this.scenery.add(ribbons([{ pts, w: 1.2 }], quay[0], 1, 6, 0.013, 2, 0));
      }
    if (!GREEN) this.sowLawns([plan.field, ...(plan.fields ?? [])]);
    const harbour = kitPieces('city', 'harbour-water');
    if (harbour.length) this.scenery.add(decal({ x0: HARBOR.x - HARBOR.rx, z0: HARBOR.z - HARBOR.rz, x1: HARBOR.x + HARBOR.rx, z1: HARBOR.z + HARBOR.rz }, harbour[0], 0.6, 0.014, 2));
  }

  /** The farm's painted tufts, flowers and shrubs on the lawns, thicker at the edges (city-a's full lawns). */
  private sowLawns(lawns: Rect[]) {
    let seed = 31;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const free = (x: number, z: number) => !onLane(this.plan, x, z, 0.6) && !(Math.abs(x - SITE.x) < 4 && Math.abs(z - SITE.z) < 3.5) && this.needs.every((n) => [n.spot, ...n.more.map((m) => m.spot)].every((t) => Math.hypot(x - t.x, z - t.z) > 2.4));
    const sow = (n: number, size: number, edge: number) => {
      const out: { x: number; z: number; size: number }[] = [];
      for (const f of lawns) {
        const area = (f.x1 - f.x0) * (f.z1 - f.z0);
        for (let i = 0; i < Math.round(area * n); i++) {
          // Half of them along the lawn's edge, under the kerb.
          const side = rnd() < edge;
          const x = side && rnd() < 0.5 ? (rnd() < 0.5 ? f.x0 + 0.5 : f.x1 - 0.5) : f.x0 + 0.4 + rnd() * (f.x1 - f.x0 - 0.8);
          const z = side && Math.abs(x - f.x0 - 0.5) > 0.01 && Math.abs(x - f.x1 + 0.5) > 0.01 ? (rnd() < 0.5 ? f.z0 + 0.5 : f.z1 - 0.5) : f.z0 + 0.4 + rnd() * (f.z1 - f.z0 - 0.8);
          if (free(x, z)) out.push({ x, z, size: size * (0.8 + rnd() * 0.4) });
        }
      }
      return out.sort((a, b) => a.z - b.z);
    };
    const tuft = kitPieces('farm', 'tuft-card');
    const flower = kitPieces('farm', 'flower-card');
    const shrub = kitPieces('farm', 'shrub-card');
    if (tuft.length) this.scenery.add(cards(sow(0.35, 0.5, 0.3), tuft));
    if (flower.length) this.scenery.add(cards(sow(0.18, 0.55, 0.4), flower));
    if (shrub.length) this.scenery.add(standees(sow(0.03, 1.1, 0.7), shrub, kitPieces('farm', 'blob-shadow')[0] ?? null));
    const beds = kitPieces('city', 'flowerbed-card');
    if (beds.length) this.scenery.add(standees(sow(0.012, 1.4, 0.8), beds, null));
  }

  /**
   * Green blocks as in city-a: every block is lawn, with paving only where
   * people walk — pavements along the roads and the canal, a court round each
   * task and pole, an apron round each building and a path from its door to
   * the road. Worked out on a grid, so it follows the tasks wherever they are.
   */
  private greenBlocks() {
    const plan = this.plan;
    const lawn = kitPieces('city', 'lawn-main', true);
    if (!lawn.length) return;
    const P = (x: number, z: number, h: number): Rect => ({ x0: x - h, z0: z - h, x1: x + h, z1: z + h });
    const courts: Rect[] = [
      ...this.needs.flatMap((n) => [n.spot, ...n.more.map((m) => m.spot)]).map((t) => P(t.x, t.z, 2.2)),
      ...[...this.poles.keys()].map((t) => P(t.x, t.z, 1.4)),
      ...[...this.critters.values()].filter((c) => !c.roams).map((c) => P(c.home.x, c.home.z, 1.2)),
      P(SUBSTATION.x, SUBSTATION.z, 2.6), P(BINS.x, BINS.z, 1.6), P(COUNTER.x, COUNTER.z, 1.8),
      { x0: SITE.x - 4.2, z0: SITE.z - 3.6, x1: SITE.x + 4.2, z1: SITE.z + 3.6 },
    ];
    // Buildings stand on an apron, with a path from it straight to the nearest road.
    for (const g of DECOR) {
      const size = (g.fit.width ?? 0);
      if (size < 4.5) continue;
      for (const [x, z, , sc] of g.items) {
        const h = (size * sc) / 2 + 0.6;
        courts.push(P(x, z, h));
        let best: Rect | null = null;
        let far = 14;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          for (let d = h; d < far; d += 0.5)
            if (onLane(plan, x + dx * d, z + dz * d, 0)) {
              far = d;
              best = dx ? { x0: Math.min(x, x + dx * d), x1: Math.max(x, x + dx * d), z0: z - 0.8, z1: z + 0.8 } : { x0: x - 0.8, x1: x + 0.8, z0: Math.min(z, z + dz * d), z1: Math.max(z, z + dz * d) };
              break;
            }
        }
        if (best) courts.push(best);
      }
    }
    // The raccoon runs over the grass at night; the cars keep to paving.
    const lines = [WASH_WAY, PARK_WAY];
    const park = plan.field;
    const inside = (x: number, z: number) => {
      if (Math.abs(x) > W / 2 - 0.8 || Math.abs(z) > D / 2 - 0.8) return false;
      if (x > park.x0 - 0.5 && x < park.x1 + 0.5 && z > park.z0 - 0.5 && z < park.z1 + 0.5) return false;
      // Pavements: square-cornered, as wide as a lane's kerb and walk.
      for (const { pts, w } of plan.lanes) {
        const m = w / 2 + (w >= ROAD ? 1.8 : 1.3);
        for (let i = 1; i < pts.length; i++) {
          const [ax, az] = pts[i - 1];
          const [bx, bz] = pts[i];
          if (x > Math.min(ax, bx) - m && x < Math.max(ax, bx) + m && z > Math.min(az, bz) - m && z < Math.max(az, bz) + m) return false;
        }
      }
      if (Math.abs(x - CANAL.x) < CANAL.w / 2 + 1.4 && z < CANAL.z1 + 1) return false;
      if (((x - HARBOR.x) / (HARBOR.rx + 1.4)) ** 2 + ((z - HARBOR.z) / (HARBOR.rz + 1.4)) ** 2 < 1) return false;
      if (courts.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) return false;
      if (lines.some((l) => l.some((a, i) => i > 0 && toSegment(x, z, l[i - 1], a) < 1))) return false;
      return true;
    };
    // Strips of lawn under a metre between courts read as mistakes: smoothed away.
    const { rects: lawns, edges } = cellRegion({ x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2 }, 0.5, inside, 2);
    this.scenery.add(toned(tiledRects(lawns, lawn[0], 8), LAWN_TONE));
    const kerb = kitPieces('city', 'kerb-strip', true);
    if (kerb.length) this.scenery.add(ribbons(edges.map((pts) => ({ pts, w: 0.5 })), kerb[0], 1, 4, 0.0065, 2, 0.25));
    this.sowLawns(lawns);
  }

  /** What works in the story: the balcony and basket, the fountain, the loaves, the building site, the smoke. */
  private buildPlaces() {
    this.scenery.add(balcony(BALCONY));
    this.basket = this.add('basket', { width: 0.6 }, BASKET.x, BASKET.z, () => basket());
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
    this.add('hydrant', { height: 0.9 }, HYDRANT_SPOT.x + 1.8, HYDRANT_SPOT.z + 0.6, () => hydrant());
    this.add('bins', { width: 2 }, BINS.x, BINS.z, () => bins());
    // The building site: a fenced plot whose house rises floor by floor.
    this.scenery.add(sitePlot(SITE, this.kit ? kitPieces('city', 'site-sand')[0] : undefined));
    for (let i = 0; i < 3; i++) {
      const f = floor(i);
      f.position.set(SITE.x, i * 1.1, SITE.z);
      f.visible = false;
      this.floorMeshes.push(f);
      this.scenery.add(f);
    }
    // The cat house in the park's corner, where the kitten lives.
    this.scenery.add(catHouse(KITTEN_WAY[KITTEN_WAY.length - 1].clone().add(v(-1.2, 1))));
    // Smoke from the burning house across the canal.
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowFor('rgba(120,120,130,0.85)'), transparent: true, depthWrite: false, opacity: 0 }));
      s.userData.t = i / 14;
      this.smoke.push(s);
      this.scenery.add(s);
    }
    this.add('house-a', { width: 5, rotateY: -Math.PI / 2 }, BURNING.x, BURNING.z, () => boxHouse('#f2d06b', '#c84a3a', 5, 3.2, 4));
  }

  /** A pole by every place, and the tram's substation: parts of the map. */
  private placeParts() {
    for (const p of [LIGHT_POLE, SUB_POLE, BAKERY_POLE, PARK_POLE, WASH_POLE, CRANE_POLE, HOUSE_POLE, BRIDGE_POLE, KITTEN_POLE, CLUB_POLE, STATION_POLE, FIRE_POLE, SHOP_POLE, SCHOOL_POLE])
      this.poles.set(p, this.pin('pole', p));
    this.substation = this.pin('substation', SUBSTATION) as Substation;
  }

  private buildCritters() {
    // Three cars wait at the crossing south of the park; the first one speaks for them.
    ['car', 'car2', 'car3'].forEach((name, i) => {
      const c = this.critter(name, { width: 2.4 }, v(CROSS.x + 1.5, CROSS.z + 4 + i * 3.2), 1.3, Math.PI / 2);
      c.roams = true;
      this.cars.push({ c, s: 0 });
    });
    // Three more wait on the west road to go into the car park.
    ['car4', 'car5', 'car6'].forEach((name, i) => {
      const c = this.critter(name, { width: 2.4 }, v(-24 - i * 3.4, 1.5), 1.3, Math.PI);
      c.roams = true;
      this.parkers.push({ c, s: -i * 3.4 });
    });
    // A muddy car by the car wash.
    this.dirty = this.critter('car7', { width: 2.4 }, WASH_WAY[0], 1.3, Math.PI / 2);
    this.dirty.roams = true;
    this.mud = muddy(this.dirty.group);
    this.tram = this.critter('tram', { width: 7 }, v(this.tramX, TRAM_Z), 2.4, 0);
    this.tram.roams = true;
    this.critter('baker', { height: 1.6 }, BAKER, 1.6, -Math.PI / 2 + 0.3);
    this.critter('pigeon', { height: 0.5 }, v(FOUNTAIN.x - 2.2, FOUNTAIN.z + 3.2), 0.5, 0.5);
    this.critter('pigeon2', { height: 0.45 }, v(FOUNTAIN.x - 3.4, FOUNTAIN.z + 2.4), 0.45, -0.4);
    const grandma = this.critter('grandma', { height: 1.5 }, GRANDMA, 1.5, 0);
    grandma.base = BALCONY_TOP;
    this.critter('child', { height: 1.2 }, v(FERRIS_SPOT.x - 4.5, FERRIS_SPOT.z + 4.5), 1.2, 0.3);
    this.critter('child2', { height: 1.15 }, v(FERRIS_SPOT.x - 3, FERRIS_SPOT.z + 5.5), 1.15, -0.3);
    this.critter('builder', { height: 1.6 }, BUILDER, 1.6, 0.6);
    this.boatCritter = this.critter('boat', { width: 3 }, BOAT_WAY[0], 1.4, -Math.PI / 2);
    this.boatCritter.roams = true;
    this.critter('kitten', { height: 0.75 }, KITTEN, 0.75, -0.6);
    this.critter('child6', { height: 1.2 }, v(MUSIC_SPOT.x + 2.5, MUSIC_SPOT.z - 1.5), 1.2, 0.3);
    this.critter('child7', { height: 1.15 }, v(MUSIC_SPOT.x + 4, MUSIC_SPOT.z - 2), 1.15, -0.3);
    this.critter('firefighter', { height: 1.6 }, v(ENGINE_SPOT.x + 3, ENGINE_SPOT.z - 1), 1.6, 0.4);
    const cat = this.critter('cat', { height: 0.7 }, v(BURNING.x - 1, BURNING.z), 0.7, Math.PI);
    cat.base = BURNING_TOP;
    this.critter('shopkeeper', { height: 1.6 }, SHOPKEEPER, 1.6, 0);
    ['child3', 'child4', 'child5'].forEach((name, i) => this.critter(name, { height: 1.15 }, v(SCHOOL_DOOR.x - 2 + i * 1.6, SCHOOL_DOOR.z + 4), 1.15, i - 1));
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
    const lamp = (at: THREE.Vector3) => (this.on(at, ['duskLamp']) as DuskLamp | undefined)?.lit ?? false;
    const slot = (icon: PartKind, spot: THREE.Vector3, kinds: PartKind[] = [icon], toward?: THREE.Vector3) => ({ icon, kinds, spot, toward });
    // Day.
    add({ critter: get('car'), phase: 'day', ask: 'carsAsk', thanks: 'carsHappy', icon: 'trafficLight', kinds: ['trafficLight'], spot: LIGHT_SPOT, met: () => this.working(LIGHT_SPOT, ['trafficLight']) });
    add({ critter: this.tram, phase: 'day', ask: 'tramAsk', thanks: 'tramHappy', icon: 'switch', kinds: ['switch'], spot: TRAM_SWITCH, focus: [SUBSTATION.clone(), TRAM_SWITCH.clone(), v(this.tramX, TRAM_Z)], met: () => this.substation.live && !!this.on(TRAM_SWITCH, ['switch'])?.closed });
    add({ critter: get('baker'), phase: 'day', ask: 'bakerAsk', thanks: 'bakerHappy', icon: 'heater', kinds: ['heater'], spot: OVEN_SPOT, more: [slot('belt', BELT_SPOT)], focus: [BAKER.clone(), OVEN_SPOT.clone(), COUNTER.clone()], met: () => this.bread >= 3 });
    add({ critter: get('car4'), phase: 'day', ask: 'parkAsk', thanks: 'parkHappy', icon: 'barrier', kinds: ['barrier'], spot: BARRIER_SPOT, more: [slot('button', PARK_BUTTON)], focus: [v(-24, 1.5), BARRIER_SPOT.clone(), PARK_SLOTS[2].clone()], met: () => this.parked >= 3, sticker: 'parking' });
    add({ critter: get('child'), phase: 'day', ask: 'ferrisAsk', thanks: 'ferrisHappy', icon: 'ferris', kinds: ['ferris'], spot: FERRIS_SPOT, more: [slot('windGen', WIND_SPOT)], met: () => this.rideT > 3, sticker: 'ferris' });
    add({ critter: this.dirty, phase: 'day', ask: 'washAsk', thanks: 'washHappy', icon: 'carWash', kinds: ['carWash'], spot: WASH_SPOT, more: [slot('pump', WASH_PUMP, ['pump'], WASH_SPOT.clone())], focus: [WASH_WAY[0].clone(), WASH_SPOT.clone(), WASH_PUMP.clone()], met: () => this.washed >= 1, sticker: 'carwash' });
    add({ critter: get('grandma'), phase: 'day', ask: 'grandmaAsk', thanks: 'grandmaHappy', icon: 'lift', kinds: ['lift'], spot: LIFT_SPOT, more: [slot('button', LIFT_BUTTON)], met: () => this.grandma === 'home' });
    add({ critter: get('builder'), phase: 'day', ask: 'craneAsk', thanks: 'craneHappy', icon: 'towerCrane', kinds: ['towerCrane'], spot: CRANE_SPOT, more: [slot('switch', CRANE_SWITCH)], focus: [BUILDER.clone(), CRANE_SPOT.clone(), SITE.clone()], met: () => this.floors >= 3, sticker: 'crane' });
    add({ critter: this.boatCritter, phase: 'day', ask: 'bridgeAsk', thanks: 'bridgeHappy', icon: 'drawbridge', kinds: ['drawbridge'], spot: BRIDGE_SPOT, more: [slot('button', BRIDGE_BUTTON)], focus: [BOAT_WAY[0].clone(), BRIDGE_SPOT.clone(), BRIDGE_BUTTON.clone()], met: () => this.boat >= 1 });
    // Evening.
    add({ critter: get('kitten'), phase: 'evening', ask: 'kittenDark', thanks: 'kittenHome', icon: 'duskLamp', kinds: ['duskLamp'], spot: LAMPS[0], more: LAMPS.slice(1).map((spot) => slot('duskLamp', spot)), met: () => LAMPS.every(lamp) });
    add({ critter: get('child6'), phase: 'evening', ask: 'clubAsk', thanks: 'clubHappy', icon: 'neon', kinds: ['neon'], spot: NEON_SPOT, more: [slot('lightSensor', CLUB_SENSOR), slot('musicbox', MUSIC_SPOT)], met: () => this.working(MUSIC_SPOT, ['musicbox']) && !!this.on(CLUB_SENSOR, ['lightSensor'])?.closed, sticker: 'child' });
    add({ critter: get('firefighter'), phase: 'evening', ask: 'fireAsk', thanks: 'fireHappy', icon: 'firetruck', kinds: ['firetruck'], spot: ENGINE_SPOT, more: [slot('ladder', LADDER_SPOT), slot('pump', HYDRANT_SPOT, ['pump'], BURNING.clone())], focus: [ENGINE_SPOT.clone(), LADDER_SPOT.clone(), HYDRANT_SPOT.clone(), BURNING.clone()], met: () => this.fire >= 1 && this.catSaved });
    // Night: dominoes on the raccoon's path, and the alarm bell they switch on.
    add({ critter: get('shopkeeper'), phase: 'night', ask: 'raccoonTip', thanks: 'raccoonScared', icon: 'domino', kinds: ['domino'], hintPhrase: 'raccoonTip', spot: DOMINO_SPOT.clone(), more: [slot('bell', ALARM_SPOT.clone())], focus: [SHOPKEEPER.clone(), DOMINO_SPOT.clone(), ALARM_SPOT.clone()], met: () => this.raccoonChased, sticker: 'raccoon' });
    // Morning: the school bell, rung by a laser beam.
    add({ critter: get('child3'), phase: 'morning', ask: 'schoolAsk', thanks: 'schoolHappy', icon: 'laser', kinds: ['laser'], spot: LASER_SPOT, more: [slot('mirror', MIRROR_SPOT), slot('lightSensor', SCHOOL_SENSOR), slot('bell', SCHOOL_BELL)], focus: [SCHOOL_DOOR.clone(), LASER_SPOT.clone(), MIRROR_SPOT.clone(), SCHOOL_SENSOR.clone(), SCHOOL_BELL.clone()], met: () => this.working(SCHOOL_BELL, ['bell']) && !!this.on(SCHOOL_SENSOR, ['lightSensor'])?.closed, sticker: 'school' });
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
      case 'car4': return [[pole(PARK_POLE), [this.on(PARK_BUTTON, ['button']), this.on(BARRIER_SPOT, ['barrier'])]]];
      case 'child': return [[this.on(WIND_SPOT, ['windGen']), [this.on(FERRIS_SPOT, ['ferris'])]]];
      case 'car7': return [[pole(WASH_POLE), [this.on(WASH_SPOT, ['carWash'])]], [pole(WASH_POLE), [this.on(WASH_PUMP, ['pump'])]]];
      case 'grandma': return [[pole(HOUSE_POLE), [this.on(LIFT_BUTTON, ['button']), this.on(LIFT_SPOT, ['lift'])]]];
      case 'builder': return [[pole(CRANE_POLE), [this.on(CRANE_SWITCH, ['switch']), this.on(CRANE_SPOT, ['towerCrane'])]]];
      case 'boat': return [[pole(BRIDGE_POLE), [this.on(BRIDGE_BUTTON, ['button']), this.on(BRIDGE_SPOT, ['drawbridge'])]]];
      case 'kitten': return LAMPS.map((at) => [pole(KITTEN_POLE), [this.on(at, ['duskLamp'])]]);
      case 'child6': return [[pole(CLUB_POLE), [this.on(NEON_SPOT, ['neon'])]], [pole(CLUB_POLE), [this.on(CLUB_SENSOR, ['lightSensor']), this.on(MUSIC_SPOT, ['musicbox'])]]];
      case 'firefighter': return [[pole(STATION_POLE), [this.on(ENGINE_SPOT, ['firetruck'])]], [pole(FIRE_POLE), [this.on(LADDER_SPOT, ['ladder'])]], [pole(FIRE_POLE), [this.on(HYDRANT_SPOT, ['pump'])]]];
      case 'shopkeeper': return [[pole(SHOP_POLE), [this.on(DOMINO_SPOT, ['domino']), this.on(ALARM_SPOT, ['bell'])]]];
      case 'child3': return [[pole(SCHOOL_POLE), [this.on(LASER_SPOT, ['laser'])]], [pole(SCHOOL_POLE), [this.on(SCHOOL_SENSOR, ['lightSensor']), this.on(SCHOOL_BELL, ['bell'])]]];
    }
    return [];
  }

  /**
   * The city's dressing (src/city-decor.ts), kept off the rings, the poles,
   * the people and the ways things move along; smoke from a few chimneys.
   */
  private dress() {
    const keep = [
      ...this.needs.flatMap((n) => [n.spot, ...n.more.map((s) => s.spot)]),
      ...[...this.critters.values()].filter((c) => !c.roams).map((c) => c.home),
      ...this.world.parts.map((p) => p.root.position),
      FOUNTAIN, SITE, BINS,
    ];
    const lines = [RACCOON_PATH, KITTEN_WAY, WASH_WAY, PARK_WAY, BOAT_WAY, [LASER_SPOT, MIRROR_SPOT, SCHOOL_SENSOR]];
    // With the painted kit, the trees and bushes are its cards (when it has them), not the 3D models.
    const carded = this.kit ? DECOR.filter((g) => CITY_CARDS[g.model] && hasKit('city', CITY_CARDS[g.model].card)) : [];
    // Nothing grows inside the building site's fence.
    const onSite = ([x, z]: readonly number[]) => Math.abs(x - SITE.x) < 3.6 && Math.abs(z - SITE.z) < 3;
    const dressed = DECOR.filter((g) => !carded.includes(g)).map((g) => ({ ...g, items: g.items.filter((i) => !onSite(i)) }));
    const { group, drawn, inTheWay } = dressing(dressed, FENCES, keep, lines);
    this.scenery.add(group);
    for (const g of carded) {
      const { card, wide } = CITY_CARDS[g.model];
      const tall = g.fit.height ?? (g.fit.width ?? 2) / wide;
      const items = (tall > 4 ? g.items : g.items.filter(([x, z, , s]) => !inTheWay(x, z, 1.6 + (tall * wide * s) / 2))).filter((i) => !onSite(i));
      this.scenery.add(standees(items.map(([x, z, , s]) => ({ x, z, size: tall * wide * s })), kitPieces('city', card), kitPieces('farm', 'blob-shadow')[0] ?? null));
      drawn.add(g.model);
    }
    // Buildings not sculpted yet: painted boxes in their places, so the town is never bare (baked: few draws).
    const boxes = new THREE.Group();
    // Benches not sculpted yet: a wooden seat on two legs.
    if (!drawn.has('bench')) for (const g of DECOR.filter((d) => d.model === 'bench')) for (const [x, z, yaw, s] of g.items) {
      const b = codeBench((g.fit.width ?? 1.8) * s);
      b.position.set(x, 0, z);
      b.rotation.y = yaw;
      boxes.add(b);
    }
    for (const g of DECOR) {
      const look = HOUSES[g.model];
      if (!look || drawn.has(g.model)) continue;
      for (const [x, z, yaw, s] of g.items) {
        const w = (g.fit.width ?? 5) * s;
        const h = townHouse(look[0], look[1], w, look[2] * s, w * 0.8);
        h.position.set(x, 0, z);
        h.rotation.y = yaw;
        boxes.add(h);
      }
    }
    this.scenery.add(bakeGroup(boxes));
    // Things to poke, and townsfolk out for a walk.
    this.life.addToy('mailbox', GRANDMA.x + 3, GRANDMA.z + 4, 0);
    this.life.addToy('trashcan', 15.2, -6.8, 0.3);
    this.life.addToy('trashcan', 52, -17, -0.4);
    this.life.addToy('hydrant', 8, -16.4, 0);
    const walkers: [number, number, string, string][] = [[-25, -17, '#3f86d6', '#7a4a2a'], [25, 17, '#ff8fb1', '#f2c230'], [-10, 18, '#5cb85c', '#3a2a1a'], [10, -18, '#b388ff', '#d9dde3'], [45, -17, '#f2c230', '#7a4a2a'], [-46, 3.8, '#ff8f2a', '#5a3a2a']];
    for (const [x, z, body, hair] of walkers) this.life.addExtra(person(body, hair, 1.25), x, z, 0, 'stroll', 'passerby', 3);
    this.life.addFlutters([v(8, 4), v(-8, -4), v(-40, 20), v(14, -26)], [v(-12, 2), v(6, 4)]);
    const houses = DECOR.filter((g) => g.model.startsWith('house')).flatMap((g) => g.items).slice(0, 4);
    for (const [x, z] of houses) this.life.addSmoke(v(x + 1, z).setY(3.6));
  }

  /** Flowers in the park and along the pavements, kept off the rings, the people and the poles. */
  private sowFlowers() {
    const taken = [...this.needs.flatMap((n) => [n.spot, ...n.more.map((m) => m.spot)]), ...[...this.critters.values()].map((c) => c.home), ...this.world.parts.map((p) => p.root.position)];
    const f = this.plan.field;
    const free = (x: number, z: number) =>
      x > f.x0 + 1 && x < f.x1 - 1 && z > f.z0 + 1 && z < f.z1 - 1 && Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) > BASIN_R + 2 && !onLane(this.plan, x, z, 0.8) && taken.every((t) => Math.hypot(x - t.x, z - t.z) > 2.6);
    const spots: [number, number, number][] = [];
    for (let tries = 0; spots.length < 30 && tries < 3000; tries++) {
      const x = f.x0 + Math.random() * (f.x1 - f.x0);
      const z = f.z0 + Math.random() * (f.z1 - f.z0);
      if (free(x, z) && spots.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 2)) spots.push([x, z, 0.8 + Math.random() * 0.45]);
    }
    const bloom = instances('flower-cluster', { height: 0.45 }, spots);
    bloom?.traverse((o) => (o.castShadow = false));
    this.scenery.add(bloom ?? flowers(this.plan, 40, free));
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
    // A switch or button of this need that would get one of its gadgets going (not one of another need's).
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
    // The dominoes are for the raccoon to knock over.
    if (h.type === 'tap' && h.part.kind === 'domino') return null;
    const about = h.type === 'connect' ? [h.from.part, h.to.part] : h.type === 'drag' ? [] : [h.type === 'tapWire' ? h.at : h.part];
    return about.length && about.every((p) => p && mine.has(p)) ? h : null;
  }

  protected tick(dt: number) {
    DuskLamp.dark = this.nightAmount;
    this.updateCars(dt);
    this.updateTram(dt);
    this.updateBakery(dt);
    this.updateParking(dt);
    this.updateFerris(dt);
    this.updateWash(dt);
    this.updateCrane();
    this.updateBoat(dt);
    // The fountain plays all day; the pigeons drink from it.
    for (const d of this.spray) {
      d.userData.t = (d.userData.t + dt * 0.9) % 1;
      const t = d.userData.t as number;
      const r = t * 1.6 * this.fountainLevel;
      d.position.set(FOUNTAIN.x + Math.cos(d.userData.a) * r, 0.6 + this.fountainLevel * 2.6 * 4 * t * (1 - t), FOUNTAIN.z + Math.sin(d.userData.a) * r);
      d.material.opacity = this.fountainLevel * (1 - t * 0.6) * 0.9;
    }
    this.updateGrandma(dt);
    this.updateFire(dt);
    this.updateKitten(dt);
    this.updateClub();
    this.updateRaccoon(dt);
    this.updateSchool(dt);
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

  /** With the barrier up the cars drive off the road, up the drive and into their places, one after another. */
  private updateParking(dt: number) {
    const barrier = this.on(BARRIER_SPOT, ['barrier']) as Barrier | undefined;
    const open = !!barrier && barrier.open > 0.8;
    this.parkers.forEach((pk, i) => {
      if (pk.s === Infinity) return;
      const way = [pk.c.home.clone(), ...PARK_WAY, PARK_SLOTS[i]];
      if (pk.s < 0) {
        // Queueing: moves up as the ones ahead go in.
        if (open) pk.s = Math.min(0, pk.s + dt * 3);
        return;
      }
      if (!open && pk.s < 1) return;
      pk.s += dt * 3;
      const len = pathLength(way);
      if (pk.s >= len) {
        this.putParked(pk, i);
        this.parked = this.parkers.filter((x) => x.s === Infinity).length;
        this.hooks.chime();
        return;
      }
      const { at, dir } = pathAt(way, pk.s);
      pk.c.group.position.copy(at);
      pk.c.group.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
    });
  }

  private putParked(pk: { c: Critter; s: number }, i: number) {
    pk.s = Infinity;
    pk.c.group.position.copy(PARK_SLOTS[i]);
    pk.c.group.rotation.y = Math.PI / 2;
    pk.c.home.copy(PARK_SLOTS[i]);
  }

  /** The children cheer while the wheel goes round. */
  private updateFerris(dt: number) {
    const wheel = this.on(FERRIS_SPOT, ['ferris']) as FerrisWheel | undefined;
    const turning = !!wheel && Math.abs(wheel.spin) > 0.4;
    if (turning) this.rideT += dt;
    if (turning && Math.sin(this.rideT * 3) > 0.95) for (const n of ['child', 'child2']) this.critters.get(n)!.hop = 1;
  }

  /** Brushes and water on, the muddy car drives up through the wash and comes out shiny. */
  private updateWash(dt: number) {
    const wash = this.on(WASH_SPOT, ['carWash']) as CarWash | undefined;
    const water = this.world.parts.some((p) => p instanceof Pump && p.pumping && p.root.position.distanceTo(WASH_PUMP) < 0.8);
    if (wash?.running && water && this.washed < 1) this.washed = Math.min(1, this.washed + dt * 0.2);
    const { at } = pathAt(WASH_WAY, this.washed * pathLength(WASH_WAY));
    this.dirty.group.position.copy(at);
    this.dirty.home.copy(at);
    // The mud washes off as it passes the brushes.
    const clean = THREE.MathUtils.smoothstep(this.washed, 0.3, 0.6);
    for (const m of this.mud) m.visible = clean < 0.99 && m.userData.k > clean;
  }

  /** Each block the crane lifts adds a floor to the house on the site. */
  private updateCrane() {
    const crane = this.on(CRANE_SPOT, ['towerCrane']) as TowerCrane | undefined;
    if (!crane) {
      this.craneSeen = -1;
    } else if (this.craneSeen < 0) this.craneSeen = crane.lifts;
    else if (crane.lifts > this.craneSeen && this.floors < 3) {
      this.craneSeen = crane.lifts;
      this.floors++;
      this.critters.get('builder')!.hop = 1;
      this.hooks.chime();
    }
    this.floorMeshes.forEach((f, i) => (f.visible = i < this.floors));
  }

  /** With the bridge up the boat sails down the canal into the harbour. */
  private updateBoat(dt: number) {
    const bridge = this.on(BRIDGE_SPOT, ['drawbridge']) as Drawbridge | undefined;
    if (bridge && bridge.up > 0.85 && this.boat < 1) this.boat = Math.min(1, this.boat + dt * 0.18);
    const { at } = pathAt(BOAT_WAY, this.boat * pathLength(BOAT_WAY));
    const p = this.boatCritter.group.position;
    p.set(at.x, 0.05 + Math.sin(this.time * 2) * 0.04, at.z);
    this.boatCritter.group.rotation.z = Math.sin(this.time * 1.6) * 0.04;
    this.boatCritter.home.copy(at);
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
    this.basket.position.set(BALCONY.x + 0.45, BALCONY_TOP, BALCONY.z + 0.1);
    this.critters.get('grandma')!.hop = 1;
  }

  /**
   * The engine out with its siren and the pump at the hydrant put the fire
   * out; the ladder reaching the roof brings the cat down. The smoke rises
   * till then (from the evening on).
   */
  private updateFire(dt: number) {
    const engine = this.world.parts.some((p) => p instanceof FireTruck && p.powered && p.root.position.distanceTo(ENGINE_SPOT) < 1.5);
    const hose = this.world.parts.some((p) => p instanceof Pump && p.pumping && p.root.position.distanceTo(HYDRANT_SPOT) < 1.5);
    if (engine && hose && this.phase === 'evening') this.fire = Math.min(1, this.fire + dt * 0.2);
    const ladder = this.on(LADDER_SPOT, ['ladder']) as FireLadder | undefined;
    if (ladder && ladder.reach > 0.95 && this.phase === 'evening') this.catDown = Math.min(1, this.catDown + dt * 0.4);
    if (this.catDown >= 1 && !this.catSaved) {
      this.catSaved = true;
      this.hooks.chime();
    }
    const cat = this.critters.get('cat')!;
    // Down the ladder from the roof to the pavement by the house.
    const top = v(BURNING.x - 1, BURNING.z);
    const foot = v(LADDER_SPOT.x - 1, LADDER_SPOT.z + 1.2);
    const k = THREE.MathUtils.smoothstep(this.catDown, 0, 1);
    cat.group.position.x = THREE.MathUtils.lerp(top.x, foot.x, k);
    cat.group.position.z = THREE.MathUtils.lerp(top.z, foot.z, k);
    cat.home.set(cat.group.position.x, 0, cat.group.position.z);
    cat.base = BURNING_TOP * (1 - k);
    const burning = (this.phase === 'evening' || this.phase === 'night') && this.fire < 1;
    for (const s of this.smoke) {
      s.userData.t = (s.userData.t + dt * 0.25) % 1;
      const t = s.userData.t as number;
      s.position.set(BURNING.x + Math.sin(t * 5 + s.id) * 0.6 * t, 3.6 + t * 4, BURNING.z);
      s.scale.setScalar(0.8 + t * 2);
      s.material.opacity = burning ? (1 - t) * 0.7 * (1 - this.fire) : 0;
    }
  }

  /** Once all three lamps shine the kitten walks home along them. */
  private updateKitten(dt: number) {
    const c = this.critters.get('kitten')!;
    if (this.needs.find((n) => n.critter === c)?.done) this.kittenWalk = Math.min(1, this.kittenWalk + dt * 0.15);
    if (this.kittenWalk <= 0) return;
    const len = pathLength(KITTEN_WAY);
    const { at, dir } = pathAt(KITTEN_WAY, this.kittenWalk * len);
    c.group.position.x = at.x;
    c.group.position.z = at.z;
    c.home.copy(at);
    if (this.kittenWalk < 1) c.group.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
  }

  /** With the music on the children dance. */
  private updateClub() {
    if (!this.working(MUSIC_SPOT, ['musicbox'])) return;
    for (const [n, k] of [['child6', 0], ['child7', 1.6]] as const) if (Math.sin(this.time * 5 + k) > 0.97) this.critters.get(n)!.hop = 1;
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
      const from = v(SCHOOL_DOOR.x - 2 + i * 1.6, SCHOOL_DOOR.z + 4);
      const k = Math.min(1, this.schooling * 1.2 - i * 0.1);
      const p = from.lerp(SCHOOL_DOOR, k);
      c.group.position.x = p.x;
      c.group.position.z = p.z;
      // They skip in, not slide: facing the door, a little hop with every step while they go.
      if (k > 0 && k < 1) {
        c.hop = Math.max(c.hop, 0.35 + 0.35 * Math.abs(Math.sin(this.time * 9 + i)));
        c.group.rotation.y = Math.atan2(-(SCHOOL_DOOR.z - from.z), SCHOOL_DOOR.x - from.x);
      }
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

/** Trees and bushes the city's kit draws as cards: its picture, and the card's width per unit of the model's height. */
const CITY_CARDS: Record<string, { card: string; wide: number }> = {
  'tree-oak': { card: 'tree-round-card', wide: 0.95 },
  'tree-oak-lite': { card: 'tree-round-card', wide: 0.95 },
  bush: { card: 'bush-card', wide: 1.6 },
  'bush-lite': { card: 'bush-card', wide: 1.6 },
};

/** The kit's paving and lawns under the game's sun and grading, evened to city-a. */
/** World units one paving picture covers: city-a's slabs are small beside a house. */
const PAVING_TILE = Number(new URLSearchParams(location.search).get('ptile') ?? 5);
const PAVING_TONE = new URLSearchParams(location.search).get('tone') ?? '#e8dcd4';
/** Lawn over every block (city-a), not just the traced patches; `?oldlawns` shows the patches. */
const GREEN = !new URLSearchParams(location.search).has('oldlawns');
/** The park's picture is darker than the block lawns: lifted to match them. */
const PARK_TONE = new URLSearchParams(location.search).get('pktone') ?? '#d4cce8';
const LAWN_TONE = new URLSearchParams(location.search).get('ltone') ?? '#a898c8';

/** Paving everywhere, asphalt roads (the ring, the roads out of it, the tram line, the drives), grass in the park and on the lawns. */
function cityPlan(): GroundPlan {
  const ring: [number, number][] = [[-RING.x, -RING.z], [RING.x, -RING.z], [RING.x, RING.z], [-RING.x, RING.z], [-RING.x, -RING.z]];
  const lawns = SOIL.length ? SOIL : [{ x0: -RING.x + ROAD / 2 + 1, z0: -RING.z + ROAD / 2 + 1, x1: RING.x - ROAD / 2 - 1, z1: RING.z - ROAD / 2 - 1 }];
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
      ...PATHS.map((p) => ({ pts: p.points, w: p.width })),
    ],
    field: lawns[0],
    fields: lawns.slice(1),
    mud: [],
    hill: MEADOW[0] ?? { x: 0, z: 0, rx: 0.01, rz: 0.01 },
    meadows: MEADOW.slice(1),
    tiles: { base: 'paving-a', hill: 'grass-meadow', lane: 'asphalt-a', field: 'grass-base', mud: 'grass' },
    // The painted city of its target (assets-src/design-pass/variants/city-a.png).
    painted: 'city',
  };
}

/** White dashes down the middle of every road, zebras at the crossings (unless the kit's roads have them), rails on the tram line. */
function roadMarks(paint = true, bays = true, rails = true): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.85, depthWrite: false });
  const dashes: THREE.Matrix4[] = [];
  const mark = (x: number, z: number, along: 'x' | 'z', w = 1.2, d = 0.18) => dashes.push(new THREE.Matrix4().compose(v(x, z).setY(0.02), new THREE.Quaternion(), along === 'x' ? new THREE.Vector3(w, 1, d) : new THREE.Vector3(d, 1, w)));
  const dash = (x: number, z: number, along: 'x' | 'z', w = 1.2, d = 0.18) => paint && mark(x, z, along, w, d);
  // Not over the water (the drawbridge stands there).
  const dry = (x: number) => Math.abs(x - CANAL.x) > 2.5;
  for (let x = -RING.x + 3; x < RING.x - 2; x += 3) {
    dash(x, -RING.z, 'x');
    dash(x, RING.z, 'x');
  }
  for (let z = -RING.z + 3; z < RING.z - 2; z += 3) {
    dash(-RING.x, z, 'z');
    dash(RING.x, z, 'z');
  }
  for (let x = RING.x + 4; x < W / 2 - 1; x += 3) {
    if (dry(x)) dash(x, 0, 'x');
    dash(-x, 0, 'x');
  }
  for (let z = RING.z + 4; z < D / 2 - 1; z += 3) {
    if (Math.abs(z - TRAM_Z) > 2.5) dash(0, z, 'z');
    dash(0, -z, 'z');
  }
  // Zebras where the roads leave the ring.
  for (const [x, z, along] of [[0, RING.z + ROAD / 2 + 1.6, 'x'], [0, -RING.z - ROAD / 2 - 1.6, 'x'], [RING.x + ROAD / 2 + 1.6, 0, 'z'], [-RING.x - ROAD / 2 - 1.6, 0, 'z']] as const)
    for (let k = -2; k <= 2; k++) along === 'x' ? dash(x + k * 1.1, z, 'z', 2.2, 0.55) : dash(x, z + k * 1.1, 'x', 2.2, 0.55);
  // Parking bays.
  if (bays) for (const s of PARK_SLOTS) mark(s.x - 1.7, s.z, 'z', 3, 0.14);
  const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(quad, white, dashes.length);
  dashes.forEach((m, i) => im.setMatrixAt(i, m));
  im.renderOrder = 2;
  g.add(im);
  // Rails along the tram line (unless the kit's street has them painted in).
  for (const dz of rails ? [-0.75, 0.75] : []) {
    const rail = mesh(new THREE.BoxGeometry(W, 0.06, 0.12), mat('#9aa0a8', 0.3, 0.8), false);
    rail.position.set(0, 0.03, TRAM_Z + dz);
    g.add(rail);
  }
  return g;
}

// ───────────────────────── Stand-ins ─────────────────────────

/** The canal: stone banks and water, straight from the board's north edge to the harbour. */
function canal(): THREE.Group {
  const g = new THREE.Group();
  const len = CANAL.z1 - CANAL.z0;
  const mid = (CANAL.z0 + CANAL.z1) / 2;
  const water = mesh(new THREE.PlaneGeometry(CANAL.w, len).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4aa3d4', roughness: 0.08, metalness: 0.1 }), false);
  water.position.set(CANAL.x, 0.012, mid);
  water.receiveShadow = true;
  water.userData.noAO = true;
  g.add(water);
  for (const dx of [-1, 1]) {
    // Quay stone along the canal, one tile per two units of length.
    const bank = mesh(new THREE.BoxGeometry(0.4, 0.22, len), tiledMaterial('quay', [1, len / 2]));
    bank.position.set(CANAL.x + dx * (CANAL.w / 2 + 0.2), 0.11, mid);
    g.add(bank);
  }
  return g;
}

function balcony({ x, z }: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  // The deck reaches 0.3 back into the house's wall (its door is set in from the eaves), the outer edge stays.
  const deck = mesh(new THREE.BoxGeometry(1.9, 0.14, 1.3), mat('#e8e0d0', 0.7));
  deck.position.set(-0.15, BALCONY_TOP - 0.07, 0);
  g.add(deck);
  const rail = mesh(new THREE.BoxGeometry(1.9, 0.5, 0.06), mat('#ffffff', 0.5));
  rail.position.set(-0.15, BALCONY_TOP + 0.25, 0.62);
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

/** The building site: a sandy plot with a low fence and a stack of blocks. */
function sitePlot({ x, z }: THREE.Vector3, painted?: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  // The kit's painted sand when it has it, else a plain sandy slab.
  const sand = painted ? decal({ x0: -3, z0: -2.5, x1: 3, z1: 2.5 }, painted, 0.2, 0.008, 2) : mesh(new THREE.BoxGeometry(6, 0.06, 5), mat('#d8b878', 0.95));
  if (!painted) sand.position.y = 0.03;
  g.add(sand);
  for (const [dx, dz, w, d] of [[0, -2.5, 6, 0.08], [0, 2.5, 6, 0.08], [-3, 0, 0.08, 5]] as const) {
    const f = mesh(new THREE.BoxGeometry(w, 0.5, d), mat('#f2c230', 0.6));
    f.position.set(dx, 0.25, dz);
    g.add(f);
  }
  for (let i = 0; i < 4; i++) {
    const b = mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), mat('#d8483c', 0.7));
    b.position.set(2.3, 0.18 + (i % 2) * 0.36, -1.6 + Math.floor(i / 2) * 0.55);
    g.add(b);
  }
  g.position.set(x, 0, z);
  return g;
}

/** One floor of the house on the building site, with windows. */
function floor(i: number): THREE.Group {
  const g = new THREE.Group();
  const walls = mesh(new THREE.BoxGeometry(3.6, 1.1, 3), mat(['#f2d06b', '#a3d0f0', '#f6b0a0'][i], 0.7));
  walls.position.y = 0.55;
  g.add(walls);
  for (const dx of [-1, 0, 1]) {
    const w = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), mat('#3f6a9a', 0.2), false);
    w.position.set(dx, 0.6, 1.52);
    g.add(w);
  }
  if (i === 2) {
    const roof = mesh(new THREE.ConeGeometry(2.7, 1.2, 4), mat('#c84a3a', 0.6));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.7;
    g.add(roof);
  }
  return g;
}

/** The kitten's little house in the park's corner. */
function catHouse({ x, z }: THREE.Vector3): THREE.Group {
  const g = boxHouse('#ff8fb1', '#3f86d6', 1.5, 1.1, 1.3);
  const door = mesh(new THREE.CircleGeometry(0.3, 18), mat('#2a1a10', 0.9));
  door.position.set(0, 0.4, 0.66);
  g.add(door);
  g.position.set(x, 0, z);
  g.rotation.y = 0.5;
  return g;
}

/** Spots of mud on the car by the car wash (each one goes at its own moment). */
function muddy(car: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const m = mesh(new THREE.SphereGeometry(0.22 + (i % 3) * 0.06, 10, 8), mat('#7a5a3a', 0.95), false);
    m.scale.y = 0.45;
    m.position.set(-0.9 + (i % 5) * 0.45, 0.55 + (i % 2) * 0.35, i % 2 ? 0.55 : -0.55);
    m.userData.k = (i + 1) / 10;
    car.add(m);
    out.push(m);
  }
  return out;
}

/** Code-built stand-ins for the city's people and vehicles. */
/** A painted house for a building not sculpted yet: walls and roof, a door, rows of windows, a chimney. */
/** A park bench: slatted seat and back on two iron legs. */
function codeBench(w: number): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#b5763f', 0.7);
  const iron = mat('#3a3f4b', 0.5, 0.4);
  for (let i = 0; i < 3; i++) {
    const slat = mesh(new THREE.BoxGeometry(w, 0.05, 0.12), wood);
    slat.position.set(0, 0.42, -0.14 + i * 0.14);
    g.add(slat);
  }
  for (let i = 0; i < 2; i++) {
    const back = mesh(new THREE.BoxGeometry(w, 0.1, 0.05), wood);
    back.position.set(0, 0.62 + i * 0.16, -0.24);
    g.add(back);
  }
  for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) {
    const leg = mesh(new THREE.BoxGeometry(0.06, 0.42, 0.42), iron);
    leg.position.set(x, 0.21, -0.02);
    const post = mesh(new THREE.BoxGeometry(0.06, 0.45, 0.05), iron);
    post.position.set(x, 0.62, -0.24);
    g.add(leg, post);
  }
  return g;
}

function townHouse(wall: string, roof: string, w: number, h: number, d: number): THREE.Group {
  const g = boxHouse(wall, roof, w, h, d);
  const glass = mat('#9fd0e8', 0.25);
  const frame = mat('#ffffff', 0.6);
  const floors = Math.max(1, Math.round(h / 1.6));
  const across = Math.max(2, Math.round(w / 1.4));
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < across; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / across;
      // The front door takes the middle of the ground floor.
      if (f === 0 && i === Math.floor(across / 2)) continue;
      const y = 0.9 + f * 1.5;
      const win = mesh(new THREE.BoxGeometry(0.55, 0.65, 0.04), glass, false);
      win.position.set(x, y, d / 2 + 0.02);
      const sill = mesh(new THREE.BoxGeometry(0.7, 0.08, 0.1), frame, false);
      sill.position.set(x, y - 0.38, d / 2 + 0.04);
      g.add(win, sill);
    }
  }
  const door = mesh(new THREE.BoxGeometry(0.75, 1.2, 0.06), mat('#7a4a2a', 0.7), false);
  const dx = -w / 2 + ((Math.floor(across / 2) + 0.5) * w) / across;
  door.position.set(dx, 0.6, d / 2 + 0.03);
  const chimney = mesh(new THREE.BoxGeometry(0.4, 1, 0.4), mat('#9a6a4a', 0.8));
  chimney.position.set(w * 0.25, h + 0.5, -d * 0.15);
  g.add(door, chimney);
  return g;
}

/** A little person: body, head and a hat or hair of their own colours. */
function person(body: string, top: string, h = 1.1): THREE.Group {
  const g = new THREE.Group();
  const b = mesh(new THREE.CylinderGeometry(0.22 * h, 0.27 * h, 0.75 * h, 14), mat(body, 0.6));
  b.position.y = 0.38 * h;
  const head = mesh(new THREE.SphereGeometry(0.21 * h, 14, 10), mat('#f2d9a6', 0.7));
  head.position.y = 0.95 * h;
  const hat = mesh(new THREE.SphereGeometry(0.23 * h, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(top, 0.5));
  hat.position.y = 1.0 * h;
  g.add(b, head, hat);
  return g;
}

const STAND_INS: Record<string, () => THREE.Object3D> = {
  child: () => person(['#3f86d6', '#ff8fb1', '#5cb85c', '#f2c230'][Math.floor(Math.random() * 4)], '#7a4a2a', 1),
  firefighter: () => person('#d8483c', '#f2c230', 1.3),
  shopkeeper: () => person('#b388ff', '#5a3a2a', 1.3),
  baker: () => person('#ffffff', '#ffffff', 1.3),
  grandma: () => person('#b5653a', '#d9dde3', 1.25),
  boat: () => {
    const g = new THREE.Group();
    const hull = mesh(new THREE.BoxGeometry(2.8, 0.6, 1.2), mat('#f4f1ea', 0.5));
    hull.position.y = 0.3;
    const stripe = mesh(new THREE.BoxGeometry(2.82, 0.15, 1.22), mat('#d8483c', 0.5));
    stripe.position.y = 0.45;
    const cabin = mesh(new THREE.BoxGeometry(1, 0.6, 0.9), mat('#3f86d6', 0.5));
    cabin.position.set(-0.3, 0.9, 0);
    const funnel = mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.5, 12), mat('#f2c230', 0.5));
    funnel.position.set(-0.4, 1.45, 0);
    g.add(hull, stripe, cabin, funnel);
    return g;
  },
  builder: () => {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.28, 0.32, 1, 14), mat('#ff8f2a', 0.6));
    body.position.y = 0.5;
    const head = mesh(new THREE.SphereGeometry(0.25, 14, 10), mat('#f2d9a6', 0.7));
    head.position.y = 1.22;
    const helmet = mesh(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f2c230', 0.4));
    helmet.position.y = 1.3;
    g.add(body, head, helmet);
    return g;
  },
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
