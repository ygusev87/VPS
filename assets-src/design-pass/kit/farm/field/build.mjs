// Technical packing/resize/WebP encoding only. No procedural artwork, alpha replacement or seam repair.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../../..');
const spec=JSON.parse(await fs.readFile(path.join(here,'prompts.json'),'utf8'));
const log=JSON.parse(await fs.readFile(path.join(here,'generation-log.json'),'utf8'));
const out=path.join(repo,'public/textures/kit/farm');await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const rounded=n=>Number(n.toFixed(6));
async function pixels(file){return sharp(file).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});}
function alphaStats(data,w,h){
 const hist=Array(256).fill(0), b0=[w,h,-1,-1],b128=[w,h,-1,-1];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=data[(y*w+x)*4+3];hist[a]++;
  for(const [b,t] of [[b0,0],[b128,128]])if(a>t){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}
 }
 const edge=(x0,y0,x1,y1)=>{let max=0,total=0,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const a=data[(y*w+x)*4+3];max=Math.max(max,a);total+=a;n++;}return {max,mean:rounded(total/n)};};
 let sx=0,weight=0;const band=Math.max(2,Math.ceil((b128[3]-b128[1]+1)*.02));
 for(let y=Math.max(0,b128[3]-band+1);y<=b128[3];y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(a>128){sx+=(x+.5)*a;weight+=a;}}
 return {alphaMin:hist.findIndex(n=>n),alphaMax:255-[...hist].reverse().findIndex(n=>n),transparentFraction:rounded(hist[0]/(w*h)),nearOpaqueFraction:rounded(hist.slice(250).reduce((a,b)=>a+b,0)/(w*h)),alphaHistogram:hist,boundsAnyAlpha:b0,boundsAlphaAbove128:b128,baseCentroidX:rounded(sx/weight),baseY:b128[3]+1,baseBandPixels:band,edges:{left:edge(0,0,1,h),right:edge(w-1,0,w,h),top:edge(0,0,w,1),bottom:edge(0,h-1,w,h)}};
}
function seamStats(data,w,h){
 const premul=(x,y,c)=>{const i=(y*w+x)*4;return c===3?data[i+3]:data[i+c]*data[i+3]/255;};
 const differences=(y0,y1)=>{let total=0,count=0,max=0;for(let x=0;x<w;x++){const ai=Math.max(data[(y0*w+x)*4+3],data[(y1*w+x)*4+3]);if(ai<16)continue;for(let c=0;c<4;c++){const d=Math.abs(premul(x,y0,c)-premul(x,y1,c));total+=d;max=Math.max(max,d);count++;}}return {mean:count?total/count:0,max,count};};
 const boundary=differences(h-1,0),interior=[];for(let y=1;y<h;y++)interior.push(differences(y-1,y).mean);interior.sort((a,b)=>a-b);
 const median=interior[Math.floor(interior.length*.5)],p95=interior[Math.floor(interior.length*.95)];
 return {method:'Last/first row difference in premultiplied sRGB RGBA, visible columns only; compared with all internal neighbouring rows. Diagnostic, not a perceptual guarantee.',boundaryMean:rounded(boundary.mean),boundaryMax:rounded(boundary.max),interiorMedian:rounded(median),interiorP95:rounded(p95),boundaryToP95:rounded(boundary.mean/p95),pixelIdentical:boundary.max===0,visualReview:'pending triple vertical preview; no seam modification performed'};
}
const results=[];
for(const asset of spec.assets){
 const record=log.find(x=>x.name===asset.name);if(!record)throw Error('Missing source '+asset.name);
 const source=path.join(repo,record.sourcePath),bytes=await fs.readFile(source);if(sha(bytes)!==record.sha256)throw Error('Source SHA changed');
 const raw=await pixels(bytes),before=alphaStats(raw.data,raw.info.width,raw.info.height);
 if(before.transparentFraction===0||before.nearOpaqueFraction===0)throw Error('Not usable RGBA '+asset.name);
 let pipeline=sharp(bytes).toColourspace('srgb');let transform={operation:'resize',fit:'fill',sourceRect:[0,0,raw.info.width,raw.info.height]};
 if(asset.name.startsWith('wheat-card')){
  // Retain every nonzero-alpha pixel; align the visible stem-base centroid horizontally.
  const [x0,y0,x1,y1]=before.boundsAnyAlpha,w=x1-x0+1,h=y1-y0+1,baseX=before.baseCentroidX-x0;
  const scale=Math.min(508/h,252/Math.max(baseX,w-baseX));
  const rw=Math.max(1,Math.floor(w*scale)),rh=Math.max(1,Math.floor(h*scale));
  const left=Math.max(0,Math.min(512-rw,Math.round(256-baseX*rw/w))),top=512-rh;
  pipeline=pipeline.extract({left:x0,top:y0,width:w,height:h}).resize(rw,rh,{kernel:'lanczos3'}).extend({left,right:512-rw-left,top,bottom:0,background:{r:0,g:0,b:0,alpha:0}});
  transform={operation:'trim fully transparent margin, uniform resize, transparent canvas packing',sourceRect:[x0,y0,w,h],resized:[rw,rh],padding:{left,right:512-rw-left,top,bottom:0},note:'No alpha thresholding. Very faint original edge pixels are retained. Measured visible base pivot is reported separately.'};
 }else pipeline=pipeline.resize(asset.targetSize[0],asset.targetSize[1],{fit:'fill',kernel:'lanczos3'});
 const target=path.join(out,asset.name+'.webp');
 const encoded=await pipeline.webp({quality:85,alphaQuality:100,effort:6}).toBuffer();
 const final=await pixels(encoded),after=alphaStats(final.data,final.info.width,final.info.height),metadata=await sharp(encoded).metadata();
 if(final.info.width!==asset.targetSize[0]||final.info.height!==asset.targetSize[1]||!metadata.hasAlpha)throw Error('Wrong output '+asset.name);
 await fs.writeFile(target,encoded);
 const entry={name:asset.name,source:record.sourcePath,sourceSha256:record.sha256,sourceSize:[raw.info.width,raw.info.height],path:path.relative(repo,target),bytes:encoded.length,sha256:sha(encoded),size:asset.targetSize,colourSpace:'sRGB',format:'WebP',quality:85,alphaQuality:100,transform,sourceAlpha:before,alpha:after,visualReview:'pending'};
 if(asset.name.startsWith('wheat-card')) entry.pivot={origin:'top-left pixel coordinates',pixels:[after.baseCentroidX,after.baseY],normalized:[rounded(after.baseCentroidX/512),rounded(after.baseY/512)],threeSpriteCenter:[rounded(after.baseCentroidX/512),rounded(1-after.baseY/512)],criterion:'Alpha-weighted x centroid of lowest 2% of visible silhouette (alpha>128), y just below its last visible row. This measures the stem base, not all faint alpha residue.'};
 if(asset.name==='ruts-strip')entry.verticalSeam=seamStats(final.data,final.info.width,final.info.height);
 results.push(entry);console.log(asset.name,encoded.length,'bytes',asset.targetSize.join('x'),entry.pivot?JSON.stringify(entry.pivot.normalized):'');
}
let review=null;
try { review=JSON.parse(await fs.readFile(path.join(here,'qa-review.json'),'utf8')); } catch(e) { if(e.code!=='ENOENT')throw e; }
for(const entry of results){
 const checked=review?.assets.find(a=>a.name===entry.name&&a.sha256===entry.sha256);
 if(checked){entry.visualReview={status:checked.status,note:checked.note,record:'qa-review.json'};if(entry.verticalSeam)entry.verticalSeam.visualReview=checked.note;}
}
const reviewed=results.every(a=>typeof a.visualReview==='object');
await fs.writeFile(path.join(here,'manifest.json'),JSON.stringify({schemaVersion:1,status:reviewed?'visually reviewed; ruts-strip conditional, not verified seamless':'encoded, visual review pending',generationCalls:7,repeatedGenerations:0,artworkEdits:0,alphaPolicy:'Generated alpha retained; only resampling/packing/WebP alpha encoding. No opaque fill, chroma key, thresholding, painted masks or procedural art.',bedSizeAmendment:'Claude m0375/m0376: 1024x848 (multiple of16), supersedes original854.',kitJsonOwner:'main; this script does not write kit.json',assets:results},null,2)+'\n');
