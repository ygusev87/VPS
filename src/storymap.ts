// What every map's story is made of (the farm, the city): characters who ask
// for help in turn, a ring on the ground for the part each one wants (a part
// let go near it snaps in), the time of day moving on once everyone of this
// part of the day is helped, a close look at whoever is next, and the story
// kept between visits. A map lays itself out and adds what is its own.
import * as THREE from 'three';
import type { Hint } from './hints';
import { model, type Fit } from './parts/assets';
import type { Part, PartKind } from './parts/base';
import { mat, mesh } from './parts/kit';
import type { Stage } from './stage';
import { thumb } from './thumbs';
import type { PhraseId } from './voice';
import type { World } from './world';

export type Phase = 'day' | 'evening' | 'night' | 'morning' | 'done';
/** How dark each part of the day is (0 day .. 1 night). */
export const NIGHT: Record<Phase, number> = { day: 0, evening: 0.72, night: 1, morning: 0, done: 0 };

export interface MapHooks {
  say(id: PhraseId): void;
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
  /** Bring this area into view, close up (the next one to help). */
  focus?(points: THREE.Vector3[], instant?: boolean): void;
  /** A part snapped onto its ring. */
  placed?(at: THREE.Vector3): void;
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
  /** The part pictured in the speech bubble now. */
  bubbleKind?: PartKind;
  sweat?: THREE.Sprite[];
}

export interface Need {
  critter: Critter;
  day: 1 | 2;
  phase: Phase;
  ask: PhraseId;
  thanks: PhraseId;
  /** Shown in the bubble, and dragged from the drawers by a hint. */
  icon: PartKind;
  /** Parts that belong on the ring (empty: nothing to place, e.g. the farm's gate). */
  kinds: PartKind[];
  /** Sticker earned (defaults to the character's name). */
  sticker?: string;
  /** The phrase of the hint that drags its part over (defaults to "put it on the ring"). */
  hintPhrase?: PhraseId;
  /**
   * What the camera shows for this need (with the nearest power): the character
   * and its ring unless set (the farm's dog is far from the fox's button).
   */
  focus?: THREE.Vector3[];
  /** The right part stands on the ring (lights it green). */
  ready: boolean;
  /** Where the part should go (a ring on the ground). */
  spot: THREE.Vector3;
  ring: THREE.Mesh;
  done: boolean;
  /** Seconds the need has been met in a row. */
  held: number;
  met(): boolean;
}

/** A need as it is described (built with day one unless it says day two). */
export type NeedSpec = Omit<Need, 'ring' | 'done' | 'held' | 'ready' | 'day'> & { day?: 1 | 2 };

/** The story so far, as saved between visits (a map adds its own fields). */
export interface MapProgress {
  /** Which layout the parts were saved on; another one starts the map afresh. */
  layout?: number;
  day?: 1 | 2;
  phase: Phase;
  /** Per need, in the order they are built. */
  done: boolean[];
}

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
  private nextAt = -1;

  /** Board size, world units, centred on the origin. */
  protected abstract readonly width: number;
  protected abstract readonly depth: number;
  /** Bumped whenever the map is laid out anew (a save on another layout is dropped). */
  abstract readonly layout: number;
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
  protected critterModel(base: string, fit: Fit, name: string): THREE.Object3D {
    return model(base, fit) ?? blob(name);
  }

  /** Lay the map out on the table (the world must be empty). */
  start() {
    this.stage.world.add(this.scenery);
    this.stage.showGrid(false);
    // The view may roam to the map's corners.
    this.stage.limit = Math.hypot(this.width / 2, this.depth / 2);
    this.build();
    this.setPhase('day');
    this.refocus(true);
  }

  dispose() {
    this.scenery.removeFromParent();
    this.stage.showGrid(true);
    this.stage.limit = 36;
    this.stage.setNightAmount(0);
    this.cleanup();
  }

  /** How far the story got, to carry on next time (the parts and wires are saved with the table). */
  progress(): MapProgress {
    return { layout: this.layout, day: this.day, phase: this.phase, done: this.needs.map((n) => n.done), ...this.saveExtra() };
  }

  /** Pick the story up where it was left: who has been helped, the time of day. */
  resume(p: MapProgress) {
    this.needs.forEach((n, i) => (n.done = !!p.done[i]));
    this.day = p.day ?? 1;
    this.phase = p.phase;
    this.restoreExtra(p);
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
    return n.day === this.day && n.phase === this.phase;
  }

  /** The one to help next (first unmet need of this part of the day). */
  protected current(): Need | null {
    return this.needs.find((n) => !n.done && this.isNow(n)) ?? null;
  }

  /** The "repeat" button: who needs help now, and a look at them. */
  replay() {
    const n = this.current();
    if (!n) return this.hooks.say(this.intro);
    this.hooks.say(n.ask);
    this.refocus();
  }

  /** Bring the next one, their ring and the nearest power into view, close up. */
  refocus(instant = false) {
    const n = this.current();
    this.focused = n;
    if (n) this.hooks.focus?.(this.view(n), instant);
  }

  /** What to show for a need: its points with room round them, and the nearest power. */
  private view(n: Need): THREE.Vector3[] {
    const src = this.nearestSource(n.spot);
    const pts = [...(n.focus ?? [n.critter.home, n.spot]), ...(src ? [src.root.position] : [])];
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
      if (n.done || !this.isNow(n) || !n.kinds.includes(part.kind)) continue;
      if (part.root.position.distanceTo(n.spot) > SNAP_R) continue;
      if (this.world.parts.some((p) => p !== part && n.kinds.includes(p.kind) && p.root.position.distanceTo(n.spot) < 0.8)) continue;
      this.slides = this.slides.filter((s) => s.part !== part);
      this.slides.push({ part, to: n.spot.clone() });
      n.critter.hop = 1;
      this.hooks.placed?.(n.spot.clone());
      return true;
    }
    return false;
  }

  /** Where a part tapped in the drawer should go: the ring that wants it, if any. */
  spotFor(part: Part): THREE.Vector3 | null {
    const free = (n: Need) =>
      !n.done &&
      this.isNow(n) &&
      n.kinds.includes(part.kind) &&
      !this.world.parts.some((p) => p !== part && n.kinds.includes(p.kind) && p.root.position.distanceTo(n.spot) < 0.8);
    const n = (this.focused && free(this.focused) ? this.focused : null) ?? this.needs.find(free);
    return n ? n.spot.clone() : null;
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
    return this.adopt(name, group, height);
  }

  /** Make something on the map a character (the farm's tractor speaks for the gate). */
  protected adopt(name: string, group: THREE.Group, height: number): Critter {
    group.traverse((o) => (o.userData.critter ??= name));
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    bubble.scale.set(1.7, 1.5, 1);
    bubble.position.set(group.position.x, height + 1.1, group.position.z);
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
    const c: Critter = { name, group, home: group.position.clone(), height, bubble, hearts, hop: 0, mood: 'calm' };
    this.critters.set(name, c);
    return c;
  }

  protected ring(spot: THREE.Vector3): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(spot).setY(0.03);
    m.renderOrder = 3;
    this.scenery.add(m);
    return m;
  }

  protected addNeed(n: NeedSpec) {
    this.needs.push({ day: 1, ...n, ring: this.ring(n.spot), done: false, held: 0, ready: false });
  }

  // ───────────────────────── Story ─────────────────────────

  protected setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.moods();
    this.phaseBegins(p);
    if (p === 'done') this.hooks.done();
    else setTimeout(() => this.refocus(), 1200);
  }

  /** Asking while a need of this part of the day waits; happy once one is met. */
  protected moods() {
    for (const c of this.critters.values()) {
      const mine = this.needs.filter((n) => n.critter === c);
      if (!mine.length) continue;
      c.mood = mine.some((n) => this.isNow(n) && !n.done) ? 'asking' : mine.some((n) => n.done) ? 'happy' : 'calm';
      const ask = mine.find((n) => this.isNow(n) && !n.done);
      if (ask && c.bubbleKind !== ask.icon) {
        c.bubbleKind = ask.icon;
        (c.bubble.material as THREE.SpriteMaterial).map = bubbleTexture(ask.icon);
        (c.bubble.material as THREE.SpriteMaterial).needsUpdate = true;
      }
    }
  }

  /** Tap on a character: it tells what it needs (or says thanks). */
  tapAt(x: number, y: number): boolean {
    const meshes: THREE.Object3D[] = [];
    this.scenery.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.userData.critter) meshes.push(o);
    });
    const hit = this.stage.raycast(x, y, meshes)[0];
    if (!hit) return false;
    const c = this.critters.get(hit.object.userData.critter as string) ?? this.critters.get((hit.object.userData.critter as string).replace(/\d+$/, ''));
    if (!c) return false;
    c.hop = 1;
    if (this.tapped(c)) return true;
    const need = this.needs.find((n) => n.critter === c && this.isNow(n)) ?? [...this.needs].reverse().find((n) => n.critter === c && n.done);
    if (need && !need.done) {
      this.hooks.say(need.ask);
      // Tapping a character brings its ring into view too.
      this.focused = need;
      this.hooks.focus?.(this.view(need));
    } else if (need?.done) this.hooks.say(need.thanks);
    return true;
  }

  /** The next helpful nudge: bring the part a waiting character asks for. */
  hint(trayLeft: (k: PartKind) => number): Hint | null {
    const order = [this.focused, ...this.needs].filter((n): n is Need => !!n);
    for (const n of order) {
      if (n.done || !this.isNow(n) || !n.kinds.length) continue;
      const placed = this.world.parts.some((p) => n.kinds.includes(p.kind) && p.root.position.distanceTo(n.spot) < 1);
      if (!placed && trayLeft(n.icon) > 0) return { type: 'drag', kind: n.icon, to: n.spot.clone(), phrase: n.hintPhrase ?? 'placeHere' };
    }
    return this.extraHint(trayLeft);
  }

  update(dt: number) {
    this.time += dt;
    this.phaseT += dt;
    // Daylight: day → dusk in the evening → night → sunrise.
    this.night = THREE.MathUtils.damp(this.night, NIGHT[this.phase], 0.6, dt);
    this.stage.setNightAmount(this.night);

    // Parts let go near their ring glide onto it.
    for (const sl of this.slides) {
      const p = sl.part.root.position;
      p.lerp(sl.to, Math.min(1, dt * 9));
      if (p.distanceTo(sl.to) < 0.01) p.copy(sl.to);
    }
    this.slides = this.slides.filter((sl) => sl.part.root.parent && !sl.part.root.position.equals(sl.to));

    this.tick(dt);

    for (const n of this.needs) {
      const ringMat = n.ring.material as THREE.MeshBasicMaterial;
      if (n.done || !this.isNow(n)) {
        ringMat.opacity = THREE.MathUtils.damp(ringMat.opacity, 0, 6, dt);
        continue;
      }
      // White and pulsing while it waits; green and steady once the right part stands on it.
      n.ready = n.kinds.some((k) => this.world.parts.some((p) => p.kind === k && p.root.position.distanceTo(n.spot) < 0.6));
      ringMat.color.set(n.ready ? '#4fd27a' : '#ffffff');
      ringMat.opacity = n.ready ? 0.9 : 0.35 + Math.sin(this.time * 3) * 0.2;
      n.ring.scale.setScalar(n.ready ? 1 : 1 + Math.sin(this.time * 3) * 0.05);
      n.held = n.met() ? n.held + dt : 0;
      if (n.held > 0.8) {
        n.done = true;
        n.critter.hop = 1;
        this.hooks.say(n.thanks);
        this.hooks.chime();
        const top = n.critter.group.position.clone().setY(n.critter.height);
        this.hooks.cheer(top);
        this.hooks.helped?.(n.sticker ?? n.critter.name, top);
        for (const h of n.critter.hearts) h.userData.t = Math.random() * -0.6;
        this.helpedNeed(n);
        this.moods();
        // On to the next one of this part of the day.
        setTimeout(() => this.refocus(), 3200);
      }
    }

    // Move the story on when everyone of this part of the day is helped.
    const left = this.needs.filter((n) => this.isNow(n) && !n.done).length;
    if (this.phase !== 'done' && left === 0 && this.phaseT > 1) {
      const { next, wait, first } = this.after(this.phase);
      this.waitThen(next, wait, first);
    }

    for (const c of this.critters.values()) this.animateCritter(c, dt);
    this.afterAnimate(dt);
  }

  private waitThen(p: Phase, seconds: number, first?: () => void) {
    if (this.nextAt < 0) this.nextAt = this.time + seconds;
    if (this.time >= this.nextAt) {
      this.nextAt = -1;
      first?.();
      this.setPhase(p);
    }
  }

  private animateCritter(c: Critter, dt: number) {
    c.hop = Math.max(0, c.hop - dt * 2.2);
    const bob = c.mood === 'asking' ? Math.max(0, Math.sin(this.time * 4 + c.home.x)) * 0.12 : Math.sin(this.time * 1.5 + c.home.x) * 0.02;
    const hop = Math.sin(c.hop * Math.PI) * 0.6;
    if (!c.roams) {
      c.group.position.y = (c.base ?? 0) + Math.max(0, bob + hop);
      c.group.scale.set(1, 1 + (c.mood === 'asking' ? Math.sin(this.time * 8) * 0.015 : 0), 1);
    }
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
      ctx.fillText(EMOJI[kind] ?? '❓', 128, 100);
    }
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  draw();
  const src = EMOJI[kind] ? '' : thumb(kind, true);
  if (src) {
    const img = new Image();
    img.onload = () => draw(img);
    img.src = src;
  }
  bubbleCache.set(kind, tex);
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
    for (const members of patches.values()) {
      const im = new THREE.InstancedMesh(m.geometry, m.material, members.length);
      members.forEach((place, k) => im.setMatrixAt(k, each.multiplyMatrices(place, m.matrixWorld)));
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      out.add(im);
    }
  });
  return out;
}
