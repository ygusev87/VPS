#!/usr/bin/env node
/** Separate low-detail variants of repeated static scenery. Originals stay untouched. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, getBounds, meshopt, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.argv[2];
if(!output)throw Error('Usage: node scripts/build-farm-lite.mjs OUTPUT_DIRECTORY');
const specs=[['tree-pine',600,.015],['tree-oak',600,.02],['bush',650,.01]];
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function stats(doc,bytes){const r=doc.getRoot();return {bytes,triangles:r.listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0),bounds:getBounds(r.listScenes()[0]),textures:r.listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType(),sha256:hash(t.getImage())}))};}
await fs.mkdir(output,{recursive:true});const models=[];
for(const [name,target,error] of specs){
 const source=path.join(root,'public/models',name+'.glb'),dest=path.join(output,name+'-lite.glb');
 if(source===path.resolve(dest))throw Error('Refusing to overwrite original');
 const bytes=await fs.readFile(source),doc=await io.readBinary(bytes),r=doc.getRoot();
 if(r.listSkins().length||r.listAnimations().length||r.listMeshes().some(m=>m.listPrimitives().some(p=>p.listTargets().length)))throw Error('Static scenery only');
 doc.setLogger(new Logger(Logger.Verbosity.WARN));const before=stats(doc,bytes.length);

 await doc.transform(dequantize(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:target/before.triangles,error}),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
 const finalBytes=await io.writeBinary(doc),after=stats(await io.readBinary(finalBytes),finalBytes.length);
 if(JSON.stringify(before.textures)!==JSON.stringify(after.textures))throw Error(name+': texture changed');
 await fs.writeFile(dest,finalBytes);
 const row={name:name+'-lite',source:name,sourceSha256:hash(bytes),outputSha256:hash(finalBytes),targetTriangles:target,simplifyError:error,before,after};
 models.push(row);console.log(`${name}: ${before.triangles} → ${after.triangles} triangles; ${before.bytes} → ${after.bytes} bytes`);
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({models,notes:['Static low-detail variants only. Original geometry/textures preserved in public/models.','Textures are byte-identical to originals. Separate model selection, not automatic camera-distance LOD.','Rendering cost must be measured again by the integrator; mesh count is not FPS.']},null,2)+'\n');
