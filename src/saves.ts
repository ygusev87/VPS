// "My inventions": a table saved on the device (parts, their switches and
// aims, the wires and how they were laid) with a little picture of it.
import * as THREE from 'three';
import type { LightColor, Part, PartKind } from './parts/base';
import type { World } from './world';
import { Wire } from './wires';

interface SavedPart {
  kind: PartKind;
  color?: LightColor;
  x: number;
  z: number;
  closed?: boolean;
  aim?: number;
  side?: 0 | 1;
  song?: number;
}

interface SavedWire {
  a: [number, string];
  b: [number, string];
  route?: [number, number][];
}

export interface Invention {
  id: string;
  at: number;
  pic: string;
  parts: SavedPart[];
  wires: SavedWire[];
}

const KEY = 'electro-table:inventions';
/** Pictures are small JPEGs; a dozen tables fit easily in local storage. */
const MAX = 12;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function loadInventions(): Invention[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Invention[]) : [];
  } catch {
    return [];
  }
}

function store(list: Invention[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * The table as data. Pinned map parts are not saved themselves, but with
 * `withMap` the wires to them are: such an end is numbered -1, -2, … in the
 * order the map pinned its parts (the same every time the map is laid out).
 */
export function capture(world: World, pic: string, withMap = false): Invention | null {
  const parts = world.parts.filter((p) => !p.pinned);
  const pins = withMap ? world.parts.filter((p) => p.pinned) : [];
  // On a map a wire between two of its own parts (a pole and the gate, the hall's panel) is kept too.
  if (!parts.length && !(withMap && world.wires.length)) return null;
  const index = (p: Part) => (parts.includes(p) ? parts.indexOf(p) : -1 - pins.indexOf(p));
  const known = (p: Part) => parts.includes(p) || pins.includes(p);
  const extra = (p: Part) => p as unknown as { aim?: number; side?: 0 | 1; song?: number };
  return {
    id: `i${Date.now().toString(36)}`,
    at: Date.now(),
    pic,
    parts: parts.map((p) => {
      const e = extra(p);
      const s: SavedPart = { kind: p.kind, x: r2(p.root.position.x), z: r2(p.root.position.z) };
      if (p.color !== 'warm') s.color = p.color;
      if (p.closed) s.closed = true;
      if (typeof e.aim === 'number' && e.aim) s.aim = e.aim;
      if (e.side) s.side = e.side;
      if (typeof e.song === 'number' && e.song) s.song = e.song;
      return s;
    }),
    wires: world.wires
      .filter((w) => w.b && !w.fixed && known(w.a.part) && known(w.b.part))
      .map((w) => ({
        a: [index(w.a.part), w.a.key] as [number, string],
        b: [index(w.b!.part), w.b!.key] as [number, string],
        ...(w.route.length ? { route: w.route.map((v) => [r2(v.x), r2(v.z)] as [number, number]) } : {}),
      })),
  };
}

/** Save at the front of the list; the oldest falls off past the limit. */
export function saveInvention(inv: Invention): boolean {
  const list = [inv, ...loadInventions()].slice(0, MAX);
  // Storage full: drop old ones until it fits.
  while (list.length && !store(list)) list.pop();
  return list.length > 0;
}

export function deleteInvention(id: string) {
  store(loadInventions().filter((i) => i.id !== id));
}

/** Lay a saved table out on the world (cleared, or holding just a map's pinned parts). */
export function restore(world: World, inv: Pick<Invention, 'parts' | 'wires'>) {
  const pins = world.parts.filter((p) => p.pinned);
  const made = inv.parts.map((s) => {
    const p = world.addPart(s.kind, s.x, s.z, { color: s.color, closed: s.closed, appear: true });
    const e = p as unknown as { aim?: number; side?: 0 | 1; song?: number };
    if (s.aim !== undefined && 'aim' in p) e.aim = s.aim;
    if (s.side !== undefined && 'side' in p) e.side = s.side;
    if (s.song !== undefined && 'song' in p) e.song = s.song;
    return p;
  });
  const part = (i: number) => (i >= 0 ? made[i] : pins[-1 - i]);
  for (const w of inv.wires) {
    const a = part(w.a[0])?.terminal(w.a[1]);
    const b = part(w.b[0])?.terminal(w.b[1]);
    if (!a || !b) continue;
    const wire = new Wire(a);
    if (w.route) wire.route = w.route.map(([x, z]) => new THREE.Vector3(x, 0, z));
    world.stage.world.add(wire.group);
    world.attachWire(wire, b);
  }
}

/**
 * Where play was left: the free-play table and the farm, kept while playing so
 * the next start carries on from there. `null` forgets it.
 */
export function keepPlace<T>(key: 'table' | 'farm' | 'city' | 'factory', data: T | null) {
  try {
    if (data === null) localStorage.removeItem(`electro-table:${key}`);
    else localStorage.setItem(`electro-table:${key}`, JSON.stringify(data));
  } catch {
    // Storage full or blocked: play goes on, only unsaved.
  }
}

export function placeKept<T>(key: 'table' | 'farm' | 'city' | 'factory'): T | null {
  try {
    const raw = localStorage.getItem(`electro-table:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * A small 4:3 JPEG of what is on screen right now, cropped round `area`
 * (CSS pixels, e.g. the parts' outline) or the middle of the view.
 */
export function snapshot(canvas: HTMLCanvasElement, area?: { x0: number; y0: number; x1: number; y1: number }, width = 320): string {
  const c = document.createElement('canvas');
  const h = Math.round((width * 3) / 4);
  c.width = width;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return '';
  const cw = canvas.width;
  const ch = canvas.height;
  const r = canvas.getBoundingClientRect();
  const k = cw / (r.width || cw);
  let cx = cw / 2;
  let cy = ch / 2;
  let sw = Math.min(cw, (ch * 4) / 3);
  if (area) {
    cx = ((area.x0 + area.x1) / 2 - r.left) * k;
    cy = ((area.y0 + area.y1) / 2 - r.top) * k;
    sw = Math.max((area.x1 - area.x0) * k * 1.25, (area.y1 - area.y0) * k * 1.25 * (4 / 3), 240 * k);
  }
  const sh = (sw * 3) / 4;
  g.fillStyle = '#f6eddd';
  g.fillRect(0, 0, width, h);
  g.drawImage(canvas, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, width, h);
  return c.toDataURL('image/jpeg', 0.75);
}
