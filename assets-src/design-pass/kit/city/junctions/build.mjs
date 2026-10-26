import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../..'),out=path.join(root,'public/textures/kit/city');
const specs=JSON.parse(await readFile(path.join(here,'prompts.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const rows=[];await mkdir(out,{recursive:true});
for(const s of specs){
 const input=await readFile(path.resolve(here,s.source)),meta=await sharp(input).metadata();
 const raw=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let crop={left:0,top:0,width:meta.width,height:meta.height};
 if(s.name==='road-corner'||s.name==='road-end'){
  // Trim only outer empty framing. Retain all alpha values inside the rectangle.
  let x0=meta.width,y0=meta.height,x1=-1,y1=-1;
  for(let y=0;y<meta.height;y++)for(let x=0;x<meta.width;x++)if(raw.data[(y*meta.width+x)*4+3]>=16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  crop={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
 }
 let discardedAlpha=0,totalAlpha=0;
 for(let y=0;y<meta.height;y++)for(let x=0;x<meta.width;x++){const a=raw.data[(y*meta.width+x)*4+3];totalAlpha+=a;if(x<crop.left||y<crop.top||x>=crop.left+crop.width||y>=crop.top+crop.height)discardedAlpha+=a;}
 const dest=path.join(out,s.name+'.webp');
 await sharp(input).extract(crop).toColourspace('srgb').resize(s.width,s.height,{fit:'fill',kernel:'lanczos3'}).webp({quality:85,alphaQuality:100,effort:6}).toFile(dest);
 const bytes=await readFile(dest),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,at=(x,y,c)=>data[(y*w+x)*4+c];
 let z=0,p=0,o=0,a16=0,a114=0,min=255,max=0;
 for(let i=3;i<data.length;i+=4){const a=data[i];min=Math.min(min,a);max=Math.max(max,a);if(!a)z++;else if(a===255)o++;else p++;if(a>=16)a16++;if(a>=114)a114++;}
 const edge=(points)=>{let alphaMin=255,alphaMax=0,alphaSum=0;const curb=[];for(let i=0;i<points.length;i++){const [x,y]=points[i],r=at(x,y,0),g=at(x,y,1),b=at(x,y,2),a=at(x,y,3);alphaMin=Math.min(alphaMin,a);alphaMax=Math.max(alphaMax,a);alphaSum+=a;if(a>=114&&r>g+5&&r>b+20&&r>150)curb.push(i);}return {alphaMin,alphaMax,alphaMean:alphaSum/points.length,curbIndices:curb.length?{first:curb[0],last:curb.at(-1),count:curb.length}:null};};
 let center=[0,0,0],samples=0;for(let y=Math.floor(h*.4);y<h*.6;y++)for(let x=Math.floor(w*.4);x<w*.6;x++){if(at(x,y,3)<114)continue;for(let c=0;c<3;c++)center[c]+=at(x,y,c);samples++;}
 rows.push({name:s.name,source:s.source,sourceWidth:meta.width,sourceHeight:meta.height,sourceSha256:sha(input),crop,discardedAlphaFraction:discardedAlpha/totalAlpha,output:'public/textures/kit/city/'+s.name+'.webp',width:w,height:h,bytes:bytes.length,sha256:sha(bytes),packaging:'outer framing trim for corner/end at alpha>=16 bounds only; retain native alpha; sRGB; resize-fill Lanczos3; WebP quality85 alpha100',alpha:{min,max,zeroFraction:z/(w*h),partialFraction:p/(w*h),opaqueFraction:o/(w*h),visible16Fraction:a16/(w*h),visible114Fraction:a114/(w*h),edges:{left:edge(Array.from({length:h},(_,y)=>[0,y])),right:edge(Array.from({length:h},(_,y)=>[w-1,y])),top:edge(Array.from({length:w},(_,x)=>[x,0])),bottom:edge(Array.from({length:w},(_,x)=>[x,h-1]))}},centerMeanRGB:center.map(v=>v/samples)});
}
await writeFile(path.join(here,'manifest.json'),JSON.stringify({schemaVersion:1,tool:'built-in image_gen',images:rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,bytes:r.bytes,crop:r.crop,alpha:r.alpha.zeroFraction,discarded:r.discardedAlphaFraction,bottom:r.alpha.edges.bottom})),null,2));
