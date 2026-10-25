// Cut the moulded base plate (with its painted-on sockets) off a generated
// part model, so the body can stand on the game's own plate with real
// terminals. Triangles entirely below `--cut` (a fraction of the model's
// height) go, and so do the small islands the cut leaves behind (socket tops,
// screw heads). `--top` also drops everything above that height (a bulb's
// glass, an LED's dome — the game builds those itself).
// Without `--cut` the plate top is found by itself (the biggest flat area).
//   node scripts/strip-plate.mjs raw.glb assets-src/models/name.glb [--cut 0.16] [--top 0.6] [--keep 0.15]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, prune } from '@gltf-transform/functions';

const [src, out, ...rest] = process.argv.slice(2);
const opt = { cut: 0, top: 1, keep: 0.15, box: null };
for (let i = 0; i < rest.length; i += 2) {
  const k = rest[i].replace(/^--/, '');
  opt[k] = k === 'box' ? rest[i + 1].split(',').map(Number) : Number(rest[i + 1]);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);

for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const n = pos.getCount();
    const P = new Float32Array(n * 3);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = pos.getElement(i, []);
      P.set(v, i * 3);
      lo = Math.min(lo, v[1]);
      hi = Math.max(hi, v[1]);
    }
    const h = (i) => (P[i * 3 + 1] - lo) / (hi - lo);
    const idx = prim.getIndices();
    const tri = idx ? Array.from(idx.getArray()) : Array.from({ length: n }, (_, i) => i);
    if (!opt.cut) {
      // The plate's top is the biggest upward-facing area in the lower half.
      const bins = new Float64Array(120);
      for (let t = 0; t < tri.length; t += 3) {
        const [a, b, c] = [tri[t], tri[t + 1], tri[t + 2]].map((i) => P.subarray(i * 3, i * 3 + 3));
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0];
        const area = Math.hypot(nx, ny, nz);
        if (area === 0 || ny / area < 0.95) continue;
        const f = ((a[1] + b[1] + c[1]) / 3 - lo) / (hi - lo);
        if (f < 0.5) bins[Math.floor(f * 240)] += area;
      }
      let best = 0;
      for (let i = 1; i < bins.length; i++) if (bins[i] > bins[best]) best = i;
      opt.cut = (best + 1) / 240 + (opt.margin ?? 0.012);
      console.log(`plate top at ${(best / 240).toFixed(3)}, cutting at ${opt.cut.toFixed(3)}`);
    }
    // Optional box (x0,x1,z0,z1[,y0,y1] as fractions of the model's extent)
    // whose triangles all go: sticks lying beside a drum, a figurine the game
    // animates itself.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) {
      x0 = Math.min(x0, P[i * 3]); x1 = Math.max(x1, P[i * 3]);
      z0 = Math.min(z0, P[i * 3 + 2]); z1 = Math.max(z1, P[i * 3 + 2]);
    }
    const inBox = (i) => {
      if (!opt.box) return false;
      const fx = (P[i * 3] - x0) / (x1 - x0);
      const fz = (P[i * 3 + 2] - z0) / (z1 - z0);
      const fy = h(i);
      const [bx0, bx1, bz0, bz1, by0 = 0, by1 = 1] = opt.box;
      return fx >= bx0 && fx <= bx1 && fz >= bz0 && fz <= bz1 && fy >= by0 && fy <= by1;
    };
    const kept = [];
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t], b = tri[t + 1], c = tri[t + 2];
      if (Math.max(h(a), h(b), h(c)) < opt.cut) continue;
      if (Math.min(h(a), h(b), h(c)) > opt.top) continue;
      if (inBox(a) && inBox(b) && inBox(c)) continue;
      kept.push(a, b, c);
    }
    // Islands: join vertices that share a position (UV seams split them).
    const key = (i) => `${Math.round(P[i * 3] * 1e4)},${Math.round(P[i * 3 + 1] * 1e4)},${Math.round(P[i * 3 + 2] * 1e4)}`;
    const id = new Map();
    const parent = [];
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const node = (i) => {
      const k = key(i);
      let v = id.get(k);
      if (v === undefined) {
        v = parent.length;
        parent.push(v);
        id.set(k, v);
      }
      return v;
    };
    for (let t = 0; t < kept.length; t += 3) {
      const a = find(node(kept[t])), b = find(node(kept[t + 1])), c = find(node(kept[t + 2]));
      parent[b] = a;
      parent[find(c)] = a;
    }
    const count = new Map();
    for (let t = 0; t < kept.length; t += 3) {
      const r = find(node(kept[t]));
      count.set(r, (count.get(r) ?? 0) + 1);
    }
    // Islands smaller than `keep` × the biggest one (the body) go.
    const biggest = Math.max(...count.values());
    const final = [];
    for (let t = 0; t < kept.length; t += 3) {
      if (count.get(find(node(kept[t]))) >= biggest * opt.keep) final.push(kept[t], kept[t + 1], kept[t + 2]);
    }
    const Arr = n > 65535 ? Uint32Array : Uint16Array;
    const acc = idx ?? doc.createAccessor().setType('SCALAR').setBuffer(pos.getBuffer());
    acc.setArray(new Arr(final));
    prim.setIndices(acc);
    compactPrimitive(prim);
    console.log(`${out}: ${tri.length / 3} → ${final.length / 3} triangles, ${count.size} islands (biggest ${biggest}), height ${(hi - lo).toFixed(3)}`);
  }
}
await doc.transform(prune());
await io.write(out, doc);
