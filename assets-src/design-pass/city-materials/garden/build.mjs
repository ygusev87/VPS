import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Box3,Vector3,Matrix4} from 'three';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../../..');
const source=await fs.readFile(root+'/src/city-decor.ts','utf8');
const basePath=dir+'/baseline.json';
let base;try{base=JSON.parse(await fs.readFile(basePath));}catch(e){if(e.code!=='ENOENT')throw e;const data=await import(root+'/src/city-decor.ts');base={source,sha256:createHash('sha256').update(source).digest('hex'),...data};await fs.writeFile(basePath,JSON.stringify(base,null,2)+'\n');}
const lawn=JSON.parse(await fs.readFile(dir+'/../lawns.json'));
const layout=JSON.parse(await fs.readFile(root+'/assets-src/city-v2/layout-proposal.json'));
const actualSoil=(await import(root+'/src/city-decor.ts')).SOIL;
if(JSON.stringify(base.SOIL)!==JSON.stringify(actualSoil))throw Error('SOIL changed: review before regenerating');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const cache=new Map();
async function shape(model,fit){const key=model+JSON.stringify(fit);if(cache.has(key))return cache.get(key);const doc=await io.read(root+'/public/models/'+model+'.glb');const b=getBounds(doc.getRoot().listScenes()[0]);const points=[];for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])points.push(new Vector3(x,y,z).applyMatrix4(new Matrix4().makeRotationY(fit.rotateY??0)));const box=new Box3().setFromPoints(points),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());const s=fit.width?fit.width/size.x:fit.depth?fit.depth/size.z:fit.height?fit.height/size.y:1;const corners=points.map(p=>p.sub(new Vector3(center.x,box.min.y,center.z)).multiplyScalar(s));const result={corners,size:size.multiplyScalar(s).toArray()};cache.set(key,result);return result;}
function bounds(shape,p){const b=new Box3().setFromPoints(shape.corners.map(v=>v.clone().multiplyScalar(p[3]).applyMatrix4(new Matrix4().makeRotationY(p[2])).add(new Vector3(p[0],0,p[1]))));return{x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,height:b.max.y};}
const overlap=(a,b,m=0)=>a.x0<b.x1+m&&a.x1>b.x0-m&&a.z0<b.z1+m&&a.z1>b.z0-m;
const occupied=[];for(const g of base.DECOR){if(g.model==='bench')continue;const sh=await shape(g.model,g.fit);for(const p of g.items)occupied.push({...bounds(sh,p),model:g.model});}
const patches=base.SOIL.slice(2);
const groups=[{model:'tree-oak-lite',fit:{height:2.8},items:[]},{model:'bush-lite',fit:{width:1.35},items:[]},{model:'flower-cluster',fit:{height:.48},items:[]}];
const added=[];let seed=83291;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const round=n=>Math.round(n*1000)/1000;
const anchors=Object.entries(layout.anchors).filter(([k,v])=>Array.isArray(v)&&typeof v[0]==='number'&&!['CROSS','GRANDMA','BALCONY'].includes(k)).map(([id,v])=>({id,x:v[0],z:v[1]}));
function nearSegment(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
async function place(g,x,z,index,s=1){const p=[round(x),round(z),round(rand()*6.28),round(s)];const sh=await shape(g.model,g.fit),b=bounds(sh,p);const pad=g.model==='flower-cluster'?.12:.22;const inside=patches.some(r=>b.x0>=r.x0+pad&&b.x1<=r.x1-pad&&b.z0>=r.z0+pad&&b.z1<=r.z1-pad);if(!inside)return false;if(lawn.exclusions.some(e=>overlap(b,e)))return false;if(occupied.some(e=>overlap(b,e,g.model==='tree-oak-lite'?.5:.18)))return false;
 const r=1.6+(g.fit.width??g.fit.height*.8)*s/2;if(anchors.some(a=>Math.hypot(x-a.x,z-a.z)<r+.15))return false;if(layout.protectedRoutes.some(l=>l.points.some((b,i)=>i&&nearSegment(x,z,l.points[i-1],b)<r+.15)))return false;
 g.items.push(p);occupied.push({...b,model:g.model});added.push({id:added.length,model:g.model,item:p,patch:index+2,bounds:b});return true;}
// Small trees in larger lawns; clear grass pockets stay visible between plant groups.
for(const [i,r]of patches.entries()){const w=r.x1-r.x0,d=r.z1-r.z0;if(w*d<28||Math.min(w,d)<3.2)continue;const horizontal=w>d,len=horizontal?w:d;for(let k=0;k<Math.floor(len/7.5);k++){if(groups[0].items.length>=20)break;const t=(k+.65)/Math.floor(len/7.5);await place(groups[0],horizontal?r.x0+1.4+(w-2.8)*t:(r.x0+r.x1)/2,horizontal?r.z0+1.6:r.z0+1.5+(d-3)*t,i,.9+rand()*.14);}}
// Low hedge clusters and flowers trace the same lawn margins, with breathing gaps.
for(const [i,r]of patches.entries()){const w=r.x1-r.x0,d=r.z1-r.z0,horizontal=w>=d,len=horizontal?w:d;const n=Math.max(1,Math.floor((len-1)/2.7));for(let k=0;k<n;k++){const t=(k+.5)/n;let x=horizontal?r.x0+.8+(w-1.6)*t:(k%2?r.x1-1:r.x0+1);let z=horizontal?(k%2?r.z1-1:r.z0+1):r.z0+.8+(d-1.6)*t;await place(groups[1],x,z,i,.82+rand()*.22);}}
for(const [i,r]of patches.entries()){const w=r.x1-r.x0,d=r.z1-r.z0;const budget=Math.min(14,Math.ceil((w+d)/2.5));let n=0;for(let k=0;k<budget*10&&n<budget;k++){const edge=k%4,t=rand();const x=edge<2?r.x0+.55+t*(w-1.1):edge===2?r.x0+.65:r.x1-.65;const z=edge>=2?r.z0+.55+t*(d-1.1):edge===0?r.z0+.65:r.z1-.65;if(await place(groups[2],x,z,i,.8+rand()*.3))n++;}}
// Actual dressing() rejected this flower next to a stationary school character.
const runtimeRejected=[[8.65,-23.241,0.101,1.085]];
for(const g of groups)g.items=g.items.filter(p=>!runtimeRejected.some(r=>JSON.stringify(r)===JSON.stringify(p)));
for(let i=added.length-1;i>=0;i--)if(runtimeRejected.some(r=>JSON.stringify(r)===JSON.stringify(added[i].item)))added.splice(i,1);
const candidate=base.source.replace('\n];','\n  // Garden A: low planted borders inside protected lawns; original placements stay fixed.\n'+groups.map(g=>"  { model: '"+g.model+"', fit: { "+Object.entries(g.fit).map(([k,v])=>k+': '+v).join(', ')+" }, items: [\n"+g.items.map(p=>'    ['+p.join(', ')+'],').join('\n')+'\n  ] },').join('\n')+'\n];');
await fs.writeFile(dir+'/candidate.ts',candidate);
await fs.writeFile(dir+'/candidate.json',JSON.stringify({...base,source:undefined,DECOR:[...base.DECOR,...groups]},null,2)+'\n');
const report={baselineSha256:base.sha256,added,groups:groups.map(g=>({model:g.model,fit:g.fit,count:g.items.length})),modelBounds:Object.fromEntries([...cache].map(([k,v])=>[k,v.size])),checks:{allNewInsideProtectedLawns:true,newPlantOverlap:0,preservedOriginalPlacements:true,scope:'AABB full fitted GLB footprint; road/task/building masks plus runtime point/route screening. Actual runtime filters and camera occlusion must still be checked.'}};
await fs.writeFile(dir+'/audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.groups));
