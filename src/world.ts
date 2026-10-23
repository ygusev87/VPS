// What is on the table: parts, wires and the live circuit result.
import * as THREE from 'three';
import { solveCircuit, type CircuitElement, type CircuitResult } from './circuit/solver';
import type { Part, PartKind, Terminal } from './parts/base';
import { createPart } from './parts/models';
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
  const l = p.state.level;
  switch (p.kind) {
    case 'bulb':
      return l > 0.12;
    case 'led':
      return l > 0.3;
    case 'fan':
      return Math.abs(l) > 0.15;
    case 'buzzer':
      return l > 0.2;
    default:
      return false;
  }
}

export class World {
  readonly parts: Part[] = [];
  readonly wires: Wire[] = [];
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

  addPart(kind: PartKind, x: number, z: number, opts: { locked?: boolean; closed?: boolean; appear?: boolean } = {}): Part {
    const part = createPart(kind);
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
    for (const w of [...this.wires]) if (w.touches(part.terminal('a')) || w.touches(part.terminal('b'))) this.removeWire(w);
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
    this.wires.push(wire);
    this.dirty = true;
    this.emit({ type: 'wireAdded', wire });
    return true;
  }

  removeWire(wire: Wire) {
    const i = this.wires.indexOf(wire);
    if (i >= 0) this.wires.splice(i, 1);
    wire.remove();
    this.dirty = true;
    this.emit({ type: 'wireRemoved', wire });
  }

  clear() {
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
  wired(t1: Terminal, t2: Terminal): boolean {
    if (t1 === t2) return true;
    const seen = new Set<Terminal>([t1]);
    const stack = [t1];
    while (stack.length) {
      const t = stack.pop()!;
      for (const w of this.wires) {
        if (!w.b) continue;
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
    const els: CircuitElement[] = this.parts.map((p) => ({
      id: p.id,
      kind: p.elementKind,
      a: p.terminal('a').id,
      b: p.terminal('b').id,
      closed: p.closed,
    }));
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
      const e = r.elements.get(p.id)!;
      p.state = { level: e.level, current: e.current, reversed: e.reversed, shorted: r.shorted.has(p.id) };
      const now = isActive(p);
      if (now && !this.active.has(p)) {
        this.active.add(p);
        this.emit({ type: 'activated', part: p });
      } else if (!now && this.active.has(p)) {
        this.active.delete(p);
        this.emit({ type: 'deactivated', part: p });
      }
    }
    for (const w of this.wires) w.current = r.elements.get(w.id)?.current ?? 0;
    const shorted = r.shorted.size > 0;
    if (shorted !== this.wasShorted) {
      this.wasShorted = shorted;
      this.emit({ type: 'short', on: shorted });
    }
    this.emit({ type: 'solved' });
  }

  /** Wires whose removal alone would end the short circuit. */
  shortingWires(): Wire[] {
    if (!this.result || this.result.shorted.size === 0) return [];
    return this.wires.filter((w) => w.b && solveCircuit(this.elements({ skipWire: w })).shorted.size === 0);
  }

  update(dt: number) {
    if (this.dirty) this.solve();
    for (const p of this.parts) p.update(dt);
    for (const w of [...this.wires]) w.update(dt);
  }

  /** Keep a part on the mat. */
  clamp(part: Part) {
    const { hx, hz } = this.stage.bounds;
    const p = part.root.position;
    const m = part.radius * 0.75;
    p.x = THREE.MathUtils.clamp(p.x, -hx + m, hx - m);
    p.z = THREE.MathUtils.clamp(p.z, -hz + m * 0.8, hz - m * 0.6);
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
