#!/usr/bin/env node
/** Reduce the existing sculpted fence, preserving its placement anchors and atlas. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO,Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize,weld,simplify,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import validator from 'gltf-validator';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.argv[2];
if(!output)throw Error('Usage: node scripts/build-farm-fence-lite.mjs OUTPUT_DIRECTORY');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const hash=b=>createHash('sha256').update(b).digest('hex');
function stats(doc,bytes){const r=doc.getRoot();return {bytes,triangles:r.listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((k,p)=>k+p.getIndices().getCount()/3,0),0),bounds:getBounds(r.listScenes()[0]),textures:r.listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType(),sha256:hash(t.getImage())}))};}
await fs.mkdir(output,{recursive:true});const models=[],validation=[];
for(const [name,target] of [['fence',250],['fence-post',220]]){
 const source=path.join(root,'public/models',name+'.glb'),dest=path.resolve(output,name+'-lite.glb');
 assert.notEqual(source,dest,'Refusing to overwrite the source');
 const bytes=await fs.readFile(source),doc=await io.readBinary(bytes),r=doc.getRoot();
 assert.equal(r.listMeshes().length,1);assert.equal(r.listMeshes()[0].listPrimitives().length,1);
 assert.equal(r.listSkins().length+r.listAnimations().length,0,'Static scenery only');
 assert.equal(r.listMeshes()[0].listPrimitives()[0].listTargets().length,0);
 doc.setLogger(new Logger(Logger.Verbosity.WARN));const before=stats(doc,bytes.length);
 // glTF-Transform handles index compaction; its callback sees the current welded
 // attributes. Lock extrema so height fitting and the two-unit rail pitch stay exact.
 const anchored={...MeshoptSimplifier,simplify(indices,p,stride,count,error,flags){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i+=stride)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[i+k]);hi[k]=Math.max(hi[k],p[i+k]);}
  const lock=new Uint8Array(p.length/stride);
  for(let i=0;i<lock.length;i++)if([0,1,2].some(k=>Math.min(Math.abs(p[i*stride+k]-lo[k]),Math.abs(p[i*stride+k]-hi[k]))<1e-6))lock[i]=1;
  const prim=r.listMeshes()[0].listPrimitives()[0],n=prim.getAttribute('NORMAL'),uv=prim.getAttribute('TEXCOORD_0');
  assert.equal(n.getCount(),lock.length);assert.equal(uv.getCount(),lock.length);
  const attrs=new Float32Array(lock.length*5);
  for(let i=0;i<lock.length;i++){attrs.set(n.getElement(i,[]),i*5);attrs.set(uv.getElement(i,[]),i*5+3);}
  return MeshoptSimplifier.simplifyWithAttributes(indices,p,stride,attrs,5,[.5,.5,.5,1,1],lock,count,error,[...flags,'Permissive']);
 }};
 await doc.transform(dequantize(),weld(),simplify({simplifier:anchored,ratio:target/before.triangles,error:.035}),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16}));
 const out=await io.writeBinary(doc),after=stats(await io.readBinary(out),out.length);
 assert.deepEqual(after.textures,before.textures,'The source texture atlas must stay byte-identical');
 for(const side of ['min','max'])for(let k=0;k<3;k++)assert(Math.abs(after.bounds[side][k]-before.bounds[side][k])<1e-5,'Placement bounds changed');
 assert(after.triangles<=350,'Selected mobile budget exceeded');
 const result=await validator.validateBytes(out,{uri:name+'-lite.glb'});
 assert.equal(result.issues.numErrors+result.issues.numWarnings,0,'GLB validation failed');
 await fs.writeFile(dest,out);validation.push({name:name+'-lite',...result});
 models.push({name:name+'-lite',source:name,sourceSha256:hash(bytes),outputSha256:hash(out),targetTriangles:target,error:.035,weights:[.5,.5,.5,1,1],before,after});
 console.log(`${name}: ${before.triangles} → ${after.triangles} triangles; ${before.bytes} → ${after.bytes} bytes`);
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({models,notes:['Normals and UVs participate in simplification; all extrema are locked. Existing vertex attributes and image atlas are reused.','Error tolerance takes precedence over target count; selected after visual comparison.','Original files preserved. Geometry savings are not measurements of FPS.']},null,2)+'\n');
await fs.writeFile(path.join(output,'validation.json'),JSON.stringify(validation,null,2)+'\n');
