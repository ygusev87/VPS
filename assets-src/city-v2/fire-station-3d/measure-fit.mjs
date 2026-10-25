/** Decode the fire-station at the actual DECOR placement; conservative complete-bbox checks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
import validator from 'gltf-validator';
const dir=path.dirname(fileURLToPath(import.meta.url));
const final=process.argv.includes('--final');
const file=final?'../../../public/models/fire-station.glb':'candidate/fire-station.glb';
const contract=JSON.parse(await fs.readFile(path.join(dir,'../fire-station-contract.json'),'utf8'));
const decor=await fs.readFile(path.join(dir,'../../../src/city-decor.ts'),'utf8');
assert.match(decor,/model: 'fire-station', fit: \{ width: 7, rotateY: -Math.PI \/ 2 \}, items: \[\[29, 8, 0, 1\]\]/,'Station placement must remain approved');
await MeshoptDecoder.ready;
const bytes=await fs.readFile(path.join(dir,file));
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(path.join(dir,file));
const root=doc.getRoot(), points=[], parts=[];
assert.equal(root.listSkins().length,0);assert.equal(root.listAnimations().length,0);
let triangles=0,negativeMeshNodes=0;
for(const node of root.listNodes())if(node.getMesh()){
 const m=new THREE.Matrix4().makeRotationY(-Math.PI/2).multiply(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
 if(m.determinant()<0)negativeMeshNodes++;
 for(const primitive of node.getMesh().listPrimitives()){
  const p=primitive.getAttribute('POSITION'),verts=[];
  for(let i=0;i<p.getCount();i++)verts.push(new THREE.Vector3(...p.getElement(i,[])).applyMatrix4(m));
  points.push(...verts);parts.push({verts,indices:primitive.getIndices()});
  triangles+=(primitive.getIndices()?.getCount()??p.getCount())/3;
 }
}
assert.equal(negativeMeshNodes,0);
const rawBox=new THREE.Box3().setFromPoints(points),rawSize=rawBox.getSize(new THREE.Vector3()),center=rawBox.getCenter(new THREE.Vector3());
const scale=7/rawSize.x,meshes=[];
for(const p of parts){
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p.verts.flatMap(v=>[(v.x-center.x)*scale+29,(v.y-rawBox.min.y)*scale,(v.z-center.z)*scale+8]),3));
 if(p.indices)geo.setIndex([...p.indices.getArray()]);
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);meshes.push(mesh);
}
const box=new THREE.Box3();meshes.forEach(m=>box.union(new THREE.Box3().setFromObject(m)));
const round=n=>Math.round(n*10000)/10000;
const size=box.getSize(new THREE.Vector3());
const distance=(x,z)=>Math.hypot(Math.max(box.min.x-x,0,x-box.max.x),Math.max(box.min.z-z,0,z-box.max.z));
const f=contract.fixedGameplay,ray=new THREE.Raycaster(),viewDirection=new THREE.Vector3(0,1,.78).normalize();
const pts=[];
for(const name of ['ENGINE_SPOT','LADDER_SPOT','HYDRANT_SPOT']){const[x,z]=f[name];for(let i=0;i<48;i++){const a=i/48*Math.PI*2;pts.push({name:name+'-ring-'+i,point:[x+1.375*Math.cos(a),.03,z+1.375*Math.sin(a)]});}}
for(const[name,[x,z]]of Object.entries({engineRight:[26.85,14.22],engineLeft:[24.15,14.22],polePlus:[24.62,18.02],poleMinus:[23.38,18.02]}))pts.push({name,point:[x,.48,z]});
const visibility=pts.map(p=>{ray.set(new THREE.Vector3(...p.point),viewDirection);return{...p,occludedByStation:ray.intersectObjects(meshes,false).length>0};});assert(visibility.every(p=>!p.occludedByStation),'Station hides task ring/terminal');
const slots=['ENGINE_SPOT','LADDER_SPOT','HYDRANT_SPOT'].map(name=>{const[x,z]=f[name];return{name,nominalSize:[4,4],overlapArea:round(Math.max(0,Math.min(box.max.x,x+2)-Math.max(box.min.x,x-2))*Math.max(0,Math.min(box.max.z,z+2)-Math.max(box.min.z,z-2)))};});assert(slots.every(s=>s.overlapArea===0));
const firefighter={centerXZ:f.firefighter.centerXZ,controlRadius:.72,clearance:round(distance(...f.firefighter.centerXZ)-.72)};assert(firefighter.clearance>.3);
const canal={leftEdge:35.4,clearance:round(35.4-box.max.x)};assert(canal.clearance>0);
const catPath=[];for(let j=0;j<=100;j++){const t=j/100,a=f.catDescent.fromXYZ,b=f.catDescent.toXYZ;catPath.push(distance(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t));}const cat={path:f.catDescent,stationClearance:round(Math.min(...catPath)-.7),controlRadius:.7};assert(cat.stationClearance>0);
const roof=[];for(const xf of [-.3,-.15,0,.15,.3])for(const zf of [-.3,-.15,0,.15,.3]){const x=29+size.x*xf,z=8+size.z*zf;ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes,false)[0];roof.push({x:round(x),z:round(z),topY:hit?round(hit.point.y):null});}assert(roof.every(p=>p.topY!==null&&p.topY>size.y*.5),'Roof probe hole or low surface');
const materials=root.listMaterials().map(m=>({alphaMode:m.getAlphaMode(),emissiveFactor:m.getEmissiveFactor(),extensions:m.listExtensions().map(e=>e.extensionName)}));assert(materials.every(m=>m.alphaMode==='OPAQUE'&&!m.extensions.includes('KHR_materials_transmission')));
const validation=await validator.validateBytes(bytes,{uri:'fire-station.glb'});assert.equal(validation.issues.numErrors+validation.issues.numWarnings,0);
const report={status:final?'Installed GLB; full game review separate':'Candidate; visual QA pending',file,bytes:bytes.length,triangles,materials,negativeMeshNodes,runtimeFit:{width:7,instanceScale:1,rotateY:-Math.PI/2,centerXZ:[29,8]},fittedSize:size.toArray().map(round),worldBox:{min:box.min.toArray().map(round),max:box.max.toArray().map(round)},taskReservations:slots,visibility:{viewDirection:viewDirection.toArray(),samples:visibility,occluded:visibility.filter(v=>v.occludedByStation).length,note:'Station mesh only. Other scenery needs actual game review.'},firefighter,canal,cat,roofProbes:roof,limitations:['Roof sampling is not watertight topology proof.','Character envelopes are conservative circles, not animated meshes.','No iPad/PWA/FPS result from geometric checks.']};
await fs.writeFile(path.join(dir,final?'final-measurements.json':'measurements.json'),JSON.stringify(report,null,2)+'\n');await fs.writeFile(path.join(dir,final?'final-validation.json':'validation.json'),JSON.stringify(validation,null,2)+'\n');console.log(JSON.stringify({bytes:bytes.length,triangles,size:report.fittedSize,worldBox:report.worldBox,occluded:report.visibility.occluded,firefighter,canal,cat,roofMin:Math.min(...roof.map(p=>p.topY)),validationErrors:validation.issues.numErrors}));
