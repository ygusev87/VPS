// Read-only geometry proposal. Does not run a layout builder or modify runtime data.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Box3, Matrix4, Vector3 } from 'three';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const read = p => fs.readFile(path.join(root, p));
const sha = b => createHash('sha256').update(b).digest('hex');
const layoutBytes = await read('assets-src/farm-v3/decor-layout.json');
const layout = JSON.parse(layoutBytes);
const author = JSON.parse(await read('assets-src/farm-v3/decor-authoring.json'));
const runtime = await import(path.join(root,'src/farm-decor.ts'));
for (const key of Object.keys(layout)) if(JSON.stringify(runtime[key])!==JSON.stringify(layout[key])) throw Error('Runtime/layout mismatch: '+key);
const moves = [
  { model: 'flower-cluster', from: [-47,-22,1.629,1.1], to: [-42.6,-20,1.629,1.1] },
  { model: 'flower-cluster', from: [-45,-22,2.426,1.1], to: [-41.1,-19.7,2.426,1.1] },
  { model: 'haystack', from: [49.5,26.5,-0.4,0.75], to: [49,-5,-0.4,0.75] },
];
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const geometries = new Map(), hashes = {};
for (const name of new Set(layout.DECOR.map(g => g.model))) {
  const file = path.join(root, 'public/models', name + '.glb');
  hashes[name] = sha(await fs.readFile(file));
  const doc = await io.read(file);
  await doc.transform(dequantize());
  const corners = [];
  let triangles = 0;
  for (const n of doc.getRoot().listNodes()) for (const p of n.getMesh()?.listPrimitives() ?? []) {
    const a = p.getAttribute('POSITION');
    const b = new Box3();
    for (let i=0; i<a.getCount(); i++) b.expandByPoint(new Vector3(...a.getElement(i, [])));
    const world = new Matrix4().fromArray(n.getWorldMatrix());
    for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z]) corners.push(new Vector3(x,y,z).applyMatrix4(world));
    triangles += (p.getIndices()?.getCount() ?? a.getCount()) / 3;
  }
  geometries.set(name,{corners,triangles});
}
function fitBox(g) {
  const yaw = new Matrix4().makeRotationY(g.fit.rotateY ?? 0);
  const points = geometries.get(g.model).corners.map(v => v.clone().applyMatrix4(yaw));
  const b = new Box3().setFromPoints(points), size = b.getSize(new Vector3()), c = b.getCenter(new Vector3());
  const s = g.fit.width ? g.fit.width/size.x : g.fit.depth ? g.fit.depth/size.z : g.fit.height ? g.fit.height/size.y : 1;
  return points.map(v => v.sub(new Vector3(c.x,b.min.y,c.z)).multiplyScalar(s));
}
const same = (a,b) => a.every((n,i)=>n===b[i]);
const items = layout.DECOR.flatMap((g,groupIndex) => {
  const base = fitBox(g);
  return g.items.map((p,index) => {
    const move = moves.find(m => m.model===g.model && same(m.from,p));
    const q = move?.to ?? p;
    const yaw = new Matrix4().makeRotationY(q[2]);
    const points = base.map(v=>v.clone().multiplyScalar(q[3]).applyMatrix4(yaw).add(new Vector3(q[0],0,q[1])));
    const b = new Box3().setFromPoints(points);
    const radius = Math.max(...points.map(v=>Math.hypot(v.x-q[0],v.z-q[1])));
    return { id:g.model+':'+groupIndex+':'+index, model:g.model, original:p, placement:q, box:b, radius, move, fit:g.fit };
  });
});
const segment = (p,a,b) => {
  const dx=b[0]-a[0], dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz || 1)));
  return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);
};
const rectDistance = (p,b) => Math.hypot(Math.max(b.min.x-p[0],0,p[0]-b.max.x),Math.max(b.min.z-p[1],0,p[1]-b.max.z));
const lines = a => a.flatMap((line,i)=>line.slice(1).map((b,j)=>({id:i+':'+j,a:line[j],b})));
const nearest = a => a.sort((a,b)=>a.gap-b.gap)[0];
const paths=layout.PATHS.flatMap((p,i)=>lines([p.points]).map(l=>({...l,id:'path'+i+':'+l.id,width:p.width})));
const fences=lines(layout.FENCES);
// Conservative static checks, not a replacement for live dress() filtering or screen-space terminal visibility.
const travel=[author.travel[0],[[-23,-8],[-8,-8]],[[30,12],[30,20.5]],Array.from({length:25},(_,i)=>[29+Math.cos(i/24*Math.PI*2)*4.2,26.5+Math.sin(i/24*Math.PI*2)*6])];
const results=items.filter(v=>v.move).map(v=>{
  const p=[v.placement[0],v.placement[1]], b=v.box;
  const radius=v.radius;
  const others=items.filter(o=>o!==v);
  const groupSize=v.fit.width??v.fit.depth??(v.fit.height??1)*0.8;
  const keepRadius=1.6+groupSize*v.placement[3]/2;
  return {
    id:v.id, ...v.move, height:b.max.y-b.min.y, conservativeRadius:radius,
    bounds:{min:b.min.toArray(),max:b.max.toArray()},
    nearest:{
      road:nearest(paths.map(l=>({id:l.id,gap:segment(p,l.a,l.b)-l.width/2-radius}))),
      fence:nearest(fences.map(l=>({id:l.id,gap:segment(p,l.a,l.b)-0.08-radius}))),
      building:nearest(others.filter(o=>['barn','coop','stable','doghouse','hutch','farmhouse','silo','pigsty','tractor-shed'].includes(o.model)).map(o=>({id:o.id,gap:rectDistance(p,o.box)-radius}))),
      decor:nearest(others.map(o=>({id:o.id,gap:rectDistance(p,o.box)-radius}))),
      workPad:nearest(author.tasks.map(t=>({id:t.id,gap:rectDistance(p,{min:{x:t.workingPatch.center[0]-t.workingPatch.size[0]/2,z:t.workingPatch.center[1]-t.workingPatch.size[1]/2},max:{x:t.workingPatch.center[0]+t.workingPatch.size[0]/2,z:t.workingPatch.center[1]+t.workingPatch.size[1]/2}})-radius}))),
      poleReservedDisk:nearest(author.tasks.map(t=>({id:t.id,gap:Math.hypot(p[0]-t.pole[0],p[1]-t.pole[1])-1.4-radius}))),
      toyReservedDisk:nearest(author.toys.map((t,i)=>({id:i,gap:Math.hypot(p[0]-t[0],p[1]-t[1])-1.15-radius}))),
      travelReservedStrip:nearest(lines(travel).map(l=>({id:l.id,gap:segment(p,l.a,l.b)-1.1-radius}))),
      knownRuntimeKeep:nearest([...author.tasks.map(t=>t.workingPatch.center),...author.tasks.map(t=>t.pole),...author.toys,[-30,-6.5]].map((t,i)=>({id:i,gap:Math.hypot(p[0]-t[0],p[1]-t[1])-keepRadius}))),
    },
    boardEdge:Math.min(55-Math.abs(p[0]),37.5-Math.abs(p[1]))-radius,
  };
});
if(results.length!==moves.length) throw Error('Original placements changed; re-review proposal.');
const report={
  revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  inputs:{layoutSha256:sha(layoutBytes),models:hashes},
  scope:'Proposal only: measured decoded GLB mesh-box corners, fit then instance yaw/scale. Conservative circles against road/fence/pad/prop bounds. No runtime changes, no live collision/occlusion/FPS claim.',
  budget:{authoredInstancesBefore:items.length,authoredInstancesAfter:items.length,newAssetBytes:0,additionalTriangles:0,additionalBatches:0,note:'Authoring budget only; dynamic culling and shadows can change rendered cost after relocation.'},
  results,
};
await fs.writeFile(path.join(dir,'detail-audit.json'),JSON.stringify(report,(_k,v)=>typeof v==='number'?Math.round(v*1e5)/1e5:v,2)+'\n');
console.log(JSON.stringify({budget:report.budget,results},null,2));
if(results.some(r=>r.boardEdge<0||Object.values(r.nearest).some(n=>n.gap<0))) process.exitCode=1;
