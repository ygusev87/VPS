import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {compressTexture,getBounds,meshopt,prune,weld} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import * as T from 'three';
import sharp from 'sharp';
import validator from 'gltf-validator';
const output=path.dirname(fileURLToPath(import.meta.url)),dir=path.dirname(output),repo=path.resolve(dir,'../../../../../../..'),name='factory-forklift';
const data=JSON.parse(await fs.readFile(path.join(dir,'candidate/split-analysis.json'),'utf8'));
const {points,normals,uvs,triangles}=data;
const keys=new Map(),w=points.map((p,i)=>{const key=p.map(x=>x.toFixed(5)).join(',');if(!keys.has(key))keys.set(key,i);return keys.get(key)}),edges=new Map();
for(let i=0;i<triangles.length;i++){const ids=triangles[i].ids.map(j=>w[j]);for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');if(!edges.has(key))edges.set(key,[]);edges.get(key).push({i,a,b})}}
if([...edges.values()].some(e=>e.length!==2))throw Error('Raw surface is not closed');
const boundary=[];for(const ts of edges.values())if(triangles[ts[0].i].moving!==triangles[ts[1].i].moving)boundary.push(ts.find(t=>triangles[t.i].moving));
const loops=[];while(boundary.length){const edge=boundary.pop(),loop=[edge.a];let b=edge.b;while(b!==loop[0]){if(loop.includes(b))throw Error('Pinched interface');loop.push(b);const choices=boundary.filter(e=>e.a===b);if(choices.length!==1)throw Error('Nonmanifold cut');const next=choices[0];boundary.splice(boundary.indexOf(next),1);b=next.b;}loops.push(loop);}
// Each spatial interface is projected along many deterministic directions.
// A simple projection with all boundary edges makes the lifted 3D cap injective.
// Keep the original vertices/UV surface; add only internal closure triangles.
const caps=[],capReports=[];
function crosses(a,b,c,d){const s=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);return s(a,b,c)*s(a,b,d)<-1e-12&&s(c,d,a)*s(c,d,b)<-1e-12;}
function constrainedTriangulate(p,ps,loop){
 const n=p.length,inside=(q)=>{let c=false;for(let i=0,j=n-1;i<n;j=i++){if((p[i].y>q.y)!==(p[j].y>q.y)&&q.x<(p[j].x-p[i].x)*(q.y-p[i].y)/(p[j].y-p[i].y)+p[i].x)c=!c;}return c;};
 const diagonal=(a,b)=>{
  if(Math.abs(a-b)===1||(a===0&&b===n-1))return true;
  if(edges.has([loop[a],loop[b]].sort((a,b)=>a-b).join(',')))return false;
  for(let i=0;i<n;i++){const j=(i+1)%n;if([a,b].includes(i)||[a,b].includes(j))continue;if(crosses(p[a],p[b],p[i],p[j]))return false;}
  return inside(p[a].clone().add(p[b]).multiplyScalar(.5));
 };
 const ok=Array.from({length:n},(_,a)=>Array.from({length:n},(_,b)=>diagonal(Math.min(a,b),Math.max(a,b))));
 const dp=Array.from({length:n},()=>Array(n).fill(null));for(let i=0;i<n-1;i++)dp[i][i+1]={area:0,triangles:[]};
 for(let gap=2;gap<n;gap++)for(let i=0;i+gap<n;i++){const j=i+gap;if(!ok[i][j])continue;
  for(let k=i+1;k<j;k++){const l=dp[i][k],r=dp[k][j];if(!l||!r||!ok[i][k]||!ok[k][j])continue;
   const centre=p[i].clone().add(p[k]).add(p[j]).multiplyScalar(1/3);if(!inside(centre))continue;
   const area=l.area+r.area+new T.Triangle(ps[i],ps[k],ps[j]).getArea();
   if(!dp[i][j]||area<dp[i][j].area)dp[i][j]={area,triangles:[...l.triangles,...r.triangles,[i,k,j]]};
  }
 }
 return dp[0][n-1]?.triangles;
}
for(const loop of loops){
 const ps=loop.map(i=>new T.Vector3(...points[i])),valid=[];
 for(let k=0;k<2048;k++){
  const y=1-2*(k+.5)/2048,r=Math.sqrt(1-y*y),phi=k*Math.PI*(3-Math.sqrt(5));
  const n=new T.Vector3(r*Math.cos(phi),y,r*Math.sin(phi)),u=new T.Vector3(1,0,0).addScaledVector(n,-n.x).normalize(),v=new T.Vector3().crossVectors(n,u);
  const p=ps.map(x=>new T.Vector2(x.dot(u),x.dot(v)));let bad=false;
  for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){if(i===0&&j===p.length-1)continue;if(crosses(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))bad=true;}
  if(bad)continue;
  const ts=constrainedTriangulate(p,ps,loop)||T.ShapeUtils.triangulateShape(p,[]),counts=new Map();
  for(const t of ts)for(let j=0;j<3;j++){const key=[t[j],t[(j+1)%3]].sort((a,b)=>a-b).join();counts.set(key,(counts.get(key)||0)+1);}
  if(ts.length!==p.length-2||p.some((_,i)=>counts.get([i,(i+1)%p.length].sort((a,b)=>a-b).join())!==1))continue;
  const area=ts.reduce((s,t)=>s+new T.Triangle(...t.map(i=>ps[i])).getArea(),0);
  const forbidden=[...counts].filter(([key,count])=>count===2&&edges.has(key.split(',').map(i=>loop[Number(i)]).sort((a,b)=>a-b).join(','))).length;
  valid.push({normal:n.toArray(),area,triangles:ts,forbidden});
 }
 if(!valid.length)throw Error('No boundary-preserving simple projection');
 valid.sort((a,b)=>a.forbidden-b.forbidden||a.area-b.area);const best=valid[0];let tris=best.triangles.map(t=>t.map(i=>loop[i]));
 // Cap direction is opposite to the moving component boundary.
 if(tris.some(t=>t.some((a,i)=>a===loop[0]&&t[(i+1)%3]===loop[1])))tris=tris.map(t=>t.slice().reverse());
 for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length];if(!tris.some(t=>t.some((v,j)=>v===b&&t[(j+1)%3]===a)))throw Error('Inconsistent cap winding');}
 caps.push(...tris);capReports.push({vertices:loop.length,validProjections:valid.length,selectedNormal:best.normal,forbiddenOriginalEdges:best.forbidden,area:best.area,triangles:tris.length});
}
const carriage=triangles.filter(t=>t.moving&&t.label==='tripo_part_1').flatMap(t=>t.ids.map(i=>points[i]));const cb=new T.Box3().setFromPoints(carriage.map(p=>new T.Vector3(...p))),pivot=cb.getCenter(new T.Vector3()).toArray();
const nearUV=(target,moving)=>{const t=triangles.filter(t=>t.moving===moving&&t.label==='tripo_part_1').sort((a,b)=>new T.Vector3(...a.color).distanceToSquared(new T.Vector3(...target))-new T.Vector3(...b.color).distanceToSquared(new T.Vector3(...target)))[0];return [0,1].map(a=>t.ids.reduce((s,i)=>s+uvs[i][a],0)/3)};
const capUV={body:nearUV([40,65,70],false),forks:nearUV([180,176,160],true)};
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const raw=await fs.readFile(path.join(repo,'assets-src/raw/factory-background-2026-10-27/factory-forklift.glb')),doc=await io.readBinary(raw),root=doc.getRoot(),mat=root.listMaterials()[0],buffer=root.listBuffers()[0];
for(const scene of root.listScenes())for(const child of scene.listChildren())scene.removeChild(child);for(const n of [...root.listNodes()])n.dispose();for(const m of [...root.listMeshes()])m.dispose();
const top=doc.createNode(name),body=doc.createNode('body'),forks=doc.createNode('forks').setTranslation(pivot);root.listScenes()[0].addChild(top);top.addChild(body).addChild(forks);
const normalized=[];
for(const moving of [false,true]){const key=moving?'forks':'body',positions=[],ns=[],uv=[],indices=[],records=[];const add=(ids,cap)=>{const verts=ids.map(i=>new T.Vector3(...points[i]));const normal=cap?new T.Triangle(...verts).getNormal(new T.Vector3()).toArray():null;for(const i of ids){const p=points[i].slice();if(p[1]<.007)p[1]=0;positions.push(...p.map((x,a)=>x-(moving?pivot[a]:0)));ns.push(...(normal||normals[i]));uv.push(...(cap?capUV[key]:uvs[i]));indices.push(indices.length)}records.push({points:verts.map(p=>p.toArray()),cap,label:cap?'rail-cap':triangles.find(t=>t.ids===ids)?.label});};
 for(const t of triangles.filter(t=>t.moving===moving))add(t.ids,false);for(const t of caps)add(moving?t:t.slice().reverse(),true);
 const primitive=doc.createPrimitive().setMaterial(mat);for(const [s,array,type] of [['POSITION',positions,'VEC3'],['NORMAL',ns,'VEC3'],['TEXCOORD_0',uv,'VEC2']])primitive.setAttribute(s,doc.createAccessor(key+'-'+s).setBuffer(buffer).setType(type).setArray(Float32Array.from(array)));primitive.setIndices(doc.createAccessor(key+'-indices').setBuffer(buffer).setType('SCALAR').setArray(Uint32Array.from(indices)));
 const mesh=doc.createMesh(key).addPrimitive(primitive);if(moving)forks.addChild(doc.createNode('carriage-and-two-blades').setMesh(mesh));else body.setMesh(mesh);normalized.push({name:key,triangles:records});
}
mat.setName(name+'-paint').setAlphaMode('OPAQUE').setRoughnessFactor(.72).setMetallicFactor(0).setDoubleSided(false);
await doc.transform(prune(),weld());for(const texture of root.listTextures())await compressTexture(texture,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:88,effort:70});doc.createExtension(EXTTextureWebP).setRequired(true);await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
const bytes=await io.writeBinary(doc),check=await io.readBinary(bytes),cr=check.getRoot(),issues=(await validator.validateBytes(bytes,{uri:name+'.glb'})).issues,bounds=getBounds(cr.listScenes()[0]);
const report={splitAnalysisSha256:createHash('sha256').update(await fs.readFile(path.join(dir,'candidate/split-analysis.json'))).digest('hex'),capReports,state:'EXPERIMENTAL; motion validation pending',sourceSha256:createHash('sha256').update(raw).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,triangles:triangles.length+caps.length*2,materialCount:cr.listMaterials().length,textureCount:cr.listTextures().length,bounds,size:bounds.max.map((x,i)=>x-bounds.min[i]),forksRestTranslation:pivot,carriageBounds:{min:cb.min.toArray(),max:cb.max.toArray()},sourceTrianglesPreserved:triangles.length,sourceTrianglesMoving:triangles.filter(t=>t.moving).length,cutLoops:loops.map(l=>l.map(i=>points[i])),capsPerSide:caps.length,floorSnap:.007,manualSelectionException:'Triangle152: shaded carriage-side seam, included to keep interface simple. Triangle390: tall mast triangle excluded by maxY<1.',validation:issues};
await fs.writeFile(path.join(output,'articulated-experimental.glb'),bytes);await fs.writeFile(path.join(output,'articulation-report.json'),JSON.stringify(report,null,2)+'\n');await fs.writeFile(path.join(output,'articulation-geometry.json'),JSON.stringify(normalized));console.log(JSON.stringify({bytes:report.bytes,triangles:report.triangles,capReports,bounds,validation:issues,state:report.state}));
