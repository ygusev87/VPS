import sharp from 'sharp';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('.',import.meta.url).pathname;
const assets=[];
const version=Number(process.argv[2]??1);
for(const id of ['asphalt','paving','quay-stone']){
 const v=id==='asphalt'?1:version;
 const source=dir+`sources/${id}-v${v}.png`,file=dir+`candidates/${id}-v${v}.webp`;
 await sharp(source).resize(512,512,{fit:'fill'}).removeAlpha().webp({quality:90,effort:6}).toFile(file);
 const b=await fs.readFile(file); const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const pixel=(x,y,c)=>data[(y*info.width+x)*info.channels+c];
 let sx=0,sy=0,ix=0,iy=0;
 for(let n=0;n<512;n++)for(let c=0;c<3;c++){
  sx+=Math.abs(pixel(0,n,c)-pixel(511,n,c)); sy+=Math.abs(pixel(n,0,c)-pixel(n,511,c));
  ix+=Math.abs(pixel(255,n,c)-pixel(256,n,c)); iy+=Math.abs(pixel(n,255,c)-pixel(n,256,c));
 }
 const d=512*3;
 assets.push({id,source:`sources/${id}-v${v}.png`,file:`candidates/${id}-v${v}.webp`,sourceSize:await sharp(source).metadata().then(m=>[m.width,m.height]),dimensions:[512,512],bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),encoding:'mechanical resize and WebP90, no artwork changes',edgeMeanAbsoluteRGB:{horizontal:sx/d,vertical:sy/d,interiorHorizontal:ix/d,interiorVertical:iy/d},note:'Edge deltas are diagnostics, not a seamlessness proof. Inspect repeated preview.'});
}
await fs.writeFile(dir+`candidates/report-v${version}.json`,JSON.stringify({date:'2026-10-26',assets,totalBytes:assets.reduce((s,a)=>s+a.bytes,0)},null,2)+'\n');
console.log(JSON.stringify(assets.map(a=>({id:a.id,bytes:a.bytes,edges:a.edgeMeanAbsoluteRGB}))));
