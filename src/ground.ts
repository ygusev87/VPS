// The farm's ground, for a board of any size: seamless tiles (grass, sand,
// soil, mud, pond bed) repeated in world space and blended by a small mask of
// where the lanes, the field and the mud are. One big painted picture of the
// whole board would be blurry or far too heavy for an iPad once the board grows.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Seamless ground tiles (public/textures/farm), seen from straight above. */
const TILES = ['grass', 'grass-light', 'grass-base', 'grass-meadow', 'path', 'path-earth', 'soil', 'mud', 'pond-bed', 'asphalt', 'paving', 'asphalt-a', 'paving-a', 'quay'] as const;
export type Tile = (typeof TILES)[number];
const images = new Map<Tile, HTMLImageElement>();

/** Stand-in colours for tiles that failed to load (or are not made yet). */
const FLAT: Record<Tile, string> = { grass: '#a3c17f', 'grass-light': '#b6d28f', 'grass-base': '#7fb04a', 'grass-meadow': '#9cc455', path: '#d6bd86', 'path-earth': '#c8954f', soil: '#9a7650', mud: '#8a6a46', 'pond-bed': '#c9e6f0', asphalt: '#767b84', paving: '#d8cdbd', 'asphalt-a': '#6f737a', 'paving-a': '#d9c6a4', quay: '#c9bfae' };
/** How many world units one tile covers. */
const SIZE: Record<Tile, number> = { grass: 7, 'grass-light': 7, 'grass-base': 7, 'grass-meadow': 7, path: 3.5, 'path-earth': 3.5, soil: 14, mud: 3, 'pond-bed': 4, asphalt: 6, paving: 0.75, 'asphalt-a': 6, 'paving-a': 4, quay: 2 };
/** Tiles that are not seamless by plain repeat: mirrored at every other tile (Codex's paving and quay stone). */
const MIRRORED: Partial<Record<Tile, true>> = { 'paving-a': true, quay: true };

/** Single painted pictures, laid once over a place (not tiled): the pig yard's mud and its wetness. */
const PICTURES = ['pig-mud.webp', 'pig-wetness.png', 'soil-bed.webp'] as const;
type Picture = (typeof PICTURES)[number];
const pictures = new Map<Picture, HTMLImageElement>();

function loadImage(file: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  // The load event, not decode(): decode() can wait forever while the page is hidden.
  return new Promise((done) => {
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = `${import.meta.env.BASE_URL}textures/farm/${file}`;
  });
}

/** Loads the tiles once; any that fail leave a flat colour in their place. */
export async function loadGround() {
  await Promise.all([
    ...TILES.filter((name) => !images.has(name)).map(async (name) => {
      const img = await loadImage(`${name}.webp`);
      if (img) images.set(name, img);
    }),
    ...PICTURES.filter((name) => !pictures.has(name)).map(async (name) => {
      const img = await loadImage(name);
      if (img) pictures.set(name, img);
    }),
  ]);
}

/** One of the painted ground pictures (the pig yard's mud…), for laying as a decal; null if missing. */
export function groundPicture(name: 'pig-mud.webp' | 'soil-bed.webp'): THREE.Texture | null {
  return pictureTexture(name, false);
}

/** A picture laid once over a box (clamped), or a 1-pixel stand-in when it is missing. */
function pictureTexture(name: Picture, data: boolean): THREE.Texture | null {
  const img = pictures.get(name);
  if (!img) return null;
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function tileTexture(name: Tile): THREE.Texture {
  const img = images.get(name);
  let t: THREE.Texture;
  if (img) t = new THREE.Texture(img);
  else {
    const hex = parseInt(FLAT[name].slice(1), 16);
    t = new THREE.DataTexture(new Uint8Array([hex >> 16, (hex >> 8) & 255, hex & 255, 255]), 1, 1);
  }
  t.wrapS = t.wrapT = MIRRORED[name] ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
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
  /**
   * The painted look of a mobile farm game (the farm's design target,
   * assets-src/design-pass/variants/farm-a.png): broad patches in the grass,
   * paths with soft ragged shoulders and pebbles, wet mud with glossy
   * puddles, furrows in the beds. 'city': the city's own painted look (its target
   * city-a): paved yards with lawns edged by a pale kerb, soft-shouldered asphalt.
   * Off for the factory floor.
   */
  painted?: boolean | 'city';
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
    if (plan.painted) {
      // A soft ramp across the edge (1 in the middle, falling off 1.8 units out),
      // so the shader can let the shoulder wander in and out along the path.
      for (let k = 6; k >= 1; k--) {
        g.strokeStyle = `rgb(${Math.round(255 * (0.92 - 0.12 * k))},0,0)`;
        g.lineWidth = (w + 0.6 * k) * MASK_PX;
        g.stroke();
      }
      g.strokeStyle = 'rgb(235,0,0)';
      g.lineWidth = w * MASK_PX;
      g.stroke();
      g.strokeStyle = 'rgb(255,0,0)';
      g.lineWidth = Math.max(0.2, w - 0.8) * MASK_PX;
      g.stroke();
      continue;
    }
    g.strokeStyle = 'rgb(90,0,0)';
    g.lineWidth = (w + 0.5) * MASK_PX;
    g.stroke();
    g.strokeStyle = 'rgb(255,0,0)';
    g.lineWidth = w * MASK_PX;
    g.stroke();
  }
  const fields = [plan.field, ...(plan.fields ?? [])];
  if (plan.painted === 'city') {
    // The city's lawns are many rectangles that join into whole blocks: grow
    // their union (square rects, shifted round a circle) into a ramp, so only
    // the block's outer edge gets the kerb, never the seams inside it.
    const rect = (f: (typeof fields)[number], dx: number, dz: number) => g.fillRect(X(f.x0 + dx), Z(f.z0 + dz), (f.x1 - f.x0) * MASK_PX, (f.z1 - f.z0) * MASK_PX);
    for (const [grow, v] of [
      [0.5, 70],
      [0.25, 150],
    ] as const) {
      g.fillStyle = `rgb(0,${v},0)`;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        for (const f of fields) rect(f, Math.cos(a) * grow, Math.sin(a) * grow);
      }
    }
    g.fillStyle = 'rgb(0,255,0)';
    for (const f of fields) rect(f, 0, 0);
  } else {
    g.fillStyle = 'rgb(0,255,0)';
    for (const f of fields) {
      g.beginPath();
      g.roundRect(X(f.x0), Z(f.z0), (f.x1 - f.x0) * MASK_PX, (f.z1 - f.z0) * MASK_PX, 0.8 * MASK_PX);
      g.fill();
    }
  }
  for (const m of plan.mud) {
    // Painted: a ramp from the middle (1) out past the edge, for a churned ragged rim.
    const steps = plan.painted ? 7 : 1;
    for (let k = steps; k >= 1; k--) {
      const grow = plan.painted ? 1 + (k - 4) * 0.08 : 1;
      g.fillStyle = `rgb(0,0,${plan.painted ? Math.round(255 * Math.min(1, 1.15 - 0.15 * k)) : 255})`;
      g.beginPath();
      g.ellipse(X(m.x), Z(m.z), m.rx * grow * MASK_PX, m.rz * grow * MASK_PX, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** The ground as it was: tiles blended by the mask, a ragged path edge from the grass tile. */
const PLAIN = `
  vec3 col = mix(texture2D(tGrass, p / uScale.x).rgb, texture2D(tHillGrass, p / uScale.x).rgb, hill);
  col = mix(col, texture2D(tSoil, p / uScale.z).rgb, smoothstep(0.4, 0.6, m.g));
  col = mix(col, texture2D(tMud, p / uScale.w).rgb, smoothstep(0.35, 0.65, m.b));
  // A path's edge is ragged where the grass grows into it (the grass tile's own pattern breaks the line).
  float tuft = texture2D(tGrass, p / 1.7).g - 0.5;
  float lane = smoothstep(0.45 + tuft * 0.5, 0.85 + tuft * 0.3, m.r);
  float verge = smoothstep(0.15, 0.45, m.r) * (1.0 - lane);
  col *= 1.0 - verge * 0.12;
  col = mix(col, texture2D(tSand, p / uScale.y).rgb, lane);`;

/** Smooth value noise, for patches and edges painted at the scale of the board. */
const NOISE = `
float gHash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gFbm(vec2 q) { return gNoise(q) * 0.65 + gNoise(q * 2.13 + 7.1) * 0.35; }`;

/**
 * The painted farm (see GroundPlan.painted): the grass in broad soft patches
 * of deeper and sunnier green, with the tile sampled twice, turned, so it does
 * not visibly repeat; paths of warm packed earth with a soft shoulder that
 * wanders in and out, a darker rim where they meet the grass, and scattered
 * pebbles; the mud dark and wet towards its middle, with glossy puddles and a
 * churned edge; the beds furrowed.
 */
// Colours in these shaders are linear light (the tiles are decoded from sRGB), not sRGB hex.
const PAINTED = `
  // Grass: two samplings, one turned and larger, blended by a slow noise, against the tile's repeat.
  vec2 pr = mat2(0.8, -0.6, 0.6, 0.8) * p;
  vec3 g1 = texture2D(tGrass, p / uScale.x).rgb;
  vec3 g2 = texture2D(tGrass, pr / (uScale.x * 1.7) + 0.37).rgb;
  float patchy = gFbm(p / 14.0);
  vec3 grass = mix(g1, g2, smoothstep(0.3, 0.7, gNoise(p / 6.0)));
  // Broad tonal patches 12-20 units across: deeper green and sunny meadow green.
  vec3 sunny = texture2D(tHillGrass, p / uScale.x).rgb;
  grass = mix(grass, sunny, smoothstep(0.5, 0.8, patchy) * 0.8);
  grass *= mix(0.8, 1.1, smoothstep(0.15, 0.85, gFbm(p / 9.0 + 3.3)));
  // The painted grass tiles are bright lime under the day grading: a calmer, bluer green (the target's).
  grass = mix(vec3(dot(grass, vec3(0.2126, 0.7152, 0.0722))), grass, 0.8) * vec3(0.92, 0.93, 0.7);
  sunny = mix(vec3(dot(sunny, vec3(0.2126, 0.7152, 0.0722))), sunny, 0.8) * vec3(1.0, 0.98, 0.66);
  vec3 col = mix(grass, sunny, hill);
  // Clover, tiny flowers and darker tufts sprinkled through the grass, as in the target.
  vec2 fc = floor(p * 1.3);
  vec2 fin = fract(p * 1.3) - 0.5 - (vec2(gHash(fc + 2.1), gHash(fc + 7.3)) - 0.5) * 0.55;
  float fr = gHash(fc + 5.5);
  float dotR = 0.07 + gHash(fc + 8.8) * 0.06;
  float spot = 1.0 - smoothstep(dotR, dotR + 0.025, length(fin));
  // Mostly clover-dark tufts, now and then a white, yellow or pink flower.
  vec3 tuft = col * vec3(0.62, 0.72, 0.5);
  vec3 bloom = fr > 0.965 ? vec3(0.95, 0.92, 0.85) : fr > 0.93 ? vec3(0.95, 0.75, 0.12) : vec3(0.92, 0.42, 0.55);
  float isFlower = step(0.9, fr) * smoothstep(0.2, 0.6, gNoise(p / 5.0 + 13.0));
  float isTuft = step(0.5, fr) * (1.0 - step(0.9, fr));
  col = mix(col, tuft, spot * isTuft * 0.7);
  col = mix(col, bloom, spot * isFlower);
  // Beds: dark loose soil with furrows along their length.
  float bed = smoothstep(0.4, 0.6, m.g);
  vec3 soil = texture2D(tSoil, p / uScale.z).rgb;
  float wheat = 0.0;
  if (uHasBed > 0.5) {
    // The bed this point lies in: its own picture over it (top of the picture to the north).
    for (int i = 0; i < 8; i++) {
      vec4 b = uBeds[i];
      vec2 buv = vec2((p.x - b.x) / (b.z - b.x), 1.0 - (p.y - b.y) / (b.w - b.y));
      if (b.z > b.x && buv.x >= 0.0 && buv.x <= 1.0 && buv.y >= 0.0 && buv.y <= 1.0) {
        soil = texture2D(tBed, buv).rgb;
        // The wheat field (the first): golden stalks in rows on its soil, flat
        // under the tractor's round, so the whole field reads as ripe wheat.
        if (i == 0) wheat = 1.0;
      }
    }
    // Earth brown, not the red-orange the day grading makes of it.
    soil = mix(vec3(dot(soil, vec3(0.2126, 0.7152, 0.0722))), soil, 0.7) * vec3(0.92, 0.94, 1.0);
    // (Linear light: deep amber between the rows, ripe gold on them; after the browning above.)
    // Gentle rows (low contrast), broken along their length by short stalk clumps, some earth showing between.
    float row = smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(p.x * 6.0 + gNoise(p * 0.8) * 1.5));
    float clumps = gFbm(vec2(p.x * 2.2, p.y * 1.1) + 31.0);
    vec3 gold = mix(vec3(0.42, 0.22, 0.03), vec3(0.6, 0.36, 0.05), row * 0.6 + clumps * 0.4) * (0.92 + gFbm(p * 1.5 + 7.0) * 0.12);
    float cover = wheat * mix(0.45, 0.78, smoothstep(0.3, 0.7, clumps)) * mix(0.8, 1.0, row);
    soil = mix(soil, gold, cover);
  } else soil *= 0.82 + 0.18 * smoothstep(-0.6, 0.6, sin(p.x * 5.2 + gNoise(p * 1.3) * 1.2));
  col = mix(col, soil, bed);
  // Mud: a ragged churned edge, darker and wet towards the middle, puddles that shine.
  // (The mask ramps from ~0.1 just outside the ellipse to 1 well inside it.)
  float mudE = m.b + (gNoise(p * 1.4) - 0.5) * 0.36 + (gNoise(p * 4.0) - 0.5) * 0.12;
  float mud = smoothstep(0.5, 0.62, mudE);
  float deep = smoothstep(0.7, 1.0, m.b);
  vec3 muck = texture2D(tMud, p / uScale.w).rgb;
  // The old mud tile has pale dry patches that repeat: keep it the colour of mud.
  muck = mix(muck, vec3(0.19, 0.08, 0.03) * (0.85 + gNoise(p * 2.0) * 0.3), smoothstep(0.32, 0.5, dot(muck, vec3(0.333))));
  muck *= mix(1.0, 0.72, deep);
  // Puddles: dark brown water, a faint sheen; and darker wet soil round them.
  float puddleN = gFbm(p / 1.7 + 11.0);
  float pool = smoothstep(0.6, 0.67, puddleN) * deep;
  float damp = smoothstep(0.5, 0.62, puddleN) * deep;
  muck *= 1.0 - damp * 0.18;
  // (Colours here are linear: #3a2616 for the water, a grey sheen.)
  muck = mix(muck, vec3(0.042, 0.019, 0.008), pool * 0.9);
  muck = mix(muck, vec3(0.2, 0.19, 0.18), pool * 0.08);
  float wet = mix(deep * 0.35, 0.75, max(pool, damp * 0.4));
  // The yard's own painting, where there is one: puddles and hoof prints drawn for it, wetness from its mask.
  vec2 yuv = vec2((p.x - uYard.x) / (2.0 * uYard.z) + 0.5, 0.5 - (p.y - uYard.y) / (2.0 * uYard.w));
  float inYard = uHasYard * step(0.0, yuv.x) * step(yuv.x, 1.0) * step(0.0, yuv.y) * step(yuv.y, 1.0);
  vec4 wm = texture2D(tPigWet, yuv);
  vec3 painting = texture2D(tPigMud, yuv).rgb;
  // Brown mud, not red clay: less saturated and a touch less red (puddles and wetness untouched).
  painting = mix(vec3(dot(painting, vec3(0.2126, 0.7152, 0.0722))), painting, 0.68) * vec3(0.9, 0.93, 1.0);
  muck = mix(muck, painting, inYard);
  wet = mix(wet, max(wm.r * 0.6, wm.g), inYard);
  col = mix(col, muck, mud);
  vWet = mud * wet;
  // Paths: the shoulder wanders in and out, grass tongues reach over it, a darker rim, pebbles.
  // (The mask ramps across the edge: ~0.92 at the path's width, ~0.2 1.8 units out.)
  float wander = (gNoise(p / 2.6) - 0.5) * 0.3 + (texture2D(tGrass, p / 1.5).g - 0.5) * 0.2;
  float edge = 0.8 + wander;
  // (Never over the mud: a path ends at its rim instead of cutting across it.)
  float lane = smoothstep(edge - 0.09, edge + 0.07, m.r) * (1.0 - mud);
  // Trodden grass just outside the edge, darker and a touch yellower.
  float rim = smoothstep(edge - 0.32, edge - 0.04, m.r) * (1.0 - lane);
  col = mix(col, col * vec3(0.82, 0.8, 0.62), rim * 0.55);
  vec3 earth = texture2D(tSand, p / uScale.y).rgb;
  // A shade lighter and less orange than the tile: the target's paths are warm tan (the day grading adds colour).
  // Warm tan like the target's paths: less pink, a touch deeper (linear light).
  earth = mix(vec3(dot(earth, vec3(0.2126, 0.7152, 0.0722))), earth, 0.55) * vec3(1.06, 0.98, 0.78);
  earth *= mix(0.88, 1.06, gNoise(p / 3.0 + 5.0));
  // Worn darker towards the shoulders.
  earth *= mix(0.9, 1.0, smoothstep(edge, 1.0, m.r));
  col = mix(col, earth, lane);`;

/**
 * The painted city (GroundPlan.painted 'city', target city-a): paving all over,
 * gently uneven; lawns of the farm's grass in soft patches, each edged with a
 * pale kerb stone; asphalt roads with a slightly darker, worn shoulder.
 * (Slots: base = paving, field = lawn grass, hill = meadow grass, lane = asphalt.)
 */
const CITY = `
  vec3 col = texture2D(tGrass, p / uScale.x).rgb * mix(0.93, 1.05, gNoise(p / 4.0 + 2.0));
  // Lawns, a kerb ring round them (the mask ramps 1 inside, ~0.6 on the kerb, ~0.27 just outside).
  float lawn = smoothstep(0.8, 0.92, m.g);
  float kerb = smoothstep(0.42, 0.52, m.g) * (1.0 - lawn);
  vec3 g1 = texture2D(tSoil, p / uScale.z).rgb;
  vec3 g2 = texture2D(tHillGrass, p / uScale.z).rgb;
  vec3 green = mix(g1, g2, smoothstep(0.45, 0.8, gFbm(p / 14.0)));
  green = mix(vec3(dot(green, vec3(0.2126, 0.7152, 0.0722))), green, 0.8) * vec3(0.92, 0.93, 0.7);
  // The target's lawns are a sunny yellow-green, lighter than the farm's fields.
  green *= vec3(1.12, 1.1, 0.95) * mix(0.86, 1.08, smoothstep(0.15, 0.85, gFbm(p / 9.0 + 3.3)));
  col = mix(col, vec3(0.74, 0.7, 0.62) * (0.95 + gNoise(p * 3.0) * 0.08), kerb);
  col = mix(col, green, lawn);
  // Asphalt: crisp at the kerb, a darker worn band along its edges.
  float lane = smoothstep(0.84, 0.9, m.r) * (1.0 - lawn);
  vec3 asph = texture2D(tSand, p / uScale.y).rgb * mix(0.9, 1.04, gNoise(p / 3.0 + 9.0));
  asph *= mix(0.9, 1.0, smoothstep(0.9, 1.0, m.r));
  col = mix(col, col * 0.86, smoothstep(0.55, 0.84, m.r) * (1.0 - lane) * 0.5);
  col = mix(col, asph, lane);`;

/** The board's top: tiles blended by the mask, a little less colourful than painted (the day grading adds it back). */
export function groundMaterial(plan: GroundPlan): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  const painted = plan.painted === true;
  const city = plan.painted === 'city';
  // The pig yard's own painted mud (one picture over its ellipse, north at the top) and its wetness.
  const pigMud = painted && plan.mud[0] ? pictureTexture('pig-mud.webp', false) : null;
  const pigWet = pigMud ? pictureTexture('pig-wetness.png', true) : null;
  const yard = plan.mud[0] ?? { x: 0, z: 0, rx: 1, rz: 1 };
  const bedSoil = painted ? pictureTexture('soil-bed.webp', false) : null;
  const beds = [plan.field, ...(plan.fields ?? [])]
    .slice(0, 8)
    .map((f) => new THREE.Vector4(f.x0, f.z0, f.x1, f.z1))
    .concat(Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -1, -1)))
    .slice(0, 8);
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
    tPigMud: { value: pigMud ?? tileTexture(t.mud) },
    tPigWet: { value: pigWet ?? tileTexture(t.mud) },
    uYard: { value: new THREE.Vector4(yard.x, yard.z, yard.rx, yard.rz) },
    uHasYard: { value: pigMud && pigWet ? 1 : 0 },
    // Each bed (and the field) gets one soil picture, its ridges running north-south.
    tBed: { value: bedSoil ?? tileTexture(t.field) },
    uHasBed: { value: bedSoil ? 1 : 0 },
    uBeds: { value: beds },
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
uniform float uSaturation;
uniform sampler2D tPigMud, tPigWet;
uniform vec4 uYard;
uniform float uHasYard;
uniform sampler2D tBed;
uniform float uHasBed;
uniform vec4 uBeds[8];
float vWet;
${painted || city ? NOISE : ''}`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec2 p = vGround;
  vec4 m = texture2D(tMask, vec2(p.x / uBoard.x + 0.5, 0.5 - p.y / uBoard.y));
  float hill = 0.0;
  for (int i = 0; i < 4; i++) hill = max(hill, 1.0 - smoothstep(0.75, 1.0, length((p - uHill[i].xy) / uHill[i].zw)));
  vWet = 0.0;
  ${painted ? PAINTED : city ? CITY : PLAIN}
  col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSaturation), 0.0);
  diffuseColor.rgb *= col;
}`,
      );
  };
  if (painted) {
    // Wet mud and puddles shine: less rough where vWet is.
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
      prev(shader, r);
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.38, vWet);');
    };
  }
  // Boards of a kind share one compiled shader.
  mat.customProgramCacheKey = () => (painted ? 'farm-ground-painted' : city ? 'city-ground-painted' : 'farm-ground');
  return mat;
}

/**
 * The board's edge (Codex's EDGE-PROPOSAL): a low light rim round the top, so
 * the play surface has a clear, soft outline, and a matte side without the old
 * dark wooden lip. The farm's rim is earthy, the city's a pale kerb stone.
 */
export function boardEdge(width: number, depth: number, look: 'farm' | 'city'): THREE.Group {
  const g = new THREE.Group();
  const c = look === 'farm' ? { rim: '#b99a6a', side: '#6b5440' } : { rim: '#e9dfcd', side: '#9a9085' };
  const rimMat = new THREE.MeshStandardMaterial({ color: c.rim, roughness: 0.85 });
  const sideMat = new THREE.MeshStandardMaterial({ color: c.side, roughness: 1 });
  const T = 0.32;
  const H = 0.16;
  for (const [w, d, x, z] of [
    [width + T, T, 0, -depth / 2],
    [width + T, T, 0, depth / 2],
    [T, depth - T, -width / 2, 0],
    [T, depth - T, width / 2, 0],
  ] as const) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, H, d, 2, 0.06), rimMat);
    m.position.set(x, -0.02 + H / 2 - 0.04, z);
    m.receiveShadow = true;
    m.userData.noAO = true;
    g.add(m);
  }
  // The side under the rim, a little inside it.
  const side = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.9, depth + 0.1), sideMat);
  side.position.y = -0.5;
  g.add(side);
  return g;
}

/** A tiled material for building parts (the canal's stone banks): `repeat` tiles over the mesh's UVs. */
export function tiledMaterial(name: Tile, repeat: [number, number], roughness = 0.85): THREE.MeshStandardMaterial {
  const t = tileTexture(name);
  t.repeat.set(...repeat);
  return new THREE.MeshStandardMaterial({ map: t, roughness });
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
