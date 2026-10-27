import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as T from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url));
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const bytes=await fs.readFile(path.join(dir,'articulated-experimental.glb')),doc=await io.readBinary(bytes);
const source=JSON.parse(await fs.readFile(path.join(dir,'articulation-geometry.json'),'utf8'));
for(const part of source)for(const t of part.triangles)for(const p of t.points)if(p[1]<.007)p[1]=0;
const parts={};
for(const n of doc.getRoot().listNodes())if(n.getMesh()){
 const name=n.getName()==='body'?'body':'forks',ref=source.find(p=>p.name===name).triangles;
 const src=ref.map((r,i)=>({...r,i,c:new T.Vector3(...r.points[0]).add(new T.Vector3(...r.points[1])).add(new T.Vector3(...r.points[2])).divideScalar(3)}));
 const ts=[];let maxMatch=0;
 for(const p of n.getMesh().listPrimitives()){
  const pos=p.getAttribute('POSITION'),ix=p.getIndices().getArray(),mat=new T.Matrix4().fromArray(n.getWorldMatrix());
  for(let i=0;i<ix.length;i+=3){const ps=[0,1,2].map(j=>new T.Vector3(...pos.getElement(ix[i+j],[])).applyMatrix4(mat)),c=ps[0].clone().add(ps[1]).add(ps[2]).divideScalar(3);let best=null,dist=Infinity;
   for(const r of src){const d=c.distanceToSquared(r.c);if(d<dist){dist=d;best=r;}}
   maxMatch=Math.max(maxMatch,Math.sqrt(dist));ts.push({ps,sourceId:best.i,label:best.label,cap:best.cap,box:new T.Box3().setFromPoints(ps)});
  }
 }
 if(maxMatch>.0001)throw Error('Decoded correspondence mismatch '+maxMatch);
 const edges=new Map();let degenerate=0;
 for(const t of ts){if(new T.Triangle(...t.ps).getArea()<1e-10)degenerate++;const keys=t.ps.map(p=>p.toArray().map(v=>v.toFixed(6)).join(','));for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],key=[a,b].sort().join('|');if(!edges.has(key))edges.set(key,[]);edges.get(key).push(a<b?1:-1);}}
 parts[name]={ts,topology:{triangles:ts.length,nonManifoldEdges:[...edges.values()].filter(v=>v.length!==2).length,nonManifoldDetails:[...edges].filter(([k,v])=>v.length!==2),inconsistentEdges:[...edges.values()].filter(v=>v.reduce((a,b)=>a+b,0)!==0).length,degenerateTriangles:degenerate,maxSourceMatchError:maxMatch}};
}
const edge=ps=>[ps[1].clone().sub(ps[0]),ps[2].clone().sub(ps[1]),ps[0].clone().sub(ps[2])];
// Continuous separating-axis interval for rigid translation along Y.
// Additional in-plane axes cover coplanar triangle cases.
function swept(a,b,lo=.001,hi=.65){
 const ea=edge(a),eb=edge(b),na=new T.Vector3().crossVectors(ea[0],ea[1]),nb=new T.Vector3().crossVectors(eb[0],eb[1]);
 const axes=[na,nb,...ea.flatMap(x=>eb.map(y=>new T.Vector3().crossVectors(x,y))),...ea.map(e=>new T.Vector3().crossVectors(na,e)),...eb.map(e=>new T.Vector3().crossVectors(nb,e))];
 for(const axis of axes){if(axis.lengthSq()<1e-18)continue;axis.normalize();const ap=a.map(p=>p.dot(axis)),bp=b.map(p=>p.dot(axis)),amin=Math.min(...ap),amax=Math.max(...ap),bmin=Math.min(...bp),bmax=Math.max(...bp),speed=axis.y,eps=1e-7;
  if(Math.abs(speed)<1e-10){if(amax<bmin-eps||bmax<amin-eps)return null;continue;}
  let t0=(bmin-amax-eps)/speed,t1=(bmax-amin+eps)/speed;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return null;
 }
 return [lo,hi];
}
const contacts=[];
for(const a of parts.forks.ts){const bb=a.box.clone();bb.max.y+=.65;for(const b of parts.body.ts){if(!bb.intersectsBox(b.box))continue;const interval=swept(a.ps,b.ps);if(interval)contacts.push({movingSourceId:a.sourceId,movingLabel:a.label,movingCap:a.cap,fixedSourceId:b.sourceId,fixedLabel:b.label,fixedCap:b.cap,travelInterval:interval,fixedBounds:{min:b.box.min.toArray(),max:b.box.max.toArray()}});}}
const groups={};for(const c of contacts){const k=`${c.movingCap?'cap':c.movingLabel} -> ${c.fixedCap?'cap':c.fixedLabel}`;groups[k]=(groups[k]||0)+1;}
const topology=Object.fromEntries(Object.entries(parts).map(([n,p])=>[n,p.topology]));
// Independent containment witness: sample carriage vertices/triangle centres.
// An interior point at positive nearest-surface distance proves volume overlap.
const samples=new Map();for(const t of parts.forks.ts){for(const v of [...t.ps,t.ps[0].clone().add(t.ps[1]).add(t.ps[2]).divideScalar(3)])samples.set(v.toArray().map(x=>x.toFixed(6)).join(),v);}
const direction=new T.Vector3(.9301,.3123,.1937).normalize(),tmp=new T.Vector3(),closest=new T.Vector3(),penetration=[];
for(const lift of [.001,.05,.1,.2,.3,.4,.5,.65]){
 let count=0,deepest=null;
 for(const v of samples.values()){
  const q=v.clone().add(new T.Vector3(0,lift,0)),ray=new T.Ray(q,direction),hits=[];
  for(const t of parts.body.ts)if(ray.intersectTriangle(...t.ps,false,tmp)){const dist=tmp.distanceTo(q);if(dist>1e-7)hits.push(dist);}
  hits.sort((a,b)=>a-b);const distinct=hits.filter((d,i)=>i===0||d-hits[i-1]>1e-6);
  if(distinct.length%2!==1)continue;
  let nearest=Infinity;
  for(const t of parts.body.ts){new T.Triangle(...t.ps).closestPointToPoint(q,closest);nearest=Math.min(nearest,closest.distanceTo(q));}
  if(nearest<=.0001)continue;count++;
  if(!deepest||nearest>deepest.depth)deepest={depth:nearest,worldPoint:q.toArray(),restPoint:v.toArray()};
 }
 penetration.push({lift,samplesInside:count,deepest});
}
const result={createdAt:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),method:'Decoded final Meshopt experimental GLB, welded edge topology. Continuous triangle/triangle separating-axis time intervals for forks translation Y +0.001…+0.65; no temporal sampling. Counts include rail/bearing surface contacts and crossings; no unreviewed exclusions.',topology,requestedTravel:[0,.65],checkedTravel:[.001,.65],contactPairs:contacts.length,groups,contacts,penetration,acceptedTravel:null,status:Object.values(topology).some(t=>t.nonManifoldEdges||t.inconsistentEdges)?'REJECTED_NONMANIFOLD_CAPS':contacts.length?'CLOSED_GEOMETRY_BUT_MOTION_CONTACTS_REQUIRE_REVIEW':'CLOSED_GEOMETRY_NO_SURFACE_CONTACTS',limits:'Containment witnesses are sampled, not an all-volume proof; continuous SAT covers triangle surfaces. External pallet/full-map routes not certified. Rail/bearing penetrations are not accepted.'};
await fs.writeFile(path.join(dir,'motion-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({topology,status:result.status,contactPairs:contacts.length,groups,penetration}));
