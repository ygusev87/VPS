// Technical image processing only: keep generated artwork and alpha.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../../../..');
const spec=JSON.parse(await fs.readFile(path.join(here,'prompts.json'),'utf8'));
const log=JSON.parse(await fs.readFile(path.join(here,'generation-log.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex'),round=n=>Number(n.toFixed(6));
async function pixels(b){return sharp(b).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});}
function alphaStats(data,w,h){
 const hist=Array(256).fill(0),bounds=[w,h,-1,-1],fringe=[w,h,-1,-1],visible=[w,h,-1,-1],edges={left:0,right:0,top:0,bottom:0};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=data[(y*w+x)*4+3];hist[a]++;
  for(const [b,t] of [[bounds,0],[fringe,16],[visible,128]])if(a>t){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}
  if(x===0)edges.left=Math.max(edges.left,a);if(x===w-1)edges.right=Math.max(edges.right,a);if(y===0)edges.top=Math.max(edges.top,a);if(y===h-1)edges.bottom=Math.max(edges.bottom,a);
 }
 const band=Math.max(2,Math.ceil((visible[3]-visible[1]+1)*.02));let sx=0,weight=0;
 for(let y=Math.max(0,visible[3]-band+1);y<=visible[3];y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(a>128){sx+=(x+.5)*a;weight+=a;}}
 return {min:hist.findIndex(n=>n),max:255-[...hist].reverse().findIndex(n=>n),transparentFraction:round(hist[0]/(w*h)),nearOpaqueFraction:round(hist.slice(250).reduce((a,b)=>a+b,0)/(w*h)),boundsAnyAlpha:bounds,boundsAlphaAbove16:fringe,boundsAlphaAbove128:visible,edgeMax:edges,baseCentroidX:round(sx/weight),baseY:visible[3]+1,baseBandPixels:band};
}
let review=null;try{review=JSON.parse(await fs.readFile(path.join(here,'qa-review.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const assets=[];
for(const asset of spec.assets){
 const record=log.find(x=>x.name===asset.name);if(!record)throw Error('Missing source '+asset.name);
 const source=await fs.readFile(path.join(repo,record.sourcePath));if(sha(source)!==record.sha256)throw Error('Source SHA changed '+asset.name);
 const raw=await pixels(source),before=alphaStats(raw.data,raw.info.width,raw.info.height),n=asset.targetSize[0];
 if(!before.transparentFraction||!before.nearOpaqueFraction)throw Error('Source alpha missing '+asset.name);
 // Rectangle only: leave every retained alpha value unchanged. Keep an 8px safety
 // margin around alpha>16, removing only distant faint generated background residue.
 const b=before.boundsAlphaAbove16,x0=Math.max(0,b[0]-8),y0=Math.max(0,b[1]-8),x1=Math.min(raw.info.width-1,b[2]+8),y1=Math.min(raw.info.height-1,b[3]+8);
 const w=x1-x0+1,h=y1-y0+1,baseX=(asset.kind==='tree'?before.baseCentroidX:(before.boundsAlphaAbove128[0]+before.boundsAlphaAbove128[2]+1)/2)-x0;
 let discardedNonzero=0,discardedMax=0,discardedWeight=0,totalWeight=0;
 for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++){const a=raw.data[(y*raw.info.width+x)*4+3];totalWeight+=a;if(x<x0||x>x1||y<y0||y>y1){discardedWeight+=a;discardedMax=Math.max(discardedMax,a);if(a)discardedNonzero++;}}
 if(discardedMax>16)throw Error('Crop removes plant pixels '+asset.name);
 const scale=Math.min((n-4)/h,(n/2-2)/Math.max(baseX,w-baseX)),rw=Math.max(1,Math.floor(w*scale)),rh=Math.max(1,Math.floor(h*scale));
 const left=Math.max(0,Math.min(n-rw,Math.round(n/2-baseX*rw/w))),top=n-rh;
 const encoded=await sharp(source).toColourspace('srgb').extract({left:x0,top:y0,width:w,height:h}).resize(rw,rh,{kernel:'lanczos3'}).extend({left,right:n-rw-left,top,bottom:0,background:{r:0,g:0,b:0,alpha:0}}).webp({quality:85,alphaQuality:100,effort:5}).toBuffer();
 const final=await pixels(encoded),after=alphaStats(final.data,n,n),meta=await sharp(encoded).metadata();
 if(meta.width!==n||meta.height!==n||!meta.hasAlpha)throw Error('Output invalid '+asset.name);
 const target='public/textures/kit/city/'+asset.name+'.webp';await fs.writeFile(path.join(repo,target),encoded);
 const hash=sha(encoded),checked=review?.assets.find(a=>a.name===asset.name&&a.sha256===hash);
 const anchorX=asset.kind==='tree'?after.baseCentroidX:(after.boundsAlphaAbove128[0]+after.boundsAlphaAbove128[2]+1)/2;
 assets.push({name:asset.name,kind:asset.kind,path:target,size:[n,n],bytes:encoded.length,sha256:hash,source:record.sourcePath,sourceSha256:record.sha256,sourceSize:[raw.info.width,raw.info.height],format:'WebP',colourSpace:'sRGB',quality:85,alphaQuality:100,transform:{operation:'rectangular margin crop around alpha>16 plus8 source pixels; retained alpha unchanged; uniform Lanczos resize; transparent packing',sourceRect:[x0,y0,w,h],cropAudit:{discardedNonzeroPixels:discardedNonzero,discardedAlphaMax:discardedMax,discardedFractionOfTotalAlpha:discardedWeight/totalWeight,discardedAlphaAbove16Pixels:0},resized:[rw,rh],padding:{left,right:n-rw-left,top,bottom:0}},sourceAlpha:before,alpha:after,pivot:{pixels:[anchorX,after.baseY],normalizedTopLeft:[round(anchorX/n),round(after.baseY/n)],threeSpriteCenter:[round(anchorX/n),round(1-after.baseY/n)],criterion:asset.kind==='tree'?'X alpha-weighted centroid of lowest visible2% band of trunk/root silhouette; Y immediately below last alpha>128 row.':'X midpoint of visible alpha>128 silhouette bounds; Y immediately below last visible row. Bottom-centre placement anchor, not hidden botanical root.'},visualReview:checked?{status:checked.status,note:checked.note,record:'qa-review.json'}:'pending'});
 console.log(asset.name,encoded.length,'bytes',JSON.stringify(assets.at(-1).pivot.threeSpriteCenter));
}
await fs.writeFile(path.join(here,'manifest.json'),JSON.stringify({schemaVersion:1,status:assets.every(a=>typeof a.visualReview==='object')?'visually reviewed; runtime acceptance pending':'encoded; visual review pending',generationCalls:log.length,repeatedGenerations:0,artworkEdits:0,alphaPolicy:'Native generated alpha retained within a technical rectangular crop; discarded distant residue measured per file. No pixel alpha thresholding, chroma key, repaint, color grading or procedural art. Full originals retained.',kitJsonOwner:'main; never written here',totalBytes:assets.reduce((s,a)=>s+a.bytes,0),assets},null,2)+'\n');
