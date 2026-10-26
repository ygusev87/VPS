/** CPU geometry audit of pinned constructors. No renderer, game boot, network or source edits. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { build, VERSION as rolldownVersion } from 'rolldown';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const revision = 'fb787044a2f69c31c8d1d2d5e8fabe34f4b62fa5';
const sha = b => createHash('sha256').update(b).digest('hex');
const sources = new Map();
function source(path) {
  if (!sources.has(path)) sources.set(path, execFileSync('git', ['show', `${revision}:${path}`], { cwd: repo }));
  return sources.get(path).toString();
}
const tracked = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', revision, 'src'], { cwd: repo, encoding: 'utf8' }).trim().split('\n'));
const lock = JSON.parse(source('package-lock.json'));
for (const pkg of ['three', 'rolldown']) {
  const installed = JSON.parse(readFileSync(resolve(repo, 'node_modules', pkg, 'package.json')));
  assert.equal(installed.version, lock.packages[`node_modules/${pkg}`].version, `${pkg} differs from pinned lock`);
}
const classes = ['Barrier', 'FerrisWheel', 'CarWash', 'Drawbridge', 'TowerCrane', 'DuskLamp', 'NeonSign', 'FireLadder'];
const entry = '\0contract-entry';
const prefix = '\0pinned:';
const cache = resolve(here, '.measure-cache');
mkdirSync(cache, { recursive: true });
await build({
  input: entry,
  external: id => id === 'three' || id.startsWith('three/'),
  plugins: [{
    name: 'read-pinned-git-sources',
    resolveId(id, importer) {
      if (id === entry) return entry;
      if (id === 'pinned-city') return prefix + 'src/parts/city.ts';
      if (id.startsWith('.') && importer?.startsWith(prefix)) {
        const base = posix.normalize(posix.join(posix.dirname(importer.slice(prefix.length)), id));
        const path = [base, base + '.ts', base + '/index.ts'].find(p => tracked.has(p));
        assert(path, `Unresolved pinned dependency ${id} from ${importer}`);
        return prefix + path;
      }
    },
    load(id) {
      if (id === entry) return `export { ${classes.join(', ')} } from 'pinned-city';`;
      if (id.startsWith(prefix)) return { code: source(id.slice(prefix.length)), moduleType: 'ts' };
    },
  }],
  output: { file: resolve(cache, 'constructors.mjs'), format: 'esm' },
});

// Paint calls are irrelevant to geometry; unknown DOM/canvas APIs fail loudly.
let canvasCount = 0;
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas'); canvasCount++;
    const ctx = {
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {}, fillText() {}, strokeText() {},
    };
    return { width: 0, height: 0, getContext(type) { assert.equal(type, '2d'); return ctx; } };
  },
};
const constructors = await import(pathToFileURL(resolve(cache, 'constructors.mjs')).href);
const city = source('src/city.ts');
const story = source('src/storymap.ts');
source('src/world.ts'); source('src/parts/catalog.ts'); source('src/circuit/solver.ts');
source('src/input.ts'); source('src/parts/chain.ts');
source('assets-src/README.md');
const stage = source('src/stage.ts');
assert.match(stage, /const VIEW_DIR = new THREE.Vector3\(0, 1, 0\.78\).normalize\(\)/);
assert.match(story, /part\.root\.rotation\.y = yawFor\(part\.kind, s\.spot, s\.toward\)/);
const front = story.match(/const FRONT:[^=]+=(.*);/)[1];
for (const kind of ['barrier', 'ferris', 'carWash', 'drawbridge', 'towerCrane', 'duskLamp', 'neon', 'ladder']) assert(!front.includes(kind));
function spot(name) {
  const m = city.match(new RegExp(`const ${name} = v\\((-?[\\d.]+), (-?[\\d.]+)\\);`));
  assert(m, name); return [Number(m[1]), 0, Number(m[2])];
}
const lamps = [...city.match(/const LAMPS = \[(.*?)\];/)[1].matchAll(/v\((-?[\d.]+), (-?[\d.]+)\)/g)].map(m => [Number(m[1]), 0, Number(m[2])]);
assert.equal(lamps.length, 3);
const round = n => Math.abs(n) < 0.0000005 ? 0 : Number(n.toFixed(6));
const arr = v => v.toArray().map(round);
const jsonBox = b => b.isEmpty() ? null : ({ min: arr(b.min), max: arr(b.max), size: arr(b.getSize(new THREE.Vector3())) });
const translateBox = (b, p) => b.clone().translate(new THREE.Vector3(...p));
const pointsCache = new WeakMap();
function points(geo) {
  if (!pointsCache.has(geo)) {
    const attr = geo.getAttribute('position');
    const set = new Map();
    for (let i = 0; i < attr.count; i++) { const v = [attr.getX(i), attr.getY(i), attr.getZ(i)]; set.set(v.join(','), v); }
    pointsCache.set(geo, [...set.values()]);
  }
  return pointsCache.get(geo);
}
function solids(node, excluded = []) {
  const result = [];
  function visit(o) {
    if (!o.visible || excluded.includes(o)) return;
    if (o.isMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(m => m.visible && !m.transparent && m.depthWrite)) result.push(o);
    }
    o.children.forEach(visit);
  }
  visit(node); return result;
}
function box(meshes, frame) {
  const b = new THREE.Box3(), v = new THREE.Vector3(), matrix = new THREE.Matrix4();
  const inv = frame ? frame.matrixWorld.clone().invert() : new THREE.Matrix4();
  for (const m of meshes) {
    matrix.multiplyMatrices(inv, m.matrixWorld);
    for (const p of points(m.geometry)) b.expandByPoint(v.set(...p).applyMatrix4(matrix));
  }
  return b;
}
const staticNames = {
  Barrier: ['post', 'beacon'], FerrisWheel: ['leg0', 'leg1', 'leg2', 'leg3'],
  CarWash: ['postLeft', 'postRight', 'beam', 'sign'], Drawbridge: ['tower', 'roof'], TowerCrane: ['mast'],
  DuskLamp: ['pole', 'arm', 'glassHead', 'sensorEye'], NeonSign: ['letter0', 'letter1', 'letter2', 'letter3', 'board', 'legLeft', 'legRight'], FireLadder: ['turntable'],
};
const sampleMeaning = {
  Barrier: 'f=open from 0 to 1; original animate(0)',
  FerrisWheel: 'f=wheel angle/(2*pi), 0..1; s=independent sway phase/(2*pi), 0..1; turnV=1.05, time=s*pi, original animate(0). This explores angle/phase combinations, not a single elapsed-time trajectory.',
  CarWash: 'f=brush rotation/(2*pi), opposite signs for the two brushes; geometry only, no water sprites',
  Drawbridge: 'f=up from 0 to 1; original animate(0)',
  TowerCrane: 'f=cycle from 0 to 1, endpoint 1 wraps to 0; original animate(0)',
  DuskLamp: 'single static pose; light intensity changes do not move solid geometry',
  NeonSign: 'single static pose; light intensity changes do not move solid geometry',
  FireLadder: 'f=reach from 0 to 1; original animate(0)',
};
const specs = [
  ['Barrier', 'BARRIER_SPOT', p => ({ static: [p.body.children[1], p.body.children[2]], moving: [['arm', p.arm]], sample: f => { p.open = f; p.animate(0); }, steps: 1024 })],
  ['FerrisWheel', 'FERRIS_SPOT', p => ({ static: p.body.children.slice(1, 5), moving: [['wheel', p.wheel, p.cabins], ...p.cabins.map((c, i) => [`cabin${i}`, c])], sample: (f, s) => { p.wheel.rotation.z = f * 2 * Math.PI; p.turnV = 1.05; p.time = s * Math.PI; p.animate(0); }, steps: 256, phaseSteps: 16 })],
  ['CarWash', 'WASH_SPOT', p => ({ static: p.body.children.slice(1, 5), moving: p.brushes.map((b, i) => [`brush${i}`, b]), sample: f => p.brushes.forEach((b, i) => { b.rotation.y = (i ? -1 : 1) * f * 2 * Math.PI; }), steps: 1024 })],
  ['Drawbridge', 'BRIDGE_SPOT', p => ({ static: [p.body.children[1], p.body.children[2]], moving: [['span', p.span]], sample: f => { p.up = f; p.animate(0); }, steps: 1024 })],
  ['TowerCrane', 'CRANE_SPOT', p => ({ static: [p.body.children[1]], moving: [['top', p.top], ['cable', p.cable], ['hook', p.hook]], sample: f => { p.cycle = f === 1 ? 0 : f; p.animate(0); }, steps: 2048 })],
  ['DuskLamp', null, p => ({ static: p.body.children.slice(1, 5), moving: [], sample() {}, steps: 0, anchors: { head: [.45, 2.21, -.2], sensor: [0, 1.56, -.12], halo: [.45, 2.21, -.2] } })],
  ['NeonSign', 'NEON_SPOT', p => ({ static: [...p.body.children.slice(0, 4), ...p.body.children.slice(5, 8)], moving: [], sample() {}, steps: 0, anchors: { glowLightInRoot: [0, 1.21, 0], ...Object.fromEntries(p.body.children.slice(0, 4).map((c, i) => [`letter${i}`, arr(c.position)])) } })],
  ['FireLadder', 'LADDER_SPOT', p => ({ static: [p.body.children[1]], moving: [['boom', p.boom, [p.outer]], ['outer', p.outer]], sample: f => { p.reach = f; p.animate(0); }, steps: 1024 })],
];
const devices = [];
for (const [name, placement, configure] of specs) {
  const random = Math.random; Math.random = () => .125;
  let p; try { p = new constructors[name](); } finally { Math.random = random; }
  p.root.updateMatrixWorld(true);
  const all = solids(p.body);
  const constructorBounds = box(all);
  p.state.level = 0; p.time = 0; p.animate(0); p.root.updateMatrixWorld(true);
  const config = configure(p);
  const plates = [];
  p.body.traverse(o => { if (o.userData.plate) plates.push(o); });
  assert.equal(plates.length, 1);
  const art = all.filter(o => !plates.includes(o) && !p.terminals.some(t => solids(t.post).includes(o)));
  const groups = config.moving.map(([key, node, excluded = []]) => {
    const meshes = solids(node, excluded);
    const parent = node.parent === p.body ? 'body' : config.moving.find(g => g[1] === node.parent)?.[0];
    assert(parent, `${name}.${key} parent`);
    return { key, node, meshes, parent, sweep: new THREE.Box3(), local: box(meshes, node), rest: box(meshes), transform: { translation: arr(node.position), rotationXYZ: [node.rotation.x, node.rotation.y, node.rotation.z].map(round), scale: arr(node.scale) } };
  });
  const staticMeshes = config.static.flatMap(n => solids(n));
  assert.equal(new Set([...staticMeshes, ...groups.flatMap(g => g.meshes)]).size, art.length, `${name}: all art classified`);
  const rest = box(all), restArt = box(art), staticBounds = box(staticMeshes);
  assert.equal(staticMeshes.length, staticNames[name].length);
  const staticMembers = staticMeshes.map((mesh, i) => ({ key: staticNames[name][i], parent: 'body', boundsBody: jsonBox(box([mesh])), translation: arr(mesh.position), rotationXYZ: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(round) }));
  const terminals = p.terminals.map(t => ({ key: t.key, polarity: t.polarity, postBaseBody: arr(t.post.position), attachPointBody: arr(t.attachPoint(new THREE.Vector3())), opaqueBoundsBody: jsonBox(box(solids(t.post))) }));
  const viewDir = new THREE.Vector3(0, 1, .78).normalize();
  const screenUp = new THREE.Vector3(0, viewDir.z, -viewDir.y);
  const ray = new THREE.Raycaster();
  const terminalChecks = terminals.map(t => ({ key: t.key, rayCount: 0, artOccludedRays: 0, examples: [], opaqueAabbOverlapPoses: 0, overlapExamples: [] }));
  const sweep = new THREE.Box3(), artSweep = new THREE.Box3(), poses = [];
  const phaseSteps = config.phaseSteps ?? 0;
  // Static vertices are measured once; every moving vertex is transformed at every sampled pose.
  const fixed = all.filter(m => !groups.some(g => g.meshes.includes(m)));
  const fixedBounds = box(fixed);
  let evaluatedPoses = 0;
  for (let i = 0; i <= config.steps; i++) {
    for (let j = 0; j <= phaseSteps; j++) {
      const f = config.steps ? i / config.steps : 0, s = phaseSteps ? j / phaseSteps : 0;
      config.sample(f, s); p.root.updateMatrixWorld(true);
      const a = staticBounds.clone(), b = fixedBounds.clone();
      for (const g of groups) { const measured = box(g.meshes); g.sweep.union(measured); a.union(measured); b.union(measured); }
      sweep.union(b); artSweep.union(a); evaluatedPoses++;
      if (j === 0 && [0, .25, .5, .75, 1].includes(f)) poses.push({ parameter: f, solidsBody: jsonBox(b), moving: Object.fromEntries(groups.map(g => [g.key, { boundsBody: jsonBox(box(g.meshes)), translation: arr(g.node.position), rotationXYZ: [g.node.rotation.x, g.node.rotation.y, g.node.rotation.z].map(round) }])) });
      // Small, declared diagnostic set: 5 states x 5 points per terminal, central camera direction only.
      if (j === 0 && [0, .25, .5, .75, 1].includes(f)) {
        for (let t = 0; t < terminals.length; t++) {
          const check = terminalChecks[t], attach = new THREE.Vector3(...terminals[t].attachPointBody);
          const probeOffsets = [[0, 0], [.08, 0], [-.08, 0], [0, .08], [0, -.08]];
          for (const [dx, dy] of probeOffsets) {
            const target = attach.clone().add(new THREE.Vector3(dx, 0, 0)).addScaledVector(screenUp, dy);
            ray.set(target.clone().addScaledVector(viewDir, 20), viewDir.clone().negate()); ray.far = 20 - 1e-5;
            const hits = ray.intersectObjects(art, false);
            check.rayCount++;
            if (hits.length) { check.artOccludedRays++; if (check.examples.length < 4) check.examples.push({ parameter: f, offset: [dx, dy], hitBody: arr(hits[0].point) }); }
          }
          const pb = new THREE.Box3(new THREE.Vector3(...terminals[t].opaqueBoundsBody.min), new THREE.Vector3(...terminals[t].opaqueBoundsBody.max));
          const overlaps = art.filter(m => box([m]).intersectsBox(pb));
          if (overlaps.length) { check.opaqueAabbOverlapPoses++; if (check.overlapExamples.length < 4) check.overlapExamples.push({ parameter: f, meshCount: overlaps.length }); }
        }
      }
    }
  }
  const placements = placement ? [spot(placement)] : lamps;
  devices.push({
    kind: p.kind, class: name, elementKind: p.elementKind, electricalOverride: p.electrical(), layoutRadius: p.radius,
    measuredOpaqueMeshes: all.length, evaluatedPoses,
    constructorSolidsBody: jsonBox(constructorBounds), restSolidsBody: jsonBox(rest), restArtBody: jsonBox(restArt), staticArtBody: jsonBox(staticBounds), staticMembers,
    plateOpaqueBoundsBody: jsonBox(box(plates)), sampledSweepSolidsBody: jsonBox(sweep), sampledSweepArtBody: jsonBox(artSweep),
    sampling: { parameterSteps: config.steps, phaseSteps, meaning: sampleMeaning[name], continuousGuarantee: false, note: 'Exact transformed geometry vertices at sampled poses; union is NOT a guaranteed continuous swept envelope. Generic Part.update bounce/drag/shake is excluded.' },
    groups: groups.map(g => ({ key: g.key, parent: g.parent, meshCount: g.meshes.length, restTransformInParent: g.transform, geometryBoundsInOwnFrame: jsonBox(g.local), restBoundsBody: jsonBox(g.rest), sampledSweepBoundsBody: jsonBox(g.sweep) })),
    anchorsBody: config.anchors ?? {}, terminals, poses,
    terminalDiagnostics: { method: 'Five points around each attachPoint, parallel rays along negative VIEW_DIR from 20 units toward the body, sampled at 0/.25/.5/.75/1 (one state for static devices). Own opaque art only; excludes terminal itself, plate, wires and scene. Not a perspective screenshot, touch test, or visibility guarantee.', cameraDirection: arr(viewDir), checks: terminalChecks, overlapMeaning: 'Per-mesh AABB overlap is only a broad-phase warning, NOT proof of triangle intersection.' },
    canonicalPlacements: placements.map(position => ({ position, yawRadians: 0, scale: [1, 1, 1], restSolidsWorld: jsonBox(translateBox(rest, position)), sampledSweepSolidsWorld: jsonBox(translateBox(sweep, position)), terminals: terminals.map(t => ({ key: t.key, attachPointWorld: t.attachPointBody.map((v, i) => round(v + position[i])) })), groupRestPivotsWorld: Object.fromEntries(groups.map(g => { const parent = g.node.parent; const v = new THREE.Vector3(...g.transform.translation); if (parent !== p.body) { const parentG = groups.find(x => x.node === parent); v.add(new THREE.Vector3(...parentG.transform.translation)); } return [g.key, v.toArray().map((x, i) => round(x + position[i]))]; })) })),
  });
  console.log(`${p.kind}: ${evaluatedPoses} poses, sweep ${JSON.stringify(jsonBox(sweep))}`);
}
const output = {
  schemaVersion: 1, sourceRevision: revision,
  method: 'Real pinned Three.js constructors, paint-only canvas stubs, original animate(0) for prescribed states; CPU mesh vertex bounds. No WebGL/render/game test.',
  coordinateFrame: { unit: 'game world unit; no physical metre claim', up: '+Y', boardPlane: 'XZ', root: 'identity except canonical translation; body identity' },
  runtime: { node: process.version, threeRevision: THREE.REVISION, rolldown: rolldownVersion, canvasCount },
  sources: [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha(bytes) })),
  exclusions: ['Contact shadows', 'Text decals', 'Invisible terminal highlight rings', 'Billboard sprites / glow / water', 'Part.update scale spring, lift, hop and shake', 'Wires, scenery, cars, boat and cat', 'Raster visibility / touch targets / collisions'],
  devices,
};
writeFileSync(resolve(here, 'measurements.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote measurements.json (${devices.length} devices).`);
