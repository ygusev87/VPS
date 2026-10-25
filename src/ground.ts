// The farm's ground, for a board of any size: seamless tiles (grass, sand,
// soil, mud, pond bed) repeated in world space and blended by a small mask of
// where the lanes, the field and the mud are. One big painted picture of the
// whole board would be blurry or far too heavy for an iPad once the board grows.
import * as THREE from 'three';

/** Seamless ground tiles (public/textures/farm), seen from straight above. */
const TILES = ['grass', 'grass-light', 'path', 'soil', 'mud', 'pond-bed', 'asphalt', 'paving'] as const;
export type Tile = (typeof TILES)[number];
const images = new Map<Tile, HTMLImageElement>();

/** Stand-in colours for tiles that failed to load (or are not made yet). */
const FLAT: Record<Tile, string> = { grass: '#a3c17f', 'grass-light': '#b6d28f', path: '#d6bd86', soil: '#9a7650', mud: '#8a6a46', 'pond-bed': '#c9e6f0', asphalt: '#767b84', paving: '#d8cdbd' };
/** How many world units one tile covers. */
const SIZE: Record<Tile, number> = { grass: 7, 'grass-light': 7, path: 3.5, soil: 14, mud: 3, 'pond-bed': 4, asphalt: 6, paving: 0.75 };

/** Loads the tiles once; any that fail leave a flat colour in their place. */
export async function loadGround() {
  await Promise.all(
    TILES.filter((name) => !images.has(name)).map(async (name) => {
      const img = new Image();
      // The load event, not decode(): decode() can wait forever while the page is hidden.
      const ok = await new Promise<boolean>((done) => {
        img.onload = () => done(true);
        img.onerror = () => done(false);
        img.src = `${import.meta.env.BASE_URL}textures/farm/${name}.webp`;
      });
      if (ok) images.set(name, img);
    }),
  );
}

function tileTexture(name: Tile): THREE.Texture {
  const img = images.get(name);
  let t: THREE.Texture;
  if (img) t = new THREE.Texture(img);
  else {
    const hex = parseInt(FLAT[name].slice(1), 16);
    t = new THREE.DataTexture(new Uint8Array([hex >> 16, (hex >> 8) & 255, hex & 255, 255]), 1, 1);
  }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = !!img;
  t.minFilter = img ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export interface Ellipse {
  x: number;
  z: number;
  rx: number;
  rz: number;
}

/** Where everything on the ground is, in world units (the board is centred on 0). */
export interface GroundPlan {
  width: number;
  depth: number;
  /** Sandy lanes: a polyline and its width. */
  lanes: { pts: [number, number][]; w: number }[];
  /** The ploughed field: a rounded rectangle. */
  field: { x0: number; z0: number; x1: number; z1: number };
  /** More ploughed ground (garden beds, more fields). */
  fields?: { x0: number; z0: number; x1: number; z1: number }[];
  mud: Ellipse[];
  /** Lighter grass on the hill. */
  hill: Ellipse;
  /** More patches of lighter grass (meadows), up to three. */
  meadows?: Ellipse[];
  /** How colourful the ground is (1 as the tiles are painted; the default is a little greyer). */
  saturation?: number;
  /** Which tile paints each part of the ground (the farm's by default; the city has asphalt roads and paved squares). */
  tiles?: Partial<Record<'base' | 'hill' | 'lane' | 'field' | 'mud', Tile>>;
}

/** Mask pixels per world unit: enough for soft lane edges, small enough for any board. */
const MASK_PX = 8;

/**
 * The mask: red = lanes (a fainter band round them is the worn verge), green =
 * the field, blue = mud. Painted with "lighten" so overlaps keep the stronger.
 */
function maskTexture(plan: GroundPlan): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = Math.ceil(plan.width * MASK_PX);
  c.height = Math.ceil(plan.depth * MASK_PX);
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'lighten';
  const X = (x: number) => (x + plan.width / 2) * MASK_PX;
  const Z = (z: number) => (z + plan.depth / 2) * MASK_PX;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const { pts, w } of plan.lanes) {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.strokeStyle = 'rgb(90,0,0)';
    g.lineWidth = (w + 0.5) * MASK_PX;
    g.stroke();
    g.strokeStyle = 'rgb(255,0,0)';
    g.lineWidth = w * MASK_PX;
    g.stroke();
  }
  g.fillStyle = 'rgb(0,255,0)';
  for (const f of [plan.field, ...(plan.fields ?? [])]) {
    g.beginPath();
    g.roundRect(X(f.x0), Z(f.z0), (f.x1 - f.x0) * MASK_PX, (f.z1 - f.z0) * MASK_PX, 0.8 * MASK_PX);
    g.fill();
  }
  g.fillStyle = 'rgb(0,0,255)';
  for (const m of plan.mud) {
    g.beginPath();
    g.ellipse(X(m.x), Z(m.z), m.rx * MASK_PX, m.rz * MASK_PX, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** The board's top: tiles blended by the mask, a little less colourful than painted (the day grading adds it back). */
export function groundMaterial(plan: GroundPlan): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  const t = { base: 'grass', hill: 'grass-light', lane: 'path', field: 'soil', mud: 'mud', ...plan.tiles } as const;
  const uniforms = {
    tGrass: { value: tileTexture(t.base) },
    tHillGrass: { value: tileTexture(t.hill) },
    tSand: { value: tileTexture(t.lane) },
    tSoil: { value: tileTexture(t.field) },
    tMud: { value: tileTexture(t.mud) },
    tMask: { value: maskTexture(plan) },
    uBoard: { value: new THREE.Vector2(plan.width, plan.depth) },
    uHill: { value: [plan.hill, ...(plan.meadows ?? [])].slice(0, 4).concat(Array(4).fill({ x: 0, z: 0, rx: 0.001, rz: 0.001 })).slice(0, 4).map((e) => new THREE.Vector4(e.x, e.z, e.rx, e.rz)) },
    uSaturation: { value: plan.saturation ?? 0.8 },
    // World units per tile of each part.
    uScale: { value: new THREE.Vector4(SIZE[t.base], SIZE[t.lane], SIZE[t.field], SIZE[t.mud]) },
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
uniform sampler2D tGrass, tHillGrass, tSand, tSoil, tMud, tMask;
uniform vec2 uBoard;
uniform vec4 uHill[4];
uniform vec4 uScale;
uniform float uSaturation;`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec2 p = vGround;
  vec4 m = texture2D(tMask, vec2(p.x / uBoard.x + 0.5, 0.5 - p.y / uBoard.y));
  float hill = 0.0;
  for (int i = 0; i < 4; i++) hill = max(hill, 1.0 - smoothstep(0.75, 1.0, length((p - uHill[i].xy) / uHill[i].zw)));
  vec3 col = mix(texture2D(tGrass, p / uScale.x).rgb, texture2D(tHillGrass, p / uScale.x).rgb, hill);
  col = mix(col, texture2D(tSoil, p / uScale.z).rgb, smoothstep(0.4, 0.6, m.g));
  col = mix(col, texture2D(tMud, p / uScale.w).rgb, smoothstep(0.35, 0.65, m.b));
  float lane = smoothstep(0.55, 0.8, m.r);
  float verge = smoothstep(0.15, 0.4, m.r) * (1.0 - lane);
  col *= 1.0 - verge * 0.22;
  col = mix(col, texture2D(tSand, p / uScale.y).rgb, lane);
  col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSaturation), 0.0);
  diffuseColor.rgb *= col;
}`,
      );
  };
  // Every board shares one compiled shader.
  mat.customProgramCacheKey = () => 'farm-ground';
  return mat;
}

/** A pond: a sandy bed with a rim of shore, clear water over it, deeper in the middle. */
export function pond({ x, z, rx, rz }: Ellipse): THREE.Group {
  const g = new THREE.Group();
  const disc = (sx: number, sz: number, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(sx, sz, 1);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.userData.noAO = true;
    g.add(m);
    return m;
  };
  const bed = tileTexture('pond-bed');
  bed.repeat.set(rx / 2, rz / 2);
  disc(rx, rz, new THREE.MeshStandardMaterial({ map: bed, roughness: 0.95 }), 0.004);
  const water = (opacity: number, color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.1, transparent: true, opacity, depthWrite: false });
  disc(rx * 0.9, rz * 0.88, water(0.7, '#46a5d7'), 0.008);
  disc(rx * 0.6, rz * 0.55, water(0.35, '#2878b9'), 0.01);
  disc(rx * 0.4, rz * 0.2, water(0.3, '#ffffff'), 0.012).position.x -= rx * 0.2;
  return g;
}

/** Little clumps of flowers on the grass, all in one instanced draw; `free` says where they may grow. */
export function flowers(plan: GroundPlan, clumps: number, free: (x: number, z: number) => boolean): THREE.InstancedMesh {
  const colors = ['#ffffff', '#ffd23f', '#ff8fb1', '#b388ff'].map((c) => new THREE.Color(c));
  const spots: { x: number; z: number; c: THREE.Color }[] = [];
  for (let n = 0, tries = 0; n < clumps && tries < clumps * 40; tries++) {
    const x = (Math.random() - 0.5) * (plan.width - 3);
    const z = (Math.random() - 0.5) * (plan.depth - 3);
    if (!free(x, z)) continue;
    n++;
    for (let i = 0; i < 4 + (n % 4); i++) spots.push({ x: x + (Math.random() - 0.5) * 1.2, z: z + (Math.random() - 0.5) * 0.9, c: colors[n % colors.length] });
  }
  const im = new THREE.InstancedMesh(new THREE.CircleGeometry(0.11, 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.7 }), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach((s, i) => {
    im.setMatrixAt(i, m.makeTranslation(s.x, 0.015, s.z));
    im.setColorAt(i, s.c);
  });
  im.receiveShadow = true;
  return im;
}

/** Is a point on one of the lanes (with `margin` to spare)? */
export function onLane(plan: GroundPlan, x: number, z: number, margin: number) {
  return plan.lanes.some(({ pts, w }) =>
    pts.slice(1).some(([bx, bz], i) => {
      const [ax, az] = pts[i];
      const dx = bx - ax;
      const dz = bz - az;
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(x - ax - dx * k, z - az - dz * k) < w / 2 + margin;
    }),
  );
}
