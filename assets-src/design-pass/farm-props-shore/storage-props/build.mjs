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
 const prim=doc.createPrimitive().setAttribute('POSITION',acc('VEC3',positions)).setAttribute('NORMAL',acc('VEC3',normals)).setAttribute('COLOR_0',acc('VEC3',colors)).setMaterial(doc.createMaterial('matte-farm-wood-and-bands').setRoughnessFactor(.88).setMetallicFactor(0));
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
await asset('farm-crate',add=>{
 const colors=['#b88550','#be925d','#aa7846'];
 for(let i=0;i<5;i++)add(new RoundedBoxGeometry(.25,.10,.89,1,.015),[(i-2)*.26,.05,0],colors[i%3]);
 for(const x of [-.605,.605])for(const z of [-.405,.405])add(new RoundedBoxGeometry(.13,.87,.13,1,.015),[x,.435,z],'#a97745');
 for(let i=0;i<3;i++){
  const y=.22+i*.24;
  for(const z of [-.445,.445])add(new RoundedBoxGeometry(1.35,.18,.09,1,.014),[0,y,z],colors[i]);
  for(const x of [-.63,.63]){
   if(i<2)add(new RoundedBoxGeometry(.09,.18,.89,1,.014),[x,y,0],colors[(i+1)%3]);
   else {for(const z of [-.31,.31])add(new RoundedBoxGeometry(.09,.18,.27,1,.014),[x,y,z],colors[1]);add(new RoundedBoxGeometry(.09,.05,.40,1,.01),[x,y+.065,0],colors[1]);}
  }
 }
 for(const z of [-.496,.496])for(const x of [-.56,.56])for(const y of [.22,.70])add(new THREE.CylinderGeometry(.018,.018,.008,6),[x,y,z],'#695039',[Math.PI/2,0,0]);
});
await asset('farm-barrel',add=>{
 const profile=[[0,.43],[.16,.48],[.40,.535],[.92,.535],[1.18,.48],[1.32,.43]],n=14;
 for(let i=0;i<n;i++){
  const a=i/n*2*Math.PI+.009,b=(i+1)/n*2*Math.PI-.009,pts=[];
  const p=(r,y,t)=>[r*Math.cos(t),y,r*Math.sin(t)],quad=(a,b,c,d)=>{for(const v of [a,b,c,a,c,d])pts.push(...v)};
  for(let j=1;j<profile.length;j++){
   const [y0,r0]=profile[j-1],[y1,r1]=profile[j];
   quad(p(r0,y0,a),p(r1,y1,a),p(r1,y1,b),p(r0,y0,b));
   quad(p(r0-.055,y0,b),p(r1-.055,y1,b),p(r1-.055,y1,a),p(r0-.055,y0,a));
   quad(p(r0-.055,y0,a),p(r1-.055,y1,a),p(r1,y1,a),p(r0,y0,a));
   quad(p(r0,y0,b),p(r1,y1,b),p(r1-.055,y1,b),p(r0-.055,y0,b));
  }
  for(const j of [0,profile.length-1]){const[y,r]=profile[j];const v=[p(r,y,a),p(r,y,b),p(r-.055,y,b),p(r-.055,y,a)];if(j!==0)v.reverse();quad(...v);}
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.computeVertexNormals();add(g,[0,0,0],['#ac7a47','#be8b53','#b5824c','#b48a58'][i%4]);
 }
 add(new THREE.CylinderGeometry(.412,.412,.045,28),[0,.024,0],'#987043');
 add(new THREE.CylinderGeometry(.414,.414,.045,28),[0,1.289,0],'#c19460');
 for(const z of [-.27,-.09,.09,.27]){const length=2*Math.sqrt(.405*.405-z*z);add(new THREE.BoxGeometry(length,.004,.011),[0,1.313,z],'#92693e');}
 for(const y of [.23,1.04]){
  const radiusAt=t=>{const j=profile.findIndex(p=>p[0]>=t),[y0,r0]=profile[j-1],[y1,r1]=profile[j];return r0+(r1-r0)*(t-y0)/(y1-y0)};
  const lo=y-.052,hi=y+.052,rlo=radiusAt(lo),rhi=radiusAt(hi);
  const points=[new THREE.Vector2(rlo-.006,lo),new THREE.Vector2(rlo+.025,lo),new THREE.Vector2(rhi+.025,hi),new THREE.Vector2(rhi-.006,hi),new THREE.Vector2(rlo-.006,lo)];
  add(new THREE.LatheGeometry(points,28),[0,0,0],'#5c6967');
 }
});
await fs.writeFile(dir+'/models.json',JSON.stringify({provenance:'Original local mesh authoring for farm storage props. No external generation or texture orders.',models:reports},null,2)+'\n');
await fs.writeFile(dir+'/placement.json',JSON.stringify({scope:'Candidate only, full farm bounds and cameras required.',groups:[{model:'farm-crate',fit:{width:1.35},items:[[-23.7,-27.0,0,1],[49.35,25,0.1,1]]},{model:'farm-barrel',fit:{height:1.3},items:[[-23.7,-28.7,0,1],[49.4,27.3,0,1]]}]},null,2)+'\n');
console.log(reports.map(({name,bytes,triangles})=>({name,bytes,triangles})));
