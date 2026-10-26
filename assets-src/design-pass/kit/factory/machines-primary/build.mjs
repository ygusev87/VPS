import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const specs=JSON.parse(await readFile(path.join(here,'prompts.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(path.join(here,'previews'),{recursive:true});
const rows=[];
for(const s of specs){
 const source=s.selectedSource||'concepts/'+s.name+'.png',bytes=await readFile(path.join(here,source)),m=await sharp(bytes).metadata();
 const preview=s.selectedPreview||'previews/'+s.name+'.webp';
 await sharp(bytes).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).toColourspace('srgb').webp({quality:90,effort:6}).toFile(path.join(here,preview));
 const pb=await readFile(path.join(here,preview)),pm=await sharp(pb).metadata();
 rows.push({name:s.name,source,width:m.width,height:m.height,bytes:bytes.length,sha256:sha(bytes),preview,previewWidth:pm.width,previewHeight:pm.height,previewBytes:pb.length,previewSha256:sha(pb),referenceImages:await Promise.all(s.refs.map(async p=>({path:p,sha256:sha(await readFile(p))}))),generation:s.generationLabel||'built-in image_gen; one initial call, no correction',correctionRecord:s.correctionRecord||null,status:'reference-only; no GLB generated; no external upload',packaging:'original PNG preserved byte-for-byte; only resize/sRGB/WebP for local review'});
}
await writeFile(path.join(here,'manifest.json'),JSON.stringify({schemaVersion:1,tool:'built-in image_gen',assets:rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,size:[r.width,r.height],bytes:r.bytes,previewBytes:r.previewBytes})),null,2));
