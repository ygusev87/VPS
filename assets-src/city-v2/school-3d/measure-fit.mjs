/** Measure actual decoded GLB after runtime width/yaw; no gameplay edits. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import sharp from 'sharp';
import validator from 'gltf-validator';
const dir=path.dirname(fileURLToPath(import.meta.url));
const fitted=process.argv.includes('--offset-preview');
const baseline=fitted?JSON.parse(await fs.readFile(path.join(dir,'measurements.json'),'utf8')):null;
const offsetZ=fitted?baseline.distanceFromFixedDoorTarget:0;
const file='candidate/school.glb';
const bytes=await fs.readFile(path.join(dir,file));
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(path.join(dir,file));
const root=doc.getRoot();
assert.equal(root.listSkins().length,0);assert.equal(root.listAnimations().length,0);
const yaw=new THREE.Matrix4().makeRotationY(-Math.PI/2),parts=[],points=[];
let triangles=0,negativeNodes=0;
for(const node of root.listNodes())if(node.getMesh()){
 const m=yaw.clone().multiply(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
 if(m.determinant()<0)negativeNodes++;
 for(const prim of node.getMesh().listPrimitives()){
  const pos=prim.getAttribute('POSITION'),uv=prim.getAttribute('TEXCOORD_0'),p=[];
  for(let i=0;i<pos.getCount();i++)p.push(new THREE.Vector3(...pos.getElement(i,[])).applyMatrix4(m));
  points.push(...p);triangles+=(prim.getIndices()?.getCount()??pos.getCount())/3;
  const tex=prim.getMaterial().getBaseColorTexture();
  parts.push({points:p,uv,indices:prim.getIndices(),pixels:await sharp(tex.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true})});
 }
}
assert.equal(negativeNodes,0,'New school must not require mirrored node handling');
const box=new THREE.Box3().setFromPoints(points),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=9/size.x;
const meshes=[];
for(const p of parts){
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(p.points.flatMap(v=>[(v.x-center.x)*scale,(v.y-box.min.y)*scale,(v.z-center.z)*scale+offsetZ]),3));
 const uvs=[];for(let i=0;i<p.uv.getCount();i++)uvs.push(...p.uv.getElement(i,[]));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));if(p.indices)g.setIndex([...p.indices.getArray()]);
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.userData.pixels=p.pixels;mesh.updateMatrixWorld(true);meshes.push(mesh);
}
const ray=new THREE.Raycaster(),round=n=>Math.round(n*10000)/10000;
function surface(x,y,front=true){
 ray.set(new THREE.Vector3(x,y,front?20:-20),new THREE.Vector3(0,0,front?-1:1));
 const h=ray.intersectObjects(meshes,false)[0];if(!h)return null;
 const {data,info}=h.object.userData.pixels;
 const px=Math.min(info.width-1,Math.max(0,Math.floor(h.uv.x*info.width))),py=Math.min(info.height-1,Math.max(0,Math.floor(h.uv.y*info.height)));
 const at=(py*info.width+px)*info.channels;
 return{point:h.point.toArray().map(round),rgb:[...data.subarray(at,at+3)]};
}
const front=[.05,.2,.6,1,1.5].map(y=>surface(0,y));
const back=[.2,.6,1].map(y=>surface(0,y,false));
const door=front[2];assert(door,'Missing central facade');
const doorFloor=[];for(let y=.005;y<=.2;y+=.005){const h=surface(0,y);if(h)doorFloor.push(h);}
const starts=[[-2,8.5],[-.4,8.5],[1.2,8.5]],end=[0,4.5];
const paths=starts.map(([x,z])=>{
 const a=new THREE.Vector3(x,.6,z),b=new THREE.Vector3(0,.6,4.5),d=b.clone().sub(a),length=d.length();
 ray.set(a,d.normalize());const hit=ray.intersectObjects(meshes,false)[0];
 return{startXZ:[x,z],endXZ:end,rayHeight:.6,pathLength:round(length),firstHitDistance:hit?round(hit.distance):null,hitBeforeEndpoint:!!hit&&hit.distance<length-.12};
});
const fittedSize=size.clone().multiplyScalar(scale).toArray(),rect={x0:-4.5,x1:4.5,z0:-fittedSize[2]/2+offsetZ,z1:fittedSize[2]/2+offsetZ};
function pointRect(x,z){return Math.hypot(Math.max(rect.x0-x,0,x-rect.x1),Math.max(rect.z0-z,0,z-rect.z1));}
// Both known beam segments are axis-aligned; nearest interval distance is exact for the full AABB.
const beam=[[[6,8],[13,8]],[[13,8],[13,13.5]]].map(([a,b])=>{
 const horizontal=a[1]===b[1];
 const closest=horizontal?[THREE.MathUtils.clamp(rect.x1,Math.min(a[0],b[0]),Math.max(a[0],b[0])),a[1]]:[a[0],THREE.MathUtils.clamp(rect.z1,Math.min(a[1],b[1]),Math.max(a[1],b[1]))];
 return{fromLocalXZ:a,toLocalXZ:b,clearanceToFullAABB:round(pointRect(...closest))};
});
const proposal={depthMultiplier:round(4.5/door.point[2]),resultFullDepth:round(fittedSize[2]*4.5/door.point[2]),heightUnchanged:round(fittedSize[1]),reason:'Extend depth only to bring measured central entrance to fixed local z4.5. Keeps width, height, center and all gameplay anchors.'};
const validation=await validator.validateBytes(bytes,{uri:'school.glb'});assert.equal(validation.issues.numErrors+validation.issues.numWarnings,0);
const report={status:fitted?'Proposed visual building offset only; Claude decision required':'Native-depth candidate; entrance does not yet align',file,bytes:bytes.length,triangles,negativeMeshNodes:negativeNodes,runtimeFit:{width:9,rotateY:-Math.PI/2,centerXZ:[11,round(-30+offsetZ)]},referenceOriginXZ:[11,-30],proposedOffsetZ:offsetZ,fittedSize:fittedSize.map(round),frontCenterProbes:front,backCenterProbes:back,lowestCenterSurface:doorFloor[0]??null,doorZAtY0_6:door.point[2],distanceFromFixedDoorTarget:round(4.5-door.point[2]),childrenPaths:paths,laserProjection:beam,boardNorthMargin:round(7.5-fittedSize[2]/2+offsetZ),proposal,limitations:['Door height/position estimates from central surface probes; inspect atlas and silhouette.','Beam checks conservative complete AABB projection, not gameplay traceBeam.','Child tests are center rays at y0.6, not swept collision volumes or full character animation.','Not an iPad, performance or full game test.']};
if(fitted){delete report.proposal;assert(Math.abs(report.distanceFromFixedDoorTarget)<.025);assert(paths.every(p=>!p.hitBeforeEndpoint));assert(beam.every(p=>p.clearanceToFullAABB>1));assert(report.boardNorthMargin>1);}
await fs.writeFile(path.join(dir,fitted?'offset-preview-measurements.json':'measurements.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(dir,fitted?'offset-preview-validation.json':'validation.json'),JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
