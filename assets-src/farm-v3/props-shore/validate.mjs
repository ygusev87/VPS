import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize,getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Matrix3,Matrix4,Vector3} from 'three';
import validator from 'gltf-validator';
const dir=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const filename=path.join(dir,'candidate/hay-bale.glb'),bytes=await fs.readFile(filename),d=await io.readBinary(bytes);await d.transform(dequantize());
const all=[],normalLengths=[],determinants=[],materials=d.getRoot().listMaterials(),textures=d.getRoot().listTextures();
for(const node of d.getRoot().listNodes()){
 const matrix=new Matrix4().fromArray(node.getWorldMatrix()),nm=new Matrix3().getNormalMatrix(matrix);determinants.push(matrix.determinant());
 for(const prim of node.getMesh()?.listPrimitives()??[]){const pos=prim.getAttribute('POSITION'),normal=prim.getAttribute('NORMAL'),uv=prim.getAttribute('TEXCOORD_0'),index=prim.getIndices().getArray();
  const vertices=Array.from({length:pos.getCount()},(_,i)=>{const n=new Vector3(...normal.getElement(i,[]));normalLengths.push(n.length());return {p:new Vector3(...pos.getElement(i,[])).applyMatrix4(matrix),n:n.applyNormalMatrix(nm),uv:uv.getElement(i,[])};});
  for(let i=0;i<index.length;i+=3)all.push([vertices[index[i]],vertices[index[i+1]],vertices[index[i+2]]]);
 }
}
const key=p=>p.toArray().map(x=>Math.round(x*1e6)).join(','),edgeMap=new Map(),seen=new Map(),parents=all.map((_,i)=>i),find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
let volume=0,degenerate=0,flippedNormals=0,area=0,nonfinite=0;
for(const [i,t] of all.entries()){
 const [a,b,c]=t.map(v=>v.p),cross=b.clone().sub(a).cross(c.clone().sub(a)),faceArea=cross.length()/2;area+=faceArea;volume+=a.dot(b.clone().cross(c))/6;if(faceArea<1e-12)degenerate++;
 if(cross.dot(t.reduce((s,v)=>s.add(v.n),new Vector3()))< -1e-10)flippedNormals++;
 for(const v of t){if([...v.p.toArray(),...v.n.toArray(),...v.uv].some(x=>!Number.isFinite(x)))nonfinite++;const k=key(v.p);if(seen.has(k))parents[find(i)]=find(seen.get(k));else seen.set(k,i);}
 for(let j=0;j<3;j++){const ka=key(t[j].p),kb=key(t[(j+1)%3].p);if(ka===kb)continue;const k=[ka,kb].sort().join('|');if(!edgeMap.has(k))edgeMap.set(k,[]);edgeMap.get(k).push(ka<kb?1:-1);}
}
const edgeCounts={boundary:0,nonmanifold:0,inconsistentWinding:0};for(const e of edgeMap.values()){if(e.length===1)edgeCounts.boundary++;if(e.length>2)edgeCounts.nonmanifold++;if(e.length===2&&e[0]===e[1])edgeCounts.inconsistentWinding++;}
const components=new Map();all.forEach((t,i)=>{const k=find(i);if(!components.has(k))components.set(k,{triangles:0,area:0});const g=components.get(k);g.triangles++;g.area+=t[1].p.clone().sub(t[0].p).cross(t[2].p.clone().sub(t[0].p)).length()/2;});
const bounds=getBounds(d.getRoot().listScenes()[0]),manifest=JSON.parse(await fs.readFile(path.join(dir,'original/manifest.json'),'utf8'));
const sourceIntegrity=[];for(const [name,expected] of Object.entries(manifest.files)){const live=await fs.readFile(path.resolve(dir,'../../..',name)),copy=await fs.readFile(path.join(dir,'original',path.basename(name)));sourceIntegrity.push({name,originalSha256:expected.sha256,liveSha256:sha(live),copySha256:sha(copy),unchanged:sha(live)===expected.sha256&&sha(copy)===expected.sha256});}
const original=await io.read(path.join(dir,'original/hayloft.glb'));
const materialInfo=m=>({baseColor:m.getBaseColorFactor(),metallic:m.getMetallicFactor(),roughness:m.getRoughnessFactor(),alphaMode:m.getAlphaMode(),alphaCutoff:m.getAlphaCutoff(),doubleSided:m.getDoubleSided(),emissive:m.getEmissiveFactor(),normalScale:m.getNormalScale(),occlusionStrength:m.getOcclusionStrength()});
const materialUnchanged=JSON.stringify(materials.map(materialInfo))===JSON.stringify(original.getRoot().listMaterials().map(materialInfo));
const textureUnchanged=JSON.stringify(textures.map(t=>sha(t.getImage())))===JSON.stringify(original.getRoot().listTextures().map(t=>sha(t.getImage())));
const compressed=await validator.validateBytes(bytes,{uri:'hay-bale.glb'}),uncompressed=await validator.validateBytes(await fs.readFile(path.join(dir,'candidate/hay-bale-uncompressed.glb')),{uri:'hay-bale-uncompressed.glb'});
const assertions={sourceUnchanged:sourceIntegrity.every(s=>s.unchanged),materialUnchanged,textureUnchanged,finite:nonfinite===0,positiveDeterminants:determinants.every(x=>x>0),normalsUnit:Math.max(...normalLengths)<1.001&&Math.min(...normalLengths)>.999,noDegenerate:degenerate===0,closedManifold:edgeCounts.boundary===0&&edgeCounts.nonmanifold===0&&edgeCounts.inconsistentWinding===0,withinBudget:all.length<=5000&&bytes.length<=200000,outwardNormals:flippedNormals===0,singleConnectedComponent:components.size===1,positiveVolume:volume>0,centerXZ:Math.abs(bounds.min[0]+bounds.max[0])<1e-6&&Math.abs(bounds.min[2]+bounds.max[2])<1e-6,baseY0:Math.abs(bounds.min[1])<1e-6,validator:compressed.issues.numErrors===0&&compressed.issues.numWarnings===0&&uncompressed.issues.numErrors===0&&uncompressed.issues.numWarnings===0};
const report={candidateSha256:sha(bytes),bytes:bytes.length,triangles:all.length,materials:materials.length,textures:textures.map(t=>({bytes:t.getImage().length,size:t.getSize(),sha256:sha(t.getImage())})),bounds,fitWidth2_8:{size:bounds.max.map((v,i)=>(v-bounds.min[i])*2.8/(bounds.max[0]-bounds.min[0]))},determinants,normalLength:{min:Math.min(...normalLengths),max:Math.max(...normalLengths)},degenerate,flippedNormals,nonfinite,area,signedVolume:volume,components:[...components.values()],edgeCounts,sourceIntegrity,materialProperties:materials.map(materialInfo),validation:{compressed:compressed.issues,uncompressed:uncompressed.issues},assertions,passed:Object.values(assertions).every(Boolean)};
await fs.writeFile(path.join(dir,'qa/validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
