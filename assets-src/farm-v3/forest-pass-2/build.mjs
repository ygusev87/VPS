// Deterministic additive forest proposal. Uses the accepted baseline, never the legacy seed layout.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Box3, Matrix4, Vector3} from 'three';

const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(p,v)=>fs.writeFile(path.join(dir,p),JSON.stringify(v,null,2)+'\n');
const base=await read(path.join(dir,'baseline/decor-layout.json'));
const author=await read(path.join(dir,'baseline/decor-authoring.json'));
const layout=structuredClone(base),updated=structuredClone(author);
const sha=b=>createHash('sha256').update(b).digest('hex');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const geom=new Map(),hashes={};
for(const name of new Set([...base.DECOR.map(g=>g.model),'tractor'])){
  const manifest=await read(path.join(dir,'baseline/manifest.json')),relative='public/models/'+name+'.glb';
  const bytes=manifest.overrides.includes(relative)?await fs.readFile(path.join(dir,'baseline/overrides',relative)):execFileSync('git',['show',manifest.revision+':'+relative],{cwd:root,maxBuffer:20*1024*1024});
  if(sha(bytes)!==manifest.runtimeHashes[relative])throw Error('Captured GLB hash mismatch '+name);
  const doc=await io.readBinary(bytes);await doc.transform(dequantize());
  const corners=[];let triangles=0,primitives=0;
  for(const n of doc.getRoot().listNodes())for(const p of n.getMesh()?.listPrimitives()??[]){
    const a=p.getAttribute('POSITION'),b=new Box3(),m=new Matrix4().fromArray(n.getWorldMatrix());
    for(let i=0;i<a.getCount();i++)b.expandByPoint(new Vector3(...a.getElement(i,[])));
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])corners.push(new Vector3(x,y,z).applyMatrix4(m));
    triangles+=(p.getIndices()?.getCount()??a.getCount())/3;primitives++;
  }
  geom.set(name,{corners,triangles,primitives,bytes:bytes.length});hashes[name]=sha(bytes);
}
function fittedModel(g){
  const data=geom.get(g.model),points=data.corners.map(v=>v.clone().applyAxisAngle(new Vector3(0,1,0),g.fit.rotateY??0));
  const b=new Box3().setFromPoints(points),size=b.getSize(new Vector3()),c=b.getCenter(new Vector3());
  const factor=g.fit.width?g.fit.width/size.x:g.fit.depth?g.fit.depth/size.z:g.fit.height?g.fit.height/size.y:1;
  const fitted=points.map(v=>v.sub(new Vector3(c.x,b.min.y,c.z)).multiplyScalar(factor));
  return {model:g.model,fit:g.fit,points:fitted,radius:Math.max(...fitted.map(v=>Math.hypot(v.x,v.z))),size:new Box3().setFromPoints(fitted).getSize(new Vector3()).toArray(),triangles:data.triangles,primitives:data.primitives,bytes:data.bytes};
}
const measured=base.DECOR.map(fittedModel);
const tractor=fittedModel({model:'tractor',fit:{depth:3.8,rotateY:Math.PI}});
const round=n=>Math.round(n*1000)/1000;
const seg=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const hull=pts=>{const p=[...new Map(pts.map(v=>[v.join(','),v])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lower=[],upper=[];for(const v of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),v)<=0)lower.pop();lower.push(v);}for(const v of [...p].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),v)<=0)upper.pop();upper.push(v);}return lower.slice(0,-1).concat(upper.slice(0,-1));};
const contains=(p,h)=>h.every((a,i)=>cross(a,h[(i+1)%h.length],p)>=-1e-9);
const pointPoly=(p,h)=>contains(p,h)?0:Math.min(...h.map((a,i)=>seg(p,a,h[(i+1)%h.length])));
function segDistance(a,b,c,d){const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)>1e-10){const w=[c[0]-a[0],c[1]-a[1]],t=(w[0]*v[1]-w[1]*v[0])/den,q=(w[0]*u[1]-w[1]*u[0])/den;if(t>=0&&t<=1&&q>=0&&q<=1)return 0;}return Math.min(seg(a,c,d),seg(b,c,d),seg(c,a,b),seg(d,a,b));}
const linePoly=(a,b,h)=>contains(a,h)||contains(b,h)?0:Math.min(...h.map((c,i)=>segDistance(a,b,c,h[(i+1)%h.length])));
const polyGap=(a,b)=>a.some(p=>contains(p,b))||b.some(p=>contains(p,a))?0:Math.min(...a.map((p,i)=>linePoly(p,a[(i+1)%a.length],b)));
const boxPoly=b=>[[b.x0,b.z0],[b.x1,b.z0],[b.x1,b.z1],[b.x0,b.z1]];
const lines=a=>a.flatMap((l,i)=>l.slice(1).map((b,j)=>({id:`${i}:${j}`,a:l[j],b})));
const rect=(p,b)=>Math.hypot(Math.max(b.x0-p[0],0,p[0]-b.x1),Math.max(b.z0-p[1],0,p[1]-b.z1));
const road=base.PATHS.flatMap((p,i)=>lines([p.points]).map(l=>({...l,id:`${i}:${l.id}`,width:p.width})));
const fences=lines(base.FENCES);
const loop=Array.from({length:721},(_,i)=>[29+4.2*Math.cos(i/720*2*Math.PI),26.5+6*Math.sin(i/720*2*Math.PI)]);
const runtimeLoop=Array.from({length:25},(_,i)=>[29+4.2*Math.cos(i/24*2*Math.PI),26.5+6*Math.sin(i/24*2*Math.PI)]);
const travel=lines([author.travel[0],[[-23,-8],[-8,-8]],[[30,12],[30,20.5]],loop]);
const runtimeTravel=lines([author.travel[0],[[-23,-8],[-8,-8]],[[30,12],[30,20.5]],runtimeLoop]);
// Static homes from farm.ts buildCritters/placeParts plus the authored needs/toys.
// Runtime QA compares this conservative estimate to the real map keep points.
const homePoints=[[12.5,.5],[30.5,-16],[46.5,-27],[49,-25],[-36.7,5.6],[-35.4,4.4],[-36.1,2.7],[9.5,-17.5],[11,-16.2],[-41,-11.5],[-36.5,-14],[30,12],[-21,-16.05],[-20,-5.8],[-12,1.5],[-17.5,1],[-12.5,6],[-16,21.5],[42.5,9.5],[-33.5,12.5],[-32.2,13.1],[1,-13],[17,-17.5],...Array.from({length:3},(_,i)=>[17+Math.cos(i*2.1)*.9,-17.5+Math.sin(i*2.1)*.9]),[-30,-6.5],[30,17],[39,-22],[-27,9.5]];
const keep=[...author.tasks.map(t=>t.workingPatch.center),...author.tasks.map(t=>t.pole),...author.toys,...homePoints];
const herdNames=new Set(['cow','horse','sheep','goat','kid','pig','hen','chick','rooster','rabbit','duck','goose']);
function instance(gi,p,id){const m=measured[gi],g=base.DECOR[gi],pts=m.points.map(v=>v.clone().multiplyScalar(p[3]).applyAxisAngle(new Vector3(0,1,0),p[2]).add(new Vector3(p[0],0,p[1]))),b=new Box3().setFromPoints(pts);return {id,gi,model:g.model,p,r:m.radius*p[3],height:m.size[1]*p[3],footprint:hull(pts.map(v=>[v.x,v.z])),box:{x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z}};}
const original=base.DECOR.flatMap((g,gi)=>g.items.map((p,i)=>instance(gi,p,`${gi}:${i}`)));
const buildings=original.filter(o=>author.groups.some(g=>g.model===o.model&&g.category==='building'));
const roaming=original.filter(o=>herdNames.has(o.model)).map(o=>({...o,roam:o.model==='hen'||o.model==='rabbit'?1.8:2.6}));
const occupied=[...original];const additions=[],rejected={};
const minimum=(arr,fn)=>Math.min(...arr.map(fn));
// The true updateTractor smoothed path (including gate-entry turn), at three dt values.
const tractorSweep=[];
for(const dt of [1/120,1/60,.05]){let x=30,z=12,yaw=Math.PI;for(let t=dt;t<42;t+=dt){if(t<4){x=30;z=12+t*2.6;yaw=Math.PI;}else{const a=(t-4)*.35-Math.PI/2,tx=29+Math.cos(a)*4.2,tz=26.5+Math.sin(a)*6,dx=tx-x,dz=tz-z;if(dx*dx+dz*dz>1e-4)yaw=Math.atan2(-dx,-dz);x+=(tx-x)*Math.min(1,dt*2);z+=(tz-z)*Math.min(1,dt*2);}tractorSweep.push({x,z,c:Math.cos(yaw),s:Math.sin(yaw)});}}
function tractorGap(p,r){let gap=Infinity;for(const a of tractorSweep){const x=p[0]-a.x,z=p[1]-a.z,lx=x*a.c-z*a.s,lz=x*a.s+z*a.c;gap=Math.min(gap,Math.hypot(Math.max(Math.abs(lx)-tractor.size[0]/2,0),Math.max(Math.abs(lz)-tractor.size[2]/2,0))-r);}return gap;}
function clear(o,field=false){
  const p=o.p,r=o.r,g=base.DECOR[o.gi],sz=g.fit.width??g.fit.depth??(g.fit.height??1)*.8,filterRadius=1.6+sz*p[3]/2;
  const gaps={
    board:Math.min(o.box.x0+55,55-o.box.x1,o.box.z0+37.5,37.5-o.box.z1)-.25,
    road:minimum(road,l=>linePoly(l.a,l.b,o.footprint)-l.width/2)-.2,
    fence:minimum(fences,l=>linePoly(l.a,l.b,o.footprint))-.08-.12,
    workPad:minimum(author.tasks,t=>polyGap(o.footprint,boxPoly({x0:t.workingPatch.center[0]-t.workingPatch.size[0]/2,x1:t.workingPatch.center[0]+t.workingPatch.size[0]/2,z0:t.workingPatch.center[1]-t.workingPatch.size[1]/2,z1:t.workingPatch.center[1]+t.workingPatch.size[1]/2})))-.3,
    pole:minimum(author.tasks,t=>pointPoly(t.pole,o.footprint))-1.4-.2,
    toy:minimum(author.toys,t=>pointPoly(t,o.footprint))-1.15-.2,
    building:minimum(buildings,b=>polyGap(o.footprint,b.footprint))-.35,
    animalRoam:minimum(roaming,a=>Math.hypot(p[0]-a.p[0],p[1]-a.p[1])-a.r-a.roam)-r-.15,
    travel:minimum(travel,l=>seg(p,l.a,l.b))-1.1-r-.15,
    runtimeKeep:minimum(keep,k=>Math.hypot(p[0]-k[0],p[1]-k[1]))-filterRadius-.05,
    runtimeRoute:minimum(runtimeTravel,l=>seg(p,l.a,l.b))-filterRadius-.05,
    critterHome:minimum(homePoints,a=>Math.hypot(p[0]-a[0],p[1]-a[1]))-1.8-r-.1,
  };
  // Trees/buildings use their actual boxes. Low plants use conservative footprint circles.
  gaps.decor=minimum(occupied,a=>a.model.startsWith('tree')||buildings.includes(a)?rect(p,a.box)-r:Math.hypot(p[0]-a.p[0],p[1]-a.p[1])-r-a.r)-.08;
  if(o.model.startsWith('tree')){
    // Tree crowns may lightly interleave inside the forest only. Keep trunks apart,
    // and keep the full measured crown clear of every gameplay reservation.
    const trees=occupied.filter(a=>a.model.startsWith('tree'));
    const low=occupied.filter(a=>['bush-lite','flower-cluster','rock-cluster'].includes(a.model));
    const rest=occupied.filter(a=>!trees.includes(a)&&!low.includes(a));
    const boxGap=a=>Math.max(o.box.x0-a.box.x1,a.box.x0-o.box.x1,o.box.z0-a.box.z1,a.box.z0-o.box.z1);
    gaps.decor=minimum(rest,boxGap)-.12;
    gaps.treeCrown=minimum(trees,boxGap)+2.6;
    gaps.treeSpacing=minimum(trees,a=>Math.hypot(p[0]-a.p[0],p[1]-a.p[1])-Math.max(1.7,(r+a.r)*.4));
    gaps.understoryTrunk=minimum(low,a=>pointPoly(p,a.footprint))-.4;
  }
  if(field){
    // Wheat rows may share their corner bounding circles, but their actual AABBs must not intersect.
    gaps.decor=minimum(occupied.filter(a=>a.model!=='crop-wheat'),a=>rect(p,a.box)-r)-.08;
    gaps.wheat=minimum(occupied.filter(a=>a.model==='crop-wheat'),a=>Math.max(o.box.x0-a.box.x1,a.box.x0-o.box.x1,o.box.z0-a.box.z1,a.box.z0-o.box.z1))-.025;
    const bed=base.SOIL.at(-1);gaps.field=Math.min(o.box.x0-bed.x0,bed.x1-o.box.x1,o.box.z0-bed.z0,bed.z1-o.box.z1)-.1;
  }else{
    gaps.soil=minimum(base.SOIL,b=>rect(p,b))-r-.2;
    gaps.pond=minimum(base.PONDS,e=>Math.hypot((p[0]-e.x)/(e.rx+r+1.5),(p[1]-e.z)/(e.rz+r+1.5))-1);
    gaps.mud=minimum(base.MUD,e=>Math.hypot((p[0]-e.x)/(e.rx+r+.35),(p[1]-e.z)/(e.rz+r+.35))-1);
  }
  if(Object.values(gaps).every(v=>v>=0))gaps.tractorBody=tractorGap(p,r)-.12;
  return gaps;
}
function propose(gi,p,region,field=false){p=p.map(round);const o=instance(gi,p,`new:${additions.length}`),gaps=clear(o,field),bad=Object.entries(gaps).find(([,v])=>v<0);
  if(bad){rejected[bad[0]]=(rejected[bad[0]]??0)+1;return false;}
  layout.DECOR[gi].items.push(p);occupied.push(o);additions.push({...o,region,gaps});return true;
}
const bush=base.DECOR.findIndex(g=>g.model==='bush-lite'),pine=base.DECOR.findIndex(g=>g.model==='tree-pine-lite'),oak=base.DECOR.findIndex(g=>g.model==='tree-oak-lite');
// Broadleaf-heavy staggered second row, leaving the road entrances open.
for(let i=0,x=-49.5;x<=50;x+=3.05,i++){
 const types=i%3===2?[pine,oak]:[oak,pine];let placed=false;
 for(const gi of types){for(const z of [-31.0,-30.1,-31.9,-32.6,-33.4,-28.9]){
  for(const scale of gi===oak?[1.02,.94,.86,.78,.7,.64]:[1.0,.9,.8,.72]){
   const yaw=gi===oak?Math.PI/2+Math.sin(i*2.17)*.18:Math.sin(i*2.17)*3.1;
   if(propose(gi,[x+Math.sin(i*2.4)*.22,z+Math.sin(i*1.7)*.15,yaw,scale],'north/second-row')){placed=true;break;}
  }if(placed)break;}if(placed)break;}
}
// Inner side rows stop before the southern/front rim. Pond and farm entrances stay reserved.
for(const sign of [-1,1])for(let i=0,z=-29;z<=20;z+=3.05,i++){
 const types=i%3===2?[pine,oak]:[oak,pine];let placed=false;
 for(const gi of types){for(const x of [49.55,50.25,50.95,48.8,51.5,52.1]){
  for(const scale of gi===oak?[1.03,.95,.87,.78,.7,.64]:[1.03,.93,.83,.73]){
   const yaw=gi===oak?Math.sin(i*1.91+sign)*.18:Math.cos(i*1.91+sign)*3;
   if(propose(gi,[sign*x,z+Math.sin(i*1.3)*.25,yaw,scale],sign<0?'west/second-row':'east/second-row')){placed=true;break;}
  }if(placed)break;}if(placed)break;}
}
// Low transitional undergrowth, never substituting for the requested second tree row.
for(const [i,t] of additions.filter(o=>o.model.startsWith('tree')).entries()){
 const inward=t.region.startsWith('north')?[0,1]:t.region.startsWith('west')?[1,0]:[-1,0];
 for(const offset of [2.2,2.7,3.2]){const scale=[.68,.76,.84][i%3];if(propose(bush,[t.p[0]+inward[0]*offset,t.p[1]+inward[1]*offset,t.p[2]+.5,scale],t.region+'/understory'))break;}
}

for(let gi=0;gi<base.DECOR.length;gi++){
  const g=base.DECOR[gi],target=updated.groups.find(a=>a.model===g.model&&JSON.stringify(a.fit)===JSON.stringify(g.fit)&&JSON.stringify(a.items)===JSON.stringify(g.items));
  if(!target)throw Error('Authoring/runtime baseline mismatch: '+g.model);target.items=layout.DECOR[gi].items;
}
updated.forestPass2={version:2,source:'forest-pass-2/baseline + forest-pass-2/build.mjs',scope:'Additive north and side forest groups; front rim open; every accepted placement and other dataset unchanged.'};
const originalSource=await fs.readFile(path.join(dir,'baseline/farm-decor.ts'),'utf8');
let sourceGroup=0;
const source=originalSource.replace(/(  \{ model: "[^"]+", fit: [^\n]+, items: \[\n)([\s\S]*?)(\n  \] \})/g,(full,head,body,tail)=>{
  const i=sourceGroup++,extra=layout.DECOR[i].items.slice(base.DECOR[i].items.length);
  return extra.length?head+body+',\n'+extra.map(p=>'    '+JSON.stringify(p)).join(',\n')+tail:full;
});
if(sourceGroup!==base.DECOR.length)throw Error('Runtime emitter did not find every existing group.');
await write('candidate/decor-layout.json',layout);await write('candidate/decor-authoring.json',updated);await fs.writeFile(path.join(dir,'candidate/farm-decor.ts'),source);
execFileSync('python3',[path.join(dir,'preserve-json.py')]);
const coverage=[];
for(const [region,b] of [['north',{x0:-54.5,x1:54.5,z0:-37.25,z1:-29.5}],['west',{x0:-54.75,x1:-48,z0:-29,z1:20}],['east',{x0:48,x1:54.75,z0:-29,z1:20}]]){
 const trees=original.filter(o=>o.model.startsWith('tree')),newTrees=additions.filter(o=>o.model.startsWith('tree'));let samples=0,before=0,after=0;
 for(let x=b.x0+.125;x<b.x1;x+=.25)for(let z=b.z0+.125;z<b.z1;z+=.25){samples++;const was=trees.some(t=>contains([x,z],t.footprint));if(was)before++;if(was||newTrees.some(t=>contains([x,z],t.footprint)))after++;}
 coverage.push({region,bounds:b,samples,beforeFraction:before/samples,afterFraction:after/samples,additionalCoveredArea:(after-before)*.25*.25,method:'0.25-unit grid union of full canopy footprint bounding polygons; not rendered pixel coverage'});
}
const counts=base.DECOR.map((g,i)=>({model:g.model,fit:g.fit,before:g.items.length,after:layout.DECOR[i].items.length,added:layout.DECOR[i].items.length-g.items.length,trianglesPerInstance:measured[i].triangles}));
const report={status:'numerical-candidate',canopyCoverage:coverage,sourceRevision:(await read(path.join(dir,'baseline/manifest.json'))).revision,modelHashes:hashes,models:measured.map(({points,...m})=>m),tractor:{fit:tractor.fit,size:tractor.size,sweepSamples:tractorSweep.length,dt:[1/120,1/60,.05],duration:42},counts,instancesBefore:original.length,instancesAfter:occupied.length,added:additions,rejectionCounts:rejected,additionalTriangles:additions.reduce((s,a)=>s+measured[a.gi].triangles,0),additionalModelBytes:0,additionalModelTypes:0,notes:['Conservative decoded GLB bounding boxes with actual fit; no FPS claim.','Gameplay reservations use full rotated GLB bounding polygons. Tree/tree AABB overlap up to 2.6 is intentional in forest groves; trunk centers remain at least max(1.7, 0.4*(r1+r2)) apart. Low understory clears the trunk center by 0.4.', 'Known home/filter estimates need live runtime comparison.','All accepted instances and non-DECOR exports remain unchanged.']};
await write('candidate-audit.json',report);
await write('reservations.json',{board:{x0:-55,x1:55,z0:-37.5,z1:37.5},roads:base.PATHS,fences:base.FENCES,soil:base.SOIL,ponds:base.PONDS,mud:base.MUD,tasks:author.tasks,toys:author.toys,buildings,roamingAnimals:roaming,critterHomes:homePoints,travel,tractor:{fit:tractor.fit,size:tractor.size,sweepSamples:tractorSweep.length,dt:[1/120,1/60,.05]},existingTrees:original.filter(o=>o.model.startsWith('tree')),newInstances:additions,notes:report.notes});
await write('additions.json',{baseRevision:report.sourceRevision,baselineInstances:original.length,policy:'append-only; preserve every existing group/item and all non-DECOR arrays',groups:layout.DECOR.map((g,i)=>({model:g.model,fit:g.fit,items:g.items.slice(base.DECOR[i].items.length)})).filter(g=>g.items.length)});
console.log(JSON.stringify({before:original.length,after:occupied.length,counts:counts.filter(x=>x.added),rejected,additionalTriangles:report.additionalTriangles},null,2));
