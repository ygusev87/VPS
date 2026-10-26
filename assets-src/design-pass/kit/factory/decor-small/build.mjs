// Technical packaging only: alpha-bounds crop, proportional resize, WebP encoding.
// No drawn pixels, masking, alpha thresholding, shadow removal, or colour corrections.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../../../..');
const spec=JSON.parse(await fs.readFile(path.join(here,'prompts.json'),'utf8'));
const sources=JSON.parse(await fs.readFile(path.join(here,'generation-log.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex'),round=n=>Number(n.toFixed(6));
function alphaMetrics(data,w,h){
 const thresholds=[1,8,128],boxes=thresholds.map(threshold=>({threshold,left:w,top:h,right:-1,bottom:-1,pixels:0}));
 const bins=new Array(256).fill(0),outerEdgeNonzero=[0,0,0,0],outerEdgeVisible=[0,0,0,0];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];bins[a]++;for(const b of boxes)if(a>=b.threshold){b.left=Math.min(b.left,x);b.top=Math.min(b.top,y);b.right=Math.max(b.right,x);b.bottom=Math.max(b.bottom,y);b.pixels++;}for(const [edge,at] of [[0,x===0],[1,y===0],[2,x===w-1],[3,y===h-1]])if(at){if(a>0)outerEdgeNonzero[edge]++;if(a>=8)outerEdgeVisible[edge]++;}}
 for(const b of boxes){b.width=b.right-b.left+1;b.height=b.bottom-b.top+1;}
 return {boxes,transparentPixels:bins[0],opaquePixels:bins[255],semiTransparentPixels:w*h-bins[0]-bins[255],transparentFraction:round(bins[0]/(w*h)),outerEdgeOrder:['left','top','right','bottom'],outerEdgeNonzero,outerEdgeVisible,alphaPreservedFromGenerator:true};
}
let reviews=null;try{reviews=JSON.parse(await fs.readFile(path.join(here,'qa-review.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const assets=[];
for(const s of spec.assets){
 const source=sources.find(x=>x.name===s.name),bytes=await fs.readFile(path.join(repo,source.sourcePath));if(sha(bytes)!==source.sha256)throw Error('Source SHA mismatch '+s.name);
 const sm=await sharp(bytes).metadata();if(!sm.hasAlpha)throw Error('Missing native alpha '+s.name);
 const raw=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const sourceAlpha=alphaMetrics(raw.data,sm.width,sm.height),visible=sourceAlpha.boxes.find(b=>b.threshold===8);
 if(!sourceAlpha.transparentPixels||visible.width<=0||visible.height<=0)throw Error('Invalid transparency '+s.name);
 const margin=Math.ceil(Math.max(visible.width,visible.height)*.02),left=Math.max(0,visible.left-margin),top=Math.max(0,visible.top-margin),right=Math.min(sm.width,visible.right+1+margin),bottom=Math.min(sm.height,visible.bottom+1+margin),crop={left,top,width:right-left,height:bottom-top};
 const resize=crop.width>=crop.height?{width:s.targetLongSide}:{height:s.targetLongSide};
 const output=await sharp(bytes).extract(crop).toColourspace('srgb').resize({...resize,kernel:'lanczos3'}).webp({quality:88,alphaQuality:100,effort:5}).toBuffer();
 const om=await sharp(output).metadata(),oraw=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(!om.hasAlpha||Math.max(om.width,om.height)!==s.targetLongSide)throw Error('Output contract '+s.name);
 const alpha=alphaMetrics(oraw.data,om.width,om.height),bbox=alpha.boxes.find(b=>b.threshold===8),visibleWidthFactor=bbox.width/om.width,rectWorldWidth=s.visibleWorldWidth/visibleWidthFactor,rectWorldHeight=rectWorldWidth*om.height/om.width;
 const anchorTopLeft=[(bbox.left+bbox.width/2)/om.width,(bbox.bottom+1)/om.height];
 const outPath='public/textures/kit/factory/'+s.name+'.webp',hash=sha(output);await fs.writeFile(path.join(repo,outPath),output);
 const review=reviews?.assets.find(a=>a.name===s.name&&a.sha256===hash);
 assets.push({name:s.name,path:outPath,sha256:hash,bytes:output.length,size:[om.width,om.height],format:'WebP',colourSpace:'sRGB',quality:88,alphaQuality:100,nativeAlpha:true,source:source.sourcePath,sourceSha256:source.sha256,sourceSize:[sm.width,sm.height],sourceAlpha,transform:{operation:'alpha-bounds crop with2% margin, proportional Lanczos resize, sRGB, WebP encode',boundsThreshold:8,thresholdForMeasurementOnly:true,alphaUnmodifiedWithinCrop:true,crop,requestedMarginSourcePixels:margin,scale:round(Math.max(om.width,om.height)/Math.max(crop.width,crop.height)),upscaled:Math.max(crop.width,crop.height)<s.targetLongSide,proceduralDrawing:false},alpha,aspect:round(om.width/om.height),visibleAspect:round(bbox.width/bbox.height),visibleWidthFactor:round(visibleWidthFactor),visibleWorldWidth:s.visibleWorldWidth,visibleWorldHeight:round(s.visibleWorldWidth*bbox.height/bbox.width),requestedVisibleWorldHeightApprox:s.requestedVisibleWorldHeightApprox??null,rectangleWorldSize:[round(rectWorldWidth),round(rectWorldHeight)],anchor:{definition:'Bottom centre of alpha>=8 visible bounding box. Image coordinates top-left origin. Sprite centre uses bottom-left origin.',normalisedTopLeft:anchorTopLeft.map(round),spriteCenter:[round(anchorTopLeft[0]),round(1-anchorTopLeft[1])]},camera:{requestedElevationDegrees:52,projection:'orthographic three-quarter, image-model approximation; no exact camera calibration'},visualReview:review?{status:review.status,note:review.note,record:'qa-review.json'}:'pending'});
 console.log(JSON.stringify({name:s.name,bytes:output.length,size:assets.at(-1).size,aspect:assets.at(-1).aspect,visibleWidthFactor:assets.at(-1).visibleWidthFactor,visibleHeight:assets.at(-1).visibleWorldHeight,anchor:assets.at(-1).anchor.normalisedTopLeft,crop,sourceVisibleEdges:sourceAlpha.outerEdgeVisible,outputVisibleEdges:alpha.outerEdgeVisible}));
}
await fs.writeFile(path.join(here,'manifest.json'),JSON.stringify({schemaVersion:1,status:assets.every(a=>typeof a.visualReview==='object')?'reviewed; see per-asset notes':'encoded; visual review pending',generationCalls:sources.reduce((n,s)=>n+s.callCount,0),initialGenerations:sources.length,targetedEditCalls:sources.reduce((n,s)=>n+s.targetedEdits.length,0),totalBytes:assets.reduce((n,a)=>n+a.bytes,0),kitJsonOwner:'main; never edited here',assets},null,2)+'\n');
