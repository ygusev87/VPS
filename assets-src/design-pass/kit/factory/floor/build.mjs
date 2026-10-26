// Measured joint-centre crop, resize/encode and diagnostics; no seam blending or procedural artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../../../..');
const spec=JSON.parse(await fs.readFile(path.join(here,'prompts.json'),'utf8'));
const log=JSON.parse(await fs.readFile(path.join(here,'generation-log.json'),'utf8'));
const packaging=JSON.parse(await fs.readFile(path.join(here,'packaging.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex'),round=n=>Number(n.toFixed(6));
function jointPhase(data,w,h){
 const col=new Float64Array(w),row=new Float64Array(h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*3,v=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];col[x]+=v/h;row[y]+=v/w;}
 function axis(p){const n=p.length,windows=[[0,.035],[.215,.285],[.465,.535],[.715,.785],[.965,1]],positions=windows.map(([lo,hi])=>{let best=Infinity,at=-1;for(let k=Math.ceil(lo*n);k<Math.min(n,Math.floor(hi*n));k++){let sum=0,count=0;for(let d=-1;d<=1;d++)if(k+d>=0&&k+d<n){sum+=p[k+d];count++;}if(sum/count<best){best=sum/count;at=k;}}return at;});return{darkJointCentresPixels:positions,normalised:positions.map(x=>round(x/n)),interiorSpacingPixels:positions.slice(1).map((x,i)=>x-positions[i]),outerInsetsPixels:[positions[0],n-1-positions[4]],repeatBoundaryDistanceBetweenOuterJointCentres:n-positions[4]+positions[0],note:'Minima of averaged luminance in five expected grid windows; 3px smoothing for measurement only. Separated inset minima can indicate a doubled repeat seam; adjacent minima 1–2px apart across the wrap belong to the same continuous joint. Visual review is required.'};}
 return{expectedGrid:[4,4],x:axis(col),y:axis(row)};
}
function measurements(data,w,h){
 const cx=new Float64Array(w-1),cy=new Float64Array(h-1),means=[0,0,0],edges={left:[0,0,0],right:[0,0,0],top:[0,0,0],bottom:[0,0,0]},band=32;
 let bx=0,by=0,mx=0,my=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++){
  const i=(y*w+x)*3+c,v=data[i];means[c]+=v;
  if(x)cx[x-1]+=Math.abs(v-data[i-3]);if(y)cy[y-1]+=Math.abs(v-data[i-w*3]);
  if(x<band)edges.left[c]+=v;if(x>=w-band)edges.right[c]+=v;if(y<band)edges.top[c]+=v;if(y>=h-band)edges.bottom[c]+=v;
 }
 for(let y=0;y<h;y++)for(let c=0;c<3;c++){const d=Math.abs(data[(y*w)*3+c]-data[(y*w+w-1)*3+c]);bx+=d;mx=Math.max(mx,d);}
 for(let x=0;x<w;x++)for(let c=0;c<3;c++){const d=Math.abs(data[x*3+c]-data[((h-1)*w+x)*3+c]);by+=d;my=Math.max(my,d);}
 function axis(values,div,b,max){const a=Array.from(values,x=>x/div).sort((a,b)=>a-b),med=a[Math.floor(a.length*.5)],p95=a[Math.floor(a.length*.95)];return{boundaryMean:round(b/div),boundaryMax:max,interiorMedian:round(med),interiorP95:round(p95),boundaryToP95:round((b/div)/p95),pixelIdentical:max===0};}
 for(const e of ['left','right'])edges[e]=edges[e].map(x=>round(x/(band*h)));
 for(const e of ['top','bottom'])edges[e]=edges[e].map(x=>round(x/(band*w)));
 return{meanRGB:means.map(x=>round(x/(w*h))),edgeBandPixels:band,edgeMeanRGB:edges,jointPhase:jointPhase(data,w,h),seams:{method:'First/last line absolute RGB differences compared with internal adjacent-line mean distribution at encoded2048 resolution. Diagnostic only; not a perceptual or seamlessness guarantee.',leftRight:axis(cx,h*3,bx,mx),topBottom:axis(cy,w*3,by,my)}};
}
let review=null;try{review=JSON.parse(await fs.readFile(path.join(here,'qa-review.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const assets=[];
for(const a of spec.assets){
 const r=log.find(x=>x.name===a.name);if(!r)throw Error('Missing source '+a.name);
 const original=await fs.readFile(path.join(repo,r.sourcePath));if(sha(original)!==r.sha256)throw Error('Source changed '+a.name);
 const sm=await sharp(original).metadata();
 if(sm.hasAlpha){const st=await sharp(original).stats();if(st.channels.at(-1).min!==255)throw Error('Unexpected nonopaque source '+a.name);}
 const pack=packaging.assets.find(x=>x.name===a.name);if(!pack)throw Error('Missing crop '+a.name);
 const crop=pack.crop;if(crop.left<0||crop.top<0||crop.width<=0||crop.height<=0||crop.left+crop.width>sm.width||crop.top+crop.height>sm.height)throw Error('Invalid crop '+a.name);
 const encoded=await sharp(original).extract(crop).toColourspace('srgb').removeAlpha().resize(...a.targetSize,{fit:'fill',kernel:'lanczos3'}).webp({quality:85,effort:5}).toBuffer();
 const meta=await sharp(encoded).metadata();if(meta.width!==2048||meta.height!==2048||meta.hasAlpha)throw Error('Invalid output '+a.name);
 const raw=await sharp(encoded).removeAlpha().raw().toBuffer({resolveWithObject:true});if(raw.info.channels!==3)throw Error('Unexpected RGB channels');
 const target='public/textures/kit/factory/'+a.name+'.webp',hash=sha(encoded);await fs.writeFile(path.join(repo,target),encoded);
 const checked=review?.assets.find(v=>v.name===a.name&&v.sha256===hash);
 const effectiveSlabWorldSize={};for(const axis of ['x','y']){const centres=pack.sourceJointCentres[axis],span=axis==='x'?crop.width:crop.height;effectiveSlabWorldSize[axis]=centres.slice(1).map((p,i)=>round((p-centres[i])*8/span));}
 assets.push({name:a.name,path:target,size:a.targetSize,worldCoverage:a.worldCoverage,bytes:encoded.length,sha256:hash,source:r.sourcePath,sourceSha256:r.sha256,sourceSize:[sm.width,sm.height],format:'WebP',colourSpace:'sRGB',quality:85,opaque:true,transform:{operation:'joint-centre rectangle crop, Lanczos resize, sRGB conversion, WebP encoding',crop,scaleXY:[round(2048/crop.width),round(2048/crop.height)],upscaled:true,sourceJointCentres:pack.sourceJointCentres,gridCells:pack.gridCells,averageSlabWorldSize:pack.averageSlabWorldSize,effectiveSlabWorldSize,proceduralSeamEdits:false,sourceImageEdits:r.targetedEdits?.length??0},...measurements(raw.data,meta.width,meta.height),visualReview:checked?{status:checked.status,note:checked.note,record:'qa-review.json'}:'pending'});
 console.log(a.name,encoded.length,'bytes',JSON.stringify(assets.at(-1).seams));
}
await fs.writeFile(path.join(here,'manifest.json'),JSON.stringify({schemaVersion:2,status:assets.every(a=>typeof a.visualReview==='object')?'visually reviewed; see per-asset seam limitations':'encoded; visual seam review pending',generationCalls:log.reduce((n,r)=>n+r.callCount,0),initialGenerations:log.length,targetedEditCalls:log.reduce((n,r)=>n+(r.targetedEdits?.length??0),0),repeatedGenerations:0,artworkEdits:log.reduce((n,r)=>n+(r.targetedEdits?.length??0),0),processing:'Measured joint-centre crop followed by resize/encode. No periodic blending, mirroring, colour correction, procedural drawing or painted seam repair. Full source PNGs preserved byte-exact.',kitJsonOwner:'main; never written here',totalBytes:assets.reduce((s,a)=>s+a.bytes,0),assets},null,2)+'\n');
