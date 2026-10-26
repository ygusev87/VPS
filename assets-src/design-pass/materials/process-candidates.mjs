import sharp from 'sharp';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('.',import.meta.url).pathname.replace(/\/$/,'');
await mkdir(root+'/candidates',{recursive:true});
const report=[];
for(const [id,size,quality] of [['pig-mud',1024,88],['path-earth',512,90]]){
 const src=root+'/sources/'+id+'-v1.png',out=root+'/candidates/'+id+'-v1.webp';
 await sharp(src).resize(size,size,{fit:'fill'}).removeAlpha().webp({quality,effort:6}).toFile(out);
 const buf=await readFile(out),meta=await sharp(buf).metadata();
 report.push({id,sourceSize:await sharp(src).metadata().then(m=>[m.width,m.height]),size:[meta.width,meta.height],bytes:buf.length,sha256:createHash('sha256').update(buf).digest('hex'),processing:'Mechanical resize and WebP encoding; no painted or procedural replacement of artwork',quality});
}
const maskSrc=root+'/sources/pig-wetness-v1.png';
const {data,info}=await sharp(maskSrc).resize(256,256,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
const dst=Buffer.alloc(256*256*3);let wet=0,puddle=0;
// Convert generated mask artwork to normalized channel DATA. Clamp compression/noise
// near endpoints, keep the generated boundary antialiasing; never alter puddle geometry.
const encode=v=>Math.round(Math.max(0,Math.min(1,(v-16)/223))*255);
for(let i=0;i<256*256;i++){const r=encode(data[i*info.channels]),g=Math.min(r,encode(data[i*info.channels+1]));dst[i*3]=r;dst[i*3+1]=g;dst[i*3+2]=0;if(r>127)wet++;if(g>127)puddle++;}
const out=root+'/candidates/pig-wetness-v1.png';
await sharp(dst,{raw:{width:256,height:256,channels:3}}).png({compressionLevel:9}).toFile(out);
const buf=await readFile(out);
report.push({id:'pig-wetness',size:[256,256],bytes:buf.length,sha256:createHash('sha256').update(buf).digest('hex'),colorSpace:'NoColorSpace/linear data; PNG contains no ICC',channels:'R damp soil + puddles; G puddle interiors; B zero; G<=R',wetPixels:wet,puddlePixels:puddle,processing:'Resize generated registered mask; normalize 16..239 to0..255 to remove near-endpoint generator noise; enforce G<=R, B=0; lossless PNG'});
await writeFile(root+'/candidates/report-v1.json',JSON.stringify({status:'candidate-for-integration',assets:report,totalBytes:report.reduce((s,a)=>s+a.bytes,0)},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
