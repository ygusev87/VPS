// Technical encoding only; preserve the generated composition and native alpha.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../..');
const src=await fs.readFile(path.join(here,'sources/factory-tool-board-v1.png'));
const sm=await sharp(src).metadata();
const output=await sharp(src).resize({width:512,kernel:'lanczos3'}).webp({quality:90,alphaQuality:100,effort:5}).toBuffer();
const om=await sharp(output).metadata();
if(!sm.hasAlpha||!om.hasAlpha) throw Error('Native alpha required');
const file='public/textures/kit/factory/factory-tool-board.webp';
await fs.writeFile(path.join(root,file),output);
const raw=await sharp(output).ensureAlpha().raw().toBuffer();
let minX=om.width,minY=om.height,maxX=-1,maxY=-1,transparent=0,opaque=0;
for(let y=0;y<om.height;y++) for(let x=0;x<om.width;x++) {const a=raw[(y*om.width+x)*4+3];if(a===0)transparent++;if(a===255)opaque++;if(a>=128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
const w=2,h=w*om.height/om.width,cy=.75;
const boundsY=[cy+h/2-h*(maxY+1)/om.height,cy+h/2-h*minY/om.height];
const report={asset:'factory-tool-board',path:file,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex'),sourceSize:[sm.width,sm.height],size:[om.width,om.height],aspect:om.width/om.height,nativeAlpha:true,alpha:{transparent,opaque,visibleThresholdForMeasurementOnly:128,bbox:[minX,minY,maxX+1,maxY+1]},transform:'proportional Lanczos resize to512 wide and WebP encoding; no painting, crop, masking, alpha thresholding or colour corrections',worldPlaneSize:[w,h],visibleWorldY:boundsY,proposedMount:{position:[-12,cy,-25.38],rotationY:0,normal:[0,0,1]},clearance:{wallInnerZ:-25.4,planeOffset:0.02,pipeLowerY:2.02,visibleToPipe:2.02-boundsY[1],windowsLowerY:2.6,wholePlaneToPipe:2.02-(cy+h/2),projectedGapAtGameAngle:(2.2-boundsY[1])*.78/Math.hypot(1,.78)-.38/Math.hypot(1,.78)-.18},acceptance:'asset packaging; standalone visual QA pending, actual game placement pending Claude'};
await fs.writeFile(path.join(here,'tool-board.json'),JSON.stringify(report,null,2)+'\n');
const kitPath=path.join(root,'public/textures/kit/factory/kit.json'),kit=JSON.parse(await fs.readFile(kitPath,'utf8'));
if(!kit.includes('factory-tool-board')){kit.push('factory-tool-board');await fs.writeFile(kitPath,JSON.stringify(kit,null,2)+'\n');}
console.log(JSON.stringify(report));
