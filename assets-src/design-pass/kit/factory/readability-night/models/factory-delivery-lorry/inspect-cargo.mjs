import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as T from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../../..');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(path.join(dir,'candidate/articulated.glb')),triangles=[];
for(const n of doc.getRoot().listNodes())if(n.getMesh()){
 const m=new T.Matrix4().fromArray(n.getWorldMatrix());
 for(const p of n.getMesh().listPrimitives()){
  const pos=p.getAttribute('POSITION'),idx=p.getIndices().getArray(),points=Array.from({length:pos.getCount()},(_,i)=>new T.Vector3(...pos.getElement(i,[])).applyMatrix4(m));
  for(let i=0;i<idx.length;i+=3)triangles.push([points[idx[i]],points[idx[i+1]],points[idx[i+2]]]);
 }
}
const hit=new T.Vector3();
function topAt(x,z){const ray=new T.Ray(new T.Vector3(x,3,z),new T.Vector3(0,-1,0));let top=null;for(const t of triangles)if(ray.intersectTriangle(...t,false,hit))top=top===null?hit.y:Math.max(top,hit.y);return top;}
const xs=Array.from({length:15},(_,i)=>-.7+i*.1),zs=Array.from({length:25},(_,i)=>-2+i*.1),rows=zs.map(z=>({z,ys:xs.map(x=>topAt(x,z))}));
const values=rows.flatMap(r=>r.ys),deckMin=Math.min(...values),deckMax=Math.max(...values),freeBox=new T.Box3(new T.Vector3(-.7,deckMax+.005,-2),new T.Vector3(.7,deckMax+.8,.4));
const intersections=triangles.flatMap((t,i)=>freeBox.intersectsTriangle(new T.Triangle(...t))?[i]:[]);
const anchors=[-1.6,-.8,0].map(z=>{const heights=[];for(let ix=0;ix<=7;ix++)for(let iz=0;iz<=7;iz++)heights.push(topAt(-.35+ix*.1,z-.35+iz*.1));const bottom=Math.max(...heights),box=new T.Box3(new T.Vector3(-.35,bottom+.001,z-.35),new T.Vector3(.35,bottom+.65,z+.35));return{x:0,z,bottom,supportHeightRange:[Math.min(...heights),bottom],size:[.7,.65,.7],intersectingTriangles:triangles.flatMap((t,i)=>box.intersectsTriangle(new T.Triangle(...t))?[i]:[])};});
const report={name:'factory-delivery-lorry',source:'final articulated GLB',deckSamples:values.length,deckMin,deckMax,deckVariation:deckMax-deckMin,freeBox:{min:freeBox.min.toArray(),max:freeBox.max.toArray()},intersectingTriangles:intersections,anchors,rows,pass:values.every(v=>v!==null)&&deckMax-deckMin<.05&&intersections.length===0&&anchors.every(a=>a.intersectingTriangles.length===0)};
await fs.writeFile(path.join(dir,'cargo.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined}));if(!report.pass)process.exitCode=1;
