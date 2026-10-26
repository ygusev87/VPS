// Read-only measurements of a candidate. Never modifies the source, texture or runtime.
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../../../../',import.meta.url),here=new URL('./',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('assets-src/design-pass/kit/city/park/manifest.json',root)));
const layout=JSON.parse(await readFile(new URL('assets-src/design-pass/kit/city/park/layout.json',root)));
const bytes=await readFile(new URL('public/textures/kit/city/park-lawn.webp',root));
const sha=createHash('sha256').update(bytes).digest('hex');if(sha!==manifest.sha256)throw Error('Source changed');
const {data,info:{width:w,height:h}}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const mask=new Uint8Array(w*h),seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
for(let i=0;i<w*h;i++){const[r,g,b,a]=data.subarray(i*4,i*4+4);mask[i]=a>220&&r>170&&g>145&&b>100&&r-g>3&&b>g*.64?1:0;}
const [cx,cy]=manifest.geometry.uvCentre,seed=Math.floor(cy*h)*w+Math.floor(cx*w);let start=0,end=1;queue[0]=seed;seen[seed]=1;
while(start<end){const i=queue[start++],x=i%w,y=Math.floor(i/w);for(const n of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(n>=0&&mask[n]&&!seen[n]){seen[n]=1;queue[end++]=n;}}
const offset=[-3-manifest.geometry.runtimeCentre[0],1-manifest.geometry.runtimeCentre[1]];
const round=n=>+n.toFixed(6);
function variant(shift){const zones=layout.clearZones.map(z=>({...z,pavedPixels:0}));let pavedOutsideField=0;for(let i=0;i<end;i++){const n=queue[i],x=((n%w+.5)/w-.5)*33.6+shift[0],z=((Math.floor(n/w)+.5)/h-.5)*17.6+shift[1];for(const zone of zones)if(Math.hypot(x-zone.x,z-zone.z)<=zone.radius)zone.pavedPixels++;if(Math.abs(x)>16.5||Math.abs(z)>8.5)pavedOutsideField++;}
const checks=[3.2,3.3,3.55].map(radius=>{let inside=0;for(let i=0;i<3600;i++){const a=i*Math.PI/1800,px=Math.floor(((-3+radius*Math.cos(a)-shift[0])/33.6+.5)*w),py=Math.floor(((1+radius*Math.sin(a)-shift[1])/17.6+.5)*h);inside+=seen[py*w+px]||0;}return{radius,samples:3600,onPaving:inside,fraction:round(inside/3600)};});return{offset:shift.map(round),checks,clearZones:zones.map(z=>({name:z.name,pavedPixels:z.pavedPixels})),pavedOutsideField,note:'Outside-field path pixels include intended connections; review cropping/kerb in actual game.'};}
const report={schemaVersion:1,sourceSha256:sha,sourceCommit:'d2b6e7b',width:33.6,depth:17.6,current:variant([0,0]),aligned:variant(offset),fittedAlignedBasinMargin:round(Math.min(...manifest.geometry.runtimeDiameter)/2-3.2),scope:'Candidate for integration with whole-decal position offset. Artwork and runtime unchanged. Polygon/colour approximation, not a GLB or game check.'};
await writeFile(new URL('measurements.json',here),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
