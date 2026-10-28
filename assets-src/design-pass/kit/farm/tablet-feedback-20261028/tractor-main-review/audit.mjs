import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import * as T from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url)), delivery=path.resolve(dir,'../tractor-retopology-20261028');
const project=path.resolve(dir,'../../../../../..');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const hash=b=>createHash('sha256').update(b).digest('hex');
const originalBin=await fs.readFile(path.join(delivery,'originals/tractor.glb')),candidateBin=await fs.readFile(path.join(delivery,'candidate/tractor.glb'));
const source=await io.readBinary(originalBin),candidate=await io.readBinary(candidateBin);
const manifest=JSON.parse(await fs.readFile(path.join(delivery,'manifest.json'))),mask=JSON.parse(await fs.readFile(path.join(delivery,'change-mask.json')));
assert.equal(hash(candidateBin),manifest.candidateSha256);assert.equal(hash(originalBin),manifest.sourceSha256);
assert.equal(hash(await fs.readFile(path.join(project,'public/models/tractor.glb'))),hash(originalBin));
const cyclicKey=items=>[items,items.slice(1).concat(items[0]),items.slice(2).concat(items.slice(0,2))].map(a=>a.join('|')).sort()[0];
function decode(doc){
 const out=[];
 for(const n of doc.getRoot().listNodes())for(const p of n.getMesh()?.listPrimitives()||[]){
  const pos=p.getAttribute('POSITION'),m=new T.Matrix4().fromArray(n.getWorldMatrix()),ids=p.getIndices().getArray(),vertices=[];
  for(let i=0;i<pos.getCount();i++)vertices.push(new T.Vector3(...pos.getElement(i,[])).applyMatrix4(m).toArray());
  const sig=i=>p.listSemantics().sort().map(s=>{const a=p.getAttribute(s),z=a.getElementSize();return s+':'+Array.from(a.getArray().slice(i*z,(i+1)*z)).join(',')}).join(';');
  const triangles=[];for(let i=0;i<ids.length;i+=3){const face=Array.from(ids.slice(i,i+3));triangles.push({p:face.map(j=>vertices[j]),signature:cyclicKey(face.map(sig))});}
  out.push({name:n.getName(),node:n,triangles,vertices});
 }return out;
}
const srcParts=decode(source),parts=decode(candidate),src=srcParts[0];assert.equal(srcParts.length,1);assert.equal(parts.length,5);
const retained=new Map();for(const p of parts)for(const t of p.triangles)retained.set(t.signature,(retained.get(t.signature)||0)+1);
const changed=new Set(mask.changedSourceTriangleIds);let exactOriginalFaces=0;
for(let i=0;i<src.triangles.length;i++)if(!changed.has(i)){const k=src.triangles[i].signature;assert(retained.get(k)>0,'unchanged source face '+i);retained.set(k,retained.get(k)-1);exactOriginalFaces++;}
assert.equal(exactOriginalFaces,11382);
const key=p=>p.map(x=>Math.round(x/1e-7)).join(',');
function topology(part){
 const edges=new Map(),fans=new Map(),adj=part.triangles.map(()=>new Set());let minArea=Infinity,volume=0;
 for(let i=0;i<part.triangles.length;i++){
  const ps=part.triangles[i].p,ks=ps.map(key);assert.equal(new Set(ks).size,3);
  const [a,b,c]=ps.map(p=>new T.Vector3(...p));minArea=Math.min(minArea,b.clone().sub(a).cross(c.clone().sub(a)).length()/2);volume+=a.dot(b.clone().cross(c))/6;
  for(let j=0;j<3;j++){
   const a=ks[j],b=ks[(j+1)%3],k=[a,b].sort().join('|');if(!edges.has(k))edges.set(k,[]);edges.get(k).push({a,b,i});
   if(!fans.has(a))fans.set(a,[]);fans.get(a).push([ks[(j+1)%3],ks[(j+2)%3]]);
  }
 }
 let open=0,nonManifold=0,inconsistent=0;for(const es of edges.values()){
  if(es.length===1)open++;if(es.length>2)nonManifold++;if(es.length===2&&es[0].a===es[1].a)inconsistent++;
  for(const a of es)for(const b of es)if(a.i!==b.i)adj[a.i].add(b.i);
 }
 let badVertexFans=0;for(const list of fans.values()){
  const graph=new Map();for(const [a,b]of list){if(!graph.has(a))graph.set(a,[]);if(!graph.has(b))graph.set(b,[]);graph.get(a).push(b);graph.get(b).push(a);}
  const seen=new Set(),stack=[[...graph.keys()][0]];while(stack.length){const a=stack.pop();if(seen.has(a))continue;seen.add(a);stack.push(...graph.get(a));}
  if(seen.size!==graph.size||[...graph.values()].some(v=>v.length!==2))badVertexFans++;
 }
 let components=0;const seen=new Set();for(let i=0;i<adj.length;i++){if(seen.has(i))continue;components++;const stack=[i];while(stack.length){const v=stack.pop();if(seen.has(v))continue;seen.add(v);stack.push(...adj[v]);}}
 return {triangles:part.triangles.length,openEdges:open,nonManifoldEdges:nonManifold,inconsistentEdges:inconsistent,badVertexFans,components,minArea,signedVolume:volume,nonManifoldDetails:[...edges].filter(([,es])=>es.length>2).map(([key,es])=>({key,incidence:es.length}))};
}
function bounds(parts){const b=new T.Box3();for(const p of parts)for(const v of p.vertices)b.expandByPoint(new T.Vector3(...v));return {min:b.min.toArray(),max:b.max.toArray()};}
const before=bounds(srcParts),after=bounds(parts),boundsError=Math.max(...['min','max'].flatMap(k=>before[k].map((v,i)=>Math.abs(v-after[k][i]))));assert(boundsError<1e-12);
const oldRoot=src.node,newRoot=parts.find(p=>p.name==='tractor-body').node.getParentNode();
for(const getter of ['getTranslation','getScale','getRotation'])assert.deepEqual(oldRoot[getter](),newRoot[getter]());
const oldMat=source.getRoot().listMaterials()[0],mats=candidate.getRoot().listMaterials();assert.equal(mats.length,1);
const textureHashes=[];for(const getter of ['getBaseColorTexture','getNormalTexture','getMetallicRoughnessTexture','getOcclusionTexture']){
 const a=oldMat[getter](),b=mats[0][getter]();assert.equal(Boolean(a),Boolean(b));if(a){assert.equal(hash(a.getImage()),hash(b.getImage()));textureHashes.push({slot:getter,sha256:hash(b.getImage())});}
}
for(const getter of ['getBaseColorFactor','getAlphaMode','getAlphaCutoff','getDoubleSided','getMetallicFactor','getRoughnessFactor','getNormalScale','getOcclusionStrength','getEmissiveFactor'])assert.deepEqual(oldMat[getter](),mats[0][getter]());
// Clip actual triangles at both slab planes, retaining edge-intersection vertices.
function clip(points,lo,hi){let poly=points;for(const [bound,sign]of [[lo,1],[hi,-1]]){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[0]-bound)*sign,db=(b[0]-bound)*sign;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const f=da/(da-db);out.push(a.map((x,j)=>x+f*(b[j]-x)));}}poly=out;}return poly;}
function radialMin(poly,c){
 const p=poly.map(v=>[v[1]-c[1],v[2]-c[2]]);let d=Infinity,area=0;const signs=[];
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],vx=b[0]-a[0],vy=b[1]-a[1],den=vx*vx+vy*vy,t=den?Math.max(0,Math.min(1,-(a[0]*vx+a[1]*vy)/den)):0;d=Math.min(d,Math.hypot(a[0]+t*vx,a[1]+t*vy));const s=a[0]*b[1]-a[1]*b[0];area+=s;signs.push(s);}
 if(Math.abs(area)>1e-18&&(signs.every(s=>s>=-1e-16)||signs.every(s=>s<=1e-16)))return 0;return d;
}
const body=parts.find(p=>p.name==='tractor-body'),bodyTopo=topology(body),bodyTris=body.triangles.map(t=>({...t,lo:Math.min(...t.p.map(p=>p[0])),hi:Math.max(...t.p.map(p=>p[0]))}));
const sourceTopology=topology(src);for(const edge of bodyTopo.nonManifoldDetails)assert(sourceTopology.nonManifoldDetails.some(e=>e.key===edge.key&&e.incidence===edge.incidence));
const bodyMatrix=body.node.getWorldMatrix(),wheelNodes=candidate.getRoot().listNodes().filter(n=>n.getName().startsWith('wheel-'));assert.equal(wheelNodes.length,4);
const checks=[];
for(const w of wheelNodes){
 const part=parts.find(p=>p.node.getParentNode()===w),topo=topology(part);for(const k of ['openEdges','nonManifoldEdges','inconsistentEdges','badVertexFans'])assert.equal(topo[k],0,w.getName()+' '+k);assert.equal(topo.components,1);assert(topo.minArea>0&&topo.signedVolume>0);
 assert.equal(w.getParentNode(),newRoot);assert.deepEqual(w.getRotation(),[0,0,0,1]);assert.deepEqual(w.getScale(),[1,1,1]);
 const c=new T.Vector3().applyMatrix4(new T.Matrix4().fromArray(w.getWorldMatrix())).toArray(),lo=Math.min(...part.vertices.map(p=>p[0])),hi=Math.max(...part.vertices.map(p=>p[0])),radius=Math.max(...part.vertices.map(p=>Math.hypot(p[1]-c[1],p[2]-c[2])));
 const claimed=manifest.wheels.find(x=>x.name===w.getName());assert(Math.max(...c.map((v,i)=>Math.abs(v-claimed.pivotRaw[i])))<1e-12);assert(Math.abs(radius-claimed.radiusRaw)<1e-12);
 for(const degrees of [0,45,90,180,360]){w.setRotation(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),degrees*Math.PI/180).toArray());assert.deepEqual(body.node.getWorldMatrix(),bodyMatrix);}w.setRotation([0,0,0,1]);
 const tris=part.triangles.map(t=>({...t,lo:Math.min(...t.p.map(p=>p[0])),hi:Math.max(...t.p.map(p=>p[0]))})),n=Math.ceil((hi-lo)/.00075);let worst={gap:Infinity};
 for(let i=0;i<n;i++){const x0=lo+(hi-lo)*i/n,x1=lo+(hi-lo)*(i+1)/n;let r=0,b=Infinity;
  for(const t of tris)if(t.hi>=x0&&t.lo<=x1)for(const p of clip(t.p,x0,x1))r=Math.max(r,Math.hypot(p[1]-c[1],p[2]-c[2]));
  for(const t of bodyTris)if(t.hi>=x0&&t.lo<=x1){const poly=clip(t.p,x0,x1);if(poly.length)b=Math.min(b,radialMin(poly,c));}
  if(b-r<worst.gap)worst={gap:b-r,x:[x0,x1],wheelRadius:r,bodyRadius:b};
 }assert(worst.gap>0,w.getName()+' body clearance');
 const phaseFloor=[0,45,90,180,270].map(degrees=>{const a=degrees*Math.PI/180;return {degrees,minY:3.8*(Math.min(...part.vertices.map(p=>c[1]+Math.cos(a)*(p[1]-c[1])-Math.sin(a)*(p[2]-c[2])))-before.min[1])};});
 checks.push({name:w.getName(),topology:topo,pivotRaw:c,pivotInSourceNode:w.getTranslation(),radiusRaw:radius,radiusAtFit:radius*3.8,xRange:[lo,hi],continuousBodyClearanceRaw:worst,continuousBodyClearanceAtFit:worst.gap*3.8,floorAtPhases:phaseFloor,lowestPointOverFullTurnAtFit:3.8*(c[1]-radius-before.min[1])});
}
const pairs=[];for(let i=0;i<checks.length;i++)for(let j=i+1;j<checks.length;j++){const a=checks[i],b=checks[j],axial=Math.max(a.xRange[0]-b.xRange[1],b.xRange[0]-a.xRange[1]),radial=Math.hypot(a.pivotRaw[1]-b.pivotRaw[1],a.pivotRaw[2]-b.pivotRaw[2])-a.radiusRaw-b.radiusRaw;assert(axial>0||radial>0);pairs.push({a:a.name,b:b.name,axial,radial});}
const report={status:'GEOMETRY_PASS_EXPERIMENTAL',sourceSha256:hash(originalBin),candidateSha256:hash(candidateBin),publicUnchanged:true,bytes:candidateBin.length,triangles:parts.reduce((n,p)=>n+p.triangles.length,0),exactUnchangedSourceFaces:exactOriginalFaces,changedSourceFaces:changed.size,sourceTriangles:src.triangles.length,textureHashes,bounds:{before,after,maxError:boundsError},bodyTopology:bodyTopo,bodyNonManifoldEdgesInherited:true,wheels:checks,wheelPairClearances:pairs,method:'Independent NodeIO/Meshopt decode. Oriented cyclic triangle signatures compare all raw attributes outside worker-declared source mask; exact source root TRS/material/texture comparisons. Geometric weld tolerance 1e-7; closed edges plus connected cyclic vertex links. Continuous rotation uses clipped triangles in X slabs <=0.00075, maximum tyre radius and minimum projected convex body-polygon radius. The reported slab gap is radial separation within shared axial slabs, not the global Euclidean surface distance (especially at front axles). Pair separation uses disjoint axial intervals or swept YZ circles.',limits:['Candidate above 8000 tri target; public unchanged.','Main did not repeat worker reconstructed-triangle self-intersection audit.','Body is not globally manifold.','Ground-contact extrema are measured, not a suspension or perfect-rolling proof.','No gameplay, physical iPad, PWA or performance proof.']};
await fs.writeFile(path.join(dir,'audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,triangles:report.triangles,bytes:report.bytes,exactUnchangedSourceFaces:exactOriginalFaces,bodyTopology:bodyTopo,bodyNonManifoldEdgesInherited:true,wheels:checks.map(w=>({name:w.name,topology:w.topology,clearanceAtFit:w.continuousBodyClearanceAtFit,lowestFullTurn:w.lowestPointOverFullTurnAtFit,floorAtPhases:w.floorAtPhases}))},null,2));
