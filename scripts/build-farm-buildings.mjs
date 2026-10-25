#!/usr/bin/env node
/** Compact new static farm buildings; preserve raw Studio exports separately. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { compressTexture, dequantize, getBounds, meshopt, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [input,output,...names]=process.argv.slice(2);
if(!input||!output||!names.length||path.resolve(input)===path.resolve(output))throw Error('Usage: build-farm-buildings.mjs RAW OUTPUT farmhouse silo');
const specs={farmhouse:{target:3000,error:.004,yawDegrees:90},silo:{target:1000,error:.0015,yawDegrees:0}};
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const sha=b=>createHash('sha256').update(b).digest('hex');
function stats(doc,bytes){const r=doc.getRoot();return{bytes,triangles:r.listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0),meshes:r.listMeshes().length,materials:r.listMaterials().length,bounds:getBounds(r.listScenes()[0]),textures:r.listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType(),bytes:t.getImage().length})),skins:r.listSkins().length,animations:r.listAnimations().length};}
await fs.mkdir(output,{recursive:true});const models=[];
for(const name of names){
 const spec=specs[name];if(!spec)throw Error('Unknown building '+name);
 const raw=await fs.readFile(path.join(input,name+'.glb')),doc=await io.readBinary(raw),r=doc.getRoot();
 if(r.listSkins().length||r.listAnimations().length||r.listMeshes().some(m=>m.listPrimitives().some(p=>p.listTargets().length)))throw Error('Static buildings only');
 doc.setLogger(new Logger(Logger.Verbosity.WARN));const before=stats(doc,raw.length);
 const yaw=spec.yawDegrees*Math.PI/180;
 for(const scene of r.listScenes()){const orient=doc.createNode('BuildingOrientation').setRotation([0,Math.sin(yaw/2),0,Math.cos(yaw/2)]);for(const child of scene.listChildren()){scene.removeChild(child);orient.addChild(child);}scene.addChild(orient);}
 // Source with canonical orientation, including full-resolution atlas, for visual QA.
 await fs.mkdir(path.join(output,'before'),{recursive:true});
 await fs.writeFile(path.join(output,'before',name+'.glb'),await io.writeBinary(doc));
 for(const t of r.listTextures())await compressTexture(t,{encoder:sharp,targetFormat:'webp',resize:[512,512],quality:88,effort:70});
 doc.createExtension(EXTTextureWebP).setRequired(true);

 await doc.transform(dequantize(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,spec.target/before.triangles),error:spec.error}),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
 const bytes=await io.writeBinary(doc),after=stats(await io.readBinary(bytes),bytes.length);
 await fs.writeFile(path.join(output,name+'.glb'),bytes);
 models.push({name,sourceSha256:sha(raw),outputSha256:sha(bytes),...spec,before,after});
 console.log(`${name}: ${before.triangles} -> ${after.triangles} triangles; ${before.bytes} -> ${bytes.length} bytes`);
}
await fs.writeFile(path.join(output,'model-report.json'),JSON.stringify({models,notes:['Static GLB, single 512px WebP color atlas, meshopt compression.','Oriented source comparisons in before/ are authoring QA only, not runtime assets.','Triangle count is an asset budget, not a measured GPU/FPS result.']},null,2)+'\n');
