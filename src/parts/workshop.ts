// The real factory's own parts (the owner's ask: harder, new mechanics, not
// the same wiring again). The wiring box: an open cabinet with a grid of
// tiles, each with a piece of copper on it; a tap turns a tile, and the box
// lets the current through only when the pieces join from its left post to
// its right one (src/parts/tiles.ts).
import * as THREE from 'three';
import type { ElementKind } from '../circuit/solver';
import { Part, type PartKind } from './base';
import { basePlate, damp, mat, mesh, PLATE_TOP } from './kit';
import { flow, hintTile, makePuzzle, opens, turn, type Side, type TileGrid } from './tiles';

const TILE = 1;

export class WireBox extends Part {
  readonly kind: PartKind = 'wireBox';
  readonly elementKind: ElementKind = 'switch';
  readonly radius: number;
  grid: TileGrid;
  private tiles: THREE.Group[] = [];
  private strips: THREE.MeshStandardMaterial[] = [];
  private shown: number[] = [];
  private lamp: THREE.MeshStandardMaterial;

  constructor(size = 2, grid?: TileGrid) {
    super();
    this.grid = grid ?? makePuzzle(size, size);
    const { w, h } = this.grid;
    const half = { x: (w * TILE) / 2, z: (h * TILE) / 2 };
    this.radius = Math.max(half.x, half.z) + 0.9;
    const plate = basePlate(w * TILE + 1.6, h * TILE + 0.9);
    // The cabinet: a grey steel tray round the tiles, its door swung open to the north.
    const steel = mat('#8d97a3', 0.45, 0.6);
    const tray = mesh(new THREE.BoxGeometry(w * TILE + 0.24, 0.16, h * TILE + 0.24), steel);
    tray.position.y = PLATE_TOP + 0.08;
    const door = mesh(new THREE.BoxGeometry(w * TILE + 0.24, 0.6, 0.06), steel);
    door.position.set(0, PLATE_TOP + 0.3, -half.z - 0.2);
    const stripe = mesh(new THREE.BoxGeometry(w * TILE * 0.7, 0.12, 0.02), mat('#f5c33b', 0.5));
    stripe.position.set(0, PLATE_TOP + 0.42, -half.z - 0.16);
    // A lamp on the door lights when the way is open.
    this.lamp = new THREE.MeshStandardMaterial({ color: '#3a4250', emissive: '#7dff6b', emissiveIntensity: 0, roughness: 0.3 });
    const lamp = mesh(new THREE.SphereGeometry(0.1, 14, 10), this.lamp, false);
    lamp.position.set(half.x * 0.7, PLATE_TOP + 0.5, -half.z - 0.14);
    this.body.add(plate, tray, door, stripe, lamp);
    this.grid.tiles.forEach((t, i) => {
      const g = this.tileMesh(t.shape === 'blank' ? [] : ([0, 1, 2, 3] as Side[]).filter((s) => opens({ shape: t.shape, turns: 0 }, s)));
      g.position.copy(this.cellAt(i));
      g.rotation.y = -t.turns * (Math.PI / 2);
      this.shown.push(t.turns);
      this.tiles.push(g);
      this.body.add(g);
    });
    // The posts at the way's two ends, just outside the tray.
    const inRow = Math.floor(this.grid.in.cell / w);
    const outRow = Math.floor(this.grid.out.cell / w);
    this.addTerminal('a', 'none', -half.x - 0.5, -half.z + (inRow + 0.5) * TILE);
    this.addTerminal('b', 'none', half.x + 0.5, -half.z + (outRow + 0.5) * TILE);
    this.pickable(plate, tray, door, ...this.tiles);
    this.closed = flow(this.grid).done;
  }

  /** A tile's centre, part-local. */
  cellAt(i: number): THREE.Vector3 {
    const { w, h } = this.grid;
    return new THREE.Vector3(((i % w) + 0.5) * TILE - (w * TILE) / 2, PLATE_TOP + 0.17, (Math.floor(i / w) + 0.5) * TILE - (h * TILE) / 2);
  }

  /** The tile under a point (world), or −1. */
  cellOf(point: THREE.Vector3): number {
    const p = this.root.worldToLocal(point.clone());
    const { w, h } = this.grid;
    const x = Math.floor((p.x + (w * TILE) / 2) / TILE);
    const z = Math.floor((p.z + (h * TILE) / 2) / TILE);
    return x < 0 || z < 0 || x >= w || z >= h ? -1 : z * w + x;
  }

  /** Where to point for the next tile to turn (part-local), or null when the way is open. */
  hintPoint(): THREE.Vector3 | null {
    const i = hintTile(this.grid);
    return i === null ? null : this.cellAt(i);
  }

  private tileMesh(sides: Side[]): THREE.Group {
    const g = new THREE.Group();
    const slab = mesh(new THREE.BoxGeometry(TILE - 0.06, 0.06, TILE - 0.06), mat('#2b3242', 0.7));
    const copper = new THREE.MeshStandardMaterial({ color: '#c7743e', roughness: 0.3, metalness: 0.75, emissive: '#ffb347', emissiveIntensity: 0 });
    this.strips.push(copper);
    g.add(slab);
    for (const s of sides) {
      const strip = mesh(new THREE.BoxGeometry(0.14, 0.05, TILE / 2), copper, false);
      // Drawn running north from the centre, then turned to its side.
      strip.position.set(0, 0.05, -TILE / 4);
      const arm = new THREE.Group();
      arm.add(strip);
      arm.rotation.y = -s * (Math.PI / 2);
      g.add(arm);
    }
    if (sides.length) {
      const hub = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14), copper, false);
      hub.position.y = 0.05;
      g.add(hub);
    }
    return g;
  }

  controlAt(_hit: THREE.Object3D | null, point: THREE.Vector3 | null): boolean {
    return !!point && this.cellOf(point) >= 0;
  }

  tap(_hit?: THREE.Object3D | null, point?: THREE.Vector3 | null): boolean {
    super.tap();
    const i = point ? this.cellOf(point) : -1;
    if (i < 0) return false;
    this.grid = turn(this.grid, i);
    const was = this.closed;
    this.closed = flow(this.grid).done;
    this.sounds.push({ kind: 'tick' });
    if (this.closed && !was) this.sounds.push({ kind: 'ding' });
    return true;
  }

  protected animate(dt: number) {
    const { lit } = flow(this.grid);
    const live = Math.abs(this.state.current) > 0.01;
    this.grid.tiles.forEach((t, i) => {
      // Turn smoothly the shortest way round to the tile's new quarter.
      const target = -t.turns * (Math.PI / 2);
      let cur = this.tiles[i].rotation.y;
      while (target - cur > Math.PI) cur += Math.PI * 2;
      while (cur - target > Math.PI) cur -= Math.PI * 2;
      this.tiles[i].rotation.y = damp(cur, target, 14, dt);
      // The joined pieces shine; with current through them they glow.
      this.strips[i].emissiveIntensity = damp(this.strips[i].emissiveIntensity, lit[i] ? (live ? 1.6 + Math.sin(this.time * 6 + i) * 0.3 : 0.35) : 0, 8, dt);
    });
    this.lamp.emissiveIntensity = damp(this.lamp.emissiveIntensity, this.closed ? 2.5 : 0, 8, dt);
  }
}
