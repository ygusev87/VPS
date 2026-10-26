import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import validator from 'gltf-validator';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const dir=path.dirname(fileURLToPath(import.meta.url));
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const reports=[];
async function asset(name,create){
 const positions=[],normals=[],colors=[];
 const add=(geometry,position,color,rotation=[0,0,0])=>{let g=geometry.index?geometry.toNonIndexed():geometry;const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(1,1,1));g=g.clone().applyMatrix4(matrix);const c=new THREE.Color(color);positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);};
 create(add);
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(name);
 const acc=(type,array)=>doc.createAccessor().setType(type).setArray(new Float32Array(array)).setBuffer(buffer);
 const prim=doc.createPrimitive().setAttribute('POSITION',acc('VEC3',positions)).setAttribute('NORMAL',acc('VEC3',normals)).setAttribute('COLOR_0',acc('VEC3',colors)).setMaterial(doc.createMaterial('matte-painted-wood-and-leaves').setRoughnessFactor(.88).setMetallicFactor(0));
 scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
 await doc.transform(weld(),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
 const bytes=await io.writeBinary(doc),validation=await validator.validateBytes(bytes,{uri:name+'.glb'});
 if(validation.issues.numErrors||validation.issues.numWarnings)throw Error(JSON.stringify(validation.issues));
 const decoded=await io.readBinary(bytes),p=decoded.getRoot().listMeshes()[0].listPrimitives()[0],bounds=getBounds(decoded.getRoot().listScenes()[0]);
 for(const a of ['POSITION','NORMAL'])for(const x of p.getAttribute(a).getArray())if(!Number.isFinite(x))throw Error('Nonfinite '+a);
 if(Math.abs(bounds.min[1])>.001)throw Error('Origin not on base');
 await fs.writeFile(dir+'/'+name+'.glb',bytes);
 reports.push({name,bytes:bytes.length,triangles:p.getIndices().getCount()/3,bounds,sha256:createHash('sha256').update(bytes).digest('hex'),materials:1,textures:0,validation:validation.issues});
}
await asset('pond-dock',add=>{
 const plankColors=['#b88550','#c2915d','#ad7b45','#bd8a53'];
 for(let i=0;i<9;i++){
  const z=(i-4)*.43;
  add(new RoundedBoxGeometry(2.12,.14,.40,1,.028),[0,.245,z],plankColors[i%4]);
  for(const x of [-.82,.82])add(new THREE.CylinderGeometry(.028,.028,.012,6),[x,.321,z],'#614a36');
  for(const [x,l]of [[-.3,.75],[.5,.42]])add(new THREE.BoxGeometry(l,.004,.013),[x,.317,z+(i%2?.06:-.07)],'#a27040');
 }
 for(const x of [-.81,.81])add(new RoundedBoxGeometry(.14,.16,3.95,1,.025),[x,.08,0],'#8c603c');
 for(const x of [-1.03,1.03])for(const z of [-1.85,1.85]){
  add(new THREE.CylinderGeometry(.105,.13,.65,8),[x,.325,z],'#9d7047');
  add(new THREE.CylinderGeometry(.09,.09,.008,8),[x,.654,z],'#c09260');
 }
});
await asset('pond-reeds',add=>{
 const leaves=['#6b903b','#849d46','#597e36'];
 for(let i=0;i<5;i++){
  const angle=i*2.4,x=Math.cos(angle)*(.06+i*.038),z=Math.sin(angle)*(.06+i*.038),h=.60+(i%3)*.12;
  add(new THREE.CylinderGeometry(.013,.018,h,5),[x,h/2,z],'#789247');
  add(new THREE.CylinderGeometry(.043,.043,.19,7),[x,h+.035,z],'#85603e');
  for(let k=0;k<2;k++){
   const a=angle+k*2.2,pts=[],width=.047;
   const curve=t=>new THREE.Vector3(x+Math.cos(a)*.27*t*t,.08+.48*t-.14*t*t,z+Math.sin(a)*.27*t*t);
   for(let j=0;j<4;j++){
    const t=j/4,u=(j+1)/4,p=curve(t),q=curve(u),v=new THREE.Vector3(-Math.sin(a),0,Math.cos(a));
    const p1=p.clone().addScaledVector(v,width*(1-t)),p2=p.clone().addScaledVector(v,-width*(1-t)),q1=q.clone().addScaledVector(v,width*(1-u)),q2=q.clone().addScaledVector(v,-width*(1-u));
    for(const tri of [[p1,p2,q1],[p2,q2,q1],[q1,p2,p1],[q1,q2,p2]])for(const p of tri)pts.push(...p.toArray());
   }
   const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.computeVertexNormals();add(g,[0,0,0],leaves[(i+k)%3]);
  }
 }
});
await fs.writeFile(dir+'/models.json',JSON.stringify({provenance:'Original small meshes authored in code for the requested pond details; no image/API orders. Existing rock-cluster reused for placement.',models:reports},null,2)+'\n');
await fs.writeFile(dir+'/placement.json',JSON.stringify({scope:'Candidate only. East bank/pump left clear; review in actual farm required.',groups:[{model:'pond-dock',fit:{depth:3.95},items:[[-47.5,4.6,Math.PI/2,1]]},{model:'pond-reeds',fit:{height:.85},items:[[-44.8,.8,.3,1],[-44.7,7.6,1.2,.9],[-40.5,-1.1,2.2,.9]]},{model:'rock-cluster',fit:{width:1.6},items:[[-43.5,-1.2,.8,.85],[-46.4,6.9,-.4,.85]]}]},null,2)+'\n');
console.log(reports.map(({name,bytes,triangles})=>({name,bytes,triangles})));
