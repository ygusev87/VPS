/** Decode the toy-shop at the actual DECOR placement; conservative complete-bbox checks. */
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
const file=final?'../../../public/models/toy-shop.glb':'candidate/toy-shop.glb';
const contract=JSON.parse(await fs.readFile(path.join(dir,'../toy-shop-contract.json'),'utf8'));
const decor=await fs.readFile(path.join(dir,'../../../src/city-decor.ts'),'utf8');
assert.match(decor,/model: 'toy-shop', fit: \{ width: 6, rotateY: -Math.PI \/ 2 \}, items: \[\[49.75, -22.4, 0, 0.9\]\]/,'Shop placement must remain approved');
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
const scale=6*.9/rawSize.x,meshes=[];
for(const p of parts){
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p.verts.flatMap(v=>[(v.x-center.x)*scale+49.75,(v.y-rawBox.min.y)*scale,(v.z-center.z)*scale-22.4]),3));
 if(p.indices)geo.setIndex([...p.indices.getArray()]);
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);meshes.push(mesh);
}
const box=new THREE.Box3();meshes.forEach(m=>box.union(new THREE.Box3().setFromObject(m)));
const round=n=>Math.round(n*10000)/10000;
const size=box.getSize(new THREE.Vector3());
const distance=(x,z)=>Math.hypot(Math.max(box.min.x-x,0,x-box.max.x),Math.max(box.min.z-z,0,z-box.max.z));
const f=contract.fixedGameplay;
const ray=new THREE.Raycaster();
const viewDirection=new THREE.Vector3(0,1,.78).normalize();
const pointsToCheck=[];
// StoryMap ring outer radius1.25; largest asking pulse x1.1, y=.03.
for(let i=0;i<48;i++){const a=i/48*Math.PI*2;pointsToCheck.push({name:'bell-ring-'+i,point:[50.5+1.375*Math.cos(a),.03,-29.5+1.375*Math.sin(a)]});}
for(const [name,point]of[['bell-center',[50.5,.5,-29.5]],['terminal-right',[51.1,.16,-29]],['terminal-left',[49.9,.16,-29]]])pointsToCheck.push({name,point});
const visibility=pointsToCheck.map(p=>{ray.set(new THREE.Vector3(...p.point),viewDirection);return{...p,occludedByShop:ray.intersectObjects(meshes,false).length>0};});
assert(visibility.every(p=>!p.occludedByShop),'Shop hides bell or pulsing ring from game view');
const slots=['ALARM_SPOT','DOMINO_SPOT'].map(name=>{const[x,z]=f[name];return{name,nominalSize:[4,4],overlapArea:round(Math.max(0,Math.min(box.max.x,x+2)-Math.max(box.min.x,x-2))*Math.max(0,Math.min(box.max.z,z+2)-Math.max(box.min.z,z-2)))};});
assert(slots.every(s=>s.overlapArea===0));
let minPathDistance=Infinity;
for(let i=1;i<f.RACCOON_PATH.length;i++){const a=f.RACCOON_PATH[i-1],b=f.RACCOON_PATH[i];for(let j=0;j<=1000;j++){const t=j/1000;minPathDistance=Math.min(minPathDistance,distance(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t));}}
const raccoon={path:f.RACCOON_PATH,segmentSamples:1001,centerlineToFullBox:round(minPathDistance),controlRadius:1,clearance:round(minPathDistance-1),note:'Conservative circle around path, not actual skin/animated extremities. Full game check required.'};
assert(raccoon.clearance>.25);
const seller={centerXZ:f.SHOPKEEPER,controlRadius:.45,clearance:round(distance(...f.SHOPKEEPER)-.45)};
assert(seller.clearance>.3);
const bins={centerXZ:f.BINS,fitWidth:2,separationAlongX:round(box.min.x-(f.BINS[0]+1))};assert(bins.separationAlongX>.5);
const roof=[];
for(const xf of [-.3,-.15,0,.15,.3])for(const zf of [-.3,-.15,0,.15,.3]){
const x=49.75+size.x*xf,z=-22.4+size.z*zf;ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes,false)[0];roof.push({x:round(x),z:round(z),topY:hit?round(hit.point.y):null});}
assert(roof.every(p=>p.topY!==null&&p.topY>size.y*.5),'Roof probe hole or low surface');
const materials=root.listMaterials().map(m=>({alphaMode:m.getAlphaMode(),emissiveFactor:m.getEmissiveFactor(),extensions:m.listExtensions().map(e=>e.extensionName)}));
assert(materials.every(m=>m.alphaMode==='OPAQUE'&&!m.extensions.includes('KHR_materials_transmission')));
const validation=await validator.validateBytes(bytes,{uri:'toy-shop.glb'});assert.equal(validation.issues.numErrors+validation.issues.numWarnings,0);
const report={status:final?'Installed GLB; full game review recorded separately':'Candidate; visual QA pending',file,bytes:bytes.length,triangles,materials,negativeMeshNodes,runtimeFit:{width:6,instanceScale:.9,rotateY:-Math.PI/2,centerXZ:[49.75,-22.4]},fittedSize:size.toArray().map(round),worldBox:{min:box.min.toArray().map(round),max:box.max.toArray().map(round)},taskReservations:slots,bellVisibility:{viewDirection:viewDirection.toArray(),samples:visibility,occluded:visibility.filter(v=>v.occludedByShop).length,note:'Ray tests against shop mesh only; terminal y=.16 is conservative ground attachment level, real terminals higher. Other scenery/full game must be inspected.'},raccoon,seller,bins,roofProbes:roof,limitations:['Roof sampling is not watertight topology proof.','Path envelope is not animated mesh collision.','No circuit/iPad/PWA/FPS result from geometric checks.']};
await fs.writeFile(path.join(dir,final?'final-measurements.json':'measurements.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(dir,final?'final-validation.json':'validation.json'),JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify({bytes:bytes.length,triangles,size:report.fittedSize,worldBox:report.worldBox,bellOccluded:report.bellVisibility.occluded,raccoon,seller,bins,roofMin:Math.min(...roof.map(p=>p.topY)),validationErrors:validation.issues.numErrors}));
