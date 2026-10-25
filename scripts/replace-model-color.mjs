#!/usr/bin/env node
/** Replace the atlas of a single-color GLB. Preserve compressed geometry bytes verbatim. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const [input,atlas,output]=process.argv.slice(2);
if(!input||!atlas||!output||path.resolve(input)===path.resolve(output))throw Error('Usage: replace-model-color.mjs INPUT.glb ATLAS.png OUTPUT.glb; output must differ');
const source=await fs.readFile(input),sha=b=>createHash('sha256').update(b).digest('hex');
if(source.readUInt32LE(0)!==0x46546c67||source.readUInt32LE(4)!==2)throw Error('Expected GLB 2');
const jsonEnd=20+source.readUInt32LE(12),json=JSON.parse(source.subarray(20,jsonEnd));
if(source.readUInt32LE(jsonEnd+4)!==0x004e4942)throw Error('Expected embedded BIN');
if(json.images?.length!==1||json.images[0].mimeType!=='image/webp'||json.images[0].bufferView===undefined)throw Error('Expected exactly one embedded WebP atlas');
const imageView=json.images[0].bufferView,bin=source.subarray(jsonEnd+8),texture=await sharp(atlas).resize(512,512,{fit:'fill'}).webp({quality:88,effort:6}).toBuffer();
const chunks=[],checks=[];let length=0;
function append(bytes){
 const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
 const offset=length;chunks.push(bytes);length+=bytes.length;return offset;
}
for(const [i,view] of json.bufferViews.entries()){
 if(view.buffer===0){
  const previous=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),bytes=i===imageView?texture:previous;
  view.byteOffset=append(bytes);view.byteLength=bytes.length;
  if(i!==imageView)checks.push({offset:view.byteOffset,length:bytes.length,sha:sha(previous)});
 }
 const ext=view.extensions?.EXT_meshopt_compression;
 if(ext?.buffer===0){
  const previous=bin.subarray(ext.byteOffset??0,(ext.byteOffset??0)+ext.byteLength);
  ext.byteOffset=append(previous);checks.push({offset:ext.byteOffset,length:previous.length,sha:sha(previous)});
 }
}
json.buffers[0].byteLength=length;
let jb=Buffer.from(JSON.stringify(json)),bb=Buffer.concat(chunks);
for(const c of checks)if(sha(bb.subarray(c.offset,c.offset+c.length))!==c.sha)throw Error('Geometry bytes changed');
jb=Buffer.concat([jb,Buffer.alloc((4-jb.length%4)%4,0x20)]);bb=Buffer.concat([bb,Buffer.alloc((4-bb.length%4)%4)]);
const h=Buffer.alloc(20),bh=Buffer.alloc(8);
h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+jb.length+bb.length,8);h.writeUInt32LE(jb.length,12);h.writeUInt32LE(0x4e4f534a,16);
bh.writeUInt32LE(bb.length,0);bh.writeUInt32LE(0x004e4942,4);
const out=Buffer.concat([h,jb,bh,bb]);await fs.writeFile(output,out);
console.log(JSON.stringify({sourceBytes:source.length,outputBytes:out.length,textureBytes:texture.length,geometryByteRangesPreserved:checks.length,sourceSha256:sha(source),outputSha256:sha(out)}));
