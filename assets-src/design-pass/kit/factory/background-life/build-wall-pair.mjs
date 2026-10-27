// Proportional resize/WebP encoding only. Preserve generated alpha and composition.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../..');
const specs=[{id:'factory-safety-signs',width:2.4,centre:[-8,.9,-25.38],interactive:false},{id:'factory-wall-clock',width:1.4,centre:[0,3.4,-25.30],interactive:true}];
const reports=[];
for(const s of specs){
 const input=await fs.readFile(path.join(here,'sources',s.id+'-v1.png'));
 const sm=await sharp(input).metadata(),output=await sharp(input).resize({width:512}).webp({quality:90,alphaQuality:100,effort:5}).toBuffer(),om=await sharp(output).metadata();
 if(!sm.hasAlpha||!om.hasAlpha)throw Error('Alpha missing');
 const pixels=await sharp(output).ensureAlpha().raw().toBuffer();let xmin=om.width,ymin=om.height,xmax=-1,ymax=-1,transparent=0;
 for(let y=0;y<om.height;y++)for(let x=0;x<om.width;x++){const a=pixels[(y*om.width+x)*4+3];if(!a)transparent++;if(a>=128){xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}}
 if(!transparent)throw Error('No transparent canvas');
 const size=[s.width,s.width*om.height/om.width],boundsY=[s.centre[1]+size[1]/2-size[1]*(ymax+1)/om.height,s.centre[1]+size[1]/2-size[1]*ymin/om.height];
 const file='public/textures/kit/factory/'+s.id+'.webp';await fs.writeFile(path.join(root,file),output);
 reports.push({...s,file,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex'),sourceSize:[sm.width,sm.height],sizePixels:[om.width,om.height],sizeWorld:size,visibleWorldY:boundsY,nativeAlpha:true,transparentPixels:transparent,visibleBBoxThreshold128:[xmin,ymin,xmax+1,ymax+1],normal:[0,0,1],rotationY:0,wallSeparation:s.centre[2]+25.4,transform:'Proportional 512-wide resize and WebP90, alphaQuality100; no drawing, masking, crop or alpha thresholding.'});
}
const report={status:'encoded-awaiting-native-qa',assets:reports,clockIntegration:{replace:'Existing factory clock dial/rim only; retain parts.face and parts.hand ownership plus tap/sound/rest behaviour.',frame:'Plane XY 1.4 square centred at face origin, unlit sRGB alphaTest.5; hand localZ.08 as before.',mount:'Factory clock rootZ=-25.30, face.position.y and face.userData.y0=3.4. Avoid creating a duplicate static WALL_DECOR clock.',oldPositionEvidence:'factory.ts addToy clock rootZ=-25.6; life.ts dial frontZ+.06, hand frontZ+.095, rim frontZ+.07, bells radius.17 -> all behind wall innerZ=-25.4. This is source/reproduction evidence, not an observation of live gameplay.',animation:'Keep game-clock hand and face shake/jump; source image has no hands. Old decorative post can be omitted for a wall mounting. Existing bells optional; do not regress interaction.',scope:'Factory only; do not change other maps clocks without checking their layout.'}};
await fs.writeFile(path.join(here,'wall-pair.json'),JSON.stringify(report,null,2)+'\n');
const kitpath=path.join(root,'public/textures/kit/factory/kit.json'),kit=JSON.parse(await fs.readFile(kitpath,'utf8'));for(const s of specs)if(!kit.includes(s.id))kit.push(s.id);await fs.writeFile(kitpath,JSON.stringify(kit,null,2)+'\n');
console.log(JSON.stringify(report));
