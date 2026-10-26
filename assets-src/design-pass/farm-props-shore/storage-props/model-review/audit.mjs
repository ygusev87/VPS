import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
const dir=fileURLToPath(new URL('.',import.meta.url));
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const result={method:{weldTolerance:1e-5,normalFaceDotTolerance:-.01,hoopSamples:'720 azimuths at each of three heights per hoop; radial intersections on actual decoded triangles, two-sided for geometry measurement only'},models:[]};
for(const name of ['farm-crate','farm-barrel']){
 const bytes=await fs.readFile(dir+'inputs/'+name+'.glb'),doc=await io.readBinary(bytes);
 const vertices=[],normals=[],rawNormalLengths=[],colors=[],faces=[];
 for(const node of doc.getRoot().listNodes())if(node.getMesh()){
  const m=new THREE.Matrix4().fromArray(node.getWorldMatrix()),nm=new THREE.Matrix3().getNormalMatrix(m);
  for(const prim of node.getMesh().listPrimitives()){
   const p=prim.getAttribute('POSITION'),n=prim.getAttribute('NORMAL'),c=prim.getAttribute('COLOR_0'),base=vertices.length;
   for(let i=0;i<p.getCount();i++){vertices.push(new THREE.Vector3().fromArray(p.getElement(i,[])).applyMatrix4(m));const rawNormal=new THREE.Vector3().fromArray(n.getElement(i,[]));rawNormalLengths.push(rawNormal.length());normals.push(rawNormal.applyMatrix3(nm).normalize());colors.push(c.getElement(i,[]).slice(0,3));}
   const idx=prim.getIndices();for(let i=0;i<(idx?.getCount()??p.getCount());i+=3)faces.push([0,1,2].map(j=>base+(idx?idx.getScalar(i+j):i+j)));
  }
 }
 const keys=new Map(),welded=[],ids=vertices.map(v=>{const key=v.toArray().map(x=>Math.round(x/1e-5)).join(',');if(!keys.has(key)){keys.set(key,welded.length);welded.push(v);}return keys.get(key);});
 const parents=welded.map((_,i)=>i),find=x=>parents[x]===x?x:(parents[x]=find(parents[x])),join=(a,b)=>{parents[find(a)]=find(b)};
 const edges=new Map(),valid=[],normalDots=[],normalLengths=rawNormalLengths;let degenerate=0;
 for(const face of faces){const [a,b,c]=face.map(i=>vertices[i]),cross=b.clone().sub(a).cross(c.clone().sub(a));if(cross.length()<1e-10){degenerate++;continue;}const dot=cross.normalize().dot(face.reduce((s,i)=>s.add(normals[i]),new THREE.Vector3()).normalize());normalDots.push(dot);const ws=face.map(i=>ids[i]);join(ws[0],ws[1]);join(ws[1],ws[2]);valid.push(face);for(let i=0;i<3;i++){const a=ws[i],b=ws[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const e=edges.get(key)||[];e.push(a<b?1:-1);edges.set(key,e);}}
 const components=new Map();for(const face of valid){const id=find(ids[face[0]]);let comp=components.get(id);if(!comp){comp={triangles:0,signedVolume:0,bounds:new THREE.Box3()};components.set(id,comp);}comp.triangles++;const[a,b,c]=face.map(i=>vertices[i]);comp.signedVolume+=a.dot(b.clone().cross(c))/6;for(const v of[a,b,c])comp.bounds.expandByPoint(v);}
 const comps=[...components.values()].map((c,i)=>({id:i,triangles:c.triangles,signedVolume:c.signedVolume,bounds:{min:c.bounds.min.toArray(),max:c.bounds.max.toArray()}}));
 const r={name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),triangles:faces.length,vertices:vertices.length,spatiallyWeldedVertices:welded.length,degenerateTriangles:degenerate,boundaryEdges:[...edges.values()].filter(e=>e.length===1).length,nonManifoldEdges:[...edges.values()].filter(e=>e.length>2).length,inconsistentWindingEdges:[...edges.values()].filter(e=>e.length===2&&e[0]===e[1]).length,normalLengths:{min:Math.min(...normalLengths),max:Math.max(...normalLengths)},faceNormalDot:{min:Math.min(...normalDots),reversedCount:normalDots.filter(d=>d<-.01).length},closedComponentCount:comps.length,nonPositiveVolumes:comps.filter(c=>c.signedVolume<=0).length,components:comps};
 if(name==='farm-crate'){
  const wood=[],nails=[];for(const f of faces){const target=colors[f[0]][0]<.2?nails:wood;for(const i of f)target.push(...vertices[i].toArray());}
  const mesh=a=>new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(a,3)),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));const w=mesh(wood),m=mesh(nails),caster=new THREE.Raycaster();w.updateMatrixWorld();m.updateMatrixWorld();r.nailContact=[];
  for(const zSign of [-1,1])for(const x of [-.56,.56])for(const y of [.22,.70]){caster.set(new THREE.Vector3(x,y,0),new THREE.Vector3(0,0,zSign));const wh=caster.intersectObject(w,false),mh=caster.intersectObject(m,false);r.nailContact.push({x,y,zSign,gap:Math.min(...mh.map(h=>h.distance))-Math.max(...wh.map(h=>h.distance))});}
 }
 if(name==='farm-barrel'){
  const wood=[],metal=[];for(const f of faces){const c=colors[f[0]],target=Math.max(...c)-Math.min(...c)<.07?metal:wood;for(const i of f)target.push(...vertices[i].toArray());}
  const mesh=a=>new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(a,3)),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));const w=mesh(wood),m=mesh(metal),caster=new THREE.Raycaster();w.updateMatrixWorld();m.updateMatrixWorld();const samples=[];
  for(const centerY of [.23,1.04])for(const y of [centerY-.025,centerY,centerY+.025]){let maxGap=-Infinity,minGap=Infinity,missingWood=0,missingMetal=0,positive=0,maxAt=null;for(let i=0;i<720;i++){const azimuth=i*Math.PI/360;caster.set(new THREE.Vector3(0,y,0),new THREE.Vector3(Math.cos(azimuth),0,Math.sin(azimuth)));const wh=caster.intersectObject(w,false),mh=caster.intersectObject(m,false);if(!wh.length){missingWood++;continue;}if(!mh.length){missingMetal++;continue;}const outerWood=Math.max(...wh.map(h=>h.distance)),innerHoop=Math.min(...mh.map(h=>h.distance)),gap=innerHoop-outerWood;if(gap>maxGap){maxGap=gap;maxAt=azimuth;}minGap=Math.min(minGap,gap);if(gap>1e-4)positive++;}samples.push({centerY,y,minGap,maxGap,maxAt,positiveGapDirections:positive,missingWoodDirections:missingWood,missingMetalDirections:missingMetal});}
  r.hoopContact=samples;r.hoopColorTriangles=metal.length/9;
 }
 result.models.push(r);
}
await fs.writeFile(dir+'geometry-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.models.map(({components,...m})=>m),null,2));
