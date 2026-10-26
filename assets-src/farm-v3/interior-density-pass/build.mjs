// Interior plants and an explicit field-wheat replacement. Frozen source only.
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
const interactiveSpecs=[
 ['cow','cow-rig',{width:2.4},[12.5,.5]],['pig','pig-rig',{width:1.7},[30.5,-16]],
 ['sheep','sheep',{width:1.7,rotateY:-Math.PI/2},[46.5,-27]],['sheep2','sheep',{width:1.5,rotateY:-Math.PI/2},[49,-25]],
 ['duck','duck',{height:.9,rotateY:-Math.PI/2},[-36.7,5.6]],['duck2','duck',{height:.8,rotateY:-Math.PI/2},[-35.4,4.4]],['duck3','duck',{height:.8,rotateY:-Math.PI/2},[-36.1,2.7]],
 ['hen','hen',{height:.9},[9.5,-17.5]],['hen2','hen',{height:.85},[11,-16.2]],['rabbit','rabbit',{height:.95},[-41,-11.5]],
 ['dog','dog-rig',{height:1.5},[-36.5,-14]],['fox','fox-rig',{width:1.7},[-27,-37]],
 ['kitten','kitten',{height:.75},[-21,-16.05]],['goat','goat-rig',{width:1.6},[-12,1.5]],
 ['kid','kid',{width:1},[-17.5,1]],['kid2','kid',{width:.95},[-12.5,6]],
 ['beehive','beehive',{height:1.3},[-16,21.5]],['horse','horse-rig',{width:3},[42.5,9.5]],['puppy','dog-rig',{height:.8},[-20,-5.8]],
 ['nest','nest',{width:1.3},[17,-17.5]],['chick','chick',{height:.45},[17,-17.5]],
 ['goose','goose',{height:1},[-33.5,12.5]],['goose2','goose',{height:.95},[-32.2,13.1]],['rooster','rooster',{height:1},[1,-13]],
];
const geom=new Map(),hashes={};
for(const name of new Set([...base.DECOR.map(g=>g.model),'tractor',...interactiveSpecs.map(s=>s[1])])){
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
const interactiveAnimals=interactiveSpecs.map(([id,model,fit,home])=>{const m=fittedModel({model,fit});return{id,model,fit,home,size:m.size,r:Math.max(...m.points.map(v=>v.length()))*1.15+.15,rule:'Full origin-centred 3D bounding sphere ×1.15 +0.15, covers yaw and somersault rotation; route reservations below.'};});
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
const roaming=original.filter(o=>herdNames.has(o.model)).map(o=>({...o,roam:o.model==='hen'||o.model==='rabbit'?1.8:2.6,bodyRadius:Math.max(...measured[o.gi].points.map(v=>v.length()))*o.p[3]*1.15+.15}));
const fieldGroup=base.DECOR.findIndex(g=>g.model==='crop-wheat'&&g.fit.width===1.4);
const originalWheat=original.filter(o=>o.gi===fieldGroup);
let occupied=original.filter(o=>o.gi!==fieldGroup);const additions=[],rejected={};
layout.DECOR[fieldGroup].items=[];
const body=id=>interactiveAnimals.find(a=>a.id===id).r;
const movingLines=[
 {id:'kid-return',a:[-17.5,1],b:[-15,5],radius:body('kid')+1.5},
 {id:'kid2-return',a:[-12.5,6],b:[-15,5],radius:body('kid2')+1.5},
 {id:'kitten-descent',a:[-21,-16.05],b:[-17.3,-14.8],radius:body('kitten')+.3},
 {id:'bees',a:[-16,21.5],b:[-18.1,16.8],radius:1.0},
];
const puppyHull=hull([[-23,-8],[-8,-8],[-20,-5.8]]);
const motionCircles=[{id:'chicks-orbit',p:[17,-17.5],radius:body('chick')+1},{id:'kitten-landing',p:[-17.3,-14.8],radius:body('kitten')+.2}];
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
    animalRoam:minimum(roaming,a=>Math.hypot(p[0]-a.p[0],p[1]-a.p[1])-a.bodyRadius-a.roam)-r-.15,
    travel:minimum(travel,l=>seg(p,l.a,l.b))-1.1-r-.15,
    runtimeKeep:minimum(keep,k=>Math.hypot(p[0]-k[0],p[1]-k[1]))-filterRadius-.05,
    runtimeRoute:minimum(runtimeTravel,l=>seg(p,l.a,l.b))-filterRadius-.05,
    critterHome:minimum(homePoints,a=>Math.hypot(p[0]-a[0],p[1]-a[1]))-1.8-r-.1,
    actualAnimalBodies:minimum(interactiveAnimals,a=>pointPoly(a.home,o.footprint)-a.r)-.15,
    movingAnimals:minimum(movingLines,l=>linePoly(l.a,l.b,o.footprint)-l.radius)-.15,
    movingOrbits:minimum(motionCircles,c=>pointPoly(c.p,o.footprint)-c.radius)-.15,
    puppyReturn:polyGap(puppyHull,o.footprint)-body('puppy')-.2,
    foxBody:minimum(lines([author.travel[0]]),l=>linePoly(l.a,l.b,o.footprint))-body('fox')-.15,
  };
  // Trees/buildings use their actual boxes. Low plants use conservative footprint circles.
  gaps.decor=minimum(occupied,a=>a.model.startsWith('tree')||buildings.includes(a)?rect(p,a.box)-r:Math.hypot(p[0]-a.p[0],p[1]-a.p[1])-r-a.r)-.08;
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
const cameraExclusions=[{model:'flower-cluster',p:[13.056,4],reason:'1180 task-rabbitCold camera: one ray to cowSleepy author-working-pad edge'},{model:'flower-cluster',p:[13.074,5.911],reason:'1024 integration QA: two rays in task-rabbitCold to cowSleepy author-working-pad edge'}];
function propose(gi,p,region,field=false){p=p.map(round);const o=instance(gi,p,`new:${additions.length+(rejected.camera??0)}`),gaps=clear(o,field),bad=Object.entries(gaps).find(([,v])=>v<0);
  if(bad){rejected[bad[0]]=(rejected[bad[0]]??0)+1;return false;}
  layout.DECOR[gi].items.push(p);occupied.push(o);additions.push({...o,region,gaps});return true;
}
const bush=base.DECOR.findIndex(g=>g.model==='bush-lite'),flower=base.DECOR.findIndex(g=>g.model==='flower-cluster');
const pens=author.pens.filter(p=>!['garden','tractor-field'].includes(p.name));
const inventory=[];
const pool=[];
for(const pen of pens){const [x0,z0,x1,z1]=pen.rect;let tested=0,valid=0;const reasons={};const points=[];
 for(let x=x0+2;x<x1-2;x+=1.0)for(let z=z0+2;z<z1-2;z+=1.0){
  const p=[round(x+Math.sin(x*7+z*3)*.09),round(z+Math.cos(z*7-x*3)*.09),round(Math.sin(x+z)*Math.PI),.86];
  const o=instance(flower,p,'inventory'),gaps=clear(o),bad=Object.entries(gaps).find(([,v])=>v<0);tested++;
  if(bad){reasons[bad[0]]=(reasons[bad[0]]??0)+1;continue;}valid++;points.push(p);
 }
 const rank=p=>Math.sin(p[0]*12.9898+p[1]*78.233)*43758.5453%1;
 points.sort((a,b)=>rank(a)-rank(b));pool.push({pen,points});inventory.push({pen:pen.name,rect:pen.rect,tested,feasibleFlowerCenters:valid,representativeScale:.86,gridStep:1,minimumInsetFromPenRect:2,rejections:reasons});
}
// A handful of low green accents, well inside pens. Retain every original instance.
for(const{pen,points}of pool){if(!['cows','chickens','goats','horses','apiary'].includes(pen.name))continue;for(const p of points){if(propose(bush,[p[0],p[1],p[2],.42],pen.name+'/interior-shrub'))break;}}
// Distribute quiet flower islands between yards instead of using all allowance in the largest pen.
const quotas={rabbit:4,dog:4,chickens:16,pigs:4,hill:10,goats:8,cows:32,horses:10,orchard:10,apiary:12};
let changed=true;while(changed&&additions.filter(a=>a.model==='flower-cluster').length<90){changed=false;for(const row of pool){if(additions.filter(a=>a.region===row.pen.name+'/interior-flowers').length>=quotas[row.pen.name])continue;while(row.points.length){const p=row.points.shift();p[3]=[.82,.9,.98][additions.length%3];if(propose(flower,p,row.pen.name+'/interior-flowers')){changed=true;break;}}}}
// Remove camera-rejected points after selection so other positions/scales never reshuffle.
for(const exclusion of cameraExclusions){const index=additions.findIndex(a=>a.model===exclusion.model&&Math.hypot(a.p[0]-exclusion.p[0],a.p[1]-exclusion.p[1])<.001);if(index<0)continue;const [removed]=additions.splice(index,1);occupied=occupied.filter(o=>o.id!==removed.id);layout.DECOR[removed.gi].items=layout.DECOR[removed.gi].items.filter(p=>Math.hypot(p[0]-removed.p[0],p[1]-removed.p[1])>.001);rejected.camera=(rejected.camera??0)+1;}
const plants=additions.length,plantTriangles=additions.reduce((n,o)=>n+measured[o.gi].triangles*(o.model==='bush-lite'?2:1),0);
// Search regular golden rows under all old protection rules plus full tractor-body sweep.
const variants=[];let best=null;const bed=base.SOIL.at(-1),wheatModel=measured[fieldGroup];
for(const scale of [1.04,1,.94,.88,.82,.76,.70,.64])for(const phaseX of [0,1/3,2/3])for(const phaseZ of [0,1/3,2/3]){
 const dx=wheatModel.size[0]*scale+.035,dz=wheatModel.size[2]*scale+.035,items=[];
 for(let i=-8;i<=8;i++)for(let j=-12;j<=12;j++){
  const p=[round(29+(i+phaseX)*dx),round(26.5+(j+phaseZ)*dz),0,scale];
  if(p[0]<bed.x0||p[0]>bed.x1||p[1]<bed.z0||p[1]>bed.z1)continue;
  const o=instance(fieldGroup,p,'wheat-search');const gaps=clear(o,true);if(Object.values(gaps).every(v=>v>=0))items.push(p);
 }
 const area=items.length*wheatModel.size[0]*wheatModel.size[2]*scale*scale,estimatedDelta=plantTriangles+(items.length-originalWheat.length)*wheatModel.triangles*2;
 const v={scale,phaseX,phaseZ,count:items.length,footprintArea:area,estimatedSceneShadowDelta:estimatedDelta,items};variants.push(v);
 if(estimatedDelta<=240000&&(!best||area>best.footprintArea+1e-9||Math.abs(area-best.footprintArea)<1e-9&&items.length<best.count))best=v;
}
// Permit each complete row to shift laterally as the safe ellipse tapers.
for(const scale of [1.04,1,.94,.88,.82,.76,.70,.64])for(const phaseZ of [0,1/3,2/3]){
 const dx=wheatModel.size[0]*scale+.035,dz=wheatModel.size[2]*scale+.035,items=[];
 for(let j=-12;j<=12;j++){const z=round(26.5+(j+phaseZ)*dz);if(z<bed.z0||z>bed.z1)continue;let row=[];
  for(const phaseX of [0,1/6,2/6,3/6,4/6,5/6]){const trial=[];for(let i=-8;i<=8;i++){const p=[round(29+(i+phaseX)*dx),z,0,scale];if(p[0]<bed.x0||p[0]>bed.x1)continue;const o=instance(fieldGroup,p,'wheat-row-search');if(Object.values(clear(o,true)).every(v=>v>=0))trial.push(p);}if(trial.length>row.length)row=trial;}
  items.push(...row);
 }
 const area=items.length*wheatModel.size[0]*wheatModel.size[2]*scale*scale,estimatedDelta=plantTriangles+(items.length-originalWheat.length)*wheatModel.triangles*2;
 const v={scale,phaseX:'per-row-best-of-six',phaseZ,count:items.length,footprintArea:area,estimatedSceneShadowDelta:estimatedDelta,items};variants.push(v);
 if(estimatedDelta<=240000&&(!best||area>best.footprintArea+1e-9||Math.abs(area-best.footprintArea)<1e-9&&items.length<best.count))best=v;
}
const originalWheatCheck=originalWheat.map(o=>({p:o.p,gaps:clear(o,true)}));
if(!best)throw Error('No safe wheat row layout');
for(const p of best.items)if(!propose(fieldGroup,p,'field/golden-rows',true))throw Error('Wheat row spacing changed after grid search');
const fieldSamples=[];
// Quantify viable centres at useful wheat scales; this is not a pixel coverage claim.
const savedOccupied=occupied;occupied=occupied.filter(o=>o.gi!==fieldGroup);
for(const scale of [.64,.82,1]){let tested=0,valid=0,x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;for(let x=bed.x0+.1;x<bed.x1;x+=.2)for(let z=bed.z0+.1;z<bed.z1;z+=.2){tested++;const o=instance(fieldGroup,[round(x),round(z),0,scale],'field-area');if(Object.values(clear(o,true)).every(v=>v>=0)){valid++;x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);}}fieldSamples.push({scale,tested,valid,centerRegionAreaEstimate:valid*.04,centerBounds:{x0,z0,x1,z1},gridStep:.2});}occupied=savedOccupied;
for(let gi=0;gi<base.DECOR.length;gi++){
 const g=base.DECOR[gi],target=updated.groups.find(a=>a.model===g.model&&JSON.stringify(a.fit)===JSON.stringify(g.fit)&&JSON.stringify(a.items)===JSON.stringify(g.items));if(!target)throw Error('Authoring mismatch');target.items=layout.DECOR[gi].items;
}
const originalSource=await fs.readFile(path.join(dir,'baseline/farm-decor.ts'),'utf8');let sourceGroup=0;
const source=originalSource.replace(/(  \{ model: "[^"]+", fit: [^\n]+, items: \[\n)([\s\S]*?)(\n  \] \})/g,(full,head,body,tail)=>{
 const i=sourceGroup++;if(i===fieldGroup)return head+layout.DECOR[i].items.map(p=>'    '+JSON.stringify(p)).join(',\n')+tail;
 const extra=layout.DECOR[i].items.slice(base.DECOR[i].items.length);return extra.length?head+body+',\n'+extra.map(p=>'    '+JSON.stringify(p)).join(',\n')+tail:full;
});
if(sourceGroup!==base.DECOR.length)throw Error('Emitter missed groups');
await write('candidate/decor-layout.json',layout);await write('candidate/decor-authoring.json',updated);await fs.writeFile(path.join(dir,'candidate/farm-decor.ts'),source);
execFileSync('python3',[path.join(dir,'preserve-json.py')]);
const counts=base.DECOR.map((g,i)=>({model:g.model,fit:g.fit,before:g.items.length,after:layout.DECOR[i].items.length,delta:layout.DECOR[i].items.length-g.items.length,trianglesPerInstance:measured[i].triangles}));
const oldArea=originalWheat.reduce((a,o)=>a+(o.box.x1-o.box.x0)*(o.box.z1-o.box.z0),0);
const report={status:'numerical-candidate',sourceRevision:(await read(path.join(dir,'baseline/manifest.json'))).revision,modelHashes:hashes,models:measured.map(({points,...m})=>m),tractor:{fit:tractor.fit,size:tractor.size,sweepSamples:tractorSweep.length,dt:[1/120,1/60,.05],duration:42},counts,instancesBefore:original.length,instancesAfter:occupied.length,added:additions,plantAdditionCount:plants,replacedFieldGroup:fieldGroup,replacedWheatCount:originalWheat.length,wheat:{originalWheatCheck,before:originalWheat.length,after:best.count,selected:best,variants:variants.map(({items,...v})=>v),fieldArea:(bed.x1-bed.x0)*(bed.z1-bed.z0),beforeFootprintArea:oldArea,afterFootprintArea:best.footprintArea,centerFeasibility:fieldSamples,method:'Best total non-overlapping full-bounds area among 72 regular grids and 24 layouts allowing per-row lateral phase; candidate scales .64..1.04, phases 0/1/3/2/3, fixed spacing +.035. All reservations retained; not a proof of global optimum or pixel coverage.'},interiorInventory:inventory,cameraExclusions,rejectionCounts:rejected,additionalTriangles:additions.reduce((s,a)=>s+measured[a.gi].triangles,0)-originalWheat.length*wheatModel.triangles,estimatedSceneShadowDelta:best.estimatedSceneShadowDelta,additionalModelBytes:0,notes:['Only low interior flowers/shrubs appended; explicit replacement of field wheat only. Garden crops, all other accepted items and road data unchanged.','Full decoded GLB bbox polygons; grazing herd uses previous full roam reserves plus 3D radius. Interactive animals use full 3D radii and motion corridors.','No newly relaxed reservation. Existing gameplay contacts outside candidate remain unchanged.','Native camera/dressing/budget evidence is stored separately in verification.json; a rebuild requires fresh QA.']};
await write('candidate-audit.json',report);
await write('reservations.json',{board:{x0:-55,x1:55,z0:-37.5,z1:37.5},roads:base.PATHS,fences:base.FENCES,soil:base.SOIL,ponds:base.PONDS,mud:base.MUD,tasks:author.tasks,toys:author.toys,buildings,roamingAnimals:roaming,interactiveAnimals,movingLines,motionCircles,puppyHull,critterHomes:homePoints,travel,tractor:report.tractor,newInstances:additions,notes:report.notes});
await write('additions.json',{baseRevision:report.sourceRevision,baselineInstances:original.length,policy:'append-only for low planting; do not replace roads or shared arrays',groups:layout.DECOR.map((g,i)=>({model:g.model,fit:g.fit,items:i===fieldGroup?[]:g.items.slice(base.DECOR[i].items.length)})).filter(g=>g.items.length)});
await write('field-wheat-replacement.json',{baseRevision:report.sourceRevision,policy:'Replace ONLY this exact field crop-wheat group after confirming before items; leave the garden wheat and all other crops unchanged.',model:base.DECOR[fieldGroup].model,fit:base.DECOR[fieldGroup].fit,before:base.DECOR[fieldGroup].items,after:layout.DECOR[fieldGroup].items});
console.log(JSON.stringify({before:original.length,after:occupied.length,counts:counts.filter(x=>x.delta),plants,field:report.wheat,additionalTriangles:report.additionalTriangles,estimatedSceneShadowDelta:report.estimatedSceneShadowDelta},null,2));
