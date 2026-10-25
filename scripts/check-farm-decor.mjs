// Independent checks against the exported runtime data, not the authoring output.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'assets-src/farm-v3');
const source=await readFile(path.join(root,'src/farm-decor.ts'),'utf8');
const compiled=stripTypeScriptTypes(source);
const {DECOR,PATHS,FENCES,SOIL,MUD,MEADOW,PONDS}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const author=JSON.parse(await readFile(path.join(dir,'decor-authoring.json'),'utf8'));
const bounds=JSON.parse(await readFile(path.join(dir,'model-bounds.json'),'utf8'));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function pointDistance(p,a,b){let d=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),d)/dot(d,d)));return Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1]);}
function segmentDistance(a,b,c,d){let u=sub(b,a),v=sub(d,c),w=sub(c,a),den=cross(u,v);if(Math.abs(den)>1e-9){let t=cross(w,v)/den,s=cross(w,u)/den;if(t>=0&&t<=1&&s>=0&&s<=1)return 0;}return Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b));}
const roadSegments=PATHS.flatMap((p,i)=>p.points.slice(1).map((b,j)=>({a:p.points[j],b,width:p.width,path:i})));
function board(p){assert(p.every(Number.isFinite));assert(Math.abs(p[0])<=55&&Math.abs(p[1])<=37.5,`outside board ${p}`);}
for(const s of roadSegments){board(s.a);board(s.b);assert(Math.hypot(...sub(s.a,s.b))>.05);assert(s.width>0&&s.width<=4);}
// Union road polylines wherever their center lines meet (including crossings).
const parent=PATHS.map((_,i)=>i),find=i=>parent[i]===i?i:parent[i]=find(parent[i]);
for(const a of roadSegments)for(const b of roadSegments)if(segmentDistance(a.a,a.b,b.a,b.b)<.015)parent[find(a.path)]=find(b.path);
const roadComponents=new Set(parent.map((_,i)=>find(i))).size;
assert.equal(roadComponents,1,'disconnected paths');
let minRoadClearance=Infinity,minFoxClearance=Infinity,minPoleClearance=Infinity;
const padConflicts=[];
for(const [idx,line] of FENCES.entries()){
 assert(line.length>=2);line.forEach(board);
 for(let j=1;j<line.length;j++){
  const a=line[j-1],b=line[j];assert(Math.hypot(...sub(a,b))>.5);
  for(const r of roadSegments)minRoadClearance=Math.min(minRoadClearance,segmentDistance(a,b,r.a,r.b)-r.width/2);
  for(let k=1;k<author.travel[0].length;k++)minFoxClearance=Math.min(minFoxClearance,segmentDistance(a,b,author.travel[0][k-1],author.travel[0][k]));
  for(const t of author.tasks){
   minPoleClearance=Math.min(minPoleClearance,pointDistance(t.pole,a,b));
   if(t.id==='gateStuck')continue; // Motor plate is beside the active gate, unlike an empty assembly pad.
   let [x,z]=t.workingPatch.center,half=2.05,corners=[[x-half,z-half],[x+half,z-half],[x+half,z+half],[x-half,z+half]];
   if([a,b].some(p=>Math.abs(p[0]-x)<half&&Math.abs(p[1]-z)<half)||corners.some((c,k)=>segmentDistance(a,b,c,corners[(k+1)%4])<.001))padConflicts.push({fence:idx,task:t.id});
  }
 }
}
assert(minRoadClearance>=.39,`fence blocks path: clearance ${minRoadClearance}`);
assert(minFoxClearance>=.99,`fence blocks fox: ${minFoxClearance}`);
assert(minPoleClearance>=1.14,`fence overlaps pole: ${minPoleClearance}`);
assert.equal(padConflicts.length,0,JSON.stringify(padConflicts));
// The gate posts are part of the gameplay model, whose root is (30,17).
const north=FENCES.filter(l=>l.every(p=>Math.abs(p[1]-16.4)<.001));
assert(north.some(l=>Math.min(...l.map(p=>Math.abs(p[0]-28.4)))<.2),'gate left post not joined');
assert(north.some(l=>Math.min(...l.map(p=>Math.abs(p[0]-31.6)))<.2),'gate right post not joined');
assert.deepEqual(PONDS,[{x:-40,z:3.5,rx:7.5,rz:5}]);
const inventory=[];
const buildingFootprints=[],buildingConflicts=[];
for(const g of DECOR){
 assert(g.items.length);const bytes=(await stat(path.join(root,'public/models',g.model+'.glb'))).size;
 for(const [x,z,yaw,s] of g.items){board([x,z]);assert(Number.isFinite(yaw)&&s>0&&s<2);}
 inventory.push({model:g.model,instances:g.items.length,bytes,trianglesPerInstance:bounds[g.model]?.triangles??null});
 if(author.groups.some(a=>a.model===g.model&&a.category==='building')){
  const measured=bounds[g.model],axis=g.fit.width?'width':g.fit.height?'height':'depth';
  const factor=g.fit[axis]/measured.fit[axis];
  for(const [x,z,yaw,s] of g.items){
   const w=measured.size[0]*factor*s,d=measured.size[2]*factor*s;
   assert.equal(yaw,0,'building check needs an oriented rectangle for a rotated building');
   const box={model:g.model,x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2};buildingFootprints.push(box);
   const corners=[[box.x0,box.z0],[box.x1,box.z0],[box.x1,box.z1],[box.x0,box.z1]];
   for(const [i,line] of FENCES.entries())for(let j=1;j<line.length;j++)if(line.slice(j-1,j+1).some(p=>p[0]>box.x0&&p[0]<box.x1&&p[1]>box.z0&&p[1]<box.z1)||corners.some((c,k)=>segmentDistance(line[j-1],line[j],c,corners[(k+1)%4])<.001))buildingConflicts.push({model:g.model,fence:i});
   for(const t of author.tasks){let [px,pz]=t.workingPatch.center;if(Math.abs(x-px)<w/2+2&&Math.abs(z-pz)<d/2+2)buildingConflicts.push({model:g.model,task:t.id});}
  }
 }
}
assert.equal(buildingConflicts.length,0,JSON.stringify(buildingConflicts));
assert(!DECOR.some(g=>g.model.startsWith('crop')),'missing crops would hide temporary wheat');
for(const r of SOIL){board([r.x0,r.z0]);board([r.x1,r.z1]);assert(r.x1>r.x0&&r.z1>r.z0);}
for(const e of [...PONDS,...MUD,...MEADOW]){board([e.x-e.rx,e.z-e.rz]);board([e.x+e.rx,e.z+e.rz]);}
const report={status:'pass',roadComponents,paths:PATHS.length,fenceRuns:FENCES.length,minRoadClearance,minFoxClearance,minPoleClearance,workingPadFenceConflicts:padConflicts,
 gate:{root:[30,17],posts:[[28.4,16.4],[31.6,16.4]],exception:'Gate motor plate occupies the gate-side working square; static fences meet the existing gate posts.'},
 buildingFootprints,buildingConflicts,inventory,instances:inventory.reduce((n,m)=>n+m.instances,0),trianglesBeforeIntegrationCulling:inventory.reduce((n,m)=>n+m.instances*(m.trianglesPerInstance??0),0),
 notes:['Triangle count excludes gameplay, fences and shadows. It is not an FPS or memory measurement.','farm.ts culls small instances near its interactive points.','Future groups are authoring data only until their GLBs exist.']};
await writeFile(path.join(dir,'decor-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,inventory:undefined,notes:undefined},null,2));
