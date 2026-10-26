// Metadata only: generated concept PNGs are never transformed or repainted.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir=path.dirname(fileURLToPath(import.meta.url));
const prompts=JSON.parse(await fs.readFile(path.join(dir,'prompts.json'),'utf8'));
const log=JSON.parse(await fs.readFile(path.join(dir,'generation-log.json'),'utf8'));
let review=null;try{review=JSON.parse(await fs.readFile(path.join(dir,'qa-review.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const assets=[];
for(const spec of prompts){
 const record=log.find(r=>r.name===spec.name),b=await fs.readFile(path.join(dir,record.path)),sha=createHash('sha256').update(b).digest('hex');
 if(sha!==record.sha256)throw Error('Original hash mismatch: '+spec.name);
 const meta=await sharp(b).metadata();
 const qa=review?.assets.find(a=>a.name===spec.name&&a.sha256===sha);
 assets.push({name:spec.name,label:spec.label,path:record.path,bytes:b.length,sha256:sha,size:[meta.width,meta.height],format:meta.format,hasAlpha:meta.hasAlpha,colourSpace:meta.space,sourcePreservedByteExact:true,transforms:[],targetBodySizeWHDepth:spec.size,targetPart:spec.part,movingPartsContract:spec.moving,status:qa?.status??'awaiting-concept-review',actualGLB:'pending',dimensionsVerified:false,dimensionsNote:'Image proportions are visual only. Bounding box, mounting anchors, nodes and material budget must be verified on the future GLB.',initialGenerations:1,edits:0});
}
const manifest={schemaVersion:1,kind:'future-GLB-concepts-only',tool:'image_gen.imagegen',calls:4,initialGenerations:4,edits:0,actualGLB:'pending',external3DOrders:0,paidAPIUsage:0,externalUploads:0,targetGLBBudget:{trianglesMax:4000,materials:1,textureResolution:[512,1024],textureFormat:'WebP'},references:'references.json',promptSet:'prompts.json',generationLog:'generation-log.json',totalBytes:assets.reduce((s,a)=>s+a.bytes,0),assets};
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({assets:assets.map(a=>({name:a.name,size:a.size,bytes:a.bytes,status:a.status})),totalBytes:manifest.totalBytes}));
