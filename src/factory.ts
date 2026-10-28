// The factory: a real machine shop (the owner's ask: harder, new mechanics,
// not the same wiring again; target assets-src/design-pass/variants/
// factory-industrial-b.png). One production line, six stations, each with a
// mechanic of its own: the hall's wiring box is a tile puzzle (turn the
// copper pieces till they join); a rail cart brings blanks from the stock,
// driven by a forward/back lever; a lathe needs the right gears on its shafts
// to turn slowly enough (a dial shows it); a press runs only while both its
// buttons are held, one finger on each; the robot's plugs are triangles, so
// it takes power only from the triangle socket; and a hoist, up and down by
// another lever, lifts the finished boxes into the lorry.
import * as THREE from 'three';
import { groundMaterial, type GroundPlan } from './ground';
import { cards, grassMaterial, hasKit, kitPieces, patches, ribbons, standees, tiledRects, toned } from './kit';
import { type Hint } from './hints';
import { hasModel, model, type Fit } from './parts/assets';
import type { Part, PartKind, Terminal } from './parts/base';
import type { Substation } from './parts/city';
import { Gear, PaintBooth, PaintTank } from './parts/factory';
import { bakeGroup, mat, mesh } from './parts/kit';
import { glowFor } from './parts/models';
import type { Lift } from './parts/more';
import { Gantry, Lathe, LATHE_SHAFT_AT, RailCart, Reverser, SafetyPress, ShaftMotor, SocketBoard, WireBox, WORKSHOP_MODELS } from './parts/workshop';
import { StoryMap, blob, v, type Critter, type MapProgress, type NeedSpec, type Phase } from './storymap';
import type { PhraseId } from './voice';

/** Model files the factory needs (each falls back to a code-built stand-in). */
/** Codex's hall crew: the foreman, and the station workers in turn (whole figures facing +z, moved by code). */
const CREW = ['factory-worker-technician', 'factory-worker-loader', 'factory-worker-inspector'];
/** What the hall's furniture says when tapped. */
const PROP_SOUND: Record<string, PhraseId> = { 'factory-control-cabinet': 'beep', 'factory-foreman-booth': 'hammer', 'factory-lockers': 'hammer' };

/**
 * Codex's hall furniture (static, but the cabinet's lamps light up): model,
 * fit, x, z, turn, and which of its painted views it takes (`PROP_ART`) when
 * it has one for each way it stands turned.
 */
const PROPS: [string, Fit, number, number, number, string?][] = [
  ['factory-foreman-booth', { height: 2.6 }, 45.9, 7.56, 0],
  ['factory-loading-ramp', { depth: 3.8 }, 50.49, -13.5, -Math.PI / 2],
  ['factory-lockers', { height: 2 }, 29.7, -32.94, 0],
  ['factory-lockers', { height: 2 }, 37.12, -32.94, 0],
  ['factory-fire-extinguisher', { height: 1.1 }, -8.64, -33.62, 0, 'north'],
  ['factory-fire-extinguisher', { height: 1.1 }, -52.52, 0.27, Math.PI / 2, 'west'],
  ['factory-fire-extinguisher', { height: 1.1 }, 52.52, 12.15, -Math.PI / 2, 'east'],
  ['factory-box-trolley', { depth: 1.6 }, 13.5, 7.29, 0.3, 'east'],
  ['factory-box-trolley', { depth: 1.6 }, -16.2, 7.56, -0.25, 'west'],
  ['factory-control-cabinet', { height: 2.1 }, -52.11, -10.12, Math.PI / 2, 'west'],
  ['factory-control-cabinet', { height: 2.1 }, 52.11, 26.33, -Math.PI / 2, 'east'],
];
export const FACTORY_MODELS = ['pole', 'child', 'kitten', 'flower-cluster', 'factory-worker-foreman', ...CREW, ...WORKSHOP_MODELS, ...new Set(PROPS.map(([m]) => m)), 'factory-product-bear', 'factory-product-billet', 'factory-product-box', 'factory-delivery-lorry'];

/** What the drawers offer in the factory: the levers and the gears (a middle one that fits nowhere). */
export const FACTORY_TRAY: { kind: PartKind; count: number }[] = [
  // Two levers for the day line (cart, hoist), two for the evening's gantry.
  { kind: 'reverser', count: 4 },
  // A small and a big gear each for the lathe and the grinder; the middle one fits nowhere.
  { kind: 'smallGear', count: 2 },
  { kind: 'bigGear', count: 2 },
  { kind: 'gear', count: 1 },
];

/** Bumped whenever the factory is laid out anew (a save on another layout starts it afresh). */
export const FACTORY_LAYOUT = 6;

export interface FactoryProgress extends MapProgress {
  loaded: number;
  loaded2?: number;
}

/**
 * How far apart the stations stand (owner 28.10: the hall was crowded, decor hid machines). Every place in
 * the hall is written at the old size and spread by K; machines, their parts and their offsets keep their size.
 */
const K = 1.35;
/** A place in the hall, spread. */
const at = (x: number, z: number) => v(x * K, z * K);
/** Places in the hall spread (the first two numbers of each: x and z; the rest, a size or a turn, kept). */
function spread<T extends readonly number[]>(list: readonly T[]): T[] {
  return list.map((p) => p.map((n, i) => (i < 2 ? n * K : n)) as unknown as T);
}
const W = 108;
const D = 70;
/** The line the toys travel along, from the cart's end to the hoist. */
const LINE_Z = -2.2 * K;
/** How dark the hall is till its lights are switched on. */
const DIM = 0.55;

// 1. The wiring box between a pole and the hall's panel: wire it in, then turn its tiles.
const PANEL = at(-34, -17);
const BOX = at(-29.5, -12.5);
const PANEL_POLE = at(-36, -10);
// 2. The rail cart from the stock to the line's start, and its lever.
const CART = at(-31, 5.5);
const CART_LEVER = at(-35.5, 11);
const CART_POLE = at(-38, 7);
// 3. The lathe, its bare-shaft motor and the two shafts that take gears (1.4 apart: a small and a big gear fit).
const LATHE = at(-17, -8);
const LATHE_SHAFT = v(LATHE.x + LATHE_SHAFT_AT.x, LATHE.z + LATHE_SHAFT_AT.z);
const MOTOR_SHAFT = v(LATHE_SHAFT.x - 1.4, LATHE_SHAFT.z);
const MOTOR = v(MOTOR_SHAFT.x, MOTOR_SHAFT.z + 0.35);
const LATHE_POLE = at(-23, -12);
// 4. The two-hand press beside the line.
const PRESS = at(-3.5, -7);
const PRESS_POLE = at(-3.5, -12.5);
// 5. The robot with triangle plugs and the board of shaped sockets.
const ROBOT = at(11, -6.5);
const BOARD = at(9.5, -12.5);
const ROBOT_POLE = at(4.5, -14);
// 6. The hoist that lifts boxes into the lorry, and its lever.
const HOIST = at(24, -6);
const HOIST_LEVER = at(20.5, -11);
const HOIST_POLE = at(25, -13);
const LORRY = at(32.5, -2.5);

/** Where the foreman and the four workers stand (by their stations). */
// The cart's worker north of the rails: south of them the evening gantry's beam hides people and their bubbles.
const WORKER_SPOTS = [v(PANEL.x + 4, PANEL.z - 0.5), v(CART.x + 1, CART.z - 2.6), v(LATHE.x + 2.5, LATHE.z - 3.5), v(PRESS.x + 3.5, PRESS.z - 3), v(ROBOT.x + 3, ROBOT.z - 4)];

/** How much bigger than a table part the factory's own machines are. */
const MACHINE_SCALE = 1.5;
/** A lever on its station's place is shown larger still: its arrows are what the child presses again and again. */
const LEVER_SCALE = 1.7;

/** Where each station stands on the line (a toy stops there till it works). */
const STATIONS = [LATHE.x, PRESS.x, ROBOT.x, HOIST.x];

// The evening shift: a second line along the south of the hall, z = EVE_Z.
const EVE_Z = 13 * K;
/** E1. The store's lights: a big 3×3 wiring box between a pole and the store's own panel. */
const EVE_BOX = at(-21, 19);
const EVE_PANEL = at(-16.5, 22);
const EVE_BOX_POLE = at(-25, 21.5);
/** E2. The gantry crane over the line's start: a coil from the stand at its west end to the line at its east end, on two levers. */
const GANTRY_AT = v(-24 * K, EVE_Z);
const MOVE_LEVER = at(-34.5, 18);
const LIFT_LEVER = at(-29.6, 18);
const CRANE_POLE = at(-37.5, 21);
/** Where the hook leaves a coil (the trolley's east end): a hopper there feeds the line. */
const DROP = v(GANTRY_AT.x + 5.5, EVE_Z);
/** Where the evening's blanks get on the line: just past the gantry's east leg (the belt never runs through it). */
const EVE_START = GANTRY_AT.x + 8.2;
/** E3. Paint: a pump tank, a 3×3 box of pipe tiles, the booth over the line. */
const TANK = at(-11.5, 18);
const PIPES = at(-6.5, 18.5);
const BOOTH = v(-4 * K, EVE_Z);
const TANK_POLE = at(-14.5, 21.5);
/** E4. The grinder: it wants to turn fast — the big gear on the motor, the small one on the stone. */
const GRINDER = at(7, 17.5);
const GRIND_SHAFT = v(GRINDER.x + LATHE_SHAFT_AT.x, GRINDER.z + LATHE_SHAFT_AT.z);
const GMOTOR_SHAFT = v(GRIND_SHAFT.x - 1.4, GRIND_SHAFT.z);
const GMOTOR = v(GMOTOR_SHAFT.x, GMOTOR_SHAFT.z + 0.35);
const GRIND_POLE = at(1, 21.5);
/** E5. The welding robot: square plugs, its own board of sockets. */
const WELDER = at(18, 16.5);
const BOARD2 = at(15.5, 21);
const WELD_POLE = at(10.5, 22);
const LORRY2 = v(33 * K, EVE_Z);
/** Where each evening station stands on its line. */
const EVE_STATIONS = [BOOTH.x, GRINDER.x, WELDER.x, LORRY2.x - 3];

/**
 * Stock painted by Codex from the game's own camera (m0594): where in the
 * picture its front feet stand (`at`, px of the whole WebP), how wide the
 * thing itself is there (`span`, px) and how deep it is for its size (for
 * the short shadow back and to the right).
 */
type Painted = { piece: string; at: [number, number]; span: number; deep: number };
/** For each old card, the painted pictures that replace it, the best first (the tall three-tier rack, then the low one). */
const PAINTED: Record<string, Painted[]> = {
  'rack-steel-card': [
    { piece: 'factory-rack-tall', at: [512, 684.5], span: 946, deep: 1.4 / 5.5 },
    { piece: 'factory-rack-painted', at: [512.5, 604], span: 869, deep: 1.4 / 5.5 },
  ],
  'pallet-card': [{ piece: 'factory-pallet-painted', at: [384.5, 519], span: 489, deep: 1.7 / 2.4 }],
  'barrels-card': [{ piece: 'factory-barrels-painted', at: [384, 526], span: 428, deep: 2.3 / 2.6 }],
};

/** Storage bays in the middle aisle (before spreading by K). */
const BAYS = [[-16, 5.6], [22.5, 5.6]] as const;

/**
 * The props Codex painted from the camera (m0597): `size` is the model's own
 * width as it stands, `front` how far its front feet stand south of its
 * middle. The model stays under the picture, unseen, for the tap and its jump.
 */
const PROP_ART: Record<string, Painted & { size: number; front: number }> = {
  'factory-lockers': { piece: 'factory-lockers-painted', at: [384.5, 516.5], span: 475, deep: 0.5016517953626232, size: 1.9769280068361461, front: 0.4958647419660024 },
  'factory-foreman-booth': { piece: 'factory-booth-painted', at: [513, 694.5], span: 710, deep: 0.6716208380382702, size: 3.8502372666877576, front: 1.2929497898495053 },
  'factory-loading-ramp': { piece: 'factory-ramp-painted', at: [522.5, 651.5], span: 879, deep: 0.5829950865199744, size: 3.8, front: 1.1076906643879516 },
  // Painted once for each way they stand turned (the view named in PROPS): the cabinet's lamps stay live, over the picture.
  'factory-control-cabinet@west': { piece: 'factory-cabinet-west-painted', at: [370, 533], span: 227, deep: 1.2533860286263623 / 0.9861995300149544, size: 0.9861995300149544, front: 0.6266930143131811 },
  'factory-control-cabinet@east': { piece: 'factory-cabinet-east-painted', at: [392, 531], span: 216, deep: 1.2533860286263623 / 0.9861995300149544, size: 0.9861995300149544, front: 0.6266930143131811 },
  'factory-box-trolley@west': { piece: 'factory-trolley-west-painted', at: [384, 528], span: 305, deep: 1.317441524808627, size: 1.3885693360786842, front: 0.9146794517130024 },
  'factory-box-trolley@east': { piece: 'factory-trolley-east-painted', at: [384, 528], span: 309, deep: 1.3081632561538485, size: 1.4233069544023904, front: 0.9309589299887242 },
  'factory-fire-extinguisher@north': { piece: 'factory-extinguisher-north-painted', at: [384, 528], span: 324, deep: 0.5974008410945029, size: 0.6695518602121999, front: 0.1999954222235786 },
  'factory-fire-extinguisher@west': { piece: 'factory-extinguisher-west-painted', at: [384, 528], span: 164, deep: 1.6151981011963252, size: 0.40921718883314867, front: 0.3304834131900999 },
  'factory-fire-extinguisher@east': { piece: 'factory-extinguisher-east-painted', at: [384, 528], span: 166, deep: 1.5957378831096225, size: 0.4142076423555041, front: 0.3304834131900999 },
};

/** Painted stock on its spots (`size`: the thing's own width): the cards stand on its front feet, with a short shadow. */
function painted(spots: { x: number; z: number; size: number }[], map: THREE.Texture, kind: Painted, shade: THREE.Texture | null): THREE.Group {
  const img = map.image as HTMLImageElement;
  const [iw, ih] = [img.width, img.height];
  const g = cards(spots.map((s) => ({ ...s, size: (s.size * iw) / kind.span })), [map]);
  // Once per kind: the feet, not the picture's bottom edge, at the spot.
  for (const m of g.children as THREE.Mesh[]) m.geometry.translate(0.5 - kind.at[0] / iw, (kind.at[1] / ih - 1) * (ih / iw), 0);
  // A soft shadow back and to the right, away from the sun, big enough to hold the thing down on the floor.
  if (shade) g.add(patches(spots.map((s) => ({ x: s.x + s.size * 0.45, z: s.z - s.size * kind.deep * 0.5, size: s.size * 1.35 })), [shade], 0.009, 3));
  return g;
}

/** Where new blanks get on the line (from the cart). */
const LINE_START = -27 * K;

const VOICES: Record<string, PhraseId> = { foreman: 'shopHello', worker: 'hammer', lorry: 'beep', cat: 'meow' };
const MODEL_OF: Record<string, string> = { cat: 'kitten', lorry: 'factory-delivery-lorry' };

export class FactoryMap extends StoryMap {
  protected readonly width = W;
  protected readonly depth = D;
  /** The yard round the hall, and the road the lorries leave by, are in reach of the view up close too. */
  protected readonly roam = 16;
  readonly layout = FACTORY_LAYOUT;
  protected readonly intro = 'factoryIntro';
  protected readonly kitName = 'factory';
  readonly ownHints = true;
  /** The floor is Codex's painted kit (src/kit.ts). */
  private kit = false;
  private poles = new Map<THREE.Vector3, Part>();
  private panel!: Substation;
  private box!: WireBox;
  private cart!: RailCart;
  private motor!: ShaftMotor;
  private lathe!: Lathe;
  private press!: SafetyPress;
  private robot!: Part;
  private board!: SocketBoard;
  private hoist!: Lift;
  /** The hall's lights are on (the box lets the power through). */
  private lit = false;
  /** Pools of lamplight on the floor (the lamps themselves hung as white blots over the stations: none). */
  private lamps: THREE.Mesh[] = [];
  /** Toys on the line: how far along (x) and what has been done to them. */
  private toys: { m: THREE.Group; x: number; stage: number }[] = [];
  /** Toys gone through each station of the day line (lathe, press, robot, hoist) and of the evening's (paint, grinder, welder, end). */
  private passed = [0, 0, 0, 0];
  private evePassed = [0, 0, 0, 0];
  /** Blanks the cart has brought (at its far end), still to go on the line. */
  private blanks = 0;
  private cartWasHome = true;
  private strokesSeen = 0;
  private hoistWasTop = false;
  /** Seconds the lathe has turned at its speed. */
  private turned = 0;
  /** Gear taps seen (a tap sends a gear on its shaft back into the drawer). */
  private gearTaps = new Map<Part, number>();
  /** Boxes in the lorry; at three it drives off. */
  loaded = 0;
  private lorry!: Critter;
  private drivenOff = 0;
  // The evening shift.
  private eveBox!: WireBox;
  private evePanel!: Substation;
  private gantry!: Gantry;
  private coil!: THREE.Group;
  private tank!: PaintTank;
  private pipes!: WireBox;
  private booth!: PaintBooth;
  private gmotor!: ShaftMotor;
  private grinder!: Lathe;
  private welder!: Part;
  private board2!: SocketBoard;
  private eveLit = false;
  private eveLamps: THREE.Mesh[] = [];
  private eveToys: { m: THREE.Group; x: number; stage: number }[] = [];
  private eveBlanks = 0;
  private ground = 0;
  /** Boxes in the second lorry. */
  loaded2 = 0;
  private lorry2!: Critter;
  private drivenOff2 = 0;

  protected build() {
    this.buildBoard();
    this.buildYard();
    this.buildHall();
    this.placeParts();
    this.buildCritters();
    this.buildNeeds();
    this.layBuilding();
    this.wallClock();
    this.placeProps();
    this.life.addToy('soda', -W / 2 + 2.5, -20, Math.PI / 2);
    // People about the hall on the yellow walkways, each its own stretch and back, clear of the stations.
    const ways = this.aisleRuns();
    for (let i = 0; i < 4; i++) {
      const way = ways[(i * 3) % Math.max(1, ways.length)];
      if (!way) break;
      // Modelled facing +z; the hall's life walks things nose along +x.
      const made = model(CREW[i % CREW.length], { height: 1.6 });
      const who = new THREE.Group();
      if (made) made.rotation.y = Math.PI / 2;
      who.add(made ?? worker('#3f86d6', '#f2c230'));
      this.life.addWalker(who, way, 'hammer');
    }
  }

  /**
   * The wires that are part of the building, laid already: each station's
   * supply from its pole (panel and box, press, motors, socket boards, paint).
   * The child runs only the wire that is the puzzle — through a lever to a
   * motor, a plug to the socket of its shape — and turns, presses, holds.
   */
  private layBuilding() {
    const pole = (at: THREE.Vector3) => this.poles.get(at)!;
    this.layChain(pole(PANEL_POLE), [this.box, this.panel]);
    this.layChain(pole(LATHE_POLE), [this.motor]);
    this.layChain(pole(PRESS_POLE), [this.press]);
    for (const [at, board] of [[ROBOT_POLE, this.board], [WELD_POLE, this.board2]] as const) {
      this.lay(pole(at).terminal('a'), board.terminal('p'));
      this.lay(board.terminal('n'), pole(at).terminal('b'));
    }
    this.layChain(pole(EVE_BOX_POLE), [this.eveBox, this.evePanel]);
    this.layChain(pole(TANK_POLE), [this.tank, this.booth]);
    this.layChain(pole(GRIND_POLE), [this.gmotor]);
  }

  /** The belts' painted decks (Codex's factory-conveyor-deck: rubber slats between yellow edges, 4.2 long a picture), running while their line has power. */
  private decks: { tex: THREE.Texture; line: 'day' | 'evening' }[] = [];

  private beltDeck(len: number, x: number, z: number, line: 'day' | 'evening') {
    const pic = kitPieces('factory', 'factory-conveyor-deck', true)[0];
    if (!pic) return;
    const tex = pic.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(len / 4.2, 1);
    tex.needsUpdate = true;
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    deck.position.set(x, 0.501, z);
    deck.receiveShadow = true;
    this.scenery.add(deck);
    this.decks.push({ tex, line });
  }

  /** Codex's furniture of the hall; a control cabinet's lamps go green once the hall has power. */
  private placeProps() {
    for (const [name, fit, x, z, yaw, view] of PROPS) {
      const m = model(name, fit);
      if (!m) continue;
      m.position.set(x, 0, z);
      m.rotation.y = yaw;
      m.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        o.castShadow = o.receiveShadow = true;
        // Each lamp its own material (the model shares one), so each can light alone.
        if (/^lamp-/.test(o.name)) {
          const lamp = o as THREE.Mesh;
          lamp.material = (lamp.material as THREE.MeshStandardMaterial).clone();
          this.cabinetLamps.push({ m: lamp.material as THREE.MeshStandardMaterial, color: o.name.slice(5) });
        }
      });
      this.scenery.add(m);
      const art = PROP_ART[view ? `${name}@${view}` : name];
      const pic = art && this.kit ? kitPieces('factory', art.piece)[0] : undefined;
      if (art && pic) {
        // Unseen (the picture is the look), but still there to be tapped and to jump; the lamps draw over the picture.
        m.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = false;
          if (!/^lamp-/.test(o.name)) Object.assign(mesh.material as THREE.Material, { colorWrite: false, depthWrite: false });
          else {
            Object.assign(mesh.material as THREE.Material, { transparent: true, depthTest: false, depthWrite: false });
            mesh.renderOrder = 30;
            mesh.userData.noAO = true;
          }
        });
        const card = painted([{ x: 0, z: art.front, size: art.size }], pic, art, kitPieces('farm', 'blob-shadow')[0] ?? null);
        // The picture faces the camera however the model is turned; taps go through it to the model.
        card.rotation.y = -yaw;
        card.traverse((o) => (o.raycast = () => {}));
        m.add(card);
      }
      // A tap on it: it answers (the cabinet blinks all its lamps, the trolley rolls a little and back).
      const lamps = this.cabinetLamps.slice(-3);
      const trick =
        name === 'factory-control-cabinet'
          ? (k: number) => lamps.forEach((l, i) => (l.flash = k < 0 ? 0 : Math.sin(k * 12 + i * 2) > 0 ? 1 : 0))
          : name === 'factory-box-trolley'
            ? (k: number) => m.position.set(x + (k < 0 ? 0 : Math.sin(Math.min(1, k / 1.4) * Math.PI) * 0.5), m.position.y, z)
            : undefined;
      this.life.addProp(m, PROP_SOUND[name] ?? null, trick);
    }
  }

  private cabinetLamps: { m: THREE.MeshStandardMaterial; color: string; flash?: number }[] = [];

  /** A lever put on its place gets its supply from the station's pole at once; the child wires it on to the motor. */
  private layLevers() {
    for (const [spot, at] of [[CART_LEVER, CART_POLE], [HOIST_LEVER, HOIST_POLE], [MOVE_LEVER, CRANE_POLE], [LIFT_LEVER, CRANE_POLE]] as const) {
      const lever = this.on(spot, ['reverser']);
      if (!lever?.seated) continue;
      // Bigger on its place, so its three arrows are big enough for a child's finger.
      if (lever.root.scale.x !== LEVER_SCALE) lever.root.scale.setScalar(LEVER_SCALE);
      const pole = this.poles.get(at)!;
      this.lay(pole.terminal('a'), lever.terminal('p'));
      this.lay(lever.terminal('n'), pole.terminal('b'));
    }
  }

  /**
   * The clock on the back wall between the windows, above the pipe (Codex's wall
   * contract): its painted face over the code dial, hand and bells still the toy's.
   */
  private wallClock() {
    const { root, parts } = this.life.addToy('clock', 0, -D / 2 + 0.7, 0);
    const face = parts.face;
    face.position.y = face.userData.y0 = 3.4;
    // No post on the wall; the painted dial and rim take the place of the code ones.
    root.children.filter((c) => c !== face).forEach((c) => (c.visible = false));
    const dial = kitPieces('factory', 'factory-wall-clock')[0];
    if (dial) {
      face.children.slice(0, 2).forEach((c) => (c.visible = false));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: dial, alphaTest: 0.5 }));
      pic.position.z = 0.061;
      // A tap on the painted face is a tap on the clock (the toy's meshes are marked as its own).
      pic.userData.life = 'toy';
      face.add(pic);
    }
  }

  /** Straight stretches of the yellow walkways to walk: cut where a station, a pole, a lever or someone at work is near. */
  private aisleRuns(): THREE.Vector3[][] {
    const busy = [
      ...this.needs.flatMap((n) => [n.spot, ...n.more.map((m) => m.spot)]),
      ...[...this.critters.values()].map((c) => c.home),
      ...this.world.parts.map((p) => p.root.position),
    ];
    const runs: THREE.Vector3[][] = [];
    for (const z of [1.2 * K, 10 * K]) {
      let run: THREE.Vector3[] = [];
      const close = () => {
        if (run.length > 1 && run[0].distanceTo(run[run.length - 1]) >= 6) runs.push(run.filter((_, i) => i % 7 === 0 || i === run.length - 1));
        run = [];
      };
      for (let x = -W / 2 + 4; x <= W / 2 - 4; x += 0.5) {
        if (busy.some((b) => Math.hypot(b.x - x, b.z - z) < 2.4)) close();
        else run.push(v(x, z));
      }
      close();
    }
    return runs.sort((a, b) => b[0].distanceTo(b[b.length - 1]) - a[0].distanceTo(a[a.length - 1]));
  }

  protected saveExtra() {
    return { loaded: this.loaded, loaded2: this.loaded2 };
  }

  protected restoreExtra(m: MapProgress) {
    const p = m as FactoryProgress;
    this.loaded = p.loaded ?? 0;
    this.loaded2 = p.loaded2 ?? 0;
    if (this.loaded >= 3) this.drivenOff = 1;
    if (this.needs.find((n) => n.critter.name === 'worker9')?.done && this.loaded2 > 0) this.drivenOff2 = 1;
  }

  protected voiceOf(base: string): PhraseId | null {
    return VOICES[base] ?? null;
  }

  protected critterModel(base: string, fit: Fit, name: string): THREE.Object3D {
    const crew = base === 'foreman' ? 'factory-worker-foreman' : base === 'worker' ? CREW[Number(name.slice(6) || 0) % CREW.length] : null;
    return (crew && model(crew, { height: 1.6 })) || (model(MODEL_OF[base] ?? base, fit) ?? STAND_INS[base]?.() ?? blob(name));
  }

  /** How loud the hall's background is: a murmur while dark, the line running once there is power. */
  get hallSound(): number {
    return this.phase === 'evening' ? (this.eveLit ? 0.8 : 0.35) : this.lit ? 0.8 : 0.3;
  }

  /** Dim till the wiring box lets the power through; in the evening the store is dark again till its own lights are on. */
  protected darkness() {
    if (this.phase === 'evening') return this.eveLit ? 0.1 : DIM;
    return this.lit ? 0 : DIM;
  }

  /** Two shifts: the day line, then the evening shift on the second line; after it, the end. */
  protected after(p: Phase) {
    return { next: (p === 'day' ? 'evening' : 'done') as Phase, wait: 4 };
  }

  // ───────────────────────── Building ─────────────────────────

  /**
   * The world outside the hall, so it does not stand on bare paper: grass all
   * round, a concrete apron along the walls, the road the lorries leave by, and
   * a wood at the edge (the farm's and the city's painted pieces).
   */
  private buildYard() {
    const grass = kitPieces('farm', 'grass-main', true)[0];
    if (!this.kit || !grass) return;
    const [OW, OD] = [W + 44, D + 40];
    const ground = mesh(new THREE.PlaneGeometry(OW, OD).rotateX(-Math.PI / 2), grassMaterial(grass, null, [], 8, '#b4a4d0'), false);
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    ground.userData.noAO = true;
    this.scenery.add(ground);
    // Concrete apron round the walls.
    const pave = kitPieces('city', 'paving-main', true)[0];
    if (pave) {
      const ring: { x0: number; z0: number; x1: number; z1: number }[] = [
        { x0: -W / 2 - 3, z0: -D / 2 - 3, x1: W / 2 + 3, z1: -D / 2 },
        { x0: -W / 2 - 3, z0: D / 2, x1: W / 2 + 3, z1: D / 2 + 3 },
        { x0: -W / 2 - 3, z0: -D / 2, x1: -W / 2, z1: D / 2 },
        { x0: W / 2, z0: -D / 2, x1: W / 2 + 3, z1: D / 2 },
      ];
      this.scenery.add(toned(tiledRects(ring, pave, 5, -0.29, 1), '#c8c4c0'));
    }
    // The road the lorries drive off on: out of the south side past the day lorry, along to the east.
    const road = kitPieces('city', 'road-strip', true)[0];
    if (road) this.scenery.add(ribbons([{ pts: [[LORRY.x, D / 2], [LORRY.x, D / 2 + 9], [W / 2 + 22, D / 2 + 9]], w: 5 }, { pts: [[W / 2, LORRY2.z], [W / 2 + 22, LORRY2.z]], w: 5 }], road, 7 / 6, 14, -0.28, 2, 0.3));
    // A wood round it all (cards: little cost), clear of the road.
    const oak = kitPieces('farm', 'tree-oak-card');
    const pine = kitPieces('farm', 'tree-pine-card');
    if (oak.length && pine.length) {
      let seed = 23;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const wood: { x: number; z: number; size: number }[] = [];
      const firs: { x: number; z: number; size: number }[] = [];
      const onRoad = (x: number, z: number) => (Math.abs(x - LORRY.x) < 4.5 && z > D / 2) || (Math.abs(z - (D / 2 + 9)) < 4.5 && x > LORRY.x - 4) || (Math.abs(z - LORRY2.z) < 4.5 && x > W / 2);
      const tree = (x: number, z: number) => {
        if (onRoad(x, z)) return;
        (rnd() < 0.4 ? firs : wood).push({ x, z, size: (rnd() < 0.4 ? 3.2 : 4) * (0.85 + rnd() * 0.3) });
      };
      for (let x = -W / 2 - 12; x < W / 2 + 12; x += 2.6) for (const z of [-D / 2 - 6, -D / 2 - 9, D / 2 + 6.5, D / 2 + 13]) tree(x + (rnd() - 0.5) * 1.2, z + (rnd() - 0.5) * 1.2);
      for (let z = -D / 2 - 4; z < D / 2 + 4; z += 2.6) for (const x of [-W / 2 - 6, -W / 2 - 9.5, W / 2 + 6.5, W / 2 + 10]) tree(x + (rnd() - 0.5) * 1.2, z + (rnd() - 0.5) * 1.2);
      const shade = kitPieces('farm', 'blob-shadow')[0] ?? null;
      this.scenery.add(standees(wood, oak, shade), standees(firs, pine, shade));
    }
  }

  private buildBoard() {
    const plan: GroundPlan = {
      width: W,
      depth: D,
      // Yellow walkways along the line, to the panel and round the stock.
      lanes: [
        { pts: spread([[-37, 1.2], [37, 1.2]]), w: 1.6 },
        { pts: spread([[-32, 1.2], [-32, -8]]), w: 1.4 },
        { pts: spread([[-37, 10], [37, 10]]), w: 1.4 },
      ],
      field: { x0: 0, z0: 0, x1: 0, z1: 0 },
      mud: [],
      hill: { x: 0, z: 0, rx: 0.01, rz: 0.01 },
      // A light tiled floor with yellow walkways (factory-industrial-b).
      tiles: { base: 'paving', hill: 'paving', lane: 'path', field: 'paving', mud: 'paving' },
      saturation: 0.25,
    };
    // Codex's painted kit (factory-industrial-b's floor) when it has come.
    this.kit = hasKit('factory', 'factory-floor') && !new URLSearchParams(location.search).has('oldground');
    const top = this.kit ? grassMaterial(kitPieces('factory', 'factory-floor', true)[0], null, [], 8, '#e6f2f0', false) : groundMaterial(plan);
    const side = mat('#6a6f78', 0.8);
    const board = mesh(new THREE.BoxGeometry(W, 0.5, D), [side, side, top, side, side, side] as unknown as THREE.Material);
    board.position.y = -0.26;
    board.receiveShadow = true;
    board.castShadow = false;
    this.scenery.add(board);
    const walk = kitPieces('factory', 'walkway-strip', true);
    if (this.kit && walk.length) this.scenery.add(ribbons(plan.lanes, walk[0], 1.1, 6.4, 0.006, 1, 0.1));
    // A working floor: oil and grime where machines stand and things drive (a real shop is never spotless).
    const oil = kitPieces('factory', 'oil-patch');
    const spots: { x: number; z: number; size: number }[] = [
      ...[LATHE, PRESS, ROBOT, HOIST, CART, GRINDER, WELDER, TANK].map((p, i) => ({ x: p.x + (i % 2 ? 1.5 : -1.8), z: p.z + 2.2, size: 1.6 })),
      // Under the lorries, along the rails, round the coil stand and the hopper, by the loading ramp.
      { x: LORRY.x + 0.4, z: LORRY.z + 1.2, size: 2.2 }, { x: LORRY2.x - 0.6, z: LORRY2.z + 0.8, size: 2 },
      { x: CART.x - 2.5, z: CART.z + 0.9, size: 1.2 }, { x: CART.x + 3.2, z: CART.z - 0.7, size: 1 },
      { x: GANTRY_AT.x - 5.5, z: EVE_Z + 1.6, size: 1.5 }, { x: DROP.x + 0.8, z: EVE_Z - 1.4, size: 1.2 },
      ...spread([[36.2, -7.5, 1.8], [34, -16, 1.4]] as const).map(([x, z, size]) => ({ x, z, size })),
      // Grime along the walkways where people and trolleys go.
      ...spread([[-14, 1.6, 1], [6, 0.8, 0.9], [27, 1.4, 1.1], [-26, 9.6, 1], [12, 10.3, 0.9]] as const).map(([x, z, size]) => ({ x, z, size })),
    ];
    const stains = ['a', 'c'].map((v) => kitPieces('factory', `factory-floor-oil-${v}`)[0]).filter(Boolean);
    if (this.kit && stains.length) {
      // Codex's painted stains (contract: a/c 2.8 square at .42/.38, the streak b 5 × 1.667 at .40, dust 3.4 at .22).
      const g = new THREE.Group();
      spots.forEach((p, i) => g.add(floorDecal(stains[i % stains.length], p.size * 1.6, p.size * 1.6, p.x, p.z, i * 1.7, i % 2 ? 0.38 : 0.42)));
      const streak = kitPieces('factory', 'factory-floor-oil-b')[0];
      // Streaks where things drive: along the cart's rails, out of the lorries' places, along the belt's feet.
      if (streak)
        for (const [x, z, turn] of [[CART.x - 1, CART.z + 1.2, 0], [LORRY.x, LORRY.z + 4, Math.PI / 2], [LORRY2.x - 4, LORRY2.z + 1.5, 0], [-6 * K, LINE_Z + 1.1, 0], [14 * K, EVE_Z - 1.2, 0]] as const) g.add(floorDecal(streak, 5, 1.667, x, z, turn, 0.4));
      const dust = kitPieces('factory', 'factory-floor-dust')[0];
      // Dust along the walls, in the corners and round the machines' feet.
      if (dust) {
        const dusty: [number, number][] = [...spread([[-37, -23], [37, -23], [-37, 23], [37, 23], [-20, -23.5], [5, -23.5], [28, -23.5], [-38, 8], [38, -2], [38, 14]] as [number, number][]), ...[LATHE, PRESS, ROBOT, HOIST, GRINDER, WELDER, BOOTH].map((p): [number, number] => [p.x + 1.2, p.z - 1.4])];
        dusty.forEach(([x, z], i) => g.add(floorDecal(dust, 3.4, 3.4, x, z, i * 2.3, 0.22)));
      }
      // Marks of work on the floor (Codex's floor details, each where it would be in a real shop).
      const piece = (n: string) => kitPieces('factory', `factory-floor-${n}`)[0];
      const tyres = piece('tyre-tracks');
      // Tyre tracks where the trolleys and the lorries drive.
      if (tyres) for (const [x, z, turn] of [...spread([[-6, 5.6, 0], [8, 6.6, 0.08], [36, -6, Math.PI / 2]] as const), [LORRY.x, 4.5 * K, Math.PI / 2] as const]) g.add(floorDecal(tyres, 5, 1.667, x, z, turn, 0.4));
      // Arrows down the walkways, the way the line runs (+x).
      const arrow = piece('arrow');
      if (arrow) for (const [x, z] of spread([[-24, 1.2], [-4, 1.2], [16, 1.2], [-20, 10], [2, 10], [24, 10]] as const)) g.add(floorDecal(arrow, 1.3, 1.3, x, z, -Math.PI / 2, 0.8));
      // Cable channels under the stations' supply, from the pole towards the machine.
      const channel = piece('cable-channel');
      if (channel)
        for (const [a, b] of [[LATHE_POLE, MOTOR], [PRESS_POLE, PRESS], [ROBOT_POLE, BOARD], [TANK_POLE, TANK], [GRIND_POLE, GMOTOR], [WELD_POLE, BOARD2], [EVE_BOX_POLE, EVE_BOX]] as const) {
          const len = Math.hypot(b.x - a.x, b.z - a.z) - 2.2;
          if (len < 1.5) continue;
          const mid = a.clone().lerp(b, 0.45);
          g.add(floorDecal(channel, Math.min(len, 4.6), 1.1, mid.x, mid.z, -Math.atan2(b.z - a.z, b.x - a.x), 1));
        }
      // Drains in the floor, clear of the stations.
      const grate = piece('grate');
      if (grate) for (const [x, z] of spread([[5.5, 7.4], [-6.5, 3.6], [36.5, 2.6], [-2, 24.4], [-37.6, 3]] as const)) g.add(floorDecal(grate, 1.5, 1.5, x, z, 0, 1));
      this.scenery.add(g);
    } else if (this.kit && oil.length) this.scenery.add(patches(spots, oil, 0.007, 1));
  }

  /** The hall: walls with windows, pillars, lamps, the conveyor, the overhead crane over the stock, racks of steel. */
  private buildHall() {
    // Everything here stands still: baked into a few meshes at the end (Safari pays for every draw).
    const hall = new THREE.Group();
    const wall = mat('#e8dcc4', 0.85);
    const glass = mat('#9fd0e8', 0.2);
    const back = mesh(new THREE.BoxGeometry(W, 5, 0.6), wall);
    back.position.set(0, 2.5, -D / 2 + 0.3);
    hall.add(back);
    // The side walls are low: tall, they filled a quarter of the screen whenever the view came near an end of the hall.
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
      const s = mesh(new THREE.BoxGeometry(0.6, 1.2, D), wall);
      s.position.set(x, 0.6, 0);
      hall.add(s);
    }
    // The back wall: Codex's painted wall (brick, framed windows, pipes, a teal band) when the kit has it,
    // one picture to every 20 (4 × its height of 5); else code windows, a pipe and its valves.
    const wallPic = this.kit ? kitPieces('factory', 'factory-wall-back', true)[0] : undefined;
    if (wallPic) {
      const t = wallPic.clone();
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set((W - 1.2) / 20, 1);
      t.needsUpdate = true;
      // Lit like the rest of the hall (not unlit): dark before the lights come on, like everything else.
      const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.2, 5), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
      face.receiveShadow = true;
      face.position.set(0, 2.5, -D / 2 + 0.61);
      this.scenery.add(face);
    } else {
      for (let x = -36; x <= 36; x += 8) {
        const win = mesh(new THREE.BoxGeometry(5, 1.6, 0.1), glass, false);
        win.position.set(x, 3.4, -D / 2 + 0.65);
        hall.add(win);
      }
      // A pipe along the back wall with red valves.
      const pipe = mesh(new THREE.CylinderGeometry(0.18, 0.18, W - 4, 12), mat('#9aa3ad', 0.35, 0.7));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 2.2, -D / 2 + 1);
      hall.add(pipe);
      for (const x of [-22, -4, 14]) {
        const valve = mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 16), mat('#e8483f', 0.4));
        valve.position.set(x, 2.2, -D / 2 + 1.35);
        hall.add(valve);
      }
    }
    // Codex's painted things on the back wall (wall-contract.json): a tool board and the safety signs.
    for (const [name, w, h, x, y] of [['factory-tool-board', 2, 1.30078125, -12 * K, 0.75], ['factory-safety-signs', 2.4, 0.8015625, -8 * K, 0.9]] as const) {
      const pic = kitPieces('factory', name)[0];
      if (!pic) continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: pic, alphaTest: 0.5 }));
      m.position.set(x, y, -D / 2 + 0.62);
      this.scenery.add(m);
    }
    // Tall things hide the floor just north of them from the camera (about 0.78 of their height):
    // pillars and lamps keep clear of every station, its character and its hint bubble.
    const busy = [PANEL, BOX, PANEL_POLE, CART, CART_LEVER, CART_POLE, LATHE, MOTOR, LATHE_POLE, PRESS, PRESS_POLE, ROBOT, BOARD, ROBOT_POLE, HOIST, HOIST_LEVER, HOIST_POLE, ...WORKER_SPOTS];
    const hides = (x: number, z: number, h: number) => busy.some((b) => Math.abs(b.x - x) < 2.6 && b.z < z + 1 && b.z > z - h * 0.78 - 2);
    for (const [x, z] of spread([-30, -15, 0, 15, 30].flatMap((x) => [[x, -16], [x, 8]]))) {
      {
        // Nor in front of a storage bay: it hid the drums.
        if (hides(x, z, 5) || busy.some((b) => Math.hypot(b.x - x, b.z - z) < 5) || spread(BAYS).some(([bx, bz]) => Math.abs(bx - x) < 4.5 && z > bz - 2 && z < bz + 7)) continue;
        const pillar = mesh(new THREE.BoxGeometry(0.8, 5, 0.8), mat('#f2c230', 0.6));
        pillar.position.set(x, 2.5, z);
        hall.add(pillar);
      }
    }
    // Light on the floor once the box lets the power through (the lamps under the roof are not drawn:
    // seen from above they were only white blots over the stations).
    const pool = (x: number, z: number) => {
      const m = mesh(new THREE.CircleGeometry(3.2, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowFor('rgba(255,240,190,0.55)'), transparent: true, opacity: 0, depthWrite: false }), false);
      m.position.set(x, 0.02, z);
      m.renderOrder = 2;
      this.scenery.add(m);
      return m;
    };
    for (const [x, z] of spread([-30, -15, 0, 15, 30].flatMap((x) => [[x, -19], [x, -9], [x, 4]]))) if (!hides(x, z, 4.6)) this.lamps.push(pool(x, z));
    // The store's own light, dark till the evening shift's box lets the power through.
    for (const [x, z] of spread([-28, -14, 0, 14, 28].map((x) => [x, 19.5]))) this.eveLamps.push(pool(x, z));
    // The conveyor line the toys ride along.
    // From where the cart tips its blanks on to just past the hoist.
    const [d0, d1] = [LINE_START, HOIST.x + 6];
    const belt = mesh(new THREE.BoxGeometry(d1 - d0, 0.3, 1.4), mat('#3a3f4b', 0.7));
    belt.position.set((d0 + d1) / 2, 0.35, LINE_Z);
    hall.add(belt);
    this.beltDeck(d1 - d0, (d0 + d1) / 2, LINE_Z, 'day');
    for (let x = d0 + 1; x <= d1 - 1; x += 2) {
      const leg = mesh(new THREE.BoxGeometry(0.12, 0.35, 1.3), mat('#8a90a0', 0.4, 0.5), false);
      leg.position.set(x, 0.12, LINE_Z);
      hall.add(leg);
    }
    // The evening line, along the south of the hall.
    // It ends where the second lorry's bed begins (its last boxes go straight in).
    const [b0, b1] = [EVE_START - 0.4, EVE_STATIONS[3] + 0.4];
    const belt2 = mesh(new THREE.BoxGeometry(b1 - b0, 0.3, 1.4), mat('#3a3f4b', 0.7));
    belt2.position.set((b0 + b1) / 2, 0.35, EVE_Z);
    hall.add(belt2);
    this.beltDeck(b1 - b0, (b0 + b1) / 2, EVE_Z, 'evening');
    for (let x = EVE_START; x <= EVE_STATIONS[3]; x += 2) {
      const leg = mesh(new THREE.BoxGeometry(0.12, 0.35, 1.3), mat('#8a90a0', 0.4, 0.5), false);
      leg.position.set(x, 0.12, EVE_Z);
      hall.add(leg);
    }
    // The coil stand under the gantry's west end, and the hopper under its east end that cuts a coil into blanks
    // and feeds them to the belt beyond the leg.
    const stand = mesh(new THREE.BoxGeometry(1.6, 0.5, 1.4), mat('#2f6fb3', 0.5, 0.3));
    stand.position.set(GANTRY_AT.x - 5.5, 0.25, EVE_Z);
    const hopper = mesh(new THREE.CylinderGeometry(0.9, 0.5, 1.1, 16, 1, true), mat('#8d97a3', 0.4, 0.6));
    hopper.position.set(DROP.x, 0.75, DROP.z);
    (hopper.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const chute = mesh(new THREE.BoxGeometry(EVE_START - DROP.x + 0.4, 0.12, 0.7), mat('#8d97a3', 0.4, 0.6));
    chute.position.set((DROP.x + EVE_START) / 2, 0.42, DROP.z + 1.1);
    hall.add(stand, hopper, chute);
    // The stock: racks of steel bars and coils under the crane, crates and barrels.
    // The kit's painted stock (cards) when it has it, else the code-built stand-ins.
    const shade = kitPieces('farm', 'blob-shadow')[0] ?? null;
    const card = (name: string, spots: { x: number; z: number; size: number }[], fallback: () => void) => {
      const kind = this.kit ? PAINTED[name]?.find((k) => hasKit('factory', k.piece)) : undefined;
      if (kind) this.scenery.add(painted(spots, kitPieces('factory', kind.piece)[0], kind, shade));
      else {
        const maps = this.kit ? kitPieces('factory', name) : [];
        if (maps.length) this.scenery.add(standees(spots, maps, shade));
        else fallback();
      }
    };
    // Nothing of the stock stands near a station, its pole, its lever or the rails: it hid them, or stood on them.
    const stations = [...busy, EVE_BOX, EVE_PANEL, EVE_BOX_POLE, MOVE_LEVER, LIFT_LEVER, CRANE_POLE, TANK, PIPES, TANK_POLE, GRINDER, GMOTOR, GRIND_POLE, WELDER, BOARD2, WELD_POLE, LORRY, LORRY2];
    const clear = ([x, z]: readonly number[]) => stations.every((b) => Math.hypot(b.x - x, b.z - z) > 5) && !(Math.abs(z - CART.z) < 3 && x < CART.x + 10);
    // Racks of steel along the back wall: tall, they hide only the wall behind them (by the south wall they hid the evening line).
    const racks = spread([[-21, -23.4], [3, -23.4], [13, -23.4]] as const).filter(clear);
    card('rack-steel-card', racks.map(([x, z]) => ({ x, z, size: 5.5 })), () => racks.forEach(([x, z]) => hall.add(rack(x, z))));
    // Loose goods by the walls: painted pallets of boxes (plain code crates only without the kit).
    const goods = spread([[-36, -22, 1], [-34, -22, 0.8], [36, -22, 1.1], [34, -21, 0.9], [37, 22, 1], [-4, 25, 0.9], [26, 25, 1]] as const).filter(clear);
    card('pallet-card', goods.map(([x, z, k]) => ({ x, z, size: 2.4 * k })), () => goods.forEach(([x, z, k]) => hall.add(crate(x, z, k))));
    // Storage bays in the middle aisle, between the pillars: marked out on the floor, stacked with pallets and drums.
    const bays = spread(BAYS).filter(clear);
    const tape = kitPieces('factory', 'hazard-strip', true);
    for (const [x, z] of bays) {
      if (this.kit && tape.length) hall.add(ribbons([{ pts: [[x - 3.2, z - 1.9], [x + 3.2, z - 1.9], [x + 3.2, z + 1.9], [x - 3.2, z + 1.9], [x - 3.2, z - 1.9]], w: 0.22 }], tape[0], 1.12, 4.36, 0.0075, 2, 0.5));
    }
    // Side by side inside the tape; painted stock stands on its front feet, so the spots are near the front line.
    card('pallet-card', bays.flatMap(([x, z]) => [{ x: x - 2, z: z + 1, size: 2.2 }, { x: x + 0.25, z: z + 0.8, size: 2 }]), () => bays.forEach(([x, z]) => hall.add(stack(x, z, 2))));
    card('barrels-card', bays.map(([x, z]) => ({ x: x + 2.35, z: z + 1.2, size: 1.6 })), () => bays.forEach(([x, z]) => hall.add(barrel(x + 2.3, z))));
    const barrels = spread([[-38, 25], [38, 8], [3, 25]] as const).filter(clear);
    card('barrels-card', barrels.map(([x, z]) => ({ x, z, size: 2.6 })), () => barrels.forEach(([x, z]) => hall.add(barrel(x, z))));
    // Yellow and black safety lines round every station.
    for (const [cx, cz, w, d] of [[PANEL.x + 2, PANEL.z + 3, 9, 9], [CART.x - 2, CART.z + 2, 17, 9], [LATHE.x - 1.3, LATHE.z - 1, 8, 6], [PRESS.x, PRESS.z - 2.5, 9, 9], [ROBOT.x - 1, ROBOT.z - 3, 10, 11], [HOIST.x - 1, HOIST.z - 3, 9, 11], [EVE_BOX.x + 1.5, EVE_BOX.z + 0.5, 11, 7], [-32 * K, 18 * K, 10, 6], [-8 * K, 19 * K, 11, 6], [GRINDER.x - 1.3, GRINDER.z + 0.5, 8, 6], [WELDER.x - 1, WELDER.z + 2, 10, 9]] as const) {
      const strip = kitPieces('factory', 'hazard-strip', true);
      // Frames stay inside the hall's walls.
      const m = 1;
      const [x0, x1, z0, z1] = [Math.max(-W / 2 + m, cx - w / 2), Math.min(W / 2 - m, cx + w / 2), Math.max(-D / 2 + m, cz - d / 2), Math.min(D / 2 - m, cz + d / 2)];
      if (this.kit && strip.length) {
        hall.add(ribbons([{ pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]], w: 0.3 }], strip[0], 1.12, 4.36, 0.0075, 2, 0.5));
      } else hall.add(hazard((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0));
    }
    const pallets = spread([[36, -14, 3], [38.2, -14, 2], [36, -10.5, 2]] as const).filter(clear);
    card('pallet-card', pallets.map(([x, z]) => ({ x, z, size: 2.6 })), () => pallets.forEach(([x, z, n]) => hall.add(stack(x, z, n))));
    // No forklift in its box: a still picture of one, seen at another angle than the hall, looked wrong.
    this.scenery.add(bakeGroup(hall));
  }

  /** The poles and every machine are part of the hall; the child brings the levers and the gears. */
  private placeParts() {
    for (const p of [PANEL_POLE, CART_POLE, LATHE_POLE, PRESS_POLE, ROBOT_POLE, HOIST_POLE]) this.poles.set(p, this.pin('pole', p));
    this.panel = this.pin('substation', PANEL) as Substation;
    this.box = this.pin('wireBox', BOX) as WireBox;
    this.cart = this.pin('railCart', CART) as RailCart;
    this.motor = this.pin('shaftMotor', MOTOR) as ShaftMotor;
    this.lathe = this.pin('lathe', LATHE) as Lathe;
    this.lathe.setWant('slow');
    this.press = this.pin('safetyPress', PRESS) as SafetyPress;
    this.board = this.pin('socketBoard', BOARD) as SocketBoard;
    this.robot = this.pin('robotArm', ROBOT);
    // The robot's plugs are triangles: it takes power from the triangle sockets only.
    this.robot.terminal('a').shaped('triangle');
    this.robot.terminal('b').shaped('triangle');
    this.hoist = this.pin('lift', HOIST) as Lift;
    this.hoist.hoistSkin();
    // The machines of a real shop are big (industrial-b): shown half as large again. Not the lathe and its motor,
    // whose shafts must stay 1.4 apart for the child's gears.
    for (const p of [this.box, this.press, this.board, this.robot, this.cart, this.hoist]) p.root.scale.setScalar(MACHINE_SCALE);
    // The evening shift's machines.
    for (const p of [EVE_BOX_POLE, CRANE_POLE, TANK_POLE, GRIND_POLE, WELD_POLE]) this.poles.set(p, this.pin('pole', p));
    this.eveBox = this.pin('bigWireBox', EVE_BOX) as WireBox;
    this.evePanel = this.pin('substation', EVE_PANEL) as Substation;
    this.gantry = this.pin('gantry', GANTRY_AT) as Gantry;
    this.coil = coilMesh();
    this.coil.position.set(GANTRY_AT.x - 5.5, 0.95, EVE_Z);
    this.scenery.add(this.coil);
    this.tank = this.pin('tank', TANK) as PaintTank;
    this.pipes = this.pin('pipeBox', PIPES) as WireBox;
    this.booth = this.pin('paintBooth', BOOTH) as PaintBooth;
    this.booth.ownFeed = true;
    this.gmotor = this.pin('shaftMotor', GMOTOR) as ShaftMotor;
    this.grinder = this.pin('grinder', GRINDER) as Lathe;
    this.welder = this.pin('robotArm', WELDER);
    // The welder's plugs are squares.
    this.welder.terminal('a').shaped('square');
    this.welder.terminal('b').shaped('square');
    this.board2 = this.pin('socketBoard', BOARD2) as SocketBoard;
    for (const p of [this.welder, this.board2, this.tank, this.booth]) p.root.scale.setScalar(MACHINE_SCALE);
  }

  private buildCritters() {
    const [foreman, ...rest] = WORKER_SPOTS;
    this.critter('foreman', { height: 1.6 }, foreman, 1.6, 0.4);
    const workers: [string, THREE.Vector3][] = ['worker', 'worker2', 'worker3', 'worker4'].map((n, i) => [n, rest[i]]);
    for (const [name, at] of workers) this.critter(name, { height: 1.5 }, at, 1.5, 0.3);
    // Codex's lorry is modelled cab to +z and fitted by its length; the stand-in's cab is to +x.
    const made = hasModel('factory-delivery-lorry');
    const lorryFit: Fit = made ? { depth: 5.4 } : { width: 5 };
    // The day's lorry stands beside the hoist and drives off south; the evening's drives off east.
    this.lorry = this.critter('lorry', lorryFit, LORRY, 2.2, made ? 0 : Math.PI);
    this.lorry.roams = true;
    // The evening shift's people, by their stations, and the second lorry.
    for (const [name, at] of [['worker5', v(EVE_BOX.x + 4.5, EVE_BOX.z + 2)], ['worker6', v(-27 * K, 20.5 * K)], ['worker7', v(-2 * K, 20.5 * K)], ['worker8', v(GRINDER.x + 3, GRINDER.z + 3)], ['worker9', v(WELDER.x + 3.5, WELDER.z + 4)]] as const) this.critter(name, { height: 1.5 }, at, 1.5, 0.3);
    this.lorry2 = this.critter('lorry2', lorryFit, LORRY2, 2.2, made ? Math.PI / 2 : Math.PI);
    this.lorry2.roams = true;
    const cat = this.critter('cat', { height: 0.6 }, at(-35.5, -21.5), 0.6, 0.5);
    cat.base = 1.05;
  }

  private buildNeeds() {
    const get = (name: string) => this.critters.get(name)!;
    const add = (n: NeedSpec) => this.addNeed(n);
    const gears: PartKind[] = ['smallGear', 'bigGear', 'gear'];
    // One line of work, station by station: each waits for the one before it, and counts once a toy has gone through it.
    add({ critter: get('foreman'), phase: 'day', ask: 'boxAsk', thanks: 'boxHappy', icon: 'bulb', kinds: [], spot: BOX, focus: [PANEL.clone(), BOX.clone()], met: () => this.lit, picture: 'factory-bubble-dark-lamp', sticker: 'breaker' });
    add({ critter: get('worker'), phase: 'day', after: 'foreman', ask: 'cartAsk', thanks: 'cartHappy', icon: 'reverser', kinds: ['reverser'], spot: CART_LEVER, focus: [CART.clone(), CART_LEVER.clone()], met: () => this.toys.length > 0 || this.passed[0] > 0, picture: 'factory-bubble-empty-belt', sticker: 'cart' });
    add({ critter: get('worker2'), phase: 'day', after: 'worker', ask: 'latheAsk', thanks: 'latheHappy', icon: 'bigGear', kinds: gears, spot: LATHE_SHAFT, more: [{ icon: 'smallGear', kinds: gears, spot: MOTOR_SHAFT }], focus: [LATHE.clone(), MOTOR.clone()], met: () => this.passed[0] > 0, picture: 'factory-bubble-gears', sticker: 'lathe' });
    add({ critter: get('worker3'), phase: 'day', after: 'worker2', ask: 'press2Ask', thanks: 'press2Happy', icon: 'safetyPress', kinds: [], spot: PRESS, focus: [PRESS.clone()], met: () => this.passed[1] > 0, picture: 'factory-bubble-two-hands', sticker: 'press' });
    add({ critter: get('worker4'), phase: 'day', after: 'worker3', ask: 'plugAsk', thanks: 'plugHappy', icon: 'robotArm', kinds: [], spot: BOARD, focus: [ROBOT.clone(), BOARD.clone()], met: () => this.passed[2] > 0, picture: 'factory-bubble-triangle-plug', sticker: 'robot' });
    add({ critter: this.lorry, phase: 'day', after: 'worker4', ask: 'hoistAsk', thanks: 'hoistHappy', icon: 'reverser', kinds: ['reverser'], spot: HOIST_LEVER, focus: [HOIST.clone(), HOIST_LEVER.clone(), LORRY.clone()], met: () => this.loaded >= 1, picture: 'factory-bubble-box-lorry', sticker: 'lorry' });
    // The evening shift.
    add({ critter: get('worker5'), phase: 'evening', ask: 'storeAsk', thanks: 'storeHappy', icon: 'bulb', kinds: [], spot: EVE_BOX, focus: [EVE_BOX.clone(), EVE_PANEL.clone()], met: () => this.eveLit, picture: 'factory-bubble-dark-lamp', sticker: 'store' });
    add({ critter: get('worker6'), phase: 'evening', after: 'worker5', ask: 'gantryAsk', thanks: 'gantryHappy', icon: 'reverser', kinds: ['reverser'], spot: MOVE_LEVER, more: [{ icon: 'reverser', kinds: ['reverser'], spot: LIFT_LEVER }], focus: [MOVE_LEVER.clone(), LIFT_LEVER.clone(), v(GANTRY_AT.x - 5.5, EVE_Z), DROP.clone()], met: () => this.eveToys.length > 0 || this.evePassed[0] > 0, picture: 'factory-bubble-coil', sticker: 'gantry' });
    add({ critter: get('worker7'), phase: 'evening', after: 'worker6', ask: 'paintAsk2', thanks: 'paintHappy2', icon: 'paintBooth', kinds: [], spot: PIPES, focus: [TANK.clone(), PIPES.clone(), BOOTH.clone()], met: () => this.evePassed[0] > 0, picture: 'factory-bubble-gray-toy', sticker: 'paint' });
    add({ critter: get('worker8'), phase: 'evening', after: 'worker7', ask: 'grinderAsk', thanks: 'grinderHappy', icon: 'smallGear', kinds: gears, spot: GRIND_SHAFT, more: [{ icon: 'bigGear', kinds: gears, spot: GMOTOR_SHAFT }], focus: [GRINDER.clone(), GMOTOR.clone()], met: () => this.evePassed[1] > 0, picture: 'factory-bubble-gears-fast', sticker: 'grinder' });
    add({ critter: get('worker9'), phase: 'evening', after: 'worker8', ask: 'welderAsk', thanks: 'welderHappy', icon: 'robotArm', kinds: [], spot: BOARD2, focus: [WELDER.clone(), BOARD2.clone()], met: () => this.evePassed[2] > 0, picture: 'factory-bubble-square-plug', sticker: 'welder' });
  }

  private on(at: THREE.Vector3, kinds: PartKind[]): Part | undefined {
    return this.world.parts.find((p) => kinds.includes(p.kind) && p.root.position.distanceTo(at) < 0.8);
  }

  // ───────────────────────── Hints ─────────────────────────

  /** A wire to run, if these two posts are not joined yet. */
  private join(a: Terminal | undefined, b: Terminal | undefined, phrase: PhraseId = 'chainNext'): Hint | null {
    return a && b && !this.world.wired(a, b) ? { type: 'connect', from: a, to: b, phrase } : null;
  }

  /** A lever between a pole and a motor: + and − in from the pole, a and b out to the motor. */
  private leverWires(lever: Reverser, pole: Part, motor: Part): Hint | null {
    return this.join(pole.terminal('a'), lever.terminal('p'), 'chainStart') ?? this.join(lever.terminal('n'), pole.terminal('b'), 'chainBack') ?? this.join(lever.terminal('a'), motor.terminal('a'), 'leverWire') ?? this.join(lever.terminal('b'), motor.terminal('b'), 'leverWire');
  }

  /** The next step at the station being helped: its wires, then what to press, turn or hold. */
  protected extraHint(): Hint | null {
    const n = this.focused && !this.focused.done && this.isNow(this.focused) ? this.focused : this.current();
    return n ? this.stationHint(n.critter.name) : null;
  }

  private stationHint(name: string): Hint | null {
    const pole = (at: THREE.Vector3) => this.poles.get(at)!;
    switch (name) {
      case 'foreman': {
        const h = this.chainHint(pole(PANEL_POLE), [this.box, this.panel]);
        if (h) return h;
        const at = this.box.hintPoint();
        return at ? { type: 'tap', part: this.box, phrase: 'turnTile', local: at } : null;
      }
      case 'worker': {
        const lever = this.on(CART_LEVER, ['reverser']) as Reverser | undefined;
        if (!lever) return { type: 'drag', kind: 'reverser', to: CART_LEVER.clone(), phrase: 'placeHere' };
        const h = this.leverWires(lever, pole(CART_POLE), this.cart);
        if (h) return h;
        // Forward takes it to the line; back home again when it has unloaded.
        const want = this.cart.x > 3.5 ? -1 : 1;
        return lever.pos === want ? null : { type: 'tap', part: lever, phrase: want === 1 ? 'cartGo' : 'cartBack', local: lever.posPoint(want) };
      }
      case 'worker2': {
        const h = this.chainHint(pole(LATHE_POLE), [this.motor]);
        if (h) return h;
        // Gears the wrong way round (or the middle one, which fits nowhere): tap it to put it back.
        const onMotor = this.on(MOTOR_SHAFT, ['smallGear', 'bigGear', 'gear']);
        const onLathe = this.on(LATHE_SHAFT, ['smallGear', 'bigGear', 'gear']);
        const wrong = onMotor && onMotor.kind !== 'smallGear' ? onMotor : onLathe && onLathe.kind !== 'bigGear' ? onLathe : null;
        if (wrong) return { type: 'tap', part: wrong, phrase: this.lathe.speed === 'fast' ? 'latheFast' : this.lathe.speed === 'slow' ? 'latheSlow' : 'gearBack' };
        return null;
      }
      case 'worker3':
        return this.chainHint(pole(PRESS_POLE), [this.press]) ?? (this.press.strokes < 3 ? { type: 'tap', part: this.press, phrase: 'twoHands', local: this.press.buttonPoint(this.press.held[0] ? 1 : 0) } : null);
      case 'worker4': {
        const p = pole(ROBOT_POLE);
        return this.join(p.terminal('a'), this.board.terminal('p'), 'chainStart') ?? this.join(this.board.terminal('n'), p.terminal('b'), 'chainBack') ?? this.join(this.robot.terminal('a'), this.board.terminal('triangle+'), 'plugShape') ?? this.join(this.robot.terminal('b'), this.board.terminal('triangle-'), 'plugShape');
      }
      case 'lorry': {
        const lever = this.on(HOIST_LEVER, ['reverser']) as Reverser | undefined;
        if (!lever) return null;
        const h = this.leverWires(lever, pole(HOIST_POLE), this.hoist);
        if (h) return h;
        // Nothing on the line to lift yet: the blanks come first, with the cart.
        if (!this.toys.length && !this.blanks && !this.needs.find((m) => m.critter.name === 'worker')?.done) return this.stationHint('worker');
        // Up with a box waiting, down again to fetch the next.
        const waiting = this.toys.some((t) => t.stage === STATIONS.length - 1 && t.x >= HOIST.x - 0.1);
        const want = this.hoist.end === 'top' ? -1 : waiting || this.hoist.end !== 'bottom' ? 1 : 0;
        return want === 0 || lever.pos === want ? null : { type: 'tap', part: lever, phrase: want === 1 ? 'hoistUp' : 'hoistDown', local: lever.posPoint(want) };
      }
      case 'worker5': {
        const h = this.chainHint(pole(EVE_BOX_POLE), [this.eveBox, this.evePanel]);
        if (h) return h;
        const at = this.eveBox.hintPoint();
        return at ? { type: 'tap', part: this.eveBox, phrase: 'turnTile', local: at } : null;
      }
      case 'worker6': {
        const move = this.on(MOVE_LEVER, ['reverser']) as Reverser | undefined;
        const lift = this.on(LIFT_LEVER, ['reverser']) as Reverser | undefined;
        if (!move) return { type: 'drag', kind: 'reverser', to: MOVE_LEVER.clone(), phrase: 'placeHere' };
        if (!lift) return { type: 'drag', kind: 'reverser', to: LIFT_LEVER.clone(), phrase: 'placeHere' };
        const p = pole(CRANE_POLE);
        const g = this.gantry;
        const wires =
          this.join(p.terminal('a'), move.terminal('p'), 'chainStart') ?? this.join(move.terminal('n'), p.terminal('b'), 'chainBack') ?? this.join(move.terminal('a'), g.terminal('a1'), 'leverWire') ?? this.join(move.terminal('b'), g.terminal('b1'), 'leverWire') ??
          this.join(p.terminal('a'), lift.terminal('p'), 'chainStart') ?? this.join(lift.terminal('n'), p.terminal('b'), 'chainBack') ?? this.join(lift.terminal('a'), g.terminal('a2'), 'leverWire') ?? this.join(lift.terminal('b'), g.terminal('b2'), 'leverWire');
        if (wires) return wires;
        // Up, over to the coil, down to take it; up, over to the line, down to leave it.
        const lever = (l: Reverser, pos: -1 | 0 | 1, phrase: PhraseId): Hint | null => (l.pos === pos ? null : { type: 'tap', part: l, phrase, local: l.posPoint(pos) });
        const to = this.hooked ? 1 : -1;
        if (g.end !== to) return g.high ? lever(move, to, this.hooked ? 'craneToLine' : 'craneToCoil') : lever(lift, 1, 'craneUp');
        return g.low ? lever(lift, 1, 'craneUp') : lever(lift, -1, 'craneDown');
      }
      case 'worker7': {
        const h = this.chainHint(pole(TANK_POLE), [this.tank, this.booth]);
        if (h) return h;
        const at = this.pipes.hintPoint();
        return at ? { type: 'tap', part: this.pipes, phrase: 'turnPipe', local: at } : null;
      }
      case 'worker8': {
        const h = this.chainHint(pole(GRIND_POLE), [this.gmotor]);
        if (h) return h;
        const onMotor = this.on(GMOTOR_SHAFT, ['smallGear', 'bigGear', 'gear']);
        const onStone = this.on(GRIND_SHAFT, ['smallGear', 'bigGear', 'gear']);
        const wrong = onMotor && onMotor.kind !== 'bigGear' ? onMotor : onStone && onStone.kind !== 'smallGear' ? onStone : null;
        if (wrong) return { type: 'tap', part: wrong, phrase: this.grinder.speed === 'slow' ? 'grinderSlow' : 'gearBack' };
        return null;
      }
      case 'worker9': {
        const p = pole(WELD_POLE);
        return this.join(p.terminal('a'), this.board2.terminal('p'), 'chainStart') ?? this.join(this.board2.terminal('n'), p.terminal('b'), 'chainBack') ?? this.join(this.welder.terminal('a'), this.board2.terminal('square+'), 'plugShape') ?? this.join(this.welder.terminal('b'), this.board2.terminal('square-'), 'plugShape');
      }
      case 'lorry2':
        // Boxes come on their own once the line works: its first need is the crane's blanks.
        if (!this.eveToys.length && !this.eveBlanks && !this.needs.find((m) => m.critter.name === 'worker6')?.done) return this.stationHint('worker6');
        return null;
    }
    return null;
  }

  // ───────────────────────── Story ─────────────────────────

  protected phaseBegins(p: Phase) {
    if (p === 'evening') this.hooks.say('eveningShift');
    if (p === 'done') this.hooks.say('factoryDone');
  }

  protected tick(dt: number) {
    // The hall's lights come on once the panel has power through the box.
    const lit = this.panel.live && this.box.closed;
    if (lit && !this.lit) this.hooks.chime();
    this.lit = lit;
    this.lamps.forEach((l, i) => {
      const pm = l.material as THREE.MeshBasicMaterial;
      pm.opacity = THREE.MathUtils.damp(pm.opacity, this.lit && this.phaseT * 3 > i * 0.15 ? 0.8 : 0, 6, dt);
    });
    // A tap on a gear on its shaft sends it back into the drawer (to try the other one).
    for (const g of this.world.parts) {
      if (!(g instanceof Gear)) continue;
      const seen = this.gearTaps.get(g) ?? g.taps;
      if (g.taps > seen && g.seated) {
        this.world.removePart(g);
        this.hooks.say('gearBack');
      }
      this.gearTaps.set(g, g.taps);
    }
    if (this.lathe.speed === 'ok') this.turned += dt;
    // The belts run while their line has power (the toys ride them at 2 a second: the slats keep pace).
    for (const d of this.decks) if (d.line === 'day' ? this.lit : this.eveLit) d.tex.offset.x -= (dt * 2) / 4.2;
    // The cabinets: red while the hall is dark, green once it has power, amber blinking at the turn of the shift.
    for (const l of this.cabinetLamps) {
      const on = l.color === 'red' ? !this.lit : l.color === 'green' ? this.lit : this.phase === 'evening' && !this.eveLit && Math.sin(this.time * 6) > 0;
      l.m.emissive.set(l.color === 'red' ? '#ff3b2f' : l.color === 'green' ? '#4cff6a' : '#ffb020');
      l.m.emissiveIntensity = THREE.MathUtils.damp(l.m.emissiveIntensity, on || l.flash ? 2.2 : 0, 8, dt);
    }
    this.layLevers();
    this.autoHoist();
    this.updateCart();
    this.updateLine(dt);
    this.updateLorry(dt);
    this.updateEvening(dt);
  }

  /** The coil is on the gantry's hook. */
  private hooked = false;
  private coilBack = 0;

  /**
   * The evening shift: the store's lamps on its box, the gantry taking a coil
   * from its stand to the line (three blanks), paint through the pipe tiles,
   * the grinder at its speed, the welder on its square sockets, and boxes off
   * the end into the second lorry.
   */
  private updateEvening(dt: number) {
    const lit = this.evePanel.live && this.eveBox.closed;
    if (lit && !this.eveLit) this.hooks.chime();
    this.eveLit = lit;
    for (const l of this.eveLamps) {
      const pm = l.material as THREE.MeshBasicMaterial;
      pm.opacity = THREE.MathUtils.damp(pm.opacity, this.eveLit ? 0.8 : 0, 6, dt);
    }
    // The gantry: the hook right down at the stand takes the coil, right down at the line's start leaves it there.
    const g = this.gantry;
    if (!this.hooked && this.coilBack <= 0 && g.end === -1 && g.low) {
      this.hooked = true;
      g.load.add(this.coil);
      this.coil.position.set(0, 0, 0);
      this.hooks.chime();
    } else if (this.hooked && g.end === 1 && g.low) {
      this.hooked = false;
      this.scenery.add(this.coil);
      this.coil.visible = false;
      this.coilBack = 3;
      this.eveBlanks += 3;
      this.hooks.chime();
    }
    if (this.coilBack > 0) {
      // A new coil is put on the stand.
      this.coilBack -= dt;
      if (this.coilBack <= 0) {
        this.coil.visible = true;
        this.coil.position.set(GANTRY_AT.x - 5.5, 0.95, EVE_Z);
      }
    }
    // Paint runs through the joined pipe tiles while the tank pumps.
    this.pipes.flowing = this.tank.pumping && this.pipes.closed;
    this.booth.fed = this.pipes.flowing;
    if (this.grinder.speed === 'ok') this.ground += dt;
    // The second line.
    if (this.eveBlanks > 0 && this.eveToys.length < 8 && !this.eveToys.some((t) => t.x < EVE_START + 1.5)) {
      this.eveBlanks--;
      // The evening's bears are pressed out of the steel coil: grey till the paint.
      const m = toyMesh('steel');
      m.position.set(EVE_START, 0.75, EVE_Z);
      this.scenery.add(m);
      this.eveToys.push({ m, x: EVE_START, stage: 0 });
    }
    const works = [() => this.booth.painting, () => this.grinder.speed === 'ok', () => Math.abs(this.welder.state.level) > 0.15, () => true];
    const order = [...this.eveToys].sort((a, b) => b.x - a.x);
    let ahead = Infinity;
    for (const t of order) {
      const next = EVE_STATIONS[t.stage] ?? Infinity;
      const goal = Math.min(next, ahead - 1.2);
      if (t.x < goal) t.x = Math.min(goal, t.x + dt * 2);
      if (t.x >= next - 0.01 && t.stage < EVE_STATIONS.length && works[t.stage]?.()) {
        this.evePassed[t.stage]++;
        t.stage++;
        if (t.stage === 1) dressToy(t.m, 'painted');
        this.hooks.chime();
        if (t.stage === EVE_STATIONS.length) {
          this.loaded2++;
          t.m.removeFromParent();
        }
      }
      t.m.position.x = t.x;
      ahead = t.x;
    }
    this.eveToys = this.eveToys.filter((t) => t.stage < EVE_STATIONS.length);
    // The second lorry waits for the evening; full, it drives off.
    // The evening's last station done and a box aboard: the second lorry drives off (the end of the shift).
    if (this.needs.find((n) => n.critter.name === 'worker9')?.done && this.loaded2 > 0) {
      // Off it goes, with its own sticker (the shift's finale is not a station of its own).
      if (this.drivenOff2 === 0) {
        this.hooks.say('lorry2Happy');
        this.hooks.helped?.('lorry2', this.lorry2.group.position.clone().setY(2.2));
      }
      const was = this.drivenOff2;
      this.drivenOff2 = Math.min(1, this.drivenOff2 + dt * 0.15);
      this.roll(this.lorry2, (this.drivenOff2 - was) * 20);
    }
    const p = this.lorry2.group.position;
    p.set(LORRY2.x + this.drivenOff2 * 20, 0, LORRY2.z);
    this.lorry2.home.copy(p);
    this.lorry2.group.visible = this.phase !== 'day' && this.drivenOff2 < 1;
  }

  /** Once the child has lifted the first box, the driver works the hoist lever for the rest: up with a box, down for the next. */
  private autoHoist() {
    if (!this.needs.find((n) => n.critter === this.lorry)?.done) return;
    const lever = this.on(HOIST_LEVER, ['reverser']) as Reverser | undefined;
    if (!lever) return;
    const waiting = this.toys.some((t) => t.stage === STATIONS.length - 1 && t.x >= HOIST.x - 0.1);
    const want = this.hoist.end === 'top' ? -1 : waiting || this.hoist.end !== 'bottom' ? 1 : 0;
    if (lever.pos !== want) {
      lever.pos = want;
      lever.closed = want !== 0;
      this.world.markDirty();
    }
  }

  /** At the line's end of its rails the cart tips three blanks onto the line; back home it loads up again. */
  private updateCart() {
    const atLine = this.cart.x > 3.5;
    if (atLine && this.cartWasHome) {
      this.cartWasHome = false;
      this.blanks += 3;
      this.hooks.chime();
    }
    if (this.cart.x < -3.5) this.cartWasHome = true;
    this.cart.bed.visible = this.cartWasHome;
  }

  /**
   * Blanks from the cart ride along the line, each waiting at a station till
   * it works: the lathe turns it, the press stamps it (a stroke while it
   * waits), the robot paints it, and the hoist lifts the box into the lorry.
   */
  private updateLine(dt: number) {
    if (this.blanks > 0 && this.toys.length < 8 && !this.toys.some((t) => t.x < LINE_START + 1.5)) {
      this.blanks--;
      const m = toyMesh();
      m.position.set(LINE_START, 0.75, LINE_Z);
      this.scenery.add(m);
      this.toys.push({ m, x: LINE_START, stage: 0 });
    }
    const pressed = this.press.strokes > this.strokesSeen;
    this.strokesSeen = this.press.strokes;
    // Once the child has shown the press how, its worker keeps working it for every blank that comes.
    const pressDone = !!this.needs.find((n) => n.critter.name === 'worker3')?.done;
    const waitingAtPress = this.toys.some((t) => t.stage === 1 && t.x >= PRESS.x - 0.1);
    if (pressDone && this.press.held[0] !== waitingAtPress) {
      this.press.held.fill(waitingAtPress);
      this.world.markDirty();
    }
    const top = this.hoist.end === 'top';
    const lifted = top && !this.hoistWasTop;
    this.hoistWasTop = top;
    const works = [() => this.lathe.speed === 'ok', () => pressed, () => Math.abs(this.robot.state.level) > 0.15, () => lifted];
    const order = [...this.toys].sort((a, b) => b.x - a.x);
    let ahead = Infinity;
    for (const t of order) {
      const next = STATIONS[t.stage] ?? Infinity;
      const goal = Math.min(next, ahead - 1.2);
      if (t.x < goal) t.x = Math.min(goal, t.x + dt * 2);
      if (t.x >= next - 0.01 && t.stage < STATIONS.length && works[t.stage]?.()) {
        this.passed[t.stage]++;
        t.stage++;
        dressToy(t.m, (['turned', 'stamped', 'painted', 'boxed'] as const)[t.stage - 1]);
        // Painted, it goes into its box on the way to the hoist.
        if (t.stage === 3) dressToy(t.m, 'boxed');
        this.hooks.chime();
        if (t.stage === STATIONS.length) {
          this.loaded++;
          t.m.removeFromParent();
        }
      }
      t.m.position.x = t.x;
      t.m.position.y = 0.75;
      ahead = t.x;
    }
    this.toys = this.toys.filter((t) => t.stage < STATIONS.length);
  }

  /** The boxes already in a lorry, standing in its open bed (up to three), so the loading is seen to fill it. */
  private cargo(lorry: Critter, n: number) {
    let held = lorry.group.userData.cargo as THREE.Object3D[] | undefined;
    if (!held) {
      // The bed: behind the cab, along the lorry's length (+z is its nose), at the height of its floor
      // (measured where the lorry stands now).
      lorry.group.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(lorry.group.children[0]);
      const size = box.getSize(new THREE.Vector3());
      const local = lorry.group.worldToLocal(box.getCenter(new THREE.Vector3()));
      const along = hasModel('factory-delivery-lorry') ? 'z' : 'x';
      const len = along === 'z' ? Math.max(size.x, size.z) : size.x;
      held = [0, 1, 2].map((i) => {
        const b = model('factory-product-box', { width: 0.8 }) ?? giftBox();
        const t = -0.35 + i * 0.2;
        b.position.set(along === 'x' ? local.x - t * len * (along === 'x' ? -1 : 1) : local.x, size.y * 0.42, along === 'z' ? local.z + t * len : local.z);
        b.visible = false;
        lorry.group.add(b);
        return b;
      });
      lorry.group.userData.cargo = held;
    }
    held.forEach((b, i) => (b.visible = i < n));
  }

  /** A lorry's wheels (Codex's model has them as their own nodes) turn as it drives: `dist` is how far it went this frame. */
  private roll(lorry: Critter, dist: number) {
    if (!dist) return;
    let wheels = lorry.group.userData.wheels as THREE.Object3D[] | undefined;
    if (!wheels) {
      wheels = [];
      lorry.group.traverse((o) => /^wheel-/.test(o.name) && wheels!.push(o));
      lorry.group.userData.wheels = wheels;
    }
    for (const w of wheels) w.rotation.x += dist / 0.45;
  }

  /** Loaded up, the lorry hoots and drives off out of the hall. */
  private updateLorry(dt: number) {
    this.cargo(this.lorry, Math.min(3, this.loaded));
    this.cargo(this.lorry2, Math.min(3, this.loaded2));
    // Full (three boxes), it drives off.
    if (this.loaded >= 3) {
      const was = this.drivenOff;
      this.drivenOff = Math.min(1, this.drivenOff + dt * 0.15);
      this.roll(this.lorry, (this.drivenOff - was) * 40);
    }
    const p = this.lorry.group.position;
    p.set(LORRY.x, 0, LORRY.z + this.drivenOff * 40);
    this.lorry.home.copy(p);
    this.lorry.group.visible = this.drivenOff < 1;
  }
}

/** A coil of sheet steel, on its side (the evening line's raw stuff). */
function coilMesh(): THREE.Group {
  const g = new THREE.Group();
  const coil = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.7, 24), mat('#c9ced6', 0.3, 0.85));
  coil.rotation.x = Math.PI / 2;
  const core = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.72, 14), mat('#2b3242', 0.5), false);
  core.rotation.x = Math.PI / 2;
  g.add(coil, core);
  return g;
}

/** A rack of steel: bars on shelves, coils on the bottom. */
function rack(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mat('#2f6fb3', 0.5, 0.3);
  for (const [dx, dz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) {
    const post = mesh(new THREE.BoxGeometry(0.12, 2, 0.12), frame);
    post.position.set(dx, 1, dz);
    g.add(post);
  }
  for (const y of [0.3, 1.1, 1.9]) {
    const shelf = mesh(new THREE.BoxGeometry(3, 0.08, 1.3), mat('#e07a2e', 0.6));
    shelf.position.y = y;
    g.add(shelf);
  }
  for (let i = 0; i < 6; i++) {
    const bar = mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8), mat('#9aa3ad', 0.3, 0.85), false);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.22, -0.45 + i * 0.18);
    g.add(bar);
  }
  for (const dx of [-0.7, 0.7]) {
    const coil = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.5, 18), mat('#c9ced6', 0.3, 0.85));
    coil.rotation.x = Math.PI / 2;
    coil.position.set(dx, 0.8, 0);
    g.add(coil);
  }
  g.position.set(x, 0, z);
  return g;
}

// ───────────────────────── Stand-ins ─────────────────────────

/** What a toy on the line looks like by now: the blank, the turned bear, its star, its paint, its box. */
type ToyLook = 'blank' | 'turned' | 'stamped' | 'painted' | 'boxed' | 'steel';

/**
 * The toy the line makes, a teddy bear: a wooden blank from the cart, turned
 * into a bear on the lathe, stamped with a star by the press, painted by the
 * robot, boxed for the lorry. Codex's models where they are made
 * (factory-product-billet, -bear, -box), else stand-ins.
 */
function toyMesh(look: ToyLook = 'blank'): THREE.Group {
  const g = new THREE.Group();
  const wood = '#d9a86c';
  const blank = model('factory-product-billet', { height: 0.55 }) ?? mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 14), mat(wood, 0.7));
  if (!hasModel('factory-product-billet')) blank.position.y = 0.05;
  blank.name = 'blank';
  const bear = model('factory-product-bear', { height: 0.7 }) ?? teddy(wood);
  bear.position.y = -0.3;
  bear.name = 'bear';
  const star = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 5), mat('#ffd23f', 0.4, 0.3));
  star.rotation.x = Math.PI / 2;
  star.position.set(0, 0.0, 0.2);
  star.name = 'star';
  const box = model('factory-product-box', { width: 0.75 }) ?? giftBox();
  box.position.y = -0.3;
  box.name = 'box';
  g.add(blank, bear, star, box);
  dressToy(g, look);
  return g;
}

/** Show a toy as it is after a station (a fresh colour for the paint). */
function dressToy(g: THREE.Group, look: ToyLook) {
  const shown: Record<string, ToyLook[]> = {
    blank: ['blank'],
    bear: ['turned', 'stamped', 'painted', 'steel'],
    star: ['stamped', 'painted'],
    box: ['boxed'],
  };
  for (const c of g.children) c.visible = shown[c.name]?.includes(look) ?? false;
  const bear = g.getObjectByName('bear');
  if (!bear) return;
  const tint = look === 'painted' ? ['#ff5fa8', '#5fc8ff', '#ffd23f', '#7dff6b'][Math.floor(Math.random() * 4)] : look === 'steel' ? '#b9c0c9' : null;
  if (!tint && look !== 'turned') return;
  bear.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const was = m.material as THREE.MeshStandardMaterial;
    // A painted model keeps its painted detail, tinted; a stand-in takes the colour itself.
    if (was.map) {
      const c = was.clone();
      c.color.set(tint ?? '#ffffff');
      c.metalness = look === 'steel' ? 0.6 : was.metalness;
      m.material = c;
    } else m.material = mat(tint ?? '#d9a86c', 0.5, look === 'steel' ? 0.7 : 0);
  });
}

/** A stand-in teddy: body, head, ears, snout, paws. */
function teddy(color: string): THREE.Group {
  const g = new THREE.Group();
  const m = mat(color, 0.6);
  const ball = (r: number, x: number, y: number, z: number) => {
    const b = mesh(new THREE.SphereGeometry(r, 14, 10), m);
    b.position.set(x, y, z);
    g.add(b);
  };
  ball(0.22, 0, 0.28, 0);
  ball(0.17, 0, 0.58, 0);
  ball(0.07, -0.12, 0.72, 0);
  ball(0.07, 0.12, 0.72, 0);
  ball(0.07, 0, 0.55, 0.15);
  for (const x of [-0.2, 0.2]) ball(0.08, x, 0.32, 0.05);
  for (const x of [-0.12, 0.12]) ball(0.09, x, 0.08, 0.06);
  return g;
}

/** A stand-in gift box with a bow. */
function giftBox(): THREE.Group {
  const g = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), mat('#c9a27a', 0.8));
  box.position.y = 0.3;
  const bow = mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 14), mat('#d8483c', 0.4));
  bow.position.y = 0.64;
  g.add(box, bow);
  return g;
}

/** A painted mark on the floor (a stain, dust): soft-edged, over the floor and under everything else. */
function floorDecal(map: THREE.Texture, w: number, d: number, x: number, z: number, turn: number, opacity: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  m.position.set(x, 0.012, z);
  m.rotation.y = turn;
  m.renderOrder = 1;
  m.userData.noAO = true;
  return m;
}

/** A painted frame of yellow and black stripes on the floor. */
function hazard(cx: number, cz: number, w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  // Yellow and black dashes round the frame, each colour one instanced draw.
  const dashes: THREE.Matrix4[][] = [[], []];
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.round(len / 0.6));
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(z1 - z0, x1 - x0));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      dashes[i % 2].push(new THREE.Matrix4().compose(new THREE.Vector3(x0 + (x1 - x0) * t, 0.015, z0 + (z1 - z0) * t), turn, new THREE.Vector3(len / n, 1, 1)));
    }
  };
  const [x0, x1, z0, z1] = [cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2];
  side(x0, z0, x1, z0);
  side(x1, z0, x1, z1);
  side(x1, z1, x0, z1);
  side(x0, z1, x0, z0);
  const geo = new THREE.PlaneGeometry(1, 0.25).rotateX(-Math.PI / 2);
  ['#f2c230', '#2a2f3a'].forEach((color, k) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color }), dashes[k].length);
    dashes[k].forEach((m, i) => im.setMatrixAt(i, m));
    im.renderOrder = 2;
    g.add(im);
  });
  return g;
}

/** Boxes stacked on a pallet. */
function stack(x: number, z: number, n: number): THREE.Group {
  const g = new THREE.Group();
  const pallet = mesh(new THREE.BoxGeometry(1.8, 0.2, 1.8), mat('#b98654', 0.8));
  pallet.position.y = 0.1;
  g.add(pallet);
  for (let i = 0; i < n; i++) {
    const b = mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), mat('#c9a27a', 0.85));
    b.position.y = 0.6 + i * 0.82;
    const tape = mesh(new THREE.BoxGeometry(0.2, 0.82, 1.62), mat('#d8483c', 0.6));
    tape.position.y = b.position.y;
    g.add(b, tape);
  }
  g.position.set(x, 0, z);
  return g;
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
