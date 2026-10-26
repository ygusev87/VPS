// Ready painted pieces of a map (Codex's kits in public/textures/kit/<map>/),
// laid as they are, not imitated in a shader: seamless grass under everything,
// path ribbons with a painted strip along each lane and round patches over the
// joints, single pictures over their rectangles (a field, a bed, a yard) and
// painted cards standing in rows (wheat, trees). Static, so each kind is one
// merged or instanced draw. Brief: assets-src/design-pass/kit/FARM-KIT.md.
import * as THREE from 'three';

/** Where the camera looks from (see VIEW_DIR in stage.ts): cards face it, so their pictures show undistorted. */
const VIEW = new THREE.Vector3(0, 1, 0.78).normalize();

const images = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  return new Promise((done) => {
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = url;
  });
}

/**
 * Loads a map's kit: the pictures its kit.json lists (names without .webp,
 * variants as `name-a`, `name-b`…). No kit.json, no kit: the map keeps its
 * old look.
 */
export async function loadKit(map: string) {
  const base = `${import.meta.env.BASE_URL}textures/kit/${map}/`;
  let files: string[] = [];
  try {
    const res = await fetch(`${base}kit.json`);
    if (res.ok) files = (await res.json()) as string[];
  } catch {
    // No kit for this map.
  }
  await Promise.all(
    files.map(async (file) => {
      const key = `${map}/${file}`;
      if (images.has(key)) return;
      const img = await loadImage(`${base}${file}.webp`);
      if (img) images.set(key, img);
    }),
  );
}

function texture(img: HTMLImageElement, repeat: boolean): THREE.Texture {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** All loaded variants of a piece (a, b, c… or the plain name), as textures. */
export function kitPieces(map: string, name: string, repeat = false): THREE.Texture[] {
  const found = [name, ...'abcd'.split('').map((v) => `${name}-${v}`)].map((f) => images.get(`${map}/${f}`)).filter((i): i is HTMLImageElement => !!i);
  return found.map((img) => texture(img, repeat));
}

export function hasKit(map: string, name: string) {
  return kitPieces(map, name).length > 0;
}

type Rect = { x0: number; z0: number; x1: number; z1: number };

/**
 * How much colour the ground pieces give up before the game's grading makes
 * saturated colours richer still (FinishShader's vibrance): painted to look
 * right on their own, they would come out loud on the map.
 */
const MUTE = Number(new URLSearchParams(location.search).get('mute') ?? 0.15);
const MUTED = `vec3 kCol = diffuseColor.rgb; diffuseColor.rgb = mix(vec3(dot(kCol, vec3(0.2126, 0.7152, 0.0722))), kCol, ${(1 - MUTE).toFixed(3)});`;

function muted(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n${MUTED}`);
  };
  mat.customProgramCacheKey = () => 'kit-muted';
  return mat;
}

/** A painted material laid flat over the ground: alpha-blended, never writing depth, above the board by `lift`. */
function flatMaterial(map: THREE.Texture, lift: number) {
  return muted(new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    depthWrite: false,
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -1 - lift,
    polygonOffsetUnits: -1 - lift,
  }));
}

/**
 * Ribbons along the lanes with a painted strip (the path runs up the picture,
 * seamless top to bottom): `wide` is how much wider the picture is than the
 * lane (its grassy shoulders), `length` the world units one picture covers.
 * All lanes in one mesh. The corners are left to round patches on top.
 */
export function ribbons(lanes: { pts: [number, number][]; w: number }[], map: THREE.Texture, wide: number, length: number, y = 0.006, order = 1, overlap = 0.3): THREE.Mesh {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  let start = 0;
  for (const { pts, w } of lanes) {
    const half = (w * wide) / 2;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      // Run each segment a little past its ends so the joints close up under the patches.
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      const nx = -dz * half;
      const nz = dx * half;
      const over = w * overlap;
      const a = [ax - dx * over, az - dz * over];
      const b = [bx + dx * over, bz + dz * over];
      // Each segment starts the picture at a different place, so neighbours don't repeat the same pebbles.
      const v0 = (start = (start + 0.37) % 1);
      const v1 = v0 + (len + over * 2) / length;
      const k = pos.length / 3;
      pos.push(a[0] - nx, y, a[1] - nz, a[0] + nx, y, a[1] + nz, b[0] - nx, y, b[1] - nz, b[0] + nx, y, b[1] + nz);
      uv.push(0, v0, 1, v0, 0, v1, 1, v1);
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(index);
  const m = new THREE.Mesh(geo, flatMaterial(map, order));
  m.receiveShadow = true;
  m.renderOrder = order;
  m.userData.noAO = true;
  return m;
}

/**
 * The loose ends of the lanes, where a round patch closes the strip (corners
 * and crossings close up by themselves: the strips run past each other). An
 * end is a point only one stretch of lane reaches, lying on no other lane.
 */
export function laneEnds(lanes: { pts: [number, number][]; w: number }[]): { x: number; z: number; w: number }[] {
  const segs = lanes.flatMap(({ pts }) => pts.slice(1).map((b, i) => [pts[i], b] as const));
  const near = (x: number, z: number, [a, b]: (typeof segs)[number]) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 0.3;
  };
  const out: { x: number; z: number; w: number }[] = [];
  for (const { pts, w } of lanes)
    for (const [x, z] of [pts[0], pts[pts.length - 1]]) if (segs.filter((s) => near(x, z, s)).length === 1 && !out.some((p) => Math.hypot(p.x - x, p.z - z) < 0.3)) out.push({ x, z, w });
  return out;
}

/** Round painted patches (one instanced draw per variant), each turned at random. */
export function patches(spots: { x: number; z: number; size: number }[], maps: THREE.Texture[], y = 0.008, order = 2): THREE.Group {
  const g = new THREE.Group();
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  maps.forEach((map, v) => {
    const mine = spots.filter((_, i) => i % maps.length === v);
    if (!mine.length) return;
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), flatMaterial(map, order), mine.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    mine.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
      im.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, y, s.z), q, new THREE.Vector3(s.size, 1, s.size)));
    });
    im.receiveShadow = true;
    im.renderOrder = order;
    im.userData.noAO = true;
    g.add(im);
  });
  return g;
}

/** A soft oval with a wavering edge, as the alpha of a picture painted without its own (the pig yard's mud). */
export function ovalMask(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.filter = 'blur(6px)';
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r = 112 + Math.sin(a * 5) * 5 + Math.sin(a * 11 + 1) * 3;
    g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** One painted picture over a rectangle (north at the top of the picture), slightly larger for its soft edge. */
export function decal(r: Rect, map: THREE.Texture, grow = 0, y = 0.005, order = 0): THREE.Mesh {
  const w = r.x1 - r.x0 + grow * 2;
  const d = r.z1 - r.z0 + grow * 2;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), flatMaterial(map, order));
  m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  m.receiveShadow = true;
  m.renderOrder = order;
  m.userData.noAO = true;
  return m;
}

/**
 * Painted cards standing on the ground and leaning back to face the camera
 * (the camera never turns, so a picture painted from its angle reads as a
 * solid thing): `size` is the card's width in world units, the picture's
 * aspect gives its height. Alpha-tested, so they sort among the 3D models.
 */
export function cards(spots: { x: number; z: number; size: number }[], maps: THREE.Texture[], shadow = false): THREE.Group {
  const g = new THREE.Group();
  // The card's plane: its normal is the view direction; its bottom edge lies on the ground.
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), VIEW);
  maps.forEach((map, v) => {
    const mine = spots.filter((_, i) => i % maps.length === v);
    if (!mine.length) return;
    const img = map.image as HTMLImageElement;
    const aspect = img.height / img.width;
    // The plane's bottom edge at its origin, so it stands on the ground.
    const geo = new THREE.PlaneGeometry(1, aspect).translate(0, aspect / 2, 0);
    const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, roughness: 0.9, side: THREE.DoubleSide });
    // Lit as if facing up, so the painted light is not darkened by the lean.
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: geo.attributes.position.count }, () => [0, 0.8, 0.6]).flat(), 3));
    const im = new THREE.InstancedMesh(geo, mat, mine.length);
    const m = new THREE.Matrix4();
    mine.forEach((s, i) => im.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, 0, s.z), tilt, new THREE.Vector3(s.size, s.size, s.size))));
    im.castShadow = shadow;
    if (shadow) im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 });
    im.receiveShadow = false;
    im.userData.noAO = true;
    g.add(im);
  });
  return g;
}

/**
 * Painted things standing on the map (trees, bushes) as cards, each with a soft
 * painted shadow on the ground thrown up and to the right, away from the sun
 * (low left, see FARM-KIT.md), since cards don't cast real ones.
 */
export function standees(spots: { x: number; z: number; size: number }[], maps: THREE.Texture[], shadow: THREE.Texture | null): THREE.Group {
  const g = new THREE.Group();
  // Back to front, so nearer crowns cover farther ones where they overlap.
  const sorted = [...spots].sort((a, b) => a.z - b.z);
  g.add(cards(sorted, maps));
  if (shadow) g.add(patches(sorted.map((s) => ({ x: s.x + s.size * 0.18, z: s.z - s.size * 0.12, size: s.size * 1.1 })), [shadow], 0.009, 3));
  return g;
}

/**
 * The seamless painted grass under everything, with its sunny variant over
 * the meadows: `tile` world units per picture, sampled twice (once turned) so
 * the repeat does not show.
 */
export function grassMaterial(main: THREE.Texture, sunny: THREE.Texture | null, meadows: { x: number; z: number; rx: number; rz: number }[], tile: number, tone?: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  // `tone` evens the picture out under the game's own sun and grading, to match the map's target.
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, color: tone ?? '#ffffff' });
  const uniforms = {
    tMain: { value: main },
    tSunny: { value: sunny ?? main },
    uTile: { value: tile },
    uMeadow: { value: meadows.slice(0, 4).concat(Array(4).fill({ x: 0, z: 0, rx: 0.001, rz: 0.001 })).slice(0, 4).map((e) => new THREE.Vector4(e.x, e.z, e.rx, e.rz)) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vGround;
uniform sampler2D tMain, tSunny;
uniform float uTile;
uniform vec4 uMeadow[4];
float kHash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float kNoise(vec2 q) { vec2 i = floor(q); vec2 f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(kHash(i), kHash(i + vec2(1.0, 0.0)), u.x), mix(kHash(i + vec2(0.0, 1.0)), kHash(i + vec2(1.0, 1.0)), u.x), u.y); }`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec2 p = vGround / uTile;
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p * 0.83 + 0.31;
  float k = smoothstep(0.3, 0.7, kNoise(vGround / 9.0));
  vec3 a = mix(texture2D(tMain, p).rgb, texture2D(tMain, q).rgb, k);
  vec3 b = mix(texture2D(tSunny, p).rgb, texture2D(tSunny, q).rgb, k);
  float sun = 0.0;
  for (int i = 0; i < 4; i++) sun = max(sun, 1.0 - smoothstep(0.6, 1.0 + kNoise(vGround / 3.0) * 0.25, length((vGround - uMeadow[i].xy) / uMeadow[i].zw)));
  // Only a hint of the sunny meadow: a whole patch of it reads as a spotlight.
  sun *= 0.55;
  diffuseColor.rgb *= mix(a, b, sun);
  ${MUTED}
}`,
      );
  };
  mat.customProgramCacheKey = () => 'kit-grass';
  return mat;
}

/** Evens a laid piece out under the game's sun and grading (multiplies its picture by `tone`). */
export function toned<T extends THREE.Object3D>(o: T, tone: THREE.ColorRepresentation): T {
  o.traverse((n) => {
    const m = (n as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.color) m.color.set(tone);
  });
  return o;
}

/** A rectangle, for the field and beds (re-exported for maps). */
export type { Rect };

/** A picture repeated over a rectangle every `tile` world units (a lawn, a yard), in world space. */
export function tiledDecal(r: Rect, map: THREE.Texture, tile: number, y = 0.005, order = 0): THREE.Mesh {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  // World-anchored, so neighbouring lawns continue the same pattern.
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (r.x0 + uv.getX(i) * w) / tile, (-r.z1 + uv.getY(i) * d) / tile);
  const t = map.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  const m = new THREE.Mesh(geo, flatMaterial(t, order));
  m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  m.receiveShadow = true;
  m.renderOrder = order;
  m.userData.noAO = true;
  return m;
}

/** The four ways out of a road tile, as unit steps: east, south, west, north. */
type Dir = [number, number];
/** Which ways each painted road tile opens, as drawn (north at the top of the picture). */
const TILE_WAYS: Record<'corner' | 'tee' | 'cross' | 'end', Dir[]> = {
  corner: [[0, 1], [1, 0]],
  tee: [[-1, 0], [1, 0], [0, 1]],
  cross: [[1, 0], [0, 1], [-1, 0], [0, -1]],
  end: [[0, 1]],
};

export interface RoadTile {
  x: number;
  z: number;
  kind: keyof typeof TILE_WAYS;
  /** Quarter turns about +y (counter-clockwise from above). */
  turns: number;
}

/**
 * A road network from lanes of one width: the straight runs between junctions
 * (for the strip ribbons, cut back where a tile sits) and the tiles at the
 * corners, tees, crossings and dead ends, each turned to fit. Roads that run
 * off the board end in no tile. Axis-aligned roads only.
 */
export function roadNet(lanes: { pts: [number, number][]; w: number }[], board: { width: number; depth: number }) {
  const key = (x: number, z: number) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const ways = new Map<string, { x: number; z: number; dirs: Dir[] }>();
  const at = (x: number, z: number) => ways.get(key(x, z)) ?? ways.set(key(x, z), { x, z, dirs: [] }).get(key(x, z))!;
  const segs: [number, number, number, number][] = [];
  for (const { pts } of lanes) for (let i = 1; i < pts.length; i++) segs.push([...pts[i - 1], ...pts[i]]);
  // A lane ending in the middle of another's run splits that run there (a tee).
  for (const [x, z] of lanes.flatMap((l) => [l.pts[0], l.pts[l.pts.length - 1]])) {
    for (let i = 0; i < segs.length; i++) {
      const [ax, az, bx, bz] = segs[i];
      const onX = az === bz && z === az && x > Math.min(ax, bx) + 0.01 && x < Math.max(ax, bx) - 0.01;
      const onZ = ax === bx && x === ax && z > Math.min(az, bz) + 0.01 && z < Math.max(az, bz) - 0.01;
      if (onX || onZ) segs.splice(i, 1, [ax, az, x, z], [x, z, bx, bz]);
    }
  }
  for (const [ax, az, bx, bz] of segs) {
    const len = Math.hypot(bx - ax, bz - az);
    const d: Dir = [Math.round((bx - ax) / len), Math.round((bz - az) / len)];
    at(ax, az).dirs.push(d);
    at(bx, bz).dirs.push([-d[0], -d[1]]);
  }
  const edge = (x: number, z: number) => Math.abs(x) >= board.width / 2 - 0.5 || Math.abs(z) >= board.depth / 2 - 0.5;
  const tiles: RoadTile[] = [];
  const same = (a: Dir[], b: Dir[]) => a.length === b.length && a.every((d) => b.some((e) => e[0] === d[0] && e[1] === d[1]));
  const turn = ([x, z]: Dir, k: number): Dir => {
    let d: Dir = [x, z];
    // A quarter turn counter-clockwise seen from above: east goes north (−z).
    for (let i = 0; i < k; i++) d = [d[1], -d[0]];
    return d;
  };
  for (const n of ways.values()) {
    const dirs = n.dirs.filter((d, i) => n.dirs.findIndex((e) => e[0] === d[0] && e[1] === d[1]) === i);
    if (edge(n.x, n.z) && dirs.length === 1) continue;
    if (dirs.length === 2 && dirs[0][0] === -dirs[1][0] && dirs[0][1] === -dirs[1][1]) continue;
    const kind = dirs.length >= 4 ? 'cross' : dirs.length === 3 ? 'tee' : dirs.length === 2 ? 'corner' : 'end';
    for (let k = 0; k < 4; k++)
      if (same(TILE_WAYS[kind].map((d) => turn(d, k)), dirs)) {
        tiles.push({ x: n.x, z: n.z, kind, turns: k });
        break;
      }
  }
  return { segs, tiles };
}

/** Road tiles (one instanced draw per kind), `size` world units square, above the strips. */
export function roadTiles(tiles: RoadTile[], maps: Partial<Record<RoadTile['kind'], THREE.Texture>>, size: number, y = 0.008, order = 3): THREE.Group {
  const g = new THREE.Group();
  for (const kind of Object.keys(TILE_WAYS) as RoadTile['kind'][]) {
    const mine = tiles.filter((t) => t.kind === kind);
    const map = maps[kind];
    if (!mine.length || !map) continue;
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, flatMaterial(map, order), mine.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    mine.forEach((t, i) => im.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, y, t.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.turns * Math.PI) / 2), new THREE.Vector3(size, 1, size))));
    im.receiveShadow = true;
    im.renderOrder = order;
    im.userData.noAO = true;
    g.add(im);
  }
  return g;
}

/** The straight runs between road tiles, cut back by half a tile where one sits, as lanes for `ribbons`. */
export function roadRuns(segs: [number, number, number, number][], tiles: RoadTile[], half: number, w: number) {
  const tiled = (x: number, z: number) => tiles.some((t) => Math.abs(t.x - x) < 0.05 && Math.abs(t.z - z) < 0.05);
  return segs.map(([ax, az, bx, bz]) => {
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    const a = tiled(ax, az) ? half : 0;
    const b = tiled(bx, bz) ? half : 0;
    return { pts: [[ax + dx * a, az + dz * a], [bx - dx * b, bz - dz * b]] as [number, number][], w };
  });
}
