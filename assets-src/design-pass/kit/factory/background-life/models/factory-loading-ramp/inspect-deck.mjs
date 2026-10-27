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
const doc=await io.read(path.join(repo,'public/models/factory-loading-ramp.glb')),triangles=[];
for(const n of doc.getRoot().listNodes())if(n.getMesh()){
 const m=new T.Matrix4().fromArray(n.getWorldMatrix());
 for(const p of n.getMesh().listPrimitives()){
  const pos=p.getAttribute('POSITION'),idx=p.getIndices().getArray(),points=Array.from({length:pos.getCount()},(_,i)=>new T.Vector3(...pos.getElement(i,[])).applyMatrix4(m));
  for(let i=0;i<idx.length;i+=3)triangles.push([points[idx[i]],points[idx[i+1]],points[idx[i+2]]]);
 }
}
const hit=new T.Vector3();
function topAt(x,z){const ray=new T.Ray(new T.Vector3(x,3,z),new T.Vector3(0,-1,0));let top=null;for(const t of triangles)if(ray.intersectTriangle(...t,false,hit))top=top===null?hit.y:Math.max(top,hit.y);return top;}
const xs=[-.7,-.35,0,.35,.7],zs=Array.from({length:36},(_,i)=>1.75-i*.1),rows=zs.map(z=>({z,ys:xs.map(x=>topAt(x,z))}));
let maxDownStep=0,maxUpStep=0,maxCrossfall=0;
for(let i=1;i<rows.length;i++)for(let j=0;j<xs.length;j++){const delta=rows[i].ys[j]-rows[i-1].ys[j];maxDownStep=Math.max(maxDownStep,-delta);maxUpStep=Math.max(maxUpStep,delta);}
for(const row of rows)maxCrossfall=Math.max(maxCrossfall,Math.max(...row.ys)-Math.min(...row.ys));
const report={name:'factory-loading-ramp',method:'Topmost downward triangle ray per grid position; measures static decorative surface only, no physics/collision claim.',samples:xs.length*zs.length,xs,rows,clearCentralWidth:1.4,sampledZ:[zs.at(-1),zs[0]],maxDownStep,maxUpStep,maxCrossfall,pass:rows.every(r=>r.ys.every(y=>y!==null))&&maxDownStep<.02&&maxUpStep<.08&&maxCrossfall<.025};
await fs.writeFile(path.join(dir,'deck.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined}));if(!report.pass)process.exitCode=1;
