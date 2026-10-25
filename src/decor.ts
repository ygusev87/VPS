// A map's dressing, laid out as data (src/farm-decor.ts, src/city-decor.ts):
// buildings, trees, props and fences, each kind of model drawn as one
// instanced batch. The small things that would stand in the way of a task —
// a ring, a pole, an animal, a path something walks — are left out, so the
// dressing can be laid out freely round the tasks.
import * as THREE from 'three';
import { model, type Fit } from './parts/assets';
import { bakeGroup, mat, mesh } from './parts/kit';
import { patched, v } from './storymap';

/** x, z, turn about y (radians), scale on top of the group's fit. */
export type Place = [number, number, number, number];
export interface DecorGroup {
  model: string;
  fit: Fit;
  items: Place[];
}

/**
 * The dressing on the board: `keep` are points to stay clear of, `lines`
 * paths to stay off (as point lists). Groups bigger than 4 (buildings) are
 * placed with room by hand and always stand. Says which models it drew.
 */
export function dressing(groups: DecorGroup[], fenceLines: [number, number][][], keep: THREE.Vector3[], lines: THREE.Vector3[][]) {
  const inTheWay = (x: number, z: number, r: number) =>
    keep.some((k) => Math.hypot(x - k.x, z - k.z) < r) || lines.some((l) => l.some((a, i) => i > 0 && toSegment(x, z, l[i - 1], a) < r));
  const group = new THREE.Group();
  const drawn = new Set<string>();
  for (const g of groups) {
    const size = g.fit.width ?? g.fit.depth ?? (g.fit.height ?? 1) * 0.8;
    const items = size > 4 ? g.items : g.items.filter(([x, z, , s]) => !inTheWay(x, z, 1.6 + (size * s) / 2));
    const batch = placed(g.model, g.fit, items);
    if (!batch) continue;
    // Little things (flowers, tufts) cast no shadow: many copies, hardly any shade, a whole extra pass each.
    if (size < 1.2) batch.traverse((o) => (o.castShadow = false));
    drawn.add(g.model);
    group.add(batch);
  }
  if (fenceLines.length) group.add(fences(fenceLines.map((line) => line.map(([x, z]) => v(x, z)))));
  return { group, drawn, inTheWay };
}

/** How far a point is from a segment (on the ground). */
export function toSegment(x: number, z: number, a: THREE.Vector3, b: THREE.Vector3) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}

/** Copies of a fitted model, each turned and scaled as placed (instanced patch by patch). */
function placed(name: string, fit: Fit, items: Place[]): THREE.Group | null {
  const src = items.length ? model(name, fit) : null;
  if (!src) return null;
  const up = new THREE.Vector3(0, 1, 0);
  return patched(src, items.map(([x, z, yaw, s]) => new THREE.Matrix4().compose(v(x, z), new THREE.Quaternion().setFromAxisAngle(up, yaw), new THREE.Vector3(s, s, s))));
}

function fence(pts: THREE.Vector3[]): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#f6eddd', 0.6);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n);
      const post = mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), wood);
      post.position.set(p.x, 0.4, p.z);
      g.add(post);
    }
    for (const y of [0.35, 0.65]) {
      const rail = mesh(new THREE.BoxGeometry(len, 0.08, 0.06), wood);
      rail.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      rail.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      g.add(rail);
    }
  }
  return g;
}

/**
 * Fences from the sculpted section (a post with two rails reaching
 * to the next post, 2 long) and a lone post to close each run: sections are
 * stretched a little to fit each stretch exactly. Code-built fences without them.
 */
export function fences(lines: THREE.Vector3[][]): THREE.Object3D {
  const section = model('fence', { height: 0.8 });
  const post = model('fence-post', { height: 0.8 });
  if (!section || !post) {
    const built = new THREE.Group();
    for (const line of lines) built.add(fence(line));
    return bakeGroup(built);
  }
  // model() centres the section; its post's axis was 2 short of the rails' far end.
  section.updateMatrixWorld(true);
  const start = new THREE.Box3().setFromObject(section).max.x - 2;
  const up = new THREE.Vector3(0, 1, 0);
  const sections: THREE.Matrix4[] = [];
  const posts: THREE.Matrix4[] = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const len = a.distanceTo(b);
      const n = Math.max(1, Math.round(len / 2));
      const turn = new THREE.Quaternion().setFromAxisAngle(up, -Math.atan2(b.z - a.z, b.x - a.x));
      for (let k = 0; k < n; k++) {
        const p = a.clone().lerp(b, k / n);
        sections.push(new THREE.Matrix4().compose(p, turn, new THREE.Vector3(len / n / 2, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(-start, 0, 0)));
      }
    }
    posts.push(new THREE.Matrix4().makeTranslation(line[line.length - 1].x, 0, line[line.length - 1].z));
  }
  return new THREE.Group().add(patched(section, sections), patched(post, posts));
}

