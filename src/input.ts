// Touch handling. One finger at a time:
//  • press a terminal and drag → stretch a wire to another terminal
//  • press a part and drag → move it (drop on the tray to put it away)
//  • tap a part → switches toggle, everything else wiggles
//  • tap a wire → it comes off
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
  | { kind: 'press-wire'; wire: Wire; x: number; y: number };

const TAP_MOVE = 12;
const TAP_TIME = 450;

export interface InputHooks {
  /** Is this screen point over the tray (where parts get put away)? */
  overTray(x: number, y: number): boolean;
  onTrayHover(on: boolean): void;
  /** Any touch at all, for idle-hint timers and audio unlock. */
  onTouch(): void;
}

export class Input {
  private mode: Mode = { kind: 'idle' };
  private pointerId: number | null = null;
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
  }

  get busy() {
    return this.mode.kind !== 'idle';
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
      const radius = Math.max(30, this.stage.pixelsPerUnit(v) * 0.55);
      if (d < radius && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }

  private down(e: PointerEvent) {
    this.hooks.onTouch();
    if (!this.enabled || this.pointerId !== null) return;
    e.preventDefault();
    const { clientX: x, clientY: y } = e;

    const t = this.terminalAt(x, y);
    if (t) {
      this.capture(e);
      const wire = new Wire(t);
      wire.freeEnd = t.attachPoint();
      this.stage.world.add(wire.group);
      this.mode = { kind: 'wire', wire, from: t, target: null };
      for (const o of this.world.terminals()) o.setHighlight(o === t ? 'target' : 'available');
      this.world.emit({ type: 'wireStart', terminal: t });
      return;
    }

    const objs: THREE.Object3D[] = [...this.world.parts.flatMap((p) => p.pickables), ...this.world.wires.map((w) => w.tube)];
    const hit = this.stage.raycast(x, y, objs)[0];
    if (!hit) return;
    const wire = hit.object.userData.wire as Wire | undefined;
    if (wire) {
      this.capture(e);
      this.mode = { kind: 'press-wire', wire, x, y };
      return;
    }
    const part = hit.object.userData.part as Part | undefined;
    if (part) {
      this.capture(e);
      this.mode = { kind: 'press-part', part, x, y, t: performance.now() };
    }
  }

  /** Start dragging a brand-new part straight from the tray. */
  spawnFromTray(kind: PartKind, e: PointerEvent) {
    this.hooks.onTouch();
    if (!this.enabled || this.pointerId !== null) return;
    this.capture(e);
    const at = this.stage.screenToPlane(e.clientX, e.clientY) ?? new THREE.Vector3();
    const part = this.world.addPart(kind, at.x, at.z);
    part.setDragging(true);
    this.mode = { kind: 'drag-part', part, offset: new THREE.Vector3(0, 0, 0.35), spawned: true };
    this.world.emit({ type: 'pickup', part });
    this.dragTo(part, e.clientX, e.clientY, new THREE.Vector3(0, 0, 0.35));
  }

  private capture(e: PointerEvent) {
    this.pointerId = e.pointerId;
  }

  private move(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    const { clientX: x, clientY: y } = e;
    const m = this.mode;
    switch (m.kind) {
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
          const p = this.stage.screenToPlane(x, y, 0.6);
          if (p) m.wire.freeEnd = p;
        }
        break;
      }
      case 'press-wire':
        if (Math.hypot(x - m.x, y - m.y) > TAP_MOVE) this.mode = { kind: 'idle' };
        break;
    }
  }

  private dragTo(part: Part, x: number, y: number, offset: THREE.Vector3) {
    const p = this.stage.screenToPlane(x, y);
    if (!p) return;
    part.root.position.set(p.x + offset.x, 0, p.z + offset.z);
    // While dragging over the tray the part may leave the mat; clamp on drop.
    if (!this.hooks.overTray(x, y)) this.world.clamp(part);
  }

  private up(e: PointerEvent, cancelled = false) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    const m = this.mode;
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
          m.wire.remove(() => {});
          m.wire.dying = true;
          this.world.emit({ type: 'wireCancel' });
          // Not in world.wires, so animate it out on our own.
          const wire = m.wire;
          const tick = () => {
            wire.update(1 / 60);
            if (wire.group.parent) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
        break;
      }
      case 'press-wire':
        if (!cancelled) this.world.removeWire(m.wire);
        break;
    }
  }
}
