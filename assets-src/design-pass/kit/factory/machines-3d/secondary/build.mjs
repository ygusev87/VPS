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
const {Brush,Evaluator,SUBTRACTION,INTERSECTION}=await import('/tmp/electro-factory-csg/node_modules/three-bvh-csg/src/index.js');
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../../../../../..');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const evaluator=new Evaluator();evaluator.useGroups=false;
const sha=b=>createHash('sha256').update(b).digest('hex');
function map(v,knots){for(let i=1;i<knots.length;i++)if(v<=knots[i][0]+1e-7){const a=knots[i-1],b=knots[i];return a[1]+(v-a[0])*(b[1]-a[1])/(b[0]-a[0]);}return knots.at(-1)[1];}
function toGeometry(p){const g=new T.BufferGeometry();for(const [s,n]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(s);g.setAttribute(n,new T.BufferAttribute(Float32Array.from(a.getArray()),a.getElementSize()));}g.setIndex(new T.BufferAttribute(Uint32Array.from(p.getIndices().getArray()),1));return g;}
function cutter(geometry,position=[0,0,0],rotation=[0,0,0]){for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setXY(i,.02,.02);const b=new Brush(geometry);b.position.set(...position);b.rotation.set(...rotation);b.updateMatrixWorld();return b;}
function boolean(g,cut,op=SUBTRACTION){const a=new Brush(g);a.updateMatrixWorld();const b=evaluator.evaluate(a,cut,op).geometry;return b;}
function rebase(g,p){g.translate(-p[0],-p[1],-p[2]);return g;}
for(const name of process.argv.slice(2)){
 const source=path.join(repo,'assets-src/raw/factory-2026-10-27',name+'.glb'),raw=await fs.readFile(source),d=await io.readBinary(raw),r=d.getRoot(),sourceBounds=getBounds(r.listScenes()[0]),sourcePrimitive=r.listMeshes()[0].listPrimitives()[0],material=r.listMaterials()[0],buffer=r.listBuffers()[0];
 let g=toGeometry(sourcePrimitive);const sourceTriangles=g.index.count/3,details={};let pieces=[];
 if(name==='lever-box'){
  const zc=-.14081192389130592,xc=-.0028762631118297577;
  for(let i=0;i<g.attributes.position.count;i++){const a=g.attributes.position;const x=a.getX(i),y=a.getY(i),z=a.getZ(i);a.setXYZ(i,map(x,[[-.5,-.75],[xc,0],[.5,.75]]),y*.4/sourceBounds.max[1],map(z,[[sourceBounds.min[2],-.55],[zc-.085,-.4775],[zc+.085,-.2225],[sourceBounds.max[2],.55]]));}
  g.computeVertexNormals();g=boolean(g,cutter(new T.CylinderGeometry(.095,.095,1,24),[0,.2,-.35]));
  // Actual runtime stick is inclined towards +Z. Carve its complete Z-axis sweep,
  // with 0.013 radial allowance, rather than checking an unrelated upright stick.
  const cutAngles=Array.from({length:13},(_,i)=>-.55+i*1.1/12);
  for(const angle of cutAngles){const cut=cutter(new T.CylinderGeometry(.073,.073,.77,16),[0,0,0],[Math.PI/2-.5,0,0]);const local=new T.Matrix4().compose(new T.Vector3(0,.2,.3),cut.quaternion,new T.Vector3(1,1,1));const world=new T.Matrix4().makeTranslation(0,.35,-.35).multiply(new T.Matrix4().makeRotationZ(angle)).multiply(local);world.decompose(cut.position,cut.quaternion,cut.scale);cut.updateMatrixWorld();g=boolean(g,cut);}
  details.placement=[0,.16,0];details.fit={width:1.5};details.pivotPartLocal=[0,.51,-.35];details.bore={axisXZ:[0,-.35],radius:.095};details.stickSweep={angles:[-.55,.55],samples:13,clearanceRadius:.073,runtimeRadius:.06};pieces=[{name:'lever-box-body',g,pivot:[0,0,0]}];
 }else if(name==='shaft-motor'){
  for(let i=0;i<g.attributes.position.count;i++){const a=g.attributes.position;a.setXYZ(i,a.getX(i)*1.1,a.getY(i)*.25/sourceBounds.max[1],map(a.getZ(i),[[sourceBounds.min[2],-.45],[-.15,-.40],[.15,-.10],[sourceBounds.max[2],.45]]));}
  g.computeVertexNormals();g=boolean(g,cutter(new T.CylinderGeometry(.105,.105,1,32),[0,.2,-.25]));
  details.placement=[0,.16,-.1];details.fit={width:1.1};details.bore={axisXZ:[0,-.25],radius:.105,runtimeShaftRadius:.08,fullHeight:true};pieces=[{name:'shaft-motor-body',g,pivot:[0,0,0]}];
 }else if(name==='socket-board'){
  // Panel begins above short feet. Preserve a 1m panel height separately from feet.
  const footTop=.045,panelDepth=.149;
  for(let i=0;i<g.attributes.position.count;i++){const a=g.attributes.position;a.setXYZ(i,a.getX(i)*2.6,map(a.getY(i),[[0,0],[footTop,.10],[sourceBounds.max[1],1.10]]),a.getZ(i)*(.2/panelDepth));}
  g.computeVertexNormals();details.panelY=[.10,1.10];details.panelTargetSize=[2.6,1,.2];details.feetHeight=.1;details.placement=[0,.16,-.8];details.fit={width:2.6};pieces=[{name:'socket-board-body',g,pivot:[0,0,0]}];
 }else throw Error('Unsupported model '+name);
 for(const scene of r.listScenes())for(const child of scene.listChildren())scene.removeChild(child);for(const n of [...r.listNodes()])n.dispose();for(const m of [...r.listMeshes()])m.dispose();
 const scene=r.listScenes()[0];
 for(const piece of pieces){const p=d.createPrimitive().setMaterial(material);for(const [s,n]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const attr=piece.g.attributes[n];p.setAttribute(s,d.createAccessor(piece.name+'-'+s).setType(attr.itemSize===2?'VEC2':'VEC3').setArray(Float32Array.from(attr.array)).setBuffer(buffer));}const indices=piece.g.index?.array||Array.from({length:piece.g.attributes.position.count},(_,i)=>i);p.setIndices(d.createAccessor(piece.name+'-indices').setType('SCALAR').setArray(Uint32Array.from(indices)).setBuffer(buffer));const mesh=d.createMesh(piece.name).addPrimitive(p),node=d.createNode(piece.name).setMesh(mesh).setTranslation(piece.pivot);scene.addChild(node);}
 material.setName(name+'-paint').setRoughnessFactor(.62).setMetallicFactor(.15).setDoubleSided(false);material.setExtension('KHR_materials_volume',null);material.setExtension('KHR_materials_transmission',null);
 await d.transform(prune());const triangles=()=>r.listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices().getCount()/3,0),cutTriangles=triangles();
 if(cutTriangles>3950)await d.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:3900/cutTriangles,error:.001}));
 for(const t of r.listTextures())await compressTexture(t,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:90,effort:70});d.createExtension(EXTTextureWebP).setRequired(true);
 await d.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));const bytes=await io.writeBinary(d),check=await io.readBinary(bytes),validation=await validator.validateBytes(bytes,{uri:name+'.glb'}),rr=check.getRoot();
 await fs.mkdir(path.join(dir,'candidate'),{recursive:true});await fs.writeFile(path.join(dir,'candidate',name+'.glb'),bytes);
 const report={name,source:path.relative(repo,source),sourceSha256:sha(raw),sourceBytes:raw.length,sourceTriangles,sourceBounds,outputSha256:sha(bytes),bytes:bytes.length,cutTriangles,triangles:rr.listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices().getCount()/3,0),materials:rr.listMaterials().length,textures:rr.listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()})),bounds:getBounds(rr.listScenes()[0]),nodes:rr.listNodes().map(n=>({name:n.getName(),translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale(),bounds:getBounds(n)})),details,validation:validation.issues};
 await fs.writeFile(path.join(dir,name+'-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.triangles>4000||report.materials!==1||report.bytes>205000||validation.issues.numErrors)throw Error('Output does not pass budgets/validation');
}
