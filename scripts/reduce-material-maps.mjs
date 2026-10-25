#!/usr/bin/env node
/** Remove optional surface maps from reviewed small toy assets without altering geometry or rigs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {listTextureSlots} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
const [input,output,specFile,reportFile]=process.argv.slice(2);
if(!input||!output||!specFile||!reportFile||path.resolve(input)===path.resolve(output))throw Error('Usage: reduce-material-maps.mjs INPUT OUTPUT SPEC.json REPORT.json (input and output must differ)');
const spec=JSON.parse(await fs.readFile(specFile,'utf8'));
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const sha=b=>createHash('sha256').update(b).digest('hex');
function geometry(doc){const r=doc.getRoot(),nodes=r.listNodes(),accessors=r.listAccessors();return sha(JSON.stringify({
 accessors:accessors.map(a=>({type:a.getType(),normalized:a.getNormalized(),component:a.getComponentType(),array:sha(Buffer.from(a.getArray().buffer,a.getArray().byteOffset,a.getArray().byteLength))})),
 meshes:r.listMeshes().map(m=>m.listPrimitives().map(p=>({mode:p.getMode(),indices:accessors.indexOf(p.getIndices()),attrs:p.listSemantics().sort().map(s=>[s,accessors.indexOf(p.getAttribute(s))])}))),
 nodes:nodes.map(n=>({t:n.getTranslation(),r:n.getRotation(),s:n.getScale(),children:n.listChildren().map(c=>nodes.indexOf(c)),weights:n.getWeights()})),
 skins:r.listSkins().map(s=>({joints:s.listJoints().map(n=>nodes.indexOf(n)),matrices:accessors.indexOf(s.getInverseBindMatrices())})),
 animations:r.listAnimations().map(a=>a.listChannels().map(c=>({target:nodes.indexOf(c.getTargetNode()),path:c.getTargetPath(),input:accessors.indexOf(c.getSampler().getInput()),output:accessors.indexOf(c.getSampler().getOutput()),interpolation:c.getSampler().getInterpolation()})))
}));}
function stats(doc,bytes){const textures=doc.getRoot().listTextures().map(t=>{const [w,h]=t.getSize();return{slots:listTextureSlots(t),size:[w,h],bytes:w*h*4*4/3};});return{fileBytes:bytes,textureCount:textures.length,textureMiB:textures.reduce((s,t)=>s+t.bytes,0)/1048576,textures};}
await fs.mkdir(output,{recursive:true});const rows=[];
for(const [name,mode] of Object.entries(spec)){
 if(!/^[a-z0-9-]+$/.test(name)||!['normal','matte'].includes(mode))throw Error('Invalid spec: '+name);
 const raw=await fs.readFile(path.join(input,name+'.glb')),doc=await io.readBinary(raw),signature=geometry(doc),before=stats(doc,raw.length);
 for(const m of doc.getRoot().listMaterials()){
  m.setNormalTexture(null);
  if(mode==='matte')m.setOcclusionTexture(null).setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(.9);
 }
 for(const t of [...doc.getRoot().listTextures()])if(listTextureSlots(t).length===0)t.dispose();
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const out=await io.writeBinary(doc),check=await io.readBinary(out);
 if(geometry(check)!==signature)throw Error(name+': geometry/rig changed; refusing output');
 const after=stats(check,out.length);await fs.writeFile(path.join(output,name+'.glb'),out);rows.push({name,mode,geometryUnchanged:true,before,after,sourceSha256:sha(raw),outputSha256:sha(out)});
 console.log(name+': '+before.textureMiB.toFixed(2)+' -> '+after.textureMiB.toFixed(2)+' MiB; geometry unchanged');
}
const total=key=>rows.reduce((s,r)=>({fileBytes:s.fileBytes+r[key].fileBytes,textureMiB:s.textureMiB+r[key].textureMiB,textureCount:s.textureCount+r[key].textureCount}),{fileBytes:0,textureMiB:0,textureCount:0});
await fs.writeFile(reportFile,JSON.stringify({generatedAt:new Date().toISOString(),estimate:'RGBA8 plus full mip chain; file inventory, not measured GPU memory',before:total('before'),after:total('after'),models:rows},null,2)+'\n');
console.log(JSON.stringify({before:total('before'),after:total('after')}));
