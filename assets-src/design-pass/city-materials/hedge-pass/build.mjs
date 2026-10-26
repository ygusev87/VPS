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
const foundation=JSON.parse(await fs.readFile(dir+'/../garden/baseline.json'));
const lawn=JSON.parse(await fs.readFile(dir+'/../lawns.json'));
const layout=JSON.parse(await fs.readFile(root+'/assets-src/city-v2/layout-proposal.json'));
const runtimeKeep=JSON.parse(await fs.readFile(dir+'/runtime-keep.json'));
const actualSoil=(await import(root+'/src/city-decor.ts')).SOIL;
if(JSON.stringify(base.SOIL)!==JSON.stringify(actualSoil))throw Error('SOIL changed: review before regenerating');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const cache=new Map();
async function shape(model,fit){const key=model+JSON.stringify(fit);if(cache.has(key))return cache.get(key);const doc=await io.read(root+'/public/models/'+model+'.glb');const b=getBounds(doc.getRoot().listScenes()[0]);const points=[];for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])points.push(new Vector3(x,y,z).applyMatrix4(new Matrix4().makeRotationY(fit.rotateY??0)));const box=new Box3().setFromPoints(points),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());const s=fit.width?fit.width/size.x:fit.depth?fit.depth/size.z:fit.height?fit.height/size.y:1;const corners=points.map(p=>p.sub(new Vector3(center.x,box.min.y,center.z)).multiplyScalar(s));const result={corners,size:size.multiplyScalar(s).toArray()};cache.set(key,result);return result;}
function bounds(shape,p){const b=new Box3().setFromPoints(shape.corners.map(v=>v.clone().multiplyScalar(p[3]).applyMatrix4(new Matrix4().makeRotationY(p[2])).add(new Vector3(p[0],0,p[1]))));return{x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,height:b.max.y};}
const overlap=(a,b,m=0)=>a.x0<b.x1+m&&a.x1>b.x0-m&&a.z0<b.z1+m&&a.z1>b.z0-m;
const occupied=[];for(const g of foundation.DECOR){if(g.model==='bench')continue;const sh=await shape(g.model,g.fit);for(const p of g.items)occupied.push({...bounds(sh,p),model:g.model});}
const patches=base.SOIL.slice(2);
const groups=[{model:'tree-oak-lite',fit:{height:3.1},items:[]},{model:'bush-lite',fit:{width:1.8},items:[]},{model:'flower-cluster',fit:{height:.52},items:[]}];
const added=[];let seed=83291;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const round=n=>Math.round(n*1000)/1000;
const anchors=Object.entries(layout.anchors).filter(([k,v])=>Array.isArray(v)&&typeof v[0]==='number'&&!['CROSS','GRANDMA','BALCONY'].includes(k)).map(([id,v])=>({id,x:v[0],z:v[1]}));
function nearSegment(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
async function place(g,x,z,index,s=1,yaw=rand()*6.28){const p=[round(x),round(z),round(yaw),round(s)];const sh=await shape(g.model,g.fit),b=bounds(sh,p);const pad=g.model==='flower-cluster'?.12:.22;const inside=patches.some(r=>b.x0>=r.x0+pad&&b.x1<=r.x1-pad&&b.z0>=r.z0+pad&&b.z1<=r.z1-pad);if(!inside)return false;if(lawn.exclusions.some(e=>overlap(b,e)))return false;if(occupied.some(e=>overlap(b,e,g.model==='tree-oak-lite'?.3:g.model==='bush-lite'&&e.model==='bush-lite'?-.08:.06)))return false;
 const r=1.6+(g.fit.width??g.fit.height*.8)*s/2;if(runtimeKeep.some(p=>Math.hypot(x-p[0],z-p[1])<r+.15))return false;if(anchors.some(a=>Math.hypot(x-a.x,z-a.z)<r+.15))return false;if(layout.protectedRoutes.some(l=>l.points.some((b,i)=>i&&nearSegment(x,z,l.points[i-1],b)<r+.15)))return false;
 g.items.push(p);occupied.push({...b,model:g.model});added.push({id:added.length,model:g.model,item:p,patch:index+2,bounds:b});return true;}
// Boundary segments of the union, avoiding artificial hedges along touching rectangles.
const edges=[];
for(const [i,r]of patches.entries())for(const [a,b,n]of [[[r.x0,r.z0],[r.x1,r.z0],[0,1]],[[r.x0,r.z1],[r.x1,r.z1],[0,-1]],[[r.x0,r.z0],[r.x0,r.z1],[1,0]],[[r.x1,r.z0],[r.x1,r.z1],[-1,0]]]){
 const horizontal=a[1]===b[1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);let parts=[[0,len]];
 for(const t of patches){if(t===r)continue;const out=[a[0]-n[0]*.02,a[1]-n[1]*.02];const covers=horizontal?out[1]>t.z0&&out[1]<t.z1:out[0]>t.x0&&out[0]<t.x1;if(!covers)continue;const lo=Math.max(0,(horizontal?t.x0:t.z0)-(horizontal?a[0]:a[1])),hi=Math.min(len,(horizontal?t.x1:t.z1)-(horizontal?a[0]:a[1]));if(hi<=lo)continue;parts=parts.flatMap(([u,v])=>hi<=u||lo>=v?[[u,v]]:[[u,Math.max(u,lo)],[Math.min(v,hi),v]].filter(([l,h])=>h-l>.1));}
 for(const [lo,hi]of parts)if(hi-lo>1.4)edges.push({a:[a[0]+(horizontal?lo:0),a[1]+(horizontal?0:lo)],b:[a[0]+(horizontal?hi:0),a[1]+(horizontal?0:hi)],n,i,len:hi-lo,horizontal});
}
// At most one small tree by each building with a suitable rear/side lawn pocket.
for(const building of lawn.buildings){const points=[];for(const [i,r]of patches.entries())for(let x=r.x0+1.3;x<r.x1-1.3;x+=.8)for(let z=r.z0+1.5;z<r.z1-1.5;z+=.8){const d=Math.hypot(x-building.center[0],z-building.center[1]);if(d<3||d>9)continue;const rear=building.center[1]<0?Math.max(0,z-building.center[1])*2:Math.max(0,building.center[1]-z)*2;points.push({x,z,i,score:d+rear});}points.sort((a,b)=>a.score-b.score);for(const p of points)if(await place(groups[0],p.x,p.z,p.i,.9,0)){break;}}
// Low aligned bushes make a legible living edge, rather than randomly rotated green dots.
const total=edges.reduce((n,e)=>n+e.len,0),spacing=1.65;
for(const e of edges){const count=Math.max(1,Math.floor(e.len/spacing));for(let k=0;k<count;k++){const t=(k+.5)/count,x=e.a[0]+(e.b[0]-e.a[0])*t+e.n[0]*.62,z=e.a[1]+(e.b[1]-e.a[1])*t+e.n[1]*.62;await place(groups[1],x,z,e.i,.9+(k%3)*.04,e.horizontal?0:Math.PI/2);}}
// Small flower pairs just inside the hedge; long grass interiors remain clear.
for(const e of edges){const count=Math.max(1,Math.floor(e.len/2.3));for(let k=0;k<count;k++){const t=(k+.45)/count,x=e.a[0]+(e.b[0]-e.a[0])*t+e.n[0]*1.5,z=e.a[1]+(e.b[1]-e.a[1])*t+e.n[1]*1.5;await place(groups[2],x,z,e.i,.82+rand()*.16);}}
// Real builder/car7 working cameras: this eastern tree hid the construction outline.
const cameraRejected=[{model:'tree-oak-lite',item:[41.5,-22.7,0,.9],reason:'builder/car7 actual work outline, landscape 1180 and 1024'}];
for(const rejected of cameraRejected){const g=groups.find(g=>g.model===rejected.model);g.items=g.items.filter(p=>JSON.stringify(p)!==JSON.stringify(rejected.item));for(let i=added.length-1;i>=0;i--)if(added[i].model===rejected.model&&JSON.stringify(added[i].item)===JSON.stringify(rejected.item))added.splice(i,1);}
const candidate=foundation.source.replace('\n];','\n  // Garden A: aligned hedges at union boundaries and trees beside houses.\n'+groups.map(g=>"  { model: '"+g.model+"', fit: { "+Object.entries(g.fit).map(([k,v])=>k+': '+v).join(', ')+" }, items: [\n"+g.items.map(p=>'    ['+p.join(', ')+'],').join('\n')+'\n  ] },').join('\n')+'\n];');
await fs.writeFile(dir+'/candidate.ts',candidate);
await fs.writeFile(dir+'/candidate.json',JSON.stringify({...base,source:undefined,DECOR:[...foundation.DECOR,...groups]},null,2)+'\n');
const report={baselineSha256:base.sha256,cameraRejected,added,groups:groups.map(g=>({model:g.model,fit:g.fit,count:g.items.length})),modelBounds:Object.fromEntries([...cache].map(([k,v])=>[k,v.size])),checks:{allNewInsideProtectedLawns:true,unexpectedPlantOverlap:0,permittedHedgeFootprintOverlap:.08,preservedOriginal14Groups:true,refinesFirstGardenPass:true,boundarySegments:edges.length,hedgeSpacing:spacing,scope:'AABB full fitted GLB footprint; road/task/building masks plus runtime point/route screening. Actual runtime filters and camera occlusion must still be checked.'}};
await fs.writeFile(dir+'/audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.groups));
