import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {compressTexture,getBounds,meshopt,prune,weld,simplify} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import * as T from 'three';
import sharp from 'sharp';
import validator from 'gltf-validator';
const {Brush,Evaluator,SUBTRACTION}=await import(process.env.FACTORY_CSG_MODULE??'/tmp/electro-factory-csg/node_modules/three-bvh-csg/src/index.js');
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../..');
const source=path.join(repo,'assets-src/raw/factory-2026-10-27/safety-press.glb');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const raw=await fs.readFile(source),d=await io.readBinary(raw),root=d.getRoot();
const p=root.listMeshes()[0].listPrimitives()[0],buf=root.listBuffers()[0];
const g=new T.BufferGeometry();
for(const [s,n] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(s);g.setAttribute(n,new T.BufferAttribute(Float32Array.from(a.getArray()),a.getElementSize()));}
g.setIndex(new T.BufferAttribute(Uint32Array.from(p.getIndices().getArray()),1));
const landmarks=[[0,0],[.2312,.3],[.35,.45],[.6,1.80],[.6996,1.925],[.87573,2.15],[.9508056640625,2.3]];
function yMap(y){for(let k=1;k<landmarks.length;k++){const a=landmarks[k-1],b=landmarks[k];if(y<=b[0]+1e-6)return a[1]+(y-a[0])/(b[0]-a[0])*(b[1]-a[1]);}return 2.3;}
for(let i=0;i<g.attributes.position.count;i++){const v=new T.Vector3().fromBufferAttribute(g.attributes.position,i);g.attributes.position.setXYZ(i,v.x*1.9,yMap(v.y),v.z*(.8/.428955078125));}
// Move the columns outward within the original 1.9-wide base, leaving the centre bore fixed.
for(let i=0;i<g.attributes.position.count;i++){const a=g.attributes.position,x=a.getX(i),y=a.getY(i);const shift=.13*Math.min(1,Math.max(0,(Math.abs(x)-.25)/.25))*Math.min(1,Math.max(0,(y-.3)/.15));a.setX(i,x+Math.sign(x)*shift);}
g.computeVertexNormals();
const a=new Brush(g);a.updateMatrixWorld();
// A real bore for the code rod (radius .1), with .03 radial clearance.
const cutGeometry=new T.CylinderGeometry(.13,.13,1.5,24,1,false);
// Reuse a dark point of the unchanged original atlas for the bore interior.
for(let i=0;i<cutGeometry.attributes.uv.count;i++)cutGeometry.attributes.uv.setXY(i,.02,.02);
const b=new Brush(cutGeometry);b.position.y=2.1;b.updateMatrixWorld();
const e=new Evaluator();e.useGroups=false;
const out=e.evaluate(a,b,SUBTRACTION).geometry;
for(const [s,n]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const attr=out.attributes[n];p.setAttribute(s,d.createAccessor(s).setType(attr.itemSize===2?'VEC2':'VEC3').setArray(Float32Array.from(attr.array)).setBuffer(buf));}
p.setIndices(d.createAccessor('indices').setType('SCALAR').setArray(Uint32Array.from(out.index?out.index.array:Array.from({length:out.attributes.position.count},(_,i)=>i))).setBuffer(buf));
for(const m of root.listMaterials()){m.setName('safety-press-paint').setRoughnessFactor(.62).setMetallicFactor(.15).setDoubleSided(false);m.setExtension('KHR_materials_volume',null);m.setExtension('KHR_materials_transmission',null);}
for(const n of root.listNodes())n.setName('safety-press-body');
await d.transform(prune());
const tri=()=>p.getIndices().getCount()/3;
const cutTriangles=tri();
if(cutTriangles>4000)await d.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:3900/cutTriangles,error:.0001}));
for(const t of root.listTextures())await compressTexture(t,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:90,effort:70});
d.createExtension(EXTTextureWebP).setRequired(true);
await d.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
const bytes=await io.writeBinary(d),check=await io.readBinary(bytes);
await fs.mkdir(path.join(dir,'candidate'),{recursive:true});
await fs.writeFile(path.join(dir,'candidate/safety-press.glb'),bytes);
const validation=await validator.validateBytes(bytes,{uri:'safety-press.glb'});
const report={source:path.relative(repo,source),sourceSha256:createHash('sha256').update(raw).digest('hex'),outputSha256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:raw.length,bytes:bytes.length,sourceTriangles:3507,cutTriangles,triangles:check.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0),bounds:getBounds(check.getRoot().listScenes()[0]),materials:check.getRoot().listMaterials().length,textures:check.getRoot().listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()})),landmarks,columnShiftMaximum:.13,bore:{radius:.13,axisXZ:[0,0],cutY:[1.35,2.85]},placement:[0,.16,-.35],fit:{width:1.9},validation:validation.issues};
await fs.writeFile(path.join(dir,'model-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(validation.issues.numErrors||report.triangles>4000||report.materials!==1)throw Error('Asset budget/validation failed');
