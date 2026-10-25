/** Measure the candidate in runtime model() coordinates; no gameplay writes. */
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
import sharp from 'sharp';
import validator from 'gltf-validator';
const dir=path.dirname(fileURLToPath(import.meta.url));
const input=path.join(dir,'candidate/grandma-house.glb'),bytes=await fs.readFile(input);
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(input);
assert.equal(doc.getRoot().listSkins().length,0);assert.equal(doc.getRoot().listAnimations().length,0);
const yaw=new THREE.Matrix4().makeRotationY(-Math.PI/2),parts=[],all=[];
for(const n of doc.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives()){
 const m=yaw.clone().multiply(new THREE.Matrix4().fromArray(n.getWorldMatrix()));
 const pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),points=[];
 for(let i=0;i<pos.getCount();i++)points.push(new THREE.Vector3(...pos.getElement(i,[])).applyMatrix4(m));
 all.push(...points);
 const tex=p.getMaterial().getBaseColorTexture();assert(tex);
 const pixels=await sharp(tex.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 parts.push({points,uv,indices:p.getIndices(),pixels});
}
const box=new THREE.Box3().setFromPoints(all),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=6.2/size.x;
const meshes=[];
for(const p of parts){
 const geo=new THREE.BufferGeometry();
 const positions=p.points.flatMap(v=>[(v.x-center.x)*scale,(v.y-box.min.y)*scale,(v.z-center.z)*scale]);
 const uvs=[];for(let i=0;i<p.uv.getCount();i++)uvs.push(...p.uv.getElement(i,[]));
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 if(p.indices)geo.setIndex([...p.indices.getArray()]);
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.userData.pixels=p.pixels;mesh.updateMatrixWorld(true);meshes.push(mesh);
}
const ray=new THREE.Raycaster(),round=n=>Math.round(n*10000)/10000;
function surface(y,z){
 ray.set(new THREE.Vector3(10,y,z),new THREE.Vector3(-1,0,0));
 const h=ray.intersectObjects(meshes,false)[0];if(!h)return null;
 const {data,info}=h.object.userData.pixels;
 const u=THREE.MathUtils.clamp(h.uv.x,0,1),v=THREE.MathUtils.clamp(h.uv.y,0,1);
 const x=Math.min(info.width-1,Math.floor(u*info.width)),py=Math.min(info.height-1,Math.floor(v*info.height));
 const at=(py*info.width+x)*info.channels,rgb=[...data.subarray(at,at+3)];
 return{point:h.point.toArray().map(round),rgb};
}
const threshold=[];
for(const z of [-.1,.1,.25,.4,.55]){
 const hits=[];
 for(let y=1.6;y<=2.7;y+=.005){const h=surface(y,z);if(!h)continue;const [r,g,b]=h.rgb;if(g>r*1.25&&b>r*1.25&&g>45&&b>45)hits.push(h);}
 if(hits.length>10)threshold.push({z,firstTealPixelY:hits[0].point[1],surfaceX:hits[0].point[0],rgb:hits[0].rgb});
}
assert(threshold.length>=3,'Door colour probes need manual review');
const plateY=1.95,wallProbe=surface(plateY,.25),doorProbe=threshold.find(p=>p.z===.25);assert(wallProbe&&doorProbe);
const report={status:'Candidate only; current fit does not meet balcony interface',input:'candidate/grandma-house.glb',runtimeFit:{width:6.2,rotateY:-Math.PI/2,centerXZ:[-44,-27]},fittedSize:size.multiplyScalar(scale).toArray().map(round),sideDoorColourSamples:threshold,doorEstimate:{method:'Nearest ray hit at +X wall; first teal base-colour texel along y1.6..2.7, step0.005. Confirms rendered door placement, not exact physical sill mesh edge.',thresholdY:doorProbe.firstTealPixelY,aboveDeck:round(doorProbe.firstTealPixelY-plateY),estimateUncertainty:'.02-.05 world units from texture boundary/frame; validate visually'},wallAtDeck:{point:wallProbe.point,rgb:wallProbe.rgb,deckLeftX:3.1,gap:round(3.1-wallProbe.point[0])},options:{recommended:{description:'Keep fitted width6.2; reduce house height only, then extend balcony deck back to the measured facade while anchor/outer edge stay fixed. Claude owns final integration choice.',approxHouseYScale:round(plateY/doorProbe.firstTealPixelY),approxDeckExtension:round(3.1-doorProbe.surfaceX+.03)},alternative:{description:'Increase full fitted width until facade touches x3.1, compensate height separately; recheck enlarged footprint.',approxFullWidth:round(6.2*3.1/doorProbe.surfaceX),approxHouseYScale:round(plateY/doorProbe.firstTealPixelY/(3.1/doorProbe.surfaceX))}},limitations:['No changes to balcony, lift, grandma or gameplay anchors.','Neither suggested option applied to the candidate; no public/models addition.','Full game and iPad testing pending.']};
const validation=await validator.validateBytes(bytes,{uri:'grandma-house.glb'});
assert.equal(validation.issues.numErrors+validation.issues.numWarnings,0,'GLB failed validation');
await fs.writeFile(path.join(dir,'validation.json'),JSON.stringify(validation,null,2)+'\n');
await fs.writeFile(path.join(dir,'fit-measurements.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({size:report.fittedSize,threshold,doorEstimate:report.doorEstimate,wallAtDeck:report.wallAtDeck,options:report.options,validation:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings}}));
