// Prepared for an accepted static adult. Does not upload, order or download anything.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {compressTexture,getBounds,meshopt,prune,weld,simplify} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
import validator from 'gltf-validator';
const dir=path.dirname(fileURLToPath(import.meta.url));
const rawPath=path.resolve(dir,'../../../raw/city-adults-2026-10-26/firefighter.glb');
if(process.argv[2]===undefined || !Number.isFinite(Number(process.argv[2]))) throw Error('Pass an explicit visually checked source-to-+X yaw in degrees; no assumed default.');
const yawDegrees=Number(process.argv[2]), a=yawDegrees*Math.PI/180;
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const sha=b=>createHash('sha256').update(b).digest('hex');
const stats=d=>({triangles:d.getRoot().listMeshes().reduce((a,m)=>a+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0),meshes:d.getRoot().listMeshes().length,materials:d.getRoot().listMaterials().length,bounds:getBounds(d.getRoot().listScenes()[0]),textures:d.getRoot().listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType(),bytes:t.getImage().length})),skins:d.getRoot().listSkins().length,animations:d.getRoot().listAnimations().length});
const raw=await fs.readFile(rawPath),doc=await io.readBinary(raw),root=doc.getRoot(),before=stats(doc);
if(root.listSkins().length||root.listAnimations().length||root.listMeshes().length!==1||root.listMeshes()[0].listPrimitives().length!==1||root.listMaterials().length!==1)throw Error('Expected one static mesh');
for(const n of root.listNodes())if(JSON.stringify(n.getTranslation())!=='[0,0,0]'||JSON.stringify(n.getRotation())!=='[0,0,0,1]'||JSON.stringify(n.getScale())!=='[1,1,1]')throw Error('Unexpected source transform');
for(const p of root.listMeshes()[0].listPrimitives())for(const semantic of ['POSITION','NORMAL','TANGENT']){const attr=p.getAttribute(semantic);if(!attr)continue;for(let i=0;i<attr.getCount();i++){const v=attr.getElement(i,[]);attr.setElement(i,[Math.cos(a)*v[0]+Math.sin(a)*v[2],v[1],-Math.sin(a)*v[0]+Math.cos(a)*v[2],...(semantic==='TANGENT'?[v[3]]:[])]);}}
const scene=root.listScenes()[0],box=getBounds(scene),center=[(box.min[0]+box.max[0])/2,box.min[1],(box.min[2]+box.max[2])/2];
for(const p of root.listMeshes()[0].listPrimitives()){const pos=p.getAttribute('POSITION');for(let i=0;i<pos.getCount();i++)pos.setElement(i,pos.getElement(i,[]).map((v,k)=>v-center[k]));}
for(const m of root.listMaterials())m.setName('firefighter-paint').setRoughnessFactor(.9).setMetallicFactor(0).setDoubleSided(false);
for(const n of root.listNodes())n.setName('firefighter-body');
await fs.mkdir(path.join(dir,'candidate'),{recursive:true});
// Full geometry comparison reference remains local and ignored with the original.
await io.write(path.resolve(dir,'../../../raw/city-adults-2026-10-26/firefighter-canonical.glb'),doc);
await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,3800/before.triangles),error:.004}),prune());
for(const t of root.listTextures())await compressTexture(t,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:90,effort:70});
doc.createExtension(EXTTextureWebP).setRequired(true);
await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
const bytes=await io.writeBinary(doc),after=stats(await io.readBinary(bytes));
const validation=await validator.validateBytes(bytes,{uri:'firefighter.glb'});
const failures=[];
if(validation.issues.numErrors||validation.issues.numWarnings)failures.push('validator');
if(after.triangles>4000||bytes.length>200000||after.materials!==1)failures.push('geometry/material/file budget');
if(after.textures.some(t=>t.mime!=='image/webp'||t.size.some(n=>n>512)))failures.push('texture budget');
if(Math.abs(after.bounds.min[1])>.0001||[0,2].some(k=>Math.abs((after.bounds.min[k]+after.bounds.max[k])/2)>.0001))failures.push('feet/centre');
if(failures.length){await fs.writeFile(path.join(dir,'validation-failure.json'),JSON.stringify({failures,after,bytes:bytes.length,issues:validation.issues},null,2)+'\n');throw Error(failures.join(', '));}
await fs.writeFile(path.join(dir,'candidate/firefighter.glb'),bytes);
const report={sourcePath:'assets-src/raw/city-adults-2026-10-26/firefighter.glb',sourceSha256:sha(raw),candidateSha256:sha(bytes),sourceBytes:raw.length,bytes:bytes.length,yawDegrees,visualVerificationPending:true,forward:'+X (requires six-view inspection; yaw is caller-supplied)',up:'+Y',before,after,validation:validation.issues};
await fs.writeFile(path.join(dir,'model-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
