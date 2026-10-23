// Touch handling:
//  • press a terminal and drag → stretch a wire to another terminal
//  • press a part and drag → move it (drop on the parts panel to put it away)
//  • tap a part → switches toggle, everything else wiggles
//  • tap a wire → it comes off
//  • drag empty table → pan; two fingers → pinch-zoom; mouse wheel → zoom
import * as THREE from 'three';
import type { Part, PartKind, Terminal } from './parts/base';
import type { Stage } from './stage';
import { Wire } from './wires';
import type { World } from './world';

type Mode =
  | { kind: 'idle' }
  | { kind: 'press-part'; part: Part; x: number; y: number; t: number }
  | { kind: 'drag-part'; part: Part; offset: THREE.Vector3; spawned: boolean }
  | { kind: 'wire'; wire: Wire; from: Terminal; target: Terminal | null }
  | { kind: 'press-wire'; wire: Wire; x: number; y: number }
  | { kind: 'pan'; anchor: THREE.Vector3 }
  | { kind: 'pinch'; d0: number; dist0: number; anchor: THREE.Vector3 };

const TAP_MOVE = 10;
const TAP_TIME = 450;

export interface InputHooks {
  /** Is this screen point over the parts panel (where parts get put away)? */
  overTray(x: number, y: number): boolean;
  onTrayHover(on: boolean): void;
  /** Any touch at all, for idle-hint timers and audio unlock. */
  onTouch(): void;
  /** The child moved the view by hand. */
  onViewMoved?(): void;
}

export class Input {
  private mode: Mode = { kind: 'idle' };
  private pointerId: number | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  enabled = true;

  constructor(
    private stage: Stage,
    private world: World,
    private hooks: InputHooks,
  ) {
    const c = stage.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.stage.zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY);
        this.hooks.onViewMoved?.();
      },
      { passive: false },
    );
  }

  /** Part currently carried by a finger, if any. */
  get carried(): Part | null {
    return this.mode.kind === 'drag-part' ? this.mode.part : null;
  }

  get busy() {
    return this.mode.kind !== 'idle' && this.mode.kind !== 'pan' && this.mode.kind !== 'pinch';
  }

  /** Nearest terminal to a screen point, within a finger-sized radius. */
  terminalAt(x: number, y: number, exclude?: Terminal): Terminal | null {
    let best: Terminal | null = null;
    let bestD = Infinity;
    const v = new THREE.Vector3();
    for (const t of this.world.terminals()) {
      if (t === exclude) continue;
      t.attachPoint(v);
      const p = this.stage.project(v);
      const d = Math.hypot(p.x - x, p.y - y);
      const radius = Math.max(24, this.stage.pixelsPerUnit(v) * 0.42);
      if (d < radius && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }

  private down(e: PointerEvent) {
    this.hooks.onTouch();
    if (!this.enabled) return;
    e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // A second finger turns a pan (or a not-yet-moved press) into a pinch.
    if (this.pointers.size === 2 && (this.mode.kind === 'pan' || this.mode.kind === 'idle' || this.mode.kind === 'press-part' || this.mode.kind === 'press-wire')) {
      this.startPinch();
      return;
    }
    if (this.pointerId !== null || this.pointers.size > 1) return;
    const { clientX: x, clientY: y } = e;
    this.pointerId = e.pointerId;

    const t = this.terminalAt(x, y);
    if (t) {
      const wire = new Wire(t);
      wire.freeEnd = t.attachPoint();
      this.stage.world.add(wire.group);
      this.world.loose.add(wire);
      this.mode = { kind: 'wire', wire, from: t, target: null };
      for (const o of this.world.terminals()) o.setHighlight(o === t ? 'target' : 'available');
      this.world.emit({ type: 'wireStart', terminal: t });
      return;
    }

    const objs: THREE.Object3D[] = [...this.world.parts.flatMap((p) => p.pickables), ...this.world.wires.map((w) => w.tube)];
    const hit = this.stage.raycast(x, y, objs)[0];
    const wire = hit?.object.userData.wire as Wire | undefined;
    const part = hit?.object.userData.part as Part | undefined;
    if (wire) this.mode = { kind: 'press-wire', wire, x, y };
    else if (part) this.mode = { kind: 'press-part', part, x, y, t: performance.now() };
    else {
      const anchor = this.stage.screenToPlane(x, y);
      if (anchor) this.mode = { kind: 'pan', anchor };
    }
  }

  private startPinch() {
    const [a, b] = [...this.pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const anchor = this.stage.screenToPlane(mid.x, mid.y);
    if (!anchor) return;
    this.mode = { kind: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), dist0: this.stage.distance, anchor };
    this.pointerId = null;
  }

  /** Start dragging a brand-new part straight from the parts panel. */
  spawnFromTray(kind: PartKind, e: PointerEvent) {
    this.hooks.onTouch();
    if (!this.enabled || this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const at = this.stage.screenToPlane(e.clientX, e.clientY) ?? new THREE.Vector3();
    const part = this.world.addPart(kind, at.x, at.z);
    part.setDragging(true);
    const offset = new THREE.Vector3(0, 0, 0.3);
    this.mode = { kind: 'drag-part', part, offset, spawned: true };
    this.world.emit({ type: 'pickup', part });
    this.dragTo(part, e.clientX, e.clientY, offset);
  }

  private move(e: PointerEvent) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = this.mode;
    if (m.kind === 'pinch') {
      if (this.pointers.size < 2) return;
      const [a, b] = [...this.pointers.values()];
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      this.stage.setDistance((m.dist0 * m.d0) / d);
      this.stage.panTo(m.anchor, (a.x + b.x) / 2, (a.y + b.y) / 2);
      this.hooks.onViewMoved?.();
      return;
    }
    if (e.pointerId !== this.pointerId) return;
    const { clientX: x, clientY: y } = e;
    switch (m.kind) {
      case 'pan':
        this.stage.panTo(m.anchor, x, y);
        this.hooks.onViewMoved?.();
        break;
      case 'press-part': {
        if (Math.hypot(x - m.x, y - m.y) > TAP_MOVE) {
          const at = this.stage.screenToPlane(m.x, m.y) ?? new THREE.Vector3();
          const offset = m.part.root.position.clone().sub(at).setY(0);
          m.part.setDragging(true);
          this.mode = { kind: 'drag-part', part: m.part, offset, spawned: false };
          this.world.emit({ type: 'pickup', part: m.part });
          this.dragTo(m.part, x, y, offset);
        }
        break;
      }
      case 'drag-part':
        this.dragTo(m.part, x, y, m.offset);
        this.hooks.onTrayHover(!m.part.locked && this.hooks.overTray(x, y));
        break;
      case 'wire': {
        const target = this.terminalAt(x, y, m.from);
        if (target !== m.target) {
          m.target?.setHighlight('available');
          target?.setHighlight('target');
          m.target = target;
        }
        if (target) m.wire.freeEnd = target.attachPoint();
        else {
          const p = this.stage.screenToPlane(x, y, 0.5);
          if (p) m.wire.freeEnd = p;
        }
        break;
      }
      case 'press-wire':
        if (Math.hypot(x - m.x, y - m.y) > TAP_MOVE) {
          // Treat it as a pan that started on top of a wire.
          const anchor = this.stage.screenToPlane(m.x, m.y);
          this.mode = anchor ? { kind: 'pan', anchor } : { kind: 'idle' };
        }
        break;
    }
  }

  private dragTo(part: Part, x: number, y: number, offset: THREE.Vector3) {
    const p = this.stage.screenToPlane(x, y);
    if (!p) return;
    part.root.position.set(p.x + offset.x, 0, p.z + offset.z);
    this.world.clamp(part);
  }

  private up(e: PointerEvent, cancelled = false) {
    this.pointers.delete(e.pointerId);
    const m = this.mode;
    if (m.kind === 'pinch') {
      if (this.pointers.size < 2) {
        // Carry on panning with the finger that stayed down.
        const [rest] = [...this.pointers.entries()];
        if (rest) {
          const anchor = this.stage.screenToPlane(rest[1].x, rest[1].y);
          this.pointerId = rest[0];
          this.mode = anchor ? { kind: 'pan', anchor } : { kind: 'idle' };
        } else {
          this.mode = { kind: 'idle' };
          this.pointerId = null;
        }
      }
      return;
    }
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.mode = { kind: 'idle' };
    const { clientX: x, clientY: y } = e;
    switch (m.kind) {
      case 'press-part':
        if (!cancelled && performance.now() - m.t < TAP_TIME) {
          if (m.part.tap()) {
            this.world.markDirty();
            this.world.emit({ type: 'switch', part: m.part });
          }
        }
        break;
      case 'drag-part': {
        m.part.setDragging(false);
        this.hooks.onTrayHover(false);
        if (!m.part.locked && this.hooks.overTray(x, y)) {
          this.world.removePart(m.part);
        } else {
          this.world.clamp(m.part);
          this.world.separate(m.part);
          this.world.emit({ type: 'drop', part: m.part });
        }
        break;
      }
      case 'wire': {
        for (const t of this.world.terminals()) t.setHighlight('none');
        const target = cancelled ? null : m.target;
        if (target && this.world.attachWire(m.wire, target)) {
          target.snap();
          m.from.snap();
        } else {
          // Still in world.loose, which animates it out.
          m.wire.remove();
          this.world.emit({ type: 'wireCancel' });
        }
        break;
      }
      case 'press-wire':
        if (!cancelled) this.world.removeWire(m.wire);
        break;
    }
  }
}
