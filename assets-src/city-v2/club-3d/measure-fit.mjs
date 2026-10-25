/** Decode the club at the actual DECOR placement; conservative complete-bbox checks. */
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
const file=final?'../../../public/models/club.glb':'candidate/club.glb';
const contract=JSON.parse(await fs.readFile(path.join(dir,'../club-contract.json'),'utf8'));
const decor=await fs.readFile(path.join(dir,'../../../src/city-decor.ts'),'utf8');
assert.match(decor,/model: 'club', fit: \{ width: 7, rotateY: -Math.PI \/ 2 \}, items: \[\[48.5, -13, 0, 1\]\]/,'Club placement must remain approved');
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
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p.verts.flatMap(v=>[(v.x-center.x)*scale+48.5,(v.y-rawBox.min.y)*scale,(v.z-center.z)*scale-13]),3));
 if(p.indices)geo.setIndex([...p.indices.getArray()]);
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);meshes.push(mesh);
}
const box=new THREE.Box3();meshes.forEach(m=>box.union(new THREE.Box3().setFromObject(m)));
const round=n=>Math.round(n*10000)/10000;
const distance=(x,z)=>Math.hypot(Math.max(box.min.x-x,0,x-box.max.x),Math.max(box.min.z-z,0,z-box.max.z));
const children=contract.fixedGameplay.children.map(c=>({...c,controlRadius:0.35,conservativeHorizontalClearance:round(distance(...c.positionXZ)-.35),hopMaxY:.72,note:'Includes .6 hop + up to .12 asking bob; fixed XZ circle envelope, not actual animated skin.'}));
assert(children.every(c=>c.conservativeHorizontalClearance>.5),'Children too near full model bbox');
const f=contract.fixedGameplay;
const slots=['NEON_SPOT','CLUB_SENSOR','MUSIC_SPOT'].map(name=>{
 const [x,z]=f[name],ox=Math.max(0,Math.min(box.max.x,x+2)-Math.max(box.min.x,x-2)),oz=Math.max(0,Math.min(box.max.z,z+2)-Math.max(box.min.z,z-2));
 return{name,centerXZ:[x,z],nominalSize:[4,4],overlapArea:round(ox*oz)};
});
assert(slots.every(s=>s.overlapArea===0),'Model overlaps a task reservation');
const ray=new THREE.Raycaster(),a=new THREE.Vector3(43,1.21,-9.5),b=new THREE.Vector3(43,.51,-7.6),delta=b.clone().sub(a),length=delta.length();
ray.set(a,delta.clone().normalize());ray.far=length;
const lightHits=ray.intersectObjects(meshes,false);
assert.equal(lightHits.length,0,'Club intersects neon-to-sensor center light path');
// Both light endpoints share x43; entire club lies at x>=45, including eaves.
const lightPath={from:a.toArray(),to:b.toArray(),length:round(length),intersections:lightHits.length,horizontalXSeparation:round(box.min.x-43),note:'Heights from NeonSign.glowLight()/LightSensor.eyePoint(); geometric corridor only, not circuit simulation.'};
ray.far=Infinity;
const boundingGrid=[];
for(const xf of [-.32,-.16,0,.16,.32])for(const zf of [-.32,-.16,0,.16,.32]){
 const x=48.5+7*xf,z=-13+(box.max.z-box.min.z)*zf;
 ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));
 const hit=ray.intersectObjects(meshes,false)[0];boundingGrid.push({x:round(x),z:round(z),topY:hit?round(hit.point.y):null});
}

// A canopy changes the complete bbox without adding walls under every corner.
// Probe inside each actual wall envelope at y=.8; this distinguishes outside-footprint
// samples from a missing roof above a real body. Keep the original bbox grid as evidence.
const roof=[];
for(const xf of [-.32,-.16,0,.16,.32]){
 const x=48.5+7*xf;
 ray.set(new THREE.Vector3(x,.8,20),new THREE.Vector3(0,0,-1));const front=ray.intersectObjects(meshes,false)[0];
 ray.set(new THREE.Vector3(x,.8,-40),new THREE.Vector3(0,0,1));const back=ray.intersectObjects(meshes,false)[0];
 assert(front&&back,'Missing body wall at roof probe column');
 for(const t of [.1,.3,.5,.7,.9]){
  const z=back.point.z+(front.point.z-back.point.z)*t;
  ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes,false)[0];
  roof.push({x:round(x),z:round(z),bodyBackZ:round(back.point.z),bodyFrontZ:round(front.point.z),topY:hit?round(hit.point.y):null});
 }
}
const materials=root.listMaterials().map(m=>({name:m.getName(),alphaMode:m.getAlphaMode(),doubleSided:m.getDoubleSided(),emissiveFactor:m.getEmissiveFactor(),extensions:m.listExtensions().map(e=>e.extensionName)}));
assert(materials.every(m=>m.alphaMode==='OPAQUE'&&!m.extensions.includes('KHR_materials_transmission')),'Club must be opaque');
const validation=await validator.validateBytes(bytes,{uri:'club.glb'});
assert.equal(validation.issues.numErrors+validation.issues.numWarnings,0);
const report={status:final?'Installed GLB; full game review pending':'Candidate measured; visual QA still required',file,bytes:bytes.length,triangles,negativeMeshNodes,materials,runtimeFit:{width:7,rotateY:-Math.PI/2,centerXZ:[48.5,-13]},fittedSize:box.getSize(new THREE.Vector3()).toArray().map(round),worldBox:{min:box.min.toArray().map(round),max:box.max.toArray().map(round)},children,taskReservations:slots,lightPath,boundingGridDiagnostic:boundingGrid,roofProbes:roof,boardMargins:{east:round(55-box.max.x),north:round(box.min.z+37.5)},limitations:['Roof probes sample five width columns inside measured wall envelopes at y.8; not a watertight topology proof.','Child circles are conservative fixed-XZ envelopes, not real characters or all gestures.','Actual parts, whole task, lighting, iPad and FPS require runtime review.']};
await fs.writeFile(path.join(dir,final?'final-measurements.json':'measurements.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(dir,final?'final-validation.json':'validation.json'),JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

assert(roof.every(p=>p.topY!==null&&p.topY>(box.max.y-box.min.y)*.4),'Roof probe found low surface or hole');
