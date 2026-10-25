// What is on the table: parts, wires and the live circuit result.
import { solveCircuit, type CircuitElement, type CircuitResult } from './circuit/solver';
import { MAP_BOARD, type LightColor, type Part, type PartKind, type Terminal } from './parts/base';
import { createPart } from './parts/catalog';
import type { Stage } from './stage';
import { Wire } from './wires';

export type WorldEvent =
  | { type: 'partAdded'; part: Part }
  | { type: 'partRemoved'; part: Part }
  | { type: 'wireAdded'; wire: Wire }
  | { type: 'wireRemoved'; wire: Wire }
  | { type: 'switch'; part: Part }
  | { type: 'pickup'; part: Part }
  | { type: 'drop'; part: Part }
  | { type: 'wireStart'; terminal: Terminal }
  | { type: 'wireCancel' }
  | { type: 'activated'; part: Part }
  | { type: 'deactivated'; part: Part }
  | { type: 'short'; on: boolean }
  | { type: 'solved' };

export function isActive(p: Part): boolean {
  return activeAt(p.kind, p.state.level);
}

/** Would a part of this kind count as working at this level? */
export function activeAt(kind: PartKind, l: number): boolean {
  switch (kind) {
    case 'bulb':
    case 'duskLamp':
    case 'neon':
      return l > 0.12;
    case 'led':
    case 'garland':
      return l > 0.12;
    case 'fan':
    case 'belt':
    case 'pump':
    case 'gate':
    case 'substation':
    case 'barrier':
    case 'ferris':
    case 'carWash':
    case 'drawbridge':
    case 'towerCrane':
    case 'ladder':
    case 'gearMotor':
    case 'tank':
    case 'paintBooth':
    case 'robotArm':
    case 'packer':
    case 'floorFan':
    case 'pcFan':
    case 'marbleRun':
    case 'waterMill':
    case 'conveyor':
    case 'carousel':
    case 'windmill':
    case 'track':
    case 'helicopter':
    case 'disco':
      return Math.abs(l) > 0.15;
    case 'buzzer':
    case 'musicbox':
    case 'xylophone':
    case 'drum':
    case 'launcher':
    case 'bell':
    case 'heater':
    case 'kettle':
    case 'laser':
    case 'piano':
    case 'tuba':
    case 'maracas':
    case 'bells':
    case 'firetruck':
    case 'trafficLight':
    case 'crane':
    case 'magnet':
      return l > 0.2;
    case 'lift':
      return Math.abs(l) > 0.15;
    default:
      return false;
  }
}

/** The part an element belongs to: element ids are the part id, or `partId#name`. */
export function partIdOf(elementId: string): string {
  const i = elementId.indexOf('#');
  return i < 0 ? elementId : elementId.slice(0, i);
}

export class World {
  readonly parts: Part[] = [];
  readonly wires: Wire[] = [];
  /** Wires not in the circuit that still animate: the one being dragged, and ones fading out. */
  readonly loose = new Set<Wire>();
  result: CircuitResult | null = null;
  private dirty = true;
  private listeners: ((e: WorldEvent) => void)[] = [];
  private active = new Set<Part>();
  private wasShorted = false;

  constructor(readonly stage: Stage) {}

  on(fn: (e: WorldEvent) => void) {
    this.listeners.push(fn);
  }

  emit(e: WorldEvent) {
    for (const fn of this.listeners) fn(e);
  }

  addPart(kind: PartKind, x: number, z: number, opts: { locked?: boolean; closed?: boolean; appear?: boolean; color?: LightColor } = {}): Part {
    const part = createPart(kind, opts.color);
    part.trimShadows();
    part.locked = !!opts.locked;
    part.closed = !!opts.closed;
    part.root.position.set(x, 0, z);
    this.stage.world.add(part.root);
    this.parts.push(part);
    if (opts.appear !== false) part.appear();
    this.dirty = true;
    this.emit({ type: 'partAdded', part });
    return part;
  }

  removePart(part: Part) {
    for (const w of [...this.wires]) if (part.terminals.some((t) => w.touches(t))) this.removeWire(w);
    const i = this.parts.indexOf(part);
    if (i >= 0) this.parts.splice(i, 1);
    this.active.delete(part);
    part.dispose();
    this.dirty = true;
    this.emit({ type: 'partRemoved', part });
  }

  /** Attach a finished wire. Returns false for a duplicate or a loop onto itself. */
  attachWire(wire: Wire, b: Terminal): boolean {
    if (b === wire.a) return false;
    const dup = this.wires.some((w) => (w.a === wire.a && w.b === b) || (w.a === b && w.b === wire.a));
    if (dup) return false;
    wire.attach(b);
    this.loose.delete(wire);
    this.wires.push(wire);
    this.dirty = true;
    this.emit({ type: 'wireAdded', wire });
    return true;
  }

  removeWire(wire: Wire) {
    const i = this.wires.indexOf(wire);
    if (i >= 0) this.wires.splice(i, 1);
    wire.remove();
    this.loose.add(wire);
    this.dirty = true;
    this.emit({ type: 'wireRemoved', wire });
  }

  clear() {
    for (const w of this.loose) w.group.removeFromParent();
    this.loose.clear();
    for (const w of [...this.wires]) {
      this.wires.splice(this.wires.indexOf(w), 1);
      w.group.removeFromParent();
    }
    for (const p of [...this.parts]) {
      this.parts.splice(this.parts.indexOf(p), 1);
      p.dispose();
    }
    this.active.clear();
    this.wasShorted = false;
    this.result = null;
    this.dirty = true;
  }

  markDirty() {
    this.dirty = true;
  }

  terminals(): Terminal[] {
    return this.parts.flatMap((p) => p.terminals);
  }

  wiresAt(t: Terminal): Wire[] {
    return this.wires.filter((w) => w.touches(t));
  }

  /** Are two terminals joined by wires alone (ignoring parts in between)? */
  wired(t1: Terminal, t2: Terminal, without?: Wire): boolean {
    if (t1 === t2) return true;
    const seen = new Set<Terminal>([t1]);
    const stack = [t1];
    while (stack.length) {
      const t = stack.pop()!;
      for (const w of this.wires) {
        if (!w.b || w === without) continue;
        const o = w.a === t ? w.b : w.b === t ? w.a : null;
        if (o && !seen.has(o)) {
          if (o === t2) return true;
          seen.add(o);
          stack.push(o);
        }
      }
    }
    return false;
  }

  elements(extra: { skipWire?: Wire } = {}): CircuitElement[] {
    const els: CircuitElement[] = this.parts.flatMap((p) => p.elements());
    for (const w of this.wires) {
      if (w.b && w !== extra.skipWire) els.push({ id: w.id, kind: 'wire', a: w.a.id, b: w.b.id });
    }
    return els;
  }

  solve() {
    this.dirty = false;
    const r = solveCircuit(this.elements());
    this.result = r;
    for (const p of this.parts) {
      const e = r.elements.get(p.id) ?? { level: 0, current: 0, voltage: 0, reversed: false };
      const shorted = [...r.shorted].some((id) => partIdOf(id) === p.id);
      p.state = { level: e.level, current: e.current, voltage: e.voltage, reversed: e.reversed, shorted };
      p.onSolved(r);
      const now = isActive(p);
      if (now && !this.active.has(p)) {
        this.active.add(p);
        this.emit({ type: 'activated', part: p });
      } else if (!now && this.active.has(p)) {
        this.active.delete(p);
        this.emit({ type: 'deactivated', part: p });
      }
    }
    let vmax = 0;
    for (const v of r.nodeVoltage.values()) vmax = Math.max(vmax, v);
    for (const w of this.wires) {
      w.current = r.elements.get(w.id)?.current ?? 0;
      const up = Math.max(r.nodeVoltage.get(w.a.id) ?? 0, w.b ? (r.nodeVoltage.get(w.b.id) ?? 0) : 0);
      w.potential = vmax > 0 ? Math.min(1, Math.max(0, (vmax - up) / vmax)) : 0;
    }
    const shorted = r.shorted.size > 0;
    if (shorted !== this.wasShorted) {
      this.wasShorted = shorted;
      this.emit({ type: 'short', on: shorted });
    }
    this.emit({ type: 'solved' });
  }

  /** Solve a what-if copy of the circuit, e.g. with every switch closed. */
  trial(change: (e: CircuitElement) => CircuitElement): CircuitResult {
    return solveCircuit(this.elements().map(change));
  }

  /**
   * The newest wire whose removal alone makes `fixed` true — "undo the step
   * that broke it". Wires are kept in the order they were connected.
   */
  latestCulprit(fixed: (r: CircuitResult, without: Wire) => boolean, among: Wire[] = this.wires): Wire | null {
    for (let i = among.length - 1; i >= 0; i--) {
      const w = among[i];
      if (w.b && fixed(solveCircuit(this.elements({ skipWire: w })), w)) return w;
    }
    return null;
  }

  update(dt: number) {
    for (const p of this.parts) {
      if (p.wantsSolve) {
        p.wantsSolve = false;
        this.dirty = true;
      }
    }
    if (this.dirty) this.solve();
    this.updateObstacles();
    for (const p of this.parts) p.update(dt);
    for (const w of [...this.wires]) w.update(dt);
    for (const w of [...this.loose]) {
      w.update(dt);
      if (!w.group.parent) this.loose.delete(w);
    }
  }

  /** Hand wires the bodies to go round; re-route only when something moved. */
  private updateObstacles() {
    const M = 0.2;
    const rects = [];
    const key: string[] = [];
    for (const p of this.parts) {
      const f = p.footprint();
      if (!f) continue;
      const { x, z } = p.root.position;
      rects.push({ x0: x + f.x0 - M, x1: x + f.x1 + M, z0: z + f.z0 - M, z1: z + f.z1 + M });
      key.push(`${x.toFixed(2)},${z.toFixed(2)}`);
    }
    Wire.obstacles = rects;
    Wire.obstacleKey = key.join(';');
  }

  /** Keep a part within reach on the endless table. */
  clamp(part: Part) {
    const p = part.root.position;
    const b = MAP_BOARD.half;
    if (b) {
      p.x = Math.min(b.x - 1, Math.max(-b.x + 1, p.x));
      p.z = Math.min(b.z - 1, Math.max(-b.z + 1, p.z));
    } else {
      const len = Math.hypot(p.x, p.z);
      if (len > 34) p.multiplyScalar(34 / len);
    }
    p.y = 0;
  }

  /** Nudge a dropped part out of its neighbours. */
  separate(part: Part) {
    const p = part.root.position;
    for (let iter = 0; iter < 24; iter++) {
      let moved = false;
      for (const o of this.parts) {
        if (o === part) continue;
        const q = o.root.position;
        const dx = p.x - q.x;
        const dz = p.z - q.z;
        const d = Math.hypot(dx, dz);
        const min = (part.radius + o.radius) * 0.92;
        if (d < min) {
          const push = (min - d) * 0.6 + 0.01;
          const ang = d > 1e-3 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
          p.x += Math.cos(ang) * push;
          p.z += Math.sin(ang) * push;
          moved = true;
        }
      }
      this.clamp(part);
      if (!moved) break;
    }
  }
}
