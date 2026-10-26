import sharp from 'sharp';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../../../..');
const out=path.join(root,'public/textures/kit/farm');
const specs=JSON.parse(await readFile(path.join(here,'prompts.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
await mkdir(out,{recursive:true});
const rows=[];
const previous=JSON.parse(await readFile(path.join(here,'manifest.json'),'utf8').catch(()=>'{"images":[]}')).images;
for(const s of specs){
 const input=await readFile(path.resolve(here,s.source)), m=await sharp(input).metadata();
 const prior=previous.find(r=>r.name===s.name);const previousOutput=await readFile(path.join(out,s.name+'.webp')).catch(()=>null);
 if(prior&&prior.sourceSha256===sha(input)&&prior.width===s.width&&prior.height===s.height&&previousOutput&&sha(previousOutput)===prior.sha256){rows.push(prior);continue;}
 // Only packaging: sRGB conversion, resizing to the requested dimensions, WebP encoding.
 // No procedural painting, seam blending, mirroring, recoloring or alpha replacement. Cards only: trim bottom padding and anchor to lower canvas edge.
 const file=path.join(out,s.name+'.webp');
 let pipeline=sharp(input).toColourspace('srgb');let sourceAnchor=null;
 if(s.anchorBottom){const raw=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});let minX=raw.info.width,minY=raw.info.height,maxX=-1,maxY=-1;for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>=16){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(maxY<0)throw Error('No visible content');sourceAnchor={threshold:16,bounds:[minX,minY,maxX,maxY],removedBottomRows:raw.info.height-maxY-1};pipeline=pipeline.extract({left:0,top:0,width:raw.info.width,height:maxY+1}).resize(s.width,s.height,{fit:'contain',position:'south',background:{r:0,g:0,b:0,alpha:0},kernel:'lanczos3'});}
 else pipeline=pipeline.resize(s.width,s.height,{fit:'fill',kernel:'lanczos3'});
 await pipeline.webp({quality:85,alphaQuality:100,effort:6}).toFile(file);
 const bytes=await readFile(file), {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let transparent=0,partial=0,opaque=0,minA=255,maxA=0;let alphaBounds={minX:info.width,minY:info.height,maxX:-1,maxY:-1};let alphaSum=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];alphaSum+=a;if(a>=16){alphaBounds.minX=Math.min(alphaBounds.minX,x);alphaBounds.maxX=Math.max(alphaBounds.maxX,x);alphaBounds.minY=Math.min(alphaBounds.minY,y);alphaBounds.maxY=Math.max(alphaBounds.maxY,y);}}
 const w=info.width,h=info.height,px=(x,y,c)=>data[(y*w+x)*4+c];
 for(let i=3;i<data.length;i+=4){const a=data[i];minA=Math.min(minA,a);maxA=Math.max(maxA,a);if(a===0)transparent++;else if(a===255)opaque++;else partial++;}
 const col=(x)=>Array.from({length:h},(_,y)=>px(x,y,3));
 const row=(y)=>Array.from({length:w},(_,x)=>px(x,y,3));
 const edge=a=>({min:Math.min(...a),max:Math.max(...a),mean:avg(a)});
 const composite=(x,y,c)=>{const a=px(x,y,3)/255;return px(x,y,c)*a+[139,171,63][c]*(1-a);};
 let sx=0,sy=0,bx=0,by=0;
 for(let y=0;y<h;y++)for(let c=0;c<3;c++)sx+=Math.abs(composite(0,y,c)-composite(w-1,y,c));
 for(let x=0;x<w;x++)for(let c=0;c<3;c++)sy+=Math.abs(composite(x,0,c)-composite(x,h-1,c));
 for(let y=0;y<h;y+=8)for(let x=0;x<w-1;x+=8)for(let c=0;c<3;c++)bx+=Math.abs(composite(x,y,c)-composite(x+1,y,c));
 for(let y=0;y<h-1;y+=8)for(let x=0;x<w;x+=8)for(let c=0;c<3;c++)by+=Math.abs(composite(x,y,c)-composite(x,y+1,c));
 rows.push({name:s.name,source:s.source,sourceWidth:m.width,sourceHeight:m.height,sourceSha256:sha(input),output:'public/textures/kit/farm/'+s.name+'.webp',width:w,height:h,bytes:bytes.length,sha256:sha(bytes),sourceAspect:m.width/m.height,outputAspect:w/h,sourceAnchor,alphaBounds,contactMarginBottom:s.anchorBottom?h-1-alphaBounds.maxY:null,packaging:s.anchorBottom?'trim empty bottom by alpha16, contain south; sRGB; WebP85/alpha100':'resize-fill-lanczos3; sRGB; WebP85/alpha100',alpha:{min:minA,max:maxA,mean:alphaSum/(w*h),transparentFraction:transparent/(w*h),partialFraction:partial/(w*h),opaqueFraction:opaque/(w*h),edges:{left:edge(col(0)),right:edge(col(w-1)),top:edge(row(0)),bottom:edge(row(h-1))}},opposingEdgeMeanAbsoluteRgbDifference:{x:sx/(h*3),y:sy/(w*3)},sampledAdjacentPixelMeanAbsoluteRgbDifference:{x:bx/(Math.ceil(h/8)*Math.ceil((w-1)/8)*3),y:by/(Math.ceil((h-1)/8)*Math.ceil(w/8)*3)},seamless:'Not guaranteed by prompt. Opposing-edge measurements and tiled visual review required.'});
}
await writeFile(path.join(here,'manifest.json'),JSON.stringify({schemaVersion:1,tool:'built-in image_gen',scope:'main: five tree cards, soft shadow, contrasted path C',images:rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(x=>({name:x.name,bytes:x.bytes,source:[x.sourceWidth,x.sourceHeight],alpha:x.alpha.transparentFraction,seam:x.opposingEdgeMeanAbsoluteRgbDifference,adjacent:x.sampledAdjacentPixelMeanAbsoluteRgbDifference})),null,2));
