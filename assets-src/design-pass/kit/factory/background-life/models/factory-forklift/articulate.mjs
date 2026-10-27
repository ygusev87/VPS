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
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../../..'),name='factory-forklift';
const data=JSON.parse(await fs.readFile(path.join(dir,'candidate/split-analysis.json'),'utf8'));
const {points,normals,uvs,triangles}=data;
const keys=new Map(),w=points.map((p,i)=>{const key=p.map(x=>x.toFixed(5)).join(',');if(!keys.has(key))keys.set(key,i);return keys.get(key)}),edges=new Map();
for(let i=0;i<triangles.length;i++){const ids=triangles[i].ids.map(j=>w[j]);for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');if(!edges.has(key))edges.set(key,[]);edges.get(key).push({i,a,b})}}
if([...edges.values()].some(e=>e.length!==2))throw Error('Raw surface is not closed');
const boundary=[];for(const ts of edges.values())if(triangles[ts[0].i].moving!==triangles[ts[1].i].moving)boundary.push(ts.find(t=>triangles[t.i].moving));
const loops=[];while(boundary.length){const edge=boundary.pop(),loop=[edge.a];let b=edge.b;while(b!==loop[0]){if(loop.includes(b))throw Error('Pinched interface');loop.push(b);const choices=boundary.filter(e=>e.a===b);if(choices.length!==1)throw Error('Nonmanifold cut');const next=choices[0];boundary.splice(boundary.indexOf(next),1);b=next.b;}loops.push(loop);}
const caps=[];
for(const loop of loops){const ps=loop.map(i=>new T.Vector3(...points[i])),normal=new T.Vector3();for(let j=0;j<ps.length;j++){const a=ps[j],b=ps[(j+1)%ps.length];normal.x+=(a.y-b.y)*(a.z+b.z);normal.y+=(a.z-b.z)*(a.x+b.x);normal.z+=(a.x-b.x)*(a.y+b.y)}normal.normalize();const axis=new T.Vector3(1,0,0).addScaledVector(normal,-normal.x).normalize(),other=new T.Vector3().crossVectors(normal,axis),project=ps.map(p=>new T.Vector2(p.dot(axis),p.dot(other)));let tris=T.ShapeUtils.triangulateShape(project,[]).map(t=>t.map(i=>loop[i]));
 const start=loop[0],end=loop[1],same=tris.some(t=>t.some((i,j)=>i===start&&t[(j+1)%3]===end));if(same)tris=tris.map(t=>t.slice().reverse());
 const capEdges=new Map();for(const t of tris)for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');capEdges.set(key,(capEdges.get(key)||0)+1)}
 const uncovered=loop.map((a,j)=>[a,loop[(j+1)%loop.length]]).filter(e=>capEdges.get(e.slice().sort((a,b)=>a-b).join(','))!==1);
 if(tris.length!==loop.length-2||uncovered.length){await fs.writeFile(path.join(dir,'articulation-attempt.json'),JSON.stringify({status:'BLOCKED',reason:'Best-fit-plane cap triangulation failed to preserve the non-planar interface boundary; no articulated GLB was emitted',sourceClosedManifold:true,sourceTriangles:triangles.length,movingTriangles:triangles.filter(t=>t.moving).length,cutLoops:loops.map(l=>l.map(i=>points[i])),failedLoop:loop,projection:project.map(p=>p.toArray()),expectedCapTriangles:loop.length-2,actualCapTriangles:tris.length,uncoveredBoundaryEdges:uncovered,generatedAt:new Date().toISOString()},null,2)+'\n');throw Error('Cap failed boundary coverage; preserved articulation-attempt.json');}
 caps.push(...tris);
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
const report={state:'EXPERIMENTAL; motion validation pending',sourceSha256:createHash('sha256').update(raw).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,triangles:triangles.length+caps.length*2,materialCount:cr.listMaterials().length,textureCount:cr.listTextures().length,bounds,size:bounds.max.map((x,i)=>x-bounds.min[i]),forksRestTranslation:pivot,carriageBounds:{min:cb.min.toArray(),max:cb.max.toArray()},sourceTrianglesPreserved:triangles.length,sourceTrianglesMoving:triangles.filter(t=>t.moving).length,cutLoops:loops.map(l=>l.map(i=>points[i])),capsPerSide:caps.length,floorSnap:.007,manualSelectionException:'Triangle152: shaded carriage-side seam, included to keep interface simple. Triangle390: tall mast triangle excluded by maxY<1.',validation:issues};
await fs.writeFile(path.join(dir,'candidate/articulated.glb'),bytes);await fs.writeFile(path.join(dir,'candidate/articulation-report.json'),JSON.stringify(report,null,2)+'\n');await fs.writeFile(path.join(dir,'candidate/articulation-geometry.json'),JSON.stringify(normalized));console.log(JSON.stringify(report));
