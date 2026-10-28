// What every map's story is made of (the farm, the city): characters who ask
// for help in turn, a ring on the ground for the part each one wants (a part
// let go near it snaps in), the time of day moving on once everyone of this
// part of the day is helped, a close look at whoever is next, and the story
// kept between visits. A map lays itself out and adds what is its own.
import * as THREE from 'three';
import { isPolar, sandboxHint, type Hint } from './hints';
import { model, type Fit } from './parts/assets';
import { MAP_BOARD, type Part, type PartKind, type Terminal } from './parts/base';
import { mat, mesh } from './parts/kit';
import { kitPieces } from './kit';
import type { Stage } from './stage';
import { bendable, type Pose } from './bend';
import { Life } from './life';
import { createPart } from './parts/catalog';
import { Pest } from './pest';
import { Rig } from './rig';
import { thumb } from './thumbs';
import type { PhraseId } from './voice';
import type { World } from './world';
import { Wire } from './wires';

export type Phase = 'day' | 'evening' | 'night' | 'morning' | 'done';
/** How dark each part of the day is (0 day .. 1 night). */
export const NIGHT: Record<Phase, number> = { day: 0, evening: 0.72, night: 1, morning: 0, done: 0 };

export interface MapHooks {
  /** Say a phrase; with `then`, that one right after it (an animal's own sound, then its words). */
  say(id: PhraseId, then?: PhraseId): void;
  /** An animal's own sound that goes with no words (the fox yelps); nothing until it is recorded. */
  cue?(name: string): void;
  /** Confetti and a cheer at a point on the table. */
  cheer(at: THREE.Vector3): void;
  /** Everyone on the map is happy. */
  done(): void;
  /** A soft sound for a happy character. */
  chime(): void;
  /** Someone was helped (a character's name, or a sticker's). */
  helped?(name: string, at: THREE.Vector3): void;
  /** Something worth seeing is happening here (the camera may glance at it). */
  look?(at: THREE.Vector3): void;
  /** A helped one's reward is happening here (the cat climbs down, the boat sails): show it close up for a moment. */
  result?(points: THREE.Vector3[]): void;
  /** Bring this area into view, close up (the next one to help). */
  focus?(points: THREE.Vector3[], instant?: boolean): void;
  /** A part snapped onto its ring. */
  placed?(at: THREE.Vector3): void;
  /** Sparks where a wire bit back (the crow pecked it). */
  zap?(at: THREE.Vector3): void;
}

export interface Critter {
  name: string;
  group: THREE.Group;
  /** Rests here; bobs and hops around it. */
  home: THREE.Vector3;
  height: number;
  bubble: THREE.Sprite;
  hearts: THREE.Sprite[];
  hop: number;
  /** Height it stands at (a kitten up on the loft or riding a lift, kids on a carousel). */
  base?: number;
  /** Moves by itself (a tractor, a fox): no bobbing on the spot. */
  roams?: boolean;
  /** Never shows a speech bubble (the fox does not ask for help). */
  mute?: boolean;
  mood: 'calm' | 'asking' | 'happy';
  /** The part (or painted picture) in the speech bubble now. */
  bubbleKind?: string;
  /** Which way it faces when it stands still. */
  face?: number;
  /** Tapped again and again: a twirl (1..0), a somersault (1..0). */
  spin?: number;
  flip?: number;
  taps?: number;
  lastTap?: number;
  sweat?: THREE.Sprite[];
  /** A four-legged one's head and tail (it looks at you while it asks): bones, or a bent body. */
  pose?: Pose | null;
  rig?: Rig | null;
  /** Where its head and tail are heading (smoothed). */
  stance?: { graze: number; look: number; wag: number };
}

/** A ring on the ground and the part that goes on it. */
export interface Slot {
  /** Shown in the bubble, and dragged from the drawers by a hint. */
  icon: PartKind;
  /** Parts that belong on the ring (empty: nothing to place, e.g. the farm's gate). */
  kinds: PartKind[];
  /** The phrase of the hint that drags its part over (defaults to "put it on the ring"). */
  hintPhrase?: PhraseId;
  /** Where the part should go (a ring on the ground). */
  spot: THREE.Vector3;
  /**
   * What the part works at, if it works one way (a fan blows, a pump pours):
   * set on its place it turns to face it, so the child sees why it helps.
   */
  toward?: THREE.Vector3;
  ring: THREE.Mesh;
  /** The right part stands on the ring (lights it green). */
  ready: boolean;
}

export interface Need extends Slot {
  critter: Critter;
  day: 1 | 2;
  phase: Phase;
  ask: PhraseId;
  thanks: PhraseId;
  /** More parts on rings of their own: a chain the need is built of (the city's). */
  more: Slot[];
  /** Sticker earned (defaults to the character's name). */
  sticker?: string;
  /**
   * A painted picture of the trouble for the bubble (a piece of the map's kit,
   * e.g. a dark lamp, a box going into a lorry), in place of the part's snapshot.
   */
  picture?: string;
  /**
   * Whose need comes first (a character's name): a line of work waits for the
   * station before it, and its worker calls out once that one is done.
   */
  after?: string;
  /**
   * What the camera shows for this need (with the nearest power): the character
   * and its ring unless set (the farm's dog is far from the fox's button).
   */
  focus?: THREE.Vector3[];
  done: boolean;
  /** Seconds the need has been met in a row. */
  held: number;
  met(): boolean;
}

/** A need as it is described (built with day one unless it says day two). */
export type NeedSpec = Omit<Need, 'ring' | 'done' | 'held' | 'ready' | 'day' | 'more'> & { day?: 1 | 2; more?: Omit<Slot, 'ring' | 'ready'>[] };

/** Every ring of a need: its own first, then the rest of its chain. */
const slots = (n: Need): Slot[] => [n, ...n.more];

/** The story so far, as saved between visits (a map adds its own fields). */
export interface MapProgress {
  /** Which layout the parts were saved on; another one starts the map afresh. */
  layout?: number;
  day?: 1 | 2;
  phase: Phase;
  /** Per need, in the order they are built. */
  done: boolean[];
}

/**
 * Which way a one-way part works, in its own frame: a fan blows along +Z,
 * a pump's spout pours along +X.
 */
const FRONT: Partial<Record<PartKind, 'x' | 'z'>> = { fan: 'z', floorFan: 'z', pcFan: 'z', pump: 'x' };

/** The turn (about +Y) that points a part of this kind at `toward` from `spot` (0 if it does not matter). */
export function yawFor(kind: PartKind, spot: THREE.Vector3, toward?: THREE.Vector3): number {
  const front = FRONT[kind];
  if (!front || !toward) return 0;
  const dx = toward.x - spot.x;
  const dz = toward.z - spot.z;
  // A turn θ sends +Z to (sin θ, cos θ) and +X to (cos θ, −sin θ).
  return front === 'z' ? Math.atan2(dx, dz) : Math.atan2(-dz, dx);
}

/** The plate of a kind of part (its size and centre, part-local), measured once. */
const plates = new Map<PartKind, { w: number; d: number; cx: number; cz: number } | null>();
function plateOf(kind: PartKind) {
  if (!plates.has(kind)) {
    let r: { w: number; d: number; cx: number; cz: number } | null = null;
    try {
      const f = createPart(kind).plateRect();
      r = { w: f.x1 - f.x0, d: f.z1 - f.z0, cx: (f.x0 + f.x1) / 2, cz: (f.z0 + f.z1) / 2 };
    } catch {
      r = null;
    }
    plates.set(kind, r);
  }
  return plates.get(kind)!;
}

/** A flat rounded-rectangle frame, w×d outside, `t` thick (in the XY plane, to lay down). */
function outline(w: number, d: number, t: number): THREE.ShapeGeometry {
  const rect = (hw: number, hd: number, r: number) => {
    const p = new THREE.Path();
    p.moveTo(-hw + r, -hd);
    p.lineTo(hw - r, -hd);
    p.quadraticCurveTo(hw, -hd, hw, -hd + r);
    p.lineTo(hw, hd - r);
    p.quadraticCurveTo(hw, hd, hw - r, hd);
    p.lineTo(-hw + r, hd);
    p.quadraticCurveTo(-hw, hd, -hw, hd - r);
    p.lineTo(-hw, -hd + r);
    p.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    return p;
  };
  const shape = new THREE.Shape(rect(w / 2, d / 2, 0.22).getPoints(6));
  shape.holes.push(rect(w / 2 - t, d / 2 - t, 0.14));
  return new THREE.ShapeGeometry(shape, 6);
}

/** Four-legged characters whose head and tail move (their models face +X). */
const X = new THREE.Vector3(1, 0, 0);
const LOOKERS = new Set(['cow', 'pig', 'sheep', 'goat', 'horse']);

/** How close to a ring a dropped part must be to snap onto it. */
const SNAP_R = 3.2;
/** Map parts that give power (wires to them make sense). */
const SOURCES = new Set<PartKind>(['pole', 'solar', 'windGen']);

export const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export abstract class StoryMap {
  readonly scenery = new THREE.Group();
  protected critters = new Map<string, Critter>();
  protected needs: Need[] = [];
  phase: Phase = 'day';
  day: 1 | 2 = 1;
  protected phaseT = 0;
  protected night = 0;
  protected time = 0;
  /** Parts gliding onto their rings. */
  protected slides: { part: Part; to: THREE.Vector3 }[] = [];
  protected focused: Need | null = null;
  /** A hapless crow after the child's wires (the farm has one). */
  protected pest: Pest | null = null;
  /** The herd wandering about, the toys to poke, butterflies and smoke. */
  protected life!: Life;
  /** Where the last one helped lives. */
  private lastAt: THREE.Vector3 | null = null;
  private toldToLook = false;
  private sprites: THREE.Sprite[] = [];
  /** Left the map (its timers stay quiet). */
  private gone = false;
  /** The child picked whom to help (a tap, a part on a ring): a new view does not undo it. */
  private picked = false;
  /** Story time till the next station along the line calls out (no hints before it does). */
  private calling = 0;
  private nextAt = -1;

  /** Board size, world units, centred on the origin. */
  protected abstract readonly width: number;
  protected abstract readonly depth: number;
  /** How much further than the board's corners the view may roam (to what lies outside it, like the factory's road). */
  protected readonly roam: number = 0;
  /** Bumped whenever the map is laid out anew (a save on another layout is dropped). */
  abstract readonly layout: number;
  /** The map's hints are all there is (no general wiring hints for the rest of the board). */
  readonly ownHints: boolean = false;
  /** Said by "repeat" when nobody waits for help. */
  protected abstract readonly intro: PhraseId;

  constructor(
    protected stage: Stage,
    protected world: World,
    protected hooks: MapHooks,
  ) {}

  /** Lay out the board, the places, the map's parts, the characters and their needs. */
  protected abstract build(): void;
  /** The map's own life each frame (water rising, a fox sneaking up), before the characters move. */
  protected abstract tick(dt: number): void;
  /** After the characters have bobbed: things that move them about (ducklings swimming). */
  protected afterAnimate(_dt: number) {}
  /** Something said, or begun, as a part of the day starts. */
  protected phaseBegins(_p: Phase) {}
  /** What follows when everyone of this part of the day is helped. */
  protected after(p: Phase): { next: Phase; wait: number; first?: () => void } {
    return p === 'day' ? { next: 'evening', wait: 4 } : p === 'evening' ? { next: 'night', wait: 4 } : p === 'night' ? { next: 'morning', wait: 4 } : { next: 'done', wait: 3 };
  }
  /** How dark the map is now (0 day .. 1 night): by the time of day, unless the map lights itself (the factory hall). */
  protected darkness(): number {
    return NIGHT[this.phase];
  }
  /** A need was just met (the tractor sets off). */
  protected helpedNeed(_n: Need) {}
  /** A nudge of the map's own when no ring waits for a part. */
  protected extraHint(_trayLeft: (k: PartKind) => number): Hint | null {
    return null;
  }
  /** A tap on a character that is not one asking for help (the fox): true when handled. */
  protected tapped(_c: Critter): boolean {
    return false;
  }
  /** The map's own state for saving, and picking it up again. */
  protected saveExtra(): object {
    return {};
  }
  protected restoreExtra(_p: MapProgress) {}
  /** Undo what the map changed on the stage. */
  protected cleanup() {}
  /** The model a character is drawn with (or a stand-in). */
  /** What a character says when it is poked again (a moo, an oink), by its kind. */
  /** An animal's own sound before its words when it asks (none for people and machines). */
  protected cryOf(_base: string): PhraseId | null {
    return null;
  }

  /** A character asks: its own sound first if it is an animal, then the words. */
  private askOut(n: Need) {
    const cry = this.cryOf(n.critter.name.replace(/\d+$/, ''));
    if (cry) this.hooks.say(cry, n.ask);
    else this.hooks.say(n.ask);
  }

  /** A happy animal's own sound once it is helped (the kitten purrs), by its kind. */
  protected happyCue(base: string): string | null {
    return base === 'kitten' || base === 'cat' ? 'purr' : null;
  }

  protected voiceOf(_base: string): PhraseId | null {
    return null;
  }

  protected critterModel(base: string, fit: Fit, name: string): THREE.Object3D {
    return model(base, fit) ?? blob(name);
  }

  /** Points along the wires on the board (re-read twice a second): what passers-by keep off. */
  private wirePoints: THREE.Vector3[] = [];
  private wiresAt = -1;

  /** Is there a part or a wire on the ground here (for the townsfolk and the hall's people to walk round)? */
  private underfoot(x: number, z: number): boolean {
    const now = performance.now();
    if (now - this.wiresAt > 500) {
      this.wiresAt = now;
      this.wirePoints = this.world.wires.filter((w) => w.b).flatMap((w) => w.samples(16));
    }
    if (this.wirePoints.some((p) => Math.abs(p.x - x) < 0.5 && Math.abs(p.z - z) < 0.5)) return true;
    return this.world.parts.some((p) => Math.hypot(p.root.position.x - x, p.root.position.z - z) < p.radius * p.root.scale.x * 0.8 + 0.4);
  }

  /** Lay the map out on the table (the world must be empty). */
  start() {
    this.life = new Life(this.scenery, { say: (id) => this.hooks.say(id), chime: () => this.hooks.chime(), blocked: (x, z) => this.underfoot(x, z) });
    this.stage.world.add(this.scenery);
    this.stage.showGrid(false);
    // The view may roam to the map's corners, and parts may stand anywhere on its board.
    this.stage.limit = Math.hypot(this.width / 2, this.depth / 2) + this.roam;
    MAP_BOARD.half = { x: this.width / 2, z: this.depth / 2 };
    this.build();
    // Sprites faded right out (bubbles, hearts, spray, smoke) cost a draw each: they are hidden instead.
    this.scenery.traverse((o) => (o as THREE.Sprite).isSprite && this.sprites.push(o as THREE.Sprite));
    this.setPhase('day');
    this.refocus(true);
  }

  dispose() {
    this.gone = true;
    this.scenery.removeFromParent();
    this.stage.showGrid(true);
    this.stage.limit = 36;
    MAP_BOARD.half = null;
    this.stage.setNightAmount(0);
    this.cleanup();
  }

  /** How far the story got, to carry on next time (the parts and wires are saved with the table). */
  /** What the characters ask, first the ones of the part of day now (for the voice to have ready). */
  phrases(): PhraseId[] {
    const now = this.needs.filter((n) => n.phase === this.phase);
    return [...now, ...this.needs.filter((n) => !now.includes(n))].map((n) => n.ask);
  }

  progress(): MapProgress {
    return { layout: this.layout, day: this.day, phase: this.phase, done: this.needs.map((n) => n.done), ...this.saveExtra() };
  }

  /** Pick the story up where it was left: who has been helped, the time of day. */
  resume(p: MapProgress) {
    this.needs.forEach((n, i) => (n.done = !!p.done[i]));
    this.day = p.day ?? 1;
    this.phase = p.phase;
    this.restoreExtra(p);
    // Parts left standing on their rings stay put, as when they were put there.
    for (const part of this.world.parts) {
      if (part.pinned) continue;
      const s = this.needs.flatMap((n) => slots(n)).find((s) => s.kinds.includes(part.kind) && part.root.position.distanceTo(s.spot) < 1);
      if (s) this.seat(part, s);
    }
    this.phaseT = 0;
    this.night = NIGHT[this.phase];
    this.stage.setNightAmount(this.night);
    this.moods();
    this.refocus(true);
  }

  /** The map's corners, for fitting it on screen. */
  bounds(): THREE.Vector3[] {
    return [v(-this.width / 2 + 1, -this.depth / 2 + 1), v(this.width / 2 - 1, this.depth / 2 - 1)];
  }

  get nightAmount() {
    return this.night;
  }

  /** How many needs are met, of how many. */
  get score(): [number, number] {
    return [this.needs.filter((n) => n.done).length, this.needs.length];
  }

  /** Is this need for the day and the part of the day it is now? */
  protected isNow(n: Need) {
    return n.day === this.day && n.phase === this.phase && (!n.after || !!this.needs.find((m) => m.critter.name === n.after)?.done);
  }

  /** The one to help next (first unmet need of this part of the day). */
  /** Who waits for help now: the nearest one to whoever was helped last (the child picks, this is for "repeat"). */
  protected current(): Need | null {
    const waiting = this.needs.filter((n) => !n.done && this.isNow(n));
    const at = this.lastAt;
    if (!at) return waiting[0] ?? null;
    return waiting.sort((a, b) => a.critter.home.distanceTo(at) - b.critter.home.distanceTo(at))[0] ?? null;
  }

  /** The one the child is helping: picked by a tap (or a part put on its ring), or the only one left now. */
  private helping(): Need | null {
    if (this.focused && !this.focused.done && this.isNow(this.focused)) return this.focused;
    const waiting = this.needs.filter((n) => !n.done && this.isNow(n));
    return waiting.length === 1 ? waiting[0] : null;
  }

  /** The "repeat" button: who needs help now, and a look at them. */
  replay() {
    const n = this.current();
    if (!n) return this.hooks.say(this.intro);
    this.askOut(n);
    this.refocus();
  }

  /** Bring the next one, their ring and the nearest power into view, close up. */
  refocus(instant = false) {
    const n = this.current();
    this.focused = n;
    if (n) this.hooks.focus?.(this.view(n), instant);
  }

  /**
   * A new part of the day begins: who calls for help? The few waiting nearest
   * to where the child was (or to the middle), close enough to tap them on a
   * phone; the rest are a pan away.
   */
  private overview() {
    const at = this.lastAt ?? new THREE.Vector3();
    const waiting = this.needs.filter((n) => !n.done && this.isNow(n)).sort((a, b) => a.critter.home.distanceTo(at) - b.critter.home.distanceTo(at));
    if (waiting.length === 1) return this.refocus();
    if (this.picked && this.helping()) return;
    this.focused = null;
    const pts = waiting.slice(0, 4).map((n) => n.critter.home);
    if (pts.length) this.hooks.focus?.(pts.flatMap((p) => [p.clone().add(v(-3, -3)), p.clone().add(v(3, 3))]));
  }

  /** What to show for a need: its points with room round them, and the nearest power. */
  /** Where a need's reward plays out: the one helped and what was put for them (not the pole). */
  protected resultView(n: Need): THREE.Vector3[] {
    const pts = n.focus ?? [n.critter.group.position, ...slots(n).map((s) => s.spot)];
    return pts.flatMap((p) => [p.clone().add(v(-2, -2.4)), p.clone().add(v(2, 1.6))]);
  }

  private view(n: Need): THREE.Vector3[] {
    const src = this.nearestSource(n.spot);
    const pts = [...(n.focus ?? [n.critter.home, ...slots(n).map((s) => s.spot)]), ...(src ? [src.root.position] : [])];
    return pts.flatMap((p) => [p.clone().add(v(-2, -2.6)), p.clone().add(v(2, 1.8))]);
  }

  protected nearestSource(at: THREE.Vector3): Part | null {
    let best: Part | null = null;
    for (const p of this.world.parts) {
      if (!p.pinned || !SOURCES.has(p.kind)) continue;
      if (!best || p.root.position.distanceTo(at) < best.root.position.distanceTo(at)) best = p;
    }
    return best;
  }

  /**
   * A part was let go: if it is the right kind and near a waiting ring, it
   * glides onto it (so the pump pours into the trough, the fan blows at the cow).
   */
  snap(part: Part): boolean {
    if (part.pinned) return false;
    for (const n of this.needs) {
      if (n.done || !this.isNow(n)) continue;
      for (const s of slots(n)) {
        if (!s.kinds.includes(part.kind) || part.root.position.distanceTo(s.spot) > SNAP_R || this.taken(s, part)) continue;
        this.slides = this.slides.filter((sl) => sl.part !== part);
        this.slides.push({ part, to: s.spot.clone() });
        this.seat(part, s);
        this.focused = n;
        this.picked = true;
        n.critter.hop = 1;
        this.hooks.placed?.(s.spot.clone());
        return true;
      }
    }
    return false;
  }

  /**
   * On a story map parts go only on rings (the workbench is for putting them
   * anywhere): a part let go glides onto the ring nearest it that wants it,
   * however far. False if no ring wants it now — it goes back in the drawer.
   */
  place(part: Part): boolean {
    if (part.pinned || this.snap(part)) return true;
    let best: { n: Need; s: Slot; d: number } | null = null;
    for (const n of this.needs) {
      if (n.done || !this.isNow(n)) continue;
      for (const s of slots(n)) {
        if (!s.kinds.includes(part.kind) || this.taken(s, part)) continue;
        const d = part.root.position.distanceTo(s.spot);
        if (!best || d < best.d) best = { n, s, d };
      }
    }
    if (!best) return false;
    this.slides = this.slides.filter((sl) => sl.part !== part);
    this.slides.push({ part, to: best.s.spot.clone() });
    this.seat(part, best.s);
    part.hop();
    this.focused = best.n;
    this.picked = true;
    best.n.critter.hop = 1;
    this.hooks.placed?.(best.s.spot.clone());
    return true;
  }

  /** A part takes its place: it stays there, turned towards what it works at. */
  private seat(part: Part, s: Slot) {
    part.seated = true;
    part.root.rotation.y = yawFor(part.kind, s.spot, s.toward);
    this.world.markDirty();
  }

  /** The kind of part a finger is carrying now (its rings light up), or null. */
  carrying: PartKind | null = null;

  /** The part stands on a ring that wants its kind. */
  private onAnyRing(p: Part) {
    return this.needs.some((n) => slots(n).some((s) => s.kinds.includes(p.kind) && p.root.position.distanceTo(s.spot) < 1));
  }

  /** Another part of the kind already stands on this ring. */
  private taken(s: Slot, part?: Part) {
    return this.world.parts.some((p) => p !== part && s.kinds.includes(p.kind) && p.root.position.distanceTo(s.spot) < 0.8);
  }

  /**
   * The drawer is out of this kind, but one lies somewhere on the map (put
   * down by the wrong animal, say): it glides over to the ring that wants it.
   * Returns the part, and where it is going (null: no ring wants it now).
   */
  fetch(kind: PartKind): { part: Part; to: THREE.Vector3 | null } | null {
    const at = this.lastAt ?? new THREE.Vector3();
    const lying = this.world.parts
      .filter((p) => p.kind === kind && !p.pinned && !p.seated)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at));
    const part = lying[0];
    if (!part) return null;
    const to = this.spotFor(part);
    if (to) {
      this.slides = this.slides.filter((sl) => sl.part !== part);
      this.slides.push({ part, to });
      this.hooks.placed?.(to.clone());
    }
    return { part, to };
  }

  /** Where a part tapped in the drawer should go: the ring that wants it, if any. */
  spotFor(part: Part): THREE.Vector3 | null {
    const free = (n: Need) => (!n.done && this.isNow(n) ? slots(n).find((s) => s.kinds.includes(part.kind) && !this.taken(s, part)) : undefined);
    const n = (this.focused && free(this.focused) ? this.focused : null) ?? this.needs.find((x) => free(x));
    const s = n ? free(n) : undefined;
    if (!n || !s) return null;
    this.focused = n;
    this.picked = true;
    this.seat(part, s);
    return s.spot.clone();
  }

  /** A general hint, if it is about this need's own parts (not the fox's button while the ducks wait). */
  private about(n: Need, h: Hint | null): Hint | null {
    if (!h) return null;
    const mine = new Set<Part>();
    for (const s of slots(n)) {
      for (const p of this.world.parts) {
        const near = p.root.position.distanceTo(s.spot);
        if ((s.kinds.length ? !p.pinned && s.kinds.includes(p.kind) && near < 1 : p.kind === s.icon && near < 6)) mine.add(p);
      }
      const src = this.nearestSource(s.spot);
      if (src) mine.add(src);
    }
    const parts = h.type === 'connect' ? [h.from.part, h.to.part] : h.type === 'drag' ? [] : [h.type === 'tapWire' ? h.at : h.part];
    return parts.length && parts.every((p) => p && mine.has(p)) ? h : null;
  }

  /** A gadget of this need stands on its ring with no wire yet: from the nearest pole to it. */
  private firstWire(n: Need): Hint | null {
    for (const s of slots(n)) {
      // (A ring with nothing to place is for a part of the map itself, like the farm's gate.)
      const part = this.world.parts.find((p) => (s.kinds.length ? !p.pinned && s.kinds.includes(p.kind) : p.kind === s.icon) && p.root.position.distanceTo(s.spot) < (s.kinds.length ? 0.8 : 6));
      // Switch-like parts go in a loop with something else; the map says which (a switch alone on a pole is a short).
      if (!part || part.elementKind === 'switch' || part.terminals.length < 2 || this.world.wires.some((w) => part.terminals.some((t) => w.touches(t)))) continue;
      const src = this.nearestSource(s.spot);
      if (src) return this.chainHint(src, [part]);
    }
    return null;
  }

  /**
   * The next wire of a loop from a pole through these parts and back to it:
   * from the end reached so far to the next part, and at last back to the pole.
   */
  protected chainHint(src: Part, chain: Part[]): Hint | null {
    const plus = src.terminal('a')!;
    let at = plus;
    for (const p of chain) {
      const a = p.terminal('a')!;
      const b = p.terminal('b')!;
      if (this.world.wired(at, a)) at = b;
      else if (this.world.wired(at, b)) {
        // An LED or a music box the wrong way round: that wire comes off first.
        if (isPolar(p)) {
          const wire = this.world.wiresAt(b).at(-1);
          if (wire) return { type: 'tapWire', wire, at: p, problem: 'reversed', phrase: p.kind === 'led' ? 'reversed' : p.kind === 'musicbox' ? 'musicReversed' : 'buzzerReversed', u: 0.5 };
        }
        at = a;
      } else return { type: 'connect', from: at, to: a, phrase: at === plus ? 'chainStart' : 'chainNext' };
    }
    const back = src.terminal('b')!;
    return this.world.wired(at, back) ? null : { type: 'connect', from: at, to: back, phrase: 'chainBack' };
  }

  /** A wire the map lays itself (a station's own supply, part of the building): fixed, not the child's to take off. */
  protected lay(a: Terminal, b: Terminal) {
    if (this.world.wired(a, b)) return;
    const w = new Wire(a);
    w.fixed = true;
    this.stage.world.add(w.group);
    this.world.attachWire(w, b);
  }

  /** Lay a whole loop from a source through these parts, the way its chain hint would have the child wire it. */
  protected layChain(src: Part, chain: Part[]) {
    for (let i = 0; i < 8; i++) {
      const h = this.chainHint(src, chain);
      if (h?.type !== 'connect') return;
      this.lay(h.from, h.to);
    }
  }

  /** Which parts of the map the child cannot throw away (none; all are pinned or theirs). */
  isMapPart(p: Part) {
    return p.pinned;
  }

  // ───────────────────────── Building ─────────────────────────

  /** A model (or its stand-in) standing on the board. */
  protected add(name: string, fit: Fit, x: number, z: number, fallback: () => THREE.Object3D, rotY = 0) {
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

  /** A part of the map: it cannot be moved or thrown away (a pole, the gate). */
  protected pin(kind: PartKind, p: THREE.Vector3) {
    const part = this.world.addPart(kind, p.x, p.z, { locked: true, appear: false });
    part.pinned = true;
    return part;
  }

  protected critter(name: string, fit: Fit, p: THREE.Vector3, height: number, face = 0): Critter {
    const { x, z } = p;
    const group = new THREE.Group();
    const m = this.critterModel(name.replace(/\d+$/, ''), fit, name);
    const rig = m.userData.rig ? Rig.of(m, m.userData.rig as string) : null;
    const pose = !rig && LOOKERS.has(name.replace(/\d+$/, '')) ? bendable(m) : null;
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
    const c = this.adopt(name, group, height);
    c.face = face;
    c.pose = pose;
    c.rig = rig;
    return c;
  }

  /** Make something on the map a character (the farm's tractor speaks for the gate). */
  protected adopt(name: string, group: THREE.Group, height: number): Critter {
    group.traverse((o) => (o.userData.critter ??= name));
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    bubble.scale.set(1.7, 1.5, 1);
    bubble.position.set(group.position.x, height + 1.1, group.position.z);
    bubble.renderOrder = 12;
    bubble.userData.critter = name;
    this.scenery.add(bubble);
    const hearts: THREE.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false, opacity: 0 }));
      h.scale.setScalar(0.6);
      h.userData.t = 1;
      hearts.push(h);
      this.scenery.add(h);
    }
    const c: Critter = { name, group, home: group.position.clone(), height, bubble, hearts, hop: 0, mood: 'calm' };
    this.critters.set(name, c);
    return c;
  }

  /**
   * The mark where a part goes: the outline of that part's own plate (a ring
   * only for a place with no part to put, like the farm's gate).
   */
  protected ring(spot: THREE.Vector3, kind?: PartKind, toward?: THREE.Vector3): THREE.Mesh {
    const plate = kind ? plateOf(kind) : null;
    const yaw = kind ? yawFor(kind, spot, toward) : 0;
    const geo = plate ? outline(plate.w + 0.3, plate.d + 0.3, 0.12) : new THREE.RingGeometry(1.05, 1.25, 48);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(spot).setY(0.03);
    // The outline turns with the part (in its laid-down frame a turn about Z is one about Y).
    m.rotation.z = yaw;
    if (plate) m.position.add(new THREE.Vector3(plate.cx, 0, plate.cz).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    m.renderOrder = 3;
    this.scenery.add(m);
    return m;
  }

  protected addNeed(n: NeedSpec) {
    const more = (n.more ?? []).map((s) => ({ ...s, ring: this.ring(s.spot, s.kinds[0], s.toward), ready: false }));
    this.needs.push({ day: 1, ...n, more, ring: this.ring(n.spot, n.kinds[0], n.toward), done: false, held: 0, ready: false });
  }

  // ───────────────────────── Story ─────────────────────────

  protected setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.moods();
    this.phaseBegins(p);
    if (p === 'done') this.hooks.done();
    else setTimeout(() => !this.gone && this.overview(), 1200);
  }

  /** Asking while a need of this part of the day waits; happy once one is met. */
  protected moods() {
    for (const c of this.critters.values()) {
      const mine = this.needs.filter((n) => n.critter === c);
      if (!mine.length) continue;
      c.mood = mine.some((n) => this.isNow(n) && !n.done) ? 'asking' : mine.some((n) => n.done) ? 'happy' : 'calm';
      const ask = mine.find((n) => this.isNow(n) && !n.done);
      if (ask) this.picture(c, ask.icon, ask.picture);
    }
  }

  /** The map's painted kit (src/kit.ts) the bubbles' pictures come from. */
  protected readonly kitName: string = '';

  /** Show this part (or the need's painted picture of its trouble, when the kit has it) in the character's speech bubble. */
  private picture(c: Critter, kind: PartKind, painted?: string) {
    const pic = painted && this.kitName ? kitPieces(this.kitName, painted)[0] : undefined;
    const key = pic ? painted! : kind;
    if (c.bubbleKind === key) return;
    c.bubbleKind = key;
    (c.bubble.material as THREE.SpriteMaterial).map = bubbleTexture(kind, pic?.image as HTMLImageElement | HTMLCanvasElement | undefined, key);
    (c.bubble.material as THREE.SpriteMaterial).needsUpdate = true;
  }

  /**
   * Tap on a character: the first time it tells what it needs (or says
   * thanks); poked again it makes its noise and twirls, and the fifth time in
   * a row it turns a somersault. Taps on the herd and the toys go to them.
   */
  /** The crow is shooed before anything else under the finger (she creeps up to wires and parts). */
  grabTap(x: number, y: number): boolean {
    const crow = this.pest?.pickables() ?? [];
    return !!crow.length && !!this.stage.raycast(x, y, crow)[0] && this.pest!.tap();
  }

  tapAt(x: number, y: number): boolean {
    const meshes: THREE.Object3D[] = this.life.pickables();
    this.scenery.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.userData.critter) meshes.push(o);
    });
    // The speech bubble is the character too: a child taps the picture it is asking with.
    for (const c of this.critters.values()) if ((c.bubble.material as THREE.SpriteMaterial).opacity > 0.5) meshes.push(c.bubble);
    const hit = this.stage.raycast(x, y, meshes)[0];
    if (!hit) return false;
    if (hit.object.userData.life) return this.life.tap(hit.object);
    const c = this.critters.get(hit.object.userData.critter as string) ?? this.critters.get((hit.object.userData.critter as string).replace(/\d+$/, ''));
    if (!c) return false;
    c.hop = 1;
    if (this.tapped(c)) return true;
    c.taps = this.time - (c.lastTap ?? -9) < 3 ? (c.taps ?? 0) + 1 : 1;
    c.lastTap = this.time;
    const need = this.needs.find((n) => n.critter === c && this.isNow(n)) ?? [...this.needs].reverse().find((n) => n.critter === c && n.done);
    if (c.taps > 1 || !need) {
      const noise = this.voiceOf(c.name.replace(/\d+$/, ''));
      if (noise) this.hooks.say(noise);
      if (c.taps >= 5) {
        c.flip = 1;
        c.taps = 0;
        this.hooks.cheer(c.group.position.clone().setY(c.height + 0.5));
      } else c.spin = 1;
      return true;
    }
    if (!need.done) {
      this.askOut(need);
      // Tapping a character brings its ring into view too.
      this.focused = need;
      this.picked = true;
      this.hooks.focus?.(this.view(need));
    } else this.hooks.say(need.thanks);
    return true;
  }

  /** The next helpful nudge: bring the part a waiting character asks for. */
  hint(trayLeft: (k: PartKind) => number): Hint | null {
    // The next station along the line has not called yet: no hand before its worker has said why.
    if (this.calling > this.time) return null;
    const drag = (n: Need): Hint | null => {
      for (const s of slots(n)) {
        if (!s.kinds.length) continue;
        const placed = this.world.parts.some((p) => s.kinds.includes(p.kind) && p.root.position.distanceTo(s.spot) < 1);
        if (placed) continue;
        // The pictured part, or another that does as well (a bulb for the eggs when the heater is taken).
        const kind = [s.icon, ...s.kinds].find((k) => trayLeft(k) > 0);
        if (kind) return { type: 'drag', kind, to: s.spot.clone(), phrase: s.hintPhrase ?? 'placeHere' };
        // None left in the drawers: one put down off its ring will do.
        const stray = this.world.parts.find((p) => !p.pinned && s.kinds.includes(p.kind) && !this.onAnyRing(p));
        if (stray) return { type: 'drag', kind: stray.kind, to: s.spot.clone(), phrase: s.hintPhrase ?? 'placeHere', part: stray };
      }
      return null;
    };
    // Only about the one being helped (the child picks whom): its parts, then its wires.
    const first = this.helping();
    if (!first) return null;
    return drag(first) ?? this.extraHint(trayLeft) ?? this.firstWire(first) ?? (this.ownHints ? null : this.about(first, sandboxHint(this.world)));
  }

  update(dt: number) {
    this.time += dt;
    this.phaseT += dt;
    // Daylight: day → dusk in the evening → night → sunrise.
    this.night = THREE.MathUtils.damp(this.night, this.darkness(), 0.6, dt);
    this.stage.setNightAmount(this.night);

    // Parts let go near their ring glide onto it.
    for (const sl of this.slides) {
      const p = sl.part.root.position;
      p.lerp(sl.to, Math.min(1, dt * 9));
      if (p.distanceTo(sl.to) < 0.01) p.copy(sl.to);
    }
    this.slides = this.slides.filter((sl) => sl.part.root.parent && !sl.part.root.position.equals(sl.to));

    this.tick(dt);

    const mine = this.helping();
    for (const n of this.needs) {
      const waiting = !n.done && this.isNow(n);
      // The rings of the one being helped are teal and bold: easy to find on grass or tarmac.
      // While a part is carried, every ring that takes it lights up that way, and the rest step back.
      const lead = this.carrying ? false : n === mine;
      for (const s of slots(n)) {
        const ringMat = s.ring.material as THREE.MeshBasicMaterial;
        if (!waiting) {
          ringMat.opacity = THREE.MathUtils.damp(ringMat.opacity, 0, 6, dt);
          continue;
        }
        // Pulsing while it waits; green and steady once the right part stands on it.
        s.ready = s.kinds.some((k) => this.world.parts.some((p) => p.kind === k && p.root.position.distanceTo(s.spot) < 0.6));
        const wanted = !!this.carrying && !s.ready && s.kinds.includes(this.carrying) && !this.taken(s);
        const bold = lead || wanted;
        // Once its part stands on it the mark flashes green and goes: nothing blinks under a placed part.
        const was = s.ring.userData.readyFor ?? 0;
        s.ring.userData.readyFor = s.ready ? was + dt : 0;
        const fade = s.ready ? Math.max(0, 1 - (was - 0.6) / 0.8) : 1;
        ringMat.color.set(s.ready ? '#4fd27a' : bold ? '#1aa3a1' : '#ffffff');
        ringMat.opacity = s.ready ? 0.9 * Math.min(1, fade) : this.carrying && !wanted ? 0.12 : bold ? 0.8 + Math.sin(this.time * 3) * 0.15 : 0.35 + Math.sin(this.time * 2.5) * 0.15;
        // A plate's outline does not grow and shrink; it only breathes a little while wanted.
        s.ring.scale.setScalar(s.ready || !s.kinds.length ? 1 : 1 + Math.max(0, Math.sin(this.time * 3)) * (wanted ? 0.05 : 0.02));
      }
      if (!waiting) continue;
      // The bubble shows the next part still missing from the chain.
      if (n.more.length) this.picture(n.critter, (slots(n).find((s) => s.kinds.length && !s.ready) ?? n).icon, n.picture);
      n.held = n.met() ? n.held + dt : 0;
      if (n.held > 0.8) {
        n.done = true;
        n.critter.hop = 1;
        this.hooks.say(n.thanks);
        const happy = this.happyCue(n.critter.name.replace(/\d+$/, ''));
        if (happy) this.hooks.cue?.(happy);
        this.hooks.chime();
        const top = n.critter.group.position.clone().setY(n.critter.height);
        this.hooks.cheer(top);
        this.hooks.helped?.(n.sticker ?? n.critter.name, top);
        this.hooks.result?.(this.resultView(n));
        for (const h of n.critter.hearts) h.userData.t = Math.random() * -0.6;
        this.helpedNeed(n);
        this.moods();
        // The camera stays: the child picks whom to help next. The first time, a word on how.
        this.lastAt = n.critter.home.clone();
        if (this.focused === n) {
          this.focused = null;
          this.picked = false;
        }
        // Next along the line: its worker calls once the thanks are said, and the view goes to them.
        const next = this.needs.find((x) => x.after === n.critter.name && !x.done && this.isNow(x));
        if (next) {
          this.calling = this.time + 4.6;
          setTimeout(() => {
            if (this.gone || next.done) return;
            this.focused = next;
            this.picked = true;
            this.askOut(next);
            this.hooks.focus?.(this.view(next));
          }, 4200);
        } else if (!this.toldToLook && this.needs.some((x) => !x.done && this.isNow(x))) {
          this.toldToLook = true;
          setTimeout(() => !this.gone && this.hooks.say('lookAround'), 3600);
        }
      }
    }

    // Move the story on when everyone of this part of the day is helped.
    const left = this.needs.filter((n) => this.isNow(n) && !n.done).length;
    if (this.phase !== 'done' && left === 0 && this.phaseT > 1) {
      const { next, wait, first } = this.after(this.phase);
      this.waitThen(next, wait, first);
    }

    for (const c of this.critters.values()) this.animateCritter(c, dt);
    this.life.update(dt, this.night, this.stage.camera.position);
    this.pest?.update(dt, this.time);
    this.afterAnimate(dt);
    for (const s of this.sprites) s.visible = s.material.opacity > 0.01;
  }

  private waitThen(p: Phase, seconds: number, first?: () => void) {
    if (this.nextAt < 0) this.nextAt = this.time + seconds;
    if (this.time >= this.nextAt) {
      this.nextAt = -1;
      first?.();
      this.setPhase(p);
    }
  }

  /**
   * Asking for help, it turns its head to you and swishes its tail; once
   * happy, it grazes, now and then lifting its head to look at you.
   */
  private pose(c: Critter, dt: number) {
    const s = (c.stance ??= { graze: 0, look: 0, wag: 0 });
    const forward = c.rig?.forward ?? X;
    // The way to the camera, in its own frame: the angle from its nose.
    const to = c.group.worldToLocal(this.stage.camera.position.clone()).setY(0);
    const atYou = Math.atan2(forward.x * to.z - forward.z * to.x, forward.x * to.x + forward.z * to.z);
    const turning = (c.spin ?? 0) > 0 || (c.flip ?? 0) > 0;
    const period = 10 + (Math.abs(c.home.x * 5.1) % 4);
    const down = c.mood !== 'asking' && !turning && (this.time + c.home.z) % period < period * 0.55;
    s.graze = THREE.MathUtils.damp(s.graze, down ? 0.9 + Math.sin(this.time * 6) * 0.08 : 0, 2.5, dt);
    s.look = THREE.MathUtils.damp(s.look, down || turning ? 0 : THREE.MathUtils.clamp(atYou, -0.9, 0.9), 2.5, dt);
    s.wag = THREE.MathUtils.damp(s.wag, c.mood === 'asking' ? 0.8 : Math.max(0, Math.sin(this.time * 0.7 + c.home.x)) ** 3, 3, dt);
    if (c.rig) {
      // A bone turns only so far: the look is its share of the way round to you
      // (a turn about Y takes the nose the other way from the bent body's).
      c.rig.set(s.graze, -s.look / 0.9, Math.sin(this.time * 7) * s.wag);
    } else if (c.pose) {
      c.pose.graze = s.graze;
      c.pose.look = s.look;
      c.pose.wag = s.wag;
      c.pose.update(this.time);
    }
  }

  private animateCritter(c: Critter, dt: number) {
    c.hop = Math.max(0, c.hop - dt * 2.2);
    const bob = c.mood === 'asking' ? Math.max(0, Math.sin(this.time * 4 + c.home.x)) * 0.12 : Math.sin(this.time * 1.5 + c.home.x) * 0.02;
    const hop = Math.sin(c.hop * Math.PI) * 0.6;
    if (!c.roams) {
      // Poked: a twirl on the spot, or a high somersault.
      c.spin = Math.max(0, (c.spin ?? 0) - dt * 1.6);
      c.flip = Math.max(0, (c.flip ?? 0) - dt * 1.1);
      const twirl = c.spin > 0 ? THREE.MathUtils.smootherstep(1 - c.spin, 0, 1) * Math.PI * 2 : 0;
      const sault = c.flip > 0 ? THREE.MathUtils.smootherstep(1 - c.flip, 0, 1) : 0;
      if (c.spin > 0 || c.flip > 0) c.group.rotation.y = (c.face ?? 0) + twirl;
      c.group.rotation.z = sault * Math.PI * 2;
      c.group.position.y = (c.base ?? 0) + Math.max(0, bob + hop) + Math.sin(sault * Math.PI) * 2.2;
      c.group.scale.set(1, 1 + (c.mood === 'asking' ? Math.sin(this.time * 8) * 0.015 : 0), 1);
    }
    if (c.pose || c.rig) this.pose(c, dt);
    // Speech bubble with the part it wants; a heart when happy.
    const mat = c.bubble.material as THREE.SpriteMaterial;
    const show = c.mood === 'asking' && !c.mute ? 1 : 0;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, show, 6, dt);
    const at = c.group.position;
    c.bubble.position.set(at.x, (c.base ?? 0) + c.height + 1.2 + Math.sin(this.time * 2.5 + c.home.z) * 0.08, at.z);
    c.bubble.scale.set(1.7, 1.5, 1).multiplyScalar(1 + Math.max(0, Math.sin(this.time * 4)) * 0.06 * show);
    for (const h of c.hearts) {
      if (h.userData.t >= 1) {
        h.material.opacity = 0;
        continue;
      }
      h.userData.t += dt * 0.6;
      const t = Math.max(0, h.userData.t as number);
      h.position.set(at.x + Math.sin(t * 6 + h.id) * 0.3, (c.base ?? 0) + c.height + 0.4 + t * 1.6, at.z);
      h.material.opacity = h.userData.t > 0 ? Math.sin(t * Math.PI) : 0;
    }
    // A hot animal drips sweat until help comes.
    if (c.sweat) {
      for (const s of c.sweat) {
        s.userData.t = (s.userData.t + dt * 0.8) % 1;
        const t = s.userData.t as number;
        s.position.set(c.home.x + 0.3 + (s.id % 3) * 0.2, c.height - t * 0.8, c.home.z + 0.4);
        s.material.opacity = c.mood === 'asking' && this.phase === 'day' ? Math.sin(t * Math.PI) * 0.9 : 0;
      }
    }
  }
}

// ───────────────────────── Shared helpers ─────────────────────────

/** A stand-in character when its model did not load: a coloured rounded body. */
export function blob(name: string): THREE.Group {
  const colors: Record<string, string> = { cow: '#f4f4f4', pig: '#f5a9b8', hen: '#ffffff', rabbit: '#b9bdc6', dog: '#c98a4b', fox: '#f08a3a', duck: '#ffd23f', sheep: '#f4f4f4', kitten: '#f2a65a', goat: '#ece6da', kid: '#f4efe6', horse: '#9a6a44', puppy: '#d9a46a', goose: '#fafafa', rooster: '#d8483c', chick: '#ffd84a' };
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(colors[name.replace(/\d+$/, '')] ?? '#ffffff', 0.6));
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
/** Needs with nothing to bring from the drawers show a picture of who waits instead. */
const EMOJI: Partial<Record<PartKind, string>> = { gate: '🚜', substation: '🚋' };
/** A speech bubble with a picture of the part a character is asking for. */
function bubbleTexture(kind: PartKind, painted?: HTMLImageElement | HTMLCanvasElement, key: string = kind): THREE.Texture {
  const hit = bubbleCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 226;
  const ctx = c.getContext('2d')!;
  const draw = (img?: HTMLImageElement | HTMLCanvasElement) => {
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
      ctx.fillText(EMOJI[kind] ?? '❓', 128, 100);
    }
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  draw(painted);
  const src = painted || EMOJI[kind] ? '' : thumb(kind, true);
  if (src) {
    const img = new Image();
    img.onload = () => draw(img);
    img.src = src;
  }
  bubbleCache.set(key, tex);
  return tex;
}

/** A plain house of a box and a pyramid roof: the stand-in for a building whose model is not there. */
export function boxHouse(wall: string, roof: string, w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(w, h, d), mat(wall, 0.7));
  body.position.y = h / 2;
  const r = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.6, 4), mat(roof, 0.7));
  r.rotation.y = Math.PI / 4;
  r.position.y = h + h * 0.3;
  g.add(body, r);
  return g;
}

/**
 * Many copies of one sculpted model (a kind of tree, a bush), each turned its
 * own way. They are instanced in patches of the board: a patch costs one draw
 * (and one shadow draw), and patches out of view are not drawn at all — so a
 * close look at one yard does not pay for every tree on the farm.
 */
export function instances(name: string, fit: Fit, items: readonly [number, number, number][]): THREE.Group | null {
  const src = items.length ? model(name, fit) : null;
  if (!src) return null;
  const up = new THREE.Vector3(0, 1, 0);
  return patched(
    src,
    items.map(([x, z, s], i) => new THREE.Matrix4().compose(v(x, z), new THREE.Quaternion().setFromAxisAngle(up, (i * 2.39996) % (Math.PI * 2)), new THREE.Vector3(s, s, s))),
  );
}

/** The same geometry with each triangle wound the other way round. */
function turnedOut(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.clone() : g.toNonIndexed();
  if (!out.index) out.setIndex([...Array(out.attributes.position.count).keys()]);
  const idx = out.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  return out;
}

/** Copies of a fitted model at these placements, instanced patch by patch (see `instances`). */
export function patched(src: THREE.Object3D, places: THREE.Matrix4[]): THREE.Group {
  src.updateMatrixWorld(true);
  const PATCH = 42;
  const patches = new Map<string, THREE.Matrix4[]>();
  const at = new THREE.Vector3();
  for (const m of places) {
    at.setFromMatrixPosition(m);
    const key = `${Math.floor(at.x / PATCH)},${Math.floor(at.z / PATCH)}`;
    patches.set(key, [...(patches.get(key) ?? []), m]);
  }
  const out = new THREE.Group();
  const each = new THREE.Matrix4();
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // A mirrored part (a node scaled -1) would be drawn inside out: an instance's
    // own matrix does not flip the faces the way an object's does.
    const geometry = m.matrixWorld.determinant() < 0 ? turnedOut(m.geometry) : m.geometry;
    for (const members of patches.values()) {
      const im = new THREE.InstancedMesh(geometry, m.material, members.length);
      members.forEach((place, k) => im.setMatrixAt(k, each.multiplyMatrices(place, m.matrixWorld)));
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      out.add(im);
    }
  });
  return out;
}
